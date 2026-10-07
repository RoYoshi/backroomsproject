/* Stage 3B-L (BR-RoLE 1.1) - light never goes THROUGH geometry: every lamp's cached light against the level's own geometry
 * (development only; never served).
 *
 *   node dev/stage-3b-l/occlusion_3bl.js [--game PATH] [--port 9479] [--quality medium] [--lamps all|0,5,9] [--out FILE.json]
 *
 * For each ceiling lamp, BR-RoLE 1.1's two caches (the CORE field and the FAR field + bounce light) are read back texel by
 * texel.  Every texel that holds light must have a LEGITIMATE path to that lamp, checked with the game's own ray query (walls
 * and pillars stop it):
 *   direct  - one of the fixture's tube points sees it, or
 *   bounce  - one of the lamp's bounce points (each a wall / pillar side or floor patch the lamp itself lights directly; the
 *             list BR-RoLE uses) is within its reach and sees it (lamp -> surface -> point: first order only).
 * A texel's light is allowed within a small margin of a legitimate point (the caches' own resolution: a penumbra / filter
 * edge, never a wall's thickness - walls are 96 px, pillars 56): CORE 12 px (its 3 px shadow-mask blur, as in BR-RoLE 1.0, and a
 * texel), FAR 2 texels + 4 px.  Anything else is light through a wall or a pillar.
 *   O1 core field: no light without a direct path              O2 far field + bounce: no light without a direct or bounce path
 *   O3 bounce really goes round corners: texels lit ONLY by a bounce path exist (spill is there, and it is legitimate)
 *   O4 the bounce stays much weaker than the direct light (largest bounce-only texel vs the lamp's peak) */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9479), Q = opt('quality') || 'medium', OUT = opt('out'), LAMPS = opt('lamps') || 'all';
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };

/* in the page: one lamp's caches against the geometry */
const AUDIT = `window.__occ = function (i) {
  const A = __api, R = __brRole, L = A.lamps[i], C = R.dev.cache(i, [[L.x, L.y]]); if (!C) return { i, missing: true };
  const K = R.dev.constants(), tube = R.dev.tube(i), bounce = R.dev.bounce(i), info = R.dev.cacheInfo(i);
  const sees = (sx, sy, x, y) => { const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy); return d < .5 || A.Uc(sx, sy, Math.atan2(dy, dx), d) >= d - .5; };
  const direct = (x, y) => { for (let s = 0; s < tube.length; s += 2) if (sees(tube[s], tube[s + 1], x, y)) return true; return false; };
  const viaBounce = (x, y) => { for (const e of bounce) if (Math.hypot(x - e.x, y - e.y) < e.range && sees(e.x, e.y, x, y)) return true; return false; };
  const near = (x, y, m, f) => { if (f(x, y)) return true; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (f(x + Math.cos(a) * m, y + Math.sin(a) * m) || f(x + Math.cos(a) * m / 2, y + Math.sin(a) * m / 2)) return true; } return false; };
  const out = { i, x: L.x, y: L.y, bounce: bounce.length, core: { lit: 0, bad: [] }, far: { lit: 0, bad: [], bounceOnly: 0, bounceOnlyMax: 0 }, peak: 0 };
  /* the core cache: every texel */
  { const { hx, hy, w, h, res } = info.core, pts = []; for (let j = 0; j < h; j++) for (let q = 0; q < w; q++) pts.push([L.x - hx + (q + .5) / res, L.y - hy + (j + .5) / res]);
    const v = R.dev.cache(i, pts); for (let n = 0; n < pts.length; n++) { const c = v[n].core; if (c > out.peak) out.peak = c; if (c * 255 < 1.5) continue; out.core.lit++;
      const [x, y] = pts[n]; if (!near(x, y, 12, direct)) { if (out.core.bad.length < 8) out.core.bad.push([Math.round(x), Math.round(y), +(c * 255).toFixed(1)]); out.core.badN = (out.core.badN || 0) + 1; } } }
  /* the far cache (far field + bounce light): every texel */
  { const { hx, hy, w, h, res } = info.far, pts = [], m = 2 / res + 4; for (let j = 0; j < h; j++) for (let q = 0; q < w; q++) pts.push([L.x - hx + (q + .5) / res, L.y - hy + (j + .5) / res]);
    const v = R.dev.cache(i, pts); for (let n = 0; n < pts.length; n++) { const f = v[n].far; if (f === null) { out.far.missing = true; break; } if (f * 255 * K.LAMP.fg < 1.5) continue; out.far.lit++;
      const [x, y] = pts[n]; if (near(x, y, m, direct)) continue;
      if (near(x, y, m, viaBounce)) { if (!direct(x, y) && !near(x, y, m, direct)) { out.far.bounceOnly++; if (f > out.far.bounceOnlyMax) out.far.bounceOnlyMax = f; } continue; }
      if (out.far.bad.length < 8) out.far.bad.push([Math.round(x), Math.round(y), +(f * 255).toFixed(2)]); out.far.badN = (out.far.badN || 0) + 1; } }
  return out;
};`;
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), rows = [];
  try {
    const J = await H.join(browser, PORT, 'occ' + Date.now() % 1e5, 'OCC', { viewport: { width: 1280, height: 720 }, query: '&lighting=' + Q, init: AUDIT }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    const n = await P.evaluate(() => __api.lamps.length), list = LAMPS === 'all' ? [...Array(n).keys()] : LAMPS.split(',').map(Number);
    for (const i of list) {
      const L = await P.evaluate(i => [__api.lamps[i].x, __api.lamps[i].y], i);
      await H.place(P, L[0], L[1] + 60, 0, { light: false });
      let ok = false; for (let k = 0; k < 150 && !ok; k++) { await frames(P, 3); ok = await P.evaluate(i => { const c = __brRole.dev.cacheInfo(i); return !!(c && c.far); }, i); }
      if (!ok) { rows.push({ i, missing: true }); console.log('lamp', i, 'caches not built'); continue; }
      const r = await P.evaluate(i => window.__occ(i), i); rows.push(r);
      console.log(`lamp ${i} (${r.x},${r.y}): core lit ${r.core.lit} bad ${r.core.badN || 0} | far lit ${r.far.lit} bad ${r.far.badN || 0} bounce-only ${r.far.bounceOnly} (max ${(r.far.bounceOnlyMax * 255).toFixed(2)}/255) | ${r.bounce} bounce pts`);
    }
    if (J.errs.length) console.log('page errors:', J.errs.slice(0, 4).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  const done = rows.filter(r => !r.missing), coreBad = done.filter(r => r.core.badN), farBad = done.filter(r => r.far.badN);
  check('O0 every lamp audited (its core and far caches built and read back)', done.length === rows.length && rows.length > 0, `${done.length}/${rows.length} lamps`);
  check('O1 the core field: no light without a direct path from the fixture (walls and pillars stop it)', !coreBad.length,
    `${done.reduce((s, r) => s + r.core.lit, 0)} lit texels checked; ${coreBad.length ? 'through geometry at ' + coreBad.map(r => 'lamp ' + r.i + ' ' + JSON.stringify(r.core.bad.slice(0, 3))).join('; ') : 'none through geometry'}`);
  check('O2 the far field + bounce light: no light without a direct or first-bounce path', !farBad.length,
    `${done.reduce((s, r) => s + r.far.lit, 0)} lit texels checked; ${farBad.length ? 'through geometry at ' + farBad.map(r => 'lamp ' + r.i + ' ' + JSON.stringify(r.far.bad.slice(0, 3))).join('; ') : 'none through geometry'}`);
  const bo = done.reduce((s, r) => s + r.far.bounceOnly, 0), boMax = Math.max(0, ...done.map(r => r.far.bounceOnlyMax)), peak = Math.max(0, ...done.map(r => r.peak));
  check('O3 bounce light reaches round corners where no direct light goes (legitimately)', bo > 0, `${bo} texels lit only by a bounce path, over ${done.filter(r => r.far.bounceOnly).length} lamps`);
  check('O4 the bounce stays much weaker than direct light', boMax < .15 * peak, `brightest bounce-only texel ${(boMax * 255).toFixed(2)}/255 vs a lamp's peak ${(peak * 255).toFixed(1)}/255 (P0 scale)`);
  const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ quality: Q, results, lamps: rows }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
