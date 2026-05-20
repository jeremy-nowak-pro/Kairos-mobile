import { supabase } from './supabase'

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

export async function getAttachments(eventId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('event_attachments')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Attachment[]
}

export async function uploadAttachment(
  file: LocalFile,
  eventId: string,
  spaceId: string,
  createdBy: string,
): Promise<Attachment> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${spaceId}/${eventId}/${Date.now()}.${ext}`

  const res = await fetch(file.uri)
  const buffer = await res.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from('event-attachments')
    .upload(storagePath, buffer, {
      contentType: file.mimeType ?? 'application/octet-stream',
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
