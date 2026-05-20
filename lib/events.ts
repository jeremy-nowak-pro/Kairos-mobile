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
