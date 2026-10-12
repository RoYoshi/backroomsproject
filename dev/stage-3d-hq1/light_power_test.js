/* Stage 3D HQ1 - the dying light's power and profile, as numbers (development only; gates L1 and L2 of STAGE_3D_HQ1_AUDIT.md)
 *
 *   node dev/stage-3d-hq1/light_power_test.js --game DIR [--out FILE.json]
 *
 * Loads the game's own dphys.js (the code the server and every page run) and checks dphys.lightPower and dphys.lightProfile:
 *   P1 for hold 3 / 5 / 7 and fade 1 / 1.5 / 2 (four seeds each): exactly 1 at release - e, release + 0.1 and the end of the hold - e
 *   P2 within the failure: at least one blackout (exactly 0) and at least 3 distinct levels (1/240 s sampling)
 *   P3 the envelope never rises: the brightest moment of each 0.1 s step is never brighter than the step before (1/960 s sampling)
 *   P4 at most 0.2 just before the end; exactly 0 at the end, 30 s and 600 s after it
 *   P5 never negative, above 1 or NaN; the same at every call; no clock (NaN, undefined) gives 0
 *   P6 lightProfile over 1,000 deaths x 3 kinds: hold within 3-7 and fade within 1-2, in tenths, covering both ranges (41 and 11 values);
 *      the same for the same inputs; null for a camcorder and an unknown kind
 *   P7 a record without a profile still fails (the default: off 6.5 s after release)
 *   P8 dphys.releaseOf, asked at a death's first frame, gives the moment its own run lets the light go (every killer and variant, four
 *      light kinds, open floor and a wall behind; a headlamp: 0), and asking does not change the death
 * Writes the curves of three sample profiles (every 1/60 s through the failure) to the output for the report. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || path.join(__dirname, '..', '..'));
const box = {}; new Function('window', fs.readFileSync(path.join(GAME, 'dphys.js'), 'utf8'))(box); const D = box.__dphys;
const R = []; const check = (name, ok, note) => { R.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '\n       ' + note); };
const out = { tool: 'dev/stage-3d-hq1/light_power_test.js', game: GAME, checks: R, curves: [] };
if (typeof D.lightPower !== 'function' || typeof D.lightProfile !== 'function' || typeof D.releaseOf !== 'function') { check('dphys exports lightPower, lightProfile and releaseOf', false, 'missing (a D7 tree?)'); process.exit(1); }
const eps = 1e-6, cases = [];
for (const hold of [3, 5, 7]) for (const fade of [1, 1.5, 2]) for (const seed of [0, 1, 517, 1023]) cases.push([hold, fade, seed]);
const bad = { p1: [], p2: [], p3: [], p4: [], p5: [] };
for (const lf of cases) {
  const [hold, fade] = lf, P = s => D.lightPower(lf, s);
  if (P(-eps) !== 1 || P(.1) !== 1 || P(hold - eps) !== 1) bad.p1.push(lf);
  const vals = []; for (let t = 0; t < fade; t += 1 / 240) vals.push(P(hold + t));
  if (!vals.some(v => v === 0) || new Set(vals.map(v => v.toFixed(3))).size < 3) bad.p2.push([lf, vals.filter(v => v === 0).length, new Set(vals.map(v => v.toFixed(3))).size]);
  let prev = Infinity; const n = Math.ceil(fade / .1 - 1e-9);
  for (let i = 0; i < n; i++) { let mx = 0; for (let t = i * .1; t < Math.min(fade, (i + 1) * .1); t += 1 / 960) mx = Math.max(mx, P(hold + t)); if (mx > prev + 1e-12) bad.p3.push([lf, i, mx, prev]); prev = mx; }
  if (!(P(hold + fade - eps) <= .2) || P(hold + fade) !== 0 || P(hold + fade + 30) !== 0 || P(hold + fade + 600) !== 0) bad.p4.push([lf, P(hold + fade - eps), P(hold + fade)]);
  for (let t = -1; t < hold + fade + 2; t += 1 / 120) { const v = P(t); if (!(v >= 0 && v <= 1) || v !== P(t)) { bad.p5.push([lf, t, v]); break; } }
}
check('P1 full power through the hold (release - e, release + 0.1, end of the hold - e), 36 profiles', !bad.p1.length, `wrong: ${JSON.stringify(bad.p1.slice(0, 4))}`);
check('P2 the failure flickers: at least one blackout and 3 levels in every profile', !bad.p2.length, `wrong: ${JSON.stringify(bad.p2.slice(0, 4))}`);
check('P3 the overall dimming is monotonic (the brightest moment of each 0.1 s step never rises)', !bad.p3.length, `rises: ${JSON.stringify(bad.p3.slice(0, 4))}`);
check('P4 at most 0.2 just before the end; exactly 0 at the end, +30 s and +600 s', !bad.p4.length, `wrong: ${JSON.stringify(bad.p4.slice(0, 4))}`);
const noClock = [D.lightPower([5, 1.5, 3], NaN), D.lightPower([5, 1.5, 3], undefined), D.lightPower([5, 1.5, 3], null)];
check('P5 within 0-1, never NaN, the same at every call; no clock gives 0', !bad.p5.length && noClock.every(v => v === 0), `wrong: ${JSON.stringify(bad.p5.slice(0, 3))}; no clock -> ${JSON.stringify(noClock)}`);
const hs = new Set(), fs2 = new Set(); let badP = 0;
for (let de = 1; de <= 1000; de++) for (const k of ['flashlight', 'lantern', 'headlamp']) {
  const p = D.lightProfile(7, de, k); if (!(p && p[0] >= 3 && p[0] <= 7 && p[1] >= 1 && p[1] <= 2 && Math.abs(p[0] * 10 - Math.round(p[0] * 10)) < 1e-9 && Math.abs(p[1] * 10 - Math.round(p[1] * 10)) < 1e-9 && p[2] >= 0 && p[2] <= 1023)) badP++;
  if (JSON.stringify(p) !== JSON.stringify(D.lightProfile(7, de, k))) badP++; hs.add(p[0]); fs2.add(p[1]);
}
const nul = [D.lightProfile(7, 1, 'camcorder'), D.lightProfile(7, 1, 'torch'), D.lightProfile(7, 1, undefined)];
check('P6 lightProfile: 1,000 deaths x 3 kinds within 3-7 / 1-2 in tenths, covering both ranges; repeatable; null for a camcorder or unknown kind',
  !badP && hs.size === 41 && fs2.size === 11 && nul.every(v => v === null), `holds ${hs.size} values ${Math.min(...hs)}-${Math.max(...hs)}; fades ${fs2.size} values ${Math.min(...fs2)}-${Math.max(...fs2)}; bad ${badP}; camcorder/unknown -> ${JSON.stringify(nul)}`);
const d = [D.lightPower(null, 4.99), D.lightPower(null, 6.5), D.lightPower(undefined, 100)];
check('P7 a record without a profile still fails: full before 5 s, 0 from 6.5 s', d[0] === 1 && d[1] === 0 && d[2] === 0, JSON.stringify(d));
const bad8 = []; let n8 = 0;
for (const kind of ['Hound', 'Smiler']) for (const v of 'ABCD') for (const ek of ['flashlight', 'lantern', 'headlamp', 'camcorder']) for (const wall of [false, true]) for (const a of [0, 1.3, 2.9]) {
  const o = { kind, v, w: 0, victim: { x: 500, y: 500, angle: a }, src: { x: 500 - Math.cos(a) * 46, y: 500 - Math.sin(a) * 46 }, eqKind: ek, hat: 'none', vx: 0, vy: 0,
    walls: (x, y) => wall && y > 540 ? [{ x: 0, y: 540, w: 1000, h: 60 }] : [], clear: () => true };
  const P = D.prepare(o), early = D.releaseOf(P.S), R2 = D.finish(P), full = D.simulate(o);
  const want = ek === 'headlamp' ? 0 : full.S.eqAt; n8++;
  if (early !== want || R2.S.eqAt !== full.S.eqAt || R2.body.x !== full.body.x || R2.body.y !== full.body.y) bad8.push([kind + v, ek, wall, a, early, want, R2.S.eqAt]);
}
check('P8 releaseOf at the first frame = the run\'s own release (' + n8 + ' deaths); asking does not change the death', !bad8.length, `wrong: ${JSON.stringify(bad8.slice(0, 4))}`);
for (const lf of [D.lightProfile(7, 1, 'flashlight'), D.lightProfile(7, 2, 'lantern'), D.lightProfile(7, 3, 'headlamp')]) {
  const pts = []; for (let t = lf[0] - .2; t <= lf[0] + lf[1] + .2 + 1e-9; t += 1 / 60) pts.push([+t.toFixed(4), +D.lightPower(lf, t).toFixed(4)]);
  out.curves.push({ lf, points: pts });
}
out.ok = R.every(c => c.ok) && R.length === 8;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
console.log(`${R.filter(c => c.ok).length}/${R.length} passed`); process.exit(out.ok ? 0 : 1);
