import { memo } from 'react'
import { match, P } from 'ts-pattern'
import { cn } from '@/lib/utils/cn'
import { useGameStore } from '@/store/gameStore'

const FLASH_MS = 650
const recent = (ts: number | undefined): boolean =>
  ts !== undefined && Date.now() - ts < FLASH_MS

function BetRowInner({ betId }: { betId: string }) {
  const bet = useGameStore((s) => s.bets.get(betId))
  const phase = useGameStore((s) => s.round?.phase)
  if (!bet) return null

  const isLost = phase === 'crashed' && bet.status === 'active'
  const flashCashout = recent(bet.changedAt?.cashedAt)
  const flashStatus = recent(bet.changedAt?.status)

  const multiplierCell = match(bet)
    .with({ status: 'cashed_out', cashedAt: P.number }, ({ cashedAt }) => (
      <span className="text-green">{cashedAt.toFixed(2)}×</span>
    ))
    .otherwise(() => <span className="text-txt-faint">—</span>)

  const payoutCell = match(bet)
    .with({ status: 'cashed_out', cashedAt: P.number }, ({ amount, cashedAt }) => (
      <span className="text-green">${(amount * cashedAt).toFixed(2)}</span>
    ))
    .otherwise(() =>
      isLost
        ? <span className="text-red/70">bust</span>
        : <span className="text-txt-faint">—</span>
    )

  const flashAnim = match(bet.status)
    .with('cashed_out', () => 'flash-green')
    .otherwise(() => 'flash-red')

  return (
    <div
      className={cn(
        'grid items-center h-10 px-4 border-b border-line/40 text-sm',
        'grid-cols-[1fr_72px_58px_86px]',
        bet.isYou ? 'bg-acid/4' : 'hover:bg-white/2',
      )}
    >
      <span
        className={cn('truncate font-medium', bet.isYou ? 'text-acid' : 'text-txt')}
        title={bet.player}
      >
        {bet.isYou ? 'You' : bet.player}
      </span>

      <span className="text-right font-mono text-txt-dim text-xs">
        ${bet.amount.toFixed(2)}
      </span>

      <span
        key={`co-${bet.changedAt?.cashedAt ?? ''}`}
        className="text-right font-mono text-xs block rounded-sm"
        style={flashCashout ? { animation: 'flash-green 650ms ease-out forwards' } : undefined}
      >
        {multiplierCell}
      </span>

      <span
        key={`st-${bet.changedAt?.status ?? ''}`}
        className="text-right font-mono text-xs block rounded-sm"
        style={flashStatus ? { animation: `${flashAnim} 650ms ease-out forwards` } : undefined}
      >
        {payoutCell}
      </span>
    </div>
  )
}

export const BetRow = memo(BetRowInner)
