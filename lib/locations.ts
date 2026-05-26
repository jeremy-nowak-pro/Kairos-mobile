import { File, Paths } from 'expo-file-system'

interface LocationEntry {
  location: string
  used_count: number
}

const FILE = new File(Paths.document + '/location_history.json')

async function read(): Promise<LocationEntry[]> {
  try {
    if (!FILE.exists) return []
    const text = await FILE.text()
    return JSON.parse(text) as LocationEntry[]
  } catch {
    return []
  }
}

async function write(entries: LocationEntry[]): Promise<void> {
  await FILE.write(JSON.stringify(entries))
}

export async function getLocations(): Promise<string[]> {
  const entries = await read()
  return entries
    .sort((a, b) => b.used_count - a.used_count)
    .slice(0, 20)
    .map(e => e.location)
}

export async function upsertLocation(location: string): Promise<void> {
  const trimmed = location.trim()
  if (!trimmed) return
  const entries = await read()
  const existing = entries.find(e => e.location === trimmed)
  if (existing) {
    existing.used_count += 1
  } else {
    entries.push({ location: trimmed, used_count: 1 })
  }
  await write(entries)
}

export async function deleteLocation(location: string): Promise<void> {
  const entries = await read()
  await write(entries.filter(e => e.location !== location))
}
