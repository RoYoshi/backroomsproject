/* Stage 3B-N N1 - camera / timing policy serving and Universal Camera Fairness, against the real server and client
 * (development only; never served).
 *
 *   node dev/stage-3b-n/camera_3bn.js [--game PATH] [--port 9471] [--out FILE.json]      (exit 1 on any failure)
 *
 * C01 the server serves camera_policy.js and timing_policy.js (200, the real files) and still refuses server-only files
 * C02 at every viewport the page loads both policies (no 404) and the bundle runs on them, not on its fallbacks:
 *     window.__cameraPolicy / window.TFB_TIMING are the policy objects (frozen, with the functions the fallbacks lack)
 * C03 Universal Camera Fairness, measured on the running game: the world container's scale equals the policy's
 *     baseScale for that CSS viewport, the visible world (CSS size / scale) never exceeds the canonical 1627 x 915
 *     envelope, a non-16:9 window keeps one axis at the canonical size and crops the other, and DPR 2 shows exactly the
 *     world DPR 1 shows (it only raises the renderer resolution)
 * C04 the camera is presentation only: the client sends the same message kinds whatever the viewport */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9471), OUT = opt('out');
const policy = require(path.join(GAME, 'camera_policy.js'));
const fetch1 = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { let b = ''; q.on('data', d => b += d); q.on('end', () => r({ code: q.statusCode, body: b })); }).on('error', () => r({ code: 0, body: '' })));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
/* label, css width, css height, DPR */
const VIEWS = [['16:9 1920x1080', 1920, 1080, 1], ['16:9 1280x720', 1280, 720, 1], ['16:9 2560x1440', 2560, 1440, 1], ['16:10 1920x1200', 1920, 1200, 1],
  ['4:3 1600x1200', 1600, 1200, 1], ['21:9 2560x1080', 2560, 1080, 1], ['ultrawide 3440x1440', 3440, 1440, 1], ['16:9 1280x720 DPR2', 1280, 720, 2], ['16:9 1920x1080 DPR2', 1920, 1080, 2],
  ['ultrawide 3440x1440 DPR2', 3440, 1440, 2], ['phone 390x844 DPR2', 390, 844, 2]];
const PROBE = `window.__apps = []; window.__PIXI_APP_INIT__ = a => window.__apps.push(a);`;
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if ((await fetch1('/index.html')).code === 200) break; await sleep(100); }
  const R = { views: [] };
  try {
    const cam = await fetch1('/camera_policy.js'), tim = await fetch1('/timing_policy.js');
    const priv = {}; for (const f of ['/server.js', '/sim.js', '/ai.js', '/death_srv.js', '/package.json', '/dev/stage-3b/smoke_3b.js']) priv[f] = (await fetch1(f)).code;
    const camOk = cam.code === 200 && cam.body === fs.readFileSync(path.join(GAME, 'camera_policy.js'), 'utf8'), timOk = tim.code === 200 && tim.body === fs.readFileSync(path.join(GAME, 'timing_policy.js'), 'utf8');
    check('C01 the server serves camera_policy.js and timing_policy.js byte for byte, and still refuses server-only files', camOk && timOk && Object.values(priv).every(c => c === 404),
      `camera_policy.js ${cam.code}${camOk ? ' (exact)' : ''}, timing_policy.js ${tim.code}${timOk ? ' (exact)' : ''}; ${Object.entries(priv).map(([f, c]) => f + ' ' + c).join(', ')}`);
    const browser = await H.pw.chromium.launch({ args: H.ARGS }); const kinds = new Set();
    try {
      for (const [label, w, h, dpr] of VIEWS) {
        const J = await H.join(browser, PORT, 'cam' + Math.floor(Math.random() * 1e6), 'CAM', { viewport: { width: w, height: h }, dpr, init: PROBE, mobile: w < 700 });
        const P = J.P; await H.stage(P); await frames(P, 30); await sleep(800);
        const m = await P.evaluate(() => { const pol = window.__cameraPolicy, tm = window.TFB_TIMING, world = __api.layer().parent, app = (window.__apps || [])[0];
          return { css: [innerWidth, innerHeight], dpr: devicePixelRatio, policy: !!pol && Object.isFrozen(pol) && typeof pol.visibleWorld === 'function', timing: !!tm && Object.isFrozen(tm) && typeof tm.consume === 'function' && tm.FIXED_HZ === 60,
            base: pol ? pol.baseScale(innerWidth, innerHeight) : null, scale: world.scale.x, res: app ? app.renderer.resolution : null, canvas: app ? [app.canvas.width, app.canvas.height] : null,
            light: [document.getElementById('light').width, document.getElementById('light').height] }; });
        const sent = await P.evaluate(() => [...new Set((window.__sent || []).map(s => { try { return JSON.parse(s[1]).t; } catch (e) { return '?'; } }))]);
        sent.forEach(k => kinds.add(label + '|' + k));
        const vw = m.css[0] / m.scale, vh = m.css[1] / m.scale, want = policy.visibleWorld(m.css[0], m.css[1]);
        const row = { label, w, h, dpr, ...m, visible: [+vw.toFixed(1), +vh.toFixed(1)], policyVisible: [+want.width.toFixed(1), +want.height.toFixed(1)], missing: J.missing, errs: J.errs, sent };
        R.views.push(row); console.log(JSON.stringify(row));
        await J.ctx.close();
      }
    } finally { await browser.close(); }
    const E = 1e-3, MW = policy.MAX_WORLD_WIDTH, MH = policy.MAX_WORLD_HEIGHT;
    const no404 = R.views.every(v => !v.missing.some(p => /camera_policy|timing_policy/.test(p)));
    check('C02 every viewport loads both policies (no 404) and runs on them, not on the bundle\'s fallbacks', no404 && R.views.every(v => v.policy && v.timing),
      R.views.map(v => `${v.label}: policy ${v.policy}, timing ${v.timing}, 404s [${v.missing.join(' ')}]`).join('; '));
    const fair = R.views.map(v => {
      const bad = [];
      const pb = policy.baseScale(v.css[0], v.css[1]); if (v.base == null) bad.push('no camera policy in the page'); if (Math.abs(v.scale - pb) > 1e-3) bad.push(`scale ${v.scale.toFixed(4)} != policy ${pb.toFixed(4)}`);
      if (v.visible[0] > MW + .5 || v.visible[1] > MH + .5) bad.push(`visible ${v.visible} exceeds ${MW.toFixed(1)} x ${MH.toFixed(1)}`);
      if (v.w >= 700 && Math.abs(v.visible[0] - MW) > .5 && Math.abs(v.visible[1] - MH) > .5) bad.push('neither axis at the canonical size');
      if (Math.abs(v.res - Math.min(v.dpr, 2)) > 1e-6) bad.push(`renderer resolution ${v.res} for DPR ${v.dpr}`);
      return { v, bad }; });
    const pairs = [['16:9 1280x720', '16:9 1280x720 DPR2'], ['16:9 1920x1080', '16:9 1920x1080 DPR2'], ['ultrawide 3440x1440', 'ultrawide 3440x1440 DPR2']].map(([a, b]) => {
      const A = R.views.find(v => v.label === a), B = R.views.find(v => v.label === b); return { a, b, same: A && B && Math.abs(A.visible[0] - B.visible[0]) < .05 && Math.abs(A.visible[1] - B.visible[1]) < .05, A, B }; });
    const sizes = R.views.filter(v => v.dpr === 1 && v.w / v.h > 1.77 && v.w / v.h < 1.78);
    check('C03 Universal Camera Fairness on the running game: scale = the policy\'s, visible world within 1627 x 915, other aspect ratios crop one axis, DPR only sharpens',
      fair.every(f => !f.bad.length) && pairs.every(p => p.same) && sizes.every(v => Math.abs(v.visible[0] - MW) < .5 && Math.abs(v.visible[1] - MH) < .5),
      fair.map(f => `${f.v.label}: ${f.v.visible[0]} x ${f.v.visible[1]} world px (scale ${f.v.scale.toFixed(3)}, res ${f.v.res})${f.bad.length ? ' BAD ' + f.bad.join(', ') : ''}`).join('; ') +
      '; DPR pairs ' + pairs.map(p => `${p.a} = ${p.b}: ${p.same}`).join(', '));
    const byView = {}; for (const k of kinds) { const [l, t] = k.split('|'); (byView[l] = byView[l] || new Set()).add(t); }
    const sets = Object.values(byView).map(s => [...s].sort().join(','));
    check('C04 the camera is presentation only: every viewport sends the same kinds of messages', sets.length === R.views.length && sets.every(s => s === sets[0]), `message kinds ${sets[0] || '-'}`);
    R.fallbackWouldShow = { note: 'what the bundle fallback (fixed 1.18 above 700 px) would show at 2560x1440 and 3440x1440', '2560x1440': [2560 / 1.18, 1440 / 1.18].map(x => +x.toFixed(1)), '3440x1440': [3440 / 1.18, 1440 / 1.18].map(x => +x.toFixed(1)) };
  } catch (e) { check('C00 harness', false, String(e && e.stack || e).slice(0, 600)); }
  R.results = results; if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  srv.kill();
  const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})();
