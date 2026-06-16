import { useEffect, useRef, useState } from 'react'

const BUFFER_SIZE = 60
const UPDATE_EVERY = 8 // frames between state flushes — keeps display readable

export function useFpsMonitor(enabled: boolean) {
  const [display, setDisplay] = useState({ fps: 0, frameMs: 0, buffer: [] as number[] })
  const bufRef = useRef<number[]>([])
  const prevRef = useRef<number | null>(null)
  const tickRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let rafId: number

    function onFrame(now: number) {
      if (prevRef.current !== null) {
        const ms = now - prevRef.current
        const buf = bufRef.current
        buf.push(ms)
        if (buf.length > BUFFER_SIZE) buf.shift()
        tickRef.current++
        if (tickRef.current % UPDATE_EVERY === 0) {
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length
          setDisplay({ fps: Math.round(1000 / avg), frameMs: Math.round(avg * 10) / 10, buffer: [...buf] })
        }
      }
      prevRef.current = now
      rafId = requestAnimationFrame(onFrame)
    }

    rafId = requestAnimationFrame(onFrame)
    return () => {
      cancelAnimationFrame(rafId)
      prevRef.current = null
      tickRef.current = 0
      bufRef.current = []
    }
  }, [enabled])

  return display
}
