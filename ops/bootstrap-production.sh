#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-zskbot/Autoship}"
DOMAIN="${DOMAIN:-autoship.velclaw.cfd}"
REGION="${REGION:-sgp1}"
SIZE="${SIZE:-s-2vcpu-4gb}"
DROPLET_NAME="${DROPLET_NAME:-autoship-production}"
SSH_KEY_NAME="${SSH_KEY_NAME:-autoship-deploy-key}"
SSH_PRIVATE_KEY="${SSH_PRIVATE_KEY:-$HOME/.ssh/id_ed25519_autoship}"
SSH_PUBLIC_KEY="${SSH_PRIVATE_KEY}.pub"
CREDENTIALS_FILE="${CREDENTIALS_FILE:-$HOME/.autoship-production.env}"

command -v doctl >/dev/null || { echo "doctl is required" >&2; exit 1; }
command -v gh >/dev/null || { echo "gh is required" >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }
command -v ssh-keygen >/dev/null || { echo "ssh-keygen is required" >&2; exit 1; }

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi
if ! doctl account get >/dev/null 2>&1; then
  echo "DigitalOcean CLI is not authenticated. Run: doctl auth init" >&2
  exit 1
fi

if [[ ! -f "$SSH_PRIVATE_KEY" ]]; then
  umask 077
  ssh-keygen -t ed25519 -f "$SSH_PRIVATE_KEY" -N "" -C "deploy@autoship"
fi
[[ -f "$SSH_PUBLIC_KEY" ]] || ssh-keygen -y -f "$SSH_PRIVATE_KEY" > "$SSH_PUBLIC_KEY"

KEY_ID="$(doctl compute ssh-key list --format ID,Name --no-header | awk -v n="$SSH_KEY_NAME" '$2==n {print $1; exit}')"
if [[ -z "$KEY_ID" ]]; then
  KEY_ID="$(doctl compute ssh-key import "$SSH_KEY_NAME" --public-key-file "$SSH_PUBLIC_KEY" --format ID --no-header)"
fi

if doctl compute droplet list --format Name --no-header | grep -Fxq "$DROPLET_NAME"; then
  echo "Droplet '$DROPLET_NAME' already exists. Refusing to create a duplicate." >&2
  exit 1
fi

echo "Creating $DROPLET_NAME in $REGION ($SIZE)..."
DROPLET_ID="$(doctl compute droplet create "$DROPLET_NAME" \
  --region "$REGION" \
  --size "$SIZE" \
  --image ubuntu-24-04-x64 \
  --ssh-keys "$KEY_ID" \
  --user-data-file ops/cloud-init-autoship.sh \
  --wait --format ID --no-header)"
PROD_IP="$(doctl compute droplet get "$DROPLET_ID" --format PublicIPv4 --no-header)"

DB_PASS="$(openssl rand -hex 32)"
API_TOKEN="$(openssl rand -hex 32)"
RUNNER_TOKEN="$(openssl rand -hex 32)"
DB_USER="autoship_admin"
DB_NAME="autoship_prod"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}"

set_secret() {
  local name="$1" value="$2"
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
}

set_secret PROD_SERVER_IP "$PROD_IP"
set_secret PROD_SSH_USER "root"
set_secret PROD_SSH_PRIVATE_KEY < "$SSH_PRIVATE_KEY"
set_secret PROD_POSTGRES_USER "$DB_USER"
set_secret PROD_POSTGRES_PASSWORD "$DB_PASS"
set_secret PROD_POSTGRES_DB "$DB_NAME"
set_secret PROD_AUTOSHIP_DATABASE_URL "$DATABASE_URL"
set_secret PROD_AUTOSHIP_API_TOKEN "$API_TOKEN"
set_secret PROD_AUTOSHIP_RUNNER_TOKEN "$RUNNER_TOKEN"

# GitHub token is deliberately not generated here. Supply a least-privilege PAT
# separately because it is used by the isolated runner to clone trusted repos.
if [[ -z "${PROD_AUTOSHIP_GITHUB_TOKEN:-}" ]]; then
  echo "PROD_AUTOSHIP_GITHUB_TOKEN is not set locally; set it separately with gh secret set." >&2
else
  set_secret PROD_AUTOSHIP_GITHUB_TOKEN "$PROD_AUTOSHIP_GITHUB_TOKEN"
fi

set_secret PROD_AUTOSHIP_CORS_ORIGINS "https://agentside.velclaw.cfd"
set_secret PROD_AUTOSHIP_TRUSTED_REPOS "https://github.com/zskbot/AgentsIDE"

# Keep generated credentials locally so the API token can be used by the live E2E
# test. Never print the token to stdout or commit this file.
umask 077
cat > "$CREDENTIALS_FILE" <<EOF
AUTOSHIP_HOST=https://$DOMAIN
AUTOSHIP_API_TOKEN=$API_TOKEN
AUTOSHIP_RUNNER_TOKEN=$RUNNER_TOKEN
PROD_SERVER_IP=$PROD_IP
PROD_SSH_USER=root
PROD_POSTGRES_USER=$DB_USER
PROD_POSTGRES_PASSWORD=$DB_PASS
PROD_POSTGRES_DB=$DB_NAME
PROD_AUTOSHIP_DATABASE_URL=$DATABASE_URL
EOF
chmod 600 "$CREDENTIALS_FILE"

cat <<EOF
=== Autoship infrastructure bootstrap complete ===
Droplet ID: $DROPLET_ID
Public IP:   $PROD_IP
Domain:      $DOMAIN
Credentials: $CREDENTIALS_FILE (mode 600; do not commit/share)

DNS:
  A $DOMAIN -> $PROD_IP

After DNS resolves and PROD_AUTOSHIP_GITHUB_TOKEN is set, start CD with:
  gh workflow run deploy-production.yml --repo $REPO

For live E2E, load the local credential file:
  set -a; source "$CREDENTIALS_FILE"; set +a
  bash scripts/e2e-live-test.sh

The generated SSH private key is:
  $SSH_PRIVATE_KEY
EOF
