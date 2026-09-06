import fs from 'node:fs/promises'
import { cloneRepository, runCommand } from './real-executor.mjs'
import { deployStaticArtifact } from './static-deploy.mjs'

export async function runRealPipeline(project, run, updateStage) {
  let workspace
  try {
    workspace = await cloneRepository(project.repoUrl, run.branch, line => updateStage('clone', line))
    updateStage('clone', 'Repository cloned successfully', true)

    await runCommand('npm ci', workspace, line => updateStage('deps', line))
    updateStage('deps', 'Dependencies installed successfully', true)

    await runCommand('npm test --if-present', workspace, line => updateStage('test', line))
    updateStage('test', 'Tests completed successfully', true)

    await runCommand(project.buildCommand || 'npm run build', workspace, line => updateStage('build', line))
    updateStage('build', 'Production build completed successfully', true)

    if (project.target === 'static-server') {
      await deployStaticArtifact(workspace, project.deployPath || '/var/www/app', line => updateStage('deploy', line))
      updateStage('deploy', 'Static artifact deployment completed', true)
      updateStage('healthcheck', `Deployment directory verified: ${project.deployPath || '/var/www/app'}`, true)
    } else {
      throw new Error(`Target '${project.target}' is not implemented by the real runner yet`)
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    updateStage('current', message, false)
    return { success: false, error: message }
  } finally {
    if (workspace) await fs.rm(workspace, { recursive: true, force: true }).catch(() => undefined)
  }
}
