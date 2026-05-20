import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Share } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { createSpace } from '@/lib/spaces'

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
      <View style={styles.container}>
        <Text style={styles.title}>Espace créé !</Text>
        <Text style={styles.subtitle}>Partage ce code à ton partenaire pour qu'il vous rejoigne.</Text>

        <View style={styles.codeBox}>
          <Text style={styles.code}>{inviteCode}</Text>
        </View>

        <Pressable style={styles.buttonSecondary} onPress={handleShare}>
          <Text style={styles.buttonSecondaryText}>Partager le code</Text>
        </Pressable>

        <Pressable style={styles.buttonPrimary} onPress={handleContinue}>
          <Text style={styles.buttonPrimaryText}>Continuer seul pour l'instant</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer notre espace</Text>
      <Text style={styles.subtitle}>Un espace sera créé. Vous pourrez ensuite inviter votre partenaire.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.buttonPrimary} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>Créer l'espace</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Retour</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 48, lineHeight: 22 },
  codeBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 24 },
  code: { fontSize: 32, fontWeight: '700', letterSpacing: 6 },
  buttonPrimary: { backgroundColor: '#111', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonSecondary: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonSecondaryText: { color: '#111', fontSize: 16 },
  error: { color: '#dc2626', marginBottom: 12, fontSize: 14 },
  link: { textAlign: 'center', color: '#666', marginTop: 16 },
})
