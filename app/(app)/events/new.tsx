import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { createEvent } from '@/lib/events'

function parseDateInput(input: string): string | null {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  const date = new Date(`${y}-${m}-${d}`)
  if (isNaN(date.getTime())) return null
  return `${y}-${m}-${d}`
}

function parseTimeInput(input: string): string | null {
  const match = input.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, h, m] = match
  if (parseInt(h) > 23 || parseInt(m) > 59) return null
  return `${h}:${m}:00`
}

function autoFormatDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function autoFormatTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export default function NewEventScreen() {
  const { user } = useAuth()
  const { space } = useSpace()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createdBy = user?.email?.split('@')[0] ?? 'moi'

  const handleCreate = async () => {
    if (!space) return
    setError(null)

    const parsedDate = parseDateInput(date)
    const parsedStart = parseTimeInput(startTime)
    const parsedEnd = parseTimeInput(endTime)

    if (!title.trim()) { setError('Le titre est requis'); return }
    if (!parsedDate) { setError('Date invalide — format JJ/MM/AAAA'); return }
    if (!parsedStart) { setError('Heure de début invalide — format HH:MM'); return }
    if (!parsedEnd) { setError('Heure de fin invalide — format HH:MM'); return }

    setLoading(true)
    try {
      await createEvent({
        title: title.trim(),
        date: parsedDate,
        start_time: parsedStart,
        end_time: parsedEnd,
        location: location.trim() || null,
        description: description.trim() || null,
        assigned_to: createdBy,
        created_by: createdBy,
        space_id: space.id,
      })
      router.back()
    } catch {
      setError('Une erreur est survenue')
    }
    setLoading(false)
  }

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
          <Text style={styles.title}>Nouvel événement</Text>
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
          <TextInput
            style={styles.input}
            placeholder="JJ/MM/AAAA"
            placeholderTextColor="#999"
            value={date}
            onChangeText={t => setDate(autoFormatDate(t))}
            keyboardType="numeric"
            maxLength={10}
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>DÉBUT *</Text>
              <TextInput
                style={styles.input}
                placeholder="09:00"
                placeholderTextColor="#999"
                value={startTime}
                onChangeText={t => setStartTime(autoFormatTime(t))}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>FIN *</Text>
              <TextInput
                style={styles.input}
                placeholder="10:00"
                placeholderTextColor="#999"
                value={endTime}
                onChangeText={t => setEndTime(autoFormatTime(t))}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          <Text style={styles.label}>LIEU</Text>
          <TextInput
            style={styles.input}
            placeholder="Adresse, Zoom, téléphone..."
            placeholderTextColor="#999"
            value={location}
            onChangeText={setLocation}
          />

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

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} onPress={handleCreate} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>+ Créer l'événement</Text>
            }
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const BLUE = '#2563EB'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  cancel: { color: BLUE, fontSize: 16, width: 64 },
  title: { fontSize: 18, fontWeight: '600', color: '#111' },
  form: { padding: 20 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  textarea: { height: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  button: {
    backgroundColor: BLUE,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', fontSize: 14, marginTop: 12 },
})
