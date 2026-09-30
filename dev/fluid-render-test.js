'use strict';
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const { harness, Container, Graphics, ROOT } = require('./physical-harness');
const { durationFor } = require('../death-motion');
let checks = 0;
function finite(g) {
  assert(Number.isFinite(g.x + g.y + g.rotation + g.scale.x + g.scale.y), 'nonfinite node transform');
  for (const op of g.ops || []) for (const item of op.slice(1)) {
    if (typeof item === 'number') assert(Number.isFinite(item), 'nonfinite Graphics coordinate in ' + op[0]);
    if (Array.isArray(item)) assert(item.every(Number.isFinite), 'nonfinite Graphics vertices');
    if (item && typeof item === 'object' && !Array.isArray(item)) Object.values(item).forEach(x => { if (typeof x === 'number') assert(Number.isFinite(x)); });
  }
  g.children.forEach(finite);
}
for (const kind of ['Hound', 'Smiler']) for (const variant of ['A', 'B', 'C', 'D']) {
  for (const speed of [1, .25]) {
    const walls = variant === 'C' ? [{ x: 314, y: 90, w: 28, h: 300 }] : [], h = harness(walls), d = new h.Death();
    Object.assign(h.H, { vx: 105, vy: 22, stamina: variant === 'D' ? 5 : 100 });
    d.start(kind, 0, { x: 160, y: 236 }, -1, null, { v: variant, w: walls.length ? [314, 244, 0] : 0 });
    const view = kind === 'Hound' ? new h.Hound() : new h.Smiler({ x: 160, y: 236 });
    for (let f = 0; f <= Math.ceil(6 / speed * 30); f++) {
      const t = f / 30 * speed; d.frame(t); view.position.set(d.attacker.x, d.attacker.y); view.rotation = d.attacker.angle + Math.PI / 2;
      if (kind === 'Hound') view.attackPose(d.grip, d.impact, variant, d); else h.win.__ents.attackSmiler(view, t, speed / 30, d);
      h.av.position.set(d.body.x, d.body.y); h.av.rotation = d.body.angle; h.av.deathPose(d.injury, d.impact, true, d.physicalPose);
      [view, h.av, d.blood, d.debris].forEach(finite); assert.equal(h.av.hands.length, 2); assert.equal(h.av.body.children.length, 1);
      if (kind === 'Smiler') assert(view.scale.x <= 1.12001, 'Smiler growth obscures victim');
    }
    const E = h.win.__ents, target = { x: 160, y: 236, angle: 0, state: kind === 'Hound' ? 'FEEDING' : 'WATCHING', act: kind === 'Hound' ? 'feed' : 'watch', face: 1, distance: 0 };
    h.win.__deathMotion.returnAttacker(view, d, 6);
    let old = { x: view.x, y: view.y };
    for (let f = 1; f <= 300; f++) {
      const t = 6 + f / 60; view.position.set(target.x, target.y); view.rotation = target.angle + Math.PI / 2;
      if (kind === 'Hound') E.drawHound(view, target, t, 1 / 60); else E.drawSmiler(view, target, t, 1 / 60, 1);
      assert(Math.hypot(view.x - old.x, view.y - old.y) < 4.05, 'attacker snapped during return to server position'); old = { x: view.x, y: view.y }; finite(view);
    }
    assert(!view.__deathReturn, 'attacker cosmetic return did not retire');
  }
  checks++; console.log(`PASS ${kind} ${variant}: real Graphics at 1×/0.25×, simple player, continuous attacker handoff`);
}
// Execute the actual remote-event functions; only DOM/server clock/transport
// plumbing is supplied by the harness. Both body-first and body-late ordering
// must adopt the avatar, not replace it or destroy the returning attacker.
for (const arrival of ['body-first', 'body-late']) {
  const h = harness(), layer = new Container(), floor = new Container(), views = new Map(), actorViews = [];
  const A = h.win.__api; Object.assign(A, { Jl: h.Death, Wl: h.Hound, Gl: h.Smiler, layer: () => layer, floor: () => floor, q: [], corpseViews: () => views,
    replaceEntity: (kind, slot, view) => { actorViews[slot] = view; return true; } });
  vm.runInContext(`var myId=99, bodiesList=[], serverClockOffset=0;var hMap=new Map([[1,{x:160,y:236,slot:0}]]),hSlots=[];var EN=()=>window.__ents;var angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));`, h.ctx);
  const source = fs.readFileSync(ROOT + '/mp.js', 'utf8');
  vm.runInContext(source.slice(source.indexOf('const partObj ='), source.indexOf('\nfunction dropAvatar')) + source.slice(source.indexOf('const fxs ='), source.indexOf('/* how another wanderer moves')), h.ctx);
  vm.runInContext(`startFx({id:1,k:'death',c:'Hound',x:240,y:240,a:0,sx:160,sy:236,v:'B',lk:'cap|plain|#e6bb76|#ffcc77|canvas',ek:'flashlight',mi:{v:2,seed:47,h:[[-13,-13],[13,-13]],b:[1,1,0],gv:[13,-13,0],mv:[0,0,0,1],av:[0,0,.05]}})`, h.ctx);
  const f = h.win.__fxs[0], av = f.av, attacker = f.att;
  for (let frame = 0; frame <= 270; frame++) vm.runInContext(`updateFx(${frame}/60)`, h.ctx);
  f.jl.frame(6); av.position.set(f.jl.body.x, f.jl.body.y); av.rotation = f.jl.body.angle;
  const d = f.jl, rec = { id: 'r:1:fixture', ownerId: 'r1', name: 'REMOTE', cause: 'Hound', appearance: f.look, equipment: f.gear, x: d.body.x, y: d.body.y, angle: d.body.angle, scaleX: 1, scaleY: 1, pose: d.motion.snapshot(), blood: d.bursts, dropped: d.equipmentTransform, hat: d.physicalHat };
  if (arrival === 'body-first') { const corpse = new h.Corpse(rec); views.set(rec.id, corpse); }
  vm.runInContext('bodiesList=[{k:1,x:100,y:240,a:0,ps:{seed:1,v:2}}]', h.ctx);
  vm.runInContext('updateFx(6)', h.ctx);
  if (arrival === 'body-late') { const corpse = new h.Corpse(rec); views.set(rec.id, corpse); }
  assert.equal(views.get(rec.id).children[1], av, 'remote corpse replaced the animated avatar');
  assert(!av.destroyed); assert(!attacker.destroyed); assert.equal(actorViews[0], attacker); assert.equal(h.win.__fxs.length, 0);
  checks++; console.log('PASS remote ' + arrival + ': same avatar and attacker survive event cleanup');
  vm.runInContext(`startFx({id:2,k:'death',c:'Hound',x:240,y:240,a:0,sx:160,sy:236,v:'B',lk:'cap|plain|#e6bb76|#ffcc77|canvas',ek:'flashlight',mi:{seed:21,h:[[-13,-13],[13,-13]],b:[1,1,0],gv:[13,-13,0]}})`, h.ctx);
  const legacy = h.win.__fxs[0]; assert(!legacy.jl.motion); assert.equal(legacy.jl.duration, 3.85);
}
console.log(checks + ' renderer and remote handoff checks passed');
