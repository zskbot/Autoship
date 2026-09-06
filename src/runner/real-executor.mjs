import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export async function runCommand(command, cwd, onLog) {
  await new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-lc', command], { cwd, env: process.env })
    child.stdout.on('data', data => onLog(String(data).trimEnd()))
    child.stderr.on('data', data => onLog(String(data).trimEnd()))
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}: ${command}`)))
  })
}

export async function cloneRepository(repoUrl, branch, onLog) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autoship-run-'))
  await runCommand(`git clone --depth=1 --branch ${shellQuote(branch)} ${shellQuote(repoUrl)} ${shellQuote(dir)}`, process.cwd(), onLog)
  return dir
}

export async function executeRealPipeline(project, run, stageLogger) {
  const workspace = await cloneRepository(project.repoUrl, run.branch, line => stageLogger('clone', line))
  try {
    await runCommand('npm ci', workspace, line => stageLogger('deps', line))
    await runCommand('npm test --if-present', workspace, line => stageLogger('test', line))
    await runCommand(project.buildCommand || 'npm run build', workspace, line => stageLogger('build', line))
    return workspace
  } finally {
    await fs.rm(workspace, { recursive: true, force: true })
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}
