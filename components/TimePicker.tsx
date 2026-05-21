import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView,
} from 'react-native'

const ITEM_H = 52
const VISIBLE = 5
const COL_H = ITEM_H * VISIBLE
const PAD = ITEM_H * Math.floor(VISIBLE / 2)

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
  // Vrai pendant tout le geste + momentum — empêche l'effet de re-scroller
  const isScrollingRef = useRef(false)
  const hasMomentumRef = useRef(false)
  const dragTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // S'exécute quand visible devient true (ouverture) ET quand selected change
  // (le parent met à jour ses valeurs via son propre useEffect, qui tourne après).
  useEffect(() => {
    if (!visible || isScrollingRef.current) return
    const idx = values.indexOf(selected)
    const y = (idx >= 0 ? idx : 0) * ITEM_H
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y, animated: false })
      setOffset(y)
    }, 50)
    return () => clearTimeout(timer)
  }, [visible, selected])

  const commitValue = (y: number) => {
    isScrollingRef.current = false
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
        decelerationRate={0.994}
        scrollEventThrottle={16}
        onScroll={e => setOffset(e.nativeEvent.contentOffset.y)}
        onScrollBeginDrag={() => {
          isScrollingRef.current = true
          hasMomentumRef.current = false
          clearTimeout(dragTimerRef.current)
        }}
        onScrollEndDrag={e => {
          const y = e.nativeEvent.contentOffset.y
          // Attendre de voir si du momentum suit. Si oui,
          // onMomentumScrollBegin annulera ce timer.
          dragTimerRef.current = setTimeout(() => {
            if (!hasMomentumRef.current) commitValue(y)
          }, 60)
        }}
        onMomentumScrollBegin={() => {
          hasMomentumRef.current = true
          clearTimeout(dragTimerRef.current)
        }}
        onMomentumScrollEnd={e => {
          hasMomentumRef.current = false
          commitValue(e.nativeEvent.contentOffset.y)
        }}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {values.map((v, idx) => {
          const itemCenter = idx * ITEM_H + ITEM_H / 2
          const dist = Math.abs(offset + ITEM_H / 2 - itemCenter)
          const ratio = Math.max(0, 1 - dist / (ITEM_H * 1.8))
          const opacity = 0.2 + 0.8 * ratio
          const fontSize = 18 + 12 * ratio

          return (
            <Pressable
              key={v}
              style={col.item}
              onPress={() => {
                // Verrouiller pendant l'animation programmatique
                isScrollingRef.current = true
                ref.current?.scrollTo({ y: idx * ITEM_H, animated: true })
                onChange(v)
                setTimeout(() => { isScrollingRef.current = false }, 350)
              }}
            >
              <Text style={[col.text, { opacity, fontSize, fontWeight: ratio > 0.8 ? '700' : '400' }]}>
                {pad(v)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={col.band} pointerEvents="none" />
    </View>
  )
}

const col = StyleSheet.create({
  wrapper: { height: COL_H, width: 80, overflow: 'hidden' },
  band: {
    position: 'absolute', top: PAD, height: ITEM_H, left: 0, right: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2563EB',
  },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text: { color: '#111' },
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

  // useEffect (et non useLayoutEffect) : les colonnes dépendent de [visible, selected],
  // donc elles se re-positionnent automatiquement quand ce state est mis à jour.
  useEffect(() => {
    if (!visible) return
    if (value) {
      const [h, m] = value.split(':').map(Number)
      setHours(h ?? 0)
      setMinutes(m ?? 0)
    } else {
      setHours(6)
      setMinutes(0)
    }
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{title}</Text>

          <View style={s.columns}>
            <Column values={HOURS} selected={hours} onChange={setHours} visible={visible} />
            <Text style={s.colon}>:</Text>
            <Column values={MINUTES} selected={minutes} onChange={setMinutes} visible={visible} />
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
  title: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 20 },
  columns: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 28 },
  colon: { fontSize: 28, fontWeight: '700', color: '#111', marginTop: -8 },
  confirm: {
    backgroundColor: BLUE, borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 48,
  },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
