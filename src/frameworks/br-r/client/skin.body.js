/** @part public/assets/skinstealer.js - BR-R: the Skin-Stealer drawn (a tall, thin, wrong figure, procedural and articulated); a module: skinBody
 * One view per mirrored Skin-Stealer, made with the page's own PixiJS classes (taken from objects the bundle gives, as BR-R's Level 0
 * remaster does: the creatures layer's Container, a Graphics of the death scene) and added to the creatures layer, so the sight mask
 * and the darkness hide it exactly as they hide the Hound.  It is shaded by the light where it stands (BR-RoLE's window.__light, as the
 * Hound's view is) and carries no light of its own.  Local space: forward is -y, +x is its right (the Hound's convention).
 * (R14) Drawn for the camera the game has - straight down - as a body with height, not a standing figure laid flat on the floor: a
 * skeleton in three dimensions (rig(): hips, a spine that leans, shoulders, a long neck and the skull; arms and legs solved for their
 * joints) seen from above.  Standing it is a wide bony shoulder line and a small skull, its long hands hanging at its sides; the more it
 * leans - prowling, running, springing - the more of its long back shows; its stride is the stride of a figure half again a wanderer's
 * height, and its height shows in that, in its reach and in a short shadow kept under it (never past a wall, never far from its body).
 * What it is doing comes from the server's act, speed and head only (the pose does not invent intent).  Interim art (Trial 3): procedural,
 * reproducible, for the owner's QA - no supplied portrait or asset exists; the owner's reference (a tall pale figure in a doorway) is a
 * mood, not a source.  Every view (living, our own death's attacker, a replay's) is drawn at the one BODY_SCALE.
 * imports: head { API BODY_SCALE clamp hooks K lerp sm TAU }, mirror { clear list }
 * exports: classes, newView, paint, shadeView
 * provides: skinBody
 * uses: -
 * writes: -
 */
function skinBody({ head: { API, BODY_SCALE, clamp, hooks, K, lerp, sm, TAU }, mirror: { clear, list } }) {
const SC = { line: 0x14100d, skin: 0xbcab9a, skinLo: 0x7f6c5e, skinHi: 0xdfd1bf, fold: 0x8f7b6b, nail: 0x2a2320, hair: 0x15120f, mouth: 0x2a0d0e };   // (T5) sallow, bloodless human skin: pale under a lamp, black in the dark
/* (R14) its proportions, in the view's own units (x BODY_SCALE on the floor; a wanderer's body is 36 px across): about 2.4 m to a
 * wanderer's 1.75, shoulders a third wider than a wanderer, a narrow waist, arms whose fingertips hang to its knees */
const AN = { thigh: 40, shin: 41, foot: 12, torso: 46, neck: 16, skW: 6.6, skL: 8.6, shw: 19, hipw: 7.5, upper: 33, fore: 35, finger: 13 };
const SEC = [[0, 8.2, 5.6], [.3, 6, 4.3], [.56, 10, 6.4], [.8, 14.8, 6.4], [1, 18, 4.8]];   // the trunk's sections, hips to shoulders: along, half width, half depth
/* (R14) what each act looks like - the server's act, nothing else: crouch, lean (0 upright .. 1 stretched flat), hands to the floor, coiled,
 * arms drawn back, arms reaching, off the ground, head down */
const POSE = {
  '': [.1, .3, 0, 0, 0, 0, 0, .1], watch: [.12, .28, 0, 0, 0, 0, 0, 0], pace: [.04, .2, 0, 0, 0, 0, 0, 0], back: [.22, .26, 0, 0, 0, 0, 0, 0],
  leave: [.1, .3, 0, 0, 0, 0, 0, .15], listen: [.5, .34, .2, 0, 0, 0, 0, .05], search: [.35, .45, .15, 0, 0, 0, 0, .35], approach: [.5, .5, .35, 0, 0, 0, 0, .2],
  creep: [.62, .56, .7, 0, 0, 0, 0, .15], intercept: [.25, .5, 0, 0, 0, 0, 0, 0], chase: [.3, .62, 0, 0, 0, 0, 0, 0], wait: [.85, .4, .2, 1, 0, 0, 0, .05],
  lure: [.6, .32, .2, .5, 0, 0, 0, .05], wind: [1, .72, 0, .3, 1, 0, 0, 0], pounce: [.25, .8, 0, 0, 0, 1, .6, -.3], recover: [.5, .42, .35, 0, .35, 0, 0, .3],
  feed: [.85, .9, 1, 0, 0, 0, 0, 1], mimic: [.1, .26, 0, 0, 0, 0, 0, 0], rest: [.35, .3, .2, 0, 0, 0, 0, .3],
};
const PK = ['crouch', 'lean', 'floor', 'coil', 'back', 'reach', 'air', 'headDown'];
const views = new Map();                                   // entity id -> view
let Cc = null, Gc = null;                                  // the page's Container and Graphics classes
function classes() {
  if (Cc && Gc) return true;
  const A = API(), layer = A && A.layer && A.layer(), d = A && A.death && A.death();
  if (!layer || !d || !d.blood) return false;
  Cc = layer.constructor; Gc = d.blood.constructor; return true;
}
/* a small seeded generator (its tics and its hair the same on every page that draws it) */
const rnd = S => { let t = (S.rs = (S.rs + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/* (R14) two-bone IK in three dimensions: the joint bends toward the pole */
function ik3(a, t, l1, l2, pole) {
  const dx = t[0] - a[0], dy = t[1] - a[1], dz = t[2] - a[2], d = Math.hypot(dx, dy, dz) || 1, ux = dx / d, uy = dy / d, uz = dz / d;
  const dc = clamp(d, Math.abs(l1 - l2) + 1, l1 + l2 - .5), ca = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - ca * ca));
  let px = pole[0], py = pole[1], pz = pole[2]; const pd = px * ux + py * uy + pz * uz; px -= pd * ux; py -= pd * uy; pz -= pd * uz;
  let pl = Math.hypot(px, py, pz); if (pl < 1e-4) { px = -uy; py = ux; pz = 0; pl = Math.hypot(px, py) || 1; }
  px /= pl; py /= pl; pz /= pl;
  return { e: [a[0] + ux * ca + px * h, a[1] + uy * ca + py * h, a[2] + uz * ca + pz * h], t: [a[0] + ux * dc, a[1] + uy * dc, a[2] + uz * dc] };
}
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/* a view (a Container: its shadow, its body, its head) with its pose state; (Trial 3 T4) the kill module makes its attackers with it too;
 * (R5) every view of the undisguised body is drawn at the one BODY_SCALE */
function newView(label, seed) {
  const v = new Cc(), sh = new Gc(), g = new Gc(), hd = new Gc();
  v.addChild(sh); v.addChild(g); v.addChild(hd); v.__sh = sh; v.__g = g; v.__hd = hd; v.__skin = true; v.label = label; v.scale.set(BODY_SCALE);
  const sd = (seed | 0) * 7919 + 17;
  v.__s = { rs: sd >>> 0, ph: 0, px: null, py: null, vf: 0, vl: 0, spd: 0, sp0: 0, acc: 0, brake: 0, crouch: .1, lean: .2, floor: 0, coil: 0, back: 0, reach: 0, air: 0, headDown: 0,
    tilt: 0, tiltT: 0, tiltTo: 0, twitch: 0, chew: 0, seed: sd % 100 };
  return v;
}
function make(id) {
  const v = newView('skinstealer#' + id, id); v.__id = id;
  API().layer().addChild(v); views.set(id, v); return v;
}
/* the pose from what the server says it is doing (its act, its speed, its head), eased so it never pops */
function pose(S, o, t, dt) {
  if (S.px === null || Math.hypot(o.x - S.px, o.y - S.py) > 220) { S.px = o.x; S.py = o.y; }
  const vx = (o.x - S.px) / dt, vy = (o.y - S.py) / dt; S.px = o.x; S.py = o.y;
  const k = 1 - Math.exp(-dt * 9), ca = Math.cos(o.angle), sa = Math.sin(o.angle), fwd = vx * ca + vy * sa, lat = -vx * sa + vy * ca; S.vx = vx; S.vy = vy;
  S.vf += (fwd - S.vf) * k; S.vl += (lat - S.vl) * k;
  const spd = Math.hypot(S.vf, S.vl), a = o.act, still = a === 'watch' || a === 'wait' || a === 'lure' || a === 'listen' || a === 'mimic' || a === 'rest';
  // (R14) braking: a sharp fall in its speed from a run sits it back on its heels for a moment
  S.acc += ((spd - S.sp0) / dt - S.acc) * (1 - Math.exp(-dt * 12)); S.sp0 = spd;
  const brakeTo = S.acc < -500 && spd < 140 && S.spd > 60 ? sm(500, 1400, -S.acc) : 0;
  S.brake += (brakeTo - S.brake) * (1 - Math.exp(-dt * (brakeTo > S.brake ? 14 : 3)));
  const want = POSE[a] || POSE[''], e = 1 - Math.exp(-dt * (a === 'wind' || a === 'pounce' ? 18 : a === 'recover' ? 9 : 6));
  for (let i = 0; i < PK.length; i++) S[PK[i]] += (want[i] - S[PK[i]]) * e;
  // the head: (R4) listening or lying in wait it turns its head exactly as the server says - its listening, nothing invented; other still
  // figures tilt it, slowly, too far (the T5 tell, cosmetic); otherwise it follows where the server says it looks
  const hearing = a === 'listen' || a === 'wait';
  S.tiltT -= dt; if (S.tiltT <= 0) { S.tiltT = 1.5 + rnd(S) * 3; S.tiltTo = still && !hearing ? (rnd(S) < .5 ? -1 : 1) * (.35 + rnd(S) * .5) : 0; }
  S.tilt += (S.tiltTo + clamp(o.head || 0, -1.2, 1.2) * (hearing ? 1 : .7) - S.tilt) * (1 - Math.exp(-dt * (hearing ? 4 : still ? 1.3 : 5)));
  S.twitch = Math.max(0, S.twitch - dt * 3); if (still && !hearing && rnd(S) < dt * .35) S.twitch = 1;   // (it holds its breath when it listens)
  S.chew = a === 'feed' ? S.chew + dt : 0;
  // the stride: one cycle a long double step, measured on the floor in the view's own units
  const A = lerp(4, 21, sm(15, 255, spd));
  S.ph += spd / BODY_SCALE * dt / (4 * A) * TAU;
  S.spd = spd;
}
/* (R14) the skeleton for a pose, in the view's own space (x right, y back, z up; the floor at z 0, the body's centre over (0, 0)) */
function rig(S, R) {
  R = R || {};
  const cr = S.crouch, spd = S.spd || 0, run = sm(110, 250, spd), walk = sm(6, 50, spd), air = S.air || 0;
  const p = clamp(.14 + S.lean * 1.08 + run * .2 * (1 - air) - S.brake * .35, .02, 1.38), sp = Math.sin(p), cp = Math.cos(p), legL = AN.thigh + AN.shin;
  const hz = lerp(legL * (.96 - .46 * cr) - S.coil * 4, legL * .62, air), hy = AN.torso * sp * .42;   // hips behind its feet, shoulders ahead: its weight over them
  const Hp = [0, hy, hz], Sc = [0, hy - AN.torso * sp, hz + AN.torso * cp];
  let mx = S.vl || 0, my = -(S.vf || 0); const mm = Math.hypot(mx, my); if (mm > 1) { mx /= mm; my /= mm; } else { mx = 0; my = -1; }   // which way its feet step
  const A = lerp(4, 21, sm(15, 255, spd)) * (1 - air), lift = lerp(2, 9, run) * walk * (1 - air);
  R.p = p; R.Hp = Hp; R.Sc = Sc; R.legs = []; R.arms = [];
  for (const s of [-1, 1]) {
    const ph = S.ph + (s > 0 ? Math.PI : 0), off = Math.sin(ph) * A * walk, up = Math.max(0, Math.cos(ph)) * lift;
    const hj = [s * AN.hipw, hy, hz];
    let f = [s * (AN.hipw + 1.5 + cr * 2.5) + mx * off, 1.5 - cr * 5 + my * off, up];
    if (air) f = mix(f, s < 0 ? [s * (AN.hipw + 2), hy + legL * .55, hz - legL * .65] : [s * (AN.hipw + 3), hy - legL * .15, hz - legL * .7], air);   // springing: one leg driving behind, the other drawn up
    const L = ik3(hj, f, AN.thigh, AN.shin, [s * .12, -1, .2]);                // (knees forward, barely out: never splayed)
    const fa = air > .5 ? Math.PI / 2 : -Math.PI / 2 + clamp(mx * walk * .5, -.5, .5) + s * .12;   // its toes ahead (turned a little into a sidestep; trailing when it flies)
    R.legs.push({ s, h: hj, k: L.e, f: L.t, fa, planted: up < 1 && air < .5 });
  }
  const nb = [0, Sc[1] - 1.5, Sc[2] + 1.5], q = clamp(p + .75 + (S.headDown || 0) * .4 - air * .35, .25, 1.9);   // (its head held forward of its shoulders: a stoop)
  R.nb = nb; R.q = q; R.yaw = S.tilt || 0;
  const nk = AN.neck * (1 - .55 * (S.coil || 0));                               // (coiled, its head drawn in between its shoulders)
  R.hd = [Math.sin(R.yaw) * 2.5, nb[1] - nk * Math.sin(q), nb[2] + nk * Math.cos(q)];
  // its body over its own place: the stooped figure is drawn centred between the front of its skull and the back of its hips (the server's
  // position is the middle of its body, not its feet), so a creature hidden at a corner does not lean its head out of it
  const cy = (R.hd[1] - AN.skL + Hp[1] + 7) / 2; R.cy = cy;
  const L = AN.upper + AN.fore;
  for (const s of [-1, 1]) {
    const sj = [s * (AN.shw - 2.5), Sc[1] + 1, Sc[2] - 2], ph = S.ph + (s > 0 ? 0 : Math.PI);   // (the left arm swings with the right leg)
    // hanging: straight down, a little ahead and out; with the stride it swings, and running it is bent and pumps
    const sw = Math.sin(ph) * (walk * .3 + run * .25) * (1 - S.floor), Le = L * (1 - run * .45);
    let t = [sj[0] + s * (4 + cr * 2 - run * 3), sj[1] - Le * Math.sin(sw) - 6, sj[2] - Le * Math.cos(sw)];
    if (t[2] < 2) { const h = Math.max(0, sj[2] - 2); t = [sj[0] + s * (4 + cr * 3), sj[1] - Math.sqrt(Math.max(0, Le * Le * .9 - h * h)) * .55, 2]; }   // its hands reach the floor: they rest on it, ahead
    // prowling, feeding: its hands on the floor ahead of its shoulders, stepping with its feet; coiled: close in, fingers down
    const fl = [s * (AN.shw - 4), Sc[1] - 10 - 9 * S.floor + my * Math.sin(ph) * A * .5 * walk, 2 + Math.max(0, Math.cos(ph)) * lift * .5];
    t = mix(t, fl, S.floor * (1 - S.coil));
    t = mix(t, [s * 10, Sc[1] - 1, 1.5], S.coil);                                // (coiled: its hands under its shoulders, out of sight beneath it)
    t = mix(t, [sj[0] + s * 8, sj[1] + L * .6, sj[2] - L * .5], S.back);         // the wind-up: drawn back along its flanks, low
    // reaching: straight ahead at its shoulders' height; in a kill, to the victim's neck (S.gripD from its centre, S.gripZ high: skin.kill.js)
    const gy = S.gripD != null ? cy - S.gripD : sj[1] - L * .72, gz = S.gripZ != null ? S.gripZ : sj[2] - 22;
    const g2 = S.grip2 ? S.grip2[s > 0 ? 1 : 0] : null;                          // (R15: the Rend - each hand on its own half, from the body's centre)
    t = mix(t, g2 ? [g2[0], g2[1] + cy, g2[2]] : [s * (S.gripW != null ? S.gripW : 5), gy, gz], S.reach);
    t[2] = Math.max(1.5, t[2]);
    const J = ik3(sj, t, AN.upper, AN.fore, [s * (.45 - .25 * run + .3 * S.reach), .7 + .3 * run, .1 - .3 * run]);   // (elbows back and a little out; out to the sides only to grip)
    const fx = J.t[0] - J.e[0], fy = J.t[1] - J.e[1], fz = J.t[2] - J.e[2], fn = Math.hypot(fx, fy, fz) || 1, low = sm(6, 2, J.t[2]);
    let dx = lerp(fx / fn, s * .3, low), dy = lerp(fy / fn, -.95, low), dz = lerp(fz / fn, 0, low); const dn = Math.hypot(dx, dy, dz) || 1;   // fingers: along the forearm, or flat on the floor
    R.arms.push({ s, sh: sj, el: J.e, wr: J.t, fd: [dx / dn, dy / dn, dz / dn] });
  }
  const sh = q3 => { q3[1] -= cy; };
  sh(Hp); sh(Sc); sh(nb); sh(R.hd); for (const L2 of R.legs) { sh(L2.h); sh(L2.k); sh(L2.f); } for (const A2 of R.arms) { sh(A2.sh); sh(A2.el); sh(A2.wr); }
  return R;
}
const shadeC = (a, b, k) => { k = clamp(k, 0, 1); const r = (a >> 16) + (((b >> 16) - (a >> 16)) * k), g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k), bl = (a & 255) + (((b & 255) - (a & 255)) * k); return (r << 16) | (g << 8) | bl; };
const tone = z => shadeC(SC.skinLo, SC.skin, sm(8, 110, z));                     // (lower is darker: the light comes from above)
function seg(g, a, b, w, col) {                                                   // a limb's bone, outlined
  g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ color: SC.line, width: w + 2.4, cap: 'round' });
  g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ color: col, width: w, cap: 'round' });
}
/* (R14) a quick key of numbers, a quarter of a unit apart: nothing is redrawn while what it would draw is the same (a still figure costs
 * almost nothing a frame: its Graphics keep their shapes; only the head's turn, a property, moves) */
const hk = (h, x) => Math.imul(h ^ (Math.round(x * 4) | 0), 16777619) >>> 0;
const hk3 = (h, q) => hk(hk(hk(h, q[0]), q[1]), q[2]);
function paint(v, o, t) {
  const S = v.__s, g = v.__g, hg = v.__hd, sh = v.__sh, R = v.__r = rig(S, v.__r);
  const p = R.p, sp = Math.sin(p), cp = Math.cos(p), Hp = R.Hp, Sc = R.Sc;
  let kb = -1;                                                                    // (moving, it is redrawn every frame: no key to make)
  if ((S.spd || 0) < 3) {
    kb = hk(hk(2166136261, p * 40), S.reach * 20); kb = hk3(hk3(hk3(hk3(kb, Hp), Sc), R.nb), R.hd);
    for (const L of R.legs) kb = hk(hk3(hk3(hk3(kb, L.h), L.k), L.f), L.fa * 20);
    for (const A2 of R.arms) kb = hk3(hk3(hk3(hk3(kb, A2.sh), A2.el), A2.wr), [A2.fd[0] * 20, A2.fd[1] * 20, A2.fd[2] * 20]);
  }
  if (sh) {
    // its shadow on the floor: a soft patch under it, pushed a little away from the light, as dark as the light is strong; never farther from
    // its body than a few px, never through a wall (so it never shows a creature its body does not)
    const lw = clamp(v.__lw || 0, 0, 1), ldx = v.__ldx || 0, ldy = v.__ldy || 0, rot = v.rotation || 0, cr = Math.cos(-rot), sr = Math.sin(-rot);
    const lx = ldx * cr - ldy * sr, ly = ldx * sr + ldy * cr, cast = Math.min(7, (v.__lc === undefined ? 7 : Math.max(0, v.__lc / BODY_SCALE - 22))) * lw;
    const y0 = Math.min(Hp[1], Sc[1]) - 4, y1 = Math.max(Hp[1], Sc[1], ...R.legs.map(L => L.f[1])) + 5, cy = (y0 + y1) / 2 - ly * cast, cx = -lx * cast;
    const ks = hk(hk(hk(hk(hk(2166136261, cx), cy), (y1 - y0) / 2), lw * 50), R.legs.reduce((a, L2) => hk(hk(a, L2.planted ? L2.f[0] : -999), L2.planted ? L2.f[1] : -999), 7));
    if (v.__ks !== ks) { v.__ks = ks; sh.clear();
      if (lw > .02) for (const [w, a] of [[1.15, .1], [.9, .12], [.62, .14]]) sh.ellipse(cx, cy, (AN.shw + 3) * w, Math.max(14, (y1 - y0) / 2 + 3) * w).fill({ color: 0x000000, alpha: a * lw });
      for (const L of R.legs) if (L.planted) sh.ellipse(L.f[0], L.f[1] - 3, 4, 6).fill({ color: 0x000000, alpha: .28 });   // where its feet press the floor
    }
  }
  if (kb < 0 || v.__kb !== kb) { v.__kb = kb; g.clear();
    // legs (under it): thigh, shin and a long narrow foot with its toes
    for (const L of R.legs) {
      seg(g, L.h, L.k, 6.6, tone(L.k[2] * .8)); seg(g, L.k, L.f, 4.8, tone(L.f[2]));
      const fx = Math.cos(L.fa), fy = Math.sin(L.fa), tx = L.f[0] + fx * AN.foot, ty = L.f[1] + fy * AN.foot;
      g.moveTo(L.f[0], L.f[1]).lineTo(tx, ty).stroke({ color: SC.line, width: 6, cap: 'round' });
      g.moveTo(L.f[0], L.f[1]).lineTo(tx, ty).stroke({ color: SC.skinLo, width: 3.6, cap: 'round' });
    }
    // arms (below the shoulders' height, so under the trunk): upper arm, forearm, a narrow palm and three long fingers, foreshortened as they point
    for (const Ar of R.arms) {
      seg(g, Ar.sh, Ar.el, 5.2, tone(Ar.el[2])); seg(g, Ar.el, Ar.wr, 3.9, tone(Ar.wr[2]));
      const [dx, dy] = Ar.fd, n = Math.hypot(dx, dy), ux = n > .05 ? dx / n : 0, uy = n > .05 ? dy / n : -1, len = AN.finger * Math.max(.25, n), curl = S.reach > .5 ? .15 : .45;
      for (let f = -1; f <= 1; f++) {                                            // (the three in one path: one stroke)
        const c = Math.cos(f * (.3 + curl * .15)), s2 = Math.sin(f * (.3 + curl * .15)), fx = ux * c - uy * s2, fy = ux * s2 + uy * c, Lf = len * (1 - Math.abs(f) * .15);
        g.moveTo(Ar.wr[0], Ar.wr[1]).lineTo(Ar.wr[0] + fx * Lf, Ar.wr[1] + fy * Lf);
      }
      g.stroke({ color: SC.skinLo, width: 1.9, cap: 'round' });
      g.ellipse(Ar.wr[0], Ar.wr[1], 2.7, 2.7).fill(tone(Ar.wr[2] + 20)).stroke({ color: SC.line, width: 1.1 });
    }
    // the trunk: its sections from the hips to the shoulders, as the camera sees them (a section's depth shows less the more it leans) - one
    // outline: round the back of its hips, up its right flank section by section, round the front of its shoulders, down its left; drawn
    // once dark and a little larger (its outline), then in its skin, then its lit back narrower (its flanks darker: the light from above)
    const secs = SEC.map(([u, w, d]) => [lerp(Hp[1], Sc[1], u), w, Math.max(1.6, d * cp + (u > .7 ? 1.2 * sp : 0))]), n5 = secs.length - 1;
    for (const [o2, k, col] of [[1.6, 1, SC.line], [0, 1, SC.skinLo], [0, .7, SC.skin]]) {
      const P = [], [y0, w0, d0] = secs[0], [y4, w4, d4] = secs[n5], kd = k < 1 ? .8 : 1;
      for (let j = 0; j <= 6; j++) { const a = Math.PI - j / 6 * Math.PI; P.push(Math.cos(a) * (w0 * k + o2), y0 + Math.sin(a) * (d0 * kd + o2)); }
      for (let i = 1; i < n5; i++) P.push(secs[i][1] * k + o2, secs[i][0]);
      for (let j = 0; j <= 6; j++) { const a = -j / 6 * Math.PI; P.push(Math.cos(a) * (w4 * k + o2), y4 + Math.sin(a) * (d4 * kd + o2)); }
      for (let i = n5 - 1; i >= 1; i--) P.push(-secs[i][1] * k - o2, secs[i][0]);
      g.poly(P).fill(col);
    }
    // its back, where the camera sees it (the more it leans, the more): the spine's knobs, the ribs under the skin, its shoulder blades;
    // upright, the tops of its shoulders.  Loose skin folds at its flanks
    const bk = sm(.15, .9, p);
    g.poly([-secs[3][1] * .55, secs[3][0], secs[3][1] * .55, secs[3][0], secs[1][1] * .5, secs[1][0], -secs[1][1] * .5, secs[1][0]]).fill({ color: SC.skinHi, alpha: .18 + .2 * bk });
    g.moveTo(0, Sc[1] + 1).lineTo(0, Hp[1] - 1).stroke({ color: SC.fold, width: 1.3, alpha: .35 + .4 * bk });   // the spine, and its knuckles
    for (let i = 0; i < 6; i++) { const y = lerp(Sc[1] + 2, Hp[1] - 2, i / 5); g.moveTo(-1.6, y).lineTo(1.6, y); }
    g.stroke({ color: SC.skinHi, width: 1.4, alpha: .3 + .5 * bk, cap: 'round' });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const u = .5 + i * .1, y = lerp(Hp[1], Sc[1], u), w = lerp(5.6, 13.2, (u - .3) / .5); g.moveTo(s * 2.4, y).quadraticCurveTo(s * w * .6, y - 1.5, s * w * .92, y + 2); }
    g.stroke({ color: SC.fold, width: 1, alpha: .55 * bk });                       // its ribs
    for (const s of [-1, 1]) g.moveTo(s * 9.5, lerp(Hp[1], Sc[1], .75)).quadraticCurveTo(s * 11.5, lerp(Hp[1], Sc[1], .5), s * 7, lerp(Hp[1], Sc[1], .3));
    g.stroke({ color: SC.fold, width: 1.2, alpha: .8 });                           // loose skin at its flanks
    for (const s of [-1, 1]) g.ellipse(s * 6.8, lerp(Hp[1], Sc[1], .84), 4.6, 3 + 1.6 * bk);
    g.fill({ color: SC.skinHi, alpha: .55 }).stroke({ color: SC.fold, width: .9, alpha: .6 });   // its shoulder blades
    for (const s of [-1, 1]) g.ellipse(s * (AN.shw - 3), Sc[1] + 1, 3.2, 2.4 * cp + 1.2);
    g.fill({ color: SC.skinHi, alpha: .55 });                                      // the shoulders' knobs over the arms
    // the neck: long, thin, thrust forward; then the skull (its own Graphics, turned as the server says it looks)
    g.moveTo(R.nb[0], R.nb[1]).lineTo(R.hd[0], R.hd[1]).stroke({ color: SC.line, width: 7.2, cap: 'round' });
    g.moveTo(R.nb[0], R.nb[1]).lineTo(R.hd[0], R.hd[1]).stroke({ color: SC.skinLo, width: 4.6, cap: 'round' });
    for (const s of [-1, 1]) g.moveTo(R.nb[0] + s * 1.6, R.nb[1]).lineTo(R.hd[0] + s * 1.2, R.hd[1] + 2);
    g.stroke({ color: SC.fold, width: .8, alpha: .8 });
  }
  if (hg) {
    hg.position.set(R.hd[0], R.hd[1]); hg.rotation = R.yaw + (S.twitch > 0 ? Math.sin(t * 40 + S.seed) * .06 * S.twitch : 0);
    const down = sm(.9, 1.75, R.q), up = sm(.6, .2, R.q), open = Math.max(S.reach > .5 ? sm(.5, 1, S.reach) : 0, S.chew ? .5 + .5 * Math.sin(S.chew * 9) : 0, clamp(S.bite || 0, 0, 1));
    hg.scale.set(1, lerp(1, .86, down));                                          // (looking down at the floor, the skull is seen nearer end-on)
    const kh = hk(hk(hk(5381, up * 50), open * 50), S.seed); if (v.__kh === kh) return; v.__kh = kh; hg.clear();
    hg.ellipse(0, .6, AN.skW, AN.skL).fill(SC.skin).stroke({ color: SC.line, width: 1.8 });
    hg.ellipse(0, 3.6, AN.skW * .8, AN.skL * .5).fill({ color: SC.skinLo, alpha: .35 });   // the back of the skull
    hg.ellipse(-1, -.6, 2.8, 3.4).fill({ color: SC.skinHi, alpha: .6 });            // the crown, catching the light
    for (const s of [-1, 1]) hg.ellipse(s * (AN.skW + .4), 1.6, 1.5, 2.5);
    hg.fill(SC.skinLo).stroke({ color: SC.line, width: 1 });                       // ears: which way it faces, at a glance
    for (let i = 0; i < 6; i++) { const x0 = (i - 2.5) * 1.5, sw = ((S.seed * (i + 3)) % 7 - 3) * .5; hg.moveTo(x0 * .6, -1).quadraticCurveTo(x0 + sw, 4, x0 * 1.2 + sw, 8.4); }
    hg.stroke({ color: SC.hair, width: .9, alpha: .7 });
    hg.moveTo(-4.8, -5.8).quadraticCurveTo(0, -9.4, 4.8, -5.8).stroke({ color: SC.line, width: 1.7 });   // the brow
    for (const s of [-1, 1]) hg.ellipse(s * 2.5, -6.4, 1.4, .9 + .5 * up);
    hg.fill({ color: SC.line, alpha: .55 + .4 * up });                             // its eyes, deep under the brow
    hg.ellipse(0, -8.6, 1.5, 1.3).fill(SC.skinLo).stroke({ color: SC.line, width: .9 });   // the nose's ridge
    if (open > .02) hg.ellipse(0, -9.4, 2.4, .8 + 1.8 * open).fill(SC.mouth);
  }
}
/* (T6) a borrowed skin: the page's own wanderer avatar (__api.mkAvatar, as another player is drawn), in the look the server sends, under
 * the same sight mask and darkness (the creatures layer), cast by BR-RoLE as a wanderer is - with its tells: nothing in its hands and no
 * light, no name (it is no player: no hover label, in no list), its arms held stiff at its sides, its walk a little slow (the server's
 * pace), its long stares.  It goes the moment the server stops sending the look (its wind-up, a run, its time up) - (R14) the body
 * unfolding out of it in a few frames, as it folds into it when it puts the skin on. */
function skinView(v, o, t, look) {
  const A = API(), W = window.__mpLib && window.__mpLib.wire; if (!A || !A.mkAvatar || !W || !W.parseLook) return null;
  if (!v.__av || v.__dg !== look) { dropSkin(v); v.__av = A.mkAvatar(W.parseLook(look), { kind: 'flashlight', color: '#ffe7b2', parts: {} }); v.__av.label = 'skinstealer-skin#' + o.id; v.__dg = look; A.layer().addChild(v.__av); }
  const av = v.__av, S = v.__s, sp = Math.hypot(S.vx || 0, S.vy || 0);
  av.update(t, false, false, { x: o.x, y: o.y, angle: o.angle, vx: S.vx || 0, vy: S.vy || 0, distance: o.distance, mv: [sp > 20 ? 1 : 0, Math.round(sp), 100, 0] });
  if (av.gear) av.gear.visible = false;                                         // nothing in its hands
  if (Array.isArray(av.hands)) av.hands.forEach((h, i) => { h.x = i === 0 ? -16 : 16; h.y = -2; });   // arms stiff at its sides
  av.visible = true;
  return av;
}
function dropSkin(v) { const av = v.__av; v.__av = null; v.__dg = null; if (av) { try { av.parent && av.parent.removeChild(av); av.destroy({ children: true }); } catch (e) { } } }
/* shaded by the light where it stands (BR-RoLE's sample, eased), as the Hound's view is; no light of its own.  (R14) It keeps the light's
 * direction and strength there for its shadow, and how far the floor goes that way before a wall */
function shadeView(v, x, y, flash, dt) {
  const L = window.__light; if (!L) return;
  const s = L.sample(x, y, flash, v.__lt || (v.__lt = L.mk())), shade = L.shade(s.total);
  v.__shade = v.__shade === undefined ? shade : v.__shade + (shade - v.__shade) * (1 - Math.exp(-dt * 8));
  const c = Math.round(v.__shade * 255); v.tint = c << 16 | c << 8 | c;
  const lw = clamp((s.direct || 0) * 1.6, 0, 1); v.__lw = v.__lw === undefined ? lw : v.__lw + (lw - v.__lw) * (1 - Math.exp(-dt * 6));
  if (s.dirX || s.dirY) { v.__ldx = s.dirX; v.__ldy = s.dirY; v.__lc = L.ray ? L.ray(x, y, Math.atan2(-s.dirY, -s.dirX), 60) : 60; }
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
    // (T6, R14) in a borrowed skin the wanderer is drawn; putting it on, the body folds into it (a quarter of a second); dropping it
    // (to strike, to run) the body is out of it at once - within about a tenth of a second
    const want = o.dg ? 1 : 0, dk = v.__dk === undefined ? want : v.__dk;
    v.__dk = Math.abs(want - dk) < .02 ? want : dk + (want - dk) * (1 - Math.exp(-dt * (want ? 10 : 28)));
    const look = o.dg || v.__dg;
    if (v.__dk > 0 && look && skinView(v, o, now, look)) { v.__av.alpha = Math.min(1, v.__dk * 1.3); if (v.__dk >= 1) { v.visible = false; continue; } }
    else if (v.__av) dropSkin(v);
    v.position.set(o.x, o.y); v.rotation = o.angle + Math.PI / 2; v.alpha = 1 - v.__dk; v.scale.set(BODY_SCALE * (1 - .22 * v.__dk));
    shadeView(v, o.x, o.y, flash, dt);
    paint(v, o, now);
  }
  for (const [id, v] of views) if (!seen.has(id)) { views.delete(id); dropSkin(v); try { v.parent && v.parent.removeChild(v); v.destroy({ children: true }); } catch (e) { } }
  if (hooks.frame) hooks.frame(dt);
  if (hooks.audio) hooks.audio(dt, list());                  // (T5) its living sounds, from what the mirror says it is doing
}
/* a new world, a closed connection: no view and no record stays behind */
function reset() { clear(); for (const v of views.values()) { dropSkin(v); try { v.parent && v.parent.removeChild(v); v.destroy({ children: true }); } catch (e) { } } views.clear(); }
/* (R14) the anatomy, for the art report and its tests: a pose settled for an act at a speed (the page's own pose and rig, nothing drawn) */
function settle(act, spd, o2) {
  const S = { rs: 17, ph: 0, px: null, py: null, vf: 0, vl: 0, spd: 0, sp0: 0, acc: 0, brake: 0, crouch: .1, lean: .2, floor: 0, coil: 0, back: 0, reach: 0, air: 0, headDown: 0, tilt: 0, tiltT: 9, tiltTo: 0, twitch: 0, chew: 0, seed: 17 };
  const opt = o2 || {}, dir = opt.dir === undefined ? 0 : opt.dir, frames = opt.frames || 150, dt = 1 / 60, ang = opt.angle || 0;
  const o = { x: 0, y: 0, angle: ang, act, head: opt.head || 0 };
  for (let i = 0; i < frames; i++) { o.x += Math.cos(ang + dir) * spd * dt; o.y += Math.sin(ang + dir) * spd * dt; pose(S, o, i * dt, dt); }
  if (opt.ph !== undefined) S.ph = opt.ph;
  return S;
}
K.draw = draw;
K.clear = reset;
K.anatomy = { AN, POSE, rig, settle };
return { classes, newView, paint, shadeView };
}
