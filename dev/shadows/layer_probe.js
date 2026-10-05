/* 2D Lighting & Shadows - what each shadow layer costs in frame rate, in one fixed view (development only; never served).
 *
 *   node dev/shadows/layer_probe.js GAME [--quality medium] [--viewport 1900x900] [--at 4000,3504,0] [--rounds 2] [--secs 10]
 *        [--out FILE.json]
 *
 * Opens the real client, stands the wanderer at --at (lamps on, flashlight on, frozen staged hall) and measures frames per
 * second with: no shadow layer shown, all of them, and each layer alone (grounding `ao`, cached lamp shadows `lamps`,
 * carried-light shadows `cast`, entity shadows `ents`), round by round.  Only layer visibility changes in the test page.
 * The default view is the retained IR browser suite's (1900x900, the corridor at y 3504 looking east), where software
 * rendering pays for every translucent pixel on the CPU.  Evidence about relative cost, not hardware certification. */
'use strict';
const { spawn, execSync } = require('child_process'); const http = require('http'); const fs = require('fs'); const path = require('path');
const H = require('./harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(argv[0]), PORT = 9499, Q = opt('quality') || 'medium', ROUNDS = +(opt('rounds') || 2), SECS = +(opt('secs') || 10);
const [VW, VH] = (opt('viewport') || '1900x900').split('x').map(Number), AT = (opt('at') || '4000,3504,0').split(',').map(Number);
function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }
const ACC = `(() => { window.__fp = { ts: [] }; const f = t => { window.__fp.ts.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); })();`;
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { viewport: [VW, VH], at: AT, quality: Q, rounds: [] };
  try {
    const J = await H.join(browser, PORT, 'lp' + Date.now() % 1e5, 'LP', { viewport: { width: VW, height: VH }, init: ACC }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off'); await H.place(P, AT[0], AT[1], AT[2]);
    await P.evaluate(q => { document.querySelectorAll('header,.location,.coordinates,#hud').forEach(e => e.style.visibility = 'hidden'); __shadows.setQuality(q); }, Q);
    await frames(P, 30);
    R.version = await P.evaluate(() => __shadows.version);
    const show = only => P.evaluate(only => { const root = __api.floor().parent.children.find(c => c.label === 'shadows-2d'); for (const c of root.children) c.visible = only === 'all' || c.label === 'shadows-' + only; root.visible = only !== 'none'; }, only);
    for (let r = 0; r < ROUNDS; r++) for (const only of ['none', 'all', 'ao', 'lamps', 'cast', 'ents']) {
      await show(only); await frames(P, 3); await sleep(1200); await P.evaluate(() => { window.__fp.ts.length = 0; }); await sleep(SECS * 1000);
      const ts = await P.evaluate(() => window.__fp.ts.slice()), fps = +((ts.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000 || 1)).toFixed(3);
      R.rounds.push({ round: r + 1, shown: only, fps }); console.log(r + 1, only.padEnd(6), 'fps', fps);
    }
    const by = {}; for (const x of R.rounds) (by[x.shown] = by[x.shown] || []).push(x.fps);
    R.mean = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)]));
    R.vsNone = Object.fromEntries(Object.entries(R.mean).map(([k, v]) => [k, +(100 * (v / R.mean.none - 1)).toFixed(1)]));
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 500); console.log('FAIL', R.error); }
  await browser.close(); srv.kill('SIGTERM');
  console.log(JSON.stringify({ version: R.version, mean: R.mean, vsNone: R.vsNone })); if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(R, null, 1) + '\n');
  process.exit(R.error ? 1 : 0);
})();
