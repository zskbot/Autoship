# Autoship Production Runbook

## 1. Quick health check

```bash
curl -fsS https://autoship.velclaw.cfd/api/health
curl -fsS https://autoship.velclaw.cfd/api/ready
```

Expected result: HTTP 200 from both endpoints.

## 2. SSH to the host

```bash
ssh root@<PROD_SERVER_IP>
cd /opt/autoship
```

## 3. Stack status

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml top
```

## 4. Caddy / TLS

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=200 caddy
curl -Iv https://autoship.velclaw.cfd/api/health
```

If certificate issuance fails, verify the DNS A record points to the Droplet and that ports 80/443 are reachable. Caddy will retry certificate issuance; do not disable TLS verification as a workaround.

## 5. Control plane

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=200 autoship-control-plane
```

Look for database/state-load failures, authentication errors, runner connection errors, and uncaught exceptions.

## 6. Runner

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=300 autoship-runner
curl -fsS http://127.0.0.1:3100/health || true
```

Runner is intentionally isolated from the public network. The control plane reaches it over the Compose network.

## 7. PostgreSQL

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=200 postgres
docker compose --env-file .env.production -f docker-compose.production.yml exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Do not expose PostgreSQL on a host port.

## 8. Redeploy the current checkout

```bash
git rev-parse HEAD
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d --remove-orphans
```

Prefer the GitHub Actions CD workflow for normal deployments so CI's tested commit remains the source of truth.

## 9. E2E test

From a trusted workstation:

```bash
AUTOSHIP_API_TOKEN='<token>' ./scripts/e2e-live-test.sh
```

Optional exact commit:

```bash
E2E_COMMIT_HASH='<40-char-sha>' AUTOSHIP_API_TOKEN='<token>' ./scripts/e2e-live-test.sh
```

The test uses Autoship's actual `/api/projects/upsert`, `/api/pipelines/trigger`, and `/api/pipelines/:id` APIs; it does not assume nonexistent `/api/v1/deploy` or `/api/v1/jobs` endpoints.

## 10. Failure triage

### CD fails before SSH
Check required GitHub repository secrets and the workflow run logs.

### SSH fails
Verify `PROD_SERVER_IP`, `PROD_SSH_USER`, the matching public key on the Droplet, and that UFW allows TCP/22.

### Containers fail to start
Run `docker compose ... ps` and inspect the failing service logs. Common causes are malformed secrets, unavailable Docker image builds, or insufficient disk/RAM.

### `/api/ready` fails
Inspect control-plane, runner, and PostgreSQL logs. Readiness depends on the production dependencies being available.

### HTTPS fails
Verify DNS first, then port 80/443 reachability, then Caddy logs.

### Runner cannot clone a private repository
Verify `AUTOSHIP_GITHUB_TOKEN` and `AUTOSHIP_TRUSTED_REPOS`. Never print the token or put it in command output.

### Runner job fails
Inspect the run returned by `/api/pipelines/:id`, then correlate with runner logs. Check the failing stage, command timeout, output limit, dependency installation, and target adapter configuration.

## 11. Rollback

First stop further CD runs. For application-level rollback, use the target adapter's rollback support where configured. For a failed Autoship control-plane deployment, restore the previous known-good repository commit and rebuild the stack:

```bash
git checkout <known-good-sha>
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d --remove-orphans
```

Then verify `/api/health` and `/api/ready`.
