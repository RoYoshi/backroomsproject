/* Exercise the actual debug controller without WebGL. This verifies controls
 * and isolation, not browser layout/input routing or Pixi renderer startup. */
'use strict';
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const { harness, Container, ROOT } = require('./physical-harness');
(async () => {
 const h = harness(), elements = {}, diag = {}, queued = new Map(); let now = 0, next = 1, destroyed = 0;
 for (const k of ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'strokeRect', 'fillRect']) diag[k] = () => {};
 function el(id) { return elements[id] ||= { id, value: '', checked: true, hidden: false, width: 0, height: 0, clientWidth: 880, clientHeight: 550, children: [], appendChild(x) { this.children.push(x); }, addEventListener() {}, getContext: () => diag }; }
 const doc = { createElement: () => el('deathLab'), getElementById: el, body: { appendChild() {} } };
 class App { constructor() { this.stage = new Container(); } async init(opts) { this.screen = { width: opts.width, height: opts.height }; this.canvas = el('pixi'); } destroy() { destroyed++; } }
 const liveLayer = new Container(), liveH = { ...h.H }, liveCorpseCount = h.corpses.length;
 Object.assign(h.win.__api, { Jl: h.Death, Wl: h.Hound, Gl: h.Smiler, layer: () => liveLayer, scene: () => ({ app: new App() }) }); h.win.WORLD = { mode: 'walk' };
 Object.assign(h.ctx, { document: doc, requestAnimationFrame: f => { const id = next++; queued.set(id, f); return id; }, cancelAnimationFrame: id => queued.delete(id) });
 h.ctx.performance.now = () => now;
 vm.runInContext(fs.readFileSync(ROOT + '/death-lab.js', 'utf8'), h.ctx);
 const lab = h.win.__deathLab;
 for (const [id, value] of Object.entries({ dlKind: 'Hound', dlVariant: 'A', dlGeometry: 'open', dlMoving: '0', dlStamina: '100', dlGear: 'flashlight', dlView: 'spectator', dlRate: '1' })) el(id).value = value;
 await lab.open(); assert(el('deathLab').hidden); assert.equal(lab.snapshot(), null); console.log('PASS unauthorized lab stays closed');
 lab.authorize(true); await lab.open(); assert(!el('deathLab').hidden); assert.equal(lab.snapshot().t, 0);
 el('dlStep').onclick(); assert(Math.abs(lab.snapshot().t - 1 / 120) < 1e-8); assert.equal(el('dlPause').textContent, 'PLAY');
 const tick = dt => { now += dt * 1000; const fn = [...queued.values()].at(-1); queued.clear(); fn(now); };
 const stopped = lab.snapshot().t; tick(.04); assert.equal(lab.snapshot().t, stopped); console.log('PASS pause and fixed 120 Hz frame-step');
 el('dlReset').onclick(); assert.equal(lab.snapshot().t, 0);
 el('dlPause').onclick(); el('dlRate').value = '.25'; tick(.04); assert(Math.abs(lab.snapshot().t - .01) < 1e-8); console.log('PASS reset/play and 0.25× rate');
 for (const kind of ['Hound', 'Smiler']) for (const variant of ['A', 'B', 'C', 'D']) {
   el('dlKind').value = kind; el('dlVariant').value = variant; el('dlGeometry').value = variant === 'C' ? 'wall' : 'corner'; el('dlMoving').value = '1'; el('dlReplay').onclick(); el('dlRate').value = '1';
   for (let i = 0; i < 150; i++) tick(.05);
   assert.equal(lab.snapshot().phase, 'SLEEPING'); assert.equal(lab.snapshot().pose.v, 2);
   el('dlBlood').checked = false; tick(.01); el('dlBlood').checked = true; tick(.01);
 }
 assert.equal(liveLayer.children.length, 0); assert.deepEqual(h.H, liveH); assert.equal(h.corpses.length, liveCorpseCount); assert.equal(h.win.WORLD.mode, 'walk'); console.log('PASS all eight variants, corpse/no-gore toggle and live-world isolation');
 lab.close(); assert(el('deathLab').hidden); assert.equal(queued.size, 0); assert.equal(destroyed, 1); assert.equal(lab.snapshot(), null); console.log('PASS closing destroys the sandbox and stops its frame loop');
 console.log('5 debug-controller checks passed (browser/WebGL startup remains unverified)');
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
