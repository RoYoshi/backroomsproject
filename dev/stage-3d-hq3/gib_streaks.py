#!/usr/bin/env python3
"""Stage 3D HQ3 - the white streaks on the gibs: the same explosions drawn by several versions of gore.js, pixel for pixel
(development only; SwiftShader, Pillow)

  python3 -I dev/stage-3d-hq3/gib_streaks.py --game DIR --variant NAME=FILE [--variant NAME=FILE ...] --out FILE.json [--shots DIR] [--lines A,B]
  python3 -I dev/stage-3d-hq3/gib_streaks.py --reanalyse FILE.json --out FILE2.json [--lines A,B]      (from a saved run's screenshots)

One real game page per variant (its own server, synthetic passcode), with gore.js replaced by FILE: the page's request for gore.js is
answered with it, nothing on disk changes.  On each page the real gore.js gibs() draws the same eight explosions:
  - the real breakup outlines (dphys.gibShapes) of eight seeds;
  - the pieces and both hands spread as at 0 s, in flight (lifted off the floor), late in flight and at rest, with every hand turn;
  - each into its own Graphics, as the replay and the corpse do;
  - at 4x, on a plain dark floor (0x2a241a), straight on the game's Pixi stage, with the world and every overlay hidden.
One screenshot per variant.  Reported per variant:
  stray pixels   pixels that are not the floor yet lie outside everything gibs() means to draw: every piece and its shadow, every
                 hand and its shadow, the headlamp (each grown by 6 px for strokes and edge smoothing).  A line joining two shapes is
                 counted here; the shapes themselves never are.
and per pair of variants the pixels that differ, inside and outside the hands, and how many lie off every line from an explosion's
core lump to the start of a hand's highlight (where the shipped code's stray lines run).  Writes streaks_<variant>.png and, for each variant
with stray pixels, streaks_<variant>_stray.png (the stray pixels in magenta).
--lines A,B  where A's and B's screenshots differ outside the hands, are those pixels exactly two straight lines per explosion, from one
             point (searched within 40 px of the core lump's centre) to the start of each hand's highlight?  Per explosion: the best
             point and how many differing pixels outside the hands lie more than 3 px off both lines; also how many differing pixels
             are darker in A than in B (a white line over the picture only ever makes A lighter).  Writes diff_<A>_<B>.png."""
import os, sys, asyncio, argparse, json, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
from playwright.async_api import async_playwright
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--variant', action='append', default=[])
ap.add_argument('--reanalyse', default=None); ap.add_argument('--lines', default=None)
ap.add_argument('--out', required=True); ap.add_argument('--shots', default=None)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
VARS = [(v.split('=', 1)[0], os.path.abspath(v.split('=', 1)[1])) for v in A_.variant]
W, H, S, BG = 1200, 760, 4, (0x2a, 0x24, 0x1a)
DRAW = r"""([W, H, S]) => {
  const A = window.__api, D = window.__dphys, G = window.__gore;
  let root = A.floor(); while (root.parent) root = root.parent;
  let Gr = null; const st = [root];
  while (st.length && !Gr) { const n = st.pop(); if (n && typeof n.circle === 'function' && typeof n.clear === 'function' && n.context) Gr = n.constructor; if (n && n.children) st.push(...n.children); }
  for (const c of root.children) c.visible = false;
  const pixi = document.querySelector('#game canvas');                                   // the game's Pixi canvas; every overlay (the light canvas, grain, HUD) hidden
  for (const el of document.querySelectorAll('body *')) if (el !== pixi && !el.contains(pixi)) el.style.visibility = 'hidden';
  if (!pixi || !Gr) return null;
  const bg = new Gr(); bg.rect(0, 0, W, H).fill(0x2a241a); root.addChild(bg);
  const look = { main: '#ffcc77', hands: '#e6bb76' }, out = [], GS = 1.15;
  const stages = [{ k: 0, spread: 1.0, z: 0, dead: 0 }, { k: 1, spread: 2.2, z: 24, dead: .2 }, { k: 2, spread: 3.4, z: 8, dead: .6 }, { k: 3, spread: 3.0, z: 0, dead: 1 }];
  for (let i = 0; i < 8; i++) {
    const seed = 1000 + i * 7919, sh = D.gibShapes(seed), stg = stages[i % 4], col = i % 4, row = (i / 4) | 0;
    const ox = 150 + col * 300, oy = 190 + row * 380, g = new Gr(); g.position.set(ox, oy); g.scale.set(S); root.addChild(g);
    const pieces = sh.map((p, j) => ({ x: p.cx * stg.spread, y: p.cy * stg.spread, rot: stg.spread > 1 ? (j + 1) * .9 + i : 0, z: p.core ? 0 : stg.z, poly: p.poly, core: p.core }));
    const hr = 18 * (.9 + stg.spread * .45), ha = i * .8;
    const hands = [{ x: Math.cos(ha) * hr, y: Math.sin(ha) * hr, rot: i * 1.3, z: stg.z * .5 }, { x: -Math.cos(ha + .5) * hr, y: -Math.sin(ha + .5) * hr, rot: i * 1.3 + 2.1, z: stg.z * .5 }];
    const eqKind = i % 3 === 0 ? 'headlamp' : 'flashlight';
    G.gibs(g, pieces, hands, look, { dead: stg.dead, eqKind });
    // what gibs() means to draw, in screen pixels (the same placement as gibs(): GIB_SCALE, the lift, the shadow's offset)
    const scr = (x, y) => [ox + x * S, oy + y * S], polys = [], discs = [];
    for (const q of pieces) { const z = q.z || 0, s = (1 + z / 110) * GS, c = Math.cos(q.rot), n = Math.sin(q.rot);
      polys.push(q.poly.map(v => scr(q.x + (v[0] * c - v[1] * n) * s, q.y + (v[0] * n + v[1] * c) * s)));
      polys.push(q.poly.map(v => scr(q.x + 1.5 + z * .15 + (v[0] * c - v[1] * n) * s, q.y + 2.5 + z * .25 + (v[0] * n + v[1] * c) * s))); }
    for (const h of hands) { const z = h.z || 0; discs.push([...scr(h.x, h.y), 6 * (1 + z / 110) * S]); discs.push([...scr(h.x + 1.2 + z * .15, h.y + 2.4 + z * .25), 6 * S]); }
    if (eqKind === 'headlamp') { const q = pieces[0], c = Math.cos(q.rot), n = Math.sin(q.rot); discs.push([...scr(q.x + c * 2, q.y + n * 2), 3.4 * S]); }
    const core = pieces.find(q => q.core);                                              // (where the shipped code's stray lines start: the core lump's centre)
    out.push({ seed, stage: stg.k, pieces: pieces.length, polys, discs, hands: hands.map(h => [...scr(h.x, h.y), 6 * (1 + (h.z || 0) / 110) * S + 2]),
      streaks: core ? hands.map(h => [scr(core.x, core.y), scr(h.x - 4.3 * (1 + (h.z || 0) / 110), h.y)]) : [] });
  }
  return out;
}"""


async def render(p, name, src):
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + f'.{name}.server.log'); errs = []
    try:
        b = await p.chromium.launch(args=Q.ARGS); ctx = await b.new_context(viewport={'width': W, 'height': H})
        body = open(src, 'rb').read()
        await ctx.route('**/gore.js*', lambda route: route.fulfill(status=200, body=body, headers={'content-type': 'text/javascript', 'cache-control': 'no-store'}))
        P = await Q.join(ctx, port, 'streak-' + name, 'Probe', errs)
        served = await P.evaluate("()=>fetch('./gore.js',{cache:'no-store'}).then(r=>r.text()).then(t=>t.length)")
        scenes = await P.evaluate(DRAW, [W, H, S]); await P.wait_for_timeout(1200)
        f = os.path.join(A_.shots or os.path.dirname(A_.out), f'streaks_{name}.png'); await P.screenshot(path=f)
        await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    return {'file': f, 'scenes': scenes, 'goreBytesServed': served, 'goreBytes': len(body), 'pageErrors': errs[:10]}


def intended_mask(scenes, grow=6):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for sc in scenes:
        for poly in sc['polys']: d.polygon([tuple(v) for v in poly], fill=255)
        for x, y, r in sc['discs']: d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    return m.filter(ImageFilter.MaxFilter(2 * grow + 1))


def two_lines(R, a, b, scenes):
    A = np.asarray(Image.open(R['variants'][a]['file']).convert('RGB'), dtype=np.int16); B = np.asarray(Image.open(R['variants'][b]['file']).convert('RGB'), dtype=np.int16)
    diff = np.abs(A - B).max(axis=2) > 2; ys, xs = np.nonzero(diff)
    hands = [h for sc in scenes for h in sc['hands']]
    inh = np.zeros(len(xs), bool)
    for hx, hy, r in hands: inh |= (xs - hx) ** 2 + (ys - hy) ** 2 <= r * r
    darker = int(((A.sum(axis=2) < B.sum(axis=2) - 6) & diff).sum())
    owner = np.array([min(range(len(scenes)), key=lambda k: abs(x - (150 + (k % 4) * 300)) + abs(y - (190 + (k // 4) * 380))) for x, y in zip(xs, ys)]) if len(xs) else np.array([])
    def dist(px, py, x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy; t = np.clip(((px - x1) * dx + (py - y1) * dy) / max(L, 1e-9), 0, 1); return np.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
    per = []
    for k, sc in enumerate(scenes):
        m = (owner == k) & ~inh if len(xs) else np.array([], bool); px, py = xs[m].astype(float), ys[m].astype(float)
        if not len(px): per.append({'explosion': k, 'pixelsOutsideHands': 0}); continue
        (cx, cy), ends = sc['streaks'][0][0], [st[1] for st in sc['streaks']]; best = None
        for ox in range(int(cx) - 40, int(cx) + 41):
            for oy in range(int(cy) - 40, int(cy) + 41):
                d = np.minimum(dist(px, py, ox, oy, *ends[0]), dist(px, py, ox, oy, *ends[1])); off = int((d > 3).sum())
                if best is None or off < best[0]: best = (off, ox, oy)
        per.append({'explosion': k, 'pixelsOutsideHands': int(len(px)), 'offBothLines': best[0], 'meetingPoint': [best[1], best[2]], 'fromCoreCentre': round(math.hypot(best[1] - cx, best[2] - cy), 1)})
    v = Image.open(R['variants'][b]['file']).convert('RGB'); vp = v.load()
    for x, y in zip(xs, ys): vp[int(x), int(y)] = (0, 255, 255)
    v.save(os.path.join(os.path.dirname(R['variants'][b]['file']), f'diff_{a}_{b}.png'))
    return {'a': a, 'b': b, 'pixelsDiffer': int(len(xs)), 'insideAHand': int(inh.sum()), 'darkerInA': darker, 'perExplosion': per,
            'offBothLines': sum(e.get('offBothLines', 0) for e in per)}


async def main():
    if A_.reanalyse:
        R = json.load(open(A_.reanalyse)); R['reanalysedFrom'] = A_.reanalyse
        names = list(R['variants']); scenes = R['variants'][names[0]]['scenes']
        if A_.lines: R['lines'] = two_lines(R, *A_.lines.split(','), scenes)
        with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
        if A_.lines: L = R['lines']; print(f"{L['a']} vs {L['b']}: {L['pixelsDiffer']} px differ, {L['insideAHand']} inside a hand; darker in {L['a']}: {L['darkerInA']}; outside the hands, off both lines of their explosion: {L['offBothLines']}"); [print('  ', e) for e in L['perExplosion']]
        return
    if A_.shots: os.makedirs(A_.shots, exist_ok=True)
    R = {'tool': 'dev/stage-3d-hq3/gib_streaks.py', 'game': A_.game, 'scale': S, 'variants': {}, 'pairs': []}
    async with async_playwright() as p:
        for name, src in VARS: R['variants'][name] = await render(p, name, src)
    names = [n for n, _ in VARS]; scenes = R['variants'][names[0]]['scenes']
    mask = intended_mask(scenes).load()
    hands = [h for sc in scenes for h in sc['hands']]
    in_hand = lambda x, y: any((x - hx) ** 2 + (y - hy) ** 2 <= r * r for hx, hy, r in hands)
    segs = [l for sc in scenes for l in sc['streaks']]
    def seg(px, py, a, b):
        (x1, y1), (x2, y2) = a, b; dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / L)); return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
    for n in names:
        im = Image.open(R['variants'][n]['file']).convert('RGB'); px = im.load(); stray = []; per = [0] * len(scenes)
        for y in range(H):
            for x in range(W):
                if not mask[x, y] and max(abs(a - b) for a, b in zip(px[x, y], BG)) > 6:
                    stray.append((x, y)); per[min(range(len(scenes)), key=lambda k: abs(x - (150 + (k % 4) * 300)) + abs(y - (190 + (k // 4) * 380)))] += 1
        R['variants'][n]['strayPixels'] = len(stray); R['variants'][n]['strayPerScene'] = per
        if stray:
            v = im.copy(); vp = v.load()
            for x, y in stray: vp[x, y] = (255, 0, 255)
            v.save(os.path.join(A_.shots or os.path.dirname(A_.out), f'streaks_{n}_stray.png'))
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = Image.open(R['variants'][names[i]]['file']).convert('RGB'), Image.open(R['variants'][names[j]]['file']).convert('RGB')
            dpx = ImageChops.difference(a, b).convert('L').load(); tot = inh = off = 0
            for y in range(H):
                for x in range(W):
                    if dpx[x, y] > 2:
                        tot += 1; inh += in_hand(x, y); off += min((seg(x, y, *l) for l in segs), default=99) > 3
            R['pairs'].append({'a': names[i], 'b': names[j], 'pixelsDiffer': tot, 'insideAHand': inh, 'outsideEveryHand': tot - inh, 'offTheStrayLines': off})
    if A_.lines: R['lines'] = two_lines(R, *A_.lines.split(','), scenes)
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for n in names:
        v = R['variants'][n]; print(f"{n:>6}: stray pixels {v['strayPixels']:6d} (per explosion {v['strayPerScene']}); gore.js served {v['goreBytesServed']} of {v['goreBytes']} bytes; page errors {len(v['pageErrors'])}")
    for q in R['pairs']: print(f"{q['a']:>6} vs {q['b']:<6} differ {q['pixelsDiffer']:6d} px: inside a hand {q['insideAHand']:6d}, outside every hand {q['outsideEveryHand']:6d}; off the stray lines {q['offTheStrayLines']:6d}")


asyncio.run(main())
