import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useAuth } from '@/context/auth'

export default function DashboardScreen() {
  const { user, signOut } = useAuth()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kairos</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Se déconnecter</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 8 },
  email: { fontSize: 15, color: '#666', marginBottom: 32 },
  button: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, padding: 12, paddingHorizontal: 24 },
  buttonText: { fontSize: 15, color: '#111' },
})
