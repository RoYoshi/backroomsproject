#!/usr/bin/env python3
"""Stage 3D HQ4 - the Wanderer's two shadow defects, measured in a real game page (development only; SwiftShader)

  python3 -I dev/stage-3d-hq4/wanderer_lab.py --game DIR --variant NAME=BUNDLE,BRROLE [--variant ...] --scenes LIST --out DIR

Every variant runs the same scenes on its own server (synthetic admin passcode) and its own page: the page's requests for
assets/index-DKbV5Nv9.js and assets/br-role.js are answered with BUNDLE and BRROLE (nothing on disk changes), so HQ3's files and
HQ4's can be compared in the very same scene.  The scene is held still for every capture:
  - the world frozen, no monsters, god mode, the lights forced on (admin commands over the page's own connection);
  - BR-RoLE at MEDIUM, drawing ONE fluorescent fixture (its DEV `solo`); the Wanderer's own light OFF;
  - the Wanderer placed at a fixed spot 100-130 px from that fixture on open floor, aimed with the mouse (the game's own aim);
  - the page clock frozen at one fixed instant (performance.now and the frame timestamps), moving 1 microsecond a frame so
    Pixi keeps drawing: the breathing, hand sway and every eased weight are the same in every capture and every variant;
  - every DOM overlay hidden (title, HUD, grain): only the game canvas and BR-RoLE's light canvas are captured.
Scenes (--scenes, comma separated):
  ellipse   at headings 0/90/180/270: a capture, then the avatar's anonymous first Graphics child (the dark ellipse(1,5,19,19))
            hidden in the same frozen frame (a TEMPORARY in-page toggle: the A/B that isolates that one layer), a second capture;
            the ellipse's outline in screen pixels (from the avatar's own transform) for the diff
  rotation  headings 0..345 in 15 degree steps, and at 0/90/180/270 the hands at a walk's swing extremes (+-3 px, set after the
            avatar's own pose each frame): BR-RoLE's job for the Wanderer (__brRole.actors(): start, ext, across, ang, a, shade,
            silhouette) and the light it left along the cast's axis (__brRole.dev.light, actors on and off); captures at 0/90/180/270
  moving    the light still, the Wanderer at three spots around it: the cast follows (direction, length)
  carried   the fixtures off (solo none), a second page (Bob) with his flashlight on at four places around the Wanderer, aimed at
            her (clock running: a peer moves by the network): the cast points away from Bob each time
  hound     a stand-in Hound for BR-RoLE (an empty container flagged __hound, test-only) at a fixed spot in her sight, three ways:
            BR-RoLE's Hound jobs (its torso path)
  peers     Bob visible beside her, then behind a wall: the Wanderer's page draws a cast for Bob only while she can see him
  perf      clock running, still, every fixture: the page's frame intervals over 8 s and BR-RoLE's own frame cost (stats().frameMs)
  corpse    a Hound death previewed on her (the real kill path), watched by Bob: on his page her corpse view held still and,
            where its avatar has the ellipse, hidden in the same frame (what the ellipse adds to a corpse)
Writes DIR/<variant>/result.json and the captures (PNG; --dpr, default 1: a software renderer draws a scale-2 page about 4x slower)."""
import os, sys, asyncio, argparse, json, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--variant', action='append', required=True)
ap.add_argument('--scenes', default='ellipse,rotation'); ap.add_argument('--out', required=True)
ap.add_argument('--lamp', type=int, default=2); ap.add_argument('--dpr', type=float, default=1)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
VARS = []
for v in A_.variant:
    n, files = v.split('=', 1); b, r = files.split(','); VARS.append((n, os.path.abspath(b), os.path.abspath(r)))
SCENES = A_.scenes.split(',')
W, H, T0 = 1280, 720, 300000.0

INIT = r"""(() => { const real = performance.now.bind(performance); let fz = null;
  performance.now = () => fz === null ? real() : fz;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => cb(fz === null ? ts : fz));
  const adv = () => { if (fz !== null) fz += .001; raf(adv); }; raf(adv);          // frozen: 1 microsecond a frame, so Pixi's ticker (it renders only when time moves) keeps drawing
  window.__clk = { freeze(v) { fz = v === undefined ? real() : v; }, thaw() { fz = null; }, get() { return fz; } };
  const S = window.WebSocket; window.WebSocket = function (u, p) { const ws = new S(u, p); window.__ws = ws; return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
})();"""
HOOKS = r"""() => {                                     // the test's hook: the hands' swing offsets (after the avatar's own pose)
  if (window.__labHooks) return true; window.__labHooks = 1;
  const P = window.__pose, orig = P.apply;
  P.apply = function (av, S_, e, n) { const r = orig.apply(this, arguments); const o = window.__handDY; if (o && av === window.__lab.av()) { av.hands[0].y += o[0]; av.hands[1].y += o[1]; } return r; };
  window.__lab = {
    av: () => { const w = __api.floor().parent; return w.children.find(c => c && typeof c.deathPose === 'function'); },
    ellipse: () => { const a = window.__lab.av(); return a.children.find(c => c !== a.pack && c !== a.body && c !== a.hat && c !== a.wounds && c !== a.gear && !a.hands.includes(c)) || null; },
    g: (x, y) => { const p = window.__lab.av().toGlobal({ x, y }); return [p.x, p.y]; },
    self: () => (__brRole.actors() || []).filter(j => j.self).map(j => ({ kind: j.kind, light: j.light, lightKind: j.lightKind, dominant: j.dominant, x: j.x, y: j.y, ang: j.ang, ext: j.ext,
      start: j.start, across: j.across, a: j.a, shade: j.shade, sil: j.sil.map(q => [q.x, q.y, q.A, q.B, q.h]) })),
    others: () => (__brRole.actors() || []).filter(j => !j.self).map(j => ({ kind: j.kind, light: j.light, dominant: j.dominant, x: j.x, y: j.y, ang: j.ang, ext: j.ext, start: j.start, across: j.across, a: j.a, shade: j.shade, sil: j.sil.length })),
  };
  return true; }"""
FRAMES = "n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })"


async def adm(P, o): await P.evaluate("o => { const ws = window.__ws; if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ t: 'a' }, o))); }", o)


async def frames(P, n): await P.evaluate(FRAMES, n)


async def hide_overlays(P):
    await P.evaluate("""() => { const keep = [document.querySelector('#game canvas'), document.getElementById('light')].filter(Boolean);
      for (const el of document.querySelectorAll('body *')) if (!keep.includes(el) && !keep.some(k => el.contains(k))) el.style.visibility = 'hidden'; }""")


async def stage(P):
    await adm(P, {'c': 'freeze', 'on': 1})
    for _ in range(14):
        c = await P.evaluate("() => ({ h: (window.__hounds || []).filter(Boolean).length, s: __api.q.filter(o => o && !o.off).length })")
        if not c['h'] and not c['s']: break
        await adm(P, {'c': 'hounds', 'mode': 'remove', 'n': 10}); await adm(P, {'c': 'smilers', 'mode': 'remove', 'n': 10}); await P.wait_for_timeout(450)
    await adm(P, {'c': 'blackout', 'mode': 'off'})
    await adm(P, {'c': 'god', 'id': await P.evaluate("() => __api.H.id")}); await P.wait_for_timeout(300)


async def find_spot(P, lamp):
    """open floor 100-130 px from the fixture, with room for the cast behind it"""
    return await P.evaluate("""i => { const A = __api, L = A.lamps[i]; for (const d of [100, 110, 120, 130]) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, x = Math.round(L.x + Math.cos(a) * d), y = Math.round(L.y + Math.sin(a) * d);
        if (A.sl(x, y, 44) && A.Uc(L.x, L.y, a, d + 90) >= d + 89 && A.sl(L.x + Math.cos(a) * (d + 70), L.y + Math.sin(a) * (d + 70), 40)) return { x, y, lamp: [L.x, L.y], d, a: +a.toFixed(4) }; } return null; }""", lamp)


async def aim(P, theta):
    """the game's own mouse aim: the pointer up to 220 px from the Wanderer on screen (inside the page), at angle theta (world = screen axes)"""
    c = await P.evaluate("() => window.__lab.g(0, 0)"); vs = P.viewport_size; r = min(220, .42 * min(vs['width'], vs['height']))
    await P.mouse.move(c[0] + r * math.cos(theta), c[1] + r * math.sin(theta)); await frames(P, 4)


async def place(P, x, y, theta, light=False, kind='flashlight'):
    await P.evaluate("([x, y, kind]) => { __api.gear.eq.kind = kind; __api.tp(x, y); }", [x, y, kind])
    if bool(await P.evaluate("() => __api.lightOn()")) != light: await P.keyboard.press('KeyF'); await P.wait_for_timeout(200)
    await P.wait_for_timeout(900); await aim(P, theta); await P.wait_for_timeout(300)
    return await P.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")


async def hold(P, n=12):
    await P.evaluate("t => window.__clk.freeze(t)", T0); await frames(P, n)


async def shot(P, path, half=150):
    c = await P.evaluate("() => window.__lab.g(0, 0)")
    clip = {'x': max(0, c[0] - half), 'y': max(0, c[1] - half), 'width': 2 * half, 'height': 2 * half}
    await P.screenshot(path=path, clip=clip); return {'file': os.path.basename(path), 'clip': clip, 'centre': c}


async def axis_profile(P, job, n=66, step=2, shot_off=None):
    """the light BR-RoLE left along the cast's axis (world px from the Wanderer's centre), actors on and off (and, with shot_off,
    a capture with the actor effects off: the difference is the cast and the self-shading alone)"""
    pts = [[job['x'] + math.cos(job['ang']) * s, job['y'] + math.sin(job['ang']) * s] for s in [i * step for i in range(n)]]
    on = await P.evaluate("p => __brRole.dev.light(p)", pts)
    await P.evaluate("() => __brRole.dev.actors(false)"); await frames(P, 4)
    off = await P.evaluate("p => __brRole.dev.light(p)", pts)
    r = {'step': step, 'on': on, 'off': off}
    if shot_off: r['shotOff'] = await shot(P, shot_off)
    await P.evaluate("() => __brRole.dev.actors(true)"); await frames(P, 50)
    return r


async def run_variant(p, name, bundle, brrole, out):
    os.makedirs(out, exist_ok=True)
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, os.path.join(out, 'server.log')); errs = []
    R = {'variant': name, 'bundle': bundle, 'brrole': brrole, 'scenes': {}}
    bb, rb = open(bundle, 'rb').read(), open(brrole, 'rb').read()
    try:
        b = await p.chromium.launch(args=Q.ARGS)
        async def page(nm, w=W, h=H, dpr=A_.dpr):
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
            await ctx.add_init_script(INIT)
            await ctx.route('**/assets/index-DKbV5Nv9.js*', lambda route: route.fulfill(status=200, body=bb, headers={'content-type': 'text/javascript', 'cache-control': 'no-store'}))
            await ctx.route('**/assets/br-role.js*', lambda route: route.fulfill(status=200, body=rb, headers={'content-type': 'text/javascript', 'cache-control': 'no-store'}))
            P = await Q.join(ctx, port, 'hq4lab-' + name, nm, errs, auth=True)
            await P.evaluate(HOOKS); return P
        A = await page('Alice')
        R['served'] = await A.evaluate("() => Promise.all(['./assets/index-DKbV5Nv9.js', './assets/br-role.js'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.text()).then(t => t.length)))")
        R['servedExpected'] = [len(bb.decode('utf-8')), len(rb.decode('utf-8'))]
        await A.wait_for_timeout(800); await stage(A); await A.wait_for_timeout(400)
        await A.evaluate("() => { __brRole.setQuality('medium'); }")
        await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
        await hide_overlays(A)
        spot = await find_spot(A, A_.lamp); R['spot'] = spot
        away = spot['a']                                                         # the direction from the fixture to her: the cast points this way
        at = await place(A, spot['x'], spot['y'], away); R['placedAt'] = at
        if 'ellipse' in SCENES:
            S = []
            for deg in (0, 90, 180, 270):
                await A.evaluate("() => window.__clk.thaw()"); await aim(A, away + math.radians(deg)); await frames(A, 10)
                await hold(A)
                e = await A.evaluate("() => { const e = window.__lab.ellipse(); return e ? { visible: e.visible, kids: window.__lab.av().children.length } : { visible: null, kids: window.__lab.av().children.length } }")
                outline = await A.evaluate("() => { const o = []; for (let k = 0; k < 96; k++) { const t = k / 96 * Math.PI * 2; o.push(window.__lab.g(1 + 19 * Math.cos(t), 5 + 19 * Math.sin(t))); } return o }")
                body = await A.evaluate("() => { const o = []; for (let k = 0; k < 96; k++) { const t = k / 96 * Math.PI * 2; o.push(window.__lab.g(18 * Math.cos(t), 1 + 18 * Math.sin(t))); } return o }")
                a = await shot(A, os.path.join(out, f'ellipse_{deg:03d}.png'))
                rec = {'heading': deg, 'ellipse': e, 'outline': outline, 'body': body, 'shot': a}
                if e['visible'] is not None:
                    await A.evaluate("() => { window.__lab.ellipse().visible = false }"); await frames(A, 4)
                    rec['shotHidden'] = await shot(A, os.path.join(out, f'ellipse_{deg:03d}_hidden.png'))
                    await A.evaluate("() => { window.__lab.ellipse().visible = true }"); await frames(A, 4)
                S.append(rec)
            R['scenes']['ellipse'] = S
        if 'rotation' in SCENES:
            S = []
            for step in range(24):
                deg = step * 15
                await A.evaluate("() => window.__clk.thaw()"); await A.evaluate("() => { window.__handDY = null; }"); await aim(A, away + math.radians(deg)); await frames(A, 6)
                await hold(A)
                jobs = await A.evaluate("() => window.__lab.self()")
                rec = {'heading': deg, 'angle': await A.evaluate("() => __api.H.angle"), 'jobs': jobs, 'hands': await A.evaluate("() => window.__lab.av().hands.map(h => window.__lab.g(h.x, h.y))")}
                if deg % 45 == 0:
                    rec['shot'] = await shot(A, os.path.join(out, f'rotation_{deg:03d}.png'))
                    dom = [j for j in jobs if j['dominant']]
                    if dom: rec['profile'] = await axis_profile(A, dom[0], shot_off=os.path.join(out, f'rotation_{deg:03d}_actors_off.png'))
                if deg % 90 == 0:
                    rec['swing'] = []
                    for dy in ([3, -3], [-3, 3]):
                        await A.evaluate("d => { window.__handDY = d }", dy); await frames(A, 4)
                        rec['swing'].append({'dy': dy, 'jobs': await A.evaluate("() => window.__lab.self()")})
                    await A.evaluate("() => { window.__handDY = null }"); await frames(A, 4)
                S.append(rec)
            R['scenes']['rotation'] = S
        if 'moving' in SCENES:
            S = []; L = spot['lamp']
            for k, (d, da) in enumerate(((70, 0.0), (110, 0.6), (150, -0.5))):
                a = spot['a'] + da; x, y = round(L[0] + math.cos(a) * d), round(L[1] + math.sin(a) * d)
                await A.evaluate("() => window.__clk.thaw()"); pos = await place(A, x, y, away)
                await hold(A)
                S.append({'want': [x, y], 'at': pos, 'jobs': await A.evaluate("() => window.__lab.self()"), 'shot': await shot(A, os.path.join(out, f'moving_{k}.png'))})
            await A.evaluate("() => window.__clk.thaw()"); await place(A, spot['x'], spot['y'], away)
            R['scenes']['moving'] = S
        if 'hound' in SCENES:
            # a stand-in Hound for BR-RoLE: an empty container flagged __hound (what BR-RoLE reads: position, rotation, visible, alpha),
            # put in the creatures layer at a fixed spot in her sight, facing three ways - test-only; no entity, nothing drawn but its shadow
            S = []
            await A.evaluate("() => window.__clk.thaw()")
            for k, (dx, dy, rot) in enumerate(((0, 95, 0.0), (0, 95, 1.2), (-60, 80, 2.6))):
                await A.evaluate("""([x, y, r]) => { const L = __api.layer(), C = L.constructor; const h = new C(); h.__hound = true; h.__labHound = true; h.position.set(x, y); h.rotation = r; L.addChild(h); }""",
                                 [spot['x'] + dx, spot['y'] + dy, rot])
                await frames(A, 40); await hold(A)
                jobs = await A.evaluate("() => window.__lab.others().filter(j => j.kind === 'hound')")
                S.append({'at': [spot['x'] + dx, spot['y'] + dy], 'rotation': rot, 'jobs': jobs, 'shot': await shot(A, os.path.join(out, f'hound_{k}.png'), 170)})
                await A.evaluate("() => window.__clk.thaw()")
                await A.evaluate("() => { const L = __api.layer(); for (const c of L.children.slice()) if (c.__labHound) { L.removeChild(c); c.destroy(); } }"); await frames(A, 6)
            R['scenes']['hound'] = S
        if 'carried' in SCENES or 'peers' in SCENES:
            Bp = await page('Bob', 640, 400, 1); await hide_overlays(Bp)
            await A.evaluate("() => window.__clk.thaw()")
            if 'carried' in SCENES:
                await A.evaluate("() => __brRole.dev.solo([-1])")                 # no fixture: Bob's flashlight is the only light on her
                S = []
                for k, rel in enumerate((0, 90, 180, 270)):
                    a = math.radians(rel) + spot['a']; bx, by = round(spot['x'] + math.cos(a) * 95), round(spot['y'] + math.sin(a) * 95)
                    await place(Bp, bx, by, math.atan2(spot['y'] - by, spot['x'] - bx), light=True)
                    await A.wait_for_timeout(2500); await frames(A, 30)
                    bpos = await Bp.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")
                    jobs = await A.evaluate("() => window.__lab.self()")
                    S.append({'bob': bpos, 'jobs': jobs, 'shot': await shot(A, os.path.join(out, f'carried_{k}.png'), 170)})
                R['scenes']['carried'] = S
                await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
            if 'peers' in SCENES:
                S = {}
                await A.evaluate("() => __brRole.dev.solo(null)")
                bx, by = spot['x'] + 60, spot['y']
                if not await Bp.evaluate("([x, y]) => __api.sl(x, y, 26)", [bx, by]): bx, by = spot['x'] - 60, spot['y']
                await place(Bp, bx, by, 0.0, light=True); await A.wait_for_timeout(2500); await frames(A, 30)
                S['visible'] = {'bob': await Bp.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]"), 'jobs': await A.evaluate("() => window.__lab.others()"), 'shot': await shot(A, os.path.join(out, 'peers_visible.png'), 200)}
                hid = await A.evaluate("""() => { const A = __api, H = A.H; for (let d = 140; d < 420; d += 20) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = Math.round(H.x + Math.cos(a) * d), y = Math.round(H.y + Math.sin(a) * d);
                    if (A.sl(x, y, 30) && A.Uc(H.x, H.y, a, d) < d - 60) return [x, y]; } return null }""")
                if hid:
                    await place(Bp, hid[0], hid[1], 0.0, light=True); await A.wait_for_timeout(2500); await frames(A, 30)
                    S['hidden'] = {'bob': await Bp.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]"), 'jobs': await A.evaluate("() => window.__lab.others()"), 'shot': await shot(A, os.path.join(out, 'peers_hidden.png'), 260)}
                R['scenes']['peers'] = S
                await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
            await Bp.context.close()
        if 'perf' in SCENES:
            await A.evaluate("() => window.__clk.thaw()"); await A.evaluate("() => __brRole.dev.solo(null)"); await A.evaluate("() => __brRole.resetStats()")
            page_frames = await A.evaluate("""ms => new Promise(r => { const t = []; let last = null; const t0 = performance.now(); const f = ts => { if (last !== null) t.push(ts - last); last = ts;
                if (performance.now() - t0 < ms) requestAnimationFrame(f); else { const s = t.slice().sort((a, b) => a - b); r({ frames: t.length, meanMs: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(2), p95Ms: +s[Math.floor(.95 * (s.length - 1))].toFixed(2) }); } }; requestAnimationFrame(f); })""", 8000)
            R['scenes']['perf'] = {'brRoleFrameMs': await A.evaluate("() => __brRole.stats().frameMs"), 'pageFrames': page_frames}
            await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
        if 'corpse' in SCENES:
            # a spectator (Bob, same screen size) watches a Hound death previewed on Alice; on his page the corpse view is held still
            # (clock frozen, gore's texture cache off so the view is drawn live) and, where it has one, its avatar's ellipse is hidden
            # in the same frame: what the ellipse adds to a corpse, and what HQ4's corpse looks like
            await A.evaluate("() => window.__clk.thaw()")
            Bp = await page('Bob'); await hide_overlays(Bp)
            await Bp.evaluate("() => { __brRole.setQuality('medium'); }"); await Bp.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
            bs = None
            for dx, dy in ((0, 90), (0, -90), (90, 0), (-90, 0), (60, 60), (-60, 60)):
                if await Bp.evaluate("([x, y]) => __api.sl(x, y, 30)", [spot['x'] + dx, spot['y'] + dy]): bs = (spot['x'] + dx, spot['y'] + dy); break
            await place(Bp, bs[0], bs[1], math.atan2(spot['y'] - bs[1], spot['x'] - bs[0]))
            await adm(A, {'c': 'preview', 'k': 'hound', 'var': 'D'})
            view = None
            for _ in range(120):
                view = await Bp.evaluate("""() => { const f = __api.floor(), v = f.children.find(c => c.__rec && c.children.some(k => typeof k.deathPose === 'function'));
                    return v ? { id: v.__rec.id, x: v.__rec.x, y: v.__rec.y, cause: v.__rec.cause || null } : null }""")
                if view: break
                await Bp.wait_for_timeout(250)
            rec = {'bob': bs, 'view': view}
            if view:
                for _ in range(80):                                              # until the death's replay has ended on his page (its attacker gone)
                    if await Bp.evaluate("() => !(window.__fxs || []).length"): break
                    await Bp.wait_for_timeout(250)
                rec['replayEnded'] = await Bp.evaluate("() => !(window.__fxs || []).length")
                await Bp.wait_for_timeout(2000)
                await Bp.evaluate("""() => { window.__goreCache = false; const f = __api.floor(); for (const v of f.children) if (v.__rec && v.isCachedAsTexture) v.cacheAsTexture(false); }""")
                await Bp.evaluate("t => window.__clk.freeze(t)", T0); await frames(Bp, 12)
                cav = """() => { const f = __api.floor(), v = f.children.find(c => c.__rec && c.children.some(k => typeof k.deathPose === 'function')), a = v.children.find(k => typeof k.deathPose === 'function');
                    return { v, a, e: a.children.find(c => c !== a.pack && c !== a.body && c !== a.hat && c !== a.wounds && c !== a.gear && !a.hands.includes(c)) || null } }"""
                rec['avatarChildren'] = await Bp.evaluate(f"() => ({cav})().a.children.length")
                c = await Bp.evaluate("([x, y]) => { const p = __api.floor().toGlobal({ x, y }); return [p.x, p.y] }", [view['x'], view['y']])
                clip = {'x': c[0] - 90, 'y': c[1] - 90, 'width': 180, 'height': 180}
                await Bp.screenshot(path=os.path.join(out, 'corpse.png'), clip=clip); rec['shot'] = {'file': 'corpse.png', 'clip': clip, 'centre': c}
                if await Bp.evaluate(f"() => !!({cav})().e"):
                    rec['outline'] = await Bp.evaluate(f"() => {{ const a = ({cav})().a, o = []; for (let k = 0; k < 96; k++) {{ const t = k / 96 * Math.PI * 2, p = a.toGlobal({{ x: 1 + 19 * Math.cos(t), y: 5 + 19 * Math.sin(t) }}); o.push([p.x, p.y]); }} return o }}")
                    await Bp.evaluate(f"() => {{ ({cav})().e.visible = false }}"); await frames(Bp, 4)
                    await Bp.screenshot(path=os.path.join(out, 'corpse_hidden.png'), clip=clip); rec['shotHidden'] = {'file': 'corpse_hidden.png', 'clip': clip}
                    await Bp.evaluate(f"() => {{ ({cav})().e.visible = true }}"); await frames(Bp, 4)
            R['scenes']['corpse'] = rec
            await Bp.context.close()
        R['pageErrors'] = errs[:20]
        await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    with open(os.path.join(out, 'result.json'), 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    return R


async def main():
    os.makedirs(A_.out, exist_ok=True)
    async with async_playwright() as p:
        for name, bundle, brrole in VARS:
            t = time.time(); R = await run_variant(p, name, bundle, brrole, os.path.join(A_.out, name))
            print(f"{name}: served {R.get('served')} (expected {R.get('servedExpected')}); scenes {list(R['scenes'])}; page errors {len(R.get('pageErrors', []))}; {time.time() - t:.0f} s")


asyncio.run(main())
