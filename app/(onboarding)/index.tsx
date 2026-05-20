import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export default function OnboardingScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue sur Kairos</Text>
      <Text style={styles.subtitle}>Créez votre espace ou rejoignez celui de votre partenaire.</Text>

      <Pressable style={styles.buttonPrimary} onPress={() => router.push('/(onboarding)/create')}>
        <Text style={styles.buttonPrimaryText}>Créer notre espace</Text>
      </Pressable>

      <Pressable style={styles.buttonSecondary} onPress={() => router.push('/(onboarding)/join')}>
        <Text style={styles.buttonSecondaryText}>Rejoindre avec un code</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 48, lineHeight: 22 },
  buttonPrimary: { backgroundColor: '#111', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonSecondary: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonSecondaryText: { color: '#111', fontSize: 16 },
})
