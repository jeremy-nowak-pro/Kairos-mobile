import {
  getLists,
  createList,
  deleteList,
  getItems,
  addItem,
  toggleItem,
  deleteItem,
  syncPendingChanges,
  getPhotoSignedUrl,
  getStoreHistory,
  addToStoreHistory,
  removeFromStoreHistory,
} from '../shopping'
import { supabase } from '../supabase'
import * as FS from 'expo-file-system'

// ── Mock expo-file-system ─────────────────────────────────────────────────────
// Les méthodes MockFile accèdent à `files` via closure — __reset() réinitialise
// la variable et tous les accès suivants voient le nouvel objet vide.

jest.mock('expo-file-system', () => {
  let files: Record<string, string> = {}
  class MockFile {
    _p: string
    constructor(dir: string, name: string) { this._p = `${dir}/${name}` }
    get exists() { return this._p in files }
    async text() { return files[this._p] ?? '' }
    write(content: string) { files[this._p] = content }
    delete() { delete files[this._p] }
  }
  return {
    File: MockFile,
    Paths: { document: '/doc' },
    __reset: () => { files = {} },
    __set: (path: string, content: string) => { files[path] = content },
  }
})

// ── Mock Supabase ─────────────────────────────────────────────────────────────

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid'),
}))

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}))

const mockFrom = supabase.from as jest.Mock
const mockStorageFrom = (supabase.storage as any).from as jest.Mock

function chain(result: unknown) {
  const c: any = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'gte', 'order', 'not']) {
    c[m] = jest.fn().mockReturnValue(c)
  }
  c.single = jest.fn().mockResolvedValue(result)
  c.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return c
}

const LIST = { id: 'l1', space_id: 's1', name: 'Courses', date: null, created_by: 'u1', created_at: '' }
const ITEM = { id: 'i1', list_id: 'l1', name: 'Lait', image_path: null, done: false, created_at: '' }

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(FS as any).__reset()
})

// ─── getLists ─────────────────────────────────────────────────────────────────

describe('getLists', () => {
  it('retourne les listes depuis Supabase', async () => {
    mockFrom.mockReturnValue(chain({ data: [LIST], error: null }))
    expect(await getLists('s1')).toEqual([LIST])
  })

  it('tombe en fallback cache si Supabase échoue', async () => {
    ;(FS as any).__set('/doc/sc_lists_s1.json', JSON.stringify([LIST]))
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    expect(await getLists('s1')).toEqual([LIST])
  })

  it('retourne [] si Supabase échoue et le cache est vide', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    expect(await getLists('s1')).toEqual([])
  })

  it('supprime automatiquement une liste datée de plus de 2 jours', async () => {
    const expiredList = { ...LIST, id: 'l-old', date: daysAgo(5) }
    const deleteChain = chain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(chain({ data: [expiredList], error: null })) // select shopping_lists
      .mockReturnValueOnce(chain({ data: [], error: null })) // select items (image_path) dans deleteList
      .mockReturnValueOnce(deleteChain) // delete shopping_lists

    const result = await getLists('s1')
    expect(result).toEqual([])
    expect(deleteChain.delete).toHaveBeenCalled()
  })

  it('garde une liste datée de moins de 2 jours', async () => {
    const recentList = { ...LIST, id: 'l-recent', date: daysAgo(1) }
    mockFrom.mockReturnValue(chain({ data: [recentList], error: null }))
    expect(await getLists('s1')).toEqual([recentList])
  })

  it('garde une liste sans date indéfiniment', async () => {
    mockFrom.mockReturnValue(chain({ data: [LIST], error: null }))
    expect(await getLists('s1')).toEqual([LIST])
  })
})

// ─── createList ───────────────────────────────────────────────────────────────

describe('createList', () => {
  it('crée et retourne la liste', async () => {
    mockFrom.mockReturnValue(chain({ data: LIST, error: null }))
    expect(await createList('s1', 'u1', 'Courses')).toEqual(LIST)
  })

  it('lève une erreur en cas d\'échec', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('insert error') }))
    await expect(createList('s1', 'u1', 'Courses')).rejects.toThrow('insert error')
  })
})

// ─── deleteList ───────────────────────────────────────────────────────────────

describe('deleteList', () => {
  it('supprime la liste sans appeler le storage s\'il n\'y a pas de photos', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    await deleteList('l1', 's1')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('supprime les photos du storage avant de supprimer la liste', async () => {
    const mockRemove = jest.fn().mockResolvedValue({})
    mockStorageFrom.mockReturnValue({ remove: mockRemove })
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ image_path: 'photos/img.jpg' }], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    await deleteList('l1', 's1')
    expect(mockRemove).toHaveBeenCalledWith(['photos/img.jpg'])
  })

  it('ne passe que les chemins non-null au storage (items mixtes)', async () => {
    const mockRemove = jest.fn().mockResolvedValue({})
    mockStorageFrom.mockReturnValue({ remove: mockRemove })
    mockFrom
      .mockReturnValueOnce(chain({
        data: [{ image_path: 'photos/a.jpg' }, { image_path: null }, { image_path: 'photos/b.jpg' }],
        error: null,
      }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    await deleteList('l1', 's1')
    expect(mockRemove).toHaveBeenCalledWith(['photos/a.jpg', 'photos/b.jpg'])
  })

  it('lève une erreur si la suppression DB échoue', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: new Error('delete error') }))
    await expect(deleteList('l1', 's1')).rejects.toThrow('delete error')
  })
})

// ─── getItems ─────────────────────────────────────────────────────────────────

describe('getItems', () => {
  it('retourne les items depuis Supabase', async () => {
    mockFrom.mockReturnValue(chain({ data: [ITEM], error: null }))
    expect(await getItems('l1')).toEqual([ITEM])
  })

  it('tombe en fallback cache si Supabase échoue', async () => {
    ;(FS as any).__set('/doc/sc_items_l1.json', JSON.stringify([ITEM]))
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    expect(await getItems('l1')).toEqual([ITEM])
  })

  it('retourne [] si Supabase échoue et le cache est vide', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    expect(await getItems('l1')).toEqual([])
  })
})

// ─── addItem ──────────────────────────────────────────────────────────────────

describe('addItem', () => {
  it('ajoute un item sans photo', async () => {
    mockFrom.mockReturnValue(chain({ data: ITEM, error: null }))
    expect(await addItem('l1', 's1', 'Lait', null)).toEqual(ITEM)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('rejette un type MIME non autorisé', async () => {
    // Le check de limite précède la validation MIME — on mock le count
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    await expect(addItem('l1', 's1', 'Image', 'file:///photo.bmp'))
      .rejects.toThrow('Type de fichier non autorisé')
  })

  it('rejette si la liste a déjà 5 photos', async () => {
    mockFrom.mockReturnValueOnce(chain({
      data: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
      error: null,
    }))
    await expect(addItem('l1', 's1', 'Item', 'file:///test.jpg'))
      .rejects.toThrow('Limite de 5 photos par liste atteinte')
  })

  it('autorise l\'ajout si la liste a exactement 4 photos', async () => {
    const itemWithPhoto = { ...ITEM, image_path: 's1/test-uuid.jpg' }
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }], error: null }))
      .mockReturnValueOnce(chain({ data: itemWithPhoto, error: null }))
    mockStorageFrom.mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: null }) })
    ;(global as any).fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
    const result = await addItem('l1', 's1', 'Photo', 'file:///test.jpg')
    expect(result.image_path).toBe('s1/test-uuid.jpg')
  })

  it('uploade la photo et retourne l\'item avec image_path', async () => {
    const itemWithPhoto = { ...ITEM, image_path: 's1/test-uuid.png' }
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: itemWithPhoto, error: null }))
    const mockUpload = jest.fn().mockResolvedValue({ error: null })
    mockStorageFrom.mockReturnValue({ upload: mockUpload })
    ;(global as any).fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
    const result = await addItem('l1', 's1', 'Photo', 'file:///test.png')
    expect(mockUpload).toHaveBeenCalledWith(
      's1/test-uuid.png',
      expect.any(ArrayBuffer),
      { contentType: 'image/png', upsert: false },
    )
    expect(result.image_path).toBe('s1/test-uuid.png')
  })

  it('lève une erreur si le count check échoue', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: new Error('count error') }))
    await expect(addItem('l1', 's1', 'Item', 'file:///test.jpg'))
      .rejects.toThrow('count error')
  })

  it('crée localement et met en file si hors ligne (sans photo)', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    const result = await addItem('l1', 's1', 'Lait', null)
    expect(result.id).toMatch(/^local-/)
    expect(result.name).toBe('Lait')
    expect(result.done).toBe(false)
  })

  it('ne crée jamais localement si une photo est jointe (réseau obligatoire)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: new Error('network') }))
    await expect(addItem('l1', 's1', 'Photo', 'file:///test.jpg'))
      .rejects.toThrow('network')
  })
})

// ─── toggleItem ───────────────────────────────────────────────────────────────

describe('toggleItem', () => {
  it('appelle Supabase update avec done=true', async () => {
    const c = chain({ data: null, error: null })
    mockFrom.mockReturnValue(c)
    await toggleItem('l1', 'i1', true)
    expect(c.update).toHaveBeenCalledWith({ done: true })
    expect(c.eq).toHaveBeenCalledWith('id', 'i1')
  })

  it('appelle Supabase update avec done=false', async () => {
    const c = chain({ data: null, error: null })
    mockFrom.mockReturnValue(c)
    await toggleItem('l1', 'i1', false)
    expect(c.update).toHaveBeenCalledWith({ done: false })
  })

  it('met en file si le réseau échoue, sans jamais lever d\'erreur', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    await expect(toggleItem('l1', 'i1', true)).resolves.toBeUndefined()
  })

  it('fusionne le toggle dans la création en attente si l\'item est encore local', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    const created = await addItem('l1', 's1', 'Lait', null)
    await toggleItem('l1', created.id, true)

    const insertChain = chain({ data: { ...ITEM, id: 'real1', done: true }, error: null })
    mockFrom.mockReturnValue(insertChain)
    await syncPendingChanges('l1')

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ list_id: 'l1', name: 'Lait', done: true })
    )
  })
})

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  it('supprime sans toucher au storage si pas de photo', async () => {
    ;(FS as any).__set('/doc/sc_items_l1.json', JSON.stringify([ITEM]))
    mockFrom.mockReturnValue(chain({ data: null, error: null }))
    await deleteItem('l1', 'i1')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('supprime la photo du storage si elle existe', async () => {
    const itemWithPhoto = { ...ITEM, image_path: 'photos/img.jpg' }
    ;(FS as any).__set('/doc/sc_items_l1.json', JSON.stringify([itemWithPhoto]))
    const mockRemove = jest.fn().mockResolvedValue({})
    mockStorageFrom.mockReturnValue({ remove: mockRemove })
    mockFrom.mockReturnValue(chain({ data: null, error: null }))
    await deleteItem('l1', 'i1')
    expect(mockRemove).toHaveBeenCalledWith(['photos/img.jpg'])
  })

  it('met en file la suppression si le réseau échoue', async () => {
    ;(FS as any).__set('/doc/sc_items_l1.json', JSON.stringify([ITEM]))
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    await expect(deleteItem('l1', 'i1')).resolves.toBeUndefined()

    const deleteChain = chain({ data: null, error: null })
    mockFrom.mockReturnValue(deleteChain)
    await syncPendingChanges('l1')
    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'i1')
  })

  it('annule la création en attente si on supprime un item encore local', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    const created = await addItem('l1', 's1', 'Lait', null)
    await deleteItem('l1', created.id)

    const insertChain = chain({ data: null, error: null })
    mockFrom.mockReturnValue(insertChain)
    await syncPendingChanges('l1')
    expect(insertChain.insert).not.toHaveBeenCalled()
  })
})

// ─── syncPendingChanges ───────────────────────────────────────────────────────

describe('syncPendingChanges', () => {
  it('remplace l\'item local par l\'item réel après synchro d\'une création', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    const created = await addItem('l1', 's1', 'Lait', null)

    const real = { ...ITEM, id: 'real-1', name: 'Lait' }
    mockFrom.mockReturnValue(chain({ data: real, error: null }))
    await syncPendingChanges('l1')

    const raw = await new (FS as any).File('/doc', 'sc_items_l1.json').text()
    const cachedItems = JSON.parse(raw)
    expect(cachedItems.find((i: any) => i.id === 'real-1')).toBeDefined()
    expect(cachedItems.find((i: any) => i.id === created.id)).toBeUndefined()
  })

  it('ne fait rien si la file est vide', async () => {
    await expect(syncPendingChanges('l1')).resolves.toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ─── getPhotoSignedUrl ────────────────────────────────────────────────────────

describe('getPhotoSignedUrl', () => {
  it('appelle Supabase pour une URL non cachée', async () => {
    const mockCreateSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://cdn.example.com/photo.jpg' },
      error: null,
    })
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
    const url = await getPhotoSignedUrl('photos/unique-miss.jpg')
    expect(url).toBe('https://cdn.example.com/photo.jpg')
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('ne rappelle pas Supabase pour une URL déjà en cache', async () => {
    const mockCreateSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://cdn.example.com/cached.jpg' },
      error: null,
    })
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
    await getPhotoSignedUrl('photos/unique-hit.jpg')
    await getPhotoSignedUrl('photos/unique-hit.jpg')
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('lève une erreur si Supabase échoue', async () => {
    mockStorageFrom.mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: new Error('storage error') }),
    })
    await expect(getPhotoSignedUrl('photos/unique-err.jpg')).rejects.toThrow('storage error')
  })
})

// ─── Historique magasins (local) ──────────────────────────────────────────────

describe('getStoreHistory', () => {
  it('retourne [] si aucun historique', async () => {
    expect(await getStoreHistory()).toEqual([])
  })

  it('retourne l\'historique existant', async () => {
    ;(FS as any).__set('/doc/shopping_stores.json', JSON.stringify(['Carrefour', 'Lidl']))
    expect(await getStoreHistory()).toEqual(['Carrefour', 'Lidl'])
  })
})

describe('addToStoreHistory', () => {
  it('ajoute un nouveau magasin en tête de liste', async () => {
    ;(FS as any).__set('/doc/shopping_stores.json', JSON.stringify(['Lidl']))
    await addToStoreHistory('Carrefour')
    expect(await getStoreHistory()).toEqual(['Carrefour', 'Lidl'])
  })

  it('n\'ajoute pas un doublon', async () => {
    ;(FS as any).__set('/doc/shopping_stores.json', JSON.stringify(['Carrefour']))
    await addToStoreHistory('Carrefour')
    expect(await getStoreHistory()).toEqual(['Carrefour'])
  })
})

describe('removeFromStoreHistory', () => {
  it('retire le magasin spécifié', async () => {
    ;(FS as any).__set('/doc/shopping_stores.json', JSON.stringify(['Carrefour', 'Lidl']))
    await removeFromStoreHistory('Carrefour')
    expect(await getStoreHistory()).toEqual(['Lidl'])
  })

  it('ne plante pas si le magasin n\'existe pas', async () => {
    ;(FS as any).__set('/doc/shopping_stores.json', JSON.stringify(['Lidl']))
    await expect(removeFromStoreHistory('Carrefour')).resolves.toBeUndefined()
    expect(await getStoreHistory()).toEqual(['Lidl'])
  })
})
