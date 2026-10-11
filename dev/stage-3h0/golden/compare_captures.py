#!/usr/bin/env python3
"""Stage 3H0 - compare two folders of screenshots taken by the QA2 capture tools (development only).

  python3 -I dev/stage-3h0/golden/compare_captures.py OLD_DIR NEW_DIR --out REPORT.json [--sheet SHEET.jpg] [--strip-prefix]

Pairs images by name (with --strip-prefix, the part before the first underscore is ignored, so 'parent_1280x720_menu.jpg' pairs with
'final_1280x720_menu.jpg').  For each pair: the size, the share of pixels whose largest channel difference is over 24 (out of 255; JPEG
noise stays below that), the mean absolute difference, and the largest difference.  The sheet shows old | new | the difference (amplified)
for every pair, for a person to look at.  The tool reports; it does not decide.  What counts as "the same" is judged against an A/A pair
of folders (the same code captured twice), which shows how much a live, animated menu differs from itself."""
import os, sys, json
from PIL import Image, ImageChops, ImageDraw, ImageFont
import numpy as np

args = sys.argv[1:]
old_dir, new_dir = args[0], args[1]
out = args[args.index('--out') + 1]
sheet_path = args[args.index('--sheet') + 1] if '--sheet' in args else None
strip = '--strip-prefix' in args
key = (lambda n: n.split('_', 1)[1] if '_' in n else n) if strip else (lambda n: n)
IMG = ('.jpg', '.jpeg', '.png')
olds = {key(n): n for n in sorted(os.listdir(old_dir)) if n.lower().endswith(IMG)}
news = {key(n): n for n in sorted(os.listdir(new_dir)) if n.lower().endswith(IMG)}
rows, pairs = [], []
for k in sorted(set(olds) | set(news)):
    if k not in olds or k not in news:
        rows.append({'image': k, 'missing': 'old' if k not in olds else 'new'}); continue
    a = Image.open(os.path.join(old_dir, olds[k])).convert('RGB'); b = Image.open(os.path.join(new_dir, news[k])).convert('RGB')
    if a.size != b.size:
        rows.append({'image': k, 'sizeOld': a.size, 'sizeNew': b.size}); continue
    d = np.asarray(ImageChops.difference(a, b), dtype=np.int16).max(axis=2)
    rows.append({'image': k, 'size': list(a.size), 'changedShare': round(float((d > 24).mean()), 6), 'meanAbs': round(float(d.mean()), 3), 'max': int(d.max())})
    pairs.append((k, a, b, d))
rep = {'tool': 'dev/stage-3h0/golden/compare_captures.py', 'old': old_dir, 'new': new_dir, 'images': len(pairs),
       'missing': [r for r in rows if 'missing' in r or 'sizeOld' in r], 'rows': rows,
       'largestChangedShare': max([r.get('changedShare', 0) for r in rows] or [0])}
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
json.dump(rep, open(out, 'w'), indent=1)
print('%d pairs compared; %d unpaired or resized; largest share of changed pixels %.4f' % (len(pairs), len(rep['missing']), rep['largestChangedShare']))
for r in rows: print('  ', json.dumps(r))
if sheet_path and pairs:
    W, PAD, LAB = 420, 10, 22
    f = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(f, 13) if os.path.exists(f) else ImageFont.load_default()
    cells = []
    for k, a, b, d in pairs:
        r = W / a.width; h = max(1, round(a.height * r))
        heat = Image.fromarray(np.clip(d * 8, 0, 255).astype(np.uint8)).convert('RGB')
        cells.append((k, [x.resize((W, h)) for x in (a, b, heat)], h))
    H = PAD + sum(LAB + h + PAD for _, _, h in cells)
    sheet = Image.new('RGB', (3 * W + 4 * PAD, H), (24, 22, 18)); dr = ImageDraw.Draw(sheet); y = PAD
    for k, ims, h in cells:
        dr.text((PAD, y + 3), k + '   (old | new | difference x8)', font=font, fill=(236, 228, 198)); y += LAB
        for i, im in enumerate(ims): sheet.paste(im, (PAD + i * (W + PAD), y))
        y += h + PAD
    sheet.save(sheet_path, quality=82)
    print('sheet', sheet_path)
