#!/usr/bin/env python3
"""Stage 3D HQ2 - a full room of real browser pages: seven, then eight ordinary players, a slow one and a lagged one among them, crowding
one point, two NEW RUNs at the same moment, a late joiner (development only; SwiftShader: eight pages share two cores)

  python3 -I dev/stage-3d-hq2/multi_browser.py --game DIR --out FILE.json [--shots DIR] [--lag 100] [--slow 4]

Every page is an ordinary player (no test passcode), god mode on so no monster can interfere, the monsters removed; 480 x 320 each, the
game's low lighting quality (?lighting=low); each page has visited the game once before, alone (its 22.6 MB menu music in its own Cache
Storage, as on any second visit), and while P2-P7 load the pages already in are frozen for those few seconds (Chrome's page lifecycle); P8, the late joiner, runs in a second
browser (another machine's, as it were: a page starting up behind seven others' SwiftShader drawing can wait minutes for its renderer).
P6 is a slow client (Chrome's CPU throttling, --slow times slower); P7 talks to the server through lag_proxy.js (--lag ms each way).
Each page walks by the game's own key state (an autopilot sets W/A/S/D in __api.keys every frame towards its target, as held keys do).
  1  seven pages on a ring 150 px round a point on open floor walk into the point for 6 s and then home until all are out of the crowd
     (at least 6 s, at most 25 s), and stand until none moves; a quiet observer (the
     eighth connection: a room holds eight) records the server's own player list 20 times a second
  2  P1 and P2 press NEW RUN at the same moment
  3  the observer leaves; P8 opens the game after the blasts (the eighth player)
  4  P1 and P2 press SPAWN: eight players in the room; each walks 100 px out (the most open of four directions) and back
Every page's WebSocket traffic is recorded (a spy: test only), and each page's own view: where it is and how near the closest other
player is by its latest snapshot (window.__peerBodies, what its prediction uses).
Checks (exit 1 if any fails):
  C04  in every one of the observer's snapshots no two players are closer than D (whole px: >= 35.29); they pack round the point (all
       within 90 px of it) and all walk back out of the crowd (>= 80 px from it); nobody is told a hard tp while walking (soft only)
  E01  the two NEW RUNs at the same moment are both approved (two events); every page plays both blasts; both Boom corpses on every page
       (P8 included); nobody else is moved
  8    eight players: every page sees the seven others; the new spawns are >= 44 px from everyone; all eight walk out and back (>= 60 px
       each way, along the most open of four directions); in every snapshot two of the pages got, no two closer than D
  err  no page error on any page"""
import os, sys, asyncio, argparse, json, time, subprocess, signal, math, itertools
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True); ap.add_argument('--shots', default=None)
ap.add_argument('--lag', type=int, default=100); ap.add_argument('--slow', type=float, default=4)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 480, 320
ROOM = 'h25multi'
LOW = '&lighting=low'                                                     # (BR-RoLE's low lighting quality: eight pages on two cores)
PT = (4450, 3450)                                                         # open floor: a disc of radius 170 clear of every wall and prop
DMIN = 36 - math.sqrt(.5)
SPY = r"""(()=>{ const W0=window.WebSocket; const S=window.__wsSpy={rx:[], pos:[]};
  window.WebSocket=function(u,p){ const ws=p===undefined?new W0(u):new W0(u,p);
    ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data), t=+(Date.now()/1000).toFixed(3);
      if(m.t==='s'){ if(window.__spyPos) S.pos.push([t,(m.p||[]).filter(p=>!p.d).map(p=>[p.id,p.x,p.y])]); }
      else if(m.t!=='pong') S.rx.push([t,m.t,m.k||'',m.id==null?null:m.id,m.de==null?null:m.de,m.pc|0,m.ok==null?null:m.ok,m.el==null?null:m.el]); }catch(err){} });
    return ws };
  window.WebSocket.prototype=W0.prototype; Object.assign(window.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}); })()"""
AUTO = r"""()=>{ if(window.__auto) return 'already'; const S=window.__auto={target:null, on:false, was:false, rows:[]}, K=['KeyW','KeyA','KeyS','KeyD'];
  const L=()=>{ try{ const A=window.__api, q=A.keys;
      if(S.on&&S.target){ const dx=S.target[0]-A.H.x, dy=S.target[1]-A.H.y, w=new Set(); if(dx>5) w.add('KeyD'); if(dx<-5) w.add('KeyA'); if(dy>5) w.add('KeyS'); if(dy<-5) w.add('KeyW');
        for(const k of K){ if(w.has(k)) q.add(k); else q.delete(k) } }
      else if(S.was) for(const k of K) q.delete(k);
      S.was=S.on; const pb=window.__peerBodies||[]; let mn=Infinity; for(const p of pb) mn=Math.min(mn,Math.hypot(p[0]-A.H.x,p[1]-A.H.y));
      S.rows.push([+(Date.now()/1000).toFixed(3),+A.H.x.toFixed(1),+A.H.y.toFixed(1),pb.length,mn===Infinity?null:+mn.toFixed(1)]); if(S.rows.length>30000) S.rows.splice(0,10000) }catch(e){ S.err=String(e) }
    requestAnimationFrame(L) }; requestAnimationFrame(L); return 'ok' }"""
GO = "([x,y])=>{ window.__auto.target=[x,y]; window.__auto.on=true }"
STOP = "()=>{ window.__auto.on=false }"
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"
FREE = "()=>{ const A=__api, H=A.H; let b=null; for (const a of [0, Math.PI/2, Math.PI, -Math.PI/2]) { const d=A.Uc(H.x,H.y,a,240); if(!b||d>b.d) b={a,d:Math.round(d)} } return b }"   # (the most open of four directions: walls are wherever a new spawn put a page)
ME = "()=>({ id: __api.H.id, x: +__api.H.x.toFixed(1), y: +__api.H.y.toFixed(1), peers: (window.__peerBodies||[]).length, nr: window.__nrDebug?window.__nrDebug().last:null, booms: (__api.bodyList?__api.bodyList():[]).filter(b=>b.cause==='Boom').map(b=>String(b.ownerId)) })"


async def prewarm(ctx, port):
    """this page's first visit, alone: the game's menu music (22.6 MB) goes into the context's own Cache Storage, as on any second visit
    (eight first downloads with SwiftShader pages running starve the loading page past its boot gate)"""
    P = await ctx.new_page(); await P.goto(f'http://127.0.0.1:{port}/?room=h25warm', timeout=90000); n = 0
    for _ in range(240):
        n = await P.evaluate("async()=>{ let n=0; try{ for(const k of await caches.keys()) n+=(await (await caches.open(k)).keys()).length }catch(e){} return n }")
        if n >= 2: break
        await P.wait_for_timeout(500)
    await P.close(); return n


async def join(ctx, port, name, errs, diag):
    """hq2lib.join, past the boot gate if it asks for a key first (it does where the browser seems to want a gesture before sound - the
    lagged page here), and what the page shows if it does not get in"""
    try:
        P = await ctx.new_page()
        P.on('pageerror', lambda e: errs.append(name + ' pageerror: ' + str(e)[:300]))
        P.on('console', lambda m: errs.append(name + ' console: ' + m.text[:200]) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'favicon' not in m.text and 'fonts.g' not in m.text else None)
        await P.goto(f'http://127.0.0.1:{port}/?room={ROOM}{LOW}', timeout=90000)
        await P.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=180000); await P.wait_for_timeout(1200)
        for _ in range(60):
            st = await P.evaluate("()=>window.__boot&&window.__boot.state?window.__boot.state():null")
            if st not in ('black', 'loading', 'ready'): break
            if 'PRESS ANY KEY' in (await P.evaluate("()=>document.body.innerText") or ''): await P.keyboard.press('Space')
            await P.wait_for_timeout(500)
        await P.evaluate("()=>window.__ui.go('play')"); await P.wait_for_selector('#name', state='visible', timeout=60000)
        await P.fill('#name', name); await P.click('#enter')
        for _ in range(300):
            if await P.evaluate("()=>!!(window.__api && __api.started() && !document.getElementById('hud').hidden)"): break
            await P.wait_for_timeout(100)
        for _ in range(200):
            if await P.evaluate("()=>!!(window.__net && window.__net.on !== false)"): break
            await P.wait_for_timeout(100)
        for _ in range(200):
            if await P.evaluate("()=>__api.fall()<0"): break
            await P.wait_for_timeout(100)
        await P.wait_for_timeout(800)
        return P
    except Exception as e:
        for P in ctx.pages:
            try:
                diag[name] = {'error': str(e)[:300], 'text': (await P.evaluate("()=>document.body.innerText"))[:800], 'url': P.url}
                if A_.shots: await P.screenshot(path=os.path.join(A_.shots, f'join_failed_{name}.png'))
            except Exception as e2: diag[name] = {'error': str(e)[:300], 'diag': str(e2)[:200]}
        raise


async def settle(P, secs=15):
    """wait until no page moves any more (a page starved of frames finishes its last steps late)"""
    t0 = time.time(); last = None
    while time.time() - t0 < secs:
        now = [await P[i].evaluate("()=>[+__api.H.x.toFixed(1), +__api.H.y.toFixed(1)]") for i in sorted(P)]
        if last and all(abs(a[0] - b[0]) + abs(a[1] - b[1]) < .5 for a, b in zip(now, last)): break
        last = now; await P[sorted(P)[0]].wait_for_timeout(1200)
    await P[sorted(P)[0]].wait_for_timeout(300 + 2 * A_.lag)


def pairs_min(snaps, t0=0, t1=1e18, ids=None):
    m, n = None, 0
    for t, ps in snaps:
        if t < t0 or t > t1: continue
        ps = [p for p in ps if ids is None or p[0] in ids]; n += 1
        for a, b in itertools.combinations(ps, 2):
            d = math.hypot(a[1] - b[1], a[2] - b[2]); m = d if m is None or d < m else m
    return (round(m, 2) if m is not None else None), n


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []; prox = None; wproc = None
    R = {'tool': 'dev/stage-3d-hq2/multi_browser.py', 'game': A_.game, 'lagMs': A_.lag, 'slowX': A_.slow, 'point': PT, 'checks': []}
    chk = lambda name, ok, info=None: R['checks'].append({'name': name, 'ok': bool(ok), 'info': info})
    if A_.shots: os.makedirs(A_.shots, exist_ok=True)
    wf = A_.out + '.watch.json'; diag = R['joinFailures'] = {}
    try:
        aport = Q.lib3d.free_port()
        prox = subprocess.Popen(['node', os.path.join(HERE, 'lag_proxy.js'), '--listen', str(aport), '--to', str(port), '--ms', str(A_.lag)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        prox.stdout.readline()
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS); b8 = await p.chromium.launch(args=Q.ARGS)   # (P8, the late joiner, in a browser of its own: another
            ctx, P = {}, {}                                                    #  machine's; a page starting up behind seven others' SwiftShader drawing waits minutes)
            R['prewarm'] = {}
            for i in range(1, 9):
                ctx[i] = await (b8 if i == 8 else b).new_context(viewport={'width': W, 'height': H}); await ctx[i].add_init_script(SPY)
                R['prewarm'][i] = await prewarm(ctx[i], aport if i == 7 else port)
            cdp = {}
            async def freeze(on):                                              # (pages already in wait, frozen, while the next one loads: eight
                for i in cdp: await cdp[i].send('Page.setWebLifecycleState', {'state': 'frozen' if on else 'active'})   # SwiftShader pages starve a loading one)
            ids = {}
            for i in range(1, 8):
                await freeze(True); P[i] = await join(ctx[i], aport if i == 7 else port, f'P{i}', errs, diag); await freeze(False)
                ids[i] = await P[i].evaluate("()=>__api.H.id"); cdp[i] = await ctx[i].new_cdp_session(P[i])
                Q.place(port, ROOM, (), god=[ids[i]], clear=True)              # (god at once: no monster kills a page that waits for the others)
            R['ids'] = ids
            home = {i: (round(PT[0] + 150 * math.cos(i / 7 * 2 * math.pi + .3)), round(PT[1] + 150 * math.sin(i / 7 * 2 * math.pi + .3))) for i in range(1, 8)}
            Q.place(port, ROOM, [(ids[i], *home[i]) for i in range(1, 8)], clear=True)
            await cdp[6].send('Emulation.setCPUThrottlingRate', {'rate': A_.slow})
            for i in P: await P[i].evaluate(AUTO)
            for i in (3, 4): await P[i].evaluate("()=>{window.__spyPos=true}")
            wproc = Q.watch(port, ROOM, 600, wf); await P[1].wait_for_timeout(2500)
            R['placed'] = {i: await P[i].evaluate(ME) for i in P}
            # 1 - the crowd
            t1 = time.time()
            await asyncio.gather(*[P[i].evaluate(GO, list(PT)) for i in P]); await P[1].wait_for_timeout(6000)
            if A_.shots:
                for i in (1, 5, 7): await P[i].screenshot(path=os.path.join(A_.shots, f'1_crowd_P{i}.png'))
            t2 = time.time()
            await asyncio.gather(*[P[i].evaluate(GO, list(home[i])) for i in P]); th = time.time()
            while time.time() - th < 25:                                       # (until every page is out of the crowd: a page starved of frames
                pos = [await P[i].evaluate(ME) for i in P]                     #  moves only when it draws one)
                if all(math.hypot(q['x'] - PT[0], q['y'] - PT[1]) >= 80 for q in pos) and time.time() - th >= 6: break
                await P[1].wait_for_timeout(1000)
            R['secondsToLeaveTheCrowd'] = round(time.time() - th, 1)
            await asyncio.gather(*[P[i].evaluate(STOP) for i in P]); await settle(P)
            t3 = time.time()
            # 2 - two NEW RUNs at the same moment
            stay = {i: await P[i].evaluate(ME) for i in P}
            q = {i: await P[i].evaluate("()=>window.__nrDebug().q") for i in (1, 2)}
            tb = time.time(); R['pressed'] = await asyncio.gather(P[1].evaluate(PRESS), P[2].evaluate(PRESS))
            for _ in range(80):
                st = [await P[i].evaluate("(q)=>{ const d=window.__nrDebug(); return d.last && d.last.q>q ? d.last : null }", q[i]) for i in (1, 2)]
                if all(st): break
                await P[1].wait_for_timeout(100)
            R['answers'] = st
            await P[3].wait_for_timeout(1200)
            if A_.shots:
                for i in (3, 5): await P[i].screenshot(path=os.path.join(A_.shots, f'2_blasts_P{i}.png'))
            await P[3].wait_for_timeout(3200)
            moved = {i: await P[i].evaluate(ME) for i in range(3, 8)}
            # 3 - the observer leaves; P8 opens the game
            wproc.send_signal(signal.SIGTERM); wproc.wait(timeout=20); wproc = None; await P[3].wait_for_timeout(600)
            Q.place(port, ROOM, (), clear=True)                                # (the monsters away once more: P8 cannot be put in god mode - with it the room is full)
            P[8] = await join(ctx[8], port, 'P8', errs, diag); ids[8] = await P[8].evaluate("()=>__api.H.id"); await P[8].evaluate(AUTO)   # (not frozen now: pages frozen for long with their sockets still being written to stall the browser's network for a loading page)
            await P[8].wait_for_timeout(2500)
            late = await P[8].evaluate(ME)
            # 4 - eight players
            t4 = time.time(); R['spawned'] = [await P[i].evaluate(SPAWN) for i in (1, 2)]
            await P[1].wait_for_timeout(5000)
            eight = {i: await P[i].evaluate(ME) for i in P}
            t5 = time.time()
            way = {i: await P[i].evaluate(FREE) for i in P}; R['eightWays'] = way
            await asyncio.gather(*[P[i].evaluate(GO, [eight[i]['x'] + 100 * math.cos(way[i]['a']), eight[i]['y'] + 100 * math.sin(way[i]['a'])]) for i in P]); await P[1].wait_for_timeout(5000)
            if A_.shots:
                for i in (3, 8): await P[i].screenshot(path=os.path.join(A_.shots, f'4_eight_P{i}.png'))
            await asyncio.gather(*[P[i].evaluate(GO, [eight[i]['x'], eight[i]['y']]) for i in P]); await P[1].wait_for_timeout(7000)   # (the slowed page draws a frame every second or two)
            await asyncio.gather(*[P[i].evaluate(STOP) for i in P]); await P[1].wait_for_timeout(1500)
            t6 = time.time()
            back = {i: await P[i].evaluate(ME) for i in P}
            spy = {i: await P[i].evaluate("()=>window.__wsSpy") for i in P}
            own = {i: await P[i].evaluate("()=>window.__auto.rows") for i in P}
            await b.close(); await b8.close()
    except Exception:
        with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
        raise
    finally:
        if wproc: wproc.send_signal(signal.SIGTERM); wproc.wait(timeout=20)
        if prox: prox.terminate()
        Q.lib3d.stop_server(srv)
    WT = json.load(open(wf))
    snaps = [[t, [[p[0], p[3], p[4]] for p in pl if p[1] and not p[2]]] for t, pl in WT['pl']]
    pid = [ids[i] for i in range(1, 8)]
    m1, n1 = pairs_min(snaps, t1, t3, pid)
    def srv_at(i, t):
        for tt, pl in snaps:
            if tt >= t:
                for p in pl:
                    if p[0] == ids[i]: return [p[1], p[2]]
        return None
    packed = {i: round(math.hypot(srv_at(i, t2)[0] - PT[0], srv_at(i, t2)[1] - PT[1]), 1) if srv_at(i, t2) else None for i in range(1, 8)}
    homeOff = {i: round(math.hypot(srv_at(i, t3 - .2)[0] - home[i][0], srv_at(i, t3 - .2)[1] - home[i][1]), 1) if srv_at(i, t3 - .2) else None for i in range(1, 8)}
    outOf = {i: round(math.hypot(srv_at(i, t3 - .2)[0] - PT[0], srv_at(i, t3 - .2)[1] - PT[1]), 1) if srv_at(i, t3 - .2) else None for i in range(1, 8)}
    tps = {i: [r for r in spy[i]['rx'] if r[1] == 'tp' and t1 <= r[0] <= t3] for i in range(1, 8)}
    ownMin = {i: min([r[4] for r in own[i] if t1 <= r[0] <= t3 and r[4] is not None] or [None]) if any(r[4] is not None for r in own[i] if t1 <= r[0] <= t3) else None for i in range(1, 8)}
    R['crowd'] = {'serverMin': m1, 'snapshots': n1, 'distFromPointAfterPush': packed, 'offHomeAtEnd': homeOff, 'distFromPointAtEnd': outOf, 'corrections': {i: {'soft': sum(1 for r in tps[i] if r[5]), 'hard': sum(1 for r in tps[i] if not r[5])} for i in tps},
                  'ownScreenNearest': ownMin, 'slowPage': 6, 'laggedPage': 7}
    chk('C04 seven real pages (one CPU-throttled, one lagged) crowd one point: in every observer snapshot no two closer than D', m1 is not None and m1 >= DMIN and n1 > 150, {'min': m1, 'snapshots': n1})
    chk('C04 ...they pack round it (all within 90 px of the point) and all walk back out of the crowd (each >= 80 px from the point again, the ring was 150; within 25 s - a page starved of frames moves only when it draws one): nobody stuck',
        all(v is not None and v <= 90 for v in packed.values()) and all(v is not None and v >= 80 for v in outOf.values()), {'packed': packed, 'outOfTheCrowd': outOf, 'offHome': homeOff, 'secondsToLeave': R.get('secondsToLeaveTheCrowd'),
        'note': 'the autopilot sets keys once a frame: a page drawing a frame a second moves ~170 px between two of them, so "home" is not hit to the pixel'})
    chk('C04 ...soft corrections only: nobody is told a hard tp while walking', all(c['hard'] == 0 for c in R['crowd']['corrections'].values()), R['crowd']['corrections'])
    a1, a2 = R['answers']
    booms = {i: sorted({r[3] for r in spy[i]['rx'] if r[1] == 'fx' and r[2] == 'boom'}) for i in P}
    bfx = [f for f in WT['fx'] if f.get('k') == 'boom']
    corpses = {i: sorted(str(x).lstrip('r') for x in back[i]['booms']) for i in P}
    stayMoved = {i: round(math.hypot(moved[i]['x'] - stay[i]['x'], moved[i]['y'] - stay[i]['y']), 1) for i in moved}
    R['blasts'] = {'answers': R['answers'], 'observerBooms': [[f.get('id'), f.get('de')] for f in bfx], 'pageBooms': booms, 'lateJoiner': late, 'corpsesAtEnd': corpses, 'othersMoved': stayMoved}
    want = sorted([ids[1], ids[2]])
    chk('E01 two NEW RUNs at the same moment: both approved, two events', a1 and a2 and a1.get('ok') and a2.get('ok') and a1.get('de') != a2.get('de'), R['answers'])
    chk('E01 ...every page plays both blasts (P1-P7), the observer saw exactly two, and nobody else moved', all(set(want) <= set(booms[i]) for i in range(1, 8)) and len(bfx) == 2 and all(v <= 1 for v in stayMoved.values()), {'pageBooms': booms, 'observer': len(bfx), 'othersMoved': stayMoved})
    lateC = sorted(str(x).lstrip('r') for x in late['booms'])
    chk('E01 ...both Boom corpses on every page, the late joiner P8 included', set(str(x) for x in want) <= set(lateC) and all(set(str(x) for x in want) <= set(corpses[i]) for i in P), {'want': want, 'late': lateC, 'atEnd': corpses})
    snaps8 = spy[3]['pos'] + spy[4]['pos']; snaps8.sort(key=lambda s: s[0])
    m8, n8 = pairs_min(snaps8, t4 + 3, t6)
    sp = {i: eight[i] for i in P}; newSp = {i: round(min(math.hypot(sp[i]['x'] - sp[j]['x'], sp[i]['y'] - sp[j]['y']) for j in P if j != i), 1) for i in (1, 2, 8)}
    along = lambda i, x, y: (x - sp[i]['x']) * math.cos(way[i]['a']) + (y - sp[i]['y']) * math.sin(way[i]['a'])   # how far along its own way
    walked = {i: round(max((along(i, r[1], r[2]) for r in own[i] if t5 <= r[0] <= t6), default=0), 1) for i in P}
    cameBack = {i: round(walked[i] - along(i, back[i]['x'], back[i]['y']), 1) for i in P}
    backOff = {i: round(math.hypot(back[i]['x'] - sp[i]['x'], back[i]['y'] - sp[i]['y']), 1) for i in P}
    R['eight'] = {'peersSeen': {i: eight[i]['peers'] for i in P}, 'newSpawnNearest': newSp, 'walkedEast': walked, 'cameBackWest': cameBack, 'backOff': backOff, 'snapshotMin': m8, 'snapshots': n8, 'positions': sp}
    chk('8 eight players in the room: every page sees the seven others', all(eight[i]['peers'] == 7 for i in P), R['eight']['peersSeen'])
    chk('8 ...the new spawns (P1, P2 again; P8) are >= 44 px from everyone', all(v >= 44 for v in newSp.values()), newSp)
    chk('8 ...all eight walk (>= 60 px, each along the most open of four directions from where it stands) and back (>= 60 px); in every snapshot two pages got, no two closer than D',
        all(v >= 60 for v in walked.values()) and all(v >= 60 for v in cameBack.values()) and m8 is not None and m8 >= DMIN and n8 > 50, {'walked': walked, 'cameBack': cameBack, 'offStart': backOff, 'min': m8, 'snapshots': n8})
    R['errors'] = errs[:30]
    chk('err no page error on any page', not [e for e in errs if 'pageerror' in e], errs[:10])
    R['ok'] = all(c['ok'] for c in R['checks']); R['passed'] = sum(c['ok'] for c in R['checks']); R['total'] = len(R['checks'])
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for c in R['checks']: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'] + '  ' + json.dumps(c['info'])[:400])
    print(f"{R['passed']}/{R['total']} checks passed"); sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
