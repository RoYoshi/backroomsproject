/* Stage 3H0 - the real server, old code against new code: where does a summoned Hound go in 10 s?  (development only)
 *
 *   node dev/stage-3h0/golden/summon_probe.js [--rounds 12] [--out FILE.json]
 *
 * Why: QA2's probe_q2 has a check whose precondition is that, within 10 s of "near hound", "near smiler" and "summon" around an admin
 * standing in god mode at the spawn point, some monster comes closer than 620 px.  On the final tree it came to 680, 632 and 579 px
 * in three runs; on the parent to 615 and 145 (and QA1 / QA2 earlier: 605, 521, 110).  The AI decides this in a world generated at random
 * for every room, so a few runs say little.  This tool repeats exactly that sequence many times against the real server, without a
 * browser, alternating the parent's server.js and the working tree's (the same files otherwise), and compares the distributions.
 * Each round: a fresh room; an admin joins at (960, 3264), sends its position every 50 ms, removes the monsters and turns god mode on (as
 * the probe's stage step does), then: freeze off, near hound, near smiler, 400 ms, summon; for 10 s the smallest distance of any Hound or
 * Smiler in the snapshots to the spot is recorded.  Processes are stopped by their own PID. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = { rounds: '12', 'old-ref': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b' };
for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), PASS = 'h0-synthetic-admin', SPOT = [960, 3264];
const sleep = ms => new Promise(r => setTimeout(r, ms));
function oldTree() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'h0sum-'));
  for (const n of fs.readdirSync(REPO)) if (!['server.js', 'server', '.git', 'node_modules'].includes(n)) fs.symlinkSync(path.join(REPO, n), path.join(d, n));
  fs.writeFileSync(path.join(d, 'server.js'), execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':server.js'])); return d;
}
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start(dir) {
  const port = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env }); p.out = '';
  p.stdout.on('data', d => { p.out += d; }); p.stderr.on('data', d => { p.out += d; });
  for (let i = 0; i < 200 && !/\n/.test(p.out); i++) await sleep(25); p.port = port; return p;
}
const stop = p => new Promise(r => { if (p.exitCode !== null) return r(); p.once('exit', () => r()); process.kill(p.pid, 'SIGTERM'); });
async function round(port, room) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`); const st = { id: null, last: null, ares: [], min: Infinity, seen: 0 };
  let measuring = false;
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'hi') st.id = m.id; if (m.t === 'ares') st.ares.push(m); if (m.t === 's') { st.last = m;
    if (measuring && m.e) { for (const e of (m.e.h || []).concat(m.e.m || [])) { const d = Math.hypot(e.x - SPOT[0], e.y - SPOT[1]); if (d < st.min) st.min = d; } st.seen++; } } };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = o => ws.send(JSON.stringify(o)), a = o => send(Object.assign({ t: 'a' }, o));
  const tick = setInterval(() => send({ t: 'p', x: SPOT[0], y: SPOT[1], vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'OBSERVER', c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 0, st: 0, ex: 0, sp: 0, ev: [] } }), 50);
  send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300); send({ t: 'join' }); await sleep(1500);
  a({ c: 'freeze', on: 0 });
  for (let i = 0; i < 12; i++) { const e = st.last && st.last.e; if (e && !(e.h || []).length && !(e.m || []).length) break; a({ c: 'hounds', mode: 'remove', n: 10 }); a({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(450); }
  a({ c: 'god', id: st.id }); await sleep(400); a({ c: 'freeze', on: 1 }); await sleep(300);
  a({ c: 'freeze', on: 0 }); a({ c: 'near', k: 'hound' }); a({ c: 'near', k: 'smiler' }); await sleep(400);
  measuring = true; a({ c: 'summon' }); await sleep(10000); measuring = false;
  clearInterval(tick); ws.close(); await sleep(100);
  return { minDistance: Math.round(st.min), snapshotsMeasured: st.seen, answers: st.ares.slice(-4).map(r => r.msg) };
}
const mwu = (a, b) => { const all = a.map(v => [v, 0]).concat(b.map(v => [v, 1])).sort((x, y) => x[0] - y[0]); const n = all.length, rk = new Array(n); let i = 0;
  while (i < n) { let j = i; while (j + 1 < n && all[j + 1][0] === all[i][0]) j++; for (let k = i; k <= j; k++) rk[k] = (i + j) / 2 + 1; i = j + 1; }
  const ra = all.reduce((s, x, k) => s + (x[1] === 0 ? rk[k] : 0), 0), n1 = a.length, n2 = b.length, u = ra - n1 * (n1 + 1) / 2, z = (u - n1 * n2 / 2) / Math.sqrt(n1 * n2 * (n + 1) / 12);
  const erfc = x => { const t = 1 / (1 + .5 * x), r = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (.37409196 + t * (.09678418 + t * (-.18628806 + t * (.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-.82215223 + t * .17087277))))))))); return r; };
  return { U: u, z: +z.toFixed(3), p: +erfc(Math.abs(z) / Math.SQRT2).toFixed(4) }; };
(async () => {
  const oldDir = oldTree(), R = { old: [], new: [] }, N = +ARG.rounds;
  for (let r = 0; r < N; r++) for (const side of (r % 2 ? ['new', 'old'] : ['old', 'new'])) {
    const p = await start(side === 'old' ? oldDir : REPO);
    try { const x = await round(p.port, 'h0sum' + side + r); R[side].push(x); console.log(`${side} ${r + 1}: min ${x.minDistance} px over ${x.snapshotsMeasured} snapshots; ${x.answers.join(' | ')}`); }
    catch (e) { R[side].push({ error: String(e) }); console.log(side, r + 1, 'error', e); }
    await stop(p);
  }
  fs.rmSync(oldDir, { recursive: true, force: true });
  const v = s => R[s].filter(x => x.minDistance !== undefined).map(x => x.minDistance), med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const sum = s => ({ runs: v(s).length, median: med(v(s)), under620: v(s).filter(x => x < 620).length, values: v(s) });
  const rep = { tool: 'dev/stage-3h0/golden/summon_probe.js', rounds: N, spot: SPOT, old: sum('old'), new: sum('new'), mwu: mwu(v('old'), v('new')), raw: R };
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
  console.log(`old: median ${rep.old.median} px, under 620 px in ${rep.old.under620}/${rep.old.runs}; new: median ${rep.new.median} px, under 620 px in ${rep.new.under620}/${rep.new.runs}; Mann-Whitney p = ${rep.mwu.p}`);
})().catch(e => { console.error('SUMMON PROBE ERROR', e && e.stack || e); process.exitCode = 2; });
