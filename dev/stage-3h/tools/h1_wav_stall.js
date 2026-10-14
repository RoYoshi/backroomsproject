/* Stage 3H1 - does the first gzip of the menu-theme WAVs pause the server? (development only; runs a copy of the game, changes nothing)
 *
 *   node dev/stage-3h/tools/h1_wav_stall.js --game DIR [--port 8631] [--out FILE.json]
 *
 * DIR is an export of the game (e.g. `git archive 143b63f`), never the repository: the server is started there, from its own server.js,
 * with a synthetic admin passcode it never uses.  A WebSocket client joins nothing and only listens: the server sends every client in a
 * room a snapshot ('s') every 50 ms, so the gaps between them show the server's event loop.  The tool records the gaps for 3 s, then asks
 * for each of the two menu WAVs with Accept-Encoding: gzip (server/static.js compresses a file synchronously, at level 9, the first time
 * it is asked for, and keeps the result), then asks for both again (now served from the cache), recording the gaps all along and each
 * response's time and size.  It also times zlib.gzipSync on the same bytes in this process, for comparison.  Exit 0 when it measured. */
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const ARG = { port: '8631' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game), PORT = +ARG.port, WAVS = ['assets/MainTheme_MenuIntro.wav', 'assets/MainTheme_MenuLoop.wav'];
if (fs.existsSync(path.join(GAME, '.git'))) { console.error('give an export of the game, not a repository'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const get = p => new Promise((res, rej) => {
  const t0 = now();
  http.get({ host: '127.0.0.1', port: PORT, path: '/' + p, headers: { 'accept-encoding': 'gzip' } }, r => { let n = 0; r.on('data', c => { n += c.length; }); r.on('end', () => res({ path: p, status: r.statusCode, type: r.headers['content-type'], encoding: r.headers['content-encoding'] || null, cache: r.headers['cache-control'], bytes: n, ms: +(now() - t0).toFixed(1) })); }).on('error', rej);
});
(async () => {
  const srv = spawn(process.execPath, ['server.js', String(PORT)], { cwd: GAME, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 'h1-synthetic-unused' }), stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    for (let i = 0; i < 50; i++) { try { await get('index.html'); break; } catch (e) { await sleep(100); } }
    const gaps = [], marks = []; let last = null;
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=h1stall`);
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.t !== 's') return; const t = now(); if (last !== null) gaps.push([+(t - last).toFixed(1), marks.length]); last = t; };
    await new Promise(r => { ws.onopen = r; });
    const phase = name => marks.push(name);
    phase('idle'); await sleep(3000);
    const first = []; for (const w of WAVS) { phase('first ' + w); first.push(await get(w)); await sleep(500); }
    const again = []; for (const w of WAVS) { phase('again ' + w); again.push(await get(w)); await sleep(500); }
    phase('idle after'); await sleep(1500);
    ws.close();
    const by = {}; for (const [g, k] of gaps) (by[marks[k - 1]] = by[marks[k - 1]] || []).push(g);
    const stat = a => { const s = a.slice().sort((x, y) => x - y); return { n: s.length, median: s[Math.floor(s.length / 2)], max: s[s.length - 1] }; };
    const local = WAVS.map(w => { const b = fs.readFileSync(path.join(GAME, w)), t0 = now(), z = zlib.gzipSync(b, { level: 9 }); return { path: w, bytes: b.length, gzBytes: z.length, gzipSyncMs: +(now() - t0).toFixed(1) }; });
    const R = { tool: 'dev/stage-3h/tools/h1_wav_stall.js', node: process.version, snapshotGapsMs: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, stat(v)])), first, again, localGzipSync: local };
    if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
    console.log(JSON.stringify(R.snapshotGapsMs)); console.log(JSON.stringify(first)); console.log(JSON.stringify(again)); console.log(JSON.stringify(local));
  } finally { srv.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
