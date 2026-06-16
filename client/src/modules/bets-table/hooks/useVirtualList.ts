import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface VirtualItem {
  index: number
  key: string | number
  start: number  // px offset from top of container
  size: number
}

interface Options {
  count: number
  itemHeight: number
  getItemKey: (index: number) => string | number
  overscan?: number
}

/**
 * Vanilla virtual-list pattern from patterns.dev/vanilla/virtual-lists:
 *   - Track scrollTop of the scroll element
 *   - Compute which indexes are in [scrollTop, scrollTop + clientHeight]
 *   - Return only those items with their absolute y offsets
 *   - rAF-throttle the scroll listener so we process at most one update
 *     per animation frame and avoid fighting the browser's paint cycle
 */
export function useVirtualList(
  scrollRef: React.RefObject<HTMLElement | null>,
  { count, itemHeight, getItemKey, overscan = 3 }: Options,
) {
  const [range, setRange] = useState({ start: 0, end: 30 })
  const rafRef = useRef<number | null>(null)

  const recompute = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, clientHeight } = el
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(
      count - 1,
      Math.ceil((scrollTop + clientHeight) / itemHeight) + overscan,
    )
    // Only re-render when the window actually shifts — avoids renders on every
    // sub-item-height scroll pixel.
    setRange((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    )
  }, [scrollRef, count, itemHeight, overscan])

  // Seed synchronously before first paint so we don't render 30 off-screen rows
  useLayoutEffect(() => { recompute() }, [recompute])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function onScroll() {
      if (rafRef.current !== null) return   // already scheduled this frame
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        recompute()
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [recompute, scrollRef])

  // Recompute when the list grows (new bets added)
  useEffect(() => { recompute() }, [count, recompute])

  const items: VirtualItem[] = []
  for (let i = range.start; i <= Math.min(range.end, count - 1); i++) {
    items.push({ index: i, key: getItemKey(i), start: i * itemHeight, size: itemHeight })
  }

  return { items, totalHeight: count * itemHeight }
}
