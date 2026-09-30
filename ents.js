/* ents.js - client side of the v16 entities: the redesigned Hound and Smiler (drawn procedurally, articulated),
 * their sounds, and the admin-only AI debug overlay.  The server decides everything they do (ai.js); this file only
 * draws and voices what the snapshots say.  Loaded after the game bundle; mp.js feeds it. */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const rnd = (a, b) => a + Math.random() * (b - a);
const E = window.__ents = {
  /* code tables (the server sends its own in the hello message; these are the same lists) */
  tab: {
    s: ['DORMANT', 'ROAMING', 'CURIOUS', 'ALERT', 'WATCHING', 'STALKING', 'HUNTING', 'SEARCHING', 'CAUTIOUS', 'FRUSTRATED', 'EXCITED', 'FEEDING', 'PLAYING', 'RETREATING', 'HIDDEN', 'FOLLOWING', 'PROVOKED', 'ATTACKING', 'DISAPPEARING'],
    h: ['', 'listen', 'sniff', 'freeze', 'wind', 'lunge', 'recover', 'feed', 'vault', 'circle', 'stare', 'drag', 'growl', 'rest', 'pace', 'back', 'guard'],
    m: ['', 'watch', 'follow', 'wait', 'creep', 'rush', 'fade', 'cornered', 'lightfail', 'stare', 'back', 'circle', 'block', 'hold'],
  },
  setTables(t) { if (t && t.s && t.h && t.m) E.tab = t; },
};
const API = () => window.__api;
/* the game's own (single-player) code and its audio cues know the monsters by these older names */
const HLS = { HUNTING: 'chase', STALKING: 'stalk', SEARCHING: 'search', CURIOUS: 'investigate', ALERT: 'investigate', FRUSTRATED: 'search' };
const SLS = { WATCHING: 'watch', FOLLOWING: 'stalk', STALKING: 'stalk', PROVOKED: 'pursue', ATTACKING: 'pursue', PLAYING: 'pursue' };

/* ---------------------------------------------------------------- snapshot -> slot objects (smoothed for display) */
E.slotH = function (o, t, dt) {
  const k = 1 - Math.exp(-dt * 15), px = o.x, py = o.y;
  if (Math.hypot(t.x - o.x, t.y - o.y) > 260) { o.x = t.x; o.y = t.y; o.angle = t.a; }
  else { o.x += (t.x - o.x) * k; o.y += (t.y - o.y) * k; }
  o.angle += angDiff(t.a, o.angle) * (1 - Math.exp(-dt * 14));
  o.distance += Math.hypot(o.x - px, o.y - py);
  o.state = E.tab.s[t.s] || 'ROAMING'; o.ls = HLS[o.state] || 'patrol'; o.act = E.tab.h[t.ac] || ''; o.v = t.v; o.head = t.h; o.lunge = t.l; o.tg = t.tg; o.cp = t.cp; o.pack = t.k; o.net = 1;
};
E.slotS = function (o, t, dt) {
  const k = 1 - Math.exp(-dt * 12), px = o.x, py = o.y;
  if (Math.hypot(t.x - o.x, t.y - o.y) > 260) { o.x = t.x; o.y = t.y; o.angle = t.a; }
  else { o.x += (t.x - o.x) * k; o.y += (t.y - o.y) * k; }
  o.angle += angDiff(t.a, o.angle) * (1 - Math.exp(-dt * 10));
  o.distance = (o.distance || 0) + Math.hypot(o.x - px, o.y - py);
  o.state = E.tab.s[t.s] || 'HIDDEN'; o.ls = SLS[o.state] || 'lurk'; o.act = E.tab.m[t.ac] || ''; o.v = t.v; o.face = t.f; o.head = t.h; o.tg = t.tg; o.cp = t.cp; o.lit = t.lt; o.special = t.sp; o.net = 1; o.sid = t.i;
};

/* ---------------------------------------------------------------- HOUND: a distorted humanoid on all fours
 * Narrow torso, elongated limbs with real elbows and knees (two-bone IK), hands and feet planted on the floor, a head that
 * hangs and jerks under stringy dark hair.  Local space: forward is -y, +x is the entity's right. */
const HC = { line: 0x0d0b0a, skin: 0x453e38, skinHi: 0x7b6f61, limb: 0x37312c, limbHi: 0x6f6456, bone: 0xc4b89f, hair: 0x080706, hair2: 0x1b1917, mouth: 0x140506, tooth: 0xddd4bd, gum: 0x552126, eye: 0xaea690 };
const ANC = { fl: { x: -12, y: -19 }, fr: { x: 12, y: -19 }, rl: { x: -9, y: 22 }, rr: { x: 9, y: 22 } };     // shoulders and hips
const NEU = { fl: { x: -23, y: -76 }, fr: { x: 23, y: -76 }, rl: { x: -29, y: 57 }, rr: { x: 29, y: 57 } };   // where the hands and feet come down (hands well ahead of the head, feet behind the hips)
const PHASE = { fl: 0, rr: .07, fr: .48, rl: .61 };                                                              // diagonal gait
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
  const P = { hand: {}, lift: {}, hx: Math.sin(t * .8 + S.seed) * 1.6, hy: -44 + Math.sin(t * 1.3 + S.seed) * 1.2, hr: (g.head || 0) * .9 + S.hj, jaw: 0, sy: 1, sx: 1, bend: 0, crouch: 0, air: 0, whip: 0, lean: 0 };
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
    case 'stare': case 'guard': case 'growl': P.hr = (g.head || 0) * .5 + S.hj * .4; P.jaw = act === 'stare' ? .22 : .55; P.crouch = .25; break;
    case 'pace': P.hr = Math.sin(t * 6) * .6; P.jaw = .45; break;
  }
  return P;
};

E.paintHound = function (view, P, t, dt) {
  const S = gs(view), sh = view.shadow, bd = view.body, hd = view.head; S.paintDt = Math.min(.04, Math.max(0, dt || 0));
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
    const dragX = -S.vl * .05, dragY = S.vf * .065 * (i % 3 === 0 ? 1.15 : 1);
    const tx = base[0] + Math.cos(a) * L * .55 + sw + dragX, ty = base[1] + Math.sin(a) * L * .55 + 3 + dragY * 1;
    const strand = S.hair[i] || (S.hair[i] = { x: tx, y: ty, vx: 0, vy: 0 });
    const hdt = S.paintDt || 0, k = 13, decay = Math.exp(-k * hdt);
    const ex = strand.x - tx, ey = strand.y - ty, jx = strand.vx + k * ex, jy = strand.vy + k * ey;
    strand.x = tx + (ex + jx * hdt) * decay; strand.y = ty + (ey + jy * hdt) * decay;
    strand.vx = (strand.vx - k * jx * hdt) * decay; strand.vy = (strand.vy - k * jy * hdt) * decay;
    const hx2 = strand.x, hy2 = strand.y;
    const cx = (base[0] + hx2) / 2 + Math.sin(a) * 4 + sw * .4, cy = (base[1] + hy2) / 2 - Math.cos(a) * 3;
    hd.moveTo(base[0], base[1]).quadraticCurveTo(cx, cy, hx2, hy2).stroke({ color: i % 4 === 0 ? HC.hair2 : HC.hair, width: 1.7 + (i % 3) * .55, cap: 'round' });
  }
}

E.drawHound = function (view, g, t, dt) {
  if (!view.__hound) E.initHound(view);
  const P = E.poseHound(view, g, t, dt);
  E.paintHound(view, P, t, dt);
};
/* the kill: forelimbs hooked forward, jaws wide, the body slung low over the victim.  grip/impact come from the death timeline */
E.attackHound = function (view, grip, impact, variant) {
  if (!view.__hound) E.initHound(view);
  const S = gs(view), t = performance.now() / 1000, reach = 68 + grip * 6 - impact * 6;
  const P = { hand: { fl: { x: -15 - impact * 4, y: -reach }, fr: { x: 15 + impact * 4, y: -reach }, rl: { x: -23, y: 40 }, rr: { x: 23, y: 40 } }, lift: { fl: 1, fr: 1, rl: .1, rr: .1 },
    hx: Math.sin(t * 24) * impact * 3, hy: -47 + impact * 5, hr: Math.sin(t * 19) * impact * .5, jaw: clamp(.6 + grip * .4 + impact * .3, 0, 1), sy: 1.1 - impact * .1, sx: 1, bend: Math.sin(t * 30) * impact * 4, crouch: .5, air: 0, whip: 1, lean: 0 };
  if (variant === 'B') { P.hand.fl = { x: -30, y: -50 }; P.hand.fr = { x: 22, y: -62 }; P.bend = 7 + Math.sin(t * 12) * 2; }
  if (variant === 'D') { P.hand.fl = { x: -20, y: -64 }; P.hand.fr = { x: 20, y: -64 }; P.crouch = .7; P.hy = -42; }
  E.paintHound(view, P, t, .016);
};

/* ---------------------------------------------------------------- SMILER: darkness with a face
 * A drifting mass of black with long limp arms.  What you remember is the grin: a huge crescent of teeth and two glowing eyes,
 * drawn again on the darkness layer (E.smilerGlow) so it can be seen at the edge of the dark even where nothing lights the body. */
const SC = { black: 0x030404, black2: 0x0a0c0b, rim: 0x1b201d, glow: 0xf1f4dc, glow2: 0xdfe6c8, gap: 0x0a0d0b };
E.initSmiler = function (view) {
  const Gf = view.body.constructor;
  view.removeChildren();
  view.mist = new Gf(); view.arms = new Gf(); view.body = new Gf(); view.face = new Gf();
  view.addChild(view.mist, view.arms, view.body, view.face);
  view.__smiler = true; view.__s = { seed: Math.random() * 100, fx: 0, ex: 0 };
};

/* the mouth: an exaggerated crescent, upper and lower rows of teeth.  g draws with the PIXI or canvas API through small callbacks */
function grinShape(f) {                    // f: 0..1 how far the face has formed
  const gw = 15 + 9 * f, depth = 7 + 15 * f;
  return { gw, depth, n: 11 };
}
function paintFace(gfx, f, t, alpha, seed) {
  gfx.clear();
  const S = grinShape(f), gw = S.gw, dp = S.depth, a = alpha;
  gfx.ellipse(0, -3, 19, 20).fill({ color: SC.black, alpha: .98 }).stroke({ color: SC.rim, width: 1.4, alpha: .6 });
  // eyes: tall, slightly slanted, brighter as the face forms
  const ew = 2.3 + .9 * f, eh = 4.6 + 2.6 * f;
  for (const sx of [-1, 1]) {                                                    // tall, narrow, leaning in: no pupils, nothing behind them
    const ex = sx * 8.6, ey = -10.5, sl = sx * .16, tilt = (x, y) => [ex + x * Math.cos(sl) - y * Math.sin(sl), ey + x * Math.sin(sl) + y * Math.cos(sl)];
    const ring = (k, n = 14) => { const o = []; for (let i = 0; i < n; i++) { const t = i / n * TAU, p = tilt(Math.cos(t) * (ew + k), Math.sin(t) * (eh + k)); o.push(p[0], p[1]); } return o; };
    gfx.poly(ring(2.2)).fill({ color: SC.glow, alpha: .12 * a });
    gfx.poly(ring(.9)).fill({ color: SC.glow, alpha: .3 * a });
    gfx.poly(ring(0)).fill({ color: SC.glow, alpha: a });
  }
  // the grin
  const top = x => 1 + (1 - Math.pow(x / gw, 2)) * 2.5, bot = x => 1 + (1 - Math.pow(x / gw, 2)) * dp;
  const pts = []; for (let i = 0; i <= 16; i++) { const x = -gw + i / 16 * 2 * gw; pts.push(x, top(x)); } for (let i = 16; i >= 0; i--) { const x = -gw + i / 16 * 2 * gw; pts.push(x, bot(x)); }
  gfx.poly(pts).fill({ color: SC.glow, alpha: a });
  gfx.moveTo(-gw, 1).quadraticCurveTo(0, 1 + (top(0) - 1) * 2 + (bot(0) - top(0)) * .0, gw, 1).stroke({ color: SC.glow2, width: 1.6, alpha: a });
  // the line where the rows meet is a zig-zag of interlocking points; thin gaps separate the teeth
  const mid = x => (top(x) + bot(x)) / 2, N2 = S.n * 2;
  const zz = []; for (let i = 0; i <= N2; i++) { const x = -gw + i / N2 * 2 * gw, m = mid(x), amp = 1.5 + .6 * f; zz.push([x, m + (i % 2 ? amp : -amp)]); }
  gfx.moveTo(zz[0][0], zz[0][1]); for (let i = 1; i < zz.length; i++) gfx.lineTo(zz[i][0], zz[i][1]); gfx.stroke({ color: SC.gap, width: 1.1, alpha: .85 * a, join: 'miter' });
  for (let i = 1; i < S.n; i++) {
    const x = -gw + i / S.n * 2 * gw;
    gfx.moveTo(x, top(x) + .4).lineTo(x + Math.sin(i * 2.3) * .4, mid(x) - 1.4).stroke({ color: SC.gap, width: .8, alpha: .6 * a });
    gfx.moveTo(x + .5, mid(x) + 1.4).lineTo(x + .2, bot(x) - .4).stroke({ color: SC.gap, width: .8, alpha: .6 * a });
  }
}

E.drawSmiler = function (view, sm_, t, dt, vis, o) {
  if (!view.__smiler) E.initSmiler(view);
  const S = view.__s, f = clamp(sm_.face === undefined ? (sm_.state === 'watch' || sm_.state === 'pursue' ? 1 : .7) : sm_.face, 0, 1);
  S.fx += (f - S.fx) * (1 - Math.exp(-dt * 6));
  const ff = S.fx, dark = 1 - clamp(vis, 0, 1);
  // mist / darkness: soft black blobs drifting around the body
  const mg = view.mist; mg.clear();
  for (let i = 0; i < 8; i++) {
    const a = t * (.25 + (i % 3) * .07) + i * 2.1 + S.seed, r = 10 + (i % 4) * 5;
    mg.ellipse(Math.cos(a) * r * 1.4, 6 + Math.sin(a * 1.2) * r, 15 + (i % 3) * 5, 11 + (i % 2) * 6).fill({ color: SC.black, alpha: .1 + .04 * (i % 3) });
  }
  // long limp arms, swaying slowly; fingers far too long
  const ag = view.arms; ag.clear();
  const sway = Math.sin(t * .8 + S.seed) * 4, reach = sm_.act === 'rush' || sm_.state === 'PROVOKED' ? -14 : 0;
  for (const sx of [-1, 1]) {
    const bx = sx * 22, sw = sway * sx;
    const ex = sx * (38 + sw * .4), ey = 22 + reach, hx2 = sx * (46 + sw), hy2 = 56 + reach * 1.5 + Math.sin(t * 1.1 + sx) * 3;
    ag.moveTo(bx, -2).quadraticCurveTo(ex + sx * 8, ey - 8, hx2, hy2).stroke({ color: SC.black, width: 8, cap: 'round' });
    ag.moveTo(bx, -2).quadraticCurveTo(ex + sx * 8, ey - 8, hx2, hy2).stroke({ color: SC.black2, width: 3.6, cap: 'round', alpha: .8 });
    for (let k = 0; k < 5; k++) { const fa = Math.PI / 2 + sx * (-.55 + k * .28) + Math.sin(t * 1.3 + k) * .08, fl = 15 + (k % 2) * 4; ag.moveTo(hx2, hy2).lineTo(hx2 + Math.cos(fa) * fl, hy2 + Math.sin(fa) * fl).stroke({ color: SC.black2, width: 1.5, cap: 'round' }); }
  }
  // the body: a tall black mass, shoulders, a hint of legs
  const bg = view.body; bg.clear();
  bg.ellipse(0, 12, 21, 30).fill({ color: SC.black, alpha: .97 });
  bg.ellipse(0, -2, 31, 12).fill({ color: SC.black, alpha: .97 });
  bg.poly([-8, 30, -13, 58, -7, 60, -1, 34, 2, 34, 8, 60, 14, 57, 9, 30]).fill({ color: SC.black2, alpha: .9 });
  bg.ellipse(-6, 4, 6, 14).fill({ color: SC.rim, alpha: .16 });
  const bodyAlpha = clamp(.12 + sm(.18, .78, vis) * .88, 0, 1);
  bg.alpha = bodyAlpha; ag.alpha = bodyAlpha * .9; view.mist.alpha = .35 + dark * .4;
  // face
  const fa = clamp(.18 + ff * .82, 0, 1);
  paintFace(view.face, ff, t, .94 * fa, S.seed);
  view.face.alpha = 1;
  view.face.rotation = (sm_.act === 'watch' || sm_.state === 'WATCHING' ? Math.sin(t * 1.35 + S.seed) * .05 : Math.sin(t * 3.4 + S.seed) * .014) + (sm_.head || 0) * .25;
  view.face.position.set(0, -6 - ff * 2);
  const grow = 1 + ff * .12 + (sm_.special ? .08 * Math.sin(t * 9) : 0);
  view.face.scale.set(grow, grow * (1 + .06 * Math.sin(t * 2.2 + S.seed)));
};

/* the glow on the darkness layer (canvas 2D, world transform already applied and clipped to the player's line of sight) */
E.smilerGlow = function (n, view, sm_, t, pl, k) {
  const d = Math.hypot(view.x - pl.x, view.y - pl.y), f = clamp(view.__s ? view.__s.fx : (sm_.face === undefined ? .8 : sm_.face), 0, 1);
  const a = view.alpha, blk = window.__api && window.__api.V && window.__api.V.blackout ? 1.25 : 1;
  const i = (1 - sm(200, 1100, d)) * (.2 + .72 * (1 - a)) * Math.min(1, .25 + a * 2.8) * (.14 + .86 * f) * blk;
  if (i < .004) return;
  const flick = Math.sin(t * 43 + view.x) > .985 ? .55 : 1;
  const S = grinShape(f), gw = S.gw, dp = S.depth, top = x => 1 + (1 - Math.pow(x / gw, 2)) * 2.5, bot = x => 1 + (1 - Math.pow(x / gw, 2)) * dp;
  n.save(); n.translate(view.x, view.y); n.rotate(view.rotation); n.scale(view.scale.x, view.scale.y);
  n.translate(0, -6 - f * 2); const gr = 1 + f * .12; n.scale(gr, gr);
  n.globalAlpha = Math.min(1, i * flick); n.shadowColor = '#edffe7'; n.shadowBlur = 5 + 10 * f * (k || 1); n.fillStyle = '#f2f5df';
  const ew = 2.3 + .9 * f, eh = 4.6 + 2.6 * f;
  for (const sx of [-1, 1]) { n.beginPath(); n.ellipse(sx * 8.6, -10.5, ew, eh, sx * .16, 0, TAU); n.fill(); }
  n.beginPath(); n.moveTo(-gw, top(-gw));
  for (let q = 0; q <= 16; q++) { const x = -gw + q / 16 * 2 * gw; n.lineTo(x, top(x)); }
  for (let q = 16; q >= 0; q--) { const x = -gw + q / 16 * 2 * gw; n.lineTo(x, bot(x)); }
  n.closePath(); n.fill();
  n.shadowBlur = 0; n.strokeStyle = 'rgba(8,10,8,.85)'; n.lineWidth = 1.05; n.lineJoin = 'miter';
  const N2 = S.n * 2, amp = 1.5 + .6 * f;
  n.beginPath(); for (let q = 0; q <= N2; q++) { const x = -gw + q / N2 * 2 * gw, y = (top(x) + bot(x)) / 2 + (q % 2 ? amp : -amp); q ? n.lineTo(x, y) : n.moveTo(x, y); } n.stroke();
  for (let q = 1; q < S.n; q++) { const x = -gw + q / S.n * 2 * gw; n.beginPath(); n.moveTo(x, top(x)); n.lineTo(x, bot(x)); n.stroke(); }
  n.restore();
};

/* ---------------------------------------------------------------- how a death plays out: four variants per killer
 * The server decides which one (ai.js: variant A-D, and the real wall behind the victim for the hound's wall impact).  Here they only
 * change the choreography of the death sequence: how far the body is knocked, whether it is dragged, when the blows land, whether
 * the world blacks out.  Nothing is teleported: every distance is limited by the level's own geometry in the bundle (safeDistance). */
E.deathPlan = function (jl, kind, K) {
  const v = K && /^[ABCD]$/.test(K.v) ? K.v : 'A';
  const wall = K && K.w && K.w.length === 3 ? { x: K.w[0], y: K.w[1], ang: K.w[2] } : null;
  const P = { v, wall, kn: 34, dr: kind === 'Hound' ? 128 : 86, hits: null, kt: [.08, .36], dw: [2.03, 3.12], spin: 1.65, squish: 1, black: null };
  if (kind === 'Hound') {
    if (v === 'A') { P.kn = 46; P.dr = 40; P.hits = [.2, .62, 1.05, 1.55]; P.spin = 1.9; }                               // at the throat: knocked hard, held down
    else if (v === 'B') { P.kn = 12; P.dr = 140; P.hits = [.3, .85, 1.5, 2.1]; P.dw = [.9, 2.2]; P.spin = 1.2; }             // pulled down and dragged away
    else if (v === 'C') {                                                                                                  // slammed into a wall that is really there
      const d = wall ? Math.hypot(wall.x - jl.victim.x, wall.y - jl.victim.y) : 40;
      P.kn = clamp(d - 17, 0, 110); P.dr = 0; P.kt = [.04, .2]; P.hits = [.2, .21, .8, 1.4]; P.spin = 2.2;
    } else { P.kn = 24; P.dr = 26; P.hits = [.45, .95, 1.55]; P.spin = .3; P.squish = 1.9; }                                // D: nothing left, goes down in a heap
  } else {
    if (v === 'B') { P.kn = 0; P.dr = 0; P.hits = [.7, 1.2, 1.7]; P.spin = 1.4; P.black = t => sm(.05, .12, t) * (1 - sm(.85, 1.6, t)); }   // cornered: it closes, everything goes black, the body falls where it stood
    else if (v === 'C') { P.kn = 18; P.dr = 36; P.hits = [.55, 1.1, 1.6]; P.black = t => sm(.02, .07, t) * (1 - sm(.4, .9, t)) * .8; }         // the lights failed: the last dark
    else if (v === 'D') { P.kn = 26; P.dr = 70; P.hits = [.6, 1.2, 1.8]; P.dw = [1.6, 3.0]; }                                                // it has played long enough
  }
  return P;
};

/* extra marks a variant leaves on the floor (drawn into the same Graphics as the blood, after it) */
const hsh = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
E.deathExtras = function (g, jl, t) {
  if (jl.kind !== 'Hound' || jl.variant !== 'C' || !jl.wall) return;
  const at = jl.kt[1] * .9; if (t < at) return;
  const w = jl.wall, back = w.ang + Math.PI, k = clamp((t - at) / .55, 0, 1), fresh = 1 - clamp((t - .2) / 9, 0, 1), col = fresh > .5 ? 0x7a1512 : 0x4a0b0a;
  const px = -Math.sin(w.ang), py = Math.cos(w.ang);
  // where the body struck: a wet smear running along the base of the wall, and spray thrown back off it
  g.moveTo(w.x - px * 16 - Math.cos(w.ang) * 3, w.y - py * 16 - Math.sin(w.ang) * 3).lineTo(w.x + px * 16 - Math.cos(w.ang) * 3, w.y + py * 16 - Math.sin(w.ang) * 3).stroke({ color: col, width: 6, alpha: .5 * k, cap: 'round' });
  for (let i = 0; i < 20; i++) {
    const a = back + (hsh(i, 1) - .5) * 1.7, d = (6 + hsh(i, 2) * 50) * k, s = .9 + hsh(i, 3) * 2.4, x = w.x + Math.cos(a) * d, y = w.y + Math.sin(a) * d;
    g.ellipse(x, y, s * (1 + .8 * hsh(i, 4)), s).fill({ color: hsh(i, 5) < .5 ? 0x7a1512 : 0x4a0b0a, alpha: .85 });
    if (k < 1) g.moveTo(x, y).lineTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6).stroke({ color: 0xa3201a, width: 1.3, alpha: .7 * (1 - k) });
  }
  // a run of blood from the wall down to where the body ended up
  const jx = jl.body.x, jy = jl.body.y, len = Math.hypot(jx - w.x, jy - w.y);
  if (len > 4) g.moveTo(w.x, w.y).lineTo(jx, jy).stroke({ color: 0x5c0f0c, width: 9, alpha: .34 * k, cap: 'round' });
};

/* the smiler that attacks in a death sequence: fully formed, arms reaching */
E.attackSmiler = function (view, t, dt) {
  E.drawSmiler(view, { state: 'ATTACKING', act: 'rush', face: 1, head: 0, special: 1 }, t, dt || .016, 1);
};

/* ---------------------------------------------------------------- offline (no server): the same variety, chosen from the geometry around the victim */
const kHist = {};
function wallBehind(A, x, y, a, maxD) {
  const d = A.Uc(x, y, a, maxD + 40); if (d < 55 || d > maxD) return null;
  if (A.Uc(x, y, a + .5, maxD + 40) < 45 || A.Uc(x, y, a - .5, maxD + 40) < 45) return null;
  return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, ang: a };
}
function openFrac(A, x, y, R) { let open = 0; const n = 24; for (let i = 0; i < n; i++) if (A.Uc(x, y, i / n * TAU, R) >= R - 6) open++; return open / n; }
E.localKill = function (kind, H, src) {
  const A = API(); if (!A || !A.Uc) return { v: 'A', k: kind, w: 0 };
  const ang = Math.atan2(H.y - src.y, H.x - src.x), rel = Math.abs(angDiff(ang, H.angle)), facing = rel > 2.0, behind = rel < 1.0;
  let items, wall = null;
  if (kind === 'Hound') {
    wall = wallBehind(A, H.x, H.y, ang, 128); const exhausted = H.stamina < 22 || H.exhausted;
    items = [{ k: 'A', w: facing ? 1.5 : .55 }, { k: 'B', w: .95 * (behind ? 1.25 : 1) }, { k: 'C', w: wall ? 1.7 : 0 }, { k: 'D', w: exhausted ? 3.2 * (behind ? 1.3 : .6) : 0 }];
  } else {
    const cornered = openFrac(A, H.x, H.y, 380) < .34;
    items = [{ k: 'A', w: 2 }, { k: 'B', w: cornered ? 3 : 0 }, { k: 'C', w: 0 }, { k: 'D', w: 0 }];
  }
  const hist = kHist[kind] || (kHist[kind] = []);
  for (const it of items) { const i = hist.lastIndexOf(it.k); if (i >= 0) { const age = hist.length - i; it.w *= age === 1 ? .35 : age === 2 ? .6 : .8; } }
  let tot = 0; for (const it of items) tot += Math.max(0, it.w);
  let r = Math.random() * tot, v = 'A'; for (const it of items) { if (it.w <= 0) continue; v = it.k; r -= it.w; if (r <= 0) break; }
  hist.push(v); if (hist.length > 6) hist.shift();
  return { v, k: kind, w: v === 'C' && wall ? [wall.x, wall.y, wall.ang] : 0 };
};

/* ---------------------------------------------------------------- entity sound (procedural, positional, muffled through walls) */
let actx = null, aout = null, nbuf = null, lastZ = null;
function Zc() {
  const a = API(); if (!a || !a.audio) return null; const Z = a.audio(); if (!Z || !Z.context || !Z.gain) return null;
  if (actx !== Z.context) { actx = Z.context; aout = Z.gain; nbuf = null; }
  if (!nbuf) { nbuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return Z;
}
const soundOn = () => !(document.getElementById('sound') && /OFF/.test(document.getElementById('sound').textContent));
/* where a sound at (x,y) lands: distance falloff, stereo pan, and a low-pass when there is a wall in between */
function place(x, y, near = 120, far = 1500) {
  const a = API(), H = a.H, dx = x - H.x, dy = y - H.y, d = Math.hypot(dx, dy);
  let g = Math.pow(1 - sm(near, far, d), 1.5), lp = 9000;
  if (d > 60 && a.Uc) { const r = a.Uc(H.x, H.y, Math.atan2(dy, dx), d + 1); if (r < d - 30) { g *= .5; lp = 700; } }
  return { d, g, pan: clamp(dx / 520, -1, 1) * .85, lp };
}
function node(dur, o) {
  const c = actx, t0 = c.currentTime + (o.when || 0), g = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null, lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = o.lp || 9000; g.gain.value = 1;
  const tail = pn ? (pn.pan.value = o.pan || 0, g.connect(lp), lp.connect(pn), pn) : (g.connect(lp), lp);
  tail.connect(aout); return { c, t0, g, out: g, dur, stop: t0 + dur + .08 };
}
function env(g, t0, atk, hold, dur, v) { g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + atk); g.gain.setValueAtTime(v, t0 + atk + hold); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); }
/* a tremble in series with a layer: its level swings between (1 - d) and 1 at f Hz, so the layer's own envelope still fades it all the way out */
function tremble(n, mod) {
  const c = n.c, tg = c.createGain(), l = c.createOscillator(), lg = c.createGain(); tg.gain.value = 1 - mod.d * .5; lg.gain.value = mod.d * .5;
  l.frequency.value = mod.f; l.connect(lg); lg.connect(tg.gain); l.start(n.t0); l.stop(n.stop); return tg;
}
function noiseLayer(n, type, f, q, vol, atk, hold, f2, mod) {
  const c = n.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = nbuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, n.t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, n.t0 + n.dur); fl.Q.value = q;
  env(g, n.t0, atk, hold, n.dur, vol);
  s.connect(fl); let last = fl; if (mod) { const tg = tremble(n, mod); fl.connect(tg); last = tg; }
  last.connect(g); g.connect(n.out); s.start(n.t0, Math.random() * 1.5); s.stop(n.stop);
}
function toneLayer(n, type, f, f2, vol, atk, hold, mod, filt) {
  const c = n.c, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, n.t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, n.t0 + n.dur); env(g, n.t0, atk, hold, n.dur, vol);
  let last = o; if (filt) { const fl = c.createBiquadFilter(); fl.type = filt.type; fl.frequency.value = filt.f; fl.Q.value = filt.q || 1; o.connect(fl); last = fl; }
  if (mod) { const tg = tremble(n, mod); last.connect(tg); last = tg; }
  last.connect(g); g.connect(n.out); o.start(n.t0); o.stop(n.stop);
}
const play = (x, y, vol, dur, build, opt) => {
  if (!soundOn() || !Zc()) return; const p = place(x, y, opt && opt.near, opt && opt.far); if (p.g < .01) return;
  const n = node(dur, { pan: p.pan, lp: Math.min(p.lp, opt && opt.lp || 9000) }); const v = vol * p.g; build(n, v, p);
};

/* hound voice: never a dog.  a wet, low, human-throated rasp with a slow tremble */
E.houndVoice = function (x, y, type, I) {
  I = I === undefined ? .7 : I;
  if (type === 'growl' || type === 'guard') play(x, y, .5 * I + .12, type === 'guard' ? 1.5 : 1.0, (n, v) => {
    toneLayer(n, 'sawtooth', 92, 58, v * .5, .08, .25, { f: 23, d: .55 }, { type: 'lowpass', f: 380, q: 3 });
    toneLayer(n, 'sawtooth', 138, 84, v * .18, .1, .2, { f: 31, d: .6 }, { type: 'bandpass', f: 640, q: 4 });
    noiseLayer(n, 'bandpass', 380, 1.4, v * .55, .05, .3, 200, { f: 19, d: .7 });
  });
  else if (type === 'snarl') play(x, y, .42 * I + .1, .55, (n, v) => {
    noiseLayer(n, 'bandpass', 900, 2.2, v * .8, .02, .12, 380, { f: 27, d: .8 });
    toneLayer(n, 'sawtooth', 120, 70, v * .32, .03, .1, { f: 34, d: .6 }, { type: 'lowpass', f: 520, q: 2 });
  });
  else if (type === 'lungecue') play(x, y, .62 * I + .1, .5, (n, v) => {
    noiseLayer(n, 'bandpass', 500, 1.1, v * .6, .015, .05, 1800);                                        // the sharp intake / hiss
    toneLayer(n, 'sawtooth', 70, 150, v * .5, .04, .16, { f: 26, d: .5 }, { type: 'lowpass', f: 700, q: 2 });
  }, { far: 1700 });
  else if (type === 'kill') play(x, y, .8, 1.3, (n, v) => {
    toneLayer(n, 'sawtooth', 82, 46, v * .55, .05, .5, { f: 21, d: .7 }, { type: 'lowpass', f: 420, q: 3 });
    noiseLayer(n, 'bandpass', 620, 1.2, v * .5, .04, .5, 220, { f: 14, d: .9 });
    noiseLayer(n, 'lowpass', 900, .7, v * .35, .2, .3, 250);
  }, { far: 1900 });
};
/* footfalls: hands and feet landing on damp carpet - a soft thud and a drag */
E.houndStep = function (x, y, spd, limb) {
  const v = clamp(.12 + spd / 420, .1, .62);
  play(x, y, v, .16, (n, vv) => {
    toneLayer(n, 'sine', 78 + Math.random() * 14, 44, vv * .9, .004, .012, null);
    noiseLayer(n, 'bandpass', 1400 + Math.random() * 500, .9, vv * .35, .004, .02, 500);
  }, { far: 1000 });
};
E.houndBreath = function (x, y, hard) {
  play(x, y, .14 + .14 * hard, .55 - .2 * hard, (n, v) => {
    noiseLayer(n, 'bandpass', 460, .8, v, .12, .08, 1100);
    toneLayer(n, 'sawtooth', 58 + hard * 20, 44, v * .12, .1, .1, { f: 18, d: .6 }, { type: 'lowpass', f: 260, q: 2 });
  }, { far: 900 });
};
E.houndScrape = function (x, y) { play(x, y, .3, .5, (n, v) => noiseLayer(n, 'bandpass', 1600, 1.4, v, .05, .2, 700, { f: 9, d: .6 }), { far: 800 }); };

/* smiler: restraint.  almost nothing - a very low swell when the face forms, a wet click, a tone that rises during a rush */
E.smilerVoice = function (x, y, type) {
  if (type === 'form') play(x, y, .3, 1.6, (n, v) => {
    toneLayer(n, 'sine', 58, 49, v * .75, .6, .5, { f: 3, d: .25 });                    // felt more than heard: a swell low enough to sit under everything
    toneLayer(n, 'triangle', 116, 98, v * .2, .7, .4, { f: 3, d: .3 });                  // ... with a thin overtone so small speakers carry it too
    noiseLayer(n, 'bandpass', 3200, 6, v * .08, .5, .3, 2800);
  }, { far: 1100 });
  else if (type === 'click') play(x, y, .18, .09, (n, v) => noiseLayer(n, 'bandpass', 2400, 8, v, .002, .01, 1400), { far: 700 });
  else if (type === 'rush') play(x, y, .5, 1.4, (n, v) => {
    toneLayer(n, 'sawtooth', 55, 165, v * .3, .2, .5, { f: 9, d: .5 }, { type: 'lowpass', f: 500, q: 3 });
    noiseLayer(n, 'bandpass', 900, 2, v * .2, .3, .5, 2600);
  }, { far: 1500 });
  else if (type === 'blackout') play(x, y, .4, .5, (n, v) => {                          // a lamp dying: the ballast's snap and a low thunk
    toneLayer(n, 'sine', 120, 46, v, .004, .07);
    noiseLayer(n, 'bandpass', 2600, 4, v * .5, .002, .012, 700);
  });
};

/* the player being held: the thud of the knock-down, gasps, dragging */
E.sfxKnock = function () {
  if (!soundOn() || !Zc()) return; const n = node(.8, { pan: 0, lp: 3000 });
  toneLayer(n, 'sine', 90, 34, .9, .004, .06); noiseLayer(n, 'lowpass', 700, .8, .6, .004, .05, 180); noiseLayer(n, 'bandpass', 1500, 1, .2, .01, .04, 500);
};
E.sfxGasp = function () { if (!soundOn() || !Zc()) return; const n = node(.6, { pan: 0, lp: 5000 }); noiseLayer(n, 'bandpass', 800, .9, .3, .12, .1, 1900); };
E.sfxRelease = function () { if (!soundOn() || !Zc()) return; const n = node(.7, { pan: 0, lp: 2500 }); toneLayer(n, 'sine', 60, 40, .4, .01, .1); noiseLayer(n, 'bandpass', 500, 1, .22, .06, .1, 900); };

/* per-frame voice of every entity that is near: breathing, footfalls, the smiler's face forming */
const AS = { hb: [0, 0, 0], sb: [], sf: [0, 0, 0, 0, 0], ss: new Map() };
E.entAudio = function (dt, hounds, smilers) {
  const a = API(); if (!a || !soundOn() || !Zc()) return; const H = a.H;
  hounds.forEach((o, i) => {
    if (!o || o.x < -1e4) return; const g = o.__ga || (o.__ga = { br: rnd(0, 1), sc: 0, ph: [0, 0, 0, 0] });
    const d = Math.hypot(o.x - H.x, o.y - H.y);
    // footfalls follow the ground covered (heard whether or not it can be seen): a hand or foot lands every half stride
    const dd = g.dist === undefined || Math.abs(o.distance - g.dist) > 300 ? 0 : o.distance - g.dist; g.dist = o.distance;
    const spd = dd / Math.max(dt, .001), stride = lerp(56, 104, sm(60, 320, spd)) / 2;
    g.acc = (g.acc || 0) + dd; while (g.acc >= stride) { g.acc -= stride; if (d < 1100 && spd > 25) E.houndStep(o.x, o.y, spd, 0); }
    if (d > 1200) return;
    const act = o.act, hunting = o.state === 'HUNTING';
    g.br -= dt; if (g.br <= 0) { g.br = hunting ? rnd(.32, .5) : rnd(1.2, 2.3); E.houndBreath(o.x, o.y, hunting ? 1 : 0); }
    if ((act === 'recover' || act === 'drag') && (g.sc -= dt) <= 0) { g.sc = rnd(.35, .6); E.houndScrape(o.x, o.y); }
  });
  smilers.forEach((s, i) => {
    if (!s || s.off) return; const st = AS.ss.get(s) || (AS.ss.set(s, { f: 0, rush: false, click: 0 }), AS.ss.get(s));
    const f = s.face === undefined ? 0 : s.face, d = Math.hypot(s.x - H.x, s.y - H.y);
    if (d < 1300) {
      if (f > .55 && st.f <= .55) { E.smilerVoice(s.x, s.y, 'form'); E.smilerVoice(s.x, s.y, 'click'); }
      const rush = s.act === 'rush' || s.state === 'PROVOKED'; if (rush && !st.rush) E.smilerVoice(s.x, s.y, 'rush'); st.rush = rush;
    }
    st.f = f;
  });
};
/* touchdowns reported by the gait code */
E.footfall = function (o, spd, limb) { const d = Math.hypot(o.x - API().H.x, o.y - API().H.y); if (d < 1100 && spd > 25) E.houndStep(o.x, o.y, spd, limb); };

/* ---------------------------------------------------------------- admin-only AI debug overlay (never drawn for ordinary players)
 * Shows, for every entity the server sends: state / act, target, last known player position and how stale it is, vision range,
 * the last sound it heard, its search goal, its current path, mood, the capture decision, tier and how many players are near. */
E.dbg = null; E.dbgAt = 0;
E.setDebug = function (list) { E.dbg = list; E.dbgAt = performance.now(); };
let dbgCv = null;
/* its own canvas above the darkness layer: the overlay must be readable in the dark, and it exists only while an unlocked admin has it on */
function dbgCtx(on) {
  if (!on) { if (dbgCv && dbgCv.style.display !== 'none') dbgCv.style.display = 'none'; return null; }
  if (!dbgCv) { dbgCv = document.createElement('canvas'); dbgCv.id = 'aiDebug'; dbgCv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:8'; document.body.appendChild(dbgCv); }
  dbgCv.style.display = 'block'; const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (dbgCv.width !== W * dpr || dbgCv.height !== H * dpr) { dbgCv.width = W * dpr; dbgCv.height = H * dpr; }
  const c = dbgCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); return c;
}
E.drawDebug = function (cx0, view) {
  const list = E.dbg, on = !!(list && list.length && view), cx = dbgCtx(on); if (!on || !cx) return;
  const { cam, sc, W, H } = view, X = x => W / 2 + (x - cam.x) * sc, Y = y => H / 2 + (y - cam.y) * sc;
  cx.save(); cx.font = '11px ui-monospace,Consolas,monospace'; cx.textBaseline = 'top';
  const stale = performance.now() - E.dbgAt > 1500; cx.globalAlpha = stale ? .35 : 1;
  for (const d of list) {
    const col = d.k === 'hound' ? '#ff9a5c' : '#9fe8ff', x = X(d.x), y = Y(d.y);
    // vision radius (dashed) and body
    cx.strokeStyle = col; cx.lineWidth = 1; cx.setLineDash([5, 6]); cx.globalAlpha = (stale ? .35 : 1) * .35; cx.beginPath(); cx.arc(x, y, d.vr * sc, 0, TAU); cx.stroke(); cx.setLineDash([]);
    cx.globalAlpha = stale ? .35 : 1;
    cx.beginPath(); cx.arc(x, y, 5, 0, TAU); cx.fillStyle = col; cx.fill();
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(d.a) * 26 * sc, y + Math.sin(d.a) * 26 * sc); cx.stroke();
    // path
    if (d.path && d.path.length) { cx.strokeStyle = 'rgba(120,255,140,.8)'; cx.beginPath(); cx.moveTo(x, y); for (const p of d.path) cx.lineTo(X(p[0]), Y(p[1])); cx.stroke(); }
    // last known position of its target (with age) and the line to it
    if (d.lk) {
      const lx = X(d.lk.x), ly = Y(d.lk.y); cx.strokeStyle = d.lk.seen ? '#ff4d4d' : '#ffd24d'; cx.setLineDash([3, 4]); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(lx, ly); cx.stroke(); cx.setLineDash([]);
      cx.beginPath(); cx.rect(lx - 5, ly - 5, 10, 10); cx.stroke(); cx.fillStyle = cx.strokeStyle; cx.fillText('LKP ' + d.lk.age + 's c' + d.lk.c, lx + 8, ly - 5);
    }
    if (d.hr) { const hx = X(d.hr.x), hy = Y(d.hr.y); cx.strokeStyle = '#d68cff'; cx.beginPath(); cx.arc(hx, hy, 7, 0, TAU); cx.stroke(); cx.fillStyle = '#d68cff'; cx.fillText('HEARD ' + d.hr.ty + ' ' + d.hr.t + 's I' + d.hr.I, hx + 9, hy - 4); }
    if (d.sg) { const sx = X(d.sg.x), sy = Y(d.sg.y); cx.strokeStyle = '#7aa2ff'; cx.beginPath(); cx.moveTo(sx - 6, sy); cx.lineTo(sx + 6, sy); cx.moveTo(sx, sy - 6); cx.lineTo(sx, sy + 6); cx.stroke(); cx.fillStyle = '#7aa2ff'; cx.fillText('SEARCH', sx + 8, sy + 2); }
    // label block
    const lines = [`${d.k.toUpperCase()}#${d.i}  ${d.s}${d.ac && d.ac !== '-' ? '/' + d.ac : ''}  tier:${d.tier}`,
      `tgt:${d.tg || '-'}  v:${d.v}  near:${d.near}` + (d.lit !== undefined ? '  lit:' + d.lit : ''),
      `mood a${d.mood[0]} f${d.mood[1]} e${d.mood[2]} b${d.mood[3]}`];
    if (d.cp) lines.push(`CAPTURE ${d.cp.m}/${d.cp.ph} ${d.cp.v || ''} t${d.cp.t} next${d.cp.d} n${d.cp.n}`);
    if (d.cd) lines.push('decide: ' + Object.entries(d.cd).map(([k, v]) => k + ':' + v).join(' ').slice(0, 60));
    if (d.pu) lines.push('pursuit ' + (d.pu.blind !== undefined ? 'blind ' + d.pu.blind + 's' : 'seen'));
    const w = Math.max(...lines.map(l => cx.measureText(l).width)) + 10, h = lines.length * 13 + 6;
    cx.fillStyle = 'rgba(0,0,0,.66)'; cx.fillRect(x + 10, y - h - 6, w, h); cx.fillStyle = col;
    lines.forEach((l, i) => cx.fillText(l, x + 15, y - h - 3 + i * 13));
  }
  cx.globalAlpha = 1; cx.fillStyle = 'rgba(0,0,0,.7)'; cx.fillRect(W / 2 - 112, 6, 224, 22); cx.fillStyle = '#9dff9d'; cx.fillText('AI DEBUG · ' + list.length + ' ENTITIES  (admin)', W / 2 - 106, 11);
  cx.restore();
};

/* light failures the server announces: [x, y, r, seconds left] -> lamp dimming for the lighting pass */
E.fails = []; E.failsAt = 0;
E.setFails = function (list) {
  const had = E.fails.length; E.fails = (list || []).map(f => ({ x: f[0], y: f[1], r: f[2], until: performance.now() / 1000 + f[3] })); E.failsAt = performance.now();
  if (E.fails.length > had && E.onFail) E.onFail(E.fails[E.fails.length - 1]);
};
/* multiplier (0..1) for a lamp at (x,y): flickers hard while a failure is active near it */
E.lamp = function (x, y, t) {
  if (!E.fails.length) return 1; const now = performance.now() / 1000; let m = 1;
  for (const f of E.fails) { if (f.until < now) continue; const d = Math.hypot(x - f.x, y - f.y); if (d > f.r) continue; const k = 1 - sm(f.r * .55, f.r, d); const fl = Math.sin(t * 61 + x * .07) > .65 ? .5 : 0; m *= 1 - k * (.94 - fl * .5); }
  return m;
};
})();
