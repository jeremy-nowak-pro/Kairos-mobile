import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link, router } from 'expo-router'
import { useAuth } from '@/context/auth'
import { BlurView } from 'expo-blur'
import MeshBackground from '@/components/MeshBackground'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 3000)
    return () => clearTimeout(t)
  }, [error])

  const handleLogin = async () => {
    setError(null)
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      router.replace('/')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <MeshBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Kairos</Text>
        <Text style={styles.subtitle}>Votre espace partagé</Text>

        <BlurView intensity={22} tint="light" style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgba(160,180,220,0.35)"
            selectionColor="rgba(120,160,255,0.6)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={styles.divider} />
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Mot de passe"
              placeholderTextColor="rgba(160,180,220,0.35)"
              selectionColor="rgba(120,160,255,0.6)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
              <Text style={styles.eyeText}>{showPassword ? 'Cacher' : 'Voir'}</Text>
            </Pressable>
          </View>
        </BlurView>

        <View style={styles.errorContainer}>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="rgba(180,210,255,0.9)" />
            : <Text style={styles.buttonText}>Se connecter</Text>}
        </Pressable>

        <Link href="/(auth)/register" style={styles.link}>
          Pas encore de compte ? S'inscrire
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a0e30' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: {
    fontSize: 44,
    fontWeight: '300',
    marginBottom: 6,
    textAlign: 'center',
    color: '#ffffff',
    letterSpacing: 7,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2.5,
    marginBottom: 44,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
    marginBottom: 14,
  },
  input: {
    padding: 16,
    fontSize: 15,
    color: '#dce8ff',
    backgroundColor: 'rgba(8,16,48,0.35)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(140,170,255,0.18)',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8,16,48,0.35)',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: '#dce8ff',
  },
  eyeButton: { paddingHorizontal: 16 },
  eyeText: { fontSize: 12, color: 'rgba(150,175,220,0.45)', letterSpacing: 0.5 },
  button: {
    backgroundColor: 'rgba(25,55,140,0.5)',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,160,255,0.3)',
  },
  buttonText: { color: 'rgba(200,220,255,0.95)', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 },
  errorContainer: {
    height: 44,
    justifyContent: 'center',
    marginBottom: 4,
  },
  error: {
    backgroundColor: 'rgba(224,85,85,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224,85,85,0.45)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#f08080',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    marginTop: 22,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
})
