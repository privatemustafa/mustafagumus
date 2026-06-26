import { useMemo } from 'react'
import { UniverseCanvas } from '../components/UniverseCanvas'
import type { UniverseMedia } from '../components/UniverseCanvas'
import imagesManifest from '../data/images.json'
import { filterProfileManifest } from '../lib/manifestFilter'
import { getDeviceCapabilities } from '../lib/deviceCapabilities'

type ManifestEntry = {
  id: number
  src: string
  key?: string
  type?: 'image' | 'video'
  videoSrc?: string
  postUrl?: string
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

function interleaveMedia(
  images: UniverseMedia[],
  videos: UniverseMedia[],
  videoCopies: number,
): UniverseMedia[] {
  if (videos.length === 0) return images
  const imgs = shuffle(images)
  const vids = shuffle(videos)
  const result: UniverseMedia[] = []
  const totalVideos = vids.length * videoCopies
  // Distribute videos roughly evenly through the image stream
  const every = totalVideos > 0 ? Math.max(2, Math.round(imgs.length / totalVideos)) : Infinity
  let vi = 0
  let id = 0

  imgs.forEach((img, i) => {
    result.push({ ...img, id: id++ })
    if ((i + 1) % every === 0 && vi < totalVideos) {
      const v = vids[vi % vids.length]
      result.push({ ...v, id: id++ + 200000 })
      vi++
    }
  })

  while (vi < totalVideos) {
    const v = vids[vi % vids.length]
    result.push({ ...v, id: id++ + 200000 })
    vi++
  }

  return shuffle(result)
}

export function HomePage() {
  const media = useMemo<UniverseMedia[]>(() => {
    const caps = getDeviceCapabilities()
    const base = filterProfileManifest(imagesManifest as ManifestEntry[]).map(toUniverseMedia)
    const allImages = base.filter((m) => m.type !== 'video')
    const videos = base.filter((m) => m.type === 'video')

    // Reserve mesh budget for the interleaved video copies, fill the rest with images.
    const videoBudget = videos.length * caps.videoCopies
    const imageBudget = Math.max(0, caps.maxMeshes - videoBudget)
    const images = shuffle(allImages).slice(0, imageBudget)

    return interleaveMedia(images, videos, caps.videoCopies)
  }, [])

  return <UniverseCanvas media={media} />
}
