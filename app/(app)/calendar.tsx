import { useCallback, useMemo, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSpace } from '@/context/space'
import { getEventsForMonth, Event } from '@/lib/events'

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatTime(t: string): string { return t.slice(0, 5) }

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function buildWeeks(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1
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

// ── Event detail panel ──────────────────────────────────────────────────────

function EventDetail({ event, onBack }: { event: Event; onBack: () => void }) {
  const assignees = event.assigned_to?.split(',').map(s => s.trim()).filter(Boolean) ?? []

  return (
    <View style={styles.detail}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Ionicons name="arrow-back" size={16} color={BLUE} />
        <Text style={styles.backText}>Retour à la liste</Text>
      </Pressable>

      <Text style={styles.detailTitle}>{event.title}</Text>
      <Text style={styles.detailDate}>{formatFullDate(event.date)}</Text>

      <View style={styles.detailRow}>
        <Ionicons name="time-outline" size={15} color="#888" />
        <Text style={styles.detailRowText}>
          {formatTime(event.start_time)} – {formatTime(event.end_time)}
        </Text>
      </View>

      {event.location ? (
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={15} color="#888" />
          <Text style={styles.detailRowText}>{event.location}</Text>
        </View>
      ) : null}

      {assignees.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionLabel}>ASSIGNÉ À</Text>
          <View style={styles.tagRow}>
            {assignees.map(name => (
              <View key={name} style={styles.tag}>
                <Text style={styles.tagText}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {event.description ? (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionLabel}>DESCRIPTION</Text>
          <Text style={styles.detailDescription}>{event.description}</Text>
        </View>
      ) : null}
    </View>
  )
}

// ── Day event list ──────────────────────────────────────────────────────────

function DayEventList({
  dateStr,
  events,
  onSelect,
}: {
  dateStr: string
  events: Event[]
  onSelect: (e: Event) => void
}) {
  return (
    <View style={styles.dayList}>
      <Text style={styles.dayListHeader}>{formatDayLabel(dateStr)}</Text>
      {events.length === 0 ? (
        <Text style={styles.noEvents}>Aucun événement</Text>
      ) : (
        events.map(event => {
          const assignees = event.assigned_to?.split(',').map(s => s.trim()).filter(Boolean) ?? []
          return (
            <Pressable
              key={event.id}
              style={({ pressed }) => [styles.eventRow, pressed && { opacity: 0.7 }]}
              onPress={() => onSelect(event)}
            >
              <View style={styles.eventTimeCol}>
                <Text style={styles.eventTimeText}>{formatTime(event.start_time)}</Text>
                <Text style={styles.eventTimeText}>{formatTime(event.end_time)}</Text>
              </View>
              <View style={styles.eventAccent} />
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                {event.location ? <Text style={styles.eventLocation}>{event.location}</Text> : null}
                {assignees.length > 0 && (
                  <Text style={styles.eventAssigned}>{assignees.join(' · ')}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </Pressable>
          )
        })
      )}
    </View>
  )
}

// ── Day cell ────────────────────────────────────────────────────────────────

function DayCell({
  day, dateStr, isToday, isSelected, events, onDayPress, onEventPress,
}: {
  day: number | null
  dateStr: string | null
  isToday: boolean
  isSelected: boolean
  events: Event[]
  onDayPress: () => void
  onEventPress: (e: Event) => void
}) {
  if (!day || !dateStr) return <View style={styles.cell} />

  return (
    <Pressable style={[styles.cell, isSelected && styles.cellSelected]} onPress={onDayPress}>
      <View style={[
        styles.dayNumWrap,
        isToday && styles.dayNumWrapToday,
        isSelected && !isToday && styles.dayNumWrapSelected,
      ]}>
        <Text style={[
          styles.dayNum,
          (isToday || isSelected) && styles.dayNumHighlight,
        ]}>
          {day}
        </Text>
      </View>

      {events.slice(0, 3).map(e => (
        <Pressable
          key={e.id}
          style={styles.chip}
          onPress={ev => { ev.stopPropagation?.(); onEventPress(e) }}
        >
          <Text style={styles.chipText} numberOfLines={1}>{e.title}</Text>
        </Pressable>
      ))}
      {events.length > 3 && (
        <Text style={styles.moreText}>+{events.length - 3}</Text>
      )}
    </Pressable>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { space } = useSpace()
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string>(todayStr)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
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
    setSelectedEvent(null)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const goNext = () => {
    setSelectedEvent(null)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const eventsByDay = useMemo(() => {
    const map: Record<string, Event[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events])

  const weeks = useMemo(() => buildWeeks(viewYear, viewMonth), [viewYear, viewMonth])
  const selectedDayEvents = eventsByDay[selectedDay] ?? []

  const handleDayPress = (dateStr: string) => {
    setSelectedDay(dateStr)
    setSelectedEvent(null)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendrier</Text>
        <Text style={styles.eventCount}>{events.length} événement{events.length !== 1 ? 's' : ''}</Text>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={goPrev} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color="#111" />
        </Pressable>
        <Text style={styles.monthTitle}>{MONTHS_FR[viewMonth]} {viewYear}</Text>
        <Pressable onPress={goNext} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color="#111" />
        </Pressable>
      </View>

      <View style={styles.dayHeaders}>
        {DAYS_FR.map(d => (
          <View key={d} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.grid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((day, di) => {
                  const dateStr = day ? toDateStr(viewYear, viewMonth, day) : null
                  return (
                    <DayCell
                      key={di}
                      day={day}
                      dateStr={dateStr}
                      isToday={dateStr === todayStr}
                      isSelected={dateStr === selectedDay}
                      events={dateStr ? (eventsByDay[dateStr] ?? []) : []}
                      onDayPress={() => dateStr && handleDayPress(dateStr)}
                      onEventPress={e => { if (dateStr) setSelectedDay(dateStr); setSelectedEvent(e) }}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {selectedEvent ? (
          <EventDetail event={selectedEvent} onBack={() => setSelectedEvent(null)} />
        ) : (
          <DayEventList
            dateStr={selectedDay}
            events={selectedDayEvents}
            onSelect={setSelectedEvent}
          />
        )}
      </ScrollView>
    </View>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  eventCount: { fontSize: 13, color: '#999', marginTop: 2 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  dayHeaders: {
    flexDirection: 'row', paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 4,
  },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, color: '#aaa', fontWeight: '500' },
  grid: { paddingHorizontal: 4 },
  weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cell: {
    flex: 1, minHeight: 64, paddingVertical: 4, paddingHorizontal: 2,
    borderRightWidth: 1, borderRightColor: '#f0f0f0',
  },
  cellSelected: { backgroundColor: '#F5F8FF' },
  dayNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  dayNumWrapToday: { backgroundColor: BLUE },
  dayNumWrapSelected: { borderWidth: 1.5, borderColor: BLUE },
  dayNum: { fontSize: 12, color: '#111' },
  dayNumHighlight: { color: '#fff', fontWeight: '700' },
  chip: {
    backgroundColor: '#EFF6FF', borderRadius: 3,
    paddingHorizontal: 3, paddingVertical: 1, marginBottom: 2,
  },
  chipText: { fontSize: 9, color: BLUE, fontWeight: '500' },
  moreText: { fontSize: 9, color: '#999', paddingLeft: 2 },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginTop: 4 },

  // Day list
  dayList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  dayListHeader: {
    fontSize: 13, fontWeight: '600', color: '#888',
    textTransform: 'capitalize', marginBottom: 12,
  },
  noEvents: { fontSize: 14, color: '#ccc' },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  eventTimeCol: { width: 38, gap: 2 },
  eventTimeText: { fontSize: 11, color: '#999', textAlign: 'right' },
  eventAccent: { width: 3, height: 36, borderRadius: 2, backgroundColor: BLUE },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  eventLocation: { fontSize: 12, color: '#888', marginTop: 1 },
  eventAssigned: { fontSize: 11, color: BLUE, marginTop: 2 },

  // Event detail
  detail: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, color: BLUE },
  detailTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  detailDate: { fontSize: 14, color: BLUE, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailRowText: { fontSize: 14, color: '#444' },
  detailSection: { marginTop: 16 },
  detailSectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#999', letterSpacing: 0.5, marginBottom: 8,
  },
  detailDescription: { fontSize: 14, color: '#444', lineHeight: 21 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 4,
  },
  tagText: { fontSize: 13, color: BLUE },
})
