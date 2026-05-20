import { supabase } from './supabase'
import { LocalFile } from './attachments'

export interface MemberSchedule {
  id: string
  space_id: string
  user_id: string
  storage_path: string
  filename: string
  mime_type: string | null
  updated_at: string
}

export async function getSpaceSchedules(spaceId: string): Promise<MemberSchedule[]> {
  const { data, error } = await supabase
    .from('member_schedules')
    .select('*')
    .eq('space_id', spaceId)
  if (error) throw error
  return (data ?? []) as MemberSchedule[]
}

export async function uploadSchedule(
  spaceId: string,
  userId: string,
  file: LocalFile,
): Promise<MemberSchedule> {
  // Delete existing storage file if any
  const { data: existing } = await supabase
    .from('member_schedules')
    .select('storage_path')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.storage_path) {
    await supabase.storage.from('schedules').remove([existing.storage_path])
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${spaceId}/${userId}/${Date.now()}.${ext}`

  const res = await fetch(file.uri)
  const buffer = await res.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from('schedules')
    .upload(storagePath, buffer, {
      contentType: file.mimeType ?? 'application/octet-stream',
      upsert: true,
    })
  if (storageErr) throw storageErr

  const { data, error } = await supabase
    .from('member_schedules')
    .upsert(
      {
        space_id: spaceId,
        user_id: userId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.mimeType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'space_id,user_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as MemberSchedule
}

export async function deleteSchedule(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from('schedules').remove([storagePath])
  const { error } = await supabase.from('member_schedules').delete().eq('id', id)
  if (error) throw error
}

export async function getScheduleSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('schedules')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}
