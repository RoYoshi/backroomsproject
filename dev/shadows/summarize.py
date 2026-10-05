#!/usr/bin/env python3
"""Markdown tables from the stage's machine-readable evidence (no numbers are typed by hand).

  python3 dev/shadows/summarize.py retained DIR/retained.json
  python3 dev/shadows/summarize.py bench DIR/bench.json [--base BASE/bench.json]
  python3 dev/shadows/summarize.py compare BASE/bench.json CAND/bench.json     (parent next to every quality tier)
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


def compare(base, cand):
    """one row per profile x scene: the parent (baseline) next to every candidate tier"""
    Bs = {(r['profile'], r['scene']): r for r in json.loads(Path(base).read_text())['runs']}
    C = json.loads(Path(cand).read_text()); rows = {}
    for r in C['runs']: rows.setdefault((r['profile'], r['scene']), {})[r['tier']] = r
    tiers = ['off', 'low', 'medium', 'high']
    def cell(r, k):
        if not r: return '—'
        if k == 'fps': return f(r.get('fps'))
        if k == 'iv': iv = r.get('frameIntervalMs') or {}; return f"{f(iv.get('p50'), 0)} / {f(iv.get('p95'), 0)}"
        if k == 'cpu': c = r.get('rafCpuMsPerFrame') or {}; return f(c.get('mean'))
        if k == 'gl': return f((r.get('webglDrawCallsPerFrame') or {}).get('mean'), 1)
        if k == 'c2d': return f((r.get('canvas2dCallsPerFrame') or {}).get('mean'), 1)
        sh = r.get('shadows')
        if not sh: return '—'
        if k == 'build': b = sh['buildMs']; return f"{f(b['mean'], 3)} / {f(b['p95'], 2)}"
        if k == 'work': return f"{sh['lights']['max']} / {sh['casters']['candidateMax']}·{sh['casters']['activeMax']} / {sh['dynamicPolys']['max']} / {sh['primitives']['max']}"
    out = []
    for title, k in [('frames per second (SwiftShader)', 'fps'), ('frame interval ms p50 / p95', 'iv'), ('main-thread ms per frame inside rAF callbacks (the game + the module), mean', 'cpu'),
                     ('WebGL draw calls per frame', 'gl'), ('2D-canvas calls per frame (the darkness overlay)', 'c2d'), ('shadow module ms per frame, mean / p95', 'build'),
                     ('lights / candidate·active casters / dynamic polygons / primitives (max over the run)', 'work')]:
        out += [f'#### {title}', '', '| profile | scene | parent | ' + ' | '.join(t.upper() for t in tiers) + ' |', '|---|---|---|' + '---|' * len(tiers)]
        for (prof, sc), byt in rows.items():
            out.append(f"| {prof} | {sc} | {cell(Bs.get((prof, sc)), k)} | " + ' | '.join(cell(byt.get(t), k) for t in tiers) + ' |')
        out.append('')
    return '\n'.join(out)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'retained': print(retained(a[1]))
    elif a[0] == 'compare': print(compare(a[1], a[2]))
    else: print(bench(a[1], a[3] if len(a) > 3 and a[2] == '--base' else None))
