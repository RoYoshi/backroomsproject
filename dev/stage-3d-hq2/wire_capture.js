/* Stage 3D HQ2 - every message of HQ2's new wire, both ways, from a real server (development only)
 *
 *   node dev/stage-3d-hq2/wire_capture.js --game DIR --out FILE.jsonl
 *
 * The 3H0 golden scenarios never press NEW RUN, so they carry none of HQ2's new messages.  This captures them, for contract_hq2.js --raw:
 * the real server.js (synthetic admin passcode), a quiet admin and ordinary players over raw WebSockets that speak what mp.js speaks.
 *   Alice walks into Bob in the corridor (soft corrections, tp pc:1); Alice presses NEW RUN (nr, nra, the blast's fx boom to everyone,
 *   bodies with its Boom corpse); Carol connects during the blast (fx boom with el); Alice presses again inside the cooldown (nra
 *   refused, with wait); Vic dies a Hound C wall death and a Hound A death (fx death, its w the wall); the admin resets the world while
 *   the second plays (world with x, y; fx end; tp)
 * Writes one line per message: {"d": "s2c" | "c2s", "who": name, "m": message}.  Exit 0 when every kind above was seen. */
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || '.'), PASS = 'd3-synthetic-admin', OUT = ARG.out || 'wire.jsonl';
const sleep = ms => new Promise(r => setTimeout(r, ms)), lines = [];
const CORR = { y: 720, x0: 812, xb: 1012 }, HALL = { x: 4450, y: 3450 };
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
class C {
  constructor(port, room, name) { this.name = name; this.got = []; this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`); this.open = new Promise(r => this.ws.onopen = r);
    this.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } lines.push({ d: 's2c', who: name, m }); this.got.push(m); if (m.t === 'hi') this.id = m.id; if (m.t === 's' && m.w != null) this.w = m.w; if (m.t === 'tp' && this.obey) { this.x = m.x; this.y = m.y; } }; }
  send(o) { lines.push({ d: 'c2s', who: this.name, m: o }); if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  pos(x, y, a = 0) { this.x = x; this.y = y; this.send({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a, r: 0, l: 1, k: 'flashlight', n: this.name, c: '#ffe7b2', f: -1 }); }
  close() { try { this.ws.close(); } catch (e) { } }
}
(async () => {
  const port = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const srv = spawn('node', ['server.js', String(port)], { cwd: GAME, env, stdio: ['ignore', fs.openSync(OUT + '.server.log', 'w'), fs.openSync(OUT + '.server.log', 'a')] });
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const seen = {};
  try {
    const rm = 'h25wire', adm = new C(port, rm, 'ADMIN'); await adm.open; adm.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);
    const clear = async () => { for (let i = 0; i < 6; i++) adm.send({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) adm.send({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(250); };
    await clear();
    const join = async (c, x, y) => { await c.open; for (let i = 0; i < 40 && c.id == null; i++) await sleep(25); c.send({ t: 'join' }); await sleep(150); await clear(); c.pos(x, y); for (let i = 0; i < 8; i++) { c.pos(c.x, c.y); await sleep(60); } };
    const A = new C(port, rm, 'ALICE'), B = new C(port, rm, 'BOB'); A.obey = B.obey = true;
    await join(B, CORR.xb, CORR.y); await join(A, CORR.x0, CORR.y);
    for (let k = 0; k < 40; k++) { A.pos(Math.min(A.x + 9, CORR.xb + 100), CORR.y); B.pos(B.x, B.y); await sleep(50); }   // into him: soft corrections
    for (let k = 0; k < 10; k++) { A.pos(A.x, A.y); B.pos(B.x, B.y); await sleep(60); }
    A.send({ t: 'nr', q: 1, w: A.w }); await sleep(900);
    const L = new C(port, rm, 'CAROL'); await L.open; await sleep(3200);       // connected during the blast
    A.send({ t: 'join' }); await sleep(150); A.pos(CORR.x0, CORR.y); for (let k = 0; k < 8; k++) { A.pos(A.x, A.y); await sleep(60); }
    A.send({ t: 'nr', q: 2, w: A.w }); await sleep(600);                       // inside the cooldown: refused, with the wait
    const V = new C(port, rm, 'VIC'); await join(V, 3800, 3684); V.pos = function (x, y) { C.prototype.pos.call(this, x, y, 5.4978); };
    for (let k = 0; k < 6; k++) { V.pos(3800, 3684); await sleep(60); } V.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300); await clear();
    V.send({ t: 'a', c: 'preview', k: 'hound', var: 'C' }); await sleep(6500);
    V.send({ t: 'respawn' }); await sleep(150); V.pos(3800, 3684); await sleep(600); await clear();
    V.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(1200);
    adm.send({ t: 'a', c: 'world' }); await sleep(1500);
    [A, B, L, V, adm].forEach(c => c.close()); await sleep(300);
  } finally { srv.kill('SIGTERM'); }
  for (const l of lines) { const k = l.d + ':' + l.m.t + (l.m.t === 'fx' ? ':' + l.m.k : '') + (l.m.t === 'tp' && l.m.pc ? ':pc' : '') + (l.m.t === 'nra' ? ':' + (l.m.ok ? 'ok' : 'refused') : '') + (l.m.t === 'fx' && l.m.el ? ':late' : ''); seen[k] = (seen[k] || 0) + 1; }
  fs.writeFileSync(OUT, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  const want = ['c2s:nr', 's2c:nra:ok', 's2c:nra:refused', 's2c:fx:boom', 's2c:fx:boom:late', 's2c:fx:death', 's2c:fx:end', 's2c:world', 's2c:tp:pc', 's2c:bodies', 's2c:s'];
  const missing = want.filter(k => !seen[k]);
  console.log(JSON.stringify(seen)); console.log(missing.length ? 'MISSING: ' + missing.join(', ') : 'every kind of HQ2 message captured');
  process.exit(missing.length ? 1 : 0);
})();
