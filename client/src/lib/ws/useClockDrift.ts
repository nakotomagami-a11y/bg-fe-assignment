// STRUCTURAL #4: reads mutable `anchor` let-export from wsService instead of a store selector
// NAMING #6: "drift" implies change over time — this is a static offset at the last anchor
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
