#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

RAILWAY=(npx -y @railway/cli)
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-web}"
POSTGRES_SERVICE_NAME="${POSTGRES_SERVICE_NAME:-postgres}"
CRON_SERVICE_NAME="${CRON_SERVICE_NAME:-digest-cron}"
CRON_DAYS_BACK="${DIGEST_DAYS_BACK:-7}"

log() {
  printf '[railway-setup] %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

service_ref() {
  local service_name="$1"
  local variable_name="$2"

  if [[ "$service_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    printf '${{%s.%s}}' "$service_name" "$variable_name"
  else
    printf '${{ "%s".%s }}' "$service_name" "$variable_name"
  fi
}

create_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
}

require_command jq
require_command node

log 'Validating Railway authentication...'
if ! "${RAILWAY[@]}" whoami >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Railway authentication failed.
Set a valid RAILWAY_API_TOKEN or run: npx -y @railway/cli login
EOF
  exit 1
fi

status_file="$(mktemp)"
trap 'rm -f "$status_file"' EXIT

refresh_status() {
  "${RAILWAY[@]}" status --json >"$status_file"
}

log 'Checking linked Railway project...'
if ! refresh_status 2>/dev/null; then
  cat >&2 <<'EOF'
No linked Railway project found for this directory.
Run one of:
  npx -y @railway/cli link
  npx -y @railway/cli link --project <project-id>
Then rerun this script.
EOF
  exit 1
fi

service_exists() {
  local target="$1"
  jq -e --arg target "$target" '(.services // []) | any((.name // "") == $target)' "$status_file" >/dev/null
}

ensure_service() {
  local service_name="$1"
  local service_kind="$2"

  if service_exists "$service_name"; then
    log "Service '$service_name' already exists."
    return
  fi

  if [[ "$service_kind" == "postgres" ]]; then
    log "Creating Postgres service '$service_name'..."
    "${RAILWAY[@]}" add --database postgres --service "$service_name"
  else
    log "Creating service '$service_name'..."
    "${RAILWAY[@]}" add --service "$service_name"
  fi

  refresh_status
}

ensure_service "$POSTGRES_SERVICE_NAME" "postgres"
ensure_service "$WEB_SERVICE_NAME" "web"
ensure_service "$CRON_SERVICE_NAME" "cron"

DATABASE_URL_REF="$(service_ref "$POSTGRES_SERVICE_NAME" "DATABASE_URL")"
APP_DOMAIN_REF="$(service_ref "$WEB_SERVICE_NAME" "RAILWAY_PUBLIC_DOMAIN")"
WEB_CRON_SECRET_REF="$(service_ref "$WEB_SERVICE_NAME" "CRON_SECRET")"
CRON_SECRET_VALUE="${CRON_SECRET:-$(create_secret)}"

log "Setting variables on '$WEB_SERVICE_NAME'..."
"${RAILWAY[@]}" variable set --service "$WEB_SERVICE_NAME" \
  "NODE_ENV=production" \
  "DB_PROVIDER=postgres" \
  "DATABASE_URL=${DATABASE_URL_REF}" \
  "CRON_SECRET=${CRON_SECRET_VALUE}"

if [[ -n "${OLLAMA_URL:-}" ]]; then
  "${RAILWAY[@]}" variable set --service "$WEB_SERVICE_NAME" "OLLAMA_URL=${OLLAMA_URL}"
else
  log "OLLAMA_URL is not set in local env; set it on '$WEB_SERVICE_NAME' before production use."
fi

if [[ -n "${OLLAMA_MODEL:-}" ]]; then
  "${RAILWAY[@]}" variable set --service "$WEB_SERVICE_NAME" "OLLAMA_MODEL=${OLLAMA_MODEL}"
else
  log "OLLAMA_MODEL is not set in local env; set it on '$WEB_SERVICE_NAME' before production use."
fi

if [[ -n "${RSS_FEEDS:-}" ]]; then
  "${RAILWAY[@]}" variable set --service "$WEB_SERVICE_NAME" "RSS_FEEDS=${RSS_FEEDS}"
fi

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  "${RAILWAY[@]}" variable set --service "$WEB_SERVICE_NAME" "OPENAI_API_KEY=${OPENAI_API_KEY}"
fi

if [[ -n "${OPENAI_EMBED_MODEL:-}" ]]; then
  "${RAILWAY[@]}" variable set --service "$WEB_SERVICE_NAME" "OPENAI_EMBED_MODEL=${OPENAI_EMBED_MODEL}"
fi

log "Setting variables on '$CRON_SERVICE_NAME'..."
"${RAILWAY[@]}" variable set --service "$CRON_SERVICE_NAME" \
  "APP_BASE_URL=${APP_DOMAIN_REF}" \
  "CRON_SECRET=${WEB_CRON_SECRET_REF}" \
  "DIGEST_DAYS_BACK=${CRON_DAYS_BACK}"

log "Deploying web service '$WEB_SERVICE_NAME' from repository root..."
"${RAILWAY[@]}" up --service "$WEB_SERVICE_NAME" --detach

log "Deploying cron service '$CRON_SERVICE_NAME' from ops/railway/digest-cron..."
"${RAILWAY[@]}" up "ops/railway/digest-cron" --service "$CRON_SERVICE_NAME" --path-as-root --detach

log 'Ensuring public domain exists for the web service...'
if ! "${RAILWAY[@]}" domain --service "$WEB_SERVICE_NAME" >/dev/null 2>&1; then
  log "Could not auto-generate a domain. Create one in Railway dashboard for service '$WEB_SERVICE_NAME'."
fi

log 'Production provisioning command flow completed.'
cat <<EOF
Next steps:
1) Confirm '$WEB_SERVICE_NAME' has OLLAMA_URL and OLLAMA_MODEL configured.
2) Open Railway logs:
   npx -y @railway/cli logs --service $WEB_SERVICE_NAME
   npx -y @railway/cli logs --service $CRON_SERVICE_NAME
3) Verify health endpoint: https://<your-domain>/api/health
EOF
