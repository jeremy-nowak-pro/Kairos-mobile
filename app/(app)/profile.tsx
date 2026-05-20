import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { MemberSchedule, getSpaceSchedules, uploadSchedule, deleteSchedule, getScheduleSignedUrl } from '@/lib/schedules'
import { LocalFile } from '@/lib/attachments'

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

async function pickScheduleFile(): Promise<LocalFile | null> {
  return new Promise((resolve) => {
    Alert.alert('Emploi du temps', 'Choisir le type de fichier', [
      {
        text: 'Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Autorise l\'accès à la galerie dans les paramètres.')
            resolve(null)
            return
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          })
          if (result.canceled) { resolve(null); return }
          const asset = result.assets[0]
          resolve({
            uri: asset.uri,
            name: asset.uri.split('/').pop() ?? `edt_${Date.now()}.jpg`,
            mimeType: asset.mimeType ?? 'image/jpeg',
            size: asset.fileSize ?? null,
          })
        },
      },
      {
        text: 'Fichier (PDF)',
        onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
          if (result.canceled) { resolve(null); return }
          const asset = result.assets[0]
          resolve({
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType ?? null,
            size: asset.size ?? null,
          })
        },
      },
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
    ])
  })
}

export default function ProfileScreen() {
  const { user, displayName, signOut, updateDisplayName } = useAuth()
  const { space } = useSpace()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(displayName ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [schedule, setSchedule] = useState<MemberSchedule | null>(null)
  const [scheduleUploading, setScheduleUploading] = useState(false)
  const [viewerUri, setViewerUri] = useState<string | null>(null)

  useEffect(() => {
    if (!space || !user) return
    getSpaceSchedules(space.id)
      .then(all => setSchedule(all.find(s => s.user_id === user.id) ?? null))
      .catch(() => {})
  }, [space?.id, user?.id])

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { error } = await updateDisplayName(name.trim())
    setLoading(false)
    if (error) setError(error)
    else setEditing(false)
  }

  const handleUploadSchedule = async () => {
    if (!space || !user) return
    const file = await pickScheduleFile()
    if (!file) return
    setScheduleUploading(true)
    try {
      const s = await uploadSchedule(space.id, user.id, file)
      setSchedule(s)
    } catch {
      Alert.alert('Erreur', 'L\'upload a échoué')
    }
    setScheduleUploading(false)
  }

  const handleViewSchedule = async () => {
    if (!schedule) return
    try {
      const url = await getScheduleSignedUrl(schedule.storage_path)
      if (isImage(schedule.mime_type)) {
        setViewerUri(url)
      } else {
        await WebBrowser.openBrowserAsync(url)
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier')
    }
  }

  const handleDeleteSchedule = () => {
    if (!schedule) return
    Alert.alert('Supprimer', 'Supprimer ton emploi du temps ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteSchedule(schedule.id, schedule.storage_path)
            setSchedule(null)
          } catch {
            Alert.alert('Erreur', 'Suppression échouée')
          }
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Profil</Text>

      <View style={styles.section}>
        <Text style={styles.label}>PSEUDO</Text>
        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="none"
            />
            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>OK</Text>
              }
            </Pressable>
            <Pressable onPress={() => { setEditing(false); setName(displayName ?? '') }}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.valueRow} onPress={() => setEditing(true)}>
            <Text style={styles.value}>{displayName}</Text>
            <Text style={styles.editLink}>Modifier</Text>
          </Pressable>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>EMAIL</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>MON EMPLOI DU TEMPS</Text>
        {schedule ? (
          <View style={styles.scheduleRow}>
            <Ionicons
              name={isImage(schedule.mime_type) ? 'image-outline' : 'document-text-outline'}
              size={18} color="#666"
            />
            <Pressable style={{ flex: 1 }} onPress={handleViewSchedule}>
              <Text style={styles.scheduleFilename} numberOfLines={1}>{schedule.filename}</Text>
              <Text style={styles.scheduleDate}>
                Mis à jour le {new Date(schedule.updated_at).toLocaleDateString('fr-FR')}
              </Text>
            </Pressable>
            <Pressable onPress={handleUploadSchedule} disabled={scheduleUploading}>
              <Text style={styles.editLink}>Remplacer</Text>
            </Pressable>
            <Pressable onPress={handleDeleteSchedule} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#d1d5db" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.scheduleAddBtn}
            onPress={handleUploadSchedule}
            disabled={scheduleUploading}
          >
            {scheduleUploading
              ? <ActivityIndicator size="small" color={BLUE} />
              : <>
                  <Ionicons name="add" size={16} color={BLUE} />
                  <Text style={styles.scheduleAddText}>Ajouter mon emploi du temps</Text>
                </>
            }
          </Pressable>
        )}
      </View>

      <Pressable style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </Pressable>

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
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 },
  title: { fontSize: 26, fontWeight: '700', color: '#111', marginBottom: 32 },
  section: { marginBottom: 24 },
  label: {
    fontSize: 11, fontWeight: '600', color: '#999',
    letterSpacing: 0.5, marginBottom: 6,
  },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontSize: 16, color: '#111' },
  editLink: { fontSize: 14, color: BLUE },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, padding: 10, fontSize: 16, color: '#111',
  },
  saveBtn: {
    backgroundColor: BLUE, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  cancelText: { color: '#999', fontSize: 14 },
  error: { color: '#dc2626', fontSize: 13, marginTop: 6 },

  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8,
    padding: 12,
  },
  scheduleFilename: { fontSize: 14, color: '#111' },
  scheduleDate: { fontSize: 12, color: '#aaa', marginTop: 1 },
  scheduleAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#e5e5e5', borderStyle: 'dashed',
    borderRadius: 8, padding: 12,
  },
  scheduleAddText: { fontSize: 14, color: BLUE },

  signOutBtn: {
    marginTop: 8, borderWidth: 1, borderColor: '#e5e5e5',
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  signOutText: { color: '#dc2626', fontSize: 15 },

  viewerBackdrop: {
    flex: 1, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
  },
})
