/* SYSTEM scenarios: level of detail, performance, snapshot size, stuck entities, turning / snapping, wall clipping, determinism, caps, bodies */
'use strict';
const { World, DT, dist, LONG, geo, over, rate, avg, stateNames, WORLD, TAU, pick, tracker, floorNear } = require('./lib.js');
const createSim = require(require('../paths.js') + '/sim.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const angD = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };

add('Y01 level of detail: perception runs at full rate near a player, at a reduced rate further out, and not at all while an entity is far away', () => {
  /* one hound alone in the world: every perception update is its own; each tick's updates are credited to the tier the hound is in once that tick has been simulated */
  const probe = d => {
    const w = World(11), p = w.player(3300, LONG.y, {}); p.stop('stand'); const h = w.hound(3300 + d, LONG.y); h.state = 'ROAMING'; h.sp = { ...h.sp, tick() {} }; w.run(1, null); // scheduler-only: do not let the newly light-responsive Hound kill the test's clock source
    const per = { near: { n: 0, t: 0 }, mid: { n: 0, t: 0 }, far: { n: 0, t: 0 } }; let last = w.eng.stats.sense;
    for (let i = 0; i < 16 * 60; i++) { w.step(); const now = w.eng.stats.sense, t = per[h.tier]; t.n += now - last; t.t += DT; last = now; }
    return per;
  };
  const a = probe(1000), b = probe(2900), c = probe(5000);
  const rateOf = t => t && t.t > 1 ? t.n / t.t : null;
  const rn = rateOf(a.near), rm = rateOf(b.mid), rf = rateOf(c.far);
  return { ok: rn !== null && rm !== null && rf !== null && rn > 7 && rm > 1.5 && rm < rn * .5 && rf === 0, note: `perception updates per second: near ${rn === null ? 'n/a' : rn.toFixed(1)}, mid ${rm === null ? 'n/a' : rm.toFixed(1)}, far ${rf === null ? 'n/a' : rf.toFixed(1)} (the far hound spent ${c.far.t.toFixed(1)} s in the far tier before its coarse drift brought it into range)` };
});
add('Y02 performance: the shipped population and a stress population fit the frame budget', () => {
  const G = geo(); const bench = (nh, ns, np, secs) => {
    const w = World(21), cells = G.cells; const players = [];
    for (let i = 0; i < np; i++) { const c = cells[(i * 977 + 13) % cells.length]; const p = w.player(G.g.cx(c), G.g.cy(c), { light: i % 2 === 0 }); p.route([{ x: p.x + 200, y: p.y }, { x: p.x, y: p.y + 200 }, { x: p.x - 200, y: p.y }], i % 3 ? 'walk' : 'run'); p.god = false; players.push(p); }
    for (let i = 0; i < nh; i++) { const c = cells[(i * 1543 + 5) % cells.length]; const h = w.hound(G.g.cx(c), G.g.cy(c)); }
    for (let i = 0; i < ns; i++) { const c = G.dark[(i * 331 + 9) % G.dark.length]; w.smiler(c.x, c.y); }
    for (const p of players) p.safe = 0;
    const times = []; const n = Math.round(secs / DT);
    for (let i = 0; i < n; i++) { for (const p of players) if (!p.path || !p.path.length) p.route([{ x: p.x + 200, y: p.y }, { x: p.x, y: p.y + 200 }, { x: p.x - 200, y: p.y }], 'walk'); const t0 = process.hrtime.bigint(); w.step(); times.push(Number(process.hrtime.bigint() - t0) / 1e6); }
    times.sort((x, y) => x - y); return { avg: times.reduce((x, y) => x + y, 0) / times.length, p99: times[Math.floor(times.length * .99)], max: times[times.length - 1] };
  };
  const std = bench(3, 5, 4, 30), stress = bench(10, 12, 8, 20);
  return { ok: std.avg < 1.2 && std.p99 < 5 && stress.avg < 5 && stress.p99 < 14, note: `per 60 Hz step: shipped (3 hounds, 5 smilers, 4 players) avg ${std.avg.toFixed(2)}ms p99 ${std.p99.toFixed(2)}ms; stress (10+12 entities, 8 players) avg ${stress.avg.toFixed(2)}ms p99 ${stress.p99.toFixed(2)}ms  [budget 16.7ms]` };
});
add('Y03 snapshot size: what goes over the wire every 50 ms stays small (entities are quantised; nothing per-player-private is sent)', () => {
  const G = geo(), w = World(31); const cells = G.cells;
  for (let i = 0; i < 4; i++) { const c = cells[(i * 977 + 13) % cells.length]; const p = w.player(G.g.cx(c), G.g.cy(c), {}); p.route([{ x: p.x + 300, y: p.y }, { x: p.x, y: p.y + 300 }], 'run'); }
  for (let i = 0; i < 3; i++) { const c = cells[(i * 1543 + 5) % cells.length]; w.hound(G.g.cx(c), G.g.cy(c)); }
  for (let i = 0; i < 5; i++) { const c = G.dark[(i * 331 + 9) % G.dark.length]; w.smiler(c.x, c.y); }
  let maxB = 0, sum = 0, n = 0, leak = false;
  w.run(60, () => { const e = w.sim.entities(), s = JSON.stringify(e); maxB = Math.max(maxB, s.length); sum += s.length; n++; if (/"mem"|"tr"|"lkx"|"target"/.test(s)) leak = true; }, 3);
  const perSec = sum / n * 20;
  return { ok: maxB < 3600 && !leak, note: `entity snapshot avg ${(sum / n) | 0} B, max ${maxB} B (~${(perSec / 1024).toFixed(1)} KB/s per client at 20 Hz before gzip); internal AI state leaked: ${leak}` };
});
add('Y04 stuck entities: one embedded in a wall is set back on open floor and one that cannot go anywhere does not stand frozen forever', () => {
  const G = geo(); const rs = over([1, 2, 3, 4, 5, 6], i => {
    const w = World(41 + i), p = w.player(1300, 3300, {}); p.stop('stand');
    // find a wall cell centre reasonably near the player (inside solid)
    let wx = 0, wy = 0; for (let k = 0; k < 400; k++) { const c = G.cells[(i * 71 + k * 29) % G.cells.length], x = G.g.cx(c) + 96, y = G.g.cy(c); if (!w.ad.clear(x, y, 12, 'walk') && Math.hypot(x - p.x, y - p.y) < 1500) { wx = x; wy = y; break; } }
    const h = w.hound(wx, wy); h.state = 'SEARCHING'; h.search = { rid: 0, started: 0, goal: { x: wx + 600, y: wy }, phase: 'go', legs: 0, visited: [], why: 'sound', until: 1e9, pause: 0, first: false };
    w.run(20, null);
    return { ok: !!wx && w.ad.clear(h.x, h.y, 12, 'walk') && (h.unstuck | 0) >= 1, clear: w.ad.clear(h.x, h.y, 12, 'walk'), unstuck: h.unstuck | 0, found: !!wx };
  });
  // and the general case: over a long roaming run no hound goes motionless (other than deliberately resting / listening / feeding)
  let worst = 0; for (let s = 1; s <= 6; s++) {
    const w = World(60 + s), p = w.player(1300, 3300, {}); p.stop('stand'); const hs = [w.hound(2200, 3300), w.hound(3000, 3600), w.hound(2600, 2600)]; const still = hs.map(() => 0);
    w.run(180, () => { hs.forEach((h, i) => { if (h.speed < 4 && !['listen', 'rest', 'feed', 'freeze', 'sniff', 'stare'].includes(h.act) && !['ALERT', 'CURIOUS', 'CAUTIOUS', 'EXCITED', 'FRUSTRATED', 'FEEDING', 'PLAYING', 'DORMANT'].includes(h.state)) still[i] += DT * 6; else still[i] = 0; worst = Math.max(worst, still[i]); }); }, 6);
  }
  return { ok: rate(rs) >= .8 && worst < 12, note: `${rs.filter(r => r.ok).length}/${rs.length} embedded hounds recovered onto open floor; longest motionless spell of an unoccupied roaming hound over 18 hound-minutes: ${worst.toFixed(1)}s` };
});
add('Y05 turning and snapping: headings change smoothly (no per-tick flips), speeds change within acceleration limits', () => {
  const G = geo(); let hMax = 0, sMax = 0, hOver = 0, sOver = 0, ticks = 0, aMax = 0, accOver = 0;
  for (let i = 1; i <= 10; i++) {
    const pr = pick(G.dark, 3000, 3300, 0, 2600, i) || G.dark[i], w = World(70 + i), p = w.player(pr.x, pr.y, { light: i % 2 === 0 }); p.route([{ x: p.x + 250, y: p.y }, { x: p.x - 250, y: p.y + 80 }, { x: p.x + 100, y: p.y - 200 }], i % 3 === 0 ? 'run' : 'walk');
    const h = w.hound(pr.x - 500, pr.y), sm = w.smiler(G.dark[(i * 17) % G.dark.length].x, G.dark[(i * 17) % G.dark.length].y);
    let ha = h.ang, sa = sm.ang, hv = 0, sv = 0;
    w.run(120, () => {
      if (!p.path || !p.path.length) p.route([{ x: p.x + 250, y: p.y }, { x: p.x - 250, y: p.y + 80 }], 'walk');
      const dh = Math.abs(angD(h.ang, ha)), ds = Math.abs(angD(sm.ang, sa)); ha = h.ang; sa = sm.ang; ticks++;
      if (!h.trav && h.tier !== 'far') { hMax = Math.max(hMax, dh); if (dh > .2) hOver++; } if (!sm.trav && sm.tier !== 'far') { sMax = Math.max(sMax, ds); if (ds > .2) sOver++; }
      const ah = Math.abs(h.speed - hv) / DT; hv = h.speed; if (h.act !== 'lunge' && !h.cap && !h.commit && ah > aMax && h.tier !== 'far') aMax = ah; if (h.act !== 'lunge' && !h.cap && !h.commit && ah > 4500 && h.tier !== 'far') accOver++;   // (the take-off of a lunge is a deliberate burst, not a glitch)
      sv = sm.speed;
    }, 1);
  }
  return { ok: hMax < .3 && sMax < .3 && hOver / ticks < .0015 && sOver / ticks < .0015 && accOver === 0, note: `over ${ticks} ticks: biggest heading step per 1/60 s hound ${hMax.toFixed(2)} rad (${((hMax * 60) | 0)} rad/s), smiler ${sMax.toFixed(2)}; ticks above 0.2 rad: hound ${hOver}, smiler ${sOver}; biggest hound acceleration ${aMax | 0} px/s²` };
});
add('Y06 no wall clipping: over long emergent runs no entity ever stands inside solid geometry (vaults excepted)', () => {
  const G = geo(); let bad = 0, samples = 0, worst = null;
  for (let i = 1; i <= 8; i++) {
    const pr = pick(G.dark, 3000, 3300, 0, 3000, i) || G.dark[i], w = World(90 + i), pp = floorNear(w, pr.x, pr.y), p = w.player(pp.x, pp.y, { light: i % 2 === 0 });
    p.route([{ x: p.x + 300, y: p.y }, { x: p.x - 300, y: p.y + 100 }, { x: p.x + 100, y: p.y - 250 }], i % 2 ? 'run' : 'walk');
    const a = floorNear(w, pp.x - 500, pp.y), b = floorNear(w, pp.x + 700, pp.y + 300), s0 = G.dark[(i * 23) % G.dark.length];
    const hs = [w.hound(a.x, a.y), w.hound(b.x, b.y)], sm = w.smiler(s0.x, s0.y);
    w.run(150, () => {
      if (!p.path || !p.path.length) p.route([{ x: p.x + 300, y: p.y }, { x: p.x - 300, y: p.y + 100 }], 'walk'); if (p.caught && p.caught.phase === 'crawl') p.go(p.x + 30, p.y, 'crawl');
      for (const e of [...hs, sm]) { if (e.tier === 'far' || e.trav) continue; samples++; if (!w.ad.clear(e.x, e.y, 9, e.mode === 'under' || e.mode === 'crawl' ? 'crawl' : 'walk')) { bad++; if (!worst) worst = { kind: e.kind, s: e.state, x: e.x | 0, y: e.y | 0, t: +w.t.toFixed(1) }; } }
    }, 2);
  }
  return { ok: bad === 0 && samples > 20000, note: `${samples} samples of entity positions (every 2nd tick, 8 seeds x 150 s, 2 hounds + a smiler each), ${bad} inside solid geometry${worst ? ' first: ' + JSON.stringify(worst) : ''}` };
});
add('Y07 pop-in: a smiler only appears or vanishes by fading (its visibility changes at a bounded rate); entities are only ever spawned out of sight', () => {
  const G = geo(), H = require('./s_smiler.js').helpers; let maxUp = 0, maxDn = 0, ticks = 0, cycles = 0, seen = 0;
  /* (a) (v23.1, canon Smiler) a smiler that comes out to watch somebody, is held by their eyes, and is let go as they back away - or lit up by a
   *     torch: its face must fade in and fade out, never blink */
  for (let i = 1; i <= 10; i++) {
    const A = H.setup(i, { light: false, face: true, lo: 350, hi: 600, room: true }); if (!A) continue; const { w, p, s } = A; let backing = false;
    let f = s.face, lastState = s.state;
    w.run(30, (ww, t) => {
      if (!backing && t > 4 && /hold|creep|drift/.test(s.act)) { backing = true; const a = Math.atan2(p.y - s.y, p.x - s.x); p.pathTo(p.x + Math.cos(a) * 900, p.y + Math.sin(a) * 900, 'crouch') || p.go(p.x + Math.cos(a) * 900, p.y + Math.sin(a) * 900, 'crouch'); }
      if (i % 3 === 0 && t > 14) p.light = Math.floor(t * 2) % 5 < 2;                // a torch flicked on and off at it
      const d = (s.face - f) / DT; if (d > maxUp) maxUp = d; if (-d > maxDn) maxDn = -d; if (s.face > .5) seen++; if (s.state === 'DISAPPEARING' && lastState !== 'DISAPPEARING') cycles++; lastState = s.state; f = s.face; ticks++;
      if (p.dead) return false;
    }, 1);
  }
  /* (b) spawn distances of the director (raw sim, several players): every new entity is at least 1500 px from every living player, and there are enough of them to say so */
  let minSpawn = 1e9, spawns = 0;
  for (let sd = 5; sd < 9; sd++) {
    const sim = createSim({ seed: sd }); const ps = []; for (let i = 0; i < 3; i++) { const p = sim.addPlayer(500 + i); sim.join(p); p.safe = 0; ps.push(p); }
    const eng = sim.engine; const known = new Set(eng.entities.map(e => e.id));
    for (let i = 0; i < 60 * 1200; i++) { sim.step(1 / 60); for (const e of eng.entities) if (!known.has(e.id)) { known.add(e.id); spawns++; for (const p of ps) minSpawn = Math.min(minSpawn, Math.hypot(e.x - p.x, e.y - p.y)); } }
  }
  return { ok: maxUp <= .85 && maxDn <= 1.45 && ticks > 3000 && cycles >= 4 && minSpawn >= 1500, note: `${ticks} ticks of watching / being held / let go / lit: fastest fade-in ${maxUp.toFixed(2)}/s (limit .8/s ≈ 1.25 s), fastest fade-out ${maxDn.toFixed(2)}/s (limit 1.4/s ≈ 0.7 s), ${cycles} fade-outs observed; ${spawns} director spawns over 4 x 20 min, nearest to a living player ${minSpawn === 1e9 ? 'n/a' : minSpawn | 0}px` };
});
add('Y08 determinism: the same seed and the same inputs give the same world (no stray randomness, safe for tests and replays)', () => {
  const run = () => { const G = geo(), w = World(1234), p = w.player(5000, LONG.y, {}); p.route([{ x: 5600, y: LONG.y }, { x: 6100, y: LONG.y }], 'run'); const h = w.hound(4300, LONG.y), sm = w.smiler(G.dark[5].x, G.dark[5].y); w.run(60, null); return [h.x, h.y, h.ang, h.state, sm.x, sm.y, sm.state, p.x, p.y, p.caught ? 1 : 0, w.kills.length].join('|'); };
  const a = run(), b = run();
  return { ok: a === b, note: a === b ? 'two identical runs ended in exactly the same state: ' + a.slice(0, 80) : `DIVERGED:\n  ${a}\n  ${b}` };
});
add('Y09 population caps and bodies over a long session: at most 3 hounds and 5 smilers; one body per player, at most 24', () => {
  const sim = createSim({ seed: 9 }), eng = sim.engine, p = sim.addPlayer(700); sim.join(p); p.safe = 0; let maxH = 0, maxS = 0, deaths = 0, kills = 0, seq = 0;
  const origDrain = eng.drainEvents.bind(eng); eng.drainEvents = () => { const ev = origDrain(); for (const e of ev) if (e.t === 'kill') kills++; return ev; };
  for (let i = 0; i < 60 * 1500; i++) {
    sim.step(1 / 60); maxH = Math.max(maxH, eng.count('hound')); maxS = Math.max(maxS, eng.count('smiler'));
    if (p.dead) { deaths++; sim.setBody(700 + (deaths % 30), { k: deaths, x: p.x, y: p.y }); sim.respawn(p); p.safe = 0; }
  }
  return { ok: maxH <= 3 && maxS <= 5 && sim.bodies.size <= 24 && deaths === kills && p.dseq === deaths, note: `25 min of play with one wanderer: most hounds at once ${maxH}, most smilers ${maxS}, deaths ${deaths} = kill events ${kills} = dseq ${p.dseq}; bodies held ${sim.bodies.size} (cap 24)` };
});
add('Y10 bodies persist for the configured time: forever by default, or BODY_TTL seconds', () => {
  const t = ttl => { const sim = createSim({ seed: 3, bodyTtl: ttl }), p = sim.addPlayer(1); sim.join(p); p.god = true; p.safe = 0; sim.setBody(1, { k: 1, x: 1, y: 1 }); const v0 = sim.bodyVer; let gone = -1; for (let i = 0; i < 60 * 40; i++) { sim.step(1 / 60); if (gone < 0 && !sim.bodies.size) gone = i / 60; } return { gone, ver: sim.bodyVer !== v0, held: sim.bodies.size }; };
  const a = t(0), b = t(12);
  return { ok: a.held === 1 && a.gone < 0 && b.held === 0 && b.gone >= 12 && b.gone < 14.5 && b.ver, note: `default: body still there after 40 s; BODY_TTL=12: removed at ${b.gone.toFixed(1)}s and clients told (bodyVer bumped: ${b.ver})` };
});
module.exports = S;
