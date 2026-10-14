#!/usr/bin/env python3
"""Stage 3E-0 - two real browsers: what Bob's page shows of Alice while she moves, collides and comes back (development only; SwiftShader)

  python3 -I dev/stage-3e-0/two_browser.py --game DIR --out FILE.json [--mode bplus|b|a] [--lag MS] [--expect same|old-server|old-client]

Alice and Bob are ordinary players (no test passcode: the server checks every step), placed by a quiet admin connection in the one-tile
corridor of Level 0 at y=720 (HQ2's): Bob stands still at x=1012 facing west, Alice starts at x=862.  Bob's page opens with ?peers=MODE
(his own presentation only) and, with --lag, talks to the server through HQ2's lag_proxy.js (MS each way).  Alice, with her own keyboard
and mouse:
  1. walks east into Bob (the server stops her at contact), 2. backs off, sprints into him and stops dead, 3. turns a full circle fast,
  4. crouches and walks back, stands, 5. runs west and slides, 6. reloads her page (a new connection), 7. an admin WORLD reset;
  8. (B+) four crafted 'q' handed to Bob's page: an old world's, one not newer than the newest, an unknown player's, a malformed one - each
  dropped, nobody moved, no avatar made.
On Bob's page, at the end of every frame BR-RoLE draws (its draw wrapped, read-only): Alice's avatar (position, hands, beam), her light as
the page hands it to BR-RoLE, BR-RoLE's cast and contact jobs for her, mp.js's pose for her (drawn and target, __peerNet) and the bodies
Bob's movement steers round (__peerBodies).  Checked:
  - one pose: avatar = drawn pose (B / B+; in A a snapshot sets the drawn position on arrival and the avatar takes it at the next frame);
    BR-RoLE's jobs for her at the avatar; her light at the avatar's beam;
  - the bodies Bob steers round are the server's newest positions (the target), never the drawn pose;
  - Bob's screen never shows her inside him (drawn distance >= the bodies' contact distance less 2 px), and she did reach him (<= 45 px:
    otherwise the setup failed and the contact was never tested);
  - after her reload: her old id gone, one avatar for her; after the reset: the same; 0 page errors;
  - B+: 'q' received and applied (B / A: none, and no 'caps' asked).
--expect for mixed versions (Bob's page in the default mode):
  - old-server: a new mp.js on the HQ5 server: Bob asks ('caps') once, is never answered, gets no 'q', stays at 50 ms; every check above
    except 'q' received; the crafted 'q' are still dropped;
  - old-client: HQ5's mp.js on the new server: Bob never asks and gets no 'q'.  HQ5's page has no __peerNet, so the checks that need
    mp.js's pose (avatar = drawn pose, bodies = target) cannot run there; the rest (jobs at the avatar, light at the beam, never inside
    him, reload, reset, 0 errors) do.
Writes FILE.json (and the server log beside it)."""
import os, sys, asyncio, argparse, json, time, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--mode', default='bplus'); ap.add_argument('--lag', type=int, default=0)
ap.add_argument('--expect', default='same', choices=['same', 'old-server', 'old-client'])
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 480, 320
Y, XA, XB = 720, 862, 1012
SPY = r"""(()=>{ const W0=window.WebSocket; const S=window.__e0spy={n:{},sent:{}};
  window.WebSocket=function(u,p){ const ws=p===undefined?new W0(u):new W0(u,p); S.ws=ws; const snd=ws.send.bind(ws);
    ws.send=d=>{ try{ const m=JSON.parse(d); S.sent[m.t]=(S.sent[m.t]||0)+1; }catch(e){} return snd(d); };
    ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); S.n[m.t]=(S.n[m.t]||0)+1; }catch(err){} }); return ws; };
  window.WebSocket.prototype=W0.prototype; Object.assign(window.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}); })()"""
HOOK = r"""() => { if (window.__e0rec) return; const R = window.__e0rec = []; const B = window.__brRole, d0 = B.draw;
  B.draw = function () { const r = d0.apply(this, arguments);
    try { const L = __api.layer(), avs = L.children.filter(v => v && typeof v.deathPose === 'function' && v.visible && !('__cause' in v));
      const pn = window.__peerNet ? window.__peerNet() : null, pl = window.__peerLights || [], pb = (window.__peerBodies || []).map(b => [b[0], b[1]]);
      const jobs = (B.actors() || []).filter(j => !j.self).map(j => [j.x, j.y]), con = B.dev.contacts ? B.dev.contacts().filter(j => !j.self).map(j => [j.x, j.y]) : [];
      R.push({ t: performance.now(), me: [__api.H.x, __api.H.y], avs: avs.map(v => ({ x: v.x, y: v.y, beam: v.beam ? [v.beam.x, v.beam.y, v.beam.angle] : null, h: v.hands.map(h => [h.x, h.y]) })),
        pl: pl.map(l => [l.x, l.y, l.angle]), pn: pn ? pn.peers : null, pb, jobs, con });
      if (R.length > 6000) R.splice(0, 1000); } catch (e) { R.push({ err: String(e) }); }
    return r; }; }"""


def admin_once(port, room, cmd):
    return subprocess.run(['node', os.path.join(HERE, 'ws_admin_once.js'), '--port', str(port), '--room', room, '--pass', Q.PASS, '--cmd', json.dumps(cmd)], capture_output=True, text=True, timeout=20).stdout.strip()


async def hold(P, keys, ms):
    for k in keys: await P.keyboard.down(k)
    await P.wait_for_timeout(ms)
    for k in reversed(keys): await P.keyboard.up(k)


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []; room = 'e0two'
    R = {'tool': 'dev/stage-3e-0/two_browser.py', 'mode': A_.mode, 'lag': A_.lag, 'expect': A_.expect, 'game': A_.game, 'phases': []}
    prox = None; bport = port
    if A_.lag:
        bport = Q.lib3d.free_port()
        prox = subprocess.Popen(['node', os.path.join(HERE, '..', 'stage-3d-hq2', 'lag_proxy.js'), '--listen', str(bport), '--to', str(port), '--ms', str(A_.lag)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        prox.stdout.readline()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            ca, cb = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(2)]
            for c in (ca, cb): await c.add_init_script(SPY)
            A = await Q.join(ca, port, room, 'Alice', errs); aid = await A.evaluate("()=>__api.H.id")
            Q.place(port, room, (), god=(aid,), clear=True)
            Bq = '' if A_.mode == 'bplus' else '&peers=' + A_.mode
            B = await Q.join(cb, bport, room, 'Bob', errs, query=Bq); bid = await B.evaluate("()=>__api.H.id")
            for P in (A, B): await P.evaluate("() => window.__brRole && __brRole.setQuality('low')")
            Q.place(port, room, [(bid, XB, Y), (aid, XA, Y)], god=(aid, bid), clear=True)
            await A.wait_for_timeout(1800 + 4 * A_.lag)
            for P, a in ((A, 0.0), (B, 3.1416)): await Q.lib3d.aim(P, a, W, H)
            R['ids'] = {'alice': aid, 'bob': bid}; R['bobPeerNet0'] = await B.evaluate("()=>window.__peerNet?{mode:__peerNet().mode,fast:__peerNet().fast}:null")
            await B.evaluate(HOOK)
            async def phase(name, fn):
                t0 = await B.evaluate("()=>performance.now()"); await fn(); await A.wait_for_timeout(500 + 2 * A_.lag)
                R['phases'].append({'name': name, 't0': t0, 't1': await B.evaluate("()=>performance.now()")})
            await A.bring_to_front()
            await phase('walk into Bob', lambda: hold(A, ['KeyD'], 2500))
            async def sprint():
                await hold(A, ['KeyA'], 900); await hold(A, ['ShiftLeft', 'KeyD'], 1100)
            await phase('back off, sprint into him, stop dead', sprint)
            async def turn():
                c = await A.evaluate("() => { const w = __api.floor().parent, av = w.children.find(c => typeof c.deathPose === 'function'); const g = av.toGlobal({ x: 0, y: 0 }); return [g.x, g.y] }")
                for k in range(16): t = k / 16 * 2 * math.pi; await A.mouse.move(c[0] + 120 * math.cos(t), c[1] + 120 * math.sin(t)); await A.wait_for_timeout(60)
            await phase('turn a full circle fast', turn)
            async def crouch():
                await A.keyboard.press('KeyC'); await A.wait_for_timeout(250); await hold(A, ['KeyA'], 700); await A.keyboard.press('KeyC')
            await phase('crouch, walk back, stand', crouch)
            async def slide():
                await A.keyboard.down('ShiftLeft'); await A.keyboard.down('KeyA'); await A.wait_for_timeout(500); await A.keyboard.press('KeyC'); await A.wait_for_timeout(700)
                await A.keyboard.up('KeyA'); await A.keyboard.up('ShiftLeft')
            await phase('run west and slide', slide)
            R['beforeReload'] = {'bobPeerNet': await B.evaluate("()=>window.__peerNet?__peerNet():null"), 'bobSpy': await B.evaluate("()=>window.__e0spy?{n:__e0spy.n,sent:__e0spy.sent}:null"),
                                 'aliceSpy': await A.evaluate("()=>window.__e0spy?{n:__e0spy.n,sent:__e0spy.sent}:null"), 'alicePeerNet': await A.evaluate("()=>window.__peerNet?{mode:__peerNet().mode,fast:__peerNet().fast,counts:__peerNet().counts}:null")}
            rec = await B.evaluate("()=>window.__e0rec.slice()")
            # reconnect: Alice's page reloads (a new connection, a new id)
            await A.reload(); await A.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=90000); await A.wait_for_timeout(1200)
            if await A.evaluate("()=>!!(window.__ui && window.__ui.version)"):
                await A.evaluate("()=>window.__ui.go('play')"); await A.wait_for_selector('#name', state='visible', timeout=30000)
            await A.fill('#name', 'Alice'); await A.click('#enter'); await A.wait_for_timeout(2500 + 2 * A_.lag)
            aid2 = await A.evaluate("()=>__api.H.id")
            R['afterReload'] = {'aliceNewId': aid2, 'bobPeers': await B.evaluate("()=>window.__peerNet?__peerNet().peers.map(p=>p.id):null"),
                                'bobAvatars': await B.evaluate("()=>__api.layer().children.filter(v=>v&&typeof v.deathPose==='function'&&v.visible&&!('__cause' in v)).length")}
            R['worldReset'] = admin_once(port, room, {'c': 'world'}); await B.wait_for_timeout(2500 + 2 * A_.lag)
            R['afterReset'] = {'bobPeers': await B.evaluate("()=>window.__peerNet?__peerNet().peers.map(p=>p.id):null"), 'bobPeerNet': await B.evaluate("()=>window.__peerNet?{counts:__peerNet().counts,lastK:__peerNet().lastK}:null"),
                               'bobAvatars': await B.evaluate("()=>__api.layer().children.filter(v=>v&&typeof v.deathPose==='function'&&v.visible&&!('__cause' in v)).length"),
                               'bobEpoch': await B.evaluate("()=>window.__epochDebug?window.__epochDebug():null")}
            if A_.mode == 'bplus' and A_.expect != 'old-client':               # B+: crafted 'q' handed to Bob's page as if from the server: each must be dropped
                R['injected'] = await B.evaluate("""(aid) => { const ws = window.__e0spy.ws, pn0 = __peerNet(), me = pn0.peers.find(p => p.id === aid); if (!me) return null;
                  const w = __epochDebug().w, k = pn0.lastK, send = m => ws.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(m) }));
                  const before = { tx: me.tx, ty: me.ty, counts: pn0.counts };
                  send({ t: 'q', w: w - 1, k: k + 1, p: [[aid, me.tx + 50, me.ty, 0]] });     // an old world
                  send({ t: 'q', w: w, k: k, p: [[aid, me.tx + 50, me.ty, 0]] });             // not newer than the newest seen
                  send({ t: 'q', w: w, k: k + 1, p: [[999999, me.tx, me.ty, 0]] });           // somebody unknown (never a new avatar)
                  send({ t: 'q', w: w, k: k + 2, p: [[aid, 'x', null, 0]] });                 // malformed
                  const pn1 = __peerNet(), me1 = pn1.peers.find(p => p.id === aid);
                  return { before, after: { tx: me1.tx, ty: me1.ty, counts: pn1.counts }, peers: pn1.peers.map(p => p.id),
                           avatars: __api.layer().children.filter(v => v && typeof v.deathPose === 'function' && v.visible && !('__cause' in v)).length }; }""", aid2)
            R['frames'] = len(rec)
            # the checks, frame by frame
            one = coloc_job = coloc_con = coloc_light = pb_target = pb_drawn_differs = 0; n_av = 0; worst = {'av': 0, 'job': 0, 'light': 0, 'pb': 0}; drawn_d = []; errs_hook = [r['err'] for r in rec if 'err' in r]
            for r in rec:
                if 'err' in r or not r['avs']: continue
                if not r['pn'] and A_.expect != 'old-client': continue
                av = r['avs'][0]; pe = next((q for q in r['pn'] if q['id'] == aid), None) if r['pn'] else None
                if r['pn'] and not pe: continue
                n_av += 1
                if pe: e = math.hypot(av['x'] - pe['x'], av['y'] - pe['y']); worst['av'] = max(worst['av'], e); one += e < .01
                if r['jobs']:
                    e = min(math.hypot(j[0] - av['x'], j[1] - av['y']) for j in r['jobs']); worst['job'] = max(worst['job'], e); coloc_job += e < .01
                if r['con']:
                    coloc_con += min(math.hypot(j[0] - av['x'], j[1] - av['y']) for j in r['con']) < .01
                if av['beam'] and r['pl']:
                    e = min(math.hypot(l[0] - av['beam'][0], l[1] - av['beam'][1]) for l in r['pl']); worst['light'] = max(worst['light'], e); coloc_light += e < .01
                if r['pb'] and pe:
                    e = min(math.hypot(q[0] - pe['tx'], q[1] - pe['ty']) for q in r['pb']); worst['pb'] = max(worst['pb'], e); pb_target += e < .01
                    pb_drawn_differs += min(math.hypot(q[0] - pe['x'], q[1] - pe['y']) for q in r['pb']) > .5
                drawn_d.append(math.hypot(av['x'] - r['me'][0], av['y'] - r['me'][1]))
            R['checks'] = {'framesWithAlice': n_av, 'avatarIsDrawnPose': one, 'castJobAtAvatar': coloc_job, 'contactJobAtAvatar': coloc_con, 'lightAtBeam': coloc_light,
                           'bodiesAreServerTarget': pb_target, 'bodiesDifferFromDrawn': pb_drawn_differs, 'worst': {k: round(v, 4) for k, v in worst.items()},
                           'drawnDistanceToBobMin': round(min(drawn_d), 2) if drawn_d else None, 'hookErrors': errs_hook[:3]}
            fps = [(rec[i + 1]['t'] - rec[i]['t']) for i in range(len(rec) - 1) if 'err' not in rec[i] and 'err' not in rec[i + 1]]
            R['bobFrameMsMedian'] = sorted(fps)[len(fps) // 2] if fps else None
            R['pageErrors'] = errs[:20]
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
        if prox: prox.terminate()
    c = R['checks']; bn = R['beforeReload']['bobPeerNet'] or {}; bs = R['beforeReload']['bobSpy'] or {}
    qn = (bs.get('n') or {}).get('q', 0); caps = (bs.get('sent') or {}).get('caps', 0)
    oc = A_.expect == 'old-client'; inj = A_.mode == 'bplus' and not oc
    R['ok'] = bool(c['framesWithAlice'] > 20 and (A_.mode == 'a' or oc or c['avatarIsDrawnPose'] == c['framesWithAlice']) and c['worst']['job'] < .01 and c['worst']['light'] < .01 and c['worst']['pb'] < .01
                   and (oc or c['bodiesAreServerTarget'] == c['framesWithAlice'])
                   and 34 <= (c['drawnDistanceToBobMin'] or 0) <= 45 and R['afterReload']['bobAvatars'] == 1 and aid not in (R['afterReload']['bobPeers'] or [])
                   and R['afterReset']['bobAvatars'] == 1 and not R['pageErrors'] and not c['hookErrors']
                   and (not inj or (R.get('injected') and R['injected']['after']['tx'] == R['injected']['before']['tx'] and R['injected']['after']['counts']['qStale'] - R['injected']['before']['counts']['qStale'] == 2
                        and R['injected']['after']['counts']['qUnknown'] - R['injected']['before']['counts']['qUnknown'] == 2 and R['injected']['avatars'] == 1))
                   and ((A_.expect == 'same' and A_.mode == 'bplus' and qn > 0 and (bn.get('counts') or {}).get('qApplied', 0) > 0 and bn.get('fast'))
                        or (A_.expect == 'same' and A_.mode != 'bplus' and qn == 0 and caps == 0)
                        or (A_.expect == 'old-server' and qn == 0 and caps == 1 and (bs.get('n') or {}).get('caps', 0) == 0 and bn.get('fast') is False and bn.get('sendMs') == 50)
                        or (oc and qn == 0 and caps == 0 and not bn)))
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    print(json.dumps({'mode': A_.mode, 'lag': A_.lag, 'expect': A_.expect, 'ok': R['ok'], 'checks': c, 'bobFrameMsMedian': R['bobFrameMsMedian'], 'q': qn, 'caps': caps, 'counts': bn.get('counts'), 'fast': bn.get('fast'),
                      'afterReload': R['afterReload'], 'afterReset': {k: R['afterReset'][k] for k in ('bobPeers', 'bobAvatars')}, 'reset': R['worldReset'], 'errors': R['pageErrors'][:3]}))


asyncio.run(main())
