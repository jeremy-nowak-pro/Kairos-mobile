import { File, Paths } from 'expo-file-system'

// Cache JSON local partagé — fallback hors ligne pour les fonctions de lecture
// (écriture silencieuse en cas de succès réseau, lecture du dernier snapshot
// connu en cas d'échec).

export function cacheFile(name: string): File {
  return new File(Paths.document, name)
}

export async function readCache<T>(file: File, fallback: T): Promise<T> {
  if (!file.exists) return fallback
  try {
    const raw = await file.text()
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeCache(file: File, data: unknown): void {
  try { file.write(JSON.stringify(data)) } catch { /* best effort */ }
}
