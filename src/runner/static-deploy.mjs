import fs from 'node:fs/promises'
import path from 'node:path'

export async function deployStaticArtifact(workspace, deployPath, log = () => {}) {
  if (!deployPath || !deployPath.startsWith('/')) {
    throw new Error('static-server deployPath must be an absolute path')
  }

  const source = path.join(workspace, 'dist')
  const stat = await fs.stat(source).catch(() => null)
  if (!stat?.isDirectory()) throw new Error('Build completed but dist/ directory was not found')

  const release = path.join(deployPath, `.release-${Date.now()}`)
  await fs.mkdir(release, { recursive: true })
  await fs.cp(source, release, { recursive: true })

  const current = path.join(deployPath, 'current')
  const previous = path.join(deployPath, 'previous')
  const currentExists = await fs.lstat(current).then(() => true).catch(() => false)
  if (currentExists) {
    await fs.rm(previous, { recursive: true, force: true })
    await fs.rename(current, previous).catch(async () => {
      await fs.rm(current, { recursive: true, force: true })
    })
  }

  await fs.rename(release, current)
  log(`Static artifact deployed to ${current}`)
  return current
}
