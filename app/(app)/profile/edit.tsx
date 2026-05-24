import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
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

async function pickScheduleFile(): Promise<LocalFile | null> {
  return new Promise(resolve => {
    Alert.alert('Emploi du temps', 'Choisir le type de fichier', [
      {
        text: 'Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission refusée', "Autorise l'accès à la galerie dans les paramètres.")
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
      const updated = await uploadSchedule(space.id, user.id, file)
      setSchedule(updated)
      if (updated.mime_type?.startsWith('image/')) {
        const url = await getScheduleSignedUrl(updated.storage_path).catch(() => null)
        setPreviewUri(url)
      } else {
        setPreviewUri(null)
      }
    } catch {
      Alert.alert('Erreur', "L'upload a échoué")
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}>

        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.cancel}>Annuler</Text>
          </Pressable>
          <Text style={s.title}>Modifier le profil</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.92)" />
              : <Text style={s.done}>Enregistrer</Text>
            }
          </Pressable>
        </View>

        <View style={s.section}>
          <Text style={s.label}>PSEUDO</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={text => { setName(text); setError(null) }}
            placeholderTextColor="rgba(255,255,255,0.38)"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          {error && <Text style={s.error}>{error}</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.label}>EMAIL</Text>
          <Text style={s.staticValue}>{user?.email}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.label}>EMPLOI DU TEMPS</Text>
          {schedule ? (
            <View style={s.scheduleCard}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={s.scheduleImage} contentFit="cover" />
              ) : (
                <View style={s.scheduleDoc}>
                  <Ionicons name="document-text-outline" size={28} color="rgba(255,255,255,0.70)" />
                  <Text style={s.scheduleDocName} numberOfLines={1}>{schedule.filename}</Text>
                </View>
              )}
              <View style={s.scheduleFooter}>
                <Text style={s.scheduleDate}>
                  {new Date(schedule.updated_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </Text>
                <View style={s.scheduleActions}>
                  <Pressable onPress={handleReplaceSchedule} disabled={scheduleUploading} hitSlop={8}>
                    {scheduleUploading
                      ? <ActivityIndicator size="small" color="rgba(255,255,255,0.92)" />
                      : <Text style={s.replaceLink}>Remplacer</Text>
                    }
                  </Pressable>
                  <Pressable onPress={handleDeleteSchedule} hitSlop={8}>
                    <Ionicons name="trash-outline" size={17} color="rgba(224,85,85,0.6)" />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable style={s.scheduleAddBtn} onPress={handleReplaceSchedule} disabled={scheduleUploading}>
              {scheduleUploading
                ? <ActivityIndicator size="small" color="rgba(255,255,255,0.92)" />
                : <>
                    <Ionicons name="add-circle-outline" size={18} color="rgba(255,255,255,0.70)" />
                    <Text style={s.scheduleAddText}>Ajouter mon emploi du temps</Text>
                  </>
              }
            </Pressable>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  cancel: { color: 'rgba(255,255,255,0.65)', fontSize: 16, width: 80 },
  title: { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  done: { color: 'rgba(255,255,255,0.92)', fontSize: 16, fontWeight: '600', width: 80, textAlign: 'right' },

  section: {
    backgroundColor: 'rgba(60,25,90,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(200,160,255,0.20)',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
  },
  label: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  staticValue: { fontSize: 16, color: 'rgba(255,255,255,0.50)' },
  error: { color: '#e05555', fontSize: 13, marginTop: 8 },

  scheduleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.40)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  scheduleImage: { width: '100%', height: 180 },
  scheduleDoc: {
    height: 90,
    backgroundColor: 'rgba(255,255,255,0.38)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scheduleDocName: { fontSize: 14, color: 'rgba(255,255,255,0.80)', maxWidth: '60%' },
  scheduleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  scheduleDate: { fontSize: 12, color: 'rgba(255,255,255,0.55)', flex: 1 },
  scheduleActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  replaceLink: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  scheduleAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.40)',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 14,
    justifyContent: 'center',
  },
  scheduleAddText: { fontSize: 14, color: 'rgba(255,255,255,0.70)' },
})
