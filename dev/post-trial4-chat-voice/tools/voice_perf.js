#!/usr/bin/env node
/* dev/post-trial4-chat-voice/tools/voice_perf.js - post-Trial 4 chat polish: what typed-out bubbles and voices cost a page in a run
 * (development only; a checkpoint measurement, not a gate step).
 *
 *   node dev/post-trial4-chat-voice/tools/voice_perf.js --dir DIR [--rounds 4] [--seconds 10] [--out FILE.json]
 *
 * One server (`node server.js PORT` in DIR, a synthetic admin passcode), one headless Chromium page (SwiftShader, 1280x720) in a run with
 * the world frozen.  A key is pressed first (the browser's autoplay rule: the voices may play).  Then, in rounds that alternate voices
 * on and off (Settings' switch, window.__voice.set), two nearby speakers talk without pause: every 2.5 s each is handed a 60-character
 * synthetic line (window.__chat.net, as the session hands a heard line), so two bubbles are always writing and (with voices on) two
 * voices always chirping - the most the page lets speak at once.  Measured per round, over --seconds: the main thread from Chromium's
 * own counters (task and script ms per second), the animation frames (rate and the 95th percentile interval), the chirps scheduled
 * per second and the chirps dropped as late (window.__voice.stats()).  The difference on minus off, paired by round, is the voices'
 * own cost; the off rounds still carry the typed-out bubbles.  Every text is synthetic.  The server is stopped by its PID. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms)), ROUNDS = +(ARG.rounds || 4), SECS = +(ARG.seconds || 10), PASS = 'vp-synthetic-admin', DIR = path.resolve(ARG.dir || '.');
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const TAP = `(() => { const S = window.WebSocket; window.WebSocket = function (u, p) { const ws = new S(u, p); if (/\\/ws(\\?|$)/.test(u)) window.__vpg = ws; return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }); })();`;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
(async () => {
  const port = await freePort(), srv = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150 && await get(port, '/index.html') !== 200; i++) await sleep(100);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/post-trial4-chat-voice/tools/voice_perf.js', dir: DIR, rounds: ROUNDS, seconds: SECS, chromium: b.version(), runs: [] };
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), P = await ctx.newPage(), cdp = await ctx.newCDPSession(P);
    await P.addInitScript(TAP);
    await P.goto(`http://127.0.0.1:${port}/?room=vperf${Date.now() % 1e6}`, { waitUntil: 'commit', timeout: 90000 });
    for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
    await P.waitForFunction(() => window.__api && window.__ui && window.__voice, null, { timeout: 60000 });
    await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', 'Perf'); await P.click('#enter');
    await P.waitForFunction(() => __api.started() && window.__net && __net.on, null, { timeout: 60000 }); await sleep(1500);
    await P.evaluate(p => __net.testAuth(p), PASS); await sleep(500); await P.evaluate(() => window.__vpg.send(JSON.stringify({ t: 'a', c: 'freeze', on: true }))); await sleep(1000);
    await P.keyboard.press('Shift');                                     // a key: the voices may play
    // two speakers stood beside the player (their records replace the peers' list for the measurement, as t2_client_perf.js does)
    await P.evaluate(() => { const H = __api.H, real = window.__peerNet; window.__peerNet = () => Object.assign(real(), { peers: [{ id: 9101, x: __api.H.x + 120, y: __api.H.y, d: 0 }, { id: 9102, x: __api.H.x - 140, y: __api.H.y + 40, d: 0 }] });
      const line = n => 'synthetic voice perf line number ' + n + ', still talking on and on';
      let k = 0; const go = () => { for (const id of [9101, 9102]) window.__chat.net({ t: 'heard', id, text: line(++k).slice(0, 60), seq: k, c: '', v: { p: id === 9101 ? 'deep' : 'chime', h: id === 9101 ? -4 : 3, s: 100 } }, { n: 'PERF ' + id }); };
      go(); window.__vpk = setInterval(go, 2500); });
    await cdp.send('Performance.enable');
    for (let r = 0; r < ROUNDS * 2; r++) {
      const on = r % 2 === (Math.floor(r / 2) % 2);                    // on/off, off/on, ...: alternating which goes first
      await P.evaluate(v => window.__voice.set({ on: v }), on); await sleep(1500);
      const s0 = await P.evaluate(() => window.__voice.stats()), m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const iv = await P.evaluate(ms => new Promise(res => { const t = []; const t0 = performance.now(); const f = ts => { t.push(ts); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(t); }; requestAnimationFrame(f); }), SECS * 1000);
      const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])), s1 = await P.evaluate(() => window.__voice.stats());
      const secs = (iv[iv.length - 1] - iv[0]) / 1000 || SECS, gaps = []; for (let i = 1; i < iv.length; i++) gaps.push(iv[i] - iv[i - 1]); gaps.sort((a, c) => a - c);
      const per = k => +(((m1[k] || 0) - (m0[k] || 0)) * 1000 / secs).toFixed(2);
      const row = { round: Math.floor(r / 2), voices: on, fps: +(gaps.length / secs).toFixed(2), p95: gaps.length ? +gaps[Math.floor(.95 * gaps.length)].toFixed(1) : null, taskMsPerS: per('TaskDuration'), scriptMsPerS: per('ScriptDuration'),
        chirpsPerS: +((s1.scheduled - s0.scheduled) / secs).toFixed(2), latePerS: +((s1.late - s0.late) / secs).toFixed(2), ctx: s1.ctx };
      R.runs.push(row); console.log(JSON.stringify(row));
    }
    await P.evaluate(() => clearInterval(window.__vpk));
    const pair = k => { const d = []; for (let r = 0; r < ROUNDS; r++) { const a = R.runs.find(x => x.round === r && x.voices), z = R.runs.find(x => x.round === r && !x.voices); if (a && z) d.push(a[k] - z[k]); } return { on: med(R.runs.filter(x => x.voices).map(x => x[k])), off: med(R.runs.filter(x => !x.voices).map(x => x[k])), pairedDiffMedian: med(d), min: Math.min(...d), max: Math.max(...d) }; };
    R.summary = Object.fromEntries(['fps', 'p95', 'taskMsPerS', 'scriptMsPerS', 'chirpsPerS', 'latePerS'].map(k => [k, pair(k)]));
    console.log(JSON.stringify(R.summary));
    await ctx.close();
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
