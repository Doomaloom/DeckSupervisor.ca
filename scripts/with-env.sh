#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  return 1 2>/dev/null || exit 1
fi

set -a
. "$ENV_FILE"
set +a

if [[ "$#" -eq 0 ]]; then
  if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
    echo "Loaded env from $ENV_FILE"
    return 0
  fi
  echo "Usage: source $0  # loads env into current shell" >&2
  echo "   or: $0 <command> [args...]" >&2
  exit 1
fi

"$@"
