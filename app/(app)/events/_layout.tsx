import { Stack } from 'expo-router'

export default function EventsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ presentation: 'transparentModal', animation: 'slide_from_right', gestureEnabled: false }} />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
