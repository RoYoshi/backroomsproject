#!/usr/bin/env python3
"""Stage 3D - the victim's own corpse against the server's fallback corpse, for all eight deaths (development only).

  python3 dev/stage-3d/parity3d.py --game DIR --out FILE.json [--rounds 1]

A real browser dies at normal speed through the admin DEATHS preview (the real kill path; Hound C in front of a wall).  On the wire the
tool records what the victim's client sends ('fx', 'b') and what it receives (the server's kill record 'mk' in the snapshot).  The
server's fallback (GAME/death_srv.js bodyFor, the same code the server runs when a victim never reports its corpse) is then run in Node
on the SERVER's kill record, with the victim's gear and look, and the two corpses compared: body position and turn, the dropped light,
the hat, the two hands.  Since 3D the server can also make its corpse at the kill (a sealed reference); the comparison is the same.
The server runs with a synthetic admin passcode (lib3d.PASS)."""
import os, sys, asyncio, argparse, time, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3d
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); ap.add_argument('--rounds', type=int, default=1); A_ = ap.parse_args()
HOOK = """(()=>{ window.__tx=[]; window.__rx=[]; const S=WebSocket.prototype.send; WebSocket.prototype.send=function(d){ try{ const m=JSON.parse(d); if(m.t==='fx'||m.t==='b') window.__tx.push(m); }catch(e){} return S.call(this,d); };
  const W=window.WebSocket; window.WebSocket=function(u,p){ const ws=new W(u,p); ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t==='s'&&m.mk) window.__rx.push({mk:m.mk, ms:m.ms}); }catch(_){} }); return ws; };
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


async def main():
    port = lib3d.free_port(); srv = lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []; rows = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS); c = await b.new_context(viewport={'width': 640, 'height': 400})
            await c.add_init_script(HOOK)
            A = await lib3d.join(c, port, 'parity3d', 'Alice', errs); await lib3d.admin_open(A)
            spots = {k: await A.evaluate(lib3d.SPOTS, k) for k in ('open', 'wall')}
            for r in range(A_.rounds):
                for kind, v in [(k, v) for k in ('hound', 'smiler') for v in 'ABCD']:
                    await lib3d.ensure_alive(A); sp = spots['wall'] if (kind == 'hound' and v == 'C') else spots['open']
                    await A.evaluate("([x,y,a])=>{__api.tp(x+(Math.random()-.5)*20,y+(Math.random()-.5)*20); __api.H.angle=a}", sp); await A.wait_for_timeout(2500)
                    if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                    await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
                    n0, r0 = await A.evaluate("()=>[window.__tx.length, window.__rx.length]")
                    await lib3d.click(A, f'[data-c=preview][data-k={kind}][data-var={v}]')
                    got = None
                    for _ in range(40):
                        await A.wait_for_timeout(500)
                        tx, rx = await A.evaluate("([n,r])=>[window.__tx.slice(n), window.__rx.slice(r)]", [n0, r0])
                        fx = next((m for m in tx if m['t'] == 'fx' and m.get('k') == 'death'), None); bb = next((m for m in tx if m['t'] == 'b'), None)
                        if fx and bb: got = {'fx': fx, 'b': bb, 'mk': rx[0]['mk'] if rx else None, 'asked': f'{kind}-{v}'}; break
                    if got: rows.append(got)
                    else: errs.append(f'{kind}-{v}: no fx/b pair')
                    await lib3d.until_alive(A, 30)
            await b.close()
    finally:
        lib3d.stop_server(srv)
    r = subprocess.run(['node', '-e', NODE, A_.game], input=json.dumps(rows), capture_output=True, text=True)
    res = json.loads(r.stdout or '[]') if r.returncode == 0 else []
    lib3d.dump(A_.out, {'tool': 'dev/stage-3d/parity3d.py', 'game': A_.game, 'deaths': len(res), 'compare': res, 'raw': rows, 'nodeErr': r.stderr[-400:], 'errors': errs})
    for x in res: print(x['v'], 'body', x['body'], 'turn', x['turn'], 'light', x['light'], 'hat', x['hat'], 'hands', x['hands'], 'fx==kill', x['fxMatchesKill'])

asyncio.run(main())
