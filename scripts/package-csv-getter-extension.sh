#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
extension_dir="$repo_root/extensions/csv-getter"
output_zip="${1:-/tmp/csv-getter-helper-firefox.zip}"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command not found" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_zip")"
rm -f "$output_zip"

(
  cd "$extension_dir"
  zip -r "$output_zip" . >/dev/null
)

echo "Created $output_zip"
echo "Upload that zip file to AMO or the Chrome Web Store."
