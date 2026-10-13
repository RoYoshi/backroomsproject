/* Stage 3D HQ2 - four older checks whose fixture stacks players, re-run with the stacking taken out (development only)
 *
 *   node dev/stage-3d-hq2/old_fixtures.js --game DIR --out FILE.json
 *
 * Under HQ2 two living players never share a spot: a player brought to an admin who stands in the world lands beside it (>= 44 px), a
 * respawn on a spawn point someone stands on lands beside them, and a claim onto a standing player stops at contact.  Four older checks
 * (dev/tests, left exactly as they are) build their fixture by doing just that, with their own admin standing in the world:
 *   audit_net A1   an admin at (4000, 3504) brings a player and expects him exactly there (on the admin)
 *   audit_net M4   the same bring to one side of a wall, then a short hop through the wall: expects him refused AT the admin's spot
 *   audit_net R2   a dead player respawns and is expected within 40 px of the level's spawn point, where another player is standing
 *   audit_net2 MT1 real move.js traces sent by an ordinary player brought onto their first point, where the admin is standing: expects
 *                  no correction at all
 * Here the same checks run with the admin OUT of the world (a quiet admin connection that never joins: not a body), so the old intent is
 * tested on its own - and each is run once more with a body in the way, to show the HQ2 rule instead of the old fixture:
 *   A1h  brought exactly where the admin is; then carries on from there.  A1b: with a joined admin there, beside it (>= 44 px)
 *   M4h  brought to one side of a wall; a short hop through it refused (stays within 4 px), no way round
 *   R2h  a dead player respawns at the spawn point (within 40 px, alive, no correction).  R2b: with someone standing on the spawn point,
 *        on the nearest free spot (>= 44 px from them, within 240 px of the spawn point)
 *   MT1h the same real move.js traces (walk then sprint, vault a counter, crouch + crawl through a wall hole, sprint + slide; plain and in
 *        lag bursts): no correction, the server ends where the client does (within 2 px) */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || '.'), PASS = 'd3-synthetic-admin';
const createSim = require(path.join(GAME, 'sim.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const out = { tool: 'dev/stage-3d-hq2/old_fixtures.js', game: GAME, checks: [] };
const check = (name, ok, info) => { out.checks.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(info).slice(0, 400)); };
let PORT;
async function client(room, name, o = {}) {                                // o.join: enter the world; o.admin: the synthetic passcode (quiet)
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`), c = { ws, id: 0, tps: [], last: null };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.t === 'hi') c.id = m.id; else if (m.t === 's') c.last = m; else if (m.t === 'tp') c.tps.push(m); };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = m => ws.readyState === 1 && ws.send(JSON.stringify(m));
  c.pos = (x, y, mv) => c.tx({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: mv || { s: 0, st: 100, ex: 0, sp: 0, ev: [] } });
  c.peer = id => c.last && (c.last.p || []).find(q => q.id === id);
  await sleep(150);
  if (o.join) { c.tx({ t: 'join' }); await sleep(250); }
  if (o.admin) { c.tx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(200); }
  return c;
}
const clearMonsters = async adm => { for (let k = 0; k < 6; k++) adm.tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let k = 0; k < 8; k++) adm.tx({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(300); };
const place = async (adm, who, x, y) => { adm.pos(x, y); await sleep(150); adm.pos(x, y); await sleep(150); adm.tx({ t: 'a', c: 'bring', id: who.id }); await sleep(300); };

(async () => {
  PORT = await freePort();
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  await sleep(1200);
  try {
    const S = createSim({ seed: 1 }), Ic = S.debug.Ic, LY = 3504;
    let wallPair = null;                                                     // (audit_net's own search)
    for (let y = 600; y < 6600 && !wallPair; y += 96) for (let x = 600; x < 8900 && !wallPair; x += 96) for (const [dx, dy] of [[0, -1], [1, 0]]) { if (wallPair) break; for (let k = 110; k <= 250 && !wallPair; k += 20) { const x2 = x + dx * k, y2 = y + dy * k; if (S.clearAt(x, y, 22) && S.clearAt(x2, y2, 22) && !S.moveOk(x, y, x2, y2, 700)) wallPair = [x, y, x2, y2]; } }
    const room = 'oldfx' + PORT;
    const adm = await client(room, 'ADMIN', { admin: true }), obs = await client(room, 'OBS', { admin: true }), a = await client(room, 'A', { join: true });
    await clearMonsters(adm); adm.tx({ t: 'a', c: 'god', id: a.id });
    /* A1h */
    await place(adm, a, 4000, LY); const brought = a.tps.find(t => t.x === 4000 && t.y === LY);
    a.pos(4000, LY); await sleep(300); const s0 = obs.peer(a.id);
    check('A1h (audit_net A1, the admin out of the world) admin BRING still moves people, exactly to the spot, and they carry on from there', brought && s0 && s0.x === 4000 && s0.y === LY, { tp: brought, server: s0 && [s0.x, s0.y] });
    const J = await client(room, 'JADMIN', { join: true }); J.tx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(200); await clearMonsters(adm);
    J.pos(4300, LY); await sleep(150); J.pos(4300, LY); await sleep(200);
    J.tx({ t: 'a', c: 'bring', id: a.id }); await sleep(300); const tb = a.tps[a.tps.length - 1]; a.pos(tb.x, tb.y); await sleep(300); const s0b = obs.peer(a.id), j0 = obs.peer(J.id);
    check('A1b (the HQ2 rule) with a joined admin standing there, BRING puts him beside it: >= 44 px from the admin, told by tp, and he carries on from there', s0b && j0 && Math.hypot(s0b.x - j0.x, s0b.y - j0.y) >= 44 && s0b.x === tb.x && s0b.y === tb.y, { admin: j0 && [j0.x, j0.y], him: s0b && [s0b.x, s0b.y], tp: tb });
    J.ws.close(); await sleep(300);
    /* M4h */
    await place(adm, a, wallPair[0], wallPair[1]); a.pos(wallPair[0], wallPair[1]); await sleep(1100);
    const sb = obs.peer(a.id), tp3 = a.tps.length; a.pos(wallPair[2], wallPair[3]); await sleep(100); a.pos(wallPair[2], wallPair[3]); await sleep(400); const s5 = obs.peer(a.id);
    check('M4h (audit_net M4, the admin out of the world) a short hop through a wall is refused: he stays on his side', sb && sb.x === wallPair[0] && sb.y === wallPair[1] && s5 && Math.hypot(s5.x - wallPair[0], s5.y - wallPair[1]) < 4,
      { from: wallPair.slice(0, 2), to: wallPair.slice(2), before: sb && [sb.x, sb.y], after: s5 && [s5.x, s5.y], corrections: a.tps.length - tp3 });
    /* R2h, R2b */
    const w2 = await client(room, 'W2', { join: true }); w2.tx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(200); await clearMonsters(adm);       // (an admin only to play the death preview on itself)
    w2.pos(5600, LY); await sleep(150); w2.pos(5600, LY); await sleep(300);
    w2.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(1500); await clearMonsters(adm);
    const tpR = w2.tps.length; w2.tx({ t: 'respawn' }); await sleep(400); const w2s = obs.peer(w2.id);
    check('R2h (audit_net R2, nobody on the spawn point) a dead player can respawn: back at the spawn point, alive, no correction', w2s && w2s.d === 0 && Math.hypot(w2s.x - Ic.x, w2s.y - Ic.y) < 40 && w2.tps.length === tpR, { at: w2s && [w2s.x, w2s.y], spawn: [Ic.x, Ic.y], dead: w2s && w2s.d });
    w2.pos(6000, LY); await sleep(150); w2.pos(6000, LY); await sleep(300);                // (his page's spawn choice after that respawn: away from the spawn point)
    const st = await client(room, 'STANDER', { join: true }); await clearMonsters(adm); await place(adm, st, Ic.x, Ic.y); st.pos(Ic.x, Ic.y); await sleep(400);
    w2.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(1500); await clearMonsters(adm);
    w2.tx({ t: 'respawn' }); await sleep(400); const w2b = obs.peer(w2.id), stp = obs.peer(st.id);
    check('R2b (the HQ2 rule) someone stands on the spawn point: the respawn lands on the nearest free spot (>= 44 px from them, within 240 px of the spawn point), alive', w2b && stp && stp.x === Ic.x && stp.y === Ic.y && w2b.d === 0 && Math.hypot(w2b.x - stp.x, w2b.y - stp.y) >= 44 && Math.hypot(w2b.x - Ic.x, w2b.y - Ic.y) <= 240,
      { at: w2b && [w2b.x, w2b.y], stander: stp && [stp.x, stp.y], spawn: [Ic.x, Ic.y] });
    st.ws.close(); w2.ws.close(); await sleep(300);
    /* MT1h */
    adm.tx({ t: 'a', c: 'freeze', on: 1 }); await clearMonsters(adm);
    const { World, DT } = require(path.join(__dirname, '..', 'tests', 'lib.js')), WD = require(path.join(GAME, 'world.js'));
    const rec = (setup, secs) => { const w = World(11), o = []; const pl = setup(w); let t = 0, k = 0; while (t < secs) { w.step(); t += DT; if (++k % 3 === 0) o.push([Math.round(pl.x), Math.round(pl.y), { s: pl.st, st: Math.round(pl.stamina), ex: pl.ex, sp: Math.round(pl.sp), ev: [] }]); } return o; };
    const Lw = WD.LOW.find(q => q.type === 'low'), lr = Lw.rect, acr = lr.h < lr.w, Gp = WD.CRAWL.find(c => c.type === 'gap'), g0 = Gp.exits[0], g1 = Gp.exits[1];
    const traces = {                                                         // (audit_net2 MT1's own traces)
      'walk, then sprint': rec(w => { const pl = w.player(3200, LY, {}); pl.go(3700, LY, 'walk'); return pl; }, 2.5).concat(rec(w => { const pl = w.player(3630, LY, {}); pl.go(5200, LY, 'run'); return pl; }, 5)),
      'vault a counter': rec(w => { const pl = w.player(acr ? Lw.cx : lr.x - 120, acr ? lr.y - 120 : Lw.cy, {}); pl.go(acr ? Lw.cx : lr.x + lr.w + 140, acr ? lr.y + lr.h + 140 : Lw.cy, 'run'); return pl; }, 3),
      'crouch + crawl through a wall hole': rec(w => { const pl = w.player(g0.x + g0.nx * 80, g0.y + g0.ny * 80, {}); pl.route([{ x: g0.x, y: g0.y }, { x: g1.x + g1.nx * 60, y: g1.y + g1.ny * 60 }], 'crouch'); return pl; }, 8),
      'sprint + slide': rec(w => { const pl = w.player(5200, LY, {}); pl.go(6600, LY, 'run'); w.run(1.2, null); pl.slide(); return pl; }, 3) };
    const sp = await client(room, 'SUBPX', { join: true }); await clearMonsters(adm); const mt = [];
    for (const [name, tr] of Object.entries(traces)) for (const bunch of [0, 8]) {
      const [x0, y0] = tr[0]; await place(adm, sp, x0, y0);
      sp.pos(x0, y0, tr[0][2]); await sleep(1600); const tq = sp.tps.length; let pend = [];
      for (let k = 1; k < tr.length; k++) { const q = tr[k]; if (bunch && k % bunch) { pend.push(q); await sleep(50); continue; } for (const u of pend) { sp.pos(u[0], u[1], u[2]); await sleep(32); } pend = []; sp.pos(q[0], q[1], q[2]); await sleep(50); }
      for (const u of pend) { sp.pos(u[0], u[1], u[2]); await sleep(32); }
      await sleep(400); const e = tr[tr.length - 1], q = obs.peer(sp.id);
      mt.push({ name: name + (bunch ? ' (lag bursts)' : ''), corr: sp.tps.length - tq, gap: q ? Math.round(Math.hypot(q.x - e[0], q.y - e[1])) : -1 });
    }
    check('MT1h (audit_net2 MT1, the admin out of the world) real move.js traces by an ordinary client: no correction, the server ends where the client does', mt.every(r => r.corr === 0 && r.gap >= 0 && r.gap <= 2), mt);
    adm.tx({ t: 'a', c: 'freeze', on: 0 });
  } finally { srv.kill('SIGTERM'); }
  out.ok = out.checks.length === 6 && out.checks.every(c => c.ok);
  if (ARG.out) { fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n'); fs.writeFileSync(ARG.out.replace(/\.json$/, '') + '.server.log', log); }
  console.log(`${out.checks.filter(c => c.ok).length}/${out.checks.length} checks passed`);
  process.exit(out.ok ? 0 : 1);
})();
