/**
 * Cleans images.json:
 * - removes junk (JS/CSS/static assets, empty keys)
 * - removes Instagram grid column splits (narrow aspect + white divider)
 */
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

async function isGridSplit(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  if (width < 2 || height < 2) return true

  const aspect = width / height
  // Instagram grid columns: ~1/3 or 1/2 of a portrait frame
  if (aspect < 0.72) return true

  const px = (x, y) => {
    const i = (y * width + x) * channels
    return [data[i], data[i + 1], data[i + 2]]
  }
  const lum = (x, y) => {
    const [r, g, b] = px(x, y)
    return 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Thick white vertical divider (grid seam)
  const mid = Math.floor(width / 2)
  let whiteRun = 0
  for (let y = 0; y < height; y += 2) {
    const l = lum(mid, y)
    if (l > 235) whiteRun++
  }
  const whiteRatio = whiteRun / Math.ceil(height / 2)
  if (whiteRatio > 0.48 && aspect < 0.95) return true

  // Large black letterbox on one side (partial strip in carousel)
  const stripW = Math.max(4, Math.floor(width * 0.12))
  let leftDark = 0
  let rightDark = 0
  const samples = Math.min(80, height)
  for (let i = 0; i < samples; i++) {
    const y = Math.floor((i / samples) * (height - 1))
    if (lum(stripW, y) < 35) leftDark++
    if (lum(width - stripW, y) < 35) rightDark++
  }
  if ((leftDark > samples * 0.7 || rightDark > samples * 0.7) && aspect < 0.9) {
    return true
  }

  return false
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
  const removed = { junk: 0, split: 0, missing: 0, foreign: removedForeign, capped: ownerOnly.length - capped.length }

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
      if (await isGridSplit(filePath)) {
        removed.split++
        console.log(`  ✗ split  ${path.basename(filePath)} (${entry.id})`)
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
      `\n   foreign: ${removed.foreign}, capped: ${removed.capped}, junk: ${removed.junk}, split: ${removed.split}, missing: ${removed.missing}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
