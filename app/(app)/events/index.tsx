import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSpace } from '@/context/space'
import { getUpcomingEvents, Event } from '@/lib/events'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function EventCard({ event }: { event: Event }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/(app)/events/${event.id}`)}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.cardCreator}>{event.created_by}</Text>
      </View>
      <Text style={styles.cardDate}>{formatDate(event.date)}</Text>
      <Text style={styles.cardTime}>
        {formatTime(event.start_time)} – {formatTime(event.end_time)}
      </Text>
      {event.location ? (
        <Text style={styles.cardLocation}>· {event.location}</Text>
      ) : null}
      {event.assigned_to ? (
        <View style={styles.tagRow}>
          {event.assigned_to.split(',').map(name => name.trim()).filter(Boolean).map(name => (
            <View key={name} style={styles.tag}>
              <Text style={styles.tagText}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
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
      setLoading(true)
      getUpcomingEvents(space.id)
        .then(setEvents)
        .catch(() => setError('Impossible de charger les événements'))
        .finally(() => setLoading(false))
    }, [space])
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Événements</Text>
          {!loading && (
            <Text style={styles.subtitle}>{events.length} à venir</Text>
          )}
        </View>
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
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
  },
  cardPressed: { backgroundColor: '#f5f5f5' },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111', flex: 1, marginRight: 8 },
  cardCreator: { fontSize: 12, color: '#999' },
  cardDate: { fontSize: 13, color: BLUE, marginBottom: 2 },
  cardTime: { fontSize: 13, color: '#555', marginBottom: 2 },
  cardLocation: { fontSize: 13, color: '#666', marginBottom: 4 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { fontSize: 12, color: BLUE },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#999', marginBottom: 8 },
  emptyAction: { fontSize: 15, color: BLUE, fontWeight: '500' },
  error: { color: '#dc2626', padding: 20, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: BLUE,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
})
