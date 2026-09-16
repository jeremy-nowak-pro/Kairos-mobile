import { getAttachments } from './attachments'
import { supabase } from './supabase'
import { getCompressedLocalUri } from './mediaCache'

const URL_TTL = 55 * 60 * 1000 // 55 min (signed URLs valid 60 min)

const urlCache = new Map<string, { url: string; expiresAt: number }>()
const prefetched = new Set<string>()

export async function getImageUrl(storagePath: string): Promise<string> {
  const cached = urlCache.get(storagePath)
  if (cached && Date.now() < cached.expiresAt) return cached.url

  const { data, error } = await supabase.storage
    .from('event-attachments')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error

  urlCache.set(storagePath, { url: data.signedUrl, expiresAt: Date.now() + URL_TTL })
  return data.signedUrl
}

// Sert la copie locale compressée si elle existe déjà (fonctionne hors ligne).
// Sinon télécharge la photo, la redimensionne/recompresse, et la met en cache disque.
export async function getEventImageLocalUri(storagePath: string): Promise<string> {
  return getCompressedLocalUri('ev_photo', storagePath, getImageUrl)
}

export async function prefetchEventImages(eventId: string): Promise<void> {
  if (prefetched.has(eventId)) return
  prefetched.add(eventId)

  try {
    const atts = await getAttachments(eventId)
    const images = atts.filter(a => a.mime_type?.startsWith('image/'))
    if (images.length === 0) return

    await Promise.all(images.map(a => getEventImageLocalUri(a.storage_path).catch(() => null)))
  } catch {
    // silent — le cache est best-effort
  }
}
