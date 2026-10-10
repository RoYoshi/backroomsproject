#!/usr/bin/env python3
"""Stage 3C QA2 - analyse a boot_capture.js recording (development only).

  python3 dev/stage-3c-qa2/boot_sheet.py DIR TAG [--cols 6] [--max 24]

For every recorded frame: the share of pixels that are not black (any channel above 24 of 255) and the mean brightness, written
back into DIR/TAG.json as frames[i].nonBlack / .mean, with a summary per run (the first frame, the first frame with anything on it,
the first frame that is mostly non-black). Also writes DIR/TAG_<run>_sheet.jpg: a contact sheet of the frames where the picture
changed (each labelled with its time since navigation and its non-black share)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
D, TAG = Path(sys.argv[1]), sys.argv[2]
COLS = int(sys.argv[sys.argv.index('--cols') + 1]) if '--cols' in sys.argv else 6
MAXN = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 24
R = json.loads((D / f'{TAG}.json').read_text())
def font(sz):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', sz)
    except Exception: return ImageFont.load_default()
for run in R['runs']:
    prev = None; keep = []
    for f in run['frames']:
        a = np.asarray(Image.open(D / f['file']).convert('RGB')).astype(np.int16)
        mx = a.max(axis=2); f['nonBlack'] = round(float((mx > 24).mean()), 5); f['mean'] = round(float(a.mean()), 2)
        small = a[::8, ::8]
        changed = prev is None or float(np.abs(small - prev).mean()) > 1.5
        prev = small
        if changed: keep.append(f)
    fr = run['frames']
    firstAny = next((f for f in fr if f['nonBlack'] > .002), None)
    firstMost = next((f for f in fr if f['nonBlack'] > .3), None)
    run['summary'] = {'frames': len(fr), 'firstFrameAt': fr[0]['t'] if fr else None, 'firstFrameNonBlack': fr[0]['nonBlack'] if fr else None,
                      'firstNonBlackAt': firstAny and firstAny['t'], 'firstNonBlackShare': firstAny and firstAny['nonBlack'],
                      'firstMostlyLitAt': firstMost and firstMost['t'], 'changes': len(keep)}
    if len(keep) > MAXN:                                                   # keep the first frames, the last, and an even spread between
        idx = sorted(set([0, 1, 2, 3] + [round(i * (len(keep) - 1) / (MAXN - 5)) for i in range(MAXN - 4)]))
        keep = [keep[i] for i in idx if i < len(keep)][:MAXN]
    if keep:
        im0 = Image.open(D / keep[0]['file']); tw = 320; th = round(im0.height * tw / im0.width)
        rows = (len(keep) + COLS - 1) // COLS; lab = 22
        sheet = Image.new('RGB', (COLS * (tw + 8) + 8, rows * (th + lab + 8) + 40), (24, 22, 18)); d = ImageDraw.Draw(sheet)
        d.text((8, 10), f"{TAG} - {run['kind']} start: frames where the picture changed (time since navigation, share not black)", font=font(16), fill=(236, 228, 198))
        for i, f in enumerate(keep):
            x = 8 + (i % COLS) * (tw + 8); y = 40 + (i // COLS) * (th + lab + 8)
            sheet.paste(Image.open(D / f['file']).convert('RGB').resize((tw, th)), (x, y + lab))
            d.text((x, y + 2), f"{f['t']} ms  ·  {f['nonBlack'] * 100:.1f}%", font=font(14), fill=(236, 228, 198))
        sheet.save(D / f"{TAG}_{run['kind']}_sheet.jpg", quality=86)
(D / f'{TAG}.json').write_text(json.dumps(R, indent=1) + '\n')
print(json.dumps([{**r['summary'], 'kind': r['kind'], 'gestureAt': r['gestureAt']} for r in R['runs']]))
