import { createContext, useContext, useEffect, useState } from 'react'
import { Space, getMySpace } from '@/lib/spaces'
import { useAuth } from './auth'

interface SpaceContextType {
  space: Space | null
  loading: boolean
  refresh: () => Promise<void>
}

const SpaceContext = createContext<SpaceContextType | null>(null)

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [space, setSpace] = useState<Space | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!session) { setSpace(null); setLoading(false); return }
    setLoading(true)
    const s = await getMySpace()
    setSpace(s)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [session])

  return (
    <SpaceContext.Provider value={{ space, loading, refresh }}>
      {children}
    </SpaceContext.Provider>
  )
}

export function useSpace() {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpace must be used inside SpaceProvider')
  return ctx
}
