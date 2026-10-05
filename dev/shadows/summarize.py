#!/usr/bin/env python3
"""Markdown tables from the stage's machine-readable evidence (no numbers are typed by hand).

  python3 dev/shadows/summarize.py retained DIR/retained.json
  python3 dev/shadows/summarize.py bench DIR/bench.json [--base BASE/bench.json]
"""
import json, sys
from pathlib import Path


def retained(p):
    R = json.loads(Path(p).read_text()); m = R['meta']
    out = [f"Run: node {m['node']}, Python {m['python']}, Playwright {m.get('playwright')}, {m['cpus']} vCPU, {m['os']}; {m['started']} → {m.get('finished')}", '',
           '| suite | covers | result | counts | failing assertions (names) | error messages |', '|---|---|---|---|---|---|']
    for r in R['suites']:
        c = r['counts']; cnt = f"{c.get('passed')}/{c.get('total')}" if c.get('total') is not None else 'exit 0'
        out.append(f"| `{r['id']}` | {r.get('covers', '')} | **{r['result']}** | {cnt} | {'; '.join(r['failures']) or '—'} | {'; '.join(r.get('errorSignature') or []) or '—'} |")
    return '\n'.join(out)


def f(v, d=2):
    return '—' if v is None else (f'{v:.{d}f}' if isinstance(v, (int, float)) else str(v))


def bench(p, base=None):
    R = json.loads(Path(p).read_text()); B = {}
    if base:
        for r in json.loads(Path(base).read_text())['runs']: B[(r['profile'], r['scene'])] = r
    out = [f"Run: {R.get('label', '')}; Chromium {R.get('chromium')}; node {R.get('node')}; {R.get('secs')} s per scene; renderer {list(R.get('env', {}).values())[0].get('renderer') if R.get('env') else '?'}", '',
           '| profile | scene | tier | fps | rAF CPU ms/frame mean (p95) | frame interval ms p50 / p95 | WebGL draws/frame | 2D calls/frame | CDP script ms/frame | shadow build ms mean / p95 / max | lights | casters cand/active | primitives | screenshot |',
           '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for r in R['runs']:
        cpu, iv, gl, c2, sh = r.get('rafCpuMsPerFrame') or {}, r.get('frameIntervalMs') or {}, r.get('webglDrawCallsPerFrame') or {}, r.get('canvas2dCallsPerFrame') or {}, r.get('shadows')
        bm = sh and sh.get('buildMs') or {}
        delta = ''
        b = B.get((r['profile'], r['scene']))
        if b and b.get('rafCpuMsPerFrame') and cpu: delta = f" (Δ {cpu['mean'] - b['rafCpuMsPerFrame']['mean']:+.2f})"
        out.append(f"| {r['profile']} | {r['scene']} | {r['tier']} | {f(r.get('fps'))} | {f(cpu.get('mean'))} ({f(cpu.get('p95'))}){delta} | {f(iv.get('p50'), 1)} / {f(iv.get('p95'), 1)} | {f(gl.get('mean'), 1)} | {f(c2.get('mean'), 1)} | {f((r.get('cdpPerFrameMs') or {}).get('script'))} | "
                   + (f"{f(bm.get('mean'), 3)} / {f(bm.get('p95'), 3)} / {f(bm.get('max'), 3)} | {sh['lights']['max']} | {sh['casters']['candidateMax']}/{sh['casters']['activeMax']} | {sh['primitives']['max']}" if sh else '— | — | — | —')
                   + f" | `{r.get('screenshot')}` |")
    return '\n'.join(out)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'retained': print(retained(a[1]))
    else: print(bench(a[1], a[3] if len(a) > 3 and a[2] == '--base' else None))
