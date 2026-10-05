/* shadows-2d.js - THE FAR BACKROOMS 2D lighting & shadows (presentation only, client only).
 *
 * THE 2D GAME IS THE GAME.  This file only draws soft floor shadows into the existing Pixi world, directly above the
 * carpet and UNDER the level art, the props, every entity and the darkness overlay:
 *   grounding  static, cached ambient occlusion along every wall base, merged along wall runs (no per-tile comb),
 *              split into camera-culled chunks
 *   light      a soft shadow cast away from the dominant light (__light.sample dirX/dirY) by the local player, other
 *              wanderers and hounds that the local player can actually see.  The art already gives players, corpses
 *              and hounds a centred baked contact shadow (the avatar's ellipse / the hound's ground shadow); this adds
 *              only the light-directional part, so nothing is drawn twice.  Never for a Smiler: its face-only
 *              presentation stays authoritative and no body is ever implied.
 *   cast       carried-light and ceiling-lamp shadows from walls, pillars and props (stage SH2)
 * It is built on the existing lighting foundation: light.js (__light.sample dominant direction / strengths / flicker /
 * blackout, __light.ray) and the game's own wall predicate, ray query and lamp list exposed on __api.
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
  const VERSION = 'shadows-2d SH1';
  const T = 96, CHUNK = 16;                                                 // level cell size; AO chunk = 16 x 16 cells
  const QUALITIES = ['off', 'low', 'medium', 'high'];
  /* per-quality budgets.  Every per-frame pass is capped and camera-culled; nothing scales with the size of the map. */
  const TIERS = {
    off: { ao: false, ents: 0 },
    low: { ao: true, ents: 6 },
    medium: { ao: true, ents: 12 },
    high: { ao: true, ents: 20 },
  };
  /* art constants (world px).  The level is dark and the overlay does the heavy darkening: these stay restrained. */
  const AO = { width: 30, alpha: .38, steps: 64, power: 1.7 };
  const ENT = { player: { a: .26, la: 17, lb: 17, len: 70 }, hound: { a: .30, la: 40, lb: 17, len: 120 }, tau: .12, sight: 700 };

  const LS_KEY = 'tfb.shadows.quality';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const now = () => performance.now();

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
    person: null, frameTs: 0, aoRuns: 0, aoQuads: 0, aoVisible: 0, pool: [], debugOn: false, debugCv: null, debugBtn: null,
  };
  const ST = { frames: 0, ms: new Float32Array(1024), n: 0, max: 0, lights: 0, lightsMax: 0, cand: 0, candMax: 0, active: 0, activeMax: 0, prims: 0, primsMax: 0,
    ents: 0, entsMax: 0, cacheHits: 0, cacheMisses: 0, staticBuilds: 0, staticBuildMs: 0, errors: 0 };
  function resetStats() { ST.frames = 0; ST.n = 0; ST.max = 0; ST.lightsMax = ST.candMax = ST.activeMax = ST.primsMax = ST.entsMax = 0; ST.cacheHits = ST.cacheMisses = 0; }
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
    for (const name of ['ao', 'cast', 'ents']) { const c = new S.C(); c.label = 'shadows-' + name; root.addChild(c); S.layers[name] = c; }
    world.addChildAt(root, ci + 1);                                       // right above the carpet: under walls, props, items, corpses, entities
    S.root = root; S.attached = true;
    buildAO();
    applyQuality();
    return true;
  }

  /* ---------- grounding: ambient occlusion strips along merged wall runs (built once; chunked for camera culling) ---------- */
  function buildAO() {
    const t0 = now(), A = window.__api, W = S.FBW, H = S.FBH, w = AO.width;
    const wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : !!A.Hc(x, y);   // walls only: pits are floor holes, not occluders
    const nx = Math.ceil(W / CHUNK), ny = Math.ceil(H / CHUNK), chunks = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const g = new S.G(); g.label = `shadows-ao-${i}-${j}`; g.alpha = AO.alpha; chunks.push({ g, i, j, quads: 0, x0: i * CHUNK * T - w, y0: j * CHUNK * T - w, x1: (i + 1) * CHUNK * T + w, y1: (j + 1) * CHUNK * T + w }); }
    const chunkOf = (cx, cy) => chunks[Math.min(ny - 1, Math.floor(cy / CHUNK)) * nx + Math.min(nx - 1, Math.floor(cx / CHUNK))];
    let runs = 0, quads = 0;
    const put = (cx, cy, tex, x, y, ww, hh) => { const c = chunkOf(cx, cy); c.g.texture(tex, 0xffffff, x, y, ww, hh); c.quads++; quads++; };
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
      if (!wall(x + 1, y) && !wall(x, y + 1) && !wall(x + 1, y + 1)) put(x + 1, y + 1, S.tex.se, cx + T, cy + T, w, w);
      if (!wall(x - 1, y) && !wall(x, y + 1) && !wall(x - 1, y + 1)) put(x - 1, y + 1, S.tex.sw, cx - w, cy + T, w, w);
      if (!wall(x + 1, y) && !wall(x, y - 1) && !wall(x + 1, y - 1)) put(x + 1, y - 1, S.tex.ne, cx + T, cy - w, w, w);
      if (!wall(x - 1, y) && !wall(x, y - 1) && !wall(x - 1, y - 1)) put(x - 1, y - 1, S.tex.nw, cx - w, cy - w, w, w);
    }
    S.layers.ao.removeChildren(); S.chunks = chunks.filter(c => c.quads > 0);
    for (const c of S.chunks) S.layers.ao.addChild(c.g);
    S.aoRuns = runs; S.aoQuads = quads; ST.staticBuilds++; ST.staticBuildMs = +(now() - t0).toFixed(2);
  }
  function cullAO(rect) {
    let n = 0;
    for (const c of S.chunks) { const v = c.x1 > rect.x0 && c.x0 < rect.x1 && c.y1 > rect.y0 && c.y0 < rect.y1; if (c.g.visible !== v) c.g.visible = v; if (v) n++; }
    S.aoVisible = n;
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
  function viewRect() {
    const w = S.world, sc = w.scale.x || 1;
    return { x0: -w.position.x / sc, y0: -w.position.y / sc, x1: (innerWidth - w.position.x) / sc, y1: (innerHeight - w.position.y) / sc, sc };
  }
  let lastT = 0;
  function frame(o) {
    if (S.disabled) return;
    if (!S.attached) { if (++S.attachTries > 900) { disable('renderer never became available'); return; } if (!attach()) return; }
    const t0 = now(), cfg = TIERS[S.quality], dt = o && Number.isFinite(o.t) ? o.t : (lastT ? (t0 - lastT) / 1000 : .016); lastT = t0;
    let prims = 0; ST.ents = 0; S.aoVisible = 0;
    if (S.quality !== 'off') {
      const rect = viewRect(), lightOn = o ? !!o.light : true;
      if (cfg.ao) { cullAO(rect); prims += S.aoVisible; }
      prims += cfg.ents ? entityShadows(cfg, rect, dt, lightOn) : 0;
    }
    ST.prims = prims; if (prims > ST.primsMax) ST.primsMax = prims;
    const ms = now() - t0; ST.ms[ST.n % ST.ms.length] = ms; ST.n++; if (ms > ST.max) ST.max = ms; ST.frames++;
    if (S.debugOn) debugDraw();
  }

  function applyQuality() {
    const cfg = TIERS[S.quality];
    if (S.root) {
      S.root.visible = S.quality !== 'off';
      S.layers.ao.visible = !!cfg.ao; S.layers.ents.visible = cfg.ents > 0; S.layers.cast.visible = false;
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
    const x = cv.getContext('2d'), w = S.world, sc = w.scale.x; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    x.setTransform(sc, 0, 0, sc, w.position.x, w.position.y); x.lineWidth = 1.5 / sc;
    x.strokeStyle = 'rgba(255,210,90,.55)'; for (const c of S.chunks) if (c.g.visible) x.strokeRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    x.strokeStyle = 'rgba(120,200,255,.95)';
    for (const g of S.pool) if (g.visible) { x.beginPath(); x.ellipse(g.x, g.y, Math.abs(g.scale.x), Math.abs(g.scale.y), g.rotation, 0, Math.PI * 2); x.stroke(); }
    const py = Math.round(innerHeight * .5) + 30;                          // under the SHADOW DEBUG button, clear of the title and the AI debug panels
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = 'rgba(0,0,0,.74)'; x.fillRect(8, py, 330, 78); x.fillStyle = '#9dff9d'; x.font = '11px monospace';
    const m = msStats();
    [`SHADOWS ${S.quality.toUpperCase()}  ${VERSION}`, `ao chunks ${S.aoVisible}/${S.chunks.length}  runs ${S.aoRuns}  quads ${S.aoQuads}`,
     `entity shadows ${ST.ents}/${TIERS[S.quality].ents}  primitives ${ST.prims}`, `build ${m.mean.toFixed(3)} ms avg  ${m.max.toFixed(3)} max   static ${ST.staticBuilds}x ${ST.staticBuildMs} ms`].forEach((s, i) => x.fillText(s, 16, py + 18 + i * 15));
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
      primitives: { last: ST.prims, max: ST.primsMax }, entityShadows: { last: ST.ents, max: ST.entsMax }, ao: { runs: S.aoRuns, quads: S.aoQuads, chunks: S.chunks.length, visible: S.aoVisible },
      cache: { hits: ST.cacheHits, misses: ST.cacheMisses, staticBuilds: ST.staticBuilds, staticBuildMs: ST.staticBuildMs }, errors: ST.errors }),
    resetStats,
    debug: on => { if (on !== undefined) S.debugOn = !!on && adminDebug(); return S.debugOn; },
    /* test / QA view of what is drawn this frame (copies; reading it changes nothing) */
    snapshot: () => ({ quality: S.quality, disabled: S.disabled, layerIndex: S.world ? S.world.children.indexOf(S.root) : -1,
      ents: S.pool.filter(g => g.visible).map(g => ({ x: +g.x.toFixed(2), y: +g.y.toFixed(2), sx: +g.scale.x.toFixed(2), sy: +g.scale.y.toFixed(2), rot: +g.rotation.toFixed(4), a: +g.alpha.toFixed(4) })),
      aoVisible: S.chunks.filter(c => c.g.visible).map(c => [c.i, c.j]) }),
  };
})();
