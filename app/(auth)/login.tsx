import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import { Link, router } from 'expo-router'
import { useAuth } from '@/context/auth'
import { BlurView } from 'expo-blur'
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'

// ── Mesh gradient background ─────────────────────────────────────────────────

const SKSL = `
uniform float2 iResolution;
uniform float iTime;

float blob(float2 p, float2 center, float spread) {
  float2 d = p - center;
  return exp(-(d.x * d.x + d.y * d.y) / spread);
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / iResolution;
  float t = iTime * 0.00025;

  float wx = sin(uv.y * 5.0 + t * 2.1) * 0.07 + sin(uv.x * 4.0 + t * 1.5) * 0.05;
  float wy = cos(uv.x * 4.5 - t * 1.8) * 0.06 + cos(uv.y * 3.0 + t * 1.2) * 0.05;
  float2 d = uv + float2(wx, wy);

  float2 b1 = float2(0.25 + sin(t * 1.1) * 0.30, 0.30 + cos(t * 0.7) * 0.22);
  float2 b2 = float2(0.75 + cos(t * 0.9) * 0.22, 0.25 + sin(t * 1.3) * 0.25);
  float2 b3 = float2(0.50 + sin(t * 1.5) * 0.28, 0.72 + cos(t * 0.8) * 0.18);
  float2 b4 = float2(0.18 + cos(t * 0.6) * 0.18, 0.62 + sin(t * 1.0) * 0.22);
  float2 b5 = float2(0.82 + sin(t * 0.8) * 0.15, 0.78 + cos(t * 1.2) * 0.18);

  float spread = 0.12;
  float w1 = blob(d, b1, spread);
  float w2 = blob(d, b2, spread);
  float w3 = blob(d, b3, spread);
  float w4 = blob(d, b4, spread);
  float w5 = blob(d, b5, spread);

  float3 c1 = float3(0.133, 0.282, 0.722);
  float3 c2 = float3(0.212, 0.188, 0.690);
  float3 c3 = float3(0.290, 0.102, 0.667);
  float3 c4 = float3(0.102, 0.235, 0.729);
  float3 c5 = float3(0.369, 0.086, 0.635);
  float3 bg = float3(0.027, 0.031, 0.094);

  float wTotal = w1 + w2 + w3 + w4 + w5;
  float3 col = (c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4 + c5 * w5) / (wTotal + 0.0001);
  float coverage = clamp(wTotal * 1.5, 0.0, 1.0);
  col = mix(bg, col, coverage);

  return half4(col, 1.0);
}
`

const effect = Skia.RuntimeEffect.Make(SKSL)

function MeshBackground() {
  const { width, height } = useWindowDimensions()
  const clock = useClock()

  const uniforms = useDerivedValue(() => ({
    iResolution: [width, height] as [number, number],
    iTime: clock.value,
  }))

  if (!effect) return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#070818' }]} />

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
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
            placeholderTextColor="rgba(160,185,230,0.55)"
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
              placeholderTextColor="rgba(160,185,230,0.55)"
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
  root: { flex: 1, backgroundColor: '#070818' },
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
    borderColor: 'rgba(140,170,255,0.35)',
    marginBottom: 14,
  },
  input: {
    padding: 16,
    fontSize: 15,
    color: '#e8f0ff',
    backgroundColor: 'rgba(15,28,80,0.6)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(140,170,255,0.2)',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,28,80,0.6)',
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
