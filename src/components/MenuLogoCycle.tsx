import { useEffect, useState } from 'react'

const LABELS = ['brand', 'archive', 'motion'] as const
type CycleLabel = (typeof LABELS)[number]

const HOLD_MS = 3200
const FADE_MS = 450

function CycleContent({ label }: { label: CycleLabel }) {
  if (label === 'brand') {
    return (
      <>
        <span className="logo__line">MUSTAFA</span>
        <span className="logo__line">GUMUS</span>
      </>
    )
  }

  return <span className="logo__line">{label === 'archive' ? 'ARCHIVE' : 'MOTION'}</span>
}

export function MenuLogoCycle() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (reducedMotion) return

    const interval = window.setInterval(() => {
      setVisible(false)
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % LABELS.length)
        setVisible(true)
      }, FADE_MS)
    }, HOLD_MS)

    return () => window.clearInterval(interval)
  }, [reducedMotion])

  const label = reducedMotion ? 'brand' : LABELS[index]

  return (
    <span className="logo__lockup logo-cycle" aria-live="polite" aria-atomic="true">
      <span
        className={`logo-cycle__panel${visible ? ' logo-cycle__panel--visible' : ''}`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <CycleContent label={label} />
      </span>
    </span>
  )
}
