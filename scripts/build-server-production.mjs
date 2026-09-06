import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const original = fs.readFileSync(path.join(root, 'scripts/build-server.mjs'), 'utf8')
const runnerPath = path.join(root, 'src/runner/pipeline-runner.mjs')
const queuePath = path.join(root, 'src/control-plane/runner-queue.mjs')
const statePath = path.join(root, 'src/state/state-store.mjs')

let source = original
source = source.replace(
  `import { runRealPipeline } from ${JSON.stringify(runnerPath)};\n`,
  `import { RunnerQueue } from ${JSON.stringify(queuePath)};\n`,
)

const persistenceNeedle = `async function persistAutoshipState() { if (!persistenceEnabled()) return; try { await saveState({ projects, buildRuns, webhookLogs }); } catch (error) { console.error('[Autoship] state save failed:', error.message); } }`
if (!source.includes(persistenceNeedle)) throw new Error('production build wrapper: persistence marker missing')
source = source.replace(
  persistenceNeedle,
  `${persistenceNeedle}\nlet autoshipQueue;\nfunction startAutoshipQueue() {\n  autoshipQueue = new RunnerQueue({ runs: buildRuns, projects, persist: persistAutoshipState, runnerUrl: process.env.AUTOSHIP_RUNNER_URL, runnerToken: process.env.AUTOSHIP_RUNNER_TOKEN, maxRetries: Number(process.env.AUTOSHIP_QUEUE_MAX_RETRIES || 3), backoffMs: Number(process.env.AUTOSHIP_QUEUE_BACKOFF_MS || 1500) });\n  void autoshipQueue.restoreQueued();\n}\nstartAutoshipQueue();`,
)

const functionMarker = 'async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {'
const start = source.indexOf(functionMarker)
if (start < 0) throw new Error('production build wrapper: executePipelineAsync missing')
const endMarker = '\n}\n\n// 3. Real GitHub Webhook Listener Endpoint'
const end = source.indexOf(endMarker, start)
if (end < 0) throw new Error('production build wrapper: executePipelineAsync end marker missing')
const replacement = `async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {\n  const run = buildRuns.find((r) => r.id === runId); if (!run) return;\n  if (shouldFail) {\n    const stage = run.stages.find((s) => s.type === 'build');\n    if (stage) { stage.status = 'failed'; stage.logs.push('Forced failure requested by test trigger.'); }\n    run.status = 'failed'; run.errorMessage = 'Forced pipeline failure.'; run.completedAt = new Date().toISOString(); project.lastDeployStatus = 'failed';\n    await persistAutoshipState(); return;\n  }\n  await autoshipQueue.enqueue(runId, project.id);\n}`
source = source.slice(0, start) + replacement + source.slice(end + 2)

const readinessMarker = "app.get('/api/health', (_req: Request, res: Response) => res.json({ status: 'ok', service: 'autoship', runnerEnabled: process.env.AUTOSHIP_ENABLE_REAL_RUNNER === 'true', persistence: persistenceEnabled() }));"
if (!source.includes(readinessMarker)) throw new Error('production build wrapper: health marker missing')
source = source.replace(
  readinessMarker,
  `${readinessMarker}\napp.get('/api/ready', (_req: Request, res: Response) => { const ready = Boolean(process.env.AUTOSHIP_RUNNER_URL && process.env.AUTOSHIP_API_TOKEN && persistenceEnabled()); res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', controlPlane: true, runnerConfigured: Boolean(process.env.AUTOSHIP_RUNNER_URL), authConfigured: Boolean(process.env.AUTOSHIP_API_TOKEN), persistence: persistenceEnabled() }); });`,
)

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoship-production-build-'))
const tempScript = path.join(tempDir, 'build-server.mjs')
fs.writeFileSync(tempScript, source)
try {
  await import(pathToFileURL(tempScript).href)
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
