import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import * as Crypto from 'expo-crypto'
import { getCompressedLocalUri, deleteLocalMedia } from './mediaCache'
import { cacheFile, readCache, writeCache } from './localCache'
import { getOutbox, enqueue, removeFromOutbox, markOutboxFailed, mergeIntoPendingCreate, cancelPendingCreate, clearOutbox } from './outbox'

// ── Cache local (fallback hors ligne) ─────────────────────────────────────────

const listsCache = (spaceId: string) => cacheFile(`sc_lists_${spaceId}.json`)
const itemsCache = (listId: string) => cacheFile(`sc_items_${listId}.json`)
const storesFile = cacheFile('shopping_stores.json')
const isLocalId = (id: string) => id.startsWith('local-')

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ShoppingList {
  id: string
  space_id: string
  name: string
  date: string | null
  created_by: string
  created_at: string
}

export interface ShoppingItem {
  id: string
  list_id: string
  name: string
  image_path: string | null
  done: boolean
  created_at: string
}

const photoUrlCache = new Map<string, { url: string; expiresAt: number }>()
const URL_TTL = 55 * 60 * 1000

export async function getPhotoSignedUrl(imagePath: string): Promise<string> {
  const cached = photoUrlCache.get(imagePath)
  if (cached && Date.now() < cached.expiresAt) return cached.url

  const { data, error } = await supabase.storage
    .from('shopping-photos')
    .createSignedUrl(imagePath, 3600)
  if (error) throw error

  photoUrlCache.set(imagePath, { url: data.signedUrl, expiresAt: Date.now() + URL_TTL })
  return data.signedUrl
}

// Sert la copie locale compressée si elle existe déjà (fonctionne hors ligne).
// Sinon télécharge la photo, la redimensionne/recompresse, et la met en cache disque.
export async function getPhotoLocalUri(imagePath: string): Promise<string> {
  return getCompressedLocalUri('sc_photo', imagePath, getPhotoSignedUrl)
}

// ── Lists ─────────────────────────────────────────────────────────────────────

// Une liste sans date est une liste de référence (ex: courses habituelles) —
// elle reste tant qu'elle n'est pas supprimée à la main. Une liste datée n'a
// plus d'utilité 2 jours après le jour prévu ; elle se supprime toute seule.
const EXPIRY_DAYS = 2

function isListExpired(list: ShoppingList): boolean {
  if (!list.date) return false
  const cutoff = new Date(list.date + 'T00:00:00')
  cutoff.setDate(cutoff.getDate() + EXPIRY_DAYS)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today > cutoff
}

export async function getLists(spaceId: string): Promise<ShoppingList[]> {
  try {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true })
    if (error) throw error

    const lists = data as ShoppingList[]
    const expired = lists.filter(isListExpired)
    if (expired.length > 0) {
      await Promise.all(expired.map(l => deleteList(l.id, spaceId).catch(() => {})))
    }

    const remaining = lists.filter(l => !isListExpired(l))
    writeCache(listsCache(spaceId), remaining)
    return remaining
  } catch {
    return readCache<ShoppingList[]>(listsCache(spaceId), [])
  }
}

export async function createList(
  spaceId: string,
  createdBy: string,
  name: string,
  date?: string | null,
): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({ space_id: spaceId, created_by: createdBy, name, date: date ?? null })
    .select()
    .single()
  if (error) throw error
  const list = data as ShoppingList
  const cached = await readCache<ShoppingList[]>(listsCache(spaceId), [])
  writeCache(listsCache(spaceId), [...cached, list])
  return list
}

export async function deleteList(id: string, spaceId: string): Promise<void> {
  const { data: items } = await supabase
    .from('shopping_items')
    .select('image_path')
    .eq('list_id', id)

  const paths = (items ?? [])
    .map((i: { image_path: string | null }) => i.image_path)
    .filter(Boolean) as string[]
  if (paths.length > 0) {
    await supabase.storage.from('shopping-photos').remove(paths)
  }

  const { error } = await supabase.from('shopping_lists').delete().eq('id', id)
  if (error) throw error

  const cached = await readCache<ShoppingList[]>(listsCache(spaceId), [])
  writeCache(listsCache(spaceId), cached.filter(l => l.id !== id))

  const cf = itemsCache(id)
  if (cf.exists) cf.delete()
  clearOutbox(id)
}

// ── Items ─────────────────────────────────────────────────────────────────────

// Rejoue les mutations créées hors ligne (create/update/delete), dans l'ordre
// où elles ont été faites. Best-effort : une entrée qui échoue encore reste
// en file (marquée "failed") plutôt que de bloquer les suivantes.
export async function syncPendingChanges(listId: string): Promise<void> {
  const queue = await getOutbox(listId)
  if (queue.length === 0) return

  for (const entry of queue) {
    try {
      if (entry.op === 'create') {
        const { data, error } = await supabase
          .from('shopping_items')
          .insert(entry.payload)
          .select()
          .single()
        if (error) throw error
        const item = data as ShoppingItem
        const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
        writeCache(itemsCache(listId), cached.map(i => i.id === entry.localId ? item : i))
      } else if (entry.op === 'update' && entry.targetId) {
        const { error } = await supabase.from('shopping_items').update(entry.payload).eq('id', entry.targetId)
        if (error) throw error
      } else if (entry.op === 'delete' && entry.targetId) {
        const { error } = await supabase.from('shopping_items').delete().eq('id', entry.targetId)
        if (error) throw error
      }
      await removeFromOutbox(listId, entry.id)
    } catch (err) {
      await markOutboxFailed(listId, entry.id, err)
    }
  }
}

export async function getItems(listId: string): Promise<ShoppingItem[]> {
  try {
    await syncPendingChanges(listId)
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
    if (error) throw error
    writeCache(itemsCache(listId), data)
    return data as ShoppingItem[]
  } catch {
    return readCache<ShoppingItem[]>(itemsCache(listId), [])
  }
}

export async function addItem(
  listId: string,
  spaceId: string,
  name: string,
  pickerUri: string | null,
  pickerMime?: string | null,
): Promise<ShoppingItem> {
  try {
    let image_path: string | null = null

    if (pickerUri) {
      const { data: existingPhotos, error: countError } = await supabase
        .from('shopping_items')
        .select('id')
        .eq('list_id', listId)
        .not('image_path', 'is', null)
      if (countError) throw countError
      if ((existingPhotos?.length ?? 0) >= 5) throw new Error('Limite de 5 photos par liste atteinte')

      const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      const extFromUri = pickerUri.split('.').pop()?.toLowerCase()
      const mime = pickerMime?.toLowerCase()
        ?? (extFromUri ? `image/${extFromUri === 'jpg' ? 'jpeg' : extFromUri}` : 'image/jpeg')
      if (!allowedMime.includes(mime)) throw new Error('Type de fichier non autorisé')
      const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]
      const path = `${spaceId}/${Crypto.randomUUID()}.${ext}`
      const buffer = await fetch(pickerUri).then(r => r.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from('shopping-photos')
        .upload(path, buffer, { contentType: mime, upsert: false })
      if (uploadError) throw uploadError
      image_path = path
    }

    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ list_id: listId, name, image_path })
      .select()
      .single()
    if (error) throw error

    const item = data as ShoppingItem
    const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
    writeCache(itemsCache(listId), [item, ...cached])
    return item
  } catch (err) {
    // Une photo exige le réseau de bout en bout (upload Storage) — pas de
    // mode dégradé possible, on ne masque jamais cette erreur.
    if (pickerUri) throw err

    const localId = `local-${Crypto.randomUUID()}`
    const localItem: ShoppingItem = {
      id: localId, list_id: listId, name, image_path: null, done: false,
      created_at: new Date().toISOString(),
    }
    const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
    writeCache(itemsCache(listId), [localItem, ...cached])
    await enqueue(listId, {
      id: Crypto.randomUUID(), op: 'create', localId,
      payload: { list_id: listId, name, image_path: null },
    })
    return localItem
  }
}

export type ShoppingItemChange =
  | { type: 'insert'; item: ShoppingItem }
  | { type: 'update'; item: ShoppingItem }
  | { type: 'delete'; id: string }

export function subscribeToItems(
  listId: string,
  onChange: (change: ShoppingItemChange) => void,
): RealtimeChannel {
  return supabase
    .channel(`shopping_items:${listId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shopping_items',
      filter: `list_id=eq.${listId}`,
    }, payload => {
      if (payload.eventType === 'INSERT') onChange({ type: 'insert', item: payload.new as ShoppingItem })
      else if (payload.eventType === 'UPDATE') onChange({ type: 'update', item: payload.new as ShoppingItem })
      else if (payload.eventType === 'DELETE') onChange({ type: 'delete', id: (payload.old as { id: string }).id })
    })
    .subscribe()
}

export async function toggleItem(listId: string, itemId: string, done: boolean): Promise<void> {
  const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
  writeCache(itemsCache(listId), cached.map(i => i.id === itemId ? { ...i, done } : i))

  if (isLocalId(itemId)) {
    await mergeIntoPendingCreate(listId, itemId, { done })
    return
  }

  try {
    const { error } = await supabase.from('shopping_items').update({ done }).eq('id', itemId)
    if (error) throw error
  } catch {
    await enqueue(listId, { id: Crypto.randomUUID(), op: 'update', targetId: itemId, payload: { done } })
  }
}

export async function deleteItem(listId: string, itemId: string): Promise<void> {
  const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
  const target = cached.find(i => i.id === itemId)
  writeCache(itemsCache(listId), cached.filter(i => i.id !== itemId))

  if (isLocalId(itemId)) {
    await cancelPendingCreate(listId, itemId)
    return
  }

  try {
    if (target?.image_path) {
      await supabase.storage.from('shopping-photos').remove([target.image_path])
      deleteLocalMedia('sc_photo', target.image_path)
    }
    const { error } = await supabase.from('shopping_items').delete().eq('id', itemId)
    if (error) throw error
  } catch {
    await enqueue(listId, { id: Crypto.randomUUID(), op: 'delete', targetId: itemId, payload: {} })
  }
}

// ── Migration inter-espaces ───────────────────────────────────────────────────

export async function exportListsToSpace(
  fromSpaceId: string,
  toSpaceId: string,
  createdBy: string,
): Promise<number> {
  const { data: lists, error } = await supabase
    .from('shopping_lists')
    .select('id, name, date')
    .eq('space_id', fromSpaceId)
  if (error) throw error
  if (!lists?.length) return 0

  let count = 0
  for (const list of lists as { id: string; name: string; date: string | null }[]) {
    const { data: newList, error: listErr } = await supabase
      .from('shopping_lists')
      .insert({ space_id: toSpaceId, name: list.name, date: list.date, created_by: createdBy })
      .select('id')
      .single()
    if (listErr || !newList) continue

    const { data: items } = await supabase
      .from('shopping_items')
      .select('name, done')
      .eq('list_id', list.id)

    if (items?.length) {
      await supabase.from('shopping_items').insert(
        (items as { name: string; done: boolean }[]).map(item => ({
          list_id: newList.id,
          name: item.name,
          done: item.done,
          image_path: null,
        }))
      )
    }
    count++
  }
  return count
}

// ── Historique magasins (local uniquement) ────────────────────────────────────

export async function getStoreHistory(): Promise<string[]> {
  return readCache<string[]>(storesFile, [])
}

export async function addToStoreHistory(name: string): Promise<void> {
  const history = await getStoreHistory()
  if (history.includes(name)) return
  writeCache(storesFile, [name, ...history])
}

export async function removeFromStoreHistory(name: string): Promise<void> {
  const history = await getStoreHistory()
  writeCache(storesFile, history.filter(s => s !== name))
}
