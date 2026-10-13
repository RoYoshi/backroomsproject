#!/usr/bin/env python3
"""Stage 3D HQ2 - the accepted HQ1 build and this tree, the same scenes on real screens, picture against picture (development only;
SwiftShader)

  python3 -I dev/stage-3d-hq2/paired_shots.py --old DIR --new DIR --out DIR

Three runs, one after the other, each a fresh server and browser: HQ1 (--old, an export of the accepted parent), this tree, and this tree
again (the A/A: what two runs of the same build differ by - the world's own randomness and the lamps' flicker).  In each run one page
(960 x 540, the monsters removed, the world frozen) is put in the same places and photographed:
  corridor  the one-tile corridor of the collision tests, light on
  hall      the open floor of the crowd tests, light on
  wall      the best-lit papered wall face (the HQ1 stain tests' spot), facing out, light on
  dark      the hall in a blackout, only the flashlight
  corpses   the hall with HQ1's twenty corpse records laid around (dev/stage-3d/fixtures/corpses20.json), light on
For each scene: the mean absolute grey difference between the pictures, HQ1 against this tree and this tree against itself, and the share
of pixels more than 24 grey levels apart.  A scene passes if HQ1 against this tree differs no more than the A/A does (x 1.5, or + 1 grey
level).  Writes HQ1 | HQ2 side by side for each scene (pair_<scene>.png) and the numbers (paired.json)."""
import os, sys, asyncio, argparse, json, time, io
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hq2lib as Q
L = Q.L
from playwright.async_api import async_playwright
from PIL import Image, ImageChops, ImageDraw

ap = argparse.ArgumentParser(); ap.add_argument('--old', required=True); ap.add_argument('--new', default=Q.REPO); ap.add_argument('--out', required=True)
A_ = ap.parse_args(); A_.old = os.path.abspath(A_.old); A_.new = os.path.abspath(A_.new)
W, H = 960, 540
CORPSES = json.load(open(os.path.join(HERE, '..', 'stage-3d', 'fixtures', 'corpses20.json')))
CORPSES = CORPSES['corpses'] if isinstance(CORPSES, dict) and 'corpses' in CORPSES else CORPSES
LAY = """(L)=>{ const W=window.__mpLib.wire; const shift=(b)=>{ const dx=b.x-b.ox, dy=b.y-b.oy; const o=JSON.parse(JSON.stringify(b.rec)); o.x+=dx; o.y+=dy; o.k=9000+b.i;
   o.bl=o.bl.map(q=>[q[0]+dx,q[1]+dy,q[2]]); o.dr=[o.dr[0]+dx,o.dr[1]+dy,o.dr[2]]; o.ht=[o.ht[0]+dx,o.ht[1]+dy,o.ht[2]]; o.tr=(o.tr||[]).map(q=>[q[0]+dx,q[1]+dy]); return W.toRec(o) };
   __api.bodies(L.map(shift)) }"""                                          # (dev/stage-3d/perf_death.py's corpses20 window, as it is)


async def run(game, tag, outdir):
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(game, port, os.path.join(outdir, f'{tag}.server.log')); errs = []; shots = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS); c = await b.new_context(viewport={'width': W, 'height': H})
            A = await L.join(c, port, 'h25pair', 'Alice', errs); await L.admin_open(A); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            await L.clear_monsters(A); await L.ensure_alive(A)
            await L.admin_cmd(A, {'c': 'freeze', 'on': 1}); await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'})
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            face = await A.evaluate(L.FACE_SPOT, ['N', 64, 0]) or await A.evaluate(L.FACE_SPOT, ['S', 64, 0])
            scenes = [('corridor', 900, 720, 0.0, 'off', False), ('hall', 4450, 3450, 0.8, 'off', False), ('wall', face['x'], face['y'], face['a'], 'off', False),
                      ('dark', 4450, 3450, 0.8, 'on', False), ('corpses', 4450, 3450, 0.8, 'off', True)]
            for name, x, y, a, bo, corpses in scenes:
                await L.admin_cmd(A, {'c': 'blackout', 'mode': bo}); await L.place(A, x, y, a, W, H)
                if not await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
                if corpses: await A.evaluate(LAY, [{'rec': q['rec'], 'x': x + (i % 5) * 70 - 140, 'y': y + (i // 5) * 70 - 105, 'ox': q['rec']['x'], 'oy': q['rec']['y'], 'i': i} for i, q in enumerate(CORPSES)])
                await A.mouse.move(W / 2 + 220, H / 2); await A.wait_for_timeout(2500)
                png = await A.screenshot(type='png'); shots[name] = png
                open(os.path.join(outdir, f'{tag}_{name}.png'), 'wb').write(png)
                if corpses: await A.evaluate("()=>__api.bodies([])")
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    return shots, errs, face


def diff(p, q):
    a = Image.open(io.BytesIO(p)).convert('L'); b = Image.open(io.BytesIO(q)).convert('L'); h = ImageChops.difference(a, b).histogram(); n = sum(h)
    return round(sum(v * c for v, c in enumerate(h)) / n, 3), round(sum(h[25:]) / n, 5)


async def main():
    os.makedirs(A_.out, exist_ok=True)
    R = {'tool': 'dev/stage-3d-hq2/paired_shots.py', 'old': A_.old, 'new': A_.new, 'scenes': {}, 'runs': {}}
    S = {}
    for tag, game in (('hq1', A_.old), ('hq2', A_.new), ('hq2b', A_.new)):
        S[tag], errs, face = await run(game, tag, A_.out); R['runs'][tag] = {'errors': errs[:10], 'wallSpot': face}
    ok = True
    for name in S['hq1']:
        d_on, f_on = diff(S['hq1'][name], S['hq2'][name]); d_aa, f_aa = diff(S['hq2'][name], S['hq2b'][name])
        met = d_on <= max(1.5 * d_aa, d_aa + 1.0); ok = ok and met
        R['scenes'][name] = {'hq1_vs_hq2': {'meanAbsGrey': d_on, 'share24': f_on}, 'hq2_vs_hq2': {'meanAbsGrey': d_aa, 'share24': f_aa}, 'met': met}
        a = Image.open(io.BytesIO(S['hq1'][name])); b = Image.open(io.BytesIO(S['hq2'][name])); im = Image.new('RGB', (W * 2 + 8, H + 28), (20, 20, 20))
        im.paste(a, (0, 28)); im.paste(b, (W + 8, 28)); d = ImageDraw.Draw(im); d.text((8, 8), f'HQ1 (accepted parent)  {name}', fill=(230, 230, 230)); d.text((W + 16, 8), f'HQ2 (this tree)  {name}   mean |diff| {d_on} (A/A {d_aa})', fill=(230, 230, 230))
        im.save(os.path.join(A_.out, f'pair_{name}.png'))
    R['errors'] = sum(len(r['errors']) for r in R['runs'].values()); R['ok'] = ok and R['errors'] == 0
    with open(os.path.join(A_.out, 'paired.json'), 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for k, v in R['scenes'].items(): print(('MET     ' if v['met'] else 'NOT MET ') + f"{k}: HQ1 vs HQ2 mean |grey diff| {v['hq1_vs_hq2']['meanAbsGrey']} (>24: {v['hq1_vs_hq2']['share24']}); A/A {v['hq2_vs_hq2']['meanAbsGrey']} ({v['hq2_vs_hq2']['share24']})")
    print('page errors', R['errors']); sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
