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

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Profil</Text>
        <Pressable style={s.editBtn} onPress={() => router.push('/(app)/profile/edit')} hitSlop={8}>
          <Ionicons name="pencil-outline" size={18} color="#555" />
        </Pressable>
      </View>

      {/* Hero */}
      <View style={s.hero}>
        <Avatar name={name} size={80} />
        <Text style={s.heroName}>{name}</Text>
        <Text style={s.heroEmail}>{user?.email}</Text>
      </View>

      {/* Espace */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardLabel}>MON ESPACE</Text>
        </View>
        <Text style={s.spaceName}>{space?.name ?? '—'}</Text>

        <View style={s.divider} />

        <Text style={s.membersLabel}>Membres</Text>
        {loadingMembers ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
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

        <Text style={s.membersLabel}>Code d'invitation</Text>
        <Pressable style={s.inviteRow} onPress={handleShareCode}>
          <Text style={s.inviteCode}>{space?.invite_code ?? '—'}</Text>
          <View style={s.inviteShareBtn}>
            <Ionicons name="share-outline" size={15} color="#2563EB" />
            <Text style={s.inviteShareText}>Partager</Text>
          </View>
        </Pressable>
      </View>

      {/* Emploi du temps */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardLabel}>MON EMPLOI DU TEMPS</Text>
        </View>
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
                <Ionicons name="document-text-outline" size={28} color="#999" />
                <Text style={s.scheduleDocName} numberOfLines={1}>{schedule.filename}</Text>
              </View>
            )}
            <View style={s.scheduleFooter}>
              <Text style={s.scheduleDate}>Mis à jour le {formattedDate}</Text>
              <Ionicons name="expand-outline" size={14} color="#bbb" />
            </View>
          </Pressable>
        ) : (
          <Pressable style={s.scheduleEmpty} onPress={() => router.push('/(app)/profile/edit')}>
            <Ionicons name="add-circle-outline" size={20} color="#bbb" />
            <Text style={s.scheduleEmptyText}>Ajouter mon emploi du temps</Text>
          </Pressable>
        )}
      </View>

      {/* Déconnexion */}
      <Pressable style={s.signOutBtn} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        <Text style={s.signOutText}>Se déconnecter</Text>
      </Pressable>

      {/* Modal notification */}
      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.notifBackdrop} onPress={() => setNotifOpen(false)}>
            <Pressable style={s.notifSheet} onPress={() => {}}>
              <View style={s.sheetHandle} />
              <Text style={s.notifTitle}>Message à l'espace</Text>
              <Text style={s.notifSubtitle}>
                Tous les membres de {space?.name ?? 'l\'espace'} recevront une notification.
              </Text>
              <TextInput
                ref={notifInputRef}
                style={s.notifInput}
                placeholder="Tape ton message..."
                placeholderTextColor="#aaa"
                value={notifMessage}
                onChangeText={setNotifMessage}
                multiline
                autoFocus
                maxLength={200}
                returnKeyType="send"
              />
              <Text style={s.notifCount}>{notifMessage.length}/200</Text>
              <Pressable
                style={[s.notifSendBtn, !notifMessage.trim() && s.notifSendBtnDisabled]}
                onPress={handleSendNotification}
                disabled={!notifMessage.trim() || notifSending}
              >
                {notifSending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.notifSendBtnText}>Envoyer</Text>
                }
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Viewer plein écran */}
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
  container: { flex: 1, backgroundColor: '#f2f2f7' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#111' },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e5ea',
    justifyContent: 'center',
    alignItems: 'center',
  },

  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700' },
  heroName: { fontSize: 22, fontWeight: '700', color: '#111', marginTop: 4 },
  heroEmail: { fontSize: 14, color: '#888' },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
  },
  spaceName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e5ea',
    marginHorizontal: 16,
  },
  membersLabel: {
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  membersList: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 15, color: '#111', fontWeight: '500' },
  memberBadge: {
    fontSize: 11,
    color: '#888',
    backgroundColor: '#f2f2f7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  inviteShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteShareText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },

  scheduleImage: { width: '100%', height: 180 },
  scheduleDoc: {
    height: 90,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scheduleDocName: { fontSize: 14, color: '#666', maxWidth: '60%' },
  scheduleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  scheduleDate: { fontSize: 12, color: '#999' },
  scheduleEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  scheduleEmptyText: { fontSize: 14, color: '#bbb' },

  notifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
  },
  notifBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  notifBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  notifSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  notifTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4 },
  notifSubtitle: { fontSize: 14, color: '#888', marginBottom: 16 },
  notifInput: {
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111',
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#fafafa',
  },
  notifCount: { fontSize: 12, color: '#bbb', textAlign: 'right', marginTop: 6, marginBottom: 16 },
  notifSendBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  notifSendBtnDisabled: { opacity: 0.4 },
  notifSendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  signOutText: { fontSize: 15, color: '#dc2626', fontWeight: '500' },

  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
})
