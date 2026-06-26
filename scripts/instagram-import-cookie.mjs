/**
 * Import Instagram session from cookies copied from your normal browser.
 * Use this when 2FA blocks automated login — you stay logged in on Chrome/Safari,
 * copy cookies once, never paste password here.
 *
 * 1. Chrome'da instagram.com (zaten giriş yapmış ol)
 * 2. DevTools → Application → Cookies → instagram.com
 * 3. sessionid, csrftoken, ds_user_id değerlerini cookies.json'a yapıştır
 * 4. npm run instagram-import
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { ensureSessionDir, STATE_PATH } from './instagram-auth.mjs'

const SESSION_DIR = path.dirname(STATE_PATH)
const COOKIES_FILE = path.join(SESSION_DIR, 'cookies.json')
const PROFILE = 'https://www.instagram.com/mustafagumus______/'

const TEMPLATE = `[
  { "name": "sessionid", "value": "BURAYA_YAPIŞTIR" },
  { "name": "csrftoken", "value": "BURAYA_YAPIŞTIR" },
  { "name": "ds_user_id", "value": "BURAYA_YAPIŞTIR" }
]
`

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function loadCookies() {
  if (!existsSync(COOKIES_FILE)) {
    await ensureSessionDir()
    const { writeFile } = await import('node:fs/promises')
    await writeFile(COOKIES_FILE, TEMPLATE, 'utf8')
    console.log(`\n📄 Şablon oluşturuldu:\n   ${COOKIES_FILE}`)
    console.log('\nChrome\'da instagram.com → DevTools (F12) → Application → Cookies → instagram.com')
    console.log('sessionid, csrftoken, ds_user_id değerlerini dosyaya yapıştır.')
    console.log('Sonra tekrar: npm run instagram-import\n')
    process.exit(0)
  }

  const raw = JSON.parse(await readFile(COOKIES_FILE, 'utf8'))
  const list = Array.isArray(raw) ? raw : [raw]

  return list
    .filter((c) => c?.name && c?.value && !String(c.value).includes('BURAYA'))
    .map((c) => ({
      name: c.name,
      value: String(c.value).trim(),
      domain: '.instagram.com',
      path: '/',
      httpOnly: c.name === 'sessionid',
      secure: true,
      sameSite: 'None',
    }))
}

async function main() {
  const cookies = await loadCookies()

  if (!cookies.some((c) => c.name === 'sessionid')) {
    console.error('✗ cookies.json içinde sessionid yok. Şablonu doldur.')
    process.exit(1)
  }

  console.log(`→ ${cookies.length} çerez yüklendi, doğrulanıyor...`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  await context.addCookies(cookies)
  const page = await context.newPage()

  await page.goto(PROFILE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(3000)

  const onLoginPage = page.url().includes('/accounts/login')
  const hasPosts = await page.locator('a[href*="/p/"]').count().catch(() => 0)

  if (onLoginPage || hasPosts < 3) {
    console.error('\n✗ Oturum geçersiz veya süresi dolmuş.')
    console.error('  Chrome\'dan çerezleri yeniden kopyala (giriş yapmış haldeyken).\n')
    await browser.close()
    process.exit(1)
  }

  await ensureSessionDir()
  await context.storageState({ path: STATE_PATH })
  await browser.close()

  console.log('\n✅ Oturum kaydedildi (2FA gerekmedi).')
  console.log('   npm run scrape-instagram -- --fresh\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
