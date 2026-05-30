import { supabase } from './supabase'

export interface Event {
  id: string
  title: string
  date: string
  start_time: string
  end_time: string
  location: string | null
  description: string | null
  assigned_to: string | null
  created_by: string
  space_id: string | null
  created_at: string | null
}

export async function getUpcomingEvents(spaceId: string): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('space_id', spaceId)
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data ?? []) as Event[]
}

export async function getEventsForMonth(spaceId: string, year: number, month: number): Promise<Event[]> {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('space_id', spaceId)
    .gte('date', from)
    .lte('date', to)
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data ?? []) as Event[]
}

export async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Event
}

export async function updateEvent(id: string, payload: {
  title: string
  date: string
  start_time: string
  end_time: string
  location?: string | null
  description?: string | null
  assigned_to?: string | null
}): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Event
}

export async function deleteEvent(id: string): Promise<void> {
  // Cleanup storage files before cascade deletes the DB rows
  const { data: attachments } = await supabase
    .from('event_attachments')
    .select('storage_path')
    .eq('event_id', id)

  if (attachments?.length) {
    const paths = attachments.map((a: { storage_path: string }) => a.storage_path)
    await supabase.storage.from('event-attachments').remove(paths).catch(() => {})
  }

  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

export async function exportEventsToSpace(
  fromSpaceId: string,
  toSpaceId: string,
  userId: string,
  onlyMine: boolean
): Promise<number> {
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('events')
    .select('title, date, start_time, end_time, location, description, assigned_to, created_by')
    .eq('space_id', fromSpaceId)
    .gte('date', today)

  if (onlyMine) query = query.eq('created_by', userId)

  const { data, error } = await query
  if (error) throw error
  if (!data?.length) return 0

  const events = data.map((e: Omit<Event, 'id' | 'space_id' | 'created_at'>) => ({ ...e, space_id: toSpaceId }))
  const { error: insertError } = await supabase.from('events').insert(events)
  if (insertError) throw insertError

  return events.length
}

export async function createEvent(payload: {
  title: string
  date: string
  start_time: string
  end_time: string
  location?: string | null
  description?: string | null
  assigned_to?: string | null
  created_by: string
  space_id: string
}): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as Event
}
