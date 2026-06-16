import { describe, it, expect } from 'vitest'
import { createBuffer, feed, reset } from './seqBuffer'

const msg = (seq: number) => ({ seq, type: 'test', payload: null })

describe('seqBuffer', () => {
  describe('in-order delivery', () => {
    it('processes messages that arrive in sequence', () => {
      let state = createBuffer(0)

      const r1 = feed(state, msg(1))
      expect(r1.dispatched).toEqual([msg(1)])
      expect(r1.droppedDuplicate).toBe(false)
      expect(r1.gapDetected).toBe(false)

      const r2 = feed(r1.state, msg(2))
      expect(r2.dispatched).toEqual([msg(2)])
    })
  })

  describe('duplicate detection', () => {
    it('drops a message with a seq already processed', () => {
      let state = createBuffer(0)
      state = feed(state, msg(1)).state

      const r = feed(state, msg(1))
      expect(r.dispatched).toEqual([])
      expect(r.droppedDuplicate).toBe(true)
    })

    it('drops messages with seq below nextSeq', () => {
      let state = createBuffer(10)
      const r = feed(state, msg(5))
      expect(r.droppedDuplicate).toBe(true)
      expect(r.dispatched).toEqual([])
    })
  })

  describe('out-of-order delivery', () => {
    it('buffers a message that arrives ahead of the expected seq', () => {
      const state = createBuffer(0)
      const r = feed(state, msg(2))
      expect(r.dispatched).toEqual([])
      expect(r.gapDetected).toBe(true)
    })

    it('drains buffered messages once the gap fills', () => {
      let state = createBuffer(0)

      // 2 arrives before 1
      const r1 = feed(state, msg(2))
      expect(r1.dispatched).toEqual([])

      // 1 arrives — should dispatch 1 then immediately drain 2
      const r2 = feed(r1.state, msg(1))
      expect(r2.dispatched).toEqual([msg(1), msg(2)])
      expect(r2.outOfOrderFixed).toBe(1)
    })

    it('drains multiple buffered messages when gap fills', () => {
      let state = createBuffer(0)
      state = feed(state, msg(3)).state
      state = feed(state, msg(4)).state
      state = feed(state, msg(2)).state

      const r = feed(state, msg(1))
      expect(r.dispatched).toEqual([msg(1), msg(2), msg(3), msg(4)])
      expect(r.outOfOrderFixed).toBe(3)
    })
  })

  describe('snapshot reset', () => {
    it('discards buffered messages with seq at or below the snapshot seq', () => {
      let state = createBuffer(0)
      state = feed(state, msg(3)).state
      state = feed(state, msg(5)).state

      // snapshot arrives at seq 4 — everything ≤ 4 is stale
      state = reset(4)

      // seq 3 should now be a duplicate (below nextSeq of 5)
      const r3 = feed(state, msg(3))
      expect(r3.droppedDuplicate).toBe(true)

      // seq 5 should process normally
      const r5 = feed(state, msg(5))
      expect(r5.dispatched).toEqual([msg(5)])
    })

    it('starts fresh after reset', () => {
      const state = reset(100)
      const r = feed(state, msg(101))
      expect(r.dispatched).toEqual([msg(101)])
    })
  })
})
