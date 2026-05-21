import { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { MemberSchedule, getSpaceSchedules, getScheduleSignedUrl } from '@/lib/schedules'

export default function ProfileScreen() {
  const { user, displayName, signOut } = useAuth()
  const { space } = useSpace()
  const [schedule, setSchedule] = useState<MemberSchedule | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [viewerUri, setViewerUri] = useState<string | null>(null)

  useEffect(() => {
    if (!space || !user) return
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

  const formattedDate = schedule
    ? new Date(schedule.updated_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <Text style={s.title}>Profil</Text>
        <Pressable onPress={() => router.push('/(app)/profile/edit')} hitSlop={8}>
          <Text style={s.editLink}>Modifier</Text>
        </Pressable>
      </View>

      <View style={s.section}>
        <Text style={s.label}>PSEUDO</Text>
        <Text style={s.value}>{displayName}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.label}>EMAIL</Text>
        <Text style={s.value}>{user?.email}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.label}>MON EMPLOI DU TEMPS</Text>
        {schedule ? (
          <Pressable
            style={s.scheduleCard}
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
              <View style={s.scheduleDocPlaceholder}>
                <Ionicons name="document-text-outline" size={32} color="#999" />
              </View>
            )}
            <View style={s.scheduleFooter}>
              <Text style={s.scheduleDate}>Mis à jour le {formattedDate}</Text>
              <Ionicons name="expand-outline" size={14} color="#aaa" />
            </View>
          </Pressable>
        ) : (
          <Text style={s.empty}>Aucun emploi du temps enregistré</Text>
        )}
      </View>

      <Pressable style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutText}>Se déconnecter</Text>
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

const BLUE = '#2563EB'

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  editLink: { fontSize: 16, color: BLUE },

  section: { paddingHorizontal: 20, marginBottom: 28 },
  label: {
    fontSize: 11, fontWeight: '600', color: '#999',
    letterSpacing: 0.5, marginBottom: 6,
  },
  value: { fontSize: 16, color: '#111' },
  empty: { fontSize: 14, color: '#bbb' },

  scheduleCard: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, overflow: 'hidden',
  },
  scheduleImage: { width: '100%', height: 200 },
  scheduleDocPlaceholder: {
    height: 120, backgroundColor: '#f9f9f9',
    justifyContent: 'center', alignItems: 'center',
  },
  scheduleFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  scheduleDate: { fontSize: 12, color: '#999' },

  signOutBtn: {
    marginHorizontal: 20, marginTop: 8,
    borderWidth: 1, borderColor: '#f0f0f0',
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  signOutText: { color: '#dc2626', fontSize: 15 },

  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: { position: 'absolute', top: 56, right: 20, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },
})
