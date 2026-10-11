#!/usr/bin/env python3
"""Stage 3D - turn film_3d.py's one-row strips into readable grids (development only).

  python3 dev/stage-3d/regrid.py --dir FILM_DIR [--before OTHER_FILM_DIR] --out OUT_DIR [--cols 6]

film_3d.py writes sheet_<v>.jpg as two long rows (victim's view above, spectator's below), 360x280 per frame, with the times listed in
FILM_DIR/film_summary.json.  This cuts the strip into blocks of COLS frames; each block is a victim row over a spectator row, every frame
labelled with its time (and 'rest' for the settled corpse).  With --before, the same variant from another film is put above it, so a
sheet reads parent / candidate block by block."""
import os, sys, json, argparse
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser(); ap.add_argument('--dir', required=True); ap.add_argument('--before'); ap.add_argument('--out', required=True); ap.add_argument('--cols', type=int, default=6)
A = ap.parse_args(); os.makedirs(A.out, exist_ok=True)
CW, CH = 360, 280


def frames(d, name):
    p = os.path.join(d, name)
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB'); n = im.size[0] // CW
    return [(im.crop((i * CW, 0, i * CW + CW, CH)), im.crop((i * CW, CH, i * CW + CW, 2 * CH))) for i in range(n)]


def times(d, key):                         # the sample times film_3d.py used: its TIMES below the death's duration, then the duration itself
    try:
        S = json.load(open(os.path.join(d, 'film_summary.json'))); dur = S['variants'][key[:-1] + '-' + key[-1]]['dur']
        return [t for t in S['times'] if t < dur] + [dur]
    except Exception: return None


def label(im, txt, who):
    g = ImageDraw.Draw(im); g.rectangle((0, 0, 118, 14), fill=(0, 0, 0)); g.text((3, 2), f'{who} {txt}', fill=(235, 220, 160)); return im


for name in sorted(os.listdir(A.dir)):
    if not (name.startswith('sheet_') and name.endswith('.jpg')): continue
    key = name[6:-4].replace('_xray', ''); sets = []
    for tag, d in ([('parent', A.before)] if A.before else []) + [('now' if A.before else '', A.dir)]:
        f = frames(d, name)
        if f: sets.append((tag, f, times(d, key)))
    if not sets: continue
    n = max(len(f) for _, f, _ in sets); blocks = (n + A.cols - 1) // A.cols
    sheet = Image.new('RGB', (CW * A.cols, CH * 2 * len(sets) * blocks), (18, 16, 12))
    y = 0
    for b in range(blocks):
        for tag, f, ts in sets:
            for row, who in ((0, 'victim'), (1, 'spect')):
                for c in range(A.cols):
                    i = b * A.cols + c
                    if i >= len(f): continue
                    t = 'rest' if i == len(f) - 1 else (f'{ts[i]:.2f}s' if ts and i < len(ts) else f'#{i}')
                    sheet.paste(label(f[i][row].copy(), (tag + ' ' if tag else '') + t, who), (c * CW, y))
                y += CH
    sheet.save(os.path.join(A.out, name), quality=72)
    print(name, sheet.size)
