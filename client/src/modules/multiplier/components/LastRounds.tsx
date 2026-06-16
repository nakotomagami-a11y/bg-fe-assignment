import { useGameStore } from '@/store/gameStore'

function MultiplierChip({ value }: { value: number }) {
  const isHigh = value >= 10
  const isMid = value >= 2 && value < 10
  const cls = isHigh
    ? 'text-green bg-green/10 border-green/25'
    : isMid
      ? 'text-amber bg-amber/10 border-amber/25'
      : 'text-red bg-red/10 border-red/25'

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-mono font-medium tabular-nums border ${cls}`}
    >
      {value.toFixed(2)}×
    </span>
  )
}

export function LastRounds() {
  const lastRounds = useGameStore((s) => s.lastRounds)

  if (lastRounds.length === 0) return null

  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3 flex items-center gap-2 flex-wrap">
      <span className="text-label tracking-allcaps uppercase text-txt-faint mr-1">last</span>
      {lastRounds.map((m, i) => (
        <MultiplierChip key={i} value={m} />
      ))}
    </div>
  )
}
