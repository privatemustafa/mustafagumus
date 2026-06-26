import { useEffect } from 'react'
import { getDeviceCapabilities } from '../lib/deviceCapabilities'

const GRAIN_SIZE = 128   // smaller = less data, still fine grain

let sharedCanvas: HTMLCanvasElement | null = null
let sharedCtx: CanvasRenderingContext2D | null = null

function getGrainCanvas() {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas')
    sharedCanvas.width = GRAIN_SIZE
    sharedCanvas.height = GRAIN_SIZE
    sharedCtx = sharedCanvas.getContext('2d')!
  }
  return sharedCanvas
}

function drawGrainFrame() {
  if (!sharedCtx) return
  const imageData = sharedCtx.createImageData(GRAIN_SIZE, GRAIN_SIZE)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const roll = Math.random()
    let v: number
    if (roll < 0.78) {
      v = Math.random() * 18
    } else if (roll < 0.96) {
      v = 28 + Math.random() * 32
    } else {
      v = 120 + Math.random() * 45
    }
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  sharedCtx.putImageData(imageData, 0, 0)
}

export function useGrainOverlay() {
  useEffect(() => {
    const caps = getDeviceCapabilities()
    const canvas = getGrainCanvas()
    drawGrainFrame()   // first frame immediately

    // toDataURL is the expensive part — throttle harder on mobile/low-end.
    const update = () => {
      drawGrainFrame()
      document.documentElement.style.setProperty(
        '--hero-noise-image',
        `url("${canvas.toDataURL('image/png')}")`,
      )
    }
    update()

    // Static grain frame when the user prefers reduced motion.
    if (caps.reducedMotion) return

    const ms = Math.round(1000 / Math.max(1, caps.grainFps))
    let id = window.setInterval(update, ms)

    // Stop regenerating grain while the tab is hidden (saves battery/CPU).
    const onVisibility = () => {
      clearInterval(id)
      if (!document.hidden) id = window.setInterval(update, ms)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
