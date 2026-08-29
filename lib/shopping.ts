import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { File, Paths } from 'expo-file-system'
import * as Crypto from 'expo-crypto'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

// ── Cache local (fallback hors ligne) ─────────────────────────────────────────

const listsCache = (spaceId: string) => new File(Paths.document, `sc_lists_${spaceId}.json`)
const itemsCache = (listId: string) => new File(Paths.document, `sc_items_${listId}.json`)
const pendingTogglesCache = (listId: string) => new File(Paths.document, `sc_pending_${listId}.json`)
const storesFile = new File(Paths.document, 'shopping_stores.json')

async function readCache<T>(file: File, fallback: T): Promise<T> {
  if (!file.exists) return fallback
  try {
    const raw = await file.text()
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeCache(file: File, data: unknown): void {
  try { file.write(JSON.stringify(data)) } catch { /* best effort */ }
}

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
  checked: boolean
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

const localPhotoFile = (imagePath: string) =>
  new File(Paths.document, `sc_photo_${imagePath.replace(/\//g, '_').replace(/\.[a-zA-Z0-9]+$/, '')}.jpg`)

// Sert la copie locale compressée si elle existe déjà (fonctionne hors ligne).
// Sinon télécharge la photo, la redimensionne/recompresse, et la met en cache disque.
export async function getPhotoLocalUri(imagePath: string): Promise<string> {
  const local = localPhotoFile(imagePath)
  if (local.exists) return local.uri

  const signedUrl = await getPhotoSignedUrl(imagePath)
  const temp = await File.downloadFileAsync(signedUrl, Paths.cache, { idempotent: true })
  try {
    const rendered = await ImageManipulator.manipulate(temp.uri).resize({ width: 800 }).renderAsync()
    const compressed = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG })
    new File(compressed.uri).move(local)
    return local.uri
  } finally {
    if (temp.exists) temp.delete()
  }
}

// ── Lists ─────────────────────────────────────────────────────────────────────

export async function getLists(spaceId: string): Promise<ShoppingList[]> {
  try {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true })
    if (error) throw error
    writeCache(listsCache(spaceId), data)
    return data as ShoppingList[]
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
}

// ── Items ─────────────────────────────────────────────────────────────────────

interface PendingToggle { itemId: string; checked: boolean }

// Pousse les changements d'état faits hors ligne vers Supabase. Best-effort :
// silencieux si toujours hors ligne, les entrées non synchronisées restent en file.
export async function syncPendingToggles(listId: string): Promise<void> {
  const pending = await readCache<PendingToggle[]>(pendingTogglesCache(listId), [])
  if (pending.length === 0) return

  const remaining: PendingToggle[] = []
  for (const p of pending) {
    const { error } = await supabase.from('shopping_items').update({ checked: p.checked }).eq('id', p.itemId)
    if (error) remaining.push(p)
  }
  writeCache(pendingTogglesCache(listId), remaining)
}

export async function getItems(listId: string): Promise<ShoppingItem[]> {
  try {
    await syncPendingToggles(listId)
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

export async function toggleItem(listId: string, itemId: string, checked: boolean): Promise<void> {
  const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
  writeCache(itemsCache(listId), cached.map(i => i.id === itemId ? { ...i, checked } : i))

  try {
    const { error } = await supabase.from('shopping_items').update({ checked }).eq('id', itemId)
    if (error) throw error
  } catch {
    const pending = await readCache<PendingToggle[]>(pendingTogglesCache(listId), [])
    writeCache(pendingTogglesCache(listId), [...pending.filter(p => p.itemId !== itemId), { itemId, checked }])
  }
}

export async function deleteItem(listId: string, itemId: string): Promise<void> {
  const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
  const target = cached.find(i => i.id === itemId)

  if (target?.image_path) {
    await supabase.storage.from('shopping-photos').remove([target.image_path])
    const local = localPhotoFile(target.image_path)
    if (local.exists) local.delete()
  }

  await supabase.from('shopping_items').delete().eq('id', itemId)
  writeCache(itemsCache(listId), cached.filter(i => i.id !== itemId))
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
      .select('name, checked')
      .eq('list_id', list.id)

    if (items?.length) {
      await supabase.from('shopping_items').insert(
        (items as { name: string; checked: boolean }[]).map(item => ({
          list_id: newList.id,
          name: item.name,
          checked: item.checked,
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
