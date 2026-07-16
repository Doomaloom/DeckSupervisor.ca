#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-decksupervisor}"
CONFIG_FILE="${CONFIG_FILE:-$ROOT_DIR/fly.toml}"

if ! command -v fly >/dev/null 2>&1; then
  echo "flyctl is required (expected command: fly)." >&2
  exit 1
fi

fly config validate --app "$APP_NAME" --config "$CONFIG_FILE"
fly deploy --app "$APP_NAME" --config "$CONFIG_FILE" --ha=false "$@"
fly scale count 1 --app "$APP_NAME" --yes

echo "Deployment complete. The single Machine will suspend when idle and wake on demand."
