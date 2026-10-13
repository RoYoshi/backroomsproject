/* Stage 3D HQ2 - pages that predict, on a real server, with lag (development only)
 *
 *   node dev/stage-3d-hq2/net_predict.js --game DIR --scenario NAME[,NAME...] --out FILE.json
 *
 * Each "page" here is what a browser tab is to the server, without the drawing: the game's own move.js (loaded as dev/move_model.js does,
 * the level from sim.js / world.js) stepped at the fixed 60 Hz through timing_policy.consume, its position sent 20 times a second in whole
 * pixels as mp.js sends it, and mp.js's own handling of what comes back: the other living players (alive, not held) as
 * window.__peerBodies from every snapshot, a soft correction (tp pc:1) blended in over 120 ms, any other tp a jump.  Every page is an
 * ORDINARY player.  --lag: each page's traffic waits that many milliseconds each way (so the round trip is twice it).
 * Recorded: the server's positions (a quiet admin's snapshots, or - with eight players, a full room - two pages' own snapshots, which
 * between them hold every pair), every correction each page got, and where each page itself thought it was.
 *   c09_head    a page sprints into a standing one in the one-tile corridor, at 0, 60 and 150 ms each way
 *   c09_pass    the standing one stands aside (30 px off the line); the runner slides past his shoulder, at 0 and 150 ms
 *   c10_two     two pages sprint at each other in the corridor, at 0, 60 and 150 ms each way
 *   c10_crowd8  eight pages (a full room) walk into one point on open floor and back out, 40 ms each way
 * Checks (exit 1 if any fails): never closer than D on the server (whole-px snapshots: >= 35.29); nobody through anybody; a standing
 * player is never corrected and never moved; corrections are soft only, at most one per 0.3 s, and with a standing target none at all;
 * each page ends where the server has it (within 2 px). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), net = require('net'), { spawn } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || '.'), PASS = 'd3-synthetic-admin';
const createSim = require(path.join(GAME, 'sim.js')), WORLD = require(path.join(GAME, 'world.js')), timing = require(path.join(GAME, 'timing_policy.js'));
const SRC = new vm.Script(fs.readFileSync(path.join(GAME, 'move.js'), 'utf8'), { filename: 'move.js' });
const level = createSim({ seed: 5 });
const sleep = ms => new Promise(r => setTimeout(r, ms)), now = () => Date.now();
const DMIN = 36 - Math.SQRT1_2, CORR = { y: 720, x0: 812, xb: 1012 }, HALL = { x: 4450, y: 3450 };
const r1 = v => Math.round(v * 10) / 10;
let PORT;

function freePort() { return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
async function startServer(log) {
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL;
  const p = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) return p; await sleep(100); }
  return p;
}
/* a quiet admin: removes the monsters, records the server's view of everyone (s.p, 20 Hz) */
class Watch {
  constructor(room) { this.log = []; this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`); this.open = new Promise(r => this.ws.onopen = r);
    this.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 's') this.log.push({ t: now(), p: (m.p || []).map(p => [p.id, p.x, p.y, p.d]) }); }; }
  tx(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  async auth() { await this.open; this.tx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(250); }
  async clear() { for (let i = 0; i < 6; i++) this.tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) this.tx({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(250); }
  close() { try { this.ws.close(); } catch (e) { } }
}
/* a page: move.js + mp.js's handling of the wire, with lag */
class Page {
  constructor(room, name, lag) {
    this.name = name; this.lag = lag; this.id = null; this.tps = []; this.view = []; this.track = []; this.peers = []; this.input = () => [0, 0, 0, 0];
    const H = this.H = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, distance: 0, stamina: 100, sprinting: false, exhausted: false, equipment: { kind: 'flashlight' } };
    const api = { H, keys: new Set(), Bc: (x, y) => level.blockersAt(x, y), Oc: level.adapter.rooms };
    this.win = { WORLD, __api: api, __peerBodies: this.peers }; this.clock = 0;
    SRC.runInContext(vm.createContext({ window: this.win, performance: { now: () => this.clock * 1000 }, Math, console, document: { getElementById: () => null } }));
    this.mv = this.win.__mv; this.blend = null; this.solid = false;
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`); this.open = new Promise(r => this.ws.onopen = r);
    this.ws.onmessage = ev => { const d = ev.data; if (this.lag) setTimeout(() => this.rx(d), this.lag); else this.rx(d); };
  }
  tx(o) { const s = JSON.stringify(o); const go = () => { if (this.ws.readyState === 1) this.ws.send(s); }; if (this.lag) setTimeout(go, this.lag); else go(); }
  rx(d) {
    let m; try { m = JSON.parse(d); } catch (e) { return; }
    if (m.t === 'hi') this.id = m.id;
    else if (m.t === 'tp') {
      this.tps.push({ t: now(), x: m.x, y: m.y, pc: m.pc | 0 });
      const dx = m.x - this.H.x, dy = m.y - this.H.y;
      if (m.pc && Math.hypot(dx, dy) <= 96) this.blend = { dx, dy, t0: now(), done: 0 };           // (mp.js softTp)
      else { this.blend = null; this.H.x = m.x; this.H.y = m.y; this.H.vx = this.H.vy = 0; }
    } else if (m.t === 's') {
      const held = new Set(); if (m.e) for (const k of ['h', 'm']) for (const e of m.e[k] || []) if (e && e.cp) held.add(e.cp);
      this.peers.length = 0; if (this.solid && !m.me && !m.cp) for (const p of m.p) if (!p.d && !held.has(p.id)) this.peers.push([p.x, p.y]);   // (mp.js solidPeers)
      this.view.push({ t: now(), p: m.p.map(p => [p.id, p.x, p.y, p.d]) });
    }
  }
  async join(x, y) { await this.open; for (let i = 0; i < 40 && this.id == null; i++) await sleep(25); this.tx({ t: 'join' }); await sleep(150 + 2 * this.lag); this.H.x = x; this.H.y = y; this.send(); this.solid = true; await sleep(150 + 2 * this.lag); }
  send() { this.tx({ t: 'p', x: Math.round(this.H.x), y: Math.round(this.H.y), vx: Math.round(this.H.vx), vy: Math.round(this.H.vy), a: 0, r: 0, l: 1, k: 'flashlight', n: this.name, c: '#ffe7b2', f: -1 }); }
  step(dt) {                                                               // one fixed step: move.js, then mp.js's tick (the blend)
    const inp = this.input(this.H); this.clock += dt;
    if (!!inp[3] !== this.mv.crouch && !this.mv.zone) this.mv.crouch = !!inp[3];
    this.mv.step(inp[0], inp[1], !!inp[2], dt);
    const b = this.blend; if (b) { const k = Math.min(1, (now() - b.t0) / 120), s = k - b.done; b.done = k; this.H.x += b.dx * s; this.H.y += b.dy * s;
      const L = Math.hypot(b.dx, b.dy); if (L > 0) { const ux = b.dx / L, uy = b.dy / L, vn = this.H.vx * ux + this.H.vy * uy; if (vn < 0) { this.H.vx -= vn * ux; this.H.vy -= vn * uy; } } if (k >= 1) this.blend = null; }
  }
  close() { try { this.ws.close(); } catch (e) { } }
}
/* the pages' loop: frame times as they come (a 4 ms timer), fixed 60 Hz steps (timing.consume), a position every 50 ms */
async function runPages(pages, ms) {
  const t0 = now(); let last = performance.now(), acc = 0, lastSend = 0;
  while (now() - t0 < ms) {
    await sleep(4); const n = performance.now(), fdt = (n - last) / 1000; last = n;
    acc = timing.consume(acc, fdt, dt => { for (const p of pages) p.step(dt); }).accumulator;
    for (const p of pages) p.track.push([now(), p.H.x, p.H.y]);
    if (n - lastSend >= 50) { lastSend = n; for (const p of pages) p.send(); }
  }
}
const toward = (gx, gy, run) => H => { const dx = gx - H.x, dy = gy - H.y, d = Math.hypot(dx, dy); return d < 2 ? [0, 0, 0, 0] : [dx / d, dy / d, run, 0]; };
function minPairs(logs, ids, t0, t1) {                                    // the closest any two of ids came, over every snapshot of every log
  let m = Infinity, n = 0;
  for (const log of logs) for (const s of log) { if (s.t < t0 || s.t > t1) continue; n++; const ps = s.p.filter(p => ids.includes(p[0]) && !p[3]);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) m = Math.min(m, Math.hypot(ps[i][1] - ps[j][1], ps[i][2] - ps[j][2])); }
  return { min: m === Infinity ? null : r1(m), snapshots: n };
}
const lastPos = (log, id) => { for (let i = log.length - 1; i >= 0; i--) { const p = log[i].p.find(q => q[0] === id); if (p) return p; } return null; };
const corrInfo = pg => { const g = pg.tps.slice(1).map((q, i) => q.t - pg.tps[i].t); return { n: pg.tps.length, soft: pg.tps.filter(q => q.pc).length, minGapMs: g.length ? Math.min(...g) : null }; };
function setup(out) { out.checks = []; return (name, ok, info) => out.checks.push({ name, ok: !!ok, info }); }

async function c09_head(lag) {
  const room = 'np_head' + lag, W = new Watch(room); await W.auth(); await W.clear();
  const B = new Page(room, 'BOB', lag), A = new Page(room, 'ALICE', lag);
  await B.join(CORR.xb, CORR.y); await W.clear(); await A.join(CORR.x0, CORR.y); await W.clear();
  const out = { lag }, check = setup(out), t0 = now(); A.tps.length = 0; B.tps.length = 0;
  A.input = toward(1400, CORR.y, 1);
  await runPages([A, B], 3500 + 2 * lag); await runPages([A, B], 400 + 2 * lag);
  const m = minPairs([W.log], [A.id, B.id], t0, now()), a = lastPos(W.log, A.id), b = lastPos(W.log, B.id);
  out.server = { min: m, alice: a, bob: b }; out.alice = { corrections: corrInfo(A), page: [r1(A.H.x), r1(A.H.y)], pageMinToBob: r1(Math.min(...A.track.filter(r => r[0] >= t0).map(r => Math.hypot(r[1] - CORR.xb, r[2] - CORR.y)))) }; out.bob = { corrections: corrInfo(B) };
  check(`C09 head-on into a standing player, ${lag} ms each way: never closer than D on the server; stopped at contact on her side`, m.min >= DMIN && a && b && a[1] < b[1] && Math.hypot(a[1] - b[1], a[2] - b[2]) <= 38, out.server);
  check(`C09 ...her own page predicted it: never closer than D on her screen either, and no correction at all (he stands still: she knows exactly where he is)`, out.alice.pageMinToBob >= 36 && A.tps.length === 0, out.alice);
  check(`C09 ...he was never moved or corrected, and her page ends where the server has her (what it sends, within 2 px)`, B.tps.length === 0 && b[1] === CORR.xb && b[2] === CORR.y && Math.hypot(Math.round(A.H.x) - a[1], Math.round(A.H.y) - a[2]) <= 2, { bob: b, alicePage: out.alice.page, aliceServer: a });
  A.close(); B.close(); W.close(); return out;
}
async function c09_pass(lag) {
  const room = 'np_pass' + lag, W = new Watch(room); await W.auth(); await W.clear();
  const B = new Page(room, 'BOB', lag), A = new Page(room, 'ALICE', lag);
  await B.join(CORR.xb, CORR.y); await W.clear(); await A.join(CORR.x0, CORR.y); await W.clear();
  B.input = toward(CORR.xb, CORR.y - 30, 0); await runPages([A, B], 700 + 2 * lag); B.input = () => [0, 0, 0, 0]; await runPages([A, B], 200 + 2 * lag);   // (a spawn spot needs 20 px from the walls: he steps aside after joining)
  const out = { lag }, check = setup(out), t0 = now(), b0 = lastPos(W.log, B.id); A.tps.length = 0; B.tps.length = 0;
  A.input = H => [1, (CORR.y - H.y) * .02, 1, 0];
  await runPages([A, B], 2600 + 2 * lag); await runPages([A, B], 300 + 2 * lag);
  const m = minPairs([W.log], [A.id, B.id], t0, now()), a = lastPos(W.log, A.id), b = lastPos(W.log, B.id);
  const bobMoved = W.log.filter(q => q.t >= t0).some(q => { const z = q.p.find(r => r[0] === B.id); return z && (z[1] !== b0[1] || z[2] !== b0[2]); });
  out.server = { min: m, alice: a, bobBefore: b0, bob: b, bobMoved }; out.alice = { corrections: corrInfo(A), page: [r1(A.H.x), r1(A.H.y)] };
  check(`C09 he stands aside (about 30 px off her line), ${lag} ms each way: her page slides her past his shoulder and on, never closer than D; no correction; he is not moved`, m.min >= DMIN && a && a[1] > CORR.xb + 150 && A.tps.length === 0 && B.tps.length === 0 && !bobMoved && Math.abs(b0[2] - (CORR.y - 30)) <= 2, Object.assign({}, out.server, { aliceCorrections: corrInfo(A) }));
  A.close(); B.close(); W.close(); return out;
}
async function c10_two(lag) {
  const room = 'np_two' + lag, W = new Watch(room); await W.auth(); await W.clear();
  const A = new Page(room, 'ALICE', lag), B = new Page(room, 'BOB', lag);
  await A.join(CORR.x0, CORR.y); await W.clear(); await B.join(CORR.x0 + 400, CORR.y); await W.clear();
  const out = { lag }, check = setup(out), t0 = now(); A.tps.length = 0; B.tps.length = 0;
  A.input = toward(CORR.x0 + 600, CORR.y, 1); B.input = toward(CORR.x0 - 200, CORR.y, 1);
  await runPages([A, B], 3000 + 2 * lag); A.input = B.input = () => [0, 0, 0, 0]; await runPages([A, B], 800 + 2 * lag);
  const m = minPairs([W.log], [A.id, B.id], t0, now()), a = lastPos(W.log, A.id), b = lastPos(W.log, B.id), ca = corrInfo(A), cb = corrInfo(B);
  const order = W.log.filter(q => q.t >= t0).every(q => { const x = q.p.find(r => r[0] === A.id), y = q.p.find(r => r[0] === B.id); return !x || !y || x[1] < y[1]; });
  const screen = (P, other) => {                                          // on this page's own screen: itself, and the other where its last snapshot put him
    let mn = Infinity, past = false, below = 0, prevT = null, endD = null; for (const r of P.track) { if (r[0] < t0) continue; let v = null; for (const q of P.view) { if (q.t > r[0]) break; v = q; } const o = v && v.p.find(z => z[0] === other); if (!o) continue;
      const d = Math.hypot(r[1] - o[1], r[2] - o[2]); mn = Math.min(mn, d); endD = d; if (d < 30 && prevT != null) below += r[0] - prevT; prevT = r[0]; if (P === A ? r[1] > o[1] : r[1] < o[1]) past = true; }
    return { min: r1(mn), msCloserThan30: below, pastHimForAMoment: past, atTheEnd: r1(endD) };
  };
  const trueGap = Math.min(...A.track.filter(r => r[0] >= t0).map(r => { const q = B.track.find(z => z[0] >= r[0]); return q ? Math.hypot(r[1] - q[1], r[2] - q[2]) : Infinity; }));
  out.server = { min: m, alice: a, bob: b, alwaysInOrder: order }; out.corrections = { alice: ca, bob: cb }; out.pages = { alice: [r1(A.H.x), r1(A.H.y)], bob: [r1(B.H.x), r1(B.H.y)] };
  out.screens = { alice: screen(A, B.id), bob: screen(B, A.id), closestThePagesThemselvesCame: r1(trueGap) };
  check(`C10 two pages sprinting at each other, ${lag} ms each way (each sees the other at least ${2 * lag} ms late): never closer than D on the server, and in every snapshot neither past the other`, m.min >= DMIN && order && a[1] < b[1], out.server);
  check(`C10 ...on each page's own screen they are apart again once they stand (>= 33 px: D less the server's silent 2 px and the whole-pixel rounding; while both run the other is drawn up to ${2 * lag} ms + a snapshot late, so they may overlap for a moment: measured)`, [out.screens.alice, out.screens.bob].every(q => q.atTheEnd >= 33), out.screens);
  check(`C10 ...any correction is soft (blended), at most one per 0.3 s each`, [ca, cb].every(c => c.soft === c.n && (c.minGapMs == null || c.minGapMs >= 290)), out.corrections);
  check(`C10 ...and once they stand, each page is where the server has it (what it sends, within 2 px)`, Math.hypot(Math.round(A.H.x) - a[1], Math.round(A.H.y) - a[2]) <= 2 && Math.hypot(Math.round(B.H.x) - b[1], Math.round(B.H.y) - b[2]) <= 2, { pages: out.pages, server: [a, b] });
  A.close(); B.close(); W.close(); return out;
}
async function c10_crowd8(lag) {
  const room = 'np_crowd8', W = new Watch(room); await W.auth(); await W.clear();
  const N = 8, P = [], home = [];
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + .2; home.push([Math.round(HALL.x + Math.cos(a) * 150), Math.round(HALL.y + Math.sin(a) * 150)]); }
  for (let i = 0; i < 7; i++) { const p = new Page(room, 'P' + i, lag); P.push(p); await p.join(home[i][0], home[i][1]); await W.clear(); }
  W.close(); await sleep(400);                                             // (a full room is eight: the watcher makes way for the eighth page)
  const p8 = new Page(room, 'P7', lag); P.push(p8); await p8.join(home[7][0], home[7][1]);
  const out = { lag, players: N }, check = setup(out); for (const p of P) p.tps.length = 0;
  const t0 = now();
  for (const p of P) p.input = toward(HALL.x, HALL.y, 0);
  await runPages(P, 4000);
  const t1 = now(); for (let i = 0; i < N; i++) P[i].input = toward(home[i][0], home[i][1], 0);
  await runPages(P, 2500); for (const p of P) p.input = () => [0, 0, 0, 0]; await runPages(P, 500 + 2 * lag);
  const ids = P.map(p => p.id), m = minPairs([P[0].view, P[1].view], ids, t0, now());
  const cs = P.map(corrInfo), off = P.map((p, i) => r1(Math.hypot(p.H.x - home[i][0], p.H.y - home[i][1])));
  const atPoint = P.map(p => { const tr = p.track.filter(r => r[0] <= t1); const e = tr[tr.length - 1]; return r1(Math.hypot(e[1] - HALL.x, e[2] - HALL.y)); });
  out.server = { min: m }; out.corrections = cs; out.distFromPointAfter4s = atPoint; out.offHomeAtEnd = off;
  check(`C04/C10 eight pages (a full room), ${lag} ms each way, walk into one point and back out: never two closer than D on the server (every pair, every snapshot two of the pages got)`, m.min >= DMIN && m.snapshots > 100, m);
  check('C04/C10 ...they pack round it (all within 80 px) and walk back out home (within 2 px): nobody stuck', atPoint.every(d => d <= 80) && off.every(d => d <= 2), { atPoint, offHome: off });
  check('C04/C10 ...corrections soft only, at most one per 0.3 s per page', cs.every(c => c.soft === c.n && (c.minGapMs == null || c.minGapMs >= 290)), cs);
  P.forEach(p => p.close()); return out;
}

(async () => {
  PORT = +ARG.port || await freePort();
  const log = (ARG.out || 'net_predict.json').replace(/\.json$/, '') + '.server.log', srv = await startServer(log);
  const res = { tool: 'dev/stage-3d-hq2/net_predict.js', game: GAME, scenarios: {} };
  try {
    for (const s of String(ARG.scenario || 'c09_head,c09_pass,c10_two,c10_crowd8').split(',')) {
      if (s === 'c09_head') for (const l of [0, 60, 150]) res.scenarios[s + '_' + l] = await c09_head(l);
      if (s === 'c09_pass') for (const l of [0, 150]) res.scenarios[s + '_' + l] = await c09_pass(l);
      if (s === 'c10_two') for (const l of [0, 60, 150]) res.scenarios[s + '_' + l] = await c10_two(l);
      if (s === 'c10_crowd8') res.scenarios[s] = await c10_crowd8(40);
      await sleep(300);
    }
  } finally { srv.kill('SIGTERM'); }
  const all = Object.values(res.scenarios).flatMap(v => v.checks || []);
  res.passed = all.filter(c => c.ok).length; res.total = all.length; res.ok = all.length > 0 && all.every(c => c.ok);
  fs.writeFileSync(ARG.out || 'net_predict.json', JSON.stringify(res, null, 1) + '\n');
  for (const [k, v] of Object.entries(res.scenarios)) for (const c of v.checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + k + ': ' + c.name + '  ' + JSON.stringify(c.info).slice(0, 300));
  console.log(`${res.passed}/${res.total} checks passed`);
  process.exit(res.ok ? 0 : 1);
})();
