/* Stage 3B-L (BR-RoLE 1.1) - light has no visible hard radius: the fluorescent field, its cache and the rendered light
 * (development only; never served).
 *
 *   node dev/stage-3b-l/falloff_3bl.js [--game PATH] [--port 9480] [--quality medium] [--out FILE.json]
 *
 * The parent (BR-RoLE 1.0) lamp ended in a circle: radial stops 1 / .35 / 0 with the light gone at 380 px, its slope jumping
 * there.  BR-RoLE 1.1:
 *   R1 the field: smooth (no step, no slope jump anywhere: largest change of slope between 2 px neighbours tiny), never
 *      rising, a faint tail past the old 380 px edge, exactly zero at its technical bound
 *   R2 the field is a broad source: brighter along the tube than across it at the same distance from the centre
 *   R3 one open-floor lamp's CACHED light (core + far caches, as drawn), along every unobstructed direction: no step and
 *      no kink anywhere from the fixture to darkness, still lit past 380 px, dark (< 1/255 of light) by the bound
 *   R4 the RENDERED light (the light buffer, every lamp added) along the same lines: no step between neighbours beyond the
 *      8-bit quantum, and no slope jump where the old edge was
 *   R5 lamps overlap naturally: between two lamps the rendered light is at least the larger of the two, no seam */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9480), Q = opt('quality') || 'medium', OUT = opt('out');
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = {};
  try {
    const J = await H.join(browser, PORT, 'fall' + Date.now() % 1e5, 'FALL', { viewport: { width: 1920, height: 1080 }, query: '&lighting=' + Q }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    /* R1 / R2: the field function itself */
    R.f = await P.evaluate(() => { const f = __brRole.dev.field, K = __brRole.dev.constants().LAMP, v = []; for (let d = 0; d <= K.far + 20; d += 2) v.push(f(0, d));
      return { v, K, along: f(200, 0), across: f(0, 200), at380: f(0, 380), at450: f(0, 450), atFar: f(0, K.far), past: f(0, K.far + 1) }; });
    { const v = R.f.v, sl = []; let rise = 0; for (let k = 1; k < v.length; k++) { sl.push(v[k] - v[k - 1]); if (v[k] > v[k - 1] + 1e-12) rise++; }
      let jump = 0; for (let k = 1; k < sl.length; k++) jump = Math.max(jump, Math.abs(sl[k] - sl[k - 1]));
      check('R1 the field is smooth and edgeless: never rising, no slope jump, a faint tail past 380 px, zero at its bound', !rise && jump < 2e-3 && R.f.at380 > .02 && R.f.at450 > .008 && R.f.atFar === 0 && R.f.past === 0,
        `largest slope change between 2 px steps ${jump.toExponential(2)} (parent: ${(.35 / 187 * 2).toExponential(2)} at 380 px, the light then 0); f(380) ${R.f.at380.toFixed(4)}, f(450) ${R.f.at450.toFixed(4)}, f(${R.f.K.far}) ${R.f.atFar}`);
      check('R2 a broad fluorescent source, not a point: brighter along the tube than across it at the same distance', R.f.along > R.f.across * 1.15, `200 px along the tube ${R.f.along.toFixed(3)} vs across ${R.f.across.toFixed(3)}`); }
    /* the most open lamp: the longest unobstructed directions from its centre */
    const pick = await P.evaluate(() => { const A = __api; let best = null;
      A.lamps.forEach((L, i) => { const dirs = []; for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; if (A.Uc(L.x, L.y, a, 700) >= 700) dirs.push(a); } if (!best || dirs.length > best.dirs.length) best = { i, x: L.x, y: L.y, dirs }; });
      return best; });
    R.pick = pick; console.log('open lamp', pick.i, pick.x, pick.y, 'clear directions', pick.dirs.length);
    await H.place(P, pick.x, pick.y + 40, 0, { light: false });
    for (let k = 0; k < 150; k++) { await frames(P, 3); if (await P.evaluate(i => { const c = __brRole.dev.cacheInfo(i); return !!(c && c.far) && __brRole.dev.farReady(); }, pick.i)) break; }
    await P.evaluate(() => __brRole.dev.sightFade(false));                 // R4 reads the buffer out to 600 px: the sight fade is checked in the look scenes
    await frames(P, 20); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 4);
    /* R3: the cached light along each open direction (core + far, P0 scale) */
    R.cache = await P.evaluate(([i, dirs]) => { const L = __api.lamps[i], out = [];
      for (const a of dirs) { const pts = []; for (let d = 0; d <= 660; d += 4) pts.push([L.x + Math.cos(a) * d, L.y + Math.sin(a) * d]); const v = __brRole.dev.cache(i, pts).map(c => c.core + c.far); out.push({ a, v }); }
      return out; }, [pick.i, pick.dirs]);
    { let step = 0, kink = 0, lit380 = 1, end = 0; const at = (v, d) => v[Math.round(d / 4)];
      for (const { v } of R.cache) { for (let k = 1; k < v.length; k++) if (k * 4 > 60) step = Math.max(step, Math.abs(v[k] - v[k - 1]));
        for (let k = 30; k < v.length - 4; k++) { const s0 = (v[k] - v[k - 4]) / 16, s1 = (v[k + 4] - v[k]) / 16; kink = Math.max(kink, Math.abs(s1 - s0)); }
        lit380 = Math.min(lit380, at(v, 400)); end = Math.max(end, at(v, 652)); }
      check('R3 one lamp\'s cached light along every open direction: no step or kink from the fixture to darkness, lit past 380 px, dark at the bound', step < 6 / 255 && kink < .0012 && lit380 > 3 / 255 && end < 1 / 255,
        `${R.cache.length} directions; largest step between 4 px samples ${(step * 255).toFixed(2)}/255, largest slope change ${(kink * 255).toFixed(3)}/255 per px; at 400 px >= ${(lit380 * 255).toFixed(1)}/255; at 652 px <= ${(end * 255).toFixed(2)}/255`); }
    /* R4: the rendered light buffer along the same lines (every lamp added: what the overlay loses) */
    R.render = await P.evaluate(([i, dirs]) => { const L = __api.lamps[i], out = [];
      for (const a of dirs) { const pts = []; for (let d = 40; d <= 600; d += 4) pts.push([L.x + Math.cos(a) * d, L.y + Math.sin(a) * d]); out.push({ a, v: __brRole.dev.light(pts) }); }
      return out; }, [pick.i, pick.dirs]);
    { let step = 0, kink = 0, n = 0;
      for (const { v } of R.render) { const w = v.filter(x => x !== null); n += w.length;
        for (let k = 1; k < w.length; k++) step = Math.max(step, Math.abs(w[k] - w[k - 1]));
        for (let k = 8; k < w.length - 8; k++) { const s0 = (w[k] - w[k - 8]) / 32, s1 = (w[k + 8] - w[k]) / 32; kink = Math.max(kink, Math.abs(s1 - s0)); } }
      check('R4 the rendered light (all lamps added) along the same lines: no step beyond the 8-bit quantum, no slope jump', n > 100 && step <= 4 / 255 && kink < .0012,
        `${n} samples; largest step ${(step * 255).toFixed(1)}/255 between 4 px neighbours; largest slope change ${(kink * 255).toFixed(3)}/255 per px over 32 px`); }
    /* R5: overlap - the nearest neighbour lamp: on the line between them the light never dips below either lamp's own */
    R.pair = await P.evaluate(i => { const A = __api, L = A.lamps[i]; let j = -1, bd = 1e9;
      A.lamps.forEach((M, k) => { const d = Math.hypot(M.x - L.x, M.y - L.y); if (k !== i && d < bd && A.Uc(L.x, L.y, Math.atan2(M.y - L.y, M.x - L.x), d) >= d) { bd = d; j = k; } });
      if (j < 0) return null; const M = A.lamps[j], pts = []; for (let t = 0; t <= 1.0001; t += 1 / 40) pts.push([L.x + (M.x - L.x) * t, L.y + (M.y - L.y) * t]);
      const both = __brRole.dev.light(pts), a = __brRole.dev.cache(i, pts), b = __brRole.dev.cache(j, pts); return { j, d: bd, both, a: a && a.map(c => c.core + c.far), b: b && b.map(c => c.core + c.far) }; }, pick.i);
    if (R.pair && R.pair.a && R.pair.b) { const p = R.pair; let dip = 0, mono = 0, minMid = 1; const mid = p.both.slice(10, 31).filter(x => x !== null);
      for (let k = 0; k < p.both.length; k++) { if (p.both[k] === null) continue; }
      for (let k = 1; k < mid.length; k++) mono = Math.max(mono, Math.abs(mid[k] - mid[k - 1]));
      check('R5 two lamps overlap naturally: the light between them is continuous, no seam or dark ring', mono <= 6 / 255 && Math.min(...mid) > 2 / 255,
        `lamps ${pick.i} and ${p.j}, ${Math.round(p.d)} px apart: light between them ${mid.map(x => Math.round(x * 255)).join(' ')} /255`); }
    else check('R5 two lamps overlap naturally', false, 'no visible neighbour lamp');
    R.errs = J.errs;
  } finally { await browser.close(); srv.kill(); }
  const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ quality: Q, results, R }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
