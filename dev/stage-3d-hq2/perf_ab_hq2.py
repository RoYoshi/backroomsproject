#!/usr/bin/env python3
"""Stage 3D HQ2 - the browser's frame time, HQ2 against HQ1, judged by the gates frozen at H2-0 (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/perf_ab_hq2.py --dir DIR --gates dev/stage-3d-hq2/evidence/h2-0/aa/perf_gates.json --out FILE.json

DIR holds interleaved pairs from dev/stage-3d/perf_death.py (--rounds 2 --only idle,houndA,houndC): hq1_<i>.json (an export of the
accepted parent) and hq2_<i>.json (the tree under test), run one after the other with nothing else running; and, if present,
corpses_hq1_<i>.json / corpses_hq2_<i>.json (--only corpses).
  frame time (H2-0's formula, aa_gates.py): per window and page each run's worst round; per pair the change of HQ2 against HQ1; the
    gate is met when the MEAN change over the pairs (at least three) is within the H2-0 gate for that window, page and statistic
    (browser.<window>.<page>.frameMedianMs / frameP95Ms .gatePct)
  twenty corpses (HQ1's R4): on screen and off screen, each page's frame median, mean change over the pairs <= +10 %
Exit 0 only if every gate is met."""
import argparse, glob, json, os, statistics, sys

ap = argparse.ArgumentParser(); ap.add_argument('--dir', required=True); ap.add_argument('--gates', required=True); ap.add_argument('--out', required=True)
A = ap.parse_args()
G = json.load(open(A.gates))['browser']
j = lambda p: json.load(open(os.path.join(A.dir, p)))


def worst(run, w, page, key):
    vals = [r[w][page].get(key) for r in run['rounds'] if w in r and r[w][page].get(key) is not None]
    return max(vals) if vals else None


R = {'tool': 'dev/stage-3d-hq2/perf_ab_hq2.py', 'gatesFrom': A.gates, 'frame': {}, 'corpses20': {}}
pairs = sorted({int(os.path.basename(p)[4:-5]) for p in glob.glob(os.path.join(A.dir, 'hq1_*.json')) if os.path.exists(p.replace('hq1_', 'hq2_'))})
R['pairs'] = pairs; ok = len(pairs) >= 3
for w, pages in G.items():
    for page, stats in pages.items():
        pi = 0 if page == 'victim' else 1
        for key, g in stats.items():
            ch, rows = [], []
            for i in pairs:
                a, b = worst(j(f'hq1_{i}.json'), w, pi, key), worst(j(f'hq2_{i}.json'), w, pi, key)
                if a and b: ch.append((b - a) / a * 100); rows.append([a, b])
            if not ch: continue
            m = statistics.mean(ch); met = m <= g['gatePct']
            ok = ok and met
            R['frame'].setdefault(w, {}).setdefault(page, {})[key] = {'pairs': rows, 'changesPct': [round(c, 1) for c in ch], 'meanPct': round(m, 1), 'gatePct': g['gatePct'], 'met': met}
cp = sorted({int(os.path.basename(p)[12:-5]) for p in glob.glob(os.path.join(A.dir, 'corpses_hq1_*.json')) if os.path.exists(p.replace('corpses_hq1_', 'corpses_hq2_'))})
for w in ('corpses20_onscreen', 'corpses20_offscreen'):
    for pi, page in enumerate(('alice', 'bob')):
        ch, rows = [], []
        for i in cp:
            a, b = worst(j(f'corpses_hq1_{i}.json'), w, pi, 'frameMedianMs'), worst(j(f'corpses_hq2_{i}.json'), w, pi, 'frameMedianMs')
            if a and b: ch.append((b - a) / a * 100); rows.append([a, b])
        if not ch: continue
        m = statistics.mean(ch); met = m <= 10; ok = ok and met
        R['corpses20'].setdefault(w, {})[page] = {'pairs': rows, 'changesPct': [round(c, 1) for c in ch], 'meanPct': round(m, 1), 'gatePct': 10, 'met': met}
R['corpsePairs'] = cp; R['ok'] = ok
json.dump(R, open(A.out, 'w'), indent=1)
for w, pages in R['frame'].items():
    for page, stats in pages.items():
        for key, v in stats.items(): print(f"{'MET    ' if v['met'] else 'NOT MET'} {w} {page} {key}: mean {v['meanPct']:+.1f} % (gate +{v['gatePct']} %) pairs {v['changesPct']}")
for w, pages in R['corpses20'].items():
    for page, v in pages.items(): print(f"{'MET    ' if v['met'] else 'NOT MET'} {w} {page} frameMedianMs: mean {v['meanPct']:+.1f} % (gate +10 %) pairs {v['changesPct']}")
print('pairs', pairs, 'corpse pairs', cp, 'ALL MET' if ok else 'NOT ALL MET')
sys.exit(0 if ok else 1)
