#!/usr/bin/env python3
"""Draw a report-card map onto its scans so every position can be checked by eye.

usage: rc_overlay.py <map.json> <out-prefix> [--pdf-dir DIR]
writes <out-prefix>-outside.png and <out-prefix>-inside.png with:
  red tick + criterion id at each criteria entry, blue tick + level at each nextLevel entry,
  green sample text at each field (participant, instructor, date, session).
"""
import sys, json, os, subprocess, tempfile, argparse
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('map'); ap.add_argument('out'); ap.add_argument('--pdf-dir', default='/home/frank/Documents/rec-tec')
a = ap.parse_args()
m = json.load(open(a.map))
DPI = 110
def font(size):
    try:
        return ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', size)
    except Exception:
        return ImageFont.load_default()
pages = {}
for side in ('outside', 'inside'):
    tmp = tempfile.mkdtemp(); n = m['source'][side + 'Page']
    subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(n), '-l', str(n), '-png', os.path.join(a.pdf_dir, m['source']['pdf']), os.path.join(tmp, 'p')], check=True)
    pages[side] = Image.open(os.path.join(tmp, os.listdir(tmp)[0])).convert('RGB')
def tick(d, img, x, y, color, label):
    W, H = img.size; px, py = x * W / 100, y * H / 100; s = 0.009 * W
    d.line([(px - s, py), (px - s / 3, py + s * 0.8), (px + s * 1.1, py - s)], fill=color, width=4)
    d.text((px + s * 1.4, py - s), label, fill=color, font=font(11))
draws = {k: ImageDraw.Draw(v) for k, v in pages.items()}
for cid, p in m.get('criteria', {}).items():
    tick(draws[p['page']], pages[p['page']], p['x'], p['y'], (220, 0, 0), cid.split(':', 1)[1])
for p in m.get('nextLevel', []):
    tick(draws[p['page']], pages[p['page']], p['x'], p['y'], (0, 60, 220), p['level'])
for name, p in m.get('fields', {}).items():
    img = pages[p['page']]; W, H = img.size
    draws[p['page']].text((p['x'] * W / 100, p['y'] * H / 100), {'participant': 'Avery Sample-Swimmer', 'instructor': 'Jordan Instructor', 'date': '2025-06-17', 'session': 'Spring 2025'}.get(name, name), fill=(0, 140, 0), font=font(16), anchor='lm')
for side, img in pages.items():
    img.save(f'{a.out}-{side}.png')
print('criteria', len(m.get('criteria', {})), 'nextLevel', len(m.get('nextLevel', [])), 'fields', list(m.get('fields', {})), '->', a.out + '-{outside,inside}.png')
