import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'

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

  float3 c1 = float3(0.231, 0.118, 0.471);
  float3 c2 = float3(0.420, 0.502, 0.780);
  float3 c3 = float3(0.627, 0.282, 0.471);
  float3 c4 = float3(0.831, 0.627, 0.596);
  float3 c5 = float3(0.784, 0.408, 0.345);
  float3 bg = float3(0.102, 0.055, 0.188);

  float wTotal = w1 + w2 + w3 + w4 + w5;
  float3 col = (c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4 + c5 * w5) / (wTotal + 0.0001);
  float coverage = clamp(wTotal * 1.5, 0.0, 1.0);
  col = mix(bg, col, coverage);

  return half4(col, 1.0);
}
`

const effect = Skia.RuntimeEffect.Make(SKSL)

export default function MeshBackground() {
  const { width, height } = useWindowDimensions()
  const clock = useClock()

  const uniforms = useDerivedValue(() => ({
    iResolution: [width, height] as [number, number],
    iTime: clock.value,
  }))

  if (!effect) return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a0e30' }]} />

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  )
}
