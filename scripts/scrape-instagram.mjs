/**
 * Scrapes all image posts (incl. carousel frames) from @mustafagumus______
 * Skips video/reel slides. Saves originals in color to public/images/instagram/
 */
import { chromium } from 'playwright'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/images/instagram')
const MANIFEST_PATH = path.join(ROOT, 'src/data/images.json')
const PROGRESS_PATH = path.join(ROOT, 'scripts/.scrape-progress.json')
const POST_URLS_FILE = path.join(ROOT, 'scripts/post-urls.json')

const PROFILE = 'https://www.instagram.com/mustafagumus______/'
const USERNAME = 'mustafagumus______'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function imageKey(url) {
  const m = url.match(/\/(\d+_\d+_\d+_n)\./)
  return m ? m[1] : url.split('?')[0]
}

function isPostImage(url, alt) {
  if (!url.includes('cdninstagram') && !url.includes('fbcdn')) return false
  if (url.includes('/s150x150') || url.includes('/s320x320')) return false
  if (alt?.includes('profile picture')) return false
  if (url.includes('rsrc.php')) return false
  return true
}

async function downloadImage(url, dest) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://www.instagram.com/',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

async function collectPostUrls(page) {
  const urls = new Set()

  // JSON gömülü shortcode'lar
  const fromJson = await page.evaluate(() => {
    const codes = new Set()
    document.querySelectorAll('script[type="application/json"]').forEach((s) => {
      try {
        const text = s.textContent || ''
        const matches = text.matchAll(/"shortcode":"([A-Za-z0-9_-]+)"/g)
        for (const m of matches) codes.add(m[1])
      } catch {}
    })
    return [...codes]
  })
  fromJson.forEach((code) => urls.add(`https://www.instagram.com/p/${code}/`))

  let prev = urls.size
  let stale = 0

  for (let i = 0; i < 100; i++) {
    const links = await page.evaluate(() => {
      const scrollRoot =
        document.querySelector('main [role="tabpanel"]') ||
        document.querySelector('main') ||
        document.documentElement
      scrollRoot.scrollTop = scrollRoot.scrollHeight
      window.scrollTo(0, document.body.scrollHeight)

      return [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')]
        .map((a) => a.href.split('?')[0])
        .filter((h) => h.includes('/p/'))
    })
    links.forEach((u) => urls.add(u))

    if (urls.size === prev) {
      stale++
      if (stale >= 6) break
    } else {
      stale = 0
      prev = urls.size
    }

    await page.mouse.wheel(0, 2500)
    await sleep(1800)
  }

  return [...urls].filter((u) => u.includes(`instagram.com`) && u.includes('/p/'))
}

async function extractPostImages(page) {
  const found = new Map()

  const fromJson = await page.evaluate(() => {
    const urls = []
    const push = (u) => {
      if (u && (u.includes('cdninstagram') || u.includes('fbcdn'))) urls.push(u)
    }
    document.querySelectorAll('script[type="application/json"]').forEach((s) => {
      const text = s.textContent || ''
      for (const m of text.matchAll(/"display_url":"([^"]+)"/g)) {
        push(m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'))
      }
      for (const m of text.matchAll(/"url":"(https:\\\/\\\/[^"]+)"/g)) {
        push(m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'))
      }
    })
    return urls
  })
  for (const url of fromJson) {
    const key = imageKey(url)
    if (key) found.set(key, url)
  }

  const grabVisible = async () => {
    const items = await page.evaluate(() => {
      const results = []
      document.querySelectorAll('img').forEach((img) => {
        if (img.naturalWidth < 250) return
        const src = img.currentSrc || img.src
        if (!src.includes('cdninstagram') && !src.includes('fbcdn')) return
        if (src.includes('s150x150') || src.includes('s320x320')) return
        if (img.alt?.toLowerCase().includes('profile picture')) return
        results.push(src)
      })
      return results
    })
    for (const src of items) {
      const key = imageKey(src)
      if (key) found.set(key, src)
    }
  }

  await grabVisible()

  for (let slide = 0; slide < 20; slide++) {
    const hasVideo = await page.evaluate(
      () => !!document.querySelector('article video, video[src*="cdninstagram"]'),
    )
    if (!hasVideo) await grabVisible()

    const nextBtn = page.locator('button[aria-label="Next"]').first()
    if (!(await nextBtn.isVisible().catch(() => false))) break
    await nextBtn.click().catch(() => {})
    await sleep(800)
    await grabVisible()
  }

  return [...found.values()]
}

async function loadProgress() {
  try {
    const raw = await readFile(PROGRESS_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { downloaded: [], postIndex: 0, postUrls: [] }
  }
}

async function saveProgress(progress) {
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const progress = await loadProgress()
  const globalSeen = new Set(progress.downloaded.map((d) => d.key))

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  })

  // Giriş yapılmış hesap için: INSTAGRAM_SESSION_COOKIE=sessionid=... npm run scrape-instagram
  if (process.env.INSTAGRAM_SESSION_COOKIE) {
    const cookies = process.env.INSTAGRAM_SESSION_COOKIE.split(';').map((part) => {
      const [name, ...rest] = part.trim().split('=')
      return {
        name: name.trim(),
        value: rest.join('=').trim(),
        domain: '.instagram.com',
        path: '/',
      }
    })
    await context.addCookies(cookies)
    console.log('→ Oturum çerezi yüklendi')
  }
  const page = await context.newPage()

  console.log('→ Profil yükleniyor...')
  await page.goto(PROFILE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(3000)

  // Dismiss login modal if present
  const closeBtn = page.locator('button:has-text("Close"), [aria-label="Close"]').first()
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click().catch(() => {})
    await sleep(500)
  }

  let postUrls = progress.postUrls
  if (postUrls.length === 0) {
    try {
      const fileUrls = JSON.parse(await readFile(POST_URLS_FILE, 'utf8'))
      if (Array.isArray(fileUrls) && fileUrls.length > 0) {
        postUrls = fileUrls
        console.log(`→ ${postUrls.length} post (post-urls.json)`)
      }
    } catch {}

    if (postUrls.length === 0) {
      console.log('→ Post URL\'leri toplanıyor (scroll)...')
      postUrls = await collectPostUrls(page)
    }
    progress.postUrls = postUrls
    await saveProgress(progress)
    console.log(`  ${postUrls.length} post bulundu`)
  } else {
    console.log(`→ ${postUrls.length} post (önbellekten)`)
  }

  const manifest = [...progress.downloaded]
  let counter = manifest.length

  for (let i = progress.postIndex; i < postUrls.length; i++) {
    const postUrl = postUrls[i]
    console.log(`[${i + 1}/${postUrls.length}] ${postUrl}`)

    try {
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await sleep(2000)

      const closeModal = page.locator('[aria-label="Close"]').first()
      if (await closeModal.isVisible().catch(() => false)) {
        await closeModal.click().catch(() => {})
        await sleep(400)
      }

      const imageUrls = await extractPostImages(page)

      for (const url of imageUrls) {
        const key = imageKey(url)
        if (globalSeen.has(key)) continue
        globalSeen.add(key)

        counter++
        const filename = `img-${String(counter).padStart(4, '0')}.jpg`
        const dest = path.join(OUT_DIR, filename)

        try {
          // Prefer higher res: swap size params
          const hiRes = url
            .replace(/s\d+x\d+/g, 's1080x1080')
            .replace(/p640x640/g, 'p1080x1080')
          await downloadImage(hiRes, dest)
          manifest.push({
            id: counter,
            key,
            src: `/images/instagram/${filename}`,
            postUrl,
          })
          console.log(`  ✓ ${filename}`)
        } catch (e) {
          try {
            await downloadImage(url, dest)
            manifest.push({
              id: counter,
              key,
              src: `/images/instagram/${filename}`,
              postUrl,
            })
            console.log(`  ✓ ${filename} (fallback)`)
          } catch (e2) {
            console.log(`  ✗ atlandı: ${e2.message}`)
            counter--
            globalSeen.delete(key)
          }
        }

        await sleep(200)
      }
    } catch (e) {
      console.log(`  ! post hatası: ${e.message}`)
    }

    progress.postIndex = i + 1
    progress.downloaded = manifest
    await saveProgress(progress)
    await sleep(800)
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log(`\n✅ Tamamlandı: ${manifest.length} görsel → ${MANIFEST_PATH}`)

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
