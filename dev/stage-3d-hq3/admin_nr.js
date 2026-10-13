/* Stage 3D HQ3 - UNLIMITED NEW RUN: who may use it, what it skips, what it never skips (development only; a real server, raw WebSockets)
 *
 *   node dev/stage-3d-hq3/admin_nr.js --game DIR [--out FILE.json]
 *
 * Starts `node server.js PORT` in DIR with a SYNTHETIC admin passcode.  Alice unlocks admin (as the panel does); Bob is an ordinary player;
 * Watcher is a quiet admin connection that never joins and records every blast (fx boom) and every corpse list.  The players' clients
 * speak what mp.js speaks: join, position packets, {t:'nr', q, w}.
 *   A1 an ordinary player: NEW RUN approved; after SPAWN (join) a second press is refused with the 30 s wait; the refusal makes no blast
 *   A2 forged: Bob (not an admin) sends the admin toggle {t:'a', c:'nrfree', on:1}: no answer, nothing changes (his next press: cooldown)
 *   A3 Alice turns it ON, naming Bob as the target: the server answers HER (nrf on 1, ares); her snapshots say nf 1; Bob's say nothing of
 *      it and his press is still refused (cooldown): it is never another player's
 *   A8 (run next, inside Bob's 30 s) the world reset is nobody's NEW RUN: after WORLD -> NEW RUN FOR EVERYONE no blast and no NEW RUN
 *      answer, and Bob's cooldown runs on as it was
 *   A4 ON: three NEW RUNs in a row, each after SPAWN, no 30 s wait: each approved, one blast each on the wire; the same press number again
 *      gets the same answer and no second blast; a new press while she is out of the world (between the approval and SPAWN) is refused
 *   A5 one corpse: after the series Alice has exactly one Boom corpse, the last blast's, with its gibs (gs, 5-7 pieces in gb, gh)
 *   A6 OFF: the server answers (nrf on 0); her next press is refused with the wait again (counted from her last NEW RUN)
 *   A7 a new connection (a reconnect: the panel unlocks again by itself) starts OFF: its snapshots say nf 0; of two presses the second
 *      is refused (cooldown)
 * Exit 0 only if every check holds. */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const PASS = 'd3-synthetic-admin', GAME = path.resolve(ARG.game || '.'), ROOM = 'h3adm';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function freePort() { return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
async function startServer(port, log) {
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const p = spawn('node', ['server.js', String(port)], { cwd: GAME, env, stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) return p; await sleep(100); }
  return p;
}
class Client {
  constructor(port, name) {
    Object.assign(this, { name, id: null, w: null, nra: [], fx: [], bodies: [], nrf: [], ares: [], nf: [], q: 0 });
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${ROOM}`); this.open = new Promise(r => { this.ws.onopen = r; });
    this.ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      const t = Date.now();
      if (m.t === 'hi') this.id = m.id;
      else if (m.t === 's') { if (m.w != null) this.w = m.w; if (m.ad) this.nf.push([t, m.nf]); else if ('nf' in m) this.nf.push([t, m.nf, 'not-admin']); }
      else if (m.t === 'nra') this.nra.push(Object.assign({ at: t }, m));
      else if (m.t === 'fx') this.fx.push({ at: t, k: m.k, id: m.id, de: m.de });
      else if (m.t === 'bodies') this.bodies.push({ at: t, b: (m.b || []).map(b => ({ k: b.k, c: b.c, de: b.de, gs: b.gs, gb: b.gb, gh: b.gh })) });
      else if (m.t === 'nrf') this.nrf.push(Object.assign({ at: t }, m));
      else if (m.t === 'ares') this.ares.push(Object.assign({ at: t }, m));
    };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  pos(x, y) { this.send({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: this.name, c: '#ffe7b2', f: -1 }); }
  async join(x, y) { for (let i = 0; i < 40 && this.id == null; i++) await sleep(25); this.send({ t: 'join' }); await sleep(250); for (let i = 0; i < 4; i++) { this.pos(x, y); await sleep(60); } await sleep(200); }
  async press(repeatQ) { const q = repeatQ || ++this.q, n0 = this.nra.length; this.send({ t: 'nr', q, w: this.w }); for (let i = 0; i < 60 && this.nra.length === n0; i++) await sleep(25); return this.nra[this.nra.length - 1] && this.nra.length > n0 ? this.nra[this.nra.length - 1] : null; }
  close() { try { this.ws.close(); } catch (e) { } }
}
const out = { tool: 'dev/stage-3d-hq3/admin_nr.js', game: GAME, checks: [] };
const check = (name, ok, info) => { out.checks.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(info).slice(0, 400)); };
const booms = (W, id, since) => W.fx.filter(f => f.k === 'boom' && f.id === id && f.at >= since);
(async () => {
  const port = await freePort(), log = (ARG.out || 'admin_nr.json').replace(/\.json$/, '') + '.server.log', srv = await startServer(port, log);
  try {
    const W = new Client(port, 'WATCH'); await W.open; W.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);
    const clear = async () => { for (let i = 0; i < 6; i++) W.send({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) W.send({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(200); };
    const A = new Client(port, 'ALICE'), B = new Client(port, 'BOB'); await A.open; await B.open;
    await A.join(1100, 3260); await clear(); await B.join(800, 3260); await clear();
    for (const c of [A, B]) { W.send({ t: 'a', c: 'god', id: c.id }); await sleep(80); }          // (a monster coming back is another test)
    A.send({ t: 'admin', pass: PASS }); await sleep(400);                                            // Alice unlocks admin, as the panel does
    // A1
    let t0 = Date.now(); const b1 = await B.press(); await sleep(300); await B.join(800, 3260); const b2 = await B.press(); await sleep(400);
    check('A1 an ordinary player: NEW RUN approved; after SPAWN a second press is refused with the 30 s wait, and the refusal makes no blast',
      b1 && b1.ok === 1 && b2 && b2.ok === 0 && b2.why === 'cooldown' && b2.wait > 25 && booms(W, B.id, t0).length === 1, { first: b1, second: b2, blasts: booms(W, B.id, t0).length });
    // A2
    t0 = Date.now(); B.send({ t: 'a', c: 'nrfree', on: 1 }); await sleep(500); const b3 = await B.press(); await sleep(300);
    check('A2 forged: Bob (not an admin) sends the UNLIMITED NEW RUN toggle: no answer at all, and his next press is still refused (cooldown)',
      !B.nrf.length && !B.ares.length && b3 && b3.ok === 0 && b3.why === 'cooldown' && !booms(W, B.id, t0).length && !B.nf.some(x => x[1]), { nrf: B.nrf, ares: B.ares, press: b3 });
    // A3
    t0 = Date.now(); A.send({ t: 'a', c: 'nrfree', on: 1, id: B.id }); await sleep(700); const b4 = await B.press(); await sleep(300);
    const aNf = A.nf.filter(x => x[0] > t0 + 200).map(x => x[1]);
    check('A3 Alice turns it ON naming Bob as the target: the server answers her (nrf on 1, a status line), her snapshots then say nf 1, and Bob is untouched (his press still refused: cooldown)',
      A.nrf.length === 1 && A.nrf[0].on === 1 && A.ares.some(r => /UNLIMITED NEW RUN ON/.test(r.msg)) && aNf.length && aNf.every(v => v === 1) && b4 && b4.why === 'cooldown' && !B.nf.some(x => x[1]),
      { nrf: A.nrf, ares: A.ares.map(r => r.msg), aliceNf: aNf.slice(0, 3), bobPress: b4 });
    // A8 (early, well inside Bob's 30 s)
    t0 = Date.now(); const nraB = B.nra.length, nraA = A.nra.length;
    W.send({ t: 'a', c: 'world' }); await sleep(1500); await sleep(300); const b5 = await B.press(); await sleep(300);
    const expect = 30 - (b5 ? b5.at - b1.at : 0) / 1000;
    check('A8 WORLD -> NEW RUN FOR EVERYONE is nobody\'s NEW RUN: no blast and no NEW RUN answer from it, and Bob\'s cooldown runs on as it was (his next press: cooldown, the wait counted from his own NEW RUN)',
      !W.fx.some(f => f.k === 'boom' && f.at >= t0) && A.nra.length === nraA && B.nra.length === nraB + 1 && b5 && b5.why === 'cooldown' && Math.abs(b5.wait - expect) < 1.5,
      { blastsAfter: W.fx.filter(f => f.k === 'boom' && f.at >= t0).length, bobPress: b5, expectedWait: +expect.toFixed(1) });
    await A.join(1100, 3260); await B.join(800, 3260); await sleep(300);              // (the reset brought both back already; a join from alive is refused and changes nothing)
    // A4
    t0 = Date.now(); const series = [];
    for (let k = 0; k < 3; k++) {
      const a = await A.press(); await sleep(300); const dup = a ? await A.press(a.q) : null; await sleep(300); const out_ = await A.press(); await sleep(300);
      series.push({ approved: a, repeat: dup, whileOut: out_ }); await A.join(1100 + k * 10, 3260); await sleep(200);
    }
    await sleep(600);
    const aBooms = booms(W, A.id, t0);
    check('A4 ON: three NEW RUNs in a row, each after SPAWN, no 30 s wait: each approved with one blast; the same press number again gets the same answer and no second blast; a new press while out of the world (before SPAWN) is refused (state)',
      series.every(s => s.approved && s.approved.ok === 1 && s.repeat && s.repeat.ok === 1 && s.repeat.de === s.approved.de && s.whileOut && s.whileOut.ok === 0 && s.whileOut.why === 'state') && aBooms.length === 3 && new Set(aBooms.map(f => f.de)).size === 3,
      { series: series.map(s => [s.approved && s.approved.ok, s.repeat && s.repeat.de, s.whileOut && s.whileOut.why]), blasts: aBooms.map(f => f.de) });
    // A5
    await sleep(3800);
    const lastB = W.bodies[W.bodies.length - 1], aliceRecs = lastB ? lastB.b.filter(b => b.k === A.id) : [], lastDe = aBooms.length ? aBooms[aBooms.length - 1].de : null;
    check('A5 one corpse: after the series Alice has exactly one corpse, the last blast\'s, gibbed (gs, 5-7 pieces in gb, both hands in gh)',
      aliceRecs.length === 1 && aliceRecs[0].c === 'Boom' && aliceRecs[0].de === lastDe && aliceRecs[0].gs && aliceRecs[0].gb && aliceRecs[0].gb.length >= 5 && aliceRecs[0].gb.length <= 7 && aliceRecs[0].gh && aliceRecs[0].gh.length === 4,
      { records: aliceRecs.map(r => ({ c: r.c, de: r.de, pieces: r.gb && r.gb.length, gh: r.gh })), lastBlast: lastDe });
    // A6
    A.send({ t: 'a', c: 'nrfree', on: 0 }); await sleep(500);
    t0 = Date.now(); const a6 = await A.press(); await sleep(300);
    check('A6 OFF: the server answers (nrf on 0) and her next press is refused with the wait again (counted from her last NEW RUN); no blast',
      A.nrf.length === 2 && A.nrf[1].on === 0 && a6 && a6.ok === 0 && a6.why === 'cooldown' && a6.wait > 20 && !booms(W, A.id, t0).length, { nrf: A.nrf.map(x => x.on), press: a6 });
    // A7
    A.send({ t: 'a', c: 'nrfree', on: 1 }); await sleep(400); A.close(); await sleep(400);
    const A2 = new Client(port, 'ALICE'); await A2.open; await A2.join(1100, 3260); W.send({ t: 'a', c: 'god', id: A2.id }); A2.send({ t: 'admin', pass: PASS }); await sleep(700);
    t0 = Date.now(); const c1 = await A2.press(); await sleep(300); await A2.join(1100, 3260); const c2 = await A2.press(); await sleep(300);
    const nf2 = A2.nf.map(x => x[1]);
    check('A7 a new connection (the panel unlocks again by itself) starts OFF: its snapshots say nf 0, and of two NEW RUNs the second is refused (cooldown)',
      nf2.length && nf2.every(v => v === 0) && c1 && c1.ok === 1 && c2 && c2.ok === 0 && c2.why === 'cooldown', { nf: nf2.slice(0, 4), first: c1, second: c2 });
    for (const c of [W, B, A2]) c.close();
  } catch (e) { check('the run completed', false, String(e && e.stack || e)); }
  finally { try { srv.kill(); } catch (e) { } }
  out.passed = out.checks.filter(c => c.ok).length; out.total = out.checks.length; out.ok = out.passed === out.total;
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(`${out.passed}/${out.total} checks passed`); process.exit(out.ok ? 0 : 1);
})();
