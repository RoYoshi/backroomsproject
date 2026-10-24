/* (Trial 3 R20, the N track; Trial 3 is not owner-approved) the runs behind ST01-ST04, the open-air STUCK (dev/trial-3-r20-nani-head-watchdog/).
 * Each scene takes the harness (lib.js, its built ai.js compiled by r20n_child.js with the follower exposed, and - mode r19 - without R20's
 * hunks) and returns what the checks judge.  A scene that drives a Skin-Stealer by hand replaces its species tick for that scene only and
 * moves it with the engine's own steerTo / stopMoving: the engine's watchdog, collision and stuck accounting are the real ones.  Not a
 * suite: run.js does not list it. */
'use strict';
const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const ring = (g, x, y, R = 200) => { let m = 1e9; for (let k = 0; k < 16; k++) m = Math.min(m, g.ray(x, y, k / 16 * TAU, R)); return m; };
/* open floor: clear `r` px all round */
function opens(w, n, seed, r = 150) {
  const g = w.eng.geo, R = rng(seed), out = [];
  for (let k = 0; k < 40000 && out.length < n; k++) { const x = 200 + R() * (g.W - 400), y = 200 + R() * (g.H - 400); if (w.ad.clear(x, y, 30, 'walk') && ring(g, x, y, r + 10) > r && out.every(q => Math.hypot(q.x - x, q.y - y) > 300)) out.push({ x, y }); }
  return out;
}
/* the Skin-Stealer's species tick replaced by fn for the run of body() (the engine's tick, senses, watchdog and collision are unchanged) */
function drive(AI, fn, body) { const tk = AI.SKIN.tick; AI.SKIN.tick = fn; try { return body(); } finally { AI.SKIN.tick = tk; } }
const resets = e => e.unstuck || 0;

module.exports = {
  /* ST01: 10 minutes of a corner wait - holding still (it says so: e.still), its head swivelling (60 sweeps), a small step to one side and back
   * every 6.15 s, so the watchdog's 6-s checks fall now in the stillness, now in the step */
  waits({ World, DT, AI }) {
    const out = [];
    for (const seed of [2, 5, 9]) {
      const w = World(seed), eng = w.eng, g = eng.geo, o = opens(w, 2, seed * 13)[0], e = eng.spawn('skinstealer', o.x, o.y, { hunger: .1 });
      const p = w.player(o.x + 420, o.y, { light: false }); p.stop('stand');
      let maxSt = 0, label = 0, sweeps = 0, lastSign = 0, why = 0, k = 0, inside = 0;
      const t0 = eng.now, A = { x: o.x, y: o.y }, B = { x: o.x, y: o.y + 22 };
      drive(AI, (eng2, e2, dt) => {
        if (e2 !== e) return; const t = eng.now - t0, c = t % 6.15;
        if (c < 5.9) { e.still = true; AI.stopMoving(eng, e, dt); e.head = 1.15 * Math.sin(TAU * t / 1.7); const sg = Math.sign(e.head); if (sg && sg !== lastSign) { sweeps++; lastSign = sg; } e.act = 'wait'; }
        else { e.still = false; e.head = 0; e.act = ''; const q = Math.floor(t / 6.15) % 2 ? A : B; AI.steerTo(eng, e, q.x, q.y, 90, dt); }
      }, () => w.run(600, () => { maxSt = Math.max(maxSt, e.stuck); if (e.stuck > .15) label += DT; if (/stuck/.test(e.dbg.why || '')) why++; if (!e.trav && !w.ad.clear(e.x, e.y, 8, 'walk')) inside++; k++; return true; }));
      out.push({ seed, secs: 600, sweeps, resets: resets(e), onStuck: why > 0, maxStuck: +maxSt.toFixed(3), label: +label.toFixed(2), recover: (e.nav || {}).recover || 0, inside, dist: Math.round(Math.hypot(e.x - o.x, e.y - o.y)) });
    }
    return { runs: out };
  },
  /* ST02 (a): turning round on open floor by the real follower - each species, at rest facing away from a goal 320 px behind it (and 90 / 135
   * degrees off) where the way to it is straight and clear (40 px either side), from 60 open places (200 px clear all round), at its walk and its fastest: its stuck timer, the debug label, the recovery rungs, and when it got there */
  turns({ World, DT, AI }) {
    const w = World(7), eng = w.eng, g = eng.geo, P = opens(w, 60, 77, 200), out = {};
    for (const kind of ['skinstealer', 'hound', 'smiler']) {
      const v = { skinstealer: 160, hound: 92, smiler: 80 }[kind], fast = { skinstealer: 270, hound: 292, smiler: 255 }[kind], rs = [];
      for (const [i, o] of P.entries()) for (const off of [Math.PI, 2.36, 1.57]) for (const pace of [v, fast]) {
        const e = eng.spawn(kind, o.x, o.y, kind === 'skinstealer' ? { hunger: .1 } : {}); eng.entities.splice(eng.entities.indexOf(e), 1);
        e.tier = 'near'; const a0 = (i * 1.3) % TAU; e.ang = a0; e.speed = 0; e.path = [];
        const gx = o.x + Math.cos(a0 + off) * 320, gy = o.y + Math.sin(a0 + off) * 320;
        if (!w.ad.clear(gx, gy, 40, 'walk') || !g.lineClear(o.x, o.y, gx, gy, 40, 'walk')) continue;            // open floor: a straight, clear way to it
        AI.plan(eng, e, gx, gy); if (!e.path.length) continue;
        const n0 = Object.assign({}, AI.navOf(e)), t0 = eng.now; let label = 0, maxSt = 0, T = null;
        for (let k = 0; k < 8 * 60; k++) { eng.now += DT; g.now = eng.now; const st = AI.follow(eng, e, DT, pace, {}); if (e.stuck > .15) label += DT; maxSt = Math.max(maxSt, e.stuck); if (st === 'arrived' || Math.hypot(gx - e.x, gy - e.y) < 20) { T = eng.now - t0; break; } }
        const n = AI.navOf(e); eng.now = t0; g.now = t0;
        rs.push({ i, off: +off.toFixed(2), pace, label: +label.toFixed(3), maxStuck: +maxSt.toFixed(3), side: n.recover - (n0.recover || 0), replan: n.stuckN - (n0.stuckN || 0), t: T === null ? null : +T.toFixed(3) });
      }
      out[kind] = rs;
    }
    return out;
  },
  /* ST02 (b): walks there and back past the same spot along a long straight hall at its prowl (185 px/s) - each leg 200-520 px, a pause of
   * 0.2-0.9 s to listen between, drawn per leg - for 10 minutes: the watchdog's verdicts */
  thereback({ World, DT, AI, floorNear }) {
    const out = [];
    for (const seed of [3, 6, 8, 11]) {
      const w = World(seed), eng = w.eng, R = w.runs(1300, 34)[seed % 3], hor = R.y0 === R.y1, L = 520, D = rng(seed * 17);
      const A = hor ? { x: R.x0 + 150, y: R.y0 } : { x: R.x0, y: R.y0 + 150 }, B = hor ? { x: A.x + L, y: A.y } : { x: A.x, y: A.y + L };
      const e = eng.spawn('skinstealer', A.x, A.y, { hunger: .1 }), pq = floorNear(w, (A.x + B.x) / 2 + (hor ? 0 : 450), (A.y + B.y) / 2 + (hor ? 450 : 0)), p = w.player(pq.x, pq.y, { light: false }); p.stop('stand');
      let goB = true, pause = 0, legs = 0, why = 0, q = B;
      const leg = () => { const k = (200 + D() * 320) / L; q = goB ? { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k } : A; };
      leg();
      drive(AI, (eng2, e2, dt) => {
        if (e2 !== e) return;
        if (pause > 0) { pause -= dt; e.act = 'listen'; AI.stopMoving(eng, e, dt); if (pause <= 0) { e.act = ''; goB = !goB; leg(); } return; }
        AI.steerTo(eng, e, q.x, q.y, 185, dt); if (Math.hypot(q.x - e.x, q.y - e.y) < 24) { pause = .2 + D() * .7; legs++; }
      }, () => w.run(600, () => { if (/stuck/.test(e.dbg.why || '')) why++; return true; }));
      out.push({ seed, legs, resets: resets(e), onStuck: why > 0, hall: Math.round(Math.hypot(B.x - A.x, B.y - A.y)) });
    }
    return { runs: out };
  },
  /* ST02 (c): ordinary play, the real Skin-Stealer and two people exploring (dev/trial-3-r20-nani-head-watchdog/tools/roam_sim.js's play),
   * 3 seeds x 5 min: the debug label (and how much of it in open air), the follower's side-steps, the watchdog's resets */
  ordinary({ World, DT, AI }) {
    const out = [];
    for (const seed of [1, 4, 6]) {
      const w = World(seed * 7907 + 18000), eng = w.eng, g = eng.geo, R0 = rng(seed + 11), P = opens(w, 60, seed * 5, 60);
      const s0 = P[0], e = eng.spawn('skinstealer', s0.x, s0.y, { hunger: .55 });
      const far = (lo) => P.find(q => Math.hypot(q.x - e.x, q.y - e.y) > lo) || P[1];
      const ppl = [0, 1].map(i => { const at = P[5 + i * 7], p = w.player(at.x, at.y, { light: true }); p.stop('stand'); return { p, dead: 0, until: 0, r: rng(seed * 31 + i) }; });
      let label = 0, open = 0, near = 0;
      w.run(300, (ww, t) => {
        for (const B of ppl) { const p = B.p;
          if (p.dead) { if (!B.dead) B.dead = t; if (t - B.dead > 5) { const q = far(1800); p.dead = false; p.alive = true; p.caught = false; p.x = q.x; p.y = q.y; p.stamina = 100; p.stop('stand'); B.dead = 0; } continue; }
          if ((!p.path || !p.path.length) && t > B.until) { const q = P[Math.floor(B.r() * P.length)]; p.pathTo(q.x, q.y, B.r() < .2 ? 'run' : 'walk'); B.until = t + (B.r() < .3 ? 1 + B.r() * 4 : 0); } }
        if (!eng.entities.includes(e)) return true;
        if (e.tier !== 'far') { near += DT; if (e.stuck > .15) { label += DT; if (ring(g, e.x, e.y) > e.rc + 24) open += DT; } }
        return true;
      });
      out.push({ seed, nearS: +near.toFixed(1), label: +label.toFixed(2), openLabel: +open.toFixed(2), side: (e.nav || {}).recover - resets(e), replan: (e.nav || {}).stuckN || 0, resets: resets(e) });
    }
    return { runs: out };
  },
  /* ST03: real obstruction.  (a) the follower given a waypoint straight through a wall, each species: its stuck timer still grows and its
   * side-step and new-route rungs still fire.  (b) a Skin-Stealer that keeps trying to walk into a wall for 20 s (not still): where it is
   * pinned (it got nowhere in its last 12 s; one that slid along the wall and on is not), the watchdog
   * still resets it, where it stands - no teleport, nothing inside the wall.  (c) one placed overlapping a wall: still un-embedded, onto clear
   * floor nearby, not onto the person */
  block({ World, DT, AI }) {
    const w = World(4), eng = w.eng, g = eng.geo, P = opens(w, 400, 41, 40), out = { follow: [], wall: [], embed: null };
    const walls = []; for (const o of P) { for (let k = 0; k < 16 && walls.length < 12; k++) { const a = k / 16 * TAU, d = g.ray(o.x, o.y, a, 400); if (d > 110 && d < 170 && g.ray(o.x, o.y, a, 600) < 200) { walls.push({ x: o.x, y: o.y, a, d }); break; } } if (walls.length >= 12) break; }
    for (const kind of ['skinstealer', 'hound', 'smiler']) for (const W of walls.slice(0, 6)) {
      const e = eng.spawn(kind, W.x, W.y, kind === 'skinstealer' ? { hunger: .1 } : {}); eng.entities.splice(eng.entities.indexOf(e), 1);
      e.tier = 'near'; e.ang = W.a; e.speed = 0; e.path = [{ x: W.x + Math.cos(W.a) * (W.d + 220), y: W.y + Math.sin(W.a) * (W.d + 220) }]; e.goal = null;
      const n0 = Object.assign({}, AI.navOf(e)), t0 = eng.now; let maxSt = 0, inside = 0;
      for (let k = 0; k < 3 * 60; k++) { eng.now += DT; g.now = eng.now; if (!e.path.length) e.path = [{ x: W.x + Math.cos(W.a) * (W.d + 220), y: W.y + Math.sin(W.a) * (W.d + 220) }]; AI.follow(eng, e, DT, kind === 'hound' ? 292 : 160, {}); maxSt = Math.max(maxSt, e.stuck); if (!w.ad.clear(e.x, e.y, Math.max(1, e.rc - 4), 'walk')) inside++; }
      const n = AI.navOf(e); eng.now = t0; g.now = t0;
      out.follow.push({ kind, maxStuck: +maxSt.toFixed(3), side: n.recover - (n0.recover || 0), replan: n.stuckN - (n0.stuckN || 0), inside });
    }
    for (const W of walls.slice(0, 12)) {
      const w2 = World(4), eng2 = w2.eng, e = eng2.spawn('skinstealer', W.x, W.y, { hunger: .1 }), p = w2.player(W.x - Math.cos(W.a) * 380, W.y - Math.sin(W.a) * 380, { light: false }); p.stop('stand');
      const tx = W.x + Math.cos(W.a) * (W.d + 200), ty = W.y + Math.sin(W.a) * (W.d + 200); let why = 0, inside = 0, x0 = null, y0 = null, maxJump = 0, lx = e.x, ly = e.y;
      drive(AI, (eng3, e2, dt) => { if (e2 !== e) return; e.still = false; AI.steerTo(eng2, e, tx, ty, 160, dt); },
        () => w2.run(20, (ww, t) => { if (x0 === null && t >= 8) { x0 = e.x; y0 = e.y; } if (/stuck/.test(e.dbg.why || '')) why++; if (!w2.ad.clear(e.x, e.y, Math.max(1, e.rc - 4), 'walk')) inside++; maxJump = Math.max(maxJump, Math.hypot(e.x - lx, e.y - ly)); lx = e.x; ly = e.y; return true; }));
      // pinned: in its last 12 s it got nowhere (a body that slid along the wall and went on is not blocked)
      out.wall.push({ pinned: Math.hypot(e.x - x0, e.y - y0) < 26, resets: resets(e), onStuck: why > 0, inside, maxJump: +maxJump.toFixed(1), fromWall: Math.round(g.ray(e.x, e.y, W.a, 400)) });
    }
    { // (c) overlapping a wall: find a spot 6-10 px from a wall face (its body 12+ px into it)
      const w3 = World(4), eng3 = w3.eng, g3 = eng3.geo, W = walls[10] || walls[0], ex = W.x + Math.cos(W.a) * (W.d - 6), ey = W.y + Math.sin(W.a) * (W.d - 6);
      const e = eng3.spawn('skinstealer', ex, ey, { hunger: .1 }), p = w3.player(W.x - Math.cos(W.a) * 300, W.y - Math.sin(W.a) * 300, { light: false }); p.stop('stand');
      const was = g3.clear(ex, ey, 12, 'walk');
      drive(AI, (eng4, e2, dt) => { if (e2 !== e) return; e.still = true; AI.stopMoving(eng3, e, dt); }, () => w3.run(7, () => true));
      out.embed = { startedClear: was, resets: resets(e), emergency: (e.nav || {}).emergency || 0, nowClear: g3.clear(e.x, e.y, 12, 'walk'), moved: Math.round(Math.hypot(e.x - ex, e.y - ey)), toPerson: Math.round(Math.hypot(e.x - p.x, e.y - p.y)) };
    }
    return out;
  },
  /* ST04: (a) vaults - a Skin-Stealer sent by the admin's navigation command along routes with a vault link (the real traversal, the R19
   * mid-vault fix: its vault closed once its body has left it): the label, the watchdog, a vault left open far from the body; (b) the tiers -
   * the real Skin-Stealer with four people who walk off far away and come back (near, mid and far), 4 minutes */
  vaulttier({ World, DT, AI }) {
    const out = { vault: [], tiers: [] };
    { const w = World(7), eng = w.eng, g = eng.geo, P = opens(w, 300, 9, 40), probe = eng.spawn('skinstealer', 0, 0, { hunger: .1 }); eng.entities.splice(eng.entities.indexOf(probe), 1);
      const pairs = []; for (let i = 0; i < P.length && pairs.length < 6; i++) for (let j = i + 1; j < P.length && pairs.length < 6; j++) { const a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 400 || d > 1200) continue; probe.x = a.x; probe.y = a.y; probe.path = []; if (AI.plan(eng, probe, b.x, b.y) && probe.path.some(q => q.link)) { pairs.push([a, b]); break; } }
      for (const [a, b] of pairs) {
        const w2 = World(7), eng2 = w2.eng, e = eng2.spawn('skinstealer', a.x, a.y, { hunger: .1 }), p = w2.player(b.x, b.y, { light: false }); p.stop('stand');
        eng2.navGo(e, { x: b.x, y: b.y, speed: 160, arrive: 30, direct: false });
        let trav = 0, label = 0, stale = 0, done = null;
        w2.run(14, (ww, t) => { if (e.trav) { trav += DT; const m = { x: (e.trav.ax + e.trav.bx) / 2, y: (e.trav.ay + e.trav.by) / 2 }; if (Math.hypot(e.x - m.x, e.y - m.y) > 200) stale++; } if (e.stuck > .15) label += DT; if (done === null && e.navGo && e.navGo.done !== undefined) done = t; if (done === null && !e.navGo) done = t; return true; });
        out.vault.push({ trav: +trav.toFixed(2), label: +label.toFixed(2), resets: resets(e), stale, arrived: done !== null || Math.hypot(e.x - b.x, e.y - b.y) < 40 });
      }
    }
    for (const seed of [2, 5]) {
      const w = World(seed + 300), eng = w.eng, g = eng.geo, P = opens(w, 80, seed * 3, 60), s0 = P[0], e = eng.spawn('skinstealer', s0.x, s0.y, { hunger: .4 }), R = rng(seed);
      const ppl = [0, 1, 2, 3].map(i => { const q = P[3 + i * 5], p = w.player(q.x, q.y, { light: true }); p.stop('stand'); return p; });
      const tiers = {}; let label = 0, open = 0, lastT = e.tier, changes = 0;
      w.run(240, (ww, t) => {
        if (Math.round(t * 60) % 600 === 0) for (const p of ppl) { if (p.dead) { p.dead = false; p.alive = true; p.caught = false; } const q = P[Math.floor(R() * P.length)]; p.pathTo(q.x, q.y, 'walk'); }
        if (!eng.entities.includes(e)) return true;
        tiers[e.tier] = (tiers[e.tier] || 0) + DT; if (e.tier !== lastT) { changes++; lastT = e.tier; }
        if (e.tier !== 'far' && e.stuck > .15) { label += DT; if (ring(g, e.x, e.y) > e.rc + 24) open += DT; }
        return true;
      });
      out.tiers.push({ seed, tiers: Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, +v.toFixed(1)])), changes, label: +label.toFixed(2), openLabel: +open.toFixed(2), resets: resets(e) });
    }
    return out;
  }
};
