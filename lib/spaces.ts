import { supabase } from './supabase'

export interface Space {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export async function getMySpace(): Promise<Space | null> {
  const { data } = await supabase
    .from('space_members')
    .select('spaces(*)')
    .limit(1)
    .single()

  return (data?.spaces as unknown as Space) ?? null
}

export async function createSpace(name: string): Promise<Space> {
  const { data, error } = await supabase.rpc('create_space', { space_name: name })
  if (error) throw error

  const { data: space, error: fetchError } = await supabase
    .from('spaces')
    .select('*')
    .eq('id', data)
    .single()

  if (fetchError) throw fetchError
  return space as Space
}

export interface SpaceMember {
  user_id: string
  display_name: string
  is_creator: boolean
}

export async function getSpaceMembers(): Promise<SpaceMember[]> {
  const { data, error } = await supabase.rpc('get_space_members')
  if (error) throw error
  return (data ?? []) as SpaceMember[]
}

export async function joinSpaceByCode(code: string): Promise<void> {
  const { error } = await supabase.rpc('join_space_by_code', { code: code.toUpperCase() })
  if (error) throw new Error('Code invalide ou déjà utilisé')
}
