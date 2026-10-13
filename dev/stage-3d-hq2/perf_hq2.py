#!/usr/bin/env python3
"""Stage 3D HQ2 - what the explosion and two players in contact cost the browser, against the same run's own windows (development only;
SwiftShader software rendering: compare windows of one run on one machine only, never quote as GPU performance)

  python3 -I dev/stage-3d-hq2/perf_hq2.py --game DIR --out FILE.json [--rounds 3]

dev/stage-3d/perf_death.py's method and pages (1280 x 720; Alice an admin page, Bob 150 px away watching, the monsters removed): frame
intervals from requestAnimationFrame and Chrome's own main-thread counters, every window measured on both pages at once.  Per round:
  idle        both standing apart, lights on, 4 s
  contact     Alice and Bob 60 px apart in an open hall, each holding a key straight into the other for 4 s: they meet and stay pressed
              together (every step projected against the other, the server sweeping every packet, soft corrections)
  death_houndC  Alice dies a Hound C wall death by the admin preview, from the kill to the corpse; Bob watches the replay
  explosion   Alice presses NEW RUN at the same wall; from her page's approval, 3.2 s (the blast's length) on both pages; then SPAWN
The gates (STAGE_3D_HQ2_AUDIT.md section 5, the new windows HQ1 cannot have): on each page, the explosion's frame median no worse than
the same round's Hound C death window's median + 10 %; the contact window's no worse than the same round's idle + 7 %.  Judged on the
median over the rounds of each round's ratio.  Exit 1 if a gate is not met."""
import os, sys, asyncio, argparse, time, json, statistics
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d'))
import lib3d
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); ap.add_argument('--rounds', type=int, default=3)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
FR = """()=>{ if(window.__pf) return; const f=window.__pf={on:false,last:0,d:[]}; const L=t=>{ if(f.on){ if(f.last) f.d.push(t-f.last); f.last=t; } requestAnimationFrame(L) }; requestAnimationFrame(L) }"""
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"


async def metrics(cdp):
    m = {x['name']: x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    return {'script': m.get('ScriptDuration', 0), 'task': m.get('TaskDuration', 0), 'ts': m.get('Timestamp', 0)}


async def window_(pages, secs=None, until=None):                              # (perf_death.py's window_)
    for P, cdp in pages: await P.evaluate("()=>{window.__pf.d=[]; window.__pf.last=0; window.__pf.on=true}")
    m0 = [await metrics(cdp) for P, cdp in pages]; t0 = time.time()
    if secs: await pages[0][0].wait_for_timeout(int(secs * 1000))
    else:
        while time.time() - t0 < 15 and not await until(pages[0][0]): await pages[0][0].wait_for_timeout(100)
    m1 = [await metrics(cdp) for P, cdp in pages]; out = []
    for (P, cdp), a, b in zip(pages, m0, m1):
        d = await P.evaluate("()=>{window.__pf.on=false; return window.__pf.d}")
        wall = max(.001, b['ts'] - a['ts']); s = sorted(d) or [0]
        out.append({'secs': round(wall, 2), 'frames': len(d), 'frameMedianMs': round(statistics.median(s), 2), 'frameP95Ms': round(s[int(len(s) * .95) - 1 if len(s) > 1 else 0], 2),
                    'scriptMsPerSec': round((b['script'] - a['script']) * 1000 / wall, 1), 'taskMsPerSec': round((b['task'] - a['task']) * 1000 / wall, 1)})
    return out


async def main():
    port = lib3d.free_port(); srv = lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    res = {'tool': 'dev/stage-3d-hq2/perf_hq2.py', 'game': A_.game, 'rounds': [], 'note': 'SwiftShader software rendering: windows of one run compared with each other only'}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS)
            ca = await b.new_context(viewport={'width': 1280, 'height': 720}); cb = await b.new_context(viewport={'width': 1280, 'height': 720})
            A = await lib3d.join(ca, port, 'perfhq2', 'Alice', errs); await lib3d.admin_open(A)
            B = await lib3d.join(cb, port, 'perfhq2', 'Bob', errs)
            bid = await B.evaluate("()=>__api.H.id"); await lib3d.admin_cmd(A, {'c': 'god', 'id': bid}); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            pages = [(A, await ca.new_cdp_session(A)), (B, await cb.new_cdp_session(B))]
            for P, cdp in pages: await cdp.send('Performance.enable'); await P.evaluate(FR)
            spots = {k: await A.evaluate(lib3d.SPOTS, k) for k in ('open', 'wall')}
            lastNr = 0
            for r in range(A_.rounds):
                R = {}
                await lib3d.ensure_alive(A); await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", spots['open']); await B.evaluate(lib3d.WATCH_FROM, spots['open'])
                await A.wait_for_timeout(3000)
                R['idle'] = await window_(pages, secs=4)
                ox, oy, _ = spots['open']
                await A.evaluate("([x,y])=>{__api.tp(x,y); __api.H.angle=0}", [ox - 30, oy]); await B.evaluate("([x,y])=>{__api.tp(x,y); __api.H.angle=Math.PI}", [ox + 30, oy])
                await A.wait_for_timeout(2000)
                await A.keyboard.down('KeyD'); await B.keyboard.down('KeyA'); await A.wait_for_timeout(600)
                R['contact'] = await window_(pages, secs=4)
                R['contactSeparation'] = await A.evaluate("(id)=>{ const o=(window.__peerBodies||[]); return { peers:o.length, mine:[Math.round(__api.H.x),Math.round(__api.H.y)], epoch: window.__epochDebug?window.__epochDebug():null } }", bid)
                await A.keyboard.up('KeyD'); await B.keyboard.up('KeyA')
                await lib3d.ensure_alive(A); sp = spots['wall']
                await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", sp); await B.evaluate(lib3d.WATCH_FROM, sp); await A.wait_for_timeout(3000)
                if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
                s0 = await A.evaluate("()=>__api.death().startAt")
                await lib3d.click(A, '[data-c=preview][data-k=hound][data-var=C]')
                t0 = time.time()
                while time.time() - t0 < 12 and not await A.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s", s0): await A.wait_for_timeout(50)
                await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
                R['death_houndC'] = await window_(pages, until=lambda P: P.evaluate("()=>__api.death().finished"))
                await lib3d.until_alive(A, 30); await lib3d.ensure_alive(A)
                await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", sp); await B.evaluate(lib3d.WATCH_FROM, sp); await A.wait_for_timeout(2500)
                while time.time() - lastNr < 31: await A.wait_for_timeout(250)
                q0 = await A.evaluate("()=>window.__nrDebug().q"); await A.evaluate(PRESS); t0 = time.time()
                while time.time() - t0 < 4 and not await A.evaluate("(q)=>{ const d=window.__nrDebug(); return d.last && d.last.q>q && d.last.ok }", q0): await A.wait_for_timeout(30)
                lastNr = time.time()
                R['explosion'] = await window_(pages, secs=3.2)
                R['explosionApproved'] = await A.evaluate("()=>window.__nrDebug().last")
                await A.wait_for_timeout(800); R['spawned'] = await A.evaluate(SPAWN); await A.wait_for_timeout(2500)
                res['rounds'].append(R); print('round', r, json.dumps({k: [x['frameMedianMs'] for x in v] for k, v in R.items() if isinstance(v, list)}), flush=True)
            await b.close()
    finally:
        lib3d.stop_server(srv)
    G = res['gates'] = {}
    for gi, (win, base, lim) in enumerate((('explosion', 'death_houndC', 1.10), ('contact', 'idle', 1.07))):
        for pi, page in enumerate(('alice', 'bob')):
            ratios = [R[win][pi]['frameMedianMs'] / R[base][pi]['frameMedianMs'] for R in res['rounds'] if R.get(win) and R.get(base) and R[base][pi]['frameMedianMs']]
            m = statistics.median(ratios) if ratios else None
            G[f'{win}_{page}'] = {'against': base, 'ratios': [round(x, 3) for x in ratios], 'median': round(m, 3) if m else None, 'limit': lim, 'met': bool(m and m <= lim)}
    res['ok'] = all(g['met'] for g in G.values()) and all(R.get('explosionApproved') and R['explosionApproved'].get('ok') for R in res['rounds'])
    res['errors'] = errs[:20]
    with open(A_.out, 'w') as f: json.dump(res, f, indent=1); f.write('\n')
    for k, g in G.items(): print(('MET ' if g['met'] else 'NOT MET ') + f"{k}: median of round ratios {g['median']} against {g['against']} (limit {g['limit']}) {g['ratios']}")
    sys.exit(0 if res['ok'] else 1)


asyncio.run(main())
