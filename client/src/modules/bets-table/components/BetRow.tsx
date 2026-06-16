import { memo } from 'react'
import { cn } from '@/shared/utils/cn'
import { useGameStore } from '@/shared/hooks/useGameStore'

// Only flash if the change happened within the animation window.
// Prevents spurious flashes when a row mounts during scroll for a bet
// that changed long ago.
const FLASH_MS = 650
const recent = (ts: number | undefined): boolean =>
  ts !== undefined && Date.now() - ts < FLASH_MS

function BetRowInner({ betId }: { betId: string }) {
  const bet = useGameStore((s) => s.bets.get(betId))
  if (!bet) return null

  const cashed = bet.status === 'cashed_out'
  const lost = bet.status === 'lost'

  const flashCashout = recent(bet.changedAt?.cashedAt)
  const flashStatus = recent(bet.changedAt?.status)

  return (
    <div
      className={cn(
        'grid items-center h-10 px-4 border-b border-line/40 text-sm',
        'grid-cols-[1fr_72px_58px_86px]',
        bet.isYou ? 'bg-acid/4' : 'hover:bg-white/2',
      )}
    >
      {/* Player */}
      <span
        className={`truncate font-medium ${bet.isYou ? 'text-acid' : 'text-txt'}`}
        title={bet.player}
      >
        {bet.isYou ? 'You' : bet.player}
      </span>

      {/* Bet amount */}
      <span className="text-right font-mono text-txt-dim text-xs">
        ${bet.amount.toFixed(2)}
      </span>

      {/* Cashout multiplier — key restarts CSS animation on each new cashout */}
      <span
        key={`co-${bet.changedAt?.cashedAt ?? ''}`}
        className="text-right font-mono text-xs block rounded-sm"
        style={flashCashout ? { animation: 'flash-green 650ms ease-out forwards' } : undefined}
      >
        {cashed && bet.cashedAt != null ? (
          <span className="text-green">{bet.cashedAt.toFixed(2)}×</span>
        ) : (
          <span className="text-txt-faint">—</span>
        )}
      </span>

      {/* Payout / status — key restarts CSS animation on status change */}
      <span
        key={`st-${bet.changedAt?.status ?? ''}`}
        className="text-right font-mono text-xs block rounded-sm"
        style={flashStatus ? {
          animation: `${cashed ? 'flash-green' : 'flash-red'} 650ms ease-out forwards`,
        } : undefined}
      >
        {cashed && bet.cashedAt != null ? (
          <span className="text-green">${(bet.amount * bet.cashedAt).toFixed(2)}</span>
        ) : lost ? (
          <span className="text-red/70">bust</span>
        ) : (
          <span className="text-txt-faint">—</span>
        )}
      </span>
    </div>
  )
}

export const BetRow = memo(BetRowInner)
