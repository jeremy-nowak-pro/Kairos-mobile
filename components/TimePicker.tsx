import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView,
} from 'react-native'

const ITEM_H = 52
const VISIBLE = 5       // nombre d'items visibles (impair pour centrage)
const COL_H = ITEM_H * VISIBLE
const PAD = ITEM_H * Math.floor(VISIBLE / 2)  // padding pour centrer le 1er et dernier item

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function pad(n: number) { return String(n).padStart(2, '0') }

// ── Colonne défilante ──────────────────────────────────────────────────────────

function Column({
  values, selected, onChange, visible,
}: {
  values: number[]
  selected: number
  onChange: (v: number) => void
  visible: boolean
}) {
  const ref = useRef<ScrollView>(null)
  const [offset, setOffset] = useState(0)

  // Positionne au bon endroit à l'ouverture
  useEffect(() => {
    if (!visible) return
    const idx = values.indexOf(selected)
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: idx * ITEM_H, animated: false })
      setOffset(idx * ITEM_H)
    }, 60)
    return () => clearTimeout(timer)
  }, [visible])

  const handleEnd = (y: number) => {
    const idx = Math.round(y / ITEM_H)
    const clamped = Math.max(0, Math.min(idx, values.length - 1))
    onChange(values[clamped])
  }

  return (
    <View style={col.wrapper}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={e => setOffset(e.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={e => handleEnd(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e => handleEnd(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {values.map((v, idx) => {
          const itemCenter = idx * ITEM_H + ITEM_H / 2
          const dist = Math.abs(offset + ITEM_H / 2 - itemCenter)
          // Opacité et taille selon la distance au centre
          const ratio = Math.max(0, 1 - dist / (ITEM_H * 1.8))
          const opacity = 0.2 + 0.8 * ratio
          const fontSize = 18 + 12 * ratio

          return (
            <Pressable
              key={v}
              style={col.item}
              onPress={() => {
                ref.current?.scrollTo({ y: idx * ITEM_H, animated: true })
                onChange(v)
              }}
            >
              <Text style={[col.text, { opacity, fontSize, fontWeight: ratio > 0.8 ? '700' : '400' }]}>
                {pad(v)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Bande de sélection — par-dessus le scroll, fond transparent */}
      <View style={col.band} pointerEvents="none" />
    </View>
  )
}

const col = StyleSheet.create({
  wrapper: {
    height: COL_H,
    width: 80,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: PAD,
    height: ITEM_H,
    left: 0, right: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: '#2563EB',
  },
  item: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#111',
  },
})

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  visible: boolean
  value: string | null  // "HH:MM"
  title?: string
  onConfirm: (time: string) => void
  onClose: () => void
}

export default function TimePicker({
  visible, value, title = 'Choisir l\'heure', onConfirm, onClose,
}: Props) {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)

  useEffect(() => {
    if (!visible) return
    if (value) {
      const [h, m] = value.split(':').map(Number)
      setHours(h ?? 0)
      setMinutes(m ?? 0)
    } else {
      const now = new Date()
      setHours(now.getHours())
      setMinutes(now.getMinutes())
    }
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{title}</Text>

          <View style={s.columns}>
            <Column
              values={HOURS}
              selected={hours}
              onChange={setHours}
              visible={visible}
            />
            <Text style={s.colon}>:</Text>
            <Column
              values={MINUTES}
              selected={minutes}
              onChange={setMinutes}
              visible={visible}
            />
          </View>

          <Pressable
            style={s.confirm}
            onPress={() => {
              onConfirm(`${pad(hours)}:${pad(minutes)}`)
              onClose()
            }}
          >
            <Text style={s.confirmText}>Confirmer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const BLUE = '#2563EB'

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingVertical: 28, paddingHorizontal: 32,
    alignItems: 'center', width: 300,
  },
  title: {
    fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 20,
  },
  columns: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 28,
  },
  colon: {
    fontSize: 28, fontWeight: '700', color: '#111', marginTop: -8,
  },
  confirm: {
    backgroundColor: BLUE, borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 48,
  },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
