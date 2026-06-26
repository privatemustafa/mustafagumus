/** Only content scraped from @mustafagumus______ profile posts may appear on the site. */

export const PROFILE_USER = 'mustafagumus______'
export const MAX_IMAGES_PER_POST = 10

export type ManifestLike = {
  postUrl?: string
  type?: string
  videoSrc?: string
  key?: string
  src?: string
}

export function isProfileManifestEntry(entry: ManifestLike): boolean {
  const url = entry.postUrl || ''
  if (!url.includes('instagram.com')) return false
  if (entry.type === 'video' || entry.videoSrc) {
    return url.includes(`/${PROFILE_USER}/`)
  }
  return url.includes(`/${PROFILE_USER}/p/`)
}

export function filterProfileManifest<T extends ManifestLike>(entries: T[]): T[] {
  const perPost = new Map<string, number>()
  const seenKeys = new Set<string>()
  const kept: T[] = []

  for (const entry of entries) {
    if (!isProfileManifestEntry(entry)) continue

    if (entry.type === 'video' || entry.videoSrc) {
      kept.push(entry)
      continue
    }

    const shortcode = entry.postUrl?.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1] ?? ''
    const count = perPost.get(shortcode) ?? 0
    if (count >= MAX_IMAGES_PER_POST) continue

    const key = entry.key || entry.src || ''
    if (key && seenKeys.has(key)) continue
    if (key) seenKeys.add(key)

    perPost.set(shortcode, count + 1)
    kept.push(entry)
  }

  return kept
}
