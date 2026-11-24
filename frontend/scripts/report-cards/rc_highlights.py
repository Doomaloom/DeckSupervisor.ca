#!/usr/bin/env python3
"""Measure highlight areas on report-card scans and write them into the print maps.

usage: rc_highlights.py <map.json> [more maps...] [--dry-run]
For each criterion (and each extraBox with ticksWith) it adds "highlight": {x,y,w,h} covering the box and its text
(continuation lines included). For each skill whose first mapped criterion has a heading just above it, it adds
skills[skillId] = {page,x,y,w,h} covering the black heading text. All values are % of the landscape page.
Measured from the 150 dpi page images in frontend/public/report-cards. Existing "highlight"/"skills" are replaced.
"""
import sys, json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'report-cards'))
args = [a for a in sys.argv[1:] if not a.startswith('--')]; dry = '--dry-run' in sys.argv
_cache = {}

def ink_mask(name):
    if name not in _cache:
        rgb = np.asarray(Image.open(os.path.join(PUBLIC, name)).convert('RGB')).astype(np.int16)
        gray = rgb.mean(axis=2); sat = rgb.max(axis=2) - rgb.min(axis=2)
        _cache[name] = (gray < 135) & (sat < 70)  # black/grey ink only; blue titles and photos mostly drop out
    return _cache[name]

def bands(mask, x0, x1, y0, y1, step):
    """Ink rows between y0 and y1 (walking by step) as (top,bottom) bands, nearest first."""
    rows = mask[min(y0, y1):max(y0, y1) + 1, x0:x1].sum(axis=1) > 1
    idx = list(range(len(rows))) if step > 0 else list(range(len(rows) - 1, -1, -1))
    out, cur = [], None
    for i in idx:
        y = min(y0, y1) + i
        if rows[i]:
            cur = [y, y] if cur is None else [min(cur[0], y), max(cur[1], y)]
        elif cur is not None:
            out.append(tuple(cur)); cur = None
    if cur is not None:
        out.append(tuple(cur))
    return out

def right_edge(mask, x0, xmax, top, bottom, gap):
    cols = mask[top:bottom + 1, x0:xmax].sum(axis=0) > 0
    last, run = x0, 0
    for i, c in enumerate(cols):
        if c:
            last, run = x0 + i, 0
        else:
            run += 1
            if run > gap:
                break
    return last

def left_edge(mask, x0, x1, top, bottom):
    cols = np.nonzero(mask[top:bottom + 1, x0:x1].sum(axis=0) > 0)[0]
    return x0 + cols[0] if len(cols) else None

def pct(v, total):
    return round(v / total * 100, 2)

def measure(m):
    names = m['images']; points = []
    for cid, p in m['criteria'].items():
        points.append(('c', cid, p))
    for i, b in enumerate(m.get('extraBoxes', [])):
        if b.get('ticksWith'):
            points.append(('e', i, b))
    by_page = {}
    for kind, key, p in points:
        by_page.setdefault(p['page'], []).append((kind, key, p))
    skills = {}
    for page, items in by_page.items():
        mask = ink_mask(names[page]); H, W = mask.shape
        s = int(0.0085 * W)  # half a tick box
        centres = [(int(p['x'] / 100 * W), int(p['y'] / 100 * H)) for _, _, p in items]
        def has_box(top, bottom, cx):
            return any(abs(x - cx) < 3 * s and top - s <= y <= bottom + s for x, y in centres)
        for kind, key, p in items:
            cx, cy = int(p['x'] / 100 * W), int(p['y'] / 100 * H)
            panel_right = int((int(p['x'] // 33.34) + 1) * W / 3) - int(0.006 * W)
            xs = cx + s + 2
            line = bands(mask, xs, panel_right, cy - 2 * s, cy + 2 * s, 1)
            line = min(line, key=lambda b: abs((b[0] + b[1]) / 2 - cy)) if line else (cy - s, cy + s)
            top, bottom = min(line[0], cy - s), max(line[1], cy + s)
            lh = max(line[1] - line[0], s)
            text_left = left_edge(mask, xs, panel_right, line[0], line[1]) or xs
            # continuation lines: indented like the text, no box of their own, close below
            for _ in range(3):
                nxt = bands(mask, xs - s, panel_right, bottom + 1, min(H - 1, bottom + int(1.4 * lh)), 1)
                if not nxt:
                    break
                b = nxt[0]
                lx = left_edge(mask, cx - 2 * s, panel_right, b[0], b[1])
                if lx is None or lx < text_left - s or has_box(b[0], b[1], cx) or (b[1] - b[0]) > 1.6 * lh:
                    break
                bottom = b[1]
            right = right_edge(mask, xs, panel_right, top, bottom, int(0.04 * W))
            rect = {'x': pct(cx - s - 4, W), 'y': pct(top - 4, H), 'w': pct(right - (cx - s) + 10, W), 'h': pct(bottom - top + 8, H)}
            if kind == 'c':
                m['criteria'][key]['highlight'] = rect
            else:
                m['extraBoxes'][key]['highlight'] = rect
        # skill headings: black text starting near the box's left edge, right above the skill's first box
        firsts = {}
        for kind, key, p in items:
            if kind != 'c':
                continue
            skill = key.rsplit(':', 1)[0]
            if skill not in firsts or p['y'] < firsts[skill]['y'] and abs(p['x'] - firsts[skill]['x']) < 5:
                firsts[skill] = p
        for skill, p in firsts.items():
            cx, cy = int(p['x'] / 100 * W), int(p['y'] / 100 * H)
            panel_right = int((int(p['x'] // 33.34) + 1) * W / 3) - int(0.006 * W)
            box_left = cx - s
            heading = []
            y = cy - s - 2
            for _ in range(3):
                found = bands(mask, max(0, box_left - 2 * s), panel_right, max(0, y - int(0.035 * H)), y, -1)
                if not found:
                    break
                b = found[0]
                lx = left_edge(mask, max(0, box_left - 2 * s), panel_right, b[0], b[1])
                if lx is None or abs(lx - box_left) > 2.5 * s or has_box(b[0], b[1], cx) or (heading and heading[-1][0] - b[1] > 0.6 * (b[1] - b[0] + 1)):
                    break
                heading.append(b); y = b[0] - 1
            if not heading:
                continue
            top, bottom = heading[-1][0], heading[0][1]
            left = left_edge(mask, max(0, box_left - 2 * s), panel_right, top, bottom)
            right = right_edge(mask, left, panel_right, top, bottom, int(0.04 * W))
            skills[skill] = {'page': page, 'x': pct(left - 5, W), 'y': pct(top - 4, H), 'w': pct(right - left + 10, W), 'h': pct(bottom - top + 8, H)}
    m['skills'] = dict(sorted(skills.items()))
    return m

for path in args:
    m = measure(json.load(open(path)))
    print(f"{os.path.basename(path)}: {sum('highlight' in p for p in m['criteria'].values())}/{len(m['criteria'])} criteria, "
          f"{sum('highlight' in b for b in m.get('extraBoxes', []))} extra boxes, {len(m['skills'])} skill headings")
    if not dry:
        with open(path, 'w') as f:
            json.dump(m, f, indent=1, ensure_ascii=False); f.write('\n')
