import { Platform } from 'react-native'
import { supabase } from './supabase'

// expo-notifications requires a native dev build — import is guarded
// to avoid crashes when the native module is not yet compiled
let Notifications: typeof import('expo-notifications') | null = null
try {
  Notifications = require('expo-notifications')
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
} catch {
  // Native module not available — rebuild dev client to enable push notifications
}

export async function registerPushToken(spaceId: string, userId: string): Promise<void> {
  if (!Notifications) return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const { data: tokenData } = await Notifications.getExpoPushTokenAsync()

  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, space_id: spaceId, token: tokenData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,space_id' },
    )
}

export async function sendSpaceNotification(
  spaceId: string,
  senderUserId: string,
  senderName: string,
  message: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('space_id', spaceId)
    .neq('user_id', senderUserId)

  if (!rows?.length) return

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(
      rows.map(({ token }: { token: string }) => ({
        to: token,
        sound: 'default',
        title: senderName,
        body: message,
        data: { spaceId },
      })),
    ),
  })
}
