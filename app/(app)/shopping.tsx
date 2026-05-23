import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, TextInput, FlatList,
  ScrollView, Modal, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useSpace } from '@/context/space'
import { useAuth } from '@/context/auth'
import {
  ShoppingList, ShoppingItem,
  getLists, createList, deleteList,
  getItems, addItem, toggleItem, deleteItem,
  getStoreHistory, addToStoreHistory, removeFromStoreHistory,
  getPhotoUrl,
} from '@/lib/shopping'

const BLUE = '#2563EB'

// ── Helpers date ──────────────────────────────────────────────────────────────

function nextDays(n: number): { label: string; value: string }[] {
  const result = []
  const today = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const value = d.toISOString().split('T')[0]
    const label = i === 0 ? "Auj." : i === 1 ? "Dem."
      : d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').slice(0, 3) + '.'
    result.push({ label, value })
  }
  return result
}

function formatTabDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
    .replace('.', '').replace(/^./, c => c.toUpperCase())
}

const DATE_CHIPS = nextDays(6)

// ── AddListModal ──────────────────────────────────────────────────────────────

function AddListModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  onCreated: (list: ShoppingList) => void
}) {
  const [name, setName] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { space } = useSpace()
  const { user } = useAuth()

  useEffect(() => {
    if (visible) {
      setName('')
      setDate(null)
      setShowSuggestions(false)
      getStoreHistory().then(setHistory)
    }
  }, [visible])

  const filtered = name.trim().length > 0 && showSuggestions
    ? history.filter(s => s.toLowerCase().includes(name.toLowerCase()))
    : []

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed || !space || !user) return
    setLoading(true)
    try {
      const list = await createList(space.id, user.id, trimmed, date)
      await addToStoreHistory(trimmed)
      onCreated(list)
      onClose()
    } catch {
      Alert.alert('Erreur', 'Impossible de créer la liste.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveStore = async (store: string) => {
    await removeFromStoreHistory(store)
    setHistory(h => h.filter(s => s !== store))
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Nouveau magasin</Text>

            <View style={[styles.inputGroup, filtered.length > 0 && styles.inputGroupOpen]}>
              <TextInput
                style={styles.storeInput}
                placeholder="Lidl, Carrefour, Marché..."
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={text => { setName(text); setShowSuggestions(true) }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                onFocus={() => setShowSuggestions(true)}
              />
              {filtered.length > 0 && (
                <ScrollView scrollEnabled={false} keyboardShouldPersistTaps="always">
                  {filtered.map((store, i) => (
                    <View key={store} style={[styles.suggestionRow, i === 0 && styles.suggestionFirst]}>
                      <Pressable style={{ flex: 1 }} onPress={() => { setName(store); setShowSuggestions(false) }}>
                        <Text style={styles.suggestionText}>{store}</Text>
                      </Pressable>
                      <Pressable onPress={() => handleRemoveStore(store)} hitSlop={8}>
                        <Ionicons name="close" size={15} color="#ccc" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <Text style={styles.dateLabel}>Prévu pour</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.dateChips}
            >
              {DATE_CHIPS.map(chip => (
                <Pressable
                  key={chip.value}
                  style={[styles.dateChip, date === chip.value && styles.dateChipActive]}
                  onPress={() => setDate(d => d === chip.value ? null : chip.value)}
                >
                  <Text style={[styles.dateChipText, date === chip.value && styles.dateChipTextActive]}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Créer la liste</Text>
              }
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── TabItem ───────────────────────────────────────────────────────────────────

function TabItem({
  list,
  isActive,
  onPress,
  onDelete,
}: {
  list: ShoppingList
  isActive: boolean
  onPress: () => void
  onDelete: () => void
}) {
  const holdAnim = useRef(new Animated.Value(0)).current
  const activeAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const didDelete = useRef(false)

  const onDeleteRef = useRef(onDelete)
  const onPressRef = useRef(onPress)
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  useEffect(() => { onPressRef.current = onPress }, [onPress])

  useEffect(() => {
    Animated.timing(activeAnim, {
      toValue: isActive ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start()
  }, [isActive])

  const holdClamped = holdAnim.interpolate({ inputRange: [0, 0.25], outputRange: [0, 1], extrapolate: 'clamp' })
  const textColor = Animated.add(activeAnim, holdClamped).interpolate({
    inputRange: [0, 0.4, 10],
    outputRange: ['#555555', '#ffffff', '#ffffff'],
  })

  const handlePressIn = () => {
    didDelete.current = false
    animRef.current = Animated.timing(holdAnim, {
      toValue: 1,
      duration: 1400,
      useNativeDriver: false,
    })
    animRef.current.start(({ finished }) => {
      if (finished) {
        didDelete.current = true
        onDeleteRef.current()
      }
    })
  }

  const handlePressOut = () => {
    if (didDelete.current) return
    animRef.current?.stop()
    Animated.spring(holdAnim, { toValue: 0, useNativeDriver: false, speed: 24, bounciness: 4 }).start()
  }

  const handlePress = () => {
    if (didDelete.current) return
    onPressRef.current()
  }

  return (
    <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <View style={styles.tab}>
        <Animated.View style={[styles.tabFillActive, { opacity: activeAnim }]} />
        <Animated.View style={[styles.tabFillDelete, { opacity: holdAnim }]} />
        <Animated.Text style={[styles.tabText, { color: textColor }]}>
          {list.name}{list.date ? ` · ${formatTabDate(list.date)}` : ''}
        </Animated.Text>
      </View>
    </Pressable>
  )
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem
  onToggle: () => void
  onDelete: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.28, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 16, speed: 18 }),
    ]).start()
  }, [item.checked])

  return (
    <View style={styles.itemRow}>
      <Pressable style={styles.itemMain} onPress={onToggle}>
        <Animated.View style={[styles.circle, item.checked && styles.circleChecked, { transform: [{ scale: scaleAnim }] }]}>
          {item.checked && <Ionicons name="checkmark" size={13} color="#fff" />}
        </Animated.View>

        {item.image_path && (
          <Image source={{ uri: getPhotoUrl(item.image_path) }} style={styles.itemThumb} contentFit="cover" />
        )}

        <Text style={[styles.itemName, item.checked && styles.itemNameChecked]} numberOfLines={2}>
          {item.name}
        </Text>
      </Pressable>

      <Pressable onPress={onDelete} hitSlop={12} style={styles.deleteBtn}>
        <Ionicons name="close-circle" size={20} color="#d1d1d6" />
      </Pressable>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ShoppingScreen() {
  const { space } = useSpace()
  const { user } = useAuth()

  const [lists, setLists] = useState<ShoppingList[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [addListOpen, setAddListOpen] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)
  const [toastList, setToastList] = useState<ShoppingList | null>(null)
  const inputRef = useRef<TextInput>(null)
  const pendingDeleteRef = useRef<ShoppingList | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastOpacity = useRef(new Animated.Value(0)).current
  const contentAnim = useRef(new Animated.Value(1)).current

  useFocusEffect(
    useCallback(() => {
      if (!space) return
      getLists(space.id).then(l => {
        setLists(l)
        if (l.length > 0 && !activeId) setActiveId(l[0].id)
      })
    }, [space]),
  )

  useEffect(() => {
    if (!activeId) { setItems([]); return }
    contentAnim.setValue(0)
    setLoadingItems(true)
    getItems(activeId)
      .then(fetched => {
        setItems(fetched)
        Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start()
      })
      .finally(() => setLoadingItems(false))
  }, [activeId])

  const handleListCreated = (list: ShoppingList) => {
    setLists(l => [...l, list])
    setActiveId(list.id)
  }

  const handleDeleteList = (list: ShoppingList) => {
    if (pendingDeleteRef.current) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      deleteList(pendingDeleteRef.current.id, pendingDeleteRef.current.space_id)
      pendingDeleteRef.current = null
    }

    setLists(prev => prev.filter(l => l.id !== list.id))
    setActiveId(prev => {
      if (prev !== list.id) return prev
      const remaining = lists.filter(l => l.id !== list.id)
      return remaining[0]?.id ?? null
    })

    pendingDeleteRef.current = list
    deleteTimerRef.current = setTimeout(() => {
      if (pendingDeleteRef.current?.id === list.id) {
        deleteList(list.id, list.space_id)
        pendingDeleteRef.current = null
      }
    }, 4000)

    toastOpacity.setValue(0)
    setToastList(list)
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setToastList(null) })
  }

  const handleUndo = () => {
    if (!pendingDeleteRef.current) return
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    const list = pendingDeleteRef.current
    pendingDeleteRef.current = null
    setLists(prev => [...prev, list])
    setActiveId(list.id)
    Animated.timing(toastOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => setToastList(null),
    )
  }

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à la galerie dans les paramètres.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (!result.canceled) setPendingPhoto(result.assets[0].uri)
  }

  const handleAddItem = async () => {
    const name = newItemName.trim()
    if (!name || !activeId || !space) return
    const item = await addItem(activeId, space.id, name, pendingPhoto)
    setItems(prev => [item, ...prev])
    setNewItemName('')
    setPendingPhoto(null)
  }

  const handleToggle = async (item: ShoppingItem) => {
    const newChecked = !item.checked
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newChecked } : i))
    await toggleItem(item.list_id, item.id, newChecked)
  }

  const handleDeleteItem = async (item: ShoppingItem) => {
    setItems(prev => prev.filter(i => i.id !== item.id))
    await deleteItem(item.list_id, item.id)
  }

  const sorted = [...items.filter(i => !i.checked), ...items.filter(i => i.checked)]
  const activeList = lists.find(l => l.id === activeId)

  if (!space) return <ActivityIndicator style={{ flex: 1 }} />

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <Text style={styles.title}>Courses</Text>
      </View>

      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {lists.map(list => (
            <TabItem
              key={list.id}
              list={list}
              isActive={list.id === activeId}
              onPress={() => setActiveId(list.id)}
              onDelete={() => handleDeleteList(list)}
            />
          ))}
          <Pressable style={styles.tabAdd} onPress={() => setAddListOpen(true)}>
            <Ionicons name="add" size={20} color="#666" />
          </Pressable>
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {lists.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucune liste</Text>
            <Text style={styles.emptyHint}>Appuie sur + pour créer ta première liste</Text>
            <Pressable style={styles.emptyBtn} onPress={() => setAddListOpen(true)}>
              <Text style={styles.emptyBtnText}>Créer une liste</Text>
            </Pressable>
          </View>
        ) : loadingItems ? (
          <ActivityIndicator style={{ marginTop: 40, flex: 1 }} />
        ) : (
          <Animated.View style={{
            flex: 1,
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}>
            <FlatList
              style={{ flex: 1 }}
              data={sorted}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <ItemRow
                  item={item}
                  onToggle={() => handleToggle(item)}
                  onDelete={() => handleDeleteItem(item)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>
                    Liste vide — ajoute un premier produit ci-dessous
                  </Text>
                </View>
              }
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        )}

        {activeList && (
          <View style={styles.addBar}>
            {pendingPhoto && (
              <Pressable onPress={() => setPendingPhoto(null)} style={styles.photoPreview}>
                <Image source={{ uri: pendingPhoto }} style={styles.photoThumb} contentFit="cover" />
                <View style={styles.photoRemove}>
                  <Ionicons name="close" size={10} color="#fff" />
                </View>
              </Pressable>
            )}
            <TextInput
              ref={inputRef}
              style={styles.addInput}
              placeholder="Ajouter un produit..."
              placeholderTextColor="#bbb"
              value={newItemName}
              onChangeText={setNewItemName}
              returnKeyType="done"
              onSubmitEditing={handleAddItem}
            />
            <Pressable onPress={handlePickPhoto} style={styles.addBarBtn} hitSlop={6}>
              <Ionicons name="camera-outline" size={22} color="#888" />
            </Pressable>
            <Pressable
              onPress={handleAddItem}
              style={[styles.addBarBtn, styles.addBarBtnPrimary, !newItemName.trim() && styles.addBarBtnDisabled]}
              disabled={!newItemName.trim()}
              hitSlop={6}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {toastList && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="box-none">
          <Text style={styles.toastText}>"{toastList.name}" supprimé</Text>
          <Pressable onPress={handleUndo} hitSlop={12}>
            <Text style={styles.toastUndo}>Annuler</Text>
          </Pressable>
        </Animated.View>
      )}

      <AddListModal
        visible={addListOpen}
        onClose={() => setAddListOpen(false)}
        onCreated={handleListCreated}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d1d6',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },

  tabBarWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tabBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f2f2f7',
    overflow: 'hidden',
  },
  tabFillActive: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BLUE,
    borderRadius: 20,
  },
  tabFillDelete: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF3B30',
    borderRadius: 20,
  },
  tabText: { fontSize: 14, fontWeight: '500' },
  tabAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#d1d1d6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },

  list: { paddingTop: 8, paddingBottom: 100 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5', marginLeft: 56 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingRight: 12,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingLeft: 16,
    gap: 12,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#d1d1d6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  circleChecked: { backgroundColor: '#34c759', borderColor: '#34c759' },
  itemThumb: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#f2f2f7', flexShrink: 0 },
  itemName: { flex: 1, fontSize: 16, color: '#111' },
  itemNameChecked: { textDecorationLine: 'line-through', color: '#c7c7cc' },
  deleteBtn: { padding: 6 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  emptyHint: { fontSize: 14, color: '#999', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: BLUE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyList: { paddingTop: 60, alignItems: 'center' },
  emptyListText: { fontSize: 14, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },

  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d1d6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  photoPreview: { position: 'relative' },
  photoThumb: { width: 40, height: 40, borderRadius: 8 },
  photoRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#333',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#f2f2f7',
    borderRadius: 22,
    paddingHorizontal: 16,
  },
  addBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
  },
  addBarBtnPrimary: { backgroundColor: BLUE },
  addBarBtnDisabled: { opacity: 0.4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
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
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 16 },
  inputGroup: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    marginBottom: 16,
    overflow: 'hidden',
  },
  inputGroupOpen: { backgroundColor: '#fff' },
  storeInput: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111' },
  suggestionFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e5e5' },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  suggestionText: { fontSize: 15, color: '#333', flex: 1 },

  dateLabel: { fontSize: 13, color: '#999', marginBottom: 8 },
  dateChips: { gap: 8, paddingBottom: 16 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f2f2f7',
  },
  dateChipActive: { backgroundColor: BLUE },
  dateChipText: { fontSize: 13, fontWeight: '500', color: '#555' },
  dateChipTextActive: { color: '#fff' },

  createBtn: { backgroundColor: BLUE, borderRadius: 10, padding: 14, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  toast: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 12,
  },
  toastText: { color: '#fff', fontSize: 14 },
  toastUndo: { color: '#0a84ff', fontSize: 14, fontWeight: '600' },
})
