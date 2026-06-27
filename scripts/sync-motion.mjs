#!/usr/bin/env node
/**
 * Build src/data/motion.json from public/videos/motion/*.mp4
 *
 * Drop videos here → run npm run motion:sync
 * Optional sidecar: my-film.meta.json next to my-film.mp4
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  MOTION_DIR,
  MOTION_MANIFEST,
  fileExists,
  readSidecarMeta,
  resolvePoster,
  slugFromBasename,
  sortKeyForFile,
  titleFromSlug,
} from './motion-utils.mjs'

async function loadExisting() {
  if (!(await fileExists(MOTION_MANIFEST))) return []
  try {
    return JSON.parse(await readFile(MOTION_MANIFEST, 'utf8'))
  } catch {
    return []
  }
}

async function listMotionVideos() {
  const names = await readdir(MOTION_DIR)
  return names
    .filter((n) => n.toLowerCase().endsWith('.mp4'))
    .sort((a, b) => {
      const ka = sortKeyForFile(a)
      const kb = sortKeyForFile(b)
      if (ka !== kb) return ka - kb
      return a.localeCompare(b, undefined, { numeric: true })
    })
}

async function main() {
  const existing = await loadExisting()
  const byId = new Map(existing.map((e) => [e.id, e]))
  const bySrc = new Map(existing.map((e) => [e.src, e]))
  const files = await listMotionVideos()

  if (files.length === 0) {
    console.log('No .mp4 files in public/videos/motion/')
    console.log('Drop videos there, then run: npm run motion:sync')
    await writeFile(MOTION_MANIFEST, '[]\n')
    return
  }

  const entries = []

  for (let i = 0; i < files.length; i++) {
    const filename = files[i]
    const basename = path.basename(filename)
    const id = slugFromBasename(basename)
    const fullPath = path.join(MOTION_DIR, filename)
    const meta = await readSidecarMeta(fullPath)
    const prev = byId.get(id) ?? bySrc.get(`/videos/motion/${basename}`)

    const title = meta.title ?? prev?.title ?? titleFromSlug(id)
    const subtitle = meta.subtitle ?? prev?.subtitle
    const order = meta.order ?? prev?.order ?? i + 1
    const poster = await resolvePoster(basename, meta.poster, prev?.poster)

    let version = ''
    try {
      const st = await stat(fullPath)
      version = `?v=${st.size.toString(36)}${Math.round(st.mtimeMs).toString(36)}`
    } catch {
      /* no stat → no cache-busting param */
    }

    const width = meta.width ?? prev?.width
    const height = meta.height ?? prev?.height
    const orientation =
      meta.orientation ??
      prev?.orientation ??
      (width && height ? (height > width ? 'portrait' : 'landscape') : 'landscape')

    const entry = {
      id,
      title,
      src: `/videos/motion/${basename}${version}`,
      order,
      orientation,
    }
    if (subtitle) entry.subtitle = subtitle
    if (poster) entry.poster = poster
    if (width) entry.width = width
    if (height) entry.height = height

    entries.push(entry)
  }

  entries.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  entries.forEach((e, idx) => {
    e.order = idx + 1
  })

  await writeFile(MOTION_MANIFEST, `${JSON.stringify(entries, null, 2)}\n`)

  console.log(`\n✅ motion.json — ${entries.length} video(s)\n`)
  for (const e of entries) {
    console.log(`  ${String(e.order).padStart(2, '0')}. ${e.title}`)
    console.log(`      ${e.src}`)
    if (e.subtitle) console.log(`      ${e.subtitle}`)
  }
  console.log('\nRefresh /motion in the browser.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
