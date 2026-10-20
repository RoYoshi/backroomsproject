/* skinstealer.js - the Skin-Stealer on the page (Trial 3; dev/trial-3-skin-stealer/DESIGN_DECISIONS.md).  Loaded after mp.js. */
(() => {
'use strict';
function skinHead() {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const API = () => window.__api;
/* the script's public object: each module adds its own entries (mirror: the snapshot's list; body: draw, clear, attacker views) */
const K = window.__skin = {};
/* the codes as the server sends them: the shared states (ai.head.js S, numbered SCODE) and the Skin-Stealer's acts (ai.skinstealer.js
 * KACT); dev/tools/checks/facts.json holds every copy of each to the same list */
const STATES = ['DORMANT', 'ROAMING', 'CURIOUS', 'ALERT', 'WATCHING', 'STALKING', 'HUNTING', 'SEARCHING', 'CAUTIOUS', 'FRUSTRATED', 'EXCITED', 'FEEDING', 'PLAYING', 'RETREATING', 'HIDDEN', 'FOLLOWING', 'PROVOKED', 'ATTACKING', 'DISAPPEARING'];
const ACTS = ['', 'watch', 'back', 'leave', 'wait', 'lure', 'intercept', 'search', 'listen', 'approach', 'creep', 'chase', 'wind', 'pounce', 'recover', 'feed', 'mimic', 'rest', 'pace'];
return { ACTS, angDiff, API, clamp, K, lerp, sm, STATES, TAU };
}
function skinMirror({ head: { ACTS, angDiff, K, STATES } }) {
const MAX = 8;
const slots = new Map();                                   // entity id -> { id, x, y, angle, state, act, v, head, dg, distance }
function mirror(list, dt) {
  dt = Math.max(0, Math.min(.25, +dt || 0));
  const seen = new Set();
  for (const t of Array.isArray(list) ? list : []) {
    if (!t || !Number.isSafeInteger(t.i) || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
    let o = slots.get(t.i);
    if (!o) { if (slots.size >= MAX) continue; o = { id: t.i, x: t.x, y: t.y, angle: +t.a || 0, distance: 0 }; slots.set(t.i, o); }
    seen.add(t.i);
    const px = o.x, py = o.y, ip = window.__netPose ? window.__netPose('k' + t.i) : null;
    if (ip) { o.x = ip.x; o.y = ip.y; o.angle = ip.a; }
    else if (Math.hypot(t.x - o.x, t.y - o.y) > 260) { o.x = t.x; o.y = t.y; o.angle = +t.a || 0; }
    else { const k = 1 - Math.exp(-dt * 14); o.x += (t.x - o.x) * k; o.y += (t.y - o.y) * k; o.angle += angDiff(+t.a || 0, o.angle) * (1 - Math.exp(-dt * 12)); }
    o.distance += Math.hypot(o.x - px, o.y - py);
    o.state = STATES[t.s] || 'ROAMING'; o.act = ACTS[t.ac] || ''; o.v = +t.v || 0; o.head = +t.h || 0;
  }
  for (const id of [...slots.keys()]) if (!seen.has(id)) slots.delete(id);
}
const clear = () => { slots.clear(); };
const list = () => [...slots.values()];
K.mirror = mirror;
return { clear, list };
}
function skinBody({ head: { API, clamp, K, lerp, sm, TAU }, mirror: { clear, list } }) {
const SC = { line: 0x14100d, skin: 0xa2988b, skinLo: 0x6c6259, skinHi: 0xcbc1b2, fold: 0x7d7368, nail: 0x2a2320, hair: 0x15120f, mouth: 0x2a0d0e };
const views = new Map();                                   // entity id -> view
let Cc = null, Gc = null;                                  // the page's Container and Graphics classes
function classes() {
  if (Cc && Gc) return true;
  const A = API(), layer = A && A.layer && A.layer(), d = A && A.death && A.death();
  if (!layer || !d || !d.blood) return false;
  Cc = layer.constructor; Gc = d.blood.constructor; return true;
}
/* two-bone IK, the joint bending outward (side -1 left, +1 right) */
function ik(ax, ay, tx, ty, l1, l2, side) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 1; const mx = l1 + l2 - .6, mn = Math.abs(l1 - l2) + 1;
  if (d > mx) { tx = ax + dx / d * mx; ty = ay + dy / d * mx; dx = tx - ax; dy = ty - ay; d = mx; }
  if (d < mn) { tx = ax + dx / d * mn; ty = ay + dy / d * mn; dx = tx - ax; dy = ty - ay; d = mn; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let px = -dy / d, py = dx / d; if (px * side < 0) { px = -px; py = -py; }
  return { ex: ax + dx * a / d + px * h, ey: ay + dy * a / d + py * h, tx, ty };
}
function make(id) {
  const A = API(), layer = A.layer(), v = new Cc(), g = new Gc();
  v.addChild(g); v.__g = g; v.__skin = true; v.__id = id; v.label = 'skinstealer#' + id;
  v.__s = { ph: Math.random() * TAU, px: null, py: null, vf: 0, crouch: 0, reach: 0, back: 0, lean: 0, tilt: 0, tiltT: 0, tiltTo: 0, twitch: 0, seed: Math.random() * 100 };
  layer.addChild(v); views.set(id, v); return v;
}
/* the pose from what the server says it is doing (its act and state, its speed), eased so it never pops */
function pose(S, o, t, dt) {
  if (S.px === null || Math.hypot(o.x - S.px, o.y - S.py) > 220) { S.px = o.x; S.py = o.y; }
  const vx = (o.x - S.px) / dt, vy = (o.y - S.py) / dt; S.px = o.x; S.py = o.y;
  const k = 1 - Math.exp(-dt * 9), fwd = vx * Math.cos(o.angle) + vy * Math.sin(o.angle);
  S.vf += (fwd - S.vf) * k;
  const a = o.act, still = a === 'watch' || a === 'wait' || a === 'lure' || a === 'listen' || a === 'mimic' || a === 'rest';
  const want = {
    crouch: a === 'wind' ? 1 : a === 'creep' || a === 'approach' ? .6 : a === 'feed' ? .85 : a === 'chase' ? .4 : still ? .3 : .12,
    reach: a === 'pounce' ? 1 : a === 'chase' ? .55 : a === 'feed' ? .7 : a === 'approach' || a === 'creep' ? .25 : 0,
    back: a === 'wind' ? 1 : a === 'recover' ? .5 : 0,
    lean: a === 'pounce' ? 1 : a === 'chase' ? .6 : a === 'feed' ? .8 : a === 'creep' ? .35 : 0,
  };
  const e = 1 - Math.exp(-dt * (a === 'wind' || a === 'pounce' ? 18 : 6));
  for (const n in want) S[n] += (want[n] - S[n]) * e;
  // the head: still figures tilt it, slowly, too far (a tell); otherwise it follows where the server says it looks
  S.tiltT -= dt; if (S.tiltT <= 0) { S.tiltT = 1.5 + Math.random() * 3; S.tiltTo = still ? (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .5) : 0; }
  S.tilt += (S.tiltTo + clamp(o.head || 0, -1, 1) * .6 - S.tilt) * (1 - Math.exp(-dt * (still ? 1.3 : 5)));
  S.twitch = Math.max(0, S.twitch - dt * 3); if (still && Math.random() < dt * .35) S.twitch = 1;
  const spd = Math.abs(S.vf), stride = lerp(46, 92, sm(40, 260, spd));
  S.ph += Math.sign(S.vf || 1) * spd * dt / stride * TAU * .5;
  S.spd = spd;
}
function limb(g, ax, ay, tx, ty, l1, l2, side, w1, w2, col) {
  const j = ik(ax, ay, tx, ty, l1, l2, side);
  g.moveTo(ax, ay).lineTo(j.ex, j.ey).stroke({ color: SC.line, width: w1 + 2.4, cap: 'round' });
  g.moveTo(j.ex, j.ey).lineTo(j.tx, j.ty).stroke({ color: SC.line, width: w2 + 2.4, cap: 'round' });
  g.moveTo(ax, ay).lineTo(j.ex, j.ey).stroke({ color: col, width: w1, cap: 'round' });
  g.moveTo(j.ex, j.ey).lineTo(j.tx, j.ty).stroke({ color: col, width: w2, cap: 'round' });
  return j;
}
function hand(g, j, curl) {                                  // a narrow palm and three long fingers, along the forearm
  const a = Math.atan2(j.ty - j.ey, j.tx - j.ex);
  for (let f = -1; f <= 1; f++) {
    const fa = a + f * .32 + curl * f * .2, L = 9.5 - Math.abs(f) * 1.6 - curl * 3;
    g.moveTo(j.tx, j.ty).lineTo(j.tx + Math.cos(fa) * L, j.ty + Math.sin(fa) * L).stroke({ color: SC.line, width: 2.4, cap: 'round' });
    g.moveTo(j.tx, j.ty).lineTo(j.tx + Math.cos(fa) * (L - .8), j.ty + Math.sin(fa) * (L - .8)).stroke({ color: SC.skinHi, width: 1.1, cap: 'round' });
  }
  g.circle(j.tx, j.ty, 3.4).fill(SC.skin).stroke({ color: SC.line, width: 1.3 });
}
function paint(v, o, t) {
  const g = v.__g, S = v.__s, cr = S.crouch, lean = S.lean, reach = S.reach, back = S.back, spd = S.spd || 0;
  g.clear();
  const walk = sm(8, 60, spd), sw = Math.sin(S.ph), sw2 = Math.sin(S.ph + Math.PI);
  const tall = 1 + lean * .12 - cr * .1;                     // a pounce stretches the body, a crouch shortens it
  // legs (half under the body): hips to feet, a long stride when it runs
  for (const side of [-1, 1]) {
    const ph = side < 0 ? sw : sw2, hx = side * 6.5, hy = 13 * tall, fx = side * (8 + cr * 6), fy = hy + 15 - cr * 4 + ph * walk * lerp(8, 17, sm(60, 255, spd));
    limb(g, hx, hy, fx, fy, 15, 16, side, 4.6, 3.6, SC.skinLo);
  }
  // the torso: bony shoulders, a narrow waist, the spine showing through loose skin
  const sy = -11 * tall - lean * 3, wy = 5 * tall, hy = 15 * tall, shw = 12.5 - cr * 1.2;
  g.poly([-shw, sy, -shw + 3, sy - 4, -4, sy - 6, 4, sy - 6, shw - 3, sy - 4, shw, sy, 9, wy - 4, 7, wy, 8.5, hy - 2, 4, hy + 2, -4, hy + 2, -8.5, hy - 2, -7, wy, -9, wy - 4])
    .fill(SC.skin).stroke({ color: SC.line, width: 2.2 });
  g.poly([-shw + 2, sy + 1, -8, wy - 3, -6, hy - 3, -2, hy, -3, sy - 3]).fill({ color: SC.skinLo, alpha: .55 });
  for (let i = 0; i < 6; i++) { const y = lerp(sy - 2, hy - 2, i / 5); g.ellipse(0, y, 1.9, 1.4).fill(SC.skinHi); }
  for (const side of [-1, 1]) {                              // folds of skin that does not quite fit
    g.moveTo(side * 3, sy + 4).quadraticCurveTo(side * 10, sy + 9, side * 7, wy - 1).stroke({ color: SC.fold, width: 1.3, alpha: .9 });
    g.moveTo(side * 2.5, wy + 1).quadraticCurveTo(side * 7, wy + 5, side * 4, hy - 3).stroke({ color: SC.fold, width: 1.1, alpha: .75 });
    g.ellipse(side * (shw - 5), sy + 1, 4.5, 3).fill({ color: SC.skinHi, alpha: .55 });   // shoulder blades
  }
  // arms: very long.  Seen from above an arm that hangs is foreshortened (it points at the floor): drawn short and close along the body,
  // the long fingers past the hips; it swings a little when it walks, reaches out when it hunts, draws back and wide for a pounce
  const fore = lerp(.6, 1, Math.max(reach, back * .85, walk * .12));
  for (const side of [-1, 1]) {
    const ph = side < 0 ? sw2 : sw, ax = side * (shw - 1.5), ay = sy + 2;
    const hangX = side * (shw + 3.5 + cr * 2), hangY = hy - 1 + ph * walk * 7;
    const reachX = side * (6 + (1 - reach) * 6), reachY = sy - 30 - reach * 12 + ph * walk * (1 - reach) * 6;
    const backX = side * 23, backY = hy + 3;
    let tx = lerp(hangX, reachX, reach), ty = lerp(hangY, reachY, reach);
    tx = lerp(tx, backX, back); ty = lerp(ty, backY, back);
    if (S.twitch > 0 && side > 0) { tx += Math.sin(t * 40 + S.seed) * 1.5 * S.twitch; ty += Math.cos(t * 33) * 1.2 * S.twitch; }
    const j = limb(g, ax, ay, tx, ty, 20 * fore, 23 * fore, side, 4.4, 3.4, SC.skin);
    hand(g, j, reach > .5 ? .2 : .5 - back * .3);
  }
  // the head: small for the body, held too far forward on a long thin neck, the crown and a few dark strands; the jaw a dark line at
  // its front edge
  const hx = Math.sin(S.tilt) * 4.5, hyy = sy - 12 - lean * 5 + cr * 3;
  g.moveTo(0, sy - 3).lineTo(hx * .8, hyy + 5).stroke({ color: SC.line, width: 6, cap: 'round' });
  g.moveTo(0, sy - 3).lineTo(hx * .8, hyy + 5).stroke({ color: SC.skinLo, width: 3.6, cap: 'round' });
  g.ellipse(hx, hyy, 6.2, 7.4).fill(SC.skin).stroke({ color: SC.line, width: 2 });
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .42 + S.tilt * .5; g.moveTo(hx, hyy + 1).lineTo(hx + Math.cos(a) * 6.5, hyy + 1 + Math.sin(a) * 6.5).stroke({ color: SC.hair, width: .9, alpha: .7 }); }
  g.moveTo(hx - 3.6 + S.tilt * 2, hyy - 5.6).quadraticCurveTo(hx + S.tilt * 3, hyy - 7.4, hx + 3.6 + S.tilt * 2, hyy - 5.6).stroke({ color: SC.mouth, width: 1.5 });
}
/* once a frame (mp.js's N.A.N.I. module calls it after the mirror): every view placed, posed, shaded by the light where it stands */
function draw(dt) {
  dt = clamp(+dt || .016, .001, .1);
  const A = API(); if (!A || !classes()) return;
  const now = performance.now() / 1000, flash = !!(A.lightOn && A.lightOn()), L = window.__light, H = A.H, seen = new Set();
  for (const o of list()) {
    seen.add(o.id);
    const v = views.get(o.id) || make(o.id), S = v.__s;
    const far = H && Math.hypot(o.x - H.x, o.y - H.y) > 1600;    // off any screen: not drawn (nothing of it shows, nothing is spent)
    v.visible = !far; if (far) { S.px = null; continue; }
    pose(S, o, now, dt);
    v.position.set(o.x, o.y); v.rotation = o.angle + Math.PI / 2; v.alpha = 1;
    if (L) { const s = L.sample(o.x, o.y, flash, v.__lt || (v.__lt = L.mk())), shade = L.shade(s.total); v.__shade = v.__shade === undefined ? shade : v.__shade + (shade - v.__shade) * (1 - Math.exp(-dt * 8)); const c = Math.round(v.__shade * 255); v.tint = c << 16 | c << 8 | c; }
    paint(v, o, now);
  }
  for (const [id, v] of views) if (!seen.has(id)) { views.delete(id); try { v.parent && v.parent.removeChild(v); v.destroy({ children: true }); } catch (e) { } }
}
/* a new world, a closed connection: no view and no record stays behind */
function reset() { clear(); for (const v of views.values()) { try { v.parent && v.parent.removeChild(v); v.destroy({ children: true }); } catch (e) { } } views.clear(); }
K.draw = draw;
K.clear = reset;
}
/* (Trial 3) the modules, in the order of the parts */
const head = skinHead();
const mirror = skinMirror({ head });
skinBody({ head, mirror });
})();
