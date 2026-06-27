import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MOTION_ITEMS } from '../data/motion'
import { MotionHelixStack, type MotionHelixHandle } from '../components/MotionHelixStack'
import { MotionCursor } from '../components/MotionCursor'

export function MotionPage() {
  const [frontIndex, setFrontIndex] = useState(0)
  const [soundOn, setSoundOn] = useState(false)
  const helixRef = useRef<MotionHelixHandle>(null)
  const count = MOTION_ITEMS.length

  // Virtual scroll drives the helix — lock native page scrolling.
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
      document.body.style.overscrollBehavior = prevOverscroll
    }
  }, [])

  const handleFront = useCallback((index: number) => setFrontIndex(index), [])
  const handleSound = useCallback((unmuted: boolean) => setSoundOn(unmuted), [])

  useEffect(() => {
    const unlock = () => {
      document.querySelectorAll<HTMLVideoElement>('.motion-helix-card video').forEach((v) => {
        v.play().catch(() => {})
      })
    }
    document.addEventListener('pointerdown', unlock, { once: true })
    return () => document.removeEventListener('pointerdown', unlock)
  }, [])

  if (count === 0) {
    return (
      <div className="min-h-svh bg-black flex flex-col items-center justify-center px-6 text-center gap-6 text-white">
        <p
          className="text-2xl italic"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          Motion
        </p>
        <p className="text-white/50 font-mono text-[11px] tracking-widest uppercase">
          Add entries to src/data/motion.json
        </p>
        <Link to="/" className="text-white/40 font-mono text-[10px] tracking-widest uppercase">
          ← Archive
        </Link>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[2100] overflow-hidden touch-none select-none">
      <div className="absolute inset-0 bg-[#0a0a0a]" />

      <MotionHelixStack
        ref={helixRef}
        items={MOTION_ITEMS}
        onFrontIndexChange={handleFront}
        onSoundStateChange={handleSound}
      />

      {/* Subtle sound-state hint — reflects the centred clip's mute state and
          signals that the front video is click-to-unmute. */}
      <div
        className="absolute bottom-16 lg:bottom-7 inset-x-0 z-[2200] flex justify-center pointer-events-none"
        aria-hidden
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: soundOn ? 0.7 : 0.32,
            transition: 'opacity 400ms ease',
          }}
        >
          <path d="M11 5 6 9H2v6h4l5 4z" />
          {soundOn ? (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </>
          ) : (
            <>
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </>
          )}
        </svg>
      </div>

      <div className="absolute bottom-6 inset-x-0 z-[2200] flex justify-center gap-2 px-4 lg:hidden pointer-events-auto">
        {MOTION_ITEMS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.title}
            onClick={() => helixRef.current?.seekTo(i)}
            className="h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{
              width: frontIndex === i ? 22 : 6,
              background: frontIndex === i ? '#fff' : 'rgba(255,255,255,0.22)',
            }}
          />
        ))}
      </div>

      {/* Full-screen film grain (covers blacks too for cohesion) */}
      <div className="motion-grain" aria-hidden />

      <MotionCursor />
    </div>
  )
}
