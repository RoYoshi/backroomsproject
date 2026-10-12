#!/usr/bin/env python3
"""Stage 3D HQ1 - does a wall contact resolve to the right papered face, and only to one?  (development only; one browser page)

  python3 -I dev/stage-3d-hq1/wall_faces_test.py --game DIR --out FILE.json

The game is loaded; the Level 0 remaster's own receiver lists the papered wall faces (window.__l0v.surfaces.list).  gore.js's
wallStains.faceFor(x, y, nx, ny), the lookup the wall stains use, is asked about synthetic contacts on the real map:
  face        every face (all of them), its middle, the contact normal its outward normal          -> that face, that side
  tilted40    the same, the normal turned 40 degrees                                                -> that face
  tilted55    the same, turned 55 degrees (past the 0.6 cut)                                         -> nothing
  ends        3 px from either end of the run (an outer corner, or where the run turns)             -> nothing
  inside6     6 px from the line, into the floor                                                    -> nothing
  diagonal    each outer corner of a wall cell, the diagonal normal                                 -> nothing
  pillars     the middle of each side of each pillar (56 x 56 blockers), its outward normal         -> nothing
  props       the middle of each side of each other non-wall blocker, its outward normal            -> nothing
  floor       floor points away from walls, four normals each                                       -> nothing
Also: what the receiver says the faces are (kind and material).  Exit 0 only if every case is right."""
import os, sys, asyncio, argparse, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True); ap.add_argument('--query', default='')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
TEST = r"""()=>{ const G=window.__gore.wallStains, Lv=window.__l0v, A=__api; G.reset();
  const faces=Lv.surfaces.list().filter(f=>f.kind==='wall'), R={faces:faces.length, materials:[...new Set(faces.map(f=>f.material))], kinds:[...new Set(Lv.surfaces.list().map(f=>f.kind))], cases:{}, bad:[]};
  const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a), x*Math.sin(a)+y*Math.cos(a)];
  const tally=(name, ok, info)=>{ const c=R.cases[name]||(R.cases[name]={n:0,ok:0}); c.n++; if(ok) c.ok++; else if(R.bad.length<40) R.bad.push(Object.assign({case:name},info)); };
  for(const f of faces){ const ox=-f.up[0], oy=-f.up[1], at=u=>[f.origin[0]+f.u[0]*u, f.origin[1]+f.u[1]*u];
    const [x,y]=at(f.length/2); let r=G.faceFor(x,y,ox,oy); tally('face', r&&r.id===f.id&&r.side===f.side, {f:f.id, got:r&&r.id});
    for(const s of [1,-1]){ let [nx,ny]=rot(ox,oy,s*40*Math.PI/180); r=G.faceFor(x,y,nx,ny); tally('tilted40', r&&r.id===f.id, {f:f.id, got:r&&r.id});
      [nx,ny]=rot(ox,oy,s*55*Math.PI/180); r=G.faceFor(x,y,nx,ny); tally('tilted55', !r, {f:f.id, got:r&&r.id}); }
    for(const u of [3, f.length-3]){ const [ex,ey]=at(u); r=G.faceFor(ex,ey,ox,oy); tally('ends', !r, {f:f.id, u, got:r&&r.id}); }
    r=G.faceFor(x+ox*6,y+oy*6,ox,oy); tally('inside6', !r, {f:f.id, got:r&&r.id});
  }
  // outer corners of wall cells: a wall cell with two faces meeting at a convex corner (both neighbours floor)
  const sl=(x,y)=>A.sl(x,y,2), T=96; let seen=0;
  for(const f of faces){ for(const end of [0, f.length]){ const cx=f.origin[0]+f.u[0]*end, cy=f.origin[1]+f.u[1]*end;
      for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const n=[dx/Math.SQRT2, dy/Math.SQRT2]; if(!sl(cx+dx*8, cy+dy*8)) continue;            // floor diagonally out of the corner
        if(-(n[0]*f.up[0]+n[1]*f.up[1])<.5) continue; const r=G.faceFor(cx,cy,n[0],n[1]); tally('diagonal', !r, {at:[cx,cy], n, got:r&&r.id}); seen++; } } }
  // pillars and props: the game's own blockers that are not wall cells
  const blk=new Map(); for(let y=200;y<6700;y+=48) for(let x=200;x<9000;x+=48) for(const q of (A.Bc(x,y)||[])) { const k=q.x+','+q.y+','+q.w+','+q.h; if(!blk.has(k)) blk.set(k,q); }
  for(const q of blk.values()){ const wall=q.w===96&&q.h===96&&q.x%96===0&&q.y%96===0; if(wall) continue; const kind=q.w===56&&q.h===56?'pillars':'props';
    for(const [px,py,nx,ny] of [[q.x+q.w/2,q.y,0,-1],[q.x+q.w/2,q.y+q.h,0,1],[q.x,q.y+q.h/2,-1,0],[q.x+q.w,q.y+q.h/2,1,0]]){ if(!sl(px+nx*6,py+ny*6)) continue; const r=G.faceFor(px,py,nx,ny); tally(kind, !r, {at:[px,py], got:r&&r.id}); } }
  // floor points well away from walls
  let fl=0; for(let y=300;y<6600&&fl<300;y+=113) for(let x=300;x<9000&&fl<300;x+=157){ if(!A.sl(x,y,30)) continue; fl++; for(const [nx,ny] of [[0,1],[0,-1],[1,0],[-1,0]]){ const r=G.faceFor(x,y,nx,ny); tally('floor', !r, {at:[x,y], got:r&&r.id}); } }
  R.ok=Object.values(R.cases).every(c=>c.ok===c.n) && faces.length>0 && R.materials.length===1 && R.materials[0]==='material:wallpaper';
  return R }"""


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS); ca = await b.new_context(viewport={'width': 960, 'height': 640})
            A = await L.join(ca, port, 'hq1faces', 'Alice', errs, ('&' + A_.query) if A_.query else '')
            for _ in range(120):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            R = await A.evaluate(TEST)
            R.update({'tool': 'dev/stage-3d-hq1/wall_faces_test.py', 'game': A_.game, 'query': A_.query, 'errors': errs[:10],
                      'tier': await A.evaluate("()=>window.__l0v.stats().tier")})
            await b.close()
    finally:
        L.stop_server(srv)
    L.dump(A_.out, R)
    for k, c in R['cases'].items(): print(f"{'PASS' if c['ok'] == c['n'] else 'FAIL'} {k}: {c['ok']}/{c['n']}")
    print(f"faces {R['faces']} ({', '.join(R['materials'])}); surface kinds {R['kinds']}; tier {R['tier']}")
    print('WALL FACES OK' if R['ok'] else 'WALL FACES NOT OK: ' + json.dumps(R['bad'][:6]))
    sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
