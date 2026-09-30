/* NAVIGATION acceptance (Part 1B).  Standard fixtures on the real level with the real movement code:
 *  A/B/E routes across rooms (corridors, 90-degree corners, two possible ways)   C/D/J every narrow doorway at 0/30/60 degrees, both species
 *  F/G/H a pillar, a bar, the cross and the L-shaped wall island: a player runs laps round it while a hound hunts (real AI)
 *  I     rapid reversals through a doorway      K/L vault shortcut and crawl-only routes (capabilities)      M two bodies through one doorway
 *  N     a runner through 3+ rooms (real AI)    O     line of sight lost round a corner (real AI)            + stuck recovery, NaN, cost, repaths
 * The numbers the thresholds are set against are in README (Part 1B): the build before this pass is the baseline. */
'use strict';
const { World, DT, dist, geo, rate, avg } = require('./lib.js');
const B = require('./nav_bench.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
let F = null; const fx = () => F || (F = B.fixtures());
const TAU = Math.PI * 2;

/* wall islands: non-floor 96-px tile groups that do not touch the outside and are small enough to run round */
function islands() {
  const G = geo(), a = G.w.ad, C = 96, R = 72, fl = (c, r) => c >= 0 && r >= 0 && c < C && r < R && a.floor(c, r), seen = new Uint8Array(C * R), out = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (fl(c, r) || seen[r * C + c]) continue; const q = [[c, r]]; seen[r * C + c] = 1; const cells = []; let border = false;
    while (q.length) { const [x, y] = q.pop(); cells.push([x, y]); if (x === 0 || y === 0 || x === C - 1 || y === R - 1) border = true; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R || fl(nx, ny) || seen[ny * C + nx]) continue; seen[ny * C + nx] = 1; q.push([nx, ny]); } }
    if (border || cells.length > 12) continue;
    const xs = cells.map(p => p[0]), ys = cells.map(p => p[1]), x0 = Math.min(...xs) * 96, y0 = Math.min(...ys) * 96, x1 = (Math.max(...xs) + 1) * 96, y1 = (Math.max(...ys) + 1) * 96;
    const m = 78, ring = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].map(([x, y]) => ({ x, y }));
    if (!ring.every(p => G.ad.clear(p.x, p.y, 20, 'walk'))) continue;
    let ok = true; for (let k = 0; k < 4 && ok; k++) { const p = ring[k], q2 = ring[(k + 1) % 4]; if (!G.g.lineClear(p.x, p.y, q2.x, q2.y, 16, 'walk')) ok = false; }   // a clean lap exists
    if (ok) out.push({ n: cells.length, x0, y0, x1, y1, ring });
  }
  return out;
}

add('NV01 A/B/E reachable targets are reached: 40 hound routes (292 px/s) and 20 smiler routes across rooms, corners and doorways', () => {
  const P = B.pairs(fx(), 40, 3), h = P.map((p, i) => B.runRoute('hound', p.a, p.b, 292, 100 + i)), s = P.slice(0, 20).map((p, i) => B.runRoute('smiler', p.a, p.b, 108, 300 + i, { lim: 60 }));
  const all = h.concat(s), slow = h.filter(r => r.t > (r.d / 292) * 1.6 + 1.5);
  return { ok: rate(all) === 1 && slow.length === 0, note: `arrived ${all.filter(r => r.ok).length}/${all.length}; hound avg ${avg(h.map(r => r.t)).toFixed(1)} s, smiler avg ${avg(s.map(r => r.t)).toFixed(1)} s; hound runs much slower than distance/speed: ${slow.length}` };
});
add('NV02 solids are never entered and nothing is NaN (all routes, doorways and chases): no tick inside the collision margin, no emergency un-embedding', () => {
  const P = B.pairs(fx(), 30, 5), rs = P.map((p, i) => B.runRoute(i % 2 ? 'smiler' : 'hound', p.a, p.b, i % 2 ? 108 : 292, 400 + i, { lim: 60 }));
  const pu = B.pursuit(fx(), 8), bad = rs.reduce((a, r) => a + r.bad, 0) + pu.reduce((a, r) => a + r.bad, 0), nan = rs.reduce((a, r) => a + r.nan, 0) + pu.reduce((a, r) => a + r.nan, 0), em = rs.reduce((a, r) => a + r.emergency, 0);
  return { ok: bad === 0 && nan === 0 && em === 0, note: `ticks inside a wall margin ${bad}, NaN ${nan}, emergency un-embeds ${em} over ${rs.length} routes + ${pu.length} chases` };
});
add('NV03 C/D/J doorway traversal: every narrow doorway, approached head-on and at 30/60 degrees, both species: all through, no ramming, little touching', () => {
  const rs = B.doorTrials(fx()), h = rs.filter(r => r.kind === 'hound'), s = rs.filter(r => r.kind === 'smiler');
  const bonks = rs.reduce((a, r) => a + r.bonks, 0), stuck = rs.reduce((a, r) => a + r.stuck, 0), worst = Math.max(...rs.map(r => r.contacts)), h60 = h.filter(r => r.off > 50);
  const ok = rate(rs) === 1 && bonks === 0 && stuck === 0 && avg(h.map(r => r.contacts)) < 1.2 && avg(h60.map(r => r.contacts)) < 2 && avg(s.map(r => r.contacts)) < 1.5 && Math.max(...rs.map(r => r.flips)) < 8;
  return { ok, note: `${rs.length} passes through ${fx().doors.length} doorways: through ${(rate(rs) * 100) | 0}%, bonks ${bonks}, stuck ${stuck}; wall-contact ticks per pass hound ${avg(h.map(r => r.contacts)).toFixed(2)} (60 deg ${avg(h60.map(r => r.contacts)).toFixed(2)}), smiler ${avg(s.map(r => r.contacts)).toFixed(2)}; worst single pass ${worst}; most heading wobbles in one pass ${Math.max(...rs.map(r => r.flips))} (baseline: hound 2.43 / 5.42 at 60 deg, smiler 0.86)` };
});
add('NV04 paths simplify when safe: routes are string-pulled (far fewer waypoints than grid cells) and never cut through a wall', () => {
  const G = geo(), P = B.pairs(fx(), 30, 7); let raw = 0, sm = 0, bad = 0;
  for (const [i, p] of P.entries()) {
    const w = World(600 + i), e = w.hound(p.a.x, p.a.y); const g = w.eng.geo, r0 = g.path(p.a.x, p.a.y, p.b.x, p.b.y, e.caps); if (!r0) continue;
    w.eng.navGo(e, { x: p.b.x, y: p.b.y, speed: 292 }); w.step();                                  // one tick plans the route
    raw += r0.length; sm += e.path.length + 1;
    let q = e; for (const wp of e.path) { if (!wp.link && (wp.c | 0) <= 1 && !g.lineClear(q.x, q.y, wp.x, wp.y, e.rc - 1, 'walk')) bad++; q = wp.link ? { x: wp.x, y: wp.y } : wp; }
  }
  return { ok: sm / raw < .3 && bad === 0, note: `${P.length} routes: ${raw} grid cells -> ${sm} waypoints (${((sm / raw) * 100).toFixed(0)} %); legs that would cross a wall: ${bad}` };
});
add('NV05 F/G/H single-obstacle loops: laps round a pillar / bar / cross / L-shaped wall do not beat a hunting hound (real AI, real stamina)', () => {
  const I = islands(); const rs = [];
  for (const [k, isl] of I.filter((_, i) => i % 3 === 0).slice(0, 12).entries()) for (const dir of [1, -1]) {
    const w = World(1000 + k * 2 + (dir > 0 ? 0 : 1)), ring = isl.ring; let idx = 0;
    const p = w.player(ring[0].x, ring[0].y, { light: true }); p.go(ring[1].x, ring[1].y, 'run'); idx = 1;
    const opp = ring[2], h = w.hound((ring[2].x + ring[3].x) / 2, (ring[2].y + ring[3].y) / 2); h.state = 'HUNTING'; h.target = p.id; h.ang = Math.atan2(p.y - h.y, p.x - h.x);
    let t = 0, caught = false; const n0 = h.nav ? h.nav.plans : 0;
    while (t < 60) { if (!p.tx) { idx = (idx + dir + 4) % 4; const q = ring[idx]; p.go(q.x, q.y, 'run'); } w.step(); t += DT; if (p.caught || p.dead) { caught = true; break; } }
    rs.push({ n: isl.n, dir, caught, t: +t.toFixed(1), plans: (h.nav ? h.nav.plans : 0) - n0 });
  }
  const c = rate(rs, r => r.caught);
  return { ok: rs.length >= 10 && c >= .85, note: `${rs.length} loop runs round ${new Set(rs.map(r => r.n)).size} island sizes: caught ${(c * 100) | 0}% within 60 s (median ${rs.filter(r => r.caught).map(r => r.t).sort((a, b) => a - b)[rs.filter(r => r.caught).length >> 1]} s); replans per run ${avg(rs.map(r => r.plans)).toFixed(1)}` };
});
add('NV06 I rapid reversals through a doorway: a player hopping back and forth through a door every 1.2 s does not cause a repath storm and is caught', () => {
  const D = fx().doors.filter((d, i) => i % 3 === 0).slice(0, 10), rs = [];
  for (const [k, d] of D.entries()) {
    const a = { x: d.x + Math.cos(d.ax) * 90, y: d.y + Math.sin(d.ax) * 90 }, b = { x: d.x - Math.cos(d.ax) * 90, y: d.y - Math.sin(d.ax) * 90 }, hs = { x: d.x + Math.cos(d.ax) * 520, y: d.y + Math.sin(d.ax) * 520 };
    if (![a, b, hs].every(q => geo().ad.clear(q.x, q.y, 24, 'walk'))) continue;
    const w = World(1100 + k), p = w.player(a.x, a.y, { light: true }), h = w.hound(hs.x, hs.y); h.state = 'HUNTING'; h.target = p.id; h.ang = d.ax + Math.PI;
    let t = 0, caught = false, flip = 0; const n0 = h.nav ? h.nav.plans : 0;
    while (t < 40) { if (t >= flip) { flip += 1.2; const q = (Math.round(t / 1.2) % 2) ? b : a; p.go(q.x, q.y, 'run'); } w.step(); t += DT; if (p.caught || p.dead) { caught = true; break; } }
    rs.push({ caught, t, pps: ((h.nav ? h.nav.plans : 0) - n0) / t });
  }
  return { ok: rs.length >= 5 && rate(rs, r => r.caught) >= .8 && Math.max(...rs.map(r => r.pps)) < 2.5, note: `${rs.length} doors: caught ${(rate(rs, r => r.caught) * 100) | 0}% (avg ${avg(rs.filter(r => r.caught).map(r => r.t)).toFixed(1)} s); new routes per second avg ${avg(rs.map(r => r.pps)).toFixed(2)}, worst ${Math.max(...rs.map(r => r.pps)).toFixed(2)}` };
});
add('NV07 K/L traversal capabilities: routes only use cells the species may use (smilers never crawl), vault links are costed, not free', () => {
  const G = geo(), g = G.g, P = B.pairs(fx(), 40, 11); let smCrawl = 0, n = 0, hVault = 0, hCrawl = 0;
  for (const p of P) {
    const sm = g.path(p.a.x, p.a.y, p.b.x, p.b.y, { CAN_VAULT: true, VAULT_SPEED: .6, CAN_CRAWL: false, CAN_USE_TIGHT_GAPS: false }), hd = g.path(p.a.x, p.a.y, p.b.x, p.b.y, { CAN_VAULT: true, VAULT_SPEED: 1.2, CAN_CRAWL: true });
    if (sm) { n++; smCrawl += sm.filter(w => (w.c | 0) >= 2).length; } if (hd) { hVault += hd.filter(w => w.link).length; hCrawl += hd.filter(w => (w.c | 0) >= 2).length; }
  }
  // a vault is chosen only when it saves real distance: cost of every link = length + 70 px (plus slower vaulters pay more)
  const L = [...g.links.values()].flat(), costed = L.every(l => l.cost >= Math.hypot(l.ax - l.bx, l.ay - l.by) + 69);
  return { ok: smCrawl === 0 && costed && n > 30, note: `${n} smiler routes: crawl/tight-gap cells used ${smCrawl}; hound routes used ${hVault} vault links and ${hCrawl} crawl cells (it may); every one of ${L.length} vault links costs its length + 70 px (x 1/VAULT_SPEED)` };
});
add('NV08 M two bodies through one doorway: they pass, press a little, never sit inside each other', () => {
  const rs = [];
  for (const [k, D] of fx().doors.slice(0, 24).entries()) for (const kinds of [['hound', 'hound'], ['hound', 'smiler']]) {
    const back = D.ax + Math.PI, per = D.ax + Math.PI / 2, a1 = { x: D.x + Math.cos(back) * 260 + Math.cos(per) * 36, y: D.y + Math.sin(back) * 260 + Math.sin(per) * 36 }, a2 = { x: D.x + Math.cos(back) * 300 - Math.cos(per) * 36, y: D.y + Math.sin(back) * 300 - Math.sin(per) * 36 }, b = { x: D.x + Math.cos(D.ax) * 300, y: D.y + Math.sin(D.ax) * 300 };
    if (![a1, a2, b].every(p => geo().ad.clear(p.x, p.y, 24, 'walk'))) continue;
    const w = World(1200 + k), P = w.player(9000, 60, { light: false }); P.stop('stand');
    const e1 = kinds[0] === 'hound' ? w.hound(a1.x, a1.y) : w.smiler(a1.x, a1.y), e2 = kinds[1] === 'hound' ? w.hound(a2.x, a2.y) : w.smiler(a2.x, a2.y); e1.ang = e2.ang = D.ax;
    w.eng.navGo(e1, { x: b.x, y: b.y, speed: kinds[0] === 'hound' ? 292 : 108, arrive: 40 }); w.eng.navGo(e2, { x: b.x, y: b.y, speed: kinds[1] === 'hound' ? 292 : 108, arrive: 40 });
    let t = 0, deep = 0, worst = 1e9; while (t < 20 && (e1.navGo || e2.navGo)) { w.step(); t += DT; const d = dist(e1, e2); worst = Math.min(worst, d); if (d < (e1.r + e2.r) * .5) deep += DT; }
    rs.push({ ok: !e1.navGo && !e2.navGo, deep, worst, k: kinds.join('+') });
  }
  return { ok: rs.length >= 10 && rate(rs) >= .95 && Math.max(...rs.map(r => r.deep)) < .4, note: `${rs.length} pairs: through ${(rate(rs) * 100) | 0}%; longest time deeply overlapped ${Math.max(...rs.map(r => r.deep)).toFixed(2)} s; closest approach avg ${avg(rs.map(r => r.worst)).toFixed(0)} px (bodies 26+26 / 26+23)` };
});
add('NV09 N a runner through 3+ rooms (real AI): caught every time, no ramming, little touching, no repath storm', () => {
  const rs = B.pursuit(fx(), 10);
  return { ok: rs.length >= 8 && rate(rs, r => r.caught) === 1 && rs.every(r => r.bonks === 0) && avg(rs.map(r => r.contacts)) < 5 && avg(rs.map(r => r.plansPerS)) < 1 && Math.max(...rs.map(r => r.plansPerS)) < 2, note: `${rs.length} chases: caught ${(rate(rs, r => r.caught) * 100) | 0}% (avg ${avg(rs.map(r => r.t)).toFixed(1)} s); bonks ${rs.reduce((a, r) => a + r.bonks, 0)}; contact ticks avg ${avg(rs.map(r => r.contacts)).toFixed(1)} (baseline 11.6); new routes per s avg ${avg(rs.map(r => r.plansPerS)).toFixed(2)}, worst ${Math.max(...rs.map(r => r.plansPerS)).toFixed(2)} (the build before Part 1B, same chases, counting every A* call: avg 1.90, worst 2.82)` };
});
add('NV10 O line of sight lost round a corner (real AI): the hound heads for where it last knew the runner was going, not where the runner really is, and does not freeze', () => {
  const rs = [], P = B.pairs(fx(), 60, 13);
  for (const [k, pr] of P.entries()) {
    if (rs.length >= 10) break;
    const w = World(1300 + k), p = w.player(pr.a.x, pr.a.y, { light: true }); if (!p.pathTo(pr.b.x, pr.b.y, 'run')) continue; p.stamina = 1e9;
    const h = w.hound(pr.a.x, pr.a.y); const f = p.path[Math.min(2, p.path.length - 1)]; h.x = pr.a.x - (f.x - pr.a.x) * .6; h.y = pr.a.y - (f.y - pr.a.y) * .6; if (!w.ad.clear(h.x, h.y, 24, 'walk')) continue;
    h.state = 'HUNTING'; h.target = p.id; h.tr.PERSISTENCE = .9;
    let t = 0, lostAt = -1, still = 0, maxStill = 0, toReal = 0, toEst = 0, samples = 0;
    while (t < 20) {
      p.stamina = 1e9; w.step(); t += DT; if (p.caught || p.dead) break;
      const r = h.mem.p.get(p.id); if (!r) continue;
      if (!r.seen && lostAt < 0 && t > .5) lostAt = t;
      if (lostAt >= 0 && t - lostAt < 3 && h.state === 'HUNTING') {
        if (h.speed < 15) still += DT; else still = 0; maxStill = Math.max(maxStill, still);
        if (h.goal && t - lostAt > .3) { samples++; const dReal = Math.hypot(h.goal.x - p.x, h.goal.y - p.y), dEst = Math.hypot(h.goal.x - r.lkx, h.goal.y - r.lky); if (dReal < 20 && dEst > 150) toReal++; }
      }
      if (lostAt >= 0 && t - lostAt > 3) break;
    }
    if (lostAt >= 0) rs.push({ maxStill, cheat: toReal, samples });
  }
  return { ok: rs.length >= 6 && rs.every(r => r.cheat === 0) && Math.max(...rs.map(r => r.maxStill)) < 1, note: `${rs.length} runs that broke line of sight: ticks steering at the runner's true hidden spot (not its memory) ${rs.reduce((a, r) => a + r.cheat, 0)}; longest standstill while still hunting ${Math.max(...rs.map(r => r.maxStill)).toFixed(2)} s` };
});
add('NV11 stuck recovery: a hound wedged nose-first into a concave corner / against a pillar gets out and arrives (no teleport)', () => {
  const I = islands(), G = geo(); const rs = [];
  for (const [k, isl] of I.slice(0, 16).entries()) {
    // nose into the island's middle from one side, goal straight through it on the other side
    const cx = (isl.x0 + isl.x1) / 2, cy = (isl.y0 + isl.y1) / 2, w = World(1400 + k), P = w.player(9000, 60, { light: false }); P.stop('stand');
    const s = { x: isl.x0 - 22, y: cy }, g = { x: isl.x1 + 70, y: cy }; if (!G.ad.clear(s.x, s.y, 20.5, 'walk') || !G.ad.clear(g.x, g.y, 24, 'walk')) continue;
    const e = w.hound(s.x, s.y); e.ang = 0; w.eng.navGo(e, { x: g.x, y: g.y, speed: 292, arrive: 24, direct: false }); let t = 0; while (t < 15 && e.navGo) { w.step(); t += DT; }
    rs.push({ ok: !e.navGo, t, em: e.nav ? e.nav.emergency : 0 });
  }
  return { ok: rs.length >= 6 && rate(rs) === 1 && rs.every(r => r.em === 0), note: `${rs.length} wedged starts: out and arrived ${(rate(rs) * 100) | 0}% (avg ${avg(rs.map(r => r.t)).toFixed(1)} s); emergency teleports ${rs.reduce((a, r) => a + r.em, 0)}` };
});
add('NV12 cost: navigation per tick stays cheap and path searches stay rare in a busy world (3 hounds, 5 smilers, 4 players moving, 120 s)', () => {
  const w = World(77, { director: false }), G = geo(), pts = G.cells.filter((_, i) => i % 97 === 0).map(c => ({ x: G.g.cx(c), y: G.g.cy(c) })).filter(p => G.ad.clear(p.x, p.y, 24, 'walk'));
  const pl = [0, 1, 2, 3].map(i => { const q = pts[(i * 53) % pts.length], p = w.player(q.x, q.y, { light: i % 2 === 0 }); return p; });
  for (let i = 0; i < 3; i++) { const q = pts[(i * 71 + 5) % pts.length]; w.hound(q.x, q.y); } for (let i = 0; i < 5; i++) { const q = pts[(i * 37 + 9) % pts.length]; w.smiler(q.x, q.y); }
  let t = 0, worst = 0; const paths0 = w.eng.stats.paths || 0, t0 = process.hrtime.bigint();
  while (t < 120) { for (const [i, p] of pl.entries()) if (!p.path || !p.path.length) { const q = pts[(Math.floor(t * 3) * 13 + i * 29) % pts.length]; p.pathTo(q.x, q.y, i === 0 ? 'run' : 'walk'); } const a = process.hrtime.bigint(); w.step(); const ms = Number(process.hrtime.bigint() - a) / 1e6; if (t > 2) worst = Math.max(worst, ms); t += DT; }
  const avgMs = Number(process.hrtime.bigint() - t0) / 1e6 / (120 / DT), pps = ((w.eng.stats.paths || 0) - paths0) / 120;
  return { ok: avgMs < 1.5 && pps < 12, note: `sim step avg ${avgMs.toFixed(3)} ms, worst ${worst.toFixed(1)} ms; path searches ${pps.toFixed(2)} per second across ${w.eng.entities.length} entities`, data: { avgMs, worst, pps } };
});
module.exports = S;
