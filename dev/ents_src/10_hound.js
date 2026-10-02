
/* ---------------------------------------------------------------- HOUND: a distorted humanoid on all fours
 * Narrow torso, elongated limbs with real elbows and knees (two-bone IK), hands and feet planted on the floor, a head that
 * hangs and jerks under stringy dark hair.  Local space: forward is -y, +x is the entity's right. */
const HC = { line: 0x0d0b0a, skin: 0x453e38, skinHi: 0x7b6f61, limb: 0x37312c, limbHi: 0x6f6456, bone: 0xc4b89f, hair: 0x080706, hair2: 0x1b1917, mouth: 0x140506, tooth: 0xddd4bd, gum: 0x552126, eye: 0xaea690 };
const ANC = { fl: { x: -12, y: -19 }, fr: { x: 12, y: -19 }, rl: { x: -9, y: 22 }, rr: { x: 9, y: 22 } };     // shoulders and hips
const NEU = { fl: { x: -23, y: -76 }, fr: { x: 23, y: -76 }, rl: { x: -29, y: 57 }, rr: { x: 29, y: 57 } };   // where the hands and feet come down (hands well ahead of the head, feet behind the hips)
const PHASE = { fl: 0, rr: 0, fr: .5, rl: .5 };                                                              // diagonal gait
const LIMBS = ['fl', 'fr', 'rl', 'rr'];
const L1 = { fl: 31, fr: 31, rl: 29, rr: 29 }, L2 = { fl: 36, fr: 36, rl: 33, rr: 33 };                        // upper arm / forearm, thigh / shin

/* two-bone IK: the joint bends outward (side = -1 left, +1 right) */
function ik(ax, ay, tx, ty, l1, l2, side) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 1; const mx = l1 + l2 - .6, mn = Math.abs(l1 - l2) + 1;
  if (d > mx) { tx = ax + dx / d * mx; ty = ay + dy / d * mx; dx = tx - ax; dy = ty - ay; d = mx; }
  if (d < mn) { tx = ax + dx / d * mn; ty = ay + dy / d * mn; dx = tx - ax; dy = ty - ay; d = mn; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let px = -dy / d, py = dx / d; if (px * side < 0) { px = -px; py = -py; }
  return { ex: ax + dx * a / d + px * h, ey: ay + dy * a / d + py * h, tx, ty };
}
function gait(ph, A) {                                                                                      // stance slides the hand back, swing carries it forward
  ph -= Math.floor(ph);
  if (ph < .58) return { dy: lerp(-A, A, ph / .58), lift: 0 };
  const u = (ph - .58) / .42, e = u * u * (3 - 2 * u); return { dy: lerp(A, -A, e), lift: Math.sin(u * Math.PI) };
}
const gs = v => v.__g || (v.__g = { ph: 0, px: null, py: null, vf: 0, vl: 0, hj: 0, hjT: 0, hjNext: 1, hjHold: 0, jw: 0, crouch: 0, hair: [], t0: rnd(0, 100), foot: [0, 0, 0, 0], step: [0, 0, 0, 0], seed: Math.random() * 100 });

E.initHound = function (view) {
  const Gf = view.limbs.constructor;
  view.removeChildren();
  view.shadow = new Gf(); view.body = new Gf(); view.head = new Gf();
  view.addChild(view.shadow, view.body, view.head);
  view.__g = null; view.__hound = true;
};

/* locomotion pose from what the server says the hound is doing */
E.poseHound = function (view, g, t, dt) {
  const S = gs(view); dt = clamp(dt || .016, .001, .1);
  if (S.px === null || Math.hypot(g.x - S.px, g.y - S.py) > 220) { S.px = g.x; S.py = g.y; }
  const vx = (g.x - S.px) / dt, vy = (g.y - S.py) / dt; S.px = g.x; S.py = g.y;
  const c = Math.cos(g.angle), s = Math.sin(g.angle), k = 1 - Math.exp(-dt * 10);
  S.vf += ((vx * c + vy * s) - S.vf) * k; S.vl += ((-vx * s + vy * c) - S.vl) * k;
  const spd = Math.hypot(S.vf, S.vl), act = g.act || '', st = g.state || '';
  const hunting = st === 'HUNTING' || st === 'chase', excited = hunting || act === 'lunge' || act === 'wind' || act === 'recover' || act === 'pace';
  S.t = t;
  // gait
  const stride = lerp(56, 104, sm(60, 320, spd)), A = lerp(4, 31, sm(10, 300, spd)), sgn = S.vf < -10 ? -1 : 1;
  S.ph += sgn * spd * dt / stride;
  // the head jerks: small sudden twitches, faster when it is worked up
  S.hjNext -= dt;
  if (S.hjNext <= 0) { S.hjT = rnd(-.55, .55) * (excited ? 1.4 : 1); S.hjNext = rnd(.45, 1.7) / (excited ? 2 : 1); S.hjHold = rnd(.06, .14); }
  else if (S.hjHold > 0) { S.hjHold -= dt; if (S.hjHold <= 0) S.hjT = 0; }
  S.hj += (S.hjT - S.hj) * (1 - Math.exp(-dt * (S.hjT ? 42 : 6)));
  const look = g.look === undefined ? (g.head || 0) : g.look;
  const P = { hand: {}, lift: {}, hx: Math.sin(t * .8 + S.seed) * 1.6 + Math.sin(look) * 2.8, hy: -44 + Math.sin(t * 1.3 + S.seed) * 1.2, hr: look * .92 + S.hj, jaw: 0, sy: 1, sx: 1, bend: 0, crouch: 0, air: 0, whip: 0, lean: 0 };
  for (const n of LIMBS) {
    const ph = S.ph + PHASE[n], r = gait(ph, A * (n[0] === 'f' ? .72 : 1)), nu = NEU[n], side = n[1] === 'l' ? -1 : 1;
    P.hand[n] = { x: nu.x + side * r.lift * 8, y: nu.y + r.dy }; P.lift[n] = r.lift;
  }
  P.bend = clamp(S.vl * .0012, -.25, .25) + Math.sin(S.ph * TAU) * lerp(0, 3.4, sm(30, 280, spd));            // the spine flexes as it goes
  P.sy = 1 + .05 * sm(150, 320, spd); P.crouch = hunting ? .2 : 0;
  P.jaw = hunting ? .28 + .14 * Math.sin(t * 9) : act === 'growl' ? .5 : st === 'SEARCHING' ? .12 + .1 * Math.sin(t * 2) : .05;
  if (!hunting && spd < 30) P.hy += Math.sin(t * 2.1) * 1.3;                                                   // hangs and sways when idle
  const K = { neck: 1 };
  switch (act) {
    case 'listen': {                                                                                          // stops, rises, one hand lifts, head sweeps
      P.hand.fl = { x: NEU.fl.x - 6, y: NEU.fl.y - 12 + Math.sin(t * 3) * 2 }; P.lift.fl = 1; P.hy = -46; P.hr = Math.sin(t * 1.6) * .7 + S.hj * .5; P.crouch = -.1; P.jaw = .12; break;
    }
    case 'sniff': P.hy = -47; P.hx = Math.sin(t * 4.2) * 7; P.hr = Math.sin(t * 4.2) * .55; P.jaw = .08; break;
    case 'freeze': P.crouch = .15; P.hr = S.hj * 1.2; P.jaw = .1; break;
    case 'wind': {                                                                                            // the coil before a lunge
      const q = .5; for (const n of LIMBS) { const a = ANC[n], h = P.hand[n]; P.hand[n] = { x: lerp(h.x, a.x * 1.3, q), y: lerp(h.y, a.y + (n[0] === 'f' ? -16 : 8), q) }; P.lift[n] = 0; }
      P.sy = .9; P.crouch = .6; P.hy = -33; P.jaw = .55; P.whip = .3; break;
    }
    case 'lunge': {                                                                                           // fully stretched, airborne
      const k2 = clamp(g.lunge || 0, 0, 1);
      P.hand.fl = { x: -15, y: -78 + 8 * k2 }; P.hand.fr = { x: 15, y: -78 + 8 * k2 }; P.hand.rl = { x: -20, y: 52 - 6 * k2 }; P.hand.rr = { x: 20, y: 52 - 6 * k2 };
      for (const n of LIMBS) P.lift[n] = 1; P.sy = 1.18; P.hy = -50; P.jaw = .95; P.air = 1; P.whip = 1; P.crouch = -.15; break;
    }
    case 'recover': {                                                                                         // skidding, hands splayed, shaking its head
      P.hand.fl = { x: -46, y: -30 }; P.hand.fr = { x: 44, y: -34 }; P.hand.rl = { x: -40, y: 30 }; P.hand.rr = { x: 42, y: 26 }; for (const n of LIMBS) P.lift[n] = 0;
      P.bend = Math.sin(t * 16) * 5; P.hr = Math.sin(t * 22) * .6; P.jaw = .4; P.crouch = .3; P.whip = .7; break;
    }
    case 'feed': {
      P.hand.fl = { x: -13, y: -46 + Math.sin(t * 6) * 3 }; P.hand.fr = { x: 13, y: -46 - Math.sin(t * 6) * 3 }; P.lift.fl = P.lift.fr = 0; P.hy = -50 + Math.sin(t * 7) * 3.5; P.jaw = .5 + .45 * Math.max(0, Math.sin(t * 7)); P.crouch = .35; break;
    }
    case 'rest': for (const n of LIMBS) { const a = ANC[n]; P.hand[n] = { x: a.x * 1.9, y: a.y + (n[0] === 'f' ? -12 : 6) }; P.lift[n] = 0; } P.crouch = .6; P.hy = -34; P.hr = .3; P.jaw = .02; break;
    case 'stare': case 'guard': case 'growl': P.hr = look * .78 + S.hj * .4; P.jaw = act === 'stare' ? .22 : .55; P.crouch = .25; break;
    case 'pace': P.hr = Math.sin(t * 6) * .6; P.jaw = .45; break;
  }
  return P;
};

E.paintHound = function (view, P, t, dt) {
  const S = gs(view), sh = view.shadow, bd = view.body, hd = view.head;
  sh.clear(); bd.clear(); hd.clear();
  const cr = P.crouch, sy = P.sy * (1 - .06 * cr);
  // ground shadow (higher off the floor in the air = further and fainter) + planted-hand shadows
  const air = P.air;
  sh.ellipse(0, 3 + air * 14, 30 - air * 6, 50 * P.sy).fill({ color: 0x000000, alpha: .34 - air * .14 });
  for (const n of LIMBS) if (P.lift[n] < .3) sh.ellipse(P.hand[n].x, P.hand[n].y + 3, 6, 3.6).fill({ color: 0x000000, alpha: .32 });
  // -- rear legs (under the body)
  const side = n => n[1] === 'l' ? -1 : 1;
  for (const n of ['rl', 'rr']) limb(bd, ANC[n].x, ANC[n].y * sy, P.hand[n].x, P.hand[n].y * (n[0] === 'r' ? sy : 1), L1[n], L2[n], side(n), 7.2, HC.limb, P.lift[n], false, 0);
  // -- torso: a narrow, hunched spine with ribs showing
  const bendX = y => P.bend * Math.pow(clamp((22 - y) / 54, 0, 1.2), 2) * 1.0, w = y => y < -8 ? lerp(10.5, 7, sm(-28, -8, y)) : y < 10 ? lerp(7, 6, sm(-8, 10, y)) : lerp(6, 9, sm(10, 26, y));
  const ys = [-30, -22, -14, -6, 2, 10, 18, 26], left = [], right = [];
  for (const y of ys) { const yy = y * sy, x0 = bendX(y); left.push(x0 - w(y), yy); }
  for (let i = ys.length - 1; i >= 0; i--) { const y = ys[i], yy = y * sy, x0 = bendX(y); right.push(x0 + w(y), yy); }
  bd.poly(left.concat(right)).fill(HC.skin).stroke({ color: HC.line, width: 2.2, join: 'round' });
  bd.poly([-3, -26 * sy, 3, -26 * sy, 2, 22 * sy, -2, 22 * sy]).fill({ color: HC.skinHi, alpha: .28 });
  for (let i = 0; i < 6; i++) {                                                                              // ribs and vertebrae
    const y = (-24 + i * 6.4) * sy, x0 = bendX(-24 + i * 6.4), ww = w(-24 + i * 6.4);
    bd.moveTo(x0 - ww + 1, y).quadraticCurveTo(x0 - ww * .3, y + 3, x0, y + 2).quadraticCurveTo(x0 + ww * .3, y + 3, x0 + ww - 1, y).stroke({ color: HC.skinHi, width: 1, alpha: .5 });
    bd.circle(x0, y + 1, 1.6).fill({ color: HC.bone, alpha: .5 });
  }
  bd.ellipse(-12, -18 * sy, 5, 8).ellipse(12, -18 * sy, 5, 8).fill({ color: HC.skinHi, alpha: .35 });          // shoulder blades
  bd.ellipse(0, 22 * sy, 9, 6).fill({ color: HC.limb, alpha: .9 });                                            // pelvis
  // -- front arms (over the body)
  for (const n of ['fl', 'fr']) limb(bd, ANC[n].x, ANC[n].y * sy, P.hand[n].x, P.hand[n].y, L1[n], L2[n], side(n), 8, HC.limb, P.lift[n], true, P.whip);
  // -- neck and head: hangs low, jerks
  const hx = P.hx + P.bend * .15, hy = P.hy * (1 - .05 * cr);
  bd.moveTo(0, -27 * sy).lineTo(hx * .6, (-27 + (hy + 27) * .55) * sy).stroke({ color: HC.line, width: 10, cap: 'round' });
  bd.moveTo(0, -27 * sy).lineTo(hx * .6, (-27 + (hy + 27) * .55) * sy).stroke({ color: HC.skin, width: 6, cap: 'round' });
  headPaint(hd, hx, hy, P.hr, P.jaw, S, t, P.whip);
};

function limb(g, ax, ay, tx, ty, l1, l2, side, w, col, lift, front, whip) {
  const r = ik(ax, ay, tx, ty, l1, l2, side);
  const upper = () => g.moveTo(ax, ay).lineTo(r.ex, r.ey), lower = () => g.moveTo(r.ex, r.ey).lineTo(r.tx, r.ty), w2 = w * .74;   // thick at the shoulder, thin and stringy toward the hand
  upper().stroke({ color: HC.line, width: w + 3.6, cap: 'round', join: 'round' }); lower().stroke({ color: HC.line, width: w2 + 3.2, cap: 'round', join: 'round' });
  upper().stroke({ color: col, width: w, cap: 'round', join: 'round' }); lower().stroke({ color: col, width: w2, cap: 'round', join: 'round' });
  upper().stroke({ color: HC.limbHi, width: 1.3, alpha: .5, cap: 'round', join: 'round' }); lower().stroke({ color: HC.limbHi, width: 1.1, alpha: .5, cap: 'round', join: 'round' });
  g.circle(r.ex, r.ey, w * .58).fill(col).stroke({ color: HC.line, width: 1.4 });                             // the elbow / knee is a knob of bone
  g.circle(r.ex, r.ey, w * .22).fill({ color: HC.bone, alpha: .55 });
  // hand: palm and long fingers pointing along the forearm, spread wide when lifted
  const dx = r.tx - r.ex, dy = r.ty - r.ey, a0 = Math.atan2(dy, dx), spread = .5 + lift * .45 + whip * .25;
  g.ellipse(r.tx, r.ty, 4.6, 3.6).fill(HC.limb).stroke({ color: HC.line, width: 1.2 });
  const n = front ? 4 : 3, len = front ? 12 : 9;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / (n - 1) - .5) * 2 * spread, l = len * (i === 0 || i === n - 1 ? .82 : 1);
    const mx = r.tx + Math.cos(a) * l * .55, my = r.ty + Math.sin(a) * l * .55, ex = r.tx + Math.cos(a + .18) * l, ey = r.ty + Math.sin(a + .18) * l;
    g.moveTo(r.tx, r.ty).lineTo(mx, my).lineTo(ex, ey).stroke({ color: HC.line, width: 3, cap: 'round' });
    g.moveTo(r.tx, r.ty).lineTo(mx, my).lineTo(ex, ey).stroke({ color: HC.bone, width: 1.35, cap: 'round' });
  }
}

function headPaint(hd, hx, hy, hr, jaw, S, t, whip) {
  const c = Math.cos(hr), s = Math.sin(hr), R = (x, y) => [hx + x * c - y * s, hy + x * s + y * c];
  const pts = (arr) => { const o = []; for (let i = 0; i < arr.length; i += 2) { const p = R(arr[i], arr[i + 1]); o.push(p[0], p[1]); } return o; };
  // skull
  hd.poly(pts([-8, -4, -9, 4, -6, 11, 0, 13, 6, 11, 9, 4, 8, -4, 5, -12, 0, -14, -5, -12])).fill(HC.skin).stroke({ color: HC.line, width: 2, join: 'round' });
  // open mouth: dark interior, teeth
  if (jaw > .06) {
    hd.poly(pts([-5, -12, -6, -12 - 6 * jaw - 4, -3, -12 - 9 * jaw - 5, 3, -12 - 9 * jaw - 5, 6, -12 - 6 * jaw - 4, 5, -12])).fill(HC.mouth).stroke({ color: HC.line, width: 1.6 });
    for (let i = 0; i < 6; i++) { const x = -4.6 + i * 1.85; const a = R(x, -12), b = R(x + .9, -12 - 3.2), d = R(x + 1.8, -12); hd.poly([a[0], a[1], b[0], b[1], d[0], d[1]]).fill(HC.tooth); }
    for (let i = 0; i < 5; i++) { const x = -4 + i * 2; const yb = -12 - 6 * jaw - 4; const a = R(x, yb - 2 - 9 * jaw * .35), b = R(x + 1, yb + 2 - 9 * jaw * .35 + 2), d = R(x + 2, yb - 2 - 9 * jaw * .35); hd.poly([a[0], a[1], b[0], b[1], d[0], d[1]]).fill(HC.tooth); }
  }
  // sunken eyes, hardly visible under the hair
  for (const sx of [-1, 1]) { const e = R(sx * 4, -2); hd.ellipse(e[0], e[1], 2.3, 3.1).fill({ color: 0x000000, alpha: .85 }); hd.circle(e[0] + sx * .3, e[1] - .7, .85).fill({ color: HC.eye, alpha: .55 + .25 * Math.sin(t * 3 + sx) }); }
  // stringy hair: strands radiate from the crown, drag behind motion, sway
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU + .35, base = R(Math.cos(a) * 6, Math.sin(a) * 7 + 2), L = (17 + (i * 7 % 13)) * (1 + whip * .35);
    const sw = Math.sin(t * (2.1 + (i % 5) * .35) + i * 1.7 + S.seed) * (3 + whip * 5);
    const dragX = -S.vl * .05, dragY = -S.vf * .065 * (i % 3 === 0 ? 1.15 : 1);
    const tx = base[0] + Math.cos(a) * L * .55 + sw + dragX, ty = base[1] + Math.sin(a) * L * .55 + 3 + dragY * 1;
    const cx = (base[0] + tx) / 2 + Math.sin(a) * 4 + sw * .4, cy = (base[1] + ty) / 2 - Math.cos(a) * 3;
    hd.moveTo(base[0], base[1]).quadraticCurveTo(cx, cy, tx, ty).stroke({ color: i % 4 === 0 ? HC.hair2 : HC.hair, width: 1.7 + (i % 3) * .55, cap: 'round' });
  }
}

E.drawHound = function (view, g, t, dt) {
  if (!view.__hound) E.initHound(view);
  const P = E.poseHound(view, g, t, dt);
  E.paintHound(view, P, t, dt);
};
/* the kill: forelimbs hooked forward, jaws wide, the body slung low over the victim.  grip/impact come from the death timeline */
/* driven by the death simulation (dphys.js): the paws go to the places on the victim's body the jaws are actually holding, the hips and hind feet follow
 * the distance travelled (so they never skate), the head goes to the grip, and the load on the rope shows as a lower, harder crouch */
function attackFromSim(view, jl, impact) {
  const S = jl.ph, at = S.at, b = S.b, t = jl.elapsed, rot = at.a + Math.PI / 2, c = Math.cos(rot), sn = Math.sin(rot);
  const loc = (x, y) => { const dx = x - at.x, dy = y - at.y; return { x: dx * c + dy * sn, y: -dx * sn + dy * c }; };
  const ux = Math.cos(at.a), uy = Math.sin(at.a), px = -uy, py = ux, contact = S.contactT >= 0 && t >= S.contactT;
  const n1 = S.nz[4], n2 = S.nz[5], str = clamp(at.str || 0, 0, 1.2), sp = Math.hypot(at.vx, at.vy);
  const P = { hand: {}, lift: { fl: 1, fr: 1, rl: .1, rr: .1 }, air: 0, whip: 1, lean: 0, sx: 1 };
  // fore paws: reaching out ahead until they meet the body, then on it: shoulder and flank, each with its own small irregular motion
  const lead = contact ? 1 : clamp(1 - (S.contactT < 0 ? Math.max(0, Math.hypot(b.x - at.x, b.y - at.y) - 34) / 70 : 0), 0, 1);
  for (const [n, side] of [['fl', -1], ['fr', 1]]) {
    const wob = (side < 0 ? n1(t * 1.3) : n2(t * 1.1)) * (2.5 + impact * 3);
    const tgt = loc(b.x + px * side * 25 + ux * 8 + wob * px * .5, b.y + py * side * 25 + uy * 8 + wob * py * .5), reachY = -76 + 10 * side * 0;
    P.hand[n] = { x: tgt.x * lead + side * (16 + impact * 3) * (1 - lead), y: clamp(tgt.y * lead + reachY * (1 - lead), -74, -34) };
    P.lift[n] = contact ? (side < 0 ? .12 + .3 * Math.max(0, n2(t * .8)) : .12 + .3 * Math.max(0, n1(t * .9))) : 1;
  }
  // hind paws: they step with the distance the hound has covered
  const w = at.walk || 0, step = Math.min(1, sp / 60);
  for (const [n, side, ph] of [['rl', -1, 0], ['rr', 1, 2.7]]) { const sw = Math.sin(w * .16 + ph) * 7 * step; P.hand[n] = { x: side * (23 + str * 3), y: 40 + sw - str * 3 }; P.lift[n] = step > .1 ? clamp(.5 - Math.cos(w * .16 + ph) * .5, .05, .9) * step : .1; }
  // head: to the grip point, dipping into every blow, hanging lower under load
  const grip = loc(b.x, b.y), bite = at.bite || 0;
  P.hx = clamp(grip.x * .25, -9, 9) + n1(t * 2.2) * bite * 3; P.hy = -47 + impact * 4 + bite * 9 + str * 4; P.hr = clamp(Math.atan2(grip.x, -grip.y) * .5, -.5, .5) + n2(t * 3) * bite * .4;
  P.jaw = clamp(.55 + bite * .4 + (contact ? .2 : 0) + impact * .15, 0, 1); P.sy = 1.08 + S.pitch * .12 - str * .06 - impact * .05; P.bend = n1(t * .7) * 3 + str * 5 * (grip.x > 0 ? 1 : -1) + Math.sin(w * .08) * 2 * step;
  P.crouch = clamp(.45 + str * .35 + (contact ? .1 : 0), 0, .9);
  E.paintHound(view, P, t, .016);
}
E.attackHound = function (view, grip, impact, variant, jl) {
  if (!view.__hound) E.initHound(view);
  if (jl && jl.ph) return attackFromSim(view, jl, impact);
  const S = gs(view), t = performance.now() / 1000, reach = 68 + grip * 6 - impact * 6;
  const P = { hand: { fl: { x: -15 - impact * 4, y: -reach }, fr: { x: 15 + impact * 4, y: -reach }, rl: { x: -23, y: 40 }, rr: { x: 23, y: 40 } }, lift: { fl: 1, fr: 1, rl: .1, rr: .1 },
    hx: Math.sin(t * 24) * impact * 3, hy: -47 + impact * 5, hr: Math.sin(t * 19) * impact * .5, jaw: clamp(.6 + grip * .4 + impact * .3, 0, 1), sy: 1.1 - impact * .1, sx: 1, bend: Math.sin(t * 30) * impact * 4, crouch: .5, air: 0, whip: 1, lean: 0 };
  if (variant === 'B') { P.hand.fl = { x: -30, y: -50 }; P.hand.fr = { x: 22, y: -62 }; P.bend = 7 + Math.sin(t * 12) * 2; }
  if (variant === 'D') { P.hand.fl = { x: -20, y: -64 }; P.hand.fr = { x: 20, y: -64 }; P.crouch = .7; P.hy = -42; }
  E.paintHound(view, P, t, .016);
};
