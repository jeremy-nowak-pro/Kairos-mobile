import { supabase } from './supabase'
import * as Crypto from 'expo-crypto'
import { deleteLocalMedia } from './mediaCache'

export interface Attachment {
  id: string
  event_id: string
  space_id: string
  storage_path: string
  filename: string
  mime_type: string | null
  file_size: number | null
  created_by: string
  created_at: string
}

export interface LocalFile {
  uri: string
  name: string
  mimeType: string | null
  size: number | null
}

// Comportement standard, pour tout le monde : une pièce jointe d'événement
// (billet, document à montrer pour une date donnée) n'a plus grand intérêt
// passé une semaine — l'original est censé rester ailleurs (email, portefeuille...).
const ATTACHMENT_EXPIRY_DAYS = 7

function isAttachmentExpired(createdAt: string): boolean {
  const cutoff = new Date(createdAt)
  cutoff.setDate(cutoff.getDate() + ATTACHMENT_EXPIRY_DAYS)
  return new Date() > cutoff
}

export async function getAttachments(eventId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('event_attachments')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const attachments = (data ?? []) as Attachment[]
  const expired = attachments.filter(a => isAttachmentExpired(a.created_at))
  if (expired.length === 0) return attachments

  await Promise.all(expired.map(a => deleteAttachment(a.id, a.storage_path).catch(() => {})))
  const expiredIds = new Set(expired.map(a => a.id))
  return attachments.filter(a => !expiredIds.has(a.id))
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export async function uploadAttachment(
  file: LocalFile,
  eventId: string,
  spaceId: string,
  createdBy: string,
): Promise<Attachment> {
  const mime = file.mimeType ?? 'application/octet-stream'
  if (!ALLOWED_MIME.includes(mime)) throw new Error('Type de fichier non autorisé')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${spaceId}/${eventId}/${Crypto.randomUUID()}.${ext}`

  const res = await fetch(file.uri)
  const buffer = await res.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from('event-attachments')
    .upload(storagePath, buffer, {
      contentType: mime,
    })
  if (storageErr) throw storageErr

  const { data, error } = await supabase
    .from('event_attachments')
    .insert({
      event_id: eventId,
      space_id: spaceId,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.mimeType,
      file_size: file.size,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  return data as Attachment
}

export async function deleteAttachment(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from('event-attachments').remove([storagePath])
  deleteLocalMedia('ev_photo', storagePath)
  const { error } = await supabase.from('event_attachments').delete().eq('id', id)
  if (error) throw error
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('event-attachments')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}
