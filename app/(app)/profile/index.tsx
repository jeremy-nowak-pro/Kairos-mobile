import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, Share, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { SpaceMember, getSpaceMembers } from '@/lib/spaces'
import { MemberSchedule, getSpaceSchedules, getScheduleSignedUrl } from '@/lib/schedules'
import { userColor } from '@/lib/userColor'
import { sendSpaceNotification } from '@/lib/notifications'

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
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifMessage, setNotifMessage] = useState('')
  const [notifSending, setNotifSending] = useState(false)
  const notifInputRef = useRef<TextInput>(null)

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

  const handleSendNotification = async () => {
    const msg = notifMessage.trim()
    if (!msg || !space || !user) return
    setNotifSending(true)
    try {
      await sendSpaceNotification(space.id, user.id, name, msg)
      setNotifMessage('')
      setNotifOpen(false)
    } catch {
      Alert.alert('Erreur', "L'envoi a échoué.")
    } finally {
      setNotifSending(false)
    }
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
          <Ionicons name="pencil-outline" size={18} color="rgba(50,35,80,0.70)" />
        </Pressable>
      </View>

      <View style={s.hero}>
        <Avatar name={name} size={80} />
        <Text style={s.heroName}>{name}</Text>
        <Text style={s.heroEmail}>{user?.email}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardLabel}>MON ESPACE</Text>
        <Text style={s.spaceName}>{space?.name ?? '—'}</Text>

        <View style={s.divider} />

        <Text style={s.sectionLabel}>Membres</Text>
        {loadingMembers ? (
          <ActivityIndicator style={{ marginVertical: 12 }} color="rgba(50,35,80,0.70)" />
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
            <Ionicons name="share-outline" size={15} color="rgba(110,55,180,0.75)" />
            <Text style={s.inviteShareText}>Partager</Text>
          </View>
        </Pressable>
      </View>

      <View style={s.card}>
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
                <Ionicons name="document-text-outline" size={28} color="rgba(50,35,80,0.60)" />
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
            <Ionicons name="add-circle-outline" size={20} color="rgba(70,50,100,0.50)" />
            <Text style={s.scheduleEmptyText}>Ajouter mon emploi du temps</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={s.notifBtn} onPress={() => setNotifOpen(true)}>
        <Ionicons name="notifications-outline" size={17} color="rgba(110,55,180,0.75)" />
        <Text style={s.notifBtnText}>Envoyer une notification</Text>
      </Pressable>

      <Pressable style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutText}>Se déconnecter</Text>
      </Pressable>

      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
        onShow={() => setTimeout(() => notifInputRef.current?.focus(), 100)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.notifBackdrop} onPress={() => setNotifOpen(false)}>
            <Pressable style={s.notifSheet} onPress={() => {}}>
              <Text style={s.notifSheetTitle}>Notification</Text>
              <TextInput
                ref={notifInputRef}
                style={s.notifInput}
                placeholder="Message à envoyer..."
                placeholderTextColor="rgba(100,75,130,0.45)"
                value={notifMessage}
                onChangeText={setNotifMessage}
                multiline
                returnKeyType="send"
              />
              <Pressable
                style={[s.notifSendBtn, (!notifMessage.trim() || notifSending) && s.notifSendBtnDisabled]}
                onPress={handleSendNotification}
                disabled={!notifMessage.trim() || notifSending}
              >
                {notifSending
                  ? <ActivityIndicator color="rgba(180,210,255,0.9)" />
                  : <Text style={s.notifSendBtnText}>Envoyer</Text>}
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

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
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#1e1a36' },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.60)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },

  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700' },
  heroName: { fontSize: 22, fontWeight: '700', color: '#1e1a36', marginTop: 4 },
  heroEmail: { fontSize: 14, color: 'rgba(50,35,80,0.65)' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  cardLabel: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(50,35,80,0.65)',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  spaceName: { fontSize: 18, fontWeight: '600', color: '#1e1a36', marginBottom: 4 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600',
    color: 'rgba(50,35,80,0.55)',
    marginBottom: 10,
  },
  membersList: { gap: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, color: '#1e1a36' },
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
    color: '#1e1a36',
  },
  inviteShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inviteShareText: { fontSize: 14, color: 'rgba(110,55,180,0.75)' },

  scheduleImage: { width: '100%', height: 180, borderRadius: 8, marginBottom: 8 },
  scheduleDoc: {
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scheduleDocName: { fontSize: 14, color: 'rgba(50,35,80,0.70)', maxWidth: '60%' },
  scheduleFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  scheduleDate: { fontSize: 12, color: 'rgba(70,50,100,0.50)' },
  scheduleEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, justifyContent: 'center',
  },
  scheduleEmptyText: { fontSize: 14, color: 'rgba(70,50,100,0.50)' },

  notifBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
    padding: 16,
  },
  notifBtnText: { fontSize: 15, color: 'rgba(110,55,180,0.75)' },

  signOutBtn: {
    marginHorizontal: 16, marginTop: 8,
    padding: 16, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224,85,85,0.3)',
    borderRadius: 14,
  },
  signOutText: { fontSize: 15, color: '#e05555' },

  notifBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  notifSheet: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.40)',
    padding: 20, paddingBottom: 40,
  },
  notifSheetTitle: {
    fontSize: 16, fontWeight: '600', color: '#1e1a36', marginBottom: 14,
  },
  notifInput: {
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1e1a36',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  notifSendBtn: {
    backgroundColor: 'rgba(110,55,180,0.70)',
    borderRadius: 10, padding: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  notifSendBtnDisabled: { opacity: 0.4 },
  notifSendBtnText: { color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: '500' },

  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: { position: 'absolute', top: 56, right: 20, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },
})
