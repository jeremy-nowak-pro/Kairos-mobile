import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { sendSpaceNotification } from './notifications'

export interface Message {
  id: string
  space_id: string
  user_id: string
  sender_name: string
  content: string
  created_at: string
}

export async function getMessages(spaceId: string, limit = 60): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Message[]
}

export async function sendMessage(
  spaceId: string,
  userId: string,
  senderName: string,
  content: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ space_id: spaceId, user_id: userId, sender_name: senderName, content })
    .select()
    .single()
  if (error) throw error
  sendSpaceNotification(spaceId, userId, senderName, content).catch(() => {})
  return data as Message
}

export function subscribeToMessages(
  spaceId: string,
  onMessage: (message: Message) => void,
): RealtimeChannel {
  return supabase
    .channel(`messages:${spaceId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `space_id=eq.${spaceId}`,
    }, payload => onMessage(payload.new as Message))
    .subscribe()
}

export async function markRead(spaceId: string, userId: string): Promise<void> {
  await supabase
    .from('chat_reads')
    .upsert(
      { user_id: userId, space_id: spaceId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,space_id' },
    )
}

export async function getUnreadCount(spaceId: string, userId: string): Promise<number> {
  const { data } = await supabase
    .from('chat_reads')
    .select('last_read_at')
    .eq('user_id', userId)
    .eq('space_id', spaceId)
    .maybeSingle()

  const lastRead = data?.last_read_at ?? '1970-01-01'

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .neq('user_id', userId)
    .gt('created_at', lastRead)

  return count ?? 0
}
