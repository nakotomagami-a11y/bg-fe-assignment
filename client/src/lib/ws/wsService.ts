import { match } from 'ts-pattern'
import { WebSocketClient } from './client'
import { createAnchor, type TimeAnchor } from './clockSkew'
import { useGameStore } from '@/store/gameStore'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'

// Exposed so countdown components can estimate server time without a store subscription
export let anchor: TimeAnchor = createAnchor(Date.now())

// rAF-batched queue for bet_updated — one store write per animation frame max
const betUpdateQueue: Array<{ betId: string; cashedAt: number }> = []
let rafPending = false

function flushBetUpdates() {
  rafPending = false
  if (betUpdateQueue.length === 0) return
  useGameStore.getState().applyBetUpdates(betUpdateQueue.splice(0))
}

export const wsClient = new WebSocketClient(WS_URL, {
  onConnectionPhase: (phase) => useGameStore.getState().setConnectionPhase(phase),

  onStats: (patch) => useGameStore.getState().incrementStats(patch),

  onAnomaly: (entry) => useGameStore.getState().recordAnomaly(entry),

  onMessage: (msg, newAnchor) => {
    anchor = newAnchor
    const store = useGameStore.getState()

    match(msg)
      .with({ type: 'snapshot' }, ({ payload }) =>
        store.applySnapshot(payload.round, payload.bets, payload.lastRounds),
      )
      .with({ type: 'betting_open' }, ({ payload }) =>
        store.applyBettingOpen(payload.roundId, payload.endsAt),
      )
      .with({ type: 'round_start' }, ({ payload }) =>
        store.applyRoundStart(payload.roundId),
      )
      .with({ type: 'multiplier_tick' }, ({ payload }) =>
        store.applyMultiplierTick(payload.value),
      )
      .with({ type: 'round_crash' }, ({ payload }) =>
        store.applyRoundCrash(payload.crashMultiplier),
      )
      .with({ type: 'bets_placed' }, ({ payload }) =>
        store.applyBetsPlaced(payload.bets),
      )
      .with({ type: 'bet_updated' }, ({ payload }) => {
        betUpdateQueue.push({ betId: payload.betId, cashedAt: payload.cashedAt })
        if (!rafPending) {
          rafPending = true
          requestAnimationFrame(flushBetUpdates)
        }
      })
      .with({ type: 'bet_accepted' }, ({ payload }) => {
        if (store.playerBet?.clientBetId !== payload.clientBetId) return
        store.updatePlayerBet({ betId: payload.bet.id, status: 'active' })
      })
      .with({ type: 'bet_rejected' }, ({ payload }) => {
        if (store.playerBet?.clientBetId !== payload.clientBetId) return
        store.updatePlayerBet({ status: 'rejected', rejectReason: payload.reason })
      })
      .with({ type: 'cashout_accepted' }, ({ payload }) => {
        if (store.playerBet?.betId !== payload.betId) return
        store.updatePlayerBet({ status: 'cashed_out', cashedAt: payload.multiplier })
      })
      .with({ type: 'cashout_rejected' }, ({ payload }) => {
        if (store.playerBet?.betId !== payload.betId) return
        // 'crashed' means the round ended before the cashout landed — bet is lost, not pending
        store.updatePlayerBet({
          status: payload.reason === 'crashed' ? 'lost' : 'active',
          rejectReason: payload.reason === 'crashed' ? null : payload.reason,
        })
      })
      .with({ type: 'error' }, ({ payload }) =>
        store.recordAnomaly({ at: Date.now(), kind: 'server_error', detail: payload.message }),
      )
      .exhaustive()
  },
})
