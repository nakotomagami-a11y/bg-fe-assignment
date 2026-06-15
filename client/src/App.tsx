import { useGameStore } from '@/shared/hooks/useGameStore'
import { TopBar } from '@/modules/connection/components/TopBar'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

function AmbientOverlay({ phase }: { phase: string | undefined }) {
  const bg =
    phase === 'crashed'
      ? 'radial-gradient(1200px 800px at 30% 20%, rgba(255,58,85,0.20), transparent 60%)'
      : 'radial-gradient(1100px 700px at 26% 12%, rgba(31,224,122,0.12), transparent 60%), radial-gradient(900px 700px at 88% 90%, rgba(138,107,255,0.10), transparent 60%)'
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none transition-all duration-[800ms]"
      style={{ background: bg }}
    />
  )
}

export default function App() {
  const phase = useGameStore((s) => s.round?.phase)

  return (
    <>
      <AmbientOverlay phase={phase} />
      <div
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: GRAIN_SVG }}
      />
      <div className="relative z-[2] h-full grid grid-rows-[auto_1fr]">
        <TopBar />
        <div
          className="grid gap-4.5 px-6.5 pt-4.5 pb-5.5 min-h-0"
          style={{ gridTemplateColumns: 'minmax(380px,440px) 1fr' }}
        >
          <div className="min-h-0 flex flex-col gap-4.5">
            {/* 2b: HeroPanel */}
            {/* 2c: LastRounds */}
            {/* 2c: BetPanel */}
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
