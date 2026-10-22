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
 * The server's own functions are reached through a test-only copy of the built ai.js whose return also names them (the module itself is
 * unchanged; the copy is compiled in memory, never written). */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const { World, DT, LONG, over, bystander, floorNear } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const ROOT = path.join(__dirname, '..', '..');
const INNER = (() => {
  const file = path.join(ROOT, 'generated', 'server', 'ai.js'), src = fs.readFileSync(file, 'utf8'), ret = 'return { create, S, SNAMES,';
  if (src.split(ret).length !== 2) throw new Error('ai.js: its return is not where this test expects it');
  const m = new Module(file + '#ap', module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(src.replace(ret, 'return { skPreempt, skPlanClass, skLeftFor, skRefractory, skPatrolGoal, SKP, create, S, SNAMES,'), file);
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
  const tt = mk(); tt.plan = { k: 'approach', pid: 9 }; const tp = tt.plan; const tr = run(tt, 1, () => true); out.tactical = tr.length === 1 && tt.plan === tp && tt.pre.force === '' && /weighs them against its approach/.test(tr[0][1]);
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
add('P08 its prowling reads no hidden truth (R16d; the locks: no hidden player truth): a hungry creature (.7 / .95) sees a person cross its view and go, then prowls for 40 s; a second person, never sensed, crouches unlit at one of two far places - its every move and decision is the same in both worlds until it senses that second person', () => {
  const rs = [];
  for (const h of [.7, .95]) rs.push(...over([1, 2, 3], seed => {
    const T = where => {
      const w = World(seed * 5 + 17800 + Math.round(h * 100)); bystander(w, 1300, 3300);
      const e = w.eng.spawn('skinstealer', 4600, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
      const a = w.player(5300, LONG.y - 200, { light: true, angle: Math.PI / 2 }); a.go(5300, LONG.y + 1400, 'walk');
      const q = w.player(where.x, where.y, { light: false }); q.stop('crouch');
      const tr = []; w.run(40, () => { e.tier = 'near'; e.tierT = 99; if (a.y > LONG.y + 300 && a.light) a.light = false; tr.push(line(e, q)); return true; });
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

module.exports = S;
