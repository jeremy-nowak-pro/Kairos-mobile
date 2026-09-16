import { cacheFile, readCache, writeCache } from './localCache'

// File d'attente générique pour les mutations hors ligne (créer/modifier/
// supprimer), avec machine à états — utilisée par shopping.ts et events.ts.
//
// Une entrée "create" porte un localId (id temporaire généré côté client,
// préfixé "local-") tant qu'elle n'a pas été synchronisée ; les entrées
// "update"/"delete" portent un targetId (le vrai id serveur).

export type OutboxOp = 'create' | 'update' | 'delete'
export type OutboxStatus = 'pending' | 'failed'

export interface OutboxEntry {
  id: string
  op: OutboxOp
  localId?: string
  targetId?: string
  payload: Record<string, unknown>
  status: OutboxStatus
  attempts: number
  lastError?: string
  createdAt: number
}

const outboxFile = (scopeKey: string) => cacheFile(`outbox_${scopeKey}.json`)

export async function getOutbox(scopeKey: string): Promise<OutboxEntry[]> {
  return readCache<OutboxEntry[]>(outboxFile(scopeKey), [])
}

export async function enqueue(
  scopeKey: string,
  entry: Pick<OutboxEntry, 'id' | 'op' | 'localId' | 'targetId' | 'payload'>,
): Promise<void> {
  const queue = await getOutbox(scopeKey)

  // Deux updates en attente pour la même cible : on fusionne plutôt que
  // d'empiler (évite de rejouer N requêtes redondantes à la synchro pour,
  // par ex., une case cochée/décochée plusieurs fois hors ligne).
  if (entry.op === 'update' && entry.targetId) {
    const idx = queue.findIndex(e => e.op === 'update' && e.targetId === entry.targetId && e.status === 'pending')
    if (idx !== -1) {
      queue[idx] = { ...queue[idx], payload: { ...queue[idx].payload, ...entry.payload } }
      writeCache(outboxFile(scopeKey), queue)
      return
    }
  }

  queue.push({ ...entry, status: 'pending', attempts: 0, createdAt: Date.now() })
  writeCache(outboxFile(scopeKey), queue)
}

export async function removeFromOutbox(scopeKey: string, id: string): Promise<void> {
  const queue = await getOutbox(scopeKey)
  writeCache(outboxFile(scopeKey), queue.filter(e => e.id !== id))
}

export function clearOutbox(scopeKey: string): void {
  const file = outboxFile(scopeKey)
  if (file.exists) file.delete()
}

export async function markOutboxFailed(scopeKey: string, id: string, error: unknown): Promise<void> {
  const queue = await getOutbox(scopeKey)
  writeCache(outboxFile(scopeKey), queue.map(e =>
    e.id === id ? { ...e, status: 'failed' as const, attempts: e.attempts + 1, lastError: String(error) } : e
  ))
}

// Fusionne un correctif dans la création en attente correspondante (ex: on
// coche un article qui n'a jamais quitté l'appareil) au lieu d'empiler une
// entrée "update" séparée pour quelque chose qui n'existe pas encore côté
// serveur.
export async function mergeIntoPendingCreate(
  scopeKey: string,
  localId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const queue = await getOutbox(scopeKey)
  const idx = queue.findIndex(e => e.op === 'create' && e.localId === localId && e.status === 'pending')
  if (idx === -1) return false
  queue[idx] = { ...queue[idx], payload: { ...queue[idx].payload, ...patch } }
  writeCache(outboxFile(scopeKey), queue)
  return true
}

// Supprimer un élément qui n'a jamais été synchronisé : annule simplement sa
// création (et toute entrée la concernant) en attente, sans jamais toucher
// au réseau. Retourne true si une création en attente a bien été annulée.
export async function cancelPendingCreate(scopeKey: string, localId: string): Promise<boolean> {
  const queue = await getOutbox(scopeKey)
  const hasCreate = queue.some(e => e.op === 'create' && e.localId === localId && e.status === 'pending')
  if (!hasCreate) return false
  writeCache(outboxFile(scopeKey), queue.filter(e => e.localId !== localId))
  return true
}
