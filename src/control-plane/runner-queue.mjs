const DEFAULT_RETRIES = 3
const DEFAULT_BACKOFF_MS = 1500

export class RunnerQueue {
  constructor({ runs, projects, persist, runnerUrl, runnerToken, maxRetries = DEFAULT_RETRIES, backoffMs = DEFAULT_BACKOFF_MS }) {
    this.runs = runs
    this.projects = projects
    this.persist = persist
    this.runnerUrl = String(runnerUrl || '').replace(/\/$/, '')
    this.runnerToken = runnerToken || ''
    this.maxRetries = Number(maxRetries)
    this.backoffMs = Number(backoffMs)
    this.jobs = new Map()
    this.active = new Set()
  }

  async enqueue(runId, projectId) {
    const job = { runId, projectId, attempts: 0, queuedAt: new Date().toISOString() }
    this.jobs.set(runId, job)
    const run = this.runs.find(item => item.id === runId)
    if (run) run.status = 'queued'
    await this.persist?.()
    void this.dispatch(runId)
    return job
  }

  async restoreQueued() {
    for (const run of this.runs) {
      if (run.status === 'queued' && !this.jobs.has(run.id)) {
        this.jobs.set(run.id, { runId: run.id, projectId: run.projectId, attempts: 0, queuedAt: run.startedAt })
      }
    }
    for (const runId of this.jobs.keys()) void this.dispatch(runId)
  }

  async dispatch(runId) {
    if (this.active.has(runId)) return
    const job = this.jobs.get(runId)
    if (!job) return
    const run = this.runs.find(item => item.id === job.runId)
    const project = this.projects.find(item => item.id === job.projectId)
    if (!run || !project) { this.jobs.delete(runId); return }
    this.active.add(runId)
    try {
      while (job.attempts < this.maxRetries) {
        job.attempts += 1
        try {
          const result = await this.callRunner(project, run)
          this.applyResult(run, project, result)
          this.jobs.delete(runId)
          await this.persist?.()
          return
        } catch (error) {
          run.errorMessage = `Runner attempt ${job.attempts}/${this.maxRetries}: ${error instanceof Error ? error.message : String(error)}`
          if (job.attempts >= this.maxRetries) {
            run.status = 'failed'
            run.completedAt = new Date().toISOString()
            project.lastDeployStatus = 'failed'
            project.lastDeployedAt = run.completedAt
            this.jobs.delete(runId)
            await this.persist?.()
            return
          }
          await sleep(this.backoffMs * job.attempts)
        }
      }
    } finally {
      this.active.delete(runId)
    }
  }

  async callRunner(project, run) {
    if (!this.runnerUrl) throw new Error('AUTOSHIP_RUNNER_URL is not configured')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Number(process.env.AUTOSHIP_RUNNER_REQUEST_TIMEOUT_MS || 900000))
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (this.runnerToken) headers.Authorization = `Bearer ${this.runnerToken}`
      const response = await fetch(`${this.runnerUrl}/run`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({ project, run }),
      })
      const text = await response.text()
      let payload
      try { payload = text ? JSON.parse(text) : {} } catch { payload = { error: text || 'Runner returned invalid JSON' } }
      if (!response.ok) throw new Error(payload.error || `Runner returned HTTP ${response.status}`)
      return payload
    } finally { clearTimeout(timer) }
  }

  applyResult(run, project, result) {
    if (Array.isArray(result.stages)) run.stages = result.stages
    if (result.deployedUrl) run.deployedUrl = result.deployedUrl
    run.status = result.success ? 'success' : 'failed'
    run.errorMessage = result.success ? undefined : (result.error || 'Runner failed')
    run.completedAt = new Date().toISOString()
    run.durationSeconds = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))
    project.lastDeployStatus = run.status
    project.lastDeployedAt = run.completedAt
    project.totalBuilds = Number(project.totalBuilds || 0) + 1
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }
