/**
 * Converts all Instagram JPEGs to WebP (max 900px wide, quality 78)
 * Outputs to public/images/instagram/webp/
 * Updates src/data/images.json to point to .webp paths
 */
import sharp from 'sharp'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'public/images/instagram')
const OUT_DIR = path.join(ROOT, 'public/images/instagram/webp')
const MANIFEST_PATH = path.join(ROOT, 'src/data/images.json')

const MAX_WIDTH = 820
const QUALITY = 74

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const files = (await readdir(SRC_DIR)).filter(
    (f) => f.endsWith('.jpg') || f.endsWith('.jpeg'),
  )

  console.log(`→ ${files.length} images to convert...`)

  let saved = 0
  let totalOriginal = 0
  let totalConverted = 0

  await Promise.all(
    files.map(async (file) => {
      const src = path.join(SRC_DIR, file)
      const outName = file.replace(/\.(jpg|jpeg)$/i, '.webp')
      const dest = path.join(OUT_DIR, outName)

      try {
        const info = await sharp(src)
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: QUALITY, effort: 4 })
          .toFile(dest)

        const origSize = (await sharp(src).metadata()).size ?? 0
        totalOriginal += origSize
        totalConverted += info.size
        saved++
      } catch (e) {
        console.warn(`  ✗ ${file}: ${e.message}`)
      }
    }),
  )

  console.log(
    `✅ ${saved}/${files.length} converted` +
      `\n   Before: ${(totalOriginal / 1024 / 1024).toFixed(1)} MB` +
      `\n   After:  ${(totalConverted / 1024 / 1024).toFixed(1)} MB` +
      `\n   Saved:  ${(((totalOriginal - totalConverted) / totalOriginal) * 100).toFixed(0)}%`,
  )

  // Update manifest
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  let updated = 0
  for (const entry of manifest) {
    if (entry.src?.includes('/images/instagram/') && !entry.src.includes('/webp/')) {
      const base = path.basename(entry.src, path.extname(entry.src))
      entry.src = `/images/instagram/webp/${base}.webp`
      updated++
    }
  }
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log(`→ Manifest updated: ${updated} entries → webp paths`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
