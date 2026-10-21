/** @part public/assets/skinstealer.js - BR-R: the Skin-Stealer drawn (a tall, thin, wrong figure, procedural and articulated); a module: skinBody
 * One view per mirrored Skin-Stealer, made with the page's own PixiJS classes (taken from objects the bundle gives, as BR-R's Level 0
 * remaster does: the creatures layer's Container, a Graphics of the death scene) and added to the creatures layer, so the sight mask
 * and the darkness hide it exactly as they hide the Hound.  It is shaded by the light where it stands (BR-RoLE's window.__light, as the
 * Hound's view is) and carries no light of its own.  Local space: forward is -y, +x is its right (the Hound's convention).
 * Interim art (Trial 3): restrained and reproducible, for the owner's QA; no supplied portrait or asset exists.
 * imports: head { API BODY_SCALE clamp hooks K lerp sm TAU }, mirror { clear list }
 * exports: classes, newView, paint, shadeView
 * provides: skinBody
 * uses: -
 * writes: -
 */
function skinBody({ head: { API, BODY_SCALE, clamp, hooks, K, lerp, sm, TAU }, mirror: { clear, list } }) {
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
/* a view (a Container holding one Graphics) with its pose state; (Trial 3 T4) the kill module makes its attackers with it too; (R5) every
 * view of the undisguised body - living, our own death's attacker, a replay's - is drawn at the one BODY_SCALE */
function newView(label) {
  const v = new Cc(), g = new Gc();
  v.addChild(g); v.__g = g; v.__skin = true; v.label = label; v.scale.set(BODY_SCALE);
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
    reach: a === 'pounce' ? 1 : a === 'chase' ? .4 : a === 'feed' ? .7 : a === 'approach' || a === 'creep' ? .12 : a === 'search' ? .06 : 0,   // (R5: arms kept low until the strike - no raised-arms figure)
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
  // legs (half under the body): hips to feet, a long stride when it runs.  (R5) Seen from above a standing leg is foreshortened: shorter,
  // the feet under the hips, so the knees no longer splay out to the sides (the squatting, frog-like outline)
  for (const side of [-1, 1]) {
    const ph = side < 0 ? sw : sw2, hx = side * 6.5, hy = 13 * tall, fx = side * (6.5 + cr * 3.5), fy = hy + 13 - cr * 3 + ph * walk * lerp(8, 17, sm(60, 255, spd));
    limb(g, hx, hy, fx, fy, 6.5 + walk * 3, 7 + walk * 3.5, side, 5.4, 4, SC.skinLo);   // (nearly straight when it stands; the stride lengthens them)
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
  const fore = lerp(.6, 1, Math.max(reach, back * .85, walk * .12)) * (1 - .22 * cr * (1 - reach));   // (R5: a crouch folds the arms in with the body, elbows not out)
  for (const side of [-1, 1]) {
    const ph = side < 0 ? sw2 : sw, ax = side * (shw - 1.5), ay = sy + 2;
    const hangX = side * (shw + 1.5 + cr * 1.5), hangY = hy - 1 + ph * walk * 7;   // (R5: hanging close along the body)
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
