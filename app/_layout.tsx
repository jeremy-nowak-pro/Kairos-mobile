import { Slot } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider } from '@/context/auth'
import { SpaceProvider } from '@/context/space'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SpaceProvider>
          <Slot />
        </SpaceProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
