/* (Trial 3 R19, the N track; Trial 3 is not owner-approved) NC04's second world: two Hounds sent after two runners by the admin's own
 * navigation command (navGo: the real route, follower, locomotion and collision at 292 px/s, routes rather than straight runs), four seeds
 * of 60 s, on the real engine.  run(lib) returns what NC04 judges; s_nanicorner.js runs it as built and, through r19n_child.js, with the N
 * hunks taken back out (R18's follower), and compares.  Not a suite: run.js does not list it. */
'use strict';
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function clearance(geo, e) {
  const mode = e.trav ? 'walk' : (e.mode || 'walk'); let m = 1e9;
  for (const t of geo.blockers(e.x, e.y, mode)) { const nx = Math.max(t.x, Math.min(e.x, t.x + t.w)), ny = Math.max(t.y, Math.min(e.y, t.y + t.h)); m = Math.min(m, Math.hypot(e.x - nx, e.y - ny)); }
  return m === 1e9 ? 99 : m - e.rc;
}
function run({ World, DT }) {
  const C = { ticks: 0, inside: 0, nan: 0, passed: 0, stuck: 0, contacts: 0, jumps: [] };
  for (const seed of [3, 5, 8, 13]) {
    const w = World(seed), eng = w.eng, g = eng.geo, R = rng(seed * 7);
    const sp = []; for (let k = 0; k < 6000 && sp.length < 160; k++) { const x = 200 + R() * (g.W - 400), y = 200 + R() * (g.H - 400); if (w.ad.clear(x, y, 30, 'walk')) sp.push({ x, y }); }
    const ps = [0, 1].map(i => { const q = sp[i * 11], p = w.player(q.x, q.y, { light: true }); p.stop('stand'); return p; });
    const hs = ps.map((p, i) => { const q = sp.find(q => { const d = Math.hypot(q.x - p.x, q.y - p.y); return d > 260 && d < 600; }) || sp[100 + i]; const h = w.hound(q.x, q.y); eng.navGo(h, { pid: p.id, speed: 292, arrive: 30, direct: false, keep: true }); return h; });
    const last = new Map(hs.map(h => [h.id, { x: h.x, y: h.y }]));
    w.run(60, (ww, t) => {
      if (Math.round(t * 60) % 240 === 0) for (const p of ps) { const q = sp[Math.floor(R() * sp.length)]; p.pathTo(q.x, q.y, 'run'); p.stamina = 100; p.ex = 0; }
      for (const h of hs) { if (!eng.entities.includes(h)) continue; C.ticks++;
        if (![h.x, h.y, h.ang, h.speed].every(Number.isFinite)) C.nan++;
        if (!h.trav && clearance(g, h) < -.01) C.inside++;
        const L = last.get(h.id), st = Math.hypot(h.x - L.x, h.y - L.y); if (!h.trav && st > (h.sp.vTop || 300) * DT * 1.15 + 1) C.jumps.push([seed, +t.toFixed(2), +st.toFixed(1)]); last.set(h.id, { x: h.x, y: h.y }); }
      return true; });
    for (const h of hs) { const n = h.nav || {}; C.passed += n.passed || 0; C.stuck += n.stuckN || 0; C.contacts += n.contacts || 0; }
  }
  return C;
}
module.exports = { run };
