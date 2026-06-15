import { useState, useEffect } from 'react'
import { match, P } from 'ts-pattern'
import { useGameStore } from '@/shared/hooks/useGameStore'
import { wsClient } from '@/ws/wsService'
import { Button, Input } from '@/components'

const MIN = 1
const MAX = 500
const PRESETS = [10, 25, 50, 100]

let betSeq = 0
const nextClientBetId = () => `c${++betSeq}-${Date.now()}`

function clamp(v: number) {
  return Math.max(MIN, Math.min(MAX, Math.round(v * 100) / 100))
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label tracking-allcaps uppercase text-txt-faint">{label}</span>
      {children}
    </div>
  )
}

// ─── Result views ─────────────────────────────────────────────────────────────

function WonView({ amount, cashedAt }: { amount: number; cashedAt: number }) {
  const payout = amount * cashedAt
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6">
      <span className="text-label tracking-allcaps uppercase text-green">
        cashed out at {cashedAt.toFixed(2)}×
      </span>
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
      <Button variant="green" size="lg" fullWidth onClick={onCashOut} disabled={cashing}>
        {cashing ? 'Cashing out…' : `Cash out  ${multiplier.toFixed(2)}×`}
      </Button>
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
            <Button
              key={p}
              variant="ghost"
              size="sm"
              onClick={() => set(p)}
              className={amount === p ? 'border-acid/50 bg-acid/10 text-acid' : ''}
            >
              {p}
            </Button>
          ))}
        </div>

        {/* Amount input with half / double */}
        <div className="flex gap-2">
          <Input
            value={inputVal}
            onChange={setInputVal}
            onBlur={() => {
              const n = parseFloat(inputVal)
              if (!isNaN(n)) set(n)
              else setInputVal(amount.toFixed(2))
            }}
            prefix="$"
            inputMode="decimal"
            wrapperClassName="flex-1"
            className="font-mono tabular-nums"
          />
          <Button variant="ghost" size="md" onClick={() => set(amount / 2)}>½</Button>
          <Button variant="ghost" size="md" onClick={() => set(amount * 2)}>2×</Button>
        </div>
      </Row>

      <Button variant="acid" size="lg" fullWidth onClick={() => onPlace(amount)}>
        Place bet  ${amount.toFixed(2)}
      </Button>
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
        <Button variant="danger" size="lg" fullWidth onClick={() => setPlayerBet(null)}>
          Try again
        </Button>
      </div>
    ))
    .otherwise(() => (
      <div className={`${panel} px-5 py-4`}>
        <BetForm onPlace={placeBet} />
      </div>
    ))
}
