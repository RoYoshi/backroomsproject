/* SKIN-STEALER: the owner's additional refinement (October 22; dev/trial-3-r9-overhaul/AP_AUDIT.md; Trial 3 is not owner-approved) -
 * active perception, reactive aggression, path interruption.  R16d: the plan interruption and preemption policy (ai.skin.preempt.js) and
 * the hunger-dependent aggression it rests on.
 *   P01 a person it left, seen again: taken up by hunger - never when fed, after the refractory when hungry, at once when starving
 *   P02 a departure gives way to a new person it may hunt, on the think it sees them; a fast departure (its defence missed) does not
 *   P03 roaming on a long route, a person appears (ahead, in its periphery, one it left a while ago): it reassesses on that think
 *   P04 a committed strike is never cut: a person appearing during the wind-up or the leap changes nothing until the strike is done
 *   P05 a lure or an ambush whose quarry is seen going away is weighed afresh; one whose quarry is coming is kept
 *   P06 no replanning in a loop: evidence that keeps arriving forces at most one reassessment per person every SKP.again seconds
 *   P07 hungry, it prowls instead of standing about: where it perceived prey (its own memory only), and fed as before
 *   P08 the patrol reads no hidden truth: two worlds differing only in where an unsensed person stands are the same to it until it senses them
 *   P09 no oscillation in a live scene: a person flickering in and out of its sight does not make it flip between plans
 * R16e: its eyes (ai.skin.look.js).
 *   P10 a sound: its head starts turning 50-100 ms after it hears it, is on it within 250 ms; its body follows beyond the head's reach
 *       within 150-250 ms; the head is the faster; what the players are sent is the head it sees with
 *   P11 under a plan the head alone turns, and never so far that the quarry it sees leaves its view; never during a strike
 *   P12 movement at the edge of its view is noticed, then seen; standing still is not; behind a wall nothing is; it gives no identity
 *   P13 after a sound it goes to where it could see the place from, then closer - and a hungry one finds the person sooner than R16d
 *   P14 the stealth that still works: crouched and still at its side, unlit, it does not notice them
 * R16f: its footwork (ai.skin.move.js).
 *   P15 circled just out of its spring, it faces them, sidesteps after them and keeps its distance - never faster than its run
 *   P16 somebody trying to slip past it out of a dead end: it takes its place by their way out more often than it did
 *   P17 a feint: a sudden reversal takes it a moment to answer (it does not mirror them), and it answers within a second
 *   P18 the fair race and its stamina: every step at or under its run, the fast ones paid for in stamina
 * The server's own functions are reached through a test-only copy of the built ai.js whose return also names them (the module itself is
 * unchanged; the copy is compiled in memory, never written). */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const { World, DT, LONG, AI, over, bystander, floorNear } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const ROOT = path.join(__dirname, '..', '..');
const INNER = (() => {
  const file = path.join(ROOT, 'generated', 'server', 'ai.js'), src = fs.readFileSync(file, 'utf8'), ret = 'return { create, S, SNAMES,';
  if (src.split(ret).length !== 2) throw new Error('ai.js: its return is not where this test expects it');
  const m = new Module(file + '#ap', module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(src.replace(ret, 'return { skPreempt, skPlanClass, skLeftFor, skRefractory, skPatrolGoal, SKP, skVantage, skPeriph, SKL, visualObservation, SKF, skFight, create, S, SNAMES,'), file);
  return m.exports;
})();
const ARENA = { x: 3960, y: 3384 };
const leaveAs = (w, e, p) => { const h = e.hunger; e.left.set(p.id, w.eng.now + (h < .4 ? 45 : INNER.skLeftFor(h))); (e.leftAt || (e.leftAt = new Map())).set(p.id, w.eng.now); };   // (as skLeave leaves them)
/* did it weigh this person in a decision at or after time t (its decision's own record) */
const weighed = (e, pid, at) => !!(e.dbg.decide && e.dbg.decide.pid === pid && e.dbg.decide.at >= at - 1e-6);
/* the trace of its plans: a change of kind, with when */
function planTrace(e) { const T = { last: '', list: [] }; T.tick = t => { const k = e.plan ? e.plan.k : '-'; if (k !== T.last) { T.list.push([+t.toFixed(2), k]); T.last = k; } }; return T; }

add('P01 a person it left, seen again plainly (R16d; AP_AUDIT E: never taken up, 30-60 s whatever its hunger): it roams east down the long hall with the person lit, walking 500 px ahead of it in plain view - fed (.3) it leaves them alone; mildly hungry (.45) not before its refractory (10 s); hungry (.65 / .75) after 6 s; starving (.95) after 3 s - never before, and within a second once it may', () => {
  const rs = [];
  for (const h of [.3, .45, .65, .75, .95]) rs.push(...over([1, 2, 3], seed => {
    const w = World(seed * 7 + Math.round(h * 100) + 900); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 3700, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    w.run(.3); const p = w.player(4200, LONG.y, { light: true, angle: 0 }); p.stop('stand');
    leaveAs(w, e, p); const t0 = w.eng.now, refr = INNER.skRefractory(h);                // (as after a hunt it gave up: on its list from now)
    e.plan = null; e.hunt = null; e.path = []; if (e.roam) { e.roam.goal = { x: 8400, y: LONG.y }; e.roam.until = w.eng.now + 60; e.roam.pause = 0; }
    let inSight = 0, may = -1, took = -1;
    w.run(20, () => { p.go(Math.min(8600, e.x + 500), LONG.y, 'walk'); p.look = 0;
      const s = e.seenNow.has(p.id); if (s) inSight += DT;
      if (s && may < 0 && w.eng.now - t0 >= refr) may = w.eng.now - t0;
      if (took < 0 && (e.hunt || (e.plan && e.plan.pid === p.id && e.plan.k !== 'leave'))) took = w.eng.now - t0; return took < 0; });
    return { h, seed, inSight: +inSight.toFixed(1), may: may < 0 ? null : +may.toFixed(1), took: took < 0 ? null : +took.toFixed(1), refr };
  }));
  const ok = rs.every(r => !r.err) && rs.every(r => r.h < .4 ? r.took === null && r.inSight > 8 : r.may !== null && r.took !== null && r.took >= r.refr - .05 && r.took - r.may <= 1);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.h}/${r.seed}: in sight ${r.inSight} s, taken up ${r.took === null ? 'never' : r.took + ' s'} after it left them (refractory ${r.refr > 1e6 ? 'none' : r.refr + ' s'})`).join(' | ') };
});

add('P02 a departure gives way (R16d; AP_AUDIT F: below .6 it walked on, at .65 2.3-3.7 s later): on its way out, a new lit person crosses 420 px in front - it weighs them on the think it first sees them (hunger .45 / .55 / .65 / .8), whatever it then chooses; a fast departure (its defence missed) is not cut by sight, and says so', () => {
  const rs = [];
  for (const fast of [false, true]) for (const h of [.45, .55, .65, .8]) rs.push(...over(fast ? [1] : [1, 2, 3], seed => {
    const w = World(seed * 11 + Math.round(h * 100) + 1200); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 4200, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    const q = w.player(3900, LONG.y + 30, { light: true }); q.stop('stand'); w.run(.3);
    const P0 = { k: 'leave', pid: 0, t0: w.eng.now, until: w.eng.now + 20, goal: { x: 8400, y: LONG.y }, why: 'a departure (test)', fast: fast || undefined }; e.plan = P0; leaveAs(w, e, q);
    let p = null, seenAt = -1, weighedAt = -1, cut = -1, chose = '', kept = '';
    w.run(8, (ww, t) => {
      if (t > 1 && !p) { p = w.player(e.x + Math.cos(e.ang) * 420, e.y + Math.sin(e.ang) * 420, { light: true, angle: Math.PI }); p.go(p.x - Math.sin(e.ang) * 400, p.y + Math.cos(e.ang) * 400, 'walk'); }
      if (p && seenAt < 0 && e.seenNow.has(p.id)) seenAt = w.eng.now;
      if (seenAt >= 0 && weighedAt < 0 && weighed(e, p.id, seenAt)) { weighedAt = w.eng.now; chose = e.plan ? e.plan.k : 'roam'; }
      if (seenAt >= 0 && cut < 0 && e.plan !== P0) cut = w.eng.now;
      if (e.dbg.preempt && e.dbg.preempt.kept && !kept) kept = e.dbg.preempt.why;
      return !(seenAt >= 0 && w.eng.now - seenAt > 1.2); });
    return { fast, h, seed, seen: seenAt >= 0, weighed: weighedAt < 0 ? null : +(weighedAt - seenAt).toFixed(2), chose, cut: cut < 0 ? null : +(cut - seenAt).toFixed(2), kept, why: e.dbg.preempt ? e.dbg.preempt.why : '' };
  }));
  const slow = rs.filter(r => !r.fast), fast = rs.filter(r => r.fast);
  const ok = rs.every(r => !r.err && r.seen) && slow.every(r => r.weighed !== null && r.weighed <= .15 && r.cut !== null && r.cut <= .15)
    && fast.every(r => r.cut === null && /departure goes on/.test(r.kept));
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : r.fast ? `fast ${r.h}: ${r.cut === null ? 'kept' : 'CUT after ' + r.cut + ' s'} - "${r.kept}"` : `${r.h}/${r.seed}: weighed ${r.weighed === null ? 'NEVER' : r.weighed + ' s'} after first sight, chose ${r.chose}`).join(' | ') + ` | e.g. "${(slow.find(r => r.why) || {}).why || ''}"` };
});

add('P03 roaming on a long route of its own, a person appears (R16d; the owner: "continues toward predetermined destinations after directly seeing a player") - ahead 520 px, in its periphery 55 degrees off at 450 px, and somebody it left 12 s before (hunger .65 / .95): it weighs them on the think it first sees them and walks on no farther than that think takes', () => {
  const rs = [];
  for (const [where, dx, dy, vx, vy, arena, left] of [['ahead 520', 520, 60, 0, -1, 0, 0], ['periphery 55deg', 258, 369, 1, 0, 1, 0], ['left 12 s ago, ahead 520', 520, 60, 0, -1, 0, 1]]) for (const h of [.65, .95]) rs.push(...over([1, 2], seed => {
    const w = World(seed * 13 + Math.round(h * 100) + dx + (left ? 5 : 0)); bystander(w, 1300, 3300);
    const O = arena ? { x: ARENA.x - 250, y: ARENA.y - 120 } : { x: 3600, y: LONG.y };
    const e = w.eng.spawn('skinstealer', O.x, O.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    let p = null, seenAt = -1, weighedAt = -1, onRoute = 0, lx = e.x, ly = e.y, why = '';
    if (e.roam) { e.roam.goal = { x: arena ? ARENA.x + 900 : 8400, y: O.y }; e.roam.until = w.eng.now + 60; e.roam.pause = 0; }
    w.run(10, (ww, t) => {
      if (t > 2 && !p) { const f = floorNear(w, e.x + dx, e.y + dy) || { x: e.x + dx, y: e.y + dy }; p = w.player(f.x, f.y, { light: true, angle: 0 }); p.go(f.x + vx * 900, f.y + vy * 900, 'walk');
        if (left) { e.left.set(p.id, w.eng.now + 30); (e.leftAt || (e.leftAt = new Map())).set(p.id, w.eng.now - 12); } }   // (left 12 s ago, still on its list - R8 held them 30-60 s)
      if (p && seenAt < 0 && e.seenNow.has(p.id)) seenAt = w.eng.now;
      if (seenAt >= 0 && weighedAt < 0 && weighed(e, p.id, seenAt)) { weighedAt = w.eng.now; why = e.dbg.preempt && e.dbg.preempt.at >= seenAt - 1e-6 ? e.dbg.preempt.why : ''; }
      if (seenAt >= 0 && weighedAt < 0) onRoute += Math.hypot(e.x - lx, e.y - ly);
      lx = e.x; ly = e.y; return weighedAt < 0; });
    return { where, h, seed, seen: seenAt >= 0, weighed: weighedAt < 0 ? null : +(weighedAt - seenAt).toFixed(2), onRoute: Math.round(onRoute), why };
  }));
  const ok = rs.every(r => !r.err && r.seen && r.weighed !== null && r.weighed <= .15 && r.onRoute <= 25);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.where} ${r.h}/${r.seed}: ${r.seen ? `weighed ${r.weighed === null ? 'NEVER' : r.weighed + ' s'} after sight, walked on ${r.onRoute} px${r.why ? ' ("' + r.why + '")' : ''}` : 'NOT SEEN'}`).join(' | ') };
});

add('P04 a committed strike is never cut (R16d; the owner: committed physical actions are never cancelled): a starving creature springs at an unaware person 150 px ahead; a second lit person walks into its view the moment the wind-up begins - the strike (wind-up, leap, recovery) runs as begun, no plan is cut while it lasts, and the newcomer is weighed only once it is done', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 17100); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .9 }); e.tier = 'near'; e.ang = 0;
    const a = w.player(5150 + seed * 4, LONG.y + (seed % 2 ? 10 : -10), { light: true, angle: 0 }); a.stop('stand'); a.look = 0;
    let b = null, P0 = null, plan0, planEnd, then = '', mono = true, lastT = -1, cutDuring = 0, endAt = -1, weighedAt = -1, wind = 0, strikeT0 = -1;
    w.run(10, (ww, t) => {
      if (e.pounce && !P0) { P0 = e.pounce; plan0 = e.plan; wind = P0.wind; strikeT0 = w.eng.now;
        if (seed % 2) a.go(a.x - 60, a.y + (seed % 4 === 1 ? 600 : -600), 'run');                         // (half of them dodge: a miss and its recovery)
        b = w.player(e.x + 380, e.y + (seed % 2 ? 160 : -160), { light: true, angle: Math.PI }); b.go(e.x + 380, e.y + (seed % 2 ? -400 : 400), 'walk'); }
      const busy = !!(e.pounce || e.recover > 0 || e.commit || e.cap);
      if (P0 && busy && endAt < 0) {
        if (e.pounce && e.pounce !== P0) mono = false;
        if (e.pounce === P0) { if (P0.t < lastT) mono = false; lastT = P0.t; }
        if (e.plan !== plan0 && !e.commit && !e.cap) cutDuring++;
        if (e.dbg.preempt && !e.dbg.preempt.kept && e.dbg.preempt.at >= strikeT0) cutDuring++;
      }
      if (P0 && !busy && endAt < 0) endAt = w.eng.now;
      if (endAt >= 0 && weighedAt < 0 && b && (weighed(e, b.id, endAt) || (e.plan !== planEnd && e.seenNow.has(b.id)))) { weighedAt = w.eng.now; then = e.plan ? e.plan.k + ': ' + e.dbg.why : e.dbg.why; }
      if (P0 && !busy && planEnd === undefined) planEnd = e.plan;
      return !(endAt >= 0 && (weighedAt >= 0 || w.eng.now - endAt > 3)); });
    return { seed, struck: !!P0, wind, mono, cutDuring, kill: w.kills.length, held: endAt < 0 ? null : +(endAt - strikeT0).toFixed(2), weighedAfter: weighedAt < 0 ? null : +(weighedAt - endAt).toFixed(2), then: then || (e.plan ? `${e.plan.k} about ${e.plan.pid === a.id ? 'the first' : e.plan.pid === (b && b.id) ? 'the newcomer' : 'nobody'}` : 'no plan') };
  });
  const ok = rs.every(r => !r.err) && rs.filter(r => r.struck).length >= 4 && rs.every(r => !r.struck || (r.mono && r.cutDuring === 0));
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : !r.struck ? `${r.seed}: no strike` : `${r.seed}: strike (wind-up ${r.wind} s) ${r.mono ? 'carried through' : 'ALTERED'}, ${r.cutDuring} cuts while it lasted, ${r.kill ? 'a kill played' : 'missed'}, committed ${r.held} s; then, with the newcomer in sight, ${r.weighedAfter === null ? 'it kept on (' + r.then + ')' : r.weighedAfter + ' s after: "' + r.then.slice(0, 70) + '"'}`).join(' | ') };
});

/* a dark spot with a clear line to a lit spot 420-650 px off (the creature waits in the dark, the person stands in the light) */
function darkLit(n) {
  const G = require('./lib.js').geo(), pairs = [];
  for (const a of G.lit) { if (!G.w.ad.clear(a.x, a.y, 24, 'walk')) continue;
    for (const b of G.dark) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 420 && d < 650 && G.g.los(a.x, a.y, b.x, b.y) && G.w.ad.clear(b.x, b.y, 26, 'walk')) { pairs.push([a, b]); break; } }
    if (pairs.length >= n) break; }
  return pairs;
}
add('P05 a wait that has lost its point is weighed afresh, one that has not is kept (R16d): lying in wait (an ambush, a lure) in the dark with the quarry in its sight - the quarry walks away from it: within SKP.awayFor seconds (+ a think) of its watching them go it reassesses, and the wait is not kept unchanged; the quarry walks toward it: the wait is kept, no reassessment forced', () => {
  const pairs = darkLit(40), rs = [];
  for (const k of ['ambush', 'lure']) for (const way of ['away', 'toward']) for (let i = 0; i < pairs.length && rs.filter(r => r.k === k && r.way === way && r.watched).length < 5; i++) {
    const [a, b] = pairs[i], w = World(17300 + i); bystander(w);
    const e = w.eng.spawn('skinstealer', b.x, b.y, { hunger: .65 }); e.tier = 'near'; e.ang = Math.atan2(a.y - b.y, a.x - b.x);
    const p = w.player(a.x, a.y, { light: true, angle: Math.atan2(a.y - b.y, a.x - b.x) }); p.stop('stand'); p.look = Math.atan2(a.y - b.y, a.x - b.x);
    w.run(.6, () => { e.plan = { k: 'watch', pid: p.id, t0: w.eng.now, until: w.eng.now + 9, why: 'held (test)' }; return true; });   // (it has seen them; nothing decided yet)
    if (!e.seenNow.has(p.id)) continue;
    const P0 = { k, pid: p.id, t0: w.eng.now, until: w.eng.now + 12, why: `a ${k} (test)`, face: { x: a.x, y: a.y } }; e.plan = P0; e.path = [];   // (begun as skBegin begins it)
    const ux = (a.x - b.x) / Math.hypot(a.x - b.x, a.y - b.y), uy = (a.y - b.y) / Math.hypot(a.x - b.x, a.y - b.y);
    const go = way === 'away' ? (require('./lib.js').floorNear(w, a.x + ux * 900, a.y + uy * 900) || a) : (require('./lib.js').floorNear(w, b.x - ux * 120, b.y - uy * 120) || b);
    if (way === 'away') p.pathTo(go.x, go.y, 'walk'); else p.pathTo(go.x, go.y, 'walk');
    let watch = 0, goneAt = -1, forced = -1, ended = -1, after = '', why = '', awayWatch = 0;
    w.run(6, () => {
      const P = e.plan;
      if (P === P0 && e.seenNow.has(p.id)) { watch += DT; const r = e.mem.p.get(p.id), v = r && r.visual, d = v ? Math.hypot(v.x - e.x, v.y - e.y) || 1 : 1;   // (going away as it perceives them)
        if (v && ((v.x - e.x) * v.vx + (v.y - e.y) * v.vy) / d > 60) { awayWatch += DT; if (goneAt < 0) goneAt = w.eng.now; } }
      if (forced < 0 && e.dbg.preempt && e.dbg.preempt.at >= P0.t0 && !e.dbg.preempt.kept) { forced = w.eng.now; why = e.dbg.preempt.why; }
      if (ended < 0 && P !== P0) { ended = w.eng.now; after = P ? P.k : e.pounce ? 'strike' : 'roam'; }
      return ended < 0 && !e.pounce; });
    rs.push({ k, way, i, watched: watch > .3, watch: +watch.toFixed(1), awayWatch: +awayWatch.toFixed(2), forced: forced < 0 ? null : +(forced - (goneAt < 0 ? forced : goneAt)).toFixed(2), why, ended: ended < 0 ? null : +(ended - P0.t0).toFixed(2), after, struck: !!e.pounce || w.kills.length > 0 });
  }
  const A = rs.filter(r => r.way === 'away' && r.watched), T = rs.filter(r => r.way === 'toward' && r.watched);
  // (a wait it ended by its own rules first - a very hungry one does not wait long - is no failure: the point is that it never keeps the
  // wait while it watches them go for longer than SKP.awayFor and a think)
  const ok = A.length >= 6 && T.length >= 6 && A.every(r => r.awayWatch <= INNER.SKP.awayFor + .25 && (r.forced === null || /going away/.test(r.why))) && A.filter(r => r.forced !== null).length >= 4
    && T.every(r => r.forced === null && (r.ended === null || r.struck || r.after === 'strike'));
  return { ok, note: rs.filter(r => r.watched).map(r => `${r.k} ${r.way} #${r.i}: watched ${r.watch} s (${r.awayWatch} s of it going away), ${r.forced === null ? 'no reassessment forced' : 'reassessed ' + r.forced + ' s after they turned away'}, wait ${r.ended === null ? 'kept' : 'ended at ' + r.ended + ' s -> ' + r.after}${r.struck ? ' (it sprang)' : ''}`).join(' | ') };
});

add('P06 no replanning in a loop (R16d; the owner: no oscillation): the policy alone, on its own records - a person flickering in and out of its view every think forces one reassessment; one reappearing after 1.3 s out of sight forces one per reappearance, never two within SKP.again; a committed action is never cut (and says so); a tactical plan is flagged, not cut; a low-priority one is cut', () => {
  const mk = () => ({ seenNow: new Set(), mem: { p: new Map() }, plan: null, dbg: {}, mind: null, roam: { pause: 1 }, tally: { reconsider: 0 }, path: [1], rx: {}, pounce: null, recover: 0 });
  const rec = id => ({ id, dist: 400, visual: { alive: true, caught: false, x: 400, y: 0, vx: 0, vy: 0 } });
  const run = (e, secs, vis, ids = [1]) => { const eng = { now: 0, byId: new Map(ids.map(i => [i, {}])) }; for (const i of ids) e.mem.p.set(i, rec(i)); const at = [];
    for (let k = 0; k <= secs * 10; k++) { eng.now = k / 10; e.seenNow = new Set(ids.filter(i => vis(k, i))); const why = INNER.skPreempt(eng, e, () => true); if (why) at.push([eng.now, why]); }
    return at; };
  const out = {};
  out.flicker = run(mk(), 10, k => k % 2 === 0).length;                                         // (seen every other think)
  const re = run(mk(), 10, k => k % 14 === 0); out.reappear = re.length;                       // (seen one think in fourteen: 1.3 s out of sight)
  out.minGap = Math.min(...re.slice(1).map((x, i) => x[0] - re[i][0]));
  const two = run(mk(), 10, (k, i) => (k + (i === 2 ? 7 : 0)) % 14 === 0, [1, 2]); out.two = two.length;
  const per = id => { const ts = two.filter(x => x[1].startsWith('P' + id + ' ')).map(x => x[0]); return Math.min(...ts.slice(1).map((t, j) => t - ts[j])); };
  out.twoGap = Math.min(per(1), per(2));
  const c = mk(); c.pounce = { t: .05, wind: .22 }; c.plan = { k: 'approach', pid: 9 }; const cp = c.plan; out.committed = run(c, 3, k => k % 14 === 0).length; out.committedKept = c.plan === cp && c.pounce !== null && !!(c.dbg.preempt && c.dbg.preempt.kept);
  const tt = mk(); tt.plan = { k: 'approach', pid: 9 }; const tp = tt.plan; const tr = run(tt, 1, () => true); out.tactical = tr.length === 1 && tt.plan === tp && tt.pre.force === '' && /its approach about P9 goes on while it still makes sense/.test(tr[0][1]);
  const lo = mk(); lo.plan = { k: 'search', pid: 0 }; const lr = run(lo, .1, () => true); out.low = lr.length === 1 && lo.plan === null && lo.roam.pause === 0 && lo.rx === null && lo.path.length === 0;
  const ok = out.flicker === 1 && out.reappear === 8 && out.minGap >= INNER.SKP.again && out.two === 15 && out.twoGap >= INNER.SKP.again && out.committed === 0 && out.committedKept && out.tactical && out.low;
  return { ok, note: `flickering every other think for 10 s: ${out.flicker} forced | back after 1.3 s out of sight, 8 times: ${out.reappear} forced, ${out.minGap.toFixed(1)} s apart at least | two such people: ${out.two}, per person ${out.twoGap.toFixed(1)} s apart at least | committed: ${out.committed} cut, ${out.committedKept ? 'kept and said so' : 'NOT KEPT'} | tactical: ${out.tactical ? 'flagged, kept' : 'WRONG'} | low: ${out.low ? 'cut' : 'NOT CUT'}` };
});

add('P07 hungry, it prowls (R16d; AP_AUDIT G: 9-13 s of every minute standing, starving included): nobody about, a minute - fed (.3) it pauses as before; hungry (.7) and starving (.95) it stands far less; and where it prowls is where it perceived prey (its last sight or its sound of them), never where they really are', () => {
  const G = [];
  for (const h of [.3, .7, .95]) for (const seed of [1, 2]) {
    const w = World(seed + 1500 + Math.round(h * 100)); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: h }); e.tier = 'near';
    let still = 0; w.run(60, () => { e.tier = 'near'; e.tierT = 99; if (e.speed <= 10) still += DT; return true; });   // (kept at the near level of detail, as with players about)
    G.push({ h, seed, still: +still.toFixed(1) });
  }
  // its prowl goal, asked of its own function on a real world: a person seen walking 600 px off, then out of its view and quiet - the goal is
  // where it last knew them; one it has left, or one it sees now, is no goal; a place it has prowled to is not prowled to again
  const w = World(17700); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .8 }); e.tier = 'near'; e.ang = 0;
  const p = w.player(5600, LONG.y, { light: true, angle: Math.PI }); p.stop('stand'); p.look = Math.PI;
  w.run(.6, () => { e.plan = { k: 'watch', pid: p.id, t0: w.eng.now, until: w.eng.now + 9, why: 'held (test)' }; return true; });
  const sawFirst = e.seenNow.has(p.id);
  p.x = 5000 - 3000; p.y = LONG.y; p.light = false; p.stop('crouch');                         // (out of its sight and hearing at once: a far place it never perceived)
  w.run(.3, () => { e.plan = { k: 'watch', pid: p.id, t0: w.eng.now, until: w.eng.now + 9, why: 'held (test)' }; return true; });
  const r = e.mem.p.get(p.id), g1 = INNER.skPatrolGoal(w.eng, e);
  const toKnown = g1 ? Math.round(Math.hypot(g1.x - r.lkx, g1.y - r.lky)) : null, toTrue = g1 ? Math.round(Math.hypot(g1.x - p.x, g1.y - p.y)) : null;
  e.left.set(p.id, w.eng.now + 30); const gLeft = INNER.skPatrolGoal(w.eng, e); e.left.delete(p.id);
  e.roam.seen = [{ x: g1 ? g1.x : 0, y: g1 ? g1.y : 0, t: w.eng.now }]; const gDone = INNER.skPatrolGoal(w.eng, e); e.roam.seen = [];
  e.seenNow.add(p.id); const gSeen = INNER.skPatrolGoal(w.eng, e); e.seenNow.delete(p.id);
  const fed = G.filter(x => x.h < .4), hungry = G.filter(x => x.h >= .6);
  const ok = fed.every(x => x.still >= 5) && hungry.every(x => x.still <= 6) && sawFirst && g1 && toKnown <= 120 && toTrue > 1500 && (!gLeft || gLeft.k !== 'saw') && (!gDone || Math.hypot(gDone.x - g1.x, gDone.y - g1.y) > 260) && (!gSeen || gSeen.k !== 'saw');
  return { ok, note: `standing in 60 s: ${G.map(x => `${x.h}/${x.seed} ${x.still} s`).join(', ')} | its prowl goal ${g1 ? `${toKnown} px from where it last saw them, ${toTrue} px from where they are` : 'NONE'}; once left: ${gLeft ? gLeft.k : 'none'}; once prowled to: ${gDone ? 'elsewhere' : 'none'}; while in sight: ${gSeen ? gSeen.k : 'none'}` };
});

/* the creature's own evidence and decisions this tick (s_skinadv.js's line): two worlds the same to its senses give the same lines */
const seenAs = (e, p) => { const r = e.seenNow.has(p.id) && e.mem.p.get(p.id); return r ? '1@' + Math.round(r.lkx) + ',' + Math.round(r.lky) : '0'; };
const line = (e, p) => [Math.round(e.x * 10), Math.round(e.y * 10), seenAs(e, p), e.mem.sounds.map(q => q.id + ':' + Math.round(q.x) + ':' + Math.round(q.y)).join(';'),
  e.plan ? e.plan.k + (e.plan.mode || '') : '-', e.roam.goal ? Math.round(e.roam.goal.x) + ',' + Math.round(e.roam.goal.y) : '-', e.pre ? e.pre.n : 0, e.tier].join('|');
add('P08 its prowling reads no hidden truth (R16d; the locks: no hidden player truth): a hungry creature (.7 / .95) sees a person cross its view and go, then prowls for a minute (R16f: 40 s left too little prowling once its footwork had followed them); a second person, never sensed, crouches unlit at one of two far places - its every move and decision is the same in both worlds until it senses that second person', () => {
  const rs = [];
  for (const h of [.7, .95]) rs.push(...over([1, 2, 3], seed => {
    const T = where => {
      const w = World(seed * 5 + 17800 + Math.round(h * 100)); bystander(w, 1300, 3300);
      const e = w.eng.spawn('skinstealer', 4600, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
      const a = w.player(5300, LONG.y - 200, { light: true, angle: Math.PI / 2 }); a.go(5300, LONG.y + 1400, 'walk');
      const q = w.player(where.x, where.y, { light: false }); q.stop('crouch');
      const tr = []; w.run(60, () => { e.tier = 'near'; e.tierT = 99; if (a.y > LONG.y + 300 && a.light) a.light = false; tr.push(line(e, q)); return true; });
      return tr;
    };
    const G = require('./lib.js').geo(), far = G.dark.filter(d => Math.hypot(d.x - 4600, d.y - LONG.y) > 2600 && G.w.ad.clear(d.x, d.y, 24, 'walk'));
    const A = T(far[seed * 3 % far.length]), B = T(far[(seed * 3 + Math.floor(far.length / 2)) % far.length]);
    const n = Math.min(A.length, B.length); let sensed = n, diff = -1;
    for (let i = 0; i < n; i++) { const x = A[i].split('|'), y = B[i].split('|'); if (x[2] !== y[2] || x[3] !== y[3]) { sensed = i; break; } if (A[i] !== B[i]) { diff = i; break; } }
    const prowled = new Set(A.map(l => l.split('|')[5])).size;
    return { h, seed, sensed: +(sensed * DT).toFixed(1), diff: diff < 0 ? null : +(diff * DT).toFixed(2), prowled };
  }));
  const ok = rs.every(r => !r.err && r.diff === null) && rs.some(r => r.prowled > 2);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.h}/${r.seed}: ${r.diff === null ? `the same until ${r.sensed} s` : 'DIFFERED UNSENSED at ' + r.diff + ' s'}, ${r.prowled} roam goals`).join(' | ') };
});

add('P09 no oscillation in a live scene (R16d; the owner: no stop-turn-walk loops): a person 700-900 px down the hall walks to and fro and switches the torch on and off every 1.5 s (in and out of its sight) for 20 s, hunger .5 / .7 / .9 - forced reassessments stay rare and its plan never flips back and forth within a second', () => {
  const rs = [];
  for (const h of [.5, .7, .9]) rs.push(...over([1, 2, 3], seed => {
    const w = World(seed * 3 + 17900 + Math.round(h * 100)); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 4400, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    const p = w.player(5200, LONG.y, { light: true, angle: Math.PI }); p.stop('stand');
    const T = planTrace(e); let forced = 0, last = -1, sightOn = 0, wasSeen = false, kills = 0;
    w.run(20, (ww, t) => { p.light = Math.floor(t / 1.5) % 2 === 0; if (!p.path || !p.path.length) p.route([{ x: p.x > 5200 ? 5100 : 5300, y: LONG.y }], 'walk');
      T.tick(t); const s = e.seenNow.has(p.id); if (s && !wasSeen) sightOn++; wasSeen = s;
      if (e.dbg.preempt && !e.dbg.preempt.kept && e.dbg.preempt.at !== last) { last = e.dbg.preempt.at; forced++; }
      kills = w.kills.length; return kills === 0; });
    let flips = 0; for (let i = 2; i < T.list.length; i++) if (T.list[i][1] === T.list[i - 2][1] && T.list[i][0] - T.list[i - 2][0] < 1) flips++;
    return { h, seed, sightOn, forced, changes: T.list.length - 1, flips, kills, trace: T.list.map(x => x[1]).slice(0, 12).join('>') };
  }));
  const ok = rs.every(r => !r.err && r.flips === 0 && r.forced <= Math.ceil(20 / INNER.SKP.regain));
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.h}/${r.seed}: came into its sight ${r.sightOn} times, ${r.forced} forced, ${r.changes} plan changes, ${r.flips} flips${r.kills ? ', a kill' : ''} (${r.trace})`).join(' | ') };
});

/* a person runs across behind / beside a roaming creature (unlit; then stands): when it heard, when its head moved and was on it, when
 * its body began to turn, its head's and its body's fastest turn (rad/s) */
function heard(h, deg, side, seed) {
  const w = World(41 + deg + (side > 0 ? 0 : 5) + Math.round(h * 100) + seed * 1000); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 5600, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
  if (e.roam) { e.roam.goal = { x: 8400, y: LONG.y }; e.roam.until = w.eng.now + 60; e.roam.pause = 0; }
  const a = side * deg * Math.PI / 180;
  let p = null, T = -1, hs = -1, hon = -1, bs = -1, a0 = 0, h0 = 0, src = null, hmax = 0, bmax = 0, lh = 0, la = 0, first = '', sync = 0, ticks = 0;
  w.run(3.5, (ww, t) => {
    if (t > 1 && !p) { p = w.player(e.x + Math.cos(e.ang + a) * 320, e.y + Math.sin(e.ang + a) * 320, { light: false, angle: 0 }); p.go(p.x + Math.cos(e.ang + a + 1.57) * 300, p.y + Math.sin(e.ang + a + 1.57) * 300, 'run'); }
    if (p && t > 1.8 && p.mode === 'run') p.stop('stand');
    const q = e.mem.sounds[0];
    if (p && T < 0 && q && q.t > w.eng.now - 1.5 && q.t > 61) { T = q.t; a0 = e.ang; h0 = e.head || 0; src = { x: q.x, y: q.y }; first = e.dbg.look ? e.dbg.look.k : ''; }
    if (T >= 0) {
      const b = Math.atan2(src.y - e.y, src.x - e.x), tgt = Math.max(-1.25, Math.min(1.25, Math.atan2(Math.sin(b - e.ang), Math.cos(b - e.ang))));
      if (hs < 0 && Math.abs((e.head || 0) - h0) > .03) hs = w.eng.now - T;
      if (hs >= 0 && hon < 0 && Math.abs((e.head || 0) - tgt) < .15) hon = w.eng.now - T;
      if (bs < 0 && Math.abs(Math.atan2(Math.sin(e.ang - a0), Math.cos(e.ang - a0))) > .03) bs = w.eng.now - T;
      hmax = Math.max(hmax, Math.abs((e.head || 0) - lh) / DT); bmax = Math.max(bmax, Math.abs(Math.atan2(Math.sin(e.ang - la), Math.cos(e.ang - la))) / DT);
      if (first === '' && e.dbg.look) first = e.dbg.look.k;
    }
    ticks++; if (AI.SKIN.snap(e).h !== +(e.head || 0).toFixed(2)) sync++;
    lh = e.head || 0; la = e.ang; return true; });
  const rel = src ? Math.abs(Math.atan2(Math.sin(Math.atan2(src.y - 3504, src.x - 5600) - a0), Math.cos(Math.atan2(src.y - 3504, src.x - 5600) - a0))) : 0;
  return { h, deg, side, seed, heard: T >= 0, first, hs: +hs.toFixed(3), hon: +hon.toFixed(3), bs: +bs.toFixed(3), hmax: +hmax.toFixed(1), bmax: +bmax.toFixed(1), beyond: rel > 1.25 * .85, sync, ticks };
}
add('P10 a sound (R16e; the owner: head-turn initiation about 50-100 ms, the head on it in about 100-200 ms, the body turning within about 150-250 ms, the head faster than the body, the server\'s sight and the drawn head in step): somebody runs across 320 px off a roaming creature at 60 / 110 / 160 degrees either side, hunger .3 / .7 - its head starts 40-120 ms after it hears them and is on the sound within 250 ms; beyond the head\'s reach the body starts within 100-260 ms, after the head; the head turns at 13 rad/s at most, the body at 5; every snapshot carries the head it sees with', () => {
  const rs = [];
  for (const h of [.3, .7]) for (const deg of [60, 110, 160]) for (const side of [1, -1]) rs.push(...over([1], seed => heard(h, deg, side, seed)));
  const S = rs.filter(r => !r.err && r.heard && r.first === 'sound');            // (where a movement at the edge of its view came first, that was its stimulus: P12)
  const ok = rs.every(r => !r.err && r.heard) && S.length >= 8 && S.every(r => r.hs >= .04 && r.hs <= .12 && r.hon >= 0 && r.hon <= .25 && (!r.beyond || (r.bs >= .1 && r.bs <= .26 && r.bs > r.hs)))
    && rs.every(r => r.hmax <= 13.5 && r.sync === 0) && S.filter(r => r.beyond).every(r => r.hmax > r.bmax);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.h} ${r.side * r.deg}deg: ${r.first || '-'}, head ${r.hs} s, on it ${r.hon} s${r.beyond ? ', body ' + r.bs + ' s' : ''} (fastest: head ${r.hmax}, body ${r.bmax} rad/s)${r.sync ? ', ' + r.sync + ' ticks out of step' : ''}`).join(' | ') };
});

add('P11 under a plan the head alone turns (R16e; the owner: snap the head to stimuli under any plan that is not committed; the sight and the head stay in step): approaching an unaware lit person, a thud at its side (nobody there) - its head turns toward it within a quarter second and the person it approaches is out of its sight no more than with no thud (its head never turns them out of its view); leaving, a sound behind it turns its head and it goes on leaving (B1\'s look at a sound, as R8); in a strike its head does not move', () => {
  const rs = [];
  const approach = (sd, runner) => {
    const w = World(sd * 7 + 17950); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .85 }); e.tier = 'near'; e.ang = 0;
    const q = w.player(5560, LONG.y, { light: true, angle: 0 }); q.stop('stand'); q.look = 0;
    let r = null, t1 = -1, T = -1, toward = -1, lostQ = 0, during = 0, plan0 = '', off = '';
    w.run(3, (ww, t) => {
      if (t > .8 && t1 < 0 && e.plan && e.plan.pid === q.id) { t1 = t; plan0 = e.plan.k; }
      if (runner && t1 >= 0 && !r && t - t1 > .2) { r = { id: -9 }; w.eng.sound({ x: e.x + Math.cos(e.ang + 1.6) * 300, y: e.y + Math.sin(e.ang + 1.6) * 300, r: 700, I: .6, type: 'land', src: 0 }); }   // (a thud at its right, nobody there to see)
      if (t1 >= 0 && t - t1 < 1.4 && !off && !(e.plan && e.plan.pid === q.id)) off = (e.plan ? e.plan.k + ' about ' + (r && e.plan.pid === r.id ? 'the runner' : 'P' + e.plan.pid) : 'no plan') + ': ' + e.dbg.why;
      const s = e.mem.sounds[0]; if (r && T < 0 && s && s.t > w.eng.now - .5 && s.pid !== q.id) T = s.t;
      if (T >= 0 && toward < 0 && (e.head || 0) > .3) toward = w.eng.now - T;                       // (the side it is on: its right)
      if (t1 >= 0 && t - t1 < 1.4 && !e.pounce && !e.recover && !e.commit && Math.round(t * 60) % 6 === 0) { during++; if (!e.seenNow.has(q.id)) lostQ++; }
      return !e.pounce && !e.commit; });
    return { plan0, heard: T >= 0, toward: toward < 0 ? null : +toward.toFixed(2), lostQ, during, off };
  };
  for (const seed of [1, 2, 3, 4]) rs.push(...over([seed], sd => { const A = approach(sd, true), B = approach(sd, false); return Object.assign({ k: 'approach', seed: sd, lostWithout: B.lostQ }, A); }));
  for (const seed of [1, 2]) rs.push(...over([seed], sd => {
    const w = World(sd * 7 + 17980); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .5 }); e.tier = 'near'; e.ang = 0;
    w.run(.2); e.plan = { k: 'leave', pid: 0, t0: w.eng.now, until: w.eng.now + 20, goal: { x: 8400, y: LONG.y }, why: 'a departure (test)' }; e.path = [];
    let r = null, T = -1, toward = -1, slow = 0, n = 0;
    w.run(2.5, (ww, t) => {
      if (t > .6 && !r) { const f = floorNear(w, e.x - 380, e.y + 60) || { x: e.x - 380, y: e.y }; r = w.player(f.x, f.y, { light: false }); r.go(f.x - 300, f.y, 'run'); }   // (behind it: out of its view and of its head's reach)
      const s = e.mem.sounds[0]; if (r && T < 0 && s && s.t > w.eng.now - .5) T = s.t;
      if (T >= 0 && toward < 0 && Math.abs(e.head || 0) > .3) toward = w.eng.now - T;
      if (T >= 0 && w.eng.now - T < 1) { n++; if (e.speed < 50) slow++; }
      return true; });
    return { k: 'leave', seed: sd, heard: T >= 0, toward: toward < 0 ? null : +toward.toFixed(2), slow, n, plan: e.plan ? e.plan.k : '-' };
  }));
  // a strike: its head as it was through the wind-up and the leap, whatever it hears
  rs.push(...over([1, 2], sd => {
    const w = World(sd + 17990); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .9 }); e.tier = 'near'; e.ang = 0;
    const a = w.player(5150, LONG.y, { light: true, angle: 0 }); a.stop('stand'); a.look = 0;
    let h0 = null, moved = 0, r = null;
    w.run(4, () => { if (e.pounce && h0 === null) { h0 = e.head || 0; r = w.player(e.x - 40, e.y + 260, { light: false }); r.go(e.x + 300, e.y + 260, 'run'); }
      if (e.pounce && h0 !== null) moved = Math.max(moved, Math.abs((e.head || 0) - h0)); return !(h0 !== null && !e.pounce); });
    return { k: 'strike', seed: sd, struck: h0 !== null, moved: +moved.toFixed(3) };
  }));
  const A = rs.filter(r => r.k === 'approach'), L = rs.filter(r => r.k === 'leave'), K = rs.filter(r => r.k === 'strike');
  const ok = rs.every(r => !r.err) && A.filter(r => r.heard).length >= 3 && A.filter(r => r.heard).every(r => r.toward !== null && r.toward <= .25 && r.lostQ <= r.lostWithout)
    && L.every(r => r.heard && r.toward !== null && r.toward <= .25 && r.plan === 'leave') && K.filter(r => r.struck).length >= 1 && K.every(r => !r.struck || r.moved < .01);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : r.k === 'approach' ? `approaching (${r.plan0}) #${r.seed}: ${r.heard ? `head toward the sound ${r.toward} s after it, the person it approaches out of its sight ${r.lostQ} of ${r.during} thinks (${r.lostWithout} with no thud)${r.off ? ' - it turned to: ' + r.off.slice(0, 80) : ''}` : 'NOT HEARD'}` : r.k === 'leave' ? `leaving #${r.seed}: head toward the sound ${r.toward} s, it stopped to look ${(r.slow / 60).toFixed(1)} s (B1), then ${r.plan}` : `strike #${r.seed}: ${r.struck ? 'its head moved ' + r.moved + ' rad' : 'no strike'}`).join(' | ') };
});

/* the side corridor north from the long hall at x 5600 (repro_ap.js P): a roaming creature passes its mouth going east */
function corridor(h, seed, how, at) {
  const w = World(seed * 19 + Math.round(h * 100) + 18000 + how.length); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 5250, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
  if (e.roam) { e.roam.goal = { x: 8400, y: LONG.y }; e.roam.until = w.eng.now + 60; e.roam.pause = 0; }
  let p = null, t0 = -1, noticed = -1, seen = -1, rec = false, blind = 0, n0 = 0;
  w.run(6, (ww, t) => {
    if (!p && e.x >= 5520) { t0 = t; const q = at(e, w); p = w.player(q.x, q.y, { light: how.light, angle: 0 }); if (how.walk) p.go(q.x + 380, q.y, how.walk); else p.stop(how.still || 'stand'); }
    if (p && (e.tally.periph || 0) > n0) { n0 = e.tally.periph; if (!w.eng.geo.los(e.x, e.y, p.x, p.y)) blind++; if (noticed < 0) { noticed = t - t0; rec = e.mem.p.has(p.id); } }
    if (p && seen < 0 && e.seenNow.has(p.id)) seen = t - t0;
    return !(seen >= 0 && t - t0 - seen > .3); });
  return { h, seed, placed: t0 >= 0, noticed: noticed < 0 ? null : +noticed.toFixed(2), seen: seen < 0 ? null : +seen.toFixed(2), recAtNotice: rec, blind };
}
add('P12 movement at the edge of its view (R16e; AP_AUDIT A: a person 85 degrees off its way was never noticed): roaming east past the mouth of a side corridor, a person walks across it 420 px up (lit, unlit; 100 degrees off its way) - it notices the movement, turns and sees them within a second, holding no record of who until it sees them; a lit person standing there is not noticed (it needs movement); somebody walking behind a wall at its side is not, and no notice is ever made without a clear line', () => {
  const rs = [];
  for (const light of [true, false]) for (const h of [.3, .7]) for (const seed of [1, 2]) rs.push(...over([seed], sd => Object.assign({ k: light ? 'lit walker' : 'unlit walker' }, corridor(h, sd, { light, walk: 'walk' }, () => ({ x: 5420, y: LONG.y - 420 })))));
  for (const h of [.3, .7]) rs.push(...over([1], sd => Object.assign({ k: 'lit, standing' }, corridor(h, sd, { light: true }, () => ({ x: 5600, y: LONG.y - 420 })))));
  // behind a wall: south of the hall, a corridor 450 px off at 81-93 degrees with no line to where it passes (found on the level once)
  const hid = { x: 5496, y: 3960 };
  for (const h of [.3, .7]) rs.push(...over([1, 2], sd => Object.assign({ k: 'behind a wall' }, corridor(h, sd, { light: true, walk: 'walk' }, () => hid))));
  const W = rs.filter(r => /walker/.test(r.k)), St = rs.filter(r => r.k === 'lit, standing'), Bw = rs.filter(r => r.k === 'behind a wall');
  const ok = rs.every(r => !r.err && r.placed) && W.filter(r => r.noticed !== null && r.seen !== null && r.seen <= 1).length >= 7 && W.every(r => !r.recAtNotice)
    && St.every(r => r.noticed === null) && rs.every(r => !r.blind) && Bw.every(r => r.noticed === null);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.k} ${r.h}/${r.seed}: noticed ${r.noticed === null ? 'never' : r.noticed + ' s'}, seen ${r.seen === null ? 'never' : r.seen + ' s'}${r.recAtNotice ? ' (A RECORD BEFORE SIGHT)' : ''}${r.blind ? ' (NOTICED THROUGH A WALL ' + r.blind + ' times)' : ''}`).join(' | ') };
});

add('P13 where to look from (R16e; AP_AUDIT B: it walked to the sound itself, saw them 3.8-5.2 s after hearing): the point it chooses lets it make out somebody unlit at the place by its own sight (and none is chosen when it already could); in the long hall a person sprints behind it and stands unlit - a hungry one (.55 / .8 / .95) sees them in every run, within 4.6 s of hearing; fed (.3) it turns to look and goes on', () => {
  const w = World(18100), e = w.eng.spawn('skinstealer', 5250, LONG.y, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
  const place = { x: 5600, y: LONG.y - 600 }, v = INNER.skVantage(w.eng, e, place.x, place.y, 0), near = INNER.skVantage(w.eng, e, e.x + 150, e.y, 0);
  const sees = (px, py) => { const eye = Object.create(e); eye.x = px; eye.y = py; eye.act = 'search'; eye.head = Math.atan2(place.y - py, place.x - px) - e.ang; return INNER.visualObservation(eye, w.eng, { id: -1, x: place.x, y: place.y, alive: true, st: 0, sp: 0, light: false, prof: 1 }).vis; };
  const unit = { fromHere: sees(e.x, e.y), v: v ? { x: Math.round(v.x), y: Math.round(v.y), sees: sees(v.x, v.y), los: w.eng.geo.los(v.x, v.y, place.x, place.y), d: Math.round(Math.hypot(v.x - e.x, v.y - e.y)), dPlace: Math.round(Math.hypot(place.x - e.x, place.y - e.y)) } : null, near };
  const rs = [];
  for (const h of [.3, .55, .8, .95]) for (const seed of [1, 2, 3]) rs.push(...over([seed], sd => {
    const w2 = World(sd * 17 + Math.round(h * 100) + 500); bystander(w2, 1300, 3300);
    const c = w2.eng.spawn('skinstealer', 6000, LONG.y, { hunger: h }); c.tier = 'near'; c.ang = 0; c.roam.goal = { x: 8400, y: LONG.y }; c.roam.until = w2.eng.now + 60;
    const p = w2.player(5650, LONG.y, { light: false, angle: 0 }); p.stop('stand');
    let heardAt = -1, sawAt = -1, turned = false;
    w2.run(10, (ww, t) => {
      if (t > 1 && t < 2.2) { if (!p.r) { p.r = 1; p.go(5500, LONG.y, 'run'); } } else if (t >= 2.2 && p.r === 1) { p.r = 2; p.stop('stand'); }
      if (heardAt < 0 && t > 1 && c.mem.sounds.length) heardAt = t;
      if (heardAt >= 0 && Math.abs(Math.atan2(Math.sin(c.ang + (c.head || 0) - Math.PI), Math.cos(c.ang + (c.head || 0) - Math.PI))) < 1) turned = true;
      if (sawAt < 0 && c.seenNow.has(p.id)) sawAt = t; return sawAt < 0; });
    return { h, seed: sd, saw: sawAt < 0 ? null : +(sawAt - heardAt).toFixed(2), turned, vantage: c.tally.vantage || 0 };
  }));
  const hungry = rs.filter(r => r.h >= .5), fed = rs.filter(r => r.h < .5);
  const ok = !unit.fromHere && unit.v && unit.v.sees && unit.v.los && unit.v.d < unit.v.dPlace && unit.near === null && rs.every(r => !r.err) && hungry.every(r => r.saw !== null && r.saw <= 4.6) && fed.every(r => r.turned);
  return { ok, note: `round the corner (5600, ${LONG.y - 600}) from (5250, ${LONG.y}): ${unit.fromHere ? 'SEEN FROM HERE' : 'not seen from where it stands'}; its point to look from ${unit.v ? `(${unit.v.x}, ${unit.v.y}), ${unit.v.d} px away (the place: ${unit.v.dPlace}), from which it would make them out: ${unit.v.sees}` : 'NONE'}; a place 150 px ahead in plain view: ${unit.near === null ? 'no point needed' : 'A POINT CHOSEN'} | ` + rs.map(r => r.err ? 'ERR ' + r.err : `${r.h}/${r.seed}: ${r.saw === null ? (r.turned ? 'turned to look, did not see them' : 'DID NOT TURN') : 'saw them ' + r.saw + ' s after hearing'}${r.vantage ? ' (from a point to look from)' : ''}`).join(' | ') };
});

add('P14 the stealth that still works (R16e; the owner: legitimate stealth counterplay remains; its periphery needs movement): a person crouched still and unlit, or crawling, at its side 260-320 px off (80-100 degrees from its way) as it roams past (hunger .3 / .7 / .95) - its periphery never fires on them', () => {
  const rs = [];
  for (const [how, mode] of [['crouched, still', null], ['crawling', 'crawl']]) for (const h of [.3, .7, .95]) rs.push(...over([1, 2], sd => {
    const w = World(sd * 23 + Math.round(h * 100) + 18200 + (mode ? 9 : 0)); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 4700, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    if (e.roam) { e.roam.goal = { x: 8400, y: LONG.y }; e.roam.until = w.eng.now + 60; e.roam.pause = 0; }
    const f = floorNear(w, 5000, LONG.y + 290) || { x: 5000, y: LONG.y + 290 }, p = w.player(f.x, f.y, { light: false, angle: 0 });
    if (mode) p.go(f.x + 200, f.y, mode); else p.stop('crouch');
    let side = 0, fired = 0;
    w.run(8, () => { const b = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - e.y, p.x - e.x) - e.ang), Math.cos(Math.atan2(p.y - e.y, p.x - e.x) - e.ang)));
      if (b > 1.25 && b < 2.15 && Math.hypot(p.x - e.x, p.y - e.y) < 420) side += DT; fired = e.tally.periph || 0; return true; });
    return { how, h, seed: sd, side: +side.toFixed(1), fired };
  }));
  const ok = rs.every(r => !r.err && r.fired === 0) && rs.filter(r => r.side > .5).length >= 8;
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.how} ${r.h}/${r.seed}: ${r.side} s at its side, its periphery fired ${r.fired} times`).join(' | ') };
});

/* circled just out of its spring (AP_AUDIT C): a person runs round it at 230 px (their script keeps them there, wherever it goes) */
function circled(h, dir, seed, T = 8, flip = 0) {
  const w = World(Math.round(h * 100) + (dir > 0 ? 700 : 800) + seed * 3); bystander(w, 1300, 3300);
  const cx = 5000, cy = LONG.y, e = w.eng.spawn('skinstealer', cx, cy, { hunger: h }); e.tier = 'near'; e.ang = 0;
  const p = w.player(cx + 240, cy, { light: true, angle: Math.PI }); p.stop('stand');
  const R = { errSum: 0, n: 0, side: 0, back: 0, fightT: 0, strikes: 0, kill: -1, vmax: 0, over: 0, flipAt: -1, latAfter: [], stam0: e.stam, stamMin: e.stam, fast: 0 }; let px = e.x, py = e.y, pp = false, d0 = dir;
  w.run(T, (ww, t) => {
    if (flip && t >= flip && R.flipAt < 0) { R.flipAt = t; dir = -dir; }
    const a = Math.atan2(p.y - e.y, p.x - e.x); p.go(e.x + Math.cos(a + dir * .5) * 230, e.y + Math.sin(a + dir * .5) * 230, 'run'); p.look = Math.atan2(e.y - p.y, e.x - p.x);
    const fighting = !!(e.fight && !e.fight.blocked && w.eng.now - e.fight.at < .15) && !e.pounce && !e.recover;   // (R16g: a fight with no clear way to them is no footwork)
    const mvx = (e.x - px) / DT, mvy = (e.y - py) / DT, f = mvx * Math.cos(e.ang) + mvy * Math.sin(e.ang), l = -mvx * Math.sin(e.ang) + mvy * Math.cos(e.ang); px = e.x; py = e.y;
    const v = Math.hypot(mvx, mvy); if (!e.pounce && !e.recover) { R.vmax = Math.max(R.vmax, v); R.cmax = Math.max(R.cmax || 0, e.speed); if (e.speed > AI.SKIN.speeds.run + .5 || v > AI.SKIN.speeds.run * 1.02) R.over++; }   // (its own speed; and what it covered, a wall's slide allowed 2 %)
    if (fighting) { R.fightT += DT; R.errSum += Math.abs(Math.atan2(Math.sin(e.ang - a), Math.cos(e.ang - a))); R.n++; if (Math.abs(l) > 40 && Math.abs(l) > Math.abs(f)) R.side += DT; if (f < -30) R.back += DT; }
    if (R.flipAt >= 0 && t - R.flipAt < 1.2 && fighting) R.latAfter.push([+(t - R.flipAt).toFixed(3), Math.sign(l) * d0]);   // (its sideways step, in the old direction's sense)
    if (v > 200 && !e.pounce) R.fast += DT; R.stamMin = Math.min(R.stamMin, e.stam);
    if (e.pounce && !pp) R.strikes++; pp = !!e.pounce; if (R.kill < 0 && w.kills.length) R.kill = t;
    return R.kill < 0; });
  R.meanErr = R.n ? +(R.errSum / R.n).toFixed(2) : null; return R;
}
add('P15 circled just out of its spring (R16f; AP_AUDIT C: its facing 0.6-1.3 rad behind them, no step sideways or back): a person runs round it at 230 px, either way, hunger .85 / .95 - fighting for its place it faces them (mean error under 0.5 rad; R8 lagged 0.6-1.3), steps sideways after them, and is never faster than its run', () => {
  const rs = [];
  for (const h of [.85, .95]) for (const dir of [1, -1]) for (const seed of [1, 2, 3]) rs.push(...over([seed], sd => Object.assign({ h, dir, seed: sd }, circled(h, dir, sd))));
  const F = rs.filter(r => !r.err && r.fightT > 1);
  // (R16g, the independent review: R16f turned its facing at 7 rad/s, twice the species' TURNING_ABILITY (3.6), against the owner's turning
  // limits; at the species' own rate it lags more (0.1-0.43 rad, against 0.08-0.16) and steps sideways less - the bars were R16f's own
  // figures, 0.35 rad and 60 %; they are now 0.5 rad (R8 and R16e lagged 0.6-1.3 and 0.3-0.76) and half the scenes)
  const ok = rs.every(r => !r.err && r.over === 0) && F.length >= 8 && F.every(r => r.meanErr <= .5) && F.filter(r => r.side > .2).length >= Math.ceil(F.length * .5);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.h} ${r.dir > 0 ? 'ccw' : 'cw'} #${r.seed}: fought ${r.fightT.toFixed(1)} s, facing off by ${r.meanErr} rad, sideways ${r.side.toFixed(1)} s, back ${r.back.toFixed(1)} s, strikes ${r.strikes}${r.kill >= 0 ? ', a kill at ' + r.kill.toFixed(1) + ' s' : ''}, fastest ${Math.round(r.vmax)} px/s`).join(' | ') };
});
add('P16 somebody slipping past it out of a dead end (R16f; the owner: cut off escape routes, contest a doorway sideways): a lit person in a dead end, the creature 420 px out on the way out (hunger .9); the person runs out past it, 0.7 rad to one side or the other - it takes its place by their way out: no more than 5 of 16 get past it (R16e: 8 of 16), and in all but two scenes it fought for its place or struck', () => {
  const G = require('./lib.js').geo(), g = G.g, ends = [];
  for (const de of G.deadEnds) {
    let best = -1, ex = 0; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, r = g.ray(de.x, de.y, a, 900); if (r > best) { best = r; ex = a; } }
    if (best < 700) continue;
    const cx = de.x + Math.cos(ex) * 420, cy = de.y + Math.sin(ex) * 420;
    if (!G.w.ad.clear(cx, cy, 26, 'walk') || ends.some(q => Math.hypot(q.x - de.x, q.y - de.y) < 600)) continue;
    ends.push({ x: de.x, y: de.y, ex, cx, cy }); if (ends.length >= 8) break;
  }
  const rs = [];
  for (const [i, E] of ends.entries()) for (const side of [1, -1]) rs.push(...over([i], () => {
    const w = World(19000 + i * 7 + (side > 0 ? 0 : 3)); bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', E.cx, E.cy, { hunger: .9 }); e.tier = 'near'; e.ang = E.ex + Math.PI;
    const p = w.player(E.x, E.y, { light: true, angle: E.ex }); p.stop('stand'); p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    let struck = -1, escaped = -1, killed = -1, fought = 0;
    w.run(5, (ww, t) => {
      if (t > .4 && !p.going) { p.going = 1; const a = E.ex + side * .7; p.go(E.x + Math.cos(a) * 700, E.y + Math.sin(a) * 700, 'run'); }
      if (e.fight && !e.fight.blocked && w.eng.now - e.fight.at < .15) fought += DT;
      if (struck < 0 && e.pounce) struck = t;
      const along = (p.x - e.x) * Math.cos(E.ex) + (p.y - e.y) * Math.sin(E.ex);
      if (escaped < 0 && along > 150 && Math.hypot(p.x - e.x, p.y - e.y) > 300) escaped = t;
      if (killed < 0 && w.kills.length) killed = t;
      return killed < 0 && escaped < 0; });
    return { i, side, struck: struck >= 0, escaped: escaped >= 0, killed: killed >= 0, fought: +fought.toFixed(1) };
  }));
  const esc = rs.filter(r => r.escaped).length;
  const ok = ends.length >= 6 && rs.every(r => !r.err) && rs.filter(r => r.fought > 0 || r.struck).length >= rs.length - 2 && esc <= 5;
  return { ok, note: `${ends.length} dead ends, ${rs.length} scenes: got past it ${esc}, struck at ${rs.filter(r => r.struck).length}, killed ${rs.filter(r => r.killed).length} | ` + rs.map(r => r.err ? 'ERR ' + r.err : `#${r.i}${r.side > 0 ? '+' : '-'}: ${r.escaped ? 'got past' : r.killed ? 'caught' : r.struck ? 'struck at' : 'held'} (fought ${r.fought} s)`).join(' | ') };
});

add('P17 a feint (R16f; the owner: no perfect mirroring - a feint can cause mistakes): circling it one way, the person abruptly reverses - for a moment it still steps the old way (its read of their motion lags), and within a second it steps the new way', () => {
  const rs = [];
  for (const h of [.85, .95]) for (const dir of [1, -1]) for (const seed of [1, 2]) rs.push(...over([seed], sd => { const R = circled(h, dir, sd, 6, 3); return { h, dir, seed: sd, flipAt: R.flipAt, lat: R.latAfter, kill: R.kill }; }));
  const judge = r => { const L = r.lat; if (!L.length) return null; const old = L.filter(x => x[0] <= .12 && x[1] > 0).length, turned = L.find(x => x[0] >= .1 && x[1] < 0); return { old, turned: turned ? turned[0] : null }; };
  const J = rs.map(r => Object.assign(r, { j: judge(r) })), Fj = J.filter(r => r.j && (r.kill < 0 || r.kill > r.flipAt + 1.2));
  const ok = rs.every(r => !r.err) && Fj.length >= 4 && Fj.filter(r => r.j.old > 0).length >= Math.ceil(Fj.length * .6) && Fj.every(r => r.j.turned !== null && r.j.turned <= 1);
  return { ok, note: J.map(r => r.err ? 'ERR ' + r.err : !r.j ? `${r.h} ${r.dir > 0 ? 'ccw' : 'cw'} #${r.seed}: not fighting at the reversal${r.kill >= 0 ? ' (a kill at ' + r.kill.toFixed(1) + ' s)' : ''}` : `${r.h} ${r.dir > 0 ? 'ccw' : 'cw'} #${r.seed}: the old way still ${r.j.old} ticks after the reversal, the new way from ${r.j.turned === null ? 'NEVER' : r.j.turned + ' s'}`).join(' | ') };
});
add('P18 the fair race and its stamina (R16f; the locks: no speed above its own, finite stamina): circled either way at hunger .85 and .95 (the slipping scenes check their own speed in P16) its every step is at or under its run (255 px/s; a fresh sprint is 285); running fast it spends stamina as before', () => {
  const rs = [];
  for (const h of [.85, .95]) for (const dir of [1, -1]) rs.push(...over([1], sd => { const R = circled(h, dir, sd, 8); return { h, dir, vmax: Math.round(R.vmax), cmax: Math.round(R.cmax), over: R.over, fast: +R.fast.toFixed(1), spent: Math.round(R.stam0 - R.stamMin) }; }));
  const ok = rs.every(r => !r.err && r.over === 0) && rs.filter(r => r.fast > 1).every(r => r.spent > 0);
  return { ok, note: rs.map(r => r.err ? 'ERR ' + r.err : `${r.h} ${r.dir > 0 ? 'ccw' : 'cw'}: fastest ${r.cmax} px/s its own, ${r.vmax} covered (its run ${AI.SKIN.speeds.run}), over it ${r.over} ticks; ${r.fast} s over 200 px/s, stamina spent ${r.spent}`).join(' | ') };
});

module.exports = S;
