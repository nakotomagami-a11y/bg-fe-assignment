import { useState } from 'react'
import { match } from 'ts-pattern'
import { useGameStore } from '@/shared/hooks/useGameStore'
import { DevModal } from '@/modules/dev/components/DevModal'
import { useFpsMonitor } from '@/modules/dev/hooks/useFpsMonitor'

export function TopBar() {
  const round = useGameStore((s) => s.round)
  const stats = useGameStore((s) => s.stats)
  const connectionPhase = useGameStore((s) => s.connectionPhase)
  const [devOpen, setDevOpen] = useState(false)
  const { fps, frameMs } = useFpsMonitor(true)

  const badge = match(connectionPhase)
    .with('live', () => ({ dot: 'bg-green shadow-glow-green animate-pulse', label: 'live', text: 'text-txt-dim' }))
    .with('reconnecting', () => ({ dot: 'bg-amber shadow-glow-amber animate-pulse', label: 'reconnecting', text: 'text-amber' }))
    .with('recovering', () => ({ dot: 'bg-red animate-pulse', label: 'recovering', text: 'text-red' }))
    .with('connecting', () => ({ dot: 'bg-txt-faint animate-pulse', label: 'connecting', text: 'text-txt-faint' }))
    .exhaustive()

  return (
    <>
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

        {/* Connection status */}
        <span className={`inline-flex items-center gap-2 px-3.25 py-1.75 rounded-full text-xs font-medium border border-line-2 bg-white/[0.018] ${badge.text}`}>
          <span className={`size-1.75 rounded-full shrink-0 ${badge.dot}`} />
          {badge.label} · seq <b className="font-mono text-txt">{stats.lastSeq.toLocaleString()}</b>
        </span>

        {/* Round */}
        <span className="inline-flex items-center gap-2 px-3.25 py-1.75 rounded-full text-xs font-medium border border-line-2 text-txt-dim bg-white/[0.018]">
          <span className="size-1.75 rounded-full shrink-0 bg-cyan shadow-glow-cyan" />
          round <b className="text-txt">{round ? `#${round.roundId.toLocaleString()}` : '—'}</b>
        </span>

        <div className="flex-1" />

        {/* FPS */}
        <span className="font-mono text-label tabular-nums text-txt-dim">
          {fps} <span className="text-txt-faint">fps</span>
          <span className="text-txt-faint mx-1.5">·</span>
          {frameMs} <span className="text-txt-faint">ms</span>
        </span>

        {/* Dev */}
        <button
          onClick={() => setDevOpen(true)}
          className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-widest text-txt-faint border border-line hover:border-line-2 hover:text-txt-dim cursor-pointer transition-colors"
        >
          dev
        </button>

      </header>

      {devOpen && <DevModal onClose={() => setDevOpen(false)} />}
    </>
  )
}
