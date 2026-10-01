/* PART 2 / STAGE 2D - the canon Smiler (Backrooms Wikidot, Entity 3; the approved Canon Lock).   node dev/tests/run.js s_smiler.js
 * Canon behaviour
 *   SM01 a light draws it and a light carrier it sees is chased (after a wind-up); the same person in the dark is watched, not chased
 *   SM02 it strikes only on the canon triggers: a fast retreat in front of it (panic) or a loud noise close by; a quiet, still person is not struck
 *   SM03 eye contact holds it; backing away slowly while watching it gets you let go
 * Evidence law / required tests (stage 2D brief)
 *   SM04 (1) no hidden position: an unsensed player moved elsewhere -> identical Smiler decisions, tick by tick
 *   SM05 (2) lost player: it works from where it last had them (with uncertainty), not from where they really went
 *   SM06 (3) light lead: drawn to what it observed; the same observations replayed with the carrier elsewhere -> identical decisions
 *   SM07 (4) wall occlusion: a torch on the far side of a wall draws nothing
 *   SM08 (5) infrared OFF vs HIGH -> identical Smiler decisions
 *   SM09 (6) attention: line of sight required; a one-frame glance does nothing; sustained eye contact holds it
 *   SM10 (7) hold is counterplay, not immunity: it creeps in and drifts (keep finding it), losing its eyes up close escalates, and up close a
 *        small sound (one walking step) becomes a trigger - a careful crouched shuffle still does not
 *   SM11 (8) multiplayer: one watches it in the dark while another walks with a light - it works on the light, no flicker; a lit player
 *        behind walls it has never seen never wins
 *   SM12 (9) personality: bounded, deterministic per seed, no extreme tiers
 *   SM13 (10) state validity over long mixed runs: finite, valid targets and states, legal transitions, never inside walls, never stuck forever
 *   SM14 no teleporting: bounded movement every tick (walked, not jumped)
 *   SM16 multiplayer: a light elsewhere draws it off somebody it only watches in the dark (once); eye contact keeps it
 *   SM17 close-range pressure (v23.1.2): eye contact does not let you walk up to it; standing still / side-stepping is not punished
 *   SM15 presentation: no limbs drawn; the face's glow has its own channel (not the generic alpha); no aggression UI outside debug */
'use strict';
const fs = require('fs'), path = require('path');
const { World, DT, dist, LONG, geo, over, rate, avg, TAU, pick, tracker } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const LY = LONG.y;

/* a dark cell for the player and another dark cell with a clear line to it, `lo`..`hi` px away */
function darkPair(i, lo = 450, hi = 800, need = {}) {
  const G = geo(), g = G.g;
  for (let k = 0; k < 400; k++) {
    const p = G.dark[(i * 131 + k * 17) % G.dark.length]; if (!p || !G.ad.clear(p.x, p.y, 24, 'walk')) continue;
    const cand = G.dark.filter(c => { const d = Math.hypot(c.x - p.x, c.y - p.y); return d >= lo && d <= hi && g.los(c.x, c.y, p.x, p.y) && G.ad.clear(c.x, c.y, 24, 'walk'); });
    if (!cand.length) continue;
    const s = cand[(i * 7) % cand.length];
    if (need.room && G.arcs(p.x, p.y).frac < .25) continue;
    return { p, s };
  }
  return null;
}
/* a player in the dark (blackout: no lamps), a smiler in another dark spot with a view of them.  o.face: the player keeps looking at it */
function setup(seed, o = {}) {
  const pr = darkPair(seed, o.lo || 450, o.hi || 800, o); if (!pr) return null;
  const w = World(seed + 1000); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
  const p = w.player(pr.p.x, pr.p.y, { light: !!o.light }); p.stop(o.mode || 'stand');
  const s = w.smiler(pr.s.x, pr.s.y); s.ang = Math.atan2(pr.p.y - pr.s.y, pr.p.x - pr.s.x);
  if (o.face) p.look = () => Math.atan2(s.y - p.y, s.x - p.x); else p.look = o.lookAway ? () => Math.atan2(s.y - p.y, s.x - p.x) + Math.PI : Math.atan2(pr.s.y - pr.p.y, pr.s.x - pr.p.x) + 1.6;
  return { w, p, s, pr };
}
/* run and record the smiler's state / act changes; stop at a capture */
function watchRun(w, s, p, secs, each) {
  const tl = []; let last = '', strikes = 0, chases = 0, caughtAt = -1;
  w.run(secs, (ww, t) => {
    if (each) { const r = each(ww, t); if (r === false) return false; }
    const k = s.state + '/' + s.act; if (k !== last) { tl.push([+t.toFixed(1), k, s.dbg.why]); if (s.state === 'ATTACKING' && !last.startsWith('ATTACKING')) strikes++; if (s.state === 'PROVOKED' && !last.startsWith('PROVOKED')) chases++; last = k; }
    if (p && (p.caught || p.dead)) { caughtAt = t; return false; }
  }, 1);
  return { tl, strikes, chases, caughtAt, states: new Set(tl.map(x => x[1].split('/')[0])) };
}
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

add('SM01 light: a light carrier it can see is chased after a wind-up; the same person without a light is watched, not chased', () => {
  const lit = [], dark = [];
  for (const i of SEEDS) {
    const A = setup(i, { light: true, face: false }); if (A) { const R = watchRun(A.w, A.s, A.p, 25); const first = R.tl.find(x => x[1].startsWith('PROVOKED')); lit.push({ chased: !!first, at: first ? first[0] : -1 }); }
    const B = setup(i, { light: false, face: false }); if (B) { let seen = false; const R = watchRun(B.w, B.s, B.p, 25, () => { if (B.s.mem.p.has(B.p.id)) seen = true; }); dark.push({ chased: R.chases > 0, strikes: R.strikes, watched: R.states.has('WATCHING'), seen, d: Math.round(dist(B.s, B.p)) }); }
  }
  // (in a blackout its sight of an unlit person is short: darkness is not omniscience - at the far end of the range some are never perceived at all)
  const ch = lit.filter(r => r.chased), wind = avg(ch.map(r => r.at)), per = dark.filter(r => r.seen);
  return { ok: lit.length >= 6 && ch.length / lit.length >= .8 && wind >= 1.5 && dark.every(r => !r.chased && r.strikes === 0) && per.length >= 4 && per.filter(r => r.watched).length / per.length >= .8,
    note: `light on, in its view, standing: chased ${ch.length}/${lit.length} (wind-up before the chase avg ${wind.toFixed(1)} s); light off, same spot: chased ${dark.filter(r => r.chased).length}/${dark.length}, struck ${dark.filter(r => r.strikes).length}, perceived at all ${per.length}/${dark.length} (not perceived at ${dark.filter(r => !r.seen).map(r => r.d + ' px').join(', ') || '-'}), watched ${per.filter(r => r.watched).length}/${per.length} of those` };
});

add('SM02 strikes only on canon triggers: a quiet still person is never struck; a fast retreat in front of it (panic) or a loud noise close by is', () => {
  const quiet = [], panic = [], noise = [];
  for (const i of SEEDS) {
    const A = setup(i, { light: false, face: i % 2 === 0, lookAway: i % 2 === 1 }); if (A) { const R = watchRun(A.w, A.s, A.p, 40); quiet.push(R.strikes === 0 && R.caughtAt < 0); }
    const B = setup(i, { light: false, lo: 300, hi: 450 }); if (B) { const { w, p, s } = B; let fled = -1;
      const R = watchRun(w, s, p, 14, (ww, t) => { if (fled < 0 && s.state === 'WATCHING' && t > 2) { fled = t; const a = Math.atan2(p.y - s.y, p.x - s.x); p.go(p.x + Math.cos(a) * 1200, p.y + Math.sin(a) * 1200, 'run'); } });
      panic.push({ struck: R.strikes > 0, why: (R.tl.find(x => x[1].startsWith('ATTACKING')) || [])[2] || '' }); }
    const C = setup(i, { light: false, lo: 280, hi: 420 }); if (C) { const { w, p, s } = C; let made = false;
      const R = watchRun(w, s, p, 8, (ww, t) => { if (!made && t > 2.5 && s.state === 'WATCHING') { made = true; p.evq.push([26, 100]); } });   // a hard landing (the client's own noise event)
      noise.push({ struck: R.strikes > 0, why: (R.tl.find(x => x[1].startsWith('ATTACKING')) || [])[2] || '' }); }
  }
  return { ok: quiet.length >= 6 && quiet.every(Boolean) && rate(panic, r => r.struck) >= .7 && rate(noise, r => r.struck) >= .7,
    note: `quiet and still (looking at it or away), 40 s: struck ${quiet.filter(q => !q).length}/${quiet.length}; ran away in front of it: struck ${panic.filter(r => r.struck).length}/${panic.length} ("${(panic.find(r => r.struck) || {}).why}"); a hard landing close by: struck ${noise.filter(r => r.struck).length}/${noise.length} ("${(noise.find(r => r.struck) || {}).why}")` };
});

add('SM03 eye contact: watched, it holds; backing away slowly while watching it gets you let go (it withdraws, no strike)', () => {
  const rs = [];
  for (const i of SEEDS) {
    const A = setup(i, { light: false, face: true, lo: 350, hi: 600, room: true }); if (!A) continue; const { w, p, s } = A; let held = false, backing = false;
    const R = watchRun(w, s, p, 30, (ww, t) => {
      if (/hold|creep|drift/.test(s.act)) held = true;
      if (held && !backing && t > 3) { backing = true; const a = Math.atan2(p.y - s.y, p.x - s.x); p.pathTo(p.x + Math.cos(a) * 900, p.y + Math.sin(a) * 900, 'crouch') || p.go(p.x + Math.cos(a) * 900, p.y + Math.sin(a) * 900, 'crouch'); }
    });
    const letGo = R.tl.some(x => x[1].startsWith('DISAPPEARING') && /let P/.test(x[2]));
    rs.push({ held, letGo, safe: R.strikes === 0 && R.caughtAt < 0 });
  }
  return { ok: rs.length >= 6 && rate(rs, r => r.held) >= .8 && rate(rs, r => r.safe) >= .8 && rate(rs, r => r.letGo) >= .5,
    note: `${rs.length} runs: held by eye contact ${rs.filter(r => r.held).length}, unharmed while backing away crouched and watching it ${rs.filter(r => r.safe).length}, let go (it withdrew, "let ... go") ${rs.filter(r => r.letGo).length}` };
});

/* SM04 - one smiler working on a decoy it can see; a third player stands silent, lightless and far out of sight at one of two places */
function smTrace(seed, hidden, secs, hook, lightOn) {
  const w = World(seed); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
  const s = w.smiler(5200, LY); s.ang = 0;
  const d = w.player(5650, LY, { light: lightOn !== false }); d.route([{ x: 6100, y: LY }, { x: 5800, y: LY }, { x: 6300, y: LY }], 'walk');
  const q = w.player(hidden.x, hidden.y, { light: false }); q.stop('stand');
  if (hook) w.eng.obsHook = hook;
  const tr = []; let sensed = false;
  w.run(secs, () => { if (s.mem.p.has(q.id)) sensed = true; tr.push(`${s.x.toFixed(4)},${s.y.toFixed(4)},${s.state},${s.act},${s.target},${s.ag.toFixed(4)},${s.goalS ? s.goalS.x.toFixed(2) + ',' + s.goalS.y.toFixed(2) : '-'}`); if (d.dead) return false; }, 1);
  return { tr, sensed };
}
add('SM04 no hidden position: an unsensed player moved elsewhere changes nothing the Smiler does (tick by tick)', () => {
  const G = geo(), far = G.dark.filter(c => G.ad.clear(c.x, c.y, 24, 'walk') && Math.hypot(c.x - 5600, c.y - LY) > 2200);
  let valid = 0, same = 0; const diffAt = [];
  for (let k = 0; k < 6; k++) {
    const a = far[(k * 37) % far.length], b = far[(k * 37 + 101) % far.length];
    const A = smTrace(30 + k, a, 15), B = smTrace(30 + k, b, 15); if (A.sensed || B.sensed) continue;
    valid++; const i = A.tr.findIndex((x, j) => x !== B.tr[j]); if (i < 0 && A.tr.length === B.tr.length) same++; else diffAt.push(i);
  }
  return { ok: valid >= 4 && same === valid, note: `${valid} valid pairs (hidden player never sensed): identical decisions ${same}/${valid}${diffAt.length ? ' - first difference at ' + diffAt.join(',') : ''} (the placement validator is the one sanctioned system rule; hidden spots are kept > 2200 px from the action)` };
});

add('SM05 lost player: it goes where it last had them (with an uncertainty), not where they really went', () => {
  const rs = [];
  for (const i of SEEDS) {
    const A = setup(i, { light: false, face: false, lo: 380, hi: 650 }); if (!A) continue; const { w, p, s } = A;
    let held = 0; if (w.until(8, () => { const r = s.mem.p.get(p.id); held = s.state === 'WATCHING' && r && r.seen ? held + 1 : 0; return held > 60; }) < 0) continue;   // it has had them in view for a second
    const lastX = p.x, lastY = p.y;
    // the player vanishes from its sight - and (unseen) is moved well away: the smiler must not know.  (The spot stays inside the simulation's
    // near tier - < 1900 px from the smiler - so the engine's distance LOD, a system rule outside its knowledge, does not park it.)
    const G = geo(), spot = G.dark.find(c => Math.hypot(c.x - p.x, c.y - p.y) > 1100 && Math.hypot(c.x - s.x, c.y - s.y) < 1750 && !G.g.los(c.x, c.y, s.x, s.y) && G.ad.clear(c.x, c.y, 24, 'walk'));
    if (!spot) continue;
    p.x = spot.x; p.y = spot.y; p.stop('stand'); p.look = 0;
    let goal = null; w.run(5, () => { if (s.state === 'FOLLOWING' && s.goalS && !goal) goal = { x: s.goalS.x, y: s.goalS.y, u: s.goalS.u, why: s.dbg.why }; }, 1);
    if (!goal) { rs.push({ ok: false, none: true }); continue; }
    const toLast = Math.hypot(goal.x - lastX, goal.y - lastY), toTrue = Math.hypot(goal.x - p.x, goal.y - p.y);
    rs.push({ ok: toLast < 400 && toTrue > 800, toLast: Math.round(toLast), toTrue: Math.round(toTrue), u: Math.round(goal.u), why: goal.why });
  }
  return { ok: rs.length >= 5 && rate(rs) >= .8, note: `${rs.length} losses: it went to look ${rs.map(r => r.none ? 'nowhere' : r.toLast + ' px from the last sighting (±' + r.u + '), ' + r.toTrue + ' px from the truth').join('; ')}` };
});

/* the lit-wall geometry of the 2C evidence tests: a player facing a wall with the torch on, and a spot that sees the lit wall but not the player */
function litWallSetups(n = 10) {
  const G = geo(), g = G.g, ad = G.ad, out = [];
  for (const c of G.walls) {
    if (out.length >= n) break; if (!ad.clear(c.x, c.y, 22, 'walk')) continue;
    const hx = c.x + Math.cos(c.ang) * (c.d - 4), hy = c.y + Math.sin(c.ang) * (c.d - 4); let f = null;
    for (let R = 320; R <= 820 && !f; R += 70) for (let k = 0; k < 24 && !f; k++) {
      const a = k / 24 * TAU, bx = hx + Math.cos(a) * R, by = hy + Math.sin(a) * R;
      if (!ad.clear(bx, by, 28, 'walk') || Math.hypot(bx - c.x, by - c.y) < 300 || !g.los(bx, by, hx, hy)) continue;
      if ([0, 18, -18].some(o => g.los(bx, by, c.x + Math.cos(c.ang + Math.PI / 2) * o, c.y + Math.sin(c.ang + Math.PI / 2) * o))) continue;
      f = { px: c.x, py: c.y, pa: c.ang, bx, by, ba: Math.atan2(hy - by, hx - bx) };
    }
    if (f) out.push(f);
  }
  return out;
}
add('SM06 light lead: drawn to what it observed (an uncertain region), and the same observations replayed with the carrier far away give identical decisions', () => {
  const rs = []; const G = geo(), far = G.dark.filter(c => G.ad.clear(c.x, c.y, 24, 'walk'));
  for (const [k, st] of litWallSetups(10).entries()) {
    const rec = [];
    const run = (replay, where) => {
      const w = World(50 + k); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
      const p = w.player(where.x, where.y, { light: !replay, angle: st.pa }); p.stop('stand'); p.look = st.pa;
      const dq = w.player(decoy.x, decoy.y, { light: false }); dq.stop('stand');
      const s = w.smiler(st.bx, st.by); s.ang = st.ba;
      let i = 0; w.eng.obsHook = (e, obs) => { if (e !== s) return obs; if (!replay) { rec.push(JSON.parse(JSON.stringify(obs))); return obs; } return JSON.parse(JSON.stringify(rec[i++] || [])); };
      const tr = []; let sensedAt = -1, drawn = null;
      w.run(6, () => { if (sensedAt < 0 && (s.mem.p.has(p.id) || s.mem.p.has(dq.id))) sensedAt = tr.length; if (!drawn && sensedAt < 0 && s.state === 'FOLLOWING' && s.goalS) drawn = { x: s.goalS.x, y: s.goalS.y, u: s.goalS.u, k: s.goalS.k }; tr.push(`${s.x.toFixed(4)},${s.y.toFixed(4)},${s.state},${s.act},${s.goalS ? s.goalS.x.toFixed(2) : '-'}`); }, 1);
      return { tr, sensedAt, drawn };
    };
    const decoy = far.find(c => { const d = Math.hypot(c.x - st.bx, c.y - st.by); return d > 500 && d < 1300 && !G.g.los(c.x, c.y, st.bx, st.by); }); if (!decoy) continue;
    const A = run(false, { x: st.px, y: st.py });
    const elsewhere = far.find(c => Math.hypot(c.x - st.px, c.y - st.py) > 2500 && Math.hypot(c.x - st.bx, c.y - st.by) > 2500);
    const B = run(true, elsewhere);
    // compare up to the moment the person themselves was first perceived in the live run (from then on it legitimately knows more);
    // the replay must not have perceived anybody in that window either
    const n = A.sensedAt < 0 ? A.tr.length : A.sensedAt;
    if (!A.drawn || n < 6 || (B.sensedAt >= 0 && B.sensedAt < n)) continue;
    rs.push({ same: A.tr.slice(0, n).join('|') === B.tr.slice(0, n).join('|'), n, k: A.drawn.k, u: Math.round(A.drawn.u), off: Math.round(Math.hypot(A.drawn.x - st.px, A.drawn.y - st.py)) });
  }
  return { ok: rs.length >= 5 && rs.every(r => r.same) && rs.every(r => r.u >= 120), note: `${rs.length} runs where it was drawn by a light it saw without the person: identical decisions with the carrier moved away ${rs.filter(r => r.same).length}/${rs.length} (compared until the person was first perceived: ${rs.map(r => (r.n / 60).toFixed(1) + ' s').join(', ')}); leads ${rs.map(r => r.k + ' ±' + r.u + ' (' + r.off + ' px from the carrier)').join(', ')}` };
});

add('SM07 wall occlusion: a torch lighting the far side of a wall draws nothing; the smiler stays where it is', () => {
  const G = geo(), g = G.g; let n = 0, moved = 0, leads = 0;
  for (const c of G.walls.filter((q, i) => i % 5 === 0).slice(0, 30)) {
    let far = null; for (let t = c.d + 20; t < c.d + 400; t += 12) { const x = c.x + Math.cos(c.ang) * t, y = c.y + Math.sin(c.ang) * t; if (G.ad.clear(x, y, 28, 'walk') && !g.los(c.x, c.y, x, y)) { far = { x, y }; break; } }
    if (!far) continue; n++;
    const w = World(8); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
    const p = w.player(c.x, c.y, { light: true, angle: c.ang }); p.stop('stand'); p.look = c.ang;
    const s = w.smiler(far.x, far.y); s.ang = c.ang + Math.PI;
    w.run(4, null); if (s.mem.leads.length) leads++; if (s.state !== 'HIDDEN') moved++;
  }
  return { ok: n >= 10 && leads === 0 && moved === 0, note: `${n} setups: light leads through the wall ${leads}; smilers that left their spot ${moved}` };
});

add('SM08 infrared OFF vs HIGH: identical Smiler decisions (camcorders raised, infrared written everywhere a client could put it)', () => {
  const rs = over([1, 2, 3], s => {
    const run = ir => { const w = World(s), sm = w.smiler(5300, LY); sm.ang = 0; const ps = [w.player(5800, LY, { light: true, kind: 'camcorder', angle: Math.PI }), w.player(6200, LY, { light: true, kind: 'flashlight', angle: Math.PI })]; ps[0].go(5000, LY, 'walk'); ps[1].stop('stand');
      const tr = []; w.run(20, () => { for (const p of ps) if (p.equipment.kind === 'camcorder') { p.ir = ir; p.irNet = ir; p.nv = ir > 0; p.nvOn = ir > 0; } tr.push(`${sm.x.toFixed(4)},${sm.y.toFixed(4)},${sm.state},${sm.act},${sm.target},${sm.ag.toFixed(4)}`); }, 1); return tr; };
    const A = run(0), B = run(2); const i = A.findIndex((x, j) => x !== B[j]); return { ok: i < 0, at: i, n: A.length };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/${rs.length} worlds identical over ${rs[0].n} ticks` };
});

add('SM09 attention: a one-frame glance does nothing; through a wall nothing; sustained eye contact (with line of sight) holds it', () => {
  const glance = [], sustained = [];
  for (const i of SEEDS) {
    const A = setup(i, { light: false, face: false, lo: 350, hi: 600 }); if (!A) continue; const { w, p, s } = A;
    if (w.until(4, () => s.state === 'WATCHING') < 0) continue;
    const away = p.look; let maxT = 0, holdAct = false;
    w.run(3, (ww, t) => { const tick = Math.round(t / DT); p.look = tick % 45 === 0 ? Math.atan2(s.y - p.y, s.x - p.x) : away; const a = s.att.get(p.id); if (a) maxT = Math.max(maxT, a.t); if (/hold|creep|drift/.test(s.act)) holdAct = true; }, 1);
    glance.push(!holdAct && maxT < .4);
    p.look = () => Math.atan2(s.y - p.y, s.x - p.x); let held = false; w.run(3, () => { if (/hold|creep|drift/.test(s.act)) held = true; }, 1); sustained.push(held);
  }
  // through a wall: the E8 geometry - player facing the smiler's side of a wall
  const G = geo(), g = G.g; let walled = 0, wn = 0;
  for (const c of G.walls.filter((q, i) => i % 2 === 0).slice(0, 80)) {
    if (wn >= 16) break;
    let far = null; for (let t = c.d + 20; t < c.d + 400; t += 12) { const x = c.x + Math.cos(c.ang) * t, y = c.y + Math.sin(c.ang) * t; if (G.ad.clear(x, y, 28, 'walk') && !g.los(c.x, c.y, x, y)) { far = { x, y }; break; } }
    if (!far) continue; wn++;
    const w = World(9); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true; const p = w.player(c.x, c.y, { light: false }); p.stop('stand'); p.look = c.ang;
    const s = w.smiler(far.x, far.y); s.ang = c.ang + Math.PI; w.run(2, null); const a = s.att.get(p.id); if ((a && a.t > 0) || /hold|creep|drift/.test(s.act)) walled++;
  }
  return { ok: glance.length >= 5 && glance.every(Boolean) && rate(sustained.map(x => ({ ok: x }))) >= .8 && wn >= 6 && walled === 0,
    note: `one-frame glances every 0.75 s: no hold ${glance.filter(Boolean).length}/${glance.length}; sustained eye contact: held ${sustained.filter(Boolean).length}/${sustained.length}; through a wall: attention registered ${walled}/${wn}` };
});

add('SM10 hold is counterplay, not immunity: standing and staring, it creeps in and drifts sideways; a fixed gaze loses it; up close a small sound triggers it', () => {
  const rs = [];
  for (const i of SEEDS) {
    const A = setup(i, { light: false, face: true, lo: 420, hi: 650, room: true }); if (!A) continue; const { w, p, s } = A;
    const d0 = dist(s, p); let minD = 1e9, drift = false, withdrew = false;
    w.run(22, () => { minD = Math.min(minD, dist(s, p)); if (s.act === 'drift') drift = true; if (s.state === 'DISAPPEARING') withdrew = true; }, 1);
    const crept = d0 - minD;
    // keep the gaze fixed where it was (no re-aiming): the drift takes it out of the eye cone and the hold breaks
    const fixed = Math.atan2(s.y - p.y, s.x - p.x); p.look = fixed; let broke = false; w.run(12, () => { const a = s.att.get(p.id); if (a && a.t === 0) broke = true; }, 1);
    // up close and agitated (eyes back on it): a careful crouched shuffle stays below its hearing (stealth still works); one ordinary walking step
    // sideways - a small sound, not a loud one - is now enough
    s.ag = Math.max(s.ag, .8); p.look = () => Math.atan2(s.y - p.y, s.x - p.x); let shuffleStruck = false, struck = false, near = false, shWhy = '';
    if (dist(s, p) < 200) { near = true; const side = Math.atan2(s.y - p.y, s.x - p.x) + Math.PI / 2;    // square to where it is now (not toward it)
      p.go(p.x + Math.cos(side) * 60, p.y + Math.sin(side) * 60, 'crouch'); w.run(2.5, () => { if ((s.state === 'ATTACKING' || p.caught) && !shuffleStruck) { shuffleStruck = true; shWhy = s.dbg.why; } }, 1);
      if (!shuffleStruck) { s.ag = Math.max(s.ag, .8); p.go(p.x - Math.cos(side) * 90, p.y - Math.sin(side) * 90, 'walk'); w.run(2.5, () => { if (s.state === 'ATTACKING' || p.caught) struck = true; }, 1); } }
    rs.push({ crept: Math.round(crept), drift, withdrew, broke, near, shuffleStruck, shWhy, struck, close: Math.round(minD) });
  }
  const nr = rs.filter(r => r.near);
  return { ok: rs.length >= 5 && rate(rs, r => r.crept > 150 && !r.withdrew) >= .8 && rate(rs, r => r.drift) >= .7 && rate(rs, r => r.broke) >= .7 && nr.length >= 4 && rate(nr, r => !r.shuffleStruck) >= .75 && rate(nr, r => r.struck) >= .75,
    note: `${rs.length} stand-offs: it closed in (avg ${avg(rs.map(r => r.crept)) | 0} px, to ${avg(rs.map(r => r.close)) | 0} px) and did not go away while watched ${rs.filter(r => r.crept > 150 && !r.withdrew).length}; drifted sideways ${rs.filter(r => r.drift).length}; a fixed gaze lost it ${rs.filter(r => r.broke).length}; up close (${nr.length}): a crouched shuffle set it off ${nr.filter(r => r.shuffleStruck).length}${nr.some(r => r.shWhy) ? ' ("' + nr.find(r => r.shWhy).shWhy + '")' : ''}, then one walking step set it off ${nr.filter(r => r.struck).length}` };
});

add('SM11 multiplayer: one watches it in the dark, another walks about with a light - it works on the light, settles (no flicker), and a lit player it has never seen never wins', () => {
  const rs = [];
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    const A = setup(i, { light: false, face: true, lo: 350, hi: 600, room: true }); if (!A) continue; const { w, p, s } = A;
    const G = geo(), g = G.g, toP = Math.atan2(p.y - s.y, p.x - s.x);
    // the light carrier: somewhere the smiler's eyes reach (in front of it, line of sight), pacing with the torch on
    const spot = G.dark.find(c => { const d = Math.hypot(c.x - s.x, c.y - s.y); return d > 280 && d < 700 && g.los(c.x, c.y, s.x, s.y) && Math.abs(Math.atan2(Math.sin(Math.atan2(c.y - s.y, c.x - s.x) - toP), Math.cos(Math.atan2(c.y - s.y, c.x - s.x) - toP))) < 1 && Math.hypot(c.x - p.x, c.y - p.y) > 250 && G.ad.clear(c.x, c.y, 24, 'walk'); });
    if (!spot) continue;
    const b = w.player(spot.x, spot.y, { light: true }); const pace = G.dark.find(c => { const d = Math.hypot(c.x - spot.x, c.y - spot.y); return d > 120 && d < 260 && g.los(c.x, c.y, spot.x, spot.y) && G.ad.clear(c.x, c.y, 24, 'walk'); }) || spot;
    b.route([{ x: pace.x, y: pace.y }, { x: spot.x, y: spot.y }], 'walk');
    // a third player with a light behind walls, out of its view
    const hidden = G.dark.find(c => Math.hypot(c.x - s.x, c.y - s.y) < 900 && Math.hypot(c.x - s.x, c.y - s.y) > 300 && !g.los(c.x, c.y, s.x, s.y) && G.ad.clear(c.x, c.y, 24, 'walk'));
    const h = hidden ? w.player(hidden.x, hidden.y, { light: true }) : null; if (h) { h.stop('stand'); h.look = () => Math.atan2(s.y - h.y, s.x - h.x); }
    let switches = 0, quick = 0, last = 0, since = 0, onB = 0, onHunseen = 0, hSeen = false, lastSeen = false;
    w.run(15, (ww, t) => {
      if (h && s.seenNow.has(h.id)) hSeen = true;                     // (once it has really seen them, they are a fair target)
      if (s.target && s.target !== last) { if (last) { switches++; if (t - since < 2.9 && lastSeen) quick++; } last = s.target; since = t; }   // (a switch after it lost the last one is not flicker)
      lastSeen = !!(last && s.mem.p.get(last) && s.mem.p.get(last).seen);
      if (s.target === b.id) onB++; if (h && s.target === h.id && !hSeen) onHunseen++; if (b.dead || p.dead) return false;
    }, 1);
    rs.push({ ok: onB > 0 && onHunseen === 0 && quick === 0, switches, quick, onB, onHunseen, hSeen });
  }
  return { ok: rs.length >= 5 && rate(rs) >= .8 && rs.every(r => r.onHunseen === 0), note: `${rs.length} runs: worked on the light carrier ${rs.filter(r => r.onB > 0).length}; targeted the lit player behind walls before ever seeing them ${rs.filter(r => r.onHunseen > 0).length} (saw them later, legitimately: ${rs.filter(r => r.hSeen).length}); target switches ${rs.map(r => r.switches).join(',')} (inside the 3 s dwell while the old one was still in view: ${rs.reduce((a, r) => a + r.quick, 0)})` };
});

add('SM12 personality: bounded, deterministic per seed, and no extreme tiers', () => {
  const w = World(31), G = geo(), c = G.dark[5]; const P = [];
  for (let i = 0; i < 200; i++) { const e = w.eng.spawn('smiler', c.x, c.y); P.push(e.pz); w.eng.remove(e.id); }
  const inB = P.every(z => Object.values(z).every(v => v >= .02 && v <= .98));
  const span = k => { const v = P.map(z => z[k]); return [Math.min(...v), Math.max(...v)]; };
  const a = World(77).eng.spawn('smiler', c.x, c.y).pz, b = World(77).eng.spawn('smiler', c.x, c.y).pz;
  const chaseAt = P.map(z => Math.min(.74, Math.max(.5, .62 - .2 * (z.bold - .5))));
  return { ok: inB && JSON.stringify(a) === JSON.stringify(b) && Math.max(...chaseAt) - Math.min(...chaseAt) < .1 && span('patience')[1] - span('patience')[0] < .3,
    note: `200 individuals: all in [0.02, 0.98] ${inB}; same seed -> same creature ${JSON.stringify(a) === JSON.stringify(b)}; patience ${span('patience').map(v => v.toFixed(2)).join('-')}, boldness ${span('bold').map(v => v.toFixed(2)).join('-')}; chase threshold ${Math.min(...chaseAt).toFixed(2)}-${Math.max(...chaseAt).toFixed(2)}` };
});

const ALLOWED = { HIDDEN: ['WATCHING', 'FOLLOWING', 'DISAPPEARING', 'ATTACKING', 'PLAYING'], FOLLOWING: ['WATCHING', 'FOLLOWING', 'DISAPPEARING', 'HIDDEN', 'ATTACKING', 'PLAYING'],
  WATCHING: ['PROVOKED', 'FOLLOWING', 'DISAPPEARING', 'ATTACKING', 'WATCHING', 'HIDDEN', 'PLAYING'], PROVOKED: ['WATCHING', 'FOLLOWING', 'DISAPPEARING', 'PLAYING', 'ATTACKING', 'HIDDEN'],
  ATTACKING: ['PROVOKED', 'WATCHING', 'FOLLOWING', 'DISAPPEARING', 'PLAYING', 'HIDDEN'], DISAPPEARING: ['HIDDEN', 'WATCHING', 'FOLLOWING', 'ATTACKING', 'PLAYING'], PLAYING: ['WATCHING', 'DISAPPEARING', 'HIDDEN', 'ATTACKING'] };
add('SM13 state validity over long mixed runs: finite, valid targets and states, legal transitions, never inside walls, never stuck', () => {
  let bad = [], ticks = 0, trans = 0, longest = 0; const seen = new Set();
  for (const sd of [1, 2, 3, 4]) {
    const w = World(sd); const G = geo(); const sms = [w.smiler(G.dark[3 * sd].x, G.dark[3 * sd].y), w.smiler(5200, LY), w.smiler(7400, LY)];
    const ps = [w.player(5000, LY, { light: true }), w.player(6000, LY, { light: false }), w.player(7000, LY, { light: true, kind: 'lantern' })];
    ps[0].route([{ x: 6500, y: LY }, { x: 4000, y: LY }, { x: 7600, y: LY }], 'walk'); ps[1].route([{ x: 4300, y: LY }, { x: 7200, y: LY }], 'crouch'); ps[2].stop('stand');
    const prev = new Map(), since = new Map();
    w.run(150, (ww, t) => {
      ticks++; if (Math.floor(t * 2) % 23 === 0) ps[2].light = !ps[2].light;
      for (const p of ps) if (p.dead && p.respawnAt === undefined) p.respawnAt = t + 3; for (const p of ps) if (p.dead && t > p.respawnAt) { w.sim.respawn(p); p.respawnAt = undefined; p.x = 5000; p.y = LY; }
      for (const s of sms) {
        seen.add(s.state);
        if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.ag) || s.ag < 0 || s.ag > 1) bad.push('num');
        if (s.target && !s.mem.p.has(s.target)) bad.push('target');
        if (!s.trav && !w.ad.clear(s.x, s.y, 12, 'walk')) bad.push('wall');
        const pv = prev.get(s); if (pv && pv !== s.state) { trans++; if (!(ALLOWED[pv] || []).includes(s.state)) bad.push(pv + '->' + s.state); since.set(s, t); }
        prev.set(s, s.state); if (!since.has(s)) since.set(s, t); if (s.state !== 'HIDDEN') longest = Math.max(longest, t - since.get(s));
      }
    }, 2);
  }
  return { ok: bad.length === 0 && trans > 20 && longest < 120, note: `${ticks} samples, ${trans} transitions, states seen ${[...seen].join(' ')}; problems ${bad.length}${bad.length ? ' (' + [...new Set(bad)].slice(0, 6).join(', ') + ')' : ''}; longest time in one active state ${longest.toFixed(0)} s` };
});

add('SM14 no teleporting: every move is walked (bounded per tick), whatever it is doing', () => {
  let worst = 0, at = null, n = 0;
  for (let i = 1; i <= 10; i++) {
    const A = setup(i, { light: i % 2 === 0, lo: 400, hi: 800 }); if (!A) continue; const { w, p, s } = A; n++;
    p.route([{ x: p.x + 180, y: p.y }, { x: p.x - 200, y: p.y + 60 }, { x: p.x, y: p.y - 150 }], i % 3 ? 'walk' : 'run');
    const T = tracker(w, s); w.run(90, () => { T.tick(); if (p.dead) return false; }, 1);
    if (T.jump > worst) { worst = T.jump; at = T.jumpAt; }
  }
  return { ok: n >= 8 && worst < 9, note: `${n} runs of 90 s: biggest single-tick step ${worst.toFixed(1)} px (${(worst * 60) | 0} px/s)${at ? ' @' + JSON.stringify(at) : ''}` };
});

add('SM15 presentation: no limbs; the face glow is its own channel (not the generic entity alpha); no aggression UI outside debug', () => {
  const G = require('../paths.js'); const txt = f => fs.readFileSync(path.join(G, f), 'utf8'); const ents = txt('ents.js'), hud = txt('hud.js');
  const sm = ents.slice(ents.indexOf('E.drawSmiler = function'), ents.indexOf('E.smilerGlow = function')), glow = ents.slice(ents.indexOf('E.smilerGlow = function'), ents.indexOf('};', ents.indexOf('E.smilerGlow = function')));
  const noArms = !/quadraticCurveTo\(ex \+ sx \* 8/.test(sm) && /ag\.alpha = 0/.test(sm), noLegs = !/-13, 58, -7, 60/.test(sm), glowOwn = !/view\.alpha/.test(glow);
  const bad = /(rage|suspicion|awareness|aggro|agitation)[ _-]?(bar|meter|icon|indicator)|exclamation|alert icon|detect(ion)? icon/i;
  // 2E adds Hound labels before d.sm. A fixed 6000-character lookback was not a debug gate test.
  // Check the actual draw call boundary and execute the overlay with debug off and no DOM.
  const overlay = txt('dev/ents_src/40_debug.js'), entry = overlay.slice(overlay.indexOf('E.drawDebug = function'));
  const label = overlay.indexOf('if (d.sm)'), draw = overlay.indexOf('function drawEntities('), end = overlay.indexOf('function drawEvidence(');
  const probe = {}; require('vm').runInNewContext(overlay.replace(/\}\)\(\);\s*$/, ''), { E: probe, window: {}, performance: { now: () => 0 } }); // fragment closes the bundle's outer IIFE
  probe.dbg = new Proxy([], { get() { throw Error('debug-off overlay read private entity data'); } });
  probe.drawDebug(null, { W: 100, H: 100 });
  const gated = label > draw && label < end && entry.indexOf('if (!on) return;') < entry.indexOf('drawEntities(cx, view, list, cfg, stale)') && /if \(cfg.ai && list && list.length\) drawEntities/.test(entry) && (overlay.match(/drawEntities\(/g) || []).length === 2;
  return { ok: noArms && noLegs && glowOwn && !bad.test(hud) && !bad.test(ents) && gated, note: `arms drawn ${!noArms}, legs drawn ${!noLegs}; glow reads the generic alpha ${!glowOwn}; aggression UI ${bad.test(hud) || bad.test(ents)}; internal values debug-only ${gated}` };
});

add('SM16 multiplayer: a light elsewhere draws it off somebody it only watches in the dark (once - no back-and-forth); eye contact keeps it', () => {
  const run = (i, face) => {
    const A = setup(i, { light: false, lookAway: !face, face, lo: 350, hi: 550 }); if (!A) return null; const { w, p, s } = A; const G = geo(), g = G.g;
    const sp = G.dark.find(c => { const d = Math.hypot(c.x - s.x, c.y - s.y); return d > 1000 && d < 1500 && g.los(c.x, c.y, s.x, s.y) && G.ad.clear(c.x, c.y, 24, 'walk'); }); if (!sp) return null;
    w.run(3, null, 1); if (s.state !== 'WATCHING' || s.target !== p.id) return null;
    const b = w.player(sp.x, sp.y, { light: true }); b.stop('stand'); b.look = () => Math.atan2(s.y - b.y, s.x - b.x) + .25;     // too far for its eyes to make out the person: only the light
    let pulls = 0; w.run(15, () => { if (s.state === 'FOLLOWING' && /drew it off/.test(s.dbg.why) && !s._c) { pulls++; s._c = 1; } if (s.state !== 'FOLLOWING') s._c = 0; if (b.dead) return false; }, 1);
    return { pulls, onB: s.target === b.id || b.dead };
  };
  const un = [], held = [];
  for (let i = 1; i <= 16; i++) { const a = run(i, false); if (a) un.push(a); const h = run(i, true); if (h) held.push(h); }
  return { ok: un.length >= 8 && un.filter(r => r.pulls).length >= 3 && un.every(r => r.pulls <= 1) && held.length >= 6 && held.every(r => r.pulls === 0),
    note: `not watched back (${un.length}): drawn off to the light ${un.filter(r => r.pulls).length}, of which went on to the carrier ${un.filter(r => r.pulls && r.onB).length}; pulled more than once ${un.filter(r => r.pulls > 1).length}; held by eye contact (${held.length}): drawn off ${held.filter(r => r.pulls).length}` };
});

add('SM17 close-range pressure: holding its eyes does not let you walk up to it - walking, crouching or inching in on it ends in a strike; standing still or backing away does not', () => {
  const R = {}; const modes = ['walk', 'crouch', 'inch', 'still', 'sidestep'];
  for (const mode of modes) { R[mode] = [];
    for (let i = 1; i <= 8; i++) {
      const A = setup(i, { light: false, face: true, lo: 380, hi: 600, room: true }); if (!A) continue; const { w, p, s } = A;
      if (w.until(6, () => /hold|creep|drift/.test(s.act)) < 0) continue;
      let struck = null, minD = 1e9, k = 0;
      w.run(30, (ww, t) => {
        const d = dist(s, p), ux = (s.x - p.x) / d, uy = (s.y - p.y) / d; minD = Math.min(minD, d);
        if (mode === 'walk' || mode === 'crouch') { if (d > 40 && k++ % 20 === 0) p.go(s.x, s.y, mode); }
        else if (mode === 'inch') { if (k++ % 240 === 0) p.go(p.x + ux * 35, p.y + uy * 35, 'crouch'); }        // 35 px crouched, then a 4 s pause, again and again
        else if (mode === 'sidestep') { if (k++ % 240 === 0) { const sd = (k / 240) % 2 ? 1 : -1; p.go(p.x - uy * 40 * sd, p.y + ux * 40 * sd, 'crouch'); } }   // re-positioning sideways only
        if (s.state === 'ATTACKING' && !struck) struck = { d: Math.round(d), why: s.dbg.why };
        if (p.dead || struck) return false;
      }, 1);
      R[mode].push({ struck: !!struck, d: struck ? struck.d : Math.round(minD), why: struck ? struck.why : '' });
    }
  }
  const r = m => R[m].filter(x => x.struck).length, n = m => R[m].length;
  const ok = modes.every(m => n(m) >= 6) && ['walk', 'crouch', 'inch'].every(m => r(m) / n(m) >= .8) && r('still') === 0 && r('sidestep') === 0 && R.walk.filter(x => x.struck).every(x => x.d >= 90);
  return { ok, note: `holding eye contact the whole time - walked at it: struck ${r('walk')}/${n('walk')} (at ${avg(R.walk.filter(x => x.struck).map(x => x.d)) | 0} px, "${(R.walk.find(x => x.why) || {}).why}"); crouched at it: ${r('crouch')}/${n('crouch')}; inched in (35 px, 4 s pauses): ${r('inch')}/${n('inch')}; stood still while it crept in: ${r('still')}/${n('still')}; side-stepped only: ${r('sidestep')}/${n('sidestep')}` };
});

S.helpers = { darkPair, setup, watchRun, litWallSetups };
module.exports = S;
