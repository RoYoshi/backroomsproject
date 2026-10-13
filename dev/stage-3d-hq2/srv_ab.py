#!/usr/bin/env python3
"""Stage 3D HQ2 - the server's cost, HQ2 against HQ1, judged by the gates frozen at H2-0 (development only)

  python3 -I dev/stage-3d-hq2/srv_ab.py --dir DIR --gates dev/stage-3d-hq2/evidence/h2-0/aa/perf_gates.json --out FILE.json

DIR holds interleaved pairs from srv_load.js: srv_<layout>_hq1_<i>.json (an export of the accepted parent) and srv_<layout>_hq2_<i>.json
(the tree under test), run one after the other with nothing else running.  For each layout and each pair: the change in the server's
CPU seconds (%), in the 60 Hz step's mean (%) and in the admin ping's p99 (ms).  A gate is met when the MEAN change over the pairs is
within the H2-0 gate (perf_gates.json: server.<layout>.gate); every pair's change is reported too.  Also reported, not gated: the
corrections the players got and the smallest distance between two players at the end (the crowd's RED was 0 on HQ1).
Exit 0 only if every gate is met."""
import argparse, glob, json, os, statistics, sys

ap = argparse.ArgumentParser(); ap.add_argument('--dir', required=True); ap.add_argument('--gates', required=True); ap.add_argument('--out', required=True)
A = ap.parse_args()
G = json.load(open(A.gates))['server']
R = {'tool': 'dev/stage-3d-hq2/srv_ab.py', 'gatesFrom': A.gates, 'layouts': {}}
ok_all = True
for lay in ('spread', 'crowd'):
    pairs = []
    for f1 in sorted(glob.glob(os.path.join(A.dir, f'srv_{lay}_hq1_*.json'))):
        f2 = f1.replace(f'srv_{lay}_hq1_', f'srv_{lay}_hq2_')
        if not os.path.exists(f2): continue
        a, b = json.load(open(f1)), json.load(open(f2))
        sa, sb = a['server'], b['server']
        corr = lambda r: sum(len(p['corrections']) if isinstance(p['corrections'], list) else (p['corrections'] or 0) for p in r['players'])
        pairs.append({'pair': os.path.basename(f1).split('_')[-1].replace('.json', ''),
                      'hq1': {'cpuSec': sa['cpuSec'], 'stepMsMean': sa['stepMsMean'], 'pingP99': sa['pingMs']['p99'], 'corrections': corr(a), 'minSeparationAtEnd': a['final']['minSeparation'], 'errors': sa.get('errors')},
                      'hq2': {'cpuSec': sb['cpuSec'], 'stepMsMean': sb['stepMsMean'], 'pingP99': sb['pingMs']['p99'], 'corrections': corr(b), 'minSeparationAtEnd': b['final']['minSeparation'], 'errors': sb.get('errors')},
                      'cpuPct': round((sb['cpuSec'] - sa['cpuSec']) / sa['cpuSec'] * 100, 1),
                      'stepPct': round((sb['stepMsMean'] - sa['stepMsMean']) / sa['stepMsMean'] * 100, 1),
                      'pingP99Ms': round(sb['pingMs']['p99'] - sa['pingMs']['p99'], 2)})
    g = G[lay]['gate']
    if not pairs:
        R['layouts'][lay] = {'pairs': [], 'ok': False, 'why': 'no pairs'}; ok_all = False; continue
    m = {k: round(statistics.mean(p[k] for p in pairs), 2) for k in ('cpuPct', 'stepPct', 'pingP99Ms')}
    verdict = {'cpu': m['cpuPct'] <= g['cpuPct'], 'stepMean': m['stepPct'] <= g['stepMeanPct'], 'pingP99': m['pingP99Ms'] <= g['pingP99Ms']}
    ok = all(verdict.values()) and len(pairs) >= 2
    ok_all = ok_all and ok
    R['layouts'][lay] = {'pairs': pairs, 'meanChange': m, 'gate': g, 'met': verdict, 'ok': ok, 'hq1Reference': G[lay]['hq1']}
R['ok'] = ok_all
json.dump(R, open(A.out, 'w'), indent=1)
for lay, v in R['layouts'].items():
    if not v.get('pairs'): print(lay, 'NO PAIRS'); continue
    print(f"{lay}: pairs {[(p['cpuPct'], p['stepPct'], p['pingP99Ms']) for p in v['pairs']]}  mean cpu {v['meanChange']['cpuPct']:+.1f} % (gate +{v['gate']['cpuPct']} %), "
          f"step {v['meanChange']['stepPct']:+.1f} % (gate +{v['gate']['stepMeanPct']} %), ping p99 {v['meanChange']['pingP99Ms']:+.2f} ms (gate +{v['gate']['pingP99Ms']} ms)  "
          f"min separation at end hq1 {[p['hq1']['minSeparationAtEnd'] for p in v['pairs']]} hq2 {[p['hq2']['minSeparationAtEnd'] for p in v['pairs']]}  {'MET' if v['ok'] else 'NOT MET'}")
sys.exit(0 if ok_all else 1)
