#!/usr/bin/env node
/* dev/post-3h-trials/tools/t1_capture.js - post-3H Trial 1: a short capture of the main menu's title, C5d beside the candidate, for the
 * owner's Human QA (development only; evidence, not a check).
 *
 *   node dev/post-3h-trials/tools/t1_capture.js --old-dir DIR --new-dir DIR --out DIR [--seconds 20] [--every 250] [--viewport 1280x720]
 *                                                  [--sides old,new]
 *
 * Each side is served by its own `node server.js PORT` (a synthetic admin passcode) and opened in headless Chromium (SwiftShader) at
 * --viewport (default 1280 x 720); the boot gate is passed with a key; the mouse is never moved.  For --seconds s, the same rectangle around
 * the title's resting box is captured on each of --sides, at most every --every ms (under SwiftShader a capture waits for the page's next
 * frame, so there are fewer: each frame's own time is recorded), as PNG frames, then t1_capture_frames.json with the title's offset at each
 * frame.  The frames are put together by the caller (an animated image, each frame shown for the time it really lasted).  Servers are
 * stopped by their PIDs. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG['old-dir'] || !ARG['new-dir'] || !ARG.out) { console.error('--old-dir DIR --new-dir DIR --out DIR are required'); process.exit(2); }
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SECS = +(ARG.seconds || 20), EVERY = +(ARG.every || 250), OUT = path.resolve(ARG.out), [VW, VH] = (ARG.viewport || '1280x720').split('x').map(Number), SIDES = (ARG.sides || 'old,new').split(',');
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(dir) { const port = await freePort(); const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 't1-synthetic-admin' }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); } try { process.kill(p.pid); } catch (e) { } throw new Error('no server in ' + dir); }
const ev = (cdp, e) => cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: false }).then(r => r.result && r.result.value).catch(() => null);
const OFFSET = () => { const t = document.getElementById('mmTitle'), cs = getComputedStyle(t), M = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
  return { x: +(M.m41 + parseFloat(cs.width) / 2).toFixed(3), y: +M.m42.toFixed(3) }; };
async function open(b, port) {
  const ctx = await b.newContext({ viewport: { width: VW, height: VH } }), P = await ctx.newPage(), cdp = await ctx.newCDPSession(P);
  await P.goto(`http://127.0.0.1:${port}/?room=t1capture${Date.now() % 1e6}`, { waitUntil: 'commit', timeout: 90000 });
  let st = null; for (let i = 0; i < 900; i++) { st = await ev(cdp, 'window.__boot ? __boot.state() : null'); if (st === 'ready' || st === 'menu') break; await sleep(100); }
  if (st === 'ready') await P.keyboard.press('Space');
  for (let i = 0; i < 300; i++) { if (await ev(cdp, `(() => { const m = document.getElementById('menu'); return !!m && !m.hidden && !m.classList.contains('mm-intro'); })()`)) break; await sleep(100); }
  await sleep(1500);
  return { ctx, P };
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const sides = {}, R = { tool: 'dev/post-3h-trials/tools/t1_capture.js', seconds: SECS, every: EVERY, frames: {} };
  try {
    for (const [k, d] of [['old', ARG['old-dir']], ['new', ARG['new-dir']]].filter(([k]) => SIDES.includes(k))) { const s = await serve(path.resolve(d)); sides[k] = Object.assign(s, await open(b, s.port)); }
    const clip = await sides[SIDES[0]].P.evaluate(() => { const r = document.getElementById('mmTitle').getBoundingClientRect(); return { x: Math.floor(r.left - 10), y: Math.floor(r.top - 10), width: Math.ceil(r.width + 20), height: Math.ceil(r.height + 20) }; });
    R.clip = clip; R.viewport = [VW, VH]; for (const k of SIDES) R.frames[k] = [];
    const t0 = Date.now();
    for (let i = 0; Date.now() - t0 < SECS * 1000; i++) {
      for (const k of SIDES) { const f = `${k}_${String(i).padStart(3, '0')}.png`; await sides[k].P.screenshot({ path: path.join(OUT, f), clip }); R.frames[k].push(Object.assign({ file: f, ms: Date.now() - t0 }, await sides[k].P.evaluate(OFFSET))); }
      const wait = EVERY - ((Date.now() - t0) % EVERY); await sleep(wait);
    }
  } finally {
    for (const s of Object.values(sides)) { try { await s.ctx.close(); } catch (e) { } try { process.kill(s.p.pid); } catch (e) { } }
    await b.close();
  }
  fs.writeFileSync(path.join(OUT, 't1_capture_frames.json'), JSON.stringify(R, null, 1) + '\n');
  const span = k => { const f = R.frames[k] || []; return f.length ? `x ${Math.min(...f.map(o => o.x))}..${Math.max(...f.map(o => o.x))}, y ${Math.min(...f.map(o => o.y))}..${Math.max(...f.map(o => o.y))}` : '-'; };
  console.log(SIDES.map(k => `${k === 'old' ? "C5d's" : "the candidate's"} title: ${R.frames[k].length} frames, ${span(k)} px from rest`).join('; '));
})();
