import { useEffect, useState } from 'react'
import { useGameStore } from '@/shared/hooks/useGameStore'
import { anchor } from '@/ws/wsService'
import { timeUntil } from '@/ws/clockSkew'
import { useInterpolatedMultiplier } from '../hooks/useInterpolatedMultiplier'
import { CrashCurve } from './CrashCurve'

function Countdown({ endsAt }: { endsAt: number }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.ceil(timeUntil(anchor, endsAt) / 1000)),
  )

  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.ceil(timeUntil(anchor, endsAt) / 1000)))
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-label tracking-allcaps uppercase text-txt-faint">
        closes in
      </span>
      <div className="font-mono font-bold leading-none tabular-nums text-txt">
        <span className="text-7xl">{secs}</span>
        <span className="text-4xl text-txt-dim ml-1">s</span>
      </div>
    </div>
  )
}

export function HeroPanel() {
  const phase = useGameStore((s) => s.round?.phase)
  const endsAt = useGameStore((s) => s.round?.phaseEndsAt)
  const value = useInterpolatedMultiplier()

  const isBetting = phase === 'betting'
  const isLive = phase === 'flight'
  const isCrashed = phase === 'crashed' || phase === 'pause'

  const numColor = isLive ? 'text-acid' : isCrashed ? 'text-red' : 'text-txt-dim'
  const suffixColor = isLive ? 'text-acid' : isCrashed ? 'text-red' : 'text-txt-faint'

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden flex flex-col">

      {/* Phase badge */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        {!phase && (
          <>
            <span className="size-1.75 rounded-full bg-txt-faint animate-pulse" />
            <span className="text-label tracking-allcaps uppercase text-txt-faint font-medium">
              connecting
            </span>
          </>
        )}
        {isBetting && (
          <>
            <span className="size-1.75 rounded-full bg-amber shadow-glow-amber" />
            <span className="text-label tracking-allcaps uppercase text-amber font-medium">
              betting open
            </span>
          </>
        )}
        {isLive && (
          <>
            <span className="size-1.75 rounded-full bg-green shadow-glow-green animate-pulse" />
            <span className="text-label tracking-allcaps uppercase text-green font-medium">
              live
            </span>
          </>
        )}
        {isCrashed && (
          <>
            <span className="size-1.75 rounded-full bg-red" />
            <span className="text-label tracking-allcaps uppercase text-red font-medium">
              crashed
            </span>
          </>
        )}
      </div>

      {/* Multiplier / countdown */}
      <div
        className="flex items-center justify-center py-6"
        style={{ filter: isLive ? 'drop-shadow(0 0 24px var(--acid))' : undefined }}
      >
        {isBetting && endsAt != null ? (
          <Countdown endsAt={endsAt} />
        ) : (
          <div className={`font-mono font-bold leading-none tabular-nums ${numColor}`}>
            <span className="text-7xl">{value.toFixed(2)}</span>
            <span className={`text-4xl ml-1 ${suffixColor}`}>×</span>
          </div>
        )}
      </div>

      {/* Crash curve — visible during flight and after crash */}
      {(isLive || isCrashed) && <CrashCurve currentMultiplier={value} />}

    </div>
  )
}
