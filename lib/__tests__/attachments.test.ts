import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
  getSignedUrl,
} from '../attachments'
import { supabase } from '../supabase'
import * as FS from 'expo-file-system'

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid'),
}))

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
  }
})

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
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    c[m] = jest.fn().mockReturnValue(c)
  }
  c.single = jest.fn().mockResolvedValue(result)
  c.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return c
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const ATTACHMENT = {
  id: 'a1', event_id: 'e1', space_id: 's1', storage_path: 'e1/doc.pdf',
  filename: 'billet.pdf', mime_type: 'application/pdf', file_size: 1000,
  created_by: 'u1', created_at: '',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(FS as any).__reset()
})

// ─── getAttachments ─────────────────────────────────────────────────────────

describe('getAttachments', () => {
  it('retourne les pièces jointes', async () => {
    const recent = { ...ATTACHMENT, created_at: daysAgo(1) }
    mockFrom.mockReturnValue(chain({ data: [recent], error: null }))
    expect(await getAttachments('e1')).toEqual([recent])
  })

  it('lève une erreur en cas d\'échec', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('db error') }))
    await expect(getAttachments('e1')).rejects.toThrow('db error')
  })

  it('supprime automatiquement une pièce jointe vieille de plus de 7 jours', async () => {
    const old = { ...ATTACHMENT, created_at: daysAgo(10) }
    const removeMock = jest.fn().mockResolvedValue({})
    mockStorageFrom.mockReturnValue({ remove: removeMock })
    mockFrom
      .mockReturnValueOnce(chain({ data: [old], error: null })) // select event_attachments
      .mockReturnValueOnce(chain({ data: null, error: null })) // delete (dans deleteAttachment)

    const result = await getAttachments('e1')
    expect(result).toEqual([])
    expect(removeMock).toHaveBeenCalledWith(['e1/doc.pdf'])
  })

  it('garde une pièce jointe récente', async () => {
    const recent = { ...ATTACHMENT, created_at: daysAgo(2) }
    mockFrom.mockReturnValue(chain({ data: [recent], error: null }))
    expect(await getAttachments('e1')).toEqual([recent])
  })
})

// ─── uploadAttachment ───────────────────────────────────────────────────────

describe('uploadAttachment', () => {
  const file = { uri: 'file:///doc.pdf', name: 'billet.pdf', mimeType: 'application/pdf', size: 1000 }

  it('rejette un type MIME non autorisé', async () => {
    await expect(uploadAttachment({ ...file, mimeType: 'application/zip' }, 'e1', 's1', 'u1'))
      .rejects.toThrow('Type de fichier non autorisé')
  })

  it('uploade et retourne la pièce jointe', async () => {
    mockStorageFrom.mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: null }) })
    mockFrom.mockReturnValue(chain({ data: ATTACHMENT, error: null }))
    ;(global as any).fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
    const result = await uploadAttachment(file, 'e1', 's1', 'u1')
    expect(result).toEqual(ATTACHMENT)
  })
})

// ─── deleteAttachment ───────────────────────────────────────────────────────

describe('deleteAttachment', () => {
  it('supprime le fichier storage et la ligne DB', async () => {
    const removeMock = jest.fn().mockResolvedValue({})
    mockStorageFrom.mockReturnValue({ remove: removeMock })
    mockFrom.mockReturnValue(chain({ data: null, error: null }))
    await deleteAttachment('a1', 'e1/doc.pdf')
    expect(removeMock).toHaveBeenCalledWith(['e1/doc.pdf'])
  })

  it('lève une erreur si la suppression DB échoue', async () => {
    mockStorageFrom.mockReturnValue({ remove: jest.fn().mockResolvedValue({}) })
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('delete error') }))
    await expect(deleteAttachment('a1', 'e1/doc.pdf')).rejects.toThrow('delete error')
  })
})

// ─── getSignedUrl ───────────────────────────────────────────────────────────

describe('getSignedUrl', () => {
  it('retourne l\'URL signée', async () => {
    mockStorageFrom.mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://cdn.example.com/f.pdf' }, error: null }),
    })
    expect(await getSignedUrl('e1/doc.pdf')).toBe('https://cdn.example.com/f.pdf')
  })

  it('lève une erreur si Supabase échoue', async () => {
    mockStorageFrom.mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: new Error('storage error') }),
    })
    await expect(getSignedUrl('e1/doc.pdf')).rejects.toThrow('storage error')
  })
})
