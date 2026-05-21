import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getLocations, deleteLocation } from '@/lib/locations'

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function LocationInput({ value, onChange }: Props) {
  const [all, setAll] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    getLocations().then(setAll).catch(() => {})
  }, [])

  const filter = (text: string, list: string[]) =>
    text.length >= 1
      ? list.filter(l => l.toLowerCase().includes(text.toLowerCase())).slice(0, 6)
      : list.slice(0, 6)

  const handleChange = (text: string) => {
    onChange(text)
    setSuggestions(filter(text, all))
  }

  const handleFocus = () => {
    setSuggestions(filter(value, all))
  }

  const handleBlur = () => {
    setTimeout(() => setSuggestions([]), 150)
  }

  const apply = (loc: string) => {
    onChange(loc)
    setSuggestions([])
  }

  const remove = async (loc: string) => {
    const next = all.filter(l => l !== loc)
    setAll(next)
    setSuggestions(suggestions.filter(l => l !== loc))
    await deleteLocation(loc)
  }

  return (
    <View>
      <TextInput
        style={s.input}
        placeholder="Adresse, Zoom, téléphone..."
        placeholderTextColor="#999"
        value={value}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map((loc, i) => (
            <View
              key={loc}
              style={[s.row, i < suggestions.length - 1 && s.rowBorder]}
            >
              <Pressable style={s.rowMain} onPress={() => apply(loc)}>
                <Ionicons name="location-outline" size={14} color="#999" />
                <Text style={s.locText} numberOfLines={1}>{loc}</Text>
              </Pressable>
              <Pressable onPress={() => remove(loc)} hitSlop={10} style={s.deleteBtn}>
                <Ionicons name="close" size={15} color="#ccc" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8,
    padding: 12, fontSize: 16, color: '#111', backgroundColor: '#fafafa',
  },
  dropdown: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8,
    backgroundColor: '#fff', marginTop: 4, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 11,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  locText: { fontSize: 14, color: '#333', flex: 1 },
  deleteBtn: { paddingLeft: 8 },
})
