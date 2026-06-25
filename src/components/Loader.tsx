import { useState, useEffect } from 'react'

interface LoaderProps {
  onEnter: () => void
}

const HERO_IMAGES = [
  '/images/instagram/webp/img-0001.webp',
  '/images/instagram/webp/img-0002.webp',
  '/images/instagram/webp/img-0003.webp',
]

function pickHero() {
  return HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)]
}

export function Loader({ onEnter }: LoaderProps) {
  const [exiting, setExiting] = useState(false)
  const [ready, setReady] = useState(false)
  const [hero] = useState(pickHero)

  useEffect(() => {
    // Preload hero image
    const img = new Image()
    img.onload = () => setReady(true)
    img.onerror = () => setReady(true)
    img.src = hero
  }, [hero])

  function handleEnter() {
    if (!ready) return
    setExiting(true)
    setTimeout(onEnter, 450)
  }

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center bg-black transition-opacity duration-450 ease-out cursor-pointer select-none ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ zIndex: 'var(--z-loader)' }}
      onClick={handleEnter}
      onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
      role="button"
      tabIndex={0}
      aria-label="Enter site"
    >
      <div className="relative flex flex-col items-center gap-6 w-[min(88vw,460px)]">
        <div
          className={`relative w-full aspect-[4/5] overflow-hidden transition-opacity duration-500 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={hero}
            alt=""
            className="w-full h-full object-cover"
            style={{ transform: 'rotate(-1.5deg) scale(1.05)' }}
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <h1
              className="text-white text-5xl sm:text-7xl tracking-wider"
              style={{
                fontFamily: 'var(--font-display)',
                animation: ready ? 'glitchText 3s ease-in-out infinite' : 'none',
              }}
            >
              STEP INSIDE
            </h1>
          </div>
        </div>

        {!ready && (
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-white/40 animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {ready && (
          <span className="text-white/50 font-mono text-[10px] tracking-[0.4em] uppercase">
            tap to enter
          </span>
        )}
      </div>
    </div>
  )
}
