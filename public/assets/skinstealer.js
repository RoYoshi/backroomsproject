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
/* the script's public object: each module adds its own entries (mirror: the snapshot's list, and (T6) where an entity is drawn for chat.js;
 * body: draw, clear; kill: the attacker in a death; audio: a death's sounds) */
const K = window.__skin = {};
/* what a later module lends an earlier one, inside the script only (never on the page): kill's test of a creature whose kill is playing */
const hooks = { hidden: null, frame: null, audio: null };
const lend = (name, fn) => { if (name in hooks) hooks[name] = fn; };
/* the codes as the server sends them: the shared states (ai.head.js S, numbered SCODE) and the Skin-Stealer's acts (ai.skinstealer.js
 * KACT); dev/tools/checks/facts.json holds every copy of each to the same list */
const STATES = ['DORMANT', 'ROAMING', 'CURIOUS', 'ALERT', 'WATCHING', 'STALKING', 'HUNTING', 'SEARCHING', 'CAUTIOUS', 'FRUSTRATED', 'EXCITED', 'FEEDING', 'PLAYING', 'RETREATING', 'HIDDEN', 'FOLLOWING', 'PROVOKED', 'ATTACKING', 'DISAPPEARING'];
const ACTS = ['', 'watch', 'back', 'leave', 'wait', 'lure', 'intercept', 'search', 'listen', 'approach', 'creep', 'chase', 'wind', 'pounce', 'recover', 'feed', 'mimic', 'rest', 'pace'];
return { ACTS, angDiff, API, clamp, hooks, K, lend, lerp, sm, STATES, TAU };
}
function skinMirror({ head: { ACTS, angDiff, K, STATES } }) {
const MAX = 8, LOOK = /^[a-z]{1,12}\|[a-z]{1,12}\|#[0-9a-fA-F]{6}\|#[0-9a-fA-F]{6}$/;
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
    o.dg = typeof t.dg === 'string' && LOOK.test(t.dg) ? t.dg : null;                       // (T6) the skin it wears: a wanderer's look, checked
  }
  for (const id of [...slots.keys()]) if (!seen.has(id)) slots.delete(id);
}
const clear = () => { slots.clear(); };
const list = () => [...slots.values()];
K.mirror = mirror;
K.where = id => { const o = slots.get(id); return o ? { x: o.x, y: o.y } : null; };   // (T6) where this page draws entity id (chat.js: its line's bubble and voice)
return { clear, list };
}
function skinBody({ head: { API, clamp, hooks, K, lerp, sm, TAU }, mirror: { clear, list } }) {
const SC = { line: 0x14100d, skin: 0xbcab9a, skinLo: 0x7f6c5e, skinHi: 0xdfd1bf, fold: 0x8f7b6b, nail: 0x2a2320, hair: 0x15120f, mouth: 0x2a0d0e };   // (T5) sallow, bloodless human skin: pale under a lamp, black in the dark
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
/* a view (a Container holding one Graphics) with its pose state; (Trial 3 T4) the kill module makes its attackers with it too */
function newView(label) {
  const v = new Cc(), g = new Gc();
  v.addChild(g); v.__g = g; v.__skin = true; v.label = label;
  v.__s = { ph: Math.random() * TAU, px: null, py: null, vf: 0, crouch: 0, reach: 0, back: 0, lean: 0, tilt: 0, tiltT: 0, tiltTo: 0, twitch: 0, seed: Math.random() * 100, spd: 0 };
  return v;
}
function make(id) {
  const v = newView('skinstealer#' + id); v.__id = id;
  API().layer().addChild(v); views.set(id, v); return v;
}
/* the pose from what the server says it is doing (its act and state, its speed), eased so it never pops */
function pose(S, o, t, dt) {
  if (S.px === null || Math.hypot(o.x - S.px, o.y - S.py) > 220) { S.px = o.x; S.py = o.y; }
  const vx = (o.x - S.px) / dt, vy = (o.y - S.py) / dt; S.px = o.x; S.py = o.y;
  const k = 1 - Math.exp(-dt * 9), fwd = vx * Math.cos(o.angle) + vy * Math.sin(o.angle); S.vx = vx; S.vy = vy;
  S.vf += (fwd - S.vf) * k;
  const a = o.act, still = a === 'watch' || a === 'wait' || a === 'lure' || a === 'listen' || a === 'mimic' || a === 'rest';
  // (predator refinement R4) a few tells, each from the act the server sends: listening it holds still, half crouched; lying in wait it is
  // low and coiled; searching it prowls, low; closing in it leans forward; running to cut somebody off it leans into the run
  const want = {
    crouch: a === 'wind' ? 1 : a === 'wait' ? .75 : a === 'creep' || a === 'approach' ? .6 : a === 'feed' ? .85 : a === 'listen' ? .45 : a === 'search' ? .35 : a === 'chase' ? .4 : still ? .3 : .12,
    reach: a === 'pounce' ? 1 : a === 'chase' ? .55 : a === 'feed' ? .7 : a === 'approach' || a === 'creep' ? .25 : a === 'search' ? .12 : 0,
    back: a === 'wind' ? 1 : a === 'recover' ? .5 : 0,
    lean: a === 'pounce' ? 1 : a === 'chase' ? .6 : a === 'feed' ? .8 : a === 'creep' ? .35 : a === 'approach' ? .25 : a === 'intercept' ? .4 : a === 'search' ? .15 : 0,
  };
  const e = 1 - Math.exp(-dt * (a === 'wind' || a === 'pounce' ? 18 : 6));
  for (const n in want) S[n] += (want[n] - S[n]) * e;
  // the head: (R4) listening or lying in wait it turns its head exactly as the server says - its listening, nothing invented; other still
  // figures tilt it, slowly, too far (the T5 tell, cosmetic); otherwise it follows where the server says it looks
  const hearing = a === 'listen' || a === 'wait';
  S.tiltT -= dt; if (S.tiltT <= 0) { S.tiltT = 1.5 + Math.random() * 3; S.tiltTo = still && !hearing ? (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .5) : 0; }
  S.tilt += (S.tiltTo + clamp(o.head || 0, -1, 1) * (hearing ? 1 : .6) - S.tilt) * (1 - Math.exp(-dt * (hearing ? 4 : still ? 1.3 : 5)));
  S.twitch = Math.max(0, S.twitch - dt * 3); if (still && !hearing && Math.random() < dt * .35) S.twitch = 1;   // (it holds its breath when it listens)
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
    limb(g, hx, hy, fx, fy, 15, 16, side, 5.4, 4, SC.skinLo);
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
    const j = limb(g, ax, ay, tx, ty, 20 * fore, 23 * fore, side, 5, 3.8, SC.skin);
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
/* (T6) a borrowed skin: the page's own wanderer avatar (__api.mkAvatar, as another player is drawn), in the look the server sends, under
 * the same sight mask and darkness (the creatures layer), cast by BR-RoLE as a wanderer is - with its tells: nothing in its hands and no
 * light, no name (it is no player: no hover label, in no list), its arms held stiff at its sides, its walk a little slow (the server's
 * pace), its long stares.  It goes the moment the server stops sending the look (its wind-up, a run, its time up). */
function skinView(v, o, t) {
  const A = API(), W = window.__mpLib && window.__mpLib.wire; if (!A || !A.mkAvatar || !W || !W.parseLook) return null;
  if (!v.__av || v.__dg !== o.dg) { dropSkin(v); v.__av = A.mkAvatar(W.parseLook(o.dg), { kind: 'flashlight', color: '#ffe7b2', parts: {} }); v.__av.label = 'skinstealer-skin#' + o.id; v.__dg = o.dg; A.layer().addChild(v.__av); }
  const av = v.__av, S = v.__s, sp = Math.hypot(S.vx || 0, S.vy || 0);
  av.update(t, false, false, { x: o.x, y: o.y, angle: o.angle, vx: S.vx || 0, vy: S.vy || 0, distance: o.distance, mv: [sp > 20 ? 1 : 0, Math.round(sp), 100, 0] });
  if (av.gear) av.gear.visible = false;                                         // nothing in its hands
  if (Array.isArray(av.hands)) av.hands.forEach((h, i) => { h.x = i === 0 ? -16 : 16; h.y = -2; });   // arms stiff at its sides
  av.visible = true; av.alpha = 1;
  return av;
}
function dropSkin(v) { const av = v.__av; v.__av = null; v.__dg = null; if (av) { try { av.parent && av.parent.removeChild(av); av.destroy({ children: true }); } catch (e) { } } }
/* shaded by the light where it stands (BR-RoLE's sample, eased), as the Hound's view is; no light of its own */
function shadeView(v, x, y, flash, dt) {
  const L = window.__light; if (!L) return;
  const s = L.sample(x, y, flash, v.__lt || (v.__lt = L.mk())), shade = L.shade(s.total);
  v.__shade = v.__shade === undefined ? shade : v.__shade + (shade - v.__shade) * (1 - Math.exp(-dt * 8));
  const c = Math.round(v.__shade * 255); v.tint = c << 16 | c << 8 | c;
}
/* once a frame (mp.js's N.A.N.I. module calls it after the mirror): every view placed, posed, shaded by the light where it stands */
function draw(dt) {
  dt = clamp(+dt || .016, .001, .1);
  const A = API(); if (!A || !classes()) return;
  const now = performance.now() / 1000, flash = !!(A.lightOn && A.lightOn()), H = A.H, seen = new Set();
  for (const o of list()) {
    seen.add(o.id);
    const v = views.get(o.id) || make(o.id), S = v.__s;
    const far = H && Math.hypot(o.x - H.x, o.y - H.y) > 1600;    // off any screen: not drawn (nothing of it shows, nothing is spent)
    v.visible = !far; if (far) { S.px = null; if (v.__av) v.__av.visible = false; continue; }
    if (hooks.hidden && hooks.hidden(o)) { v.visible = false; S.px = null; if (v.__av) v.__av.visible = false; continue; }   // its kill is playing: the death's own attacker is drawn instead
    pose(S, o, now, dt);
    if (o.dg && skinView(v, o, now)) { v.visible = false; continue; }   // (T6) in a borrowed skin: the wanderer is drawn instead
    if (v.__av) dropSkin(v);
    v.position.set(o.x, o.y); v.rotation = o.angle + Math.PI / 2; v.alpha = 1;
    shadeView(v, o.x, o.y, flash, dt);
    paint(v, o, now);
  }
  for (const [id, v] of views) if (!seen.has(id)) { views.delete(id); dropSkin(v); try { v.parent && v.parent.removeChild(v); v.destroy({ children: true }); } catch (e) { } }
  if (hooks.frame) hooks.frame(dt);
  if (hooks.audio) hooks.audio(dt, list());                  // (T5) its living sounds, from what the mirror says it is doing
}
/* a new world, a closed connection: no view and no record stays behind */
function reset() { clear(); for (const v of views.values()) { dropSkin(v); try { v.parent && v.parent.removeChild(v); v.destroy({ children: true }); } catch (e) { } } views.clear(); }
K.draw = draw;
K.clear = reset;
return { classes, newView, paint, shadeView };
}
function skinKill({ head: { API, clamp, K, lend, lerp, sm }, body: { classes, newView, paint, shadeView } }) {
const CFG = () => (window.__dphys && window.__dphys.CFG && window.__dphys.CFG.SkinStealer) || {};
/* the pose at time t of a death: its variant, and its physics (the snap, the blows' impact) */
function killPose(S, jl, t) {
  const v = jl.variant || 'A', c = CFG()[v] || {}, ph = jl.ph, snap = ph && ph.snapped !== undefined ? ph.snapped : c.snap != null ? c.snap : 99;
  const done = c.back ? sm(c.back[0], c.back[1], t) : 0, imp = clamp(+jl.impact || 0, 0, 1.5);
  let crouch, reach, lean, tilt = 0;
  if (v === 'B') {                                    // the leap carries it in, it pins them down, then the neck
    const land = sm(.05, .3, t); crouch = lerp(.15, .9, land); reach = 1; lean = lerp(1, .8, land);
  } else if (v === 'C') {                             // held from close, bent to the neck; the head jerks at each bite
    crouch = lerp(.5, .95, sm(.1, .5, t)); reach = lerp(.6, .85, sm(0, .3, t)); lean = .9 - imp * .15; tilt = imp * .5;
  } else {                                            // A: a grip from close by, then the neck
    crouch = lerp(.3, .6, sm(.05, .4, t)); reach = sm(0, .14, t); lean = lerp(.3, .6, sm(.05, .4, t));
  }
  if (t >= snap) { const k = Math.exp(-(t - snap) * 7); tilt += (S.seed % 2 < 1 ? 1 : -1) * .7 * k; S.twitch = Math.max(S.twitch, k); }   // the twist
  S.crouch = lerp(crouch, .85, done); S.reach = lerp(reach, .45, done); S.lean = lerp(lean, .75, done);   // done: it eases off, bent over the body
  S.back = 0; S.tilt = tilt; S.spd = 0; S.twitch = Math.max(0, S.twitch - .03);
}
/* our own death's attacker (the bundle gives the Hound's view: it is hidden; this one is drawn in the same creatures layer) */
let own = null;
function attack(view, t, dt, death) {
  if (view) view.alpha = 0;
  const A = API(); if (!A || !death || !death.attacker || !classes()) return;
  if (!own || own.destroyed) own = newView('skinstealer-kill');
  const layer = A.layer(); if (layer && own.parent !== layer) layer.addChild(own);
  own.visible = true; own.alpha = 1; own.position.set(death.attacker.x, death.attacker.y); own.rotation = death.attacker.angle + Math.PI / 2;
  killPose(own.__s, death, +death.elapsed || 0);
  shadeView(own, death.attacker.x, death.attacker.y, !!(A.lightOn && A.lightOn()), clamp(+dt || .016, .001, .1)); paint(own, null, t);
}
/* a replay's attacker: G.I.B.'s module adds it to the layer, places it and calls attackPose every frame */
function attacker() {
  const A = API(), v = classes() ? newView('skinstealer-replay') : new (A.layer().constructor)();
  v.attackPose = (grip, impact, variant, jl) => {
    if (!v.__s) return;
    killPose(v.__s, jl, +jl.elapsed || 0);
    shadeView(v, jl.attacker.x, jl.attacker.y, !!(API() && API().lightOn && API().lightOn()), 1 / 60); paint(v, null, performance.now() / 1000);
  };
  return v;
}
/* the mirrored Skin-Stealer whose kill is playing here (ours, or a replay's): the death draws it instead */
const near = (o, p) => !!p && Math.hypot(o.x - p.x, o.y - p.y) < 260;
lend('hidden', o => {
  const A = API(), D = A && A.death && A.death();
  if (D && D.active && D.kind === 'SkinStealer' && near(o, D.source)) return true;
  for (const f of window.__fxs || []) if (!f.gone && f.cause === 'SkinStealer' && f.jl && !f.jl.finished && near(o, f.jl.source)) return true;
  return false;
});
/* our own death over (or not a Skin-Stealer's): its attacker is put away */
lend('frame', () => { if (!own) return; const A = API(), D = A && A.death && A.death(); if (!(D && D.active && D.kind === 'SkinStealer')) own.visible = false; });
K.attack = attack;
K.attacker = attacker;
}
function skinAudio({ head: { API, clamp, K, lend } }) {
let ctx = null, out = null, nb = null;
function Z() {
  const A = API(), z = A && A.audio && A.audio(); if (!z || !z.context || !z.gain) return null;
  if (ctx !== z.context) { ctx = z.context; out = z.gain; nb = null; }
  if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); let x = 0x5bd1e995; for (let i = 0; i < d.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = ((x >>> 0) / 4294967296) * 2 - 1; } }   // (T8: its own fixed noise: the page's Math.random is never drawn on)
  return z;
}
const soundOn = () => !(document.getElementById('sound') && /OFF/.test(document.getElementById('sound').textContent));
/* one bus per sound: level, a low-pass (a wall between), pan; disconnected when it has played */
function bus(gain, pan, lp, len) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  g.gain.value = gain; f.type = 'lowpass'; f.frequency.value = lp || 12000; g.connect(f); if (p) { p.pan.value = clamp(pan || 0, -1, 1); f.connect(p); p.connect(out); } else f.connect(out);
  setTimeout(() => { try { g.disconnect(); f.disconnect(); p && p.disconnect(); } catch (e) { } }, (len + .6) * 1000);
  return g;
}
function noise(dst, at, dur, type, f0, f1, q, vol, atk) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = ctx.currentTime + at;
  s.buffer = nb; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f0, t0); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur); fl.Q.value = q;
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (atk || .004)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(dst); s.start(t0, Math.random() * .5); s.stop(t0 + dur + .05);
}
function tone(dst, at, dur, type, f0, f1, vol, atk) {
  const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (atk || .004)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(dst); o.start(t0); o.stop(t0 + dur + .05);
}
/* which of its deaths: ours from the death itself; a spectator's from its blows' times (dphys.js PLAN) */
function variantOf(O) {
  const A = API(), D = A && A.death && A.death();
  if (!O && D && D.active && D.kind === 'SkinStealer') return D.variant || 'A';
  const P = window.__dphys && window.__dphys.PLAN, h = O && O.hits;
  if (P && Array.isArray(h)) for (const v of ['A', 'B', 'C']) { const q = P('SkinStealer', v, 40).hits; if (q && q.length === h.length && q.every((x, i) => Math.abs(x - h[i]) < 1e-6)) return v; }
  return 'A';
}
function deathSound(O) {
  if (!soundOn()) return true;                                  // (silence is its sound when the sound is off: nothing else plays)
  if (!Z()) return false;
  const v = variantOf(O), b = bus(O && O.gain != null ? O.gain : 1, O && O.pan || 0, O && O.lp || 12000, 3.6), P = window.__dphys && window.__dphys.PLAN, hits = (O && O.hits) || (P ? P('SkinStealer', v, 40).hits : [.58]);
  if (v === 'B') { tone(b, .12, .22, 'sine', 78, 38, .85, .005); noise(b, .12, .28, 'lowpass', 900, 220, .7, .55, .004); noise(b, .16, .4, 'bandpass', 1600, 700, 1.2, .12, .02); }   // the landing: a body hits the floor
  else { noise(b, .06, .16, 'bandpass', 2200, 1400, 1.4, .22, .006); noise(b, .1, .05, 'highpass', 3000, 0, .7, .18, .002); }                                      // the grab: cloth, skin
  noise(b, .2, .32, 'bandpass', 950, 650, 1.1, .2, .03); noise(b, .55, .2, 'bandpass', 800, 500, 1.3, .1, .02);                                                    // their breath, cut short
  if (v === 'C') for (const t of hits) { noise(b, t, .18, 'bandpass', 700, 260, 1.6, .5, .003); noise(b, t + .02, .1, 'highpass', 2600, 0, .8, .14, .002); tone(b, t, .1, 'sine', 120, 70, .25, .003); }   // the bites: wet, deep
  noise(b, 1.5, .9, 'lowpass', 340, 160, .6, .12, .25);                                                                                                            // its own slow breath out
  return true;
}
/* the snap itself, where the physics says it happened (ents.js's place: distance, pan, a wall between) */
function deathEvent(q, jl, S, place) {
  if (!q || q.k !== 'snap' || !soundOn() || !Z()) return;
  const p = place ? place(q.x, q.y, 140, 1400) : { g: 1, pan: 0, lp: 12000 }; if (p.g < .02) return;
  const b = bus(p.g, p.pan, p.lp, .4);
  noise(b, 0, .025, 'highpass', 3600, 0, .8, .95, .001); noise(b, .004, .07, 'bandpass', 1300, 800, 2.2, .5, .002); tone(b, 0, .09, 'sine', 150, 60, .45, .002);
}
/* where a sound at (x, y) lands for this listener: distance falloff, pan, a low-pass through a wall (as ents.js places the others) */
function place(x, y, near, far) {
  const A = API(), H = A && A.H; if (!H) return { g: 0, pan: 0, lp: 9000, d: 1e9 };
  const dx = x - H.x, dy = y - H.y, d = Math.hypot(dx, dy), k = clamp((d - near) / (far - near), 0, 1), s = k * k * (3 - 2 * k);
  let g = Math.pow(1 - s, 1.5), lp = 9000;
  if (d > 60 && A.Uc) { const r = A.Uc(H.x, H.y, Math.atan2(dy, dx), d + 1); if (r < d - 30) { g *= .5; lp = 700; } }
  return { d, g, pan: clamp(dx / 520, -1, 1) * .85, lp };
}
/* its sounds while it lives, from what the server says it is doing (act, the ground it covers): never a radar - it is heard when it
 * moves, when it springs, when it eats, and (rarely, close) when it stands still and breathes */
const VO = new Map();                                        // entity id -> { dist, acc, act, br, fd }
function voice(dt, list) {
  if (!list.length) { if (VO.size) VO.clear(); return; }      // (T8) no Skin-Stealer: nothing at all is done (the page's audio and its random stream untouched)
  if (!soundOn() || !Z()) return;
  const seen = new Set();
  for (const o of list) {
    seen.add(o.id);
    let s = VO.get(o.id); if (!s) { s = { dist: o.distance, acc: 0, act: o.act, br: 20 + Math.random() * 20, fd: .5 }; VO.set(o.id, s); }
    const dd = Math.abs(o.distance - s.dist) > 300 ? 0 : o.distance - s.dist; s.dist = o.distance;
    const sp = dd / Math.max(dt, .001), stride = sp > 220 ? 150 : sp > 120 ? 118 : 96;
    // footfalls: a long, padded, bare step - each half stride, heard whether or not it can be seen; placed with care when it stalks
    // (creep, approach): quieter and heard less far, never silent
    const soft = o.act === 'creep' || o.act === 'approach' || !!o.dg;                // (T6: and in a borrowed skin)
    s.acc += dd; while (s.acc >= stride / 2) { s.acc -= stride / 2; if (sp > 25) step(o.x, o.y, sp, soft); }
    if (o.act !== s.act) {
      if (o.act === 'wind') cue(o.x, o.y, 'wind');           // the tell: a dry click in the throat, a sharp breath in
      else if (o.act === 'pounce') cue(o.x, o.y, 'leap');
      else if (o.act === 'recover') cue(o.x, o.y, 'skid');
      s.act = o.act;
    }
    if (o.act === 'feed' && (s.fd -= dt) <= 0) { s.fd = .8 + Math.random() * .7; cue(o.x, o.y, 'feed'); }
    const still = o.act === 'watch' || o.act === 'lure' || o.act === 'wait' || o.act === 'listen';
    s.br -= dt; if (s.br <= 0) { s.br = 25 + Math.random() * 20; if (still) cue(o.x, o.y, 'breath'); }   // at most every 25-45 s, and only close (place: 260 px)
  }
  for (const id of [...VO.keys()]) if (!seen.has(id)) VO.delete(id);
}
function step(x, y, sp, soft) {
  const p = place(x, y, soft ? 80 : 120, soft ? 520 : 950); if (p.g < .02) return;
  const run = clamp((sp - 120) / 150, 0, 1), b = bus(p.g * (.22 + .25 * run) * (soft ? .45 : 1), p.pan, p.lp, .2);
  noise(b, 0, .07 + .03 * run, 'lowpass', 300 + 150 * run, 140, .8, .7, .004); noise(b, .01, .03, 'bandpass', 1800, 1200, 1.4, .12, .002);
}
function cue(x, y, k) {
  const far = { wind: 700, leap: 800, skid: 700, feed: 520, breath: 260 }[k], p = place(x, y, 90, far); if (p.g < .02) return;
  if (k === 'wind') { const b = bus(p.g * .7, p.pan, p.lp, .4); for (let i = 0; i < 3; i++) noise(b, i * .045, .018, 'bandpass', 2600 - i * 200, 0, 6, .55, .001); noise(b, .1, .16, 'bandpass', 1400, 2600, 1.2, .25, .03); }
  else if (k === 'leap') { const b = bus(p.g * .6, p.pan, p.lp, .5); noise(b, 0, .3, 'bandpass', 600, 1800, .9, .35, .02); }
  else if (k === 'skid') { const b = bus(p.g * .5, p.pan, p.lp, .6); noise(b, 0, .45, 'bandpass', 900, 400, 1.6, .3, .02); }
  else if (k === 'feed') { const b = bus(p.g * .4, p.pan, p.lp, .4); noise(b, 0, .16, 'bandpass', 650, 300, 1.8, .45, .01); noise(b, .05, .06, 'highpass', 2400, 0, .9, .1, .003); }
  else if (k === 'breath') { const b = bus(p.g * .35, p.pan, p.lp, 1.6); noise(b, 0, .7, 'bandpass', 500, 350, 1.1, .2, .3); noise(b, .8, .8, 'bandpass', 420, 300, 1.1, .16, .35); }
}
lend('audio', voice);
K.deathSound = deathSound;
K.deathEvent = deathEvent;
}
/* (Trial 3) the modules, in the order of the parts */
const head = skinHead();
const mirror = skinMirror({ head });
const body = skinBody({ head, mirror });
skinKill({ head, body });
skinAudio({ head });
})();
