#!/usr/bin/env node
/* dev/tools/gate/golden/bundle_perf.js - the compiled client's frame time: the bundle B++ shipped against the served build, in the real
 * page (development only; Stage 3H continuation C5c, the continuation pack's performance A/A and A/B for the recompiled client).
 *
 *   node dev/tools/gate/golden/bundle_perf.js [--rounds 5] [--scenes walk,hound] [--viewport 640x360] [--aa 1] [--out FILE.json]
 *
 * Each round, bundle_diff.js plays the scenes of bundle_perf_scenes.js (by default the walk and the Hound's captures: the gameplay frame
 * and the death sequence) on two sides in one headless Chromium (SwiftShader: no physical GPU; a 640 x 360 window by default, since
 * SwiftShader's drawing, done on the CPU outside the timed callbacks, takes most of a round's time): the old side is the repository's public/ with the bundle and the stylesheet the client lineage records (B++'s bytes, shipped until
 * continuation C4a), the new side public/ as it is (the build of the port, since C4b).  Its --perf mode keeps no text records and no pixel
 * digests, and steps the two pages one after the other at every batch of frames (the order swapped every round), so that neither page
 * runs while the other is timed.  The time is the real time a page spends in its frames' animation-frame callbacks (bundle_env.js's
 * BD.prof.raf: the compiled client's frame and the classic scripts' hooks; the timers, which fire just before, are not in it), from the start of the run to the end of
 * the scene (the title and the joining are not timed), divided by the frames.  Every frame is still compared: a difference fails.
 * The pass rule is perf_det.js's for the page, fixed before this measured anything: new passes when its median is at most old's median
 * + max(old's spread across rounds, 10 % of old's median).  --aa 1: the old side against itself, the noise floor the rule lives with.
 * Exit 0 only when every scene passes and every frame is the same. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ARG = { rounds: '5', scenes: 'walk,hound', viewport: '640x360' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..', '..'), R = +ARG.rounds, SC = ARG.scenes.split(',');
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function rule(a, b, floor) {   // perf_det.js's
  const am = med(a), bm = med(b), spread = Math.max(...a) - Math.min(...a), tol = Math.max(spread, am * floor);
  return { old: a.map(x => +x.toFixed(3)), new: b.map(x => +x.toFixed(3)), oldMedian: +am.toFixed(3), newMedian: +bm.toFixed(3), tolerance: +tol.toFixed(3), changePct: +((bm - am) / am * 100).toFixed(2), ok: bm <= am + tol };
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bperf-'));
const res = { tool: 'dev/tools/gate/golden/bundle_perf.js', viewport: ARG.viewport, mode: ARG.aa ? 'A/A: the bundle B++ shipped against itself' : 'A/B: the bundle B++ shipped (old) against the served build (new)', rounds: R, node: process.version, cpus: os.cpus().length, startedAt: new Date().toISOString(), scenes: {}, sameFrames: true, ok: true };
const per = {}; for (const s of SC) per[s] = { old: [], new: [], frames: [] };
for (let r = 0; r < R; r++) {
  const out = path.join(tmp, 'r' + r), args = [path.join(__dirname, 'bundle_diff.js'), '--ref-lineage', '1', '--perf', '1', '--pixels', '0', '--serial', r % 2 ? 'reverse' : '1',
    '--scenesFile', path.join(__dirname, 'bundle_perf_scenes.js'), '--scenes', SC.join(','), '--viewport', ARG.viewport, '--out', out];
  if (ARG.aa) args.push('--cand', 'ref');
  const x = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', timeout: 3600000, maxBuffer: 1 << 26 });
  let j = null; try { j = JSON.parse(fs.readFileSync(path.join(out, 'bundle_diff.json'), 'utf8')); } catch (e) { /* below */ }
  if (!j) { res.ok = false; res.problem = `round ${r + 1}: bundle_diff.js gave no report: ${(x.stdout + x.stderr).slice(-600)}`; break; }
  for (const sc of j.scenes) {
    const p = per[sc.scene]; if (!p) continue;
    if (!sc.ok) { res.sameFrames = false; res.ok = false; (res.differences = res.differences || []).push({ round: r + 1, scene: sc.scene, diff: sc.diff }); }
    const [a, b] = sc.prof || []; if (!a || !b || !a.n || !b.n) { res.ok = false; (res.problems = res.problems || []).push(`round ${r + 1} ${sc.scene}: no timing`); continue; }
    p.old.push(a.raf / a.n); p.new.push(b.raf / b.n); p.frames.push(a.n);
  }
  console.log(`round ${r + 1} of ${R} (${r % 2 ? 'new first' : 'old first'}): ` + SC.map(s => { const p = per[s], k = p.old.length - 1; return k < 0 ? `${s} -` : `${s} old ${p.old[k].toFixed(2)} new ${p.new[k].toFixed(2)} ms/frame`; }).join('; '));
}
for (const s of SC) {
  const p = per[s]; if (p.old.length < 2) { res.ok = false; continue; }
  const v = rule(p.old, p.new, 0.10); v.frames = p.frames[0]; res.scenes[s] = v; if (!v.ok) res.ok = false;
  console.log(`${v.ok ? 'PASS' : 'FAIL'} ${s}: old ${v.oldMedian} ms/frame, new ${v.newMedian} (${v.changePct > 0 ? '+' : ''}${v.changePct} %), tolerance ${v.tolerance} (${v.frames} frames a round)`);
}
fs.rmSync(tmp, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(`BUNDLE PERF (${ARG.aa ? 'A/A' : 'A/B'}): ${res.ok ? 'PASS' : 'FAIL'}${res.sameFrames ? '' : ' (frames differed)'}`);
process.exitCode = res.ok ? 0 : 1;
