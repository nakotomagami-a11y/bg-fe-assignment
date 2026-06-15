import { useLayoutEffect, useEffect, useRef } from 'react'
import { useGameStore } from '@/shared/hooks/useGameStore'
import type { Phase } from '@/shared/types/server'

type Point = { t: number; m: number }

// Fixed internal resolution — 2× for sharp rendering on standard + HiDPI displays
const CW = 880
const CH = 280

function draw(canvas: HTMLCanvasElement, pts: Point[], phase: Phase | undefined) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, CW, CH)
  if (pts.length < 2) return

  const crashed = phase === 'crashed' || phase === 'pause'
  const color = crashed ? '#ff3a55' : '#1fe07a'
  const fill = crashed ? 'rgba(255,58,85,0.12)' : 'rgba(31,224,122,0.1)'

  const t0 = pts[0].t
  const tRange = Math.max(pts[pts.length - 1].t - t0, 100)
  const mMax = Math.max(...pts.map((p) => p.m), 2)
  const usableH = CH * 0.92

  const toX = (t: number) => ((t - t0) / tRange) * CW
  const toY = (m: number) =>
    CH - (usableH * Math.log(Math.max(m, 1))) / Math.log(mMax)

  // Filled area under the curve
  ctx.beginPath()
  ctx.moveTo(toX(pts[0].t), toY(pts[0].m))
  for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].t), toY(pts[i].m))
  const last = pts[pts.length - 1]
  ctx.lineTo(toX(last.t), CH)
  ctx.lineTo(0, CH)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, 0, 0, CH)
  grad.addColorStop(0, fill)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fill()

  // Curve line
  ctx.beginPath()
  ctx.moveTo(toX(pts[0].t), toY(pts[0].m))
  for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].t), toY(pts[i].m))
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.shadowColor = color
  ctx.shadowBlur = crashed ? 0 : 8
  ctx.stroke()
  ctx.shadowBlur = 0

  // Live dot at the current endpoint (only during flight)
  if (!crashed) {
    ctx.beginPath()
    ctx.arc(toX(last.t), toY(last.m), 5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 14
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

export function CrashCurve({ currentMultiplier }: { currentMultiplier: number }) {
  const phase = useGameStore((s) => s.round?.phase)
  const serverMultiplier = useGameStore((s) => s.round?.multiplier ?? 1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<Point[]>([])

  // Accumulate tick history; clear on new round
  useEffect(() => {
    if (phase === 'betting') {
      historyRef.current = []
      return
    }
    if (phase === 'flight' || phase === 'crashed') {
      historyRef.current = [...historyRef.current, { t: performance.now(), m: serverMultiplier }]
    }
  }, [serverMultiplier, phase])

  // Redraw on each interpolated value change (60fps during flight, once on crash)
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Append the live interpolated point so the curve tracks the display value smoothly
    const pts =
      phase === 'flight'
        ? [...historyRef.current, { t: performance.now(), m: currentMultiplier }]
        : historyRef.current

    draw(canvas, pts, phase)
  }, [currentMultiplier, phase])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="w-full"
      style={{ height: 140 }}
    />
  )
}
