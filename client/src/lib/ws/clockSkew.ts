// NAMING #6: this module is called clockSkew but it estimates server time, not skew.
// `timeUntil` also doesn't say whose clock `endsAt` is in. Better names:
// module → serverTime.ts, function → msUntilServerTime.

export type TimeAnchor = {
  serverTime: number
  localTime: number
}

export function createAnchor(serverTime: number): TimeAnchor {
  return { serverTime, localTime: Date.now() }
}

export function timeUntil(anchor: TimeAnchor, endsAt: number): number {
  const estimatedServerNow = anchor.serverTime + (Date.now() - anchor.localTime)
  return endsAt - estimatedServerNow
}
