import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, Alert, Modal, FlatList, Animated, Dimensions,
} from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { router, useLocalSearchParams, useFocusEffect, Stack, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getEvent, deleteEvent, Event } from '@/lib/events'
import { getAttachments, Attachment } from '@/lib/attachments'
import { getImageUrl } from '@/lib/imageCache'
import { userColor } from '@/lib/userColor'
import MeshBackground from '@/components/MeshBackground'
import GlassCard from '@/components/GlassCard'

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function formatTime(t: string): string { return t.slice(0, 5) }

const THUMB_SIZE = 48

function SlideToDelete({ onConfirm, gestureRef }: {
  onConfirm: () => void
  gestureRef: React.RefObject<any>
}) {
  const [trackWidth, setTrackWidth] = useState(0)
  const dragX = useRef(new Animated.Value(0)).current
  const maxX = Math.max(trackWidth - THUMB_SIZE - 8, 1)

  const clampedX = dragX.interpolate({ inputRange: [0, maxX], outputRange: [0, maxX], extrapolate: 'clamp' })
  const labelOpacity = dragX.interpolate({ inputRange: [0, maxX * 0.4], outputRange: [1, 0], extrapolate: 'clamp' })
  const fillOpacity = dragX.interpolate({ inputRange: [0, maxX], outputRange: [0, 1], extrapolate: 'clamp' })
  const onGestureEvent = Animated.event([{ nativeEvent: { translationX: dragX } }], { useNativeDriver: true })

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      const x = Math.max(0, nativeEvent.translationX)
      if (x >= maxX * 0.85) {
        Animated.spring(dragX, { toValue: maxX, useNativeDriver: true, tension: 100, friction: 12 })
          .start(() => onConfirm())
      } else {
        Animated.spring(dragX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start()
      }
    }
  }

  return (
    <View style={s.slideZone}>
      <View style={s.slideTrack} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[StyleSheet.absoluteFill, s.slideFill, { opacity: fillOpacity }]} />
        <Animated.Text style={[s.slideLabel, { opacity: labelOpacity }]}>Glisser pour supprimer</Animated.Text>
      </View>
      {trackWidth > 0 && (
        <PanGestureHandler
          ref={gestureRef}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetX={[-9999, 5]}
          failOffsetY={[-10, 10]}
        >
          <Animated.View style={[s.slideThumbHit, { transform: [{ translateX: clampedX }] }]}>
            <View style={s.slideThumb}>
              <Ionicons name="trash-outline" size={20} color="#ffffff" />
            </View>
          </Animated.View>
        </PanGestureHandler>
      )}
    </View>
  )
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [docs, setDocs] = useState<Attachment[]>([])
  const [viewerUri, setViewerUri] = useState<string | null>(null)

  const navigation = useNavigation()
  const screenWidth = Dimensions.get('window').width
  const translateX = useRef(new Animated.Value(screenWidth)).current
  const contentAnim = useRef(new Animated.Value(0)).current
  const hasAnimated = useRef(false)
  const isAnimatingOut = useRef(false)

  const [slideKey, setSlideKey] = useState(0)
  const [showToast, setShowToast] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const toastOpacity = useRef(new Animated.Value(0)).current
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const slideGestureRef = useRef<any>(null)

  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  useEffect(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 68, friction: 13 }).start()
  }, [])

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (isAnimatingOut.current) return
      e.preventDefault()
      isAnimatingOut.current = true
      Animated.timing(translateX, { toValue: screenWidth, duration: 220, useNativeDriver: true })
        .start(() => navigation.dispatch(e.data.action))
    })
    return unsubscribe
  }, [navigation])

  useEffect(() => {
    if (!event || hasAnimated.current) return
    hasAnimated.current = true
    Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 12 }).start()
  }, [event?.id])

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }], { useNativeDriver: true }
  )

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      if (nativeEvent.translationX > screenWidth * 0.35 || nativeEvent.velocityX > 500) {
        isAnimatingOut.current = true
        Animated.timing(translateX, { toValue: screenWidth, duration: 180, useNativeDriver: true })
          .start(() => router.back())
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 20 }).start()
      }
    }
  }

  useFocusEffect(useCallback(() => {
    if (!id) return
    setLoading(true)
    getEvent(id).then(setEvent).finally(() => setLoading(false))
    getAttachments(id)
      .then(async atts => {
        const imgs = atts.filter(a => a.mime_type?.startsWith('image/'))
        setDocs(atts.filter(a => !a.mime_type?.startsWith('image/')))
        const urls = await Promise.all(imgs.map(a => getImageUrl(a.storage_path).catch(() => null)))
        setImageUrls(urls.filter((u): u is string => u !== null))
      })
      .catch(() => {})
  }, [id]))

  const handleSlideConfirm = useCallback(() => {
    setCountdown(3)
    setShowToast(true)
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    countdownRef.current = setInterval(() => setCountdown(c => c - 1), 1000)
    deleteTimerRef.current = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
      try {
        await deleteEvent(event!.id)
        router.back()
      } catch {
        Alert.alert('Erreur', 'Impossible de supprimer l\'événement')
        toastOpacity.setValue(0)
        setShowToast(false)
        setSlideKey(k => k + 1)
      }
    }, 3000)
  }, [event, toastOpacity])

  const handleUndoDelete = useCallback(() => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    Animated.timing(toastOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShowToast(false)
      setSlideKey(k => k + 1)
    })
  }, [toastOpacity])

  const openDoc = async (att: Attachment) => {
    try {
      const url = await getImageUrl(att.storage_path)
      const { default: WebBrowser } = await import('expo-web-browser')
      await WebBrowser.openBrowserAsync(url)
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier')
    }
  }

  if (loading) return <View style={s.centered}><ActivityIndicator color="rgba(255,255,255,0.80)" /></View>

  if (!event) return (
    <View style={s.centered}>
      <Text style={s.notFound}>Événement introuvable</Text>
      <Pressable onPress={() => router.back()}><Text style={s.backLink}>Retour</Text></Pressable>
    </View>
  )

  const color = userColor(event.assigned_to)
  const people = event.assigned_to
    ? event.assigned_to.split(',').map(n => n.trim()).filter(Boolean)
    : []

  return (
    <>
    <Stack.Screen options={{ animation: 'none' }} />
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-9999, 10]}
      failOffsetY={[-20, 20]}
      waitFor={[slideGestureRef]}
    >
    <Animated.View style={[s.shadow, { transform: [{ translateX }] }]}>
      <View style={s.container}>
        <MeshBackground />

        {/* Barre de navigation — toujours visible */}
        <View style={s.nav}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.92)" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push(`/(app)/events/edit/${event.id}`)} hitSlop={8}>
            <Text style={s.editLink}>Modifier</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
          <Animated.View style={{ opacity: contentAnim }}>

            {/* Bandeau couleur — identité visuelle de l'événement */}
            <View style={[s.colorBar, { backgroundColor: color.text }]} />

            {/* Titre */}
            <View style={s.titleBlock}>
              <Text style={s.title}>{event.title}</Text>
              <Text style={s.dateLabel}>{formatDate(event.date)}</Text>
            </View>

            {/* Card métadonnées : heure · lieu · personnes */}
            <GlassCard style={s.metaCard} contentStyle={s.metaContent}>
              <View style={s.metaRow}>
                <Ionicons name="time-outline" size={16} color="rgba(200,220,255,0.55)" />
                <Text style={s.metaText}>
                  {formatTime(event.start_time)} – {formatTime(event.end_time)}
                </Text>
              </View>

              {event.location ? (
                <>
                  <View style={s.metaDivider} />
                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={16} color="rgba(200,220,255,0.55)" />
                    <Text style={s.metaText}>{event.location}</Text>
                  </View>
                </>
              ) : null}

              {people.length > 0 ? (
                <>
                  <View style={s.metaDivider} />
                  <View style={s.metaRow}>
                    <Ionicons name="person-outline" size={16} color="rgba(200,220,255,0.55)" />
                    <View style={s.tagRow}>
                      {people.map(pname => {
                        const c = userColor(pname)
                        return (
                          <View key={pname} style={[s.tag, { backgroundColor: c.text }]}>
                            <Text style={s.tagText}>{pname}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                </>
              ) : null}

              {event.description ? (
                <>
                  <View style={s.metaDivider} />
                  <View style={s.descRow}>
                    <Text style={s.description}>{event.description}</Text>
                  </View>
                </>
              ) : null}
            </GlassCard>

            {/* Images */}
            {imageUrls.length > 0 && (
              imageUrls.length === 1 ? (
                <Pressable onPress={() => setViewerUri(imageUrls[0])} style={s.imageSingleWrap}>
                  <Image source={{ uri: imageUrls[0] }} style={s.imageSingle} contentFit="cover" />
                </Pressable>
              ) : (
                <FlatList
                  horizontal
                  data={imageUrls.slice(0, 4)}
                  keyExtractor={(_, i) => String(i)}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.imageStripContent}
                  style={s.imageStrip}
                  renderItem={({ item: uri }) => (
                    <Pressable onPress={() => setViewerUri(uri)}>
                      <Image source={{ uri }} style={s.imageThumb} contentFit="cover" />
                    </Pressable>
                  )}
                />
              )
            )}

            {/* Pièces jointes */}
            {docs.length > 0 && (
              <GlassCard style={s.docsCard} contentStyle={s.metaContent}>
                {docs.map((att, i) => (
                  <View key={att.id}>
                    {i > 0 && <View style={s.metaDivider} />}
                    <Pressable
                      style={({ pressed }) => [s.metaRow, pressed && { opacity: 0.6 }]}
                      onPress={() => openDoc(att)}
                    >
                      <Ionicons
                        name={att.mime_type === 'application/pdf' ? 'document-text-outline' : 'document-outline'}
                        size={16} color="rgba(200,220,255,0.55)"
                      />
                      <Text style={[s.metaText, { flex: 1 }]} numberOfLines={1}>{att.filename}</Text>
                      <Ionicons name="chevron-forward" size={14} color="rgba(140,170,255,0.3)" />
                    </Pressable>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Suppression */}
            <View style={s.deleteZone}>
              <SlideToDelete key={slideKey} gestureRef={slideGestureRef} onConfirm={handleSlideConfirm} />
            </View>

          </Animated.View>
        </ScrollView>

        {showToast && (
          <Animated.View style={[s.toast, { opacity: toastOpacity }]} pointerEvents="box-none">
            <Text style={s.toastText}>Suppression dans {countdown}s…</Text>
            <Pressable onPress={handleUndoDelete} hitSlop={8} pointerEvents="auto">
              <Text style={s.toastUndo}>Annuler</Text>
            </Pressable>
          </Animated.View>
        )}

        {viewerUri && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
            <Pressable style={s.viewerBackdrop} onPress={() => setViewerUri(null)}>
              <Image source={{ uri: viewerUri }} style={s.viewerImage} contentFit="contain" />
              <Pressable style={s.viewerClose} onPress={() => setViewerUri(null)}>
                <Ionicons name="close-circle" size={32} color="#fff" />
              </Pressable>
            </Pressable>
          </Modal>
        )}

      </View>
    </Animated.View>
    </PanGestureHandler>
    </>
  )
}

const s = StyleSheet.create({
  shadow: {
    flex: 1,
    borderTopLeftRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  container: { flex: 1, backgroundColor: '#1a0e30', borderTopLeftRadius: 14, overflow: 'hidden' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  backLink: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  editLink: { fontSize: 16, color: 'rgba(255,255,255,0.85)' },

  colorBar: { height: 5, width: '100%' },

  titleBlock: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28, fontWeight: '700',
    color: '#ffffff', lineHeight: 34,
    marginBottom: 6,
  },
  dateLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },

  metaCard: { marginHorizontal: 22, marginBottom: 22 },
  metaContent: { paddingVertical: 2 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 15, gap: 14,
  },
  metaDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: 18,
  },
  metaText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', flex: 1 },
  descRow: { paddingHorizontal: 18, paddingVertical: 16 },

  tagRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },

  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.60)',
    lineHeight: 24,
    paddingHorizontal: 22,
    marginBottom: 22,
  },

  imageSingleWrap: {
    marginHorizontal: 22, borderRadius: 14,
    overflow: 'hidden', marginBottom: 22,
  },
  imageSingle: { width: '100%', height: 220 },
  imageStrip: { marginBottom: 22 },
  imageStripContent: { paddingHorizontal: 22, gap: 10 },
  imageThumb: { width: 150, height: 150, borderRadius: 12 },

  docsCard: { marginHorizontal: 22, marginBottom: 22 },

  deleteZone: { paddingHorizontal: 22, marginTop: 8 },

  slideZone: { height: 90, justifyContent: 'center' },
  slideTrack: {
    height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  slideFill: { backgroundColor: 'rgba(200,40,40,0.85)', borderRadius: 28 },
  slideLabel: { fontSize: 14, color: 'rgba(255,255,255,0.40)', fontWeight: '500' },
  slideThumbHit: {
    position: 'absolute', left: 0, top: 0,
    width: THUMB_SIZE + 32, height: 90,
    justifyContent: 'center', alignItems: 'flex-start',
    paddingLeft: 4,
  },
  slideThumb: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    backgroundColor: 'rgba(200,40,40,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },

  toast: {
    position: 'absolute', bottom: 36, left: 20, right: 20,
    backgroundColor: 'rgba(8,16,48,0.92)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140,170,255,0.18)',
  },
  toastText: { color: 'rgba(220,232,255,0.85)', fontSize: 14 },
  toastUndo: { color: 'rgba(140,170,255,0.95)', fontSize: 14, fontWeight: '600' },

  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
  },
})
