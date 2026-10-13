#!/usr/bin/env python3
"""Stage 3D HQ2 - an admin world reset (WORLD -> NEW RUN FOR EVERYONE) in the middle of a death or a NEW RUN blast, on four screens (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/reset_epoch.py --game DIR --out FILE.json [--case death|boom] [--after MS] [--shots DIR]

Case `death` (R01): Alice (the victim; an admin page for the Death Lab) dies a Hound C wall death in front of a lit papered face with her
flashlight ON; Bob and Carol (spectators, god mode, lights off) watch.  Case `boom` (R02): Alice presses NEW RUN there instead (the
server's blast throws her at that face).  MS milliseconds after the server's replay message (default 2200 for a death, 2000 for a
blast of 3.2 s: still playing, its light in its hold; these pages take a second or more to get to a message) a WebSocket client doing nothing else sends the world reset (ws_reset.js), and records
what the server then says.  2.5 s after the reset two "delayed" old-world messages are handed to Bob's page as if they had arrived from
the server: the event's own replay message again, and a corpse list naming the old world (R03).  Dave opens the game 3.2 s after the
reset (R03: a late joiner; a page takes long to load here, so this comes last).  In case `boom` Alice presses SPAWN once Dave is in.
Every page records, ~10 times a second from before the event to 9 s after the reset:
  - its own death sequence (Alice) and every death or blast replay it plays (window.__fxs: id, event id, clock, ended);
  - the wallpaper stains gore.js keeps stamped (their event ids) and what the wall receiver holds;
  - corpse records on screen (owner, local or the server's, event id);
  - dead lights still giving light (window.__peerLights with a power > 0) and the victim's own dying light (window.__deathLight.own);
  - the world epoch as mp.js holds it (window.__epochDebug: w, how many world changes it has handled, old messages dropped);
  - where the page's own player is, whether it is in a run, caught, in the run menu.
and every message it sends or receives, by type (a WebSocket spy: test only).
`measured` counts, per page, what is still there from 0.5 s / 1.5 s after the reset (the H2-0 RED's numbers, read the same way).
Stage 3D HQ2 (H2-4) GREEN checks (exit 1 if any fails): see `checks` - R01/R02 nothing of the old world on any screen once the page
has taken in the reset (mp.js's own record of when it did: these four SwiftShader pages draw about one frame a second), Alice back in the world where the server put her without a respawn of her own (R01) or in her
run menu (R02, then SPAWN works); R03 the late joiner sees none of it, the delayed old messages are dropped; R04 nobody's NEW RUN is
answered and nothing explodes; the server sends 'world' and the event's 'end' and nothing of the old world after it.
--reanalyse FILE recomputes `measured` and `checks` from a saved run (no browser)."""
import os, sys, asyncio, argparse, json, time, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq1'))
import hq1lib as L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True)
ap.add_argument('--case', default='death', choices=('death', 'boom'))
ap.add_argument('--after', type=int, default=None); ap.add_argument('--shots', default=None); ap.add_argument('--query', default='')
ap.add_argument('--reanalyse', default=None, help='recompute `measured` and `checks` from a saved run (no browser)')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
if A_.after is None: A_.after = 2200 if A_.case == 'death' else 2000
W, H = 960, 640
SPY = r"""(()=>{ const W0=window.WebSocket; const S=window.__wsSpy={rx:[],tx:[],last:{}};
  window.WebSocket=function(u,p){ const ws=p===undefined?new W0(u):new W0(u,p); S.ws=ws; const send=ws.send.bind(ws);
    ws.send=d=>{ try{ const m=JSON.parse(d); if(m.t!=='p'&&m.t!=='ping') S.tx.push([+(Date.now()/1000).toFixed(3),m.t]); }catch(e){} return send(d) };
    ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t!=='s'&&m.t!=='pong') S.rx.push([+(Date.now()/1000).toFixed(3),m.t,m.k||'',m.de==null?null:m.de,m.w==null?null:m.w,m.id==null?null:m.id]); if(m.t==='fx'&&(m.k==='death'||m.k==='boom')) S.last.fx=e.data; }catch(err){} }); return ws; };
  window.WebSocket.prototype=W0.prototype; Object.assign(window.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}); })()"""
SAMPLER = r"""()=>{ if(window.__h2s) return 'already'; const S=window.__h2s={rows:[]};
  const one=()=>{ try{ const A=window.__api, d=A.death&&A.death(), G=window.__gore&&window.__gore.wallStains, Lv=window.__l0v, dl=window.__deathLight;
      const act=!!(d&&d.active), ep=window.__epochDebug?window.__epochDebug():null;
      S.rows.push({ t:+(Date.now()/1000).toFixed(3), caught:!!A.G.caught, own: d?{a:act,f:!!d.finished,e:+(d.elapsed||0).toFixed(2)}:null,
        ownPw: act&&dl&&A.lightOn&&A.lightOn()?+(+dl.own()).toFixed(3):null,
        fx:(window.__fxs||[]).filter(f=>f.k!=='vanish').map(f=>[f.id,f.de,f.jl?+f.jl.elapsed.toFixed(2):null,!!f.end]),
        st: G?G.list().filter(s=>s.status==='stamped').map(s=>s.de):null, rc: Lv&&Lv.surfaces?Lv.surfaces.count():null,
        bd:(A.bodyList?A.bodyList():[]).filter(b=>b.cause!=='Vanish').map(b=>[String(b.ownerId),b.remote?1:0,b.de==null?null:b.de]),
        dl:(window.__peerLights||[]).filter(l=>l&&l.pw!=null&&l.pw>0).length,
        ep: ep?[ep.w,ep.ends,ep.oldDropped,ep.at]:null, started:A.started?A.started():null, rm:!document.getElementById('runMenu').hidden,
        x:Math.round(A.H.x), y:Math.round(A.H.y) });
      if(S.rows.length>6000) S.rows.splice(0,2000) }catch(e){ S.err=String(e) } };
  S.iv=setInterval(one,100); return 'ok' }"""
ROWS = "(since)=>window.__h2s?window.__h2s.rows.filter(r=>r.t>=since):null"
SPYGET = "()=>window.__wsSpy?{rx:window.__wsSpy.rx,tx:window.__wsSpy.tx}:null"
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"
INJECT = r"""(body)=>{ const S=window.__wsSpy; if(!S||!S.ws) return 'no socket'; const sent=[];
  if(S.last.fx){ S.ws.dispatchEvent(new MessageEvent('message',{data:S.last.fx})); sent.push('fx') }
  if(body){ S.ws.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(body)})); sent.push('bodies') }
  return sent }"""
# which face the blast will throw her at (case boom): the world's number and the next event id give its direction (dphys.boomPlan)
PICK = r"""([de, faceJs])=>{ const D=window.__dphys, w=window.__nrDebug().w; const P=D.boomPlan(w, de), dx=Math.cos(P.d), dy=Math.sin(P.d);
  const F=eval(faceJs); let best=null;
  for(const side of ['N','S','E','W']) for(let skip=0; skip<4; skip++){ const S=F([side, 64, skip]); if(!S) break; const dot=-(S.ox*dx+S.oy*dy); if(!best||dot>best.dot) best=Object.assign({dot, side, skip}, S) }
  return { w, de, plan:P, spot:best } }"""
# a complete corpse record of the old world, made by the game's own server code (death_srv), for the delayed-message check
CORPSE_JS = r"""const path=require('path'), G=process.argv[1], D=require(path.join(G,'death_srv.js')), sim=require(path.join(G,'sim.js'))({seed:1});
const [x,y,id,de,w]=process.argv.slice(2).map(Number), info={name:'GHOST',look:'none|plain|#e6bb76|#ffcc77|none',ek:'flashlight',ec:'#ffe7b2',ep:'',vx:0,vy:0,ex:0,light:true};
const pl=D.DP.boomPlan(w,de), B={k:'Boom',x,y,a:0,d:pl.d,s:pl.s}, R=D.corpse(id,B,info,D.boomBegin(B,info,sim));
R.body.de=de; R.body.ag=1; console.log(JSON.stringify(R.body));"""


def measure(R):
    a, rows = R.get('admin') or {}, R['rows']; de, tr, aid = a.get('de'), a.get('sent'), a.get('victim')

    def still(rs, frm):
        rs = [r for r in (rs or []) if tr and tr + frm <= r['t'] <= tr + 9.5]
        return {'rows': len(rs),
                'ownDeathActive': sum(1 for r in rs if r['own'] and r['own']['a']),
                'caught': sum(1 for r in rs if r['caught']),
                'replayOfOldDeath': sum(1 for r in rs if any(f[1] == de for f in r['fx'])),
                'oldStainStamped': sum(1 for r in rs if r['st'] and de in r['st']),
                'anyStainStamped': sum(1 for r in rs if r['st']),
                'receiverNonEmpty': sum(1 for r in rs if (r['rc'] or 0) > 0),
                'oldCorpseShown': sum(1 for r in rs if any(x[0] in (str(aid), 'r' + str(aid)) for x in r['bd'])),
                'deadLightsLit': sum(1 for r in rs if r['dl'] > 0),
                'ownDyingLightLit': sum(1 for r in rs if (r['ownPw'] or 0) > 0)}
    return {'de': de, 'resetSentAt': tr, 'eventSeenByAdminAt': a.get('sawEvent'),
            'before': {nm: {'stained': any(r['st'] and de in r['st'] for r in rows[nm] if tr and r['t'] < tr),
                            'replayOrDeath': any((r['own'] and r['own']['a']) or any(f[1] == de for f in r['fx']) for r in rows[nm] if tr and r['t'] < tr)} for nm in rows if nm != 'dave'},
            'from0.5s': {nm: still(rows[nm], .5) for nm in rows}, 'from1.5s': {nm: still(rows[nm], 1.5) for nm in rows},
            'positionsAfter': {nm: (rows[nm][-1]['x'], rows[nm][-1]['y']) if rows[nm] else None for nm in rows}}


def checks(R):
    C = []
    def check(name, ok, info): C.append({'name': name, 'ok': bool(ok), 'info': info})
    a, rows, case = R.get('admin') or {}, R['rows'], R['case']
    de, tr, aid, w0 = a.get('de'), a.get('sent'), a.get('victim'), a.get('w0')
    old = lambda r: {'replay': any(f[1] == de for f in r['fx']), 'stain': bool(r['st'] and de in r['st']), 'corpse': any(x[0] in (str(aid), 'r' + str(aid)) for x in r['bd']),
                     'deadLight': r['dl'] > 0, 'ownDeath': bool(r['own'] and r['own']['a']), 'caught': r['caught'], 'ownDyingLight': (r['ownPw'] or 0) > 0}
    def shown(nm):                                                        # the event on this page before the page took in the reset
        rs = rows[nm]; r0 = next((r for r in rs if r['ep'] and w0 is not None and r['ep'][0] > w0), None)
        return any((r['own'] and r['own']['a']) or any(f[1] == de for f in r['fx']) for r in rs if not r0 or r['t'] < r0['t'])
    seenOn = {nm: shown(nm) for nm in ('alice', 'bob', 'carol')}
    check(f"setup: the {case} began and was on the screens before each took in the reset (event {de}, world {w0})", de is not None and tr and sum(seenOn.values()) >= 2, {'shownBeforeTheReset': seenOn})
    # the server's side
    after = a.get('after3s') or []
    wm = [m for m in after if m['t'] == 'world']; ends = [m for m in after if m['t'] == 'fx' and m.get('k') == 'end' and m.get('de') == de]
    stale = [m for m in after if m.get('w') is not None and w0 is not None and m['w'] <= w0]
    check('R01/R02 the server tells everyone: one world message (the next world), then the end of the event in progress; nothing it sends afterwards names the old world',
          w0 is not None and len(wm) == 1 and wm[0]['w'] == w0 + 1 and len(ends) == 1 and not stale, {'world': wm, 'end': ends, 'staleAfter': stale, 'first': after[:6]})
    # the screens
    react = {}
    for nm in ('alice', 'bob', 'carol'):
        rs = [r for r in rows[nm] if tr and r['t'] >= tr]
        r0 = next((r for r in rs if r['ep'] and w0 is not None and r['ep'][0] > w0), None)          # the first row sampled after the page's world change ran
        react[nm] = round(r0['ep'][3] - tr, 2) if r0 and len(r0['ep']) > 3 and r0['ep'][3] else None
        late = [r for r in rs if r0 and r['t'] >= r0['t']]
        bad = [dict(t=round(r['t'] - tr, 2), **{k: v for k, v in old(r).items() if v}) for r in late if any(old(r).values())]
        check(f"{'R01' if case == 'death' else 'R02'} {nm}: the page takes in the reset as soon as its main thread gets the message (within 3 s on these four SwiftShader pages; measured) and from then on nothing of the old {case} is on the screen - no replay, no wall stain, no corpse, no dying light" + (", not her own death, not caught" if nm == 'alice' else ''),
              r0 is not None and react[nm] is not None and react[nm] <= 3 and len(late) >= 6 and not bad, {'reactedAfterS': react[nm], 'rowsAfter': len(late), 'stillThere': bad[:6]})
    end = {nm: rows[nm][-1] if rows[nm] else None for nm in rows}
    spyA = (R.get('spy') or {}).get('alice') or {}
    aTx = [m for m in spyA.get('tx', []) if tr and tr <= m[0] <= tr + 5.5]
    if case == 'death':
        check("R01 Alice is back in the world where the server put her (the world message's spot), alive and playing, and her page sent no respawn or join of its own",
              end['alice'] and end['alice']['started'] and not end['alice']['caught'] and not end['alice']['rm'] and not any(m[1] in ('respawn', 'join') for m in aTx),
              {'end': {k: end['alice'][k] for k in ('x', 'y', 'started', 'caught', 'rm')} if end['alice'] else None, 'sentAfterReset': aTx})
        inWorld = ('alice', 'bob', 'carol')
    else:
        check("R02 Alice (out of the world since her NEW RUN) stays in her run menu through the reset; SPAWN then starts her new run",
              R.get('spawnPressed') and end['alice'] and end['alice']['started'] and not end['alice']['rm'] and not end['alice']['caught'],
              {'spawnPressed': R.get('spawnPressed'), 'end': {k: end['alice'][k] for k in ('x', 'y', 'started', 'caught', 'rm')} if end['alice'] else None})
        inWorld = ('bob', 'carol')
    pos = R.get('afterResetPositions') or {}
    pts = [pos[nm] for nm in inWorld if pos.get(nm)]
    mn = min((((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** .5 for i, p in enumerate(pts) for q in pts[i + 1:]), default=None)
    check('R01/R02 everyone the reset brought back stands on a spot of their own (>= 36 px apart; the server puts them >= 44)', mn is not None and mn >= 36 and len(pts) == len(inWorld), {'positions': pos, 'closest': round(mn, 1) if mn else None})
    # R03: the late joiner, the delayed old messages
    dv = rows.get('dave') or []
    dbad = [dict(t=round(r['t'] - tr, 2), **{k: v for k, v in old(r).items() if v}) for r in dv if any(old(r).values())]
    check('R03 Dave, who opened the game 3.2 s after the reset, never sees any of the old world (no replay, stain, corpse or dying light) in any of his rows', len(dv) >= 15 and not dbad, {'rows': len(dv), 'saw': dbad[:6]})
    inj = R.get('inject') or {}
    bAfter = [r for r in rows['bob'] if inj.get('t') and r['t'] >= inj['t']]
    dropped = (bAfter[-1]['ep'][2] - inj['droppedBefore']) if bAfter and bAfter[-1]['ep'] and inj.get('droppedBefore') is not None else None
    ghost = lambda r: any(x[0] == 'r' + str(inj.get('ghost')) for x in r['bd'])
    ibad = [dict(t=round(r['t'] - inj['t'], 2), ghost=ghost(r), **{k: v for k, v in old(r).items() if v}) for r in bAfter if any(old(r).values()) or ghost(r)]
    check("R03 delayed old-world messages handed to Bob's page after the reset (the event's own replay message again, a corpse list naming the old world) are dropped: nothing appears",
          inj.get('sent') == ['fx', 'bodies'] and dropped == 2 and len(bAfter) >= 3 and not ibad, {'sent': inj.get('sent'), 'droppedByThePage': dropped, 'rows': len(bAfter), 'appeared': ibad[:5], 'err': inj.get('err')})
    # R04: a reset is nobody's NEW RUN
    def afterWorld(nm):                                                   # what the page got after the world message, in the order it got it (up to the injection, for Bob)
        rx = ((R.get('spy') or {}).get(nm) or {}).get('rx', []); i = next((k for k, m in enumerate(rx) if m[1] == 'world'), None)
        if i is None: return rx if nm == 'dave' else None
        return [m for m in rx[i + 1:] if not (nm == 'bob' and inj.get('t') and m[0] >= inj['t'])]
    rxs = {nm: afterWorld(nm) for nm in ('alice', 'bob', 'carol', 'dave')}
    nra = {nm: [m for m in (v or []) if m[1] == 'nra'] for nm, v in rxs.items()}; boom = {nm: [m for m in (v or []) if m[1] == 'fx' and m[2] == 'boom'] for nm, v in rxs.items()}
    srvBoom = [m for m in after if m['t'] == 'fx' and m.get('k') == 'boom']
    check('R04 the reset answers nobody\'s NEW RUN and explodes nobody: after the world message no page gets an nra or a blast, and the server sends no blast', all(v is not None for v in rxs.values()) and not any(nra.values()) and not any(boom.values()) and not srvBoom,
          {'nra': nra, 'boom': boom, 'serverBlastAfterReset': srvBoom, 'pagesWithAWorldMessage': [nm for nm, v in rxs.items() if v is not None]})
    return C


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq2/reset_epoch.py', 'case': A_.case, 'game': A_.game, 'after': A_.after}
    Q = ('&' + A_.query) if A_.query else ''
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb, cc, cd = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(4)]
            for c in (ca, cb, cc, cd): await c.add_init_script(SPY)
            await ca.add_init_script("try{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{}'),{kind:'flashlight'})))}catch(e){}")
            A = await L.join(ca, port, 'h2reset', 'Alice', errs, Q); await L.admin_open(A)
            B = await L.join(cb, port, 'h2reset', 'Bob', errs, Q)
            C = await L.join(cc, port, 'h2reset', 'Carol', errs, Q)
            aid = await A.evaluate("()=>__api.H.id")
            for P in (B, C): await L.admin_cmd(A, {'c': 'god', 'id': await P.evaluate("()=>__api.H.id")})
            await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1200)
            await L.ensure_alive(A); await L.auto_revive(A, False)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            if A_.case == 'boom':
                pick = await A.evaluate(PICK, [1, L.FACE_SPOT]); R['pick'] = pick; S = pick['spot']
            else:
                S = await A.evaluate(L.FACE_SPOT, ['S', 90, 0])
            R['spot'] = S
            await L.clear_monsters(A); await L.ensure_alive(A); await L.place(A, S['x'], S['y'], S['a'], W, H)
            V = await B.evaluate(L.VIEW_SPOT, S); R['view'] = V
            for P in (B, C):
                if V: await L.place(P, V[0] + (0 if P is B else 40), V[1], V[2], W, H)
                if await P.evaluate("()=>__api.lightOn()"): await P.keyboard.press('KeyF')
            if not await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
            for P in (A, B, C): await P.evaluate(SAMPLER)
            await A.wait_for_timeout(2000)
            adm = A_.out + '.world.json'
            proc = subprocess.Popen(['node', os.path.join(HERE, 'ws_reset.js'), '--port', str(port), '--room', 'h2reset', '--pass', L.PASS,
                                     '--victim', str(aid), '--kind', A_.case, '--after', str(A_.after), '--out', adm], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            await A.wait_for_timeout(600)
            since = await A.evaluate("()=>Date.now()/1000")
            if A_.case == 'death': R['previewSeen'] = await L.preview(A, 'hound', 'C', timeout=12)
            else: R['pressed'] = await A.evaluate(PRESS)
            T0 = time.time(); t_reset = None
            while time.time() - T0 < 20 and t_reset is None:                 # (the moment Bob's page has taken in the reset: its own world count)
                await A.wait_for_timeout(100)
                if await B.evaluate("()=>window.__epochDebug?window.__epochDebug().ends:0"): t_reset = time.time()
            t_reset = t_reset or time.time()
            shots, dave, inj = {}, None, {}
            if A_.shots: os.makedirs(A_.shots, exist_ok=True)
            for label, dt in (('reset+0.6s', .6), ('reset+2.5s', 2.5), ('reset+3s', 3.0), ('dave', 3.2), ('spawn', 6.0)):   # (a page takes long to load here: Dave last)
                while time.time() < t_reset + dt: await A.wait_for_timeout(40)
                if label == 'dave':
                    dave = await L.join(cd, port, 'h2reset', 'Dave', errs, Q); await dave.evaluate(SAMPLER)
                elif label == 'reset+2.5s':
                    w0 = await B.evaluate("()=>window.__epochDebug().w") - 1
                    bp = await B.evaluate("()=>[Math.round(__api.H.x),Math.round(__api.H.y)]")
                    body = None
                    try:
                        rec = json.loads(subprocess.run(['node', '-e', CORPSE_JS, A_.game, str(bp[0] + 70), str(bp[1]), '4242', '9999', str(w0)], capture_output=True, text=True, timeout=30).stdout)
                        body = {'t': 'bodies', 'v': 999999, 'w': w0, 'b': [rec]}
                    except Exception as e: inj['err'] = str(e)
                    inj.update(t=time.time(), ghost=4242, w=w0, droppedBefore=await B.evaluate("()=>window.__epochDebug().oldDropped"))
                    inj['sent'] = await B.evaluate(INJECT, body)
                elif label == 'spawn':
                    if A_.case == 'boom': R['spawnPressed'] = await A.evaluate(SPAWN)
                elif A_.shots:
                    for nm, P in (('alice', A), ('bob', B), ('carol', C)) + ((('dave', dave),) if dave and label == 'reset+3s' else ()):
                        f = os.path.join(A_.shots, f'{nm}_{label}.png'); await P.screenshot(path=f); shots.setdefault(label, {})[nm] = os.path.basename(f)
            while time.time() < t_reset + 9.6: await A.wait_for_timeout(200)
            await A.wait_for_timeout(3000)                                    # (every page a few more rows after the last step; Dave's at least 20)
            for _ in range(40):
                if not dave or await dave.evaluate("()=>window.__h2s?window.__h2s.rows.length:0") >= 20: break
                await A.wait_for_timeout(500)
            try: proc.wait(20)
            except subprocess.TimeoutExpired: proc.kill()
            a = json.load(open(adm)) if os.path.exists(adm) else {}; R['admin'] = a
            R['shots'] = shots; R['inject'] = inj
            pages = (('alice', A), ('bob', B), ('carol', C)) + ((('dave', dave),) if dave else ())
            R['rows'] = {nm: await P.evaluate(ROWS, since) for nm, P in pages}
            R['spy'] = {nm: await P.evaluate(SPYGET) for nm, P in pages}
            R['afterResetPositions'] = {nm: ([R['rows'][nm][-1]['x'], R['rows'][nm][-1]['y']] if R['rows'][nm] else None) for nm in ('alice', 'bob', 'carol')}   # (the last row: nobody moves after the reset)
            R['pageErrors'] = errs[:20]
            await b.close()
    finally:
        L.stop_server(srv)
    finish(R)


def finish(R):
    R['measured'] = measure(R)
    try: R['checks'] = checks(R)
    except Exception as e: R['checks'] = [{'name': 'the checks could be computed', 'ok': False, 'info': repr(e)}]
    R['passed'] = sum(c['ok'] for c in R['checks']); R['total'] = len(R['checks']); R['ok'] = R['passed'] == R['total']
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for c in R['checks']: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'] + '  ' + json.dumps(c['info'])[:400])
    print(f"{R['passed']}/{R['total']} checks passed")
    sys.exit(0 if R['ok'] else 1)


if A_.reanalyse:
    finish(json.load(open(A_.reanalyse)))
else:
    asyncio.run(main())
