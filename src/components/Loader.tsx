import { useState, useEffect, useMemo } from 'react'
import imagesManifest from '../data/images.json'
import { filterProfileManifest } from '../lib/manifestFilter'
import { BrandTicker } from './BrandTicker'

interface LoaderProps {
  onEnter: () => void
}

type ManifestEntry = { src: string; type?: string }

const SLIDE_MS = 333 // ~3 changes per second

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Loader({ onEnter }: LoaderProps) {
  const [exiting, setExiting] = useState(false)
  const [ready, setReady] = useState(false)
  const [slide, setSlide] = useState(0)

  const slides = useMemo(
    () =>
      shuffle(
        filterProfileManifest(imagesManifest as ManifestEntry[])
          .filter((e) => e.type !== 'video' && e.src?.includes('/images/'))
          .map((e) => e.src),
      ),
    [],
  )

  useEffect(() => {
    if (slides.length === 0) {
      setReady(true)
      return
    }
    // Show as soon as a few slides are ready; never block more than ~1.2s.
    let loaded = 0
    const goal = Math.min(4, slides.length)
    const fallback = window.setTimeout(() => setReady(true), 1200)
    slides.slice(0, goal).forEach((src) => {
      const img = new Image()
      const done = () => {
        loaded++
        if (loaded >= goal) {
          clearTimeout(fallback)
          setReady(true)
        }
      }
      img.onload = done
      img.onerror = done
      img.src = src
    })
    return () => clearTimeout(fallback)
  }, [slides])

  useEffect(() => {
    if (!ready || slides.length < 2) return
    const id = setInterval(() => {
      setSlide((i) => (i + 1) % slides.length)
    }, SLIDE_MS)
    return () => clearInterval(id)
  }, [ready, slides.length])

  function handleEnter() {
    if (exiting) return
    setExiting(true)
    setTimeout(onEnter, 450)
  }

  const bgSrc = slides[slide] ?? slides[0]

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
      aria-label="Enter Mustafa Gumus archive — home"
    >
      <div className="relative flex flex-col items-center gap-6 w-full max-w-[min(92vw,560px)] px-4">
        <div
          className={`relative flex w-full min-h-[min(48vh,380px)] items-center justify-center transition-opacity duration-500 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Slideshow — natural aspect (portrait stays tall, landscape stays wide) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative inline-block max-w-[min(84vw,520px)] max-h-[min(42vh,340px)] opacity-[0.38]">
              {bgSrc && (
                <img
                  key={bgSrc}
                  src={bgSrc}
                  alt=""
                  className="block max-w-[min(84vw,520px)] max-h-[min(42vh,340px)] w-auto h-auto object-contain"
                  decoding="async"
                />
              )}
              <div className="absolute inset-0 bg-black/25" />
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center px-4">
            <h1
              className="text-white text-center text-3xl sm:text-5xl tracking-[0.06em] leading-tight"
              style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontStyle: 'italic',
                fontWeight: 400,
              }}
            >
              MUSTAFAGUMUS
              <br />
              ARCHIVE
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

      <BrandTicker />
    </div>
  )
}
