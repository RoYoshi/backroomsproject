#!/usr/bin/env python3
"""dev/trial-3-nani-corners/tools/corner_plot.py - Trial 3 R19, N track: draws corner_audit.js traces (development tool).

  python3 -I corner_plot.py TRACE.json OUT_DIR [--route 1] [--kind smiler] [--pace roam] [--scale .5]

Per run: the walls near the route (grey), its planned route (thin blue), the body's path coloured by speed (dark: slow .. yellow: its pace),
its collider (a circle) every 0.25 s, marks where it slid round a clipped corner (red dot), touched a wall (magenta) or its feeler braked
(cyan); a strip below: speed and heading turn over time.  One PNG a run."""
import json, math, os, sys
from PIL import Image, ImageDraw

a = sys.argv[1:]
src, out = a[0], a[1]
opt = lambda k, v: a[a.index(k) + 1] if k in a else v
os.makedirs(out, exist_ok=True)
T = json.load(open(src))
for r in T:
    if opt('--route', None) and str(r['route']) != opt('--route', ''): continue
    if opt('--kind', None) and r['kind'] != opt('--kind', ''): continue
    if opt('--pace', None) and r['pace'] != opt('--pace', ''): continue
    tr = r['tr']; xs = [q[1] for q in tr] + [p[0] for p in r['plan']]; ys = [q[2] for q in tr] + [p[1] for p in r['plan']]
    x0, y0, x1, y1 = min(xs) - 80, min(ys) - 80, max(xs) + 80, max(ys) + 80
    sc = float(opt('--scale', .6)); W, H = int((x1 - x0) * sc), int((y1 - y0) * sc)
    strip = 140; im = Image.new('RGB', (max(W, 600), H + strip), (16, 16, 18)); d = ImageDraw.Draw(im)
    P = lambda x, y: ((x - x0) * sc, (y - y0) * sc)
    for (wx, wy, ww, wh) in r['walls']:
        if wx + ww < x0 or wy + wh < y0 or wx > x1 or wy > y1: continue
        d.rectangle([P(wx, wy), P(wx + ww, wy + wh)], fill=(70, 70, 76))
    pts = [P(r['R']['ax'], r['R']['ay'])] + [P(p[0], p[1]) for p in r['plan']]
    d.line(pts, fill=(60, 110, 220), width=1)
    for p in pts: d.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], outline=(60, 110, 220))
    v = max(1, max(q[4] for q in tr))
    for i in range(1, len(tr)):
        q, p = tr[i], tr[i - 1]; k = min(1, q[4] / v); col = (int(40 + 215 * k), int(40 + 200 * k), int(60 * (1 - k)))
        d.line([P(p[1], p[2]), P(q[1], q[2])], fill=col, width=2)
    rc = r['rc'] * sc
    for i, q in enumerate(tr):
        if i % 15 == 0: c = P(q[1], q[2]); d.ellipse([c[0] - rc, c[1] - rc, c[0] + rc, c[1] + rc], outline=(120, 120, 130))
        f = q[8] if len(q) > 8 and q[8] else [0, 0, 0, 0]; c = P(q[1], q[2])
        if f[0] > 0: d.ellipse([c[0] - 2, c[1] - 2, c[0] + 2, c[1] + 2], fill=(230, 40, 40))
        if f[1] > 0: d.ellipse([c[0] - 3, c[1] - 3, c[0] + 3, c[1] + 3], outline=(230, 40, 230))
        if f[2] > 0: d.ellipse([c[0] - 3, c[1] - 3, c[0] + 3, c[1] + 3], outline=(40, 220, 230))
    # the strip: speed (yellow) and turn rate (white), over time
    t1 = tr[-1][0] or 1; sw = im.width - 20
    d.text((10, H + 4), f"{r['kind']} {r['pace']}{' (from speed)' if r['moving'] else ''} route {r['route']}: speed (yellow, 0..{v}), turn rate (white, +-3 rad/s)", fill=(220, 220, 220))
    base = H + strip - 10
    for i in range(1, len(tr)):
        q, p = tr[i], tr[i - 1]
        xa, xb = 10 + p[0] / t1 * sw, 10 + q[0] / t1 * sw
        d.line([(xa, base - p[4] / v * 100), (xb, base - q[4] / v * 100)], fill=(240, 200, 40))
        ta = math.atan2(math.sin(q[3] - p[3]), math.cos(q[3] - p[3])) / max(1e-3, q[0] - p[0])
        d.point((xb, base - 50 - max(-3, min(3, ta)) / 3 * 45), fill=(240, 240, 240))
    im.save(os.path.join(out, f"{r['kind']}_{r['pace']}{'_m' if r['moving'] else ''}_r{r['route']}.png"))
print('done')
