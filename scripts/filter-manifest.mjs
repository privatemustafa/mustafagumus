/**
 * Cleans images.json:
 * - removes junk (JS/CSS/static assets, empty keys)
 * - removes partial crops, grid splits, letterboxed strips
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBadCrop } from './image-quality.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'src/data/images.json')
const PUBLIC = path.join(ROOT, 'public')
const PROFILE_USER = 'mustafagumus______'
const MAX_IMAGES_PER_POST = 10

function isOwnerPost(entry) {
  const url = entry.postUrl || ''
  if (!url.includes('instagram.com')) return false
  if (entry.type === 'video' || entry.videoSrc) {
    return url.includes(`/${PROFILE_USER}/`)
  }
  return url.includes(`/${PROFILE_USER}/p/`)
}

function postShortcode(url) {
  const m = url.match(/\/p\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : url
}

function isJunkEntry(entry) {
  if (entry.type === 'video' || entry.videoSrc) return false
  const key = entry.key || ''
  if (!key) return true
  if (key.startsWith('http') && !/\.mp4/i.test(key)) return true
  if (!entry.src?.includes('/images/instagram')) return true
  return false
}

function resolveImagePath(src) {
  const rel = src.replace(/^\//, '')
  const candidates = [
    path.join(PUBLIC, rel),
    path.join(PUBLIC, rel.replace('/webp/', '/').replace('.webp', '.jpg')),
    path.join(PUBLIC, 'images/instagram', path.basename(rel).replace('.webp', '.jpg')),
  ]
  return candidates.find((p) => existsSync(p))
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  const ownerOnly = manifest.filter(isOwnerPost)
  const removedForeign = manifest.length - ownerOnly.length

  const perPost = new Map()
  const dedupedKeys = new Set()
  const capped = []

  for (const entry of ownerOnly) {
    if (entry.type === 'video' || entry.videoSrc) {
      capped.push(entry)
      continue
    }
    const code = postShortcode(entry.postUrl)
    const count = perPost.get(code) ?? 0
    if (count >= MAX_IMAGES_PER_POST) continue
    const key = entry.key || entry.src
    if (dedupedKeys.has(key)) continue
    dedupedKeys.add(key)
    perPost.set(code, count + 1)
    capped.push(entry)
  }

  const kept = []
  const removed = { junk: 0, crop: 0, missing: 0, foreign: removedForeign, capped: ownerOnly.length - capped.length }

  for (const entry of capped) {
    if (isJunkEntry(entry)) {
      removed.junk++
      continue
    }
    if (entry.type === 'video') {
      kept.push(entry)
      continue
    }

    const filePath = resolveImagePath(entry.src)
    if (!filePath) {
      removed.missing++
      continue
    }

    try {
      if (await isBadCrop(filePath)) {
        removed.crop++
        console.log(`  ✗ crop   ${path.basename(filePath)} (${entry.id})`)
        continue
      }
    } catch (e) {
      console.warn(`  ? ${entry.src}: ${e.message}`)
      removed.missing++
      continue
    }

    kept.push(entry)
  }

  // Re-number ids
  kept.forEach((e, i) => {
    e.id = i + 1
  })

  await writeFile(MANIFEST_PATH, JSON.stringify(kept, null, 2))
  console.log(
    `\n✅ Manifest: ${manifest.length} → ${kept.length}` +
      `\n   foreign: ${removed.foreign}, capped: ${removed.capped}, junk: ${removed.junk}, crop: ${removed.crop}, missing: ${removed.missing}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
