#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
filter="${1:-}"
(cd "$root/frontend" && node scripts/render-pdf-visual.mjs "$@")
bash "$root/scripts/pdf-parity/compare-pdfs.sh" \
  "$root/frontend/test-fixtures/pdf-parity/historical" \
  "$root/tmp/pdf-parity/current" \
  "$root/tmp/pdf-parity/diffs" \
  "$filter"
