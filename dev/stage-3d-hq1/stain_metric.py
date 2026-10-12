#!/usr/bin/env python3
"""Stage 3D HQ1 - how much blood is ON the wallpaper in a wall_capture.py picture?  (development only)

  python3 -I dev/stage-3d-hq1/stain_metric.py CAPTURE.json [CAPTURE.json ...] [--out FILE.json]

For each picture of a capture (before, impact, corpse, late joiner; victim and spectator): the band box is the part of the struck
face the eye can see - 34 px either side of the contact along the face, 0 to 22 px up it from the crease - mapped to the screen with
that picture's camera.  Counted inside it: blood-coloured pixels (R >= 40, R > 1.6 G, R > 1.6 B; the wallpaper is yellow, R ~ G > B).
Also counted: the same box 26 to 60 px up the face (above what the line of sight shows: the wall's top).  Gate W1 (STAGE_3D_HQ1_AUDIT.md):
>= 150 in the band box after the change where D7 has <= 10, and nothing new above it.  Writes an annotated crop per picture
(<picture>_band.png: the box outlined, the stain itself untouched)."""
import json, os, sys
from PIL import Image, ImageDraw

AX = {'S': ((1, 0), (0, -1)), 'N': ((-1, 0), (0, 1)), 'E': ((0, -1), (-1, 0)), 'W': ((0, 1), (1, 0))}   # side -> (along U, up into the wall)


def box(c, side, v0, v1, cam, W=960, H=640):
    (ux, uy), (nx, ny) = AX[side]; pts = []
    for u in (-34, 34):
        for v in (v0, v1): pts.append((c[0] + ux * u + nx * v, c[1] + uy * u + ny * v))
    sc, cx, cy = cam; sp = [(W / 2 + (x - cx) * sc, H / 2 + (y - cy) * sc) for x, y in pts]
    return [int(min(p[0] for p in sp)), int(min(p[1] for p in sp)), int(max(p[0] for p in sp)) + 1, int(max(p[1] for p in sp)) + 1]


def count(im, b):
    x0, y0, x1, y1 = max(0, b[0]), max(0, b[1]), min(im.width, b[2]), min(im.height, b[3]); n = 0
    if x1 <= x0 or y1 <= y0: return 0
    px = im.crop((x0, y0, x1, y1)).tobytes()
    for i in range(0, len(px), 3):
        r, g, bl = px[i], px[i + 1], px[i + 2]
        if r >= 40 and r > 1.6 * g and r > 1.6 * bl: n += 1
    return n


def measure(path):
    R = json.load(open(path)); d = os.path.dirname(path); side = R['side']; c = R.get('contact')
    st = ((R.get('receiverAtCorpse') or {}).get('spectator') or {}).get('stains') or []
    hit = [x for x in st if x.get('status') == 'stamped']
    if hit: side, c = hit[0]['side'], [hit[0]['x'], hit[0]['y']]          # the face the contact actually resolved to (a corner has two)
    out = {'capture': os.path.basename(path), 'side': side, 'contact': c, 'resolved': bool(hit), 'stains': st, 'shots': {}}
    for name, s in R['shots'].items():
        if not s.get('cam') or not c: continue
        im = Image.open(os.path.join(d, s['file'])).convert('RGB')
        band, above = box(c, side, 0, 22, s['cam']), box(c, side, 26, 60, s['cam'])
        out['shots'][name] = {'band': count(im, band), 'above': count(im, above), 'bandBox': band}
        a = im.copy(); g = ImageDraw.Draw(a); g.rectangle((band[0] - 2, band[1] - 2, band[2] + 1, band[3] + 1), outline=(0, 220, 255))
        cx, cy = (band[0] + band[2]) // 2, (band[1] + band[3]) // 2
        a.crop((cx - 90, cy - 60, cx + 90, cy + 60)).resize((540, 360), Image.LANCZOS).save(os.path.join(d, s['file'].replace('.png', '_band.png')))
    return out


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; o = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    if o in args: args.remove(o)
    res = [measure(a) for a in args]
    for r in res: print(r['capture'], r['side'], {k: (v['band'], v['above']) for k, v in r['shots'].items()})
    if o:
        with open(o, 'w') as f: json.dump(res, f, indent=1); f.write('\n')
