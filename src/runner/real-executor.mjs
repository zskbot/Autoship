import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_MAX_OUTPUT = 2 * 1024 * 1024

export async function runCommand(command, cwd, onLog = () => {}, options = {}) {
  const timeoutMs = Number(options.timeoutMs || process.env.AUTOSHIP_COMMAND_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const maxOutput = Number(options.maxOutputBytes || process.env.AUTOSHIP_MAX_LOG_BYTES || DEFAULT_MAX_OUTPUT)
  const env = options.env || buildSafeEnv(options.projectEnv)
  const secrets = (options.secretValues || []).filter(value => typeof value === 'string' && value.length >= 3)
  await new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-lc', command], { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let finished = false
    let outputBytes = 0
    let truncated = false
    const finish = (fn, value) => { if (!finished) { finished = true; clearTimeout(timer); fn(value) } }
    const timer = setTimeout(() => {
      if (finished) return
      try { process.kill(-child.pid, 'SIGTERM') } catch {}
      setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL') } catch {} }, 5000).unref()
      finish(reject, new Error(`Command timed out after ${timeoutMs}ms: ${safeCommand(command)}`))
    }, timeoutMs)
    const consume = data => {
      if (truncated) return
      const text = String(data)
      const remaining = maxOutput - outputBytes
      if (remaining <= 0) { truncated = true; onLog('[Autoship] command output truncated'); return }
      const chunk = Buffer.byteLength(text) > remaining ? text.slice(0, remaining) : text
      outputBytes += Buffer.byteLength(chunk)
      onLog(redactSecrets(chunk, secrets).trimEnd())
      if (outputBytes >= maxOutput) { truncated = true; onLog('[Autoship] command output truncated') }
    }
    child.stdout.on('data', consume)
    child.stderr.on('data', consume)
    child.on('error', error => finish(reject, error))
    child.on('close', code => code === 0 ? finish(resolve) : finish(reject, new Error(`Command failed with exit code ${code}: ${safeCommand(command)}`)))
  })
}

export function buildSafeEnv(projectEnv = []) {
  const allowed = new Set(['PATH', 'HOME', 'LANG', 'LC_ALL', 'NODE_ENV', 'CI', 'npm_config_cache', 'TMPDIR'])
  const env = {}
  for (const [key, value] of Object.entries(process.env)) if (allowed.has(key) && value !== undefined) env[key] = value
  for (const item of projectEnv || []) if (item?.key && item.value !== undefined && item.value !== null) env[item.key] = String(item.value)
  return env
}

function redactSecrets(text, secrets) {
  let output = text.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
  for (const secret of secrets) output = output.split(secret).join('[REDACTED]')
  return output
}
function safeCommand(command) { return String(command).replace(/(--(?:password|token|secret|key))(?:=|\s+)\S+/gi, '$1=[REDACTED]') }

export async function cloneRepository(repoUrl, branch, onLog, commitHash) {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(repoUrl)) throw new Error('Only HTTPS GitHub repositories are accepted by the built-in runner')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autoship-run-'))
  try {
    const token = process.env.AUTOSHIP_GITHUB_TOKEN?.trim()
    const authEnv = token ? { ...buildSafeEnv(), AUTOSHIP_GITHUB_TOKEN: token } : buildSafeEnv()
    const authArgs = token ? '-c http.extraHeader="AUTHORIZATION: bearer $AUTOSHIP_GITHUB_TOKEN"' : ''
    await runCommand(`git ${authArgs} clone --no-tags --depth=1 --branch ${shellQuote(branch)} ${shellQuote(repoUrl)} ${shellQuote(dir)}`, process.cwd(), onLog, { env: authEnv, secretValues: token ? [token] : [] })
    if (commitHash && /^[0-9a-f]{40}$/i.test(commitHash)) await runCommand(`git ${authArgs} fetch --no-tags --depth=1 origin ${shellQuote(commitHash)} && git checkout --detach ${shellQuote(commitHash)}`, dir, onLog, { env: authEnv, secretValues: token ? [token] : [] })
    return dir
  } catch (error) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export async function installDependencies(workspace, onLog, projectEnv = []) {
  const lock = await fs.stat(path.join(workspace, 'package-lock.json')).catch(() => null)
  const secretValues = (projectEnv || []).filter(item => item?.isSecret).map(item => item.value)
  await runCommand(lock?.isFile() ? 'npm ci' : 'npm install', workspace, onLog, { projectEnv, secretValues })
}

export function shellQuote(value) { return `'${String(value).replaceAll("'", "'\\''")}'` }
