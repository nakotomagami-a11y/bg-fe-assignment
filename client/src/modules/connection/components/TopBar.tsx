import { useGameStore } from '@/shared/hooks/useGameStore'

export function TopBar() {
  const round = useGameStore((s) => s.round)
  const stats = useGameStore((s) => s.stats)

  return (
    <header className="flex items-center gap-4.5 px-6.5 py-4 border-b border-[var(--line)] bg-gradient-to-b from-white/[0.025] to-transparent">

      {/* Brand */}
      <div className="flex items-baseline gap-2.5 mr-1.5">
        <span className="font-bold tracking-[-0.04em] text-[22px] flex items-center gap-[9px]">
          <span className="w-[13px] h-[13px] rounded-[3px] rotate-45 bg-[var(--acid)] shadow-[0_0_18px_var(--acid)] shrink-0" />
          CRASH
        </span>
        <span className="text-[11px] text-[var(--txt-faint)] tracking-[0.22em] uppercase font-medium">
          live board
        </span>
      </div>

      {/* Live seq */}
      <span className="inline-flex items-center gap-2 px-[13px] py-[7px] rounded-full text-[12.5px] font-medium border border-[var(--line-2)] text-[var(--txt-dim)] bg-white/[0.018]">
        <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[var(--green)] shadow-[0_0_10px_var(--green)] animate-pulse" />
        live · seq{' '}
        <b className="font-mono text-[var(--txt)]">{stats.lastSeq.toLocaleString()}</b>
      </span>

      {/* Round */}
      <span className="inline-flex items-center gap-2 px-[13px] py-[7px] rounded-full text-[12.5px] font-medium border border-[var(--line-2)] text-[var(--txt-dim)] bg-white/[0.018]">
        <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[var(--cyan)] shadow-[0_0_10px_var(--cyan)]" />
        round{' '}
        <b className="text-[var(--txt)]">{round ? `#${round.roundId.toLocaleString()}` : '—'}</b>
      </span>

      <div className="flex-1" />

      {/* Balance */}
      <div className="flex flex-col items-end leading-[1.05]">
        <span className="text-[10.5px] tracking-[0.2em] uppercase text-[var(--txt-faint)]">
          balance
        </span>
        <span className="text-[21px] font-semibold tracking-[-0.01em] font-mono tabular-nums">
          <span className="text-[var(--acid)] text-[13px] mr-[3px] font-medium">$</span>
          1,000.00
        </span>
      </div>

    </header>
  )
}
