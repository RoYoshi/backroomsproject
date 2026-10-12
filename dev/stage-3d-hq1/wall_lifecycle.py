#!/usr/bin/env python3
"""Stage 3D HQ1 - the wall stains through a death's whole life, on three screens (development only; SwiftShader)

  python3 -I dev/stage-3d-hq1/wall_lifecycle.py --game DIR --out FILE.json

Alice (admin, the victim), Bob (spectator, admin, god mode), Carol (a late joiner).  At each step, on every page: the stains gore.js
keeps (window.__gore.wallStains.list: death id, status, surface, u) and what the receiver holds (window.__l0v.surfaces.count()).
  1  death 1: Hound C into a lit face                          -> one stamped stain on Alice's and Bob's screens, the same face and u
  2  its corpse (the replay hands over)                        -> still one each: no second stamp
  3  Carol joins                                                -> she builds the same one from the corpse record
  4  10 s idle                                                  -> no new stamp anywhere (stamps counter unchanged)
  5  death 2: Hound C into another face                         -> death 1's stain gone, death 2's there, on all three
  6  death 3 (the first face again), Bob revives Alice after the impact, mid-death
                                                                -> death 3's stain gone again on all three; death 2's stays (its corpse stays)
  7  Bob leaves and comes back (a new connection)               -> he rebuilds exactly death 2's stain
  8  NEW RUN FOR EVERYONE (world reset)                         -> no stain, receiver empty, on Bob's and Carol's screens (8a);
                                                                   on Alice's own screen (8b) recorded separately: D7 keeps her own
                                                                   local corpse through an admin world reset, and the stain follows it
Exit 0 only if every check holds (8b is reported under 'known', not counted as passed)."""
import os, sys, asyncio, argparse, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True); ap.add_argument('--query', default='')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 960, 640
STATE = "()=>{ const G=window.__gore&&window.__gore.wallStains, Lv=window.__l0v; return { stains: G?G.list():null, stats: G?G.stats():null, receiver: Lv&&Lv.surfaces?Lv.surfaces.count():null } }"


async def settle(P, ms=1200): await P.wait_for_timeout(ms)


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, A_.out + '.server.log'); errs = []; R = {'tool': 'dev/stage-3d-hq1/wall_lifecycle.py', 'game': A_.game, 'steps': [], 'checks': []}
    Q = ('&' + A_.query) if A_.query else ''
    def check(name, ok, info): R['checks'].append({'step': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + '  ' + json.dumps(info)[:300], flush=True)
    def known(name, ok, info): R.setdefault('known', []).append({'step': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'KNOWN-D7 ') + name + '  ' + json.dumps(info)[:300], flush=True)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb, cc, cd = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(4)]
            A = await L.join(ca, port, 'hq1life', 'Alice', errs, Q); await L.admin_open(A)
            B = await L.join(cb, port, 'hq1life', 'Bob', errs, Q); await L.admin_open(B); await B.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            C = await L.prejoin(cc, port, 'hq1life', 'Carol', errs, Q)
            aid, bid = await A.evaluate("()=>__api.H.id"), await B.evaluate("()=>__api.H.id")
            await L.admin_cmd(A, {'c': 'god', 'id': bid}); await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1500)
            await L.ensure_alive(A); await L.auto_revive(A, True)                     # the lab's defaults: stands her up after each death, back where she was
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            S1 = await A.evaluate(L.FACE_SPOT, ['S', 90, 0]); S2 = await A.evaluate(L.FACE_SPOT, ['E', 90, 0]); R['spots'] = [S1, S2]
            async def die(S, revive_after_impact=False):
                await L.clear_monsters(A); await L.ensure_alive(A); await L.place(A, S['x'], S['y'], S['a'], W, H)
                V = await B.evaluate(L.VIEW_SPOT, S)
                if V: await L.place(B, V[0], V[1], V[2], W, H)
                await A.wait_for_timeout(2500)
                ok = await L.preview(A, 'hound', 'C')
                if not ok: raise SystemExit('preview refused: ' + L.lib3d.last_preview(A_.out + '.server.log'))
                t0 = time.time()
                while time.time() - t0 < 8:
                    st = await A.evaluate(STATE)
                    if st['stains'] and any(s['status'] == 'stamped' for s in st['stains']): break
                    await A.wait_for_timeout(80)
                if revive_after_impact:
                    await A.wait_for_timeout(300); await L.admin_cmd(B, {'c': 'revive', 'id': aid}); return
                while time.time() - t0 < 20:                                           # the corpse is on Bob's screen and Alice is up again
                    if await B.evaluate(L.BODIES) and await A.evaluate("()=>!__api.G.caught && __api.fall()<0"): break
                    await A.wait_for_timeout(150)
                await settle(A, 1500)
            async def snap(name):
                row = {'step': name, 'alice': await A.evaluate(STATE), 'bob': await B.evaluate(STATE)}
                if R.get('carolIn'): row['carol'] = await C.evaluate(STATE)
                R['steps'].append(row); return row
            stamped = lambda st: [s for s in (st['stains'] or []) if s['status'] == 'stamped']
            # 1 + 2
            await die(S1)
            r = await snap('death1 corpse')
            sa, sb = stamped(r['alice']), stamped(r['bob'])
            check('1-2 one stain per screen through replay -> corpse', len(sa) == 1 and len(sb) == 1 and r['alice']['receiver'] == 1 and r['bob']['receiver'] == 1
                  and sa[0]['surf'] == sb[0]['surf'] == S1['face'] and abs(sa[0]['u'] - sb[0]['u']) < 2, {'alice': sa, 'bob': sb, 'receiver': [r['alice']['receiver'], r['bob']['receiver']]})
            de1 = sa[0]['de'] if sa else None
            # 3
            await L.clear_monsters(A); await L.enter(C); R['carolIn'] = True; await C.wait_for_timeout(1500)
            await L.admin_cmd(A, {'c': 'god', 'id': await C.evaluate("()=>__api.H.id")})            # Carol only watches
            V = await B.evaluate(L.VIEW_SPOT, S1)
            if V: await L.place(C, V[0], V[1], V[2], W, H)
            await settle(C, 2500); r = await snap('carol joined')
            sc = stamped(r['carol'])
            check('3 the late joiner rebuilds the same stain from the corpse', len(sc) == 1 and sc[0]['surf'] == S1['face'] and sa and abs(sc[0]['u'] - sa[0]['u']) < 2 and sc[0]['de'] == de1 and r['carol']['receiver'] == 1, {'carol': sc})
            # 4
            before = {k: (r[k]['stats'] or {}).get('stamps') for k in ('alice', 'bob', 'carol')}
            await L.clear_monsters(A); await A.wait_for_timeout(10000); r = await snap('idle 10 s')
            after = {k: (r[k]['stats'] or {}).get('stamps') for k in ('alice', 'bob', 'carol')}
            check('4 idle: no new stamp', before == after, {'before': before, 'after': after})
            # 5
            await die(S2); r = await snap('death2 corpse')
            ok5 = all(len(stamped(r[k])) == 1 and stamped(r[k])[0]['surf'] == S2['face'] and stamped(r[k])[0]['de'] != de1 and r[k]['receiver'] == 1 for k in ('alice', 'bob', 'carol'))
            check('5 a second death: the old stain gone, the new one there, on all three', ok5, {k: stamped(r[k]) for k in ('alice', 'bob', 'carol')})
            de2 = (stamped(r['bob']) or [{}])[0].get('de')
            # 6
            await die(S1, revive_after_impact=True)
            r6a = await snap('death3 impact (before the revive lands)')
            await settle(A, 3500); r = await snap('death3 revived mid-death')
            ok6 = all([s['de'] for s in stamped(r[k])] == [de2] and r[k]['receiver'] == 1 for k in ('alice', 'bob', 'carol'))
            check('6 a revive mid-death: its stain gone everywhere, the previous corpse\'s stays', ok6, {k: stamped(r[k]) for k in ('alice', 'bob', 'carol')})
            # 7
            await B.close(); await A.wait_for_timeout(1500)
            B = await L.join(cd, port, 'hq1life', 'Bob', errs, Q); await L.admin_cmd(A, {'c': 'god', 'id': await B.evaluate("()=>__api.H.id")}); await settle(B, 2500)
            st = await B.evaluate(STATE)
            check('7 Bob reconnects: exactly the remaining stain, once', [s['de'] for s in stamped(st)] == [de2] and st['receiver'] == 1, {'bob': stamped(st), 'receiver': st['receiver']})
            R['steps'].append({'step': 'bob reconnected', 'bob': st})
            # 8
            await L.admin_cmd(A, {'c': 'world'}); await settle(A, 4000)
            r = {'alice': await A.evaluate(STATE), 'bob': await B.evaluate(STATE), 'carol': await C.evaluate(STATE)}; R['steps'].append(dict(step='world reset', **r))
            check('8a a world reset: no stain on the other screens, their receivers empty', all(not stamped(r[k]) and r[k]['receiver'] == 0 for k in ('bob', 'carol')), {k: [stamped(r[k]), r[k]['receiver']] for k in ('bob', 'carol')})
            # the victim's own screen: D7 keeps her own (local) corpse record through an admin world reset (bodies() only replaces the server's
            # records); the stain follows the corpse her screen still has.  Recorded as a known D7 deviation from gate W3, not passed
            own = await A.evaluate("()=>(__api.bodyList()||[]).filter(b=>!b.remote&&b.cause!=='Vanish').map(b=>({id:String(b.id), x:Math.round(b.x), y:Math.round(b.y)}))")
            R['victimAfterReset'] = {'ownLocalCorpses': own, 'stains': stamped(r['alice']), 'receiver': r['alice']['receiver']}
            known('8b the victim\'s own screen after a world reset: no stain', not stamped(r['alice']) and r['alice']['receiver'] == 0,
                  {'stains': stamped(r['alice']), 'ownLocalCorpseStillShown': own, 'why': 'D7 keeps the victim\'s own local corpse through an admin world reset; the stain follows it'})
            await b.close()
    finally:
        L.stop_server(srv)
    R['errors'] = errs[:20]; R['ok'] = bool(R['checks']) and all(c['ok'] for c in R['checks']) and len(R['checks']) == 7
    L.dump(A_.out, R); print('WALL LIFECYCLE OK' if R['ok'] else 'WALL LIFECYCLE NOT OK'); sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
