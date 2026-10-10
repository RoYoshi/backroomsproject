#!/usr/bin/env python3
"""Stage 3C QA2 - classify the frames of a recorded screen transition (development only).

  python3 -I dev/stage-3c-qa2/transition_sheet.py DIR TAG [--title TEXT] [--cols 6] [--max 24]

DIR/TAG.json: {"frames": [{"file", "t"}, ...]} - screencast frames with their time in ms since the action (negative: before it;
the first frame is the picture before the action). For every frame: the share of pixels that are not black (any channel above
24 of 255) and its mean difference from the first frame (on an 8x-reduced grid), and a class:
  before - the picture before the action, still on screen (difference under 4);
  black  - under 0.5 % of the screen not black;
  dim    - something on screen, but under 10 % (a fade from black);
  lit    - 10 % or more of the screen not black (the world).
Writes the classes back into DIR/TAG.json and a contact sheet DIR/TAG_sheet.jpg of the frames where the picture changed; prints
JSON: the classes in order (consecutive repeats folded), with counts."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
D, TAG = Path(sys.argv[1]), sys.argv[2]
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
TITLE, COLS, MAXN = arg('--title', TAG), int(arg('--cols', 6)), int(arg('--max', 24))
J = json.loads((D / f'{TAG}.json').read_text())
fr = J['frames']
def font(sz):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', sz)
    except Exception: return ImageFont.load_default()
ref = None; prev = None; keep = []
for f in fr:
    a = np.asarray(Image.open(D / f['file']).convert('RGB')).astype(np.int16)
    small = a[::8, ::8]
    if ref is None: ref = small
    f['nonBlack'] = round(float((a.max(axis=2) > 24).mean()), 5)
    f['diffFirst'] = round(float(np.abs(small - ref).mean()), 2)
    f['cls'] = 'before' if f['diffFirst'] < 4 else 'black' if f['nonBlack'] < .005 else 'dim' if f['nonBlack'] < .10 else 'lit'
    if prev is None or float(np.abs(small - prev).mean()) > 1.5: keep.append(f); prev = small
seq = []
for f in fr:
    if seq and seq[-1][0] == f['cls']: seq[-1][1] += 1
    else: seq.append([f['cls'], 1, f['t']])
if len(keep) > MAXN:
    idx = sorted(set([0, 1, 2, 3] + [round(i * (len(keep) - 1) / (MAXN - 5)) for i in range(MAXN - 4)]))
    keep = [keep[i] for i in idx if i < len(keep)][:MAXN]
if keep:
    im0 = Image.open(D / keep[0]['file']); tw = 320; th = round(im0.height * tw / im0.width)
    rows = (len(keep) + COLS - 1) // COLS; lab = 22
    sheet = Image.new('RGB', (COLS * (tw + 8) + 8, rows * (th + lab + 8) + 40), (24, 22, 18)); d = ImageDraw.Draw(sheet)
    d.text((8, 10), TITLE, font=font(16), fill=(236, 228, 198))
    for i, f in enumerate(keep):
        x = 8 + (i % COLS) * (tw + 8); y = 40 + (i // COLS) * (th + lab + 8)
        sheet.paste(Image.open(D / f['file']).convert('RGB').resize((tw, th)), (x, y + lab))
        d.text((x, y + 2), f"{f['t']} ms  ·  {f['cls']}  ·  {f['nonBlack'] * 100:.1f}%", font=font(14), fill=(236, 228, 198))
    sheet.save(D / f'{TAG}_sheet.jpg', quality=86)
(D / f'{TAG}.json').write_text(json.dumps(J, indent=1) + '\n')
print(json.dumps({'sequence': [{'cls': c, 'frames': n, 'from': t} for c, n, t in seq], 'frames': len(fr)}))
