#!/usr/bin/env python3
"""Stage 3D HQ1 - a wallpaper stain through the remaster's cache regeneration (development only; SwiftShader)

  python3 -I dev/stage-3d-hq1/wall_rebuild_test.py --game DIR --out DIR

Alice (admin) dies by Hound C into a lit south face (the Death Lab at normal speed); Bob (god mode) watches from in front of it.  Once
the corpse lies there, on Bob's screen, the remaster's art is regenerated in three ways while the stain must stay exactly as it is -
one stain, one receiver mark, no second stamp from gore.js - and plainly on the wallpaper (the stain_metric band count, gate W1: >= 150):
  rebuild     window.__l0v.dev.rebuild(): the whole level art made again (textures, zones, chunks)
  tier        the lighting quality to HIGH and back to LOW: the remaster rebuilds its tier in the background each time
  evict       Bob far away (the baked chunks around the stain leave the cache) and back (they are baked again)
Writes OUT/wall_rebuild.json and a picture per step."""
import os, sys, asyncio, argparse, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
import stain_metric as SM
from PIL import Image
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game); os.makedirs(A_.out, exist_ok=True)
W, H = 960, 640
HOOK = """()=>{ if(!window.__camWrapped){ const o=window.__mp; window.__mp=a=>{ window.__cam0=a; return o&&o(a) }; window.__camWrapped=1 } }"""
STATE = "()=>{ const G=window.__gore.wallStains, Lv=window.__l0v, s=Lv.stats(); return { stains:G.list(), stats:G.stats(), receiver:Lv.surfaces.count(), tier:s.tier, job:s.job, builds:s.builds, bake:s.bake, cam:window.__cam0?[window.__cam0.sc,window.__cam0.cam.x,window.__cam0.cam.y]:null } }"


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, os.path.join(A_.out, 'wall_rebuild_server.log')); errs = []
    R = {'tool': 'dev/stage-3d-hq1/wall_rebuild_test.py', 'game': A_.game, 'steps': [], 'checks': []}
    def check(name, ok, info): R['checks'].append({'name': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + '  ' + json.dumps(info)[:300], flush=True)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(2)]
            A = await L.join(ca, port, 'hq1rb', 'Alice', errs); await L.admin_open(A)
            B = await L.join(cb, port, 'hq1rb', 'Bob', errs)
            await L.admin_cmd(A, {'c': 'god', 'id': await B.evaluate("()=>__api.H.id")}); await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1200)
            await L.clear_monsters(A); await L.ensure_alive(A); await L.auto_revive(A, True)
            for _ in range(80):
                if await B.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await B.wait_for_timeout(250)
            await B.evaluate(HOOK)
            S = await A.evaluate(L.FACE_SPOT, ['S', 90, 0]); V = await B.evaluate(L.VIEW_SPOT, S); R['spot'] = S; R['viewer'] = V
            await L.place(A, S['x'], S['y'], S['a'], W, H); await L.place(B, V[0], V[1], V[2], W, H); await A.wait_for_timeout(2500)
            if not await L.preview(A, 'hound', 'C'): raise SystemExit('preview refused: ' + L.lib3d.last_preview(os.path.join(A_.out, 'wall_rebuild_server.log')))
            t0 = time.time()
            while time.time() - t0 < 25:
                if await B.evaluate(L.BODIES) and await A.evaluate("()=>!__api.G.caught && __api.fall()<0"): break
                await A.wait_for_timeout(200)
            await L.clear_monsters(A); await L.admin_cmd(A, {'c': 'god', 'id': await A.evaluate("()=>__api.H.id")}); await B.wait_for_timeout(2000)

            async def snap(name):
                st = await B.evaluate(STATE); fn = os.path.join(A_.out, f'wall_rebuild_{name}.png'); await B.screenshot(path=fn)
                hit = [s for s in st['stains'] if s['status'] == 'stamped']; band = None
                if hit and st['cam']:
                    bx = SM.box([hit[0]['x'], hit[0]['y']], hit[0]['side'], 0, 22, st['cam']); band = SM.count(Image.open(fn).convert('RGB'), bx)
                row = {'step': name, 'file': os.path.basename(fn), 'band': band, 'stamped': len(hit), 'receiver': st['receiver'], 'stamps': st['stats']['stamps'], 'removed': st['stats']['removed'],
                       'tier': st['tier'], 'builds': st['builds'], 'bake': {k: st['bake'].get(k) for k in ('bakes', 'evictions', 'resident', 'chunks')}}
                R['steps'].append(row); print(json.dumps(row), flush=True); return row
            r0 = await snap('before')
            await B.evaluate("()=>window.__l0v.dev.rebuild()"); await B.wait_for_timeout(2500); r1 = await snap('rebuild')
            async def tier(q):
                await B.evaluate("q=>window.__brRole.setQuality(q)", q)
                for _ in range(240):
                    s = await B.evaluate("()=>{ const s=window.__l0v.stats(); return [s.tier, !!s.job] }")
                    if s[0] == q and not s[1]: break
                    await B.wait_for_timeout(250)
                await B.wait_for_timeout(1500)
            await tier('high'); r2 = await snap('tier_high')
            await tier('low'); r3 = await snap('tier_low')
            await L.place(B, V[0] + 3200, V[1], V[2], W, H, tries=1)
            for k in range(8):
                for dx in (3200, 3200, -2400):
                    await B.evaluate("([x,y])=>{ if(__api.sl(x,y,26)) __api.tp(x,y) }", [V[0] + dx, V[1] + 900 * (k % 3)]); await B.wait_for_timeout(500)
            far = await B.evaluate(STATE)
            await L.place(B, V[0], V[1], V[2], W, H); await B.wait_for_timeout(3000); r4 = await snap('evict_back')
            R['far'] = {'bake': far['bake'], 'receiver': far['receiver']}
            rows = [r0, r1, r2, r3, r4]
            check('the stain stays through a full rebuild, two tier rebuilds and a cache eviction: one stain, one receiver mark, no second stamp, >= 150 blood pixels on the band each time',
                  all(r['stamped'] == 1 and r['receiver'] == 1 and r['stamps'] == r0['stamps'] and r['removed'] == r0['removed'] and (r['band'] or 0) >= 150 for r in rows)
                  and r2['tier'] == 'high' and r3['tier'] == 'low' and r4['bake']['evictions'] > r3['bake']['evictions'],
                  {r['step']: [r['band'], r['stamped'], r['receiver'], r['stamps'], r['tier'], r['bake']['evictions']] for r in rows})
            await b.close()
    finally:
        L.stop_server(srv)
    R['errors'] = errs[:20]; R['ok'] = bool(R['checks']) and all(c['ok'] for c in R['checks'])
    L.dump(os.path.join(A_.out, 'wall_rebuild.json'), R); print('WALL REBUILD OK' if R['ok'] else 'WALL REBUILD NOT OK'); sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
