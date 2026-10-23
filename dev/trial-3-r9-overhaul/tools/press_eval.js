#!/usr/bin/env node
/* R16i: the owner's clarification of October 22 - "evaluate 230-245 px/s for purposeful aggressive approaches, without making it the
 * creature's universal walking speed" (the Wanderer's movement locked: s_wandererlock.js).  The same meetings on a tree, with its press at
 * a chosen speed (or a tree without one), seeded:
 *   stand    a lit person stands in the long hall and watches it come, 650 px off (very hungry, rested)
 *   walk     the same person walks away from it (172 px/s, their own move.js) once it is within 560 px
 *   sprint   the same person sprints away, fresh (285 px/s), once it is within 560 px - the straight race a rested runner must win
 *   unseen   a dark person with their back to it, 650 px off: nobody sees it far off - no press until it is in their view by the game's
 *            own rules (close behind them a person sees all round)
 *   fed      hunger .5 (hungry, not very): no press (its pace)
 *   winded   stamina 15 (tired: under stamLow, its cap the fatigued 180): no press
 * Per run: its plans, its top speed outside a spring or a vault, how long it pressed, its mean speed while pressing, its stamina left,
 * the time from the start until it was within its footwork's range (340 px), whether it caught them, and (sprint) the gap at the end.
 *   node press_eval.js [--dir TREE] [--press V] [--seeds N] [--out FILE.json] */
'use strict';
const path = require('path'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const DIR = path.resolve(arg('dir') || path.join(__dirname, '..', '..', '..')), SEEDS = +(arg('seeds') || 6), PRESS = arg('press');
const { World, LONG, AI, bystander } = require(path.join(DIR, 'dev', 'tests', 'lib.js'));
if (PRESS !== null) { if (!AI.SKIN.speeds.press) throw new Error('this tree has no press speed'); AI.SKIN.speeds.press = +PRESS; }
const has = !!AI.SKIN.speeds.press;
const SCENES = {
  stand: { hunger: .85 }, walk: { hunger: .85, flee: 'walk' }, sprint: { hunger: .85, flee: 'run' },
  unseen: { hunger: .85, dark: true, away: true }, fed: { hunger: .5 }, winded: { hunger: .85, stam: 15 },
};
function one(name, seed) {
  const o = SCENES[name], w = World(seed * 7919 + 16900), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(4300, y, { light: !o.dark, angle: o.away ? Math.PI : 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 4950, y + (seed % 2 ? 30 : -30), { hunger: o.hunger }); e.tier = 'near'; e.ang = Math.PI;
  if (o.stam !== undefined) { e.stam = o.stam; e.exh = o.stam < AI.SK.stamExh; }
  p.look = o.away ? Math.PI : () => Math.atan2(e.y - p.y, e.x - p.x);
  const R = { scene: name, seed, plans: [], vmax: 0, pressS: 0, pressV: 0, stamMin: e.stam, within340: null, caught: null, fled: null, gapEnd: null };
  let fled = false;
  w.run(12, (ww, t) => {
    if (!ww.eng.entities.includes(e)) return false;
    const d = Math.hypot(p.x - e.x, p.y - e.y), P = e.plan, k = P ? P.k : e.hunt ? 'hunt' : 'roam';
    if (R.plans[R.plans.length - 1] !== k) R.plans.push(k);
    if (o.flee && !fled && d < 560) { fled = true; R.fled = +t.toFixed(2); p.look = null; p.go(LONG.x0 + 60, y, o.flee); }
    const strike = e.pounce || e.recover || e.trav || ['wind', 'pounce', 'recover', 'feed'].includes(e.act);
    if (!strike) R.vmax = Math.max(R.vmax, e.speed || 0);
    const pressing = !!(P && P.k === 'approach' && P.press && e.act === 'pace' && (e.speed || 0) > AI.SK.runFrom + 1);
    if (pressing) { R.pressS += 1 / 60; R.pressV += (e.speed || 0) / 60; }
    R.stamMin = Math.min(R.stamMin, e.stam);
    if (R.within340 === null && d < 340) R.within340 = +t.toFixed(2);
    if (R.caught === null && ww.kills.some(k => k.pid === p.id)) { R.caught = +t.toFixed(2); return false; }
    return true;
  });
  R.pressV = R.pressS ? +(R.pressV / R.pressS).toFixed(1) : 0; R.pressS = +R.pressS.toFixed(2); R.vmax = +R.vmax.toFixed(1); R.stamMin = Math.round(R.stamMin);
  R.gapEnd = Math.round(Math.hypot(p.x - e.x, p.y - e.y)); R.press = (e.tally && e.tally.press) || 0;
  return R;
}
const runs = [];
for (const s of Object.keys(SCENES)) for (let k = 1; k <= SEEDS; k++) runs.push(one(s, k));
const by = s => runs.filter(r => r.scene === s), rng = v => { v = v.filter(x => x !== null); return v.length ? (Math.min(...v) === Math.max(...v) ? '' + Math.min(...v) : Math.min(...v) + '-' + Math.max(...v)) : '-'; };
const lines = [`tree ${path.basename(DIR)}  press ${has ? AI.SKIN.speeds.press : '(none)'}  ${SEEDS} seeds each`];
for (const s of Object.keys(SCENES)) {
  const R = by(s), pressed = R.filter(r => r.pressS > 0);
  lines.push(`${s.padEnd(7)} pressed ${pressed.length}/${R.length} (for ${rng(pressed.map(r => r.pressS))} s at ${rng(pressed.map(r => r.pressV))} px/s)  top ${rng(R.map(r => r.vmax))}  within 340 px at ${rng(R.map(r => r.within340))} s  caught ${R.filter(r => r.caught !== null).length}/${R.length}${R.some(r => r.caught !== null) ? ' at ' + rng(R.map(r => r.caught)) + ' s' : ''}  stamina down to ${rng(R.map(r => r.stamMin))}${s === 'sprint' ? '  gap at the end ' + rng(R.filter(r => r.caught === null).map(r => r.gapEnd)) + ' px' : ''}`);
}
console.log(lines.join('\n'));
const out = arg('out'); if (out) fs.writeFileSync(out, JSON.stringify({ tree: path.basename(DIR), press: has ? AI.SKIN.speeds.press : null, seeds: SEEDS, runs }, null, 1) + '\n');
