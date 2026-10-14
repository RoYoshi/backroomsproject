/* Stage 3H1 - B++ golden-trace scenarios for Stage 3H0's closed-world server harness (development only; never served).
 *
 *   node dev/stage-3h0/golden/srv_harness.js --src SERVER_JS --dir GAME_DIR --scenario NAME --out TRACE.jsonl --scenarios THIS_FILE
 *   (dev/stage-3h/golden/bpp_golden.js runs them all, old against new, and writes the baseline)
 *
 * Stage 3H0's eleven scenarios were written for the QA2 parent: they never ask 'caps', so they cannot see B+'s fresher poses or B++-0's
 * placement guard, and none of them reaches Stage 3D's NEW RUN decision.  These six do (3H1 wrote five; Stage 3H2's H2-0 added
 * bpp_new_run_held, which leaves the other five's traces byte for byte as they were), in the same fake-clock world (seeded randomness, fake
 * timers and sockets, the real sim), so the accepted B++ server's answers are pinned byte for byte:
 *   bpp_caps_q        Fast and Mover ask {t:'caps', fp:1}; Old never asks; Odd asks with fp:0; Away asks in another room.  The Mover walks,
 *                     stops, walks again; a world reset; the Mover dies (an admin preview kill) and is removed from 'q'; Fast leaves.
 *                     Recorded: the caps answers, every 'q' and 's' (with k only for clients that asked), what Old, Odd and Away get
 *   bpp_place_guard   the Mover stands at (504, 888); the quiet admin BRINGs it to (1012, 690), 545 px away along a free line; the Mover
 *                     keeps sending its old spot for 75 ms (stale poses), then the new spot, then walks east at once.  Then the same
 *                     placement again after the 900 ms grace with no stale pose, and a far claim 150 ms after a third placement
 *   bpp_world_guard   the Mover stands at (1454, 3494), 545 px from the reset spot (960, 3264); an admin world reset; stale poses for
 *                     75 ms, then the reset spot, then a walk
 *   bpp_known_limits  the two caveats of the B++ report, as they are: an admin's own GOTO followed by 75 ms of stale poses (admins are
 *                     not checked, so the stale spot is taken for a moment), and a BRING whose stale pose arrives 950 ms later, after
 *                     the 900 ms grace (taken as an ordinary move: the placement is undone and the next pose is corrected back)
 *   bpp_new_run       NEW RUN as the server decides it: approved (the blast replay, then the corpse), the same press again, refused from
 *                     the menu (state), a flood, an older and malformed presses (no answer), refused in the cooldown (with the wait), refused
 *                     after an admin world reset (epoch), an admin's UNLIMITED NEW RUN on and off (nrf), refused while dead
 *   bpp_new_run_held  NEW RUN pressed while an entity holds the player (3H1's audit found no golden reaching sim.nrWhy's 'held'): the
 *                     Runner, an admin not in god mode, sets the capture style to "play", places a Hound near itself and summons it; once
 *                     a snapshot says it is held (s.cp), it presses NEW RUN, and again 300 ms later (both refused: held); then the hold
 *                     plays out to its end
 * Coordinates are the ones B++-0's evidence used on the real server (dev/stage-3e-0-bpp/evidence/p0), chosen with the real sim's geometry.
 * The helpers P, MV and walk are copies of srv_scenarios.js's (that file exports only its scenarios). */
'use strict';
const LOOK2 = 'none|plain|#e6bb76|#ffcc77|none';
const P = (x, y, o = {}) => Object.assign({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, ir: 0, k: 'flashlight', lp: '#ffe7b2,#333333,#888888', n: 'QA', c: '#ffe7b2', f: -1, lk: LOOK2 }, o);
const MV = (s = 1, sp = 150, st = 100, ex = 0, ev) => Object.assign({ s, sp, st, ex }, ev ? { ev } : {});
const PASS = 'h0-synthetic-admin';
function walk(H, c, sim, x, y, a, n, step = 8, dt = 50, extra = {}) {
  for (let i = 0; i < n; i++) {
    const nx = Math.round(x + Math.cos(a) * step), ny = Math.round(y + Math.sin(a) * step);
    if (!sim.clearAt(nx, ny, 22)) { H.note('walk blocked at ' + nx + ',' + ny); break; }
    x = nx; y = ny; H.advance(dt);
    c.send(P(x, y, Object.assign({ vx: Math.round(Math.cos(a) * step * 1000 / dt), vy: Math.round(Math.sin(a) * step * 1000 / dt), a: +a.toFixed(2), mv: MV(1, step * 1000 / dt) }, extra)));
  }
  return { x, y };
}
function coverage(H, clients) {
  const o = {};
  for (const c of clients) { const k = {}; for (const m of c.rx) { const t = m.t || ('op' + m.__op); k[t] = (k[t] || 0) + 1; } o[c.cid] = k; }
  H.out('coverage', o);
}
/* a quiet admin that never joins: removes the monsters, makes the listed players immortal, places by BRING */
function quietAdmin(H, room, ip) {
  const A = H.connect('/ws?room=' + room, { ip, label: 'adm' });
  A.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30);
  return {
    A,
    clear() { for (let i = 0; i < 6; i++) A.send({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) A.send({ t: 'a', c: 'smilers', mode: 'remove' }); },
    god(id) { A.send({ t: 'a', c: 'god', id }); },
    bring(id, x, y) { A.send(P(x, y, { n: 'PLACER', l: 0 })); H.advance(80); A.send({ t: 'a', c: 'bring', id }); },
  };
}
/* a joined player whose first pose (its chosen spawn) is (x, y) */
function player(H, room, ip, label, x, y, caps) {
  const c = H.connect('/ws?room=' + room, { ip, label });
  if (caps !== undefined) c.send({ t: 'caps', fp: caps });
  c.send({ t: 'join' }); H.advance(30); c.send(P(x, y, { n: label, mv: MV(0, 0) })); H.advance(30);
  return c;
}
/* the poses a page sends at 25 ms (B+ after its caps answer): `n` packets at (x, y) */
function hold(H, c, x, y, n, extra = {}) { for (let i = 0; i < n; i++) { H.advance(25); c.send(P(x, y, Object.assign({ n: c.cid, mv: MV(0, 0) }, extra))); } }

module.exports = {
  async bpp_caps_q(H) {
    const room = 'bppq', sim = () => H.sims[H.sims.length - 1];
    const Q = quietAdmin(H, room, '203.0.113.60');
    const F = player(H, room, '203.0.113.61', 'Fast', 504, 888, 1), O = player(H, room, '203.0.113.62', 'Old', 600, 888), M = player(H, room, '203.0.113.63', 'Mover', 700, 888, 1);
    const D = player(H, room, '203.0.113.64', 'Odd', 800, 888, 0), W = player(H, 'bppq_other', '203.0.113.65', 'Away', 504, 888, 1);
    Q.clear(); for (const c of [F, O, M, D]) Q.god(c.id); H.advance(200);
    H.note('caps asked twice, and with a malformed fp'); F.send({ t: 'caps', fp: 1 }); O.send({ t: 'caps', fp: '1' }); O.send({ t: 'caps' }); H.advance(50);
    H.note('nobody moves for 0.5 s'); for (let i = 0; i < 20; i++) { H.advance(25); for (const c of [F, O, M, D, W]) c.send(P(c === F ? 504 : c === O ? 600 : c === M ? 700 : c === D ? 800 : 504, 888, { n: c.cid, mv: MV(0, 0) })); }
    H.note('the Mover walks east 40 steps at 25 ms (B+ cadence)'); let pos = walk(H, M, sim(), 700, 888, 0, 40, 6, 25, { n: 'Mover' });
    H.note('the Mover stops'); hold(H, M, pos.x, pos.y, 12);
    H.note('world reset'); Q.A.send({ t: 'a', c: 'world' }); H.advance(60);
    const tp = M.last('tp'); pos = tp ? { x: tp.x, y: tp.y } : pos; hold(H, M, pos.x, pos.y, 4);
    H.note('the Mover walks again'); pos = walk(H, M, sim(), pos.x, pos.y, 0, 20, 6, 25, { n: 'Mover' });
    H.note('the Mover dies (an admin preview kill on the Mover itself: it works through god mode)'); M.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30); M.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' });
    for (let i = 0; i < 40; i++) { H.advance(25); M.send(P(pos.x + (i % 2 ? 3 : -3), pos.y, { n: 'Mover', mv: MV(1, 120) })); }
    H.note('Fast leaves'); F.close(); H.advance(300);
    coverage(H, [Q.A, F, O, M, D, W]);
  },

  async bpp_place_guard(H) {
    const room = 'bppg', Q = quietAdmin(H, room, '203.0.113.70');
    const M = player(H, room, '203.0.113.71', 'Mover', 504, 888, 1), O = player(H, room, '203.0.113.72', 'Watch', 2000, 888);
    Q.clear(); Q.god(M.id); Q.god(O.id); H.advance(1200);
    const steady = n => { for (let i = 0; i < n; i++) { H.advance(25); M.send(P(504, 888, { n: 'Mover', mv: MV(0, 0) })); O.send(P(2000, 888, { n: 'Watch', mv: MV(0, 0) })); } };
    steady(20);
    H.note('BRING 545 px; 75 ms of stale poses at the old spot, then the new spot and an immediate walk east');
    Q.bring(M.id, 1012, 690); H.advance(5);
    hold(H, M, 504, 888, 3);
    let x = 1012; hold(H, M, x, 690, 1);
    for (let i = 0; i < 20; i++) { H.advance(25); x += 7; M.send(P(x, 690, { n: 'Mover', vx: 280, a: 0, mv: MV(1, 280) })); }
    hold(H, M, x, 690, 40);
    H.note('back to the old spot by BRING; no stale pose this time'); Q.bring(M.id, 504, 888); H.advance(5); hold(H, M, 504, 888, 48);
    H.note('BRING again; a far claim (500 px) 150 ms after it'); Q.bring(M.id, 1012, 690); H.advance(5); hold(H, M, 1012, 690, 6); hold(H, M, 1512, 690, 4); hold(H, M, 1012, 690, 40);
    coverage(H, [Q.A, M, O]);
  },

  async bpp_world_guard(H) {
    const room = 'bppw', Q = quietAdmin(H, room, '203.0.113.80');
    const M = player(H, room, '203.0.113.81', 'Mover', 504, 888, 1);
    Q.clear(); Q.god(M.id); H.advance(200);
    Q.bring(M.id, 1454, 3494); H.advance(5); hold(H, M, 1454, 3494, 60);
    H.note('world reset 545 px away; 75 ms of stale poses, then the reset spot and a walk');
    Q.A.send({ t: 'a', c: 'world' }); H.advance(5);
    const tp = M.last('tp'); const tx = tp ? tp.x : 960, ty = tp ? tp.y : 3264;
    hold(H, M, 1454, 3494, 3);
    let x = tx; hold(H, M, x, ty, 1);
    for (let i = 0; i < 20; i++) { H.advance(25); x += 7; M.send(P(x, ty, { n: 'Mover', vx: 280, a: 0, mv: MV(1, 280) })); }
    hold(H, M, x, ty, 40);
    coverage(H, [Q.A, M]);
  },

  /* the two caveats the B++ report states, pinned as they are (findings F-019 and F-020 in dev/devlog4dev/3H_FINDINGS.md; not changed) */
  async bpp_known_limits(H) {
    const room = 'bppk', Q = quietAdmin(H, room, '203.0.113.90'); Q.clear(); H.advance(100);   // (monsters out first: a spawn spot must be away from them)
    const A = player(H, room, '203.0.113.91', 'Adm', 504, 888, 1), W = player(H, room, '203.0.113.92', 'Watch', 800, 888, 1);
    Q.god(A.id); Q.god(W.id); H.advance(1200);
    A.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30);
    for (let i = 0; i < 20; i++) { H.advance(25); A.send(P(504, 888, { n: 'Adm', mv: MV(0, 0) })); W.send(P(800, 888, { n: 'Watch', mv: MV(0, 0) })); }
    H.note('an admin GOTOs the Watcher, 296 px away; its page keeps sending the old spot for 75 ms, then the spot it was sent to');
    A.send({ t: 'a', c: 'goto', id: W.id }); H.advance(5);
    const tp = A.last('tp'), ax = tp ? tp.x : 844, ay = tp ? tp.y : 888;
    hold(H, A, 504, 888, 3); hold(H, A, ax, ay, 40);
    const room2 = 'bppk2', Q2 = quietAdmin(H, room2, '203.0.113.95'); Q2.clear(); H.advance(100);
    const M = player(H, room2, '203.0.113.96', 'Mover', 504, 888, 1);
    Q2.god(M.id); H.advance(1200); hold(H, M, 504, 888, 20);
    H.note('BRING the Mover 545 px; its connection stalls for 950 ms, then one pose sent before the placement arrives, then the new spot');
    Q2.bring(M.id, 1012, 690); H.advance(950);
    hold(H, M, 504, 888, 1); hold(H, M, 1012, 690, 40);
    coverage(H, [Q.A, A, W, Q2.A, M]);
  },

  /* Stage 3D's NEW RUN decision (server.js nrIntent, boomStart; sim.nrWhy / newRun), which no Stage 3H0 scenario reaches: no golden ever sent
   * 'nr' or saw 'nra' or 'nrf' before this one */
  async bpp_new_run(H) {
    const room = 'bppn', Q = quietAdmin(H, room, '203.0.113.100'); Q.clear(); H.advance(100);
    const R = player(H, room, '203.0.113.101', 'Runner', 504, 888, 1), W = player(H, room, '203.0.113.102', 'Watch', 800, 888, 1);
    Q.god(R.id); Q.god(W.id); H.advance(300);
    const still = (n, who = [R, W]) => { for (let i = 0; i < n; i++) { H.advance(25); for (const c of who) c.send(P(c === R ? 504 : 800, 888, { n: c.cid, mv: MV(0, 0) })); } };
    const world = () => { const s = R.last('s') || W.last('s'); return s ? s.w : 0; };
    still(20);
    H.note('NEW RUN press 1: approved (the blast replay to everyone, then the corpse)'); R.send({ t: 'nr', q: 1, w: world() }); H.advance(300);
    H.note('the same press again: the same answer, no second event'); R.send({ t: 'nr', q: 1, w: world() }); H.advance(300);
    H.note('press 2 from the menu: refused (state)'); R.send({ t: 'nr', q: 2, w: world() }); H.advance(240);
    H.note('press 3 only 240 ms after press 2 (a flood: under the 250 ms gap): no answer; then, 300 ms apart, an older press and malformed ones: no answer either');
    R.send({ t: 'nr', q: 3, w: world() }); for (const q of [1, 0, -1, '5', 1.5]) { H.advance(300); R.send({ t: 'nr', q, w: world() }); }
    for (let i = 0; i < 240; i++) { H.advance(25); W.send(P(800, 888, { n: 'Watch', mv: MV(0, 0) })); }
    H.note('the Runner joins again; press 4 at once: refused (cooldown, with the wait)'); R.send({ t: 'join' }); H.advance(30); R.send(P(504, 888, { n: 'Runner', mv: MV(0, 0) })); still(12);
    R.send({ t: 'nr', q: 4, w: world() }); still(12);
    H.note('press 5 with the world before an admin reset: refused (epoch)'); const w0 = world(); Q.A.send({ t: 'a', c: 'world' }); H.advance(60);
    { const tp = R.last('tp'); if (tp) R.send(P(tp.x, tp.y, { n: 'Runner', mv: MV(0, 0) })); } H.advance(300); R.send({ t: 'nr', q: 5, w: w0 }); H.advance(300);
    H.note('the Watcher, an admin with UNLIMITED NEW RUN on: two NEW RUNs within 30 s, both approved; off again: the third is refused');
    W.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30); W.send({ t: 'a', c: 'nrfree', on: 1 }); H.advance(30);
    let wq = 0; const wRun = () => { W.send({ t: 'nr', q: ++wq, w: world() }); H.advance(300); };
    const wBack = () => { W.send({ t: 'join' }); H.advance(30); W.send(P(800, 888, { n: 'Watch', mv: MV(0, 0) })); still(12, [W]); };
    wRun(); for (let i = 0; i < 200; i++) H.advance(25); wBack(); wRun(); for (let i = 0; i < 200; i++) H.advance(25); wBack();
    W.send({ t: 'a', c: 'nrfree', on: 0 }); H.advance(30); wRun();
    H.note('the Runner dies (an admin preview kill on itself); a press while dead: refused (dead)');
    R.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30); R.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' });
    for (let i = 0; i < 40; i++) { H.advance(25); R.send(P(504, 888, { n: 'Runner', mv: MV(1, 120) })); }
    R.send({ t: 'nr', q: 6, w: world() }); for (let i = 0; i < 240; i++) H.advance(25);
    coverage(H, [Q.A, R, W]);
  },

  /* Stage 3H H2-0: the one NEW RUN refusal bpp_new_run does not reach - 'held', a press made while an entity holds the player (sim.nrWhy).
   * The Runner is an admin (quiet) so that its own commands bring the capture to it: always play with the victim (capmode), a Hound
   * placed near it, then summoned.  It stands still until a snapshot names a capture (cp), presses NEW RUN, and keeps standing */
  async bpp_new_run_held(H) {
    const room = 'bpph', Q = quietAdmin(H, room, '203.0.113.110'); Q.clear(); H.advance(100);
    const R = player(H, room, '203.0.113.111', 'Runner', 504, 888, 1);
    const still = n => { for (let i = 0; i < n; i++) { H.advance(25); R.send(P(504, 888, { n: 'Runner', mv: MV(0, 0) })); } };
    const world = () => { const s = R.last('s'); return s ? s.w : 0; };
    still(20);
    R.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30);
    H.note('the Runner (an admin, not in god mode): capture style "play", a Hound near it, summoned');
    R.send({ t: 'a', c: 'capmode', mode: 'play' }); still(4);
    R.send({ t: 'a', c: 'near', k: 'hound' }); still(4);
    R.send({ t: 'a', c: 'summon' });
    let n = 0; while (n < 2400) { still(1); n++; const s = R.last('s'); if (s && s.cp) break; }
    H.note('held after ' + n + ' steps of 25 ms: ' + JSON.stringify((R.last('s') || {}).cp || null));
    R.send({ t: 'nr', q: 1, w: world() }); still(8);
    H.note('a second press while still held, 300 ms later'); still(4); R.send({ t: 'nr', q: 2, w: world() }); still(8);
    for (let i = 0; i < 200; i++) still(1);
    coverage(H, [Q.A, R]);
  },
};
