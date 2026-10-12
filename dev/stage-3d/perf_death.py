#!/usr/bin/env python3
"""Stage 3D - what deaths and corpses cost the browser (development only; SwiftShader software rendering: compare versions on the same
machine only, never quote as GPU performance).

  python3 dev/stage-3d/perf_death.py --game DIR --out FILE.json [--rounds 2] [--corpses CORPSES.json]

In one room, Alice (the victim, admin) and Bob (a spectator 150 px away, god mode) stand in an open hall with the monsters removed.
Per round, each window is measured on both pages: frame intervals from requestAnimationFrame, and Chrome's own counters (CDP
Performance.getMetrics: ScriptDuration, TaskDuration, JSHeapUsedSize) - the main-thread time spent per second of the window.
  idle         both standing, lights on, 4 s
  death_<v>    Alice dies at normal speed by the admin preview (Hound A, Hound C at a wall, Smiler A), from the kill to the corpse;
               Bob watches the replay over the network
  whole_<v>    the same death from its first frame to the frame it finishes, on both pages over the same wall-clock span (added at D6:
               death_<v> starts when the polling notices the death, a frame or more late on a saturated page)
  corpses20    20 corpse records (made by the server's own fallback, --corpses, from perf_death_srv-style runs) laid around Bob, on screen,
               4 s; then the same 20 placed far away (off screen), 4 s
"""
import os, sys, asyncio, argparse, time, json, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3d
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); ap.add_argument('--rounds', type=int, default=2)
ap.add_argument('--lighting', default='', help='BR-RoLE lighting quality for both pages: low, medium or high (default: the game\'s own default)')
ap.add_argument('--only', default='', help='windows to measure: any of idle,houndA,houndC,smilerA,corpses (default all)')
ap.add_argument('--corpses', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'corpses20.json')); A_ = ap.parse_args()
FR = """()=>{ if(window.__pf) return; const f=window.__pf={on:false,last:0,d:[],log:[]}; const L=t=>{ if(f.on){ if(f.last) f.d.push(t-f.last); f.last=t; }
  const D=window.__api&&__api.death&&__api.death(); f.log.push([t, Date.now(), D?D.startAt:-1, D&&D.active?1:0, D&&D.finished?1:0]); if(f.log.length>600) f.log.splice(0,300);
  requestAnimationFrame(L) }; requestAnimationFrame(L) }"""


async def whole_death(pages, s0):
    """The whole death, from the victim's first frame of it to the frame it finishes, on every page over the same wall-clock span (both
    pages log every frame: its time, the wall clock and the victim's death state).  window_ starts when the polling notices the death,
    which on a saturated main thread can be a frame or more late, so its 4-5 frames cover different parts of the death in different
    runs; this covers all of it."""
    logs = [await P.evaluate("()=>window.__pf.log.slice()") for P, cdp in pages]
    L = logs[0]; i0 = next((i for i, e in enumerate(L) if e[2] != s0 and e[3]), None)
    i1 = next((i for i in range(i0, len(L)) if L[i][4]), None) if i0 is not None else None
    if i0 is None or i1 is None: return None
    w0, w1, out = L[i0][1], L[i1][1], []
    for lg in logs:
        T = [e[0] for e in lg if w0 <= e[1] <= w1]; d = sorted(b - a for a, b in zip(T, T[1:])) or [0]
        out.append({'frames': len(T), 'secs': round((T[-1] - T[0]) / 1000, 2) if len(T) > 1 else 0, 'frameMedianMs': round(statistics.median(d), 2),
                    'frameMeanMs': round(sum(d) / len(d), 2), 'frameMaxMs': round(max(d), 1)})
    return out


async def metrics(cdp):
    m = {x['name']: x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    return {'script': m.get('ScriptDuration', 0), 'task': m.get('TaskDuration', 0), 'heap': m.get('JSHeapUsedSize', 0), 'ts': m.get('Timestamp', 0)}


async def window_(pages, secs=None, until=None):
    """measure every page over the same window: a fixed time, or until(page) is true on the first page"""
    for P, cdp in pages: await P.evaluate("()=>{window.__pf.d=[]; window.__pf.last=0; window.__pf.on=true}")
    m0 = [await metrics(cdp) for P, cdp in pages]; t0 = time.time()
    if secs: await pages[0][0].wait_for_timeout(int(secs * 1000))
    else:
        while time.time() - t0 < 15 and not await until(pages[0][0]): await pages[0][0].wait_for_timeout(100)
    m1 = [await metrics(cdp) for P, cdp in pages]; out = []
    for (P, cdp), a, b in zip(pages, m0, m1):
        d = await P.evaluate("()=>{window.__pf.on=false; return window.__pf.d}")
        wall = max(.001, b['ts'] - a['ts']); s = sorted(d) or [0]
        out.append({'secs': round(wall, 2), 'frames': len(d), 'fps': round(len(d) / wall, 1), 'frameMedianMs': round(statistics.median(s), 2), 'frameP95Ms': round(s[int(len(s) * .95) - 1 if len(s) > 1 else 0], 2),
                    'frameMaxMs': round(max(s), 1), 'scriptMsPerSec': round((b['script'] - a['script']) * 1000 / wall, 1), 'taskMsPerSec': round((b['task'] - a['task']) * 1000 / wall, 1), 'heapMB': round(b['heap'] / 1048576, 2)})
    return out


async def main():
    corpses = json.load(open(A_.corpses)) if os.path.exists(A_.corpses) else []
    port = lib3d.free_port(); srv = lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    res = {'tool': 'dev/stage-3d/perf_death.py', 'game': A_.game, 'lighting': A_.lighting or 'default', 'rounds': [], 'note': 'SwiftShader software rendering, 2 CPUs: compare versions on the same machine only'}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS)
            ca = await b.new_context(viewport={'width': 1280, 'height': 720}); cb = await b.new_context(viewport={'width': 1280, 'height': 720})
            Q = f'&lighting={A_.lighting}' if A_.lighting else ''
            A = await lib3d.join(ca, port, 'perf3d', 'Alice', errs, Q); await lib3d.admin_open(A)
            B = await lib3d.join(cb, port, 'perf3d', 'Bob', errs, Q)
            bid = await B.evaluate("()=>__api.H.id"); await lib3d.admin_cmd(A, {'c': 'god', 'id': bid}); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            pages = [(A, await ca.new_cdp_session(A)), (B, await cb.new_cdp_session(B))]
            for P, cdp in pages: await cdp.send('Performance.enable'); await P.evaluate(FR)
            spots = {k: await A.evaluate(lib3d.SPOTS, k) for k in ('open', 'wall')}
            for r in range(A_.rounds):
                R = {}
                await lib3d.ensure_alive(A); await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", spots['open']); await B.evaluate(lib3d.WATCH_FROM, spots["open"])
                await A.wait_for_timeout(3000)
                want = set(A_.only.split(',')) if A_.only else {'idle', 'houndA', 'houndC', 'smilerA', 'corpses'}
                if 'idle' in want: R['idle'] = await window_(pages, secs=4)
                for kind, v in (('hound', 'A'), ('hound', 'C'), ('smiler', 'A')):
                    if f'{kind}{v}' not in want: continue
                    await lib3d.ensure_alive(A); sp = spots['wall'] if v == 'C' else spots['open']
                    await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", sp); await B.evaluate(lib3d.WATCH_FROM, sp)
                    await A.wait_for_timeout(3000)
                    if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                    await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
                    s0 = await A.evaluate("()=>__api.death().startAt")
                    for P, cdp in pages: await P.evaluate("()=>{window.__pf.log=[]}")
                    await lib3d.click(A, f'[data-c=preview][data-k={kind}][data-var={v}]')
                    t0 = time.time()
                    while time.time() - t0 < 12 and not await A.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s", s0): await A.wait_for_timeout(50)
                    await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
                    R[f'death_{kind}{v}'] = await window_(pages, until=lambda P: P.evaluate("()=>__api.death().finished"))
                    W = await whole_death(pages, s0)
                    if W: R[f'whole_{kind}{v}'] = W
                    await lib3d.until_alive(A, 30)
                if corpses and 'corpses' in want:
                    await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", spots['open']); await B.evaluate(lib3d.WATCH_FROM, spots["open"]); await A.wait_for_timeout(2500)
                    bx, by = await B.evaluate("()=>[__api.H.x,__api.H.y]")
                    place = """(L)=>{ const W=window.__mpLib.wire; const shift=(b)=>{ const dx=b.x-b.ox, dy=b.y-b.oy; const o=JSON.parse(JSON.stringify(b.rec)); o.x+=dx; o.y+=dy; o.k=9000+b.i;
                       o.bl=o.bl.map(q=>[q[0]+dx,q[1]+dy,q[2]]); o.dr=[o.dr[0]+dx,o.dr[1]+dy,o.dr[2]]; o.ht=[o.ht[0]+dx,o.ht[1]+dy,o.ht[2]]; o.tr=(o.tr||[]).map(q=>[q[0]+dx,q[1]+dy]); return W.toRec(o) };
                       __api.bodies(L.map(shift)) }"""
                    mk = lambda ox, oy: [{'rec': c['rec'], 'x': ox + (i % 5) * 70 - 140, 'y': oy + (i // 5) * 70 - 105, 'ox': c['rec']['x'], 'oy': c['rec']['y'], 'i': i} for i, c in enumerate(corpses)]
                    for P, cdp in pages: await P.evaluate(place, mk(bx, by))
                    await A.wait_for_timeout(1500); R['corpses20_onscreen'] = await window_(pages, secs=4)
                    for P, cdp in pages: await P.evaluate(place, mk(bx + 3000, by))
                    await A.wait_for_timeout(1500); R['corpses20_offscreen'] = await window_(pages, secs=4)
                    for P, cdp in pages: await P.evaluate("()=>__api.bodies([])")
                res['rounds'].append(R); print('round', r, json.dumps({k: [x.get('scriptMsPerSec', x['frameMedianMs']) for x in v] for k, v in R.items()}), flush=True)
            await b.close()
    finally:
        lib3d.stop_server(srv)
    res['errors'] = errs[:20]
    lib3d.dump(A_.out, res)

asyncio.run(main())
