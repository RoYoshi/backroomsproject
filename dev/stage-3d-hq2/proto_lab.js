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
 *   nr_held      E05: a player held in a real hound capture (capture style 'play') is refused (held) and stays held
 * H2-2 (GREEN):
 *   nr_boom        E01/E03/E04/E07: one blast event to the initiator, a spectator and a late joiner (with el); at the real position; the
 *                  light profile; one identical Boom corpse everywhere; nobody else moved, hurt or corrected; no death message; no
 *                  second blast inside the cooldown
 *   nr_boom_lights E03: a light that was off, and a camcorder, carry no light profile
 *   nr_boom_reset  R02 (server part): a world reset 0.6 s into a blast: its corpse never appears
 *   nr_boom_again  E07: a second blast after the cooldown replaces the first's corpse, her next natural death replaces that, a world
 *                  reset clears it (about 45 s)
 * H2-3 (GREEN): living Wanderers are solid to each other on the server.  Every player here is ORDINARY (no passcode) unless a check says
 * otherwise, and follows the server's corrections as the browser does (`obey`).  Separation is read from the quiet admin's own snapshots
 * (every living player's server position, 20 Hz, rounded to whole px on the wire: so "never closer than 36" reads as >= 36 - sqrt(0.5)).
 *   col_head     C01: head-on into a standing player in the one-tile corridor (stopped at contact, soft corrections only, the other never
 *                moved), backing away freely, squeezing past once he has stepped aside
 *   col_wide     C02: on open floor, a slightly off-centre approach slides round him; a dead-centre one stops without a sideways shove
 *   col_two      C03: two movers head-on, two claims in the same server wake, a burst across him after a long stand
 *   col_crowd    C04: six players walking into one point and back out (no overlap, no soft-lock)
 *   col_spawn    C05: a join on top of a standing player, admin BRING onto one, the admin world reset, an admin's jump onto one
 *   col_respawn  C05: an ordinary player's respawn (after a real hound kill) on top of a standing player
 *   col_member   C06: who is solid - not a player who has pressed NEW RUN, one in the menu, one who has left, a dead one; again once back
 *   col_held     C06: not a player held in a real capture
 *   col_rooms    C07: players in different rooms never block each other
 *   col_bypass   C08: tiny steps, sub-pixel steps, a burst, a skim through the body to a legal point, a burst whose only wall route
 *                runs past him, a packet flood, malformed numbers: none of them gets through
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
      else if (m.t === 'tp') { this.tp.push({ t, x: m.x, y: m.y, pc: m.pc | 0 }); if (this.obey) { this.x = m.x; this.y = m.y; } }   // (obey: H2-3, the client follows a correction as mp.js does)
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

async function room(port, name, rec = false) {
  const adm = new Client(port, name, 'ADMIN', rec); await adm.open; adm.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);
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
  for (let i = 0; i < 6; i++) { if (c.obey) c.pos(c.x, c.y); else c.pos(x, y); await sleep(60); }     // (a client that obeys stays where the server put it)
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
  const aRecs = B.bodies.slice(bv0).flatMap(x => x.b.filter(q => q.k === A.id));
  check('E02 the refused presses sent nothing to the spectator: no other replay, and no corpse or light record other than the approved NEW RUN\'s own (H2-2: its blast\'s corpse, event ' + (r1 && r1.de) + ')',
    B.fx.length === fx0 && aRecs.every(q => q.c === 'Boom' && q.de === (r1 && r1.de)), { fx: B.fx.length - fx0, bodiesMessages: B.bodies.length - bv0, aliceRecords: aRecs.map(q => [q.c, q.de]) });
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

/* E05: a player held in a real capture (the admin's capture style 'play': captures hold instead of killing at once) cannot NEW RUN out of it */
async function nr_held(port) {
  const rm = 'h21held', adm = await room(port, rm), out = { room: rm }, check = checker(out);
  const V = new Client(port, rm, 'VIC', true), O = new Client(port, rm, 'OBS', true);
  await joinAt(O, 3100, 3504); await joinAt(V, 4200, 3504); await hold([O, V], 400);
  adm.send({ t: 'a', c: 'god', id: O.id }); adm.send({ t: 'a', c: 'capmode', mode: 'play' }); await sleep(200);
  let cp = null;
  for (let tries = 0; tries < 4 && !cp; tries++) {                         // (as dev/tests/audit_net2.js LC1: a hound dropped beside the victim and walked over)
    for (let k = 0; k < 6; k++) adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(150);
    adm.pos(4200, 3504); await sleep(120); adm.pos(4200, 3504); await sleep(150);
    adm.send({ t: 'a', c: 'near', k: 'hound' }); await sleep(400);
    const hh = ((O.last && O.last.e && O.last.e.h) || [])[0];
    if (hh) { adm.pos(4270, 3504); await sleep(150); adm.send({ t: 'a', c: 'nav', eid: hh.i, cmd: 'come' }); }
    await sleep(200); adm.pos(5100, 3504);
    const t0 = now();
    while (now() - t0 < 20000 && !cp) { V.pos(4200, 3504); O.pos(O.x, O.y); cp = V.last && V.last.cp && V.last.cp.k === 'Hound' ? V.last.cp : null; await sleep(50); }
  }
  out.capture = cp;
  check('setup: a real hound holds the victim', !!cp, cp);
  if (cp) {
    const r = await press(V, 1);
    await hold([V, O], 300);
    check('E05 held in a capture: NEW RUN is refused (held) and the victim stays held (no escape)', r && r.ok === 0 && r.why === 'held' && V.last && V.last.cp && V.last.cp.k === 'Hound', { answer: r, cp: V.last && V.last.cp });
  }
  adm.send({ t: 'a', c: 'capmode', mode: 'auto' });
  V.close(); O.close(); adm.close(); return out;
}

/* ---------------------------------------------------------------- H2-2: the explosion as a server event (GREEN checks) */
const boomsOf = (c, id) => c.fx.filter(f => f.k === 'boom' && f.id === id);
const corpseOf = (c, id) => { for (let i = c.bodies.length - 1; i >= 0; i--) { const r = c.bodies[i].b.find(b => b.k === id); if (r) return r; } return null; };
async function nr_boom(port) {
  const rm = 'h22boom', adm = await room(port, rm), out = { room: rm }, check = checker(out);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true);
  await joinAt(A, CORR.x0, CORR.y); await joinAt(B, CORR.x1, CORR.y); await hold([A, B], 600);
  const bTp0 = B.tp.length, bPos0 = srvPos(adm, B.id);
  const t0 = now(), r = await press(A, 1);
  check('setup: approved', r && r.ok === 1, r);
  await hold([B], 1000);
  const C = new Client(port, rm, 'CAROL', true); await C.open; await sleep(400);                 // a late joiner, 1.4 s into the blast
  await hold([B], 2400);
  const fa = boomsOf(A, A.id), fb = boomsOf(B, A.id), fc = boomsOf(C, A.id);
  out.fx = { alice: fa, bob: fb, carol: fc };
  check('E01 one blast event: the initiator, the spectator and the late joiner each get exactly one boom replay, the same event (id, world, seed, direction, place)',
    fa.length === 1 && fb.length === 1 && fc.length === 1 && [fa[0], fb[0], fc[0]].every(f => f.de === r.de && f.w === r.w && f.s === fa[0].s && f.d === fa[0].d && f.x === fa[0].x && f.y === fa[0].y),
    { de: r.de, s: fa[0] && fa[0].s, d: fa[0] && fa[0].d, x: fa[0] && fa[0].x, y: fa[0] && fa[0].y });
  check('E01 at the player\'s real position (where the server held her)', fa[0] && Math.abs(fa[0].x - CORR.x0) <= 1 && Math.abs(fa[0].y - CORR.y) <= 1, fa[0] && [fa[0].x, fa[0].y]);
  check('E04 the late joiner\'s replay says how far it has run (el ~1.4 s)', fc[0] && fc[0].el > .9 && fc[0].el < 2.5, fc[0] && fc[0].el);
  check('E03 the light was on: the replay carries the HQ1 light profile (hold 3-7 s, fade 1-2 s)', fa[0] && fa[0].lo === 1 && Array.isArray(fa[0].lf) && fa[0].lf[0] >= 3 && fa[0].lf[0] <= 7 && fa[0].lf[1] >= 1 && fa[0].lf[1] <= 2, fa[0] && fa[0].lf);
  const ca = corpseOf(A, A.id), cb = corpseOf(B, A.id), cc = corpseOf(C, A.id);
  out.corpse = { alice: ca, bob: cb, carol: cc };
  check('E01 one authoritative corpse, cause Boom, the same record on every screen, with the event id and the light\'s failure (lf with its release)',
    cb && cb.c === 'Boom' && cb.de === r.de && JSON.stringify(ca) === JSON.stringify(cb) && JSON.stringify(cc) === JSON.stringify(cb) && Array.isArray(cb.lf) && cb.lf.length === 4 && cb.lo === 1,
    { corpse: cb });
  const bPos1 = srvPos(adm, B.id);
  check('no effect on anyone else: Bob was not moved, corrected, hurt or killed', B.tp.length === bTp0 && bPos0 && bPos1 && bPos0.x === bPos1.x && bPos0.y === bPos1.y && !bPos1.d && B.peerLog.every(q => !q.me),
    { before: bPos0, after: bPos1, corrections: B.tp.length - bTp0 });
  check('no death message for a NEW RUN', !A.fx.concat(B.fx, C.fx).some(f => f.k === 'death'), {});
  const rr = await press(A, 2);
  check('E07 inside its cooldown a second NEW RUN is refused and makes no second blast', rr && rr.ok === 0 && boomsOf(B, A.id).length === 1, rr);
  A.close(); B.close(); C.close(); adm.close(); return out;
}
/* E03: a light that was OFF, and a camcorder, leave no light profile (OFF stays dark; a camcorder is not a white light) */
async function nr_boom_lights(port) {
  const rm = 'h22lights', adm = await room(port, rm), out = { room: rm }, check = checker(out);
  const A = new Client(port, rm, 'OFF', true), K = new Client(port, rm, 'CAM', true), B = new Client(port, rm, 'BOB', true);
  A.pos = function (x, y, a = 0) { this.x = x; this.y = y; this.send({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a, r: 0, l: 0, k: 'flashlight', n: this.name, c: '#ffe7b2', f: -1 }); };
  K.pos = function (x, y, a = 0) { this.x = x; this.y = y; this.send({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a, r: 0, l: 1, k: 'camcorder', n: this.name, c: '#202020', f: -1 }); };
  await joinAt(B, CORR.x1, CORR.y); await joinAt(A, CORR.x0, CORR.y); await joinAt(K, CORR.x0 + 200, CORR.y); await hold([A, B, K], 600);
  const ra = await press(A, 1); await sleep(300); const rk = await press(K, 1);
  await hold([B], 4000);
  const fa = boomsOf(B, A.id)[0], fk = boomsOf(B, K.id)[0], ca = corpseOf(B, A.id), ck = corpseOf(B, K.id);
  out.fx = { off: fa, camcorder: fk }; out.corpse = { off: ca, camcorder: ck };
  check('E03 light OFF: the blast and the corpse say the light was off and carry no light profile', ra && ra.ok && fa && fa.lo === 0 && !fa.lf && ca && ca.lo === 0 && !ca.lf, { fx: fa && [fa.lo, fa.lf], corpse: ca && [ca.lo, ca.lf] });
  check('E03 camcorder: no light profile (it is not a white light)', rk && rk.ok && fk && fk.ek === 'camcorder' && !fk.lf && ck && !ck.lf, { fx: fk && [fk.lo, fk.lf, fk.ek], corpse: ck && [ck.lo, ck.lf] });
  A.close(); K.close(); B.close(); adm.close(); return out;
}
/* R02 (server part): an admin world reset while a blast is still playing: its corpse is never placed in the new world */
async function nr_boom_reset(port) {
  const rm = 'h22reset', adm = await room(port, rm), out = { room: rm }, check = checker(out);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true);
  await joinAt(B, CORR.x1, CORR.y); await joinAt(A, CORR.x0, CORR.y); await hold([A, B], 600);
  const r = await press(A, 1); await hold([B], 600);
  adm.send({ t: 'a', c: 'world' }); await hold([B], 3500);
  check('setup: approved and the blast began', r && r.ok && boomsOf(B, A.id).length === 1, r);
  check('R02 the world was reset 0.6 s into the blast: no Boom corpse in the new world, on any screen', !corpseOf(B, A.id) && !corpseOf(A, A.id), { bob: corpseOf(B, A.id) });
  A.close(); B.close(); adm.close(); return out;
}

/* E07: one corpse per player - a second blast after the cooldown replaces the first's corpse, a natural death replaces the blast's,
 * a world reset clears it (about 45 s: the real 30 s cooldown) */
async function nr_boom_again(port) {
  const rm = 'h22again', adm = await room(port, rm), out = { room: rm }, check = checker(out);
  const A = new Client(port, rm, 'ALICE', true), B = new Client(port, rm, 'BOB', true);
  await joinAt(B, CORR.x1, CORR.y); await joinAt(A, CORR.x0, CORR.y); await hold([A, B], 600);
  const recsOf = () => { const last = B.bodies[B.bodies.length - 1]; return last ? last.b.filter(q => q.k === A.id) : []; };
  const r1 = await press(A, 1); await hold([B], 3800);
  const c1 = recsOf();
  check('setup: the first blast\'s corpse', r1 && r1.ok && c1.length === 1 && c1[0].c === 'Boom' && c1[0].de === r1.de, c1);
  A.send({ t: 'join' }); await sleep(150); A.pos(CORR.x0, CORR.y); await hold([A, B], 600);
  while (now() < r1.at + 30200) { A.pos(A.x, A.y); B.pos(B.x, B.y); await sleep(60); }
  const r2 = await press(A, 2); await hold([B], 3800);
  const c2 = recsOf();
  check('E07 a second blast after the cooldown: its corpse replaces the first (one per player, no duplicate)', r2 && r2.ok && r2.de !== r1.de && c2.length === 1 && c2[0].c === 'Boom' && c2[0].de === r2.de, { r2, corpse: c2 });
  A.send({ t: 'join' }); await sleep(150); A.pos(4200, 3504); await hold([A, B], 600);
  A.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);              // (only so the admin's death preview can be played on her)
  for (let i = 0; i < 6; i++) adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(200);
  A.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await hold([B], 5600);
  const c3 = recsOf();
  check('E07 her next natural death replaces the blast\'s corpse (one per player)', c3.length === 1 && c3[0].c === 'Hound', { corpse: c3 });
  adm.send({ t: 'a', c: 'world' }); await hold([B], 900);
  check('E07 a world reset clears it', recsOf().length === 0, { corpse: recsOf() });
  A.close(); B.close(); adm.close(); return out;
}

/* ---------------------------------------------------------------- H2-3: living Wanderers are solid to each other (server side) */
const DMIN = 36 - Math.SQRT1_2;                                          // D, read through positions rounded to whole px (both ends: up to sqrt(0.5) px)
const HALL = { x: 4450, y: 3450 };                                        // open floor: a disc of radius 170 clear of every wall and prop (checked with sim.clearAt)
const obey = c => { c.obey = true; return c; };
const r1 = v => Math.round(v * 10) / 10;
const posAt = (adm, id) => { for (let i = adm.peerLog.length - 1; i >= 0; i--) { const p = adm.peerLog[i].p.find(q => q.id === id); if (p) return { x: p.x, y: p.y, d: p.d }; } return null; };
const track = (adm, id, t0 = 0, t1 = Infinity) => adm.peerLog.filter(s => s.t >= t0 && s.t <= t1).map(s => { const p = s.p.find(q => q.id === id); return p ? [s.t, p.x, p.y] : null; }).filter(Boolean);
function pairsMin(adm, ids, t0 = 0, t1 = Infinity) {                      // the closest two of these (living) players came, in every snapshot of the observer
  let m = Infinity, at = null, n = 0;
  for (const s of adm.peerLog) {
    if (s.t < t0 || s.t > t1) continue; n++;
    const ps = s.p.filter(p => ids.includes(p.id) && !p.d);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y); if (d < m) { m = d; at = { dt: s.t - t0, a: [ps[i].id, ps[i].x, ps[i].y], b: [ps[j].id, ps[j].x, ps[j].y] }; } }
  }
  return { min: m === Infinity ? null : r1(m), snapshots: n, at };
}
const softOnly = (c, n0) => { const tp = c.tp.slice(n0), gaps = tp.slice(1).map((q, i) => q.t - tp[i].t); return { n: tp.length, allSoft: tp.every(q => q.pc === 1), minGapMs: gaps.length ? Math.min(...gaps) : null }; };
async function walk(c, tx, ty, speed, every, others, maxMs, press) {      // the client walks towards (tx, ty) from wherever it is (after a correction: from there);
  const t0 = now();                                                        // press: it keeps the key down for the whole maxMs, even once its own page thinks it has arrived
  while (now() - t0 < maxMs) {
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); if (d < .5) { if (!press) break; c.pos(c.x, c.y); for (const o of others || []) o.pos(o.x, o.y); await sleep(every); continue; }
    const s = Math.min(d, speed * every / 1000); c.pos(c.x + dx / d * s, c.y + dy / d * s);
    for (const o of others || []) o.pos(o.x, o.y);
    await sleep(every);
  }
  await hold([c].concat(others || []), 0);
}
const bobStill = (adm, id, at, t0, t1) => { const tr = track(adm, id, t0, t1); return { samples: tr.length, moved: tr.filter(q => q[1] !== at.x || q[2] !== at.y).length }; };

/* C01: head-on in the narrow corridor */
async function col_head(port) {
  const rm = 'h23head', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const A = obey(new Client(port, rm, 'ALICE', true)), B = obey(new Client(port, rm, 'BOB', true));
  await joinAt(B, CORR.xb, CORR.y); await joinAt(A, CORR.x0, CORR.y); await hold([A, B], 500);
  const ids = [A.id, B.id], bTp0 = B.tp.length, aTp0 = A.tp.length, b0 = posAt(adm, B.id), t0 = now();
  await walk(A, CORR.x1, CORR.y, 200, 50, [B], 3000);                    // straight at Bob for 3 s
  await hold([A, B], 800);                                                // standing: the claim that ran ahead is pulled back
  const t1 = now(), a1 = posAt(adm, A.id), m1 = pairsMin(adm, ids, t0, t1), so = softOnly(A, aTp0);
  out.into = { min: m1, alice: a1, bob: b0, corrections: A.tp.slice(aTp0), claimNow: [r1(A.x), r1(A.y)] };
  check('C01 head-on into a standing player in the one-tile corridor: never closer than D = 36 px (whole-px snapshots: >= 35.29)', m1.min >= DMIN && m1.snapshots > 40, m1);
  check('C01 she stops at contact, on her own side (36-38 px from him, x below his)', a1 && a1.x < b0.x && Math.hypot(a1.x - b0.x, a1.y - b0.y) >= DMIN && Math.hypot(a1.x - b0.x, a1.y - b0.y) <= 38, { alice: a1, bob: b0 });
  check('C01 her page is told with soft corrections only (pc:1), at most one per 0.3 s, and now agrees with the server (within 2 px)', so.n >= 1 && so.allSoft && (so.minGapMs == null || so.minGapMs >= 290) && Math.hypot(A.x - a1.x, A.y - a1.y) <= 2, so);
  const aTp1 = A.tp.length, t2 = now();
  await walk(A, CORR.x0 + 60, CORR.y, 200, 50, [B], 2500); await hold([A, B], 400);
  const a2 = posAt(adm, A.id);
  check('C01 she backs away freely: the server follows her exactly, no further correction', a2 && a2.x === CORR.x0 + 60 && a2.y === CORR.y && A.tp.length === aTp1, { alice: a2, corrections: A.tp.length - aTp1 });
  check('C01 Bob was never moved by her: every snapshot has him where he stands, and he got no correction', bobStill(adm, B.id, b0, t0, now()).moved === 0 && B.tp.length === bTp0, Object.assign(bobStill(adm, B.id, b0, t0, now()), { corrections: B.tp.length - bTp0 }));
  await walk(B, CORR.xb, CORR.y - 30, 120, 50, [A], 1500); await hold([A, B], 300);
  const b3 = posAt(adm, B.id), t3 = now(), aTp3 = A.tp.length;
  check('setup: Bob steps aside to the corridor\'s edge (y 690: 30 px off the centre line)', b3 && b3.x === CORR.xb && b3.y === CORR.y - 30, b3);
  await walk(A, CORR.x1, CORR.y, 200, 50, [B], 6000); await hold([A, B], 600);
  const a4 = posAt(adm, A.id), m4 = pairsMin(adm, ids, t3, now()), passT = (() => { const tr = track(adm, A.id, t3); const q = tr.find(r => r[1] > b3.x + 36); return q ? q[0] - t3 : null; })();
  out.pass = { min: m4, alice: a4, bob: b3, msToGetPast: passT, corrections: softOnly(A, aTp3) };
  check('C01 once he has stepped aside she squeezes past him (sliding round his shoulder) to the far end, never closer than D', a4 && a4.x >= CORR.x1 - 2 && m4.min >= DMIN, out.pass);
  check('C01 ...and he is not moved while she passes', bobStill(adm, B.id, b3, t3, now()).moved === 0 && B.tp.length === bTp0, bobStill(adm, B.id, b3, t3, now()));
  A.close(); B.close(); adm.close(); return out;
}

/* C02: open floor - the slide, and a dead-centre approach */
async function col_wide(port) {
  const rm = 'h23wide', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const A = obey(new Client(port, rm, 'ALICE', true)), B = obey(new Client(port, rm, 'BOB', true));
  await joinAt(B, HALL.x, HALL.y); await joinAt(A, HALL.x - 150, HALL.y + 12); await hold([A, B], 500);
  const ids = [A.id, B.id], b0 = posAt(adm, B.id), bTp0 = B.tp.length, aTp0 = A.tp.length, t0 = now();
  await walk(A, HALL.x + 150, HALL.y + 12, 200, 50, [B], 5000); await hold([A, B], 500);
  const a1 = posAt(adm, A.id), m1 = pairsMin(adm, ids, t0, now()), tr = track(adm, A.id, t0), far = tr.find(q => q[1] >= HALL.x + 148), maxDy = Math.max(...tr.map(q => Math.abs(q[2] - HALL.y)));
  out.slide = { min: m1, alice: a1, msToFarSide: far ? far[0] - t0 : null, freeWalkMs: 1500, widestSideways: maxDy, corrections: softOnly(A, aTp0) };
  check('C02 12 px off his centre line she slides round him (the part of her move into him removed, the rest kept) and reaches the far side', a1 && a1.x >= HALL.x + 148 && far, out.slide);
  check('C02 ...never closer than D, and the slide hugs him (never more than D + 8 = 44 px off her line)', m1.min >= DMIN && maxDy <= 44, { min: m1, widestSideways: maxDy });
  check('C02 ...and he never moves', bobStill(adm, B.id, b0, t0, now()).moved === 0 && B.tp.length === bTp0, bobStill(adm, B.id, b0, t0, now()));
  await walk(A, HALL.x - 150, HALL.y + 60, 300, 50, [B], 3000); await walk(A, HALL.x - 150, HALL.y, 200, 50, [B], 1500); await hold([A, B], 400);
  const t2 = now(), aTp2 = A.tp.length;
  await walk(A, HALL.x + 150, HALL.y, 200, 50, [B], 3000); await hold([A, B], 600);
  const a3 = posAt(adm, A.id), m3 = pairsMin(adm, ids, t2, now()), ys = track(adm, A.id, t2).map(q => q[2]);
  out.centre = { min: m3, alice: a3, ys: [Math.min(...ys), Math.max(...ys)] };
  check('C02 dead centre: she stops at contact (x below his, 36-38 px) and is never shoved sideways (y stays on the line)', a3 && a3.x < b0.x && m3.min >= DMIN && Math.hypot(a3.x - b0.x, a3.y - b0.y) <= 38 && Math.min(...ys) === HALL.y && Math.max(...ys) === HALL.y, out.centre);
  A.close(); B.close(); adm.close(); return out;
}

/* C03: two movers; two claims in one server wake; a burst */
async function col_two(port) {
  const rm = 'h23two', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const A = obey(new Client(port, rm, 'ALICE', true)), B = obey(new Client(port, rm, 'BOB', true));
  await joinAt(A, CORR.x0, CORR.y); await joinAt(B, CORR.x0 + 400, CORR.y); await hold([A, B], 500);
  const ids = [A.id, B.id], aTp0 = A.tp.length, bTp0 = B.tp.length, t0 = now();
  await Promise.all([walk(A, CORR.x0 + 400, CORR.y, 200, 50, [], 3000), walk(B, CORR.x0, CORR.y, 200, 50, [], 3000)]);
  await hold([A, B], 800);
  const a1 = posAt(adm, A.id), b1 = posAt(adm, B.id), m1 = pairsMin(adm, ids, t0, now());
  out.headOn = { min: m1, alice: a1, bob: b1, aliceCorr: softOnly(A, aTp0), bobCorr: softOnly(B, bTp0) };
  check('C03 both walking at each other: they meet and stop at contact (36-38 px), neither gets past the other, never closer than D', a1 && b1 && a1.x < b1.x && m1.min >= DMIN && Math.hypot(a1.x - b1.x, a1.y - b1.y) <= 38, out.headOn);
  check('C03 ...each told with soft corrections only, at most one per 0.3 s', [out.headOn.aliceCorr, out.headOn.bobCorr].every(q => q.allSoft && (q.minGapMs == null || q.minGapMs >= 290)), out.headOn);
  await Promise.all([walk(A, a1.x - 40, CORR.y, 200, 50, [], 800), walk(B, b1.x + 40, CORR.y, 200, 50, [], 800)]); await hold([A, B], 400);
  const mid = Math.round((A.x + B.x) / 2), t2 = now();
  for (let k = 0; k < 5; k++) { A.pos(mid, CORR.y); B.pos(mid, CORR.y); await sleep(60); }            // both claim the same point, back to back (the same server wake)
  await hold([A, B], 600);
  const m2 = pairsMin(adm, ids, t2, now()), a2 = posAt(adm, A.id), b2 = posAt(adm, B.id);
  out.sameWake = { min: m2, alice: a2, bob: b2, mid };
  check('C03 both claim the same point, back to back (the same server wake): whichever arrives first gets it, the other stops at contact; never closer than D', m2.min >= DMIN && a2.x < b2.x && (Math.abs(a2.x - mid) <= 1 || Math.abs(b2.x - mid) <= 1) && b2.x - a2.x <= 38, out.sameWake);
  await walk(A, CORR.x0 + 100, CORR.y, 250, 50, [B], 2500); await hold([A, B], 1800);      // a long stand: the movement budget refills (a lag burst's worth)
  const t3 = now(); A.pos(b2.x + 120, CORR.y); await sleep(60); await hold([A, B], 800);
  const a3 = posAt(adm, A.id), m3 = pairsMin(adm, ids, t3, now());
  out.burst = { min: m3, alice: a3, bob: b2, claim: b2.x + 120 };
  check('C03 one burst packet across him (from far behind to 120 px past him, within the lag budget): stopped at contact on her side', a3 && a3.x < b2.x && m3.min >= DMIN, out.burst);
  A.close(); B.close(); adm.close(); return out;
}

/* C04: six players walking into one point */
async function col_crowd(port) {
  const rm = 'h23crowd', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const N = 6, cs = [], home = [];
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + .3, x = Math.round(HALL.x + Math.cos(a) * 150), y = Math.round(HALL.y + Math.sin(a) * 150); home.push([x, y]); const c = obey(new Client(port, rm, 'P' + i, true)); cs.push(c); await joinAt(c, x, y); }
  await hold(cs, 500);
  const ids = cs.map(c => c.id), tp0 = cs.map(c => c.tp.length), t0 = now();
  await Promise.all(cs.map(c => walk(c, HALL.x, HALL.y, 160, 50, [], 4000, true))); await hold(cs, 800);
  const t1 = now(), m1 = pairsMin(adm, ids, t0, t1), at = cs.map(c => posAt(adm, c.id)), dc = at.map(p => r1(Math.hypot(p.x - HALL.x, p.y - HALL.y)));
  const cor = cs.map((c, i) => softOnly(c, tp0[i]));
  out.in = { min: m1, distFromPoint: dc, corrections: cor };
  check('C04 six walking into one point: never two closer than D (all pairs, every snapshot)', m1.min >= DMIN && m1.snapshots > 60, m1);
  check('C04 ...they pack round it (everyone within 80 px of the point: nobody held off at a distance)', dc.every(d => d <= 80), dc);
  check('C04 ...soft corrections only, at most one per 0.3 s per player', cor.every(q => q.allSoft && (q.minGapMs == null || q.minGapMs >= 290)), cor);
  await Promise.all(cs.map((c, i) => walk(c, home[i][0], home[i][1], 160, 50, [], 2500))); await hold(cs, 500);
  const back = cs.map((c, i) => { const p = posAt(adm, c.id); return r1(Math.hypot(p.x - home[i][0], p.y - home[i][1])); });
  out.out = { offHome: back, min: pairsMin(adm, ids, t1, now()) };
  check('C04 ...and walk back out freely: nobody is stuck (everyone home, within 2 px)', back.every(d => d <= 2), out.out);
  cs.forEach(c => c.close()); adm.close(); return out;
}

/* C05: server-side placement */
async function col_spawn(port) {
  const rm = 'h23spawn', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const sim = require(path.join(GAME, 'sim.js'))({ seed: 9 }), clear = p => sim.clearAt(p.x, p.y, 20), Ic = sim.debug.Ic;
  const A = obey(new Client(port, rm, 'ALICE', true)), C = obey(new Client(port, rm, 'CAROL', true)), Dv = obey(new Client(port, rm, 'DAVE', true)), B = obey(new Client(port, rm, 'BOB', true));
  await joinAt(A, HALL.x, HALL.y); await joinAt(B, HALL.x - 140, HALL.y); await hold([A, B], 400);
  const a0 = posAt(adm, A.id), cTp = C.tp.length;
  await joinAt(C, HALL.x, HALL.y); await hold([A, B, C], 500);                   // her page chose to spawn exactly on Alice
  const c1 = posAt(adm, C.id), ct = C.tp.slice(cTp);
  out.joinOnTop = { alice: a0, carol: c1, carolTp: ct, sep: c1 && r1(Math.hypot(c1.x - a0.x, c1.y - a0.y)) };
  check('C05 a join whose page spawns exactly on a standing player: put on the nearest free spawn spot (>= D + 8 = 44 px from everyone, clear of walls), told with a hard tp', c1 && Math.hypot(c1.x - a0.x, c1.y - a0.y) >= 44 && clear(c1) && ct.length >= 1 && ct[0].pc === 0 && ct[0].x === c1.x && ct[0].y === c1.y, out.joinOnTop);
  check('C05 ...and Alice was not moved', posAt(adm, A.id).x === a0.x && posAt(adm, A.id).y === a0.y, posAt(adm, A.id));
  await joinAt(Dv, HALL.x + 20, HALL.y + 8); await hold([A, B, C, Dv], 500);
  const d1 = posAt(adm, Dv.id), others = [A, B, C].map(c => posAt(adm, c.id)), dmin = Math.min(...others.map(p => Math.hypot(p.x - d1.x, p.y - d1.y)));
  check('C05 a spawn 22 px from her (two players already about): free spot >= 44 px from all', d1 && dmin >= 44 && clear(d1), { dave: d1, nearest: r1(dmin) });
  /* admin BRING onto a standing player */
  adm.pos(a0.x, a0.y); await sleep(150); adm.pos(a0.x, a0.y); await sleep(150);
  const bTp = B.tp.length; adm.send({ t: 'a', c: 'bring', id: B.id }); await hold([A, B, C, Dv], 600);
  const b1 = posAt(adm, B.id), ps = [A, C, Dv].map(c => posAt(adm, c.id)), bmin = Math.min(...ps.map(p => Math.hypot(p.x - b1.x, p.y - b1.y)));
  check('C05 admin BRING onto a standing player: brought to a free spot next to her (>= 44 px from everyone, clear), told where', b1 && bmin >= 44 && clear(b1) && B.tp.length > bTp && Math.hypot(b1.x - a0.x, b1.y - a0.y) <= 240, { bob: b1, nearest: r1(bmin), tp: B.tp.slice(bTp) });
  /* admin world reset: everyone at the level's one spawn point, then each on a free spot */
  const tps = [A, B, C, Dv].map(c => c.tp.length), t0 = now();
  adm.send({ t: 'a', c: 'world' }); await sleep(100);
  await hold([A, B, C, Dv], 900);
  const pw = [A, B, C, Dv].map(c => posAt(adm, c.id)), mw = pairsMin(adm, [A, B, C, Dv].map(c => c.id), t0 + 50, now());
  let wmin = Infinity; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) wmin = Math.min(wmin, Math.hypot(pw[i].x - pw[j].x, pw[i].y - pw[j].y));
  out.world = { positions: pw, closestPair: r1(wmin), minOverTime: mw, tps: [A, B, C, Dv].map((c, i) => c.tp.slice(tps[i])) };
  out.world.spawnPoint = [Ic.x, Ic.y];
  check('C05 the admin world reset (everyone to the level\'s spawn point, as before) puts the four on four spots >= 44 px apart: one on the spawn point itself, the others on free spots round it (clear of walls), each told by tp',
    wmin >= 44 && pw.filter(p => p.x === Ic.x && p.y === Ic.y).length === 1 && pw.every(p => (p.x === Ic.x && p.y === Ic.y) || clear(p)) && [A, B, C, Dv].every((c, i) => c.tp.length > tps[i]) && mw.min >= DMIN, out.world);
  /* an admin (a member: its own moves skip the walls, not the players) */
  const E = obey(new Client(port, rm, 'EVE', true)); await joinAt(E, HALL.x + 120, HALL.y - 100); E.send({ t: 'admin', pass: PASS, quiet: 1 }); await hold([A, B, C, Dv, E], 500);
  const tgt = posAt(adm, A.id), eTp = E.tp.length; E.pos(tgt.x, tgt.y); await sleep(80); await hold([A, B, C, Dv, E], 500);
  const e1 = posAt(adm, E.id), all = [A, B, C, Dv].map(c => posAt(adm, c.id)), emin = Math.min(...all.map(p => Math.hypot(p.x - e1.x, p.y - e1.y)));
  check('C05 an admin\'s jump (a teleport, >= 120 px) exactly onto a player lands on a free spot beside her instead (>= 44 px), told by tp', e1 && emin >= 44 && E.tp.length > eTp, { eve: e1, nearest: r1(emin), tp: E.tp.slice(eTp) });
  const te = now(); await walk(E, tgt.x, tgt.y, 250, 50, [A, B, C, Dv], 2000); await hold([A, B, C, Dv, E], 500);
  const me = pairsMin(adm, [A.id, E.id], te, now());
  check('C05 ...and its steps into her (an admin skips the walls, not the players) stop at contact', me.min >= DMIN, me);
  [A, B, C, Dv, E].forEach(c => c.close()); adm.close(); return out;
}

/* C05: an ordinary player's respawn after a real hound kill, on top of a standing player */
async function col_respawn(port) {
  const rm = 'h23resp', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const A = obey(new Client(port, rm, 'ALICE', true)), V = obey(new Client(port, rm, 'VIC', true));
  await joinAt(A, HALL.x, HALL.y); await joinAt(V, 4200, 3504); await hold([A, V], 400);
  adm.send({ t: 'a', c: 'god', id: A.id }); adm.send({ t: 'a', c: 'capmode', mode: 'quick' }); await sleep(200);
  let dead = false;
  for (let tries = 0; tries < 4 && !dead; tries++) {
    for (let k = 0; k < 6; k++) adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(150);
    adm.pos(4200, 3504); await sleep(120); adm.pos(4200, 3504); await sleep(150);
    adm.send({ t: 'a', c: 'near', k: 'hound' }); await sleep(400);
    const hh = ((A.last && A.last.e && A.last.e.h) || [])[0];
    if (hh) { adm.pos(4270, 3504); await sleep(150); adm.send({ t: 'a', c: 'nav', eid: hh.i, cmd: 'come' }); }
    await sleep(200); adm.pos(5100, 3504);
    const t0 = now();
    while (now() - t0 < 20000 && !dead) { V.pos(4200, 3504); A.pos(A.x, A.y); dead = !!(V.last && V.last.me); await sleep(50); }
  }
  check('setup: a real hound kills Vic (an ordinary player)', dead, { me: V.last && V.last.me });
  for (let k = 0; k < 6; k++) adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(300);
  const a0 = posAt(adm, A.id), vTp = V.tp.length;
  V.send({ t: 'respawn' }); await sleep(150); V.pos(a0.x, a0.y); await hold([A, V], 600);       // his page chose to come back exactly on Alice
  const v1 = posAt(adm, V.id), vt = V.tp.slice(vTp);
  out.respawn = { alice: a0, vic: v1, tp: vt };
  check('C05 his respawn, on a spot his page chose exactly on a standing player: put on the nearest free spot beside her (44-240 px), told with a hard tp', v1 && !v1.d && Math.hypot(v1.x - a0.x, v1.y - a0.y) >= 44 && Math.hypot(v1.x - a0.x, v1.y - a0.y) <= 240 && vt.some(q => q.pc === 0 && q.x === v1.x && q.y === v1.y), out.respawn);
  adm.send({ t: 'a', c: 'capmode', mode: 'auto' });
  A.close(); V.close(); adm.close(); return out;
}

/* C06: who is solid */
async function col_member(port) {
  const rm = 'h23member', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const A = obey(new Client(port, rm, 'ALICE', true)), B = obey(new Client(port, rm, 'BOB', true));
  const P = { x: HALL.x, y: HALL.y }, L = HALL.x - 120, R = HALL.x + 120;
  await joinAt(A, P.x, P.y); await joinAt(B, L, P.y); await hold([A, B], 400);
  adm.send({ t: 'a', c: 'god', id: B.id }); await sleep(100);
  const through = async (to, label) => {                                   // Bob walks along the line through P: did he pass the spot?
    const t0 = now(), n0 = B.tp.length; await walk(B, to, P.y, 220, 50, [], 2500); await hold([B], 300);
    const tr = track(adm, B.id, t0), b = posAt(adm, B.id), closest = Math.min(...tr.map(q => Math.hypot(q[1] - P.x, q[2] - P.y)));
    out[label] = { bob: b, closestToSpot: r1(closest), corrections: B.tp.length - n0 }; return out[label];
  };
  const c0 = await through(R, 'control');
  check('control: with Alice standing there, Bob is stopped at contact (her side of the line he walks)', c0.bob.x < P.x && c0.closestToSpot >= DMIN, c0);
  await walk(B, L, P.y, 300, 50, [A], 2000); await hold([A, B], 300);
  const r = await press(A, 1); await hold([B], 300);
  const c1 = await through(R, 'afterNewRun');
  check('C06 a player who has pressed NEW RUN (approved) is out of the world at once: Bob walks straight through where she stood (and through her blast\'s corpse)', r && r.ok === 1 && c1.bob.x === R && c1.closestToSpot <= 12 && c1.corrections === 0, { nra: r, walk: c1 });
  for (let k = 0; k < 4; k++) { A.pos(P.x, P.y); await sleep(60); }                      // in the menu: her page's positions are not in the world
  const c2 = await through(L, 'menu');
  check('C06 a player in the menu (her position packets still coming) blocks nothing', c2.bob.x === L && c2.closestToSpot <= 12 && c2.corrections === 0, c2);
  A.send({ t: 'join' }); await sleep(150); A.pos(P.x, P.y); await hold([A, B], 500);
  const c3 = await through(R, 'rejoined');
  check('C06 back in a run she is solid again: Bob stopped at contact', c3.bob.x < P.x && c3.closestToSpot >= DMIN, c3);
  A.close(); await sleep(400);
  const c4 = await through(R, 'disconnected');
  check('C06 a player who has left (connection closed) blocks nothing', c4.bob.x === R && c4.closestToSpot <= 12 && c4.corrections === 0, c4);
  const V = obey(new Client(port, rm, 'VIC', true)); await joinAt(V, P.x, P.y); await hold([V, B], 400);
  V.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);              // (only so the admin's death preview can be played on him)
  V.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await hold([B], 700);
  for (let k = 0; k < 6; k++) adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(200);
  const vd = posAt(adm, V.id), Pd = { x: vd.x, y: vd.y };
  const t5 = now(), n5 = B.tp.length; await walk(B, L, Pd.y, 220, 50, [], 2500); await hold([B], 300);
  const tr5 = track(adm, B.id, t5), c5 = { vic: vd, bob: posAt(adm, B.id), closest: r1(Math.min(...tr5.map(q => Math.hypot(q[1] - Pd.x, q[2] - Pd.y)))), corrections: B.tp.length - n5 };
  out.dead = c5;
  check('C06 a dead player (and his corpse) blocks nothing: Bob walks through where he fell', vd.d && c5.bob.x === L && c5.closest <= 12 && c5.corrections === 0, c5);
  V.close(); B.close(); adm.close(); return out;
}

/* C06: a player held in a real capture is not solid (the monster's drag is never blocked) */
async function col_held(port) {
  const rm = 'h23held', adm = await room(port, rm, true), out = { room: rm }, check = checker(out);
  const V = new Client(port, rm, 'VIC', true), O = obey(new Client(port, rm, 'OBS', true));
  await joinAt(O, 3100, 3504); await joinAt(V, 4200, 3504); await hold([O, V], 400);
  adm.send({ t: 'a', c: 'god', id: O.id }); adm.send({ t: 'a', c: 'capmode', mode: 'play' }); await sleep(200);
  let cp = null;
  for (let tries = 0; tries < 4 && !cp; tries++) {
    for (let k = 0; k < 6; k++) adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(150);
    adm.pos(4200, 3504); await sleep(120); adm.pos(4200, 3504); await sleep(150);
    adm.send({ t: 'a', c: 'near', k: 'hound' }); await sleep(400);
    const hh = ((O.last && O.last.e && O.last.e.h) || [])[0];
    if (hh) { adm.pos(4270, 3504); await sleep(150); adm.send({ t: 'a', c: 'nav', eid: hh.i, cmd: 'come' }); }
    await sleep(200); adm.pos(5100, 3504);
    const t0 = now();
    while (now() - t0 < 20000 && !cp) { V.pos(4200, 3504); O.pos(O.x, O.y); cp = V.last && V.last.cp && V.last.cp.k === 'Hound' ? V.last.cp : null; await sleep(50); }
  }
  check('setup: a real hound holds Vic', !!cp, cp);
  if (cp) {
    const v = posAt(adm, V.id); adm.pos(v.x - 90, v.y); await sleep(120); adm.pos(v.x - 90, v.y); await sleep(120);
    adm.send({ t: 'a', c: 'bring', id: O.id }); await hold([O], 400);         // (an admin BRING: the observer starts 90 px from the capture)
    const n0 = O.tp.length;
    let closest = Infinity, stillHeld = true;
    for (let k = 0; k < 30; k++) { const vp = posAt(adm, V.id); const dx = vp.x - O.x, dy = vp.y - O.y, d = Math.hypot(dx, dy); if (d > 2) { const s = Math.min(d, 9); O.pos(O.x + dx / d * s, O.y + dy / d * s); } else O.pos(O.x, O.y); V.pos(4200, 3504); await sleep(50); const op = posAt(adm, O.id), vq = posAt(adm, V.id); if (op && vq) closest = Math.min(closest, Math.hypot(op.x - vq.x, op.y - vq.y)); stillHeld = stillHeld && !!(V.last && V.last.cp); }
    out.held = { capture: cp, closest: r1(closest), stillHeldWhileTested: stillHeld, corrections: O.tp.slice(n0) };
    check('C06 a player held in a capture blocks nobody: the observer walks right up to (into) him, no clamp, no peer correction', closest < 20 && !O.tp.slice(n0).some(q => q.pc === 1), out.held);
  }
  adm.send({ t: 'a', c: 'capmode', mode: 'auto' });
  V.close(); O.close(); adm.close(); return out;
}

/* C07: rooms */
async function col_rooms(port) {
  const out = { rooms: ['h23roomA', 'h23roomB'] }, check = checker(out);
  const admA = await room(port, 'h23roomA', true); const A = obey(new Client(port, 'h23roomA', 'ALICE', true)); await joinAt(A, HALL.x, HALL.y);
  const admB = await room(port, 'h23roomB', true); const B = obey(new Client(port, 'h23roomB', 'BOB', true)); await joinAt(B, HALL.x - 120, HALL.y);
  await hold([A, B], 400);
  const t0 = now(), n0 = B.tp.length; await walk(B, HALL.x + 120, HALL.y, 220, 50, [A], 2500); await hold([A, B], 300);
  const tr = track(admB, B.id, t0), closest = Math.min(...tr.map(q => Math.hypot(q[1] - HALL.x, q[2] - HALL.y)));
  out.otherRoom = { bob: posAt(admB, B.id), closestToAlicesSpot: r1(closest), corrections: B.tp.length - n0 };
  check('C07 a player in another room is never a blocker: Bob walks straight through the spot where Alice stands in hers', out.otherRoom.bob.x === HALL.x + 120 && closest <= 12 && out.otherRoom.corrections === 0, out.otherRoom);
  ADM = admA; const C = obey(new Client(port, 'h23roomA', 'CAROL', true)); await joinAt(C, HALL.x - 120, HALL.y); await hold([A, C], 300);
  const t1 = now(); await walk(C, HALL.x + 120, HALL.y, 220, 50, [A], 2500); await hold([A, C], 300);
  const mc = pairsMin(admA, [A.id, C.id], t1, now());
  check('control: in Alice\'s own room Carol is stopped at contact', mc.min >= DMIN && posAt(admA, C.id).x < HALL.x, { min: mc, carol: posAt(admA, C.id) });
  A.close(); B.close(); C.close(); admA.close(); admB.close(); return out;
}

/* C08: bypass attempts */
async function col_bypass(port) {
  const rm = 'h23bypass', adm = await room(port, rm, true), out = { room: rm, steps: {} }, check = checker(out);
  const A = obey(new Client(port, rm, 'ALICE', true)), B = obey(new Client(port, rm, 'BOB', true));
  await joinAt(B, CORR.xb, CORR.y); await joinAt(A, CORR.xb - 62, CORR.y); await hold([A, B], 500);
  const ids = [A.id, B.id], b0 = posAt(adm, B.id), T0 = now(), bTp0 = B.tp.length;
  const raw = (x, y) => A.send({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'ALICE', c: '#ffe7b2', f: -1 });
  const state = label => { const a = posAt(adm, A.id); out.steps[label] = { alice: a, sep: a && r1(Math.hypot(a.x - b0.x, a.y - b0.y)) }; return a; };
  const side = a => a && a.x < b0.x && Math.hypot(a.x - b0.x, a.y - b0.y) >= DMIN;
  for (let k = 0; k < 70; k++) { A.pos(A.x + 1, A.y); B.pos(B.x, B.y); await sleep(35); }       // 1 px steps, straight at him
  await hold([A, B], 700); const s1 = state('tiny1px');
  check('C08 70 steps of 1 px straight at him (each a legal-looking move): stopped at contact - tiny steps never add up through a body', side(s1), out.steps.tiny1px);
  const s1x = posAt(adm, A.id); let fx = s1x.x;
  for (let k = 0; k < 80; k++) { fx += .25; raw(fx, CORR.y); B.pos(B.x, B.y); await sleep(35); }  // sub-pixel creep
  await hold([A, B], 700); const s2 = state('subpixel');
  check('C08 80 sub-pixel steps of 0.25 px from contact: no creep (not 1 px closer)', side(s2) && s2.x <= s1x.x, out.steps.subpixel);
  await walk(A, CORR.xb - 140, CORR.y, 250, 50, [B], 2000); await hold([A, B], 1800);
  A.pos(CORR.xb + 140, CORR.y); await sleep(60); await hold([A, B], 700); const s3 = state('burst');
  check('C08 a burst: one packet from 140 px before him to 140 px past him after a long stand (within the lag budget, a legal end point): stopped on her side', side(s3), out.steps.burst);
  await walk(A, CORR.xb - 40, CORR.y, 200, 50, [B], 1500); await hold([A, B], 1500);
  A.pos(CORR.xb + 36, CORR.y + 26); await sleep(60); await hold([A, B], 700); const s4 = state('skim');
  check('C08 a skim: a claim to a legal point on his far side (44 px from him) whose straight path runs through his body: not let through', side(s4), out.steps.skim);
  await walk(A, CORR.xb - 40, CORR.y, 200, 50, [B], 1500); await hold([A, B], 1800);
  A.pos(CORR.xb + 60, 1100); await sleep(60); await hold([A, B], 700); const s4r = state('routeBurst');
  check('C08 a burst round the walls: one packet to a point (1072, 1100) the walls allow only along a route that runs past him (the server\'s own route, swept leg by leg): not let through', side(s4r), out.steps.routeBurst);
  await walk(A, CORR.xb - 40, CORR.y, 200, 50, [B], 1500); await hold([A, B], 600);
  for (let k = 0; k < 40; k++) { A.x += 5; A.pos(A.x, A.y); await sleep(1); }                  // a flood: 40 packets in ~40 ms
  await hold([A, B], 700); const s5 = state('flood');
  check('C08 a flood of 40 packets stepping 5 px each: stopped on her side', side(s5), out.steps.flood);
  const mal = ['1100', null, 1e9, -5, [1100], { x: 1 }, 'NaN', true, 1e308];
  for (const v of mal) { raw(v, CORR.y); await sleep(80); raw(CORR.xb + 60, v); await sleep(80); }
  await hold([A, B], 700); const s6 = state('malformed');
  check('C08 malformed positions (a number as a string, null, huge, negative, an array, an object, "NaN", true, 1e308): none gets her past him', side(s6), out.steps.malformed);
  const mAll = pairsMin(adm, ids, T0, now());
  out.minOverall = mAll;
  check('C08 through all of it: never closer than D, never on his side, and he was never moved', mAll.min >= DMIN && track(adm, A.id, T0).every(q => q[1] < b0.x) && bobStill(adm, B.id, b0, T0, now()).moved === 0 && B.tp.length === bTp0, { min: mAll, bob: bobStill(adm, B.id, b0, T0, now()) });
  await walk(A, CORR.x0, CORR.y, 250, 50, [B], 3000); await hold([A, B], 400);
  check('C08 ...and afterwards she walks away normally (nothing stuck)', posAt(adm, A.id).x === CORR.x0, posAt(adm, A.id));
  A.close(); B.close(); adm.close(); return out;
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
      else if (s === 'nr_held') res.scenarios[s] = await nr_held(port);
      else if (s === 'nr_boom') res.scenarios[s] = await nr_boom(port);
      else if (s === 'nr_boom_lights') res.scenarios[s] = await nr_boom_lights(port);
      else if (s === 'nr_boom_reset') res.scenarios[s] = await nr_boom_reset(port);
      else if (s === 'nr_boom_again') res.scenarios[s] = await nr_boom_again(port);
      else if (/^col_(head|wide|two|crowd|spawn|respawn|member|held|rooms|bypass)$/.test(s)) res.scenarios[s] = await ({ col_head, col_wide, col_two, col_crowd, col_spawn, col_respawn, col_member, col_held, col_rooms, col_bypass })[s](port);
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
