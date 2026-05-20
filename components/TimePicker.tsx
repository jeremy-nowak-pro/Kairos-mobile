import { useEffect, useState } from 'react'
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface Props {
  visible: boolean
  value: string | null  // "HH:MM"
  title?: string
  onConfirm: (time: string) => void
  onClose: () => void
}

export default function TimePicker({
  visible, value, title = 'Choisir l\'heure', onConfirm, onClose,
}: Props) {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)

  useEffect(() => {
    if (!visible) return
    if (value) {
      const [h, m] = value.split(':').map(Number)
      setHours(h ?? 0)
      setMinutes(m ?? 0)
    } else {
      const now = new Date()
      setHours(now.getHours())
      setMinutes(Math.round(now.getMinutes() / 5) * 5 % 60)
    }
  }, [visible])

  const incHour = () => setHours(h => (h + 1) % 24)
  const decHour = () => setHours(h => (h + 23) % 24)
  const incMin  = () => setMinutes(m => (m + 5) % 60)
  const decMin  = () => setMinutes(m => (m + 55) % 60)

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{title}</Text>

          <View style={s.row}>
            {/* Hours */}
            <View style={s.col}>
              <Text style={s.colLabel}>HEURES</Text>
              <Pressable style={s.arrow} onPress={incHour} hitSlop={8}>
                <Ionicons name="chevron-up" size={26} color="#111" />
              </Pressable>
              <View style={s.valueBox}>
                <Text style={s.value}>{pad(hours)}</Text>
              </View>
              <Pressable style={s.arrow} onPress={decHour} hitSlop={8}>
                <Ionicons name="chevron-down" size={26} color="#111" />
              </Pressable>
            </View>

            <Text style={s.colon}>:</Text>

            {/* Minutes */}
            <View style={s.col}>
              <Text style={s.colLabel}>MINUTES</Text>
              <Pressable style={s.arrow} onPress={incMin} hitSlop={8}>
                <Ionicons name="chevron-up" size={26} color="#111" />
              </Pressable>
              <View style={s.valueBox}>
                <Text style={s.value}>{pad(minutes)}</Text>
              </View>
              <Pressable style={s.arrow} onPress={decMin} hitSlop={8}>
                <Ionicons name="chevron-down" size={26} color="#111" />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={s.confirm}
            onPress={() => { onConfirm(`${pad(hours)}:${pad(minutes)}`); onClose() }}
          >
            <Text style={s.confirmText}>Confirmer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const BLUE = '#2563EB'

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 24, width: 280, alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  col: { alignItems: 'center' },
  colLabel: { fontSize: 10, fontWeight: '600', color: '#aaa', letterSpacing: 0.5, marginBottom: 6 },
  arrow: { padding: 8 },
  valueBox: {
    width: 76, height: 68, borderRadius: 12,
    backgroundColor: '#F5F8FF', borderWidth: 1.5, borderColor: BLUE,
    justifyContent: 'center', alignItems: 'center',
  },
  value: { fontSize: 34, fontWeight: '700', color: '#111' },
  colon: { fontSize: 34, fontWeight: '700', color: '#111', marginTop: 22 },
  confirm: {
    backgroundColor: BLUE, borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 44,
  },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
