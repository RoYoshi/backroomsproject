/* Stage 3H1 - B++ golden-trace scenarios for Stage 3H0's closed-world server harness (development only; never served).
 *
 *   node dev/stage-3h0/golden/srv_harness.js --src SERVER_JS --dir GAME_DIR --scenario NAME --out TRACE.jsonl --scenarios THIS_FILE
 *   (dev/stage-3h/golden/bpp_golden.js runs them all, old against new, and writes the baseline)
 *
 * Stage 3H0's eleven scenarios were written for the QA2 parent: they never ask 'caps', so they cannot see B+'s fresher poses or B++-0's
 * placement guard, and none of them reaches Stage 3D's NEW RUN decision.  These seven do (3H1 wrote five; Stage 3H2 added
 * bpp_new_run_held at H2-0 and bpp_aftermath before C-2, each leaving the earlier traces byte for byte as they were), in the same
 * fake-clock world (seeded randomness, fake timers and sockets, the real sim), so the accepted B++ server's answers are pinned byte for
 * byte:
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
 *   bpp_aftermath     the death aftermath in every phase (the comment above the scenario lists them): forfeit, late joiners with and
 *                     without el, a revive's cancel, a world reset's drop, a victim gone mid-death, a blast a revive does not cancel,
 *                     one aftermath per player, the drop by a world a rejoin starts, bodies' ages
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
  /* Stage 3H H2 (before C-2): the death aftermath in every phase (server.js aftStart / aftSend / aftTick / aftOf, putBody / bodyAt,
   * boomStart's blast, worldReset's drop, the disconnect's forfeit), several of which no earlier golden reaches: a capture walked out of
   * (forfeit); late joiners at about 0.1 s (no el), 0.35 s and 1.3 s (el); an admin revive cancelling a death that is playing (an end
   * to everyone else, no corpse); a death dropped by an admin world reset (an end naming the new world), then a late joiner (nothing
   * replayed); a victim that disconnects while its death plays (the server still places the corpse); a NEW RUN blast an admin revive
   * does not cancel; a second death of the same player dropping the first (one aftermath per player); a death dropped by the world its
   * own rejoin starts (no corpse, no end); a late joiner's bodies with their ages */
  async bpp_aftermath(H) {
    /* 0: a capture walked out of.  First, in a room of its own, exactly bpp_new_run_held's inputs up to the capture (same fresh harness,
     * same world, same random stream: the Hound holds the Runner at the same step), then the Runner disconnects while held */
    {
      const room = 'bppf', Q = quietAdmin(H, room, '203.0.113.110'); Q.clear(); H.advance(100);
      const R = player(H, room, '203.0.113.111', 'Runner', 504, 888, 1);
      const still = n => { for (let i = 0; i < n; i++) { H.advance(25); R.send(P(504, 888, { n: 'Runner', mv: MV(0, 0) })); } };
      still(20);
      R.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30);
      H.note('0: the Runner (an admin, not in god mode): capture style "play", a Hound near it, summoned (bpp_new_run_held\'s inputs)');
      R.send({ t: 'a', c: 'capmode', mode: 'play' }); still(4);
      R.send({ t: 'a', c: 'near', k: 'hound' }); still(4);
      R.send({ t: 'a', c: 'summon' });
      let n = 0; while (n < 2400) { still(1); n++; const s = R.last('s'); if (s && s.cp) break; }
      H.note('held after ' + n + ' steps of 25 ms: ' + JSON.stringify((R.last('s') || {}).cp || null));
      still(8);
      H.note('the Runner disconnects while held: the capture is forfeited - a death, its aftermath recorded before the client goes; a client connecting 1 s later gets the replay with el; the server places the corpse');
      R.close(); for (let i = 0; i < 40; i++) H.advance(25);
      const L = H.connect('/ws?room=' + room, { ip: '203.0.113.112', label: 'Late0' }); for (let i = 0; i < 20; i++) H.advance(25); L.close();
      for (let i = 0; i < 480; i++) H.advance(25);
      Q.A.send({ t: 'a', c: 'capmode', mode: 'auto' }); H.advance(30);
      coverage(H, [Q.A, R, L]); Q.A.close(); H.advance(100);
    }

    const room = 'bppa', Q = quietAdmin(H, room, '203.0.113.120'); Q.clear(); H.advance(100);
    const at = new Map(), all = [Q.A], open = new Set();
    let ipn = 121;
    const join = (label, x, y) => { const c = player(H, room, '203.0.113.' + (ipn++), label, x, y, 1); at.set(c, [x, y]); open.add(c); all.push(c); return c; };
    /* every 25 ms, each joined and still connected player sends where it stands (a real page's cadence; the dead too) */
    const tick = n => { for (let i = 0; i < n; i++) { H.advance(25); for (const c of open) { const [x, y] = at.get(c); c.send(P(x, y, { n: c.cid, mv: MV(0, 0) })); } } };
    /* a client that connects (in the menu, never joining), stays a moment and leaves: the room holds 8 sockets at most */
    const late = (label, stay = 20) => { const c = H.connect('/ws?room=' + room, { ip: '203.0.113.' + (ipn++), label }); all.push(c); tick(stay); c.close(); return c; };
    const close = c => { c.close(); open.delete(c); };
    const placed = c => { const tp = c.last('tp'); if (tp) at.set(c, [tp.x, tp.y]); };          // after a server-side move (world reset, a moved spawn)
    const W = join('Watch', 800, 888);
    const M = H.connect('/ws?room=' + room, { ip: '203.0.113.200', label: 'Menu' }); all.push(M);   // connected all along, never joins: a replay goes to every client
    Q.god(W.id); H.advance(300);
    let V = null;
    /* a victim: an admin (its own death previews) in god mode - no entity left over from an earlier preview can kill it; a preview
     * still does (sim.previewKill works through god mode) */
    const victim = label => { V = join(label, 504, 888); V.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30); Q.god(V.id); tick(12); placed(V); return V; };
    const dead = () => { const s = V.last('s'); return !!(s && s.me); };
    const waitDead = () => { let n = 0; while (n < 1200 && !dead()) { tick(1); n++; } H.note(V.cid + ' dead after ' + n + ' steps of 25 ms'); };
    const respawn = () => { V.send({ t: 'respawn' }); H.advance(60); V.send(P(504, 888, { n: V.cid })); at.set(V, [504, 888]); tick(2); placed(V); tick(10); };
    tick(20);

    victim('V1');
    H.note('1: V1 dies (an admin preview on itself: hound A); clients connect about 0.1 s (the replay without el), 0.35 s and 1.3 s (with el) after the death is seen; it plays out: the server places the corpse and the hound where the death left it');
    V.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); waitDead();
    tick(4); late('Late1a', 10); late('Late1b', 10); tick(28); late('Late1c'); tick(440);

    H.note('2: V1 respawns and dies again (preview smiler A); 0.6 s into the death the quiet admin revives it: an end to everyone else, no corpse');
    respawn(); V.send({ t: 'a', c: 'preview', k: 'smiler', var: 'A' }); waitDead(); tick(24);
    Q.A.send({ t: 'a', c: 'revive', id: V.id }); tick(8); respawn(); tick(480);

    H.note('3: V1 dies (preview hound B); 0.5 s into it an admin world reset drops it (an end naming the new world); a client connecting after it gets no replay');
    V.send({ t: 'a', c: 'preview', k: 'hound', var: 'B' }); waitDead(); tick(20);
    Q.A.send({ t: 'a', c: 'world' }); H.advance(60); for (const c of open) placed(c); tick(8); late('Late3'); tick(300);

    H.note('4: V1 dies (preview smiler B) and disconnects 0.5 s into it; a client connecting 1 s later still gets the replay (el); the server places the corpse');
    V.send({ t: 'a', c: 'preview', k: 'smiler', var: 'B' }); waitDead(); tick(20); close(V); tick(40); late('Late4'); tick(460);

    H.note('6: the Watcher, an admin with UNLIMITED NEW RUN on, presses NEW RUN: the blast replay to everyone; 0.3 s into it the quiet admin revives the Watcher (a blast is never cancelled); a client connecting 1 s later gets it with el; the Boom corpse.  The Watcher stays in the menu');
    W.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(30); W.send({ t: 'a', c: 'nrfree', on: 1 }); H.advance(30);
    W.send({ t: 'nr', q: 1, w: (W.last('s') || {}).w || 0 }); tick(12); Q.A.send({ t: 'a', c: 'revive', id: W.id }); tick(28); late('Late6'); tick(300);

    H.note('7: V3 joins (nobody else in a run: its join starts a new world); dies (preview hound A), respawns 1 s into the death and dies again (preview hound C): the first aftermath is dropped for the second (one per player), one corpse');
    victim('V3'); V.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); waitDead(); tick(40);
    respawn(); V.send({ t: 'a', c: 'preview', k: 'hound', var: 'C' }); waitDead(); tick(480);

    H.note('8: V3, alone in a run, dies (preview smiler A), leaves for the menu 0.5 s into the death and joins again: its join starts a new world, and the tick drops the death still playing (no corpse, no end)');
    respawn(); V.send({ t: 'a', c: 'preview', k: 'smiler', var: 'A' }); waitDead(); tick(20);
    V.send({ t: 'leave' }); tick(4); V.send({ t: 'join' }); H.advance(30); V.send(P(504, 888, { n: V.cid, mv: MV(0, 0) })); at.set(V, [504, 888]); tick(2); placed(V); tick(320);

    H.note('9: V3 dies once more and its corpse is made; a last client connects: the bodies, with their ages');
    V.send({ t: 'a', c: 'preview', k: 'hound', var: 'D' }); waitDead(); tick(480); late('Late9');
    coverage(H, all);
  },
};
