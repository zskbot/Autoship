import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
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

const importMarker = "import dotenv from 'dotenv';"
if (!source.includes(importMarker)) throw new Error('dotenv import marker not found')
const runnerUrl = pathToFileURL(path.join(root, 'src/runner/pipeline-runner.mjs')).href
let transformed = source.replace(importMarker, `${importMarker}\nimport { runRealPipeline } from ${JSON.stringify(runnerUrl)};`)
transformed = transformed.replace(marker, `${marker}${middleware}`)

const upsertMarker = "// 2. Pipelines & Build Runs API"
if (!transformed.includes(upsertMarker)) throw new Error('pipeline API marker not found')
const upsertRoute = `// Bootstrap or find a project by repository URL. Safe for CI because the project ID is generated server-side.\napp.post('/api/projects/upsert', (req: Request, res: Response) => {\n  const body = req.body || {};\n  if (!body.repoUrl) return res.status(400).json({ error: 'repoUrl is required' });\n  const repoUrl = String(body.repoUrl).replace(/\\/$/, '');\n  const existing = projects.find((p) => p.repoUrl.replace(/\\/$/, '') === repoUrl);\n  if (existing) return res.json({ project: existing, created: false });\n  const project: DeploymentProject = {\n    id: 'proj-' + crypto.createHash('sha256').update(repoUrl).digest('hex').slice(0, 16),\n    name: body.name || repoUrl.split('/').pop()?.replace(/\\.git$/, '') || 'project', repoUrl, branch: body.branch || 'main',\n    target: body.target || 'static-server', serverIp: body.serverIp || '', serverPort: Number(body.serverPort) || 22, serverUser: body.serverUser || 'root', deployPath: body.deployPath || '', healthcheckUrl: body.healthcheckUrl || '',\n    webhookSecret: body.webhookSecret || 'whsec_' + crypto.randomBytes(16).toString('hex'), autoDeployOnPush: body.autoDeployOnPush !== false, notifyOnSuccess: body.notifyOnSuccess !== false, notifyOnFailure: body.notifyOnFailure !== false, framework: body.framework || 'react-vite', buildCommand: body.buildCommand || 'npm ci && npm run build', startCommand: body.startCommand || '', envVariables: body.envVariables || [], createdAt: new Date().toISOString(), totalBuilds: 0\n  };\n  projects.unshift(project); res.status(201).json({ project, created: true });\n});\n\n`
transformed = transformed.replace(upsertMarker, upsertRoute + upsertMarker)

const functionMarker = 'async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {'
const start = transformed.indexOf(functionMarker)
if (start < 0) throw new Error('executePipelineAsync function not found')
const endMarker = '\n}\n\n// 3. Real GitHub Webhook Listener Endpoint'
const end = transformed.indexOf(endMarker, start)
if (end < 0) throw new Error('executePipelineAsync end marker not found')

const replacement = `async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {\n  const run = buildRuns.find((r) => r.id === runId);\n  if (!run) return;\n  const updateStage = (type: string, message: string, success = false) => {\n    const index = type === 'current' ? run.stages.findIndex((stage) => stage.status === 'running') : run.stages.findIndex((stage) => stage.type === type);\n    if (index < 0) return; const stage = run.stages[index]; if (stage.status !== 'running') stage.status = 'running'; stage.logs.push(message); if (success) stage.status = 'success';\n  };\n  run.status = 'running';\n  if (shouldFail) { const buildStage = run.stages.find((stage) => stage.type === 'build'); if (buildStage) { buildStage.status = 'failed'; buildStage.logs.push('Forced failure requested by test trigger.'); } run.status = 'failed'; run.errorMessage = 'Forced pipeline failure.'; run.completedAt = new Date().toISOString(); project.lastDeployStatus = 'failed'; return; }\n  if (process.env.AUTOSHIP_ENABLE_REAL_RUNNER !== 'true') { run.status = 'failed'; run.errorMessage = 'Real runner is disabled. Set AUTOSHIP_ENABLE_REAL_RUNNER=true on the isolated runner.'; const stage = run.stages.find((s) => s.type === 'clone'); if (stage) { stage.status = 'failed'; stage.logs.push(run.errorMessage); } run.completedAt = new Date().toISOString(); project.lastDeployStatus = 'failed'; return; }\n  let result; try { result = await runRealPipeline(project, run, updateStage); } catch (error) { result = { success: false, error: error instanceof Error ? error.message : String(error) }; }\n  if (!result.success) { run.status = 'failed'; run.errorMessage = result.error || 'Pipeline failed.'; run.completedAt = new Date().toISOString(); run.durationSeconds = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)); project.lastDeployStatus = 'failed'; project.lastDeployedAt = run.completedAt; return; }\n  if (result.deployedUrl) run.deployedUrl = result.deployedUrl; for (const stage of run.stages) if (stage.status === 'pending' && ['docker', 'notify'].includes(stage.type)) stage.status = 'skipped';\n  run.status = 'success'; run.completedAt = new Date().toISOString(); run.durationSeconds = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)); project.lastDeployStatus = 'success'; project.lastDeployedAt = run.completedAt;\n}`
transformed = transformed.slice(0, start) + replacement + transformed.slice(end + 2)

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoship-build-'))
const tempServer = path.join(tempDir, 'server.ts')
fs.writeFileSync(tempServer, transformed)
try { await build({ entryPoints: [tempServer], bundle: true, platform: 'node', format: 'cjs', packages: 'external', sourcemap: true, outfile: path.join(root, 'dist/server.cjs') }) }
finally { fs.rmSync(tempDir, { recursive: true, force: true }) }
