import { useEffect, useRef } from 'react'

const BAR_COUNT = 6

export function SoundVisualizer({ active = true }: { active?: boolean }) {
  const barsRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    if (!active) return

    const interval = setInterval(() => {
      barsRef.current.forEach((bar) => {
        if (bar) {
          bar.style.transform = `scaleY(${0.25 + Math.random() * 0.55})`
        }
      })
    }, 120)

    return () => clearInterval(interval)
  }, [active])

  return (
    <div className="flex items-center gap-0.5 h-7 w-[25px]" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i] = el
          }}
          className="flex-1 min-w-0 h-full rounded-sm origin-center transition-transform duration-100"
          style={{
            backgroundColor: 'var(--color-cream)',
            transform: `scaleY(${0.3 + Math.random() * 0.4})`,
          }}
        />
      ))}
    </div>
  )
}
