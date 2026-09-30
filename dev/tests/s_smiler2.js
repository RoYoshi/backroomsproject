/* v19: SMILER behaviour design (spec 44-59): encounter memory, micro-behaviours, light-failure variety, disengagement, spawn, rare quirks, and the anti-cheese matrix */
'use strict';
const fs = require('fs'), path = require('path');
const { World, DT, dist, geo, over, rate, avg, TAU, pick } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });

function darkPair(i, lo, hi) {
  const G = geo(), g = G.g;
  for (let k = 0; k < 400; k++) {
    const p = G.dark[(i * 131 + k * 17) % G.dark.length]; if (!p || !G.ad.clear(p.x, p.y, 24, 'walk')) continue;
    const cand = G.dark.filter(c => { const d = Math.hypot(c.x - p.x, c.y - p.y); return d >= lo && d <= hi && g.los(c.x, c.y, p.x, p.y) && G.ad.clear(c.x, c.y, 24, 'walk'); });
    if (cand.length) return { p, s: cand[(i * 7) % cand.length] };
  }
  return null;
}
function setup(seed, o = {}) {
  const pr = darkPair(seed, o.lo || 450, o.hi || 800); if (!pr) return null;
  const w = World(seed + 2000), p = w.player(pr.p.x, pr.p.y, { light: !!o.light }); p.stop(o.mode || 'stand'); p.angle = Math.atan2(pr.s.y - pr.p.y, pr.s.x - pr.p.x);
  const s = w.smiler(pr.s.x, pr.s.y); s.ang = Math.atan2(pr.p.y - pr.s.y, pr.p.x - pr.s.x); s.quirk = null;          // the matrix is about the standard creature; quirks have their own tests
  return { w, p, s, pr };
}
const ENG = new Set(['STALKING', 'PROVOKED', 'ATTACKING', 'PLAYING']), CON = new Set(['WATCHING', 'FOLLOWING', 'STALKING', 'PROVOKED', 'ATTACKING', 'PLAYING']);
/* run one tactic; `act(w,p,s,t)` is called every 0.25 s.  Reports what the smiler did about it. */
function tactic(seed, dur, act, o = {}) {
  const A = setup(seed, o); if (!A) return null; const { w, p, s } = A; let eng = false, con = false, kill = false, watchT = 0, again = 0, was = false, minD = 1e9;
  w.run(dur, (ww, t) => {
    if (ENG.has(s.state)) eng = true; if (CON.has(s.state)) { con = true; watchT += DT; } const now = CON.has(s.state); if (now && !was) again++; was = now;
    minD = Math.min(minD, dist(s, p)); if (w.kills.length) { kill = true; return false; }
    if (Math.round(t / DT) % 15 === 0) act(w, p, s, t, A);
  });
  return { eng, con, kill, again, minD: Math.round(minD), watchT: +watchT.toFixed(0), ex: [...w.eng.entities].length };
}
const SEEDS = [1, 2, 3, 4, 5, 6];
let DUR = 150;
function matrix(name, act, o, check) {
  add('T ' + name, () => {
    const D = o.dur || DUR, rs = SEEDS.concat(o.dur ? [7, 8, 9, 10, 11, 12] : []).map(i => tactic(i, D, act, o)).filter(Boolean);
    const r = { eng: rate(rs, x => x.eng), con: rate(rs, x => x.con), kill: rate(rs, x => x.kill), again: avg(rs.map(x => x.again)) };
    const ok = rs.length >= 4 && check(r, rs);
    return { ok, note: `${rs.length} runs x ${D}s: creature took interest ${(r.con * 100) | 0}%, committed ${(r.eng * 100) | 0}%, killed ${(r.kill * 100) | 0}%, ${r.again.toFixed(1)} separate interests/run` };
  });
}
/* tactics that are not about light: they must never become a way to be permanently left alone */
const notImmune = (r) => r.con >= .5;
matrix('standing completely still forever in the dark is not immunity', () => { }, { mode: 'stand' }, notImmune);
matrix('crouching forever in the dark is a real advantage but not immunity (300 s)', () => { }, { mode: 'crouch', dur: 300 }, (r) => r.con > 0);
matrix('slowly rotating in place is not immunity', (w, p, s, t) => { p.angle += .12; }, { mode: 'stand' }, notImmune);
matrix('flashlight spam: it keeps coming back (retreats from the beam, is not banished)', (w, p, s, t) => { p.light = true; p.angle = Math.atan2(s.y - p.y, s.x - p.x); }, { mode: 'stand', light: true }, (r, rs) => r.con >= .4 || rs.some(x => x.again >= 2));
matrix('rapidly toggling the flashlight is not immunity', (w, p, s, t) => { p.light = !p.light; p.angle = Math.atan2(s.y - p.y, s.x - p.x); }, { mode: 'stand', light: true }, notImmune);
matrix('walking backward while staring at it: it follows, does not give up', (w, p, s, t, A) => { const away = Math.atan2(p.y - s.y, p.x - s.x); p.go(p.x + Math.cos(away) * 60, p.y + Math.sin(away) * 60, 'walk'); p.angle = Math.atan2(s.y - p.y, s.x - p.x); }, { mode: 'stand' }, notImmune);
matrix('repeatedly breaking line of sight around one spot is not immunity', (w, p, s, t, A) => { const k = Math.floor(t / 6) % 2; p.stop('stand'); if (k) p.go(A.pr.p.x + 5, A.pr.p.y + 5, 'walk'); }, { mode: 'stand' }, notImmune);
matrix('circling one spot is not immunity', (w, p, s, t, A) => { const a = t * .5; p.go(A.pr.p.x + Math.cos(a) * 60, A.pr.p.y + Math.sin(a) * 60, 'walk'); }, { mode: 'stand' }, notImmune);
matrix('baiting: approach it, back away, repeat: it can still commit', (w, p, s, t) => { const ph = Math.floor(t / 5) % 2, a = Math.atan2(s.y - p.y, s.x - p.x); p.go(p.x + Math.cos(a + (ph ? Math.PI : 0)) * 50, p.y + Math.sin(a + (ph ? Math.PI : 0)) * 50, 'walk'); }, { mode: 'stand', lo: 350, hi: 500 }, notImmune);
matrix('living on the exact edge of its detection range is not immunity (300 s)', () => { }, { mode: 'stand', lo: 880, hi: 1000, dur: 300 }, (r) => r.con > 0);
add('T standing in bright light forever: the lamps are an advantage, not immunity (it still works on the person, from the dark next to the light)', () => {
  const G = geo(); const rs = SEEDS.map(i => {
    const c = G.lit[(i * 41 + 3) % G.lit.length]; if (!c) return null; const D = pick(G.dark, c.x, c.y, 300, 620, i); if (!D) return null;
    const w = World(4000 + i), p = w.player(c.x, c.y, { light: false }); p.stop('stand'); const s = w.smiler(D.x, D.y); let con = false, eng = false, closest = 1e9;
    w.run(240, () => { if (CON.has(s.state)) con = true; if (ENG.has(s.state)) eng = true; closest = Math.min(closest, dist(s, p)); if (w.kills.length) { eng = true; return false; } });
    return { con, eng, closest: Math.round(closest) };
  }).filter(Boolean);
  return { ok: rs.length >= 4 && (rate(rs, x => x.con) >= .4), note: `${rs.length} runs x 240s: took interest ${(rate(rs, x => x.con) * 100) | 0}%, committed ${(rate(rs, x => x.eng) * 100) | 0}%, closest approach avg ${Math.round(avg(rs.map(x => x.closest)))}px` };
});
add('T two players stacked together forever: followed and watched, not engaged; the pair is not a way to be safe from being watched', () => {
  const rs = SEEDS.map(i => {
    const A = setup(i, { mode: 'stand', lo: 450, hi: 700 }); if (!A) return null; const { w, p, s, pr } = A; const q = w.player(pr.p.x + 26, pr.p.y + 10, { light: false }); q.stop('stand');
    let con = false, eng = false, kill = false; w.run(150, () => { if (CON.has(s.state)) con = true; if (s.state === 'STALKING' || s.state === 'PROVOKED' || s.state === 'ATTACKING') eng = true; if (w.kills.length) { kill = true; return false; } });
    return { con, eng, kill };
  }).filter(Boolean);
  return { ok: rs.length >= 4 && rate(rs, x => x.con) >= .4, note: `${rs.length} runs: took interest ${(rate(rs, x => x.con) * 100) | 0}%, committed ${(rate(rs, x => x.eng) * 100) | 0}%, killed ${(rate(rs, x => x.kill) * 100) | 0}%` };
});

/* ------------------------------------------------ the behaviour itself */
add('N01 the creature is allowed to do nothing: most watched-and-followed encounters end with nobody hurt, some with a disappearance, some with a kill', () => {
  const rs = SEEDS.concat([7, 8, 9, 10, 11, 12]).map(i => tactic(i, 200, () => { }, { mode: 'stand' })).filter(Boolean);
  const nokill = rate(rs, r => !r.kill), interest = rate(rs, r => r.con);
  return { ok: rs.length >= 8 && nokill >= .55 && interest >= .5, note: `${rs.length} encounters: ${(interest * 100) | 0}% took interest; ${(nokill * 100) | 0}% ended with no kill; ${(rate(rs, r => r.eng) * 100) | 0}% ever committed` };
});
add('N02 encounter memory: after losing sight for 3+ s a stalking smiler still knows where the person went and does not reset', () => {
  const rs = SEEDS.map(i => {
    const A = setup(i, { lo: 330, hi: 520 }); if (!A) return null; const { w, p, s } = A; w.until(6, () => { const r = s.mem.p.get(p.id); return r && r.seen; });
    const r = s.mem.p.get(p.id); if (!r) return null; s.state = 'STALKING'; s.act = 'creep'; s.stateT = 0; s.target = p.id; s.style = 'rush'; s.stalk = { since: w.eng.now, hold: 0, rid: p.id, decided: false }; s.face = .85; s.faceT = .85;
    const to = { x: p.x + 500 * Math.cos(p.angle + 2.4), y: p.y + 500 * Math.sin(p.angle + 2.4) }; const ok = p.pathTo(to.x, to.y, 'run'); w.run(3.5, null);
    const rr = s.mem.p.get(p.id); return { ok, conf: rr ? rr.conf : 0, st: s.state, lost: !w.eng.geo.los(s.x, s.y, p.x, p.y) };
  }).filter(Boolean);
  const good = rs.filter(r => r.conf > .35 && r.st !== 'HIDDEN');
  return { ok: rs.length >= 3 && good.length >= rs.length * .6, note: `${good.length}/${rs.length} still hold the person in memory (avg conf ${avg(rs.map(r => r.conf)).toFixed(2)}) and are still active after 3.5 s (${rs.map(r => r.st).join(',')})` };
});
add('N03 encounter memory records what happened: lighting it up is remembered, and only for a while', () => {
  const rs = SEEDS.map(i => {
    const A = setup(i, { lo: 185, hi: 212, light: true }); if (!A) return null; const { w, p, s } = A; p.light = false; w.run(.6, null); p.light = true;
    for (let k = 0; k < 3; k++) { p.light = true; w.run(2.5, () => { p.angle = Math.atan2(s.y - p.y, s.x - p.x); }); p.light = false; w.run(8, null); }
    const c = s.enc.get(p.id), lit0 = c ? c.lit : 0; w.run(300, null); const c2 = s.enc.get(p.id);
    return { lit0, later: c2 ? c2.lit : 0 };
  }).filter(Boolean);
  return { ok: rs.length >= 3 && rate(rs, r => r.lit0 >= .5) >= .5 && avg(rs.map(r => r.later)) < avg(rs.map(r => r.lit0)) * .6, note: `remembered being lit: ${rs.map(r => r.lit0.toFixed(1)).join(',')}; five minutes later: ${rs.map(r => r.later.toFixed(1)).join(',')} (fades, not a permanent profile)` };
});
add('N04 light failure is information, not a trigger: over many lamp failures the reactions vary, and almost none become attacks', () => {
  const tally = {}; let n = 0, atk = 0;
  for (const i of SEEDS.concat([7, 8, 9, 10])) {
    const A = setup(i, { lo: 420, hi: 700 }); if (!A) continue; const { w, p, s } = A; w.until(5, () => { const r = s.mem.p.get(p.id); return r && r.seen; });
    for (let k = 0; k < 6; k++) { s.seenFails = new WeakSet(); w.eng.lightFail(s.x, s.y, 300, 1.2); s.dbg.lightEv = ''; w.run(4, () => { if (s.state === 'ATTACKING' || s.state === 'PROVOKED') { atk++; return false; } }); const k2 = (s.dbg.lightEv || 'none@').split('@')[0]; tally[k2] = (tally[k2] || 0) + 1; n++; if (s.state === 'ATTACKING' || s.state === 'PROVOKED') break; }
  }
  const kinds = Object.keys(tally).filter(k => k !== 'none' && tally[k] > 0);
  return { ok: n >= 20 && kinds.length >= 4 && atk / n < .12, note: `${n} failures: ${JSON.stringify(tally)}; ended in a commit ${atk} times` };
});
add('N05 micro-behaviour: it turns its head toward a sound while it is watching from the dark', () => {
  const rs = SEEDS.map(i => {
    const A = setup(i, { lo: 500, hi: 700 }); if (!A) return null; const { w, p, s } = A; s.state = 'HIDDEN'; s.act = ''; const side = s.ang + 1.3, sx = s.x + Math.cos(side) * 300, sy = s.y + Math.sin(side) * 300;
    if (!w.ad.clear(sx, sy, 20, 'walk')) return null; w.eng.sound({ type: 'noise', x: sx, y: sy, r: 900, I: 1, src: 0, ent: 0 }); let best = 0; w.run(1.5, () => { best = Math.max(best, Math.abs(s.head || 0) + Math.abs(s.hearHead || 0)); }); return { best, heard: !!s.hear };
  }).filter(Boolean);
  return { ok: rs.length >= 3 && rate(rs, r => r.heard && r.best > .15) >= .6, note: `${rs.length} runs, head/face attention toward the sound in ${(rate(rs, r => r.heard && r.best > .15) * 100) | 0}%` };
});
add('N06 micro-behaviour: a follower stops when it is looked at, and does not simply stand there forever', () => {
  const rs = SEEDS.map(i => {
    const A = setup(i, { lo: 420, hi: 560 }); if (!A) return null; const { w, p, s } = A; w.until(8, () => { const r = s.mem.p.get(p.id); return r && r.seen; }); const r = s.mem.p.get(p.id); if (!r || !r.seen) return null;
    s.state = 'FOLLOWING'; s.act = 'follow'; s.stateT = 0; s.target = p.id; s.follow = { since: w.eng.now, until: w.eng.now + 200, rid: p.id, goalT: 0, frz: 0, obsT: -99 };
    let still = 0, tot = 0, gone = false; w.run(40, () => { p.angle = Math.atan2(s.y - p.y, s.x - p.x); if (s.state === 'FOLLOWING') { tot++; if (s.speed < 20) still++; } if (s.state === 'DISAPPEARING' || s.state === 'HIDDEN') gone = true; });
    return tot > 60 ? { frac: still / tot, gone } : null;
  }).filter(Boolean);
  return { ok: rs.length >= 2 && avg(rs.map(r => r.frac)) > .5 && rate(rs, r => r.gone) >= .3, note: `stood still ${(avg(rs.map(r => r.frac)) * 100) | 0}% of the time while watched; ${(rate(rs, r => r.gone) * 100) | 0}% eventually withdrew (staring does not freeze it forever)` };
});
add('N07 disengagement: a committed rush can become watching again when the prey is joined by someone', () => {
  let stood = 0, n = 0;
  for (const i of SEEDS.concat([7, 8, 9, 10, 11, 12])) {
    const A = setup(i, { lo: 380, hi: 520 }); if (!A) continue; const { w, p, s, pr } = A; w.until(6, () => { const r = s.mem.p.get(p.id); return r && r.seen; }); const r = s.mem.p.get(p.id); if (!r) continue;
    const q = w.player(pr.p.x + 30, pr.p.y + 8, { light: false }); q.stop('stand'); w.run(1.5, null);
    s.state = 'PROVOKED'; s.act = 'rush'; s.stateT = 0; s.rushT = 0; s.target = p.id; s.provoked = { rid: p.id, style: 'rush' }; n++;
    w.run(6, () => { if (s.state === 'WATCHING' && s.dbg.stoodDown) { stood++; return false; } if (w.kills.length) return false; });
  }
  return { ok: n >= 6 && stood >= 1, note: `${stood}/${n} rushes stood down to observation once the prey was no longer alone (the rest committed or withdrew for other reasons)` };
});
add('N08 spawns: away from people, in the dark, out of sight (over many placements)', () => {
  const w = World(777), P = w.player(3000, 3504, { light: true }); P.stop('stand'); let n = 0, dark = 0, hidden = 0, far = 0;
  for (let i = 0; i < 40; i++) { w.sim.admin.removeSmiler(); if (!w.sim.admin.addSmiler()) continue; const e = w.eng.entities.filter(x => x.kind === 'smiler').pop(); if (!e) continue; n++; if (w.eng.geo.lamp[w.eng.geo.cellAt(e.x, e.y)] < .1) dark++; if (!w.eng.geo.los(e.x, e.y, P.x, P.y)) hidden++; if (dist(e, P) > 1000) far++; }
  return { ok: n >= 25 && dark / n >= .95 && hidden / n >= .85 && far / n >= .95, note: `${n} placements: dark ${(dark / n * 100) | 0}%, out of the player's sight ${(hidden / n * 100) | 0}%, over 1000px away ${(far / n * 100) | 0}%` };
});
add('N09 no teleporting on repositioning: relocation and light-failure moves are walked, bounded per tick', () => {
  let worst = 0;
  for (const i of SEEDS) { const A = setup(i, { lo: 420, hi: 700 }); if (!A) continue; const { w, p, s } = A; let px = s.x, py = s.y; w.run(120, (ww, t) => { if (Math.round(t / DT) % 240 === 0) { s.seenFails = new WeakSet(); w.eng.lightFail(s.x, s.y, 300, 1); } worst = Math.max(worst, Math.hypot(s.x - px, s.y - py)); px = s.x; py = s.y; }); }
  return { ok: worst < 9, note: `largest single-tick movement in 6 x 120 s with repeated light failures: ${worst.toFixed(2)}px (a walk, not a jump)` };
});
add('N10 rare individuals: about one in seven is unusual, every kind occurs, and the rest are the standard creature', () => {
  const w = World(31); const cnt = {}; let n = 0; const G = geo(); const c = G.dark[5];
  for (let i = 0; i < 500; i++) { const e = w.eng.spawn('smiler', c.x, c.y); n++; cnt[e.quirk || 'standard'] = (cnt[e.quirk || 'standard'] || 0) + 1; w.eng.remove(e.id); }
  const q = n - cnt.standard, kinds = Object.keys(cnt).filter(k => k !== 'standard').length;
  return { ok: q / n > .08 && q / n < .22 && kinds === 5, note: `${JSON.stringify(cnt)}` };
});
add('N11 no aggression UI: the normal HUD and client code carry no meter, icon or awareness indicator; internal values are debug-only', () => {
  const G = require('../paths.js'); const txt = f => fs.readFileSync(path.join(G, f), 'utf8');
  const bad = /(rage|suspicion|awareness|aggro|agitation)[ _-]?(bar|meter|icon|indicator)|exclamation|alert icon|detect(ion)? icon/i;
  const hud = txt('hud.js'), ents = txt('ents.js'), dbg = ents.indexOf('d.sm'), gated = /__dlab|debug|Debug/.test(ents.slice(Math.max(0, dbg - 6000), dbg));
  return { ok: !bad.test(hud) && !bad.test(ents) && dbg > 0 && gated, note: `hud.js and ents.js carry no such UI; the smiler's internal values are printed only inside the debug overlay (${dbg > 0 ? 'found, gated' : 'missing'})` };
});
module.exports = S;
