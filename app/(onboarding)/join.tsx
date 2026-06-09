import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { joinSpaceByCode, leaveSpace, getAllMySpaces, getMySpace } from '@/lib/spaces'
import { exportEventsToSpace } from '@/lib/events'
import { exportListsToSpace } from '@/lib/shopping'
import { BlurView } from 'expo-blur'
import MeshBackground from '@/components/MeshBackground'

type ExportScope = 'all' | 'mine'

export default function JoinSpaceScreen() {
  const { code: deepLinkCode } = useLocalSearchParams<{ code?: string }>()
  const { refresh } = useSpace()
  const { user } = useAuth()
  const router = useRouter()

  const [code, setCode] = useState(deepLinkCode ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [currentSpace, setCurrentSpace] = useState<{ id: string; name: string } | null>(null)
  const [exportEnabled, setExportEnabled] = useState(true)
  const [exportScope, setExportScope] = useState<ExportScope>('all')
  const [exportLists, setExportLists] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const handleJoin = useCallback(async (codeToUse = code) => {
    if (!codeToUse.trim()) return
    setError(null)
    setLoading(true)

    try {
      const existingSpace = await getMySpace()

      if (existingSpace) {
        setCurrentSpace({ id: existingSpace.id, name: existingSpace.name })
        setShowModal(true)
        setLoading(false)
        return
      }

      await joinSpaceByCode(codeToUse.trim())
      await refresh()
      router.replace('/(app)/events')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue')
      setLoading(false)
    }
  }, [code, refresh, router])

  const handleConfirm = async () => {
    if (!currentSpace || !user) return
    setConfirming(true)
    setModalError(null)

    try {
      // 1. Rejoindre le nouvel espace en premier (évite de se retrouver sans espace)
      await joinSpaceByCode(code.trim())

      // 2. Trouver le nouvel espace (celui qui n'est pas l'ancien)
      const allSpaces = await getAllMySpaces()
      const newSpace = allSpaces.find(s => s.id !== currentSpace.id)

      // 3. Exporter les événements si demandé
      if (exportEnabled && newSpace) {
        await exportEventsToSpace(
          currentSpace.id,
          newSpace.id,
          user.id,
          exportScope === 'mine'
        )
      }

      // 4. Exporter les listes de courses si demandé
      if (exportLists && newSpace) {
        await exportListsToSpace(currentSpace.id, newSpace.id, user.id)
      }

      // 5. Quitter l'ancien espace
      await leaveSpace(currentSpace.id)

      await refresh()
      router.replace('/(app)/events')
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : 'Une erreur est survenue')
      setConfirming(false)
    }
  }

  useEffect(() => {
    if (deepLinkCode?.length === 8) handleJoin(deepLinkCode)
  }, [deepLinkCode, handleJoin])

  return (
    <View style={s.root}>
      <MeshBackground />
      <View style={s.content}>
        <Text style={s.title}>Rejoindre un espace</Text>
        <Text style={s.subtitle}>Entre le code partagé par ton partenaire.</Text>

        <Text style={s.label}>Code d'invitation</Text>
        <BlurView intensity={22} tint="light" style={s.card}>
          <TextInput
            style={s.input}
            placeholder="A1B2C3D4"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
        </BlurView>
        <Text style={s.hint}>{code.length}/8 caractères</Text>

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable
          style={[s.button, (loading || code.length < 8) && s.buttonDisabled]}
          onPress={() => handleJoin()}
          disabled={loading || code.length < 8}
        >
          {loading
            ? <ActivityIndicator color="rgba(180,210,255,0.9)" />
            : <Text style={s.buttonText}>Rejoindre</Text>}
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={s.link}>Retour</Text>
        </Pressable>
      </View>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={s.overlay}>
          <BlurView intensity={55} tint="dark" style={s.overlayBlur} />
          <View style={s.modal}>

            <Text style={s.modalTitle}>Tu es déjà dans un espace</Text>
            <Text style={s.modalSubtitle}>
              Espace actuel :{' '}
              <Text style={s.modalSpaceName}>{currentSpace?.name}</Text>
            </Text>

            <View style={s.sep} />

            <Pressable style={s.toggleRow} onPress={() => setExportEnabled(v => !v)}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleLabel}>Importer les événements à venir</Text>
                <Text style={s.toggleHint}>Les pièces jointes ne seront pas transférées</Text>
              </View>
              <View style={[s.toggle, exportEnabled && s.toggleOn]}>
                <View style={[s.toggleKnob, exportEnabled && s.toggleKnobOn]} />
              </View>
            </Pressable>

            {exportEnabled && (
              <View style={s.scopeBox}>
                <Pressable
                  style={[s.scopeOption, exportScope === 'all' && s.scopeOptionOn]}
                  onPress={() => setExportScope('all')}
                >
                  <View style={[s.radio, exportScope === 'all' && s.radioOn]}>
                    {exportScope === 'all' && <View style={s.radioDot} />}
                  </View>
                  <Text style={s.scopeLabel}>Tous les événements de l'espace</Text>
                </Pressable>
                <Pressable
                  style={[s.scopeOption, exportScope === 'mine' && s.scopeOptionOn]}
                  onPress={() => setExportScope('mine')}
                >
                  <View style={[s.radio, exportScope === 'mine' && s.radioOn]}>
                    {exportScope === 'mine' && <View style={s.radioDot} />}
                  </View>
                  <Text style={s.scopeLabel}>Mes événements uniquement</Text>
                </Pressable>
              </View>
            )}

            <View style={s.innerSep} />

            <Pressable style={s.toggleRow} onPress={() => setExportLists(v => !v)}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleLabel}>Importer les listes de courses</Text>
                <Text style={s.toggleHint}>Les photos des articles ne seront pas transférées</Text>
              </View>
              <View style={[s.toggle, exportLists && s.toggleOn]}>
                <View style={[s.toggleKnob, exportLists && s.toggleKnobOn]} />
              </View>
            </Pressable>

            <View style={s.sep} />

            {modalError && <Text style={s.modalError}>{modalError}</Text>}

            <View style={s.modalButtons}>
              <Pressable
                style={s.cancelBtn}
                onPress={() => { setShowModal(false); setModalError(null) }}
                disabled={confirming}
              >
                <Text style={s.cancelBtnText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[s.confirmBtn, confirming && s.buttonDisabled]}
                onPress={handleConfirm}
                disabled={confirming}
              >
                {confirming
                  ? <ActivityIndicator color="rgba(180,210,255,0.9)" size="small" />
                  : <Text style={s.confirmBtnText}>Quitter et rejoindre</Text>}
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a0e30' },
  content: { flex: 1, justifyContent: 'center', padding: 28 },

  title: {
    fontSize: 28, fontWeight: '300', marginBottom: 10,
    textAlign: 'center', color: '#ffffff', letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14, textAlign: 'center',
    color: 'rgba(255,255,255,0.65)', lineHeight: 22, marginBottom: 40,
  },
  label: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  card: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  input: {
    padding: 18, fontSize: 26, fontWeight: '300',
    textAlign: 'center', letterSpacing: 8,
    color: '#ffffff', backgroundColor: 'rgba(8,16,48,0.35)',
  },
  hint: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'right', marginTop: 6, marginBottom: 8,
  },
  button: {
    backgroundColor: 'rgba(110,55,180,0.70)', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.50)',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 },
  error: {
    backgroundColor: 'rgba(224,85,85,0.12)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(224,85,85,0.45)',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11,
    color: '#f08080', fontSize: 13, textAlign: 'center', marginBottom: 10,
  },
  link: { marginTop: 22, textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 13 },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(12,6,28,0.82)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  overlayBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: '100%', borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(140,170,255,0.20)',
    backgroundColor: 'rgba(8,16,48,0.92)',
    padding: 24,
  },
  modalTitle: {
    fontSize: 17, fontWeight: '600', color: '#ffffff', marginBottom: 5,
  },
  modalSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.50)' },
  modalSpaceName: { color: 'rgba(255,255,255,0.90)', fontWeight: '500' },

  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginVertical: 20,
  },
  innerSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 16,
  },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, color: 'rgba(255,255,255,0.90)', fontWeight: '500', marginBottom: 3 },
  toggleHint: { fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 16 },
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: 'rgba(37,99,235,0.80)',
    borderColor: 'rgba(120,160,255,0.35)',
  },
  toggleKnob: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-end',
  },

  // Scope
  scopeBox: { marginTop: 16, gap: 8 },
  scopeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
  },
  scopeOptionOn: {
    borderColor: 'rgba(120,160,255,0.35)',
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.40)',
    justifyContent: 'center', alignItems: 'center',
  },
  radioOn: { borderColor: 'rgba(120,160,255,0.80)' },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(37,99,235,0.90)',
  },
  scopeLabel: { fontSize: 14, color: 'rgba(255,255,255,0.80)', flex: 1 },

  // Modal buttons
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.20)',
  },
  cancelBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },
  confirmBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(37,99,235,0.80)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(120,160,255,0.35)',
  },
  confirmBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.95)', fontWeight: '500' },
  modalError: {
    color: '#f08080', fontSize: 12, textAlign: 'center', marginBottom: 12,
  },
})
