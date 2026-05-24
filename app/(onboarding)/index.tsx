import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { BlurView } from 'expo-blur'
import MeshBackground from '@/components/MeshBackground'

export default function OnboardingScreen() {
  const router = useRouter()

  return (
    <View style={styles.root}>
      <MeshBackground />
      <View style={styles.content}>
        <Text style={styles.title}>Kairos</Text>
        <Text style={styles.subtitle}>Votre espace partagé</Text>

        <Text style={styles.intro}>Créez votre espace ou rejoignez celui de votre partenaire.</Text>

        <BlurView intensity={50} tint="light" style={styles.card}>
          <Pressable style={styles.row} onPress={() => router.push('/(onboarding)/create')}>
            <Text style={styles.rowText}>Créer notre espace</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={() => router.push('/(onboarding)/join')}>
            <Text style={styles.rowText}>Rejoindre avec un code</Text>
          </Pressable>
        </BlurView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a0e30' },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: {
    fontSize: 44,
    fontWeight: '300',
    marginBottom: 6,
    textAlign: 'center',
    color: '#1e1a36',
    letterSpacing: 7,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(50,35,80,0.65)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 44,
  },
  intro: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(50,35,80,0.70)',
    lineHeight: 22,
    marginBottom: 28,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.60)',
  },
  row: {
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.60)',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  rowText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
})
