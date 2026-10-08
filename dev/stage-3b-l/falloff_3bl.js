/* Stage 3B-L (BR-RoLE 1.1) - light has no visible hard radius: the fluorescent field, its cache, the rendered light and
 * the sight limit (development only; never served).
 *
 *   node dev/stage-3b-l/falloff_3bl.js [--game PATH] [--port 9480] [--quality medium] [--out FILE.json]
 *
 * The parent (BR-RoLE 1.0) lamp ended in a circle: radial stops 1 / .35 / 0, the light gone at 380 px, its slope jumping
 * there; and lit floor ended in a sharp arc where the line of sight stops (700 px).  BR-RoLE 1.1:
 *   R1 the field: smooth (no step, no slope jump anywhere), never rising, a faint tail past the old 380 px edge, exactly zero
 *      at its technical bound
 *   R2 the field is a broad source: brighter along the tube than across it at the same distance from the centre
 *   R3 one open-floor lamp's CACHED light along every unobstructed direction: never rising (beyond the fixture), still lit
 *      past 380 px, dark by the bound
 *   R4 a corridor lit from one end by one lamp (no other lamp reaches it): the RENDERED light runs on past 380 px and fades
 *      to black smoothly - no slope jump anywhere along it, no step beyond the 8-bit quantum
 *   R5 two lamps overlap naturally: on the line between them the light is continuous (no seam, no dark ring) and never
 *      below either lamp's own light there
 *   R6 the sight limit: lit floor near the 700 px line-of-sight reach fades out over its last 80 px instead of ending in a
 *      sharp arc (the overlay itself, the clip included; with the fade off, the parent's hard cut for comparison)
 * Actor shadows are off in R3-R5 (the tester's own body would cast one across the lines). */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9480), Q = opt('quality') || 'medium', OUT = opt('out');
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const kinkOf = (w, k0, span) => { let m = 0, at = -1; for (let k = k0 + span; k < w.length - span; k++) { if ([w[k - span], w[k], w[k + span]].some(v => v === null)) continue;
  const s0 = (w[k] - w[k - span]) / span, s1 = (w[k + span] - w[k]) / span, d = Math.abs(s1 - s0); if (d > m) { m = d; at = k; } } return { m, at }; };
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = {};
  const waitFar = async (P, i) => { for (let k = 0; k < 150; k++) { await frames(P, 3); if (await P.evaluate(i => { const c = __brRole.dev.cacheInfo(i); return !!(c && c.far) && __brRole.dev.farReady(); }, i)) return true; } return false; };
  try {
    const J = await H.join(browser, PORT, 'fall' + Date.now() % 1e5, 'FALL', { viewport: { width: 1920, height: 1080 }, query: '&lighting=' + Q }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off'); await P.evaluate(() => __brRole.dev.actors(false));
    /* R1 / R2: the field function itself (what the caches are built from; P0 / direct share left out) */
    R.f = await P.evaluate(() => { const f = __brRole.dev.field, K = __brRole.dev.constants().LAMP, v = []; for (let d = 0; d <= K.far + 20; d += 2) v.push(f(0, d));
      return { v, K, along: f(200, 0), across: f(0, 200), at380: f(0, 380), at450: f(0, 450), atFar: f(0, K.far), past: f(0, K.far + 1) }; });
    { const v = R.f.v; let rise = 0, jump = 0, at = 0; for (let k = 1; k < v.length; k++) if (v[k] > v[k - 1] + 1e-12) rise++;
      for (let k = 2; k < v.length; k++) { const j = Math.abs((v[k] - v[k - 1]) - (v[k - 1] - v[k - 2])); if (j > jump) { jump = j; at = k * 2; } }
      const old = .35 / 187 * 2 * .9;                                    // the parent's slope jump at 380 px per 2 px step (its .9 strength scale; the light then 0)
      check('R1 the field is smooth and edgeless: never rising, no slope jump, a faint tail past 380 px, zero at its bound', !rise && jump < old / 2 && R.f.at380 > .02 && R.f.at450 > .008 && R.f.atFar === 0 && R.f.past === 0,
        `largest slope change per 2 px ${jump.toExponential(2)} (at ${at} px; the parent's edge: ${old.toExponential(2)} at 380 px, then nothing); f(380) ${R.f.at380.toFixed(4)}, f(450) ${R.f.at450.toFixed(4)}, f(${R.f.K.far}) ${R.f.atFar}`);
      check('R2 a broad fluorescent source, not a point: brighter along the tube than across it at the same distance', R.f.along > R.f.across * 1.15, `200 px along the tube ${R.f.along.toFixed(3)} vs across ${R.f.across.toFixed(3)}`); }
    /* R3: the most open lamp, its cached light along each direction with no wall or pillar within 700 px */
    const pick = await P.evaluate(() => { const A = __api; let best = null;
      A.lamps.forEach((L, i) => { const dirs = []; for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; if (A.Uc(L.x, L.y, a, 700) >= 700) dirs.push(a); } if (!best || dirs.length > best.dirs.length) best = { i, x: L.x, y: L.y, dirs }; });
      return best; });
    R.pick = pick;
    await H.place(P, pick.x, pick.y + 40, 0, { light: false }); await waitFar(P, pick.i);
    R.cache = await P.evaluate(([i, dirs]) => { const L = __api.lamps[i], out = [];
      for (const a of dirs) { const pts = []; for (let d = 0; d <= 660; d += 4) pts.push([L.x + Math.cos(a) * d, L.y + Math.sin(a) * d]); out.push({ a, v: __brRole.dev.cache(i, pts).map(c => c.core + c.far) }); }
      return out; }, [pick.i, pick.dirs]);
    { let rise = 0, lit = 1, end = 0; for (const { v } of R.cache) { for (let k = 16; k < v.length; k++) rise = Math.max(rise, v[k] - Math.min(...v.slice(15, k))); lit = Math.min(lit, v[100]); end = Math.max(end, v[163]); }
      check('R3 one open lamp\'s cached light (core + far + bounce) along every open direction: never rising past the fixture, lit past 380 px, dark at the bound', rise <= 2.5 / 255 && lit > 3 / 255 && end < 1 / 255,
        `lamp ${pick.i}, ${R.cache.length} directions; largest rise ${(rise * 255).toFixed(2)}/255 (8-bit / low-res texels); at 400 px >= ${(lit * 255).toFixed(1)}/255; at 652 px <= ${(end * 255).toFixed(2)}/255`); }
    /* R4: a corridor lit from one end - YELLOW HALL's lamp below the corridor to NORTH ROOMS (no other lamp reaches its middle) */
    const cor = await P.evaluate(() => { const A = __api; let i = A.lamps.findIndex(L => Math.floor(L.x / 96) === 10 && Math.floor(L.y / 96) === 29); return i < 0 ? null : { i, x: A.lamps[i].x, y: A.lamps[i].y }; });
    if (cor) {
      await H.place(P, cor.x + 100, cor.y - 420, -Math.PI / 2, { light: false }); await waitFar(P, cor.i); await frames(P, 20);
      R.corridor = await P.evaluate(c => { const pts = []; for (let d = 0; d <= 720; d += 4) pts.push([c.x + 110, c.y - d]); const others = __api.lamps.filter((L, k) => k !== c.i && pts.some(([x, y]) => Math.hypot(L.x - x, L.y - y) < 690)).length;
        return { v: __brRole.dev.light(pts), others }; }, cor);
      /* the slope change is measured from 300 px out (where the parent's edge was, and the tail): its own curvature near the
       * fixture is the falloff itself.  The parent's edge there: a slope of .35 / 187 x .43 per px dropping to zero at 380 px */
      const w = R.corridor.v, k1 = kinkOf(w, 75, 4), k2 = kinkOf(w, 75, 8), old = .35 / 187 * .43 * 4; let step = 0; for (let k = 76; k < w.length; k++) if (w[k] !== null && w[k - 1] !== null) step = Math.max(step, Math.abs(w[k] - w[k - 1]));
      const at = d => w[Math.round(d / 4)], firstBlack = w.findIndex((v, k) => k > 50 && v !== null && v * 255 < .5) * 4;
      check('R4 a corridor lit from one end: the rendered light runs on past 380 px and fades to black smoothly (no slope jump, no step)', at(400) * 255 >= 2 && firstBlack > 420 && step <= 2.5 / 255 && k2.m <= old / 2,
        `lamp ${cor.i} up the corridor (other lamps reaching it: ${R.corridor.others}): ${[200, 300, 380, 420, 460, 500, 540, 580].map(d => d + ' px ' + Math.round(at(d) * 255)).join(', ')} /255; black from ${firstBlack} px; ` +
        `largest step from 300 px out ${(step * 255).toFixed(1)}/255 per 4 px, slope change from 300 px out <= ${(k2.m * 255).toFixed(2)}/255 per 4 px over 32 px windows (16 px: ${(k1.m * 255).toFixed(2)}); the parent's edge: ${(old * 255).toFixed(2)}`);
    } else check('R4 a corridor lit from one end', false, 'the YELLOW HALL lamp below the corridor was not found');
    /* R5: overlap - the open lamp and its nearest neighbour in sight */
    await H.place(P, pick.x, pick.y + 40, 0, { light: false }); await waitFar(P, pick.i); await frames(P, 10);
    R.pair = await P.evaluate(i => { const A = __api, L = A.lamps[i]; let j = -1, bd = 1e9;
      A.lamps.forEach((M, k) => { const d = Math.hypot(M.x - L.x, M.y - L.y); if (k !== i && d < bd && A.Uc(L.x, L.y, Math.atan2(M.y - L.y, M.x - L.x), d) >= d) { bd = d; j = k; } });
      if (j < 0) return null; const M = A.lamps[j], pts = []; for (let t = 0; t <= 1.0001; t += 1 / 60) pts.push([L.x + (M.x - L.x) * t, L.y + (M.y - L.y) * t]);
      const a = __brRole.dev.cache(i, pts), b = __brRole.dev.cache(j, pts); return { j, d: bd, both: __brRole.dev.light(pts), a: a && a.map(c => (c.core + c.far)), b: b && b.map(c => (c.core + c.far)) }; }, pick.i);
    if (R.pair && R.pair.a && R.pair.b) { const p = R.pair, w = p.both.slice(8, 53); let step = 0; for (let k = 1; k < w.length; k++) step = Math.max(step, Math.abs(w[k] - w[k - 1]));
      check('R5 two lamps overlap naturally: the light between them is continuous (no seam or dark ring)', step <= 5 / 255 && Math.min(...w) > 5 / 255,
        `lamps ${pick.i} and ${p.j}, ${Math.round(p.d)} px apart: light between them ${w.filter((x, k) => k % 3 === 0).map(x => Math.round(x * 255)).join(' ')} /255; largest step ${(step * 255).toFixed(1)}/255 per 8 px; darkest ${Math.round(Math.min(...w) * 255)}/255`); }
    else check('R5 two lamps overlap naturally', false, 'no neighbour lamp in sight');
    /* R6: the sight limit on the overlay itself (line of sight clip included): from the player outward along a clear, lit line */
    await P.evaluate(() => __brRole.dev.actors(true));
    const line = await P.evaluate(() => { const A = __api, H = A.H; let best = null; for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; if (A.Uc(H.x, H.y, a, 760) >= 760 && Math.abs(Math.cos(a)) > .7) { best = a; break; } } return best === null ? null : { a: best, x: H.x, y: H.y }; });
    const overlay = () => P.evaluate(L => { const c = document.getElementById('light'), k = c.width / innerWidth, w = __api.layer().parent, ctx = c.getContext('2d'), out = [];
      for (let d = 560; d <= 740; d += 4) { const X = L.x + Math.cos(L.a) * d, Y = L.y + Math.sin(L.a) * d, sx = (w.position.x + X * w.scale.x) * k, sy = (w.position.y + Y * w.scale.y) * k; out.push(sx < 0 || sy < 0 || sx >= c.width || sy >= c.height ? null : ctx.getImageData(Math.floor(sx), Math.floor(sy), 1, 1).data[3]); }
      return out; }, line);
    if (line) {
      await P.evaluate(() => __brRole.dev.sightFade(true)); await frames(P, 6); const on = await overlay();
      await P.evaluate(() => __brRole.dev.sightFade(false)); await frames(P, 6); const off = await overlay(); await P.evaluate(() => __brRole.dev.sightFade(true));
      const jmp = a => { let m = 0; for (let k = 1; k < a.length; k++) if (a[k] !== null && a[k - 1] !== null) m = Math.max(m, Math.abs(a[k] - a[k - 1])); return m; };
      R.sight = { on, off };
      check('R6 the sight limit is soft: lit floor fades out over the last 80 px before the 700 px reach (no sharp arc)', jmp(on) <= 14 && jmp(off) > jmp(on) && on[on.length - 1] === 255,
        `overlay alpha 560..740 px from the player: with the fade ${on.filter((x, k) => k % 3 === 0).join(' ')}; without (the parent's cut) ${off.filter((x, k) => k % 3 === 0).join(' ')}; largest step ${jmp(on)} vs ${jmp(off)} per 4 px`);
    } else check('R6 the sight limit is soft', false, 'no clear line from the player');
    R.errs = J.errs;
  } finally { await browser.close(); srv.kill(); }
  const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ quality: Q, results, R }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
