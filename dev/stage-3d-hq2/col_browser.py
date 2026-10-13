#!/usr/bin/env python3
"""Stage 3D HQ2 - two ordinary players meeting in a real browser (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/col_browser.py --game DIR --out FILE.json [--shots DIR] [--case pass]

Alice and Bob are ordinary players (no test passcode: the server checks every step they take), placed by a quiet admin connection in
the one-tile corridor of Level 0 at y=720 (walk-mode centre span 64 px): Bob stands still at x=1012, Alice starts at x=862 and holds
D (east) with her own keyboard for 3.5 s.  Both pages sample their own position 20 times a second; a quiet observer (ws_watch.js)
records the server's positions.  The monsters are removed (and both players put in god mode) as soon as each has joined; a run in
which either was dead when the test began says so (`setup`).  Case `pass` (H2-0): does Alice get through Bob?  `measured`: the smallest separation each screen and
the server saw, whether Alice ended past Bob, the server's corrections.  Screenshots of both pages at the closest moment and at the end."""
import os, sys, asyncio, argparse, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True)
ap.add_argument('--shots', default=None); ap.add_argument('--case', default='pass')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 720, 480
Y, XA, XB = 720, 862, 1012
SAMPLER = r"""()=>{ if(window.__h2c) return 'already'; const S=window.__h2c={rows:[]};
  S.iv=setInterval(()=>{ try{ const A=window.__api; S.rows.push([+(Date.now()/1000).toFixed(3), +A.H.x.toFixed(1), +A.H.y.toFixed(1)]); if(S.rows.length>8000) S.rows.splice(0,3000) }catch(e){} },50); return 'ok' }"""
ROWS = "(since)=>window.__h2c?window.__h2c.rows.filter(r=>r[0]>=since):null"


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq2/col_browser.py', 'case': A_.case, 'game': A_.game, 'corridor': {'y': Y, 'alice0': XA, 'bob': XB}}
    wf = A_.out + '.watch.json'
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            ca, cb = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(2)]
            A = await Q.join(ca, port, 'h2col', 'Alice', errs); aid = await A.evaluate("()=>__api.H.id")
            Q.place(port, 'h2col', (), god=(aid,), clear=True)              # (at once: a lone player's join makes a new world, with new monsters)
            B = await Q.join(cb, port, 'h2col', 'Bob', errs); bid = await B.evaluate("()=>__api.H.id")
            R['ids'] = {'alice': aid, 'bob': bid}
            Q.place(port, 'h2col', [(bid, XB, Y), (aid, XA, Y)], god=(aid, bid), clear=True)
            await A.wait_for_timeout(1500)
            for P, a in ((A, 0.0), (B, 3.1416)): await Q.lib3d.aim(P, a, W, H)
            R['placed'] = {'alice': await A.evaluate(Q.POS), 'bob': await B.evaluate(Q.POS)}
            wp = Q.watch(port, 'h2col', 14, wf)
            for P in (A, B): await P.evaluate(SAMPLER)
            await A.wait_for_timeout(1200)
            since = await A.evaluate("()=>Date.now()/1000")
            await A.bring_to_front(); await A.keyboard.down('KeyD')
            closest = {'d': 1e9, 'shot': False}
            T = time.time()
            while time.time() - T < 3.5:
                a, bq = await A.evaluate(Q.POS), await B.evaluate(Q.POS)
                d = ((a['x'] - bq['x']) ** 2 + (a['y'] - bq['y']) ** 2) ** .5
                if d < closest['d']: closest.update(d=d, t=a['t'])
                if d < 18 and not closest['shot'] and A_.shots:
                    os.makedirs(A_.shots, exist_ok=True); closest['shot'] = True
                    await A.screenshot(path=os.path.join(A_.shots, 'closest_alice.png')); await B.screenshot(path=os.path.join(A_.shots, 'closest_bob.png'))
                await A.wait_for_timeout(30)
            await A.keyboard.up('KeyD')
            await A.wait_for_timeout(1500)
            if A_.shots:
                os.makedirs(A_.shots, exist_ok=True)
                await A.screenshot(path=os.path.join(A_.shots, 'end_alice.png')); await B.screenshot(path=os.path.join(A_.shots, 'end_bob.png'))
            R['rows'] = {'alice': await A.evaluate(ROWS, since), 'bob': await B.evaluate(ROWS, since)}
            R['end'] = {'alice': await A.evaluate(Q.POS), 'bob': await B.evaluate(Q.POS)}
            R['closestPolled'] = closest
            R['pageErrors'] = errs[:20]
            try: wp.send_signal(15); wp.wait(10)
            except Exception: wp.kill()
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    Wt = json.load(open(wf)) if os.path.exists(wf) else {'pl': [], 'other': []}
    aid, bid = R['ids']['alice'], R['ids']['bob']
    srvSep, srvA = [], []
    for t, pl in Wt['pl']:
        a = next((q for q in pl if q[0] == aid), None); b_ = next((q for q in pl if q[0] == bid), None)
        if a and b_ and t >= R['placed']['alice']['t']: srvSep.append(((a[3] - b_[3]) ** 2 + (a[4] - b_[4]) ** 2) ** .5); srvA.append((t, a[3], a[4]))
    ra = {r[0]: r for r in R['rows']['alice']}; rb = R['rows']['bob']
    pageSep = []
    for r in rb:
        a = min(R['rows']['alice'], key=lambda q: abs(q[0] - r[0]), default=None)
        if a and abs(a[0] - r[0]) < .06: pageSep.append(((a[1] - r[1]) ** 2 + (a[2] - r[2]) ** 2) ** .5)
    R['server'] = {'aliceTrack': srvA[::2]}
    first = next((pl for t, pl in Wt['pl'] if t >= R['placed']['alice']['t']), [])
    R['setup'] = {'deadAtStart': [q[0] for q in first if q[0] in (aid, bid) and q[2]], 'ok': bool(first) and not any(q[2] for q in first if q[0] in (aid, bid))}   # (a monster's kill before the test began voids the run)
    R['measured'] = {'setupOk': R['setup']['ok'], 'minSeparationServer': round(min(srvSep), 1) if srvSep else None, 'minSeparationPages': round(min(pageSep), 1) if pageSep else None,
                     'aliceEnd': R['end']['alice'], 'bobEnd': R['end']['bob'], 'alicePastBob': R['end']['alice']['x'] > R['end']['bob']['x'],
                     'bobMoved': round(abs(R['end']['bob']['x'] - XB), 1)}
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    print(json.dumps(R['measured'], indent=1))


asyncio.run(main())
