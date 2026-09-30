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
function buildStatic(a) {
  const cols = a.cols, rows = a.rows, N = cols * rows, cs = a.cell;
  const cls = new Uint8Array(N), lamp = new Float32Array(N), links = new Map();
  const cx = i => (i % cols + .5) * cs, cy = i => (Math.floor(i / cols) + .5) * cs;
  for (let i = 0; i < N; i++) {
    const x = cx(i), y = cy(i);
    if (!a.floor(Math.floor(x / 96), Math.floor(y / 96))) continue;
    if (a.clear(x, y, OL, 'walk')) cls[i] = 1;
    else if (a.clear(x, y, OL, 'crawl')) { const z = WORLD.lowZone(x, y, 10); cls[i] = z && z.type === 'gap' ? 3 : 2; }
  }
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
  return { cls, lamp, links, cols, rows, N, cs, cx, cy, cellAt };
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
    const cols = this.cols, N = this.N, cs = this.cs, st = ++this.stamp, gen = this.gen, gs = this.gs, from = this.from, heap = this.heap, hf = this.hf, links = this.links, cls = this.cls;
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
        let step = (dc && dr ? 67.9 : 48) * (cls[j] === 1 ? 1 : cls[j] === 2 ? 2.2 : 4);
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
  if (!r) e.mem.p.set(id, r = { id, aw: 0, seen: false, seenAt: -99, heardAt: -99, lkx: 0, lky: 0, lvx: 0, lvy: 0, conf: 0, hx: 0, hy: 0, st: 0, stamina: 100, ex: 0, prof: 1, light: false, iso: 0, first: -99, lost: 0 });
  return r;
}
function memAge(e, r, now) { return now - Math.max(r.seenAt, r.heardAt); }
function memHalfLife(e) { return lerp(7, 46, e.tr.MEMORY); }        // seconds until an old sighting is (mostly) forgotten
/* where might the player be now?  the last known position pushed along its last heading, with growing uncertainty */
function estimate(e, r, now) {
  const age = Math.max(0, now - r.seenAt), sp = Math.hypot(r.lvx, r.lvy);
  const dur = Math.min(age, 3.2) * (sp > 20 ? 1 : 0), k = sp > 1 ? 1 / sp : 0;
  return { x: r.lkx + r.lvx * k * Math.min(sp * dur * .55, 520), y: r.lky + r.lvy * k * Math.min(sp * dur * .55, 520), unc: 60 + Math.min(1100, sp * age * .5 + age * 18) };
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
    if (d <= Math.max(range, 70)) {
      const bearing = Math.atan2(dy, dx), inFov = d < 110 || Math.abs(angDiff(bearing, e.ang + (e.head || 0))) <= cfg.fov / 2;
      if (inFov && geo.sees(e.x, e.y, p.x, p.y, p.prof)) { vis = true; strength = clamp(Math.pow(1 - d / Math.max(range, 70), .55), .08, 1); }
    }
    r.seen = vis; r.dist = d;
    if (vis) {
      r.aw = Math.min(1, r.aw + strength * dt * (cfg.gain || 3.2));
      if (r.seenAt < now - 6) r.first = now;
      r.seenAt = now; r.lkx = p.x; r.lky = p.y; r.lvx = p.vx; r.lvy = p.vy; r.conf = 1; r.st = p.st; r.stamina = p.stamina; r.ex = p.ex; r.prof = p.prof; r.light = p.light; r.lost = 0;
      e.seenNow.add(p.id);
    }
  }
  for (const r0 of e.mem.p.values()) if (!r0.seen) r0.lost += dt;
}

/* the sound bus delivers each event to every entity once */
function hearEvent(e, eng, ev) {
  const geo = eng.geo, d = Math.hypot(ev.x - e.x, ev.y - e.y);
  let eff = ev.r * (.42 + e.tr.HEARING * 1.05) * (e.act === 'listen' ? 1.5 : 1) * (e.state === S.FEEDING ? .65 : 1) * (e.state === S.DORMANT ? .75 : 1) * (e.deaf > 0 ? .3 : 1);
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
function moveCollide(eng, e, dx, dy) {
  const geo = eng.geo, r = e.rc, ox = e.x, oy = e.y, mode = e.trav ? 'walk' : e.mode;
  if (e.trav) { e.x += dx; e.y += dy; return Math.hypot(dx, dy); }
  for (const ax of [0, 1]) {
    if (ax === 0) e.x += dx; else e.y += dy;
    for (const t of geo.blockers(e.x, e.y, mode)) {
      const nx = Math.max(t.x, Math.min(e.x, t.x + t.w)), ny = Math.max(t.y, Math.min(e.y, t.y + t.h)), ddx = e.x - nx, ddy = e.y - ny, d = Math.hypot(ddx, ddy);
      if (d < r) { if (d > 0) { e.x += ddx / d * (r - d); e.y += ddy / d * (r - d); } else { if (ax === 0) e.x = ox; else e.y = oy; } }
    }
  }
  return Math.hypot(e.x - ox, e.y - oy);
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

function plan(eng, e, gx, gy, opts = {}) {
  const key = Math.round(gx / 48) + ',' + Math.round(gy / 48);
  const cost = opts.cost || e.sp.pathCost && e.sp.pathCost(eng, e);
  const p = eng.geo.path(e.x, e.y, gx, gy, e.caps, { cost, maxNodes: opts.maxNodes });
  e.goal = { x: gx, y: gy }; e.goalKey = key; e.pathAge = 0; e.aim = null;
  if (!p) { e.path = []; e.unreachable = eng.now; return false; }
  e.path = p; e.unreachable = 0; return true;
}
/* set a destination.  re-plans if the goal moved, the path is old, or we have none */
function goTo(eng, e, gx, gy, opts = {}) {
  const key = Math.round(gx / 48) + ',' + Math.round(gy / 48);
  const stale = e.pathAge > (opts.every ?? 1.1);
  if (key !== e.goalKey || (stale && !e.trav) || (!e.path.length && !e.trav && e.pathAge > .3)) return plan(eng, e, gx, gy, opts);
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
function steerTo(eng, e, tx, ty, vmax, dt, o = {}) {
  const want = Math.atan2(ty - e.y, tx - e.x), err = angDiff(want, e.ang), sp = e.sp;
  const ratio = clamp(e.speed / (sp.vTop || 300), 0, 1);
  const turn = e.caps.TURNING_ABILITY * (o.turnMul || 1) * (1 - (sp.turnPenalty || .55) * ratio) * (e.mood.frustration > .6 ? 1.12 : 1);
  e.ang = (e.ang + clamp(err, -turn * dt, turn * dt) + TAU) % TAU;
  const align = Math.cos(Math.min(Math.abs(err), 1.5));
  const target = o.hold ? 0 : vmax * (o.noSlow ? 1 : clamp(align, .1, 1));
  const acc = (e.caps.ACCELERATION || 500) * (o.accMul || 1);
  e.speed = approach(e.speed, target, (target > e.speed ? acc : acc * 2.2) * dt);
  const step = e.speed * dt;
  e.moved = moveCollide(eng, e, Math.cos(e.ang) * step, Math.sin(e.ang) * step);
  if (step > 1 && e.moved < step * .3) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt * 1.5);
}
/* walk the planned path; returns 'arrived' | 'moving' | 'nopath' */
function follow(eng, e, dt, vmax, o = {}) {
  const geo = eng.geo;
  e.cellCls = geo.cls[geo.cellAt(e.x, e.y)] | 0;
  e.mode = modeFor(e);
  if (e.trav) { stepTrav(eng, e, dt); return 'moving'; }
  const arrive = o.arrive ?? 18;
  while (e.path.length) {
    const wp = e.path[0], last = e.path.length === 1, d = Math.hypot(wp.x - e.x, wp.y - e.y);
    if (d < (last ? arrive : 22) && !wp.link) { e.path.shift(); continue; }
    if (wp.link) {                                    // a vault: walk to its start, then go over
      const L = wp.link;
      if (Math.hypot(L.ax - e.x, L.ay - e.y) < 28) { beginTrav(eng, e, L); return 'moving'; }
      break;
    }
    break;
  }
  const wp = e.path[0];
  if (!wp) { e.speed = approach(e.speed, 0, (e.caps.ACCELERATION || 500) * 2.2 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); return e.goal && Math.hypot(e.goal.x - e.x, e.goal.y - e.y) > (o.arrive ?? 18) + 30 ? 'nopath' : 'arrived'; }
  let tx = wp.x, ty = wp.y;
  if (wp.link) { tx = wp.link.ax; ty = wp.link.ay; }
  else {                                              // cut corners where the way is clear
    e.aimT -= dt;
    if (e.aimT <= 0 || !e.aim) {
      e.aimT = .14; e.aim = null;
      for (let i = Math.min(e.path.length - 1, 5); i > 0; i--) {
        let bad = false; for (let k = 0; k <= i; k++) if (e.path[k].link) { bad = true; break; }
        if (bad) continue;
        if (geo.lineClear(e.x, e.y, e.path[i].x, e.path[i].y, e.rc, e.mode)) { e.aim = e.path[i]; break; }
      }
    }
    if (e.aim && e.path.includes(e.aim)) { tx = e.aim.x; ty = e.aim.y; }
  }
  steerTo(eng, e, tx, ty, vmax, dt, o);
  if (e.stuck > .9) { e.stuck = 0; e.pathAge = 99; e.aim = null; if (e.goal) plan(eng, e, e.goal.x, e.goal.y); e.nudge = (e.nudge || 0) + 1; if (e.nudge > 3) { e.nudge = 0; e.path = []; } }
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
  const ang = Math.atan2(pv.y - e.y, pv.x - e.x);
  ctx.wall = wallBehind(eng.geo, pv.x, pv.y, Math.cos(ang), Math.sin(ang));       // the wall the victim would be driven into: decided once, used for the choice and the record
  const variant = pickVariant(eng, e, pv, ctx, cap.attack || {});
  const geo = { ax: e.x, ay: e.y, aa: ang, wall: variant === 'C' ? ctx.wall : null };
  cap.variant = variant; cap.phase = 'done'; cap.why = why;
  pv.alive = false;                                                        // dead from this instant: nothing else gets to capture or kill the same person in this very tick
  e.dbg.capture = Object.assign(e.dbg.capture || {}, { variant, why });
  eng.emit({ t: 'kill', pid: pv.id, eid: e.id, kind: e.sp.name, variant, why, geo, victim: { x: pv.x, y: pv.y, a: pv.angle } });
  eng.sites.push({ x: pv.x, y: pv.y, t: eng.now, kind: e.kind, pid: pv.id, fed: 0 });
  if (eng.sites.length > 12) eng.sites.shift();
  finishCapture(eng, cap, pv, e);
  e.sp.capture.afterKill && e.sp.capture.afterKill(eng, e, ctx, pv);
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
  vision: { range: 640, fov: 2.7, dark: false, gain: 3.0 },
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

/* SEARCHING: check the last known position, listen, then likely paths.  Wrong guesses are allowed. -------------------------------- */
function beginSearch(eng, e, r, why) {
  setState(e, S.SEARCHING, 'freeze');
  e.search = { rid: r ? r.id : 0, started: eng.now, goal: null, phase: 'go', legs: 0, visited: [], why, until: eng.now + lerp(11, 36, e.tr.PERSISTENCE) * (.75 + .5 * (1 - e.tr.PATIENCE)), pause: 0, first: true };
  e.dbg.searchWhy = why;
  if (r) { const est = estimate(e, r, eng.now); e.search.goal = { x: r.lkx, y: r.lky }; e.search.est = est; }
}
function pickSearchGoal(eng, e, s) {
  const r = e.mem.p.get(s.rid), now = eng.now;
  const base = r ? estimate(e, r, now) : { x: e.x, y: e.y, unc: 500 };
  const hd = r ? Math.atan2(r.lvy, r.lvx) : e.ang, sp = r ? Math.hypot(r.lvx, r.lvy) : 0;
  let best = null, bs = -1e9;
  const R = Math.max(260, Math.min(1100, base.unc * .9));
  for (let i = 0; i < 14; i++) {
    const a = eng.rng() * TAU, d = rand(eng, 120, R);
    const gx = base.x + Math.cos(a) * d, gy = base.y + Math.sin(a) * d, cell = eng.geo.cellAt(gx, gy);
    if (cell < 0 || eng.geo.cls[cell] !== 1) continue;
    const p = { x: eng.geo.cx(cell), y: eng.geo.cy(cell) };
    let sc = -Math.hypot(p.x - base.x, p.y - base.y) * .3 + (sp > 30 ? Math.cos(angDiff(Math.atan2(p.y - base.y, p.x - base.x), hd)) * 240 : 0) - Math.hypot(p.x - e.x, p.y - e.y) * .12 + eng.rng() * 110;
    for (const v of s.visited) if (Math.hypot(v.x - p.x, v.y - p.y) < 260) { sc -= 320; break; }
    if (e.mem.visited.has(cell) && now - e.mem.visited.get(cell) < 40) sc -= 200;
    if (sc > bs) { bs = sc; best = p; }
  }
  return best;
}
function hSearch(eng, e, dt, thinkNow) {
  const s = e.search; if (!s) { setState(e, S.ROAMING); return; }
  const now = eng.now;
  if (e.act === 'freeze') {                                                // a beat to listen on arrival / first snap decision
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.1) * .55;
    if (e.actT > (s.first ? rand(eng, .25, .6) : rand(eng, .7, 1.7))) { s.first = false; setAct(e, 'sniff'); s.pause = 0; }
    return;
  }
  if (e.act === 'sniff' && s.phase === 'pause') {
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 3.2) * .6; s.pause += dt;
    if (s.pause > rand(eng, .9, 2.2)) { s.phase = 'go'; s.goal = pickSearchGoal(eng, e, s); s.legs++; setAct(e, ''); e.mood.frustration = Math.min(1, e.mood.frustration + .07); }
    return;
  }
  if (now > s.until || s.legs > 7) { e.mood.frustration = Math.min(1, e.mood.frustration + .25); setState(e, S.FRUSTRATED, 'pace'); e.frus = { until: now + rand(eng, 2, 4.5) }; return; }
  if (!s.goal) { s.goal = pickSearchGoal(eng, e, s); if (!s.goal) { setState(e, S.ROAMING); return; } }
  goTo(eng, e, s.goal.x, s.goal.y, { every: 1.5 });
  const st = follow(eng, e, dt, hSpeed(e, s.why === 'sound' ? 'investigate' : 'search', eng), {});
  e.head = Math.sin(e.t * 1.6) * .35;
  if (st === 'arrived' || st === 'nopath' || dist(e.x, e.y, s.goal.x, s.goal.y) < 50) {
    const c = eng.geo.cellAt(e.x, e.y); if (c >= 0) e.mem.visited.set(c, now); s.visited.push({ x: s.goal.x, y: s.goal.y });
    s.phase = 'pause'; setAct(e, 'sniff'); s.pause = 0; s.goal = null;
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
    const gx = tgt.x + tgt.vx * lead, gy = tgt.y + tgt.vy * lead;
    if (eng.geo.lineClear(e.x, e.y, tgt.x, tgt.y, 16, 'walk') && dist(e.x, e.y, tgt.x, tgt.y) < 620) { e.path = [{ x: gx, y: gy }]; e.goal = { x: gx, y: gy }; e.goalKey = 'direct'; e.pathAge = 0; }
    else goTo(eng, e, gx, gy, { every: .45 });
    e.dbg.pursuit = { x: gx, y: gy };
  } else {
    e.chaseBlind += dt;
    const est = estimate(e, r, now);
    goTo(eng, e, est.x, est.y, { every: .5 });
    e.dbg.pursuit = { x: est.x, y: est.y, blind: +e.chaseBlind.toFixed(1) };
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
const LIT_MAX = .5;                                                        // above this a smiler will not stand in the light
const SMILER = {
  name: 'Smiler', kind: 'smiler', initial: S.HIDDEN, radius: 23, clearance: 21, vTop: 250, turnPenalty: .3, roamSpeed: 80,
  traits: { INTELLIGENCE: .86, SADISM: .58, HUNGER: .12, PATIENCE: .9, CURIOSITY: .58, CAUTION: .66, TERRITORIALITY: .7, AGGRESSION: .5, PERSISTENCE: .62, SOCIAL: .72, HEARING: .42, VISION: .92, LIGHT_SENS: .86, MEMORY: .82 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: .6, CAN_CROUCH: false, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: true, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.1, ACCELERATION: 520 },
  vision: { range: 1000, fov: 2.4, dark: true, gain: 2.4 },
  lightSensitive: true,
  speeds: { roam: 84, follow: 108, stalk: 88, creep: 44, rush: 246, retreat: 178 },
  init(eng, e) { e.face = 0; e.faceT = 0; e.exposed = 0; e.watch = null; e.follow = null; e.style = null; e.special = null; e.disap = null; e.post = { x: e.x, y: e.y }; e.cool.special = rand(eng, 60, 200); e.rushT = 0; },
  pathCost(eng, e) {
    const geo = eng.geo, black = eng.geo.a.blackout();
    return j => (!black && geo.lamp[j] >= .2 ? 520 : 0);
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
    const s = r.aw * .5 + r.conf * .5 + (others === 0 ? .7 : -.35 * others) - Math.hypot(r.lkx - e.x, r.lky - e.y) / 5000 + (r.ex ? .2 : 0) + (r.light ? -.05 : .05);
    if (s > bs) { bs = s; best = { r, pv, alone: others === 0, others }; }
  }
  return best;
}
function sExposure(eng, e, dt) {
  if (e.state === S.PLAYING || e.state === S.ATTACKING || e.state === S.DISAPPEARING || e.trav) { e.exposed = 0; return false; }
  const lit = litAt(eng, e.x, e.y); e.dbg.lit = +lit.toFixed(2); e.lit = lit;
  if (lit > .62 - e.tr.LIGHT_SENS * .08 || (lit > LIT_MAX && e.state === S.HIDDEN)) e.exposed += dt; else e.exposed = Math.max(0, e.exposed - dt * 2);
  if (e.exposed > .22) { beginDisappear(eng, e, 'lit'); return true; }
  return false;
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
function beginWatch(eng, e, r) { setState(e, S.WATCHING, 'watch'); e.target = r.id; e.watch = { until: eng.now + rand(eng, 4, 13) * (.6 + e.tr.PATIENCE * .8), rid: r.id }; sFace(e, 1); }
function beginFollow(eng, e, r) { setState(e, S.FOLLOWING, 'follow'); e.target = r.id; e.follow = { since: eng.now, until: eng.now + rand(eng, 25, 70) * (.6 + e.tr.PERSISTENCE), rid: r.id, goalT: 0 }; sFace(e, .55); }
function beginStalk(eng, e, r, style) { setState(e, S.STALKING, 'creep'); e.target = r.id; e.style = style || 'rush'; e.stalk = { since: eng.now, hold: 0, rid: r.id }; sFace(e, .85); }

function smilerTick(eng, e, dt, thinkNow) {
  const now = eng.now, black = eng.geo.a.blackout();
  e.face += clamp(e.faceT - e.face, -dt * (e.faceT > e.face ? .8 : 1.4), dt * (e.faceT > e.face ? .8 : 1.4));
  e.cool.special = Math.max(0, (e.cool.special || 0) - dt);
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
          const boldness = e.tr.CURIOSITY * .5 + (prey.alone ? .35 : -.2) + (black ? .15 : 0) + e.mood.boredom * .2;
          if (prey.r.dist < 1000 && e.hiddenFor > .8 && eng.rng() < clamp(boldness, .04, .8) * .16) { beginWatch(eng, e, prey.r); break; }
          if (!prey.alone && eng.rng() < .012 && e.tr.SOCIAL > .4) beginFollow(eng, e, prey.r);         // groups are followed, not engaged
          if (prey.r.dist < 190 && e.hiddenFor > .5) { beginDisappear(eng, e, 'too-close'); break; }
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
        if (d < 240 || beam) { beginDisappear(eng, e, d < 240 ? 'approached' : 'beam'); break; }
        if (now > w.until) {
          const prey = sPrey(eng, e), alone = prey && prey.alone;
          const pick = pickW(eng.rng, [{ k: 'follow', w: alone ? 1.6 : .8 }, { k: 'again', w: .6 }, { k: 'fade', w: .8 + (1 - e.tr.CURIOSITY) }, { k: 'stalk', w: alone && e.tr.AGGRESSION > .3 ? .7 + e.tr.SADISM * .5 : 0 }]);
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
      if (F.goal && d > 380) {
        const nxt = e.path[0] || F.goal, l = litAt(eng, nxt.x, nxt.y);
        if (l > LIT_MAX && !black) { stopMoving(eng, e, dt); setAct(e, 'wait'); }                               // the edge of the light: it waits there, grinning
        else { setAct(e, 'follow'); follow(eng, e, dt, e.sp.speeds.follow * (r.seen ? 1 : .9), { arrive: 30 }); }
      } else { stopMoving(eng, e, dt); if (r.seen) faceToward(e, tx, ty, dt, 2); }
      if (thinkNow) {
        const prey = sPrey(eng, e);
        if (prey && prey.r === r && r.seen) {
          const dark = litAt(eng, pv.x, pv.y) < .45 || black;
          if (prey.alone && dark && now - F.since > 6 && eng.rng() < (.08 + e.tr.AGGRESSION * .1) * (black ? 2 : 1) * (prey.r.ex ? 1.5 : 1)) { beginStalk(eng, e, r); break; }
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
      const gx = pv.x + pv.vx * .18, gy = pv.y + pv.vy * .18;
      if (eng.geo.lineClear(e.x, e.y, pv.x, pv.y, 16, 'walk')) { e.path = [{ x: gx, y: gy }]; e.goal = { x: gx, y: gy }; e.goalKey = 'direct'; e.pathAge = 0; } else goTo(eng, e, pv.x, pv.y, { every: .35 });
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
    debugOn: false,
  };
  const geo = eng.geo;
  eng.emit = ev => { if (eng.events.length < 200) eng.events.push(ev); };

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
    const w = e.wd; w.t += dt;
    if (w.t < 6) return;
    const moved = Math.hypot(e.x - w.x, e.y - w.y); w.x = e.x; w.y = e.y; w.t = 0;
    const idle = e.act === 'listen' || e.act === 'rest' || e.act === 'feed' || e.state === S.HIDDEN || e.state === S.WATCHING || e.state === S.PLAYING || e.state === S.ALERT || e.state === S.CURIOUS || e.state === S.DORMANT || e.state === S.CAUTIOUS || e.state === S.EXCITED || e.cap;
    const embedded = !e.trav && !geo.clear(e.x, e.y, 12, e.mode || 'walk');
    if ((moved < 26 && !idle) || embedded) {
      e.unstuck = (e.unstuck || 0) + 1;
      const c = geo.snap(e.x, e.y, e.caps, 4);
      if (embedded && c >= 0) { e.x = geo.cx(c); e.y = geo.cy(c); }
      e.path = []; e.trav = null; e.aim = null; e.pathAge = 99; e.goalKey = ''; e.speed = 0;
      if (e.kind === 'hound' && e.state !== S.HUNTING) { setState(e, S.ROAMING); e.roam.goal = null; }
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
      e.t += dt; e.stateT += dt; e.actT += dt;
      e.tierT -= dt; if (e.tierT <= 0) { e.tierT = .4 + this.rng() * .15; const nt = tierOf(e, this); if (nt !== e.tier) onTier(e, nt); }
      if (e.deaf > 0) e.deaf -= dt;
      if (e.tier === 'far') { farStep(e, dt); continue; }
      e.thinkT -= dt; e.senseDt += dt;
      let thinkNow = false;
      if (e.thinkT <= 0) { e.thinkT = e.tier === 'near' ? .1 : .35; thinkNow = true; sense(e, e.senseDt); e.senseDt = 0; }
      e.pathAge += dt;
      const res = e.sp.tick(this, e, dt, thinkNow);
      if (res && res.pv && res.pv.alive && !res.pv.caught && !e.cap) { this.stats.capture++; beginCapture(this, e, res.pv, { dir: res.dir, speed: res.speed, style: res.style }); }
      watchdog(e, dt);
    }
    for (const cap of this.caps.slice()) capStep(this, cap, dt);
    this.packT -= dt; if (this.packT <= 0) { this.packT = .5; packs(); }
  };

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
        pu: e.dbg.pursuit || null,
        lit: e.lit !== undefined ? +e.lit.toFixed(2) : undefined,
        tr: e.kind === 'hound' ? undefined : undefined,
      });
    }
    return out;
  };
  return eng;
}
return { create, S, SNAMES, SCODE, HACT, SACT, TRAITS, SPECIES, HOUND, SMILER, mkRng, Geo, hearEvent, TIER };
});
