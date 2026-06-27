#!/usr/bin/env node
/**
 * Download specific Instagram posts → public/videos/motion/
 *
 * Usage:
 *   npm run motion:add -- "https://www.instagram.com/p/ABC123/"
 *   npm run motion:add -- "URL" --title "DIOR Campaign"
 *   npm run motion:add -- --file scripts/motion-urls.txt
 *
 * motion-urls.txt format (one per line):
 *   https://instagram.com/p/ABC/ | DIOR Campaign
 *   https://instagram.com/p/XYZ/
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  MOTION_DIR,
  ROOT,
  fileExists,
  probeVideo,
} from './motion-utils.mjs'

const execFileAsync = promisify(execFile)
const TMP_DIR = path.join(ROOT, 'scripts/.video-tmp')

function parseArgs(argv) {
  const urls = []
  let title = null
  let file = null
  let landscapeOnly = true
  let orderStart = null

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--title' && argv[i + 1]) {
      title = argv[++i]
    } else if (a === '--file' && argv[i + 1]) {
      file = argv[++i]
    } else if (a === '--order' && argv[i + 1]) {
      orderStart = parseInt(argv[++i], 10)
    } else if (a === '--allow-portrait') {
      landscapeOnly = false
    } else if (a.startsWith('http')) {
      urls.push({ url: a.trim(), title })
      title = null
    }
  }

  return { urls, file, landscapeOnly, orderStart }
}

function slugFromTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function shortcodeFromUrl(url) {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
  return m?.[1] ?? null
}

async function parseUrlFile(filePath) {
  const raw = await readFile(path.resolve(ROOT, filePath), 'utf8')
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [url, ...rest] = line.split('|').map((s) => s.trim())
      return { url, title: rest.join('|') || null }
    })
    .filter((e) => e.url.startsWith('http'))
}

async function ytDlpMeta(postUrl) {
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['--no-warnings', '--print', '%(title)s', '--print', '%(id)s', postUrl],
      { timeout: 120000 },
    )
    const lines = stdout.trim().split('\n')
    return { title: lines[0] || null, id: lines[1] || shortcodeFromUrl(postUrl) }
  } catch {
    return { title: null, id: shortcodeFromUrl(postUrl) }
  }
}

async function downloadPost(postUrl) {
  await rm(TMP_DIR, { recursive: true, force: true })
  await mkdir(TMP_DIR, { recursive: true })

  try {
    await execFileAsync(
      'yt-dlp',
      [
        '--no-warnings',
        '--no-progress',
        '-f',
        'best[ext=mp4]/best',
        '--playlist-items',
        '1',
        '-o',
        path.join(TMP_DIR, 'video.%(ext)s'),
        postUrl,
      ],
      { timeout: 180000 },
    )
  } catch (e) {
    const tmp = await downloadPostPlaywright(postUrl)
    if (tmp) return tmp
    throw e
  }

  const files = (await readdir(TMP_DIR)).filter((f) => f.endsWith('.mp4'))
  if (files.length === 0) {
    const tmp = await downloadPostPlaywright(postUrl)
    if (tmp) return tmp
    throw new Error('No mp4 downloaded')
  }
  return path.join(TMP_DIR, files[0])
}

/** Fallback when yt-dlp fails — needs Instagram session + Chrome */
async function downloadPostPlaywright(postUrl) {
  const { chromium } = await import('playwright')
  const { STATE_PATH, hasInstagramSession } = await import('./instagram-auth.mjs')
  if (!(await hasInstagramSession())) return null

  const dest = path.join(TMP_DIR, 'video.mp4')
  const candidates = new Set()
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ storageState: STATE_PATH })
  const page = await context.newPage()

  page.on('response', (resp) => {
    const u = resp.url()
    if (u.includes('.mp4') && (u.includes('cdninstagram') || u.includes('fbcdn'))) {
      candidates.add(u.split('&bytestart')[0])
    }
  })

  try {
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 90000 })
    for (let n = 0; n < 3; n++) {
      await page.locator('video').first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(2000)
    }

    for (const mp4Url of [...candidates].sort((a, b) => b.length - a.length)) {
      try {
        const buf = await (await page.request.get(mp4Url)).body()
        const tmp = path.join(TMP_DIR, 'probe.mp4')
        await writeFile(tmp, buf)
        const probe = await probeVideo(tmp)
        if (probe?.width) {
          await writeFile(dest, buf)
          console.log('    (playwright fallback)')
          return dest
        }
      } catch {
        /* try next candidate */
      }
    }
    return null
  } finally {
    await browser.close()
  }
}

async function nextOrder() {
  const existing = await readdir(MOTION_DIR).catch(() => [])
  const nums = existing
    .map((f) => f.match(/^(\d+)-/))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10))
  return nums.length ? Math.max(...nums) + 1 : 1
}

async function uniqueBasename(base) {
  let name = base
  let n = 2
  while (await fileExists(path.join(MOTION_DIR, `${name}.mp4`))) {
    name = `${base}-${n++}`
  }
  return name
}

async function runSync() {
  await new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(ROOT, 'scripts/sync-motion.mjs')], {
      cwd: ROOT,
      stdio: 'inherit',
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`sync exited ${code}`))))
  })
}

async function addOne(entry, index, orderBase, landscapeOnly) {
  const { url, title: titleHint } = entry
  const code = shortcodeFromUrl(url)
  console.log(`\n→ ${url}`)

  const meta = await ytDlpMeta(url)
  const displayTitle = titleHint || meta.title || (code ? `Reel ${code}` : `Motion ${index + 1}`)
  const slug = slugFromTitle(displayTitle) || code || `reel-${Date.now()}`
  const order = orderBase + index
  const prefixed = `${String(order).padStart(2, '0')}-${slug}`
  const basename = await uniqueBasename(prefixed)

  const tmp = await downloadPost(url)
  const probe = await probeVideo(tmp)

  if (landscapeOnly && probe && !probe.landscape) {
    console.log(`  ✗ Skipped — portrait/square (${probe.width}×${probe.height}). Use --allow-portrait to force.`)
    return false
  }

  await mkdir(MOTION_DIR, { recursive: true })
  const dest = path.join(MOTION_DIR, `${basename}.mp4`)
  await copyFile(tmp, dest)

  const sizeMb = (await readFile(dest)).length / 1024 / 1024
  const dim = probe ? `${probe.width}×${probe.height}` : '?'
  console.log(`  ✓ ${basename}.mp4 (${dim}, ${sizeMb.toFixed(1)} MB)`)
  console.log(`    title: ${displayTitle}`)

  const metaPath = path.join(MOTION_DIR, `${basename}.meta.json`)
  await writeFile(
    metaPath,
    `${JSON.stringify({ title: displayTitle, order }, null, 2)}\n`,
  )

  return true
}

async function main() {
  const { urls: cliUrls, file, landscapeOnly, orderStart } = parseArgs(process.argv.slice(2))

  let entries = [...cliUrls]
  if (file) entries.push(...(await parseUrlFile(file)))

  if (entries.length === 0) {
    console.log(`
Usage:
  npm run motion:add -- "https://www.instagram.com/p/ABC123/"
  npm run motion:add -- "URL" --title "DIOR Campaign"
  npm run motion:add -- "URL1" "URL2" --title "First only applies to single URL before next flags"
  npm run motion:add -- --file scripts/motion-urls.txt

File format (scripts/motion-urls.txt):
  https://instagram.com/p/ABC/ | DIOR Campaign
  https://instagram.com/reel/XYZ/
`)
    process.exit(1)
  }

  try {
    await execFileAsync('yt-dlp', ['--version'])
  } catch {
    console.error('yt-dlp not found. Install: brew install yt-dlp')
    process.exit(1)
  }

  const orderBase = orderStart ?? (await nextOrder())
  let ok = 0

  for (let i = 0; i < entries.length; i++) {
    try {
      if (await addOne(entries[i], i, orderBase, landscapeOnly)) ok++
    } catch (e) {
      console.log(`  ✗ Failed: ${e.message}`)
    }
  }

  await rm(TMP_DIR, { recursive: true, force: true })

  if (ok > 0) {
    console.log(`\n→ Syncing motion.json…`)
    await runSync()
  } else {
    console.log('\nNo videos added.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
