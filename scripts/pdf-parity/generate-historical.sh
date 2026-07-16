#!/usr/bin/env bash
set -euo pipefail
revision="${1:-c315c452d8c0b3aabfff324f702f89aee3ce8a2e}"
root="$(git rev-parse --show-toplevel)"
source_dir="$root/tmp/pdf-parity/historical-source"
output_dir="$root/frontend/test-fixtures/pdf-parity/historical"
rm -rf "$source_dir"
mkdir -p "$source_dir/backend/cmd/pdf-goldens" "$output_dir"
git archive "$revision" | tar -x -C "$source_dir"
cp "$root/scripts/pdf-parity/historical-harness/main.go" "$source_dir/backend/cmd/pdf-goldens/main.go"
(cd "$source_dir/backend" && PDF_GOLDEN_OUTPUT="$output_dir" GOTMPDIR="$root/backend/.tmp" go run ./cmd/pdf-goldens)
