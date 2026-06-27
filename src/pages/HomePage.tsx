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
  return {
    id: entry.id,
    src: entry.src,
    type: 'image',
  }
}

export function HomePage() {
  const media = useMemo<UniverseMedia[]>(() => {
    const caps = getDeviceCapabilities()
    const base = filterProfileManifest(imagesManifest as ManifestEntry[])
      .filter((e) => e.type !== 'video' && !e.videoSrc)
      .map(toUniverseMedia)

    return shuffle(base).slice(0, caps.maxMeshes)
  }, [])

  return <UniverseCanvas media={media} />
}
