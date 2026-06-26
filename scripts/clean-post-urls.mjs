import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const POST_URLS_FILE = path.join(__dirname, 'post-urls.json')
const USERNAME = 'mustafagumus______'

function normalizePostUrl(url) {
  const m = url.match(/\/p\/([A-Za-z0-9_-]+)/)
  if (!m) return null
  return `https://www.instagram.com/${USERNAME}/p/${m[1]}/`
}

const urls = JSON.parse(await readFile(POST_URLS_FILE, 'utf8'))
const clean = [...new Set(urls.map(normalizePostUrl).filter(Boolean))]
await writeFile(POST_URLS_FILE, JSON.stringify(clean, null, 2))
console.log(`${urls.length} → ${clean.length} profile-only post URLs`)
