#!/usr/bin/env node
/* dev/post-3h-trials/tools/t1_menu_perf.js - post-3H Trial 1: what the title's drift costs on the idle main menu, C5d against the
 * candidate, interleaved, with an A/A control (development only; a checkpoint measurement, not a gate step).
 *
 *   node dev/post-3h-trials/tools/t1_menu_perf.js --old-dir DIR --new-dir DIR [--rounds 6] [--seconds 10] [--aa 1] [--out FILE.json]
 *
 * DIR: complete game folders (as dev/tools/checks/menu_drift.js takes them), each served by its own `node server.js PORT` with a
 * synthetic admin passcode.  --aa 1 measures --old-dir against a second copy of itself (the A/A control: the same code twice).  Each
 * round opens one page a side, in an order that alternates from round to round, at two sizes (1920 x 1080; a 390 x 844 phone at 3x with
 * touch), passes the boot gate with a key or a tap, waits for the menu to settle, and then, with the mouse untouched, measures for
 * --seconds seconds:
 *   - the frames: the interval between consecutive animation frames (median, 95th and 99th percentile, the frame rate);
 *   - the main thread, from Chromium's own counters (DevTools Performance.getMetrics): task, script, style recalculation and layout
 *     time, in ms per second;
 *   - the drift's own cost: the time spent inside the requestAnimationFrame callbacks ui.js asks for (0 on C5d, which asks for none on an
 *     idle menu), in ms per second and per call.
 * Chromium is headless and draws with SwiftShader (no physical GPU): the world the game keeps drawing under the menu's black field
 * costs most of each frame here, so frame rates are low and noisy; the A/A rounds say how much.  Reported, not judged: a difference is
 * "within the A/A noise" when its median is inside the A/A's own range of paired differences.  Servers are stopped by their PIDs. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG['old-dir'] || !ARG['new-dir']) { console.error('--old-dir DIR and --new-dir DIR are required'); process.exit(2); }
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUNDS = +(ARG.rounds || 6), SECS = +(ARG.seconds || 10), AA = ARG.aa === '1';
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(dir) { const port = await freePort(); const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 't1-synthetic-admin' }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); } try { process.kill(p.pid); } catch (e) { } throw new Error('no server in ' + dir); }
const stop = async s => { if (!s) return; try { process.kill(s.p.pid); } catch (e) { } for (let i = 0; i < 50 && s.p.exitCode === null && s.p.signalCode === null; i++) await sleep(50); };
/* the drift's own time: ui.js's animation-frame callbacks, timed (installed before the page's scripts; ui.js's code is not changed) */
const OBS = `(() => { const T = window.__t1p = { calls: 0, ms: 0 }; const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { let ui = false; try { ui = /\\/assets\\/ui\\.js/.test(new Error().stack || ''); } catch (e) { }
    if (!ui) return raf.call(window, cb);
    return raf.call(window, ts => { const t0 = performance.now(); try { return cb(ts); } finally { T.calls++; T.ms += performance.now() - t0; } }); }; })();`;
const ev = (cdp, e) => cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: false }).then(r => r.result && r.result.value).catch(() => null);
const VIEWS = { desktop: { viewport: { width: 1920, height: 1080 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
async function measure(b, port, view) {
  const o = VIEWS[view], ctx = await b.newContext(o), P = await ctx.newPage(), cdp = await ctx.newCDPSession(P);
  try {
    await P.addInitScript(OBS);
    await P.goto(`http://127.0.0.1:${port}/?room=t1perf${Date.now() % 1e6}`, { waitUntil: 'commit', timeout: 90000 });
    let st = null; for (let i = 0; i < 900; i++) { st = await ev(cdp, 'window.__boot ? __boot.state() : null'); if (st === 'ready' || st === 'menu') break; await sleep(100); }
    if (st === 'ready') { if (o.isMobile) await P.touchscreen.tap(195, 520); else await P.keyboard.press('Space'); }
    for (let i = 0; i < 300; i++) { if (await ev(cdp, `(() => { const m = document.getElementById('menu'); return !!m && !m.hidden && !m.classList.contains('mm-intro') && __boot.state() === 'menu'; })()`)) break; await sleep(100); }
    await sleep(2000);
    await cdp.send('Performance.enable');
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const d0 = await P.evaluate(() => Object.assign({}, window.__t1p));
    const iv = await P.evaluate(ms => new Promise(r => { const t = []; const t0 = performance.now(); const f = ts => { t.push(ts); if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(t); }; requestAnimationFrame(f); }), SECS * 1000);
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const d1 = await P.evaluate(() => Object.assign({}, window.__t1p)), drift = await P.evaluate(() => window.__ui && __ui.drift ? __ui.drift() : null);
    const gaps = []; for (let i = 1; i < iv.length; i++) gaps.push(iv[i] - iv[i - 1]); gaps.sort((a, c) => a - c);
    const q = f => gaps.length ? +gaps[Math.min(gaps.length - 1, Math.floor(f * gaps.length))].toFixed(2) : null, secs = (iv[iv.length - 1] - iv[0]) / 1000 || SECS;
    const per = k => +(((m1[k] || 0) - (m0[k] || 0)) * 1000 / secs).toFixed(3);   // seconds of work -> ms per second
    return { frames: iv.length, fps: +(gaps.length / secs).toFixed(2), p50: q(.5), p95: q(.95), p99: q(.99), taskMsPerS: per('TaskDuration'), scriptMsPerS: per('ScriptDuration'),
      styleMsPerS: per('RecalcStyleDuration'), layoutMsPerS: per('LayoutDuration'), styleRecalcs: (m1.RecalcStyleCount || 0) - (m0.RecalcStyleCount || 0),
      driftCalls: d1.calls - d0.calls, driftMsPerS: +((d1.ms - d0.ms) / secs).toFixed(4), driftMsPerCall: d1.calls - d0.calls ? +((d1.ms - d0.ms) / (d1.calls - d0.calls)).toFixed(4) : 0, driftRunning: drift ? drift.running : null };
  } finally { await ctx.close(); }
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
(async () => {
  const OLD = path.resolve(ARG['old-dir']), NEW = AA ? fs.mkdtempSync(path.join(os.tmpdir(), 't1aa-')) : path.resolve(ARG['new-dir']);
  if (AA) execFileSync('cp', ['-a', OLD + path.sep + '.', NEW]);   // (OLD/. : its contents)
  const R = { tool: 'dev/post-3h-trials/tools/t1_menu_perf.js', mode: AA ? 'A/A (the old side against a copy of itself)' : 'A/B', old: OLD, new: AA ? OLD + ' (copy)' : NEW, rounds: ROUNDS, seconds: SECS, results: {}, summary: {} };
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); R.chromium = b.version();
  let so = null, sn = null;
  try {
    so = await serve(OLD); sn = await serve(NEW);
    for (const view of Object.keys(VIEWS)) {
      R.results[view] = [];
      for (let r = 0; r < ROUNDS; r++) {
        const order = r % 2 ? ['new', 'old'] : ['old', 'new'], row = { order: order.join(' then ') };
        for (const side of order) row[side] = await measure(b, side === 'old' ? so.port : sn.port, view);
        R.results[view].push(row);
        console.log(`${view} round ${r + 1}: old ${row.old.fps} fps p95 ${row.old.p95} ms task ${row.old.taskMsPerS} ms/s; new ${row.new.fps} fps p95 ${row.new.p95} ms task ${row.new.taskMsPerS} ms/s, drift ${row.new.driftMsPerS} ms/s`);
      }
      const S = {};
      for (const k of ['fps', 'p50', 'p95', 'p99', 'taskMsPerS', 'scriptMsPerS', 'styleMsPerS', 'layoutMsPerS', 'driftMsPerS', 'driftMsPerCall']) {
        const o = R.results[view].map(x => x.old[k]), n = R.results[view].map(x => x.new[k]), d = R.results[view].map(x => x.new[k] - x.old[k]);
        S[k] = { oldMedian: +med(o).toFixed(4), newMedian: +med(n).toFixed(4), pairedDiffMedian: +med(d).toFixed(4), pairedDiffMin: +Math.min(...d).toFixed(4), pairedDiffMax: +Math.max(...d).toFixed(4) };
      }
      R.summary[view] = S;
    }
  } finally { await stop(so); await stop(sn); await b.close(); if (AA) fs.rmSync(NEW, { recursive: true, force: true }); }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  for (const [v, S] of Object.entries(R.summary)) console.log(v, Object.entries(S).map(([k, x]) => `${k} ${x.oldMedian} -> ${x.newMedian} (paired ${x.pairedDiffMedian}, ${x.pairedDiffMin}..${x.pairedDiffMax})`).join('; '));
})();
