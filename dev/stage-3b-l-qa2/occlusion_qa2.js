/* Stage 3B-L QA2 - light never goes THROUGH geometry, with QA2's mitred face receivers: every lamp's cached light against
 * the level's own geometry (development only; never served).  (dev/stage-3b-l-qa1/occlusion_qa1.js; a face's band is now its
 * mitred outline - BR-RoLE dev.bands().poly: at a convex corner its share of the corner square, at an inner corner on into
 * the corner block - and the foot of a point on it is the floor in front of the face at that point, held to the face's own
 * run: the corner block's share is carried from the last piece of the strip, as BR-RoLE draws it.)
 *
 *   node dev/stage-3b-l-qa2/occlusion_qa2.js [--game PATH] [--port 9479] [--quality medium] [--lamps all|0,5,9] [--out FILE.json]
 *
 * QA1: light inside a wall or pillar is legitimate only on a FACE band of a side turned towards the lamp, and only where the
 * floor at that face's foot (its strip) has a legitimate path itself (direct; in the far cache, which holds the bounce light,
 * direct or first bounce); anywhere else inside a blocker it is a leak.
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
  const turned = R.dev.bands(L.x - info.far.hx, L.y - info.far.hy, L.x + info.far.hx, L.y + info.far.hy).filter(f => (L.x - f.edge[0]) * f.n[0] + (L.y - f.edge[1]) * f.n[1] > .5);
  /* on a turned face's band, its foot point (the strip centre in front of it, pushed out by push) */
  const inPoly = (w, x, y) => { let ar = 0; for (let k = 0; k < 8; k += 2) ar += w[k] * w[(k + 3) % 8] - w[(k + 2) % 8] * w[k + 1]; const sg = ar >= 0 ? 1 : -1;
    for (let k = 0; k < 8; k += 2) { const ax = w[k], ay = w[k + 1], bx = w[(k + 2) % 8], by = w[(k + 3) % 8], L = Math.hypot(bx - ax, by - ay); if (L < 1e-9) continue; if (sg * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / L < -.5) return false; } return true; };
  const feetOf = (x, y, push) => { const out = []; for (const f of turned) { if (!inPoly(f.poly, x, y)) continue; const b = f.band, s = f.strip, h = f.n[1] !== 0;
      const u = h ? Math.min(b[2] - 1, Math.max(b[0] + 1, x)) : Math.min(b[3] - 1, Math.max(b[1] + 1, y));   // (the corner block's share: the strip's end)
      out.push(h ? [u, (s[1] + s[3]) / 2 + f.n[1] * push] : [(s[0] + s[2]) / 2 + f.n[0] * push, u]); } return out; };   // (on a mitre a point can sit on two bands' shared edge)
  const near = (x, y, m, f) => { if (f(x, y)) return true; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (f(x + Math.cos(a) * m, y + Math.sin(a) * m) || f(x + Math.cos(a) * m / 2, y + Math.sin(a) * m / 2)) return true; } return false; };
  const out = { i, x: L.x, y: L.y, bounce: bounce.length, core: { lit: 0, bad: [] }, far: { lit: 0, bad: [], bounceOnly: 0, bounceOnlyMax: 0 }, peak: 0 };
  /* the core cache: every texel */
  { const { hx, hy, w, h, res } = info.core, pts = []; for (let j = 0; j < h; j++) for (let q = 0; q < w; q++) pts.push([L.x - hx + (q + .5) / res, L.y - hy + (j + .5) / res]);
    const v = R.dev.cache(i, pts); for (let n = 0; n < pts.length; n++) { const c = v[n].core; if (c > out.peak) out.peak = c; if (c * 255 < 1.5) continue; out.core.lit++;
      const [x, y] = pts[n]; if (near(x, y, 12, direct)) continue; if (feetOf(x, y, 0).some(ft => near(ft[0], ft[1], 12, direct))) { out.core.face = (out.core.face || 0) + 1; continue; }
      { if (out.core.bad.length < 8) out.core.bad.push([Math.round(x), Math.round(y), +(c * 255).toFixed(1)]); out.core.badN = (out.core.badN || 0) + 1; } } }
  /* the far cache (far field + bounce light): every texel */
  { const { hx, hy, w, h, res } = info.far, pts = [], m = 2 / res + 4; for (let j = 0; j < h; j++) for (let q = 0; q < w; q++) pts.push([L.x - hx + (q + .5) / res, L.y - hy + (j + .5) / res]);
    const v = R.dev.cache(i, pts); for (let n = 0; n < pts.length; n++) { const f = v[n].far; if (f === null) { out.far.missing = true; break; } if (f * 255 * K.LAMP.fg < 1.5) continue; out.far.lit++;
      const [x, y] = pts[n]; if (near(x, y, m, direct)) continue;
      if (feetOf(x, y, 1.5 / res).some(ft => near(ft[0], ft[1], m, direct) || near(ft[0], ft[1], m, viaBounce))) { out.far.face = (out.far.face || 0) + 1; continue; }   // a face receives what reaches its foot: direct, or (far cache) first bounce
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
  check('O1 the core field: no light without a direct path from the fixture, or (a face) a direct path to its foot', !coreBad.length,
    `${done.reduce((s, r) => s + r.core.lit, 0)} lit texels checked (${done.reduce((s, r) => s + (r.core.face || 0), 0)} on lit faces); ${coreBad.length ? 'through geometry at ' + coreBad.map(r => 'lamp ' + r.i + ' ' + JSON.stringify(r.core.bad.slice(0, 3))).join('; ') : 'none through geometry'}`);
  check('O2 the far field + bounce light: no light without a direct or first-bounce path (or a lit face\'s foot)', !farBad.length,
    `${done.reduce((s, r) => s + r.far.lit, 0)} lit texels checked (${done.reduce((s, r) => s + (r.far.face || 0), 0)} on lit faces); ${farBad.length ? 'through geometry at ' + farBad.map(r => 'lamp ' + r.i + ' ' + JSON.stringify(r.far.bad.slice(0, 3))).join('; ') : 'none through geometry'}`);
  const bo = done.reduce((s, r) => s + r.far.bounceOnly, 0), boMax = Math.max(0, ...done.map(r => r.far.bounceOnlyMax)), peak = Math.max(0, ...done.map(r => r.peak));
  check('O3 bounce light reaches round corners where no direct light goes (legitimately)', bo > 0, `${bo} texels lit only by a bounce path, over ${done.filter(r => r.far.bounceOnly).length} lamps`);
  check('O4 the bounce stays much weaker than direct light', boMax < .15 * peak, `brightest bounce-only texel ${(boMax * 255).toFixed(2)}/255 vs a lamp's peak ${(peak * 255).toFixed(1)}/255 (P0 scale)`);
  const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ quality: Q, results, lamps: rows }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
