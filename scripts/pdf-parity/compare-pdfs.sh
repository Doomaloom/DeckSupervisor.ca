#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
historical_dir="${1:-$root/frontend/test-fixtures/pdf-parity/historical}"
current_dir="${2:-$root/tmp/pdf-parity/current}"
diff_dir="${3:-$root/tmp/pdf-parity/diffs}"
mkdir -p "$diff_dir"

command -v pdfinfo >/dev/null
command -v pdftoppm >/dev/null
command -v magick >/dev/null

failures=0
shopt -s nullglob
goldens=("$historical_dir"/*.pdf)
if (( ${#goldens[@]} == 0 )); then
  echo "No historical PDF fixtures found in $historical_dir" >&2
  exit 1
fi

for historical in "${goldens[@]}"; do
  name="$(basename "$historical" .pdf)"
  current="$current_dir/$name.pdf"
  if [[ ! -f "$current" ]]; then echo "Missing current fixture: $current" >&2; failures=$((failures + 1)); continue; fi
  historical_pages="$(pdfinfo "$historical" | awk '/^Pages:/ {print $2}')"
  current_pages="$(pdfinfo "$current" | awk '/^Pages:/ {print $2}')"
  historical_size="$(pdfinfo -f 1 -l "$historical_pages" "$historical" | awk '/^Page +[0-9]+ size:|^Page size:/ {print $0}')"
  current_size="$(pdfinfo -f 1 -l "$current_pages" "$current" | awk '/^Page +[0-9]+ size:|^Page size:/ {print $0}')"
  if [[ "$historical_pages" != "$current_pages" || "$historical_size" != "$current_size" ]]; then
    echo "$name: page count or media boxes differ" >&2; failures=$((failures + 1)); continue
  fi
  pair_dir="$diff_dir/$name"; mkdir -p "$pair_dir"
  pdftoppm -r 144 -png "$historical" "$pair_dir/historical" >/dev/null 2>&1
  pdftoppm -r 144 -png "$current" "$pair_dir/current" >/dev/null 2>&1
  for page in $(seq 1 "$historical_pages"); do
    suffix="$page"
    old="$pair_dir/historical-$suffix.png"; new="$pair_dir/current-$suffix.png"
    dimensions_old="$(magick identify -format '%wx%h' "$old")"; dimensions_new="$(magick identify -format '%wx%h' "$new")"
    if [[ "$dimensions_old" != "$dimensions_new" ]]; then failures=$((failures + 1)); continue; fi
    ssim_error="$(magick compare -metric SSIM "$old" "$new" null: 2>&1 | sed -n 's/.*(\([^)]*\)).*/\1/p' || true)"
    ssim="$(awk -v error="$ssim_error" 'BEGIN { print 1 - error }')"
    rmse="$(magick compare -metric RMSE "$old" "$new" null: 2>&1 | sed -n 's/.*(\([^)]*\)).*/\1/p' || true)"
    magick compare "$old" "$new" "$pair_dir/difference-$suffix.png" 2>/dev/null || true
    if ! awk -v s="$ssim" -v r="$rmse" 'BEGIN { exit !(s >= .98 && r <= .05) }'; then
      echo "$name page $page: SSIM=$ssim RMSE=$rmse" >&2; failures=$((failures + 1))
    fi
  done
done
exit "$failures"
