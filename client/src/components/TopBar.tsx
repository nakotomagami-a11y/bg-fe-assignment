import { useGameStore } from '@/shared/hooks/useGameStore'

export function TopBar() {
  const round = useGameStore((s) => s.round)
  const stats = useGameStore((s) => s.stats)

  return (
    <header className="flex items-center gap-4.5 px-6.5 py-4 border-b border-line bg-linear-to-b from-white/2.5 to-transparent">

      {/* Brand */}
      <div className="flex items-baseline gap-2.5 mr-1.5">
        <span className="font-bold tracking-brand text-brand flex items-center gap-2.25">
          <span className="size-3.25 rounded shrink-0 rotate-45 bg-acid shadow-glow-acid" />
          CRASH
        </span>
        <span className="text-label text-txt-faint tracking-allcaps uppercase font-medium">
          live board
        </span>
      </div>

      {/* Live seq */}
      <span className="inline-flex items-center gap-2 px-3.25 py-1.75 rounded-full text-xs font-medium border border-line-2 text-txt-dim bg-white/[0.018]">
        <span className="size-1.75 rounded-full shrink-0 bg-green shadow-glow-green animate-pulse" />
        live · seq{' '}
        <b className="font-mono text-txt">{stats.lastSeq.toLocaleString()}</b>
      </span>

      {/* Round */}
      <span className="inline-flex items-center gap-2 px-3.25 py-1.75 rounded-full text-xs font-medium border border-line-2 text-txt-dim bg-white/[0.018]">
        <span className="size-1.75 rounded-full shrink-0 bg-cyan shadow-glow-cyan" />
        round{' '}
        <b className="text-txt">{round ? `#${round.roundId.toLocaleString()}` : '—'}</b>
      </span>

      <div className="flex-1" />

      {/* Balance */}
      <div className="flex flex-col items-end leading-price">
        <span className="text-label tracking-allcaps uppercase text-txt-faint">
          balance
        </span>
        <span className="text-xl font-semibold tracking-price font-mono tabular-nums">
          <span className="text-acid text-currency mr-0.75 font-medium">$</span>
          1,000.00
        </span>
      </div>

    </header>
  )
}
