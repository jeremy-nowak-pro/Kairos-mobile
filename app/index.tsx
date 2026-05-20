import { Redirect } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { View, ActivityIndicator } from 'react-native'

export default function Index() {
  const { session, loading: authLoading } = useAuth()
  const { space, loading: spaceLoading } = useSpace()

  if (authLoading || spaceLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!session) return <Redirect href="/(auth)/login" />
  if (!space) return <Redirect href="/(onboarding)" />
  return <Redirect href="/(app)/dashboard" />
}
