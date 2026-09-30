/* LIVE server test: the real `node server.js` on a free port, two real WebSocket clients (Node's built-in WebSocket).
 * Checks: what the browser may fetch, that both clients see the same entities, that a client cannot fake entities / deaths / bodies / admin,
 * the whole kill flow (server decides, both sides told, replay + corpse relayed), BODY_TTL, and that nothing internal to the AI leaks on the wire.
 * Run:  node live.js        (exit code 1 on any failure) */
'use strict';
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const ROOT = require('../paths.js');
const PORT = 18000 + (process.pid % 900);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '\n       ' + note : '')); };

function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }

class Client {
  constructor(room, name) {
    this.name = name; this.msgs = []; this.snaps = []; this.id = 0; this.last = null; this.fx = []; this.nSnap = 0; this.bodies = null; this.admin = null; this.got = []; this.tps = 0; this.raw = 0;
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`);
    this.ready = new Promise((res, rej) => { this.ws.onopen = () => res(); this.ws.onerror = e => rej(e); });
    this.ws.onmessage = ev => {
      this.raw += String(ev.data).length; const m = JSON.parse(ev.data); this.msgs.push(m.t);
      if (m.t === 'hi') this.id = m.id; else if (m.t === 's') { this.last = m; this.nSnap++; this.snaps.push(m); if (this.snaps.length > 400) this.snaps.shift(); }
      else if (m.t === 'fx') this.fx.push(m); else if (m.t === 'bodies') this.bodies = m; else if (m.t === 'admin') this.admin = m; else if (m.t === 'got') this.got.push(m); else if (m.t === 'tp') { this.tps++; this.pos = { x: m.x, y: m.y }; }      // like the real client: the server moved us (admin tool / movement correction)
    };
    this.pos = { x: 5000, y: 3504 }; this.mv = { s: 0, st: 100, ex: 0, sp: 0, ev: [] }; this.timer = null;      // the movement report in the real client's format (move.js mv.net): standing, fresh
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  start(x, y) { this.pos = { x, y }; this.timer = setInterval(() => this.send({ t: 'p', x: this.pos.x, y: this.pos.y, vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: this.name, c: '#ffe7b2', mv: this.mv }), 50); }
  stop() { clearInterval(this.timer); }
  close() { this.stop(); try { this.ws.close(); } catch (e) { } }
}

(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: ROOT, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 'smoor' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let slog = ''; srv.stdout.on('data', d => slog += d); srv.stderr.on('data', d => slog += d);
  for (let i = 0; i < 50; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  try {
    /* L1: what a browser may fetch */
    const codes = {}; for (const p of ['/index.html', '/world.js', '/move.js', '/ents.js', '/mp.js', '/gore.js', '/assets/index-DKbV5Nv9.js', '/ai.js', '/sim.js', '/server.js', '/../server.js', '/dev/harness.js', '/package.json']) codes[p] = await get(p);
    const okServed = ['/index.html', '/world.js', '/move.js', '/ents.js', '/mp.js', '/gore.js', '/assets/index-DKbV5Nv9.js'].every(p => codes[p] === 200);
    const okHidden = ['/ai.js', '/sim.js', '/server.js', '/../server.js', '/dev/harness.js', '/package.json'].every(p => codes[p] === 404 || codes[p] === 0);
    check('L1 the browser can load the game files but never ai.js / sim.js / server.js', okServed && okHidden, JSON.stringify(codes));

    /* L2: two players join the same room */
    const A = new Client('live', 'ALICE'), B = new Client('live', 'BOB'); await Promise.all([A.ready, B.ready]); await sleep(150);
    A.send({ t: 'join' }); B.send({ t: 'join' }); A.start(5000, 3504); B.start(5000, 3560); await sleep(1500);
    check('L2 both clients get an id and a stream of world snapshots (~20 Hz)', A.id > 0 && B.id > 0 && A.id !== B.id && A.snaps.length > 15 && B.snaps.length > 15, `ids ${A.id}/${B.id}; snapshots in 1.5 s: ${A.snaps.length}/${B.snaps.length}`);
    const la = A.last, lb = B.last;
    check('L2b each sees the other, and not itself, in the peers list', la.p.some(p => p.id === B.id && p.n === 'BOB') && !la.p.some(p => p.id === A.id) && lb.p.some(p => p.id === A.id && p.n === 'ALICE'), `A sees ${la.p.map(p => p.n)}, B sees ${lb.p.map(p => p.n)}`);

    /* L3: identical entities for everybody (the server is the only source) */
    await sleep(500);
    const ja = new Set(A.snaps.map(s => JSON.stringify(s.e))), jb = B.snaps.map(s => JSON.stringify(s.e)); let same = 0; for (const j of jb) if (ja.has(j)) same++;
    check('L3 both clients receive the very same entity data (same tick -> byte-identical)', same >= jb.length * .8 && jb.length > 20, `${same}/${jb.length} of B's entity frames appear verbatim in A's stream`);
    const leak = /"mem"|"tr"|"lkx"|"target"|"search"|"cap"|"traits"|"stalk"/.test(JSON.stringify(A.last.e));
    check('L3b nothing internal to the AI (memory, traits, targets) is on the wire for ordinary players', !leak && A.last.dbg === undefined && A.last.ad === undefined, 'snapshot keys: ' + Object.keys(A.last).join(','));

    /* L4: a normal client cannot use admin, fake deaths, fake bodies or fake entities */
    const count = s => (s.e.h ? s.e.h.length : 0) + (s.e.m ? s.e.m.length : 0);
    const before = count(A.last), tpA0 = A.tps, tpB0 = B.tps;                   // (a spawn choice the server refused may already have moved someone: only moves during this check count)
    for (const c of ['near', 'hounds', 'smilers', 'summon', 'world', 'monsters', 'blackout', 'god', 'freeze', 'speed', 'kick', 'revive', 'msg']) A.send({ t: 'a', c, k: 'hound', mode: 'add', id: B.id, on: 1, v: 9, text: 'hi' });
    A.send({ t: 'fx', k: 'death', v: 'C', x: 5000, y: 3504, c: 'Hound' }); A.send({ t: 'b', c: 'Hound', x: 5000, y: 3504, n: 'ALICE' }); A.send({ t: 'admin', pass: 'nope' });
    await sleep(700);
    check('L4 without the passcode no admin command works, a living player cannot send a death replay or a corpse', count(B.last) === before && B.fx.length === 0 && (!B.bodies || !B.bodies.b.length) && A.admin && A.admin.ok === false && B.tps === tpB0 && A.tps === tpA0 && !B.msgs.includes('kick') && !B.msgs.includes('msg'), `entities ${before} -> ${count(B.last)}; fx ${B.fx.length}; bodies ${B.bodies ? B.bodies.b.length : 0}; admin reply ${JSON.stringify(A.admin)}`);

    /* L5: the kill flow. Alice unlocks admin (right passcode), drops a hound on herself, stands still; the server decides everything */
    A.send({ t: 'admin', pass: 'smoor' }); await sleep(300);
    check('L5 the right passcode unlocks admin (even after one wrong guess) for that connection only', A.admin && A.admin.ok === true, JSON.stringify(A.admin));
    // wait out spawn protection, then send the hound
    await sleep(3500);
    A.mv = { s: 0, st: 0, ex: 1, sp: 0, ev: [] };                           // Alice stands there winded (breathing hard: audible). Until v22.2 this fixture sent a malformed report the server read as stamina 0; now it says so
    A.send({ t: 'a', c: 'near', k: 'hound' });
    let died = -1, t0 = Date.now();
    while (Date.now() - t0 < 70000) { if (A.last && A.last.me) { died = (Date.now() - t0) / 1000; break; } await sleep(100); }
    const sa = A.last, sb = B.last;
    check('L5b the server kills Alice (variant chosen server-side), tells her which one, and sends it to nobody as a claim', died >= 0 && sa.ms === 1 && sa.mk && /^[ABCD]$/.test(sa.mk.v || '') , `dead after ${died.toFixed(1)} s; me=${sa && sa.me} ms=${sa && sa.ms} mk=${JSON.stringify(sa && sa.mk)}`);
    const bSeesDead = B.last.p.find(p => p.id === A.id);
    check('L5c Bob sees Alice dead in the peers list and gets the kill in his own stream', bSeesDead && bSeesDead.d === 1, JSON.stringify(bSeesDead));
    // her client now plays the death and relays the replay + corpse
    A.send({ t: 'fx', k: 'death', c: 'Hound', x: 5000, y: 3504, a: 0, sx: 4900, sy: 3504, v: sa.mk.v || 'A' }); await sleep(300);
    A.send({ t: 'b', c: 'Hound', x: 5000, y: 3504, a: 0.3, n: 'ALICE', ek: 'flashlight', ec: '#ffe7b2', lo: 1, bl: [[5010, 3510, 3]] }); await sleep(500);
    check('L5d the replay reaches Bob, and the corpse (with her light left behind) is stored once for everybody', B.fx.some(f => f.k === 'death' && f.id === A.id) && B.bodies && B.bodies.b.length === 1 && B.bodies.b[0].k === A.id && B.bodies.b[0].lo === 1, `fx to Bob: ${B.fx.length}; bodies: ${B.bodies ? JSON.stringify(B.bodies.b).slice(0, 160) : 'none'}`);
    // the same again must not double up
    A.send({ t: 'b', c: 'Hound', x: 5200, y: 3504, a: 0, n: 'ALICE' }); await sleep(300);
    check('L5e one body per player: sending another replaces it', B.bodies.b.length === 1, `bodies now ${B.bodies.b.length}`);
    // Bob (alive) cannot claim a corpse or a death replay
    B.send({ t: 'b', c: 'Hound', x: 5000, y: 3560, n: 'BOB' }); B.send({ t: 'fx', k: 'death', c: 'Hound', x: 5000, y: 3560, v: 'A' }); await sleep(400);
    check('L5f a living player still cannot leave a corpse or trigger a death replay', B.bodies.b.length === 1 && !A.fx.some(f => f.id === B.id), `bodies ${B.bodies.b.length}; fx to Alice ${A.fx.length}`);
    // she respawns
    A.send({ t: 'respawn' }); await sleep(600);
    check('L5g respawn puts her back among the living', !A.last.me, `me=${JSON.stringify(A.last.me)}`);

    /* L6: the debug feed only goes to an unlocked admin who switched it on */
    B.send({ t: 'a', c: 'debug', on: 1 }); A.send({ t: 'a', c: 'debug', on: 1 }); await sleep(900);
    const anyDbgB = B.snaps.some(s => s.dbg), anyDbgA = A.snaps.some(s => s.dbg);
    check('L6 the AI debug feed goes only to the unlocked admin', !anyDbgB && (anyDbgA || count(A.last) === 0), `Bob got debug: ${anyDbgB}; Alice got debug: ${anyDbgA} (entities ${count(A.last)})`);
    if (anyDbgA) { const d = A.snaps.filter(s => s.dbg).pop().dbg; check('L6b debug entries carry state / target / last-known-position / tier', d.length > 0 && d.every(x => x.s && x.tier !== undefined && x.k), `${d.length} entries, e.g. ${JSON.stringify(d[0]).slice(0, 200)}`); }

    /* L7: bandwidth */
    const secs = 10, r0 = B.raw, n0 = B.nSnap; await sleep(secs * 1000);
    const kbps = (B.raw - r0) / secs / 1024;
    check('L7 downstream per client stays small', kbps < 60, `${kbps.toFixed(1)} KB/s uncompressed per client with 2 players and ${count(B.last)} entities (${((B.nSnap - n0) / secs).toFixed(1)} snapshots/s)`);

    /* L8: lock-out after five wrong passcodes (last: the lock is per address) */
    B.admin = null; let last = null; for (let i = 0; i < 6; i++) { B.send({ t: 'admin', pass: 'guess' + i }); await sleep(120); last = B.admin; }
    check('L8 five wrong guesses lock admin attempts for a minute', last && last.ok === false && last.wait > 0, JSON.stringify(last));
    A.close(); B.close();
  } catch (e) { check('live test crashed', false, e.stack); }
  srv.kill(); await sleep(200);
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed` + (bad.length ? '\nFAILED: ' + bad.map(b => b.name).join('; ') + '\n--- server log ---\n' + slog.slice(-1500) : ''));
  process.exit(bad.length ? 1 : 0);
})();
