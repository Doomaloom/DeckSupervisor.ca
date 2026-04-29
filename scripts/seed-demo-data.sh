#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CALLER_DIR="$PWD"

cd "$ROOT_DIR/backend"
mkdir -p .tmp
export TMPDIR="${TMPDIR:-$PWD/.tmp}"
export GOTMPDIR="${GOTMPDIR:-$PWD/.tmp}"
export DEMO_SEED_CALLER_DIR="$CALLER_DIR"
"$ROOT_DIR/scripts/with-env.sh" go run ./cmd/demo-seed --output "$ROOT_DIR/demo-data/current-week" "$@"
