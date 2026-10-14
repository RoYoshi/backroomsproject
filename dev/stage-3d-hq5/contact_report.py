#!/usr/bin/env python3
"""Stage 3D HQ5 - compare contact_lab.py's results between HQ4 and HQ5 and make the labelled sheets (development only)

  python3 -I dev/stage-3d-hq5/contact_report.py --lab DIR [--base hq4] [--var hq5] --out DIR

Per frozen capture, pixels that changed between the variants, by distance from her body's centre in world px (the page's zoom):
  body   < 16   (her body inside its outline: must not change)
  edge   16-19  (the outline and the floor at it)
  contact 19-31 (her contact's reach: 18 + 9 px + a 3 px nudge + 1)
  outside >= 31 (must not change, but for HQ5's lamp hole in the core buffer: a level of rounding)
and, in HQ5's own page, the same frame with the contact off (DEV gain 0) against HQ4 (must be identical).  The light in the buffer
round her (the lab's ring): what the contact took, per light and per scene.  Her cast and self-shading jobs: HQ5's must equal
HQ4's (the contact's own fields aside).  Writes DIR/report.json and the sheets (HQ4 | HQ5 | difference x8)."""
import os, sys, json, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser(); ap.add_argument('--lab', required=True); ap.add_argument('--base', default='hq4'); ap.add_argument('--var', default='hq5'); ap.add_argument('--out', required=True)
A_ = ap.parse_args(); os.makedirs(A_.out, exist_ok=True)
BD, VD = os.path.join(A_.lab, A_.base), os.path.join(A_.lab, A_.var)
RA, RB = json.load(open(os.path.join(BD, 'result.json'))), json.load(open(os.path.join(VD, 'result.json')))
ZONES = (('body', 0, 16), ('edge', 16, 19), ('contact', 19, 31), ('outside', 31, 1e9))
CONTACT_KEYS = ('contact', 'cofs')
try: FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except OSError: FONT = ImageFont.load_default()


def img(d, f): return np.asarray(Image.open(os.path.join(d, f)).convert('RGB')).astype(int)


def zones(a, b, shot, zoom):
    d = np.abs(a - b).max(axis=2); h, w = d.shape; cx = shot['centre'][0] - shot['clip']['x']; cy = shot['centre'][1] - shot['clip']['y']
    yy, xx = np.mgrid[0:h, 0:w]; r = np.hypot(xx + .5 - cx, yy + .5 - cy) / zoom
    return {n: {'changed': int((d[(r >= lo) & (r < hi)] > 0).sum()), 'max': int(d[(r >= lo) & (r < hi)].max()) if ((r >= lo) & (r < hi)).any() else 0} for n, lo, hi in ZONES}


def ring_drop(ra, rb):
    """what the contact took from the buffer, by radius: the largest and the mean drop over the 24 angles"""
    out = {}
    for rad, x, y in zip(ra['radii'], ra['light'], rb['light']):
        dd = [(p or 0) - (q or 0) for p, q in zip(x, y)]; out[rad] = {'max': round(max(dd), 4), 'mean': round(sum(dd) / len(dd), 4), 'min': round(min(dd), 4)}
    return out


def strip(jobs):
    """a job without the contact's own fields, numbers to 3 decimals (an eased weight settles over frames: 1e-4 between runs)"""
    r4 = lambda v: round(v, 3) if isinstance(v, float) else [r4(x) for x in v] if isinstance(v, list) else v
    return [{k: r4(v) for k, v in j.items() if k not in CONTACT_KEYS} for j in (jobs or [])]


def compare(tag, ca, cb):
    """one capture pair: pixel zones, the in-page contact-off A/B, jobs, ring"""
    z = cb.get('zoom') or 1
    r = {'tag': tag, 'zoom': z, 'zones': zones(img(BD, ca['shot']['file']), img(VD, cb['shot']['file']), cb['shot'], z),
         'jobsEqual': strip(ca.get('jobs')) == strip(cb.get('jobs')), 'contacts': cb.get('contacts'), 'ringDrop': ring_drop(ca['ring'], cb['ring'])}
    if cb.get('off'):
        off = img(VD, cb['off']['shot']['file']); r['inPage'] = zones(off, img(VD, cb['shot']['file']), cb['shot'], z)   # HQ5's own frame, contact off vs on
        r['contactOffEqualsHq4'] = int((np.abs(off - img(BD, ca['shot']['file'])).max(axis=2) > 0).sum()) == 0
        r['contactOffRingEqualsHq4'] = cb['off']['ring']['light'] == ca['ring']['light']; r['contactOffJobsEqual'] = strip(cb['off'].get('jobs')) == strip(ca.get('jobs'))
    return r


def sheet(pairs, path, title, half=60, s=3, caps=('HQ4', 'HQ5'), dirs=None):
    """rows of HQ4 | HQ5 | |difference| x8 (each crop +-half px round her, scaled s x, nearest); dirs/caps: other pairs (HQ5 contact off | on)"""
    cw = 2 * half * s; rows = []; da, db = dirs or (BD, VD)
    for label, fa, fb, shot in pairs:
        a, b = Image.open(os.path.join(da, fa)).convert('RGB'), Image.open(os.path.join(db, fb)).convert('RGB')
        cx = shot['centre'][0] - shot['clip']['x']; cy = shot['centre'][1] - shot['clip']['y']; box = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
        d = Image.fromarray(np.clip(np.abs(np.asarray(a).astype(int) - np.asarray(b).astype(int)).max(axis=2) * 8, 0, 255).astype('uint8')).convert('RGB')
        row = Image.new('RGB', (3 * cw + 40, cw + 24), (24, 24, 24)); dr = ImageDraw.Draw(row)
        for i, (im, cap) in enumerate(((a, caps[0]), (b, caps[1]), (d, 'difference x8'))):
            row.paste(im.crop(box).resize((cw, cw), Image.NEAREST), (10 + i * (cw + 10), 22)); dr.text((10 + i * (cw + 10), 4), f'{label}: {cap}', fill=(235, 235, 235), font=FONT)
        rows.append(row)
    out = Image.new('RGB', (rows[0].width, sum(r.height for r in rows) + 26), (24, 24, 24)); ImageDraw.Draw(out).text((10, 6), title, fill=(255, 255, 255), font=FONT); y = 26
    for r in rows: out.paste(r, (0, y)); y += r.height
    out.save(path)


R = {'base': A_.base, 'var': A_.var, 'versions': [RA.get('version'), RB.get('version')], 'pageErrors': [RA.get('pageErrors'), RB.get('pageErrors')],
     'brRoleErrors': [RA.get('brRoleErrors'), RB.get('brRoleErrors')], 'spot': RB.get('spot'), 'scenes': {}}
SA, SB = RA['scenes'], RB['scenes']
if 'geometry' in SB:
    G = []
    for ga, gb in zip(SA['geometry'], SB['geometry']):
        c = compare(f"geo_{gb['heading']:03d}", ga, gb); c['heading'] = gb['heading']
        sw = []
        for sa, sb in zip(ga['swing'], gb['swing']):
            sw.append({'dy': sb['dy'], 'jobsEqual': strip(sa['jobs']) == strip(sb['jobs']), 'contacts': sb['contacts'], 'ringDrop': ring_drop(sa['ring'], sb['ring'])})
        c['swing'] = sw
        c['contactWorld'] = [(j['x'], j['y']) for j in (gb['contacts'] or [])]
        if gb.get('diagnostic'): c['diagnostic'] = gb['diagnostic']
        G.append(c)
    R['scenes']['geometry'] = G
    sheet([(f"{g['heading']} deg", f"geo_{g['heading']:03d}.png", f"geo_{g['heading']:03d}.png", g['shot']) for g in SB['geometry']]
          + [(f"swing {s['dy'][0]:+d}", f"geo_000_swing_{s['dy'][0]:+d}.png", f"geo_000_swing_{s['dy'][0]:+d}.png", SB['geometry'][0]['shot']) for s in SB['geometry'][0]['swing']],
          os.path.join(A_.out, 'sheet_geometry.png'), 'One fixture 100 px away, her own light off, MEDIUM: four headings, then the hands at a walk\'s swing extremes (0 deg)')
if 'under' in SB and SB['under'].get('caps'):
    U = [compare(f"under_{cb['heading']:03d}", ca, cb) for ca, cb in zip(SA['under']['caps'], SB['under']['caps'])]
    pe = SB['under'].get('patchExactness'); px = None
    if pe:
        g0 = np.array([v or 0 for v in pe['0']['light']]); g1 = np.array([v or 0 for v in pe['0.0001']['light']]); gf = np.array([v or 0 for v in pe['1']['light']])
        px = {'maxLevels': int(round(float(np.abs(g0 - g1).max()) * 255)), 'differing': int((np.abs(g0 - g1) > 1e-6).sum()), 'points': len(g0), 'contactMaxTaken': round(float((g0 - gf).max()), 4)}
    R['scenes']['under'] = {'spot': SB['under'].get('spot'), 'caps': U, 'patchExactness': px}
    sheet([(f"under {c['heading']} deg", f"under_{c['heading']:03d}.png", f"under_{c['heading']:03d}.png", c['shot']) for c in SB['under']['caps']],
          os.path.join(A_.out, 'sheet_under_lamp.png'), 'Right under the fixture (HQ4 draws no shadow for her here), her own light off, MEDIUM')
if 'lights' in SB:
    L = {'pair': SB['lights'].get('pair'), 'blackoutState': [SA['lights'].get('blackoutState'), SB['lights'].get('blackoutState')]}
    for k in ('first', 'second', 'both', 'allFixtures', 'blackout'):
        if k in SB['lights']: L[k] = compare('lights_' + k, SA['lights'][k], SB['lights'][k])
    if 'blackout' in SB['lights']: L['blackoutMaxLight'] = max(max((v or 0) for v in row) for row in SB['lights']['blackout']['ring']['light'])
    R['scenes']['lights'] = L
    pairs = [(k, f'lights_{k}.png', f'lights_{k}.png', SB['lights'][k]['shot']) for k in ('first', 'second', 'both', 'allFixtures', 'blackout') if k in SB['lights']]
    pairs = [(n.replace('allFixtures', 'every fixture').replace('first', 'fixture A alone').replace('second', 'fixture B alone').replace('both', 'A and B'), f.replace('allFixtures', 'all'), g.replace('allFixtures', 'all'), s) for n, f, g, s in pairs]
    sheet(pairs, os.path.join(A_.out, 'sheet_lights.png'), 'Two overlapping fixtures (each alone, then both), every fixture, then the admin BLACKOUT')
if 'carried' in SB:
    C = {'bob': [compare(f"carried_bob_{i}", a, b) | {'bobAt': b['bob']} for i, (a, b) in enumerate(zip(SA['carried']['bob'], SB['carried']['bob']))]}
    if 'own' in SB['carried']: C['own'] = compare('carried_own', SA['carried']['own'], SB['carried']['own'])
    R['scenes']['carried'] = C
    sheet([(f"Bob's flashlight {['from the far side', 'from the lamp side'][i]}", f"carried_bob_{r:03d}_contact_off.png", f"carried_bob_{r:03d}.png", SB['carried']['bob'][i]['shot']) for i, r in enumerate((0, 180))]
          + [('her own light only', 'carried_own_contact_off.png', 'carried_own.png', SB['carried']['own']['shot'])], os.path.join(A_.out, 'sheet_carried.png'),
          'No fixture: a peer\'s flashlight from two sides, then her own light only (it casts nothing of hers: kept). HQ5\'s own held frame, contact off and on',
          caps=('HQ5 contact off', 'HQ5'), dirs=(VD, VD))
if 'peers' in SB:
    P = {}
    for k in ('visible', 'hidden'):
        if k in SB['peers']:
            a, b = SA['peers'][k], SB['peers'][k]
            P[k] = {'bob': b['bob'], 'castJobsHq4': len(a['jobs']), 'castJobsHq5': len(b['jobs']), 'jobsEqual': strip(a['jobs']) == strip(b['jobs']),
                    'contactsForOthers': [c for c in (b['contacts'] or []) if not c['self']], 'contactsForHer': [c for c in (b['contacts'] or []) if c['self']],
                    'pixelsChangedInPage': int((np.abs(img(VD, b['off']['shot']['file']) - img(VD, b['shot']['file'])).max(axis=2) > 0).sum()) if b.get('off') else None}
    R['scenes']['peers'] = P
if 'tiers' in SB:
    T = []
    for a, b in zip(SA['tiers'], SB['tiers']):
        c = compare('tier_' + b['quality'], a, b); c['quality'] = b['quality']; c['buffer'] = b['buffer']; T.append(c)
    R['scenes']['tiers'] = T
    sheet([(t['quality'].upper(), f"tier_{t['quality']}.png", f"tier_{t['quality']}.png", t['shot']) for t in SB['tiers']], os.path.join(A_.out, 'sheet_tiers.png'), 'LOW, MEDIUM, HIGH: the same spot and heading')
with open(os.path.join(A_.out, 'report.json'), 'w') as f: json.dump(R, f, indent=1); f.write('\n')


def line(c):
    z = c.get('inPage') if c['tag'].startswith('carried') and c.get('inPage') else c['zones']; return ('(in page) ' if z is not c['zones'] else '') + ' '.join(f"{k} {z[k]['changed']}/{z[k]['max']}" for k in ('body', 'edge', 'contact', 'outside')) + \
        (f"  off==HQ4 {c.get('contactOffEqualsHq4')}" if 'contactOffEqualsHq4' in c else '') + f"  jobs== {c['jobsEqual']}  contacts {len(c['contacts'] or [])}"


for k, v in R['scenes'].items():
    if isinstance(v, list):
        for c in v: print(k, c['tag'], line(c))
    elif k == 'under':
        for c in v['caps']: print(k, c['tag'], line(c))
        print('under patch exactness', v['patchExactness'])
    elif k in ('lights', 'carried'):
        for kk, c in v.items():
            if isinstance(c, dict) and 'zones' in c: print(k, kk, line(c))
            elif isinstance(c, list) and c and isinstance(c[0], dict):
                for cc in c: print(k, kk, line(cc))
        if k == 'lights': print('blackout', v.get('blackoutState'), 'max light', v.get('blackoutMaxLight'))
    else: print(k, json.dumps(v)[:600])
