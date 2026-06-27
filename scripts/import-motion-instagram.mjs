#!/usr/bin/env node
/**
 * Copy landscape Instagram reels into public/videos/motion/
 * then regenerate motion.json
 *
 * Requires: ffprobe (brew install ffmpeg)
 */
import { copyFile, readdir, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  INSTAGRAM_VIDEO_DIR,
  MOTION_DIR,
  ROOT,
  fileExists,
  probeVideo,
} from './motion-utils.mjs'

const USE_SYMLINK = !process.argv.includes('--copy')

async function linkOrCopy(src, dest) {
  if (await fileExists(dest)) return 'skip'
  if (USE_SYMLINK) {
    const rel = path.relative(path.dirname(dest), src)
    await symlink(rel, dest)
    return 'link'
  }
  await copyFile(src, dest)
  return 'copy'
}

async function main() {
  if (!(await fileExists(INSTAGRAM_VIDEO_DIR))) {
    console.error('No public/videos/instagram/ folder. Run: npm run fetch-videos')
    process.exit(1)
  }

  const files = (await readdir(INSTAGRAM_VIDEO_DIR)).filter((f) => f.endsWith('.mp4'))
  if (files.length === 0) {
    console.error('No Instagram .mp4 files found. Run: npm run fetch-videos')
    process.exit(1)
  }

  let landscape = 0
  let portrait = 0
  let skipped = 0

  console.log(`\n→ Scanning ${files.length} Instagram video(s)…\n`)

  for (const file of files) {
    const src = path.join(INSTAGRAM_VIDEO_DIR, file)
    const dest = path.join(MOTION_DIR, file)
    const probe = await probeVideo(src)

    if (!probe) {
      console.log(`  ? ${file} — ffprobe failed, skipped`)
      skipped++
      continue
    }

    const tag = `${probe.width}×${probe.height}`

    if (!probe.landscape) {
      portrait++
      if (await fileExists(dest)) {
        await rm(dest, { force: true })
        console.log(`  ✗ ${file} (${tag} portrait) — removed from motion/`)
      } else {
        console.log(`  − ${file} (${tag} portrait) — not for motion`)
      }
      continue
    }

    const action = await linkOrCopy(src, dest)
    landscape++
    if (action === 'skip') {
      console.log(`  ○ ${file} (${tag}) — already in motion/`)
    } else {
      console.log(`  ✓ ${file} (${tag}) — ${action === 'link' ? 'linked' : 'copied'} to motion/`)
    }
  }

  console.log(`\n→ Landscape: ${landscape} | Portrait skipped: ${portrait} | Unknown: ${skipped}\n`)

  await new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(ROOT, 'scripts/sync-motion.mjs')], {
      cwd: ROOT,
      stdio: 'inherit',
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`sync exited ${code}`))))
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
