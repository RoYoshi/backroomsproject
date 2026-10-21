#!/usr/bin/env node
/* dev/trial-3-predator-refinement/tools/thrash_pr.js - R4: does it dither?  (development only; evidence for the checkpoints, not a gate
 * step.  Trial 3 is not owner-approved.)
 *
 *   node dev/trial-3-predator-refinement/tools/thrash_pr.js [--repo DIR] [--seeds 1,2,3,4,5,6] [--secs 240] [--out FILE.json]
 *
 * Long scenes on the real simulation (dev/harness.js), a Skin-Stealer at hunger .55 / .75 / .95 against:
 *   wander  a person walking, running, crouching and switching the torch between six places in the dark south-west (SK25's stretch);
 *   watch   a lit person in the long hall who keeps facing it, standing, and backs off when it comes within 300 px (eye contact);
 *   hide    a person who after being seen hides crouched in the dark north passage and stays there.
 * For each run, from its plan (e.plan) and act ten times a second: plan changes a minute; plans that lasted under 0.3 s (outside a strike);
 * A > B > A switches inside 2 s; act changes a minute and acts shown under 0.1 s; the longest unbroken stretch of each plan.  It reads the
 * AI only to report it. */
'use strict';
const path = require('path'), fs = require('fs');
const ARG = { seeds: '1,2,3,4,5,6', secs: '240' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(ARG.repo || path.join(__dirname, '..', '..', '..'));
const { World, DT } = require(path.join(REPO, 'dev', 'harness.js'));
const SEEDS = ARG.seeds.split(',').map(Number), SECS = +ARG.secs;
function far(w) { const q = w.player(600, 3900, { light: false }); q.stop('crouch'); return q; }   // keeps the world awake, out of reach
const SCENES = {
  wander(w, seed) {
    const pts = [{ x: 700, y: 5330 }, { x: 1300, y: 5900 }, { x: 1720, y: 4900 }, { x: 1900, y: 5560 }, { x: 600, y: 5900 }, { x: 1300, y: 5150 }];
    const p = w.player(700, 5900, { light: true }); p.stop('stand'); let leg = 0;
    return { p, ex: 1850, ey: 5570, step() { if ((!p.path || !p.path.length) && !p.tx) { const q = pts[(leg * 7 + seed) % pts.length]; leg++; p.light = leg % 3 !== 0; p.pathTo(q.x, q.y, leg % 4 === 1 ? 'run' : leg % 5 === 2 ? 'crouch' : 'walk'); } } };
  },
  watch(w) {
    const p = w.player(5000, 3504, { light: true, angle: 0 }); p.stop('stand');
    return { p, ex: 5450, ey: 3504, step(e) { p.look = Math.atan2(e.y - p.y, e.x - p.x); const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 300 && !p.tx) p.go(Math.max(3100, p.x - 500), 3504, 'walk'); } };
  },
  hide(w) {
    const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand'); let ph = 0;
    return { p, ex: 2100, ey: 5560, step(e, t) {
      if (ph === 0 && t > .5) { ph = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
      if (ph === 1 && p.y < 5440) p.light = false;
      if (ph === 1 && p.path && !p.path.length) { ph = 2; p.route([{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], 'crouch'); }
      if (ph === 2 && p.path && !p.path.length) { ph = 3; p.stop('crouch'); } } };
  },
};
const out = [];
for (const name of Object.keys(SCENES)) for (const h of [.55, .75, .95]) for (const seed of SEEDS) {
  const w = World(seed * 31 + 9000); far(w);
  const S = SCENES[name](w, seed), e = w.eng.spawn('skinstealer', S.ex, S.ey, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  let cur = null, t0 = 0, hist = [], short = 0, aba = 0, plans = 0, acts = 0, flick = 0, lastAct = null, actT = 0; const longest = {};
  w.run(SECS, (ww, t) => {
    S.step(e, t);
    const P = e.plan, k = P ? P.k : 'roam';
    if (P !== cur) {
      const dur = t - t0, pk = cur ? cur.k : 'roam';
      if (cur && dur < .3 && !e.pounce && !e.recover && k !== 'feed') short++;
      longest[pk] = Math.max(longest[pk] || 0, +dur.toFixed(1));
      hist.push([k, t]); plans++;
      const n = hist.length; if (n >= 3 && hist[n - 1][0] === hist[n - 3][0] && hist[n - 1][0] !== hist[n - 2][0] && t - hist[n - 3][1] < 2) aba++;
      cur = P; t0 = t;
    }
    if (e.act !== lastAct) { if (lastAct !== null && t - actT < .1 && !e.pounce && !e.recover) flick++; acts++; lastAct = e.act; actT = t; }
    return true;
  });
  const min = SECS / 60;
  out.push({ scene: name, h, seed, plansPerMin: +(plans / min).toFixed(1), shortPlans: short, aba, actsPerMin: +(acts / min).toFixed(1), actFlicker: flick, kills: w.kills.length, longest });
}
const sum = {};
for (const r of out) { const k = r.scene + ' ' + r.h; const s = sum[k] || (sum[k] = { n: 0, plans: 0, short: 0, aba: 0, acts: 0, flick: 0, kills: 0 }); s.n++; s.plans += r.plansPerMin; s.short += r.shortPlans; s.aba += r.aba; s.acts += r.actsPerMin; s.flick += r.actFlicker; s.kills += r.kills; }
for (const k in sum) { const s = sum[k]; console.log(`${k}: plan changes ${(s.plans / s.n).toFixed(1)}/min, under 0.3 s ${s.short}, A>B>A in 2 s ${s.aba}, act changes ${(s.acts / s.n).toFixed(1)}/min, acts under 0.1 s ${s.flick}, kills ${s.kills}/${s.n}`); }
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify({ tool: 'thrash_pr.js', seeds: SEEDS, secs: SECS, runs: out, summary: sum }, null, 1));
