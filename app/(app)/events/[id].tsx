import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, Alert, Modal, FlatList, Animated, Dimensions, Easing,
} from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getEvent, deleteEvent, Event } from '@/lib/events'
import { getAttachments, Attachment } from '@/lib/attachments'
import { getImageUrl } from '@/lib/imageCache'
import { userColor } from '@/lib/userColor'

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>
}

function InfoRow({ icon, children, last }: {
  icon: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <>
      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon as any} size={17} color="rgba(150,175,220,0.6)" />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  )
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [docs, setDocs] = useState<Attachment[]>([])
  const [viewerUri, setViewerUri] = useState<string | null>(null)

  const screenWidth = Dimensions.get('window').width
  const translateX = useRef(new Animated.Value(0)).current
  const contentAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!event) return
    contentAnim.setValue(0)
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [event?.id])

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  )

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      if (nativeEvent.translationX > screenWidth * 0.35 || nativeEvent.velocityX > 500) {
        Animated.timing(translateX, {
          toValue: screenWidth,
          duration: 180,
          useNativeDriver: true,
        }).start(() => router.back())
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 20,
        }).start()
      }
    }
  }

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
          imgs.map(a => getImageUrl(a.storage_path).catch(() => null))
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
      const url = await getImageUrl(att.storage_path)
      const { default: WebBrowser } = await import('expo-web-browser')
      await WebBrowser.openBrowserAsync(url)
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier')
    }
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color="rgba(150,175,220,0.6)" /></View>
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Événement introuvable</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Retour</Text>
        </Pressable>
      </View>
    )
  }

  const color = userColor(event.assigned_to)

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-9999, 10]}
      failOffsetY={[-20, 20]}
    >
    <Animated.View style={[styles.shadow, { transform: [{ translateX }] }]}>
      <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="rgba(180,210,255,0.8)" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push(`/(app)/events/edit/${event.id}`)} hitSlop={8}>
            <Text style={styles.editLink}>Modifier</Text>
          </Pressable>
        </View>

        <Animated.View style={{
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}>

        <View style={[styles.titleCard, { borderLeftColor: color.text }]}>
          <Text style={styles.title}>{event.title}</Text>
        </View>

        <View style={styles.content}>

          <SectionCard>
            <InfoRow icon="calendar-outline">
              <Text style={styles.infoText}>{formatDate(event.date)}</Text>
            </InfoRow>
            <InfoRow icon="time-outline" last>
              <Text style={styles.infoText}>
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </Text>
            </InfoRow>
          </SectionCard>

          {event.location ? (
            <SectionCard>
              <InfoRow icon="location-outline" last>
                <Text style={styles.infoText}>{event.location}</Text>
              </InfoRow>
            </SectionCard>
          ) : null}

          {event.assigned_to ? (
            <>
              <Text style={styles.groupLabel}>ASSIGNÉ À</Text>
              <SectionCard>
                <InfoRow icon="person-outline" last>
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
                </InfoRow>
              </SectionCard>
            </>
          ) : null}

          {event.description ? (
            <>
              <Text style={styles.groupLabel}>DESCRIPTION</Text>
              <SectionCard>
                <View style={styles.descRow}>
                  <Text style={styles.descText}>{event.description}</Text>
                </View>
              </SectionCard>
            </>
          ) : null}

          {imageUrls.length > 0 && (
            imageUrls.length === 1 ? (
              <Pressable onPress={() => setViewerUri(imageUrls[0])} style={styles.imageSingleWrap}>
                <Image source={{ uri: imageUrls[0] }} style={styles.imageSingle} contentFit="cover" />
              </Pressable>
            ) : (
              <FlatList
                horizontal
                data={imageUrls.slice(0, 4)}
                keyExtractor={(_, i) => String(i)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageStripContent}
                style={styles.imageStrip}
                renderItem={({ item: uri }) => (
                  <Pressable onPress={() => setViewerUri(uri)}>
                    <Image source={{ uri }} style={styles.imageStripThumb} contentFit="cover" />
                  </Pressable>
                )}
              />
            )
          )}

          {docs.length > 0 && (
            <>
              <Text style={styles.groupLabel}>PIÈCES JOINTES</Text>
              <SectionCard>
                {docs.map((att, i) => (
                  <View key={att.id}>
                    <Pressable
                      style={({ pressed }) => [styles.docRow, pressed && { opacity: 0.6 }]}
                      onPress={() => openDoc(att)}
                    >
                      <View style={styles.docIcon}>
                        <Ionicons
                          name={att.mime_type === 'application/pdf' ? 'document-text-outline' : 'document-outline'}
                          size={18} color="rgba(150,175,220,0.6)"
                        />
                      </View>
                      <Text style={styles.docName} numberOfLines={1}>{att.filename}</Text>
                      <Ionicons name="chevron-forward" size={16} color="rgba(140,170,255,0.3)" />
                    </Pressable>
                    {i < docs.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                ))}
              </SectionCard>
            </>
          )}

          <View style={styles.deleteSection}>
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color="#e05555" />
              <Text style={styles.deleteBtnText}>Supprimer l'événement</Text>
            </Pressable>
          </View>

        </View>
        </Animated.View>
      </ScrollView>

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

      </View>
    </Animated.View>
    </PanGestureHandler>
  )
}

const styles = StyleSheet.create({
  shadow: {
    flex: 1,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  container: { flex: 1, backgroundColor: 'transparent', borderTopLeftRadius: 14, overflow: 'hidden' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  notFound: { fontSize: 16, color: 'rgba(150,175,220,0.45)', marginBottom: 12 },
  backLink: { fontSize: 15, color: 'rgba(180,210,255,0.7)' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  editLink: { fontSize: 16, color: 'rgba(180,210,255,0.8)' },

  titleCard: {
    backgroundColor: 'rgba(12,20,60,0.85)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderLeftWidth: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140,170,255,0.18)',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#dce8ff', lineHeight: 30 },

  content: { paddingHorizontal: 16, paddingTop: 4 },

  sectionCard: {
    backgroundColor: 'rgba(12,20,60,0.85)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140,170,255,0.18)',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16, gap: 12,
  },
  infoIcon: {
    width: 30, height: 30, borderRadius: 7,
    backgroundColor: 'rgba(15,28,80,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  infoText: { fontSize: 15, color: '#dce8ff' },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(140,170,255,0.12)',
    marginLeft: 58,
  },

  groupLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(150,175,220,0.45)',
    letterSpacing: 0.8, marginBottom: 8, marginLeft: 4,
  },

  imageSingleWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  imageSingle: { width: '100%', height: 220 },
  imageStrip: { marginBottom: 12 },
  imageStripContent: { gap: 8 },
  imageStripThumb: { width: 160, height: 160, borderRadius: 10 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
  tagText: { fontSize: 13, fontWeight: '500' },

  descRow: { paddingHorizontal: 16, paddingVertical: 14 },
  descText: { fontSize: 15, color: 'rgba(180,210,255,0.8)', lineHeight: 22 },

  docRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, gap: 12,
  },
  docIcon: {
    width: 34, height: 34, borderRadius: 7,
    backgroundColor: 'rgba(15,28,80,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  docName: { flex: 1, fontSize: 14, color: '#dce8ff' },

  deleteSection: {
    marginTop: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(140,170,255,0.12)',
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 18,
  },
  deleteBtnText: { fontSize: 15, color: '#e05555' },

  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
  },
})
