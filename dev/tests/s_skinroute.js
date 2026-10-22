/* SKIN-STEALER R12-R13 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved): its inference of a quarry's way and its routes (the
 * pack's C16-C27; R12 adds the ways it holds - hypotheses - and its reasons, C20-C23 and R12-A..C).  Each runs the real server
 * simulation over several seeds; nothing sets a decision of the creature.  Where a check reads where a PERSON really is, that is the
 * test's own knowledge (the person's script) - the creature never reads it. */
'use strict';
const { World, DT, over, AI, bystander } = require('./lib.js');   // (R13 adds LONG and the QA sight oracle below)
const S = []; const add = (name, fn) => S.push({ name, fn });
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/* seen once walking north past wall C's gap, light off past y 5440, then one of these ways (s_skinpredator.js's sw) */
const WAYS = { east: [{ x: 1720, y: 4900 }], back: [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }],
  north: [{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], northEast: [{ x: 1250, y: 4870 }, { x: 2080, y: 4870 }] };
function sw(seed, h, way, mode, T, o = {}) {
  const w = World(seed + 3000); bystander(w, 8400, 900);
  const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  const R = { tr: [], parted: 1e9, guesses: [], hyps: [], heardChecks: [], firstHyp: null, rej: [], maxWays: 0 };
  let lastP = null, lastG = null;
  w.run(T, (ww, t) => {
    if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; R.parted = R.tr.length; p.route(WAYS[way], mode); }
    if (p.going === 2 && p.path && !p.path.length) { p.going = 3; p.stop('crouch'); }
    if (p.light && p.y < 5440) p.light = false;
    if (o.on) o.on(t, p, e, w, R);
    const H = e.hunt, P = e.plan, Y = H && H.hyp, seen = e.seenNow.has(p.id);
    if (Y) { R.maxWays = Math.max(R.maxWays, Y.list.length); if (!R.firstHyp) R.firstHyp = { t: +t.toFixed(2), ways: Y.list.map(h => ({ id: h.id, k: h.k, a: h.a, turn: h.turn, p: h.p, pts: h.pts.map(q => [Math.round(q.x), Math.round(q.y)]) })), key: Y.key };
      if (Y.heard && (!R.heardChecks.length || R.heardChecks[R.heardChecks.length - 1].t !== Y.heard.t)) R.heardChecks.push(Object.assign({ world: way }, Y.heard)); }
    if (e.dbg.guess && e.dbg.guess !== lastG) { lastG = e.dbg.guess; R.rej.push(...(e.dbg.guess.rej || []).map(x => x[2])); }
    R.tr.push([Math.round(e.x * 10), Math.round(e.y * 10), seen ? 1 : 0, e.mem.sounds.map(q => q.id + ':' + Math.round(q.x) + ':' + Math.round(q.y)).join(';'), P ? P.k : '-',
      Y ? Y.key + '#' + Y.list.map(h => h.id + h.k + h.p.toFixed(3)).join(',') + '#' + Y.bet : '-', e.dbg.guess ? JSON.stringify(e.dbg.guess) : '-'].join('|'));
    if (P && P !== lastP && (P.k === 'intercept' || P.k === 'search')) {
      const g = P.k === 'intercept' ? { x: P.g.qx, y: P.g.qy } : P.goal;
      R.guesses.push({ t: +t.toFixed(1), k: P.k, x: Math.round(g.x), y: Math.round(g.y), hyp: P.k === 'intercept' ? P.g.hyp || 0 : e.dbg.guess ? e.dbg.guess.hyp : 0, guess: e.dbg.guess ? e.dbg.guess.k : '',
        age: H ? +(w.eng.now - H.bt).toFixed(2) : 0 });                               // (the age of its newest evidence when it chose this)
      if (Y) R.hyps.push({ t: +t.toFixed(1), ways: Y.list.map(h => [h.id, h.k, +h.p.toFixed(2), h.f < 1 ? h.why : '']) });
    }
    lastP = P;
    return true;
  });
  return Object.assign(R, { e, p, w, end: e.dbg.huntEnd ? e.dbg.huntEnd.why : '', tally: e.tally });
}
/* the creature's own evidence and decisions, tick by tick, identical in two worlds until it senses a difference (the person's script is
 * not in it: its sounds, its sight of them, its place, plan, ways and guesses) */
function sameUntilSensed(A, B) {
  const n = Math.min(A.tr.length, B.tr.length);
  for (let i = 0; i < n; i++) { const a = A.tr[i].split('|'), b = B.tr[i].split('|'); if (a[2] !== b[2] || a[3] !== b[3]) return { sensed: i, diff: -1 }; if (a.join('|') !== b.join('|')) return { sensed: -1, diff: i }; }
  return { sensed: n, diff: -1 };
}
const REASONS = new Set(['evidence_stale', 'no_heading', 'late_to_intercept', 'no_likely_way', 'disproved', 'unlikely', 'no_floor', 'on_a_way', 'less_likely']);

add('C21 from the last-seen heading it infers the ways on (no omniscience): at the first fork it holds two to four ways with probabilities that sum to one; the likeliest keeps the heading best; every way is walkable floor; the ways are the same whichever way the person really went', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const A = sw(seed, .8, 'east', 'crouch', 8), B = sw(seed, .8, 'back', 'crouch', 8), Y = A.firstHyp, Z = B.firstHyp;
    if (!Y) return { has: false };
    const ways = Y.ways.filter(h => h.k !== 'stop'), sum = Y.ways.reduce((s, h) => s + h.p, 0), top = ways.slice().sort((a, b) => b.p - a.p)[0];
    const keeps = ways.every(h => h.turn >= top.turn - 1e-6), g = A.w.eng.geo;
    let bad = 0; for (const h of ways) for (let i = 1; i < h.pts.length; i++) if (!g.lineClear(h.pts[i - 1][0], h.pts[i - 1][1], h.pts[i][0], h.pts[i][1], 14, 'walk')) bad++;
    return { has: true, n: Y.ways.length, nw: ways.length, sum: +sum.toFixed(3), keeps, bad, same: !!Z && JSON.stringify(Y) === JSON.stringify(Z), top: top ? top.k + ' ' + top.turn : '-', ps: Y.ways.map(h => h.k[0] + h.p.toFixed(2)).join(' ') };
  });
  const h = rs.filter(r => r.has);
  return { ok: h.length >= 5 && h.every(r => r.n >= 2 && r.n <= 4 && r.nw >= 1 && Math.abs(r.sum - 1) < 1e-3 && r.keeps && r.bad === 0 && r.same),
    note: `${h.length}/6 held ways at the first guess: ${h.map(r => `[${r.ps}]`).join(' ')}; likeliest keeps the heading ${h.filter(r => r.keeps).length}/${h.length}; segments through walls ${h.map(r => r.bad).join('/')}; the same in both worlds ${h.filter(r => r.same).length}/${h.length}` };
});
add('C20 a wrong branch is a missed ambush and a bounded new search: the person silently takes a way it did not bet on - its guess there fails, that way is disproved (kept with the reason, not erased), its next guess goes to another way or to where it believes them, it never tries the same place twice, and the hunt ends within its number of guesses', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], seed => {
    const R = sw(seed, .8, 'back', 'crouch', 60), G = R.guesses;
    const disproved = R.hyps.some(q => q.ways.some(w => w[3]));
    const repeat = G.some((q, i) => G.slice(0, i).some(f => Math.hypot(f.x - q.x, f.y - q.y) < 150));
    const switched = G.length < 2 || G.slice(1).some(q => q.hyp !== G[0].hyp);
    return { n: G.length, disproved, repeat, switched, tries: Math.max(0, ...(R.e.hunt ? [R.e.hunt.tries] : [0])), end: R.end, kills: R.w.kills.length, tally: R.tally };
  });
  const missed = rs.filter(r => r.n >= 1 && !r.kills);
  return { ok: missed.length >= 6 && missed.every(r => !r.repeat && r.switched && /gives up|cold|nowhere/.test(r.end)) && missed.filter(r => r.disproved).length >= Math.ceil(missed.length * .6),
    note: `${missed.length}/12 missed them (they doubled back unheard): guesses ${missed.map(r => r.n).join('/')}; a way disproved ${missed.filter(r => r.disproved).length}/${missed.length}; another way or its belief next ${missed.filter(r => r.switched).length}/${missed.length}; a place twice ${missed.filter(r => r.repeat).length}; ended: ${[...new Set(missed.map(r => r.end.replace(/P\d+/g, 'P').replace(/\d+/g, 'n')))].join(' | ')}` };
});
add('C22 a valid new footstep changes its hypotheses: the person runs on one side of the fork (east, or north-west; it hears them), the sound re-weighs every way it holds (the ways that explain it gain; those far worse than the best are rejected), and its next guess goes to the side it heard (or to the very place it heard them); the same moves made silently reject nothing', () => {
  const rs = [];
  for (const way of ['east', 'north']) rs.push(...over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seed => {
    const L = sw(seed + 60, .8, way, 'run', 20), Q = sw(seed + 60, .8, way, 'crouch', 20);
    const rej = L.heardChecks.filter(c => c.fit < c.of || c.shift >= .15), after = rej.length ? L.guesses.find(g => g.t >= rej[0].t - 60 - .05) : null;
    // (on the side it heard: past the fork that way, or at the very place it heard them - a look where the sound was is the sound's answer)
    const side = after ? (way === 'east' ? after.x > 1350 : after.x < 1250) || rej.some(c => Math.hypot(after.x - c.x, after.y - c.y) < 250) : null;
    return { way, heard: L.tally.heardQ, checks: L.heardChecks.length, rejected: rej.length > 0, side, kills: L.w.kills.length, qChecks: Q.heardChecks.length, fits: L.heardChecks.map(c => c.fit + '/' + c.of + '+' + c.shift).join(',') || '-' };
  }));
  const h = rs.filter(r => r.checks > 0), rj = h.filter(r => r.rejected), guessed = rj.filter(r => r.side !== null);
  return { ok: h.length >= 8 && rj.length >= Math.ceil(h.length * .6) && guessed.length >= 3 && guessed.filter(r => r.side).length >= Math.ceil(guessed.length * .75) && rs.every(r => r.qChecks === 0),
    note: `running: sounds taken for theirs ${rs.map(r => r.way[0] + r.heard).join(' ')}; checked against its ways in ${h.length}/20 (fit/held+gain ${h.map(r => r.fits).join(' ')}); re-weighed (a way rejected, or one gaining .15 or more) ${rj.length}/${h.length}; the next guess on the side it heard ${guessed.filter(r => r.side).length}/${guessed.length} (the rest caught them first or guessed nothing) | silently: ways checked against a sound ${rs.map(r => r.qChecks).join('/')}` };
});
add('C23 no new evidence, no new guess: the person silently takes one way or another (and in both worlds another person, never seen, runs the same lane) - its ways, its bets, its rejected rivals and its every decision are identical until it senses a difference', () => {
  const B2 = (t, p, e, w, R) => { if (!R.B && t > 4) { R.B = w.player(1700, 4880, { light: false, angle: 0 }); R.B.lane = [{ x: 2150, y: 4880 }, { x: 1700, y: 4880 }]; }
    if (R.B && (!R.B.path || !R.B.path.length)) { R.B.route(R.B.lane.slice(), 'run'); R.B.lane.reverse(); } };
  const rs = over([1, 2, 3, 4], seed => {
    const res = [];
    for (const o of [{}, { on: B2 }]) { const A = sw(seed + 40, .8, 'north', 'crouch', 18, o), B = sw(seed + 40, .8, 'northEast', 'crouch', 18, o), q = sameUntilSensed(A, B);
      res.push({ ...q, parted: Math.min(A.parted, B.parted), hyps: A.tr.filter(x => x.split('|')[5] !== '-').length }); }
    return res;
  });
  const all = rs.flat();
  return { ok: all.every(r => r.diff < 0 && r.sensed > r.parted + 60) && all.filter(r => r.hyps > 0).length >= 6,
    note: all.map((r, i) => `${i % 2 ? 'with B' : 'alone'}: identical ${r.sensed} ticks (parted at ${r.parted}; first difference ${r.diff}; ticks with ways ${r.hyps})`).join(' | ') };
});
add('R12-A its rivals and its reasons: every guess records the rival guesses it rejected and why, in a fixed vocabulary (stale evidence, too late to get ahead, disproved, unlikely, less likely ...); once its evidence is older than its freshness an interception is never chosen', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const R = sw(seed, .85, ['east', 'back', 'north', 'northEast'][seed % 4], seed % 2 ? 'crouch' : 'walk', 40);
    // an interception chosen on stale evidence: one begun while its newest evidence was older than its freshness (4 s, SKI.fresh)
    const staleIc = R.guesses.filter(q => q.k === 'intercept' && q.age > 4.05).length;
    return { reasons: R.rej, staleIc, guesses: R.guesses.length };
  });
  const all = rs.flatMap(r => r.reasons), unknown = all.filter(x => !REASONS.has(x)), kinds = [...new Set(all)];
  return { ok: all.length > 0 && !unknown.length && kinds.length >= 3 && rs.every(r => r.staleIc === 0),
    note: `${all.length} rejected rivals over ${rs.reduce((a, r) => a + r.guesses, 0)} guesses: ${kinds.map(k => k + ' ' + all.filter(x => x === k).length).join(', ')}${unknown.length ? '; UNKNOWN ' + unknown.join(',') : ''}` };
});
add('R12-B bounded inference: a person seen and lost, eight ways and paces, and four starving ones hunting eight people - never more than four ways held, the ways listed again at most a couple of times a second, and every interception it bets on checked with at most four real routes', () => {
  const lost = over([1, 2, 3, 4, 5, 6, 7, 8], i => { const R = sw(i + 70, .9, ['east', 'back', 'north', 'northEast'][i % 4], ['walk', 'crouch', 'run'][i % 3], 30);
    return { ways: R.maxWays, builds: R.tally.hypBuild || 0, paths: R.tally.pathQ || 0, preds: R.tally.predQ || 0, guesses: R.guesses.length }; });
  const w = World(4420), P = [], E = [];
  const pts = [{ x: 700, y: 5330 }, { x: 1300, y: 5900 }, { x: 1720, y: 4900 }, { x: 1900, y: 5560 }, { x: 600, y: 5900 }, { x: 1300, y: 5150 }, { x: 2600, y: 3504 }, { x: 4200, y: 3504 }];
  for (let i = 0; i < 8; i++) { const q = pts[i]; const p = w.player(q.x, q.y, { light: i % 2 === 0 }); p.stop('stand'); p.leg = i; P.push(p); }
  for (const [x, y] of [[1850, 5570], [900, 5000], [2400, 3504], [3800, 3504]]) { const e = w.eng.spawn('skinstealer', x, y, { hunger: .95 }); e.tier = 'near'; E.push(e); }
  let maxWays = 0;
  w.run(60, (ww, t) => {
    for (const p of P) if (!p.dead && ((!p.path || !p.path.length) && !p.tx)) { const q = pts[(p.leg++ * 5 + 3) % pts.length]; p.light = p.leg % 3 !== 0; p.pathTo(q.x, q.y, p.leg % 4 === 1 ? 'run' : p.leg % 5 === 2 ? 'crouch' : 'walk'); }
    for (const p of P) if (p.dead && !p.back) p.back = t; else if (p.dead && t - p.back > 5) { w.sim.respawn && w.sim.respawn(p); p.back = 0; }
    for (const e of E) if (e.hunt && e.hunt.hyp) maxWays = Math.max(maxWays, e.hunt.hyp.list.length);
    return true;
  });
  const sb = E.map(e => e.tally.hypBuild || 0), sp = E.map(e => e.tally.pathQ || 0), sq = E.map(e => e.tally.predQ || 0);
  const all = lost.concat(E.map((e, i) => ({ ways: maxWays, builds: sb[i], paths: sp[i], preds: sq[i] })));
  const rate = Math.max(...lost.map(r => r.builds / 30), ...sb.map(b => b / 60));
  return { ok: all.every(r => r.ways <= 4 && r.paths <= 4 * r.preds) && rate <= 2.5 && lost.some(r => r.builds > 0),
    note: `seen and lost: ways held at most ${lost.map(r => r.ways).join('/')}, listings ${lost.map(r => r.builds).join('/')} in 30 s, real routes ${lost.map(r => r.paths).join('/')} for ${lost.map(r => r.preds).join('/')} interceptions weighed | four starving: ways at most ${maxWays}, listings ${sb.join('/')} in 60 s, real routes ${sp.join('/')} for ${sq.join('/')}, kills ${w.kills.length} | most listings a second ${rate.toFixed(2)}` };
});

/* ---- R13: covert ways, the withdrawal, being caught on the way, interception's time, fair races, the body's legality ---- */
const { LONG } = require('./lib.js');
const { sees } = require('../trial-3-r9-overhaul/tools/qa_sight.js');
/* the watched hall: a lit person at px keeps facing the creature, placed at ex */
function watched(seed, h, px, ex, o = {}) {
  const w = World(seed); bystander(w, 1300, 3300);
  const p = w.player(px, LONG.y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', ex, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = ex > px ? Math.PI : 0;
  if (o.stam !== undefined) e.stam = o.stam;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  return { w, p, e };
}
const contactOk = (w, k, e) => Math.hypot(k.geo.ax - k.victim.x, k.geo.ay - k.victim.y) < e.r + 18 + 1 && w.eng.geo.lineClear(k.geo.ax, k.geo.ay, k.victim.x, k.victim.y, 3, 'walk');   // (s_skinstealer.js's)
const insideWall = (w, e) => !e.trav && !e.commit && !e.cap && !e.pounce && !w.eng.geo.clear(e.x, e.y, e.rc - 6, 'walk');

add('C16 a hidden spot reached only through their view is no covert way: watched in the lit hall where every way to every spot out of their sight crosses their view, it never begins a covert move - it records why (no way out of their view: no_cover / no_exit / route_exposed) and answers openly (the bait, coming on openly, a standoff); it is never in their view on a covert way', () => {
  const rs = [];
  for (const h of [.65, .75]) rs.push(...over([1, 2, 3, 4], seed => {
    const { w, p, e } = watched(seed + 9300, h, 3500, 3950); const why = new Set(), plans = new Set(); let covertSeen = 0, flank = 0;
    w.run(15, () => { if (e.dbg.cover) why.add(e.dbg.cover.why.replace(/[@:].*/, '').split('/')[0]); if (e.plan) plans.add(e.plan.k + (e.plan.mode ? '/' + e.plan.mode : ''));
      if (e.plan && e.plan.k === 'flank') flank++; if (e.plan && e.plan.mode === 'covert' && e.plan.phase !== 'exit' && sees(w, p, e.x, e.y).vis) covertSeen++; return true; });
    return { h, why: [...why], plans: [...plans], covertSeen, flank, kills: w.kills.length };
  }));
  const reasoned = rs.filter(r => r.why.some(k => ['no_cover', 'no_exit', 'route_exposed'].includes(k)));
  return { ok: rs.every(r => r.covertSeen === 0 && r.flank === 0) && reasoned.length >= 6,
    note: `${rs.length} runs: a covert flank begun ${rs.reduce((a, r) => a + r.flank, 0)} ticks; on a covert way in their view ${rs.reduce((a, r) => a + r.covertSeen, 0)} ticks; the reason recorded in ${reasoned.length} (${[...new Set(rs.flatMap(r => r.why))].join(', ')}); its answers ${[...new Set(rs.flatMap(r => r.plans))].join(', ')}; kills ${rs.map(r => r.kills).join('/')}` };
});
add('C17 a covered way, though longer, beats an exposed short cut: watched in the long hall (R9-01\'s scene), its flanks take the covert way round - out of their view after its withdrawal, far longer than the straight line R8 crossed their view on (R8 refused anything over 2.6 x their distance)', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, p, e } = watched(seed + 9100, .75, 5000, 5450); let way = null, seen = 0, d0 = 0;
    w.run(14, () => { const P = e.plan; if (!way && P && P.k === 'flank' && P.way) { way = P.way; d0 = Math.hypot(P.spot.x - e.x, P.spot.y - e.y); }
      if (P && P.k === 'flank' && P.mode === 'covert' && P.phase !== 'exit' && sees(w, p, e.x, e.y).vis) seen++; return true; });
    return { way: way ? way.len : 0, straight: Math.round(d0), ratio: way ? +(way.len / 450).toFixed(1) : 0, seen };
  });
  const fl = rs.filter(r => r.way);
  return { ok: fl.length >= 4 && fl.every(r => r.seen === 0 && r.way > r.straight * 1.5) && fl.some(r => r.ratio > 2.6),
    note: `${fl.length}/6 flanked: covert ways ${fl.map(r => r.way).join('/')} px for spots ${fl.map(r => r.straight).join('/')} px away in a straight line (x ${fl.map(r => r.ratio).join('/')} their distance); in their view after the withdrawal ${fl.map(r => r.seen).join('/')} ticks` };
});
add('C18 caught on its way: the watcher runs to where they can see its covert way - within a few thinks it knows (it saw them, or heard them from where they could see it), records SURPRISE COMPROMISED and either ducks back out of their view along a new covert way, comes on openly, or stands off; it never goes on as if unseen', () => {
  const rs = over([2, 4, 5, 6, 8, 11, 12, 13], seed => {
    const { w, p, e } = watched(seed + 9500, .75, 5000, 5450); let hidAt = -1, movedAt = -1, reactAt = -1, react = '', covExp = 0, lx = e.x, ly = e.y, c0 = 0;
    w.run(14, (ww, t) => {
      const P = e.plan;
      if (hidAt < 0 && P && P.k === 'flank' && P.phase === 'hidden') hidAt = t;
      if (hidAt >= 0 && movedAt < 0 && t > hidAt + .6) { movedAt = t; c0 = e.tally.compromised || 0; p.look = null; p.route([{ x: 5640, y: LONG.y }], 'run'); }
      if (movedAt >= 0) {
        if (e.plan && e.plan.mode === 'covert' && e.plan.phase !== 'exit' && sees(w, p, e.x, e.y).vis) covExp += Math.hypot(e.x - lx, e.y - ly);
        if (reactAt < 0 && (e.tally.compromised || 0) > c0) { reactAt = t; react = (e.dbg.why || '').replace(/P\d+/g, 'P'); }
      }
      lx = e.x; ly = e.y; return true;
    });
    return { flanked: hidAt >= 0, lag: reactAt >= 0 ? +(reactAt - movedAt).toFixed(2) : -1, react, covExp: Math.round(covExp) };
  });
  const tried = rs.filter(r => r.flanked);
  return { ok: tried.length >= 5 && tried.every(r => r.lag >= 0 && r.lag <= .6 && r.covExp <= 48),
    note: `${tried.length}/8 caught mid-way: it knew ${tried.map(r => r.lag).join('/')} s after they moved; on a covert way in their view afterwards ${tried.map(r => r.covExp).join('/')} px; it then: ${[...new Set(tried.map(r => r.react.replace(/^.*?: /, '')))].join(' | ')}` };
});
add('C19 out of their view first, then the run: watched in the lit hall, a covert move begins with a withdrawal straight away from them (never nearer, never across their front, at a walk), and only once out of their view does it run - never at a run where they could see it', () => {
  const rs = over([1, 2, 4, 5, 6, 8], seed => {
    const { w, p, e } = watched(seed + 9100, .75, 5000, 5450); const R = { exit: 0, closer: 0, fastExit: 0, runSeen: 0, ran: 0 }; let ld = 0;
    w.run(12, (ww, t) => {
      const P = e.plan, d = Math.hypot(e.x - p.x, e.y - p.y), v = sees(w, p, e.x, e.y).vis;
      if (P && P.k === 'flank' && P.mode === 'covert') {
        if (P.phase === 'exit') { R.exit++; if (d < ld - 1.5) R.closer++; if (e.speed > AI.SK.runFrom) R.fastExit++; }
        else if (e.speed > AI.SK.runFrom) { R.ran++; if (v) R.runSeen++; }
      }
      ld = d; return true;
    });
    return R;
  });
  const fl = rs.filter(r => r.exit > 0);
  return { ok: fl.length >= 4 && fl.every(r => r.closer === 0 && r.fastExit === 0 && r.runSeen === 0 && r.ran > 30),
    note: `${fl.length}/6 withdrew first (${fl.map(r => (r.exit / 60).toFixed(1)).join('/')} s; nearer them ${fl.map(r => r.closer).join('/')} ticks, faster than a walk ${fl.map(r => r.fastExit).join('/')}); then ran hidden ${fl.map(r => (r.ran / 60).toFixed(1)).join('/')} s - at a run in their view ${fl.map(r => r.runSeen).join('/')} ticks` };
});
add('C24 arriving first is reckoned on its real route and its legs: the same glimpse, rested or tired (under its tired mark its top speed is its tired run) - tired, it aims farther ahead along the way or cannot get ahead at all; every interception it makes, it expects to reach before them by its own route (slack >= 0)', () => {
  const first = (seed, stam) => { let g = null; sw(seed, .8, 'east', 'walk', 6, { on: (t, p, e) => { if (t < .1 && stam !== undefined) e.stam = stam; if (!g && e.plan && e.plan.k === 'intercept') g = { lead: e.plan.g.lead, slack: e.plan.g.slack }; if (!g && e.dbg.guess && /late_to_intercept/.test(JSON.stringify(e.dbg.guess.rej || []))) g = { lead: -1, slack: null }; } }); return g; };
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => ({ full: first(seed), tired: first(seed, 20) }));
  const both = rs.filter(r => r.full && r.tired), ok = both.filter(r => r.tired.lead < 0 || r.tired.lead >= r.full.lead - 1), diff = both.filter(r => r.tired.lead < 0 || r.tired.lead > r.full.lead);
  const slack = rs.flatMap(r => [r.full, r.tired]).filter(g => g && g.lead >= 0);
  return { ok: both.length >= 4 && ok.length === both.length && diff.length >= 1 && slack.every(g => g.slack >= 0),
    note: `${both.length}/8 weighed an interception both ways: rested lead ${both.map(r => r.full.lead).join('/')} px, tired ${both.map(r => r.tired.lead < 0 ? 'none (too late)' : r.tired.lead).join('/')} px; slack of every interception ${slack.map(g => g.slack).join('/')} s` };
});
add('C25 an interception it cannot win is not made: whenever its own route cannot beat them there (late_to_intercept) or its evidence is too old, it does something else - it never goes to an interception it has reckoned lost', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], seed => {
    const R = { late: 0, after: [] }; let G = null;
    sw(seed + 20, .85, ['east', 'back', 'north', 'northEast'][seed % 4], seed % 2 ? 'run' : 'walk', 30, { on: (t, p, e) => {
      if (e.dbg.guess && e.dbg.guess !== G) { G = e.dbg.guess; const late = (G.rej || []).some(x => x[0] === 'intercept' && (x[2] === 'late_to_intercept' || x[2] === 'evidence_stale'));
        if (late) { R.late++; R.after.push(G.k); } } } });
    return R;
  });
  const all = rs.flatMap(r => r.after);
  return { ok: all.length >= 4 && all.every(k => k !== 'intercept'), note: `${all.length} decisions with the interception refused as too late or too old; each went instead to: ${[...new Set(all)].join(', ')}` };
});
add('C26 the fair race stands: a fresh runner on the open hall outruns it, rested and starving alike - it never gains on them while they run, never runs over its run speed, never takes them while they run', () => {
  const rs = [];
  for (const h of [.75, .95]) rs.push(...over([1, 2, 3, 4], seed => {
    const w = World(seed + 9700), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    p.go(8700, y, 'run'); let dmin = 1e9, vmax = 0, killedRunning = 0;
    w.run(12, (ww, t) => { if (p.tx !== null && t > .6) dmin = Math.min(dmin, Math.hypot(p.x - e.x, p.y - e.y)); if (!e.pounce && !e.trav) vmax = Math.max(vmax, e.speed); if (w.kills.length && p.tx !== null) killedRunning = 1; return true; });
    return { h, dmin: Math.round(dmin), vmax: Math.round(vmax), killedRunning, end: Math.round(Math.hypot(p.x - e.x, p.y - e.y)) };
  }));
  return { ok: rs.every(r => r.dmin >= 250 && r.vmax <= 256 && r.killedRunning === 0 && r.end > 600),
    note: rs.map(r => `h ${r.h}: never nearer than ${r.dmin} px, its top ${r.vmax} px/s, ${r.end} px apart at the end`).join(' | ') };
});
add('C27 lawful bodies: through the covert, open and rushed moves of these scenes it is never inside a wall, every spring shows its whole wind-up, and every kill is body to body with nothing solid between', () => {
  const R = { ticks: 0, inWall: 0, springs: 0, shortWind: 0, kills: 0, badKill: 0 };
  const watch = (w, e) => { let S = null; return () => { R.ticks++; if (insideWall(w, e)) R.inWall++;
    if (e.pounce && e.pounce !== S) { S = e.pounce; R.springs++; S.__w = 0; } if (S && e.pounce === S && S.t < S.wind) S.__w = S.t; if (S && e.pounce !== S) { if (S.__w < S.wind - 1 / 30) R.shortWind++; S = null; } return true; }; };
  for (const seed of [1, 2, 3, 4]) {
    for (const [px, ex, h] of [[5000, 5450, .75], [3500, 3950, .75], [5000, 5450, .9]]) { const { w, e } = watched(seed + 9900, h, px, ex); w.run(20, watch(w, e));
      for (const k of w.kills.filter(q => q.kind === 'SkinStealer')) { R.kills++; if (!contactOk(w, k, e)) R.badKill++; } }
    const G = sw(seed + 40, .9, 'east', 'walk', 20, { on: (() => { let f = null; return (t, p, e, w) => { if (!f) f = watch(w, e); f(); }; })() }); void G;
  }
  return { ok: R.inWall === 0 && R.shortWind === 0 && R.badKill === 0 && R.springs > 0, note: `${R.ticks} ticks: inside a wall ${R.inWall}; springs ${R.springs}, any without its whole wind-up ${R.shortWind}; kills ${R.kills}, any through something solid ${R.badKill}` };
});
add('R13-A bounded cover: in these scenes and four starving ones among eight people, its covert-way searches stay few - at most a handful a second per creature, never a search on every think', () => {
  const per = [];
  for (const seed of [1, 2, 3]) { const { w, e } = watched(seed + 9100, .75, 5000, 5450); let last = 0, lt = 0; w.run(20, (ww, t) => { if (t - lt >= 1) { per.push((e.tally.coverQ || 0) - last); last = e.tally.coverQ || 0; lt = t; } return true; }); }
  const w = World(4421), P = [], E = [];
  const pts = [{ x: 700, y: 5330 }, { x: 1300, y: 5900 }, { x: 1720, y: 4900 }, { x: 1900, y: 5560 }, { x: 600, y: 5900 }, { x: 1300, y: 5150 }, { x: 2600, y: 3504 }, { x: 4200, y: 3504 }];
  for (let i = 0; i < 8; i++) { const q = pts[i]; const p = w.player(q.x, q.y, { light: i % 2 === 0 }); p.stop('stand'); p.leg = i; P.push(p); }
  for (const [x, y] of [[1850, 5570], [900, 5000], [2400, 3504], [3800, 3504]]) { const e = w.eng.spawn('skinstealer', x, y, { hunger: .95 }); e.tier = 'near'; E.push(e); }
  let lt = 0, last = E.map(() => 0);
  w.run(60, (ww, t) => {
    for (const p of P) if (!p.dead && ((!p.path || !p.path.length) && !p.tx)) { const q = pts[(p.leg++ * 5 + 3) % pts.length]; p.light = p.leg % 3 !== 0; p.pathTo(q.x, q.y, p.leg % 4 === 1 ? 'run' : p.leg % 5 === 2 ? 'crouch' : 'walk'); }
    for (const p of P) if (p.dead && !p.back) p.back = t; else if (p.dead && t - p.back > 5) { w.sim.respawn && w.sim.respawn(p); p.back = 0; }
    if (t - lt >= 1) { E.forEach((e, i) => { per.push((e.tally.coverQ || 0) - last[i]); last[i] = e.tally.coverQ || 0; }); lt = t; }
    return true;
  });
  const mx = Math.max(...per), mean = per.reduce((a, b) => a + b, 0) / per.length;
  return { ok: mx <= 8 && mean <= 1, note: `covert-way searches per creature-second: mean ${mean.toFixed(2)}, most ${mx} (${per.length} creature-seconds); four starving: ${E.map(e => e.tally.coverQ || 0).join('/')} in 60 s, kills ${w.kills.length}` };
});

S.helpers = { sw, sameUntilSensed, watched };
module.exports = S;
