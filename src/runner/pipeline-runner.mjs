import fs from 'node:fs/promises'
import { cloneRepository, installDependencies, runCommand } from './real-executor.mjs'
import { deployTarget } from './target-adapters.mjs'
import { assertRunnerEnabled } from './runner-policy.mjs'

export async function runRealPipeline(project, run, updateStage) {
  let workspace
  let currentStage = 'clone'
  const stageStarted = new Map()
  const startStage = (type, message) => { currentStage = type; stageStarted.set(type, Date.now()); updateStage(type, message, false, 'running') }
  const finishStage = (type, message) => updateStage(type, message, true, 'success', Date.now() - (stageStarted.get(type) || Date.now()))
  const failStage = (type, message) => {
    updateStage(type, message, false, 'failed', Date.now() - (stageStarted.get(type) || Date.now()))
    for (const stage of run.stages) if (stage.type !== type && stage.status === 'pending') stage.status = 'skipped'
  }
  const projectEnv = project.envVariables || []
  const secretValues = projectEnv.filter(item => item?.isSecret).map(item => item.value)
  const commandOptions = { projectEnv, secretValues }
  try {
    assertRunnerEnabled(project)
    startStage('clone', `Cloning ${project.repoUrl} (${run.branch})`)
    workspace = await cloneRepository(project.repoUrl, run.branch, line => updateStage('clone', line, false), run.commitHash)
    finishStage('clone', `Repository checked out at ${run.commitHash}`)
    startStage('deps', 'Installing dependencies')
    await installDependencies(workspace, line => updateStage('deps', line, false), projectEnv)
    finishStage('deps', 'Dependencies installed successfully')
    startStage('test', 'Running tests')
    await runCommand('npm test --if-present', workspace, line => updateStage('test', line, false), commandOptions)
    finishStage('test', 'Tests completed successfully')
    startStage('build', project.buildCommand || 'npm run build')
    await runCommand(project.buildCommand || 'npm run build', workspace, line => updateStage('build', line, false), commandOptions)
    finishStage('build', 'Production build completed successfully')
    startStage('deploy', `Deploying to ${project.target}`)
    const deployment = await deployTarget(project, workspace, run, line => updateStage('deploy', line, false))
    finishStage('deploy', 'Deployment completed successfully')
    if (deployment?.deployedUrl) run.deployedUrl = deployment.deployedUrl
    if (project.healthcheckUrl) {
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
    failStage(currentStage, message)
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
