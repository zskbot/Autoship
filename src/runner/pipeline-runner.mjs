import fs from 'node:fs/promises'
import { cloneRepository, runCommand } from './real-executor.mjs'
import { deployTarget } from './target-adapters.mjs'

export async function runRealPipeline(project, run, updateStage) {
  let workspace
  let currentStage = 'clone'
  const startStage = (type, message) => { currentStage = type; updateStage(type, message, false) }
  const finishStage = (type, message) => updateStage(type, message, true)

  try {
    startStage('clone', `Cloning ${project.repoUrl} (${run.branch})`)
    workspace = await cloneRepository(project.repoUrl, run.branch, line => updateStage('clone', line, false))
    finishStage('clone', 'Repository cloned successfully')

    startStage('deps', 'Installing dependencies')
    await runCommand('npm ci', workspace, line => updateStage('deps', line, false))
    finishStage('deps', 'Dependencies installed successfully')

    startStage('test', 'Running tests')
    await runCommand('npm test --if-present', workspace, line => updateStage('test', line, false))
    finishStage('test', 'Tests completed successfully')

    startStage('build', project.buildCommand || 'npm run build')
    await runCommand(project.buildCommand || 'npm run build', workspace, line => updateStage('build', line, false))
    finishStage('build', 'Production build completed successfully')

    startStage('deploy', `Deploying to ${project.target}`)
    const deployment = await deployTarget(project, workspace, run, line => updateStage('deploy', line, false))
    finishStage('deploy', 'Deployment completed successfully')

    if (deployment?.deployedUrl) run.deployedUrl = deployment.deployedUrl

    if (project.healthcheckUrl) {
      currentStage = 'healthcheck'
      startStage('healthcheck', `HTTP healthcheck: ${project.healthcheckUrl}`)
      await healthcheck(project.healthcheckUrl)
      finishStage('healthcheck', 'Healthcheck passed')
    } else {
      const health = run.stages.find(stage => stage.type === 'healthcheck')
      if (health) health.status = 'skipped'
    }

    return { success: true, deployedUrl: deployment?.deployedUrl, deployedPath: deployment?.deployedPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    updateStage(currentStage, message, false)
    return { success: false, error: message }
  } finally {
    if (workspace) await fs.rm(workspace, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function healthcheck(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.AUTOSHIP_HEALTHCHECK_TIMEOUT_MS || 10000))
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok) throw new Error(`Healthcheck failed with HTTP ${response.status}`)
  } finally { clearTimeout(timer) }
}
