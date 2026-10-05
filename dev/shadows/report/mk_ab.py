#!/usr/bin/env python3
"""Repeated-rounds A/B table from scene_bench.js runs of the same profile / scene (no number typed by hand).

  mk_ab.py OUT.md LABEL=BENCH_DIR [LABEL=BENCH_DIR ...]

Every run of a bench.json is one round of one tier.  For each label and tier: the frames per second of every round,
their mean, the change against that label's OFF mean and against the first label's mean (the parent), and the module's
own time per frame (mean of the rounds' means, and the largest p95).
"""
import json, sys
from collections import OrderedDict
from pathlib import Path
out = Path(sys.argv[1]); sets = [a.split('=', 1) for a in sys.argv[2:]]
rows, base = [], None
pc = lambda v: f'{v:+.1f} %'.replace('-', '−')
for label, d in sets:
    B = json.loads((Path(d) / 'bench.json').read_text()); by = OrderedDict()
    for r in B['runs']:
        by.setdefault(r['tier'], []).append(r)
    off = by.get('off'); off_mean = sum(r['fps'] for r in off) / len(off) if off else None
    for tier, rs in by.items():
        fps = [r['fps'] for r in rs]; m = sum(fps) / len(fps)
        if base is None: base = m
        sh = [r['shadows'] for r in rs if isinstance(r.get('shadows'), dict)]
        mod = (sum(s['buildMs']['mean'] for s in sh) / len(sh), max(s['buildMs']['p95'] for s in sh)) if sh else None
        prof, scene = rs[0]['profile'], rs[0]['scene']
        rows.append(f"| {label} | {tier.upper() if tier != 'baseline' else 'parent'} | {', '.join(f'{v:.2f}' for v in fps)} | {m:.3f} | "
                    f"{(pc(100 * (m / off_mean - 1)) if off_mean and tier != 'off' else '—')} | {pc(100 * (m / base - 1))} | "
                    f"{(f'{mod[0]:.2f} / {mod[1]:.1f}' if mod else '—')} |")
hdr = [f"Profile `{prof}`, scene `{scene}` (mobile-like: 390×844 at DPR 3, touch, main thread slowed 4×; SwiftShader on 2 vCPUs).", '',
       '| tree | tier | fps per round | mean fps | vs its OFF | vs the parent | module ms / frame (mean / worst p95) |', '|---|---|---|---|---|---|---|']
out.write_text('\n'.join(hdr + rows) + '\n'); print(out.read_text())
