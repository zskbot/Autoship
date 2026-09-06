import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'server.ts'), 'utf8')
const marker = 'app.use(express.json());'
if (!source.includes(marker)) throw new Error(`Autoship server marker not found: ${marker}`)

const middleware = `
const autoshipAllowedOrigins = (process.env.AUTOSHIP_CORS_ORIGINS || process.env.APP_URL || '*').split(',').map(value => value.trim()).filter(Boolean)
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin
  if (autoshipAllowedOrigins.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*')
  else if (requestOrigin && autoshipAllowedOrigins.includes(requestOrigin)) { res.setHeader('Access-Control-Allow-Origin', requestOrigin); res.setHeader('Vary', 'Origin') }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-GitHub-Event, X-Hub-Signature-256')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
const autoshipStateReady = loadState().then(state => {
  if (state?.projects) projects = state.projects
  if (state?.buildRuns) buildRuns = state.buildRuns
  if (state?.webhookLogs) webhookLogs = state.webhookLogs
}).catch(error => { console.error('[Autoship] state load failed:', error.message); throw error })
app.use('/api', async (_req, _res, next) => { try { await autoshipStateReady; next() } catch { next(new Error('Autoship state unavailable')) } })
app.use('/api', (req, res, next) => {
  const configuredToken = process.env.AUTOSHIP_API_TOKEN?.trim()
  if (!configuredToken || req.method === 'GET' || req.path.startsWith('/webhooks/github/')) return next()
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (token !== configuredToken) return res.status(401).json({ error: 'Autoship API authentication required' })
  next()
})
`

const importMarker = "import dotenv from 'dotenv';"
if (!source.includes(importMarker)) throw new Error('dotenv import marker not found')
const runnerPath = path.join(root, 'src/runner/pipeline-runner.mjs')
const statePath = path.join(root, 'src/state/state-store.mjs')
let transformed = source.replace(importMarker, `${importMarker}\nimport { runRealPipeline } from ${JSON.stringify(runnerPath)};\nimport { loadState, saveState, persistenceEnabled } from ${JSON.stringify(statePath)};`)
transformed = transformed.replace("const __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);", "const __dirname = process.cwd();")
transformed = transformed.replace(marker, "app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = Buffer.from(buf); } }));" + middleware)

const healthMarker = "// 1. Projects API"
if (!transformed.includes(healthMarker)) throw new Error('projects API marker not found')
transformed = transformed.replace(healthMarker, `app.get('/api/health', (_req: Request, res: Response) => res.json({ status: 'ok', service: 'autoship', runnerEnabled: process.env.AUTOSHIP_ENABLE_REAL_RUNNER === 'true', persistence: persistenceEnabled() }));\n\n${healthMarker}`)

const upsertMarker = "// 2. Pipelines & Build Runs API"
if (!transformed.includes(upsertMarker)) throw new Error('pipeline API marker not found')
const upsertRoute = `app.post('/api/projects/upsert', (req: Request, res: Response) => {\n  const body = req.body || {};\n  if (!body.repoUrl) return res.status(400).json({ error: 'repoUrl is required' });\n  const repoUrl = String(body.repoUrl).replace(/\\/$/, '');\n  const existing = projects.find((p) => p.repoUrl.replace(/\\/$/, '') === repoUrl);\n  if (existing) return res.json({ project: existing, created: false });\n  const project: DeploymentProject = {\n    id: 'proj-' + crypto.createHash('sha256').update(repoUrl).digest('hex').slice(0, 16), name: body.name || repoUrl.split('/').pop()?.replace(/\\.git$/, '') || 'project', repoUrl, branch: body.branch || 'main', target: body.target || 'static-server', serverIp: body.serverIp || '', serverPort: Number(body.serverPort) || 22, serverUser: body.serverUser || 'root', deployPath: body.deployPath || '', dockerfilePath: body.dockerfilePath || '', webhookUrl: body.webhookUrl || '', healthcheckUrl: body.healthcheckUrl || '', webhookSecret: body.webhookSecret || 'whsec_' + crypto.randomBytes(16).toString('hex'), autoDeployOnPush: body.autoDeployOnPush !== false, notifyOnSuccess: body.notifyOnSuccess !== false, notifyOnFailure: body.notifyOnFailure !== false, framework: body.framework || 'react-vite', buildCommand: body.buildCommand || 'npm ci && npm run build', startCommand: body.startCommand || '', envVariables: body.envVariables || [], createdAt: new Date().toISOString(), totalBuilds: 0\n  };\n  projects.unshift(project); res.status(201).json({ project, created: true });\n});\n\n`
transformed = transformed.replace(upsertMarker, upsertRoute + upsertMarker)

const webhookMarker = '  const payload = req.body || {};'
if (!transformed.includes(webhookMarker)) throw new Error('webhook payload marker not found')
const webhookVerification = `${webhookMarker}\n\n  if (githubEvent !== 'ping') {\n    const secret = project.webhookSecret || ''; const signature = githubSignature || '';\n    if (!secret || !signature.startsWith('sha256=')) return res.status(401).json({ error: 'Invalid GitHub webhook signature' });\n    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update((req as any).rawBody || Buffer.from(JSON.stringify(payload))).digest('hex');\n    const a = Buffer.from(signature); const b = Buffer.from(expected);\n    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid GitHub webhook signature' });\n  }`
transformed = transformed.replace(webhookMarker, webhookVerification)
transformed = transformed.replace("payload.head_commit?.id?.slice(0, 7)", "payload.head_commit?.id")
transformed = transformed.replace("const { projectId, commitMessage, branch, author, triggeredBy = 'manual', shouldFail = false } = req.body;", "const { projectId, commitHash: requestedCommitHash, commitMessage, branch, author, triggeredBy = 'manual', shouldFail = false } = req.body;")
transformed = transformed.replace("const commitHash = crypto.randomBytes(3).toString('hex');", "const commitHash = /^[0-9a-f]{40}$/i.test(String(requestedCommitHash || '')) ? String(requestedCommitHash) : crypto.randomBytes(3).toString('hex');")

const functionMarker = 'async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {'
const start = transformed.indexOf(functionMarker)
if (start < 0) throw new Error('executePipelineAsync function not found')
const endMarker = '\n}\n\n// 3. Real GitHub Webhook Listener Endpoint'
const end = transformed.indexOf(endMarker, start)
if (end < 0) throw new Error('executePipelineAsync end marker not found')
const replacement = `async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {\n  const run = buildRuns.find((r) => r.id === runId); if (!run) return;\n  const updateStage = (type: string, message: string, success = false, status?: string, durationMs?: number) => { const stage = run.stages.find((candidate) => candidate.type === type); if (!stage) return; stage.status = (status || (success ? 'success' : 'running')) as any; stage.logs.push(message); if (durationMs !== undefined) stage.durationMs = durationMs; };\n  run.status = 'running';\n  if (shouldFail) { const stage = run.stages.find((s) => s.type === 'build'); if (stage) { stage.status = 'failed'; stage.logs.push('Forced failure requested by test trigger.'); } run.status = 'failed'; run.errorMessage = 'Forced pipeline failure.'; run.completedAt = new Date().toISOString(); project.lastDeployStatus = 'failed'; await persistAutoshipState(); return; }\n  if (process.env.AUTOSHIP_ENABLE_REAL_RUNNER !== 'true') { run.status = 'failed'; run.errorMessage = 'Real runner is disabled. Set AUTOSHIP_ENABLE_REAL_RUNNER=true on the isolated runner.'; const stage = run.stages.find((s) => s.type === 'clone'); if (stage) { stage.status = 'failed'; stage.logs.push(run.errorMessage); } run.completedAt = new Date().toISOString(); project.lastDeployStatus = 'failed'; await persistAutoshipState(); return; }\n  let result; try { result = await runRealPipeline(project, run, updateStage); } catch (error) { result = { success: false, error: error instanceof Error ? error.message : String(error) }; }\n  if (!result.success) { run.status = 'failed'; run.errorMessage = result.error || 'Pipeline failed.'; run.completedAt = new Date().toISOString(); run.durationSeconds = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)); project.lastDeployStatus = 'failed'; project.lastDeployedAt = run.completedAt; await persistAutoshipState(); return; }\n  if (result.deployedUrl) run.deployedUrl = result.deployedUrl; for (const stage of run.stages) if (stage.status === 'pending' && ['docker', 'notify'].includes(stage.type)) stage.status = 'skipped';\n  run.status = 'success'; run.completedAt = new Date().toISOString(); run.durationSeconds = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)); project.lastDeployStatus = 'success'; project.lastDeployedAt = run.completedAt; await persistAutoshipState();\n}`
transformed = transformed.slice(0, start) + replacement + transformed.slice(end + 2)

const persistenceCode = `\nasync function persistAutoshipState() { if (!persistenceEnabled()) return; try { await saveState({ projects, buildRuns, webhookLogs }); } catch (error) { console.error('[Autoship] state save failed:', error.message); } }\nif (persistenceEnabled()) { setInterval(() => { persistAutoshipState(); }, Number(process.env.AUTOSHIP_STATE_FLUSH_MS || 5000)).unref(); process.once('SIGTERM', () => { persistAutoshipState().finally(() => process.exit(0)); }); process.once('SIGINT', () => { persistAutoshipState().finally(() => process.exit(0)); }); }\n`
transformed = transformed.replace("// 3. Real GitHub Webhook Listener Endpoint", persistenceCode + "// 3. Real GitHub Webhook Listener Endpoint")

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoship-build-'))
const tempServer = path.join(tempDir, 'server.ts')
fs.writeFileSync(tempServer, transformed)
try { await build({ entryPoints: [tempServer], bundle: true, platform: 'node', format: 'cjs', packages: 'external', sourcemap: true, outfile: path.join(root, 'dist/server.cjs') }) }
finally { fs.rmSync(tempDir, { recursive: true, force: true }) }
