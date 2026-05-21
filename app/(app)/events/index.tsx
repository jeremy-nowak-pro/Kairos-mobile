import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Animated, Easing,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
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

function EventCard({ event, delay }: { event: Event; delay: number }) {
  const color = userColor(event.assigned_to)
  const anim = useRef(new Animated.Value(0)).current

  const slideAnim = useRef(new Animated.Value(0)).current
  const translateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [260, 0] })

  useEffect(() => {
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
  }, [])

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
          <Ionicons name="time-outline" size={12} color="#aaa" />
          <Text style={styles.cardTime}>
            {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </Text>
          {event.location ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="location-outline" size={12} color="#aaa" />
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
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!space) return
      if (events.length === 0) setLoading(true)
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

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} />
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
          renderItem={({ item, index }) => <EventCard event={item} delay={80 + index * 150} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(app)/events/new')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d1d6',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#999' },

  list: { paddingTop: 16, paddingBottom: 100 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d1d6',
  },
  cardPressed: { opacity: 0.75 },
  cardBar: { width: 4 },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 3 },
  cardDate: { fontSize: 13, color: BLUE, marginBottom: 5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  cardTime: { fontSize: 13, color: '#666' },
  dot: { fontSize: 13, color: '#ccc' },
  cardLoc: { fontSize: 13, color: '#666', flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  tagText: { fontSize: 12, fontWeight: '500' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#999', marginBottom: 8 },
  emptyAction: { fontSize: 15, color: BLUE, fontWeight: '500' },
  error: { color: '#dc2626', padding: 20, textAlign: 'center' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: BLUE,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
})
