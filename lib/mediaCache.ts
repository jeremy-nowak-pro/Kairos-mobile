import { File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

// Cache disque partagé pour les images distantes (photos de courses, pièces
// jointes d'événement...) : une fois vue en ligne, une image est redimensionnée
// (800px) et recompressée (JPEG 0.6) puis conservée dans Documents (persistant,
// pas purgeable par l'OS comme le dossier cache) — donc consultable hors ligne.

const localMediaFile = (prefix: string, storagePath: string) =>
  new File(Paths.document, `${prefix}_${storagePath.replace(/\//g, '_').replace(/\.[a-zA-Z0-9]+$/, '')}.jpg`)

export async function getCompressedLocalUri(
  prefix: string,
  storagePath: string,
  getSignedUrl: (path: string) => Promise<string>,
): Promise<string> {
  const local = localMediaFile(prefix, storagePath)
  if (local.exists) return local.uri

  const signedUrl = await getSignedUrl(storagePath)
  const temp = await File.downloadFileAsync(signedUrl, Paths.cache, { idempotent: true })
  try {
    const rendered = await ImageManipulator.manipulate(temp.uri).resize({ width: 800 }).renderAsync()
    const compressed = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG })
    new File(compressed.uri).move(local)
    return local.uri
  } finally {
    if (temp.exists) temp.delete()
  }
}

export function deleteLocalMedia(prefix: string, storagePath: string): void {
  const local = localMediaFile(prefix, storagePath)
  if (local.exists) local.delete()
}
