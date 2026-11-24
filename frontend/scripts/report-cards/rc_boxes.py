#!/usr/bin/env python3
"""Find tick boxes (squares) and option circles on one report-card scan page, plus OCR text lines.

usage: rc_boxes.py <pdf> <page> <out-prefix>
writes <out-prefix>.json  {page:{wIn,hIn}, boxes:[{i,kind,x,y,size}], lines:[{text,x,y,w,h}]}
       <out-prefix>.png   the page with every box numbered (for checking by eye)
x/y/w/h/size are percentages of the page width/height (box x,y = centre). Page is landscape after rotation.
"""
import sys, json, subprocess, tempfile, os, csv
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

pdf, page, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
DPI = 200
tmp = tempfile.mkdtemp()
subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(page), '-l', str(page), '-png', pdf, os.path.join(tmp, 'p')], check=True)
png = [os.path.join(tmp, f) for f in os.listdir(tmp) if f.endswith('.png')][0]
img = Image.open(png).convert('RGB')
W, H = img.size
g = np.asarray(img.convert('L')).astype(np.int16)
dark = g < 120
lab, n = ndimage.label(dark)
boxes = []
for idx, sl in enumerate(ndimage.find_objects(lab), start=1):
    if sl is None:
        continue
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    if not (16 <= w <= 44 and 16 <= h <= 44):
        continue
    if not (0.8 <= w / h <= 1.25):
        continue
    comp = lab[sl] == idx
    fill = comp.mean()
    inner = comp[h // 4: h - h // 4, w // 4: w - w // 4]
    if inner.mean() > 0.15 or fill < 0.15 or fill > 0.75:
        continue  # solid blobs and letters are not boxes
    c = 3
    corners = np.mean([comp[:c, :c].mean(), comp[:c, -c:].mean(), comp[-c:, :c].mean(), comp[-c:, -c:].mean()])
    kind = 'square' if corners > 0.3 else 'circle'
    cy = (sl[0].start + sl[0].stop) / 2; cx = (sl[1].start + sl[1].stop) / 2
    boxes.append({'kind': kind, 'x': round(cx / W * 100, 3), 'y': round(cy / H * 100, 3), 'size': round(max(w, h) / W * 100, 3)})
# reading order: three panels left to right, then top to bottom inside each panel
boxes.sort(key=lambda b: (int(b['x'] // 33.34), b['y'], b['x']))
for i, b in enumerate(boxes):
    b['i'] = i
# OCR lines
tsv = subprocess.run(['tesseract', png, '-', '--psm', '3', 'tsv'], capture_output=True, text=True).stdout
lines = {}
for row in csv.DictReader(tsv.splitlines(), delimiter='\t', quoting=csv.QUOTE_NONE):
    if row.get('level') != '5' or not row['text'].strip():
        continue
    key = (row['block_num'], row['par_num'], row['line_num'])
    l, t, w, h = int(row['left']), int(row['top']), int(row['width']), int(row['height'])
    cur = lines.setdefault(key, {'words': [], 'l': l, 't': t, 'r': l + w, 'b': t + h})
    cur['words'].append(row['text']); cur['l'] = min(cur['l'], l); cur['t'] = min(cur['t'], t); cur['r'] = max(cur['r'], l + w); cur['b'] = max(cur['b'], t + h)
outlines = [{'text': ' '.join(v['words']), 'x': round(v['l'] / W * 100, 2), 'y': round(v['t'] / H * 100, 2), 'w': round((v['r'] - v['l']) / W * 100, 2), 'h': round((v['b'] - v['t']) / H * 100, 2)} for v in lines.values()]
outlines.sort(key=lambda l: (int(l['x'] // 33.34), l['y']))
json.dump({'pdf': os.path.basename(pdf), 'pageNumber': page, 'page': {'wIn': round(W / DPI, 2), 'hIn': round(H / DPI, 2)}, 'boxes': boxes, 'lines': outlines}, open(out + '.json', 'w'), indent=1)
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', 22)
except Exception:
    font = ImageFont.load_default()
for b in boxes:
    x, y = b['x'] * W / 100, b['y'] * H / 100; r = b['size'] * W / 200 + 3
    col = (220, 0, 0) if b['kind'] == 'square' else (0, 140, 0)
    d.rectangle([x - r, y - r, x + r, y + r], outline=col, width=3)
    d.text((x - r - 34, y - 12), str(b['i']), fill=col, font=font)
img.save(out + '.png')
print(f"{len(boxes)} boxes ({sum(b['kind']=='square' for b in boxes)} square), {len(outlines)} text lines -> {out}.json/.png")
