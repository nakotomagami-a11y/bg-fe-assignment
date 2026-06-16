import { useState, useEffect } from 'react'
import { cn } from '@/shared/utils/cn'
import { match, P } from 'ts-pattern'
import { useGameStore } from '@/shared/hooks/useGameStore'
import { wsClient, anchor } from '@/ws/wsService'
import { timeUntil } from '@/ws/clockSkew'

const MIN = 1
const MAX = 500
const PRESETS = [10, 25, 50, 100]

let betSeq = 0
const nextClientBetId = () => `c${++betSeq}-${Date.now()}`

function clamp(v: number) {
  return Math.max(MIN, Math.min(MAX, Math.round(v * 100) / 100))
}

// ─── Status ───────────────────────────────────────────────────────────────────

type BetFormStatus =
  | { kind: 'ready'; endsAt?: number | null }
  | { kind: 'pending' }
  | { kind: 'waiting'; endsAt?: number | null }
  | { kind: 'rejected'; reason: string | null; onDismiss: () => void }
  | { kind: 'cashout'; amount: number; multiplier: number; cashing: boolean }
  | { kind: 'won'; cashedAt: number; payout: number }
  | { kind: 'lost'; crashAt: number; betAmount: number }
  | { kind: 'locked'; label: string; sub?: string }

// ─── BetForm ─────────────────────────────────────────────────────────────────

const STEPPERS = [
  { label: '½', fn: (a: number) => a / 2 },
  { label: '2×', fn: (a: number) => a * 2 },
  { label: 'MAX', fn: () => MAX },
]

function BetForm({
  onPlace,
  onCashOut,
  status,
}: {
  onPlace: (amount: number) => void
  onCashOut: () => void
  status: BetFormStatus
}) {
  const [amount, setAmount] = useState(50)
  const [inputVal, setInputVal] = useState('50.00')
  const [countdown, setCountdown] = useState('')

  const inputDisabled = status.kind !== 'ready'

  const endsAt =
    status.kind === 'ready' || status.kind === 'waiting' ? (status.endsAt ?? null) : null

  useEffect(() => {
    if (endsAt == null) { setCountdown(''); return }
    const tick = () =>
      setCountdown(Math.max(0, timeUntil(anchor, endsAt) / 1000).toFixed(1) + 's')
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [endsAt])

  function set(v: number) {
    const c = clamp(v)
    setAmount(c)
    setInputVal(c.toFixed(2))
  }

  // ─── Hint ────────────────────────────────────────────────────────────────────

  const hint = match(status)
    .with({ kind: P.union('ready', 'pending', 'waiting', 'rejected') }, () => ({
      pip: 'bg-amber shadow-glow-amber',
      text: 'pending → confirmed / rejected',
    }))
    .with({ kind: 'cashout' }, () => ({
      pip: 'bg-green shadow-glow-green',
      text: 'lock your multiplier before it busts',
    }))
    .with({ kind: 'won' }, () => ({
      pip: 'bg-green',
      text: 'settled · provably fair',
    }))
    .otherwise(() => ({
      pip: 'bg-txt-faint',
      text: 'settling round · provably fair',
    }))

  // ─── Shared button shell ──────────────────────────────────────────────────────

  const btnBase =
    'mt-3.5 w-full rounded-[14px] py-[18px] px-5 text-[18px] font-semibold leading-none flex items-center justify-center gap-2.5 transition-transform border-0'
  const btnSub = 'font-mono font-medium opacity-70 text-sm'

  // ─── Action button ────────────────────────────────────────────────────────────

  const actionBtn = match(status)
    .with({ kind: 'ready' }, () => (
      <button
        onClick={() => onPlace(amount)}
        className={`${btnBase} text-[#0a0c12] cursor-pointer hover:-translate-y-px active:translate-y-px`}
        style={{
          background: 'linear-gradient(180deg,var(--acid),#a9e818)',
          boxShadow: '0 0 30px rgba(198,255,53,.35)',
        }}
      >
        Bet next round
        {countdown && <small className={btnSub}>· {countdown}</small>}
      </button>
    ))
    .with({ kind: 'pending' }, () => (
      <button disabled className={`${btnBase} bg-white/6 text-txt-dim cursor-default`}>
        <span className="size-1.75 rounded-full bg-amber shadow-glow-amber animate-pulse shrink-0" />
        Confirming bet…
      </button>
    ))
    .with({ kind: 'waiting' }, () => (
      <button disabled className={`${btnBase} bg-white/6 text-txt-dim cursor-default`}>
        Bet locked
        {countdown && <small className={btnSub}>· take-off in {countdown}</small>}
      </button>
    ))
    .with({ kind: 'rejected' }, ({ reason, onDismiss }) => (
      <button
        onClick={onDismiss}
        className={`${btnBase} cursor-pointer border border-red/30`}
        style={{ background: 'rgba(255,58,85,.14)', color: 'var(--red-soft)' }}
      >
        {reason ? `Bet rejected — ${reason.replace(/_/g, ' ')}` : 'Bet rejected — tap to retry'}
      </button>
    ))
    .with({ kind: 'cashout' }, ({ amount: a, multiplier: m, cashing }) => (
      <button
        onClick={onCashOut}
        disabled={cashing}
        className={`${btnBase} text-[#04140b] cursor-pointer hover:-translate-y-px active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed`}
        style={{
          background: 'linear-gradient(180deg,var(--green),#13b863)',
          boxShadow: '0 0 34px rgba(31,224,122,.45)',
        }}
      >
        {cashing ? (
          'Cashing out…'
        ) : (
          <>
            Cash out
            <small className={btnSub}>· ${a.toFixed(2)} → ${(a * m).toFixed(2)}</small>
          </>
        )}
      </button>
    ))
    .with({ kind: 'won' }, ({ cashedAt, payout }) => (
      <button
        disabled
        className={`${btnBase} cursor-default border border-green/30`}
        style={{ background: 'rgba(31,224,122,.14)', color: 'var(--green-2)' }}
      >
        Cashed @ {cashedAt.toFixed(2)}×
        <small className={btnSub}>· +${payout.toFixed(2)}</small>
      </button>
    ))
    .with({ kind: 'lost' }, ({ crashAt, betAmount }) => (
      <button
        disabled
        className={`${btnBase} cursor-default border border-red/30`}
        style={{ background: 'rgba(255,58,85,.14)', color: 'var(--red-soft)' }}
      >
        Busted @ {crashAt.toFixed(2)}×
        <small className={btnSub}>· −${betAmount.toFixed(2)}</small>
      </button>
    ))
    .with({ kind: 'locked' }, ({ label, sub }) => (
      <button disabled className={`${btnBase} bg-white/4 text-txt-faint cursor-default`}>
        {label}
        {sub && <small className={btnSub}>· {sub}</small>}
      </button>
    ))
    .exhaustive()

  return (
    <div className="flex flex-col p-[18px]">
      {/* Section title */}
      <span className="text-label tracking-allcaps uppercase text-txt-dim mb-[13px]">
        Place bet
      </span>

      {/* Amount input */}
      <div
        className={cn(
          'flex items-center gap-2.5 border border-line-2 rounded-[13px] px-[15px] py-[13px] bg-black/25 transition-colors',
          inputDisabled ? 'opacity-50' : 'focus-within:border-acid/50',
        )}
      >
        <span className="text-acid text-[15px] font-semibold shrink-0">$</span>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={() => {
            if (inputDisabled) return
            const n = parseFloat(inputVal)
            if (!isNaN(n)) set(n)
            else setInputVal(amount.toFixed(2))
          }}
          inputMode="decimal"
          disabled={inputDisabled}
          className="flex-1 bg-transparent outline-none font-mono text-2xl font-medium text-txt tabular-nums w-full"
        />
      </div>

      {/* Steppers: ½  2×  MAX */}
      <div className="flex gap-[7px] mt-2.5">
        {STEPPERS.map(({ label, fn }) => (
          <button
            key={label}
            onClick={() => set(fn(amount))}
            disabled={inputDisabled}
            className={cn(
              'flex-1 py-2 font-mono text-xs font-semibold text-txt-dim rounded-lg border border-line bg-white/4 transition-[color,background,border-color] active:translate-y-px',
              inputDisabled
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-pointer hover:text-txt hover:bg-white/8 hover:border-line-2',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Quick presets */}
      <div className="flex gap-[7px] mt-2">
        {PRESETS.map((p) => {
          const on = !inputDisabled && amount === p
          return (
            <button
              key={p}
              onClick={() => set(p)}
              disabled={inputDisabled}
              className={cn(
                'flex-1 py-[9px] font-mono text-[13px] rounded-lg border transition-[color,background,border-color]',
                on
                  ? 'bg-acid border-acid text-[#0b0d13] font-semibold cursor-pointer'
                  : inputDisabled
                    ? 'text-txt-dim bg-white/3 border-line opacity-40 cursor-not-allowed'
                    : 'text-txt-dim bg-white/3 border-line cursor-pointer hover:text-acid hover:border-acid/35',
              )}
            >
              {p}
            </button>
          )
        })}
      </div>

      {actionBtn}

      {/* Hint */}
      <div className="mt-[11px] flex items-center justify-center gap-[7px] font-mono text-xs text-txt-faint">
        <span className={`shrink-0 size-1.5 rounded-full ${hint.pip}`} />
        {hint.text}
      </div>
    </div>
  )
}

// ─── BetPanel ─────────────────────────────────────────────────────────────────

export function BetPanel() {
  const phase = useGameStore((s) => s.round?.phase)
  const multiplier = useGameStore((s) => s.round?.multiplier ?? 1)
  const endsAt = useGameStore((s) => s.round?.phaseEndsAt)
  const playerBet = useGameStore((s) => s.playerBet)
  const setPlayerBet = useGameStore((s) => s.setPlayerBet)

  const [cashing, setCashing] = useState(false)

  useEffect(() => {
    if (playerBet?.status !== 'active') setCashing(false)
  }, [playerBet?.status])

  function placeBet(amount: number) {
    if (phase !== 'betting' || playerBet) return
    const clientBetId = nextClientBetId()
    wsClient.send({ type: 'place_bet', clientBetId, amount })
    setPlayerBet({ clientBetId, betId: null, amount, status: 'pending', cashedAt: null, rejectReason: null })
  }

  function cashOut() {
    if (!playerBet?.betId || cashing) return
    wsClient.send({ type: 'cash_out', betId: playerBet.betId })
    setCashing(true)
  }

  const status: BetFormStatus = match({ phase, bet: playerBet })
    .with({ phase: P.nullish }, () => ({ kind: 'locked' as const, label: 'Connecting…' }))
    .with({ bet: { status: 'pending' } }, () => ({ kind: 'pending' as const }))
    .with({ bet: { status: 'rejected' } }, ({ bet: b }) => ({
      kind: 'rejected' as const,
      reason: b.rejectReason,
      onDismiss: () => setPlayerBet(null),
    }))
    .with({ phase: 'betting', bet: { status: 'active' } }, () => ({
      kind: 'waiting' as const,
      endsAt,
    }))
    .with({ phase: 'flight', bet: { status: 'active' } }, ({ bet: b }) => ({
      kind: 'cashout' as const,
      amount: b.amount,
      multiplier,
      cashing,
    }))
    .with({ bet: { status: 'cashed_out', cashedAt: P.number } }, ({ bet: b }) => ({
      kind: 'won' as const,
      cashedAt: b.cashedAt,
      payout: b.amount * b.cashedAt,
    }))
    .with({ bet: { status: 'lost' } }, ({ bet: b }) => ({
      kind: 'lost' as const,
      crashAt: multiplier,
      betAmount: b.amount,
    }))
    .with({ phase: 'flight' }, () => ({
      kind: 'locked' as const,
      label: 'Round in progress',
      sub: `×${multiplier.toFixed(2)}`,
    }))
    .with({ phase: 'crashed' }, () => ({
      kind: 'locked' as const,
      label: `Crashed @ ${multiplier.toFixed(2)}×`,
    }))
    .with({ phase: 'pause' }, () => ({
      kind: 'locked' as const,
      label: 'Next round soon',
    }))
    .otherwise(() => ({ kind: 'ready' as const, endsAt }))

  return (
    <div className="rounded-xl border border-line bg-linear-to-b from-panel-2 to-panel">
      <BetForm onPlace={placeBet} onCashOut={cashOut} status={status} />
    </div>
  )
}
