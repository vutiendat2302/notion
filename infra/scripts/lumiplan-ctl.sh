#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Missing $ENV_FILE. Run 'cp .env.example .env' and configure secrets first." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-notion-productivity-isolated}"
PUBLIC_HOST="${APP_PUBLIC_HOSTNAME:-lumiplan.vtdat.com}"
BE_PORT="${BACKEND_PORT:-18000}"
FE_PORT="${FRONTEND_PORT:-3100}"

COMPOSE_CMD=(
  docker compose
  -p "$PROJECT_NAME"
  --env-file "$ENV_FILE"
  -f "$REPO_ROOT/infra/compose.yaml"
  -f "$REPO_ROOT/infra/compose.prod.yaml"
  --profile storage
  --profile public
)

CORE_SERVICES=(minio backend backend-recurrence-worker frontend cloudflare-tunnel)

check_url() {
  local label="$1"
  local url="$2"
  local code
  if command -v curl >/dev/null 2>&1; then
    code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "ERR")"
  else
    code="$(python3 - "$url" <<'PY'
import sys, urllib.request, urllib.error
try:
    with urllib.request.urlopen(sys.argv[1], timeout=5) as r:
        print(r.status)
except urllib.error.HTTPError as e:
    print(e.code)
except Exception as e:
    print(f"ERR:{e}")
PY
)"
  fi
  printf "%-24s %s -> %s\n" "$label" "$url" "$code"
}

cmd="${1:-status}"
shift || true

case "$cmd" in
  on)
    BUILD_FLAG="--build"
    if [ "${1:-}" = "--no-build" ]; then
      BUILD_FLAG="--no-build"
      shift
    fi
    if [ ! -f "${TUNNEL_CONFIG_PATH:-}" ] || [ ! -f "${TUNNEL_CREDENTIALS_PATH:-}" ]; then
      echo "ERROR: Missing TUNNEL_CONFIG_PATH or TUNNEL_CREDENTIALS_PATH in $ENV_FILE" >&2
      exit 1
    fi
    echo "Starting LumiPlan production stack ($PROJECT_NAME) -> https://$PUBLIC_HOST ..."
    "${COMPOSE_CMD[@]}" up -d "$BUILD_FLAG" "${CORE_SERVICES[@]}"
    echo ""
    echo "Waiting for backend health..."
    for _ in $(seq 1 20); do
      if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:${BE_PORT}/health/ready', timeout=2)" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    "${COMPOSE_CMD[@]}" ps
    echo ""
    check_url "Backend Ready" "http://127.0.0.1:${BE_PORT}/health/ready"
    check_url "Frontend Local" "http://127.0.0.1:${FE_PORT}/"
    check_url "Cloudflare Domain" "https://${PUBLIC_HOST}/api/v1/system/info"
    ;;
  off)
    echo "Stopping LumiPlan production stack ($PROJECT_NAME) without removing volumes..."
    "${COMPOSE_CMD[@]}" stop
    "${COMPOSE_CMD[@]}" ps
    ;;
  status)
    echo "=== LumiPlan Production ($PROJECT_NAME) ==="
    "${COMPOSE_CMD[@]}" ps
    echo ""
    check_url "Backend Ready" "http://127.0.0.1:${BE_PORT}/health/ready"
    check_url "Frontend Local" "http://127.0.0.1:${FE_PORT}/"
    check_url "Cloudflare Domain" "https://${PUBLIC_HOST}/api/v1/system/info"
    ;;
  logs)
    "${COMPOSE_CMD[@]}" logs -f --tail=100 "$@"
    ;;
  *)
    echo "Usage: $(basename "$0") {on [--no-build]|off|status|logs [service]}" >&2
    exit 1
    ;;
esac
