import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
const child = spawn(process.execPath, ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production', AUTOSHIP_API_TOKEN: 'ci-test-token', AUTOSHIP_ENABLE_REAL_RUNNER: 'false', AUTOSHIP_CORS_ORIGINS: 'http://localhost:4173' }, stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
child.stdout.on('data', chunk => { output += String(chunk) })
child.stderr.on('data', chunk => { output += String(chunk) })
try {
  let ready = false
  for (let i = 0; i < 30 && !ready; i++) { await new Promise(resolve => setTimeout(resolve, 300)); try { ready = (await fetch('http://127.0.0.1:3000/api/health')).ok } catch {} }
  assert.equal(ready, true, `server did not start: ${output}`)
  assert.equal((await (await fetch('http://127.0.0.1:3000/api/health')).json()).status, 'ok')
  assert.equal((await fetch('http://127.0.0.1:3000/api/projects')).status, 200)
  assert.equal((await fetch('http://127.0.0.1:3000/api/projects/upsert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repoUrl: 'https://github.com/zskbot/AgentsIDE' }) })).status, 401)
  const response = await fetch('http://127.0.0.1:3000/api/projects/upsert', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ci-test-token' }, body: JSON.stringify({ name: 'AgentsIDE', repoUrl: 'https://github.com/zskbot/AgentsIDE' }) })
  assert.ok([200, 201].includes(response.status), await response.text())
  console.log('Autoship API smoke tests passed')
} finally { child.kill('SIGTERM'); await new Promise(resolve => setTimeout(resolve, 300)); if (!child.killed) child.kill('SIGKILL') }
