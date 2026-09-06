import fs from 'node:fs/promises'
import path from 'node:path'

const FORBIDDEN_ROOTS = new Set(['/', '/tmp', '/var', '/home', '/root', '/usr', '/etc', '/opt'])

export async function deployStaticArtifact(workspace, deployPath, log = () => {}) {
  validateDeployRoot(deployPath)
  const source = path.join(workspace, 'dist')
  const stat = await fs.stat(source).catch(() => null)
  if (!stat?.isDirectory()) throw new Error('Build completed but dist/ directory was not found')
  const releases = path.join(deployPath, '.releases')
  await fs.mkdir(releases, { recursive: true, mode: 0o755 })
  const release = path.join(releases, `${Date.now()}-${process.pid}`)
  await fs.mkdir(release, { recursive: true, mode: 0o755 })
  try {
    await fs.cp(source, release, { recursive: true })
    const current = path.join(deployPath, 'current')
    const previous = path.join(deployPath, 'previous')
    const next = path.join(deployPath, `.current-${process.pid}-${Date.now()}`)
    const currentTarget = await fs.readlink(current).catch(() => null)
    if (currentTarget) {
      await fs.rm(previous, { force: true }).catch(() => undefined)
      await fs.symlink(currentTarget, previous, 'dir')
    }
    await fs.symlink(release, next, 'dir')
    await fs.rename(next, current).catch(async () => { await fs.rm(current, { force: true }).catch(() => undefined); await fs.rename(next, current) })
    log(`Static artifact deployed atomically to ${current}`)
    return current
  } catch (error) {
    await fs.rm(release, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export async function rollbackStatic(deployPath, log = () => {}) {
  validateDeployRoot(deployPath)
  const current = path.join(deployPath, 'current')
  const previous = path.join(deployPath, 'previous')
  const target = await fs.readlink(previous).catch(() => null)
  if (!target) throw new Error('No previous static release is available')
  const next = path.join(deployPath, `.rollback-${process.pid}-${Date.now()}`)
  await fs.symlink(target, next, 'dir')
  await fs.rename(next, current).catch(async () => { await fs.rm(current, { force: true }).catch(() => undefined); await fs.rename(next, current) })
  log(`Static deployment rolled back to ${target}`)
  return current
}

function validateDeployRoot(deployPath) {
  if (!deployPath || !path.isAbsolute(deployPath)) throw new Error('static-server deployPath must be an absolute path')
  const resolved = path.resolve(deployPath)
  if (FORBIDDEN_ROOTS.has(resolved) || resolved.length < 8) throw new Error(`Unsafe static deploy root: ${resolved}`)
}
