#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
reference_kind="${ATTENDANCE_VISUAL_REFERENCE:-unified}"
reference_dir="$root/frontend/test-fixtures/pdf-parity/$reference_kind"
current_dir="$root/tmp/pdf-parity/attendance-current"
image_dir="$root/tmp/pdf-parity/attendance-images"
contact_dir="$root/tmp/pdf-parity/contact-sheets"
filter="${1:-}"

for command in pdfinfo pdftoppm magick; do
  command -v "$command" >/dev/null || { echo "$command is required for attendance visual tests." >&2; exit 1; }
done

rm -rf "$current_dir" "$image_dir"
mkdir -p "$current_dir" "$image_dir" "$contact_dir"

(
  cd "$root/frontend"
  PDF_VISUAL_OUTPUT_DIR="$current_dir" ATTENDANCE_VISUAL_FILTER="$filter" \
    npx vitest run src/features/pdf/pdfVisualFixtures.test.ts
)

failures=0
declare -a front_images=()
declare -a back_images=()
shopt -s nullglob
for reference in "$reference_dir"/attendance-*.pdf; do
  name="$(basename "$reference" .pdf)"
  if [[ -n "$filter" && "$filter" != "backs" && "${name,,}" != "attendance-${filter,,}" ]]; then continue; fi
  current="$current_dir/$name.pdf"
  [[ -f "$current" ]] || { echo "Missing current fixture: $name" >&2; failures=$((failures + 1)); continue; }

  old_pages="$(pdfinfo "$reference" | awk '/^Pages:/ {print $2}')"
  new_pages="$(pdfinfo "$current" | awk '/^Pages:/ {print $2}')"
  old_size="$(pdfinfo "$reference" | awk '/^Page size:/ {$1=$2=""; sub(/^  */, ""); print}')"
  new_size="$(pdfinfo "$current" | awk '/^Page size:/ {$1=$2=""; sub(/^  */, ""); print}')"
  if [[ "$old_pages" != "$new_pages" || "$old_size" != "$new_size" ]]; then
    echo "$name: page count or media box mismatch" >&2
    failures=$((failures + 1))
    continue
  fi

  pair_dir="$image_dir/$name"
  mkdir -p "$pair_dir"
  pdftoppm -r 144 -png "$reference" "$pair_dir/reference" >/dev/null 2>&1
  pdftoppm -r 144 -png "$current" "$pair_dir/current" >/dev/null 2>&1
  front_images+=("$pair_dir/current-1.png")
  back_images+=("$pair_dir/current-2.png")

  first_page=1
  [[ "$filter" == "backs" ]] && first_page=2
  for page in $(seq "$first_page" "$old_pages"); do
    old="$pair_dir/reference-$page.png"
    new="$pair_dir/current-$page.png"
    old_dimensions="$(magick identify -format '%wx%h' "$old")"
    new_dimensions="$(magick identify -format '%wx%h' "$new")"
    if [[ "$old_dimensions" != "$new_dimensions" ]]; then
      echo "$name page $page: raster dimensions differ" >&2
      failures=$((failures + 1))
      continue
    fi
    ssim_error="$(magick compare -metric SSIM "$old" "$new" null: 2>&1 | sed -n 's/.*(\([^)]*\)).*/\1/p' || true)"
    ssim="$(awk -v error="$ssim_error" 'BEGIN { print 1 - error }')"
    rmse="$(magick compare -metric RMSE "$old" "$new" null: 2>&1 | sed -n 's/.*(\([^)]*\)).*/\1/p' || true)"
    magick compare "$old" "$new" "$pair_dir/difference-$page.png" 2>/dev/null || true
    printf '%s page %s: SSIM=%s RMSE=%s\n' "$name" "$page" "$ssim" "$rmse"
    if [[ "$reference_kind" == "historical" ]]; then
      if [[ "$page" == "2" ]] && ! awk -v s="$ssim" -v r="$rmse" 'BEGIN { exit !(s >= .97 && r <= .08) }'; then failures=$((failures + 1)); fi
    elif ! awk -v s="$ssim" -v r="$rmse" 'BEGIN { exit !(s >= .99 && r <= .03) }'; then
      failures=$((failures + 1))
    fi
  done
done

if (( ${#front_images[@]} )); then
  magick montage "${front_images[@]}" -thumbnail '480x>' -tile 4x -geometry +8+20 "$contact_dir/attendance-fronts.pdf"
fi
if (( ${#back_images[@]} )); then
  magick montage "${back_images[@]}" -thumbnail '480x>' -tile 4x -geometry +8+20 "$contact_dir/attendance-backs.pdf"
fi

if (( failures )); then
  echo "$failures attendance visual comparison(s) failed. Inspect $image_dir and $contact_dir." >&2
  exit 1
fi
