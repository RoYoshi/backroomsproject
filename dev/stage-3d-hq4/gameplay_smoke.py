#!/usr/bin/env python3
"""Stage 3D HQ4 - a short real-gameplay smoke on two pages (development only; SwiftShader)

  python3 -I dev/stage-3d-hq4/gameplay_smoke.py --game DIR --variant NAME=BUNDLE,BRROLE [--variant ...] --out DIR

Per variant (the page's assets/index-DKbV5Nv9.js and assets/br-role.js answered with BUNDLE and BRROLE; one server each,
synthetic admin passcode), Alice and Bob are two ordinary players in one room (no admin rights; monsters removed by a quiet
admin page that never joins):
  walk      Alice holds D, S, A, W in turn (the real keyboard): she moves, the server agrees (no snap back)
  spin      the mouse goes once round her (the real pointer): her heading takes every quarter
  light     F, F: her light goes on, then off (the game's own state), BR-RoLE draws her carried light only while on
  frames    6 s still, then 6 s walking: the page's frame intervals (requestAnimationFrame) and BR-RoLE's own frame cost
  newrun    Esc, NEW RUN: approved, her run menu; Bob's page gets her Boom corpse with its pieces (gs/gb/gh); SPAWN: she is
            back in a run and can walk
Every page error is recorded.  Writes DIR/<variant>.json and a few captures."""
import os, sys, asyncio, argparse, json, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--variant', action='append', required=True); ap.add_argument('--out', required=True)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
VARS = [(v.split('=', 1)[0], *[os.path.abspath(x) for x in v.split('=', 1)[1].split(',')]) for v in A_.variant]
FRAMES = r"""ms => new Promise(r => { const t = []; let last = null; const t0 = performance.now(); const f = ts => { if (last !== null) t.push(ts - last); last = ts;
  if (performance.now() - t0 < ms) requestAnimationFrame(f); else { const s = t.slice().sort((a, b) => a - b); r({ frames: t.length, meanMs: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(2),
  p95Ms: +s[Math.floor(.95 * (s.length - 1))].toFixed(2), maxMs: +s[s.length - 1].toFixed(2) }); } }; requestAnimationFrame(f); })"""


async def run_variant(p, name, bundle, brrole, out):
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, os.path.join(out, f'{name}.server.log')); errs = []
    R = {'variant': name, 'checks': {}}
    bb, rb = open(bundle, 'rb').read(), open(brrole, 'rb').read()
    try:
        b = await p.chromium.launch(args=Q.ARGS)
        async def page(nm, w, h, auth=False):
            ctx = await b.new_context(viewport={'width': w, 'height': h})
            await ctx.route('**/assets/index-DKbV5Nv9.js*', lambda route: route.fulfill(status=200, body=bb, headers={'content-type': 'text/javascript', 'cache-control': 'no-store'}))
            await ctx.route('**/assets/br-role.js*', lambda route: route.fulfill(status=200, body=rb, headers={'content-type': 'text/javascript', 'cache-control': 'no-store'}))
            return await Q.join(ctx, port, 'hq4smoke-' + name, nm, errs, auth=auth)
        A = await page('Alice', 1280, 720); Bp = await page('Bob', 640, 400)
        # a quiet admin connection (the HQ2 helper) removes the monsters so nothing interrupts the smoke
        Q.place(port, 'hq4smoke-' + name, clear=True)
        await A.wait_for_timeout(800)
        pos = lambda P: P.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")
        # walk
        p0 = await pos(A); path = [p0]
        for k in ('KeyD', 'KeyS', 'KeyA', 'KeyW'):
            await A.keyboard.down(k); await A.wait_for_timeout(900); await A.keyboard.up(k); await A.wait_for_timeout(250); path.append(await pos(A))
        await A.wait_for_timeout(1200); settled = await pos(A)
        moved = sum(math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]) for i in range(len(path) - 1))
        R['checks']['walk'] = {'ok': moved > 120 and math.hypot(settled[0] - path[-1][0], settled[1] - path[-1][1]) < 40, 'path': path, 'settled': settled, 'movedPx': round(moved)}
        # spin
        quarters = set(); c = await A.evaluate("() => { const w = __api.floor().parent, av = w.children.find(c => typeof c.deathPose === 'function'); const g = av.toGlobal({ x: 0, y: 0 }); return [g.x, g.y] }")
        for k in range(12):
            t = k / 12 * 2 * math.pi; await A.mouse.move(c[0] + 200 * math.cos(t), c[1] + 200 * math.sin(t)); await A.wait_for_timeout(120)
            a = await A.evaluate("() => __api.H.angle"); quarters.add(int(((a + 2 * math.pi) % (2 * math.pi)) // (math.pi / 2)))
        R['checks']['spin'] = {'ok': len(quarters) == 4, 'quarters': sorted(quarters)}
        # light
        l0 = await A.evaluate("() => __api.lightOn()")
        await A.keyboard.press('KeyF'); await A.wait_for_timeout(600); l1 = await A.evaluate("() => __api.lightOn()"); c1 = await A.evaluate("() => __brRole.stats().carried.last")
        await A.keyboard.press('KeyF'); await A.wait_for_timeout(600); l2 = await A.evaluate("() => __api.lightOn()"); c2 = await A.evaluate("() => __brRole.stats().carried.last")
        on_c, off_c = (c1, c2) if l1 else (c2, c1)
        R['checks']['light'] = {'ok': l1 != l0 and l2 == l0 and on_c > off_c, 'states': [l0, l1, l2], 'carriedDrawn': {'lightOn': on_c, 'lightOff': off_c}}
        await A.screenshot(path=os.path.join(out, f'{name}_alice.png'))
        # frames
        await A.evaluate("() => __brRole.resetStats()")
        still = await A.evaluate(FRAMES, 6000)
        await A.keyboard.down('KeyD'); walk = A.evaluate(FRAMES, 6000)
        await A.wait_for_timeout(1500); await A.keyboard.up('KeyD'); await A.keyboard.down('KeyA'); await A.wait_for_timeout(1500); await A.keyboard.up('KeyA')
        await A.keyboard.down('KeyD'); await A.wait_for_timeout(1500); await A.keyboard.up('KeyD'); walking = await walk
        R['checks']['frames'] = {'ok': True, 'still': still, 'walking': walking, 'brRoleFrameMs': await A.evaluate("() => __brRole.stats().frameMs"), 'brRoleErrors': await A.evaluate("() => __brRole.stats().errors")}
        # NEW RUN, gibs on Bob's page, SPAWN
        await A.keyboard.press('Escape'); await A.wait_for_timeout(500)
        await A.evaluate("() => document.getElementById('reset').click()")
        ans = None
        for _ in range(60):
            ans = await A.evaluate("() => { const d = window.__nrDebug && window.__nrDebug(); return d && d.last ? { ok: d.last.ok, why: d.last.why, de: d.last.de } : null }")
            if ans: break
            await A.wait_for_timeout(100)
        await A.wait_for_timeout(3500)
        menu = await A.evaluate("() => !document.getElementById('runMenu').hidden")
        gib = None
        for _ in range(40):
            gib = await Bp.evaluate("() => (__api.bodyList() || []).filter(b => b.gb).map(b => ({ pieces: b.gb.length, hands: !!b.gh, seed: b.gs }))")
            if gib: break
            await Bp.wait_for_timeout(250)
        await Bp.screenshot(path=os.path.join(out, f'{name}_bob_sees_gibs.png'))
        await A.evaluate("() => document.getElementById('runSpawn').click()"); await A.wait_for_timeout(2500)
        back = await A.evaluate("() => ({ started: __api.started(), caught: !!__api.G.caught, menu: !document.getElementById('runMenu').hidden })")
        q0 = await pos(A); await A.keyboard.down('KeyS'); await A.wait_for_timeout(800); await A.keyboard.up('KeyS'); await A.wait_for_timeout(400); q1 = await pos(A)
        R['checks']['newrun'] = {'ok': bool(ans and ans['ok'] == 1 and menu and gib and gib[0]['pieces'] >= 5 and gib[0]['hands'] and back['started'] and not back['caught'] and not back['menu'] and math.hypot(q1[0] - q0[0], q1[1] - q0[1]) > 30),
                                 'answer': ans, 'runMenu': menu, 'bobSeesGibs': gib, 'afterSpawn': back, 'walkAfterSpawn': [q0, q1]}
        R['pageErrors'] = errs[:20]; R['ok'] = all(c['ok'] for c in R['checks'].values()) and not errs
        await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    with open(os.path.join(out, f'{name}.json'), 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    return R


async def main():
    os.makedirs(A_.out, exist_ok=True); ok = True
    async with async_playwright() as p:
        for name, bundle, brrole in VARS:
            R = await run_variant(p, name, bundle, brrole, A_.out); ok = ok and R['ok']
            print(name, 'OK' if R['ok'] else 'NOT OK', {k: v['ok'] for k, v in R['checks'].items()}, 'page errors', len(R['pageErrors']),
                  'frames still', R['checks']['frames']['still'], 'walking', R['checks']['frames']['walking'], 'BR-RoLE', R['checks']['frames']['brRoleFrameMs'])
    sys.exit(0 if ok else 1)


asyncio.run(main())
