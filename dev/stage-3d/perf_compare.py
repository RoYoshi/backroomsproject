#!/usr/bin/env python3
"""Stage 3D - two perf_death.py results side by side (development only; SwiftShader, same machine).

  python3 dev/stage-3d/perf_compare.py BEFORE.json AFTER.json [--md]

Per window and page (victim / spectator): the frame-time median and fps of every round, then the worst round's median before and after
and the change.  --md prints a Markdown table."""
import json, sys

a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])); md = '--md' in sys.argv
wins = [k for k in a['rounds'][0] if k in b['rounds'][0]]
rows = []
for w in wins:
    for i, who in enumerate(('victim', 'spectator')):
        fa = [r[w][i]['frameMedianMs'] for r in a['rounds'] if w in r]; fb = [r[w][i]['frameMedianMs'] for r in b['rounds'] if w in r]
        pa = [r[w][i]['fps'] for r in a['rounds'] if w in r]; pb = [r[w][i]['fps'] for r in b['rounds'] if w in r]
        ma, mb = max(fa), max(fb); rows.append((w, who, fa, fb, pa, pb, ma, mb, round((mb - ma) / ma * 100, 1)))
if md:
    print('| window | page | frame median ms, before (each round) | after | worst before → after | change |'); print('|---|---|---|---|---|---|')
    for w, who, fa, fb, pa, pb, ma, mb, ch in rows: print(f'| {w} | {who} | {", ".join(f"{x:.0f}" for x in fa)} | {", ".join(f"{x:.0f}" for x in fb)} | {ma:.0f} → {mb:.0f} | {ch:+.1f} % |')
else:
    for w, who, fa, fb, pa, pb, ma, mb, ch in rows: print(f'{w:22} {who:9} before {fa} fps {pa}  after {fb} fps {pb}  worst {ma:.0f} -> {mb:.0f} ({ch:+.1f} %)')
