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
