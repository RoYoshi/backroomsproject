#!/usr/bin/env python3
"""Stage 3D HQ1 - a dead wanderer's light through reconnects, reloads, a second death, a revive and a world reset (development only)

  python3 -I dev/stage-3d-hq1/light_lifecycle.py --game DIR --out FILE.json [--query ...]

Alice (admin; the victim, flashlight on), Bob (admin; watches), Carol (watches).  Bob and Carol are in god mode, and so is Alice while she
waits between deaths (out of it for each death: a page in god mode never starts its own death), so only the deaths the test plays happen.  Every page runs an in-page sampler
(every frame: the epoch time, the victim's own dying light power, every dead light's power in window.__peerLights) and the light's
anchor per death (window.__deathLight.debug: the moment the light was let go, on that page's clock; with the page's epoch, comparable
across pages).  Hound A deaths in an open room, lamps on.
  1  death 1.  At once Alice's window loses focus, is hidden and resized, and comes back.  At release + 1 s Bob's WebSocket is closed under him (the game reconnects by itself); at release + 1.5 s Carol's page
     is RELOADED (a new page: it learns the death again from the server, the replay's 'el' or the corpse's age).  Both keep the light's
     timeline: their light ends within 150 ms of Alice's, and lit frames never come after it
  2  death 2 (death 1's light is out by then): death 2 has its own timeline - a new anchor, lit in its own hold on every screen (not
     ended at once by death 1's clock) - one dead light per screen, and death 1's corpse is replaced by death 2's
  3  death 3 after every light is out; Alice is revived 1.5 s after the death begins (mid-death: the admin command is sent by a
     WebSocket client doing nothing else, ws_admin.js): no dead light on any screen afterwards, no corpse
  4  death 4; 2 s after it begins (the death playing, its light in its hold) the world is reset (NEW RUN FOR EVERYONE, by ws_admin.js): no dead light on Bob's or Carol's screen afterwards.
     Alice's own screen is recorded separately (known D7: an admin world reset keeps the victim's own local corpse, and its light
     follows it, ending at the same moment as anywhere)
The harness keeps real monsters out of it: the monsters are cleared before each death, as soon as the lab's auto-revive stands Alice up,
and when Bob is back; Alice is in god mode from the moment she is up.  Every death the server made is compared with the four the test
played ('deathsOnTheServer'): an unplanned one (a real monster kill) makes the run a harness fault to repeat, never a pass.
Exit 0 only if every check holds and no unplanned death happened (the victim-after-reset line is reported under 'known')."""
import os, re, sys, asyncio, argparse, json, time, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True); ap.add_argument('--query', default='')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 960, 640
WRAPWS = "(()=>{ const O=window.WebSocket; window.__wsList=[]; window.WebSocket=function(u,p){ const w=p===undefined?new O(u):new O(u,p); window.__wsList.push(w); return w }; window.WebSocket.prototype=O.prototype; Object.assign(window.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}) })()"
SAMPLER = r"""()=>{ if(window.__hq1s) return 'already'; const S=window.__hq1s={rows:[]};
  const tick=()=>{ try{ const A=window.__api, d=A&&A.death&&A.death(), act=!!(d&&d.active), pl=window.__peerLights||[], dead=[];
      for(const p of pl) if(p&&p.pw!=null) dead.push(+(+p.pw).toFixed(4));
      const own=act&&window.__deathLight&&A.lightOn&&A.lightOn()?+(+window.__deathLight.own()).toFixed(4):null;
      S.rows.push([+(Date.now()/1000).toFixed(3),own,dead]); if(S.rows.length>60000) S.rows.splice(0,20000) }catch(e){ S.err=String(e) }
    requestAnimationFrame(tick) };
  requestAnimationFrame(tick); return 'ok' }"""
ROWS = "(since)=>window.__hq1s?window.__hq1s.rows.filter(r=>r[0]>=since):null"
DEBUG = "()=>window.__deathLight&&window.__deathLight.debug?window.__deathLight.debug():null"
REL = "()=>{ const d=__api.death(), S=d&&d.ph; if(!S||!d.active) return null; const r=window.__dphys.releaseOf(S); return r==null?null:+r.toFixed(4) }"
NOW = "()=>Date.now()/1000"
HIDE = "()=>{ Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')) }"
SHOW = "()=>{ Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) }"


def anchor(dbg, de):
    if not dbg: return None
    for k, v in dbg['anchors']:
        if str(k) == str(de): return round(dbg['epoch'] + v, 4)
    return None


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq1/light_lifecycle.py', 'game': A_.game, 'steps': [], 'checks': [], 'known': []}
    Q = ('&' + A_.query) if A_.query else ''
    def check(name, ok, info): R['checks'].append({'step': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + '  ' + json.dumps(info)[:400], flush=True)
    def known(name, ok, info): R['known'].append({'step': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'KNOWN-D7 ') + name + '  ' + json.dumps(info)[:400], flush=True)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            for c in (ca, cb, cc): await c.add_init_script(WRAPWS)
            await ca.add_init_script("try{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{}'),{kind:'flashlight'})))}catch(e){}")
            A = await L.join(ca, port, 'hq1ll', 'Alice', errs, Q); await L.admin_open(A)
            B = await L.join(cb, port, 'hq1ll', 'Bob', errs, Q); await L.admin_open(B); await B.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            C = await L.join(cc, port, 'hq1ll', 'Carol', errs, Q)
            aid = await A.evaluate("()=>__api.H.id")
            for P in (B, C): await L.admin_cmd(A, {'c': 'god', 'id': await P.evaluate("()=>__api.H.id")})   # (harness: no real monster kills a watcher)
            agod = {'on': False}
            async def god_alice(on):                                             # (harness) Alice in god mode while she waits between deaths, so no real monster
                if agod['on'] != on:                                             # kills her; out of it for each death (a page in god mode never starts its death)
                    agod['on'] = on; await L.admin_cmd(A, {'c': 'god', 'id': aid}); await A.wait_for_timeout(250)   # (set first: two callers never toggle twice)
            async def up_and_safe():
                t1 = time.time()
                while time.time() - t1 < 25 and not await A.evaluate("()=>!__api.G.caught && __api.fall()<0"): await A.wait_for_timeout(200)
                await god_alice(True)
            await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1200)
            await L.clear_monsters(A); await L.ensure_alive(A); await L.auto_revive(A, True)
            spot = await A.evaluate(L.lib3d.SPOTS, 'open'); R['spot'] = spot
            wb = await B.evaluate(L.lib3d.WATCH_FROM, spot)
            for P in (A, B, C): await P.evaluate(SAMPLER)

            async def die(admin=None):
                await god_alice(False)
                await L.clear_monsters(A); await L.ensure_alive(A); await L.place(A, spot[0], spot[1], spot[2], W, H)
                for P in (B, C): await L.place(P, wb[0], wb[1], wb[2], W, H)
                if not await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
                for P in (B, C):
                    if await P.evaluate("()=>__api.lightOn()"): await P.keyboard.press('KeyF')
                await A.wait_for_timeout(1500)
                if admin:                                                         # an admin command a set time after the death begins, from a WebSocket client
                    admin['file'] = A_.out + f".{admin['cmd']}.json"              # doing nothing else (ws_admin.js), so it lands mid-death however slow the pages are
                    admin['proc'] = subprocess.Popen(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ws_admin.js'), '--port', str(port), '--room', 'hq1ll', '--pass', L.PASS,
                                                      '--victim', str(aid), '--cmd', admin['cmd'], '--after', str(admin['ms']), '--out', admin['file']], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    await A.wait_for_timeout(600)
                t = await A.evaluate(NOW)
                seen = await L.preview(A, 'hound', 'A', timeout=8 if admin else 20)
                if not seen and not admin: raise SystemExit('preview refused: ' + L.lib3d.last_preview(A_.out + '.server.log'))
                # (with a revive or reset coming 1.5-2 s into the death, a page this busy may never get to show the death at all: that is the case under test)
                rel = None; T0 = time.time()
                while time.time() - T0 < 6:
                    rel = await A.evaluate(REL)
                    if rel is not None: break
                    await A.wait_for_timeout(30)
                dbg = await A.evaluate(DEBUG); own = dbg['own'] if dbg else None
                return {'since': t, 'T0': T0, 'rel': rel, 'de': own and own['de'], 'lf': own and own['lf'], 'anchorA': anchor(dbg, own and own['de'])}
            async def frames(P, since): return await P.evaluate(ROWS, since)
            def lit_after(rows, off, col=2): return sum(1 for r in rows if r[0] > off + .05 and (max(r[2] or [0]) > 0 or (r[1] or 0) > 0))
            def last_lit(rows):
                ts = [r[0] for r in rows if max(r[2] or [0]) > 0 or (r[1] or 0) > 0]; return max(ts) if ts else None

            # ---- 1: reconnect and reload during the hold
            D1 = await die(); R['death1'] = D1; hold, fade = D1['lf'][0], D1['lf'][1]
            async def guard_when_up():                                            # (harness) the moment the lab's auto-revive stands Alice up: god mode and the
                t1 = time.time()                                                  # monsters cleared, so no real monster kills anyone while step 1's checks run
                while time.time() - t1 < 40 and not await A.evaluate("()=>!__api.G.caught && __api.fall()<0"): await A.wait_for_timeout(150)   # (HQ1-3: a real
                await god_alice(True); await L.clear_monsters(A)                  # Hound B killed Alice, then the reconnected Bob, between death 1 and death 2)
            guard = asyncio.create_task(guard_when_up())
            preA = anchor(await A.evaluate(DEBUG), D1['de'])                       # the victim, during her death: her window loses focus, is hidden and resized, then back
            await A.evaluate(HIDE); await A.set_viewport_size({'width': 800, 'height': 540}); await A.wait_for_timeout(500)
            await A.set_viewport_size({'width': W, 'height': H}); await A.evaluate(SHOW); await A.wait_for_timeout(300)
            postA = anchor(await A.evaluate(DEBUG), D1['de'])
            while time.time() - D1['T0'] < D1['rel'] + 1.0: await A.wait_for_timeout(20)
            preB = anchor(await B.evaluate(DEBUG), D1['de'])
            await B.evaluate("()=>{ const w=window.__wsList.filter(w=>w.readyState===1); w.forEach(w=>w.close()); return w.length }")
            while time.time() - D1['T0'] < D1['rel'] + 1.5: await A.wait_for_timeout(20)
            preC = anchor(await C.evaluate(DEBUG), D1['de'])
            await C.reload(); await C.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=90000)
            if await C.evaluate("()=>!!(window.__ui && window.__ui.version)"):
                await C.evaluate("()=>window.__ui.go('play')"); await C.wait_for_selector('#name', state='visible', timeout=30000)
                await C.fill('#name', 'Carol'); await L.enter(C)
            await C.evaluate(SAMPLER); await L.admin_cmd(A, {'c': 'god', 'id': await C.evaluate("()=>__api.H.id")})
            await L.place(C, wb[0], wb[1], wb[2], W, H)
            if await C.evaluate("()=>__api.lightOn()"): await C.keyboard.press('KeyF')
            for _ in range(60):                                                   # Bob back on a new connection: a new player to the server, so (harness) his
                if await B.evaluate("()=>window.__wsList.filter(w=>w.readyState===1).length"): break   # test passcode and god mode again
                await B.wait_for_timeout(250)
            await B.wait_for_timeout(800); await B.evaluate("p=>window.__net && __net.testAuth && __net.testAuth(p)", L.PASS); await B.wait_for_timeout(300)
            await L.admin_cmd(A, {'c': 'god', 'id': await B.evaluate("()=>__api.H.id")}); await L.clear_monsters(A)
            await guard; await up_and_safe()
            while time.time() - D1['T0'] < (D1['rel'] or 0) + hold + fade + 2.5: await A.wait_for_timeout(100)
            postB = anchor(await B.evaluate(DEBUG), D1['de']); postC = anchor(await C.evaluate(DEBUG), D1['de']); finA = anchor(await A.evaluate(DEBUG), D1['de'])
            fin = {'alice': finA, 'bob': postB, 'carol': postC}
            offA = min(v for v in fin.values() if v) + hold + fade                # the end, by the earliest page (a busy page's first estimate can only be late)
            reconnected = await B.evaluate("()=>window.__wsList.filter(w=>w.readyState===1).length")
            fB = await frames(B, D1['since']); fC = await frames(C, D1['since'] - 5); fA = await frames(A, D1['since'])
            spread = round((max(fin.values()) - min(fin.values())) * 1000, 1) if all(fin.values()) else None
            info = {'aliceFirstAnchor': D1['anchorA'], 'finalAnchors': fin, 'finalSpreadMs': spread, 'aliceFocusResize': {'before': preA, 'after': postA}, 'bob': {'before': preB, 'after': postB, 'reconnectedSockets': reconnected, 'lastLit': last_lit(fB), 'litAfterEnd': lit_after(fB, offA)},
                    'carol': {'before': preC, 'afterReload': postC, 'lastLit': last_lit(fC), 'litAfterEnd': lit_after(fC, offA)}, 'aliceLastLit': last_lit(fA), 'end': offA, 'lf': D1['lf']}
            R['steps'].append({'step': '1 reconnect + reload', **info})
            check('1 focus lost / hidden / resized (Alice, dying), a dropped connection (Bob) and a reloaded page (Carol) keep the light\'s timeline: no anchor ever moves later, the three end within 150 ms of each other, nothing lit after the end',
                  spread is not None and spread <= 150 and preB and preA and D1['anchorA'] and preB - postB >= -.0015 and preA - postA >= -.0015 and D1['anchorA'] - finA >= -.0015 and reconnected >= 1
                  and info['bob']['litAfterEnd'] == 0 and info['carol']['litAfterEnd'] == 0 and lit_after(fA, offA) == 0, info)
            # ---- 2: a second death while the first corpse's light may still shine
            await L.auto_revive(A, True)
            t1 = time.time()
            while time.time() - t1 < 20 and not await A.evaluate("()=>!__api.G.caught && __api.fall()<0"): await A.wait_for_timeout(200)
            await god_alice(True)
            D2 = await die(); R['death2'] = D2
            while time.time() - D2['T0'] < 9: await A.wait_for_timeout(100)
            bodies = {w: await P.evaluate(L.BODIES) for w, P in (('alice', A), ('bob', B), ('carol', C))}
            a2 = {w: anchor(await P.evaluate(DEBUG), D2['de']) for w, P in (('bob', B), ('carol', C))}
            h2 = D2['lf'][0]
            fr2 = {w: await frames(P, D2['since']) for w, P in (('alice', A), ('bob', B), ('carol', C))}
            own2 = dict(a2, alice=anchor(await A.evaluate(DEBUG), D2['de']))
            inHold = {w: [r for r in v if own2[w] and own2[w] + .3 < r[0] < own2[w] + h2 - .1] for w, v in fr2.items()}     # each screen's hold, by its own anchor
            litInHold = {w: sum(1 for r in v if (max(r[2] or [0]) == 1 or r[1] == 1)) for w, v in inHold.items()}
            notFull = {w: sum(1 for r in v if (r[2] or r[1] is not None) and not (max(r[2] or [0]) == 1 or r[1] == 1)) for w, v in inHold.items()}
            maxDead = {w: max([len(r[2] or []) for r in v] or [0]) for w, v in fr2.items()}
            info = {'de1': D1['de'], 'de2': D2['de'], 'anchor1': D1['anchorA'], 'anchor2': D2['anchorA'], 'anchors2': own2, 'lf2': D2['lf'],
                    'framesInHold': {w: len(v) for w, v in inHold.items()}, 'litFramesInHold': litInHold, 'framesNotFullInHold': notFull, 'mostDeadLightsInOneFrame': maxDead,
                    'corpses': {w: [(x['de'], x['lf']) for x in v] for w, v in bodies.items()}}
            R['steps'].append({'step': '2 second death', **info})
            check('2 a second death has its own timeline (a new anchor; every screen shows its light at full power in its own hold, never dimmed by death 1\'s clock), one dead light per screen, one corpse (death 2\'s)',
                  D2['de'] != D1['de'] and D2['anchorA'] and abs(D2['anchorA'] - D1['anchorA']) > 3 and all(own2.values()) and max(own2.values()) - min(own2.values()) <= .15
                  and all(litInHold[w] > 0 for w in ('bob', 'carol')) and not any(notFull.values()) and all(m <= 1 for m in maxDead.values())
                  and all([x['de'] for x in v] == [D2['de']] for k, v in bodies.items() if k != 'alice'), info)
            # ---- 3: a revive mid-death (every light out first)
            while time.time() - D2['T0'] < D2['rel'] + D2['lf'][0] + D2['lf'][1] + 1: await A.wait_for_timeout(200)
            t1 = time.time()
            while time.time() - t1 < 20 and not await A.evaluate("()=>!__api.G.caught && __api.fall()<0"): await A.wait_for_timeout(200)
            await god_alice(True)
            await L.auto_revive(A, False)
            ad = {'cmd': 'revive', 'ms': 1500}; D3 = await die(admin=ad); R['death3'] = D3
            try: ad['proc'].wait(60)
            except Exception: pass
            wa = json.load(open(ad['file'])) if os.path.exists(ad['file']) else {}
            tr = wa.get('sent'); D3['admin'] = wa; D3['reviveAfterKillRecordS'] = round(tr - D3['since'], 2) if tr else None
            if wa.get('de') is not None and wa['de'] != D3['de']: D3['dePage'] = D3['de']; D3['de'] = wa['de']; D3['anchorA'] = None   # (her page never showed it: the server's id)
            await A.wait_for_timeout(10000)
            fr = {w: await frames(P, tr + 1.5) for w, P in (('alice', A), ('bob', B), ('carol', C))}
            info = {'de3': D3['de'], 'revive': {'sent': tr, 'sawTheDeath': wa.get('sawDeath'), 'answer': wa.get('answer'), 'afterTheRelease': round(tr - D3['anchorA'], 2) if tr and D3.get('anchorA') else None}, 'litFramesFrom1.5sAfterRevive': {w: sum(1 for r in v if max(r[2] or [0]) > 0 or (r[1] or 0) > 0) for w, v in fr.items()}, 'frames': {w: len(v) for w, v in fr.items()},
                    'corpses': {w: [x['de'] for x in await P.evaluate(L.BODIES)] for w, P in (('alice', A), ('bob', B), ('carol', C))}}
            R['steps'].append({'step': '3 revive mid-death', **info})
            check('3 an admin revive mid-death: no dead light on any screen from 1.5 s after it (10 s watched), no corpse for that death',
                  all(v == 0 for v in info['litFramesFrom1.5sAfterRevive'].values()) and all(n >= 5 for n in info['frames'].values()) and all(D3['de'] not in v for v in info['corpses'].values()), info)
            # ---- 4: a world reset during the hold
            await L.auto_revive(A, True)
            ad4 = {'cmd': 'world', 'ms': 2000}; D4 = await die(admin=ad4); R['death4'] = D4        # the reset 2 s into her death: the death playing, its light in its hold
            try: ad4['proc'].wait(60)
            except Exception: pass
            wa4 = json.load(open(ad4['file'])) if os.path.exists(ad4['file']) else {}
            sinceReset = wa4.get('sent') or await A.evaluate(NOW); D4['admin'] = wa4
            if wa4.get('de') is not None and wa4['de'] != D4['de']: D4['dePage'] = D4['de']; D4['de'] = wa4['de']; D4['anchorA'] = None
            await A.wait_for_timeout(2500)
            hadLight = [r for r in await frames(B, D4['since']) if r[0] < sinceReset and max(r[2] or [0]) > 0]
            back = {w: await L.place(P, wb[0], wb[1], wb[2], W, H, tries=2) for w, P in (('bob', B), ('carol', C))}     # back where the corpse was (if the new world lets them)
            off4 = (wa4.get('sawDeath') or sinceReset) + 1.71 + 7 + 2                  # the latest any light of this death could end (release <= 1.71 s, hold <= 7, fade <= 2)
            while time.time() < off4 + 1.5: await A.wait_for_timeout(200)
            fr = {w: await frames(P, sinceReset + 1.5) for w, P in (('alice', A), ('bob', B), ('carol', C))}
            info = {'de4': D4['de'], 'resetAt': sinceReset, 'resetAfterTheDeathBegan': round(sinceReset - wa4['sawDeath'], 2) if wa4.get('sawDeath') else None, 'resetAnswer': wa4.get('answer'), 'bobLitFramesBeforeReset': len(hadLight), 'placedBackNearTheCorpse': back, 'corpsesAfter': {w: [x['de'] for x in await P.evaluate(L.BODIES)] for w, P in (('bob', B), ('carol', C))}, 'litFramesFrom1.5sAfterReset': {w: sum(1 for r in v if max(r[2] or [0]) > 0) for w, v in fr.items()}, 'end': off4,
                    'aliceLastLit': last_lit(fr['alice']), 'aliceOwnLocalCorpses': await A.evaluate("()=>(__api.bodyList()||[]).filter(b=>!b.remote&&b.cause!=='Vanish').map(b=>String(b.id))")}
            R['steps'].append({'step': '4 world reset', **info})
            check('4 a world reset during the hold: no dead light on the other screens from 1.5 s after it', hadLight and info['litFramesFrom1.5sAfterReset']['bob'] == 0 and info['litFramesFrom1.5sAfterReset']['carol'] == 0, info)
            known('4b the victim\'s own screen after a world reset: no dead light', info['litFramesFrom1.5sAfterReset']['alice'] == 0,
                  {'litFrames': info['litFramesFrom1.5sAfterReset']['alice'], 'lastLit': info['aliceLastLit'], 'end': off4, 'endsOnTime': info['aliceLastLit'] is None or info['aliceLastLit'] <= off4 + .001,
                   'why': 'D7 keeps the victim\'s own local corpse through an admin world reset; its light follows it and still ends at the death\'s end'})
            await b.close()
    finally:
        L.stop_server(srv)
    # (harness) every death the server made, against the four the test played: a real monster kill in between would add dead lights and corpses
    # the checks do not expect, so it is reported as a harness fault (the run must be repeated), never passed
    try: srvlog = open(A_.out + '.server.log').read()
    except Exception: srvlog = ''
    planned = {d.get('de') for d in (R.get(k) or {} for k in ('death1', 'death2', 'death3', 'death4'))} - {None}
    seen = sorted({int(m) for m in re.findall(r'\bde=(\d+)', srvlog)} | planned)
    R['deathsOnTheServer'] = {'planned': sorted(planned), 'highestDe': max(seen) if seen else None, 'unplanned': sorted(set(range(1, (max(seen) if seen else 0) + 1)) - planned),
                              'corpseLines': re.findall(r'\[death\][^\n]*', srvlog)[:20]}
    R['errors'] = errs[:20]; R['ok'] = len(R['checks']) == 4 and all(c['ok'] for c in R['checks']) and not R['deathsOnTheServer']['unplanned']
    if R['deathsOnTheServer']['unplanned']: print('HARNESS: deaths the test did not play (real monster kills): de ' + str(R['deathsOnTheServer']['unplanned']) + ' - the run must be repeated')
    L.dump(A_.out, R); print('LIGHT LIFECYCLE OK' if R['ok'] else 'LIGHT LIFECYCLE NOT OK'); sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
