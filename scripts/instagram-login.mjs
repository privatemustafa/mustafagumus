/**
 * Opens Chrome — log in once (2FA OK). Session saves automatically.
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { ensureSessionDir, STATE_PATH } from './instagram-auth.mjs'

const LOGIN_URL = 'https://www.instagram.com/accounts/login/'
const PROFILE = 'https://www.instagram.com/mustafagumus______/'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  if (process.argv.includes('--logout')) {
    const { clearInstagramSession } = await import('./instagram-auth.mjs')
    await clearInstagramSession()
    console.log('✓ Oturum silindi.')
    return
  }

  await ensureSessionDir()

  console.log('\n📱 Chrome açılıyor — Instagram\'a giriş yap (2FA dahil).')
  console.log('   Bitince otomatik kaydedeceğim, terminalde bir şey yapma.\n')

  const browser = await chromium
    .launch({ headless: false, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: false }))

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })

  let saved = false
  for (let i = 0; i < 180; i++) {
    const cookies = await context.cookies('https://www.instagram.com')
    const session = cookies.find((c) => c.name === 'sessionid' && c.value.length > 10)

    if (session) {
      await page.goto(PROFILE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
      await sleep(2500)
      const posts = await page.locator('a[href*="/p/"]').count().catch(() => 0)
      const onLogin = page.url().includes('/accounts/login')

      if (!onLogin && posts >= 3) {
        await context.storageState({ path: STATE_PATH })
        saved = true
        console.log(`\n✅ Giriş algılandı — oturum kaydedildi (${posts}+ post görünür)`)
        break
      }
    }

    if (i % 15 === 0 && i > 0) console.log('   … giriş bekleniyor')
    await sleep(2000)
  }

  await browser.close()

  if (!saved) {
    console.error('\n✗ 6 dk içinde giriş algılanmadı. Tekrar: npm run instagram-login\n')
    process.exit(1)
  }

  if (process.argv.includes('--scrape')) {
    console.log('→ Scrape başlıyor...\n')
    const { spawn } = await import('node:child_process')
    const { fileURLToPath } = await import('node:url')
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', 'scrape-instagram', '--', '--fresh'], {
        cwd: root,
        stdio: 'inherit',
        shell: true,
      })
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`scrape exit ${code}`))))
    })
  } else {
    console.log('   Sonraki: npm run scrape-instagram -- --fresh\n')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
