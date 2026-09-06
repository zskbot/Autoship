import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'server.ts'), 'utf8')
const marker = 'app.use(express.json());'

if (!source.includes(marker)) {
  throw new Error(`Autoship server marker not found: ${marker}`)
}

const middleware = `
const autoshipAllowedOrigins = (process.env.AUTOSHIP_CORS_ORIGINS || process.env.APP_URL || '*')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin
  if (autoshipAllowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*')
  } else if (requestOrigin && autoshipAllowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use('/api', (req, res, next) => {
  const configuredToken = process.env.AUTOSHIP_API_TOKEN?.trim()
  if (!configuredToken || req.method === 'GET' || req.path.startsWith('/webhooks/github/')) return next()
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (token !== configuredToken) return res.status(401).json({ error: 'Autoship API authentication required' })
  next()
})
`

const transformed = source.replace(marker, `${marker}${middleware}`)
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoship-build-'))
const tempServer = path.join(tempDir, 'server.ts')
fs.writeFileSync(tempServer, transformed)

try {
  await build({
    entryPoints: [tempServer],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    outfile: path.join(root, 'dist/server.cjs'),
  })
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
