/* l0-remaster.js - Stage 3B: the Level 0 visual remaster (presentation only, client only).  3B1: the representative slice.
 *
 * THE LEVEL MAY LOOK NEW.  IT MUST PLAY IN THE SAME PLACES.  This module only paints: it reads the running game (room
 * table, floor mask, lamp list, world.js props) and the presentation authority assets/level0_visuals.js, and draws
 * material art over the existing level art.  It never writes game state, never sends anything, never adds a blocker or a
 * light, and never touches BR-RoLE: lighting, shadows and the line-of-sight blackout stay exactly BR-RoLE 1.0's.
 *
 * How it sits in the scene (two guarded hooks in the bundle's renderer build(), undone byte for byte by the freeze tool):
 *   lamp(t, e, lampTop)        while build() draws the 90 fixture housings: a lamp in a remastered room draws its legacy
 *                              housing into this module's own Graphics instead of lampTop (shown only when the remaster is
 *                              off), so new and old housings never stack.  Every other lamp is untouched.
 *   built(world, level, top)   at the end of build(): the remaster layer goes right above the level art (below the
 *                              objective traces, corpses and every actor), the ceiling layer right above lampTop, sharing
 *                              its parallax and alpha.  With ?remaster=off neither hook does anything: exactly v23.3.6.
 * In the slice rooms the remaster layer is opaque, so the legacy floor blots, painted lamp glows, the BLACKOUT ZONE's
 * painted black and the old wall / prop art are covered, not edited; switching the remaster off shows them again, live.
 * BR-RoLE's static wall grounding lies under the level art; the remaster redraws the same grounding (same falloff, width
 * and alpha) on its own floor, following BR-RoLE's visibility, so walls stay grounded exactly as elsewhere.
 *
 * Static art is paid once: textures are generated from the seeded presentation hash when the level is built (carpet tile,
 * wallpaper, wall cap, decals, props, fixtures; per-room low-resolution wear / damp maps), geometry is static Graphics,
 * per-room containers are culled by the view.  Nothing is drawn per frame.  LOW uses smaller textures and fewer decals.
 * DEV comparison only (QA tools, not player settings): ?remaster=off, ?walldepth=on, ?decals=off; with ?dev3b the keys
 * F8 (remaster), F9 (wall-depth cue) and Shift+F8 (decals) toggle live. */
(() => {
  'use strict';
  if (window.__l0v) return;
  const VERSION = 'l0-remaster 3b-qa1';
  const VZ = window.L0_VISUALS || null;
  const T = 96;
  const Q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
  const S = {
    on: Q.get('remaster') !== 'off',                     // the hooks act at all (off: the game is exactly v23.3.6 / BR-RoLE 1.0)
    want: true,                                          // shown (DEV toggle)
    depth: Q.get('walldepth') === 'on', decals: Q.get('decals') !== 'off', dev: Q.has('dev3b'),
    disabled: VZ ? '' : 'presentation data missing', built: false, world: null, level: null, lampTop: null, G: null, C: null, Tex: null,
    root: null, ceil: null, legacyLamps: null, ownLamps: [], rooms: [], tier: '', tex: null, brRoot: null, frame: 0, errors: 0, tag: null,
    stats: { buildMs: 0, rooms: 0, textures: 0, texMPx: 0, decals: 0, faces: 0, floorRects: 0, fixtures: 0, visibleRooms: 0, builds: 0 },
  };
  const now = () => Date.now();                        // wall clock for the build timings (a test may freeze performance.now)
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const api = () => window.__api || null;
  const isFloor = (cx, cy) => { const A = api(); return !!(A && A.zc(cx, cy)); };

  /* ---------- colour ---------- */
  const rgb = h => { const n = parseInt(String(h).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hexOf = c => ((clamp(Math.round(c[0]), 0, 255) << 16) | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[2]), 0, 255));
  const css = (c, a = 1) => `rgba(${clamp(Math.round(c[0]), 0, 255)},${clamp(Math.round(c[1]), 0, 255)},${clamp(Math.round(c[2]), 0, 255)},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const MAT = id => (VZ && VZ.material(id)) || {};

  /* ---------- seeded noise (presentation PRNG only) ---------- */
  function vnoise(key, L) {                              // periodic value noise, L lattice cells per period; f(u, v) in lattice units
    const r = VZ.rng('noise', key, L), g = new Float32Array(L * L); for (let i = 0; i < g.length; i++) g[i] = r();
    return (u, v) => {
      const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const xa = ((x0 % L) + L) % L, ya = ((y0 % L) + L) % L, xb = (xa + 1) % L, yb = (ya + 1) % L;
      const a = g[ya * L + xa], b = g[ya * L + xb], c = g[yb * L + xa], d = g[yb * L + xb];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  function vnoise2(key, Lx, Ly) {                       // periodic, anisotropic: Lx cells across, Ly cells down per period
    const r = VZ.rng('noise2', key, Lx, Ly), g = new Float32Array(Lx * Ly); for (let i = 0; i < g.length; i++) g[i] = r();
    return (u, v) => {
      const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const xa = ((x0 % Lx) + Lx) % Lx, ya = ((y0 % Ly) + Ly) % Ly, xb = (xa + 1) % Lx, yb = (ya + 1) % Ly;
      const a = g[ya * Lx + xa], b = g[ya * Lx + xb], c = g[yb * Lx + xa], d = g[yb * Lx + xb];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  function fieldNoise(key, x0, y0, w, h, cell) {         // non-periodic value noise over a world rectangle (cell px lattice)
    const nx = Math.ceil(w / cell) + 2, ny = Math.ceil(h / cell) + 2, r = VZ.rng('field', key, x0, y0, cell), g = new Float32Array(nx * ny);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
      const u = clamp((x - x0) / cell, 0, nx - 1.001), v = clamp((y - y0) / cell, 0, ny - 1.001), i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), a = g[j * nx + i], b = g[j * nx + i + 1], c = g[(j + 1) * nx + i], d = g[(j + 1) * nx + i + 1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }

  /* ---------- canvases and textures ---------- */
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  function texOf(canvas, o = {}) {
    let t = null;
    try { t = S.Tex.from({ resource: canvas, autoGenerateMipmaps: !!o.mip, scaleMode: 'linear', addressModeU: o.u || 'clamp-to-edge', addressModeV: o.v || 'clamp-to-edge' }); } catch (e) { t = null; }
    if (!t || !t.source) t = S.Tex.from(canvas);
    try { const st = t.source.style; if (st) { st.addressModeU = o.u || 'clamp-to-edge'; st.addressModeV = o.v || 'clamp-to-edge'; st.scaleMode = 'linear'; if (o.mip) st.mipmapFilter = 'linear'; } if (o.mip) t.source.autoGenerateMipmaps = true; } catch (e) { }
    S.stats.textures++; S.stats.texMPx += canvas.width * canvas.height / 1e6; (S.texList || (S.texList = [])).push(t);
    return t;
  }
  const M = (a, b, c, d, tx, ty) => ({ a, b, c, d, tx, ty });   // a Pixi Matrix-shaped object: world = M x texel

  /* ======================================================================================================================
   * MATERIAL ART (2D canvas, generated once per quality tier from the seeded hash)
   * ==================================================================================================================== */

  /* carpet: a seamless tile.  Low-frequency mottling, heathered pile grain, a faint nap direction and sparse fibre specks;
   * contrast is kept low so it never crawls while you move (one texel is about one screen pixel at MEDIUM / HIGH). */
  function carpetCanvas(N, key) {
    const m = MAT('material:carpet'), B = rgb(m.base), F = rgb(m.fiber), L = rgb(m.light);
    const c = mkCanvas(N, N), x2 = c.getContext('2d'), img = x2.createImageData(N, N), d = img.data;
    /* the slow, low-frequency part (mottling, hue drift, nap streaks) on a quarter-resolution periodic grid, then sampled
     * bilinearly per pixel; only the fine pile grain is evaluated per pixel */
    const Q4 = N / 4, lo = new Float32Array(Q4 * Q4 * 3);
    const m1 = vnoise(key + ':m1', 4), m2 = vnoise(key + ':m2', 9), m3 = vnoise(key + ':m3', 21), hue = vnoise(key + ':h', 6);
    const NX = Math.max(4, Math.round(N / 7)), NY = Math.max(2, Math.round(N / 48)), nap = vnoise2(key + ':nap', NX, NY);   // soft streaks along y
    for (let j = 0; j < Q4; j++) for (let i = 0; i < Q4; i++) {
      const u = i / Q4, v = j / Q4, k = (j * Q4 + i) * 3;
      lo[k] = (m1(u * 4, v * 4) - .5) * .55 + (m2(u * 9, v * 9) - .5) * .3 + (m3(u * 21, v * 21) - .5) * .22;
      lo[k + 1] = hue(u * 6, v * 6); lo[k + 2] = nap(u * NX, v * NY) - .5;
    }
    const L1 = Math.max(8, Math.round(N / 3.2)), L2 = Math.max(8, Math.round(N / 1.7)), g1 = vnoise(key + ':g1', L1), g2 = vnoise(key + ':g2', L2);
    const r = VZ.rng('carpet-specks', key, N);
    for (let y = 0; y < N; y++) {
      const fy = y / 4, j0 = Math.floor(fy) % Q4, j1 = (j0 + 1) % Q4, ty = fy - Math.floor(fy);
      for (let x = 0; x < N; x++) {
        const fx = x / 4, i0 = Math.floor(fx) % Q4, i1 = (i0 + 1) % Q4, tx = fx - Math.floor(fx);
        const a0 = (j0 * Q4 + i0) * 3, a1 = (j0 * Q4 + i1) * 3, b0 = (j1 * Q4 + i0) * 3, b1 = (j1 * Q4 + i1) * 3;
        const sl = q => (lo[a0 + q] * (1 - tx) + lo[a1 + q] * tx) * (1 - ty) + (lo[b0 + q] * (1 - tx) + lo[b1 + q] * tx) * ty;
        const mot = sl(0), h = sl(1), np = sl(2);
        const gr = (g1(x * L1 / N, y * L1 / N) - .5) + (g2(x * L2 / N, y * L2 / N) - .5) * .45;
        let col = mix(B, h > .5 ? L : F, Math.abs(h - .5) * .55);
        let k = 1 + mot * .1 + gr * .085 + np * .035;
        const s = r(); if (s < .03) k *= .9 + r() * .05; else if (s > .982) k *= 1.05 + r() * .04;     // single fibre tips
        col = mix(col, F, clamp(-gr, 0, .5) * .35);                         // grain shadows lean olive, not grey
        const i = (y * N + x) * 4; d[i] = clamp(col[0] * k, 0, 255); d[i + 1] = clamp(col[1] * k, 0, 255); d[i + 2] = clamp(col[2] * k, 0, 255); d[i + 3] = 255;
      }
    }
    x2.putImageData(img, 0, 0); return c;
  }

  /* wallpaper in FACE space: u runs along the wall (repeats, 192 px), v rises from the floor crease (0) to 48 px.
   * Baseboard 0..9 px (scuffed trim, lighter top bevel), then paper: vertical stripes, a small chevron motif, roll seams,
   * grime that thickens toward the base.  Only about the lowest 24 px are ever seen (the game's sight shape enters walls
   * by 24 px), so all of the character sits there. */
  function wallpaperCanvas(s, prof, key) {
    const W = 192, H = 48, cw = Math.round(W * s), ch = Math.round(H * s), m = MAT('material:wallpaper'), bb = MAT('material:baseboard');
    const tone = (prof && prof.wallpaper && prof.wallpaper.tone) || 1, cond = prof && prof.wallpaper ? prof.wallpaper.condition : .9;
    const c = mkCanvas(cw, ch), x = c.getContext('2d'), img = x.createImageData(cw, ch), d = img.data;
    const P = mul(rgb(m.base), tone), St = mul(rgb(m.stripe), tone), Mo = rgb(m.motif), Gr = rgb(m.grime), Bb = rgb(bb.base), Bt = rgb(bb.top), Sc = rgb(bb.scuff);
    const gN = vnoise(key + ':grime', 24), pN = vnoise(key + ':paper', 64), scN = vnoise(key + ':scuff', 40), r = VZ.rng('wallpaper', key, s);
    const BASE = 9;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const u = i / s, v = (ch - 1 - j) / s;                                // canvas row 0 is the top (v = 48): v grows upward
      let col;
      if (v < BASE) {                                                       // baseboard
        const bev = v > BASE - 1.6 ? 1.18 : v > BASE - 3 ? 1.06 : 1;        // rounded top edge catches light
        const sc = scN(u / 192 * 40, v / 9 * 3) > .74 ? .82 : 1;             // scuffs from shoes and mops
        col = mul(mix(Bb, Bt, v / BASE * .5), bev * sc);
        if (v < 1.2) col = mul(col, .62);                                    // the crease against the carpet
      } else {
        const sp = .5 + .5 * Math.sin(u / 16 * Math.PI * 2), strip = mix(P, St, sp * .32);   // soft 16 px stripe pairs
        const mu = u % 24, mv = (v - BASE) % 16, mot = Math.abs(mu - 12) < 3 - Math.abs(mv - 8) * .5 && Math.abs(mv - 8) < 3 ? .5 : 0;   // a small chevron
        col = mix(strip, Mo, mot * .32);
        const seam = Math.abs((u % 48) - 0.5) < .6 ? .93 : Math.abs((u % 48) - 1.5) < .5 ? 1.03 : 1;   // roll seam, a lifted edge beside it
        const grime = (1 - sm(BASE, BASE + 26, v)) * (.28 + (1 - cond) * .5) * (.6 + gN(u / 192 * 24, v / 48 * 3) * .8);
        col = mix(col, Gr, clamp(grime, 0, .7)); col = mul(col, seam * (1 + (pN(u / 192 * 64, v / 48 * 16) - .5) * .06));
        if (v < BASE + 1.4) col = mul(col, .8);                             // shadow line under the paper's lip
      }
      const n = 1 + (r() - .5) * .04, k = (j * cw + i) * 4;
      d[k] = clamp(col[0] * n, 0, 255); d[k + 1] = clamp(col[1] * n, 0, 255); d[k + 2] = clamp(col[2] * n, 0, 255); d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }

  /* the uniform 18 px face of the DEV wall-depth cue (donor-inspired, top-down only): baseboard, paper darkening toward the
   * crease, and a lit lip at the top edge where the face meets the wall's top */
  function depthFaceCanvas(s, prof, key) {
    const src = wallpaperCanvas(s, prof, key + ':depth'), W = 192, H = 18, cw = Math.round(W * s), ch = Math.round(H * s);
    const c = mkCanvas(cw, ch), x = c.getContext('2d');
    x.drawImage(src, 0, src.height - ch, cw, ch, 0, 0, cw, ch);              // the lowest 18 px of the paper
    const g = x.createLinearGradient(0, ch, 0, 0); g.addColorStop(0, 'rgba(20,16,6,.35)'); g.addColorStop(.6, 'rgba(20,16,6,0)'); g.addColorStop(1, 'rgba(255,248,215,.0)');
    x.fillStyle = g; x.fillRect(0, 0, cw, ch);
    x.fillStyle = 'rgba(255,246,206,.55)'; x.fillRect(0, 0, cw, Math.max(1, s * 1.6));             // the lip
    x.fillStyle = 'rgba(40,33,14,.6)'; x.fillRect(0, Math.max(1, s * 1.6), cw, Math.max(1, s * .8));
    return c;
  }

  /* the wall's top (almost never seen: the sight shape stops 24 px into a wall) */
  function capCanvas(N, key) {
    const m = MAT('material:wallcap'), B = rgb(m.base), D = rgb(m.dark), c = mkCanvas(N, N), x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
    const n1 = vnoise(key + ':c1', 8), n2 = vnoise(key + ':c2', Math.round(N / 4));
    for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) { const k = (y * N + i) * 4, t = n1(i * 8 / N, y * 8 / N) * .6 + n2(i / 4, y / 4) * .4, col = mix(D, B, .55 + t * .45);
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255; }
    x.putImageData(img, 0, 0); return c;
  }

  /* BR-RoLE's static grounding falloff, the same law (width 50, alpha .56, power 1.35, 64 steps) */
  const AO = { width: 50, alpha: .56, steps: 64, power: 1.35 };
  function aoCanvas(w, h, at) { const c = mkCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.data[(j * w + i) * 4 + 3] = Math.round(255 * clamp(at(i, j), 0, 1)); x.putImageData(img, 0, 0); return c; }

  /* ---------- decals (each its own small canvas; drawn rotated through the Graphics transform) ---------- */
  function blob(x, r, cx, cy, rad, wob, n = 48) {                        // a smooth organic outline: a few low harmonics, no spikes
    const h = [2, 3, 4, 5, 7].map((k, i) => [k, (wob[i % wob.length] - .5) * .34 / (1 + i * .6), wob[(i + 5) % wob.length] * 6.283]);
    x.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; let k = 1; for (const [f, amp, ph] of h) k += amp * Math.sin(f * a + ph);
      const px = cx + Math.cos(a) * rad * k, py = cy + Math.sin(a) * rad * k * .86; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath();
  }
  function decalCanvases(s, key) {
    const out = {}, r = VZ.rng('decals', key, s), wob = n => Array.from({ length: n }, () => r());
    const make = (name, w, h, draw) => { const c = mkCanvas(w * s, h * s), x = c.getContext('2d'); x.scale(s, s); draw(x, w, h); (out[name] || (out[name] = [])).push({ c, w, h }); };
    const carpet = MAT('material:carpet'), St = rgb(carpet.stain), Dm = rgb(carpet.damp), Td = rgb(carpet.tide);
    for (let v = 0; v < 4; v++) make('stain', 64, 64, (x, w, h) => {      // a soaked-in spill: soft body, darker rim, satellite drops
      const g = x.createRadialGradient(32, 32, 2, 32, 32, 28); g.addColorStop(0, css(St, .5)); g.addColorStop(.75, css(St, .38)); g.addColorStop(1, css(St, 0));
      x.fillStyle = g; blob(x, r, 32, 32, 22 + r() * 5, wob(28)); x.fill();
      x.strokeStyle = css(mul(St, .8), .28); x.lineWidth = 1.4; blob(x, r, 32, 32, 21 + r() * 4, wob(28)); x.stroke();
      for (let i = 0; i < 5; i++) { x.fillStyle = css(St, .3 + r() * .2); x.beginPath(); x.arc(32 + (r() - .5) * 52, 32 + (r() - .5) * 52, 1 + r() * 2.5, 0, 7); x.fill(); }
    });
    for (let v = 0; v < 2; v++) make('ring', 24, 24, (x) => {              // a cup ring
      x.strokeStyle = css(St, .45); x.lineWidth = 1.6; x.beginPath(); x.arc(12, 12, 8 + r() * 1.5, r() * 6, r() * 6 + 5.4); x.stroke();
      x.strokeStyle = css(St, .18); x.lineWidth = 3; x.beginPath(); x.arc(12, 12, 8, 0, 7); x.stroke();
    });
    for (let v = 0; v < 3; v++) make('damp', 160, 160, (x) => {            // water damage: a soaked body, its edge drying darker (a soft tide line)
      const w1 = wob(12), g = x.createRadialGradient(80, 80, 6, 80, 80, 70); g.addColorStop(0, css(Dm, .3)); g.addColorStop(.75, css(Dm, .24)); g.addColorStop(1, css(Dm, .0));
      x.fillStyle = g; blob(x, r, 80, 80, 56, w1); x.fill();
      x.save(); x.filter = 'blur(1.6px)'; x.strokeStyle = css(Td, .2); x.lineWidth = 4; blob(x, r, 80, 80, 55, w1); x.stroke();
      x.strokeStyle = css(Td, .1); x.lineWidth = 3; blob(x, r, 80, 80, 41, wob(12)); x.stroke(); x.restore();
    });
    for (let v = 0; v < 3; v++) make('scuff', 48, 24, (x) => {             // a drag / pivot mark: a soft smudge of flattened, darker pile
      x.save(); x.filter = 'blur(2.2px)';
      for (let i = 0; i < 3; i++) { x.strokeStyle = css([70, 58, 32], .12 + r() * .08); x.lineWidth = 5 + r() * 4; x.lineCap = 'round'; x.beginPath(); const y0 = 9 + r() * 6; x.moveTo(8, y0); x.quadraticCurveTo(24, y0 + (r() - .5) * 9, 40, y0 + (r() - .5) * 5); x.stroke(); }
      x.restore();
    });
    for (let v = 0; v < 3; v++) make('paper', 22, 28, (x) => {             // a sheet of office paper: grey-white, faint lines, a crease
      x.fillStyle = 'rgba(26,22,12,.22)'; x.fillRect(2.5, 3, 18, 23.5);
      x.fillStyle = css([226, 221, 200]); x.fillRect(1.5, 1.5, 18, 23);
      x.fillStyle = 'rgba(120,112,90,.35)'; for (let i = 0; i < 6; i++) x.fillRect(4, 5 + i * 3, 9 + r() * 4, .7);
      x.strokeStyle = 'rgba(150,140,110,.35)'; x.lineWidth = .6; x.beginPath(); x.moveTo(1.5, 12 + r() * 4); x.lineTo(19.5, 11 + r() * 4); x.stroke();
      if (v === 2) { x.fillStyle = 'rgba(130,100,50,.25)'; x.beginPath(); x.arc(14, 18, 4, 0, 7); x.fill(); }
    });
    for (let v = 0; v < 2; v++) make('tape', 26, 8, (x) => {               // a strip of grey duct tape, frayed ends
      x.fillStyle = 'rgba(30,26,16,.2)'; x.fillRect(2, 2.5, 22, 4.6);
      x.fillStyle = css([150, 148, 136]); x.beginPath(); x.moveTo(2, 1.6); for (let i = 0; i <= 4; i++) x.lineTo(24 - (i % 2) * .8, 1.6 + i); x.lineTo(2 + (r() > .5 ? .8 : 0), 5.6); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(3, 2, 20, 1);
    });
    for (let v = 0; v < 3; v++) make('debris', 28, 28, (x) => {            // plaster crumbs and grit swept against a wall
      for (let i = 0; i < 16; i++) { const a = r() * 6.3, d2 = Math.pow(r(), 1.6) * 11, px = 14 + Math.cos(a) * d2, py = 14 + Math.sin(a) * d2, s2 = .5 + r() * 1.6;
        x.fillStyle = r() > .4 ? css([206, 199, 172], .85) : css([88, 76, 50], .7); x.fillRect(px - s2 / 2, py - s2 / 2, s2, s2 * (.6 + r() * .8)); }
    });
    for (let v = 0; v < 2; v++) make('shards', 40, 40, (x) => {            // a broken fluorescent tube: glass slivers, a white powder smear
      const g = x.createRadialGradient(20, 20, 1, 20, 20, 17); g.addColorStop(0, 'rgba(236,236,226,.28)'); g.addColorStop(1, 'rgba(236,236,226,0)'); x.fillStyle = g; x.fillRect(0, 0, 40, 40);
      for (let i = 0; i < 12; i++) { const a = r() * 6.3, d2 = r() * 15; x.save(); x.translate(20 + Math.cos(a) * d2, 20 + Math.sin(a) * d2); x.rotate(r() * 6.3);
        x.fillStyle = 'rgba(232,236,232,.75)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(1.2 + r() * 3, .3); x.lineTo(.4, .9 + r() * 1.4); x.closePath(); x.fill(); x.restore(); }
      x.fillStyle = 'rgba(110,104,90,.9)'; x.fillRect(4, 19, 4, 2); x.fillStyle = 'rgba(190,190,180,.6)'; x.fillRect(8, 19.2, 5, 1.6);   // a tube end cap
    });
    make('tile', 34, 34, (x) => {                                          // a fallen ceiling tile, broken: mineral fibre board
      x.fillStyle = 'rgba(30,26,16,.22)'; x.beginPath(); x.moveTo(3, 4); x.lineTo(32, 3); x.lineTo(31, 22); x.lineTo(22, 33); x.lineTo(4, 32); x.closePath(); x.fill();
      x.fillStyle = css([196, 190, 168]); x.beginPath(); x.moveTo(2, 2); x.lineTo(30, 1.5); x.lineTo(29.5, 20); x.lineTo(21, 31); x.lineTo(2.5, 30); x.closePath(); x.fill();
      for (let i = 0; i < 70; i++) { x.fillStyle = r() > .5 ? 'rgba(120,112,92,.35)' : 'rgba(240,236,220,.35)'; x.fillRect(3 + r() * 26, 3 + r() * 26, .8, .8); }
      x.strokeStyle = 'rgba(120,96,50,.35)'; x.lineWidth = 2.5; x.beginPath(); x.arc(10, 11, 5, 0, 7); x.stroke();    // an old leak ring on it
    });
    make('scorch', 64, 40, (x) => {                                        // soot fanning up from a burnt outlet (face space: base at the bottom)
      const g = x.createRadialGradient(32, 40, 2, 32, 30, 30); g.addColorStop(0, 'rgba(14,10,6,.75)'); g.addColorStop(.5, 'rgba(20,15,8,.38)'); g.addColorStop(1, 'rgba(20,15,8,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(20, 40); x.quadraticCurveTo(10, 14, 32, 2); x.quadraticCurveTo(54, 14, 44, 40); x.closePath(); x.fill();
    });
    const Mi = rgb(carpet.mildew || '#3c3f24');
    for (let v = 0; v < 2; v++) make('mildew', 56, 56, (x) => {           // mildew in the carpet: a dark, speckled bloom
      const g = x.createRadialGradient(28, 28, 2, 28, 28, 24); g.addColorStop(0, css(Mi, .32)); g.addColorStop(1, css(Mi, 0)); x.fillStyle = g; blob(x, r, 28, 28, 20, wob(12)); x.fill();
      for (let i = 0; i < 46; i++) { const a = r() * 6.3, d2 = Math.pow(r(), .8) * 22; x.fillStyle = css(mul(Mi, .7), .3 + r() * .35); x.beginPath(); x.arc(28 + Math.cos(a) * d2, 28 + Math.sin(a) * d2, .4 + r() * 1.2, 0, 7); x.fill(); }
    });
    make('mildewwall', 44, 30, (x) => {                                    // black mould creeping up a wall from the base (face space)
      for (let i = 0; i < 70; i++) { const px = 4 + r() * 36, py = 30 - Math.pow(r(), 1.8) * 26; x.fillStyle = css(Mi, .25 + r() * .4); x.beginPath(); x.arc(px, py, .4 + r() * 1.3, 0, 7); x.fill(); }
      const g = x.createLinearGradient(0, 30, 0, 8); g.addColorStop(0, css(Mi, .35)); g.addColorStop(1, css(Mi, 0)); x.fillStyle = g; x.fillRect(4, 8, 36, 22);
    });
    make('outlet', 12, 16, (x) => {                                        // a duplex outlet plate (face space)
      x.fillStyle = 'rgba(20,16,8,.3)'; x.fillRect(1.5, 1.5, 10, 14); x.fillStyle = css([214, 208, 186]); x.fillRect(1, 1, 9.5, 13.5);
      x.fillStyle = 'rgba(40,36,26,.85)'; x.fillRect(3.5, 3.5, 1, 2.6); x.fillRect(6.6, 3.5, 1, 2.6); x.fillRect(3.5, 9.4, 1, 2.6); x.fillRect(6.6, 9.4, 1, 2.6);
    });
    make('jbox', 18, 18, (x) => {                                          // a grey junction box with a conduit stub (face space)
      x.fillStyle = 'rgba(20,16,8,.35)'; x.fillRect(2, 2, 15, 15); x.fillStyle = css([128, 132, 128]); x.fillRect(1, 1, 14.5, 14.5);
      x.fillStyle = css([158, 162, 158]); x.fillRect(2.2, 2.2, 12, 1.4); x.fillStyle = 'rgba(30,30,30,.7)'; x.fillRect(3, 5, 1.2, 1.2); x.fillRect(12, 12, 1.2, 1.2);
      x.fillStyle = css([110, 114, 110]); x.fillRect(6.5, 15.5, 3.5, 2.5);
    });
    make('peel', 16, 22, (x) => {                                          // a seam lifting from the base: paper curling away, its backing showing (face space)
      x.fillStyle = css(rgb(MAT('material:wallpaper').backing), .85); x.beginPath(); x.moveTo(5, 22); x.lineTo(5, 9); x.quadraticCurveTo(8, 6, 11, 8); x.lineTo(12, 22); x.closePath(); x.fill();
      x.fillStyle = 'rgba(40,32,14,.32)'; x.beginPath(); x.moveTo(11, 8); x.quadraticCurveTo(14, 11, 13.5, 22); x.lineTo(12, 22); x.quadraticCurveTo(12.5, 13, 10, 10); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,248,220,.35)'; x.lineWidth = .7; x.beginPath(); x.moveTo(5, 21); x.lineTo(5, 9); x.quadraticCurveTo(8, 6, 11, 8); x.stroke();
    });
    make('dampwall', 70, 40, (x) => {                                      // water wicking up a wall from the base (face space)
      const g = x.createLinearGradient(0, 40, 0, 0); g.addColorStop(0, css(Dm, .5)); g.addColorStop(.6, css(Dm, .22)); g.addColorStop(1, css(Dm, 0));
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 40); for (let i = 0; i <= 10; i++) x.lineTo(i * 7, 40 - 14 - r() * 18 * Math.sin(i / 10 * Math.PI)); x.lineTo(70, 40); x.closePath(); x.fill();
      x.strokeStyle = css(Td, .3); x.lineWidth = 1.3; x.beginPath(); x.moveTo(2, 34); for (let i = 1; i <= 9; i++) x.lineTo(i * 7.4, 40 - 13 - r() * 16 * Math.sin(i / 10 * Math.PI)); x.stroke();
    });
    return out;
  }

  /* ---------- props (exact world.js rects; the art never leaves the footprint except a soft contact shade) ---------- */
  const PAD = 12;                                        // texture margin around a prop for its contact shade
  function contact(x, w, h, k = .38, rr = 4) {           // soft ambient contact all round (not a directional shadow: BR-RoLE owns those)
    for (let i = 6; i >= 1; i--) { x.fillStyle = `rgba(16,12,4,${k / 6})`; const e = i * 1.4; x.beginPath(); x.roundRect(PAD - e, PAD - e, w + e * 2, h + e * 2, rr + e); x.fill(); }
  }
  function counterCanvas(s, p, prof, key) {              // laminate reception counter: kick panel to the south, worn front edge, a few things
    const w = p.rect.w, h = p.rect.h, c = mkCanvas((w + PAD * 2) * s, (h + PAD * 2) * s), x = c.getContext('2d'), r = VZ.rng('prop', key, p.id); x.scale(s, s);
    contact(x, w, h);
    x.translate(PAD, PAD);
    x.fillStyle = '#4e4129'; x.beginPath(); x.roundRect(0, 0, w, h, 3); x.fill();                          // body
    x.fillStyle = '#3d3220'; x.fillRect(0, h - 7, w, 7);                                                   // kick panel / front face
    for (let i = 1; i < 3; i++) { x.fillStyle = 'rgba(20,16,8,.6)'; x.fillRect(w * i / 3 - .7, h - 7, 1.4, 7); }
    const top = x.createLinearGradient(0, 0, 0, h - 7); top.addColorStop(0, '#d9ccA2'); top.addColorStop(1, '#c7b98c'); x.fillStyle = top; x.beginPath(); x.roundRect(1.5, 1.5, w - 3, h - 9, 2); x.fill();
    for (let i = 0; i < 260; i++) { x.fillStyle = r() > .5 ? 'rgba(120,104,70,.18)' : 'rgba(255,250,230,.16)'; x.fillRect(2 + r() * (w - 4), 2 + r() * (h - 11), .9, .9); }   // laminate fleck
    x.strokeStyle = 'rgba(92,76,46,.9)'; x.lineWidth = 1.2; x.beginPath(); x.roundRect(1.5, 1.5, w - 3, h - 9, 2); x.stroke();          // edge banding
    x.fillStyle = 'rgba(255,248,224,.35)'; x.fillRect(3, 2.4, w - 6, 1);                                                                  // the back edge catches light
    const wear = x.createLinearGradient(0, h - 9, 0, h - 20); wear.addColorStop(0, 'rgba(90,70,40,.32)'); wear.addColorStop(1, 'rgba(90,70,40,0)'); x.fillStyle = wear; x.fillRect(3, h - 20, w - 6, 11);   // hands rest on the front edge
    for (let i = 1; i < 3; i++) { x.fillStyle = 'rgba(110,94,62,.45)'; x.fillRect(w * i / 3 - .5, 2, 1, h - 11); }                       // panel joints
    for (let i = 0; i < 7; i++) { x.strokeStyle = 'rgba(255,252,240,.22)'; x.lineWidth = .6; x.beginPath(); const sx = 6 + r() * (w - 20), sy = 4 + r() * (h - 16); x.moveTo(sx, sy); x.lineTo(sx + 6 + r() * 14, sy + (r() - .5) * 3); x.stroke(); }   // scratches
    x.strokeStyle = 'rgba(110,80,40,.38)'; x.lineWidth = 1.3; x.beginPath(); x.arc(w * .28, h * .38, 4.2, 0, 7); x.stroke();          // the old mug ring
    const items = (prof && prof.props && prof.props.counter) || [], busy = items.includes('phone');
    const paper = (px, py, a) => { x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = 'rgba(30,24,10,.25)'; x.fillRect(-6.5, -8, 14, 18); x.fillStyle = '#e4dfca'; x.fillRect(-7, -9, 14, 18); x.fillStyle = 'rgba(120,112,90,.4)'; for (let i = 0; i < 5; i++) x.fillRect(-5, -6 + i * 3, 8 + (i % 2) * 2, .6); x.restore(); };
    const papers = items.filter(k => k === 'paper').length; if (papers) paper(w * .62, h * .4, -.12 + r() * .1); if (papers > 1) paper(w * .66, h * .44, .2);
    if (busy) {                                                                                             // a dead desk phone, its cord
      x.fillStyle = 'rgba(20,16,8,.3)'; x.beginPath(); x.roundRect(w * .1 + 1, h * .22 + 1, 26, 17, 3); x.fill();
      x.fillStyle = '#2f302f'; x.beginPath(); x.roundRect(w * .1, h * .22, 26, 17, 3); x.fill(); x.fillStyle = '#4a4b49'; x.beginPath(); x.roundRect(w * .1 + 2, h * .22 + 1.5, 22, 5, 2); x.fill();
      x.fillStyle = '#5c5d5a'; for (let i = 0; i < 9; i++) x.fillRect(w * .1 + 6 + (i % 3) * 5, h * .22 + 8.5 + Math.floor(i / 3) * 2.6, 3, 1.6);
      x.strokeStyle = '#262624'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(w * .1 + 26, h * .22 + 9); x.bezierCurveTo(w * .1 + 40, h * .22 + 4, w * .1 + 36, h * .22 + 22, w * .1 + 48, h - 9); x.stroke();
    }
    if (items.includes('bell')) {                                                                         // a service bell
      x.fillStyle = 'rgba(20,16,8,.3)'; x.beginPath(); x.arc(w * .84 + 1, h * .42 + 1, 5.2, 0, 7); x.fill(); x.fillStyle = '#b8a35c'; x.beginPath(); x.arc(w * .84, h * .42, 5, 0, 7); x.fill();
      x.fillStyle = '#e3d59a'; x.beginPath(); x.arc(w * .84 - 1.4, h * .42 - 1.4, 1.6, 0, 7); x.fill();
    }
    return c;
  }
  function tableCanvas(s, p, prof, key) {                // a long table on legs: the top overhangs a dark gap (you can crawl beneath)
    const w = p.rect.w, h = p.rect.h, c = mkCanvas((w + PAD * 2) * s, (h + PAD * 2) * s), x = c.getContext('2d'), r = VZ.rng('prop', key, p.id); x.scale(s, s);
    contact(x, w, h, .42); x.translate(PAD, PAD);
    x.fillStyle = 'rgba(8,6,2,.78)'; x.beginPath(); x.roundRect(0, 0, w, h, 3); x.fill();                 // the dark beneath the top, seen at its rim
    for (const [lx, ly] of [[3, 3], [w - 9, 3], [3, h - 9], [w - 9, h - 9]]) { x.fillStyle = '#2b2416'; x.fillRect(lx, ly, 6, 6); x.fillStyle = 'rgba(160,150,120,.25)'; x.fillRect(lx, ly, 6, 1); }   // the legs
    const top = x.createLinearGradient(0, 0, w, h); top.addColorStop(0, '#9c8459'); top.addColorStop(1, '#8a7149');
    x.fillStyle = top; x.beginPath(); x.roundRect(4, 3, w - 8, h - 9, 2.5); x.fill();                       // the top (overhang: the gap shows more to the south)
    for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(${60 + r() * 30},${44 + r() * 20},${24},${.12 + r() * .12})`; x.lineWidth = .7 + r() * 1.1; const yy = 5 + r() * (h - 14); x.beginPath(); x.moveTo(5, yy); x.bezierCurveTo(w * .3, yy + (r() - .5) * 3, w * .7, yy + (r() - .5) * 3, w - 5, yy + (r() - .5) * 2); x.stroke(); }   // wood-grain laminate
    x.strokeStyle = 'rgba(48,36,18,.85)'; x.lineWidth = 1.2; x.beginPath(); x.roundRect(4, 3, w - 8, h - 9, 2.5); x.stroke();
    x.fillStyle = 'rgba(255,240,200,.22)'; x.fillRect(6, 4, w - 12, 1);
    x.fillStyle = 'rgba(40,30,12,.5)'; x.fillRect(5, h - 7.5, w - 10, 1.5);                                // the edge's thickness on the south side
    for (let i = 0; i < 3; i++) { x.strokeStyle = 'rgba(70,52,26,.3)'; x.lineWidth = 1.2; x.beginPath(); x.arc(30 + r() * (w - 60), 12 + r() * (h - 30), 5 + r() * 2, 0, 7); x.stroke(); }   // rings
    const dust = x.createRadialGradient(w * .5, h * .4, 4, w * .5, h * .4, w * .5); dust.addColorStop(0, 'rgba(190,180,150,.0)'); dust.addColorStop(1, 'rgba(190,180,150,.16)'); x.fillStyle = dust; x.fillRect(4, 3, w - 8, h - 9);
    const titems = (prof && prof.props && prof.props.table) || [];
    if (titems.includes('paper')) {                                                                         // left behind when the lights went
      x.save(); x.translate(w * .7, h * .38); x.rotate(.18); x.fillStyle = 'rgba(30,24,10,.3)'; x.fillRect(-7, -9, 15, 19); x.fillStyle = '#d9d3bb'; x.fillRect(-7.5, -9.5, 15, 19); x.fillStyle = 'rgba(110,100,80,.4)'; for (let i = 0; i < 5; i++) x.fillRect(-5, -6 + i * 3, 9, .6); x.restore();
    }
    if (titems.includes('binder')) {
      x.fillStyle = 'rgba(20,16,8,.3)'; x.fillRect(w * .22 + 1, h * .3 + 1, 9, 13); x.fillStyle = '#8b2c22'; x.fillRect(w * .22, h * .3, 9, 13); x.fillStyle = '#c9c4ad'; x.fillRect(w * .22 + 1, h * .3 + 2, 7, 3);   // a fire-safety binder
    }
    return c;
  }
  function holeCanvas(s, p, prof, key) {                 // a crawl hole broken through a partition: crumbled board edges, cut studs, a dusty sill, rubble
    const cw = p.cell.w, chh = p.cell.h, c = mkCanvas((cw + PAD * 2) * s, (chh + PAD * 2) * s), x = c.getContext('2d'), r = VZ.rng('prop', key, p.id); x.scale(s, s); x.translate(PAD, PAD);
    const alongX = p.axis === 'x';                       // you cross along x: the wall runs north-south through this cell
    x.save(); if (!alongX) { x.translate(cw, 0); x.rotate(Math.PI / 2); }   // drawn as if the wall ran north-south (open to the west and east)
    const inner = x.createLinearGradient(0, 0, cw, 0); inner.addColorStop(0, '#2c261b'); inner.addColorStop(.5, '#17140e'); inner.addColorStop(1, '#2c261b');
    x.fillStyle = inner; x.fillRect(-1, 0, cw + 2, chh);                                               // the dim cavity
    x.fillStyle = 'rgba(110,88,52,.55)'; x.fillRect(cw * .34, 0, cw * .32, chh);                        // the bottom plate the wall stood on
    x.fillStyle = 'rgba(255,230,180,.08)'; x.fillRect(cw * .34, 0, cw * .32, 1.2);
    for (let i = 0; i < 70; i++) { x.fillStyle = r() > .5 ? 'rgba(210,198,160,.32)' : 'rgba(60,50,30,.4)'; x.fillRect(r() * cw, r() * chh, .9 + r(), .9 + r()); }   // dust and grit
    for (let i = 0; i < 3; i++) { x.fillStyle = `rgba(206,184,110,${.22 + r() * .15})`; x.beginPath(); x.ellipse(cw * (.25 + r() * .5), chh * (.3 + r() * .4), 5 + r() * 5, 2.5 + r() * 2, r() * 3, 0, 7); x.fill(); }   // insulation tufts
    const edge = top => {                                // the broken board where the wall continues (top / bottom of this cell)
      const b = top ? 0 : chh, d = top ? 1 : -1, pts = [], n = 10;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([t * cw, b + d * (3 + Math.abs(Math.sin(t * 9.1 + r() * 2)) * 5 + r() * 3)]); }
      x.fillStyle = '#cfc6a6'; x.beginPath(); x.moveTo(-1, b); for (const [px, py] of pts) x.lineTo(px, py); x.lineTo(cw + 1, b); x.closePath(); x.fill();          // gypsum core
      x.strokeStyle = 'rgba(36,30,18,.75)'; x.lineWidth = 1.2; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke();    // its shadowed break
      x.fillStyle = 'rgba(203,185,106,.95)'; x.fillRect(-1, top ? 0 : chh - 2.2, 7, 2.2); x.fillRect(cw - 6, top ? 0 : chh - 2.2, 7, 2.2);                            // paper faces at both sides
      for (const sx of [cw * .3, cw * .62]) { x.fillStyle = '#7a6440'; x.fillRect(sx, top ? 0 : chh - 6, 7, 6); x.fillStyle = 'rgba(255,236,190,.22)'; x.fillRect(sx, top ? 5 : chh - 6, 7, 1); }   // cut studs
    };
    edge(true); edge(false);
    for (const side of [-1, 1]) for (let i = 0; i < 14; i++) {        // crumbs spilled out of both mouths onto the floor
      const px = side < 0 ? -1 - Math.pow(r(), 1.5) * 10 : cw + 1 + Math.pow(r(), 1.5) * 10, py = 14 + r() * (chh - 28), s2 = .8 + r() * 2.2;
      x.fillStyle = r() > .3 ? 'rgba(214,206,180,.9)' : 'rgba(110,96,64,.8)'; x.fillRect(px - s2 / 2, py, s2, s2 * (.6 + r() * .6)); }
    x.restore(); return c;
  }

  /* a papered column (the game's 56 x 56 pillar, exactly): a dark top, the same paper and baseboard as the walls on all four
   * sides (S 14 / N 7 / E-W 9, the walls' proportions), mitred corners, damp and mildew climbing from the base */
  function pillarCanvas(s, prof, paper, key, variant) {
    const P = 56, F = (prof.structure && prof.structure.pillar && prof.structure.pillar.faces) || { S: 14, N: 7, E: 9, W: 9 };
    const c = mkCanvas((P + PAD * 2) * s, (P + PAD * 2) * s), x = c.getContext('2d'), r = VZ.rng('pillar', key, variant), cap = MAT('material:wallcap');
    x.scale(s, s); contact(x, P, P, .46, 3); x.translate(PAD, PAD);
    x.fillStyle = cap.dark; x.fillRect(0, 0, P, P);                                                         // the column's top
    for (let i = 0; i < 40; i++) { x.fillStyle = r() > .5 ? 'rgba(130,118,70,.18)' : 'rgba(20,16,6,.2)'; x.fillRect(F.W + r() * (P - F.W - F.E), F.N + r() * (P - F.N - F.S), 1.2, 1.2); }
    const face = (poly, tf) => { x.save(); x.beginPath(); poly.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.clip(); tf(); x.restore(); };
    const strip = (fw, ox) => { const sx = ((ox % 136) + 136) % 136; x.drawImage(paper, sx * s, (48 - fw) * s, P * s, fw * s, 0, 0, P, fw); };
    const ph = variant * 37;
    face([[0, P], [P, P], [P - F.E, P - F.S], [F.W, P - F.S]], () => { x.translate(0, P - F.S); strip(F.S, ph); });
    face([[0, 0], [P, 0], [P - F.E, F.N], [F.W, F.N]], () => { x.translate(0, F.N); x.scale(1, -1); strip(F.N, ph + 11); });
    face([[P, 0], [P, P], [P - F.E, P - F.S], [P - F.E, F.N]], () => { x.translate(P - F.E, P); x.rotate(-Math.PI / 2); strip(F.E, ph + 23); });
    face([[0, 0], [0, P], [F.W, P - F.S], [F.W, F.N]], () => { x.translate(F.W, 0); x.rotate(Math.PI / 2); strip(F.W, ph + 5); });
    x.strokeStyle = 'rgba(255,246,206,.35)'; x.lineWidth = 1; x.strokeRect(F.W + .5, F.N + .5, P - F.W - F.E - 1, P - F.N - F.S - 1);   // the lit lip where the faces meet the top
    x.strokeStyle = 'rgba(60,50,24,.5)'; x.lineWidth = .8; x.beginPath(); for (const [a, b] of [[[0, 0], [F.W, F.N]], [[P, 0], [P - F.E, F.N]], [[0, P], [F.W, P - F.S]], [[P, P], [P - F.E, P - F.S]]]) { x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); } x.stroke();   // corner arrises
    const mil = (prof.carpet && prof.carpet.mildew) || 0, Mi = rgb(MAT('material:wallpaper').mildew || '#4a4a2c');
    for (let k = 0; k < Math.round(mil * 10); k++) {                                                                              // mildew speckling up from the base of one side
      const side = Math.floor(r() * 4), t = 6 + r() * (P - 12), d = Math.pow(r(), 1.6) * 8;
      const [px, py] = side === 0 ? [t, P - 1 - d] : side === 1 ? [t, 1 + d] : side === 2 ? [P - 1 - d, t] : [1 + d, t];
      x.fillStyle = css(Mi, .25 + r() * .3); x.beginPath(); x.arc(px, py, .5 + r() * 1.3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(30,24,10,.75)'; x.lineWidth = 1; x.strokeRect(.5, .5, P - 1, P - 1);                    // the footprint's edge, crisp
    return c;
  }

  /* ---------- ceiling fixtures (the legacy housing footprint, 90 x 28 at x-45, y-15; drawn in the ceiling layer) ---------- */
  function fixtureCanvas(s, kind, key) {                 // kind: clean | yellowed | aged | dead | missing | hanging
    const w = 90, h = 28, P = 6, c = mkCanvas((w + P * 2) * s, (h + P * 2) * s), x = c.getContext('2d'), r = VZ.rng('fixture', key, kind, s), m = MAT('material:fixture'); x.scale(s, s); x.translate(P, P);
    const dead = kind === 'dead' || kind === 'missing' || kind === 'hanging';
    x.fillStyle = 'rgba(10,8,4,.22)'; x.beginPath(); x.roundRect(-2, 1, w + 4, h + 3, 3); x.fill();            // a soft shade on the ceiling grid
    if (kind === 'missing') {                                                                              // only the opening in the grid, wires
      x.fillStyle = '#16140f'; x.fillRect(2, 2, w - 4, h - 4); x.strokeStyle = 'rgba(150,140,110,.6)'; x.lineWidth = 1.5; x.strokeRect(2, 2, w - 4, h - 4);
      x.strokeStyle = '#3c3a33'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(20, 12); x.bezierCurveTo(30, 22, 44, 4, 52, 16); x.stroke(); x.strokeStyle = '#7a2a20'; x.beginPath(); x.moveTo(24, 10); x.quadraticCurveTo(34, 20, 40, 12); x.stroke();
      return c;
    }
    if (kind === 'hanging') { x.translate(w / 2, h / 2); x.rotate(-.08); x.translate(-w / 2 + 3, -h / 2 + 2); }
    x.fillStyle = dead ? '#8c877a' : m.base; x.beginPath(); x.roundRect(0, 0, w, h, 2); x.fill();          // painted steel frame
    x.strokeStyle = m.frameDark; x.lineWidth = 1; x.beginPath(); x.roundRect(.5, .5, w - 1, h - 1, 2); x.stroke();
    x.fillStyle = 'rgba(70,64,48,.55)'; x.fillRect(3, 3, 5, h - 6); x.fillRect(w - 8, 3, 5, h - 6);         // lamp holders at both ends
    const lens = dead ? m.dead : kind === 'yellowed' || kind === 'aged' ? m.lensYellow : m.lens;
    x.fillStyle = lens; x.fillRect(8, 3, w - 16, h - 6);                                                    // prismatic diffuser
    x.fillStyle = dead ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.16)'; for (let yy = 4; yy < h - 4; yy += 2) for (let xx = 9 + (yy % 4 ? 1 : 0); xx < w - 9; xx += 2) x.fillRect(xx, yy, .7, .7);
    if (!dead) {                                                                                            // the two tubes glowing through it
      for (const ty of [h * .36, h * .66]) { const g = x.createLinearGradient(0, ty - 4, 0, ty + 4); g.addColorStop(0, 'rgba(255,253,236,0)'); g.addColorStop(.5, m.tube); g.addColorStop(1, 'rgba(255,253,236,0)'); x.fillStyle = g; x.fillRect(9, ty - 4, w - 18, 8); }
      if (kind === 'aged') { for (const ex of [9, w - 23]) { const g = x.createLinearGradient(ex, 0, ex + 14, 0); g.addColorStop(ex < 20 ? 0 : 1, 'rgba(40,34,20,.75)'); g.addColorStop(ex < 20 ? 1 : 0, 'rgba(40,34,20,0)'); x.fillStyle = g; x.fillRect(ex, h * .5 - 6, 14, 12); } }   // blackened tube ends
      if (kind === 'yellowed' || kind === 'aged') { const g = x.createLinearGradient(8, 0, w - 8, 0); g.addColorStop(0, 'rgba(160,120,40,.22)'); g.addColorStop(.5, 'rgba(160,120,40,0)'); g.addColorStop(1, 'rgba(160,120,40,.2)'); x.fillStyle = g; x.fillRect(8, 3, w - 16, h - 6); }
    } else {
      x.fillStyle = 'rgba(40,38,32,.8)'; x.fillRect(10, h * .36 - 1.6, w - 20, 3.2); if (kind !== 'hanging') x.fillRect(10, h * .66 - 1.6, w * .45, 3.2);   // dark tubes, one gone
      x.strokeStyle = 'rgba(20,18,14,.7)'; x.lineWidth = .8; x.beginPath(); x.moveTo(w * .58, 3); x.lineTo(w * .61, h * .3); x.lineTo(w * .66, h * .38); x.lineTo(w * .69, h * .7); x.lineTo(w * .75, h - 3); x.stroke();   // a crack across the lens
    }
    for (let i = 0; i < 7; i++) { x.fillStyle = 'rgba(40,34,18,.32)'; x.fillRect(10 + r() * (w - 20), r() > .5 ? 4 + r() * 2.5 : h - 6.5 + r() * 2.5, .6 + r() * .6, .5 + r() * .5); }   // dead insects along the lens edges
    return c;
  }

  /* ======================================================================================================================
   * TEXTURE SET (per quality tier)
   * ==================================================================================================================== */
  function tierNow() { try { const b = window.__brRole; const q = b && b.stats ? b.stats().quality : ''; return VZ.quality[q] ? q : 'medium'; } catch (e) { return 'medium'; } }
  function makeTextures(tier) {
    const q = VZ.quality[tier], s = q.artScale, X = { tier, q, wall: {}, depth: {}, props: {}, fix: {}, dec: {} };
    X.carpet = texOf(carpetCanvas(q.carpetTex, 'carpet'), { mip: true, u: 'repeat', v: 'repeat' });
    X.carpetScale = .85 * 1024 / q.carpetTex * (q.carpetTex / 1024);     // world px per texel (texel ~ one screen pixel at MEDIUM)
    X.cap = texOf(capCanvas(256, 'cap'), { mip: true, u: 'repeat', v: 'repeat' });
    const profs = []; for (const id of VZ.slice) { const p = VZ.resolve(id); if (p && !profs.some(q2 => q2.id === p.id)) profs.push(p); }
    for (const p of profs) {
      const pc = wallpaperCanvas(s, p, p.id); X.paper = X.paper || {}; X.paper[p.id] = pc;
      X.wall[p.id] = texOf(pc, { mip: true, u: 'repeat', v: 'clamp-to-edge' });
      X.depth[p.id] = texOf(depthFaceCanvas(s, p, p.id), { mip: true, u: 'repeat', v: 'clamp-to-edge' });
    }
    const fall = u => Math.pow(1 - clamp(u, 0, 1), AO.power), n = AO.steps, qq = 48;
    X.ao = { down: texOf(aoCanvas(2, n, (i, j) => fall((j + .5) / n))), up: texOf(aoCanvas(2, n, (i, j) => fall((n - j - .5) / n))), right: texOf(aoCanvas(n, 2, i => fall((i + .5) / n))), left: texOf(aoCanvas(n, 2, i => fall((n - i - .5) / n))),
      se: texOf(aoCanvas(qq, qq, (i, j) => fall(Math.hypot(i + .5, j + .5) / qq))), sw: texOf(aoCanvas(qq, qq, (i, j) => fall(Math.hypot(qq - i - .5, j + .5) / qq))),
      ne: texOf(aoCanvas(qq, qq, (i, j) => fall(Math.hypot(i + .5, qq - j - .5) / qq))), nw: texOf(aoCanvas(qq, qq, (i, j) => fall(Math.hypot(qq - i - .5, qq - j - .5) / qq))) };
    const dc = decalCanvases(Math.min(2, s), 'decals');
    for (const k of Object.keys(dc)) X.dec[k] = dc[k].map(o => ({ t: texOf(o.c, { mip: true }), w: o.w, h: o.h }));
    for (const kind of ['clean', 'yellowed', 'aged', 'dead', 'missing', 'hanging']) X.fix[kind] = texOf(fixtureCanvas(Math.max(2, s + .5), kind, 'fixture'), { mip: true });
    return X;
  }

  /* ======================================================================================================================
   * ROOM BUILD
   * ==================================================================================================================== */
  const ocOf = vr => { const A = api(); return A && A.Oc ? A.Oc.find(o => o.code === vr.code && o.name === vr.name) || null : null; };
  function roomAt(x, y) {                                // the visual room record whose game rect holds a world point
    const A = api(); if (!A || !A.Oc || !VZ) return null; const cx = Math.floor(x / T), cy = Math.floor(y / T);
    const o = A.Oc.find(o => cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h); return o ? VZ.rooms.find(r => r.code === o.code) || null : null;
  }

  function buildRoom(vr, X) {
    const o = ocOf(vr); if (!o) throw Error('room not in the game table: ' + vr.id);
    const prof = VZ.resolve(vr.id), cp = prof.carpet, A = api(), q = X.q;
    const R = { id: vr.id, code: vr.code, o, prof, cont: new S.C(), ceilG: new S.G(), x0: (o.x - 1) * T, y0: (o.y - 1) * T, x1: (o.x + o.w + 1) * T, y1: (o.y + o.h + 1) * T, n: { floor: 0, faces: 0, decals: 0 } };
    R.cont.label = 'l0v:' + vr.id; R.ceilG.label = 'fixtures:' + vr.id;
    const own = (cx, cy) => cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h && isFloor(cx, cy);
    const ownWall = (cx, cy) => cx >= o.x - 1 && cx <= o.x + o.w && cy >= o.y - 1 && cy <= o.y + o.h && !isFloor(cx, cy);
    const wall = (cx, cy) => !isFloor(cx, cy);
    const rnd = VZ.rng('room', vr.id);

    /* -- 1 floor: carpet rolls (each roll its own texture phase and a whisper of tone), seams between them -- */
    const floorG = new S.G(); floorG.label = 'floor'; R.cont.addChild(floorG);
    const along = cp.seams === 'x' ? 'x' : 'y', ROLL = 184, tone = cp.tone || 1, sc = X.carpetScale;
    const runs = [];                                       // maximal horizontal runs of owned floor cells, merged vertically into rects
    for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w;) { if (!own(cx, cy)) { cx++; continue; } let e = cx; while (e + 1 < o.x + o.w && own(e + 1, cy)) e++; runs.push({ x: cx, y: cy, w: e - cx + 1, h: 1 }); cx = e + 1; }
    const rects = []; for (const r of runs) { const up = rects.find(q2 => q2.x === r.x && q2.w === r.w && q2.y + q2.h === r.y); if (up) up.h++; else rects.push({ ...r }); }
    const span0 = along === 'y' ? o.x * T : o.y * T, span1 = along === 'y' ? (o.x + o.w) * T : (o.y + o.h) * T, rolls = [];
    for (let a = span0 - VZ.unit(vr.id, 'roll-phase') * ROLL, k = 0; a < span1; a += ROLL, k++) rolls.push({ a0: Math.max(span0, a), a1: Math.min(span1, a + ROLL), k });
    for (const rr of rolls) {
      const ph = [VZ.unit(vr.id, 'roll', rr.k, 'u') * 1024, VZ.unit(vr.id, 'roll', rr.k, 'v') * 1024], tint = tone * (1 + (VZ.unit(vr.id, 'roll', rr.k, 't') - .5) * .05);
      const style = { texture: X.carpet, textureSpace: 'global', matrix: M(sc, 0, 0, sc, ph[0], ph[1]), color: hexOf([255 * tint, 255 * tint, 255 * Math.min(1.02, tint)]) };
      for (const fr of rects) {
        const x0 = fr.x * T, y0 = fr.y * T, x1 = (fr.x + fr.w) * T, y1 = (fr.y + fr.h) * T;
        const ix0 = along === 'y' ? Math.max(x0, rr.a0) : x0, ix1 = along === 'y' ? Math.min(x1, rr.a1) : x1, iy0 = along === 'x' ? Math.max(y0, rr.a0) : y0, iy1 = along === 'x' ? Math.min(y1, rr.a1) : y1;
        if (ix1 > ix0 && iy1 > iy0) { floorG.rect(ix0, iy0, ix1 - ix0, iy1 - iy0).fill(style); R.n.floor++; }
      }
    }
    for (const rr of rolls.slice(1)) for (const fr of rects) {                                             // seams: a dark join, a lifted edge beside it
      const a = rr.a0, x0 = fr.x * T, y0 = fr.y * T, x1 = (fr.x + fr.w) * T, y1 = (fr.y + fr.h) * T;
      if (along === 'y' && a > x0 && a < x1) { floorG.rect(a - .6, y0, 1.2, y1 - y0).fill({ color: 0x2c2412, alpha: .13 }); floorG.rect(a + .6, y0, 1, y1 - y0).fill({ color: 0xfff4cc, alpha: .035 }); }
      if (along === 'x' && a > y0 && a < y1) { floorG.rect(x0, a - .6, x1 - x0, 1.2).fill({ color: 0x2c2412, alpha: .13 }); floorG.rect(x0, a + .6, x1 - x0, 1).fill({ color: 0xfff4cc, alpha: .035 }); }
    }

    /* -- 2 the room's wear / damp / grime map (low resolution, multiplied over the carpet).  Drawn only over the floor cells it
     *    actually darkens (wall bases, traffic, damp): untouched carpet costs no second layer.  LOW skips it. -- */
    const lanes = laneField(o, own);
    if (q.macro !== false) {
      const cell = q.macroCell, mw = Math.ceil(o.w * T / cell), mh = Math.ceil(o.h * T / cell), mc = mkCanvas(mw, mh), mx = mc.getContext('2d'), mi = mx.createImageData(mw, mh);
      const ox = o.x * T, oy = o.y * T, dN = fieldNoise(vr.id + ':damp', ox, oy, o.w * T, o.h * T, 150), wN = fieldNoise(vr.id + ':wear', ox, oy, o.w * T, o.h * T, 70);
      const keep = new Uint8Array(o.w * o.h);
      for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
        const wx = ox + (i + .5) * cell, wy = oy + (j + .5) * cell, cx = Math.floor(wx / T), cy = Math.floor(wy / T);
        let k = [1, 1, 1];
        if (own(cx, cy)) {
          const fx = wx - cx * T, fy = wy - cy * T;                        // distance to the nearest wall edge of this cell's neighbours
          let dw = 999; if (wall(cx - 1, cy)) dw = Math.min(dw, fx); if (wall(cx + 1, cy)) dw = Math.min(dw, T - fx); if (wall(cx, cy - 1)) dw = Math.min(dw, fy); if (wall(cx, cy + 1)) dw = Math.min(dw, T - fy);
          if (wall(cx - 1, cy - 1)) dw = Math.min(dw, Math.hypot(fx, fy)); if (wall(cx + 1, cy - 1)) dw = Math.min(dw, Math.hypot(T - fx, fy)); if (wall(cx - 1, cy + 1)) dw = Math.min(dw, Math.hypot(fx, T - fy)); if (wall(cx + 1, cy + 1)) dw = Math.min(dw, Math.hypot(T - fx, T - fy));
          const grime = cp.grime * (.16 * Math.exp(-dw / 26) + .05 * Math.exp(-dw / 70));                  // dirt collects along the bases
          const lane = clamp(lanes(wx, wy) * (.7 + wN(wx, wy) * .6) * cp.wear * 1.5, 0, 1);                // matted, greyed traffic paths
          const damp = sm(1 - cp.damp * .6, 1 - cp.damp * .6 + .2, dN(wx, wy)) * Math.min(1, cp.damp * 2.4) * (.6 + .4 * Math.exp(-dw / 160));
          const wear = [1 - .26 * lane, 1 - .25 * lane, 1 - .14 * lane], dmp = [1 - .3 * damp, 1 - .3 * damp, 1 - .4 * damp];
          for (let c = 0; c < 3; c++) k[c] = (1 - grime) * wear[c] * dmp[c];
          if (Math.min(k[0], k[1], k[2]) < .985) keep[(cy - o.y) * o.w + (cx - o.x)] = 1;
        }
        const p = (j * mw + i) * 4; mi.data[p] = clamp(k[0] * 255, 0, 255); mi.data[p + 1] = clamp(k[1] * 255, 0, 255); mi.data[p + 2] = clamp(k[2] * 255, 0, 255); mi.data[p + 3] = 255;
      }
      mx.putImageData(mi, 0, 0);
      const macroG = new S.G(), mt = texOf(mc), ms = { texture: mt, textureSpace: 'global', matrix: M(cell, 0, 0, cell, ox, oy) }; macroG.label = 'macro'; macroG.blendMode = 'multiply';
      let kept = 0; for (let cy = 0; cy < o.h; cy++) for (let cx = 0; cx < o.w;) { if (!keep[cy * o.w + cx]) { cx++; continue; } let e = cx; while (e + 1 < o.w && keep[cy * o.w + e + 1]) e++; macroG.rect((o.x + cx) * T, (o.y + cy) * T, (e - cx + 1) * T, T).fill(ms); kept += e - cx + 1; cx = e + 1; }
      R.cont.addChild(macroG); R.macroCanvas = mc; R.n.macroCells = kept;
    }

    /* -- 3 decals on the carpet (seeded scatter + authored storytelling) -- */
    const mulG = new S.G(); mulG.label = 'decals-mul'; mulG.blendMode = 'multiply'; const decG = new S.G(); decG.label = 'decals';
    R.decalLayers = [mulG, decG];
    const props = window.WORLD && window.WORLD.PROPS ? window.WORLD.PROPS : [];
    const clearOfProps = (x, y, m) => !props.some(p => { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect; return x > rc.x - m && x < rc.x + rc.w + m && y > rc.y - m && y < rc.y + rc.h + m; });
    const put = (g, kind, i, x, y, rot, scl, alpha, tint = 0xffffff) => {
      const set = X.dec[kind]; if (!set || !set.length) return; const d = set[i % set.length], c = Math.cos(rot) * scl, s2 = Math.sin(rot) * scl;
      g.setTransform(c, s2, -s2, c, x, y); g.fillStyle = { color: 0xffffff, alpha }; g.texture(d.t, tint, -d.w / 2, -d.h / 2, d.w, d.h); g.resetTransform(); R.n.decals++;
    };
    const cells = []; for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w; cx++) if (own(cx, cy)) {
      const wn = [wall(cx - 1, cy), wall(cx + 1, cy), wall(cx, cy - 1), wall(cx, cy + 1)], nw = wn.filter(Boolean).length;
      const corner = (wn[0] || wn[1]) && (wn[2] || wn[3]);
      cells.push({ cx, cy, edge: nw > 0, corner, lane: lanes((cx + .5) * T, (cy + .5) * T), wn });
    }
    const dens = q.decals, D = prof.decor;
    for (const c of cells) {
      const u = k => VZ.unit(vr.id, 'decal', k, c.cx, c.cy), x = (c.cx + .2 + u('x') * .6) * T, y = (c.cy + .2 + u('y') * .6) * T;
      if (!clearOfProps(x, y, 30)) continue;
      const r0 = u('rot') * Math.PI * 2;
      if (u('stain') < cp.stains * .055 * dens && !c.edge) put(mulG, 'stain', Math.floor(u('v') * 4), x, y, r0, .7 + u('s') * .7, .8);
      if (u('ring') < .012 * dens * (D.paper + .3)) put(mulG, 'ring', Math.floor(u('v2') * 2), x, y, r0, 1, .9);
      if (u('damp') < cp.damp * (c.edge ? .16 : .05) * dens) put(mulG, 'damp', Math.floor(u('v3') * 3), x + (c.wn[0] ? -20 : c.wn[1] ? 20 : 0), y + (c.wn[2] ? -20 : c.wn[3] ? 20 : 0), r0, .45 + u('s2') * (.3 + cp.damp), clamp(.35 + cp.damp * 1.3, 0, .95));
      if (c.lane > .35 && u('scuff') < D.scuff * .2 * dens) put(mulG, 'scuff', Math.floor(u('v4') * 3), x, y, r0, .8 + u('s3') * .5, .9);
      if (u('paper') < D.paper * (c.edge ? .07 : .02) * dens) {             // papers drift against walls and into corners
        const px = c.wn[0] ? c.cx * T + 16 : c.wn[1] ? (c.cx + 1) * T - 16 : x, py = c.wn[2] ? c.cy * T + 18 : c.wn[3] ? (c.cy + 1) * T - 18 : y;
        put(decG, 'paper', Math.floor(u('v5') * 3), px, py, r0, .9 + u('s4') * .2, 1);
      }
      if (c.edge && u('debris') < D.debris * (c.corner ? .5 : .14) * dens) {
        const px = c.wn[0] ? c.cx * T + 10 : c.wn[1] ? (c.cx + 1) * T - 10 : x, py = c.wn[2] ? c.cy * T + 10 : c.wn[3] ? (c.cy + 1) * T - 10 : y;
        put(decG, 'debris', Math.floor(u('v6') * 3), px, py, r0, .9 + u('s5') * .5, .9);
      }
      if (c.lane > .5 && u('tape') < D.tape * .05 * dens) put(decG, 'tape', Math.floor(u('v7') * 2), x, y, r0, 1, .95);
      if (c.edge && u('mildew') < (cp.mildew || 0) * (c.corner ? .5 : .12) * dens) { const px = c.wn[0] ? c.cx * T + 22 : c.wn[1] ? (c.cx + 1) * T - 22 : x, py = c.wn[2] ? c.cy * T + 22 : c.wn[3] ? (c.cy + 1) * T - 22 : y; put(mulG, 'mildew', Math.floor(u('v8') * 2), px, py, r0, .8 + u('s8') * .6, .9); }
    }
    for (const d of VZ.decor.filter(d => d.room === vr.id)) put(d.kind === 'stain' || d.kind === 'damp' || d.kind === 'scuff' || d.kind === 'ring' ? mulG : decG, d.kind, d.v || 0, d.x, d.y, d.r || 0, d.s || 1, d.a == null ? 1 : d.a);
    if (prof.accent === 'electrical') cables(R, decG);
    R.cont.addChild(mulG, decG);

    /* -- 4 grounding at the wall bases: BR-RoLE's own law, on this room's floor only -- */
    const aoG = new S.G(); aoG.label = 'grounding'; aoG.alpha = AO.alpha; const w = AO.width, Xa = X.ao;
    for (let cy = o.y - 1; cy <= o.y + o.h; cy++) for (let cx = o.x - 1; cx <= o.x + o.w; cx++) {
      if (!wall(cx, cy)) continue; const x0 = cx * T, y0 = cy * T;
      if (own(cx, cy + 1)) aoG.texture(Xa.down, 0xffffff, x0, y0 + T, T, w);
      if (own(cx, cy - 1)) aoG.texture(Xa.up, 0xffffff, x0, y0 - w, T, w);
      if (own(cx + 1, cy)) aoG.texture(Xa.right, 0xffffff, x0 + T, y0, w, T);
      if (own(cx - 1, cy)) aoG.texture(Xa.left, 0xffffff, x0 - w, y0, w, T);
      if (own(cx + 1, cy + 1) && !wall(cx + 1, cy) && !wall(cx, cy + 1)) aoG.texture(Xa.se, 0xffffff, x0 + T, y0 + T, w, w);
      if (own(cx - 1, cy + 1) && !wall(cx - 1, cy) && !wall(cx, cy + 1)) aoG.texture(Xa.sw, 0xffffff, x0 - w, y0 + T, w, w);
      if (own(cx + 1, cy - 1) && !wall(cx + 1, cy) && !wall(cx, cy - 1)) aoG.texture(Xa.ne, 0xffffff, x0 + T, y0 - w, w, w);
      if (own(cx - 1, cy - 1) && !wall(cx - 1, cy) && !wall(cx, cy - 1)) aoG.texture(Xa.nw, 0xffffff, x0 - w, y0 - w, w, w);
    }
    R.ao = aoG; R.cont.addChild(aoG);

    /* -- 5 thresholds where the room's carpet meets a corridor (a worn aluminium transition strip) -- */
    const thG = new S.G(); thG.label = 'thresholds';
    const strip = (x, y, ww, hh) => { thG.rect(x, y, ww, hh).fill({ color: 0x6d6a5c }); thG.rect(x, y, ww, Math.min(hh, ww) > 4 ? 1 : 0).fill({ color: 0xc8c4b0, alpha: .5 }); };
    for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w; cx++) if (own(cx, cy)) {
      if (cy === o.y && isFloor(cx, cy - 1)) strip(cx * T, cy * T, T, 5); if (cy === o.y + o.h - 1 && isFloor(cx, cy + 1)) strip(cx * T, (cy + 1) * T - 5, T, 5);
      if (cx === o.x && isFloor(cx - 1, cy)) strip(cx * T, cy * T, 5, T); if (cx === o.x + o.w - 1 && isFloor(cx + 1, cy)) strip((cx + 1) * T - 5, cy * T, 5, T);
    }
    R.cont.addChild(thG);

    /* -- 6 walls: caps, papered faces (legacy band widths), mitred corners; and the DEV depth-cue variant -- */
    R.walls = buildWalls(R, X, ownWall, wall, 'legacy'); R.depthWalls = buildWalls(R, X, ownWall, wall, 'depth');
    R.cont.addChild(R.walls, R.depthWalls); R.depthWalls.visible = S.depth; R.walls.visible = !S.depth;
    const wallDecG = new S.G(); wallDecG.label = 'wall-decor'; wallDecor(R, X, ownWall, wallDecG); R.cont.addChild(wallDecG); R.decalLayers.push(wallDecG);

    /* -- 7 the room's physical props, same rects -- */
    const propG = new S.G(); propG.label = 'props';
    for (const p of props) {
      const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect, [pcx, pcy] = [Math.floor((rc.x + rc.w / 2) / T), Math.floor((rc.y + rc.h / 2) / T)];
      if (!(pcx >= o.x && pcx < o.x + o.w && pcy >= o.y && pcy < o.y + o.h)) continue;
      const make = p.kind === 'counter' ? counterCanvas : p.kind === 'table' ? tableCanvas : p.kind === 'hole' ? holeCanvas : null; if (!make) continue;
      const cv = make(q.artScale, p, prof, vr.id); propG.texture(texOf(cv, { mip: true }), 0xffffff, rc.x - PAD, rc.y - PAD, rc.w + PAD * 2, rc.h + PAD * 2);
      (R.props || (R.props = [])).push(p.id);
    }
    if (prof.structure && prof.structure.pillar && A && typeof A.Bc === 'function') {               // the game's pillars in this room, found the way BR-RoLE finds them
      const seen = new Set(), pv = [0, 1, 2].map(v => texOf(pillarCanvas(q.artScale, prof, X.paper[prof.id], vr.id, v), { mip: true }));
      for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w; cx++) { let l = null; try { l = A.Bc((cx + .5) * T, (cy + .5) * T); } catch (e) { l = null; }
        if (l) for (const b of l) if (b && b.w === 56 && b.h === 56) { const k = b.x + ',' + b.y; if (seen.has(k)) continue; seen.add(k); const ccx = Math.floor((b.x + 28) / T), ccy = Math.floor((b.y + 28) / T); if (!(ccx >= o.x && ccx < o.x + o.w && ccy >= o.y && ccy < o.y + o.h)) continue;
          propG.texture(pv[Math.floor(VZ.unit(vr.id, 'pillar', k) * 3)], 0xffffff, b.x - PAD, b.y - PAD, 56 + PAD * 2, 56 + PAD * 2); (R.pillars || (R.pillars = [])).push(k); } }
    }
    R.cont.addChild(propG);

    /* -- 8 ceiling: the room's fixtures (lamps in this room, plus visual-only records), legacy footprint -- */
    for (const L of S.ownLamps.filter(l => l.room === vr.id)) R.ceilG.texture(X.fix[L.aged ? 'aged' : prof.fixtures.diffuser === 'yellowed' ? 'yellowed' : 'clean'], 0xffffff, L.x - 45 - 6, L.y - 15 - 6, 102, 40);
    for (const f of VZ.fixtures.filter(f => f.room === vr.id)) R.ceilG.texture(X.fix[f.kind] || X.fix.dead, 0xffffff, f.x - 51, f.y - 21, 102, 40);
    S.stats.fixtures += S.ownLamps.filter(l => l.room === vr.id).length + VZ.fixtures.filter(f => f.room === vr.id).length;
    S.root.addChild(R.cont); S.ceil.addChild(R.ceilG);
    S.stats.floorRects += R.n.floor; S.stats.faces += R.n.faces; S.stats.decals += R.n.decals;
    return R;
  }

  /* traffic: entrances are the room's openings (to corridors, through its own interior doorways); lanes are the shortest
   * paths between every pair of them across the room's floor cells, blurred.  Presentation only (the donor's anchor flood,
   * rebuilt in flat 2D: no clearance, no physics). */
  function laneField(o, own) {
    const W = o.w, H = o.h, idx = (cx, cy) => (cy - o.y) * W + (cx - o.x), ent = [];
    for (let cy = o.y; cy < o.y + H; cy++) for (let cx = o.x; cx < o.x + W; cx++) if (own(cx, cy)) {
      if ((cy === o.y && isFloor(cx, cy - 1)) || (cy === o.y + H - 1 && isFloor(cx, cy + 1)) || (cx === o.x && isFloor(cx - 1, cy)) || (cx === o.x + W - 1 && isFloor(cx + 1, cy))) ent.push([cx, cy]);
    }
    const groups = []; for (const e of ent) { const g = groups.find(g => g.some(q => Math.abs(q[0] - e[0]) + Math.abs(q[1] - e[1]) <= 1)); if (g) g.push(e); else groups.push([e]); }
    const pts = groups.map(g => g[Math.floor(g.length / 2)]), heat = new Float32Array(W * H);
    for (let a = 0; a < pts.length; a++) {
      const dist = new Float32Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), open = [[0, idx(...pts[a])]]; dist[idx(...pts[a])] = 0;
      while (open.length) { open.sort((p, q) => p[0] - q[0]); const [d, i] = open.shift(); if (d > dist[i]) continue; const cx = o.x + i % W, cy = o.y + Math.floor(i / W);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < o.x || ny < o.y || nx >= o.x + W || ny >= o.y + H || !own(nx, ny)) continue;
          if (dx && dy && (!own(cx + dx, cy) || !own(cx, cy + dy))) continue; const j = idx(nx, ny), nd = d + (dx && dy ? 1.414 : 1); if (nd < dist[j]) { dist[j] = nd; prev[j] = i; open.push([nd, j]); } } }
      for (let b = a + 1; b < pts.length; b++) { let i = idx(...pts[b]); if (!isFinite(dist[i])) continue; while (i >= 0) { heat[i] += 1; i = prev[i]; } }
    }
    let mx = 0; for (const h of heat) mx = Math.max(mx, h); const R2 = T * 1.1;
    return (x, y) => {                                   // smooth: a soft kernel over neighbouring cells
      if (!mx) return 0; const cx = Math.floor(x / T), cy = Math.floor(y / T); let s = 0, wsum = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < o.x || ny < o.y || nx >= o.x + W || ny >= o.y + H) continue;
        const d = Math.hypot(x - (nx + .5) * T, y - (ny + .5) * T), k = Math.exp(-(d * d) / (R2 * R2)); s += k * Math.sqrt(heat[idx(nx, ny)] / mx); wsum += k; }
      return wsum ? s / wsum : 0;
    };
  }

  /* a taped cable run (HUMMING ROOMS): from the outlet nearest the counter, across the carpet, taped down, under the counter */
  function cables(R, g) {
    const props = (window.WORLD && window.WORLD.PROPS || []).filter(p => p.kind === 'counter'), o = R.o;
    for (const p of props) { const rc = p.rect, cx = Math.floor((rc.x + rc.w / 2) / T), cy = Math.floor((rc.y + rc.h / 2) / T); if (!(cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h)) continue;
      let wx = null; for (let x = cx; x >= o.x - 1; x--) if (!isFloor(x, cy)) { wx = (x + 1) * T; break; }   // the nearest wall to the west, same row
      if (wx == null) continue; const y0 = rc.y + rc.h * .5, x1 = rc.x + 6;
      g.moveTo(wx + 2, y0 + 30).bezierCurveTo(wx + 60, y0 + 40, x1 - 80, y0 + 34, x1 + 2, y0 + 6).stroke({ color: 0x1e1d1a, width: 2.2, alpha: .92 });
      g.moveTo(wx + 2, y0 + 30).bezierCurveTo(wx + 60, y0 + 40, x1 - 80, y0 + 34, x1 + 2, y0 + 6).stroke({ color: 0x5a5852, width: .7, alpha: .5 });
      const set = S.tex.dec.tape; if (set) for (let i = 1; i < 4; i++) { const t = i / 4, bx = Math.pow(1 - t, 3) * (wx + 2) + 3 * Math.pow(1 - t, 2) * t * (wx + 60) + 3 * (1 - t) * t * t * (x1 - 80) + t * t * t * (x1 + 2), by = Math.pow(1 - t, 3) * (y0 + 30) + 3 * Math.pow(1 - t, 2) * t * (y0 + 40) + 3 * (1 - t) * t * t * (y0 + 34) + t * t * t * (y0 + 6);
        g.setTransform(0, 1, -1, 0, bx, by); g.fillStyle = { color: 0xffffff, alpha: .95 }; g.texture(set[i % 2].t, 0xffffff, -13, -4, 26, 8); g.resetTransform(); R.n.decals++; }
    }
  }

  /* walls: every owned wall cell gets its cap, then a papered band on each side that faces floor.  mode 'legacy' keeps the
   * v23.3.6 band widths (S 46, E/W 27, N 23); mode 'depth' is the DEV cue: a uniform 18 px band with a lit lip on all four
   * sides.  Convex corners of a cell split on the diagonal; inner corners are filled from both faces, split the same way.
   * Every band lies inside its own wall cell: nothing covers floor. */
  function buildWalls(R, X, ownWall, wall, mode) {
    const g = new S.G(), o = R.o, tex = mode === 'depth' ? X.depth[R.prof.id] : X.wall[R.prof.id], s = X.q.artScale, ph = VZ.unit(R.id, 'paper-phase') * 192; g.label = 'walls:' + mode;
    const Wd = mode === 'depth' ? { S: 18, N: 18, E: 18, W: 18 } : { S: 46, N: 23, E: 27, W: 27 };
    const capStyle = { texture: X.cap, textureSpace: 'global', matrix: M(1, 0, 0, 1, 0, 0) };
    /* texel (tu along the wall, tv down the canvas; canvas row 0 is v = 48, the crease is the last row) -> world.
     * The crease (the face's base) lies on the floor edge `base`; the face rises into its own wall cell. */
    const H = mode === 'depth' ? 18 : 48;
    const fs = (side, base) => ({ texture: tex, textureSpace: 'global',
      matrix: side === 'S' ? M(1 / s, 0, 0, 1 / s, ph, base - H) : side === 'N' ? M(1 / s, 0, 0, -1 / s, ph, base + H) : side === 'E' ? M(0, 1 / s, 1 / s, 0, base - H, ph) : M(0, 1 / s, -1 / s, 0, base + H, ph) });
    for (let cy = o.y - 1; cy <= o.y + o.h; cy++) for (let cx = o.x - 1; cx <= o.x + o.w; cx++) {
      if (!ownWall(cx, cy)) continue; const x0 = cx * T, y0 = cy * T, x1 = x0 + T, y1 = y0 + T;
      if (mode === 'depth') g.rect(x0, y0, T, T).fill(capStyle);           // the legacy-width faces cover the old bands exactly; the old cap (the same dark top, hidden by the sight shape in play) stays
      const f = { S: !wall(cx, cy + 1), N: !wall(cx, cy - 1), E: !wall(cx + 1, cy), W: !wall(cx - 1, cy) };
      const sw = Wd.S, nw = Wd.N, ew = Wd.E, ww = Wd.W;
      if (f.S) { const p = [x0, y1 - sw, x1, y1 - sw, x1, y1, x0, y1]; if (f.E) { p[2] = x1 - ew; } if (f.W) { p[0] = x0 + ww; } g.poly(p).fill(fs('S', y1)); R.n.faces++; }
      if (f.N) { const p = [x0, y0, x1, y0, x1, y0 + nw, x0, y0 + nw]; if (f.E) { p[4] = x1 - ew; } if (f.W) { p[6] = x0 + ww; } g.poly(p).fill(fs('N', y0)); R.n.faces++; }
      if (f.E) { const p = [x1 - ew, y0, x1, y0, x1, y1, x1 - ew, y1]; if (f.N) p[1] = y0 + nw; if (f.S) p[7] = y1 - sw; g.poly(p).fill(fs('E', x1)); R.n.faces++; }
      if (f.W) { const p = [x0, y0, x0 + ww, y0, x0 + ww, y1, x0, y1]; if (f.N) p[3] = y0 + nw; if (f.S) p[5] = y1 - sw; g.poly(p).fill(fs('W', x0)); R.n.faces++; }
      // inner corners: a diagonal floor cell whose two orthogonal neighbours are both walls with faces toward it
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        if (wall(cx + dx, cy + dy) || !wall(cx + dx, cy) || !wall(cx, cy + dy)) continue;
        const hx = dx > 0 ? x1 : x0, hy = dy > 0 ? y1 : y0;                // the corner point of this cell touching the floor diagonal
        const hw = dy > 0 ? Wd.S : Wd.N, vw = dx > 0 ? Wd.E : Wd.W;         // band widths of the neighbours' faces that meet here
        const ax = hx - dx * vw, ay = hy - dy * hw;                         // the inner corner square of this cell
        g.poly([hx, hy, hx, ay, ax, ay]).fill(fs(dy > 0 ? 'S' : 'N', hy));  // continues the horizontal face of the cell beside (touches its band)
        g.poly([hx, hy, ax, hy, ax, ay]).fill(fs(dx > 0 ? 'E' : 'W', hx));  // continues the vertical face of the cell above / below
      }
    }
    return g;
  }

  /* things on the walls' lowest band (where the eye actually reaches): water wicking up, lifted seams, outlets; HUMMING ROOMS
   * gets junction boxes, BLACKOUT ZONE a burnt outlet.  Face space: drawn through a transform per face orientation. */
  function wallDecor(R, X, ownWall, g) {
    const o = R.o, prof = R.prof, W = prof.wallpaper, faces = [], dens = X.q.decals;
    for (let cy = o.y - 1; cy <= o.y + o.h; cy++) for (let cx = o.x - 1; cx <= o.x + o.w; cx++) {
      if (!ownWall(cx, cy)) continue; const x0 = cx * T, y0 = cy * T;
      const own = (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && isFloor(x, y);
      if (own(cx, cy + 1)) faces.push({ side: 'S', cx, cy, bx: x0, by: y0 + T, ux: 1, uy: 0, nx: 0, ny: -1 });
      if (own(cx, cy - 1)) faces.push({ side: 'N', cx, cy, bx: x0 + T, by: y0, ux: -1, uy: 0, nx: 0, ny: 1 });
      if (own(cx + 1, cy)) faces.push({ side: 'E', cx, cy, bx: x0 + T, by: y0 + T, ux: 0, uy: -1, nx: -1, ny: 0 });
      if (own(cx - 1, cy)) faces.push({ side: 'W', cx, cy, bx: x0, by: y0, ux: 0, uy: 1, nx: 1, ny: 0 });
    }
    const put = (f, kind, i, u, v, scl = 1, alpha = 1) => {               // u along the face (0..96), v up from the crease
      const set = X.dec[kind]; if (!set) return; const d = set[i % set.length], x = f.bx + f.ux * u + f.nx * v, y = f.by + f.uy * u + f.ny * v;
      // decal canvases are drawn upright with their base at the bottom: map canvas +x -> along the wall, canvas +y -> down toward the crease
      g.setTransform(f.ux * scl, f.uy * scl, -f.nx * scl, -f.ny * scl, x, y); g.fillStyle = { color: 0xffffff, alpha }; g.texture(d.t, 0xffffff, -d.w / 2, -d.h, d.w, d.h); g.resetTransform(); R.n.decals++;
    };
    for (const f of faces) {
      const u = k => VZ.unit(R.id, 'wall', k, f.side, f.cx, f.cy);
      if (u('damp') < W.damp * .5 * dens) put(f, 'dampwall', 0, 20 + u('du') * 56, 0, .8 + u('ds') * .5, .85);
      if (u('peel') < W.peel * .16 * dens) put(f, 'peel', 0, 14 + u('pu') * 68, 9, .9, .9);
      if (u('mildew') < (W.mildew || 0) * .35 * dens) put(f, 'mildewwall', 0, 18 + u('mu') * 60, 0, .9 + u('ms') * .4, .9);
      if (u('outlet') < .1) put(f, 'outlet', 0, 20 + u('ou') * 56, 15, .9, 1);
      if (prof.accent === 'electrical' && u('jbox') < .12) put(f, 'jbox', 0, 18 + u('ju') * 60, 19, .9, 1);
      if (prof.accent === 'failed-power' && u('scorch') < .06) { const uu = 24 + u('su') * 48; put(f, 'scorch', 0, uu, 6, 1, .9); put(f, 'outlet', 0, uu, 15, .9, 1); }
    }
  }

  /* ======================================================================================================================
   * LIFECYCLE
   * ==================================================================================================================== */
  function fail(where, e) {
    S.errors++; S.disabled = where + ': ' + String(e && e.message || e).slice(0, 160);
    try { if (S.root) S.root.visible = false; if (S.ceil) for (const c of S.ceil.children) c.visible = c === S.legacyLamps; if (S.legacyLamps) S.legacyLamps.visible = true; if (S.carpet) S.carpet.visible = true; if (S.legacyFloor) S.legacyFloor.visible = false; } catch (x) { }
    try { console.warn('[l0-remaster] disabled (' + S.disabled + '); the level keeps its v23.3.6 art'); } catch (x) { }
  }
  function lamp(t, e, lampTop) {
    try {
      if (!S.on || S.disabled || !VZ || !e) return lampTop;
      const r = roomAt(e.x, e.y); if (!r || !VZ.inSlice(r.id)) return lampTop;
      if (!S.legacyLamps) { S.legacyLamps = new lampTop.constructor(); S.legacyLamps.label = 'l0v-legacy-lamps'; }
      S.ownLamps.push({ t, id: VZ.lampId(t), x: e.x, y: e.y, room: r.id, aged: t % 13 === 0 });
      return S.legacyLamps;
    } catch (err) { S.errors++; return lampTop; }
  }
  function built(world, level, lampTop) {
    try {
      if (!S.on || S.disabled || !VZ || !world || !level || !lampTop) return;
      S.world = world; S.level = level; S.lampTop = lampTop; S.G = level.constructor; S.C = world.constructor;
      const carpet = world.children.find(c => c && c.tileScale && c.texture); S.Tex = carpet && carpet.texture && carpet.texture.constructor; S.carpet = carpet || null;
      if (!S.Tex || typeof S.Tex.from !== 'function') { fail('attach', 'texture class unavailable'); return; }
      S.root = new S.C(); S.root.label = 'l0-remaster'; S.root.visible = false;
      world.addChildAt(S.root, world.children.indexOf(level) + 1);                    // right above the level art: under traces, corpses, actors
      S.ceil = new S.C(); S.ceil.label = 'l0-remaster-ceiling';
      world.addChildAt(S.ceil, world.children.indexOf(lampTop) + 1);                  // right above the legacy fixtures
      if (S.legacyLamps) S.ceil.addChild(S.legacyLamps);
      S.ceil.onRender = () => { const L = S.lampTop; if (!L) return; S.ceil.position.copyFrom(L.position); S.ceil.scale.copyFrom(L.scale); S.ceil.alpha = L.alpha; S.ceil.visible = L.visible; };
      setTimeout(build, 0);
    } catch (e) { fail('attach', e); }
  }
  function destroyRooms() {
    for (const R of S.rooms) { try { R.cont.destroy({ children: true }); R.ceilG.destroy(); } catch (e) { } }
    S.rooms = []; for (const t of S.texList || []) { try { t.destroy(true); } catch (e) { } } S.texList = [];
    Object.assign(S.stats, { textures: 0, texMPx: 0, decals: 0, faces: 0, floorRects: 0, fixtures: 0 });
  }
  /* The legacy carpet is one TilingSprite over the whole world.  While the remaster shows, it is hidden and replaced by the
   * same texture, same mapping, over the floor cells the remaster does NOT own (a pixel-identical copy there): the slice
   * rooms then draw one carpet layer, not two.  Remaster off restores the original sprite. */
  function buildLegacyFloor() {
    const C = S.carpet; if (!C || !C.texture || S.legacyFloor) return;
    const A = api(), owned = (cx, cy) => S.rooms.some(R => cx >= R.o.x && cx < R.o.x + R.o.w && cy >= R.o.y && cy < R.o.y + R.o.h);
    try { const st = C.texture.source && C.texture.source.style; if (st && st.addressMode !== 'repeat') st.addressMode = 'repeat'; } catch (e) { }
    const g = new S.G(), ts = C.tileScale || { x: 1, y: 1 }, tp = C.tilePosition || { x: 0, y: 0 }, style = { texture: C.texture, textureSpace: 'global', matrix: M(ts.x, 0, 0, ts.y, C.position.x + tp.x, C.position.y + tp.y), color: C.tint == null ? 0xffffff : C.tint };
    g.label = 'l0-legacy-carpet'; let n = 0;
    const W = Math.round(C.width / T), H = Math.round(C.height / T);
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W;) { if (!A.zc(cx, cy) || owned(cx, cy)) { cx++; continue; } let e = cx; while (e + 1 < W && A.zc(e + 1, cy) && !owned(e + 1, cy)) e++; g.rect(cx * T, cy * T, (e - cx + 1) * T, T).fill(style); n++; cx = e + 1; }
    S.world.addChildAt(g, S.world.children.indexOf(C));                // in the carpet's place (BR-RoLE still finds the carpet right before the level art)
    S.legacyFloor = g; S.stats.legacyFloorRects = n;
  }
  function build() {
    const t0 = now();
    try {
      if (S.rooms.length) destroyRooms();
      S.tier = tierNow(); const t1 = now(); S.tex = makeTextures(S.tier); S.stats.texMs = +(now() - t1).toFixed(1);
      for (const id of VZ.slice) S.rooms.push(buildRoom(VZ.room(id), S.tex));
      buildLegacyFloor(); S.built = true; S.stats.rooms = S.rooms.length; S.stats.builds++;
      apply();
    } catch (e) { fail('build', e); }
    S.stats.buildMs = +(now() - t0).toFixed(1);
  }
  function apply() {                                    // the DEV toggles, applied to the built layers
    if (!S.root || S.disabled) return;
    const on = S.want && S.built;
    S.root.visible = on; if (S.legacyLamps) S.legacyLamps.visible = !on;
    if (S.legacyFloor && S.carpet) { S.legacyFloor.visible = on; S.carpet.visible = !on; }
    for (const R of S.rooms) { R.ceilG.visible = on && R.ceilG.visible !== false; R.walls.visible = !S.depth; R.depthWalls.visible = S.depth; for (const d of R.decalLayers) d.visible = S.decals; }
    cull(true); showTag();
  }
  function cull(force) {                                // per-room culling by the view (plus a margin); mirrors BR-RoLE's grounding visibility
    if (!S.world || !S.built) return;
    const w = S.world, k = w.scale.x || 1, m = 2 * T, x0 = -w.position.x / k - m, y0 = -w.position.y / k - m, x1 = (innerWidth - w.position.x) / k + m, y1 = (innerHeight - w.position.y) / k + m;
    if (!S.brRoot || !S.brRoot.parent) S.brRoot = S.world.children.find(c => c && c.label === 'br-role') || null;
    const ao = S.brRoot ? S.brRoot.visible && (!S.brRoot.children[0] || S.brRoot.children[0].visible) : false;
    let n = 0; const on = S.want && !S.disabled;
    for (const R of S.rooms) { const v = on && R.x1 > x0 && R.x0 < x1 && R.y1 > y0 && R.y0 < y1; if (v) n++; if (R.cont.visible !== v || force) R.cont.visible = v; if (R.ceilG.visible !== v || force) R.ceilG.visible = v; if (R.ao.visible !== ao) R.ao.visible = ao; }
    S.stats.visibleRooms = n;
  }
  function tick() {
    try {
      S.frame++;
      if (S.built && !S.disabled) { cull(false); const t = Date.now(); if (t - (S.polled || 0) > 400) { S.polled = t; if (tierNow() !== S.tier) build(); } }   // the player's quality tier, a few times a second
    } catch (e) { fail('frame', e); }
    requestAnimationFrame(tick);
  }
  if (S.on && VZ) requestAnimationFrame(tick);

  /* ---------- DEV (QA comparison only) ---------- */
  function showTag() {
    if (!S.dev) return; if (!S.tag) { S.tag = document.createElement('div'); S.tag.id = 'l0vTag'; S.tag.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;font:11px/1.3 monospace;color:#e8dfa8;background:#000a;padding:4px 7px;pointer-events:none;letter-spacing:.04em'; document.body.appendChild(S.tag); }
    S.tag.textContent = `REMASTER ${S.want && !S.disabled ? 'ON' : 'OFF'} [F8] · WALL DEPTH ${S.depth ? 'ON' : 'OFF'} [F9] · DECALS ${S.decals ? 'ON' : 'OFF'} [Shift+F8] · ${S.tier.toUpperCase()}` + (S.disabled ? ' · ' + S.disabled : '');
  }
  if (S.dev) window.addEventListener('keydown', e => {
    if (e.code === 'F8' && e.shiftKey) { S.decals = !S.decals; apply(); e.preventDefault(); }
    else if (e.code === 'F8') { S.want = !S.want; apply(); e.preventDefault(); }
    else if (e.code === 'F9') { S.depth = !S.depth; apply(); e.preventDefault(); }
  }, true);

  window.__l0v = {
    version: VERSION, lamp, built,
    on: () => S.on && S.want && S.built && !S.disabled,
    ready: () => S.built || !!S.disabled || !S.on,
    stats: () => ({ version: VERSION, revision: VZ && VZ.revision, on: S.on && S.want && S.built && !S.disabled, attached: !!S.root, built: S.built, disabled: S.disabled, tier: S.tier, depth: S.depth, decalsOn: S.decals,
      slice: VZ ? VZ.slice.slice() : [], ownLamps: S.ownLamps.map(l => l.id), errors: S.errors, ...S.stats, texMPx: +S.stats.texMPx.toFixed(2),
      rooms: S.rooms.map(R => ({ id: R.id, floorRects: R.n.floor, faces: R.n.faces, decals: R.n.decals, props: R.props || [], visible: R.cont.visible })) }),
    dev: {
      remaster: v => { S.want = v === undefined ? !S.want : !!v; apply(); return S.want; },
      depth: v => { S.depth = v === undefined ? !S.depth : !!v; apply(); return S.depth; },
      decals: v => { S.decals = v === undefined ? !S.decals : !!v; apply(); return S.decals; },
      rebuild: () => { build(); return S.stats.buildMs; },
      layer: (label, v) => { let n = 0; for (const R of S.rooms) for (const c of [...R.cont.children, R.ceilG]) if (c.label === label || (label === 'fixtures' && c === R.ceilG)) { c.visible = !!v; n++; } return n; },
      macro: id => { const R = S.rooms.find(r => r.id === id); return R && R.macroCanvas ? R.macroCanvas.toDataURL() : null; },
      layers: () => S.root ? { root: S.world.children.indexOf(S.root), level: S.world.children.indexOf(S.level), ceil: S.world.children.indexOf(S.ceil), lampTop: S.world.children.indexOf(S.lampTop), legacyLamps: !!S.legacyLamps } : null,
      art: { carpetCanvas, wallpaperCanvas, capCanvas, decalCanvases, counterCanvas, tableCanvas, holeCanvas, fixtureCanvas },
    },
  };
})();
