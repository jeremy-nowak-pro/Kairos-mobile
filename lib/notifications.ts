import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { supabase } from './supabase'

// expo-notifications requires a native dev build — import is guarded
// to avoid crashes when the native module is not yet compiled
let Notifications: typeof import('expo-notifications') | null = null
try {
  Notifications = require('expo-notifications')
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
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

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string
  const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId })

  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, space_id: spaceId, token: tokenData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,space_id' },
    )
}

async function pushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!tokens.length) return
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(
      tokens.map(token => ({ to: token, sound: 'default', title, body, data }))
    ),
  })
}

async function getOtherTokens(spaceId: string, senderUserId: string): Promise<string[]> {
  const { data } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('space_id', spaceId)
    .neq('user_id', senderUserId)
  return (data ?? []).map((r: { token: string }) => r.token)
}

export async function sendSpaceNotification(
  spaceId: string,
  senderUserId: string,
  senderName: string,
  message: string,
): Promise<void> {
  const tokens = await getOtherTokens(spaceId, senderUserId)
  await pushToTokens(tokens, senderName, 'Nouveau message', { spaceId })
}

export function isNotificationsSupported(): boolean {
  return Notifications !== null
}

export async function sendTestNotification(
  spaceId: string,
  userId: string,
  displayName: string,
): Promise<void> {
  if (!Notifications) {
    throw new Error('Les notifications nécessitent un build natif (pas Expo Go). Lance "eas build --profile development".')
  }

  // Enregistre / rafraîchit le token avant d'envoyer
  await registerPushToken(spaceId, userId)

  const { data } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .single()

  if (!data?.token) {
    throw new Error('Permission refusée — autorise les notifications dans les réglages de ton appareil.')
  }

  await pushToTokens(
    [data.token],
    displayName,
    'Nouvel événement : Dîner en famille 🍽️',
    { spaceId, type: 'event_test' },
  )
}

export async function sendEventNotification(
  spaceId: string,
  senderUserId: string,
  senderName: string,
  eventTitle: string,
  type: 'created' | 'updated',
): Promise<void> {
  const tokens = await getOtherTokens(spaceId, senderUserId)
  const body = type === 'created'
    ? `Nouvel événement : ${eventTitle}`
    : `Événement modifié : ${eventTitle}`
  await pushToTokens(tokens, senderName, body, { spaceId, type: 'event' })
}
