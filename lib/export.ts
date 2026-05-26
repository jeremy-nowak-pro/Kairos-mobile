import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { supabase } from './supabase'

export async function exportMyData(userId: string, spaceId: string): Promise<void> {
  const [profile, events, messages, shoppingItems] = await Promise.all([
    supabase.auth.getUser().then(({ data }) => ({
      email: data.user?.email,
      display_name: data.user?.user_metadata?.display_name,
      created_at: data.user?.created_at,
    })),

    supabase
      .from('events')
      .select('title, description, start_date, end_date, location, created_at')
      .eq('space_id', spaceId)
      .eq('created_by', userId)
      .then(({ data }) => data ?? []),

    supabase
      .from('chat_messages')
      .select('content, created_at')
      .eq('space_id', spaceId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data }) => data ?? []),

    supabase
      .from('shopping_items')
      .select('name, checked, created_at')
      .in(
        'list_id',
        await supabase
          .from('shopping_lists')
          .select('id')
          .eq('space_id', spaceId)
          .then(({ data }) => (data ?? []).map((l: { id: string }) => l.id)),
      )
      .then(({ data }) => data ?? []),
  ])

  const payload = {
    export_date: new Date().toISOString(),
    profile,
    events,
    messages,
    shopping_items: shoppingItems,
  }

  const date = new Date().toISOString().split('T')[0]
  const file = new File(Paths.cache, `kairos-export-${date}.json`)
  await file.write(JSON.stringify(payload, null, 2))

  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) throw new Error('Le partage de fichiers n\'est pas disponible sur cet appareil.')

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Exporter mes données Kairos',
  })
}
