import { useEffect } from 'react'
import { Redirect, Tabs } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { registerPushToken } from '@/lib/notifications'
import ChatPanel from '@/components/ChatPanel'

export default function AppLayout() {
  const { session, loading, user } = useAuth()
  const { space } = useSpace()

  useEffect(() => {
    if (user && space) registerPushToken(space.id, user.id).catch(() => {})
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
          backgroundColor: 'rgba(255,255,255,0.88)',
          borderTopColor: 'rgba(0,0,0,0.08)',
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarActiveTintColor: '#7040a8',
        tabBarInactiveTintColor: 'rgba(70,50,100,0.50)',
        tabBarLabelStyle: { fontSize: 12 },
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
