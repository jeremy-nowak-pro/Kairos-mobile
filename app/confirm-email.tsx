import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import MeshBackground from '@/components/MeshBackground'

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.error_description) {
      setError(decodeURIComponent(String(params.error_description)))
      return
    }
    if (!params.code) {
      setError('Lien de confirmation invalide.')
      return
    }
    supabase.auth.exchangeCodeForSession(String(params.code)).then(({ error }) => {
      if (error) setError(error.message)
      else router.replace('/')
    })
  }, [params.code, params.error_description])

  return (
    <View style={styles.root}>
      <MeshBackground />
      <View style={styles.content}>
        {error ? (
          <>
            <Text style={styles.title}>Lien invalide</Text>
            <Text style={styles.subtitle}>{error}</Text>
            <Link href="/(auth)/login" style={styles.link}>Retour à la connexion</Link>
          </>
        ) : (
          <>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.title}>Confirmation en cours…</Text>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a0e30' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    textAlign: 'center',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 22,
    marginBottom: 24,
  },
  link: {
    marginTop: 8,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
})
