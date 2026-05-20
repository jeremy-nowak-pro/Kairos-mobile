import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// SecureStore has a 2048-byte limit per key. Supabase sessions exceed this,
// so we split values into 1900-byte chunks stored under key.0, key.1, ...
const CHUNK_SIZE = 1900

const ExpoSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const first = await SecureStore.getItemAsync(`${key}.0`)
    if (first === null) return null
    let result = first
    let i = 1
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}.${i}`)
      if (chunk === null) break
      result += chunk
      i++
    }
    return result
  },
  async setItem(key: string, value: string): Promise<void> {
    const chunks: string[] = []
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE))
    }
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk)))
  },
  async removeItem(key: string): Promise<void> {
    let i = 0
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}.${i}`)
      if (chunk === null) break
      await SecureStore.deleteItemAsync(`${key}.${i}`)
      i++
    }
  },
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
