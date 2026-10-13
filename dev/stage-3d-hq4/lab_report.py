#!/usr/bin/env python3
"""Stage 3D HQ4 - what wanderer_lab.py measured, side by side (development only; Pillow)

  python3 -I dev/stage-3d-hq4/lab_report.py LABDIR [--before NAME] [--after NAME] [--out FILE.json] [--sheets DIR]

LABDIR holds one folder per variant (wanderer_lab.py --out).  Reported:
  ellipse   per heading, inside one variant: what hiding the avatar's dark ellipse in the same frozen frame changed (pixels that
            differ, how many lie outside the ellipse's own outline grown by 2 px, inside the body circle); between --before
            and --after: the after capture against the before capture with the ellipse hidden (the same picture?), and against the
            before capture (where it differs)
  rotation  per heading, each variant's cast job for the Wanderer under the one fixture (start, the tongue's root .62*start and
            tip start+ext); between the variants, every other field of the job compared (direction, length, width, strength,
            self-shading, silhouette); from the captures with the actor effects on and off, the far end of the darkening
            behind the body along the cast's axis (world px), so the drawn shadow is measured, not only the job
  moving, carried, hound, peers, perf: each variant's jobs (and the hounds' jobs compared between variants)
Sheets (--sheets): ellipse_before_after.png, cast_rotation.png (labelled crops; nothing redrawn)."""
import os, sys, json, math, argparse
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ap = argparse.ArgumentParser(); ap.add_argument('lab'); ap.add_argument('--before', default='hq3'); ap.add_argument('--after', default=None)
ap.add_argument('--out', default=None); ap.add_argument('--sheets', default=None); ap.add_argument('--dpr', type=float, default=1)
A_ = ap.parse_args(); D = A_.dpr
V = {n: json.load(open(os.path.join(A_.lab, n, 'result.json'))) for n in sorted(os.listdir(A_.lab)) if os.path.exists(os.path.join(A_.lab, n, 'result.json'))}
img = lambda var, f: Image.open(os.path.join(A_.lab, var, f)).convert('RGB')
F = lambda s, b=False: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)
OUT = {'lab': A_.lab, 'variants': list(V), 'before': A_.before, 'after': A_.after}


def outline_mask(size, rec, key='outline', grow=2):
    cl = rec['shot']['clip']; tr = lambda p: ((p[0] - cl['x']) * D, (p[1] - cl['y']) * D)
    m = Image.new('L', size, 0); ImageDraw.Draw(m).polygon([tr(p) for p in rec[key]], fill=255)
    return m.filter(ImageFilter.MaxFilter(2 * int(grow * D) + 1)) if grow else m


def diff_stats(a, b, inside=None, body=None):
    d = ImageChops.difference(a, b).convert('L').load(); mi = inside.load() if inside else None; mb = body.load() if body else None
    tot = out = inb = mx = 0
    for y in range(a.height):
        for x in range(a.width):
            v = d[x, y]
            if v > 2:
                tot += 1; mx = max(mx, v)
                if mi is not None and not mi[x, y]: out += 1
                if mb is not None and mb[x, y]: inb += 1
    return {'pixelsDiffer': tot, 'outsideTheEllipse': out if mi is not None else None, 'insideTheBody': inb if mb is not None else None, 'maxDiff': mx}


def scale_of(rec):                                           # screen px per world px, from the ellipse's outline (radius 19)
    o = rec['outline']; n = len(o); return max(math.hypot(o[i][0] - o[(i + n // 2) % n][0], o[i][1] - o[(i + n // 2) % n][1]) for i in range(n)) / 38


# ---------- ellipse
if any('ellipse' in v['scenes'] for v in V.values()):
    E = {}
    for n, v in V.items():
        if 'ellipse' not in v['scenes']: continue
        rows = []
        for r in v['scenes']['ellipse']:
            row = {'heading': r['heading'], 'ellipseChild': r['ellipse']}
            a = img(n, r['shot']['file'])
            if r.get('shotHidden'):
                row['hiddenInTheSameFrame'] = diff_stats(a, img(n, r['shotHidden']['file']), outline_mask(a.size, r), outline_mask(a.size, r, 'body', 0))
            rows.append(row)
        E[n] = rows
    if A_.after and A_.after in V and A_.before in V:
        cross = []
        for rb, ra in zip(V[A_.before]['scenes']['ellipse'], V[A_.after]['scenes']['ellipse']):
            b0, a0 = img(A_.before, rb['shot']['file']), img(A_.after, ra['shot']['file'])
            row = {'heading': rb['heading'], 'afterVsBefore': diff_stats(b0, a0, outline_mask(b0.size, rb), outline_mask(b0.size, rb, 'body', 0))}
            if rb.get('shotHidden'): row['afterVsBeforeWithTheEllipseHidden'] = diff_stats(img(A_.before, rb['shotHidden']['file']), a0, outline_mask(b0.size, rb))
            cross.append(row)
        E['cross'] = cross
    OUT['ellipse'] = E


# ---------- corpse (Bob's view of Alice's corpse; the ellipse hidden in the same frame where it exists).  NOT a pixel proof: the
#            previewing Hound stays on the corpse and moves, and the spectator's page is corrected by the server, so nearly every
#            edge differs between two captures; what counts here is the corpse avatar's child count (the ellipse there or not)
if any('corpse' in v['scenes'] for v in V.values()):
    C = {}
    for n, v in V.items():
        r = v['scenes'].get('corpse')
        if not r or not r.get('shot'): continue
        row = {'view': r.get('view'), 'avatarChildren': r.get('avatarChildren')}
        if r.get('shotHidden'):
            a = img(n, r['shot']['file']); row['hiddenInTheSameFrame'] = diff_stats(a, img(n, r['shotHidden']['file']), outline_mask(a.size, r))
        C[n] = row
    if A_.after in C and A_.before in C and V[A_.before]['scenes']['corpse'].get('shotHidden'):
        rb, ra = V[A_.before]['scenes']['corpse'], V[A_.after]['scenes']['corpse']
        b0 = img(A_.before, rb['shot']['file']); a0 = img(A_.after, ra['shot']['file'])
        C['cross'] = {'afterVsBefore': diff_stats(b0, a0, outline_mask(b0.size, rb)), 'afterVsBeforeWithTheEllipseHidden': diff_stats(img(A_.before, rb['shotHidden']['file']), a0, outline_mask(b0.size, rb))}
    OUT['corpse'] = C


# ---------- rotation
def cast_reach(var, rec, scale):
    """the far end of the darkening behind the body along the cast's axis, from the captures with the actor effects on and off"""
    if not rec.get('profile') or not rec['profile'].get('shotOff'): return None
    on, off = img(var, rec['shot']['file']), img(var, rec['profile']['shotOff']['file'])
    job = [j for j in rec['jobs'] if j['dominant']][0]; cx, cy = on.width / 2, on.height / 2; ux, uy = math.cos(job['ang']), math.sin(job['ang'])
    po, pf = on.load(), off.load(); k = scale * D; reach = 0; mass = mom = 0
    hands = [((h[0] - rec['shot']['clip']['x']) * D, (h[1] - rec['shot']['clip']['y']) * D) for h in rec['hands']]
    for y in range(on.height):
        for x in range(on.width):
            dx, dy = x - cx, y - cy; t = (dx * ux + dy * uy) / k; lat = abs(-dx * uy + dy * ux) / k
            if t < 20 or lat > 24 or any(math.hypot(x - hx, y - hy) < 9 * k for hx, hy in hands): continue   # behind the body, near the axis, off the hands
            dk = sum(pf[x, y]) - sum(po[x, y])
            if dk > 6: reach = max(reach, t); mass += dk; mom += dk * t
    return {'farEnd': round(reach, 1), 'centroid': round(mom / mass, 2) if mass else None, 'darkening': mass}


if any('rotation' in v['scenes'] for v in V.values()):
    Rt = {}
    for n, v in V.items():
        if 'rotation' not in v['scenes']: continue
        sc = scale_of(v['scenes']['ellipse'][0]) if 'ellipse' in v['scenes'] else None
        rows = []
        for r in v['scenes']['rotation']:
            d = [j for j in r['jobs'] if j['dominant']]
            j = d[0] if d else None
            row = {'heading': r['heading'], 'light': j and j['light'], 'start': j and round(j['start'], 3), 'root': j and round(j['start'] * .62, 3),
                   'tip': j and round(j['start'] + j['ext'], 3), 'ext': j and j['ext'], 'ang': j and round(j['ang'], 4)}
            if r.get('swing'): row['swingStarts'] = [[round(q['start'], 3) for q in s['jobs'] if q['dominant']] for s in r['swing']]
            if sc and r.get('profile'): row['drawn'] = cast_reach(n, r, sc)
            rows.append(row)
        st = [x['start'] for x in rows if x['start'] is not None]
        Rt[n] = {'rows': rows, 'start': {'min': min(st), 'max': max(st), 'range': round(max(st) - min(st), 3)},
                 'swingStarts': sorted({s for x in rows for q in x.get('swingStarts', []) for s in q})}
        fe = [x['drawn']['farEnd'] for x in rows if x.get('drawn')]
        if fe: Rt[n]['drawnFarEnd'] = {'min': min(fe), 'max': max(fe), 'range': round(max(fe) - min(fe), 1)}
    if A_.after and A_.after in V and A_.before in V and 'rotation' in V[A_.after]['scenes']:
        same, diff = 0, []
        for rb, ra in zip(V[A_.before]['scenes']['rotation'], V[A_.after]['scenes']['rotation']):
            for jb, ja in zip(rb['jobs'], ra['jobs']):
                keys = [k for k in jb if k != 'start']
                bad = [k for k in keys if (round(jb[k], 6) if isinstance(jb[k], float) else jb[k]) != (round(ja[k], 6) if isinstance(ja[k], float) else ja[k])]
                if bad: diff.append({'heading': rb['heading'], 'fields': bad})
                else: same += 1
        Rt['jobsCompared'] = {'identicalApartFromStart': same, 'otherDifferences': diff}
    OUT['rotation'] = Rt

# ---------- the rest, as measured
for scene in ('moving', 'carried', 'hound', 'peers', 'perf'):
    got = {n: v['scenes'][scene] for n, v in V.items() if scene in v['scenes']}
    if not got: continue
    if scene in ('moving', 'carried'):
        OUT[scene] = {n: [{'at': r.get('at') or r.get('bob'), 'jobs': [{k: (round(j[k], 3) if isinstance(j[k], float) else j[k]) for k in ('light', 'lightKind', 'dominant', 'ang', 'ext', 'start', 'a')} for j in r['jobs']]} for r in rows] for n, rows in got.items()}
    elif scene == 'hound':
        OUT[scene] = {n: [{'at': r['at'], 'rotation': r['rotation'], 'jobs': r['jobs']} for r in rows] if isinstance(rows, list) else rows['jobs'] for n, rows in got.items()}
        if A_.after in got and A_.before in got and isinstance(got[A_.after], list):
            OUT[scene]['identical'] = all(json.dumps(a['jobs'], sort_keys=True) == json.dumps(b['jobs'], sort_keys=True) for a, b in zip(got[A_.before], got[A_.after])) and all(r['jobs'] for r in got[A_.before])
    elif scene == 'peers':
        OUT[scene] = {n: {k: {'bob': r[k]['bob'], 'jobs': r[k]['jobs']} for k in r} for n, r in got.items()}
    else:
        OUT[scene] = got

# ---------- sheets
if A_.sheets:
    os.makedirs(A_.sheets, exist_ok=True); BG, FG, DIM = (14, 14, 12), (236, 228, 200), (170, 160, 130)
    def sheet(tiles, cols, title, note, out, pad=12):
        cw = max(t.width for t, _ in tiles); rows = (len(tiles) + cols - 1) // cols
        rh = [max(t.height for t, _ in tiles[r * cols:(r + 1) * cols]) for r in range(rows)]
        Wd = cols * cw + (cols + 1) * pad; Ht = 52 + sum(h + 26 + pad for h in rh) + 30
        im = Image.new('RGB', (Wd, Ht), BG); d = ImageDraw.Draw(im); d.text((pad, 12), title, font=F(19, True), fill=FG); y = 46
        for r in range(rows):
            for c, (t, lab) in enumerate(tiles[r * cols:(r + 1) * cols]):
                x = pad + c * (cw + pad); d.text((x, y), lab, font=F(13), fill=DIM); im.paste(t, (x, y + 20))
            y += rh[r] + 26 + pad
        d.text((pad, Ht - 24), note, font=F(12), fill=DIM); im.save(out, optimize=True); return out
    zoom = lambda im, half=70, k=3: im.crop((im.width / 2 - half * D, im.height / 2 - half * D, im.width / 2 + half * D, im.height / 2 + half * D)).resize((int(2 * half * k), int(2 * half * k)), Image.NEAREST)
    if 'ellipse' in OUT and A_.after in V and 'ellipse' in V[A_.after]['scenes'] and any(r['ellipse']['visible'] is not None for r in V[A_.before]['scenes']['ellipse']):   # (only when 'before' has the ellipse)
        tiles = []
        for rb, ra in zip(V[A_.before]['scenes']['ellipse'], V[A_.after]['scenes']['ellipse']):
            tiles.append((zoom(img(A_.before, rb['shot']['file']), 40, 3), f'BEFORE (HQ3), turned {rb["heading"]} deg'))
            tiles.append((zoom(img(A_.after, ra['shot']['file']), 40, 3), f'AFTER (HQ4), turned {ra["heading"]} deg'))
        OUT['sheetEllipse'] = sheet(tiles, 4, 'HQ4 fix A - the dark ellipse behind the Wanderer, before and after',
                                    'Real captures: the same frozen frame, one fixture, her own light off (wanderer_lab.py, SwiftShader), enlarged 3x.',
                                    os.path.join(A_.sheets, 'ellipse_before_after.png'))
    if 'rotation' in OUT and A_.after in V and 'rotation' in V[A_.after]['scenes']:
        def castview(var, rec, guide):                                           # the cast and self-shading alone: actors off minus on, x4, on black
            on, off = img(var, rec['shot']['file']), img(var, rec['profile']['shotOff']['file'])
            d = ImageChops.subtract(off, on).convert('L').point(lambda v: min(255, v * 4)); c = Image.merge('RGB', (d, d, d))
            dr = ImageDraw.Draw(c); cx, cy = c.width / 2, c.height / 2
            j = [q for q in rec['jobs'] if q['dominant']][0]; sc = scale_of(V[var]['scenes']['ellipse'][0]) * D; ux, uy = math.cos(j['ang']), math.sin(j['ang'])
            gx, gy = cx + ux * guide * sc, cy + uy * guide * sc; dr.line([gx - uy * 30 * sc, gy + ux * 30 * sc, gx + uy * 30 * sc, gy - ux * 30 * sc], fill=(90, 160, 255), width=1)
            t = j['start'] + j['ext']; px, py = cx + ux * t * sc, cy + uy * t * sc; dr.ellipse([px - 3, py - 3, px + 3, py + 3], outline=(255, 80, 80), width=2)
            bx, by = cx + ux * 30 * sc, cy + uy * 30 * sc; h = 58 * sc
            return c.crop((int(bx - h), int(by - h * .62), int(bx + h), int(by + h * .62))).resize((330, int(330 * .62)), Image.NEAREST)
        pick = [0, 90, 180, 315]; tiles = []
        g0 = [r for r in V[A_.after]['scenes']['rotation'] if r['heading'] == 180][0]; j0 = [q for q in g0['jobs'] if q['dominant']][0]; guide = j0['start'] + j0['ext']
        for var, tag in ((A_.before, 'BEFORE'), (A_.after, 'AFTER')):
            for r in V[var]['scenes']['rotation']:
                if r['heading'] in pick and r.get('profile'):
                    j = [q for q in r['jobs'] if q['dominant']][0]
                    tiles.append((castview(var, r, guide), f'{tag}, turned {r["heading"]} deg: tip {j["start"] + j["ext"]:.1f} px'))
        OUT['sheetCast'] = sheet(tiles, 4, "HQ4 fix B - the Wanderer's floor shadow under one fixed light as she turns",
                                 'The shadow alone (actor effects off minus on, x4). Light at the left, body never moves. Blue line: where the tip is with the body alone; red ring: where BR-RoLE put it.',
                                 os.path.join(A_.sheets, 'cast_rotation.png'))

s = json.dumps(OUT, indent=1)
if A_.out:
    with open(A_.out, 'w') as f: f.write(s + '\n')
print(s[:6000])
