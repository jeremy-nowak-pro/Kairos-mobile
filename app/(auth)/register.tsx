import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '@/context/auth'
import { BlurView } from 'expo-blur'
import MeshBackground from '@/components/MeshBackground'

export default function RegisterScreen() {
  const { signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleRegister = async () => {
    setError(null)
    if (!displayName.trim()) { setError('Le pseudo est requis'); return }
    setLoading(true)
    const { error } = await signUp(email.trim(), password, displayName.trim())
    setLoading(false)
    if (error) setError(error)
    else setDone(true)
  }

  if (done) {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <View style={styles.content}>
          <Text style={styles.title}>Vérifie tes emails</Text>
          <Text style={styles.subtitle}>Un lien de confirmation t'a été envoyé à {email}.</Text>
          <Link href="/(auth)/login" style={styles.link}>Retour à la connexion</Link>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <MeshBackground />
      <View style={styles.content}>
        <Text style={styles.pageTitle}>Kairos</Text>
        <Text style={styles.pageSubtitle}>Créer un compte</Text>

        <BlurView intensity={22} tint="light" style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Pseudo"
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="none"
          />
          <View style={styles.divider} />
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

        <Text style={styles.consent}>
          En créant un compte, tu acceptes notre{' '}
          <Text
            style={styles.consentLink}
            onPress={() => WebBrowser.openBrowserAsync('https://moncerveau.vercel.app/privacy')}
          >
            politique de confidentialité
          </Text>
          .
        </Text>

        <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="rgba(180,210,255,0.9)" />
            : <Text style={styles.buttonText}>Créer mon compte</Text>}
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          Déjà un compte ? Se connecter
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
  pageTitle: {
    fontSize: 44,
    fontWeight: '300',
    marginBottom: 6,
    textAlign: 'center',
    color: '#ffffff',
    letterSpacing: 7,
  },
  pageSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2.5,
    marginBottom: 44,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 22,
    marginBottom: 32,
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
    backgroundColor: 'rgba(8,16,48,0.35)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.40)',
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
    marginBottom: 10,
  },
  consent: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 18,
  },
  consentLink: {
    color: 'rgba(180,200,255,0.70)',
    textDecorationLine: 'underline',
  },
  link: {
    marginTop: 22,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
})
