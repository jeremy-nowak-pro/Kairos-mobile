import { getMySpace, createSpace, joinSpaceByCode } from '../spaces'

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))

import { supabase } from '../supabase'

const mockRpc = supabase.rpc as jest.Mock
const mockFrom = supabase.from as jest.Mock

function chainFrom(result: unknown) {
  const single = jest.fn().mockResolvedValue(result)
  const eq = jest.fn(() => ({ single }))
  const limit = jest.fn(() => ({ single }))
  const select = jest.fn(() => ({ limit, eq, single }))
  mockFrom.mockReturnValue({ select })
}

beforeEach(() => jest.clearAllMocks())

// ─── getMySpace ───────────────────────────────────────────────────────────────

describe('getMySpace', () => {
  it('retourne le space quand il existe', async () => {
    const space = { id: '1', name: 'test', invite_code: 'ABCD1234', created_by: 'u1', created_at: '' }
    chainFrom({ data: { spaces: space } })

    const result = await getMySpace()

    expect(result).toEqual(space)
    expect(mockFrom).toHaveBeenCalledWith('space_members')
  })

  it('retourne null quand aucun space', async () => {
    chainFrom({ data: null })

    const result = await getMySpace()

    expect(result).toBeNull()
  })
})

// ─── createSpace ─────────────────────────────────────────────────────────────

describe('createSpace', () => {
  it('crée un space et retourne ses données', async () => {
    const space = { id: 'sid', name: 'Mon espace', invite_code: 'XYZ12345', created_by: 'u1', created_at: '' }
    mockRpc.mockResolvedValueOnce({ data: 'sid', error: null })
    chainFrom({ data: space, error: null })

    const result = await createSpace('Mon espace')

    expect(result).toEqual(space)
    expect(mockRpc).toHaveBeenCalledWith('create_space', { space_name: 'Mon espace' })
  })

  it('lève une erreur si le RPC échoue', async () => {
    const rpcError = new Error('rpc error')
    mockRpc.mockResolvedValueOnce({ data: null, error: rpcError })

    await expect(createSpace('test')).rejects.toThrow('rpc error')
  })

  it('lève une erreur si le fetch du space échoue', async () => {
    const fetchError = new Error('fetch error')
    mockRpc.mockResolvedValueOnce({ data: 'sid', error: null })
    chainFrom({ data: null, error: fetchError })

    await expect(createSpace('test')).rejects.toThrow('fetch error')
  })
})

// ─── joinSpaceByCode ─────────────────────────────────────────────────────────

describe('joinSpaceByCode', () => {
  it('rejoint un space avec le code en majuscules', async () => {
    mockRpc.mockResolvedValueOnce({ error: null })

    await joinSpaceByCode('abcd1234')

    expect(mockRpc).toHaveBeenCalledWith('join_space_by_code', { code: 'ABCD1234' })
  })

  it('lève une erreur si le code est invalide', async () => {
    mockRpc.mockResolvedValueOnce({ error: new Error('not found') })

    await expect(joinSpaceByCode('INVALID1')).rejects.toThrow('Code invalide ou déjà utilisé')
  })
})
