import { useLayoutEffect, useEffect, useRef } from 'react'
import { useGameStore } from '@/shared/hooks/useGameStore'
import type { Phase } from '@/shared/types/server'

type Point = { t: number; m: number }

// Fixed internal resolution — 2× for sharp rendering on standard + HiDPI displays
const CW = 880
const CH = 280

const PAD = { l: 8, r: 76, t: 20, b: 22 }
const GUIDES = [1.2, 1.5, 2, 3, 5, 8, 12, 20, 50, 100]
const MIN_LABEL_GAP = 32  // canvas units; prevents crowding at high multipliers

// Heat colour: green → lime → amber as multiplier climbs
function heat(m: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, Math.log(m) / Math.log(12)))
  const stops: [number, number, number][] = [
    [31, 224, 122],
    [150, 255, 90],
    [198, 255, 53],
    [255, 181, 36],
  ]
  const seg = t * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(seg))
  const f = seg - i
  return [0, 1, 2].map((k) =>
    Math.round(stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f),
  ) as [number, number, number]
}

function draw(
  canvas: HTMLCanvasElement,
  pts: Point[],
  phase: Phase | undefined,
  curM: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const crashed = phase === 'crashed' || phase === 'pause'

  ctx.clearRect(0, 0, CW, CH)

  const plotW = CW - PAD.l - PAD.r
  const plotH = CH - PAD.t - PAD.b

  const topM = Math.max(2.2, curM * 1.18)
  const t0 = pts.length > 0 ? pts[0].t : performance.now()
  const tRange = Math.max((pts[pts.length - 1]?.t ?? t0) - t0, 100)

  // pow(0.4) on X: spreads early-time data across the left, compresses late
  // data to the right — gives the slow-start / shoot-up curve shape
  const toX = (t: number) => {
    const n = Math.min(1, Math.max(0, (t - t0) / tRange))
    return PAD.l + Math.pow(n, 0.4) * plotW
  }
  const toY = (m: number) =>
    PAD.t + plotH - (Math.log(Math.max(m, 1)) / Math.log(topM)) * plotH

  const [r, g, b] = crashed ? [255, 58, 85] : heat(curM)
  const strokeColor = `rgb(${r},${g},${b})`

  // Grid lines + labels — skip labels too close to the previous one
  ctx.font = "bold 22px 'JetBrains Mono', monospace"
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  let lastLabelY = Infinity
  for (const gv of GUIDES.filter((v) => v <= topM)) {
    const y = toY(gv)
    if (y < PAD.t - 1 || y > PAD.t + plotH + 1) continue
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD.l, y)
    ctx.lineTo(CW - PAD.r + 6, y)
    ctx.stroke()
    if (lastLabelY - y >= MIN_LABEL_GAP) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.fillText(`${gv}×`, CW - 6, y)
      lastLabelY = y
    }
  }

  // Idle: dashed baseline
  if (pts.length < 2) {
    const y0 = toY(1)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.setLineDash([4, 6])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(PAD.l, y0)
    ctx.lineTo(CW - PAD.r, y0)
    ctx.stroke()
    ctx.setLineDash([])
    return
  }

  const lx = toX(pts[pts.length - 1].t)
  const ly = toY(pts[pts.length - 1].m)

  // Gradient fill under curve
  const fillPath = new Path2D()
  pts.forEach((p, i) => {
    const x = toX(p.t), y = toY(p.m)
    i ? fillPath.lineTo(x, y) : fillPath.moveTo(x, y)
  })
  fillPath.lineTo(lx, PAD.t + plotH)
  fillPath.lineTo(PAD.l, PAD.t + plotH)
  fillPath.closePath()
  const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + plotH)
  grad.addColorStop(0, `rgba(${r},${g},${b},${crashed ? 0.16 : 0.22})`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fill(fillPath)

  // Curve stroke with glow
  ctx.beginPath()
  pts.forEach((p, i) => {
    const x = toX(p.t), y = toY(p.m)
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  })
  ctx.shadowColor = `rgba(${r},${g},${b},${crashed ? 0.4 : 0.7})`
  ctx.shadowBlur = crashed ? 10 : 18
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.shadowBlur = 0

  // Tip marker
  if (!crashed) {
    const pulse = 5 + Math.sin(performance.now() / 180) * 1.4
    ctx.beginPath()
    ctx.arc(lx, ly, pulse + 7, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r},${g},${b},0.14)`
    ctx.fill()
    ctx.beginPath()
    ctx.arc(lx, ly, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.shadowColor = strokeColor
    ctx.shadowBlur = 16
    ctx.fill()
    ctx.shadowBlur = 0
  } else {
    ctx.beginPath()
    ctx.arc(lx, ly, 7, 0, Math.PI * 2)
    ctx.fillStyle = '#ff3a55'
    ctx.shadowColor = '#ff3a55'
    ctx.shadowBlur = 22
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255,58,85,0.5)'
    ctx.lineWidth = 1.5
    for (let a = 0; a < 6; a++) {
      const ang = (a * Math.PI) / 3
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(lx + Math.cos(ang) * 16, ly + Math.sin(ang) * 16)
      ctx.stroke()
    }
  }
}

export function CrashCurve({ currentMultiplier }: { currentMultiplier: number }) {
  const phase = useGameStore((s) => s.round?.phase)
  const serverMultiplier = useGameStore((s) => s.round?.multiplier ?? 1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<Point[]>([])

  useEffect(() => {
    if (phase === 'betting') {
      historyRef.current = []
      return
    }
    if (phase === 'flight' || phase === 'crashed') {
      historyRef.current = [...historyRef.current, { t: performance.now(), m: serverMultiplier }]
    }
  }, [serverMultiplier, phase])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pts =
      phase === 'flight'
        ? [...historyRef.current, { t: performance.now(), m: currentMultiplier }]
        : historyRef.current
    draw(canvas, pts, phase, currentMultiplier)
  }, [currentMultiplier, phase])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="w-full h-full"
    />
  )
}
