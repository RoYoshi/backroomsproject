#!/usr/bin/env python3
"""Stage 3D HQ5 - the Wanderer's ground contact, measured in a real game page (development only; SwiftShader)

  python3 -I dev/stage-3d-hq5/contact_lab.py --game DIR --variant NAME=BRROLE [--variant ...] --scenes LIST --out DIR

Every variant runs the same scenes on its own server (synthetic admin passcode) and its own page; the page's request for
assets/br-role.js is answered with BRROLE (nothing on disk changes; every other file is the game's own), so HQ4's BR-RoLE and
HQ5's are compared in the very same frozen scene (dev/stage-3d-hq4/wanderer_lab.py's method):
  - the world frozen, no monsters, god mode, the lights forced on (admin commands over the page's own connection);
  - BR-RoLE at MEDIUM unless a scene says otherwise; one fluorescent fixture (DEV `solo`) unless a scene says otherwise;
  - her own light OFF unless a scene says otherwise; the page clock frozen (1 microsecond a frame); DOM overlays hidden.
`ring` below is the light BR-RoLE's buffer holds (__brRole.dev.light) at radii 0..44 px round her body's centre, 24 angles.
`contacts` is HQ5's DEV list of the contact it drew last frame (null in HQ4).
Scenes (--scenes, comma separated):
  geometry  one fixture, her spot 100-130 px from it: headings 0/90/180/270 (capture, ring, cast jobs, contacts), each with the
            hands at a walk's swing extremes (+-3 px); at 0 also captures at the swing extremes; HQ5 also: the contact off in
            the same frame (DEV A/B) and an exaggerated DEV diagnostic (gain 3)
  under     the same fixture, her spot right under it (where the HQ4 cast fades out): 0 and 90 degrees
  lights    two overlapping fixtures (each alone, then both); then every fixture with the admin BLACKOUT on
  carried   no fixture; Bob's flashlight on her from two sides; then her own light on with Bob's off (her own light
            casts nothing of hers: HQ4's exclusion, kept)
  peers     Bob beside her (one fixture), then behind a wall: what her page draws for him
  tiers     the geometry spot at LOW, MEDIUM, HIGH
  lifecycle Bob alive beside her (one fixture); then a Hound death previewed on Bob (the real kill path), its replay and his corpse,
            watched from her page; then Bob's page closes (disconnect).  Her page sampled every 250 ms: the contact drawn for anyone
            else than her (must be only the living Bob), the cast jobs for others (HQ4's), her own contact
  perf      clock running, still, every fixture: the page's frame intervals over 8 s and BR-RoLE's own frame cost
Writes DIR/<variant>/result.json and the captures (PNG, DPR 1)."""
import os, sys, asyncio, argparse, json, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--variant', action='append', required=True)
ap.add_argument('--scenes', default='geometry,under'); ap.add_argument('--out', required=True)
ap.add_argument('--lamp', type=int, default=2); ap.add_argument('--perf-secs', type=int, default=8)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
VARS = [(v.split('=', 1)[0], os.path.abspath(v.split('=', 1)[1])) for v in A_.variant]
SCENES = A_.scenes.split(',')
W, H, T0 = 1280, 720, 300000.0
RADII = [0, 8, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 28, 30, 33, 36, 40, 44]; NANG = 24

INIT = r"""(() => { const real = performance.now.bind(performance); let fz = null;
  performance.now = () => fz === null ? real() : fz;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => cb(fz === null ? ts : fz));
  const adv = () => { if (fz !== null) fz += .001; raf(adv); }; raf(adv);
  window.__clk = { freeze(v) { fz = v === undefined ? real() : v; }, thaw() { fz = null; }, get() { return fz; } };
  const S = window.WebSocket; window.WebSocket = function (u, p) { const ws = new S(u, p); window.__ws = ws; return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
})();"""
HOOKS = r"""() => {
  if (window.__labHooks) return true; window.__labHooks = 1;
  const P = window.__pose, orig = P.apply;
  P.apply = function (av, S_, e, n) { const r = orig.apply(this, arguments); const o = window.__handDY; if (o && av === window.__lab.av()) { av.hands[0].y += o[0]; av.hands[1].y += o[1]; } return r; };
  window.__lab = {
    av: () => { const w = __api.floor().parent; return w.children.find(c => c && typeof c.deathPose === 'function'); },
    g: (x, y) => { const p = window.__lab.av().toGlobal({ x, y }); return [p.x, p.y]; },
    centre: () => { const a = window.__lab.av(); return [a.x, a.y]; },
    self: () => (__brRole.actors() || []).filter(j => j.self).map(j => ({ light: j.light, lightKind: j.lightKind, dominant: j.dominant, x: j.x, y: j.y, ang: j.ang, ext: j.ext,
      start: j.start, across: j.across, a: j.a, shade: j.shade, sil: j.sil.map(q => [q.x, q.y, q.A, q.B, q.h]) })),
    others: () => (__brRole.actors() || []).filter(j => !j.self).map(j => ({ kind: j.kind, light: j.light, dominant: j.dominant, x: j.x, y: j.y, ang: j.ang, a: j.a, shade: j.shade })),
    contacts: () => __brRole.dev && __brRole.dev.contacts ? __brRole.dev.contacts() : null,
    ring: (radii, n) => { const [cx, cy] = window.__lab.centre(), pts = [];
      for (const r of radii) for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
      const v = __brRole.dev.light(pts), out = []; let i = 0; for (const r of radii) { const row = []; for (let k = 0; k < n; k++) row.push(v[i++]); out.push(row); } return { centre: [cx, cy], radii, n, light: out }; },
    grid: (R, step) => { const [cx, cy] = window.__lab.centre(), pts = []; for (let y = -R; y <= R; y += step) for (let x = -R; x <= R; x += step) pts.push([cx + x, cy + y]);
      return { R, step, light: __brRole.dev.light(pts) }; },
  };
  return true; }"""
FRAMES = "n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })"


async def adm(P, o): await P.evaluate("o => { const ws = window.__ws; if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ t: 'a' }, o))); }", o)
async def frames(P, n): await P.evaluate(FRAMES, n)
async def hold(P, n=12): await P.evaluate("t => window.__clk.freeze(t)", T0); await frames(P, n)
async def thaw(P): await P.evaluate("() => window.__clk.thaw()")
async def ring(P): return await P.evaluate("([r, n]) => window.__lab.ring(r, n)", [RADII, NANG])
async def contacts(P): return await P.evaluate("() => window.__lab.contacts()")
async def has_contact(P): return await P.evaluate("() => !!(__brRole.dev && __brRole.dev.contact)")
async def gain(P, g): await P.evaluate("g => __brRole.dev.contact(g)", g); await frames(P, 4)


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


async def find_spot(P, lamp, dists=(100, 110, 120, 130)):
    return await P.evaluate("""([i, ds]) => { const A = __api, L = A.lamps[i]; for (const d of ds) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, x = Math.round(L.x + Math.cos(a) * d), y = Math.round(L.y + Math.sin(a) * d);
        if (A.sl(x, y, 44) && (d < 1 || A.Uc(L.x, L.y, a, d + 90) >= d + 89) && A.sl(L.x + Math.cos(a) * (d + 70), L.y + Math.sin(a) * (d + 70), 40)) return { x, y, lamp: [L.x, L.y], d, a: +a.toFixed(4) }; } return null; }""", [lamp, list(dists)])


async def find_pair(P, lamp):
    """a second fixture near `lamp` and an open spot that sees both (two overlapping fields)"""
    return await P.evaluate("""i => { const A = __api, Ls = A.lamps, L = Ls[i]; const near = Ls.map((M, j) => [Math.hypot(M.x - L.x, M.y - L.y), j]).filter(([d, j]) => j !== i && d > 120 && d < 420).sort((a, b) => a[0] - b[0]);
        for (const [, j] of near) { const M = Ls[j]; for (const t of [.5, .42, .58, .35, .65]) for (const off of [0, 40, -40, 70, -70]) {
          const dx = M.x - L.x, dy = M.y - L.y, n = Math.hypot(dx, dy), x = Math.round(L.x + dx * t - dy / n * off), y = Math.round(L.y + dy * t + dx / n * off);
          if (!A.sl(x, y, 40)) continue; const ok = [L, M].every(Q => { const d = Math.hypot(x - Q.x, y - Q.y); return A.Uc(Q.x, Q.y, Math.atan2(y - Q.y, x - Q.x), d) >= d - 1; });
          if (ok) return { j, x, y, lamps: [[L.x, L.y], [M.x, M.y]] }; } } return null; }""", lamp)


async def aim(P, theta):
    c = await P.evaluate("() => window.__lab.g(0, 0)"); vs = P.viewport_size; r = min(220, .42 * min(vs['width'], vs['height']))
    await P.mouse.move(c[0] + r * math.cos(theta), c[1] + r * math.sin(theta)); await frames(P, 4)


async def place(P, x, y, theta, light=False, kind='flashlight'):
    await P.evaluate("([x, y, kind]) => { __api.gear.eq.kind = kind; __api.tp(x, y); }", [x, y, kind])
    if bool(await P.evaluate("() => __api.lightOn()")) != light: await P.keyboard.press('KeyF'); await P.wait_for_timeout(200)
    await P.wait_for_timeout(900); await aim(P, theta); await P.wait_for_timeout(300)
    return await P.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")


async def shot(P, path, half=110):
    c = await P.evaluate("() => window.__lab.g(0, 0)")
    clip = {'x': max(0, c[0] - half), 'y': max(0, c[1] - half), 'width': 2 * half, 'height': 2 * half}
    await P.screenshot(path=path, clip=clip); return {'file': os.path.basename(path), 'clip': clip, 'centre': c}


async def capture(P, out, tag, extra=True):
    """one held frame: capture, ring, her cast jobs, contacts"""
    r = {'shot': await shot(P, os.path.join(out, tag + '.png')), 'ring': await ring(P), 'jobs': await P.evaluate("() => window.__lab.self()"), 'contacts': await contacts(P),
         'zoom': await P.evaluate("() => __brRole.lastFrame().r")}
    if extra and await has_contact(P):                                     # HQ5 only: the contact off in this same frame (DEV A/B)
        await gain(P, 0); r['off'] = {'shot': await shot(P, os.path.join(out, tag + '_contact_off.png')), 'ring': await ring(P), 'jobs': await P.evaluate("() => window.__lab.self()")}
        await gain(P, 1)
    return r


async def peer_cap(A, Bp, out, tag, half):
    """Bob as her page draws him (held frame): his cast jobs, the contact drawn for anyone, a capture; HQ5: the contact off in that frame"""
    r = {'bob': await Bp.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]"), 'jobs': await A.evaluate("() => window.__lab.others()"),
         'contacts': await contacts(A), 'shot': await shot(A, os.path.join(out, tag + '.png'), half)}
    if await has_contact(A):
        await gain(A, 0); r['off'] = {'shot': await shot(A, os.path.join(out, tag + '_contact_off.png'), half)}; await gain(A, 1)
    return r


async def run_variant(p, name, brrole, out):
    os.makedirs(out, exist_ok=True)
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, os.path.join(out, 'server.log')); errs = []
    R = {'variant': name, 'brrole': brrole, 'scenes': {}}
    rb = open(brrole, 'rb').read()
    try:
        b = await p.chromium.launch(args=Q.ARGS)
        async def page(nm, w=W, h=H):
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
            await ctx.add_init_script(INIT)
            await ctx.route('**/assets/br-role.js*', lambda route: route.fulfill(status=200, body=rb, headers={'content-type': 'text/javascript', 'cache-control': 'no-store'}))
            P = await Q.join(ctx, port, 'hq5lab-' + name, nm, errs, auth=True)
            await P.evaluate(HOOKS); return P
        A = await page('Alice')
        R['served'] = await A.evaluate("() => fetch('./assets/br-role.js', { cache: 'no-store' }).then(r => r.text()).then(t => t.length)")
        R['servedExpected'] = len(rb.decode('utf-8')); R['version'] = await A.evaluate("() => __brRole.version")
        await A.wait_for_timeout(800); await stage(A); await A.wait_for_timeout(400)
        await A.evaluate("() => { __brRole.setQuality('medium'); }")
        await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
        await hide_overlays(A)
        spot = await find_spot(A, A_.lamp); R['spot'] = spot
        away = spot['a']
        R['placedAt'] = await place(A, spot['x'], spot['y'], away)
        if 'geometry' in SCENES:
            S = []
            for deg in (0, 90, 180, 270):
                await thaw(A); await A.evaluate("() => { window.__handDY = null; }"); await aim(A, away + math.radians(deg)); await frames(A, 8)
                await hold(A)
                rec = {'heading': deg, 'angle': await A.evaluate("() => __api.H.angle")}
                rec.update(await capture(A, out, f'geo_{deg:03d}'))
                if deg == 0 and await has_contact(A):
                    await gain(A, 3); rec['diagnostic'] = {'gain': 3, 'shot': await shot(A, os.path.join(out, 'geo_000_diagnostic_x3.png'))}; await gain(A, 1)
                rec['swing'] = []
                for dy in ([3, -3], [-3, 3]):
                    await A.evaluate("d => { window.__handDY = d }", dy); await frames(A, 4)
                    sw = {'dy': dy, 'ring': await ring(A), 'jobs': await A.evaluate("() => window.__lab.self()"), 'contacts': await contacts(A),
                          'hands': await A.evaluate("() => window.__lab.av().hands.map(h => window.__lab.g(h.x, h.y))")}
                    if deg == 0: sw['shot'] = await shot(A, os.path.join(out, f'geo_000_swing_{dy[0]:+d}.png'))
                    rec['swing'].append(sw)
                await A.evaluate("() => { window.__handDY = null }"); await frames(A, 4)
                S.append(rec)
            R['scenes']['geometry'] = S
        if 'under' in SCENES:
            us = await find_spot(A, A_.lamp, (0, 8, 16, 24)); S = {'spot': us, 'caps': []}
            if us:
                await thaw(A); await place(A, us['x'], us['y'], 0.0)
                for deg in (0, 90):
                    await thaw(A); await aim(A, math.radians(deg)); await frames(A, 8); await hold(A)
                    c = await capture(A, out, f'under_{deg:03d}'); c['heading'] = deg; S['caps'].append(c)
                    if deg == 0 and await has_contact(A):                         # HQ5: the lamp's contact patch, contact ~0 (1e-4: the patch runs, takes nothing) vs off
                        g = {}
                        for gn in (0, 1e-4, 1): await gain(A, gn); g[str(gn)] = await A.evaluate("() => window.__lab.grid(60, 2)")
                        await gain(A, 1); S['patchExactness'] = g
                await thaw(A); await place(A, spot['x'], spot['y'], away)
            R['scenes']['under'] = S
        if 'lights' in SCENES:
            S = {}
            pair = await find_pair(A, A_.lamp); S['pair'] = pair
            if pair:
                await thaw(A); await place(A, pair['x'], pair['y'], 0.0)
                for tag, solo in (('first', [A_.lamp]), ('second', [pair['j']]), ('both', [A_.lamp, pair['j']])):
                    await thaw(A); await A.evaluate("s => __brRole.dev.solo(s)", solo); await frames(A, 30); await hold(A)
                    S[tag] = await capture(A, out, f'lights_{tag}', extra=(tag == 'both'))
            await thaw(A); await place(A, spot['x'], spot['y'], away)
            await A.evaluate("() => __brRole.dev.solo(null)"); await frames(A, 30); await hold(A)
            S['allFixtures'] = await capture(A, out, 'lights_all')
            # the server applies a blackout mode only while the world runs: unfrozen for the switch, frozen again
            await thaw(A); await adm(A, {'c': 'freeze', 'on': 0}); await adm(A, {'c': 'blackout', 'mode': 'on'}); await A.wait_for_timeout(1500); await adm(A, {'c': 'freeze', 'on': 1})
            await A.wait_for_timeout(1000); await frames(A, 20)
            S['blackoutState'] = await A.evaluate("() => !!(__api.V && __api.V.blackout)")
            await hold(A); S['blackout'] = await capture(A, out, 'lights_blackout')
            await thaw(A); await adm(A, {'c': 'freeze', 'on': 0}); await adm(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1500); await adm(A, {'c': 'freeze', 'on': 1})
            await A.wait_for_timeout(1000)
            await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp); await frames(A, 20)
            R['scenes']['lights'] = S
        if 'carried' in SCENES or 'peers' in SCENES:
            Bp = await page('Bob', 640, 400); await hide_overlays(Bp)
            await thaw(A)
            if 'carried' in SCENES:
                await A.evaluate("() => __brRole.dev.solo([-1])")
                S = {'bob': []}
                for k, rel in enumerate((0, 180)):
                    a = math.radians(rel) + spot['a']; bx, by = round(spot['x'] + math.cos(a) * 95), round(spot['y'] + math.sin(a) * 95)
                    await place(Bp, bx, by, math.atan2(spot['y'] - by, spot['x'] - bx), light=True)
                    await A.wait_for_timeout(2500); await frames(A, 30); await hold(A)
                    c = {'bob': await Bp.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")}
                    c.update(await capture(A, out, f'carried_bob_{rel:03d}')); S['bob'].append(c); await thaw(A)
                await Bp.keyboard.press('KeyF'); await Bp.wait_for_timeout(600)          # Bob's light off; hers on
                await place(A, spot['x'], spot['y'], away, light=True); await A.wait_for_timeout(1500); await frames(A, 20); await hold(A)
                S['own'] = await capture(A, out, 'carried_own'); await thaw(A)
                await place(A, spot['x'], spot['y'], away, light=False)
                R['scenes']['carried'] = S
                await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
            if 'peers' in SCENES:
                S = {}
                bx, by = spot['x'] + 60, spot['y']
                if not await Bp.evaluate("([x, y]) => __api.sl(x, y, 26)", [bx, by]): bx, by = spot['x'] - 60, spot['y']
                await place(Bp, bx, by, 0.0, light=False); await A.wait_for_timeout(2500); await frames(A, 30); await hold(A)
                S['visible'] = await peer_cap(A, Bp, out, 'peers_visible', 150); await thaw(A)
                hid = await A.evaluate("""() => { const A = __api, H = A.H; for (let d = 140; d < 420; d += 20) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = Math.round(H.x + Math.cos(a) * d), y = Math.round(H.y + Math.sin(a) * d);
                    if (A.sl(x, y, 30) && A.Uc(H.x, H.y, a, d) < d - 60) return [x, y]; } return null }""")
                if hid:
                    await A.evaluate("() => __brRole.dev.solo(null)")
                    await place(Bp, hid[0], hid[1], 0.0, light=False); await A.wait_for_timeout(2500); await frames(A, 30); await hold(A)
                    S['hidden'] = await peer_cap(A, Bp, out, 'peers_hidden', 220); await thaw(A)
                    await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
                R['scenes']['peers'] = S
            await Bp.context.close()
        if 'lifecycle' in SCENES:
            S = {'samples': []}
            await thaw(A); await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
            Bp = await page('Bob', 640, 400); await hide_overlays(Bp)
            bx, by = spot['x'], spot['y'] + 70
            if not await Bp.evaluate("([x, y]) => __api.sl(x, y, 26)", [bx, by]): bx, by = spot['x'], spot['y'] - 70
            await place(Bp, bx, by, 0.0, light=False); await A.wait_for_timeout(2500)
            SAMPLE = """() => { const c = __brRole.dev.contacts ? __brRole.dev.contacts() : null;
                return { others: c ? c.filter(j => !j.self).map(j => [j.x, j.y, j.light]) : null, self: c ? c.filter(j => j.self).length : null,
                         castOthers: (__brRole.actors() || []).filter(j => !j.self).map(j => [j.kind, Math.round(j.x), Math.round(j.y), +j.a.toFixed(3)]),
                         replays: __api.layer().children.filter(v => v && '__cause' in v && v.visible).length, fx: (window.__fxs || []).length } }"""
            async def sample(phase, n, ms=250):
                for _ in range(n):
                    r = await A.evaluate(SAMPLE); r['phase'] = phase; S['samples'].append(r); await A.wait_for_timeout(ms)
            await sample('alive', 8)
            S['aliveShot'] = await shot(A, os.path.join(out, 'lifecycle_alive.png'), 150)
            await adm(Bp, {'c': 'preview', 'k': 'hound', 'var': 'D'})
            await sample('death', 40)
            S['deathShot'] = await shot(A, os.path.join(out, 'lifecycle_after_death.png'), 150)
            await Bp.context.close()
            await sample('disconnected', 12)
            S['goneShot'] = await shot(A, os.path.join(out, 'lifecycle_disconnected.png'), 150)
            R['scenes']['lifecycle'] = S
        if 'tiers' in SCENES:
            S = []
            await thaw(A); await place(A, spot['x'], spot['y'], away)
            for q in ('low', 'medium', 'high'):
                await thaw(A); await A.evaluate("q => __brRole.setQuality(q)", q); await A.wait_for_timeout(1500); await frames(A, 40); await hold(A)
                c = await capture(A, out, f'tier_{q}'); c['quality'] = await A.evaluate("() => __brRole.quality()"); c['buffer'] = await A.evaluate("() => __brRole.stats().buffer"); S.append(c)
            await thaw(A); await A.evaluate("() => __brRole.setQuality('medium')"); await frames(A, 30)
            R['scenes']['tiers'] = S
        if 'perf' in SCENES:
            await thaw(A); await A.evaluate("() => __brRole.dev.solo(null)"); await A.wait_for_timeout(1500); await A.evaluate("() => __brRole.resetStats()")
            pf = await A.evaluate("""ms => new Promise(r => { const t = []; let last = null; const t0 = performance.now(); const f = ts => { if (last !== null) t.push(ts - last); last = ts;
                if (performance.now() - t0 < ms) requestAnimationFrame(f); else { const s = t.slice().sort((a, b) => a - b); r({ frames: t.length, meanMs: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(2), p95Ms: +s[Math.floor(.95 * (s.length - 1))].toFixed(2) }); } }; requestAnimationFrame(f); })""", A_.perf_secs * 1000)
            R['scenes']['perf'] = {'brRoleFrameMs': await A.evaluate("() => __brRole.stats().frameMs"), 'pageFrames': pf, 'contactsLastFrame': await contacts(A),
                                   'renderer': await A.evaluate("() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : null }")}
            await A.evaluate("i => __brRole.dev.solo([i])", A_.lamp)
        R['brRoleErrors'] = await A.evaluate("() => __brRole.stats().errors")
        R['pageErrors'] = errs[:20]
        await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    with open(os.path.join(out, 'result.json'), 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    return R


async def main():
    os.makedirs(A_.out, exist_ok=True)
    async with async_playwright() as p:
        for name, brrole in VARS:
            t = time.time(); R = await run_variant(p, name, brrole, os.path.join(A_.out, name))
            print(f"{name}: {R.get('version')} served {R.get('served')} (expected {R.get('servedExpected')}); scenes {list(R['scenes'])}; page errors {len(R.get('pageErrors', []))}; BR-RoLE errors {R.get('brRoleErrors')}; {time.time() - t:.0f} s", flush=True)


asyncio.run(main())
