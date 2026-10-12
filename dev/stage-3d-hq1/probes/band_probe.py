"""Stage 3D HQ1 - which part of a papered wall face does the player actually see?  (development only; SwiftShader)

  python3 -I dev/stage-3d-hq1/probes/band_probe.py OUTDIR [GAME_DIR]

For one lit face of each side (S, N, E, W) a calibration stamp is put on the face through the remaster receiver: 12 stripes of
4 px each, from the crease up.  The player stands 60 px in front of it, facing it; a x3 crop shows which stripes the line of sight
reveals (band_<side>_zoom.png, band.json).  Uses the receiver as the game ships it; nothing is changed."""
import os, sys, asyncio, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import hq1lib as L
from playwright.async_api import async_playwright
OUT = sys.argv[1]; GAME = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'); W, H = 960, 640
CAL = r"""([id,u])=>{ const c=document.createElement('canvas'); c.width=48*3; c.height=48*3; const g=c.getContext('2d');
  const cols=['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffffff','#ff8800','#8800ff','#00ff88','#888888','#000000'];
  for(let i=0;i<12;i++){ g.fillStyle=cols[i]; g.fillRect(0,(48-(i+1)*4)*3,48*3,4*3); }
  return window.__l0v.surfaces.stamp(id,{image:c,w:48,h:48,u,v:0}) }"""
async def main():
    port = L.free_port(); srv = L.start_server(GAME, port, OUT + '/server.log'); errs = []; R = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS); ca = await b.new_context(viewport={'width': W, 'height': H})
            A = await L.join(ca, port, 'band', 'Alice', errs); await L.admin_open(A)
            await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await L.admin_cmd(A, {'c': 'god', 'id': await A.evaluate("()=>__api.H.id")})
            await A.evaluate("""()=>{ if(!window.__camWrapped){ const o=window.__mp; window.__mp=a=>{ window.__cam0=a; return o&&o(a) }; window.__camWrapped=1 } }""")
            for _ in range(60):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            for side in 'SNEW':
                S = await A.evaluate(L.FACE_SPOT, [side, 90, 0]); R[side] = S
                if not S: continue
                f = [x for x in await A.evaluate(L.FACES) if x['id'] == S['face']][0]
                u = (S['wx'] - f['origin'][0]) * f['u'][0] + (S['wy'] - f['origin'][1]) * f['u'][1]
                sid = await A.evaluate(CAL, [S['face'], u]); R[side + '_stamp'] = sid
                await L.place(A, S['x'] + S['ox'] * 60, S['y'] + S['oy'] * 60, S['a'] + 3.14159, W, H)
                await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
                await A.wait_for_timeout(4500)
                cam = await A.evaluate("()=>window.__cam0?[window.__cam0.sc, window.__cam0.cam.x, window.__cam0.cam.y]:null")
                R[side+'_cam'] = cam
                await A.screenshot(path=f'{OUT}/band_{side}.png')
                if cam:
                    from PIL import Image
                    sx, sy = W/2 + (S['wx']-cam[1])*cam[0], H/2 + (S['wy']-cam[2])*cam[0]
                    Image.open(f'{OUT}/band_{side}.png').crop((int(sx-80),int(sy-80),int(sx+80),int(sy+80))).resize((480,480), Image.NEAREST).save(f'{OUT}/band_{side}_zoom.png')
            await b.close()
    finally:
        L.stop_server(srv)
    json.dump(R, open(OUT + '/band.json', 'w'), indent=1); print(json.dumps(R)[:1500]); print(errs[:5])
asyncio.run(main())
