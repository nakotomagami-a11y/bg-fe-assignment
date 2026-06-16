import { useEffect, useState } from 'react'
import { match, P } from 'ts-pattern'
import { useGameStore } from '@/shared/hooks/useGameStore'
import { anchor } from '@/ws/wsService'
import { useFpsMonitor } from '../hooks/useFpsMonitor'
import type { AnomalyEntry } from '@/shared/types/client'

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return <div className="w-35 h-8 bg-white/3 rounded" />
  const W = 140, H = 32
  const maxMs = Math.max(...data, 33.3)
  const barW = W / data.length

  return (
    <svg width={W} height={H} className="block">
      {data.map((ms, i) => {
        const bh = Math.max(1, (ms / maxMs) * H)
        const fill = ms > 20 ? '#ff3a55' : ms > 16.7 ? '#ffb524' : '#1fe07a'
        return (
          <rect
            key={i}
            x={i * barW}
            y={H - bh}
            width={Math.max(1, barW - 0.5)}
            height={bh}
            fill={fill}
            opacity={0.75}
          />
        )
      })}
    </svg>
  )
}

// ─── DevModal ─────────────────────────────────────────────────────────────────

function anomalyColor(entry: AnomalyEntry): string {
  return match(entry.kind)
    .with(P.union('gap', 'server_error'), () => 'text-red')
    .with('reconnect', () => 'text-amber')
    .with(P.union('duplicate', 'out_of_order', 'snapshot_reset'), () => 'text-txt-dim')
    .exhaustive()
}

export function DevModal({ onClose }: { onClose: () => void }) {
  const stats = useGameStore((s) => s.stats)
  const anomalies = useGameStore((s) => s.anomalies)
  const connectionPhase = useGameStore((s) => s.connectionPhase)
  const { fps, frameMs, buffer } = useFpsMonitor(true)

  const [drift, setDrift] = useState(() => anchor.serverTime - anchor.localTime)

  useEffect(() => {
    const id = setInterval(
      () => setDrift(anchor.serverTime - anchor.localTime),
      250,
    )
    return () => clearInterval(id)
  }, [])

  const phaseColor = match(connectionPhase)
    .with('live', () => 'text-green')
    .with('reconnecting', () => 'text-amber')
    .with(P.union('recovering', 'connecting'), () => 'text-red')
    .exhaustive()

  const statRows: [string, React.ReactNode][] = [
    ['Phase', <span className={phaseColor}>{connectionPhase}</span>],
    ['Last seq', stats.lastSeq.toLocaleString()],
    ['Clock drift', `${drift >= 0 ? '+' : ''}${drift} ms`],
    ['Duplicates dropped', stats.duplicatesDropped],
    ['Out-of-order fixed', stats.outOfOrderFixed],
    ['Gaps detected', stats.gapsDetected],
    ['Reconnects', stats.reconnects],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-5">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-115 max-h-[calc(100vh-40px)] flex flex-col rounded-xl border border-line-2 bg-panel-2 overflow-hidden"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.85)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <span className="text-label tracking-allcaps uppercase text-txt-dim font-medium">
            Dev monitor
          </span>
          <button
            onClick={onClose}
            className="size-6 flex items-center justify-center rounded text-txt-faint hover:text-txt hover:bg-white/8 cursor-pointer transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* Connection stats */}
          <section className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-mono uppercase tracking-allcaps text-txt-faint mb-3">
              Connection
            </p>
            <div className="space-y-2">
              {statRows.map(([label, value]) => (
                <div key={String(label)} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-txt-faint">{label}</span>
                  <span className="font-mono text-xs text-txt">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Performance */}
          <section className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-mono uppercase tracking-allcaps text-txt-faint mb-3">
              Performance
            </p>
            <div className="flex items-end justify-between">
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] text-txt-faint mb-1">FPS</p>
                  <p className="font-mono text-2xl font-medium text-txt">{fps}</p>
                </div>
                <div>
                  <p className="text-[10px] text-txt-faint mb-1">Frame</p>
                  <p className="font-mono text-2xl font-medium text-txt">
                    {frameMs}
                    <span className="text-txt-faint text-xs font-normal ml-0.5">ms</span>
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-txt-faint mb-1.5 text-right">Last {buffer.length} frames</p>
                <Sparkline data={buffer} />
              </div>
            </div>
          </section>

          {/* Event log */}
          <section className="px-5 py-4">
            <p className="text-[10px] font-mono uppercase tracking-allcaps text-txt-faint mb-3 flex items-center gap-2">
              Event log
              {anomalies.length > 0 && (
                <span className="font-mono text-red bg-red/12 rounded-full px-1.5 py-0.5 text-[9px] leading-none">
                  {anomalies.length}
                </span>
              )}
            </p>
            {match(anomalies)
              .with([], () => (
                <p className="text-xs text-txt-faint font-mono">No events recorded.</p>
              ))
              .otherwise((entries) => (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {entries.map((a, i) => (
                    <div key={i} className="flex gap-2 text-label font-mono">
                      <span className="shrink-0 w-20 text-txt-faint tabular-nums">
                        {new Date(a.at).toISOString().slice(11, 23)}
                      </span>
                      <span className={`shrink-0 w-24 ${anomalyColor(a)}`}>{a.kind}</span>
                      <span className="text-txt-dim truncate" title={a.detail}>{a.detail}</span>
                    </div>
                  ))}
                </div>
              ))
            }
          </section>

        </div>
      </div>
    </div>
  )
}
