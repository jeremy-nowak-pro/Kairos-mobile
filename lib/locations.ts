import { supabase } from './supabase'

export async function getLocations(): Promise<string[]> {
  const { data } = await supabase
    .from('event_locations')
    .select('location')
    .order('used_count', { ascending: false })
    .limit(20)
  return (data ?? []).map((r: { location: string }) => r.location)
}

export async function upsertLocation(location: string): Promise<void> {
  if (!location.trim()) return
  const { data } = await supabase
    .from('event_locations')
    .select('id, used_count')
    .eq('location', location)
    .maybeSingle()
  if (data) {
    await supabase
      .from('event_locations')
      .update({ used_count: (data as { used_count: number }).used_count + 1, updated_at: new Date().toISOString() })
      .eq('id', (data as { id: string }).id)
  } else {
    await supabase.from('event_locations').insert({ location })
  }
}

export async function deleteLocation(location: string): Promise<void> {
  await supabase.from('event_locations').delete().eq('location', location)
}
