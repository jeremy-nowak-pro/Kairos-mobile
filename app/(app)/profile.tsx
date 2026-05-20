import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useAuth } from '@/context/auth'

export default function ProfileScreen() {
  const { user, displayName, signOut, updateDisplayName } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(displayName ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { error } = await updateDisplayName(name.trim())
    setLoading(false)
    if (error) setError(error)
    else setEditing(false)
  }

  return (
    <View style={styles.container}>
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

      <Pressable style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </Pressable>
    </View>
  )
}

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
  editLink: { fontSize: 14, color: '#2563EB' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#111',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  cancelText: { color: '#999', fontSize: 14 },
  error: { color: '#dc2626', fontSize: 13, marginTop: 6 },
  signOutBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  signOutText: { color: '#dc2626', fontSize: 15 },
})
