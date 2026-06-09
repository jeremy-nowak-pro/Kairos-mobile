import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet,
  ScrollView, Modal, BackHandler,
} from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSpace } from '@/context/space'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { getEventsForMonth, Event } from '@/lib/events'
import { getAttachments, getSignedUrl } from '@/lib/attachments'
import { userColor } from '@/lib/userColor'

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

function EventDetailPopup({ event, onClose }: { event: Event; onClose: () => void }) {
  const assignees = event.assigned_to?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  const color = userColor(event.assigned_to)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [viewerUri, setViewerUri] = useState<string | null>(null)

  useEffect(() => {
    getAttachments(event.id)
      .then(async atts => {
        const imgs = atts.filter(a => a.mime_type?.startsWith('image/'))
        const urls = await Promise.all(
          imgs.map(a => getSignedUrl(a.storage_path).catch(() => null))
        )
        setThumbs(urls.filter((u): u is string => u !== null))
      })
      .catch(() => {})
  }, [event.id])

  return (
    <BlurView intensity={28} tint="light" style={styles.popup}>
      <View style={[styles.popupAccent, { backgroundColor: color.text }]} />

      <View style={styles.popupHeader}>
        <Text style={styles.popupTitle}>{event.title}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.80)" />
        </Pressable>
      </View>

      <View style={thumbs.length === 1 ? styles.popupMainRow : undefined}>
        <View style={thumbs.length === 1 ? styles.popupDateTimeCol : undefined}>
          <View style={styles.popupRow}>
            <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.70)" />
            <Text style={styles.popupRowText}>{formatFullDate(event.date)}</Text>
          </View>
          <View style={[styles.popupRow, { marginBottom: 0 }]}>
            <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.70)" />
            <Text style={styles.popupRowText}>
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </Text>
          </View>
        </View>

        {thumbs.length === 1 && (
          <Pressable onPress={() => setViewerUri(thumbs[0])}>
            <Image source={{ uri: thumbs[0] }} style={styles.popupThumb} contentFit="cover" />
          </Pressable>
        )}
      </View>

      {thumbs.length > 1 && (
        <View style={styles.popupThumbRow}>
          {thumbs.slice(0, 4).map((uri, i) => (
            <Pressable key={i} onPress={() => setViewerUri(uri)}>
              <Image source={{ uri }} style={styles.popupThumb} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.popupDivider} />

      {event.location ? (
        <View style={styles.popupRow}>
          <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.70)" />
          <Text style={styles.popupRowText}>{event.location}</Text>
        </View>
      ) : null}
      <View style={styles.popupRow}>
        <Ionicons name="person-outline" size={15} color="rgba(255,255,255,0.70)" />
        <Text style={styles.popupRowText}>{event.created_by}</Text>
      </View>
      {assignees.length > 0 && (
        <View style={[styles.popupRow, { marginBottom: 0 }]}>
          <Ionicons name="checkmark-circle-outline" size={15} color="rgba(255,255,255,0.70)" />
          <View style={styles.tagRow}>
            {assignees.map(name => {
              const c = userColor(name)
              return (
                <View key={name} style={[styles.tag, { backgroundColor: c.text }]}>
                  <Text style={styles.tagText}>{name}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}
      {event.description ? (
        <Text style={styles.popupDescription}>{event.description}</Text>
      ) : null}

      {viewerUri && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
          <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} contentFit="contain" />
            <Pressable style={styles.viewerClose} onPress={() => setViewerUri(null)}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </BlurView>
  )
}

function DayListPopup({
  dateStr, events, onSelectEvent, onClose,
}: {
  dateStr: string
  events: Event[]
  onSelectEvent: (e: Event) => void
  onClose: () => void
}) {
  return (
    <BlurView intensity={28} tint="light" style={styles.popup}>
      <View style={styles.popupHeader}>
        <Text style={styles.popupTitle}>{formatShortDate(dateStr)}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.80)" />
        </Pressable>
      </View>
      {events.map(e => (
        <Pressable
          key={e.id}
          style={({ pressed }) => [styles.dayListRow, pressed && { opacity: 0.6 }]}
          onPress={() => onSelectEvent(e)}
        >
          <View style={[styles.eventAccent, { backgroundColor: userColor(e.assigned_to).text }]} />
          <View style={styles.dayListInfo}>
            <Text style={styles.dayListTitle}>{e.title}</Text>
            <Text style={styles.dayListTime}>{formatTime(e.start_time)} – {formatTime(e.end_time)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(140,170,255,0.3)" />
        </Pressable>
      ))}
    </BlurView>
  )
}

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

function DayCell({
  day, dateStr, isToday, events, onPress,
}: {
  day: number | null
  dateStr: string | null
  isToday: boolean
  events: Event[]
  onPress: () => void
}) {
  if (!day || !dateStr) return <View style={styles.cell} />

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
      onPress={onPress}
    >
      <View style={[styles.dayNumWrap, isToday && styles.dayNumToday]}>
        <Text style={[styles.dayNum, isToday && styles.dayNumHighlight]}>
          {day}
        </Text>
      </View>

      {events.slice(0, 2).map(e => {
        const { text } = userColor(e.assigned_to)
        return (
          <View key={e.id} style={[styles.chip, { backgroundColor: text }]}>
            <Text style={styles.chipTitle} numberOfLines={1}>{e.title}</Text>
          </View>
        )
      })}
      {events.length > 2 && (
        <Text style={styles.moreText}>+{events.length - 2}</Text>
      )}
    </Pressable>
  )
}

export default function CalendarScreen() {
  const { space } = useSpace()
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [dayPopup, setDayPopup] = useState<{ dateStr: string; events: Event[] } | null>(null)
  const [eventPopup, setEventPopup] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  const dayPopupRef = useRef<{ dateStr: string; events: Event[] } | null>(null)
  const eventPopupRef = useRef<Event | null>(null)
  useEffect(() => { dayPopupRef.current = dayPopup }, [dayPopup])
  useEffect(() => { eventPopupRef.current = eventPopup }, [eventPopup])

  useFocusEffect(useCallback(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (eventPopupRef.current) { setEventPopup(null); return true }
      if (dayPopupRef.current) { setDayPopup(null); return true }
      return false
    })
    return () => handler.remove()
  }, []))

  const loadEvents = useCallback(() => {
    if (!space) return
    setLoading(true)
    getEventsForMonth(space.id, viewYear, viewMonth)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [space, viewYear, viewMonth])

  useFocusEffect(loadEvents)

  useFocusEffect(useCallback(() => {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
  }, []))

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const goNext = () => {
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

  const onSwipeStateChange = ({ nativeEvent }: any) => {
    if (dayPopup || eventPopup) return
    if (nativeEvent.state === State.END) {
      if (nativeEvent.translationX < -60 || nativeEvent.velocityX < -300) goNext()
      else if (nativeEvent.translationX > 60 || nativeEvent.velocityX > 300) goPrev()
    }
  }

  const handleCellPress = (dateStr: string) => {
    const dayEvents = eventsByDay[dateStr] ?? []
    if (dayEvents.length === 0) {
      router.push(`/(app)/calendar/new?date=${dateStr}`)
      return
    }
    if (dayEvents.length === 1) {
      setEventPopup(dayEvents[0])
    } else {
      setDayPopup({ dateStr, events: dayEvents })
    }
  }

  return (
    <View style={styles.container}>
      <PanGestureHandler
        onHandlerStateChange={onSwipeStateChange}
        activeOffsetX={[-15, 15]}
        failOffsetY={[-15, 15]}
      >
      <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendrier</Text>
        <Text style={styles.eventCount}>
          {!loading ? `${events.length} événement${events.length !== 1 ? 's' : ''}` : ' '}
        </Text>
      </View>

      <LinearGradient
        colors={['rgba(255,255,255,0.52)', 'rgba(255,255,255,0.07)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.calBorder}
      >
      <View style={styles.calCard}>
        <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          style={styles.glassSpecular}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,30,0)', 'rgba(0,0,20,0.12)']}
          style={styles.glassDepth}
          pointerEvents="none"
        />
        <View style={styles.monthNav}>
          <Pressable onPress={goPrev} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.92)" />
          </Pressable>
          <Text style={styles.monthTitle}>{MONTHS_FR[viewMonth]} {viewYear}</Text>
          <Pressable onPress={goNext} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.92)" />
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
                      events={dateStr ? (eventsByDay[dateStr] ?? []) : []}
                      onPress={() => dateStr && handleCellPress(dateStr)}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      </LinearGradient>

      </View>
      </PanGestureHandler>

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

      <PopupModal visible={!!eventPopup} onClose={() => setEventPopup(null)}>
        {eventPopup && (
          <EventDetailPopup event={eventPopup} onClose={() => setEventPopup(null)} />
        )}
      </PopupModal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.30)',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  eventCount: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  calBorder: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 21,
    padding: 1,
  },
  calCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  glassDepth:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12,
  },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  dayHeaders: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(140,170,255,0.1)',
    paddingBottom: 6, paddingHorizontal: 4,
  },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  grid: { paddingHorizontal: 4 },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  cell: {
    flex: 1, minHeight: 80, paddingVertical: 5, paddingHorizontal: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(0,0,0,0.06)',
  },
  cellPressed: { backgroundColor: 'rgba(120,160,255,0.06)' },
  dayNumWrap: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', marginBottom: 3,
  },
  dayNumToday: { backgroundColor: 'rgba(90,50,200,0.85)' },
  dayNum: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  dayNumHighlight: { color: '#ffffff', fontWeight: '700' },
  chip: {
    borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2,
    width: '100%',
  },
  chipTitle: { fontSize: 10, fontWeight: '600', color: '#ffffff' },
  moreText: { fontSize: 10, color: 'rgba(255,255,255,0.55)', paddingLeft: 4 },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  popupWrapper: { width: '100%', maxWidth: 360 },
  popup: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16, padding: 20, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  popupAccent: { height: 4, marginHorizontal: -20, marginTop: -20, marginBottom: 14 },
  popupHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  popupTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff', flex: 1, marginRight: 12 },
  closeBtn: { padding: 2 },
  popupMainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  popupDateTimeCol: { flex: 1 },
  popupThumbRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginTop: 10,
  },
  popupThumb: { width: 72, height: 72, borderRadius: 8 },
  popupDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 10,
  },
  popupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  popupRowText: { fontSize: 13, color: 'rgba(255,255,255,0.88)', flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  popupDescription: {
    fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 20,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: { position: 'absolute', top: 56, right: 20, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },

  dayListRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(140,170,255,0.1)',
  },
  eventAccent: { width: 3, height: 36, borderRadius: 2 },
  dayListInfo: { flex: 1 },
  dayListTitle: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  dayListTime: { fontSize: 12, color: 'rgba(255,255,255,0.70)', marginTop: 2 },
})
