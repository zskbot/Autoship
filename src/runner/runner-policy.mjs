export function assertRunnerEnabled(project) {
  if (process.env.AUTOSHIP_ENABLE_REAL_RUNNER !== 'true') {
    throw new Error('Real runner disabled. Set AUTOSHIP_ENABLE_REAL_RUNNER=true on the isolated runner.')
  }
  const trusted = (process.env.AUTOSHIP_TRUSTED_REPOS || '').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean)
  if (trusted.length && !trusted.includes(String(project.repoUrl).replace(/\/$/, ''))) {
    throw new Error(`Repository is not trusted by this runner: ${project.repoUrl}`)
  }
}
