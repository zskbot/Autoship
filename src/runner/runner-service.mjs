import http from 'node:http'
import { runRealPipeline } from './pipeline-runner.mjs'

const port = Number(process.env.PORT || 3100)
const token = process.env.AUTOSHIP_RUNNER_TOKEN?.trim() || ''

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { status: 'ok', service: 'autoship-runner' })
  if (req.method !== 'POST' || req.url !== '/run') return json(res, 404, { error: 'Not found' })
  if (token) {
    const authorization = req.headers.authorization || ''
    const presented = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (presented !== token) return json(res, 401, { error: 'Runner authentication required' })
  }
  try {
    const body = JSON.parse(await readBody(req))
    if (!body?.project?.id || !body?.run?.id) return json(res, 400, { error: 'project and run are required' })
    const result = await runRealPipeline(body.project, body.run, (type, message, success, status, durationMs) => {
      const stage = body.run.stages?.find(candidate => candidate.type === type)
      if (!stage) return
      stage.status = status || (success ? 'success' : 'running')
      if (message) stage.logs.push(String(message))
      if (durationMs !== undefined) stage.durationMs = durationMs
    })
    return json(res, 200, { ...result, stages: body.run.stages })
  } catch (error) {
    return json(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, '0.0.0.0', () => console.log(`[Autoship Runner] listening on ${port}`))

function json(res, status, value) {
  const payload = JSON.stringify(value)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
  res.end(payload)
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    const limit = Number(process.env.AUTOSHIP_MAX_REQUEST_BYTES || 1024 * 1024)
    req.on('data', chunk => { bytes += chunk.length; if (bytes > limit) { reject(new Error('Request body too large')); req.destroy() } else chunks.push(chunk) })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
