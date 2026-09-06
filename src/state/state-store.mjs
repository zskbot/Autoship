import fs from 'node:fs/promises'
import path from 'node:path'

const defaultFile = '/data/autoship/state.json'
let poolPromise

export async function loadState(file = process.env.AUTOSHIP_STATE_FILE || defaultFile) {
  if (databaseEnabled()) return loadDatabaseState()
  const raw = await fs.readFile(file, 'utf8').catch(() => null)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { throw new Error(`Autoship state file is invalid JSON: ${file}`) }
}

export async function saveState(state, file = process.env.AUTOSHIP_STATE_FILE || defaultFile) {
  if (databaseEnabled()) return saveDatabaseState(state)
  const directory = path.dirname(file)
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  const temporary = `${file}.tmp-${process.pid}`
  await fs.writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
  await fs.rename(temporary, file)
}

export function persistenceEnabled() {
  return databaseEnabled() || Boolean((process.env.AUTOSHIP_STATE_FILE || '').trim())
}

export function databaseEnabled() { return Boolean((process.env.AUTOSHIP_DATABASE_URL || '').trim()) }

async function getPool() {
  if (!poolPromise) {
    poolPromise = import('pg').then(({ Pool }) => new Pool({ connectionString: process.env.AUTOSHIP_DATABASE_URL, max: Number(process.env.AUTOSHIP_DB_POOL_SIZE || 5), ssl: process.env.AUTOSHIP_DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } }))
  }
  return poolPromise
}

async function ensureTable(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS autoship_state (id integer PRIMARY KEY CHECK (id = 1), payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`)
}

async function loadDatabaseState() {
  const pool = await getPool()
  const client = await pool.connect()
  try {
    await ensureTable(client)
    const result = await client.query('SELECT payload FROM autoship_state WHERE id = 1')
    return result.rows[0]?.payload || null
  } finally { client.release() }
}

async function saveDatabaseState(state) {
  const pool = await getPool()
  const client = await pool.connect()
  try {
    await ensureTable(client)
    await client.query('INSERT INTO autoship_state (id, payload, updated_at) VALUES (1, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()', [JSON.stringify(state)])
  } finally { client.release() }
}
