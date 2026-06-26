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
import { STATE_PATH, hasInstagramSession } from './instagram-auth.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/images/instagram')
const MANIFEST_PATH = path.join(ROOT, 'src/data/images.json')
const PROGRESS_PATH = path.join(ROOT, 'scripts/.scrape-progress.json')
const POST_URLS_FILE = path.join(ROOT, 'scripts/post-urls.json')

const PROFILE = 'https://www.instagram.com/mustafagumus______/'
const USERNAME = 'mustafagumus______'
const MAX_IMAGES_PER_POST = 10

function normalizePostUrl(url) {
  const m = url.match(/\/p\/([A-Za-z0-9_-]+)/)
  if (!m) return null
  return `https://www.instagram.com/${USERNAME}/p/${m[1]}/`
}

function isProfilePostUrl(url) {
  return url.includes(`instagram.com/${USERNAME}/p/`)
}

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
  if (/\.(js|css|gif)(\?|$)/i.test(url)) return false
  if (!/\.(jpg|jpeg|webp|png)/i.test(url.split('?')[0])) return false
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

  let prev = 0
  let stale = 0

  for (let i = 0; i < 400; i++) {
    const links = await page.evaluate((username) => {
      const scrollRoot =
        document.querySelector('main [role="tabpanel"]') ||
        document.querySelector('main') ||
        document.documentElement
      scrollRoot.scrollTop = scrollRoot.scrollHeight
      window.scrollTo(0, document.body.scrollHeight)

      return [...document.querySelectorAll(`a[href*="/${username}/p/"]`)]
        .map((a) => a.href.split('?')[0])
        .filter((h) => h.includes(`/${username}/p/`))
    }, USERNAME)
    links.forEach((u) => {
      const normalized = normalizePostUrl(u)
      if (normalized) urls.add(normalized)
    })

    if (urls.size === prev) {
      stale++
      if (stale >= 20) break
    } else {
      stale = 0
      prev = urls.size
      if (i % 10 === 0) console.log(`  … scroll ${i}: ${urls.size} post`)
    }

    await page.keyboard.press('End').catch(() => {})
    await page.mouse.wheel(0, 4000)
    await sleep(1200)
  }

  return [...urls]
}

async function extractPostImages(page) {
  const found = new Map()

  // ONLY images inside the main post <article> — never page JSON / suggested posts.
  const grabFromArticle = async () => {
    const items = await page.evaluate(() => {
      const article = document.querySelector('article')
      if (!article) return []
      const results: string[] = []
      article.querySelectorAll('img').forEach((img) => {
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
      if (!isPostImage(src)) continue
      const key = imageKey(src)
      if (key) found.set(key, src)
    }
  }

  await grabFromArticle()

  for (let slide = 0; slide < MAX_IMAGES_PER_POST; slide++) {
    if (found.size >= MAX_IMAGES_PER_POST) break

    const hasVideo = await page.evaluate(
      () => !!document.querySelector('article video, article video[src*="cdninstagram"]'),
    )
    if (!hasVideo) await grabFromArticle()

    const nextBtn = page.locator('article button[aria-label="Next"]').first()
    if (!(await nextBtn.isVisible().catch(() => false))) break
    await nextBtn.click().catch(() => {})
    await sleep(800)
    await grabFromArticle()
  }

  return [...found.values()].slice(0, MAX_IMAGES_PER_POST)
}

async function verifyPostOwner(page) {
  return page.evaluate((username) => {
    if (document.querySelector(`a[href="/${username}/"]`)) return true
    const html = document.documentElement.innerHTML
    return (
      html.includes(`"username":"${username}"`) ||
      html.includes(`"owner":{"username":"${username}"`) ||
      html.includes(`"user":{"username":"${username}"`)
    )
  }, USERNAME)
}

function sanitizeManifestEntry(entry) {
  if (!entry?.postUrl) return null
  const normalized = normalizePostUrl(entry.postUrl)
  if (!normalized || !isProfilePostUrl(normalized)) return null
  return { ...entry, postUrl: normalized }
}

function sanitizeManifest(entries) {
  const perPost = new Map()
  const seenKeys = new Set()
  const kept = []

  for (const raw of entries) {
    const entry = sanitizeManifestEntry(raw)
    if (!entry) continue

    if (entry.type === 'video' || entry.videoSrc) {
      kept.push(entry)
      continue
    }

    const code = entry.postUrl.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1] ?? ''
    const count = perPost.get(code) ?? 0
    if (count >= MAX_IMAGES_PER_POST) continue

    const key = entry.key || entry.src
    if (key && seenKeys.has(key)) continue
    if (key) seenKeys.add(key)

    perPost.set(code, count + 1)
    kept.push(entry)
  }

  return kept
}

async function loadProgress() {
  try {
    const raw = await readFile(PROGRESS_PATH, 'utf8')
    const progress = JSON.parse(raw)
    progress.downloaded = sanitizeManifest(progress.downloaded || [])
    progress.postUrls = [...new Set((progress.postUrls || []).map(normalizePostUrl).filter(isProfilePostUrl))]
    return progress
  } catch {
    return { downloaded: [], postIndex: 0, postUrls: [] }
  }
}

async function saveProgress(progress) {
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
}

async function main() {
  const fresh = process.argv.includes('--fresh')
  await mkdir(OUT_DIR, { recursive: true })

  if (fresh) {
    await writeFile(PROGRESS_PATH, JSON.stringify({ downloaded: [], postIndex: 0, postUrls: [] }, null, 2))
    console.log('→ Önbellek sıfırlandı (--fresh)')
  }

  let preservedVideos = []
  if (fresh) {
    try {
      const existing = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
      preservedVideos = existing.filter((e) => e.type === 'video' || e.videoSrc)
      if (preservedVideos.length) console.log(`→ ${preservedVideos.length} video manifestte korunacak`)
    } catch {}
  }

  const progress = await loadProgress()
  const globalSeen = new Set(progress.downloaded.map((d) => d.key))

  const browser = await chromium.launch({ headless: true })
  const contextOptions = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  }

  if (await hasInstagramSession()) {
    contextOptions.storageState = STATE_PATH
    console.log('→ Kayıtlı Instagram oturumu yüklendi')
  } else if (process.env.INSTAGRAM_SESSION_COOKIE) {
    // legacy fallback
  } else {
    console.error(
      '\n✗ Instagram oturumu yok.\n' +
        '   Önce: npm run instagram-login\n' +
        '   Sonra: npm run scrape-instagram -- --fresh\n',
    )
    await browser.close()
    process.exit(1)
  }

  const context = await browser.newContext(contextOptions)

  if (process.env.INSTAGRAM_SESSION_COOKIE && !(await hasInstagramSession())) {
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
    console.log('→ Oturum çerezi yüklendi (env)')
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

  let postUrls = fresh ? [] : progress.postUrls
  if (postUrls.length === 0) {
    if (!fresh) {
      try {
        const fileUrls = JSON.parse(await readFile(POST_URLS_FILE, 'utf8'))
        if (Array.isArray(fileUrls) && fileUrls.length > 0) {
          postUrls = fileUrls.map(normalizePostUrl).filter(isProfilePostUrl)
          console.log(`→ ${postUrls.length} post (post-urls.json)`)
        }
      } catch {}
    }

    if (postUrls.length === 0) {
      console.log('→ Post URL\'leri toplanıyor (scroll)...')
      postUrls = await collectPostUrls(page)
    }
    postUrls = postUrls.map(normalizePostUrl).filter(Boolean).filter(isProfilePostUrl)
    progress.postUrls = postUrls
    await saveProgress(progress)
    await writeFile(POST_URLS_FILE, JSON.stringify(postUrls, null, 2))
    console.log(`  ${postUrls.length} post bulundu`)
  } else {
    postUrls = postUrls.map(normalizePostUrl).filter(Boolean).filter(isProfilePostUrl)
    console.log(`→ ${postUrls.length} post (önbellekten, profil filtrelendi)`)
  }

  const manifest = sanitizeManifest([...progress.downloaded])
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

      if (!(await verifyPostOwner(page))) {
        console.log('  ! atlandı — post @' + USERNAME + ' hesabına ait değil')
        progress.postIndex = i + 1
        await saveProgress(progress)
        continue
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
            postUrl: normalizePostUrl(postUrl),
          })
          console.log(`  ✓ ${filename}`)
        } catch (e) {
          try {
            await downloadImage(url, dest)
            manifest.push({
              id: counter,
              key,
              src: `/images/instagram/${filename}`,
              postUrl: normalizePostUrl(postUrl),
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
    progress.downloaded = sanitizeManifest(manifest)
    await saveProgress(progress)
    await sleep(800)
  }

  const finalManifest = sanitizeManifest([...manifest, ...sanitizeManifest(preservedVideos)])
  await writeFile(MANIFEST_PATH, JSON.stringify(finalManifest, null, 2))
  console.log(`\n✅ Tamamlandı: ${finalManifest.length} görsel → ${MANIFEST_PATH}`)

  if (postUrls.length < 40 && !(await hasInstagramSession()) && !process.env.INSTAGRAM_SESSION_COOKIE) {
    console.log(
      '\n⚠️  Sadece ~24 post görüldü (giriş yok). 2021\'e kadar tüm postlar için:\n' +
        '   INSTAGRAM_SESSION_COOKIE="sessionid=..." npm run scrape-instagram -- --fresh',
    )
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
