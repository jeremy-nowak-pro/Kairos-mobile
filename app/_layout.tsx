import { Slot } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider } from '@react-navigation/native'
import { AuthProvider } from '@/context/auth'
import { SpaceProvider } from '@/context/space'
import MeshBackground from '@/components/MeshBackground'

const AppTheme = {
  dark: true,
  colors: {
    primary: 'rgb(10, 132, 255)',
    background: 'transparent',
    card: 'rgba(7,8,24,0.95)',
    text: '#dce8ff',
    border: 'rgba(140,170,255,0.18)',
    notification: '#e05555',
  },
  fonts: {},
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#070818' }}>
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
