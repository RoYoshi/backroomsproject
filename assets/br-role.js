/* br-role.js - BR-RoLE, the Backrooms Rendering of Lighting Engine (presentation only, client only).  BR1.
 *
 * THE 2D GAME IS THE GAME.  BR-RoLE is the one visual owner of the light in the world: ambient darkness, the ceiling
 * lamps, your carried light and the other wanderers' lights, and how walls and pillars block them.
 *
 * One model, every light on its own:   visible light = ambient + Σ lightᵢ · visibilityᵢ
 *   - an offscreen LIGHT BUFFER (a fraction of the CSS viewport per tier; never scaled by devicePixelRatio);
 *   - each light is drawn into it independently with its own cookie (falloff / beam cone / hand glow), clipped to its OWN
 *     visibility polygon (rays aimed at every wall and pillar corner in reach), and ADDED (`lighter`);
 *   - a light that a wall blocks adds nothing there - so any other light that reaches the spot lights it.  Nothing is
 *     erased, nothing compensates for another layer: mixed light is just the sum.
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
 * entity (never for a Smiler).  Cast prop / actor shadows inside the compositor and tube-area softness come in BR2.
 *
 * Quality: LOW / MEDIUM / HIGH (SETTINGS > CUSTOMIZE > LIGHTING, or ?lighting=low|medium|high; remembered per device).
 * DEV only: ?lighting=legacy draws the v23.3.6 lighting for comparison (not offered in the settings).
 * window.__brRole = { version, on(), draw(ctx, frame), quality(), setQuality(q), stats(), resetStats(), probe(x, y), dev } */
(() => {
  'use strict';
  if (window.__brRole) return;
  const VERSION = 'br-role BR1';
  const T = 96, CHUNK = 16, VB = 384;                                       // level cell; grounding chunk (cells); vertex bucket (px)
  const QUALITIES = ['low', 'medium', 'high'];
  /* per tier: light-buffer scale of the CSS viewport, lamps / other wanderers drawn (nearest that reach the screen), beam
   * softness (angular profile stops), ray budgets (uniform rays; every wall / pillar corner in reach gets 3 more) */
  const TIERS = {
    low: { scale: .5, lamps: 8, peers: 1, lampRays: 96, beamRays: 28, omniRays: 40, glowRays: 12, ents: 6 },
    medium: { scale: .75, lamps: 10, peers: 3, lampRays: 128, beamRays: 44, omniRays: 64, glowRays: 16, ents: 12 },
    high: { scale: 1, lamps: 14, peers: 6, lampRays: 160, beamRays: 64, omniRays: 96, glowRays: 20, ents: 20 },
  };
  const LAMP = { R: 380, inner: 6 };
  const AMB = { r0: 18, r1: 670, a0: .14, a1: .045 };                       // the ambient glow around the viewer (v23.3.6's)
  const TINT = { beam: .25, omni: .2 };                                      // carried-light colour tint over the lit area
  const AO = { width: 50, alpha: .56, steps: 64, power: 1.35 };              // SH7 grounding (ADAPT)
  const ENT = { player: { a: .38, la: 17, lb: 17, len: 84 }, hound: { a: .42, la: 40, lb: 17, len: 140 }, tau: .12, sight: 700 };
  const EPS = 2e-5, LS_KEY = 'tfb.lighting.quality';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const now = () => performance.now();
  const S = { quality: 'medium', legacy: false, disabled: '', attached: false, attachTries: 0, buf: null, bx: null, scr: null, sx: null, tb: null, tx: null,
    lampPoly: new Map(), lampKey: '', verts: null, vgrid: new Map(), layers: {}, chunks: [], pool: [], person: null, last: null, dbgEl: null };
  const ST = { frames: 0, ms: new Float32Array(240), n: 0, max: 0, lamps: 0, lampsMax: 0, carried: 0, peers: 0, rays: 0, raysMax: 0, lampBuilds: 0, lampBuildMs: 0, ents: 0, buf: [0, 0], legacyFrames: 0, errors: 0 };

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

  /* ---------- occluder vertices: every grid corner the walls make (as the game's own Vl) and every pillar corner ---------- */
  function buildVerts() {
    const A = window.__api, W = S.FBW, H = S.FBH, v = [];
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
      const a = A.Hc(x - 1, y - 1), b = A.Hc(x, y - 1), c = A.Hc(x - 1, y), d = A.Hc(x, y), n = +!!a + +!!b + +!!c + +!!d;
      if (n === 1 || n === 3 || (n === 2 && !!a === !!d)) v.push(x * T, y * T);
    }
    const seen = new Set();
    if (typeof A.Bc === 'function') for (let y = 96; y < H * T; y += 192) for (let x = 96; x < W * T; x += 192) {
      let l = null; try { l = A.Bc(x, y); } catch (e) { l = null; }
      if (l) for (const r of l) if (r && r.w === 56 && r.h === 56) { const k = r.x + ',' + r.y; if (!seen.has(k)) { seen.add(k); v.push(r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h); } }
    }
    S.verts = v; S.vgrid.clear();
    for (let i = 0; i < v.length; i += 2) { const k = Math.floor(v[i + 1] / VB) * 4096 + Math.floor(v[i] / VB); let l = S.vgrid.get(k); if (!l) S.vgrid.set(k, l = []); l.push(i); }
  }
  /* the visibility polygon of a light at (x, y), radius R, over the angles a0..a1 (a full turn when omni): `base` uniform
   * rays plus three rays (just before, at, just after) at every corner in reach, each cut where the game's own ray query
   * (walls and pillars) stops it.  Returns a flat [x, y, ...] (with the source first when it is a fan). */
  const tmpA = [];
  function visPoly(x, y, R, a0, a1, base, fan) {
    const A = window.__api, Uc = A.Uc, full = a1 - a0 >= Math.PI * 2 - 1e-9, span = a1 - a0; tmpA.length = 0;
    for (let k = 0; k <= base; k++) { if (full && k === base) break; tmpA.push(a0 + span * k / base); }
    const bx0 = Math.floor((x - R) / VB), bx1 = Math.floor((x + R) / VB), by0 = Math.floor((y - R) / VB), by1 = Math.floor((y + R) / VB), V = S.verts;
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      const l = S.vgrid.get(by * 4096 + bx); if (!l) continue;
      for (const i of l) {
        const dx = V[i] - x, dy = V[i + 1] - y, d2 = dx * dx + dy * dy; if (d2 > (R + 2) * (R + 2) || d2 < .25) continue;
        let a = Math.atan2(dy, dx);
        if (!full) { a = a0 + ((a - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (a > a1) continue; }
        tmpA.push(a - EPS, a, a + EPS);
      }
    }
    tmpA.sort((p, q) => p - q);
    const out = fan ? [x, y] : [];
    for (const a of tmpA) { if (!full && (a < a0 || a > a1)) continue; const d = Uc(x, y, a, R); out.push(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    ST.rays += tmpA.length;
    return out;
  }
  function lampPoly(i, L, cfg) {
    const key = S.quality; if (S.lampKey !== key) { S.lampPoly.clear(); S.lampKey = key; }
    let p = S.lampPoly.get(i); if (p) return p;
    const t0 = now(); p = visPoly(L.x, L.y, LAMP.R, -Math.PI, Math.PI, cfg.lampRays, false); S.lampPoly.set(i, p);
    ST.lampBuilds++; ST.lampBuildMs += now() - t0; return p;
  }
  const path = (c, p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]); c.closePath(); };

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
      ST.rays = 0;
      for (const c of [bx, tx]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, bw, bh); }
      bx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); bx.globalCompositeOperation = 'lighter';
      const view = { x0: -F.ox / F.r, y0: -F.oy / F.r, x1: (F.w - F.ox) / F.r, y1: (F.h - F.oy) / F.r };
      const meet = (x, y, R) => x + R > view.x0 && x - R < view.x1 && y + R > view.y0 && y - R < view.y1;
      const V = F.viewer, rec = S.last = { lamps: [], carried: [] }; S.lastF = { r: F.r, ox: F.ox, oy: F.oy, w: F.w, h: F.h, t: F.t };

      /* ambient: the faint glow the viewer carries everywhere (v23.3.6's), never blocked */
      { const g = bx.createRadialGradient(V.x, V.y, AMB.r0, V.x, V.y, AMB.r1); g.addColorStop(0, rgba(AMB.a0)); g.addColorStop(.5, rgba(AMB.a1)); g.addColorStop(1, rgba(0)); bx.fillStyle = g; bx.fillRect(V.x - AMB.r1, V.y - AMB.r1, AMB.r1 * 2, AMB.r1 * 2); }

      /* ceiling lamps: the ones whose light reaches the screen, nearest the viewer first; the one at the cap fades out */
      let nl = 0;
      if (!(A.V && A.V.blackout)) {
        const lamps = A.lamps || [], list = [];
        for (let i = 0; i < lamps.length; i++) { const L = lamps[i]; if (meet(L.x, L.y, LAMP.R)) list.push([Math.hypot(L.x - V.x, L.y - V.y), i]); }
        list.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const cut = list.length > cfg.lamps ? list[cfg.lamps][0] : Infinity;
        for (let m = 0; m < list.length && m < cfg.lamps; m++) {
          const i = list[m][1], L = lamps[i], p = lampPower(i, L, F.t) * (m === cfg.lamps - 1 ? clamp((cut - list[m][0]) / 140, 0, 1) : 1);   // only the last admitted fades (no pop at the cap)
          if (!(p > .002)) continue;
          const poly = lampPoly(i, L, cfg);
          bx.save(); path(bx, poly); bx.clip();
          const g = bx.createRadialGradient(L.x, L.y, LAMP.inner, L.x, L.y, LAMP.R); g.addColorStop(0, rgba(p)); g.addColorStop(.5, rgba(p * .35)); g.addColorStop(1, rgba(0));
          bx.fillStyle = g; bx.fillRect(L.x - LAMP.R, L.y - LAMP.R, LAMP.R * 2, LAMP.R * 2); bx.restore();
          nl++; rec.lamps.push({ i, p, poly });
        }
      }

      /* carried lights: yours (the hand that holds it, or the death torch), then the nearest other wanderers' */
      const Gc = A.Gc || {}, lights = [];
      const own = Gc[F.kind];
      if (F.on && own && !own.nv && own.range > 1 && F.src) lights.push({ x: F.src.x, y: F.src.y, ang: F.src.angle ?? (A.H && A.H.angle) ?? 0, f: own, color: F.color, glowR: F.death ? 150 : 52, glowA: F.death ? .73 : .35, fl: own.omni ? .93 + Math.sin(F.t * 17) * .035 + Math.sin(F.t * 31) * .025 : 1, own: true });
      let np = 0;
      if (cfg.peers > 0 && Array.isArray(window.__peerLights)) {
        const ps = window.__peerLights.filter(p => p && p.on && !p.dead && p.kind !== 'camcorder' && Gc[p.kind || 'flashlight'] && !Gc[p.kind || 'flashlight'].nv && Number.isFinite(p.x + p.y))
          .map(p => [Math.hypot(p.x - V.x, p.y - V.y), p]).sort((a, b) => a[0] - b[0]);
        const cut = ps.length > cfg.peers ? ps[cfg.peers][0] : Infinity;
        for (let m = 0; m < ps.length && m < cfg.peers; m++) { const p = ps[m][1], f = Gc[p.kind || 'flashlight'], w = m === cfg.peers - 1 ? clamp((cut - ps[m][0]) / 80, 0, 1) : 1; if (w > .01) { lights.push({ x: p.x, y: p.y, ang: p.angle || 0, f, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#ffe7b2', glowR: 52, glowA: .35, fl: f.omni ? .93 + Math.sin(F.t * 17 + p.x) * .035 + Math.sin(F.t * 31 + p.y) * .025 : 1, w }); np++; } }
      }
      for (const Lc of lights) if (meet(Lc.x, Lc.y, Lc.f.range)) carried(Lc, F, cfg, k, view, rec);

      /* into the overlay: it loses exactly the light that reached each pixel (inside drawLight's line-of-sight clip), then
       * the carried lights' colour */
      n.save(); n.setTransform(1, 0, 0, 1, 0, 0); n.globalAlpha = 1; n.imageSmoothingEnabled = true;
      n.globalCompositeOperation = 'destination-out'; n.drawImage(S.buf, 0, 0, bw, bh, 0, 0, F.w, F.h);
      if (rec.carried.some(c => c.tint)) { n.globalCompositeOperation = 'source-over'; n.drawImage(S.tb, 0, 0, bw, bh, 0, 0, F.w, F.h); }
      n.restore();

      entities(F, cfg); cullAO(view);
      ST.lamps = nl; if (nl > ST.lampsMax) ST.lampsMax = nl; ST.carried = rec.carried.length; ST.peers = np; if (ST.rays > ST.raysMax) ST.raysMax = ST.rays;
      const ms = now() - t0; ST.ms[ST.n % ST.ms.length] = ms; ST.n++; if (ms > ST.max) ST.max = ms; ST.frames++;
      if (ST.frames % 15 === 0) debugPanel();
      return true;
    } catch (e) { disable('frame error', e); return false; }
  }
  /* one carried light: its beam (or omni) clipped to its own visibility, its angular profile, its colour tint; then its hand glow */
  function carried(Lc, F, cfg, k, view, rec) {
    const sx = S.sx, f = Lc.f, R = f.range, sc = TIERS[S.quality].scale, w = Lc.w ?? 1;
    const bxp = (Lc.x * F.r + F.ox) * sc, byp = (Lc.y * F.r + F.oy) * sc, rp = R * F.r * sc + 2;
    const bb = [Math.max(0, Math.floor(bxp - rp)), Math.max(0, Math.floor(byp - rp)), Math.min(S.scr.width, Math.ceil(bxp + rp)), Math.min(S.scr.height, Math.ceil(byp + rp))];
    if (bb[2] <= bb[0] || bb[3] <= bb[1]) return;
    const bbw = bb[2] - bb[0], bbh = bb[3] - bb[1];
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.clearRect(bb[0], bb[1], bbw, bbh);
    sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc);
    const power = f.power * (f.omni ? Lc.fl : 1) * w, h = f.arc / 2 + .02;
    const poly = f.omni ? visPoly(Lc.x, Lc.y, R, -Math.PI, Math.PI, cfg.omniRays, false) : visPoly(Lc.x, Lc.y, R, Lc.ang - h, Lc.ang + h, cfg.beamRays, true);
    sx.save(); path(sx, poly); sx.clip();
    const g = sx.createRadialGradient(Lc.x, Lc.y, 6, Lc.x, Lc.y, R); g.addColorStop(0, rgba(power)); g.addColorStop(.25, rgba(power * .83)); g.addColorStop(.7, rgba(power * .28)); g.addColorStop(1, rgba(0));
    sx.fillStyle = g; sx.fillRect(Lc.x - R, Lc.y - R, R * 2, R * 2); sx.restore();
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
    /* the light it adds */
    const bx = S.bx; bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, bb[0], bb[1], bbw, bbh, bb[0], bb[1], bbw, bbh); bx.restore();
    /* its colour over the lit area (v23.3.6 tints a carried beam with its colour) */
    let tint = false;
    if (Lc.color && /^#[0-9a-f]{6}$/i.test(Lc.color)) {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = Lc.color; sx.fillRect(bb[0], bb[1], bbw, bbh); sx.globalCompositeOperation = 'source-over';
      const tx = S.tx; tx.save(); tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalAlpha = f.omni ? TINT.omni : TINT.beam; tx.drawImage(S.scr, bb[0], bb[1], bbw, bbh, bb[0], bb[1], bbw, bbh); tx.restore(); tint = true;
    }
    /* the hand glow: a small omni light at the source, blocked by walls like the rest */
    const gp = visPoly(Lc.x, Lc.y, Lc.glowR, -Math.PI, Math.PI, TIERS[S.quality].glowRays, false);
    bx.save(); path(bx, gp); bx.clip();
    const gg = bx.createRadialGradient(Lc.x, Lc.y, 6, Lc.x, Lc.y, Lc.glowR); gg.addColorStop(0, rgba(Lc.glowA * w)); gg.addColorStop(.25, rgba(Lc.glowA * .83 * w)); gg.addColorStop(.7, rgba(Lc.glowA * .28 * w)); gg.addColorStop(1, rgba(0));
    bx.fillStyle = gg; bx.fillRect(Lc.x - Lc.glowR, Lc.y - Lc.glowR, Lc.glowR * 2, Lc.glowR * 2); bx.restore();
    rec.carried.push({ x: Lc.x, y: Lc.y, ang: Lc.ang, R, arc: f.arc, omni: !!f.omni, power, poly, glow: gp, glowR: Lc.glowR, glowA: Lc.glowA * w, own: !!Lc.own, tint });
  }

  /* ---------- the static wall grounding and one dominant-light blob per entity (SH7 donor, ADAPT) ---------- */
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
    buildVerts();
    const fall = u => Math.pow(1 - clamp(u, 0, 1), AO.power), n = AO.steps, q = 48, b = 64;
    S.tex = { down: canvasTex(2, n, (i, j) => fall((j + .5) / n)), up: canvasTex(2, n, (i, j) => fall((n - j - .5) / n)), right: canvasTex(n, 2, i => fall((i + .5) / n)), left: canvasTex(n, 2, i => fall((n - i - .5) / n)),
      se: canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, j + .5) / q)), sw: canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, j + .5) / q)), ne: canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, q - j - .5) / q)), nw: canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, q - j - .5) / q)),
      blob: canvasTex(b, b, (i, j) => { const r = Math.hypot(i + .5 - b / 2, j + .5 - b / 2) / (b / 2); return r >= 1 ? 0 : Math.pow(1 - r * r, 1.7); }) };
    const root = new S.C(); root.label = 'br-role';
    for (const nm of ['ao', 'ents']) { const c = new S.C(); c.label = 'br-role-' + nm; root.addChild(c); S.layers[nm] = c; }
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
  const smoothed = new WeakMap();
  function blob(i) { let g = S.pool[i]; if (g) return g; g = new S.G(); g.texture(S.tex.blob, 0xffffff, -1, -1, 2, 2); g.label = 'br-role-ent'; S.layers.ents.addChild(g); S.pool[i] = g; return g; }
  function seen(V, x, y) { const dx = x - V.x, dy = y - V.y, d = Math.hypot(dx, dy); if (d < 30) return true; if (d > ENT.sight) return false; return window.__api.Uc(V.x, V.y, Math.atan2(dy, dx), d) >= d - 20; }
  function entities(F, cfg) {
    const A = window.__api, L = window.__light, V = F.viewer, max = cfg.ents; let n = 0;
    const dt = S.lastT ? clamp((now() - S.lastT) / 1000, 0, .25) : .016; S.lastT = now();
    if (L && L.sample && V) {
      const kk = 1 - Math.exp(-dt / ENT.tau);
      const cast = (v, x, y, kind, heading, alphaMul, isSelf) => {
        if (n >= max || !(alphaMul > .01) || !Number.isFinite(x + y)) return;
        if (!isSelf && !seen(V, x, y)) { smoothed.delete(v); return; }       // only what the local player can actually see
        const s = L.sample(x, y, F.on), wgt = clamp(s.direct * 2.2, 0, 1);
        let m = smoothed.get(v); if (!m) { m = { x: 0, y: 0, f: -9 }; smoothed.set(v, m); }
        const q = m.f === ST.frames - 1 ? kk : 1; m.f = ST.frames;
        m.x += (-s.dirX * wgt - m.x) * q; m.y += (-s.dirY * wgt - m.y) * q;    // away from the dominant light
        const str = Math.hypot(m.x, m.y); if (str < .02) return;
        const ux = m.x / str, uy = m.y / str, P = ENT[kind], ang = Math.atan2(uy, ux), phi = heading === null ? 0 : ang - heading, cs = Math.cos(phi), sn = Math.sin(phi);
        const along = Math.sqrt((P.la * cs) ** 2 + (P.lb * sn) ** 2), across = Math.sqrt((P.la * sn) ** 2 + (P.lb * cs) ** 2), ext = P.len * str, g = blob(n++);
        g.visible = true; g.position.set(x + ux * ext * .5, y + uy * ext * .5); g.rotation = ang; g.scale.set(along + ext * .5, across * .92); g.alpha = clamp(P.a * Math.min(1, str * 1.25) * alphaMul, 0, 1);
      };
      const P = S.person; if (P && P.visible && P.parent) cast(P, P.x, P.y, 'player', null, P.alpha, true);
      const cr = A.layer && A.layer();
      if (cr && cr.children) for (const v of cr.children) {
        if (n >= max) break; if (!v || !v.visible || !(v.alpha > .01) || v.__smiler) continue;   // never a Smiler: no body may be implied
        if (v.__hound) cast(v, v.x, v.y, 'hound', v.rotation - Math.PI / 2, v.alpha, false);
        else if (typeof v.deathPose === 'function') cast(v, v.x, v.y, 'player', null, v.alpha, false);
      }
    }
    for (let i = n; i < S.pool.length; i++) if (S.pool[i].visible) S.pool[i].visible = false;
    ST.ents = n;
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
    S.dbgEl.textContent = `BR-RoLE ${VERSION}  ${S.quality.toUpperCase()}  buffer ${ST.buf[0]}x${ST.buf[1]} (x${c.scale})\nlamps ${ST.lamps}/${c.lamps}  carried ${ST.carried} (peers ${ST.peers}/${c.peers})  rays ${ST.rays}\nlamp polygons ${S.lampPoly.size} built ${ST.lampBuilds} (${ST.lampBuildMs.toFixed(1)} ms)  entity blobs ${ST.ents}\nframe ${m.mean} ms avg  ${m.max} ms max`;
  }

  /* what the compositor puts at a world point this frame, light by light (tests / debug; reads nothing from the canvas) */
  function inPoly(p, x, y, fan) { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function probe(x, y) {
    const L = S.last; if (!L) return null; const A = window.__api, lamps = A.lamps || [], out = { lamps: [], carried: [] };
    for (const l of L.lamps) { const lp = lamps[l.i], r = Math.hypot(x - lp.x, y - lp.y); out.lamps.push({ i: l.i, visible: inPoly(l.poly, x, y), light: inPoly(l.poly, x, y) ? l.p * lampFall(r) : 0 }); }
    for (const c of L.carried) {
      const d = Math.hypot(x - c.x, y - c.y), vis = inPoly(c.poly, x, y), da = Math.atan2(y - c.y, x - c.x) - c.ang, ph = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      const beam = vis ? c.power * beamGrad(d, c.R) * (c.omni ? 1 : beamProfile(ph, c.arc)) : 0, glow = d < c.glowR && inPoly(c.glow, x, y) ? c.glowA * beamGrad(d, c.glowR) : 0;
      out.carried.push({ own: c.own, visible: vis, light: beam + glow });
    }
    out.total = Math.min(1, out.lamps.reduce((s, l) => s + l.light, 0) + out.carried.reduce((s, l) => s + l.light, 0));
    return out;
  }

  function on() { return !S.legacy && !S.disabled && (!!S.verts || attach()); }   // the game draws its own lighting until BR-RoLE is attached
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
      lamps: { last: ST.lamps, max: ST.lampsMax, cap: TIERS[S.quality].lamps, polygons: S.lampPoly.size, builds: ST.lampBuilds, buildMs: +ST.lampBuildMs.toFixed(2) },
      carried: { last: ST.carried, peers: ST.peers, peerCap: TIERS[S.quality].peers }, rays: { last: ST.rays, max: ST.raysMax }, entityBlobs: ST.ents, vertices: S.verts ? S.verts.length / 2 : 0, errors: ST.errors }),
    resetStats: () => { ST.frames = 0; ST.n = 0; ST.max = 0; ST.lampsMax = 0; ST.raysMax = 0; },
    probe,
    lastFrame: () => S.lastF ? Object.assign({}, S.lastF) : null,      // the world -> overlay mapping BR-RoLE drew with last (tests)
    /* DEV only (comparison, tests): the v23.3.6 lighting instead of BR-RoLE; never offered to players */
    dev: { legacy: v => { if (v !== undefined) { S.legacy = !!v; if (S.root) S.root.visible = !S.legacy; } return S.legacy; } },
  };
})();
