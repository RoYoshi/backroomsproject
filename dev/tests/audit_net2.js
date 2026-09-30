/* Part 1 follow-up (v22.2): the complete exploit sequences from the v22.1 verification, against the real server.js over real WebSockets.
 *   node dev/tests/audit_net2.js            (Node 22+: built-in WebSocket)
 * LC  lifecycle: a real hound capture of an ordinary client cannot be escaped by respawn, join, leave -> join, a vanish or a disconnect;
 *     the legitimate transitions still work (death -> respawn, admin revive, the NEW RUN sequence, joining from the menu)
 * SP  sub-pixel steps never carry an ordinary client through a wall
 * NZ  leaving out (or garbling) the movement report does not make running silent; honest reports keep their gait
 * DD  a death is recorded when the server commits it: the victim closing at once (or after the acknowledgement) still leaves one replay and
 *     one corpse, which late joiners receive; a connected victim's own replay / corpse are used as before */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const GAME = require('../paths.js');
const createSim = require(path.join(GAME, 'sim.js'));
const PORT = +(process.env.PORT || 9490);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const check = (name, ok, note) => { R.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '\n       ' + note); };
const PASS = process.env.ADMIN_PASSCODE || 'smoor';

async function client(room, name, o = {}) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws?room=${room}`), c = { ws, name, id: 0, last: null, tps: [], fx: [], bodies: null, ares: [], closed: false };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === 'hi') c.id = m.id; else if (m.t === 's') c.last = m; else if (m.t === 'tp') { c.tps.push(m); c.at = { x: m.x, y: m.y }; } else if (m.t === 'fx') c.fx.push(m); else if (m.t === 'bodies') c.bodies = m.b; else if (m.t === 'ares') c.ares.push(m); };
  ws.onclose = () => { c.closed = true; };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o2 => ws.readyState === 1 && ws.send(JSON.stringify(o2));
  c.pos = (x, y, mv, extra) => c.tx(Object.assign({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none' }, mv === null ? {} : { mv: mv || { s: 0, st: 100, ex: 0, sp: 0, ev: [] } }, extra || {}));
  c.peer = id => c.last && (c.last.p || []).find(q => q.id === id);
  await sleep(150);
  if (o.join !== false) { c.tx({ t: 'join' }); await sleep(250); }
  if (o.admin) { c.tx({ t: 'admin', pass: PASS }); await sleep(200); }
  return c;
}
const until = async (ms, fn, step = 50) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(step); } return null; };

(async () => {
  console.log('node ' + process.version);
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  let exited = null; srv.on('exit', c => exited = c); await sleep(1200);
  const S = createSim({ seed: 1 }), Ic = S.debug.Ic, LY = 3504;
  try {
    const room = 'fu' + Date.now() % 1e5;
    const adm = await client(room, 'ADMIN', { admin: true }), obs = await client(room, 'OBS');
    for (let k = 0; k < 4; k++) adm.tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let k = 0; k < 6; k++) adm.tx({ t: 'a', c: 'smilers', mode: 'remove' });
    adm.tx({ t: 'a', c: 'god', id: adm.id }); adm.tx({ t: 'a', c: 'god', id: obs.id }); adm.tx({ t: 'a', c: 'glitch', mode: 'new' });
    adm.tx({ t: 'a', c: 'capmode', mode: 'play' });                         // the admin only sets the stage: captures hold instead of killing at once
    obs.pos(3100, LY); await sleep(300);

    /* a real hound capture of an ordinary client, arranged by the admin (bring the victim, drop a hound beside it); the victim itself never has admin */
    async function capture(v, x) {
      for (let tries = 0; tries < 4; tries++) {
        adm.pos(x, LY); await sleep(120); adm.pos(x, LY); await sleep(150); adm.tx({ t: 'a', c: 'bring', id: v.id }); await sleep(250);
        const hold = setInterval(() => v.pos(x, LY), 50);                       // the victim stands there with its light on
        await sleep(400); for (let k = 0; k < 4; k++) adm.tx({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(100);
        adm.tx({ t: 'a', c: 'near', k: 'hound' }); await sleep(400);
        const hh = ((obs.last && obs.last.e && obs.last.e.h) || [])[0];
        if (hh) { adm.pos(x + 70, LY); await sleep(150); adm.tx({ t: 'a', c: 'nav', eid: hh.i, cmd: 'come' }); }   // walk it over (navigation only); on arrival its own AI takes over
        await sleep(200); adm.pos(x + 900, LY);                                  // (the admin steps away; it is in god mode anyway)
        const got = await until(20000, () => v.last && v.last.cp && v.last.cp.k === 'Hound' ? v.last.cp : null);
        clearInterval(hold);
        if (got) return got;
        if (process.env.DEBUG) console.log('   capture try', tries, 'ares', adm.ares.slice(-3).map(a => a.msg).join(' | '), 'hounds', JSON.stringify(((obs.last && obs.last.e && obs.last.e.h) || []).map(h => [Math.round(h.x), Math.round(h.y), h.s])), 'victim', JSON.stringify(obs.peer(v.id)));
      }
      return null;
    }

    /* LC1: the complete escape sequence from the verification report */
    const v = await client(room, 'VICTIM');
    const cp0 = await capture(v, 4200);
    let st = () => ({ cp: v.last && v.last.cp, dead: v.last && v.last.me, seen: obs.peer(v.id) });
    const steps = [];
    if (cp0) {
      v.tx({ t: 'respawn' }); await sleep(300); steps.push(['respawn', st()]);
      v.tx({ t: 'join' }); await sleep(300); steps.push(['join', st()]);
      v.tx({ t: 'fx', k: 'vanish', x: 4200, y: LY, a: 0 }); await sleep(300); steps.push(['vanish', st()]);
      v.tx({ t: 'leave' }); await sleep(300); steps.push(['leave', st()]);
      v.tx({ t: 'join' }); await sleep(200); v.pos(Ic.x + 200, Ic.y); await sleep(400); steps.push(['join', st()]);
      v.pos(3000, LY); await sleep(400); steps.push(['claims a spawn', st()]);
    }
    const escaped = steps.some(([, q]) => !q.cp && !q.dead);
    const where = steps.map(([k, q]) => `${k}: ${q.cp ? 'held (' + q.cp.ph + ')' : q.dead ? 'dead (' + q.dead + ')' : 'FREE'}${q.seen ? ' at ' + q.seen.x + ',' + q.seen.y : ''}`).join(' -> ');
    check('LC1 an ordinary client held by a real hound: respawn, join, a vanish, leave -> join and a spawn claim all fail; it never comes back free', cp0 && steps.length === 6 && !escaped && steps.every(([, q]) => !q.seen || Math.hypot(q.seen.x - 4200, q.seen.y - LY) < 200),
      cp0 ? `captured (${cp0.k}, ${cp0.ph}); ${where}` : 'could not arrange a capture');
    // let this capture end on its own (death or release) before moving on
    await until(40000, () => v.last && (!v.last.cp || v.last.me), 200);
    const endV = v.last && v.last.me ? 'a death' : 'a release'; v.tx({ t: 'respawn' }); await sleep(300);
    check('LC2 ...and the capture then ends the ordinary way, as the entity decides (a death or a release)', v.last && !v.last.cp, `the capture ended in ${endV}; afterwards ${v.last && v.last.me ? 'still dead' : 'alive'} at ${(obs.peer(v.id) || {}).x},${(obs.peer(v.id) || {}).y}`);

    v.ws.close(); await sleep(200);                                          // (a room holds 8 connections: close the ones that are done)
    /* LC3: disconnecting while held is a forfeit: the victim dies there, with its replay and corpse; the connection cannot come back as that player */
    const w = await client(room, 'W');
    const cpW = await capture(w, 5400); const fxN = obs.fx.length; const wid = w.id; const at = obs.peer(wid);
    if (cpW) w.ws.close();
    const body = await until(9000, () => (obs.bodies || []).find(b => b.k === wid), 200), rep = obs.fx.slice(fxN).filter(f => f.id === wid);
    const w2 = await client(room, 'W'); await sleep(300); w2.pos(3300, LY); await sleep(400);
    check('LC3 closing the connection while held forfeits the capture: the victim dies where it was held (one replay, one corpse); reconnecting is a new player, not the held one set free',
      cpW && body && rep.length === 1 && at && Math.hypot(body.x - at.x, body.y - at.y) < 160 && w2.id !== wid && !(obs.last.p || []).some(p => p.id === wid),
      cpW ? `held at ${at && at.x},${at && at.y}; after closing: replays ${rep.length} (${rep.map(f => f.srv ? 'server' : 'client').join(',')}), corpse ${body ? 'at ' + body.x + ',' + body.y + ' with its ' + body.eq.kind : 'NONE'}; the new connection is player #${w2.id} (was #${wid})` : 'could not arrange a capture');

    for (let k = 0; k < 4; k++) adm.tx({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(300);     // (no hound near the spawn spots the next checks choose)
    /* LC4: the legitimate transitions still work */
    const n = await client(room, 'NEWRUN'); n.pos(3300, LY); await sleep(500);
    const a0 = obs.peer(n.id);
    n.tx({ t: 'join' }); await sleep(300); n.pos(8000, LY); await sleep(400); const a1 = obs.peer(n.id);
    n.tx({ t: 'leave' }); await sleep(300); const inMenu1 = !(obs.last.p || []).some(p => p.id === n.id);
    n.tx({ t: 'fx', k: 'vanish', x: a1.x, y: a1.y, a: 0 }); await sleep(2400);
    n.tx({ t: 'leave' }); await sleep(300); const inMenu2 = !(obs.last.p || []).some(p => p.id === n.id);
    n.tx({ t: 'join' }); await sleep(150); n.pos(3600, LY); await sleep(500); const a2 = obs.peer(n.id);
    n.tx({ t: 'fx', k: 'vanish', x: 3600, y: LY, a: 0 }); await sleep(2400); n.tx({ t: 'leave' }); await sleep(300); const inMenu3 = !(obs.last.p || []).some(p => p.id === n.id);
    check('LC4 NEW RUN only through its sequence: a bare join or leave while alive does nothing; vanish (2.7 s on screen) -> leave -> join starts a run at the client\'s spawn choice; a second vanish within 30 s does not',
      a0 && a1 && Math.hypot(a1.x - a0.x, a1.y - a0.y) < 30 && !inMenu1 && inMenu2 && a2 && Math.hypot(a2.x - 3600, a2.y - LY) < 3 && !inMenu3,
      `bare join then a "spawn" 4700 px away: stayed at ${a1 && a1.x},${a1 && a1.y}; bare leave: ${inMenu1 ? 'LEFT' : 'refused'}; vanish + leave: ${inMenu2 ? 'in the menu' : 'REFUSED'}; join: new run at ${a2 && a2.x},${a2 && a2.y}; second vanish within 30 s + leave: ${inMenu3 ? 'LEFT' : 'refused'}`);
    const d = await client(room, 'D', { admin: true }); d.pos(5000, LY); await sleep(150); d.pos(5000, LY); await sleep(200);
    d.tx({ t: 'a', c: 'capmode', mode: 'quick' }); d.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(400); const dead1 = !!(d.last && d.last.me);
    d.tx({ t: 'respawn' }); await sleep(300); const back = obs.peer(d.id);
    d.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(400); adm.tx({ t: 'a', c: 'revive', id: d.id }); await sleep(300); d.tx({ t: 'respawn' }); await sleep(300); const rev = obs.peer(d.id);
    const fresh = await client(room, 'FRESH'); fresh.pos(3200, LY); await sleep(400); const fr = obs.peer(fresh.id);
    adm.tx({ t: 'a', c: 'capmode', mode: 'play' });
    for (const c of [w2, n, d, fresh]) c.ws.close(); await sleep(300);
    check('LC5 death -> respawn, admin revive -> respawn, and joining from the menu (a new connection) all still work', dead1 && back && back.d === 0 && rev && rev.d === 0 && fr && Math.hypot(fr.x - 3200, fr.y - LY) < 3,
      `died ${dead1}, respawned alive ${back && back.d === 0} at ${back && back.x},${back && back.y}; revived + respawned alive ${rev && rev.d === 0}; a new player's spawn choice ${fr && fr.x},${fr && fr.y}`);

    for (let k = 0; k < 4; k++) adm.tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let k = 0; k < 6; k++) adm.tx({ t: 'a', c: 'smilers', mode: 'remove' }); adm.tx({ t: 'a', c: 'freeze', on: 1 }); await sleep(300);   // no monster in the way of the movement checks (the world is frozen for them)
    /* SP: sub-pixel steps into a wall */
    let wall = null;
    for (let y = 600; y < 6600 && !wall; y += 96) for (let x = 600; x < 8900 && !wall; x += 96) { if (!S.clearAt(x, y, 22) || Math.hypot(x - Ic.x, y - Ic.y) < 1500) continue; for (let k = 110; k <= 250 && !wall; k += 20) if (S.clearAt(x, y - k, 22) && !S.moveOk(x, y, x, y - k, 700)) { let f = y; while (S.clearAt(x, f - 1, 15)) f--; wall = { x, y, face: f, far: y - k }; } }
    const sp = await client(room, 'SUBPX'); const res = [];
    for (const step of [0.5, 0.2]) {
      adm.pos(wall.x, wall.face + 40); await sleep(150); adm.pos(wall.x, wall.face + 40); await sleep(150); adm.tx({ t: 'a', c: 'bring', id: sp.id }); await sleep(300);
      let y = wall.face + 40; sp.pos(wall.x, y); await sleep(600); const tp0 = sp.tps.length; let minY = 1e9;
      const n = Math.ceil((40 + (wall.face - wall.far) + 30) / step);
      for (let k = 0; k < n; k++) { y -= step; sp.pos(wall.x, +y.toFixed(3)); await sleep(12); const q = obs.peer(sp.id); if (q) minY = Math.min(minY, q.y); }
      await sleep(400); const q = obs.peer(sp.id);
      res.push({ step, n, claimed: +y.toFixed(1), end: q && q.y, minY, inside: q ? !S.clearAt(q.x, q.y, 1) : null, corr: sp.tps.length - tp0 });
    }
    check('SP1 an ordinary client pushing into a wall in 0.5 px and 0.2 px steps never gets into or through it', wall && res.every(r => r.end !== null && r.minY >= wall.face - 16 && r.end > wall.far + 20 && !r.inside),
      wall ? `wall face at y ${wall.face} (open again at ${wall.far}): ` + res.map(r => `${r.n} steps of ${r.step} px (claimed y ${r.claimed}) -> stopped at y ${r.end}, never above ${r.minY}, inside the wall ${r.inside}, corrections ${r.corr}`).join('; ') : 'no wall found');

    /* MT: real move.js traces (the harness runs the shipped move.js) replayed over the wire at the client's 20 Hz by an ordinary client: no false corrections */
    const { World, DT } = require('./lib.js'), WD = require(path.join(GAME, 'world.js'));
    const rec = (setup, secs) => { const w = World(11), out = []; const pl = setup(w); let t = 0, k = 0; while (t < secs) { w.step(); t += DT; if (++k % 3 === 0) out.push([Math.round(pl.x), Math.round(pl.y), { s: pl.st, st: Math.round(pl.stamina), ex: pl.ex, sp: Math.round(pl.sp), ev: [] }]); } return out; };
    const Lw = WD.LOW.find(q => q.type === 'low'), lr = Lw.rect, acr = lr.h < lr.w, Gp = WD.CRAWL.find(c => c.type === 'gap'), g0 = Gp.exits[0], g1 = Gp.exits[1];
    const traces = {
      'walk, then sprint': rec(w => { const pl = w.player(3200, LY, {}); pl.go(3700, LY, 'walk'); return pl; }, 2.5).concat(rec(w => { const pl = w.player(3630, LY, {}); pl.go(5200, LY, 'run'); return pl; }, 5)),
      'vault a counter': rec(w => { const pl = w.player(acr ? Lw.cx : lr.x - 120, acr ? lr.y - 120 : Lw.cy, {}); pl.go(acr ? Lw.cx : lr.x + lr.w + 140, acr ? lr.y + lr.h + 140 : Lw.cy, 'run'); return pl; }, 3),
      'crouch + crawl through a wall hole': rec(w => { const pl = w.player(g0.x + g0.nx * 80, g0.y + g0.ny * 80, {}); pl.route([{ x: g0.x, y: g0.y }, { x: g1.x + g1.nx * 60, y: g1.y + g1.ny * 60 }], 'crouch'); return pl; }, 8),
      'sprint + slide': rec(w => { const pl = w.player(5200, LY, {}); pl.go(6600, LY, 'run'); w.run(1.2, null); pl.slide(); return pl; }, 3) };
    const mt = [];
    for (const [name, tr] of Object.entries(traces)) for (const bunch of [0, 8]) {
      const [x0, y0] = tr[0]; adm.pos(x0, y0); await sleep(150); adm.pos(x0, y0); await sleep(150); adm.tx({ t: 'a', c: 'bring', id: sp.id }); await sleep(300);
      sp.pos(x0, y0, tr[0][2]); await sleep(1600); const tq = sp.tps.length; let pend = [];
      for (let k = 1; k < tr.length; k++) { const q = tr[k]; if (bunch && k % bunch) { pend.push(q); await sleep(50); continue; } for (const u of pend) { sp.pos(u[0], u[1], u[2]); await sleep(32); } pend = []; sp.pos(q[0], q[1], q[2]); await sleep(50); }
      for (const u of pend) { sp.pos(u[0], u[1], u[2]); await sleep(32); }
      await sleep(400); const e = tr[tr.length - 1], q = obs.peer(sp.id);
      mt.push({ name: name + (bunch ? ' (lag bursts)' : ''), corr: sp.tps.length - tq, gap: q ? Math.round(Math.hypot(q.x - e[0], q.y - e[1])) : -1, states: [...new Set(tr.map(u => u[2].s))].join('') });
    }
    check('MT1 real move.js traces (walk, sprint, vault, crouch, crawl through a hole, slide; plain and in lag bursts) sent by an ordinary client: no correction, the server ends where the client does', mt.every(r => r.corr === 0 && r.gap >= 0 && r.gap <= 2),
      mt.map(r => `${r.name} [states ${r.states}]: corrections ${r.corr}, end gap ${r.gap} px`).join(' · '));
    sp.ws.close(); await sleep(200);
    for (let k = 0; k < 4; k++) adm.tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let k = 0; k < 6; k++) adm.tx({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(300);
    /* NZ: what the AI hears */
    const z = await client(room, 'NOISE'); const hear = async (label, speed, mv, secs = 1.6) => {
      adm.pos(3200, LY); await sleep(150); adm.pos(3200, LY); await sleep(120); adm.tx({ t: 'a', c: 'bring', id: z.id }); await sleep(250); z.pos(3200, LY, mv); await sleep(600);
      let x = 3200; const seen = []; const t0 = Date.now();
      while (Date.now() - t0 < secs * 1000) { x += speed * .05; z.pos(Math.round(x), LY, mv); await sleep(50); const q = obs.peer(z.id); if (q && Date.now() - t0 > 700) seen.push(q.mv[0] + '/' + q.mv[1]); }
      const last = seen.slice(-8), states = last.map(s => +s.split('/')[0]), sps = last.map(s => +s.split('/')[1]);
      return { label, states: [...new Set(states)].join(','), sp: Math.round(sps.reduce((a, b) => a + b, 0) / Math.max(1, sps.length)), tail: last.slice(-3).join(' ') };
    };
    const cases = [
      await hear('no report, running', 280, null), await hear('garbled report (array), running', 280, [0, 0, 100, 0]), await hear('report says standing, running', 280, { s: 0, st: 100, ex: 0, sp: 0, ev: [] }),
      await hear('honest standing', 0, { s: 0, st: 100, ex: 0, sp: 0, ev: [] }), await hear('honest walking', 172, { s: 1, st: 100, ex: 0, sp: 172, ev: [] }),
      await hear('honest crouch-walk', 92, { s: 3, st: 100, ex: 0, sp: 92, ev: [] }), await hear('honest crawl', 54, { s: 4, st: 100, ex: 0, sp: 54, ev: [] }), await hear('honest run', 285, { s: 2, st: 100, ex: 0, sp: 285, ev: [] }),
      await hear('no report, standing', 0, null), await hear('no report, crouch pace', 90, null)];
    const want = { 'no report, running': '2', 'garbled report (array), running': '2', 'report says standing, running': '2', 'honest standing': '0', 'honest walking': '1', 'honest crouch-walk': '3', 'honest crawl': '4', 'honest run': '2', 'no report, standing': '0', 'no report, crouch pace': '3' };
    check('NZ1 no report / a garbled one / a false one cannot make running silent; honest standing, walking, crouching, crawling and running are heard as they are (not louder)', cases.every(c => c.states === want[c.label]),
      cases.map(c => `${c.label}: heard as ${c.states} (${c.sp} px/s)${c.states === want[c.label] ? '' : ' WANTED ' + want[c.label]}`).join(' · ') + '   (0 stand, 1 walk, 2 run, 3 crouch, 4 crawl)');

    z.ws.close(); adm.tx({ t: 'a', c: 'freeze', on: 0 }); await sleep(200);
    /* DD: the death is recorded when the server commits it */
    const dd = [];
    for (const mode of ['after-ack', 'at-once', 'after-ack', 'at-once', 'after-ack', 'at-once']) {
      const k = await client(room, 'K' + dd.length, { admin: true }); const x = 3800 + dd.length * 180; k.pos(x, LY); await sleep(150); k.pos(x, LY); await sleep(200);
      adm.tx({ t: 'a', c: 'capmode', mode: 'quick' }); await sleep(100); const fx0 = obs.fx.length, kid = k.id;
      k.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' });
      if (mode === 'at-once') k.ws.close();                                   // the close frame right behind the command
      else { await until(3000, () => k.ares.find(a => /PLAYING/.test(a.msg))); k.ws.close(); }
      const b = await until(9000, () => (obs.bodies || []).find(q => q.k === kid), 200); await sleep(800);
      dd.push({ mode, kid, fx: obs.fx.slice(fx0).filter(f => f.id === kid).length, bodies: (obs.bodies || []).filter(q => q.k === kid).length, b: !!b });
    }
    adm.tx({ t: 'a', c: 'capmode', mode: 'auto' });
    const late = await client(room, 'LATE', { join: false }); await sleep(600);
    const lateN = dd.filter(r => (late.bodies || []).some(q => q.k === r.kid)).length;
    check('DD1 the victim leaves right after the kill (after the acknowledgement, or with the close frame right behind the command): one replay, one corpse, every time; a late joiner gets them all',
      dd.every(r => r.fx === 1 && r.bodies === 1) && lateN === dd.length, dd.map(r => `${r.mode}: replays ${r.fx}, corpses ${r.bodies}`).join(' · ') + ` · late joiner has ${lateN}/${dd.length}`);

    /* DD2: a connected victim still makes its own replay and corpse (the normal path), and the server adds nothing */
    const c2 = await client(room, 'NORMAL', { admin: true }); c2.pos(5600, LY); await sleep(150); c2.pos(5600, LY); await sleep(200); const fxc = obs.fx.length;
    adm.tx({ t: 'a', c: 'capmode', mode: 'quick' }); c2.tx({ t: 'a', c: 'preview', k: 'hound', var: 'B' }); await sleep(300);
    c2.tx({ t: 'fx', k: 'death', c: 'Hound', x: 5600, y: LY, a: 0, sx: 5560, sy: LY, v: 'B', w: 0, lk: 'none|plain|#e6bb76|#ffcc77|none', ek: 'headlamp', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, ex: 0 });
    await sleep(1200); c2.tx({ t: 'b', n: 'NORMAL', x: 5650, y: LY, a: 1, sx: 1, sy: 1, c: 'Hound', aa: 0, lk: 'none|plain|#e6bb76|#ffcc77|none', ek: 'headlamp', ec: '#ffe7b2', ep: '', bl: [], dr: [5660, LY, 0], ht: [5640, LY, 0], hd: [1, 2, 3, 4], ph: 1, ho: 0, tr: [] });
    await sleep(14000);                                                       // past the connected-victim fallback deadline (death + 8 s)
    const r2 = obs.fx.slice(fxc).filter(f => f.id === c2.id), b2 = (obs.bodies || []).filter(q => q.k === c2.id);
    check('DD2 a connected victim: its own replay and corpse, exactly one of each, nothing added by the server even after the fallback deadline', r2.length === 1 && !r2[0].srv && b2.length === 1 && !b2[0].srv && b2[0].eq.kind === 'headlamp', `replays ${r2.map(f => f.srv ? 'server' : 'client').join(',') || 'none'}; corpses ${b2.map(q => q.srv ? 'server' : 'client').join(',') || 'none'}`);
    adm.tx({ t: 'a', c: 'capmode', mode: 'auto' });
    for (const c of [adm, obs, v, w2, n, d, fresh, sp, z, late, c2]) try { c.ws.close(); } catch { }
    await sleep(300);
    check('H3 no server errors during all of the above', exited === null && !/TypeError|ReferenceError|RangeError|fallback failed/.test(log), exited === null ? 'server alive; ' + (log.split('\n').filter(l => /\[death\]/.test(l)).length) + ' server-made corpses logged' : 'server EXITED ' + exited);
  } finally { srv.kill(); }
  const f = R.filter(r => !r.ok); console.log(`\n${R.length - f.length}/${R.length} passed` + (f.length ? '\nFAILED: ' + f.map(r => r.name).join('; ') : '')); process.exitCode = f.length ? 1 : 0;
})();
