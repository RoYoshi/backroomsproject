/* Realistic wound / blood rendering for the death animation, corpses and dead peers.
   Pure Graphics-API helpers (no PIXI import): everything is polygons with layered translucency,
   irregular organic outlines, wet highlights and slow coagulation colour. Loaded before the game bundle. */
(() => {
  const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => { const r = (a >> 16) & 255, g = (a >> 8) & 255, bl = a & 255, R = (b >> 16) & 255, G = (b >> 8) & 255, B = b & 255;
    return (Math.round(r + (R - r) * t) << 16) | (Math.round(g + (G - g) * t) << 8) | Math.round(bl + (B - bl) * t); };
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  /* venous blood under sodium/fluorescent light: bright wet red -> maroon -> brown-black as it dries */
  const COL = { fresh: [0x7a1512, 0x651210, 0x4a0b0a, 0x2c0605], dry: [0x4a120e, 0x3b0d0a, 0x2a0806, 0x170303] };
  const shade = (k, dry) => mix(COL.fresh[k], COL.dry[k], dry);
  const LAYERS = Array.from({ length: 15 }, (_, i) => { const t = i / 14; return [1.14 - t * .94, t * 3, i < 2 ? .16 : .11 + t * .09]; });   // scale, colour position (0..3), alpha

  /* ---------- organic pool outline (unit radius), with runoff lobes ---------- */
  function poolShape(seed) {
    const r = rng(seed * 7919 + 13), N = 72, p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU;
    const lobes = Array.from({ length: 2 + (r() * 3 | 0) }, () => ({ a: r() * TAU, w: .22 + r() * .25, h: .3 + r() * .55 }));
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU; let m = 1 + .16 * Math.sin(3 * a + p1) + .11 * Math.sin(5 * a + p2) + .07 * Math.sin(9 * a + p3) + (r() - .5) * .07;
      for (const l of lobes) { const d = Math.atan2(Math.sin(a - l.a), Math.cos(a - l.a)); m += l.h * Math.exp(-(d * d) / (2 * l.w * l.w)); }
      pts.push([Math.cos(a), Math.sin(a), m]);
    }
    return pts;
  }
  /* Stage 3D: a pool spreads on the floor only.  lim[i] (optional) is how far the floor reaches from the pool's centre along the shape's
   * i-th direction before a wall or pillar; every outline point is pulled in to stay inside it, so blood never paints the top of a wall. */
  const outline = (shape, x, y, R, k = 1, ox = 0, oy = 0, lim = null) => { const o = [];
    for (let i = 0; i < shape.length; i++) { const [c, s, m] = shape[i]; let px = c * m * R * k + ox, py = s * m * R * k * .82 + oy;
      if (lim) { const d = Math.hypot(px, py); if (d > lim[i]) { px *= lim[i] / d; py *= lim[i] / d; } }
      o.push(x + px, y + py); }
    return o; };
  const API = () => window.__api;
  /* the level's props block according to WORLD.mode (how low the viewer is standing); blood is placed as the death physics collides, in
   * 'walk' mode, so every viewer draws the same blood whatever their own posture */
  const walk = f => { const W0 = window.WORLD; if (!W0 || !W0.setMode || W0.mode === 'walk') return f(); const m = W0.mode; W0.setMode('walk'); try { return f(); } finally { W0.setMode(m); } };
  /* the floor test the game hands in looks at the tile grid only; a drop that lands on a pillar or a prop is refused too */
  const onFloor = (floor, x, y) => { if (!floor(x, y)) return false; const A = API(); return !A || !A.sl || walk(() => A.sl(x, y, .5)); };
  /* a drop is elongated along its flight: its head, middle and the end of its tail must all be on the floor */
  const dropOk = (floor, x, y, a, s, el) => { const c = Math.cos(a), n = Math.sin(a), L = s * el + 1; return onFloor(floor, x, y) && onFloor(floor, x - c * L, y - n * L) && onFloor(floor, x + c * (s + 1), y + n * (s + 1)); };
  /* how far the floor reaches from (x, y) in each of a pool shape's directions (walls and pillars: the level's own ray), once per pool */
  function reach(x, y, shape) {
    const A = API(); if (!A || !A.Uc) return null; const out = new Float32Array(shape.length);
    walk(() => { for (let i = 0; i < shape.length; i++) { const [c, s] = shape[i]; out[i] = Math.max(1.5, A.Uc(x, y, Math.atan2(s * .82, c), 90) - 1.5); } });
    return out;
  }

  function drawPool(g, x, y, R, shape, fresh, seed, dirx = 1, diry = 0, lim = null) {
    const dry = 1 - fresh;
    LAYERS.forEach(([k, ci, al], i) => { const lo = Math.floor(ci), c = mix(shade(lo, dry), shade(Math.min(lo + 1, 3), dry), ci - lo); g.poly(outline(shape, x, y, R, k, dirx * R * .025 * i, diry * R * .025 * i, lim)).fill({ color: c, alpha: al }); });
    if (fresh > .08) {                                                                                     // wet highlights
      const a = .2 * fresh;
      g.moveTo(x - R * .55, y - R * .32).quadraticCurveTo(x - R * .15, y - R * .58, x + R * .28, y - R * .42).stroke({ color: 0xffe9dc, width: 1.5, alpha: a, cap: 'round' });
      g.moveTo(x + R * .1, y + R * .28).quadraticCurveTo(x + R * .34, y + R * .18, x + R * .52, y + R * .3).stroke({ color: 0xffe9dc, width: 1, alpha: a * .8, cap: 'round' });
      g.circle(x - R * .3, y - R * .22, 1.2).fill({ color: 0xfff4ea, alpha: .4 * fresh });
    }
  }

  /* ---------- cast-off spatter: elongated teardrops with a tail pointing back to the source ---------- */
  function spatterSet(seed, base) {
    const r = rng(seed * 104729 + 7), out = [];
    for (let i = 0; i < 20; i++) {
      const cone = r() < .72 ? (r() - .5) * 1.9 : Math.PI + (r() - .5) * 2.6;      // mostly forward, some back-spray
      const dist = 7 + Math.pow(r(), 1.7) * 56;
      out.push({ a: base + cone, d: dist, s: .6 + Math.pow(r(), 2.2) * 2.4, el: 1 + Math.min(4.5, dist / 26) * (.6 + r() * .6), c: r() });
    }
    return out;
  }
  function drop(g, x, y, ang, s, el, col, alpha) {
    const ca = Math.cos(ang), sa = Math.sin(ang), L = s * el, pts = [];
    for (let i = 0; i < 9; i++) {              // head round, tail tapered
      const t = i / 9 * TAU, cx = Math.cos(t), cy = Math.sin(t), tail = cx < 0 ? 1 + (-cx) * (el - 1) : 1;
      const px = cx * s * (cx < 0 ? tail : 1), py = cy * s * (cx < 0 ? 1 / Math.sqrt(tail) : 1);
      pts.push(x + px * ca - py * sa, y + px * sa + py * ca);
    }
    g.poly(pts).fill({ color: col, alpha });
    if (s > 1.9) g.circle(x + ca * s * .3 - sa * s * .25, y + sa * s * .3 + ca * s * .25, Math.max(.5, s * .18)).fill({ color: 0xffeee6, alpha: .25 });
  }

  /* ---------- drag smear: dozens of striated strands like a body pulled through a pool ---------- */
  function smear(g, x0, y0, x1, y1, seed, fresh) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 3) return;
    const nx = -dy / L, ny = dx / L, r = rng(seed * 31 + 5), dry = 1 - fresh;
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: shade(2, dry), width: 20, alpha: .30, cap: 'round' });
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: shade(1, dry), width: 13, alpha: .34, cap: 'round' });
    for (let k = 0; k < 15; k++) {
      const off = (k / 14 - .5) * 20 + (r() - .5) * 3, end = .55 + r() * .45, w = .8 + r() * 2.2, wob = (r() - .5) * 5, st = r() * .12;
      const ax = x0 + dx * st + nx * off, ay = y0 + dy * st + ny * off, bx = x0 + dx * end + nx * (off + wob), by = y0 + dy * end + ny * (off + wob);
      g.moveTo(ax, ay).quadraticCurveTo((ax + bx) / 2 + nx * wob, (ay + by) / 2 + ny * wob, bx, by)
        .stroke({ color: shade(k % 3, dry), width: w, alpha: .2 + r() * .34, cap: 'round' });
    }
    for (let k = 0; k < 4; k++) { const t = .25 + r() * .7; g.ellipse(x0 + dx * t + nx * (r() - .5) * 14, y0 + dy * t + ny * (r() - .5) * 14, 3 + r() * 4, 2 + r() * 3).fill({ color: shade(3, dry), alpha: .55 }); }
  }

  /* ---------- a smear laid down along the path the body really took (dragged bodies leave a trail that bends where they bent) ---------- */
  function smearPath(g, pts, seed, fresh, upto) {
    if (!pts || pts.length < 2) return; const dry = 1 - fresh, r = rng(seed * 31 + 5), n = Math.min(pts.length, upto || pts.length);
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i], k = i / n, w = 6 + 8 * Math.sin(Math.min(1, k * 1.3) * Math.PI * .5);
      g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ color: shade(2, dry), width: w * 1.25, alpha: .22, cap: 'round', join: 'round' });
      g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ color: shade(1, dry), width: w * .8, alpha: .28, cap: 'round', join: 'round' });
    }
    for (let k = 0; k < 4; k++) {                                                       // a few striations that peel off the main streak
      const off = (r() - .5) * 9, s0 = Math.floor(r() * n * .4), e0 = Math.min(n - 1, s0 + Math.floor(n * (.4 + r() * .5)));
      if (e0 - s0 < 2) continue; const first = pts[s0]; g.moveTo(first[0] + off, first[1]);
      for (let i = s0 + 1; i <= e0; i++) g.lineTo(pts[i][0] + off * (1 + (i - s0) / 12), pts[i][1] - off * .3);
      g.stroke({ color: shade(k % 3, dry), width: .8 + r() * 1.4, alpha: .22 + r() * .2, cap: 'round' });
    }
  }

  /* ---------- Stage 3D: where the body struck a wall ----------
   * (x, y) is the point of the wall face that was hit, (nx, ny) points out of the wall onto the floor, sp is the impact speed (px/s).
   * A smear along the base of the wall and spray thrown back onto the floor, sized by the impact; k grows it in (0..1).  Every variant gets
   * it where its body really hit (the physics' own contact), not only the hound's scripted wall slam. */
  function wallMark(g, x, y, nx, ny, sp, seed, fresh, k, floor) {
    const r = rng(seed * 977 + 31), tx = -ny, ty = nx, dry = 1 - fresh, size = clamp((sp - 60) / 260, .25, 1), L = (9 + 13 * size) * k, off = 1 + (7 * size + 2) / 2, bx = x + nx * off, by = y + ny * off;   // the stroke's edge stays on the floor
    if (!onFloor(floor, bx, by)) return;
    // the smear runs along the foot of the wall only as far as there is floor beside it (it stops at a corner or a pillar)
    const run = s => { let d = 0; while (d < L && onFloor(floor, bx + tx * s * (d + 3), by + ty * s * (d + 3))) d += 3; return Math.min(L, d); }, La = run(-1), Lb = run(1);
    g.moveTo(bx - tx * La, by - ty * La).lineTo(bx + tx * Lb, by + ty * Lb).stroke({ color: shade(2, dry), width: 7 * size + 2, alpha: .42 * k, cap: 'round' });
    g.moveTo(bx - tx * La * .7 + nx, by - ty * La * .7 + ny).lineTo(bx + tx * Lb * .55 + nx, by + ty * Lb * .55 + ny).stroke({ color: shade(0, dry), width: 2.2 + 2 * size, alpha: .62 * k, cap: 'round' });
    const n = 8 + Math.round(12 * size), base = Math.atan2(ny, nx);
    for (let i = 0; i < n; i++) {
      const a = base + (r() - .5) * 2.1, d = (4 + Math.pow(r(), 1.6) * (16 + 30 * size)) * k, sz = .6 + Math.pow(r(), 2) * 2.2, px = bx + Math.cos(a) * d, py = by + Math.sin(a) * d;
      if (!dropOk(floor, px, py, a, sz, 1 + Math.min(3.5, d / 14))) continue;
      drop(g, px, py, a, sz, 1 + Math.min(3.5, d / 14), shade(r() < .5 ? 1 : 2, dry), .85);
    }
  }
  /* the strongest wall impacts of a death: the physics' own selection (dphys.marks), so the corpse record carries the same ones */
  const impacts = S => window.__dphys && window.__dphys.marks ? window.__dphys.marks(S) : [];
  /* a wall mark in a corpse record's blood list: seed 512 + the direction out of the wall in 32 steps (an older client draws it as a small pool) */
  const MARK = 512, isMark = s => s >= MARK && s < MARK + 32, markSeed = (nx, ny) => MARK + ((Math.round(Math.atan2(ny, nx) / TAU * 32) % 32) + 32) % 32;
  const markDir = s => { const a = (s - MARK) / 32 * TAU; return [Math.cos(a), Math.sin(a)]; };

  /* ---------- live death animation (called every frame in place of the old drawBlood) ---------- */
  function fx(g, d, t, floor) {
    /* Stage 3D: the blood is redrawn only when something visible changed (a pool still growing, spray in flight, the drying colour moving
     * on a step, the trail getting longer); once the death has settled that is a few times a second instead of every frame */
    const walls = d.ph ? impacts(d.ph) : [];
    const tl = d.trail && d.trail.length ? d.trail[d.trail.length - 1] : null;
    let sig = d.bursts.length + '|' + (d.trail ? d.trail.length : 0) + (tl ? ',' + Math.round(tl[0]) + ',' + Math.round(tl[1]) : '') + '|' + walls.length;
    for (const b of d.bursts) { const r = t - b.at; sig += r < 0 ? '|-' : r < .2 ? '|' + Math.round(r * 120) : '|' + Math.round(clamp(r / 1.6) * 48) + ',' + Math.round(clamp(r * 3.4) * 40) + ',' + Math.round(clamp(r / 9) * 24); }
    for (const w of walls) { const r = t - w.t; sig += r < 0 ? '|w-' : '|w' + Math.round(clamp(r / .45) * 30) + ',' + Math.round(clamp(r / 9) * 24); }
    if (d.ph) sig += '|tr' + Math.round(clamp((t - 1) / 4) * 24);
    else sig += '|s' + Math.round(t * 30);
    if (g.__goreSig === sig) return; g.__goreSig = sig;
    g.clear();
    for (const b of d.bursts) {
      const r = t - b.at; if (r < 0) continue;
      const geo = b.geo || (b.geo = { shape: poolShape(b.seed + 1 + (d.kind === 'Smiler' ? 40 : 0)), drops: spatterSet(b.seed + 3, d.angle) });
      if (geo.lim === undefined) geo.lim = reach(b.x, b.y, geo.shape);
      const grow = 1 - Math.pow(1 - clamp(r / 1.6), 3), R = 4 + grow * 7.5, fresh = 1 - clamp(r / 9);
      drawPool(g, b.x, b.y, R, geo.shape, fresh, b.seed, d.direction.x, d.direction.y, geo.lim);
      const sp = clamp(r * 3.4);
      for (const s of geo.drops) {
        const x = b.x + Math.cos(s.a) * s.d * sp, y = b.y + Math.sin(s.a) * s.d * sp;
        const el = 1 + (s.el - 1) * (r < .3 ? 1 : .55);
        if (sp >= 1) { if (s.ok === undefined) s.ok = dropOk(floor, x, y, s.a, s.s, 1 + (s.el - 1) * .55); if (!s.ok) continue; } else if (!dropOk(floor, x, y, s.a, s.s, el)) continue;
        drop(g, x, y, s.a, s.s * (.6 + .4 * sp), 1 + (s.el - 1) * (r < .3 ? 1 : .55), shade(s.c < .5 ? 1 : 2, 1 - fresh), .9);
      }
      if (r < .16) for (let k = 0; k < 4; k++) {          // arterial spray: short bright arcs that die fast
        const a = d.angle + (k - 1.5) * .34 + Math.sin(b.seed * 5 + k) * .2, l = 14 + (k * 37 + b.seed * 13) % 26, f = r / .16;
        g.moveTo(b.x + Math.cos(a) * l * f * .35, b.y + Math.sin(a) * l * f * .35)
          .lineTo(b.x + Math.cos(a) * l * f, b.y + Math.sin(a) * l * f).stroke({ color: 0xa3201a, width: 1.6 * (1 - f) + .6, alpha: .8 * (1 - f), cap: 'round' });
      }
    }
    for (const w of walls) { const r = t - w.t; if (r >= 0) wallMark(g, w.x, w.y, w.nx, w.ny, w.sp, Math.round(w.x * 7 + w.y * 13) & 1023, 1 - clamp(r / 9), clamp(r / .45), floor); }
    if (d.ph) { if (d.trail && d.trail.length > 1 && d.bursts.length) smearPath(g, d.trail, d.bursts[0].seed + 9, 1 - clamp((t - 1) / 4)); }
    else if (t > (d.dw ? d.dw[0] : 2.03) && d.bursts.length) { const b = d.bursts[d.bursts.length - 1]; smear(g, b.x, b.y, d.body.x, d.body.y, b.seed + 9, 1 - clamp((t - 2) / 3)); }
  }

  /* ---------- static remains for corpses ---------- */
  function corpse(g, rec, floor) {
    const dry = .82;
    g.ellipse(rec.x, rec.y + 2, 21, 27).fill({ color: 0x000000, alpha: .09 });                 // contact shadow grounds the body
    const pools = rec.blood.filter(b => !isMark(b.seed)), marks = rec.blood.filter(b => isMark(b.seed));
    for (const b of marks) { const [nx, ny] = markDir(b.seed); wallMark(g, b.x, b.y, nx, ny, 220, Math.round(b.x * 7 + b.y * 13) & 1023, 1 - dry, 1, floor); }
    pools.forEach((b, i) => {
      const shape = poolShape(b.seed + 1 + (rec.cause === 'Smiler' ? 40 : 0));
      const spr = spatterSet(b.seed + 3, rec.attackAngle);
      for (const s of spr) { const x = b.x + Math.cos(s.a) * s.d, y = b.y + Math.sin(s.a) * s.d; if (dropOk(floor, x, y, s.a, s.s, 1 + (s.el - 1) * .55)) drop(g, x, y, s.a, s.s, 1 + (s.el - 1) * .55, shade(s.c < .5 ? 1 : 2, dry), .85); }
      drawPool(g, b.x, b.y, rec.hands ? 9 + (i % 2) * 1.5 : 17 + (i % 2) * 2, shape, 1 - dry + .12, b.seed, Math.cos(rec.attackAngle), Math.sin(rec.attackAngle), reach(b.x, b.y, shape));
    });
    const last = pools[pools.length - 1];
    if (rec.trail && rec.trail.length > 1) smearPath(g, rec.trail, (last ? last.seed : 1) + 9, .1); else if (last && !rec.hands) smear(g, last.x, last.y, rec.x, rec.y, last.seed + 9, .1);
    // the pool under the torso (smaller when the body came to rest where it fell: it did not lie in it for long)
    const ts = poolShape(hash(String(rec.id)) % 997);
    drawPool(g, rec.x, rec.y, rec.hands ? 15 : 25, ts, .28, 1, Math.cos(rec.attackAngle), Math.sin(rec.attackAngle), reach(rec.x, rec.y, ts));
  }

  /* ---------- wounds drawn ON the avatar (local coords: torso ~ x -14..14, y -14..10) ---------- */
  function gash(g, cx, cy, len, wid, ang, r, e) {
    const ca = Math.cos(ang), sa = Math.sin(ang), n = 14, curve = (r() - .5) * 3.2, ph = r() * 6, A = [];
    for (let i = 0; i <= n; i++) {                       // lens-shaped tear: tapered ends, slight bow, gently irregular width
      const t = i / n, h = wid / 2 * Math.pow(Math.sin(Math.PI * t), .75) * (.86 + .28 * Math.sin(ph + t * 11)) + (i > 0 && i < n ? (r() - .5) * .35 : 0);
      A.push([(t - .5) * len, curve * Math.sin(Math.PI * t) + (r() - .5) * .25, Math.max(.05, h)]);
    }
    const ring = grow => { const o = [], q = []; for (const [u, v, h] of A) { const H = Math.max(0, h + grow); o.push(cx + u * ca - (v - H) * sa, cy + u * sa + (v - H) * ca); q.push(cx + u * ca - (v + H) * sa, cy + u * sa + (v + H) * ca); } return o.concat(q.reverse()); };
    const a = Math.min(1, e * 1.2);
    g.poly(ring(3.6)).fill({ color: 0x6b2f2a, alpha: .2 * a });                                        // bruising
    g.poly(ring(2.2)).fill({ color: 0x5a1210, alpha: .3 * a });                                        // blood-wet fabric around it
    g.poly(ring(1.15)).fill({ color: 0xb48470, alpha: .75 * a });                                      // torn dermis lip
    g.poly(ring(.5)).fill({ color: 0x8c1a16, alpha: .96 * a });                                        // wet red rim
    g.poly(ring(-.55)).fill({ color: 0x260404, alpha: .98 * a });                                      // depth of the wound
    g.poly(ring(-1.25)).fill({ color: 0x0e0101, alpha: .9 * a });
    g.moveTo(cx - ca * len * .34 - (-curve * .3) * sa, cy - sa * len * .34).lineTo(cx + ca * len * .3, cy + sa * len * .3).stroke({ color: 0xffe6d8, width: .7, alpha: .28 * a });   // wet glint
    for (const end of [-.5, .5]) g.circle(cx + ca * len * end, cy + sa * len * end, .9).fill({ color: 0x6d0d0b, alpha: .85 * a });
    const mid = A[Math.floor(n / 2)], mx = cx + mid[0] * ca - (mid[1] + mid[2]) * sa, my = cy + mid[0] * sa + (mid[1] + mid[2]) * ca, dl = (4 + r() * 6) * e;
    g.moveTo(mx, my).lineTo(mx - sa * dl, my + ca * dl).stroke({ color: 0x5a0a09, width: 1.3, alpha: .85 * a, cap: 'round' });
    g.circle(mx - sa * dl, my + ca * dl, 1.2).fill({ color: 0x5a0a09, alpha: .85 * a });
  }
  function puncture(g, cx, cy, rad, r, e) {
    const a = Math.min(1, e * 1.2), pts = [], N = 11;
    for (let i = 0; i < N; i++) { const t = i / N * TAU, m = 1 + (r() - .5) * .7 + (i % 2 ? .18 : -.08); pts.push(cx + Math.cos(t) * rad * m, cy + Math.sin(t) * rad * m * .9); }
    const grow = k => pts.map((v, i) => i % 2 ? cy + (v - cy) * k : cx + (v - cx) * k);
    g.poly(grow(2.6)).fill({ color: 0x4a2340, alpha: .3 * a });
    g.poly(grow(1.7)).fill({ color: 0x8e5b4c, alpha: .5 * a });
    g.poly(grow(1.25)).fill({ color: 0x7e1411, alpha: .95 * a });
    g.poly(pts).fill({ color: 0x180202, alpha: .98 * a });
    for (let k = 0; k < 3; k++) { const t = r() * TAU; g.moveTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad).lineTo(cx + Math.cos(t) * (rad + 3 + r() * 4), cy + Math.sin(t) * (rad + 3 + r() * 4)).stroke({ color: 0x6b1210, width: 1.1, alpha: .75 * a }); }
    g.circle(cx - rad * .3, cy - rad * .3, .9).fill({ color: 0xfff0e6, alpha: .3 * a });
  }
  function soak(g, cx, cy, s, r, e) {                     // blood wicking into the clothing
    for (let k = 0; k < 6; k++) g.ellipse(cx + (r() - .5) * 2, cy + (r() - .5) * 2, s * (1 - k * .13), s * .82 * (1 - k * .13)).fill({ color: k < 3 ? 0x420907 : 0x2a0403, alpha: .11 * e });
  }
  function wounds(g, e, key, cause) {
    const r = rng(hash(String(key)) + 17), c = cause || (r() < .6 ? 'Hound' : 'Smiler');
    g.ellipse(0, -1, 14.5, 12.5).fill({ color: 0x4a3f4a, alpha: .2 * e });                     // livor: skin and cloth go grey-blue
    g.ellipse(-5, 3, 7, 5).fill({ color: 0x5c3a52, alpha: .14 * e }); g.ellipse(6, -5, 5, 4).fill({ color: 0x5c3a52, alpha: .1 * e });
    // clothes soak first, then the wounds on top
    soak(g, -3, -3, 15 + 4 * e, r, e); soak(g, 7, 2, 10, r, e); soak(g, -8, 4, 8, r, e);
    if (c === 'Hound') {                                   // rake of claws across shoulder/back + a deep gash on the flank
      const base = -.55 + (r() - .5) * .5, ox = -3 + (r() - .5) * 4, oy = -6 + (r() - .5) * 4;
      for (let i = 0; i < 3; i++) gash(g, ox + i * 5.2 - 4, oy + i * 1.6, 15 + r() * 7, 2.4 + r() * 1.8, base + (r() - .5) * .16, r, e);
      gash(g, 6 + (r() - .5) * 3, 5, 12 + r() * 4, 3.6, .9 + (r() - .5) * .4, r, e);
    } else {                                               // stabbing bites: punctures with bruising and one long tear
      puncture(g, -4 + (r() - .5) * 3, -5, 3.4 + r(), r, e); puncture(g, 5 + (r() - .5) * 3, -2, 3 + r(), r, e); puncture(g, -1, 5 + (r() - .5) * 3, 3.6 + r(), r, e);
      gash(g, 3, -8, 13 + r() * 4, 3.1, .3 + (r() - .5) * .5, r, e);
    }
  }

  window.__gore = { fx, corpse, wounds, drawPool, poolShape, smear, wallMark, impacts, markSeed, ownsWalls: true };
})();
