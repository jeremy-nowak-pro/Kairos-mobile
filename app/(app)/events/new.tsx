import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
  Modal, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { createEvent } from '@/lib/events'
import { getSpaceMembers, SpaceMember } from '@/lib/spaces'
import { uploadAttachment, LocalFile } from '@/lib/attachments'
import { MemberSchedule, getSpaceSchedules, getScheduleSignedUrl } from '@/lib/schedules'
import { upsertLocation } from '@/lib/locations'
import CalendarPicker from '@/components/CalendarPicker'
import TimePicker from '@/components/TimePicker'
import AttachmentSection from '@/components/AttachmentSection'
import LocationInput from '@/components/LocationInput'
import MeshBackground from '@/components/MeshBackground'

function parseTimeInput(input: string): string | null {
  const match = input.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, h, m] = match
  if (parseInt(h) > 23 || parseInt(m) > 59) return null
  return `${h}:${m}:00`
}

function formatDisplayDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function NewEventScreen() {
  const { displayName } = useAuth()
  const { space } = useSpace()
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string | null>(dateParam ?? null)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [startPickerOpen, setStartPickerOpen] = useState(false)
  const [endPickerOpen, setEndPickerOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<LocalFile[]>([])
  const [schedules, setSchedules] = useState<Record<string, MemberSchedule>>({})
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleViewerUri, setScheduleViewerUri] = useState<string | null>(null)
  const [scheduleLoadingId, setScheduleLoadingId] = useState<string | null>(null)
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    displayName ? [displayName] : []
  )

  useEffect(() => {
    if (space) {
      getSpaceSchedules(space.id)
        .then(all => {
          const map: Record<string, MemberSchedule> = {}
          all.forEach(s => { map[s.user_id] = s })
          setSchedules(map)
        })
        .catch(() => {})
    }
  }, [space?.id])

  useEffect(() => {
    getSpaceMembers()
      .then(m => {
        setMembers(m)
        const me = m.find(member => member.display_name === displayName)
        if (me) setSelectedMembers([me.display_name])
      })
      .catch(() => {
        if (displayName) setSelectedMembers([displayName])
      })
  }, [displayName])

  const toggleMember = (name: string) => {
    setSelectedMembers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const createdBy = displayName ?? 'moi'

  const handleCreate = async () => {
    if (!space) return
    setError(null)
    const parsedStart = parseTimeInput(startTime)
    const parsedEnd = parseTimeInput(endTime)
    if (!title.trim()) { setError('Le titre est requis'); return }
    if (!date) { setError('La date est requise'); return }
    if (!parsedStart) { setError('Heure de début invalide — format HH:MM'); return }
    if (!parsedEnd) { setError('Heure de fin invalide — format HH:MM'); return }
    if (selectedMembers.length === 0) { setError("Assigne l'événement à au moins une personne"); return }
    setLoading(true)
    try {
      const trimmedLocation = location.trim()
      const event = await createEvent({
        title: title.trim(), date,
        start_time: parsedStart, end_time: parsedEnd,
        location: trimmedLocation || null,
        description: description.trim() || null,
        assigned_to: selectedMembers.join(','),
        created_by: createdBy,
        space_id: space.id,
      })
      await Promise.all([
        ...pendingFiles.map(f => uploadAttachment(f, event.id, space.id, createdBy)),
        trimmedLocation ? upsertLocation(trimmedLocation) : Promise.resolve(),
      ])
      router.back()
    } catch {
      setError('Une erreur est survenue')
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#1a0e30' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <MeshBackground />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancel}>Annuler</Text>
          </Pressable>
          <Text style={styles.title}>Nouvel événement</Text>
          <View style={{ width: 64 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>TITRE *</Text>
          <TextInput
            style={styles.input}
            placeholder="Réunion, anniversaire, sortie..."
            placeholderTextColor="rgba(100,75,130,0.45)"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>DATE *</Text>
          <Pressable style={styles.dateButton} onPress={() => setCalendarOpen(true)}>
            <Text style={date ? styles.dateText : styles.datePlaceholder}>
              {date ? formatDisplayDate(date) : 'Choisir une date'}
            </Text>
          </Pressable>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>DÉBUT *</Text>
              <Pressable style={styles.dateButton} onPress={() => setStartPickerOpen(true)}>
                <Text style={startTime ? styles.dateText : styles.datePlaceholder}>
                  {startTime || 'Choisir'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>FIN *</Text>
              <Pressable style={styles.dateButton} onPress={() => setEndPickerOpen(true)}>
                <Text style={endTime ? styles.dateText : styles.datePlaceholder}>
                  {endTime || 'Choisir'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.label}>LIEU</Text>
          <LocationInput value={location} onChange={setLocation} />

          <Text style={styles.label}>ASSIGNÉ À</Text>
          <View style={styles.memberRow}>
            {members.length === 0 ? (
              <View style={[styles.memberBtn, styles.memberBtnActive]}>
                <Text style={styles.memberBtnTextActive}>{createdBy}</Text>
              </View>
            ) : (
              members.map(m => {
                const active = selectedMembers.includes(m.display_name)
                return (
                  <Pressable
                    key={m.user_id}
                    style={[styles.memberBtn, active && styles.memberBtnActive]}
                    onPress={() => toggleMember(m.display_name)}
                  >
                    <Text style={[styles.memberBtnText, active && styles.memberBtnTextActive]}>
                      {m.display_name}
                    </Text>
                  </Pressable>
                )
              })
            )}
          </View>

          <Pressable style={styles.scheduleBtn} onPress={() => setScheduleModalOpen(true)}>
            <Ionicons name="calendar-outline" size={15} color="rgba(180,210,255,0.6)" />
            <Text style={styles.scheduleBtnText}>Consulter les emplois du temps</Text>
          </Pressable>

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Notes, ordre du jour..."
            placeholderTextColor="rgba(100,75,130,0.45)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <View style={styles.attachmentSection}>
            <AttachmentSection
              mode="pending"
              files={pendingFiles}
              onAdd={f => setPendingFiles(prev => [...prev, f])}
              onRemove={i => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} onPress={handleCreate} disabled={loading}>
            {loading
              ? <ActivityIndicator color="rgba(180,210,255,0.9)" />
              : <Text style={styles.buttonText}>+ Créer l'événement</Text>
            }
          </Pressable>
        </View>
      </ScrollView>

      <CalendarPicker
        visible={calendarOpen}
        value={date}
        onConfirm={setDate}
        onClose={() => setCalendarOpen(false)}
      />

      <TimePicker
        visible={startPickerOpen}
        value={startTime || null}
        title="Heure de début"
        onConfirm={time => {
          setStartTime(time)
          const [h, m] = time.split(':').map(Number)
          const total = h * 60 + m + 15
          const auto = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
          if (!endTime || endTime <= time) setEndTime(auto)
        }}
        onClose={() => setStartPickerOpen(false)}
      />

      <TimePicker
        visible={endPickerOpen}
        value={endTime || null}
        title="Heure de fin"
        onConfirm={setEndTime}
        onClose={() => setEndPickerOpen(false)}
      />

      <Modal
        visible={scheduleModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setScheduleModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Emplois du temps</Text>
            {members.length === 0 && (
              <Text style={styles.sheetEmpty}>Aucun membre dans l'espace</Text>
            )}
            {members.map(m => {
              const sc = schedules[m.user_id]
              return (
                <View key={m.user_id} style={styles.sheetRow}>
                  <Text style={styles.sheetMemberName}>{m.display_name}</Text>
                  {sc ? (
                    <Pressable
                      style={styles.sheetViewBtn}
                      disabled={scheduleLoadingId === m.user_id}
                      onPress={async () => {
                        setScheduleLoadingId(m.user_id)
                        try {
                          const url = await getScheduleSignedUrl(sc.storage_path)
                          if (sc.mime_type?.startsWith('image/')) {
                            setScheduleViewerUri(url)
                          } else {
                            await WebBrowser.openBrowserAsync(url)
                          }
                        } catch {
                          Alert.alert('Erreur', "Impossible d'ouvrir le fichier")
                        }
                        setScheduleLoadingId(null)
                      }}
                    >
                      {scheduleLoadingId === m.user_id
                        ? <ActivityIndicator size="small" color="rgba(110,55,180,0.85)" />
                        : <Text style={styles.sheetViewBtnText}>Voir</Text>
                      }
                    </Pressable>
                  ) : (
                    <Text style={styles.sheetNoSchedule}>Aucun</Text>
                  )}
                </View>
              )
            })}
            <Pressable style={styles.sheetClose} onPress={() => setScheduleModalOpen(false)}>
              <Text style={styles.sheetCloseText}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {scheduleViewerUri && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setScheduleViewerUri(null)}
        >
          <Pressable style={styles.viewerBackdrop} onPress={() => setScheduleViewerUri(null)}>
            <Image source={{ uri: scheduleViewerUri }} style={styles.viewerImage} contentFit="contain" />
            <Pressable style={styles.viewerClose} onPress={() => setScheduleViewerUri(null)}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.30)',
  },
  cancel: { color: 'rgba(110,55,180,0.75)', fontSize: 16, width: 64 },
  title: { fontSize: 18, fontWeight: '600', color: '#1e1a36' },
  form: { padding: 20 },
  label: {
    fontSize: 11, fontWeight: '600', color: 'rgba(50,35,80,0.65)',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
    borderRadius: 8,
    padding: 12, fontSize: 15, color: '#1e1a36',
  },
  dateButton: {
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
    borderRadius: 8,
    padding: 12,
  },
  dateText: { fontSize: 15, color: '#1e1a36' },
  datePlaceholder: { fontSize: 15, color: 'rgba(100,75,130,0.45)' },
  textarea: { height: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  memberRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  memberBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
    borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  memberBtnActive: {
    borderColor: 'rgba(120,160,255,0.5)',
    backgroundColor: 'rgba(110,55,180,0.70)',
  },
  memberBtnText: { fontSize: 14, color: 'rgba(50,35,80,0.55)' },
  memberBtnTextActive: { fontSize: 14, color: 'rgba(255,255,255,0.95)', fontWeight: '600' },
  button: {
    backgroundColor: 'rgba(110,55,180,0.70)',
    borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  buttonText: { color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 },
  attachmentSection: {
    marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 16,
  },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, marginBottom: 4,
  },
  scheduleBtnText: { fontSize: 13, color: 'rgba(180,210,255,0.6)' },
  error: { color: '#e05555', fontSize: 14, marginTop: 12 },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.40)',
    padding: 20, paddingBottom: 40,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1e1a36', marginBottom: 16 },
  sheetEmpty: { fontSize: 14, color: 'rgba(70,50,100,0.50)', marginBottom: 16 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(140,170,255,0.1)',
  },
  sheetMemberName: { fontSize: 16, color: '#1e1a36', fontWeight: '500' },
  sheetViewBtn: {
    backgroundColor: 'rgba(110,55,180,0.70)',
    borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7, minWidth: 60,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  sheetViewBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.95)', fontWeight: '600' },
  sheetNoSchedule: { fontSize: 14, color: 'rgba(70,50,100,0.45)' },
  sheetClose: { marginTop: 16, padding: 12, alignItems: 'center' },
  sheetCloseText: { fontSize: 16, color: 'rgba(50,35,80,0.60)' },

  viewerBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
  },
})
