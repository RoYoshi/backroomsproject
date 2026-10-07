/* Stage 3B - focused presentation-cost profiler (development only; never served).  Bounded: a few poses, once.
 *
 *   node dev/stage-3b/perf_3b.js --game PATH [--out FILE.json] [--n 14] [--port 9493] [--scenes a,b] [--tiers medium]
 *                                [--ablate] [--interval] [--vw 1280 --vh 720]
 *
 * What it measures, per pose, remaster OFF (the ?remaster=off look, via the DEV switch) vs ON, same pose / tier / viewport:
 *   scene ms  the Pixi scene alone, rendered N times back to back with the GPU synced after each (a 1-pixel readPixels: gl.finish does not wait in Chrome).  Before every
 *             render the world container is nudged by half a pixel, exactly what the camera does every frame: Pixi then
 *             re-transforms every batched vertex in the world on the CPU (the world is not a render group), so this
 *             counts that cost too.  Median of N.
 *   cpu ms    the same render without the sync (JS only: transforms, batching, GL submission).  Median of N.
 *   gl        per render: draw calls, bytes uploaded to buffers, texture uploads, texture binds, blend changes, programs.
 *   scene     world display objects, visible renderables, Graphics instructions (a proxy for per-frame vertex work).
 *   --ablate  remaster ON with one layer hidden at a time (floor, macro, decals, grounding, walls, props, fixtures, the
 *             legacy-carpet copy): which layer the cost belongs to.
 *   --fillonly only the fill (overdraw) and scene counts, no timing (fast).
 *   --interval the page's real frame interval (rAF) over a few seconds, OFF vs ON (what a player feels; BR-RoLE included).
 * NOTE: this container renders with SwiftShader (software).  Absolute ms say nothing about a real GPU; the relative split
 * (which layer, CPU vs raster, how many draws / uploads) is what this is for. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; }, flag = k => argv.includes('--' + k);
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9493), N = +(opt('n') || 14), OUT = opt('out') || '/tmp/perf_3b.json';
const VW = +(opt('vw') || 1280), VH = +(opt('vh') || 720), TIERS = (opt('tiers') || 'medium').split(','), ONLY = opt('scenes');
const SCENES = [
  ['yellow-spawn', 1130, 3420, 2.6, false], ['humming-counter', 3400, 1250, -Math.PI / 2, false],
  ['blackout-table', 1300, 5330, -Math.PI / 2, true], ['pillar-hall', 8352, 1632, -0.6, false],
  ['outside-slice', 5000, 5500, 0, false],          // QA2: no remastered room in view (3B-F: the corridor between DAMP and RED ROOMS)
  /* 3B-F: the rest of Level 0 */
  ['long-room', 5760, 1150, 0.2, false], ['red-rooms', 5700, 5470, 0.3, false], ['deep-machine', 7900, 5620, -Math.PI / 2, false],
  ['arch-north', 7900, 2990, -1.4, false], ['damp-counter', 3456, 5420, -Math.PI / 2, false], ['corridor-west', 1104, 2200, Math.PI / 2, false],
];
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
/* capture the game's Pixi application through Pixi's own devtools init hook, and count GL work per render */
const PROBE = `(() => { window.__apps = []; window.__PIXI_APP_INIT__ = a => window.__apps.push(a);
  window.__glc = null; window.__glWrap = gl => { if (gl.__wrapped) return; gl.__wrapped = 1; const C = window.__glc = { draws: 0, bufBytes: 0, texUp: 0, texUpPx: 0, binds: 0, blend: 0, prog: 0, fb: 0 };
    const w = (n, f) => { const o = gl[n]; if (typeof o !== 'function') return; gl[n] = function () { f.apply(null, arguments); return o.apply(gl, arguments); }; };
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) w(n, () => C.draws++);
    w('bufferData', (t, d) => { C.bufBytes += d && d.byteLength || (typeof d === 'number' ? d : 0); });
    w('bufferSubData', (t, o, d) => { C.bufBytes += d && d.byteLength || 0; });
    w('texImage2D', function () { C.texUp++; const a = arguments; const s = a[a.length - 1]; if (s && s.width) C.texUpPx += s.width * s.height; else if (typeof a[3] === 'number' && typeof a[4] === 'number') C.texUpPx += a[3] * a[4]; });
    w('texSubImage2D', () => C.texUp++); w('bindTexture', () => C.binds++); w('blendFunc', () => C.blend++); w('blendFuncSeparate', () => C.blend++); w('blendEquationSeparate', () => C.blend++);
    w('useProgram', () => C.prog++); w('bindFramebuffer', () => C.fb++); };
  window.__game = () => { const a = (window.__apps || []).slice().sort((p, q) => (q.canvas.width * q.canvas.height) - (p.canvas.width * p.canvas.height))[0]; if (a && a.renderer && a.renderer.gl) window.__glWrap(a.renderer.gl); return a; };
  /* N renders of the scene, the world nudged by half a pixel each time (as the camera does); synced: + a 1-pixel readPixels, which waits for the GPU */
  window.__bench = (n, synced) => { const a = window.__game(), r = a.renderer, gl = r.gl, world = __api.layer().parent, x0 = world.position.x, T = [], C = window.__glc;
    const px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    sync(); r.render(a.stage); sync(); const c0 = Object.assign({}, C);
    for (let i = 0; i < n; i++) { world.position.x = x0 + (i % 2 ? .5 : -.5); const t0 = performance.now(); r.render(a.stage); if (synced) sync(); T.push(performance.now() - t0); }
    world.position.x = x0; r.render(a.stage); sync();
    const per = {}; for (const k of Object.keys(C)) per[k] = +((C[k] - c0[k]) / n).toFixed(1);
    T.sort((p, q) => p - q); return { med: +T[Math.floor(T.length / 2)].toFixed(2), min: +T[0].toFixed(2), max: +T[T.length - 1].toFixed(2), gl: per }; };
  window.__sceneStats = () => { const world = __api.layer().parent; let nodes = 0, rend = 0, gfx = 0, instr = 0, l0 = 0, l0instr = 0;
    const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible || p.alpha === 0) return false; return true; };
    const walk = (o, inL0) => { nodes++; const mine = inL0 || o.label === 'l0-remaster' || o.label === 'l0-remaster-ceiling' || o.label === 'l0-legacy-carpet';
      if (o.renderPipeId && vis(o)) { rend++; if (mine) l0++; if (o.context && o.context.instructions) { gfx++; instr += o.context.instructions.length; if (mine) l0instr += o.context.instructions.length; } }
      for (const c of o.children || []) walk(c, mine); };
    walk(world, false); return { nodes, visibleRenderables: rend, visibleGraphics: gfx, graphicsInstructions: instr, remasterRenderables: l0, remasterInstructions: l0instr }; };
  /* fill: the screen area each visible renderable covers, in viewports (1.0 = one full-screen layer), sampled every 4 css px.
   * Exact shapes (Pixi's own contains()), every fill and texture instruction; strokes are ignored (hairlines). */
  window.__fill = () => { const a = window.__game(), world = __api.layer().parent, W = innerWidth, Hh = innerHeight, G = 4, out = {}, nx = Math.ceil(W / G), ny = Math.ceil(Hh / G);
    const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible || p.alpha === 0 || p.renderable === false) return false; return true; };
    const tag = o => { const ls = []; for (let p = o; p && p !== world; p = p.parent) ls.push(p.label || ''); const l0 = ls.findIndex(l => /^l0v:|^fixtures:|^l0-legacy|^l0-remaster|^l0v-legacy/.test(l));
      if (l0 >= 0) { const own = ls[0]; return 'l0/' + (own.startsWith('l0v:') || own.startsWith('l0-') ? ls[0] : own.replace(/:.*/, '')).replace(/^l0v:.*/, 'room'); }
      if (o.tileScale) return 'legacy/carpet-sprite'; return 'game/' + (o.label || o.constructor.name || '?'); };
    const count = (m, test, bx0, by0, bx1, by1) => { /* m: local->screen; test(lx, ly) */
      const det = m.a * m.d - m.b * m.c; if (!det) return 0; const ia = m.d / det, ib = -m.b / det, ic = -m.c / det, id = m.a / det, itx = (m.c * m.ty - m.d * m.tx) / det, ity = (m.b * m.tx - m.a * m.ty) / det;
      const pts = [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].map(([x, y]) => [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty]);
      let sx0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[0])) / G)), sx1 = Math.min(nx - 1, Math.ceil(Math.max(...pts.map(p => p[0])) / G)), sy0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])) / G)), sy1 = Math.min(ny - 1, Math.ceil(Math.max(...pts.map(p => p[1])) / G));
      let n = 0; for (let j = sy0; j <= sy1; j++) for (let i = sx0; i <= sx1; i++) { const X = i * G + G / 2, Y = j * G + G / 2, lx = ia * X + ic * Y + itx, ly = ib * X + id * Y + ity; if (test(lx, ly)) n++; } return n; };
    const mulM = (p, q) => ({ a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b, c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d, tx: p.a * q.tx + p.c * q.ty + p.tx, ty: p.b * q.tx + p.d * q.ty + p.ty });
    const walk = o => { if (!vis(o)) return; const wt = o.worldTransform, k = tag(o);
      if (o.context && o.context.instructions) for (const ins of o.context.instructions) {
        if (ins.action === 'texture') { const d = ins.data, m = d.transform ? mulM(wt, d.transform) : wt; out[k] = (out[k] || 0) + count(m, (x, y) => x >= d.dx && x <= d.dx + d.dw && y >= d.dy && y <= d.dy + d.dh, d.dx, d.dy, d.dx + d.dw, d.dy + d.dh); }
        else if (ins.action === 'fill') { const prims = ins.data.path && ins.data.path.shapePath && ins.data.path.shapePath.shapePrimitives || [];
          for (const pr of prims) { const s = pr.shape, b = s.getBounds ? s.getBounds() : null; if (!b) continue; const m = pr.transform ? mulM(wt, pr.transform) : wt; out[k] = (out[k] || 0) + count(m, (x, y) => s.contains(x, y), b.x, b.y, b.x + b.width, b.y + b.height); } }
      }
      else if (o.renderPipeId && o.texture) { const b = o.getLocalBounds ? o.getLocalBounds() : null; if (b) out[k] = (out[k] || 0) + count(wt, (x, y) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY, b.minX, b.minY, b.maxX, b.maxY); }
      for (const c of o.children || []) walk(c); };
    walk(world); const res = {}; let tot = 0, l0 = 0; for (const [k, v] of Object.entries(out)) { const f = +(v / (nx * ny)).toFixed(3); if (f > 0) res[k] = f; tot += v; if (k.startsWith('l0/')) l0 += v; }
    return { layersTotal: +(tot / (nx * ny)).toFixed(2), layersRemaster: +(l0 / (nx * ny)).toFixed(2), byLayer: res, resolution: a.renderer.resolution }; };
})();`;
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { n: N, viewport: [VW, VH], tiers: TIERS, scenes: [], when: new Date().toISOString() };
  try {
    const J = await H.join(browser, PORT, 'pf3b' + Date.now() % 1e5, 'PF', { viewport: { width: VW, height: VH }, init: PROBE, query: '&dev3b=1' }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off'); await P.evaluate(() => __clock.thaw());
    await until(() => P.evaluate(() => window.__l0v && __l0v.ready()), 20000);
    R.version = await P.evaluate(() => ({ remaster: __l0v.stats().version, revision: __l0v.stats().revision, pixi: (__game() || {}).renderer ? 'ok' : 'missing' }));
    const setMode = async (on, tier) => { await P.evaluate(([on, tier]) => { __brRole.setQuality(tier); __l0v.dev.remaster(on); }, [on, tier]);
      await until(() => P.evaluate(t => __l0v.stats().tier === t || !__l0v.stats().on, tier), 20000); await sleep(500); await frames(P, 3); };
    const measure = async () => { const s = await P.evaluate(n => ({ fill: __fill(), sync: n ? __bench(n, true) : { med: 0, gl: {} }, cpu: n ? __bench(n, false) : { med: 0, gl: {} }, scene: __sceneStats(), l0: (() => { const s = __l0v.stats(); return { on: s.on, visibleRooms: s.visibleRooms, texMPx: s.texMPx, decals: s.decals, tier: s.tier }; })() }), flag('fillonly') ? 0 : N); return s; };
    for (const [name, x, y, a, light] of SCENES) {
      if (ONLY && !ONLY.split(',').includes(name)) continue;
      await H.place(P, x, y, a, { light }); await sleep(900); await frames(P, 6);
      for (const tier of TIERS) {
        await setMode(false, tier); const off = await measure();
        await setMode(true, tier); const on = await measure();
        const row = { scene: name, tier, off, on, deltaSceneMs: +(on.sync.med - off.sync.med).toFixed(2), deltaCpuMs: +(on.cpu.med - off.cpu.med).toFixed(2) };
        if (flag('ablate') && name !== 'outside-slice') {
          row.ablate = {};
          const hide = { floor: ['floor'], macro: ['macro'], decals: ['decals-mul', 'decals', 'wall-decor'], grounding: ['grounding'], thresholds: ['thresholds'], walls: ['walls:legacy'], props: ['props'], fixtures: ['fixtures'] };
          for (const [k, labels] of Object.entries(hide)) {
            await P.evaluate(ls => { for (const l of ls) __l0v.dev.layer(l, false); }, labels); await frames(P, 2);
            const m = await P.evaluate(n => __bench(n, true), N); row.ablate[k] = { med: m.med, saves: +(on.sync.med - m.med).toFixed(2), draws: m.gl.draws, bufBytes: m.gl.bufBytes };
            await P.evaluate(ls => { for (const l of ls) __l0v.dev.layer(l, true); }, labels); await frames(P, 2);
          }
          const swap = v => P.evaluate(v => { const w = __api.layer().parent, copy = w.children.find(c => c.label === 'l0-legacy-carpet'), sp = w.children.find(c => c && c.tileScale && c.texture);
            if (!copy || !sp) return false; copy.visible = v; sp.visible = !v; return true; }, v);
          if (await swap(false)) {
            await frames(P, 2); const m = await P.evaluate(n => __bench(n, true), N);
            row.ablate.legacyCarpetCopy = { med: m.med, saves: +(on.sync.med - m.med).toFixed(2), draws: m.gl.draws, bufBytes: m.gl.bufBytes, note: 'the original TilingSprite shown instead of the copy (the remaster floor still on top)' };
            await swap(true); await frames(P, 2);
          }
        }
        if (flag('interval')) {
          const iv = async on => { await setMode(on, tier); await P.evaluate(() => { __brRole.resetStats(); window.__pf = []; let last = performance.now(); const f = () => { if (!window.__pf) return; const t = performance.now(); window.__pf.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
            await sleep(6000); return P.evaluate(() => { const d = window.__pf.slice(1).sort((a, b) => a - b); window.__pf = null; return { med: +d[Math.floor(d.length / 2)].toFixed(1), n: d.length, br: __brRole.stats().frameMs.mean }; }); };
          row.interval = { off: await iv(false), on: await iv(true) };
        }
        R.scenes.push(row); console.log(JSON.stringify(row));
      }
    }
    R.errors = J.errs;
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 800); console.log('ERROR', R.error); }
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); await browser.close(); srv.kill();
})();
async function until(fn, ms = 6000, every = 150) { const t = Date.now(); for (; ;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) return v; await sleep(every); } }
