import { useEffect } from 'react'

const GRAIN_SIZE = 128   // smaller = less data, still fine grain
const FPS = 10           // grain refresh rate — above 8 is imperceptible

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
    const v = Math.random() < 0.5 ? Math.random() * 30 : 215 + Math.random() * 40
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  sharedCtx.putImageData(imageData, 0, 0)
}

export function useGrainOverlay() {
  useEffect(() => {
    const canvas = getGrainCanvas()
    drawGrainFrame()   // first frame immediately

    // CSS var: set once with the canvas data URL initially
    const update = () => {
      drawGrainFrame()
      document.documentElement.style.setProperty(
        '--hero-noise-image',
        `url("${canvas.toDataURL('image/png')}")`,
      )
    }
    update()

    // Refresh at FPS using setInterval — off the rAF so Three.js loop is unaffected
    const ms = Math.round(1000 / FPS)
    const id = setInterval(update, ms)
    return () => clearInterval(id)
  }, [])
}
