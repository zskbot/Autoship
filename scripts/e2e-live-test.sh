#!/usr/bin/env bash
set -euo pipefail

AUTOSHIP_HOST="${AUTOSHIP_HOST:-https://autoship.velclaw.cfd}"
API_TOKEN="${AUTOSHIP_API_TOKEN:-}"
REPOSITORY="${E2E_REPOSITORY:-https://github.com/zskbot/Autoship}"
BRANCH="${E2E_BRANCH:-main}"
COMMIT_HASH="${E2E_COMMIT_HASH:-}"
TIMEOUT_SECONDS="${E2E_TIMEOUT_SECONDS:-900}"
POLL_SECONDS="${E2E_POLL_SECONDS:-5}"

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
[[ -n "$API_TOKEN" ]] || { echo "AUTOSHIP_API_TOKEN is required" >&2; exit 1; }

api() {
  curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-connrefused \
    -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' "$@"
}

json_get() {
  node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0,"utf8")); const p=process.argv[1].split("."); let v=d; for(const k of p)v=v?.[k]; if(v===undefined||v===null)process.exit(2); process.stdout.write(String(v));' "$1"
}

echo "1. HTTPS health/readiness"
api "$AUTOSHIP_HOST/api/health" | tee /tmp/autoship-health.json
api "$AUTOSHIP_HOST/api/ready" | tee /tmp/autoship-ready.json

echo "2. Upsert E2E project"
PROJECT_RESPONSE="$(api -X POST "$AUTOSHIP_HOST/api/projects/upsert" -d "$(node -e 'console.log(JSON.stringify({repoUrl:process.argv[1],name:"Autoship Live E2E",branch:process.argv[2],target:"static-server",framework:"nodejs-express"}))' "$REPOSITORY" "$BRANCH")")"
PROJECT_ID="$(printf '%s' "$PROJECT_RESPONSE" | json_get project.id)"
echo "Project: $PROJECT_ID"

PAYLOAD="$(node -e 'const x={projectId:process.argv[1],branch:process.argv[2],author:"live-e2e",triggeredBy:"AgentsIDE-Live-E2E"}; if(process.argv[3])x.commitHash=process.argv[3]; console.log(JSON.stringify(x))' "$PROJECT_ID" "$BRANCH" "$COMMIT_HASH")"

echo "3. Trigger real pipeline"
RUN_RESPONSE="$(api -X POST "$AUTOSHIP_HOST/api/pipelines/trigger" -d "$PAYLOAD")"
RUN_ID="$(printf '%s' "$RUN_RESPONSE" | json_get run.id)"
echo "Run: $RUN_ID"

START="$(date +%s)"
while :; do
  INFO="$(api "$AUTOSHIP_HOST/api/pipelines/$RUN_ID")"
  STATUS="$(printf '%s' "$INFO" | json_get run.status)"
  echo "[$(( $(date +%s) - START ))s] status=$STATUS"
  case "$STATUS" in
    success)
      echo "E2E PASS: AgentsIDE-style request -> Autoship -> Runner pipeline completed."
      exit 0
      ;;
    failed)
      printf '%s\n' "$INFO"
      echo "E2E FAIL: pipeline failed." >&2
      exit 1
      ;;
  esac
  if (( $(date +%s) - START >= TIMEOUT_SECONDS )); then
    echo "E2E TIMEOUT after ${TIMEOUT_SECONDS}s" >&2
    exit 1
  fi
  sleep "$POLL_SECONDS"
done
