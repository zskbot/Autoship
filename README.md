# Autoship

Autoship is a GitHub-driven CI/CD control plane for building, testing and deploying applications through one API.

## Production architecture

`GitHub push -> CI -> Autoship project bootstrap -> pipeline -> clone -> npm ci -> test -> build -> target adapter -> healthcheck`

The real runner is deliberately gated. Set `AUTOSHIP_ENABLE_REAL_RUNNER=true` only on a trusted, isolated runner. Do not expose arbitrary repository execution directly from an internet-facing web process.

## Deployment targets

| Target | Adapter | Required runner capability |
|---|---|---|
| `static-server` | release directory + current deployment | writable deployment root |
| `vps-ssh` | SSH + rsync + optional remote start command | SSH key, ssh, rsync |
| `vps-webhook` | signed bearer webhook POST | webhook URL/token |
| `docker` | docker build, optional push | Docker CLI/daemon or remote Docker context |
| `pm2` | PM2 process replacement | PM2 on runner |
| `cloudrun` | `gcloud run deploy` | authenticated Google Cloud CLI |

Target-specific credentials are read from runner environment variables, never from browser code.

## API

- `GET /api/projects` — list projects
- `POST /api/projects` — create a project
- `POST /api/projects/upsert` — find/create a project by repository URL; designed for CI bootstrap
- `PUT /api/projects/:id` — update project
- `DELETE /api/projects/:id` — delete project
- `GET /api/pipelines` — list runs
- `GET /api/pipelines/:id` — inspect a run
- `POST /api/pipelines/trigger` — trigger a run
- `POST /api/webhooks/github/:projectId` — GitHub webhook

## Environment

### API/security

```env
APP_URL=https://your-autoship.example
AUTOSHIP_CORS_ORIGINS=https://your-agentside.example
AUTOSHIP_API_TOKEN=replace-with-a-long-random-token
AUTOSHIP_ENABLE_REAL_RUNNER=true
AUTOSHIP_HEALTHCHECK_TIMEOUT_MS=10000
```

Do not put `AUTOSHIP_API_TOKEN` into a browser bundle.

### VPS SSH

```env
AUTOSHIP_SSH_PRIVATE_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
```

The corresponding project must provide `serverIp`, optional `serverPort`, `serverUser`, and `deployPath`.

### Webhook

```env
AUTOSHIP_DEPLOY_WEBHOOK_URL=https://target.example/deploy
AUTOSHIP_DEPLOY_WEBHOOK_TOKEN=...
```

### Docker

```env
AUTOSHIP_DOCKER_IMAGE=registry.example.com/team/app
AUTOSHIP_DOCKER_PUSH=true
```

### Cloud Run

```env
AUTOSHIP_CLOUDRUN_SERVICE=agentside
AUTOSHIP_CLOUDRUN_REGION=asia-southeast1
# Optional when the image is built elsewhere:
AUTOSHIP_CLOUDRUN_IMAGE=asia-southeast1-docker.pkg.dev/project/repo/app:tag
```

The runner must already be authenticated with Google Cloud when using the `cloudrun` adapter.

### Static deployment

For `static-server`, configure `deployPath` explicitly or set `AUTOSHIP_STATIC_ROOT`. The runner creates versioned releases and switches `current` only after the artifact is copied successfully.

## Container

Autoship includes a production `Dockerfile` that builds the Vite UI and server bundle, then runs the application as a non-root user.

## GitHub Actions

`.github/workflows/ci.yml` verifies lint and production build on pushes and pull requests. `workflow_dispatch` is enabled for manual verification.

## Security model

Autoship executes build commands from the target repository. That is arbitrary code execution by design and must therefore run in an isolated worker/container with resource limits, restricted credentials, network policy and secret redaction. The public API process should not be used as an unrestricted multi-tenant build worker.
