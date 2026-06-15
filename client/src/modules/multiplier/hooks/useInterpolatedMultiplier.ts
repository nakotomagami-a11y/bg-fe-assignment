import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/shared/hooks/useGameStore'

/**
 * Interpolates between 20/s server ticks via rAF for a smooth 60fps display.
 * Growth rate is estimated from consecutive tick deltas and used to extrapolate
 * between ticks via e^(rate * dt). Returns the frozen crash value once crashed.
 */
export function useInterpolatedMultiplier(): number {
  const phase = useGameStore((s) => s.round?.phase)
  const serverValue = useGameStore((s) => s.round?.multiplier ?? 1)

  // Mutable refs — updated every tick without triggering re-renders
  const tickRef = useRef({ t: performance.now(), m: 1 })
  const rateRef = useRef(0) // exponential growth rate per ms
  const rafRef = useRef(0)

  const [value, setValue] = useState(1)

  // Estimate growth rate on each server tick
  useEffect(() => {
    const now = performance.now()
    const prev = tickRef.current
    if (phase === 'flight' && serverValue > prev.m && now > prev.t) {
      rateRef.current = Math.log(serverValue / prev.m) / (now - prev.t)
    }
    tickRef.current = { t: now, m: serverValue }
  }, [serverValue, phase])

  // Reset when a new betting round opens
  useEffect(() => {
    if (phase !== 'betting') return
    tickRef.current = { t: performance.now(), m: 1 }
    rateRef.current = 0
    setValue(1)
  }, [phase])

  // Freeze display at crash multiplier
  useEffect(() => {
    if (phase === 'crashed' || phase === 'pause') setValue(serverValue)
  }, [phase, serverValue])

  // rAF interpolation loop — only active during flight
  useEffect(() => {
    if (phase !== 'flight') {
      cancelAnimationFrame(rafRef.current)
      return
    }
    const frame = () => {
      const dt = performance.now() - tickRef.current.t
      const projected =
        rateRef.current > 0
          ? tickRef.current.m * Math.exp(rateRef.current * dt)
          : tickRef.current.m
      setValue(Math.max(projected, tickRef.current.m))
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  return value
}
