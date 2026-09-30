/* Snapshot interpolation (Part 1B): the real client code (mp.js: NET / netHist / netPose, extracted verbatim) against a simulated server stream,
 * compared with the previous client behaviour (chase the newest snapshot with an exponential ease).   node tests/interp_test.js */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(require('../paths.js'), 'mp.js'), 'utf8');
const a = src.indexOf('const NET = {'), b = src.indexOf('window.__netPose');
if (a < 0 || b < 0) { console.log('FAIL: interpolation code not found in mp.js'); process.exit(1); }
let NOW = 0; const performance = { now: () => NOW }, window = {};
const mod = new Function('performance', 'window', src.slice(a, b) + '\nreturn { NET, netHist, netPose };')(performance, window);
function rng(s) { return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
function run(seed, lateEvery) {
  const R = rng(seed), NET = mod.NET; NET.off = null; NET.hist.clear();
  // server truth: 292 px/s, a right-angle turn after 2 s (heading changes over 0.4 s), server clock starts at 100 s
  const truth = t => { const T = 2, v = 292; if (t < T) return { x: v * t, y: 0, a: 0 }; const u = Math.min(1, (t - T) / .4); return { x: v * T + v * .4 * Math.sin(u * Math.PI / 2) * .64, y: v * (t - T) * (u < 1 ? u * .5 : 1) + (u >= 1 ? -v * .2 : 0), a: u * Math.PI / 2 }; };
  const packets = [];
  for (let k = 0; k * .05 <= 5; k++) { const st = 100 + k * .05, lat = .06 + R() * .04 + (lateEvery && k % lateEvery === 0 ? .1 : 0); const p = truth(k * .05); packets.push({ at: (k * .05 + lat) * 1000, e: { st, h: [{ i: 1, x: p.x, y: p.y, a: p.a }], m: [] } }); }
  packets.sort((p, q) => p.at - q.at);
  let pi = 0, newest = null; const o = { x: 0, y: 0, a: 0 }; const outNew = [], outOld = [];
  for (let f = 0; f * (1000 / 60) < 5000; f++) {
    NOW = f * (1000 / 60);
    while (pi < packets.length && packets[pi].at <= NOW) { mod.netHist(packets[pi].e, packets[pi].at); newest = packets[pi].e.h[0]; pi++; }
    const ip = mod.netPose('h1'); if (ip) outNew.push([NOW, ip.x, ip.y, ip.a]);
    if (newest) { const k = 1 - Math.exp(-(1 / 60) * 15); o.x += (newest.x - o.x) * k; o.y += (newest.y - o.y) * k; o.a += (newest.a - o.a) * (1 - Math.exp(-(1 / 60) * 14)); outOld.push([NOW, o.x, o.y, o.a]); }
  }
  const stats = out => {
    const sp = []; for (let i = 1; i < out.length; i++) sp.push(Math.hypot(out[i][1] - out[i - 1][1], out[i][2] - out[i - 1][2]) * 60);
    const run = sp.slice(20, 110);                                           // the straight run at constant speed (0.33 - 1.8 s)
    const m = run.reduce((x, y) => x + y, 0) / run.length, sd = Math.sqrt(run.reduce((x, y) => x + (y - m) ** 2, 0) / run.length);
    let turnPop = 0; for (let i = 1; i < out.length; i++) turnPop = Math.max(turnPop, Math.abs(out[i][3] - out[i - 1][3]));
    return { meanSpeed: Math.round(m), cv: +(sd / m).toFixed(3), maxStep: +(Math.max(...sp) / 60).toFixed(1), maxTurnPerFrame: +turnPop.toFixed(3) };
  };
  return { newer: stats(outNew), older: stats(outOld) };
}
const cases = [['steady packets, 60-100 ms latency with jitter', 0], ['plus a 100 ms late packet every 10th', 10]];
let ok = true;
for (const [name, late] of cases) {
  const r = [1, 2, 3].map(s => run(s, late)), avgOf = (k, f) => +(r.reduce((x, y) => x + y[k][f], 0) / r.length).toFixed(3);
  const n = { cv: avgOf('newer', 'cv'), maxStep: Math.max(...r.map(x => x.newer.maxStep)), turn: Math.max(...r.map(x => x.newer.maxTurnPerFrame)), speed: avgOf('newer', 'meanSpeed') };
  const o = { cv: avgOf('older', 'cv'), maxStep: Math.max(...r.map(x => x.older.maxStep)), turn: Math.max(...r.map(x => x.older.maxTurnPerFrame)), speed: avgOf('older', 'meanSpeed') };
  const pass = n.cv < .15 && n.cv < o.cv * .5 && n.maxStep < 9 && Math.abs(n.speed - 292) < 20;
  ok = ok && pass;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + `: drawn speed varies ${(n.cv * 100).toFixed(1)} % frame to frame (was ${(o.cv * 100).toFixed(1)} %), mean ${n.speed} px/s (true 292; was ${o.speed}), biggest single-frame move ${n.maxStep} px (was ${o.maxStep}), biggest facing change per frame ${n.turn} rad (was ${o.turn})`);
}
/* a new world (audit fix): the room is thrown away and made again - its clock starts near 0 and it reuses entity id 1.  The client must draw the
 * new world at once, not stay frozen on the old one's last pose.  Stepping the same stream through code given as `code` (the fixed mp.js, or an
 * older one passed with OLD_MP=path) shows the difference. */
function newWorld(code, gapMs) {
  const a2 = code.indexOf('const NET = {'), b2 = code.indexOf('window.__netPose');
  const M = new Function('performance', 'window', code.slice(a2, b2) + '\nreturn { NET, netHist, netPose };')(performance, window);
  NOW = 0; let at = 0;
  for (let k = 0; k <= 40; k++) { at = k * 50; NOW = at; M.netHist({ st: 60 + k * .05, h: [{ i: 1, x: 5000, y: 3000, a: 0 }] }, at); }         // old world: h1 standing at x 5000
  const t0 = at + gapMs; let firstNear = -1; const ep0 = M.NET.epoch;
  for (let k = 0; k <= 40; k++) {
    at = t0 + k * 50; M.netHist({ st: 1 + k * .05, h: [{ i: 1, x: 1000 + k * 14, y: 1200, a: 0 }] }, at);                                       // new world: h1 near x 1000, walking
    for (let f = 0; f < 3; f++) { NOW = at + f * 16.7; const q = M.netPose('h1'); if (firstNear < 0 && q && Math.abs(q.x - 1000) < 700) firstNear = NOW - t0; }
  }
  NOW = at; const last = M.netPose('h1');
  return { firstNear, lastX: last ? Math.round(last.x) : null, epochs: M.NET.epoch !== undefined ? M.NET.epoch - ep0 : null };
}
/* ordinary jitter and a repeated / reordered snapshot never reset anything */
function jitterKeeps(code) {
  const a2 = code.indexOf('const NET = {'), b2 = code.indexOf('window.__netPose');
  const M = new Function('performance', 'window', code.slice(a2, b2) + '\nreturn { NET, netHist, netPose };')(performance, window);
  const R = rng(7); let resets = 0, ep = M.NET.epoch;
  for (let k = 0; k < 200; k++) { const st = 100 + k * .05; NOW = k * 50 + R() * 90; M.netHist({ st: k % 17 === 5 ? st - .05 : st, h: [{ i: 1, x: k * 14, y: 0, a: 0 }] }, NOW); if (M.NET.epoch !== ep) { resets++; ep = M.NET.epoch; } }
  return { resets, hist: M.NET.hist.get('h1').length };
}
{
  const nw = newWorld(src, 400), jk = jitterKeeps(src);
  const pass = nw.firstNear >= 0 && nw.firstNear < 250 && Math.abs(nw.lastX - 1560) < 120 && nw.epochs === 1 && jk.resets === 0 && jk.hist >= 6;
  ok = ok && pass;
  let old = '';
  if (process.env.OLD_MP) { const o = newWorld(fs.readFileSync(process.env.OLD_MP, 'utf8'), 400); old = ` (the code in ${path.basename(process.env.OLD_MP)}: ${o.firstNear < 0 ? 'never' : Math.round(o.firstNear) + ' ms'}, still drawn at x ${o.lastX} after 2 s)`; }
  console.log((pass ? 'PASS ' : 'FAIL ') + `new world with a lower clock and a reused id: drawn in the new world ${Math.round(nw.firstNear)} ms after its first snapshot, at x ${nw.lastX} after 2 s (new world truth 1560), timeline resets ${nw.epochs}${old}; 200 jittered / reordered snapshots in one world: resets ${jk.resets}, history kept (${jk.hist} samples)`);
}
console.log(ok ? 'interpolation checks passed' : 'SOME FAILED'); process.exitCode = ok ? 0 : 1;
