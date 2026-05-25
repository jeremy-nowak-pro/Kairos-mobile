import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

type Props = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export default function GlassCard({ children, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
        style={styles.specular}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)']}
        style={styles.depth}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(180,130,255,0.40)', 'rgba(180,130,255,0)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={styles.iriLeft}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(80,210,255,0.35)', 'rgba(80,210,255,0)']}
        start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }}
        style={styles.iriRight}
        pointerEvents="none"
      />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tint: { backgroundColor: 'rgba(255,255,255,0.06)' },
  specular: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  depth:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  iriLeft:  { position: 'absolute', top: 0, bottom: 0, left: 0, width: 48 },
  iriRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 48 },
})
