import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
export const MOTION_DIR = path.join(ROOT, 'public/videos/motion')
export const POSTERS_DIR = path.join(MOTION_DIR, 'posters')
export const INSTAGRAM_VIDEO_DIR = path.join(ROOT, 'public/videos/instagram')
export const MOTION_MANIFEST = path.join(ROOT, 'src/data/motion.json')
export const WEBP_DIR = path.join(ROOT, 'public/images/instagram/webp')

export async function fileExists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

export function slugFromBasename(filename) {
  return path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function titleFromSlug(slug) {
  const vid = slug.match(/^vid-(\d+)$/i)
  if (vid) return `Reel ${parseInt(vid[1], 10)}`

  const cleaned = slug.replace(/^\d+-/, '').replace(/^vid-/, '')
  const words = cleaned.split('-').filter(Boolean)
  if (words.length === 0) return slug
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function sortKeyForFile(filename) {
  const base = path.basename(filename)
  const num = base.match(/^(\d+)[-_.]/)
  if (num) return parseInt(num[1], 10)
  const vid = base.match(/^vid-(\d+)/i)
  if (vid) return parseInt(vid[1], 10)
  return 99999
}

export async function readSidecarMeta(mp4Path) {
  const metaPath = mp4Path.replace(/\.mp4$/i, '.meta.json')
  if (!(await fileExists(metaPath))) return {}
  try {
    return JSON.parse(await readFile(metaPath, 'utf8'))
  } catch {
    console.warn(`⚠ Could not parse ${path.basename(metaPath)}`)
    return {}
  }
}

export async function probeVideo(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'json',
      filePath,
    ])
    const stream = JSON.parse(stdout).streams?.[0]
    if (!stream?.width || !stream?.height) return null
    return {
      width: stream.width,
      height: stream.height,
      landscape: stream.width > stream.height,
      square: stream.width === stream.height,
    }
  } catch {
    return null
  }
}

export function posterForBasename(basename) {
  const stem = path.basename(basename, '.mp4')
  const candidates = [
    path.join(POSTERS_DIR, `${stem}.webp`),
    path.join(POSTERS_DIR, `${stem}.jpg`),
    path.join(POSTERS_DIR, `${stem}.png`),
  ]
  return candidates
}

export function instagramPosterForVid(stem) {
  const m = stem.match(/^vid-(\d+)$/i)
  if (!m) return null
  return `/images/instagram/webp/img-${m[1]}.webp`
}

export async function resolvePoster(basename, metaPoster, existingPoster) {
  if (metaPoster) return metaPoster
  if (existingPoster) return existingPoster

  for (const candidate of posterForBasename(basename)) {
    if (await fileExists(candidate)) {
      return `/videos/motion/posters/${path.basename(candidate)}`
    }
  }

  return instagramPosterForVid(path.basename(basename, '.mp4'))
}
