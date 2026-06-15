import { create } from 'zustand'
import type { RoundState, Bet } from '@/shared/types/server'
import type {
  ClientBet,
  PlayerBet,
  ConnectionPhase,
  AnomalyEntry,
  WsStats,
} from '@/shared/types/client'

const ANOMALY_RING_SIZE = 50

type GameState = {
  connectionPhase: ConnectionPhase
  round: RoundState | null
  bets: Map<string, ClientBet>
  lastRounds: number[]
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
  lastRounds: [],
  playerBet: null,
  stats: initialStats,
  anomalies: [],

  setConnectionPhase: (phase) => set({ connectionPhase: phase }),

  applySnapshot: (round, bets, lastRounds) =>
    set({
      round,
      lastRounds,
      bets: new Map(bets.map((b) => [b.id, serverBetToClient(b)])),
    }),

  applyBettingOpen: (roundId, endsAt) =>
    set((s) => ({
      round: s.round
        ? { ...s.round, roundId, phase: 'betting', phaseEndsAt: endsAt }
        : { roundId, phase: 'betting', multiplier: 1, phaseEndsAt: endsAt },
      bets: new Map(),
    })),

  applyRoundStart: (roundId) =>
    set((s) => ({
      round: s.round
        ? { ...s.round, roundId, phase: 'flight', phaseEndsAt: null }
        : { roundId, phase: 'flight', multiplier: 1, phaseEndsAt: null },
    })),

  applyMultiplierTick: (value) =>
    set((s) => ({
      round: s.round ? { ...s.round, multiplier: value } : null,
    })),

  applyRoundCrash: (crashMultiplier) =>
    set((s) => ({
      round: s.round ? { ...s.round, phase: 'crashed', multiplier: crashMultiplier } : null,
      lastRounds: s.round
        ? [crashMultiplier, ...s.lastRounds].slice(0, 6)
        : s.lastRounds,
    })),

  applyBetsPlaced: (bets) =>
    set((s) => {
      const next = new Map(s.bets)
      for (const b of bets) next.set(b.id, serverBetToClient(b))
      return { bets: next }
    }),

  applyBetUpdates: (updates) =>
    set((s) => {
      const next = new Map(s.bets)
      for (const u of updates) {
        const existing = next.get(u.betId)
        if (existing) next.set(u.betId, { ...existing, status: 'cashed_out', cashedAt: u.cashedAt })
      }
      return { bets: next }
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
