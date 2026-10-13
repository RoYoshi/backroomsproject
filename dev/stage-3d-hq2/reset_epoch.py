#!/usr/bin/env python3
"""Stage 3D HQ2 - an admin world reset (WORLD -> NEW RUN FOR EVERYONE) in the middle of a death, on three screens (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/reset_epoch.py --game DIR --out FILE.json [--after MS] [--shots DIR]

R01: Alice (the victim; an admin page for the Death Lab) dies a Hound C wall death in front of a lit papered face with her flashlight ON;
Bob and Carol (spectators, god mode, lights off) watch.  MS milliseconds after the server's replay message of her death (default 2200: the
wall struck, the death still playing, its light in its hold) a WebSocket client doing nothing else sends the world reset
(dev/stage-3d-hq1/ws_admin.js).  Every page records, ~10 times a second from before the death to 9 s after the reset:
  - its own death sequence (Alice) and every death replay it plays (window.__fxs: id, death id, clock, ended);
  - the wallpaper stains gore.js keeps stamped (their death ids) and what the wall receiver holds;
  - corpse records on screen (owner, local or the server's, death id);
  - dead lights still giving light (window.__peerLights with a power > 0) and the victim's own dying light (window.__deathLight.own);
  - where the page's own player is.
`measured` counts, per page, what is still there from 0.5 s / 1.5 s after the reset.  Screenshots of the three screens at the reset
+0.6 s and +3 s.  The HQ2 contract (WORLD_RESET_EPOCH_CORRECTION) wants nothing of the old world's death on any screen after the reset;
this tool only measures - the RED baseline (H2-0) and the GREEN check (H2-4) read the same numbers."""
import os, sys, asyncio, argparse, json, time, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq1'))
import hq1lib as L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True)
ap.add_argument('--after', type=int, default=2200); ap.add_argument('--shots', default=None); ap.add_argument('--query', default='')
ap.add_argument('--reanalyse', default=None, help='recompute `measured` from a saved run (no browser)')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 960, 640
SAMPLER = r"""()=>{ if(window.__h2s) return 'already'; const S=window.__h2s={rows:[]};
  const one=()=>{ try{ const A=window.__api, d=A.death&&A.death(), G=window.__gore&&window.__gore.wallStains, Lv=window.__l0v, dl=window.__deathLight;
      const act=!!(d&&d.active);
      S.rows.push({ t:+(Date.now()/1000).toFixed(3), caught:!!A.G.caught, own: d?{a:act,f:!!d.finished,e:+(d.elapsed||0).toFixed(2)}:null,
        ownPw: act&&dl&&A.lightOn&&A.lightOn()?+(+dl.own()).toFixed(3):null,
        fx:(window.__fxs||[]).filter(f=>f.k!=='vanish').map(f=>[f.id,f.de,f.jl?+f.jl.elapsed.toFixed(2):null,!!f.end]),
        st: G?G.list().filter(s=>s.status==='stamped').map(s=>s.de):null, rc: Lv&&Lv.surfaces?Lv.surfaces.count():null,
        bd:(A.bodyList?A.bodyList():[]).filter(b=>b.cause!=='Vanish').map(b=>[String(b.ownerId),b.remote?1:0,b.de==null?null:b.de]),
        dl:(window.__peerLights||[]).filter(l=>l&&l.pw!=null&&l.pw>0).length,
        x:Math.round(A.H.x), y:Math.round(A.H.y) });
      if(S.rows.length>6000) S.rows.splice(0,2000) }catch(e){ S.err=String(e) } };
  S.iv=setInterval(one,100); return 'ok' }"""
ROWS = "(since)=>window.__h2s?window.__h2s.rows.filter(r=>r.t>=since):null"


def measure(R):
    a, rows = R.get('admin') or {}, R['rows']; de, tr, aid = a.get('de'), a.get('sent'), a.get('victim')

    def still(rs, frm):
        rs = [r for r in (rs or []) if tr and tr + frm <= r['t'] <= tr + 9.5]          # (from frm to 9.5 s after the reset: a busy page's rows can run later)
        return {'rows': len(rs),
                'ownDeathActive': sum(1 for r in rs if r['own'] and r['own']['a']),
                'caught': sum(1 for r in rs if r['caught']),
                'replayOfOldDeath': sum(1 for r in rs if any(f[1] == de for f in r['fx'])),
                'oldStainStamped': sum(1 for r in rs if r['st'] and de in r['st']),
                'anyStainStamped': sum(1 for r in rs if r['st']),
                'receiverNonEmpty': sum(1 for r in rs if (r['rc'] or 0) > 0),
                'oldCorpseShown': sum(1 for r in rs if any(x[0] in (str(aid), 'r' + str(aid)) for x in r['bd'])),
                'deadLightsLit': sum(1 for r in rs if r['dl'] > 0),
                'ownDyingLightLit': sum(1 for r in rs if (r['ownPw'] or 0) > 0),
                'lastAnything': max([r['t'] - tr for r in rs if (r['own'] and r['own']['a']) or any(f[1] == de for f in r['fx']) or (r['st'] and de in r['st'])
                                     or any(x[0] in (str(aid), 'r' + str(aid)) for x in r['bd']) or r['dl'] > 0 or (r['ownPw'] or 0) > 0] or [None], key=lambda v: -1 if v is None else v)}
    return {'de': de, 'resetSentAt': tr, 'deathSeenByAdminAt': a.get('sawDeath'),
                     'before': {nm: {'stained': any(r['st'] and de in r['st'] for r in rows[nm] if tr and r['t'] < tr),
                                     'replayOrDeath': any((r['own'] and r['own']['a']) or any(f[1] == de for f in r['fx']) for r in rows[nm] if tr and r['t'] < tr)} for nm in rows},
                     'from0.5s': {nm: still(rows[nm], .5) for nm in rows}, 'from1.5s': {nm: still(rows[nm], 1.5) for nm in rows},
                     'positionsAfter': {nm: (rows[nm][-1]['x'], rows[nm][-1]['y']) if rows[nm] else None for nm in rows}}


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq2/reset_epoch.py', 'case': 'R01 world reset mid Hound C wall death', 'game': A_.game, 'after': A_.after}
    Q = ('&' + A_.query) if A_.query else ''
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            await ca.add_init_script("try{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{}'),{kind:'flashlight'})))}catch(e){}")
            A = await L.join(ca, port, 'h2reset', 'Alice', errs, Q); await L.admin_open(A)
            B = await L.join(cb, port, 'h2reset', 'Bob', errs, Q)
            C = await L.join(cc, port, 'h2reset', 'Carol', errs, Q)
            aid = await A.evaluate("()=>__api.H.id")
            for P in (B, C): await L.admin_cmd(A, {'c': 'god', 'id': await P.evaluate("()=>__api.H.id")})
            await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1200)
            await L.ensure_alive(A); await L.auto_revive(A, False)
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            S = await A.evaluate(L.FACE_SPOT, ['S', 90, 0]); R['spot'] = S
            await L.clear_monsters(A); await L.ensure_alive(A); await L.place(A, S['x'], S['y'], S['a'], W, H)
            V = await B.evaluate(L.VIEW_SPOT, S); R['view'] = V
            for P in (B, C):
                if V: await L.place(P, V[0] + (0 if P is B else 40), V[1], V[2], W, H)
                if await P.evaluate("()=>__api.lightOn()"): await P.keyboard.press('KeyF')
            if not await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
            for P in (A, B, C): await P.evaluate(SAMPLER)
            await A.wait_for_timeout(2000)
            adm = A_.out + '.world.json'
            proc = subprocess.Popen(['node', os.path.join(HERE, '..', 'stage-3d-hq1', 'ws_admin.js'), '--port', str(port), '--room', 'h2reset', '--pass', L.PASS,
                                     '--victim', str(aid), '--cmd', 'world', '--after', str(A_.after), '--out', adm], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            await A.wait_for_timeout(600)
            since = await A.evaluate("()=>Date.now()/1000")
            seen = await L.preview(A, 'hound', 'C', timeout=12); R['previewSeen'] = seen
            T0 = time.time()
            while time.time() - T0 < 15 and not os.path.exists(adm): await A.wait_for_timeout(100)
            try: proc.wait(20)
            except subprocess.TimeoutExpired: proc.kill()
            a = json.load(open(adm)) if os.path.exists(adm) else {}; R['admin'] = a
            tr = a.get('sent')
            shots = {}
            if tr:
                for label, dt in (('reset+0.6s', .6), ('reset+3s', 3.0)):
                    while time.time() < tr + dt: await A.wait_for_timeout(40)
                    if A_.shots:
                        os.makedirs(A_.shots, exist_ok=True)
                        for nm, P in (('alice', A), ('bob', B), ('carol', C)):
                            f = os.path.join(A_.shots, f'{nm}_{label}.png'); await P.screenshot(path=f); shots.setdefault(label, {})[nm] = os.path.basename(f)
                while time.time() < tr + 9: await A.wait_for_timeout(200)
            R['shots'] = shots
            rows = {nm: await P.evaluate(ROWS, since) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
            R['rows'] = rows
            R['measured'] = measure(R)
            R['pageErrors'] = errs[:20]
            await b.close()
    finally:
        L.stop_server(srv)
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    m = R.get('measured', {})
    print(json.dumps({k: m.get(k) for k in ('de', 'before', 'from1.5s')}, indent=1))


if A_.reanalyse:
    R = json.load(open(A_.reanalyse)); R['measured'] = measure(R)
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    print(json.dumps({k: R['measured'].get(k) for k in ('de', 'before', 'from1.5s')}, indent=1))
else:
    asyncio.run(main())
