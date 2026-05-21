import { useCallback, useEffect, useState } from 'react'
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
import { getEvent, updateEvent } from '@/lib/events'
import { getSpaceMembers, SpaceMember } from '@/lib/spaces'
import { upsertLocation } from '@/lib/locations'
import { MemberSchedule, getSpaceSchedules, getScheduleSignedUrl } from '@/lib/schedules'
import CalendarPicker from '@/components/CalendarPicker'
import TimePicker from '@/components/TimePicker'
import AttachmentSection from '@/components/AttachmentSection'
import LocationInput from '@/components/LocationInput'

function parseTimeInput(input: string): string | null {
  const match = input.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, h, m] = match
  if (parseInt(h) > 23 || parseInt(m) > 59) return null
  return `${h}:${m}:00`
}

function formatDisplayDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { displayName } = useAuth()
  const { space } = useSpace()

  const [loaded, setLoaded] = useState(false)
  const [eventId, setEventId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [startPickerOpen, setStartPickerOpen] = useState(false)
  const [endPickerOpen, setEndPickerOpen] = useState(false)
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [schedules, setSchedules] = useState<Record<string, MemberSchedule>>({})
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleViewerUri, setScheduleViewerUri] = useState<string | null>(null)
  const [scheduleLoadingId, setScheduleLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getEvent(id).then(event => {
      if (!event) { router.back(); return }
      setEventId(event.id)
      setTitle(event.title)
      setDate(event.date)
      setStartTime(event.start_time.slice(0, 5))
      setEndTime(event.end_time.slice(0, 5))
      setLocation(event.location ?? '')
      setDescription(event.description ?? '')
      setSelectedMembers(
        event.assigned_to?.split(',').map(s => s.trim()).filter(Boolean) ?? []
      )
      setLoaded(true)
    }).catch(() => router.back())
  }, [id])

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
    getSpaceMembers().then(setMembers).catch(() => {})
  }, [])

  const toggleMember = (name: string) => {
    setSelectedMembers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const handleSave = async () => {
    if (!space || !eventId) return
    setError(null)
    const parsedStart = parseTimeInput(startTime)
    const parsedEnd = parseTimeInput(endTime)
    if (!title.trim()) { setError('Le titre est requis'); return }
    if (!date) { setError('La date est requise'); return }
    if (!parsedStart) { setError('Heure de début invalide — format HH:MM'); return }
    if (!parsedEnd) { setError('Heure de fin invalide — format HH:MM'); return }
    if (selectedMembers.length === 0) { setError('Assigne l\'événement à au moins une personne'); return }

    setSaving(true)
    try {
      const trimmedLocation = location.trim()
      await updateEvent(eventId, {
        title: title.trim(),
        date,
        start_time: parsedStart,
        end_time: parsedEnd,
        location: trimmedLocation || null,
        description: description.trim() || null,
        assigned_to: selectedMembers.join(','),
      })
      if (trimmedLocation) upsertLocation(trimmedLocation).catch(() => {})
      router.back()
    } catch {
      setError('Une erreur est survenue')
    }
    setSaving(false)
  }

  if (!loaded) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator />
      </View>
    )
  }

  const createdBy = displayName ?? 'moi'

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancel}>Annuler</Text>
          </Pressable>
          <Text style={styles.title}>Modifier</Text>
          <View style={{ width: 64 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>TITRE *</Text>
          <TextInput
            style={styles.input}
            placeholder="Réunion, anniversaire, sortie..."
            placeholderTextColor="#999"
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
            <Ionicons name="calendar-outline" size={15} color={BLUE} />
            <Text style={styles.scheduleBtnText}>Consulter les emplois du temps</Text>
          </Pressable>

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Notes, ordre du jour..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          {space && (
            <View style={styles.attachmentSection}>
              <AttachmentSection
                mode="saved"
                eventId={eventId}
                spaceId={space.id}
                createdBy={createdBy}
              />
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Enregistrer</Text>
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
              const s = schedules[m.user_id]
              return (
                <View key={m.user_id} style={styles.sheetRow}>
                  <Text style={styles.sheetMemberName}>{m.display_name}</Text>
                  {s ? (
                    <Pressable
                      style={styles.sheetViewBtn}
                      disabled={scheduleLoadingId === m.user_id}
                      onPress={async () => {
                        setScheduleLoadingId(m.user_id)
                        try {
                          const url = await getScheduleSignedUrl(s.storage_path)
                          if (s.mime_type?.startsWith('image/')) {
                            setScheduleViewerUri(url)
                          } else {
                            await WebBrowser.openBrowserAsync(url)
                          }
                        } catch {
                          Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier')
                        }
                        setScheduleLoadingId(null)
                      }}
                    >
                      {scheduleLoadingId === m.user_id
                        ? <ActivityIndicator size="small" color={BLUE} />
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
            <Image
              source={{ uri: scheduleViewerUri }}
              style={styles.viewerImage}
              contentFit="contain"
            />
            <Pressable style={styles.viewerClose} onPress={() => setScheduleViewerUri(null)}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </KeyboardAvoidingView>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  cancel: { color: BLUE, fontSize: 16, width: 64 },
  title: { fontSize: 18, fontWeight: '600', color: '#111' },
  form: { padding: 20 },
  label: {
    fontSize: 11, fontWeight: '600', color: '#999',
    letterSpacing: 0.5, marginBottom: 6, marginTop: 16,
  },
  input: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8,
    padding: 12, fontSize: 16, color: '#111', backgroundColor: '#fafafa',
  },
  dateButton: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8,
    padding: 12, backgroundColor: '#fafafa',
  },
  dateText: { fontSize: 16, color: '#111' },
  datePlaceholder: { fontSize: 16, color: '#999' },
  textarea: { height: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  memberRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  memberBtn: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  memberBtnActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  memberBtnText: { fontSize: 15, color: '#555' },
  memberBtnTextActive: { fontSize: 15, color: BLUE, fontWeight: '600' },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, marginBottom: 4,
  },
  scheduleBtnText: { fontSize: 13, color: BLUE },
  attachmentSection: {
    marginTop: 20, borderTopWidth: 1,
    borderTopColor: '#e5e5e5', paddingTop: 16,
  },
  error: { color: '#dc2626', fontSize: 14, marginTop: 12 },
  button: {
    backgroundColor: BLUE, borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, paddingBottom: 40,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 16 },
  sheetEmpty: { fontSize: 14, color: '#999', marginBottom: 16 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  sheetMemberName: { fontSize: 16, color: '#111', fontWeight: '500' },
  sheetViewBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 7, minWidth: 60, alignItems: 'center',
  },
  sheetViewBtnText: { fontSize: 14, color: BLUE, fontWeight: '600' },
  sheetNoSchedule: { fontSize: 14, color: '#bbb' },
  sheetClose: { marginTop: 16, padding: 12, alignItems: 'center' },
  sheetCloseText: { fontSize: 16, color: '#666' },
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
