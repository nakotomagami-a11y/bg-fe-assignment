import { useState, useEffect } from 'react'
import { anchor } from '@/lib/ws/wsService'
import { timeUntil } from '@/lib/ws/clockSkew'

export function useSecondsUntil(endsAt: number): number {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.ceil(timeUntil(anchor, endsAt) / 1000)),
  )
  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.ceil(timeUntil(anchor, endsAt) / 1000)))
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [endsAt])
  return secs
}
