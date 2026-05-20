import { useState } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet,
} from 'react-native'

const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

interface Props {
  visible: boolean
  value: string | null  // YYYY-MM-DD
  onConfirm: (date: string) => void
  onClose: () => void
}

export default function CalendarPicker({ visible, value, onConfirm, onClose }: Props) {
  const initial = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [selected, setSelected] = useState<string | null>(value)

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Monday-first: getDay() returns 0=Sun, adjust to Mon=0
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = new Date().toISOString().split('T')[0]

  const toDateStr = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${viewYear}-${m}-${d}`
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={goPrev} style={styles.navBtn}>
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>
              {MONTHS_FR[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={goNext} style={styles.navBtn}>
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={styles.grid}>
            {DAYS_FR.map((d, i) => (
              <View key={i} style={styles.cell}>
                <Text style={styles.dayLabel}>{d}</Text>
              </View>
            ))}

            {/* Day cells */}
            {cells.map((day, i) => {
              if (!day) return <View key={`e-${i}`} style={styles.cell} />
              const dateStr = toDateStr(day)
              const isSelected = selected === dateStr
              const isToday = dateStr === todayStr
              return (
                <Pressable
                  key={dateStr}
                  style={styles.cell}
                  onPress={() => setSelected(dateStr)}
                >
                  <View style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    isToday && !isSelected && styles.dayCircleToday,
                  ]}>
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}>
                      {day}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>

          {/* Confirm */}
          <Pressable
            style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
            onPress={() => { if (selected) { onConfirm(selected); onClose() } }}
            disabled={!selected}
          >
            <Text style={styles.confirmText}>Confirmer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    width: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { padding: 8 },
  navText: { fontSize: 24, color: '#111', lineHeight: 26 },
  monthTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayLabel: { fontSize: 11, color: '#999', fontWeight: '500' },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleSelected: { backgroundColor: BLUE },
  dayCircleToday: { borderWidth: 1, borderColor: BLUE },
  dayText: { fontSize: 14, color: '#111' },
  dayTextSelected: { color: '#fff', fontWeight: '600' },
  dayTextToday: { color: BLUE, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: BLUE,
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnDisabled: { backgroundColor: '#ccc' },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
