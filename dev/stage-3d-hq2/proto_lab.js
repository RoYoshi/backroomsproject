/* Stage 3D HQ2 - protocol-level scenarios against a real game server (development only).
 *
 *   node dev/stage-3d-hq2/proto_lab.js --game DIR --scenario NAME[,NAME...] --out FILE.json [--port N]
 *
 * Starts `node server.js PORT` in DIR (the working tree or an export of a commit) with a SYNTHETIC admin passcode, connects raw
 * WebSocket clients that speak exactly what the browser's mp.js speaks, and records what every client receives.  A quiet admin
 * connection (never joined) removes the monsters first and reads the server's own player list (the admin snapshot's `ad.pl`).
 * The players themselves are NOT admins: admins skip the server's movement checks.
 *
 * Scenarios (H2-0, run on the accepted HQ1 parent to record the RED baselines; the same measurements serve the later GREEN tests):
 *   nr_phantom   NEW RUN pressed twice, the second 6 s after the first (inside the 30 s cooldown), with the HQ1 client's exact messages
 *                (b:Vanish, fx:vanish, leave 2.7 s later, then join and a spawn position): what the server and a spectator see
 *   col_pass     a moving player walks straight through a stationary one in a one-tile corridor (10 px every 50 ms)
 *   col_tiny     the same in 1 px steps
 *   col_stack    a third player spawns exactly on a standing one
 * H2-1 (GREEN, with checks; exit 1 if any fails):
 *   nr_flow      E01: one intent, one approval, the player out of the world at once, a join starts the new run, no vanish traffic
 *   nr_e02       E02: presses 1 s, 10 s and 29.9 s after an approval are refused with the remaining wait and change nothing anywhere;
 *                a flood of 100 is bounded and refused; at 30 s the next press is approved (real time: about 40 s)
 *   nr_elig      E05/E08/R04: menu, another world, malformed and repeated press numbers, the dead legacy fx/b channels, a world reset
 *                that is nobody's NEW RUN (no answer, no cooldown, old-world presses refused), a just-killed player
 * Writes the raw observations, a short `measured` block per RED scenario and the `checks` of the GREEN ones. */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const PASS = 'd3-synthetic-admin';
const GAME = path.resolve(ARG.game || '.');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const CORR = { y: 720, x0: 812, xb: 1012, x1: 1312 };          // a straight one-tile corridor on Level 0 (centre line y=720, walk-mode span 64 px)

function freePort() { return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
async function startServer(port, log) {
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const p = spawn('node', ['server.js', String(port)], { cwd: GAME, env, stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) return p; await sleep(100); }
  return p;
}

class Client {
  constructor(port, room, name, rec) {
    this.name = name; this.rec = rec; this.id = null; this.msgs = []; this.tp = []; this.fx = []; this.bodies = []; this.peerLog = []; this.ad = null; this.adLog = []; this.extra = []; this.nra = []; this.w = null; this.last = null;
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${encodeURIComponent(room)}`);
    this.open = new Promise(r => { this.ws.onopen = r; });
    this.ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      const t = now();
      if (m.t === 'hi') this.id = m.id;
      else if (m.t === 'tp') this.tp.push({ t, x: m.x, y: m.y });
      else if (m.t === 'fx') this.fx.push(Object.assign({ at: t }, m));
      else if (m.t === 'bodies') this.bodies.push({ at: t, v: m.v, b: (m.b || []).map(b => ({ k: b.k, c: b.c, x: b.x, y: b.y, de: b.de, lo: b.lo, lf: b.lf || null })) });
      else if (m.t === 'nra') this.nra.push(Object.assign({ at: t }, m));
      else if (m.t === 's') {
        if (m.w != null) this.w = m.w; this.last = m;
        if (this.rec) this.peerLog.push({ t, p: (m.p || []).map(p => ({ id: p.id, x: p.x, y: p.y, d: p.d })), me: m.me || '' });
        if (m.ad) { this.ad = m.ad; this.adLog.push({ t, pl: m.ad.pl.map(p => ({ id: p.id, a: p.a, d: p.d, x: p.x, y: p.y })) }); }
      } else if (m.t !== 'pong') this.extra.push(Object.assign({ at: t }, m));
    };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  pos(x, y, a = 0) { this.x = x; this.y = y; this.send({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a, r: 0, l: 1, k: 'flashlight', n: this.name, c: '#ffe7b2', f: -1 }); }
  close() { try { this.ws.close(); } catch (e) { } }
}

async function room(port, name) {
  const adm = new Client(port, name, 'ADMIN', false); await adm.open; adm.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);
  for (let i = 0; i < 6; i++) { adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(40); }
  for (let i = 0; i < 8; i++) { adm.send({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(40); }
  await sleep(300);
  ADM = adm; return adm;
}
let ADM = null;                                                            // the room's quiet admin (room()): clears the monsters a first join brings back
async function joinAt(c, x, y) {
  await c.open; for (let i = 0; i < 40 && c.id == null; i++) await sleep(25);
  c.send({ t: 'join' }); await sleep(120);
  if (ADM) { for (let i = 0; i < 6; i++) ADM.send({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) ADM.send({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(150); }   // (a lone player's join makes a new world, with new monsters; a spawn spot near one is refused)
  c.pos(x, y); await sleep(200);
  for (let i = 0; i < 6; i++) { c.pos(x, y); await sleep(60); }
}
const srvPos = (adm, id) => { const p = adm.ad && adm.ad.pl.find(q => q.id === id); return p ? { a: p.a, d: p.d, x: p.x, y: p.y } : null; };
async function hold(cs, ms) { const t0 = now(); while (now() - t0 < ms) { for (const c of cs) c.pos(c.x, c.y); await sleep(60); } }

/* --- NEW RUN pressed twice inside the cooldown, with the HQ1 client's own messages (mp.js bodyMade / vanish / leave / join) --- */
async function nr_phantom(port) {
  const rm = 'h20nr', adm = await room(port, rm);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true);
  await joinAt(A, CORR.x0, CORR.y); await joinAt(B, CORR.x1, CORR.y); await hold([A, B], 800);
  const ev = [];
  const press = async (label, spawnX) => {
    const t = now(), x = A.x, y = A.y;
    ev.push({ label, t, at: [x, y], server: srvPos(adm, A.id) });
    A.send({ t: 'b', n: 'ALICE', x, y, a: 0, sx: 1, sy: 1, c: 'Vanish', aa: 0, lk: '', ek: 'flashlight', ec: '#ffe7b2', ep: '', lo: 1, bl: [], dr: [x + 13, y - 13, 0.5], ht: [x, y, 0], hd: 0, tr: 0, ho: 0, ph: 0, ka: 0 });
    A.send({ t: 'fx', k: 'vanish', x, y, a: 0, lk: '', ek: 'flashlight', ec: '#ffe7b2', ep: '' });
    await hold([A, B], 2700);                                                  // the bundle's VN: 2.7 s on screen (its p packets keep coming)
    A.send({ t: 'leave' }); ev.push({ label: label + ':leave', t: now(), server: srvPos(adm, A.id) });
    await hold([A, B], 800);                                                   // the run menu; then SPAWN
    ev.push({ label: label + ':menu', t: now(), server: srvPos(adm, A.id) });
    A.send({ t: 'join' }); await sleep(120); A.pos(spawnX, CORR.y); ev.push({ label: label + ':join', t: now(), server: srvPos(adm, A.id) });
    await hold([A, B], 1500); ev.push({ label: label + ':after', t: now(), server: srvPos(adm, A.id) });
  };
  await press('NR1', CORR.x0 + 60);
  await hold([A, B], 6000 - 5000);                                            // the second press 6 s after the first (5 s spent in the first's sequence)
  await press('NR2', CORR.x0 + 120);
  await hold([A, B], 1500);
  const out = { room: rm, alice: A.id, bob: B.id, events: ev, bobFx: B.fx.map(f => ({ at: f.at, k: f.k, id: f.id })), bobBodies: B.bodies, aliceTp: A.tp,
    bobSawAlice: B.peerLog.map(s => { const p = s.p.find(q => q.id === A.id); return [s.t, p ? p.x : null, p ? p.y : null]; }).filter((_, i) => i % 4 === 0),
    serverAlice: adm.adLog.map(s => { const p = s.pl.find(q => q.id === A.id); return [s.t, p ? p.a : null, p ? p.x : null, p ? p.y : null]; }) };
  const t1 = ev.find(e => e.label === 'NR1').t, t2 = ev.find(e => e.label === 'NR2').t;
  const vanishRelays = B.fx.filter(f => f.k === 'vanish' && f.id === A.id);
  const vanishBodies = t => { const b = B.bodies.filter(x => x.at >= t && x.at < t + 2500).map(x => x.b.filter(r => r.c === 'Vanish' && r.k === A.id)); return b.length ? b[b.length - 1] : []; };
  out.measured = {
    nr1_vanishRelayedToBob: vanishRelays.some(f => f.at >= t1 && f.at < t2),
    nr2_vanishRelayedToBob: vanishRelays.some(f => f.at >= t2),
    nr1_vanishLightRecords: vanishBodies(t1).length, nr2_vanishLightRecordsAfterPress: vanishBodies(t2).length,
    nr2_bodiesVersionChanged: B.bodies.some(x => x.at >= t2 && x.at < t2 + 2500),
    nr1_serverAfterLeave: ev.find(e => e.label === 'NR1:menu').server, nr2_serverAfterLeave: ev.find(e => e.label === 'NR2:menu').server,
    nr2_serverAfterJoin: ev.find(e => e.label === 'NR2:after').server,
    aliceCorrections: A.tp.map(p => ({ dt: +((p.t - t1) / 1000).toFixed(2), x: p.x, y: p.y })),
    bobSawAliceDuringNr2Menu: (() => { const s = B.peerLog.filter(q => q.t >= ev.find(e => e.label === 'NR2:leave').t && q.t <= ev.find(e => e.label === 'NR2:join').t); return s.length ? s.every(q => q.p.some(p => p.id === A.id)) : null; })(),
  };
  A.close(); B.close(); adm.close();
  return out;
}

/* --- living players walking through each other --- */
async function col_walk(port, rm, step, every) {
  const adm = await room(port, rm);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true);
  await joinAt(B, CORR.xb, CORR.y); await joinAt(A, CORR.x0, CORR.y); await hold([A, B], 600);
  const track = []; let minSep = 1e9, x = A.x;
  while (x < CORR.x1) {
    x = Math.min(CORR.x1, x + step); A.pos(x, CORR.y); if (Math.random() < 1) B.pos(B.x, B.y);
    await sleep(every);
    const a = srvPos(adm, A.id), b = srvPos(adm, B.id);
    if (a && b) { const s = Math.hypot(a.x - b.x, a.y - b.y); minSep = Math.min(minSep, s); track.push([now(), a.x, a.y, b.x, b.y, +s.toFixed(1)]); }
  }
  await hold([A, B], 600);
  const a = srvPos(adm, A.id), b = srvPos(adm, B.id);
  const out = { room: rm, step, every, alice: A.id, bob: B.id, track: track.filter((_, i) => i % 2 === 0), aliceTp: A.tp,
    measured: { minServerSeparation: +minSep.toFixed(1), aliceEnd: a, bobEnd: b, aliceCrossedBob: !!(a && b && a.x > b.x), aliceCorrections: A.tp.length } };
  A.close(); B.close(); adm.close();
  return out;
}
async function col_stack(port) {
  const rm = 'h20stack', adm = await room(port, rm);
  const A = new Client(port, rm, 'ALICE', true), C = new Client(port, rm, 'CAROL', true);
  await joinAt(A, CORR.xb, CORR.y); await hold([A], 400);
  await joinAt(C, CORR.xb, CORR.y); await hold([A, C], 800);
  const a = srvPos(adm, A.id), c = srvPos(adm, C.id);
  const out = { room: rm, measured: { aliceServer: a, carolServer: c, separation: a && c ? +Math.hypot(a.x - c.x, a.y - c.y).toFixed(1) : null, carolCorrections: C.tp } };
  A.close(); C.close(); adm.close();
  return out;
}

/* ---------------------------------------------------------------- H2-1: NEW RUN as the server's decision (GREEN checks) */
const until = async (ms, f) => { const t0 = now(); while (now() - t0 < ms) { const v = f(); if (v) return v; await sleep(20); } return null; };
function checker(out) { out.checks = []; return (name, ok, info) => { out.checks.push({ name, ok: !!ok, info }); }; }
const seen = (B, id, t0, t1) => { const s = B.peerLog.filter(q => q.t >= t0 && q.t <= t1); return s.length ? s.filter(q => q.p.some(p => p.id === id)).length / s.length : null; };
async function press(A, q, w) { const n0 = A.nra.length; A.send({ t: 'nr', q, w: w === undefined ? A.w : w }); return until(1500, () => A.nra.length > n0 ? A.nra[A.nra.length - 1] : null); }

/* E01 (protocol part): one intent -> one approval -> the player leaves the world at once; spectators stop seeing a living player; a join starts the new run */
async function nr_flow(port) {
  const rm = 'h21flow', adm = await room(port, rm), out = { room: rm }, check = checker(out);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true);
  await joinAt(A, CORR.x0, CORR.y); await joinAt(B, CORR.x1, CORR.y); await hold([A, B], 600);
  const t0 = now(), r = await press(A, 1);
  out.answer = r;
  check('E01 an eligible intent is approved once (nra ok, an event id, the current world)', r && r.ok === 1 && r.q === 1 && Number.isInteger(r.de) && r.w === A.w, r);
  const gone = await until(1500, () => B.peerLog.length && B.peerLog[B.peerLog.length - 1].t > t0 && !B.peerLog[B.peerLog.length - 1].p.some(p => p.id === A.id) ? now() - t0 : null);
  check('E01 the player is out of the world at once: the spectator\'s next snapshots have no living Alice', gone != null && gone < 400, { msToGone: gone });
  await sleep(300); const sv = srvPos(adm, A.id);
  check('E01 the server holds her in the menu (not active)', sv && sv.a === 0, sv);
  const r2 = await (async () => { await sleep(300); return press(A, 2); })();
  check('E05 a second intent from the menu is refused (state), no second event', r2 && r2.ok === 0 && r2.why === 'state', r2);
  A.send({ t: 'join' }); await sleep(150); A.x = CORR.x0 + 80; A.pos(A.x, CORR.y); await hold([A, B], 600);
  const sj = srvPos(adm, A.id);
  check('E01 her join starts the new run (active, alive, where her client chose to spawn)', sj && sj.a === 1 && !sj.d && Math.abs(sj.x - (CORR.x0 + 80)) < 3, sj);
  check('E01 no vanish / light record traffic anywhere', !B.fx.some(f => f.k === 'vanish') && !B.bodies.some(x => x.b.some(r => r.c === 'Vanish')), { fx: B.fx.length, bodies: B.bodies.length });
  A.close(); B.close(); adm.close(); return out;
}

/* E02: inside the 30 s cooldown every press is refused with the truth and changes nothing anywhere; the boundary is honoured; a flood is bounded */
async function nr_e02(port) {
  const rm = 'h21e02', adm = await room(port, rm), out = { room: rm, presses: [] }, check = checker(out);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true);
  await joinAt(A, CORR.x0, CORR.y); await joinAt(B, CORR.x1, CORR.y); await hold([A, B], 600);
  const r1 = await press(A, 1); const tOk = r1 && r1.at;
  check('setup: the first NEW RUN is approved', r1 && r1.ok === 1, r1);
  A.send({ t: 'join' }); await sleep(150); A.pos(CORR.x0, CORR.y); await hold([A, B], 600);
  const fx0 = B.fx.length, bv0 = B.bodies.length; let q = 1;
  const at = async dt => { while (now() < tOk + dt * 1000) { A.pos(A.x, A.y); B.pos(B.x, B.y); await sleep(Math.min(60, Math.max(1, tOk + dt * 1000 - now()))); } };
  const one = async dt => {
    await at(dt); const t = now(), r = await press(A, ++q); await hold([A, B], 400);
    const sv = srvPos(adm, A.id), vis = seen(B, A.id, t, now());
    out.presses.push({ dt, answer: r, server: sv, bobSawHer: vis });
    check(`E02 a press ${dt} s after the approval is refused (cooldown, wait ~${(30 - dt).toFixed(1)} s) and nothing changes: still active, still seen by Bob`,
      r && r.ok === 0 && r.why === 'cooldown' && Math.abs(r.wait - (30 - dt)) < .6 && sv && sv.a === 1 && vis === 1, { answer: r, server: sv, bobSawHer: vis });
  };
  await one(1); await one(10);
  await at(15);                                                            // (a flood inside the cooldown: 100 intents back to back, new numbers)
  const n0 = A.nra.length, tf = now(); for (let k = 0; k < 100; k++) A.send({ t: 'nr', q: ++q, w: A.w }); await hold([A, B], 600);
  const fl = A.nra.slice(n0);
  out.flood = { sent: 100, answers: fl.length, approvals: fl.filter(r => r.ok).length };
  check('E02 a flood of 100 intents inside the cooldown: bounded answers (one per 250 ms), all refused, nothing changes', fl.length <= 4 && !fl.some(r => r.ok) && srvPos(adm, A.id).a === 1 && seen(B, A.id, tf, now()) === 1, out.flood);
  await one(29.9);
  check('E02 the refused presses sent nothing to the spectator (no fx, no corpse/light record)', B.fx.length === fx0 && B.bodies.length === bv0, { fx: B.fx.length - fx0, bodies: B.bodies.length - bv0 });
  await at(30.15); const rb = await press(A, ++q);
  out.boundary = rb;
  check('E02 at the 30 s boundary the next press is approved', rb && rb.ok === 1, rb);
  A.close(); B.close(); adm.close(); return out;
}

/* E05 / E08 / R04: eligibility, idempotency, legacy channels, a world reset */
async function nr_elig(port) {
  const rm = 'h21elig', adm = await room(port, rm), out = { room: rm }, check = checker(out);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true), M = new Client(port, rm, 'MENU', false);
  await M.open; await sleep(200);
  await until(2000, () => M.w != null); const rm0 = await press(M, 1);
  check('E05 from the menu (never joined): refused (state)', rm0 && rm0.ok === 0 && rm0.why === 'state', rm0);
  await joinAt(A, CORR.x0, CORR.y); await joinAt(B, CORR.x1, CORR.y); await hold([A, B], 600);
  const fx0 = B.fx.length, bv0 = B.bodies.length;
  A.send({ t: 'fx', k: 'vanish', x: A.x, y: A.y, a: 0 }); A.send({ t: 'b', c: 'Vanish', n: 'ALICE', x: A.x, y: A.y, dr: [A.x + 10, A.y, 0], ek: 'flashlight', lo: 1 });
  A.send({ t: 'fx', k: 'death', c: 'Hound', x: A.x, y: A.y, sx: A.x + 30, sy: A.y, a: 0 }); A.send({ t: 'b', c: 'Hound', x: A.x, y: A.y });
  await hold([A, B], 800);
  check('E08 the old client channels are dead: fx vanish / fx death / b Vanish / b Hound from a client relay nothing and store nothing', B.fx.length === fx0 && B.bodies.length === bv0 && srvPos(adm, A.id).a === 1, { fx: B.fx.length - fx0, bodies: B.bodies.length - bv0 });
  const re = await press(A, 1, (A.w | 0) + 7);
  check('E05 an intent naming another world is refused (epoch)', re && re.ok === 0 && re.why === 'epoch', re);
  await sleep(300); const bad = []; for (const qq of [0, -1, 1.5, '9', 1e12, null]) { const n0 = A.nra.length; A.send({ t: 'nr', q: qq, w: A.w }); await sleep(300); if (A.nra.length > n0) bad.push(qq); }
  check('E08 malformed press numbers get no answer', !bad.length, { answered: bad });
  await sleep(300); const ok = await press(A, 5);
  check('setup: approved', ok && ok.ok === 1, ok);
  await sleep(300); const dup = await press(A, 5);
  check('E05 the same press again (a resend) gets the same answer and no second event', dup && dup.ok === 1 && dup.de === ok.de, dup);
  await sleep(300); const n1 = A.nra.length; A.send({ t: 'nr', q: 4, w: A.w }); await sleep(400);
  check('E05 an older press number gets no answer', A.nra.length === n1, {});
  /* R04: an admin world reset is nobody's NEW RUN */
  A.send({ t: 'join' }); await sleep(150); A.pos(CORR.x0, CORR.y); await hold([A, B], 500);
  const C = new Client(port, rm, 'CAROL', true); await joinAt(C, CORR.x0 + 300, CORR.y); await hold([A, B, C], 500);
  const w0 = C.w, na = [A.nra.length, B.nra.length, C.nra.length];
  adm.send({ t: 'a', c: 'world' }); await hold([A, B, C], 1200);
  check('R04 an admin world reset sends no NEW RUN answer to anyone and explodes nobody (no fx)', A.nra.length === na[0] && B.nra.length === na[1] && C.nra.length === na[2] && !C.fx.some(f => f.at > now() - 1500), { w0, w1: C.w });
  const rc = await press(C, 1);
  check('R04 the reset did not start anyone\'s cooldown: Carol\'s first NEW RUN after it is approved', rc && rc.ok === 1, rc);
  const stale = await press(B, 1, w0);
  check('R04 / E05 a press still naming the old world after the reset is refused (epoch)', w0 !== C.w && stale && stale.ok === 0 && stale.why === 'epoch', { stale, w0, w1: C.w });
  /* E05: dead and held */
  const V = new Client(port, rm, 'VIC', true); await joinAt(V, 4200, 3504); await hold([V], 400);
  V.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);              // (only so the admin's death preview can be played on it; NEW RUN does not look at admin rights)
  V.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(500);
  const rd = await press(V, 1);
  check('E05 a dead (just killed) player is refused (dead or held), no event', rd && rd.ok === 0 && (rd.why === 'dead' || rd.why === 'held'), rd);
  A.close(); B.close(); C.close(); M.close(); V.close(); adm.close(); return out;
}

(async () => {
  const port = +ARG.port || await freePort(), log = (ARG.out || 'proto_lab.json').replace(/\.json$/, '') + '.server.log';
  const srv = await startServer(port, log);
  const res = { tool: 'dev/stage-3d-hq2/proto_lab.js', game: GAME, gitHead: null, startedAt: new Date().toISOString(), scenarios: {} };
  try { res.gitHead = require('child_process').execSync('git rev-parse HEAD', { cwd: GAME, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { res.gitHead = 'not a git checkout (an export)'; }
  try {
    for (const s of String(ARG.scenario || 'nr_phantom,col_pass,col_tiny,col_stack').split(',')) {
      if (s === 'nr_phantom') res.scenarios[s] = await nr_phantom(port);
      else if (s === 'col_pass') res.scenarios[s] = await col_walk(port, 'h20pass', 10, 50);
      else if (s === 'col_tiny') res.scenarios[s] = await col_walk(port, 'h20tiny', 1, 35);
      else if (s === 'col_stack') res.scenarios[s] = await col_stack(port);
      else if (s === 'nr_flow') res.scenarios[s] = await nr_flow(port);
      else if (s === 'nr_e02') res.scenarios[s] = await nr_e02(port);
      else if (s === 'nr_elig') res.scenarios[s] = await nr_elig(port);
      await sleep(400);
    }
  } finally { srv.kill('SIGTERM'); }
  fs.writeFileSync(ARG.out || 'proto_lab.json', JSON.stringify(res, null, 1) + '\n');
  for (const [k, v] of Object.entries(res.scenarios)) {
    if (v.measured) console.log(k, JSON.stringify(v.measured));
    for (const c of v.checks || []) console.log((c.ok ? 'PASS ' : 'FAIL ') + k + ': ' + c.name + '  ' + JSON.stringify(c.info).slice(0, 300));
  }
  const all = Object.values(res.scenarios).flatMap(v => v.checks || []);
  res.ok = all.length ? all.every(c => c.ok) : null; res.passed = all.filter(c => c.ok).length; res.total = all.length;
  fs.writeFileSync(ARG.out || 'proto_lab.json', JSON.stringify(res, null, 1) + '\n');
  if (all.length) console.log(`${res.passed}/${res.total} checks passed`);
  process.exit(res.ok === false ? 1 : 0);
})();
