import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketClient, type WsCallbacks } from './client'

// --- Mock WebSocket ---

const instances: MockWs[] = []

class MockWs {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = 0
  onopen: ((e: Event) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  send = vi.fn()
  close = vi.fn()

  constructor(_url: string) {
    instances.push(this)
  }

  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }

  receive(msg: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(msg) }))
  }

  drop() {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
  }
}

vi.stubGlobal('WebSocket', MockWs)

// --- Fixtures ---

const mkCbs = () =>
  ({
    onMessage: vi.fn(),
    onConnectionPhase: vi.fn(),
    onStats: vi.fn(),
    onAnomaly: vi.fn(),
  }) satisfies WsCallbacks

const tick = (seq: number) => ({
  seq,
  serverTime: 1000,
  type: 'multiplier_tick' as const,
  payload: { value: 1.5 },
})

const snap = (seq: number) => ({
  seq,
  serverTime: 1000,
  type: 'snapshot' as const,
  payload: {
    round: { roundId: 1, phase: 'flight' as const, multiplier: 1.5, phaseEndsAt: null },
    bets: [],
    lastRounds: [],
  },
})

// --- Tests ---

describe('WebSocketClient', () => {
  beforeEach(() => {
    instances.length = 0
  })

  describe('connection lifecycle', () => {
    it('emits connecting then live once snapshot arrives', () => {
      const cbs = mkCbs()
      const client = new WebSocketClient('ws://test', cbs)
      client.connect()

      instances[0].open()
      expect(cbs.onConnectionPhase).toHaveBeenCalledWith('connecting')
      expect(cbs.onConnectionPhase).not.toHaveBeenCalledWith('live')

      instances[0].receive(snap(0))
      expect(cbs.onConnectionPhase).toHaveBeenCalledWith('live')

      client.destroy()
    })
  })

  describe('message routing', () => {
    it('discards buffered msgs below snapshot seq on reset', () => {
      const cbs = mkCbs()
      const client = new WebSocketClient('ws://test', cbs)
      client.connect()
      instances[0].open()
      instances[0].receive(snap(0))

      instances[0].receive(tick(5)) // buffered — gap at seq 1–4
      expect(cbs.onMessage).toHaveBeenCalledTimes(1)

      instances[0].receive(snap(10)) // seq 5 is now stale
      expect(cbs.onMessage).toHaveBeenCalledTimes(2)

      instances[0].receive(tick(11)) // normal delivery after reset
      expect(cbs.onMessage).toHaveBeenCalledTimes(3)

      instances[0].receive(tick(5)) // treated as duplicate
      expect(cbs.onMessage).toHaveBeenCalledTimes(3)
      expect(cbs.onStats).toHaveBeenCalledWith({ duplicatesDropped: 1 })

      client.destroy()
    })
  })

  describe('reconnect backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0.5) // Math.random() = 0.5 → jitter = 0
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('delays reconnects at 1 s → 2 s → 4 s for consecutive failures', () => {
      const cbs = mkCbs()
      const client = new WebSocketClient('ws://test', cbs)
      client.connect()

      // Drop without getting a snapshot each time so attempt counter keeps growing
      instances[0].open()
      instances[0].drop()

      vi.advanceTimersByTime(999)
      expect(instances).toHaveLength(1) // not yet
      vi.advanceTimersByTime(2)
      expect(instances).toHaveLength(2) // attempt 1 fired at 1000ms

      instances[1].open()
      instances[1].drop()

      vi.advanceTimersByTime(1999)
      expect(instances).toHaveLength(2)
      vi.advanceTimersByTime(2)
      expect(instances).toHaveLength(3) // attempt 2 fired at 2000ms

      instances[2].open()
      instances[2].drop()

      vi.advanceTimersByTime(3999)
      expect(instances).toHaveLength(3)
      vi.advanceTimersByTime(2)
      expect(instances).toHaveLength(4) // attempt 3 fired at 4000ms

      client.destroy()
    })

    it('resets backoff after a successful reconnect', () => {
      const cbs = mkCbs()
      const client = new WebSocketClient('ws://test', cbs)
      client.connect()

      instances[0].open()
      instances[0].receive(snap(0))
      instances[0].drop()

      vi.advanceTimersByTime(1001) // first reconnect
      instances[1].open()
      instances[1].receive(snap(1)) // successfully reconnected — attempt resets to 0
      instances[1].drop()

      // Next disconnect should start back at 1s, not 2s
      vi.advanceTimersByTime(999)
      expect(instances).toHaveLength(2)
      vi.advanceTimersByTime(2)
      expect(instances).toHaveLength(3) // back to 1000ms, not 2000ms

      client.destroy()
    })

    it('emits reconnecting on each attempt', () => {
      const cbs = mkCbs()
      const client = new WebSocketClient('ws://test', cbs)
      client.connect()

      instances[0].open()
      instances[0].receive(snap(0))
      instances[0].drop()
      vi.runAllTimers()

      expect(cbs.onConnectionPhase).toHaveBeenCalledWith('reconnecting')

      client.destroy()
    })

    it('does not reconnect after destroy', () => {
      const cbs = mkCbs()
      const client = new WebSocketClient('ws://test', cbs)
      client.connect()

      instances[0].open()
      instances[0].receive(snap(0))
      client.destroy()
      instances[0].drop() // onclose fires but dead flag stops it

      vi.runAllTimers()
      expect(instances).toHaveLength(1)
    })
  })
})
