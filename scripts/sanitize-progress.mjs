/**
 * Strips foreign / over-capped entries from scripts/.scrape-progress.json
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROGRESS_PATH = path.join(__dirname, '.scrape-progress.json')
const PROFILE = 'mustafagumus______'
const MAX = 10

function normalizePostUrl(url) {
  const m = (url || '').match(/\/p\/([A-Za-z0-9_-]+)/)
  if (!m) return null
  return `https://www.instagram.com/${PROFILE}/p/${m[1]}/`
}

function isProfilePostUrl(url) {
  return url?.includes(`instagram.com/${PROFILE}/p/`) ?? false
}

function sanitize(entries) {
  const perPost = new Map()
  const seenKeys = new Set()
  const kept = []

  for (const raw of entries) {
    const postUrl = normalizePostUrl(raw.postUrl)
    if (!postUrl || !isProfilePostUrl(postUrl)) continue

    if (raw.type === 'video' || raw.videoSrc) {
      kept.push({ ...raw, postUrl })
      continue
    }

    const code = postUrl.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1] ?? ''
    const count = perPost.get(code) ?? 0
    if (count >= MAX) continue

    const key = raw.key || raw.src
    if (key && seenKeys.has(key)) continue
    if (key) seenKeys.add(key)

    perPost.set(code, count + 1)
    kept.push({ ...raw, postUrl })
  }

  return kept
}

try {
  const raw = JSON.parse(await readFile(PROGRESS_PATH, 'utf8'))
  const before = (raw.downloaded || []).length
  raw.downloaded = sanitize(raw.downloaded || [])
  raw.postUrls = [...new Set((raw.postUrls || []).map(normalizePostUrl).filter(isProfilePostUrl))]
  await writeFile(PROGRESS_PATH, JSON.stringify(raw, null, 2))
  console.log(`✅ scrape-progress: ${before} → ${raw.downloaded.length} (profile-only)`)
} catch (e) {
  if (e.code === 'ENOENT') console.log('→ no scrape-progress.json')
  else throw e
}
