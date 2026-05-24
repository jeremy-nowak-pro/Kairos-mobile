import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Share } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { createSpace } from '@/lib/spaces'
import { BlurView } from 'expo-blur'
import MeshBackground from '@/components/MeshBackground'

export default function CreateSpaceScreen() {
  const { user } = useAuth()
  const { refresh } = useSpace()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const spaceName = user?.email?.split('@')[0] ?? 'Notre espace'

  const handleCreate = async () => {
    setError(null)
    setLoading(true)
    try {
      const space = await createSpace(spaceName)
      setInviteCode(space.invite_code)
    } catch {
      setError('Une erreur est survenue')
    }
    setLoading(false)
  }

  const handleShare = async () => {
    if (!inviteCode) return
    await Share.share({
      message: `Rejoins mon espace Kairos avec ce code : ${inviteCode}\n\nou via ce lien : kairos-mobile://join?code=${inviteCode}`,
    })
  }

  const handleContinue = async () => {
    await refresh()
    router.replace('/(app)/dashboard')
  }

  if (inviteCode) {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <View style={styles.content}>
          <Text style={styles.title}>Espace créé !</Text>
          <Text style={styles.subtitle}>Partage ce code à ton partenaire pour qu'il vous rejoigne.</Text>

          <BlurView intensity={50} tint="light" style={styles.codeCard}>
            <Text style={styles.code}>{inviteCode}</Text>
          </BlurView>

          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleShare}>
            <Text style={styles.buttonSecondaryText}>Partager le code</Text>
          </Pressable>

          <Pressable style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continuer seul pour l'instant</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <MeshBackground />
      <View style={styles.content}>
        <Text style={styles.title}>Créer notre espace</Text>
        <Text style={styles.subtitle}>Un espace sera créé. Vous pourrez ensuite inviter votre partenaire.</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleCreate} disabled={loading}>
          {loading ? <ActivityIndicator color="rgba(180,210,255,0.9)" /> : <Text style={styles.buttonText}>Créer l'espace</Text>}
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
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
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 10,
    textAlign: 'center',
    color: '#1e1a36',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(50,35,80,0.55)',
    lineHeight: 22,
    marginBottom: 44,
  },
  codeCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  code: {
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: 8,
    color: '#1e1a36',
  },
  button: {
    backgroundColor: 'rgba(110,55,180,0.70)',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  buttonText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.38)',
  },
  buttonSecondaryText: { color: 'rgba(110,55,180,0.75)', fontSize: 15, letterSpacing: 0.5 },
  error: { color: '#e05555', marginBottom: 14, fontSize: 13, textAlign: 'center' },
  link: { marginTop: 8, textAlign: 'center', color: 'rgba(70,50,100,0.50)', fontSize: 13 },
})
