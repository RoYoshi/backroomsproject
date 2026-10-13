#!/usr/bin/env python3
"""Stage 3D HQ2 - the performance gates, frozen at H2-0 from an A/A run on the accepted HQ1 parent (development only)

  python3 -I dev/stage-3d-hq2/aa_gates.py DIR --out FILE.json [--md]

DIR holds the H2-0 A/A run: perf_a_<i>.json / perf_b_<i>.json (dev/stage-3d/perf_death.py on two exports of the same commit, interleaved),
srv_<layout>_a_<i>.json / srv_<layout>_b_<i>.json (srv_load.js), traffic8_a.json / traffic8_b.json (dev/stage-3d-hq1/traffic8.js).

The formulas were fixed before the numbers were read (STAGE_3D_HQ2_AUDIT.md section 5):
  browser frame time, per window and page: each run's worst round (as dev/stage-3d/perf_compare.py); per pair the change b against a;
    the A/A noise N = the largest |change| over the pairs.  Gate for HQ2 against HQ1 (the same harness, >= 3 interleaved pairs, the mean
    of the pairs' changes): median <= +max(7 %, 1.5 N), at most +15 %; p95 <= +max(10 %, 1.5 N95), at most +20 %.
  server (srv_load.js): CPU seconds over the window, the 60 Hz step's mean, the admin ping's p99.  Gate: CPU <= +max(10 %, 1.5 N) for
    `spread`, +max(15 %, 1.5 N) for `crowd` (HQ2 sweeps every packet against the peers there); step mean <= +max(10 %, 1.5 N);
    ping p99 <= +max(5 ms, 1.5 N ms).
  network (traffic8.js): bytes per second per client <= +max(3 %, 1.5 N).
A gate is exceeded when HQ2's measurement is outside it; the report names it, nothing is moved."""
import json, sys, os, glob, statistics

D = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
j = lambda p: json.load(open(os.path.join(D, p)))
WINS = ['idle', 'death_houndA', 'death_houndC', 'whole_houndC', 'whole_houndA']


def worst(run, w, page, key):
    vals = [r[w][page].get(key) for r in run['rounds'] if w in r and r[w][page].get(key) is not None]
    return max(vals) if vals else None


pairs = sorted({int(os.path.basename(p)[7:-5]) for p in glob.glob(os.path.join(D, 'perf_a_*.json'))})
G = {'source': D, 'pairs': pairs, 'browser': {}, 'server': {}, 'network': {}}
for w in WINS:
    for pi, page in enumerate(('victim', 'spectator')):
        for key, floor, cap in (('frameMedianMs', 7, 15), ('frameP95Ms', 10, 20)):
            ch, rows = [], []
            for i in pairs:
                try: a, b = worst(j(f'perf_a_{i}.json'), w, pi, key), worst(j(f'perf_b_{i}.json'), w, pi, key)
                except (FileNotFoundError, KeyError): continue
                if a and b: ch.append((b - a) / a * 100); rows.append([a, b])
            if not ch: continue
            N = max(abs(c) for c in ch)
            G['browser'].setdefault(w, {}).setdefault(page, {})[key] = {'aaPairs': rows, 'aaChangesPct': [round(c, 1) for c in ch], 'noisePct': round(N, 1),
                                                                       'gatePct': round(min(cap, max(floor, 1.5 * N)), 1)}
for lay, floor in (('spread', 10), ('crowd', 15)):
    runs = sorted(glob.glob(os.path.join(D, f'srv_{lay}_a_*.json')))
    cpu, step, p99, raw = [], [], [], []
    for fa in runs:
        fb = fa.replace(f'srv_{lay}_a_', f'srv_{lay}_b_')
        if not os.path.exists(fb): continue
        a, b = json.load(open(fa))['server'], json.load(open(fb))['server']; raw.append({'a': a, 'b': b})
        if a['cpuSec'] and b['cpuSec']: cpu.append((b['cpuSec'] - a['cpuSec']) / a['cpuSec'] * 100)
        if a['stepMsMean'] and b['stepMsMean']: step.append((b['stepMsMean'] - a['stepMsMean']) / a['stepMsMean'] * 100)
        if a['pingMs']['p99'] is not None and b['pingMs']['p99'] is not None: p99.append(b['pingMs']['p99'] - a['pingMs']['p99'])
    if not raw: continue
    Nc, Ns, Np = max(abs(x) for x in cpu), max(abs(x) for x in step), max(abs(x) for x in p99)
    G['server'][lay] = {'aa': raw, 'cpuChangesPct': [round(x, 1) for x in cpu], 'stepChangesPct': [round(x, 1) for x in step], 'pingP99ChangesMs': [round(x, 2) for x in p99],
                        'gate': {'cpuPct': round(max(floor, 1.5 * Nc), 1), 'stepMeanPct': round(max(10, 1.5 * Ns), 1), 'pingP99Ms': round(max(5, 1.5 * Np), 1)},
                        'hq1': {'cpuSec': round(statistics.mean([r['a']['cpuSec'] for r in raw] + [r['b']['cpuSec'] for r in raw]), 2),
                                'stepMsMean': round(statistics.mean([r['a']['stepMsMean'] for r in raw] + [r['b']['stepMsMean'] for r in raw]), 4),
                                'pingP99': round(statistics.mean([r['a']['pingMs']['p99'] for r in raw] + [r['b']['pingMs']['p99'] for r in raw]), 2)}}
try:
    ta, tb = j('traffic8_a.json')['summary'], j('traffic8_b.json')['summary']
    n = abs(tb['bytesPerSecPerClient']['mean'] - ta['bytesPerSecPerClient']['mean']) / ta['bytesPerSecPerClient']['mean'] * 100
    G['network'] = {'aa': [ta, tb], 'noisePct': round(n, 2), 'gatePct': round(max(3, 1.5 * n), 2), 'hq1BytesPerSecPerClient': round((ta['bytesPerSecPerClient']['mean'] + tb['bytesPerSecPerClient']['mean']) / 2)}
except FileNotFoundError: pass
s = json.dumps(G, indent=1)
if out:
    with open(out, 'w') as f: f.write(s + '\n')
if '--md' in sys.argv:
    print('| measure | A/A changes (b against a) | noise | gate for HQ2 against HQ1 |'); print('|---|---|---|---|')
    for w, pages in G['browser'].items():
        for page, keys in pages.items():
            for key, v in keys.items():
                print(f"| {w} {page} {'median' if key == 'frameMedianMs' else 'p95'} | {', '.join(f'{c:+.1f} %' for c in v['aaChangesPct'])} | {v['noisePct']} % | ≤ +{v['gatePct']} % |")
    for lay, v in G['server'].items():
        print(f"| server {lay}: CPU | {', '.join(f'{c:+.1f} %' for c in v['cpuChangesPct'])} | | ≤ +{v['gate']['cpuPct']} % (HQ1 {v['hq1']['cpuSec']} s per 45 s) |")
        print(f"| server {lay}: 60 Hz step mean | {', '.join(f'{c:+.1f} %' for c in v['stepChangesPct'])} | | ≤ +{v['gate']['stepMeanPct']} % (HQ1 {v['hq1']['stepMsMean']} ms) |")
        print(f"| server {lay}: ping p99 | {', '.join(f'{c:+.2f} ms' for c in v['pingP99ChangesMs'])} | | ≤ +{v['gate']['pingP99Ms']} ms (HQ1 {v['hq1']['pingP99']} ms) |")
    if G['network']: print(f"| network: bytes/s per client, 8 players | {G['network']['noisePct']} % | | ≤ +{G['network']['gatePct']} % (HQ1 {G['network']['hq1BytesPerSecPerClient']} B/s) |")
else:
    print(s[:3000])
