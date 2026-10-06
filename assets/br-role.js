/* br-role.js - BR-RoLE, the Backrooms Rendering of Lighting Engine (presentation only, client only).  BR1.1.
 *
 * THE 2D GAME IS THE GAME.  BR-RoLE is the one visual owner of the light in the world: ambient darkness, the ceiling
 * lamps, your carried light and the other wanderers' lights, and the shadows walls and pillars cast in them.
 *
 * One model, every light on its own:   visible light = ambient + Σ fieldᵢ · (1 − shadowᵢ)
 *   LIGHT FIELD -> BLOCKER -> CAST SHADOW.  Never "light = visibility polygon".
 *   - an offscreen LIGHT BUFFER (a fraction of the CSS viewport per tier; never scaled by devicePixelRatio);
 *   - each light first lays down its natural, unobstructed illumination field: a lamp's radial falloff; a beam's radial
 *     falloff times its smooth angular profile; the hand glow.  Nothing clips it;
 *   - then every wall / pillar side that faces the light casts a shadow into THAT field: the polygon from the side's two
 *     corners projected away from the light.  The shadow is the absence of that one light behind the blocker, nothing else;
 *   - a fluorescent fixture is a tube, not a point: its shadows are cast from many points over the fixture and averaged,
 *     so they have an umbra (no point of the tube sees it) and a penumbra that widens away from the blocker.  Static, so
 *     each lamp's shadowed field is built once (per tier) and reused every frame at the lamp's current strength;
 *   - a carried light is a small source: one to three points across the hand (per tier) inside its beam;
 *   - the lights are ADDED (`lighter`).  One light's shadow removes only that light, so any other light that reaches the
 *     spot lights it.  Nothing is erased, nothing compensates for another layer: mixed light is just the sum;
 *   - the darkness overlay (#light, the game's own canvas) then loses exactly the accumulated light (destination-out),
 *     inside the game's own line-of-sight clip, and carried lights lay their colour tint on top as before.
 * The game's drawLight() keeps everything else it draws: the line-of-sight blackout, the camcorder's infrared, the
 * vignette, the death presentation and the Smilers' faces.  It hands the light cut-outs to BR-RoLE through one guarded hook
 * (window.__brRole.on() / draw()).  If anything here throws, BR-RoLE switches itself off and drawLight draws v23.3.6.
 *
 * Light truth is not touched: the server AI (ai.js), light.js (__light, the Smiler's readability) and the bundle's Ul()
 * never read the overlay.  This module only reads game state; it never writes it, never sends anything.
 *
 * Also carried over from the SH7 donor (ADAPT): the static wall grounding band and one soft dominant-light blob per
 * entity (never for a Smiler).  Prop and actor shadows inside the compositor come in BR2.
 *
 * Quality: LOW / MEDIUM / HIGH (SETTINGS > CUSTOMIZE > LIGHTING, or ?lighting=low|medium|high; remembered per device).
 * DEV only: ?lighting=legacy draws the v23.3.6 lighting for comparison (not offered in the settings).
 * window.__brRole = { version, on(), draw(ctx, frame), quality(), setQuality(q), stats(), resetStats(), probe(x, y), dev } */
(() => {
  'use strict';
  if (window.__brRole) return;
  const VERSION = 'br-role BR2B';
  const T = 96, CHUNK = 16, VB = 384;                                       // level cell; grounding chunk (cells); edge bucket (px)
  const QUALITIES = ['low', 'medium', 'high'];
  /* per tier: light-buffer scale of the CSS viewport; lamps / other wanderers drawn (nearest that reach the screen); a lamp's
   * shadowed field: cache resolution (px per world px), tube points its shadows are cast from, caches kept, builds per frame;
   * points across a carried light's source; prop casters per light (nearest first) and per frame (all carried lights) */
  const TIERS = {
    low: { scale: .5, lamps: 8, peers: 1, lampRes: .3, tube: 8, lampCache: 24, builds: 2, src: 1, props: 4, propFrame: 16, ents: 6, secondary: false },
    medium: { scale: .75, lamps: 10, peers: 3, lampRes: .45, tube: 16, lampCache: 32, builds: 3, src: 2, props: 8, propFrame: 48, ents: 12, secondary: false },
    high: { scale: 1, lamps: 14, peers: 6, lampRes: .6, tube: 24, lampCache: 40, builds: 4, src: 3, props: 12, propFrame: 96, ents: 20, secondary: true },
  };
  /* a lamp: its field (the game's radial falloff, reach R), the fixture it shines from (the 86 x 24 panel the game draws:
   * tube points over ±tubeX, two rows at ±tubeY), the strength its cache is built at (P0: the game's cap), a light blur of
   * its shadow mask (world px; only where the browser has canvas filters), the fade of a lamp built late (frames: steady
   * under a frozen clock); the height it hangs at for prop shadows (h, SH7's tuned 180 px) and the longest prop shadow it
   * casts (kmax x the prop's distance from it) */
  const LAMP = { R: 380, inner: 6, tubeX: 40, tubeY: 8, P0: .9, blur: 3, fadeFrames: 12, buildMs: 6, prefetch: 360, h: 180, kmax: 1 };
  const SRC = { beam: 3, omni: 4 };                                          // a carried light's half-size (world px)
  /* carried lights: the height each is held at (for prop shadows; SH7's) and the longest prop shadow (kmax x distance) */
  const CARRY = { h: { flashlight: 105, headlamp: 160, lantern: 85 }, kmax: 2.2 };
  /* selected prop casters (world.js PROPS, adapted from the SH7 donor's table): presentation height above the floor (px).
   * The game's ray query passes over props (only walls and pillars stop light), so their shadows are new.  A prop is a box:
   * from a source point at height h its floor shadow is the hull of its base and its projected top (top corner + (corner -
   * source) x hp / (h - hp)); its own top stays lit.  Not casters: the see-through railing and the wall holes (openings).
   * The art's baked drop shadow (a few px, drawProp) needs no thinning here: BR-RoLE removes light instead of painting
   * dark, so under a cast shadow it reads as the prop's contact shadow, not a second shadow */
  const PROP = { counter: { h: 70 }, shelf: { h: 46 }, lowwall: { h: 84 }, machine: { h: 96 }, table: { h: 76 }, bench: { h: 46 }, window: { h: 40 } };
  const AMB = { r0: 18, r1: 670, a0: .14, a1: .045 };                       // the ambient glow around the viewer (v23.3.6's)
  const TINT = { beam: .25, omni: .2 };                                      // carried-light colour tint over the lit area
  const AO = { width: 50, alpha: .56, steps: 64, power: 1.35 };              // SH7 grounding (ADAPT)
  const LS_KEY = 'tfb.lighting.quality';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const now = () => performance.now();
  const S = { quality: 'medium', legacy: false, disabled: '', attached: false, attachTries: 0, buf: null, bx: null, scr: null, sx: null, tb: null, tx: null, msk: null, mx: null,
    lampCache: new Map(), lampKey: '', lmask: null, pending: new Set(), edges: null, egrid: new Map(), stamp: null, q: 0, blur: false, props: [],
    layers: {}, chunks: [], person: null, last: null, dbgEl: null, act: new WeakMap(), actorsOn: true, actorsLast: [], castCv: null, propLeft: 0 };
  const ST = { frames: 0, ms: new Float32Array(240), n: 0, max: 0, lamps: 0, lampsMax: 0, carried: 0, peers: 0, shadows: 0, shadowsMax: 0, props: 0, propsMax: 0, lampBuilds: 0, lampBuildMs: 0, lampEvictions: 0, ents: 0, buf: [0, 0], legacyFrames: 0, errors: 0 };

  /* ---------- quality: URL > remembered > device default (touch / small screen -> LOW); ?lighting=legacy is DEV only ---------- */
  function initialQuality() {
    let u = null; try { u = new URLSearchParams(location.search).get('lighting'); } catch (e) { }
    if (u === 'legacy') { S.legacy = true; return 'medium'; }
    if (QUALITIES.includes(u)) return u;
    try { const v = localStorage.getItem(LS_KEY); if (QUALITIES.includes(v)) return v; } catch (e) { }
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), small = Math.min(screen.width || 9999, screen.height || 9999) < 700;
    return coarse || small ? 'low' : 'medium';
  }
  S.quality = initialQuality();
  function disable(why, e) { if (S.disabled) return; S.disabled = why; ST.errors++; try { console.warn('[br-role] disabled - the game draws its own (v23.3.6) lighting:', why, e && (e.stack || e)); } catch (x) { } }

  /* ---------- the blockers: every wall side (the wall / floor boundary, merged into straight runs; the level's border
   * counts as wall, as in the game) and the four sides of every pillar, each with its outward normal (into the open) ---------- */
  function buildEdges() {
    const A = window.__api, W = S.FBW, H = S.FBH, wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : !!A.Hc(x, y), E = [];
    for (let y = 0; y <= H; y++) for (let x = 0; x < W;) {                  // horizontal sides, between cell rows y - 1 and y
      const up = wall(x, y - 1), dn = wall(x, y); if (up === dn) { x++; continue; }
      let e = x; while (e + 1 < W && wall(e + 1, y - 1) === up && wall(e + 1, y) === dn) e++;
      E.push(x * T, y * T, (e + 1) * T, y * T, 0, up ? 1 : -1); x = e + 1;
    }
    for (let x = 0; x <= W; x++) for (let y = 0; y < H;) {                  // vertical sides, between cell columns x - 1 and x
      const lf = wall(x - 1, y), rt = wall(x, y); if (lf === rt) { y++; continue; }
      let e = y; while (e + 1 < H && wall(x - 1, e + 1) === lf && wall(x, e + 1) === rt) e++;
      E.push(x * T, y * T, x * T, (e + 1) * T, lf ? 1 : -1, 0); y = e + 1;
    }
    const seen = new Set(); let pillars = 0;
    if (typeof A.Bc === 'function') for (let y = 96; y < H * T; y += 192) for (let x = 96; x < W * T; x += 192) {
      let l = null; try { l = A.Bc(x, y); } catch (e) { l = null; }
      if (l) for (const r of l) if (r && r.w === 56 && r.h === 56) { const k = r.x + ',' + r.y; if (seen.has(k)) continue; seen.add(k); pillars++;
        const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h; E.push(x0, y0, x1, y0, 0, -1, x0, y1, x1, y1, 0, 1, x0, y0, x0, y1, -1, 0, x1, y0, x1, y1, 1, 0); }
    }
    S.edges = Float64Array.from(E); S.nEdges = E.length / 6; S.pillars = pillars; S.stamp = new Int32Array(S.nEdges); S.egrid.clear();
    for (let j = 0; j < S.nEdges; j++) {
      const o = j * 6, bx0 = Math.floor(Math.min(E[o], E[o + 2]) / VB), bx1 = Math.floor(Math.max(E[o], E[o + 2]) / VB), by0 = Math.floor(Math.min(E[o + 1], E[o + 3]) / VB), by1 = Math.floor(Math.max(E[o + 1], E[o + 3]) / VB);
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) { const k = by * 4096 + bx; let l = S.egrid.get(k); if (!l) S.egrid.set(k, l = []); l.push(j); }
    }
  }
  /* the selected prop casters (world.js PROPS), static */
  function buildProps() {
    const W = window.WORLD; S.props = [];
    if (W && Array.isArray(W.PROPS)) for (const p of W.PROPS) {
      const d = PROP[p.kind]; if (!d || !p.rect || p.type === 'gap') continue; const r = p.rect;
      if (![r.x, r.y, r.w, r.h].every(Number.isFinite) || !(r.w > 0 && r.h > 0)) continue;
      S.props.push({ n: S.props.length, id: p.id, kind: p.kind, x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2, hd: Math.hypot(r.w, r.h) / 2, hp: d.h });
    }
  }
  /* the props a light at (x, y) can shadow within `reach` (inside the beam when `cone`), nearest first, at most `cap`
   * (stable order: distance, then index - no caster-sort flicker) */
  const tmpPC = [];
  function propsFor(x, y, reach, cone, cap) {
    tmpPC.length = 0; if (!(cap > 0)) return [];
    for (const p of S.props) {
      const d = Math.hypot(clamp(x, p.x, p.x + p.w) - x, clamp(y, p.y, p.y + p.h) - y); if (d >= reach) continue;
      if (cone && d > 0) { const dc = Math.hypot(p.cx - x, p.cy - y), hs = dc > p.hd ? Math.asin(p.hd / dc) : Math.PI, a = Math.atan2(p.cy - y, p.cx - x) - cone[0];
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) - hs > cone[1]) continue; }
      tmpPC.push([d, p.n, p]);
    }
    tmpPC.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const out = []; for (let k = 0; k < tmpPC.length && k < cap; k++) out.push(tmpPC[k][2]); return out;
  }
  function hull(pts) {                                                      // monotone chain (SH7 donor), flat [x, y, ...] -> counter-clockwise
    const P = []; for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); const out = []; for (const p of lo.concat(up)) out.push(p[0], p[1]); return out;
  }
  /* a prop's floor shadow from a source point (sx, sy) at height sh: the hull of its base and its projected top, or null
   * (a source inside the box below its top lights nothing outside it: no shadow to draw) */
  const tmpH = [];
  function propHull(p, sx, sy, sh, kmax) {
    if (sx >= p.x && sx <= p.x + p.w && sy >= p.y && sy <= p.y + p.h && sh <= p.hp + 1) return null;
    const kk = sh > p.hp + 1 ? Math.min(kmax, p.hp / (sh - p.hp)) : kmax; tmpH.length = 0;
    for (let k = 0; k < 4; k++) { const cx = k === 1 || k === 2 ? p.x + p.w : p.x, cy = k >= 2 ? p.y + p.h : p.y; tmpH.push(cx, cy, cx + (cx - sx) * kk, cy + (cy - sy) * kk); }
    return hull(tmpH);
  }
  /* is (x, y) in a prop's shadow from a source point?  (inside its floor shadow, not on its own top) */
  function inPropShadow(p, sx, sy, sh, kmax, x, y) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return false;
    const h = propHull(p, sx, sy, sh, kmax); if (!h || h.length < 6) return false;
    for (let i = 0; i < h.length; i += 2) { const ax = h[i], ay = h[i + 1], bx = h[(i + 2) % h.length], by = h[(i + 3) % h.length]; if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false; }
    return true;
  }
  /* the shadow one point source at (lx, ly) casts within `reach`: for every blocker side that faces it, the polygon from the
   * side's two corners projected away from the source (through a middle point, so the far side always lies beyond the
   * reach); then each selected prop's floor shadow from that point (at height sh), with the prop's own top cut back out.
   * All of them go into ONE path (one winding for every shadow, the opposite for a prop's top; filled once, nonzero: their
   * union, no seams).  `cone` = [aim, half width] keeps only the sides inside a beam.  Returns how many sides / props cast. */
  function shadowPath(c, lx, ly, reach, cone, props, sh, kmax) {
    const E = S.edges, st = S.stamp, q = ++S.q, x0 = lx - reach, x1 = lx + reach, y0 = ly - reach, y1 = ly + reach, D = reach * 1.5 + 4;
    let n = 0; c.beginPath();
    if (props) for (const p of props) {
      const h = propHull(p, lx, ly, sh, kmax); if (!h || h.length < 6) continue;
      c.moveTo(h[h.length - 2], h[h.length - 1]); for (let k = h.length - 4; k >= 0; k -= 2) c.lineTo(h[k], h[k + 1]); c.closePath();   // reversed: winds like the wall shadows
      c.moveTo(p.x, p.y); c.lineTo(p.x + p.w, p.y); c.lineTo(p.x + p.w, p.y + p.h); c.lineTo(p.x, p.y + p.h); c.closePath();   // its own top: the opposite winding (lit)
      n++;
    }
    for (let by = Math.floor(y0 / VB); by <= Math.floor(y1 / VB); by++) for (let bx = Math.floor(x0 / VB); bx <= Math.floor(x1 / VB); bx++) {
      const l = S.egrid.get(by * 4096 + bx); if (!l) continue;
      for (const j of l) {
        if (st[j] === q) continue; st[j] = q; const o = j * 6;
        let ax = E[o], ay = E[o + 1], bx_ = E[o + 2], by_ = E[o + 3];
        if ((lx - ax) * E[o + 4] + (ly - ay) * E[o + 5] <= .01) continue;  // faces away (or edge-on): its far side casts nothing new
        if (ax === bx_) { if (ax < x0 || ax > x1) continue; const s0 = Math.max(Math.min(ay, by_), y0), s1 = Math.min(Math.max(ay, by_), y1); if (s0 >= s1) continue; ay = s0; by_ = s1; }
        else { if (ay < y0 || ay > y1) continue; const s0 = Math.max(Math.min(ax, bx_), x0), s1 = Math.min(Math.max(ax, bx_), x1); if (s0 >= s1) continue; ax = s0; bx_ = s1; }   // only the part in reach
        let ux = ax - lx, uy = ay - ly, vx = bx_ - lx, vy = by_ - ly;
        if (ux * vy - uy * vx < 0) { let t = ux; ux = vx; vx = t; t = uy; uy = vy; vy = t; }   // one winding for all
        const da = Math.hypot(ux, uy), db = Math.hypot(vx, vy); if (!(da > 1e-6 && db > 1e-6)) continue;
        if (cone) {                                                         // inside the beam?  (the side's angular span meets the cone)
          const d1 = Math.atan2(Math.sin(Math.atan2(uy, ux) - cone[0]), Math.cos(Math.atan2(uy, ux) - cone[0])), span = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
          if (!((d1 <= cone[1] && d1 + span >= -cone[1]) || d1 + span - Math.PI * 2 >= -cone[1])) continue;
        }
        const mx = ux / da + vx / db, my = uy / da + vy / db, ml = Math.hypot(mx, my) || 1;
        c.moveTo(lx + ux, ly + uy); c.lineTo(lx + vx, ly + vy); c.lineTo(lx + vx / db * D, ly + vy / db * D); c.lineTo(lx + mx / ml * D, ly + my / ml * D); c.lineTo(lx + ux / da * D, ly + uy / da * D); c.closePath();
        n++;
      }
    }
    return n;
  }
  /* a source point offset from a light's centre, pulled back if a wall or pillar stands between them (the game's ray query) */
  function reachable(cx, cy, x, y) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d < 1e-6) return [cx, cy];
    const u = window.__api.Uc(cx, cy, Math.atan2(dy, dx), d); if (u >= d) return [x, y];
    const s = Math.max(0, u - 1) / d; return [cx + dx * s, cy + dy * s];
  }
  /* the points a fluorescent fixture shines from: n over the tube, in two staggered rows when n >= 8 (flat [x, y, ...]) */
  function tubePoints(L, n) {
    const rows = n >= 8 ? 2 : 1, per = Math.ceil(n / rows), out = [];
    for (let k = 0; k < n; k++) { const row = k % rows, j = Math.floor(k / rows), u = rows === 2 ? (j + (row ? .75 : .25)) / per : (j + .5) / per;
      const p = reachable(L.x, L.y, L.x + LAMP.tubeX * (2 * u - 1), L.y + (rows === 2 ? (row ? 1 : -1) * LAMP.tubeY : 0)); out.push(p[0], p[1]); }
    return out;
  }
  /* the points a carried light shines from: n across the hand (perpendicular to the aim; around the flame for a lantern) */
  function sourcePoints(x, y, ang, omni, n) {
    if (n <= 1) return [x, y];
    const out = [], s = omni ? SRC.omni : SRC.beam;
    for (let k = 0; k < n; k++) { let px, py;
      if (omni) { const a = ang + Math.PI * 2 * k / n; px = x + Math.cos(a) * s; py = y + Math.sin(a) * s; }
      else { const u = (2 * k / (n - 1) - 1) * s; px = x - Math.sin(ang) * u; py = y + Math.cos(ang) * u; }
      const p = reachable(x, y, px, py); out.push(p[0], p[1]); }
    return out;
  }
  /* the canvases' filter support (a light blur of a lamp's shadow mask; skipped where the browser has none) */
  function blurSupported() { try { const c = mkCanvas(2, 2).getContext('2d'); if (!c || !('filter' in c)) return false; c.filter = 'blur(1px)'; return c.filter === 'blur(1px)'; } catch (e) { return false; } }
  /* a lamp's shadowed field, built once per tier: its unobstructed field at strength P0, then the shadows its whole tube
   * casts (each tube point's shadow, averaged: umbra where no point sees, penumbra where some do) taken out of it */
  function buildLamp(i, L, cfg) {
    const t0 = now(), R = LAMP.R, size = Math.max(8, Math.round(2 * R * cfg.lampRes)), res = size / (2 * R), cv = mkCanvas(size, size), c = cv.getContext('2d');
    c.setTransform(res, 0, 0, res, (R - L.x) * res, (R - L.y) * res);
    const g = c.createRadialGradient(L.x, L.y, LAMP.inner, L.x, L.y, R); g.addColorStop(0, rgba(LAMP.P0)); g.addColorStop(.5, rgba(LAMP.P0 * .35)); g.addColorStop(1, rgba(0));
    c.fillStyle = g; c.fillRect(L.x - R, L.y - R, R * 2, R * 2);
    if (!S.lmask || S.lmask.width !== size) S.lmask = mkCanvas(size, size);
    const m = S.lmask.getContext('2d'), smp = tubePoints(L, cfg.tube), n = smp.length / 2, reach = R + LAMP.tubeX + 4, props = propsFor(L.x, L.y, reach, null, cfg.props);
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.clearRect(0, 0, size, size);
    m.setTransform(res, 0, 0, res, (R - L.x) * res, (R - L.y) * res); m.globalCompositeOperation = 'lighter'; m.fillStyle = rgba((Math.ceil(255 / n) + .4) / 255);   // n of them saturate: umbra = all of this light gone
    let edges = 0; for (let s = 0; s < smp.length; s += 2) { const e = shadowPath(m, smp[s], smp[s + 1], reach, null, props, LAMP.h, LAMP.kmax); if (e) m.fill(); edges += e; }
    m.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out';
    if (S.blur) c.filter = `blur(${(LAMP.blur * res).toFixed(2)}px)`;
    c.drawImage(S.lmask, 0, 0); if (S.blur) c.filter = 'none';
    c.globalCompositeOperation = 'source-over';
    ST.lampBuilds++; ST.lampBuildMs += now() - t0;
    return { cv, smp, edges, props, born: -1e9, used: ST.frames };
  }

  /* ---------- the game's own light strengths (drawLight in the bundle), so BR-RoLE lights what v23.3.6 lit ---------- */
  function lampPower(i, L, t) {                                             // a lamp's strength at its centre: dim fixtures (index % 13), failures, NV gain
    const E = window.__ents, C = window.__cam;
    return Math.min(.9, (i % 13 === 0 ? .13 + .06 * Math.max(0, Math.sin(t * 11 + i)) : .43) * (E && E.lamp ? E.lamp(L.x, L.y, t) : 1) * (C && C.lampGain ? C.lampGain() : 1));
  }
  const lampFall = r => r <= 6 ? 1 : r <= 193 ? 1 - .65 * (r - 6) / 187 : r < 380 ? .35 * (1 - (r - 193) / 187) : 0;   // its radial stops 1 / .35 / 0
  const beamGrad = (d, r) => { const s = clamp((d - 6) / (r - 6), 0, 1); return s <= .25 ? 1 - .17 * s / .25 : s <= .7 ? .83 - .55 * (s - .25) / .45 : .28 * (1 - (s - .7) / .3); };
  /* a beam's angular profile: v23.3.6 nests 12 arcs of widths arc·(1 − .063 t); the fraction of them covering an angle φ off
   * the axis, made smooth (no stepped cone) */
  const beamProfile = (ph, arc) => { const lo = arc * (1 - 11 * .063) / 2, hi = arc / 2; if (ph >= hi) return 0; if (ph <= lo) return 1; const u = (hi - ph) / (hi - lo); return u * u * (3 - 2 * u); };
  const rgba = a => `rgba(255,255,255,${clamp(a, 0, 1).toFixed(4)})`;

  /* ---------- canvases ---------- */
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function ensureBuffers(w, h, cfg) {
    const bw = Math.max(1, Math.ceil(w * cfg.scale)), bh = Math.max(1, Math.ceil(h * cfg.scale));
    if (!S.buf || S.buf.width !== bw || S.buf.height !== bh) {
      S.buf = mkCanvas(bw, bh); S.bx = S.buf.getContext('2d');
      S.scr = mkCanvas(bw, bh); S.sx = S.scr.getContext('2d');
      S.tb = mkCanvas(bw, bh); S.tx = S.tb.getContext('2d');
      S.msk = mkCanvas(bw, bh); S.mx = S.msk.getContext('2d');             // a carried light's averaged shadow (several source points)
    }
    ST.buf = [bw, bh];
  }

  /* ---------- one frame: every light into the buffer, the buffer out of the overlay ---------- */
  function draw(n, F) {
    if (!on()) return false;
    const t0 = now();
    try {
      const cfg = TIERS[S.quality], A = window.__api, sc = cfg.scale, k = F.r * sc;
      ensureBuffers(F.w, F.h, cfg);
      const bx = S.bx, tx = S.tx, bw = S.buf.width, bh = S.buf.height;
      ST.shadows = 0;
      for (const c of [bx, tx]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, bw, bh); }
      bx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); bx.globalCompositeOperation = 'lighter';
      const view = { x0: -F.ox / F.r, y0: -F.oy / F.r, x1: (F.w - F.ox) / F.r, y1: (F.h - F.oy) / F.r };
      const meet = (x, y, R) => x + R > view.x0 && x - R < view.x1 && y + R > view.y0 && y - R < view.y1;
      const V = F.viewer, rec = S.last = { lamps: [], carried: [] }; S.lastF = { r: F.r, ox: F.ox, oy: F.oy, w: F.w, h: F.h, t: F.t };

      /* ambient: the faint glow the viewer carries everywhere (v23.3.6's), never blocked */
      { const g = bx.createRadialGradient(V.x, V.y, AMB.r0, V.x, V.y, AMB.r1); g.addColorStop(0, rgba(AMB.a0)); g.addColorStop(.5, rgba(AMB.a1)); g.addColorStop(1, rgba(0)); bx.fillStyle = g; bx.fillRect(V.x - AMB.r1, V.y - AMB.r1, AMB.r1 * 2, AMB.r1 * 2); }

      /* ceiling lamps: the ones whose light reaches the screen, nearest the viewer first; the one at the cap fades out.  Each
       * is its cached shadowed field, added at the lamp's strength this frame (flicker, failures, NV gain) */
      let nl = 0; const lampRecs = [];
      if (S.lampKey !== S.quality) { for (const C of S.lampCache.values()) C.cv.width = 0; S.lampCache.clear(); S.pending.clear(); S.lampKey = S.quality; }
      if (!(A.V && A.V.blackout)) {
        const lamps = A.lamps || [], list = [], tb0 = now(), pend = new Set(); let built = 0;
        const canBuild = () => built < cfg.builds && (built === 0 || now() - tb0 < LAMP.buildMs);
        for (let i = 0; i < lamps.length; i++) { const L = lamps[i]; if (meet(L.x, L.y, LAMP.R)) list.push([Math.hypot(L.x - V.x, L.y - V.y), i]); }
        list.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const cut = list.length > cfg.lamps ? list[cfg.lamps][0] : Infinity;
        for (let m = 0; m < list.length && m < cfg.lamps; m++) {
          const i = list[m][1], L = lamps[i];
          let C = S.lampCache.get(i);
          if (!C) {
            if (!canBuild()) { pend.add(i); continue; }                     // built over the next frames (then faded in, no hitch)
            C = buildLamp(i, L, cfg); built++; if (S.pending.has(i)) C.born = ST.frames; S.lampCache.set(i, C);
          } else { S.lampCache.delete(i); S.lampCache.set(i, C); }          // most recently used last
          C.used = ST.frames;
          const p = lampPower(i, L, F.t) * (m === cfg.lamps - 1 ? clamp((cut - list[m][0]) / 140, 0, 1) : 1) * clamp((ST.frames - C.born) / LAMP.fadeFrames, 0, 1);   // only the last admitted fades (no pop at the cap)
          if (!(p > .002)) continue;
          lampRecs.push({ i, L, p, C, smp: C.smp, props: C.props, acts: [] });
        }
        if (canBuild()) {                                                   // spare budget: the nearest lamp about to come into view
          let best = -1, bd = Infinity;
          for (let i = 0; i < lamps.length; i++) { const L = lamps[i]; if (S.lampCache.has(i) || !meet(L.x, L.y, LAMP.R + LAMP.prefetch)) continue; const d = Math.hypot(L.x - V.x, L.y - V.y); if (d < bd) { bd = d; best = i; } }
          if (best >= 0) { const C = buildLamp(best, lamps[best], cfg); C.used = ST.frames; S.lampCache.set(best, C); }
        }
        for (const [i, C] of S.lampCache) { if (S.lampCache.size <= cfg.lampCache) break; if (C.used !== ST.frames) { C.cv.width = 0; S.lampCache.delete(i); ST.lampEvictions++; } }
        S.pending = pend;
      }

      /* carried lights: yours (the hand that holds it, or the death torch), then the nearest other wanderers' */
      const Gc = A.Gc || {}, lights = [];
      const own = Gc[F.kind];
      if (F.on && own && !own.nv && own.range > 1 && F.src) lights.push({ x: F.src.x, y: F.src.y, ang: F.src.angle ?? (A.H && A.H.angle) ?? 0, f: own, color: F.color, glowR: F.death ? 150 : 52, glowA: F.death ? .73 : .35, fl: own.omni ? .93 + Math.sin(F.t * 17) * .035 + Math.sin(F.t * 31) * .025 : 1, own: true, kind: F.kind });
      let np = 0;
      if (cfg.peers > 0 && Array.isArray(window.__peerLights)) {
        const ps = window.__peerLights.filter(p => p && p.on && !p.dead && p.kind !== 'camcorder' && Gc[p.kind || 'flashlight'] && !Gc[p.kind || 'flashlight'].nv && Number.isFinite(p.x + p.y))
          .map(p => [Math.hypot(p.x - V.x, p.y - V.y), p]).sort((a, b) => a[0] - b[0]);
        const cut = ps.length > cfg.peers ? ps[cfg.peers][0] : Infinity;
        for (let m = 0; m < ps.length && m < cfg.peers; m++) { const p = ps[m][1], f = Gc[p.kind || 'flashlight'], w = m === cfg.peers - 1 ? clamp((cut - ps[m][0]) / 80, 0, 1) : 1; if (w > .01) { lights.push({ x: p.x, y: p.y, ang: p.angle || 0, f, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#ffe7b2', glowR: 52, glowA: .35, fl: f.omni ? .93 + Math.sin(F.t * 17 + p.x) * .035 + Math.sin(F.t * 31 + p.y) * .025 : 1, w, kind: p.kind || 'flashlight' }); np++; } }
      }
      S.propLeft = cfg.propFrame; ST.props = 0;                            // prop casters for all carried lights this frame (yours first)
      const carRecs = [];
      for (const Lc of lights) if (meet(Lc.x, Lc.y, Lc.f.range)) { const r = prepCarried(Lc, cfg); if (r) carRecs.push(r); }

      /* actors (BR2B): each blocks its dominant light only - known before any light is drawn */
      actorShadows(F, cfg, lampRecs, carRecs);

      /* the lamps: each its cached shadowed field at this frame's strength; one that an actor shadows goes through the scratch */
      for (const r of lampRecs) { drawLamp(r, F, k, sc); nl++; rec.lamps.push({ i: r.i, p: r.p, smp: r.smp, props: r.props }); }
      /* the carried lights */
      for (const r of carRecs) carried(r, F, cfg, k, rec);

      /* into the overlay: it loses exactly the light that reached each pixel (inside drawLight's line-of-sight clip), then
       * the carried lights' colour */
      n.save(); n.setTransform(1, 0, 0, 1, 0, 0); n.globalAlpha = 1; n.imageSmoothingEnabled = true;
      n.globalCompositeOperation = 'destination-out'; n.drawImage(S.buf, 0, 0, bw, bh, 0, 0, F.w, F.h);
      if (rec.carried.some(c => c.tint)) { n.globalCompositeOperation = 'source-over'; n.drawImage(S.tb, 0, 0, bw, bh, 0, 0, F.w, F.h); }
      n.restore();

      cullAO(view);
      ST.lamps = nl; if (nl > ST.lampsMax) ST.lampsMax = nl; ST.carried = rec.carried.length; ST.peers = np; if (ST.shadows > ST.shadowsMax) ST.shadowsMax = ST.shadows; if (ST.props > ST.propsMax) ST.propsMax = ST.props;
      const ms = now() - t0; ST.ms[ST.n % ST.ms.length] = ms; ST.n++; if (ms > ST.max) ST.max = ms; ST.frames++;
      if (ST.frames % 15 === 0) debugPanel();
      return true;
    } catch (e) { disable('frame error', e); return false; }
  }
  /* the shadows a light casts into the field drawn in `c` (the scratch, buffer pixels; bb its box): from one source point
   * straight out of the field; from several, their average (umbra where no point sees, penumbra where some do).  `cast`:
   * the light's prop casters, its height and longest prop shadow */
  function castInto(c, smp, reach, cone, F, k, sc, bb, cast) {
    const props = cast && cast.props.length ? cast.props : null, sh = cast ? cast.sh : 0, kmax = cast ? cast.kmax : 0;
    const n = smp.length / 2; let e = 0;
    if (n === 1) {
      c.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#fff';
      e = shadowPath(c, smp[0], smp[1], reach, cone, props, sh, kmax); if (e) c.fill();
    } else {
      const m = S.mx; m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.clearRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
      m.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); m.globalCompositeOperation = 'lighter'; m.fillStyle = rgba((Math.ceil(255 / n) + .4) / 255);   // n of them saturate: umbra = all of this light gone
      for (let s = 0; s < smp.length; s += 2) { const q = shadowPath(m, smp[s], smp[s + 1], reach, cone, props, sh, kmax); if (q) m.fill(); e += q; }
      m.globalCompositeOperation = 'source-over';
      if (e) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out'; c.drawImage(S.msk, bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1], bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); }
    }
    c.globalCompositeOperation = 'source-over'; ST.shadows += e; return e;
  }
  /* a box (buffer pixels) around a world point and radius, clamped to the buffer; null when off it */
  function boxAt(x, y, R, F, sc) {
    const bxp = (x * F.r + F.ox) * sc, byp = (y * F.r + F.oy) * sc, rp = R * F.r * sc + 2;
    const bb = [Math.max(0, Math.floor(bxp - rp)), Math.max(0, Math.floor(byp - rp)), Math.min(S.scr.width, Math.ceil(bxp + rp)), Math.min(S.scr.height, Math.ceil(byp + rp))];
    return bb[2] > bb[0] && bb[3] > bb[1] ? bb : null;
  }
  /* one lamp: its cached shadowed field at this frame's strength, added.  When an actor's shadow belongs to it, the field
   * goes through the scratch first and loses that shadow there (only this lamp's light: every other light still fills it) */
  function drawLamp(r, F, k, sc) {
    const bx = S.bx, L = r.L, R = LAMP.R, a = Math.min(1, r.p / LAMP.P0);
    if (!r.acts.length) { bx.globalAlpha = a; bx.drawImage(r.C.cv, L.x - R, L.y - R, R * 2, R * 2); bx.globalAlpha = 1; return; }
    const bb = boxAt(L.x, L.y, R, F, sc); if (!bb) return;
    const sx = S.sx, bw = bb[2] - bb[0], bh = bb[3] - bb[1];
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.clearRect(bb[0], bb[1], bw, bh);
    sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); sx.globalAlpha = a; sx.drawImage(r.C.cv, L.x - R, L.y - R, R * 2, R * 2); sx.globalAlpha = 1;
    castActors(sx, r.acts, F, k, sc);
    sx.setTransform(1, 0, 0, 1, 0, 0);
    bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, bb[0], bb[1], bw, bh, bb[0], bb[1], bw, bh); bx.restore();
  }
  /* a carried light, before anything is drawn: its strength, source points, beam cone, height and prop casters (yours
   * first, then the other wanderers', within the frame's prop budget) */
  function prepCarried(Lc, cfg) {
    const A = window.__api, f = Lc.f, w = Lc.w ?? 1;
    if (A.Hc(Math.floor(Lc.x / T), Math.floor(Lc.y / T))) return null;   // a hand inside a wall lights nothing (v23.3.6: its ray query stops at once)
    const R = f.range, cone = f.omni ? null : [Lc.ang, f.arc / 2 + .2], sh = CARRY.h[Lc.kind] || CARRY.h.flashlight;
    const props = propsFor(Lc.x, Lc.y, R + 8, cone, Math.min(cfg.props, S.propLeft)); S.propLeft -= props.length; ST.props += props.length;
    const gprops = propsFor(Lc.x, Lc.y, Lc.glowR + 4, null, Math.min(cfg.props, S.propLeft)); S.propLeft -= gprops.length; ST.props += gprops.length;
    return { Lc, x: Lc.x, y: Lc.y, ang: Lc.ang, f, R, arc: f.arc, omni: !!f.omni, power: f.power * (f.omni ? Lc.fl : 1) * w, w, cone, sh, props, gprops,
      smp: sourcePoints(Lc.x, Lc.y, Lc.ang, !!f.omni, cfg.src), own: !!Lc.own, acts: [] };
  }
  /* one carried light: its natural field (radial falloff x the beam's smooth angular profile), then the shadows walls,
   * pillars and the nearest props cast into it from the hand, then the shadows of the actors it is dominant for; added to
   * the buffer; its colour tint; then its hand glow, the same way */
  function carried(r, F, cfg, k, rec) {
    const sx = S.sx, Lc = r.Lc, f = r.f, R = r.R, sc = cfg.scale, w = r.w, power = r.power;
    const bb = boxAt(Lc.x, Lc.y, R, F, sc); if (!bb) return;
    const bbw = bb[2] - bb[0], bbh = bb[3] - bb[1];
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.clearRect(bb[0], bb[1], bbw, bbh);
    sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc);
    const g = sx.createRadialGradient(Lc.x, Lc.y, 6, Lc.x, Lc.y, R); g.addColorStop(0, rgba(power)); g.addColorStop(.25, rgba(power * .83)); g.addColorStop(.7, rgba(power * .28)); g.addColorStop(1, rgba(0));
    sx.fillStyle = g; sx.fillRect(Lc.x - R, Lc.y - R, R * 2, R * 2);
    if (!f.omni) {                                                          // the beam's soft angular profile (a smooth cone, not a flat one)
      sx.globalCompositeOperation = 'destination-in';
      if (typeof sx.createConicGradient === 'function') {
        const cg = sx.createConicGradient(Lc.ang - Math.PI, Lc.x, Lc.y), TAU = Math.PI * 2;
        for (const u of [0, .3, .45, .55, .65, .75, .85, .93, 1]) { const ph = u * f.arc / 2; cg.addColorStop(clamp(.5 - ph / TAU, 0, 1), rgba(beamProfile(ph, f.arc))); cg.addColorStop(clamp(.5 + ph / TAU, 0, 1), rgba(beamProfile(ph, f.arc))); }
        cg.addColorStop(0, rgba(0)); cg.addColorStop(1, rgba(0)); sx.fillStyle = cg; sx.fillRect(Lc.x - R, Lc.y - R, R * 2, R * 2);
      } else {                                                              // no conic gradients (old browsers): the plain sector
        sx.beginPath(); sx.moveTo(Lc.x, Lc.y); sx.arc(Lc.x, Lc.y, R, Lc.ang - f.arc / 2, Lc.ang + f.arc / 2); sx.closePath(); sx.fillStyle = rgba(1); sx.fill();
      }
      sx.globalCompositeOperation = 'source-over';
    }
    /* the shadows walls, pillars and props cast into that field, from the hand (inside the beam only); then the actors' */
    castInto(sx, r.smp, R + 8, r.cone, F, k, sc, bb, { props: r.props, sh: r.sh, kmax: CARRY.kmax });
    if (r.acts.length) castActors(sx, r.acts, F, k, sc);
    /* the light it adds */
    const bx = S.bx; bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, bb[0], bb[1], bbw, bbh, bb[0], bb[1], bbw, bbh); bx.restore();
    /* its colour over the lit area (v23.3.6 tints a carried beam with its colour) */
    let tint = false;
    if (Lc.color && /^#[0-9a-f]{6}$/i.test(Lc.color)) {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = Lc.color; sx.fillRect(bb[0], bb[1], bbw, bbh); sx.globalCompositeOperation = 'source-over';
      const tx = S.tx; tx.save(); tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalAlpha = f.omni ? TINT.omni : TINT.beam; tx.drawImage(S.scr, bb[0], bb[1], bbw, bbh, bb[0], bb[1], bbw, bbh); tx.restore(); tint = true;
    }
    /* the hand glow: a small omni field at the hand, with the shadows walls and props cast into it from the hand */
    const gb = boxAt(Lc.x, Lc.y, Lc.glowR, F, sc);
    if (gb) {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.clearRect(gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]);
      sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc);
      const gg = sx.createRadialGradient(Lc.x, Lc.y, 6, Lc.x, Lc.y, Lc.glowR); gg.addColorStop(0, rgba(Lc.glowA * w)); gg.addColorStop(.25, rgba(Lc.glowA * .83 * w)); gg.addColorStop(.7, rgba(Lc.glowA * .28 * w)); gg.addColorStop(1, rgba(0));
      sx.fillStyle = gg; sx.fillRect(Lc.x - Lc.glowR, Lc.y - Lc.glowR, Lc.glowR * 2, Lc.glowR * 2);
      castInto(sx, [Lc.x, Lc.y], Lc.glowR + 4, null, F, k, sc, gb, { props: r.gprops, sh: r.sh, kmax: CARRY.kmax });
      bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1], gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]); bx.restore();
    }
    sx.setTransform(1, 0, 0, 1, 0, 0);
    rec.carried.push({ x: Lc.x, y: Lc.y, ang: Lc.ang, R, arc: f.arc, omni: !!f.omni, power, smp: r.smp, props: r.props, gprops: r.gprops, sh: r.sh, glowR: Lc.glowR, glowA: Lc.glowA * w, own: r.own, tint });
  }

  /* ---------- the static wall grounding (SH7 donor, ADAPT) ---------- */
  function canvasTex(w, h, alphaAt) {
    const c = mkCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.data[(j * w + i) * 4 + 3] = Math.round(255 * clamp(alphaAt(i, j), 0, 1));
    x.putImageData(img, 0, 0); return S.Tex.from(c);
  }
  function attach() {
    if (++S.attachTries > 900) { disable('renderer never became available'); return false; }
    const A = window.__api; if (!A || typeof A.floor !== 'function' || typeof A.Hc !== 'function' || typeof A.Uc !== 'function') return false;
    const floor = A.floor(), world = floor && floor.parent; if (!world || !world.children) return false;
    const kids = world.children, ci = kids.findIndex(c => c && c.tileScale && c.texture), level = kids[ci + 1];
    if (ci < 0 || !level || typeof level.texture !== 'function') { disable('renderer layout not recognised'); return false; }
    S.world = world; S.G = level.constructor; S.C = floor.constructor; S.Tex = kids[ci].texture.constructor;
    S.FBW = Math.round(kids[ci].width / T); S.FBH = Math.round(kids[ci].height / T);
    if (!(S.FBW > 0 && S.FBH > 0) || typeof S.Tex.from !== 'function') { disable('level size unavailable'); return false; }
    S.person = kids.find(c => c && c !== floor && typeof c.deathPose === 'function') || null;
    buildEdges(); buildProps(); S.blur = blurSupported();
    const fall = u => Math.pow(1 - clamp(u, 0, 1), AO.power), n = AO.steps, q = 48;
    S.tex = { down: canvasTex(2, n, (i, j) => fall((j + .5) / n)), up: canvasTex(2, n, (i, j) => fall((n - j - .5) / n)), right: canvasTex(n, 2, i => fall((i + .5) / n)), left: canvasTex(n, 2, i => fall((n - i - .5) / n)),
      se: canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, j + .5) / q)), sw: canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, j + .5) / q)), ne: canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, q - j - .5) / q)), nw: canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, q - j - .5) / q)) };
    S.castCv = castTexture();
    const root = new S.C(); root.label = 'br-role';
    { const c = new S.C(); c.label = 'br-role-ao'; root.addChild(c); S.layers.ao = c; }   // BR2B: actor shadows are light removal in the compositor, no Pixi layer
    world.addChildAt(root, ci + 1);                                       // right above the carpet: under walls, props, entities
    S.root = root; buildAO(); S.attached = true;
    return true;
  }
  function buildAO() {
    const A = window.__api, W = S.FBW, H = S.FBH, w = AO.width, wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : !!A.Hc(x, y);
    const nx = Math.ceil(W / CHUNK), ny = Math.ceil(H / CHUNK), chunks = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const g = new S.G(); g.alpha = AO.alpha; chunks.push({ g, q: 0, x0: i * CHUNK * T - w, y0: j * CHUNK * T - w, x1: (i + 1) * CHUNK * T + w, y1: (j + 1) * CHUNK * T + w }); }
    const chunkOf = (cx, cy) => chunks[Math.min(ny - 1, Math.floor(cy / CHUNK)) * nx + Math.min(nx - 1, Math.floor(cx / CHUNK))];
    const put = (cx, cy, tex, x, y, ww, hh) => { const c = chunkOf(cx, cy); c.g.texture(tex, 0xffffff, x, y, ww, hh); c.q++; };
    const brk = v => v % CHUNK === CHUNK - 1, X = S.tex;
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) { if (wall(x, y) && !wall(x, y + 1)) { let e = x; while (!brk(e) && e + 1 < W && wall(e + 1, y) && !wall(e + 1, y + 1)) e++; put(x, y + 1, X.down, x * T, (y + 1) * T, (e - x + 1) * T, w); x = e + 1; } else x++; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) { if (wall(x, y) && !wall(x, y - 1)) { let e = x; while (!brk(e) && e + 1 < W && wall(e + 1, y) && !wall(e + 1, y - 1)) e++; put(x, y - 1, X.up, x * T, y * T - w, (e - x + 1) * T, w); x = e + 1; } else x++; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) { if (wall(x, y) && !wall(x + 1, y)) { let e = y; while (!brk(e) && e + 1 < H && wall(x, e + 1) && !wall(x + 1, e + 1)) e++; put(x + 1, y, X.right, (x + 1) * T, y * T, w, (e - y + 1) * T); y = e + 1; } else y++; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) { if (wall(x, y) && !wall(x - 1, y)) { let e = y; while (!brk(e) && e + 1 < H && wall(x, e + 1) && !wall(x - 1, e + 1)) e++; put(x - 1, y, X.left, x * T - w, y * T, w, (e - y + 1) * T); y = e + 1; } else y++; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!wall(x, y)) continue; const cx = x * T, cy = y * T;
      if (!wall(x + 1, y) && !wall(x, y + 1) && !wall(x + 1, y + 1)) put(x + 1, y + 1, X.se, cx + T, cy + T, w, w);
      if (!wall(x - 1, y) && !wall(x, y + 1) && !wall(x - 1, y + 1)) put(x - 1, y + 1, X.sw, cx - w, cy + T, w, w);
      if (!wall(x + 1, y) && !wall(x, y - 1) && !wall(x + 1, y - 1)) put(x + 1, y - 1, X.ne, cx + T, cy - w, w, w);
      if (!wall(x - 1, y) && !wall(x, y - 1) && !wall(x - 1, y - 1)) put(x - 1, y - 1, X.nw, cx - w, cy - w, w, w);
    }
    S.layers.ao.removeChildren(); S.chunks = chunks.filter(c => c.q > 0); for (const c of S.chunks) S.layers.ao.addChild(c.g);
  }
  function cullAO(r) { for (const c of S.chunks) { const v = c.x1 > r.x0 && c.x0 < r.x1 && c.y1 > r.y0 && c.y0 < r.y1; if (c.g.visible !== v) c.g.visible = v; } }
  /* ---------- BR2B actor shadows ----------
   * The local player, other wanderers and Hounds the local player can actually see.  An actor is a blocker of its DOMINANT
   * light only: the light that really reaches it most (its unblocked contribution at the actor: falloff, beam, walls,
   * pillars, props), kept with hysteresis so nearly equal lights never flip it; HIGH adds a faint second shadow when a second
   * light matters too.  The shadow is that light's own contribution taken away behind the actor (destination-out in that
   * light's scratch, before it is added), so every other light still fills it - no dark paint.  It starts at the body's rim
   * (the art already gives players and Hounds a centred contact shadow; this adds only the directional part), points away
   * from the light, grows with the distance to it (bounded), and fades out under a light overhead.  Weights ease per frame:
   * a change of dominant light cross-fades, never pops.  Never a Smiler: no body, contact or silhouette shadow, ever. */
  const ACT = {
    player: { a: .9, la: 17, lb: 17, len: 84 }, hound: { a: .92, la: 40, lb: 17, len: 140 },   // a: the share of that light removed just past the rim
    k: { lamp: .5, carried: .8 },            // shadow length per px of distance from the light (a lower light: longer), up to len
    near: 40, min: .04,                      // fades out within `near` px of the light; a dominant light adds at least `min`
    swap: 1.35, swapAdd: .02,                // a new dominant light must beat the current one by 35 % (+ .02)
    second: { rel: .5, min: .06, a: .45 },   // HIGH: a second light at >= 50 % of the first: a 45 % second shadow
    ease: .2, sight: 700 };                  // weights ease 20 % a frame (frame-based: steady under a frozen clock)
  function seen(V, x, y) { const dx = x - V.x, dy = y - V.y, d = Math.hypot(dx, dy); if (d < 30) return true; if (d > ACT.sight) return false; return window.__api.Uc(V.x, V.y, Math.atan2(dy, dx), d) >= d - 20; }
  /* a light's unblocked contribution at an actor (lamps from three points of their tube: its ends and its middle) */
  function lampAt(r, x, y) {
    const d = Math.hypot(x - r.L.x, y - r.L.y); if (d >= LAMP.R) return 0;
    const m = r.smp, n = m.length / 2, pts = n <= 3 ? m : [m[0], m[1], m[2 * Math.floor(n / 2)], m[2 * Math.floor(n / 2) + 1], m[m.length - 2], m[m.length - 1]];
    return r.p * lampFall(d) * seenFrom(pts, x, y, r.props, LAMP.h, LAMP.kmax);
  }
  function carriedAt(r, x, y) {
    const d = Math.hypot(x - r.x, y - r.y); if (d >= r.R) return 0;
    const da = Math.atan2(y - r.y, x - r.x) - r.ang, ph = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))), prof = r.omni ? 1 : beamProfile(ph, r.arc); if (!(prof > 0)) return 0;
    return r.power * beamGrad(d, r.R) * prof * seenFrom([r.x, r.y], x, y, r.props, r.sh, CARRY.kmax);
  }
  let ckey = 0;
  function actorShadows(F, cfg, lampRecs, carRecs) {
    const out = S.actorsLast = []; ST.ents = 0;
    if (!S.actorsOn) return out;
    const A = window.__api, V = F.viewer, list = [], P = S.person;
    if (P && P.visible && P.parent && !F.death && P.alpha > .01) list.push([P, P.x, P.y, 'player', null, true]);
    const cr = A.layer && A.layer();
    if (cr && cr.children) for (const v of cr.children) {
      if (!v || !v.visible || !(v.alpha > .01) || v.__smiler) continue;  // never a Smiler: no body may be implied
      if (v.__hound) list.push([v, v.x, v.y, 'hound', v.rotation - Math.PI / 2, false]);
      else if (typeof v.deathPose === 'function') list.push([v, v.x, v.y, 'player', null, false]);   // another wanderer's avatar
    }
    let n = 0;
    for (const [v, x, y, kind, heading, self] of list) {
      if (n >= cfg.ents) break;
      if (!Number.isFinite(x + y) || (!self && !seen(V, x, y))) { S.act.delete(v); continue; }   // only what the local player can see
      const cands = [];
      for (const r of lampRecs) { const c = lampAt(r, x, y); if (c > .004) cands.push({ r, key: 'L' + r.i, kind: 'lamp', x: r.L.x, y: r.L.y, s: c }); }
      for (const r of carRecs) { if (self ? r.own : Math.hypot(r.x - x, r.y - y) < 45) continue; const c = carriedAt(r, x, y); if (c > .004) cands.push({ r, key: null, kind: 'carried', x: r.x, y: r.y, s: c }); }   // not its own light
      let st = S.act.get(v); if (!st || st.f !== ST.frames - 1) { st = { w: new Map(), dom: null, f: 0 }; S.act.set(v, st); }
      st.f = ST.frames;
      for (const c of cands) if (c.kind === 'carried') {                  // a carried light keeps its key while it moves (nearest last position)
        let best = null, bd = 60; for (const [kk, e] of st.w) if (e.kind === 'carried' && e.seen !== ST.frames) { const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < bd) { bd = d; best = kk; } }
        c.key = best || 'C' + (++ckey); if (best) st.w.get(best).seen = ST.frames;
      }
      cands.sort((a, b) => b.s - a.s || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const cur = st.dom ? cands.find(c => c.key === st.dom) : null, top = cands[0];
      let dom = cur || null;
      if (top && top.s >= ACT.min && (!cur || (top !== cur && top.s > cur.s * ACT.swap + ACT.swapAdd))) dom = top;
      if (dom && dom.s < ACT.min / 2) dom = null;
      if ((dom ? dom.key : null) !== st.dom) st.sw = { f: ST.frames, from: st.dom, to: dom ? dom.key : null, sFrom: cur ? +cur.s.toFixed(4) : null, sTo: dom ? +dom.s.toFixed(4) : null };   // (debug: why it changed)
      st.dom = dom ? dom.key : null;
      const sec = cfg.secondary && dom ? cands.find(c => c !== dom && c.s >= ACT.second.min && c.s >= dom.s * ACT.second.rel) : null;
      const now_ = new Set();
      for (const c of cands) { let e = st.w.get(c.key); if (!e) { e = { w: 0, kind: c.kind }; st.w.set(c.key, e); } e.x = c.x; e.y = c.y; e.c = c; now_.add(c.key); }
      const Pk = ACT[kind]; let drawn = 0;
      for (const [key, e] of st.w) {
        if (!now_.has(key)) { st.w.delete(key); continue; }               // that light is gone: its shadow goes with it
        const target = dom && key === dom.key ? 1 : sec && key === sec.key ? ACT.second.a : 0;
        e.w += (target - e.w) * ACT.ease; if (target === 0 && e.w < .01) { st.w.delete(key); continue; }
        const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy); if (d < 1) continue;
        const ang = Math.atan2(dy, dx), phi = heading === null ? 0 : ang - heading, cs = Math.cos(phi), sn = Math.sin(phi);
        const along = Math.sqrt((Pk.la * cs) ** 2 + (Pk.lb * sn) ** 2), across = Math.sqrt((Pk.la * sn) ** 2 + (Pk.lb * cs) ** 2);
        const a = Pk.a * e.w * clamp((d - 8) / ACT.near, 0, 1) * Math.min(1, v.alpha);
        if (!(a > .01)) continue;
        const job = { kind, self, x, y, ang, ext: clamp(d * ACT.k[e.kind], 6, Pk.len), along, across, a, light: key, lightKind: e.kind, dominant: !!(dom && key === dom.key), score: +e.c.s.toFixed(4) };
        if (job.dominant && st.sw && st.sw.f === ST.frames) job.switched = st.sw;
        e.c.r.acts.push(job); out.push(job); drawn++;
      }
      if (drawn) n++;
    }
    ST.ents = out.length;
    return out;
  }
  /* take an actor's shadow out of one light's field (c: that light's scratch, buffer pixels; the cast texture runs from
   * the body's rim, away from the light) */
  function castActors(c, acts, F, k, sc) {
    c.save(); c.globalCompositeOperation = 'destination-out';
    for (const j of acts) {
      const cs = Math.cos(j.ang) * k, sn = Math.sin(j.ang) * k; c.setTransform(cs, sn, -sn, cs, j.x * k + F.ox * sc, j.y * k + F.oy * sc); c.globalAlpha = clamp(j.a, 0, 1);   // world, then at the actor, turned away from the light
      c.drawImage(S.castCv, j.along * .55, -j.across * 1.15, j.along * .45 + j.ext, j.across * 2.3);
    }
    c.restore();
  }
  /* the cast texture: strongest just past the rim, fading to the tip; soft across */
  function castTexture() {
    const w = 96, h = 32, c = mkCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = (i + .5) / w, v = ((j + .5) / h) * 2 - 1, ramp = clamp(u / .1, 0, 1);
      img.data[(j * w + i) * 4] = img.data[(j * w + i) * 4 + 1] = img.data[(j * w + i) * 4 + 2] = 255;
      img.data[(j * w + i) * 4 + 3] = Math.round(255 * ramp * ramp * (3 - 2 * ramp) * Math.pow(1 - u, 1.05) * Math.pow(Math.max(0, 1 - v * v), 1.3));
    }
    x.putImageData(img, 0, 0); return c;
  }

  /* ---------- settings: a LIGHTING row in SETTINGS > CUSTOMIZE (hud.js is not modified) ---------- */
  function setQuality(q, remember = true) {
    q = String(q || '').toLowerCase(); if (!QUALITIES.includes(q)) return S.quality;
    S.quality = q; if (remember) try { localStorage.setItem(LS_KEY, q); } catch (e) { }
    syncControl(); return q;
  }
  function addSettingsControl() {
    const pane = document.querySelector('#settings section[data-pane="custom"]'); if (!pane || document.getElementById('stLighting')) return;
    const box = document.createElement('div'); box.id = 'stLighting';
    box.innerHTML = '<h3>LIGHTING</h3><p class="st-note">How finely the lights and shadows are drawn. Never changes what you or the entities can see or do. LOW suits phones and older PCs.</p>' +
      '<div style="display:flex;gap:6px">' + QUALITIES.map(q => `<button type="button" class="st-btn" data-lq="${q}" style="flex:1;margin:0;padding:9px 2px">${q.toUpperCase()}</button>`).join('') + '</div>';
    box.addEventListener('click', e => { const b = e.target.closest('[data-lq]'); if (!b) return; e.stopPropagation(); setQuality(b.dataset.lq); });
    pane.appendChild(box); syncControl();
  }
  function syncControl() { document.querySelectorAll('#stLighting [data-lq]').forEach(b => { const o = b.dataset.lq === S.quality; b.style.outline = o ? '2px solid currentColor' : ''; b.setAttribute('aria-pressed', o ? 'true' : 'false'); }); }

  /* ---------- admin-only debug counters (DEBUG MODE in the admin panel) ---------- */
  const adminDebug = () => !!(window.__ents && window.__ents.dbgCfg && window.__ents.dbgCfg.on);
  function msStats() { const k = Math.min(ST.n, ST.ms.length); let s = 0, m = 0; for (let i = 0; i < k; i++) { s += ST.ms[i]; if (ST.ms[i] > m) m = ST.ms[i]; } return { mean: k ? +(s / k).toFixed(3) : 0, max: +m.toFixed(2), frames: ST.frames }; }
  function debugPanel() {
    const on = adminDebug();
    if (!on) { if (S.dbgEl) { S.dbgEl.remove(); S.dbgEl = null; } return; }
    if (!S.dbgEl) { const d = document.createElement('div'); d.id = 'brRoleDebug'; d.style.cssText = 'position:fixed;left:8px;bottom:64px;z-index:9;font:11px monospace;color:#9dff9d;background:rgba(0,0,0,.72);padding:6px 9px;pointer-events:none;white-space:pre'; document.body.appendChild(d); S.dbgEl = d; }
    const m = msStats(), c = TIERS[S.quality];
    S.dbgEl.textContent = `BR-RoLE ${VERSION}  ${S.quality.toUpperCase()}  buffer ${ST.buf[0]}x${ST.buf[1]} (x${c.scale})\nlamps ${ST.lamps}/${c.lamps}  carried ${ST.carried} (peers ${ST.peers}/${c.peers})  shadow sides ${ST.shadows}  props ${ST.props}/${c.propFrame}\nlamp fields cached ${S.lampCache.size}/${c.lampCache} built ${ST.lampBuilds} (${ST.lampBuildMs.toFixed(1)} ms, tube ${c.tube} pts${S.blur ? ', blurred' : ''})  actor shadows ${ST.ents}\nframe ${m.mean} ms avg  ${m.max} ms max`;
  }

  /* what the compositor puts at a world point this frame, light by light (tests / debug; reads nothing from the canvas) */
  /* the fraction of a light's source points (tube / hand) that see (x, y): the game's own ray query, no walls or pillars between */
  function seenFrom(smp, x, y, props, sh, kmax) {
    const Uc = window.__api.Uc; let v = 0;
    for (let s = 0; s < smp.length; s += 2) {
      const dx = x - smp[s], dy = y - smp[s + 1], d = Math.hypot(dx, dy); if (!(d < .5 || Uc(smp[s], smp[s + 1], Math.atan2(dy, dx), d) >= d - .5)) continue;
      if (props && props.some(p => inPropShadow(p, smp[s], smp[s + 1], sh, kmax, x, y))) continue;
      v++;
    }
    return v / (smp.length / 2);
  }
  function probe(x, y) {
    const L = S.last; if (!L) return null; const A = window.__api, lamps = A.lamps || [], out = { lamps: [], carried: [] };
    for (const l of L.lamps) { const lp = lamps[l.i], r = Math.hypot(x - lp.x, y - lp.y), v = r < LAMP.R ? seenFrom(l.smp, x, y, l.props, LAMP.h, LAMP.kmax) : 0; out.lamps.push({ i: l.i, visible: v, light: l.p * lampFall(r) * v }); }
    for (const c of L.carried) {
      const d = Math.hypot(x - c.x, y - c.y), vis = d < c.R ? seenFrom(c.smp, x, y, c.props, c.sh, CARRY.kmax) : 0, da = Math.atan2(y - c.y, x - c.x) - c.ang, ph = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      const beam = c.power * beamGrad(d, c.R) * (c.omni ? 1 : beamProfile(ph, c.arc)) * vis, glow = d < c.glowR ? c.glowA * beamGrad(d, c.glowR) * seenFrom([c.x, c.y], x, y, c.gprops, c.sh, CARRY.kmax) : 0;
      out.carried.push({ own: c.own, visible: vis, light: beam + glow });
    }
    out.total = Math.min(1, out.lamps.reduce((s, l) => s + l.light, 0) + out.carried.reduce((s, l) => s + l.light, 0));
    return out;
  }

  function on() { return !S.legacy && !S.disabled && (!!S.edges || attach()); }   // the game draws its own lighting until BR-RoLE is attached
  const ui = () => { try { addSettingsControl(); if (!S.dbgEl || !adminDebug()) debugPanel(); } catch (e) { } };
  setInterval(ui, 500); if (document.readyState !== 'loading') ui(); else addEventListener('DOMContentLoaded', ui);

  window.__brRole = {
    version: VERSION,
    on,
    draw,
    quality: () => S.quality,
    setQuality: q => setQuality(q, false),
    qualities: () => QUALITIES.slice(),
    tiers: () => JSON.parse(JSON.stringify(TIERS)),
    stats: () => ({ version: VERSION, quality: S.quality, on: on(), legacy: S.legacy, disabled: S.disabled, attached: S.attached, frames: ST.frames, frameMs: msStats(), buffer: ST.buf.slice(),
      lamps: { last: ST.lamps, max: ST.lampsMax, cap: TIERS[S.quality].lamps, cached: S.lampCache.size, cacheCap: TIERS[S.quality].lampCache, pending: S.pending.size, builds: ST.lampBuilds, buildMs: +ST.lampBuildMs.toFixed(2), evictions: ST.lampEvictions, tube: TIERS[S.quality].tube, blur: S.blur },
      carried: { last: ST.carried, peers: ST.peers, peerCap: TIERS[S.quality].peers, sourcePoints: TIERS[S.quality].src }, shadows: { last: ST.shadows, max: ST.shadowsMax }, actorShadows: { last: ST.ents, cap: TIERS[S.quality].ents, secondary: TIERS[S.quality].secondary, on: S.actorsOn },
      blockers: { sides: S.nEdges || 0, pillars: S.pillars || 0, props: S.props.length, propKinds: [...new Set(S.props.map(p => p.kind))] },
      props: { last: ST.props, max: ST.propsMax, perLight: TIERS[S.quality].props, perFrame: TIERS[S.quality].propFrame }, errors: ST.errors }),
    resetStats: () => { ST.frames = 0; ST.n = 0; ST.max = 0; ST.lampsMax = 0; ST.shadowsMax = 0; ST.propsMax = 0; },
    probe,
    lastFrame: () => S.lastF ? Object.assign({}, S.lastF) : null,      // the world -> overlay mapping BR-RoLE drew with last (tests)
    /* DEV only (comparison, tests): the v23.3.6 lighting instead of BR-RoLE; never offered to players */
    /* the actor shadows drawn last frame: { kind, self, x, y, ang, ext, a, light, lightKind, dominant } (tests / debug) */
    actors: () => S.actorsLast.map(j => Object.assign({}, j)),
    dev: { legacy: v => { if (v !== undefined) { S.legacy = !!v; if (S.root) S.root.visible = !S.legacy; } return S.legacy; },
      actors: v => { if (v !== undefined) S.actorsOn = !!v; return S.actorsOn; } },   // DEV only: actor shadows off (A/B in tests)
  };
})();
