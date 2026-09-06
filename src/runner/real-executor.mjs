import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

export async function runCommand(command, cwd, onLog = () => {}) {
  const timeoutMs = Number(process.env.AUTOSHIP_COMMAND_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  await new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-lc', command], { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let finished = false
    const timer = setTimeout(() => {
      if (finished) return
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 5000).unref()
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`))
    }, timeoutMs)
    const finish = (fn, value) => { if (!finished) { finished = true; clearTimeout(timer); fn(value) } }
    child.stdout.on('data', data => onLog(String(data).trimEnd()))
    child.stderr.on('data', data => onLog(String(data).trimEnd()))
    child.on('error', error => finish(reject, error))
    child.on('close', code => code === 0 ? finish(resolve) : finish(reject, new Error(`Command failed with exit code ${code}: ${command}`)))
  })
}

export async function cloneRepository(repoUrl, branch, onLog) {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(repoUrl)) {
    throw new Error('Only public HTTPS GitHub repositories are accepted by the built-in runner')
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autoship-run-'))
  try {
    await runCommand(`git clone --depth=1 --branch ${shellQuote(branch)} ${shellQuote(repoUrl)} ${shellQuote(dir)}`, process.cwd(), onLog)
    return dir
  } catch (error) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

function shellQuote(value) { return `'${String(value).replaceAll("'", "'\\''")}'` }
