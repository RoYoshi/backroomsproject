#!/usr/bin/env node
/* dev/trial-3-r20-strategic-ambush/tools/hunt_sim.js - Trial 3 R20, S track: R19's prechase_sim.js (copied; everything it measured is
 * measured the same way) with what the R20 pack asks of a hunt: running (time over runFrom, each uninterrupted run's length), how each
 * capture came about (staged: an ambush, a lure, a post, an interception it had reached - within 12 s before; chased: a chase within
 * 12 s), the time to reach a position (an interception's, a post's), and the creature's own tallies.  Development tool; evidence.
 *
 * (R19's header follows.)
 * dev/trial-3-r19-positioning/tools/prechase_sim.js - Trial 3 R19, S track (the Skin-Stealer's pre-chase positioning): R18's ordinary-play
 * measurement (dev/trial-3-r9-overhaul/tools/threat_sim.js, copied here unchanged in what it measures) with what the owner's R19 pack
 * asks of the time before a chase.  Development tool; evidence, not a gate step.  Trial 3 is not owner-approved.
 *
 *   node prechase_sim.js [--dir TREE] [--mins 10] [--seeds 4] [--from 1] [--hunger .55] [--out FILE.json] [--log 1]
 *
 * Two people play for --mins minutes against one Skin-Stealer (its hunger from --hunger, rising as it does): they explore the level on foot
 * (walking, now and then running, the torch on in the dark), and when THEY see it (their own view: a clear line, within 650 px and their
 * field of view, or 220 px whatever way they face) they answer as players do - a drawn choice per meeting: sprint away, walk away, hide in
 * the nearest dark and crouch still, circle it and reverse, stand and watch it, or take another way out - and go back to exploring once it
 * has been out of their view a while.  A person it kills comes back 5 s later far from it.  Every person is moved by the game's own move.js
 * (dev/harness.js) on the tree's own server, so trees meet the same people seed for seed until the creatures differ.  Nothing here moves
 * the creature or tells it anything; what is read of it is read to measure.
 *
 * R18's measures (threat_sim.js's: movement bands, pursuit speed, plans, presses, chases, interceptions, meetings, escapes, captures,
 * stamina, ignored openings, unfair samples, departures and their reasons) and, R19:
 *   flanks        every covert way round somebody it begins: its length against the straight distance (the detour), how long it took,
 *                 how it ended (at its spot, or given up and why), and whether its quarry was still within 350 px when it ended (a useful
 *                 position) - the owner's "clever but absent"
 *   openings      from a meeting's first sight (theirs or its) to its first plan about them, to within 200 px of them, and to a chase
 *   positions     (R19 trees) the positioning record its debug carries (e.dbg.pos: an open approach's aim at their way out, a way round
 *                 refused for its time), counted by kind
 *   --log 1       to stderr, one line each: OVER (a tick it moved faster than its run - its seed, time, tier, plan, act, where from and to,
 *                 its last reason) and STALE (a vault of its still open while its body is over 200 px from the vault: R8-R18's open vault,
 *                 the R19 audit); seeds --from..--seeds (the same seeds as a run from 1 for those seeds) */
'use strict';
const path = require('path'), fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir', path.join(__dirname, '..', '..', '..'))), MINS = +arg('mins', 10), SEEDS = +arg('seeds', 4), H0 = +arg('hunger', .55), LOG = +arg('log', 0), FROM = +arg('from', 1);
const L = require(path.join(DIR, 'dev', 'tests', 'lib.js')), { World, DT, AI, geo } = L;
const RUN = AI.SKIN.speeds.run;
const BANDS = [['still', 8], ['stealth', 100], ['casual', 180], ['prowl', 218], ['investigation', 245], ['aggressive', 266], ['pursuit', 1e9]];
const STRIKE = new Set(['wind', 'pounce', 'recover', 'feed']);
const PURPOSE = new Set(['approach', 'chase', 'intercept', 'search', 'flank', 'lure', 'mingle']);
const CHOICES = [['sprint', .24], ['walk', .2], ['hide', .2], ['circle', .1], ['watch', .14], ['otherway', .12]];
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function run(seed) {
  const G = geo(), w = World(seed * 7907 + 18000), g = w.eng.geo, R0 = rng(seed + 11);
  const floor = (near, lo, hi) => { for (let k = 0; k < 400; k++) { const c = G.cells[Math.floor(R0() * G.cells.length)], x = g.cx(c), y = g.cy(c), d = near ? Math.hypot(x - near.x, y - near.y) : 0;
    if (w.ad.clear(x, y, 24, 'walk') && (!near || (d >= lo && d <= hi))) return { x, y }; } return null; };
  const start = floor(null), e = w.eng.spawn('skinstealer', start.x, start.y, { hunger: H0 });
  const people = [];
  const add = () => { const at = floor(e, 1600, 4000) || floor(null), p = w.player(at.x, at.y, { light: false }); p.stop('stand');
    const B = { p, rnd: rng(seed * 31 + people.length + 1), mode: 'explore', until: 0, seenIt: -99, choice: '', meet: null, goal: null }; people.push(B); return B; };
  add(); add();
  const M = { secs: 0, band: Object.fromEntries(BANDS.map(b => [b[0], 0])), bandE: Object.fromEntries(BANDS.map(b => [b[0], 0])), strike: 0, trav: 0, purposeT: 0, purposeD: 0, idle: 0, idleWatch: 0, far: 0,
    plans: {}, leaves: {}, flanks: [], positions: {}, press: 0, chase: 0, intercept: 0, interceptMet: 0, detect: [], walkClose: [], meetings: 0, escapes: 0, captures: 0,
    stamMin: 100, exhT: 0, exhN: 0, ignored: 0, over: 0, overMax: 0, kills: 0, choices: {}, log: [] };
  const R2 = { cur: 0, segs: [], hist: [], lastP: null, wasCap: false, runRecent: [] }; M.runT = 0; M.ttp = []; M.capPlans = [];
  let FL = null, lastPos = null, lastPlan = null, lastK = '', seenSince = new Map(), ignoreRun = new Map(), wasExh = false, lx = e.x, ly = e.y, staleOn = false;
  const sees = (p, x, y) => { const d = Math.hypot(x - p.x, y - p.y); if (d > 650) return false; if (!g.los(p.x, p.y, x, y)) return false;
    if (d < 220) return true; const a = Math.atan2(y - p.y, x - p.x); return Math.abs(Math.atan2(Math.sin(a - p.angle), Math.cos(a - p.angle))) < 1.1; };
  w.run(MINS * 60, (ww, t) => {
    // the people: each sees what it sees and answers
    for (const B of people.slice()) {
      const p = B.p;
      if (p.dead) { if (!B.deadAt) { B.deadAt = t; if (B.meet) { M.captures++; if (B.choice === 'walk') M.walkClose.push(B.meet.closeAt === null ? +(t - B.meet.t).toFixed(2) : B.meet.closeAt); M.log.push(Object.assign({ out: 'capture', dur: +(t - B.meet.t).toFixed(1) }, B.meet, { dmin: 0, saw: +B.meet.saw.toFixed(1), plans: B.meet.plans.join('>') })); B.meet = null; } } else if (t - B.deadAt > 5) { w.sim.removePlayer(p); people.splice(people.indexOf(B), 1); add(); } continue; }
      const dark = (g.lamp[g.cellAt(p.x, p.y)] || 0) < .08; if (B.mode !== 'hide') p.light = dark;
      const see = !w.eng.entities.includes(e) ? false : sees(p, e.x, e.y);
      if (see) B.seenIt = t;
      if (see && B.mode === 'explore') {                                                    // a meeting: a drawn answer
        let r = B.rnd(), c = CHOICES[CHOICES.length - 1][0]; for (const [k, wgt] of CHOICES) { if (r < wgt) { c = k; break; } r -= wgt; }
        B.choice = c; B.mode = c; B.since = t; M.choices[c] = (M.choices[c] || 0) + 1; B.meet = { t, closeAt: null, c, d0: Math.round(Math.hypot(p.x - e.x, p.y - e.y)), h: +e.hunger.toFixed(2), saw: 0, plans: [], dmin: 1e9 };
        const ax = p.x - e.x, ay = p.y - e.y, al = Math.hypot(ax, ay) || 1, far = { x: p.x + ax / al * 1500, y: p.y + ay / al * 1500 };
        if (c === 'sprint' || c === 'walk') { const q = floor(far, 0, 900) || floor(p, 1200, 2600); if (q) p.pathTo(q.x, q.y, c === 'sprint' ? 'run' : 'walk'); p.look = null; }
        else if (c === 'otherway') { const q = floor(p, 900, 2000); if (q) p.pathTo(q.x, q.y, 'walk'); p.look = null; }
        else if (c === 'hide') { let best = null, bd = 1e9; for (const q of G.dark) { const d = Math.hypot(q.x - p.x, q.y - p.y), de = Math.hypot(q.x - e.x, q.y - e.y); if (d < bd && d < 700 && de > d + 150 && w.ad.clear(q.x, q.y, 24, 'walk')) { bd = d; best = q; } }
          if (best) { p.light = false; p.pathTo(best.x, best.y, 'run'); B.hideGoal = best; } else { B.mode = 'walk'; const q = floor(far, 0, 900); if (q) p.pathTo(q.x, q.y, 'walk'); } }
        else if (c === 'watch') { p.stop('stand'); p.look = () => Math.atan2(e.y - p.y, e.x - p.x); B.until = t + 3 + B.rnd() * 5; }
        else if (c === 'circle') { B.dir = B.rnd() < .5 ? 1 : -1; B.flip = t + 1.5 + B.rnd() * 2; B.until = t + 6 + B.rnd() * 4; }
      }
      if (B.mode === 'circle') { if (t > B.flip) { B.dir = -B.dir; B.flip = t + 99; } const a = Math.atan2(p.y - e.y, p.x - e.x); p.go(e.x + Math.cos(a + B.dir * .5) * 240, e.y + Math.sin(a + B.dir * .5) * 240, 'run'); p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
        if (t > B.until) { B.mode = 'walk'; const q = floor(p, 1200, 2600); if (q) p.pathTo(q.x, q.y, 'run'); p.look = null; } }
      if (B.mode === 'watch' && t > B.until) { B.mode = 'walk'; const q = floor(p, 1200, 2600); if (q) p.pathTo(q.x, q.y, 'walk'); p.look = null; }
      if (B.mode === 'hide' && B.hideGoal && (!p.path || !p.path.length)) { p.stop('crouch'); p.light = false; if (!B.hid) B.hid = t; if (t - B.hid > 12 + B.rnd() * 8) { B.hid = 0; B.hideGoal = null; B.mode = 'explore'; } }
      // a meeting: closing on somebody walking away; it ends after 10 s out of their view with nothing of it after them (an escape)
      if (B.meet) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (B.choice === 'walk' && B.meet.closeAt === null && d < 200) B.meet.closeAt = t - B.meet.t;
        const Mt = B.meet; Mt.dmin = Math.min(Mt.dmin, d); if (e.seenNow.has(p.id)) Mt.saw += DT; const pk = e.plan ? e.plan.k + (e.plan.pid === p.id ? '*' : '') : '-'; if (Mt.plans[Mt.plans.length - 1] !== pk) Mt.plans.push(pk);
        const after = !!(e.plan && e.plan.pid === p.id) || !!(e.hunt && e.hunt.pid === p.id);
        if (t - B.seenIt > 10 && !after) { M.meetings++; M.escapes++; if (B.choice === 'walk') M.walkClose.push(B.meet.closeAt); M.log.push(Object.assign({ out: 'escape', dur: +(t - B.meet.t).toFixed(1) }, B.meet, { dmin: Math.round(B.meet.dmin), saw: +B.meet.saw.toFixed(1), plans: B.meet.plans.join('>') })); B.meet = null; if (B.mode !== 'hide') B.mode = 'explore'; } }
      if (B.mode !== 'explore' && B.mode !== 'hide' && (!p.path || !p.path.length) && !p.tx && B.mode !== 'watch' && B.mode !== 'circle' && t - B.seenIt > 4) B.mode = 'explore';
      if (B.mode === 'explore' && (!p.path || !p.path.length) && t > B.until) { const q = floor(p, 500, 1800); if (q) p.pathTo(q.x, q.y, B.rnd() < .15 ? 'run' : 'walk'); p.look = null; B.until = t + (B.rnd() < .3 ? 1 + B.rnd() * 3 : 0); }
    }
    // the creature: what it does, measured from its own state (never read by anybody to move it)
    if (LOG && e.trav) { const far = Math.hypot(e.x - (e.trav.ax + e.trav.bx) / 2, e.y - (e.trav.ay + e.trav.by) / 2) > 200; if (far && !staleOn) console.error('STALE ' + JSON.stringify({ seed, t: +t.toFixed(3), x: Math.round(e.x), y: Math.round(e.y), trav: [e.trav.ax, e.trav.ay, e.trav.bx, e.trav.by].map(Math.round), act: e.act, k: e.plan && e.plan.k, why: e.dbg.why })); staleOn = far; } else staleOn = false;
    if (!w.eng.entities.includes(e)) return true;
    { // (R20) running, plans, captures
      const runNow = (e.speed || 0) > AI.SK.runFrom && !e.pounce && !e.trav && !e.cap && !e.commit;
      if (runNow) { R2.cur += DT; M.runT += DT; } else if (R2.cur > 0) { R2.segs.push(+R2.cur.toFixed(2)); R2.cur = 0; }
      if (e.plan !== R2.lastP) { R2.lastP = e.plan; if (e.plan) { R2.hist.push({ k: e.plan.k, t, at: null, P: e.plan }); while (R2.hist.length > 16) R2.hist.shift(); } }
      for (const h of R2.hist) if (h.at === null && h.P.arrived) { h.at = t; if (h.k === 'intercept' || h.k === 'post') M.ttp.push({ k: h.k, s: +(t - h.t).toFixed(2) }); }
      R2.runRecent.push(runNow ? 1 : 0); if (R2.runRecent.length > 180) R2.runRecent.shift();
      if ((e.cap || e.commit) && !R2.wasCap) { const rec = R2.hist.filter(h => t - h.t < 12 || h.P === e.plan);
        M.capPlans.push({ t: +t.toFixed(1), last: (rec[rec.length - 1] || {}).k || '-', staged: rec.some(h => ['ambush', 'lure', 'post'].includes(h.k) || (h.k === 'intercept' && h.at !== null)), chased: rec.some(h => h.k === 'chase'), ran3s: +(R2.runRecent.slice(-180).reduce((a, b) => a + b, 0) * DT).toFixed(2), seq: rec.map(h => h.k).join('>'),
          mode: (() => { const L = (rec[rec.length - 1] || {}).P; return L ? L.k + ':' + (L.rush ? 'rush' : L.mode || '') + (L.ahead ? '+ahead' : '') + (L.here ? '+here' : '') + (L.post ? '+post' : '') : '-'; })(),
          surprise: (() => { const L = (rec[rec.length - 1] || {}).P, pid = L && L.pid, o = pid && e.mind && e.mind.obs.get(pid); return !!pid && !(o && w.eng.now - o.sawAt < 3); })() }); }
      R2.wasCap = !!(e.cap || e.commit);
    }
    M.secs += DT; const v = Math.hypot(e.x - lx, e.y - ly) / DT, sp = e.speed || 0, plx = lx, ply = ly; lx = e.x; ly = e.y;
    const P = e.plan, k = P ? P.k : 'roam';
    if (P && P !== lastPlan && k === 'leave') { const why = (e.dbg.why || '').replace(/P\d+/g, 'P').replace(/\d+/g, 'N'); M.leaves[why] = (M.leaves[why] || 0) + 1; }   // (its reason for each departure, names and numbers out)
    // (R19) a flank's record: begun, and ended (its spot reached, or given up - and the quarry's true distance then: a useful position?)
    if (FL && P !== FL.P) { const q = people.find(B => B.p.id === FL.pid); FL.rec.dur = +(t - FL.rec.t0).toFixed(2); FL.rec.arrived = !!FL.P.arrived; FL.rec.next = P ? P.k : 'roam'; FL.rec.dEnd = q && !q.p.dead ? Math.round(Math.hypot(q.p.x - e.x, q.p.y - e.y)) : null; FL.rec.useful = FL.rec.dEnd !== null && FL.rec.dEnd <= 350; M.flanks.push(FL.rec); FL = null; }
    if (P && P.k === 'flank' && P !== lastPlan) { const q = people.find(B => B.p.id === P.pid); FL = { P, pid: P.pid, rec: { t0: +t.toFixed(2), L: P.way ? Math.round(P.way.len) : null, exit: P.way ? Math.round(P.way.exit || 0) : null, d0: q ? Math.round(Math.hypot(q.p.x - e.x, q.p.y - e.y)) : null, qmode: q ? q.p.mode : null, h: +e.hunger.toFixed(2) } }; }
    if (e.dbg.pos && e.dbg.pos.at !== lastPos) { lastPos = e.dbg.pos.at; M.positions[e.dbg.pos.k] = (M.positions[e.dbg.pos.k] || 0) + 1; }
    for (const B of people) if (B.meet && !B.p.dead) { const Mt = B.meet, dq = Math.hypot(B.p.x - e.x, B.p.y - e.y);
      if (Mt.planAt === undefined && P && P.pid === B.p.id) Mt.planAt = +(t - Mt.t).toFixed(2);
      if (Mt.c200 === undefined && dq < 200) Mt.c200 = +(t - Mt.t).toFixed(2);
      if (Mt.chaseAt === undefined && P && P.k === 'chase' && P.pid === B.p.id) Mt.chaseAt = +(t - Mt.t).toFixed(2); }
    if (P && P !== lastPlan) { M.plans[k] = (M.plans[k] || 0) + 1; if (k === 'chase') M.chase++; if (k === 'intercept') { M.intercept++; P.__m = 1; } }
    if (lastPlan && lastPlan !== P && lastPlan.k === 'intercept' && lastPlan.__met) M.interceptMet++;
    if (P && P.k === 'intercept' && !P.__met) { const near = people.some(B => !B.p.dead && Math.hypot(B.p.x - e.x, B.p.y - e.y) < 300); if (near) P.__met = 1; }
    lastPlan = P;
    if (e.tier === 'far') M.far += DT;
    if (e.trav) M.trav += DT; else if (STRIKE.has(e.act) || e.pounce || e.recover) M.strike += DT;
    else { const engaged = !!(P && P.pid) || !!e.hunt; for (const [b, hi] of BANDS) if (sp <= hi) { M.band[b] += DT; if (engaged) M.bandE[b] += DT; break; }
      if (PURPOSE.has(k) && sp > 8) { M.purposeT += DT; M.purposeD += sp * DT; }
      if (!P && sp < 8 && e.tier !== 'far') M.idle += DT;
      if (P && P.k === 'watch') M.idleWatch += DT;
      if (sp > RUN + .5 || v > RUN * 1.03 + 2) { M.over++; M.overMax = Math.max(M.overMax, Math.round(Math.max(sp, v))); if (LOG) console.error('OVER ' + JSON.stringify({ seed, t: +t.toFixed(2), sp: Math.round(sp), v: Math.round(v), tier: e.tier, k, act: e.act, from: [Math.round(plx), Math.round(ply)], to: [Math.round(e.x), Math.round(e.y)], why: e.dbg.why })); } }
    M.stamMin = Math.min(M.stamMin, e.stam); if (e.exh) M.exhT += DT; if (e.exh && !wasExh) M.exhN++; wasExh = !!e.exh;
    for (const B of people) { const p = B.p, id = p.id; if (p.dead) continue;
      if (e.seenNow.has(id)) { if (!seenSince.has(id)) seenSince.set(id, t); const s0 = seenSince.get(id);
        if (s0 !== null && P && P.pid === id && k !== 'leave') { M.detect.push(+(t - s0).toFixed(2)); seenSince.set(id, null); }
        const lit = p.light || (g.lamp[g.cellAt(p.x, p.y)] || 0) > .3, d = Math.hypot(p.x - e.x, p.y - e.y);
        if (lit && d < 500 && e.hunger >= .45 && !e.exh && !(P && P.pid === id) && !(e.hunt && e.hunt.pid === id) && !STRIKE.has(e.act)) { const r = (ignoreRun.get(id) || 0) + DT; ignoreRun.set(id, r); if (r >= 3 && r - DT < 3) M.ignored++; } else ignoreRun.set(id, 0);
      } else { if (seenSince.get(id) !== null) seenSince.delete(id); ignoreRun.set(id, 0); }
    }
    return true;
  });
  if (R2.cur > 0) R2.segs.push(+R2.cur.toFixed(2)); M.runSegs = R2.segs; M.tally = Object.assign({}, e.tally); M.dbgFat = e.dbg && e.dbg.fat ? e.dbg.fat : null;
  M.kills = w.kills.filter(x => x.kind === 'SkinStealer').length; M.hungerEnd = +e.hunger.toFixed(2); M.press = e.tally.press || 0;
  return M;
}
const all = []; for (let s = FROM; s <= SEEDS; s++) { const t0 = Date.now(); const M = run(s); M.wall = Math.round((Date.now() - t0) / 1000); all.push(M); }
const sum = k => all.reduce((a, m) => a + m[k], 0), mins = sum('secs') / 60, moving = all.reduce((a, m) => a + Object.values(m.band).reduce((x, y) => x + y, 0), 0);
const bandS = Object.fromEntries(BANDS.map(([b]) => [b, +all.reduce((a, m) => a + m.band[b], 0).toFixed(1)]));
const bandE = Object.fromEntries(BANDS.map(([b]) => [b, +all.reduce((a, m) => a + m.bandE[b], 0).toFixed(1)])), engagedS = Object.values(bandE).reduce((x, y) => x + y, 0);
const plansPM = {}; for (const m of all) for (const [k, n] of Object.entries(m.plans)) plansPM[k] = (plansPM[k] || 0) + n; for (const k in plansPM) plansPM[k] = +(plansPM[k] / mins).toFixed(2);
const det = all.flatMap(m => m.detect).sort((a, b) => a - b), wc = all.flatMap(m => m.walkClose), med = a => a.length ? a[Math.floor(a.length / 2)] : null;
const OUT = { tool: 'hunt_sim.js', tree: path.basename(DIR), run: RUN, mins: +mins.toFixed(1), seeds: SEEDS, from: FROM, hunger0: H0,
  bandsS: bandS, bandsPct: Object.fromEntries(Object.entries(bandS).map(([b, s]) => [b, +(100 * s / Math.max(1, moving)).toFixed(1)])),
  bandsEngagedS: bandE, bandsEngagedPct: Object.fromEntries(Object.entries(bandE).map(([b, s]) => [b, +(100 * s / Math.max(1, engagedS)).toFixed(1)])),
  strikeS: +sum('strike').toFixed(1), vaultS: +sum('trav').toFixed(1), farS: +sum('far').toFixed(1),
  pursuitMeanV: Math.round(sum('purposeD') / Math.max(1, sum('purposeT'))), purposeS: +sum('purposeT').toFixed(1),
  idleNoPlanS: +sum('idle').toFixed(1), watchS: +sum('idleWatch').toFixed(1), plansPerMin: plansPM,
  leaveReasons: all.reduce((a, m) => { for (const [k, n] of Object.entries(m.leaves)) a[k] = (a[k] || 0) + n; return a; }, {}),
  flanks: (() => { const F = all.flatMap(m => m.flanks), n = F.length, md = a => { const b = a.filter(x => x !== null && x !== undefined).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
    return { n, perHour: +(n / Math.max(1, mins) * 60).toFixed(1), durMed: md(F.map(f => f.dur)), durOver5: F.filter(f => f.dur > 5).length, detourMed: md(F.map(f => f.L && f.d0 ? +(f.L / f.d0).toFixed(2) : null)),
      arrived: F.filter(f => f.arrived).length, useful: F.filter(f => f.useful).length, absentMovingAway: F.filter(f => f.dur > 5 && !f.useful).length, ends: F.reduce((a, f) => { a[f.next] = (a[f.next] || 0) + 1; return a; }, {}) }; })(),
  positions: all.reduce((a, m) => { for (const [k, n] of Object.entries(m.positions)) a[k] = (a[k] || 0) + n; return a; }, {}),
  openings: (() => { const L = all.flatMap(m => m.log), md = a => { const b = a.filter(x => x !== null && x !== undefined).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
    return { meetings: L.length, plan: { n: L.filter(x => x.planAt !== undefined).length, med: md(L.map(x => x.planAt)) }, within200: { n: L.filter(x => x.c200 !== undefined).length, med: md(L.map(x => x.c200)) }, chase: { n: L.filter(x => x.chaseAt !== undefined).length, med: md(L.map(x => x.chaseAt)) } }; })(),
  presses: sum('press'), chases: sum('chase'), interceptions: sum('intercept'), interceptionsMet: sum('interceptMet'),
  detectToAction: { n: det.length, median: med(det), max: det.length ? det[det.length - 1] : null },
  walkAway: { n: wc.length, closedWithin200: wc.filter(x => x !== null).length, medianCloseS: med(wc.filter(x => x !== null).sort((a, b) => a - b)) },
  meetings: sum('escapes') + sum('captures'), escapes: sum('escapes'), captures: sum('captures'), kills: sum('kills'),
  stamina: { lowest: +Math.min(...all.map(m => m.stamMin)).toFixed(1), exhaustedS: +sum('exhT').toFixed(1), exhaustions: sum('exhN') },
  ignoredOpenings: sum('ignored'), overRun: sum('over'), overMax: Math.max(0, ...all.map(m => m.overMax)), choices: all.reduce((a, m) => { for (const [k, n] of Object.entries(m.choices)) a[k] = (a[k] || 0) + n; return a; }, {}),
  r20: (() => { const segs = all.flatMap(m => m.runSegs).sort((a, b) => a - b), q = f => segs.length ? segs[Math.min(segs.length - 1, Math.floor(segs.length * f))] : 0, C = all.flatMap(m => m.capPlans), T = all.flatMap(m => m.ttp), md = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
    const tl = {}; for (const m of all) for (const [k, v] of Object.entries(m.tally || {})) if (typeof v === 'number') tl[k] = (tl[k] || 0) + v;
    return { runS: +sum('runT').toFixed(1), runShare: +(sum('runT') / Math.max(1, sum('secs'))).toFixed(4), runSegs: { n: segs.length, med: q(.5), p90: q(.9), max: segs.length ? segs[segs.length - 1] : 0, over3: segs.filter(x => x > 3).length, over6: segs.filter(x => x > 6).length },
      captures: C.length, surprised: C.filter(c => c.surprise).length, surprisedNoRun: C.filter(c => c.surprise && c.ran3s < .5).length, modes: C.reduce((a, c) => { a[c.mode || '-'] = (a[c.mode || '-'] || 0) + 1; return a; }, {}), staged: C.filter(c => c.staged).length, chased: C.filter(c => c.chased).length, stagedNoChase: C.filter(c => c.staged && !c.chased).length, capLast: C.reduce((a, c) => { a[c.last] = (a[c.last] || 0) + 1; return a; }, {}), ranBeforeCap: md(C.map(c => c.ran3s)),
      ttp: { intercept: { n: T.filter(x => x.k === 'intercept').length, med: md(T.filter(x => x.k === 'intercept').map(x => x.s)) }, post: { n: T.filter(x => x.k === 'post').length, med: md(T.filter(x => x.k === 'post').map(x => x.s)) } },
      tally: tl, capSeqs: C.map(c => c.seq) }; })(),
  runs: all.map(m => ({ kills: m.kills, escapes: m.escapes, captures: m.captures, hungerEnd: m.hungerEnd, wall: m.wall })),
  byChoice: (() => { const o = {}; for (const m of all) for (const x of m.log) { const q = o[x.c] || (o[x.c] = { n: 0, captured: 0, itSawThem: 0, closeWithin200: 0 }); q.n++; if (x.out === 'capture') q.captured++; if (x.saw > 0) q.itSawThem++; if (x.dmin < 200) q.closeWithin200++; } return o; })(),
  meetingsLog: all.flatMap((m, i) => m.log.map(x => Object.assign({ run: i + 1 }, x))) };
console.log(JSON.stringify(OUT, null, 1));
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(OUT, null, 1) + '\n');
