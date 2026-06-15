import { useGameStore } from '@/shared/hooks/useGameStore'
import { TopBar } from '@/modules/connection/components/TopBar'
import { HeroPanel } from '@/modules/multiplier/components/HeroPanel'
import { LastRounds } from '@/modules/multiplier/components/LastRounds'
import { BetPanel } from '@/modules/bet-panel/components/BetPanel'

function AmbientOverlay({ phase }: { phase: string | undefined }) {
  const gradient = phase === 'crashed' ? 'var(--ambient-crashed)' : 'var(--ambient-live)'
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none transition-all duration-800"
      style={{ background: gradient }}
    />
  )
}

export default function App() {
  const phase = useGameStore((s) => s.round?.phase)

  return (
    <>
      <AmbientOverlay phase={phase} />
      <div className="relative z-2 h-full grid grid-rows-[auto_1fr]">
        <TopBar />
        <div
          className="grid gap-4.5 px-6.5 pt-4.5 pb-5.5 min-h-0"
          style={{ gridTemplateColumns: 'minmax(380px,440px) 1fr' }}
        >
          <div className="min-h-0 flex flex-col gap-4.5">
            <HeroPanel />
            <LastRounds />
            <BetPanel />
          </div>
          <div className="min-h-0 flex flex-col gap-4.5">
            {/* 2d: BetsTable */}
            {/* 2e: EventLog */}
          </div>
        </div>
      </div>
    </>
  )
}
