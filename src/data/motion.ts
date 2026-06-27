import rawMotion from './motion.json'

export type MotionEntry = {
  id: string
  title: string
  /** Optional client / credit line */
  subtitle?: string
  /** Path under /public — e.g. /videos/motion/my-film.mp4 */
  src: string
  /** Optional poster — /videos/motion/posters/my-film.jpg */
  poster?: string
  /** Sort order (lower = first). Omit to keep JSON order. */
  order?: number
  /** Video orientation derived from intrinsic dimensions. */
  orientation?: 'portrait' | 'landscape'
  /** Intrinsic video width in pixels. */
  width?: number
  /** Intrinsic video height in pixels. */
  height?: number
}

export const MOTION_ITEMS: MotionEntry[] = (rawMotion as MotionEntry[])
  .filter((e) => e.id && e.title && e.src)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
