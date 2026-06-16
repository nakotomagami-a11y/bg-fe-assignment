import type { AnyServerMessage, ClientCommand } from '@server/protocol/protocol'
import type { ConnectionPhase, WsStats, AnomalyEntry } from '@/lib/types/client'
import { createBuffer, feed, reset, type SeqBufferState } from './seqBuffer'
import { createAnchor, type TimeAnchor } from './clockSkew'

// Replies share the current seq but don't increment it — outside the broadcast stream.
// Feeding them into seqBuffer would make them look like duplicates.
const REPLY_TYPES = new Set([
  'bet_accepted',
  'bet_rejected',
  'cashout_accepted',
  'cashout_rejected',
  'error',
])

const BACKOFF_BASE_MS = 1_000
const BACKOFF_CAP_MS = 30_000
const BACKOFF_JITTER = 0.25

export type WsCallbacks = {
  onMessage: (msg: AnyServerMessage, anchor: TimeAnchor) => void
  onConnectionPhase: (phase: ConnectionPhase) => void
  onStats: (patch: Partial<WsStats>) => void
  onAnomaly: (entry: AnomalyEntry) => void
}

export class WebSocketClient {
  private url: string
  private cb: WsCallbacks
  private ws: WebSocket | null = null
  private buf: SeqBufferState = createBuffer(0)
  private anchor: TimeAnchor = createAnchor(Date.now())
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private dead = false

  constructor(url: string, callbacks: WsCallbacks) {
    this.url = url
    this.cb = callbacks
  }

  connect() {
    if (this.dead) return
    this.openSocket()
  }

  send(cmd: ClientCommand) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd))
    }
  }

  destroy() {
    this.dead = true // gates onclose so the reconnect loop can't restart after teardown
    this.clearTimer()
    this.ws?.close()
    this.ws = null
  }

  private openSocket() {
    this.cb.onConnectionPhase(this.attempt === 0 ? 'connecting' : 'reconnecting')

    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      // Don't emit 'live' here — wait for snapshot to confirm full state sync
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: AnyServerMessage
      try {
        msg = JSON.parse(event.data) as AnyServerMessage
      } catch {
        return
      }

      this.anchor = createAnchor(msg.serverTime)

      if (msg.type === 'snapshot') {
        // Discard anything buffered before the snapshot — it's already accounted for
        this.buf = reset(msg.seq)
        this.attempt = 0
        this.cb.onConnectionPhase('live')
        this.cb.onMessage(msg, this.anchor)
        return
      }

      if (REPLY_TYPES.has(msg.type)) {
        this.cb.onMessage(msg, this.anchor)
        return
      }

      const result = feed(this.buf, msg)
      this.buf = result.state

      if (result.droppedDuplicate) {
        this.cb.onStats({ duplicatesDropped: 1 })
        this.cb.onAnomaly({ at: Date.now(), kind: 'duplicate', detail: `seq ${msg.seq} already seen` })
        return
      }

      if (result.gapDetected) {
        this.cb.onStats({ gapsDetected: 1 })
        this.cb.onAnomaly({ at: Date.now(), kind: 'gap', detail: `gap before seq ${msg.seq}` })
      }

      if (result.outOfOrderFixed > 0) {
        this.cb.onStats({ outOfOrderFixed: result.outOfOrderFixed })
        this.cb.onAnomaly({
          at: Date.now(),
          kind: 'out_of_order',
          detail: `recovered ${result.outOfOrderFixed} buffered msg(s)`,
        })
      }

      for (const dispatched of result.dispatched) {
        this.cb.onStats({ lastSeq: dispatched.seq })
        this.cb.onMessage(dispatched as AnyServerMessage, this.anchor)
      }
    }

    ws.onclose = () => {
      if (this.dead) return
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose always fires after onerror, so reconnect logic lives there
    }
  }

  private scheduleReconnect() {
    this.attempt++
    this.cb.onStats({ reconnects: 1 })
    this.cb.onAnomaly({ at: Date.now(), kind: 'reconnect', detail: `attempt ${this.attempt}` })

    // Jitter spreads simultaneous reconnects across clients so they don't pile on the server
    const base = Math.min(BACKOFF_BASE_MS * 2 ** (this.attempt - 1), BACKOFF_CAP_MS)
    const jitter = base * BACKOFF_JITTER * (Math.random() * 2 - 1)
    const delay = Math.round(base + jitter)

    this.timer = setTimeout(() => this.openSocket(), delay)
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
