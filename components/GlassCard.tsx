import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

type Props = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}

export default function GlassCard({ children, style, contentStyle }: Props) {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.52)', 'rgba(255,255,255,0.07)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.border, style]}
    >
      <View style={[styles.inner, contentStyle]}>
        <BlurView intensity={4} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          style={styles.specular}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,30,0)', 'rgba(0,0,20,0.12)']}
          style={styles.depth}
          pointerEvents="none"
        />
        {children}
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  border: {
    borderRadius: 15,
    padding: 1,
  },
  inner: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  specular: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  depth:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50 },
})
