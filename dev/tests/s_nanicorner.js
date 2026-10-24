/* SHARED N.A.N.I. CORNERING (Trial 3 R19, the N track; dev/trial-3-nani-corners/; Trial 3 is not owner-approved).  The owner (October 23,
 * after a four-person R18 session) asked for corners rounded more naturally by the shared locomotion, each species keeping its own way of
 * moving.  The N track changes one thing (r19n_patch.js): follow() drops a waypoint the body has passed on the inside of a bend when its aim
 * would swing back for it, where R8-R18 turned the body back for it (the stop-pivot-go of a Hound at a bend).  These checks run this tree's
 * own plan() and follow() and, on the same routes, the same built ai.js with that hunk taken back out (exactly R18's follower) - before and
 * after in one run, seeded, headless.
 *   NC01 (N01, N03, N04, N10) the stop at a bend: at each species' fast pace, no more slow, pivoting or aim-flicking time than R18, the
 *        Hound's stop-pivot-go eased where R18 had it, no route slower; the Hound still runs widest of the three and turns no faster than
 *        its own rate (no species made alike)
 *   NC02 (N02, N05, N06) collision: every tick of every run, at every pace, from rest and from speed - no body inside anything solid, no more
 *        wall contacts, hard bonks or stuck recoveries than R18
 *   NC03 (N07) traversal: routes through vault links and crawl or tight-gap cells - the same traversals and modes as R18, and no link, crawl
 *        or tight-gap waypoint ever dropped (by construction the hunk does not fire next to one: this holds that it stays so)
 *   NC04 (N08, N09, N15, N17) the real engine for 120 s: two Hounds, a Smiler and a Skin-Stealer among four players walking, running and
 *        going far away and back (near, mid and far tiers); then (the independent review: the hunk never fired there) Hounds sent after
 *        runners by the admin's navigation command, where it does - no body inside anything, no position jump faster than its top speed
 *        outside a vault, a strike or a tier change, every number finite, routes bounded, the hunk fired
 * The Wanderer (N18) is WL01-WL06's; the Smiler's reactive logic and the Hound's code are WL05's and PR25's (byte for byte but for the
 * N hunks); the Skin-Stealer's covert way (skCovertFollow) and its footwork (skStrafe) do not use follow() and are its own suites'. */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const { World, DT } = require('./lib.js'), RN = require('./r19n_patch.js');
const ROOT = path.join(__dirname, '..', '..'), AIFILE = path.join(ROOT, 'generated', 'server', 'ai.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* the built ai.js with plan/follow/navOf exposed: as built (now) and with exactly the N hunks taken out (r18) */
let PAIR = null;
function pair() {
  if (PAIR) return PAIR;
  const src = fs.readFileSync(AIFILE, 'utf8'), ret = 'return { create, S, SNAMES,', without = RN.remove(src);
  if (src.split(ret).length !== 2) throw new Error('ai.js: its return is not where this check expects it');
  if (without === null) throw new Error('the N hunks are not in the built ai.js exactly once');
  const load = (text, tag) => { const m = new Module(AIFILE + '#' + tag, module); m.filename = AIFILE; m.paths = Module._nodeModulePaths(path.dirname(AIFILE)); m._compile(text.replace(ret, 'return { plan, follow, navOf, create, S, SNAMES,'), AIFILE); return m.exports; };
  return (PAIR = { now: load(src, 'n19'), r18: load(without, 'r18') });
}
const PACES = { hound: [['roam', 92], ['chase', 292]], smiler: [['roam', 80], ['approach', 92], ['chase', 255]], skinstealer: [['walk', 160], ['prowl', 205], ['run', 270]] };
const FAST = { hound: 292, smiler: 255, skinstealer: 270 };

/* seeded routes on Level 0's open floor, 500-1500 px apart, a bend of 45 deg or more; links: false (none), true (at least one vault
 * link or crawl/tight-gap waypoint in the given kind's own route) */
function routes(w, n, seed, links, kind) {
  const eng = w.eng, geo = eng.geo, R = rng(seed), out = [], I = pair().now, probe = eng.spawn(kind, 0, 0, kind === 'skinstealer' ? { hunger: .1 } : {}); eng.entities.splice(eng.entities.indexOf(probe), 1);
  for (let tries = 0; out.length < n && tries < 40000; tries++) {
    const ax = 120 + R() * (geo.W - 240), ay = 120 + R() * (geo.H - 240), bx = 120 + R() * (geo.W - 240), by = 120 + R() * (geo.H - 240), d = Math.hypot(bx - ax, by - ay);
    if (d < 500 || d > 1500 || !w.ad.clear(ax, ay, 28, 'walk') || !w.ad.clear(bx, by, 28, 'walk')) continue;
    probe.x = ax; probe.y = ay; probe.path = [];
    if (!I.plan(eng, probe, bx, by)) continue;
    const odd = probe.path.some(q => q.link || (q.c | 0) > 1); if (odd !== links) continue;
    const P = [{ x: ax, y: ay }, ...probe.path]; let len = 0, bend = 0;
    for (let k = 1; k < P.length; k++) { len += Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y); if (k < P.length - 1) bend = Math.max(bend, Math.abs(angDiff(Math.atan2(P[k + 1].y - P[k].y, P[k + 1].x - P[k].x), Math.atan2(P[k].y - P[k - 1].y, P[k].x - P[k - 1].x)))); }
    if ((!links && bend < Math.PI / 4) || len > 2600) continue;
    out.push({ ax, ay, bx, by, len });
  }
  return out;
}
/* the least distance between its collider and anything solid of the mode it moves in (negative: inside it) */
function clearance(geo, e) {
  const mode = e.trav ? 'walk' : (e.mode || 'walk'); let m = 1e9;
  for (const t of geo.blockers(e.x, e.y, mode)) { const nx = Math.max(t.x, Math.min(e.x, t.x + t.w)), ny = Math.max(t.y, Math.min(e.y, t.y + t.h)); m = Math.min(m, Math.hypot(e.x - nx, e.y - ny)); }
  return m === 1e9 ? 99 : m - e.rc;
}
/* one route walked by one follower (I: now or r18) at pace v, from rest or from speed: the server's 60 Hz, nothing else of the AI */
function walk(w, I, kind, R, v, moving) {
  const eng = w.eng, geo = eng.geo, e = eng.spawn(kind, R.ax, R.ay, kind === 'skinstealer' ? { hunger: .1 } : {}); eng.entities.splice(eng.entities.indexOf(e), 1);
  e.tier = 'near'; e.path = []; I.plan(eng, e, R.bx, R.by);
  if (!e.path.length) return null;
  const poly = [{ x: R.ax, y: R.ay }, ...e.path.map(q => ({ x: q.x, y: q.y }))];
  const off = (x, y) => { let m = 1e9; for (let i = 1; i < poly.length; i++) { const a = poly[i - 1], b = poly[i], lx = b.x - a.x, ly = b.y - a.y, L2 = lx * lx + ly * ly || 1, t = Math.max(0, Math.min(1, ((x - a.x) * lx + (y - a.y) * ly) / L2)); m = Math.min(m, Math.hypot(x - a.x - lx * t, y - a.y - ly * t)); } return m; };
  e.ang = Math.atan2(e.path[0].y - e.y, e.path[0].x - e.x); e.speed = moving ? v : 0;
  const n0 = Object.assign({}, I.navOf(e)), M = { t: 0, slow: 0, pivots: 0, jumps: 0, inside: 0, minClear: 99, maxTurn: 0, wide: 0, arrived: false, trav: 0, modes: '', droppedOdd: 0 };
  let pw = null, pang = e.ang, wasTrav = false, lastMode = '';
  const t0 = eng.now;
  for (let k = 0; k < 25 * 60; k++) {
    eng.now += DT; geo.now = eng.now;
    const before = e.path.slice(0, 2), nb = I.navOf(e).passed || 0;
    const st = I.follow(eng, e, DT, v, {});
    if ((I.navOf(e).passed || 0) > nb && before.some(q => q.link || (q.c | 0) > 1)) M.droppedOdd++;   // (the block may only drop a plain waypoint before a plain one)
    M.t += DT; const turn = angDiff(e.ang, pang) / DT; pang = e.ang;
    if (!e.trav) M.maxTurn = Math.max(M.maxTurn, Math.abs(turn));
    if (e.trav && !wasTrav) M.trav++; wasTrav = !!e.trav;
    if (e.mode !== lastMode) { M.modes += (M.modes ? '>' : '') + e.mode; lastMode = e.mode; }
    const toEnd = Math.hypot(R.bx - e.x, R.by - e.y), mid = M.t > (moving ? .2 : 1.2) && toEnd > 80;
    if (mid && e.speed < v * .5) M.slow += DT;
    if (mid && e.speed < v / 3 && Math.abs(turn) > 1.2) M.pivots += DT;
    if (e.want !== undefined && pw !== null && Math.abs(angDiff(e.want, pw)) > .6) M.jumps++;
    if (e.want !== undefined) pw = e.want;
    const c = clearance(geo, e); M.minClear = Math.min(M.minClear, c); if (c < -.01) M.inside++;
    if (!e.trav) M.wide = Math.max(M.wide, off(e.x, e.y));
    if (st === 'arrived' || (toEnd < 20 && e.speed < 5)) { M.arrived = true; break; }
  }
  const n = I.navOf(e);
  Object.assign(M, { passed: (n.passed || 0) - (n0.passed || 0), contacts: n.contacts - (n0.contacts || 0), bonks: n.bonks - (n0.bonks || 0), stuck: n.stuckN - (n0.stuckN || 0), recover: n.recover - (n0.recover || 0) });
  eng.now = t0;
  return M;
}
const sum = (rs, k) => rs.reduce((a, r) => a + r[k], 0);
let RUNS = null;
/* the open-floor routes, every species, every pace, from rest and from speed, by both followers (shared by NC01 and NC02) */
function runs() {
  if (RUNS) return RUNS;
  const w = World(7), { now, r18 } = pair(), RS = routes(w, 30, 7, false, 'skinstealer'), out = [];
  for (const [kind, ps] of Object.entries(PACES)) for (const [pace, v] of ps) for (const moving of [false, true]) for (const [i, R] of RS.entries()) {
    const a = walk(w, r18, kind, R, v, moving), b = walk(w, now, kind, R, v, moving);
    if (a && b) out.push({ kind, pace, v, moving, route: i + 1, a, b });
  }
  return (RUNS = { routes: RS.length, out });
}

add('NC01 the stop at a bend (N01, N03, N04, N10): at each species\' fast pace no more slow, pivoting or aim-flicking time than R18\'s follower on the same routes, the Hound\'s stop-pivot-go eased where R18 had it, no route slower; the Hound still runs widest and no species turns faster than its own rate', () => {
  const { routes: nR, out } = runs(), bad = [], note = [];
  const caps = { hound: 3.4, smiler: 3.1, skinstealer: 3.6 };
  for (const kind of Object.keys(PACES)) {
    const rs = out.filter(r => r.kind === kind && r.v === FAST[kind]), A = rs.map(r => r.a), B = rs.map(r => r.b);
    const s = k => [+sum(A, k).toFixed(2), +sum(B, k).toFixed(2)];
    const slow = s('slow'), piv = s('pivots'), jumps = s('jumps'), t = s('t'), passed = sum(B, 'passed');
    const slower = rs.filter(r => r.b.t > r.a.t + 2 * DT).length, fixed = rs.filter(r => r.a.pivots > .05 && r.b.pivots < r.a.pivots).length, had = rs.filter(r => r.a.pivots > .05).length;
    if (slow[1] > slow[0] || piv[1] > piv[0] || jumps[1] > jumps[0] || t[1] > t[0]) bad.push(`${kind}: slow ${slow.join('>')} pivots ${piv.join('>')} aim jumps ${jumps.join('>')} time ${t.join('>')}`);
    if (slower) bad.push(`${kind}: ${slower} routes slower`);
    if (kind === 'hound' && !(had > 0 && fixed > 0 && passed > 0)) bad.push(`hound: stop-pivot-go routes ${had}, eased ${fixed}, waypoints passed ${passed}`);
    const turnMax = Math.max(...B.map(r => r.maxTurn)); if (turnMax > caps[kind] * 1.12 + .01) bad.push(`${kind} turned at ${turnMax.toFixed(2)} rad/s (its rate ${caps[kind]})`);
    note.push(`${kind} ${FAST[kind]} px/s: slow ${slow.join('>')} s, pivoting ${piv.join('>')} s, aim jumps ${jumps.join('>')}, time ${t.join('>')} s, routes slower ${slower}, stop-pivot-go eased ${fixed}/${had}, waypoints passed ${passed}, fastest turn ${turnMax.toFixed(2)} rad/s`);
  }
  const wideOf = (kind, k) => Math.max(...out.filter(r => r.kind === kind && r.v === FAST[kind]).map(r => r[k].wide));
  const wide = Object.fromEntries(Object.keys(PACES).map(k => [k, [+wideOf(k, 'a').toFixed(1), +wideOf(k, 'b').toFixed(1)]]));
  if (!(wide.hound[1] >= wide.skinstealer[1] && wide.hound[1] >= wide.smiler[1] && wide.hound[1] >= wide.hound[0] * .9)) bad.push(`widest: ${JSON.stringify(wide)}`);
  return { ok: !bad.length && nR >= 20, note: `${nR} routes, R18's follower > this tree's: ${note.join(' | ')} | the most off its route at speed (px, R18 > now): ${Object.entries(wide).map(([k, v]) => k + ' ' + v.join('>')).join(', ')}${bad.length ? ' | ' + bad.join('; ') : ''}` };
});

add('NC02 collision (N02, N05, N06): every tick of every run - every species, every pace, from rest and from speed - no body inside anything solid; no more wall contacts, hard bonks, stuck recoveries or side-steps than R18\'s follower on the same routes', () => {
  const { out } = runs(), bad = [], note = [];
  const inside = out.reduce((a, r) => a + r.b.inside, 0), least = Math.min(...out.map(r => r.b.minClear));
  for (const kind of Object.keys(PACES)) {
    const rs = out.filter(r => r.kind === kind), A = rs.map(r => r.a), B = rs.map(r => r.b), f = k => [sum(A, k), sum(B, k)];
    const c = f('contacts'), bo = f('bonks'), st = f('stuck'), rc = f('recover'), arr = [A.filter(r => r.arrived).length, B.filter(r => r.arrived).length];
    if (c[1] > c[0] || bo[1] > bo[0] || st[1] > st[0] || rc[1] > rc[0] || arr[1] < arr[0]) bad.push(kind);
    note.push(`${kind} (${rs.length} runs): contacts ${c.join('>')}, bonks ${bo.join('>')}, stuck ${st.join('>')}, side-steps ${rc.join('>')}, arrived ${arr.join('>')}`);
  }
  return { ok: inside === 0 && least > -.01 && !bad.length, note: `ticks inside anything solid ${inside}, least clearance ${least.toFixed(2)} px | R18's follower > this tree's: ${note.join(' | ')}${bad.length ? ' | worse: ' + bad.join(', ') : ''}` };
});

add('NC03 traversal (N07): routes through vault links and crawl or tight-gap cells, for the Hound and the Smiler - the same traversals begun and the same modes as R18\'s follower, and no link, crawl or tight-gap waypoint ever dropped as passed', () => {
  const w = World(19), { now, r18 } = pair(), bad = [], note = [];
  for (const [kind, v] of [['hound', 292], ['hound', 92], ['smiler', 255], ['smiler', 80]]) {
    const RS = routes(w, 10, 19 + v, true, kind); let n = 0, trav = [0, 0], odd = 0, same = 0;
    for (const R of RS) { const a = walk(w, r18, kind, R, v, false), b = walk(w, now, kind, R, v, false); if (!a || !b) continue; n++; trav[0] += a.trav; trav[1] += b.trav; odd += b.droppedOdd; if (a.modes === b.modes && a.trav === b.trav) same++; else bad.push(`${kind} ${v}: ${a.modes} (${a.trav}) > ${b.modes} (${b.trav})`); }
    if (!n || odd) bad.push(`${kind} ${v}: routes ${n}, odd waypoints dropped ${odd}`);
    note.push(`${kind} ${v} px/s: ${n} routes through links or crawl cells, traversals ${trav.join('>')}, the same modes and traversals ${same}/${n}, link/crawl waypoints dropped ${odd}`);
  }
  return { ok: !bad.length, note: note.join(' | ') + (bad.length ? ' | ' + bad.slice(0, 4).join('; ') : '') };
});

add('NC04 the real engine (N08, N09, N15, N17): 120 s of two Hounds, a Smiler and a Skin-Stealer among four players walking, running, and going far away and back; then Hounds sent after runners by the admin\'s navigation command, where the hunk fires - no body inside anything solid, no jump faster than its top speed (outside a vault, a strike or a tier change), every number finite, its route bounded', () => {
  const w = World(2601), eng = w.eng, geo = eng.geo, R = rng(2601), bad = [];
  const spots = []; for (let k = 0; k < 4000 && spots.length < 120; k++) { const x = 200 + R() * (geo.W - 400), y = 200 + R() * (geo.H - 400); if (w.ad.clear(x, y, 30, 'walk')) spots.push({ x, y }); }
  const ps = []; for (let i = 0; i < 4; i++) { const s = spots[i * 7], p = w.player(s.x, s.y, { light: i !== 2 }); p.stop('stand'); ps.push(p); }
  const es = [eng.spawn('hound', spots[40].x, spots[40].y), eng.spawn('hound', spots[50].x, spots[50].y), eng.spawn('smiler', spots[60].x, spots[60].y), eng.spawn('skinstealer', spots[70].x, spots[70].y, { hunger: .6 })];
  const last = new Map(es.map(e => [e.id, { x: e.x, y: e.y, tier: e.tier }])), tiers = new Set(), M = { inside: 0, jumps: 0, nan: 0, maxPath: 0, ticks: 0 };
  w.run(120, (ww, t) => {
    const n = Math.round(t * 60);
    if (n % 300 === 0) for (const [i, p] of ps.entries()) { const g = spots[Math.floor(R() * spots.length)]; p.pathTo(g.x, g.y, ['walk', 'run', 'crouch', 'walk'][i]); }
    if (n === 40 * 60) for (const p of ps) { p.x = 8800; p.y = 600; p.stop('stand'); }                        // everyone far: the creatures go mid, then far ...
    if (n === 70 * 60) for (const [i, p] of ps.entries()) { const s = spots[i * 9]; p.x = s.x; p.y = s.y; p.stop('stand'); }   // ... and back near
    for (const e of es) {
      if (!eng.entities.includes(e)) continue;
      M.ticks++; tiers.add(e.tier);
      if (![e.x, e.y, e.ang, e.speed].every(Number.isFinite)) M.nan++;
      if (e.tier === 'near' && !e.trav && clearance(geo, e) < -.01) M.inside++;
      const L = last.get(e.id), step = Math.hypot(e.x - L.x, e.y - L.y), top = (e.sp.vTop || 300) * DT * 1.15 + 1, struck = e.pounce || e.cap || e.commit || /lunge|pounce|leap|strike|spring|rush/.test(e.act || '');
      if (step > top && !e.trav && !struck && L.tier === e.tier && e.tier === 'near') M.jumps++;
      M.maxPath = Math.max(M.maxPath, e.path ? e.path.length : 0);
      last.set(e.id, { x: e.x, y: e.y, tier: e.tier });
    }
    return true;
  });
  const stuck = es.map(e => (e.nav && e.nav.stuckN) || 0), passed = es.map(e => (e.nav && e.nav.passed) || 0);
  if (M.inside || M.jumps || M.nan || M.maxPath > 400 || !tiers.has('far') || !tiers.has('near')) bad.push('x');
  // (the independent review: in that world the hunk never fired) and Hounds sent after running people by the admin's own navigation
  // command, where it does fire (r19n_chase.js) - as built, and with the hunks taken back out in a child process (r19n_child.js): every
  // jump over its top speed must be one R18's follower makes too (the engine's push out of a corner), and the stuck re-routes no more
  const C = require('./r19n_chase.js').run(require('./lib.js'));
  const B8 = JSON.parse(require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'r19n_child.js'), ROOT], { maxBuffer: 1 << 26 }).toString());
  const newJumps = C.jumps.filter(j => !B8.jumps.some(k => k[0] === j[0] && Math.abs(k[1] - j[1]) < .02));
  if (C.inside || newJumps.length || C.nan || !C.passed || B8.took !== 1 || C.stuck > B8.stuck) bad.push('chase');
  return { ok: !bad.length, note: `${M.ticks} creature-ticks over tiers ${[...tiers].join('/')}: inside anything ${M.inside}, jumps over its top speed ${M.jumps}, non-finite ${M.nan}, longest route ${M.maxPath} waypoints | stuck re-routes ${stuck.join('/')}, waypoints passed on the inside of a bend ${passed.join('/')} | Hounds sent after runners (navigation, 4 seeds x 60 s, ${C.ticks} hound-ticks), R18's follower > this tree's: waypoints passed ${B8.passed} > ${C.passed}, inside anything ${B8.inside} > ${C.inside}, jumps over its top speed ${B8.jumps.length} > ${C.jumps.length} (not also R18's: ${newJumps.length}), non-finite ${C.nan}, stuck re-routes ${B8.stuck} > ${C.stuck}, contacts ${B8.contacts} > ${C.contacts}` };
});

S.helpers = { pair, routes, walk, runs };                      // (for development tools; run.js reads only the list)
module.exports = S;
