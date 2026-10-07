/* Stage 3B-N - fast checks (node, no browser; development only, never served).
 *
 *   node dev/stage-3b-n/test_3bn.js [--only N1,N3]        (exit 1 on any failure)
 *
 * Each section belongs to one Stage 3B-N correction; the browser checks are in camera_3bn.js / visibility_3bn.js. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..', '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const argv = process.argv.slice(2), ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const sections = [];
const section = (id, fn) => sections.push([id, fn]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------------------------------------------------------- N1 camera / timing policy serving */
section('N1', async () => {
  const PORT = 9472, get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { let b = ''; q.on('data', d => b += d); q.on('end', () => r({ code: q.statusCode, body: b })); }).on('error', () => r({ code: 0 })));
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) { if ((await get('/index.html')).code === 200) break; await sleep(100); }
    const srcs = [...read('index.html').matchAll(/<script[^>]*\ssrc="\.?\/?([^"]+)"/g)].map(m => '/' + m[1].replace(/^\.\//, ''));
    const codes = {}; for (const s of srcs) codes[s] = (await get(s)).code;
    const bad = Object.entries(codes).filter(([, c]) => c !== 200);
    check('N1-1 every script index.html loads is served (200): camera_policy.js and timing_policy.js included', !bad.length && srcs.includes('/camera_policy.js') && srcs.includes('/timing_policy.js'),
      `${srcs.length} scripts; ${bad.length ? 'NOT served: ' + bad.map(([s, c]) => s + ' ' + c).join(', ') : 'all 200'}`);
    const priv = ['/server.js', '/sim.js', '/ai.js', '/death_srv.js', '/package.json', '/dev/tests/run.js', '/dev/stage-3b-n/test_3bn.js', '/../server.js'];
    const pc = {}; for (const p of priv) pc[p] = (await get(p)).code;
    check('N1-2 server-only and development files are still never served', Object.values(pc).every(c => c === 404 || c === 400), Object.entries(pc).map(([p, c]) => p + ' ' + c).join(', '));
    const cam = (await get('/camera_policy.js')).body, tim = (await get('/timing_policy.js')).body;
    check('N1-3 the served policies are the repository files byte for byte (policy contents unchanged)', cam === read('camera_policy.js') && tim === read('timing_policy.js'));
  } finally { srv.kill(); }
  const B = read('assets/index-DKbV5Nv9.js');
  const usesCam = /this\.baseScale=window\.__cameraPolicy\?window\.__cameraPolicy\.baseScale\(innerWidth,innerHeight\)/.test(B), usesTim = /__tm=window\.TFB_TIMING\|\|/.test(B);
  const order = [...read('index.html').matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  check('N1-4 the bundle reads both policies at start-up, and index.html loads them before the bundle (classic scripts run before the deferred module)', usesCam && usesTim && order.indexOf('./camera_policy.js') < order.indexOf('./assets/index-DKbV5Nv9.js') && order.indexOf('./timing_policy.js') < order.indexOf('./assets/index-DKbV5Nv9.js'),
    `camera hook ${usesCam}, timing hook ${usesTim}, order ${order.slice(0, 3).join(' ')}`);
  const pol = require(path.join(ROOT, 'camera_policy.js')), bad = [];
  for (const [w, h] of [[1920, 1080], [1280, 720], [2560, 1440], [3840, 2160], [1920, 1200], [1600, 1200], [2560, 1080], [3440, 1440], [5120, 1440], [1080, 1920], [390, 844], [844, 390]]) {
    const v = pol.visibleWorld(w, h); if (v.width > pol.MAX_WORLD_WIDTH + 1e-6 || v.height > pol.MAX_WORLD_HEIGHT + 1e-6) bad.push(w + 'x' + h); }
  check('N1-5 the policy never shows more than the canonical 1627 x 915 world at any CSS size (DPR is not an input)', !bad.length, bad.length ? 'exceeds: ' + bad.join(', ') : '12 viewports including 32:9, portrait and phones');
});

/* ---------------------------------------------------------------- N2 true darkness + danger flicker (static seams; the pixels are visibility_3bn.js) */
section('N2', async () => {
  const BR = read('assets/br-role.js'), MP = read('mp.js'), EN = read('ents.js'), ES = read('dev/ents_src/40_debug.js');
  check('N2-1 BR-RoLE draws no sourceless ambient glow around the viewer (no AMB gradient left)', !/AMB\s*=\s*\{/.test(BR) && !/AMB\.r[01]/.test(BR) && !/createRadialGradient\(V\.x,\s*V\.y/.test(BR));
  const opac = [...MP.matchAll(/light\.style\.opacity/g)].length;
  check('N2-2 the danger flicker never thins the darkness overlay (mp.js sets no #light opacity)', opac === 0, `${opac} writes`);
  check('N2-3 the danger shake moves the world and its darkness overlay together (same transform)', /game\.style\.transform\s*=\s*shk;\s*light\.style\.transform\s*=\s*shk/.test(MP));
  check('N2-4 the flicker is a surge of the ceiling lamps: mp.js sets window.__dangerFlicker and __ents.lamp multiplies it in (source and build agree)',
    /window\.__dangerFlicker\s*=/.test(MP) && [EN, ES].every(s => /E\.lamp = function[^]*?window\.__dangerFlicker[^]*?return g;[^]*?let m = g;/.test(s)));
  /* __ents.lamp under the surge: 1 when calm, the surge when no failure, and a failing lamp still goes dark */
  const w = { __dangerFlicker: 1 }, perf = { now: () => 0 };
  const fn = new Function('window', 'performance', 'sm', 'E', ES.match(/E\.lamp = function[^]*?\n\};/)[0] + '; return E.lamp;');
  const E = { fails: [] }, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lamp = fn(w, perf, sm, E);
  const calm = lamp(0, 0, 0); w.__dangerFlicker = 1.8; const surge = lamp(0, 0, 0);
  E.fails = [{ x: 0, y: 0, r: 300, until: 99 }]; const failing = lamp(0, 0, 0); w.__dangerFlicker = undefined; const unset = lamp(500, 500, 0);
  check('N2-5 __ents.lamp: calm 1, surge multiplies, a failed lamp stays nearly dark under a surge, unset flag = 1', calm === 1 && surge === 1.8 && failing < .2 && unset === 1,
    `calm ${calm}, surge ${surge}, failing+surge ${failing.toFixed(3)}, unset ${unset}`);
  check('N2-6 BR-RoLE still caps a lamp at .9 (a surge brightens lamps inside the line of sight; it cannot exceed the cap)', /return Math\.min\(\.9, \(i % 13 === 0/.test(BR));
});

(async () => {
  for (const [id, fn] of sections) { if (ONLY && !ONLY.includes(id)) continue; try { await fn(); } catch (e) { check(id + ' harness', false, String(e && e.stack || e).slice(0, 500)); } }
  const pass = results.filter(r => r.ok).length;
  console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})();
