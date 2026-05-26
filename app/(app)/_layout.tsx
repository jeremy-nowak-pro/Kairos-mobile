import { useEffect } from 'react'
import { Redirect, Tabs } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import * as SecureStore from 'expo-secure-store'
import { registerPushToken } from '@/lib/notifications'
import ChatPanel from '@/components/ChatPanel'

const PUSH_CONSENT_KEY = 'push_consent_asked'

function TabBarBackground() {
  return (
    <BlurView
      intensity={50}
      tint="dark"
      style={[
        StyleSheet.absoluteFill,
        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' },
      ]}
    />
  )
}

export default function AppLayout() {
  const { session, loading, user } = useAuth()
  const { space } = useSpace()

  useEffect(() => {
    if (!user || !space) return
    SecureStore.getItemAsync(PUSH_CONSENT_KEY).then(value => {
      if (value === 'granted') {
        registerPushToken(space.id, user.id).catch(() => {})
      } else if (value === null) {
        Alert.alert(
          'Notifications',
          "Kairos peut t'avertir quand un membre de ton espace envoie un message. Aucun contenu n'est transmis.",
          [
            {
              text: 'Pas maintenant',
              style: 'cancel',
              onPress: () => SecureStore.setItemAsync(PUSH_CONSENT_KEY, 'denied'),
            },
            {
              text: 'Activer',
              onPress: () => {
                SecureStore.setItemAsync(PUSH_CONSENT_KEY, 'granted')
                registerPushToken(space.id, user.id).catch(() => {})
              },
            },
          ],
        )
      }
    })
  }, [user?.id, space?.id])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!session) return <Redirect href="/(auth)/login" />

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.50)',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: 'Événements',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendrier',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
    <ChatPanel />
    </View>
  )
}
