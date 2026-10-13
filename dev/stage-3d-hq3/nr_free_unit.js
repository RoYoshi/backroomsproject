/* Stage 3D HQ3 - UNLIMITED NEW RUN skips the 30 s wait and nothing else (development only)
 *
 *   node dev/stage-3d-hq3/nr_free_unit.js --game DIR [--out FILE.json]
 *
 * U1 (the game's own sim.js, no server): for a player in the menu, out through a glitched wall, dead, held, alive inside the 30 s and
 *    alive after it, nrWhy and newRun give the same answer with and without `free`, except alive inside the 30 s (cooldown without,
 *    approved with); a refused newRun changes nothing on the player.
 * U2 (a real server, SYNTHETIC admin passcode, raw WebSockets): Alice unlocks admin and turns UNLIMITED NEW RUN ON; a press carrying
 *    an old world number is refused (epoch) with no blast; a press with the right one is approved; a dead player with it ON (a monster
 *    death played on her by the admin preview) is refused (dead); U2c her gibbed corpse is then replaced by that death's ordinary one.
 * Exit 0 only if every check holds. */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const PASS = 'd3-synthetic-admin', GAME = path.resolve(ARG.game || '.'), ROOM = 'h3free';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = { tool: 'dev/stage-3d-hq3/nr_free_unit.js', game: GAME, checks: [] };
const check = (name, ok, info) => { out.checks.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(info).slice(0, 500)); };

// U1
{
  const sim = require(path.join(GAME, 'sim.js'))({});
  const t = 1000, base = { id: 9001, active: true, dead: '', caught: null, exited: false, nrAt: null };
  const cases = {
    menu: { active: false }, exited: { exited: true }, dead: { dead: 'Hound' }, held: { caught: { by: 1 } },
    cooldown: { nrAt: t - 10 }, after30: { nrAt: t - 31 }, never: {}
  };
  const rows = {};
  for (const [k, v] of Object.entries(cases)) {
    const mk = () => Object.assign({}, base, v), p0 = mk(), p1 = mk();
    const why0 = sim.nrWhy(p0, t, false), why1 = sim.nrWhy(p1, t, true);
    const q = mk(), snap = JSON.stringify(q), nr1 = why1 ? sim.newRun(q, t, true) : null;
    rows[k] = { without: why0, with: why1, newRunWithFree: nr1, unchangedWhenRefused: nr1 == null || JSON.stringify(q) === snap };
  }
  const same = ['menu', 'exited', 'dead', 'held', 'after30', 'never'].every(k => rows[k].without === rows[k].with && rows[k].unchangedWhenRefused);
  check('U1 free changes only the cooldown: menu/exited (state), dead, held refused the same with it; inside the 30 s cooldown without it, approved with it; a refused newRun leaves the player as it was',
    same && rows.menu.with === 'state' && rows.exited.with === 'state' && rows.dead.with === 'dead' && rows.held.with === 'held' && rows.cooldown.without === 'cooldown' && rows.cooldown.with === ''
    && ['menu', 'exited', 'dead', 'held'].every(k => rows[k].newRunWithFree === rows[k].with), rows);
}

// U2
function freePort() { return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
class Client {
  constructor(port) {
    Object.assign(this, { id: null, w: null, nra: [], fx: [], nrf: [], me: null, q: 0, bodies: null });
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${ROOM}`); this.open = new Promise(r => { this.ws.onopen = r; });
    this.ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hi') this.id = m.id;
      else if (m.t === 's') { if (m.w != null) this.w = m.w; this.me = m.me; }
      else if (m.t === 'nra') this.nra.push(m);
      else if (m.t === 'fx') this.fx.push({ k: m.k, id: m.id, de: m.de, at: Date.now() });
      else if (m.t === 'nrf') this.nrf.push(m);
      else if (m.t === 'bodies') this.bodies = (m.b || []).map(b => ({ k: b.k, c: b.c, de: b.de, gb: b.gb ? b.gb.length : 0, gh: !!b.gh }));
    };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  pos(x, y) { this.send({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'ALICE', c: '#ffe7b2', f: -1 }); }
  async join(x, y) { for (let i = 0; i < 40 && this.id == null; i++) await sleep(25); this.send({ t: 'join' }); await sleep(250); for (let i = 0; i < 4; i++) { this.pos(x, y); await sleep(60); } await sleep(200); }
  async press(w) { const n0 = this.nra.length; this.send({ t: 'nr', q: ++this.q, w }); for (let i = 0; i < 60 && this.nra.length === n0; i++) await sleep(25); return this.nra.length > n0 ? this.nra[this.nra.length - 1] : null; }
}
(async () => {
  const port = await freePort(), log = (ARG.out || 'nr_free_unit.json').replace(/\.json$/, '') + '.server.log';
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const srv = spawn('node', ['server.js', String(port)], { cwd: GAME, env, stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  try {
    for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
    const A = new Client(port); await A.open; await A.join(1100, 3260);
    A.send({ t: 'admin', pass: PASS }); await sleep(400);
    for (let i = 0; i < 6; i++) A.send({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) A.send({ t: 'a', c: 'smilers', mode: 'remove' });
    A.send({ t: 'a', c: 'nrfree', on: 1 }); await sleep(600);
    let t0 = Date.now(); const stale = await A.press((A.w | 0) - 1); await sleep(400);
    const blastsStale = A.fx.filter(f => f.k === 'boom' && f.at >= t0).length;
    const ok1 = await A.press(A.w); await sleep(500);
    check('U2a ON, a press carrying an old world number: refused (epoch), no blast; the next press with the current world: approved',
      A.nrf.length === 1 && A.nrf[0].on === 1 && stale && stale.ok === 0 && stale.why === 'epoch' && !blastsStale && ok1 && ok1.ok === 1, { nrf: A.nrf, stale, blastsStale, then: ok1 });
    for (let i = 0; i < 60 && !(A.bodies || []).some(b => b.k === A.id && b.c === 'Boom'); i++) await sleep(100);
    const before = (A.bodies || []).filter(b => b.k === A.id);
    await A.join(1100, 3260); await sleep(300);
    A.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); for (let i = 0; i < 40 && !A.me; i++) await sleep(100);
    t0 = Date.now(); const dead = await A.press(A.w); await sleep(400);
    check('U2b ON, while dead (a hound death played on her by the admin preview): refused (dead), no blast',
      !!A.me && dead && dead.ok === 0 && dead.why === 'dead' && !A.fx.some(f => f.k === 'boom' && f.at >= t0), { dead: A.me, press: dead });
    for (let i = 0; i < 150 && !(A.bodies || []).some(b => b.k === A.id && b.c === 'Hound'); i++) await sleep(100);
    const after = (A.bodies || []).filter(b => b.k === A.id);
    check('U2c replacement: her gibbed NEW RUN corpse (Boom, with its pieces) is replaced by the ordinary hound death\'s corpse: one record, Hound, no pieces',
      before.length === 1 && before[0].c === 'Boom' && before[0].gb >= 5 && before[0].gh && after.length === 1 && after[0].c === 'Hound' && !after[0].gb && !after[0].gh, { before, after });
    try { A.ws.close(); } catch (e) { }
  } catch (e) { check('the run completed', false, String(e && e.stack || e)); }
  finally { try { srv.kill(); } catch (e) { } }
  out.passed = out.checks.filter(c => c.ok).length; out.total = out.checks.length; out.ok = out.passed === out.total;
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(`${out.passed}/${out.total} checks passed`); process.exit(out.ok ? 0 : 1);
})();
