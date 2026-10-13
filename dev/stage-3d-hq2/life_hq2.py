#!/usr/bin/env python3
"""Stage 3D HQ2 - H2-6: the two lifecycle cases of the gate matrix no earlier run measured on real pages (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/life_hq2.py --game DIR --out FILE.json --case light|lab [--shots DIR]

Case `light` (E03 on a NEW RUN blast: "same on late join, rejoin, focus lost, room reset" - the late join and the reset were measured
at H2-2 / H2-4; this adds the rest).  Alice (light ON, flashlight) presses NEW RUN in front of a lit papered wall; Bob and Carol watch
(god mode, lights off).  While the dropped light lives:
  - at approval + 0.5 s Bob's WebSocket is closed under him (the game reconnects by itself and joins again: a new player to the
    server, D4), and his window loses focus, is hidden and resized; it comes back 1.5 s after he is in again;
  - once Bob is back in, Carol's page is RELOADED (a new page and connection: it learns the blast again from the server, the replay's
    'el' or the corpse's age).  (Not both at once: Alice is out of the world after her NEW RUN, and a room nobody is in starts a new
    world, which would take the corpse with it - the game's own rule, not this test.)
  - Alice presses SPAWN once Carol is back in.
Each moment is recorded against the light's release, hold and fade (these SwiftShader pages are slow: a reload takes ~30 s).  So that
the steps land inside the hold, the harness first makes admin world resets until the next blast's light holds at least 6 s (its
profile is the server's hash of the world's number and the event id).
Checks: no page's light anchor (window.__deathLight.debug: when the light was let go, on that page's clock) ever moves later; the three
pages' final anchors within 150 ms of each other (HQ1's L6 line); on each page, by its own anchor, the light full in its hold and
nothing lit after hold + fade; Bob hears the blast once and his reconnect does not play it again; Carol's reloaded page hears nothing (a late joiner) and shows
the one corpse and its wall stain; at the end every page shows exactly one Boom corpse of that event and no lit dead light.

Case `lab` (R03: "reset followed by ... low-FPS paused Death Lab -> only current epoch objects ...; every normal future death still
behaves as accepted HQ1").  Alice (the victim, flashlight ON) dies a Hound C wall death.  Bob's page has the Death Lab PAUSED and
Carol's at 0.25x (hq1lib.lab: the clock dphys reads, set as the panel's buttons set it; presentation only) from before the death.
3 s after the server's replay message (of a 4.3 s death: still in progress on the server) a WebSocket client doing nothing else
sends WORLD -> NEW RUN FOR EVERYONE (ws_reset.js).
3 s after both pages took in the reset their clocks go back to normal.  Then Alice dies again in the new world (Hound C at another
lit face), watched at the normal clock.
Checks: the lab really held Bob's replay and slowed Carol's; from the moment each page took in the reset, and again after the clocks
are restored, nothing of the old death is on any screen (replay, wall stain, corpse, dying light; Alice not dying, not caught); the
server sends one world message and the death's end, nothing of the old world after; no NEW RUN answer, no blast (R04); the new death
plays on every screen, leaves exactly one corpse of Alice with its event id and its wall stain on all three, and its light holds,
fails and is exactly 0 after hold + fade, the three anchors within 150 ms.
Exit 0 only if every check holds.  --reanalyse FILE recomputes the checks from a saved run (no browser)."""
import os, sys, asyncio, argparse, json, time, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hq2lib as Q
L = Q.L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True); ap.add_argument('--shots', default=None)
ap.add_argument('--case', required=True, choices=('light', 'lab')); ap.add_argument('--query', default='')
ap.add_argument('--reanalyse', default=None, help='recompute the checks from a saved run (no browser)')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 600, 400
ROOM = 'h2life'
SPY = r"""(()=>{ const W0=window.WebSocket; const S=window.__wsSpy={rx:[],tx:[],socks:[]};
  window.WebSocket=function(u,p){ const ws=p===undefined?new W0(u):new W0(u,p); S.socks.push(ws); const send=ws.send.bind(ws);
    ws.send=d=>{ try{ const m=JSON.parse(d); if(m.t!=='p'&&m.t!=='ping') S.tx.push([+(Date.now()/1000).toFixed(3),m.t]); }catch(e){} return send(d) };
    ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t!=='s'&&m.t!=='pong') S.rx.push([+(Date.now()/1000).toFixed(3),m.t,m.k||'',m.de==null?null:m.de,(m.t==='fx'?m.wn:m.w)==null?null:(m.t==='fx'?m.wn:m.w),m.id==null?null:m.id,m.el==null?null:m.el]); }catch(err){} }); return ws; };
  window.WebSocket.prototype=W0.prototype; Object.assign(window.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}); })()"""
SAMPLER = r"""()=>{ if(window.__h2l) return 'already'; const S=window.__h2l={rows:[], voice:[]};
  const E=window.__ents; if(E){ for(const k of ['boomVoice','deathVoice']) if(E[k]&&!E[k].__h2){ const f=E[k]; E[k]=function(){ S.voice.push([+(Date.now()/1000).toFixed(3),k]); return f.apply(this,arguments) }; E[k].__h2=1 } }
  S.iv=setInterval(()=>{ try{ const A=window.__api, d=A.death&&A.death(), G=window.__gore&&window.__gore.wallStains, dl=window.__deathLight;
      const act=!!(d&&d.active), ep=window.__epochDebug?window.__epochDebug():null;
      S.rows.push({ t:+(Date.now()/1000).toFixed(3), caught:!!A.G.caught, own:d?{a:act,e:+(d.elapsed||0).toFixed(2)}:null,
        ownPw: act&&dl&&A.lightOn&&A.lightOn()?+(+dl.own()).toFixed(3):null,
        fx:(window.__fxs||[]).filter(f=>f.k==='death'||f.k==='boom').map(f=>[f.id,f.de,f.jl?+f.jl.elapsed.toFixed(2):null,!!f.end,f.k]),
        st:G?G.list().filter(s=>s.status==='stamped').map(s=>s.de):null,
        bd:(A.bodyList?A.bodyList():[]).filter(b=>b.cause!=='Vanish').map(b=>[String(b.ownerId),b.remote?1:0,b.de==null?null:b.de,b.cause]),
        pw:(window.__peerLights||[]).filter(l=>l&&l.pw!=null).map(l=>+(+l.pw).toFixed(3)),
        lg:(()=>{ const q=dl&&dl.debug&&dl.debug(); return q?q.frame.map(e=>[String(e.de), +(q.epoch+e.now).toFixed(3), e.pw]):[] })(),
        ep: ep?[ep.w,ep.ends,ep.oldDropped,ep.at]:null, rm:!document.getElementById('runMenu').hidden, started:A.started?A.started():null,
        lab: window.__dlab?[!!window.__dlab.on,!!window.__dlab.paused,window.__dlab.speed]:null });
      if(S.rows.length>9000) S.rows.splice(0,3000) }catch(e){ S.err=String(e) } },100); return 'ok' }"""
ROWS = "(since)=>window.__h2l?{rows:window.__h2l.rows.filter(r=>r.t>=since),voice:window.__h2l.voice,err:window.__h2l.err||null}:null"
SPYGET = "()=>window.__wsSpy?{rx:window.__wsSpy.rx,tx:window.__wsSpy.tx,open:window.__wsSpy.socks.filter(w=>w.readyState===1).length,socks:window.__wsSpy.socks.length}:null"
DLDBG = "()=>window.__deathLight&&window.__deathLight.debug?window.__deathLight.debug():null"
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"
HIDE = "()=>{ Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')) }"
SHOW = "()=>{ Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) }"
DROP = "()=>{ const w=window.__wsSpy.socks.filter(w=>w.readyState===1); w.forEach(w=>w.close()); return w.length }"
PICK = r"""([de, faceJs])=>{ const D=window.__dphys, w=window.__nrDebug().w; const P=D.boomPlan(w, de), dx=Math.cos(P.d), dy=Math.sin(P.d);
  const F=eval(faceJs); let best=null;
  for(const side of ['N','S','E','W']) for(let skip=0; skip<4; skip++){ const S=F([side, 64, skip]); if(!S) break; const dot=-(S.ox*dx+S.oy*dy); if(!best||dot>best.dot) best=Object.assign({dot, side, skip}, S) }
  return { w, de, plan:P, spot:best } }"""


def anchor(dbg, de):
    if not dbg: return None
    for k, v in dbg['anchors']:
        if str(k) == str(de): return round(dbg['epoch'] + v, 4)
    return None


async def reenter(P, name):
    """a reloaded page back into the room (the name prompt, ENTER) as a new connection"""
    await P.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=90000); await P.wait_for_timeout(800)
    if await P.evaluate("()=>!!(window.__ui && window.__ui.version)"):
        await P.evaluate("()=>window.__ui.go('play')"); await P.wait_for_selector('#name', state='visible', timeout=30000)
    await P.fill('#name', name); await L.enter(P)


def light_checks(de, lf, pages):
    """the dropped / dying light of event `de` on each page, judged by that page's own anchor (the moment it holds the light was let go;
    the pages' anchors are gated against each other separately, within 150 ms): full in its hold, nothing lit after hold + fade
    (mp.js's own frame log).  pages: [(label, rows, anchor[, False: rows that stop before the end - a page reloaded during the hold])]"""
    out = {}
    for nm, rows, rel, *fin in pages:
        if not rel: out[nm] = {'anchor': None}; continue
        lg = sorted({(e[1], e[2]) for r in rows for e in r.get('lg', []) if e[0] == str(de)})
        out[nm] = {'computed': len(lg),
                   'fullInHold': sum(1 for t, p in lg if rel + .3 < t < rel + lf[0] - .1 and p >= 1),
                   'dimInHold': [round(t - rel, 3) for t, p in lg if rel + .3 < t < rel + lf[0] - .1 and p < 1],
                   'litAfterEnd': [round(t - rel, 3) for t, p in lg if p > 0 and t > rel + lf[0] + lf[1] + .02],
                   'lastLit': max([round(t - rel, 3) for t, p in lg if p > 0] or [None], key=lambda v: -1 if v is None else v),
                   'lastRowDeadLightsLit': sum(1 for p in (rows[-1]['pw'] if rows else []) if p > 0) if not fin or fin[0] else None}
    return out


async def case_light(b, port, R, errs):
    Qy = ('&' + A_.query) if A_.query else ''
    ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
    for c in (ca, cb, cc): await c.add_init_script(SPY)
    await ca.add_init_script("try{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{}'),{kind:'flashlight'})))}catch(e){}")
    A = await L.join(ca, port, ROOM, 'Alice', errs, Qy); await L.admin_open(A); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
    B = await L.join(cb, port, ROOM, 'Bob', errs, Qy); C = await L.join(cc, port, ROOM, 'Carol', errs, Qy)
    R['ids'] = {'alice': await A.evaluate("()=>__api.H.id"), 'bob': await B.evaluate("()=>__api.H.id"), 'carol': await C.evaluate("()=>__api.H.id")}
    for nm in ('bob', 'carol'): await L.admin_cmd(A, {'c': 'god', 'id': R['ids'][nm]})
    await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1000)
    await L.clear_monsters(A); await L.ensure_alive(A)
    for _ in range(80):
        if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
        await A.wait_for_timeout(250)
    # (harness) a light that holds at least 6 s, so the lifecycle steps below land inside its hold on these slow pages: the profile is the
    # server's hash of the world's number and the event id (dphys.lightProfile; the room's first event is 1), so admin world resets are
    # made before the test until the next blast's light holds that long - the game's own reset, nothing forced
    R['worldResetsForALongHold'] = 0
    for _ in range(16):
        w = await A.evaluate("()=>window.__nrDebug().w"); R['predictedLf'] = await A.evaluate("w=>window.__dphys.lightProfile(w, 1, 'flashlight')", w)
        if R['predictedLf'] and R['predictedLf'][0] >= 6: break
        await L.admin_cmd(A, {'c': 'world'}); R['worldResetsForALongHold'] += 1
        for _ in range(50):
            if await A.evaluate("w=>window.__nrDebug().w>w", w): break
            await A.wait_for_timeout(100)
        await A.wait_for_timeout(1200)
    await L.clear_monsters(A); await L.ensure_alive(A)
    for nm in ('bob', 'carol'): await L.admin_cmd(A, {'c': 'god', 'id': R['ids'][nm]})
    pick = await A.evaluate(PICK, [1, L.FACE_SPOT]); R['pick'] = pick; S = pick['spot']
    await L.place(A, S['x'], S['y'], S['a'], W, H)
    V = await B.evaluate(L.VIEW_SPOT, S); R['view'] = V
    for P, dx in ((B, 0), (C, 40)):
        if V: await L.place(P, V[0] + dx, V[1], V[2], W, H)
        if await P.evaluate("()=>__api.lightOn()"): await P.keyboard.press('KeyF')
    if not await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
    R['lightOn'] = await A.evaluate("()=>__api.lightOn()")
    wf = A_.out + '.watch.json'; wp = Q.watch(port, ROOM, 240, wf)
    for P in (A, B, C): await P.evaluate(SAMPLER)
    await A.wait_for_timeout(1500); await L.clear_monsters(A)
    since = await A.evaluate("()=>Date.now()/1000"); R['since'] = since
    await A.evaluate(PRESS); R['events'].append({'label': 'press', 't': time.time()})
    ack = None; t0 = time.time()
    while time.time() - t0 < 6 and not ack:
        ack = await A.evaluate("()=>{ const d=window.__nrDebug(); return d&&d.last&&d.last.ok?d.last:null }"); await A.wait_for_timeout(30)
    R['ack'] = ack; ta = ack['at'] if ack else time.time()
    async def till(dt):
        while time.time() < ta + dt: await A.wait_for_timeout(20)
    de = (ack or {}).get('de')
    ev = lambda label, **k: R['events'].append(dict({'label': label, 't': time.time(), 'sinceApproval': round(time.time() - ta, 2)}, **k))
    # Bob, at approval + 0.5 s: his connection dropped (the game reconnects by itself: a new player, which joins again), then his window
    # loses focus, is hidden and resized.  Carol's page is reloaded only once Bob is back in, so the room always has someone in it
    # (Alice is out of the world after her NEW RUN; a room nobody is in starts a new world, and with it the corpse would go - not this test)
    await till(.5)
    R['bobAnchorBeforeDrop'] = anchor(await B.evaluate(DLDBG), de)
    R['bobSocketsClosed'] = await B.evaluate(DROP); ev('bob: connection dropped'); tdrop = time.time()
    async def bob_hide():
        await B.evaluate(HIDE); await B.set_viewport_size({'width': W - 120, 'height': H - 80}); ev('bob: hidden, blurred, resized')
    hide = asyncio.create_task(bob_hide())
    for _ in range(120):                                                     # Bob back on a new connection, in the room again
        sp = await B.evaluate(SPYGET)
        if sp['open'] and any(m[1] == 'join' for m in sp['tx'] if m[0] > tdrop - 1): break
        await B.wait_for_timeout(100)
    ev('bob: reconnected and joined')
    await hide
    async def carol_reload():
        R['carolBeforeReload'] = {'anchor': anchor(await C.evaluate(DLDBG), de), **(await C.evaluate(ROWS, since))}
        ev('carol: reload'); await C.reload(); await reenter(C, 'Carol'); await C.evaluate(SAMPLER); ev('carol: back in')
        R['ids']['carol2'] = await C.evaluate("()=>__api.H.id"); await L.admin_cmd(A, {'c': 'god', 'id': R['ids']['carol2']})
        if V: await L.place(C, V[0] + 40, V[1], V[2], W, H)
        if await C.evaluate("()=>__api.lightOn()"): await C.keyboard.press('KeyF')
    reload = asyncio.create_task(carol_reload())
    await B.wait_for_timeout(1500)
    await B.set_viewport_size({'width': W, 'height': H}); await B.evaluate(SHOW); ev('bob: shown again')
    await B.evaluate("p=>window.__net && __net.testAuth && __net.testAuth(p)", L.PASS); await B.wait_for_timeout(300)   # (harness: the new player's test passcode and god mode)
    R['ids']['bob2'] = await B.evaluate("()=>__api.H.id"); await L.admin_cmd(A, {'c': 'god', 'id': R['ids']['bob2']}); await L.clear_monsters(A)
    await reload
    if A_.shots:
        os.makedirs(A_.shots, exist_ok=True)
        for nm, P in (('bob', B), ('carol_reloaded', C)): await P.screenshot(path=os.path.join(A_.shots, f'light_corpse_{nm}.png'))
    R['spawnPressed'] = await A.evaluate(SPAWN); ev('alice: SPAWN')
    await till(16.0); await A.wait_for_timeout(3000)                         # (the longest light: 7 s hold + 2 s fade; then a few rows more)
    if A_.shots:
        for nm, P in (('bob', B), ('carol_reloaded', C)): await P.screenshot(path=os.path.join(A_.shots, f'light_after_{nm}.png'))
    R['dl'] = {nm: await P.evaluate(DLDBG) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
    R['rowsAll'] = {nm: await P.evaluate(ROWS, since) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
    R['spy'] = {nm: await P.evaluate(SPYGET) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
    try: wp.send_signal(15); wp.wait(10)
    except Exception: wp.kill()
    R['watch'] = json.load(open(wf)) if os.path.exists(wf) else None


def checks_light(R):
    C = []
    def check(name, ok, info): C.append({'name': name, 'ok': bool(ok), 'info': info})
    ack = R.get('ack') or {}; de = ack.get('de')
    Wt = R.get('watch') or {'fx': [], 'bodies': []}; aid = R['ids']['alice']
    fx = [f for f in Wt['fx'] if f.get('k') == 'boom' and f.get('id') == aid]
    lf = fx[0].get('lf') if fx else None                                    # (the light profile, as the server sent it with the blast)
    R['rows'] = {nm: (R['rowsAll'][nm] or {}).get('rows') or [] for nm in R['rowsAll']}
    c1 = R.get('carolBeforeReload') or {}
    check('setup: one approved NEW RUN, its blast with a light profile (light ON); the blast on Bob\'s page before his connection was dropped and on Carol\'s before her reload',
          ack.get('ok') and lf and len(fx) == 1 and fx[0].get('de') == de and any(f[1] == de for r in R['rows']['bob'] if r['t'] < next((e['t'] for e in R['events'] if e['label'] == 'bob: connection dropped'), 0) for f in r['fx'])
          and any(f[1] == de for r in (c1.get('rows') or []) for f in r['fx']), {'de': de, 'lf': lf, 'blastsOnTheWire': len(fx), 'events': R['events']})
    dl = R.get('dl') or {}
    fin = {nm: anchor(dl.get(nm), de) for nm in ('alice', 'bob', 'carol')}
    preB, preC = R.get('bobAnchorBeforeDrop'), c1.get('anchor')
    spread = round((max(fin.values()) - min(fin.values())) * 1000, 1) if all(fin.values()) else None
    check('E03 one timeline through focus lost / hidden / resized (Bob), a dropped connection (Bob) and a reloaded page (Carol): no anchor ever moves later, the three pages\' final anchors within 150 ms (HQ1\'s L6 line)',
          spread is not None and spread <= 150 and preB and preC and preB - fin['bob'] >= -.0015, {'finalAnchors': fin, 'spreadMs': spread, 'bobBeforeDrop': preB, 'carolBeforeReload': preC})
    rel = min(v for v in fin.values() if v) if any(fin.values()) else None
    pages = [('alice', R['rows']['alice'], fin['alice']), ('bob', R['rows']['bob'], fin['bob']), ('carol before the reload', c1.get('rows') or [], preC, False), ('carol reloaded', R['rows']['carol'], fin['carol'])]
    L_ = light_checks(de, lf, pages) if lf else {}
    when = [dict(e, sinceRelease=round(e['t'] - rel, 2), inHold=bool(lf and e['t'] - rel < lf[0]), beforeTheEnd=bool(lf and e['t'] - rel < lf[0] + lf[1])) for e in R['events']] if rel else R['events']
    check('E03 the dropped light on every page, by the page\'s own anchor (Carol: her page before the reload and the reloaded one): full power in its hold (frames computed in the hold all at 1), nothing lit after hold + fade, no lit dead light at the end',
          L_ and all(v.get('anchor', 1) is not None for v in L_.values()) and all(not v['dimInHold'] and not v['litAfterEnd'] and v['lastRowDeadLightsLit'] in (0, None) for v in L_.values())
          and all(L_[nm]['fullInHold'] > 0 for nm in ('alice', 'bob', 'carol before the reload')),
          {'lf': lf, 'release': rel, 'pages': L_, 'when': when, 'worldResetsForALongHold': R.get('worldResetsForALongHold')})
    vB = [v for v in (R['rowsAll']['bob'] or {}).get('voice', []) if v[1] == 'boomVoice']; vC = [v for v in (R['rowsAll']['carol'] or {}).get('voice', []) if v[1] == 'boomVoice']
    vC1 = [v for v in c1.get('voice', []) if v[1] == 'boomVoice']
    rxB = [m for m in (R['spy']['bob'] or {}).get('rx', []) if m[1] == 'fx' and m[2] == 'boom' and m[3] == de]
    restarted = []
    last = None
    for r in R['rows']['bob']:
        e = next((f[2] for f in r['fx'] if f[1] == de and f[2] is not None), None)
        if e is not None and last is not None and e < last - .3: restarted.append([round(r['t'] - (ack.get('at') or 0), 2), last, e])
        if e is not None: last = e
    check('E04/E03 Bob\'s dropped connection: the game reconnected by itself; the blast is not played or heard again (one blast sound on his page, its replay never restarted), whatever the server resent his new connection',
          (R['spy']['bob'] or {}).get('open', 0) >= 1 and len(vB) == 1 and not restarted, {'socketsClosed': R.get('bobSocketsClosed'), 'openNow': (R['spy']['bob'] or {}).get('open'), 'blastSounds': len(vB), 'boomMessagesReceived': [[m[0], m[6]] for m in rxB], 'restarted': restarted})
    end = {nm: (R['rows'][nm][-1] if R['rows'][nm] else None) for nm in ('alice', 'bob', 'carol')}
    corpses = {nm: [b for b in (end[nm]['bd'] if end[nm] else []) if b[3] == 'Boom' and b[0] in (str(aid), 'r' + str(aid))] for nm in end}
    stains = {nm: bool(end[nm] and end[nm]['st'] and de in end[nm]['st']) for nm in end}
    check('E03 Carol\'s reloaded page (a late joiner: a new page and connection) hears nothing, and at the end every page shows exactly one Boom corpse of Alice with this event id, and its HQ1 wall stain',
          len(vC1) == 1 and not vC and all(len(v) == 1 and v[0][2] == de for v in corpses.values()) and all(stains.values()),
          {'carolBlastSoundsBeforeReload': len(vC1), 'carolBlastSoundsAfterReload': len(vC), 'corpses': corpses, 'stains': stains, 'wallMarksOnTheCorpse': R.get('pick', {}).get('spot', {}).get('face')})
    return C


async def case_lab(b, port, R, errs):
    Qy = ('&' + A_.query) if A_.query else ''
    ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
    for c in (ca, cb, cc): await c.add_init_script(SPY)
    await ca.add_init_script("try{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{}'),{kind:'flashlight'})))}catch(e){}")
    A = await L.join(ca, port, ROOM, 'Alice', errs, Qy); await L.admin_open(A)
    B = await L.join(cb, port, ROOM, 'Bob', errs, Qy); C = await L.join(cc, port, ROOM, 'Carol', errs, Qy)
    aid = await A.evaluate("()=>__api.H.id")
    R['ids'] = {'alice': aid, 'bob': await B.evaluate("()=>__api.H.id"), 'carol': await C.evaluate("()=>__api.H.id")}
    for nm in ('bob', 'carol'): await L.admin_cmd(A, {'c': 'god', 'id': R['ids'][nm]})
    await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1200)
    await L.ensure_alive(A); await L.auto_revive(A, False)
    await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
    for _ in range(80):
        if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
        await A.wait_for_timeout(250)

    async def stage(skip):
        S = await A.evaluate(L.FACE_SPOT, ['S', 90, skip])
        await L.clear_monsters(A); await L.ensure_alive(A); await L.place(A, S['x'], S['y'], S['a'], W, H)
        V = await B.evaluate(L.VIEW_SPOT, S)
        for P, dx in ((B, 0), (C, 40)):
            if V: await L.place(P, V[0] + dx, V[1], V[2], W, H)
            if await P.evaluate("()=>__api.lightOn()"): await P.keyboard.press('KeyF')
        if not await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
        return S, V
    S1, V1 = await stage(0); R['spot1'], R['view1'] = S1, V1
    await L.lab(B, True, True, 1); await L.lab(C, True, False, .25)                  # Bob: PAUSED; Carol: 0.25x (before the death, as the panel says to)
    for P in (A, B, C): await P.evaluate(SAMPLER)
    await A.wait_for_timeout(1500)
    adm = A_.out + '.world.json'
    proc = subprocess.Popen(['node', os.path.join(HERE, 'ws_reset.js'), '--port', str(port), '--room', ROOM, '--pass', L.PASS,
                             '--victim', str(aid), '--kind', 'death', '--after', '3000', '--out', adm], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await A.wait_for_timeout(600)
    since = await A.evaluate("()=>Date.now()/1000"); R['since'] = since
    R['death1Seen'] = await L.preview(A, 'hound', 'C', timeout=12)
    T0 = time.time(); took = {}
    while time.time() - T0 < 25 and len(took) < 2:
        await A.wait_for_timeout(100)
        for nm, P in (('bob', B), ('carol', C)):
            if nm not in took and await P.evaluate("()=>window.__epochDebug?window.__epochDebug().ends:0"): took[nm] = time.time()
    R['tookInTheReset'] = took
    t1 = max(took.values()) if took else time.time()
    while time.time() < t1 + 3.0: await A.wait_for_timeout(50)
    if A_.shots:
        os.makedirs(A_.shots, exist_ok=True)
        for nm, P in (('alice', A), ('bob_paused', B), ('carol_slowed', C)): await P.screenshot(path=os.path.join(A_.shots, f'lab_after_reset_{nm}.png'))
    await L.lab(B, False, False, 1); await L.lab(C, False, False, 1); R['clocksRestored'] = time.time()
    while time.time() < R['clocksRestored'] + 3.5: await A.wait_for_timeout(50)
    try: proc.wait(20)
    except subprocess.TimeoutExpired: proc.kill()
    R['admin'] = json.load(open(adm)) if os.path.exists(adm) else {}
    # the next death, in the new world, at the normal clock
    S2, V2 = await stage(1); R['spot2'], R['view2'] = S2, V2
    await A.wait_for_timeout(1500); await L.clear_monsters(A)
    R['death2Start'] = time.time(); R['death2Seen'] = await L.preview(A, 'hound', 'C', timeout=12)
    de2 = None
    for _ in range(60):
        dbg = await A.evaluate(DLDBG); own = (dbg or {}).get('own')
        if own and own.get('de') is not None: de2 = own['de']; R['death2Lf'] = own.get('lf'); break
        await A.wait_for_timeout(100)
    R['de2'] = de2
    lf2 = R.get('death2Lf') or [7, 2]
    while time.time() < R['death2Start'] + 2.5 + lf2[0] + lf2[1] + 3.5: await A.wait_for_timeout(100)
    if A_.shots:
        for nm, P in (('bob', B), ('carol', C)): await P.screenshot(path=os.path.join(A_.shots, f'lab_death2_after_{nm}.png'))
    R['dl'] = {nm: await P.evaluate(DLDBG) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
    R['rowsAll'] = {nm: await P.evaluate(ROWS, since) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
    R['spy'] = {nm: await P.evaluate(SPYGET) for nm, P in (('alice', A), ('bob', B), ('carol', C))}


def checks_lab(R):
    C = []
    def check(name, ok, info): C.append({'name': name, 'ok': bool(ok), 'info': info})
    a = R.get('admin') or {}; de, tr, w0, aid = a.get('de'), a.get('sent'), a.get('w0'), R['ids']['alice']
    R['rows'] = {nm: (R['rowsAll'][nm] or {}).get('rows') or [] for nm in R['rowsAll']}
    rows = R['rows']
    def first_new(nm):
        return next((r for r in rows[nm] if r['ep'] and w0 is not None and r['ep'][0] > w0), None)
    before = {nm: [r for r in rows[nm] if tr and r['t'] < tr] for nm in rows}
    el = {nm: [f[2] for r in before[nm] for f in r['fx'] if f[1] == de and f[2] is not None] for nm in ('bob', 'carol')}
    shownFor = {nm: (lambda rs: round(rs[-1]['t'] - rs[0]['t'], 2) if rs else 0)([r for r in before[nm] if any(f[1] == de for f in r['fx'])]) for nm in ('bob', 'carol')}
    check('setup: the death began and was on Bob\'s and Carol\'s screens before the reset; the Death Lab held Bob\'s replay (paused: its clock never passed 0.2 s) and slowed Carol\'s (its clock at most 0.5x the real time it was on screen)',
          de is not None and tr and el['bob'] and el['carol'] and max(el['bob']) <= .2 and shownFor['bob'] >= .5 and max(el['carol']) <= .5 * max(shownFor['carol'], .1) + .15 and shownFor['carol'] >= .5,
          {'de': de, 'w0': w0, 'replayClockAtTheReset': {nm: (max(v) if v else None) for nm, v in el.items()}, 'onScreenBeforeTheReset': shownFor, 'lab': {nm: before[nm][-1]['lab'] if before[nm] else None for nm in ('bob', 'carol')}})
    after = a.get('after3s') or []
    wm = [m for m in after if m['t'] == 'world']; ends = [m for m in after if m['t'] == 'fx' and m.get('k') == 'end' and m.get('de') == de]
    stale = [m for m in after if m.get('w') is not None and w0 is not None and m['w'] <= w0]
    check('R03 the server: one world message (the next world), then the end of the death; nothing it sends afterwards names the old world',
          w0 is not None and len(wm) == 1 and wm[0]['w'] == w0 + 1 and len(ends) == 1 and not stale, {'world': wm, 'end': ends, 'stale': stale})
    old = lambda r: {'replay': any(f[1] == de for f in r['fx']), 'stain': bool(r['st'] and de in r['st']), 'corpse': any(x[0] in (str(aid), 'r' + str(aid)) and x[2] == de for x in r['bd']) or any(x[0] in (str(aid), 'r' + str(aid)) and x[2] is None for x in r['bd']),
                     'deadLight': any(p > 0 for p in r['pw']), 'ownDeath': bool(r['own'] and r['own']['a']), 'caught': r['caught']}
    tR, d2 = R.get('clocksRestored'), R.get('death2Start')
    for nm, label in (('bob', 'Bob, Death Lab PAUSED'), ('carol', 'Carol, Death Lab 0.25x'), ('alice', 'Alice, the victim')):
        r0 = first_new(nm)
        held = [r for r in rows[nm] if r0 and r0['t'] <= r['t'] < (tR or 0)]
        rest = [r for r in rows[nm] if tR and tR <= r['t'] < (d2 or tR + 3)]
        bad = [dict(t=round(r['t'] - tr, 2), **{k: v for k, v in old(r).items() if v}) for r in held + rest if any(old(r).values())]
        check(f'R03 {label}: from the moment the page took in the reset, and again after the clocks were restored, nothing of the old death on the screen (no replay, wall stain, corpse or dying light' + ('; not dying, not caught' if nm == 'alice' else '') + ')',
              r0 is not None and len(held) >= 5 and len(rest) >= 5 and not bad, {'tookInAfterS': round(r0['ep'][3] - tr, 2) if r0 and r0['ep'][3] else None, 'rowsWhileLabbed': len(held), 'rowsAfterRestore': len(rest), 'stillThere': bad[:6]})
    def afterWorld(nm):
        rx = (R['spy'][nm] or {}).get('rx', []); i = next((k for k, m in enumerate(rx) if m[1] == 'world'), None)
        return None if i is None else [m for m in rx[i + 1:] if not (d2 and m[0] >= d2)]
    rxs = {nm: afterWorld(nm) for nm in ('alice', 'bob', 'carol')}
    nra = {nm: [m for m in (v or []) if m[1] == 'nra'] for nm, v in rxs.items()}; boom = {nm: [m for m in (v or []) if m[1] == 'fx' and m[2] == 'boom'] for nm, v in rxs.items()}
    check('R04 the reset answers nobody\'s NEW RUN and explodes nobody (after the world message: no nra, no blast, on any page; none from the server)',
          all(v is not None for v in rxs.values()) and not any(nra.values()) and not any(boom.values()) and not [m for m in after if m['t'] == 'fx' and m.get('k') == 'boom'], {'nra': nra, 'boom': boom})
    de2, lf2 = R.get('de2'), R.get('death2Lf')
    played = {nm: any(f[1] == de2 for r in rows[nm] for f in r['fx']) for nm in ('bob', 'carol')}
    ownA = any(r['own'] and r['own']['a'] for r in rows['alice'] if d2 and r['t'] >= d2)
    end = {nm: rows[nm][-1] if rows[nm] else None for nm in rows}
    corpses = {nm: [x for x in (end[nm]['bd'] if end[nm] else []) if x[0] in (str(aid), 'r' + str(aid))] for nm in end}
    stains = {nm: bool(end[nm] and end[nm]['st'] and de2 in end[nm]['st']) for nm in end}
    check('R03 the next death (in the new world, at the normal clock) plays on every screen and leaves exactly one corpse of Alice (the server\'s record with its event id; on her own page her own corpse), and its HQ1 wall stain, on all three',
          de2 is not None and de2 != de and ownA and all(played.values()) and all(len(v) == 1 and (v[0][2] == de2 or (nm == 'alice' and v[0][1] == 0)) for nm, v in corpses.items()) and all(stains.values()),
          {'de2': de2, 'aliceDied': ownA, 'replayed': played, 'corpses': corpses, 'stains': stains})
    dl = R.get('dl') or {}
    fin = {nm: anchor(dl.get(nm), de2) for nm in ('alice', 'bob', 'carol')}
    spread = round((max(fin.values()) - min(fin.values())) * 1000, 1) if all(fin.values()) else None
    L_ = light_checks(de2, lf2, [(nm, rows[nm], fin[nm]) for nm in ('alice', 'bob', 'carol')]) if lf2 else {}
    check('R03 the next death\'s light as HQ1 accepted it, on each screen by its own anchor: full in its hold, nothing lit after hold + fade; the three anchors within 150 ms',
          spread is not None and spread <= 150 and L_ and all(v.get('anchor', 1) is not None for v in L_.values()) and all(not v['dimInHold'] and not v['litAfterEnd'] and v['lastRowDeadLightsLit'] == 0 for v in L_.values()) and all(v['fullInHold'] > 0 for v in L_.values()),
          {'lf': lf2, 'anchors': fin, 'spreadMs': spread, 'pages': L_})
    return C


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq2/life_hq2.py', 'case': A_.case, 'game': A_.game, 'events': []}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            if A_.case == 'light': await case_light(b, port, R, errs)
            else: await case_lab(b, port, R, errs)
            R['pageErrors'] = errs[:20]
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    finish(R)


def finish(R):
    try: R['checks'] = checks_light(R) if A_.case == 'light' else checks_lab(R)
    except Exception as e:
        import traceback; R['checks'] = [{'name': 'the checks could be computed', 'ok': False, 'info': traceback.format_exc()[-1500:]}]
    R['passed'] = sum(c['ok'] for c in R['checks']); R['total'] = len(R['checks']); R['ok'] = R['passed'] == R['total']
    R.pop('rows', None)
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for c in R['checks']: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'] + '  ' + json.dumps(c['info'])[:600])
    print(f"{R['passed']}/{R['total']} checks passed")
    sys.exit(0 if R['ok'] else 1)


if A_.reanalyse:
    finish(json.load(open(A_.reanalyse)))
else:
    asyncio.run(main())
