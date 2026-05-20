import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/context/auth'

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
      <View style={styles.container}>
        <Text style={styles.title}>Vérifie tes emails</Text>
        <Text style={styles.subtitle}>Un lien de confirmation t'a été envoyé à {email}.</Text>
        <Link href="/(auth)/login" style={styles.link}>Retour à la connexion</Link>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un compte</Text>

      <TextInput
        style={styles.input}
        placeholder="Pseudo"
        placeholderTextColor="#999"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Mot de passe"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
          <Text style={styles.eyeText}>{showPassword ? 'Cacher' : 'Voir'}</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Créer mon compte</Text>}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        Déjà un compte ? Se connecter
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center', color: '#111' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#111',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 16, color: '#111' },
  eyeButton: { paddingHorizontal: 12 },
  eyeText: { fontSize: 13, color: '#666' },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 8, fontSize: 14 },
  link: { marginTop: 16, textAlign: 'center', color: '#666' },
})
