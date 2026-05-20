import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSpace } from '@/context/space'
import { joinSpaceByCode } from '@/lib/spaces'

export default function JoinSpaceScreen() {
  const { code: deepLinkCode } = useLocalSearchParams<{ code?: string }>()
  const { refresh } = useSpace()
  const router = useRouter()
  const [code, setCode] = useState(deepLinkCode ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si le deep link contient déjà un code valide, rejoindre automatiquement
  useEffect(() => {
    if (deepLinkCode?.length === 8) handleJoin(deepLinkCode)
  }, [deepLinkCode])

  const handleJoin = async (codeToUse = code) => {
    if (!codeToUse.trim()) return
    setError(null)
    setLoading(true)
    try {
      await joinSpaceByCode(codeToUse.trim())
      await refresh()
      router.replace('/(app)/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue')
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rejoindre un espace</Text>
      <Text style={styles.subtitle}>Entre le code partagé par ton partenaire.</Text>

      <TextInput
        style={styles.input}
        placeholder="Code à 8 caractères"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={8}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.buttonPrimary} onPress={() => handleJoin()} disabled={loading || code.length < 8}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>Rejoindre</Text>}
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
  input: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, padding: 14, fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: 6, marginBottom: 12 },
  buttonPrimary: { backgroundColor: '#111', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 12, fontSize: 14 },
  link: { textAlign: 'center', color: '#666', marginTop: 16 },
})
