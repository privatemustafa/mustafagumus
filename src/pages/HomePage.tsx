import { useMemo } from 'react'
import { UniverseCanvas } from '../components/UniverseCanvas'
import type { UniverseMedia } from '../components/UniverseCanvas'
import imagesManifest from '../data/images.json'

type ManifestEntry = {
  id: number
  src: string
  key?: string
  type?: 'image' | 'video'
  videoSrc?: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function toUniverseMedia(entry: ManifestEntry): UniverseMedia {
  const isVideo =
    entry.type === 'video' ||
    entry.videoSrc != null ||
    entry.key?.includes('.mp4') === true

  const videoSrc =
    entry.videoSrc ??
    (isVideo ? `/videos/instagram/vid-${String(entry.id).padStart(4, '0')}.mp4` : undefined)

  return {
    id: entry.id,
    src: entry.src,
    type: isVideo ? 'video' : 'image',
    videoSrc,
  }
}

const IMAGE_COPIES = 1
const VIDEO_COPIES = 2

export function HomePage() {
  const media = useMemo<UniverseMedia[]>(() => {
    const base = (imagesManifest as ManifestEntry[]).map(toUniverseMedia)
    const images = base.filter((m) => m.type !== 'video')
    const videos = base.filter((m) => m.type === 'video')
    const expanded: UniverseMedia[] = []

    for (let copy = 0; copy < IMAGE_COPIES; copy++) {
      shuffle(images).forEach((item, index) => {
        expanded.push({ ...item, id: item.id + copy * 100000 + index })
      })
    }

    for (let copy = 0; copy < VIDEO_COPIES; copy++) {
      shuffle(videos).forEach((item, index) => {
        expanded.push({ ...item, id: item.id + 200000 + copy * 10000 + index })
      })
    }

    return shuffle(expanded)
  }, [])

  return <UniverseCanvas media={media} />
}
