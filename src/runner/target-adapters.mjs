import fs from 'node:fs/promises'
import path from 'node:path'
import { runCommand, shellQuote } from './real-executor.mjs'

export async function deployTarget(project, workspace, run, log = () => {}) {
  switch (project.target) {
    case 'static-server': return deployStaticServer(project, workspace, log)
    case 'vps-ssh': return deployVpsSsh(project, workspace, run, log)
    case 'vps-webhook': return deployWebhook(project, run, log)
    case 'docker': return deployDocker(project, workspace, run, log)
    case 'pm2': return deployPm2(project, workspace, run, log)
    case 'cloudrun': return deployCloudRun(project, workspace, run, log)
    default: throw new Error(`Unsupported deployment target: ${project.target}`)
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
  const destination = project.deployPath
  if (!destination || !destination.startsWith('/')) throw new Error('vps-ssh requires an absolute deployPath')
  const host = `${project.serverUser || 'root'}@${project.serverIp}`
  const port = Number(project.serverPort || 22)
  const key = process.env.AUTOSHIP_SSH_PRIVATE_KEY
  if (!key) throw new Error('vps-ssh requires AUTOSHIP_SSH_PRIVATE_KEY on the runner')
  const keyFile = `/tmp/autoship-${run.id}.key`
  await fs.writeFile(keyFile, key, { mode: 0o600 })
  const security = sshSecurityArgs()
  const sshBase = `ssh -i ${shellQuote(keyFile)} -p ${port} ${security} ${shellQuote(host)}`
  const rsyncBase = `rsync -az --delete -e ${shellQuote(`ssh -i ${keyFile} -p ${port} ${security}`)}`
  try {
    const release = `${destination}/releases/${run.commitHash}`
    await runCommand(`${sshBase} ${shellQuote(`mkdir -p ${shellQuote(release)}`)}`, workspace, log)
    await runCommand(`${rsyncBase} dist/ ${shellQuote(`${host}:${release}/`)}`, workspace, log)
    await runCommand(`${sshBase} ${shellQuote(`ln -sfn ${shellQuote(release)} ${shellQuote(`${destination}/current`)}`)}`, workspace, log)
    if (project.startCommand) await runCommand(`${sshBase} ${shellQuote(project.startCommand)}`, workspace, log)
    return { deployedPath: `${destination}/current` }
  } finally { await fs.rm(keyFile, { force: true }) }
}

function sshSecurityArgs() {
  const knownHosts = process.env.AUTOSHIP_SSH_KNOWN_HOSTS_FILE
  if (knownHosts) return `-o UserKnownHostsFile=${shellQuote(knownHosts)} -o StrictHostKeyChecking=yes`
  if (process.env.AUTOSHIP_SSH_INSECURE === 'true') return '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'
  throw new Error('SSH requires AUTOSHIP_SSH_KNOWN_HOSTS_FILE; insecure host-key checking must be explicitly enabled')
}

async function deployWebhook(project, run, log) {
  const url = project.webhookUrl || process.env[`AUTOSHIP_DEPLOY_WEBHOOK_URL_${project.id}`] || process.env.AUTOSHIP_DEPLOY_WEBHOOK_URL
  if (!url) throw new Error('vps-webhook requires webhookUrl or AUTOSHIP_DEPLOY_WEBHOOK_URL')
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.AUTOSHIP_DEPLOY_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.AUTOSHIP_DEPLOY_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ projectId: project.id, runId: run.id, commitHash: run.commitHash, branch: run.branch }) })
  if (!response.ok) throw new Error(`Deploy webhook returned HTTP ${response.status}`)
  log(`Deploy webhook accepted: HTTP ${response.status}`)
  return {}
}

async function deployDocker(project, workspace, run, log) {
  const image = `${process.env.AUTOSHIP_DOCKER_IMAGE || project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:${run.commitHash}`
  const dockerfile = project.dockerfilePath || 'Dockerfile'
  const exists = await fs.stat(path.join(workspace, dockerfile)).catch(() => null)
  if (!exists?.isFile()) throw new Error(`Dockerfile not found: ${dockerfile}`)
  await runCommand(`docker build -f ${shellQuote(dockerfile)} -t ${shellQuote(image)} .`, workspace, log)
  if (process.env.AUTOSHIP_DOCKER_PUSH === 'true') await runCommand(`docker push ${shellQuote(image)}`, workspace, log)
  log(`Docker image built: ${image}`)
  return { image }
}

async function deployPm2(project, workspace, run, log) {
  const destination = project.deployPath
  if (!destination || !destination.startsWith('/')) throw new Error('pm2 requires an absolute deployPath')
  const name = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
  const release = path.join(destination, 'releases', run.commitHash)
  await fs.mkdir(release, { recursive: true })
  await fs.cp(workspace, release, { recursive: true, force: true })
  const current = path.join(destination, 'current')
  await fs.rm(current, { force: true }).catch(() => undefined)
  await fs.symlink(release, current, 'dir')
  await runCommand(`pm2 delete ${shellQuote(name)} >/dev/null 2>&1 || true`, release, log)
  await runCommand(`cd ${shellQuote(current)} && pm2 start ${shellQuote(project.startCommand || 'dist/server.cjs')} --name ${shellQuote(name)}`, release, log)
  await runCommand('pm2 save', release, log)
  return { deployedPath: current, processName: name }
}

async function deployCloudRun(project, workspace, run, log) {
  const service = process.env.AUTOSHIP_CLOUDRUN_SERVICE || project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50)
  const region = process.env.AUTOSHIP_CLOUDRUN_REGION || 'asia-southeast1'
  const image = process.env.AUTOSHIP_CLOUDRUN_IMAGE
  const env = (project.envVariables || []).filter(item => item?.key && !item.isSecret).map(item => `${item.key}=${item.value}`).join(',')
  const envArg = env ? ` --set-env-vars ${shellQuote(env)}` : ''
  const base = image ? `gcloud run deploy ${shellQuote(service)} --image ${shellQuote(image)} --region ${shellQuote(region)} --platform managed --quiet` : `gcloud run deploy ${shellQuote(service)} --source . --region ${shellQuote(region)} --platform managed --quiet`
  await runCommand(`${base}${envArg}`, workspace, log)
  const url = await captureCommand(`gcloud run services describe ${shellQuote(service)} --region ${shellQuote(region)} --format='value(status.url)'`, workspace, log)
  return { deployedUrl: url.trim() }
}

async function captureCommand(command, cwd, log) {
  let output = ''
  await runCommand(command, cwd, line => { output += `${line}\n`; log(line) })
  return output
}

function requireServer(project, target) { if (!project.serverIp) throw new Error(`${target} requires serverIp`) }
