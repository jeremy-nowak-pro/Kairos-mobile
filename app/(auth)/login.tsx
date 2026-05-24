import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
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
    <View style={styles.root}>
      <MeshBackground />

      <View style={styles.content}>
        <Text style={styles.title}>Kairos</Text>
        <Text style={styles.subtitle}>Votre espace partagé</Text>

        <BlurView intensity={50} tint="light" style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.45)"
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
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
              <Text style={styles.eyeText}>{showPassword ? 'Cacher' : 'Voir'}</Text>
            </Pressable>
          </View>
        </BlurView>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="rgba(180,210,255,0.9)" />
            : <Text style={styles.buttonText}>Se connecter</Text>}
        </Pressable>

        <Link href="/(auth)/register" style={styles.link}>
          Pas encore de compte ? S'inscrire
        </Link>
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
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: '#ccd8f0',
  },
  eyeButton: { paddingHorizontal: 16 },
  eyeText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  button: {
    backgroundColor: 'rgba(110,55,180,0.70)',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  buttonText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 },
  error: { color: '#e05555', marginBottom: 10, fontSize: 13, textAlign: 'center' },
  link: {
    marginTop: 22,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
})
