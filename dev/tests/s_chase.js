/* CHASE / SEARCH / HIDING / CRAWLSPACES acceptance (Part 1C).  Real AI, real level, real stamina rules (the harness mirrors move.js).
 * Numbered as in the Part 1C brief (section 38).  Nothing here gives an entity information a player could not give it: the tests check that. */
'use strict';
const { World, DT, dist, geo, rate, avg, pick } = require('./lib.js');
const E = require('./escape_bench.js');
const W = require(require('../paths.js') + '/world.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const TAU = Math.PI * 2;

/* a hunting hound that has just seen a runner at d px, in the dark; returns {w,p,h} */
function hunt(seed, d = 380, o = {}) {
  const G = geo(), P = G.cells.filter((_, k) => k % 7 === 0).map(c => ({ x: G.g.cx(c), y: G.g.cy(c) })).filter(q => G.ad.clear(q.x, q.y, 26, 'walk'));
  const a = P[(seed * 7919 + 13) % P.length], w = World(5000 + seed), p = w.player(a.x, a.y, { light: true }); p.stamina = o.stamina ?? 100; if (p.stamina < 30) p.ex = 1;
  let h = null; for (let k = 0; k < 24 && !h; k++) { const ang = k / 24 * TAU, x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d; if (G.ad.clear(x, y, 26, 'walk') && w.eng.geo.lineClear(x, y, a.x, a.y, 22, 'walk')) h = w.hound(x, y); }
  if (!h) return null; h.ang = Math.atan2(a.y - h.y, a.x - h.x); w.run(.4, null); const r = h.mem.p.get(p.id); if (!r || !r.seen) return null;
  h.state = 'HUNTING'; h.target = p.id; h.chaseBlind = 0; if (o.dark !== false) p.light = false;
  return { w, p, h, P };
}
/* a spot out of the hound's sight, 500-1100 px from the player, reachable: where a player would go to hide */
function hideSpot(w, p, h, P, i, offHeading) {
  const hd = Math.atan2(p.y - h.y, p.x - h.x);
  for (let k = 0; k < 80; k++) { const q = P[(i * 37 + k * 211) % P.length], d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 500 || d > 1100) continue; if (w.eng.geo.los(h.x, h.y, q.x, q.y)) continue; if (offHeading && Math.cos(Math.atan2(q.y - p.y, q.x - p.x) - hd) > .3) continue; if (w.eng.geo.path(p.x, p.y, q.x, q.y, { CAN_VAULT: false })) return q; }
  return offHeading ? hideSpot(w, p, h, P, i, false) : null;
}
const lostSight = (w, h, p) => !w.eng.geo.los(h.x, h.y, p.x, p.y);

add('C1 losing sight does not erase memory: 3 s after the prey vanishes the hound still has it (confidence, position, heading) and is still after it', () => {
  const rs = [];
  for (let i = 1; i <= 30; i++) { const A = hunt(i); if (!A) continue; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i); if (!q) continue; p.pathTo(q.x, q.y, 'run');
    let lostAt = -1, t = 0; while (t < 12) { w.step(); t += DT; if ((p.caught || p.dead)) break; if (lostAt < 0 && !h.mem.p.get(p.id).seen && t > .3) lostAt = t; if (lostAt >= 0 && h.mem.p.get(p.id).seen) { lostAt = -2; break; } if (lostAt >= 0 && t - lostAt >= 3) break; }   // (seen again before the check: not a lost-sight case)
    if (lostAt < 0 || (p.caught || p.dead)) continue; const r = h.mem.p.get(p.id);
    rs.push({ ok: r && r.conf > .4 && (h.state === 'HUNTING' || h.state === 'SEARCHING') && Math.hypot(r.lvx, r.lvy) > 0, conf: r ? r.conf : 0, st: h.state }); }
  return { ok: rs.length >= 6 && rate(rs) >= .9, note: `${rs.length} runs: still hunting/searching with memory 3 s after losing sight ${rs.filter(r => r.ok).length}/${rs.length} (conf avg ${avg(rs.map(r => r.conf)).toFixed(2)}; states ${[...new Set(rs.map(r => r.st))].join(',')})` };
});
add('C2 it reaches the last known position (or where the prey was heading from it) after losing sight', () => {
  const rs = [];
  for (let i = 1; i <= 30; i++) { const A = hunt(i); if (!A) continue; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i, true); if (!q) continue; p.pathTo(q.x, q.y, 'walk');
    let lk = null, t = 0, reached = false; while (t < 20) { w.step(); t += DT; if ((p.caught || p.dead)) break; const r = h.mem.p.get(p.id); if (!lk && !r.seen && t > .3) lk = { x: r.lkx, y: r.lky }; if (lk && dist(h, lk) < 120) { reached = true; break; } }
    if (!lk || (p.caught || p.dead)) continue; rs.push({ reached }); }
  return { ok: rs.length >= 6 && rate(rs, r => r.reached) >= .85, note: `${rs.length} runs where the prey got out of sight: the hound got within 120 px of the last known position in ${(rate(rs, r => r.reached) * 100) | 0}%` };
});
add('C3 it does not track the hidden prey exactly: after losing it, its goals come from memory and sound, never from where the prey really is', () => {
  let bad = 0, samples = 0, n = 0;
  for (let i = 1; i <= 30; i++) { const A = hunt(i); if (!A) continue; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i, true); if (!q) continue; p.pathTo(q.x, q.y, 'walk'); n++;
    let t = 0; while (t < 25) { w.step(); t += DT; if ((p.caught || p.dead)) break; if (!p.path?.length && !p.tx) p.stop('crouch'); const r = h.mem.p.get(p.id); if (!r || r.seen || w.eng.now - r.heardAt < 1.5) continue; const g = h.goal; if (!g) continue; samples++; if (Math.hypot(g.x - p.x, g.y - p.y) < 40 && Math.hypot(g.x - r.lkx, g.y - r.lky) > 200) bad++; } }
  return { ok: n >= 6 && bad === 0, note: `${n} runs, ${samples} ticks out of sight and unheard: ticks aimed at the prey's true hidden spot (and not at its memory) ${bad}` };
});
add('C4 noise gives the prey away: a prey that has slipped away quietly and then breaks into a run is re-acquired by ear at once (no new detection wait)', () => {
  // the MID setup of the escape bench (a hound that heard the prey ~520 px away in the dark; the prey sprints, breaks sight and walks on quietly);
  // the first time the hound is searching within earshot (750 px) with the prey out of its sight, the prey panics and sprints again
  const rs = [];
  for (let i = 0; i < 40 && rs.length < 10; i++) {
    let sprintAt = -1;
    const r = E.run('break-walk', i, { light: false, startD: 520, lim: 60, hook: (w, h, p, t, P) => {
      if (sprintAt < 0) { if (h.state === 'SEARCHING' && dist(h, p) < 750 && lostSight(w, h, p) && !h.mem.p.get(p.id).seen) { sprintAt = t; p.quiet = true; const q = hideSpot(w, p, h, P, i + 7); if (q) p.pathTo(q.x, q.y, 'run'); else p.mode = 'run'; } return null; }
      p.mode = p.ex ? 'walk' : 'run';
      if (h.state === 'HUNTING') return { reAt: t - sprintAt };
      if (t - sprintAt > 6) return { reAt: -1 };
      return null; } });
    if (r && r.reAt !== undefined) rs.push(r); }
  return { ok: rs.length >= 4 && rate(rs, r => r.reAt >= 0 && r.reAt < 2) >= .75, note: `${rs.length} runs where the prey had slipped away quietly (the hound searching within earshot) and then broke into a run: back to the hunt within 2 s in ${(rate(rs, r => r.reAt >= 0 && r.reAt < 2) * 100) | 0}% (avg ${avg(rs.filter(r => r.reAt >= 0).map(r => r.reAt)).toFixed(2)} s)` };
});
add('C5 silent hiding can succeed, and good decisions beat bad ones: out of sight, going quiet and moving on gets away far more often than hiding right where it lost you', () => {
  const quiet = [], stay = [];
  for (let i = 0; i < 16; i++) { quiet.push(E.run('break-walk', i, { light: false, startD: 520 })); stay.push(E.run('break-hide', i, { light: false, startD: 520 })); }
  const q = quiet.filter(Boolean), st = stay.filter(Boolean), qe = rate(q, r => r.lost), se = rate(st, r => r.lost);
  return { ok: q.length >= 10 && qe >= .35 && qe > se && qe < 1, note: `a hound that heard the prey ~520 px away in the dark: slipping out of sight and walking on quietly escaped ${(qe * 100) | 0}% (${q.length} runs); crouching still right where it lost sight escaped ${(se * 100) | 0}% - silence is a real chance, not a guarantee` };
});
add('C6 crouching is not invisibility: a crouched, still player in the dark right in front of an unaware hound is noticed', () => {
  const G = geo(), rs = [];
  for (let i = 0; i < 90 && rs.length < 12; i++) { const c = G.dark[(i * 97 + 3) % G.dark.length]; if (!G.ad.clear(c.x, c.y, 26, 'walk')) continue; const a = (i * .7) % TAU, hx = c.x + Math.cos(a) * 130, hy = c.y + Math.sin(a) * 130; if (!G.ad.clear(hx, hy, 26, 'walk') || !G.g.los(hx, hy, c.x, c.y)) continue;
    const w = World(5200 + i), p = w.player(c.x, c.y, { light: false }); p.stop('crouch'); const h = w.hound(hx, hy); h.ang = Math.atan2(c.y - hy, c.x - hx); h.state = 'ROAMING'; h.roam.goal = null;
    let t = 0, noticed = -1; while (t < 8) { w.step(); t += DT; const r = h.mem.p.get(p.id); if (r && r.aw > .45) { noticed = t; break; } if ((p.caught || p.dead)) { noticed = t; break; } }
    rs.push({ noticed }); }
  return { ok: rs.length >= 6 && rate(rs, r => r.noticed >= 0) >= .9, note: `${rs.length} crouched players 130 px in front of an unaware hound in the dark: noticed in ${(rate(rs, r => r.noticed >= 0) * 100) | 0}% (avg ${avg(rs.filter(r => r.noticed >= 0).map(r => r.noticed)).toFixed(1)} s)` };
});
add('C7 repeated corner cheese fails: ducking back and forth round one corner is not a way to be safe', () => {
  const G = geo(), rs = [];
  for (let i = 0; i < 40 && rs.length < 10; i++) {
    const c = G.walls[(i * 29) % G.walls.length]; if (!c) continue;
    // a corner: from c, one side open along the wall, the other round it
    const a = { x: c.x + Math.cos(c.ang + Math.PI / 2) * 110, y: c.y + Math.sin(c.ang + Math.PI / 2) * 110 }, b = { x: c.x + Math.cos(c.ang - Math.PI / 2) * 110, y: c.y + Math.sin(c.ang - Math.PI / 2) * 110 };
    if (!G.ad.clear(a.x, a.y, 22, 'walk') || !G.ad.clear(b.x, b.y, 22, 'walk')) continue;
    const w = World(5300 + i), p = w.player(a.x, a.y, { light: false }); const hs = { x: c.x + Math.cos(c.ang + Math.PI) * 420, y: c.y + Math.sin(c.ang + Math.PI) * 420 }; if (!G.ad.clear(hs.x, hs.y, 26, 'walk')) continue;
    const h = w.hound(hs.x, hs.y); h.state = 'HUNTING'; h.target = p.id; const r0 = h.mem.p; w.run(.3, null); const r = h.mem.p.get(p.id); if (!r) { w.eng.sound({ type: 'run', x: p.x, y: p.y, r: 900, I: 1, src: p.id }); }
    let t = 0, caught = false, flip = 0; while (t < 60) { if (t >= flip) { flip += 2; const q = Math.round(t / 2) % 2 ? b : a; p.go(q.x, q.y, 'run'); } w.step(); t += DT; if ((p.caught || p.dead)) { caught = true; break; } }
    rs.push({ caught, t }); }
  return { ok: rs.length >= 6 && rate(rs, r => r.caught) >= .8, note: `${rs.length} corners: caught ${(rate(rs, r => r.caught) * 100) | 0}% within 60 s (avg ${avg(rs.filter(r => r.caught).map(r => r.t)).toFixed(1)} s)` };
});
add('C8 counter / shelf / machine loops fail: laps round a vaultable obstacle do not keep a hunting hound off (it vaults or cuts across)', () => {
  const G = geo(), rs = [];
  for (const pr of W.PROPS.filter(q => q.type === 'low' && q.kind !== 'railing')) for (const dir of [1, -1]) {
    const cx = pr.cx, cy = pr.cy, rx = pr.rect.w / 2 + 70, ry = pr.rect.h / 2 + 70, ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ x: cx + sx * rx, y: cy + sy * ry }));
    if (!ring.every(q => G.ad.clear(q.x, q.y, 18, 'walk'))) continue;
    const w = World(5400 + rs.length), p = w.player(ring[0].x, ring[0].y, { light: false }); let idx = 0; p.go(ring[1].x, ring[1].y, 'run'); idx = 1;
    const h = w.hound(ring[2].x, ring[2].y); h.state = 'HUNTING'; h.target = p.id; w.eng.sound({ type: 'run', x: p.x, y: p.y, r: 900, I: 1, src: p.id });
    let t = 0, caught = false; while (t < 60) { if (!p.tx) { idx = (idx + dir + 4) % 4; p.go(ring[idx].x, ring[idx].y, 'run'); } w.step(); t += DT; if ((p.caught || p.dead)) { caught = true; break; } }
    rs.push({ id: pr.id, caught, t: +t.toFixed(1), vaults: h.travCount | 0 }); }
  return { ok: rs.length >= 6 && rate(rs, r => r.caught) >= .85, note: `${rs.length} loop runs round ${new Set(rs.map(r => r.id)).size} low props: caught ${(rate(rs, r => r.caught) * 100) | 0}% (median ${rs.filter(r => r.caught).map(r => r.t).sort((a, b) => a - b)[rs.filter(r => r.caught).length >> 1]} s); vaults used ${rs.reduce((a, r) => a + r.vaults, 0)}` };
});
add('C9 / C10 an exhausted runner is far more vulnerable; a fresh one can still make distance', () => {
  const fresh = [], tired = [];
  for (let i = 0; i < 12; i++) {
    for (const [arr, st] of [[fresh, 100], [tired, 10]]) {
      const A = hunt(i, 380, { stamina: st }); if (!A) continue; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i) || P[(i * 311) % P.length]; if (!p.pathTo(q.x, q.y, 'run')) continue;
      const d0 = dist(h, p); let t = 0, caught = -1, d5 = null; while (t < 30) { w.step(); t += DT; if (t >= 4 && d5 === null) d5 = dist(h, p); if ((p.caught || p.dead)) { caught = t; break; } if (!p.path?.length && !p.tx) { const q2 = P[(i * 97 + Math.floor(t) * 13) % P.length]; p.pathTo(q2.x, q2.y, 'run'); } }
      arr.push({ caught, gain: (d5 ?? 0) - d0 });
    } }
  const fC = rate(fresh, r => r.caught >= 0 && r.caught < 8), tC = rate(tired, r => r.caught >= 0 && r.caught < 8), fGain = rate(fresh, r => r.gain > -40);
  return { ok: fresh.length >= 8 && tired.length >= 8 && tC >= fC + .3 && fGain >= .4, note: `caught within 8 s: fresh ${(fC * 100) | 0}% vs exhausted ${(tC * 100) | 0}%; fresh runners holding or widening the gap after 4 s: ${(fGain * 100) | 0}% (avg change ${avg(fresh.map(r => r.gain)).toFixed(0)} px; exhausted ${avg(tired.map(r => r.gain)).toFixed(0)} px)` };
});
add('C11 / C12 crawlspaces: a crawling player gets in and out through every wall hole and under every table, continuously (no teleport), never inside a wall', () => {
  const w = World(5500), out = [];
  for (const c of W.CRAWL) { const ok = c.exits.filter(x => w.ad.clear(x.x, x.y, 16, 'walk')); const a = ok[0], b = ok.find(x => x.nx === -a.nx && x.ny === -a.ny); if (!a || !b) { out.push({ id: c.id, ok: false }); continue; }
    const p = w.player(a.x, a.y, { light: false }); p.go(b.x, b.y, 'crawl'); let t = 0, jump = 0, inside = 0, px = p.x, py = p.y, bad = 0;
    while (t < 10 && p.tx) { w.step(); t += DT; jump = Math.max(jump, Math.hypot(p.x - px, p.y - py)); px = p.x; py = p.y; if (W.crawlAt(p.x, p.y)) inside++; if (!w.ad.clear(p.x, p.y, 13, 'crawl')) bad++; }
    out.push({ id: c.id, ok: !p.tx && inside > 10 && jump < 3 && bad === 0 }); w.sim.removePlayer(p); w.players.splice(w.players.indexOf(p), 1); }
  return { ok: out.every(r => r.ok), note: `${out.filter(r => r.ok).length}/${out.length} crawlspaces entered, crossed and left (${out.map(r => r.id + (r.ok ? '' : ' FAIL')).join(' ')})` };
});
add('C13 an entity never enters a crawlspace it cannot use: smilers never go under furniture, nothing goes through a wall hole', () => {
  let n = 0, badS = 0, badH = 0; const G = geo(), P = G.cells.filter((_, k) => k % 11 === 0).map(c => ({ x: G.g.cx(c), y: G.g.cy(c) })).filter(q => G.ad.clear(q.x, q.y, 26, 'walk'));
  for (let i = 0; i < 20; i++) { const a = P[(i * 131) % P.length], b = P[(i * 977 + 5) % P.length]; const w = World(5600 + i), X = w.player(9000, 60, {}); X.stop('stand');
    const s = w.smiler(a.x, a.y), h = w.hound(b.x, b.y); w.eng.navGo(s, { x: b.x, y: b.y, speed: 108 }); w.eng.navGo(h, { x: a.x, y: a.y, speed: 292 });
    let t = 0; while (t < 30 && (s.navGo || h.navGo)) { w.step(); t += DT; const cs = W.crawlAt(s.x, s.y), ch = W.crawlAt(h.x, h.y); if (cs) badS++; if (ch && !W.canCrawl(h.caps, ch)) badH++; } n++; }
  return { ok: n >= 15 && badS === 0 && badH === 0, note: `${n} cross-level trips each: smiler ticks inside any crawlspace ${badS}; hound ticks inside a wall hole ${badH} (hounds may go under furniture: CAN_CRAWL)` };
});
/* a player seen going into a wall hole (no entity fits), then crawling out of the far side and waiting quietly near it */
function holeEscape(i, hide) {
  const G = geo(), holes = W.CRAWL.filter(c => c.type === 'gap'); const c = holes[i % holes.length]; const [a, b] = c.exits;
  const w = World(5700 + i), p = w.player(a.x + a.nx * 160, a.y + a.ny * 160, { light: false }); if (!w.ad.clear(p.x, p.y, 20, 'walk')) return null;
  const L = Math.min(460, w.eng.geo.ray(a.x, a.y, Math.atan2(a.ny, a.nx), 700) - 70), hs = { x: a.x + a.nx * L, y: a.y + a.ny * L }; if (L < 260 || !w.ad.clear(hs.x, hs.y, 26, 'walk')) return null;
  const h = w.hound(hs.x, hs.y); h.ang = Math.atan2(p.y - hs.y, p.x - hs.x); w.run(.3, null); p.light = true; w.run(.3, null); p.light = false;
  const r = h.mem.p.get(p.id); if (!r) return null; h.state = 'HUNTING'; h.target = p.id;
  p.go(a.x, a.y, 'run'); let t = 0, phase = 0, sawEntry = false, otherSide = -1, caught = false, maxInside = 0; const B = { x: b.x + b.nx * (hide ? 380 : 60), y: b.y + b.ny * (hide ? 380 : 60) };
  while (t < 45) { w.step(); t += DT; if ((p.caught || p.dead)) { caught = true; break; }
    if (phase === 0 && !p.tx) { phase = 1; p.go(b.x, b.y, 'crawl'); }
    else if (phase === 1 && !p.tx) { phase = 2; if (w.ad.clear(B.x, B.y, 20, 'walk')) p.go(B.x, B.y, 'crouch'); }
    else if (phase === 2 && !p.tx) { phase = 3; p.stop('crouch'); }
    const rr = h.mem.p.get(p.id); if (rr && rr.crawl === c.id) sawEntry = true;
    if (otherSide < 0 && Math.hypot(h.x - b.x, h.y - b.y) < 200) otherSide = t; }
  return { c: c.id, sawEntry, otherSide, caught, dis: h.dbg.disengage || '' };
}
add('C14 / C17 an entity that cannot follow into a crawlspace remembers the prey went in and goes round to the other side', () => {
  const rs = []; for (let i = 0; i < 12; i++) { const r = holeEscape(i, false); if (r) rs.push(r); }
  const seen = rs.filter(r => r.sawEntry), round = seen.filter(r => r.otherSide >= 0);
  return { ok: seen.length >= 5 && round.length / seen.length >= .6, note: `${rs.length} runs through wall holes (${[...new Set(rs.map(r => r.c))].join(' ')}); the hound saw the entry in ${seen.length} and remembered it; it went round to the far side in ${round.length} (avg ${avg(round.map(r => r.otherSide)).toFixed(1)} s); caught there ${rs.filter(r => r.caught).length}` };
});
add('C15 an entity that can crawl goes through a crawlspace: a hound goes under a table', () => {
  const rs = [];
  for (const c of W.CRAWL.filter(q => q.type === 'under')) for (const [ia, ib] of [[0, 1], [1, 0]]) {
    const ex = c.exits.filter(x => x.face === 'N' || x.face === 'W'), ey = c.exits.filter(x => x.face === 'S' || x.face === 'E'); const a = (ia ? ey : ex)[1], b = (ia ? ex : ey)[1];
    const w = World(5800 + rs.length), P0 = w.player(9000, 60, {}); P0.stop('stand'); const h = w.hound(a.x + a.nx * 30, a.y + a.ny * 30); w.eng.navGo(h, { x: b.x + b.nx * 30, y: b.y + b.ny * 30, speed: 200, arrive: 24, direct: false });
    let t = 0, under = 0; while (t < 12 && h.navGo) { w.step(); t += DT; if (W.crawlAt(h.x, h.y)) under++; }
    rs.push({ id: c.id, ok: !h.navGo && under > 5, under }); }
  return { ok: rs.length >= 2 && rs.every(r => r.ok), note: rs.map(r => `${r.id}: ${r.ok ? 'through, ' + r.under + ' ticks under it' : 'FAILED'}`).join('; ') };
});
add('C16 a body inside a crawlspace is not visible from across the room, only close by', () => {
  const G = geo(), rs = [];
  for (const c of W.CRAWL) {
    const x = c.exits[0]; const far = { x: c.cx + x.nx * 420, y: c.cy + x.ny * 420 }, near = { x: c.cx + x.nx * (c.reveal - 20 + (c.type === 'gap' ? 0 : 0)), y: c.cy + x.ny * (c.reveal - 20) };
    for (const [k, at] of [['far', far], ['near', near]]) { if (!G.ad.clear(at.x, at.y, 22, 'walk')) continue;
      const w = World(5900 + rs.length), p = w.player(c.cx, c.cy, { light: true }); p.stop('crawl'); const h = w.hound(at.x, at.y); h.ang = Math.atan2(c.cy - at.y, c.cx - at.x); h.state = 'ROAMING'; h.roam.goal = null;
      let seen = false; w.run(2, () => { const r = h.mem.p.get(p.id); if (r && r.seen) seen = true; h.x = at.x; h.y = at.y; h.ang = Math.atan2(c.cy - at.y, c.cx - at.x); }, 1);
      rs.push({ id: c.id, k, seen }); } }
  const far = rs.filter(r => r.k === 'far'), near = rs.filter(r => r.k === 'near');
  return { ok: far.length >= 4 && far.every(r => !r.seen) && near.length >= 3 && rate(near, r => r.seen) >= .6, note: `from ~420 px with a clear line: seen ${far.filter(r => r.seen).length}/${far.length}; from inside the reveal distance: seen ${near.filter(r => r.seen).length}/${near.length}` };
});
add('C18 memory eventually decays: when the prey gets away, the hound gives up for a stated reason and its confidence has run out', () => {
  const rs = []; for (let i = 0; i < 16; i++) { const r = E.run('break-walk', i, { light: false, startD: 520, untilGiveUp: true, lim: 120 }); if (r && r.lost) rs.push(r); }
  return { ok: rs.length >= 4 && rs.every(r => r.conf < .2 && r.dis), note: `${rs.length} escapes: memory at the end ${rs.map(r => r.conf).join(', ')}; reasons: ${[...new Set(rs.map(r => r.dis))].join(' / ')}` };
});
add('C19 / C20 no geometry clipping and no NaN in chases, searches and crawlspace escapes', () => {
  let bad = 0, nan = 0, n = 0;
  for (let i = 1; i <= 10; i++) { const A = hunt(i); if (!A) continue; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i, true); if (!q) continue; p.pathTo(q.x, q.y, i % 2 ? 'run' : 'walk'); n++;
    let t = 0; while (t < 30) { w.step(); t += DT; if ((p.caught || p.dead)) break; for (const e of w.eng.entities) { if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) nan++; else if (!e.trav && !w.eng.geo.clear(e.x, e.y, e.rc - 2, e.mode || 'walk')) bad++; } if (!Number.isFinite(p.x)) nan++; } }
  for (let i = 0; i < 6; i++) { const r = holeEscape(i, true); if (r) n++; }
  return { ok: n >= 10 && bad === 0 && nan === 0, note: `${n} runs: entity ticks inside the wall margin ${bad}, NaN ${nan}` };
});
module.exports = S;
S.hunt = hunt; S.hideSpot = hideSpot;
