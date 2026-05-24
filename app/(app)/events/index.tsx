import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Animated, Easing,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useSpace } from '@/context/space'
import { getUpcomingEvents, Event } from '@/lib/events'
import { userColor } from '@/lib/userColor'
import { prefetchEventImages } from '@/lib/imageCache'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function EventCard({ event, delay, animKey }: { event: Event; delay: number; animKey: number }) {
  const color = userColor(event.assigned_to)
  const anim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const translateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [260, 0] })

  useEffect(() => {
    anim.setValue(0)
    slideAnim.setValue(0)
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    }, delay)
    return () => clearTimeout(t)
  }, [animKey])

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX }] }}>
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/(app)/events/${event.id}`)}
    >
      <View style={[styles.cardBar, { backgroundColor: color.text }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.cardDate}>{formatDate(event.date)}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="time-outline" size={12} color="rgba(150,175,220,0.5)" />
          <Text style={styles.cardTime}>
            {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </Text>
          {event.location ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="location-outline" size={12} color="rgba(150,175,220,0.5)" />
              <Text style={styles.cardLoc} numberOfLines={1}>{event.location}</Text>
            </>
          ) : null}
        </View>
        {event.assigned_to ? (
          <View style={styles.tagRow}>
            {event.assigned_to.split(',').map(n => n.trim()).filter(Boolean).map(name => {
              const c = userColor(name)
              return (
                <View key={name} style={[styles.tag, { backgroundColor: c.bg }]}>
                  <Text style={[styles.tagText, { color: c.text }]}>{name}</Text>
                </View>
              )
            })}
          </View>
        ) : null}
      </View>
    </Pressable>
    </Animated.View>
  )
}

export default function EventsScreen() {
  const { space } = useSpace()
  const navigation = useNavigation()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const returningFromChild = useRef(false)

  useEffect(() => {
    return navigation.addListener('state' as any, (e: any) => {
      if ((e.data?.state?.index ?? 0) > 0) returningFromChild.current = true
    })
  }, [navigation])

  useFocusEffect(
    useCallback(() => {
      if (!space) return
      if (!returningFromChild.current) setFocusKey(k => k + 1)
      returningFromChild.current = false
      setLoading(true)
      getUpcomingEvents(space.id)
        .then(data => {
          setEvents(data)
          data.slice(0, 5).forEach(e => prefetchEventImages(e.id))
        })
        .catch(() => setError('Impossible de charger les événements'))
        .finally(() => setLoading(false))
    }, [space])
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Événements</Text>
        {!loading && events.length > 0 && (
          <Text style={styles.subtitle}>{events.length} à venir</Text>
        )}
      </View>

      {loading && events.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 48 }} color="rgba(150,175,220,0.6)" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucun événement à venir</Text>
          <Pressable onPress={() => router.push('/(app)/events/new')}>
            <Text style={styles.emptyAction}>Créer le premier</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          renderItem={({ item, index }) => <EventCard event={item} delay={80 + index * 150} animKey={focusKey} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(app)/events/new')}
      >
        <Ionicons name="add" size={28} color="rgba(200,220,255,0.95)" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070818' },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(140,170,255,0.15)',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#dce8ff' },
  subtitle: { fontSize: 14, color: 'rgba(150,175,220,0.45)' },

  list: { paddingTop: 12, paddingBottom: 100 },

  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(12,20,60,0.85)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140,170,255,0.18)',
  },
  cardPressed: { opacity: 0.7 },
  cardBar: { width: 4 },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#dce8ff', marginBottom: 3 },
  cardDate: { fontSize: 13, color: 'rgba(180,210,255,0.8)', marginBottom: 5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  cardTime: { fontSize: 13, color: 'rgba(150,175,220,0.55)' },
  dot: { fontSize: 13, color: 'rgba(140,170,255,0.3)' },
  cardLoc: { fontSize: 13, color: 'rgba(150,175,220,0.55)', flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  tagText: { fontSize: 12, fontWeight: '500' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: 'rgba(150,175,220,0.4)', marginBottom: 8 },
  emptyAction: { fontSize: 15, color: 'rgba(180,210,255,0.7)', fontWeight: '500' },
  error: { color: '#e05555', padding: 20, textAlign: 'center' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: 'rgba(25,55,140,0.8)',
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,160,255,0.4)',
  },
})
