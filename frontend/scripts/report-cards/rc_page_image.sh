#!/usr/bin/env bash
# Render one report-card scan page as a landscape JPEG for frontend/public/report-cards/.
# usage: rc_page_image.sh <pdf> <page> <out.jpg>
set -euo pipefail
tmp="$(mktemp -d)"
pdftoppm -r 150 -f "$2" -l "$2" -jpeg -jpegopt quality=72,optimize=y "$1" "$tmp/p"
mv "$tmp"/p*.jpg "$3"
rmdir "$tmp"
