import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAnchor, timeUntil } from './clockSkew'

describe('clockSkew', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the correct time remaining when clocks are in sync', () => {
    vi.setSystemTime(1000)
    const anchor = createAnchor(1000)
    const endsAt = 6000

    expect(timeUntil(anchor, endsAt)).toBe(5000)
  })

  it('accounts for local time elapsed since the anchor was created', () => {
    vi.setSystemTime(1000)
    const anchor = createAnchor(1000)

    vi.setSystemTime(2000) // 1 second passes locally
    const endsAt = 6000

    // estimated server now = 1000 + (2000 - 1000) = 2000
    expect(timeUntil(anchor, endsAt)).toBe(4000)
  })

  it('handles server clock ahead of local clock', () => {
    vi.setSystemTime(1000)
    // server is 5 seconds ahead
    const anchor = createAnchor(6000)

    const endsAt = 11000 // 5 seconds from server's perspective

    // estimated server now = 6000 + (1000 - 1000) = 6000
    expect(timeUntil(anchor, endsAt)).toBe(5000)
  })

  it('returns negative when deadline has passed', () => {
    vi.setSystemTime(1000)
    const anchor = createAnchor(1000)

    vi.setSystemTime(8000)
    const endsAt = 6000

    expect(timeUntil(anchor, endsAt)).toBeLessThan(0)
  })
})
