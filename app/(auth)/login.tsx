import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, useWindowDimensions,
  Animated,
} from 'react-native'
import { Link, router } from 'expo-router'
import { useAuth } from '@/context/auth'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

function AnimatedBackground() {
  const { width, height } = useWindowDimensions()
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      })
    ).start()
  }, [])

  const translateX = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, width * 0.15, 0, -width * 0.15, 0],
  })
  const translateY = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -height * 0.1, height * 0.12, -height * 0.05, 0],
  })
  const translateX2 = anim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [-width * 0.2, width * 0.1, -width * 0.05, -width * 0.2],
  })
  const translateY2 = anim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [height * 0.1, -height * 0.15, height * 0.2, height * 0.1],
  })

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#060d1f', overflow: 'hidden' }]}>
      <Animated.View style={[
        styles.blob,
        { width: width * 0.9, height: width * 0.9, transform: [{ translateX }, { translateY }] },
      ]}>
        <LinearGradient
          colors={['#1a3a6e', '#0f2a5c', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 0.9 }}
        />
      </Animated.View>

      <Animated.View style={[
        styles.blob,
        { width: width * 0.75, height: width * 0.75, top: height * 0.35, left: -width * 0.1, transform: [{ translateX: translateX2 }, { translateY: translateY2 }] },
      ]}>
        <LinearGradient
          colors={['#1e3a5f', '#162d4e', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.1, y: 0.2 }}
          end={{ x: 0.9, y: 0.8 }}
        />
      </Animated.View>

      <Animated.View style={[
        styles.blob,
        { width: width * 0.6, height: width * 0.6, top: height * 0.6, right: -width * 0.05, transform: [{ translateX }, { translateY: translateY2 }] },
      ]}>
        <LinearGradient
          colors={['#0d1f4a', '#0a1838', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>
    </View>
  )
}

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
      <AnimatedBackground />

      <View style={styles.content}>
        <Text style={styles.title}>Kairos</Text>
        <Text style={styles.subtitle}>Votre espace partagé</Text>

        <BlurView intensity={18} tint="dark" style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgba(180,200,220,0.4)"
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
              placeholderTextColor="rgba(180,200,220,0.4)"
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
  root: { flex: 1, backgroundColor: '#060d1f' },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: {
    fontSize: 42,
    fontWeight: '300',
    marginBottom: 6,
    textAlign: 'center',
    color: '#e0eaf8',
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    color: 'rgba(160,190,220,0.5)',
    letterSpacing: 2,
    marginBottom: 40,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.55,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(120,160,220,0.15)',
    marginBottom: 14,
  },
  input: {
    padding: 16,
    fontSize: 15,
    color: '#d8e8f8',
    backgroundColor: 'rgba(10,25,60,0.3)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(120,160,220,0.12)',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,25,60,0.3)',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: '#d8e8f8',
  },
  eyeButton: { paddingHorizontal: 16 },
  eyeText: { fontSize: 12, color: 'rgba(160,190,220,0.5)', letterSpacing: 0.5 },
  button: {
    backgroundColor: 'rgba(30,80,180,0.55)',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(100,160,255,0.25)',
  },
  buttonText: { color: 'rgba(210,230,255,0.95)', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 },
  error: { color: '#e05555', marginBottom: 10, fontSize: 13, textAlign: 'center' },
  link: {
    marginTop: 22,
    textAlign: 'center',
    color: 'rgba(160,190,220,0.45)',
    fontSize: 13,
  },
})
