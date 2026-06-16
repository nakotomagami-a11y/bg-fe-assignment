import { useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'
import { match } from 'ts-pattern'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useBetPanel, type BetFormStatus } from '../hooks/useBetPanel'
import { useCountdown } from '../hooks/useCountdown'

const MIN = 1
const MAX = 500
const PRESETS = [10, 25, 50, 100]

function clamp(v: number) {
  return Math.max(MIN, Math.min(MAX, Math.round(v * 100) / 100))
}

// ─── Status ───────────────────────────────────────────────────────────────────

function ActionButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button size="lg" className={cn('mt-3.5 w-full', className)} {...props}>
      {children}
    </Button>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return <small className="font-mono font-medium opacity-70 text-sm">{children}</small>
}

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

  const inputDisabled = status.kind !== 'ready'
  const endsAt =
    status.kind === 'ready' || status.kind === 'waiting' ? (status.endsAt ?? null) : null
  const countdown = useCountdown(endsAt)

  function set(v: number) {
    const c = clamp(v)
    setAmount(c)
    setInputVal(c.toFixed(2))
  }

  // ─── Hint ────────────────────────────────────────────────────────────────────

  const hint = match(status)
    .with({ kind: 'ready' }, () => ({ pip: 'bg-acid shadow-glow-acid', text: 'place your bet before the round starts' }))
    .with({ kind: 'pending' }, () => ({ pip: 'bg-amber shadow-glow-amber', text: 'waiting for confirmation…' }))
    .with({ kind: 'waiting' }, () => ({ pip: 'bg-green shadow-glow-green', text: 'bet confirmed · waiting for take-off' }))
    .with({ kind: 'rejected' }, () => ({ pip: 'bg-red', text: 'bet rejected · tap to try again' }))
    .with({ kind: 'cashout' }, () => ({ pip: 'bg-green shadow-glow-green', text: 'lock your multiplier before it busts' }))
    .with({ kind: 'won' }, () => ({ pip: 'bg-green', text: 'settled · provably fair' }))
    .otherwise(() => ({ pip: 'bg-txt-faint', text: 'settling round · provably fair' }))

  const actionBtn = match(status)
    .with({ kind: 'ready' }, () => (
      <ActionButton
        onClick={() => onPlace(amount)}
        className="text-[#0a0c12] cursor-pointer hover:-translate-y-px active:translate-y-px"
        style={{
          background: 'linear-gradient(180deg,var(--acid),#a9e818)',
          boxShadow: '0 0 30px rgba(198,255,53,.35)',
        }}
      >
        Bet next round
        {countdown && <Sub>· {countdown}</Sub>}
      </ActionButton>
    ))
    .with({ kind: 'pending' }, () => (
      <ActionButton disabled className="bg-white/6 text-txt-dim cursor-default">
        <span className="size-1.75 rounded-full bg-amber shadow-glow-amber animate-pulse shrink-0" />
        Confirming bet…
      </ActionButton>
    ))
    .with({ kind: 'waiting' }, () => (
      <ActionButton disabled className="bg-white/6 text-txt-dim cursor-default">
        Bet locked
        {countdown && <Sub>· take-off in {countdown}</Sub>}
      </ActionButton>
    ))
    .with({ kind: 'rejected' }, ({ reason, onDismiss }) => (
      <ActionButton
        onClick={onDismiss}
        className="cursor-pointer border border-red/30"
        style={{ background: 'rgba(255,58,85,.14)', color: 'var(--red-soft)' }}
      >
        {reason ? `Bet rejected — ${reason.replace(/_/g, ' ')}` : 'Bet rejected — tap to retry'}
      </ActionButton>
    ))
    .with({ kind: 'cashout' }, ({ amount: a, multiplier: m, cashing }) => (
      <ActionButton
        onClick={onCashOut}
        disabled={cashing}
        className="text-[#04140b] cursor-pointer hover:-translate-y-px active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(180deg,var(--green),#13b863)',
          boxShadow: '0 0 34px rgba(31,224,122,.45)',
        }}
      >
        {cashing ? 'Cashing out…' : (
          <>Cash out<Sub>· ${a.toFixed(2)} → ${(a * m).toFixed(2)}</Sub></>
        )}
      </ActionButton>
    ))
    .with({ kind: 'won' }, ({ cashedAt, payout }) => (
      <ActionButton
        disabled
        className="cursor-default border border-green/30"
        style={{ background: 'rgba(31,224,122,.14)', color: 'var(--green-2)' }}
      >
        Cashed @ {cashedAt.toFixed(2)}×<Sub>· +${payout.toFixed(2)}</Sub>
      </ActionButton>
    ))
    .with({ kind: 'lost' }, ({ crashAt, betAmount }) => (
      <ActionButton
        disabled
        className="cursor-default border border-red/30"
        style={{ background: 'rgba(255,58,85,.14)', color: 'var(--red-soft)' }}
      >
        Busted @ {crashAt.toFixed(2)}×<Sub>· −${betAmount.toFixed(2)}</Sub>
      </ActionButton>
    ))
    .with({ kind: 'locked' }, ({ label, sub }) => (
      <ActionButton disabled className="bg-white/4 text-txt-faint cursor-default">
        {label}
        {sub && <Sub>· {sub}</Sub>}
      </ActionButton>
    ))
    .exhaustive()

  return (
    <div className="flex flex-col p-[18px]">
      {/* Section title */}
      <span className="text-label tracking-allcaps uppercase text-txt-dim mb-[13px]">
        Place bet
      </span>

      {/* Amount input */}
      <Input
        prefix="$"
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
      />

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
  const { status, placeBet, cashOut } = useBetPanel()
  return (
    <div className="rounded-xl border border-line bg-linear-to-b from-panel-2 to-panel">
      <BetForm onPlace={placeBet} onCashOut={cashOut} status={status} />
    </div>
  )
}
