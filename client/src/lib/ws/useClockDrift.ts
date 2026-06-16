import { useState, useEffect } from 'react'
import { anchor } from './wsService'

export function useClockDrift(intervalMs = 500): number {
  const [drift, setDrift] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setDrift(anchor.serverTime - anchor.localTime), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return drift
}
