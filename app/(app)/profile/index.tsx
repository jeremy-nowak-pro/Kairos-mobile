import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, Share, ActivityIndicator, Animated,
} from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { SpaceMember, getSpaceMembers } from '@/lib/spaces'
import { MemberSchedule, getSpaceSchedules, getScheduleSignedUrl } from '@/lib/schedules'
import GlassCard from '@/components/GlassCard'
import { userColor } from '@/lib/userColor'
import { supabase } from '@/lib/supabase'
import { exportMyData } from '@/lib/export'

const THUMB_SIZE = 48

function SlideToSignOut({ onConfirm }: { onConfirm: () => void }) {
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
      <View
        style={s.slideTrack}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[StyleSheet.absoluteFill, s.slideFill, { opacity: fillOpacity }]} />
        <Animated.Text style={[s.slideLabel, { opacity: labelOpacity }]}>
          Glisser pour se déconnecter
        </Animated.Text>
      </View>
      {trackWidth > 0 && (
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetX={[-9999, 5]}
          failOffsetY={[-10, 10]}
        >
          <Animated.View style={[s.slideThumbHit, { transform: [{ translateX: clampedX }] }]}>
            <View style={s.slideThumb}>
              <Ionicons name="log-out-outline" size={20} color="#ffffff" />
            </View>
          </Animated.View>
        </PanGestureHandler>
      )}
    </View>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const color = userColor(name)
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color.bg }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.36, color: color.text }]}>
        {initials(name)}
      </Text>
    </View>
  )
}

export default function ProfileScreen() {
  const { user, displayName, signOut } = useAuth()
  const { space } = useSpace()

  const [members, setMembers] = useState<SpaceMember[]>([])
  const [schedule, setSchedule] = useState<MemberSchedule | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [viewerUri, setViewerUri] = useState<string | null>(null)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!space || !user) return

    getSpaceMembers()
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoadingMembers(false))

    getSpaceSchedules(space.id)
      .then(async all => {
        const mine = all.find(s => s.user_id === user.id) ?? null
        setSchedule(mine)
        if (mine?.mime_type?.startsWith('image/')) {
          const url = await getScheduleSignedUrl(mine.storage_path).catch(() => null)
          setPreviewUri(url)
        }
      })
      .catch(() => {})
  }, [space?.id, user?.id])

  const handleExport = async () => {
    if (!user || !space) return
    setExporting(true)
    try {
      await exportMyData(user.id, space.id)
    } catch {
      Alert.alert('Erreur', 'Impossible de générer l\'export.')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Toutes tes données seront définitivement effacées : profil, messages, emploi du temps. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Confirmer la suppression',
              'Es-tu sûr ? Ton compte sera supprimé immédiatement.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer définitivement',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true)
                    try {
                      const { error } = await supabase.functions.invoke('delete-account')
                      if (error) throw error
                      await signOut()
                    } catch {
                      Alert.alert('Erreur', 'Impossible de supprimer le compte. Réessaie.')
                    } finally {
                      setDeletingAccount(false)
                    }
                  },
                },
              ],
            ),
        },
      ],
    )
  }

  const handleShareCode = () => {
    if (!space) return
    Share.share({
      message: `Rejoins mon espace Kairos avec le code : ${space.invite_code}`,
    })
  }

  const formattedDate = schedule
    ? new Date(schedule.updated_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const name = displayName ?? user?.email ?? '?'

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}>

      <View style={s.header}>
        <Text style={s.headerTitle}>Profil</Text>
        <Pressable style={s.editBtn} onPress={() => router.push('/(app)/profile/edit')} hitSlop={8}>
          <Ionicons name="pencil-outline" size={18} color="rgba(255,255,255,0.80)" />
        </Pressable>
      </View>

      <View style={s.hero}>
        <Text style={s.heroName}>{name}</Text>
        <Text style={s.heroEmail}>{user?.email}</Text>
      </View>

      <GlassCard style={s.card} contentStyle={s.cardContent}>
        <Text style={s.cardLabel}>MON ESPACE</Text>
        <Text style={s.spaceName}>{space?.name ?? '—'}</Text>

        <View style={s.divider} />

        <Text style={s.sectionLabel}>Membres</Text>
        {loadingMembers ? (
          <ActivityIndicator style={{ marginVertical: 12 }} color="rgba(255,255,255,0.80)" />
        ) : (
          <View style={s.membersList}>
            {members.map(m => (
              <View key={m.user_id} style={s.memberRow}>
                <Avatar name={m.display_name} size={36} />
                <View style={s.memberInfo}>
                  <Text style={s.memberName}>{m.display_name}</Text>
                  {m.is_creator && <Text style={s.memberBadge}>Créateur</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={s.divider} />

        <Text style={s.sectionLabel}>Code d'invitation</Text>
        <Pressable style={s.inviteRow} onPress={handleShareCode}>
          <Text style={s.inviteCode}>{space?.invite_code ?? '—'}</Text>
          <View style={s.inviteShareBtn}>
            <Ionicons name="share-outline" size={15} color="rgba(255,255,255,0.85)" />
            <Text style={s.inviteShareText}>Partager</Text>
          </View>
        </Pressable>
      </GlassCard>

      <GlassCard style={s.card} contentStyle={s.cardContent}>
        <Text style={s.cardLabel}>MON EMPLOI DU TEMPS</Text>
        {schedule ? (
          <Pressable
            onPress={() => previewUri
              ? setViewerUri(previewUri)
              : getScheduleSignedUrl(schedule.storage_path)
                  .then(url => require('expo-web-browser').openBrowserAsync(url))
                  .catch(() => {})
            }
          >
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={s.scheduleImage} contentFit="cover" />
            ) : (
              <View style={s.scheduleDoc}>
                <Ionicons name="document-text-outline" size={28} color="rgba(255,255,255,0.70)" />
                <Text style={s.scheduleDocName} numberOfLines={1}>{schedule.filename}</Text>
              </View>
            )}
            <View style={s.scheduleFooter}>
              <Text style={s.scheduleDate}>Mis à jour le {formattedDate}</Text>
              <Ionicons name="expand-outline" size={14} color="rgba(140,170,255,0.3)" />
            </View>
          </Pressable>
        ) : (
          <Pressable style={s.scheduleEmpty} onPress={() => router.push('/(app)/profile/edit')}>
            <Ionicons name="add-circle-outline" size={20} color="rgba(255,255,255,0.55)" />
            <Text style={s.scheduleEmptyText}>Ajouter mon emploi du temps</Text>
          </Pressable>
        )}
      </GlassCard>

      <View style={s.slideContainer}>
        <SlideToSignOut onConfirm={signOut} />
      </View>

      <Pressable
        style={s.exportBtn}
        onPress={handleExport}
        disabled={exporting}
      >
        {exporting
          ? <ActivityIndicator size="small" color="rgba(255,255,255,0.55)" />
          : (
            <>
              <Ionicons name="download-outline" size={15} color="rgba(255,255,255,0.55)" />
              <Text style={s.exportBtnText}>Exporter mes données</Text>
            </>
          )
        }
      </Pressable>

      <Pressable
        style={s.deleteAccountBtn}
        onPress={handleDeleteAccount}
        disabled={deletingAccount}
      >
        {deletingAccount
          ? <ActivityIndicator size="small" color="rgba(224,85,85,0.7)" />
          : <Text style={s.deleteAccountText}>Supprimer mon compte</Text>
        }
      </Pressable>

      <Pressable style={s.privacyLink} onPress={() => router.push('/(app)/privacy')}>
        <Text style={s.privacyLinkText}>Politique de confidentialité</Text>
      </Pressable>

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
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.30)',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.38)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },

  hero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 14,
    gap: 4,
  },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700' },
  heroName: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  heroEmail: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },

  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardContent: { padding: 16 },
  cardLabel: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  spaceName: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 10,
  },
  membersList: { gap: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, color: '#ffffff' },
  memberBadge: {
    fontSize: 10, color: 'rgba(180,210,255,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140,170,255,0.3)',
    borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  inviteCode: {
    fontSize: 22, fontWeight: '300', letterSpacing: 4,
    color: '#ffffff',
  },
  inviteShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inviteShareText: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  scheduleImage: { width: '100%', height: 180, borderRadius: 8, marginBottom: 8 },
  scheduleDoc: {
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scheduleDocName: { fontSize: 14, color: 'rgba(255,255,255,0.80)', maxWidth: '60%' },
  scheduleFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  scheduleDate: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  scheduleEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, justifyContent: 'center',
  },
  scheduleEmptyText: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },


  slideContainer: {
    marginHorizontal: 16, marginTop: 8,
  },
  slideZone: {
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
  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: { position: 'absolute', top: 56, right: 20, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  exportBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
  },
  deleteAccountBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 4,
  },
  deleteAccountText: {
    fontSize: 13,
    color: 'rgba(224,85,85,0.7)',
  },
  privacyLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
  },
  privacyLinkText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.30)',
    textDecorationLine: 'underline',
  },
})
