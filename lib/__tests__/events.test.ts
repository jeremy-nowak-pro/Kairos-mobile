import {
  getUpcomingEvents,
  getEventsForMonth,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  exportEventsToSpace,
} from '../events'
import { supabase } from '../supabase'

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
  date: '2026-06-10',
  start_time: '10:00',
  end_time: '11:00',
  location: null,
  description: null,
  assigned_to: null,
  created_by: 'u1',
  space_id: 's1',
  created_at: '2026-06-01',
}

beforeEach(() => jest.clearAllMocks())

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

  it('lève une erreur en cas d\'échec', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('db error') }))
    await expect(getUpcomingEvents('s1')).rejects.toThrow('db error')
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

  it('lève une erreur en cas d\'échec', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('db error') }))
    await expect(getEventsForMonth('s1', 2025, 0)).rejects.toThrow('db error')
  })
})

// ─── getEvent ─────────────────────────────────────────────────────────────────

describe('getEvent', () => {
  it('retourne l\'événement trouvé', async () => {
    mockFrom.mockReturnValue(chain({ data: EVENT, error: null }))
    expect(await getEvent('e1')).toEqual(EVENT)
  })

  it('retourne null si l\'événement n\'existe pas', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('not found') }))
    expect(await getEvent('e1')).toBeNull()
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

  it('lève une erreur en cas d\'échec', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('insert error') }))
    await expect(createEvent(payload)).rejects.toThrow('insert error')
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

  it('lève une erreur en cas d\'échec', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('update error') }))
    await expect(updateEvent('e1', payload)).rejects.toThrow('update error')
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

  it('lève une erreur si la suppression DB échoue', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: new Error('delete error') }))
    await expect(deleteEvent('e1')).rejects.toThrow('delete error')
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
