import { match, P } from 'ts-pattern'
import { useGameStore } from '@/store/gameStore'
import { useInterpolatedMultiplier } from '../hooks/useInterpolatedMultiplier'
import { useSecondsUntil } from '../hooks/useSecondsUntil'
import { CrashCurve } from './CrashCurve'

function Countdown({ endsAt }: { endsAt: number }) {
  const secs = useSecondsUntil(endsAt)

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

  const badge = match(phase)
    .with(undefined, () => (
      <>
        <span className="size-1.75 rounded-full bg-txt-faint animate-pulse" />
        <span className="text-label tracking-allcaps uppercase text-txt-faint font-medium">connecting</span>
      </>
    ))
    .with('betting', () => (
      <>
        <span className="size-1.75 rounded-full bg-amber shadow-glow-amber" />
        <span className="text-label tracking-allcaps uppercase text-amber font-medium">betting open</span>
      </>
    ))
    .with('flight', () => (
      <>
        <span className="size-1.75 rounded-full bg-green shadow-glow-green animate-pulse" />
        <span className="text-label tracking-allcaps uppercase text-green font-medium">live</span>
      </>
    ))
    .with(P.union('crashed', 'pause'), () => (
      <>
        <span className="size-1.75 rounded-full bg-red" />
        <span className="text-label tracking-allcaps uppercase text-red font-medium">crashed</span>
      </>
    ))
    .exhaustive()

  const numColor = match(phase)
    .with('flight', () => 'text-acid')
    .with(P.union('crashed', 'pause'), () => 'text-red')
    .otherwise(() => 'text-txt-dim')

  const suffixColor = match(phase)
    .with('flight', () => 'text-acid')
    .with(P.union('crashed', 'pause'), () => 'text-red')
    .otherwise(() => 'text-txt-faint')

  const glowFilter = match(phase)
    .with('flight', () => 'drop-shadow(0 0 24px var(--acid))')
    .otherwise(() => undefined)

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden flex flex-col shrink-0 aspect-[4/3]">

      {/* Phase badge */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        {badge}
      </div>

      {/* Multiplier / countdown */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ filter: glowFilter }}
      >
        {phase === 'betting' && endsAt != null ? (
          <Countdown endsAt={endsAt} />
        ) : (
          <div className={`font-mono font-bold leading-none tabular-nums ${numColor}`}>
            <span className="text-7xl">{value.toFixed(2)}</span>
            <span className={`text-4xl ml-1 ${suffixColor}`}>×</span>
          </div>
        )}
      </div>

      {/* Curve area — aspect-[3/1] matches canvas internal resolution (880×280) */}
      <div className="aspect-[3/1] shrink-0">
        {match(phase)
          .with(P.union('flight', 'crashed', 'pause'), () => (
            <CrashCurve currentMultiplier={value} />
          ))
          .otherwise(() => null)}
      </div>

    </div>
  )
}
