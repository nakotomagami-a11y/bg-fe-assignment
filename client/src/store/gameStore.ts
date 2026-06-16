import { create } from 'zustand'
import type { RoundState, Bet } from '@server/protocol/protocol'
import type {
  ClientBet,
  PlayerBet,
  ConnectionPhase,
  AnomalyEntry,
  WsStats,
} from '@/lib/types/client'

const ANOMALY_RING_SIZE = 50

type GameState = {
  connectionPhase: ConnectionPhase
  round: RoundState | null
  bets: Map<string, ClientBet>
  // Stable ordered list of bet IDs — reference only changes when bets are added/cleared,
  // NOT on status updates. BetsTable subscribes to this so multiplier ticks don't trigger
  // an O(n) re-comparison of all keys.
  betIds: string[]
  lastRounds: number[]
  // Monotonically increasing counter — one per crash. Used as stable React key in
  // LastRounds: key = lastRoundSeq - i, so prepending a new chip doesn't remount old ones.
  lastRoundSeq: number
  playerBet: PlayerBet | null
  stats: WsStats
  anomalies: AnomalyEntry[]
}

type GameActions = {
  setConnectionPhase: (phase: ConnectionPhase) => void
  applySnapshot: (round: RoundState, bets: Bet[], lastRounds: number[]) => void
  applyBettingOpen: (roundId: number, endsAt: number) => void
  applyRoundStart: (roundId: number) => void
  applyMultiplierTick: (value: number) => void
  applyRoundCrash: (crashMultiplier: number) => void
  applyBetsPlaced: (bets: Bet[]) => void
  applyBetUpdates: (updates: Array<{ betId: string; cashedAt: number }>) => void
  setPlayerBet: (bet: PlayerBet | null) => void
  updatePlayerBet: (patch: Partial<PlayerBet>) => void
  recordAnomaly: (entry: AnomalyEntry) => void
  incrementStats: (patch: Partial<WsStats>) => void
}

const serverBetToClient = (bet: Bet): ClientBet => ({
  id: bet.id,
  player: bet.player,
  amount: bet.amount,
  status: bet.status,
  cashedAt: bet.cashedAt,
  isYou: bet.isYou,
})

const initialStats: WsStats = {
  lastSeq: 0,
  duplicatesDropped: 0,
  outOfOrderFixed: 0,
  gapsDetected: 0,
  reconnects: 0,
}

export const useGameStore = create<GameState & GameActions>((set) => ({
  connectionPhase: 'connecting',
  round: null,
  bets: new Map(),
  betIds: [],
  lastRounds: [],
  lastRoundSeq: 0,
  playerBet: null,
  stats: initialStats,
  anomalies: [],

  setConnectionPhase: (phase) => set({ connectionPhase: phase }),

  applySnapshot: (round, bets, lastRounds) =>
    set((s) => ({
      round,
      lastRounds,
      // Set lastRoundSeq to match the number of known past rounds so keys stay stable
      // across reconnects: key = lastRoundSeq - i gives the same values as before
      lastRoundSeq: lastRounds.length,
      bets: new Map(bets.map((b) => [b.id, serverBetToClient(b)])),
      betIds: bets.map((b) => b.id),
      // Clear playerBet when the round changed — a stale active/pending bet from the
      // previous round should not survive a reconnect into a different round
      playerBet: s.round?.roundId !== round.roundId ? null : s.playerBet,
    })),

  applyBettingOpen: (roundId, endsAt) =>
    set((s) => ({
      round: s.round
        ? { ...s.round, roundId, phase: 'betting', multiplier: 1, phaseEndsAt: endsAt }
        : { roundId, phase: 'betting', multiplier: 1, phaseEndsAt: endsAt },
      bets: new Map(),
      betIds: [],
      playerBet: null,
    })),

  applyRoundStart: (roundId) =>
    set((s) => ({
      round: s.round
        ? { ...s.round, roundId, phase: 'flight', multiplier: 1, phaseEndsAt: null }
        : { roundId, phase: 'flight', multiplier: 1, phaseEndsAt: null },
    })),

  applyMultiplierTick: (value) =>
    set((s) => ({
      round: s.round ? { ...s.round, multiplier: value } : null,
    })),

  applyRoundCrash: (crashMultiplier) =>
    set((s) => ({
      round: s.round ? { ...s.round, phase: 'crashed', multiplier: crashMultiplier } : null,
      lastRounds: s.round ? [crashMultiplier, ...s.lastRounds].slice(0, 6) : s.lastRounds,
      lastRoundSeq: s.round ? s.lastRoundSeq + 1 : s.lastRoundSeq,
      // Terminal-ize both active and pending bets — a pending bet that never got confirmed
      // before the crash should not survive into the next round as a phantom active bet
      playerBet:
        s.playerBet?.status === 'active' || s.playerBet?.status === 'pending'
          ? { ...s.playerBet, status: 'lost' }
          : s.playerBet,
    })),

  applyBetsPlaced: (bets) =>
    set((s) => {
      const next = new Map(s.bets)
      const incoming = bets.filter((b) => !next.has(b.id))
      for (const b of bets) next.set(b.id, serverBetToClient(b))
      return {
        bets: next,
        betIds: incoming.length > 0 ? [...s.betIds, ...incoming.map((b) => b.id)] : s.betIds,
      }
    }),

  applyBetUpdates: (updates) =>
    set((s) => {
      const now = Date.now()
      const next = new Map(s.bets)
      for (const u of updates) {
        const existing = next.get(u.betId)
        if (existing) {
          next.set(u.betId, {
            ...existing,
            status: 'cashed_out',
            cashedAt: u.cashedAt,
            changedAt: { ...existing.changedAt, status: now, cashedAt: now },
          })
        }
      }
      return { bets: next }
      // betIds unchanged — no insertions or removals
    }),

  setPlayerBet: (bet) => set({ playerBet: bet }),

  updatePlayerBet: (patch) =>
    set((s) => ({
      playerBet: s.playerBet ? { ...s.playerBet, ...patch } : null,
    })),

  recordAnomaly: (entry) =>
    set((s) => ({
      anomalies: [entry, ...s.anomalies].slice(0, ANOMALY_RING_SIZE),
    })),

  incrementStats: (patch) =>
    set((s) => ({
      stats: {
        lastSeq: patch.lastSeq ?? s.stats.lastSeq,
        duplicatesDropped: s.stats.duplicatesDropped + (patch.duplicatesDropped ?? 0),
        outOfOrderFixed: s.stats.outOfOrderFixed + (patch.outOfOrderFixed ?? 0),
        gapsDetected: s.stats.gapsDetected + (patch.gapsDetected ?? 0),
        reconnects: s.stats.reconnects + (patch.reconnects ?? 0),
      },
    })),
}))
