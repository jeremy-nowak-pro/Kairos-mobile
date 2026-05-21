import { useCallback, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, Alert, Modal,
} from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getEvent, deleteEvent, Event } from '@/lib/events'
import { getAttachments, getSignedUrl, Attachment } from '@/lib/attachments'
import { userColor } from '@/lib/userColor'

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
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
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [docs, setDocs] = useState<Attachment[]>([])
  const [viewerUri, setViewerUri] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    if (!id) return
    setLoading(true)
    getEvent(id)
      .then(setEvent)
      .finally(() => setLoading(false))

    getAttachments(id)
      .then(async atts => {
        const imgs = atts.filter(a => a.mime_type?.startsWith('image/'))
        const nonImgs = atts.filter(a => !a.mime_type?.startsWith('image/'))
        setDocs(nonImgs)
        const urls = await Promise.all(
          imgs.map(a => getSignedUrl(a.storage_path).catch(() => null))
        )
        setImageUrls(urls.filter((u): u is string => u !== null))
      })
      .catch(() => {})
  }, [id]))

  const handleDelete = () => {
    if (!event) return
    Alert.alert('Supprimer', 'Supprimer cet événement ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(event.id)
            router.back()
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer l\'événement')
          }
        },
      },
    ])
  }

  const openDoc = async (att: Attachment) => {
    try {
      const url = await getSignedUrl(att.storage_path)
      const { default: WebBrowser } = await import('expo-web-browser')
      await WebBrowser.openBrowserAsync(url)
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier')
    }
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator /></View>
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

  const color = userColor(event.assigned_to)
  const hasImages = imageUrls.length > 0
  const hasDocs = docs.length > 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push(`/(app)/events/edit/${event.id}`)} hitSlop={8}>
          <Text style={styles.editLink}>Modifier</Text>
        </Pressable>
      </View>

      <View style={[styles.colorBar, { backgroundColor: color.text }]} />

      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>

        {/* Date/heure — miniature à droite si une seule image */}
        <View style={imageUrls.length === 1 ? styles.mainRow : undefined}>
          <View style={imageUrls.length === 1 ? styles.dateTimeCol : undefined}>
            <Text style={styles.date}>{formatDate(event.date)}</Text>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={15} color="#888" />
              <Text style={styles.timeText}>
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </Text>
            </View>
          </View>

          {imageUrls.length === 1 && (
            <Pressable onPress={() => setViewerUri(imageUrls[0])}>
              <Image source={{ uri: imageUrls[0] }} style={styles.thumb} contentFit="cover" />
            </Pressable>
          )}
        </View>

        {/* Plusieurs images : grille centrée sous la date/heure */}
        {imageUrls.length > 1 && (
          <View style={styles.thumbRow}>
            {imageUrls.slice(0, 4).map((uri, i) => (
              <Pressable key={i} onPress={() => setViewerUri(uri)}>
                <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {event.location ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={15} color="#888" />
            <Text style={styles.rowText}>{event.location}</Text>
          </View>
        ) : null}

        {event.assigned_to ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ASSIGNÉ À</Text>
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
          </View>
        ) : null}

        {event.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        ) : null}

        {hasDocs && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PIÈCES JOINTES</Text>
            {docs.map(att => (
              <Pressable
                key={att.id}
                style={({ pressed }) => [styles.docRow, pressed && { opacity: 0.6 }]}
                onPress={() => openDoc(att)}
              >
                <View style={styles.docIcon}>
                  <Ionicons
                    name={att.mime_type === 'application/pdf' ? 'document-text-outline' : 'document-outline'}
                    size={18}
                    color="#666"
                  />
                </View>
                <Text style={styles.docName} numberOfLines={1}>{att.filename}</Text>
                <Ionicons name="chevron-forward" size={14} color="#ccc" />
              </Pressable>
            ))}
          </View>
        )}

        <Pressable onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Supprimer l'événement</Text>
        </Pressable>
      </View>

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
    </ScrollView>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  backButton: { padding: 4 },
  editLink: { fontSize: 16, color: BLUE },
  colorBar: { height: 4 },
  content: { padding: 20 },

  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 12 },

  mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  dateTimeCol: { flex: 1 },
  date: { fontSize: 15, color: BLUE, marginBottom: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { fontSize: 14, color: '#555' },

  thumbCol: {},
  thumbRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginTop: 12,
  },
  thumb: { width: 88, height: 88, borderRadius: 10 },
  thumbMore: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  thumbMoreText: { fontSize: 14, color: '#666', fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginTop: 16, marginBottom: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  rowText: { fontSize: 14, color: '#444', flex: 1 },

  section: { marginTop: 18 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#999',
    letterSpacing: 0.5, marginBottom: 8,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  tagText: { fontSize: 13 },
  description: { fontSize: 15, color: '#444', lineHeight: 22 },

  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  docIcon: {
    width: 34, height: 34, borderRadius: 6,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  docName: { flex: 1, fontSize: 14, color: '#333' },

  deleteBtn: {
    marginTop: 40, borderTopWidth: 1, borderTopColor: '#f0f0f0',
    paddingTop: 20, alignItems: 'center',
  },
  deleteBtnText: { fontSize: 16, color: '#dc2626' },

  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
  },

  notFound: { fontSize: 16, color: '#999', marginBottom: 12 },
  back: { fontSize: 15, color: BLUE },
})
