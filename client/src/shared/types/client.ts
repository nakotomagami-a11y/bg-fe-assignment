export type ClientBetStatus = 'active' | 'cashed_out' | 'lost'

export type ClientBet = {
  id: string
  player: string
  amount: number
  status: ClientBetStatus
  cashedAt: number | null
  isYou?: boolean
  changedAt?: { status?: number; cashedAt?: number }
}

export type PlayerBet = {
  clientBetId: string
  betId: string | null
  amount: number
  status: 'pending' | 'active' | 'cashed_out' | 'rejected' | 'lost'
  cashedAt: number | null
  rejectReason: string | null
}

export type ConnectionPhase = 'connecting' | 'live' | 'reconnecting' | 'recovering'

export type AnomalyEntry = {
  at: number
  kind: 'duplicate' | 'out_of_order' | 'gap' | 'reconnect' | 'snapshot_reset' | 'server_error'
  detail: string
}

export type WsStats = {
  lastSeq: number
  duplicatesDropped: number
  outOfOrderFixed: number
  gapsDetected: number
  reconnects: number
}
