/** @part public/assets/skinstealer.js - BR-R: the Skin-Stealer in a death: the attacker our own death and every replay ask for, posed from the death's own physics; and the mirrored one hidden while its kill plays; a module: skinKill
 * Trial 3 (T4).  Our own death: the bundle calls ents.js's attackSmiler for every killer that is not the Hound, with the death; ents.js
 * hands a Skin-Stealer's to attack() here, which hides the view the bundle gave it (the Hound's) and draws this script's own attacker
 * where the death's physics has it (dphys.js: death.attacker), posed from the death's variant and time.  A replay: G.I.B.'s mp.js module
 * asks attacker() for its view and poses it every frame through attackPose (the Hound's view has the same method), so that loop is as it
 * was.  The real Skin-Stealer stays committed on its kill on the server until the death is over; its mirrored view is hidden while a death
 * it is making plays here (the death's source within 260 px of it), so one creature is never drawn twice.  Nothing here decides anything.
 * (R14) The attacker's body is the living one's (skin.body.js's skeleton): its hands go where the victim's neck is - ahead of it by the
 * bodies' real distance in the death's physics, at the height the victim's neck is at that moment, standing, falling, on the floor.
 * imports: head { API BODY_SCALE clamp K lend lerp sm }, body { classes newView paint shadeView }
 * exports: -
 * provides: skinKill
 * uses: -
 * writes: -
 */
function skinKill({ head: { API, BODY_SCALE, clamp, K, lend, lerp, sm }, body: { classes, newView, paint, shadeView } }) {
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
  // (R14) where its hands are: at the victim's neck - ahead of it as far as the victim's body really is (the death's physics: body and
  // attacker), as high as the neck is now (standing, then going down: B knocks them down at once, A drops them at the snap, C's legs go)
  const at = jl.attacker, b = jl.body;
  let gd = 30; if (at && b && Number.isFinite(b.x) && Number.isFinite(at.x)) gd = clamp(((b.x - at.x) * Math.cos(at.angle) + (b.y - at.y) * Math.sin(at.angle)) / BODY_SCALE, 12, 58);
  const col = c.collapse || [.95, .8], down = v === 'B' ? sm(.05, .35, t) : v === 'C' ? sm(col[0], col[0] + col[1], t) : sm(snap, snap + .6, t);
  S.gripD = gd; S.gripZ = lerp(v === 'B' ? 58 : 86, 14, down); S.gripW = v === 'C' ? 8 : 5;
  S.headDown = v === 'C' ? .9 : lerp(.1, .7, Math.max(down, done)); S.air = v === 'B' ? 1 - sm(0, .1, t) : 0;
  S.floor = 0; S.coil = 0; S.brake = 0; S.bite = v === 'C' ? clamp(imp, 0, 1) : 0;
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
