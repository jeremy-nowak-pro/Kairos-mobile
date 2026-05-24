import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, useWindowDimensions,
  Animated, Easing,
} from 'react-native'
import { Link, router } from 'expo-router'
import { useAuth } from '@/context/auth'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

// ── Mesh gradient background ─────────────────────────────────────────────────

const STEPS = 32
const INPUT = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS)

function sinPoints(amplitude: number, phase = 0): number[] {
  return INPUT.map(t => Math.sin(t * Math.PI * 2 + phase) * amplitude)
}

function useOscillator(duration: number) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    ).start()
  }, [])
  return anim
}

function MeshBackground() {
  const { width, height } = useWindowDimensions()
  const W = width * 2.2
  const H = height * 2.2
  const ox = -width * 0.6
  const oy = -height * 0.6

  const a1 = useOscillator(14000)
  const a2 = useOscillator(9500)
  const a3 = useOscillator(18000)
  const a4 = useOscillator(12000)
  const a5 = useOscillator(16000)

  const tx1 = a1.interpolate({ inputRange: INPUT, outputRange: sinPoints(width * 0.38) })
  const ty1 = a1.interpolate({ inputRange: INPUT, outputRange: sinPoints(height * 0.22, Math.PI * 0.6) })

  const tx2 = a2.interpolate({ inputRange: INPUT, outputRange: sinPoints(width * 0.28, Math.PI * 0.5) })
  const ty2 = a2.interpolate({ inputRange: INPUT, outputRange: sinPoints(height * 0.42) })

  const tx3 = a3.interpolate({ inputRange: INPUT, outputRange: sinPoints(width * 0.44, Math.PI) })
  const ty3 = a3.interpolate({ inputRange: INPUT, outputRange: sinPoints(height * 0.3, Math.PI * 0.25) })

  const tx4 = a4.interpolate({ inputRange: INPUT, outputRange: sinPoints(width * 0.32, Math.PI * 0.75) })
  const ty4 = a4.interpolate({ inputRange: INPUT, outputRange: sinPoints(height * 0.28, Math.PI * 1.4) })

  const tx5 = a5.interpolate({ inputRange: INPUT, outputRange: sinPoints(width * 0.22, Math.PI * 1.1) })
  const ty5 = a5.interpolate({ inputRange: INPUT, outputRange: sinPoints(height * 0.36, Math.PI * 0.4) })

  const layer = (tx: Animated.AnimatedInterpolation<number>, ty: Animated.AnimatedInterpolation<number>, colors: readonly [string, string, ...string[]], start: { x: number; y: number }, end: { x: number; y: number }) => (
    <Animated.View style={[styles.layer, { width: W, height: H, left: ox, top: oy, transform: [{ translateX: tx }, { translateY: ty }] }]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} start={start} end={end} />
    </Animated.View>
  )

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#04060f', overflow: 'hidden' }]}>
      {layer(tx1, ty1, ['#2a0d5e', '#150630', 'transparent'], { x: 0, y: 0 }, { x: 1, y: 1 })}
      {layer(tx2, ty2, ['#0d2d6e', '#060f28', 'transparent'], { x: 1, y: 0 }, { x: 0, y: 1 })}
      {layer(tx3, ty3, ['#1a0a50', '#0a0520', 'transparent'], { x: 0.5, y: 0 }, { x: 0.5, y: 1 })}
      {layer(tx4, ty4, ['#0a2850', '#040e20', 'transparent'], { x: 0, y: 1 }, { x: 1, y: 0 })}
      {layer(tx5, ty5, ['#1e0845', '#0d0328', 'transparent'], { x: 1, y: 0.5 }, { x: 0, y: 0.5 })}
    </View>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

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

        <BlurView intensity={22} tint="dark" style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgba(160,180,220,0.35)"
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
  root: { flex: 1, backgroundColor: '#04060f' },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  layer: {
    position: 'absolute',
    opacity: 0.9,
  },
  title: {
    fontSize: 44,
    fontWeight: '300',
    marginBottom: 6,
    textAlign: 'center',
    color: '#dce8ff',
    letterSpacing: 7,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(150,175,220,0.45)',
    letterSpacing: 2.5,
    marginBottom: 44,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140,170,255,0.18)',
    marginBottom: 14,
  },
  input: {
    padding: 16,
    fontSize: 15,
    color: '#ccd8f0',
    backgroundColor: 'rgba(8,16,48,0.35)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(140,170,255,0.1)',
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
  error: { color: '#e05555', marginBottom: 10, fontSize: 13, textAlign: 'center' },
  link: {
    marginTop: 22,
    textAlign: 'center',
    color: 'rgba(150,175,220,0.4)',
    fontSize: 13,
  },
})
