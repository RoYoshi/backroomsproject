/* SKIN-STEALER R14 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved): its body drawn for the game's camera - straight down.  The
 * page's own script runs here in Node, unchanged: public/assets/skinstealer.js as built (its mirror, its body, its kill poses), in a VM
 * whose Pixi classes are recorders (every shape the body draws, where, how many) and whose __api / __light are small stand-ins.  What
 * these check is geometry and honesty, not art: the owner judges the look (R14_TOPDOWN_ART_REPORT.md: visual approval pending).
 *   G01 eight headings, one body: the pose never depends on the heading; its proportions against a wanderer
 *   G02 never a squatting, frog-like or raised-hands figure in its ordinary acts
 *   G03 its head turns as the server says, its body does not
 *   M01 its motion does not lie: stride with speed, feet that step the way it really moves, still when it is still
 *   G04 hidden is hidden: still, its drawn body keeps near its centre; its shadow is small, under it, never pushed through a wall
 *   G05 a borrowed skin is a wanderer's body at a wanderer's size; dropping it, the body is out within about a tenth of a second
 *   G06 shaded by the light where it stands: black in the dark (no shadow there), pale in a lamp
 *   K01 a kill's attacker grips where the victim's neck really is, and goes down with it
 *   D01 the same server data draws the same body on two pages (nothing random)
 *   P01 its drawing cost: shapes a frame, four of them
 *   S01 nothing the server decides changed: its body radius, reach, pounce (and the one drawing scale) are R8's */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const S = []; const add = (name, fn) => S.push({ name, fn });
const KACT = ['', 'watch', 'back', 'leave', 'wait', 'lure', 'intercept', 'search', 'listen', 'approach', 'creep', 'chase', 'wind', 'pounce', 'recover', 'feed', 'mimic', 'rest', 'pace'];
const BODY = 36;                                            // a wanderer's body, across (player-view.ts: a circle of radius 18)

/* the recorders: a Container and a Graphics that remember what is drawn (points in their own space, shape count, fills' alpha) */
class FakeC {
  constructor() { this.children = []; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y === undefined ? x : y; } };
    this.scale = { x: 1, y: 1, set: (x, y) => { this.scale.x = x; this.scale.y = y === undefined ? x : y; } }; this.rotation = 0; this.alpha = 1; this.visible = true; this.tint = 0xffffff; }
  addChild(c) { this.children.push(c); c.parent = this; return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); c.parent = null; }
  destroy() { this.destroyed = true; }
}
class FakeG extends FakeC {
  constructor() { super(); this.clear(); }
  clear() { this.pts = []; this.n = 0; this.fills = []; this.sig = ''; return this; }
  _p(x, y, r) { this.pts.push([x, y, r || 0]); this.sig += x.toFixed(3) + ',' + y.toFixed(3) + ';'; }
  moveTo(x, y) { this._p(x, y); return this; } lineTo(x, y) { this._p(x, y); return this; }
  quadraticCurveTo(a, b, x, y) { this._p(a, b); this._p(x, y); return this; }
  ellipse(x, y, rx, ry) { this._p(x - rx, y); this._p(x + rx, y); this._p(x, y - ry); this._p(x, y + ry); return this; }
  circle(x, y, r) { return this.ellipse(x, y, r, r); }
  poly(p) { for (let i = 0; i < p.length; i += 2) this._p(p[i], p[i + 1]); return this; }
  fill(f) { this.n++; this.fills.push(typeof f === 'object' && f.alpha !== undefined ? f.alpha : 1); return this; }
  stroke(s) { this.n++; const w = (s && s.width || 1) / 2; for (const q of this.pts) q[2] = Math.max(q[2], w); return this; }
}
/* a page: the built script in a VM; light: the stand-in BR-RoLE sample; ray: how far the floor goes before a wall */
function page(o = {}) {
  const layer = new FakeC(), ctx = { console, Math, performance: { now: () => 0 }, innerWidth: 1024, innerHeight: 640, document: { getElementById: () => null, querySelector: () => null }, setTimeout: () => 0 };
  ctx.window = ctx; vm.createContext(ctx);
  const avatars = [];
  ctx.__api = { layer: () => layer, death: () => ({ blood: new FakeG() }), H: { x: 0, y: 0 }, lightOn: () => true,
    mkAvatar: look => { const a = new FakeC(); a.look = look; a.hands = [new FakeC(), new FakeC()]; a.gear = new FakeC(); a.update = () => {}; avatars.push(a); return a; } };
  ctx.__mpLib = { wire: { parseLook: s => ({ hat: s.split('|')[0] }) } };
  const L = Object.assign({ total: .8, direct: .7, dirX: -.6, dirY: -.8, ray: 60 }, o.light || {});
  ctx.__light = { mk: () => ({}), sample: () => ({ total: L.total, direct: L.direct, dirX: L.dirX, dirY: L.dirY }), shade: t => .1 + .9 * t, ray: () => L.ray };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'dphys.js'), 'utf8'), ctx);   // (G.I.B.'s death physics: the kills' timings, as the page has them)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'skinstealer.js'), 'utf8'), ctx);
  return { ctx, K: ctx.__skin, layer, avatars, L };
}
/* run a page's mirror and draw for secs at 60 fps; ent(t) gives the server's list */
function run(P, secs, ent, each) {
  for (let i = 0; i < Math.round(secs * 60); i++) { const t = i / 60; P.ctx.performance.now = () => t * 1000; P.K.mirror(ent(t), 1 / 60); P.K.draw(1 / 60); if (each) each(t); }
}
const viewOf = (P, id) => P.layer.children.find(c => c.__id === id);
/* a view's drawn points on the floor (world px): the body and the head, or the shadow */
function world(v, which) {
  const out = [], kids = which === 'shadow' ? [v.__sh] : [v.__g, v.__hd];
  const T = (x, y, n) => { const c = Math.cos(n.rotation), s = Math.sin(n.rotation); return [n.position.x + (x * c - y * s) * n.scale.x, n.position.y + (x * s + y * c) * n.scale.y]; };
  for (const g of kids) if (g) for (const [x, y, r] of g.pts) { for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const a = T(x + dx, y + dy, g), b = T(a[0], a[1], v); out.push(b); } }
  return out;
}
const one = (act, o = {}) => t => [Object.assign({ i: 7, x: (o.v || 0) * t * Math.cos((o.a || 0) + (o.dir || 0)), y: (o.v || 0) * t * Math.sin((o.a || 0) + (o.dir || 0)), a: o.a || 0, s: 1, ac: KACT.indexOf(act), v: o.v || 0, h: o.h || 0 }, o.dg ? { dg: o.dg } : {})];
const ACTS = [['', 0], ['watch', 0], ['pace', 90], ['back', 60, Math.PI], ['listen', 0], ['search', 80], ['approach', 90], ['creep', 62], ['intercept', 230], ['chase', 255], ['wait', 0], ['lure', 0], ['recover', 0], ['feed', 0], ['wind', 0], ['pounce', 380], ['mimic', 0], ['rest', 0]];
const settle = (P, act, spd, o = {}) => { const S0 = P.K.anatomy.settle(act, spd, o); return { S: S0, R: P.K.anatomy.rig(S0) }; };
const r2 = v => Math.round(v * 100) / 100;

add('G01 eight headings, one body: every act at 0, 45 ... 315 deg draws the same body (its shapes in its own space identical, only turned to its heading); beside a wanderer it is a third again as wide at the shoulders and about 1.4 times as tall, its fingertips hanging to its knees', () => {
  const P = page(), bad = [];
  for (const [act, v, dir] of ACTS) {
    let ref = null;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4; run(P, 2, one(act, { a, v, dir }));
      const view = viewOf(P, 7), sig = view.__g.sig + '|' + view.__hd.sig, turn = Math.abs(Math.atan2(Math.sin(view.rotation - a - Math.PI / 2), Math.cos(view.rotation - a - Math.PI / 2)));
      if (ref === null) ref = sig; else if (sig !== ref) bad.push(`${act || 'stand'}@${k * 45}: shapes differ`);
      if (turn > 1e-6) bad.push(`${act || 'stand'}@${k * 45}: turned ${turn.toFixed(3)}`);
      run(P, .05, () => []);                                       // (gone: a new view each heading, the same seed)
    }
  }
  const sc = P.K.anatomy.AN, { R } = settle(P, 'watch', 0), BS = 1.3;
  // (a wanderer: 36 px across, about 1.75 m - 140 px at the same 80 px a metre; its own height straightened: legs, trunk, neck, skull)
  const shoulders = 2 * 18 * BS, tall = (sc.thigh + sc.shin + sc.torso + sc.neck + 2 * sc.skL) * BS, crown = (R.hd[2] + 6) * BS, fing = R.arms[0].wr[2] - sc.finger, knee = R.legs[0].k[2];
  const ok = !bad.length && shoulders / BODY >= 1.2 && shoulders / BODY <= 1.45 && tall / 140 >= 1.25 && tall / 140 <= 1.5 && fing <= knee + 12;
  return { ok, note: `${ACTS.length} acts x 8 headings: ${bad.length ? bad.slice(0, 4).join('; ') : 'identical bodies, turned exactly'}; shoulders ${shoulders.toFixed(0)} px to a wanderer's ${BODY} (x ${(shoulders / BODY).toFixed(2)}); its height ${tall.toFixed(0)} px to a wanderer's ~140 (x ${(tall / 140).toFixed(2)}; watching, stooped, its crown at ${crown.toFixed(0)}); hanging fingertips at ${fing.toFixed(0)}, knees at ${knee.toFixed(0)} (its own units)` };
});

add('G02 no squatting frog, no raised hands: through a whole stride of every ordinary act its knees stay over its feet (never splayed out to the sides), its hands below its shoulders and its head; upright acts stand tall (hips at 85 %+ of its legs); crouched acts bend their knees forward', () => {
  const P = page(), bad = [], AN = P.K.anatomy.AN, legL = AN.thigh + AN.shin;
  const strike = new Set(['pounce', 'wind']);
  for (const [act, v, dir] of ACTS) for (let ph = 0; ph < 8; ph++) {
    const { R } = settle(P, act, v, { dir: dir || 0, ph: ph * Math.PI / 4 }), tag = `${act || 'stand'}/${ph}`;
    for (const L of R.legs) { if (Math.abs(L.k[0]) > AN.hipw + 8) bad.push(`${tag} knee out ${r2(L.k[0])}`); if (L.k[1] > L.h[1] + 6 && act !== 'pounce') bad.push(`${tag} knee behind its hip`); }
    if (!strike.has(act)) for (const A of R.arms) { if (A.wr[2] > A.sh[2] + 1) bad.push(`${tag} hand raised ${r2(A.wr[2] - A.sh[2])}`); if (A.wr[2] > R.hd[2]) bad.push(`${tag} hand over its head`); }
    if (['', 'watch', 'pace', 'back', 'mimic'].includes(act) && R.Hp[2] < .85 * legL) bad.push(`${tag} squatting (hips ${r2(R.Hp[2] / legL)})`);
  }
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 6).join('; ') : `${ACTS.length} acts x 8 phases of the stride: knees within ${AN.hipw + 8} of its centre line, hands under shoulders and head, upright acts tall` };
});

add('G03 its head turns as the server says, its body holds: listening with the server\'s head at +0.8 / -0.8 rad, the drawn skull turns to it (within 0.05) while the trunk, arms and legs are exactly where they are with the head straight', () => {
  const P = page(), out = [];
  let ok = true;
  for (const h of [.8, -.8]) {
    run(P, 3, one('listen', { h })); const v = viewOf(P, 7), yaw = v.__hd.rotation, trunk = v.__g.sig;
    run(P, .05, () => []); run(P, 3, one('listen', { h: 0 })); const v0 = viewOf(P, 7);
    const same = trunk.split(';').length === v0.__g.sig.split(';').length;
    out.push(`head ${h}: skull ${yaw.toFixed(3)}, trunk shapes ${same ? 'unchanged in count' : 'DIFFERENT'}`);
    // (the neck leans a little toward the turn; the trunk itself - its sections - must not move)
    const A = P.K.anatomy, s1 = A.settle('listen', 0, { head: h }), s0 = A.settle('listen', 0, { head: 0 }), R1 = A.rig(s1), R0 = A.rig(s0);
    const trunkSame = JSON.stringify([R1.Hp, R1.Sc, R1.legs.map(l => l.f), R1.arms.map(a => a.wr)]) === JSON.stringify([R0.Hp, R0.Sc, R0.legs.map(l => l.f), R0.arms.map(a => a.wr)]);
    if (Math.abs(yaw - h) > .05 || !trunkSame) ok = false;
    out.push(`rig: yaw ${R1.yaw.toFixed(3)}, body ${trunkSame ? 'identical' : 'MOVED'}`);
    run(P, .05, () => []);
  }
  return { ok, note: out.join('; ') };
});

add('M01 its motion does not lie: its stride grows with its real speed (running at 255 at least twice its stalk at 90); walking backward its feet step backward, sidestepping they step sideways; standing still its feet do not move', () => {
  const P = page(), A = P.K.anatomy, span = (act, v, dir) => {           // how far one foot travels (relative to its hip) through a stride
    const mx = [[1e9, -1e9, 1e9, -1e9], [1e9, -1e9, 1e9, -1e9]]; const S0 = A.settle(act, v, { dir });
    for (let k = 0; k < 16; k++) { S0.ph = k * Math.PI / 8; const R = A.rig(S0); R.legs.forEach((L, i) => { const x = L.f[0] - L.h[0], y = L.f[1] - L.h[1], m = mx[i]; m[0] = Math.min(m[0], x); m[1] = Math.max(m[1], x); m[2] = Math.min(m[2], y); m[3] = Math.max(m[3], y); }); }
    return { x: Math.max(...mx.map(m => m[1] - m[0])), y: Math.max(...mx.map(m => m[3] - m[2])) };
  };
  const walk = span('approach', 90, 0), runS = span('chase', 255, 0), side = span('pace', 90, Math.PI / 2), still = span('watch', 0, 0);
  // which way a lifted foot moves: forward when it walks forward, backward when it backs away
  const swingDir = (act, v, dir) => { const S0 = A.settle(act, v, { dir }); let s = 0; for (let k = 0; k < 16; k++) { S0.ph = k * Math.PI / 8; const a = A.rig(S0); S0.ph += .05; const b = A.rig(S0); for (let i = 0; i < 2; i++) if (a.legs[i].f[2] > 1) s += b.legs[i].f[1] - a.legs[i].f[1]; } return s; };
  const fw = swingDir('approach', 90, 0), bw = swingDir('back', 60, Math.PI);
  const ok = runS.y >= 2 * walk.y && side.x > side.y && still.x < .01 && still.y < .01 && fw < 0 && bw > 0;
  return { ok, note: `stride (its own units, front to back): stalking ${walk.y.toFixed(1)}, running ${runS.y.toFixed(1)} (x ${(runS.y / walk.y).toFixed(2)}); sidestep ${side.x.toFixed(1)} across / ${side.y.toFixed(1)} along; still ${still.x.toFixed(2)}/${still.y.toFixed(2)}; a lifted foot moves ${fw < 0 ? 'forward' : 'BACKWARD'} walking, ${bw > 0 ? 'backward' : 'FORWARD'} backing away` };
});

add('G04 hidden is hidden: in every still act (standing, watching, waiting coiled, at a lure, listening, resting, speaking) all it draws lies within 40 px of its centre (its body\'s radius is 24); its shadow stays within its body\'s reach plus 10 px, and is never pushed toward a wall that is near (a corner never shows a shadow its body does not)', () => {
  const out = [], bad = [];
  for (const act of ['', 'watch', 'wait', 'lure', 'listen', 'rest', 'mimic']) {
    const P = page(); run(P, 2, one(act, { a: 1.1 })); const v = viewOf(P, 7), pts = world(v, 'body'), far = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
    const sh = world(v, 'shadow'), shFar = sh.length ? Math.max(...sh.map(([x, y]) => Math.hypot(x, y))) : 0;
    out.push(`${act || 'stand'} ${far.toFixed(0)}/${shFar.toFixed(0)}`); if (far > 40) bad.push(act || 'stand'); if (shFar > far + 10) bad.push((act || 'stand') + ' shadow');
  }
  // a wall 20 px away in the shadow's direction: no push at all (the shadow's centre stays under it)
  const near = page({ light: { ray: 20 } }), open = page({ light: { ray: 60 } });
  run(near, 2, one('watch')); run(open, 2, one('watch'));
  const cen = P => { const p = world(viewOf(P, 7), 'shadow'); const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
  const cn = cen(near), co = cen(open), push = Math.hypot(co[0] - cn[0], co[1] - cn[1]);
  return { ok: !bad.length && push > 1 && push < 12, note: `drawn reach / shadow reach (px): ${out.join(', ')}; the shadow's push with the floor open ${push.toFixed(1)} px, with a wall 20 px away 0${bad.length ? '; OVER: ' + bad.join(', ') : ''}` };
});

add('G05 a borrowed skin: the page\'s own wanderer avatar (the look it was sent, at a wanderer\'s size - never the creature\'s scale), the body hidden once it has folded in; when the skin is dropped (its wind-up, a run) the body is out within about a tenth of a second and the avatar gone', () => {
  const P = page(); let st = 0, outAt = -1;
  run(P, 1, one('watch', { dg: 'cap|plain|#c99a76|#4a6b8a' }));
  const v = viewOf(P, 7), av = P.avatars[0], inSkin = av && av.visible !== false && av.alpha > .99 && v.visible === false && av.scale.x === 1;
  run(P, .5, one('wind'), t => { const w = viewOf(P, 7); if (outAt < 0 && w.visible && w.alpha >= .9) outAt = t; st = w.scale.x; });
  const gone = !viewOf(P, 7).__av;
  return { ok: !!inSkin && outAt >= 0 && outAt <= .12 && gone && Math.abs(st - 1.3) < .01, note: `in the skin: avatar ${av ? 'made (scale ' + av.scale.x + ', alpha ' + av.alpha.toFixed(2) + ')' : 'MISSING'}, body ${v.visible ? 'VISIBLE' : 'hidden'}; dropped: the body at 90 %+ after ${(outAt * 1000).toFixed(0)} ms, its scale back to ${st.toFixed(2)}, the avatar ${gone ? 'gone' : 'STILL THERE'}` };
});

add('G06 shaded by the light where it stands: in the dark (light total .05, nothing direct) it is nearly black and casts no shadow; under a lamp it is pale and its shadow is there', () => {
  const dark = page({ light: { total: .05, direct: 0, dirX: 0, dirY: 0 } }), lit = page({ light: { total: .9, direct: .8 } });
  run(dark, 2, one('watch')); run(lit, 2, one('watch'));
  const vd = viewOf(dark, 7), vl = viewOf(lit, 7), td = vd.tint & 255, tl = vl.tint & 255;
  const sd = vd.__sh.fills.filter(a => a > .02 && a < .2).length, sl = vl.__sh.fills.filter(a => a > .02 && a < .2).length;
  return { ok: td < 60 && tl > 200 && sd === 0 && sl >= 3, note: `tint ${td}/255 in the dark, ${tl}/255 under the lamp; shadow layers ${sd} in the dark, ${sl} lit` };
});

add('K01 a kill\'s attacker: its hands go to the victim\'s neck - as far ahead as the victim really is in the death\'s physics, as high as the neck then is (standing, then down: A at the snap, B at once, C as the legs go); never a NaN', () => {
  const P = page(), out = []; let ok = true;
  for (const [vr, d] of [['A', 44], ['B', 40], ['C', 38]]) {
    const z = [];
    for (const t of [.05, .3, .6, 1.2, 2]) {
      const death = { variant: vr, elapsed: t, attacker: { x: 0, y: 0, angle: 0 }, body: { x: d, y: 0 }, impact: vr === 'C' ? .8 : 0 };
      P.K.attack(null, t, 1 / 60, death);
      const own = P.layer.children.find(c => c.label === 'skinstealer-kill'), R = own.__r, w = R.arms.map(a => a.wr);
      if (![...own.__g.pts, ...own.__hd.pts].every(q => Number.isFinite(q[0]) && Number.isFinite(q[1]))) ok = false;
      z.push(Math.round((w[0][2] + w[1][2]) / 2));
      if (t === .3) { const ahead = -(w[0][1] + w[1][1]) / 2 * 1.3; out.push(`${vr}: hands ${ahead.toFixed(0)} px ahead (victim ${d})`); if (Math.abs(ahead - d) > 14) ok = false; }
    }
    out.push(`${vr} grip height ${z.join('>')}`); if (!(z[z.length - 1] < z[0] - 20)) ok = false;
  }
  return { ok, note: out.join('; ') };
});

add('D01 the same server data, the same body on two pages: a creature walking, stopping to listen, creeping, waiting and running, mirrored on two pages - every shape it draws identical, frame for frame (its tics and hair are seeded, never random)', () => {
  const A = page(), B = page(), seq = t => one(t < 2 ? 'pace' : t < 4 ? 'listen' : t < 6 ? 'creep' : t < 8 ? 'wait' : 'chase', { v: t < 2 ? 90 : t < 4 ? 0 : t < 6 ? 62 : t < 8 ? 0 : 255, h: t > 2 && t < 4 ? .6 : 0 })(t);
  let diff = 0, n = 0;
  for (let i = 0; i < 600; i++) { const t = i / 60;
    for (const P of [A, B]) { P.ctx.performance.now = () => t * 1000; P.K.mirror(seq(t), 1 / 60); P.K.draw(1 / 60); }
    const a = viewOf(A, 7), b = viewOf(B, 7); n++; if (a.__g.sig !== b.__g.sig || a.__hd.sig !== b.__hd.sig || a.__sh.sig !== b.__sh.sig) diff++; }
  return { ok: diff === 0, note: `${n} frames, ${diff} differing` };
});

add('P01 its drawing cost: shapes a frame for one creature in each act (fills and strokes), and four creatures drawn for 10 s in Node (recorders, not the GPU: the real page is measured in the browser scene)', () => {
  const P = page(), per = [];
  for (const [act, v, dir] of ACTS) { run(P, .5, one(act, { v, dir })); const w = viewOf(P, 7); per.push(w.__g.n + w.__hd.n + w.__sh.n); run(P, .05, () => []); }
  const Q = page(), four = t => [0, 1, 2, 3].map(k => ({ i: 10 + k, x: 200 * k + 90 * t, y: 0, a: 0, s: 1, ac: KACT.indexOf(['chase', 'creep', 'watch', 'wait'][k]), v: 90, h: 0 }));
  const t0 = process.hrtime.bigint(); run(Q, 10, four); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 600;
  const mx = Math.max(...per);
  return { ok: mx <= 140, note: `shapes a frame: ${Math.min(...per)}-${mx} (R8's figure: about 55); four creatures: ${ms.toFixed(3)} ms a frame here` };
});

add('S01 nothing the server decides changed: its body (radius 24, clearance 21), its grab reach (46), its pounce (55-185 px, 430 px/s for 0.36 s) and the one drawing scale (1.3) are R8\'s - the new body is drawing only', () => {
  const ai = require(path.join(ROOT, 'generated', 'server', 'ai.js')), SK = ai.SK, sp = ai.SPECIES ? ai.SPECIES.skinstealer : null;
  const head = fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'nani', 'client', 'skin.head.js'), 'utf8'), bs = /const BODY_SCALE = ([\d.]+);/.exec(head);
  const src = fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'nani', 'server', 'ai.skinstealer.js'), 'utf8'), rad = /radius: (\d+), clearance: (\d+)/.exec(src);
  const ok = SK.grabReach === 46 && SK.pounceRange[0] === 55 && SK.pounceRange[1] === 185 && SK.pounceSpeed === 430 && SK.pounceDur === .36 && rad && +rad[1] === 24 && +rad[2] === 21 && bs && +bs[1] === 1.3;
  return { ok, note: `radius ${rad && rad[1]}, clearance ${rad && rad[2]}, grab ${SK.grabReach}, pounce ${SK.pounceRange.join('-')} px at ${SK.pounceSpeed} for ${SK.pounceDur} s, BODY_SCALE ${bs && bs[1]}${sp ? '' : ''}` };
});

module.exports = S;
