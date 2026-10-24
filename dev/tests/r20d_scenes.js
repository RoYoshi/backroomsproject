/* (Trial 3 R20, checkpoint D, the N track; Trial 3 is not owner-approved) the runs behind NA01-NA06, the opt-in head swivel
 * (dev/trial-3-r20-nani-head-watchdog/DESIGN_DECISIONS.md W3).  Run by r20n_child.js (FILE:SCENE), which compiles the built ai.js with the
 * follower and headAhead exposed.  Not a suite: run.js does not list it.
 *   gaze   the real engine: a Skin-Stealer among three people walking (and now and then running) through the level, at hunger .3 and .75 -
 *          its snapshots at the server's 20 Hz, its true sight (e.ang + e.head) at each, and every tick: whom it sees and whether a wall
 *          stands between; `noswivel` runs the same with its HEAD_SWIVEL taken off its caps (R19's head, the same tree otherwise)
 *   bends  routes with a bend whose far side it cannot see from the start, a person standing just round it: the follower walks or runs it
 *          with the head swivel's rule and, the same route again, with its head straight - when it first sees them, whether a wall was
 *          between, its head, and its path (the head must not move the body) */
'use strict';
const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const ring = (g, x, y, R = 200) => { let m = 1e9; for (let k = 0; k < 16; k++) m = Math.min(m, g.ray(x, y, k / 16 * TAU, R)); return m; };
function opens(w, n, seed, r = 120) {
  const g = w.eng.geo, R = rng(seed), out = [];
  for (let k = 0; k < 40000 && out.length < n; k++) { const x = 200 + R() * (g.W - 400), y = 200 + R() * (g.H - 400); if (w.ad.clear(x, y, 30, 'walk') && ring(g, x, y, r + 10) > r && out.every(q => Math.hypot(q.x - x, q.y - y) > 250)) out.push({ x, y }); }
  return out;
}
function drive(AI, fn, body) { const tk = AI.SKIN.tick; AI.SKIN.tick = fn; try { return body(); } finally { AI.SKIN.tick = tk; } }

function gazeRun(L, seed, hunger, swivel) {
  const { World, DT, AI } = L, w = World(seed), eng = w.eng, g = eng.geo, P = opens(w, 120, seed * 31), R = rng(seed * 7 + 1);
  const e = eng.spawn('skinstealer', P[0].x, P[0].y, { hunger }); e.tier = 'near';
  if (!swivel) delete e.caps.HEAD_SWIVEL;
  const near = P.filter(q => { const d = Math.hypot(q.x - e.x, q.y - e.y); return d > 400 && d < 1300; }).concat(P.slice(1));
  const ps = [1, 2, 3].map(i => { const q = near[i - 1]; return w.player(q.x, q.y, { light: i !== 2 }); });
  const next = p => { const C = P.filter(q => Math.hypot(q.x - e.x, q.y - e.y) < 1300); for (let k = 0; k < 8; k++) { const q = C.length > 2 ? C[Math.floor(R() * C.length)] : P[Math.floor(R() * P.length)]; if (p.pathTo(q.x, q.y, R() < .2 ? 'run' : 'walk')) return; } };   // (its part of the level: they meet)
  ps.forEach(next);
  const snaps = [], los = new Map(), out = { seed, hunger, swivel, leaks: [], seenTicks: 0, walkT: 0, walkTurned: 0, runT: 0, runOver: 0, maxDh: 0, heads: 0 };
  let k = 0, ph = e.head || 0;
  w.run(150, () => {
    for (const p of ps) { if (!p.path || !p.path.length) next(p); p.stamina = Math.max(p.stamina, 40); }
    const t = +(eng.now - 60).toFixed(4);
    for (const p of ps) {
      if (g.sees(e.x, e.y, p.x, p.y, p.prof)) los.set(p.id, t);
      if (e.seenNow.has(p.id)) { out.seenTicks++; const at = los.has(p.id) ? los.get(p.id) : -1e9; if (t - at > .2) out.leaks.push({ t, pid: p.id, d: Math.round(Math.hypot(p.x - e.x, p.y - e.y)) }); }
    }
    const h = e.head || 0, dh = Math.abs(h - ph); ph = h; out.maxDh = Math.max(out.maxDh, dh / DT);
    const watching = [...e.seenNow].length > 0 || e.look && e.look.k;
    if (!e.trav && e.speed > 60 && !watching) { if (e.speed > 240) { out.runT += DT; if (Math.abs(h) > .45) out.runOver += DT; } else { out.walkT += DT; if (Math.abs(h) > .2) out.walkTurned += DT; } }
    if (k++ % 3 === 0) { const s = AI.SKIN.snap(e); snaps.push({ t, s, view: +(e.ang + (e.head || 0)).toFixed(4), ang: +e.ang.toFixed(4) }); }
    if (e.dead || !eng.entities.includes(e)) return false;
    return true;
  });
  out.walkT = +out.walkT.toFixed(2); out.walkTurned = +out.walkTurned.toFixed(2); out.runT = +out.runT.toFixed(2); out.runOver = +out.runOver.toFixed(2); out.maxDh = +out.maxDh.toFixed(2);
  out.snaps = snaps; return out;
}

module.exports = {
  gaze(L) { const runs = []; for (const seed of [3, 6, 11]) for (const h of [.3, .75]) runs.push(gazeRun(L, seed, h, true)); return { runs }; },
  noswivel(L) { const runs = []; for (const seed of [3, 6, 11]) for (const h of [.3, .75]) { const r = gazeRun(L, seed, h, false); delete r.snaps; runs.push(r); } return { runs }; },
  /* NA01 (the server's half) / NA02: standing still, its head at -0.85, 0 or +0.85 rad, a person 260 px off at bearings round it, in the
   * open (a clear line) and behind a wall: it sees exactly those inside fov/2 of e.ang + e.head with a clear line, and nobody behind a wall */
  glance({ World, DT, AI }) {
    const w = World(5), eng = w.eng, g = eng.geo, P = opens(w, 12, 505, 290), out = [];
    const e = eng.spawn('skinstealer', P[0].x, P[0].y, { hunger: .1 }); e.tier = 'near';
    const p = w.player(P[0].x + 200, P[0].y, { light: true }); p.stop('stand');
    const half = e.sp.vision.fov / 2;
    for (const [n, o] of P.entries()) for (const head of [-.85, 0, .85]) for (const off of [-2.3, -1.9, -1.5, -1, 0, 1, 1.5, 1.9, 2.3]) {
      const a0 = n * .7, b = a0 + off, px = o.x + Math.cos(b) * 260, py = o.y + Math.sin(b) * 260;
      if (!w.ad.clear(px, py, 22, 'walk') || !g.sees(o.x, o.y, px, py, 0)) continue;
      e.x = o.x; e.y = o.y; e.ang = a0; e.speed = 0; e.head = head; e.thinkT = 0; e.senseDt = 0; e.mem.p.clear(); e.seenNow.clear();
      p.x = px; p.y = py; p.stop('stand'); if (p.mover) { p.mover.H.x = px; p.mover.H.y = py; p.mover.H.vx = p.mover.H.vy = 0; }
      let seen = 0;
      drive(AI, (eng2, e2, dt) => { if (e2 === e) { AI.stopMoving(eng, e, dt); e.head = head; } }, () => w.run(.5, () => { if (e.seenNow.has(p.id)) seen++; return true; }));
      out.push({ n, head, off, inCone: Math.abs(angDiff(b, a0 + head)) <= half, seen: seen > 0, d: Math.round(Math.hypot(px - e.x, py - e.y)) });
    }
    // behind a wall: its head turned straight at somebody it has no line to (the next room over), from places beside a wall
    const walled = [];
    for (let k = 0; k < 3000 && walled.length < 30; k++) {
      const x = 300 + ((k * 7919) % (g.W - 600)), y = 300 + ((k * 104729) % (g.H - 600));
      if (!w.ad.clear(x, y, 30, 'walk')) continue;
      for (let j = 0; j < 8; j++) { const b = j / 8 * TAU, wall = g.ray(x, y, b, 300); if (wall > 40 && wall < 160) { const px = x + Math.cos(b) * (wall + 90), py = y + Math.sin(b) * (wall + 90); if (w.ad.clear(px, py, 22, 'walk') && !g.sees(x, y, px, py, 0)) { walled.push({ x, y, b, px, py }); break; } } }
    }
    const behind = [];
    for (const q of walled) for (const head of [-.85, 0, .85]) {
      e.x = q.x; e.y = q.y; e.ang = q.b - head; e.speed = 0; e.head = head; e.thinkT = 0; e.senseDt = 0; e.mem.p.clear(); e.seenNow.clear();
      p.x = q.px; p.y = q.py; p.stop('stand'); if (p.mover) { p.mover.H.x = q.px; p.mover.H.y = q.py; p.mover.H.vx = p.mover.H.vy = 0; }
      let seen = 0; drive(AI, (eng2, e2, dt) => { if (e2 === e) { AI.stopMoving(eng, e, dt); e.head = head; } }, () => w.run(.5, () => { if (e.seenNow.has(p.id)) seen++; return true; }));
      behind.push({ head, seen: seen > 0, d: Math.round(Math.hypot(q.px - q.x, q.py - q.y)) });
    }
    return { open: out, behind, half };
  },
  /* NA04: headAhead for each species walking the same bends by the real follower (the Hound and the Smiler: 0), and a disguised
   * Skin-Stealer roaming in its borrowed skin: its head */
  others({ World, DT, AI }) {
    const w = World(4), eng = w.eng, g = eng.geo, P = opens(w, 80, 404, 60), R = rng(5), out = {};
    const p = w.player(P[1].x, P[1].y, { light: true }); p.stop('stand');
    for (const kind of ['skinstealer', 'hound', 'smiler']) {
      const e = eng.spawn(kind, P[0].x, P[0].y, kind === 'skinstealer' ? { hunger: .1 } : {}); eng.entities.splice(eng.entities.indexOf(e), 1); e.tier = 'near';
      let max = 0, n = 0;
      for (let i = 0; i < 40; i++) {
        const a = P[i], b = P[(i * 13 + 7) % P.length]; e.x = a.x; e.y = a.y; e.speed = 0; e.path = []; AI.plan(eng, e, b.x, b.y); if (e.path.length < 2) continue;
        const t0 = eng.now;
        for (let k = 0; k < 4 * 60 && e.path.length; k++) { eng.now += DT; g.now = eng.now; AI.follow(eng, e, DT, 160, {}); if (e.path.length >= 2) { n++; max = Math.max(max, Math.abs(AI.headAhead(eng, e))); } }
        eng.now = t0; g.now = t0;
      }
      out[kind] = { max: +max.toFixed(3), n };
    }
    // a borrowed skin: the real Skin-Stealer roaming in disguise among nobody (its own code), its head every tick
    const d = eng.spawn('skinstealer', P[2].x, P[2].y, { hunger: .1 }); d.tier = 'near'; p.x = P[2].x + 1500; p.y = P[2].y;
    d.disguise = d.disguise || { look: 'cap|0|0|0', since: eng.now };   // (a borrowed skin put on it by the test: the guard is what is judged)
    let head = 0, moved = 0;
    w.run(30, () => { if (d.disguise) { head = Math.max(head, Math.abs(d.head || 0)); if (d.speed > 60) moved++; } return true; });
    out.disguised = { head: +head.toFixed(3), moved, still: !!d.disguise };
    return out;
  },
  bends({ World, DT, AI }) {
    const w = World(4), eng = w.eng, g = eng.geo, P = opens(w, 160, 404, 60), R = rng(99), out = [];
    const H = AI.SPECIES ? AI.SPECIES.skinstealer.caps.HEAD_SWIVEL : null;
    const e = eng.spawn('skinstealer', P[0].x, P[0].y, { hunger: .1 }); e.tier = 'near';
    const Hs = e.caps.HEAD_SWIVEL, p = w.player(P[1].x, P[1].y, { light: true }); p.stop('stand');
    const home = { x: P[0].x, y: P[0].y };
    let made = 0;
    for (let n = 0; n < P.length * 6 && made < 40; n++) {
      const i = n % P.length, a = P[i], b = P[(i + 1 + Math.floor(R() * (P.length - 1))) % P.length], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < 450 || d > 1100) continue;
      e.x = a.x; e.y = a.y; e.path = []; AI.plan(eng, e, b.x, b.y);
      const W = e.path.map(q => ({ x: q.x, y: q.y, link: !!q.link })); if (W.length > 1 && out.some(r => r.wp0 && Math.hypot(r.wp0[0] - W[0].x, r.wp0[1] - W[0].y) < 60)) continue;   // (a new corner each time)
      if (W.length < 2 || W.some(q => q.link)) continue;
      const l1 = Math.atan2(W[0].y - a.y, W[0].x - a.x), l2 = Math.atan2(W[1].y - W[0].y, W[1].x - W[0].x);
      if (Math.abs(angDiff(l2, l1)) < .7 || Math.hypot(W[0].x - a.x, W[0].y - a.y) < 200) continue;
      const tx = W[0].x + Math.cos(l2) * 90, ty = W[0].y + Math.sin(l2) * 90;
      if (!w.ad.clear(tx, ty, 22, 'walk') || g.sees(a.x, a.y, tx, ty, 0)) continue;   // round the corner: out of sight from the start
      made++;
      for (const pace of [160, 270]) {
        const res = {};
        for (const mode of ['swivel', 'straight']) {
          eng.entities.forEach(o => { if (o !== e) o.dead = true; });
          e.x = a.x; e.y = a.y; e.ang = l1; e.speed = 0; e.head = 0; e.thinkT = 0; e.senseDt = 0; e.path = []; e.stuck = 0; e.mem.p.clear(); e.seenNow.clear(); e.plan = null; e.look && (e.look.k = '');
          p.x = tx; p.y = ty; p.stop('stand'); if (p.mover) { p.mover.H.x = tx; p.mover.H.y = ty; p.mover.H.vx = p.mover.H.vy = 0; }
          AI.plan(eng, e, b.x, b.y);
          let T = 0, first = null, firstLos = null, leak = 0, maxHead = 0, lastLos = -1e9, overRun = 0, dhMax = 0, ph = 0, hAtFirst = null, trail = '';
          drive(AI, (eng2, e2, dt) => {
            if (e2 !== e) return;
            AI.follow(eng, e, dt, pace, {});
            if (mode === 'swivel') { const want = AI.headAhead(eng, e), hh = e.head || 0, Rr = Hs.rate * dt; e.head = hh + clamp((want - hh) * Math.min(1, dt * 6), -Rr, Rr); }
            else e.head = 0;
          }, () => w.run(9, () => {
            T += DT; const s = g.sees(e.x, e.y, p.x, p.y, p.prof); if (s) { lastLos = T; if (firstLos === null) firstLos = T; }
            if (e.seenNow.has(p.id)) { if (first === null) { first = T; hAtFirst = e.head; } if (T - lastLos > .2) leak++; }
            if (first === null) maxHead = Math.max(maxHead, Math.abs(e.head || 0));
            if (e.speed > 240 && Math.abs(e.head || 0) > Hs.run + 1e-6) overRun++;
            dhMax = Math.max(dhMax, Math.abs((e.head || 0) - ph) / DT); ph = e.head || 0;
            if (Math.round(T / DT) % 6 === 0) trail += e.x.toFixed(2) + ',' + e.y.toFixed(2) + ';';
            return Math.hypot(b.x - e.x, b.y - e.y) > 24;
          }));
          if (!p.alive) throw new Error('bends: the standing person is not alive');
          res[mode] = { first, firstLos, leak, maxHead: +maxHead.toFixed(3), hAtFirst: hAtFirst === null ? null : +hAtFirst.toFixed(3), overRun, dhMax: +dhMax.toFixed(2), T: +T.toFixed(3), trail };
        }
        const same = res.swivel.trail === res.straight.trail; delete res.swivel.trail; delete res.straight.trail;
        out.push({ i, wp0: [Math.round(W[0].x), Math.round(W[0].y)], pace, bend: +Math.abs(angDiff(l2, l1)).toFixed(2), sameTrail: same, swivel: res.swivel, straight: res.straight });
      }
    }
    e.x = home.x; e.y = home.y;
    return { routes: made, runs: out, caps: Hs, sp: H };
  },
};
