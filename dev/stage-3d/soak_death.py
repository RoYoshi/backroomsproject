#!/usr/bin/env python3
"""Stage 3D - many deaths in a row: memory and leftovers (development only; SwiftShader).

  python3 dev/stage-3d/soak_death.py --game DIR --out FILE.json [--deaths 16] [--trace-gc]

Alice (admin) dies again and again through the admin death lab at normal speed, all eight variants in turn; Bob (god mode) watches each
from about 150 px.  After every death, on both pages, after a forced garbage collection (CDP HeapProfiler.collectGarbage): the JS heap,
the game's corpse views and records, the replays still alive, the corpses still drying, Pixi display objects under the world, and the
server's process memory.  The first two deaths warm the caches; the trend over the rest (least-squares slope, MB per death) is the leak
measure.  The server runs with a synthetic admin passcode (lib3d.PASS).
--trace-gc: the server runs with node --trace-gc and collects garbage only when V8 decides; the heap after each of its full collections
(Mark-Compact) is read from its log, next to its RSS: whether what it really keeps grows, or only what it has reserved."""
import os, sys, asyncio, argparse, time, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3d
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); ap.add_argument('--deaths', type=int, default=16); ap.add_argument('--trace-gc', action='store_true')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
HOOK = """()=>{ const G=window.__gore; if(G && G.cull && !G.__ws){ const c=G.cull; G.cull=(r,s)=>{ window.__scn=s; return c(r,s) }; G.__ws=1 } }"""
COUNT = """()=>{ const s=window.__scn; let n=0; const walk=o=>{ n++; for(const c of (o.children||[])) walk(c) }; if(s && s.world) walk(s.world);
  return { views: s ? s.corpseViews.size : null, records: (__api.bodyList()||[]).length, replays: (window.__fxs||[]).length, displayObjects: s ? n : null } }"""


def slope(ys):
    n = len(ys)
    if n < 2: return 0
    xs = list(range(n)); mx = sum(xs) / n; my = sum(ys) / n
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sum((x - mx) ** 2 for x in xs) or 1)


async def main():
    port = lib3d.free_port(); srv = lib3d.start_server(A_.game, port, A_.out + '.server.log', ('--trace-gc',) if A_.trace_gc else ()); errs = []; rows = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS)
            ca = await b.new_context(viewport={'width': 760, 'height': 520}); cb = await b.new_context(viewport={'width': 760, 'height': 520})
            A = await lib3d.join(ca, port, 'soak3d', 'Alice', errs); await lib3d.admin_open(A)
            B = await lib3d.join(cb, port, 'soak3d', 'Bob', errs)
            bid = await B.evaluate("()=>__api.H.id"); await lib3d.admin_cmd(A, {'c': 'god', 'id': bid})
            cdp = [await ca.new_cdp_session(A), await cb.new_cdp_session(B)]
            for c in cdp: await c.send('HeapProfiler.enable'); await c.send('Performance.enable')
            spots = {k: await A.evaluate(lib3d.SPOTS, k) for k in ('open', 'wall')}
            order = [(k, v) for k in ('hound', 'smiler') for v in 'ABCD']
            for i in range(A_.deaths):
                kind, v = order[i % 8]; sp = spots['wall'] if (kind == 'hound' and v == 'C') else spots['open']
                await lib3d.ensure_alive(A)
                await A.evaluate("([x,y,a])=>{__api.tp(x+(Math.random()-.5)*60,y+(Math.random()-.5)*60); __api.H.angle=a}", sp); await B.evaluate(lib3d.WATCH_FROM, sp)
                for P in (A, B): await P.evaluate(HOOK)
                await A.wait_for_timeout(2000)
                if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
                await lib3d.click(A, f'[data-c=preview][data-k={kind}][data-var={v}]')
                await A.wait_for_timeout(9000)
                await lib3d.until_alive(A, 30)
                row = {'i': i, 'death': f'{kind}-{v}'}
                for name, P, c in (('victim', A, cdp[0]), ('spectator', B, cdp[1])):
                    await c.send('HeapProfiler.collectGarbage'); await P.wait_for_timeout(300)
                    m = {x['name']: x['value'] for x in (await c.send('Performance.getMetrics'))['metrics']}
                    row[name] = dict(await P.evaluate(COUNT), heapMB=round(m.get('JSHeapUsedSize', 0) / 1048576, 2), nodes=m.get('Nodes'), listeners=m.get('JSEventListeners'))
                rss = subprocess.run(['ps', '-o', 'rss=', '-p', str(srv.pid)], capture_output=True, text=True).stdout.strip()
                row['serverRssMB'] = round(int(rss) / 1024, 1) if rss else None
                rows.append(row); print(json.dumps(row), flush=True)
            await b.close()
    finally:
        lib3d.stop_server(srv)
    use = rows[2:]
    R = {'tool': 'dev/stage-3d/soak_death.py', 'game': A_.game, 'deaths': len(rows), 'rows': rows, 'errors': errs[:20],
         'slopeMBPerDeath': {w: round(slope([r[w]['heapMB'] for r in use]), 3) for w in ('victim', 'spectator')},
         'slopeDisplayObjectsPerDeath': {w: round(slope([r[w]['displayObjects'] or 0 for r in use]), 2) for w in ('victim', 'spectator')},
         'serverRssSlopeMBPerDeath': round(slope([r['serverRssMB'] or 0 for r in use]), 3),
         'maxReplaysLeft': max(r['spectator']['replays'] for r in rows), 'maxViews': max(max(r['victim']['views'] or 0, r['spectator']['views'] or 0) for r in rows)}
    if A_.trace_gc:
        import re
        mc = [(int(m.group(1)), float(m.group(2)), float(m.group(3))) for m in re.finditer(r'(\d+) ms: Mark-Compact[^\n]*?([\d.]+) \([\d.]+\) -> ([\d.]+) \([\d.]+\) MB', open(A_.out + '.server.log').read())]
        R['serverFullGCs'] = [{'ms': t, 'beforeMB': a, 'afterMB': b} for t, a, b in mc]
        R['serverHeapAfterFullGC'] = {'count': len(mc), 'first': mc[0][2] if mc else None, 'last': mc[-1][2] if mc else None, 'max': max((x[2] for x in mc), default=None)}
    lib3d.dump(A_.out, R); print(json.dumps({k: R[k] for k in ('slopeMBPerDeath', 'slopeDisplayObjectsPerDeath', 'serverRssSlopeMBPerDeath', 'maxReplaysLeft', 'maxViews')}))

asyncio.run(main())
