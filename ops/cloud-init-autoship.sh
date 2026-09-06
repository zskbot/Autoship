#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg lsb-release ufw fail2ban git

# Only SSH and the reverse-proxy ports are exposed on the host.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP ACME'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# Official Docker repository.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf '%s\n' \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# Autoship's production compose stack already contains Caddy and owns ports 80/443.
# Do not install a second host-level Caddy instance: it would conflict with the stack.
mkdir -p /opt/autoship
chmod 750 /opt/autoship

systemctl enable --now fail2ban

cat >/opt/autoship/README.txt <<'EOF'
Autoship production host

The GitHub Actions production CD workflow deploys the checked-out repository into
/opt/autoship and runs docker compose using docker-compose.production.yml.

Caddy runs inside the Autoship stack and terminates TLS for autoship.velclaw.cfd.
Only ports 22, 80 and 443 should be reachable from the Internet.
EOF

echo '=== Autoship Droplet setup completed ==='
