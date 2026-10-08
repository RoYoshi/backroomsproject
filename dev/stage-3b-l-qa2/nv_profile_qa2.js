/* Stage 3B-L QA2 - the camcorder's infrared reading (irFrom: an entity's readability under night vision), QA2 against
 * v23's formula (development only; never served).  Node, a few seconds.
 *
 *   node dev/stage-3b-l-qa2/nv_profile_qa2.js [--game PATH] [--out FILE.json]
 *
 * camcorder.js is loaded as the page loads it (a stub window: no walls, so only the profile is compared).  On a fine grid of
 * distance and bearing, for LOW and HIGH:
 *   P1 identical to v23 everywhere except the two eased places: within +-.075 rad of the core's edge, and past 70 % of the
 *      range (v23: a straight ramp to zero; QA2: a smooth tail); and the spill at the lens identical
 *   P2 QA2's profile is continuous (no step anywhere: largest change between neighbouring samples) where v23's stepped
 *   P3 the same range, power, core and arc (CFG unchanged), nothing past the range or outside the arc */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..'));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
/* camcorder.js in a stub page */
const el = () => ({ style: { setProperty() { } }, classList: { toggle() { }, add() { }, remove() { } }, appendChild() { }, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() { } }), firstElementChild: null, set textContent(v) { }, get textContent() { return ''; } });
const win = { __api: { Uc: (x, y, a, d) => d + 10 }, addEventListener() { }, getComputedStyle: () => ({ display: '' }) };
const doc = { createElement: el, getElementById: () => null, head: { appendChild() { } }, body: null, readyState: 'complete', addEventListener() { } };
const ctx = vm.createContext({ window: win, document: doc, getComputedStyle: win.getComputedStyle, performance: { now: () => 0 }, setTimeout, clearTimeout, setInterval: () => 0, requestAnimationFrame: () => 0, console, Math, Number, Object, Array, String, JSON, Error });
vm.runInContext(fs.readFileSync(path.join(GAME, 'camcorder.js'), 'utf8'), ctx);
const cam = win.__cam, CFG = cam.CFG;
/* v23's formula (camcorder.js before QA2), verbatim */
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function v23(src, lvl, x, y) {
  const P = CFG.IR[lvl]; const dx = x - src.x, dy = y - src.y, d = Math.hypot(dx, dy);
  let v = (1 - ss(20, 70, d)) * .3;
  if (d < P.range) { let da = Math.atan2(dy, dx) - (src.angle || 0); while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; da = Math.abs(da);
    if (da < P.arc / 2) { const wa = da < P.core / 2 ? 1 : .45 * (1 - ss(P.core / 2, P.arc / 2, da)), u = d / P.range; const wr = u < .25 ? 1 - .17 * u / .25 : u < .7 ? .83 - .55 * (u - .25) / .45 : .28 * (1 - (u - .7) / .3); v = Math.max(v, P.power * wa * wr); } }
  return v;
}
const R = { game: GAME, levels: {} };
let p1 = true, p2 = true, p3 = true;
for (const lvl of [1, 2]) {
  const P = CFG.IR[lvl], src = { x: 0, y: 0, angle: 0 }, c = P.core / 2;
  let maxIn = 0, maxOut = 0, nOut = 0, stepQ = 0, stepV = 0, past = 0;
  for (let d = 1; d <= P.range + 40; d += 1) for (let a = 0; a <= .7; a += .0025) {
    const x = Math.cos(a) * d, y = Math.sin(a) * d, q = cam.irFrom(src, lvl, x, y), o = v23(src, lvl, x, y), diff = Math.abs(q - o), u = d / P.range;
    const eased = Math.abs(a - c) <= .075 + 1e-9 || u > .7;
    if (eased) { if (diff > maxIn) maxIn = diff; } else { if (diff > maxOut) maxOut = diff; if (diff > 1e-12) nOut++; }
    if ((d > P.range || a >= P.arc / 2) && d > 75 && q > 0) past++;
  }
  /* neighbouring samples (1 px, .0025 rad) past the spill: the largest change */
  for (let d = 80; d <= P.range + 20; d += 1) { let pq = null, pv = null; for (let a = 0; a <= .7; a += .0025) { const x = Math.cos(a) * d, y = Math.sin(a) * d, q = cam.irFrom(src, lvl, x, y), o = v23(src, lvl, x, y); if (pq != null) { stepQ = Math.max(stepQ, Math.abs(q - pq)); stepV = Math.max(stepV, Math.abs(o - pv)); } pq = q; pv = o; } }
  R.levels[lvl] = { name: P.name, range: P.range, power: P.power, core: P.core, arc: P.arc, maxDiffInEased: +maxIn.toFixed(4), maxDiffElsewhere: maxOut, samplesDifferingElsewhere: nOut, largestStepQA2: +stepQ.toFixed(4), largestStepV23: +stepV.toFixed(4), lightPastRangeOrArc: past };
  if (!(maxOut < 1e-12)) p1 = false; if (!(stepQ < .25 * stepV)) p2 = false; if (past) p3 = false;
}
const L = R.levels;
check('P1 the reading is v23\'s everywhere except the two eased places (the core\'s edge +-.075 rad, past 70 % of the range)', p1,
  [1, 2].map(l => `${L[l].name}: elsewhere max |diff| ${L[l].maxDiffElsewhere} (${L[l].samplesDifferingElsewhere} samples differ); in the eased places max |diff| ${L[l].maxDiffInEased}`).join('; '));
check('P2 no step: the largest change between neighbouring samples (.0025 rad) is a fraction of v23\'s', p2, [1, 2].map(l => `${L[l].name}: ${L[l].largestStepQA2} (v23 ${L[l].largestStepV23})`).join('; '));
check('P3 the same range, power, core and arc; nothing past the range or outside the arc (bar the lens spill)', p3 && CFG.IR[1].range === 340 && CFG.IR[2].range === 560 && CFG.IR[1].power === .72 && CFG.IR[2].power === .86,
  [1, 2].map(l => `${L[l].name}: range ${L[l].range}, power ${L[l].power}, core ${L[l].core}, arc ${L[l].arc}; light past them ${L[l].lightPastRangeOrArc}`).join('; '));
const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify({ results, R }, null, 1));
process.exit(ok ? 0 : 1);
