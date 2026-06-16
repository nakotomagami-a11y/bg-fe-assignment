import { useRef } from 'react'
import { useGameStore } from '@/shared/hooks/useGameStore'
import { useVirtualList } from '../hooks/useVirtualList'
import { BetRow } from './BetRow'

const ROW_H = 40

export function BetsTable() {
  // betIds reference only changes when bets are added or cleared — not on status
  // updates or multiplier ticks. O(1) reference check; no Array.from or shallow compare.
  const betIds = useGameStore((s) => s.betIds)
  const count = betIds.length

  const parentRef = useRef<HTMLDivElement>(null)

  const { items, totalHeight } = useVirtualList(parentRef, {
    count,
    itemHeight: ROW_H,
    getItemKey: (i) => betIds[i],
    overscan: 3,
  })

  return (
    <div className="rounded-xl border border-line bg-panel flex flex-col min-h-0 overflow-hidden">
      {/* Panel title */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 shrink-0">
        <span className="text-label tracking-allcaps uppercase text-txt-dim">Live bets</span>
        {count > 0 && (
          <span className="font-mono text-[10px] text-txt-faint bg-white/6 rounded-full px-2 py-0.5 leading-none">
            {count.toLocaleString()}
          </span>
        )}
      </div>

      {/* Column header */}
      <div className="grid grid-cols-[1fr_72px_58px_86px] px-4 pb-2 shrink-0 border-b border-line">
        {(['Player', 'Bet', '×', 'Payout'] as const).map((h, i) => (
          <span
            key={h}
            className={`text-[10px] font-mono uppercase tracking-allcaps text-txt-faint ${i > 0 ? 'text-right' : ''}`}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Virtual scroll container */}
      <div ref={parentRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {count === 0 ? (
          <div className="flex items-center justify-center h-20 text-txt-faint text-xs font-mono">
            Waiting for bets…
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            {items.map((item) => (
              <div
                key={item.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <BetRow betId={betIds[item.index]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
