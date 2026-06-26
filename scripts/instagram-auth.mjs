import { access, mkdir, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const SESSION_DIR = path.join(__dirname, '.instagram-session')
export const STATE_PATH = path.join(SESSION_DIR, 'state.json')

export async function hasInstagramSession() {
  try {
    await access(STATE_PATH, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function clearInstagramSession() {
  await rm(SESSION_DIR, { recursive: true, force: true })
}

export async function ensureSessionDir() {
  await mkdir(SESSION_DIR, { recursive: true })
}
