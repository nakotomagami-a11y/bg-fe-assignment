import { useState, useEffect } from 'react'
import { match, P } from 'ts-pattern'
import { useGameStore } from '@/shared/hooks/useGameStore'
import { wsClient } from '@/ws/wsService'

const MIN = 1
const MAX = 500
const PRESETS = [10, 25, 50, 100]

let betSeq = 0
const nextClientBetId = () => `c${++betSeq}-${Date.now()}`

function clamp(v: number) {
  return Math.max(MIN, Math.min(MAX, Math.round(v * 100) / 100))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label tracking-allcaps uppercase text-txt-faint">{label}</span>
      {children}
    </div>
  )
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
  variant = 'acid',
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'acid' | 'green' | 'red-soft'
}) {
  const base = 'w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-opacity'
  const colors = {
    acid: 'bg-acid text-bg',
    green: 'bg-green/15 text-green border border-green/30',
    'red-soft': 'bg-red/10 text-red border border-red/25',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${colors[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90 active:opacity-75'}`}
    >
      {children}
    </button>
  )
}

// ─── Result views ─────────────────────────────────────────────────────────────

function WonView({ amount, cashedAt }: { amount: number; cashedAt: number }) {
  const payout = amount * cashedAt
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6">
      <span className="text-label tracking-allcaps uppercase text-green">cashed out at {cashedAt.toFixed(2)}×</span>
      <span className="font-mono font-bold text-4xl text-green tabular-nums">
        +${payout.toFixed(2)}
      </span>
      <span className="text-xs text-txt-faint">(bet ${amount.toFixed(2)})</span>
    </div>
  )
}

function LostView({ amount }: { amount: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6">
      <span className="text-label tracking-allcaps uppercase text-red">lost</span>
      <span className="font-mono font-bold text-4xl text-red tabular-nums">
        −${amount.toFixed(2)}
      </span>
    </div>
  )
}

function ActiveBetView({
  amount,
  multiplier,
  onCashOut,
  cashing,
}: {
  amount: number
  multiplier: number
  onCashOut: () => void
  cashing: boolean
}) {
  const potential = amount * multiplier
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-0.5">
          <span className="text-label tracking-allcaps uppercase text-txt-faint">your bet</span>
          <span className="font-mono font-semibold text-txt tabular-nums">${amount.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-label tracking-allcaps uppercase text-txt-faint">potential</span>
          <span className="font-mono font-semibold text-acid tabular-nums">
            ${potential.toFixed(2)}
          </span>
        </div>
      </div>
      <PrimaryBtn variant="green" onClick={onCashOut} disabled={cashing}>
        {cashing ? 'Cashing out…' : `Cash out  ${multiplier.toFixed(2)}×`}
      </PrimaryBtn>
    </div>
  )
}

// ─── Bet form ─────────────────────────────────────────────────────────────────

function BetForm({ onPlace }: { onPlace: (amount: number) => void }) {
  const [amount, setAmount] = useState(50)
  const [inputVal, setInputVal] = useState('50.00')

  const set = (v: number) => {
    const clamped = clamp(v)
    setAmount(clamped)
    setInputVal(clamped.toFixed(2))
  }

  return (
    <div className="flex flex-col gap-4">
      <Row label="bet amount">
        {/* Quick presets */}
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => set(p)}
              className={`py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                amount === p
                  ? 'border-acid/50 bg-acid/10 text-acid'
                  : 'border-line-2 text-txt-dim hover:border-acid/30 hover:text-txt'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Amount input with half / double */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-line-2 bg-panel-2 focus-within:border-acid/40 transition-colors">
            <span className="text-txt-faint text-sm font-medium">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={() => {
                const n = parseFloat(inputVal)
                if (!isNaN(n)) set(n)
                else setInputVal(amount.toFixed(2))
              }}
              className="flex-1 bg-transparent font-mono text-sm text-txt outline-none tabular-nums"
            />
          </div>
          <button
            onClick={() => set(amount / 2)}
            className="px-3 py-2 rounded-lg border border-line-2 text-xs text-txt-dim font-medium hover:border-line hover:text-txt transition-colors"
          >
            ½
          </button>
          <button
            onClick={() => set(amount * 2)}
            className="px-3 py-2 rounded-lg border border-line-2 text-xs text-txt-dim font-medium hover:border-line hover:text-txt transition-colors"
          >
            2×
          </button>
        </div>
      </Row>

      <PrimaryBtn onClick={() => onPlace(amount)}>Place bet  ${amount.toFixed(2)}</PrimaryBtn>
    </div>
  )
}

// ─── BetPanel ─────────────────────────────────────────────────────────────────

export function BetPanel() {
  const phase = useGameStore((s) => s.round?.phase)
  const multiplier = useGameStore((s) => s.round?.multiplier ?? 1)
  const playerBet = useGameStore((s) => s.playerBet)
  const setPlayerBet = useGameStore((s) => s.setPlayerBet)

  const [cashing, setCashing] = useState(false)

  // Clear loading state when a cashout response arrives
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

  const panel = 'rounded-xl border border-line bg-panel'

  return match({ phase, bet: playerBet })
    .with({ phase: P.nullish }, () => (
      <div className={`${panel} px-5 py-4 flex items-center justify-center`}>
        <span className="text-xs text-txt-faint">Connecting…</span>
      </div>
    ))
    .with({ bet: { status: 'cashed_out', cashedAt: P.number } }, ({ bet }) => (
      <div className={`${panel} px-5 overflow-hidden`}>
        <WonView amount={bet.amount} cashedAt={bet.cashedAt} />
      </div>
    ))
    .with({ bet: { status: 'lost' } }, ({ bet }) => (
      <div className={`${panel} px-5 overflow-hidden`}>
        <LostView amount={bet.amount} />
      </div>
    ))
    .with({ phase: 'flight', bet: { status: 'active' } }, ({ bet }) => (
      <div className={`${panel} px-5 py-4`}>
        <ActiveBetView
          amount={bet.amount}
          multiplier={multiplier}
          onCashOut={cashOut}
          cashing={cashing}
        />
      </div>
    ))
    .with({ phase: P.union('flight', 'crashed', 'pause') }, ({ phase: p }) => (
      <div className={`${panel} px-5 py-4 flex items-center justify-center`}>
        <span className="text-xs text-txt-faint">
          {p === 'flight' ? 'No bet this round' : '—'}
        </span>
      </div>
    ))
    .with({ bet: { status: 'pending' } }, () => (
      <div className={`${panel} px-5 py-4 flex items-center justify-center gap-2`}>
        <span className="size-1.75 rounded-full bg-amber shadow-glow-amber animate-pulse" />
        <span className="text-xs text-txt-dim">Confirming bet…</span>
      </div>
    ))
    .with({ bet: { status: 'rejected' } }, ({ bet }) => (
      <div className={`${panel} px-5 py-4 flex flex-col gap-3`}>
        <span className="text-xs text-red">
          Bet rejected{bet.rejectReason ? ` — ${bet.rejectReason.replace(/_/g, ' ')}` : ''}
        </span>
        <PrimaryBtn variant="red-soft" onClick={() => setPlayerBet(null)}>
          Try again
        </PrimaryBtn>
      </div>
    ))
    .otherwise(() => (
      <div className={`${panel} px-5 py-4`}>
        <BetForm onPlace={placeBet} />
      </div>
    ))
}
