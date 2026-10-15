#!/usr/bin/env node
/* dev/tools/gate/golden/bundle_mutants.js - bundle_diff.js's own sensitivity (development only; Stage 3H continuation C4).
 *
 *   node dev/tools/gate/golden/bundle_mutants.js --assets <folder: a build's assets, with index-DKbV5Nv9.js> [--out DIR] [--control 0]
 *
 * bundle_diff.js says two builds of the compiled client behave the same in the real page, frame by frame.  It must still see a small
 * real change.  Each mutant is one edit of a copy of the bundle in --assets (the gate's port step stages its build there), matched by
 * a pattern that holds for any build of the same code (the minifier's names are matched, never assumed), which must match exactly once.
 * Each mutant build is compared as the gate's bundle step compares the build (--ref-lineage: against the client the lineage records,
 * src/core/client/bundle/lineage/), in a scene that reaches the edited code, and bundle_diff.js must report a difference, first in the
 * record the edit shows in:
 *   hook   the camera scale the page's scripts are given (window.__mp's argument), times 1.001             solo_walk: the shared-object calls
 *   state  a sprint drains 23.5 stamina a second, not 23 (window.__api.H)                                  bare_walk: the game state
 *   dom    the pace label SPRINTlNG.  Only the bundle on its own shows its label: with the page's scripts, move.js's is shown (so a
 *          solo_walk run of this mutant is SAME: the edit is not reached)                                    bare_walk: the document
 *   audio  the breath oscillator at 38 Hz, not 37                                                           solo_walk: the Web Audio calls
 *   rnd    one more Math.random() with each footstep (its value multiplied by 0)                            solo_walk: the randomness
 * Before them (unless --control 0, when the caller has run it: the gate's full tier), the A/A control: the unchanged copy, in the same
 * two scenes, must be SAME.  Exit 0 only when the control is SAME and every mutant is caught in its record. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ARG = { control: '1' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const BUNDLE = 'index-DKbV5Nv9.js';
const MUTANTS = [
  { id: 'hook', scene: 'solo_walk', field: 'hook', re: /(sc:[\w$]+\.scale)(,)/g, to: '$1*1.001$2', what: "the camera scale given to the page's scripts (window.__mp), times 1.001" },
  { id: 'state', scene: 'bare_walk', field: 'st', re: /([\w$]+\.stamina-)23(\*[\w$]+)/g, to: '$123.5$2', what: 'a sprint drains 23.5 stamina a second, not 23' },
  { id: 'dom', scene: 'bare_walk', field: 'dom', re: /([`'"])SPRINTING\1/g, to: '$1SPRINTlNG$1', what: 'the pace label SPRINTlNG (the bundle on its own: the page without its scripts)' },
  { id: 'audio', scene: 'solo_walk', field: 'audio', re: /(\.type=([`'"])sawtooth\2,[\w$]+\.frequency\.value=)37([;,])/g, to: '$138$3', what: 'the breath oscillator at 38 Hz, not 37' },
  { id: 'rnd', scene: 'solo_walk', field: 'rnd', re: /(rate:\.93\+Math\.random\(\)\*\.14)/g, to: '$1+0*Math.random()', what: 'one more Math.random() with each footstep' },
];
if (!ARG.assets) { console.error('usage: bundle_mutants.js --assets <folder> [--out DIR] [--control 0]'); process.exit(2); }
const ASSETS = path.resolve(ARG.assets), OUT = path.resolve(ARG.out || fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-mutants-'))); fs.mkdirSync(OUT, { recursive: true });
const source = fs.readFileSync(path.join(ASSETS, BUNDLE), 'utf8');
/* a scene run: bundle_diff.js with the given assets over the served files, against the lineage's client */
function diff(assets, scenes, tag) {
  const out = path.join(OUT, tag), r = spawnSync(process.execPath, [path.join(__dirname, 'bundle_diff.js'), '--ref-lineage', '1', '--cand-assets', assets, '--scenes', scenes, '--viewport', '640x360', '--out', out], { encoding: 'utf8', maxBuffer: 64 << 20 });
  fs.writeFileSync(path.join(OUT, tag + '.log'), (r.stdout || '') + (r.stderr || ''));
  for (const d of ['ref_lineage_root', 'cand_root']) fs.rmSync(path.join(out, d), { recursive: true, force: true });   // the web roots: 25 MB each
  const j = fs.existsSync(path.join(out, 'bundle_diff.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'bundle_diff.json'), 'utf8')) : null;
  return { code: r.status, report: j };
}
const R = { tool: 'dev/tools/gate/golden/bundle_mutants.js', assets: ASSETS, control: null, mutants: [], ok: true };
const staged = path.join(OUT, 'assets_copy');
fs.mkdirSync(staged, { recursive: true }); for (const f of fs.readdirSync(ASSETS)) if (fs.statSync(path.join(ASSETS, f)).isFile()) fs.copyFileSync(path.join(ASSETS, f), path.join(staged, f));
if (ARG.control !== '0') {
  const scenes = [...new Set(MUTANTS.map(m => m.scene))].join(','), c = diff(staged, scenes, 'control');
  R.control = { scenes, same: c.code === 0 && !!c.report && c.report.ok, frames: c.report ? c.report.scenes.reduce((a, s) => a + (s.frames || 0), 0) : 0 };
  if (!R.control.same) R.ok = false;
  console.log(`${R.control.same ? 'SAME     ' : 'DIFFERENT'} control: the unchanged build (${scenes}: ${R.control.frames} frames)`);
}
for (const m of MUTANTS) {
  const n = [...source.matchAll(m.re)].length;
  if (n !== 1) { R.mutants.push({ id: m.id, what: m.what, caught: false, problem: `the pattern matches ${n} times, not once` }); R.ok = false; console.log(`ERROR   ${m.id}: the pattern matches ${n} times, not once`); continue; }
  const dir = path.join(OUT, 'assets_' + m.id); fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(staged)) fs.copyFileSync(path.join(staged, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, BUNDLE), source.replace(m.re, m.to));
  const r = diff(dir, m.scene, 'mutant_' + m.id), sc = r.report && r.report.scenes[0], d = sc && sc.diff;
  const field = d ? d.field || (d.checkpoint ? 'checkpoint ' + d.checkpoint : 'other') : null, caught = r.code === 1 && !!sc && !sc.ok && field === m.field;
  R.mutants.push({ id: m.id, what: m.what, scene: m.scene, expected: m.field, reported: field, frame: d ? d.frame ?? null : null, caught });
  if (!caught) R.ok = false;
  console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${m.id}: ${m.what} (${m.scene}: ${sc ? (sc.ok ? 'SAME' : `first difference at frame ${d && d.frame}, ${field}`) : 'no report'}${field && field !== m.field ? `; expected ${m.field}` : ''})`);
  fs.rmSync(dir, { recursive: true, force: true });
}
fs.rmSync(staged, { recursive: true, force: true });
fs.writeFileSync(path.join(OUT, 'bundle_mutants.json'), JSON.stringify(R, null, 1) + '\n');
console.log(`BUNDLE MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} (${R.mutants.filter(m => m.caught).length} of ${MUTANTS.length} caught in their record${R.control ? `; the control ${R.control.same ? 'SAME' : 'DIFFERENT'}` : ''})`);
process.exitCode = R.ok ? 0 : 1;
