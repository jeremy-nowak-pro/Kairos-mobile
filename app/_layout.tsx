import { Slot } from 'expo-router'
import { AuthProvider } from '@/context/auth'
import { SpaceProvider } from '@/context/space'

export default function RootLayout() {
  return (
    <AuthProvider>
      <SpaceProvider>
        <Slot />
      </SpaceProvider>
    </AuthProvider>
  )
}
