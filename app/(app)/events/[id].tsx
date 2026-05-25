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
import { BlurView } from 'expo-blur'
import MeshBackground from '@/components/MeshBackground'

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <BlurView intensity={22} tint="light" style={styles.sectionCard}>{children}</BlurView>
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
          <Ionicons name={icon as any} size={17} color="rgba(255,255,255,0.80)" />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  )
}

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
    <View style={styles.slideZone}>
      <View
        style={styles.slideTrack}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.slideFill, { opacity: fillOpacity }]} />
        <Animated.Text style={[styles.slideLabel, { opacity: labelOpacity }]}>
          Glisser pour supprimer
        </Animated.Text>
      </View>
      {trackWidth > 0 && (
        <PanGestureHandler
          ref={gestureRef}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetX={[-9999, 5]}
          failOffsetY={[-10, 10]}
        >
          <Animated.View style={[styles.slideThumbHit, { transform: [{ translateX: clampedX }] }]}>
            <View style={styles.slideThumb}>
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
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 13,
    }).start()
  }, [])

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (isAnimatingOut.current) return
      e.preventDefault()
      isAnimatingOut.current = true
      Animated.timing(translateX, {
        toValue: screenWidth,
        duration: 220,
        useNativeDriver: true,
      }).start(() => navigation.dispatch(e.data.action))
    })
    return unsubscribe
  }, [navigation])

  useEffect(() => {
    if (!event || hasAnimated.current) return
    hasAnimated.current = true
    Animated.spring(contentAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start()
  }, [event?.id])

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  )

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      if (nativeEvent.translationX > screenWidth * 0.35 || nativeEvent.velocityX > 500) {
        isAnimatingOut.current = true
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

  const handleSlideConfirm = useCallback(() => {
    setCountdown(3)
    setShowToast(true)
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    countdownRef.current = setInterval(() => {
      setCountdown(c => c - 1)
    }, 1000)
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

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color="rgba(255,255,255,0.80)" /></View>
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
    <>
    <Stack.Screen options={{ animation: 'none' }} />
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-9999, 10]}
      failOffsetY={[-20, 20]}
      waitFor={[slideGestureRef]}
    >
    <Animated.View style={[styles.shadow, { transform: [{ translateX }] }]}>
      <View style={styles.container}>
      <MeshBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.92)" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push(`/(app)/events/edit/${event.id}`)} hitSlop={8}>
            <Text style={styles.editLink}>Modifier</Text>
          </Pressable>
        </View>

        <Animated.View style={{ opacity: contentAnim }}>

        <BlurView intensity={22} tint="light" style={[styles.titleCard, { borderLeftColor: color.text }]}>
          <Text style={styles.title}>{event.title}</Text>
        </BlurView>

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
                        <View key={name} style={[styles.tag, { backgroundColor: c.text, borderColor: c.text }]}>
                          <Text style={styles.tagText}>{name}</Text>
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
                          size={18} color="rgba(255,255,255,0.80)"
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

          <SlideToDelete
            key={slideKey}
            gestureRef={slideGestureRef}
            onConfirm={handleSlideConfirm}
          />

        </View>
        </Animated.View>
      </ScrollView>

      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="box-none">
          <Text style={styles.toastText}>Suppression dans {countdown}s…</Text>
          <Pressable onPress={handleUndoDelete} hitSlop={8} pointerEvents="auto">
            <Text style={styles.toastUndo}>Annuler</Text>
          </Pressable>
        </Animated.View>
      )}

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
    </>
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
  container: { flex: 1, backgroundColor: '#1a0e30', borderTopLeftRadius: 14, overflow: 'hidden' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  backLink: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  editLink: { fontSize: 16, color: 'rgba(255,255,255,0.92)' },

  titleCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderLeftWidth: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#ffffff', lineHeight: 30 },

  content: { paddingHorizontal: 16, paddingTop: 4 },

  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16, gap: 12,
  },
  infoIcon: {
    width: 30, height: 30, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.38)',
    justifyContent: 'center', alignItems: 'center',
  },
  infoText: { fontSize: 15, color: '#ffffff' },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginLeft: 58,
  },

  groupLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8, marginBottom: 8, marginLeft: 4,
  },

  imageSingleWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  imageSingle: { width: '100%', height: 220 },
  imageStrip: { marginBottom: 12 },
  imageStripContent: { gap: 8 },
  imageStripThumb: { width: 160, height: 160, borderRadius: 10 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },

  descRow: { paddingHorizontal: 16, paddingVertical: 14 },
  descText: { fontSize: 15, color: 'rgba(255,255,255,0.92)', lineHeight: 22 },

  docRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, gap: 12,
  },
  docIcon: {
    width: 34, height: 34, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.38)',
    justifyContent: 'center', alignItems: 'center',
  },
  docName: { flex: 1, fontSize: 14, color: '#ffffff' },

  slideZone: {
    marginTop: 32, marginBottom: 8,
    height: 90,
    justifyContent: 'center',
  },
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
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
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
