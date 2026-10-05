/* 2D Lighting & Shadows - frame rate of a fixed view, per tree and shadow quality (development only; never served).
 *
 *   node dev/shadows/frame_probe.js --games label=PATH[,label=PATH...] [--tiers off,medium] [--rounds 2] [--secs 12]
 *        [--viewport 1900x900] [--at 4000,3504,0] [--out FILE.json]
 *
 * Opens the real client of each tree (its own `node server.js`), stands the wanderer at --at (x, y, aim) in a staged,
 * frozen hall with the lamps on and the flashlight on, and measures frames per second and rAF intervals over --secs
 * seconds of real time, alternating trees and tiers round by round in one browser.  The default view is the one the
 * retained IR browser suite (dev/tests/ir_test.py) uses: 1900x900, the long corridor at y 3504 looking east.  A tree
 * without the shadow module runs its rounds as `baseline`.  Software rendering (SwiftShader) on a small container:
 * evidence about relative cost, not hardware certification. */
'use strict';
const { spawn, execSync } = require('child_process'); const http = require('http'); const fs = require('fs'); const path = require('path');
const H = require('./harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const games = (opt('games') || '').split(',').filter(Boolean).map(s => { const i = s.indexOf('='); return { label: s.slice(0, i), dir: path.resolve(s.slice(i + 1)) }; });
const TIERS = (opt('tiers') || 'off,medium').split(','), ROUNDS = +(opt('rounds') || 2), SECS = +(opt('secs') || 12);
const [VW, VH] = (opt('viewport') || '1900x900').split('x').map(Number), AT = (opt('at') || '4000,3504,0').split(',').map(Number);
function get(port, p) { return new Promise(res => { http.get({ host: '127.0.0.1', port, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }
const ACC = `(() => { window.__fp = { ts: [] }; const f = t => { window.__fp.ts.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); })();`;
(async () => {
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { viewport: [VW, VH], at: AT, secs: SECS, rounds: [] };
  try {
    for (const [n, g] of games.entries()) {
      g.port = 9491 + n; try { execSync(`fuser -k ${g.port}/tcp`, { stdio: 'ignore' }); } catch (e) { }
      g.srv = spawn('node', ['server.js', String(g.port)], { cwd: g.dir, stdio: 'ignore' });
      for (let i = 0; i < 60; i++) { if (await get(g.port, '/index.html') === 200) break; await sleep(100); }
    }
    /* one page at a time (nothing else drawing on the two cores), opened fresh for each tree in each round, trees alternating */
    for (let r = 0; r < ROUNDS; r++) for (const g of games) {
      const J = await H.join(browser, g.port, 'fp' + (Date.now() % 1e6), 'FP', { viewport: { width: VW, height: VH }, init: ACC }), P = J.P;
      await H.stage(P); await H.setLights(P, 'off'); await H.place(P, AT[0], AT[1], AT[2]);
      await P.evaluate(() => { document.querySelectorAll('header,.location,.coordinates,#hud').forEach(e => e.style.visibility = 'hidden'); });
      const mod = await P.evaluate(() => !!window.__shadows);
      for (const t of (mod ? TIERS : ['baseline'])) {
        if (mod) await P.evaluate(q => __shadows.setQuality(q), t);
        await frames(P, 4); await sleep(1500); await P.evaluate(() => { window.__fp.ts.length = 0; if (window.__shadows) __shadows.resetStats(); }); await sleep(SECS * 1000);
        const ts = await P.evaluate(() => window.__fp.ts.slice()); const iv = []; for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]); iv.sort((a, b) => a - b);
        const row = { round: r + 1, tree: g.label, tier: t, frames: ts.length, fps: +((ts.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000 || 1)).toFixed(3), p50: +(iv[Math.floor(iv.length / 2)] || 0).toFixed(1), p95: +(iv[Math.min(iv.length - 1, Math.floor(iv.length * .95))] || 0).toFixed(1),
          module: mod ? await P.evaluate(() => __shadows.stats().buildMs) : null };
        R.rounds.push(row); console.log(JSON.stringify(row));
      }
      await J.ctx.close();
    }
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 500); console.log('FAIL', R.error); }
  await browser.close(); for (const g of games) g.srv && g.srv.kill('SIGTERM');
  const by = {}; for (const r of R.rounds) (by[r.tree + ' ' + r.tier] = by[r.tree + ' ' + r.tier] || []).push(r.fps);
  R.mean = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)]));
  console.log(JSON.stringify(R.mean)); if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(R, null, 1) + '\n');
  process.exit(R.error ? 1 : 0);
})();
