export type SeqBufferState = {
  nextSeq: number
  pending: Map<number, { seq: number }>
}

export type FeedResult<T extends { seq: number }> = {
  state: SeqBufferState
  dispatched: T[]
  droppedDuplicate: boolean
  gapDetected: boolean
  outOfOrderFixed: number
}

export function createBuffer(afterSeq: number): SeqBufferState {
  return { nextSeq: afterSeq + 1, pending: new Map() }
}

export function feed<T extends { seq: number }>(
  state: SeqBufferState,
  msg: T,
): FeedResult<T> {
  const { seq } = msg

  if (seq < state.nextSeq) {
    return { state, dispatched: [], droppedDuplicate: true, gapDetected: false, outOfOrderFixed: 0 }
  }

  if (seq > state.nextSeq) {
    const pending = new Map(state.pending)
    pending.set(seq, msg)
    return {
      state: { ...state, pending },
      dispatched: [],
      droppedDuplicate: false,
      gapDetected: true,
      outOfOrderFixed: 0,
    }
  }

  // seq === nextSeq: process it and drain anything that was waiting
  const dispatched: T[] = [msg]
  let nextSeq = state.nextSeq + 1
  const pending = new Map(state.pending)
  let outOfOrderFixed = 0

  while (pending.has(nextSeq)) {
    dispatched.push(pending.get(nextSeq) as T)
    pending.delete(nextSeq)
    nextSeq++
    outOfOrderFixed++
  }

  return {
    state: { nextSeq, pending },
    dispatched,
    droppedDuplicate: false,
    gapDetected: false,
    outOfOrderFixed,
  }
}

export function reset(afterSeq: number): SeqBufferState {
  return createBuffer(afterSeq)
}
