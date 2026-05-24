import { Slot } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider } from '@react-navigation/native'
import { AuthProvider } from '@/context/auth'
import { SpaceProvider } from '@/context/space'
import MeshBackground from '@/components/MeshBackground'

const AppTheme = {
  dark: false,
  colors: {
    primary: '#7040a8',
    background: 'transparent',
    card: 'rgba(255,255,255,0.82)',
    text: '#1e1a36',
    border: 'rgba(255,255,255,0.45)',
    notification: '#e05555',
  },
  fonts: {},
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#1a0e30' }}>
      <MeshBackground />
      <ThemeProvider value={AppTheme as any}>
        <AuthProvider>
          <SpaceProvider>
            <Slot />
          </SpaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
