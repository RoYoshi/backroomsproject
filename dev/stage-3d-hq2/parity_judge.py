#!/usr/bin/env python3
"""Stage 3D HQ2 - judge dev/stage-3d/parity3d.py's numbers (that tool reports, it does not gate) against HQ1's own (development only)

  python3 -I dev/stage-3d-hq2/parity_judge.py --run FILE.json --ref dev/stage-3d-hq1/evidence/hq1-3/parity.json --out FILE.json

For every death in --run: the victim's own corpse and the spectator's replay against the server's corpse (parity3d's compare3d): the body,
the light, the hat and the hands within 1 px, the turn within 0.01 rad, the same number of blood marks with the same seeds, every mark
within 1 px.  HQ1's numbers for the same death (--ref) are listed beside them.  Exit 0 only if every death of --run is within them."""
import argparse, json, sys

ap = argparse.ArgumentParser(); ap.add_argument('--run', required=True); ap.add_argument('--ref', required=True); ap.add_argument('--out', required=True)
A = ap.parse_args()
run, ref = json.load(open(A.run)), json.load(open(A.ref))
refBy = {r['v']: r for r in ref.get('compare3d', [])}
R = {'tool': 'dev/stage-3d-hq2/parity_judge.py', 'run': A.run, 'ref': A.ref, 'deaths': [], 'limits': {'px': 1.0, 'turn': .01}}
ok = bool(run.get('compare3d'))


def judge(c):
    if not c: return False, ['missing']
    bad = [k for k in ('body', 'light', 'hat', 'hands') if c.get(k) is None or c[k] > 1.0]
    if c.get('turn') is None or c['turn'] > .01: bad.append('turn')
    b = c.get('blood') or {}
    if not b.get('counts') or b['counts'][0] != b['counts'][1]: bad.append('blood count')
    if not b.get('seedsSame'): bad.append('blood seeds')
    if b.get('maxPx') is None or b['maxPx'] > 1.0: bad.append('blood position')
    return not bad, bad


for d in run.get('compare3d', []):
    vo, vb = judge(d.get('victimVsServer')); so, sb = judge(d.get('spectatorVsServer'))
    row = {'v': d['v'], 'victimVsServer': d.get('victimVsServer'), 'spectatorVsServer': d.get('spectatorVsServer'), 'victimOk': vo, 'victimBad': vb, 'spectatorOk': so, 'spectatorBad': sb,
           'hq1': {k: refBy.get(d['v'], {}).get(k) for k in ('victimVsServer', 'spectatorVsServer')}}
    R['deaths'].append(row); ok = ok and vo and so
    print(('OK   ' if vo and so else 'FAIL ') + f"{d['v']}: victim {'ok' if vo else vb}, spectator {'ok' if so else sb}  (spectator light {(d.get('spectatorVsServer') or {}).get('light')} px, blood {((d.get('spectatorVsServer') or {}).get('blood') or {}).get('counts')}; HQ1: {((refBy.get(d['v']) or {}).get('spectatorVsServer') or {}).get('light')} px, {(((refBy.get(d['v']) or {}).get('spectatorVsServer') or {}).get('blood') or {}).get('counts')})")
R['ok'] = ok
json.dump(R, open(A.out, 'w'), indent=1)
print('PARITY: every death within 1 px of the server\'s corpse on the victim\'s and the spectator\'s screen' if ok else 'PARITY: NOT within the limits')
sys.exit(0 if ok else 1)
