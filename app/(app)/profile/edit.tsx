import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { MemberSchedule, getSpaceSchedules, uploadSchedule, deleteSchedule, getScheduleSignedUrl } from '@/lib/schedules'
import { LocalFile } from '@/lib/attachments'
import { useEffect } from 'react'

async function pickScheduleFile(): Promise<LocalFile | null> {
  return new Promise(resolve => {
    Alert.alert('Emploi du temps', 'Choisir le type de fichier', [
      {
        text: 'Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Autorise l\'accès à la galerie dans les paramètres.')
            resolve(null); return
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
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
          resolve({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null })
        },
      },
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
    ])
  })
}

export default function ProfileEditScreen() {
  const { user, displayName, updateDisplayName } = useAuth()
  const { space } = useSpace()

  const [name, setName] = useState(displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [schedule, setSchedule] = useState<MemberSchedule | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [scheduleUploading, setScheduleUploading] = useState(false)

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

  const handleSave = async () => {
    if (!name.trim()) { setError('Le pseudo est requis'); return }
    setSaving(true)
    const { error } = await updateDisplayName(name.trim())
    setSaving(false)
    if (error) { setError(error); return }
    router.back()
  }

  const handleReplaceSchedule = async () => {
    if (!space || !user) return
    const file = await pickScheduleFile()
    if (!file) return
    setScheduleUploading(true)
    try {
      const s = await uploadSchedule(space.id, user.id, file)
      setSchedule(s)
      if (s.mime_type?.startsWith('image/')) {
        const url = await getScheduleSignedUrl(s.storage_path).catch(() => null)
        setPreviewUri(url)
      } else {
        setPreviewUri(null)
      }
    } catch {
      Alert.alert('Erreur', 'L\'upload a échoué')
    }
    setScheduleUploading(false)
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
            setPreviewUri(null)
          } catch {
            Alert.alert('Erreur', 'Suppression échouée')
          }
        },
      },
    ])
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={s.cancel}>Annuler</Text>
        </Pressable>
        <Text style={s.title}>Modifier le profil</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={s.form}>
        <Text style={s.label}>PSEUDO</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={s.label}>EMAIL</Text>
        <Text style={s.emailValue}>{user?.email}</Text>

        <Text style={s.label}>MON EMPLOI DU TEMPS</Text>
        {schedule ? (
          <View style={s.scheduleCard}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={s.scheduleImage} contentFit="cover" />
            ) : (
              <View style={s.scheduleDocPlaceholder}>
                <Ionicons name="document-text-outline" size={32} color="#999" />
              </View>
            )}
            <View style={s.scheduleFooter}>
              <Text style={s.scheduleDate}>
                Mis à jour le {new Date(schedule.updated_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
              <View style={s.scheduleActions}>
                <Pressable onPress={handleReplaceSchedule} disabled={scheduleUploading} hitSlop={8}>
                  {scheduleUploading
                    ? <ActivityIndicator size="small" color={BLUE} />
                    : <Text style={s.replaceLink}>Remplacer</Text>
                  }
                </Pressable>
                <Pressable onPress={handleDeleteSchedule} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color="#d1d5db" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable style={s.scheduleAddBtn} onPress={handleReplaceSchedule} disabled={scheduleUploading}>
            {scheduleUploading
              ? <ActivityIndicator size="small" color={BLUE} />
              : <>
                  <Ionicons name="add" size={16} color={BLUE} />
                  <Text style={s.scheduleAddText}>Ajouter mon emploi du temps</Text>
                </>
            }
          </Pressable>
        )}

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Enregistrer</Text>
          }
        </Pressable>
      </View>
    </ScrollView>
  )
}

const BLUE = '#2563EB'

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  cancel: { color: BLUE, fontSize: 16, width: 64 },
  title: { fontSize: 17, fontWeight: '600', color: '#111' },

  form: { padding: 20 },
  label: {
    fontSize: 11, fontWeight: '600', color: '#999',
    letterSpacing: 0.5, marginBottom: 6, marginTop: 20,
  },
  input: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8,
    padding: 12, fontSize: 16, color: '#111', backgroundColor: '#fafafa',
  },
  emailValue: { fontSize: 16, color: '#bbb' },

  scheduleCard: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, overflow: 'hidden',
  },
  scheduleImage: { width: '100%', height: 180 },
  scheduleDocPlaceholder: {
    height: 100, backgroundColor: '#f9f9f9',
    justifyContent: 'center', alignItems: 'center',
  },
  scheduleFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  scheduleDate: { fontSize: 12, color: '#999', flex: 1 },
  scheduleActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  replaceLink: { fontSize: 14, color: BLUE },

  scheduleAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#e5e5e5', borderStyle: 'dashed',
    borderRadius: 8, padding: 12,
  },
  scheduleAddText: { fontSize: 14, color: BLUE },

  error: { color: '#dc2626', fontSize: 13, marginTop: 12 },
  saveBtn: {
    backgroundColor: BLUE, borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 32,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
