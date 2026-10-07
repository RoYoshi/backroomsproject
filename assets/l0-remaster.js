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
 *   built(world, level, top, app)  at the end of build() (app: the game's Pixi application, for the bake): the remaster layer goes right above the level art (below the
 *                              objective traces, corpses and every actor), the ceiling layer right above lampTop, sharing
 *                              its parallax and alpha.  With ?remaster=off neither hook does anything: exactly v23.3.6.
 * In the slice rooms the remaster layer is opaque, so the legacy floor blots, painted lamp glows, the BLACKOUT ZONE's
 * painted black and the old wall / prop art are covered, not edited; switching the remaster off shows them again, live.
 * BR-RoLE's static wall grounding lies under the level art; the remaster redraws the same grounding (same falloff, width
 * and alpha) on its own floor, following BR-RoLE's visibility, so walls stay grounded exactly as elsewhere.
 *
 * Static art is paid once: textures are generated from the seeded presentation hash when the level is built (carpet tile,
 * wallpaper, wall cap, decals, props, fixtures; per-room low-resolution wear / damp maps), and each room's layers form a
 * source container that is never on screen.  QA2: the sources are BAKED into chunk textures (384 world px, the screen's
 * own texel density, clamped per tier) by the game's renderer (the 4th built() argument) as they come into view, a few
 * ahead of time, the oldest dropped beyond the tier's cache.  On screen a remastered room is one textured layer, about
 * what the old carpet sprite cost (QA1 stacked five or more room-sized layers).  Without the renderer the layers are
 * drawn directly, as in QA1.  LOW: smaller textures, fewer decals, no wear map, a lower bake density and a smaller cache.
 * DEV comparison only (QA tools, not player settings): ?remaster=off, ?walldepth=on, ?decals=off; with ?dev3b the keys
 * F8 (remaster), F9 (wall-depth cue) and Shift+F8 (decals) toggle live, and a readout shows the frame time, the scene's GPU
 * time where the browser can time it, and what the bake holds. */
(() => {
  'use strict';
  if (window.__l0v) return;
  const VERSION = 'l0-remaster 3b-qa2';
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
    app: null, renderer: null, mode: 'bake', RT: null, q: null, dens: 1, gen: 0, ao: null,
    bake: { px: 0, bakes: 0, ms: 0, maxMs: 0, lastMs: 0, evictions: 0, visible: 0, resident: 0, error: '' },
    dyn: [], dynSeq: 0, extTex: null,
    perf: { last: 0, ema: 0, gpu: null, gpuEma: 0, poll: null, shown: 0 },
  };
  const now = () => Date.now();                        // wall clock for the build timings (a test may freeze performance.now)
  const perfNow = () => { try { return performance.now(); } catch (e) { return Date.now(); } };
  const CH = 384;                                        // bake chunk edge, world px (4 cells)
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
  const DPAD = 2;                                        // every decal canvas keeps a transparent margin (decal units): a clipped fill samples past the art safely
  function decalCanvases(s, key) {
    const out = {}, r = VZ.rng('decals', key, s), wob = n => Array.from({ length: n }, () => r());
    const make = (name, w, h, draw) => { const c = mkCanvas((w + DPAD * 2) * s, (h + DPAD * 2) * s), x = c.getContext('2d'); x.scale(s, s); x.translate(DPAD, DPAD); draw(x, w, h); (out[name] || (out[name] = [])).push({ c, w, h, s }); };
    const carpet = MAT('material:carpet'), St = rgb(carpet.stain), Dm = rgb(carpet.damp), Td = rgb(carpet.tide);
    for (let v = 0; v < 4; v++) make('stain', 64, 64, (x, w, h) => {      // a soaked-in spill: soft body, darker rim, satellite drops
      const g = x.createRadialGradient(32, 32, 2, 32, 32, 28); g.addColorStop(0, css(St, .5)); g.addColorStop(.75, css(St, .38)); g.addColorStop(1, css(St, 0));
      x.fillStyle = g; blob(x, r, 32, 32, 22 + r() * 5, wob(28)); x.fill();
      x.strokeStyle = css(mul(St, .8), .28); x.lineWidth = 1.4; blob(x, r, 32, 32, 21 + r() * 4, wob(28)); x.stroke();
      for (let i = 0; i < 5; i++) { x.fillStyle = css(St, .3 + r() * .2); x.beginPath(); x.arc(32 + (r() - .5) * 52, 32 + (r() - .5) * 52, 1 + r() * 2.5, 0, 7); x.fill(); }
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
    /* furniture indents (canon audit: "indents in the level's carpeting suggest that furniture may have been present"): crushed
     * pile where something once stood, never anything that is still there.  v0: four post marks; v1: a long base's rectangle */
    const Cr = mul(rgb(carpet.fiber), .8);
    make('indent', 96, 56, (x) => {
      for (const [px, py] of [[10, 10], [86, 10], [10, 46], [86, 46]]) { const g = x.createRadialGradient(px, py, .5, px, py, 6.5); g.addColorStop(0, css(Cr, .5)); g.addColorStop(.55, css(Cr, .34)); g.addColorStop(1, css(Cr, 0)); x.fillStyle = g; x.fillRect(px - 7, py - 7, 14, 14);
        x.fillStyle = css(Cr, .22); x.fillRect(px - 2.6, py - 2.6, 5.2, 5.2); }
    });
    make('indent', 120, 44, (x) => {
      x.save(); x.filter = 'blur(1.2px)'; x.strokeStyle = css(Cr, .36); x.lineWidth = 3.2; x.strokeRect(5, 5, 110, 34); x.restore();
      x.fillStyle = css(Cr, .1); x.fillRect(6, 6, 108, 32);
    });
    /* the DEV receiver proof (only stamped with ?dev3b=1): a neutral chalk target, plainly a test mark, never blood */
    make('proof', 44, 44, (x) => {
      x.strokeStyle = 'rgba(198,222,232,.85)'; x.lineWidth = 2.2; x.beginPath(); x.arc(22, 22, 17, 0, 7); x.stroke();
      x.lineWidth = 1.6; x.beginPath(); x.moveTo(22, 2); x.lineTo(22, 42); x.moveTo(2, 22); x.lineTo(42, 22); x.stroke();
      x.fillStyle = 'rgba(198,222,232,.9)'; x.beginPath(); x.arc(22, 22, 3, 0, 7); x.fill();
    });
    return out;
  }

  /* ---------- props (exact world.js rects; the art never leaves the footprint except a soft contact shade) ---------- */
  const PAD = 12;                                        // texture margin around a prop for its contact shade
  function contact(x, w, h, k = .38, rr = 4) {           // soft ambient contact all round (not a directional shadow: BR-RoLE owns those)
    for (let i = 6; i >= 1; i--) { x.fillStyle = `rgba(16,12,4,${k / 6})`; const e = i * 1.4; x.beginPath(); x.roundRect(PAD - e, PAD - e, w + e * 2, h + e * 2, rr + e); x.fill(); }
  }
  /* a built-in laminate counter, bare (canon audit: nothing sits on it).  Volume: the top, a front face to the south (the
   * game's camera sees south faces, as on the walls), narrow end faces, a lit back edge and front bevel, wear on the front
   * edge, and a darker contact line where the face meets the carpet.  Exactly the footprint, plus the flat contact shade. */
  function counterCanvas(s, p, prof, key) {
    const w = p.rect.w, h = p.rect.h, c = mkCanvas((w + PAD * 2) * s, (h + PAD * 2) * s), x = c.getContext('2d'), r = VZ.rng('prop', key, p.id); x.scale(s, s);
    contact(x, w, h);
    x.translate(PAD, PAD);
    const F = 11, E = 2.5;                                                                                   // front face depth, end faces
    x.fillStyle = '#463a24'; x.beginPath(); x.roundRect(0, 0, w, h, 3); x.fill();                          // body
    const fr = x.createLinearGradient(0, h - F, 0, h); fr.addColorStop(0, '#5a4a2e'); fr.addColorStop(.35, '#4a3d26'); fr.addColorStop(1, '#2f2617');
    x.fillStyle = fr; x.fillRect(E, h - F, w - E * 2, F);                                                 // the front face, darker toward the floor
    for (let i = 1; i < 3; i++) { x.fillStyle = 'rgba(16,12,6,.55)'; x.fillRect(w * i / 3 - .6, h - F, 1.2, F); }   // panel joints on the face
    x.fillStyle = 'rgba(20,15,8,.65)'; x.fillRect(E, h - 2.2, w - E * 2, 2.2);                            // the kick recess at the floor
    x.fillStyle = '#3a301d'; x.fillRect(0, 3, E, h - 4); x.fillRect(w - E, 3, E, h - 4);                  // the end faces, in shade
    const top = x.createLinearGradient(0, 0, 0, h - F); top.addColorStop(0, '#d7caa0'); top.addColorStop(1, '#c4b689'); x.fillStyle = top; x.beginPath(); x.roundRect(1.5, 1.2, w - 3, h - F - 1.2, 2); x.fill();
    for (let i = 0; i < 220; i++) { x.fillStyle = r() > .5 ? 'rgba(120,104,70,.16)' : 'rgba(255,250,230,.14)'; x.fillRect(2 + r() * (w - 4), 2 + r() * (h - F - 3), .9, .9); }   // laminate fleck
    x.fillStyle = 'rgba(255,248,224,.42)'; x.fillRect(3, 1.6, w - 6, 1);                                  // the back edge catches the tubes
    x.fillStyle = 'rgba(255,244,214,.3)'; x.fillRect(2, h - F - .8, w - 4, 1.1);                          // the front bevel, lit
    x.fillStyle = 'rgba(60,46,24,.45)'; x.fillRect(2, h - F + .3, w - 4, 1);                               // ... and its shadowed underside
    const wear = x.createLinearGradient(0, h - F - 1, 0, h - F - 12); wear.addColorStop(0, 'rgba(90,70,40,.26)'); wear.addColorStop(1, 'rgba(90,70,40,0)'); x.fillStyle = wear; x.fillRect(3, h - F - 12, w - 6, 11);   // worn along the front edge
    for (let i = 1; i < 3; i++) { x.fillStyle = 'rgba(110,94,62,.4)'; x.fillRect(w * i / 3 - .5, 2, 1, h - F - 3); }                      // panel joints on the top
    for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(255,252,240,.18)'; x.lineWidth = .6; x.beginPath(); const sx = 6 + r() * (w - 20), sy = 4 + r() * (h - F - 8); x.moveTo(sx, sy); x.lineTo(sx + 6 + r() * 14, sy + (r() - .5) * 3); x.stroke(); }   // old scratches
    x.strokeStyle = 'rgba(70,56,32,.85)'; x.lineWidth = 1; x.beginPath(); x.roundRect(.5, .5, w - 1, h - 1, 3); x.stroke();                    // the footprint's edge
    return c;
  }
  /* a long table on legs, bare (canon audit): the top overhangs a dark gap you can crawl beneath.  Volume: the top's thick
   * front edge (south), a lit back edge, legs standing in the shadowed gap, dust on the top.  Exactly the footprint. */
  function tableCanvas(s, p, prof, key) {
    const w = p.rect.w, h = p.rect.h, c = mkCanvas((w + PAD * 2) * s, (h + PAD * 2) * s), x = c.getContext('2d'), r = VZ.rng('prop', key, p.id); x.scale(s, s);
    contact(x, w, h, .42); x.translate(PAD, PAD);
    const gap = x.createLinearGradient(0, 0, 0, h); gap.addColorStop(0, 'rgba(10,8,3,.7)'); gap.addColorStop(1, 'rgba(4,3,1,.9)');
    x.fillStyle = gap; x.beginPath(); x.roundRect(0, 0, w, h, 3); x.fill();                                // the dark beneath the top, seen at its rim
    for (const [lx, ly] of [[3, 3], [w - 9, 3], [3, h - 9], [w - 9, h - 9]]) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(lx + 1, ly + 1.5, 6, 6); x.fillStyle = '#2b2416'; x.fillRect(lx, ly, 6, 6); x.fillStyle = 'rgba(160,150,120,.22)'; x.fillRect(lx, ly, 6, 1); }   // the legs, grounded
    const TH = 5, top = x.createLinearGradient(0, 0, w, h); top.addColorStop(0, '#9a8358'); top.addColorStop(1, '#887049');
    x.fillStyle = top; x.beginPath(); x.roundRect(4, 3, w - 8, h - 9 - TH, 2.5); x.fill();                 // the top
    const edge = x.createLinearGradient(0, h - 6 - TH, 0, h - 6); edge.addColorStop(0, '#7a6440'); edge.addColorStop(1, '#4a3a20');
    x.fillStyle = edge; x.fillRect(4.5, h - 6 - TH, w - 9, TH);                                           // its thick front edge (south face)
    x.fillStyle = 'rgba(255,236,190,.28)'; x.fillRect(5, h - 6 - TH, w - 10, .9);                          // the lit arris
    for (let i = 0; i < 22; i++) { x.strokeStyle = `rgba(${60 + r() * 30},${44 + r() * 20},${24},${.1 + r() * .1})`; x.lineWidth = .7 + r() * 1.1; const yy = 5 + r() * (h - 16 - TH); x.beginPath(); x.moveTo(5, yy); x.bezierCurveTo(w * .3, yy + (r() - .5) * 3, w * .7, yy + (r() - .5) * 3, w - 5, yy + (r() - .5) * 2); x.stroke(); }   // wood-grain laminate
    x.strokeStyle = 'rgba(48,36,18,.85)'; x.lineWidth = 1.1; x.beginPath(); x.roundRect(4, 3, w - 8, h - 9 - TH, 2.5); x.stroke();
    x.fillStyle = 'rgba(255,240,200,.24)'; x.fillRect(6, 3.6, w - 12, 1);                                // the back edge catches light
    const dust = x.createRadialGradient(w * .5, h * .35, 4, w * .5, h * .35, w * .5); dust.addColorStop(0, 'rgba(190,180,150,.0)'); dust.addColorStop(1, 'rgba(190,180,150,.17)'); x.fillStyle = dust; x.fillRect(4, 3, w - 8, h - 9 - TH);   // dust, thicker toward the edges
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
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {         // crumbs spilled out of both mouths onto the floor
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
    x.fillStyle = 'rgba(70,60,36,.16)'; x.fillRect(9, 3, w - 18, 1.6); x.fillRect(9, h - 4.6, w - 18, 1.6);  // dust settled along the lens edges (canon audit: no insects - the level is lifeless)
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
    for (const k of Object.keys(dc)) X.dec[k] = dc[k].map(o => ({ t: texOf(o.c, { mip: true }), w: o.w, h: o.h, s: o.s }));
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
    const R = { id: vr.id, code: vr.code, o, prof, src: new S.C(), view: new S.C(), ceilG: new S.G(), x0: (o.x - 1) * T, y0: (o.y - 1) * T, x1: (o.x + o.w + 1) * T, y1: (o.y + o.h + 1) * T, n: { floor: 0, faces: 0, decals: 0 } };
    R.src.label = 'l0v:' + vr.id; R.view.label = 'l0v-view:' + vr.id; R.ceilG.label = 'fixtures:' + vr.id;
    const own = (cx, cy) => cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h && isFloor(cx, cy);
    const ownWall = (cx, cy) => cx >= o.x - 1 && cx <= o.x + o.w && cy >= o.y - 1 && cy <= o.y + o.h && !isFloor(cx, cy);
    const wall = (cx, cy) => !isFloor(cx, cy);
    const rnd = VZ.rng('room', vr.id);

    /* -- 1 floor: carpet rolls (each roll its own texture phase and a whisper of tone), seams between them -- */
    const floorG = new S.G(); floorG.label = 'floor'; R.src.addChild(floorG);
    const seamless = !cp.seams || cp.seams === 'none', along = cp.seams === 'x' ? 'x' : 'y', ROLL = seamless ? 1e9 : 184, tone = cp.tone || 1, sc = X.carpetScale;
    const runs = [];                                       // maximal horizontal runs of owned floor cells, merged vertically into rects
    for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w;) { if (!own(cx, cy)) { cx++; continue; } let e = cx; while (e + 1 < o.x + o.w && own(e + 1, cy)) e++; runs.push({ x: cx, y: cy, w: e - cx + 1, h: 1 }); cx = e + 1; }
    const rects = []; for (const r of runs) { const up = rects.find(q2 => q2.x === r.x && q2.w === r.w && q2.y + q2.h === r.y); if (up) up.h++; else rects.push({ ...r }); }
    const span0 = along === 'y' ? o.x * T : o.y * T, span1 = along === 'y' ? (o.x + o.w) * T : (o.y + o.h) * T, rolls = [];
    /* canon: "seamless, consisting of a single continuous piece of carpet" - one piece, its texture anchored to the world, so
     * the carpet also runs on unbroken from room to room (rolls and seams only if an archetype ever asks for them) */
    if (seamless) rolls.push({ a0: span0, a1: span1, k: 0 });
    else for (let a = span0 - VZ.unit(vr.id, 'roll-phase') * ROLL, k = 0; a < span1; a += ROLL, k++) rolls.push({ a0: Math.max(span0, a), a1: Math.min(span1, a + ROLL), k });
    for (const rr of rolls) {
      const ph = seamless ? [0, 0] : [VZ.unit(vr.id, 'roll', rr.k, 'u') * 1024, VZ.unit(vr.id, 'roll', rr.k, 'v') * 1024], tint = seamless ? tone : tone * (1 + (VZ.unit(vr.id, 'roll', rr.k, 't') - .5) * .05);
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
      R.src.addChild(macroG); R.macroCanvas = mc; R.n.macroCells = kept;
    }

    /* -- 3 decals on the carpet (seeded scatter + authored storytelling) -- */
    const mulG = new S.G(); mulG.label = 'decals-mul'; mulG.blendMode = 'multiply'; const decG = new S.G(); decG.label = 'decals';
    R.decalLayers = [mulG, decG];
    const props = window.WORLD && window.WORLD.PROPS ? window.WORLD.PROPS : [];
    const clearOfProps = (x, y, m) => !props.some(p => { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect; return x > rc.x - m && x < rc.x + rc.w + m && y > rc.y - m && y < rc.y + rc.h + m; });
    /* the room's floor is a receiving surface: its own floor cells (world axes); every floor mark is clipped to it */
    R.surfaces = []; R.floorSurf = { id: 'surf:' + vr.id + ':floor', room: vr.id, kind: 'floor', material: 'material:carpet', rects: rects.map(fr => ({ x: fr.x * T, y: fr.y * T, w: fr.w * T, h: fr.h * T })), o: [0, 0], U: [1, 0], N: [0, 1] };
    R.surfaces.push(R.floorSurf);
    const put = (g, kind, i, x, y, rot, scl, alpha, tint = 0xffffff) => { if (!VZ.drawable(kind)) return; const set = X.dec[kind]; if (!set || !set.length) return;
      if (decalOn(g, R.floorSurf, set[i % set.length], x, y, rot, scl, alpha, tint)) R.n.decals++; };
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
      if (u('damp') < cp.damp * (c.edge ? .16 : .05) * dens) put(mulG, 'damp', Math.floor(u('v3') * 3), x + (c.wn[0] ? -20 : c.wn[1] ? 20 : 0), y + (c.wn[2] ? -20 : c.wn[3] ? 20 : 0), r0, .45 + u('s2') * (.3 + cp.damp), clamp(.35 + cp.damp * 1.3, 0, .95));
      if (c.lane > .35 && u('scuff') < D.scuff * .2 * dens) put(mulG, 'scuff', Math.floor(u('v4') * 3), x, y, r0, .8 + u('s3') * .5, .9);
      if (u('indent') < (D.indent || 0) * .014 * dens && clearOfProps(x, y, 80)) {   // furniture once stood here (rare; never under a prop)
        const ix = c.wn[0] ? c.cx * T + 34 : c.wn[1] ? (c.cx + 1) * T - 34 : x, iy = c.wn[2] ? c.cy * T + 34 : c.wn[3] ? (c.cy + 1) * T - 34 : y;
        put(mulG, 'indent', Math.floor(u('v9') * 2), ix, iy, c.wn[0] || c.wn[1] ? Math.PI / 2 + (u('r9') - .5) * .06 : (u('r9') - .5) * .06, .9 + u('s9') * .2, .9);
      }
      if (c.edge && u('debris') < (D.grit || 0) * (c.corner ? .5 : .14) * dens) {
        const px = c.wn[0] ? c.cx * T + 10 : c.wn[1] ? (c.cx + 1) * T - 10 : x, py = c.wn[2] ? c.cy * T + 10 : c.wn[3] ? (c.cy + 1) * T - 10 : y;
        put(decG, 'debris', Math.floor(u('v6') * 3), px, py, r0, .9 + u('s5') * .5, .9);
      }
      if (c.edge && u('mildew') < (cp.mildew || 0) * (c.corner ? .5 : .12) * dens) { const px = c.wn[0] ? c.cx * T + 22 : c.wn[1] ? (c.cx + 1) * T - 22 : x, py = c.wn[2] ? c.cy * T + 22 : c.wn[3] ? (c.cy + 1) * T - 22 : y; put(mulG, 'mildew', Math.floor(u('v8') * 2), px, py, r0, .8 + u('s8') * .6, .9); }
    }
    for (const d of VZ.decor.filter(d => d.room === vr.id)) put(d.kind === 'stain' || d.kind === 'damp' || d.kind === 'scuff' || d.kind === 'indent' ? mulG : decG, d.kind, d.v || 0, d.x, d.y, d.r || 0, d.s || 1, d.a == null ? 1 : d.a);
    R.src.addChild(mulG, decG);

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
    R.ao = aoG; R.src.addChild(aoG);

    /* -- 5 thresholds where the room's carpet meets a corridor (a worn aluminium transition strip) -- */
    const thG = new S.G(); thG.label = 'thresholds';
    const strip = (x, y, ww, hh) => { thG.rect(x, y, ww, hh).fill({ color: 0x6d6a5c }); thG.rect(x, y, ww, Math.min(hh, ww) > 4 ? 1 : 0).fill({ color: 0xc8c4b0, alpha: .5 }); };
    for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w; cx++) if (own(cx, cy)) {
      if (cy === o.y && isFloor(cx, cy - 1)) strip(cx * T, cy * T, T, 5); if (cy === o.y + o.h - 1 && isFloor(cx, cy + 1)) strip(cx * T, (cy + 1) * T - 5, T, 5);
      if (cx === o.x && isFloor(cx - 1, cy)) strip(cx * T, cy * T, 5, T); if (cx === o.x + o.w - 1 && isFloor(cx + 1, cy)) strip((cx + 1) * T - 5, cy * T, 5, T);
    }
    R.src.addChild(thG);

    /* -- 6 walls: caps, papered faces (legacy band widths), mitred corners; and the DEV depth-cue variant -- */
    const polys = new Map(); R.walls = buildWalls(R, X, ownWall, wall, 'legacy', (side, line, idx, poly) => { const k = side + ':' + line; (polys.get(k) || polys.set(k, []).get(k)).push({ idx, poly }); });
    R.depthWalls = buildWalls(R, X, ownWall, wall, 'depth');
    R.src.addChild(R.walls, R.depthWalls); R.depthWalls.visible = S.depth; R.walls.visible = !S.depth;
    wallRuns(R, ownWall, polys);                                                       // the papered wall faces as receiving surfaces
    const wallDecG = new S.G(); wallDecG.label = 'wall-decor'; wallDecor(R, X, ownWall, wallDecG); R.src.addChild(wallDecG); R.decalLayers.push(wallDecG);
    R.dynG = new S.G(); R.dynG.label = 'decals-dynamic'; R.src.addChild(R.dynG);       // stamped later through the receiver (bounded)

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
    R.src.addChild(propG);

    /* -- 8 ceiling: the room's fixtures (lamps in this room, plus visual-only records), legacy footprint -- */
    for (const L of S.ownLamps.filter(l => l.room === vr.id)) R.ceilG.texture(X.fix[L.aged ? 'aged' : prof.fixtures.diffuser === 'yellowed' ? 'yellowed' : 'clean'], 0xffffff, L.x - 45 - 6, L.y - 15 - 6, 102, 40);
    for (const f of VZ.fixtures.filter(f => f.room === vr.id)) R.ceilG.texture(X.fix[f.kind] || X.fix.dead, 0xffffff, f.x - 51, f.y - 21, 102, 40);
    S.stats.fixtures += S.ownLamps.filter(l => l.room === vr.id).length + VZ.fixtures.filter(f => f.room === vr.id).length;
    /* -- 9 the bake grid: the room's art (R.src, never on screen itself) is baked into chunk textures, CH world px square on
     *    a global grid, clipped to the room's box; a chunk with nothing of this room in it is never made -- */
    R.chunks = [];
    for (let y = Math.floor(R.y0 / CH) * CH; y < R.y1; y += CH) for (let x = Math.floor(R.x0 / CH) * CH; x < R.x1; x += CH) {
      const x0 = Math.max(x, R.x0), y0 = Math.max(y, R.y0), x1 = Math.min(x + CH, R.x1), y1 = Math.min(y + CH, R.y1);
      let any = false; for (let cy = Math.floor(y0 / T); cy < Math.ceil(y1 / T) && !any; cy++) for (let cx = Math.floor(x0 / T); cx < Math.ceil(x1 / T) && !any; cx++) any = own(cx, cy) || ownWall(cx, cy);
      if (!any) continue;
      const g = new S.G(); g.label = 'chunk'; g.visible = false; R.view.addChild(g);
      R.chunks.push({ R, key: R.id + '@' + x0 + ',' + y0, x0, y0, x1, y1, g, tex: null, ver: -1, seen: -1, px: 0 });
    }
    S.root.addChild(R.view); S.ceil.addChild(R.ceilG);
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

  /* walls: every owned wall cell gets its cap, then a papered band on each side that faces floor.  mode 'legacy' keeps the
   * v23.3.6 band widths (S 46, E/W 27, N 23); mode 'depth' is the DEV cue: a uniform 18 px band with a lit lip on all four
   * sides.  Convex corners of a cell split on the diagonal; inner corners are filled from both faces, split the same way.
   * Every band lies inside its own wall cell: nothing covers floor. */
  function buildWalls(R, X, ownWall, wall, mode, rec = null) {
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
      if (f.S) { const p = [x0, y1 - sw, x1, y1 - sw, x1, y1, x0, y1]; if (f.E) { p[2] = x1 - ew; } if (f.W) { p[0] = x0 + ww; } g.poly(p).fill(fs('S', y1)); R.n.faces++; if (rec) rec('S', y1, cx, p); }
      if (f.N) { const p = [x0, y0, x1, y0, x1, y0 + nw, x0, y0 + nw]; if (f.E) { p[4] = x1 - ew; } if (f.W) { p[6] = x0 + ww; } g.poly(p).fill(fs('N', y0)); R.n.faces++; if (rec) rec('N', y0, cx, p); }
      if (f.E) { const p = [x1 - ew, y0, x1, y0, x1, y1, x1 - ew, y1]; if (f.N) p[1] = y0 + nw; if (f.S) p[7] = y1 - sw; g.poly(p).fill(fs('E', x1)); R.n.faces++; if (rec) rec('E', x1, cy, p); }
      if (f.W) { const p = [x0, y0, x0 + ww, y0, x0 + ww, y1, x0, y1]; if (f.N) p[3] = y0 + nw; if (f.S) p[5] = y1 - sw; g.poly(p).fill(fs('W', x0)); R.n.faces++; if (rec) rec('W', x0, cy, p); }
      // inner corners: a diagonal floor cell whose two orthogonal neighbours are both walls with faces toward it
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        if (wall(cx + dx, cy + dy) || !wall(cx + dx, cy) || !wall(cx, cy + dy)) continue;
        const hx = dx > 0 ? x1 : x0, hy = dy > 0 ? y1 : y0;                // the corner point of this cell touching the floor diagonal
        const hw = dy > 0 ? Wd.S : Wd.N, vw = dx > 0 ? Wd.E : Wd.W;         // band widths of the neighbours' faces that meet here
        const ax = hx - dx * vw, ay = hy - dy * hw;                         // the inner corner square of this cell
        g.poly([hx, hy, hx, ay, ax, ay]).fill(fs(dy > 0 ? 'S' : 'N', hy));  // continues the horizontal face of the cell beside (touches its band)
        g.poly([hx, hy, ax, hy, ax, ay]).fill(fs(dx > 0 ? 'E' : 'W', hx));  // continues the vertical face of the cell above / below
        if (rec) { rec(dy > 0 ? 'S' : 'N', hy, cx + dx, [hx, hy, hx, ay, ax, ay]); rec(dx > 0 ? 'E' : 'W', hx, cy + dy, [hx, hy, ax, hy, ax, ay]); }
      }
    }
    return g;
  }

  /* the papered wall faces of a room as receiving surfaces: maximal runs of wall cells whose face looks onto this room's
   * floor, on one line.  Axes: u along the face from its start, v up from the crease into the wall (the decal canvases are
   * upright, base at the crease); clip: the band polygons of the run, inner-corner continuations included. */
  const BAND = { S: 46, N: 23, E: 27, W: 27 };
  function wallRuns(R, ownWall, polys) {
    const o = R.o, own = (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && isFloor(x, y), lines = new Map();
    const add = (side, line, idx) => { const k = side + ':' + line; (lines.get(k) || lines.set(k, []).get(k)).push(idx); };
    for (let cy = o.y - 1; cy <= o.y + o.h; cy++) for (let cx = o.x - 1; cx <= o.x + o.w; cx++) {
      if (!ownWall(cx, cy)) continue;
      if (own(cx, cy + 1)) add('S', (cy + 1) * T, cx); if (own(cx, cy - 1)) add('N', cy * T, cx);
      if (own(cx + 1, cy)) add('E', (cx + 1) * T, cy); if (own(cx - 1, cy)) add('W', cx * T, cy);
    }
    R.runOf = new Map();
    for (const [k, list] of lines) {
      const [side, ls] = k.split(':'), line = +ls; list.sort((a, b) => a - b);
      for (let i = 0; i < list.length;) { let j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++; const a0 = list[i], a1 = list[j], len = (a1 - a0 + 1) * T;
        const o2 = side === 'S' ? [a0 * T, line] : side === 'N' ? [(a1 + 1) * T, line] : side === 'E' ? [line, (a1 + 1) * T] : [line, a0 * T];
        const U = side === 'S' ? [1, 0] : side === 'N' ? [-1, 0] : side === 'E' ? [0, -1] : [0, 1], N = side === 'S' ? [0, -1] : side === 'N' ? [0, 1] : side === 'E' ? [-1, 0] : [1, 0];
        const clip = (polys.get(k) || []).filter(q => q.idx >= a0 && q.idx <= a1).map(q => q.poly);
        const sf = { id: `surf:${R.id}:wall:${side}:${line}:${a0}`, room: R.id, kind: 'wall', side, material: 'material:wallpaper', o: o2, U, N, len, band: BAND[side], polys: clip, a0, a1 };
        R.surfaces.push(sf); for (let a = a0; a <= a1; a++) R.runOf.set(side + ':' + line + ':' + a, sf); i = j + 1; }
    }
  }
  /* things on the walls' lowest band (where the eye actually reaches): water wicking up, lifted seams, mildew, outlets;
   * HUMMING ROOMS gets sparse junction boxes, BLACKOUT ZONE a rare burnt outlet.  Placed per face cell (the same seeded keys
   * as QA1), drawn through the receiver: in the run's own coordinates, clipped to its band. */
  function wallDecor(R, X, ownWall, g) {
    const o = R.o, prof = R.prof, W = prof.wallpaper, faces = [], dens = X.q.decals;
    for (let cy = o.y - 1; cy <= o.y + o.h; cy++) for (let cx = o.x - 1; cx <= o.x + o.w; cx++) {
      if (!ownWall(cx, cy)) continue;
      const own = (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && isFloor(x, y);
      if (own(cx, cy + 1)) faces.push({ side: 'S', cx, cy, line: (cy + 1) * T, idx: cx });
      if (own(cx, cy - 1)) faces.push({ side: 'N', cx, cy, line: cy * T, idx: cx });
      if (own(cx + 1, cy)) faces.push({ side: 'E', cx, cy, line: (cx + 1) * T, idx: cy });
      if (own(cx - 1, cy)) faces.push({ side: 'W', cx, cy, line: cx * T, idx: cy });
    }
    const put = (f, kind, i, u, v, scl = 1, alpha = 1) => {               // u along this cell's face (0..96), v up from the crease
      if (!VZ.drawable(kind)) return; const set = X.dec[kind], sf = R.runOf.get(f.side + ':' + f.line + ':' + f.idx); if (!set || !sf) return;
      const off = (f.side === 'S' || f.side === 'W' ? f.idx - sf.a0 : sf.a1 - f.idx) * T;   // this cell's start along the run
      if (decalOn(g, sf, set[i % set.length], off + u, v, 0, scl, alpha)) R.n.decals++;
    };
    for (const f of faces) {
      const u = k => VZ.unit(R.id, 'wall', k, f.side, f.cx, f.cy);
      if (u('damp') < W.damp * .5 * dens) put(f, 'dampwall', 0, 20 + u('du') * 56, 0, .8 + u('ds') * .5, .85);
      if (u('peel') < W.peel * .16 * dens) put(f, 'peel', 0, 14 + u('pu') * 68, 9, .9, .9);
      if (u('mildew') < (W.mildew || 0) * .35 * dens) put(f, 'mildewwall', 0, 18 + u('mu') * 60, 0, .9 + u('ms') * .4, .9);
      if (u('outlet') < .1) put(f, 'outlet', 0, 20 + u('ou') * 56, 15, .9, 1);
      if (prof.accent === 'electrical' && u('jbox') < .07) put(f, 'jbox', 0, 18 + u('ju') * 60, 19, .9, 1);
      if (prof.accent === 'failed-power' && u('scorch') < .06) { const uu = 24 + u('su') * 48; put(f, 'scorch', 0, uu, 6, 1, .9); put(f, 'outlet', 0, uu, 15, .9, 1); }
    }
  }

  /* ======================================================================================================================
   * SURFACES: the decal receiver.
   * Each remastered room exposes the surfaces that can receive marks: its floor and each run of papered wall face (above).
   * A decal is drawn in its surface's own coordinates and clipped to the surface (each clip polygon filled with the decal's
   * texture through one matrix), into the room's source art; the bake then carries it.  So a mark stays attached when the
   * camera moves, sits in the same stack as its host material (BR-RoLE lights it exactly as the wall or carpet beneath: no
   * second lighting), costs nothing per frame, and never blocks, hides or tells the game anything.  Static marks are the
   * seeded dressing; dynamic marks are stamped later through window.__l0v.surfaces (bounded per surface, per room and in
   * all; oldest dropped first; an optional lifetime) and only the chunks they touch re-bake.  Future blood belongs to the
   * gore / death stage, which would only call stamp(): nothing here spawns any.
   * ==================================================================================================================== */
  function decalMatrix(sf, d, u, v, rot, scl) {          // canvas px -> world, for a decal at (u, v) on surface sf; and its quad (with margin) in world
    const k = 1 / (d.s || 1), cr = Math.cos(rot), sr = Math.sin(rot), pad = d.pad == null ? DPAD : d.pad;
    let P, A, B, ax, by;
    if (sf.kind === 'floor') { P = [u, v]; A = [cr * scl, sr * scl]; B = [-sr * scl, cr * scl]; ax = d.w / 2; by = d.h / 2; }          // centred, rotated in the floor plane
    else { P = [sf.o[0] + sf.U[0] * u + sf.N[0] * v, sf.o[1] + sf.U[1] * u + sf.N[1] * v];                                               // upright on the face, base at (u, v)
      const D = [-sf.N[0], -sf.N[1]]; A = [(sf.U[0] * cr + D[0] * sr) * scl, (sf.U[1] * cr + D[1] * sr) * scl]; B = [(D[0] * cr - sf.U[0] * sr) * scl, (D[1] * cr - sf.U[1] * sr) * scl]; ax = d.w / 2; by = d.h; }
    const ox = -pad - ax, oy = -pad - by, W2 = d.w + pad * 2, H2 = d.h + pad * 2, at = (a, b) => [P[0] + A[0] * a + B[0] * b, P[1] + A[1] * a + B[1] * b];
    const quad = [at(ox, oy), at(ox + W2, oy), at(ox + W2, oy + H2), at(ox, oy + H2)];
    return { m: M(A[0] * k, A[1] * k, B[0] * k, B[1] * k, P[0] + A[0] * ox + B[0] * oy, P[1] + A[1] * ox + B[1] * oy), quad,
      box: { x0: Math.min(...quad.map(c => c[0])), y0: Math.min(...quad.map(c => c[1])), x1: Math.max(...quad.map(c => c[0])), y1: Math.max(...quad.map(c => c[1])) } };
  }
  /* Pixi tiles a matrix-mapped texture fill (it switches clamp-to-edge to repeat), so a decal is never filled over a whole
   * surface polygon: only over (surface polygon) AND (the decal's own quad), both convex (Sutherland-Hodgman).  Inside that
   * the texture coordinates stay within the decal, whose transparent margin also covers the sampler's edge. */
  function clipConvex(subj, clip) {                      // flat [x, y, ...] subject, [[x, y] x4] convex clipper; returns flat or null
    let pts = []; for (let i = 0; i < subj.length; i += 2) pts.push([subj[i], subj[i + 1]]);
    let area = 0; for (let i = 0; i < clip.length; i++) { const a = clip[i], b = clip[(i + 1) % clip.length]; area += a[0] * b[1] - b[0] * a[1]; } const sg = area >= 0 ? 1 : -1;
    for (let i = 0; i < clip.length && pts.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], inside = p => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-9, out = [];
      for (let j = 0; j < pts.length; j++) { const p = pts[j], q = pts[(j + 1) % pts.length], ip = inside(p), iq = inside(q);
        if (ip) out.push(p);
        if (ip !== iq) { const dx = q[0] - p[0], dy = q[1] - p[1], ex = b[0] - a[0], ey = b[1] - a[1], den = ex * dy - ey * dx; if (Math.abs(den) > 1e-12) { const t = (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) / den; out.push([p[0] + dx * t, p[1] + dy * t]); } } }
      pts = out;
    }
    if (pts.length < 3) return null; let ar = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; ar += a[0] * b[1] - b[0] * a[1]; } if (Math.abs(ar) < .5) return null;
    return pts.flat();
  }
  function decalOn(g, sf, d, u, v, rot, scl, alpha, tint = 0xffffff) {   // draws one decal, clipped to its surface; its world box, or null if it touches nothing
    const { m, quad, box } = decalMatrix(sf, d, u, v, rot, scl), style = { texture: d.t, textureSpace: 'global', matrix: m, alpha, color: tint }; let n = 0;
    const polys = sf.kind === 'floor' ? sf.rects.filter(r => r.x < box.x1 && r.x + r.w > box.x0 && r.y < box.y1 && r.y + r.h > box.y0).map(r => [r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h]) : sf.polys;
    for (const p of polys) { const c = clipConvex(p, quad); if (c) { g.poly(c).fill(style); n++; } }
    return n > 0 ? box : null;
  }
  const DYN = { perSurface: 12, perRoom: 48, total: 160 };
  function surfOf(id) { for (const R of S.rooms) for (const sf of R.surfaces || []) if (sf.id === id) return { R, sf }; return null; }
  function decalSrc(o) {                                 // a built-in kind (drawable by the canon audit; 'proof' only in DEV), or a caller's own image
    if (o.image) { if (!o.w || !o.h || !o.image.width) return null; let t = S.extTex && S.extTex.get(o.image); if (!t) { t = texOf(o.image, { mip: true }); (S.extTex || (S.extTex = new Map())).set(o.image, t); } return { t, w: o.w, h: o.h, s: o.image.width / o.w, pad: 0 }; }   // a caller's image: w x h world px, give it a transparent border
    const k = o.kind || 'proof'; if (!(VZ.drawable(k) || (k === 'proof' && S.dev))) return null; const set = S.tex && S.tex.dec[k]; return set && set.length ? set[(o.variant || 0) % set.length] : null;
  }
  function redrawDyn(R) { R.dynG.clear(); for (const r of S.dyn.filter(r => r.room === R.id)) { const h = surfOf(r.surf), d = h && decalSrc(r.o); if (h && d) r.box = decalOn(R.dynG, h.sf, d, r.u, r.v, r.rot, r.scale, r.alpha, r.tint) || r.box; } }
  function dirty(R, box) { if (!box) return; for (const c of R.chunks || []) if (c.x1 > box.x0 && c.x0 < box.x1 && c.y1 > box.y0 && c.y0 < box.y1) c.ver = -1; }   // only the chunks it touches re-bake
  function stamp(surfId, o = {}) {
    const h = surfOf(surfId); if (!h || !S.tex) return null; const d = decalSrc(o); if (!d) return null;
    const r = { id: ++S.dynSeq, room: h.R.id, surf: surfId, o: { kind: o.kind, variant: o.variant, image: o.image, w: o.w, h: o.h }, u: +o.u || 0, v: +o.v || 0, rot: +o.rot || 0, scale: o.scale > 0 ? +o.scale : 1,
      alpha: o.alpha == null ? 1 : clamp(+o.alpha, 0, 1), tint: o.tint == null ? 0xffffff : o.tint, t: Date.now(), ttl: o.ttl > 0 ? +o.ttl : 0, box: null };
    S.dyn.push(r);
    const drop = []; const over = (list, cap) => { while (list.length > cap) drop.push(list.shift()); };     // the caps: oldest first
    over(S.dyn.filter(q => q.surf === surfId), DYN.perSurface); over(S.dyn.filter(q => q.room === r.room && !drop.includes(q)), DYN.perRoom); over(S.dyn.filter(q => !drop.includes(q)), DYN.total);
    for (const q of drop) { S.dyn.splice(S.dyn.indexOf(q), 1); const R2 = S.rooms.find(R => R.id === q.room); if (R2) dirty(R2, q.box); }
    for (const R of S.rooms) if (R.id === r.room || drop.some(q => q.room === R.id)) redrawDyn(R);
    dirty(h.R, r.box); return r.box ? r.id : (S.dyn.splice(S.dyn.indexOf(r), 1), null);
  }
  function unstamp(pred) { const gone = S.dyn.filter(pred); if (!gone.length) return 0; S.dyn = S.dyn.filter(q => !gone.includes(q));
    for (const R of S.rooms) if (gone.some(q => q.room === R.id)) { redrawDyn(R); for (const q of gone) if (q.room === R.id) dirty(R, q.box); } return gone.length; }
  function surfaceAt(x, y, reach = 40) {                 // the surface under / in front of a world point: a wall face within reach of it, else the floor
    let best = null;
    for (const R of S.rooms) for (const sf of R.surfaces || []) {
      if (sf.kind !== 'wall') continue; const dx = x - sf.o[0], dy = y - sf.o[1], u = dx * sf.U[0] + dy * sf.U[1], v = dx * sf.N[0] + dy * sf.N[1];
      if (u < 0 || u > sf.len || v < -reach || v > sf.band) continue; const dist = v < 0 ? -v : 0; if (!best || dist < best.dist) best = { id: sf.id, kind: 'wall', u, v: Math.max(0, v), dist };
    }
    if (best) return best;
    for (const R of S.rooms) { const sf = R.floorSurf; if (sf && sf.rects.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) return { id: sf.id, kind: 'floor', u: x, v: y, dist: 0 }; }
    return null;
  }
  function proofStamp() {                                // DEV (Shift+F9): a neutral proof mark on the wall in front of you, else on the floor ahead
    const A = api(), H = A && A.H; if (!H) return null; const a = H.angle || 0;
    for (let d = 16; d <= 220; d += 8) { const hit = surfaceAt(H.x + Math.cos(a) * d, H.y + Math.sin(a) * d, 10); if (hit && hit.kind === 'wall') return stamp(hit.id, { kind: 'proof', u: hit.u, v: 1, scale: .5 }); }   // inside the ~24 px of face the sight shape shows
    const hit = surfaceAt(H.x + Math.cos(a) * 70, H.y + Math.sin(a) * 70, 0); return hit ? stamp(hit.id, { kind: 'proof', u: hit.u, v: hit.v, scale: 1.2 }) : null;
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
  function built(world, level, lampTop, app) {
    try {
      if (!S.on || S.disabled || !VZ || !world || !level || !lampTop) return;
      S.world = world; S.level = level; S.lampTop = lampTop; S.G = level.constructor; S.C = world.constructor;
      const carpet = world.children.find(c => c && c.tileScale && c.texture); S.Tex = carpet && carpet.texture && carpet.texture.constructor; S.carpet = carpet || null;
      if (!S.Tex || typeof S.Tex.from !== 'function') { fail('attach', 'texture class unavailable'); return; }
      /* the game's Pixi application (the 4th hook argument): its renderer bakes the room chunks.  Without it the remaster
       * still works, drawing its layers directly as in QA1 (more overdraw; S.mode tells which). */
      S.app = app || null; S.renderer = app && app.renderer && typeof app.renderer.render === 'function' && typeof app.renderer.generateTexture === 'function' ? app.renderer : null;
      S.mode = S.renderer ? 'bake' : 'direct';
      S.root = new S.C(); S.root.label = 'l0-remaster'; S.root.visible = false;
      world.addChildAt(S.root, world.children.indexOf(level) + 1);                    // right above the level art: under traces, corpses, actors
      S.ceil = new S.C(); S.ceil.label = 'l0-remaster-ceiling';
      world.addChildAt(S.ceil, world.children.indexOf(lampTop) + 1);                  // right above the legacy fixtures
      if (S.legacyLamps) S.ceil.addChild(S.legacyLamps);
      S.ceil.onRender = () => { const L = S.lampTop; if (!L) return; S.ceil.position.copyFrom(L.position); S.ceil.scale.copyFrom(L.scale); S.ceil.alpha = L.alpha; S.ceil.visible = L.visible; };
      if (S.dev) gpuTimer();
      setTimeout(build, 0);
    } catch (e) { fail('attach', e); }
  }
  /* ---------- the bake: static room art -> cached chunk textures ----------
   * In QA1 every remastered room drew five or more room-sized layers each frame (carpet, the multiplied wear map, grounding,
   * stains, walls ...) on top of the level art: about one extra full-screen layer of fill.  Now each room's art is a source
   * container that is never on screen; it is rendered once into chunk textures (CH world px square), and the room draws
   * those: one opaque-ish layer, about what the old carpet sprite cost.  Chunks in view are baked at once, chunks you
   * approach a few per frame ahead of time, and the oldest out-of-view chunks are dropped beyond the tier's cache size.
   * The texel density follows the screen (camera scale x renderer resolution), clamped per tier: never more texels than
   * the screen can show.  Nothing is drawn per frame except the chunk quads. */
  function bakeDensity(q) {
    const b = q.bake || { min: 1, max: 1 }; let sc = 1.18;
    try { const cp = window.__cameraPolicy; if (cp && typeof cp.baseScale === 'function') sc = cp.baseScale(innerWidth, innerHeight) || sc; } catch (e) { }
    const res = (S.renderer && S.renderer.resolution) || Math.min(window.devicePixelRatio || 1, 2);
    return Math.max(16, Math.round(CH * clamp(sc * res, b.min, b.max))) / CH;   // whole texels across a full chunk
  }
  function rtClass() {                                   // Pixi's RenderTexture class, from the renderer's own generateTexture (no import needed)
    if (S.RT) return S.RT; const probe = S.renderer.generateTexture({ target: new S.C(), frame: { copyTo: r => { r.x = 0; r.y = 0; r.width = 1; r.height = 1; return r; } }, resolution: 1 });
    S.RT = probe.constructor; try { probe.destroy(true); } catch (e) { } if (!S.RT || typeof S.RT.create !== 'function') throw Error('no RenderTexture class'); return S.RT;
  }
  function bakeChunk(c) {
    const t0 = perfNow(), w = c.x1 - c.x0, h = c.y1 - c.y0, d = S.dens;
    if (!c.tex || c.d !== d) {
      if (c.tex) dropChunk(c, true);
      c.tex = rtClass().create({ width: w, height: h, resolution: d, antialias: false, scaleMode: 'linear' }); c.d = d; c.px = Math.round(w * d) * Math.round(h * d); S.bake.px += c.px;
      c.g.clear(); c.g.texture(c.tex, 0xffffff, c.x0, c.y0, w, h);
    }
    S.renderer.render({ container: c.R.src, target: c.tex, clear: true, clearColor: [0, 0, 0, 0], transform: M(1, 0, 0, 1, -c.x0, -c.y0) });
    c.ver = S.gen; const ms = perfNow() - t0; S.bake.bakes++; S.bake.ms += ms; S.bake.lastMs = ms; if (ms > S.bake.maxMs) S.bake.maxMs = ms;
  }
  function dropChunk(c, keepVer) {
    if (c.tex) { try { c.g.clear(); } catch (e) { } try { c.tex.destroy(true); } catch (e) { } c.tex = null; S.bake.px -= c.px; c.px = 0; S.bake.evictions++; }
    if (!keepVer) c.ver = -1; c.g.visible = false;
  }
  function invalidate() { S.gen++; }                     // the source art changed (a DEV toggle, BR-RoLE's grounding): chunks re-bake as they are needed
  function toDirect(e) {                                 // fail-safe: no bake, draw the source layers directly (QA1's path)
    S.errors++; S.mode = 'direct'; S.bake.error = String(e && e.message || e).slice(0, 160);
    try { console.warn('[l0-remaster] bake unavailable (' + S.bake.error + '); drawing the layers directly'); } catch (x) { }
    for (const R of S.rooms) { for (const c of R.chunks) dropChunk(c); R.view.addChild(R.src); }
  }
  function destroyRooms() {
    for (const R of S.rooms) { for (const c of R.chunks || []) dropChunk(c); try { R.src.destroy({ children: true }); R.view.destroy({ children: true }); R.ceilG.destroy(); } catch (e) { } }
    S.rooms = []; for (const t of S.texList || []) { try { t.destroy(true); } catch (e) { } } S.texList = []; S.extTex = null;
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
      S.tier = tierNow(); S.q = VZ.quality[S.tier]; const t1 = now(); S.tex = makeTextures(S.tier); S.stats.texMs = +(now() - t1).toFixed(1);
      for (const id of VZ.slice) S.rooms.push(buildRoom(VZ.room(id), S.tex));
      S.dens = bakeDensity(S.q); S.gen++;
      for (const R of S.rooms) redrawDyn(R);                                           // stamped marks survive a rebuild (a tier change)
      if (S.mode === 'direct') for (const R of S.rooms) R.view.addChild(R.src);
      buildLegacyFloor(); S.built = true; S.stats.rooms = S.rooms.length; S.stats.builds++;
      apply();
    } catch (e) { fail('build', e); }
    S.stats.buildMs = +(now() - t0).toFixed(1);
  }
  function apply() {                                    // the DEV toggles, applied to the source layers (the chunks re-bake)
    if (!S.root || S.disabled) return;
    const on = S.want && S.built;
    S.root.visible = on; if (S.legacyLamps) S.legacyLamps.visible = !on;
    if (S.legacyFloor && S.carpet) { S.legacyFloor.visible = on; S.carpet.visible = !on; }
    for (const R of S.rooms) { R.walls.visible = !S.depth; R.depthWalls.visible = S.depth; for (const d of R.decalLayers) d.visible = S.decals; }
    invalidate(); stream(true); showTag();
  }
  function viewRect() { const w = S.world, k = w.scale.x || 1; return { x0: -w.position.x / k, y0: -w.position.y / k, x1: (innerWidth - w.position.x) / k, y1: (innerHeight - w.position.y) / k }; }
  const hits = (c, v, m) => c.x1 > v.x0 - m && c.x0 < v.x1 + m && c.y1 > v.y0 - m && c.y0 < v.y1 + m;
  function stream(force) {                              // per frame: which rooms / chunks are in view, bake what is missing, drop what is old
    if (!S.world || !S.built) return;
    const v = viewRect(), on = S.want && !S.disabled, f = S.frame;
    if (!S.brRoot || !S.brRoot.parent) S.brRoot = S.world.children.find(c => c && c.label === 'br-role') || null;
    const ao = S.brRoot ? S.brRoot.visible && (!S.brRoot.children[0] || S.brRoot.children[0].visible) : false;   // grounding mirrors BR-RoLE's
    if (ao !== S.ao) { S.ao = ao; for (const R of S.rooms) R.ao.visible = ao; invalidate(); }
    let rooms = 0; const must = [], ahead = [];
    for (const R of S.rooms) {
      const rv = on && hits(R, v, 2 * T); if (rv) rooms++;
      if (R.ceilG.visible !== rv || force) R.ceilG.visible = rv;
      if (S.mode !== 'bake') { if (R.src.visible !== rv || force) R.src.visible = rv; continue; }
      for (const c of R.chunks) {
        c.inV = on && hits(c, v, 8); c.near = on && !c.inV && hits(c, v, CH);
        if (c.inV) { c.seen = f; if (c.ver !== S.gen) must.push(c); } else if (c.near) { c.seen = Math.max(c.seen, f - 1); if (c.ver !== S.gen) ahead.push(c); }
      }
    }
    if (S.mode === 'bake') {
      try {
        for (const c of must) bakeChunk(c);                                           // in view: now (no pop-in)
        if (!must.length && ahead.length) { const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2, d = c => Math.hypot((c.x0 + c.x1) / 2 - cx, (c.y0 + c.y1) / 2 - cy);
          ahead.sort((a, b) => d(a) - d(b)); for (let i = 0; i < Math.min(ahead.length, S.q.bake.prefetch || 1); i++) bakeChunk(ahead[i]); }
      } catch (e) { toDirect(e); return stream(true); }
      let vis = 0, res = 0; const old = [];
      for (const R of S.rooms) for (const c of R.chunks) { const show = !!(c.inV && c.tex); if (c.g.visible !== show) c.g.visible = show; if (show) vis++; if (c.tex) { res++; if (!c.inV && !c.near) old.push(c); } }
      const cap = S.q.bake.cache || 16;
      if (res > cap) { old.sort((a, b) => (a.ver === S.gen) - (b.ver === S.gen) || a.seen - b.seen); for (const c of old) { if (res <= cap) break; dropChunk(c); res--; } }   // stale first, then the oldest
      S.bake.visible = vis; S.bake.resident = res;
    }
    S.stats.visibleRooms = rooms;
  }
  function tick() {
    try {
      S.frame++;
      if (S.built && !S.disabled) {
        stream(false);
        const t = Date.now(); if (t - (S.polled || 0) > 400) { S.polled = t;                   // the player's quality tier and the screen density, a few times a second
          if (tierNow() !== S.tier) build(); else if (S.mode === 'bake' && Math.abs(bakeDensity(S.q) / S.dens - 1) > .15) { S.dens = bakeDensity(S.q); invalidate(); }
          if (S.dyn.length) unstamp(q => q.ttl && t - q.t > q.ttl); }                    // stamped marks past their lifetime
      }
    } catch (e) { fail('frame', e); }
    if (S.dev) { try { devTick(); } catch (e) { S.errors++; } }                       // a DEV readout problem never touches the remaster
    requestAnimationFrame(tick);
  }
  if (S.on && VZ) requestAnimationFrame(tick);

  /* ---------- DEV (QA comparison only: ?dev3b=1; none of this runs in normal play) ---------- */
  /* scene GPU time: the main scene pass timed with EXT_disjoint_timer_query_webgl2 where the browser offers it (many desktop
   * Chromes do; otherwise the readout says n/a and only the frame time is shown) */
  function gpuTimer() {
    try {
      const r = S.renderer, gl = r && r.gl; if (!gl || !gl.createQuery) return; const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (!ext) { S.perf.gpu = 'n/a'; return; }
      const orig = r.render, pend = []; S.perf.gpu = 'wait';
      r.render = function (o) {
        const main = S.app && (o === S.app.stage || (o && o.container === S.app.stage));
        if (!main || pend.length > 6) return orig.apply(this, arguments);
        const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        try { return orig.apply(this, arguments); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); pend.push(q); }
      };
      S.perf.poll = () => { while (pend.length && gl.getQueryParameter(pend[0], gl.QUERY_RESULT_AVAILABLE)) { const q = pend.shift(), ns = gl.getQueryParameter(q, gl.QUERY_RESULT), dj = gl.getParameter(ext.GPU_DISJOINT_EXT); gl.deleteQuery(q);
        if (!dj) { const ms = ns / 1e6; S.perf.gpuEma = S.perf.gpu === 'wait' ? ms : S.perf.gpuEma * .92 + ms * .08; S.perf.gpu = 'ok'; } } };
    } catch (e) { S.perf.gpu = 'n/a'; }
  }
  function devTick() {
    const t = perfNow(), dt = S.perf.last ? t - S.perf.last : 0; S.perf.last = t;
    if (dt > 0 && dt < 1000) S.perf.ema = S.perf.ema ? S.perf.ema * .94 + dt * .06 : dt;
    if (S.perf.poll) S.perf.poll();
    if (t - S.perf.shown > 250) { S.perf.shown = t; showTag(); }
  }
  function showTag() {
    if (!S.dev) return; if (!S.tag) { S.tag = document.createElement('div'); S.tag.id = 'l0vTag'; S.tag.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;font:11px/1.35 monospace;color:#e8dfa8;background:#000b;padding:4px 7px;pointer-events:none;letter-spacing:.04em;white-space:pre'; document.body.appendChild(S.tag); }
    const P = S.perf, B = S.bake, gpu = P.gpu === 'ok' ? P.gpuEma.toFixed(2) + ' ms' : P.gpu === 'wait' ? '...' : 'n/a';
    S.tag.textContent = `REMASTER ${S.want && !S.disabled ? 'ON' : 'OFF'} [F8] · DECALS ${S.decals ? 'ON' : 'OFF'} [Shift+F8] · PROOF MARK [Shift+F9] (${S.dyn.length}) · WALL DEPTH ${S.depth ? 'ON' : 'OFF'} [F9, deferred] · ${S.tier.toUpperCase()}` + (S.disabled ? ' · ' + S.disabled : '') +
      `\nframe ${P.ema ? P.ema.toFixed(1) : '-'} ms (${P.ema ? Math.round(1000 / P.ema) : '-'} fps) · scene GPU ${gpu} · rooms ${S.stats.visibleRooms} · ` +
      (S.mode === 'bake' ? `chunks ${B.visible} shown / ${B.resident} cached · ${(B.px / 1e6).toFixed(1)} MPx @ ${S.dens.toFixed(2)} tx/px · bake ${B.lastMs.toFixed(1)} ms (max ${B.maxMs.toFixed(1)})` : `DIRECT (no bake${B.error ? ': ' + B.error : ''})`);
  }
  if (S.dev) window.addEventListener('keydown', e => {
    if (e.code === 'F8' && e.shiftKey) { S.decals = !S.decals; apply(); e.preventDefault(); }
    else if (e.code === 'F8') { S.want = !S.want; apply(); e.preventDefault(); }
    else if (e.code === 'F9' && e.shiftKey) { proofStamp(); e.preventDefault(); }
    else if (e.code === 'F9') { S.depth = !S.depth; apply(); e.preventDefault(); }
  }, true);

  const bakeStats = () => { let n = 0; for (const R of S.rooms) n += (R.chunks || []).length;
    return { mode: S.mode, chunk: CH, density: +S.dens.toFixed(4), chunks: n, resident: S.bake.resident, visible: S.bake.visible, MPx: +(S.bake.px / 1e6).toFixed(2), cache: S.q && S.q.bake ? S.q.bake.cache : 0,
      bakes: S.bake.bakes, bakeMs: +S.bake.ms.toFixed(1), bakeMaxMs: +S.bake.maxMs.toFixed(1), evictions: S.bake.evictions, error: S.bake.error }; };
  window.__l0v = {
    version: VERSION, lamp, built,
    on: () => S.on && S.want && S.built && !S.disabled,
    ready: () => S.built || !!S.disabled || !S.on,
    stats: () => ({ version: VERSION, revision: VZ && VZ.revision, on: S.on && S.want && S.built && !S.disabled, attached: !!S.root, built: S.built, disabled: S.disabled, tier: S.tier, depth: S.depth, decalsOn: S.decals,
      slice: VZ ? VZ.slice.slice() : [], ownLamps: S.ownLamps.map(l => l.id), errors: S.errors, ...S.stats, texMPx: +S.stats.texMPx.toFixed(2), bake: bakeStats(),
      perf: { frameMs: +S.perf.ema.toFixed(2), gpu: S.perf.gpu, gpuMs: +S.perf.gpuEma.toFixed(3) },
      rooms: S.rooms.map(R => ({ id: R.id, floorRects: R.n.floor, faces: R.n.faces, decals: R.n.decals, props: R.props || [], visible: S.mode === 'bake' ? R.chunks.some(c => c.g.visible) : R.src.visible, chunks: R.chunks.length })) }),
    /* the decal receiver (presentation only): surfaces of the remastered rooms, and bounded dynamic marks on them */
    surfaces: {
      list: room => { const out = []; for (const R of S.rooms) if (!room || R.id === room) for (const sf of R.surfaces || []) out.push(sf.kind === 'floor' ? { id: sf.id, room: sf.room, kind: 'floor', material: sf.material, rects: sf.rects.length }
        : { id: sf.id, room: sf.room, kind: 'wall', side: sf.side, material: sf.material, origin: sf.o.slice(), u: sf.U.slice(), up: sf.N.slice(), length: sf.len, band: sf.band, polys: sf.polys.length }); return out; },
      at: (x, y, reach) => surfaceAt(+x, +y, reach == null ? 40 : +reach),
      stamp: (id, o) => stamp(id, o || {}),
      remove: id => unstamp(q => q.id === id),
      clear: surf => unstamp(q => !surf || q.surf === surf),
      count: () => S.dyn.length,
      caps: () => Object.assign({}, DYN),
    },
    dev: {
      proof: () => proofStamp(),
      remaster: v => { S.want = v === undefined ? !S.want : !!v; apply(); return S.want; },
      depth: v => { S.depth = v === undefined ? !S.depth : !!v; apply(); return S.depth; },
      decals: v => { S.decals = v === undefined ? !S.decals : !!v; apply(); return S.decals; },
      rebuild: () => { build(); return S.stats.buildMs; },
      layer: (label, v) => { let n = 0; for (const R of S.rooms) for (const c of [...R.src.children, R.ceilG]) if (c.label === label || (label === 'fixtures' && c === R.ceilG)) { c.visible = !!v; n++; } invalidate(); stream(true); return n; },
      source: id => { const R = S.rooms.find(r => r.id === id); return R ? R.src : null; },          // a room's (never displayed) source art
      chunks: id => { const R = S.rooms.find(r => r.id === id); return R ? R.chunks.map(c => ({ key: c.key, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, baked: !!c.tex, shown: c.g.visible, current: c.ver === S.gen })) : null; },
      direct: () => { if (S.mode === 'bake') toDirect('DEV: forced direct drawing'); stream(true); return S.mode; },
      macro: id => { const R = S.rooms.find(r => r.id === id); return R && R.macroCanvas ? R.macroCanvas.toDataURL() : null; },
      layers: () => S.root ? { root: S.world.children.indexOf(S.root), level: S.world.children.indexOf(S.level), ceil: S.world.children.indexOf(S.ceil), lampTop: S.world.children.indexOf(S.lampTop), legacyLamps: !!S.legacyLamps } : null,
      art: { carpetCanvas, wallpaperCanvas, capCanvas, decalCanvases, counterCanvas, tableCanvas, holeCanvas, fixtureCanvas },
    },
  };
})();
