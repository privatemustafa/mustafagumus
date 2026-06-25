/**
 * Downloads Instagram videos via yt-dlp → public/videos/instagram/
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdir, readFile, writeFile, readdir, rm, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'src/data/images.json')
const OUT_DIR = path.join(ROOT, 'public/videos/instagram')
const TMP_DIR = path.join(ROOT, 'scripts/.video-tmp')

async function fileExists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function downloadPost(postUrl) {
  await rm(TMP_DIR, { recursive: true, force: true })
  await mkdir(TMP_DIR, { recursive: true })

  await execFileAsync(
    'yt-dlp',
    [
      '--no-warnings',
      '--no-progress',
      '-f',
      'best[ext=mp4]/best',
      '-o',
      path.join(TMP_DIR, '%(playlist_index)02d.%(ext)s'),
      postUrl,
    ],
    { timeout: 180000 },
  )

  const files = (await readdir(TMP_DIR))
    .filter((f) => f.endsWith('.mp4'))
    .sort()

  return files.map((f) => path.join(TMP_DIR, f))
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))

  const videoEntries = manifest.filter(
    (e) => e.key?.includes('.mp4') || e.type === 'video',
  )

  // Group by postUrl
  const byPost = new Map()
  for (const entry of videoEntries) {
    const url = entry.postUrl
    if (!url) continue
    if (!byPost.has(url)) byPost.set(url, [])
    byPost.get(url).push(entry)
  }

  let ok = 0

  for (const [postUrl, entries] of byPost) {
    const allOnDisk = await Promise.all(
      entries.map((e) => fileExists(path.join(OUT_DIR, `vid-${String(e.id).padStart(4, '0')}.mp4`))),
    )
    if (allOnDisk.every(Boolean)) {
      entries.forEach((e) => {
        e.type = 'video'
        e.videoSrc = `/videos/instagram/vid-${String(e.id).padStart(4, '0')}.mp4`
      })
      ok += entries.length
      console.log(`→ skip post (${entries.length} on disk)`)
      continue
    }

    console.log(`→ ${postUrl} (${entries.length} video(s))`)

    try {
      const downloaded = await downloadPost(postUrl)
      console.log(`  yt-dlp: ${downloaded.length} file(s)`)

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const filename = `vid-${String(entry.id).padStart(4, '0')}.mp4`
        const dest = path.join(OUT_DIR, filename)

        if (await fileExists(dest)) {
          entry.type = 'video'
          entry.videoSrc = `/videos/instagram/${filename}`
          ok++
          continue
        }

        const src = downloaded[i] ?? downloaded[0]
        if (!src) {
          console.log(`  ✗ no file for id ${entry.id}`)
          continue
        }

        await copyFile(src, dest)
        entry.type = 'video'
        entry.videoSrc = `/videos/instagram/${filename}`
        const size = (await readFile(dest)).length
        console.log(`  ✓ ${filename} (${(size / 1024 / 1024).toFixed(1)}MB)`)
        ok++
      }
    } catch (e) {
      console.log(`  ✗ failed: ${e.message}`)
    }
  }

  await rm(TMP_DIR, { recursive: true, force: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log(`\n✅ ${ok}/${videoEntries.length} videos ready`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
