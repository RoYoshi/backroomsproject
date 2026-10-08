/* Stage 3B-L QA1 - tier parity spot check: LOW / MEDIUM / HIGH light the same places the same way (development only; never
 * served).  Tiers change sampling and resolution only.
 *
 *   node dev/stage-3b-l-qa1/parity_qa1.js [--game PATH] [--port 9492] [--scenes A,I,D,H] [--out FILE.json]
 *
 * 1920x1080, lamps on, no monsters, the clock frozen at one instant for all three tiers.  Per scene and tier: every lamp in
 * view built (core, far field, bounce), then the light BR-RoLE put at the visible floor points (24 px grid, the game's own
 * ray query from the player, inside the unfaded sight reach).  LOW and HIGH are compared with MEDIUM point by point:
 *   T1 the same fixtures are drawn (every lamp whose light reaches the view, at every tier)
 *   T2 the same light: mean |difference| small, the mean light within a few percent (resolution and the tube's sampling
 *      differ: penumbra edges may differ by a few 1/255) */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9492), OUT = opt('out'), WANT = (opt('scenes') || 'A,I,D,H').split(',');
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const C = c => c * 96 + 48;
const SCENES = { A: ['normal room (YELLOW HALL)', C(12), C(35)], I: ['dense-fixture room (REPEATING ROOMS)', C(34), C(34)], D: ['PILLAR HALL', C(82), C(12)], H: ['long corridor', C(11.5), C(22)], B: ['between fixtures', C(30), C(31)] };
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { scenes: [] };
  try {
    const J = await H.join(browser, PORT, 'par' + Date.now() % 1e5, 'PAR', { viewport: { width: 1920, height: 1080 } }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    const settle = async () => { for (let k = 0; k < 300; k++) { await frames(P, 3); if (await P.evaluate(() => { const s = __brRole.stats(); return s.lamps.pending === 0 && __brRole.dev.farReady(); })) break; } await frames(P, 16); };
    for (const id of WANT) {
      const [label, x, y] = SCENES[id]; await H.place(P, x, y, 0, { light: false }); await P.evaluate(() => window.__clock.freeze(true));
      const pts = await P.evaluate(() => { const A = __api, Hh = A.H, out = []; for (let y = Hh.y - 432; y < Hh.y + 432; y += 24) for (let x = Hh.x - 700; x < Hh.x + 700; x += 24) { const dx = x - Hh.x, dy = y - Hh.y, dd = Math.hypot(dx, dy); if (dd > 600 || !A.sl(x, y, 6)) continue; if (dd > 4 && A.Uc(Hh.x, Hh.y, Math.atan2(dy, dx), dd) < dd - 1) continue; out.push([x, y]); } return out; });
      const by = {};
      for (const q of ['medium', 'low', 'high']) {
        await P.evaluate(q => __brRole.setQuality(q), q); await settle();
        by[q] = await P.evaluate(p => ({ v: __brRole.dev.light(p), lamps: __brRole.stats().lamps.last, cap: __brRole.stats().lamps.cap, drawn: (__brRole.probe(0, 0) || { lamps: [] }).lamps.map(l => l.i).sort((a, b) => a - b) }), pts);
      }
      await P.evaluate(() => { window.__clock.thaw(); __brRole.setQuality('medium'); });
      const cmp = q => { const a = by.medium.v, b = by[q].v, d = a.map((v, k) => Math.abs((b[k] || 0) - (v || 0)) * 255).sort((u, w) => u - w), mean = arr => arr.reduce((s, v) => s + (v || 0), 0) / arr.length;
        return { meanAbs: +(d.reduce((s, v) => s + v, 0) / d.length).toFixed(2), p95: +d[Math.floor(.95 * (d.length - 1))].toFixed(1), meanLight: +mean(b).toFixed(3), sameLamps: JSON.stringify(by[q].drawn) === JSON.stringify(by.medium.drawn), lamps: by[q].lamps, cap: by[q].cap }; };
      const row = { id, label, points: pts.length, medium: { meanLight: +(by.medium.v.reduce((s, v) => s + (v || 0), 0) / pts.length).toFixed(3), lamps: by.medium.lamps, cap: by.medium.cap }, low: cmp('low'), high: cmp('high') };
      R.scenes.push(row); console.log(id, label, JSON.stringify(row));
    }
    const all = R.scenes;
    check('T1 the same fixtures are drawn at LOW, MEDIUM and HIGH (every lamp whose light reaches the view, under every tier\'s cap)', all.every(r => r.low.sameLamps && r.high.sameLamps),
      all.map(r => `${r.id}: ${r.low.lamps}/${r.medium.lamps}/${r.high.lamps} lamps (caps ${r.low.cap}/${r.medium.cap}/${r.high.cap})`).join('; '));
    check('T2 the same light: LOW and HIGH vs MEDIUM point by point - mean |difference| <= 4 / 255 and the mean light within 4 %', all.every(r => [r.low, r.high].every(t => t.meanAbs <= 4 && Math.abs(t.meanLight - r.medium.meanLight) <= .04 * Math.max(.05, r.medium.meanLight))),
      all.map(r => `${r.id}: mean light ${r.low.meanLight}/${r.medium.meanLight}/${r.high.meanLight}, |LOW-MED| mean ${r.low.meanAbs} p95 ${r.low.p95}, |HIGH-MED| mean ${r.high.meanAbs} p95 ${r.high.p95} /255`).join('; '));
    R.errs = J.errs;
  } finally { await browser.close(); srv.kill(); }
  R.results = results; const passed = results.filter(r => r.ok).length; console.log(`\n${passed}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
