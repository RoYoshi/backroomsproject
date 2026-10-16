#!/usr/bin/env node
/* dev/post-3h-trials/tools/t2_client_perf.js - post-3H Trial 2: what the nearby speech costs a page in a run (development only; a
 * checkpoint measurement, not a gate step).
 *
 *   node dev/post-3h-trials/tools/t2_client_perf.js --old-dir DIR --new-dir DIR [--rounds 4] [--seconds 10] [--out FILE.json]
 *
 * DIR: complete game folders (the accepted Trial 1 checkpoint as the old side; the candidate as the new), each served by its own
 * `node server.js PORT` (a synthetic admin passcode).  Each round opens one page a side at 1280 x 720, in an order that alternates,
 * enters a run, freezes the world (the admin tools) and, with no input, measures for --seconds seconds: the animation frames (rate,
 * median, 95th and 99th percentile interval) and the main thread from Chromium's own counters (task, script, style, layout ms per
 * second).  On the new side it then measures the chat's own per-frame hook, window.__chatFrame (timed by wrapping it from this tool):
 *   idle      no bubble (the hook's early return)
 *   one       the player's own bubble, kept alive (a synthetic 'heard' given to window.__chat every 2.5 s)
 *   nine      the own bubble and eight others: eight peers stood around the player by replacing window.__peerNet (a test accessor) for
 *             the measurement, half of them off screen (edge hints), each kept alive the same way
 * Headless Chromium with SwiftShader: frame rates are low and noisy here; the old/new pairs, alternating, are the comparison.  Every
 * text is synthetic.  Servers are stopped by their PIDs. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms)), ROUNDS = +(ARG.rounds || 4), SECS = +(ARG.seconds || 10), PASS = 't2-synthetic-admin';
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(dir) { const port = await freePort(); const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); } throw new Error('no server in ' + dir); }
const TAP = `(() => { const S = window.WebSocket; window.WebSocket = function (u, p) { const ws = new S(u, p); if (/\\/ws\\?/.test(u)) window.__t2g = ws; return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }); })();`;
async function frames(P, cdp) {
  await cdp.send('Performance.enable');
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const iv = await P.evaluate(ms => new Promise(r => { const t = []; const t0 = performance.now(); const f = ts => { t.push(ts); if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(t); }; requestAnimationFrame(f); }), SECS * 1000);
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const gaps = []; for (let i = 1; i < iv.length; i++) gaps.push(iv[i] - iv[i - 1]); gaps.sort((a, c) => a - c);
  const q = f => gaps.length ? +gaps[Math.min(gaps.length - 1, Math.floor(f * gaps.length))].toFixed(2) : null, secs = (iv[iv.length - 1] - iv[0]) / 1000 || SECS;
  const per = k => +(((m1[k] || 0) - (m0[k] || 0)) * 1000 / secs).toFixed(3);
  return { fps: +(gaps.length / secs).toFixed(2), p50: q(.5), p95: q(.95), p99: q(.99), taskMsPerS: per('TaskDuration'), scriptMsPerS: per('ScriptDuration'), styleMsPerS: per('RecalcStyleDuration'), layoutMsPerS: per('LayoutDuration') };
}
async function page(b, port, isNew) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), P = await ctx.newPage(), cdp = await ctx.newCDPSession(P);
  await P.addInitScript(TAP);
  await P.goto(`http://127.0.0.1:${port}/?room=t2perf${Date.now() % 1e6}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', 'Perf'); await P.click('#enter');
  await P.waitForFunction(() => __api.started() && window.__net && __net.on, null, { timeout: 60000 }); await sleep(1500);
  await P.evaluate(p => { __net.testAuth(p); }, PASS); await sleep(500); await P.evaluate(() => window.__t2g.send(JSON.stringify({ t: 'a', c: 'freeze', on: true }))); await sleep(1500);
  return { ctx, P, cdp };
}
const HOOK = `(() => { if (window.__t2perf) return; const f = window.__chatFrame, T = window.__t2perf = { calls: 0, ms: 0 };
  window.__chatFrame = a => { const t0 = performance.now(); try { return f(a); } finally { T.calls++; T.ms += performance.now() - t0; } }; })()`;
async function hookCost(P, mode) {
  await P.evaluate(HOOK);
  await P.evaluate(mode => {
    clearInterval(window.__t2keep); const me = __api.H.id, H = __api.H;
    const peers = mode === 'nine' ? Array.from({ length: 8 }, (_, i) => ({ id: 9000 + i, x: H.x + Math.cos(i * Math.PI / 4) * (i % 2 ? 520 : 160), y: H.y + Math.sin(i * Math.PI / 4) * (i % 2 ? 520 : 160), d: 0 })) : [];
    if (mode === 'nine') { const real = window.__peerNet; window.__t2realPeerNet = real; window.__peerNet = () => Object.assign(real(), { peers: peers.map(p => Object.assign({}, p, { x: __api.H.x + (p.x - H.x), y: __api.H.y + (p.y - H.y) })) }); }
    const say = () => { if (mode === 'idle') return; window.__chat.net({ t: 'heard', id: me, text: 'synthetic perf line, own', seq: 0 }, null);
      for (const p of peers) window.__chat.net({ t: 'heard', id: p.id, text: 'synthetic perf line ' + p.id, seq: 0 }, { n: 'PERF ' + p.id }); };
    say(); window.__t2keep = setInterval(say, 2500);
  }, mode);
  await sleep(1000);
  const a = await P.evaluate(() => Object.assign({}, window.__t2perf)), t0 = Date.now(); await sleep(SECS * 1000);
  const b = await P.evaluate(() => Object.assign({ bubbles: window.__chat.state().nearby.bubbles.length, hints: window.__chat.state().nearby.bubbles.filter(x => x.mode === 'bb-hint').length }, window.__t2perf));
  await P.evaluate(() => { clearInterval(window.__t2keep); if (window.__t2realPeerNet) { window.__peerNet = window.__t2realPeerNet; delete window.__t2realPeerNet; } });
  await sleep(5500);                                                    // the bubbles end
  const secs = (Date.now() - t0) / 1000 - 5.5, calls = b.calls - a.calls;
  return { mode, bubbles: b.bubbles, hints: b.hints, calls, msPerS: +((b.ms - a.ms) / (SECS)).toFixed(4), msPerCall: calls ? +((b.ms - a.ms) / calls).toFixed(4) : 0 };
}
const med = a => { const s = a.filter(x => x !== null).slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
(async () => {
  const OLD = path.resolve(ARG['old-dir']), NEW = path.resolve(ARG['new-dir']);
  const R = { tool: 'dev/post-3h-trials/tools/t2_client_perf.js', old: OLD, new: NEW, rounds: ROUNDS, seconds: SECS, runs: [], hook: [] };
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); R.chromium = b.version();
  const so = await serve(OLD), sn = await serve(NEW);
  try {
    for (let r = 0; r < ROUNDS; r++) {
      const order = r % 2 ? ['new', 'old'] : ['old', 'new'], row = { round: r, order: order.join(' then ') };
      for (const side of order) { const s = await page(b, side === 'old' ? so.port : sn.port, side === 'new'); try { row[side] = await frames(s.P, s.cdp); if (side === 'new') for (const m of ['idle', 'one', 'nine']) R.hook.push(Object.assign({ round: r }, await hookCost(s.P, m))); } finally { await s.ctx.close(); } }
      R.runs.push(row); console.log(JSON.stringify(row));
    }
    R.summary = {};
    for (const k of ['fps', 'p50', 'p95', 'p99', 'taskMsPerS', 'scriptMsPerS', 'styleMsPerS', 'layoutMsPerS']) { const d = R.runs.map(x => x.new[k] - x.old[k]); R.summary[k] = { old: med(R.runs.map(x => x.old[k])), new: med(R.runs.map(x => x.new[k])), pairedDiffMedian: med(d), min: Math.min(...d), max: Math.max(...d) }; }
    R.hookSummary = {}; for (const m of ['idle', 'one', 'nine']) { const h = R.hook.filter(x => x.mode === m); R.hookSummary[m] = { bubbles: med(h.map(x => x.bubbles)), hints: med(h.map(x => x.hints)), msPerS: med(h.map(x => x.msPerS)), msPerCall: med(h.map(x => x.msPerCall)) }; }
    console.log(JSON.stringify(R.summary)); console.log(JSON.stringify(R.hookSummary));
  } finally { try { process.kill(so.p.pid); } catch (e) { } try { process.kill(sn.p.pid); } catch (e) { } await b.close(); }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
