import { useRef, useState } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function buildWeeks(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
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

const BLUE = '#2563EB'

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

  const weeks = buildWeeks(viewYear, viewMonth)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>

          <View style={s.handle} />

          {/* Navigation mois */}
          <View style={s.header}>
            <Pressable onPress={() => changeMonth(-1)} hitSlop={12} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color="#555" />
            </Pressable>
            <Animated.Text style={[s.monthTitle, { opacity: fadeAnim }]}>
              {MONTHS_FR[viewMonth]} {viewYear}
            </Animated.Text>
            <Pressable onPress={() => changeMonth(1)} hitSlop={12} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={20} color="#555" />
            </Pressable>
          </View>

          {/* En-têtes jours */}
          <View style={s.weekRow}>
            {DAYS_FR.map((d, i) => (
              <View key={i} style={s.dayHeaderCell}>
                <Text style={[s.dayHeaderText, i >= 5 && s.weekendHeader]}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.separator} />

          {/* Grille par semaines */}
          <Animated.View style={{ opacity: fadeAnim }}>
            {weeks.map((week, wi) => (
              <View key={wi} style={s.weekRow}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={s.cell} />
                  const dateStr = toDateStr(viewYear, viewMonth, day)
                  const isSel = selected === dateStr
                  const isToday = dateStr === todayStr
                  const isWeekend = di >= 5
                  return (
                    <Pressable
                      key={dateStr}
                      style={s.cell}
                      onPress={() => setSelected(dateStr)}
                    >
                      <View style={[
                        s.circle,
                        isToday && s.circleToday,
                        isSel && s.circleSel,
                      ]}>
                        <Text style={[
                          s.dayNum,
                          isWeekend && !isSel && !isToday && s.weekendNum,
                          (isSel || isToday) && s.dayNumLight,
                        ]}>
                          {day}
                        </Text>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            ))}
          </Animated.View>

          {/* Date sélectionnée */}
          <View style={s.selectedRow}>
            {selected ? (
              <Text style={s.selectedText}>{formatSelected(selected)}</Text>
            ) : (
              <Text style={s.selectedPlaceholder}>Aucune date sélectionnée</Text>
            )}
          </View>

          {/* Bouton confirmer */}
          <Pressable
            style={[s.confirm, !selected && s.confirmOff]}
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

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0',
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 4,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 17, fontWeight: '700', color: '#111', letterSpacing: 0.2 },

  // Jours
  weekRow: { flexDirection: 'row' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: { fontSize: 12, fontWeight: '600', color: '#aaa', letterSpacing: 0.3 },
  weekendHeader: { color: '#c0bfbf' },
  separator: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 4 },

  // Cellules
  cell: {
    flex: 1, height: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  circle: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  circleToday: { backgroundColor: BLUE },
  circleSel: { backgroundColor: '#111' },
  dayNum: { fontSize: 15, color: '#222' },
  weekendNum: { color: '#aaa' },
  dayNumLight: { color: '#fff', fontWeight: '600' },

  // Sélection
  selectedRow: { alignItems: 'center', paddingVertical: 12 },
  selectedText: { fontSize: 13, color: '#555', fontWeight: '500' },
  selectedPlaceholder: { fontSize: 13, color: '#ccc' },

  // Bouton
  confirm: {
    backgroundColor: BLUE, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 4,
  },
  confirmOff: { backgroundColor: '#e5e7eb' },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
