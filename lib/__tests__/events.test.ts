import {
  getUpcomingEvents,
  getEventsForMonth,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  exportEventsToSpace,
  syncPendingChanges,
} from '../events'
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

// Crée un objet chainable thenable — couvre les deux patterns :
//   await chain (terminal sans .single)
//   await chain.single() (terminal avec .single)
function chain(result: unknown) {
  const c: any = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'gte', 'lte', 'order']) {
    c[m] = jest.fn().mockReturnValue(c)
  }
  c.single = jest.fn().mockResolvedValue(result)
  c.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return c
}

const EVENT = {
  id: 'e1',
  title: 'Réunion',
  date: '2099-06-10', // loin dans le futur : ne devient jamais "passé" pour les tests de filtrage
  start_time: '10:00',
  end_time: '11:00',
  location: null,
  description: null,
  assigned_to: null,
  created_by: 'u1',
  space_id: 's1',
  created_at: '2026-06-01',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(FS as any).__reset()
})

// ─── getUpcomingEvents ────────────────────────────────────────────────────────

describe('getUpcomingEvents', () => {
  it('retourne les événements à venir', async () => {
    mockFrom.mockReturnValue(chain({ data: [EVENT], error: null }))
    expect(await getUpcomingEvents('s1')).toEqual([EVENT])
    expect(mockFrom).toHaveBeenCalledWith('events')
  })

  it('retourne un tableau vide si aucun événement', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }))
    expect(await getUpcomingEvents('s1')).toEqual([])
  })

  it('tombe en fallback cache si Supabase échoue', async () => {
    ;(FS as any).__set('/doc/ev_all_s1.json', JSON.stringify([EVENT]))
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('db error') }))
    expect(await getUpcomingEvents('s1')).toEqual([EVENT])
  })

  it('retourne [] si Supabase échoue et le cache est vide', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('db error') }))
    expect(await getUpcomingEvents('s1')).toEqual([])
  })
})

// ─── getEventsForMonth ────────────────────────────────────────────────────────

describe('getEventsForMonth', () => {
  it('calcule la plage correcte pour janvier', async () => {
    const c = chain({ data: [], error: null })
    mockFrom.mockReturnValue(c)
    await getEventsForMonth('s1', 2025, 0)
    expect(c.gte).toHaveBeenCalledWith('date', '2025-01-01')
    expect(c.lte).toHaveBeenCalledWith('date', '2025-01-31')
  })

  it('calcule la plage correcte pour février (année non bissextile)', async () => {
    const c = chain({ data: [], error: null })
    mockFrom.mockReturnValue(c)
    await getEventsForMonth('s1', 2025, 1)
    expect(c.gte).toHaveBeenCalledWith('date', '2025-02-01')
    expect(c.lte).toHaveBeenCalledWith('date', '2025-02-28')
  })

  it('calcule la plage correcte pour février (année bissextile)', async () => {
    const c = chain({ data: [], error: null })
    mockFrom.mockReturnValue(c)
    await getEventsForMonth('s1', 2024, 1)
    expect(c.gte).toHaveBeenCalledWith('date', '2024-02-01')
    expect(c.lte).toHaveBeenCalledWith('date', '2024-02-29')
  })

  it('tombe en fallback cache si Supabase échoue', async () => {
    const janEvent = { ...EVENT, date: '2025-01-15' }
    ;(FS as any).__set('/doc/ev_all_s1.json', JSON.stringify([janEvent]))
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('db error') }))
    expect(await getEventsForMonth('s1', 2025, 0)).toEqual([janEvent])
  })

  it('retourne [] si Supabase échoue et le cache est vide', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('db error') }))
    expect(await getEventsForMonth('s1', 2025, 0)).toEqual([])
  })
})

// ─── getEvent ─────────────────────────────────────────────────────────────────

describe('getEvent', () => {
  it('retourne l\'événement trouvé', async () => {
    mockFrom.mockReturnValue(chain({ data: EVENT, error: null }))
    expect(await getEvent('e1')).toEqual(EVENT)
  })

  it('retourne null si l\'événement n\'existe pas et le cache est vide', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('not found') }))
    expect(await getEvent('e1')).toBeNull()
  })

  it('tombe en fallback cache si Supabase échoue', async () => {
    ;(FS as any).__set('/doc/ev_detail_e1.json', JSON.stringify(EVENT))
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    expect(await getEvent('e1')).toEqual(EVENT)
  })
})

// ─── createEvent ─────────────────────────────────────────────────────────────

describe('createEvent', () => {
  const payload = {
    title: 'Réunion',
    date: '2026-06-10',
    start_time: '10:00',
    end_time: '11:00',
    created_by: 'u1',
    space_id: 's1',
  }

  it('crée et retourne l\'événement', async () => {
    mockFrom.mockReturnValue(chain({ data: EVENT, error: null }))
    expect(await createEvent(payload)).toEqual(EVENT)
  })

  it('crée localement et met en file si le réseau échoue', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('insert error') }))
    const result = await createEvent(payload)
    expect(result.id).toMatch(/^local-/)
    expect(result.title).toBe('Réunion')
  })
})

// ─── updateEvent ─────────────────────────────────────────────────────────────

describe('updateEvent', () => {
  const payload = { title: 'Modifié', date: '2026-06-10', start_time: '10:00', end_time: '11:00' }

  it('met à jour et retourne l\'événement', async () => {
    const updated = { ...EVENT, title: 'Modifié' }
    mockFrom.mockReturnValue(chain({ data: updated, error: null }))
    expect(await updateEvent('e1', payload)).toEqual(updated)
  })

  it('lève une erreur si rien n\'est connu localement pour retomber dessus', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('update error') }))
    await expect(updateEvent('e1', payload)).rejects.toThrow('update error')
  })

  it('met à jour localement et met en file si le réseau échoue mais qu\'un cache existe', async () => {
    ;(FS as any).__set('/doc/ev_detail_e1.json', JSON.stringify(EVENT))
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('update error') }))
    const result = await updateEvent('e1', payload)
    expect(result.title).toBe('Modifié')
  })
})

// ─── deleteEvent ─────────────────────────────────────────────────────────────

describe('deleteEvent', () => {
  it('supprime sans toucher au storage si aucune pièce jointe', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    await deleteEvent('e1')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('supprime les fichiers storage avant la suppression DB', async () => {
    const mockRemove = jest.fn().mockResolvedValue({})
    mockStorageFrom.mockReturnValue({ remove: mockRemove })
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ storage_path: 'path/file.pdf' }], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    await deleteEvent('e1')
    expect(mockRemove).toHaveBeenCalledWith(['path/file.pdf'])
  })

  it('continue même si la suppression storage échoue', async () => {
    mockStorageFrom.mockReturnValue({ remove: jest.fn().mockRejectedValue(new Error('storage error')) })
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ storage_path: 'path/file.pdf' }], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    await expect(deleteEvent('e1')).resolves.toBeUndefined()
  })

  it('met en file la suppression si le réseau échoue', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: new Error('delete error') }))
    await expect(deleteEvent('e1')).resolves.toBeUndefined()
  })

  it('supprime le cache local de l\'événement', async () => {
    ;(FS as any).__set('/doc/ev_detail_e1.json', JSON.stringify(EVENT))
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    await deleteEvent('e1')
    expect(await getEvent('e1')).toBeNull()
  })

  it('annule la création en attente si on supprime un événement encore local', async () => {
    const payload = { title: 'X', date: '2099-01-01', start_time: '10:00', end_time: '11:00', created_by: 'u1', space_id: 's1' }
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    const created = await createEvent(payload)
    await deleteEvent(created.id)
    expect(await getEvent(created.id)).toBeNull()

    const insertChain = chain({ data: null, error: null })
    mockFrom.mockReturnValue(insertChain)
    await syncPendingChanges()
    expect(insertChain.insert).not.toHaveBeenCalled()
  })
})

// ─── syncPendingChanges ───────────────────────────────────────────────────────

describe('syncPendingChanges', () => {
  const payload = { title: 'X', date: '2099-01-01', start_time: '10:00', end_time: '11:00', created_by: 'u1', space_id: 's1' }

  it('remplace le cache local par l\'événement réel après synchro d\'une création', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('network') }))
    const created = await createEvent(payload)

    const real = { ...EVENT, id: 'real-1', title: 'X' }
    mockFrom.mockReturnValue(chain({ data: real, error: null }))
    await syncPendingChanges()

    expect(await getEvent(created.id)).toBeNull()
    expect(await getEvent('real-1')).toEqual(real)
  })

  it('ne fait rien si la file est vide', async () => {
    await expect(syncPendingChanges()).resolves.toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ─── exportEventsToSpace ──────────────────────────────────────────────────────

describe('exportEventsToSpace', () => {
  it('retourne 0 si aucun événement à exporter', async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }))
    expect(await exportEventsToSpace('s1', 's2', 'u1', false)).toBe(0)
  })

  it('retourne le nombre d\'événements exportés', async () => {
    const evtData = [{ title: 'Test', date: '2026-06-10', start_time: '10:00', end_time: '11:00', location: null, description: null, assigned_to: null, created_by: 'u1' }]
    mockFrom
      .mockReturnValueOnce(chain({ data: evtData, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
    expect(await exportEventsToSpace('s1', 's2', 'u1', false)).toBe(1)
  })

  it('filtre par created_by si onlyMine=true', async () => {
    const c = chain({ data: [], error: null })
    mockFrom.mockReturnValue(c)
    await exportEventsToSpace('s1', 's2', 'u1', true)
    expect(c.eq).toHaveBeenCalledWith('created_by', 'u1')
  })

  it('ne filtre pas par created_by si onlyMine=false', async () => {
    const c = chain({ data: [], error: null })
    mockFrom.mockReturnValue(c)
    await exportEventsToSpace('s1', 's2', 'u1', false)
    const eqCalls = c.eq.mock.calls as string[][]
    expect(eqCalls.some(args => args[0] === 'created_by')).toBe(false)
  })

  it('lève une erreur si la lecture des événements échoue', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('export error') }))
    await expect(exportEventsToSpace('s1', 's2', 'u1', false)).rejects.toThrow('export error')
  })

  it('lève une erreur si l\'insert échoue', async () => {
    const evtData = [{ title: 'Test', date: '2026-06-10', start_time: '10:00', end_time: '11:00', location: null, description: null, assigned_to: null, created_by: 'u1' }]
    mockFrom
      .mockReturnValueOnce(chain({ data: evtData, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: new Error('insert error') }))
    await expect(exportEventsToSpace('s1', 's2', 'u1', false)).rejects.toThrow('insert error')
  })
})
