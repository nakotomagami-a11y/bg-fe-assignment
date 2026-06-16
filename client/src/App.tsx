import { useGameStore } from '@/shared/hooks/useGameStore'
import { TopBar } from '@/components/TopBar'

function AmbientOverlay() {
  const phase = useGameStore((s) => s.round?.phase)
  const gradient = phase === 'crashed' ? 'var(--ambient-crashed)' : 'var(--ambient-live)'
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
      <div className="relative z-2 w-full h-full flex flex-col">
        <TopBar />
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          <div className="flex flex-col gap-4.5 px-6.5 pt-4.5 pb-5.5 lg:flex-row lg:h-full">
            <div className="flex flex-col gap-4.5 lg:w-[460px] lg:shrink-0" />
            <div className="h-[60vh] flex flex-col lg:h-auto lg:flex-1 lg:min-w-0" />
          </div>
        </div>
      </div>
    </>
  )
}
