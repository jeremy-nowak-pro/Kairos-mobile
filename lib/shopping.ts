import { supabase } from './supabase'
import { File, Paths } from 'expo-file-system'

// ── Cache local (fallback hors ligne) ─────────────────────────────────────────

const listsCache = (spaceId: string) => new File(Paths.document, `sc_lists_${spaceId}.json`)
const itemsCache = (listId: string) => new File(Paths.document, `sc_items_${listId}.json`)
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

export async function getItems(listId: string): Promise<ShoppingItem[]> {
  try {
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
): Promise<ShoppingItem> {
  let image_path: string | null = null

  if (pickerUri) {
    const ext = pickerUri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedMime.includes(mime)) throw new Error('Type de fichier non autorisé')
    const path = `${spaceId}/${crypto.randomUUID()}.${ext}`
    const buffer = await fetch(pickerUri).then(r => r.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('shopping-photos')
      .upload(path, buffer, { contentType: mime, upsert: false })
    if (!uploadError) image_path = path
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

export async function toggleItem(listId: string, itemId: string, checked: boolean): Promise<void> {
  await supabase.from('shopping_items').update({ checked }).eq('id', itemId)
  const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
  writeCache(itemsCache(listId), cached.map(i => i.id === itemId ? { ...i, checked } : i))
}

export async function deleteItem(listId: string, itemId: string): Promise<void> {
  const cached = await readCache<ShoppingItem[]>(itemsCache(listId), [])
  const target = cached.find(i => i.id === itemId)

  if (target?.image_path) {
    await supabase.storage.from('shopping-photos').remove([target.image_path])
  }

  await supabase.from('shopping_items').delete().eq('id', itemId)
  writeCache(itemsCache(listId), cached.filter(i => i.id !== itemId))
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
