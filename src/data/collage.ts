import type { CollageImage } from './types'
import rawImages from './images.json'

const POSITIONS = [
  { x: 8, y: 12, width: 22, rotation: -2, opacity: 0.9 },
  { x: 68, y: 8, width: 26, rotation: 1.5, opacity: 0.85 },
  { x: 35, y: 28, width: 30, rotation: -1, opacity: 1 },
  { x: 72, y: 42, width: 20, rotation: 3, opacity: 0.75 },
  { x: 5, y: 48, width: 24, rotation: -2.5, opacity: 0.8 },
  { x: 42, y: 55, width: 28, rotation: 0.5, opacity: 0.9 },
  { x: 78, y: 62, width: 18, rotation: -1.5, opacity: 0.7 },
  { x: 15, y: 72, width: 32, rotation: 2, opacity: 0.95 },
  { x: 55, y: 78, width: 22, rotation: -0.5, opacity: 0.85 },
  { x: 82, y: 18, width: 16, rotation: 1, opacity: 0.65 },
  { x: 25, y: 5, width: 20, rotation: -3, opacity: 0.7 },
  { x: 60, y: 35, width: 24, rotation: 1.5, opacity: 0.8 },
]

export function getCollageImages(): CollageImage[] {
  return (rawImages as CollageImage[]).map((img, i) => ({
    ...img,
    ...POSITIONS[i % POSITIONS.length],
  }))
}

export function getImagesBySection(sectionId: string): CollageImage[] {
  return getCollageImages().filter((img) => img.section === sectionId)
}

export function getAllImages(): CollageImage[] {
  return (rawImages as CollageImage[]).map((img) => ({ id: img.id, src: img.src }))
}
