import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getEvent, Event } from '@/lib/events'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getEvent(id)
      .then(setEvent)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Événement introuvable</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Retour</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={styles.createdBy}>{event.created_by}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.date}>{formatDate(event.date)}</Text>

        <View style={styles.row}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.rowText}>
            {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </Text>
        </View>

        {event.location ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.rowText}>{event.location}</Text>
          </View>
        ) : null}

        {event.assigned_to ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ASSIGNÉ À</Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{event.assigned_to}</Text>
            </View>
          </View>
        ) : null}

        {event.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: { padding: 4 },
  createdBy: { fontSize: 13, color: '#999' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 6 },
  date: { fontSize: 15, color: BLUE, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  rowText: { fontSize: 15, color: '#444' },
  section: { marginTop: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#999',
    letterSpacing: 0.5, marginBottom: 8,
  },
  tag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tagText: { fontSize: 13, color: BLUE },
  description: { fontSize: 15, color: '#444', lineHeight: 22 },
  notFound: { fontSize: 16, color: '#999', marginBottom: 12 },
  back: { fontSize: 15, color: BLUE },
})
