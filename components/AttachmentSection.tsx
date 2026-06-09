import { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, Modal,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import {
  Attachment, LocalFile,
  getAttachments, uploadAttachment, deleteAttachment, getSignedUrl,
} from '@/lib/attachments'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1_048_576).toFixed(1)} Mo`
}

async function requestAndPickImage(): Promise<LocalFile | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('Permission refusée', 'Autorise l\'accès à la galerie dans les paramètres.')
    return null
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  })
  if (result.canceled) return null
  const asset = result.assets[0]
  const name = asset.uri.split('/').pop() ?? `photo_${Date.now()}.jpg`
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? null,
  }
}

async function requestAndPickDocument(): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
  if (result.canceled) return null
  const asset = result.assets[0]
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
  }
}

// ── Add sheet ─────────────────────────────────────────────────────────────────

function AddSheet({
  visible, onClose, onPhoto, onDocument,
}: {
  visible: boolean
  onClose: () => void
  onPhoto: () => void
  onDocument: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.sheetTitle}>Ajouter une pièce jointe</Text>
          <Pressable style={s.sheetRow} onPress={() => { onClose(); onPhoto() }}>
            <Ionicons name="image-outline" size={22} color="#111" />
            <Text style={s.sheetRowText}>Photo</Text>
          </Pressable>
          <Pressable style={s.sheetRow} onPress={() => { onClose(); onDocument() }}>
            <Ionicons name="document-outline" size={22} color="#111" />
            <Text style={s.sheetRowText}>Fichier (PDF, autre)</Text>
          </Pressable>
          <Pressable style={s.sheetCancel} onPress={onClose}>
            <Text style={s.sheetCancelText}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Image viewer ──────────────────────────────────────────────────────────────

function ImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.viewerBackdrop} onPress={onClose}>
        <Image source={{ uri }} style={s.viewerImage} contentFit="contain" />
        <Pressable style={s.viewerClose} onPress={onClose}>
          <Ionicons name="close-circle" size={32} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Image grid ────────────────────────────────────────────────────────────────

type ImageItem = {
  key: string
  uri: string
  onPress: () => void
  onDelete: () => void
}

function ImageGrid({ items }: { items: ImageItem[] }) {
  return (
    <View style={s.imageGrid}>
      {items.map(item => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [s.imageGridCell, pressed && { opacity: 0.85 }]}
          onPress={item.onPress}
        >
          <Image source={{ uri: item.uri }} style={s.imageGridThumb} contentFit="cover" />
          {item.onDelete && (
            <Pressable style={s.imageGridDelete} onPress={item.onDelete} hitSlop={6}>
              <View style={s.imageGridDeleteBg}>
                <Ionicons name="close" size={11} color="#fff" />
              </View>
            </Pressable>
          )}
        </Pressable>
      ))}
    </View>
  )
}

// ── Doc row ───────────────────────────────────────────────────────────────────

function DocRow({
  name, mime, size, onPress, onDelete,
}: {
  name: string
  mime: string | null
  size: number | null
  onPress?: () => void
  onDelete?: () => void
}) {
  const icon = mime === 'application/pdf' ? 'document-text-outline' : 'document-outline'
  return (
    <Pressable style={({ pressed }) => [s.docRow, pressed && s.docRowPressed]} onPress={onPress}>
      <View style={s.docIcon}>
        <Ionicons name={icon} size={20} color="#666" />
      </View>
      <View style={s.docInfo}>
        <Text style={s.docName} numberOfLines={1}>{name}</Text>
        {size ? <Text style={s.docSize}>{formatSize(size)}</Text> : null}
      </View>
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={10}>
          <Ionicons name="close-circle" size={20} color="#d1d5db" />
        </Pressable>
      )}
    </Pressable>
  )
}

// ── Thumbnail strip (preview mode) ────────────────────────────────────────────

function ThumbStrip({
  attachments, thumbUrls, onPress,
}: {
  attachments: Attachment[]
  thumbUrls: Record<string, string>
  onPress: (att: Attachment) => void
}) {
  if (attachments.length === 0) return null
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.stripScroll}
      contentContainerStyle={s.stripContent}
    >
      {attachments.map(att => (
        <Pressable
          key={att.id}
          style={({ pressed }) => [s.stripItem, pressed && { opacity: 0.7 }]}
          onPress={() => onPress(att)}
        >
          {isImage(att.mime_type) && thumbUrls[att.id] ? (
            <Image source={{ uri: thumbUrls[att.id] }} style={s.stripThumb} contentFit="cover" />
          ) : (
            <View style={s.stripIcon}>
              <Ionicons
                name={att.mime_type === 'application/pdf' ? 'document-text-outline' : 'document-outline'}
                size={22}
                color="#666"
              />
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface PendingProps {
  mode: 'pending'
  files: LocalFile[]
  onAdd: (file: LocalFile) => void
  onRemove: (index: number) => void
}

interface SavedProps {
  mode: 'saved'
  eventId: string
  spaceId: string
  createdBy: string
}

interface PreviewProps {
  mode: 'preview'
  eventId: string
}

type Props = PendingProps | SavedProps | PreviewProps

export default function AttachmentSection(props: Props) {
  const [sheetVisible, setSheetVisible] = useState(false)
  const [viewerUri, setViewerUri] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const eventId = props.mode !== 'pending' ? props.eventId : null

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    getAttachments(eventId)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false))
  }, [eventId])

  // Pre-load signed URLs for image thumbnails
  useEffect(() => {
    const images = attachments.filter(a => isImage(a.mime_type))
    if (images.length === 0) return
    Promise.all(
      images.map(a =>
        getSignedUrl(a.storage_path)
          .then(url => ({ id: a.id, url }))
          .catch(() => null)
      )
    ).then(results => {
      const map: Record<string, string> = {}
      results.forEach(r => { if (r) map[r.id] = r.url })
      setThumbUrls(map)
    })
  }, [attachments])

  const handlePhoto = async () => {
    const file = await requestAndPickImage()
    if (!file) return
    if (props.mode === 'pending') {
      props.onAdd(file)
    } else if (props.mode === 'saved') {
      await uploadNew(file, props)
    }
  }

  const handleDocument = async () => {
    const file = await requestAndPickDocument()
    if (!file) return
    if (props.mode === 'pending') {
      props.onAdd(file)
    } else if (props.mode === 'saved') {
      await uploadNew(file, props)
    }
  }

  const uploadNew = async (file: LocalFile, p: SavedProps) => {
    setUploading(true)
    try {
      const att = await uploadAttachment(file, p.eventId, p.spaceId, p.createdBy)
      setAttachments(prev => [...prev, att])
    } catch {
      Alert.alert('Erreur', 'L\'upload a échoué')
    }
    setUploading(false)
  }

  const openSaved = async (att: Attachment) => {
    try {
      const url = thumbUrls[att.id] ?? await getSignedUrl(att.storage_path)
      if (isImage(att.mime_type)) {
        setViewerUri(url)
      } else {
        await WebBrowser.openBrowserAsync(url)
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier')
    }
  }

  const confirmDelete = (att: Attachment) => {
    Alert.alert('Supprimer', `Supprimer "${att.filename}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteAttachment(att.id, att.storage_path)
            setAttachments(prev => prev.filter(a => a.id !== att.id))
          } catch {
            Alert.alert('Erreur', 'Suppression échouée')
          }
        },
      },
    ])
  }

  // ── Preview mode (lecture seule, compact) ────────────────────────────────────

  if (props.mode === 'preview') {
    if (loading) return <ActivityIndicator style={{ marginTop: 8 }} size="small" />
    if (attachments.length === 0) return null
    return (
      <View style={s.previewSection}>
        <View style={s.previewDivider} />
        <ThumbStrip
          attachments={attachments}
          thumbUrls={thumbUrls}
          onPress={openSaved}
        />
        {viewerUri && (
          <ImageViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
        )}
      </View>
    )
  }

  // ── Pending / Saved modes ────────────────────────────────────────────────────

  const pendingFiles = props.mode === 'pending' ? props.files : []
  const isEmpty = pendingFiles.length === 0 && attachments.length === 0

  return (
    <View>
      <View style={s.header}>
        <Text style={s.label}>PIÈCES JOINTES</Text>
        <Pressable
          style={s.addBtn}
          onPress={() => setSheetVisible(true)}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator size="small" color={BLUE} />
            : <Ionicons name="add" size={18} color={BLUE} />
          }
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={{ marginVertical: 8 }} />}

      <ImageGrid items={[
        ...pendingFiles
          .map((file, i) => isImage(file.mimeType) ? ({
            key: `pending-${i}`,
            uri: file.uri,
            onPress: () => setViewerUri(file.uri),
            onDelete: () => (props as PendingProps).onRemove(i),
          }) : null)
          .filter((x): x is ImageItem => x !== null),
        ...attachments
          .filter(att => isImage(att.mime_type) && thumbUrls[att.id])
          .map(att => ({
            key: att.id,
            uri: thumbUrls[att.id],
            onPress: () => openSaved(att),
            onDelete: () => confirmDelete(att),
          })),
      ]} />

      {pendingFiles.filter(f => !isImage(f.mimeType)).map((file, i) => (
        <DocRow
          key={`doc-pending-${i}`}
          name={file.name}
          mime={file.mimeType}
          size={file.size}
          onDelete={() => (props as PendingProps).onRemove(
            pendingFiles.indexOf(file)
          )}
        />
      ))}

      {attachments.filter(att => !isImage(att.mime_type)).map(att => (
        <DocRow
          key={att.id}
          name={att.filename}
          mime={att.mime_type}
          size={att.file_size}
          onPress={() => openSaved(att)}
          onDelete={() => confirmDelete(att)}
        />
      ))}

      {isEmpty && !loading && (
        <Text style={s.empty}>Aucune pièce jointe</Text>
      )}

      <AddSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onPhoto={handlePhoto}
        onDocument={handleDocument}
      />

      {viewerUri && (
        <ImageViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
      )}
    </View>
  )
}

const BLUE = '#2563EB'

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  label: {
    fontSize: 11, fontWeight: '600', color: '#999', letterSpacing: 0.5,
  },
  addBtn: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1, borderColor: '#e5e5e5',
    justifyContent: 'center', alignItems: 'center',
  },
  empty: { fontSize: 13, color: '#bbb', paddingVertical: 4 },

  // Image grid
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  imageGridCell: { width: '48.5%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  imageGridThumb: { width: '100%', height: '100%' },
  imageGridDelete: { position: 'absolute', top: 6, right: 6 },
  imageGridDeleteBg: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Doc row
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  docRowPressed: { opacity: 0.6 },
  docIcon: {
    width: 40, height: 40, borderRadius: 6,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center',
  },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, color: '#111' },
  docSize: { fontSize: 12, color: '#aaa', marginTop: 1 },

  // Preview mode
  previewSection: { marginTop: 4 },
  previewDivider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 10 },
  stripScroll: { flexGrow: 0 },
  stripContent: { gap: 8 },
  stripItem: { borderRadius: 8, overflow: 'hidden' },
  stripThumb: { width: 90, height: 90, borderRadius: 10 },
  stripIcon: {
    width: 90, height: 90, borderRadius: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center',
  },

  // Add sheet
  sheetBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, paddingBottom: 40,
  },
  sheetTitle: { fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 12 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  sheetRowText: { fontSize: 16, color: '#111' },
  sheetCancel: { marginTop: 8, padding: 10, alignItems: 'center' },
  sheetCancelText: { fontSize: 16, color: '#666' },

  // Image viewer
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
