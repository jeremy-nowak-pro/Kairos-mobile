import { useCallback, useMemo, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSpace } from '@/context/space'
import { getEventsForMonth, Event } from '@/lib/events'

const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function CalendarScreen() {
  const { space } = useSpace()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(
    toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  )
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  const loadEvents = useCallback(() => {
    if (!space) return
    setLoading(true)
    getEventsForMonth(space.id, viewYear, viewMonth)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [space, viewYear, viewMonth])

  useFocusEffect(loadEvents)

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDay = useMemo(() => {
    const map: Record<string, Event[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events])

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : []

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendrier</Text>
      </View>

      {/* Month navigation */}
      <View style={styles.monthNav}>
        <Pressable onPress={goPrev} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color="#111" />
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTHS_FR[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={goNext} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color="#111" />
        </Pressable>
      </View>

      {/* Day labels */}
      <View style={styles.grid}>
        {DAYS_FR.map((d, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.dayLabel}>{d}</Text>
          </View>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={styles.cell} />
          const dateStr = toDateStr(viewYear, viewMonth, day)
          const isSelected = selectedDay === dateStr
          const isToday = dateStr === todayStr
          const hasEvents = (eventsByDay[dateStr]?.length ?? 0) > 0
          const count = eventsByDay[dateStr]?.length ?? 0

          return (
            <Pressable
              key={dateStr}
              style={styles.cell}
              onPress={() => setSelectedDay(dateStr)}
            >
              <View style={[
                styles.dayCircle,
                isSelected && styles.dayCircleSelected,
                isToday && !isSelected && styles.dayCircleToday,
              ]}>
                <Text style={[
                  styles.dayNum,
                  isSelected && styles.dayNumSelected,
                  isToday && !isSelected && styles.dayNumToday,
                ]}>
                  {day}
                </Text>
              </View>
              {hasEvents && (
                <View style={styles.dotRow}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, di) => (
                    <View
                      key={di}
                      style={[styles.dot, isSelected && styles.dotSelected]}
                    />
                  ))}
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      <View style={styles.divider} />

      {/* Selected day events */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          style={styles.dayList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {selectedDay && (
            <Text style={styles.dayHeader}>{formatDayHeader(selectedDay)}</Text>
          )}
          {selectedEvents.length === 0 ? (
            <Text style={styles.noEvents}>Aucun événement</Text>
          ) : (
            selectedEvents.map(event => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [styles.eventRow, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/(app)/events/${event.id}`)}
              >
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>{formatTime(event.start_time)}</Text>
                  <Text style={styles.eventTimeText}>{formatTime(event.end_time)}</Text>
                </View>
                <View style={styles.eventBar} />
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.location ? (
                    <Text style={styles.eventLocation}>{event.location}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: { padding: 6 },
  monthTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 48,
  },
  dayLabel: { fontSize: 11, color: '#999', fontWeight: '500', marginBottom: 2 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleSelected: { backgroundColor: BLUE },
  dayCircleToday: { borderWidth: 1.5, borderColor: BLUE },
  dayNum: { fontSize: 14, color: '#111' },
  dayNumSelected: { color: '#fff', fontWeight: '600' },
  dayNumToday: { color: BLUE, fontWeight: '600' },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE },
  dotSelected: { backgroundColor: '#fff' },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginTop: 4 },
  dayList: { flex: 1, paddingHorizontal: 16 },
  dayHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'capitalize',
    marginTop: 16,
    marginBottom: 12,
  },
  noEvents: { fontSize: 14, color: '#bbb', marginTop: 8 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    gap: 10,
  },
  eventTime: { width: 42, alignItems: 'flex-end', gap: 2, paddingTop: 2 },
  eventTimeText: { fontSize: 11, color: '#999' },
  eventBar: { width: 3, borderRadius: 2, backgroundColor: BLUE },
  eventContent: { flex: 1, paddingVertical: 2 },
  eventTitle: { fontSize: 15, fontWeight: '500', color: '#111' },
  eventLocation: { fontSize: 13, color: '#888', marginTop: 2 },
})
