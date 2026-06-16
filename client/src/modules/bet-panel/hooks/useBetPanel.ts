import { useState, useEffect } from 'react'
import { match, P } from 'ts-pattern'
import { useGameStore } from '@/store/gameStore'
import { wsClient } from '@/lib/ws/wsService'

let betSeq = 0
export const nextClientBetId = () => `c${++betSeq}-${Date.now()}`

export type BetFormStatus =
  | { kind: 'ready'; endsAt?: number | null }
  | { kind: 'pending' }
  | { kind: 'waiting'; endsAt?: number | null }
  | { kind: 'rejected'; reason: string | null; onDismiss: () => void }
  | { kind: 'cashout'; amount: number; multiplier: number; cashing: boolean }
  | { kind: 'won'; cashedAt: number; payout: number }
  | { kind: 'lost'; crashAt: number; betAmount: number }
  | { kind: 'locked'; label: string; sub?: string }

export function useBetPanel() {
  const phase = useGameStore((s) => s.round?.phase)
  // Only subscribe to live multiplier ticks during flight+crashed — avoids 20/s re-renders
  // during betting phase when the multiplier sits at 1.00 and nothing needs it
  const multiplier = useGameStore((s) => {
    const ph = s.round?.phase
    return ph === 'flight' || ph === 'crashed' ? (s.round?.multiplier ?? 1) : 1
  })
  const endsAt = useGameStore((s) => s.round?.phaseEndsAt)
  const playerBet = useGameStore((s) => s.playerBet)
  const setPlayerBet = useGameStore((s) => s.setPlayerBet)

  const [cashing, setCashing] = useState(false)

  useEffect(() => {
    if (playerBet?.status !== 'active') setCashing(false)
  }, [playerBet?.status])

  function placeBet(amount: number) {
    if (phase !== 'betting' || playerBet) return
    const clientBetId = nextClientBetId()
    wsClient.send({ type: 'place_bet', clientBetId, amount })
    setPlayerBet({ clientBetId, betId: null, amount, status: 'pending', cashedAt: null, rejectReason: null })
  }

  function cashOut() {
    if (!playerBet?.betId || cashing) return
    wsClient.send({ type: 'cash_out', betId: playerBet.betId })
    setCashing(true)
  }

  const status: BetFormStatus = match({ phase, bet: playerBet })
    .with({ phase: P.nullish }, () => ({ kind: 'locked' as const, label: 'Connecting…' }))
    .with({ bet: { status: 'pending' } }, () => ({ kind: 'pending' as const }))
    .with({ bet: { status: 'rejected' } }, ({ bet: b }) => ({
      kind: 'rejected' as const,
      reason: b.rejectReason,
      onDismiss: () => setPlayerBet(null),
    }))
    .with({ phase: 'betting', bet: { status: 'active' } }, () => ({
      kind: 'waiting' as const,
      endsAt,
    }))
    .with({ phase: 'flight', bet: { status: 'active' } }, ({ bet: b }) => ({
      kind: 'cashout' as const,
      amount: b.amount,
      multiplier,
      cashing,
    }))
    .with({ bet: { status: 'cashed_out', cashedAt: P.number } }, ({ bet: b }) => ({
      kind: 'won' as const,
      cashedAt: b.cashedAt,
      payout: b.amount * b.cashedAt,
    }))
    .with({ bet: { status: 'lost' } }, ({ bet: b }) => ({
      kind: 'lost' as const,
      crashAt: multiplier,
      betAmount: b.amount,
    }))
    .with({ phase: 'flight' }, () => ({ kind: 'locked' as const, label: 'Round in progress' }))
    .with({ phase: 'crashed' }, () => ({
      kind: 'locked' as const,
      label: `Crashed @ ${multiplier.toFixed(2)}×`,
    }))
    .with({ phase: 'pause' }, () => ({ kind: 'locked' as const, label: 'Next round soon' }))
    .otherwise(() => ({ kind: 'ready' as const, endsAt }))

  return { status, placeBet, cashOut }
}
