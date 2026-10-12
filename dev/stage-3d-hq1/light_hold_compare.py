#!/usr/bin/env python3
"""Stage 3D HQ1 - during its hold, a dead light is exactly D7's light (development only; gate L5's hold part)

  python3 -I dev/stage-3d-hq1/light_hold_compare.py HQ1.json D7.json [--out FILE.json]

Both are light_timeline.py runs of the same death (Hound A, open room, flashlight on, blackout): HQ1.json on the HQ1 tree, D7.json on an
export of the D7 parent.  The corpse lies where the server's physics put it in both, and the spectator and the late joiner look at it
from the same spot, so the same light is compared: HQ1's frozen light clock at release + 0.5 s (its hold) against D7's corpse light in
real time (D7's never fails).  On each screen: BR-RoLE's own probe of the light 40 px in front of the lens, the light its buffer holds
there, and the screen's brightness there.  Gate L5: within 10 % of D7 (an absolute 0.02 below 0.2).  Also listed, not gated: the
in-death pictures at release + 1 s (the Death Lab paused at release + 0.3 s: the tumbling light is caught a frame apart in two runs)."""
import json, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
if out in args: args.remove(out)
H, D = [json.load(open(a)) for a in args[:2]]


def near(a, b):
    if a is None or b is None: return a == b
    return abs(a - b) <= max(.02, .1 * abs(b))


MEAS = (('BR-RoLE probe', lambda s: (s.get('br') or {}).get('total')), ('BR-RoLE buffer', lambda s: s.get('buffer')), ('screen brightness / 255', lambda s: None if s.get('lum') is None else round(s['lum'] / 255, 4)))
rows, info, ok = [], [], True
k05 = [r for r in H['frozen']['corpse']['rows'] if abs(r['k'] - .5) < 1e-6][0]
for who in ('spectator', 'late'):
    h, d = k05[who], D['realtime']['corpse'][who]
    for k, f in MEAS:
        a, b = f(h), f(d); good = a is not None and near(a, b); ok = ok and good
        rows.append({'screen': who, 'what': 'corpse light (HQ1 frozen at release + 0.5 s; D7 real time)', 'measure': k, 'hq1': a, 'd7': b, 'within10pct': good})
for who in ('victim', 'spectator'):
    h, d = H['realtime']['lit'][who], D['realtime']['lit'][who]
    for k, f in MEAS:
        a, b = f(h), f(d); info.append({'screen': who, 'what': 'in the death, release + 1 s (not gated)', 'measure': k, 'hq1': a, 'd7': b, 'within10pct': near(a, b)})
R = {'tool': 'dev/stage-3d-hq1/light_hold_compare.py', 'hq1': args[0], 'd7': args[1], 'rows': rows, 'info': info, 'ok': ok}
for r in rows: print(('PASS ' if r['within10pct'] else 'FAIL ') + f"{r['screen']:9s} {r['measure']:24s} HQ1 {r['hq1']}  D7 {r['d7']}")
for r in info: print('info ' + f"{r['screen']:9s} {r['measure']:24s} HQ1 {r['hq1']}  D7 {r['d7']}")
if out:
    with open(out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
sys.exit(0 if ok else 1)
