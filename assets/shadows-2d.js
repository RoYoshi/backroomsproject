/* shadows-2d.js - THE FAR BACKROOMS 2D lighting & shadows (presentation only, client only).
 *
 * THE 2D GAME IS THE GAME.  This file only draws soft floor shadows into the existing Pixi world, directly above the
 * carpet and UNDER the level art, the props, every entity and the darkness overlay:
 *   grounding  static, cached ambient occlusion along every wall base, merged along wall runs (no per-tile comb),
 *              split into camera-culled chunks
 *   entities   a soft shadow cast away from the dominant light (__light.sample dirX/dirY) by the local player, other
 *              wanderers and hounds that the local player can actually see.  The art already gives players, corpses
 *              and hounds a centred baked contact shadow; this adds only the light-directional part, so nothing is
 *              drawn twice.  Never for a Smiler: its face-only presentation stays authoritative, no body is implied.
 *   props      counters, shelves, benches, machines... do not stop light in the game (its ray query stops only at walls
 *              and pillars), so their cast shadows are new: the floor shadow of a box lit from a point above the floor,
 *              from the ceiling lamps and from carried lights, thinned where the art already carries a baked drop shadow.
 *   penumbrae  walls and pillars DO stop light in the game: the darkness overlay already cuts every lamp's light off
 *              behind them (a 96-ray polygon per lamp) and every carried light (ray fans), and the line of sight blacks
 *              out the rest.  Those umbrae are never drawn again (no double black).  What a hard cut lacks is the
 *              penumbra of a light that has a size (a 74 px fluorescent tube, a hand-held lamp): from each convex
 *              corner where a light's edge grazes, a soft lip on the LIT side, apex at the corner, darkest at the edge,
 *              bounded in reach and width and fading out along its length (SH7), so it hugs the hard edge.
 * Every cast shadow takes away only its own light: it is filled with that light's strength over the floor (a texture
 * built from the overlay's own formula: the lamp gradient, the beam's glow and nested arcs), placed and turned with the
 * light, so it fades with the beam's cone and range and is nothing where that light does not reach.  Where another light
 * also reaches (a lamp's shadow inside your flashlight beam), the shadow is scaled to its own light's share of the total
 * (SH7 mixed-light composition: another light fills it, exactly as the overlay adds lights).
 * Lamp shadows are built once per lamp and cached; their strength follows the overlay's own lamp power every frame
 * (flicker, failures; nothing in a blackout).  Carried-light shadows (yours and other wanderers') are rebuilt every frame
 * within caps; casters are ranked by the light that reaches them and fade at the cap instead of popping.
 * It is built on the existing lighting foundation: light.js (__light.sample dominant direction / strengths / blackout)
 * and the game's own wall predicate, ray query, lamp list, beam source and equipment light model exposed on __api.
 *
 * What it never does: write game state, send anything on the network, touch the darkness overlay (#light), change an
 * entity's opacity or position, or feed anything to the server - nothing in ai.js / sim.js / server.js can reach it.
 * Shadows are not a sensor and not concealment: AI, LOS, collision, picking and visibility are exactly v23.3.6.
 * Any internal error switches the module off for the session; the game then renders exactly as v23.3.6.
 *
 * Quality: OFF / LOW / MEDIUM / HIGH (SETTINGS > CUSTOMIZE > SHADOWS, or ?shadows=off|low|medium|high; remembered per device).
 * window.__shadows = { quality(), setQuality(q), stats(), resetStats(), debug(on), snapshot(), version } */
(() => {
  'use strict';
  if (window.__shadows) return;
  const VERSION = 'shadows-2d 1.2';
  const T = 96, CHUNK = 16, BUCKET = 384;                                  // level cell; AO chunk (cells); caster index bucket (px)
  const QUALITIES = ['off', 'low', 'medium', 'high'];
  /* per-quality budgets.  Every per-frame pass is capped and camera-culled; nothing scales with the size of the map.
   *   lamps/lampK/lampJ   lamps shown, prop samples along the tube, penumbra sub-wedges per corner (0: none)
   *   localK/localMax/localC/localJ   your light: prop samples, props, corners, sub-wedges
   *   peers/peerK/peerMax/peerC/peerJ  other wanderers' lights (the nearest `peers`), the same per light
   *   budget   dynamic polygons per frame (all carried lights together); builds: lamp caches built per frame */
  const TIERS = {
    off: { ao: false, ents: 0, lamps: 0, local: false, peers: 0, budget: 0 },
    low: { ao: true, ents: 6, lamps: 2, lampK: 2, lampJ: 2, builds: 1, local: true, localK: 1, localMax: 3, localC: 4, localJ: 1,
      peers: 0, peerK: 1, peerMax: 0, peerC: 0, peerJ: 0, budget: 40, bands: 2, fillPeers: 1, fillAll: false },
    medium: { ao: true, ents: 12, lamps: 5, lampK: 3, lampJ: 3, builds: 1, local: true, localK: 3, localMax: 6, localC: 8, localJ: 3,
      peers: 2, peerK: 2, peerMax: 4, peerC: 4, peerJ: 2, budget: 300, bands: 3, fillPeers: 2, fillAll: false },
    high: { ao: true, ents: 20, lamps: 9, lampK: 4, lampJ: 4, builds: 2, local: true, localK: 4, localMax: 10, localC: 12, localJ: 4,
      peers: 4, peerK: 3, peerMax: 6, peerC: 6, peerJ: 3, budget: 900, bands: 4, fillPeers: 4, fillAll: true },
  };
  /* SH7 tier policy (human-QA correction pack): OFF draws nothing.  LOW: cached grounding, at most 2 lamp caches and 3 props +
   * 4 corners of your light, one dominant-light blob per entity; lamp shadows inside your beam (or the nearest other
   * wanderer's) are filled by it.  MEDIUM (the primary target): the same with more casters, two other wanderers' lights.
   * HIGH: higher bounded budgets, finer penumbra bands, up to four other wanderers' lights filling lamp shadows, and your
   * light's shadows also give way to other wanderers' beams that cross them (fillAll).  Not enabled at any tier: lamps
   * filling each other's shadows or your light's - measured, it made HIGH 35 % (lamp) and 54 % (flashlight) lighter than
   * MEDIUM in a lamp-lit room, i.e. fainter, not richer.  bands: penumbra length bands; fillPeers: other wanderers'
   * lights that fill lamp shadows.  Lighting itself (the overlay) is the same at every tier: tiers only change the added
   * shadows. */
  /* art constants (world px).  The level is dark and the overlay does the heavy darkening.
   * SH5 (human QA of 1.0: "the shadows are VERY faint", "not noticeable"): every class was retuned on its own, by what a
   * shadow takes away where the player can see (relative darkening of the lit floor), never past ~.8 (no opaque black):
   *   grounding   wider (30 -> 50 px), a softer falloff (1.7 -> 1.35) and stronger at the base (.38 -> .56)
   *   entities    stronger and a little longer (player .26 -> .38, hound .30 -> .42)
   *   props       the composed strength is set directly (tail / near), independent of the sample count, so a tier with
   *               more samples is softer-edged, not darker; next to a prop your light loses ~80 % of its own light, a
   *               lamp ~75 % (the overlay then paints a carried light's colour tint over the beam, which keeps any of
   *               it from going black on screen: measured ~.5 darkening at most there)
   *   penumbrae   stronger (lamp .5 -> 1, your light .55 -> 1, others' .45 -> .75) and wider (carried half size 14 -> 22 px):
   *               the hard edge the overlay cuts behind a pillar or corner gets a readable soft side (pillars keep the
   *               level art's own baked contact halo; no grounding is added under them, so nothing doubles)
   *   lamps       hang a little lower for the projection (h 240 -> 180 px): prop shadows ~50 % longer */
  const AO = { width: 50, alpha: .56, steps: 64, power: 1.35 };
  const ENT = { player: { a: .38, la: 17, lb: 17, len: 84 }, hound: { a: .42, la: 40, lb: 17, len: 140 }, tau: .12, sight: 700 };
  /* lamps: a fluorescent fixture is a horizontal tube (74 x 13 px of light), so its shadows have penumbrae: hx/hy are the
   * half sizes seen across a shadow edge, the jitter samples spread a prop's shadow along the tube.  A shadow's strength
   * is mapped from the lamp's own cut-out alpha c at that spot as sat(c) = A0·c / (1 − A0 + A0·c): the share of the light
   * there that is the lamp's (A0 = .92: the overlay's darkness near a wanderer after its ambient glow), scaled down by
   * wall / prop to stay restrained.  Geometry is baked at the lamp's nominal power p0, the frame alpha is p(t) / p0. */
  const LAMP = { R: 380, h: 180, wall: 1, prop: { tail: .52, near: .76, core: .5 }, hx: 30, hy: 6, A0: .92, jitter: [[[0, 0]], [[-22, -3], [22, 3]], [[-26, -3], [0, 0], [26, 3]], [[-30, -4], [-10, 4], [10, -4], [30, 4]]] };
  const lampP0 = i => i % 13 === 0 ? .19 : .43;                             // the overlay's brightest cut-out for a lamp (dim fixtures flicker .13-.19)
  const sat = c => LAMP.A0 * c / (1 - LAMP.A0 + LAMP.A0 * c);
  /* penumbra wedges: sub-wedge weights (inner = at the shadow edge, outer = toward the light), the grazing test probes
   * (px beyond the corner / to each side), the grazing fade (|cos| between the ray and the corner's diagonal), angle limits */
  const FRINGE = { 1: [.4], 2: [.5, .2], 3: [.6, .32, .12], 4: [.62, .42, .24, .09] };
  const FR = { probe: 6, side: 3, graze: .72, soft: .25, min: .05, max: .32, near: 40, nearSoft: 120,
    /* SH7 (human QA: "giant triangular wedges across the floor"): a penumbra is a soft lip that hugs the overlay's hard edge,
     * bounded in reach (lamps 130 px, carried lights 110 px from the corner, was up to the light's range: 312 / 390 px) and
     * far width (22 / 26 px, was up to 103 / 130 px), fading out along its length as (1 − t)^fade */
    lampLen: 130, lampW: 22, carryLen: 110, carryW: 26, fade: 1.25 };
  /* carried lights: presentation heights of the light (for prop projection), strengths, penumbra half size, ranking softness */
  const CARRY = { h: { flashlight: 105, headlamp: 160, lantern: 85 }, prop: { tail: .55, near: .8, core: .6 }, peerProp: { tail: .4, near: .62, core: .6 },
    fringe: 1, peerFringe: .75, half: 22, kmax: 2.2, jr: 5, soft: .05 };
  /* light textures: N x N texels covering ext x the light's range on each side (power of two: they repeat, see lightFill) */
  const COOKIE = { n: 128, ext: 1.25 };
  /* props: presentation heights (px, floor = 0) and how solid they look; baked drop-shadow offsets copied from world.js drawProp
   * (detected so a dynamic shadow never doubles the baked one: it is thinned where it falls on the baked side) */
  const PROP = {
    counter: { h: 70, a: 1, b: [4, 7] }, shelf: { h: 46, a: 1, b: [5, 8] }, lowwall: { h: 84, a: 1, b: [4, 7] }, railing: { h: 60, a: .35, b: null },
    machine: { h: 96, a: 1, b: [5, 8] }, table: { h: 76, a: .7, b: [5, 9] }, bench: { h: 46, a: .85, b: [4, 8] }, window: { h: 40, a: 1, b: [3, 5] },
  };

  const LS_KEY = 'tfb.shadows.quality';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const now = () => performance.now();
  const BLACK = 0x000000;

  /* ---------- quality choice: URL > remembered > device default (touch / small screen -> LOW) ---------- */
  function initialQuality() {
    try { const q = new URLSearchParams(location.search).get('shadows'); if (q && QUALITIES.includes(q.toLowerCase())) return q.toLowerCase(); } catch (e) { }
    try { const q = localStorage.getItem(LS_KEY); if (q && QUALITIES.includes(q)) return q; } catch (e) { }
    let coarse = false; try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { }
    return coarse || Math.min(screen.width || 9999, screen.height || 9999) < 600 ? 'low' : 'medium';
  }

  /* ---------- state ---------- */
  const S = {
    quality: initialQuality(), attached: false, disabled: '', attachTries: 0,
    world: null, root: null, layers: {}, G: null, C: null, Tex: null, tex: {}, FBW: 0, FBH: 0, chunks: [],
    corners: [], wallCorners: 0, cgrid: new Map(), pillars: [], props: [], lampCache: new Map(), dyn: null, dynFr: null,
    person: null, frameTs: 0, aoRuns: 0, aoQuads: 0, aoVisible: 0, pool: [], debugOn: false, debugCv: null, debugBtn: null, dbg: null,
  };
  const ST = { frames: 0, ms: new Float32Array(1024), n: 0, max: 0, lights: 0, lightsMax: 0, cand: 0, candMax: 0, active: 0, activeMax: 0, prims: 0, primsMax: 0,
    ents: 0, entsMax: 0, cacheHits: 0, cacheMisses: 0, lampBuilds: 0, lampBuildMs: 0, lampBuildMax: 0, staticBuilds: 0, staticBuildMs: 0, errors: 0, dyn: 0, dynMax: 0,
    fringes: 0, props: 0, fillEval: 0 };
  function resetStats() { ST.frames = 0; ST.n = 0; ST.max = 0; ST.lightsMax = ST.candMax = ST.activeMax = ST.primsMax = ST.entsMax = ST.dynMax = 0; ST.cacheHits = ST.cacheMisses = 0; ST.lampBuildMax = 0; }
  function msStats() {
    const k = Math.min(ST.n, ST.ms.length); if (!k) return { mean: 0, p95: 0, max: 0, n: 0 };
    const a = Array.from(ST.ms.subarray(0, k)).sort((x, y) => x - y); let s = 0; for (const v of a) s += v;
    return { mean: +(s / k).toFixed(4), p95: +a[Math.min(k - 1, Math.floor(.95 * (k - 1) + .5))].toFixed(4), max: +ST.max.toFixed(4), n: k };
  }

  /* the frame timestamp the game itself uses (all rAF callbacks of a frame share it; this loop is registered first) */
  const tick = ts => { S.frameTs = ts; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  function disable(why, e) {
    if (S.disabled) return; S.disabled = why; ST.errors++;
    try { console.warn('[shadows-2d] disabled:', why, e && String(e.stack || e).slice(0, 300)); } catch (x) { }
    try { if (S.root && S.root.parent) S.root.parent.removeChild(S.root); } catch (x) { }
    try { if (S.debugCv) S.debugCv.remove(); if (S.debugBtn) S.debugBtn.remove(); } catch (x) { }
  }

  /* ---------- soft textures (built once from tiny canvases; black + alpha only) ---------- */
  function canvasTex(w, h, alphaAt) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.data[(j * w + i) * 4 + 3] = Math.round(255 * clamp(alphaAt(i, j), 0, 1));
    x.putImageData(img, 0, 0);
    return S.Tex.from(c);
  }
  const fall = u => Math.pow(1 - clamp(u, 0, 1), AO.power);
  function buildTextures() {
    const n = AO.steps, q = 48, b = 64;
    S.tex.down = canvasTex(2, n, (i, j) => fall((j + .5) / n));           // dark at the top edge: floor BELOW a wall
    S.tex.up = canvasTex(2, n, (i, j) => fall((n - j - .5) / n));          // floor ABOVE a wall
    S.tex.right = canvasTex(n, 2, i => fall((i + .5) / n));                 // floor RIGHT of a wall
    S.tex.left = canvasTex(n, 2, i => fall((n - i - .5) / n));              // floor LEFT of a wall
    S.tex.se = canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, j + .5) / q));      // quarter blobs round off an outer wall corner
    S.tex.sw = canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, j + .5) / q));
    S.tex.ne = canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, q - j - .5) / q));
    S.tex.nw = canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, q - j - .5) / q));
    S.tex.blob = canvasTex(b, b, (i, j) => { const r = Math.hypot(i + .5 - b / 2, j + .5 - b / 2) / (b / 2); return r >= 1 ? 0 : Math.pow(1 - r * r, 1.7); });
    S.tex.carry = {};
  }

  /* ---------- light textures: a light's own strength over the floor, so a shadow takes away exactly that light ----------
   * Black, alpha = sat(cut-out), in the light's own frame (beam along +x): the share of the light at that spot that is
   * this light's (see LAMP).  Lamps: the lamp gradient at p0.  Carried lights: the overlay's own cut-out for that
   * equipment - drawLight's 52 px glow (.35) and its 12 nested arcs of 1 − (1 − power)^(1/12) each (or one omni
   * gradient), radial stops 1 / .83 / .28 / 0 at 6 px, 25 %, 70 %, 100 % - composed the way destination-out composes
   * them.  Built once per kind, on first use.  A shadow then removes a fixed fraction (k) of its light, near or far. */
  const beamGrad = (d, r) => { const s = clamp((d - 6) / (r - 6), 0, 1); return s <= .25 ? 1 - .17 * s / .25 : s <= .7 ? .83 - .55 * (s - .25) / .45 : .28 * (1 - (s - .7) / .3); };
  function cookie(E, at) { const N = COOKIE.n; return { tex: canvasTex(N, N, (i, j) => at(((i + .5) / N - .5) * 2 * E, ((j + .5) / N - .5) * 2 * E)), E, N }; }
  function lampCookie(i) {
    const k = i % 13 === 0 ? 'lampDim' : 'lamp'; if (S.tex[k]) return S.tex[k];
    const p0 = lampP0(i); return (S.tex[k] = cookie(LAMP.R * COOKIE.ext, (x, y) => sat(p0 * lampFall(Math.hypot(x, y)))));
  }
  function carryCookie(kind) {
    if (S.tex.carry[kind] !== undefined) return S.tex.carry[kind];
    const f = (window.__api.Gc || {})[kind]; if (!f || f.nv || !(f.range > 1)) return (S.tex.carry[kind] = null);
    const e = 1 - Math.pow(1 - f.power, 1 / 12);
    return (S.tex.carry[kind] = cookie(f.range * COOKIE.ext, (x, y) => {
      const d = Math.hypot(x, y); let keep = 1 - (d < 52 ? .35 * beamGrad(d, 52) : 0);
      if (d < f.range) {
        if (f.omni) keep *= 1 - f.power * beamGrad(d, f.range);
        else { const phi = Math.abs(Math.atan2(y, x)); let n = 0; for (let t = 0; t < 12; t++) if (phi <= f.arc * (1 - t * .063) / 2) n++; keep *= Math.pow(1 - e * beamGrad(d, f.range), n); }
      }
      return sat(1 - keep);                                                 // the share of the light there that is this light's (see LAMP)
    }));
  }
  /* a Pixi fill that lays a light texture over the floor at the light, turned to its aim (texture px -> world px).  Pixi
   * keeps the style and switches a fill texture to repeat: the texture is zero well before its edges, so a repeat is nothing */
  function lightFill(ck, x, y, ang) {
    const s = 2 * ck.E / ck.N, C = Math.cos(ang) * s, Sn = Math.sin(ang) * s, h = ck.N / 2;
    return { texture: ck.tex, matrix: { a: C, b: Sn, c: -Sn, d: C, tx: x - h * (C - Sn), ty: y - h * (Sn + C) }, textureSpace: 'global' };
  }

  /* ---------- attach to the shipped renderer (no bundle edit: found through __api.floor().parent) ---------- */
  function attach() {
    const A = window.__api; if (!A || typeof A.floor !== 'function' || typeof A.Hc !== 'function' || typeof A.Uc !== 'function') return false;
    const floor = A.floor(), world = floor && floor.parent; if (!world || !world.children) return false;
    const kids = world.children, ci = kids.findIndex(c => c && c.tileScale && c.texture), level = kids[ci + 1];
    if (ci < 0 || !level || !level.context || typeof level.texture !== 'function') { disable('renderer layout not recognised'); return false; }
    S.world = world; S.G = level.constructor; S.C = floor.constructor; S.Tex = kids[ci].texture.constructor;
    if (typeof S.Tex.from !== 'function') { disable('texture factory unavailable'); return false; }
    S.FBW = Math.round(kids[ci].width / T); S.FBH = Math.round(kids[ci].height / T);
    if (!(S.FBW > 0 && S.FBH > 0)) { disable('level size unavailable'); return false; }
    S.person = kids.find(c => c && c !== floor && typeof c.deathPose === 'function') || null;
    buildTextures();
    const root = new S.C(); root.label = 'shadows-2d';
    for (const name of ['ao', 'lamps', 'cast', 'ents']) { const c = new S.C(); c.label = 'shadows-' + name; root.addChild(c); S.layers[name] = c; }
    S.dyn = new S.G(); S.dyn.label = 'shadows-cast-props'; S.layers.cast.addChild(S.dyn);
    S.dynFr = new S.G(); S.dynFr.label = 'shadows-cast-penumbrae'; S.layers.cast.addChild(S.dynFr);
    world.addChildAt(root, ci + 1);                                       // right above the carpet: under walls, props, items, corpses, entities
    S.root = root; S.attached = true;
    buildAO();
    buildOccluders();
    applyQuality();
    return true;
  }

  /* ---------- grounding: ambient occlusion strips along merged wall runs (built once; chunked for camera culling) ----------
   * The same pass records every convex wall corner (the corners a light's edge can graze): its position and the diagonal
   * pointing into the wall. */
  function buildAO() {
    const t0 = now(), A = window.__api, W = S.FBW, H = S.FBH, w = AO.width;
    const wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : !!A.Hc(x, y);   // walls only: pits are floor holes, not occluders
    const nx = Math.ceil(W / CHUNK), ny = Math.ceil(H / CHUNK), chunks = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const g = new S.G(); g.label = `shadows-ao-${i}-${j}`; g.alpha = AO.alpha; chunks.push({ g, i, j, quads: 0, x0: i * CHUNK * T - w, y0: j * CHUNK * T - w, x1: (i + 1) * CHUNK * T + w, y1: (j + 1) * CHUNK * T + w }); }
    const chunkOf = (cx, cy) => chunks[Math.min(ny - 1, Math.floor(cy / CHUNK)) * nx + Math.min(nx - 1, Math.floor(cx / CHUNK))];
    let runs = 0, quads = 0; const corners = [], D = Math.SQRT1_2;
    const put = (cx, cy, tex, x, y, ww, hh) => { const c = chunkOf(cx, cy); c.g.texture(tex, 0xffffff, x, y, ww, hh); c.quads++; quads++; };
    const corner = (x, y, qx, qy) => corners.push({ x, y, qx: qx * D, qy: qy * D, i: corners.length, pl: -1 });
    const brk = v => v % CHUNK === CHUNK - 1;                               // runs never cross a chunk border
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) {                  // floor below a wall
      if (wall(x, y) && !wall(x, y + 1)) { let e = x; while (!brk(e) && e + 1 < W && wall(e + 1, y) && !wall(e + 1, y + 1)) e++; put(x, y + 1, S.tex.down, x * T, (y + 1) * T, (e - x + 1) * T, w); runs++; x = e + 1; } else x++;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) {                  // floor above a wall
      if (wall(x, y) && !wall(x, y - 1)) { let e = x; while (!brk(e) && e + 1 < W && wall(e + 1, y) && !wall(e + 1, y - 1)) e++; put(x, y - 1, S.tex.up, x * T, y * T - w, (e - x + 1) * T, w); runs++; x = e + 1; } else x++;
    }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) {                  // floor right of a wall
      if (wall(x, y) && !wall(x + 1, y)) { let e = y; while (!brk(e) && e + 1 < H && wall(x, e + 1) && !wall(x + 1, e + 1)) e++; put(x + 1, y, S.tex.right, (x + 1) * T, y * T, w, (e - y + 1) * T); runs++; y = e + 1; } else y++;
    }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) {                  // floor left of a wall
      if (wall(x, y) && !wall(x - 1, y)) { let e = y; while (!brk(e) && e + 1 < H && wall(x, e + 1) && !wall(x - 1, e + 1)) e++; put(x - 1, y, S.tex.left, x * T - w, y * T, w, (e - y + 1) * T); runs++; y = e + 1; } else y++;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {             // outer wall corners: a quarter blob closes the gap between two strips
      if (!wall(x, y)) continue; const cx = x * T, cy = y * T;
      if (!wall(x + 1, y) && !wall(x, y + 1) && !wall(x + 1, y + 1)) { put(x + 1, y + 1, S.tex.se, cx + T, cy + T, w, w); corner(cx + T, cy + T, -1, -1); }
      if (!wall(x - 1, y) && !wall(x, y + 1) && !wall(x - 1, y + 1)) { put(x - 1, y + 1, S.tex.sw, cx - w, cy + T, w, w); corner(cx, cy + T, 1, -1); }
      if (!wall(x + 1, y) && !wall(x, y - 1) && !wall(x + 1, y - 1)) { put(x + 1, y - 1, S.tex.ne, cx + T, cy - w, w, w); corner(cx + T, cy, -1, 1); }
      if (!wall(x - 1, y) && !wall(x, y - 1) && !wall(x - 1, y - 1)) { put(x - 1, y - 1, S.tex.nw, cx - w, cy - w, w, w); corner(cx, cy, 1, 1); }
    }
    S.layers.ao.removeChildren(); S.chunks = chunks.filter(c => c.quads > 0);
    for (const c of S.chunks) S.layers.ao.addChild(c.g);
    S.corners = corners; S.wallCorners = corners.length; S.aoRuns = runs; S.aoQuads = quads; ST.staticBuilds++; ST.staticBuildMs = +(now() - t0).toFixed(2);
  }
  function cullAO(rect) {
    let n = 0;
    for (const c of S.chunks) { const v = c.x1 > rect.x0 && c.x0 < rect.x1 && c.y1 > rect.y0 && c.y0 < rect.y1; if (c.g.visible !== v) c.g.visible = v; if (v) n++; }
    S.aoVisible = n;
  }

  /* ---------- casters (built once): pillars (found through the game's own Bc), their corners, a bucket index, props ---------- */
  function buildOccluders() {
    const A = window.__api, D = Math.SQRT1_2;
    S.corners.length = S.wallCorners;
    const seen = new Set(); S.pillars = [];                                  // pillars: the 56 px full-height columns the ray query also stops at
    if (typeof A.Bc === 'function') for (let y = 96; y < S.FBH * T; y += 192) for (let x = 96; x < S.FBW * T; x += 192) {
      let l = null; try { l = A.Bc(x, y); } catch (e) { l = null; }
      if (l) for (const r of l) if (r && r.w === 56 && r.h === 56) { const k = r.x + ',' + r.y; if (!seen.has(k)) { seen.add(k); S.pillars.push({ x: r.x, y: r.y, w: r.w, h: r.h }); } }
    }
    S.pillars.sort((a, b) => a.y - b.y || a.x - b.x);
    S.pillars.forEach((p, n) => {                                           // a pillar's four corners, diagonals pointing into it
      p.n = n; p.corners = [[p.x, p.y, 1, 1], [p.x + p.w, p.y, -1, 1], [p.x + p.w, p.y + p.h, -1, -1], [p.x, p.y + p.h, 1, -1]]
        .map(([x, y, qx, qy]) => { const c = { x, y, qx: qx * D, qy: qy * D, i: S.corners.length, pl: n }; S.corners.push(c); return c; });
    });
    const grid = S.cgrid; grid.clear();
    for (const c of S.corners) { const k = Math.floor(c.y / BUCKET) * 4096 + Math.floor(c.x / BUCKET); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(c); }
    const W = window.WORLD; S.props = [];
    if (W && Array.isArray(W.PROPS)) for (const p of W.PROPS) {
      const d = PROP[p.kind]; if (!d || !p.rect || p.type === 'gap') continue;
      const r = p.rect, b = d.b; S.props.push({ n: S.props.length, id: p.id, kind: p.kind, x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2, hp: d.h, a: d.a, bakedAng: b ? Math.atan2(b[1], b[0]) : null });
    }
  }
  /* corners inside the light's square (each corner lives in exactly one bucket); index order: a stable result */
  function cornersNear(x, y, R, out) {
    out.length = 0; const x0 = Math.floor((x - R) / BUCKET), x1 = Math.floor((x + R) / BUCKET), y0 = Math.floor((y - R) / BUCKET), y1 = Math.floor((y + R) / BUCKET);
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) { const l = S.cgrid.get(by * 4096 + bx); if (l) for (const c of l) if (Math.abs(c.x - x) < R && Math.abs(c.y - y) < R) out.push(c); }
    out.sort((a, b) => a.i - b.i); return out;
  }

  /* ---------- the overlay's own light strengths (drawLight in the bundle), so shadows track what is actually drawn ---------- */
  function lampPower(i, L, t) {                                             // a lamp's cut-out alpha at its centre: dim fixtures (index % 13), failures, NV gain
    const E = window.__ents, C = window.__cam;
    return Math.min(.9, (i % 13 === 0 ? .13 + .06 * Math.max(0, Math.sin(t * 11 + i)) : .43) * (E && E.lamp ? E.lamp(L.x, L.y, t) : 1) * (C && C.lampGain ? C.lampGain() : 1));
  }
  const lampFall = r => r <= 6 ? 1 : r <= 193 ? 1 - .65 * (r - 6) / 187 : r < 380 ? .35 * (1 - (r - 193) / 187) : 0;    // its radial gradient stops (1, .35 at half range, 0)

  /* ---------- SH7 mixed-light composition (human QA: a lamp's shadow stayed dark inside the flashlight beam) ----------
   * The overlay is one black canvas that every light cuts with destination-out, so where lights overlap their cut-outs
   * multiply: darkness D = Π keep_i (keep = 1 − cut).  A shadow that takes away a fraction w of light i turns that light's
   * keep into 1 − c_i(1 − w); drawn under the overlay as black of alpha a, it must darken the floor by exactly
   *     a = w · (c_i / keep_i) · D / (1 − D)                                         (exact, any number of lights)
   * Each light's texture was built with only that light (and the ambient A0) present: w · (c_i / keep_i) · D_i / (1 − D_i)
   * with D_i = A0 · keep_i.  So with the other lights' keep K at the spot, every shadow of light i is scaled by
   *     m = odds(A0 · keep_i · K) / odds(A0 · keep_i) = K (1 − D_i) / (1 − D_i K)        (1 with no other light, → 0 under a strong one)
   * A lamp's shadow under your flashlight is filled by the flashlight's own contribution, and stays as it was outside the
   * beam.  Evaluated per shadow element (a penumbra band, a prop's shadow) at one or two sample points, with the overlay's
   * own formulas (drawLight's lamp gradient and power; its carried glow and 12 nested arcs, clipped by walls with the game's
   * own ray query).  Lamp shadows are filled by the carried lights at every tier; at HIGH a carried light's shadows are also
   * filled by the other carried lights (TIERS).  Nothing is read back from the overlay and nothing about it changes. */
  const fillL = [];                                                         // this frame's carried lights that fill lamp shadows
  function carriedCut(C, x, y) {                                            // the overlay's cut-out of a carried light at a world point
    const dx = x - C.x, dy = y - C.y, d = Math.hypot(dx, dy), f = C.f, glow = d < 52;   // drawLight and drawPeers both add the 52 px hand glow
    if (d >= f.range && !glow) return 0;
    let keep = glow ? 1 - .35 * beamGrad(d, 52) : 1;
    if (d < f.range) {
      if (f.omni) keep *= 1 - f.power * C.fl * beamGrad(d, f.range);
      else { const da = Math.atan2(dy, dx) - C.ang, ph = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))); let n = 0; for (let t = 0; t < 12; t++) if (ph <= f.arc * (1 - t * .063) / 2) n++; if (n) keep *= Math.pow(1 - C.e * beamGrad(d, f.range), n); }
    }
    if (keep > .997) return 0;
    if (d > 3 && window.__api.Uc(C.x, C.y, Math.atan2(dy, dx), d) < d - 2) return 0;   // a wall between: the overlay's ray fan stops there
    return 1 - keep;
  }
  const odds = (ownKeep, K) => { if (K > .997) return 1; const D = LAMP.A0 * ownKeep; return K * (1 - D) / Math.max(1e-6, 1 - D * K); };
  function fillLights(cfg, lightOn) {                                       // your light and the nearest other wanderers' lights, as the overlay draws them
    const A = window.__api, Gc = A.Gc || {}, D = A.death && A.death(); fillL.length = 0; if (!cfg.fillPeers && !cfg.local) return;
    const t = (S.frameTs || now()) / 1000, put = (x, y, ang, kind, own, fl) => {
      const f = Gc[kind]; if (!f || f.nv || !(f.range > 1) || !Number.isFinite(x + y)) return;
      fillL.push({ x, y, ang: ang || 0, f, own, fl: f.omni ? fl : 1, e: 1 - Math.pow(1 - f.power, 1 / 12), h: CARRY.h[kind] || 105 });
    };
    if (lightOn && !(D && D.active)) { const b = (A.beam && A.beam()) || A.H, H = A.H; put(b.x, b.y, b.angle ?? H.angle, (H.equipment && H.equipment.kind) || 'flashlight', true, .93 + Math.sin(t * 17) * .035 + Math.sin(t * 31) * .025); }
    if (cfg.fillPeers > 0 && Array.isArray(window.__peerLights)) {
      const V = viewer(), ps = window.__peerLights.filter(p => p && p.on && !p.dead && p.kind !== 'camcorder' && Number.isFinite(p.x + p.y)).map(p => [Math.hypot(p.x - V.x, p.y - V.y), p]).sort((a, b) => a[0] - b[0]);
      for (let n = 0; n < ps.length && n < cfg.fillPeers; n++) { const p = ps[n][1]; put(p.x, p.y, p.angle, p.kind || 'flashlight', false, .93 + Math.sin(t * 17 + p.x) * .035 + Math.sin(t * 31 + p.y) * .025); }
    }
  }
  /* the game's ray query passes over props (only walls and pillars stop light), so a light that would fill a prop's shadow
   * may itself be shaded there by the same prop: then it does not fill it (both shadows stack, as they should).  Tested
   * against that light's own floor shadow of the prop (its base and projected top, as emitProps draws it) */
  function propShadowed(p, C, x, y) {
    const dx = x - C.x, dy = y - C.y; let t0 = 0, t1 = 1;                   // does the segment from the light to the point cross the prop's footprint?
    for (const [o, dd, lo, hi] of [[C.x, dx, p.x, p.x + p.w], [C.y, dy, p.y, p.y + p.h]]) {
      if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) return false; continue; }
      let a = (lo - o) / dd, b = (hi - o) / dd; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
    }
    const kk = C.h > p.hp + 1 ? Math.min(CARRY.kmax, p.hp / (C.h - p.hp)) : CARRY.kmax; tmpPts.length = 0;
    for (let c = 0; c < 4; c++) { const cx = c === 1 || c === 2 ? p.x + p.w : p.x, cy = c >= 2 ? p.y + p.h : p.y; tmpPts.push(cx, cy, cx + (cx - C.x) * kk, cy + (cy - C.y) * kk); }
    const h = hull(tmpPts); let sg = 0;
    for (let i = 0; i < h.length; i += 2) { const ax = h[i], ay = h[i + 1], bx = h[(i + 2) % h.length], by = h[(i + 3) % h.length], cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (Math.abs(cr) > 1e-9) { if (sg && Math.sign(cr) !== sg) return false; sg = Math.sign(cr); } }
    return true;
  }
  function carriedElementFill(smp, me, prop) {                              // HIGH: a carried light's shadow element, filled by the other carried lights
    let sum = 0, n = 0, any = false;
    for (let k = 0; k < smp.length; k += 2) {
      const x = smp[k], y = smp[k + 1]; let K = 1;
      for (const C of fillL) if (Math.abs(C.x - me.x) + Math.abs(C.y - me.y) > .5 && !(prop && propShadowed(prop, C, x, y))) { const c = carriedCut(C, x, y); if (c > 0) { K *= 1 - c; any = true; } }
      sum += K > .997 ? 1 : odds(1 - carriedCut(me, x, y), K); n++;
    }
    return n && any ? clamp(sum / n, 0, 1) : 1;
  }
  /* the scale m of one lamp element: the mean over its samples of odds(the lamp's keep, the carried lights' keep) */
  function lampElementFill(el, i, Lp, t) {
    let sum = 0, n = 0; const s = el.s;
    for (let k = 0; k < s.length; k += 2) {
      const x = s[k], y = s[k + 1]; let K = 1;
      for (const C of fillL) { if (el.p && propShadowed(el.p, C, x, y)) continue; const c = carriedCut(C, x, y); if (c > 0) K *= 1 - c; }
      sum += K > .997 ? 1 : odds(1 - lampPower(i, Lp, t) * lampFall(Math.hypot(x - Lp.x, y - Lp.y)), K); n++;
    }
    return n ? sum / n : 1;
  }

  /* ---------- shadow geometry ---------- */
  const tmpPts = [], tmpC = [], tmpCI = [], tmpCW = [], tmpP = [], tmpPW = [], tmpEnds = [];
  let polyBudget = 0, polyCount = 0;
  /* pts must be a fresh array (Pixi keeps a reference to it); tf: the light's texture fill (lightFill), or flat black */
  function fillPoly(g, pts, alpha, tf) {
    if (!(alpha > .002) || polyCount >= polyBudget) return false;
    for (let k = 0; k < pts.length; k++) if (!Number.isFinite(pts[k])) return false;
    g.poly(pts).fill(tf ? { texture: tf.texture, matrix: tf.matrix, textureSpace: 'global', color: 0xffffff, alpha: Math.min(1, alpha) } : { color: BLACK, alpha: Math.min(1, alpha) }); polyCount++;
    if (S.dbg && S.dbg.polys) S.dbg.polys.push(pts);
    return true;
  }
  /* is this point lit by the light at all (nothing in between)? the game's own ray query decides */
  function litFrom(L, x, y) {
    const dx = x - L.x, dy = y - L.y, d = Math.hypot(dx, dy); if (d < 2) return true;
    const k = (d - 1.5) / d; return window.__api.Uc(L.x, L.y, Math.atan2(dy, dx), d) >= d - 2.5 || window.__api.Uc(L.x, L.y, Math.atan2(dy * k, dx * k), d - 1.5) >= d - 3;
  }
  /* strict version for points on open floor: nothing at all between the light and the point */
  function clearTo(L, x, y) { const dx = x - L.x, dy = y - L.y, d = Math.hypot(dx, dy); return d < 1 || window.__api.Uc(L.x, L.y, Math.atan2(dy, dx), d) >= d - .25; }
  /* penumbrae of full-height casters (convex wall corners, pillar corners).  A corner whose diagonal (q) is not met
   * head-on is grazed by the light's edge: the wall lies on one side of the ray through it, the lit floor on the other;
   * the probes confirm it against the game's own ray query.  The wedge has its apex at the corner and opens toward the
   * lit side by atan(half size of the light across the edge / distance), split into J sub-wedges (darkest at the edge);
   * the light's texture weights every pixel of it by that light's strength there; each sub-wedge ends where the light
   * along it stops (a far wall, another pillar) or at the light's range.  The umbra side is never touched: the overlay
   * already darkens it. */
  function emitFringes(L, list, wts, o) {
    const Wt = FRINGE[o.J]; if (!Wt) return 0;
    const A = window.__api, J = Wt.length, M = Math.max(1, o.M | 0); let used = 0;
    for (let n = 0; n < list.length; n++) {
      const c = list[n], wc = wts ? wts[n] : 1; if (!(wc > .01)) continue;
      const dx = c.x - L.x, dy = c.y - L.y, d = Math.hypot(dx, dy);
      if (d < 12 || d > L.R - 12) continue;
      const ux = dx / d, uy = dy / d, qd = ux * c.qx + uy * c.qy, wg = clamp((FR.graze - Math.abs(qd)) / FR.soft, 0, 1);
      if (!(wg > .01)) continue;                                            // met head-on, or from behind its own wall: no grazing edge
      const nx = -uy, ny = ux, s = nx * c.qx + ny * c.qy > 0 ? -1 : 1;      // the wall is on the -s side of the ray: the lit side is +s
      const wd = clamp((d - FR.near) / FR.nearSoft, 0, 1), k0 = o.k * wc * wg * wd * wd * (3 - 2 * wd);   // fades out right next to the light
      if (!(k0 > .002)) continue;
      if (!clearTo(L, c.x - c.qx * 1.5, c.y - c.qy * 1.5)) continue;          // the corner itself is in the light (not behind its own wall)...
      if (!clearTo(L, c.x + ux * FR.probe + s * nx * FR.side, c.y + uy * FR.probe + s * ny * FR.side)) continue;   // ...the floor past it on the lit side too...
      if (clearTo(L, c.x + ux * FR.probe - s * nx * FR.side, c.y + uy * FR.probe - s * ny * FR.side)) continue;    // ...and not on the wall side
      /* your light: a corner that comes out from behind another wall or pillar fades in over FADE instead of appearing whole */
      let vis = 1;
      if (o.vis) { let e = o.vis.get(c.i); if (!e || e.f < ST.frames - 1) { e = { v: 0, f: ST.frames }; o.vis.set(c.i, e); } if (e.f !== ST.frames) { e.v += (1 - e.v) * (1 - Math.exp(-clamp(o.dt, 1 / 240, .25) / FADE)); e.f = ST.frames; } vis = e.v; }
      /* SH7 (human QA: "giant geometric wedges"): a soft lip along the hard edge the overlay cuts, not a second shadow cone.
       * Its reach is capped (o.len) and so is its far width (o.w), and it fades out along its length in M bands */
      /* the shape depends only on the light and the corner (never on how far the light runs on: a far wall sweeping across
       * the edge must not reshape the wedge); the rays below trim it where the light stops */
      const th = Math.atan2(uy, ux), half = o.hx * Math.abs(uy) + o.hy * Math.abs(ux), len = Math.min(o.len, L.R - d), kv = k0 * vis;
      if (!(len > 8)) continue;
      const phi = clamp(Math.atan(half / d), FR.min, Math.min(FR.max, Math.atan(o.w / o.len)));
      used++; if (S.dbg) S.dbg.fringes.push(c.x, c.y, th, s * phi, len);
      /* the wedge ends where the light along it stops (another wall or pillar further on): its far edge is sampled on
       * J·m + 1 rays (at least 4), so a far shadow edge sweeping across it trims it a slice at a time, never all at once */
      const m = Math.ceil(3 / J), R = J * m, ends = tmpEnds; ends.length = 0;
      for (let r = 0; r <= R; r++) {
        const a = th + s * (phi * r / R + (r ? 0 : 3 / d)), ca = Math.cos(a), sa = Math.sin(a), fx = c.x + ca * len - L.x, fy = c.y + sa * len - L.y, fd = Math.hypot(fx, fy);   // the edge ray itself would graze the corner
        const fr = A.Uc(L.x, L.y, Math.atan2(fy, fx), fd), l = fr >= fd - .5 ? len : Math.max(0, len * (fr - 3 - d) / Math.max(1, fd - d));
        ends.push(ca, sa, l);
      }
      /* bands along the length (the first one a fan from the corner, the others quads between two distances), slices
       * across it (darkest at the edge); a band's strength falls off as (1 - t)^fade toward the far end */
      for (let b = 0; b < M; b++) {
        const a0 = len * b / M, a1 = len * (b + 1) / M, fade = Math.pow(1 - (b + .5) / M, FR.fade), mid = (a0 + a1) / 2, am = th + s * phi * .5;
        let maxL = 0; for (let r = 0; r <= R; r++) maxL = Math.max(maxL, ends[r * 3 + 2]); if (!(maxL > a0 + 2)) break;
        const lm = Math.max(4, ends[Math.floor(R / 2) * 3 + 2]);
        const grp = o.group([c.x + Math.cos(am) * Math.min(mid, lm), c.y + Math.sin(am) * Math.min(mid, lm)], 'fr'); let drawn = 0;
        for (let j = 0; j < J; j++) {
          const pts = b ? [] : [c.x, c.y]; let far = 0;                       // Pixi keeps the array: a fresh one
          for (let r = j * m; r <= (j + 1) * m; r++) { const l = Math.min(ends[r * 3 + 2], a1); far = Math.max(far, l); pts.push(c.x + ends[r * 3] * l, c.y + ends[r * 3 + 1] * l); }
          if (b) for (let r = (j + 1) * m; r >= j * m; r--) { const l = Math.min(ends[r * 3 + 2], a0); pts.push(c.x + ends[r * 3] * l, c.y + ends[r * 3 + 1] * l); }
          if (far > a0 + 2 && fillPoly(grp.g, pts, kv * Wt[j] * fade * grp.mul, o.tf)) drawn++;
        }
        grp.done(drawn);
      }
    }
    return used;
  }
  /* finite-height casters (props): the floor shadow of a box lit from a point at height h is the hull of its base and its
   * projected top; clamped where a wall stops the light; thinned on the side the art already carries a baked drop shadow;
   * weighted per pixel by the light's texture (o.inten only decides whether the light reaches the prop at all) */
  function hull(pts) {                                                      // monotone chain, pts = flat [x,y,...]
    const P = []; for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); const out = []; for (const p of lo.concat(up)) out.push(p[0], p[1]); return out;
  }
  /* how much of a light reaches a prop: the most at its centre, corners and edge midpoints (a long counter can be lit at
   * one end only; its shadow is then weighted per pixel by the light's texture) */
  function propLight(p, L, inten) {
    let m = 0;
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) { const x = p.x + p.w * i / 2, y = p.y + p.h * j / 2, v = inten(x, y, Math.hypot(x - L.x, y - L.y)); if (v > m) m = v; }
    return m;
  }
  function emitProps(L, props, wts, o) {
    let used = 0; const A = window.__api, hulls = [];
    for (let n = 0; n < props.length; n++) {
      const p = props[n], wp = wts ? wts[n] : 1; if (!(wp > .01)) continue;
      const nx = clamp(L.x, p.x, p.x + p.w), ny = clamp(L.y, p.y, p.y + p.h), dn = Math.hypot(nx - L.x, ny - L.y);
      if (dn >= L.R || (dn < 1 && L.h <= p.hp)) continue;
      if (!litFrom(L, p.cx, p.cy) && !litFrom(L, nx, ny)) continue;
      if (!(propLight(p, L, o.inten) > .004)) continue;                      // the light reaches some part of it
      const ang = Math.atan2(p.cy - L.y, p.cx - L.x), baked = p.bakedAng === null ? 1 : 1 - .45 * Math.max(0, Math.cos(ang - p.bakedAng));
      const kk = L.h > p.hp + 1 ? Math.min(o.kmax, p.hp / (L.h - p.hp)) : o.kmax, a = clamp(o.w * wp * p.a * baked, 0, 1);
      used++; if (S.dbg) S.dbg.props.push(p.x, p.y, p.w, p.h);
      /* a long soft tail per sample along the light, then ONE darker short core from the light's centre (the samples
       * barely differ next to the prop; one core halves the overdraw).  The composed strength is set directly: where all K
       * tails overlap they remove `tail` of the light, next to the prop tails + core remove `near` - whatever K is, so a
       * tier with more samples gets a softer edge, not a darker shadow */
      const K = o.jit.length, T = o.str.tail * a, N = Math.max(T, o.str.near * a), aT = 1 - Math.pow(1 - T, 1 / K), aC = 1 - (1 - N) / (1 - T);
      hulls.length = 0;
      for (let s = 0; s <= K; s++) {
        const core = s === K, lx = core ? L.x : L.x + o.jit[s][0], ly = core ? L.y : L.y + o.jit[s][1];
        const f = core ? o.str.core : 1; tmpPts.length = 0;
        for (let c = 0; c < 4; c++) {
          const cx = c === 1 || c === 2 ? p.x + p.w : p.x, cy = c >= 2 ? p.y + p.h : p.y;
          let tx = cx + (cx - lx) * kk * f, ty = cy + (cy - ly) * kk * f;
          const dx = tx - L.x, dy = ty - L.y, d = Math.hypot(dx, dy), lim = d > 1 ? A.Uc(L.x, L.y, Math.atan2(dy, dx), d) : d;
          if (lim < d - 1) { tx = L.x + dx / d * lim; ty = L.y + dy / d * lim; }
          tmpPts.push(cx, cy, tx, ty);
        }
        hulls.push(hull(tmpPts));
      }
      /* one group per prop; its mixed-light samples: the middle of the core (next to the prop) and of the first tail */
      const smp = []; for (const h of [hulls[K], hulls[0]]) if (h.length >= 6) { let sx = 0, sy = 0; for (let i = 0; i < h.length; i += 2) { sx += h[i]; sy += h[i + 1]; } smp.push(sx / (h.length / 2), sy / (h.length / 2)); }
      const grp = o.group(smp, 'prop', p); let drawn = 0;
      for (let s = 0; s <= K; s++) if (hulls[s].length >= 6 && fillPoly(grp.g, hulls[s], (s === K ? aC : aT) * grp.mul, o.tf)) drawn++;
      grp.done(drawn);
    }
    return used;
  }
  /* rank casters by the light that reaches them; keep `cap`, each weighted by how far it is above the first one left out,
   * so a caster crossing the cap fades instead of popping.  cands = [[importance, stable index, caster], ...] */
  function pickSoft(cands, cap, soft, outI, outW) {
    cands.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const cut = cands.length > cap ? cands[cap][0] : 0; outI.length = 0; outW.length = 0;
    for (let n = 0; n < cands.length && n < cap; n++) { const w = clamp((cands[n][0] - cut) / soft, 0, 1); if (w > .01) { outI.push(cands[n][2]); outW.push(w); } }
  }
  /* your own light: each caster's weight eases toward its rank weight (time constant FADE), so a fast swing of the beam
   * never pops a caster in or out at the cap - one leaving the cap fades out (at most 2 x cap are drawn at once).  When
   * the light comes back on, its casters fade in.  map: key -> { w, t, f, seen, it }; out lists are in key order. */
  const FADE = .1;
  function eased(map, items, wts, keyOf, cap, dt, outI, outW) {
    const f = ST.frames, k = 1 - Math.exp(-clamp(dt, 1 / 240, .25) / FADE);
    for (let n = 0; n < items.length; n++) { const key = keyOf(items[n]); let e = map.get(key); if (!e || (e.f !== f - 1 && e.f !== f)) { e = { w: 0, f }; map.set(key, e); } e.t = wts[n]; e.it = items[n]; e.seen = f; }
    const live = [];
    for (const [key, e] of map) {
      if (e.f !== f - 1 && e.f !== f) { map.delete(key); continue; }       // not drawn last frame (the light was off): start over
      if (e.seen !== f) e.t = 0;                                            // no longer ranked: fade out
      e.w += (e.t - e.w) * k; e.f = f;
      if (e.t === 0 && e.w < .01) { map.delete(key); continue; }
      live.push(e);
    }
    live.sort((a, b) => b.w - a.w || keyOf(a.it) - keyOf(b.it)); if (live.length > 2 * cap) { for (const e of live.slice(2 * cap)) map.delete(keyOf(e.it)); live.length = 2 * cap; }
    live.sort((a, b) => keyOf(a.it) - keyOf(b.it)); outI.length = 0; outW.length = 0;
    for (const e of live) { outI.push(e.it); outW.push(e.w); }
  }
  const visC = new Map();                                                   // your light: each corner's eased visibility (emitFringes)
  const fadeC = new Map(), fadeP = new Map(), tmpEI = [], tmpEW = [], keyC = c => c.i, keyP = p => p.n;

  /* ---------- ceiling lamps: geometry built once per lamp (nominal power), then only its alpha follows the lamp ---------- */
  function lampKey(cfg) { return [S.quality, cfg.lampK, cfg.lampJ, cfg.bands].join(':'); }
  /* a lamp's shadows are cached: one container per lamp (its alpha follows the lamp's power), one Graphics per shadow element
   * (a penumbra band, a prop's shadow) whose alpha is that element's mixed-light scale (1 unless another light fills it) */
  function buildLamp(i, Lp, cfg) {
    const t0 = now(), box = new S.C(); box.label = 'shadows-lamp-' + i;
    const L = { x: Lp.x, y: Lp.y, R: LAMP.R, h: LAMP.h }, p0 = lampP0(i), inten = (x, y, r) => sat(p0 * lampFall(r)), tf = lightFill(lampCookie(i), L.x, L.y, 0);
    const saveBudget = polyBudget, saveCount = polyCount, saveDbg = S.dbg; polyBudget = 1e9; polyCount = 0;
    const rec = S.dbg = { cand: [], fringes: [], props: [], polys: null };   // casters are kept for the debug view, not polygons
    const els = [];
    const group = (smp, kind, prop) => {
      const g = new S.G(); g.label = 'shadows-lamp-' + kind; box.addChild(g);
      const el = { g, s: smp, kind, a: 1, p: prop || null };
      return { g, mul: 1, done: n => { if (n) els.push(el); else { box.removeChild(g); g.destroy && g.destroy(); } } };
    };
    let used = 0, walls = 0, cand = 0;
    if (cfg.lampJ > 0) {
      cornersNear(L.x, L.y, L.R, tmpC); cand += tmpC.length; for (const c of tmpC) rec.cand.push(c.x, c.y);
      used += emitFringes(L, tmpC, null, { k: LAMP.wall, J: cfg.lampJ, M: cfg.bands, len: FR.lampLen, w: FR.lampW, hx: LAMP.hx, hy: LAMP.hy, tf, group }); walls = polyCount;
    }
    for (const p of S.props) if (Math.hypot(clamp(L.x, p.x, p.x + p.w) - L.x, clamp(L.y, p.y, p.y + p.h) - L.y) < L.R) cand++;
    used += emitProps(L, S.props, null, { jit: LAMP.jitter[clamp(cfg.lampK, 1, 4) - 1], str: LAMP.prop, w: 1, kmax: 1, inten, tf, group });
    const polys = polyCount; polyBudget = saveBudget; polyCount = saveCount; S.dbg = saveDbg;
    const ms = now() - t0; ST.lampBuilds++; ST.lampBuildMs += ms; if (ms > ST.lampBuildMax) ST.lampBuildMax = ms;
    return { g: box, els, polys, walls, casters: used, cand, key: lampKey(cfg), last: 0, x: L.x, y: L.y, fade: 0, fill: 1, dbg: { cand: rec.cand, fr: rec.fringes, props: rec.props } };
  }
  /* this frame's mixed-light scale of every element of a shown lamp (only where another light can reach: else 1) */
  function fillLamp(e, i, Lp, t, cfg) {
    const near = fillL.some(C => Math.hypot(C.x - e.x, C.y - e.y) < C.f.range + LAMP.R + 60);
    let lo = 1;
    for (const el of e.els) {
      const m = near ? clamp(lampElementFill(el, i, Lp, t), 0, 1) : 1;
      if (Math.abs(m - el.a) > .002 || (m === 1 && el.a !== 1)) { el.a = m; el.g.alpha = m; el.g.visible = m > .003; }
      if (m < lo) lo = m; ST.fillEval += near ? 1 : 0;
    }
    e.fill = lo;
  }
  function lamps(cfg, rect, t, view, dt) {
    const A = window.__api, lamps = A.lamps || [], C = S.lampCache;
    let shown = 0, prims = 0, cand = 0, act = 0, builds = 0;
    const black = !!(A.V && A.V.blackout), list = [];
    if (!black && cfg.lamps > 0) for (let i = 0; i < lamps.length; i++) {
      const L = lamps[i]; if (L.x + LAMP.R < rect.x0 || L.x - LAMP.R > rect.x1 || L.y + LAMP.R < rect.y0 || L.y - LAMP.R > rect.y1) continue;
      list.push([Math.hypot(L.x - view.x, L.y - view.y), i]);
    }
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);                       // nearest first, index breaks ties: a stable order
    const key = lampKey(cfg), want = new Set(), cutoff = list.length > cfg.lamps ? list[cfg.lamps][0] : Infinity;
    for (let n = 0; n < list.length && n < cfg.lamps; n++) {
      const i = list[n][1], Lp = lamps[i];
      let e = C.get(i);
      if (e && e.key !== key) { S.layers.lamps.removeChild(e.g); e.g.destroy && e.g.destroy({ children: true }); C.delete(i); e = null; }
      if (!e) { if (builds >= cfg.builds) { ST.cacheMisses++; continue; } e = buildLamp(i, Lp, cfg); C.set(i, e); S.layers.lamps.addChild(e.g); builds++; ST.cacheMisses++; } else ST.cacheHits++;
      /* the overlay's own lamp power relative to the nominal power the geometry was built at (flicker, failures, NV gain);
       * no popping: a lamp near the cap's cut-off distance is already faded (the one replacing it fades in), and a freshly
       * admitted lamp eases in over a quarter second */
      const p = lampPower(i, Lp, t), edge = clamp((cutoff - list[n][0]) / 140, 0, 1);
      e.fade = e.last === ST.frames - 1 ? Math.min(1, e.fade + Math.max(Math.max(dt, 0) / .25, 1 / 15)) : 0;
      e.g.alpha = clamp(p / lampP0(i), 0, 1) * edge * e.fade; e.g.visible = e.g.alpha > .003; e.last = ST.frames; want.add(i);
      if (e.g.visible) { fillLamp(e, i, Lp, t, cfg); shown++; prims += e.polys; cand += e.cand; act += e.casters; }
      if (S.dbg) S.dbg.lights.push(Lp.x, Lp.y, LAMP.R, 0, e.g.alpha);
    }
    for (const [i, e] of C) if (!want.has(i)) e.g.visible = false;
    if (C.size > 48) {                                                        // bounded cache: drop the least recently used lamps
      const old = [...C.entries()].filter(([i]) => !want.has(i)).sort((a, b) => a[1].last - b[1].last);
      for (let k = 0; k < old.length && C.size > 48; k++) { const [i, e] = old[k]; S.layers.lamps.removeChild(e.g); e.g.destroy && e.g.destroy({ children: true }); C.delete(i); }
    }
    return { shown, prims, cand, act };
  }

  /* ---------- carried lights: yours and other wanderers', rebuilt every frame within the tier's caps and budget ----------
   * Your light: prop shadows (new information) and corner penumbrae on the lit side of the edges the overlay already
   * cuts.  Other wanderers' lights: the same, fewer.  Casters are ranked by the game's own equipment light model (qc);
   * every shadow pixel is weighted by the overlay's own beam for that equipment (carryCookie), turned with the aim. */
  const SRC = { x: 0, y: 0, angle: 0, equipment: { kind: 'flashlight' } }, PT = { x: 0, y: 0 };
  const JITS = (r => [[[0, 0]], [[-r, 0], [r, 0]], [[-r, -2], [0, 2], [r, -2]], [[-r, -2], [-r / 3, 2], [r / 3, -2], [r, 2]]])(CARRY.jr), JIT = k => JITS[clamp(k, 1, 4) - 1];
  const carriedInten = (x, y) => { PT.x = x; PT.y = y; return window.__api.qc(SRC, PT, true); };   // the game's own light model for the light in SRC
  function carried(cfg, rect, lightOn, t, dt) {
    const A = window.__api, gp = S.dyn, gf = S.dynFr, Gc = A.Gc || {}; gp.clear(); gf.clear(); polyCount = 0; polyBudget = cfg.budget || 0;
    let lights = 0, cand = 0, act = 0, nf = 0, np = 0;
    const D = A.death && A.death();
    const inten = carriedInten;
    const add = (sx, sy, ang, kind, peer, w, fl) => {
      const f = Gc[kind]; if (!f || f.nv || !(f.range > 1) || !(w > .01)) return;
      const ck = carryCookie(kind); if (!ck) return;
      if (f.omni) w *= fl;                                                  // a lantern's flame flicker, as the overlay draws it
      const L = { x: sx, y: sy, R: f.range, h: CARRY.h[kind] || 105 };
      if (sx + L.R < rect.x0 || sx - L.R > rect.x1 || sy + L.R < rect.y0 || sy - L.R > rect.y1) return;
      SRC.x = sx; SRC.y = sy; SRC.angle = ang; SRC.equipment.kind = kind;
      lights++; if (S.dbg) S.dbg.lights.push(sx, sy, L.R, peer ? 2 : 1, w);
      const tf = lightFill(ck, sx, sy, ang);
      const pmax = peer ? cfg.peerMax : cfg.localMax, cmax = peer ? cfg.peerC : cfg.localC;
      /* HIGH: this light's shadows give way to the other carried lights that also light them (see fillLights) */
      const me = { x: sx, y: sy, ang, f, own: !peer, fl: f.omni ? fl : 1, e: 1 - Math.pow(1 - f.power, 1 / 12) };
      const grp = g => (smp, kind, prop) => ({ g, mul: cfg.fillAll && fillL.length > 1 ? carriedElementFill(smp, me, prop) : 1, done() { } }), gP = grp(gp), gF = grp(gf);
      if (pmax > 0) {
        const pc = [];
        for (const p of S.props) {
          if (Math.hypot(clamp(sx, p.x, p.x + p.w) - sx, clamp(sy, p.y, p.y + p.h) - sy) >= L.R) continue;
          const im = propLight(p, L, inten); if (im > .004) pc.push([im, p.n, p]);
        }
        cand += pc.length; pickSoft(pc, pmax, CARRY.soft, tmpP, tmpPW);
        if (!peer) { eased(fadeP, tmpP, tmpPW, keyP, pmax, dt, tmpEI, tmpEW); tmpP.length = 0; tmpPW.length = 0; tmpP.push(...tmpEI); tmpPW.push(...tmpEW); }
        if (S.dbg) for (const c of pc) S.dbg.cand.push(c[2].cx, c[2].cy);
        const u = emitProps(L, tmpP, tmpPW, { jit: JIT(peer ? cfg.peerK : cfg.localK), str: peer ? CARRY.peerProp : CARRY.prop, w, kmax: CARRY.kmax, inten, tf, group: gP });
        act += u; np += u;
      }
      if (cmax > 0) {
        cornersNear(sx, sy, L.R, tmpC); const cc = [];
        for (const c of tmpC) { const im = inten(c.x, c.y); if (im > .004) cc.push([im, c.i, c]); }
        cand += cc.length; pickSoft(cc, cmax, CARRY.soft, tmpCI, tmpCW);
        if (!peer) { eased(fadeC, tmpCI, tmpCW, keyC, cmax, dt, tmpEI, tmpEW); tmpCI.length = 0; tmpCW.length = 0; tmpCI.push(...tmpEI); tmpCW.push(...tmpEW); }
        if (S.dbg) for (const c of cc) S.dbg.cand.push(c[2].x, c[2].y);
        const u = emitFringes(L, tmpCI, tmpCW, { k: (peer ? CARRY.peerFringe : CARRY.fringe) * w, J: peer ? cfg.peerJ : cfg.localJ, M: cfg.bands, len: FR.carryLen, w: FR.carryW, hx: CARRY.half, hy: CARRY.half, tf, group: gF, vis: peer ? null : visC, dt });
        act += u; nf += u;
      }
    };
    if (cfg.local && lightOn && !(D && D.active)) {                          // your own light: from the hand that holds it (the overlay's beam source)
      const b = (A.beam && A.beam()) || A.H, H = A.H;
      add(b.x, b.y, b.angle ?? H.angle, (H.equipment && H.equipment.kind) || 'flashlight', false, 1, .93 + Math.sin(t * 17) * .035 + Math.sin(t * 31) * .025);
    }
    if (cfg.peers > 0 && Array.isArray(window.__peerLights)) {              // the nearest other lights; the one at the cap fades instead of popping
      const V = viewer(), ps = window.__peerLights.filter(p => p && p.on && !p.dead && p.kind !== 'camcorder' && Number.isFinite(p.x + p.y))
        .map(p => [Math.hypot(p.x - V.x, p.y - V.y), p]).sort((a, b) => a[0] - b[0]);
      const cut = ps.length > cfg.peers ? ps[cfg.peers][0] : Infinity;
      for (let n = 0; n < ps.length && n < cfg.peers; n++) { const p = ps[n][1]; add(p.x, p.y, p.angle || 0, p.kind || 'flashlight', true, clamp((cut - ps[n][0]) / 80, 0, 1), .93 + Math.sin(t * 17 + p.x) * .035 + Math.sin(t * 31 + p.y) * .025); }
    }
    ST.dyn = polyCount; if (polyCount > ST.dynMax) ST.dynMax = polyCount; ST.fringes = nf; ST.props = np;
    return { lights, cand, act, prims: polyCount };
  }

  /* ---------- light-directional entity shadows (pooled soft blobs; smoothed so a light change never pops) ---------- */
  const smoothed = new WeakMap();
  function blob(i) {
    let g = S.pool[i]; if (g) return g;
    g = new S.G(); g.texture(S.tex.blob, 0xffffff, -1, -1, 2, 2); g.label = 'shadows-ent'; S.layers.ents.addChild(g); S.pool[i] = g; return g;
  }
  function viewer() { const A = window.__api, D = A.death && A.death(); return D && D.active && D.body ? D.body : A.H; }
  /* can the local player see this spot? (the same line-of-sight rule the game uses for hover names: centre in LOS, inside the sight range) */
  function seen(V, x, y) {
    const dx = x - V.x, dy = y - V.y, d = Math.hypot(dx, dy);
    if (d < 30) return true; if (d > ENT.sight) return false;
    return window.__api.Uc(V.x, V.y, Math.atan2(dy, dx), d) >= d - 20;
  }
  function entityShadows(cfg, rect, dt, lightOn) {
    const A = window.__api, L = window.__light; let n = 0; const max = cfg.ents, V = viewer();
    if (!L || !L.sample || !V) return 0;
    const k = 1 - Math.exp(-Math.max(0, Math.min(dt, .25)) / ENT.tau);
    const cast = (v, x, y, kind, heading, alphaMul, isSelf) => {
      if (n >= max || !(alphaMul > .01) || !Number.isFinite(x + y)) return;
      if (x < rect.x0 - 100 || x > rect.x1 + 100 || y < rect.y0 - 100 || y > rect.y1 + 100) return;
      if (!isSelf && !seen(V, x, y)) { smoothed.delete(v); return; }           // only what the local player can actually see
      const s = L.sample(x, y, lightOn), w = clamp(s.direct * 2.2, 0, 1);
      let m = smoothed.get(v); if (!m) { m = { x: 0, y: 0, f: -9 }; smoothed.set(v, m); }
      const kk = m.f === ST.frames - 1 ? k : 1; m.f = ST.frames;            // smooth only across consecutive drawn frames; otherwise start from the truth
      m.x += (-s.dirX * w - m.x) * kk; m.y += (-s.dirY * w - m.y) * kk;  // the shadow points AWAY from the dominant light
      const str = Math.hypot(m.x, m.y); if (str < .02) return;
      const ux = m.x / str, uy = m.y / str, P = ENT[kind], ang = Math.atan2(uy, ux);
      const phi = heading === null ? 0 : ang - heading, cs = Math.cos(phi), sn = Math.sin(phi);
      const along = Math.sqrt((P.la * cs) ** 2 + (P.lb * sn) ** 2), across = Math.sqrt((P.la * sn) ** 2 + (P.lb * cs) ** 2);
      const ext = P.len * str, g = blob(n++);
      g.visible = true; g.position.set(x + ux * ext * .5, y + uy * ext * .5); g.rotation = ang; g.scale.set(along + ext * .5, across * .92);
      g.alpha = clamp(P.a * Math.min(1, str * 1.25) * alphaMul, 0, 1);
    };
    const P = S.person;
    if (P && P.visible && P.parent) cast(P, P.x, P.y, 'player', null, P.alpha, true);
    const cr = A.layer && A.layer();
    if (cr && cr.children) for (const v of cr.children) {
      if (n >= max) break;
      if (!v || !v.visible || !(v.alpha > .01) || v.__smiler) continue;  // never a Smiler: no body may be implied
      if (v.__hound) cast(v, v.x, v.y, 'hound', v.rotation - Math.PI / 2, v.alpha, false);
      else if (typeof v.deathPose === 'function') cast(v, v.x, v.y, 'player', null, v.alpha, false);   // another wanderer's avatar
    }
    for (let i = n; i < S.pool.length; i++) if (S.pool[i].visible) S.pool[i].visible = false;
    ST.ents = n; if (n > ST.entsMax) ST.entsMax = n;
    return n;
  }

  /* ---------- per frame (called right after the game's own frame; reads only) ---------- */
  /* the viewport size, read on resize only: reading innerWidth / innerHeight inside a frame can force a synchronous
   * layout (it did under mobile emulation: ~1 ms a frame); the game itself also keeps its size from its resize handler */
  const VP = { w: 0, h: 0 }, readVP = () => { VP.w = innerWidth; VP.h = innerHeight; };
  readVP(); addEventListener('resize', readVP); addEventListener('orientationchange', readVP);
  function viewRect() {
    const w = S.world, sc = w.scale.x || 1;
    return { x0: -w.position.x / sc, y0: -w.position.y / sc, x1: (VP.w - w.position.x) / sc, y1: (VP.h - w.position.y) / sc, sc };
  }
  let lastT = 0;
  function frame(o) {
    if (S.disabled) return;
    if (!S.attached) { if (++S.attachTries > 900) { disable('renderer never became available'); return; } if (!attach()) return; }
    const t0 = now(), cfg = TIERS[S.quality], dt = o && Number.isFinite(o.t) ? o.t : (lastT ? (t0 - lastT) / 1000 : .016); lastT = t0;
    const t = (S.frameTs || t0) / 1000;                                     // the game's own frame time (drawLight's flicker clock)
    let prims = 0, lights = 0, cand = 0, act = 0; ST.ents = 0; S.aoVisible = 0; ST.dyn = 0; ST.fringes = 0; ST.props = 0; ST.fillEval = 0;
    S.dbg = S.debugOn ? { lights: [], cand: [], fringes: [], props: [], polys: [] } : null;
    if (S.quality !== 'off') {
      const rect = viewRect(), lightOn = o ? !!o.light : true, V = viewer();
      if (cfg.ao) { cullAO(rect); prims += S.aoVisible; }
      fillLights(cfg, lightOn);
      const l = lamps(cfg, rect, t, V, dt); lights += l.shown; prims += l.prims; cand += l.cand; act += l.act;
      const c = carried(cfg, rect, lightOn, t, dt); lights += c.lights; prims += c.prims; cand += c.cand; act += c.act;
      prims += cfg.ents ? entityShadows(cfg, rect, dt, lightOn) : 0;
    } else { for (const [, e] of S.lampCache) e.g.visible = false; if (S.dyn) S.dyn.clear(); if (S.dynFr) S.dynFr.clear(); }
    ST.prims = prims; if (prims > ST.primsMax) ST.primsMax = prims;
    ST.lights = lights; if (lights > ST.lightsMax) ST.lightsMax = lights;
    ST.cand = cand; if (cand > ST.candMax) ST.candMax = cand; ST.active = act; if (act > ST.activeMax) ST.activeMax = act;
    const ms = now() - t0; ST.ms[ST.n % ST.ms.length] = ms; ST.n++; if (ms > ST.max) ST.max = ms; ST.frames++;
    if (S.debugOn) debugDraw();
  }

  function applyQuality() {
    const cfg = TIERS[S.quality];
    if (S.root) {
      S.root.visible = S.quality !== 'off';
      S.layers.ao.visible = !!cfg.ao; S.layers.ents.visible = cfg.ents > 0; S.layers.lamps.visible = cfg.lamps > 0; S.layers.cast.visible = !!cfg.local || cfg.peers > 0;
      if (!cfg.ents) for (const g of S.pool) g.visible = false;
    }
    syncControl();
  }
  function setQuality(q, remember = true) {
    q = String(q || '').toLowerCase(); if (!QUALITIES.includes(q)) return S.quality;
    S.quality = q; if (remember) try { localStorage.setItem(LS_KEY, q); } catch (e) { }
    applyQuality(); return q;
  }

  /* ---------- settings control: a SHADOWS row in the existing SETTINGS panel (hud.js itself is not modified) ---------- */
  function addSettingsControl() {
    const pane = document.querySelector('#settings section[data-pane="custom"]'); if (!pane || document.getElementById('stShadows')) return;
    const box = document.createElement('div'); box.id = 'stShadows';
    box.innerHTML = '<h3>SHADOWS</h3><p class="st-note">Presentation only: grounding and light shadows. Never changes what you or the entities can see or do. LOW suits phones and older PCs.</p>' +
      '<div style="display:flex;gap:6px">' + QUALITIES.map(q => `<button type="button" class="st-btn" data-shq="${q}" style="flex:1;margin:0;padding:9px 2px">${q.toUpperCase()}</button>`).join('') + '</div>';
    box.addEventListener('click', e => { const b = e.target.closest('[data-shq]'); if (!b) return; e.stopPropagation(); setQuality(b.dataset.shq); });
    pane.appendChild(box); syncControl();
  }
  function syncControl() {
    document.querySelectorAll('#stShadows [data-shq]').forEach(b => { const on = b.dataset.shq === S.quality; b.style.outline = on ? '2px solid currentColor' : ''; b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }

  /* ---------- admin / developer debug view (needs the admin panel's DEBUG MODE; never shown to ordinary players) ---------- */
  const adminDebug = () => !!(window.__ents && window.__ents.dbgCfg && window.__ents.dbgCfg.on);
  function debugUi() {
    const on = adminDebug();
    if (on && !S.debugBtn) {
      const b = document.createElement('button'); b.id = 'shadowDebugBtn'; b.type = 'button'; b.textContent = 'SHADOW DEBUG';
      b.style.cssText = 'position:fixed;left:12px;top:50%;z-index:9;font:10px monospace;padding:6px 8px;opacity:.85';
      b.addEventListener('click', e => { e.stopPropagation(); S.debugOn = !S.debugOn; b.style.outline = S.debugOn ? '2px solid #9dff9d' : ''; if (!S.debugOn && S.debugCv) { S.debugCv.remove(); S.debugCv = null; } });
      document.body.appendChild(b); S.debugBtn = b;
    } else if (!on && S.debugBtn) { S.debugBtn.remove(); S.debugBtn = null; S.debugOn = false; if (S.debugCv) { S.debugCv.remove(); S.debugCv = null; } }
  }
  function debugDraw() {
    if (!adminDebug()) { S.debugOn = false; if (S.debugCv) { S.debugCv.remove(); S.debugCv = null; } return; }
    let cv = S.debugCv;
    if (!cv) { cv = S.debugCv = document.createElement('canvas'); cv.id = 'shadowDebug'; cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4'; document.body.appendChild(cv); }
    if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
    const x = cv.getContext('2d'), w = S.world, sc = w.scale.x, D = S.dbg || { lights: [], cand: [], fringes: [], props: [], polys: [] };
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    x.setTransform(sc, 0, 0, sc, w.position.x, w.position.y); x.lineWidth = 1.5 / sc;
    const dots = (a, r) => { for (let i = 0; i < a.length; i += 2) { x.beginPath(); x.arc(a[i], a[i + 1], r / sc, 0, Math.PI * 2); x.stroke(); } };
    const wedges = a => { for (let i = 0; i < a.length; i += 5) { const [cx, cy, th, sp, len] = [a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4]]; x.beginPath(); x.moveTo(cx + Math.cos(th) * len, cy + Math.sin(th) * len); x.lineTo(cx, cy); x.lineTo(cx + Math.cos(th + sp) * len, cy + Math.sin(th + sp) * len); x.stroke(); } };
    const rects = a => { for (let i = 0; i < a.length; i += 4) x.strokeRect(a[i], a[i + 1], a[i + 2], a[i + 3]); };
    x.strokeStyle = 'rgba(255,210,90,.35)'; for (const c of S.chunks) if (c.g.visible) x.strokeRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);     // AO chunk bounds
    x.strokeStyle = 'rgba(160,160,255,.45)'; for (const p of S.props) x.strokeRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4); for (const pl of S.pillars) x.strokeRect(pl.x - 2, pl.y - 2, pl.w + 4, pl.h + 4);
    x.strokeStyle = 'rgba(255,170,60,.35)'; dots(D.cand, 3); for (const [, e] of S.lampCache) if (e.g.visible) dots(e.dbg.cand, 3);   // candidate casters
    x.strokeStyle = 'rgba(255,90,200,.5)'; for (const p of D.polys) { x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); x.stroke(); }
    x.lineWidth = 2.5 / sc; x.strokeStyle = 'rgba(255,150,40,.95)'; wedges(D.fringes); rects(D.props);                                   // chosen casters (carried lights)
    x.strokeStyle = 'rgba(255,230,90,.9)'; for (const [, e] of S.lampCache) if (e.g.visible) { wedges(e.dbg.fr); rects(e.dbg.props); }    // chosen casters (lamps)
    x.lineWidth = 1.5 / sc;
    for (let i = 0; i < D.lights.length; i += 5) { const k = D.lights[i + 3]; x.strokeStyle = k === 0 ? 'rgba(255,240,120,.8)' : k === 1 ? 'rgba(120,255,160,.9)' : 'rgba(120,200,255,.9)'; x.beginPath(); x.arc(D.lights[i], D.lights[i + 1], D.lights[i + 2], 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(D.lights[i], D.lights[i + 1], 6 / sc, 0, Math.PI * 2); x.stroke(); }
    x.strokeStyle = 'rgba(120,200,255,.95)';
    for (const g of S.pool) if (g.visible) { x.beginPath(); x.ellipse(g.x, g.y, Math.abs(g.scale.x), Math.abs(g.scale.y), g.rotation, 0, Math.PI * 2); x.stroke(); }
    const py = Math.round(innerHeight * .5) + 30, m = msStats(), cfg = TIERS[S.quality];
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = 'rgba(0,0,0,.74)'; x.fillRect(8, py, 380, 140); x.fillStyle = '#9dff9d'; x.font = '11px monospace';
    [`SHADOWS ${S.quality.toUpperCase()}  ${VERSION}`, `lights ${ST.lights} (lamps <= ${cfg.lamps || 0}, peers <= ${cfg.peers || 0})  casters cand ${ST.cand} active ${ST.active}`,
     `dynamic polys ${ST.dyn}/${cfg.budget || 0} (props ${ST.props}, penumbrae ${ST.fringes})  primitives ${ST.prims}`,
     `lamp cache ${S.lampCache.size}  hits ${ST.cacheHits} misses ${ST.cacheMisses}  builds ${ST.lampBuilds} (max ${ST.lampBuildMax.toFixed(1)} ms)`,
     `ao chunks ${S.aoVisible}/${S.chunks.length}  runs ${S.aoRuns}  entity shadows ${ST.ents}/${cfg.ents}`,
     `build ${m.mean.toFixed(3)} ms avg  ${m.max.toFixed(3)} max   static ${ST.staticBuilds}x ${ST.staticBuildMs} ms`,
     'yellow: lamps  green: your light  blue: peers / ellipses: entity',
     'dim dots: candidate casters  wedges/boxes: chosen  pink: polygons'].forEach((s, i) => x.fillText(s, 16, py + 18 + i * 15));
  }

  /* ---------- hook: run right after the game's per-frame hook (window.__mp from mp.js, which stays byte-identical) ---------- */
  const prev = window.__mp;
  window.__mp = function (o) {
    const r = typeof prev === 'function' ? prev.apply(this, arguments) : undefined;
    try { frame(o); } catch (e) { disable('frame error', e); }
    return r;
  };
  const ui = () => { try { addSettingsControl(); debugUi(); } catch (e) { } };
  setInterval(ui, 500); if (document.readyState !== 'loading') ui(); else addEventListener('DOMContentLoaded', ui);

  window.__shadows = {
    version: VERSION,
    quality: () => S.quality,
    setQuality: q => setQuality(q, false),
    qualities: () => QUALITIES.slice(),
    tiers: () => JSON.parse(JSON.stringify(TIERS)),
    stats: () => ({ version: VERSION, quality: S.quality, attached: S.attached, disabled: S.disabled, frames: ST.frames, buildMs: msStats(),
      lights: { last: ST.lights, max: ST.lightsMax }, casters: { candidate: ST.cand, candidateMax: ST.candMax, active: ST.active, activeMax: ST.activeMax },
      primitives: { last: ST.prims, max: ST.primsMax }, dynamicPolys: { last: ST.dyn, max: ST.dynMax, budget: TIERS[S.quality].budget || 0, props: ST.props, penumbrae: ST.fringes },
      entityShadows: { last: ST.ents, max: ST.entsMax }, ao: { runs: S.aoRuns, quads: S.aoQuads, chunks: S.chunks.length, visible: S.aoVisible },
      occluders: { wallCorners: S.wallCorners, pillarCorners: S.corners.length - S.wallCorners, pillars: S.pillars.length, props: S.props.length },
      cache: { lamps: S.lampCache.size, hits: ST.cacheHits, misses: ST.cacheMisses, lampBuilds: ST.lampBuilds, lampBuildMsTotal: +ST.lampBuildMs.toFixed(2), lampBuildMsMax: +ST.lampBuildMax.toFixed(2), staticBuilds: ST.staticBuilds, staticBuildMs: ST.staticBuildMs },
      errors: ST.errors }),
    resetStats,
    debug: on => { if (on !== undefined) S.debugOn = !!on && adminDebug(); return S.debugOn; },
    /* test / QA view of what is drawn this frame (copies; reading it changes nothing) */
    snapshot: () => ({ quality: S.quality, disabled: S.disabled, layerIndex: S.world ? S.world.children.indexOf(S.root) : -1,
      ents: S.pool.filter(g => g.visible).map(g => ({ x: +g.x.toFixed(2), y: +g.y.toFixed(2), sx: +g.scale.x.toFixed(2), sy: +g.scale.y.toFixed(2), rot: +g.rotation.toFixed(4), a: +g.alpha.toFixed(4) })),
      lamps: [...S.lampCache.entries()].filter(([, e]) => e.g.visible).map(([i, e]) => ({ i, a: +e.g.alpha.toFixed(4), polys: e.polys, walls: e.walls, casters: e.casters, penumbrae: e.dbg.fr.length / 5, props: e.dbg.props.length / 4, elements: e.els.length, fill: +e.fill.toFixed(4) })).sort((a, b) => a.i - b.i),
      fillLights: fillL.length, fillEvaluations: ST.fillEval,
      dynamic: S.dyn ? { polys: ST.dyn, props: ST.props, penumbrae: ST.fringes } : null,
      aoVisible: S.chunks.filter(c => c.g.visible).map(c => [c.i, c.j]) }),
  };
})();
