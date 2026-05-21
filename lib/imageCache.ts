import { Image } from 'expo-image'
import { getAttachments } from './attachments'
import { supabase } from './supabase'

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

export async function prefetchEventImages(eventId: string): Promise<void> {
  if (prefetched.has(eventId)) return
  prefetched.add(eventId)

  try {
    const atts = await getAttachments(eventId)
    const images = atts.filter(a => a.mime_type?.startsWith('image/'))
    if (images.length === 0) return

    const urls = await Promise.all(images.map(a => getImageUrl(a.storage_path).catch(() => null)))
    const valid = urls.filter((u): u is string => u !== null)
    await Promise.all(valid.map(url => Image.prefetch(url)))
  } catch {
    // silent — le cache est best-effort
  }
}
