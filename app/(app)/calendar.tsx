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
function formatTime(t: string) { return t.slice(0, 5) }
function formatFullDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function formatShortDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}
function getInitials(assignedTo: string | null) {
  if (!assignedTo) return ''
  return assignedTo.split(',').map(n => n.trim()[0]?.toUpperCase() ?? '').join('&')
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

// ── Event detail popup ───────────────────────────────────────────────────────

function EventDetailPopup({ event, onClose }: { event: Event; onClose: () => void }) {
  const assignees = event.assigned_to?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  return (
    <View style={styles.popup}>
      <View style={styles.popupHeader}>
        <Text style={styles.popupTitle}>{event.title}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={20} color="#666" />
        </Pressable>
      </View>
      <View style={styles.popupRow}>
        <Ionicons name="calendar-outline" size={15} color="#888" />
        <Text style={styles.popupRowText}>{formatFullDate(event.date)}</Text>
      </View>
      <View style={styles.popupRow}>
        <Ionicons name="time-outline" size={15} color="#888" />
        <Text style={styles.popupRowText}>{formatTime(event.start_time)} – {formatTime(event.end_time)}</Text>
      </View>
      {event.location ? (
        <View style={styles.popupRow}>
          <Ionicons name="location-outline" size={15} color="#888" />
          <Text style={styles.popupRowText}>{event.location}</Text>
        </View>
      ) : null}
      <View style={styles.popupRow}>
        <Ionicons name="person-outline" size={15} color="#888" />
        <Text style={styles.popupRowText}>{event.created_by}</Text>
      </View>
      {assignees.length > 0 && (
        <View style={styles.popupRow}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#888" />
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
        <Text style={styles.popupDescription}>{event.description}</Text>
      ) : null}
    </View>
  )
}

// ── Day list popup (multiple events) ────────────────────────────────────────

function DayListPopup({
  dateStr, events, onSelectEvent, onClose,
}: {
  dateStr: string
  events: Event[]
  onSelectEvent: (e: Event) => void
  onClose: () => void
}) {
  return (
    <View style={styles.popup}>
      <View style={styles.popupHeader}>
        <Text style={styles.popupTitle}>{formatShortDate(dateStr)}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={20} color="#666" />
        </Pressable>
      </View>
      {events.map(e => (
        <Pressable
          key={e.id}
          style={({ pressed }) => [styles.dayListRow, pressed && { opacity: 0.6 }]}
          onPress={() => onSelectEvent(e)}
        >
          <View style={styles.eventAccent} />
          <View style={styles.dayListInfo}>
            <Text style={styles.dayListTitle}>{e.title}</Text>
            <Text style={styles.dayListTime}>{formatTime(e.start_time)} – {formatTime(e.end_time)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </Pressable>
      ))}
    </View>
  )
}

// ── Overlay modal wrapper ────────────────────────────────────────────────────

function PopupModal({ visible, onClose, children }: {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.popupWrapper} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day, dateStr, isToday, isSelected, events, onPress,
}: {
  day: number | null
  dateStr: string | null
  isToday: boolean
  isSelected: boolean
  events: Event[]
  onPress: () => void
}) {
  if (!day || !dateStr) return <View style={styles.cell} />

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cell,
        isSelected && styles.cellSelected,
        pressed && events.length > 0 && styles.cellPressed,
      ]}
      onPress={onPress}
    >
      <View style={[
        styles.dayNumWrap,
        isToday && styles.dayNumToday,
        isSelected && !isToday && styles.dayNumSelected,
      ]}>
        <Text style={[styles.dayNum, (isToday || isSelected) && styles.dayNumHighlight]}>
          {day}
        </Text>
      </View>

      {events.slice(0, 2).map(e => (
        <View key={e.id} style={styles.chip}>
          {e.assigned_to ? (
            <Text style={styles.chipInitials}>{getInitials(e.assigned_to)} </Text>
          ) : null}
          <Text style={styles.chipTitle} numberOfLines={1}>{e.title}</Text>
        </View>
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

  // Popup state: either showing a day list or a single event
  const [dayPopup, setDayPopup] = useState<{ dateStr: string; events: Event[] } | null>(null)
  const [eventPopup, setEventPopup] = useState<Event | null>(null)

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

  const handleCellPress = (dateStr: string) => {
    setSelectedDay(dateStr)
    const dayEvents = eventsByDay[dateStr] ?? []
    if (dayEvents.length === 0) return
    if (dayEvents.length === 1) {
      setEventPopup(dayEvents[0])
    } else {
      setDayPopup({ dateStr, events: dayEvents })
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendrier</Text>
        {!loading && (
          <Text style={styles.eventCount}>
            {events.length} événement{events.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={goPrev} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.monthTitle}>{MONTHS_FR[viewMonth]} {viewYear}</Text>
        <Pressable onPress={goNext} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color="#111" />
        </Pressable>
      </View>

      <View style={styles.dayHeaders}>
        {DAYS_FR.map(d => (
          <View key={d} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

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
                      onPress={() => dateStr && handleCellPress(dateStr)}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Day list popup (2+ events) */}
      <PopupModal visible={!!dayPopup} onClose={() => setDayPopup(null)}>
        {dayPopup && (
          <DayListPopup
            dateStr={dayPopup.dateStr}
            events={dayPopup.events}
            onSelectEvent={e => { setDayPopup(null); setEventPopup(e) }}
            onClose={() => setDayPopup(null)}
          />
        )}
      </PopupModal>

      {/* Event detail popup */}
      <PopupModal visible={!!eventPopup} onClose={() => setEventPopup(null)}>
        {eventPopup && (
          <EventDetailPopup event={eventPopup} onClose={() => setEventPopup(null)} />
        )}
      </PopupModal>
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
  weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ebebeb' },
  cell: {
    flex: 1, minHeight: 80, paddingVertical: 5, paddingHorizontal: 2,
    borderRightWidth: 1, borderRightColor: '#ebebeb',
  },
  cellSelected: { backgroundColor: '#F5F8FF' },
  cellPressed: { backgroundColor: '#EFF6FF' },
  dayNumWrap: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', marginBottom: 3,
  },
  dayNumToday: { backgroundColor: BLUE },
  dayNumSelected: { borderWidth: 1.5, borderColor: BLUE },
  dayNum: { fontSize: 13, color: '#111' },
  dayNumHighlight: { color: '#fff', fontWeight: '700' },
  chip: {
    flexDirection: 'row', backgroundColor: '#EFF6FF',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
    marginBottom: 2, alignItems: 'center',
  },
  chipInitials: { fontSize: 10, color: BLUE, fontWeight: '700' },
  chipTitle: { fontSize: 10, color: '#1D4ED8', flex: 1 },
  moreText: { fontSize: 10, color: '#999', paddingLeft: 4 },

  // Modal
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  popupWrapper: { width: '100%', maxWidth: 360 },
  popup: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  popupHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  popupTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, marginRight: 12 },
  closeBtn: { padding: 2 },
  popupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  popupRowText: { fontSize: 14, color: '#444', flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tag: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  tagText: { fontSize: 13, color: BLUE, fontWeight: '500' },
  popupDescription: {
    fontSize: 14, color: '#666', lineHeight: 21,
    marginTop: 8, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },

  // Day list popup rows
  dayListRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  eventAccent: { width: 3, height: 36, borderRadius: 2, backgroundColor: BLUE },
  dayListInfo: { flex: 1 },
  dayListTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  dayListTime: { fontSize: 12, color: '#888', marginTop: 2 },
})
