import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/context/auth'
import { ActivityIndicator, View } from 'react-native'

export default function AppLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>
  }

  if (!session) return <Redirect href="/(auth)/login" />

  return <Stack screenOptions={{ headerShown: false }} />
}
