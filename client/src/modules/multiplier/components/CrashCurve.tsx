import { useLayoutEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import { draw, CW, CH } from '../utils/curveRenderer'
import { useCrashHistory } from '../hooks/useCrashHistory'

export function CrashCurve({ currentMultiplier }: { currentMultiplier: number }) {
  const phase = useGameStore((s) => s.round?.phase)
  const serverMultiplier = useGameStore((s) => s.round?.multiplier ?? 1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useCrashHistory(phase, serverMultiplier)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pts =
      phase === 'flight'
        ? [...historyRef.current, { t: performance.now(), m: currentMultiplier }]
        : historyRef.current
    draw(canvas, pts, phase, currentMultiplier)
  }, [currentMultiplier, phase, historyRef])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="w-full h-full"
    />
  )
}
