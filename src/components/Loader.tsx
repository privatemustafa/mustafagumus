import { useState, useEffect, useMemo } from 'react'
import imagesManifest from '../data/images.json'
import { filterProfileManifest } from '../lib/manifestFilter'
import { BrandTicker } from './BrandTicker'

export type LoaderDestination = '/' | '/motion'

interface LoaderProps {
  onEnter: (destination: LoaderDestination) => void
}

type ManifestEntry = { src: string; type?: string }

const SLIDE_MS = 333

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
  const [destination, setDestination] = useState<LoaderDestination | null>(null)

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

  function handleEnter(path: LoaderDestination) {
    if (exiting) return
    setDestination(path)
    setExiting(true)
    setTimeout(() => onEnter(path), 450)
  }

  const bgSrc = slides[slide] ?? slides[0]

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center bg-black transition-opacity duration-450 ease-out select-none ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ zIndex: 'var(--z-loader)' }}
    >
      <div className="relative flex flex-col items-center gap-8 w-full max-w-[min(92vw,560px)] px-4">
        <div
          className={`relative flex w-full min-h-[min(44vh,360px)] items-center justify-center transition-opacity duration-500 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative inline-block max-w-[min(84vw,520px)] max-h-[min(38vh,320px)] opacity-[0.38]">
              {bgSrc && (
                <img
                  key={bgSrc}
                  src={bgSrc}
                  alt=""
                  className="block max-w-[min(84vw,520px)] max-h-[min(38vh,320px)] w-auto h-auto object-contain"
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
          <div className="flex flex-col items-center gap-5 w-full">
            <span className="text-white/40 font-mono text-[10px] tracking-[0.35em] uppercase">
              Choose your path
            </span>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 w-full sm:w-auto sm:justify-center">
              <button
                type="button"
                className={`loader-choice px-8 py-3.5 font-mono text-[10px] tracking-[0.35em] uppercase border transition-colors duration-200 ${
                  destination === '/'
                    ? 'border-white text-white'
                    : 'border-white/35 text-white/70 hover:border-white/60 hover:text-white'
                }`}
                onClick={() => handleEnter('/')}
              >
                Photos
              </button>
              <button
                type="button"
                className={`loader-choice px-8 py-3.5 font-mono text-[10px] tracking-[0.35em] uppercase border transition-colors duration-200 ${
                  destination === '/motion'
                    ? 'border-white text-white'
                    : 'border-white/35 text-white/70 hover:border-white/60 hover:text-white'
                }`}
                onClick={() => handleEnter('/motion')}
              >
                Motion
              </button>
            </div>
          </div>
        )}
      </div>

      <BrandTicker />
    </div>
  )
}
