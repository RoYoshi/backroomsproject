/* Stage 3B-N N5 - Hound blind pursuit, headless on the real sim.js + ai.js + move.js (development only; never served).
 *
 *   node dev/stage-3b-n/hound_3bn.js [--only B0,S2] [--json FILE]      (exit 1 on any failure)
 *
 * The game folder is found by dev/paths.js: copy this file into another build's dev/stage-3b-n/ to measure that build (the parent).
 *
 * BLIND PURSUIT (a committed chase that loses sight)
 * B0 hidden truth does not steer it: two identical worlds up to the moment the prey vanishes; then in one the prey stands still, in the other it
 *    is put somewhere else out of sight (silently).  The Hound must do exactly the same thing, tick for tick, until either world gives it new
 *    evidence (a sighting, a sound, a light)
 * B1 chase around a corner: it stays a chase (HUNTING, pursuit speed) after losing sight until its predicted route is checked or it
 *    sees the prey again; it never turns CURIOUS
 * B2 a silent change of route fools it: the prey slips away quietly off its last heading; the Hound's predicted route follows the heading it saw
 * B3 recent running updates the pursuit: a prey that keeps running out of sight is followed by ear (pursuit source 'ear'), the chase is kept,
 *    its goal is nearer the real prey than in the same chase where the prey goes on quietly, and it moves far less than
 *    the steps' blur (no per-footstep jitter)
 * B4 no evidence: the pursuit becomes a search, confidence decays, it gives up for a stated reason */
'use strict';
const path = require('path'), fs = require('fs');
const L = require('../tests/lib.js'); const { World, DT, dist, geo, rate, avg } = L;
const argv = process.argv.slice(2), ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null, JS = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const TAU = Math.PI * 2, CHASE = 292;
const results = [], data = {}; const check = (id, name, ok, note) => { results.push({ id, name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + id + ' ' + name + (note ? '\n       ' + note : '')); };
const T = (id, fn) => { if (ONLY && !ONLY.includes(id)) return; try { fn(); } catch (e) { check(id, 'harness', false, e.stack.split('\n').slice(0, 4).join(' | ')); } };

/* a hound that has just committed to a runner at d px, in the dark (s_chase.js's hunt) */
function hunt(seed, d = 380) {
  const G = geo(), P = G.cells.filter((_, k) => k % 7 === 0).map(c => ({ x: G.g.cx(c), y: G.g.cy(c) })).filter(q => G.ad.clear(q.x, q.y, 26, 'walk'));
  const a = P[(seed * 7919 + 13) % P.length], w = World(5000 + seed), p = w.player(a.x, a.y, { light: true }); p.stamina = 100;
  let h = null; for (let k = 0; k < 24 && !h; k++) { const ang = k / 24 * TAU, x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d; if (G.ad.clear(x, y, 26, 'walk') && w.eng.geo.lineClear(x, y, a.x, a.y, 22, 'walk')) h = w.hound(x, y); }
  if (!h) return null; h.ang = Math.atan2(a.y - h.y, a.x - h.x); w.run(.4, null); const r = h.mem.p.get(p.id); if (!r || !r.seen) return null;
  h.x = h.spawn.x; h.y = h.spawn.y; h.speed = 0; h.path = []; h.goal = null; h.goalKey = ''; h.pathAge = 99; h.lunge = null; h.recover = 0; h.act = '';
  h.state = 'HUNTING'; h.target = p.id; h.chaseBlind = 0; p.light = false;
  return { w, p, h, P };
}
/* where a prey would run to get out of sight: 500-1100 px away, reachable, hidden from the hound (offHeading: not ahead of the line hound->prey) */
function hideSpot(w, p, h, P, i, offHeading) {
  const hd = Math.atan2(p.y - h.y, p.x - h.x);
  for (let k = 0; k < 80; k++) { const q = P[(i * 37 + k * 211) % P.length], d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 500 || d > 1100) continue; if (w.eng.geo.los(h.x, h.y, q.x, q.y)) continue;
    if (offHeading && Math.cos(Math.atan2(q.y - p.y, q.x - p.x) - hd) > .3) continue; const r = w.eng.geo.path(p.x, p.y, q.x, q.y, { CAN_VAULT: false }); if (r && r.length) return q; }
  return null;
}
/* run until the hound has lost sight of the prey for `hold` s (the prey moving as scripted); returns the loss time or -1 */
function untilLost(w, h, p, lim = 12, hold = .3) {
  let t = 0, lostT = -1;
  while (t < lim) { w.step(); t += DT; if (p.caught || p.dead) return -1; const r = h.mem.p.get(p.id); if (r && !r.seen) { if (lostT < 0) lostT = t; if (t - lostT >= hold) return t; } else lostT = -1; }
  return -1;
}
const evKey = (h, p) => { const r = h.mem.p.get(p.id); return r ? [r.seenAt, r.heardAt, h.mem.leads.length ? h.mem.leads[h.mem.leads.length - 1].t : 0, h.mem.sounds.length ? h.mem.sounds[0].t : 0].join('|') : ''; };
const hsnap = h => [h.x.toFixed(4), h.y.toFixed(4), h.ang.toFixed(5), h.state, h.act, h.dbg.pursuit ? h.dbg.pursuit.x + ',' + h.dbg.pursuit.y + ',' + h.dbg.pursuit.src : '-', h.search && h.search.goal ? Math.round(h.search.goal.x) + ',' + Math.round(h.search.goal.y) : '-'].join(' ');

/* ======================================================================= B0 */
T('B0', () => {
  const rs = [];
  for (let i = 1; i <= 60 && rs.length < 10; i++) {
    const mk = () => { const A = hunt(i); if (!A) return null; const q = hideSpot(A.w, A.p, A.h, A.P, i, false); if (!q) return null; A.p.pathTo(q.x, q.y, 'run'); return A; };
    const A = mk(), B = mk(); if (!A || !B) continue;
    const tl = untilLost(A.w, A.h, A.p), tl2 = untilLost(B.w, B.h, B.p); if (tl < 0 || tl !== tl2 || hsnap(A.h) !== hsnap(B.h)) continue;
    /* A: the prey stops where it is.  B: the prey is somewhere else entirely (another hidden spot), silently */
    for (const X of [A, B]) { X.p.stop('stand'); X.p.stamina = 100; X.p.ex = 0; }
    const alt = (() => { for (let k = 0; k < 400; k++) { const q = A.P[(i * 131 + k * 97) % A.P.length], dh = dist(q, A.h), dp = dist(q, A.p); if (dh < 400 || dh > 1500 || dp < 400) continue; if (B.w.eng.geo.los(B.h.x, B.h.y, q.x, q.y) || B.w.eng.geo.los(B.p.x, B.p.y, q.x, q.y)) continue; return q; } return null; })();
    if (!alt) continue; B.p.x = alt.x; B.p.y = alt.y;
    const k0 = evKey(A.h, A.p); let same = 0, diff = null, t = 0, stopWhy = 'time';
    while (t < 5) {
      A.w.step(); B.w.step(); t += DT;
      const ka = evKey(A.h, A.p), kb = evKey(B.h, B.p);
      if (ka !== k0 || kb !== k0) { stopWhy = 'new evidence'; break; }
      const sa = hsnap(A.h), sb = hsnap(B.h); if (sa !== sb) { diff = { t: +t.toFixed(2), a: sa, b: sb }; break; } same++;
    }
    rs.push({ seed: i, ticks: same, secs: +(same * DT).toFixed(2), diff, stopWhy, moved: Math.round(dist(alt, A.p)), statesA: A.h.state, pursuitSrc: A.h.dbg.pursuit && A.h.dbg.pursuit.src });
  }
  data.B0 = rs;
  const bad = rs.filter(r => r.diff), compared = avg(rs.map(r => r.secs));
  check('B0', 'hidden truth does not steer the Hound: with the prey silently somewhere else (hundreds of px away), the Hound does exactly the same, tick for tick, until it gets new evidence',
    rs.length >= 6 && !bad.length && rs.reduce((a, r) => a + r.ticks, 0) >= 400,
    `${rs.length} paired runs; prey moved ${Math.min(...rs.map(r => r.moved))}-${Math.max(...rs.map(r => r.moved))} px between the worlds; identical for ${compared.toFixed(2)} s on average (${rs.map(r => r.secs).join(', ')}), ended by ${[...new Set(rs.map(r => r.stopWhy))].join(' / ')}; diverged without new evidence: ${bad.length}${bad.length ? ' ' + JSON.stringify(bad[0].diff) : ''}`);
});

/* ======================================================================= B1 / B3 */
function chaseAround(i, mode) {
  const A = hunt(i); if (!A) return null; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i, false); if (!q) return null; p.pathTo(q.x, q.y, 'run');
  const tl = untilLost(w, h, p); if (tl < 0) return null;
  const r = h.mem.p.get(p.id), lkp = { x: r.lkx, y: r.lky }; if (mode === 'quiet') { p.mode = 'crouch'; }
  const S = { states: new Set(), curious: 0, speeds: [], reachedLkp: false, srcs: new Set(), jumps: 0, maxJump: 0, prev: null, seenAgain: -1, hunt: 0, t: 0, err: [], raw: [], lastSnd: 0 };
  while (S.t < 3) {
    w.step(); S.t += DT; if (p.caught || p.dead) { S.caught = true; break; }
    if (h.mem.p.get(p.id).seen) { S.seenAgain = +S.t.toFixed(2); break; }
    S.states.add(h.state); if (h.state === 'CURIOUS') S.curious++; if (h.state === 'HUNTING') S.hunt += DT;
    if (S.t < 1.5 && !(h.recover > 0) && !h.lunge) S.speeds.push(h.speed); if (dist(h, lkp) < 120) S.reachedLkp = true;
    const sn = h.mem.sounds[0]; if (sn && sn.id !== S.lastSnd && sn.attribution === 'inferred') { S.lastSnd = sn.id; S.raw.push([sn.x, sn.y]); }
    const pu = h.state === 'HUNTING' ? h.dbg.pursuit : null;
    if (pu) { S.srcs.add(pu.src); S.err.push(Math.hypot(pu.x - p.x, pu.y - p.y)); if (pu.src === 'ear' && S.prev && S.prev.src === 'ear') { const jmp = Math.hypot(pu.x - S.prev.x, pu.y - S.prev.y); S.maxJump = Math.max(S.maxJump, jmp);  } S.prev = pu; }
  }
  S.dEnd = Math.round(dist(h, p)); S.meanSpeed = Math.round(avg(S.speeds)); S.goalErr = Math.round(avg(S.err)); S.rawJump = 0; for (let k = 1; k < S.raw.length; k++) S.rawJump = Math.max(S.rawJump, Math.hypot(S.raw[k][0] - S.raw[k - 1][0], S.raw[k][1] - S.raw[k - 1][1])); S.states = [...S.states]; S.srcs = [...S.srcs]; S.firstHunt = Math.min(S.t, 1.5); return S;
}
T('B1', () => {
  const rs = []; for (let i = 1; i <= 200 && rs.length < 16; i++) { const S = chaseAround(i, 'run'); if (S && !S.caught) rs.push(S); }
  data.B1 = rs.map(S => ({ states: S.states, curious: S.curious, hunt: +S.hunt.toFixed(2), meanSpeed: S.meanSpeed, reachedLkp: S.reachedLkp, srcs: S.srcs, seenAgain: S.seenAgain }));
  /* kept the chase: HUNTING for the first 1.2 s after the loss (or until it saw the prey again) */
  const kept = S => S.curious === 0 && S.hunt >= Math.min(1.2, S.seenAgain >= 0 ? S.seenAgain - .05 : 1.2);
  check('B1', 'chase around a corner: after losing sight it stays a chase (HUNTING, at pursuit speed) at least until the predicted route is checked or it sees the prey again; it never turns CURIOUS',
    rs.length >= 10 && rate(rs, kept) >= .9 && rs.every(S => S.curious === 0) && avg(rs.map(S => S.meanSpeed)) >= CHASE * .6,
    `${rs.length} chases lost round a corner (the prey running on): kept the chase in ${rs.filter(kept).length}; saw the prey again within 3 s in ${rs.filter(S => S.seenAgain >= 0).length}; mean speed in the first 1.5 s (lunge recovery excluded) ${Math.round(avg(rs.map(S => S.meanSpeed)))} px/s (chase ${CHASE}); reached the last-seen spot ${(rate(rs.filter(S => S.seenAgain < 0), S => S.reachedLkp) * 100) | 0}% (runs not re-seen); CURIOUS in ${rs.filter(S => S.curious).length}; pursuit sources ${[...new Set(rs.flatMap(S => S.srcs))].filter(Boolean).join(', ') || '-'}; states ${[...new Set(rs.flatMap(S => S.states))].join(', ')}`);
});
T('B3', () => {
  const rs = []; for (let i = 1; i <= 200 && rs.length < 14; i++) { const a = chaseAround(i, 'run'), b = chaseAround(i, 'quiet'); if (a && b && !a.caught && !b.caught && a.err.length > 20 && b.err.length > 20) rs.push({ run: a, quiet: b }); }
  data.B3 = rs.map(x => ({ run: { err: x.run.goalErr, srcs: x.run.srcs, curious: x.run.curious, maxJump: Math.round(x.run.maxJump), rawJump: Math.round(x.run.rawJump) }, quiet: { err: x.quiet.goalErr, srcs: x.quiet.srcs } }));
  const ear = rate(rs, x => x.run.srcs.includes('ear')), better = rate(rs, x => x.run.goalErr < x.quiet.goalErr), gj = Math.max(0, ...rs.map(x => x.run.maxJump)), rj = Math.max(0, ...rs.map(x => x.run.rawJump));
  check('B3', 'recent running out of sight updates the pursuit: followed by ear, the chase kept, its goal nearer the real prey than when the prey goes on quietly; the goal moves far less than the steps\' blur (no per-footstep jitter)',
    rs.length >= 8 && ear >= .7 && avg(rs.map(x => x.run.goalErr)) < avg(rs.map(x => x.quiet.goalErr)) && rs.every(x => x.run.curious === 0) && gj <= rj * .6,
    `${rs.length} paired chases (same seed; out of sight the prey runs on, or creeps on quietly): followed by ear in ${(ear * 100) | 0}%; the pursuit goal was ${Math.round(avg(rs.map(x => x.run.goalErr)))} px from a running prey vs ${Math.round(avg(rs.map(x => x.quiet.goalErr)))} px from a quiet one (closer in ${(better * 100) | 0}%); CURIOUS ${rs.filter(x => x.run.curious).length}; largest jump of the ear goal between ticks ${Math.round(gj)} px, against ${Math.round(rj)} px between the raw heard steps (the steps' blur)`);
});

/* ======================================================================= B2 */
T('B2', () => {
  const rs = [];
  for (let i = 1; i <= 200 && rs.length < 12; i++) {
    const A = hunt(i); if (!A) continue; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i, false); if (!q) continue; p.pathTo(q.x, q.y, 'run');
    const tl = untilLost(w, h, p); if (tl < 0) continue; const r = h.mem.p.get(p.id), hd = Math.atan2(r.lvy, r.lvx), lkp = { x: r.lkx, y: r.lky };
    if (Math.hypot(r.lvx, r.lvy) < 60) continue;
    /* the prey turns back the way it came, quietly (crouched) */
    const back = (() => { for (let k = 0; k < 300; k++) { const c = P[(i * 53 + k * 89) % P.length], dd = dist(c, p); if (dd < 350 || dd > 900) continue; if (Math.cos(Math.atan2(c.y - p.y, c.x - p.x) - hd) > -.3) continue; if (w.eng.geo.los(h.x, h.y, c.x, c.y) || w.eng.geo.los(lkp.x, lkp.y, c.x, c.y)) continue; const pr = w.eng.geo.path(p.x, p.y, c.x, c.y, { CAN_VAULT: false }); if (pr && pr.length) return c; } return null; })();
    if (!back) continue; p.pathTo(back.x, back.y, 'crouch');
    let t = 0, seen = false, goalAhead = null, firstGoal = null, away = null;
    while (t < 6) { w.step(); t += DT; if (p.caught || p.dead) break; if (h.mem.p.get(p.id).seen) { seen = true; break; }
      const pu = h.state === 'HUNTING' ? h.dbg.pursuit : null; if (pu && pu.src === 'route' && !firstGoal) { firstGoal = { x: pu.x, y: pu.y }; goalAhead = Math.cos(Math.atan2(pu.y - lkp.y, pu.x - lkp.x) - hd) > 0; away = dist(firstGoal, p) > dist(lkp, p); } }
    rs.push({ seen, caught: !!(p.caught || p.dead), goalAhead, routed: !!firstGoal, away });
  }
  data.B2 = rs;
  const routed = rs.filter(x => x.routed), fooled = rate(rs, x => !x.seen && !x.caught);
  check('B2', 'a silent change of route fools it: the predicted route continues the heading it saw, away from where the prey really went',
    rs.length >= 6 && routed.length >= 4 && rate(routed, x => x.goalAhead) >= .8 && rate(routed, x => x.away) >= .8,
    `${rs.length} chases where the prey, out of sight, crept back the way it came: the Hound planned a predicted route in ${routed.length}, ahead along the heading it saw in ${(rate(routed, x => x.goalAhead) * 100) | 0}%, i.e. farther from the real prey than the spot where it vanished in ${(rate(routed, x => x.away) * 100) | 0}%; the prey stayed unseen for 6 s in ${(fooled * 100) | 0}% (the rest were seen on the way to that spot)`);
});

/* ======================================================================= B4 */
T('B4', () => {
  const rs = [];
  for (let i = 1; i <= 80 && rs.length < 10; i++) {
    const A = hunt(i); if (!A) continue; const { w, p, h, P } = A; const q = hideSpot(w, p, h, P, i, false); if (!q) continue; p.pathTo(q.x, q.y, 'run');
    const tl = untilLost(w, h, p); if (tl < 0) continue; p.stop('stand'); p.stamina = 100; p.ex = 0;
    const far = (() => { for (let k = 0; k < 400; k++) { const c = P[(i * 61 + k * 89) % P.length], dh = dist(c, h); if (dh < 1200 || dh > 1800) continue; if (w.eng.geo.los(h.x, h.y, c.x, c.y)) continue; return c; } return null; })();
    if (!far) continue; p.x = far.x; p.y = far.y;                                   // the prey is simply gone (silently, far away): the Hound has nothing new to go on
    const seq = []; let t = 0, gave = -1, seen = false;
    while (t < 90) { w.step(); t += DT; if (p.caught || p.dead) break; if (h.mem.p.get(p.id).seen) { seen = true; break; } if (seq[seq.length - 1] !== h.state) seq.push(h.state); if (['ROAMING', 'DORMANT'].includes(h.state)) { gave = t; break; } }
    if (seen || p.caught || p.dead) continue; const r = h.mem.p.get(p.id);
    rs.push({ gave: +gave.toFixed(1), seq: seq.join('>'), conf: r ? +r.conf.toFixed(2) : 0, why: h.dbg.disengage || '', blindEnd: h.dbg.blindEnd || null });
  }
  data.B4 = rs;
  const gave = rs.filter(x => x.gave >= 0);
  check('B4', 'no evidence: the blind pursuit becomes a search, confidence decays, and the Hound gives up for a stated reason',
    rs.length >= 6 && gave.length >= rs.length * .85 && gave.every(x => x.why) && rs.every(x => /^HUNTING>SEARCHING/.test(x.seq)),
    `${rs.length} preys gone without a trace (silently 1200-1800 px away): gave up in ${gave.length} (after ${Math.round(avg(gave.map(x => x.gave)))} s on average); sequences ${[...new Set(rs.map(x => x.seq))].join(' | ')}; reasons ${[...new Set(gave.map(x => x.why))].join(' / ')}; blind phase ended: ${[...new Set(rs.map(x => x.blindEnd && x.blindEnd.why).filter(Boolean))].join(' / ') || '-'}`);
});

if (JS) fs.writeFileSync(JS, JSON.stringify({ results, data }, null, 1));
const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
