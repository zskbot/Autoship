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

const functionMarker = 'async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {'
const start = transformed.indexOf(functionMarker)
if (start < 0) throw new Error('executePipelineAsync function not found')
const endMarker = '\n}\n\n// 3. Real GitHub Webhook Listener Endpoint'
const end = transformed.indexOf(endMarker, start)
if (end < 0) throw new Error('executePipelineAsync end marker not found')

const replacement = `async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {
  const run = buildRuns.find((r) => r.id === runId);
  if (!run) return;
  const updateStage = (type: string, message: string, success = false) => {
    const index = type === 'current' ? run.stages.findIndex((stage) => stage.status === 'running') : run.stages.findIndex((stage) => stage.type === type);
    if (index < 0) return;
    const stage = run.stages[index];
    if (stage.status !== 'running') stage.status = 'running';
    stage.logs.push(message);
    if (success) stage.status = 'success';
  };
  run.status = 'running';
  if (shouldFail) {
    const buildStage = run.stages.find((stage) => stage.type === 'build');
    if (buildStage) { buildStage.status = 'failed'; buildStage.logs.push('Forced failure requested by test trigger.'); }
    run.status = 'failed'; run.errorMessage = 'Forced pipeline failure.'; run.completedAt = new Date().toISOString(); project.lastDeployStatus = 'failed'; return;
  }
  let result;
  try { result = await runRealPipeline(project, run, updateStage); }
  catch (error) { result = { success: false, error: error instanceof Error ? error.message : String(error) }; }
  if (!result.success) {
    run.status = 'failed'; run.errorMessage = result.error || 'Pipeline failed.'; run.completedAt = new Date().toISOString();
    run.durationSeconds = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)); project.lastDeployStatus = 'failed'; project.lastDeployedAt = run.completedAt; return;
  }
  if (result.deployedUrl) run.deployedUrl = result.deployedUrl;
  for (const stage of run.stages) if (stage.status === 'pending' && ['docker', 'notify'].includes(stage.type)) stage.status = 'skipped';
  run.status = 'success'; run.completedAt = new Date().toISOString(); run.durationSeconds = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000));
  project.lastDeployStatus = 'success'; project.lastDeployedAt = run.completedAt;
}`

transformed = transformed.slice(0, start) + replacement + transformed.slice(end + 2)
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoship-build-'))
const tempServer = path.join(tempDir, 'server.ts')
fs.writeFileSync(tempServer, transformed)
try {
  await build({ entryPoints: [tempServer], bundle: true, platform: 'node', format: 'cjs', packages: 'external', sourcemap: true, outfile: path.join(root, 'dist/server.cjs') })
} finally { fs.rmSync(tempDir, { recursive: true, force: true }) }
