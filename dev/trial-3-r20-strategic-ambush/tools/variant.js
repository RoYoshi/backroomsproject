#!/usr/bin/env node
/* dev/trial-3-r20-strategic-ambush/tools/variant.js - Trial 3 R20, S track: the A/B runs' variants.  Runs a tool (--sim) on a tree (--dir)
 * with its built generated/server/ai.js compiled with exact text substitutions (--var NAME, from the table below; each must match exactly
 * once, or the run stops) - nothing on disk changes.  Development tool; evidence.
 *   node variant.js --var drain12 --dir TREE --sim hunt_sim.js [the sim's own args] */
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const V = {
  none: [],
  // R19's code (the N tree) with only the stamina and chase-readiness proposals
  staminaOnly: [['drainRun: 11, runFrom: 215,', 'drainRun: 13, runFrom: 215,'], ['chaseFrom: 560, chaseMax: 9,', 'chaseFrom: 500, chaseMax: 8,'],
    ['- T.CAUTION * .3) * (crowd > 1 ? .6 : 1),', '- T.CAUTION * .3) * (crowd > 1 ? .6 : 1) * .85,']],
  // the S tree with R19's stamina (11) / 12 / 14
  drain11: [['drainRun: 13, runFrom: 215,', 'drainRun: 11, runFrom: 215,']],
  drain12: [['drainRun: 13, runFrom: 215,', 'drainRun: 12, runFrom: 215,']],
  drain14: [['drainRun: 13, runFrom: 215,', 'drainRun: 14, runFrom: 215,']],
  // the S tree with R19's ears
  noHear: [['SKIN.hearScale = ev => ev.src > 0 ? (SK20.hear[ev.type] || 1) : 1;', 'SKIN.hearScale = null;'], ['SKIN.hearWall = SK20.hearWall;', 'SKIN.hearWall = null;']],
  // the S tree with half the walking-ear boost
  // C3 / C4 of the A/B (REGRESSION.md): an unaware walker trailed at their own pace + 40 (no press unless they run), or pressed at its
  // investigation's pace (232) - both lost surprise captures and were not kept
  walkerTrail: [['(shown || sp > 60) && d > SKF.near && skMayRun(eng, e, r);', '(shown || sp > 200) && d > SKF.near && skMayRun(eng, e, r);']],
  walkerInvestigate: [[', e.disguise ? e.sp.speeds.disguise : 1e9), { arrive: 60 }); return;', ', e.disguise ? e.sp.speeds.disguise : 1e9, shown || sp > 200 ? 1e9 : e.sp.speeds.investigate), { arrive: 60 }); return;']],
  hearHalf: [['hear: { walk: 2.4, run: 1.12, slide: 1.35, vault: 1.2, land: 1.2 },', 'hear: { walk: 1.7, run: 1.06, slide: 1.17, vault: 1.1, land: 1.1 },']],
};
const name = arg('var', 'none'), subs = V[name]; if (!subs) throw new Error('no variant ' + name);
const DIR = path.resolve(arg('dir')), AI = path.join(DIR, 'generated', 'server', 'ai.js'), compile = Module.prototype._compile;
let took = 0;
Module.prototype._compile = function (content, filename) {
  if (path.resolve(filename) === AI) { for (const [a, b] of subs) { if (content.split(a).length !== 2) throw new Error(`variant ${name}: not exactly once: ${a}`); content = content.replace(a, () => b); } took++; }
  return compile.call(this, content, filename);
};
process.on('exit', () => { if (!took) console.error('variant: ai.js was never compiled'); });
require(path.resolve(arg('sim')));
