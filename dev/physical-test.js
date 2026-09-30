'use strict';
const assert = require('assert/strict');
const { Motion, DT, rotate } = require('../death-motion');
const { harness } = require('./physical-harness');
const walls = [{ x: 360, y: 130, w: 40, h: 240 }, { x: 100, y: 130, w: 30, h: 240 }];
let checks = 0;
function check(label, fn) { fn(); console.log('PASS ' + label); checks++; }
function config(kind, variant, extra = {}) { return { kind, variant, victim: { x: 240, y: 240, angle: 0 }, source: { x: 200, y: 240 }, hat: 'cap', gearKind: 'flashlight', wall: variant === 'C' ? { x: 360, y: 240 } : null, rects: () => walls, ...extra }; }
for (const kind of ['Hound', 'Smiler']) for (const variant of ['A', 'B', 'C', 'D']) {
  check(kind + ' ' + variant + ': fixed-step replay is identical at 30/60/144 fps', () => {
    const ends = [30, 60, 144].map(fps => { const m = new Motion(config(kind, variant)); for (let t = 0; t < 4; t += 1 / fps) m.advance(t); m.advance(4); return [m.body, m.pose, m.gear, m.hat]; });
    assert.deepEqual(ends[0], ends[1]); assert.deepEqual(ends[0], ends[2]);
  });
  check(kind + ' ' + variant + ': body/hand clearance, reach, continuity and settling', () => {
    const m = new Motion(config(kind, variant)); let prev = [m.body, ...m.hands].map(p => ({ x: p.x, y: p.y }));
    for (let i = 1; i <= 480; i++) {
      m.advance(i * DT);
      [m.body, ...m.hands, m.gear, m.hat].forEach(p => walls.forEach(r => {
        assert(Math.hypot(p.x - Math.max(r.x, Math.min(p.x, r.x + r.w)), p.y - Math.max(r.y, Math.min(p.y, r.y + r.h))) >= p.r - .01, 'penetrated wall');
      }));
      m.hands.forEach((h, j) => { const local = rotate(h.x - m.body.x, h.y - m.body.y, -m.body.angle); assert(local.x * h.side >= 6.8, 'changed side'); assert(Math.hypot(local.x - h.side * 11, local.y) <= 27.05, 'exceeded invisible arm reach'); });
      [m.body, ...m.hands].forEach((p, j) => assert(Math.hypot(p.x - prev[j].x, p.y - prev[j].y) < 9, 'pose teleport'));
      prev = [m.body, ...m.hands].map(p => ({ x: p.x, y: p.y }));
    }
    const old = structuredClone([m.body, m.pose, m.gear, m.hat]); m.advance(20); assert.deepEqual([m.body, m.pose, m.gear, m.hat], old);
  });
}
check('Hound wall slam produces a real collision and recoil', () => { const m = new Motion(config('Hound', 'C')); m.advance(4); assert(m.collisions >= 1); assert(m.body.x < 342); });
check('Hound impact creates independent hand lag rather than a rigid group', () => {
  const m = new Motion(config('Hound', 'A')); const initial = m.pose.h[0]; m.advance(.18); assert(Math.hypot(m.pose.h[0][0] - initial[0], m.pose.h[0][1] - initial[1]) > 5);
});
check('Smiler starts still, then moves continuously toward darkness', () => { const m = new Motion(config('Smiler', 'A')); m.advance(.5); assert(Math.abs(m.body.x - 240) < .01); m.advance(2); assert(m.body.x < 220); });
check('Carpet stops the tackle earlier than wet tile', () => { const carpet = new Motion(config('Hound', 'A', { rects: () => [] })), wet = new Motion(config('Hound', 'A', { rects: () => [], surface: () => 'wet' })); carpet.advance(4); wet.advance(4); assert(wet.body.x > carpet.body.x + 35); });
for (const kind of ['Hound', 'Smiler']) for (const gearKind of ['flashlight', 'headlamp', 'lantern', 'camcorder']) {
  check(kind + '/' + gearKind + ': shipped animation becomes the exact shipped corpse pose', () => {
    const h = harness(walls); h.H.equipment.kind = gearKind; h.av.lightGear.kind = gearKind; h.av.update(0, true, false, h.H);
    const d = new h.Death(); d.start(kind, 0, { x: 200, y: 240 }, -1, null, { v: 'B' });
    for (let t = 0; t < 4; t += 1 / 60) d.frame(t); d.frame(4);
    h.av.update(4, true, false, h.H); h.av.deathPose(d.injury, d.impact, true, d.physicalPose);
    const f = new h.Finish(); f.death = d; f.completeDeath(4); const rec = h.corpses[0];
    assert.deepEqual(JSON.parse(JSON.stringify(rec.pose)), JSON.parse(JSON.stringify(d.physicalPose)));
    const c = new h.Corpse(rec), av = c.children[1];
    assert.equal(av.hands.length, 2); assert.equal(av.body.children.length, 1);
    for (let i = 0; i < 2; i++) { assert.equal(av.hands[i].x, h.av.hands[i].x); assert.equal(av.hands[i].y, h.av.hands[i].y); }
    assert.equal(av.body.scale.x, h.av.body.scale.x); assert.equal(av.body.scale.y, h.av.body.scale.y);
    assert.equal(av.hat.visible, h.av.hat.visible); assert.equal(av.gear.visible, h.av.gear.visible);
    assert.deepEqual(av.wounds.ops, h.av.wounds.ops); assert.equal(av.tint, 0xffffff);
    if (gearKind !== 'headlamp') { assert.equal(c.children[2].rotation, d.torch.angle + Math.PI / 2); assert.equal(c.children[2].x, d.torch.x); }
    assert.equal(c.children.at(-1).rotation, d.physicalHat.angle); assert.deepEqual(c.children.at(-1).ops, d.debris.children.at(-1).ops);
  });
}
check('Replay preserves initial live hands and accessory configuration', () => {
  const h = harness(walls), a = new h.Death(); a.start('Hound', 1, { x: 200, y: 240 }, -1, null, { v: 'C', w: [360, 240, 0] });
  const b = new h.Death(); b.start('Hound', 90, a.source, -1, { ...h.H, hat: h.look.hat, appearance: h.look }, { v: 'C', w: [360, 240, 0], mi: JSON.parse(JSON.stringify(a.motionInitial)) });
  a.frame(3); b.frame(92); assert.equal(JSON.stringify(a.physicalPose), JSON.stringify(b.physicalPose)); assert.deepEqual(a.body, b.body); assert.deepEqual(a.torch, b.torch);
});
check('Physical bodies and hands stay clear of actual Level 0 corners and furniture', () => {
  const sim = require('../sim')({ seed: 7, director: false }), ad = sim.adapter;
  const points = [];
  for (let n = 0; n < 6912 && points.length < 24; n++) {
    const cell = (n * 137) % 6912, x = (cell % 96 + .5) * 96 + 23, y = (Math.floor(cell / 96) + .5) * 96 - 21, angle = n * .37;
    if (!ad.clear(x, y, 20, 'crawl') || ad.clear(x, y, 70, 'crawl')) continue;
    const valid = [-13, 13].every(hx => { const p = rotate(hx, -13, angle + Math.PI / 2); return ad.clear(x + p.x, y + p.y, 6, 'crawl'); });
    if (valid) points.push({ x, y, angle });
  }
  assert.equal(points.length, 24);
  points.forEach((v, i) => {
    const m = new Motion({ ...config(i % 2 ? 'Hound' : 'Smiler', i % 3 ? 'B' : 'A'), victim: v, source: { x: v.x - Math.cos(i) * 40, y: v.y - Math.sin(i) * 40 }, rects: (x, y) => ad.blockers(x, y, 'crawl') });
    for (let n = 1; n <= 462; n++) {
      m.advance(n * DT);
      assert(ad.clear(m.body.x, m.body.y, 17.99, 'crawl'), 'body penetrated actual level');
      m.hands.forEach(h => {
        assert(ad.clear(h.x, h.y, 5.99, 'crawl'), 'hand penetrated actual level');
        const p = rotate(h.x - m.body.x, h.y - m.body.y, -m.body.angle);
        assert(p.x * h.side >= 6.8 && Math.hypot(p.x - h.side * 11, p.y) <= 27.1, 'hand lost its invisible anchor near a real wall');
      });
    }
  });
});
console.log(checks + ' physical motion / renderer checks passed');
