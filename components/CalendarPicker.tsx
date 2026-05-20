import { useRef, useState } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function buildCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatSelected(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface Props {
  visible: boolean
  value: string | null
  onConfirm: (date: string) => void
  onClose: () => void
}

export default function CalendarPicker({ visible, value, onConfirm, onClose }: Props) {
  const initial = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [selected, setSelected] = useState<string | null>(value)

  const fadeAnim = useRef(new Animated.Value(1)).current

  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const changeMonth = (dir: 1 | -1) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      if (dir === -1) {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
        else setViewMonth(m => m - 1)
      } else {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
        else setViewMonth(m => m + 1)
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start()
    })
  }

  const cells = buildCells(viewYear, viewMonth)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>

          <View style={s.handle} />

          {/* Mois / navigation */}
          <View style={s.header}>
            <Pressable onPress={() => changeMonth(-1)} style={s.navBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color="#111" />
            </Pressable>
            <Animated.Text style={[s.monthTitle, { opacity: fadeAnim }]}>
              {MONTHS_FR[viewMonth]} {viewYear}
            </Animated.Text>
            <Pressable onPress={() => changeMonth(1)} style={s.navBtn} hitSlop={8}>
              <Ionicons name="chevron-forward" size={22} color="#111" />
            </Pressable>
          </View>

          {/* En-têtes jours */}
          <View style={s.dayRow}>
            {DAYS_FR.map((d, i) => (
              <View key={i} style={s.dayHeaderCell}>
                <Text style={s.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Grille */}
          <Animated.View style={[s.grid, { opacity: fadeAnim }]}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e-${i}`} style={s.cell} />
              const dateStr = toDateStr(viewYear, viewMonth, day)
              const isSel = selected === dateStr
              const isToday = dateStr === todayStr
              return (
                <Pressable key={dateStr} style={s.cell} onPress={() => setSelected(dateStr)}>
                  <View style={[
                    s.circle,
                    isSel && s.circleSelected,
                    isToday && !isSel && s.circleToday,
                  ]}>
                    <Text style={[
                      s.dayNum,
                      isSel && s.dayNumSelected,
                      isToday && !isSel && s.dayNumToday,
                    ]}>
                      {day}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </Animated.View>

          {/* Date sélectionnée */}
          {selected ? (
            <Text style={s.selectedLabel}>{formatSelected(selected)}</Text>
          ) : (
            <Text style={s.selectedPlaceholder}>Aucune date sélectionnée</Text>
          )}

          {/* Confirmer */}
          <Pressable
            style={[s.confirm, !selected && s.confirmDisabled]}
            disabled={!selected}
            onPress={() => { if (selected) { onConfirm(selected); onClose() } }}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  dayRow: { flexDirection: 'row', marginBottom: 4 },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dayHeaderText: { fontSize: 12, fontWeight: '600', color: '#bbb' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  circleSelected: { backgroundColor: BLUE },
  circleToday: { borderWidth: 1.5, borderColor: BLUE },
  dayNum: { fontSize: 15, color: '#111' },
  dayNumSelected: { color: '#fff', fontWeight: '700' },
  dayNumToday: { color: BLUE, fontWeight: '600' },
  selectedLabel: {
    textAlign: 'center', fontSize: 13, color: '#666',
    marginBottom: 14,
  },
  selectedPlaceholder: {
    textAlign: 'center', fontSize: 13, color: '#ccc',
    marginBottom: 14,
  },
  confirm: {
    backgroundColor: BLUE, borderRadius: 12,
    padding: 15, alignItems: 'center',
  },
  confirmDisabled: { backgroundColor: '#d1d5db' },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
