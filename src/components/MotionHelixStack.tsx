import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import type { MotionEntry } from '../data/motion'

export type MotionHelixHandle = {
  seekTo: (videoIndex: number) => void
}

type MotionHelixStackProps = {
  items: MotionEntry[]
  onFrontIndexChange?: (videoIndex: number) => void
  /** Fires whenever the centered video's sound turns on (true) or off (false). */
  onSoundStateChange?: (unmuted: boolean) => void
}

/**
 * Landscape card width. Driven by the `--motion-panel-w` custom property so the
 * value can be swapped reactively per breakpoint (see the responsive effect).
 * Desktop/tablet keep the original `min(56vw, 820px)`; phones get a larger value
 * so the centred clip reads big. The fallback equals the desktop value, so any
 * non-overridden context renders exactly as before.
 */
const PANEL_W_DESKTOP = 'min(56vw, 820px)'
const PANEL_W_MOBILE = 'min(86vw, 560px)'
const PANEL_W = `var(--motion-panel-w, ${PANEL_W_DESKTOP})`
/**
 * Uniform card HEIGHT for every orientation — equals the original landscape
 * height (PANEL_W * 9/16). Width then derives from orientation so portraits
 * sit at the SAME height as the landscapes, just narrower.
 */
const CARD_H = `calc(${PANEL_W} * ${9 / 16})`
const LERP = 0.09
/** Horizontal spread of the helix (desktop). Bigger = neighbours sit further out. */
const X_RADIUS = 460
/** Radians between neighbouring cards on the helix — bigger = more spacing */
const ANGLE_STEP = 1.05
/** Phones: pull neighbours in tight so they hug the (larger) centred card. */
const ANGLE_STEP_MOBILE = 0.95
/** Phones (<= this width) get the bigger card + tighter radius treatment. */
const MOBILE_MQ = '(max-width: 640px)'
/** How many cards each side of centre stay rendered */
const WINDOW = 2.4
const MOUSE_PULL = 0.04
const PLAY_SCALE = 0.92
/** px of horizontal finger drag that advances one card on mobile */
const TOUCH_DRAG_PER_CARD = 0.55

type CardState = {
  el: HTMLDivElement | null
  inner: HTMLDivElement | null
  video: HTMLVideoElement | null
  cell: number
  videoIndex: number
  displayX: number
  displayScale: number
  playing: boolean
}

function lerp(current: number, target: number): number {
  if (Math.abs(target - current) < 0.0005) return target
  return current + (target - current) * LERP
}

/**
 * width/height ratio used to size a card. Landscapes keep the original 16:9;
 * portraits use their intrinsic ratio (narrower) so they read as verticals at
 * the same height as the landscapes. Falls back to landscape when unknown.
 */
function cardAspect(item: MotionEntry | undefined): number {
  if (item?.orientation === 'portrait' && item.width && item.height) {
    return item.width / item.height
  }
  return 16 / 9
}

/** CSS width expression so width === CARD_H * cardAspect(item). */
function cardWidthExpr(item: MotionEntry | undefined): string {
  const factor = (9 / 16) * cardAspect(item)
  return `calc(${PANEL_W} * ${factor})`
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffledPermutation(n: number, seed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  const rnd = mulberry32(seed || 1)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function MotionHelixStackBase(
  { items, onFrontIndexChange, onSoundStateChange }: MotionHelixStackProps,
  ref: React.Ref<MotionHelixHandle>,
) {
  const total = items.length
  const cardsRef = useRef<CardState[]>([])
  const trackRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef(0)
  // Helix geometry the rAF loop reads each frame. Held in refs (not module
  // constants) so the responsive effect can retune them on phones without a
  // re-render. Defaults are the unchanged desktop values.
  const xRadiusRef = useRef(X_RADIUS)
  const angleStepRef = useRef(ANGLE_STEP)
  const frontVideoRef = useRef(-1)
  /** The card nearest centre (smallest |delta|) — the clickable/playing one. */
  const frontCardRef = useRef<CardState | null>(null)
  /** The single video currently allowed to have audio, or null when all muted. */
  const unmutedVideoRef = useRef<HTMLVideoElement | null>(null)

  const targetPos = useRef(0)
  const displayPos = useRef(0)
  const targetMouseX = useRef(0)
  const displayMouseX = useRef(0)

  const onFrontRef = useRef(onFrontIndexChange)
  onFrontRef.current = onFrontIndexChange
  const onSoundRef = useRef(onSoundStateChange)
  onSoundRef.current = onSoundStateChange

  // Per-loop permutation cache — loop 0 keeps the natural manifest order,
  // every other loop gets a deterministic shuffle so the sequence feels fresh
  // each time it wraps without ever revealing an "end".
  const permCache = useRef(new Map<number, number[]>())
  const permFor = useCallback(
    (loop: number): number[] => {
      if (loop === 0) return Array.from({ length: total }, (_, i) => i)
      const cache = permCache.current
      let p = cache.get(loop)
      if (!p) {
        p = shuffledPermutation(total, (loop * 0x9e3779b1) >>> 0)
        cache.set(loop, p)
      }
      return p
    },
    [total],
  )

  const videoIndexForCell = useCallback(
    (cell: number): number => {
      if (total === 0) return 0
      const loop = Math.floor(cell / total)
      const slot = ((cell % total) + total) % total
      return permFor(loop)[slot]
    },
    [permFor, total],
  )

  const setCardRef = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      if (!cardsRef.current[index]) {
        cardsRef.current[index] = {
          el: null,
          inner: null,
          video: null,
          cell: index,
          videoIndex: index,
          displayX: 0,
          displayScale: 1,
          playing: false,
        }
      }
      const card = cardsRef.current[index]
      card.el = el
      if (el) {
        card.inner = el.querySelector<HTMLDivElement>('.motion-helix-inner')
        card.video = el.querySelector<HTMLVideoElement>('video')
      } else {
        card.inner = null
        card.video = null
      }
    },
    [],
  )

  const assignVideo = useCallback(
    (card: CardState) => {
      const next = videoIndexForCell(card.cell)
      if (next === card.videoIndex) return
      card.videoIndex = next
      const item = items[next]
      if (card.video && item) {
        card.playing = false
        card.video.pause()
        card.video.src = item.src
        if (item.poster) card.video.poster = item.poster
        card.video.load()
      }
      // Resize the recycled card to match the newly-assigned video's orientation.
      if (card.el && item) card.el.style.width = cardWidthExpr(item)
    },
    [items, videoIndexForCell],
  )

  useImperativeHandle(
    ref,
    () => ({
      seekTo(videoIndex: number) {
        if (total === 0) return
        const base = Math.round(displayPos.current)
        let best: number | null = null
        let bestDist = Infinity
        for (let c = base - total; c <= base + total; c++) {
          if (videoIndexForCell(c) === videoIndex) {
            const dist = Math.abs(c - displayPos.current)
            if (dist < bestDist) {
              bestDist = dist
              best = c
            }
          }
        }
        if (best != null) targetPos.current = best
      },
    }),
    [total, videoIndexForCell],
  )

  // Initialise each card's video source once (avoids React reconciliation
  // resetting the src we mutate imperatively while recycling).
  useEffect(() => {
    cardsRef.current.forEach((card) => {
      const item = items[card.videoIndex]
      if (card?.video && item) {
        card.video.src = item.src
        if (item.poster) card.video.poster = item.poster
      }
      if (card?.el && item) card.el.style.width = cardWidthExpr(item)
    })
  }, [items])

  // Reactive mobile tuning: on phones, enlarge the cards (via the
  // `--motion-panel-w` custom property the JSX sizing reads) and pull the helix
  // radius/angle in tight so neighbours hug the centred clip instead of being
  // flung off-screen. Desktop/tablet keep the exact original geometry.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)

    const apply = () => {
      const track = trackRef.current
      if (mq.matches) {
        // Tie the radius to viewport width so neighbours sit just off the
        // centred card on any phone size, clamped to a clean range.
        const radius = Math.round(
          Math.min(232, Math.max(186, window.innerWidth * 0.58)),
        )
        xRadiusRef.current = radius
        angleStepRef.current = ANGLE_STEP_MOBILE
        track?.style.setProperty('--motion-panel-w', PANEL_W_MOBILE)
      } else {
        xRadiusRef.current = X_RADIUS
        angleStepRef.current = ANGLE_STEP
        track?.style.removeProperty('--motion-panel-w')
      }
    }

    apply()
    mq.addEventListener('change', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      mq.removeEventListener('change', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [])

  useEffect(() => {
    if (total === 0) return

    targetMouseX.current = window.innerWidth / 2
    displayMouseX.current = window.innerWidth / 2

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1)
      const dx = e.deltaX * (e.deltaMode === 1 ? 16 : 1)
      const primary = Math.abs(dy) >= Math.abs(dx) ? dy : dx
      targetPos.current += primary / window.innerHeight
    }

    const onMouseMove = (e: MouseEvent) => {
      targetMouseX.current = e.clientX
    }

    let lastTouchX = 0
    let touching = false
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      touching = true
      lastTouchX = t.clientX
      targetMouseX.current = t.clientX
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      e.preventDefault()
      if (touching) {
        // finger left → advance forward (horizontal scrub on mobile)
        const dx = lastTouchX - t.clientX
        targetPos.current += dx / (window.innerWidth * TOUCH_DRAG_PER_CARD)
        lastTouchX = t.clientX
      }
      targetMouseX.current = t.clientX
    }
    const onTouchEnd = () => {
      touching = false
    }

    // Click (not drag) on the centred clip toggles its sound. Only one video
    // is ever unmuted; everything else stays muted.
    const toggleSound = (video: HTMLVideoElement) => {
      if (unmutedVideoRef.current === video && !video.muted) {
        video.muted = true
        unmutedVideoRef.current = null
        onSoundRef.current?.(false)
        return
      }
      cardsRef.current.forEach((c) => {
        if (c.video && c.video !== video) c.video.muted = true
      })
      video.muted = false
      if (video.paused) video.play().catch(() => {})
      unmutedVideoRef.current = video
      onSoundRef.current?.(true)
    }

    const CLICK_SLOP = 6
    let downX = 0
    let downY = 0
    let pointerActive = false
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return
      pointerActive = true
      downX = e.clientX
      downY = e.clientY
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!pointerActive) return
      pointerActive = false
      if (Math.hypot(e.clientX - downX, e.clientY - downY) >= CLICK_SLOP) return
      const card = frontCardRef.current
      if (!card?.el || !card.video) return
      const rect = card.el.getBoundingClientRect()
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return
      }
      toggleSound(card.video)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })

    const half = total / 2

    const tick = () => {
      displayPos.current = lerp(displayPos.current, targetPos.current)
      displayMouseX.current = lerp(displayMouseX.current, targetMouseX.current)

      const dpos = displayPos.current

      let frontCard: CardState | null = null
      let frontAbsDelta = Infinity

      for (let i = 0; i < total; i++) {
        const card = cardsRef.current[i]
        if (!card?.el) continue

        // Keep this physical card in the nearest copy window of the viewport
        // and recycle its video when it wraps (always while off-screen).
        while (card.cell - dpos > half) {
          card.cell -= total
          assignVideo(card)
        }
        while (card.cell - dpos < -half) {
          card.cell += total
          assignVideo(card)
        }

        const delta = card.cell - dpos

        const absDelta = Math.abs(delta)
        if (absDelta < frontAbsDelta) {
          frontAbsDelta = absDelta
          frontCard = card
        }

        if (Math.abs(delta) > WINDOW) {
          if (card.el.style.visibility !== 'hidden') card.el.style.visibility = 'hidden'
          if (card.playing && card.video) {
            card.playing = false
            card.video.pause()
          }
          continue
        }
        if (card.el.style.visibility === 'hidden') card.el.style.visibility = 'visible'

        const angle = delta * angleStepRef.current
        const targetX = Math.sin(angle) * xRadiusRef.current
        const depth = (Math.cos(angle) + 1) / 2
        const targetScale = 0.55 + depth * depth * 0.45

        card.displayX = lerp(card.displayX, targetX)
        card.displayScale = lerp(card.displayScale, targetScale)

        const rect = card.el.getBoundingClientRect()
        const cardCenterX = rect.left + rect.width / 2
        const mouseOffsetX = (displayMouseX.current - cardCenterX) * MOUSE_PULL
        const finalX = card.displayX + mouseOffsetX

        card.el.style.zIndex = String(Math.round(card.displayScale * 100))
        card.el.style.transform = `translate(calc(-50% + ${finalX}px), -50%) scale(${card.displayScale})`

        const isFront = card.displayScale > 0.9
        if (card.inner) {
          card.inner.classList.toggle('motion-leaf-inner--solid', isFront)
          card.inner.classList.toggle('motion-leaf-inner--leaf', !isFront)
        }

        const shouldPlay = card.displayScale >= PLAY_SCALE
        if (card.video && card.playing !== shouldPlay) {
          card.playing = shouldPlay
          if (shouldPlay) card.video.play().catch(() => {})
          else card.video.pause()
        }
      }

      frontCardRef.current = frontCard

      const frontVideo = videoIndexForCell(Math.round(dpos))
      if (frontVideo !== frontVideoRef.current) {
        frontVideoRef.current = frontVideo
        // The centred clip changed — kill any sound that was deliberately
        // enabled so audio never blasts on as cards cycle.
        if (unmutedVideoRef.current) {
          unmutedVideoRef.current.muted = true
          unmutedVideoRef.current = null
          onSoundRef.current?.(false)
        }
        onFrontRef.current?.(frontVideo)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [assignVideo, total, videoIndexForCell])

  return (
    <div className="motion-helix-stage absolute inset-0 flex items-center justify-center overflow-hidden">
      <div ref={trackRef} className="motion-helix-track relative w-full h-full">
        {items.map((item, i) => (
          <div
            key={i}
            ref={(el) => setCardRef(i, el)}
            className="motion-helix-card"
            style={{ height: CARD_H, width: cardWidthExpr(item) }}
          >
            <div className="motion-helix-inner motion-leaf-inner motion-leaf-inner--leaf w-full h-full overflow-hidden bg-black">
              <video
                className="motion-leaf-video w-full h-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const MotionHelixStack = memo(forwardRef(MotionHelixStackBase))

export function motionScrollDistHeight(itemCount: number): string {
  return `${Math.max(1, itemCount) * 100}vh`
}
