import { supabase } from './supabase'
import * as Crypto from 'expo-crypto'
import { cacheFile, readCache, writeCache } from './localCache'
import {
  OutboxEntry, getOutbox, enqueue, removeFromOutbox, markOutboxFailed,
  mergeIntoPendingCreate, cancelPendingCreate,
} from './outbox'

export interface Event {
  id: string
  title: string
  date: string
  start_time: string
  end_time: string
  location: string | null
  description: string | null
  assigned_to: string | null
  created_by: string
  space_id: string | null
  created_at: string | null
}

// ── Cache local + file d'attente (fallback et écriture hors ligne) ────────────
//
// Contrairement aux courses (une file par liste), les événements utilisent une
// file d'attente globale unique : un espace correspond à un device en usage
// normal, et ça évite de faire transiter le space_id dans update/deleteEvent.

const EVENT_SCOPE = 'events'
const isLocalId = (id: string) => id.startsWith('local-')

// Snapshot fusionné de tous les événements connus d'un espace (alimenté à
// chaque requête réussie) — sert de base hors ligne pour les vues liste/mois.
const spaceEventsCache = (spaceId: string) => cacheFile(`ev_all_${spaceId}.json`)
// Détail par événement, y compris les événements créés hors ligne (id local) —
// c'est la seule source pour getEvent() sur un id local, indépendante du space.
const detailCache = (id: string) => cacheFile(`ev_detail_${id}.json`)

async function mergeIntoCanonical(spaceId: string, events: Event[]): Promise<void> {
  const existing = await readCache<Event[]>(spaceEventsCache(spaceId), [])
  const byId = new Map(existing.map(e => [e.id, e]))
  for (const e of events) byId.set(e.id, e)
  writeCache(spaceEventsCache(spaceId), Array.from(byId.values()))
  for (const e of events) writeCache(detailCache(e.id), e)
}

// Superpose les mutations en attente (créations locales, modifications,
// suppressions) sur un jeu d'événements déjà connu — pour que les vues liste/
// mois reflètent toujours l'état réel même si rien n'a encore été synchronisé.
function applyPending(spaceId: string, events: Event[], queue: OutboxEntry[]): Event[] {
  let result = [...events]
  for (const entry of queue) {
    if (entry.op === 'create' && entry.localId && entry.payload.space_id === spaceId) {
      if (!result.some(e => e.id === entry.localId)) {
        result.push({ id: entry.localId, created_at: new Date().toISOString(), ...entry.payload } as Event)
      }
    } else if (entry.op === 'update' && entry.targetId) {
      result = result.map(e => e.id === entry.targetId ? { ...e, ...entry.payload } : e)
    } else if (entry.op === 'delete' && entry.targetId) {
      result = result.filter(e => e.id !== entry.targetId)
    }
  }
  return result
}

const sortByDateThenTime = (a: Event, b: Event) =>
  a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)

// Rejoue les mutations créées hors ligne, dans l'ordre. Best-effort : une
// entrée qui échoue encore reste en file (marquée "failed") sans bloquer les
// suivantes.
export async function syncPendingChanges(): Promise<void> {
  const queue = await getOutbox(EVENT_SCOPE)
  if (queue.length === 0) return

  for (const entry of queue) {
    try {
      if (entry.op === 'create') {
        const { data, error } = await supabase.from('events').insert(entry.payload).select().single()
        if (error) throw error
        const event = data as Event
        if (entry.localId) {
          const f = detailCache(entry.localId)
          if (f.exists) f.delete()
        }
        writeCache(detailCache(event.id), event)
      } else if (entry.op === 'update' && entry.targetId) {
        const { data, error } = await supabase.from('events').update(entry.payload).eq('id', entry.targetId).select().single()
        if (error) throw error
        writeCache(detailCache(entry.targetId), data as Event)
      } else if (entry.op === 'delete' && entry.targetId) {
        const { data: attachments } = await supabase
          .from('event_attachments')
          .select('storage_path')
          .eq('event_id', entry.targetId)
        if (attachments?.length) {
          const paths = attachments.map((a: { storage_path: string }) => a.storage_path)
          await supabase.storage.from('event-attachments').remove(paths).catch(() => {})
        }
        const { error } = await supabase.from('events').delete().eq('id', entry.targetId)
        if (error) throw error
      }
      await removeFromOutbox(EVENT_SCOPE, entry.id)
    } catch (err) {
      await markOutboxFailed(EVENT_SCOPE, entry.id, err)
    }
  }
}

export async function getUpcomingEvents(spaceId: string): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0]
  const inRange = (e: Event) => e.date >= today

  try {
    await syncPendingChanges()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('space_id', spaceId)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) throw error
    const events = (data ?? []) as Event[]
    await mergeIntoCanonical(spaceId, events)
    const queue = await getOutbox(EVENT_SCOPE)
    return applyPending(spaceId, events, queue).filter(inRange).sort(sortByDateThenTime)
  } catch {
    const all = await readCache<Event[]>(spaceEventsCache(spaceId), [])
    const queue = await getOutbox(EVENT_SCOPE)
    return applyPending(spaceId, all, queue).filter(inRange).sort(sortByDateThenTime)
  }
}

export async function getEventsForMonth(spaceId: string, year: number, month: number): Promise<Event[]> {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const inRange = (e: Event) => e.date >= from && e.date <= to
  const sortByTime = (a: Event, b: Event) => a.start_time.localeCompare(b.start_time)

  try {
    await syncPendingChanges()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('space_id', spaceId)
      .gte('date', from)
      .lte('date', to)
      .order('start_time', { ascending: true })

    if (error) throw error
    const events = (data ?? []) as Event[]
    await mergeIntoCanonical(spaceId, events)
    const queue = await getOutbox(EVENT_SCOPE)
    return applyPending(spaceId, events, queue).filter(inRange).sort(sortByTime)
  } catch {
    const all = await readCache<Event[]>(spaceEventsCache(spaceId), [])
    const queue = await getOutbox(EVENT_SCOPE)
    return applyPending(spaceId, all, queue).filter(inRange).sort(sortByTime)
  }
}

export async function getEvent(id: string): Promise<Event | null> {
  if (isLocalId(id)) {
    return readCache<Event | null>(detailCache(id), null)
  }

  try {
    await syncPendingChanges()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    const event = data as Event
    writeCache(detailCache(id), event)
    return event
  } catch {
    const cached = await readCache<Event | null>(detailCache(id), null)
    if (!cached) return null
    const queue = await getOutbox(EVENT_SCOPE)
    if (queue.some(e => e.op === 'delete' && e.targetId === id)) return null
    const pendingUpdate = queue.find(e => e.op === 'update' && e.targetId === id)
    return pendingUpdate ? { ...cached, ...pendingUpdate.payload } : cached
  }
}

export interface EventUpdatePayload {
  title?: string
  date?: string
  start_time?: string
  end_time?: string
  location?: string | null
  description?: string | null
  assigned_to?: string | null
}

export async function updateEvent(id: string, payload: EventUpdatePayload): Promise<Event> {
  if (isLocalId(id)) {
    await mergeIntoPendingCreate(EVENT_SCOPE, id, payload as Record<string, unknown>)
    const cached = await readCache<Event | null>(detailCache(id), null)
    const merged = { ...(cached as Event), ...payload }
    writeCache(detailCache(id), merged)
    return merged
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const event = data as Event
    writeCache(detailCache(id), event)
    return event
  } catch (err) {
    const cached = await readCache<Event | null>(detailCache(id), null)
    if (!cached) throw err // rien de connu localement à afficher en attendant
    const merged = { ...cached, ...payload }
    writeCache(detailCache(id), merged)
    await enqueue(EVENT_SCOPE, { id: Crypto.randomUUID(), op: 'update', targetId: id, payload: payload as Record<string, unknown> })
    return merged
  }
}

export async function deleteEvent(id: string): Promise<void> {
  if (isLocalId(id)) {
    await cancelPendingCreate(EVENT_SCOPE, id)
    const f = detailCache(id)
    if (f.exists) f.delete()
    return
  }

  try {
    // Cleanup storage files before cascade deletes the DB rows
    const { data: attachments } = await supabase
      .from('event_attachments')
      .select('storage_path')
      .eq('event_id', id)

    if (attachments?.length) {
      const paths = attachments.map((a: { storage_path: string }) => a.storage_path)
      await supabase.storage.from('event-attachments').remove(paths).catch(() => {})
    }

    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw error

    const f = detailCache(id)
    if (f.exists) f.delete()
  } catch {
    const f = detailCache(id)
    if (f.exists) f.delete()
    await enqueue(EVENT_SCOPE, { id: Crypto.randomUUID(), op: 'delete', targetId: id, payload: {} })
  }
}

export async function exportEventsToSpace(
  fromSpaceId: string,
  toSpaceId: string,
  userId: string,
  onlyMine: boolean
): Promise<number> {
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('events')
    .select('title, date, start_time, end_time, location, description, assigned_to, created_by')
    .eq('space_id', fromSpaceId)
    .gte('date', today)

  if (onlyMine) query = query.eq('created_by', userId)

  const { data, error } = await query
  if (error) throw error
  if (!data?.length) return 0

  const events = data.map((e: Omit<Event, 'id' | 'space_id' | 'created_at'>) => ({ ...e, space_id: toSpaceId }))
  const { error: insertError } = await supabase.from('events').insert(events)
  if (insertError) throw insertError

  return events.length
}

export async function createEvent(payload: {
  title: string
  date: string
  start_time: string
  end_time: string
  location?: string | null
  description?: string | null
  assigned_to?: string | null
  created_by: string
  space_id: string
}): Promise<Event> {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    const event = data as Event
    writeCache(detailCache(event.id), event)
    return event
  } catch {
    const localId = `local-${Crypto.randomUUID()}`
    const localEvent: Event = { id: localId, created_at: new Date().toISOString(), ...payload } as Event
    writeCache(detailCache(localId), localEvent)
    await enqueue(EVENT_SCOPE, { id: Crypto.randomUUID(), op: 'create', localId, payload })
    return localEvent
  }
}
