#!/usr/bin/env node
/* dev/trial-3-r19-positioning/tools/scene_r19.js - Trial 3 R19, S track: the scenes the S track was judged on, run on any tree (R18 or
 * R19) seed for seed, printing what the Skin-Stealer did and why.  Development tool; evidence, not a gate step.  Not owner-approved.
 *
 *   node scene_r19.js hall TREE MODE HUNGER      the lit hall of s_skinpredator.js (a lit person 450 px from it, facing it), 8 seeds, 20 s:
 *                                                MODE stand (they stand and watch), walkoff (they walk off along the hall after 1 s,
 *                                                looking back), walk0 (walking off from the start, looking back)
 *   node scene_r19.js junction TREE HUNGER MODE  a lit person at the junction at (1164, 732) (a side passage east of them), it 600 px south;
 *                                                MODE stand | walk, 6 seeds, 12 s: its plans, where an open approach headed (R19: cp)
 *   node scene_r19.js escape TREE TRIGGER        the junction at .9 hunger: when it is TRIGGER px off they sprint east (their side way out)
 *                                                or west (along the hall), 8 seeds each: X caught / . escaped, and the nearest it came
 *
 * Per seed: its plans in order (kind:mode, @cp when heading for their way out) with the distance to them, its positioning records
 * ([kind why], R19 trees only), how long it was on a plan about them and how long of that out of their sight, and whether it killed them.
 * The people are moved by the game's own move.js (dev/harness.js); nothing here moves the creature or tells it anything. */
'use strict';
const path = require('path');
const [cmd, TREE] = process.argv.slice(2, 4); const A = process.argv.slice(4);
const { World, DT, LONG, bystander } = require(path.join(path.resolve(TREE), 'dev', 'tests', 'lib.js'));
const label = P => P ? P.k + (P.mode ? ':' + P.mode : '') + (P.cp && P.cp.c ? '@cp' : '') : 'roam';

function hall(mode, h) {
  let kills = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const w = World(seed + 3800), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    const log = []; let last = '', lastPos = null, fl = 0, refused = 0, out = 0, on = 0;
    w.run(20, (ww, t) => {
      if ((mode === 'walkoff' && t > 1 || mode === 'walk0') && !p.going) { p.going = 1; p.go(2000, y, 'walk'); }
      const P = e.plan, k = label(P);
      if (P && P.k === 'flank' && !P.__c) { P.__c = 1; fl++; }
      if (P && P.pid === p.id) { on += DT; if (!w.eng.geo.los(p.x, p.y, e.x, e.y)) out += DT; }
      if (e.dbg.pos && e.dbg.pos.at !== lastPos) { lastPos = e.dbg.pos.at; if (e.dbg.pos.k === 'flankRefused') refused++; log.push(`[${e.dbg.pos.k} ${e.dbg.pos.why}]`); }
      if (k !== last) { log.push(`${t.toFixed(1)} ${k} d${Math.round(Math.hypot(p.x - e.x, p.y - e.y))}`); last = k; }
      return !p.dead;
    });
    if (p.dead) kills++;
    console.log(`seed ${seed}: ways round ${fl}, refused ${refused}, on them ${on.toFixed(1)} s (out of their sight ${out.toFixed(1)} s)${p.dead ? ', KILLED' : ''} | ${log.slice(0, 14).join(' > ')}`);
  }
  console.log(`${path.basename(path.resolve(TREE))} hall ${mode} ${h}: killed ${kills}/8`);
}
function junction(h, mode) {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = World(seed + 9100), p = w.player(1164, 732, { light: true }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1164, 1332, { hunger: h }); e.tier = 'near'; e.ang = -Math.PI / 2;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    if (mode === 'walk') p.go(264, 732, 'walk');
    const log = []; let last = '';
    w.run(12, (ww, t) => { const P = e.plan, k = label(P); if (k !== last) { log.push(`${t.toFixed(1)} ${k} d${Math.round(Math.hypot(p.x - e.x, p.y - e.y))}${P && P.cp && P.cp.c ? ` cp(${Math.round(P.cp.x)},${Math.round(P.cp.y)})` : ''}`); last = k; } return !p.dead; });
    console.log(`seed ${seed}: contest points ${(e.tally && e.tally.contest) || 0}${p.dead ? ', KILLED' : ''} | ${log.slice(0, 9).join(' > ')}`);
  }
}
function escape(trig) {
  for (const [dir, gx] of [['east', 1164 + 1400], ['west', 1164 - 900]]) {
    const res = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const w = World(seed + 9200), p = w.player(1164, 732, { light: true }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 1164, 1332, { hunger: .9 }); e.tier = 'near'; e.ang = -Math.PI / 2;
      p.look = () => Math.atan2(e.y - p.y, e.x - p.x); let ran = -1, dmin = 1e9;
      w.run(14, (ww, t) => { const d = Math.hypot(p.x - e.x, p.y - e.y); if (ran < 0 && d < trig) { ran = t; p.look = null; p.go(gx, 732, 'run'); } if (ran >= 0) dmin = Math.min(dmin, d); return !p.dead; });
      res.push(`${p.dead ? 'X' : '.'}${Math.round(dmin)}`);
    }
    console.log(`${path.basename(path.resolve(TREE))} escape ${dir} at ${trig} px: ${res.join(' ')}`);
  }
}
if (cmd === 'hall') hall(A[0] || 'stand', +(A[1] || .7));
else if (cmd === 'junction') junction(+(A[0] || .9), A[1] || 'stand');
else if (cmd === 'escape') escape(+(A[0] || 550));
else console.log('scene_r19.js hall|junction|escape TREE ... (see the head of this file)');
