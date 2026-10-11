#!/usr/bin/env python3
"""Stage 3D - one death, three runs: the victim's own corpse, a spectator's replay and the server's corpse, for all eight (development only).

  python3 dev/stage-3d/parity3d.py --game DIR --out FILE.json [--rounds 1]
  python3 dev/stage-3d/parity3d.py --game DIR --out FILE.json --recompute EARLIER.json      (only redo the Node part of a parent run)

A real browser (Alice) dies at normal speed through the admin DEATHS preview (the real kill path; Hound C in front of a wall) while a
second (Bob, god mode) watches from about 150 px.  On the wire the tool records what Alice's client sends ('fx', 'b'), what it receives
(the kill record 'mk' in the snapshot, and the 'bodies' lists), and what Bob's replay looks like when it ends.

Two protocols are handled:
  - the parent's (before 3D's D4): the victim reports its corpse ('b'); the server's fallback (GAME/death_srv.js bodyFor, the same code
    the server runs when a victim never reports) is run here in Node on the server's kill record and compared with the victim's 'b';
  - 3D's: the server makes every corpse itself (the 'bodies' record with the death id 'de'); it is compared with the victim's own local
    corpse and with the end of Bob's replay.
Compared: body position and turn, the dropped light, the hat, the two hands, the blood list.
The server runs with a synthetic admin passcode (lib3d.PASS)."""
import os, sys, asyncio, argparse, time, json, subprocess, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3d
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); ap.add_argument('--rounds', type=int, default=1); ap.add_argument('--only', default='')
ap.add_argument('--recompute', help='only redo the Node comparison on the raw rows saved in this earlier output'); A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
HOOK = """(()=>{ window.__tx=[]; window.__rx=[]; window.__bod=[]; const S=WebSocket.prototype.send; WebSocket.prototype.send=function(d){ try{ const m=JSON.parse(d); if(m.t==='fx'||m.t==='b') window.__tx.push(m); }catch(e){} return S.call(this,d); };
  const W=window.WebSocket; window.WebSocket=function(u,p){ const ws=new W(u,p); ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t==='s'&&m.mk) window.__rx.push({mk:m.mk, ms:m.ms}); if(m.t==='bodies') window.__bod.push(m.b); if(m.t==='fx') (window.__rfx=window.__rfx||[]).push(m); }catch(_){} }); return ws; };
  window.WebSocket.prototype=W.prototype; Object.assign(window.WebSocket, W); })()"""
NODE = r"""
const path=require('path'), G=process.argv[1], D=require(path.join(G,'death_srv.js')), sim=require(path.join(G,'sim.js'))({seed:1});
const rows=JSON.parse(require('fs').readFileSync(0,'utf8')), out=[]; const ang=(a,b)=>+Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))).toFixed(3);
for (const {fx,b,mk} of rows) {
  const info={name:'X',look:fx.lk,ek:fx.ek,ec:fx.ec,ep:fx.ep||'',vx:fx.vx,vy:fx.vy,ex:fx.ex,light:true};
  const kill=mk?{k:mk.k,v:mk.v,x:mk.x,y:mk.y,a:mk.a,ax:mk.ax,ay:mk.ay,w:mk.w||0}:{k:fx.c,v:fx.v,x:fx.x,y:fx.y,a:fx.a,ax:fx.sx,ay:fx.sy,w:fx.w||0};
  const s=D.bodyFor(1,kill,info,sim).body, h=(p,q)=>Math.round(Math.hypot(p[0]-q[0],p[1]-q[1]));
  const hd=b.hd&&s.hd?Math.max(h([b.hd[0],b.hd[1]],[s.hd[0],s.hd[1]]),h([b.hd[2],b.hd[3]],[s.hd[2],s.hd[3]])):null;
  out.push({v:kill.k+' '+kill.v, killFromServer:!!mk, fxMatchesKill:!!mk&&fx.x===mk.x&&fx.y===mk.y&&fx.v===mk.v&&fx.sx===mk.ax&&fx.sy===mk.ay,
    body:h([s.x,s.y],[b.x,b.y]), turn:ang(s.a,b.a), light:h(s.dr,b.dr), hat:h(s.ht,b.ht), hands:hd, client:[b.x,b.y,b.a], server:[s.x,s.y,s.a], trailClient:(b.tr||[]).length, trailServer:(s.tr||[]).length, bloodClient:(b.bl||[]).length, bloodServer:s.bl.length});
}
console.log(JSON.stringify(out));
"""
# Alice's own (local) corpse, in the server's wire shape
LOCAL = """()=>{ const A=__api; const r=(A.bodyList()||[]).find(b=>!b.remote && String(b.ownerId)===String(A.H.id) && b.cause!=='Vanish'); if(!r) return null;
  return { x:r.x, y:r.y, a:r.angle, dr:[r.dropped.x,r.dropped.y,r.dropped.angle], ht:[r.hat.x,r.hat.y,r.hat.angle], hd:r.hands?[].concat(...r.hands):null, bl:r.blood.map(b=>[b.x,b.y,b.seed]) } }"""
# Bob's replay of it: its state on every frame while it plays (the replay is replaced by the corpse on the frame it ends, so the last frame
# it played is what is compared; by then the body has long been asleep)
WATCH = """(id)=>{ window.__specEnd=null; window.__specSeen=0; const tick=()=>{ const f=(window.__fxs||[]).find(f=>f.id===id && f.jl);
  if(f){ const d=f.jl, R=window.__dphys&&d.ph?window.__dphys.remains(d):null; window.__specSeen++;
    window.__specEnd={ t:d.elapsed, dur:d.duration, x:d.body.x, y:d.body.y, a:d.body.angle, dr:R?[R.dropped.x,R.dropped.y,R.dropped.angle]:null, ht:R?[R.hat.x,R.hat.y,R.hat.angle]:null,
      hd:R?[].concat(...R.hands):null, bl:(R&&R.blood?R.blood:d.bursts).map(b=>[b.x,b.y,b.seed]), de:f.de, settle:d.settle } }
  else if(window.__specSeen) return; requestAnimationFrame(tick) }; requestAnimationFrame(tick) }"""
SPEC = "()=>window.__specSeen && !(window.__fxs||[]).some(f=>f.jl) ? window.__specEnd : (window.__specSeen ? {running:true} : null)"


def cmp(p, q):
    """distances between two corpses (q: the server's wire record)"""
    if not p or not q: return None
    h = lambda a, b: round(math.hypot(a[0] - b[0], a[1] - b[1]), 2)
    ang = lambda a, b: round(abs(math.atan2(math.sin(a - b), math.cos(a - b))), 4)
    bl = None
    if p.get('bl') is not None and q.get('bl') is not None:
        bl = {'counts': [len(p['bl']), len(q['bl'])], 'maxPx': max([h(a, b) for a, b in zip(p['bl'], q['bl'])] or [0]), 'seedsSame': [x[2] % 1000 for x in p['bl']] == [x[2] for x in q['bl']]}
    hd = max(h(p['hd'][0:2], q['hd'][0:2]), h(p['hd'][2:4], q['hd'][2:4])) if p.get('hd') and q.get('hd') else None
    return {'body': h([p['x'], p['y']], [q['x'], q['y']]), 'turn': ang(p['a'], q['a']), 'light': h(p['dr'], q['dr']) if p.get('dr') else None,
            'hat': h(p['ht'], q['ht']) if p.get('ht') else None, 'hands': hd, 'blood': bl}


def compare_old(rows):
    r = subprocess.run(['node', '-e', NODE, A_.game], input=json.dumps(rows), capture_output=True, text=True)
    return (json.loads(r.stdout or '[]') if r.returncode == 0 else []), r.stderr[-400:]


async def main():
    if A_.recompute:
        old = json.load(open(A_.recompute)); res, err = compare_old([r for r in old['raw'] if r.get('proto', 'parent') == 'parent'])
        old.update({'deaths': len(res), 'compare': res, 'nodeErr': err, 'recomputed': True}); lib3d.dump(A_.out, old)
        for x in res: print(x['v'], 'body', x['body'], 'turn', x['turn'], 'light', x['light'], 'hat', x['hat'], 'hands', x['hands'], 'fx==kill', x['fxMatchesKill'])
        return
    port = lib3d.free_port(); srv = lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []; rows = []; new = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS)
            ca = await b.new_context(viewport={'width': 640, 'height': 400}); cb = await b.new_context(viewport={'width': 640, 'height': 400})
            await ca.add_init_script(HOOK); await cb.add_init_script(HOOK)
            A = await lib3d.join(ca, port, 'parity3d', 'Alice', errs); await lib3d.admin_open(A)
            B = await lib3d.join(cb, port, 'parity3d', 'Bob', errs)
            bid = await B.evaluate("()=>__api.H.id"); await lib3d.admin_cmd(A, {'c': 'god', 'id': bid}); await A.wait_for_timeout(400)
            aid = await A.evaluate("()=>__api.H.id")
            spots = {k: await A.evaluate(lib3d.SPOTS, k) for k in ('open', 'wall')}
            for r in range(A_.rounds):
                for kind, v in [(k, v) for k in ('hound', 'smiler') for v in 'ABCD']:
                    if A_.only and A_.only != f'{kind}-{v}': continue
                    await lib3d.ensure_alive(A); sp = spots['wall'] if (kind == 'hound' and v == 'C') else spots['open']
                    await A.evaluate("([x,y,a])=>{__api.tp(x+(Math.random()-.5)*20,y+(Math.random()-.5)*20); __api.H.angle=a}", sp); await B.evaluate(lib3d.WATCH_FROM, sp)
                    await A.wait_for_timeout(2500)
                    if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                    await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
                    n0, r0, b0 = await A.evaluate("()=>[window.__tx.length, window.__rx.length, window.__bod.length]")
                    await B.evaluate(WATCH, aid)
                    await lib3d.click(A, f'[data-c=preview][data-k={kind}][data-var={v}]')
                    got = None; spec = None; tx = []; mk = None
                    for _ in range(40):
                        await A.wait_for_timeout(500)
                        tx, rx, bod = await A.evaluate("([n,r,b])=>[window.__tx.slice(n), window.__rx.slice(r), window.__bod.slice(b)]", [n0, r0, b0])
                        if spec is None or spec.get('running'): spec = await B.evaluate(SPEC)
                        fx = next((m for m in tx if m['t'] == 'fx' and m.get('k') == 'death'), None); bb = next((m for m in tx if m['t'] == 'b'), None)
                        mk = rx[0]['mk'] if rx else None
                        if fx and bb: got = {'proto': 'parent', 'fx': fx, 'b': bb, 'mk': mk, 'asked': f'{kind}-{v}'}; break
                        if mk and mk.get('de') is not None:
                            srvb = next((x for L in bod for x in L if x.get('k') == aid and x.get('de') == mk['de']), None)
                            loc = await A.evaluate(LOCAL)
                            if srvb and loc and spec and not spec.get('running'):
                                got = {'proto': '3d', 'mk': mk, 'server': srvb, 'victim': loc, 'spectator': spec, 'asked': f'{kind}-{v}'}; break
                    if not got: errs.append(f'{kind}-{v}: no complete set (sent {len(tx)}, mk {bool(mk)}, spectator {spec}, spectator received {await B.evaluate("()=>(window.__rfx||[]).map(m=>[m.k,m.id,m.de,m.el])")})')
                    elif got['proto'] == 'parent': rows.append(got)
                    else:
                        c = {'v': f"{got['mk']['k']} {got['mk']['v']}", 'de': got['mk']['de'], 'victimVsServer': cmp(got['victim'], got['server']), 'spectatorVsServer': cmp(got['spectator'], got['server']),
                             'clientSent': [m['t'] + ':' + str(m.get('k') or m.get('c')) for m in tx]}
                        new.append(c); got['compare'] = c; rows.append(got)
                        print(c['v'], 'victim', c['victimVsServer'], 'spectator', c['spectatorVsServer'], 'client sent', c['clientSent'], flush=True)
                    await lib3d.until_alive(A, 30)
            await b.close()
    finally:
        lib3d.stop_server(srv)
    old_rows = [r for r in rows if r['proto'] == 'parent']
    res, err = compare_old(old_rows) if old_rows else ([], '')
    lib3d.dump(A_.out, {'tool': 'dev/stage-3d/parity3d.py', 'game': A_.game, 'deaths': len(res) + len(new), 'compare': res, 'compare3d': new, 'raw': rows, 'nodeErr': err, 'errors': errs})
    for x in res: print(x['v'], 'body', x['body'], 'turn', x['turn'], 'light', x['light'], 'hat', x['hat'], 'hands', x['hands'], 'fx==kill', x['fxMatchesKill'])
    print('errors', errs)

asyncio.run(main())
