/* Acceptance matrix: all eight variants, geometry, incoming momentum,
 * exhaustion, equipment, render speeds and repeated deterministic execution. */
'use strict';
const assert = require('assert/strict');
const { Motion, DT, rotate } = require('../death-motion');
const { performance } = require('perf_hooks');
const variants = ['A', 'B', 'C', 'D'], kinds = ['Hound', 'Smiler'];
let cases = 0, maxJoint = 0, maxStep = 0, maxSleepV = 0, maxPacket = 0;
const t0 = performance.now();
function setup(kind, variant, geometry, moving, exhausted, gearKind) {
  const wall = { x: 314, y: 110, w: 28, h: 260 }, corner = { x: 140, y: 288, w: 174, h: 28 };
  const rects = geometry === 'open' ? [] : geometry === 'wall' ? [wall] : [wall, corner];
  return { kind, variant, victim: { x: 240, y: 240, angle: .1, vx: moving ? 105 : 0, vy: moving ? 22 : 0, stamina: exhausted ? 5 : 100, exhausted }, source: { x: 160, y: 236 },
    wall: kind === 'Hound' && variant === 'C' && geometry !== 'open' ? { x: 314, y: 244 } : null,
    hat: 'cap', gearKind, rects: () => rects };
}
for (const kind of kinds) for (const variant of variants) for (const geometry of ['open', 'wall', 'corner']) for (const moving of [false, true]) for (const exhausted of [false, true]) {
  const config = setup(kind, variant, geometry, moving, exhausted, 'flashlight'), m = new Motion(config);
  let prev = m.display.map(p => ({ x: p.x, y: p.y, angle: p.angle })), prevDetached = false, forceSleep = false;
  for (let f = 1; f <= Math.ceil((m.duration + .1) * 120); f++) {
    const before = m.phase, speed = Math.max(...m.all.slice(0, 6).map(p => Math.hypot(p.vx, p.vy)));
    m.advance(f * DT);
    if (before !== 'SLEEPING' && m.phase === 'SLEEPING') { maxSleepV = Math.max(maxSleepV, speed); forceSleep ||= speed >= .55; }
    m.display.slice(0, 6).forEach((p, i) => {
      assert(Number.isFinite(p.x + p.y + p.angle), 'invalid transform');
      const step = Math.hypot(p.x - prev[i].x, p.y - prev[i].y); maxStep = Math.max(maxStep, step); assert(step < 8, 'physical discontinuity');
      assert(Math.abs(p.angle - prev[i].angle) < .13, 'angular discontinuity');
      prev[i] = { ...p };
    });
    const lightHead = { x: m.gear.x + Math.cos(m.gear.angle) * 17, y: m.gear.y + Math.sin(m.gear.angle) * 17, r: 6 };
    [m.body, ...m.hands, ...(m.gear.detached ? [m.gear, lightHead] : []), ...(m.hat.detached ? [m.hat] : [])].forEach(p => config.rects().forEach(r => {
      const dx = p.x - Math.max(r.x, Math.min(p.x, r.x + r.w)), dy = p.y - Math.max(r.y, Math.min(p.y, r.y + r.h));
      assert(Math.hypot(dx, dy) >= p.r - .01, 'geometry penetration');
    }));
    m.hands.forEach(h => { const q = rotate(h.x - m.body.x, h.y - m.body.y, -m.body.angle); assert(q.x * h.side >= 6.8); assert(Math.hypot(q.x - h.side * 11, q.y) < 27.1, 'hand lost invisible anchor'); });
    if (m.gear.detached && !prevDetached) {
      const travel = Math.hypot(m.gear.x - m.gear.px, m.gear.y - m.gear.py) / DT;
      if (travel > 45) assert(Math.hypot(m.gear.vx, m.gear.vy) > travel - 30, 'moving light lost inherited momentum');
      prevDetached = true;
    }
    if (m.t > .4 && m.t < m.settleAt) maxJoint = Math.max(maxJoint, Math.hypot(m.body.x - m.attacker.x, m.body.y - m.attacker.y));
  }
  assert(!forceSleep, `${kind} ${variant}/${geometry}/${moving}/${exhausted}: animation ended while a mass was still moving visibly`); assert.equal(m.phase, 'SLEEPING');
  const frozen = JSON.stringify([m.snapshot(), m.display]); m.advance(50); assert.equal(JSON.stringify([m.snapshot(), m.display]), frozen, 'sleeping body still changed');
  for (const rate of [1, .25]) {
    const replay = new Motion(config); for (let f = 0; f < 6 / rate * 30; f++) replay.advance(f / 30 * rate); replay.advance(6);
    assert.equal(JSON.stringify(replay.snapshot()), JSON.stringify(m.snapshot()), 'normal/quarter-speed replay differs');
    assert.equal(JSON.stringify(replay.body), JSON.stringify(m.body), 'root endpoint differs');
  }
  const bytes = Buffer.byteLength(JSON.stringify({ t: 'b', ps: m.snapshot(), bl: m.bursts.map(p => [p.x, p.y, p.seed, p.at, p.angle]), dr: [m.gear.x, m.gear.y, m.gear.angle], ht: [m.hat.x, m.hat.y, m.hat.angle] })); maxPacket = Math.max(maxPacket, bytes);
  // Reserve full look/name/equipment/transform envelope under the existing limit.
  assert(bytes + 350 < 1400, 'corpse payload exceeds existing transport'); cases++;
}
for (const kind of kinds) for (const variant of variants) for (const gearKind of ['headlamp', 'lantern', 'camcorder']) {
  const m = new Motion(setup(kind, variant, 'corner', true, false, gearKind)); m.advance(6);
  assert.equal(m.gear.detached, gearKind !== 'headlamp'); assert.equal(m.phase, 'SLEEPING'); cases++;
}
console.log(`${cases} animation configurations passed, including 1×/0.25× replay of the 96-case core matrix`);
console.log(`Max 120 Hz step ${maxStep.toFixed(2)}px; max pre-sleep velocity ${maxSleepV.toFixed(3)}px/s; max contact distance ${maxJoint.toFixed(1)}px`);
console.log(`Largest physical payload ${maxPacket} bytes + 350-byte envelope; ${(performance.now() - t0).toFixed(0)}ms for acceptance matrix`);
