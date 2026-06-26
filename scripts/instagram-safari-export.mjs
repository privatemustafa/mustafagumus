/**
 * Exports Instagram cookies from your logged-in Safari session.
 * Requires: Safari → Develop → Allow Remote Automation (one-time)
 */
import { Builder } from 'selenium-webdriver'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { ensureSessionDir, STATE_PATH } from './instagram-auth.mjs'

const PROFILE = 'https://www.instagram.com/mustafagumus______/'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('→ Safari oturumundan çerezler alınıyor...')
  console.log('  (Safari → Geliştir → Uzaktan Otomasyona İzin Ver — açık olmalı)\n')

  const driver = await new Builder().forBrowser('safari').build()

  try {
    await driver.get(PROFILE)
    await sleep(4000)

    const url = await driver.getCurrentUrl()
    if (url.includes('/accounts/login')) {
      throw new Error('Safari\'de giriş görünmüyor. Profilde postlar açık olmalı.')
    }

    const cookies = await driver.manage().getCookies()
    const needed = ['sessionid', 'csrftoken', 'ds_user_id']
    const names = cookies.map((c) => c.name)

    if (!names.includes('sessionid')) {
      throw new Error('sessionid bulunamadı. Instagram profilinde olduğundan emin ol.')
    }

    const pwCookies = cookies
      .filter((c) => c.domain?.includes('instagram'))
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain?.startsWith('.') ? c.domain : `.${c.domain}`,
        path: c.path || '/',
        expires: c.expiry ?? -1,
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        sameSite: c.sameSite === 'None' ? 'None' : 'Lax',
      }))

    await ensureSessionDir()
    await writeFile(STATE_PATH, JSON.stringify({ cookies: pwCookies, origins: [] }, null, 2))

    // Verify with Playwright
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ storageState: STATE_PATH })
    const page = await context.newPage()
    await page.goto(PROFILE, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(2000)
    const count = await page.locator('a[href*="/p/"]').count()
    await browser.close()

    if (count < 5) {
      throw new Error('Oturum kaydedildi ama postlar yüklenmedi. Tekrar dene.')
    }

    console.log(`✅ Safari oturumu kaydedildi (${pwCookies.length} çerez, ${count}+ post görünür)`)
    console.log('   npm run scrape-instagram -- --fresh\n')
  } finally {
    await driver.quit()
  }
}

main().catch((e) => {
  console.error('\n✗', e.message)
  console.error('\nManuel yol: Safari Web Denetçisi → Çerezler → cookies.json → npm run instagram-import\n')
  process.exit(1)
})
