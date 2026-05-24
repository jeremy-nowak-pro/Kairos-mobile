import { BlurView } from 'expo-blur'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

type Props = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  intensity?: number
}

export default function GlassCard({ children, style, intensity = 22 }: Props) {
  return (
    <BlurView intensity={intensity} tint="light" style={[styles.base, style]}>
      {children}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    overflow: 'hidden',
  },
})
