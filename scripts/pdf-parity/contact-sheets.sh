#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_dir="${1:-$root/tmp/pdf-parity/diffs}"
output_dir="${2:-$root/tmp/pdf-parity/contact-sheets}"
mkdir -p "$output_dir"
mapfile -t images < <(find "$source_dir" -name 'historical-*.png' -o -name 'current-*.png' | sort)
if (( ${#images[@]} == 0 )); then echo "No parity images found" >&2; exit 1; fi
magick montage "${images[@]}" -thumbnail '420x420>' -tile 4x -geometry +8+18 "$output_dir/all.pdf"
