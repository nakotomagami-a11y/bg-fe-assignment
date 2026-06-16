import { useLayoutEffect, useRef } from 'react'
import type { Phase } from '@server/protocol/protocol'
import { GROWTH, TICK_MS, type Point } from '../utils/curveRenderer'

export function useCrashHistory(phase: Phase | undefined, serverMultiplier: number) {
  const historyRef = useRef<Point[]>([])

  // useLayoutEffect (not useEffect) so history is populated before the draw effect runs
  useLayoutEffect(() => {
    if (phase === 'betting') {
      historyRef.current = []
      return
    }
    if (phase === 'flight' || phase === 'crashed') {
      // Page was reloaded mid-flight: synthesize the missing history using
      // the server formula m = exp(GROWTH * tick / 20) so the curve looks correct.
      if (historyRef.current.length === 0 && serverMultiplier > 1.01) {
        const currentTick = Math.round(Math.log(serverMultiplier) * 20 / GROWTH)
        const flightStart = performance.now() - currentTick * TICK_MS
        const step = Math.max(1, Math.floor(currentTick / 50))
        const synthetic: Point[] = []
        for (let tick = 0; tick < currentTick; tick += step) {
          synthetic.push({ t: flightStart + tick * TICK_MS, m: Math.exp((GROWTH * tick) / 20) })
        }
        historyRef.current = synthetic
      }
      historyRef.current = [...historyRef.current, { t: performance.now(), m: serverMultiplier }]
    }
  }, [serverMultiplier, phase])

  return historyRef
}
