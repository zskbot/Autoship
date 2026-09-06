import fs from 'node:fs/promises'
import path from 'node:path'
const defaultFile = '/data/autoship/state.json'
export async function loadState(file = process.env.AUTOSHIP_STATE_FILE || defaultFile) {
  const raw = await fs.readFile(file, 'utf8').catch(() => null)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { throw new Error(`Autoship state file is invalid JSON: ${file}`) }
}
export async function saveState(state, file = process.env.AUTOSHIP_STATE_FILE || defaultFile) {
  const directory = path.dirname(file)
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  const temporary = `${file}.tmp-${process.pid}`
  await fs.writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
  await fs.rename(temporary, file)
}
export function persistenceEnabled() { return Boolean((process.env.AUTOSHIP_STATE_FILE || '').trim()) }
