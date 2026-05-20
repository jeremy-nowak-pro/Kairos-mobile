import { useCallback, useMemo, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, Modal,
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
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function getInitials(assignedTo: string | null): string {
  if (!assignedTo) return ''
  return assignedTo
    .split(',')
    .map(n => n.trim()[0]?.toUpperCase() ?? '')
    .join('&')
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

// ── Event popup modal ────────────────────────────────────────────────────────

function EventModal({ event, onClose }: { event: Event | null; onClose: () => void }) {
  if (!event) return null
  const assignees = event.assigned_to?.split(',').map(s => s.trim()).filter(Boolean) ?? []

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.popup} onPress={() => {}}>
          {/* Header */}
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>{event.title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#666" />
            </Pressable>
          </View>

          {/* Date */}
          <View style={styles.popupRow}>
            <Ionicons name="calendar-outline" size={16} color="#888" />
            <Text style={styles.popupRowText}>{formatFullDate(event.date)}</Text>
          </View>

          {/* Time */}
          <View style={styles.popupRow}>
            <Ionicons name="time-outline" size={16} color="#888" />
            <Text style={styles.popupRowText}>
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </Text>
          </View>

          {/* Location */}
          {event.location ? (
            <View style={styles.popupRow}>
              <Ionicons name="location-outline" size={16} color="#888" />
              <Text style={styles.popupRowText}>{event.location}</Text>
            </View>
          ) : null}

          {/* Created by */}
          <View style={styles.popupRow}>
            <Ionicons name="person-outline" size={16} color="#888" />
            <Text style={styles.popupRowText}>{event.created_by}</Text>
          </View>

          {/* Assigned to */}
          {assignees.length > 0 && (
            <View style={styles.popupRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#888" />
              <View style={styles.tagRow}>
                {assignees.map(name => (
                  <View key={name} style={styles.tag}>
                    <Text style={styles.tagText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {event.description ? (
            <Text style={styles.popupDescription}>{event.description}</Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Day cell ─────────────────────────────────────────────────────────────────

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
      {/* Day number */}
      <View style={[
        styles.dayNumWrap,
        isToday && styles.dayNumToday,
        isSelected && !isToday && styles.dayNumSelected,
      ]}>
        <Text style={[
          styles.dayNum,
          (isToday || isSelected) && styles.dayNumHighlight,
        ]}>
          {day}
        </Text>
      </View>

      {/* Event chips */}
      {events.slice(0, 2).map(e => (
        <Pressable
          key={e.id}
          style={styles.chip}
          onPress={ev => { ev.stopPropagation?.(); onEventPress(e) }}
        >
          {e.assigned_to ? (
            <Text style={styles.chipInitials}>{getInitials(e.assigned_to)} </Text>
          ) : null}
          <Text style={styles.chipTitle} numberOfLines={1}>{e.title}</Text>
        </Pressable>
      ))}
      {events.length > 2 && (
        <Text style={styles.moreText}>+{events.length - 2}</Text>
      )}
    </Pressable>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { space } = useSpace()
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [activeEvent, setActiveEvent] = useState<Event | null>(null)
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
    setSelectedDay(null)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendrier</Text>
        {!loading && (
          <Text style={styles.eventCount}>
            {events.length} événement{events.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Month navigation */}
      <View style={styles.monthNav}>
        <Pressable onPress={goPrev} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.monthTitle}>{MONTHS_FR[viewMonth]} {viewYear}</Text>
        <Pressable onPress={goNext} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color="#111" />
        </Pressable>
      </View>

      {/* Day name headers */}
      <View style={styles.dayHeaders}>
        {DAYS_FR.map(d => (
          <View key={d} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
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
                      onDayPress={() => setSelectedDay(dateStr)}
                      onEventPress={setActiveEvent}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Event popup */}
      <EventModal event={activeEvent} onClose={() => setActiveEvent(null)} />
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
    paddingHorizontal: 8, paddingVertical: 12,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 17, fontWeight: '700', color: '#111' },

  dayHeaders: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#ebebeb',
    paddingBottom: 6, paddingHorizontal: 4,
  },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, color: '#aaa', fontWeight: '600' },

  grid: { paddingHorizontal: 4 },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#ebebeb',
  },
  cell: {
    flex: 1, minHeight: 80,
    paddingVertical: 5, paddingHorizontal: 2,
    borderRightWidth: 1, borderRightColor: '#ebebeb',
  },
  cellSelected: { backgroundColor: '#F5F8FF' },

  dayNumWrap: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', marginBottom: 3,
  },
  dayNumToday: { backgroundColor: BLUE },
  dayNumSelected: { borderWidth: 1.5, borderColor: BLUE },
  dayNum: { fontSize: 13, color: '#111' },
  dayNumHighlight: { color: '#fff', fontWeight: '700' },

  chip: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 2,
    marginBottom: 2,
    alignItems: 'center',
  },
  chipInitials: { fontSize: 10, color: BLUE, fontWeight: '700' },
  chipTitle: { fontSize: 10, color: '#1D4ED8', flex: 1 },
  moreText: { fontSize: 10, color: '#999', paddingLeft: 4 },

  // Modal
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  popup: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  popupHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  popupTitle: {
    fontSize: 18, fontWeight: '700', color: '#111',
    flex: 1, marginRight: 12,
  },
  closeBtn: { padding: 2 },
  popupRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 10,
  },
  popupRowText: { fontSize: 14, color: '#444', flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tag: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 4,
  },
  tagText: { fontSize: 13, color: BLUE, fontWeight: '500' },
  popupDescription: {
    fontSize: 14, color: '#666', lineHeight: 21,
    marginTop: 8, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
})
