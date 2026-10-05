#!/usr/bin/env python3
"""Table of the same-machine diagnosis runs (browser-ir / browser-admin), read from their retained.json files.

  mk_diag.py BASELINE_JSON MAIN_JSON DIAG_DIR OUT_MD
"""
import collections, json, sys
from pathlib import Path
base, main, D, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
B = {s['id']: s for s in json.loads(base.read_text())['suites']}
runs = [('SH0 baseline: parent, before the restart', base), ('SH4 main run: final tree, default deadlines', main)]
order = ['parent-1', 'final-1', 'parent-2', 'final-2']                       # the order they ran in, back to back
for name in order:
    p = D / name / 'retained.json'
    if p.exists(): runs.append((f"same machine, run {order.index(name) + 1}: {'parent' if name.startswith('parent') else 'final tree'} (`{name}`), deadlines ×3", p))
short = lambda f: f.split('  - ')[0]
nat = lambda xs: sorted(xs, key=lambda t: (t[0], int(''.join(ch for ch in t if ch.isdigit()) or 0)))
L = ['| run | suite | verdict | passed / total | seconds | failing assertions |', '|---|---|---|---|---|---|']
for label, p in runs:
    for s in json.loads(p.read_text())['suites']:
        if s['id'] not in ('browser-ir', 'browser-admin'): continue
        c = s['counts']; bset = set(map(short, B[s['id']]['failures'])); f = [short(x) for x in s['failures']]
        if s.get('limitation'): desc = s['limitation']
        elif not f: desc = '—'
        elif set(f) == bset: desc = 'exactly the baseline\'s: ' + ', '.join(nat({x.split(' ')[0] for x in f}))
        else:
            extra = [x for x in f if x not in bset]; kinds = collections.Counter(x.split(' ')[0] for x in extra)
            desc = (('the baseline\'s ' + ', '.join(nat({x.split(' ')[0] for x in bset & set(f)})) + ' + ') if bset & set(f) else '') + \
                   f"{len(extra)} more (" + ', '.join(f'{k} ×{n}' for k, n in sorted(kinds.items())) + f"), the first: “{extra[0]}”"
        L.append(f"| {label} | {s['id']} | {s['result']} | {c.get('passed') if c.get('passed') is not None else '—'} / {c.get('total') if c.get('total') is not None else '—'} | {s['durationSeconds']:.0f} | {desc} |")
OUT.write_text('\n'.join(L) + '\n'); print('\n'.join(L))
