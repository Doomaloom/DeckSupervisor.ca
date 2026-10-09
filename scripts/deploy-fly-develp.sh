#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_NAME=decksupervisor-develop exec "$SCRIPT_DIR/deploy-fly.sh" "$@"
