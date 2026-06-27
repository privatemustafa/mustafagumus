import { useEffect, useRef } from 'react'
import type { MotionEntry } from '../data/motion'

type MotionLeafStackProps = {
  items: MotionEntry[]
  displayIndex: number
}

const PANEL_W = 'min(64vw, 920px)'
/** Vertical gap between slot centres — must exceed 16:9 panel height */
const LANE_STEP = 460
const CENTER_ZONE = 0.32

type Slot = {
  tx: number
  ty: number
  tz: number
  rotX: number
  rotY: number
  scale: number
  solid: boolean
  zIndex: number
}

type Layer = {
  item: MotionEntry
  i: number
  delta: number
  slot: Slot
}

function laneSlot(delta: number): Slot | null {
  const abs = Math.abs(delta)
  if (abs > 1.001) return null

  const ty = delta * LANE_STEP
  const tuck = Math.min(abs, 1)
  const solid = abs < 0.07

  return {
    tx: 0,
    ty: solid ? 0 : ty,
    tz: solid ? 200 : 80 - tuck * 420,
    rotX: solid ? 0 : -delta * 40,
    rotY: 0,
    scale: solid ? 1 : Math.max(0.76, 1 - tuck * 0.16),
    solid,
    zIndex: 200 - Math.round(tuck * 90),
  }
}

function visibleIndices(items: MotionEntry[], displayIndex: number): number[] {
  const blend = displayIndex - Math.round(displayIndex)
  const transitioning = Math.abs(blend) > 0.04

  if (transitioning) {
    const lo = Math.max(0, Math.min(items.length - 1, Math.floor(displayIndex + 1e-5)))
    const hi = Math.max(0, Math.min(items.length - 1, Math.ceil(displayIndex - 1e-5)))
    return lo === hi ? [lo] : [lo, hi]
  }

  const hero = Math.round(displayIndex)
  return [hero - 1, hero, hero + 1].filter((i) => i >= 0 && i < items.length)
}

function buildLayers(items: MotionEntry[], displayIndex: number): Layer[] {
  const allowed = new Set(visibleIndices(items, displayIndex))

  let layers = [...allowed]
    .map((i) => {
      const delta = i - displayIndex
      const slot = laneSlot(delta)
      if (!slot) return null
      return { item: items[i], i, delta, slot }
    })
    .filter(Boolean) as Layer[]

  // Only one panel may occupy the centre zone — prevents mid-scroll collision
  const inCenter = layers.filter((l) => Math.abs(l.delta) < CENTER_ZONE)
  if (inCenter.length > 1) {
    const winner = inCenter.reduce((a, b) => (Math.abs(a.delta) < Math.abs(b.delta) ? a : b))
    layers = layers.filter((l) => Math.abs(l.delta) >= CENTER_ZONE || l.i === winner.i)
  }

  layers.sort((a, b) => a.slot.zIndex - b.slot.zIndex)
  return layers
}

export function MotionLeafStack({ items, displayIndex }: MotionLeafStackProps) {
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map())
  const layers = buildLayers(items, displayIndex)

  useEffect(() => {
    const playing = new Set(visibleIndices(items, displayIndex))
    videoRefs.current.forEach((el, i) => {
      if (playing.has(i)) el.play().catch(() => {})
      else el.pause()
    })
  }, [displayIndex, items.length])

  return (
    <div
      className="motion-stage-3d absolute inset-0 flex items-center justify-center"
      style={{ perspective: '3000px', perspectiveOrigin: '50% 50%' }}
    >
      <div className="motion-viewport relative">
        <div className="motion-carousel relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
          {layers.map(({ item, i, slot }) => (
            <div
              key={item.id}
              className="motion-leaf absolute left-1/2 top-1/2"
              style={{
                width: PANEL_W,
                aspectRatio: '16 / 9',
                zIndex: slot.zIndex,
                transform: [
                  `translate3d(-50%, calc(-50% + ${slot.ty}px), ${slot.tz}px)`,
                  `rotateX(${slot.rotX}deg)`,
                  `scale(${slot.scale})`,
                ].join(' '),
                willChange: 'transform',
              }}
            >
              <div
                className={`motion-leaf-inner w-full h-full overflow-hidden bg-black ${
                  slot.solid ? 'motion-leaf-inner--solid' : 'motion-leaf-inner--leaf'
                }`}
              >
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(i, el)
                    else videoRefs.current.delete(i)
                  }}
                  className="motion-leaf-video w-full h-full object-cover"
                  src={item.src}
                  poster={item.poster}
                  muted
                  loop
                  playsInline
                  preload={slot.solid ? 'auto' : 'metadata'}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function motionScrollDistHeight(itemCount: number): string {
  return `${Math.max(1, itemCount) * 100}vh`
}
