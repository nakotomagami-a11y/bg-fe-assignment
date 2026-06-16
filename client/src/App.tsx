import { useGameStore } from '@/store/gameStore'
import { TopBar } from '@/components/TopBar'
import { HeroPanel } from '@/modules/multiplier/components/HeroPanel'
import { LastRounds } from '@/modules/multiplier/components/LastRounds'
import { BetPanel } from '@/modules/bet-panel/components/BetPanel'
import { BetsTable } from '@/modules/bets-table/components/BetsTable'

function AmbientOverlay() {
  const phase = useGameStore((s) => s.round?.phase)
  const gradient = phase === 'crashed' || phase === 'pause' ? 'var(--ambient-crashed)' : 'var(--ambient-live)'
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none transition-all duration-800"
      style={{ background: gradient }}
    />
  )
}

export default function App() {
  return (
    <>
      <AmbientOverlay />
      <div className="relative z-2 w-full flex flex-col">
        {/* Sticky topbar — gives the fixed right panel a stable reference point */}
        <div className="sticky top-0 z-20">
          <TopBar />
        </div>

        <div className="flex flex-col gap-4.5 px-6.5 pt-4.5 pb-50 lg:flex-row">
          {/* Left: normal page flow */}
          <div className="flex flex-col gap-4.5 lg:w-115 lg:shrink-0">
            <HeroPanel />
            <LastRounds />
            <BetPanel />
          </div>

          {/* Mobile: BetsTable inline after left content */}
          <div className="h-[60vh] flex flex-col lg:hidden">
            <BetsTable />
          </div>
        </div>

        {/* Desktop: BetsTable fixed to the right, always in viewport */}
        <div
          className="hidden lg:flex fixed top-topbar-offset right-6.5 bottom-4.5 left-126 flex-col z-10"
        >
          <BetsTable />
        </div>
      </div>
    </>
  )
}
