/* ai.js - reusable entity AI for The Far Backrooms (v16).  UMD: require('./ai.js') on the server.
 * Everything an entity does is built from the same components:
 *   PERCEPTION (vision with walls / darkness / posture, hearing from a sound bus)  ->  MEMORY (last known position, staleness)
 *   PERSONALITY (traits with per-instance variation)  ->  STATE FRAMEWORK  ->  MOVEMENT + TRAVERSAL (vault / crawl / tight gaps)
 *   TARGET SELECTION, SEARCHING, SOCIAL AWARENESS (only from what the entity can perceive), CAPTURE + KILL SELECTION.
 * Species (Hound, Smiler) are just data plus a `think` function on top of these parts.  The engine is server
 * authoritative and never reads a player list directly for decisions: it only sees what perception hands it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./world.js'));
  else root.AI = factory(root.WORLD);
})(typeof self !== 'undefined' ? self : this, function (WORLD) {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function mkRng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const S = {                                    // the shared state framework (species use the subset they need)
  DORMANT: 'DORMANT', ROAMING: 'ROAMING', CURIOUS: 'CURIOUS', ALERT: 'ALERT', WATCHING: 'WATCHING', STALKING: 'STALKING', HUNTING: 'HUNTING',
  SEARCHING: 'SEARCHING', CAUTIOUS: 'CAUTIOUS', FRUSTRATED: 'FRUSTRATED', EXCITED: 'EXCITED', FEEDING: 'FEEDING', PLAYING: 'PLAYING', RETREATING: 'RETREATING',
  HIDDEN: 'HIDDEN', FOLLOWING: 'FOLLOWING', PROVOKED: 'PROVOKED', ATTACKING: 'ATTACKING', DISAPPEARING: 'DISAPPEARING',
};
const SNAMES = Object.keys(S), SCODE = {}; SNAMES.forEach((k, i) => SCODE[k] = i);
const TRAITS = ['INTELLIGENCE', 'SADISM', 'HUNGER', 'PATIENCE', 'CURIOSITY', 'CAUTION', 'TERRITORIALITY', 'AGGRESSION', 'PERSISTENCE', 'SOCIAL', 'HEARING', 'VISION', 'LIGHT_SENS', 'MEMORY'];

/* a coarse spatial hash for "who is near" queries (players, sounds) */
class Hash {
  constructor(cs = 384) { this.cs = cs; this.m = new Map(); }
  clear() { this.m.clear(); }
  key(cx, cy) { return cx * 4096 + cy; }
  add(o, x, y) { const k = this.key(Math.floor(x / this.cs), Math.floor(y / this.cs)); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(o); }
  near(x, y, r, fn) {
    const cs = this.cs, x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs), y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const a = this.m.get(this.key(cx, cy)); if (a) for (const o of a) fn(o); }
  }
}

/* ---------------------------------------------------------------- geometry, navigation, light
 * The adapter `a` (built in sim.js) exposes the level's own primitives; everything below is derived from them once per process. */
const STATIC = new Map();
const OL = 21;                                   // clearance radius the game's own nav grid uses
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const WALL_COST = [30, 12, 3, 0];                  // route cost per cell by clearance: a hall is crossed down its middle unless the long way round is much longer
function buildStatic(a) {
  const cols = a.cols, rows = a.rows, N = cols * rows, cs = a.cell;
  const cls = new Uint8Array(N), lamp = new Float32Array(N), links = new Map(), clr = new Uint8Array(N);
  const cx = i => (i % cols + .5) * cs, cy = i => (Math.floor(i / cols) + .5) * cs;
  for (let i = 0; i < N; i++) {
    const x = cx(i), y = cy(i);
    if (!a.floor(Math.floor(x / 96), Math.floor(y / 96))) continue;
    if (a.clear(x, y, OL, 'walk')) cls[i] = 1;
    else if (a.clear(x, y, OL, 'crawl')) { const z = WORLD.lowZone(x, y, 10); cls[i] = z && z.type === 'gap' ? 3 : 2; }
  }
  // clearance field: how much room a walkable cell has around it (0: barely body-wide ... 3: 52 px or more).  Routes prefer roomy cells, so they run
  // down the middle of halls and through the middle of doorways instead of along the wall at touching distance.  Built once per process.
  for (let i = 0; i < N; i++) { if (cls[i] !== 1) continue; const x = cx(i), y = cy(i); clr[i] = a.clear(x, y, 52, 'walk') ? 3 : a.clear(x, y, 40, 'walk') ? 2 : a.clear(x, y, 30, 'walk') ? 1 : 0; }
  // lamp light on the floor (what a light-fearing monster avoids); LOS-tested like the game's own Ul()
  for (let i = 0; i < N; i++) {
    if (!cls[i] && !a.floor(Math.floor(cx(i) / 96), Math.floor(cy(i) / 96))) continue;
    const x = cx(i), y = cy(i); let best = 0;
    for (const L of a.lamps) {
      const d = Math.hypot(x - L.x, y - L.y); if (d >= 380) continue;
      if (a.ray(L.x, L.y, Math.atan2(y - L.y, x - L.x), d + 1) >= d - .5) best = Math.max(best, (1 - sm(40, 380, d)) * .43);
    }
    lamp[i] = best;
  }
  // vault links: across every low prop (and window sill) between two walkable cells on opposite sides
  const addLink = (i, j, ax, ay, bx, by, prop) => { const c = Math.hypot(ax - bx, ay - by) + 70; let l = links.get(i); if (!l) links.set(i, l = []); if (!l.some(k => k.to === j)) l.push({ to: j, cost: c, ax, ay, bx, by, prop }); };
  const cellAt = (x, y) => { const c = Math.floor(x / cs), r = Math.floor(y / cs); return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c; };
  for (const p of WORLD.LOW) {
    const r = p.rect, half = (p.cross === 'y' ? r.h : r.w) / 2 + 30;
    const lo = p.cross === 'y' ? r.x + 12 : r.y + 12, hi = p.cross === 'y' ? r.x + r.w - 12 : r.y + r.h - 12;
    for (let s = lo; s <= hi + 1; s += 24) {
      const A = p.cross === 'y' ? { x: s, y: p.cy - half } : { x: p.cx - half, y: s }, B = p.cross === 'y' ? { x: s, y: p.cy + half } : { x: p.cx + half, y: s };
      const i = cellAt(A.x, A.y), j = cellAt(B.x, B.y);
      if (i < 0 || j < 0 || cls[i] !== 1 || cls[j] !== 1) continue;
      addLink(i, j, cx(i), cy(i), cx(j), cy(j), p); addLink(j, i, cx(j), cy(j), cx(i), cy(i), p);
    }
  }
  return { cls, lamp, links, clr, cols, rows, N, cs, cx, cy, cellAt };
}

class Geo {
  constructor(a) {
    this.a = a; const key = a.key || 'level0';
    if (!STATIC.has(key)) STATIC.set(key, buildStatic(a));
    Object.assign(this, STATIC.get(key));
    this.W = a.W; this.H = a.H; this.rooms = a.rooms; this.lamps = a.lamps;
    this.gen = new Uint32Array(this.N); this.cg = new Uint32Array(this.N); this.gs = new Float32Array(this.N); this.from = new Int32Array(this.N); this.stamp = 0;
    this.heap = new Int32Array(this.N + 8); this.hf = new Float32Array(this.N);
    this.fails = [];                              // local light failures {x,y,r,until}
  }
  clear(x, y, r, mode = 'walk') { return this.a.clear(x, y, r, mode); }
  blockers(x, y, mode = 'walk') { return this.a.blockers(x, y, mode); }
  ray(x, y, ang, max) { return this.a.ray(x, y, ang, max); }
  isFloor(x, y) { return this.a.floor(Math.floor(x / 96), Math.floor(y / 96)); }
  los(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay); if (d < 1) return true; return this.a.ray(ax, ay, Math.atan2(by - ay, bx - ax), d + 1) >= d - .5; }
  /* line of vision to a body: walls and pillars block, and so does a counter when the body is crouched behind it */
  sees(ax, ay, bx, by, prof = 1) { if (!this.los(ax, ay, bx, by)) return false; if (prof < .8 && WORLD.concealedBy(ax, ay, bx, by)) return false; return true; }
  surface(x, y) { return WORLD.surfaceAt(x, y, this.rooms); }
  /* walkable straight line for a mover of radius r in a given mode */
  lineClear(ax, ay, bx, by, r = OL, mode = 'walk') {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 12);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!this.a.clear(ax + (bx - ax) * t, ay + (by - ay) * t, r, mode)) return false; }
    return true;
  }
  cellOf(x, y) { return this.cellAt(x, y); }
  passableFor(i, caps) { const c = this.cls[i]; return c === 1 || (c === 2 && caps.CAN_CRAWL) || (c === 3 && caps.CAN_USE_TIGHT_GAPS); }
  /* nearest usable cell to a point (the point itself may be inside a wall margin) */
  snap(x, y, caps, maxR = 5) {
    const c0 = Math.floor(x / this.cs), r0 = Math.floor(y / this.cs); let best = -1, bd = 1e18;
    for (let R = 0; R <= maxR; R++) {
      for (let r = r0 - R; r <= r0 + R; r++) for (let c = c0 - R; c <= c0 + R; c++) {
        if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== R) continue;
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
        const i = r * this.cols + c; if (!this.passableFor(i, caps)) continue;
        const d = Math.hypot(this.cx(i) - x, this.cy(i) - y); if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0 && R >= 1) break;
    }
    return best;
  }
  lightLevel(x, y, players) {                  // 0..1: how lit a point is (lamps, blackout, local failures, players' own lights)
    const i = this.cellAt(x, y); let a = 0;
    if (i >= 0 && !this.a.blackout()) { a = this.lamp[i]; for (const f of this.fails) if (f.until > this.now && Math.hypot(x - f.x, y - f.y) < f.r) a *= .06; }
    if (players) for (const p of players) { if (!p.light) continue; const q = this.a.qc(p, { x, y }, true); if (q > a) a = q; }
    return Math.min(1, .04 + a * 2.08);
  }
  /* A* over the 48px grid.  caps decide which cell classes are usable; vault links only for CAN_VAULT.  cost(i) may add expense (or Infinity). */
  path(x0, y0, x1, y1, caps, opts = {}) {
    const s = this.snap(x0, y0, caps), g = this.snap(x1, y1, caps, 6);
    if (s < 0 || g < 0) return null;
    if (s === g) return [{ x: x1, y: y1 }];
    const cols = this.cols, N = this.N, cs = this.cs, st = ++this.stamp, gen = this.gen, gs = this.gs, from = this.from, heap = this.heap, hf = this.hf, links = this.links, cls = this.cls, clr = this.clr;
    let hn = 0;
    const gx = this.cx(g), gy = this.cy(g), costFn = opts.cost, maxNodes = opts.maxNodes || 14000, canVault = caps.CAN_VAULT;
    const h = i => { const dx = Math.abs(this.cx(i) - gx), dy = Math.abs(this.cy(i) - gy); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const push = i => { heap[hn] = i; let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (hf[heap[p]] <= hf[heap[k]]) break; const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; } };
    const pop = () => { const top = heap[0]; heap[0] = heap[--hn]; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hn && hf[heap[l]] < hf[heap[m]]) m = l; if (r < hn && hf[heap[r]] < hf[heap[m]]) m = r; if (m === k) break; const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m; } return top; };
    gen[s] = st; gs[s] = 0; from[s] = -1; hf[s] = h(s); push(s);
    const cg = this.cg; let found = false, nodes = 0;
    const linkOf = new Map();
    while (hn) {
      const i = pop(); if (cg[i] === st) continue; cg[i] = st;
      if (i === g) { found = true; break; }
      if (++nodes > maxNodes) break;
      const c = i % cols, r = (i - c) / cols;
      for (let d = 0; d < 8; d++) {
        const dc = DIRS[d][0], dr = DIRS[d][1];
        const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
        const j = nr * cols + nc; if (!this.passableFor(j, caps)) continue;
        if (dc && dr && (!this.passableFor(r * cols + nc, caps) || !this.passableFor(nr * cols + c, caps))) continue;   // no corner cutting
        let step = (dc && dr ? 67.9 : 48) * (cls[j] === 1 ? 1 : cls[j] === 2 ? 2.2 : 4) + WALL_COST[clr[j]] * (cls[j] === 1 ? 1 : 0);
        if (costFn) { const ex = costFn(j); if (ex === Infinity) continue; step += ex; }
        const ng = gs[i] + step;
        if (gen[j] !== st || ng < gs[j]) { gen[j] = st; gs[j] = ng; from[j] = i; hf[j] = ng + h(j); push(j); linkOf.delete(j); }
      }
      if (canVault) { const L = links.get(i); if (L) for (const l of L) { const j = l.to; const ng = gs[i] + l.cost / Math.max(.4, caps.VAULT_SPEED || 1); if (gen[j] !== st || ng < gs[j]) { gen[j] = st; gs[j] = ng; from[j] = i; hf[j] = ng + h(j); push(j); linkOf.set(j, l); } } }
    }
    if (!found) return null;
    const out = []; let k = g;
    while (k !== s) { const l = linkOf.get(k); out.push({ x: this.cx(k), y: this.cy(k), link: l || null, c: cls[k] }); k = from[k]; }
    out.reverse();
    out.push({ x: x1, y: y1 });
    return out;
  }
}

/* ---------------------------------------------------------------- perception, memory, social awareness */
const POSTURE_VIS = [1, 1, 1.12, .62, .45, .72, 1, .4];     // stand walk run crouch crawl slide vault down (how visible a body is)
const KIND_GLARE = { flashlight: 1, headlamp: .85, lantern: .8, camcorder: .2 };

function newMemory() { return { p: new Map(), sounds: [], others: new Map(), visited: new Map() }; }
function rec(e, id) {
  let r = e.mem.p.get(id);
  if (!r) e.mem.p.set(id, r = { id, aw: 0, seen: false, seenAt: -99, heardAt: -99, lkx: 0, lky: 0, lvx: 0, lvy: 0, conf: 0, hx: 0, hy: 0, st: 0, stamina: 100, ex: 0, prof: 1, light: false, iso: 0, first: -99, lost: 0, hLoud: -99, hvx: 0, hvy: 0, crawl: null, crawlAt: -99 });
  return r;
}
function memAge(e, r, now) { return now - Math.max(r.seenAt, r.heardAt); }
function memHalfLife(e) { return lerp(7, 46, e.tr.MEMORY); }        // seconds until an old sighting is (mostly) forgotten
/* where might the player be now?  the last known position pushed along its last heading, with growing uncertainty */
function estimate(e, r, now, geo) {
  const age = Math.max(0, now - r.seenAt), sp = Math.hypot(r.lvx, r.lvy);
  const dur = Math.min(age, 3.2) * (sp > 20 ? 1 : 0), k = sp > 1 ? 1 / sp : 0;
  let D = Math.min(sp * dur * .55, 520);
  if (geo && D > 0) D = Math.max(0, Math.min(D, geo.ray(r.lkx, r.lky, Math.atan2(r.lvy, r.lvx), D + 40) - 34));   // it went that way - but not through a wall
  return { x: r.lkx + r.lvx * k * D, y: r.lky + r.lvy * k * D, unc: 60 + Math.min(1100, sp * age * .5 + age * 18) };
}

function updateVision(e, eng, dt, cands) {
  const geo = eng.geo, now = eng.now, cfg = e.sp.vision;
  e.seenNow.clear();
  for (const r0 of e.mem.p.values()) r0.seen = false;
  for (const p of cands) {
    if (!p.alive) continue;
    const r = rec(e, p.id), dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    let vis = false, strength = 0;
    const stName = W_SN[p.st] || 'stand';
    let range = cfg.range * (.5 + .7 * e.tr.VISION);
    const lit = geo.lightLevel(p.x, p.y, null), own = p.light ? (KIND_GLARE[p.kind] || 1) : 0;
    let lightF = cfg.dark ? .82 + .18 * Math.max(lit, own) : .3 + .7 * Math.max(lit, own * .9);
    if (p.light && !cfg.dark) lightF *= 1 + .55 * own;                         // a lit lantern is a beacon
    if (e.sp.lightSensitive) lightF *= 1 - e.tr.LIGHT_SENS * .15 * own;         // glare doesn't help a smiler see, it hurts
    const motion = .7 + .5 * clamp(p.sp / 172, 0, 1.4);
    range *= lightF * (POSTURE_VIS[p.st] || 1) * motion * (e.act === 'listen' ? .8 : 1);
    const floor = cfg.floor || 70;                                            // something crouched in the dark right beside it is noticed regardless of posture
    if (d <= Math.max(range, floor)) {
      const bearing = Math.atan2(dy, dx), inFov = d < 110 || Math.abs(angDiff(bearing, e.ang + (e.head || 0))) <= cfg.fov / 2;
      // under an occluder (a table, the wall round a hole) a body can only be made out from close by, whatever the light: not visible from across the room
      const cz = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y) : null;
      if (inFov && (!cz || d < cz.reveal) && geo.sees(e.x, e.y, p.x, p.y, p.prof)) { vis = true; strength = clamp(Math.pow(1 - d / Math.max(range, floor), .55), .08, 1); }
    }
    r.seen = vis; r.dist = d;
    if (vis) {
      r.aw = Math.min(1, r.aw + strength * dt * (cfg.gain || 3.2));
      if (r.seenAt < now - 6) r.first = now;
      const cw = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y, 34) : null; if (cw) { r.crawl = cw.id; r.crawlAt = now; } else if (now - r.crawlAt > 2) r.crawl = null;   // seen going into (or at the mouth of) a crawlspace: remembered
      r.seenAt = now; r.lkx = p.x; r.lky = p.y; r.lvx = p.vx; r.lvy = p.vy; r.conf = 1; r.st = p.st; r.stamina = p.stamina; r.ex = p.ex; r.prof = p.prof; r.light = p.light; r.lost = 0;
      e.seenNow.add(p.id);
    }
  }
  for (const r0 of e.mem.p.values()) if (!r0.seen) r0.lost += dt;
}

/* the sound bus delivers each event to every entity once */
function hearEvent(e, eng, ev) {
  const geo = eng.geo, d = Math.hypot(ev.x - e.x, ev.y - e.y);
  const focus = ev.src > 0 && ev.src === e.target && (e.state === S.HUNTING || e.state === S.SEARCHING) && (ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land') ? 1.3 : 1;   // a hunting animal tracks its prey's running footfalls further - careful movement gets no such penalty
  let eff = ev.r * (.42 + e.tr.HEARING * 1.05) * focus * (e.act === 'listen' ? 1.5 : 1) * (e.state === S.FEEDING ? .65 : 1) * (e.state === S.DORMANT ? .75 : 1) * (e.deaf > 0 ? .3 : 1);
  if (d > eff * 1.05) return;
  const clear = geo.los(e.x, e.y, ev.x, ev.y);
  if (!clear) eff *= .6;
  if (d > eff) return;
  const I = ev.I * Math.pow(1 - d / eff, .7);
  if (I < .03) return;
  const unc = (26 + d * .16) * (clear ? 1 : 1.75) * (1.55 - e.tr.INTELLIGENCE * .45) * (1.4 - e.tr.HEARING * .35) * (ev.type === 'breath' ? 1.5 : 1);
  const a = eng.rng() * TAU, m = Math.sqrt(eng.rng()) * unc, hx = ev.x + Math.cos(a) * m, hy = ev.y + Math.sin(a) * m;
  const h = { x: hx, y: hy, I, type: ev.type, t: eng.now, src: ev.src, unc, clear, ox: ev.x, oy: ev.y };
  e.hear = h; e.heardCount = (e.heardCount || 0) + 1;
  e.mem.sounds.unshift(h); if (e.mem.sounds.length > 8) e.mem.sounds.pop();
  if (ev.src > 0) {
    const r = rec(e, ev.src);
    const loud = I > .3 || ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land';
    if (loud) { const pdt = eng.now - r.hLoud; if (pdt > .15 && pdt < 1.6) { r.hvx = lerp(r.hvx, (hx - r.hx) / pdt, .5); r.hvy = lerp(r.hvy, (hy - r.hy) / pdt, .5); } else if (pdt >= 1.6) { r.hvx = 0; r.hvy = 0; } r.hLoud = eng.now; }   // where the footsteps are going
    r.heardAt = eng.now; r.hx = hx; r.hy = hy; r.aw = Math.min(1, r.aw + I * .9);
    if (eng.now - r.seenAt > 1.2) {                                              // not in sight: the sound is all we have
      const k = Math.min(1, I * 1.4 + .25);
      r.lkx = lerp(r.lkx, hx, r.conf < .35 ? 1 : k); r.lky = lerp(r.lky, hy, r.conf < .35 ? 1 : k);
      r.conf = Math.max(r.conf, .4 + .5 * I); r.st = ev.st !== undefined ? ev.st : r.st;
      if (ev.vx !== undefined) { r.lvx = ev.vx; r.lvy = ev.vy; }
    }
  }
  return h;
}

function decayMemory(e, dt, now) {
  const half = memHalfLife(e);
  for (const r of e.mem.p.values()) {
    if (!r.seen) { r.aw = Math.max(0, r.aw - dt * (.05 + .16 * (1 - e.tr.PERSISTENCE))); r.conf = Math.max(0, r.conf - dt / half); }
  }
  for (let i = e.mem.sounds.length - 1; i >= 0; i--) if (now - e.mem.sounds[i].t > 25) e.mem.sounds.splice(i, 1);
}

/* the strongest lead this entity has on any player: [record, score] */
function bestLead(e, now, filter) {
  let best = null, bs = 0;
  for (const r of e.mem.p.values()) {
    if (filter && !filter(r)) continue;
    const age = memAge(e, r, now);
    const s = r.aw * .8 + r.conf * .7 - Math.min(1, age / 30) * .3 + (r.seen ? .5 : 0);
    if (s > bs && r.conf > .02) { bs = s; best = r; }
  }
  return best ? [best, bs] : null;
}

/* SOCIAL AWARENESS: who else is around a victim, judged only from things this entity could perceive:
 *  sighting, footsteps / noise, a light beam glimpsed at range, or having seen them together a moment ago. */
function threatsAround(e, eng, victimId, cands) {
  const now = eng.now, out = [], v = cands.find(p => p.id === victimId), vx = v ? v.x : e.x, vy = v ? v.y : e.y;
  for (const p of cands) {
    if (p.id === victimId || !p.alive) continue;
    const r = e.mem.p.get(p.id); let cert = 0, how = '', x = p.x, y = p.y;
    if (r && r.seen) { cert = 1; how = 'seen'; }
    else if (r && now - r.heardAt < 2.6 && Math.hypot(r.hx - vx, r.hy - vy) < 1100) { cert = .65; how = 'heard'; x = r.hx; y = r.hy; }
    else if (p.light && Math.hypot(p.x - e.x, p.y - e.y) < 1700 && eng.geo.los(e.x, e.y, p.x, p.y)) { cert = .6; how = 'light'; }
    else if (r && now - r.seenAt < 9 && Math.hypot(r.lkx - vx, r.lky - vy) < 650) { cert = .42 * (1 - (now - r.seenAt) / 9); how = 'together'; x = r.lkx; y = r.lky; }
    if (cert <= 0) continue;
    const d = Math.hypot(x - vx, y - vy), toV = Math.atan2(vy - y, vx - x), heading = Math.atan2(p.vy, p.vx);
    const approaching = how !== 'together' && p.sp > 50 && Math.abs(angDiff(heading, toV)) < 1.1 && d < 1400;
    out.push({ id: p.id, cert, how, dist: d, approaching, x, y, seesUs: how === 'seen' });
  }
  return out;
}
const W_SN = WORLD.SN;

/* ---------------------------------------------------------------- entities: personality, movement, traversal, state plumbing */
function personality(sp, rng) {
  const tr = {};
  for (const k of TRAITS) tr[k] = clamp((sp.traits[k] ?? .5) + (rng() * 2 - 1) * (sp.jitter ?? .12), .02, .98);   // same species, different individuals
  return tr;
}
function mkEntity(eng, kind, id, x, y, opts = {}) {
  const sp = SPECIES[kind], tr = personality(sp, eng.rng);
  const e = {
    id, kind, sp, tr, caps: Object.assign({}, sp.caps, opts.caps || {}),
    x, y, ang: eng.rng() * TAU, head: 0, speed: 0, r: sp.radius, rc: sp.clearance || OL,
    state: sp.initial || S.ROAMING, act: '', stateT: 0, actT: 0, t: 0,
    goal: null, path: [], pathAge: 99, goalKey: '', trav: null, mode: 'walk', aim: null, aimT: 0,
    mem: newMemory(), seenNow: new Set(), hear: null, heardCount: 0, deaf: 0,
    mood: { arousal: .1, frustration: 0, excitement: 0, boredom: 0 },
    tier: 'near', thinkT: eng.rng() * .1, target: null, stuck: 0, home: { x, y }, spawn: { x, y },
    cap: null, cool: {}, dbg: {}, fade: 1, vis: 1, pack: null,
    vel: { x: 0, y: 0 }, moved: 0, wake: 0, alpha: 1,
  };
  if (sp.init) sp.init(eng, e, opts);
  return e;
}
function setState(e, st, act = '') {
  if (e.state !== st) { e.prevState = e.state; e.state = st; e.stateT = 0; e.stateChanges = (e.stateChanges || 0) + 1; }
  if (e.act !== act) { e.act = act; e.actT = 0; }
}
function setAct(e, act) { if (e.act !== act) { e.act = act; e.actT = 0; } }

const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
/* navigation record (debug + tests): counters and the last few repath reasons. Cheap: a few numbers per entity. */
function navOf(e) { return e.nav || (e.nav = { plans: 0, why: [], contacts: 0, bonks: 0, stuckN: 0, recover: 0, emergency: 0, direct: 0, last: '' }); }
function navWhy(e, why, now) { const n = navOf(e); n.plans++; n.last = why; n.why.push([+now.toFixed(2), why]); if (n.why.length > 12) n.why.shift(); }
function moveCollide(eng, e, dx, dy) {
  const L = Math.hypot(dx, dy);
  if (L > 10 && !e.trav) {                                                 // swept: a fast move (lunge, skid) is taken in short steps so nothing thin is ever jumped
    const n = Math.ceil(L / 10); let mv = 0;
    for (let k = 0; k < n; k++) { const m = moveStep(eng, e, dx / n, dy / n); mv += m; if (m < L / n * .2) break; }
    return mv;
  }
  return moveStep(eng, e, dx, dy);
}
function moveStep(eng, e, dx, dy) {
  const geo = eng.geo, r = e.rc, ox = e.x, oy = e.y, mode = e.trav ? 'walk' : e.mode; let hit = false;
  if (e.trav) { e.x += dx; e.y += dy; return Math.hypot(dx, dy); }
  for (const ax of [0, 1]) {
    if (ax === 0) e.x += dx; else e.y += dy;
    for (const t of geo.blockers(e.x, e.y, mode)) {
      const nx = Math.max(t.x, Math.min(e.x, t.x + t.w)), ny = Math.max(t.y, Math.min(e.y, t.y + t.h)), ddx = e.x - nx, ddy = e.y - ny, d = Math.hypot(ddx, ddy);
      if (d < r) { hit = true; if (d > 0) { e.x += ddx / d * (r - d); e.y += ddy / d * (r - d); } else { if (ax === 0) e.x = ox; else e.y = oy; } }
    }
  }
  const mv = Math.hypot(e.x - ox, e.y - oy);
  if (hit) { const n = navOf(e); n.contacts++; if (e.speed > 150 && mv < Math.hypot(dx, dy) * .5) n.bonks++; }
  return mv;
}
/* which prop mode this entity moves in right now (crawling under things / through holes only along a path that asks for it) */
function modeFor(e) {
  let m = 'walk';
  const c0 = e.cellCls | 0;
  let mx = c0;
  for (let i = 0; i < Math.min(2, e.path.length); i++) mx = Math.max(mx, e.path[i].c | 0);
  if (mx === 3 && e.caps.CAN_USE_TIGHT_GAPS) m = 'crawl';
  else if (mx >= 2 && e.caps.CAN_CRAWL) m = mx === 3 && e.caps.CAN_USE_TIGHT_GAPS ? 'crawl' : 'under';
  return m;
}

/* ROUTE --------------------------------------------------------------------------------------------------------------------------------
 * A* over the 48 px grid (Geo.path), then string-pulled: from where the entity stands, each leg goes to the farthest waypoint that can be reached in a
 * straight line with NAV_MARGIN px to spare beyond the collision radius.  Vault links and crawl / tight-gap cells are never smoothed across. */
const NAV_MARGIN = 7;
function smoothPath(geo, e, p) {
  if (!p || p.length < 2) return p;
  const r = e.rc + NAV_MARGIN, out = []; let ax = e.x, ay = e.y, i = 0;
  const plain = k => !p[k].link && (p[k].c | 0) <= 1;
  while (i < p.length) {
    if (!plain(i)) { out.push(p[i]); ax = p[i].x; ay = p[i].y; i++; continue; }
    let j = i;
    for (const rr of [r, e.rc + 3, e.rc + .5]) {                            // as much room as the place allows: a narrow hall still gets straight legs
      let miss = 0;
      for (let k = i + 1; k < p.length && k - i <= 30; k++) {
        if (!plain(k)) break;
        if (geo.lineClear(ax, ay, p[k].x, p[k].y, rr, 'walk')) { j = k; miss = 0; } else if (++miss >= 3) break;
      }
      if (j > i + 1 || j === p.length - 1) break;
    }
    out.push(p[j]); ax = p[j].x; ay = p[j].y; i = j + 1;
  }
  // bends get room: a bend waypoint on a grid cell tight against a wall end is eased (up to 24 px) toward the side with more room, as long as both
  // legs stay clear - so the body rounds the corner instead of clipping it
  const want = e.rc + NAV_MARGIN + 6;
  for (let k = 0; k < out.length - 1; k++) {
    const w = out[k]; if (w.link || (w.c | 0) > 1 || geo.clear(w.x, w.y, want, 'walk')) continue;
    const pv = k ? out[k - 1] : e, nx = out[k + 1]; if (nx.link) continue;
    let best = null, bs = -1;
    for (let q = 0; q < 8; q++) for (const d of [12, 24]) {
      const x = w.x + Math.cos(q * Math.PI / 4) * d, y = w.y + Math.sin(q * Math.PI / 4) * d, room = geo.clear(x, y, want, 'walk') ? 2 : geo.clear(x, y, e.rc + NAV_MARGIN, 'walk') ? 1 : 0;
      if (room > bs && room > 0 && geo.lineClear(pv.x, pv.y, x, y, e.rc + .5, 'walk') && geo.lineClear(x, y, nx.x, nx.y, e.rc + .5, 'walk')) { bs = room; best = { x, y }; if (room === 2 && d === 12) break; }
    }
    if (best) out[k] = Object.assign({}, w, best);
  }
  return out;
}
function plan(eng, e, gx, gy, opts = {}) {
  const key = Math.round(gx / 48) + ',' + Math.round(gy / 48);
  let cost = opts.cost || e.sp.pathCost && e.sp.pathCost(eng, e);
  if (opts.avoid) { const A = opts.avoid, base = cost, geo = eng.geo; cost = j => { const d = Math.hypot(geo.cx(j) - A.x, geo.cy(j) - A.y); return (d < A.r ? 600 : 0) + (base ? base(j) : 0); }; }   // an alternate route: keep off the spot we got stuck at
  navWhy(e, opts.why || 'plan', eng.now); eng.stats.paths = (eng.stats.paths || 0) + 1;
  const p = eng.geo.path(e.x, e.y, gx, gy, e.caps, { cost, maxNodes: opts.maxNodes });
  e.goal = { x: gx, y: gy }; e.goalKey = key; e.pathAge = 0; e.aim = null; e.carrot = null; e.ext = 0;
  if (!p) { e.path = []; e.unreachable = eng.now; return false; }
  e.path = smoothPath(eng.geo, e, p); e.unreachable = 0; return true;
}
/* go straight at a point (the caller has checked the line is walkable) */
function directTo(eng, e, gx, gy) { if (e.goalKey !== 'direct') { navOf(e).direct++; navWhy(e, 'direct', eng.now); navOf(e).plans--; } e.path = [{ x: gx, y: gy }]; e.goal = { x: gx, y: gy }; e.goalKey = 'direct'; e.pathAge = 0; }
/* is a straight run at (tx,ty) safe?  with hysteresis: once running straight it stays straight while the body itself fits; to switch into it the line
 * needs the full margin (so DIRECT -> ROUTE -> DIRECT does not flicker at the edge of a doorframe) */
function directOk(eng, e, tx, ty, maxD = 700) {
  if (Math.hypot(tx - e.x, ty - e.y) > maxD) return false;
  return eng.geo.lineClear(e.x, e.y, tx, ty, e.rc + (e.goalKey === 'direct' ? 1 : NAV_MARGIN), 'walk');
}
/* set a destination.  Route commitment: a moving goal only costs a new route when it moved meaningfully (more than ~12 % of the way, 40 px minimum)
 * or when the last leg can no longer reach it; small moves just slide the end of the route along.  Every new route records why (debug overlay). */
function goTo(eng, e, gx, gy, opts = {}) {
  if (e.trav) return true;
  const G = e.goal, far = Math.hypot(gx - e.x, gy - e.y);
  if (!G || e.goalKey === 'direct') return plan(eng, e, gx, gy, Object.assign({}, opts, { why: G ? 'from-direct' : 'new-goal' }));
  if (!e.path.length) { if (e.pathAge > .3) return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'no-path' })); return true; }
  const moved = Math.hypot(gx - G.x, gy - G.y);
  if (moved > Math.max(40, far * .12)) return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'goal-moved' }));
  if (moved > 3) {
    const n = e.path.length, last = e.path[n - 1], prev = n > 1 ? e.path[n - 2] : e;
    if (!last.link && eng.geo.lineClear(prev.x, prev.y, gx, gy, e.rc, 'walk')) { last.x = gx; last.y = gy; G.x = gx; G.y = gy; }
    else if (!last.link && (e.ext || 0) < 3 && eng.geo.lineClear(last.x, last.y, gx, gy, e.rc, 'walk')) { e.path.push({ x: gx, y: gy }); G.x = gx; G.y = gy; e.ext = (e.ext || 0) + 1; }   // it slipped round a corner a little: extend the route by one leg
    else return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'goal-behind-corner' }));
  }
  if (e.pathAge > Math.max(3, (opts.every ?? 1.1) * 4)) return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'refresh' }));     // a slow safety refresh only
  return true;
}
function beginTrav(eng, e, l) {
  const dur = clamp(.5 / Math.max(.3, e.caps.VAULT_SPEED || 1), .25, 1.4);
  e.trav = { ax: e.x, ay: e.y, bx: l.bx, by: l.by, t: 0, dur, prop: l.prop, dir: Math.atan2(l.by - e.y, l.bx - e.x) }; e.travCount = (e.travCount || 0) + 1;
}
function stepTrav(eng, e, dt) {
  const v = e.trav; v.t += dt; turnTo(e, v.dir, 9, dt); const k = clamp(v.t / v.dur, 0, 1), s = k * k * (3 - 2 * k);
  const px = e.x, py = e.y; e.x = v.ax + (v.bx - v.ax) * s; e.y = v.ay + (v.by - v.ay) * s;
  e.speed = Math.hypot(e.x - px, e.y - py) / dt; e.moved = e.speed * dt;
  if (k >= 1) { e.trav = null; e.speed = Math.min(e.speed, 220); e.path.shift(); e.pathAge = 0; }
}
/* LOCOMOTION ---------------------------------------------------------------------------------------------------------------------------
 * The body moves along its heading; the heading turns toward the wanted direction at the species' rate, which falls with speed (a hound at full chase
 * turns slowly: that is its character).  vcap: an upper speed the steering layer asks for (corner braking). */
function steerTo(eng, e, tx, ty, vmax, dt, o = {}) {
  const want = Math.atan2(ty - e.y, tx - e.x), err = angDiff(want, e.ang), sp = e.sp;
  const ratio = clamp(e.speed / (sp.vTop || 300), 0, 1);
  const turn = e.caps.TURNING_ABILITY * (o.turnMul || 1) * (1 - (sp.turnPenalty || .55) * ratio) * (e.mood.frustration > .6 ? 1.12 : 1);
  e.ang = (e.ang + clamp(err, -turn * dt, turn * dt) + TAU) % TAU;
  const align = Math.cos(Math.min(Math.abs(err), 1.5));
  let target = o.hold ? 0 : vmax * (o.noSlow ? 1 : clamp(align, .1, 1));
  if (o.vcap !== undefined) target = Math.min(target, o.vcap);
  const acc = (e.caps.ACCELERATION || 500) * (o.accMul || 1);
  // feeler: what is straight ahead of the body (centre and both shoulders).  A wall inside the stopping distance brakes it - and a slower body turns
  // tighter - instead of the body driving on at 3/4 speed and scraping along the wall while its heading comes round.  (Not for a wanted wall stop.)
  if (e.speed > 30 && !o.noFeel) {
    const g = eng.geo, px = -Math.sin(e.ang) * e.rc * .85, py = Math.cos(e.ang) * e.rc * .85, reach = Math.min(160, e.rc + 16 + e.speed * e.speed / (2 * acc * 2.2));
    const free = Math.min(g.ray(e.x, e.y, e.ang, reach), g.ray(e.x + px, e.y + py, e.ang, reach), g.ray(e.x - px, e.y - py, e.ang, reach));
    if (free < reach - 1) { const room = free - e.rc - 6, vf = room > 4 ? Math.sqrt(2 * acc * 2.2 * room) + 28 : 0; /* nose to the wall: stop and turn on the spot, do not push on */ if (vf < target) { target = vf; navOf(e).feel = (navOf(e).feel || 0) + 1; } }
  }
  e.speed = approach(e.speed, target, (target > e.speed ? acc : acc * 2.2) * dt);
  const step = e.speed * dt;
  e.moved = moveCollide(eng, e, Math.cos(e.ang) * step, Math.sin(e.ang) * step);
  const intent = Math.max(step, (o.hold ? 0 : vmax) * dt * .5);                 // stuck = it wants to move and does not (measured against intent, not the speed it was braked to)
  if (intent > .5 && e.moved < intent * .3) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt * 1.5);
  e.vel.x = Math.cos(e.ang) * e.speed; e.vel.y = Math.sin(e.ang) * e.speed; e.want = want;
}
/* the fastest this species can take a bend of `theta` rad in about `R` px of room: from its own turn rate, which falls with speed */
function cornerSpeed(e, theta, R) {
  const sp = e.sp, T = e.caps.TURNING_ABILITY, pen = sp.turnPenalty || .55, top = sp.vTop || 300;
  const vR = R * T / (1 + R * T * pen / top);                            // the speed whose turning circle is R (solves v = R * T * (1 - pen * v / top))
  if (theta < .2) return 1e4;                                            // a gentle bend: no braking at all
  if (theta <= Math.PI / 2) return vR / Math.pow(Math.sin(theta), .8);   // 90 deg -> vR; 60 deg -> 1.12 vR; 30 deg -> 1.74 vR
  return vR * (1 - .35 * (theta - Math.PI / 2) / (Math.PI / 2));          // sharper than a right angle: slower still
}
/* LOCAL STEERING -----------------------------------------------------------------------------------------------------------------------
 * follow(): the route is followed through a "carrot" a short way ahead along it (farther at speed), pulled back until the straight line to it has room,
 * so bends are rounded instead of reached-stopped-turned.  Before a bend the entity brakes to the speed its turn rate allows (competence); it still
 * carries momentum and may run a little wide (character).  Returns 'arrived' | 'moving' | 'nopath'. */
function carrotOf(eng, e, look) {
  const geo = eng.geo; let px = e.x, py = e.y, left = look, cx = e.path[0].x, cy = e.path[0].y;
  for (let k = 0; k < e.path.length; k++) {
    const w = e.path[k]; if (w.link) { cx = w.link.ax; cy = w.link.ay; break; }
    const d = Math.hypot(w.x - px, w.y - py);
    if (d >= left) { cx = px + (w.x - px) * left / d; cy = py + (w.y - py) * left / d; break; }
    left -= d; px = w.x; py = w.y; cx = w.x; cy = w.y;
  }
  let ok = geo.lineClear(e.x, e.y, cx, cy, e.rc + .5, e.mode);
  for (let t = 0; t < 3 && !ok; t++) { cx = (cx + e.path[0].x) / 2; cy = (cy + e.path[0].y) / 2; ok = geo.lineClear(e.x, e.y, cx, cy, e.rc + .5, e.mode); }   // never aim through a corner
  return { x: cx, y: cy, ok };
}
function follow(eng, e, dt, vmax, o = {}) {
  const geo = eng.geo;
  e.cellCls = geo.cls[geo.cellAt(e.x, e.y)] | 0;
  e.mode = modeFor(e);
  if (e.trav) { stepTrav(eng, e, dt); return 'moving'; }
  const arrive = o.arrive ?? 18;
  while (e.path.length) {
    const wp = e.path[0], last = e.path.length === 1, d = Math.hypot(wp.x - e.x, wp.y - e.y);
    if (wp.link) { const L = wp.link; if (Math.hypot(L.ax - e.x, L.ay - e.y) < 28) { beginTrav(eng, e, L); return 'moving'; } break; }
    if (d < (last ? arrive : 26)) { e.path.shift(); continue; }
    // passed it already (the next leg is now straight from here): drop it rather than turning back for it
    if (!last && !e.path[1].link && (e.path[1].c | 0) <= 1 && d < 110 && geo.lineClear(e.x, e.y, e.path[1].x, e.path[1].y, e.rc + 2, e.mode)) { e.path.shift(); continue; }
    break;
  }
  const wp = e.path[0];
  if (!wp) { e.speed = approach(e.speed, 0, (e.caps.ACCELERATION || 500) * 2.2 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); e.carrot = null; return e.goal && Math.hypot(e.goal.x - e.x, e.goal.y - e.y) > (o.arrive ?? 18) + 30 ? 'nopath' : 'arrived'; }
  // the carrot
  let tx, ty;
  if (e.unst && eng.now < e.unst.until) { tx = e.x + Math.cos(e.unst.dir) * 60; ty = e.y + Math.sin(e.unst.dir) * 60; }       // stuck recovery, step 1: a short side-step
  else if (wp.link) { e.unst = null; tx = wp.link.ax; ty = wp.link.ay; }
  else {
    e.unst = null; const c = carrotOf(eng, e, clamp(e.speed * .42, 64, 150)); tx = c.x; ty = c.y;
    if (!c.ok) {
      // the straight line to the next point clips a corner (it came in at an angle, or was pushed off its leg): slide round it - the nearest heading on
      // either side of the wanted one that has a short clear run.  Only if there is none is the route itself no longer valid from here.
      const a0 = Math.atan2(ty - e.y, tx - e.x); let got = false;
      const pref = e.slideSide && eng.now - e.slideSide.t < .6 ? e.slideSide.s : 1;      // keep sliding round the same side for a moment (no left-right-left dithering)
      for (let k = 1; k <= 8 && !got; k++) for (const sgn of [pref, -pref]) {
        const a = a0 + sgn * k * .16, qx = e.x + Math.cos(a) * 44, qy = e.y + Math.sin(a) * 44;
        if (geo.lineClear(e.x, e.y, qx, qy, e.rc + .5, e.mode)) { tx = e.x + Math.cos(a) * 70; ty = e.y + Math.sin(a) * 70; got = true; e.slideSide = { s: sgn, t: eng.now }; navOf(e).slide = (navOf(e).slide || 0) + 1; break; }
      }
      if (!got && e.goal && e.goalKey !== 'direct' && eng.now - (e.legT || 0) > .5) { e.legT = eng.now; plan(eng, e, e.goal.x, e.goal.y, { why: 'off-route' }); if (e.path[0]) { const c2 = carrotOf(eng, e, 64); tx = c2.x; ty = c2.y; } }
    }
  }
  // the aim point is low-passed (~70 ms): when it flicks between "full look-ahead" and "pulled back at a door jamb" the heading does not dither
  if (e.carrot && !e.unst && Math.hypot(tx - e.carrot.x, ty - e.carrot.y) < 160) { const k = 1 - Math.exp(-dt * 14); tx = e.carrot.x + (tx - e.carrot.x) * k; ty = e.carrot.y + (ty - e.carrot.y) * k; }
  e.carrot = { x: tx, y: ty };
  // corner braking: the bend at the next waypoint, and the speed that bend allows
  let vcap;
  if (e.path.length > 1 && !wp.link) {
    const n1 = e.path[1], nx = n1.link ? n1.link.ax : n1.x, ny = n1.link ? n1.link.ay : n1.y, a0 = Math.atan2(wp.y - e.y, wp.x - e.x), a1 = Math.atan2(ny - wp.y, nx - wp.x);
    const theta = Math.abs(angDiff(a1, a0)), dC = Math.hypot(wp.x - e.x, wp.y - e.y);
    const vC = cornerSpeed(e, theta, e.kind === 'hound' ? 115 : 80), dec = (e.caps.ACCELERATION || 500) * 2.2;
    vcap = Math.sqrt(vC * vC + 2 * dec * Math.max(0, dC - 40));
  } else if (e.path.length === 1 && (o.arrive ?? 18) < 40) {                 // the last waypoint: arrive without ramming whatever is behind it
    const dL = Math.hypot(wp.x - e.x, wp.y - e.y), dec = (e.caps.ACCELERATION || 500) * 2.2;
    if (!geo.lineClear(wp.x, wp.y, wp.x + Math.cos(e.ang) * 60, wp.y + Math.sin(e.ang) * 60, e.rc, e.mode)) vcap = Math.sqrt(90 * 90 + 2 * dec * Math.max(0, dL - 20));
  }
  steerTo(eng, e, tx, ty, vmax, dt, Object.assign({}, o, { vcap }));
  // stuck recovery ladder: 1 side-step (at .35 s), 2 new route (.9 s), 3 an alternate route that keeps off this spot (2nd time), 4 drop the route (4th)
  if (e.stuck > .35 && !e.unst) {
    const want = e.want ?? e.ang; let best = null, bs = -1e9;
    for (let k = 0; k < 12; k++) { const a = want + (k - 6) / 12 * TAU, free = geo.ray(e.x, e.y, a, 90), sc = free - Math.abs(angDiff(a, want)) * 25; if (free > e.rc + 20 && sc > bs) { bs = sc; best = a; } }
    if (best !== null) { e.unst = { dir: best, until: eng.now + .45 }; navOf(e).recover++; }
  }
  if (e.stuck > .9) {
    const nv = navOf(e); nv.stuckN++; e.stuck = 0; e.pathAge = 99; e.aim = null; e.unst = null; e.nudge = (e.nudge || 0) + 1;
    if (e.goal) plan(eng, e, e.goal.x, e.goal.y, e.nudge >= 2 ? { why: 'stuck-alternate', avoid: { x: e.x, y: e.y, r: 70 } } : { why: 'stuck' });
    if (e.nudge > 3) { e.nudge = 0; e.path = []; }
  } else if (e.moved > 2 && e.nudge) e.nudgeOk = (e.nudgeOk || 0) + dt;
  if (e.nudgeOk > 3) { e.nudge = 0; e.nudgeOk = 0; }
  return 'moving';
}
function stopMoving(eng, e, dt) {
  e.speed = approach(e.speed, 0, (e.caps.ACCELERATION || 500) * 2.4 * dt);
  if (e.speed > 1) e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); else e.moved = 0;
}
function turnTo(e, dir, rate, dt) { e.ang = (e.ang + clamp(angDiff(dir, e.ang), -rate * dt, rate * dt) + TAU) % TAU; }
function faceToward(e, tx, ty, dt, rate = 4) {
  const err = angDiff(Math.atan2(ty - e.y, tx - e.x), e.ang);
  e.ang = (e.ang + clamp(err, -rate * dt, rate * dt) + TAU) % TAU;
  return Math.abs(err);
}
function moodTick(e, dt) {
  const m = e.mood;
  m.arousal = Math.max(0, m.arousal - dt * .12); m.excitement = Math.max(0, m.excitement - dt * .1); m.frustration = Math.max(0, m.frustration - dt * (.03 + .03 * (1 - e.tr.AGGRESSION)));
  if (e.state === S.ROAMING || e.state === S.HIDDEN || e.state === S.DORMANT) m.boredom = Math.min(1, m.boredom + dt * .01); else m.boredom = Math.max(0, m.boredom - dt * .1);
}
function tierOf(e, eng) {
  if (e.cap || e.commit) return 'near';                                  // a capture or a kill still playing out is always fully simulated (it has a clock to finish)
  const near = eng.nearestPlayerDist(e.x, e.y);
  return near < 1900 ? 'near' : near < 3800 ? 'mid' : 'far';
}
/* far-away entities do not run perception or steering: they drift along cached routes on a slow clock */
function coarseMove(eng, e, dt) {
  if (!e.path.length) { e.speed = 0; return false; }
  let left = (e.sp.roamSpeed || 90) * dt, moved = 0;
  while (left > 0 && e.path.length) {
    const wp = e.path[0], d = Math.hypot(wp.x - e.x, wp.y - e.y);
    if (d <= left) { e.x = wp.x; e.y = wp.y; left -= d; moved += d; e.path.shift(); }
    else { e.ang = Math.atan2(wp.y - e.y, wp.x - e.x); e.x += Math.cos(e.ang) * left; e.y += Math.sin(e.ang) * left; moved += left; left = 0; }
  }
  e.speed = moved / dt; return true;
}
function randomFloor(eng, e, minD, maxD, tries = 40) {
  const geo = eng.geo;
  for (let i = 0; i < tries; i++) {
    const a = eng.rng() * TAU, d = lerp(minD, maxD, eng.rng()), x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
    if (x < 100 || y < 100 || x > geo.W - 100 || y > geo.H - 100) continue;
    const c = geo.cellAt(x, y); if (c < 0 || geo.cls[c] !== 1) continue;
    return { x: geo.cx(c), y: geo.cy(c) };
  }
  return null;
}

/* ---------------------------------------------------------------- capture and kill selection
 * CAUGHT is not DEAD.  When an attack lands the entity looks at the situation (who else is near, how secure the spot is,
 * what it is like) and either kills quickly or - if it is the playful kind, the victim is alone and nobody is coming - toys
 * with its prey: knocks it down, circles, stares, backs off, drags, lets it crawl, lets it go (false hope) and eventually
 * kills.  Interruptions (a light coming, a loud noise, another entity) change its mind, depending on its personality. */
const pickW = (rng, items) => { let t = 0; for (const it of items) t += Math.max(0, it.w); if (t <= 0) return items[0].k; let r = rng() * t; for (const it of items) { r -= Math.max(0, it.w); if (r <= 0) return it.k; } return items[items.length - 1].k; };

function openArcs(geo, x, y, R = 380, n = 24) {            // how many ways out are there from this spot?
  const open = [];
  for (let i = 0; i < n; i++) open.push(geo.ray(x, y, i / n * TAU, R) >= R - 6);
  let arcs = 0, count = open.filter(Boolean).length;
  for (let i = 0; i < n; i++) if (open[i] && !open[(i + n - 1) % n]) arcs++;
  return { arcs: count === n ? 1 : arcs, frac: count / n, open };
}
function wallBehind(geo, x, y, dirx, diry, maxD = 128) {   // a real wall right behind the victim along the attack direction
  const a = Math.atan2(diry, dirx), d = geo.ray(x, y, a, maxD + 40);
  if (d < 55 || d > maxD) return null;
  const side1 = geo.ray(x, y, a + .5, maxD + 40), side2 = geo.ray(x, y, a - .5, maxD + 40);
  if (side1 < 45 || side2 < 45) return null;                // in a corner: not clean enough
  const hx = x + Math.cos(a) * d, hy = y + Math.sin(a) * d;
  return { x: hx, y: hy, dist: d, nx: -Math.cos(a), ny: -Math.sin(a), ang: a };
}
function assess(eng, e, pv, attack) {
  const cands = eng.candidates(e, 2200), th = threatsAround(e, eng, pv.id, cands);
  const geo = eng.geo, arcs = openArcs(geo, pv.x, pv.y);
  let danger = 0, approaching = 0, seeing = 0;
  for (const t of th) { danger += t.cert * (1 - clamp(t.dist / 1500, 0, 1)); if (t.approaching && t.cert >= .5) approaching++; if (t.seesUs) seeing++; }
  const lit = geo.lightLevel(pv.x, pv.y, null);
  const rel = angDiff(Math.atan2(pv.y - e.y, pv.x - e.x), pv.angle);   // ~0: the victim faces away from the attacker, ~PI: faces it
  return { threats: th, danger, approaching, seeing, iso: clamp(1 - danger * 1.1, 0, 1), deadEnd: arcs.arcs <= 1 && arcs.frac < .34, arcs, lit, rel, facing: Math.abs(rel) > 2.0, behind: Math.abs(rel) < 1.0 };
}
function chooseMode(eng, e, ctx) {
  if (eng.forceCapture) return eng.forceCapture;                        // admin override (DEATHS tab): every catch is a quick kill / every catch is played with
  const sp = e.sp.capture, q = sp.quick(e, ctx);
  return eng.rng() < q ? 'quick' : 'play';
}
function pickVariant(eng, e, pv, ctx, attack) {
  const hist = eng.recentKills[e.kind] || (eng.recentKills[e.kind] = []);
  const items = e.sp.capture.variants(eng, e, pv, ctx, attack);
  const n = hist.length, twice = n >= 2 && hist[n - 1] === hist[n - 2] ? hist[n - 1] : null;             // never a third identical death in a row when there is any alternative
  for (const it of items) { const i = hist.lastIndexOf(it.k); if (i >= 0) { const age = n - i; it.w *= age === 1 ? .35 : age === 2 ? .6 : .8; } if (it.k === twice) it.w *= .06; }
  const v = pickW(eng.rng, items.filter(i => i.w > 0));
  hist.push(v); if (hist.length > 6) hist.shift();
  return v;
}
function beginCapture(eng, e, pv, attack) {
  if (pv.caught || e.cap || !pv.alive) return null;
  const ctx = assess(eng, e, pv, attack);
  const cap = { id: ++eng.capId, pid: pv.id, eid: e.id, kind: e.sp.name, t: 0, phase: 'grab', ctx, attack, mode: attack && attack.force ? attack.force : chooseMode(eng, e, ctx), variant: null, plan: null, decideAt: 0, plays: 0, released: false, interrupts: 0, log: [], pos: { x: pv.x, y: pv.y } };
  e.cap = cap; pv.caught = cap; eng.caps.push(cap);
  e.dbg.capture = { mode: cap.mode, danger: +ctx.danger.toFixed(2), iso: +ctx.iso.toFixed(2), deadEnd: ctx.deadEnd, approaching: ctx.approaching };
  if (cap.mode === 'quick') { killNow(eng, cap, pv, e, 'quick'); return cap; }
  cap.phase = 'down'; cap.phaseT = 0; cap.down = rand(eng, 1.0, 1.9);
  cap.decideAt = rand(eng, 5, 15) * (.7 + .5 * e.tr.PATIENCE);          // the tense stretch before the next major decision
  cap.variant = null;
  eng.emit({ t: 'caught', pid: pv.id, eid: e.id, kind: e.sp.name, ph: 'down', from: { x: e.x, y: e.y }, ang: Math.atan2(pv.y - e.y, pv.x - e.x) });
  e.sp.capture.onBegin && e.sp.capture.onBegin(eng, e, cap, pv);
  return cap;
}
const rand = (eng, a, b) => a + eng.rng() * (b - a);

function killNow(eng, cap, pv, e, why) {
  if (cap.phase === 'done') return;
  const ctx = cap.phase === 'grab' ? cap.ctx : assess(eng, e, pv, cap.attack || {});
  const ang = Math.atan2(pv.y - e.y, pv.x - e.x), forced = cap.attack && cap.attack.preview ? cap.attack.variant : null;
  if (forced) why = 'preview';
  ctx.wall = wallBehind(eng.geo, pv.x, pv.y, Math.cos(ang), Math.sin(ang));       // the wall the victim would be driven into: decided once, used for the choice and the record
  const variant = forced || pickVariant(eng, e, pv, ctx, cap.attack || {});       // a preview (admin) names its variant and leaves the "recent kills" memory alone
  const geo = { ax: e.x, ay: e.y, aa: ang, wall: variant === 'C' ? ctx.wall : null };
  cap.variant = variant; cap.phase = 'done'; cap.why = why;
  pv.alive = false;                                                        // dead from this instant: nothing else gets to capture or kill the same person in this very tick
  e.dbg.capture = Object.assign(e.dbg.capture || {}, { variant, why });
  eng.emit({ t: 'kill', pid: pv.id, eid: e.id, kind: e.sp.name, variant, why, geo, victim: { x: pv.x, y: pv.y, a: pv.angle } });
  eng.sites.push({ x: pv.x, y: pv.y, t: eng.now, kind: e.kind, pid: pv.id, fed: 0 });
  if (eng.sites.length > 12) eng.sites.shift();
  finishCapture(eng, cap, pv, e);
  if (e.kind === 'hound') { beginCommit(eng, e, pv, variant, ctx); return; }
  e.sp.capture.afterKill && e.sp.capture.afterKill(eng, e, ctx, pv);
}
/* KILL COMMITMENT (v20): a hound that kills stays on its kill for as long as the death takes to play out on every screen (the clients' death lengths,
 * dphys.js DURS), ignoring everyone else; only then does it make its after-kill decision (next victim / guard / feed / leave) - with the situation as it is THEN.
 * The victim's client reports where the attacker ended up in the animation (drag etc.); the hound is set down there if that spot is close and clear. */
const KILL_DUR = { A: 4.5, B: 4.7, C: 4.3, D: 4.5 };
function beginCommit(eng, e, pv, variant, ctx) {
  e.commit = { pid: pv.id, v: variant, x: e.x, y: e.y, until: eng.now + (KILL_DUR[variant] || 4.5) + .25, ctx, body: false };
  e.path = []; e.trav = null; e.lunge = null; e.aim = null; e.speed = 0; e.target = null; setAct(e, 'feed');
  e.dbg.commit = variant;
}
function commitTick(eng, e, dt) {                                            // true while committed (the species tick does nothing else)
  const c = e.commit; if (!c) return false;
  stopMoving(eng, e, dt); if (e.act !== 'feed') setAct(e, 'feed');
  if (eng.now < c.until || (!c.body && eng.now < c.until + 1.5)) return true;   // (waits a moment for the victim's report of where the animation left it)
  e.commit = null; e.dbg.commit = null; setAct(e, '');
  const pv = eng.playerById(c.pid);
  let ctx = c.ctx; try { if (pv) ctx = assess(eng, e, pv, {}); } catch (_) { }
  e.sp.capture.afterKill && e.sp.capture.afterKill(eng, e, ctx, pv || { id: c.pid, x: c.x, y: c.y });
  return false;
}
function commitEnd(eng, pid, x, y, a) {                                      // the victim's client: "the animation left the attacker here"
  for (const e of eng.entities) {
    const c = e.commit; if (!c || c.pid !== pid || c.body) continue;
    c.body = true;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x - c.x, y - c.y) > 320 || !eng.geo.clear(x, y, e.rc, 'walk')) return false;
    e.x = x; e.y = y; if (Number.isFinite(a)) e.ang = a; e.wd = { x, y, t: 0 }; return true;
  }
  return false;
}
/* admin aid (DEATHS tab): play ONE chosen death on a player through the real capture / kill path.  The entity is set down a step away, on the side that makes that
 * variant honest (for the hound's C: a real wall behind the victim), then the ordinary quick capture runs - so the kill record, the events, what the entity does
 * afterwards and everything the clients replay are exactly what a natural death produces. */
function previewKill(eng, e, variant, pv) {
  const geo = eng.geo, V = /^[ABCD]$/.test(variant) ? variant : 'A', hound = e.kind === 'hound';
  if (!pv || !pv.alive || pv.caught || e.cap) return { ok: false, why: 'busy: already caught or dead' };
  const fwd = pv.angle, wantC = hound && V === 'C';
  const base = hound ? { A: fwd, B: fwd + Math.PI - .7, C: fwd, D: fwd + Math.PI }[V] : fwd;     // where the attacker stands, as an angle seen from the victim
  const offs = [0, .3, -.3, .6, -.6, .9, -.9, 1.25, -1.25, 1.6, -1.6, 2.0, -2.0, 2.5, -2.5, Math.PI];
  for (const off of offs) for (const r of hound ? [54, 44, 34] : [50, 42, 34]) {
    const a = base + off, ax = pv.x + Math.cos(a) * r, ay = pv.y + Math.sin(a) * r;
    if (!geo.clear(ax, ay, e.rc, 'walk') || !geo.los(ax, ay, pv.x, pv.y)) continue;
    if (wantC && !wallBehind(geo, pv.x, pv.y, Math.cos(a + Math.PI), Math.sin(a + Math.PI))) continue;
    e.x = ax; e.y = ay; e.ang = a + Math.PI; e.path = []; e.trav = null; e.lunge = null; e.aim = null; e.speed = 0; e.tier = 'near'; e.tierT = 1; e.wd = { x: ax, y: ay, t: 0 };
    if (e.kind === 'smiler' && V === 'C') eng.lightFail(pv.x, pv.y, 560, 1.4);             // the lamps flicker out around the victim, as in a real light failure
    const cap = beginCapture(eng, e, pv, { force: 'quick', preview: true, variant: V, dir: e.ang, speed: 0, style: 'preview' });
    return cap ? { ok: true, v: V, eid: e.id } : { ok: false, why: 'the capture did not start' };
  }
  return { ok: false, why: wantC ? 'no wall about 1-2 body lengths from you: stand near a wall first' : 'no room to attack from here' };
}
function finishCapture(eng, cap, pv, e) { cap.phase = 'done'; if (e && e.cap === cap) e.cap = null; if (pv && pv.caught === cap) pv.caught = null; const i = eng.caps.indexOf(cap); if (i >= 0) eng.caps.splice(i, 1); }
function releaseVictim(eng, cap, pv, e, why) {
  cap.released = true; cap.phase = 'release'; cap.phaseT = 0; cap.releaseWhy = why;
  if (pv && pv.caught === cap) pv.caught = null;
  eng.emit({ t: 'release', pid: cap.pid, eid: cap.eid, why });
  e.dbg.capture = Object.assign(e.dbg.capture || {}, { released: why });
}

/* the caught-phase loop, called every engine tick for each live capture */
function capStep(eng, cap, dt) {
  const e = eng.entities.find(x => x.id === cap.eid), pv = eng.playerById(cap.pid);
  if (!e || !pv || !pv.alive) { finishCapture(eng, cap, pv, e); return; }
  cap.t += dt; cap.phaseT = (cap.phaseT || 0) + dt;
  const spc = e.sp.capture;
  if (cap.phase === 'release') {                                       // false hope: the prey is free, is it going to run?
    const running = pv.st === 2 || (pv.sp > 110 && Math.hypot(pv.x - e.x, pv.y - e.y) > 200);
    const d = Math.hypot(pv.x - e.x, pv.y - e.y);
    cap.watch = (cap.watch || 0) + dt;
    if (running && !cap.triggered) { cap.triggered = eng.now + rand(eng, .35, 1.1) * (1.2 - e.tr.AGGRESSION * .5); }
    if (cap.triggered && eng.now >= cap.triggered) { spc.onResume && spc.onResume(eng, e, cap, pv); finishCapture(eng, cap, pv, e); return; }
    if (!cap.triggered && (cap.watch > cap.holdFor || d > 1500)) { spc.onLetGo && spc.onLetGo(eng, e, cap, pv); finishCapture(eng, cap, pv, e); return; }
    spc.releaseTick && spc.releaseTick(eng, e, cap, pv, dt);
    return;
  }
  if (cap.phase === 'down') {
    if (cap.phaseT >= cap.down) { cap.phase = 'crawl'; cap.phaseT = 0; eng.emit({ t: 'phase', pid: pv.id, eid: e.id, ph: 'crawl' }); }
    spc.playTick(eng, e, cap, pv, dt);
  } else if (cap.phase === 'crawl') spc.playTick(eng, e, cap, pv, dt);
  /* interruption: another player closing in with a light, a loud noise, another entity */
  cap.checkT = (cap.checkT || 0) - dt;
  if (cap.checkT <= 0) {
    cap.checkT = .25;
    const ctx = assess(eng, e, pv, cap.attack || {});
    const noisy = e.hear && eng.now - e.hear.t < .8 && e.hear.I > .4 && e.hear.src !== pv.id;
    const others = eng.entities.some(o => o !== e && !o.cap && Math.hypot(o.x - e.x, o.y - e.y) < 500);
    if (ctx.approaching > 0 || ctx.seeing > 0 && ctx.danger > .5 || noisy || (others && e.kind === 'hound')) {
      cap.interrupts++;
      const choice = spc.onInterrupt(eng, e, cap, pv, ctx, { noisy, others });
      e.dbg.capture = Object.assign(e.dbg.capture || {}, { interrupt: choice, danger: +ctx.danger.toFixed(2) });
      if (choice === 'kill') { killNow(eng, cap, pv, e, 'interrupted'); return; }
      if (choice === 'release') { cap.holdFor = rand(eng, 2.5, 6); releaseVictim(eng, cap, pv, e, 'interrupted'); spc.onRelease && spc.onRelease(eng, e, cap, pv); return; }
    }
  }
  /* the next major decision */
  if (cap.t >= cap.decideAt) {
    const c = spc.decide(eng, e, cap, pv);
    e.dbg.capture = Object.assign(e.dbg.capture || {}, { decision: c });
    if (c === 'kill') { killNow(eng, cap, pv, e, 'decided'); return; }
    if (c === 'release') { cap.holdFor = rand(eng, 3, 9); releaseVictim(eng, cap, pv, e, 'false hope'); spc.onRelease && spc.onRelease(eng, e, cap, pv); return; }
    cap.decideAt = cap.t + rand(eng, 4, 11) * (.7 + .5 * e.tr.PATIENCE);
  }
}

/* ---------------------------------------------------------------- HOUND: primal, hears everything, fast in straight lines, poor at turning */
const HACT = { '': 0, listen: 1, sniff: 2, freeze: 3, wind: 4, lunge: 5, recover: 6, feed: 7, vault: 8, circle: 9, stare: 10, drag: 11, growl: 12, rest: 13, pace: 14, back: 15, guard: 16 };
const HOUND = {
  name: 'Hound', kind: 'hound', initial: S.ROAMING, radius: 26, clearance: 21, vTop: 320, turnPenalty: .62, roamSpeed: 92,
  traits: { INTELLIGENCE: .25, SADISM: .12, HUNGER: .72, PATIENCE: .3, CURIOSITY: .45, CAUTION: .3, TERRITORIALITY: .5, AGGRESSION: .82, PERSISTENCE: .72, SOCIAL: .45, HEARING: .86, VISION: .5, LIGHT_SENS: .12, MEMORY: .35 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: 1.2, CAN_CROUCH: true, CAN_CRAWL: true, CAN_SLIDE: false, CAN_OPEN_DOORS: false, CAN_BREAK_DOORS: true, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.4, ACCELERATION: 880 },
  vision: { range: 640, fov: 2.7, dark: false, gain: 3.0, floor: 150 },   // floor: a body this close in front of it is noticed whatever its posture (crouching is not invisibility)
  speeds: { roam: 92, stalk: 84, investigate: 122, search: 134, chase: 292, retreat: 235, frustrated: 150 },
  init(eng, e) { e.roam = { goal: null, until: 0, nextListen: rand(eng, 4, 11) }; e.lunge = null; e.recover = 0; e.search = null; e.feed = null; e.chaseBlind = 0; e.growlAt = 0; e.rest = 0; },
};
const hSpeed = (e, k, eng) => (e.sp.speeds[k] || 100) * (k === 'chase' ? 1 + (e.tr.AGGRESSION - .82) * .18 + (eng.pressure || 0) * .04 : 1);

function houndTargetScore(e, r, now) {
  const age = memAge(e, r, now), d = Math.hypot(r.lkx - e.x, r.lky - e.y);
  let s = r.aw * .7 + r.conf * .6 - Math.min(1, age / 25) * .35 - d / 6000;
  if (r.seen) s += .55; if (r.st === 2 || r.st === 5) s += .3; if (r.ex) s += .25;                    // loud / exhausted prey draws it
  return s;
}
function pickTarget(eng, e, filter) {
  let best = null, bs = -1;
  for (const r of e.mem.p.values()) {
    if (r.conf < .04 && !r.seen) continue;
    const pv = eng.playerById(r.id); if (!pv || !pv.alive || pv.caught) continue;
    if (filter && !filter(r)) continue;
    const s = houndTargetScore(e, r, eng.now); if (s > bs) { bs = s; best = r; }
  }
  return best;
}
/* how many of the people it can see right now stand together (within ~420 px of the same person) */
function groupSeen(eng, e) {
  const ps = []; for (const id of e.seenNow) { const pv = eng.playerById(id); if (pv && pv.alive && !pv.caught) ps.push(pv); }
  let best = ps.length ? 1 : 0;
  for (const a of ps) { let n = 0; for (const b of ps) if (dist(a.x, a.y, b.x, b.y) < 420) n++; if (n > best) best = n; }
  return best;
}
function houndGrowl(eng, e, I = .7, type = 'growl') { if (eng.now - e.growlAt < 2.5) return; e.growlAt = eng.now; eng.sound({ x: e.x, y: e.y, r: 980, I, type, src: -e.id, ent: e.id }); }

/* ROAMING: wander a route of far-apart spots, stopping now and then to listen.  ------------------------------------------------ */
function hRoam(eng, e, dt) {
  const R = e.roam;
  if (e.act === 'listen') {                                               // stands still, head up, hearing sharpened
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 1.7) * .5; if (e.actT > R.listenFor) { setAct(e, ''); R.nextListen = eng.now + rand(eng, 6, 15); R.goal = null; }
    return;
  }
  if (e.act === 'rest') { stopMoving(eng, e, dt); if (e.actT > e.rest) { setState(e, S.ROAMING, ''); e.rest = 0; } return; }
  if (eng.now > R.nextListen && e.speed < 140) { setAct(e, 'listen'); R.listenFor = rand(eng, 1.6, 3.8); return; }
  if (!R.goal || eng.now > R.until || dist(e.x, e.y, R.goal.x, R.goal.y) < 60) {
    if (R.goal && eng.rng() < .12 && e.tier !== 'near') { setState(e, S.DORMANT, 'rest'); e.rest = rand(eng, 8, 20); R.goal = null; return; }
    R.goal = randomFloor(eng, e, 900, 2800) || randomFloor(eng, e, 400, 1600); R.until = eng.now + 40;
    if (R.goal) plan(eng, e, R.goal.x, R.goal.y);
  }
  if (R.goal) { const st = follow(eng, e, dt, hSpeed(e, 'roam', eng), {}); if (st === 'nopath') R.goal = null; e.head = Math.sin(e.t * .9) * .3; } else stopMoving(eng, e, dt);
}

/* SEARCHING (Part 1C): losing sight starts a search, it does not reset the hound.  It keeps what it knew - where it last saw the prey, which way it
 * was going and how fast, when, the last sound it made, whether it went into a crawlspace - and works outward from it:
 *   lkp       run to where the prey should be now: the last sighting pushed along its heading, stopped short of walls
 *   continue  check the ways out that carry on in that direction (doorways, the rest of a corridor), then the plausible alternatives: the heading
 *             counts for less the longer the search goes on and the less sure it is (INTELLIGENCE reads the heading better)
 *   exits     the other openings of a crawlspace the prey went into - it cannot know which way the prey left, only which ways there are
 *   watch     a patient hound may stop at a crawl exit and listen
 * A loud sound from the prey (running, a slide, a vault) ends the search: the chase is back on.  A quiet one draws it there.
 * How long it keeps at it depends on the evidence (how recent, how sure, sounds) and on the hound (PERSISTENCE, CURIOSITY, PATIENCE); when it gives
 * up it says why (debug).  Nothing here reads where the prey really is. */
function searchBudget(e, r, now) {
  const fresh = r ? clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / 12, 0, 1) : 0;
  return { dur: lerp(10, 30, e.tr.PERSISTENCE) * (.7 + .5 * fresh) * (.85 + .3 * e.tr.CURIOSITY), legs: 3 + Math.round(e.tr.CURIOSITY * 4 + e.tr.PERSISTENCE * 2) };
}
function beginSearch(eng, e, r, why) {
  setState(e, S.SEARCHING, why === 'lost' ? '' : 'freeze');                    // straight on after the prey: no stop to "think" when it has only just vanished
  const B = searchBudget(e, r, eng.now);
  e.search = { rid: r ? r.id : 0, started: eng.now, goal: null, phase: 'lkp', legs: 0, visited: [], why, until: eng.now + B.dur, maxLegs: B.legs, pause: 0, first: why !== 'lost', exitsTried: [] };
  e.dbg.searchWhy = why; e.dbg.disengage = '';
  if (r) { const est = estimate(e, r, eng.now, eng.geo); e.search.goal = { x: est.x, y: est.y, k: 'lkp' }; e.search.est = est; e.search.hd = Math.atan2(r.lvy, r.lvx); e.search.sp = Math.hypot(r.lvx, r.lvy); }
}
/* the places worth looking, scored.  anchor = where the prey most likely is now (memory), heading = which way it was going */
function pickSearchGoal(eng, e, s) {
  const r = e.mem.p.get(s.rid), now = eng.now, geo = eng.geo;
  const base = r ? estimate(e, r, now, geo) : { x: e.x, y: e.y, unc: 500 };
  const hd = s.hd ?? (r ? Math.atan2(r.lvy, r.lvx) : e.ang), moving = (s.sp || 0) > 30;
  const prog = clamp((now - s.started) / Math.max(4, s.until - s.started), 0, 1), wH = moving ? lerp(260, 60, prog) * (.55 + .7 * e.tr.INTELLIGENCE) : 0;
  let best = null, bs = -1e9;
  const consider = (x, y, sc, k, extra) => {
    const c = geo.cellAt(x, y); if (c < 0 || geo.cls[c] !== 1) { const q = geo.snap(x, y, e.caps, 2); if (q < 0) return; x = geo.cx(q); y = geo.cy(q); }
    for (const v of s.visited) if (Math.hypot(v.x - x, v.y - y) < 230) { sc -= 420; break; }
    sc -= Math.hypot(x - e.x, y - e.y) * .1 + eng.rng() * (40 + 90 * (1 - e.tr.INTELLIGENCE));
    if (sc > bs) { bs = sc; best = Object.assign({ x, y, k }, extra || {}); }
  };
  // 1) the ways out from where it should be: openings in 12 directions (a doorway or a corridor reads as a long free ray)
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, L = geo.ray(base.x, base.y, a, 700); if (L < 230) continue;
    const d = Math.min(L - 50, (moving && prog < .35 ? 520 : 260 + 200 * prog) + e.tr.CURIOSITY * 80);            // early on it looks well down the way the prey was going
    consider(base.x + Math.cos(a) * d, base.y + Math.sin(a) * d, 120 + Math.cos(angDiff(a, hd)) * wH + Math.min(L, 700) * .12, 'continue');
  }
  // 2) a crawlspace it saw the prey go into: its exits (the other faces first: the prey went in from this side)
  const cz = r && r.crawl && now - r.crawlAt < 30 ? WORLD.CRAWL.find(c => c.id === r.crawl) : null;
  if (cz) {
    const can = WORLD.canCrawl(e.caps, cz), entry = Math.atan2(r.lky - cz.cy, r.lkx - cz.cx);
    if (can && !s.exitsTried.includes('in')) consider(cz.cx, cz.cy, 520, 'enter', { cz: cz.id });
    for (const x of cz.exits) {
      if (!geo.clear(x.x, x.y, e.rc, 'walk') || s.exitsTried.includes(x.face + ':' + Math.round(x.x) + ',' + Math.round(x.y))) continue;
      const other = Math.cos(angDiff(Math.atan2(x.ny, x.nx), entry)) < .3 ? 1 : 0;
      consider(x.x, x.y, (can ? 200 : 460) + other * 220 + e.tr.PATIENCE * 60, 'exit', { cz: cz.id, face: x.face, key: x.face + ':' + Math.round(x.x) + ',' + Math.round(x.y) });
    }
  }
  // 3) a sound it heard from the prey since it lost it
  if (r && r.heardAt > s.started - 1 && now - r.heardAt < 8) consider(r.hx, r.hy, 480 - (now - r.heardAt) * 30, 'sound');
  return best;
}
function hSearch(eng, e, dt, thinkNow) {
  const s = e.search; if (!s) { setState(e, S.ROAMING); return; }
  const now = eng.now, r = e.mem.p.get(s.rid);
  const giveUp = why => { e.dbg.disengage = why; e.mood.frustration = Math.min(1, e.mood.frustration + .25); setState(e, S.FRUSTRATED, 'pace'); e.frus = { until: now + rand(eng, 2, 4.5) }; };
  e.dbg.search = { ph: s.phase, legs: s.legs + '/' + s.maxLegs, t: +(now - s.started).toFixed(1), left: +(s.until - now).toFixed(1), g: s.goal ? [Math.round(s.goal.x), Math.round(s.goal.y), s.goal.k] : null, unc: r ? Math.round(estimate(e, r, now).unc) : 0, cz: r && r.crawl || '' };
  if (e.act === 'freeze') {                                                // a beat to listen on arrival / first snap decision
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.1) * .55;
    if (e.actT > (s.first ? rand(eng, .25, .6) : rand(eng, .7, 1.7))) { s.first = false; setAct(e, 'sniff'); s.pause = 0; }
    return;
  }
  if (s.phase === 'watch') {                                               // waiting at a crawl exit, listening
    stopMoving(eng, e, dt); setAct(e, 'listen'); e.head = Math.sin(e.t * 1.4) * .5; s.pause += dt;
    if (s.pause > s.watchFor) { s.phase = 'go'; s.goal = null; setAct(e, ''); }
    return;
  }
  if (e.act === 'sniff' && s.phase === 'pause') {
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 3.2) * .6; s.pause += dt;
    const warm = r ? clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / 8, 0, 1) : 0;
    if (s.pause > rand(eng, .5, 1.3) * (1.2 - e.tr.AGGRESSION * .5) * (1 - .7 * warm)) { s.phase = 'go'; s.goal = pickSearchGoal(eng, e, s); s.legs++; setAct(e, ''); e.mood.frustration = Math.min(1, e.mood.frustration + .05); }
    return;
  }
  // giving up is a decision with a reason: the evidence has run out, the plausible places are done, or it has simply spent its patience
  const conf = r ? r.conf : 0;
  if (!r) { giveUp('no target'); return; }
  if (conf < .12 && s.legs >= 2) { giveUp('memory faded'); return; }
  if (s.legs > s.maxLegs) { giveUp('searched the likely places'); return; }
  if (now > s.until && conf < .5) { giveUp('ran out of patience'); return; }
  if (!s.goal) { s.goal = pickSearchGoal(eng, e, s); if (!s.goal) { giveUp('nowhere left to look'); return; } }
  goTo(eng, e, s.goal.x, s.goal.y, { every: 1.5 });
  const fresh = clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / (5 + 5 * e.tr.AGGRESSION), 0, 1);     // while the trail is warm it moves like it is still chasing, through the likely routes
  const v = lerp(hSpeed(e, s.why === 'sound' ? 'investigate' : 'search', eng) * (.9 + .3 * e.tr.AGGRESSION), hSpeed(e, 'chase', eng) * .9, s.phase === 'lkp' || s.goal.k === 'continue' || s.goal.k === 'sound' ? fresh : fresh * .5);
  const st = follow(eng, e, dt, v, {});
  e.head = Math.sin(e.t * 1.6) * .35;
  if (st === 'arrived' || st === 'nopath' || dist(e.x, e.y, s.goal.x, s.goal.y) < 50) {
    const c = eng.geo.cellAt(e.x, e.y); if (c >= 0) e.mem.visited.set(c, now); s.visited.push({ x: s.goal.x, y: s.goal.y });
    if (s.goal.key) s.exitsTried.push(s.goal.key); if (s.goal.k === 'enter') s.exitsTried.push('in');
    const atExit = s.goal.k === 'exit';
    s.phase = atExit && eng.rng() < .35 + e.tr.PATIENCE ? 'watch' : 'pause'; s.watchFor = rand(eng, 2.5, 7) * (.5 + e.tr.PATIENCE); s.pause = 0; s.goal = null;
    setAct(e, s.phase === 'watch' ? 'listen' : 'sniff');
  }
}

/* STALKING / HUNTING with the committed lunge. ------------------------------------------------------------------------------- */
function beginHunt(eng, e, r, why) {
  if (e.state !== S.HUNTING) { houndGrowl(eng, e, .75); e.mood.arousal = Math.min(1, e.mood.arousal + .5); }
  setState(e, S.HUNTING, ''); e.target = r.id; e.chaseBlind = 0; e.huntWhy = why; e.huntStart = eng.now;
}
/* a lunge is a commitment of ~0.75 s in a straight line: the hound springs when the prey will still be within reach where it is going
 * to land, judged from how fast the prey is moving away (or toward it).  A hound is not a calculator: how well it judges depends on
 * INTELLIGENCE, so it sometimes goes too early or too late - and a player who changes direction after the wind-up makes it miss. */
function lungeStats(e) { const agg = e.tr.AGGRESSION, speed = 500 + agg * 45, wind = .3 - agg * .05, dur = .44; return { speed, wind, dur, reach: speed * dur * .825 + 26, T: wind + dur * .8 }; }
function lungeCheck(eng, e, r, tgt) {
  if (e.lunge || e.recover > 0 || e.cool.lunge > 0 || e.trav) return false;
  const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy), err = Math.abs(angDiff(Math.atan2(dy, dx), e.ang));
  if (d < 96 || d > 330 || err > .42) return false;
  const L = lungeStats(e), vr = d > 1 ? (tgt.vx * dx + tgt.vy * dy) / d : 0;         // > 0: the prey is moving away along the line of the lunge
  if (e.lungeBias === undefined) e.lungeBias = (eng.rng() - .5) * (1.15 - e.tr.INTELLIGENCE) * 96;
  const need = d + vr * L.T + e.lungeBias;                                            // how far the hound must travel to land on it
  if (need < 70 || need > L.reach + 34) return false;
  if (!eng.geo.lineClear(e.x, e.y, tgt.x, tgt.y, 14, 'walk')) return false;
  return true;
}
function startLunge(eng, e, tgt) {
  const lead = .2 + .08 * e.tr.INTELLIGENCE, px = tgt.x + tgt.vx * lead, py = tgt.y + tgt.vy * lead, L = lungeStats(e);
  e.lunge = { t: 0, wind: L.wind, dur: L.dur, dir: Math.atan2(py - e.y, px - e.x), speed: L.speed, aim: { x: px, y: py }, hit: false, tid: tgt.id };
  e.lungeBias = undefined;
  setAct(e, 'wind'); houndGrowl(eng, e, .9, 'lungecue');
}
function stepLunge(eng, e, dt) {
  const L = e.lunge; L.t += dt;
  if (L.t < L.wind) {                                                   // wind-up: crouch, a last small correction of aim
    const t = eng.playerById(L.tid);
    if (t) { const want = Math.atan2(t.y + t.vy * .18 - e.y, t.x + t.vx * .18 - e.x); L.dir += clamp(angDiff(want, L.dir), -1.6 * dt, 1.6 * dt) * clamp(1 - L.t / L.wind, 0, 1); }
    turnTo(e, L.dir, 10, dt); e.speed = approach(e.speed, 60, 1500 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt);
    return false;
  }
  if (e.act !== 'lunge') setAct(e, 'lunge');
  const k = (L.t - L.wind) / L.dur;
  turnTo(e, L.dir, 12, dt); e.speed = L.speed * (1 - .35 * k);            // committed: straight line along the aimed direction, no steering (the body has turned to it during the wind-up)
  const before = { x: e.x, y: e.y };
  e.moved = moveCollide(eng, e, Math.cos(L.dir) * e.speed * dt, Math.sin(L.dir) * e.speed * dt);
  if (e.moved < e.speed * dt * .4) { e.lunge = null; e.recover = 1.25; e.stun = true; setAct(e, 'recover'); e.dbg.lunge = 'wall'; return true; }   // ran into a wall
  // contact
  for (const pv of eng.nearPlayers(e.x, e.y, 60)) {
    if (!pv.alive || pv.caught) continue;
    const d = dist(e.x, e.y, pv.x, pv.y);
    const air = k > .05 && k < .8;                                        // in the air the hound passes over anything low
    if (d < e.r + 14 && !(air && pv.prof < .55 && pv.st === 5)) { L.hit = pv; break; }
    if (d < e.r + 14 && air && pv.st === 5) e.dbg.lunge = 'slid under';
  }
  if (L.hit) { const pv = L.hit; e.lunge = null; e.recover = .5; setAct(e, 'recover'); return { pv, dir: L.dir, speed: e.speed }; }
  if (k >= 1) { e.lunge = null; e.recover = rand(eng, .85, 1.3); setAct(e, 'recover'); e.mood.frustration = Math.min(1, e.mood.frustration + .18); e.cool.lunge = rand(eng, 1.2, 2.4); e.dbg.lunge = 'missed'; e.lungesMissed = (e.lungesMissed || 0) + 1; }
  return false;
}

function hHunt(eng, e, dt, thinkNow) {
  const now = eng.now, r = e.mem.p.get(e.target), pvT = r && eng.playerById(r.id);
  if (e.recover > 0) {                                                    // after a lunge: overshoot, skid, turn around slowly
    e.recover -= dt; e.speed = approach(e.speed, 40, 620 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt);
    if (r && e.recover < .55) faceToward(e, r.lkx, r.lky, dt, 1.4);
    if (e.recover <= 0) { e.stun = false; setAct(e, ''); }
    return;
  }
  if (e.lunge) { const res = stepLunge(eng, e, dt); if (res && res.pv) return res; return; }
  if (!r || !pvT || !pvT.alive || pvT.caught) { const alt = pickTarget(eng, e); if (alt) { e.target = alt.id; return; } setState(e, S.ROAMING); return; }
  const seen = r.seen;
  if (seen) {
    e.chaseBlind = 0; e.lostSince = 0;
    const tgt = { x: pvT.x, y: pvT.y, vx: pvT.vx, vy: pvT.vy, id: pvT.id };
    if (lungeCheck(eng, e, r, tgt) && eng.rng() < 1 - Math.pow(.04, dt * (1 + e.tr.AGGRESSION))) { startLunge(eng, e, tgt); return; }
    // predicted interception point, but never through walls: plan to it, aim straight when the way is clear
    const lead = clamp(dist(e.x, e.y, tgt.x, tgt.y) / 420, 0, .55) * (.5 + e.tr.INTELLIGENCE);
    let LD = Math.hypot(tgt.vx, tgt.vy) * lead; if (LD > 1) LD = Math.max(0, Math.min(LD, eng.geo.ray(tgt.x, tgt.y, Math.atan2(tgt.vy, tgt.vx), LD + 30) - 26));   // the lead stops at walls: a prey pressed against one is not "ahead" of itself
    const sv = Math.hypot(tgt.vx, tgt.vy) || 1, gx = tgt.x + tgt.vx / sv * LD, gy = tgt.y + tgt.vy / sv * LD;
    if (directOk(eng, e, tgt.x, tgt.y, 620) && (Math.hypot(gx - tgt.x, gy - tgt.y) < 8 || directOk(eng, e, gx, gy, 700))) directTo(eng, e, gx, gy);   // straight at it only when the body itself fits the line (it used to test 16 px: it scraped doorframes)
    else goTo(eng, e, gx, gy, { every: .45 });
    e.dbg.pursuit = { x: gx, y: gy };
  } else {
    // out of sight but not out of hearing: fresh loud footsteps (running, sliding, vaulting) keep the hunt going, aimed where they are heading.
    // Only silence lets the blind clock run at full speed - a prey that goes quiet is the one that gets away.
    const byEar = now - r.hLoud < .9 && now - r.heardAt < .9, justNow = now - r.seenAt < .6;
    e.chaseBlind += dt * (byEar ? .12 : 1);
    // for a moment after losing sight it keeps going for where it last saw it (a flicker at the edge of vision must not swap the goal back and forth)
    const est = justNow ? { x: r.lkx, y: r.lky } : byEar ? { x: r.hx + r.hvx * .35, y: r.hy + r.hvy * .35 } : estimate(e, r, now, eng.geo);
    goTo(eng, e, est.x, est.y, { every: .5 });
    e.dbg.pursuit = { x: Math.round(est.x), y: Math.round(est.y), blind: +e.chaseBlind.toFixed(1), ear: byEar ? 1 : 0 };
    if (e.chaseBlind > lerp(1.4, 4.6, e.tr.PERSISTENCE)) { beginSearch(eng, e, r, 'lost'); e.mood.frustration = Math.min(1, e.mood.frustration + .15); return; }
  }
  const st = follow(eng, e, dt, hSpeed(e, 'chase', eng), { arrive: 10, noSlow: false });
  e.head = 0;
  // touching the prey without a lunge still counts (a swipe as it runs past)
  for (const pv of eng.nearPlayers(e.x, e.y, 50)) if (pv.alive && !pv.caught && dist(e.x, e.y, pv.x, pv.y) < e.r + 12) return { pv, dir: e.ang, speed: e.speed };
}

const stalkPatience = e => lerp(4, 15, e.tr.PATIENCE) * (1.15 - e.tr.AGGRESSION * .3);
/* STALKING: it shadows the prey - it matches a walker's pace so the prey never simply walks away from it, holds back at a distance
 * while the prey stands still, and creeps a little closer the longer it watches, until it commits (or the prey gives it a reason to). */
function hStalk(eng, e, dt, thinkNow) {
  const r = e.mem.p.get(e.target), pv = r && eng.playerById(r.id);
  if (!r || !pv || !pv.alive || pv.caught) { beginSearch(eng, e, r, 'lost'); return; }
  const seen = r.seen, est = seen ? { x: pv.x, y: pv.y } : estimate(e, r, eng.now), d = dist(e.x, e.y, est.x, est.y);
  e.stalkFor = (e.stalkFor || 0) + dt;
  goTo(eng, e, est.x, est.y, { every: .6 });
  const hold = lerp(380, 205, clamp(e.stalkFor / stalkPatience(e), 0, 1));
  const tv = seen ? Math.hypot(pv.vx, pv.vy) : Math.hypot(r.lvx, r.lvy);                    // how fast it can see the prey going
  const vmax = d > hold ? clamp(tv * 1.12 + (d - hold) * .7, hSpeed(e, 'stalk', eng) * .7, hSpeed(e, 'chase', eng) * .74) : clamp(tv * .7 - (hold - d) * .6, 0, 70);
  follow(eng, e, dt, vmax, { arrive: 30 });
  e.head = Math.sin(e.t * 2.4) * .12;
  if (thinkNow) {
    const runner = r.st === 2 || r.st === 5 || r.ex;
    if (seen && (d < 230 || runner || e.stalkFor > stalkPatience(e))) { beginHunt(eng, e, r, 'stalk-commit'); return; }
    if (!seen && eng.now - Math.max(r.seenAt, r.heardAt) > 3.4) { beginSearch(eng, e, r, 'lost'); }
  }
}

/* what a hound makes of a fresh sound, and of being seen ------------------------------------------------------------------------ */
function hReact(eng, e) {
  const now = eng.now;
  // seen prey
  let seen = null, sd = 1e9;
  for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = eng.playerById(id); if (!pv || !pv.alive || pv.caught) continue; const d = r.dist || 0; if (d < sd) { sd = d; seen = r; } }
  if (seen && seen.aw > .45) {
    const runner = seen.st === 2 || seen.st === 5 || seen.ex, near = sd < 480, hungry = e.tr.HUNGER > .55;
    const grp = groupSeen(eng, e), fresh = grp > (e.grpN || 0); e.grpN = grp;                       // somebody else has just come into view: it takes stock of the group once
    if (fresh && grp >= 2 && !runner && e.state !== S.HUNTING && e.state !== S.CAUTIOUS && eng.rng() < (.16 + e.tr.CAUTION * 1.5) * (e.pack ? .45 : 1) * (sd < 300 ? .35 : 1)) { beginCautious(eng, e, seen); return; }
    if (e.state !== S.HUNTING && e.state !== S.STALKING && e.state !== S.CAUTIOUS) {
      if (runner || near || (hungry && e.tr.AGGRESSION > .7 && seen.aw > .8 && sd < 700)) { beginHunt(eng, e, seen, runner ? 'saw-run' : 'saw-near'); return; }
      setState(e, S.STALKING, ''); e.target = seen.id; e.stalkFor = 0; e.mood.excitement = Math.min(1, e.mood.excitement + .3); return;
    }
    if (e.state === S.STALKING && (runner || near)) { beginHunt(eng, e, seen, 'stalk-spot'); return; }
    if (e.state === S.HUNTING && e.target !== seen.id) { const cur = e.mem.p.get(e.target); if (!cur || !cur.seen) e.target = seen.id; }
    return;
  }
  if (!e.seenNow.size) e.grpN = 0;
  // heard something new
  const h = e.hear;
  if (h && h.t > (e.lastHearT || -1)) {
    e.lastHearT = h.t;
    const isEnt = h.src < 0;
    if (isEnt && h.type === 'growl' && e.state !== S.HUNTING && e.state !== S.FEEDING && e.state !== S.PLAYING) {           // another hound is on to something: pack instinct
      if (eng.rng() < .55 + e.tr.SOCIAL * .4) { beginSearch(eng, e, null, 'sound'); e.search.goal = { x: h.ox, y: h.oy }; e.search.first = false; setAct(e, ''); }
      return;
    }
    if (isEnt) return;
    const r = e.mem.p.get(h.src); if (!r) return;
    const loud = h.I > .5 || h.type === 'run' || h.type === 'slide' || h.type === 'vault';
    if (e.state === S.ROAMING || e.state === S.DORMANT || e.state === S.CURIOUS || e.act === 'listen') {
      e.wake = 1; if (e.state === S.DORMANT) setState(e, S.ROAMING, ''); else setAct(e, '');
      if (loud && eng.rng() < .55 + e.tr.AGGRESSION * .35) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(eng, .35, .85) * (1.2 - e.tr.AGGRESSION * .5), rid: h.src, toward: { x: h.x, y: h.y } }; }
      else if (h.I > .12) { setState(e, S.CURIOUS, 'freeze'); e.cur = { until: now + rand(eng, .6, 1.5), toward: { x: h.x, y: h.y }, n: 0, rid: h.src }; }
    } else if ((e.state === S.SEARCHING || e.state === S.FRUSTRATED) && loud && r.conf > .2 && dist(e.x, e.y, h.x, h.y) < 1000 && (!e.search || !e.search.rid || e.search.rid === r.id || !e.mem.p.get(e.search.rid)?.conf)) {
      beginHunt(eng, e, r, 'heard-run'); e.dbg.reacquired = (e.dbg.reacquired || 0) + 1;                       // it heard the prey running: no new detection needed
    } else if (e.state === S.SEARCHING || e.state === S.FRUSTRATED) {
      if (h.I > .1) { const s = e.search; if (e.state === S.FRUSTRATED) beginSearch(eng, e, r, 'sound'); else { e.search.why = 'sound'; } e.search.goal = { x: h.x, y: h.y }; e.search.phase = 'go'; e.search.until = Math.max(e.search.until, now + 10); setAct(e, ''); if (loud && r.st === 2) beginHunt(eng, e, r, 'heard-run'); }
    } else if (e.state === S.STALKING && (h.type === 'run')) { beginHunt(eng, e, r, 'stalk-heard-run'); }
    else if (e.state === S.HUNTING && !e.mem.p.get(e.target)?.seen) { if (r.id !== e.target && r.conf > .35 && loud) e.target = r.id; }
  }
}

/* the main per-tick behaviour */
function houndTick(eng, e, dt, thinkNow) {
  const now = eng.now;
  e.cool.lunge = Math.max(0, (e.cool.lunge || 0) - dt);
  if (e.commit && commitTick(eng, e, dt)) return null;               // committed to a kill: nothing else happens until it is over
  if (thinkNow) hReact(eng, e);
  let res = null;
  switch (e.state) {
    case S.ROAMING: case S.DORMANT: hRoam(eng, e, dt); break;
    case S.CURIOUS: {
      stopMoving(eng, e, dt); const c = e.cur; if (!c) { setState(e, S.ROAMING); break; }
      faceToward(e, c.toward.x, c.toward.y, dt, 3.5); e.head = Math.sin(e.t * 5) * .15;
      if (e.hear && e.hear.t > c.until - 1.5 && e.hear.t > (c.seenT || 0) && e.hear.src >= 0) { c.seenT = e.hear.t; c.n++; if (c.n >= 1 && e.hear.I > .2) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(eng, .3, .7), rid: e.hear.src, toward: { x: e.hear.x, y: e.hear.y } }; break; } }
      if (now > c.until) { const r = e.mem.p.get(c.rid); if (r && eng.rng() < .45 + e.tr.CURIOSITY * .5) beginSearch(eng, e, r, 'sound'); else { setState(e, S.ROAMING); e.roam.goal = null; } }
      break;
    }
    case S.ALERT: {
      stopMoving(eng, e, dt); const a = e.alert; if (!a) { setState(e, S.ROAMING); break; }
      faceToward(e, a.toward.x, a.toward.y, dt, 5.5); e.head = Math.sin(e.t * 9) * .08;
      if (now > a.until) {
        const r = e.mem.p.get(a.rid);
        if (!r) { setState(e, S.ROAMING); break; }
        if (r.seen) { beginHunt(eng, e, r, 'alert-see'); break; }
        const lastRun = r.st === 2 || r.st === 5, noisy = (e.hear && e.hear.I > .55);
        if (lastRun && eng.rng() < .35 + e.tr.AGGRESSION * .55) { beginHunt(eng, e, r, 'alert-run'); break; }
        if (eng.rng() < .35 + e.tr.PATIENCE * .3 && !noisy) { setState(e, S.STALKING, ''); e.target = r.id; e.stalkFor = 0; break; }
        beginSearch(eng, e, r, 'sound'); e.search.goal = { x: a.toward.x, y: a.toward.y }; e.search.first = false; setAct(e, '');
      }
      break;
    }
    case S.STALKING: hStalk(eng, e, dt, thinkNow); break;
    case S.HUNTING: res = hHunt(eng, e, dt, thinkNow); break;
    case S.SEARCHING: hSearch(eng, e, dt, thinkNow); break;
    case S.FRUSTRATED: {                                                  // snarls and paces, then sweeps a wider area or gives up
      const f = e.frus || { until: now }; e.speed = approach(e.speed, 0, 1200 * dt);
      e.ang += Math.sin(e.t * 3.1) * dt * 2.2; e.head = Math.sin(e.t * 6) * .45; if (eng.rng() < dt * .35) houndGrowl(eng, e, .5, 'snarl');
      if (now > f.until) { const r = e.mem.p.get(e.search && e.search.rid); if (r && r.conf > .1 && eng.rng() < e.tr.PERSISTENCE * .55) { beginSearch(eng, e, r, 'lost'); e.search.until += 8; } else { setState(e, S.ROAMING); e.roam.goal = null; } }
      break;
    }
    case S.FEEDING: res = hFeed(eng, e, dt, thinkNow); break;
    case S.CAUTIOUS: hCautious(eng, e, dt, thinkNow); break;
    case S.EXCITED: hExcited(eng, e, dt, thinkNow); break;
    case S.RETREATING: hRetreat(eng, e, dt); break;
    case S.PLAYING: hPlay(eng, e, dt); break;
    default: setState(e, S.ROAMING);
  }
  return res;
}

/* FEEDING and guarding a body ------------------------------------------------------------------------------------------------- */
function beginFeed(eng, e, site) { setState(e, S.FEEDING, ''); e.feed = { site, until: eng.now + rand(eng, 22, 48), at: false, guard: null }; }
function hFeed(eng, e, dt, thinkNow) {
  const F = e.feed; if (!F || eng.now > F.until) { if (F && F.site) F.site.fed++; setState(e, S.ROAMING); e.roam.goal = null; e.feed = null; return; }
  const s = F.site;
  if (F.guard) {                                                          // someone came for the body: hunt them, but stay near it
    const r = e.mem.p.get(F.guard);
    if (!r || (!r.seen && eng.now - r.seenAt > 3) || dist(e.x, e.y, s.x, s.y) > 520 + e.tr.TERRITORIALITY * 500) { F.guard = null; setAct(e, ''); return; }
    const pv = eng.playerById(F.guard);
    if (pv && pv.alive && !pv.caught) { goTo(eng, e, pv.x, pv.y, { every: .4 }); follow(eng, e, dt, hSpeed(e, 'chase', eng) * .9, { arrive: 10 }); for (const p of eng.nearPlayers(e.x, e.y, 50)) if (p.alive && !p.caught && dist(e.x, e.y, p.x, p.y) < e.r + 12) return { pv: p, dir: e.ang, speed: e.speed }; }
    else F.guard = null;
    return;
  }
  if (!F.at) { goTo(eng, e, s.x, s.y, { every: 1.4 }); const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), { arrive: 34 }); if (dist(e.x, e.y, s.x, s.y) < 60 || st === 'arrived') { F.at = true; setAct(e, 'feed'); } return; }
  if (e.act !== 'feed') setAct(e, 'feed');
  stopMoving(eng, e, dt); faceToward(e, s.x, s.y, dt, 2); e.head = Math.sin(e.t * 7) * .18;
  if (thinkNow) for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = eng.playerById(id); if (pv && pv.alive && !pv.caught && r.dist < 620 && r.aw > .5) { F.guard = id; e.target = id; houndGrowl(eng, e, .8, 'guard'); setAct(e, 'guard'); break; } }
  if (thinkNow && !F.guard && e.hear && e.hear.I > .5 && e.hear.src > 0 && eng.now - e.hear.t < .3 && dist(e.hear.x, e.hear.y, s.x, s.y) < 900) { const r = e.mem.p.get(e.hear.src); if (r) { F.guard = r.id; e.target = r.id; setAct(e, 'guard'); } }
}
/* EXCITED: right after a kill, when nobody else is close: worked up, pacing around the body, snarling - then it settles down to feed */
function beginExcited(eng, e, site) { setState(e, S.EXCITED, 'pace'); e.exc = { site, until: eng.now + rand(eng, 1.6, 3.6), dir: eng.rng() < .5 ? 1 : -1, r: rand(eng, 62, 96) }; }
function hExcited(eng, e, dt, thinkNow) {
  const X = e.exc; if (!X || eng.now > X.until) { setState(e, S.ROAMING); if (X && X.site && e.tr.HUNGER > .3) beginFeed(eng, e, X.site); else e.roam.goal = null; return; }
  const a = Math.atan2(e.y - X.site.y, e.x - X.site.x) + X.dir * dt * 1.15, tx = X.site.x + Math.cos(a) * X.r, ty = X.site.y + Math.sin(a) * X.r;
  if (eng.geo.clear(tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, 100, dt, { turnMul: 1.7, noSlow: true }); else stopMoving(eng, e, dt);
  e.head = Math.sin(e.t * 6.5) * .5; if (eng.rng() < dt * .45) houndGrowl(eng, e, .55, 'snarl');
}

/* CAUTIOUS: several people together are more than a hound wants to take on.  It holds off at a distance, watching and circling, and
 * waits for one of them to be alone, to run, or to fall behind - or gives up and drifts away. */
function beginCautious(eng, e, r) { setState(e, S.CAUTIOUS, 'stare'); e.caut = { until: eng.now + rand(eng, 5, 11), rid: r.id, dir: eng.rng() < .5 ? 1 : -1, last: { x: r.lkx, y: r.lky }, lostT: 0 }; e.target = r.id; }
function hCautious(eng, e, dt, thinkNow) {
  const C = e.caut;
  if (!C || eng.now > C.until) {                                                                                                // it has watched long enough: commit, or withdraw
    e.caut = null; const r = C && e.mem.p.get(C.rid);
    if (r && r.conf > .3 && eng.rng() < clamp(e.tr.AGGRESSION * .6 + e.tr.HUNGER * .3 - e.tr.CAUTION * .5, .2, .85)) { beginHunt(eng, e, r, 'caut-timeout'); return; }
    if (C) { beginRetreat(eng, e, C.last, rand(eng, 8, 14)); return; }
    setState(e, S.ROAMING); e.roam.goal = null; return;
  }
  const seen = []; for (const id of e.seenNow) { const pv = eng.playerById(id); if (pv && pv.alive && !pv.caught) seen.push(pv); }
  if (seen.length) {
    let cx = 0, cy = 0; for (const p of seen) { cx += p.x; cy += p.y; } C.last = { x: cx / seen.length, y: cy / seen.length }; C.lostT = 0;
    if (thinkNow) {
      const runner = seen.find(p => p.st === 2 || p.st === 5 || p.ex), alone = seen.length === 1 || seen.every(p => dist(p.x, p.y, seen[0].x, seen[0].y) > 460);
      if (runner && eng.rng() < .25 + e.tr.AGGRESSION * .5) { const r = rec(e, runner.id); beginHunt(eng, e, r, 'caut-run'); return; }
      if (alone && dist(e.x, e.y, seen[0].x, seen[0].y) < 720) { const r = rec(e, seen[0].id); if (eng.rng() < .5 + e.tr.AGGRESSION * .4) { beginHunt(eng, e, r, 'caut-alone'); return; } }
    }
  } else { C.lostT += dt; if (C.lostT > 3) { const r = e.mem.p.get(C.rid); if (r) beginSearch(eng, e, r, 'lost'); else setState(e, S.ROAMING); return; } }
  const d = dist(e.x, e.y, C.last.x, C.last.y), away = Math.atan2(e.y - C.last.y, e.x - C.last.x);
  let tx, ty, v = 0;
  if (d < 470) { tx = e.x + Math.cos(away) * 90; ty = e.y + Math.sin(away) * 90; v = 110; }                                   // too close: back off
  else if (d > 680) { tx = e.x - Math.cos(away) * 90; ty = e.y - Math.sin(away) * 90; v = 96; }                                // drifted away: close up
  else { const a = away + C.dir * .5; tx = C.last.x + Math.cos(a) * d; ty = C.last.y + Math.sin(a) * d; v = 66; }             // circle at a distance
  if (eng.geo.clear(tx, ty, 21, 'walk') && eng.geo.lineClear(e.x, e.y, tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, v, dt, { turnMul: 1.4, noSlow: true }); else { stopMoving(eng, e, dt); if (eng.rng() < dt * .6) C.dir = -C.dir; }
  if (seen.length) faceToward(e, C.last.x, C.last.y, dt, 2.2);
  e.head = Math.sin(e.t * 1.9) * .3;
}
function hRetreat(eng, e, dt) {
  const R = e.retreat; if (!R || eng.now > R.until || dist(e.x, e.y, R.goal.x, R.goal.y) < 70) { setState(e, S.ROAMING); e.roam.goal = null; return; }
  goTo(eng, e, R.goal.x, R.goal.y, { every: 1.2 }); follow(eng, e, dt, hSpeed(e, 'retreat', eng), {}); e.head = Math.sin(e.t * 6) * .3;
}
function beginRetreat(eng, e, awayFrom, secs) {
  let goal = null;
  for (let i = 0; i < 16 && !goal; i++) { const g = randomFloor(eng, e, 900, 1700); if (g && dist(g.x, g.y, awayFrom.x, awayFrom.y) > dist(e.x, e.y, awayFrom.x, awayFrom.y) + 300) goal = g; }
  setState(e, S.RETREATING, ''); e.retreat = { goal: goal || randomFloor(eng, e, 800, 1500) || { x: e.x, y: e.y }, until: eng.now + secs };
}

/* PLAYING (rare for a hound): hover around a downed victim ------------------------------------------------------------------- */
function hPlay(eng, e, dt) {                                             // (the capture loop moves it while a victim is held)
  if (!e.cap) setState(e, S.ROAMING);
}
function hPlayTick(eng, e, cap, pv, dt) {
  if (!pv) return;
  const P = cap.plan;
  if (!P || eng.now > P.until) {
    const act = pickW(eng.rng, [{ k: 'circle', w: 1.2 }, { k: 'stare', w: 1 + e.tr.SADISM }, { k: 'drag', w: cap.phase === 'crawl' ? .5 : 0 }, { k: 'back', w: .7 }]);
    cap.plan = { act, until: eng.now + rand(eng, 1.3, 3.2), dir: eng.rng() < .5 ? 1 : -1, r: rand(eng, 95, 135) }; cap.plays++; setAct(e, act === 'back' ? 'back' : act === 'drag' ? 'drag' : act);
  }
  const p = cap.plan;
  cap.drag = null;
  if (p.act === 'circle') {
    const a = Math.atan2(e.y - pv.y, e.x - pv.x) + p.dir * dt * (120 / p.r), tx = pv.x + Math.cos(a) * p.r, ty = pv.y + Math.sin(a) * p.r;
    steerTo(eng, e, tx, ty, 130, dt, { turnMul: 2, noSlow: true }); faceToward(e, pv.x, pv.y, dt, 3);
  } else if (p.act === 'back') {
    const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 80, ty = e.y + Math.sin(away) * 80;
    if (eng.geo.clear(tx, ty, 21, 'walk') && dist(e.x, e.y, pv.x, pv.y) < 330) { e.moved = moveCollide(eng, e, Math.cos(away) * 90 * dt, Math.sin(away) * 90 * dt); e.speed = 90; } else stopMoving(eng, e, dt);
    faceToward(e, pv.x, pv.y, dt, 3);
  } else if (p.act === 'drag') {
    const away = Math.atan2(e.y - pv.y, e.x - pv.x); const step = 70 * dt, nx = Math.cos(away) * step, ny = Math.sin(away) * step;
    if (eng.geo.clear(e.x + nx * 5, e.y + ny * 5, 21, 'walk')) { e.moved = moveCollide(eng, e, nx, ny); e.speed = 70; } else stopMoving(eng, e, dt);
    turnTo(e, away + Math.PI, 6, dt); cap.drag = { x: e.x - Math.cos(away) * 46, y: e.y - Math.sin(away) * 46 };
  } else { stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 3); e.head = Math.sin(e.t * 4) * .3; }
}

/* how a hound captures ---------------------------------------------------------------------------------------------------- */
HOUND.capture = {
  quick(e, ctx) {
    let q = .74 + e.tr.AGGRESSION * .12 + e.tr.HUNGER * .08 - e.tr.SADISM * .55 * ctx.iso;
    if (ctx.danger > .3) q += .22; if (ctx.approaching) q = Math.max(q, .96);
    return clamp(q, .5, .98);
  },
  variants(eng, e, pv, ctx, attack) {
    const exhausted = pv.stamina < 22 || pv.ex, wall = ctx.wall;                       // the wall behind the victim along the attack line (computed once, at the kill)
    return [
      { k: 'A', w: 1.0 * (ctx.facing ? 1.5 : .55) },                          // lunge at the throat: it comes at you head-on
      { k: 'B', w: .95 * (ctx.behind ? 1.25 : 1) * (pv.st === 2 ? 1.25 : 1) },  // dragged down from the side / behind as you run
      { k: 'C', w: wall ? 1.7 : 0 },                                           // slammed into a wall: only where a wall really is
      { k: 'D', w: exhausted ? 3.2 * (ctx.behind ? 1.3 : .6) : 0 },            // you had nothing left
    ];
  },
  onBegin(eng, e, cap, pv) { setState(e, S.PLAYING, 'circle'); },
  playTick(eng, e, cap, pv, dt) { hPlayTick(eng, e, cap, pv, dt); },
  decide(eng, e, cap, pv) {
    const r = eng.rng(), pk = .5 + e.tr.HUNGER * .3 + e.mood.frustration * .2, pr = .24 * (e.tr.SADISM + .35) * (cap.plays > 2 ? 1 : .4);
    return r < pk ? 'kill' : r < pk + pr ? 'release' : 'continue';
  },
  onInterrupt(eng, e, cap, pv, ctx, x) {
    const r = eng.rng();
    if (ctx.danger > 1.1 && e.tr.CAUTION > .35 && r < e.tr.CAUTION * .7) return 'release';
    if (r < .55 + e.tr.AGGRESSION * .4) return 'kill';
    return 'continue';
  },
  onRelease(eng, e, cap, pv) { setState(e, S.PLAYING, 'back'); },
  releaseTick(eng, e, cap, pv, dt) {                                        // false hope: it backs off and watches, head low
    const d = dist(e.x, e.y, pv.x, pv.y);
    if (d < 340) { const away = Math.atan2(e.y - pv.y, e.x - pv.x); e.moved = moveCollide(eng, e, Math.cos(away) * 80 * dt, Math.sin(away) * 80 * dt); e.speed = 80; setAct(e, 'back'); } else { stopMoving(eng, e, dt); setAct(e, 'stare'); }
    faceToward(e, pv.x, pv.y, dt, 3);
  },
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; setState(e, S.HUNTING, ''); e.target = pv.id; e.chaseBlind = 0; e.cool.lunge = .3; e.dbg.resumed = (e.dbg.resumed || 0) + 1; houndGrowl(eng, e, .8); },
  onLetGo(eng, e, cap, pv) { setState(e, S.RETREATING, ''); beginRetreat(eng, e, { x: pv.x, y: pv.y }, rand(eng, 8, 16)); },
  afterKill(eng, e, ctx, pv) {
    const th = ctx.threats.filter(t => t.cert >= .5), near = th.filter(t => t.approaching || t.dist < 600);
    e.mood.excitement = 1; houndGrowl(eng, e, .9, 'kill');
    const site = eng.sites[eng.sites.length - 1];
    if (near.length >= 2 && e.tr.CAUTION + (1 - e.tr.AGGRESSION) > .55) { beginRetreat(eng, e, { x: near[0].x, y: near[0].y }, rand(eng, 6, 12)); return; }       // overwhelmed
    if (near.length) {                                                                                      // attack the next one, or defend the kill
      const t = near.slice().sort((a, b) => a.dist - b.dist)[0], r = rec(e, t.id); r.aw = 1; r.lkx = t.x; r.lky = t.y; r.conf = 1; r.seenAt = eng.now;
      if (e.tr.AGGRESSION > .55) { beginHunt(eng, e, r, 'next-victim'); return; }
      beginFeed(eng, e, site); e.feed.guard = t.id; e.target = t.id; setAct(e, 'guard'); return;
    }
    if (e.tr.HUNGER > .35) { if (eng.rng() < .8) beginExcited(eng, e, site); else beginFeed(eng, e, site); } else { setState(e, S.STALKING, ''); const r = pickTarget(eng, e); if (r) { e.target = r.id; e.stalkFor = 0; } else setState(e, S.ROAMING); }
  },
};
HOUND.tick = houndTick;
HOUND.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: HACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2), l: e.lunge ? +clamp((e.lunge.t - e.lunge.wind) / e.lunge.dur, -1, 1).toFixed(2) : -1, tg: e.target > 0 && (e.state === S.HUNTING || e.state === S.STALKING) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, k: e.pack || 0 });

/* ---------------------------------------------------------------- SMILER: darkness with a face.  Patient, watchful, tied to the light. */
const SACT = { '': 0, watch: 1, follow: 2, wait: 3, creep: 4, rush: 5, fade: 6, cornered: 7, lightfail: 8, stare: 9, back: 10, circle: 11, block: 12, hold: 13 };
const QUIRKS = ['bold', 'patient', 'curious', 'revealer', 'cautious'];
const LIT_MAX = .5;                                                        // above this a smiler will not stand in the light
const SMILER = {
  name: 'Smiler', kind: 'smiler', initial: S.HIDDEN, radius: 23, clearance: 21, vTop: 250, turnPenalty: .3, roamSpeed: 80,
  traits: { INTELLIGENCE: .86, SADISM: .58, HUNGER: .12, PATIENCE: .9, CURIOSITY: .58, CAUTION: .66, TERRITORIALITY: .7, AGGRESSION: .5, PERSISTENCE: .62, SOCIAL: .72, HEARING: .42, VISION: .92, LIGHT_SENS: .86, MEMORY: .82 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: .6, CAN_CROUCH: false, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: true, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.1, ACCELERATION: 520 },
  vision: { range: 1000, fov: 2.4, dark: true, gain: 2.4, floor: 230 },
  lightSensitive: true,
  speeds: { roam: 84, follow: 108, stalk: 88, creep: 44, rush: 246, retreat: 178 },
  init(eng, e) { e.face = 0; e.faceT = 0; e.exposed = 0; e.watch = null; e.follow = null; e.style = null; e.special = null; e.disap = null; e.post = { x: e.x, y: e.y }; e.cool.special = rand(eng, 60, 200); e.rushT = 0;
    e.quirk = eng.rng() < .14 ? QUIRKS[(eng.rng() * QUIRKS.length) | 0] : null;        // a small chance of an unusual individual: still the same creature, still the same rules
    e.enc = new Map(); e.seenFails = new WeakSet(); e.blackSeen = false; e.glance = null; e.rvT = 0; e.lastForm = -99; e.hiddenFor = 0; e.waitMore = rand(eng, 8, 30); },   // (a smiler that has just appeared also moves on after a while: before this it waited forever until it had been hidden once)
  pathCost(eng, e) {
    const geo = eng.geo, black = eng.geo.a.blackout(), pen = e.quirk === 'bold' ? 300 : 520;
    return j => (!black && geo.lamp[j] >= .2 ? pen : 0);
  },
};
const litAt = (eng, x, y) => eng.geo.lightLevel(x, y, eng.lightPlayers());
function darkCellNear(eng, e, R, minD = 0, from = null, prefer = null) {
  const geo = eng.geo; let best = null, bs = -1e9;
  for (let i = 0; i < 34; i++) {
    const a = eng.rng() * TAU, d = rand(eng, minD, R), x = (from || e).x + Math.cos(a) * d, y = (from || e).y + Math.sin(a) * d, c = geo.cellAt(x, y);
    if (c < 0 || geo.cls[c] !== 1) continue;
    const p = { x: geo.cx(c), y: geo.cy(c) }, lit = litAt(eng, p.x, p.y); if (lit > LIT_MAX * .8) continue;
    let sc = -lit * 300 - Math.hypot(p.x - e.x, p.y - e.y) * .4 + (prefer ? prefer(p) : 0) + eng.rng() * 40;
    for (const pl of eng.pl) {                                                // believable repositioning (spec 49/51): never just behind someone, never in the open in front of them;
      if (!pl.alive) continue; const dd = Math.hypot(p.x - pl.x, p.y - pl.y); if (dd > 900) continue;
      const rel = Math.abs(angDiff(Math.atan2(p.y - pl.y, p.x - pl.x), pl.angle)), see = eng.geo.los(p.x, p.y, pl.x, pl.y);
      if (rel > 2.3 && dd < 650) sc -= 260;                                    // directly behind them: the "spawned behind me" cheat
      if (see && dd < 520) sc -= 160;
      else if (see && rel > .9 && rel < 1.9 && dd > 380) sc += 30;             // the edge of where they are looking, out of their way, is fair
    }
    if (sc > bs) { bs = sc; best = p; }
  }
  return best;
}
function sFace(e, target) { e.faceT = target; }
function sSpotPlayers(eng, e) {                                             // who is in view (from memory records refreshed by vision)
  const out = [];
  for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = eng.playerById(id); if (pv && pv.alive && !pv.caught) out.push({ r, pv, d: r.dist }); }
  return out.sort((a, b) => a.d - b.d);
}
/* who is with whom, as far as this entity knows: people it has seen (or heard) near the target, judged by where it last saw them - not by where they are
 * now. That knowledge fades with its memory (a long-memoried smiler keeps it for a couple of minutes), and it lasts several times longer for a companion
 * it saw right beside somebody who has not moved since: nothing it has perceived says they parted. */
function othersNear(eng, e, r) {
  let n = 0; const win = memHalfLife(e) * 2.6, still = r.seen && Math.hypot(r.lvx, r.lvy) < 30;
  for (const o of e.mem.p.values()) {
    if (o.id === r.id) continue;
    const d = Math.hypot(o.lkx - r.lkx, o.lky - r.lky), age = eng.now - Math.max(o.seenAt, o.heardAt);
    if (!o.seen && age > win * (still && d < 260 ? 3.5 : 1)) continue;
    const pv = eng.playerById(o.id); if (!pv || !pv.alive) continue;
    if (d < 900) n++;
  }
  return n;
}
function sPrey(eng, e) {                                                    // pick who to work on: isolated, quiet-ish, in the dark
  let best = null, bs = -1e9;
  for (const r of e.mem.p.values()) {
    if (r.conf < .05 && !r.seen) continue;
    const pv = eng.playerById(r.id); if (!pv || !pv.alive || pv.caught) continue;
    const others = othersNear(eng, e, r);
    const s = r.aw * .5 + r.conf * .5 + (others === 0 ? .7 : -.35 * others) - Math.hypot(r.lkx - e.x, r.lky - e.y) / 5000 + (r.ex ? .2 : 0) + (r.light ? -.05 : .05) + encFor(e, r.id).ran * .06 - encFor(e, r.id).lit * .1;
    if (s > bs) { bs = s; best = { r, pv, alone: others === 0, others }; }
  }
  return best;
}
/* it does not call somebody "alone" on a first glance: it has had a proper long look at them and nobody else has shown up */
const soloKnown = (eng, e, r) => eng.now - r.first > 14 && eng.now - r.seenAt < 4;
function sExposure(eng, e, dt) {
  if (e.state === S.PLAYING || e.state === S.ATTACKING || e.state === S.DISAPPEARING || e.trav) { e.exposed = 0; return false; }
  const lit = litAt(eng, e.x, e.y); e.dbg.lit = +lit.toFixed(2); e.lit = lit;
  const qb = e.quirk === 'bold' ? .07 : e.quirk === 'cautious' ? -.07 : 0;
  if (lit > .62 + qb - e.tr.LIGHT_SENS * .08 || (lit > LIT_MAX + qb && e.state === S.HIDDEN)) e.exposed += dt; else e.exposed = Math.max(0, e.exposed - dt * 2);
  if (e.exposed > .22) { const bp = beamOn(eng, e); if (bp && e.seenNow.has(bp.id)) encOf(e, bp.id).lit = Math.min(6, encOf(e, bp.id).lit + 1); beginDisappear(eng, e, 'lit'); return true; }
  return false;
}
/* ENCOUNTER MEMORY (spec 47): a short list per person, kept only while the creature's ordinary memory keeps it, never a profile that outlives the encounter.
 * lit = how often they lit me up, ran = how much they ran, calm = how long they stayed still and easy, lostAt = when I lost sight of them. */
function encOf(e, id) { let c = e.enc.get(id); if (!c) { if (e.enc.size >= 8) e.enc.delete(e.enc.keys().next().value); e.enc.set(id, c = { lit: 0, ran: 0, calm: 0, lostAt: -99, was: false, esc: 0 }); } return c; }
function encTick(eng, e, dt) {
  const k = Math.exp(-dt / (memHalfLife(e) * 2.2 + 20));
  for (const c of e.enc.values()) { c.lit *= k; c.ran *= k; c.calm *= k; c.esc *= k; }
  for (const id of e.enc.keys()) if (!eng.byId.has(id)) e.enc.delete(id);
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id), c = encOf(e, id); if (!r) continue;
    if (r.st === 2 && r.dist < 900) c.ran = Math.min(5, c.ran + dt * .25);
    else if (Math.hypot(r.lvx, r.lvy) < 40) c.calm = Math.min(5, c.calm + dt * .06);
    if (!c.was && eng.now - c.lostAt < 40 && eng.now - c.lostAt > 3) c.esc = Math.max(0, c.esc - .5);   // it found them again: they did not get away
    c.was = true;
  }
  for (const [id, c] of e.enc) if (c.was && !e.seenNow.has(id)) { c.was = false; c.lostAt = eng.now; }
  e.dbg.enc = [...e.enc].map(([id, c]) => id + ':l' + c.lit.toFixed(1) + '/r' + c.ran.toFixed(1) + '/c' + c.calm.toFixed(1)).join(' ');
  e.dbg.quirk = e.quirk || '-';
}
const encFor = (e, id) => e.enc.get(id) || { lit: 0, ran: 0, calm: 0, lostAt: -99, esc: 0 };
function beamOn(eng, e) {                                                   // a torch that is actually pointing at this creature (its own geometry, not a screen)
  for (const p of eng.lightPlayers()) { const d = dist(e.x, e.y, p.x, p.y); if (d < 800 && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.angle)) < .42) return p; }
  return null;
}
/* a watcher (the person it is following/watching) is looking its way */
const observedBy = (e, pv, r, cone = .55, R = 900) => r && r.seen && dist(e.x, e.y, pv.x, pv.y) < R && Math.abs(angDiff(Math.atan2(e.y - pv.y, e.x - pv.x), pv.angle)) < cone;

/* SPEC 52: a lamp failing is information, not a trigger.  What a smiler makes of it is a weighted roll; "nothing" is one of the answers */
function lightEvent(eng, e, near) {
  const pr = sPrey(eng, e), q = e.quirk;
  const opts = [{ k: 'reveal', w: 1.2 + (q === 'revealer' ? 1.4 : 0) }, { k: 'closer', w: pr ? .9 * (pr.alone ? 1 : .3) * (q === 'bold' ? 1.6 : q === 'cautious' ? .3 : 1) : 0 },
    { k: 'shift', w: .8 }, { k: 'vanish', w: .55 + (q === 'cautious' ? .8 : 0) }, { k: 'nothing', w: 1.5 + (q === 'patient' ? 1.2 : 0) }];
  const pick = pickW(eng.rng, opts); e.dbg.lightEv = pick + '@' + eng.now.toFixed(0);
  if (e.state === S.PROVOKED || e.state === S.ATTACKING || e.state === S.PLAYING || e.state === S.DISAPPEARING) return;
  if (pick === 'reveal') { e.reveal = { until: eng.now + rand(eng, 1.5, 4) }; sFace(e, 1); }
  else if (pick === 'closer' && pr) {
    const g = darkCellNear(eng, e, 380, 90, e, p => -Math.abs(dist(p.x, p.y, pr.r.lkx, pr.r.lky) - Math.max(260, dist(e.x, e.y, pr.r.lkx, pr.r.lky) * .72)) * .5);
    if (g) { plan(eng, e, g.x, g.y); e.nud = { goal: g, until: eng.now + 5 }; }
  } else if (pick === 'shift') { const g = darkCellNear(eng, e, 420, 140, e); if (g) { plan(eng, e, g.x, g.y); e.nud = { goal: g, until: eng.now + 6 }; } }
  else if (pick === 'vanish') beginDisappear(eng, e, 'lights-out', 200);
}
function watchLights(eng, e) {
  const black = eng.geo.a.blackout();
  if (black && !e.blackSeen) { e.blackSeen = true; lightEvent(eng, e); } else if (!black) e.blackSeen = false;
  for (const f of eng.geo.fails) if (!e.seenFails.has(f) && f.until > eng.now) { e.seenFails.add(f); if (!(e.att && e.att.kind === 'lightfail') && dist(f.x, f.y, e.x, e.y) < f.r + 500 && eng.rng() < .75) lightEvent(eng, e); }
}
/* SPEC 57: small systemic reactions that cost almost nothing.  Called every tick; they only nudge head, face and a step or two. */
function micro(eng, e, dt, thinkNow) {
  const now = eng.now, still = e.state === S.HIDDEN || e.state === S.WATCHING || (e.state === S.FOLLOWING && e.act === 'wait');
  if (e.reveal && now > e.reveal.until) e.reveal = null;
  if (e.reveal && e.state !== S.DISAPPEARING) sFace(e, 1);
  if (e.nud) {                                                            // a couple of steps toward a slightly better dark spot, creeping
    const N = e.nud; if (now > N.until || !e.path.length || dist(e.x, e.y, N.goal.x, N.goal.y) < 30 || e.state === S.DISAPPEARING || e.state === S.PROVOKED || e.state === S.ATTACKING || e.state === S.PLAYING) e.nud = null;
    else if (e.state === S.HIDDEN || e.state === S.WATCHING) { const nx = e.path[0], l = nx ? litAt(eng, nx.x, nx.y) : 0; if (l < LIT_MAX || eng.geo.a.blackout()) follow(eng, e, dt, e.sp.speeds.creep, { arrive: 26 }); else e.nud = null; }
  }
  if (!e.hear || now - e.hear.t > 2.4 || !still || e.nud) e.hearHead = 0;
  else { const a = angDiff(Math.atan2(e.hear.y - e.y, e.hear.x - e.x), e.ang); e.hearHead = clamp(a, -.9, .9) * .7; if (e.state === S.HIDDEN && Math.abs(a) > .6) faceToward(e, e.hear.x, e.hear.y, dt, .7); }
  if (e.state === S.WATCHING && !e.nud) {
    const w = e.watch, others = [...e.seenNow].filter(id => !w || id !== w.rid);
    if (!e.glance && others.length && thinkNow && eng.rng() < .05) { const o = eng.playerById(others[0]); if (o) e.glance = { until: now + rand(eng, .7, 1.6), x: o.x, y: o.y }; }
    if (e.glance && now > e.glance.until) e.glance = null;
    if (e.glance) e.hearHead = clamp(angDiff(Math.atan2(e.glance.y - e.y, e.glance.x - e.x), e.ang), -1, 1) * .8;
    if (e.quirk === 'revealer' && thinkNow) { e.rvT -= .12; if (e.rvT <= 0) { e.rvT = rand(eng, 2.4, 5.5); sFace(e, e.faceT > .5 ? .12 : 1); } }
    const bp = beamOn(eng, e);
    if (bp && e.lit > .3 && e.lit < .62 && thinkNow) {                           // the edge of a torch beam reaches it: one small step back into the dark
      const away = Math.atan2(e.y - bp.y, e.x - bp.x), tx = e.x + Math.cos(away) * 46, ty = e.y + Math.sin(away) * 46;
      if (eng.geo.clear(tx, ty, 21, 'walk') && litAt(eng, tx, ty) < e.lit) { e.moved = moveCollide(eng, e, Math.cos(away) * 22, Math.sin(away) * 22); e.dbg.backed = (e.dbg.backed || 0) + 1; }
    } else if (e.lit > .32 && thinkNow && !e.nud && eng.rng() < .25) {        // keeps itself in the dark: a step to a darker neighbouring spot
      const g = darkCellNear(eng, e, 170, 50, e); if (g && litAt(eng, g.x, g.y) < e.lit - .12) { plan(eng, e, g.x, g.y); e.nud = { goal: g, until: now + 3 }; }
    }
  }
  e.head = (e.head || 0) + ((e.hearHead || 0) - (e.head || 0)) * Math.min(1, dt * 2.2) * (e.state === S.WATCHING && !e.glance && e.watch && e.mem.p.get(e.watch.rid)?.seen ? 0 : 1);
}
function beginDisappear(eng, e, why, minD = 260) {
  const from = e.mem.p.size ? bestLead(e, eng.now) : null;
  const away = from ? { x: from[0].lkx, y: from[0].lky } : { x: e.x, y: e.y };
  const g = darkCellNear(eng, e, 520, minD, e, p => Math.hypot(p.x - away.x, p.y - away.y) * .35) || darkCellNear(eng, e, 900, 120, e);
  setState(e, S.DISAPPEARING, 'fade'); e.disap = { goal: g || { x: e.x, y: e.y }, why, t: 0, dur: rand(eng, 1.1, 2.2) };
  if (g) plan(eng, e, g.x, g.y);
  sFace(e, 0);
}
function beginHidden(eng, e) { setState(e, S.HIDDEN, ''); e.post = { x: e.x, y: e.y }; e.watch = null; e.hiddenFor = 0; e.waitMore = rand(eng, 6, 20) * (.6 + e.tr.PATIENCE); sFace(e, 0); e.target = null; e.style = null; }
function beginWatch(eng, e, r) { setState(e, S.WATCHING, 'watch'); e.target = r.id; e.watch = { until: eng.now + rand(eng, 4, 13) * (.6 + e.tr.PATIENCE * .8) * (e.quirk === 'patient' ? 1.7 : e.quirk === 'bold' ? .7 : 1), rid: r.id }; sFace(e, 1); }
function beginFollow(eng, e, r) {
  const en = encFor(e, r.id), hunt = eng.rng() < clamp(.34 + e.tr.AGGRESSION * .3 + e.tr.SADISM * .15 + en.ran * .05 - en.lit * .05 + (e.quirk === 'bold' ? .15 : e.quirk === 'cautious' ? -.15 : 0), .1, .85);   // decided when it starts following, not each tick: a follow may simply never go anywhere
  e.dbg.intent = hunt ? 'hunt' : 'loiter';
  setState(e, S.FOLLOWING, 'follow'); e.hunt = hunt; e.target = r.id; e.follow = { since: eng.now, until: eng.now + rand(eng, 25, 70) * (.6 + e.tr.PERSISTENCE) * (e.quirk === 'patient' ? 2.4 : 1), rid: r.id, goalT: 0, frz: 0, obsT: -99 }; sFace(e, .55); }
function beginStalk(eng, e, r, style) { setState(e, S.STALKING, 'creep'); e.target = r.id; e.style = style || 'rush'; e.stalk = { since: eng.now, hold: 0, rid: r.id }; sFace(e, .85); }

function smilerTick(eng, e, dt, thinkNow) {
  const now = eng.now, black = eng.geo.a.blackout();
  e.face += clamp(e.faceT - e.face, -dt * (e.faceT > e.face ? .8 : 1.4), dt * (e.faceT > e.face ? .8 : 1.4));
  e.cool.special = Math.max(0, (e.cool.special || 0) - dt);
  encTick(eng, e, dt); watchLights(eng, e);
  if (sExposure(eng, e, dt) && e.state !== S.DISAPPEARING) return null;
  let res = null; const wasHidden = e.state === S.HIDDEN;
  switch (e.state) {
    case S.HIDDEN: case S.DORMANT: {
      if (!e.relocating) stopMoving(eng, e, dt); e.hiddenFor = (e.hiddenFor || 0) + dt; sFace(e, 0);          // (a relocating smiler drifts on below: it must not also be braked and moved here)
      if (!thinkNow) break;
      const seen = sSpotPlayers(eng, e);
      if (seen.length) {
        const prey = sPrey(eng, e);
        if (prey && prey.r.aw > .3) {
          e.head = angDiff(Math.atan2(prey.pv.y - e.y, prey.pv.x - e.x), e.ang) * .5;
          const en = encFor(e, prey.r.id), boldness = e.tr.CURIOSITY * .5 + (prey.alone ? .35 : -.2) + (black ? .15 : 0) + e.mood.boredom * .2 + en.calm * .04 - en.lit * .07 + (e.quirk === 'bold' ? .2 : e.quirk === 'cautious' ? -.15 : 0);
          if (prey.r.dist < 1000 && e.hiddenFor > .8 && eng.rng() < clamp(boldness, .04, .8) * .16) { beginWatch(eng, e, prey.r); break; }
          if (!prey.alone && eng.rng() < .012 && e.tr.SOCIAL > .4) beginFollow(eng, e, prey.r);         // groups are followed, not engaged
          if (prey.r.dist < (e.quirk === 'cautious' ? 300 : 190) && e.hiddenFor > .5) { beginDisappear(eng, e, 'too-close'); break; }
        }
      } else {
        // it lost sight of somebody a little while ago and has not forgotten: it comes to look, from the dark, rather than starting from nothing
        for (const [id, c] of e.enc) {
          const r = e.mem.p.get(id), pv = eng.playerById(id); if (!r || !pv || !pv.alive || pv.caught) continue;
          if (eng.now - c.lostAt < 45 && eng.now - c.lostAt > 4 && r.conf > .18 && e.hiddenFor > 2 && eng.rng() < .012 * (.5 + e.tr.PERSISTENCE)) { beginFollow(eng, e, r); e.dbg.returned = (e.dbg.returned || 0) + 1; break; }
        }
        if (e.quirk === 'curious' && e.hear && eng.now - e.hear.t < 3 && !e.relocating && eng.rng() < .04) {         // the odd one goes to look at a noise instead of at the person
          const g = darkCellNear(eng, e, 500, 120, { x: e.hear.x, y: e.hear.y }); if (g) { plan(eng, e, g.x, g.y); e.relocating = { goal: g }; e.hiddenFor = 0; e.dbg.investigated = (e.dbg.investigated || 0) + 1; }
        }
      }
      if (e.hiddenFor > e.waitMore && (e.mood.boredom > .5 || eng.rng() < .01)) { beginDisappear(eng, e, 'relocate', 700); e.disap.reloc = true; }
      break;
    }
    case S.WATCHING: {
      stopMoving(eng, e, dt); const w = e.watch; const r = w && e.mem.p.get(w.rid), pv = r && eng.playerById(r.id);
      if (!w || !r || !pv || !pv.alive || pv.caught) { beginHidden(eng, e); break; }
      if (r.seen) { faceToward(e, pv.x, pv.y, dt, 2.2); e.head = 0; } else e.head = Math.sin(e.t * 1.2) * .3;
      sFace(e, r.seen ? 1 : .6);
      if (thinkNow) {
        const d = dist(e.x, e.y, pv.x, pv.y);
        const beam = e.lit > .45;
        const near = e.quirk === 'cautious' ? 340 : 240; if (d < near || beam) { const bp = beam && beamOn(eng, e); if (bp) encOf(e, bp.id).lit = Math.min(6, encOf(e, bp.id).lit + 1); beginDisappear(eng, e, d < near ? 'approached' : 'beam'); break; }
        if (now > w.until) {
          const prey = sPrey(eng, e), alone = prey && prey.alone;
          const pick = pickW(eng.rng, [{ k: 'follow', w: alone ? 1.6 : .8 }, { k: 'again', w: .6 }, { k: 'fade', w: .8 + (1 - e.tr.CURIOSITY) }, { k: 'stalk', w: alone && soloKnown(eng, e, r) && e.tr.AGGRESSION > .3 ? .7 + e.tr.SADISM * .5 : 0 }]);
          if (pick === 'follow') beginFollow(eng, e, r); else if (pick === 'again') w.until = now + rand(eng, 3, 9); else if (pick === 'stalk') beginStalk(eng, e, r); else beginDisappear(eng, e, 'watched');
        }
      }
      break;
    }
    case S.FOLLOWING: {
      const F = e.follow, r = F && e.mem.p.get(F.rid), pv = r && eng.playerById(r.id);
      if (!F || !r || !pv || !pv.alive || pv.caught || now > F.until) { beginDisappear(eng, e, 'gave-up', 200); break; }
      if (r.conf < .12 && !r.seen) { beginHidden(eng, e); break; }
      sFace(e, r.seen ? .6 : .3);
      const tx = r.seen ? pv.x : r.lkx, ty = r.seen ? pv.y : r.lky, d = dist(e.x, e.y, tx, ty);
      F.goalT -= dt;
      if (F.goalT <= 0) {
        F.goalT = .7;                                                     // a dark spot to trail from: behind/beside, 450-800px off, never in the light
        const want = rand(eng, 460, 820), g = darkCellNear(eng, e, want + 260, Math.max(200, want - 260), { x: tx, y: ty }, p => -Math.abs(dist(p.x, p.y, tx, ty) - want) * .5 + (eng.geo.sees(p.x, p.y, tx, ty, 1) ? 90 : 0));
        if (g) { F.goal = g; plan(eng, e, g.x, g.y); }
        else if (d > 1500) F.goal = null;
      }
      const obs = observedBy(e, pv, r, .5, 900); if (obs) F.obsT = now; F.frz = obs ? F.frz + dt : Math.max(0, F.frz - dt * .5);
      if (F.frz > 12) { beginDisappear(eng, e, 'watched-too-long'); break; }                                // standing still forever under its eye does not make it wait forever
      if (F.goal && d > 380) {
        const nxt = e.path[0] || F.goal, l = litAt(eng, nxt.x, nxt.y);
        if (obs || now - F.obsT < 1.3) { stopMoving(eng, e, dt); setAct(e, 'wait'); faceToward(e, tx, ty, dt, 1.4); }                 // looked at: it stops; and stays stopped a moment after they look back
        else if (l > LIT_MAX && !black) { stopMoving(eng, e, dt); setAct(e, 'wait'); }                               // the edge of the light: it waits there, grinning
        else { setAct(e, 'follow'); follow(eng, e, dt, e.sp.speeds.follow * (r.seen ? 1 : .9), { arrive: 30 }); }
      } else { stopMoving(eng, e, dt); if (r.seen) faceToward(e, tx, ty, dt, 2); }
      if (thinkNow) {
        const prey = sPrey(eng, e);
        if (prey && prey.r === r && r.seen) {
          const dark = litAt(eng, pv.x, pv.y) < .45 || black;
          const en = encFor(e, r.id); if (prey.alone && (e.hunt || (r.ex && eng.rng() < .3) || r.st === 2 && eng.rng() < .3) && soloKnown(eng, e, r) && dark && now - F.since > 6 && eng.rng() < (.08 + e.tr.AGGRESSION * .1) * (black ? 2 : 1) * (prey.r.ex ? 1.5 : 1) * (1 + en.ran * .25) * (1 - Math.min(.6, en.lit * .12)) * (e.quirk === 'bold' ? 1.5 : e.quirk === 'cautious' ? .5 : 1)) { beginStalk(eng, e, r); break; }
          if (!prey.alone && eng.rng() < .015) { beginDisappear(eng, e, 'group'); break; }
        }
        if (e.lit > .5) beginDisappear(eng, e, 'lit');
      }
      break;
    }
    case S.STALKING: {
      const K = e.stalk, r = K && e.mem.p.get(K.rid), pv = r && eng.playerById(r.id);
      if (!K || !r || !pv || !pv.alive || pv.caught) { beginHidden(eng, e); break; }
      sFace(e, .85);
      const d = dist(e.x, e.y, pv.x, pv.y), watched = r.seen && Math.abs(angDiff(Math.atan2(e.y - pv.y, e.x - pv.x), pv.angle)) < .55 && d < 720;
      const nxt = e.path[0], nl = nxt ? litAt(eng, nxt.x, nxt.y) : 0;
      goTo(eng, e, pv.x, pv.y, { every: .5 });
      if (watched && eng.rng() < .35 + e.tr.CAUTION * .2 && d > 260) { K.hold += dt; stopMoving(eng, e, dt); setAct(e, 'hold'); if (K.hold > rand(eng, 3, 6)) { beginDisappear(eng, e, 'watched-too-long'); break; } }
      else if (nl > LIT_MAX && !black) { stopMoving(eng, e, dt); setAct(e, 'wait'); K.hold += dt * .5; if (K.hold > 9) { beginDisappear(eng, e, 'no-dark-way'); break; } }
      else { K.hold = Math.max(0, K.hold - dt); setAct(e, 'creep'); follow(eng, e, dt, e.sp.speeds.stalk, { arrive: 20 }); }
      if (thinkNow) {
        if (!r.seen && now - r.seenAt > 4.5) { beginFollow(eng, e, r); break; }
        const black2 = black, pl = litAt(eng, pv.x, pv.y), dark = pl < .5 || black2, los = r.seen && eng.geo.los(e.x, e.y, pv.x, pv.y);
        const alone = sPrey(eng, e)?.alone !== false;
        // a victim standing in the light, with the dark right there beside it: the one thing the lights cannot save it from is the lights themselves
        if (!dark && alone && los && d < 560 && e.cool.special <= 0 && eng.rng() < .03) {
          e.style = 'lightfail'; setState(e, S.ATTACKING, 'lightfail'); e.att = { t: 0, stage: 0, rid: r.id, kind: 'lightfail', next: 0 }; e.cool.special = rand(eng, 240, 420); break;
        }
        if (d < 330 && dark && los) {
          const arcs = openArcs(eng.geo, pv.x, pv.y), running = r.st === 2;
          // how will it strike?
          if (!K.decided) {
            K.decided = true;
            const roll = eng.rng();
            let style = 'rush';
            if (arcs.arcs <= 1 && arcs.frac < .34) style = 'cornered';
            else if (alone && roll < e.tr.SADISM * .6 && !running) style = 'play';
            e.style = style;
          }
          if (e.style === 'cornered') { setState(e, S.ATTACKING, 'cornered'); e.att = { t: 0, slow: rand(eng, 2.4, 5.2), rid: r.id, kind: 'cornered' }; break; }
          if (e.style === 'play' || running || eng.rng() < .02) { setState(e, S.PROVOKED, 'rush'); e.rushT = 0; e.target = r.id; e.provoked = { rid: r.id, style: e.style }; sFace(e, 1); break; }
        }
        if (d < 200 && r.seen && !K.close) { K.close = now; }
      }
      break;
    }
    case S.PROVOKED: {
      const P = e.provoked, r = P && e.mem.p.get(P.rid), pv = r && eng.playerById(r.id);
      if (!P || !r || !pv || !pv.alive || pv.caught) { beginDisappear(eng, e, 'lost-prey'); break; }
      e.rushT += dt; sFace(e, 1);
      if (thinkNow && e.rushT > .8 && dist(e.x, e.y, pv.x, pv.y) > 130) {                                    // committed, but not latched: if the prey is no longer alone, or lit, it goes back to watching
        const grp = othersNear(eng, e, r), lit = litAt(eng, pv.x, pv.y) > .75;
        if ((grp > 0 && eng.rng() < .35) || (lit && eng.rng() < .2)) { e.dbg.stoodDown = (e.dbg.stoodDown || 0) + 1; beginWatch(eng, e, r); e.watch.until = now + rand(eng, 3, 7); stopMoving(eng, e, dt); break; }
      }
      const gx = pv.x + pv.vx * .18, gy = pv.y + pv.vy * .18;
      if (directOk(eng, e, pv.x, pv.y, 2000) && directOk(eng, e, gx, gy, 2000)) directTo(eng, e, gx, gy); else goTo(eng, e, pv.x, pv.y, { every: .35 });
      const nxt = e.path[0], nl = nxt ? litAt(eng, nxt.x, nxt.y) : 0;
      if (nl > .68 && !black && dist(e.x, e.y, pv.x, pv.y) > 90) { stopMoving(eng, e, dt); setAct(e, 'wait'); e.rushBlocked = (e.rushBlocked || 0) + dt; if (e.rushBlocked > 1.4) { e.rushBlocked = 0; beginDisappear(eng, e, 'light-wall'); break; } }
      else { e.rushBlocked = 0; setAct(e, 'rush'); follow(eng, e, dt, e.sp.speeds.rush, { arrive: 8, noSlow: false }); }
      if (dist(e.x, e.y, pv.x, pv.y) < e.r + 15) res = { pv, dir: e.ang, speed: e.speed, style: P.style === 'play' ? 'play' : 'rush' };
      else if (e.rushT > 4.2 || dist(e.x, e.y, pv.x, pv.y) > 760) beginDisappear(eng, e, 'lost-nerve');
      break;
    }
    case S.ATTACKING: {
      const A = e.att, r = A && e.mem.p.get(A.rid), pv = r && eng.playerById(r.id);
      if (!A || !r || !pv || !pv.alive || pv.caught) { beginDisappear(eng, e, 'lost-prey'); break; }
      A.t += dt; sFace(e, 1);
      if (A.kind === 'cornered') {                                        // it will not hurry: the grin just gets closer while the exits close
        const d = dist(e.x, e.y, pv.x, pv.y); faceToward(e, pv.x, pv.y, dt, 2.5);
        const flee = r.seen && pv.sp > 60 && Math.abs(angDiff(Math.atan2(pv.vy, pv.vx), Math.atan2(e.y - pv.y, e.x - pv.x))) < .7;   // it tries to run past
        const speed = A.t > A.slow || flee ? e.sp.speeds.rush : e.sp.speeds.creep;
        if (d > 30) { e.speed = approach(e.speed, speed, 900 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); }
        if (d < e.r + 15) res = { pv, dir: e.ang, speed: e.speed, style: 'cornered' };
        if (A.t > A.slow + 4 && d > 400) beginDisappear(eng, e, 'lost-nerve');
      } else if (A.kind === 'lightfail') {                                // the lights go, it is closer, they come back, it is closer again...
        const d = dist(e.x, e.y, pv.x, pv.y); faceToward(e, pv.x, pv.y, dt, 3);
        A.next -= dt;
        if (A.next <= 0) {
          if (A.stage < 3) {
            A.stage++; const dur = A.stage === 1 ? rand(eng, 1.1, 1.5) : A.stage === 2 ? rand(eng, .8, 1.1) : 1.4;
            eng.lightFail(pv.x, pv.y, 560, dur + (A.stage < 3 ? 0 : 0));
            A.dark = eng.now + dur; A.next = dur + (A.stage < 3 ? rand(eng, 1.2, 1.9) : 9);
            A.step = A.stage < 3 ? Math.max(0, (d - 130) * (A.stage === 1 ? .38 : .5)) : 0; A.moved = 0;
          }
        }
        if (A.dark && eng.now < A.dark && A.step > 0 && A.moved < A.step) { const s = Math.min(A.step - A.moved, 330 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * s, Math.sin(e.ang) * s); A.moved += s; e.speed = 330; }
        else { stopMoving(eng, e, dt); }
        if (A.stage === 3 && eng.now >= A.dark - .9) { e.speed = e.sp.speeds.rush * 1.2; e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); }
        if (d < e.r + 15) res = { pv, dir: e.ang, speed: e.speed, style: 'lightfail' };
        if (A.t > 16) beginDisappear(eng, e, 'gave-up');
      }
      break;
    }
    case S.DISAPPEARING: {
      const D = e.disap; if (!D) { beginHidden(eng, e); break; }
      D.t += dt; sFace(e, 0);
      if (e.path.length) follow(eng, e, dt, e.sp.speeds.retreat, { arrive: 24 }); else stopMoving(eng, e, dt);
      if (D.t > D.dur && e.face < .05) { if (D.reloc) { const g = darkCellNear(eng, e, 2600, 900, e); if (g) { setState(e, S.HIDDEN, ''); e.disap = null; plan(eng, e, g.x, g.y); e.relocating = { goal: g }; e.hiddenFor = 0; e.waitMore = rand(eng, 8, 24); break; } } beginHidden(eng, e); }
      break;
    }
    case S.PLAYING: {
      if (!e.cap) beginDisappear(eng, e, 'done');
      break;
    }
    default: beginHidden(eng, e);
  }
  micro(eng, e, dt, thinkNow);
  // relocation after DISAPPEARING(reloc): drift to the new post in the dark
  if (e.relocating && e.state === S.HIDDEN && wasHidden) { const g = e.relocating.goal; if (e.path.length && dist(e.x, e.y, g.x, g.y) > 40 && !e.seenNow.size) { const nxt = e.path[0], l = litAt(eng, nxt.x, nxt.y); if (l < LIT_MAX || black) follow(eng, e, dt, e.sp.speeds.roam, { arrive: 30 }); } else { e.relocating = null; e.post = { x: e.x, y: e.y }; } }
  return res;
}

/* the play of a smiler: it does not rush.  It withdraws into the dark, stares, comes back a step at a time. ------------------------ */
function sPlayTick(eng, e, cap, pv, dt) {
  if (!pv) return;
  const P = cap.plan, d = dist(e.x, e.y, pv.x, pv.y); sFace(e, 1);
  if (!P || eng.now > P.until) {
    const act = pickW(eng.rng, [{ k: 'stare', w: 1.3 }, { k: 'creep', w: 1.1 }, { k: 'back', w: 1 + e.tr.CAUTION * .3 }, { k: 'circle', w: .7 }, { k: 'block', w: cap.phase === 'crawl' ? .9 : .2 }]);
    cap.plan = { act, until: eng.now + rand(eng, 1.6, 4), dir: eng.rng() < .5 ? 1 : -1 }; cap.plays++; setAct(e, act === 'creep' ? 'cornered' : act);
  }
  const p = cap.plan; cap.drag = null;
  if (p.act === 'stare') { stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2); e.head = Math.sin(e.t * 1.1) * .1; }
  else if (p.act === 'creep') { faceToward(e, pv.x, pv.y, dt, 2.5); if (d > 90) { e.speed = approach(e.speed, 40, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); } else stopMoving(eng, e, dt); }
  else if (p.act === 'back') {
    const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 60, ty = e.y + Math.sin(away) * 60;
    if (d < 420 && litAt(eng, tx, ty) < LIT_MAX && eng.geo.clear(tx, ty, 21, 'walk')) { e.speed = approach(e.speed, 70, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(away) * e.speed * dt, Math.sin(away) * e.speed * dt); } else stopMoving(eng, e, dt);
    faceToward(e, pv.x, pv.y, dt, 2.5);
  } else if (p.act === 'circle') {
    const a = Math.atan2(e.y - pv.y, e.x - pv.x) + p.dir * dt * (85 / Math.max(120, d)), r = clamp(d, 150, 260), tx = pv.x + Math.cos(a) * r, ty = pv.y + Math.sin(a) * r;
    if (litAt(eng, tx, ty) < LIT_MAX) steerTo(eng, e, tx, ty, 90, dt, { noSlow: true, turnMul: 1.5 }); else stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2.5);
  } else if (p.act === 'block') {                                        // stand between the victim and the way out
    const arcs = openArcs(eng.geo, pv.x, pv.y); let bd = -1, ba = 0;
    for (let i = 0; i < arcs.open.length; i++) if (arcs.open[i]) { const a = i / arcs.open.length * TAU; const dd = Math.abs(angDiff(a, Math.atan2(e.y - pv.y, e.x - pv.x))); if (bd < 0 || dd < bd) { bd = dd; ba = a; } }
    const tx = pv.x + Math.cos(ba) * 170, ty = pv.y + Math.sin(ba) * 170;
    if (eng.geo.clear(tx, ty, 21, 'walk') && litAt(eng, tx, ty) < LIT_MAX) steerTo(eng, e, tx, ty, 100, dt, { noSlow: true }); else stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2);
  }
}
SMILER.capture = {
  quick(e, ctx) {
    let q = .5 + (1 - e.tr.SADISM) * .35 - e.tr.SADISM * .5 * ctx.iso;
    if (ctx.danger > .25) q += .3; if (ctx.approaching) q = Math.max(q, .97);
    return clamp(q, .12, .98);
  },
  variants(eng, e, pv, ctx, attack) {
    const style = attack && attack.style;
    return [
      { k: 'A', w: style === 'rush' || !style ? 2 : .05 },                      // out of the darkness
      { k: 'B', w: style === 'cornered' ? 4 : ctx.deadEnd ? 1.2 : 0 },           // pinned in a dead end
      { k: 'C', w: style === 'lightfail' ? 6 : 0 },                              // the lights fail
      { k: 'D', w: style === 'play' ? 3 : 0 },
    ];
  },
  onBegin(eng, e, cap, pv) { setState(e, S.PLAYING, 'stare'); },
  playTick(eng, e, cap, pv, dt) { sPlayTick(eng, e, cap, pv, dt); },
  decide(eng, e, cap, pv) {
    const r = eng.rng(), pk = .34 + e.tr.SADISM * .15 + e.mood.excitement * .2, pr = .34 * (cap.plays > 2 ? 1 : .4);
    return r < pk && cap.plays > 1 ? 'kill' : r < pk + pr && cap.plays > 1 ? 'release' : 'continue';
  },
  onInterrupt(eng, e, cap, pv, ctx, x) {
    const r = eng.rng();
    if (ctx.approaching > 0 || ctx.danger > .8) return r < .45 + e.tr.AGGRESSION * .3 ? 'kill' : 'release';
    if (x.noisy) return r < .5 ? 'release' : 'continue';
    return 'continue';
  },
  onRelease(eng, e, cap, pv) { setAct(e, 'back'); },
  releaseTick(eng, e, cap, pv, dt) {                                          // it backs into the dark and simply watches you
    const d = dist(e.x, e.y, pv.x, pv.y); sFace(e, 1);
    if (d < 380) { const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 50, ty = e.y + Math.sin(away) * 50; if (eng.geo.clear(tx, ty, 21, 'walk') && litAt(eng, tx, ty) < LIT_MAX) { e.speed = approach(e.speed, 62, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(away) * e.speed * dt, Math.sin(away) * e.speed * dt); } else stopMoving(eng, e, dt); setAct(e, 'back'); }
    else { stopMoving(eng, e, dt); setAct(e, 'stare'); }
    faceToward(e, pv.x, pv.y, dt, 2.5);
  },
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; r.seenAt = eng.now; setState(e, S.PROVOKED, 'rush'); e.provoked = { rid: pv.id, style: 'rush' }; e.rushT = 0; e.target = pv.id; e.dbg.resumed = (e.dbg.resumed || 0) + 1; },
  onLetGo(eng, e, cap, pv) { beginDisappear(eng, e, 'let-go', 320); e.dbg.letGo = (e.dbg.letGo || 0) + 1; },
  afterKill(eng, e, ctx, pv) {
    const near = ctx.threats.filter(t => t.cert >= .5 && (t.approaching || t.dist < 600));
    e.mood.excitement = .8;
    if (near.length) { beginDisappear(eng, e, 'witnessed'); return; }
    setState(e, S.WATCHING, 'watch'); e.target = pv.id; e.watch = { until: eng.now + rand(eng, 3, 8), rid: pv.id, body: true }; sFace(e, 1);   // it stays a moment, grinning at the body
  },
};
SMILER.tick = smilerTick;
SMILER.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: SACT[e.act] | 0, v: Math.round(e.speed), f: +e.face.toFixed(2), h: +(e.head || 0).toFixed(2), tg: e.target > 0 && (e.state === S.STALKING || e.state === S.FOLLOWING || e.state === S.WATCHING || e.state === S.PROVOKED) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, lt: +(e.lit || 0).toFixed(2), sp: e.att && e.att.kind === 'lightfail' ? 1 : 0 });

/* ---------------------------------------------------------------- the engine: sound bus, level of detail, capture loop, snapshots */
const SPECIES = { hound: HOUND, smiler: SMILER };
const STRIDE = { 1: 64, 2: 82, 3: 56, 4: 42 };                      // px of travel per footfall: walk, run, crouch, crawl
const TIER = { near: 1900, mid: 3800 };                             // px to the nearest living player: full AI / reduced AI / asleep
const EV_NOISE = {                                                   // discrete movement events the client reports (see move.js)
  21: { r: 'vaultSlow', I: .3, type: 'vault' }, 22: { r: 'vaultNormal', I: .55, type: 'vault' }, 23: { r: 'vaultFast', I: .85, type: 'vault' },
  24: { r: 'land', k: .45, I: .25, type: 'land' }, 25: { r: 'land', k: .7, I: .5, type: 'land' }, 26: { r: 'land', k: 1, I: .75, type: 'land' },
  30: { r: 'slide', I: .8, type: 'slide' },
};

function create(cfg) {
  const rng = cfg.rng || Math.random;
  const eng = {
    rng, geo: new Geo(cfg.adapter), now: 0, ticks: 0, entities: [], nextId: 1, caps: [], capId: 0, sites: [], recentKills: {}, pressure: 0,
    events: [], sounds: [], pl: [], byId: new Map(), hash: new Hash(), lights: [], pst: new Map(), packT: 0,
    stats: { sense: 0, paths: 0, sounds: 0, capture: 0 },
    debugOn: false, forceCapture: null, log: [], logSeq: 0,
  };
  const geo = eng.geo;
  /* a short human-readable trail of what the entities decided (state changes, catches, kills, releases, lamp failures): the admin DEBUG tab reads it */
  eng.note = function (text) { this.log.push({ s: ++this.logSeq, t: +this.now.toFixed(1), x: text }); if (this.log.length > 60) this.log.shift(); };
  const tagOf = (kind, id) => String(kind || '?')[0].toUpperCase() + '#' + id;
  eng.emit = ev => {
    if (eng.events.length < 200) eng.events.push(ev);
    switch (ev.t) {
      case 'caught': eng.note(`${tagOf(ev.kind, ev.eid)} caught P${ev.pid} (${ev.ph})`); break;
      case 'kill': eng.note(`${tagOf(ev.kind, ev.eid)} KILLED P${ev.pid} · variant ${ev.variant} · ${ev.why}`); break;
      case 'release': eng.note(`E#${ev.eid} released P${ev.pid} · ${ev.why}`); break;
      case 'phase': eng.note(`E#${ev.eid} P${ev.pid} now ${ev.ph}`); break;
      case 'lightfail': eng.note(`lamps fail near ${Math.round(ev.x)},${Math.round(ev.y)} for ${(+ev.dur).toFixed(1)}s`); break;
    }
  };

  /* ------------------------------------------------------------ what the engine may know about people: a list handed in every step */
  eng.setPlayers = function (list) {
    this.pl = list; this.byId.clear(); this.hash.clear(); this.lights.length = 0;
    for (const p of list) {
      this.byId.set(p.id, p);
      if (p.alive) { this.hash.add(p, p.x, p.y); if (p.light) this.lights.push(p); }
    }
  };
  eng.playerById = function (id) { return this.byId.get(id) || null; };
  eng.nearPlayers = function (x, y, r) { const out = []; this.hash.near(x, y, r, p => { if (Math.hypot(p.x - x, p.y - y) <= r) out.push(p); }); return out; };
  eng.candidates = function (e, r) { return this.nearPlayers(e.x, e.y, r); };
  eng.nearestPlayerDist = function (x, y) { let b = 1e9; for (const p of this.pl) if (p.alive) { const d = Math.hypot(p.x - x, p.y - y); if (d < b) b = d; } return b; };
  eng.lightPlayers = function () { return this.lights; };
  eng.lightFail = function (x, y, r, dur) {
    geo.fails.push({ x, y, r, until: this.now + dur });
    this.emit({ t: 'lightfail', x, y, r, dur });
  };
  eng.blackout = () => geo.a.blackout();
  eng.commitEnd = function (pid, x, y, a) { return commitEnd(this, pid, x, y, a); };

  /* ------------------------------------------------------------ the sound bus: an event goes to every entity once; each decides what it makes of it */
  eng.sound = function (ev) {
    this.stats.sounds++;
    if (ev.ent) this.sounds.push([ev.type, Math.round(ev.x), Math.round(ev.y), +ev.I.toFixed(2), ev.ent]);       // entity sounds are also for the players' ears
    for (const e of this.entities) {
      if (e.id === ev.ent || e.tier === 'far') continue;
      hearEvent(e, this, ev);
    }
  };
  /* players make sound by what they do: standing is silent, walking is quiet, running carries, crouching almost vanishes */
  function playerNoise(dt) {
    const NZ = WORLD.NOISE;
    for (const p of eng.pl) {
      let s = eng.pst.get(p.id); if (!s) eng.pst.set(p.id, s = { d: 0, br: 0, sl: 0, str: 0 });
      if (p.evq && p.evq.length) {
        const q = p.evq.splice(0);
        if (p.alive) for (const [c, v] of q) {
          const d = EV_NOISE[c]; if (!d) continue;
          const surf = WORLD.SURF[geo.surface(p.x, p.y)] || WORLD.SURF.carpet;
          eng.sound({ x: p.x, y: p.y, r: NZ[d.r] * (d.k || 1) * surf.step, I: d.I * (.6 + .4 * v / 100), type: d.type, src: p.id, st: p.st, vx: p.vx, vy: p.vy });
        }
      }
      if (!p.alive) continue;
      const st = p.st | 0, sp = p.sp || Math.hypot(p.vx, p.vy);
      if (p.caught) {                                                          // struggling under something
        s.str -= dt; if (s.str <= 0) { s.str = .9; eng.sound({ x: p.x, y: p.y, r: 320, I: .5, type: 'struggle', src: p.id, st }); }
        continue;
      }
      if (STRIDE[st] && sp > 10) {
        s.d += sp * dt;
        if (s.d >= STRIDE[st]) {
          s.d -= STRIDE[st];
          const surf = WORLD.SURF[geo.surface(p.x, p.y)] || WORLD.SURF.carpet;
          const base = st === 1 ? NZ.walk : st === 2 ? NZ.run : st === 3 ? NZ.crouchMove : NZ.crawl, I = st === 1 ? .42 : st === 2 ? .9 : st === 3 ? .14 : .16;
          eng.sound({ x: p.x, y: p.y, r: base * surf.step, I, type: W_SN[st], src: p.id, st, vx: p.vx, vy: p.vy });
        }
      } else if (st === 5) {                                                    // the drag of a slide
        s.sl -= dt; if (s.sl <= 0) { s.sl = .3; eng.sound({ x: p.x, y: p.y, r: NZ.slide * .6, I: .5, type: 'slide', src: p.id, st, vx: p.vx, vy: p.vy }); }
      }
      // ragged breathing: an exhausted player is audible even standing still, but only close by, and hard to pin down
      const need = p.ex ? 1 : p.stamina < 26 ? .45 : 0;
      if (need > 0) { s.br -= dt; if (s.br <= 0) { s.br = p.ex ? 1.4 : 2.3; eng.sound({ x: p.x, y: p.y, r: NZ.exhaled * need, I: .35 + .15 * need, type: 'breath', src: p.id, st }); } }
    }
  }

  /* ------------------------------------------------------------ spawning */
  eng.spawn = function (kind, x, y, opts) {
    const e = mkEntity(this, kind, this.nextId++, x, y, opts || {});
    e.tierT = 0; e.senseDt = 0; e.wd = { x, y, t: 0 }; this.entities.push(e);
    return e;
  };
  eng.remove = function (id) {
    const i = this.entities.findIndex(e => e.id === id); if (i < 0) return false;
    const e = this.entities[i]; if (e.cap) finishCapture(this, e.cap, this.playerById(e.cap.pid), e);
    this.entities.splice(i, 1); return true;
  };
  eng.count = function (kind) { let n = 0; for (const e of this.entities) if (e.kind === kind) n++; return n; };
  eng.clear = function () { for (const e of this.entities.slice()) this.remove(e.id); this.caps.length = 0; this.sites.length = 0; this.recentKills = {}; this.sounds.length = 0; geo.fails.length = 0; this.pst.clear(); };

  /* ------------------------------------------------------------ one entity, one step */
  function sense(e, dt) {
    eng.stats.sense++;
    for (const id of e.mem.p.keys()) if (!eng.byId.has(id)) e.mem.p.delete(id);
    const cands = e.tier === 'near' ? eng.candidates(e, 1750) : [];
    updateVision(e, eng, dt, cands);
    decayMemory(e, dt, eng.now);
    moodTick(e, dt);
  }
  function onTier(e, nt) {
    const was = e.tier; e.tier = nt;
    if (nt === 'far') e.farSince = eng.now;
    if (was === 'far' && e.farSince !== undefined) { decayMemory(e, Math.max(0, eng.now - e.farSince), eng.now); e.farSince = undefined; }     // a sleeper's memory of the last hours fades all the same
    if (nt === 'far' && (e.state === S.HUNTING || e.state === S.SEARCHING || e.state === S.STALKING)) e.dbg.disengage = 'lost track: the prey is far out of range';
    if (nt === 'far' && !e.cap) { e.path = []; e.trav = null; e.lunge = null; e.speed = 0; if (e.kind === 'hound') { if (e.state !== S.DORMANT) { setState(e, S.DORMANT); if (e.roam) e.roam.goal = null; } e.farT = 0; } else if (e.state !== S.HIDDEN) beginHidden(eng, e); }
    if (was === 'far' && nt !== 'far') { e.wake = 1; e.thinkT = 0; if (e.state === S.DORMANT && e.kind === 'hound') setState(e, S.ROAMING); }
  }
  function farStep(e, dt) {
    e.speed = 0; if (e.cap) return;
    if (e.kind === 'hound') {
      e.farT = (e.farT || 0) - dt;
      if (!e.path.length && e.farT <= 0) { const g = randomFloor(eng, e, 900, 2800); if (g) plan(eng, e, g.x, g.y); e.farT = rand(eng, 3, 12); }
      coarseMove(eng, e, dt);
    }
  }
  /* an entity that has not gone anywhere for a long while is stuck: set it back on open floor and let it think again */
  function watchdog(e, dt) {
    const w = e.wd;
    const idle = e.act === 'listen' || e.act === 'rest' || e.act === 'feed' || e.state === S.HIDDEN || e.state === S.WATCHING || e.state === S.PLAYING || e.state === S.ALERT || e.state === S.CURIOUS || e.state === S.DORMANT || e.state === S.CAUTIOUS || e.state === S.EXCITED || e.state === S.FRUSTRATED || e.act === 'sniff' || e.act === 'freeze' || e.cap;   // standing still on purpose is not being stuck
    // a hound: only time spent trying to move counts toward 'stuck' (a pause to listen, then walking back past the same spot, is not being stuck).
    // (smilers keep the original rule: every 6 s, not moving 26 px while not idle - their behaviour tests are tuned against it)
    if (e.kind === 'hound') { if (!idle) w.t += dt; } else w.t += dt;
    w.u = (w.u || 0) + dt; if (w.u < 6) return; w.u = 0;                   // looked at every 6 s
    let stuck = false; if (w.t >= 6) { stuck = Math.hypot(e.x - w.x, e.y - w.y) < 26 && (e.kind === 'hound' || !idle); w.x = e.x; w.y = e.y; w.t = 0; }
    const embedded = !e.trav && !geo.clear(e.x, e.y, 12, e.mode || 'walk');
    if (stuck || embedded) {
      e.unstuck = (e.unstuck || 0) + 1; const nv = navOf(e); nv.recover++; if (embedded) { nv.emergency++; eng.note(`${tagOf(e.kind, e.id)} EMERGENCY un-embed at ${Math.round(e.x)},${Math.round(e.y)}`); }
      const c = geo.snap(e.x, e.y, e.caps, 4);
      if (embedded && c >= 0) { e.x = geo.cx(c); e.y = geo.cy(c); }
      e.path = []; e.trav = null; e.aim = null; e.pathAge = 99; e.goalKey = ''; e.speed = 0;
      if (e.kind === 'hound' && e.state !== S.HUNTING) { if (e.state === S.SEARCHING || e.state === S.STALKING) e.dbg.disengage = 'stuck: the watchdog reset it'; setState(e, S.ROAMING); e.roam.goal = null; }
      if (e.kind === 'smiler' && e.state !== S.HIDDEN && e.state !== S.PLAYING) beginHidden(eng, e);
    }
  }
  /* hounds that are up and about near one another act as a pack; the bond holds for a few seconds after they drift apart (they are still following the same scent) */
  function packs() {
    const hs = eng.entities.filter(e => e.kind === 'hound'), now = eng.now, fresh = new Map();
    const up = h => h.state !== S.ROAMING && h.state !== S.DORMANT;
    for (const a of hs) for (const b of hs) {
      if (a === b || !up(a) || !up(b) || Math.hypot(a.x - b.x, a.y - b.y) > 760) continue;
      const id = Math.min(a.id, b.id, fresh.get(a) || 1e9, fresh.get(b) || 1e9); fresh.set(a, id); fresh.set(b, id);
    }
    for (const h of hs) {
      const f = fresh.get(h);
      if (f) { h.pack = f; h.packOld = f; h.packUntil = now + 7; }
      else if (h.packUntil > now && h.packOld && up(h) && hs.some(o => o !== h && o.packOld === h.packOld && o.packUntil > now && up(o))) h.pack = h.packOld;
      else h.pack = 0;
    }
  }

  eng.step = function (dt) {
    const now = (this.now += dt); geo.now = now; this.ticks++;
    playerNoise(dt);
    if (geo.fails.length) geo.fails = geo.fails.filter(f => f.until > now);
    for (const e of this.entities) {
      if (e.state !== e.lgS) { if (e.lgS !== undefined) this.note(`${tagOf(e.kind, e.id)} ${e.lgS} -> ${e.state}${e.act ? ' /' + e.act : ''}`); e.lgS = e.state; }
      e.t += dt; e.stateT += dt; e.actT += dt;
      e.tierT -= dt; if (e.tierT <= 0) { e.tierT = .4 + this.rng() * .15; const nt = tierOf(e, this); if (nt !== e.tier) onTier(e, nt); }
      if (e.deaf > 0) e.deaf -= dt;
      if (e.tier === 'far') { farStep(e, dt); continue; }
      e.thinkT -= dt; e.senseDt += dt;
      let thinkNow = false;
      if (e.thinkT <= 0) { e.thinkT = e.tier === 'near' ? .1 : .35; thinkNow = true; sense(e, e.senseDt); e.senseDt = 0; }
      e.pathAge += dt;
      if (e.navGo) { navGoStep(this, e, dt); watchdog(e, dt); continue; }        // debug/test: pure navigation, no species decisions
      const res = e.sp.tick(this, e, dt, thinkNow);
      if (res && res.pv && res.pv.alive && !res.pv.caught && !e.cap) { this.stats.capture++; beginCapture(this, e, res.pv, { dir: res.dir, speed: res.speed, style: res.style }); }
      watchdog(e, dt);
    }
    separate(dt);
    for (const cap of this.caps.slice()) capStep(this, cap, dt);
    this.packT -= dt; if (this.packT <= 0) { this.packT = .5; packs(); }
  };

  /* ENTITY-ENTITY SEPARATION: mild, wall-respecting.  Bodies may press (hounds crowd each other more than smilers do) but never sit inside each other
   * for long.  n is at most a handful, so this is a plain pair loop.  Busy bodies (a capture, a kill, a vault, a lunge) are not pushed. */
  function separate(dt) {
    const E = eng.entities;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j]; if (a.tier === 'far' || b.tier === 'far') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), both = a.kind === 'hound' && b.kind === 'hound', want = (a.r + b.r) * (both ? .72 : .9);
      if (d >= want) continue;
      const nx = d > 1e-3 ? dx / d : Math.cos(a.id), ny = d > 1e-3 ? dy / d : Math.sin(a.id), push = Math.min(want - d, 140 * dt) * .5;
      const fa = !(a.cap || a.commit || a.trav || a.lunge), fb = !(b.cap || b.commit || b.trav || b.lunge);
      if (!fa && !fb) continue; const ka = fa && fb ? 1 : fa ? 2 : 0, kb = fa && fb ? 1 : fb ? 2 : 0;
      if (ka) moveCollide(eng, a, -nx * push * ka, -ny * push * ka);
      if (kb) moveCollide(eng, b, nx * push * kb, ny * push * kb);
      navOf(a).sep = (navOf(a).sep || 0) + 1;
    }
  }
  /* debug/test navigation: drive an entity through the real route + steering + locomotion + collision to (x,y) (or after a player), nothing else.
   * {x, y} or {pid}; speed = px/s; clears itself on arrival unless keep. */
  function navGoStep(eng, e, dt) {
    const g = e.navGo; let gx = g.x, gy = g.y;
    if (g.pid) { const p = eng.playerById(g.pid); if (!p) { e.navGo = null; return; } gx = p.x; gy = p.y; }
    if (g.direct !== false && directOk(eng, e, gx, gy, 700)) { directTo(eng, e, gx, gy); }
    else goTo(eng, e, gx, gy, { every: g.every ?? 1.1 });
    follow(eng, e, dt, g.speed || e.sp.speeds.roam || 100, { arrive: g.arrive ?? 20 });
    g.t = (g.t || 0) + dt;
    if (!g.pid && Math.hypot(gx - e.x, gy - e.y) < (g.arrive ?? 20) + 4) { g.done = g.t; if (!g.keep) e.navGo = null; }
  }
  /* the navigation record for the admin overlay: full route, the aim point, wanted heading vs actual motion, stuck timer, why it last re-planned */
  function navDebug(e) {
    const n = navOf(e), c = e.caps;
    return { rt: e.path.slice(0, 18).map(w => [Math.round(w.x), Math.round(w.y), w.link ? 1 : (w.c | 0) > 1 ? 2 : 0]), car: e.carrot ? [Math.round(e.carrot.x), Math.round(e.carrot.y)] : null,
      want: e.want !== undefined ? +e.want.toFixed(2) : null, vx: Math.round(e.vel.x), vy: Math.round(e.vel.y), sp: Math.round(e.speed), st: +e.stuck.toFixed(2),
      dir: e.goalKey === 'direct' ? 1 : 0, why: n.why.slice(-5).map(w => w[1] + '@' + w[0]), goal: e.goal ? [Math.round(e.goal.x), Math.round(e.goal.y)] : null,
      rc: e.rc, r: e.r, caps: (c.CAN_VAULT ? 'V' : '-') + (c.CAN_CRAWL ? 'C' : '-') + (c.CAN_USE_TIGHT_GAPS ? 'T' : '-') + (c.CAN_BREAK_DOORS ? 'B' : '-'),
      n: [n.plans, n.contacts, n.bonks, n.stuckN, n.recover, n.emergency], go: e.navGo ? (e.navGo.pid ? 'follow' : 'goto') : '' };
  }
  /* admin navigation commands on one entity (DEBUG tab) */
  eng.navCmd = function (e, cmd, pv) {
    switch (cmd) {
      case 'follow': this.navGo(e, { pid: pv.id, speed: e.kind === 'hound' ? e.sp.speeds.chase : e.sp.speeds.follow, keep: true, arrive: 60 }); return 'FOLLOWING YOU (navigation only)';
      case 'come': this.navGo(e, { x: pv.x, y: pv.y, speed: e.kind === 'hound' ? e.sp.speeds.chase : e.sp.speeds.follow, arrive: 40 }); return 'COMING TO WHERE YOU STAND';
      case 'hunt': { e.navGo = null; const r = rec(e, pv.id); r.aw = 1; r.seen = true; r.seenAt = this.now; r.lkx = pv.x; r.lky = pv.y; r.conf = 1; if (e.kind === 'hound') { beginHunt(this, e, r, 'debug'); return 'HUNTING YOU (real AI)'; } beginStalk(this, e, r); return 'STALKING YOU (real AI)'; }
      case 'clear': e.navGo = null; e.target = null; e.path = []; e.goal = null; e.goalKey = ''; if (e.kind === 'hound') setState(e, S.ROAMING); return 'TARGET AND ROUTE CLEARED';
      case 'repath': if (!e.goal) return 'NO GOAL TO RE-PLAN'; plan(this, e, e.goal.x, e.goal.y, { why: 'debug' }); return 'RE-PLANNED';
      case 'noroute': e.path = []; e.goalKey = ''; e.carrot = null; return 'ROUTE DROPPED';
      case 'unstuck': e.stuck = 0; e.nudge = 0; e.unst = null; return 'STUCK STATE RESET';
    }
    return 'UNKNOWN';
  };
  eng.navGo = function (e, o) { e.navGo = o ? Object.assign({}, o) : null; if (o) { e.path = []; e.goalKey = ''; e.tier = 'near'; e.tierT = 99; } return true; };

  /* admin aid (DEATHS tab): one chosen death on one player, through the real kill path (see previewKill in the capture part) */
  eng.previewKill = function (e, variant, pv) { return previewKill(this, e, variant, pv); };
  /* a held victim who walks out of the world (its connection closes) forfeits the capture: the holder kills it there and then, through the ordinary kill path */
  eng.forfeitCapture = function (pv) { const cap = pv && pv.caught; if (!cap || cap.phase === 'done') return false; const e = this.entities.find(q => q.id === cap.eid); if (!e) return false; killNow(this, cap, pv, e, 'forfeit'); return true; };

  /* admin aid: put an entity at (x,y) and set it on the trail of a spot */
  eng.summon = function (e, x, y, tx, ty, pid) {
    if (e.cap) return false;
    e.x = x; e.y = y; e.path = []; e.trav = null; e.lunge = null; e.speed = 0; e.tier = 'near'; e.tierT = 1;
    const r = rec(e, pid || 0); r.lkx = tx; r.lky = ty; r.conf = 1; r.aw = .9; r.seenAt = this.now; r.heardAt = this.now;
    if (e.kind === 'hound') { beginSearch(this, e, r, 'sound'); e.search.goal = { x: tx, y: ty }; e.search.first = false; setAct(e, ''); }
    else { setState(e, S.WATCHING, 'watch'); e.target = pid || 0; e.watch = { until: this.now + 8, rid: pid || 0 }; sFace(e, 1); }
    return true;
  };

  /* ------------------------------------------------------------ what goes over the wire / to the debug overlay */
  eng.snapshot = function () {
    const h = [], m = [];
    for (const e of this.entities) (e.kind === 'hound' ? h : m).push(e.sp.snap(e));
    return { h, m };
  };
  eng.drainSounds = function () { const s = this.sounds; this.sounds = []; return s; };
  eng.drainEvents = function () { const s = this.events; this.events = []; return s; };
  eng.debugInfo = function () {
    const out = [];
    for (const e of this.entities) {
      const tgt = e.target > 0 ? e.mem.p.get(e.target) : null, tp = tgt && this.playerById(tgt.id);
      let best = tgt; if (!best) { const b = bestLead(e, this.now); best = b && b[0]; }
      const near = this.nearPlayers(e.x, e.y, 1500).filter(p => p.alive).length;
      const sr = e.search && e.search.goal, cap = e.cap;
      out.push({
        i: e.id, k: e.kind, x: Math.round(e.x), y: Math.round(e.y), a: +e.ang.toFixed(2), s: e.state, ac: e.act || '-', tier: e.tier, v: Math.round(e.speed),
        mood: [+e.mood.arousal.toFixed(2), +e.mood.frustration.toFixed(2), +e.mood.excitement.toFixed(2), +e.mood.boredom.toFixed(2)],
        tg: tp ? tp.id : 0,
        lk: best ? { x: Math.round(best.lkx), y: Math.round(best.lky), age: +(this.now - Math.max(best.seenAt, best.heardAt)).toFixed(1), c: +best.conf.toFixed(2), seen: best.seen ? 1 : 0, aw: +best.aw.toFixed(2) } : null,
        vr: Math.round(e.sp.vision.range * (.5 + .7 * e.tr.VISION)),
        hr: e.hear ? { x: Math.round(e.hear.x), y: Math.round(e.hear.y), t: +(this.now - e.hear.t).toFixed(1), I: +e.hear.I.toFixed(2), ty: e.hear.type } : null,
        sg: sr ? { x: Math.round(sr.x), y: Math.round(sr.y) } : null, near,
        cp: cap ? { m: cap.mode, ph: cap.phase, v: cap.variant, t: +cap.t.toFixed(1), d: +Math.max(0, cap.decideAt - cap.t).toFixed(1), n: cap.plays } : null,
        cd: e.dbg.capture || null,
        path: e.path.slice(0, 7).map(w => [Math.round(w.x), Math.round(w.y)]),
        nv: navDebug(e),
        pu: e.dbg.pursuit || null,
        cc: [e.caps.CAN_CRAWL ? 1 : 0, e.caps.CAN_USE_TIGHT_GAPS ? 1 : 0],
        se: (() => {                                                                 // Part 1C: what it believes and why it is looking where it is looking
          const S0 = e.search, ds = e.dbg.search, r = best, est = r ? estimate(e, r, this.now, this.geo) : null;
          if (!S0 && !r && !e.dbg.disengage) return null;
          return { why: e.dbg.searchWhy || '', ph: ds ? ds.ph : '', legs: ds ? ds.legs : '', t: ds ? ds.t : 0, left: ds ? ds.left : 0, g: S0 && S0.goal ? [Math.round(S0.goal.x), Math.round(S0.goal.y), S0.goal.k, S0.goal.face || ''] : null,
            est: est ? [Math.round(est.x), Math.round(est.y), Math.round(est.unc)] : null, hd: r && Math.hypot(r.lvx, r.lvy) > 5 ? +Math.atan2(r.lvy, r.lvx).toFixed(2) : null,
            heard: r && r.heardAt > -50 ? [Math.round(r.hx), Math.round(r.hy), +(this.now - r.heardAt).toFixed(1)] : null, mem: r ? +(this.now - Math.max(r.seenAt, r.heardAt)).toFixed(1) : null,
            dis: e.dbg.disengage || '', cz: r && r.crawl && this.now - r.crawlAt < 30 ? r.crawl : '', tried: S0 ? S0.exitsTried.slice() : [], rq: e.dbg.reacquired | 0 };
        })(),
        lit: e.lit !== undefined ? +e.lit.toFixed(2) : undefined,
        sm: e.kind === 'smiler' ? { q: e.quirk || '-', enc: e.dbg.enc || '', le: e.dbg.lightEv || '', ex: +(e.exposed || 0).toFixed(2), rt: e.dbg.returned | 0, bk: e.dbg.backed | 0, sd: e.dbg.stoodDown | 0, iv: e.dbg.investigated | 0 } : undefined,
      });
    }
    return out;
  };
  return eng;
}
return { create, S, SNAMES, SCODE, HACT, SACT, TRAITS, SPECIES, HOUND, SMILER, mkRng, Geo, hearEvent, TIER };
});
