import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSpace } from '@/context/space'
import { joinSpaceByCode } from '@/lib/spaces'
import { BlurView } from 'expo-blur'
import MeshBackground from '@/components/MeshBackground'

export default function JoinSpaceScreen() {
  const { code: deepLinkCode } = useLocalSearchParams<{ code?: string }>()
  const { refresh } = useSpace()
  const router = useRouter()
  const [code, setCode] = useState(deepLinkCode ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = useCallback(async (codeToUse = code) => {
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
  }, [code, refresh, router])

  useEffect(() => {
    if (deepLinkCode?.length === 8) handleJoin(deepLinkCode)
  }, [deepLinkCode, handleJoin])

  return (
    <View style={styles.root}>
      <MeshBackground />
      <View style={styles.content}>
        <Text style={styles.title}>Rejoindre un espace</Text>
        <Text style={styles.subtitle}>Entre le code partagé par ton partenaire.</Text>

        <BlurView intensity={50} tint="light" style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Code à 8 caractères"
            placeholderTextColor="rgba(100,75,130,0.55)"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
        </BlurView>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={() => handleJoin()} disabled={loading || code.length < 8}>
          {loading ? <ActivityIndicator color="rgba(180,210,255,0.9)" /> : <Text style={styles.buttonText}>Rejoindre</Text>}
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
    marginBottom: 40,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.60)',
    marginBottom: 14,
  },
  input: {
    padding: 18,
    fontSize: 26,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#1e1a36',
    backgroundColor: 'rgba(255,255,255,0.60)',
  },
  button: {
    backgroundColor: 'rgba(110,55,180,0.70)',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  buttonText: { color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 },
  error: { color: '#e05555', marginBottom: 10, fontSize: 13, textAlign: 'center' },
  link: { marginTop: 22, textAlign: 'center', color: 'rgba(70,50,100,0.50)', fontSize: 13 },
})
