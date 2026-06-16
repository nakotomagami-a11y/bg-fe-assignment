import { useState, useEffect } from 'react'
import { anchor } from '@/lib/ws/wsService'
import { timeUntil } from '@/lib/ws/clockSkew'

export function useCountdown(endsAt: number | null): string {
  const [countdown, setCountdown] = useState('')
  useEffect(() => {
    if (endsAt == null) { setCountdown(''); return }
    const tick = () =>
      setCountdown(Math.max(0, timeUntil(anchor, endsAt) / 1000).toFixed(1) + 's')
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [endsAt])
  return countdown
}
