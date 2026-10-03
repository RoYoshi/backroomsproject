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

/* ---------------------------------------------------------------- state helpers */
function setState(s) { if (mv.s !== s) { mv.prev = mv.s; mv.s = s; mv.t = 0; } }
function reset() {
  Object.assign(mv, { s: 'stand', t: 0, crouch: false, prevC: false, slide: null, slideCd: 0, recover: 0, vault: null, vaultCd: 0, push: 0, exh: false, ev: [], down: 0, dragTo: null, tw: 0, downMode: '', prof: 1, breathT: 0, deficit: 0, zone: null, q: 1, speed: 0 });
  const a = A(); if (a) { a.H.exhausted = false; a.H.sprinting = false; }
}
mv.reset = reset;
mv.event = (c, v = 1) => { if (mv.ev.length < 6) mv.ev.push([c, Math.round(clamp(v, 0, 1) * 100)]); };
mv.take = () => { const e = mv.ev; mv.ev = []; return e; };

/* ---------------------------------------------------------------- collision (same push-out the game always used, plus props) */
function collide(H, dt, r, mode) {
  const a = A(), ox = H.x, oy = H.y;
  if (a.spatialMotion) return a.spatialMotion.collide(H, mv, dt);
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
  const a = A(); if (a.spatialMotion) return a.spatialMotion.freeAt(a.H, x, y); W.setMode(mode);
  try { return a.Bc(x, y).every(t => t === ignore || Math.hypot(x - Math.max(t.x, Math.min(x, t.x + t.w)), y - Math.max(t.y, Math.min(y, t.y + t.h))) >= r); } finally { W.setMode('walk'); }
};

/* ---------------------------------------------------------------- vaulting */
function tryVault(H, dirx, diry, speed, wantRun, dt) {
  if (mv.vaultCd > 0 || mv.s === 'crawl' || mv.s === 'slide' || mv.down) return false;
  const reach = 17 + speed * .05;
  let best = null, bd = 1e9;
  for (const p of (A().spatialMotion ? A().spatialMotion.lowObstacles : W.LOW)) {
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
  const cfg = q === 2 ? M.vault.fast : q === 1 ? M.vault.normal : M.vault.slow;
  const dur = cfg.t * (crouched ? 1.15 : 1);
  const spatialVault = A().spatialMotion ? A().spatialMotion.planVault(H, p, {x:ex,y:ey}, dur) : null;
  if (A().spatialMotion && !spatialVault) return false;
  H.stamina = Math.max(0, H.stamina - cfg.cost);
  if (H.stamina <= 0.1) { H.exhausted = true; }
  mv.vault = { p, sx, sy, ex, ey, dur, t: 0, q, nx, ny, exitSpeed: q === 2 ? Math.min(speed * .9, 235) : q === 1 ? Math.min(speed * .62, 150) : Math.min(speed * .35, 90), heard: false };
  if (spatialVault) mv.vault.physical = spatialVault;
  mv.push = 0; mv.q = q; setState('vault');
  mv.event(21 + q, q === 2 ? .8 : q === 1 ? .5 : .25);              // the scramble over the top (the landing is sent separately)
  window.__mvSfx && window.__mvSfx.vaultStart(q);
  return true;
}
function stepVault(H, dt) {
  const v = mv.vault; v.t += dt;
  const k = clamp(v.t / v.dur, 0, 1), e = k * k * (3 - 2 * k) * .55 + k * .45;    // mostly even, gentle start/stop
  const px = H.x, py = H.y;
  if (A().spatialMotion) {
    if (!A().spatialMotion.vault(H, v, k, dt)) { mv.vault = null; mv.vaultCd = .35; setState('walk'); return; }
  } else { H.x = v.sx + (v.ex - v.sx) * e; H.y = v.sy + (v.ey - v.sy) * e; }
  H.vx = (H.x - px) / dt; H.vy = (H.y - py) / dt;
  mv.prof = W.PROFILE.vault; H.sprinting = false;
  if (k >= 1) {
    const dx = v.ex - v.sx, dy = v.ey - v.sy, d = Math.hypot(dx, dy) || 1;
    H.vx = dx / d * v.exitSpeed; H.vy = dy / d * v.exitSpeed;     // momentum carries over
    mv.event(24 + v.q, v.q === 2 ? .85 : v.q === 1 ? .55 : .25); // landing
    window.__mvSfx && window.__mvSfx.vaultLand(v.q);
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
  window.__mvSfx && window.__mvSfx.slideStart(surf, mv.slide.v);
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
  window.__mvSfx && window.__mvSfx.slideEnd();
}

/* ---------------------------------------------------------------- the per-tick step (replaces the game's Yc) */
function stepInner(ix, iy, run, dt) {
  const a = A(), H = a.H, Q = a.keys;
  const len = Math.hypot(ix, iy), moving = len > 0; let dx = 0, dy = 0;
  if (moving) { dx = ix / len; dy = iy / len; }
  mv.t += dt; mv.slideCd = Math.max(0, mv.slideCd - dt); mv.vaultCd = Math.max(0, mv.vaultCd - dt); mv.recover = Math.max(0, mv.recover - dt);
  mv.surf = a.spatialMotion ? a.spatialMotion.surface(H) : W.surfaceAt(H.x, H.y, a.Oc);
  const inRoom12 = a.spatialMotion ? mv.surf === 'deep' : (() => { const c = a.Oc[11]; return H.x >= c.x * 96 && H.x < (c.x + c.w) * 96 && H.y >= c.y * 96 && H.y < (c.y + c.h) * 96; })();
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
  const zone = a.spatialMotion ? a.spatialMotion.zone(H, mv.crouch) : W.lowZone(H.x, H.y, -2); mv.zone = zone;
  if (cEdge && !mv.slide) {
    if ((mv.s === 'run' || speedNow >= 225) && speedNow >= M.slideMin && !zone) startSlide(H);
    else if (zone) { /* can't stand up under a table */ }
    else if (!a.spatialMotion || !mv.crouch || a.spatialMotion.canStand(H)) mv.crouch = !mv.crouch;
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
    const p = a.spatialMotion ? a.spatialMotion.lowAhead(H, dx, dy) : W.propAt(H.x + dx * 24, H.y + dy * 24, 0, ['gap', 'under']);
    if (p && mv.speed < target * .6) { mv.pushKey = p.id; mv.hard += dt; if (mv.hard > .38) { mv.crouch = true; mv.hard = 0; } } else mv.hard = Math.max(0, mv.hard - dt * 2);
  } else mv.hard = 0;
}
mv.step = function (ix, iy, run, dt) {
  const spatial = A().spatialMotion;
  if (spatial) spatial.begin(A().H, mv);
  stepInner(ix, iy, run, dt);
  if (spatial) spatial.end(A().H, mv, dt);
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

/* ---------------------------------------------------------------- avatar poses (local player and everybody else) */
window.__pose = {
  apply(av, S_, e, preview) {
    const m = S_ && S_.mv; if (!m || preview) return;
    const s = m.s, t = m.t || 0, k = clamp(t / .35, 0, 1), sw = Math.sin(e * 6);
    const b = av.body, hs = av.hands;
    if (s === 'crouch') { b.scale.set(1 - .07 * k, 1 - .15 * k); av.hat.y += 3 * k; av.pack.y += 2 * k; hs.forEach(h => { h.x *= .9; }); }
    else if (s === 'crawl') { const mvng = (m.sp || 0) > 8; b.scale.set(1.04, 1 - .3 * k); av.hat.y += 5 * k; av.pack.y += 4 * k; hs.forEach((h, i) => { h.y = -17 + (mvng ? Math.sin(e * 7 + i * Math.PI) * 7 : 0); h.x *= .85; }); }
    else if (s === 'slide') { b.scale.set(.92, 1.22); b.rotation = .18 * Math.sign(m.lean || 1); av.hat.y += 4; hs.forEach((h, i) => { h.y += 9; h.x *= .8; }); }
    else if (s === 'vault') { const u = clamp(m.vp || .5, 0, 1), arc = Math.sin(u * Math.PI); b.scale.set(1 + .06 * arc, 1 + .1 * arc); hs.forEach(h => { h.y = -16 - 3 * arc; h.x *= .9; }); av.hat.y -= 1.5 * arc; }
    else if (s === 'down') { b.scale.set(1.16, .8); hs.forEach((h, i) => { h.x = (i ? 1 : -1) * 22; h.y = 6 + Math.sin(e * 9 + i) * 2; }); av.hat.y += 5; }
    if (m.ex && s !== 'down' && s !== 'crawl') { const br = Math.sin(e * 8.5); b.scale.x *= 1 + .028 * br; b.scale.y *= 1 - .02 * br; av.hat.y += 1.2 + .8 * br; hs.forEach(h => { h.y += 1.2; }); }
    if (m.st !== undefined && m.st < 22 && !m.ex && s !== 'down') { const br = Math.sin(e * 6.5); b.scale.x *= 1 + .014 * br; }
    if (m.tw) { b.x = Math.sin(e * 52) * 1.6; } else b.x = 0;                              // struggling
  },
};

/* ---------------------------------------------------------------- sound: footsteps by state and surface, slides, vaults, breathing */
let ctx = null, out = null, noiseBuf = null;
function audio() {
  const a = A(); if (!a || !a.audio) return null; const Z = a.audio(); if (!Z || !Z.context || !Z.gain) return null;
  if (ctx !== Z.context) { ctx = Z.context; out = Z.gain; noiseBuf = null; }
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return Z;
}
const soundOn = () => !(document.getElementById('sound') && /OFF/.test(document.getElementById('sound').textContent));
function noise(dur, type, f, q, vol, atk = .01, pan = 0, when = 0, f2) {
  if (!audio() || !soundOn()) return;
  const t0 = ctx.currentTime + when, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q;
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + atk); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(fl); fl.connect(g); if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(out); } else g.connect(out);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + .05);
}
function thump(f0, f1, dur, vol, when = 0) {
  if (!audio() || !soundOn()) return;
  const t0 = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + .006); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + .02);
}
window.__mvSfx = {
  slideStart(surf, v) {
    const vol = .05 + .06 * clamp(v / 285, 0, 1), dur = (SURF[surf].slide < 1 ? 1.6 : SURF[surf].slide < 2 ? .9 : .55);
    if (surf === 'wet') { noise(dur, 'bandpass', 1900, .7, vol * 1.5, .03, 0, 0, 900); noise(dur * .8, 'highpass', 3200, .5, vol * .55, .04); }
    else if (surf === 'concrete') { noise(dur, 'bandpass', 1100, 1.1, vol * 1.3, .02, 0, 0, 480); noise(dur * .6, 'lowpass', 520, .7, vol * .6, .02); }
    else { noise(dur, 'lowpass', 760, .6, vol * 1.1, .02, 0, 0, 260); noise(dur * .7, 'bandpass', 2200, .8, vol * .32, .04); }   // cloth on carpet
    thump(70, 42, .12, .06);
  },
  slideEnd() { noise(.16, 'lowpass', 500, .7, .035, .01); },
  vaultStart(q) { noise(.12 + (q === 0 ? .12 : 0), 'bandpass', 900, .9, q === 2 ? .07 : .045, .01); },
  vaultLand(q) { thump(q === 2 ? 95 : 78, 40, .14, q === 2 ? .14 : q === 1 ? .09 : .04); noise(.09, 'lowpass', 700, .8, q === 2 ? .1 : .05, .004); if (q === 2) noise(.14, 'bandpass', 1600, 1, .04, .002, 0, .02); },
  crouchStep(vol, surf) { noise(.09, 'lowpass', surf === 'wet' ? 520 : 300, .7, .035 * vol, .008, (Math.random() - .5) * .2); },
  crawlStep(vol) { noise(.22, 'bandpass', 620, .8, .028 * vol, .05, (Math.random() - .5) * .3, 0, 380); },
  breath(deficit) {
    if (!audio() || !soundOn()) return;
    const d = clamp(deficit, 0, 1), v = .022 + .07 * d, dur = .5 + .35 * (1 - d);
    noise(dur, 'bandpass', 1500 - 500 * d, .6, v, dur * .45, -.05 + Math.random() * .1, 0, 700);                 // inhale
    noise(dur * .9, 'bandpass', 800, .7, v * .8, dur * .25, -.05 + Math.random() * .1, dur * 1.05, 380);       // exhale
  },
};
let lastBreath = 0, stepDist = 0, lastStepPos = null;
/* called every frame in place of Z.footstep */
mv.foot = (Z, surface) => {
  const a = A(), H = a.H, now = performance.now() / 1000, s = mv.s, dist = H.distance;
  if (lastStepPos === null || dist < lastStepPos) lastStepPos = dist;
  const sp = Math.hypot(H.vx, H.vy);
  const wet = mv.surf === 'wet' ? 'wet' : mv.surf === 'concrete' ? 'hollow' : 'carpet';
  if(window.TFB_WORLD&&!H.supportId)lastStepPos=dist;
  else if (s === 'walk' || s === 'run') Z.footstep(dist, sp, wet);
  else if (s === 'crouch' && sp > 20 && dist - lastStepPos > 46) { lastStepPos = dist; window.__mvSfx.crouchStep(1, mv.surf); }
  else if (s === 'crawl' && sp > 12 && dist - lastStepPos > 30) { lastStepPos = dist; window.__mvSfx.crawlStep(1); }
  else if (s !== 'walk' && s !== 'run' && s !== 'crouch' && s !== 'crawl') lastStepPos = dist;
  /* breathing: you notice your own stamina long before you read a number */
  const def = clamp(1 - H.stamina / 100, 0, 1), recentRun = now - mv.lastRun < 9;
  const need = H.exhausted ? 1 : (recentRun && H.stamina < 55 ? .35 + (55 - H.stamina) / 90 : 0);
  if (need > 0 && now - lastBreath > 1.55 - .75 * need) { lastBreath = now; window.__mvSfx.breath(need); }
};
})();
