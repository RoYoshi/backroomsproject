#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/threat_sim.js - Trial 3 R18 (the owner's overtuned experiment, sections 10 and 11): ordinary play,
 * headless, at the players' true speeds.  Development tool; checkpoint evidence, not a gate step.  Trial 3 is not owner-approved.
 *
 *   node threat_sim.js [--dir TREE] [--mins 10] [--seeds 4] [--hunger .55] [--out FILE.json]
 *
 * Why headless: under SwiftShader a real page draws 1-6 frames a second and a page's own movement is frame-limited (at most 0.25 s of it a
 * frame) - a page with its keys held covers 70-140 px/s, never a walk (172) or a fresh sprint (285): the real-page campaigns measure what
 * the creature does, but not how it fares against a person moving as a person does.  Here every person is moved by the game's own
 * move.js (dev/harness.js: the same acceleration, stamina, exhaustion, crouch and collision as the browser) on the real server - DIR's
 * own (its dev/tests/lib.js and the ai.js it builds) - so R18, R16i and R8 meet the same people, seed for seed.
 *
 * Two people play for --mins minutes against one Skin-Stealer (its hunger from --hunger, rising as it does): they explore the level on
 * foot (walking, now and then running, the torch on in the dark), and when THEY see it (their own view: a clear line, within 650 px and
 * their field of view, or 220 px whatever way they face) they answer as players do, a drawn choice per meeting - sprint away, walk away,
 * hide in the nearest dark and crouch still, circle it and reverse, stand and watch it, or take another way out - and go back to
 * exploring once it has been out of their view a while.  A person it kills comes back 5 s later somewhere far from it.  Nothing here moves
 * the creature or tells it anything: what it knows is what its own senses give it on the server.
 *
 * Per run and in all: the time in each movement band (still, stealth <= 100, casual <= 180, prowl <= 218, investigation <= 245,
 * aggressive <= 266, pursuit; strikes, recoveries and vault crossings apart) - in all, and while it is engaged (a plan or a hunt about
 * somebody); its mean speed while it pursues an objective; the time it stands with no plan; its plans begun a minute by kind, and the
 * reason it gave for each departure; its presses, chases and interceptions; the time from first seeing somebody to a plan about them;
 * how soon it was within 200 px of somebody walking away; the meetings ended by an escape or a capture; its stamina (lowest, time
 * exhausted); the times it saw a lit person within 500 px for 3 s and did nothing about them while hungry (an ignored opening); and
 * every sample faster than its run outside a strike or a vault (an unfairness). */
'use strict';
const path = require('path'), fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir', path.join(__dirname, '..', '..', '..'))), MINS = +arg('mins', 10), SEEDS = +arg('seeds', 4), H0 = +arg('hunger', .55);
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
    plans: {}, leaves: {}, press: 0, chase: 0, intercept: 0, interceptMet: 0, detect: [], walkClose: [], meetings: 0, escapes: 0, captures: 0,
    stamMin: 100, exhT: 0, exhN: 0, ignored: 0, over: 0, overMax: 0, kills: 0, choices: {}, log: [] };
  let lastPlan = null, lastK = '', seenSince = new Map(), ignoreRun = new Map(), wasExh = false, lx = e.x, ly = e.y;
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
    if (!w.eng.entities.includes(e)) return true;
    M.secs += DT; const v = Math.hypot(e.x - lx, e.y - ly) / DT, sp = e.speed || 0; lx = e.x; ly = e.y;
    const P = e.plan, k = P ? P.k : 'roam';
    if (P && P !== lastPlan && k === 'leave') { const why = (e.dbg.why || '').replace(/P\d+/g, 'P').replace(/\d+/g, 'N'); M.leaves[why] = (M.leaves[why] || 0) + 1; }   // (its reason for each departure, names and numbers out)
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
      if (sp > RUN + .5 || v > RUN * 1.03 + 2) { M.over++; M.overMax = Math.max(M.overMax, Math.round(Math.max(sp, v))); } }
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
  M.kills = w.kills.filter(x => x.kind === 'SkinStealer').length; M.hungerEnd = +e.hunger.toFixed(2); M.press = e.tally.press || 0;
  return M;
}
const all = []; for (let s = 1; s <= SEEDS; s++) { const t0 = Date.now(); const M = run(s); M.wall = Math.round((Date.now() - t0) / 1000); all.push(M); }
const sum = k => all.reduce((a, m) => a + m[k], 0), mins = sum('secs') / 60, moving = all.reduce((a, m) => a + Object.values(m.band).reduce((x, y) => x + y, 0), 0);
const bandS = Object.fromEntries(BANDS.map(([b]) => [b, +all.reduce((a, m) => a + m.band[b], 0).toFixed(1)]));
const bandE = Object.fromEntries(BANDS.map(([b]) => [b, +all.reduce((a, m) => a + m.bandE[b], 0).toFixed(1)])), engagedS = Object.values(bandE).reduce((x, y) => x + y, 0);
const plansPM = {}; for (const m of all) for (const [k, n] of Object.entries(m.plans)) plansPM[k] = (plansPM[k] || 0) + n; for (const k in plansPM) plansPM[k] = +(plansPM[k] / mins).toFixed(2);
const det = all.flatMap(m => m.detect).sort((a, b) => a - b), wc = all.flatMap(m => m.walkClose), med = a => a.length ? a[Math.floor(a.length / 2)] : null;
const OUT = { tool: 'threat_sim.js', tree: path.basename(DIR), run: RUN, mins: +mins.toFixed(1), seeds: SEEDS, hunger0: H0,
  bandsS: bandS, bandsPct: Object.fromEntries(Object.entries(bandS).map(([b, s]) => [b, +(100 * s / Math.max(1, moving)).toFixed(1)])),
  bandsEngagedS: bandE, bandsEngagedPct: Object.fromEntries(Object.entries(bandE).map(([b, s]) => [b, +(100 * s / Math.max(1, engagedS)).toFixed(1)])),
  strikeS: +sum('strike').toFixed(1), vaultS: +sum('trav').toFixed(1), farS: +sum('far').toFixed(1),
  pursuitMeanV: Math.round(sum('purposeD') / Math.max(1, sum('purposeT'))), purposeS: +sum('purposeT').toFixed(1),
  idleNoPlanS: +sum('idle').toFixed(1), watchS: +sum('idleWatch').toFixed(1), plansPerMin: plansPM,
  leaveReasons: all.reduce((a, m) => { for (const [k, n] of Object.entries(m.leaves)) a[k] = (a[k] || 0) + n; return a; }, {}),
  presses: sum('press'), chases: sum('chase'), interceptions: sum('intercept'), interceptionsMet: sum('interceptMet'),
  detectToAction: { n: det.length, median: med(det), max: det.length ? det[det.length - 1] : null },
  walkAway: { n: wc.length, closedWithin200: wc.filter(x => x !== null).length, medianCloseS: med(wc.filter(x => x !== null).sort((a, b) => a - b)) },
  meetings: sum('escapes') + sum('captures'), escapes: sum('escapes'), captures: sum('captures'), kills: sum('kills'),
  stamina: { lowest: +Math.min(...all.map(m => m.stamMin)).toFixed(1), exhaustedS: +sum('exhT').toFixed(1), exhaustions: sum('exhN') },
  ignoredOpenings: sum('ignored'), overRun: sum('over'), overMax: Math.max(0, ...all.map(m => m.overMax)), choices: all.reduce((a, m) => { for (const [k, n] of Object.entries(m.choices)) a[k] = (a[k] || 0) + n; return a; }, {}),
  runs: all.map(m => ({ kills: m.kills, escapes: m.escapes, captures: m.captures, hungerEnd: m.hungerEnd, wall: m.wall })),
  byChoice: (() => { const o = {}; for (const m of all) for (const x of m.log) { const q = o[x.c] || (o[x.c] = { n: 0, captured: 0, itSawThem: 0, closeWithin200: 0 }); q.n++; if (x.out === 'capture') q.captured++; if (x.saw > 0) q.itSawThem++; if (x.dmin < 200) q.closeWithin200++; } return o; })(),
  meetingsLog: all.flatMap((m, i) => m.log.map(x => Object.assign({ run: i + 1 }, x))) };
console.log(JSON.stringify(OUT, null, 1));
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(OUT, null, 1) + '\n');
