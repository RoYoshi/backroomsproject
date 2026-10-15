/** @part public/move.js - S.P.A.C.E.: the wanderer's survival movement: state, the other living Wanderers, collision, vaulting, sliding, the per-tick step; a module: moveCore
 * A module (continuation C3b, M-024): M8's part inside its factory, moveCore, after the opening of the script's wrapper, which this part
 * keeps. Its parameter is what it takes from the modules made before it, by giver; its return is what later modules take from it.
 * move.compose.js makes it. Every line is M8's except 5 listed edits (dev/stage-3h-modernization/tools/c3_client_modules.js): the
 * movement module keeps the sounds the sound module hands it; it plays them through what it was handed, not through the global object.
 * imports: -
 * exports: A, clamp, mv, SURF, useSound
 * provides: moveCore
 * uses: -
 * writes: -
 */
/* move.js - survival movement for the wanderer (v16).
 *
 * STAND / WALK / RUN / CROUCH / CRAWL / SLIDE / VAULT.  No jumping, no wall-running: this is a chase-and-hide game.
 *   Shift  run (drains stamina)         C  crouch / stand        C while running  slide (keeps your momentum, nothing more)
 *   walk into a low obstacle  -> vault (quality depends on speed, angle and stamina - never announced)
 *   crouch and walk into a hole in a wall or under low furniture -> automatic crawl
 * Stamina never switches a mechanic off: when it runs low you run slower, vault less gracefully, and breathe harder.
 * The server hears what you do (state + speed + a few discrete events) - see sim.js. */
(() => {
'use strict';
function moveCore() {
const W = window.WORLD, M = W.MOVE, S = W.S, SN = W.SN, SURF = W.SURF;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const A = () => window.__api;

const mv = {
  s: 'stand', t: 0, crouch: false, prevC: false, slide: null, slideCd: 0, recover: 0, vault: null, vaultCd: 0,
  push: 0, pushKey: '', exh: false, ev: [], down: 0, dragTo: null, tw: 0, downMode: '', prof: 1, breathT: 0, deficit: 0, lastRun: -99, surf: 'carpet', zone: null, q: 1, speed: 0,
  slideDist: 0, stamPrev: 100, hard: 0,
};
window.__mv = mv;
let sfx = null;                         // (C3b) Spacious Audio's movement sounds: move.sound.js hands them over when it is made
const useSound = s => { sfx = s; };

/* ---------------------------------------------------------------- state helpers */
function setState(s) { if (mv.s !== s) { mv.prev = mv.s; mv.s = s; mv.t = 0; } }
function reset() {
  Object.assign(mv, { s: 'stand', t: 0, crouch: false, prevC: false, slide: null, slideCd: 0, recover: 0, vault: null, vaultCd: 0, push: 0, exh: false, ev: [], down: 0, dragTo: null, tw: 0, downMode: '', prof: 1, breathT: 0, deficit: 0, zone: null, q: 1, speed: 0 });
  const a = A(); if (a) { a.H.exhausted = false; a.H.sprinting = false; }
}
mv.reset = reset;
mv.event = (c, v = 1) => { if (mv.ev.length < 6) mv.ev.push([c, Math.round(clamp(v, 0, 1) * 100)]); };
mv.take = () => { const e = mv.ev; mv.ev = []; return e; };

/* ---------------------------------------------------------------- the other living Wanderers (Stage 3D HQ2)
 * They are solid: two bodies never closer than D = 36 px, centre to centre (the drawn body).  mp.js keeps their latest server positions in
 * window.__peerBodies - empty offline, and while we are not in the world, dead or held - and the server checks every move we send by the
 * same rule.  Before the walls, our velocity loses the part that would take us within D of one this step; the part along it is kept, so
 * we slide round a body instead of stopping dead.  Nobody is pushed: only our own motion is constrained, and standing still nothing
 * happens.  The 0.75 px margin keeps the whole-pixel position we send from rounding into the server's limit.  With nobody there the step
 * is exactly the old one. */
const PEER_D = 36.75;
function peerProject(H, dt) {
  const P = window.__peerBodies; if (!P || !P.length || !(dt > 0)) return;
  let dx = H.vx * dt, dy = H.vy * dt; if (!dx && !dy) return;
  const ox = dx, oy = dy;
  for (let it = 0; it < 4; it++) for (let i = 0; i < P.length; i++) {
    const wx = H.x - P[i][0], wy = H.y - P[i][1], s0 = Math.hypot(wx, wy); if (s0 < 1e-6) continue;    // (stacked exactly: any way out)
    const nx = wx / s0, ny = wy / s0, room = s0 > PEER_D ? s0 - PEER_D : 0, dn = dx * nx + dy * ny;
    if (-dn > room) { const k = -dn - room; dx += nx * k; dy += ny * k; }
  }
  if (!peerFree(H.x, H.y, H.x + dx, H.y + dy, P)) {                       // wedged between bodies (a crowd's corners): as far along it as is free
    let lo = 0, hi = 1; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (peerFree(H.x, H.y, H.x + dx * m, H.y + dy * m, P)) lo = m; else hi = m; }
    dx *= lo; dy *= lo;
  }
  if (dx !== ox || dy !== oy) { H.vx = dx / dt; H.vy = dy / dt; }
}
function peerFree(x0, y0, x, y, P) {                                       // never closer to anyone than we already are, nor than D
  for (const q of P) { const s0 = Math.hypot(x0 - q[0], y0 - q[1]); if (Math.hypot(x - q[0], y - q[1]) < Math.min(s0, PEER_D) - 1e-9) return false; }
  return true;
}
/* a vault over a low obstacle is a fixed path with no collision: it does not start when a living Wanderer is on the landing or in the way
 * over (closer than D to the path than they already are) - it bumps, like a wall */
function peerOnPath(x0, y0, x1, y1) {
  const P = window.__peerBodies; if (!P || !P.length) return false;
  const dx = x1 - x0, dy = y1 - y0, dd = dx * dx + dy * dy;
  for (const q of P) {
    const s0 = Math.hypot(x0 - q[0], y0 - q[1]); if (Math.hypot(x1 - q[0], y1 - q[1]) < PEER_D) return true;
    let t = dd ? ((q[0] - x0) * dx + (q[1] - y0) * dy) / dd : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    if (Math.hypot(x0 + dx * t - q[0], y0 + dy * t - q[1]) < Math.min(s0, PEER_D) - 1) return true;
  }
  return false;
}

/* ---------------------------------------------------------------- collision (same push-out the game always used, plus props) */
function collide(H, dt, r, mode) {
  peerProject(H, dt);
  const a = A(), ox = H.x, oy = H.y;
  W.setMode(mode);
  try {
    for (const ax of ['x', 'y']) {
      H[ax] += H[ax === 'x' ? 'vx' : 'vy'] * dt;
      for (const t of a.Bc(H.x, H.y)) {
        const nx = Math.max(t.x, Math.min(H.x, t.x + t.w)), ny = Math.max(t.y, Math.min(H.y, t.y + t.h)), dx = H.x - nx, dy = H.y - ny, d = Math.hypot(dx, dy);
        if (d < r) { if (d > 0) { H.x += dx / d * (r - d); H.y += dy / d * (r - d); } else H[ax] = ax === 'x' ? ox : oy; }
      }
    }
  } finally { W.setMode('walk'); }
  return Math.hypot(H.x - ox, H.y - oy);
}
const freeAt = (x, y, r, mode, ignore) => {
  const a = A(); W.setMode(mode);
  try { return a.Bc(x, y).every(t => t === ignore || Math.hypot(x - Math.max(t.x, Math.min(x, t.x + t.w)), y - Math.max(t.y, Math.min(y, t.y + t.h))) >= r); } finally { W.setMode('walk'); }
};

/* ---------------------------------------------------------------- vaulting */
function tryVault(H, dirx, diry, speed, wantRun, dt) {
  if (mv.vaultCd > 0 || mv.s === 'crawl' || mv.s === 'slide' || mv.down) return false;
  const reach = 17 + speed * .05;
  let best = null, bd = 1e9;
  for (const p of W.LOW) {
    const r = p.rect;
    const px = H.x + dirx * reach, py = H.y + diry * reach;
    if (px < r.x - 3 || px > r.x + r.w + 3 || py < r.y - 3 || py > r.y + r.h + 3) continue;
    // crossing axis and direction: from the side the player stands on
    let nx = 0, ny = 0;
    if (p.cross === 'y') ny = H.y < p.cy ? 1 : -1; else nx = H.x < p.cx ? 1 : -1;
    const lat = p.cross === 'y' ? H.x : H.y, lo = p.cross === 'y' ? r.x : r.y, hi = p.cross === 'y' ? r.x + r.w : r.y + r.h;
    if (lat < lo - 2 || lat > hi + 2) continue;                       // beside the ends: just slide along it
    const dot = dirx * nx + diry * ny;                                // approach angle, 1 = head-on
    if (dot < .34) continue;                                          // generous: anything within ~70 degrees works
    const d = Math.hypot(H.x - p.cx, H.y - p.cy);
    if (d < bd) { bd = d; best = { p, nx, ny, dot }; }
  }
  if (!best) { mv.push = 0; return false; }
  const { p, nx, ny, dot } = best, r = p.rect;
  // how good is this vault?  speed, angle, stamina, what you were doing
  const st = H.stamina, crouched = mv.s === 'crouch';
  let q = 1;                                                          // 0 slow, 1 normal, 2 fast
  if (crouched) q = 0;
  else if (wantRun && speed >= 200 && dot >= .6 && st >= 12 && !H.exhausted) q = 2;
  else if (speed >= 80 && dot >= .42 && st >= 3) q = 1;
  else q = 0;
  if (H.exhausted && q > 1) q = 1;
  if (dot < .5 && q > 1) q = 1;
  if (st < 5 && q > 0) q = Math.min(q, 1);
  // don't fire on a light brush: walking needs a real push, crouching needs a deliberate one
  if (speed < 48 || (crouched && (mv.push += dt) < .22)) { if (!crouched) return false; return false; }
  const depth = p.cross === 'y' ? r.h : r.w, span = depth + 2 * (M.radius + 5);
  const sx = H.x, sy = H.y;
  const ex = p.cross === 'y' ? clamp(H.x, r.x + 4, r.x + r.w - 4) : (nx > 0 ? r.x + r.w + M.radius + 6 : r.x - M.radius - 6);
  const ey = p.cross === 'y' ? (ny > 0 ? r.y + r.h + M.radius + 6 : r.y - M.radius - 6) : clamp(H.y, r.y + 4, r.y + r.h - 4);
  if (!freeAt(ex, ey, M.radius - 1, 'walk', r)) return false;         // nowhere to land
  if (peerOnPath(sx, sy, ex, ey)) { mv.push = 0; return false; }      // Stage 3D HQ2: somebody on the landing or in the way: a bump, like a wall
  const cfg = q === 2 ? M.vault.fast : q === 1 ? M.vault.normal : M.vault.slow;
  const dur = cfg.t * (crouched ? 1.15 : 1);
  H.stamina = Math.max(0, H.stamina - cfg.cost);
  if (H.stamina <= 0.1) { H.exhausted = true; }
  mv.vault = { p, sx, sy, ex, ey, dur, t: 0, q, nx, ny, exitSpeed: q === 2 ? Math.min(speed * .9, 235) : q === 1 ? Math.min(speed * .62, 150) : Math.min(speed * .35, 90), heard: false };
  mv.push = 0; mv.q = q; setState('vault');
  mv.event(21 + q, q === 2 ? .8 : q === 1 ? .5 : .25);              // the scramble over the top (the landing is sent separately)
  sfx && sfx.vaultStart(q);
  return true;
}
function stepVault(H, dt) {
  const v = mv.vault; v.t += dt;
  const k = clamp(v.t / v.dur, 0, 1), e = k * k * (3 - 2 * k) * .55 + k * .45;    // mostly even, gentle start/stop
  const px = H.x, py = H.y;
  H.x = v.sx + (v.ex - v.sx) * e; H.y = v.sy + (v.ey - v.sy) * e;
  H.vx = (H.x - px) / dt; H.vy = (H.y - py) / dt;
  mv.prof = W.PROFILE.vault; H.sprinting = false;
  if (k >= 1) {
    const dx = v.ex - v.sx, dy = v.ey - v.sy, d = Math.hypot(dx, dy) || 1;
    H.vx = dx / d * v.exitSpeed; H.vy = dy / d * v.exitSpeed;     // momentum carries over
    mv.event(24 + v.q, v.q === 2 ? .85 : v.q === 1 ? .55 : .25); // landing
    sfx && sfx.vaultLand(v.q);
    mv.vault = null; mv.vaultCd = .35; mv.recover = v.q === 0 ? .1 : 0;
    setState('walk');
  }
}

/* ---------------------------------------------------------------- sliding */
function startSlide(H) {
  const sp = Math.hypot(H.vx, H.vy);
  if (mv.slideCd > 0 || sp < M.slideMin || H.stamina < 1.5 || mv.vault || mv.down) return false;
  const surf = mv.surf, k = SURF[surf].slide;
  mv.slide = { dx: H.vx / sp, dy: H.vy / sp, v: Math.min(sp, M.run * 1.02), k, t: 0, surf, dist: 0 };
  H.stamina = Math.max(0, H.stamina - M.slideCost); mv.crouch = false;
  setState('slide'); mv.event(30, .75);
  sfx && sfx.slideStart(surf, mv.slide.v);
  return true;
}
function stepSlide(H, dt, ix, iy) {
  const s = mv.slide; s.t += dt;
  // limited steering: the slide direction can lean toward the input, never faster than ~1 rad/s, and turning costs speed
  if (ix || iy) {
    const want = Math.atan2(iy, ix), cur = Math.atan2(s.dy, s.dx), d = angDiff(want, cur), step = clamp(d, -1.0 * dt, 1.0 * dt);
    const na = cur + step; s.dx = Math.cos(na); s.dy = Math.sin(na); s.v *= 1 - Math.abs(step) * .35;
  }
  s.v *= Math.exp(-s.k * dt);
  H.vx = s.dx * s.v; H.vy = s.dy * s.v;
  const moved = collide(H, dt, M.radius - 1, 'under');
  s.dist += moved;
  if (moved < s.v * dt * .45) s.v *= .5;                             // scraped a wall: the slide dies quickly
  mv.prof = W.PROFILE.slide; H.sprinting = false;
  if (s.v <= M.slideEnd) endSlide(H);
}
function endSlide(H) {
  mv.slide = null; mv.slideCd = M.slideCd; mv.recover = .32;          // natural recovery: you're low for a moment
  mv.crouch = true; setState('crouch');
  sfx && sfx.slideEnd();
}

/* ---------------------------------------------------------------- the per-tick step (replaces the game's Yc) */
function stepInner(ix, iy, run, dt) {
  const a = A(), H = a.H, Q = a.keys;
  const len = Math.hypot(ix, iy), moving = len > 0; let dx = 0, dy = 0;
  if (moving) { dx = ix / len; dy = iy / len; }
  mv.t += dt; mv.slideCd = Math.max(0, mv.slideCd - dt); mv.vaultCd = Math.max(0, mv.vaultCd - dt); mv.recover = Math.max(0, mv.recover - dt);
  mv.surf = W.surfaceAt(H.x, H.y, a.Oc);
  const inRoom12 = (() => { const c = a.Oc[11]; return H.x >= c.x * 96 && H.x < (c.x + c.w) * 96 && H.y >= c.y * 96 && H.y < (c.y + c.h) * 96; })();
  const c = !!(Q && Q.has('KeyC')), cEdge = c && !mv.prevC; mv.prevC = c;
  const speedNow = Math.hypot(H.vx, H.vy);
  if (H.exhausted && H.stamina >= M.recoverAt) H.exhausted = false;

  /* caught / knocked down by something: the server tells us (mv.down = 'down' | 'crawl') */
  if (mv.down) {
    if (mv.slide) mv.slide = null; if (mv.vault) mv.vault = null;
    const crawl = mv.down === 'crawl', target = crawl && moving ? 40 : 0, u = 1 - Math.exp(-14 * dt);
    let pvx = 0, pvy = 0;                                                  // being dragged: pulled toward the point the server names (its mouth), walls still stop us
    if (mv.dragTo) { const ex = mv.dragTo[0] - H.x, ey = mv.dragTo[1] - H.y, ed = Math.hypot(ex, ey); if (ed > 5) { const sp = Math.min(74, ed * 3); pvx = ex / ed * sp; pvy = ey / ed * sp; } }
    H.vx += (dx * target + pvx - H.vx) * u; H.vy += (dy * target + pvy - H.vy) * u;
    mv.tw = moving && !crawl ? 1 : 0;                                      // trying to get up: the avatar struggles
    collide(H, dt, M.radius - 2, 'crawl');
    setState(crawl ? 'crawl' : 'down'); mv.prof = crawl ? W.PROFILE.crawl : W.PROFILE.down; H.sprinting = false;
    H.stamina = Math.min(100, H.stamina + 4 * dt); H.distance += Math.hypot(H.vx, H.vy) * dt; mv.speed = Math.hypot(H.vx, H.vy);
    return;
  }

  if (mv.vault) { stepVault(H, dt); H.distance += Math.hypot(H.vx, H.vy) * dt; mv.speed = Math.hypot(H.vx, H.vy); return; }
  if (mv.slide) {
    if (cEdge) endSlide(H);
    else { stepSlide(H, dt, dx, dy); H.distance += mv.slide ? mv.slide.v * dt : 0; mv.speed = mv.slide ? mv.slide.v : 0; return; }
  }

  /* what low geometry are we in?  (a crouched player entering it becomes a crawler) */
  const zone = W.lowZone(H.x, H.y, -2); mv.zone = zone;
  if (cEdge && !mv.slide) {
    if ((mv.s === 'run' || speedNow >= 225) && speedNow >= M.slideMin && !zone) startSlide(H);
    else if (zone) { /* can't stand up under a table */ }
    else mv.crouch = !mv.crouch;
    if (mv.slide) { H.sprinting = false; return stepSlide(H, dt, dx, dy); }
  }
  if (zone && !mv.crouch) mv.crouch = true;                            // spawned/teleported into low geometry

  /* pick the state */
  let want;
  const exh = !!H.exhausted;
  if (zone && mv.crouch) want = 'crawl';
  else if (mv.crouch) want = 'crouch';
  else if (run && moving && !exh && H.stamina > .1 && mv.recover <= 0) want = 'run';
  else if (moving) want = 'walk';
  else want = 'stand';
  if (want === 'crawl' && mv.s === 'crouch' && !moving && !zone) want = 'crouch';
  setState(want);

  /* speed target */
  let target = 0, stamina = H.stamina;
  const lowF = .42 + .58 * clamp(stamina / 32, 0, 1);                   // running slows down as stamina drops, it never just stops
  if (want === 'walk') target = exh ? M.exhaustedWalk : M.walk;
  else if (want === 'run') target = M.walk + (M.run - M.walk) * lowF;
  else if (want === 'crouch') target = M.crouch * (exh ? .95 : 1);
  else if (want === 'crawl') target = M.crawl;
  if (inRoom12 && want !== 'crawl') target *= .83;
  if (mv.recover > 0 && want !== 'crawl') target *= .8;
  if (!moving) target = 0;
  if (moving && (want === 'walk' || want === 'run') && mv.surf === 'wet') target *= 1.0;

  /* stamina */
  const R = M.staminaRegen;
  if (want === 'run') {
    H.stamina = Math.max(0, H.stamina - (M.staminaDrainRun + (inRoom12 ? 4 : 0)) * dt); mv.lastRun = performance.now() / 1000;
    if (H.stamina <= .1) { H.exhausted = true; H.stamina = 0; }
  } else {
    const rate = want === 'stand' ? R.stand : want === 'crouch' ? (moving ? R.crouchWalk : R.crouch) : want === 'crawl' ? R.crawl : R.walk;
    H.stamina = Math.min(100, H.stamina + rate * (exh ? .7 : 1) * dt);
  }
  H.sprinting = want === 'run';

  /* steer */
  const acc = (want === 'run' ? 15 : want === 'crawl' ? 11 : want === 'crouch' ? 13 : 17) * (exh ? (M.exhaustedAcc || 1) : 1), u = 1 - Math.exp(-acc * dt);   // spent legs: slower to get going and to change direction
  H.vx += (dx * target - H.vx) * u; H.vy += (dy * target - H.vy) * u;
  mv.prof = W.PROFILE[want];

  /* vault attempt: only when moving into a low obstacle */
  if (moving && (want === 'walk' || want === 'run' || want === 'crouch') && speedNow > 30 || (moving && want === 'crouch')) {
    const hd = Math.hypot(H.vx, H.vy), hx = hd > 1 ? H.vx / hd : dx, hy = hd > 1 ? H.vy / hd : dy;
    if (tryVault(H, dx * .6 + hx * .4, dy * .6 + hy * .4, Math.max(hd, want === 'crouch' ? 60 : 0), want === 'run', dt)) { mv.speed = 0; return; }
  } else mv.push = 0;

  /* collide.  crouching lets you into wall holes and under low things; running and walking do not */
  const mode = mv.crouch ? 'crawl' : 'walk';
  const moved = collide(H, dt, want === 'crawl' ? M.radius - 2 : M.radius, mode);
  H.distance += moved; mv.speed = moved / Math.max(dt, 1e-4);

  /* pushing into a hole or under furniture while walking: lower yourself (a gentle affordance, running just bumps) */
  if (!mv.crouch && want === 'walk' && moving) {
    const p = W.propAt(H.x + dx * 24, H.y + dy * 24, 0, ['gap', 'under']);
    if (p && mv.speed < target * .6) { mv.pushKey = p.id; mv.hard += dt; if (mv.hard > .38) { mv.crouch = true; mv.hard = 0; } } else mv.hard = Math.max(0, mv.hard - dt * 2);
  } else mv.hard = 0;
}
mv.step = function (ix, iy, run, dt) {
  stepInner(ix, iy, run, dt);
  const H = A().H, v = mv.vault, sl = mv.slide;
  let lean = 1; if (sl) lean = Math.sign(Math.sin(sl.dy !== undefined ? Math.atan2(sl.dy, sl.dx) - H.angle : 0)) || 1;
  H.mv = { s: mv.s, t: mv.t, sp: Math.round(mv.speed), st: H.stamina, ex: H.exhausted ? 1 : 0, vp: v ? v.t / v.dur : 0, lean, tw: mv.tw ? 1 : 0 };
};

mv.label = moving => {
  if (mv.down) return 'DOWN';
  const s = mv.s;
  if (H_exh()) return 'WINDED';
  return s === 'run' ? 'RUNNING' : s === 'slide' ? 'SLIDING' : s === 'vault' ? 'MOVING' : s === 'crawl' ? 'CRAWLING' : s === 'crouch' ? 'CROUCHED' : moving ? 'WALKING' : 'STANDING';
};
const H_exh = () => { const a = A(); return !!(a && a.H.exhausted); };

/* what the server needs to hear about us */
mv.net = () => {
  const a = A(), H = a.H;
  return { s: S[mv.s] | 0, q: mv.q | 0, st: Math.round(H.stamina), ex: H.exhausted ? 1 : 0, sp: Math.round(mv.speed), ev: mv.take() };
};


return { A, clamp, mv, SURF, useSound };
}
