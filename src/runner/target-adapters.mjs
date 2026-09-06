import { runCommand } from './real-executor.mjs'

export async function deployTarget(project, workspace, run, log = () => {}) {
  switch (project.target) {
    case 'static-server':
      return deployStaticServer(project, workspace, log)
    case 'vps-ssh':
      return deployVpsSsh(project, workspace, run, log)
    case 'vps-webhook':
      return deployWebhook(project, run, log)
    case 'docker':
      return deployDocker(project, workspace, run, log)
    case 'pm2':
      return deployPm2(project, workspace, run, log)
    case 'cloudrun':
      return deployCloudRun(project, workspace, run, log)
    default:
      throw new Error(`Unsupported deployment target: ${project.target}`)
  }
}

async function deployStaticServer(project, workspace, log) {
  const { deployStaticArtifact } = await import('./static-deploy.mjs')
  const root = project.deployPath || process.env.AUTOSHIP_STATIC_ROOT
  if (!root) throw new Error('static-server requires deployPath or AUTOSHIP_STATIC_ROOT')
  return { deployedPath: await deployStaticArtifact(workspace, root, log) }
}

async function deployVpsSsh(project, workspace, run, log) {
  requireServer(project, 'vps-ssh')
  const host = `${project.serverUser || 'root'}@${project.serverIp}`
  const port = Number(project.serverPort || 22)
  const destination = project.deployPath || '/var/www/app'
  const key = process.env.AUTOSHIP_SSH_PRIVATE_KEY
  if (!key) throw new Error('vps-ssh requires AUTOSHIP_SSH_PRIVATE_KEY on the runner')
  const keyFile = `/tmp/autoship-${run.id}.key`
  const { writeFile, rm } = await import('node:fs/promises')
  await writeFile(keyFile, key, { mode: 0o600 })
  try {
    await runCommand(`ssh -i '${keyFile}' -p ${port} -o StrictHostKeyChecking=no '${host}' 'mkdir -p ${shellQuote(destination)}'`, workspace, log)
    await runCommand(`rsync -az --delete -e "ssh -i '${keyFile}' -p ${port} -o StrictHostKeyChecking=no" dist/ '${host}:${destination}/'`, workspace, log)
    if (project.startCommand) await runCommand(`ssh -i '${keyFile}' -p ${port} -o StrictHostKeyChecking=no '${host}' ${shellQuote(project.startCommand)}`, workspace, log)
    return { deployedPath: destination }
  } finally { await rm(keyFile, { force: true }) }
}

async function deployWebhook(project, run, log) {
  const url = process.env.AUTOSHIP_DEPLOY_WEBHOOK_URL
  if (!url) throw new Error('vps-webhook requires AUTOSHIP_DEPLOY_WEBHOOK_URL on the runner')
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.AUTOSHIP_DEPLOY_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.AUTOSHIP_DEPLOY_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ projectId: project.id, runId: run.id, commitHash: run.commitHash, branch: run.branch }) })
  if (!response.ok) throw new Error(`Deploy webhook returned HTTP ${response.status}`)
  log(`Deploy webhook accepted: HTTP ${response.status}`)
  return {}
}

async function deployDocker(project, workspace, run, log) {
  const image = `${process.env.AUTOSHIP_DOCKER_IMAGE || project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:${run.commitHash}`
  const dockerfile = project.deployPath || 'Dockerfile'
  await runCommand(`docker build -f ${shellQuote(dockerfile)} -t ${shellQuote(image)} .`, workspace, log)
  if (process.env.AUTOSHIP_DOCKER_PUSH === 'true') await runCommand(`docker push ${shellQuote(image)}`, workspace, log)
  log(`Docker image built: ${image}`)
  return { image }
}

async function deployPm2(project, workspace, run, log) {
  const name = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  await runCommand(`pm2 delete ${shellQuote(name)} >/dev/null 2>&1 || true`, workspace, log)
  await runCommand(`pm2 start ${shellQuote(project.startCommand || 'dist/server.cjs')} --name ${shellQuote(name)}`, workspace, log)
  await runCommand('pm2 save', workspace, log)
  return { processName: name }
}

async function deployCloudRun(project, workspace, run, log) {
  const service = process.env.AUTOSHIP_CLOUDRUN_SERVICE || project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50)
  const region = process.env.AUTOSHIP_CLOUDRUN_REGION || 'asia-southeast1'
  if (process.env.AUTOSHIP_CLOUDRUN_IMAGE) {
    await runCommand(`gcloud run deploy ${shellQuote(service)} --image ${shellQuote(process.env.AUTOSHIP_CLOUDRUN_IMAGE)} --region ${shellQuote(region)} --platform managed --quiet`, workspace, log)
  } else {
    await runCommand(`gcloud run deploy ${shellQuote(service)} --source . --region ${shellQuote(region)} --platform managed --quiet`, workspace, log)
  }
  const url = await captureCommand(`gcloud run services describe ${shellQuote(service)} --region ${shellQuote(region)} --format='value(status.url)'`, workspace, log)
  return { deployedUrl: url.trim() }
}

async function captureCommand(command, cwd, log) {
  let output = ''
  await runCommand(command, cwd, line => { output += `${line}\n`; log(line) })
  return output
}

function requireServer(project, target) {
  if (!project.serverIp) throw new Error(`${target} requires serverIp`)
}
function shellQuote(value) { return `'${String(value).replaceAll("'", "'\\''")}'` }
