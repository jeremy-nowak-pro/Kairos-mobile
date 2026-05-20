import { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, Modal,
  Alert, ActivityIndicator,
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

// ── File row ──────────────────────────────────────────────────────────────────

function FileRow({
  name, mime, size, thumb, onPress, onDelete,
}: {
  name: string
  mime: string | null
  size: number | null
  thumb?: string
  onPress?: () => void
  onDelete: () => void
}) {
  const icon = isImage(mime)
    ? 'image-outline'
    : mime === 'application/pdf'
    ? 'document-text-outline'
    : 'document-outline'

  return (
    <Pressable style={({ pressed }) => [s.fileRow, pressed && s.fileRowPressed]} onPress={onPress}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" />
      ) : (
        <View style={s.fileIcon}>
          <Ionicons name={icon} size={20} color="#666" />
        </View>
      )}
      <View style={s.fileInfo}>
        <Text style={s.fileName} numberOfLines={1}>{name}</Text>
        {size ? <Text style={s.fileSize}>{formatSize(size)}</Text> : null}
      </View>
      <Pressable onPress={onDelete} hitSlop={10}>
        <Ionicons name="close-circle" size={20} color="#d1d5db" />
      </Pressable>
    </Pressable>
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

type Props = PendingProps | SavedProps

export default function AttachmentSection(props: Props) {
  const [sheetVisible, setSheetVisible] = useState(false)
  const [viewerUri, setViewerUri] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const eventId = props.mode === 'saved' ? props.eventId : null

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    getAttachments(eventId)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false))
  }, [eventId])

  const handlePhoto = async () => {
    const file = await requestAndPickImage()
    if (!file) return
    if (props.mode === 'pending') {
      props.onAdd(file)
    } else {
      await uploadNew(file, props)
    }
  }

  const handleDocument = async () => {
    const file = await requestAndPickDocument()
    if (!file) return
    if (props.mode === 'pending') {
      props.onAdd(file)
    } else {
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
      const url = await getSignedUrl(att.storage_path)
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

      {pendingFiles.map((file, i) => (
        <FileRow
          key={i}
          name={file.name}
          mime={file.mimeType}
          size={file.size}
          thumb={isImage(file.mimeType) ? file.uri : undefined}
          onPress={isImage(file.mimeType) ? () => setViewerUri(file.uri) : undefined}
          onDelete={() => (props as PendingProps).onRemove(i)}
        />
      ))}

      {attachments.map(att => (
        <FileRow
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

  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  fileRowPressed: { opacity: 0.6 },
  thumb: { width: 40, height: 40, borderRadius: 6 },
  fileIcon: {
    width: 40, height: 40, borderRadius: 6,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center',
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, color: '#111' },
  fileSize: { fontSize: 12, color: '#aaa', marginTop: 1 },

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
