#!/usr/bin/env python3
"""Stage 3E-0 - does an admin BRING (a server-side placement) stick? (development only; SwiftShader)

  python3 -I dev/stage-3e-0/place_race.py --game DIR --out FILE.json [--runs 6] [--near X:Y]

HQ2's col_browser.py set-up, step by step, with Bob's page watched closely: Alice joins, a quiet admin removes the monsters, Bob joins, and
the admin brings Bob to (1012, 690) and Alice to (862, 720), exactly as col_browser.py and two_browser.py do.  Recorded: every pose Bob's
page sends ('p': time, x, y) and every 'tp' / 'hi' / 'world' it gets, from its first connection; the server's positions (ws_watch.js) from
just before the placement for 3 s.  A run 'sticks' when the server has Bob within 40 px of (1012, 690) 1.5 s after the placement.
--near X:Y: Bob is first brought to X,Y (2 s before), so that the measured placement starts there instead of at his random spawn.
Writes FILE.json: per run, whether it stuck, Bob's position before, the server's track, and the last poses Bob's page sent around it."""
import os, sys, asyncio, argparse, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', required=True); ap.add_argument('--out', required=True); ap.add_argument('--runs', type=int, default=6)
ap.add_argument('--near', default='')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
SPY = r"""(()=>{ const W0=window.WebSocket; const S=window.__prSpy={sent:[],got:[]};
  window.WebSocket=function(u,p){ const ws=p===undefined?new W0(u):new W0(u,p); const snd=ws.send.bind(ws);
    ws.send=d=>{ try{ const m=JSON.parse(d); if(m.t==='p') S.sent.push([Date.now()/1000, m.x, m.y, m.f]); else S.sent.push([Date.now()/1000, m.t]); }catch(e){} return snd(d); };
    ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t==='tp'||m.t==='hi'||m.t==='world'||m.t==='caps') S.got.push([Date.now()/1000, m.t, m.x, m.y, m.pc|0]); }catch(err){} }); return ws; };
  window.WebSocket.prototype=W0.prototype; Object.assign(window.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}); })()"""


async def one(i):
    port = Q.lib3d.free_port(); log = A_.out + f'.run{i}.server.log'; srv = Q.lib3d.start_server(A_.game, port, log); errs = []; R = {'run': i}
    wf = A_.out + f'.run{i}.watch.json'
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            ca, cb = [await b.new_context(viewport={'width': 720, 'height': 480}) for _ in range(2)]
            await cb.add_init_script(SPY)
            A = await Q.join(ca, port, 'h2col', 'Alice', errs); aid = await A.evaluate("()=>__api.H.id")
            Q.place(port, 'h2col', (), god=(aid,), clear=True)
            B = await Q.join(cb, port, 'h2col', 'Bob', errs); bid = await B.evaluate("()=>__api.H.id")
            if A_.near:
                nx, ny = (int(v) for v in A_.near.split(':')); Q.place(port, 'h2col', [(bid, nx, ny)]); await B.wait_for_timeout(2000)
            R['bobBefore'] = await B.evaluate(Q.POS)
            wp = Q.watch(port, 'h2col', 4, wf); time.sleep(.3)
            t0 = time.time(); Q.place(port, 'h2col', [(bid, 1012, 690), (aid, 862, 720)], god=(aid, bid), clear=True); t1 = time.time()
            await B.wait_for_timeout(1500)
            R['bobAfter'] = await B.evaluate(Q.POS)
            await B.wait_for_timeout(1500); wp.wait(timeout=10)
            spy = await B.evaluate("()=>window.__prSpy")
            w = json.load(open(wf))
            track = [[round(t, 3), *next(([q[3], q[4]] for q in pl if q[0] == bid), [None, None])] for t, pl in w['pl']]
            R['placeCall'] = [round(t0, 3), round(t1, 3)]
            R['serverTrack'] = track
            later = [r for r in track if r[0] >= t1 + 1.2 and r[1] is not None]
            R['stuck'] = bool(later) and all(abs(r[1] - 1012) <= 40 and abs(r[2] - 690) <= 40 for r in later)
            R['bobGot'] = spy['got']
            R['bobSentAround'] = [s for s in spy['sent'] if t0 - 1.5 <= s[0] <= t1 + 1.5]
            R['bobSentTypes'] = [s for s in spy['sent'] if len(s) == 2]
            R['ids'] = {'alice': aid, 'bob': bid}; R['pageErrors'] = errs[:5]
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    return R


async def main():
    out = {'tool': 'dev/stage-3e-0/place_race.py', 'game': A_.game, 'near': A_.near, 'runs': []}
    for i in range(A_.runs):
        r = await one(i); out['runs'].append(r)
        print(json.dumps({'run': i, 'stuck': r['stuck'], 'before': r['bobBefore'], 'after': r['bobAfter']}), flush=True)
    out['stuck'] = sum(r['stuck'] for r in out['runs'])
    with open(A_.out, 'w') as f: json.dump(out, f, indent=1); f.write('\n')

asyncio.run(main())
