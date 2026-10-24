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
// Stable, unsigned FNV-1a derivation; tags separate fixed-size entity streams from the world director.
function deriveSeed(seed, ...tags) {
  let h = (2166136261 ^ (seed >>> 0)) >>> 0;
  for (const tag of tags) { const s = String(tag); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; h = Math.imul(h ^ 255, 16777619) >>> 0; }
  return h;
}
function entityStreams(seed, kind, id) {
  const out = {}; for (const tag of ['personality', 'behavior', 'search', 'perception', 'schedule']) out[tag] = mkRng(deriveSeed(seed, kind, id, tag));
  return out;
}
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
    if (players) for (const p of players) { if (!p.light) continue; const q = this.a.qc(p, { x, y }, true); if (q > a && this.los(p.x, p.y, x, y)) a = q; }   // (v23) a torch does not light through walls
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
const KIND_GLARE = { flashlight: 1, headlamp: .85, lantern: .8 };  // (v23: the camcorder emits no visible light at all - it is not in this table)

/* ================================================================ Part 2 (v23, stage 2C): the evidence law.
 * The server knows the truth; an entity acts only on evidence it legitimately has.  Two kinds of knowledge, kept apart:
 *   ATTRIBUTED  e.mem.p  - one record per player the entity has actually SEEN (sight is what tells one person from another).  Its target
 *                          (e.target) is always one of these.  Each record keeps its fused belief (lkx/lky/conf) plus a short list of typed
 *                          evidence entries (r.ev: see / sound / light), each with position, uncertainty radius, confidence and time.
 *   ANONYMOUS   e.mem.leads - things it noticed that it cannot pin on anybody: a lit wall, a beam crossing a doorway, a light source seen
 *                          without the person behind it.  pid is always null.  A lead is an INVESTIGATION GOAL (e.inv), never a target.
 *                          It becomes attributed only when the entity then sees a player where the lead points (attributeLeads).
 * Records are created by sight or explicit admin/contact paths; unidentified hearing creates anonymous leads.  Nothing here
 * reads where an unsensed player really is. */
const EV_MAX = 4, LEAD_MAX = 6, LEAD_MAXAGE = 45;
function newMemory() { return { p: new Map(), sounds: [], others: new Map(), visited: new Map(), leads: [], leadId: 0, soundId: 0, habits: new Map(), hypotheses: [] }; }
function rec(e, id) {
  let r = e.mem.p.get(id);
  if (!r && e.mem.p.size >= INTEL.players) { const old = [...e.mem.p.values()].sort((a,b) => Math.max(a.seenAt,a.heardAt)-Math.max(b.seenAt,b.heardAt) || a.id-b.id)[0]; forgetIdentity(e, old.id); }
  if (!r) e.mem.p.set(id, r = { id, aw: 0, seen: false, seenAt: -99, heardAt: -99, lkx: 0, lky: 0, lvx: 0, lvy: 0, conf: 0, hx: 0, hy: 0, st: 0, stamina: 100, ex: 0, prof: 1, light: false, iso: 0, first: -99, lost: 0, hLoud: -99, hvx: 0, hvy: 0, crawl: null, crawlAt: -99, ev: [], downAt: -99, heldAt: -99 });
  return r;
}
/* one typed evidence entry on an attributed record (the newest of each kind is kept) */
function noteEv(r, k, x, y, u, c, t) {
  const ev = r.ev || (r.ev = []), q = ev.find(o => o.k === k);
  if (q) { q.x = x; q.y = y; q.u = u; q.c = c; q.t = t; }
  else { ev.unshift({ k, x, y, u, c, t }); if (ev.length > EV_MAX) ev.pop(); }
}
/* an anonymous lead: merged into a matching recent one (same place, give or take both uncertainties), otherwise a new one */
function addLead(e, now, L) {
  const leads = e.mem.leads;
  for (const q of leads) {
    if (evidenceModality(q.k) !== evidenceModality(L.k)) continue;
    if (now - q.t > 6 || Math.hypot(q.x - L.x, q.y - L.y) > (q.u + L.u) * .6) continue;
    const w = L.c / (L.c + q.c * .8);
    q.x += (L.x - q.x) * w; q.y += (L.y - q.y) * w; q.u = Math.max(L.u * .75, Math.min(q.u, L.u) * .95);          // seeing the same thing again firms it up a little, never past what one look can tell
    q.c = Math.min(1, Math.max(q.c, L.c) + .05); q.t = now; q.n++; q.sal = Math.max(q.sal * .7, L.sal); q.k = L.k === 'source' ? 'source' : q.k; if (L.dir !== undefined) q.dir = L.dir;
    return q;
  }
  const n = Object.assign({ id: ++e.mem.leadId, pid: null, t0: now, t: now, n: 1 }, L); leads.push(n);
  if (leads.length > LEAD_MAX) { let wi = 0; for (let i = 1; i < leads.length; i++) if (leads[i].c < leads[wi].c) wi = i; leads.splice(wi, 1); }
  return n;
}
/* sight of a player where a lead points turns the lead into attributed evidence (the only way a lead ever gets a name) */
function attributeLeads(e, r, p, now) {
  const leads = e.mem.leads;
  for (let i = leads.length - 1; i >= 0; i--) {
    const L = leads[i]; if (L.k !== 'source' || !p.light || now - L.t > .5 || Math.hypot(L.x-p.x,L.y-p.y)>60) continue;
    const owners=[...e.seenNow].map(id=>e.mem.p.get(id)).filter(r=>r.visual&&r.light&&Math.hypot(r.visual.x-L.x,r.visual.y-L.y)<60); if(owners.length!==1||owners[0].id!==r.id) continue;
    noteEv(r, 'light', L.x, L.y, L.u, L.c, L.t); leads.splice(i, 1);
    if (e.inv && e.inv.lead === L.id) e.inv = null;
  }
}
/* the strongest anonymous lead (an investigation goal, not a target) */
function bestAnonLead(e, now, modality) {
  let best = null, bs = 0;
  for (const L of e.mem.leads) { if (modality && evidenceModality(L.k) !== modality) continue; const s = observationScore(e, L, now) + L.sal * .3; if (s > bs) { bs = s; best = L; } }
  return best;
}
/* where the entity believes a player is: the body itself while it is seen, otherwise its memory (never the truth) */
function perc(eng, e, r) {
  if (r.seen) { const p = r.visual; if (p) return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, sp: Math.hypot(p.vx, p.vy), angle: p.angle, seen: true, p }; }
  const est = estimate(e, r, eng.now, eng.geo); return { x: est.x, y: est.y, vx: r.lvx, vy: r.lvy, sp: Math.hypot(r.lvx, r.lvy), seen: false, p: null, unc: est.unc };
}
/* a body in physical contact (capture range): contact is physics, not perception */
function touching(eng, e, id, reach) { const p = eng.playerById(id); return p && p.alive && !p.caught && Math.hypot(p.x - e.x, p.y - e.y) < reach ? p : null; }
/* has this entity perceived that the player is out of the hunt (dead, or in another creature's grip)?  Only what it saw; the player leaving the
 * game (record deleted) is housekeeping */
function tgtGone(eng, e, r) {
  if (!r || !eng.byId.has(r.id)) return true;
  if (r.seen && r.visual) return !r.visual.alive || !!r.visual.caught;
  return (r.downAt > -50 && r.downAt >= r.seenAt - .01) || (r.heldAt > -50 && r.heldAt >= r.seenAt - .01);
}
/* target commitment: once it has picked somebody it keeps them for a moment unless it has truly lost them (no per-tick flicker between two people) */
const TARGET_DWELL = 1.5;
function setTarget(e, id, now) { if (e.target !== id) { e.target = id; e.tgtSince = now; } }
function mayRetarget(e, now) { const cur = e.target > 0 ? e.mem.p.get(e.target) : null; return !cur || cur.conf < .2 || now - (e.tgtSince ?? -99) > TARGET_DWELL; }
/* EYE CONTACT: this entity sees the player, and the player is looking at it (the character's facing, sent by its client - not a screen), from a
 * distance at which the player could make it out: close by, or with the entity itself in light.  Used by Part 2 stages 2D/2E; debug-visible now. */
const EYE_CONE = .35;
function facedBy(eng, e, p, r, emit = 0, own = null) {        // emit: how visible the entity makes itself in the dark (a Smiler's gleaming face)
  if (!p || !p.alive || !r || !r.seen) return null;             // own: the light on itself as the entity knows it (2D Smiler: the lamp field + beams it saw) -
  const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 900) return null;    //      then nobody's torch is read from where they really are
  const off = Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.angle)); if (off > EYE_CONE) return null;
  const lit = Math.max(emit, own !== null ? own : eng.geo.lightLevel(e.x, e.y, eng.lightPlayers()));
  if (d > 240 && lit < .3) return null;
  return { d, off, lit };
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

function visualObservation(e, eng, p) {
  const geo = eng.geo, cfg = e.sp.vision;
  if (!p.alive) return {vis:false,strength:0,d:Infinity};
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);        // (v23: no record is made for somebody it does not see)
    let vis = false, strength = 0;
    const stName = W_SN[p.st] || 'stand';
    let range = cfg.range * (.5 + .7 * e.tr.VISION);
    const lit = geo.lightLevel(p.x, p.y, null), own = p.light ? (KIND_GLARE[p.kind] || 1) : 0;
    let lightF = cfg.dark ? .82 + .18 * Math.max(lit, own) : .3 + .7 * Math.max(lit, own * .9);
    if (p.light && !cfg.dark) lightF *= 1 + .55 * own;                         // a lit lantern is a beacon
    const motion = .7 + .5 * clamp(p.sp / 172, 0, 1.4);
    range *= lightF * (POSTURE_VIS[p.st] || 1) * motion * (e.act === 'listen' ? .8 : 1);
    const floor = cfg.floor || 70;                                            // something crouched in the dark right beside it is noticed regardless of posture
    if (d <= Math.max(range, floor)) {
      const bearing = Math.atan2(dy, dx), inFov = d < 110 || Math.abs(angDiff(bearing, e.ang + (e.head || 0))) <= cfg.fov / 2;
      // under an occluder (a table, the wall round a hole) a body can only be made out from close by, whatever the light: not visible from across the room
      const cz = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y) : null;
      if (inFov && (!cz || d < cz.reveal) && geo.sees(e.x, e.y, p.x, p.y, p.prof)) { vis = true; strength = clamp(Math.pow(1 - d / Math.max(range, floor), .55), .08, 1); }
    }
  return { vis, strength, d };
}

function updateVision(e, eng, dt, cands) {
  const geo = eng.geo, now = eng.now, cfg = e.sp.vision;
  e.seenNow.clear();
  for (const r0 of e.mem.p.values()) r0.seen = false;
  for (const p of cands) {
    if (!p.alive) continue;
    let r = e.mem.p.get(p.id); const {vis, strength, d} = visualObservation(e, eng, p);
    if (!vis) continue;
    if (!r) r = rec(e, p.id);
    r.seen = vis; r.dist = d;
    if (vis) {
      if (p.caught) r.heldAt = now;                                              // it can see that somebody else has them
      r.aw = Math.min(1, r.aw + strength * dt * (cfg.gain || 3.2));
      if (r.seenAt < now - 6) r.first = now;
      const cw = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y, 34) : null; if (cw) { r.crawl = cw.id; r.crawlAt = now; } else if (now - r.crawlAt > 2) r.crawl = null;   // seen going into (or at the mouth of) a crawlspace: remembered
      r.seenAt = now; r.lkx = p.x; r.lky = p.y; r.lvx = p.vx; r.lvy = p.vy; r.conf = 1; r.st = p.st; r.stamina = p.stamina; r.ex = p.ex; r.prof = p.prof; r.light = p.light; r.lost = 0;
      r.visual = {id:p.id,x:p.x,y:p.y,vx:p.vx,vy:p.vy,angle:p.angle,alive:p.alive,caught:!!p.caught,st:p.st,ex:p.ex,t:now};
      habitObserve(e, r, now);
      noteEv(r, 'see', p.x, p.y, 16, 1, now);
      e.seenNow.add(p.id);
    }
  }
  for (const id of e.seenNow) { const r=e.mem.p.get(id); if(e.mem.leads.length) attributeLeads(e,r,{...r.visual,light:r.light},now); }
  // a body it can see lying where it last saw that person: it knows they are down (a dead player is no longer a candidate, so this looks at
  // the records it already has, and only at a spot in its own view)
  if (e.tier === 'near') for (const r0 of e.mem.p.values()) {
    if (r0.seen || r0.downAt >= r0.seenAt) continue;
    const pv = eng.playerById(r0.id); if (!pv || pv.alive || !pv.dead) continue;
    const d = Math.hypot(pv.x - e.x, pv.y - e.y);
    if (d < 900 && (d < 110 || Math.abs(angDiff(Math.atan2(pv.y - e.y, pv.x - e.x), e.ang + (e.head || 0))) <= cfg.fov / 2) && geo.los(e.x, e.y, pv.x, pv.y)) r0.downAt = now;
  }
  for (const r0 of e.mem.p.values()) if (!r0.seen) r0.lost += dt;
}

/* the sound bus delivers each event to every entity once */
function hearEvent(e, eng, ev) {
  const geo = eng.geo, d = Math.hypot(ev.x - e.x, ev.y - e.y);
  const identified = identifySound(eng, e, ev);
  const focus = identified && identified.id === e.target && (e.state === S.HUNTING || e.state === S.SEARCHING) && (ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land') ? 1.3 : 1;   // a hunting animal tracks its prey's running footfalls further - careful movement gets no such penalty
  let eff = ev.r * (.42 + e.tr.HEARING * 1.05) * focus * (e.act === 'listen' ? 1.5 : 1) * (e.state === S.FEEDING ? .65 : 1) * (e.state === S.DORMANT ? .75 : 1) * (e.deaf > 0 ? .3 : 1);
  if (e.sp.hearScale) eff *= e.sp.hearScale(ev);                              // (Trial 3 R20) a species with its own ear (opt-in: the Skin-Stealer's, by kind of sound)
  if (d > eff * 1.05) return;
  const clear = geo.los(e.x, e.y, ev.x, ev.y);
  if (!clear) eff *= e.sp.hearWall || .6;                                       // (R20: its own share through a wall, if it has one)
  if (d > eff) return;
  const I = ev.I * Math.pow(1 - d / eff, .7);
  if (I < .03) return;
  const unc = (26 + d * .16) * (clear ? 1 : 1.75) * (1.55 - e.tr.INTELLIGENCE * .45) * (1.4 - e.tr.HEARING * .35) * (ev.type === 'breath' ? 1.5 : 1);
  const a = e.streams.perception() * TAU, m = Math.sqrt(e.streams.perception()) * unc, hx = ev.x + Math.cos(a) * m, hy = ev.y + Math.sin(a) * m;
  const h = { id: ++e.mem.soundId, x: hx, y: hy, I, type: ev.type, t: eng.now, src: identified ? identified.id : (ev.ent || ev.src < 0) ? -1 : 0, pid: identified ? identified.id : null, attribution: identified ? 'identified' : 'anonymous', modality: 'sound', c: Math.min(1,.4+.5*I), u: unc, unc, clear };
  e.hear = h; e.heardCount = (e.heardCount || 0) + 1;
  e.mem.sounds.unshift(h); if (e.mem.sounds.length > 8) e.mem.sounds.pop();
  if (identified) {
    const r = identified;
    const loud = I > .3 || ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land';
    if (loud) { const pdt = eng.now - r.hLoud; if (pdt > .15 && pdt < 1.6) { r.hvx = lerp(r.hvx, (hx - r.hx) / pdt, .5); r.hvy = lerp(r.hvy, (hy - r.hy) / pdt, .5); } else if (pdt >= 1.6) { r.hvx = 0; r.hvy = 0; } r.hLoud = eng.now; }   // where the footsteps are going
    r.heardAt = eng.now; r.hx = hx; r.hy = hy; r.aw = Math.min(1, r.aw + I * .9);
    noteEv(r, 'sound', hx, hy, unc, Math.min(1, .4 + .5 * I), eng.now);
    if (eng.now - r.seenAt > 1.2) {                                              // not in sight: the sound is all we have
      const k = Math.min(1, I * 1.4 + .25);
      r.lkx = lerp(r.lkx, hx, r.conf < .35 ? 1 : k); r.lky = lerp(r.lky, hy, r.conf < .35 ? 1 : k);
      r.conf = Math.max(r.conf, .4 + .5 * I); r.st = ev.st !== undefined ? ev.st : r.st;
      // (v23) which way it is going: only what the footsteps themselves say (the heading built from successive heard positions, fuzz and all).
      // It used to copy the player's true velocity here - the one place hearing leaked the truth.
      if (loud && Math.hypot(r.hvx, r.hvy) > 1) { r.lvx = r.hvx; r.lvy = r.hvy; }
    }
  }
  if (!identified && h.src === 0) addLead(e, eng.now, {k:'sound',x:h.x,y:h.y,u:h.unc,c:h.c,sal:h.I,type:h.type});
  return h;
}

function decayMemory(e, dt, now) {
  const half = memHalfLife(e);
  for (const r of e.mem.p.values()) {
    if (!r.seen) { r.aw = Math.max(0, r.aw - dt * (.05 + .16 * (1 - e.tr.PERSISTENCE))); r.conf = Math.max(0, r.conf - dt / half); }
    if (r.ev && r.ev.length) for (let i = r.ev.length - 1; i >= 0; i--) if (now - r.ev[i].t > half * 3) r.ev.splice(i, 1);
  }
  for (let i = e.mem.sounds.length - 1; i >= 0; i--) if (now - e.mem.sounds[i].t > 25) e.mem.sounds.splice(i, 1);
  // anonymous leads fade like any memory (a little faster: it never knew what they were); turning a light off stops new ones, it does not erase these
  const L = e.mem.leads;
  for (let i = L.length - 1; i >= 0; i--) { const q = L[i]; q.c -= dt / (half * .6); q.sal *= Math.exp(-dt / 4); if (q.c < .05 || now - q.t > LEAD_MAXAGE) { L.splice(i, 1); if (e.inv && e.inv.lead === q.id) e.inv = null; } }
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
/* (v23) built from its own records and leads only - it used to walk the true player list and read the exact position of anybody carrying a lit
 * torch in line of sight.  A light it saw without the person is an anonymous threat (id 0): it adds to the danger, it names nobody. */
function threatsAround(e, eng, victimId, cands) {
  const now = eng.now, out = [], v = cands.find(p => p.id === victimId), vx = v ? v.x : e.x, vy = v ? v.y : e.y;
  for (const r of e.mem.p.values()) {
    if (r.id === victimId || tgtGone(eng, e, r)) continue;
    let cert = 0, how = '', x = r.lkx, y = r.lky, vxh = 0, vyh = 0;
    const lt = r.ev && r.ev.find(q => q.k === 'light' && now - q.t < 2.6);
    if (r.seen && r.visual) { const p = r.visual; cert = 1; how = 'seen'; x = p.x; y = p.y; vxh = p.vx; vyh = p.vy; }
    else if (now - r.heardAt < 2.6 && Math.hypot(r.hx - vx, r.hy - vy) < 1100) { cert = .65; how = 'heard'; x = r.hx; y = r.hy; vxh = r.hvx; vyh = r.hvy; }
    else if (lt && Math.hypot(lt.x - vx, lt.y - vy) < 1700) { cert = .6; how = 'light'; x = lt.x; y = lt.y; }
    else if (now - r.seenAt < 9 && Math.hypot(r.lkx - vx, r.lky - vy) < 650) { cert = .42 * (1 - (now - r.seenAt) / 9); how = 'together'; }
    if (cert <= 0 || Math.hypot(x - e.x, y - e.y) > 2200) continue;
    const d = Math.hypot(x - vx, y - vy), toV = Math.atan2(vy - y, vx - x), heading = Math.atan2(vyh, vxh);
    const approaching = how !== 'together' && Math.hypot(vxh, vyh) > 50 && Math.abs(angDiff(heading, toV)) < 1.1 && d < 1400;
    out.push({ id: r.id, cert, how, dist: d, approaching, x, y, seesUs: how === 'seen' });
  }
  for (const L of e.mem.leads) {
    if (now - L.t > 2.6) continue; const d = Math.hypot(L.x - vx, L.y - vy); if (d > 1100) continue;
    out.push({ id: 0, cert: .45, how: L.k === 'sound' ? 'sound-anon' : 'light-anon', dist: d, approaching: false, x: L.x, y: L.y, seesUs: false });
  }
  return out;
}
const W_SN = WORLD.SN;
/* Stage 2F: shared evidence tools, never a species action brain. Inputs are observations only.
 * See STAGE_2F_DESIGN.md: physical contact, lifecycle and LOD are explicit system boundaries. */
const INTEL = Object.freeze({ players: 16, sounds: 8, soundTTL: 25, leads: 6, leadTTL: 45, evidence: 4, recordTTL: 120, visited: 128, visitedTTL: 60, habitObs: 6, hypotheses: 3, habitTTL: 30, habitRepeats: 3, habitBias: .12, candidates: 70, debugCandidates: 12 });
const evidenceModality = k => k === 'see' ? 'sight' : k === 'sound' ? 'sound' : 'light';
const evidenceWeights = e => e.sp.evidence || (e.kind === 'hound' ? { sight: 4, sound: 1.4, light: .8 } : { sight: 2, sound: 1.2, light: 2.2 });   // (Trial 3: a species may carry its own)
function observationScore(e, q, now) {
  const modality = q.modality || evidenceModality(q.k), age = Math.max(0, now - q.t);
  const c = clamp(q.c ?? q.confidence ?? 0, 0, 1), u = Math.max(0, q.u ?? q.unc ?? 0);
  return evidenceWeights(e)[modality] * c * Math.exp(-age / (modality === 'sight' ? 4 : 3)) / (1 + u / 600) + (q.pid > 0 && q.pid === e.target ? .25 : 0);
}
function soundChoice(e, now) {
  let best = null, score = -Infinity;
  for (const h of e.mem.sounds) {
    if (h.t <= (e.lastHearT ?? -99) || now - h.t > 1.2) continue;
    const s = observationScore(e, h, now) * (.5 + h.I);
    if (s > score || (s === score && h.id < best.id)) { best = h; score = s; }
  }
  return best;
}
function evidenceCandidates(e, now) {
  const out = [];
  for (const r of e.mem.p.values()) for (const q of r.ev) out.push({ key: `P${r.id}/${q.k}`, pid: r.id, attribution: 'identified', modality: evidenceModality(q.k), x: q.x, y: q.y, t: q.t, c: q.c, u: q.u, expires: q.t + memHalfLife(e) * 3 });
  for (const L of e.mem.leads) out.push({ key: `L${L.id}`, pid: null, attribution: 'anonymous', modality: evidenceModality(L.k), x: L.x, y: L.y, t: L.t, c: L.c, u: L.u, expires: L.t + LEAD_MAXAGE, lead: L.id });
  for (const q of out) q.score = observationScore(e, q, now);
  out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return out.slice(0, INTEL.candidates);
}
function arbitrateEvidence(eng, e) {
  const heard = soundChoice(e, eng.now); if (heard) e.hear = heard; else if (e.hear && eng.now - e.hear.t > INTEL.soundTTL) e.hear = null;
  const all = evidenceCandidates(e, eng.now), top = all[0];
  e.evidence = { candidates: all.slice(0, INTEL.debugCandidates), winner: top ? top.key : null,
    why: top ? `${e.kind} weights: ${top.modality}, ${top.attribution}, confidence/age/uncertainty${top.pid === e.target ? ', current-target continuity' : ''}; species state/commitment/canon triggers decide the action` : 'no credible evidence',
    weights: evidenceWeights(e) };
}
// Only a direct, currently valid visual continuation can name a sound. SourceId alone is never proof.
function identifySound(eng, e, ev) {
  if (!(ev.src > 0)) return null;
  const r = e.mem.p.get(ev.src);
  if (!r || !r.seen || !r.visual || eng.now - r.seenAt > .12) return null;
  let unique = null;
  for (const p of eng.candidates(e, 1750)) {
    if (Math.hypot(p.x - ev.x, p.y - ev.y) > 24 || !visualObservation(e, eng, p).vis) continue;
    if (unique) return null; // overlapping visible people do not make source identity unambiguous
    unique = p;
  }
  return unique && unique.id === r.id ? r : null;
}
function habitObserve(e, r, now) {
  const v = r.visual; if (!v || !r.seen) return;
  const cell = `${Math.floor(v.x / 192)},${Math.floor(v.y / 192)}`;
  const prev = r.habitLast, moving = Math.hypot(v.vx, v.vy) > 30;
  if (!moving || (prev && cell === prev.cell) || (prev && now - prev.t < 1.5)) return;
  r.habitLast = { cell, t: now };
  const dir = Math.atan2(v.vy, v.vx), key = cell + '/' + ((Math.round(dir / (Math.PI / 2)) + 4) % 4);
  const entries = e.mem.habits.get(r.id) || []; entries.push({ key, x: v.x, y: v.y, dir, t: now });
  while (entries.length > INTEL.habitObs) entries.shift(); e.mem.habits.set(r.id, entries);
}
function cleanHabits(e, now) {
  if(e.dbg.habitRejected && now-e.dbg.habitRejected.t>30)e.dbg.habitRejected=null;
  const hs = [];
  for (const [id, history] of e.mem.habits) {
    const r = e.mem.p.get(id), recent = history.filter(q => now - q.t <= INTEL.habitTTL);
    if (!r || now - Math.max(r.seenAt, r.heardAt) > INTEL.habitTTL || !recent.length) { e.mem.habits.delete(id); e.dbg.habitRejected = {t:now, why:'observations expired or identity stale'}; if (r) r.habitLast = null; continue; }
    e.mem.habits.set(id, recent);
    const groups = new Map(); for (const q of recent) { const g = groups.get(q.key) || []; g.push(q); groups.set(q.key, g); }
    for (const [key, qs] of groups) if (qs.length >= INTEL.habitRepeats) hs.push({ pid: id, key, ...qs[qs.length - 1], count: qs.length, bias: INTEL.habitBias, expires: qs[0].t + INTEL.habitTTL });
  }
  hs.sort((a, b) => b.count - a.count || b.t - a.t || a.pid - b.pid || a.key.localeCompare(b.key)); e.mem.hypotheses = hs.slice(0, INTEL.hypotheses);
  if(e.dbg.habit && !e.mem.hypotheses.some(h=>h.pid===e.dbg.habit.pid&&h.key===e.dbg.habit.key))e.dbg.habit=null;
  if (!e.seenNow.size && [S.ROAMING, S.DORMANT, S.HIDDEN, S.DISAPPEARING].includes(e.state)) { if(e.mem.habits.size)e.dbg.habitRejected={t:now,why:'encounter ended'};e.mem.habits.clear(); e.mem.hypotheses = [];e.dbg.habit=null; for (const r of e.mem.p.values()) r.habitLast = null; }
}
function habitBias(e, id, x, y, score) {
  const h = e.mem.hypotheses.find(h => h.pid === id && Math.hypot(h.x - x, h.y - y) < 280);
  if (!h) return score;
  const delta = Math.abs(score) * h.bias; e.dbg.habit = { pid: id, key: h.key, count: h.count, bias: h.bias, delta, x, y };
  return score + delta; // only already-plausible geometry candidates reach this function
}
function forgetIdentity(e, id) {
  e.mem.p.delete(id); e.mem.habits.delete(id); e.mem.hypotheses = e.mem.hypotheses.filter(h => h.pid !== id); e.seenNow.delete(id);
  e.mem.sounds = e.mem.sounds.filter(h => h.pid !== id);
  if (e.hear && e.hear.pid === id) e.hear = null;
  if (e.target === id) { e.target = null; e.hEye = null; e.dbg.retarget = 'identity lifecycle ended'; }
  if (e.att) e.att.delete(id);
  if (e.pulledOff?.id === id) e.pulledOff = null;
  if (e.heldRetreatId === id) { e.heldRetreatId = null; e.heldRetreatAt = -99; }
  if (e.feed?.guard === id) e.feed.guard = null;
  if (e.search?.rid === id) e.search = null;
  if (e.caut?.rid === id) e.caut = null;
  if (e.alert?.rid === id) e.alert = null;
  if (e.cur?.rid === id) e.cur = null;
  e.evidence = null; e.dbg.habit = null; e.dbg.habitRejected=null;
}
function cleanupKnowledge(eng, e) {
  const now = eng.now;
  for (const [id, r] of e.mem.p) if (!eng.byId.has(id) || now - Math.max(r.seenAt, r.heardAt) > INTEL.recordTTL) forgetIdentity(e, id);
  for (const [cell, t] of e.mem.visited) if (now - t > INTEL.visitedTTL) e.mem.visited.delete(cell);
  while (e.mem.visited.size > INTEL.visited) e.mem.visited.delete(e.mem.visited.keys().next().value);
  if (e.hChecked) e.hChecked = e.hChecked.filter(q => q.until > now).slice(-6);
  if (e.att) for (const id of e.att.keys()) if (!e.mem.p.has(id)) e.att.delete(id);
  cleanHabits(e, now);
}
function intelligenceDebug(eng, e) {
  const A = e.evidence;
  const targets=[...e.mem.p.values()].map(r=>({pid:r.id,score:+(e.kind==='hound'?houndTargetScore(e,r,eng.now)+(r.id===e.target ? .65 : 0):e.sp.targetScore?e.sp.targetScore(eng,e,r):sScore(eng,e,r)).toFixed(3),current:r.id===e.target,seen:r.seen,
    why:tgtGone(eng,e,r)?'rejected: perceived unavailable':e.kind==='hound'&&!hMaySwitch(e,r,eng.now)?'commitment prevents switch':e.kind==='smiler'&&!r.seen&&(eng.now-r.seenAt>2.5||r.conf<.3)?'rejected: stale/uncertain':r.id===e.target?'current target; species state/trigger rules apply':'observed candidate; species state/trigger rules apply'})).sort((a,b)=>b.score-a.score||a.pid-b.pid).slice(0,12);
  const pending=[];for(const [pid,history]of e.mem.habits){const counts=new Map();for(const q of history)counts.set(q.key,(counts.get(q.key)||0)+1);for(const [key,count]of counts)if(count<INTEL.habitRepeats)pending.push({pid,key,count,why:'rejected: fewer than three observed repetitions'});}
  return { winner: A?.winner || null, why: A?.why || 'no evidence', weights: A?.weights || evidenceWeights(e),
    candidates: (A?.candidates || []).map(q => ({ key: q.key, attribution: q.attribution, modality: q.modality, score: +q.score.toFixed(3), c: +q.c.toFixed(2), u: Math.round(q.u), age: +(eng.now - q.t).toFixed(2), expires: +(q.expires - eng.now).toFixed(1) })),
    sound: e.hear ? { attribution: e.hear.attribution, x: Math.round(e.hear.x), y: Math.round(e.hear.y), type: e.hear.type } : null,
    habits: e.mem.hypotheses.map(h => ({ pid: h.pid, count: h.count, bias: h.bias, x: Math.round(h.x), y: Math.round(h.y), expires: +(h.expires - eng.now).toFixed(1) })),
    target:e.target||null, targets, commitment:{age:+(eng.now-(e.tgtSince??eng.now)).toFixed(2),dwell:e.kind==='hound'?hDwell(e):e.sp.dwell?e.sp.dwell(e):SM_DWELL}, rejectedHabits:pending.slice(0,3), habitExpiry:e.dbg.habitRejected||null, applied: e.dbg.habit || null, rng: e.rngKey, tags: Object.keys(e.streams),
    counts: { players: e.mem.p.size, sounds: e.mem.sounds.length, leads: e.mem.leads.length, visits: e.mem.visited.size, habitObservations: [...e.mem.habits.values()].reduce((n,h) => n+h.length,0), hypotheses: e.mem.hypotheses.length } };
}

/* ---------------------------------------------------------------- visible light as evidence (Part 2, stage 2C)
 * Player lights are a physical signal.  What a light does is worked out once for everybody (beamsOf: where each visible emitter's light really
 * falls - the rays stop at walls); what one entity can make of it is worked out from its own position (observeBeam: only the parts it has a
 * line of sight to, inside its field of view).  Three qualities of knowledge come out of it:
 *   the SOURCE is in view      -> 'source' lead at that spot (a light, not yet a person: sight of the body is what names somebody)
 *   a BEAM crossing its view   -> 'beam' lead: the brighter end of the visible beam says which way the light came from, not how far
 *   a LIT WALL / FLOOR patch   -> 'litwall' / 'litfloor' lead: somewhere on the open side of that patch, with a wide uncertainty
 * inferLead() is a pure function of the observation record (plus the fixed level geometry): it cannot reach the carrier's true position, which
 * a test checks by moving an unsensed carrier while replaying the identical observations (s_evidence E6).
 * Infrared is not in here and cannot get in: beams are built only from the visible-light emitter table (kinds[k].power > 0).  2C-IR will keep
 * infrared outside the engine's player view altogether.
 * Cost: beams at ~8 Hz for all lit players (3 rays + 2 samples each), each near entity looks at them at 4 Hz, a handful of LOS rays per beam. */
const LIGHT_DT = .25, BEAM_DT = .12;
const BEAM_RAYS = [0, -.3, .3], BEAM_AIR = [.3, .62];
const q05 = v => Math.round(v * 20) / 20;                                    // brightness as the eye has it: coarse
function beamsOf(eng) {
  if (eng.beamsT > eng.now && eng.beams) return eng.beams;
  eng.beamsT = eng.now + BEAM_DT;
  const geo = eng.geo, kinds = geo.a.kinds || {}, out = [], hist = eng.beamHist || (eng.beamHist = new Map()), live = new Set();
  for (const p of eng.lights) {
    const K = kinds[p.kind]; if (!K || !(K.power > 0)) continue;             // no visible emitter, no beam (the camcorder has none)
    live.add(p.id);
    let h = hist.get(p.id); if (!h) hist.set(p.id, h = { on: false, onAt: -99, cx: 0, cy: 0 });
    if (!h.on) { h.on = true; h.onAt = eng.now; }
    const omni = !!K.omni, dirs = omni ? [0, 1, 2, 3, 4, 5].map(i => i / 6 * TAU) : BEAM_RAYS.map(o => p.angle + o * K.arc);
    const rays = [];
    for (let i = 0; i < dirs.length; i++) {
      const a = dirs[i], d = geo.ray(p.x, p.y, a, K.range), wall = d < K.range - 2, dd = Math.max(0, d - 4);
      const I = q05(K.power * (1 - sm(24, K.range, d)) * (omni || i === 0 ? 1 : .6));
      if (I <= 0) continue;
      rays.push({ x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd, wall, I });
    }
    const air = [];
    if (!omni) { const d0 = geo.ray(p.x, p.y, p.angle, K.range); for (const f of BEAM_AIR) { const t = d0 * f; air.push({ x: p.x + Math.cos(p.angle) * t, y: p.y + Math.sin(p.angle) * t, I: q05(K.power * (1 - sm(24, K.range, t))) }); } }
    let cx = 0, cy = 0; for (const r of rays) { cx += r.x; cy += r.y; } if (rays.length) { cx /= rays.length; cy /= rays.length; }
    const moved = Math.hypot(cx - h.cx, cy - h.cy) > 40; h.cx = cx; h.cy = cy;
    out.push({ o: { x: p.x, y: p.y }, ang: p.angle, arc: omni ? TAU : K.arc, range: K.range, omni, rays, air, fresh: eng.now - h.onAt < .8, moved });
  }
  for (const [id, h] of hist) if (!live.has(id)) { if (!eng.byId.has(id)) hist.delete(id); else h.on = false; }
  eng.beams = out; return out;
}
/* what this entity can actually see of one beam (or null) - the observation record, nothing else leaves this function */
function observeBeam(eng, e, b) {
  const geo = eng.geo, fov = e.sp.vision.fov, look = e.ang + (e.head || 0);
  const inView = (x, y, d) => d < 110 || Math.abs(angDiff(Math.atan2(y - e.y, x - e.x), look)) <= fov / 2;
  const dO = Math.hypot(b.o.x - e.x, b.o.y - e.y);
  let src = null, flash = false;
  const inCone = b.omni || Math.abs(angDiff(Math.atan2(e.y - b.o.y, e.x - b.o.x), b.ang)) < b.arc * .5;
  // 2E: a visible beam physically reaching a Hound is an attention stimulus even from behind.
  // Only the visible emitter is observed; a human still requires updateVision. Keep Smilers unchanged.
  const hitHound = e.kind === 'hound' && inCone && dO < b.range;
  if (dO < (inCone ? 1700 : 650) && (inView(b.o.x, b.o.y, dO) || hitHound) && geo.los(e.x, e.y, b.o.x, b.o.y)) { src = { x: b.o.x, y: b.o.y }; flash = e.kind === 'hound' ? hitHound : inCone && dO < b.range * 1.6; }
  const pts = [], air = [];
  for (const h of b.rays) { const d = Math.hypot(h.x - e.x, h.y - e.y); if (d < 1500 && inView(h.x, h.y, d) && geo.los(e.x, e.y, h.x, h.y)) pts.push({ x: Math.round(h.x), y: Math.round(h.y), I: h.I, w: h.wall ? 1 : 0 }); }
  for (const h of b.air) { const d = Math.hypot(h.x - e.x, h.y - e.y); if (d < 900 && inView(h.x, h.y, d) && geo.los(e.x, e.y, h.x, h.y)) air.push({ x: Math.round(h.x), y: Math.round(h.y), I: h.I }); }
  if (!src && !pts.length && !air.length) return null;
  return { src, flash, pts, air, fresh: b.fresh, moved: b.moved };
}
/* which way is open from a spot (static level geometry only): the lit face of a wall faces the room the light came from */
function openSide(geo, x, y) {
  let nx = 0, ny = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; if (geo.ray(x, y, a, 64) >= 62) { nx += Math.cos(a); ny += Math.sin(a); } }
  const l = Math.hypot(nx, ny); return l > .3 ? { x: nx / l, y: ny / l } : null;
}
/* THE INFERENCE: observation -> anonymous lead.  Pure: (entity position, observation, level geometry) -> lead.  Never the carrier. */
function inferLead(e, o, geo) {
  if (o.src) return { k: 'source', x: o.src.x, y: o.src.y, u: 35, c: o.flash ? .95 : .8, sal: o.flash ? 1 : clamp(.55 + (o.fresh ? .3 : 0) + (o.moved ? .1 : 0), 0, 1), flash: o.flash };
  const all = o.pts.concat(o.air); if (!all.length) return null;
  let maxI = 0; for (const q of all) maxI = Math.max(maxI, q.I);
  const c = clamp(.22 + .07 * all.length + (o.fresh ? .15 : 0) + (o.moved ? .08 : 0) + maxI * .4, .2, .8), sal = clamp(.25 + (o.fresh ? .4 : 0) + (o.moved ? .25 : 0) + maxI * .3, 0, 1);
  let bx, by, dir, k, u;
  if (o.air.length >= 2) {                                                   // a beam in the air: the bright end points back at the light
    const s = o.air.slice().sort((a, b) => b.I - a.I), a0 = s[0], a1 = s[s.length - 1];
    dir = a0.I > a1.I ? Math.atan2(a0.y - a1.y, a0.x - a1.x) : null;
    if (dir === null) { bx = (a0.x + a1.x) / 2; by = (a0.y + a1.y) / 2; }
    else { const G = Math.max(0, Math.min(170, geo.ray(a0.x, a0.y, dir, 200) - 26)); bx = a0.x + Math.cos(dir) * G; by = a0.y + Math.sin(dir) * G; }
    k = 'beam'; u = 170 + .15 * Math.hypot(a0.x - e.x, a0.y - e.y);
  } else {                                                                    // only lit surfaces: somewhere on their open side
    let cx = 0, cy = 0; for (const q of all) { cx += q.x; cy += q.y; } cx /= all.length; cy /= all.length;
    const n = openSide(geo, cx, cy), G = n ? Math.max(0, Math.min(220, geo.ray(cx, cy, Math.atan2(n.y, n.x), 250) - 26)) : 0;
    bx = cx + (n ? n.x * G : 0); by = cy + (n ? n.y * G : 0);
    k = o.pts.some(q => q.w) ? 'litwall' : 'litfloor'; u = 260 + .2 * Math.hypot(cx - e.x, cy - e.y);
  }
  const L = { k, x: bx, y: by, u, c, sal }; if (dir !== undefined && dir !== null) L.dir = +dir.toFixed(3);
  return L;
}
/* one near entity, 4 times a second: look at the lights */
function lightSense(eng, e) {
  if ((e.lsT || 0) > eng.now) return; e.lsT = eng.now + LIGHT_DT;
  let obs = [];
  for (const b of beamsOf(eng)) { if (Math.hypot(b.o.x - e.x, b.o.y - e.y) > 1900 + b.range) continue; const o = observeBeam(eng, e, b); if (o) obs.push(o); }
  if (eng.obsHook) obs = eng.obsHook(e, obs) || [];                          // (tests: record / replay exactly what the entity observed)
  e.lightObs = obs.length;
  obs.sort((a,b) => { const A=a.src||a.pts[0]||a.air[0]||{}, B=b.src||b.pts[0]||b.air[0]||{}; return (A.x||0)-(B.x||0) || (A.y||0)-(B.y||0); });
  for (const o of obs) {
    const L = inferLead(e, o, eng.geo); if (!L) continue;
    if (L.k === 'source') {                                                   // a light it sees in the hand of somebody it is looking at right now: that is their light
      const owners = [...e.seenNow].map(id=>e.mem.p.get(id)).filter(r=>r.visual && r.light && Math.hypot(r.visual.x-L.x,r.visual.y-L.y)<60); const own=owners.length===1?owners[0]:null;
      if (own) { noteEv(own, 'light', L.x, L.y, L.u, L.c, eng.now); if (L.flash) e.flashAt = eng.now; e.dbg.light = `source (in the hand of P${own.id}) @${eng.now.toFixed(1)}`; continue; }
    }
    const q = addLead(e, eng.now, L);
    if (L.flash) e.flashAt = eng.now;
    e.dbg.light = `${L.k} c${L.c.toFixed(2)} u${Math.round(L.u)}${o.fresh ? ' fresh' : ''}${o.moved ? ' moving' : ''} @${eng.now.toFixed(1)}`;

  }
  const best = bestAnonLead(e, eng.now, 'light'), current=e.inv&&e.mem.leads.find(q=>q.id===e.inv.lead&&q.k!=='sound');
  if(best && (!current || best.id===current.id || observationScore(e,best,eng.now)>observationScore(e,current,eng.now)*1.25)) e.inv={lead:best.id,x:best.x,y:best.y,u:best.u,c:best.c*(.5+best.sal),k:best.k,t:best.t};

}

/* ---------------------------------------------------------------- entities: personality, movement, traversal, state plumbing */
function personality(sp, rng) {
  const tr = {};
  for (const k of TRAITS) tr[k] = clamp((sp.traits[k] ?? .5) + (rng() * 2 - 1) * (sp.jitter ?? .12), .02, .98);   // same species, different individuals
  return tr;
}
function mkEntity(eng, kind, id, x, y, opts = {}) {
  const sp = SPECIES[kind], streams = entityStreams(eng.seed, kind, id), tr = personality(sp, streams.personality);
  const e = {
    id, kind, sp, tr, streams, rng: streams.behavior, rngKey: `${eng.seed}/${kind}/${id}`, caps: Object.assign({}, sp.caps, opts.caps || {}),
    x, y, ang: streams.behavior() * TAU, head: 0, speed: 0, r: sp.radius, rc: sp.clearance || OL,
    state: sp.initial || S.ROAMING, act: '', stateT: 0, actT: 0, t: 0,
    goal: null, path: [], pathAge: 99, goalKey: '', trav: null, mode: 'walk', aim: null, aimT: 0,
    mem: newMemory(), seenNow: new Set(), hear: null, heardCount: 0, deaf: 0,
    mood: { arousal: .1, frustration: 0, excitement: 0, boredom: 0 },
    tier: 'near', thinkT: streams.schedule() * .1, target: null, stuck: 0, home: { x, y }, spawn: { x, y },
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
  const turnV = o.hold ? 0 : vmax * (o.noSlow ? 1 : clamp(align, .1, 1));       // (R20) the speed its own turn allows: what its progress is measured against
  let target = turnV;
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
  // stuck = it wants to move and does not.  (R20) A species that opts in (caps.TURN_AWARE_STUCK: the Skin-Stealer) measures it against
  // the speed its own turn allows, not the speed a wall or a corner braked it to: against its full speed, a body slowed to 10-15 % to turn
  // round on open floor counted as stuck - the open-air STUCK.  Every other species keeps R8-R19's yardstick, its full speed: the Hound's and
  // the Smiler's movement and recovery are B++'s byte for byte (the gate's server golden traces hold them)
  const intent = Math.max(step, (e.caps.TURN_AWARE_STUCK ? turnV : o.hold ? 0 : vmax) * dt * .5);
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
    // (Trial 3 R19, the N track) the aim swinging back - over 57 deg off the body's heading - for a waypoint the body has passed on the inside
    // of a bend: it cut the corner and is beside the waypoint - over the line square to the next leg through it, on the side its heading
    // turns toward to take the next leg (the inside of the bend while it turns into it; a test of its heading, not of the bend's geometry:
    // the review's fresh seeds found every drop on the inside), the waypoint 80 deg or more off its heading,
    // within 26 px and .12 s of its travel - and can get onto the next leg from here: the line to a point its own look-ahead along it (64-150
    // px by its speed, or the whole leg) is clear by its collider and 2 px, and neither the next waypoint nor the one after is a vault link
    // or a crawl cell.  The waypoint is dropped and this tick followed again without it.  R8-R18 kept it until the body was 26 px from it or the
    // whole next leg was clear: the aim fell back to the waypoint beside or behind it, the heading error passed 90 deg and the body stopped,
    // pivoted and went (the stop-pivot-go of a Hound at a bend).  Only then: an aim that does not swing back is R18's, unchanged
    const n1 = e.path[1], n2 = e.path[2];
    if (!o.passed && n1 && !n1.link && (n1.c | 0) <= 1 && (wp.c | 0) <= 1 && !(n2 && (n2.link || (n2.c | 0) > 1)) && Math.abs(angDiff(Math.atan2(ty - e.y, tx - e.x), e.ang)) > 1) {
      const d = Math.hypot(wp.x - e.x, wp.y - e.y), ll = Math.hypot(n1.x - wp.x, n1.y - wp.y) || 1, ux = (n1.x - wp.x) / ll, uy = (n1.y - wp.y) / ll, k = Math.min(ll, clamp(e.speed * .42, 64, 150));
      const hx = Math.cos(e.ang), hy = Math.sin(e.ang), inner = (ux * (e.y - wp.y) - uy * (e.x - wp.x)) * (hx * uy - hy * ux) > 0;
      if (d < 26 + e.speed * .12 && inner && (e.x - wp.x) * ux + (e.y - wp.y) * uy > 0 && Math.abs(angDiff(Math.atan2(wp.y - e.y, wp.x - e.x), e.ang)) > 1.4 && geo.lineClear(e.x, e.y, wp.x + ux * k, wp.y + uy * k, e.rc + 2, e.mode)) {
        e.path.shift(); navOf(e).passed = (navOf(e).passed || 0) + 1; return follow(eng, e, dt, vmax, Object.assign({}, o, { passed: 1 }));
      }
    }
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
  // (R20 D3, the Skin-Stealer's alone: caps.TURN_AWARE_STUCK) a second side-step at the same spot within 2.5 s goes straight to the new
  // route: R8-R19's ladder, pinned on a corner its waypoint's line clips, side-stepped every second and never reached the new route (each
  // side-step lets the timer fall back) until the watchdog cleared its route 6 s on - the "stuck: the watchdog cleared its route" a
  // search showed in R20's traces.  Every other species keeps the ladder as it was
  const U = e.unstAt;
  if (e.stuck > .35 && !e.unst && e.caps.TURN_AWARE_STUCK && U && eng.now - U.t < 2.5 && Math.hypot(e.x - U.x, e.y - U.y) < 40) { e.stuck = 1; e.unstAt = null; }
  else if (e.stuck > .35 && !e.unst) {
    const want = e.want ?? e.ang; let best = null, bs = -1e9;
    for (let k = 0; k < 12; k++) { const a = want + (k - 6) / 12 * TAU, free = geo.ray(e.x, e.y, a, 90), sc = free - Math.abs(angDiff(a, want)) * 25; if (free > e.rc + 20 && sc > bs) { bs = sc; best = a; } }
    if (best !== null) { e.unst = { dir: best, until: eng.now + .45 }; navOf(e).recover++; if (e.caps.TURN_AWARE_STUCK) e.unstAt = { t: eng.now, x: e.x, y: e.y }; }
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
    const a = e.streams.search() * TAU, d = lerp(minD, maxD, e.streams.search()), x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
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
  if (eng.forceCapture && !e.sp.capture.noPlay) return eng.forceCapture;   // admin override (DEATHS tab): every catch is a quick kill / every catch is played with
                                                                        // (Trial 3: a species that never plays with its prey - the Skin-Stealer - is not made to)
  const sp = e.sp.capture, q = sp.quick(e, ctx);
  return e.rng() < q ? 'quick' : 'play';
}
function pickVariant(eng, e, pv, ctx, attack) {
  const hist = eng.recentKills[e.kind] || (eng.recentKills[e.kind] = []);
  const items = e.sp.capture.variants(eng, e, pv, ctx, attack);
  const n = hist.length, twice = n >= 2 && hist[n - 1] === hist[n - 2] ? hist[n - 1] : null;             // never a third identical death in a row when there is any alternative
  for (const it of items) { const i = hist.lastIndexOf(it.k); if (i >= 0) { const age = n - i; it.w *= age === 1 ? .35 : age === 2 ? .6 : .8; } if (it.k === twice) it.w *= .06; }
  const v = pickW(e.rng, items.filter(i => i.w > 0));
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
  cap.phase = 'down'; cap.phaseT = 0; cap.down = rand(e, 1.0, 1.9);
  cap.decideAt = rand(e, 5, 15) * (.7 + .5 * e.tr.PATIENCE);          // the tense stretch before the next major decision
  cap.variant = null;
  eng.emit({ t: 'caught', pid: pv.id, eid: e.id, kind: e.sp.name, ph: 'down', from: { x: e.x, y: e.y }, ang: Math.atan2(pv.y - e.y, pv.x - e.x) });
  e.sp.capture.onBegin && e.sp.capture.onBegin(eng, e, cap, pv);
  return cap;
}
const rand = (e, a, b) => a + e.rng() * (b - a);

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
  if (e.kind === 'hound' || e.sp.capture.commit) { beginCommit(eng, e, pv, variant, ctx); return; }   // (Trial 3: the Skin-Stealer commits to its kill too)
  e.sp.capture.afterKill && e.sp.capture.afterKill(eng, e, ctx, pv);
}
/* KILL COMMITMENT (v20): a hound that kills stays on its kill for as long as the death takes to play out on every screen (the clients' death lengths,
 * dphys.js DURS), ignoring everyone else; only then does it make its after-kill decision (next victim / guard / feed / leave) - with the situation as it is THEN.
 * The victim's client reports where the attacker ended up in the animation (drag etc.); the hound is set down there if that spot is close and clear. */
const KILL_DUR = { A: 4.5, B: 4.7, C: 4.3, D: 4.5 };
function beginCommit(eng, e, pv, variant, ctx) {
  const durs = e.sp.capture.commitDur || KILL_DUR;                           // (Trial 3: a species' own death lengths - dphys.js DURS - the Hound's otherwise)
  e.commit = { pid: pv.id, v: variant, x: e.x, y: e.y, until: eng.now + (durs[variant] || 4.5) + .25, ctx, body: false };
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
  const geo = eng.geo, V = /^[ABCD]$/.test(variant) ? variant : 'A', hound = e.kind === 'hound';   // (Trial 3 R15: the Skin-Stealer's D too)
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
    if (running && !cap.triggered) { cap.triggered = eng.now + rand(e, .35, 1.1) * (1.2 - e.tr.AGGRESSION * .5); }
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
      if (choice === 'release') { cap.holdFor = rand(e, 2.5, 6); releaseVictim(eng, cap, pv, e, 'interrupted'); spc.onRelease && spc.onRelease(eng, e, cap, pv); return; }
    }
  }
  /* the next major decision */
  if (cap.t >= cap.decideAt) {
    const c = spc.decide(eng, e, cap, pv);
    e.dbg.capture = Object.assign(e.dbg.capture || {}, { decision: c });
    if (c === 'kill') { killNow(eng, cap, pv, e, 'decided'); return; }
    if (c === 'release') { cap.holdFor = rand(e, 3, 9); releaseVictim(eng, cap, pv, e, 'false hope'); spc.onRelease && spc.onRelease(eng, e, cap, pv); return; }
    cap.decideAt = cap.t + rand(e, 4, 11) * (.7 + .5 * e.tr.PATIENCE);
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
  init(eng, e) { e.roam = { goal: null, until: 0, nextListen: rand(e, 4, 11) }; e.lunge = null; e.recover = 0; e.search = null; e.feed = null; e.chaseBlind = 0; e.growlAt = 0; e.rest = 0; },
};
const hSpeed = (e, k, eng) => (e.sp.speeds[k] || 100) * (k === 'chase' ? 1 + (e.tr.AGGRESSION - .82) * .18 + (eng.pressure || 0) * .04 : 1);

/* 2E: evidence interpretation, not new senses. See dev/HOUND_CANON_LOCK_STAGE_2E.md.
 * Human identification / temporary gaze intimidation: canon. Light investigation, heading prediction,
 * strong hearing and finite branch searches: gameplay inferences. No new random draws or shared knowledge. */
const hDwell = e => 1.8 + e.tr.PERSISTENCE; // Hound continuity, independent of Smiler tuning
function hMaySwitch(e, r, now) {
  const cur = e.mem.p.get(e.target);
  return !cur || r.id === cur.id || cur.conf < .2 || now - (e.tgtSince ?? -99) >= hDwell(e);
}
function hObserve(eng, e) {
  for (const r of e.mem.p.values()) if (r.seen) {
    // Hearing can update the fused record later. Keep the actual last visual observation separate.
    r.hv = r.visual; // one shared sampled sight boundary, never a live between-sense player
    if (r.light) r.aw = Math.max(r.aw, .72); // an identified, illuminated human warrants hostility
  }
  if (e.hEye && eng.now - e.hEye.last > 12 && !e.seenNow.size) e.hEye = null;
}
/* Human-QA amendment (Part 2 final pass): eye contact is PRE-PURSUIT intimidation.
 * It can delay the decision to commit, but once HUNTING begins the Hound does not become
 * safe just because the player turns around and stares at it.  The finite budget is kept:
 * even before commitment, eye contact buys time rather than permanent ownership. */
function hPreGaze(eng, e, r, dt) {
  const p = r && r.seen ? r.hv : null;
  if (!p || e.state === S.HUNTING) { if (e.act === 'stare' && e.state === S.STALKING) setAct(e, ''); return false; }
  const E = e.hEye || (e.hEye = { used: 0, last: eng.now }); E.last = eng.now;
  const budget = 1.15 + e.tr.CAUTION * .9;
  if (E.used < budget && facedBy(eng, e, p, r)) {
    E.used = Math.min(budget, E.used + Math.max(0, dt));
    if (e.state === S.STALKING) setAct(e, 'stare');
    faceToward(e, r.lkx, r.lky, Math.max(0, dt), 3);
    e.head = Math.sin(e.t * 3) * .12; e.dbg.hWhy = 'eye contact delays pursuit commitment; still stalking';
    return true;
  }
  if (e.act === 'stare' && e.state === S.STALKING) setAct(e, '');
  return false;
}
function hPerceived(eng, e, r) {
  if (r.seen && r.hv) return { ...r.hv, sp: Math.hypot(r.hv.vx, r.hv.vy), seen: true };
  const est = estimate(e, r, eng.now, eng.geo);
  return { ...est, vx: r.lvx, vy: r.lvy, sp: Math.hypot(r.lvx, r.lvy), seen: false };
}
function hLightStart(eng, e, heardLead = null) {
  if (![S.ROAMING, S.DORMANT, S.CURIOUS, S.FRUSTRATED].includes(e.state) && !(heardLead && [S.HUNTING, S.SEARCHING, S.STALKING].includes(e.state))) return false;
  const L = heardLead || bestAnonLead(e, eng.now); if (!L || L.c < .25 || eng.now - L.t > 3) return false;
  const checked = e.hChecked || (e.hChecked = []);
  if (checked.some(q => eng.now < q.until && Math.hypot(q.x - L.x, q.y - L.y) < 180)) return false;
  if (e.hLight && e.state === S.CURIOUS) return true; // finish one hypothesis, do not restart its timer each observation
  e.hLight = { lead: L.id, x: L.x, y: L.y, u: L.u, k: L.k, t: eng.now, until: eng.now + 7 + e.tr.CURIOSITY * 5, arrived: 0 };
  e.inv = { lead: L.id, x: L.x, y: L.y, u: L.u, k: L.k, t: eng.now, c: L.c };
  setState(e, S.CURIOUS, 'listen'); e.dbg.hWhy = `investigate anonymous ${L.k}; carrier unidentified`;
  e.dbg.listen = L.k === 'sound' ? 'orienting to anonymous sound' : 'orienting to visible light'; return true;
}
function hLightStep(eng, e, dt) {
  const q = e.hLight, now = eng.now;
  if (now - q.t < .28 || q.arrived) {
    stopMoving(eng, e, dt); faceToward(e, q.x, q.y, dt, 5.5); e.head = Math.sin(e.t * 2) * .3;
    setAct(e, 'listen'); e.dbg.listen = q.arrived ? `${q.k} location checked; listening for a source` : `orienting to ${q.k}`;
  } else {
    setAct(e, ''); e.dbg.listen = ''; goTo(eng, e, q.x, q.y, { every: 1.2 });
    const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), {});
    if (st === 'arrived' || st === 'nopath' || dist(e.x, e.y, q.x, q.y) < 60) q.arrived = now;
  }
  if (now > q.until || (q.arrived && now - q.arrived > .8 + e.tr.PATIENCE)) {
    const L = e.mem.leads.find(l => l.id === q.lead); if (L) L.c *= .65;
    const checked = e.hChecked || (e.hChecked = []); checked.push({ x: q.x, y: q.y, until: now + 8 });
    if (checked.length > 6) checked.shift();
    e.dbg.disengage = `${q.k} hypothesis checked; no human identified`; e.dbg.hWhy = e.dbg.disengage;
    e.hLight = null; e.inv = null; e.dbg.listen = ''; setState(e, S.ROAMING); e.roam.goal = null;
  }
}
function hWhy(e) {
  if (e.state === S.HUNTING || e.state === S.SEARCHING || e.state === S.FRUSTRATED || (e.state === S.CURIOUS && e.hLight)) return e.dbg.hWhy || e.huntWhy || e.dbg.searchWhy || 'following evidence';
  return ({ ROAMING: 'patrol; no active pursuit', DORMANT: 'rest or distant LOD', CURIOUS: 'orient to a heard disturbance', ALERT: 'evaluate a fresh sound', STALKING: 'approach a perceived trail cautiously', CAUTIOUS: 'assess the visible group', FEEDING: 'feed or guard the kill site', EXCITED: 'react to the confirmed kill', RETREATING: 'withdraw from the perceived threat', PLAYING: 'active physical capture' })[e.state] || e.state;
}
function hDebug(eng, e) {
  const r = e.mem.p.get(e.target), v = r && r.hv, s = e.state === S.SEARCHING ? e.search : null, q = e.state === S.CURIOUS ? e.hLight : null;
  return { why: hWhy(e), transition: e.dbg.hTransition || null,
    listen: ['listen', 'sniff', 'freeze', 'stare'].includes(e.act) ? (e.act === 'stare' && e.state === S.STALKING ? 'eye-contact hesitation before pursuit' : e.dbg.listen || 'routine environmental listening') : '',
    dwell: +Math.max(0, hDwell(e) - (eng.now - (e.tgtSince ?? -99))).toFixed(2),
    seen: !!(r && r.seen), visual: v ? [Math.round(v.x), Math.round(v.y), +(eng.now - v.t).toFixed(2), +Math.atan2(v.vy, v.vx).toFixed(3)] : null,
    conf: r ? +r.conf.toFixed(2) : null, branch: s && s.goal ? s.goal.k : '', rejected: s ? s.visited.length : 0,
    prediction: e.state === S.HUNTING ? e.dbg.pursuit || null : null, investigation: q ? [Math.round(q.x), Math.round(q.y), q.k, Math.round(q.u)] : null,
    gaze: e.hEye ? +e.hEye.used.toFixed(2) : 0,
    traits: { persistence: +e.tr.PERSISTENCE.toFixed(2), curiosity: +e.tr.CURIOSITY.toFixed(2), patience: +e.tr.PATIENCE.toFixed(2), caution: +e.tr.CAUTION.toFixed(2) } };
}

function houndTargetScore(e, r, now) {
  const age = memAge(e, r, now), d = Math.hypot(r.lkx - e.x, r.lky - e.y);
  let s = r.aw * .7 + r.conf * .6 - Math.min(1, age / 25) * .35 - d / 6000;
  if (r.seen) s += .55 + (r.light ? .3 : 0); if (now - r.hLoud < 1 || (r.seen && (r.st === 2 || r.st === 5))) s += .3;
  return s;
}
function pickTarget(eng, e, filter) {
  let best = null, bs = -1;
  for (const r of e.mem.p.values()) {
    if (r.conf < .04 && !r.seen) continue;
    if (tgtGone(eng, e, r)) continue;                                            // (v23) only what it saw: not the true state of an unseen player
    if (filter && !filter(r)) continue;
    const s = houndTargetScore(e, r, eng.now); if (s > bs || (s === bs && (!best || r.id < best.id))) { bs = s; best = r; }
  }
  return best;
}
/* how many of the people it can see right now stand together (within ~420 px of the same person) */
function groupSeen(eng, e) {
  const ps = []; for (const id of e.seenNow) { const pv = e.mem.p.get(id)?.visual; if (pv && pv.alive && !pv.caught) ps.push(pv); }
  let best = ps.length ? 1 : 0;
  for (const a of ps) { let n = 0; for (const b of ps) if (dist(a.x, a.y, b.x, b.y) < 420) n++; if (n > best) best = n; }
  return best;
}
function houndGrowl(eng, e, I = .7, type = 'growl') { if (eng.now - e.growlAt < 2.5) return; e.growlAt = eng.now; eng.sound({ x: e.x, y: e.y, r: 980, I, type, src: -e.id, ent: e.id }); }

/* ROAMING: wander a route of far-apart spots, stopping now and then to listen.  ------------------------------------------------ */
function hRoam(eng, e, dt) {
  const R = e.roam;
  if (e.act === 'listen') {                                               // stands still, head up, hearing sharpened
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 1.7) * .5; if (e.actT > R.listenFor) { setAct(e, ''); R.nextListen = eng.now + rand(e, 6, 15); R.goal = null; }
    return;
  }
  if (e.act === 'rest') { stopMoving(eng, e, dt); if (e.actT > e.rest) { setState(e, S.ROAMING, ''); e.rest = 0; } return; }
  if (eng.now > R.nextListen && e.speed < 140) { setAct(e, 'listen'); R.listenFor = rand(e, 1.6, 3.8); return; }
  if (!R.goal || eng.now > R.until || dist(e.x, e.y, R.goal.x, R.goal.y) < 60) {
    if (R.goal && e.rng() < .12 && e.tier !== 'near') { setState(e, S.DORMANT, 'rest'); e.rest = rand(e, 8, 20); R.goal = null; return; }
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
  e.hLight = null; e.dbg.hWhy = why === 'lost' ? 'lost visual contact; predict from observed heading and openings' : 'investigate heard evidence';
  setState(e, S.SEARCHING, why === 'lost' ? '' : 'freeze');                    // straight on after the prey: no stop to "think" when it has only just vanished
  const B = searchBudget(e, r, eng.now);
  e.search = { rid: r ? r.id : 0, started: eng.now, goal: null, phase: 'lkp', legs: 0, visited: [], why, until: eng.now + B.dur, maxLegs: B.legs, pause: 0, first: why !== 'lost', exitsTried: [], routeStage: 0, lookAng: null };
  e.dbg.searchWhy = why; e.dbg.disengage = '';
  if (r) {
    const est = estimate(e, r, eng.now, eng.geo), sp = Math.hypot(r.lvx, r.lvy), hd = sp > 20 ? Math.atan2(r.lvy, r.lvx) : e.ang;
    e.search.goal = { x: est.x, y: est.y, k: 'lkp' }; e.search.est = est; e.search.hd = hd; e.search.sp = sp;
    e.search.lkp = { x: r.lkx, y: r.lky }; e.search.lookAng = hd;
  }
}
/* the places worth looking, scored.  anchor = where the prey most likely is now (memory), heading = which way it was going.
 * Human-QA AI-01: on the first couple of post-loss hypotheses, observed motion has real inertia.  The Hound checks routes that plausibly
 * continue the last visible heading before it entertains a reversal.  This is a prediction only: left/right branches can still be guessed
 * wrong, failed hypotheses lose confidence, and no hidden player position/velocity is consulted. */
function pickSearchGoal(eng, e, s) {
  const r = e.mem.p.get(s.rid), now = eng.now, geo = eng.geo;
  const baseEst = r ? estimate(e, r, now, geo) : { x: e.x, y: e.y, unc: 500 };
  const hd = s.hd ?? (r ? Math.atan2(r.lvy, r.lvx) : e.ang), moving = (s.sp || 0) > 30;
  const prog = clamp((now - s.started) / Math.max(4, s.until - s.started), 0, 1);
  const earlyRoute = moving && s.why === 'lost' && (s.routeStage || 0) < 2 && prog < .5;
  // Early after a visual loss, reason from the actual last-seen spot. estimate() is useful later as uncertainty grows, but using a projected
  // point as the opening anchor can skip the very corner/doorway where the prey disappeared.
  const base = earlyRoute && s.lkp ? s.lkp : baseEst;
  const wH = moving ? lerp(360, 70, prog) * (.6 + .75 * e.tr.INTELLIGENCE) : 0;
  let best = null, bs = -1e9;
  const consider = (x, y, sc, k, extra) => {
    const c = geo.cellAt(x, y); if (c < 0 || geo.cls[c] !== 1) { const q = geo.snap(x, y, e.caps, 2); if (q < 0) return; x = geo.cx(q); y = geo.cy(q); }
    for (const v of s.visited) if (Math.hypot(v.x - x, v.y - y) < 230) return; // a failed hypothesis is not an endlessly reusable route
    sc -= Math.hypot(x - e.x, y - e.y) * .1 + e.streams.search() * (40 + 90 * (1 - e.tr.INTELLIGENCE));
    sc = habitBias(e, s.rid, x, y, sc);
    if (sc > bs) { bs = sc; best = Object.assign({ x, y, k }, extra || {}); }
  };
  // 1) the ways out from where it should be: openings in 12 directions.  While the visual trail is fresh, don't immediately reverse away
  // from the direction the Hound actually saw the prey travelling unless geometry leaves no forward/side opening at all.
  let continuationCount = 0;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, align = Math.cos(angDiff(a, hd));
    if (earlyRoute && align < -.2) continue;                                 // first hypotheses stay in the forward/side hemisphere
    const L = geo.ray(base.x, base.y, a, 700); if (L < 230) continue;
    continuationCount++;
    const d = Math.min(L - 50, (moving && prog < .35 ? 520 : 260 + 200 * prog) + e.tr.CURIOSITY * 80);
    const momentum = earlyRoute ? 150 * Math.max(0, align) + 55 * Math.max(0, 1 - Math.abs(angDiff(a, hd)) / (Math.PI / 2)) : 0;
    consider(base.x + Math.cos(a) * d, base.y + Math.sin(a) * d, 120 + align * wH + momentum + Math.min(L, 700) * .12, 'continue', { a });
  }
  // A dead-end can legitimately force a reversal.  If the fresh-heading filter found no plausible exit, widen immediately instead of freezing.
  if (earlyRoute && continuationCount === 0) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, L = geo.ray(base.x, base.y, a, 700); if (L < 230) continue;
      const d = Math.min(L - 50, 300 + e.tr.CURIOSITY * 80), align = Math.cos(angDiff(a, hd));
      consider(base.x + Math.cos(a) * d, base.y + Math.sin(a) * d, 90 + align * wH * .45 + Math.min(L, 700) * .1, 'continue', { a, forced: 1 });
    }
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
  const giveUp = why => { s.exhausted = true; e.dbg.disengage = why; e.dbg.hWhy = why; e.mood.frustration = Math.min(1, e.mood.frustration + .25); setState(e, S.FRUSTRATED, 'pace'); e.frus = { until: now + rand(e, 2, 4.5) }; };
  e.dbg.search = { ph: s.phase, legs: s.legs + '/' + s.maxLegs, t: +(now - s.started).toFixed(1), left: +(s.until - now).toFixed(1), g: s.goal ? [Math.round(s.goal.x), Math.round(s.goal.y), s.goal.k] : null, unc: r ? Math.round(estimate(e, r, now).unc) : 0, cz: r && r.crawl || '' };
  if (e.act === 'freeze') {                                                // a beat to listen on arrival / first snap decision
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.1) * .55;
    e.dbg.listen = 'uncertain trail; orient before checking it';
    if (e.actT > (s.first ? .25 + e.tr.PATIENCE * .35 : .7 + e.tr.PATIENCE)) { s.first = false; setAct(e, 'sniff'); s.pause = 0; }
    return;
  }
  if (s.phase === 'watch') {                                               // waiting at a crawl exit, listening
    stopMoving(eng, e, dt); setAct(e, 'listen'); e.head = Math.sin(e.t * 1.4) * .5; s.pause += dt;
    if (s.pause > s.watchFor) { s.phase = 'go'; s.goal = null; setAct(e, ''); }
    return;
  }
  if (e.act === 'sniff' && s.phase === 'pause') {
    stopMoving(eng, e, dt); s.pause += dt;
    const warm = r ? clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / 8, 0, 1) : 0;
    // Human-QA AI-02: the Hound should visibly form its hypothesis the instant it arrives, not stand blankly and only look after the pause.
    // This is still only remembered evidence: observed heading for a fresh moving trail, otherwise the best legitimate search direction we already own.
    s.lookAng = (s.sp || 0) > 30 && (s.routeStage || 0) < 2 ? s.hd : (s.goal?.a ?? s.lookAng ?? null);
    e.head = s.lookAng !== null ? clamp(angDiff(s.lookAng, e.ang), -1.05, 1.05) * .35 + Math.sin(e.t * 3.2) * .12 : Math.sin(e.t * 3.2) * .38;
    e.dbg.listen = s.lookAng !== null ? 'last-seen spot empty; immediately checking the prey\'s observed direction' : 'predicted location empty; brief listen before trying another opening';
    // A reassessment is a readable animal beat, not a multi-second stall. Fresh/aggressive trails are especially quick; even a patient Hound moves on promptly.
    const reassess = clamp(lerp(.28, .62, e.tr.PATIENCE) * (1.05 - .25 * e.tr.AGGRESSION) * (1 - .35 * warm), .22, .70);
    if (s.pause > reassess) {
      s.phase = 'go'; s.goal = pickSearchGoal(eng, e, s); s.legs++; if (s.goal?.k === 'continue') s.routeStage = (s.routeStage || 0) + 1;
      s.lookAng = s.goal?.a ?? null; setAct(e, ''); e.mood.frustration = Math.min(1, e.mood.frustration + .05);
    }
    return;
  }
  // giving up is a decision with a reason: the evidence has run out, the plausible places are done, or it has simply spent its patience
  const conf = r ? r.conf : 0;
  if (!r) { giveUp('no target'); return; }
  if (conf < .12 && s.legs >= 2) { giveUp('memory faded'); return; }
  if (s.legs > s.maxLegs) { giveUp('searched the likely places'); return; }
  if (now > s.until) { giveUp('search budget exhausted without new evidence'); return; }
  if (!s.goal) { s.goal = pickSearchGoal(eng, e, s); if (!s.goal) { giveUp('nowhere left to look'); return; } }
  goTo(eng, e, s.goal.x, s.goal.y, { every: 1.5 });
  e.dbg.hWhy = `check ${s.goal.k || 'heard position'} from remembered evidence; heading ${s.hd?.toFixed(2) ?? 'unknown'}`;
  const fresh = clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / (5 + 5 * e.tr.AGGRESSION), 0, 1);     // while the trail is warm it moves like it is still chasing, through the likely routes
  const v = lerp(hSpeed(e, s.why === 'sound' ? 'investigate' : 'search', eng) * (.9 + .3 * e.tr.AGGRESSION), hSpeed(e, 'chase', eng) * .9, s.phase === 'lkp' || s.goal.k === 'continue' || s.goal.k === 'sound' ? fresh : fresh * .5);
  const st = follow(eng, e, dt, v, {});
  e.head = Math.sin(e.t * 1.6) * .35;
  if (st === 'arrived' || st === 'nopath' || dist(e.x, e.y, s.goal.x, s.goal.y) < 50) {
    const c = eng.geo.cellAt(e.x, e.y); if (c >= 0) e.mem.visited.set(c, now); s.visited.push({ x: s.goal.x, y: s.goal.y });
    if (!r.seen && now - Math.max(r.seenAt, r.heardAt) > 1) r.conf = Math.max(0, r.conf - .12);
    if (s.goal.key) s.exitsTried.push(s.goal.key); if (s.goal.k === 'enter') s.exitsTried.push('in');
    const atExit = s.goal.k === 'exit';
    s.phase = atExit && e.rng() < .35 + e.tr.PATIENCE ? 'watch' : 'pause'; s.watchFor = rand(e, 2.5, 7) * (.5 + e.tr.PATIENCE); s.pause = 0; s.goal = null; s.lookAng = (s.sp || 0) > 30 ? s.hd : null;
    setAct(e, s.phase === 'watch' ? 'listen' : 'sniff');
  }
}

/* STALKING / HUNTING with the committed lunge. ------------------------------------------------------------------------------- */
function beginHunt(eng, e, r, why) {
  e.hLight = null; e.dbg.listen = ''; e.dbg.hWhy = why;
  if (e.state !== S.HUNTING) { houndGrowl(eng, e, .75); e.mood.arousal = Math.min(1, e.mood.arousal + .5); }
  setState(e, S.HUNTING, ''); setTarget(e, r.id, eng.now); e.chaseBlind = 0; e.huntWhy = why; e.huntStart = eng.now;
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
  if (e.lungeBias === undefined) e.lungeBias = (e.rng() - .5) * (1.15 - e.tr.INTELLIGENCE) * 96;
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
    const tr = e.mem.p.get(L.tid), t = tr && tr.seen ? tr.hv : null; // sampled visual evidence, never live hidden coordinates between senses
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
  if (k >= 1) { e.lunge = null; e.recover = rand(e, .85, 1.3); setAct(e, 'recover'); e.mood.frustration = Math.min(1, e.mood.frustration + .18); e.cool.lunge = rand(e, 1.2, 2.4); e.dbg.lunge = 'missed'; e.lungesMissed = (e.lungesMissed || 0) + 1; }
  return false;
}

function hHunt(eng, e, dt, thinkNow) {
  const now = eng.now, r = e.mem.p.get(e.target), pvT = r && r.seen ? r.hv : null;
  if (e.recover > 0) {                                                    // after a lunge: overshoot, skid, turn around slowly
    e.recover -= dt; e.speed = approach(e.speed, 40, 620 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt);
    if (r && e.recover < .55) faceToward(e, r.lkx, r.lky, dt, 1.4);
    if (e.recover <= 0) { e.stun = false; setAct(e, ''); }
    return;
  }
  if (e.lunge) { const res = stepLunge(eng, e, dt); if (res && res.pv) return res; return; }
  if (!r || tgtGone(eng, e, r)) { const alt = pickTarget(eng, e); if (alt) { setTarget(e, alt.id, now); return; } e.dbg.disengage = r ? 'saw its prey go down' : 'lost its prey'; setState(e, S.ROAMING); return; }
  const seen = r.seen && !!pvT;
  // Once pursuit is committed, gaze never suppresses the chase.  Clear a stale pre-pursuit pose if needed.
  if (e.act === 'stare') setAct(e, '');
  if (seen) {
    e.dbg.hWhy = r.light ? 'pursue identified human exposed by visible light' : 'pursue visually identified human';
    e.chaseBlind = 0; e.lostSince = 0;
    const tgt = { x: pvT.x, y: pvT.y, vx: pvT.vx, vy: pvT.vy, id: pvT.id };
    if (lungeCheck(eng, e, r, tgt) && e.rng() < 1 - Math.pow(.04, dt * (1 + e.tr.AGGRESSION))) { startLunge(eng, e, tgt); return; }
    // predicted interception point, but never through walls: plan to it, aim straight when the way is clear
    // Advance only the sampled visible velocity between perception updates. This keeps the
    // prediction continuous without reaching into the live player when an old seen flag persists.
    const chaseD = dist(e.x, e.y, tgt.x, tgt.y);
    // Close-range orbit fix: don't lead past somebody who is already beside the Hound.  At this range the job is to reorient physically,
    // not draw a wide interception arc that a walking player can orbit forever.
    const lead = chaseD < 190 ? 0 : clamp(chaseD / 420, 0, .55) * (.5 + e.tr.INTELLIGENCE) + Math.min(.12, Math.max(0, now - pvT.t));
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
    e.dbg.hWhy = byEar ? 'fresh running sound; follow heard position and heard heading' : 'visual contact lost; predict from last observation';
    if (e.chaseBlind > lerp(1.4, 4.6, e.tr.PERSISTENCE)) { beginSearch(eng, e, r, 'lost'); e.mood.frustration = Math.min(1, e.mood.frustration + .15); return; }
  }
  let chaseV = hSpeed(e, 'chase', eng), turnMul = 1;
  if (seen) {
    const d = dist(e.x, e.y, pvT.x, pvT.y), err = Math.abs(angDiff(Math.atan2(pvT.y - e.y, pvT.x - e.x), e.ang));
    if (d < 190) {
      // Preserve the Hound's broad, physical turns in normal pursuit.  Only at close range does it plant/pivot harder so walking circles
      // around its shoulder is not an infinite safe strategy.  Large facing errors also bleed speed, giving the body room to turn.
      const q = clamp((190 - d) / 120, 0, 1);
      // First bleed chase speed, then gain the extra pivot authority. This keeps the species' poor high-speed turning intact: it cannot
      // become a turret while still charging at 230+ px/s merely because prey crossed close to its shoulder.
      if (err > .72) chaseV = Math.min(chaseV, lerp(175, 92, q));
      turnMul = e.speed < 190 ? 1 + 2.15 * q : 1;
      e.dbg.closePivot = { d: Math.round(d), err: +err.toFixed(2), mul: +turnMul.toFixed(2) };
    } else e.dbg.closePivot = null;
  } else e.dbg.closePivot = null;
  const st = follow(eng, e, dt, chaseV, { arrive: 10, noSlow: false, turnMul });
  e.head = 0;
  // touching the prey without a lunge still counts (a swipe as it runs past)
  for (const pv of eng.nearPlayers(e.x, e.y, 50)) if (pv.alive && !pv.caught && dist(e.x, e.y, pv.x, pv.y) < e.r + 12) return { pv, dir: e.ang, speed: e.speed };
}

const stalkPatience = e => lerp(4, 15, e.tr.PATIENCE) * (1.15 - e.tr.AGGRESSION * .3);
/* STALKING: it shadows the prey - it matches a walker's pace so the prey never simply walks away from it, holds back at a distance
 * while the prey stands still, and creeps a little closer the longer it watches, until it commits (or the prey gives it a reason to). */
function hStalk(eng, e, dt, thinkNow) {
  const r = e.mem.p.get(e.target);
  if (!r || tgtGone(eng, e, r)) { beginSearch(eng, e, r, 'lost'); return; }
  const P = hPerceived(eng, e, r), seen = P.seen, est = P, d = dist(e.x, e.y, est.x, est.y);
  e.stalkFor = (e.stalkFor || 0) + dt;
  const gazed = seen && hPreGaze(eng, e, r, dt);                         // only before pursuit; finite and still physically advancing
  goTo(eng, e, est.x, est.y, { every: .6 });
  const baseHold = lerp(380, 205, clamp(e.stalkFor / stalkPatience(e), 0, 1));
  const hold = gazed ? Math.min(baseHold, 215) : baseHold;               // watched Hound creeps in instead of freezing in place
  const tv = P.sp;                    // how fast it can see the prey going
  let vmax = d > hold ? clamp(tv * 1.12 + (d - hold) * .7, hSpeed(e, 'stalk', eng) * .7, hSpeed(e, 'chase', eng) * .74) : clamp(tv * .7 - (hold - d) * .6, 0, 70);
  if (gazed) vmax = Math.min(vmax, 72);                                  // hesitation changes commitment, not aggression/awareness
  follow(eng, e, dt, vmax, { arrive: 30, turnMul: gazed ? 1.2 : 1 });
  e.head = Math.sin(e.t * 2.4) * .12;
  if (thinkNow) {
    const runner = r.st === 2 || r.st === 5 || r.ex;
    // Running, getting point-blank, or simply exhausting the finite intimidation window commits the chase.  After beginHunt(), gaze is ignored.
    if (seen && (runner || d < 135 || (!gazed && (d < 230 || e.stalkFor > stalkPatience(e))))) { beginHunt(eng, e, r, runner ? 'stalk-run-commit' : d < 135 ? 'stalk-close-commit' : 'stalk-commit'); return; }
    if (!seen && eng.now - Math.max(r.seenAt, r.heardAt) > 3.4) { beginSearch(eng, e, r, 'lost'); }
  }
}

/* what a hound makes of a fresh sound, and of being seen ------------------------------------------------------------------------ */
function hReact(eng, e) {
  const now = eng.now;
  hObserve(eng, e);
  // seen prey
  let seen = null, sd = 1e9, score = -Infinity;
  const current = e.mem.p.get(e.target);
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id), pv = r?.visual; if (!pv || !pv.alive || pv.caught) continue;
    if (!hMaySwitch(e, r, now)) continue;
    const value = houndTargetScore(e, r, now) + (id === e.target ? .65 : 0);
    if (value > score) { score = value; seen = r; sd = Math.hypot(r.lkx - e.x, r.lky - e.y); }
  }
  // Seeing both prey is no reason to flicker between them. Finish the current pursuit.
  if (current && current.seen && !tgtGone(eng, e, current)) { seen = current; sd = Math.hypot(current.lkx - e.x, current.lky - e.y); }
  if (seen && seen.aw > .45) {
    const runner = seen.st === 2 || seen.st === 5 || seen.ex, near = sd < 480, hungry = e.tr.HUNGER > .55;
    const gazed = e.state !== S.HUNTING && !runner && hPreGaze(eng, e, seen, 0);  // fresh eye contact can delay the initial commitment only
    const grp = groupSeen(eng, e), fresh = grp > (e.grpN || 0); e.grpN = grp;                       // somebody else has just come into view: it takes stock of the group once
    if (fresh && grp >= 2 && !runner && !seen.light && e.state !== S.HUNTING && e.state !== S.CAUTIOUS && e.rng() < (.16 + e.tr.CAUTION * 1.5) * (e.pack ? .45 : 1) * (sd < 300 ? .35 : 1)) { beginCautious(eng, e, seen); return; }
    if (e.state !== S.HUNTING && e.state !== S.STALKING && e.state !== S.CAUTIOUS) {
      if (!gazed && (seen.light || runner || near || (hungry && e.tr.AGGRESSION > .7 && seen.aw > .8 && sd < 700))) { beginHunt(eng, e, seen, seen.light ? 'identified human with visible light' : runner ? 'saw-run' : 'saw-near'); return; }
      setState(e, S.STALKING, gazed ? 'stare' : ''); setTarget(e, seen.id, now); e.stalkFor = 0; e.mood.excitement = Math.min(1, e.mood.excitement + .3); return;
    }
    if (e.state === S.STALKING && (seen.light || runner || near) && (runner || !gazed || sd < 135)) { beginHunt(eng, e, seen, runner ? 'stalk-run-commit' : 'stalk-spot'); return; }
    if (e.state === S.HUNTING && e.target !== seen.id) { const cur = e.mem.p.get(e.target); if ((!cur || !cur.seen) && hMaySwitch(e, seen, now)) { setTarget(e, seen.id, now); e.dbg.retarget = 'current prey lost; another human directly identified'; } }
    return;
  }
  if (!e.seenNow.size) e.grpN = 0;
  // heard something new
  const h = e.hear;
  if (h && h.t > (e.lastHearT || -1)) {
    e.lastHearT = h.t;
    const isEnt = h.src < 0;
    if (isEnt && h.type === 'growl' && e.state !== S.HUNTING && e.state !== S.FEEDING && e.state !== S.PLAYING) {           // existing audible growl response only: no target/memory transfer
      if (e.rng() < .55 + e.tr.SOCIAL * .4) { beginSearch(eng, e, null, 'sound'); e.search.goal = { x: h.x, y: h.y, k: 'sound' }; e.search.first = false; setAct(e, ''); }
      return;
    }
    if (isEnt) return;
    if (h.attribution === 'anonymous') {
      const L = bestAnonLead(e, now, 'sound'), cur = e.mem.p.get(e.target);
      const weak = h.I <= .12, recentSight = cur && (cur.seen || now - cur.seenAt < 1.2);
      if (!weak && !recentSight && L) hLightStart(eng, e, L);
      e.dbg.retarget = recentSight ? 'keep visual prey; unrelated anonymous sound' : 'heard anonymous sound; no person identified';
      return;
    }
    const r = e.mem.p.get(h.src); if (!r) return;
    const loud = h.I > .5 || h.type === 'run' || h.type === 'slide' || h.type === 'vault';
    if (e.state === S.ROAMING || e.state === S.DORMANT || e.state === S.CURIOUS) {
      e.hLight = null;
      e.wake = 1; if (e.state === S.DORMANT) setState(e, S.ROAMING, ''); else setAct(e, '');
      if (loud && e.rng() < .55 + e.tr.AGGRESSION * .35) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(e, .35, .85) * (1.2 - e.tr.AGGRESSION * .5), rid: h.src, toward: { x: h.x, y: h.y } }; }
      else if (h.I > .12) { setState(e, S.CURIOUS, 'freeze'); e.cur = { until: now + rand(e, .6, 1.5), toward: { x: h.x, y: h.y }, n: 0, rid: h.src }; }
    } else if ((e.state === S.SEARCHING || e.state === S.FRUSTRATED) && loud && r.conf > .2 && dist(e.x, e.y, h.x, h.y) < 1000 && (!e.search || !e.search.rid || e.search.rid === r.id || !e.mem.p.get(e.search.rid)?.conf)) {
      beginHunt(eng, e, r, 'heard-run'); e.dbg.reacquired = (e.dbg.reacquired || 0) + 1;                       // it heard the prey running: no new detection needed
    } else if (e.state === S.SEARCHING || e.state === S.FRUSTRATED) {
      if (h.I > .1) { const s = e.search; if (e.state === S.FRUSTRATED) beginSearch(eng, e, r, 'sound'); else { e.search.why = 'sound'; } e.search.goal = { x: h.x, y: h.y }; e.search.phase = 'go'; e.search.until = Math.max(e.search.until, now + 10); setAct(e, ''); if (loud && r.st === 2) beginHunt(eng, e, r, 'heard-run'); }
    } else if (e.state === S.STALKING && h.type === 'run' && (!current?.seen || r.id === e.target) && hMaySwitch(e, r, now)) { beginHunt(eng, e, r, 'stalk-heard-run'); }
    else if (e.state === S.HUNTING && !e.mem.p.get(e.target)?.seen) { if (r.id !== e.target && r.conf > .35 && loud && hMaySwitch(e, r, now) && (!current || now - current.hLoud > 1.2)) { setTarget(e, r.id, now); e.dbg.retarget = 'prey lost and its trail quiet; fresh loud sound elsewhere'; } }
  }
  if (!e.cap && !e.commit) hLightStart(eng, e);
}

/* the main per-tick behaviour */
function houndTick(eng, e, dt, thinkNow) {
  const now = eng.now, before = e.state;
  e.cool.lunge = Math.max(0, (e.cool.lunge || 0) - dt);
  if (e.commit && commitTick(eng, e, dt)) return null;               // committed to a kill: nothing else happens until it is over
  if (thinkNow) hReact(eng, e);
  let res = null;
  switch (e.state) {
    case S.ROAMING: case S.DORMANT: hRoam(eng, e, dt); break;
    case S.CURIOUS: {
      if (e.hLight) { hLightStep(eng, e, dt); break; }
      stopMoving(eng, e, dt); const c = e.cur; if (!c) { setState(e, S.ROAMING); break; }
      faceToward(e, c.toward.x, c.toward.y, dt, 3.5); e.head = Math.sin(e.t * 5) * .15;
      if (e.hear && e.hear.t > c.until - 1.5 && e.hear.t > (c.seenT || 0) && e.hear.src >= 0) { c.seenT = e.hear.t; c.n++; if (c.n >= 1 && e.hear.I > .2) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(e, .3, .7), rid: e.hear.src, toward: { x: e.hear.x, y: e.hear.y } }; break; } }
      if (now > c.until) { const r = e.mem.p.get(c.rid); if (r && e.rng() < .45 + e.tr.CURIOSITY * .5) beginSearch(eng, e, r, 'sound'); else { setState(e, S.ROAMING); e.roam.goal = null; } }
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
        if (lastRun && e.rng() < .35 + e.tr.AGGRESSION * .55) { beginHunt(eng, e, r, 'alert-run'); break; }
        if (e.rng() < .35 + e.tr.PATIENCE * .3 && !noisy) { setState(e, S.STALKING, ''); setTarget(e, r.id, now); e.stalkFor = 0; break; }
        beginSearch(eng, e, r, 'sound'); e.search.goal = { x: a.toward.x, y: a.toward.y }; e.search.first = false; setAct(e, '');
      }
      break;
    }
    case S.STALKING: hStalk(eng, e, dt, thinkNow); break;
    case S.HUNTING: res = hHunt(eng, e, dt, thinkNow); break;
    case S.SEARCHING: hSearch(eng, e, dt, thinkNow); break;
    case S.FRUSTRATED: {                                                  // snarls and paces, then sweeps a wider area or gives up
      const f = e.frus || { until: now }; e.speed = approach(e.speed, 0, 1200 * dt);
      e.ang += Math.sin(e.t * 3.1) * dt * 2.2; e.head = Math.sin(e.t * 6) * .45; if (e.rng() < dt * .35) houndGrowl(eng, e, .5, 'snarl');
      if (now > f.until) { const r = e.mem.p.get(e.search && e.search.rid); if (r && !e.search.exhausted && r.conf > .1 && e.rng() < e.tr.PERSISTENCE * .55) { beginSearch(eng, e, r, 'lost'); e.search.until += 8; } else { setState(e, S.ROAMING); setTarget(e, 0, now); e.roam.goal = null; } }
      break;
    }
    case S.FEEDING: res = hFeed(eng, e, dt, thinkNow); break;
    case S.CAUTIOUS: hCautious(eng, e, dt, thinkNow); break;
    case S.EXCITED: hExcited(eng, e, dt, thinkNow); break;
    case S.RETREATING: hRetreat(eng, e, dt); break;
    case S.PLAYING: hPlay(eng, e, dt); break;
    default: setState(e, S.ROAMING);
  }
  if (e.hLight && e.state !== S.CURIOUS) { e.hLight = null; e.inv = null; }
  if (before !== e.state) e.dbg.hTransition = { from: before, to: e.state, at: +now.toFixed(2), why: hWhy(e) };
  return res;
}

/* FEEDING and guarding a body ------------------------------------------------------------------------------------------------- */
function beginFeed(eng, e, site) { setState(e, S.FEEDING, ''); e.feed = { site, until: eng.now + rand(e, 22, 48), at: false, guard: null }; }
function hFeed(eng, e, dt, thinkNow) {
  const F = e.feed; if (!F || eng.now > F.until) { if (F && F.site) F.site.fed++; setState(e, S.ROAMING); e.roam.goal = null; e.feed = null; return; }
  const s = F.site;
  if (F.guard) {                                                          // someone came for the body: hunt them, but stay near it
    const r = e.mem.p.get(F.guard);
    if (!r || (!r.seen && eng.now - r.seenAt > 3) || dist(e.x, e.y, s.x, s.y) > 520 + e.tr.TERRITORIALITY * 500) { F.guard = null; setAct(e, ''); return; }
    if (!tgtGone(eng, e, r)) { const P = hPerceived(eng, e, r); goTo(eng, e, P.x, P.y, { every: .4 }); /* (v23) where it believes the intruder is */ follow(eng, e, dt, hSpeed(e, 'chase', eng) * .9, { arrive: 10 }); for (const p of eng.nearPlayers(e.x, e.y, 50)) if (p.alive && !p.caught && dist(e.x, e.y, p.x, p.y) < e.r + 12) return { pv: p, dir: e.ang, speed: e.speed }; }
    else F.guard = null;
    return;
  }
  if (!F.at) { goTo(eng, e, s.x, s.y, { every: 1.4 }); const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), { arrive: 34 }); if (dist(e.x, e.y, s.x, s.y) < 60 || st === 'arrived') { F.at = true; setAct(e, 'feed'); } return; }
  if (e.act !== 'feed') setAct(e, 'feed');
  stopMoving(eng, e, dt); faceToward(e, s.x, s.y, dt, 2); e.head = Math.sin(e.t * 7) * .18;
  if (thinkNow) for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = r?.visual; if (pv && pv.alive && !pv.caught && r.dist < 620 && r.aw > .5) { F.guard = id; setTarget(e, id, eng.now); houndGrowl(eng, e, .8, 'guard'); setAct(e, 'guard'); break; } }
  if (thinkNow && !F.guard && e.hear && e.hear.I > .5 && e.hear.src > 0 && eng.now - e.hear.t < .3 && dist(e.hear.x, e.hear.y, s.x, s.y) < 900) { const r = e.mem.p.get(e.hear.src); if (r) { F.guard = r.id; e.target = r.id; setAct(e, 'guard'); } }
}
/* EXCITED: right after a kill, when nobody else is close: worked up, pacing around the body, snarling - then it settles down to feed */
function beginExcited(eng, e, site) { setState(e, S.EXCITED, 'pace'); e.exc = { site, until: eng.now + rand(e, 1.6, 3.6), dir: e.rng() < .5 ? 1 : -1, r: rand(e, 62, 96) }; }
function hExcited(eng, e, dt, thinkNow) {
  const X = e.exc; if (!X || eng.now > X.until) { setState(e, S.ROAMING); if (X && X.site && e.tr.HUNGER > .3) beginFeed(eng, e, X.site); else e.roam.goal = null; return; }
  const a = Math.atan2(e.y - X.site.y, e.x - X.site.x) + X.dir * dt * 1.15, tx = X.site.x + Math.cos(a) * X.r, ty = X.site.y + Math.sin(a) * X.r;
  if (eng.geo.clear(tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, 100, dt, { turnMul: 1.7, noSlow: true }); else stopMoving(eng, e, dt);
  e.head = Math.sin(e.t * 6.5) * .5; if (e.rng() < dt * .45) houndGrowl(eng, e, .55, 'snarl');
}

/* CAUTIOUS: several people together are more than a hound wants to take on.  It holds off at a distance, watching and circling, and
 * waits for one of them to be alone, to run, or to fall behind - or gives up and drifts away. */
function beginCautious(eng, e, r) { setState(e, S.CAUTIOUS, 'stare'); e.caut = { until: eng.now + rand(e, 5, 11), rid: r.id, dir: e.rng() < .5 ? 1 : -1, last: { x: r.lkx, y: r.lky }, lostT: 0 }; e.target = r.id; }
function hCautious(eng, e, dt, thinkNow) {
  const C = e.caut;
  if (!C || eng.now > C.until) {                                                                                                // it has watched long enough: commit, or withdraw
    e.caut = null; const r = C && e.mem.p.get(C.rid);
    if (r && r.conf > .3 && e.rng() < clamp(e.tr.AGGRESSION * .6 + e.tr.HUNGER * .3 - e.tr.CAUTION * .5, .2, .85)) { beginHunt(eng, e, r, 'caut-timeout'); return; }
    if (C) { beginRetreat(eng, e, C.last, rand(e, 8, 14)); return; }
    setState(e, S.ROAMING); e.roam.goal = null; return;
  }
  const seen = []; for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r.seen && r.hv) seen.push(r.hv); }
  if (seen.length) {
    let cx = 0, cy = 0; for (const p of seen) { cx += p.x; cy += p.y; } C.last = { x: cx / seen.length, y: cy / seen.length }; C.lostT = 0;
    if (thinkNow) {
      const runner = seen.find(p => p.st === 2 || p.st === 5 || p.ex), alone = seen.length === 1 || seen.every(p => dist(p.x, p.y, seen[0].x, seen[0].y) > 460);
      if (runner && e.rng() < .25 + e.tr.AGGRESSION * .5) { const r = rec(e, runner.id); beginHunt(eng, e, r, 'caut-run'); return; }
      if (alone && dist(e.x, e.y, seen[0].x, seen[0].y) < 720) { const r = rec(e, seen[0].id); if (e.rng() < .5 + e.tr.AGGRESSION * .4) { beginHunt(eng, e, r, 'caut-alone'); return; } }
    }
  } else { C.lostT += dt; if (C.lostT > 3) { const r = e.mem.p.get(C.rid); if (r) beginSearch(eng, e, r, 'lost'); else setState(e, S.ROAMING); return; } }
  const d = dist(e.x, e.y, C.last.x, C.last.y), away = Math.atan2(e.y - C.last.y, e.x - C.last.x);
  let tx, ty, v = 0;
  if (d < 470) { tx = e.x + Math.cos(away) * 90; ty = e.y + Math.sin(away) * 90; v = 110; }                                   // too close: back off
  else if (d > 680) { tx = e.x - Math.cos(away) * 90; ty = e.y - Math.sin(away) * 90; v = 96; }                                // drifted away: close up
  else { const a = away + C.dir * .5; tx = C.last.x + Math.cos(a) * d; ty = C.last.y + Math.sin(a) * d; v = 66; }             // circle at a distance
  if (eng.geo.clear(tx, ty, 21, 'walk') && eng.geo.lineClear(e.x, e.y, tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, v, dt, { turnMul: 1.4, noSlow: true }); else { stopMoving(eng, e, dt); if (e.rng() < dt * .6) C.dir = -C.dir; }
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
    const act = pickW(e.rng, [{ k: 'circle', w: 1.2 }, { k: 'stare', w: 1 + e.tr.SADISM }, { k: 'drag', w: cap.phase === 'crawl' ? .5 : 0 }, { k: 'back', w: .7 }]);
    cap.plan = { act, until: eng.now + rand(e, 1.3, 3.2), dir: e.rng() < .5 ? 1 : -1, r: rand(e, 95, 135) }; cap.plays++; setAct(e, act === 'back' ? 'back' : act === 'drag' ? 'drag' : act);
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
    const r = e.rng(), pk = .5 + e.tr.HUNGER * .3 + e.mood.frustration * .2, pr = .24 * (e.tr.SADISM + .35) * (cap.plays > 2 ? 1 : .4);
    return r < pk ? 'kill' : r < pk + pr ? 'release' : 'continue';
  },
  onInterrupt(eng, e, cap, pv, ctx, x) {
    const r = e.rng();
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
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; setState(e, S.HUNTING, ''); setTarget(e, pv.id, eng.now); e.chaseBlind = 0; e.cool.lunge = .3; e.dbg.resumed = (e.dbg.resumed || 0) + 1; houndGrowl(eng, e, .8); },
  onLetGo(eng, e, cap, pv) { setState(e, S.RETREATING, ''); beginRetreat(eng, e, { x: pv.x, y: pv.y }, rand(e, 8, 16)); },
  afterKill(eng, e, ctx, pv) {
    e.hEye = null; // a physically confirmed death ends this encounter's intimidation budget
    const th = ctx.threats.filter(t => t.cert >= .5), near = th.filter(t => t.approaching || t.dist < 600);
    e.mood.excitement = 1; houndGrowl(eng, e, .9, 'kill');
    const site = eng.sites[eng.sites.length - 1];
    if (near.length >= 2 && e.tr.CAUTION + (1 - e.tr.AGGRESSION) > .55) { beginRetreat(eng, e, { x: near[0].x, y: near[0].y }, rand(e, 6, 12)); return; }       // overwhelmed
    if (near.length) {                                                                                      // attack the next one, or defend the kill
      const t = near.slice().sort((a, b) => a.dist - b.dist)[0], r = rec(e, t.id); r.aw = 1; r.lkx = t.x; r.lky = t.y; r.conf = 1; r.seenAt = eng.now;
      if (e.tr.AGGRESSION > .55) { beginHunt(eng, e, r, 'next-victim'); return; }
      beginFeed(eng, e, site); e.feed.guard = t.id; setTarget(e, t.id, eng.now); setAct(e, 'guard'); return;
    }
    if (e.tr.HUNGER > .35) { if (e.rng() < .8) beginExcited(eng, e, site); else beginFeed(eng, e, site); } else { setState(e, S.STALKING, ''); const r = pickTarget(eng, e); if (r) { setTarget(e, r.id, eng.now); e.stalkFor = 0; } else setState(e, S.ROAMING); }
  },
};
/* Presentation-only look direction.  Keep it separate from e.head: e.head is part of the Hound's sensory FOV, while this value exists only so the
 * rendered skull can behave like an animal's head without changing what the AI can actually perceive.  Every source below is already legitimate
 * evidence owned by this Hound (current sampled sight, remembered location, anonymous lead, or fresh heard position). */
function hVisualLook(e) {
  let x = null, y = null;
  // During a lost-target search, the visible skull should reveal the current hypothesis: goal first, then the last observed heading while it
  // pauses/listens.  This is presentation-only and deliberately separate from e.head, which remains the sensory FOV.
  if (e.search && e.search.goal && Number.isFinite(e.search.goal.x)) { x = e.search.goal.x; y = e.search.goal.y; }
  else if (e.search && Number.isFinite(e.search.lookAng)) return clamp(angDiff(e.search.lookAng, e.ang), -1.18, 1.18);
  const r = e.target > 0 ? e.mem.p.get(e.target) : null;
  if (x === null && r) {
    if (r.seen && r.hv) { x = r.hv.x; y = r.hv.y; }
    else if (r.conf > .12 && Number.isFinite(r.lkx) && Number.isFinite(r.lky)) { x = r.lkx; y = r.lky; }
  }
  if (x === null && e.hLight && Number.isFinite(e.hLight.x)) { x = e.hLight.x; y = e.hLight.y; }
  if (x === null) return clamp(e.head || 0, -1.1, 1.1);
  return clamp(angDiff(Math.atan2(y - e.y, x - e.x), e.ang), -1.18, 1.18);
}
HOUND.tick = houndTick;
HOUND.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: HACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2), lh: +hVisualLook(e).toFixed(2), l: e.lunge ? +clamp((e.lunge.t - e.lunge.wind) / e.lunge.dur, -1, 1).toFixed(2) : -1, tg: e.target > 0 && (e.state === S.HUNTING || e.state === S.STALKING) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, k: e.pack || 0 });

/* ---------------------------------------------------------------- SMILER (Part 2, stage 2D): the canon Smiler.
 * Canon (Backrooms Wikidot, Entity 3, rev. 83 - the approved Canon Lock):
 *   "attracted to light, and will chase anything they see with a light"            -> light draws it; a light carrier it sees is chased
 *   "will only start to attack if you panic and retreat, or if a loud noise is made" -> the only ways it strikes (plus a chase that catches up)
 *   "keep eye contact, and move away slowly"                                         -> eye contact holds it; moving away slowly is the way out
 *   "turn off all sources of light" / "keep quiet" / "don't run away panicking unless the Smiler starts to chase you"
 *   "reside in dark areas", "reflective eyes and teeth gleaming in the dark", body unknown (rumoured, unconfirmed: not drawn)
 * Everything it does comes from what it perceives (2C evidence law): its records (players it has seen), heard sounds, anonymous light leads,
 * eye contact (facedBy), and the light that falls on itself (only from its own observations + the fixed lamp field).  It never reads where an
 * unsensed player is.  The one system rule outside its knowledge: a placement validator (eng.placementOk) may refuse a resting spot that is
 * right behind somebody - it says "invalid", never "who" or "where".
 *
 * BEHAVIOUR (states are the shared framework's names; the act says which canon behaviour it is):
 *   HIDDEN/lurk      waits in the dark; the eyes are a faint gleam.  Restless after a while: walks to another dark spot.
 *   FOLLOWING/drawn  goes to look at something: a light it noticed (anonymous lead), a sound, where it lost somebody.  Gets there, looks, tries a
 *                    couple of likely openings, then admits it was wrong and goes back to the dark.  It can pick the wrong spot.
 *   WATCHING         somebody in view: it stares (face full).  No eye contact: it comes closer - to a watching distance, nearer as it gets agitated.
 *     /hold          sustained eye contact (held, not a one-frame glance): it does not come at the one watching it.  Somebody moving away slowly
 *                    while watching it is let go.  Somebody who just stands there is not: it creeps in and drifts sideways (keep looking or lose it),
 *                    and at close range even small sounds count.  Watching it is counterplay, not a shield.
 *   (close range)    walking in on it is not covered by the hold (v23.1.2): coming at it raises agitation however hard you stare, and somebody who
 *                    has walked in to point-blank (< 140 px) and is not backing off is struck.  Its own creep never counts as their advance.
 *   (multiplayer)    a fresh light it observes elsewhere draws it off somebody it is only watching in the dark (once per person in a while), but
 *                    not off somebody holding it with their eyes; the unlit person it left does not pull it back unless it walks right into them.
 *   PROVOKED/chase   a light carrier in view and agitation over its threshold: it chases (canon).  Running is the right answer now; the light going
 *                    out stops the lure (after a moment), breaking line of sight loses it.  A chase that catches up is an attack.
 *   ATTACKING/rush   the canon triggers: somebody it can see retreating fast (panic), or a loud noise close by.  A short burst; if it misses it
 *                    goes back to chasing (light) or watching.
 *   DISAPPEARING/withdraw  it walks away into the dark - it has lost interest, let somebody go, or lost them.  No vanishing, no teleport.
 * AGITATION (0..1, debug-visible): rises with a light carrier in view, a beam in its eyes, fresh light, being close, losing eye contact up close,
 * noise; falls slowly when nothing happens; rises only a little while it is being watched.  It sets when a light becomes a chase, how close it comes,
 * and how fast a retreat counts as panic.
 * PERSONALITY (bounded, from the shared trait jitter): PATIENCE (how long it waits / watches, how slowly it gets agitated), CURIOSITY (how weak a
 * lead it goes to look at), PERSISTENCE (how long it chases blind / searches), AGGRESSION = boldness (watching distance, chase threshold). */
const SACT = { '': 0, watch: 1, follow: 2, wait: 3, creep: 4, rush: 5, fade: 6, cornered: 7, lightfail: 8, stare: 9, back: 10, circle: 11, block: 12, hold: 13, lurk: 14, drawn: 15, search: 16, chase: 17, drift: 18 };
const SMILER = {
  name: 'Smiler', kind: 'smiler', initial: S.HIDDEN, radius: 23, clearance: 21, vTop: 300, turnPenalty: .3, roamSpeed: 80,
  // only PATIENCE, CURIOSITY, PERSISTENCE, AGGRESSION (boldness), HEARING, VISION and MEMORY drive the canon Smiler; the rest are kept for the shared framework
  traits: { INTELLIGENCE: .8, SADISM: .1, HUNGER: .1, PATIENCE: .7, CURIOSITY: .55, CAUTION: .5, TERRITORIALITY: .5, AGGRESSION: .5, PERSISTENCE: .55, SOCIAL: .3, HEARING: .55, VISION: .92, LIGHT_SENS: .86, MEMORY: .75 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: .6, CAN_CROUCH: false, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: true, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.1, ACCELERATION: 520 },
  vision: { range: 1000, fov: 2.4, dark: true, gain: 2.4, floor: 230 },
  // chase (v23.1.1: 255, was 232 - QA: too easy to outrun): still under a fresh sprint (285 px/s), over a winded or deep-carpet sprint (~236):
  // a fresh runner who reacts at once still gains a little ground, but escape needs stamina, routing and breaking line of sight
  speeds: { roam: 80, approach: 92, investigate: 118, creep: 34, drift: 40, chase: 255, rush: 300, retreat: 110 },
  init(eng, e) {
    e.face = .25; e.faceT = .25; e.ag = 0; e.att = new Map(); e.lurkT = 0; e.goalS = null; e.watchT = 0; e.lostT = 0; e.chaseBlind = 0; e.lightOff = 0; e.strikeT = 0;
    e.grace = 0; e.lastHearT = -1; e.agWhy = ''; e.drift = e.rng() < .5 ? 1 : -1; e.driftT = 0; e.holdT = 0;
    const T = e.tr; e.pz = { patience: T.PATIENCE, curiosity: T.CURIOSITY, persistence: T.PERSISTENCE, bold: T.AGGRESSION };
    e.dbg.why = 'waiting in the dark'; e.dbg.ab = '';
  },
};
/* derived, bounded parameters (personality changes the creature's timing and nerve, not what it is) */
const sP = e => { const z = e.pz; return {
  chaseAt: clamp(.62 - .2 * (z.bold - .5), .5, .74), loom: lerp(150, 110, z.bold), watchD: lerp(330, 220, z.bold),
  lurkFor: lerp(10, 30, z.patience), watchFor: lerp(12, 32, z.patience), blind: lerp(1.6, 3.6, z.persistence), searchFor: lerp(8, 18, z.persistence),
  leadMin: lerp(.45, .2, z.curiosity), gain: lerp(1.25, .75, z.patience), decay: lerp(.045, .085, z.patience) }; };
function sFace(e, target) { e.faceT = target; }
function sWhy(eng, e, why) { if (e.dbg.why !== why) { e.dbg.why = why; e.dbg.whyAt = eng.now; } }
/* the light on the creature itself: the fixed lamp field where it stands, or a beam it has just seen in its eyes (its own observation, 2C) */
function sLit(eng, e) { const lamp = eng.geo.lightLevel(e.x, e.y, null), beam = e.flashAt !== undefined && eng.now - e.flashAt < .6 ? .85 : 0; return Math.max(lamp, beam); }
/* a resting spot in the dark (fixed lamp field only - it does not know where anybody's torch is unless it saw it), on open floor, that the
 * placement validator accepts.  dir: a preferred heading (away from something) */
function darkSpot(eng, e, minD, maxD, from, dir) {
  const geo = eng.geo, o = from || e; let best = null, bs = -1e9;
  for (let i = 0; i < 30; i++) {
    const a = dir !== undefined && i < 20 ? dir + (e.streams.search() - .5) * 1.6 : e.streams.search() * TAU, d = (minD + e.streams.search() * (maxD - minD)), c = geo.cellAt(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d);
    if (c < 0 || geo.cls[c] !== 1) continue;
    const x = geo.cx(c), y = geo.cy(c), lit = geo.lightLevel(x, y, null);
    if (!eng.placementOk(x, y)) continue;
    let cover = 0; for (let k = 0; k < 6; k++) if (geo.ray(x, y, k / 6 * TAU, 200) < 160) cover++;
    const sc = -lit * 400 + Math.min(cover, 3) * 25 - Math.abs(d - (minD + maxD) / 2) * .15 + e.streams.search() * 40;
    if (sc > bs) { bs = sc; best = { x, y }; }
  }
  return best;
}
/* ---------------------------------------------------------------- transitions (each one says why: debug) */
function beginHidden(eng, e, why) { setState(e, S.HIDDEN, 'lurk'); e.goalS = null; e.lurkT = 0; e.watchT = 0; sFace(e, .25); sWhy(eng, e, why || 'waiting in the dark'); }
function beginDrawn(eng, e, g, why, fast) {
  setState(e, S.FOLLOWING, fast ? 'search' : 'drawn'); e.goalS = { x: g.x, y: g.y, u: g.u || 120, k: g.k || 'lead', lead: g.lead || 0, t0: eng.now, phase: 'go', legs: 0, maxLegs: 1 + Math.round(e.pz.persistence * 2), pause: 0, fast: !!fast, dir: g.dir, off: g.off };
  plan(eng, e, g.x, g.y); sFace(e, .45); sWhy(eng, e, why);
}
function beginWatch(eng, e, r, why) { setState(e, S.WATCHING, 'watch'); setTarget(e, r.id, eng.now); e.watchT = 0; e.lostT = 0; e.holdT = 0; sFace(e, 1); sWhy(eng, e, why); }
function beginStalk(eng, e, r, why) { beginChase(eng, e, r, why || 'debug'); }              // (engine debug command name kept)
function beginChase(eng, e, r, why) { setState(e, S.PROVOKED, 'chase'); setTarget(e, r.id, eng.now); e.chaseBlind = 0; e.lightOff = 0; e.chaseT = 0; sFace(e, 1); sWhy(eng, e, why); }
function beginStrike(eng, e, r, why) { setState(e, S.ATTACKING, 'rush'); setTarget(e, r.id, eng.now); e.strikeT = 0; sFace(e, 1); e.ag = Math.max(e.ag, .8); sWhy(eng, e, why); e.dbg.strikes = (e.dbg.strikes | 0) + 1; }
function beginWithdraw(eng, e, why, dir) {
  const g = darkSpot(eng, e, 380, 1000, e, dir) || darkSpot(eng, e, 200, 700, e);
  if (!g) { beginHidden(eng, e, why); return; }
  setState(e, S.DISAPPEARING, 'fade'); e.goalS = { x: g.x, y: g.y, t0: eng.now }; plan(eng, e, g.x, g.y); sFace(e, 0); sWhy(eng, e, why);
  if (e.target > 0) e.dbg.ab = why + ' @' + eng.now.toFixed(0);
}
/* ---------------------------------------------------------------- perception summaries */
/* sustained eye contact per player (the 2C facedBy test, plus hysteresis: a glance or a one-frame flick of the mouse does nothing) */
const EC_ON = .4, EC_LAPSE = .3;
function sAttention(eng, e, tdt) {
  const seen = new Set(e.seenNow);
  for (const id of seen) {
    const r = e.mem.p.get(id), p = r && r.visual, f = facedBy(eng, e, p, r, e.face > .5 ? .55 : 0, e.lit);   // its gleaming face can be met in the dark; the light on it = what it knows (sLit)
    let a = e.att.get(id); if (!a) e.att.set(id, a = { t: 0, lapse: 9, had: false });
    if (f) { a.t += tdt; a.lapse = 0; } else { a.lapse += tdt; if (a.lapse > EC_LAPSE) { if (a.t >= EC_ON) a.had = true; a.t = 0; } }
  }
  for (const [id, a] of e.att) if (!seen.has(id)) { a.lapse += tdt; if (a.lapse > EC_LAPSE) { if (a.t >= EC_ON) a.had = true; a.t = 0; } if (!eng.byId.has(id)) e.att.delete(id); }
}
const heldBy = (e, id) => { const a = e.att.get(id); return !!a && a.t >= EC_ON; };
function watcher(e) { for (const [id, a] of [...e.att].sort((a,b) => a[0]-b[0])) if (a.t >= EC_ON) return id; return 0; }
/* how fast a seen player is moving away from the creature (+) or toward it (-), from consecutive sightings */
function sRadial(eng, e, r, tdt) {
  const P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
  if (r.seen && r.dPrev !== undefined && tdt > 0) r.dRate = lerp(r.dRate || 0, (d - r.dPrev) / tdt, .5); else if (!r.seen) r.dRate = 0;
  // (v23.1.2) close-range pressure: how fast THEY are coming at it (their own velocity toward it, seen), and how far they have walked in on it
  // lately (decays over ~6 s).  Its own creep never counts - only the person closing the gap.
  const adv = r.seen && d > 1 ? (P.vx * (e.x - P.x) + P.vy * (e.y - P.y)) / d : 0;
  r.adv = lerp(r.adv || 0, adv, .5);
  if (tdt > 0) r.closed = Math.max(0, (r.closed || 0) * Math.exp(-tdt / 6) + (r.seen && adv > 15 ? adv * tdt : 0));
  r.dPrev = d; return { P, d };
}
/* ---------------------------------------------------------------- target choice: who it is working on (Smiler-specific commitment, see below) */
/* Scored only from perceived signals: in view, carrying a light it sees, a light of theirs it has just seen (beam / source pinned on them), a loud
 * sound it pinned on them, distance to where it believes they are.  The current target keeps a bonus and a 3 s dwell (longer than the shared 1.5 s:
 * this is a patient creature - it should be seen to settle on somebody, not flick between people).  A canon trigger (panic, noise) switches at once. */
const SM_DWELL = 3;
function sScore(eng, e, r) {
  const now = eng.now, P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
  const lt = r.ev && r.ev.find(q => q.k === 'light' && now - q.t < 1.5);
  return (r.seen ? .6 : 0) + (r.seen && r.light ? 1 : 0) + (lt ? .5 : 0) + (now - r.hLoud < 2 ? .4 : 0) - d / 1500 + (e.target === r.id ? .35 : 0);
}
function sChoose(eng, e) {
  const now = eng.now; let best = null, bs = -1e9;
  for (const r of e.mem.p.values()) {
    if (tgtGone(eng, e, r)) continue;
    if (!r.seen && (now - r.seenAt > 2.5 || r.conf < .3)) continue;
    const s = sScore(eng, e, r); if (s > bs || (s === bs && (!best || r.id < best.id))) { bs = s; best = r; }
  }
  if (!best) return null;
  const cur = e.target > 0 ? e.mem.p.get(e.target) : null;
  if (cur && cur !== best && !tgtGone(eng, e, cur) && (cur.seen || now - cur.seenAt < 2)) {
    const cs = sScore(eng, e, cur);
    if (bs < cs + .3 || now - (e.tgtSince ?? -99) < SM_DWELL) return cur;
    e.dbg.retarget = `P${cur.id} -> P${best.id} (${bs.toFixed(2)} vs ${cs.toFixed(2)})`;
  }
  return best;
}
/* ---------------------------------------------------------------- agitation: bounded, gradual, decaying, only from perceived events */
function sAgitation(eng, e, tdt, tgt, d) {
  const now = eng.now, Pm = sP(e); let g = 0; const why = [];
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r.light) { g += id === e.target ? .13 : .06; why.push('light in view'); break; } }
  if (e.flashAt !== undefined && now - e.flashAt < .5) { g += .28; why.push('beam in its eyes'); }
  // somebody it is watching who does not watch it back: it grows bolder (canon: keep eye contact)
  if (tgt && tgt.seen && e.state === S.WATCHING && !heldBy(e, tgt.id) && d < 600) { g += .045; why.push('not being watched'); }
  if (e.inv && now - e.inv.t < .5 && (e.inv.c || 0) > .5) { g += .06; why.push('fresh light'); }
  if (tgt && tgt.seen && d < Pm.loom * 1.6) { g += .05; why.push('close'); }
  const w = watcher(e); if (w) { g *= .35; g += .015; why.push('being watched'); }
  // (v23.1.2) somebody walking in on it: eye contact does not soften this - the gaze holds it back, it does not license coming closer
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (!r || (r.adv || 0) < 20) continue; const dd = r.dist || 1e9; if (dd < 450) { g += .12 + .45 * (1 - dd / 450); why.push('approached it'); break; } }
  if (g > 0) e.ag += g * Pm.gain * tdt; else e.ag -= Pm.decay * (e.seenNow.size ? .5 : 1) * tdt;
  e.ag = clamp(e.ag, 0, 1); e.agWhy = why.join(', ');
}
function sBump(e, v, why) { e.ag = clamp(e.ag + v, 0, 1); e.agWhy = why; }
/* ---------------------------------------------------------------- the canon triggers */
/* panic: somebody it sees retreating fast, close by (outside a chase, and not in the moment after a chase ended) */
function sPanic(eng, e) {
  if (eng.now < e.grace || e.state === S.PROVOKED || e.state === S.ATTACKING) return null;
  const slow = 165 - 70 * e.ag, R = 380 + 220 * e.ag;
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id); if (!r || tgtGone(eng, e, r)) continue;
    const P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
    if (d < R && P.sp > slow && (r.dRate || 0) > 90) return r;
  }
  return null;
}
/* (v23.1.2) close-range pressure - somebody who walked in on it, to point-blank range.  Gameplay inference, not canon text: the canon way out is
 * to keep eye contact and move AWAY slowly; closing in on it is the opposite, so it does not get the protection of the hold.  A quiet person who
 * stays put or backs away is never struck for proximity (amendment 3): its own creep stops at its looming distance and never counts as their
 * advance; only the distance THEY closed (r.closed, from their own movement) does. */
const PB = 140;
function sIntrude(eng, e) {
  if (e.state === S.PROVOKED || e.state === S.ATTACKING) return null;
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id); if (!r || tgtGone(eng, e, r)) continue;
    const d = r.dist || 1e9; if (d > PB) continue;
    if ((r.closed || 0) > 40 && (r.adv || 0) > -10) return r;                // walked in on it and still not backing off
    if (e.ag > .85 && (r.adv || 0) > 15) return r;                             // already wound up: any step toward it, this close
  }
  return null;
}
/* noise: a loud sound close by (at high agitation, and very close, small ones too) */
function sNoise(eng, e) {
  const h = e.hear; if (!h || h.t <= e.lastHearT) return null; e.lastHearT = h.t;
  if (h.src < 0) return null;
  const d = Math.hypot(h.x - e.x, h.y - e.y), loud = h.type === 'run' || h.type === 'slide' || h.type === 'vault' || h.type === 'land' || h.I > .5;
  const small = e.ag > .7 && ((d < 230 && h.I > .08) || (d < 120 && h.I > .02));     // (v23.1.2: right beside it, even a crouched step)
  if (!((loud && d < 520 + 200 * e.tr.HEARING) || small)) return { weak: true, h, d };
  return { h, d, r: h.src > 0 ? e.mem.p.get(h.src) : null };
}
/* ---------------------------------------------------------------- the decision step (think rate: 10 Hz near, ~3 Hz mid) */
function sThink(eng, e) {
  const now = eng.now, tdt = Math.min(.5, now - (e.thinkAt ?? now)); e.thinkAt = now;
  const Pm = sP(e);
  sAttention(eng, e, tdt);
  let tgt = e.target > 0 ? e.mem.p.get(e.target) : null; if (tgt && tgtGone(eng, e, tgt)) { e.dbg.ab = `P${tgt.id}: saw them go down @${now.toFixed(0)}`; tgt = null; }
  let d = 1e9; if (tgt) { const q = sRadial(eng, e, tgt, tdt); d = q.d; }
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r !== tgt) sRadial(eng, e, r, tdt); }
  sAgitation(eng, e, tdt, tgt, d);
  // canon triggers first
  const pr = sPanic(eng, e); if (pr) { beginStrike(eng, e, pr, `P${pr.id} retreated fast in front of it (panic)`); return; }
  const ir = sIntrude(eng, e); if (ir) { const c = Math.round(ir.closed || 0); ir.closed = 0; beginStrike(eng, e, ir, `P${ir.id} walked in on it to point-blank (${Math.round(ir.dist)} px, closed ${c} px)`); return; }
  const nz = sNoise(eng, e);
  if (nz && !nz.weak && e.state !== S.ATTACKING) {
    if (nz.r && nz.r.seen && e.state !== S.PROVOKED && !(now < e.grace && nz.r === tgt)) { beginStrike(eng, e, nz.r, `a loud ${nz.h.type} from P${nz.r.id}, close`); return; }
    sBump(e, .25, 'loud noise');
    if (e.state === S.HIDDEN || e.state === S.FOLLOWING || e.state === S.DISAPPEARING) { beginDrawn(eng, e, { x: nz.h.x, y: nz.h.y, u: nz.h.unc, k: 'sound' }, `a loud ${nz.h.type} nearby`, true); return; }
  }
  switch (e.state) {
    case S.HIDDEN: case S.DORMANT: {
      e.lurkT += tdt;
      const r = sChoose(eng, e); if (r && r.seen) { beginWatch(eng, e, r, `P${r.id} in view${r.light ? ' with a light' : ''}`); return; }
      const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead);
      if (L && L.c * (.5 + L.sal) >= Pm.leadMin) { beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, dir: L.dir }, `drawn to a ${L.k} lead (±${Math.round(L.u)} px)`); return; }
      if (nz && nz.weak && nz.d < 900 && nz.h.I > .15 && e.rng() < .35 * e.pz.curiosity) { beginDrawn(eng, e, { x: nz.h.x, y: nz.h.y, u: nz.h.unc, k: 'sound' }, `a ${nz.h.type} it heard`); return; }
      if (e.lurkT > Pm.lurkFor) beginWithdraw(eng, e, 'restless: moves to another dark spot');
      return;
    }
    case S.FOLLOWING: {
      const G = e.goalS; if (!G) { beginHidden(eng, e); return; }
      const r = sChoose(eng, e);
      // (the unlit person it just left for a light does not pull it straight back, unless they are right up against it: it can pass close by somebody in the dark on its way to a light)
      if (r && r.seen && !(G.off === r.id && !r.light && Math.hypot(r.lkx - e.x, r.lky - e.y) > 80)) { beginWatch(eng, e, r, `found P${r.id}${r.light ? ' (with a light)' : ''}`); return; }
      // a better light lead than the one it is following
      const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead);
      if (L && L.id !== G.lead && now - L.t < .5 && L.c * (.5 + L.sal) > Pm.leadMin * 1.3) { beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, dir: L.dir, off: G.off }, `a fresher ${L.k} lead`); return; }
      if (G.lead && !e.mem.leads.some(q => q.id === G.lead) && G.phase === 'go' && now - G.t0 > 2) { e.dbg.ab = `lead #${G.lead} faded @${now.toFixed(0)}`; }
      if (now - G.t0 > Pm.searchFor + 6) { beginWithdraw(eng, e, `nothing at the ${G.k}: it was wrong`); return; }
      return;
    }
    case S.WATCHING: {
      if (e.afterKillAt !== undefined && now - e.afterKillAt < lerp(1.5, 4, e.pz.patience)) return;     // it lingers over a kill a moment
      const r = sChoose(eng, e) || tgt;
      if (!r) { beginWithdraw(eng, e, 'nobody left to watch'); return; }
      if (r !== tgt) { setTarget(e, r.id, now); tgt = r; d = sRadial(eng, e, r, 0).d; }
      e.watchT += tdt;
      if (!r.seen) {
        e.lostT += tdt;
        if (now - (e.heldRetreatAt ?? -99) < 2.5 && e.heldRetreatId === r.id) { beginWithdraw(eng, e, `let P${r.id} go: they kept their eyes on it and backed out of sight`, Math.atan2(e.y - r.lky, e.x - r.lkx)); return; }
        if (e.lostT > 1.5) { const est = estimate(e, r, now, eng.geo); beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost' }, `lost sight of P${r.id}: goes where it thinks they went (±${Math.round(est.unc)} px)`); }
        return;
      }
      e.lostT = 0;
      // canon: light is what draws it.  A fresh light somewhere else (a lead it observed - not a person it knows) pulls it off somebody it is
      // only watching in the dark, unless that somebody holds it with their eyes (the counterplay: one player holds it while another moves)
      if (!r.light && !watcher(e) && e.watchT > 2 && !(e.pulledOff && e.pulledOff.id === r.id && now - e.pulledOff.t < 15)) {   // (once per person in a while: no back-and-forth)
        const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead), P = perc(eng, e, r);
        if (L && now - L.t < .5 && L.c * (.5 + L.sal) >= Pm.leadMin * 1.3 && Math.hypot(L.x - P.x, L.y - P.y) > L.u + 150) {
          beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, dir: L.dir, off: r.id }, `a light elsewhere drew it off P${r.id} (${L.k}, ±${Math.round(L.u)} px)`); e.pulledOff = { id: r.id, t: now }; return;
        }
      }
      if (r.light && e.ag >= Pm.chaseAt) { beginChase(eng, e, r, `P${r.id} carries a light it can see (agitation ${e.ag.toFixed(2)})`); return; }
      const held = heldBy(e, r.id);
      if (held) {
        const retreating = (r.dRate || 0) > 25;
        // Human-QA amendment: staring in place is active counterplay, not a permanent equilibrium.  Pressure accumulates only while the
        // watcher refuses to retreat; doing the canon-safe thing (slowly backing away) relieves it and can still earn a clean release.
        if (retreating) e.holdT = Math.max(0, e.holdT - tdt * 1.5); else e.holdT += tdt;
        if (retreating) { e.ag = Math.max(0, e.ag - .05 * tdt); e.heldRetreatAt = now; e.heldRetreatId = r.id; if (d > 600) { beginWithdraw(eng, e, `let P${r.id} go: watched it and moved away slowly`, Math.atan2(e.y - r.lky, e.x - r.lkx)); return; } }
        sWhy(eng, e, retreating ? `held by P${r.id}'s eyes; they are backing away` : `held by P${r.id}'s eyes; standing still builds pressure: it creeps and drifts harder`);
      } else {
        e.holdT = 0;
        const a = e.att.get(r.id); if (a && a.had && a.lapse > .5 && a.lapse < .5 + tdt * 1.5 && d < 300) sBump(e, .2, 'eye contact broken up close');
        sWhy(eng, e, `watching P${r.id}${r.light ? ' (light on)' : ''}, agitation ${e.ag.toFixed(2)}`);
        if (!watcher(e) && ((e.watchT > Pm.watchFor && e.ag < .25) || e.watchT > Pm.watchFor * 2.2)) beginWithdraw(eng, e, `lost interest in P${r.id}: nothing happened`, Math.atan2(e.y - r.lky, e.x - r.lkx));
      }
      return;
    }
    case S.PROVOKED: {
      const r = tgt; if (!r) { beginWithdraw(eng, e, 'chase target gone'); return; }
      e.chaseT = (e.chaseT || 0) + tdt;
      if (r.seen) {
        e.chaseBlind = 0;
        if (!r.light) { e.lightOff += tdt; if (e.lightOff > 1.2) { e.grace = now + 3; beginWatch(eng, e, r, `P${r.id}'s light went out: the lure is gone`); return; } } else e.lightOff = 0;
      } else {
        e.chaseBlind += tdt;
        if (e.chaseBlind > Pm.blind) { const est = estimate(e, r, now, eng.geo); e.grace = now + 3; beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost' }, `lost P${r.id} in the chase: searches where they might be (±${Math.round(est.unc)} px)`, true); e.dbg.ab = `chase of P${r.id}: lost sight @${now.toFixed(0)}`; return; }
      }
      if (e.chaseT > 30) { e.grace = now + 3; beginWatch(eng, e, r, 'a long chase: it slows to watching'); }
      return;
    }
    case S.ATTACKING: {
      const r = tgt; e.strikeT += tdt;
      if (!r) { beginWithdraw(eng, e, 'strike target gone'); return; }
      if (e.strikeT > 1.8) {
        e.grace = now + 2.5;
        if (r.seen && r.light) beginChase(eng, e, r, `missed P${r.id}; they still carry a light`);
        else if (r.seen) beginWatch(eng, e, r, `missed P${r.id}`);
        else { const est = estimate(e, r, now, eng.geo); beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost' }, `missed P${r.id} and lost sight`, true); }
      }
      return;
    }
    case S.DISAPPEARING: {
      const r = sChoose(eng, e); if (r && r.seen && r.light && e.ag > Pm.chaseAt * .7) { beginWatch(eng, e, r, `turned back: P${r.id}'s light`); return; }
      if (e.goalS && now - e.goalS.t0 > 25) beginHidden(eng, e, 'settled where it was');
      return;
    }
    case S.PLAYING: return;
    default: beginHidden(eng, e);
  }
}
/* ---------------------------------------------------------------- movement (every tick) */
function sMove(eng, e, dt) {
  const now = eng.now, Pm = sP(e), sp = e.sp.speeds;
  switch (e.state) {
    case S.HIDDEN: case S.DORMANT: stopMoving(eng, e, dt); e.head = Math.sin(e.t * .7) * .25; return null;
    case S.FOLLOWING: {
      const G = e.goalS; if (!G) { stopMoving(eng, e, dt); return null; }
      if (G.phase === 'go') {
        const st = follow(eng, e, dt, G.fast ? sp.investigate : sp.approach, { arrive: 30 });
        if (st === 'arrived' || st === 'nopath' || Math.hypot(G.x - e.x, G.y - e.y) < 40) { G.phase = 'look'; G.pause = 0; setAct(e, 'search'); }
      } else if (G.phase === 'look') {
        stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.2) * .7; G.pause += dt;
        if (G.pause > lerp(1, 2.2, e.pz.patience)) {
          if (G.legs >= G.maxLegs) { beginWithdraw(eng, e, `looked at the ${G.k} and found nobody: it was wrong`); return null; }
          // a likely opening from here: the open directions, the one the light came from first (if it knows), not the way it came
          let best = null, bs = -1e9; const back = G.x0 !== undefined ? Math.atan2(G.y0 - e.y, G.x0 - e.x) : e.ang + Math.PI;
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, L = eng.geo.ray(e.x, e.y, a, 520); if (L < 200) continue; let sc = Math.min(L, 520) * .3 + (G.dir !== undefined ? Math.cos(angDiff(a, G.dir)) * 120 : 0) - (Math.cos(angDiff(a, back)) > .7 ? 150 : 0) + e.streams.search() * 90; if (G.k === 'lost') sc = habitBias(e, e.target, e.x + Math.cos(a)*300, e.y + Math.sin(a)*300, sc); if (sc > bs) { bs = sc; best = a; } }
          G.legs++; if (best === null) { beginWithdraw(eng, e, `nowhere to look from the ${G.k}`); return null; }
          const D = Math.min(380, eng.geo.ray(e.x, e.y, best, 420) - 40); G.x0 = e.x; G.y0 = e.y; G.x = e.x + Math.cos(best) * D; G.y = e.y + Math.sin(best) * D; G.phase = 'go'; plan(eng, e, G.x, G.y); setAct(e, 'search');
          sWhy(eng, e, `searching from the ${G.k}: leg ${G.legs}/${G.maxLegs}`);
        }
      }
      return null;
    }
    case S.WATCHING: {
      const r = e.target > 0 ? e.mem.p.get(e.target) : null; if (!r) { stopMoving(eng, e, dt); return null; }
      const P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
      faceToward(e, P.x, P.y, dt, 2.2); e.head = 0;
      if (!r.seen) { stopMoving(eng, e, dt); setAct(e, 'wait'); return null; }
      const held = heldBy(e, r.id), other = !held && watcher(e);
      if (held) {
        const retreating = (r.dRate || 0) > 25;
        // The longer somebody stands still and stares, the more demanding the hold becomes: the face closes some distance and its lateral
        // drift gets faster/less comfortable.  This never invents a timer-based attack; panic/noise/light rules still own aggression.
        const pressure = clamp((e.holdT - 2) / 10, 0, 1), holdR = Pm.loom;
        const creepV = sp.creep * lerp(1, 1.25, pressure), driftV = sp.drift * lerp(1, 2.05, pressure);
        if (!retreating && d > holdR + 12) { setAct(e, 'creep'); goTo(eng, e, P.x, P.y, { every: .45 }); follow(eng, e, dt, creepV, { arrive: holdR, turnMul: 1 + pressure * .25 }); }
        else if (!retreating) {                                                  // held up close: increasingly active lateral drift forces reacquisition, but its own movement never becomes a proximity attack
          setAct(e, 'drift'); e.driftT -= dt; if (e.driftT <= 0) { e.driftT = rand(e, lerp(1.5, .75, pressure), lerp(3.5, 1.7, pressure)); e.drift = -e.drift; }
          const a = Math.atan2(e.y - P.y, e.x - P.x) + e.drift * dt * (driftV / Math.max(70, d)), rd = Math.max(holdR, d), tx = P.x + Math.cos(a) * rd, ty = P.y + Math.sin(a) * rd;
          if (eng.geo.clear(tx, ty, e.rc, 'walk')) { e.moved = moveCollide(eng, e, tx - e.x, ty - e.y); e.speed = Math.min(driftV, e.moved / Math.max(dt, 1e-4)); } else { e.drift = -e.drift; stopMoving(eng, e, dt); }
        } else { setAct(e, 'hold'); stopMoving(eng, e, dt); }
        return null;
      }
      const want = e.ag < .4 ? Pm.watchD : Pm.loom, go = e.act === 'watch' ? d > want + 8 : d > want + 60;    // (hysteresis: no stop-start at the edge)
      if (go) { setAct(e, 'watch'); goTo(eng, e, P.x, P.y, { every: .6 }); follow(eng, e, dt, sp.approach * (other ? .4 : 1), { arrive: want }); }
      else { setAct(e, 'stare'); stopMoving(eng, e, dt); }
      return null;
    }
    case S.PROVOKED: case S.ATTACKING: {
      const r = e.target > 0 ? e.mem.p.get(e.target) : null; if (!r) { stopMoving(eng, e, dt); return null; }
      const P = perc(eng, e, r), v = e.state === S.ATTACKING ? sp.rush : sp.chase;
      if (r.seen && directOk(eng, e, P.x, P.y, 900)) directTo(eng, e, P.x, P.y); else goTo(eng, e, P.x, P.y, { every: .4 });
      follow(eng, e, dt, v, { arrive: 8, noSlow: false });
      const body = touching(eng, e, r.id, e.r + 15);
      if (body) return { pv: body, dir: e.ang, speed: e.speed, style: e.state === S.ATTACKING ? 'rush' : 'chase' };
      return null;
    }
    case S.DISAPPEARING: {
      const G = e.goalS; if (!G) { beginHidden(eng, e); return null; }
      const st = follow(eng, e, dt, sp.retreat, { arrive: 24 });
      if (st === 'arrived' || st === 'nopath' || Math.hypot(G.x - e.x, G.y - e.y) < 34) beginHidden(eng, e, 'back in the dark');
      return null;
    }
    case S.PLAYING: { if (!e.cap) beginWithdraw(eng, e, 'done'); return null; }
  }
  return null;
}
function smilerTick(eng, e, dt, thinkNow) {
  e.face += clamp(e.faceT - e.face, -dt * (e.faceT > e.face ? .8 : 1.4), dt * (e.faceT > e.face ? .8 : 1.4));
  e.lit = sLit(eng, e);
  if (thinkNow) sThink(eng, e);
  const res = sMove(eng, e, dt);
  e.dbg.sm = { ag: +e.ag.toFixed(2), agw: e.agWhy, lit: +e.lit.toFixed(2), w: watcher(e), ht: +e.holdT.toFixed(1), why: e.dbg.why, ab: e.dbg.ab, rt: e.dbg.retarget || '',
    pz: { pat: +e.pz.patience.toFixed(2), cur: +e.pz.curiosity.toFixed(2), per: +e.pz.persistence.toFixed(2), bold: +e.pz.bold.toFixed(2) },
    ec: [...e.att].filter(([, a]) => a.t > 0).map(([id, a]) => [id, +a.t.toFixed(1)]), cl: e.target > 0 && e.mem.p.get(e.target) ? Math.round(e.mem.p.get(e.target).closed || 0) : 0, dw: e.target > 0 ? +(eng.now - (e.tgtSince ?? eng.now)).toFixed(1) : null, st: e.dbg.strikes | 0 };
  return res;
}

/* a capture forced into PLAY by the admin tool (canon Smilers kill at once - see SMILER.capture.quick): it stares, then withdraws a step */
function sPlayTick(eng, e, cap, pv, dt) {
  if (!pv) return;
  const P = cap.plan, d = dist(e.x, e.y, pv.x, pv.y); sFace(e, 1);
  if (!P || eng.now > P.until) { const act = pickW(e.rng, [{ k: 'stare', w: 1.3 }, { k: 'back', w: 1 }]); cap.plan = { act, until: eng.now + rand(e, 1.6, 4) }; cap.plays++; setAct(e, act); }
  const p = cap.plan; cap.drag = null;
  if (p.act === 'back' && d < 420) { const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 60, ty = e.y + Math.sin(away) * 60; if (eng.geo.clear(tx, ty, 21, 'walk')) { e.speed = approach(e.speed, 70, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(away) * e.speed * dt, Math.sin(away) * e.speed * dt); } else stopMoving(eng, e, dt); }
  else stopMoving(eng, e, dt);
  faceToward(e, pv.x, pv.y, dt, 2.5);
}
SMILER.capture = {
  quick() { return 1; },                                                       // canon: no "play" with a victim (Canon Lock: do not invent sadism)
  variants(eng, e, pv, ctx, attack) {
    return [
      { k: 'A', w: ctx.deadEnd ? 1 : 3 },                                       // out of the darkness
      { k: 'B', w: ctx.deadEnd ? 3 : .4 },                                      // pinned where there is no way out
      { k: 'C', w: 0 }, { k: 'D', w: 0 },                                       // (light-failure / play deaths: admin previews only)
    ];
  },
  onBegin(eng, e, cap, pv) { setState(e, S.PLAYING, 'stare'); },
  playTick(eng, e, cap, pv, dt) { sPlayTick(eng, e, cap, pv, dt); },
  decide(eng, e, cap, pv) { const r = e.rng(); return cap.plays > 1 && r < .5 ? 'kill' : cap.plays > 2 && r < .7 ? 'release' : 'continue'; },
  onInterrupt(eng, e, cap, pv, ctx, x) { return ctx.approaching > 0 || ctx.danger > .8 ? 'kill' : 'continue'; },
  onRelease(eng, e, cap, pv) { setAct(e, 'back'); },
  releaseTick(eng, e, cap, pv, dt) { stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2.5); sFace(e, 1); },
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; r.seenAt = eng.now; beginStrike(eng, e, r, 'resumed'); },
  onLetGo(eng, e, cap, pv) { beginWithdraw(eng, e, 'let go'); },
  afterKill(eng, e, ctx, pv) {
    e.ag = .3; setState(e, S.WATCHING, 'stare'); setTarget(e, 0, eng.now); e.watchT = lerp(0, 8, e.pz.patience); sFace(e, 1);
    sWhy(eng, e, 'a kill: it lingers a moment, then goes back to the dark');
    e.afterKillAt = eng.now;
  },
};
/* Presentation-only face aim.  The Smiler has no invented neck/body anatomy: its visible face simply rotates toward the evidence it is already
 * attending to.  This does not feed back into vision or behavior. */
function sVisualLook(e) {
  let x = null, y = null;
  const r = e.target > 0 ? e.mem.p.get(e.target) : null;
  if (r) {
    if (r.seen && r.visual) { x = r.visual.x; y = r.visual.y; }
    else if (r.conf > .12 && Number.isFinite(r.lkx) && Number.isFinite(r.lky)) { x = r.lkx; y = r.lky; }
  }
  if (x === null && e.goalS && Number.isFinite(e.goalS.x)) { x = e.goalS.x; y = e.goalS.y; }
  if (x === null) return clamp(e.head || 0, -1.2, 1.2);
  return angDiff(Math.atan2(y - e.y, x - e.x), e.ang);
}
SMILER.tick = smilerTick;
SMILER.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: SACT[e.act] | 0, v: Math.round(e.speed), f: +e.face.toFixed(2), h: +(e.head || 0).toFixed(2), lh: +sVisualLook(e).toFixed(2), tg: e.target > 0 && (e.state === S.WATCHING || e.state === S.PROVOKED || e.state === S.ATTACKING) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, lt: +(e.lit || 0).toFixed(2), sp: 0 });
/* ---------------------------------------------------------------- THE SKIN-STEALER'S MIND (Trial 3 R11; dev/trial-3-r9-overhaul/)
 * The owner (October 22): it sneaks across the player's view into its hiding place; its reasoning is odd; it should be always attentive,
 * responsive and opportunistic.  R8's only notion of being observed was eye contact (facedBy: a person facing it within .35 rad).  But a
 * player's screen shows everything round them that is in their sight and lit, whichever way they face.  This part gives the creature the
 * three things R11 needs, from its own senses only (Trial 3's evidence law: what it sees now, what it heard, what it remembers):
 *   1 WHO COULD SEE IT.  A person it SEES now: it sees where they are, how they face and whether their light is on, so it can judge - by
 *     the rules of the person's own screen, mirrored on the server's copy of the level - whether it stands in their view: within their
 *     sight mask (700 px, a clear line to its body), and readable there (the client's exposureAt terms: the near aura, their torch as it
 *     sees it pointed, the level's lamps; the range fade).  A person it does NOT see now it can only suspect: from its belief of where they
 *     are (never where they really are), with their torch assumed able to point anywhere.  skExposedTo(eng, observer, x, y).
 *   2 WHAT CHANGED.  On each think it compares what it perceives with its last think: a person newly in its sight, one gone from it, a new
 *     sound, a seen person turning to face it, coming into or leaving that person's view, someone in arm's reach, a seen quarry winded, its
 *     own strike missed or hit a wall.  Each is an EVENT with the time; the first change of plan after it records how long the creature
 *     took to respond (the latency the pack asks to measure).  Nothing here decides: the decision (ai.skinstealer.js) reads them.
 *   3 WHAT IT KNOWS.  Per person it has seen: when it first and last saw them, whether they could see it (their view) and whether they met
 *     its eyes, and THEY SAW ME - the last time they could see it, kept for SKM.sawTtl seconds (renewed while it lasts) - distinct from
 *     I SUSPECT THEY COULD SEE ME (from a belief only) and THEIR PLACE IS UNKNOWN.  And a short log of its hunt's evidence (seen, heard,
 *     inferred, disproved) for the overlay and the tests.
 * Cost: on a think (10 Hz near), for each person it sees, three rays and a lamp read; nothing per tick, nothing for people it does not
 * sense.  No record of a person it has not seen is ever made here; no player's real place is read for anybody not in e.seenNow. */
const SKM = Object.freeze({
  mask: 700, side: 18, legible: .25,             // a person's sight mask (px); the body's half width across the line of sight; readable from (the client's rule)
  edge: 30,                                      // (R16) a still body as drawn: its hands and head reach 18-30 px out (R14-4) - a WAITING spot hides all of it
  sawTtl: 8,                                     // seconds 'they saw me' is kept after they last could see it
  eyesTtl: 4,                                    // seconds 'they met my eyes' is kept
  turnIn: .6, turnOut: .9,                       // a seen person TURNS to face it: their facing comes within turnIn rad of it from beyond turnOut
  evMax: 24, logMax: 12,                         // events kept; hunt evidence kept
  reach: 90,                                     // a person within this is 'at arm's reach' as an event (the grab itself is the strike's)
});
/* how readable a body at (x, y) is to an observer ob {x, y, angle, light, kind} (the client's exposureAt, vision.ts, on the server's copy
 * of the level).  ob.angle null: the creature does not know which way they face (a belief): their torch is taken as able to point at it */
function skLegible(eng, ob, x, y) {
  const geo = eng.geo, d = Math.hypot(x - ob.x, y - ob.y);
  let s = (1 - sm(28, 100, d)) * .5;
  if (ob.light && geo.a.qc) {
    const src = { x: ob.x, y: ob.y, angle: ob.angle === null || ob.angle === undefined ? Math.atan2(y - ob.y, x - ob.x) : ob.angle, equipment: { kind: ob.kind || 'flashlight' } };
    const q = geo.a.qc(src, { x, y }, true); if (q > s && geo.los(ob.x, ob.y, x, y)) s = q;
  }
  // (R16) another person's torch lights it for this one too (the screen draws every wanderer's light): the lights it knows of - the people
  // it sees now, their torches as it sees them (skWatchers gives them as ob.lights); never anybody's it does not see
  if (ob.lights && geo.a.qc) for (const L of ob.lights) {
    const src = { x: L.x, y: L.y, angle: L.angle === null || L.angle === undefined ? Math.atan2(y - L.y, x - L.x) : L.angle, equipment: { kind: L.kind || 'flashlight' } };
    const q = geo.a.qc(src, { x, y }, true); if (q > s && geo.los(L.x, L.y, x, y)) s = q;
  }
  const i = geo.cellAt(x, y);
  if (i >= 0 && !(geo.a.blackout && geo.a.blackout())) { let l = geo.lamp[i] || 0; for (const f of geo.fails) if (f.until > eng.now && Math.hypot(x - f.x, y - f.y) < f.r) l *= .06; if (l > s) s = l; }
  return (1 - sm(420, 670, d)) * Math.min(1, .04 + s * 2.08);
}
/* could ob make out a body at (x, y)?  in their sight mask (a clear line, within 700 px, to its centre or a point SKM.side to either side)
 * and readable there */
function skExposedTo(eng, ob, x, y) {
  const d = Math.hypot(x - ob.x, y - ob.y); if (d > SKM.mask + SKM.side) return false;
  const ux = (x - ob.x) / (d || 1), uy = (y - ob.y) / (d || 1), geo = eng.geo;
  for (const k of [0, -1, 1]) {
    const qx = x - uy * SKM.side * k, qy = y + ux * SKM.side * k;
    if (Math.hypot(qx - ob.x, qy - ob.y) > SKM.mask || !geo.los(ob.x, ob.y, qx, qy)) continue;
    if (skLegible(eng, ob, qx, qy) >= SKM.legible) return true;
  }
  return false;
}
/* (R16) could someone at (ox, oy) see any part of a still body at (x, y) - its centre, or a point SKM.edge to either side across the line of
 * sight (the drawn figure keeps within 40 px of its centre; its hands and head reach 18-30 px out, R14-4)?  For choosing where to WAIT:
 * the spot must hide all of it, as the screen would show it; moving, the body is audited as before (SKM.side, the covert way's margin) */
function skBodyInSight(geo, ox, oy, x, y) {
  if (geo.los(ox, oy, x, y)) return true;
  const d = Math.hypot(x - ox, y - oy) || 1, ux = (x - ox) / d, uy = (y - oy) / d;
  return geo.los(ox, oy, x - uy * SKM.edge, y + ux * SKM.edge) || geo.los(ox, oy, x + uy * SKM.edge, y - ux * SKM.edge);
}
/* (R16) could ob make out any part of a still body waiting at (x, y)?  skExposedTo, and its edges SKM.edge out */
function skSpotExposed(eng, ob, x, y) {
  if (skExposedTo(eng, ob, x, y)) return true;
  const d = Math.hypot(x - ob.x, y - ob.y); if (d > SKM.mask + SKM.edge) return false;
  const ux = (x - ob.x) / (d || 1), uy = (y - ob.y) / (d || 1), geo = eng.geo;
  for (const k of [-1, 1]) {
    const qx = x - uy * SKM.edge * k, qy = y + ux * SKM.edge * k;
    if (Math.hypot(qx - ob.x, qy - ob.y) > SKM.mask || !geo.los(ob.x, ob.y, qx, qy)) continue;
    if (skLegible(eng, ob, qx, qy) >= SKM.legible) return true;
  }
  return false;
}
/* an observer as the creature knows them: a person it sees now (their place, facing and light, as it sees them), or - from a belief - a
 * place with an unknown facing (null) and the light it last saw them with */
function skObsOf(eng, e, r, at) {
  if (r && r.seen && r.visual) {                                                   // (R16: their light's kind as it last saw it - read live only while it sees them)
    const mo = e.mind && e.mind.obs.get(r.id), L = r.light && e.seenNow.has(r.id) ? (eng.lights || []).find(l => l.id === r.id) : null;
    return { x: r.visual.x, y: r.visual.y, angle: r.visual.angle, light: !!r.light, kind: L ? L.kind : mo && mo.kind ? mo.kind : 'flashlight', seen: true };
  }
  if (at) return { x: at.x, y: at.y, angle: null, light: !!(r && r.light), kind: 'flashlight', seen: false };
  return null;
}
/* a fresh mind (at its spawn, and when the engine clears it) */
function skMindNew() { return { obs: new Map(), seen: new Set(), ev: [], evN: {}, sid: 0, miss: 0, wall: 0, planObj: null }; }
/* 'they saw me' for a person: the last time they could see it, while that is fresh (SKM.sawTtl) */
const skSawMe = (eng, e, pid) => { const o = e.mind && e.mind.obs.get(pid); return o && eng.now - o.sawAt <= SKM.sawTtl ? o : null; };
function skEvent(e, now, k, pid, x) { const M = e.mind; M.ev.push({ t: +now.toFixed(2), k, pid: pid || 0, x: x || '', resp: -1, how: '', plan: e.plan ? e.plan.k : '' }); while (M.ev.length > SKM.evMax) M.ev.shift(); M.evN[k] = (M.evN[k] || 0) + 1; }
/* the decision weighed its unanswered events of these kinds and KEPT its plan (a plan that goes on without a sighting, a plan clearly still
 * the best) - or (R13) answered them with a strike: that is its answer too, at this time */
function skMindKept(e, now, kinds, how) { const M = e.mind; if (!M) return; for (const v of M.ev) if (v.resp < 0 && kinds.includes(v.k)) { v.resp = +(now - v.t).toFixed(2); v.how = how || 'kept'; } }
/* a line of its hunt's evidence: seen | heard | inferred | disproved, where and how sure */
function skMindLog(e, H, now, k, x, y, u, note) { if (!H) return; const L = H.log || (H.log = []); L.push([+now.toFixed(1), k, Math.round(x), Math.round(y), Math.round(u || 0), String(note || '').slice(0, 40)]); while (L.length > SKM.logMax) L.shift(); }
/* on its think, before deciding: the people it sees now, whether they could see it, what changed */
function skMindTick(eng, e) {
  const now = eng.now, M = e.mind; if (!M) return;
  // the first change of plan after an event is its response (a plan object replaced, or let go)
  if (e.plan !== M.planObj) { M.planObj = e.plan; for (const v of M.ev) if (v.resp < 0) { v.resp = +(now - v.t).toFixed(2); v.how = 'changed'; } }
  const seenNow = new Set();
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id); if (!r || !r.visual) continue; seenNow.add(id);
    let o = M.obs.get(id);
    if (!o) { o = { pid: id, firstAt: now, seenAt: now, inView: false, sawAt: -99, eyesAt: -99, off: Math.PI, winded: false, near: false }; M.obs.set(id, o); }
    if (!M.seen.has(id)) skEvent(e, now, 'sight', id);
    o.seenAt = now; if (r.light) { const L = (eng.lights || []).find(l => l.id === id); if (L) o.kind = L.kind; }   // (R16: the light it sees them carry, kept)
    const ob = skObsOf(eng, e, r), view = skExposedTo(eng, ob, e.x, e.y), off = Math.abs(angDiff(Math.atan2(e.y - ob.y, e.x - ob.x), ob.angle || 0));
    if (view && !o.inView) skEvent(e, now, 'exposed', id); else if (!view && o.inView) skEvent(e, now, 'hidden', id);
    o.inView = view; if (view) o.sawAt = now;
    if (off < SKM.turnIn && o.off > SKM.turnOut) skEvent(e, now, 'turned', id);
    o.off = off;
    if (view && off < .35) o.eyesAt = now;
    const near = r.dist < SKM.reach; if (near && !o.near) skEvent(e, now, 'reach', id); o.near = near;
    skFatigueSee(eng, e, r, o, now); const wd = skWinded(eng, e, r, now); if (wd && !o.winded) skEvent(e, now, 'winded', id); o.winded = wd;   // (R20: its belief from what it saw and heard - R11-R19 read their stamina)
  }
  for (const id of M.seen) if (!seenNow.has(id)) { skEvent(e, now, 'lost', id); const o = M.obs.get(id); if (o) o.inView = false; }
  M.seen = seenNow;
  for (const [id, o] of M.obs) if (!eng.byId.has(id) || now - o.seenAt > 120) M.obs.delete(id);   // (a person who left the game, or long gone from its thoughts)
  // a new sound (not its own kind's), its own strike's outcome
  const snd = e.mem.sounds[0]; if (snd && snd.id > M.sid) { if (snd.src !== -1) skEvent(e, now, 'sound', snd.pid || 0, Math.round(snd.I * 100) / 100); M.sid = snd.id; }
  if (e.tally.miss > M.miss) skEvent(e, now, 'miss'); M.miss = e.tally.miss;
  if (e.tally.wall > M.wall) skEvent(e, now, 'wall'); M.wall = e.tally.wall;
}
/* the overlay's and the tests' view: the people it sees and whether they could see it; recent events with their response times */
function skMindDbg(eng, e) {
  const M = e.mind; if (!M) return null;
  const obs = [...M.obs.values()].filter(o => eng.now - o.seenAt < 2).map(o => ({ pid: o.pid, view: o.inView ? 1 : 0, saw: +(eng.now - o.sawAt).toFixed(1), eyes: +(eng.now - o.eyesAt).toFixed(1) }));
  return { obs, ev: M.ev.slice(-6).map(v => [v.t, v.k, v.pid, v.resp, v.how]) };
}
/* ---------------------------------------------------------------- THE SKIN-STEALER'S INFERENCE (Trial 3 R12; dev/trial-3-r9-overhaul/)
 * R8 guessed a quarry's way with ONE walk through the level: from its last evidence along their heading, and where something blocked the
 * way a seeded draw chose a side.  The other way existed only as "the other side of the first turn, once the first failed".  R12 keeps the
 * same evidence and the same physics but holds the alternatives openly, as HYPOTHESES (pack 02, "belief and imperfect prediction"):
 *   - from its belief of where they were and which way they moved (seen, or heard: never where they really are), it walks their heading
 *     until the way is blocked; there it lists every opening a person could take (16 directions, adjacent ones merged into one opening,
 *     each opening's way the one nearest their heading), walks each on (later blocks: the turn that keeps the heading best, no draw), and
 *     adds "they stopped or hid near where it last had them".  At most SKI.maxHyp (4) are kept.
 *   - each has a prior: exp(cos of its turn) - R8's own measure of how a person keeps their heading (straight on e, a right angle 1, back
 *     1/e) - and the stop its own weight (more when they were slow or their footsteps stopped).  Normalised, these are its probabilities.
 *   - evidence moves them: a place on a way's own stretch that it searched or waited at and found empty DISPROVES the way (its
 *     probability x .1, kept for the record: a wrong guess has cost it the time it spent); a fresh sound it takes for theirs re-weighs every way by
 *     how well it explains the sound (its nearest point a person could have reached by then, at a person's pace) and the ways far worse
 *     than the best are REJECTED, with the sound named.  The ways stay anchored on its last sighting while sounds and empty places weigh
 *     them; they are listed afresh from a newer sighting, or from its newest evidence once nothing is left of them.
 *   - its bet is still R8's own walk of their way (a seeded error at each turn that INTELLIGENCE shrinks and starvation grows - on the
 *     same scale as these priors); R12 labels each guess with the way it lies on (skHypOf), weighs it by how likely that way now is,
 *     never makes a guess on a way evidence has ruled out, and adds a guess along a likely way none of R8's lies on.
 * Bounded: the ways are listed again only on new evidence and at most every SKI.rebuild s (a few hundred line tests, no route search);
 * the real routes (geo.path) stay in the interception's own check (at most four).  Nothing here reads a player's real place. */
const SKI = Object.freeze({
  maxHyp: 4,                                     // ways on it holds at once
  dirs: 16,                                      // directions tried at a block (adjacent open ones are one opening)
  probe: 210,                                    // px a way must be open for a person to take it
  stopW: .3, stopSlow: 1.4, stopQuiet: .8,       // weight of "they stopped near where it last had them": always; when they were slow; when their footsteps stopped
  disproved: .1,                                 // a disproved way's weight is multiplied by this (kept, not erased)
  soundFit: 90, reject: .2,                      // a sound's fit to a way: px of spread (plus half the sound's fuzz); under this share of the best way's, a way is rejected
  pace: [40, 320],                               // px/s a person may have gone along a way since the evidence (standing still .. running)
  minP: .06,                                     // a way less likely than this is not worth a guess
  onWay: 200,                                    // px: a place this near a way's own stretch lies on that way
  rebuild: .4,                                   // seconds between two listings (bounded work)
  fresh: 4,                                      // seconds of evidence after which an interception is not tried: it cannot get ahead of where they might be
  uWeak: 900,                                    // px: a guess whose uncertainty on its arrival is wider than this is a weak one
});
/* the ways on from a place and a heading (x, y, vx, vy): R12's hypotheses, unweighted by evidence */
function skHypList(eng, e, x0, y0, vx, vy) {
  const geo = eng.geo, sp = Math.hypot(vx, vy), out = [], step = 48, look = SK.predictLook;
  const walk = (x, y, a, d) => geo.lineClear(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, 16, 'walk');
  const norm = a => +(((a % TAU) + TAU) % TAU).toFixed(2);
  const on = (x, y, th, s, pts, turns) => {                                     // walk on; at a block the turn that keeps the heading best
    while (s < look) {
      if (!walk(x, y, th, 100)) {
        if (turns.length >= SK.predictTurns) break;
        let best = null, bc = -2; for (let k = -4; k <= 4; k++) { if (!k) continue; const a = th + k * Math.PI / 8; if (walk(x, y, a, SKI.probe) && Math.cos(k * Math.PI / 8) > bc) { bc = Math.cos(k * Math.PI / 8); best = a; } }
        if (best === null) break; turns.push({ x: Math.round(x), y: Math.round(y), a: norm(best) }); th = best;
      }
      x += Math.cos(th) * step; y += Math.sin(th) * step; s += step; pts.push({ x, y, s });
    }
    return pts;
  };
  if (sp >= 40) {
    const th = Math.atan2(vy, vx); let x = x0, y = y0, s = 0; const pre = [{ x, y, s: 0 }];
    while (s < look && walk(x, y, th, 100)) { x += Math.cos(th) * step; y += Math.sin(th) * step; s += step; pre.push({ x, y, s }); }
    if (s >= look) out.push({ k: 'on', a: norm(th), turn: 0, pts: pre, turns: [], fs: -1, w: Math.exp(1) });
    else {
      // the openings here: runs of adjacent open directions (straight on is blocked, so none wraps round it); a wide one (over 6
      // directions, 135 deg) is split in parts of about four; each opening's way is its direction nearest their heading
      const D = SKI.dirs, runs = []; let cur = null;
      for (let i = 1; i < D; i++) { if (walk(x, y, th + i * TAU / D, SKI.probe)) { if (!cur) runs.push(cur = []); cur.push(i); } else cur = null; }
      const opens = []; for (const R of runs) { const k = R.length <= 6 ? 1 : Math.ceil(R.length / 4), n = Math.ceil(R.length / k); for (let j = 0; j < R.length; j += n) opens.push(R.slice(j, j + n)); }
      for (const R of opens) {
        let bi = R[0]; for (const i of R) if (Math.cos(i * TAU / D) > Math.cos(bi * TAU / D)) bi = i;
        const a = th + bi * TAU / D, c = Math.cos(bi * TAU / D), turns = [{ x: Math.round(x), y: Math.round(y), a: norm(a), n: opens.length }];
        const pts = on(x + Math.cos(a) * step, y + Math.sin(a) * step, a, s + step, pre.concat([{ x: x + Math.cos(a) * step, y: y + Math.sin(a) * step, s: s + step }]), turns);
        if (pts.length >= 5) out.push({ k: c < -.7 ? 'back' : 'turn', a: norm(a), turn: +Math.acos(clamp(c, -1, 1)).toFixed(2), pts, turns, fs: s, w: Math.exp(c) });
      }
    }
  }
  return out;
}
/* the hunt's hypotheses now.  They are ANCHORED on a sighting (its place, heading and time): listed when it last saw them (or, in a hunt
 * begun from a memory, from that), and listed again only from a newer sighting - or, when evidence has ruled out every one, from its
 * newest evidence (a heard place and the heading its sounds gave).  Between, sounds re-weigh them (skHypHeard) and empty places and failed
 * turns disprove them; at most every SKI.rebuild s */
function skHyps(eng, e, H) {
  const now = eng.now; let Y = H.hyp;
  const fresh = Y && H.ev === 'seen' && H.bt > Y.t + 1e-6, dead = Y && !Y.list.some(h => h.f >= 1) && H.bt > Y.t + 1e-6;   // (nothing left of them, and newer evidence to list from)
  if (!Y || ((fresh || dead) && now - Y.at >= SKI.rebuild)) {
    const list = skHypList(eng, e, H.x, H.y, H.vx, H.vy).sort((a, b) => b.w - a.w).slice(0, SKI.maxHyp - 1);
    const sp = Math.hypot(H.vx, H.vy), quiet = H.ev === 'heard' && H.heard >= 2;
    list.push({ k: 'stop', a: null, turn: 0, pts: [{ x: H.x, y: H.y, s: 0 }], turns: [], fs: -1, w: SKI.stopW + (sp < 60 ? SKI.stopSlow : 0) + (quiet ? SKI.stopQuiet : 0) });
    list.forEach((h, i) => { h.id = (Y ? Y.n : 0) + i + 1; h.f = 1; h.lk = 1; h.why = ''; });
    Y = H.hyp = { at: now, t: H.bt, x: H.x, y: H.y, vx: H.vx, vy: H.vy, u: H.u, ev: H.ev, n: (Y ? Y.n : 0) + list.length, list, bet: 0, builds: (Y ? Y.builds : 0) + 1, heard: null };
    e.tally.hypBuild = (e.tally.hypBuild || 0) + 1;
  }
  // what it has found since: an empty place on a way's own stretch - a step clear of its fork (near the fork an empty place says nothing
  // about which way they took: R8's failed turn steers its own walk, not these); the stop: where it last had them - the way is disproved
  // (not erased: the record of what the wrong guess cost)
  for (const h of Y.list) {
    if (h.f < 1) continue;
    const empty = H.failed.find(f => f.t > Y.t && h.pts.some(q => (h.k === 'stop' || q.s > h.fs + SK.failedNear) && Math.hypot(q.x - f.x, q.y - f.y) < SK.failedNear * .75));
    if (empty) { h.f = SKI.disproved; h.why = `found empty at ${empty.x},${empty.y} (${empty.k})`; skMindLog(e, H, now, 'disproved', h.pts[h.pts.length - 1].x, h.pts[h.pts.length - 1].y, 0, `way ${h.id} (${h.k})`); }
  }
  let S = 0; for (const h of Y.list) S += h.w * h.f * h.lk; for (const h of Y.list) h.p = S > 0 ? h.w * h.f * h.lk / S : 0;
  return Y;
}
/* a fresh sound it takes for theirs (before the belief moves to it): how well does each way explain it?  Its nearest point that a person
 * could have reached by then (at SKI.pace) - near the sound, the way is likelier; far, less; much farther than the best (under SKI.reject
 * of its likelihood) it is REJECTED, the sound named.  What the belief does next is skHeardQuarry's (it moves to the sound: the ways are
 * listed again from there) */
function skHypHeard(eng, e, H, q) {
  const Y = skHyps(eng, e, H);                                                       // (its ways as they stand before this sound: listed now if it held none)
  const dt = Math.max(0, q.t - Y.t), fuzz = Y.u + q.u, lo = SKI.pace[0] * dt - fuzz, hi = SKI.pace[1] * dt + fuzz, sg = SKI.soundFit + q.u * .5;
  const live = Y.list.filter(h => h.f >= 1), L = new Map(); let mx = 0;
  for (const h of live) {
    let d = 1e9; for (const p of h.pts) if (p.s >= lo && p.s <= hi) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
    const l = d >= 1e9 ? 0 : Math.exp(-Math.pow(Math.max(0, d - q.u * .5), 2) / (2 * sg * sg)); L.set(h, l); if (l > mx) mx = l;
  }
  if (!(mx > 0)) { Y.heard = { t: +q.t.toFixed(2), fit: 0, of: live.length, shift: 0, x: Math.round(q.x), y: Math.round(q.y) }; return; }   // (none explains it: skFits let it through on the belief's ring alone)
  const p0 = new Map(Y.list.map(h => [h, h.p])); let fit = 0;
  for (const h of live) { const rel = L.get(h) / mx; if (rel < SKI.reject) { h.f = SKI.disproved; h.why = `a sound at ${Math.round(q.x)},${Math.round(q.y)} does not fit it`; } else { fit++; h.lk = Math.max(.05, h.lk * rel); } }
  let S = 0; for (const h of Y.list) S += h.w * h.f * h.lk; for (const h of Y.list) h.p = S > 0 ? h.w * h.f * h.lk / S : 0;
  let shift = 0; for (const h of Y.list) shift = Math.max(shift, h.p - p0.get(h));
  Y.heard = { t: +q.t.toFixed(2), fit, of: live.length, shift: +shift.toFixed(2), x: Math.round(q.x), y: Math.round(q.y) };
  skMindLog(e, H, q.t, 'heard', q.x, q.y, q.u, `fits ${fit} of ${live.length} ways`);
}
/* which of its ways a place lies on: the way whose own stretch (beyond its fork; the stop: where it last had them) passes nearest, within
 * SKI.onWay px - or none (a place on the stretch all its ways share, or off them all) */
function skHypOf(Y, x, y) {
  let best = null, bd = SKI.onWay;
  for (const h of Y.list) for (const q of h.pts) if (q.s > h.fs) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = h; } }
  return best;
}
/* where they would be along a way by now (from its anchor, at a walker's pace; never past its end), on open floor */
function skHypAt(Y, h, now, geo, rc) {
  let i = Math.min(h.pts.length - 1, Math.round(clamp(140 * (now - Y.t) + 150, 250, SK.predictLook) / 48));
  while (i > 2 && !geo.clear(h.pts[i].x, h.pts[i].y, rc, 'walk')) i--;
  return h.pts[i];
}
/* the overlay's and the tests' view: each way, its kind, first turn, probability and why it was ruled out */
function skHypDbg(H) {
  const Y = H && H.hyp; if (!Y) return null;
  return { n: Y.list.length, bet: Y.bet, builds: Y.builds, from: Y.ev, heard: Y.heard || null, ways: Y.list.map(h => [h.id, h.k, h.a, +h.p.toFixed(2), h.why]) };
}
/* ---------------------------------------------------------------- THE SKIN-STEALER'S COVER (Trial 3 R13; dev/trial-3-r9-overhaul/)
 * The owner's complaint (October 22): it sneaks in front of the player into its hiding place.  R9 found why (R9_AUDIT.md H1-H4): R8 checked
 * only that the END of a flank was out of the person's sight, priced the cells they could see at a small finite cost, refused every route
 * longer than 2.6 x their distance - so the hidden ways round (2.3-3 x as long) were never taken - and never looked again on the way.
 * This part plans a COVERT WAY so that it is one, and refuses one that is not:
 *   - THE VIEWS IT KNOWS OF (skWatchers): every person it sees now, and every person it saw within SKC.recent s (where they stood, as it
 *     saw them - it may have turned its back), by the rules of their own screen (R11's skExposedTo: their sight mask, a clear line,
 *     readable light) - these it is sure of; and, for the person it hunts if it has not seen them lately, their view from its belief (a
 *     place, the facing unknown) - a suspicion.  Never a player's real place for anybody it does not see.
 *   - THE WITHDRAWAL: starting in somebody's view, it first goes straight away from them (their bearing kept within SKC.exitCone, farther
 *     from them all the way), at most SKC.exitMax px, to the first point none of them can see - the way a creature backs off, never across
 *     their front.  With no such point there is no covert way ('no_exit').
 *   - THE HIDDEN WAY: A* on the level's own grid from there, where a cell anybody it is sure of could see (with SKC.margin px to spare across
 *     the line of sight) is IMPASSABLE, and a cell only suspected to be in view costs SKC.suspect more.
 *   - THE AUDIT: the whole way is walked every SKC.sample px and every view it knows of is tested again with the true body rule.  A way is
 *     COVERT only if after the withdrawal no point is in a view it is sure of, at most SKC.suspectMax px lie in a view it only suspects,
 *     and it is no longer than SKC.coverMax; otherwise it is refused with the reason (no_exit, no_cover, route_exposed, route_suspected,
 *     too_long) - the cost is never lowered until an exposed way wins.
 *   - FOLLOWING IT (skCovertFollow): its own steering along the way's points with a short look-ahead (it cuts no corner into a view), and
 *     no re-planning with a softer cost: stuck, it asks for a new covert way or gives up the covert move.
 * Bounded: one A* of at most SKC.nodes nodes per way asked for (a flank asks for at most SKC.tries), each cell's views tested once per way
 * (memo), the audit a few dozen points. */
const SKC = Object.freeze({
  recent: 1.5,                                   // s: a person it saw this recently is still a view it is sure of (where it saw them)
  eyesTurn: 2,                                   // s: a person who met its eyes this recently may turn their torch anywhere
  exitMax: 240,                                  // px: the longest withdrawal it may make in a person's view before its way must be hidden
  exitCone: .4,                                  // rad: a withdrawal keeps its bearing from them within this
  suspect: 260,                                  // A* cost of a cell in a view it only suspects
  suspectMax: 144,                               // px of a covert way it may cross in a view it only suspects
  sample: 24,                                    // px between the audit's points
  margin: 34,                                    // px: the A* keeps this far (across the line of sight) from the edge of a view; the audit tests the true body (18)
  nodes: 3500,                                   // A* nodes for one covert way (only cells a way short enough could pass through are searched: below)
  coverMax: 2200,                                // px: the longest covert way it takes
  tries: 3,                                      // flank spots it asks a covert way for, at most
  look: 40,                                      // px: its look-ahead along a covert way
  sprintFrom: 96,                                // px: this far into the hidden part of a covert way it may run
  settle: 220,                                   // px: this near the end it slows to a stalk (it arrives quietly)
  rush: 360,                                     // px: from cover it breaks out openly at a person this close (an open act, telegraphed)
  moved: 150,                                    // px: they moved this far from where its ambush point was chosen for them: it thinks again
  rushFor: 2.2,                                  // s: a rush from cover goes on this long toward where they were, unseen
  ambushHungry: 2.5,                             // s: very hungry, it waits in ambush this long before it breaks cover (if they are near)
  suspectTtl: 10,                                // s: a belief older than this is no view at all
  heardFresh: 1,                                 // s: somebody heard this recently, from a place that could see it, catches it on its covert way
  glance: [1.4, .4, 1.3],                        // on the hidden part of a covert way it looks back: every [0] s, for [1] s, its head turned up to [2] rad
});
/* the views it knows of: the people it sees or saw within SKC.recent s (sure: where it saw them, facing and light as it saw them), or heard
 * within SKC.heardFresh s since it last saw them (sure: where it heard them, their light able to point anywhere) and, for the person it
 * hunts if it has none of these, a view from its belief (a suspicion) */
function skWatchers(eng, e, pid, at) {
  const out = [], now = eng.now;
  for (const r of e.mem.p.values()) {
    if (!eng.byId.has(r.id) || (r.visual && (!r.visual.alive || r.visual.caught))) continue;
    if (!e.seenNow.has(r.id) && r.heardAt > r.seenAt && now - r.heardAt <= SKC.heardFresh) {   // (heard since it last saw them: there, facing unknown)
      const ob = skObsOf(eng, e, Object.assign({}, r, { seen: false }), { x: r.hx, y: r.hy }); ob.pid = r.id; ob.seen = true; out.push(ob); continue;
    }
    if (!r.visual || !(e.seenNow.has(r.id) || now - r.seenAt <= SKC.recent)) continue;
    const ob = skObsOf(eng, e, Object.assign({}, r, { seen: true })); ob.pid = r.id;
    const mo = e.mind && e.mind.obs.get(r.id); if (mo && now - mo.eyesAt < SKC.eyesTurn) ob.angle = null;   // (somebody watching it will turn their light on it: their torch may point anywhere)
    out.push(ob);
  }
  // (footsteps it cannot put a name to, just now: somebody is there - their view counts, their light able to point anywhere)
  for (const q of e.mem.sounds) if (q.src === 0 && now - q.t <= SKC.heardFresh && !out.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 120)) out.push({ x: q.x, y: q.y, angle: null, light: true, kind: 'flashlight', seen: true, pid: 0 });
  if (pid && !out.some(o => o.pid === pid)) {
    const r = e.mem.p.get(pid), H = e.hunt && e.hunt.pid === pid ? e.hunt : null;
    const place = at || (H && now - H.bt < SKC.suspectTtl ? { x: H.x, y: H.y } : r && now - Math.max(r.seenAt, r.heardAt) < SKC.suspectTtl ? { x: r.lkx, y: r.lky } : null);
    if (place) { const ob = skObsOf(eng, e, r, place); ob.pid = pid; ob.seen = false; out.push(ob); }
  }
  // (R16) every watcher's view is lit by the torches of the people it sees now as well as their own (the screen draws every wanderer's light)
  const lights = out.filter(o => o.pid && o.light && e.seenNow.has(o.pid));
  if (lights.length) for (const o of out) { const others = lights.filter(L => L !== o); if (others.length) o.lights = others; }
  return out;
}
/* the people it is sure of who could see it where it stands now (by their screen's rules) */
function skExposedNow(eng, e) { return skWatchers(eng, e, 0).filter(ob => skExposedTo(eng, ob, e.x, e.y)).map(ob => ob.pid); }
/* on a covert way, is it caught?  Anybody it is sure of who can see it now - seen, seen a moment ago, or HEARD since from a place that
 * could see it (skWatchers: footsteps at the mouth of its passage tell it it is watched, though it cannot see behind it).  Never a
 * player's real place */
function skCaught(eng, e) { return skExposedNow(eng, e); }
/* a covert way from where it is to (gx, gy): { ok, why, pts, len, exit, susp } - see the part's head */
function skCovertWay(eng, e, gx, gy, obs, maxLen) {
  const geo = eng.geo, sx = e.x, sy = e.y, sure = obs.filter(o => o.seen), guess = obs.filter(o => !o.seen);
  e.tally.coverQ = (e.tally.coverQ || 0) + 1;
  // (the A*'s test of a cell: the body's own three points across the line of sight and two wider, so that a way between cell centres keeps
  // clear of the edge of a view; the audit then tests the true body)
  const sees = (o, x, y) => {
    const d = Math.hypot(x - o.x, y - o.y); if (d > 700 + SKC.margin) return false;
    const ux = (x - o.x) / (d || 1), uy = (y - o.y) / (d || 1);
    for (const k of [0, -18, 18, -SKC.margin, SKC.margin]) { const qx = x - uy * k, qy = y + ux * k; if (Math.hypot(qx - o.x, qy - o.y) <= 700 && geo.los(o.x, o.y, qx, qy) && skLegible(eng, o, qx, qy) >= .25) return true; }   // (the line first: most cells it tests are behind a wall)
    return false;
  };
  // the withdrawal: straight away from everybody who can see it now, to the first point none of them can (and one step more)
  const by = sure.filter(o => skExposedTo(eng, o, sx, sy));
  let ex = sx, ey = sy, exit = 0;
  if (by.length) {
    let ux = 0, uy = 0; for (const o of by) { const d = Math.hypot(sx - o.x, sy - o.y) || 1; ux += (sx - o.x) / d; uy += (sy - o.y) / d; }
    const a0 = Math.atan2(uy, ux); let got = null;
    for (const da of [0, .2, -.2, .35, -.35]) {
      const a = a0 + da, cx = Math.cos(a), cy = Math.sin(a);
      if (by.some(o => Math.abs(angDiff(a, Math.atan2(sy - o.y, sx - o.x))) > Math.PI / 2 - .2)) continue;   // (never toward or across anybody)
      for (let m = SKC.sample; m <= SKC.exitMax; m += SKC.sample) {
        const x = sx + cx * m, y = sy + cy * m;
        if (!geo.lineClear(sx, sy, x, y, e.rc + 2, 'walk')) break;
        if (!by.every(o => Math.hypot(x - o.x, y - o.y) >= Math.hypot(sx - o.x, sy - o.y) + .5 * m - 4 && Math.abs(angDiff(Math.atan2(y - o.y, x - o.x), Math.atan2(sy - o.y, sx - o.x))) < SKC.exitCone)) break;
        if (!sure.some(o => sees(o, x, y))) { const m2 = Math.min(SKC.exitMax, m + SKC.sample), x2 = sx + cx * m2, y2 = sy + cy * m2; got = geo.lineClear(sx, sy, x2, y2, e.rc + 2, 'walk') ? { x: x2, y: y2, m: m2 } : { x, y, m }; break; }
      }
      if (got) break;
    }
    if (!got) return { ok: false, why: 'no_exit' };
    ex = got.x; ey = got.y; exit = got.m;
  }
  // (R13 perf) a cell no way short enough could pass through (its straight distances from the start of the search and to the goal already
  // longer than the longest way it would take) is never searched: a way it would take is found exactly as before, and a search for a way it
  // could not have taken ends early - without it, a search that found nothing cost 30-100 ms in one step
  const lim = Math.min(SKC.coverMax, maxLen || Infinity) - exit + 1;
  const memo = obs.memo || (obs.memo = new Map());                               // (a cell's cost depends only on the views: one memo for every way to the same views)
  const cost = j => {
    const x = geo.cx(j), y = geo.cy(j);
    if (Math.hypot(x - ex, y - ey) + Math.hypot(gx - x, gy - y) > lim) return Infinity;
    let c = memo.get(j); if (c !== undefined) return c;
    c = (geo.lamp[j] || 0) * 60;
    for (const o of sure) if (sees(o, x, y)) { c = Infinity; break; }
    if (c !== Infinity) for (const o of guess) if (sees(o, x, y)) c += SKC.suspect;
    memo.set(j, c); return c;
  };
  const m0 = memo.size, raw = geo.path(ex, ey, gx, gy, e.caps, { cost, maxNodes: SKC.nodes });
  if (!raw) return { ok: false, why: 'no_cover', exit, grew: memo.size - m0 };   // (grew: the cells it had to test - near SKC.nodes, the search ran out)
  if (raw.some(q => q.link)) return { ok: false, why: 'no_cover', exit };     // (a vault is a long exposed act of its own: not on a covert way)
  const pts = (exit ? [{ x: ex, y: ey, exit: 1 }] : []).concat(raw.map(q => ({ x: q.x, y: q.y })));
  // the audit, along the whole way
  let len = 0, exposed = 0, susp = 0, px = sx, py = sy, seenAt = null;
  for (const q of pts) {
    const L = Math.hypot(q.x - px, q.y - py), n = Math.max(1, Math.ceil(L / SKC.sample));
    for (let k = 1; k <= n; k++) {
      const x = px + (q.x - px) * k / n, y = py + (q.y - py) * k / n; len += L / n;
      if (len > exit + 1 && sure.some(o => skExposedTo(eng, o, x, y))) { exposed += L / n; if (!seenAt) seenAt = [Math.round(x), Math.round(y), Math.round(len)]; }
      for (const o of guess) if (skExposedTo(eng, o, x, y)) susp += L / n;
    }
    px = q.x; py = q.y;
  }
  const why = exposed ? 'route_exposed' : susp > SKC.suspectMax ? 'route_suspected' : len > Math.min(SKC.coverMax, maxLen || Infinity) ? 'too_long' : '';
  return { ok: !why, why, pts, len: Math.round(len), exit: Math.round(exit), exposed: Math.round(exposed), susp: Math.round(susp), seenAt, cells: memo.size };
}
/* along a covert way: its own steering toward a point SKC.look px ahead on the way (no corner cut into a view), no re-planning.  Returns
 * 'moving' | 'arrived' | 'stuck' */
function skCovertFollow(eng, e, P, vmax, dt) {
  const W = P.way, pts = W.pts; if (P.wi === undefined) P.wi = 0;
  while (P.wi < pts.length - 1 && Math.hypot(pts[P.wi].x - e.x, pts[P.wi].y - e.y) < 26) P.wi++;
  const end = pts[pts.length - 1]; if (P.wi >= pts.length - 1 && Math.hypot(end.x - e.x, end.y - e.y) < 30) { e.speed = 0; return 'arrived'; }
  let left = SKC.look, ax = e.x, ay = e.y, tx = pts[P.wi].x, ty = pts[P.wi].y;
  for (let k = P.wi; k < pts.length; k++) { const q = pts[k], d = Math.hypot(q.x - ax, q.y - ay); if (d >= left) { tx = ax + (q.x - ax) * left / d; ty = ay + (q.y - ay) * left / d; break; } left -= d; ax = tx = q.x; ay = ty = q.y; }
  if (P.pwi !== P.wi) { e.path = pts.slice(P.wi); P.pwi = P.wi; } e.carrot = { x: tx, y: ty };   // (its route, for the overlay; nothing else follows it)
  steerTo(eng, e, tx, ty, vmax, dt, { turnMul: 1.6 });
  return e.stuck > .9 ? 'stuck' : 'moving';
}
/* ---------------------------------------------------------------- PLAN INTERRUPTION AND PREEMPTION (Trial 3 R16d; dev/trial-3-r9-overhaul/)
 * The owner (October 22, the additional refinement): a Skin-Stealer kept walking to where it was going after it had plainly seen a
 * player; it must reassess at once when something important happens, without dropping a tactic that still makes sense and without
 * replanning on every flicker.  AP_AUDIT.md found why: a person it had left was hidden from its hunting for 30-60 s whatever its hunger,
 * and a departure went on past new prey.  This part is the policy, read on every think (10 Hz near) whatever the route's progress:
 *   CLASSES   committed - its wind-up, leap and recovery, a capture, a kill playing: never cut (they are physics and fairness);
 *             low - no plan (roaming, a roam's pause), a departure (not a fast one after a missed defence, not one after a lost race - it
 *             is tired - nor while exhausted), a search or a listen about nobody it has named: cut by any significant event;
 *             tactical - approach, flank, intercept, lure, ambush, chase, retreat, watch, a hunt's search or listen, a walk in a skin: kept
 *             while they still make sense (skDecide's own weighing, with its hysteresis SK.rethink), and given up when they no longer do.
 *   EVENTS    a VIABLE person newly seen (first seen, or seen again after SKP.regain seconds out of sight) - viable: one it may hunt now
 *             (skMayHunt, hunger-dependent below; R16e: and only from the hunger it hunts at, SK.band[1] - a sated departure is not cut by
 *             a passer-by: s_skinbehave BR01); and the quarry of a lure or an ambush seen going away from it, not coming, for
 *             SKP.awayFor seconds (the wait has lost its point).
 *   ANSWER    a low-priority plan is ended on the think the event is perceived and the decision runs at once (no dwell, no once-a-second);
 *             a tactical plan that has lost its point is flagged for skDecide to weigh afresh (its hysteresis does not keep a plan that
 *             no longer makes sense).  Each person forces at most one reassessment every SKP.again seconds: evidence that keeps arriving
 *             (a person flickering at the edge of its view) cannot make it replan in a loop.  Nothing here touches its memory, its
 *             hunt or its beliefs: only which plan runs.  Every interruption is logged (its mind's events, e.dbg.preempt): what it
 *             perceived, which plan it cut or kept, and why.
 *   WHO       a person it left (skLeave) is left for skLeftFor(hunger) seconds - the hungrier, the shorter (selective when fed, single-
 *             minded when starving) - and may be taken up again on fresh sight once skRefractory(hunger) has passed since it left them,
 *             within the effort it has left for them (skMayHunt).  Never on hunger alone: it must see them. */
const SKP = Object.freeze({
  regain: 1.2,                                   // seconds out of sight after which seeing a person again is a new sighting
  again: .6,                                     // seconds between two forced reassessments about the same person
  awayFor: 1.5,                                  // seconds a lure's or an ambush's quarry is seen going away before the wait is given up
  awayV: 60,                                     // px/s away from it that counts as going away (not coming)
  left: [[.6, 8], [.8, 4], [1.01, 2]],           // from SK.huntHunger (skLeave; fed, SK.cooldown): hunger under -> seconds it leaves a person alone (R18; R16d 15/8/4, R8: 30-60, starving 12)
  refr: [[.3, 1e9], [.45, 8], [.7, 4], [1.01, 2]],            // hunger under -> seconds after leaving before fresh sight may take them up (R18; R16d .4/1e9, .6/10, .8/6, 3)
});
const SKP_LOW = new Set(['leave']), SKP_TACT = new Set(['approach', 'flank', 'intercept', 'lure', 'ambush', 'chase', 'retreat', 'watch', 'mingle']);
const skStep = (T, h) => { for (const [lim, v] of T) if (h < lim) return v; return T[T.length - 1][1]; };
const skLeftFor = h => skStep(SKP.left, h);
const skRefractory = h => skStep(SKP.refr, h);
/* the class of what it is doing now */
function skPlanClass(e) {
  if (e.pounce || e.recover > 0 || e.cap || e.commit) return 'committed';
  const P = e.plan; if (!P) return 'low';
  if (P.k === 'leave') return P.fast || P.race || e.exh ? 'tactical' : 'low';   // (a fast or tired departure goes on: it has a reason that sight does not change)
  if (P.k === 'feed') return 'feed';                                            // (its meal: disturbed by what skDecide already weighs)
  if ((P.k === 'search' || P.k === 'listen') && !P.pid) return 'low';          // (about a sound nobody was named for)
  return SKP_TACT.has(P.k) || P.k === 'search' || P.k === 'listen' ? 'tactical' : 'low';
}
/* on its think, before the decision: did anything happen that cuts or questions the plan?  mayHunt: skMayHunt (who it may hunt now).
 * Returns the reason when the decision must weigh afresh (e.pre.force), or '' */
function skPreempt(eng, e, mayHunt) {
  const now = eng.now, P = e.plan, cls = skPlanClass(e), M = e.pre || (e.pre = { seen: new Map(), forced: new Map(), force: '', n: 0 });
  M.force = '';
  // who it sees now, and who is new to its eyes (first seen, or seen again after a while out of sight)
  // (R16g, the review: a person it saw at its last think before a gap in its thinking - a strike, a capture, a kill playing - is not new
  // for that gap alone)
  let fresh = null; const gap = M.at !== undefined && now - M.at > SKP.regain; M.atPrev = M.at; M.at = now;
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id), last = M.seen.get(id); M.seen.set(id, now);
    if (!r || !r.visual || r.visual.caught || !r.visual.alive) continue;
    const isNew = last === undefined || (now - last > SKP.regain && !(gap && last >= M.atPrev - 1e-6));
    if (isNew && mayHunt(r) && (!fresh || r.dist < fresh.dist)) fresh = r;
  }
  for (const [id, t] of M.seen) if (now - t > 30 || !eng.byId.has(id)) M.seen.delete(id);
  const may = !!fresh && now - (M.forced.get(fresh.id) ?? -99) >= SKP.again;
  // kept, and said so: a committed action (physics and fairness - a guard only: skinTick does not think during one, P04), and a departure
  // with a reason sight does not change
  if (cls === 'committed' || (P && P.k === 'leave' && cls === 'tactical')) {
    if (may) {
      M.forced.set(fresh.id, now); M.kept = (M.kept || 0) + 1;
      const what = cls === 'committed' ? (e.commit ? 'kill' : e.cap ? 'capture' : e.recover > 0 ? 'recovery' : e.pounce && e.pounce.t < e.pounce.wind ? 'wind-up' : 'leap') : 'departure';
      e.dbg.preempt = { at: +now.toFixed(2), from: cls === 'committed' ? what : 'leave', cls, kept: 1, why: `P${fresh.id} seen: its ${what} goes on (${cls === 'committed' ? 'committed' : P.fast ? 'its defence missed' : P.race ? 'it lost a race' : 'exhausted'})` };
    }
    return '';
  }
  let why = '';
  if (may) {
    if (cls === 'low') why = `P${fresh.id} seen: ${P ? 'its ' + P.k : 'its roaming'} gives way`;
    else if (P && P.pid !== fresh.id) why = `P${fresh.id} seen: its ${P.k} about ${P.pid ? 'P' + P.pid : 'nobody'} goes on while it still makes sense (weighed against them on this think)`;
    if (why) M.forced.set(fresh.id, now);
  }
  // a lure's or an ambush's quarry, seen going away from it (not coming) for a while: the wait has lost its point
  if (!why && P && (P.k === 'lure' || P.k === 'ambush') && P.pid && e.seenNow.has(P.pid)) {
    const r = e.mem.p.get(P.pid), v = r && r.visual;
    const away = v ? ((v.x - e.x) * v.vx + (v.y - e.y) * v.vy) / Math.max(1, r.dist) : 0;
    const gap = now - (P.awayAt ?? now);                                            // (only the time it watched them go counts: a spell out of its sight adds nothing)
    if (away > SKP.awayV) P.awayT = (P.awayT || 0) + (gap <= .5 ? gap : 0); else P.awayT = 0;
    P.awayAt = now;
    if (P.awayT >= SKP.awayFor && now - (M.forced.get(P.pid) ?? -99) >= SKP.again) { why = `P${P.pid} is going away from its ${P.k}: the wait has lost its point`; M.forced.set(P.pid, now); }
  }
  for (const [id, t] of M.forced) if (now - t > 30) M.forced.delete(id);
  if (!why) return '';
  M.force = why; M.n++;
  e.dbg.preempt = { at: +now.toFixed(2), from: P ? P.k : 'roam', cls, why };
  if (e.mind) { e.mind.ev.push({ t: +now.toFixed(2), k: 'preempt', pid: fresh ? fresh.id : P ? P.pid : 0, x: why.slice(0, 60), resp: -1, how: '', plan: P ? P.k : '' }); while (e.mind.ev.length > 24) e.mind.ev.shift(); e.mind.evN.preempt = (e.mind.evN.preempt || 0) + 1; }
  if (cls === 'low') {                                                              // cut now: the decision runs on this think with nothing to keep
    if (P) { if (P.k === 'leave') e.tally.reconsider++; e.plan = null; e.path = []; }
    e.roam.pause = 0; if (e.rx) skReactEnd(eng, e, false);                          // (R16g, the review: a reaction is ended as its own end does - state and warning kept right)
  }
  return why;
}
/* ---------------------------------------------------------------- ITS EYES (Trial 3 R16e; dev/trial-3-r9-overhaul/)
 * The owner (October 22, the additional refinement, sections 3, 4 and 6): it should snap its head to a sound or a movement, turn its body
 * when the head cannot reach, and go to where it could see what it heard - and the server's sight must turn with the head the players see.
 * AP_AUDIT.md found: under every plan but roaming its head was held straight; a sound turned it only by B1's look (the body, at 3.2 rad/s)
 * and only with no plan; its head turned at dt x 5 (about 0.6 s to 95 %) and only 1 rad; movement just outside its view was never noticed;
 * after a sound it went to the sound's own fuzzy place.  This part:
 *   STIMULI   a sound it hears (anonymous, or of somebody it does not see now), on the tick it is heard, its head starting SKL.latency
 *             after it; movement at the edge of its view (skPeriph: a person moving outside its field of view but within SKL.periph of
 *             it, near enough to make out there - the same eyes, light, posture, motion and walls as its sight), on its think; a person
 *             newly in its sight who is not its plan's quarry.  A movement gives no identity: only an approximate place.  Nothing reads a
 *             person it does not sense.
 *   THE HEAD  snaps toward the stimulus at SKL.snap rad/s, easing in at the end, up to SKL.headMax either side of its body (R8: 1), and
 *             holds it SKL.hold seconds; then the plan's own head (its gaze, its listening sway) takes over from where it is.  Under a
 *             plan whose quarry it sees, the head never turns so far that the quarry leaves its view.  Never during a strike or a kill.
 *             The engine's sight is centred on e.ang + e.head, the snapshot carries e.head: what the players see is what it sees.
 *   THE BODY  beyond the head's reach, SKL.bodyAfter seconds after the head began, the body turns where it is free to, at the species'
 *             own turning (skTurnRate: TURNING_ABILITY, 3.6 rad/s standing, less the faster it moves - R16g, the review: R16e used 5):
 *             roaming (it stops), a hunt's listening, a search's look round where it arrived; on a listen after a sound it faces the sound at
 *             the same rate.  On the move under a plan the head alone turns: the plan steers the body.
 *   WHERE TO LOOK FROM  after a sound it cannot see the source of, it goes to the nearest point on open floor from which it would make
 *             out somebody standing unlit at that place - its own sight's rules: the light there, the distance, the walls (skVantage) -
 *             not to the place itself, and looks at it from there (SKL.lookFrom); seeing nothing, it goes on to the place itself.
 * Cost: per tick a few multiplications; on a think, one visual test for each person moving outside its view (the shared sight's own
 * rays); a vantage search (70 points at most, a clear-floor test and a sight test each) only when a sound sends it to look. */
const SKL = Object.freeze({
  headMax: 1.25,                                 // rad either side of its body the head turns (R8: 1)
  snap: 13, ease: 25,                            // rad/s a snap turns the head at; the rate (1/s) it eases in over the last SKL.easeIn rad
  free: 8,                                       // rad/s the head turns at most otherwise (its plan's gaze, sway, glance)
  easeIn: .2,
  latency: [.05, .09],                           // seconds from hearing a sound to its head starting to turn (on a think: the think's own phase)
  bodyAfter: .1,                                 // seconds after the head starts before the body follows (beyond the head's reach)
  reach: .85,                                    // the body follows once the stimulus is beyond this share of the head's reach
  hold: { sight: .6, motion: .9, sound: .9 },    // seconds the head holds a stimulus
  prio: { sight: 3, motion: 2, sound: 1 },
  same: .35,                                     // rad: a stimulus within this of the one it holds (and under .4 s old) does not start a new snap
  soundI: .06,                                   // the faintest sound that turns its head
  periph: .9, periphV: 70, periphS: .466,        // rad beyond its view's edge it notices movement; px/s that counts as movement; the sight strength
                                                 //  needed there (.466: within .75 of the distance it would make that person out at)
  periphMax: 600,                                // px: and never farther (the edge of an eye sees movement, not detail, and not far)
  keep: .12,                                     // rad inside its view's edge its plan's quarry is kept
  lookFrom: [.5, .9],                            // seconds it looks at the place from its point to look from, before it goes closer
});
/* (R16g) its body's turn: the species' own turning ability, as the shared steering turns it (TURNING_ABILITY, less the faster it moves) */
function skTurnRate(e, v = e.speed) { return e.caps.TURNING_ABILITY * (1 - (e.sp.turnPenalty || .55) * clamp((v || 0) / (e.sp.vTop || 300), 0, 1)); }
/* a stimulus: where, when the head starts, how long it holds, why */
function skStim(eng, e, k, x, y, go, why) {
  const L = e.look, now = eng.now, b = Math.atan2(y - e.y, x - e.x);
  if (L.k && now < L.until && SKL.prio[L.k] > SKL.prio[k]) return false;                          // (holding something that matters more)
  if (L.k && now < L.until && Math.abs(angDiff(b, Math.atan2(L.y - e.y, L.x - e.x))) < SKL.same && now - L.t0 < .4) return false;   // (the same thing, still)
  Object.assign(L, { k, x, y, t0: now, go, until: go + SKL.hold[k], why, body: -1 });
  if (L.h === undefined || L.h === null) L.h = e.head || 0;
  e.dbg.look = { k, at: +now.toFixed(2), go: +go.toFixed(2), x: Math.round(x), y: Math.round(y), why };
  return true;
}
/* (R16e) movement at the edge of its view: the nearest person moving outside its field of view but within SKL.periph of its edge, whom
 * its eyes turned there would make out within .75 of their range and SKL.periphMax (the shared sight's own light, posture, motion and wall tests); an
 * approximate place, never who.  Near level of detail only (the engine's own candidates for its sight) */
function skPeriph(eng, e) {
  if (e.tier !== 'near') return null;
  const half = e.sp.vision.fov / 2, view = e.ang + (e.head || 0); let best = null;
  for (const p of eng.candidates(e, 1750)) {
    if (!p.alive || e.seenNow.has(p.id) || (p.sp || 0) < SKL.periphV) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), b = Math.atan2(dy, dx), off = Math.abs(angDiff(b, view));
    if (d > SKL.periphMax || off <= half || off > half + SKL.periph) continue;
    const eye = Object.create(e); eye.head = angDiff(b, e.ang);                                   // (the same eyes, turned to it)
    const o = visualObservation(eye, eng, p); if (!o.vis || o.strength < SKL.periphS) continue;
    if (!best || d < best.d) best = { d, x: p.x, y: p.y };
  }
  if (!best) return null;
  const u = 20 + best.d * .08, a = e.lookRng() * TAU, m = Math.sqrt(e.lookRng()) * u;           // (where: roughly - its own stream)
  return { x: best.x + Math.cos(a) * m, y: best.y + Math.sin(a) * m, u };
}
/* on its think: movement at the edge of its view; a person newly in its sight who is not its plan's quarry.  Returns the movement (for
 * the decision: a hungry roamer goes to look, as at a strong sound) */
function skLookThink(eng, e) {
  const L = e.look, now = eng.now, P = e.plan;
  const prev = L.seen || new Set(); L.seen = new Set(e.seenNow);
  if (e.pounce || e.recover > 0 || e.commit || e.cap) return null;
  for (const id of e.seenNow) if (!prev.has(id) && !(P && P.pid === id)) {
    const r = e.mem.p.get(id); if (r && r.visual) { skStim(eng, e, 'sight', r.visual.x, r.visual.y, now, `P${id} came into its sight`); break; }
  }
  const m = skPeriph(eng, e);
  if (m && skStim(eng, e, 'motion', m.x, m.y, now, 'something moved at the edge of its view')) { e.tally.periph = (e.tally.periph || 0) + 1; L.m = Object.assign({ t: now }, m); return m; }
  return null;
}
/* (R16e) where to look from: the nearest point on open floor from which it would make out somebody standing unlit at (x, y) - by its own
 * sight's rules there (the light at that place, the distance, the walls: the shared visualObservation, asked of a person who is not
 * there), and a little beyond it on the far side (u: how roughly it placed the sound) - round the place (four rings) and on the straight
 * way to it; null when it could make them out from where it stands */
function skVantage(eng, e, x, y, u = 0) {
  const geo = eng.geo, m = Math.min(u * .6, 120);
  const sees = (px, py) => {                                                                     // (and a little beyond it: where it heard them is only roughly where they are)
    const d = Math.hypot(x - px, y - py) || 1, fx = x + (x - px) / d * m, fy = y + (y - py) / d * m, far = m > 0 && geo.clear(fx, fy, 14, 'walk');
    const who = { id: -1, x: far ? fx : x, y: far ? fy : y, alive: true, st: 0, sp: 0, light: false, prof: 1 };
    const eye = Object.create(e); eye.x = px; eye.y = py; eye.act = 'search'; eye.head = angDiff(Math.atan2(who.y - py, who.x - px), e.ang);
    return visualObservation(eye, eng, who).vis;
  };
  if (sees(e.x, e.y)) return null;
  let best = null, bs = 1e9;
  const at = (px, py) => { const d = Math.hypot(px - e.x, py - e.y); if (d >= bs || !geo.clear(px, py, e.rc + 2, 'walk') || !sees(px, py)) return; bs = d; best = { x: px, y: py }; };
  for (const R of [90, 150, 220, 300]) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; at(x + Math.cos(a) * R, y + Math.sin(a) * R); }
  for (let k = 1; k <= 6; k++) at(e.x + (x - e.x) * k / 7, e.y + (y - e.y) * k / 7);
  return best;
}
/* every tick, after its plan has moved it: a sound just heard; the head's snap; the body where it is free to turn.  Whoever moved the head
 * this tick (a snap, or its plan's own sway, gaze or glance), it never turns faster than SKL.snap in a snap and SKL.free otherwise */
function skHeadStep(eng, e, dt) {
  const L = e.look, prev = L.prev ?? (e.head || 0);
  skSnap(eng, e, dt);
  const lim = L.k && eng.now >= L.go && eng.now < L.until ? SKL.snap : SKL.free;
  e.head = clamp(e.head || 0, prev - lim * dt, prev + lim * dt); L.prev = e.head;
}
function skSnap(eng, e, dt) {
  const L = e.look, now = eng.now, P = e.plan;
  const q = e.mem.sounds[0];
  if (q && q.id > (L.sid || 0)) {
    L.sid = q.id;
    if (q.src !== -1 && q.I >= SKL.soundI && now - q.t < .3 && !(q.pid && e.seenNow.has(q.pid)) && !(e.pounce || e.recover > 0 || e.commit || e.cap))
      skStim(eng, e, 'sound', q.x, q.y, q.t + SKL.latency[0] + (SKL.latency[1] - SKL.latency[0]) * e.lookRng(), `it heard ${q.type || 'something'}`);
  }
  if (!L.k || now >= L.until || e.pounce || e.recover > 0 || e.commit || e.cap) { if (L.k && now >= L.until) { L.k = ''; L.h = null; } return; }
  if (now < L.go) { L.h = e.head || 0; return; }                                                  // (its reaction time: the plan's head until then)
  const b = Math.atan2(L.y - e.y, L.x - e.x);
  // the body first: beyond the head's reach, where it is free to turn (roaming it stops to; a search's look round turns its way)
  const free = !e.rx && !e.disguise && (!P || (P.k === 'listen' && !P.curious) || (P.k === 'search' && P.looked));
  if (free && Math.abs(angDiff(b, e.ang)) > SKL.headMax * SKL.reach && now - L.go >= SKL.bodyAfter) {
    if (L.body < 0) { L.body = now; e.dbg.look.body = +now.toFixed(2); }
    const tr = skTurnRate(e);
    if (!P) { if (e.roam && e.roam.goal) { e.roam.pause = Math.max(e.roam.pause, L.until - now); setAct(e, 'watch'); } turnTo(e, b, tr, dt); }
    else if (P.k === 'search') P.look0 = (P.look0 + clamp(angDiff(b, P.look0), -tr * dt, tr * dt) + TAU) % TAU;
    else turnTo(e, b, tr, dt);
  }
  // the head: toward it, within its reach - and, under a plan whose quarry it sees, never so far that the quarry leaves its view
  const rel = angDiff(b, e.ang); let lo = -SKL.headMax, hi = SKL.headMax;
  if (P && P.pid && e.seenNow.has(P.pid)) {
    const r = e.mem.p.get(P.pid); if (r && r.visual) { const qb = angDiff(Math.atan2(r.visual.y - e.y, r.visual.x - e.x), e.ang), w = e.sp.vision.fov / 2 - SKL.keep; lo = Math.max(lo, qb - w); hi = Math.min(hi, qb + w); }
  }
  const want = lo <= hi ? clamp(rel, lo, hi) : 0, err = want - L.h;
  L.h += Math.abs(err) > SKL.easeIn ? clamp(err, -SKL.snap * dt, SKL.snap * dt) : err * (1 - Math.exp(-SKL.ease * dt));
  e.head = L.h;
}
/* ---------------------------------------------------------------- ITS FOOTWORK (Trial 3 R16f; dev/trial-3-r9-overhaul/)
 * The owner (October 22, section 5): sidestep, backpedal, contest a doorway sideways, cut off an escape route, correct when the player
 * changes direction, feign a retreat - without mirroring the player's input perfectly: acceleration, turning limits, momentum,
 * collisions, stamina and a fallible prediction stay, and a feint can fool it.  AP_AUDIT.md (C): every move it made went along its facing
 * (the shared steerTo / follow), so circled at 230 px it turned on the spot, nose first, its facing 0.6-1.3 rad behind the person, and
 * never stepped sideways or back.
 *   THE MOVER (skStrafe): a velocity of its own (e.mv), steered toward the one it wants at its own acceleration (e.caps.ACCELERATION);
 *             forward up to the pace it is given, sideways up to SKF.side of it, backward up to SKF.back of it; its facing turned
 *             separately at the species' own turning ability (TURNING_ABILITY, 3.6 rad/s - R16g, the review: R16f turned it at 7).  Not
 *             the shared steering's slower turn at speed: that is a turn of the way it runs, and here the way it goes is its own velocity,
 *             which its acceleration alone may change (momentum); its facing is its body turned over its feet.  Every step through the
 *             shared moveCollide (walls, the swept test).  Never faster than its run
 *             (0.89 x a fresh sprint): a rested runner still wins a straight race; its stamina is spent by the shared rule (skBody).
 *             Its velocity carries over only from the tick before; when the footwork stops, the shared steering goes on with what of it
 *             lies along its facing (R16g: never a sideways step turned forward in one tick).
 *   THE FIGHT (skFight): within SKF.near of a person it sees, on open floor, in an open move (an open approach at the approach's own
 *             pace, a chase at its run, a hungry watch at the watch's own distance - R16g),
 *             it faces them and places itself at SKF.band from where it reckons they will be in SKF.lead seconds - toward their way out:
 *             the open floor round them, the way they are moving, away from it (SKF.cut of the way between straight at them and squarely
 *             in their path).  Closer than the band it backs off, farther it closes in; across, it sidesteps.  What it reckons from is its
 *             own read of their motion, lagging SKF.tau behind it (smarter: less): a sudden reversal takes it a moment to answer - a feint
 *             works.  Its spring (T4: the wind-up, the reach) is unchanged and decides as before when it strikes.
 *   A FEIGNED RETREAT: somebody coming at it is given ground - it backs off facing them to the far edge of its band, its spring ready
 *             (T4 decides as before); R13's bait round a corner is its own plan and unchanged (backing to its spot facing them changed where it
 *             lay in wait, and with it SK21's scene - tried, and left as R13 made it).
 * Cost: per tick a few multiplications; on a think, 12 rays from the person for their way out. */
const SKF = Object.freeze({
  near: 400,                                     // px: within this of a person it sees (and a clear way to them) it moves as a fighter (R18; R16f-R16i 340)
  band: [115, 170],                              // px: the distance it keeps from where it reckons they will be (its spring: 55-185)
  side: .75, back: .55,                          // the share of its pace it can move sideways and backward
  gain: 3.2,                                     // 1/s: how hard it steers toward where it wants to be
  tau: [.32, .18],                               // s its read of their motion lags (dull .. sharp): a reversal fools it for about that long
  lead: [.25, .45],                              // s ahead it reckons where they will be (dull .. sharp)
  cut: .55,                                      // how far toward their way out it places itself (0: straight at them; 1: squarely in their path)
  swing: .9,                                     // rad: the most it swings its place about them at a time
  keep: 1,                                       // s: a break in the fight shorter than this keeps its read of their motion (R18)
  goAway: 60, runIn: 40,                         // px/s away from it (and most of their speed) that is going away; px from where it reckons they will be that it runs in to (R18)
});
/* (R19: factored out of skFight, unchanged) their way out, as it reckons it: of twelve directions from them, the one with open floor, the
 * way it reads them moving (vx, vy) and away from it - a doorway, a corridor.  The level's shape and its own read of them only */
function skWayOut(geo, e, p, vx, vy) {
  const sp = Math.hypot(vx, vy), mv = Math.atan2(vy, vx), away = Math.atan2(p.y - e.y, p.x - e.x); let best = -1e9, esc = 0;
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * TAU, s = geo.ray(p.x, p.y, a, 420) / 420 + (sp > 60 ? .9 * Math.cos(angDiff(a, mv)) : 0) + .7 * Math.cos(angDiff(a, away));
    if (s > best) { best = s; esc = a; }
  }
  return esc;
}
/* move toward (gx, gy) at up to vmax (forward; SKF.side sideways, SKF.back backward), facing (fx, fy); its own velocity and acceleration */
function skStrafe(eng, e, gx, gy, fx, fy, vmax, dt, gain = SKF.gain) {
  const now = eng.now, M = e.mv && now - e.mv.at <= dt * 1.5 + 1e-6 ? e.mv : (e.mv = { x: Math.cos(e.ang) * e.speed, y: Math.sin(e.ang) * e.speed, at: now });   // (only the tick before's: R16g)
  turnTo(e, Math.atan2(fy - e.y, fx - e.x), e.caps.TURNING_ABILITY, dt);   // (R16g: the species' own turning ability - see the header)
  const hx = Math.cos(e.ang), hy = Math.sin(e.ang);
  let vx = (gx - e.x) * gain, vy = (gy - e.y) * gain;
  let f = vx * hx + vy * hy, l = -vx * hy + vy * hx;                                              // (forward and sideways, as it faces)
  f = clamp(f, -vmax * SKF.back, vmax); l = clamp(l, -vmax * SKF.side, vmax * SKF.side);
  const sp = Math.hypot(f, l); if (sp > vmax) { f *= vmax / sp; l *= vmax / sp; }                // (never faster than the pace it is given, whichever way)
  vx = f * hx - l * hy; vy = f * hy + l * hx;
  const ax = vx - M.x, ay = vy - M.y, a = Math.hypot(ax, ay), amax = (e.caps.ACCELERATION || 500) * dt;
  if (a > amax) { M.x += ax / a * amax; M.y += ay / a * amax; } else { M.x = vx; M.y = vy; }
  M.at = now;
  e.moved = moveCollide(eng, e, M.x * dt, M.y * dt);
  if (e.moved < Math.hypot(M.x, M.y) * dt * .5) { M.x *= .5; M.y *= .5; }                         // (a wall takes its momentum)
  e.speed = Math.hypot(M.x, M.y);
  return { f: M.x * hx + M.y * hy, l: -M.x * hy + M.y * hx };
}
/* within SKF.near of r (seen, a clear way to them): face them and take its place by their way out.  Returns true when it moved so.
 * band: the distance it keeps (SKF.band; a watch its own) */
function skFight(eng, e, r, p, d, dt, thinkNow, vmax, band = SKF.band) {
  if (!r.seen || d > SKF.near || e.disguise || e.exh) return false;
  const geo = eng.geo, now = eng.now, T = e.tr.INTELLIGENCE, tau = lerp(SKF.tau[0], SKF.tau[1], T), lead = lerp(SKF.lead[0], SKF.lead[1], T);
  const fresh = e.fight && e.fight.pid === r.id && now - e.fight.at < .5;
  // (R18) its read of their motion goes on across a short break (a blocked line, a strike): a fight taken up again starts from it, caught
  // up by the time between at its own lag - R16f-R16i started every fight from their true motion, so a reversal during a break was read at once
  const rd = e.fight && e.fight.pid === r.id && e.fight.rd && now - e.fight.rd.at < SKF.keep ? e.fight.rd : null;
  if (fresh && e.fight.blocked && !thinkNow) return false;                                       // (R16g: no clear way to them - tested again on its next think, not every tick)
  if (thinkNow || !fresh) {
    if (!geo.lineClear(e.x, e.y, p.x, p.y, e.rc * .6, 'walk')) { e.fight = { pid: r.id, at: now, blocked: 1, rd }; return false; }
    const k0 = rd ? 1 - Math.exp(-(now - rd.at) / tau) : 1;
    const F = fresh && !e.fight.blocked ? e.fight : (e.fight = { pid: r.id, vx: rd ? rd.vx + (p.vx - rd.vx) * k0 : p.vx, vy: rd ? rd.vy + (p.vy - rd.vy) * k0 : p.vy, esc: null, t0: now });
    F.esc = skWayOut(geo, e, p, F.vx, F.vy);                                                     // their way out (R19: the same reckoning, shared)
    F.at = now;
  }
  const F = e.fight;
  const k = 1 - Math.exp(-dt / tau); F.vx += (p.vx - F.vx) * k; F.vy += (p.vy - F.vy) * k;          // (its read of their motion: it lags)
  const R = F.rd || (F.rd = {}); R.vx = F.vx; R.vy = F.vy; R.at = now;                              // (R18: kept across a short break)
  const qx = p.x + F.vx * lead, qy = p.y + F.vy * lead;
  // where it wants to be: SKF.band from where it reckons they will be, round them toward their way out - it swings its place about them
  // (at most SKF.swing at a time), so that it steps into their path the way they lean, never through them
  const ux = e.x - qx, uy = e.y - qy, L = Math.hypot(ux, uy) || 1, u0 = Math.atan2(uy, ux);
  let dA = angDiff(F.esc, u0);
  if (Math.abs(dA) > 2.6) { const lean = ux * F.vy - uy * F.vx; dA = (lean >= 0 ? 1 : -1) * 2.6; }    // (straight away from it: round the way they are moving - R18: the side they lean to; R16f-R16i took the other)
  const closing = ((e.x - p.x) * p.vx + (e.y - p.y) * p.vy) / Math.max(1, d) > 40;                  // (they come at it: it gives ground)
  // (R18) it reckons they go away from it - mostly away (within 45 degrees of straight away, over SKF.goAway; its own lagging read of their
  // motion, so a reversal fools this too): it runs straight in on where it reckons they will be (SKF.runIn from it, no swing round them) -
  // a band held behind a runner only lets them go, and a place swung beside them made its spring cross their path (two misses by 1-2 px
  // of a walker); somebody going round it keeps its band and its swing.  (R16f-R16i closed on a runner because the straight-away case
  // swung its place to the wrong side and back, tick by tick: see the lean above)
  const relR = ((e.x - p.x) * F.vx + (e.y - p.y) * F.vy) / Math.max(1, d), going = relR < -Math.max(SKF.goAway, .7 * Math.hypot(F.vx, F.vy));
  const g = going ? u0 : u0 + clamp(dA * SKF.cut, -SKF.swing, SKF.swing);
  const D = closing ? band[1] : going ? Math.min(L, SKF.runIn) : clamp(L, band[0], band[1]);
  const m = skStrafe(eng, e, qx + Math.cos(g) * D, qy + Math.sin(g) * D, p.x, p.y, vmax, dt);
  setAct(e, m.f < -30 ? 'back' : e.speed > 150 ? 'chase' : 'pace');
  F.side = (F.side || 0) + (Math.abs(m.l) > 40 && Math.abs(m.l) > Math.abs(m.f) ? dt : 0); F.backT = (F.backT || 0) + (m.f < -30 ? dt : 0);
  return true;
}

/* ---------------------------------------------------------------- SKIN-STEALER (Trial 3)
 * The third species: not a Hound with other numbers, not a Smiler.  An intelligent deceiver - cautious, patient, often choosing NOT to
 * engage - that predicts where people will go from what it has seen and heard (and can be wrong), wears a human look it has earned at a
 * kill, repeats lines of speech it really heard nearby, and kills only on a short committed pounce that physically lands.
 *   Design: dev/trial-3-skin-stealer/DESIGN_DECISIONS.md.  Numbers: SK below, every one PROPOSED, not owner-approved
 *   (dev/trial-3-skin-stealer/BALANCE_TABLE.md).
 * Evidence law (2C), unchanged: it acts on its own sight, hearing, light leads and memory, never on where an unsensed person really is.
 *   The people it considers are the ones it sees now (e.seenNow: their bodies, their facing - eye contact is part of seeing someone) and
 *   the records it keeps (perc(): the body while seen, otherwise its own estimate; r.lkx / r.lvx: the last place and heading it saw or
 *   heard).  The light on its own body it can feel (geo.lightLevel at its own position).  The level's static shape (walls, junctions,
 *   lamps) it knows, as every creature here knows its home.  Nothing else.
 * THE ANIMAL (every tick, whatever it is doing; no state or plan ever resets either):
 *   hunger   0..1, rises slowly, falls while feeding.  Bands (labels only): satiated < .2 < mild < .4 < hungry < .6 < very hungry < .8 <
 *            starving.  It changes thresholds, effort and risk - never range, accuracy or knowledge.
 *   stamina  0..100, drained by running (and, from T4, by every pounce, hit or miss), regained walking or still; under SK.stamExh it is
 *            exhausted and can only walk until it is back over SK.stamBack.
 * PLANS (one at a time, e.plan; chosen on its 10 Hz think from what it perceives, kept unless something clearly better comes up):
 *   roam      no one in view: it wanders the dark, pausing to listen.
 *   watch     someone in view: it stands where it is and looks.  Long for a patient one; a real pause, often the whole encounter.
 *   retreat   someone has seen it (eye contact) or is coming at it: it backs out of their line of sight.  A hungry one backs off slowly,
 *             in view, toward a corner (the bait: it invites them to follow).
 *   approach  someone who is not watching it, and it is hungry: it comes closer under cover (darker, unseen cells cost less), creeping
 *             the last stretch; eye contact stops it.
 *   chase     a hungry one, close, whose person runs from it (or is exhausted): a short run, never long.  It gives up when the gap grows
 *             (a fresh runner on a straight wins), when its stamina runs low, or after SK.chaseMax.
 *   lure      out of their sight after a retreat: it waits beside the corner, facing the way they would come; footsteps coming nearer
 *             keep it there a little longer.  Nobody comes: the bait failed, it leaves.
 *   intercept they went out of its sight moving: from the last place and heading it has for them, along the level, it picks the
 *             junction they will reach and the way they will most likely take (a seeded error that INTELLIGENCE shrinks and starvation
 *             grows), goes round by a way that keeps off their trail, and waits beside that exit.  It can be wrong: it never looks at
 *             where they really went.  Footsteps heard on the way can correct it once.
 *   search    it goes quietly to where it last knew someone (or heard something), listens, and gives up.
 *   leave     it has decided not to engage: satiated, more than one of them, lit and watched, exhausted, it lost a race, a guess or a
 *             bait failed, or its time with this person is spent.  It goes 1200-2200 px away, into the dark and away from everyone it
 *             perceives, and leaves that person alone for a while (SK.cooldown).  Only somebody who walks into arm's reach of a hungry
 *             one is not left alone (T4).
 * ENCOUNTER BUDGET: the seconds it has spent on one person (watching, retreating, approaching, chasing, luring, intercepting, searching)
 *   add up and are never refilled by a change of plan; when they run out it leaves.  So it never pins anyone at a doorway for ever.
 * Spawned only by the admin tools (sim.ai.js adminSpawn / sim.admin.js): never by the world reset or the director.
 * T2: the animal, its senses as the engine gives them, roam / watch / retreat / approach / leave and the budgets.
 * T3: lying in wait (the bait), prediction and interception, a short chase, searching, hearing.
 * T4 (this checkpoint): THE STRIKE.  From approach, chase, lure, interception or search, with the person in sight 55-185 px away, a
 *   clear line and the stamina for it, it springs: a crouched wind-up (SK.pounceWind) aimed where it believes they will be when it
 *   lands (their seen motion, a seeded error that INTELLIGENCE shrinks), then a committed straight leap it cannot steer.  Every leap
 *   costs stamina, hit or miss.  It is lethal only on physical contact: a body its own body has reached, with nothing solid between
 *   (the one place it looks at where a person really is - contact is physics, not perception).  A miss leaves it standing, recovering,
 *   for about a second, and it cannot spring again for 2-3 s; a leap into a wall stuns it.  Anybody who walks into arm's reach of a
 *   hungry one is taken with a short grab.  The capture is always quick (it never plays with its prey); the kill is one of three
 *   (A a grip and a neck break; B the pounce carries them down and breaks the neck; C a hold and a bite at the neck), it stays on its
 *   kill for as long as the death plays on every screen (the shared commitment), then feeds beside the body.
 * T6: DECEPTION (DESIGN_DECISIONS.md D8, D9).
 *   Its ears for speech: a line a person says in a run reaches it only as the players' own nearby speech reaches a player - accepted by
 *     B++'s speech.js and W.A.R.D.'s text check, in its room, from a speaker within SK.hearSpeech (576 px) at that moment (the server's
 *     positions); never the menu lounge.  It keeps at most SK.heardMax lines for SK.heardTtl seconds (and none of a person who has left the
 *     room); it never logs them and the admin overlay shows only how many and how old.  A voice is also a sound: where it came from goes
 *     through the engine's own hearing (walls muffle it; it names nobody it has not seen) - talking near it can draw it.
 *   Its lines: from hiding while it lies in wait (very hungry), and when it stands staring in a borrowed skin - the opening words of a line it
 *     heard (lower case, sometimes its last word again: the echo is a little wrong), preferring the words of the person whose skin it
 *     wears, then anybody else's, then the person's own; with nothing heard, one of a few generic calls that claim no knowledge
 *     (SK_BAIT).  At most one every SK.sayGap seconds and SK.sayEnc an encounter; the server's own bucket limits it again.  It is said
 *     by the entity: B++'s speech.entitySay sends {t:'eheard', e, ...}, never a person's session id (server.js wires eng.voiceOut).
 *   Its skin: only at a kill it has made - G.I.B.'s aftermath hands the engine the victim's validated look (hat, texture, hands, main;
 *     never a name, a light, an item or an id) when that death ends - and only if it then feeds for SK.skinFeed seconds (disturbed
 *     sooner, the skin is left behind).  It wears it for SK.disguiseTime: on screen an ordinary wanderer with nothing in its hands, no
 *     name, stiff arms, a slightly slow walk (150 px/s) and long stares.  In it, it does not hide when seen: it walks up openly, stands
 *     and stares, may speak, then walks on - or, hungry, comes closer and springs from SK.mingleStrike.  The skin drops at its
 *     wind-up, when it breaks into a run, when its time is up; it is gone with the entity and with a world reset.  The same collider in
 *     every form (no crawlspace; LogicZ does not exist).  No light, no item, no corpse is ever touched (CAPABILITY_MATRIX.md §6).
 * BEHAVIOUR REFINEMENT (dev/trial-3-behavior-refinement/; Trial 3 is not owner-approved).  It may choose not to hunt somebody; it may
 *   not behave as if it had not noticed somebody it really perceives.
 *   B1 AWARENESS: e.aw keeps one record per person it has SEEN in its personal space (SK.awNear) - people it has decided not to hunt
 *     (e.left) as well: leaving somebody alone is a choice about hunting, never a reason not to see them.  Each record has a pressure
 *     (A.p) that grows only from what it sees and fades (SK.pDecay); at SK.pAware it has noticed them.  While it roams or leaves it then
 *     reacts without dropping its plan (e.rx, an overlay): it stops, turns to face them and looks (SK.look), no more often than SK.ackGap;
 *     while it walks it turns its head to keep a noticed person in view (e.head: the engine's sight is centred on it, so it learns only
 *     what it then sees); a fresh sound nearby (SK.soundLook) turns it toward where it heard it - the sound's own fuzzy place, no name.
 *     Nothing in B1 can attack, and nothing reads where an unsensed person is.
 *   B2 PROVOCATION: what a seen person does to it raises that person's pressure, each kind only up to its own ceiling, so presence alone
 *     never escalates: in its space (SK.capNear), crowding it (SK.awCrowd) - both by how much THEY closed the distance lately (somebody
 *     standing still that it walked up to, or backed into, has done nothing to it) - circling it (their motion relative to its own, round
 *     it, one way: SK.orbitArc, then each further half-turn - a straight pass sweeps less than half a turn), following it as it walks
 *     (SK.tailMin), moving into its way (SK.awBlock), and pressing in after it has warned them (their own motion, and as much as they
 *     closed the distance).  A sound adds nothing: it names nobody it does not see.  The fade counts all the time since it last saw them,
 *     far away too.
 *   B3 DEFENCE: a satiated creature can kill, but only like this - it has WARNED this person, the warning ended at least SK.defAfterWarn
 *     and at most SK.pressFor ago, their pressure is at least SK.pDefend, it sees them now within SK.defReach with a clear way to them,
 *     they are not backing away, it is not exhausted and has the stamina, and neither its pounce cooldown, nor SK.defCool since it last
 *     defended against them, nor SK.defGapAll since it last defended at all, holds it back.  Then, from its own stream, it chooses:
 *     WITHDRAW (a departure away from them at its tired run, 180 px/s) or STRIKE; cornered, after earlier withdrawals from them, or the
 *     more aggressive, it strikes more often; tired (under 40 stamina), less; hunger raises it a little - hunger never decides whether it
 *     may defend, and nothing changes hunger.  The strike is the pounce's own path with its own numbers: a crouched wind-up of SK.defWind
 *     (the same tell: act wind), aimed where it believes they will be when it reaches them (never past itself: somebody walking straight
 *     at it is met where they are, by their sideways motion only), a short committed lunge that only that person can be caught by, lethal only
 *     on contact (skStrikeStep, nothing solid between), then the engine's capture, one of the three kills, G.I.B.'s corpse.  A miss: the
 *     usual recovery and pounce cooldown, then it leaves them, fast.  The hungry grab and pounce are unchanged.
 *     At SK.pWarn, after it has noticed them for SK.warnAfter, it WARNS: it turns on them, hunches (act creep, state PROVOKED) and backs
 *     away for SK.warnTime, then turns away by another way out (a departure keeps its time; roaming, it leaves).  No more often than
 *     SK.warnGap; a warning cut short by a change of plan before SK.warnTime[0] is not counted as given.  Fleeing (a withdrawal, or leaving
 *     after a missed defence) it does not stop to look - its head still turns - but chased down it may still warn.  A very hungry departure may be reconsidered, after SK.leaveDwell, only on fresh sight of somebody it may hunt - never
 *     after a lost race, never from hunger rising alone.
 * PREDATOR REFINEMENT (dev/trial-3-predator-refinement/; Trial 3 is not owner-approved).
 *   R1 THE HUNT: when it decides to go after a person it has SEEN (approach, chase, flank, an interception, a search, the bait) it keeps
 *     e.hunt above the plans: the quarry, a belief (where they are, heading, how sure, how old, how it knows - seen / heard / guessed),
 *     its confidence (falling without evidence, more slowly the hungrier it is: SK.forget) and its failed guesses.  When a plan ends the
 *     hunt chooses the next step (listen, search where it believes they are) instead of leaving; it gives up for a stated reason - no
 *     evidence (confidence under SK.huntLow), its effort spent (the encounter budget, now longer with hunger and carried across its
 *     departures: SK.carryHalf), exhausted, more than one of them, not hungry.  The engine's records are never written by it.
 *     Eye contact is information: the weights are smooth in hunger.  Mildly hungry, being watched still sends it away or out of sight;
 *     hungry, it breaks their line of sight to FLANK (a spot to the side they cannot see, no farther than it is) and comes at them from
 *     there; starving, it comes on openly or flanks and rarely backs off.  A lost race no longer ends a hungry one's hunt: it may not give
 *     chase again for SK.chaseRest and keeps to the trail at its free walking pace.  A starving one may take up a person it left
 *     SK.leftFresh ago on fresh sight, within the effort it has left for them.
 *   R2 LISTENING AND BELIEF: out of sight every footstep is anonymous (the engine names a sound only while the person is seen).  On
 *     each think the hunt asks of every new body sound it heard (a person's it cannot name; never a creature's): could my quarry be there
 *     by now (within the belief's uncertainty plus SK.hearReach px a second since the last evidence)?  If so it moves its belief to that
 *     fuzzy place, takes a heading from the last evidence to it and firms its confidence (SK.hearConf).  It names nobody: somebody else
 *     making noise there fools it, fairly.  Its guesses (skGuess) come from that belief only: the way it predicts they went (Trial 3's
 *     route, now skRoute, with the same draws), after that has failed the other way at the same turn, where it believes they are, or the
 *     place it last had them; a place near a failed guess (SK.failedNear, remembered SK.failedTtl) is not tried again and each failure
 *     costs confidence (SK.wrongCost).  A sound that fits, away from its current guess, revises an interception or a search (at most
 *     SK.reviseMax in a hunt); no sound, no revision.  Roaming, a sound makes it stop, turn its head to it and listen (SK.curious); a
 *     second sound that fits the first, or one strong first (SK.curiousStrong), sends it to look - anonymous throughout.
 *   R3 STALKING AND AMBUSH: coming at somebody unaware, it FREEZES (crouched, still) when they turn its way before they meet its eyes
 *     (their facing within SK.freezeCone of it), until they look away or its patience (SK.freezeMax, shorter when starving) runs out.
 *     Waiting at an interception its head sweeps as it listens.  Where there is no spot to go round a watcher (skFlankSpot finds none) it
 *     remembers that for that place (SK.noFlank) instead of looking again on every think, and a hungry one may then come on openly.
 *   R4-R7 (integration, the independent review): no one-tick holding of its ground when there is no way round; a glimpse lost for under
 *     SK.lostGrace does not end an approach or a chase; at a flank spot it settles SK.flankSettle before it comes on.  A flank spot is
 *     searched for only when going round would really be begun.  On a runner's trail after a lost race it goes at SK.shadowPace of their
 *     speed, so a lead won stays won while they move (even winded); only a person who stops is reached.  The effort spent on a person is
 *     kept when its attention moves to somebody else, and a departure it keeps keeps that person's cooldown.  Records of people who left
 *     the game are dropped; an admin summon ends a hunt. */
const KACT = { '': 0, watch: 1, back: 2, leave: 3, wait: 4, lure: 5, intercept: 6, search: 7, listen: 8, approach: 9, creep: 10, chase: 11, wind: 12, pounce: 13, recover: 14, feed: 15, mimic: 16, rest: 17, pace: 18 };
/* the balance table (proposed; every value is named so it can be tested and tuned) */
const SK = Object.freeze({
  hungerAtSpawn: [.45, .65],                     // an admin spawn: a seeded value in this range (or the spawn's own hunger option)
  hungerRate: .0016,                             // per second (about .1 a minute: satiated to hungry in about 4 minutes)
  band: [.2, .4, .6, .8],                        // satiated | mild | hungry | very hungry | starving
  stamExh: 8, stamBack: 40, stamLow: 25,         // exhausted under 8, itself again over 40; tired (fatigued speed) under 25
  drainRun: 13, runFrom: 215,                    // stamina per second at its run, counted only over runFrom px/s and in proportion to the speed
                                                 //  (R20, the owner's tradeoff - a PROPOSAL for owner QA: 13, was 11 - an uninterrupted run from
                                                 //  full to exhausted 7.1 s, was 8.4 s: 15 % less; R20 REGRESSION's A/B)
                                                 //  beyond it (R18: a prowl, 205, is free; an investigation costs about 3/s, the press 9, the run 11.
                                                 //  R8-R16i: 14 a second x speed / run, over 200; T3 had 150)
  regenWalk: 6, regenStill: 11,                  // stamina per second walking / standing
  roamLeg: [500, 1600], roamPause: [.6, 2], roamGiveUp: [12, 30],   // (R18: pauses .6-2 s, were 1.5-5)
  patrolFresh: 90,                               // (R16d) seconds a place it saw or heard somebody stays worth prowling to (hungry)
  watch: [1.5, 4.5],                             // seconds it stands and looks (x .7 .. 1.3 with PATIENCE; R18: was 2-6)
  near: 260,                                     // a person closer than this is too close to just watch
  exposed: .45,                                  // the light on its own body above which it counts itself exposed
  hide: [140, 520],                              // how far it backs off to be out of sight
  leave: [1200, 2200], leaveMax: 45,             // how far it goes when it leaves; the longest a departure lasts
  cooldown: [20, 40],                            // (R18: was 30-60) seconds it then leaves that person alone, fed (R16d: from hunger .4, skLeftFor - R8's starving 12 s is 4 s)
  budgetEnc: [45, 120],                          // seconds with one person: 45 + 120 x hunger (R18; R1 had 30 + 90 x hunger, Trial 3 25 + 45 x hunger)
  rethink: 1.3,                                  // a new plan must score this much better than the one it has (no dithering)
  retreatHold: .5,                               // seconds out of sight before it decides what next (lure, or go about its business; R18: was 1)
  approachStop: 150,                             // T3: it comes no closer than this (the pounce and the kill are T4's)
  lure: [3, 8], lureMax: 14,                     // waiting round the corner: 3 + 8 x hunger x PATIENCE s; never longer than lureMax (R18: 4 + 12, 22)
  predictLook: 1500, predictTurns: 2,            // how far along their way it thinks ahead; how many turns it guesses
  predictMargin: .8,                             // seconds it wants to be there before them
  interceptMax: 26, interceptWait: [2, 5],       // the longest an interception lasts; how long it waits at the spot (x PATIENCE; R18: was 4-9)
  searchMax: 20, searchLook: [1, 2],             // the longest a search lasts; how long it listens where it arrives (R18: 16; 2-4)
  heardFresh: 4, heardMin: .08,                  // a sound this recent and this strong is worth going to look at (R18: 2.5, .12)
  chaseFrom: 500, chaseMax: 8, chaseLose: 170,   // (R20, a proposal: 500, 8 - R19 560, 9; R18: 420, 7, 140) it gives chase only from closer than this; for at most this long; it gives up when the gap
                                                 //  has grown this much beyond the closest it got
  pounceRange: [55, 185], pounceWind: .22,       // it springs from this close; the crouched wind-up before the leap (s)
  pounceSpeed: 430, pounceDur: .36,              // the leap: 1.5 x a fresh sprint, below the Hound's lunge; about 150 px
  pounceCost: 22, pounceCool: [2, 3],            // stamina per leap, hit or miss; seconds before it can spring again after a miss
  recoverMiss: [.9, 1.3], recoverWall: 1.1,      // seconds it stands recovering after a miss; after a leap into a wall
  grabReach: 46, grabWind: .12,                  // arm's reach (centre to centre) and the grab's wind-up
  killMeal: .35, feedRate: .03, feedTime: [18, 35],   // hunger a kill takes away; while feeding, per second; how long it feeds
  // T6: deception
  skinFeed: 8,                                   // seconds it must feed on its kill before it can wear that person's skin (disturbed sooner: none)
  disguiseTime: [240, 420],                      // how long a skin lasts on it (s)
  mingleStop: 170, mingleStrike: 120,            // in a skin it walks up openly to this far and stares; it springs only from this close
  stare: [3, 7],                                 // seconds it stands and stares (x .7 .. 1.3 with PATIENCE): the tell
  hearSpeech: 576,                               // it keeps a line only from a speaker this close (the players' own nearby-speech radius)
  heardMax: 4, heardTtl: 90, heardUses: 2,       // lines kept; seconds kept; times each may be repeated
  sayGap: [10, 18], sayEnc: 3, sayLure: 1.5,     // seconds between its lines; lines in one encounter; seconds into a wait before it calls
  sayWords: 6, echo: .35,                        // the most words it repeats; how often it repeats its last word again
  // behaviour refinement B1: awareness (dev/trial-3-behavior-refinement/BALANCE_TABLE.md; all PROPOSED)
  awMax: 4, awTtl: 30,                           // awareness records it keeps; seconds a record nobody renews is kept
  awNear: 200, awCrowd: 90,                      // its personal space (while it sees them); crowding
  pNear: .12, capNear: .35,                      // pressure per second in its space (x closeness, approach); presence alone never goes beyond capNear
  pFast: 1.6,                                    // x this much for fast motion close by (their speed relative to it, 100..300 px/s)
  pDecay: 8,                                     // seconds (e-folding) for pressure to fade
  pAware: .12,                                   // pressure at which it has noticed them
  ackGap: [3, 5], look: [.8, 1.6],               // seconds between two looks at the same person; how long a look lasts
  rxGap: 1.5,                                    // seconds after a reaction ends before it turns to a sound (no look at footsteps on the heels of a look)
  soundLook: 420, soundLookI: .2, soundGap: 4,   // a fresh sound this close and loud turns it to look; seconds between such looks
  // behaviour refinement B2: provocation
  awOrbit: 300, orbitArc: 4,                     // a record is kept within this; circling: radians of their motion round it, one way, before it counts
  awTail: 220, tailMin: 3,                       // following it as it walks, within this, for this long
  awBlock: 150,                                  // standing in its way (ahead, in its lane) within this
  pCrowd: .16, capCrowd: .65,                    // crowding: per second, up to
  pOrbit: .22, capOrbit: 1.2,                    // circling: per half-turn after the first, up to
  pTail: .1, capTail: .9, pBlock: .12, capBlock: .9,   // following it; in its way: per second, up to
  pPress: .25, capPress: 1.2, pressNear: 160, pressFor: 15,   // pressing in (within pressNear, not backing off) for pressFor s after a warning: per second, up to
  pWarn: .45, warnAfter: 3,                      // pressure at which it warns, once it has noticed them this long
  warnTime: [1.2, 1.8], warnGap: 4, warnBack: 40,   // a warning lasts; the least time to the next; how fast it backs away meanwhile (px/s)
  leaveDwell: 2.5,                               // a very hungry departure can be reconsidered only after this long (and only on fresh sight; R18: was 4)
  // behaviour refinement B3: defence
  pDefend: .8, defAfterWarn: 1, defReach: 110,   // pressure from which it may defend; at least this long after a warning ended; this close (seen, a clear way)
  defWind: .5, defDur: .25, defSpeed: 340, defCost: 18,   // the defensive wind-up (the tell), the lunge (about 70 px), its stamina
  defCool: 25, defGapAll: 10,                    // seconds before it defends against the same person again; against anybody
  defBase: .35, defCornered: .4, defPerWithdraw: .2, defAggr: .5, defHunger: .3, defTired: .2,   // the odds of striking rather than withdrawing (kept within .1-.95)
  // predator refinement R1: the hunt (dev/trial-3-predator-refinement/BALANCE_TABLE.md; all UNAPPROVED)
  carryHalf: 90,                                 // seconds for the effort it has spent on a person (kept across its departures) to halve
  forget: [15, 45],                              // seconds without any evidence of its quarry before the hunt is given up (not hungry .. starving; R18; R2 10 .. 30, R1 8 .. 24)
  huntLow: .1,                                   // the confidence under which a hunt is over (R18: was .15)
  huntTries: [3, 6],                             // guesses (interceptions, searches) in one hunt: hungry .. starving (R18; R2 2-4, R1 3)
  listenLost: [.3, .8],                          // seconds it stands and listens when its quarry has gone (shorter when starving; R18: was .6-1.6)
  flankMax: 3, flankDur: 7, flankMin: 220,       // flanks in one hunt; the longest a flank lasts (R18: 8); the nearest to them a flank spot is
  flankCome: 6,                                  // seconds it comes on from a flank toward where it believes them before it stops to listen
  chaseRest: 5,                                  // seconds after a lost race before it gives chase again (R18: was 10)
  pressShown: 3,                                 // (R16i; R18: 3 s, was 2) s: seen by them this lately, its approach is no secret - it may press (speeds.press)
  shadowPace: .85,                               // (R7) keeping to a runner's trail after a lost race: this share of their speed (at most its free pace) - a
                                                 //  person who keeps moving, even winded (148 px/s), keeps their lead; one who stops or turns back is reached
  leftFresh: 4,                                  // a starving one takes up a person it left at least this long ago, on fresh sight
  // predator refinement R2: listening, belief, guesses (all UNAPPROVED)
  hearReach: 260,                                // px a second a person may have gone since its last evidence of them: a sound farther from its
                                                 //  belief than that (plus both uncertainties) is not taken for theirs
  hearConf: [.45, .85],                          // the confidence a sound that fits gives the hunt (quiet .. loud; a sighting gives 1)
  failedTtl: 60, failedNear: 200,                // seconds a failed guess is remembered (at most 4); how near a failed place another guess may not be
  wrongCost: .15,                                // the confidence a failed guess costs
  reviseMax: 3,                                  // revisions of its guess on a new sound, in one hunt
  // predator refinement R3: stalking (all UNAPPROVED)
  freezeCone: 1.1, freezeMax: [1.5, .6],         // stalking: it freezes when an unaware person's facing comes within this of it (rad), for at most (R18: 3 .. 1.2)
                                                 //  this long (hungry .. starving) before it goes on
  noFlank: 10,                                   // seconds it remembers that a place has no way round a watcher (or until they move 200 px)
  lostGrace: .6,                                 // (R4) seconds out of sight before an approach, a chase (R16d: or a watch) counts them lost (no flicker at a sight edge)
  flankSettle: .3,                               // (R4) seconds it settles, crouched, at its flank spot before it comes on (R18: was .6)
  curious: [.4, 1], curiousStrong: .35,          // roaming: seconds it stops and listens after a sound; a first sound this strong is looked at alone (R18: .8-1.8, .45)
                                                 //  (x 1 .. .4 from mildly hungry to hungry)
  // R11 (dev/trial-3-r9-overhaul/; all UNAPPROVED)
  watchHungry: .7,                               // hungry (from .35 to .6), a look at somebody is this much shorter: an assessment, not a vigil
  gazeFar: 760,                                  // attention: its head turns to the person it notices most among those it sees, this far (its sight's range)
  ackEyes: 480, ackCome: 360,                    // a person it has just seen (beyond its personal space): it stops and looks at them if they meet its eyes within ackEyes,
                                                 //  or come its way within ackCome (B1's own looks at somebody in its space go on as before)
  ackLook: [.25, .4],                            // how long that first look lasts: a turn of the head and shoulders toward them, a beat, then on (R18: .35-.55)
  ackOver: 1.4, ackHead: 1.5,                    // satiated and leaving: instead, its head turns back to them (up to ackHead rad) for ackOver s as it goes
  // R18 (the owner's OVERTUNED EXPERIMENT; all UNAPPROVED, meant to be tuned down after the owner plays it)
  huntHunger: .3,                                // from this hunger it hunts (listens, prowls, flanks, takes up a trail, springs): R8-R16i SK.band[1], .4
  chaseHunger: .45,                              // from this hunger it may run (chase, press, a hungry ambush cut short): R8-R16i SK.band[2], .6 - and the
                                                 //  weights around it are graduated (skDrive), no cliff at the line
  escalate: [5, 1.2],                            // a standoff (it watches somebody who knows it is there): seconds before it moves on them - fed .. starving
                                                 //  (x .8 .. 1.2 with PATIENCE); fed (under huntHunger) it only watches
  closeFrom: 450,                                // px: an approach nobody sees prowls (205) until this near, then stalks or creeps (stealth for the last stretch)
  // R19 (the owner's pack of October 23, the S track: its positioning before a chase - its chase, speeds and strike are R18's)
  detour: [12, 6],                               // s: the most a way round somebody standing still may cost beyond coming on openly, just hungry .. starving (skFlankWorth)
  contestFrom: 1000,                             // px: from this near, and beyond its footwork's range, an open approach heads for their way out (skContest)
  contestOff: .6,                                // rad: ...when their way out lies this far off straight beyond them (a doorway, a side passage)
  contestKeep: 120,                              // px: its aim at their way out is kept until they move this far from where it chose it
});
/* (Trial 3 R20, the S track: the owner's strategic hunter - dev/trial-3-r20-strategic-ambush/DESIGN_DECISIONS.md.  Every value is a
 * PROPOSAL for the owner's QA, chosen from the A/B runs in REGRESSION.md; each has a neutral value that gives R19's behaviour back) */
const SK20 = Object.freeze({
  chaseW: .85,                                   // the chase's weight x this (R19 1): the run on somebody is a little less its first answer
  lead: .3,                                      // s: an interception goes at the pace that gets it there this much before them - its prowl
                                                 //  when that will do, a burst of its run only for the part that needs it (R19: always its run);
                                                 //  on top of SK.predictMargin, which its guess already keeps
  urgent: 1.5,                                   // s: a hunt's search goes at its investigation's pace (232, costs stamina) only on footsteps this
                                                 //  fresh; otherwise at its prowl (205, free) - the pursuit walk (R19: always the investigation)
  waitCpa: 200,                                  // px: somebody coming its way unaware, whose way passes this near it, in the dark - it waits for them
                                                 //  where it is (an ambush) rather than going to meet them
  aheadFrom: 420, aheadSlack: .5,               // px, s: somebody it sees walking on unaware this far off - it goes ahead to wait where they will
                                                 //  pass (an interception, skPredict) when it can be there this much sooner, beside the way and hidden
  postFrom: 380, postI: .05,                     // px, intensity: a moving sound this far off (two that fit: a way somebody is going) - it goes to
                                                 //  meet it where it would come out and waits there (a post), rather than going to the sound
  postWait: [3, 6], postMax: 14,                 // s: its wait at a post (3 + 6 x hunger x PATIENCE, as an ambush); the longest, sounds coming nearer
                                                 //  included (SK.lureMax's 14)
  // its ears (player-equivalent reach: dev/trial-3-r20-strategic-ambush/HEARING.md): how much farther it hears each kind of a person's
  // own sound than R8-R19's shared law (r x (.42 + 1.05 HEARING)); through a wall, this share of the reach (shared: .6).  Identity is
  // never given by a sound (identifySound: only somebody it sees as it hears them); its fuzz grows with distance as before
  hear: { walk: 2.4, run: 1.12, slide: 1.35, vault: 1.2, land: 1.2 },   // (the engine's types: footsteps by state, vaults, landings, slides - a crouched
                                                 //  step and a crawl as R8-R19 exactly: the owner's crouch stealth is kept)
  hearWall: .75,
  // its belief that somebody it watches is winded (skFatigue): what it saw them run without a break (a fresh person runs about 9.5 s), a
  // walk slower than a person's own (148 against 172: a winded walk), their ragged breath heard where it believes them - never their
  // stamina.  Out of its sight the belief fades (its confidence halves in fz.half s) and their rest is guessed at the rates people recover
  fz: { from: 5.5, full: 9, walkBack: .86, standBack: 2.3, slow: [110, 160], breathFor: 3, slowFor: 2, half: 5, at: .45 },
});
/* (R18) how much its hunger drives it, 0 (fed) .. 1 (starving), smooth: every R18 weight and speed scales with it - no cliff at a line */
const skDrive = e => sm(SK.huntHunger - .1, .85, e.hunger);
/* (R15) the Rend's weight among its kills: a grab (not a leap's landing), hungry (SK.band[2]; more when starving), with room for the two
 * halves either side of the line of the pull (rays from the victim, 72 px clear each way); 0 otherwise.  Its own geometry only: no draw */
function skRendW(eng, e, pv, pounce) {
  if (pounce || !(e.hunger >= SK.band[2])) return 0;
  const a = Math.atan2(pv.y - e.y, pv.x - e.x), room = s => eng.geo.ray(pv.x, pv.y, a + s * Math.PI / 2, 80) >= 72;
  return room(1) && room(-1) ? (e.hunger >= SK.band[3] ? .5 : .3) : 0;
}
/* (T6) the generic calls, used only when it has heard nothing it may repeat: none of them claims to know anything about anybody */
const SK_BAIT = Object.freeze(['hello?', 'is someone there?', 'over here', 'wait for me', 'can you help me?', "i'm lost", 'this way']);
const SKIN = {
  name: 'SkinStealer', kind: 'skinstealer', initial: S.ROAMING, radius: 24, clearance: 21, vTop: 300, turnPenalty: .5, roamSpeed: 160,   // (R18: its casual walk)
  // a patient, cautious, clever animal: intelligence, patience and caution drive its plans; hunger is its own variable (e.hunger), not a trait
  traits: { INTELLIGENCE: .8, SADISM: .1, HUNGER: .6, PATIENCE: .75, CURIOSITY: .55, CAUTION: .7, TERRITORIALITY: .3, AGGRESSION: .45, PERSISTENCE: .45, SOCIAL: .1, HEARING: .7, VISION: .55, LIGHT_SENS: .5, MEMORY: .7 },
  jitter: .12,
  // one collider in every form: it cannot crawl, and a disguise never shrinks it (LogicZ does not exist; see DEFERRED.md)
  caps: { CAN_VAULT: true, VAULT_SPEED: .9, CAN_CROUCH: true, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: false, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.6, ACCELERATION: 760, TURN_AWARE_STUCK: true },   // (R20, the N track: W1, its stuck timer measured against its turn)
  // not a dark-seer: a lightless person in the dark is seen only from close by, as the Hound sees
  vision: { range: 760, fov: 2.5, dark: false, gain: 2.6, floor: 90 },
  // (R18, the owner's OVERTUNED EXPERIMENT of October 22 - "overtune first, balance down after I experience it"; Skin-Stealer only, the
  // Wanderer's movement locked: walk 172, a fresh sprint 285) its movement profile in the owner's ranges:
  //   roam 160 (casual wandering, 140-175)  prowl 205 (purposeful prowling, 195-215)  investigate 232 (alert investigation, 225-240)
  //   press 260 (aggressive approach, 255-265)  run 270 (its most: ordinary pursuit; still under a fresh sprint - a rested runner wins a
  //   straight race, by 15 px/s)
  // kept for their purpose: creep 62 and stalk 90 (stealth), disguise 150 (in a skin, a Wanderer's stroll), flank 210 (a quick move to
  // cover), fatigued 190 (tired: stamina under stamLow), spent 120 (exhausted).  R8-R16i: roam 105, run 255, fatigued 180, flank 170;
  // R16i's press 238.  Each speed over runFrom (215) spends stamina (skBody): investigation a little, the press more, the run most
  speeds: { roam: 160, creep: 62, stalk: 90, disguise: 150, run: 270, fatigued: 190, follow: 105, flank: 210, press: 260, prowl: 205, investigate: 232, spent: 120 },
  evidence: { sight: 3, sound: 1.5, light: 1.6 },               // (ai.intelligence.js evidenceWeights: its own, never the Smiler's)
  /* its kills (ai.capture.js): always quick, committed for its own death lengths (dphys.js DURS.SkinStealer), one of three - (R15) or,
   * rarely, the fourth: D, the Rend */
  capture: {
    noPlay: true, commit: true, commitDur: { A: 3.2, B: 3.4, C: 3.5, D: 3.6 },
    quick: () => 1,
    variants(eng, e, pv, ctx, attack) {
      const pounce = attack && attack.style === 'pounce' && (attack.speed || 0) > 250, winded = pv.ex || (pv.stamina != null && pv.stamina < 22);
      return [
        { k: 'A', w: pounce ? .5 : 1.6 },                                                     // a grip from close by, the neck broken
        { k: 'B', w: pounce ? 2.6 : .15 },                                                    // the leap carries them down, then the neck
        { k: 'C', w: .35 + (winded ? 1.9 : 0) + (ctx.deadEnd ? 1.4 : 0) + (e.hunger >= SK.band[3] ? 1.4 : 0) },   // held, a bite at the neck: a winded or cornered victim, a starving one
        // (R15) D, the Rend: only a grab from close by (never at the end of a leap), only hungry, and only with room to either side of the
        // victim for the two halves (the line of the pull, a clear 72 px each way) - else its weight is nothing and the draw is A-C's own,
        // exactly as before.  Rare where it fits; the recent-kills rule (pickVariant) keeps it from repeating
        { k: 'D', w: skRendW(eng, e, pv, pounce) },
      ];
    },
    afterKill(eng, e, ctx, pv) { skFeedBegin(eng, e, pv); },
  },
  init(eng, e, opts) {
    const h = Number.isFinite(opts.hunger) ? opts.hunger : lerp(SK.hungerAtSpawn[0], SK.hungerAtSpawn[1], e.streams.personality());
    e.hunger = clamp(h, 0, 1); e.stam = 100; e.exh = false;
    e.plan = null; e.enc = null; e.left = new Map(); e.still = false; e.pounce = null; e.recover = 0; e.disguise = null; e.heard = []; e.said = 0;
    e.skin = null; e.sayNext = 0; e.mimicT = 0;                                                // (T6) a skin waiting for its meal; its next line
    e.sayRng = mkRng(deriveSeed(eng.seed, 'skinstealer-say', e.id));                           // (T6) its own stream: its words never move its other choices
    e.voice = { h: Math.round(lerp(-4, 2, e.sayRng())), s: Math.round(lerp(78, 92, e.sayRng())) };   // its voice (pitch, pace): slow and a little low
    e.roam = { goal: null, until: 0, pause: 0 }; e.dbg.why = 'roaming'; e.dbg.decide = null; e.dbg.predict = null; e.dbg.soundSeen = 0;
    e.tally = { lure: 0, lureCame: 0, ambush: 0, ambushCame: 0, intercept: 0, interceptCame: 0, chase: 0, chaseLost: 0, search: 0, searchFound: 0, pounce: 0, grab: 0, hit: 0, miss: 0, wall: 0, kills: 0,
      mingle: 0, post: 0, say: 0, sayHeard: 0, sayBait: 0, skin: 0, skinLost: 0, reveal: 0, look: 0, lookSound: 0, warn: 0, reconsider: 0, defend: 0, defendHit: 0, defendMiss: 0, withdraw: 0 };   // its record (debug, tests, the balance report)
    e.pounceCool = 0;
    e.aw = new Map(); e.rx = null; e.awAt = 0; e.awSound = 0; e.soundLookAt = 0;                // (B1) its awareness records; a reaction in progress
    e.awRng = mkRng(deriveSeed(eng.seed, 'skinstealer-aware', e.id));                           // (B1) its own stream: noticing never moves its other choices
    e.hunt = null; e.spent = new Map();                                                         // (R1) its hunt; the effort it has spent on each person
    e.huntRng = mkRng(deriveSeed(eng.seed, 'skinstealer-hunt', e.id));
    e.look = { k: '', sid: 0, h: null, seen: new Set() }; e.lookRng = mkRng(deriveSeed(eng.seed, 'skinstealer-look', e.id));   // (R16e) its eyes' stimulus; its own stream
    e.coverRng = mkRng(deriveSeed(eng.seed, 'skinstealer-cover', e.id));                        // (R13) its own stream for the spots it looks for under cover: R8's draws never move                          // (R1) its own stream: how it goes about a hunt never moves its other choices
    Object.assign(e.tally, { hunt: 0, huntCold: 0, huntSpent: 0, flank: 0, shadow: 0, listenLost: 0, reengage: 0, heardQ: 0, revise: 0, wrong: 0, alt: 0, curious: 0, curiousDrop: 0, freeze: 0, noFlank: 0, contest: 0, flankRefused: 0, flankStale: 0 });   // (R19: the last three)
    e.mind = skMindNew();                                                                       // (R11) who could see it, what changed, what it knows (ai.skin.mind.js)
  },
  /* the engine's hooks (ai.engine.js): it never borrows a Hound's or a Smiler's own functions */
  onFar(eng, e) {
    e.pounce = null; e.recover = 0; e.rx = null; e.head = 0; e.look.k = ''; e.look.h = null; e.look.prev = 0; e.look.seen = null; e.look.m = null; e.pre = null; e.fight = null; e.mv = null; e.ackHead = null; e.defLeave = 0; skHuntEnd(eng, e, 'nobody within reach'); e.noFlank = null; e.noAmbush = null; if (e.plan && e.plan.k === 'feed') return;   // feeding at its kill it carries on, alone
    e.plan = null; e.roam.goal = null; e.roam.pause = 0; setState(e, S.ROAMING, ''); e.dbg.why = 'nobody within reach: it waits where it is';
  },
  farTick(eng, e, dt) {                                           // far from everyone: its hunger goes on (or it feeds)
    skBody(eng, e, dt);
    const P = e.plan; if (P && P.k === 'feed') { e.hunger = clamp(e.hunger - SK.feedRate * dt, 0, 1); P.fed = (P.fed || 0) + dt; if (eng.now > P.until || (e.hunger < .02 && P.fed >= SK.skinFeed)) { skDon(eng, e, P); e.plan = null; setState(e, S.ROAMING, ''); e.dbg.why = 'fed: it waits where it is'; } return; }
    // (R18, the owner's overtuned experiment) hungry, it does not stand and wait for somebody to come within reach: it prowls - coarsely, as
    // a Hound roams far from everyone (the engine's own coarse movement, at its casual walk) - to where its prey has been (its own memory:
    // skPatrolGoal) or, with nothing to go on, across the level.  Never toward anybody it has not perceived.  Fed (or exhausted), it waits
    if (e.hunger < SK.huntHunger || e.exh || e.cap || e.commit || e.disguise) return;
    e.farT = (e.farT || 0) - dt;
    if (!e.path.length && e.farT <= 0) {
      const g = skPatrolGoal(eng, e) || randomFloor(eng, e, 900, 2800);
      if (g) { plan(eng, e, g.x, g.y, { why: 'far prowl' }); e.dbg.why = g.k ? `far from everyone: it prowls where it ${g.k} somebody` : 'far from everyone: it prowls the level'; }
      e.farT = rand(e, 2, 6);
    }
    coarseMove(eng, e, dt);
  },
  still(e) { return e.still; },                                  // (the engine's stuck watchdog: it held still this tick on purpose)
  onStuck(eng, e) { if (e.plan && e.plan.k !== 'lure' && e.plan.k !== 'ambush') e.plan.stuck = (e.plan.stuck || 0) + 1; e.roam.goal = null; e.dbg.why = 'stuck: the watchdog cleared its route'; },
  onClear(eng, e) { e.noAmbush = null; e.plan = null; e.target = null; e.enc = null; e.roam.goal = null; e.roam.summon = 0; e.aw.clear(); e.rx = null; e.head = 0; e.look.k = ''; e.look.h = null; e.look.prev = 0; e.look.seen = null; e.look.m = null; e.pre = null; e.roam.seen = null; e.fight = null; e.mv = null; e.ackHead = null; e.defLeave = 0; e.dbg.lv = ''; e.hunt = null; e.spent.clear(); e.noFlank = null; e.mind = skMindNew(); setState(e, S.ROAMING, ''); },
  debugHunt(eng, e, r) { e.left.delete(r.id); setTarget(e, r.id, eng.now); skBegin(eng, e, 'watch', r, 'admin: it was given a record of you'); return 'WATCHING YOU (real AI)'; },
  /* its own target scoring and commitment (ai.intelligence.js's debug asks for them; never the Smiler's sScore) */
  targetScore(eng, e, r) { const age = eng.now - Math.max(r.seenAt, r.heardAt); return r.aw * .8 + r.conf * .7 - Math.min(1, age / 30) * .3 + (r.seen ? .5 : 0) + (r.id === e.target ? .4 : 0); },
  dwell(e) { return 1.5 + e.tr.PATIENCE; },
  summon(eng, e, r, tx, ty) { skHuntEnd(eng, e, 'admin summon'); e.plan = null; e.roam.goal = { x: tx, y: ty }; e.roam.summon = eng.now + 8; plan(eng, e, tx, ty, { why: 'admin summon' }); e.roam.until = eng.now + 40; e.roam.pause = 0; e.dbg.why = 'admin summon: it goes to look'; },
};
const skBand = h => h < SK.band[0] ? 'satiated' : h < SK.band[1] ? 'mild' : h < SK.band[2] ? 'hungry' : h < SK.band[3] ? 'very hungry' : 'starving';

/* ---- the animal: hunger and stamina, every tick, from what its body really did ---- */
function skBody(eng, e, dt) {
  e.hunger = clamp(e.hunger + SK.hungerRate * dt, 0, 1);
  const v = e.speed || 0;
  if (e.pounce) { /* a leap is paid for at once (SK.pounceCost), not as running */ }
  else if (v > SK.runFrom) e.stam -= SK.drainRun * Math.max(.25, (v - SK.runFrom) / (e.sp.speeds.run - SK.runFrom)) * dt;   // (R18: by the speed beyond runFrom - at least a quarter of the run's)
  else e.stam += (v < 8 ? SK.regenStill : SK.regenWalk) * dt;
  e.stam = clamp(e.stam, 0, 100);
  if (!e.exh && e.stam < SK.stamExh) { e.exh = true; e.dbg.exh = eng.now; }
  else if (e.exh && e.stam >= SK.stamBack) e.exh = false;
  if (e.disguise && eng.now > e.disguise.until) skUndress(eng, e, 'its borrowed skin wore out');   // (T6)
}
/* it holds still on purpose: no route left behind (the engine's stuck watchdog would take a deliberate stop for being stuck) */
/* (R16g) may it run at r: the chase's own conditions on it (skDecide's chase) - hungry enough, not exhausted, its breath, no race lost to
 * them lately */
/* (R20) its belief that somebody is winded - what it has seen and heard of them, never their stamina (R8-R19 read r.stamina and r.ex,
 * the person's own meter, through its sight).  skFatigueSee: each think, for somebody it sees (ai.skin.mind.js) - how long it has watched
 * them run without a break, a walk slower than a fresh person's soon after a run; out of its sight it guesses they got their breath back as
 * people do (SK20.fz).  skFatigue: the belief now - p (0 fresh .. 1 winded), its confidence (fading out of sight), the cues; a ragged breath
 * it heard where it believes them (theirs, or nobody's it can name) counts too.  It can be wrong: a person who ran long and stopped with
 * breath to spare looks winded; one who ran briefly looks fresh whatever their meter says */
function skFatigueSee(eng, e, r, o, now) {
  const Z = SK20.fz, v = r.visual, f = o.fz || (o.fz = { run: 0, t: now, seen: now, slowAt: -99, breathAt: -99, runAt: -99 });
  const gap = now - f.seen, dt = gap > .6 ? 0 : Math.min(.5, Math.max(0, now - f.t));   // (the review: a gap out of its sight is the walk-back's alone, never also run time)
  if (gap > .6) f.run = Math.max(0, f.run - gap * Z.walkBack);                   // a while out of its sight: they will have got some breath back
  const sp = Math.hypot(v.vx, v.vy);
  if (v.st === 2 && sp > 220) { f.run += dt; f.runAt = now; }
  else f.run = Math.max(0, f.run - dt * (sp < 20 ? Z.standBack : Z.walkBack));
  if (v.st === 1 && sp > Z.slow[0] && sp < Z.slow[1] && f.runAt > 0 && now - f.runAt < 8) f.slowAt = now;   // a slow walk, soon after a run
  f.t = now; f.seen = now;
}
function skFatigue(eng, e, r, now) {
  const Z = SK20.fz, o = e.mind && e.mind.obs.get(r.id), f = o && o.fz;
  if (!f) return { p: 0, conf: 0, est: 'unknown', cues: [] };
  for (const q of e.mem.sounds) if (q.type === 'breath' && now - q.t < Z.breathFor && q.src !== -1 && (q.pid === r.id || (!q.pid && Math.hypot(q.x - r.lkx, q.y - r.lky) < (q.u || 0) + 120))) f.breathAt = Math.max(f.breathAt, q.t);
  let p = sm(Z.from, Z.full, f.run); const cues = [];
  if (f.run >= Z.from) cues.push(`ran ${f.run.toFixed(1)} s`);
  if (now - f.breathAt < Z.breathFor) { p = Math.max(p, .85); cues.push('breath'); }
  if (now - f.slowAt < Z.slowFor) { p = Math.max(p, .7); cues.push('slow walk'); }
  const conf = .9 * Math.pow(.5, Math.max(0, now - f.seen) / Z.half);
  return { p: +p.toFixed(2), conf: +conf.toFixed(2), est: p < .3 ? 'fresh' : p < .6 ? 'tiring' : 'winded', cues };
}
function skWinded(eng, e, r, now) { const F = skFatigue(eng, e, r, now); e.dbg.fat = Object.assign({ pid: r.id, at: +now.toFixed(2) }, F); return F.p * F.conf >= SK20.fz.at; }
function skMayRun(eng, e, r) { const H = e.hunt && e.hunt.pid === r.id ? e.hunt : null; return e.hunger >= SK.chaseHunger && !e.exh && e.stam >= SK.stamLow + 15 && !(H && eng.now - H.raceAt < SK.chaseRest); }
/* (R16f) close enough, and in the open, to fight for its place: somebody it sees within SKF.near who is moving, or looking at it - (R18) or,
 * hungry, who has had it on their screen within SK.pressShown (they know it is there: a hesitation is a chance, not a reason to wait) */
function skFightable(eng, e, r, p, d) {
  if (!r.seen || d >= SKF.near || e.disguise || e.exh) return false;
  if (Math.hypot(p.vx, p.vy) > 40 || skWatched(eng, e, r)) return true;
  const o = e.mind && e.mind.obs.get(r.id); return e.hunger >= SK.huntHunger && !!(o && eng.now - o.sawAt < SK.pressShown);
}
/* (R16e) a plan's own head movement (a listening sway, a glance back): eased from where the head is, so that it never jumps after a snap */
function skHeadTo(e, v, dt) { const h = e.head || 0; e.head = h + clamp((v - h) * Math.min(1, dt * 12), -8 * dt, 8 * dt); }
function skHold(eng, e, dt) { if (e.path.length) e.path = []; stopMoving(eng, e, dt); e.still = true; }
/* the fastest it may go now: exhausted it walks, tired it runs slower */
const skCap = e => e.exh ? e.sp.speeds.spent : e.stam < SK.stamLow ? e.sp.speeds.fatigued : e.sp.speeds.run;   // (R18: exhausted, its spent walk - R8-R16i its roam)
const skSpeed = (e, k) => Math.min(e.sp.speeds[k] || 100, skCap(e), e.disguise ? e.sp.speeds.disguise : 1e9);   // (T6: in a skin, never faster than its walk)

/* ---- what it perceives: the people it sees now, and where it believes a remembered one is ---- */
function skSeen(eng, e) {
  const out = [];
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r.seen && r.visual && !tgtGone(eng, e, r)) out.push(r); }
  return out.sort((a, b) => a.dist - b.dist || a.id - b.id);
}
/* eye contact: it sees them, and they are looking at it (their facing is part of seeing them) */
const skWatched = (eng, e, r) => !!(r && r.seen && facedBy(eng, e, eng.playerById(r.id), r));
/* the light on its own body (lamps, local failures and lights that reach it): felt, not seen */
const skLit = (eng, e) => eng.geo.lightLevel(e.x, e.y, eng.lightPlayers());

/* ---- plans ---- */
/* each plan's state and act (the shared framework's states: what the client and the admin overlay read) */
const SK_STATE = { watch: [S.WATCHING, 'watch'], retreat: [S.RETREATING, 'back'], approach: [S.STALKING, 'approach'], chase: [S.HUNTING, 'chase'],
  lure: [S.CAUTIOUS, 'lure'], ambush: [S.STALKING, 'wait'], intercept: [S.STALKING, 'intercept'], search: [S.SEARCHING, 'search'], leave: [S.DISAPPEARING, 'leave'], feed: [S.FEEDING, 'feed'],
  mingle: [S.STALKING, 'pace'],                                                                // (T6) in a borrowed skin, walking up openly
  flank: [S.STALKING, 'approach'], listen: [S.ALERT, 'listen'], post: [S.STALKING, 'wait'] };   // (R20) post: waiting where a sound would come out                             // (R1) to cover at their side; standing, listening
function skBegin(eng, e, k, r, why, extra) {
  const p = Object.assign({ k, pid: r ? r.id : 0, t0: eng.now, why }, extra || {});
  e.plan = p; e.dbg.why = why; e.path = []; e.goalKey = '';
  if (r) setTarget(e, r.id, eng.now);
  if (k === 'watch') p.until = eng.now + rand(e, SK.watch[0], SK.watch[1]) * (.7 + .6 * e.tr.PATIENCE) * (1 - SK.watchHungry * sm(.35, .6, e.hunger));   // (R11: hungry, a look is an assessment, not a vigil)
  if (e.tally[k] !== undefined) e.tally[k]++;
  setState(e, SK_STATE[k][0], SK_STATE[k][1]);
  return p;
}
/* the person's encounter: its spent seconds (real time, counted on its thinks; never refilled by a change of plan) */
function skEnc(eng, e, r, count) {
  if (e.enc && e.enc.pid !== r.id) skKeepSpent(eng, e);                           // (R7) its attention moves to somebody else: what it spent on the first is kept
  if (!e.enc || e.enc.pid !== r.id) e.enc = { pid: r.id, t0: eng.now, at: eng.now, spent: skCarried(eng, e, r.id) };   // (R1: what it spent on them before, halving with time)
  if (count) e.enc.spent += Math.min(.5, eng.now - e.enc.at);
  e.enc.at = eng.now;
  return e.enc;
}
const skBudget = e => SK.budgetEnc[0] + SK.budgetEnc[1] * e.hunger;
/* (R1) the effort it spent on a person in earlier encounters, halving every SK.carryHalf seconds: leaving and coming back never refills it */
function skCarried(eng, e, pid) { const q = e.spent.get(pid); return q ? q.s * Math.pow(.5, (eng.now - q.t) / SK.carryHalf) : 0; }
function skKeepSpent(eng, e) {
  if (!e.enc) return;
  e.spent.set(e.enc.pid, { s: e.enc.spent, t: eng.now });
  for (const [id, q] of e.spent) if (!eng.byId.has(id) || q.s * Math.pow(.5, (eng.now - q.t) / SK.carryHalf) < 1) e.spent.delete(id);
  while (e.spent.size > 6) { let o = null; for (const [id, q] of e.spent) if (!o || q.t < o[1].t) o = [id, q]; e.spent.delete(o[0]); }
}
/* leave them alone: a goal far away, in the dark, away from everyone it perceives; and a cooldown on that person */
function skLeaveGoal(eng, e) {
  const pos = [...e.mem.p.values()].filter(q => !tgtGone(eng, e, q) && eng.now - Math.max(q.seenAt, q.heardAt) < 20).map(q => perc(eng, e, q));
  let best = null, bs = -1e9;
  for (let k = 0; k < 8; k++) {
    const g = randomFloor(eng, e, SK.leave[0], SK.leave[1]); if (!g) continue;
    const dmin = pos.length ? Math.min(...pos.map(q => Math.hypot(q.x - g.x, q.y - g.y))) : 2000;
    const s = Math.min(dmin, 2200) - (eng.geo.lamp[eng.geo.cellAt(g.x, g.y)] || 0) * 600 + e.streams.search() * 120;
    if (s > bs) { bs = s; best = g; }
  }
  return best;
}
function skLeave(eng, e, r, why) {
  const best = skLeaveGoal(eng, e);
  const P = skBegin(eng, e, 'leave', null, why, { until: eng.now + SK.leaveMax, goal: best });
  if (best) plan(eng, e, best.x, best.y, { why: 'leave' });
  if (r) {                                                                          // (R16d) how long it leaves them alone: the hungrier, the shorter (skLeftFor); fed or mildly hungry as before
    const c = e.hunger >= SK.band[3] ? 0 : rand(e, SK.cooldown[0], SK.cooldown[1]);
    e.left.set(r.id, eng.now + (e.hunger < SK.huntHunger ? c : skLeftFor(e.hunger))); (e.leftAt || (e.leftAt = new Map())).set(r.id, eng.now);
  }
  skKeepSpent(eng, e); skHuntEnd(eng, e, why);
  e.target = null; e.enc = null;
  return P;
}
/* a spot a short way off that the person (where it perceives them) cannot see: it backs out of their line of sight.  bait: a spot round
 * a corner - hidden from the person, from the way they would come after it, and from where it stands now - so that somebody who follows
 * comes round that corner close by; the nearest such spot.  Otherwise the farther the better. */
function skHideSpot(eng, e, from, bait) {
  const geo = eng.geo, line = bait ? [0, .5, .8, 1].map(k => ({ x: from.x + (e.x - from.x) * k, y: from.y + (e.y - from.y) * k })) : [from];
  let best = null, bs = -1e9;
  for (let i = 0; i < (bait ? 32 : 20); i++) {
    const a = e.ang + Math.PI + (i / (bait ? 32 : 20) - .5) * Math.PI * (bait ? 2 : 1.6) + (e.streams.search() - .5) * .2, want = lerp(SK.hide[0], SK.hide[1], e.streams.search());
    const d = Math.min(want, geo.ray(e.x, e.y, a, want + 30) - 30); if (d < 60) continue;
    const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
    if (!geo.clear(x, y, e.rc + 2, 'walk')) continue;
    const unseen = line.filter(q => !geo.los(q.x, q.y, x, y)).length, hidden = !skBodyInSight(geo, from.x, from.y, x, y), far = Math.hypot(x - from.x, y - from.y);   // (R16: all of it hidden)
    const s = (hidden ? 1000 : 0) + (bait ? unseen * 300 - d * .8 : Math.min(far, 900) * .4) - (geo.lamp[geo.cellAt(x, y)] || 0) * 300;
    if (s > bs) { bs = s; best = { x, y, hidden, corner: bait && unseen === line.length }; }
  }
  return best;
}
/* a route under cover: cells the person (as it perceives them) can see, and lit cells, cost more */
function skCover(eng, from) {
  const geo = eng.geo, memo = new Map();
  return j => {
    let c = memo.get(j); if (c !== undefined) return c;
    const x = geo.cx(j), y = geo.cy(j), d = Math.hypot(x - from.x, y - from.y);
    c = (geo.lamp[j] || 0) * 140 + (d < 700 && geo.los(from.x, from.y, x, y) ? 70 : 0);
    memo.set(j, c); return c;
  };
}

/* ---- R1: the hunt - its intent toward one person it has seen, kept above the plans ---- */
function skHuntBegin(eng, e, r, why) {
  const H = e.hunt; if (H && H.pid === r.id) return H;
  const t = r.seen ? eng.now : Math.min(eng.now, Math.max(r.seenAt, r.heardAt));   // (R7) begun from a record: the belief is as old as the record
  e.hunt = { pid: r.id, t0: eng.now, evAt: t, ev: r.seen ? 'seen' : 'remembered', x: r.lkx, y: r.lky, vx: r.lvx, vy: r.lvy, bt: t, u: r.seen ? 20 : 120,
    conf: r.seen ? 1 : Math.max(.3, r.conf), flanks: 0, tries: 0, failed: [], raceAt: -99, listenAt: -99, why, sid: e.mem.soundId || 0, heard: 0, revised: 0,
    hAt: -99, badA: [], altTried: 0, guess: '',                                       // (R2) its last heard evidence; first turns that failed; the other way tried
    // the way it prefers to answer being seen, this time: going round them, or backing round a corner to lure them (the hungrier, the more
    // often round them); the other is tried when the first has failed
    style: skStyle(e) }; e.styleNext = '';
  e.tally.hunt++; e.dbg.hunt = why;
  return e.hunt;
}
function skHuntEnd(eng, e, why) { if (!e.hunt) return; e.dbg.huntEnd = { pid: e.hunt.pid, why: String(why || '').slice(0, 90), at: +eng.now.toFixed(1) }; e.hunt = null; }
/* on its think: what it knows of its quarry now - its own sight (the body itself); otherwise (R2) the body sounds it has heard since its
 * last think that fit where they could be by now; its confidence fades between */
function skHuntTick(eng, e, dt) {
  const H = e.hunt; if (!H) return;
  const r = e.mem.p.get(H.pid), now = eng.now;
  if (!r || tgtGone(eng, e, r)) { skHuntEnd(eng, e, 'its quarry is gone'); return; }
  for (let i = H.failed.length - 1; i >= 0; i--) if (now - H.failed[i].t > SK.failedTtl) H.failed.splice(i, 1);   // (R2) an old failure is forgotten
  if (r.seen && r.visual) { const v = r.visual; if (H.ev !== 'seen' || now - (H.logAt ?? -99) > 2) { skMindLog(e, H, now, 'seen', v.x, v.y, 20, H.ev !== 'seen' ? 'in sight again' : ''); H.logAt = now; } H.x = v.x; H.y = v.y; H.vx = v.vx; H.vy = v.vy; H.bt = now; H.u = 20; H.conf = 1; H.evAt = now; H.ev = 'seen'; H.sid = e.mem.soundId || 0; H.badA.length = 0; return; }   // (R11: the evidence log, a new sighting or every 2 s in sight)
  // (R2) oldest first; a creature's sound (src -1) is never theirs, nor one named for somebody else; nothing here names anybody
  const snd = e.mem.sounds;
  for (let i = snd.length - 1; i >= 0; i--) { const q = snd[i]; if (q.id <= H.sid) continue; H.sid = q.id; if ((q.src === 0 || q.pid === H.pid) && skFits(H, q)) { skHypHeard(eng, e, H, q); skHeardQuarry(e, H, q); } }   // (R12: which of its ways the sound fits, then the belief moves)
  H.conf = Math.max(0, H.conf - dt / skForget(e));
}
/* (R2) could the quarry have made that sound: is it within reach of the last evidence (both uncertainties, and the way a person can go since) */
const skFits = (H, q) => Math.hypot(q.x - H.x, q.y - H.y) <= Math.min(1800, H.u + q.u + 60 + SK.hearReach * Math.max(0, q.t - H.bt));
/* (R2) a sound taken for theirs: the belief moves to where it heard it (fuzzy, as the sound is), with a heading from the last evidence */
function skHeardQuarry(e, H, q) {
  const dt = q.t - H.bt, moved = Math.hypot(q.x - H.x, q.y - H.y);
  if (dt > .25 && dt < 3 && moved > .6 * (q.u + H.u)) {                            // a heading only from a move larger than the sounds' own fuzz
    let vx = (q.x - H.x) / dt, vy = (q.y - H.y) / dt; const sp = Math.hypot(vx, vy); if (sp > 300) { vx *= 300 / sp; vy *= 300 / sp; }
    const k = H.ev === 'seen' ? .35 : .5; H.vx = lerp(H.vx, vx, k); H.vy = lerp(H.vy, vy, k);
  } else if (dt >= 3) { H.vx *= .5; H.vy *= .5; }
  H.x = q.x; H.y = q.y; H.u = q.u; H.bt = q.t; H.evAt = q.t; H.ev = 'heard'; H.hAt = q.t; H.heard++; e.tally.heardQ++; H.badA.length = 0;   // (new evidence: its turns are thought afresh)
  H.conf = Math.max(H.conf, lerp(SK.hearConf[0], SK.hearConf[1], clamp(q.I, 0, 1)));
  skMindLog(e, H, q.t, 'heard', q.x, q.y, q.u, q.type || 'a sound');                 // (R11) anonymous: a sound that fits where they could be
}
/* (R2) open floor at or near a point (rings of 8 out to 200 px; the level's shape only), or null */
function skFloorNear(eng, e, x, y) {
  const geo = eng.geo, c = e.rc + 2; if (geo.clear(x, y, c, 'walk')) return { x, y };
  for (let R = 40; R <= 200; R += 40) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, qx = x + Math.cos(a) * R, qy = y + Math.sin(a) * R; if (geo.clear(qx, qy, c, 'walk')) return { x: qx, y: qy }; }
  return null;
}
/* (R2) its belief as a record of the kind skPredict reads (a place, a heading, when): its own evidence, never the engine's record */
const skBeliefRec = H => ({ id: H.pid, lkx: H.x, lky: H.y, lvx: H.vx, lvy: H.vy, seenAt: H.bt, heardAt: H.bt });
function skFailed(H, x, y, now, k) { H.failed.push({ x: Math.round(x), y: Math.round(y), t: now, k }); while (H.failed.length > 4) H.failed.shift(); skMindLog(null, H, now, 'disproved', x, y, 0, k); }
function skBadTurn(H, a) { H.badA.push(a); while (H.badA.length > 3) H.badA.shift(); }
/* (R1) its preferred answer to being seen, drawn once for the next hunt from its own stream */
const skStyle = e => e.styleNext || (e.styleNext = e.huntRng() < lerp(.3, .75, sm(.4, .8, e.hunger)) ? 'flank' : 'bait');
const skForget = e => lerp(SK.forget[0], SK.forget[1], e.hunger) * (.85 + .3 * e.tr.PERSISTENCE);
const skTries = e => Math.round(lerp(SK.huntTries[0], SK.huntTries[1], sm(.4, .95, e.hunger)));   // (R2) guesses in one hunt
/* where it believes its quarry is now: the last evidence carried along their heading (not through a wall), the uncertainty growing */
function skBelief(eng, e, H) {
  const age = Math.max(0, eng.now - H.bt), sp = Math.hypot(H.vx, H.vy);
  let D = Math.min(sp * Math.min(age, 3.5) * .6, 600);
  if (D > 0 && sp > 20) D = Math.max(0, Math.min(D, eng.geo.ray(H.x, H.y, Math.atan2(H.vy, H.vx), D + 40) - 34));
  return { x: H.x + (sp > 20 ? H.vx / sp * D : 0), y: H.y + (sp > 20 ? H.vy / sp * D : 0), u: H.u + 60 + age * 90 };
}
/* a person it may hunt now: not on its cooldown list - or, starving, one it left a while ago and now sees again, with effort left for them */
function skMayHunt(eng, e, r) {
  if (!e.left.has(r.id)) return true;
  if (e.hunger < SK.huntHunger || !r.seen) return false;                              // (R16d: from mild hunger up - R8 only starving - and only on sight)
  const at = e.leftAt && e.leftAt.get(r.id);
  return at !== undefined && eng.now - at >= skRefractory(e.hunger) && skCarried(eng, e, r.id) < skBudget(e) * .85;   // (R16d: the hungrier, the sooner - skRefractory)
}
/* a spot at their side that they cannot see (from where it perceives them): no farther from them than it is now, reachable, dark rather
 * than lit; a few candidates by straight line, then (R13) the best SKC.tries asked for a COVERT WAY (ai.skin.cover.js: out of every view it
 * knows of after a withdrawal straight away from them, audited point by point) - R8 took the first whose route was short, however exposed.
 * R (R13): the band of distances from them to look in (default: from SK.flankMin to where it is) */
function skFlankSpot(eng, e, p, d, pid, R, rng) {
  // (R13) within a rush of them where it can (an ambush must be near enough to be sprung); out of their view by their screen's rules - behind
  // something, or in the dark where it can watch them without being made out (better: it sees them come)
  const geo = eng.geo, a0 = Math.atan2(e.y - p.y, e.x - p.x), cands = [], rmin = R ? R[0] : SK.flankMin, rmax = R ? R[1] : Math.max(SK.flankMin + 40, Math.min(d, SKC.rush - 30));
  const obs = skWatchers(eng, e, pid || 0), why = [], po = obs.find(o => o.pid === pid && o.seen);
  const rnd = rng || e.streams.search;                                            // (R8's flank: its own draws, as before; R13's other uses: e.coverRng)
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, off = side * lerp(.75, 1.9, ((i >> 1) + rnd() * .6) / 7), Rr = clamp(lerp(rmin, rmax, .55 + .4 * rnd()), rmin, Math.max(rmin, rmax));
    const a = a0 + off, x = p.x + Math.cos(a) * Rr, y = p.y + Math.sin(a) * Rr;
    if (!geo.clear(x, y, e.rc + 2, 'walk')) continue;
    const los = skBodyInSight(geo, p.x, p.y, x, y); if (los && (!po || skSpotExposed(eng, po, x, y))) continue;   // it must be out of their view (R16: all of it, as drawn waiting)
    const lamp = geo.lamp[geo.cellAt(x, y)] || 0, way = Math.hypot(x - e.x, y - e.y);
    cands.push({ x, y, R: Rr, s: -way * .6 - lamp * 300 - Math.abs(Math.abs(off) - 1.2) * 120 + (los ? 150 : 0) + rnd() * 60 });
  }
  cands.sort((a, b) => b.s - a.s);
  for (const c of cands.slice(0, SKC.tries)) {
    const W = skCovertWay(eng, e, c.x, c.y, obs, Math.max(1600, d * 4.5));       // (no longer than this: it would be there long after they have moved)
    if (W.ok) return { x: c.x, y: c.y, L: W.len, way: W };
    why.push(W.why + (W.seenAt ? '@' + W.seenAt.join(',') : W.len ? ':' + W.len : ''));
  }
  e.dbg.cover = { at: +eng.now.toFixed(1), k: R ? 'nearer' : 'flank', why: why.join('/') || 'no_spot' };
  return null;
}
/* (R19) what a way round is worth, by the time it would take: its covert way's withdrawal (at its stalk), its hidden run (at its run), its
 * quiet last stretch (SKC.sprintFrom + SKC.settle, at its stalk) and its settling there (SK.flankSettle).  Somebody it sees moving (over
 * 60 px/s) will not wait for it: carried on as it sees them going (their seen velocity - no route, no knowledge of where they mean to go),
 * where they would be when it got there lies within SKC.rush of its spot, or there is no way round them (the owner's "clever but absent"
 * detour after a walker; the independent review: a soft weight let it be taken a think later anyway).  Somebody standing still is there
 * when it arrives - but a long way round is time it is not on them: beyond what coming on openly would take (at its press when it may
 * run, else its prowl) it may spend SK.detour (by its hunger: the hungrier, the less), and the more it is over, the less the way round is
 * worth (Scene B: a starving one presses rather than vanish for ten seconds).  f: 1 .. .15 (somebody moving: 1 or 0).  Its paces as they are now (skSpeed: tired, slower), its own route and
 * its own sight of them only */
function skFlankWorth(e, p, d, fs) {
  const L = fs.way ? fs.way.len : fs.L, exit = fs.way ? Math.min(L, fs.way.exit || 0) : 0, quiet = Math.min(L - exit, SKC.sprintFrom + SKC.settle), stalk = skSpeed(e, 'stalk');
  const etaF = exit / stalk + Math.max(0, L - exit - quiet) / skSpeed(e, 'run') + quiet / stalk + SK.flankSettle, v = Math.hypot(p.vx, p.vy);   // (its paces as they are now: tired, slower)
  const vOpen = e.hunger >= SK.chaseHunger ? lerp(skSpeed(e, 'investigate'), skSpeed(e, 'press'), sm(SK.chaseHunger, .8, e.hunger)) : skSpeed(e, 'prowl'), etaD = d / vOpen;
  if (v > 60) {                                                                  // (somebody moving: by then beyond its spring of the spot - no way round, whatever else it weighs)
    const off = Math.hypot(p.x + p.vx * etaF - fs.x, p.y + p.vy * etaF - fs.y);
    return { etaF: +etaF.toFixed(1), etaD: +etaD.toFixed(1), v: Math.round(v), off: Math.round(off), f: off <= SKC.rush ? 1 : 0 };
  }
  const B = lerp(SK.detour[0], SK.detour[1], sm(SK.chaseHunger, .9, e.hunger)), over = etaF - etaD - B;
  return { etaF: +etaF.toFixed(1), etaD: +etaD.toFixed(1), B: +B.toFixed(1), f: over <= 0 ? 1 : clamp(1 - over / B, .15, 1) };
}
/* (R19) where an open approach heads (the S track's "short contest"): at them - or, from SK.contestFrom near and beyond its footwork's
 * range, hungry, with them in its sight and standing (seen at 60 px/s or less: somebody walking or running is R18's open approach and
 * chase, unchanged), for their way out when it lies to their side (a doorway, a side passage: skWayOut, the reckoning its footwork
 * already uses), a little way out along it (30 % of the distance, 100-200 px, short of the wall), where it can stand and reach them, and
 * that it can walk straight to with them in its sight all the way: what it cuts off is the way they would take.  Kept while they stay
 * within SK.contestKeep of where it chose it (no flicker); they can still take another way, or turn back.  Its own sight of them and the level's shape only.  Returns the point to head for (they themselves, or
 * the point by their way out) */
function skContest(eng, e, r, p, d, P) {
  const now = eng.now, geo = eng.geo;
  if (P.mode !== 'open' || P.shadow || P.rush || !r.seen || d <= SKF.near || d > SK.contestFrom || e.hunger < SK.huntHunger || e.disguise || Math.hypot(p.vx, p.vy) > 60) { P.cp = null; return p; }
  const K = P.cp;
  if (K && Math.hypot(p.x - K.rx, p.y - K.ry) < SK.contestKeep) return K.c ? K : p;
  const way = skWayOut(geo, e, p, p.vx, p.vy), off = Math.abs(angDiff(way, Math.atan2(p.y - e.y, p.x - e.x)));
  let c = null;
  if (off >= SK.contestOff) {
    const k = Math.min(clamp(d * .3, 100, 200), geo.ray(p.x, p.y, way, 240) - e.rc - 20);
    if (k >= 60) { const x = p.x + Math.cos(way) * k, y = p.y + Math.sin(way) * k;
      // (the independent review: a point it had to reach by a route out of their sight took it out of its own sight of them - lost, it
      // listened and searched; so only a point it can walk straight to with them in its sight all the way, else at them, as R18)
      const L = Math.hypot(x - e.x, y - e.y), n = Math.max(1, Math.ceil(L / 60));
      let seen = geo.clear(x, y, e.rc + 2, 'walk') && geo.lineClear(x, y, p.x, p.y, e.rc, 'walk') && geo.lineClear(e.x, e.y, x, y, e.rc + 7, 'walk');   // (7: the shared route margin, NAV_MARGIN)
      for (let i = 1; i <= n && seen; i++) seen = geo.los(e.x + (x - e.x) * i / n, e.y + (y - e.y) * i / n, p.x, p.y);
      if (seen) c = { x, y }; }
  }
  P.cp = { rx: p.x, ry: p.y, c: !!c, x: c ? c.x : p.x, y: c ? c.y : p.y, way: +way.toFixed(2) };
  if (c) { e.tally.contest++; e.dbg.pos = { at: +now.toFixed(2), k: 'contest', pid: r.id, why: `it heads for P${r.id}'s way out (${Math.round(off * 57.3)} deg off straight beyond them)` }; }
  return c ? P.cp : p;
}
/* the hunt has no plan and the quarry is out of sight: listen first, then its next guess (skGuess); or give up for a reason.  pre: what
 * ended the last step (it begins the reason given) */
function skHuntNext(eng, e, pre) {
  const H = e.hunt, now = eng.now, r = e.mem.p.get(H.pid), P0 = pre ? pre + ': ' : '';
  if (!r || tgtGone(eng, e, r)) { skHuntEnd(eng, e, 'its quarry is gone'); return; }
  const age = Math.round(now - H.evAt);
  if (e.exh) { skLeave(eng, e, r, `${P0}exhausted: it lets P${r.id} go`); return; }
  if (H.conf < SK.huntLow) { e.tally.huntCold++; skLeave(eng, e, r, `${P0}no sign of P${r.id} for ${age} s: it gives up`); return; }
  if (now - H.listenAt > 6) { skListenLost(eng, e, r, `${P0}it has lost P${r.id}: it stands still and listens`); return; }
  if (H.tries >= skTries(e)) { e.tally.huntCold++; skLeave(eng, e, r, `${P0}it searched for P${r.id} ${H.tries} times: it gives up`); return; }
  const G = skGuess(eng, e, H);
  if (!G) { e.tally.huntCold++; skLeave(eng, e, r, `${P0}nowhere left to look for P${r.id}: it gives up`); return; }
  H.tries++; H.guess = G.k; skMindLog(e, H, now, 'inferred', G.x ?? G.g.qx, G.y ?? G.g.qy, H.u, G.k + (G.hyp ? ` way ${G.hyp} p ${(H.hyp.list.find(h => h.id === G.hyp) || { p: 0 }).p.toFixed(2)}` : ''));   // (R11) its guess, as evidence it made itself
  if (G.k === 'intercept') { skIntercept(eng, e, r, G.g, P0); return; }
  if (G.k === 'alt') { H.altTried = now; e.tally.alt++; }
  skSearch(eng, e, r, P0 + (G.k === 'alt' ? `it tries the other way P${r.id} could have gone` : G.k === 'route' ? `it goes the way it thinks P${r.id} went (${H.ev} ${age} s ago)` : G.k === 'last' ? `it goes back to where it last had P${r.id} (${H.ev} ${age} s ago)` : G.k === 'open' ? `it tries a way P${r.id} could have left by (no heading: ${H.ev} ${age} s ago)` : `it goes to where it believes P${r.id} is (${H.ev} ${age} s ago)`), { x: G.x, y: G.y }, { turnA: G.a ?? null });
}
/* (R2) its next guess, from its belief only: the way it predicts they went (while that is fresh enough to get ahead of them: an
 * interception), where they would be by now along that way, the other way at the same first turn, where it believes they are, the place
 * it last had them.  Each is scored; a place near a guess that failed is not a candidate, nor a turn that failed (H.badA, forgotten when
 * new evidence comes); a seeded element (its own stream, less for the cleverer) lets it choose wrong.  It never looks at where they
 * really are. */
function skGuess(eng, e, H) {
  const now = eng.now, age = now - H.bt, B = skBelief(eng, e, H), C = [], rej = [], geo = eng.geo, rec = skBeliefRec(H), run = skSpeed(e, 'run');
  const near = (x, y) => H.failed.some(f => f.t > H.bt && Math.hypot(f.x - x, f.y - y) < SK.failedNear);   // (a failure older than its newest evidence no longer counts)
  const ok = q => q && !near(q.x, q.y) && geo.clear(q.x, q.y, e.rc + 2, 'walk');
  const stopped = H.ev === 'heard' && H.heard >= 2 && age > 1.5;                    // footsteps that stopped: they are likely near where they stopped
  const along = R => { let i = Math.min(R.pts.length - 1, Math.round(clamp(140 * age + 150, 250, SK.predictLook) / 48)); while (i > 2 && !geo.clear(R.pts[i].x, R.pts[i].y, e.rc + 2, 'walk')) i--; return R.pts[i]; };
  // (R12) the ways it holds (skHyps): each guess is labelled with the way it lies on, weighed by how likely that way is now, and a guess on
  // a way that evidence has ruled out (a sound that does not fit it, an empty place, a failed turn) is not made
  const Y = skHyps(eng, e, H), pm = Math.max(...Y.list.map(h => h.p)), wt = h => h ? Math.max(-1.2, .45 * Math.log(Math.max(1e-3, h.p) / pm)) : 0;
  const way = (k, x, y) => { const h = skHypOf(Y, x, y); if (h && h.f < 1) { rej.push([k, h.id, 'disproved']); return false; } if (h && h.p < SKI.minP) { rej.push([k, h.id, 'unlikely']); return false; } return h || null; };
  if (Math.hypot(H.vx, H.vy) > 60 && age < SKI.fresh) {                          // its walk of their way (R8's, its seeded error), while fresh enough to get ahead
    const g = skPredict(eng, e, rec);
    if (!g) rej.push(['intercept', 0, 'late_to_intercept']);
    else if (near(g.qx, g.qy) || near(g.x, g.y) || (g.turns.length && H.badA.some(b => Math.abs(angDiff(g.turns[0].a, b)) < .3))) rej.push(['intercept', 0, 'disproved']);
    else { const h = way('intercept', g.qx, g.qy); if (h !== false) { g.hyp = h ? h.id : 0; C.push({ k: 'intercept', g, hyp: g.hyp, s: 1.2 + wt(h) }); } }
  } else rej.push(['intercept', 0, Math.hypot(H.vx, H.vy) > 60 ? 'evidence_stale' : 'no_heading']);
  const R1 = skRoute(eng, e, rec, H.badA.length ? { avoid: H.badA } : null);
  if (R1) {
    const q = along(R1), h = q && way('route', q.x, q.y);
    if (h !== false) { if (ok(q)) C.push({ k: 'route', hyp: h ? h.id : 0, x: q.x, y: q.y, a: R1.turns.length ? R1.turns[0].a : null, s: (stopped ? .85 : H.ev === 'heard' ? 1.05 : 1) + wt(h) }); else rej.push(['route', h ? h.id : 0, q && near(q.x, q.y) ? 'disproved' : 'no_floor']); }
    if (R1.turns.length) { const R2 = skRoute(eng, e, rec, { avoid: H.badA.concat([R1.turns[0].a]) }); if (R2 && R2.turns.length) { const q2 = along(R2), h2 = q2 && way('alt', q2.x, q2.y);
      if (h2 !== false) { if (ok(q2)) C.push({ k: 'alt', hyp: h2 ? h2.id : 0, x: q2.x, y: q2.y, a: R2.turns[0].a, s: (H.badA.length ? 1.05 : .8) + wt(h2) }); else rej.push(['alt', h2 ? h2.id : 0, q2 && near(q2.x, q2.y) ? 'disproved' : 'no_floor']); } } }
  } else rej.push(['route', 0, 'no_heading']);
  const b = skFloorNear(eng, e, B.x, B.y), L = skFloorNear(eng, e, H.x, H.y);          // (a heard place is fuzzy: it may fall in a wall)
  if (ok(b) && !C.some(c => Math.hypot((c.x ?? c.g.x) - b.x, (c.y ?? c.g.y) - b.y) < 120)) { const h = way('belief', b.x, b.y); if (h !== false) C.push({ k: 'belief', hyp: h ? h.id : 0, x: b.x, y: b.y, s: (stopped ? 1.25 : H.ev === 'heard' ? 1.1 : .9) + wt(h) }); }
  else rej.push(['belief', 0, b ? (near(b.x, b.y) ? 'disproved' : 'on_a_way') : 'no_floor']);
  if (ok(L) && (!b || Math.hypot(b.x - L.x, b.y - L.y) > 150)) C.push({ k: 'last', x: L.x, y: L.y, s: .6 });
  // (R18, the owner's section 7: "check an adjacent opening ... abandon a bad guess and evaluate another") with no heading to go on - they
  // were still when it last had them - the open ways out of that place: from where it last had them, the directions with open floor, as
  // far along each as somebody leaving that way would be by now.  The level's shape only: never where they are.  Weaker than any guess
  // from evidence; one that fails is not tried again (near).  R8-R16i: with no heading, once the place itself was empty, it gave up
  if (Math.hypot(H.vx, H.vy) <= 60 && e.hunger >= SK.huntHunger) {
    const reach = clamp(140 * age + 150, 250, 700);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU, Rr = geo.ray(H.x, H.y, a, reach + 60); if (Rr < 250) continue;
      const q = skFloorNear(eng, e, H.x + Math.cos(a) * Math.min(reach, Rr - 50), H.y + Math.sin(a) * Math.min(reach, Rr - 50));
      if (!ok(q) || C.some(c => Math.hypot((c.x ?? c.g.x) - q.x, (c.y ?? c.g.y) - q.y) < 200)) continue;
      const h = way('open', q.x, q.y); if (h === false) continue;
      C.push({ k: 'open', hyp: h ? h.id : 0, x: q.x, y: q.y, a, s: .5 + wt(h) });
    }
  }
  for (const c of C) c.s += (e.huntRng() - .5) * .5 * (1.3 - e.tr.INTELLIGENCE);
  // (R12) a way it holds that none of these lies on, likely enough: where they would be along it by now is a guess too (after R8's draws)
  for (const h of Y.list) {
    if (h.k === 'stop' || C.some(c => c.hyp === h.id)) continue;
    if (h.f < 1) { rej.push(['way', h.id, 'disproved']); continue; }
    if (h.p < SKI.minP) { rej.push(['way', h.id, 'unlikely']); continue; }
    const q = skHypAt(Y, h, now, geo, e.rc + 2); if (!ok(q)) { rej.push(['way', h.id, q && near(q.x, q.y) ? 'disproved' : 'no_floor']); continue; }
    C.push({ k: 'way', hyp: h.id, x: q.x, y: q.y, a: h.turns.length ? h.turns[0].a : null, s: .75 + wt(h) + (e.huntRng() - .5) * .5 * (1.3 - e.tr.INTELLIGENCE) });
  }
  // (R12) time and uncertainty: a place far away is reached late, and by then they could be anywhere within a wider ring - weaker
  for (const c of C) {
    const x = c.x ?? c.g.x, y = c.y ?? c.g.y, T = Math.hypot(x - e.x, y - e.y) * 1.2 / run, u = B.u + 90 * T;
    c.T = +T.toFixed(1); c.u = Math.round(u); c.s -= .02 * T + (u > SKI.uWeak ? .2 : 0);
  }
  C.sort((a, b) => b.s - a.s || a.k.localeCompare(b.k));
  for (const c of C.slice(1)) rej.push([c.k, c.hyp || 0, 'less_likely']);
  Y.bet = C.length ? C[0].hyp || 0 : 0;
  e.dbg.guess = { at: +now.toFixed(1), k: C.length ? C[0].k : '-', hyp: Y.bet, of: C.map(c => c.k).join('/'), rej: rej.slice(0, 8) };
  H.rej = rej.slice(0, 8);
  return C[0] || null;
}
function skListenLost(eng, e, r, why) {
  const H = e.hunt; if (H) H.listenAt = eng.now;
  e.tally.listenLost++;
  skBegin(eng, e, 'listen', r, why, { until: eng.now + rand(e, SK.listenLost[0], SK.listenLost[1]) * (1.3 - .6 * sm(.5, 1, e.hunger)), look0: e.ang });
}

/* ---- T3: lying in wait, prediction, interception, a short chase, searching; all from its own evidence ---- */
/* where it believes they are going, and where it can be first: from the last record (place and heading, seen or heard) it walks their
 * heading through the level; where something blocks the way it guesses which side they take (the turn that best keeps the heading, plus
 * a seeded error that INTELLIGENCE shrinks and starvation grows; at most SK.predictTurns guesses).  On that route it takes the first point
 * it can reach before them (their speed from the record, its own run speed, a rough path factor) and, beside it, a spot out of sight of
 * anybody coming along the route.  It can be wrong: it never looks at where they really went. */
/* (R2) their way through the level from a record: Trial 3's walk, on its own (the same draws, in the same order).  o.avoid: angles it
 * will not take at the first turn - the other way, once the first guess there has failed */
function skRoute(eng, e, r, o) {
  const geo = eng.geo, sp = Math.hypot(r.lvx, r.lvy); if (sp < 40) return null;
  const walk = (x, y, a, d) => geo.lineClear(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, 16, 'walk');   // where a person can walk (sight passes over low walls; feet do not)
  let th = Math.atan2(r.lvy, r.lvx), x = r.lkx, y = r.lky, s = 0;
  const pts = [{ x, y, s: 0 }], turns = [];
  while (s < SK.predictLook) {
    if (!walk(x, y, th, 100)) {                                                  // something in the way: which side would they take?
      if (turns.length >= SK.predictTurns) break;
      let best = null, bs = -1e9, n = 0;
      for (let k = -4; k <= 4; k++) {
        if (!k) continue;
        const a = th + k * Math.PI / 8; if (!walk(x, y, a, 210)) continue;
        if (o && o.avoid && !turns.length && o.avoid.some(b => Math.abs(angDiff(a, b)) < Math.PI / 5)) continue;
        n++; const sc = Math.cos(k * Math.PI / 8) + (e.streams.search() - .5) * (1.35 - e.tr.INTELLIGENCE) * 1.6 * (e.hunger >= SK.band[3] ? 1.6 : 1);
        if (sc > bs) { bs = sc; best = a; }
      }
      if (best === null) break;                                                  // a dead end: they will have to come back this way
      turns.push({ x: Math.round(x), y: Math.round(y), a: +(((best % TAU) + TAU) % TAU).toFixed(2), n }); th = best;
    }
    x += Math.cos(th) * 48; y += Math.sin(th) * 48; s += 48; pts.push({ x, y, s });
  }
  return pts.length < 5 ? null : { pts, turns, s };
}
function skPredict(eng, e, r) {
  const R = skRoute(eng, e, r); if (!R) return null;
  e.tally.predQ = (e.tally.predQ || 0) + 1;
  const geo = eng.geo, sp = Math.hypot(r.lvx, r.lvy), { pts, turns, s } = R;
  // the first point of that route it can be at before them: a quick estimate, then its own route there (at most four routes worked out)
  const age = eng.now - Math.max(r.seenAt, r.heardAt), v = clamp(sp, 90, 300), run = skSpeed(e, 'run');
  let q = null, tries = 0;
  let slack = 0, qL = 0, qLeft = 0;
  for (const c of pts) {
    if (c.s < 160) continue;
    const left = c.s / v - age - SK.predictMargin;                               // the seconds before they are there
    if (Math.hypot(c.x - e.x, c.y - e.y) * 1.15 / run >= left) continue;
    if (++tries > 4) break;
    const way = geo.path(e.x, e.y, c.x, c.y, e.caps, { maxNodes: 3000 }); e.tally.pathQ = (e.tally.pathQ || 0) + 1; if (!way) continue;
    let L = 0, ax = e.x, ay = e.y; for (const w of way) { L += Math.hypot(w.x - ax, w.y - ay); ax = w.x; ay = w.y; }
    if (L / run < left) { q = c; slack = left - L / run; qL = L; qLeft = left; break; }   // (R12: how much sooner it is there than they are, on its real route)
  }
  if (!q) return null;                                                           // it cannot get ahead of them
  const qi = pts.indexOf(q), back = pts[Math.max(0, qi - 4)];                     // where somebody coming along the route is just before
  const comes = [2, 4, 6, 8].map(k => pts[Math.max(0, qi - k)]);                  // (R13) the way they come: hidden from all of it, not from one point
  let S0 = null, bs = -1e9;
  for (let k = 0; k < 16; k++) {                                                 // a spot beside that point, out of sight of the way they come
    const a = e.streams.search() * TAU, d = 40 + e.streams.search() * 140, sx = q.x + Math.cos(a) * d, sy = q.y + Math.sin(a) * d;
    if (!geo.clear(sx, sy, e.rc + 2, 'walk') || !geo.lineClear(q.x, q.y, sx, sy, e.rc, 'walk')) continue;
    const hidden = comes.every(c => !skBodyInSight(geo, c.x, c.y, sx, sy)), sc = (hidden ? 500 : 0) - d * .6 - (geo.lamp[geo.cellAt(sx, sy)] || 0) * 250;   // (R16: all of it)
    if (sc > bs) { bs = sc; S0 = { x: sx, y: sy, hidden }; }
  }
  if (!S0) { if (!geo.clear(q.x, q.y, e.rc + 2, 'walk')) return null; S0 = { x: q.x, y: q.y, hidden: false }; }
  return { x: S0.x, y: S0.y, hidden: S0.hidden, qx: q.x, qy: q.y, jx: back.x, jy: back.y, end: s < SK.predictLook && pts.length > 1, from: { x: r.lkx, y: r.lky },
    heading: +Math.atan2(r.lvy, r.lvx).toFixed(3), turns, options: turns.length ? turns[0].n : 1, lead: Math.round(q.s), slack: +slack.toFixed(2),
    L: Math.round(qL), due: +(eng.now + qLeft).toFixed(2) };   // (R20) its route's length; when it must be there (their arrival less SK.predictMargin)
}
/* (R20) going ahead of somebody it sees walking on unaware: along the way they will go (skRoute), the first point it can reach SK20.aheadSlack s
 * before them at its run (it will go at the pace that needs: skPace) with a spot beside it hidden from the way they come (as skPredict's,
 * drawn from its cover stream; its route queries use the search stream, as skPredict's do, so later draws can differ - the review).  At
 * most six routes worked out; none, and it comes on as before */
function skAhead(eng, e, r) {
  const R = skRoute(eng, e, r); if (!R) return null;
  e.tally.predQ = (e.tally.predQ || 0) + 1;                                         // (a prediction, as skPredict's: R12-B bounds its routes by these)
  const geo = eng.geo, sp = Math.hypot(r.lvx, r.lvy), { pts, turns, s } = R, v = clamp(sp, 90, 300), run = skSpeed(e, 'run'), age = eng.now - Math.max(r.seenAt, r.heardAt);
  let tries = 0;
  for (let qi = 5; qi < pts.length; qi += 2) {                                    // (every other point of the way: 96 px apart)
    const q = pts[qi], left = q.s / v - age - SK.predictMargin;
    if (Math.hypot(q.x - e.x, q.y - e.y) * 1.15 / run >= left - SK20.aheadSlack) continue;
    if (e.hunt && e.hunt.failed.some(f => Math.hypot(f.x - q.x, f.y - q.y) < SK.failedNear)) continue;   // (a place its hunt found empty)
    // a spot beside it, hidden from the way they come (where the way passes a corner, a doorway, a side passage): the cheap test first
    const comes = [2, 4, 6].map(k => pts[Math.max(0, qi - k)]); let S0 = null, bs = -1e9;
    for (let k = 0; k < 16; k++) {
      const a = e.coverRng() * TAU, d = 40 + e.coverRng() * 160, sx = q.x + Math.cos(a) * d, sy = q.y + Math.sin(a) * d;
      if (!geo.clear(sx, sy, e.rc + 2, 'walk') || !geo.lineClear(q.x, q.y, sx, sy, e.rc, 'walk')) continue;
      if (!comes.every(c => !skBodyInSight(geo, c.x, c.y, sx, sy))) continue;
      const sc = -d * .6 - (geo.lamp[geo.cellAt(sx, sy)] || 0) * 250; if (sc > bs) { bs = sc; S0 = { x: sx, y: sy }; }
    }
    if (!S0) continue;
    if (++tries > 4) break;
    const way = geo.path(e.x, e.y, S0.x, S0.y, e.caps, { maxNodes: 3000 }); e.tally.pathQ = (e.tally.pathQ || 0) + 1; if (!way) continue;
    let L = 0, ax = e.x, ay = e.y; for (const w of way) { L += Math.hypot(w.x - ax, w.y - ay); ax = w.x; ay = w.y; }
    if (L / run >= left - SK20.aheadSlack) continue;
    const back = pts[Math.max(0, qi - 4)];
    return { x: S0.x, y: S0.y, hidden: true, qx: q.x, qy: q.y, jx: back.x, jy: back.y, end: s < SK.predictLook && pts.length > 1, from: { x: r.lkx, y: r.lky },
      heading: +Math.atan2(r.lvy, r.lvx).toFixed(3), turns, options: turns.length ? turns[0].n : 1, lead: Math.round(q.s), slack: +(left - L / run).toFixed(2), L: Math.round(L), due: +(eng.now + left).toFixed(2) };
  }
  return null;
}
/* (R12) a stand-in for a hunt, from a record's last evidence (before a hunt begins): only what skHyps reads */
const skHypSrc = r => ({ pid: r.id, x: r.lkx, y: r.lky, vx: r.lvx, vy: r.lvy, bt: Math.max(r.seenAt, r.heardAt), u: 20, ev: 'seen', heard: 0, badA: [], failed: [], hyp: null });
/* (R13) at a hidden spot near somebody it hunts: a nearer hidden spot within its spring by a covert way (an ambush point); or, very
 * hungry and near enough, it breaks cover and rushes them (open: they can see it come); or it waits for them there, out of their sight */
function skFromCover(eng, e, r, pre, again) {
  const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y), H = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
  const s = d > SK.pounceRange[1] ? skFlankSpot(eng, e, p, d, r.id, [SK.pounceRange[0] + 45, Math.max(SK.pounceRange[0] + 45, Math.min(SK.pounceRange[1] - 15, d - 60))], e.coverRng) : null;
  if (s) { skBegin(eng, e, 'approach', r, `${pre}: it creeps nearer under cover (${s.L} px)`, { side: 1, mode: 'covert', spot: s, way: s.way, tp: { x: p.x, y: p.y, v: Math.hypot(p.vx, p.vy) } });
    e.path = s.way.pts.slice(); e.goal = { x: s.x, y: s.y }; e.goalKey = 'covert'; e.pathAge = 0; return; }
  // (R18) the hungrier, the farther it breaks cover from: SKC.rush (360 px) at SK.chaseHunger .. SK.closeFrom (450) from .8.  Its flank's spot
  // lies within SKC.rush - 30 of where it believed them when it set out; somebody who only shifted about meanwhile left it 350-360 px off,
  // and it lay in wait for them to come, then listened and searched for a person still standing there (the dithering scene, S3)
  const rushD = lerp(SKC.rush, SK.closeFrom, sm(SK.chaseHunger, .8, e.hunger));
  if (e.hunger >= SK.chaseHunger && !e.exh && d < rushD && (r.seen || (H && H.conf >= .3))) { skBegin(eng, e, 'approach', r, `${pre}: no cover nearer - it breaks cover and rushes ${r.seen ? 'P' + r.id : 'where P' + r.id + ' was'}`, { mode: 'open', rush: 1 }); return; }
  if (again) { e.plan = null; if (H && !e.exh && H.conf >= SK.huntLow) skHuntNext(eng, e, pre); else skLeave(eng, e, r, `${pre}: it gives up on P${r.id}`); return; }   // (a second wait here: it hunts on, or goes)
  skBegin(eng, e, 'ambush', r, `${pre}: it waits there for them, out of their sight`, { until: eng.now + (e.hunger >= SK.chaseHunger ? 3 + 3 * e.tr.PATIENCE : SK.lure[0] + SK.lure[1] * e.hunger * e.tr.PATIENCE) }).face = { x: p.x, y: p.y };   // (very hungry, a short wait)
}
/* (R13) a covert move under way: the way it planned (a covert way), its phase - the WITHDRAWAL out of their view, then HIDDEN (it runs once
 * well hidden, slowing near the end to arrive quietly) - and, each think, whether anybody it sees can see it now: then its surprise is
 * spoiled (skCompromised).  Returns true when it has arrived */
function skCovertStep(eng, e, P, dt, thinkNow, r) {
  const W = P.way, goal = W.pts[W.pts.length - 1];
  if (P.lx === undefined) { P.lx = e.x; P.ly = e.y; P.done = 0; P.phase = W.exit > 0 ? 'exit' : 'hidden'; P.hidAt = P.phase === 'hidden' ? -SKC.sprintFrom : -1; P.wi = 0; P.pwi = -1; }   // (hidden from the start: it may run at once)
  P.done += Math.hypot(e.x - P.lx, e.y - P.ly); P.lx = e.x; P.ly = e.y;
  if (P.phase === 'exit' && P.done >= W.exit - 4) { P.phase = 'hidden'; P.hidAt = P.done; }
  if (thinkNow) {
    const by = skCaught(eng, e);
    if (P.phase === 'exit') { if (P.done > W.exit + 48 && by.length) { skCompromised(eng, e, P, r, by, 'its withdrawal did not take it out of their sight'); return 'failed'; } }
    else if (by.length) return skCompromised(eng, e, P, r, by, '') ? 'moving' : 'failed';
  }
  const left = Math.hypot(goal.x - e.x, goal.y - e.y);
  const run = P.phase === 'hidden' && P.done - P.hidAt >= SKC.sprintFrom && left > SKC.settle;
  const act = P.phase === 'exit' ? 'back' : run ? 'intercept' : 'creep';
  if (e.act !== act) setAct(e, act);
  if (P.phase === 'hidden') { const G = SKC.glance, c = Math.floor((eng.now - P.t0) / G[0]), g = (eng.now - P.t0) - c * G[0]; skHeadTo(e, g < G[1] ? (c % 2 ? 1 : -1) * G[2] * Math.sin(Math.PI * g / G[1]) : 0, dt); }   // (it looks back over its shoulder as it goes)
  const st = skCovertFollow(eng, e, P, run ? (P.g && P.need ? skPace(e, P) : skSpeed(e, 'run')) : skSpeed(e, 'stalk'), dt);   // (R20: an interception's, at the pace it needs)
  if (st === 'stuck') {                                                          // (stuck: a new covert way from here, or the covert move is over)
    const W2 = skCovertWay(eng, e, goal.x, goal.y, skWatchers(eng, e, P.pid)); e.stuck = 0;
    if (W2.ok && !W2.exit) { P.way = W2; P.wi = 0; P.pwi = -1; return 'moving'; }
    e.dbg.cover = { at: +eng.now.toFixed(1), k: P.k, why: 'stuck on its covert way: ' + W2.why }; return 'failed';
  }
  return st;
}
/* (R13) seen on its covert way (SURPRISE COMPROMISED): it never goes on as if unseen.  Once it may duck back out of their sight along a new
 * covert way to the same place; very hungry and near, it comes on openly instead; otherwise it stands off where they can see it, or goes */
function skCompromised(eng, e, P, r, by, why0) {
  const now = eng.now; e.tally.compromised = (e.tally.compromised || 0) + 1;
  const who = by.map(id => id ? 'P' + id : 'somebody it heard').join(', ');
  skMindLog(e, e.hunt, now, 'disproved', e.x, e.y, 0, 'surprise compromised by ' + who);
  e.dbg.cover = { at: +now.toFixed(1), k: P.k, why: 'compromised by ' + who + (why0 ? ': ' + why0 : '') };
  const goal = P.way && P.way.pts.length ? P.way.pts[P.way.pts.length - 1] : null;
  if ((P.ducks || 0) < 1 && goal && !why0) {
    const W = skCovertWay(eng, e, goal.x, goal.y, skWatchers(eng, e, P.pid));
    if (W.ok && W.exit > 0) { P.way = W; P.ducks = (P.ducks || 0) + 1; P.lx = undefined; e.dbg.why = `${who} can see it on its way: it ducks back out of their sight`; return true; }
  }
  if (!r || tgtGone(eng, e, r)) { e.plan = null; return false; }
  const d = r.seen ? r.dist : 1e9, p = perc(eng, e, r);
  e.noFlank = { x: p.x, y: p.y, t: now }; if (e.hunt && e.hunt.pid === r.id) e.hunt.noFlank = now;   // (no way round them here, for now: it was seen trying)
  if (e.hunger >= SK.chaseHunger && !e.exh && r.seen && d < SK.chaseFrom) { skBegin(eng, e, 'approach', r, `${who} saw it on its way: its surprise is spoiled - it comes on openly`, { mode: 'open', committed: 1 }); return false; }
  if (e.hunger >= SK.huntHunger && r.seen) { skBegin(eng, e, 'watch', r, `${who} saw it on its way: its surprise is spoiled - it stands off`); return false; }
  skLeave(eng, e, r, `${who} saw it on its way: it goes`); return false;
}
/* a route that keeps off their own trail (from where it last knew them to the junction) when there is another way round */
function skAround(eng, from, to) {
  const geo = eng.geo, dx = to.x - from.x, dy = to.y - from.y, L2 = dx * dx + dy * dy || 1;
  return j => { const x = geo.cx(j), y = geo.cy(j), t = clamp(((x - from.x) * dx + (y - from.y) * dy) / L2, 0, 1), q = Math.hypot(x - from.x - dx * t, y - from.y - dy * t); return q < 110 ? 130 : 0; };
}
/* is somebody coming toward where it waits?  footsteps getting nearer, a lead closing in, a sighting - its own evidence only */
function skComing(eng, e, P) {
  const now = eng.now, r = P.pid ? e.mem.p.get(P.pid) : null;
  let near = 1e9;
  if (r && now - r.heardAt < 2.5) near = Math.min(near, Math.hypot(r.hx - e.x, r.hy - e.y));
  if (r && r.seen) near = Math.min(near, r.dist);
  for (const L of e.mem.leads) if (now - L.t < 2.5) near = Math.min(near, Math.hypot(L.x - e.x, L.y - e.y));
  if (e.hear && now - e.hear.t < 2.5) near = Math.min(near, Math.hypot(e.hear.x - e.x, e.hear.y - e.y));
  const was = P.near ?? 1e9; P.near = near;
  return near < 700 && near < was - 15;
}
/* somebody close by, heard (fresh footsteps or a noise: theirs, or a person's it cannot put a name to - another creature's never): where */
function skHeardNear(eng, e, r, within) {
  let best = null;
  if (r && eng.now - r.heardAt < .6) { const d = Math.hypot(r.hx - e.x, r.hy - e.y); if (d < within) best = { x: r.hx, y: r.hy, d }; }
  const H = e.hear;
  if (H && H.src !== -1 && eng.now - H.t < .6) { const d = Math.hypot(H.x - e.x, H.y - e.y); if (d < within && (!best || d < best.d)) best = { x: H.x, y: H.y, d }; }
  return best;
}
function skLure(eng, e, r, R) {
  const P = skBegin(eng, e, 'lure', r, `out of P${r.id}'s sight: it waits round the corner for them to follow`, { until: eng.now + SK.lure[0] + SK.lure[1] * e.hunger * e.tr.PATIENCE, bait: !!R.bait });
  P.face = R.from || { x: r.lkx, y: r.lky };                                                     // the corner it came round: where they would come from
}
/* (R20) the measured reposition: the pace that gets it to its interception's (or its post's) spot SK20.lead s before it must be there -
 * its prowl (free of stamina) when that will do; a burst of its run only for what needs it; its run when it is late.  The way left is its
 * route's (or its covert way's) from where it is, worked out on its think */
function skLeftOf(e, P) {
  const pts = P.mode === 'covert' && P.way ? P.way.pts.slice(Math.max(0, P.wi || 0)) : e.path;
  let L = 0, x = e.x, y = e.y; for (const w of pts) { L += Math.hypot(w.x - x, w.y - y); x = w.x; y = w.y; } return L;
}
function skNeed(eng, e, P) {
  const g = P.g; if (!g || !Number.isFinite(g.due)) return 0;
  const L = skLeftOf(e, P) || Math.hypot(g.x - e.x, g.y - e.y), t = g.due - eng.now - SK20.lead;
  return t > .3 ? L / t : 1e9;
}
function skPace(e, P) { const run = skSpeed(e, 'run'); return P.need ? clamp(P.need * 1.08, skSpeed(e, 'prowl'), run) : run; }
function skIntercept(eng, e, r, g, pre) {
  if (e.hunger >= SK.huntHunger) skHuntBegin(eng, e, r, 'it goes to meet them');   // (R1) an interception is a hunt
  const P = skBegin(eng, e, 'intercept', r, `${pre || 'lost P' + r.id + ': '}it guesses their way (${g.turns.length ? g.turns.length + ' turn' + (g.turns.length > 1 ? 's' : '') : 'straight on'}) and goes round to meet them ${g.lead} px ahead`, { g, until: eng.now + SK.interceptMax, re: 0 });
  P.hAt = Math.max(r.heardAt, e.hunt && e.hunt.pid === r.id ? e.hunt.hAt : -99);
  skInterceptWay(eng, e, P, r, g);
  e.dbg.predict = Object.assign({ at: +eng.now.toFixed(2), pid: r.id }, g);
}
/* (R13) its way to an interception: a covert way (out of the view of everybody it sees, and of the quarry's view from where it believes
 * them, within SKC.suspectMax) to a spot hidden from the way they would come - COVERT; else R8's route off their trail, as an OPEN move */
function skInterceptWay(eng, e, P, r, g) {
  const H = e.hunt && e.hunt.pid === r.id ? e.hunt : null, B = H ? skBelief(eng, e, H) : { x: r.lkx, y: r.lky };
  const W = g.hidden ? skCovertWay(eng, e, g.x, g.y, skWatchers(eng, e, r.id, { x: B.x, y: B.y })) : { ok: false, why: 'spot_exposed' };
  P.lx = undefined; P.way = null;
  if (W.ok) { P.mode = 'covert'; P.way = W; P.cover = ''; e.path = W.pts.slice(); e.goal = { x: g.x, y: g.y }; e.goalKey = 'covert'; e.pathAge = 0; return; }
  P.mode = 'open'; P.cover = W.why; e.dbg.cover = { at: +eng.now.toFixed(1), k: 'intercept', why: W.why };
  if (e.plan === P && !P.arrived) setAct(e, 'chase');                                 // (R16: open from its first tick - the open run's act)
  plan(eng, e, g.x, g.y, { why: 'intercept', cost: skAround(eng, g.from, { x: g.qx, y: g.qy }), maxNodes: 4000 });
}
function skSearch(eng, e, r, why, goal, extra) {
  // (R20 C3) the place set down on open floor its body fits (skFloorNear): a guess or a heard place can lie against or inside a wall, and a
  // goal its body cannot reach left it pinned at a corner, side-stepping, until the watchdog cleared its route (R20's traces; R2-R19 alike)
  const G0 = goal || { x: r.lkx, y: r.lky }, G = skFloorNear(eng, e, G0.x, G0.y) || G0;
  const H = r && e.hunger >= SK.huntHunger ? skHuntBegin(eng, e, r, 'it goes to look for them') : null;   // (R1) a search for somebody is a hunt
  skBegin(eng, e, 'search', r, why, Object.assign({ goal: G, until: eng.now + SK.searchMax, hAt: Math.max(r ? r.heardAt : 0, H ? H.hAt : -99), sid: e.mem.soundId || 0 }, extra));
  plan(eng, e, G.x, G.y, { why: 'search' });
}
/* the plan's person is out of its sight */
function skLost(eng, e, P, r) {
  const now = eng.now, h = e.hunger, H = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
  if (P.k === 'retreat' && (!P.arrived || now - P.arrived < SK.retreatHold)) return;          // still getting out of their sight
  if (P.k === 'retreat') {
    if (h >= SK.huntHunger && !e.exh) { skLure(eng, e, r, P); return; }                     // out of their sight, as it wanted: it lies in wait
    e.plan = null; e.target = null; e.dbg.why = 'out of sight: it goes about its business'; return;
  }
  // (R1) at its spot at their side, out of their sight (R3: not before - it does not stop half way because it turned away from them): it
  // comes at them from there, as at somebody unaware (under cover, creeping)
  if (P.k === 'flank') { skFromCover(eng, e, r, `at P${r.id}'s side, out of their sight`); return; }   // (R13: never a creep across their view)
  // they went out of sight moving: predict where they are going and try to be there first
  const moving = Math.hypot(r.lvx, r.lvy) > 60, fresh = now - Math.max(r.seenAt, r.heardAt) < 2.5;
  if (h >= SK.huntHunger && !e.exh && moving && fresh) {
    // (R12) its walk of their way (R8's), labelled with the way it lies on among those it holds; not made on a way evidence has ruled out
    const src = H || skHypSrc(r), Y = skHyps(eng, e, src), g = skPredict(eng, e, r), w = g ? skHypOf(Y, g.qx, g.qy) : null;
    if (g && !(w && w.f < 1)) { g.hyp = w ? w.id : 0; Y.bet = g.hyp; skIntercept(eng, e, r, g, ''); if (!H && e.hunt && e.hunt.pid === r.id && !e.hunt.hyp && Math.abs(e.hunt.bt - src.bt) < 1e-6) e.hunt.hyp = Y; return; }
    e.dbg.guess = { at: +now.toFixed(1), k: '-', hyp: 0, of: '', rej: [['intercept', w ? w.id : 0, g ? 'disproved' : 'late_to_intercept']] };
  }
  // (R1) a hunt goes on without them in sight: it stops to listen, then follows its belief (skHuntNext); it gives up for a stated reason
  if (H && !e.exh) { skListenLost(eng, e, r, `it lost sight of P${r.id}: it stops and listens`); return; }
  // otherwise a hungry one goes to look where it last knew them, briefly (stale evidence ends it); a less hungry one lets it go
  if (h >= SK.huntHunger && !e.exh && r.conf > .25) { skSearch(eng, e, r, `lost P${r.id}: it goes to look where it last knew them`); return; }   // (R18: from huntHunger, was very hungry)
  if (P.k === 'chase') { skLeave(eng, e, r, `lost P${r.id} in the chase; not worth a search`).race = true; return; }   // (B2: a lost race stays a departure)
  e.plan = null; e.target = null; e.dbg.why = 'it lost sight of them';
}
/* nobody in view: a fresh, real sound (footsteps, a door, a fall), or a light glimpsed, that it has not gone after yet */
function skListen(eng, e) {
  const now = eng.now, H = e.hear, hm = sm(.3, .6, e.hunger);
  if (H && now - H.t < SK.heardFresh && H.I >= SK.heardMin && H.id > e.dbg.soundSeen && !(H.pid && e.left.has(H.pid))) {
    e.dbg.soundSeen = H.id;
    const r = H.pid ? e.mem.p.get(H.pid) : null;
    // (R2) first it stops, turns its head to it and listens; what it heard next decides (skCurious).  (R16e) the hungrier, the shorter
    skBegin(eng, e, 'listen', r, `it heard ${H.type || 'something'}${r ? ' (P' + r.id + ')' : ''}: it stops and listens`,
      { until: now + rand(e, SK.curious[0], SK.curious[1]) * (.8 + .4 * e.tr.PATIENCE) * (1 - .5 * hm), curious: { x: H.x, y: H.y, u: H.u, t: H.t, I: H.I, id: H.id, type: H.type || '' } });
    return true;
  }
  // (R16e) something moved at the edge of its view and it did not then see who: it turns to it and, as after a strong sound, goes to look
  const M = e.look && e.look.m;
  if (M && now - M.t < .35 && !e.seenNow.size) {
    e.look.m = null;
    skBegin(eng, e, 'listen', null, 'something moved at the edge of its view: it turns to it',
      { until: now + SK.curious[0] * (1 - .5 * hm), curious: { x: M.x, y: M.y, u: M.u, t: now, I: SK.curiousStrong, id: e.mem.soundId || 0, type: 'movement' } });
    return true;
  }
  return false;
}
/* (R2) after listening to a sound while it roamed: a later sound that fits the first (the same thing, moving), or a strong first, sends it
 * to look - quietly, at the freshest place; a weak sound with nothing after it is let go.  Anonymous: it names nobody */
function skCurious(eng, e, C) {
  let q2 = null;
  for (const q of e.mem.sounds) if (q.id > C.id && eng.now - q.t < SK.heardFresh + 1 && Math.hypot(q.x - C.x, q.y - C.y) <= C.u + q.u + 120 + SK.hearReach * Math.max(0, q.t - C.t)) { q2 = q; break; }   // (newest first)
  if (!q2 && C.I < SK.curiousStrong * lerp(1, .4, sm(.3, .6, e.hunger))) { e.tally.curiousDrop++;   // (the hungrier, the fainter a sound it goes to look at)
    e.dbg.why = `nothing more after the ${C.type || 'sound'}: it lets it go`; return; }
  // (R20) two sounds that fit, some way off: somebody is going somewhere - hunting, it goes to meet them where they would come out and
  // waits there (a post: skPost), rather than walking to where the sound was
  if (q2 && (skPostHere(eng, e, C, q2) || skPost(eng, e, C, q2))) { e.dbg.soundSeen = Math.max(e.dbg.soundSeen, q2.id); return; }
  const g = q2 || C; e.tally.curious++;
  if (q2) e.dbg.soundSeen = Math.max(e.dbg.soundSeen, q2.id);
  // (R16e) to where it could see the place from - the nearest open floor with a clear line to it - not to the place itself
  const v = skVantage(eng, e, g.x, g.y, g.u || 0); if (v) e.tally.vantage = (e.tally.vantage || 0) + 1;
  skSearch(eng, e, null, `${C.type === 'movement' && !q2 ? 'something moved' : 'it heard ' + (q2 ? (q2.type || 'it') + ' again' : C.type || 'something')}: it goes quietly to ${v ? 'where it can see the place' : 'look'}`, v || { x: g.x, y: g.y }, { at: { x: g.x, y: g.y }, I: g.I });
}

/* (R20) a post: from two sounds that fit (nobody it can name - the way the sound went, fuzzy as its ears are), the way somebody is going
 * (skRoute along the level), and the first point of it it can reach before them (skPredict, as its interceptions); there, beside the way,
 * out of sight of it if it can be, it waits - a while, longer while the sounds come nearer, never long.  Hungry enough to hunt, not
 * exhausted, the sound some way off (SK20.postFrom): nearer, it goes to look as before.  Somebody who comes into its sight there, unaware,
 * walking its way, it lies in wait for (an ambush: skDecide); anybody else it answers as it would anywhere */
function skPost(eng, e, C, q) {
  if (C.src === -1 || q.src === -1) return false;                                // (the review) another creature's sounds are nobody to wait for
  if (e.hunger < SK.huntHunger || e.exh || q.I < SK20.postI || Math.hypot(q.x - e.x, q.y - e.y) < SK20.postFrom) return false;
  const dt = q.t - C.t; if (dt < .15) return false;
  let vx = (q.x - C.x) / dt, vy = (q.y - C.y) / dt; const v = Math.hypot(vx, vy); if (v < 40) return false;
  const k = clamp(v, 90, 300) / v; vx *= k; vy *= k;
  const g = skPredict(eng, e, { id: 0, lkx: q.x, lky: q.y, lvx: vx, lvy: vy, seenAt: -1e9, heardAt: q.t });
  if (!g) { e.tally.postNone = (e.tally.postNone || 0) + 1; return false; }
  if (e.hunt && e.hunt.failed.some(f => Math.hypot(f.x - g.x, f.y - g.y) < SK.failedNear)) { e.tally.postFailed = (e.tally.postFailed || 0) + 1; return false; }   // (a place its hunt already found empty: not again)
  const P = skBegin(eng, e, 'post', null, `it heard somebody going ${skCompass(vx, vy)}: it goes to wait where they would come out (${g.lead} px on their way)`, { g, until: eng.now + SK.interceptMax, at: { x: q.x, y: q.y } });
  P.face = { x: g.jx, y: g.jy }; P.need = 0;
  plan(eng, e, g.x, g.y, { why: 'post', maxNodes: 4000 });
  e.dbg.predict = Object.assign({ at: +eng.now.toFixed(2), pid: 0, post: 1 }, g);
  return true;
}
/* (R20) the sounds come its way (the second nearer than the first by 40 px or more - as its fuzzy ears hear them), in the dark: it does not go to
 * meet them - it waits where it is, facing them (a post here), and lets them come (skDecide's post rule takes it from there) */
function skPostHere(eng, e, C, q) {
  if (C.src === -1 || q.src === -1) return false;                                // (the review) another creature's sounds are nobody to wait for
  if (e.hunger < SK.huntHunger || e.exh || skLit(eng, e) > SK.exposed * .5) return false;
  const dC = Math.hypot(C.x - e.x, C.y - e.y), dq = Math.hypot(q.x - e.x, q.y - e.y);
  if (!(dq < dC - 40) || dq > 760 || dq < SK.pounceRange[1] + 60) return false;   // (its ears' fuzz can fool it: a wrong guess is a short wait)
  e.tally.postHere = (e.tally.postHere || 0) + 1;
  const P = skBegin(eng, e, 'post', null, `it heard somebody coming its way: it waits for them where it is, in the dark`, { g: { x: e.x, y: e.y, jx: q.x, jy: q.y }, until: eng.now + 1, at: { x: q.x, y: q.y }, here: 1 });
  P.face = { x: q.x, y: q.y }; P.arrived = eng.now; P.until = eng.now + Math.min(SK20.postMax, SK20.postWait[0] + SK20.postWait[1] * e.hunger * e.tr.PATIENCE); e.path = [];
  return true;
}
const skCompass = (x, y) => ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8];
/* ---- T4: the strike ---- */
/* (R11) the events a decision answers by keeping its plan: about somebody it sees; about somebody it lost */
const SK_SEEN = ['sight', 'exposed', 'hidden', 'turned', 'winded', 'reach'], SK_LOST = ['lost'], SK_ANY = SK_SEEN.concat(SK_LOST);   // (a departure carried through answers both)
const SK_STRIKE = { approach: 1, chase: 1, lure: 1, ambush: 1, intercept: 1, search: 1, mingle: 1, flank: 1, listen: 1, post: 1 };    // the plans it springs from (never while watching, retreating, leaving or feeding; R1: a flank, a pause to listen)
/* on its think: somebody in arm's reach of a hungry one is grabbed; somebody its plan is about, in sight 55-185 px away, it springs at */
function skStrike(eng, e) {
  if (e.exh || e.hunger < SK.huntHunger || eng.now < e.pounceCool || e.commit || e.cap) return false;
  const geo = eng.geo;
  for (const pv of eng.nearPlayers(e.x, e.y, SK.grabReach)) {                    // arm's reach: contact is physics, not perception
    if (!pv.alive || pv.caught || !geo.lineClear(e.x, e.y, pv.x, pv.y, 3, 'walk')) continue;
    if (e.plan && e.plan.k === 'feed' && e.hunger < SK.band[2]) break;             // (a feeding one that has eaten does not)
    const W0 = e.plan; if (W0 && W0.pid === pv.id && W0.came === undefined && (W0.k === 'lure' || W0.k === 'ambush' || (W0.k === 'intercept' && W0.arrived))) { W0.came = eng.now; e.tally[W0.k + 'Came']++; }   // (R13: they came to where it waited - into its reach)
    skSpring(eng, e, Math.atan2(pv.y - e.y, pv.x - e.x), pv.id, 'grab', `P${pv.id} came within its reach: it grabs`); return true;
  }
  const P = e.plan; if (!P || !P.pid || !SK_STRIKE[P.k] || e.stam < SK.pounceCost) return false;
  const r = e.mem.p.get(P.pid); if (!r || !r.seen || !r.visual || tgtGone(eng, e, r)) return false;
  const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d < SK.pounceRange[0] || d > (e.disguise ? SK.mingleStrike : SK.pounceRange[1])) return false;   // (T6: in a skin it waits until they are close)
  // only a leap that can reach them (from what it sees of their motion: moving away they get further during the wind-up and the leap),
  // aimed where it believes they will be at the moment it reaches them, with a seeded error that INTELLIGENCE shrinks
  const leapV = SK.pounceSpeed * .85, touch = e.r + 16, vr = d > 1 ? clamp(((p.x - e.x) * p.vx + (p.y - e.y) * p.vy) / d, -200, 300) : 0;
  if (d + vr * (SK.pounceWind + SK.pounceDur) - touch > leapV * SK.pounceDur) return false;
  const tc = SK.pounceWind + clamp((d + vr * SK.pounceWind - touch) / Math.max(60, leapV - vr), 0, SK.pounceDur), ax = p.x + p.vx * tc, ay = p.y + p.vy * tc;
  const err = (e.rng() - .5) * (1.2 - e.tr.INTELLIGENCE) * .5;
  if (!geo.lineClear(e.x, e.y, ax, ay, e.rc * .6, 'walk')) return false;          // never a leap into a wall it can see
  if (P.came === undefined && (P.k === 'lure' || P.k === 'ambush' || (P.k === 'intercept' && P.arrived))) { P.came = eng.now; e.tally[P.k + 'Came']++; }   // (R13: they came to where it waited)
  skSpring(eng, e, Math.atan2(ay - e.y, ax - e.x) + err, r.id, 'pounce', `it springs at P${r.id} (${Math.round(d)} px)`);
  return true;
}
function skSpring(eng, e, dir, tid, style, why) {
  skMindKept(e, eng.now, SK_ANY, 'strike');                                          // (R13) a strike answers what it saw (its think stops while it is carried through)
  const grab = style === 'grab', def = style === 'defend';                      // (B3: 'defend' - its own wind-up, lunge and cost; only tid can be caught)
  e.pounce = { t: 0, wind: grab ? SK.grabWind : def ? SK.defWind : SK.pounceWind, dur: grab ? .16 : def ? SK.defDur : SK.pounceDur, speed: grab ? 200 : def ? SK.defSpeed : SK.pounceSpeed,
    cost: def ? SK.defCost : SK.pounceCost, dir, tid, style, paid: false };
  if (!def) e.tally[grab ? 'grab' : 'pounce']++; e.path = []; e.dbg.why = why; e.dbg.pounce = style;
  if (e.disguise) skUndress(eng, e, 'it drops the skin to spring');                      // (T6) the wind-up shows what it is
  setState(e, S.ATTACKING, 'wind');
}
/* the wind-up, the committed leap, the recovery; a hit returns the capture to the engine (ai.engine.js begins it) */
function skStrikeStep(eng, e, dt) {
  e.still = true;
  if (!e.pounce) {                                                                // recovering: it skids to a stop, then stands
    e.recover -= dt; e.speed = approach(e.speed, 0, 900 * dt); e.moved = e.speed > 1 ? moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt) : 0;
    if (e.recover <= 0) { e.recover = 0; const P = e.plan; if (P && SK_STATE[P.k]) setState(e, SK_STATE[P.k][0], SK_STATE[P.k][1]); else setState(e, S.ROAMING, ''); }
    return null;
  }
  const L = e.pounce; L.t += dt;
  if (L.t < L.wind) {                                                             // crouched, aimed: the tell
    const da = ((L.dir - e.ang + Math.PI * 3) % TAU) - Math.PI; e.ang = (e.ang + clamp(da, -12 * dt, 12 * dt) + TAU) % TAU;
    e.speed = approach(e.speed, 0, 1600 * dt); return null;
  }
  if (!L.paid) { L.paid = true; e.stam = Math.max(0, e.stam - (L.cost || SK.pounceCost)); setAct(e, 'pounce'); }   // every leap costs, hit or miss
  const k = (L.t - L.wind) / L.dur, want = L.speed * (1 - .3 * k) * dt;
  e.ang = (L.dir + TAU) % TAU; e.speed = L.speed * (1 - .3 * k);
  e.moved = moveCollide(eng, e, Math.cos(L.dir) * want, Math.sin(L.dir) * want);
  for (const pv of eng.nearPlayers(e.x, e.y, e.r + 22)) {                         // contact: a body its own body has reached, nothing solid between
    if (!pv.alive || pv.caught || Math.hypot(pv.x - e.x, pv.y - e.y) >= e.r + 18 || !eng.geo.lineClear(e.x, e.y, pv.x, pv.y, 3, 'walk')) continue;
    if (L.style === 'defend' && pv.id !== L.tid) continue;                          // (B3) a defence catches only the person it was against
    e.pounce = null; e.recover = 0; e.tally.hit++; e.dbg.pounce = L.style + ': hit'; if (L.style === 'defend') e.tally.defendHit++;
    e.aw.delete(pv.id); e.rx = null;                                                 // (B3) whatever it held against them ends with them
    skKeepSpent(eng, e); skHuntEnd(eng, e, `it has P${pv.id}`);
    e.plan = null; e.target = null; e.enc = null; e.dbg.why = `it has P${pv.id}`;           // its plan is over: the kill (the engine's capture) takes it from here
    return { pv, dir: L.dir, speed: e.speed, style: L.style };
  }
  if (e.moved < want * .4) { e.pounce = null; e.recover = SK.recoverWall; e.pounceCool = eng.now + rand(e, SK.pounceCool[0], SK.pounceCool[1]); setAct(e, 'recover'); e.tally.wall++; e.dbg.pounce = 'into a wall'; e.dbg.why = 'it leapt into a wall: stunned'; if (L.style === 'defend') { e.tally.defendMiss++; e.defLeave = L.tid; } return null; }
  if (k >= 1) { e.pounce = null; e.recover = rand(e, SK.recoverMiss[0], SK.recoverMiss[1]); e.pounceCool = eng.now + rand(e, SK.pounceCool[0], SK.pounceCool[1]); setAct(e, 'recover'); e.tally.miss++; e.dbg.pounce = 'missed'; e.dbg.why = 'it missed: it recovers'; if (L.style === 'defend') { e.tally.defendMiss++; e.defLeave = L.tid; } }
  return null;
}
/* after its kill (the commitment over): the meal, then it feeds beside the body for a while - it never moves the body */
function skFeedBegin(eng, e, pv) {
  e.hunger = clamp(e.hunger - SK.killMeal, 0, 1); e.tally.kills++;
  skBegin(eng, e, 'feed', null, 'it feeds at its kill', { until: eng.now + rand(e, SK.feedTime[0], SK.feedTime[1]), at: { x: pv.x, y: pv.y } });
  e.target = null; e.enc = null;
}

/* ---- T6: what it hears, what it says, the skin it earns ---- */
/* a line a person said near it (B++'s speech.js, accepted, through the engine's hearSpeech): kept for a while, and heard as a sound */
function skHearSpeech(eng, e, L) {
  if (!L || typeof L.text !== 'string' || !Number.isSafeInteger(L.id) || !Number.isFinite(L.x) || !Number.isFinite(L.y)) return false;
  if (Math.hypot(L.x - e.x, L.y - e.y) > SK.hearSpeech || e.commit) return false;
  const now = eng.now;
  e.heard = e.heard.filter(q => now - q.at < SK.heardTtl && !(q.pid === L.id && q.text === L.text));
  e.heard.push({ pid: L.id, text: L.text, at: now, uses: 0 }); while (e.heard.length > SK.heardMax) e.heard.shift();
  e.dbg.heardN = (e.dbg.heardN || 0) + 1;
  if (e.tier !== 'far') hearEvent(e, eng, { x: L.x, y: L.y, r: SK.hearSpeech, I: .6, type: 'voice', src: L.id, st: 1, vx: 0, vy: 0 });   // where a voice came from: a sound like any other
  return true;
}
/* the words it will say: the opening words of a line it heard (lower case; sometimes the last word again), or a generic call */
function skLine(eng, e, r) {
  const now = eng.now, from = e.disguise ? e.disguise.from : -1, rid = r ? r.id : -1;
  const H = e.heard.filter(q => now - q.at < SK.heardTtl && q.uses < SK.heardUses);
  const rank = q => (q.pid === from ? 3 : q.pid !== rid ? 2 : 1) * 1e6 + q.at;          // the skin's owner's words, then anybody else's, then their own
  H.sort((a, b) => rank(b) - rank(a));
  if (H.length) {
    const q = H[0]; q.uses++;
    const w = q.text.toLowerCase().replace(/[.!,;:]+$/u, '').split(' ').filter(Boolean).slice(0, SK.sayWords);
    if (w.length && e.sayRng() < SK.echo) { const last = w[w.length - 1], bare = last.replace(/[?!.]+$/u, ''); if (bare) { w[w.length - 1] = bare + '...'; w.push(bare + (/[?]$/u.test(last) ? '?' : '')); } }   // "wait for me... me"
    const text = Array.from(w.join(' ')).slice(0, 120).join('');
    if (text) return { text, o: q.pid, src: 'heard' };
  }
  return { text: SK_BAIT[Math.floor(e.sayRng() * SK_BAIT.length) % SK_BAIT.length], o: 0, src: 'bait' };
}
/* it speaks (never more often than SK.sayGap, never more than SK.sayEnc lines in one encounter): the engine hands the line to the server */
function skSay(eng, e, r, why) {
  const now = eng.now; if (now < e.sayNext) return false;
  const enc = r && e.enc && e.enc.pid === r.id ? e.enc : null; if (enc && (enc.said || 0) >= SK.sayEnc) return false;
  const L = skLine(eng, e, r);
  e.sayNext = now + lerp(SK.sayGap[0], SK.sayGap[1], e.sayRng()); if (enc) enc.said = (enc.said || 0) + 1;
  e.said++; e.tally.say++; e.tally[L.src === 'heard' ? 'sayHeard' : 'sayBait']++;
  e.dbg.said = { at: +now.toFixed(1), src: L.src, why, to: r ? r.id : 0 };              // (never the words themselves)
  e.mimicT = now + 1.6; setAct(e, 'mimic');
  if (eng.voiceOut) eng.voiceOut({ e: e.id, x: Math.round(e.x), y: Math.round(e.y), text: L.text, o: L.o, h: e.voice.h, s: e.voice.s });
  return true;
}
/* the skin of the person it has just killed (G.I.B.'s aftermath, through the engine's skinFrom, when that death ends): taken only if it
 * then feeds long enough.  Only the look's four drawn fields, re-checked here; never a name, a light, an item or an id */
const SK_LOOK = /^[a-z]{1,12}\|[a-z]{1,12}\|#[0-9a-fA-F]{6}\|#[0-9a-fA-F]{6}(\|[a-z]{0,12})?$/;
function skSkinFrom(eng, e, pid, look) {
  if (typeof look !== 'string' || !SK_LOOK.test(look) || !Number.isSafeInteger(pid)) return false;
  e.skin = { look: look.split('|').slice(0, 4).join('|'), pid, at: eng.now };
  return true;
}
function skDon(eng, e, P) {
  const K = e.skin; e.skin = null; if (!K) return;
  if (!P || (P.fed || 0) < SK.skinFeed) { e.tally.skinLost++; e.dbg.skin = 'left behind: its meal was cut short'; return; }
  e.disguise = { look: K.look, from: K.pid, t0: eng.now, until: eng.now + rand(e, SK.disguiseTime[0], SK.disguiseTime[1]) };
  e.tally.skin++; e.dbg.skin = `it wears P${K.pid}'s skin`; eng.note(`K#${e.id} wears the skin of P${K.pid}`);
}
function skUndress(eng, e, why) {
  if (!e.disguise) return; e.disguise = null; e.tally.reveal++; e.dbg.skin = why; eng.note(`K#${e.id} drops its disguise: ${why}`);
  if (e.plan && e.plan.k === 'mingle') { e.plan = null; e.dbg.why = why; }
}

/* ---- behaviour refinement B1: what it notices of the people it sees (never hunting, never an attack) ---- */
const skClose = d => clamp((SK.awNear - d) / (SK.awNear - SK.awCrowd), 0, 1);   // 0 at the edge of its space, 1 when they crowd it
/* more pressure of one kind, never beyond that kind's ceiling (and never lowered by it: another kind may have raised it higher) */
function skBump(A, amt, cap, why, now) { if (amt > 0 && A.p < cap) { A.p = Math.min(cap, A.p + amt); A.why = why; A.whyAt = now; } }
/* on its think, before deciding: its records fade; everyone it SEES now in its space updates one (seen bodies only: e.seenNow) */
function skAware(eng, e) {
  const now = eng.now, el = Math.max(0, now - (e.awAt || now)), dt = Math.min(el, .25); e.awAt = now;   // el: all the time since its last look at them (far away too)
  for (const [id, A] of e.aw) {
    A.p *= Math.exp(-el / SK.pDecay);
    if (!eng.byId.has(id) || now - A.last > SK.awTtl) { e.aw.delete(id); continue; }    // gone, or not seen close for a long while
    if (A.tier && A.p < SK.pAware * .5) A.tier = 0;                                   // well below the threshold it stops minding them
    if (now - A.last > 1.2) { A.arc = 0; A.tailT = 0; A.blockT = 0; }                 // (B2) out of its sight a while: no circling, following or blocking goes on
  }
  const cvx = Math.cos(e.ang) * e.speed, cvy = Math.sin(e.ang) * e.speed, hx = Math.cos(e.ang), hy = Math.sin(e.ang), P = e.plan, walking = (!P || P.k === 'leave') && e.speed > 40;
  for (const r of skSeen(eng, e)) {                                                  // (its own hunt cooldown, e.left, does not hide anybody here)
    const v = r.visual, d = r.dist; if (d > SK.awOrbit) continue;
    let A = e.aw.get(r.id);
    if (!A) {
      if (d > SK.awNear) continue;                                                   // a record begins in its personal space
      if (e.aw.size >= SK.awMax) { let w = null; for (const q of e.aw.values()) if (!w || q.p < w.p || (q.p === w.p && q.last < w.last)) w = q; e.aw.delete(w.pid); }
      e.aw.set(r.id, A = { pid: r.id, t0: now, last: now, d: 0, p: 0, tier: 0, ack: 0, nextAck: 0, looks: 0, why: '', whyAt: -99,
        arc: 0, orbits: 0, tailT: 0, blockT: 0, byThem: 0, byIt: 0, warns: 0, warnAt: -99, warnEnd: -99, nextWarn: 0 });
    }
    A.last = now; A.d = Math.round(d);
    // in its space: the closer the more; coming at it more, going away less, by their OWN motion; and as much as THEY closed the distance
    // lately (A.byThem against A.byIt: somebody standing still that it walked up to, or backed into, has done nothing to it - B2); fast
    // motion close by catches the eye more (up to SK.pFast times)
    const ux = (v.x - e.x) / Math.max(1, d), uy = (v.y - e.y) / Math.max(1, d), rvx = v.vx - cvx, rvy = v.vy - cvy, sp = Math.hypot(v.vx, v.vy);
    const own = v.vx * ux + v.vy * uy, vr = rvx * ux + rvy * uy, k6 = Math.exp(-dt / 6);   // own: their motion away from it (< 0: coming at it)
    A.byThem = A.byThem * k6 + Math.max(0, -own) * dt; A.byIt = A.byIt * k6 + Math.max(0, cvx * ux + cvy * uy) * dt;
    const blame = (A.byThem + 1) / (A.byThem + A.byIt + 2), fast = 1 + (SK.pFast - 1) * clamp((Math.hypot(rvx, rvy) - 100) / 200, 0, 1);
    if (d < SK.awNear) skBump(A, SK.pNear * skClose(d) * (own < -40 ? 1.3 : own > 60 ? .4 : 1) * (.3 + .7 * blame) * fast * dt, SK.capNear, 'close by', now);
    if (d < SK.awCrowd && blame > .5) skBump(A, SK.pCrowd * blame * dt, SK.capCrowd, 'crowding it', now);
    // (B2) circling it: their motion round it, relative to its own, one way (only while it sees them; a straight pass is less than half a turn)
    A.arc += (((v.x - e.x) * rvy - (v.y - e.y) * rvx) / Math.max(1, d * d)) * dt;
    if (Math.abs(A.arc) >= SK.orbitArc) { A.orbits++; A.arc -= Math.sign(A.arc) * Math.PI; skBump(A, SK.pOrbit, SK.capOrbit, 'circling it', now); }
    // following it: moving its way, beside or behind it, while it walks; standing in its way: ahead of it, in its lane, while it has a way to go
    const along = (v.x - e.x) * hx + (v.y - e.y) * hy, lat = Math.abs((v.y - e.y) * hx - (v.x - e.x) * hy);
    if (walking && d < SK.awTail && sp > 50 && v.vx * hx + v.vy * hy > .6 * sp && along < 60) A.tailT += dt; else A.tailT = Math.max(0, A.tailT - 2 * dt);
    if (A.tailT >= SK.tailMin) skBump(A, SK.pTail * dt, SK.capTail, 'following it', now);
    if ((!P || P.k === 'leave') && e.path.length && sp > 40 && along > 0 && along < SK.awBlock && lat < 60) A.blockT += dt; else A.blockT = Math.max(0, A.blockT - 2 * dt);   // (moving into its way: somebody standing still is not blocking it)
    if (A.blockT >= .6) skBump(A, SK.pBlock * dt, SK.capBlock, 'in its way', now);
    // pressing in after it has warned them: close, and not backing off - by their own motion, and as much as they closed the distance
    // (the creature walking up to somebody standing still is not them pressing in)
    if (now - A.warnEnd < SK.pressFor && d < SK.pressNear && own < 30) skBump(A, SK.pPress * (.5 + .5 * skClose(d)) * blame * dt, SK.capPress, 'pressing in after its warning', now);
    if (!A.tier && A.p >= SK.pAware) { A.tier = 1; A.ack = now; }
  }
}
/* after deciding: while it roams or leaves (and is itself), it reacts to what it has noticed - an overlay, the plan is kept */
function skAttend(eng, e) {
  const now = eng.now, P = e.plan;
  if (e.rx || e.disguise || e.pounce || e.recover > 0 || (P && P.k !== 'leave')) return;
  let A = null; for (const q of e.aw.values()) if (q.tier && now - q.last < .05 && (!A || q.p > A.p)) A = q;   // noticed, and seen on this very think
  if (A && A.p >= SK.pWarn && now - A.ack >= SK.warnAfter && now >= A.nextWarn && A.d < SK.awNear + 60) { skWarn(eng, e, A); return; }   // (B2)
  if (P && P.fast) return;                         // fleeing (a withdrawal, or leaving after a missed defence) it does not stop to look - its head still turns; chased down, it may still warn
  // (R11) a person it has only just seen, who meets its eyes (within SK.ackEyes) or comes its way (within SK.ackCome): it stops and looks
  // at them, once, whatever it then does - whatever its hunger (a departure goes on afterwards)
  if (e.mind) for (const o of e.mind.obs.values()) {
    if (o.acked || now - o.firstAt > 1.5 || now - o.seenAt > .05) continue;
    const r = e.mem.p.get(o.pid); if (!r || !r.visual || tgtGone(eng, e, r)) continue;
    const v = r.visual, toward = ((e.x - v.x) * v.vx + (e.y - v.y) * v.vy) / Math.max(1, r.dist), going = P && P.k === 'leave' && e.hunger < SK.band[0], far = going ? 1.6 : 1;
    const eyes = now - o.eyesAt < .3 && r.dist < SK.ackEyes * far;
    if (r.dist < SK.awNear || (!eyes && !(toward > 40 && r.dist < SK.ackCome * far))) continue;   // (closer than its personal space: B1's own look, by what they do there)
    o.acked = now; e.tally.ack = (e.tally.ack || 0) + 1;
    if (going) { e.ackHead = { pid: o.pid, until: now + SK.ackOver }; e.dbg.rx = `it sees P${o.pid} ${eyes ? 'looking at it' : 'coming its way'}: it looks back at them as it goes`; return; }   // (satiated and going: a look over its shoulder, its departure unbroken; farther, since it costs it nothing)
    e.rx = { k: 'look', pid: o.pid, at: null, t0: now, until: now + lerp(SK.ackLook[0], SK.ackLook[1], e.awRng()) };
    e.dbg.rx = `it sees P${o.pid} ${eyes ? 'looking at it' : 'coming its way'}: it stops and looks`; return;
  }
  if (A && now >= A.nextAck) {
    e.rx = { k: 'look', pid: A.pid, at: null, t0: now, until: now + lerp(SK.look[0], SK.look[1], e.awRng()) };
    A.nextAck = e.rx.until + lerp(SK.ackGap[0], SK.ackGap[1], e.awRng()); A.looks++; e.tally.look++;
    e.dbg.rx = `it stops and looks at P${A.pid} (${A.why})`; return;
  }
  const H = e.hear;                                                                  // a fresh sound nobody it sees made: it turns to where it heard it
  if (H && !H.pid && H.src !== -1 && now - H.t < .3 && H.id > e.awSound && H.I >= SK.soundLookI && now >= e.soundLookAt && now >= (e.rxEnd || 0) + SK.rxGap && Math.hypot(H.x - e.x, H.y - e.y) < SK.soundLook) {
    e.awSound = H.id;
    e.rx = { k: 'look', pid: 0, at: { x: H.x, y: H.y }, t0: now, until: now + lerp(SK.look[0], SK.look[1], e.awRng()) * .8 };
    e.soundLookAt = e.rx.until + SK.soundGap; e.tally.lookSound++;
    e.dbg.rx = `it heard ${H.type || 'something'}: it turns to look`;
  }
}
/* the reaction in progress (every tick): it stands and faces what it noticed; at the end its plan goes on as it was */
function skReact(eng, e, dt) {
  const R = e.rx, now = eng.now, P = e.plan;
  if ((P && P.k !== 'leave') || e.disguise) { skReactEnd(eng, e, false); return false; }
  if (now >= R.until) { skReactEnd(eng, e, true); return false; }
  const r = R.pid ? e.mem.p.get(R.pid) : null, q = r && !tgtGone(eng, e, r) ? perc(eng, e, r) : R.at;
  if (R.k === 'warn') {                                                              // (B2) it turns on them, hunched, and backs away from them, slowly
    if (q) faceToward(e, q.x, q.y, dt, 4);
    const bx = q ? e.x - q.x : -Math.cos(e.ang), by = q ? e.y - q.y : -Math.sin(e.ang), L = Math.hypot(bx, by) || 1;
    e.speed = SK.warnBack; e.moved = moveCollide(eng, e, bx / L * SK.warnBack * dt, by / L * SK.warnBack * dt); e.still = true;
    if (e.state !== S.PROVOKED || e.act !== 'creep') setState(e, S.PROVOKED, 'creep');
    return true;
  }
  stopMoving(eng, e, dt); e.still = true;                                           // (its route is kept: it walks on along it afterwards)
  if (q) faceToward(e, q.x, q.y, dt, 3.2);
  if (e.act !== 'watch') setAct(e, 'watch');
  return true;
}
/* ---- B3: defence ---- */
/* no open way away from them: of seven directions away from where it sees them (straight away, and up to 1.2 rad either side), fewer than
 * two have 180 px of floor */
function skCornered(eng, e, v) {
  const a0 = Math.atan2(e.y - v.y, e.x - v.x); let open = 0;
  for (const da of [0, .4, -.4, .8, -.8, 1.2, -1.2]) if (eng.geo.ray(e.x, e.y, a0 + da, 200) >= 180) open++;
  return open < 2;
}
/* on its think, before deciding: the person it has warned, still pressing it, within its reach - strike, or withdraw (see the header) */
function skDefend(eng, e) {
  const now = eng.now;
  if (e.exh || e.disguise || e.stam < SK.defCost || now < e.pounceCool || now < (e.defNext || 0) || (e.plan && e.plan.k === 'feed')) return '';
  let A = null;
  for (const q of e.aw.values()) if (now - q.last < .05 && q.p >= SK.pDefend && q.warns && !(e.rx && e.rx.k === 'warn' && e.rx.pid === q.pid) && now - q.warnEnd >= SK.defAfterWarn && now - q.warnEnd <= SK.pressFor && now >= (q.defUntil || 0) && (!A || q.p > A.p)) A = q;
  if (!A) return '';
  const r = e.mem.p.get(A.pid); if (!r || !r.seen || !r.visual || tgtGone(eng, e, r)) return '';
  const v = r.visual, d = r.dist; if (d > SK.defReach || !eng.geo.lineClear(e.x, e.y, v.x, v.y, e.rc * .6, 'walk')) return '';   // in reach, and a way to them: nothing solid between
  if ((v.vx * (v.x - e.x) + v.vy * (v.y - e.y)) / Math.max(1, d) > 60) return '';   // they are backing away: it lets them
  const cornered = skCornered(eng, e, v);
  const odds = clamp(SK.defBase + (cornered ? SK.defCornered : 0) + SK.defPerWithdraw * (A.withdrew || 0) + (e.tr.AGGRESSION - .45) * SK.defAggr + SK.defHunger * e.hunger - (e.stam < 40 ? SK.defTired : 0), .1, .95);
  A.defUntil = now + SK.defCool; e.defNext = now + SK.defGapAll; A.defAt = now; e.rx = null; e.dbg.rx = '';
  const strike = e.awRng() < odds;
  e.dbg.def = { pid: A.pid, k: strike ? 'strike' : 'withdraw', odds: +odds.toFixed(2), cornered, p: +A.p.toFixed(2), why: A.why, h: +e.hunger.toFixed(3), at: now };
  if (strike) {
    // where it believes they will be when it reaches them (the pounce's own reckoning, from what it sees of their motion), its seeded error;
    // somebody coming straight at it would be reckoned past it: then it meets them where they are, led only by their sideways motion
    const ux = (v.x - e.x) / Math.max(1, d), uy = (v.y - e.y) / Math.max(1, d), touch = e.r + 16, vr = clamp(v.vx * ux + v.vy * uy, -300, 300);
    const tc = SK.defWind + clamp((d + vr * SK.defWind - touch) / Math.max(60, SK.defSpeed - vr), 0, SK.defDur);
    let ax = v.x + v.vx * tc, ay = v.y + v.vy * tc;
    if ((ax - e.x) * ux + (ay - e.y) * uy < touch) { ax = v.x + (v.vx - vr * ux) * tc; ay = v.y + (v.vy - vr * uy) * tc; }
    const err = (e.awRng() - .5) * (1.2 - e.tr.INTELLIGENCE) * .4;
    skSpring(eng, e, Math.atan2(ay - e.y, ax - e.x) + err, r.id, 'defend', `P${r.id} would not stop ${A.why}: it defends itself`);
    A.defs = (A.defs || 0) + 1; e.tally.defend++; eng.note(`K#${e.id} defends itself against P${r.id} (${A.why})`);
    return 'strike';
  }
  A.withdrew = (A.withdrew || 0) + 1; A.p *= .7; e.tally.withdraw++;
  skLeave(eng, e, r, `P${r.id} would not stop ${A.why}: it withdraws, fast`).fast = true; eng.note(`K#${e.id} withdraws from P${r.id}`);
  return 'withdraw';
}
/* (B2) a warning: at most one at a time, never sooner than SK.warnGap after the last ended */
function skWarn(eng, e, A) {
  const now = eng.now;
  e.rx = { k: 'warn', pid: A.pid, at: null, t0: now, until: now + lerp(SK.warnTime[0], SK.warnTime[1], e.awRng()) };
  A.warns++; A.warnAt = now; A.nextWarn = e.rx.until + SK.warnGap; A.nextAck = Math.max(A.nextAck, e.rx.until + SK.ackGap[0]); e.tally.warn++;
  e.dbg.rx = `P${A.pid} keeps ${A.why}: it turns on them, hunched, and backs away (a warning)`; eng.note(`K#${e.id} warns P${A.pid} (${A.why})`);
  setState(e, S.PROVOKED, 'creep');
}
/* the end of a reaction; a warning given (done), it turns away from them: another way out (a departure keeps its time; roaming, it leaves) */
function skReactEnd(eng, e, done) {
  const R = e.rx; e.rx = null; e.dbg.rx = ''; e.rxEnd = eng.now;
  if (R.k !== 'warn') return;
  const A = R.pid ? e.aw.get(R.pid) : null, P = e.plan; if (A && (done || eng.now - R.t0 >= SK.warnTime[0])) A.warnEnd = eng.now;   // (a warning cut short is no warning)
  if (P && SK_STATE[P.k]) setState(e, SK_STATE[P.k][0], SK_STATE[P.k][1]); else setState(e, S.ROAMING, '');
  if (!done || e.disguise) return;
  const r = R.pid ? e.mem.p.get(R.pid) : null;
  if (P && P.k === 'leave') { const g = skLeaveGoal(eng, e); if (g) { P.goal = g; plan(eng, e, g.x, g.y, { why: 'leave (warned)' }); P.rerouted = (P.rerouted || 0) + 1; e.dbg.why = `it warned P${R.pid}: it goes another way`; } }
  else if (!P && r && !tgtGone(eng, e, r)) skLeave(eng, e, r, `it warned P${R.pid}: it goes another way`);
}
/* its head while it roams or leaves: toward the person it has noticed most, while it has them in view (or a moment after) */
function skGaze(eng, e, dt) {
  const now = eng.now; let want = 0, best = null;
  if (!e.disguise) for (const A of e.aw.values()) if (A.tier && now - A.last < 1 && (!best || A.p > best.p)) best = A;
  let pid = best ? best.pid : 0, lim = 1;
  if (e.ackHead && now < e.ackHead.until && e.seenNow.has(e.ackHead.pid)) { pid = e.ackHead.pid; lim = SK.ackHead; } else if (e.ackHead && now >= e.ackHead.until) e.ackHead = null;   // (R11) a look back over its shoulder
  // (R11) nobody noticed close by: the person it notices most among those it sees, at any distance and any hunger - whoever meets its eyes,
  // then whoever could see it, then whoever comes toward it, then the nearest (a look with the head; its way goes on)
  // (a departure keeps B1's own head tracking of whoever it has noticed, as before)
  if (!pid && !e.disguise && e.mind && !(e.plan && e.plan.k === 'leave')) { let bs = -1e9; for (const id of e.seenNow) { const r = e.mem.p.get(id), o = e.mind.obs.get(id); if (!r || !r.visual || r.dist > SK.gazeFar || tgtGone(eng, e, r)) continue;
    const v = r.visual, toward = ((e.x - v.x) * v.vx + (e.y - v.y) * v.vy) / Math.max(1, r.dist), s = (o && now - o.eyesAt < .5 ? 3 : 0) + (o && o.inView ? 1 : 0) + (toward > 40 ? 1 : 0) - r.dist / 800;
    if (s > bs) { bs = s; pid = id; } } }
  if (pid) { const r = e.mem.p.get(pid); if (r && !tgtGone(eng, e, r)) { const q = perc(eng, e, r); want = clamp(angDiff(Math.atan2(q.y - e.y, q.x - e.x), e.ang), -lim, lim); } }
  const h = (e.head || 0) + (want - (e.head || 0)) * Math.min(1, dt * 5); e.head = Math.abs(h) < 1e-3 && !want ? 0 : h;
}

/* ---- the decision: what it does about the people it perceives (on its think, 10 Hz near) ---- */
function skDecide(eng, e) {
  const now = eng.now, P = e.plan;
  for (const [id, until] of e.left) if (until <= now || !eng.byId.has(id)) e.left.delete(id);
  if (e.leftAt) for (const id of [...e.leftAt.keys()]) if (!e.left.has(id)) e.leftAt.delete(id);       // (R6) when it left them: only while it is leaving them alone
  for (const id of [...e.spent.keys()]) if (!eng.byId.has(id)) e.spent.delete(id);                     // (R6) the effort spent on somebody who has left the game goes with them
  if (e.defLeave) {                                                                 // (B3) its defence missed: it leaves them, fast
    const r = e.mem.p.get(e.defLeave); e.defLeave = 0;
    if (r && !tgtGone(eng, e, r)) { skLeave(eng, e, r, `its defence against P${r.id} missed: it goes`).fast = true; return; }
  }
  if (P && P.k === 'leave') {
    if (now < P.until && !(P.goal && Math.hypot(P.goal.x - e.x, P.goal.y - e.y) < 80)) {   // a departure is carried through...
      // (B2) ...unless a very hungry one, some way into it, sees somebody it may hunt now - never after a lost race, never on hunger alone
      if (!(e.hunger >= SK.chaseHunger && !e.exh && !P.race && now - P.t0 >= SK.leaveDwell && now >= (P.reT || 0) && skSeen(eng, e).some(r => skMayHunt(eng, e, r)))) { skMindKept(e, now, SK_ANY); return; }
      P.reT = now + 1;                                                               // (it thinks again at most once a second)
    } else { e.plan = null; e.dbg.why = 'it left; it roams again'; }
  }
  const all = skSeen(eng, e), seen = all.filter(r => skMayHunt(eng, e, r));                   // (R1: a starving one may take up a person it left, on fresh sight)
  if (e.heard.length) e.heard = e.heard.filter(q => now - q.at < SK.heardTtl && eng.byId.has(q.pid));   // (T6) lines expire; a person who left takes theirs
  if (P && P.k === 'feed') {                                                      // at its kill: fed, or disturbed (seen close, or watched), it goes
    const near = all.find(r => r.dist < 520 || skWatched(eng, e, r));
    if (near) { skDon(eng, e, P); skLeave(eng, e, null, `disturbed at its kill by P${near.id}`); return; }
    if (now > P.until || (e.hunger < .02 && (P.fed || 0) >= SK.skinFeed)) { skDon(eng, e, P); e.plan = null; e.dbg.why = 'fed: it roams again'; }   // (T6: a meal lasts at least SK.skinFeed: it takes its time with the body)
    return;
  }
  if (e.skin) { e.skin = null; e.tally.skinLost++; e.dbg.skin = 'left behind: it was not at its meal'; }   // (T6) a skin is only taken at the meal
  if (!seen.length) { skUnseen(eng, e); return; }
  const r = seen[0], h = e.hunger, p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y), Hn = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
  const retake = e.left.has(r.id);                                                               // (R1) somebody it left, seen again (a starving one may take them up)
  const enc = skEnc(eng, e, r, true), watched = skWatched(eng, e, r), lit = skLit(eng, e) > SK.exposed, crowd = seen.length;
  // (R13) seen: eye contact (R8's watched) OR in their view by the rules of their own screen (R11's mind: their sight mask, a clear line,
  // readable light) - a top-down player sees it whichever way they face.  Eye contact keeps its own meaning where it had one (B1-B3's
  // warnings, a mildly hungry one sent away by a look); every tactic that hides from them now hides from their view
  const mo = e.mind && e.mind.obs.get(r.id), inView = !!(mo && mo.inView && now - mo.seenAt < .2), seenMe = watched || inView;
  // (R20) at its post, somebody comes into its sight, unaware of it, walking its way: it lies in wait for them there (an ambush) - its
  // spring takes them if they come on; anything else it answers as it would anywhere (the post is over)
  if (P && P.k === 'post' && P.arrived && crowd === 1 && !seenMe && !lit && d > SK.approachStop && d > 1 && ((p.x - e.x) * p.vx + (p.y - e.y) * p.vy) / d < -30) {
    e.tally.postSeen = (e.tally.postSeen || 0) + 1;
    skBegin(eng, e, 'ambush', r, `P${r.id} comes by its post, unaware: it waits, ready`, { until: now + 3 + 3 * e.tr.PATIENCE, post: 1 }).face = { x: p.x, y: p.y }; skMindKept(e, now, SK_SEEN); return;
  }
  const spent = enc.spent / skBudget(e), T = e.tr, cur = e.plan && e.plan.pid === r.id ? e.plan.k : null;
  const waiting = cur === 'lure' || cur === 'ambush' || (cur === 'intercept' && e.plan.arrived) || cur === 'search';
  if (waiting && e.plan.came === undefined && d < 320) { e.plan.came = now; if (cur === 'lure' || cur === 'ambush') e.tally[cur + 'Came']++; else if (cur === 'intercept') e.tally.interceptCame++; else e.tally.searchFound++; }
  if (spent >= 1) { skLeave(eng, e, r, `its time with P${r.id} is spent (${Math.round(enc.spent)} s)`); return; }
  // which way they are moving, relative to it (from what it sees): running from it, or coming at it
  // (fleeing: running from it, or hurrying off after meeting its eyes - somebody who simply walks on has not noticed it)
  if (watched) enc.eyes = now;
  const away = d > 1 ? ((p.x - e.x) * p.vx + (p.y - e.y) * p.vy) / d : 0, fleeing = away > 200 || (away > 110 && now - (enc.eyes ?? -99) < 4), winded = skWinded(eng, e, r, now);   // (R20: its belief, not their meter)
  // (T6) in a borrowed skin it does not hide: it walks up like one of them; a hungry one drops the skin to run after somebody who flees
  if (e.disguise && crowd === 1) {
    if (fleeing && h >= SK.chaseHunger && !e.exh && e.stam >= SK.stamLow + 15 && d < SK.chaseFrom && cur !== 'chase') {
      skUndress(eng, e, `P${r.id} runs: it drops the skin to give chase`); skBegin(eng, e, 'chase', r, `P${r.id} runs: it gives chase`, { dmin: d }); return;
    }
    if (cur === 'mingle' || cur === 'chase') return;
    if (fleeing) { skLeave(eng, e, r, `P${r.id} hurries away: it lets them go`); return; }
    skBegin(eng, e, 'mingle', r, `in P${e.disguise.from}'s skin it walks up to P${r.id}`, { ph: 'walk' }); return;
  }
  // lying in wait and they are walking into it, unaware: it holds still (the ambush; T4 springs it)
  if (waiting && cur !== 'search' && !seenMe && !lit && away < -30 && d > SK.approachStop && crowd === 1) { e.dbg.why = `P${r.id} is coming its way, unaware: it holds still`; skMindKept(e, now, SK_SEEN); return; }
  // (R13) lying in wait (round its corner, or in ambush) out of their view: seeing them from there does not draw it out - the point is that
  // they come (its spring takes them when they do); seen there, or when its wait ends, it decides afresh
  if ((cur === 'lure' || cur === 'ambush') && !seenMe && crowd === 1 && d > SK.pounceRange[1] && !fleeing && !(e.pre && e.pre.force)) { skMindKept(e, now, SK_SEEN); return; }
  // (R20) gone ahead of somebody it sees (or waiting there): kept while they come on unaware and still toward its spot - seen, running, or
  // turned off well away from it, it decides afresh
  if (cur === 'intercept' && e.plan.ahead && !seenMe && crowd === 1 && d > SK.pounceRange[1] && !fleeing && Math.hypot(p.x - e.plan.g.x, p.y - e.plan.g.y) < e.plan.gd + 250) { skMindKept(e, now, SK_SEEN); return; }   // (R16d: not when they are going away from it - skPreempt)
  // what each option is worth now (seeded draws break near-ties: two Skin-Stealers in the same spot do not act alike).  (R1) Smooth in
  // hunger: hm (0 below .3 .. 1 from .6) is how hungry it is for a hunt, hs (0 below .55 .. 1 from .95) how near starving.  Eye contact
  // still sends a mildly hungry one away; a hungry one flanks; a starving one comes on openly or flanks, and rarely backs off.
  const nf = e.noFlank && now - e.noFlank.t < SK.noFlank && Math.hypot(p.x - e.noFlank.x, p.y - e.noFlank.y) < 200;   // (R3) no way round them here
  const hm = sm(.3, .6, h), hs = sm(.55, .95, h), restRace = Hn && now - Hn.raceAt < SK.chaseRest, spentTactics = !!(Hn && (Hn.flanks >= SK.flankMax || Hn.baitFailed || (nf && Hn.noFlank)));
  // the hunt's preferred answer to being seen; with no hunt yet, the one it would draw (drawn when the hunt begins, below)
  const style = Hn ? (Hn.flanks >= SK.flankMax ? 'bait' : Hn.baitFailed ? 'flank' : Hn.style) : (h >= SK.huntHunger && seenMe && !e.disguise ? skStyle(e) : '');
  // (R18, the owner's overtuned experiment) its drive (0 fed .. 1 starving, smooth); a standoff that ESCALATES - the longer it has stood off
  // with somebody who knows it is there (enc.so: its watch, and an open approach they can see), the more it moves on them: a purposeful
  // advance, then (hungry enough, its breath allowing) a run.  Fed, it only watches.  Somebody walking away from it is not let go so easily
  const drive = skDrive(e), escT = lerp(SK.escalate[0], SK.escalate[1], sm(SK.huntHunger, .85, h)) * (.8 + .4 * T.PATIENCE);
  const esc = h < SK.huntHunger || e.disguise ? 0 : Math.min(2, (enc.so || 0) / escT), leavingThem = away > 80 && !fleeing;
  // (R19) a way round under way that no longer leads to them: they are seen moving off from the spot it chose by them, or are well away
  // from where they were when it chose it (SKC.moved) - it weighs its answers afresh (R13-R18 went on to the spot regardless; fleeing
  // already ended it).  Seen only: out of its sight the way round goes on, and at its end it reckons where they will have gone (skFromCover)
  const FP = cur === 'flank' && !e.plan.arrived ? e.plan : null, fSpot = FP && FP.spot, fd = fSpot ? Math.hypot(p.x - fSpot.x, p.y - fSpot.y) : 1;
  const flankStale = !!FP && ((FP.tp && Math.hypot(p.x - FP.tp.x, p.y - FP.tp.y) > SKC.moved) || (fSpot && ((p.x - fSpot.x) * p.vx + (p.y - fSpot.y) * p.vy) / Math.max(1, fd) > 80));
  const W = {
    leave: (1 - h) * 1.1 * (1 - .5 * hm) + (crowd - 1) * .7 + (lit && watched && !e.disguise ? .5 * (1 - hm) : 0) + (e.exh ? .7 : 0) + T.CAUTION * .2 * (1 - hs) + spent * 1.2 + (h < SK.band[0] ? .8 : 0),   // (R11: lit and watched sends away only the not-yet-hungry; a hungry one finds another way)
    watch: cur === 'watch' && now > e.plan.until ? 0 : (d > SK.near ? .5 : .2) + T.PATIENCE * .25 - h * .5 + (watched && !e.disguise && h >= SK.huntHunger ? .2 * hm * (1 - hs) : 0) - .55 * esc,   // (R1: a standoff; R18: shorter, and it escalates)
    retreat: e.disguise ? 0 : (watched && h >= SK.huntHunger ? .45 + h * .6 + T.INTELLIGENCE * .2 + (style === 'bait' ? .4 : 0) : watched && d < SK.near ? .9 : 0) * (1 - .8 * sm(.45, .85, h)) * (1 - .4 * Math.min(1, esc)),   // (R18: a very hungry one rarely backs off)   // (T6: in a skin, being looked at is the point; R13: the bait answers a look - eye contact)
    flank: fleeing ? 0 : cur === 'flank' && !e.plan.arrived ? (flankStale ? .25 : 2) :                         // (R1) to their side, out of their sight (a flank under way goes on - R13: not round somebody running off)
      !seenMe || e.disguise || h < SK.huntHunger || e.exh || crowd > 1 || nf || (Hn && Hn.flanks >= SK.flankMax) ? 0 : (.35 + hm * (1 - .5 * hs) + T.INTELLIGENCE * .25 + (style === 'flank' ? .4 : -.45)) * (d < SKF.near && h >= SK.chaseHunger ? .4 : 1) * lerp(1, lerp(1, .55, sm(350, 700, d)), sm(.6, .85, h)),   // (R18: very hungry, a long way round from afar loses to coming on)   // (R18: this close and hungry, its place by them beats a long way round)
    // (R13) in their view but not met by their eyes: a covert way round (flank) is preferred where there is one; else it comes on openly - an
    // open approach under way is carried through until they meet its eyes; within a leap of somebody not looking at it, it takes the chance
    approach: h < .25 || e.exh ? 0 : cur === 'approach' && e.plan.mode === 'open' && !e.plan.shadow && (!watched || e.plan.committed) && !fleeing && !e.disguise ? 2 :
      ((watched ? .15 + 1.1 * hs + (spentTactics ? .45 * hm : 0) : fleeing && !(cur === 'approach' && e.plan.shadow) ? .3 : inView ? .55 + .6 * hs : 1) * (h * 1.6 - T.CAUTION * .25 + (lit ? -.1 : .25) + (watched ? 0 : .3 * hm * (1 - hs)))
        + (inView && !watched && !fleeing && cur !== 'chase' && !e.disguise && crowd === 1 && h >= SK.huntHunger && d < SK.pounceRange[1] + 60 ? 1.5 : 0)
        + (fleeing || e.disguise ? 0 : .9 * Math.min(1.5, esc) * drive + (leavingThem && h >= SK.huntHunger ? .9 * drive : 0))
        + (watched && !fleeing && !e.disguise && crowd === 1 && d < SK.gazeFar ? .5 * sm(.6, .85, h) * sm(350, 700, d) : 0)) * (crowd > 1 ? .6 : 1),   // (R18: very hungry and seen from afar, it comes on rather than go the long way round - the hungry, and any close by, keep their ways round and the bait)   // (R18: the standoff escalates; a walker going away is followed; R1-R16i: x .35 with two or more)   // (R1: hungry, it goes for an unaware person even in light; watched, it comes on openly when starving, or very hungry once its flanks and its bait have failed; still a lone ambusher; after a lost race it keeps to the runner's trail)
    chase: cur === 'chase' ? (e.plan.lost ? 0 : 2) :                                       // a chase runs until its own rules end it (skAct)
      e.exh || e.disguise || restRace || e.stam < SK.stamLow + 15 || d > SK.chaseFrom * (1 + .4 * hs) || (crowd > 1 && h < .7) || !(fleeing || winded || leavingThem || esc >= 1.2) ? 0 :
        sm(SK.chaseHunger - .1, SK.chaseHunger + .15, h) * (.55 + h * .9 + (winded ? .5 : 0) + (esc >= 1.2 ? .3 * esc : 0) - T.CAUTION * .3) * (crowd > 1 ? .6 : 1) * SK20.chaseW,   // (R16d: starving, it gives chase from farther; R18: graduated from about .35, also after a walker or out of an escalated standoff, and - starving - with two of them about)
  };
  if (cur === 'retreat' && e.plan.arrived && !watched) W.retreat = 0;                       // out of sight now: decide afresh
  // (R19, the independent review) somebody going their own way (moving, not towards it) whose way round it has just dropped as stale, or
  // refused while they moved (remembered with the place: SK.noFlank, 200 px), is not answered with the bait on the next thinks either
  // (the second review) ...nor one it gives up because they run off from it (fleeing: R13's rule ends the way round), which is as stale
  const flankGone = flankStale || (!!FP && fleeing), goingOn = Math.hypot(p.vx, p.vy) > 60 && away > 0;
  if (goingOn && (flankGone || (nf && e.noFlank.worth === 2))) W.retreat = 0;
  for (const k in W) W[k] = Math.max(0, W[k] * (.92 + .16 * e.rng()));
  const pick = () => Object.keys(W).sort((a, b) => W[b] - W[a] || a.localeCompare(b))[0];
  let best = pick(), fs = null;
  // (R4) going round them needs a spot: with none here it remembers that for the place and takes its next best answer now (R3 held its
  // ground for a tick first - a flicker of watching)
  // (R7) ...looked for only when going round them would really be begun (not when the plan under way is kept anyway: no route searched for nothing)
  const kept = k => (P && P.k === 'leave' && e.plan === P && W[k] < W.leave * SK.rethink) || (!!cur && k !== cur && W[k] < (W[cur] || 0) * SK.rethink && !(cur === 'watch' && now > e.plan.until));
  if (best === 'flank' && cur !== 'flank' && !kept('flank')) { fs = skFlankSpot(eng, e, p, d, r.id); if (!fs) { e.noFlank = { x: p.x, y: p.y, t: now }; e.tally.noFlank++; if (Hn) Hn.noFlank = now; W.flank = 0; best = pick(); } }
  // (R19) a way round is worth its time only while there will be somebody there at its end (skFlankWorth: somebody moving would be gone
  // from its spot; somebody standing still, beyond what it may spend over coming on openly).  Too slow, it weighs less - and its next
  // answer may win (logged: e.dbg.pos).  R13-R18 took any covert way up to 4.5 x the straight distance
  // (A way round refused for somebody moving is not answered with the bait either - a back-off round a corner for somebody already going
  // their own way, the same absence: it comes on, gives chase, watches or leaves - the pack's open press for prey moving away)
  // (the independent review: a refusal is remembered for the place, as "no way round here" is - SK.noFlank, or until they are 200 px on -
  // so the same search is not made again on every think; its record and tally are written only when the plan really changes, below)
  let pos = null;
  if (fs) { const q = skFlankWorth(e, p, d, fs); fs.worth = q;
    if (q.f < 1) { W.flank *= q.f; if (q.off !== undefined && away > 0) W.retreat = 0; const b2 = pick(); if (b2 !== 'flank') { e.noFlank = { x: p.x, y: p.y, t: now, worth: q.off !== undefined ? 2 : 1 }; pos = { k: 'flankRefused', eta: [q.etaF, q.etaD], why: `its way round P${r.id} would take ${q.etaF} s (${q.off !== undefined ? `they would be ${q.off} px from its spot by then` : `against ${q.etaD} s coming on; it may spend ${q.B} s more`}): ${b2}` }; best = b2; fs = null; } } }
  if (flankGone && best !== 'flank') pos = { k: 'flankStale', why: `P${r.id} is ${flankStale ? 'moving' : 'running'} off from its way round: ${best}`, memo: goingOn ? { x: p.x, y: p.y, t: now, worth: 2 } : null };   // (remembered as a mover's refusal: no way round them, nor the bait, here for now)
  // (R13) an approach it is not seen making: covert only along a covert way to a spot within its spring that they cannot see (an
  // ambush point); with none, it comes on openly only very hungry (labelled: they can see it if they look) - else it looks for a hidden spot
  // at their side (a flank from where it is), or holds where it is, unseen
  // (R16) with no ambush point near them here a moment ago, it does not search again on every think (as with no way round them: SK.noFlank)
  let ap = null;
  // (R20) somebody it sees walking on, unaware of it, some way off: hungry enough to hunt, it goes ahead to wait for them where they will
  // pass - beside their way, out of sight of it (skPredict's spot), at the pace that gets it there first (skPace) - rather than coming up
  // behind them.  They may turn off: its guess can be wrong (it then decides afresh; an interception's own rules end it)
  if (best === 'approach' && cur !== 'approach' && cur !== 'ambush' && !seenMe && !kept('approach') && !e.disguise && h >= SK.huntHunger && !e.exh && crowd === 1 && !lit && d > SK.pounceRange[1] + 40 && away < -60) {
    // (R20) coming its way, unaware, and their way passes close by it (in the dark): it lets them come - an ambush where it stands
    const vv = Math.hypot(p.vx, p.vy) || 1, cpa = Math.abs(((e.x - p.x) * p.vy - (e.y - p.y) * p.vx) / vv);
    if (cpa < SK20.waitCpa) { e.tally.waitHere = (e.tally.waitHere || 0) + 1; skHuntBegin(eng, e, r, 'it waits for them'); skBegin(eng, e, 'ambush', r, `P${r.id} is coming its way, unaware: it waits for them where it is, in the dark`, { until: now + 3 + 4 * T.PATIENCE, here: 1 }).face = { x: p.x, y: p.y }; skMindKept(e, now, SK_SEEN); return; }
  }
  if (best === 'approach' && cur !== 'approach' && !seenMe && !kept('approach') && !e.disguise && h >= SK.huntHunger && !e.exh && crowd === 1 && d > SK20.aheadFrom && Math.hypot(p.vx, p.vy) > 60) {
    const g = skAhead(eng, e, r); e.dbg.ahead = { at: +now.toFixed(2), pid: r.id, g: g ? { slack: g.slack, lead: g.lead } : null };
    if (g) { e.tally.ahead = (e.tally.ahead || 0) + 1; skIntercept(eng, e, r, g, `P${r.id} walks on, unaware of it: `); e.plan.ahead = 1; e.plan.gd = Math.hypot(p.x - g.x, p.y - g.y); return; }
  }
  if (best === 'approach' && cur !== 'approach' && !seenMe && !kept('approach') && !e.disguise) {
    const na = e.noAmbush && now - e.noAmbush.t < SK.noFlank && Math.hypot(p.x - e.noAmbush.x, p.y - e.noAmbush.y) < 200;
    ap = d <= SK.pounceRange[1] ? { near: 1 } : na ? null : skFlankSpot(eng, e, p, d, r.id, [SK.pounceRange[0] + 45, Math.max(SK.pounceRange[0] + 45, Math.min(SK.pounceRange[1] - 15, d - 60))], e.coverRng);
    if (!ap && !na) e.noAmbush = { x: p.x, y: p.y, t: now };
    if (!ap && !(h >= SK.chaseHunger || fleeing || winded)) { W.approach = 0; best = pick(); if (best === 'flank' && !kept('flank')) { fs = skFlankSpot(eng, e, p, d, r.id); if (!fs) { e.noFlank = { x: p.x, y: p.y, t: now }; e.tally.noFlank++; if (Hn) Hn.noFlank = now; W.flank = 0; best = pick(); } } }
  }
  e.dbg.decide = { at: +now.toFixed(2), pid: r.id, d: Math.round(d), watched: !!watched, seen: seenMe ? 1 : 0, lit, crowd, h: +h.toFixed(2), spent: +spent.toFixed(2), away: Math.round(away), W: Object.fromEntries(Object.entries(W).map(([k, v]) => [k, +v.toFixed(2)])), best };
  if (P && P.k === 'leave' && e.plan === P) {                                        // (B2) a very hungry departure, thought over: kept unless clearly worse
    if (best === 'leave' || W[best] < W.leave * SK.rethink) { e.dbg.lv = `very hungry, it saw P${r.id}: it keeps going`; e.dbg.lvAt = now; skMindKept(e, now, SK_SEEN); return; }
    e.tally.reconsider++; e.dbg.lv = `very hungry, it saw P${r.id}: it gives up its departure`; e.dbg.lvAt = now;
  }
  if (cur && best !== cur && W[best] < (W[cur] || 0) * SK.rethink && !(cur === 'watch' && now > e.plan.until)) { skMindKept(e, now, SK_SEEN); return; }   // keep the plan unless something is clearly better
  if (best === cur) { skMindKept(e, now, SK_SEEN); return; }
  if (pos) { if (pos.memo) e.noFlank = pos.memo; delete pos.memo; e.tally[pos.k]++; e.dbg.pos = Object.assign({ at: +now.toFixed(2), pid: r.id }, pos); }   // (R19: the positioning choice that changed its plan)
  if (retake && best !== 'leave') { e.left.delete(r.id); e.tally.reengage++; }                  // (R1, R7) taken up again - only now that it does: a departure kept keeps its cooldown
  if (best === 'leave') skLeave(eng, e, r, h < SK.band[0] ? `not hungry: it leaves P${r.id} alone` : crowd > 1 ? `more than one of them (${crowd})` : e.exh ? 'exhausted' : lit && watched ? 'seen in the light' : `it decides against P${r.id}`);
  else if (best === 'watch') skBegin(eng, e, 'watch', r, `it watches P${r.id}`);
  else if (best === 'retreat') {
    const bait = h >= SK.chaseHunger && !e.exh && (d > SK.near || (Hn && Hn.flanks > 0)), s = skHideSpot(eng, e, p, bait);   // (R1: after its flanks failed, backing round a corner is the bait, however close)
    if (bait) { const Hb = skHuntBegin(eng, e, r, 'the bait'); Hb.baited = (Hb.baited || 0) + 1; }
    skBegin(eng, e, 'retreat', r, bait ? `seen by P${r.id}: it backs away slowly, round a corner (inviting them to follow)` : `seen by P${r.id}: it backs out of sight`, { spot: s, bait, from: { x: e.x, y: e.y }, mode: bait ? 'feint' : 'withdraw' });   // (R13: a bait is meant to be seen)
    if (s) plan(eng, e, s.x, s.y, { why: 'retreat' });
  }
  else if (best === 'approach') {
    if (h >= SK.huntHunger) skHuntBegin(eng, e, r, 'it comes for them');
    if (seenMe) skBegin(eng, e, 'approach', r, watched ? `P${r.id} has seen it: ${skBand(h)}, it comes on anyway, openly` : `P${r.id} can see it: it comes on openly`, { mode: 'open' });   // (R13: its real hunger band - R8 said 'starving' for any)
    else if (ap && ap.way) { skBegin(eng, e, 'approach', r, `P${r.id} cannot see it: it creeps nearer under cover (${ap.L} px)`, { mode: 'covert', spot: ap, way: ap.way, tp: { x: p.x, y: p.y, v: Math.hypot(p.vx, p.vy) } }); e.path = ap.way.pts.slice(); e.goal = { x: ap.x, y: ap.y }; e.goalKey = 'covert'; e.pathAge = 0; }
    else skBegin(eng, e, 'approach', r, ap && ap.near ? `P${r.id} is right there, unaware: it comes on` : `P${r.id} cannot see it yet, but there is no cover nearer: it comes on openly`, { mode: 'open' });
  }
  else if (best === 'chase') { skHuntBegin(eng, e, r, 'it gives chase'); skBegin(eng, e, 'chase', r, fleeing ? `P${r.id} runs: it gives chase` : `P${r.id} is winded: it closes in`, { dmin: d }); }
  else if (best === 'flank') {                                                                // (R1) to cover at their side (its spot found above)
    const s = fs;
    const Hh = skHuntBegin(eng, e, r, 'it goes round them'); Hh.flanks++;
    skBegin(eng, e, 'flank', r, `seen by P${r.id}: it backs out of their sight and goes round them under cover (${s.L} px${s.worth ? `, ${s.worth.etaF} s` : ''})`, { spot: s, way: s.way, mode: 'covert', until: now + Math.max(SK.flankDur, s.L / 200 + 3), tp: { x: p.x, y: p.y } });   // (R19: tp - where they were)
    e.path = s.way.pts.slice(); e.goal = { x: s.x, y: s.y }; e.goalKey = 'covert'; e.pathAge = 0;   // (R13: its covert way, as audited - not planned again with a softer cost)
  }
}
/* nobody it may consider is in view: its plan about somebody goes on without a sighting, or it decides what that loss means */
function skUnseen(eng, e) {
  const L = e.plan, H = e.hunt;
  if (L && L.pid) {
    const r = e.mem.p.get(L.pid);
    if (!r || tgtGone(eng, e, r) || (e.left.has(L.pid) && !(H && H.pid === L.pid))) { e.plan = null; e.target = null; skHuntEnd(eng, e, 'nobody to go after'); e.dbg.why = 'it has nobody to go after'; return; }
    const enc = skEnc(eng, e, r, true);
    if (enc.spent >= skBudget(e)) { e.tally.huntSpent++; skLeave(eng, e, r, `its time with P${r.id} is spent (${Math.round(enc.spent)} s)`); return; }
    // (R1) a hunt whose quarry has left no evidence for long enough is over, whatever the plan (not while it waits in its own concealment)
    if (H && H.pid === L.pid && H.conf < SK.huntLow && L.k !== 'retreat' && L.k !== 'flank' && L.k !== 'lure' && L.k !== 'ambush') { e.tally.huntCold++; skLeave(eng, e, r, `no sign of P${r.id} for ${Math.round(eng.now - H.evAt)} s: it gives up`); return; }
    if (L.k === 'lure' || L.k === 'ambush' || L.k === 'intercept' || L.k === 'search' || L.k === 'listen') { skMindKept(e, eng.now, SK_LOST); return; }   // these work without a sighting (skAct ends them)
    if (L.k === 'approach' && L.side && eng.now - L.t0 < SK.flankCome) { skMindKept(e, eng.now, SK_LOST); return; }
    if (L.k === 'approach' && L.rush && eng.now - L.t0 < SKC.rushFor) { skMindKept(e, eng.now, SK_LOST); return; }   // (R13) a rush from cover is carried through to where they were
    if (L.k === 'approach' && L.mode === 'covert' && L.way && !(L.tp && L.tp.v > 40)) { skMindKept(e, eng.now, SK_LOST); return; }   // (R13) a covert way to somebody standing still goes on unseen: that is its point (one who was moving is lost: skLost)     // (R1) from a flank it comes on toward where it believes them, unseen
    if (L.k === 'flank' && (!L.arrived ? eng.now < L.until : eng.now - L.arrived < SK.flankSettle)) { skMindKept(e, eng.now, SK_LOST); return; }   // (R3) a flank goes on to its spot though it has turned its back on them; (R4) there it settles, crouched, a moment
    if ((L.k === 'approach' || L.k === 'chase' || L.k === 'watch') && eng.now - r.seenAt < SK.lostGrace) return;   // (R4) a glimpse lost for a moment is not yet lost: it keeps on (R16d: a watch too - no watch/intercept flicker at a sight edge)
    skLost(eng, e, L, r); return;
  }
  if (L && (L.k === 'search' || L.k === 'listen' || L.k === 'post')) return;      // looking at a sound nobody has been named for (R20: or waiting where it would come out)
  if (!L && H) { skHuntNext(eng, e); return; }                                     // (R1) the hunt goes on: listen, search where it believes them, or give up
  if (!L && e.hunger >= SK.huntHunger && !e.exh && !(e.roam.summon > eng.now)) skListen(eng, e);   // (R20: on its way where an admin sent it, it does not stop for sounds - its ears reach farther now)
}
/* ---- carrying a plan out (every tick) ---- */
function skAct(eng, e, dt, thinkNow) {
  const P = e.plan, now = eng.now;
  if (!P || P.k === 'leave') skGaze(eng, e, dt); else if (e.head) e.head = Math.abs(e.head) < .02 ? 0 : e.head * Math.max(0, 1 - dt * 6);   // (B1)
  if (e.rx && skReact(eng, e, dt)) return;                                          // (B1) a look, over the plan
  if (!P) { if (e.hunt) { skHold(eng, e, dt); return; } skRoam(eng, e, dt, thinkNow); return; }   // (R1: between two steps of a hunt it does not wander off)
  const r = P.pid ? e.mem.p.get(P.pid) : null;
  switch (P.k) {
    case 'watch': {
      // (R16f) a hungry standoff is held on its feet - (R16g, the review) at a watch's own distance, beyond SK.near (a watch never springs:
      // its footwork never carries it into its spring)
      if (r && e.hunger >= SK.chaseHunger && !e.disguise) { const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y); if (skFightable(eng, e, r, p, d) && skFight(eng, e, r, p, d, dt, thinkNow, Math.min(skSpeed(e, 'flank'), skCap(e)), [SK.near + 10, SKF.near - 10])) return; }
      skHold(eng, e, dt);
      if (r) { const p = perc(eng, e, r); faceToward(e, p.x, p.y, dt, 2.2); }
      if (e.act !== 'watch') setAct(e, 'watch');
      if (r && r.seen && e.enc && e.enc.pid === r.id) e.enc.so = (e.enc.so || 0) + dt;   // (R18) the standoff's clock: its stare goes on as before; skDecide escalates it
      return;
    }
    case 'retreat': {
      const s = P.spot;
      if (!s || P.arrived) { skHold(eng, e, dt); if (r) { const p = perc(eng, e, r); faceToward(e, p.x, p.y, dt, 1.8); } return; }
      // the bait backs off slowly, still facing them; a frightened one turns and goes
      follow(eng, e, dt, skSpeed(e, P.bait ? 'stalk' : r && r.seen && r.dist < SK.near ? 'run' : 'stalk'), { arrive: 30 });
      if (Math.hypot(s.x - e.x, s.y - e.y) < 40 || (!e.path.length && e.pathAge > 1)) { P.arrived = now; e.dbg.why = P.bait ? 'round the corner: it waits for them' : 'out of sight: it waits and listens'; setAct(e, 'listen'); }
      return;
    }
    case 'approach': {
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      // (R13) covert: along its covert way to a spot within its spring that they cannot see; there it waits, ready (T4 springs it)
      if (P.mode === 'covert') {
        // (they moved well away from where its ambush point was chosen for them: the point is no use - it thinks again)
        if (thinkNow && r.seen && P.tp && Math.hypot(r.visual.x - P.tp.x, r.visual.y - P.tp.y) > SKC.moved) { P.mode = 'open'; P.way = null; P.tp = null; P.side = 0; e.path = []; e.dbg.why = `P${r.id} has moved on: it follows them, no longer hiding its way`; return; }
        const st = skCovertStep(eng, e, P, dt, thinkNow, r); if (e.plan !== P) return;
        if (st === 'arrived' || st === 'failed') { const q = perc(eng, e, r); e.path = []; skBegin(eng, e, 'ambush', r, st === 'arrived' ? `at its ambush point near P${r.id}, out of their sight: it waits, ready` : `its way nearer P${r.id} ends here: it waits, out of their sight`, { until: now + 3 + 6 * e.hunger * e.tr.PATIENCE }).face = { x: q.x, y: q.y }; }
        return;
      }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      // (R16f) an open approach close to somebody moving or looking at it: it fights for its place - facing them, by their way out.  (R16g,
      // the review) it runs only where it may give chase - the chase's own conditions on it (its hunger, its breath, no race lost to them
      // lately: skMayRun); else at the approach's own pace - their speed and a little more, at least its stalk, never over the pace that
      // costs it stamina
      if (P.mode === 'open' && !P.shadow && !P.rush && skFightable(eng, e, r, p, d) && skFight(eng, e, r, p, d, dt, thinkNow, skMayRun(eng, e, r) ? Math.min(skSpeed(e, 'run'), skCap(e)) : Math.min(Math.max(Math.hypot(p.vx, p.vy) + 30, skSpeed(e, 'stalk')), SK.runFrom, skCap(e)))) { P.cp = null; return; }   // (R19: its footwork has them - no contest point kept)
      // (R3) somebody unaware turning its way, before they meet its eyes: it freezes, crouched, until they look away or its patience runs out
      // (R13: not in an open approach - it is in their view whichever way they face)
      const v = r.seen ? r.visual : null;
      if (v && !P.shadow && P.mode !== 'open' && d > SK.approachStop && d < 900 && !skWatched(eng, e, r)) {
        const off = Math.abs(angDiff(Math.atan2(e.y - v.y, e.x - v.x), v.angle));
        if (off < SK.freezeCone && (P.frozen || 0) < lerp(SK.freezeMax[0], SK.freezeMax[1], sm(.55, .95, e.hunger))) {
          P.frozen = (P.frozen || 0) + dt; if (!P.froze) { P.froze = 1; e.tally.freeze++; e.dbg.why = `P${r.id} turns its way: it freezes`; }
          skHold(eng, e, dt); if (e.act !== 'creep') setAct(e, 'creep'); return;
        }
        if (off > SK.freezeCone + .25 && P.froze) { P.froze = 0; P.frozen = Math.max(0, P.frozen - .5); e.dbg.why = `P${r.id} looks away: it comes on`; }
      }
      if (d < SK.approachStop && Math.hypot(p.vx, p.vy) < 40) { skHold(eng, e, dt); faceToward(e, p.x, p.y, dt, 3); if (e.act !== 'creep') setAct(e, 'creep'); return; }
      // (R12: within its stopping distance of somebody who keeps moving against it - pressed up to a low wall or its own body - a used-up
      // route is worked out again at most twice a second, not on every think)
      if (thinkNow && (now - (P.planT || -9) > 1.5 || (!e.path.length && (d >= SK.approachStop || now - P.planT > .5)))) {
        P.planT = now;
        let G = skContest(eng, e, r, p, d, P);                                                     // (R19) at them, or for their way out
        if (G !== p && !directOk(eng, e, G.x, G.y, SK.contestFrom + 200)) { P.cp = null; G = p; } // (the second review: a kept point is re-checked from where it is now - no straight line there, at them as R18; a point lies at most 200 px beyond them)
        if (G !== p || directOk(eng, e, G.x, G.y, 420)) directTo(eng, e, G.x, G.y);                // (its contest point: straight there, in their sight)
        else plan(eng, e, G.x, G.y, { why: G === p ? 'approach under cover' : 'their way out', cost: skCover(eng, p), maxNodes: 3000 });
      }
      // a still person it creeps up on; a moving one it shadows at their own pace (a little faster), so nobody simply walks away from it -
      // (R7) except the runner who won the race: on their trail it goes a little slower than they do, so a lead won stays won while they move
      const sp = Math.hypot(p.vx, p.vy), creep = d < 420, pace = sp > 40 ? clamp(P.shadow ? sp * SK.shadowPace : sp + 40, e.sp.speeds.creep, SK.runFrom) : 0;   // (R18: +40, was +30)
      // (R13) an open approach looks like one: upright and deliberate (pace), or - breaking cover - a rush at its run (chase); a hidden one
      // creeps as before
      if (P.rush) { setAct(e, 'chase'); follow(eng, e, dt, skSpeed(e, 'run'), { arrive: 40 }); return; }
      if (thinkNow) P.inView = P.mode === 'open' && skExposedNow(eng, e).length > 0;   // (in somebody's view: it walks openly; unseen yet, it stalks)
      // (R16i) a purposeful approach: very hungry and free to run (skMayRun - its hunger, its breath, no race lost to them lately), shown
      // already (in somebody's view now, or in theirs within SK.pressShown: nothing left to hide), and still beyond its footwork's range, it
      // closes on them at its press, upright and fast - not its run (a chase, 255) and never faster than its breath allows (skCap); within
      // SKF.near its footwork or its creep goes on as before.  Not pressed: an approach nobody has seen (it stalks), a fed or mildly hungry
      // one (its pace), a lost race's trail (it lags), a winded one
      // (R18, the owner's overtuned experiment) the press also when they are moving (it must keep up, seen or not), from SK.chaseHunger,
      // graduated by its hunger from its investigation's pace (232) to its press (260); an approach they can see is a standoff that goes on
      // (enc.so: skDecide may turn it into a run).  Unseen, a hungry one closes at its prowl (205) to SK.closeFrom, then stalks or creeps
      const o = e.mind && e.mind.obs.get(r.id), shown = P.inView || !!(o && now - o.sawAt < SK.pressShown);
      if (shown && e.enc && e.enc.pid === r.id && r.seen && d < 760) e.enc.so = (e.enc.so || 0) + dt;
      const press = P.mode === 'open' && !P.shadow && (shown || sp > 60) && d > SKF.near && skMayRun(eng, e, r);
      if (press) {
        if (!P.press) { P.press = now; e.tally.press = (e.tally.press || 0) + 1; e.dbg.why = shown ? `P${r.id} knows it is there and it is hungry: it comes on, fast (its press)` : `P${r.id} is moving off: it comes on, fast (its press)`; }
        setAct(e, 'pace'); follow(eng, e, dt, Math.min(lerp(e.sp.speeds.investigate, e.sp.speeds.press, sm(SK.chaseHunger, .8, e.hunger)), skCap(e), e.disguise ? e.sp.speeds.disguise : 1e9), { arrive: 60 }); return;
      }
      const prowl = !P.shadow && e.hunger >= SK.huntHunger && d > SK.closeFrom ? skSpeed(e, 'prowl') : 0;
      if (prowl && !P.prowl) { P.prowl = now; e.tally.prowlIn = (e.tally.prowlIn || 0) + 1; }
      setAct(e, P.inView && !P.shadow ? (creep && !pace ? 'creep' : 'pace') : creep && !pace ? 'creep' : 'approach');
      follow(eng, e, dt, Math.max(prowl, pace ? Math.min(pace, skCap(e)) : skSpeed(e, creep ? 'creep' : 'stalk')), { arrive: pace || prowl ? 60 : SK.approachStop - 10 });
      return;
    }
    case 'chase': {
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      P.dmin = Math.min(P.dmin, d);
      if (thinkNow) {
        // it stops when it is losing the race, when its breath gives out, or after a short run: a chase is a gamble, never a long pursuit
        const why = d > P.dmin + SK.chaseLose ? `it is losing the race with P${r.id} (${Math.round(d)} px, it was ${Math.round(P.dmin)})` : e.stam < SK.stamLow ? `out of breath chasing P${r.id}` : now - P.t0 > SK.chaseMax ? `P${r.id} has run long enough: it stops` : '';
        if (why) {
          P.lost = true; e.tally.chaseLost++;
          // (R1) a hungry one that is only losing the race does not give up the hunt: it stops running and keeps to the trail at its free
          // walking pace (no faster than it may go without spending stamina), and will not give chase again for SK.chaseRest
          const Hh = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
          if (Hh && e.hunger >= SK.chaseHunger && !e.exh && d <= P.dmin + SK.chaseLose * 3) { Hh.raceAt = now; e.tally.shadow++; skBegin(eng, e, 'approach', r, `${why}: it lets them run and keeps to their trail`, { shadow: 1, mode: 'open' }); return; }
          skLeave(eng, e, r, why).race = true; return;                                   // (B2: a lost race stays a departure)
        }
        if (now - (P.planT || -9) > .5 || !e.path.length) { P.planT = now; if (directOk(eng, e, p.x, p.y, 640)) directTo(eng, e, p.x, p.y); else plan(eng, e, p.x, p.y, { why: 'chase', maxNodes: 3000 }); }
      }
      if (skFightable(eng, e, r, p, d) && skFight(eng, e, r, p, d, dt, thinkNow, skSpeed(e, 'run'))) return;   // (R16f) close: it cuts off their way out, facing them
      setAct(e, 'chase');
      follow(eng, e, dt, skSpeed(e, 'run'), { arrive: 30 });                              // it runs on to them (the strike decides when it springs)
      return;
    }
    case 'ambush': {                                                                   // (R13) at a hidden spot near them: still, facing where they would come from
      skHold(eng, e, dt); if (P.face) faceToward(e, P.face.x, P.face.y, dt, 1.6);
      if (e.act !== 'wait') setAct(e, 'wait');
      if (thinkNow) {
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.t0 + SK.lureMax); if (r && now - r.heardAt < 2.5) P.face = { x: r.hx, y: r.hy }; e.dbg.why = 'it hears them coming: it waits, ready'; }
        if (P.came === undefined && skHeardNear(eng, e, r, 320)) { P.came = now; e.tally.ambushCame++; }
        if (now > P.until || (e.hunger >= SK.chaseHunger && now - P.t0 > SKC.ambushHungry)) {          // (very hungry, it does not wait long)
          const Hh = r && e.hunt && e.hunt.pid === r.id ? e.hunt : null;
          if (r && !tgtGone(eng, e, r) && e.hunger >= SK.chaseHunger && !e.exh) { skFromCover(eng, e, r, 'nobody came by its ambush', true); return; }
          if (Hh && e.hunger >= SK.huntHunger && !e.exh && Hh.conf >= SK.huntLow) { e.plan = null; e.dbg.why = `nobody came by its ambush: it goes after P${P.pid}`; skHuntNext(eng, e); return; }
          skLeave(eng, e, r, `nobody came by its ambush: it gives up on P${P.pid}`); return;
        }
      }
      return;
    }
    case 'lure': {
      skHold(eng, e, dt); if (P.face) faceToward(e, P.face.x, P.face.y, dt, 1.6);
      if (e.act !== 'lure' && !(e.act === 'mimic' && now < e.mimicT)) setAct(e, 'lure');
      if (thinkNow) {
        // (T6) very hungry, unseen, a moment into the wait: it calls out once - words it heard, or a generic call
        if (!P.spoke && now - P.t0 > SK.sayLure && e.hunger >= SK.chaseHunger && !(r && r.seen) && skSay(eng, e, r, 'from hiding')) P.spoke = now;
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.t0 + SK.lureMax); if (r && now - r.heardAt < 2.5) P.face = { x: r.hx, y: r.hy }; e.dbg.why = 'it hears them coming: it waits, ready'; }
        if (P.came === undefined && skHeardNear(eng, e, r, 320)) { P.came = now; e.tally.lureCame++; }
        if (now > P.until) {
          const Hh = r && e.hunt && e.hunt.pid === r.id ? e.hunt : null;                   // (R1) very hungry, a failed bait is one tactic, not the end of the hunt
          if (Hh) Hh.baitFailed = now;
          if (Hh && e.hunger >= SK.chaseHunger && !e.exh && Hh.conf >= SK.huntLow) { e.plan = null; e.dbg.why = `P${P.pid} did not follow: ${e.hunger >= SK.band[3] ? 'starving' : 'very hungry'}, it goes after them instead`; skHuntNext(eng, e); return; }
          skLeave(eng, e, r, P.bait ? `P${P.pid} did not follow: the bait failed` : `nobody came: it gives up on P${P.pid}`); return;
        }
      }
      return;
    }
    case 'intercept': {
      if (!r) { e.plan = null; return; }
      const g = P.g, Hh = e.hunt && e.hunt.pid === r.id ? e.hunt : null, hAt = Math.max(r.heardAt, Hh ? Hh.hAt : -99);
      // footsteps (theirs, or - R2 - a body's where they could be) away from its guess: it corrects it, or goes to look where it heard them
      if (thinkNow && hAt > P.hAt + .3 && P.re < 2 && (!Hh || Hh.revised < SK.reviseMax)) {
        P.hAt = hAt;
        const sx = Hh && Hh.hAt >= r.heardAt ? Hh.x : r.hx, sy = Hh && Hh.hAt >= r.heardAt ? Hh.y : r.hy;
        if (Math.hypot(sx - g.x, sy - g.y) > 350) {
          const g2 = skPredict(eng, e, Hh ? skBeliefRec(Hh) : r), w2 = g2 && Hh ? skHypOf(skHyps(eng, e, Hh), g2.qx, g2.qy) : null;   // (R12: labelled with its way)
          if (g2) g2.hyp = w2 ? w2.id : 0;
          if (g2 && Math.hypot(g2.x - g.x, g2.y - g.y) > 250) {
            P.re++; P.reAt = now; if (Hh) Hh.revised++; e.tally.revise++; P.g = g2; if (P.arrived) { P.arrived = 0; P.until = Math.min(P.t0 + SK.interceptMax + 8, now + 10); }
            e.dbg.predict = Object.assign({ at: +now.toFixed(2), pid: r.id, corrected: 1 }, g2); skInterceptWay(eng, e, P, r, g2);   // (R13: covert again if it can be)
            e.dbg.why = `it heard ${Hh && Hh.hAt >= r.heardAt ? 'something where P' + r.id + ' could be' : 'P' + r.id}: it corrects its guess`;
          } else if (!g2 && Hh && Math.hypot(sx - e.x, sy - e.y) > 320) {
            Hh.revised++; e.tally.revise++; skFailed(Hh, g.qx, g.qy, now, 'revised');
            skSearch(eng, e, r, `it heard something where P${r.id} could be, away from its guess: it goes to look`, { x: sx, y: sy }); return;
          }
        }
      }
      if (!P.arrived && P.mode === 'covert' && P.way) {                               // (R13) along its covert way: out of every view it knows of
        if (thinkNow) P.need = skNeed(eng, e, P);                                      // (R20) its hidden run, as fast as its guess needs
        const st = skCovertStep(eng, e, P, dt, thinkNow, r); if (e.plan !== P) return;
        if (st === 'arrived' || st === 'failed' || now > P.until) { P.arrived = now; e.path = []; P.until = Math.min(P.until + 4, now + rand(e, SK.interceptWait[0], SK.interceptWait[1]) * (.7 + .6 * e.tr.PATIENCE)); e.dbg.why = `in place, out of sight: it waits for P${r.id} beside the way it guessed`; }
        return;
      }
      if (!P.arrived) {
        // a race to be there first: it runs (its stamina allowing), slowing for the last stretch to arrive quietly
        const last = Math.hypot(P.g.x - e.x, P.g.y - e.y) < 160 && e.path.length <= 1;
        if (thinkNow && !e.path.length && e.pathAge > 1.5) { P.stuck = (P.stuck || 0) + 1; plan(eng, e, P.g.x, P.g.y, { why: 'intercept' }); }
        setAct(e, P.mode === 'open' ? 'chase' : 'intercept');                          // (R16, pack 03: an OPEN interception runs as an open run - upright, the chase's act - never as the hidden run)
        if (thinkNow) P.need = skNeed(eng, e, P);                                      // (R20) the pace its guess needs: a prowl, a burst, or its run
        follow(eng, e, dt, last ? skSpeed(e, 'stalk') : skPace(e, P), { arrive: 30 });
        if (Math.hypot(P.g.x - e.x, P.g.y - e.y) < 44 || (P.stuck || 0) > 2 || now > P.until) {
          P.arrived = now; P.until = Math.min(P.until + 4, now + rand(e, SK.interceptWait[0], SK.interceptWait[1]) * (.7 + .6 * e.tr.PATIENCE));
          e.dbg.why = `in place: it waits for P${r.id} beside the way it guessed`;
        }
        return;
      }
      skHold(eng, e, dt); faceToward(e, P.g.jx, P.g.jy, dt, 1.6);
      skHeadTo(e, Math.sin((now - P.arrived) * 1.3 + e.id) * .45, dt);                // (R3) it listens, its head turning, toward the way they would come
      if (e.act !== 'wait') setAct(e, 'wait');
      if (thinkNow) {
        const hn = skHeardNear(eng, e, r, 320);                                         // its guess was right: they are here, unseen (the dark)
        if (hn) {
          if (P.came === undefined) { P.came = now; e.tally.interceptCame++; }
          if (hn.d > (P.hmin ?? 1e9) + 60) { skSearch(eng, e, r, `P${r.id} passed close by, unseen: it follows the sound`, { x: hn.x, y: hn.y }); return; }
          P.hmin = Math.min(P.hmin ?? 1e9, hn.d);
        }
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.t0 + SK.interceptMax + 8); e.dbg.why = 'it hears them coming: it waits, ready'; }
        if (now > P.until) {
          // (R2) it heard somebody close while it waited, and they did not show: its guess was not wrong - it looks where it heard them
          if (Hh && P.came !== undefined && !e.exh) { e.plan = null; skHuntNext(eng, e, `it heard P${r.id} close by, unseen`); return; }
          // (R2) nobody came, but it has heard them elsewhere since its guess: the newer evidence leads, the guess is not counted as a failed place
          if (Hh && Hh.hAt > (P.reAt ?? P.t0) && !e.exh) { e.plan = null; Hh.conf = Math.max(0, Hh.conf - SK.wrongCost * .5); skHuntNext(eng, e, `nobody came, but it heard something where P${r.id} could be`); return; }
          e.dbg.wrong = (e.dbg.wrong || 0) + 1; e.tally.wrong++;
          // (R2) the hunt remembers the failed place, loses some confidence, and makes its next guess (or gives up for a reason)
          if (Hh) { skFailed(Hh, P.g.qx, P.g.qy, now, 'intercept'); skFailed(Hh, P.g.x, P.g.y, now, 'intercept'); Hh.conf = Math.max(0, Hh.conf - SK.wrongCost); if (P.g.turns.length) skBadTurn(Hh, P.g.turns[0].a); }
          if (Hh && !e.exh) { e.plan = null; skHuntNext(eng, e, 'it guessed wrong (nobody came)'); }
          else if (e.hunger >= SK.chaseHunger && !P.searched && r.conf > .2 && now - Math.max(r.seenAt, r.heardAt) < 8) skSearch(eng, e, r, `it guessed wrong (nobody came): it goes to look for P${r.id}`, { x: r.lkx, y: r.lky });
          else skLeave(eng, e, r, `it guessed wrong (nobody came): it gives up on P${r.id}`);
        }
      }
      return;
    }
    case 'search': {
      const Hh = r && e.hunt && e.hunt.pid === r.id ? e.hunt : null, hAt = Math.max(r ? r.heardAt : -99, Hh ? Hh.hAt : -99);
      if (thinkNow && r && hAt > P.hAt + .3 && (P.moved || 0) < 3) {   // fresher footsteps (theirs, or - R2 - a body's where they could be): it goes there (at most three times)
        P.hAt = hAt; P.moved = (P.moved || 0) + 1;
        const gx0 = Hh && Hh.hAt >= r.heardAt ? Hh.x : r.hx, gy0 = Hh && Hh.hAt >= r.heardAt ? Hh.y : r.hy, gf = skFloorNear(eng, e, gx0, gy0), gx = gf ? gf.x : gx0, gy = gf ? gf.y : gy0;   // (R20 C3) on floor it fits
        if (Math.hypot(gx - P.goal.x, gy - P.goal.y) > 90) { P.goal = { x: gx, y: gy }; P.looked = 0; plan(eng, e, gx, gy, { why: 'search (heard)' }); e.dbg.why = `it heard ${Hh && Hh.hAt >= r.heardAt ? 'something where P' + r.id + ' could be' : 'P' + r.id}: it goes there, quietly`; }
      }
      // (R20) ...or a fresh one from another way, about as loud as the one it went for (or louder): the newer evidence leads (within its three moves)
      if (thinkNow && !r && e.hear && e.hear.id > P.sid && (P.moved || 0) < 3 && e.hear.src !== -1 && now - e.hear.t < .5 && e.hear.I >= Math.max(.2, .8 * (P.I || 0)) && Math.hypot(e.hear.x - P.goal.x, e.hear.y - P.goal.y) >= 500) {
        P.sid = e.hear.id; P.moved = (P.moved || 0) + 1; P.at = { x: e.hear.x, y: e.hear.y }; P.goal = skVantage(eng, e, P.at.x, P.at.y, e.hear.u || 0) || P.at; P.looked = 0; plan(eng, e, P.goal.x, P.goal.y, { why: 'search (heard elsewhere)' }); e.dbg.why = 'it heard something another way, nearer: it goes there instead, quietly';
      }
      // (R2) looking at a sound nobody has been named for: a fresher one near where it is going moves the goal (at most twice)
      if (thinkNow && !r && e.hear && e.hear.id > P.sid && (P.moved || 0) < 2 && e.hear.src !== -1 && Math.hypot(e.hear.x - P.goal.x, e.hear.y - P.goal.y) < 500) {
        P.sid = e.hear.id; P.moved = (P.moved || 0) + 1; P.at = { x: e.hear.x, y: e.hear.y }; P.goal = skVantage(eng, e, P.at.x, P.at.y, e.hear.u || 0) || P.at; P.looked = 0; plan(eng, e, P.goal.x, P.goal.y, { why: 'search (heard)' }); e.dbg.why = 'it heard it again: it goes there, quietly';   // (R16e: to where it can see the place)
      }
      if (!P.looked) {
        if (thinkNow && !e.path.length && e.pathAge > 1.5) { P.stuck = (P.stuck || 0) + 1; plan(eng, e, P.goal.x, P.goal.y, { why: 'search' }); }
        setAct(e, 'search');
        // (R18) to the place: at its investigation's pace (232; a prowl when barely hungry), slowing to a stalk for the last stretch to arrive
        // quietly - R8-R16i went to a person's last place at a stalk (90) all the way
        const far = Math.hypot(P.goal.x - e.x, P.goal.y - e.y) > 220;
        const urgent = !P.pid || (r && now - Math.max(r.heardAt, r.seenAt) < SK20.urgent);   // (R20) a hunt's search hurries only on fresh footsteps: else its prowl, the pursuit walk
        follow(eng, e, dt, !far ? skSpeed(e, 'stalk') : Math.min(lerp(skSpeed(e, P.pid ? 'prowl' : 'roam'), skSpeed(e, 'investigate'), sm(.25, .6, e.hunger)), skCap(e), urgent ? 1e9 : skSpeed(e, 'prowl')), { arrive: 40 });   // (R16e: to look at a sound nobody was named for, the hungrier the quicker - under the pace that costs it stamina; a hunt's search as before)
        if (Math.hypot(P.goal.x - e.x, P.goal.y - e.y) < 70 || (P.stuck || 0) > 2 || now > P.until) {
          const from = P.at && !P.closer && Math.hypot(P.at.x - e.x, P.at.y - e.y) > 120;           // (R16e) at a point to look from: a short look at the place
          P.looked = now; P.lookFor = from ? rand(e, SKL.lookFrom[0], SKL.lookFrom[1]) : rand(e, SK.searchLook[0], SK.searchLook[1]); P.look0 = P.at && Math.hypot(P.at.x - e.x, P.at.y - e.y) > 70 ? Math.atan2(P.at.y - e.y, P.at.x - e.x) : e.ang; P.lookC = e.ang;   // (R16g: at the place itself, the way it faces)
          e.dbg.why = from ? 'it looks at the place from where it can see it' : 'it stands and listens';
        }
        return;
      }
      P.lookC = ((P.lookC ?? P.look0) + clamp(angDiff(P.look0, P.lookC ?? P.look0), -skTurnRate(e) * dt, skTurnRate(e) * dt) + TAU) % TAU;   // (R16e: it turns to the place it came to see, at its body's rate - R16g: the species' own)
      skHold(eng, e, dt); e.ang = ((P.lookC + Math.sin((now - P.looked) * 1.3) * .9) % TAU + TAU) % TAU;   // it looks one way, then the other
      if (e.act !== 'listen') setAct(e, 'listen');
      if (thinkNow && now - P.looked > P.lookFor && P.at && !P.closer && Math.hypot(P.at.x - e.x, P.at.y - e.y) > 120) {   // (R16e) nothing to be seen from there: it goes closer, to the place itself
        P.closer = 1; P.goal = { x: P.at.x, y: P.at.y }; P.looked = 0; P.until = Math.max(P.until, now + 6); plan(eng, e, P.goal.x, P.goal.y, { why: 'search (closer)' }); e.dbg.why = 'nothing to be seen from there: it goes closer'; return;
      }
      if (thinkNow && now - P.looked > P.lookFor) {
        if (Hh) { skFailed(Hh, P.goal.x, P.goal.y, now, 'search'); Hh.conf = Math.max(0, Hh.conf - SK.wrongCost * .5); if (P.turnA !== null && P.turnA !== undefined) skBadTurn(Hh, P.turnA); }   // (R2) negative evidence: nobody here
        if (Hh && Hh.conf >= SK.huntLow && Hh.tries < skTries(e) && !e.exh) { e.plan = null; e.dbg.why = `P${r.id} is not here: it thinks again`; }   // (R1) the hunt goes on
        else if (r) skLeave(eng, e, r, `the trail of P${r.id} is cold: it gives up`); else { e.plan = null; e.dbg.why = 'nothing there: it roams again'; }
      }
      return;
    }
    case 'post': {                                                                     // (R20) where the sounds would come out: there, then waiting
      const g = P.g;
      if (!P.arrived) {
        if (thinkNow) { P.need = skNeed(eng, e, P); if (!e.path.length && e.pathAge > 1.5) { P.stuck = (P.stuck || 0) + 1; plan(eng, e, g.x, g.y, { why: 'post' }); } }
        const last = Math.hypot(g.x - e.x, g.y - e.y) < 160 && e.path.length <= 1, v = last ? skSpeed(e, 'stalk') : skPace(e, P);
        setAct(e, v > SK.runFrom ? 'intercept' : 'approach');                         // (a burst runs as its hidden run; a prowl goes quietly)
        follow(eng, e, dt, v, { arrive: 30 });
        if (Math.hypot(g.x - e.x, g.y - e.y) < 44 || (P.stuck || 0) > 2 || now > P.until) {
          P.arrived = now; P.until = now + Math.min(SK20.postMax, SK20.postWait[0] + SK20.postWait[1] * e.hunger * e.tr.PATIENCE); e.path = [];
          e.tally.postAt = (e.tally.postAt || 0) + 1; e.dbg.why = 'at its post: it waits where they would come out';
        }
        return;
      }
      skHold(eng, e, dt); faceToward(e, P.face.x, P.face.y, dt, 1.6);
      skHeadTo(e, Math.sin((now - P.arrived) * 1.3 + e.id) * .5, dt);               // (it listens, its head turning, toward the way they would come)
      if (e.act !== 'wait') setAct(e, 'wait');
      if (thinkNow) {
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.arrived + SK20.postMax); if (e.hear && now - e.hear.t < .6) P.face = { x: e.hear.x, y: e.hear.y }; e.dbg.why = 'it hears them coming: it waits, ready'; }
        // the sounds it waits for: nearest so far, and - once they pass it by, unseen (the dark, another way) - it follows them quietly
        const H = e.hear;
        if (H && H.src !== -1 && now - H.t < .6) {
          const dh = Math.hypot(H.x - e.x, H.y - e.y);
          if (dh < 320 && P.came === undefined) { P.came = now; e.tally.postCame = (e.tally.postCame || 0) + 1; }
          if ((P.hmin ?? 1e9) < 600 && dh > P.hmin + 120) { e.tally.postPassed = (e.tally.postPassed || 0) + 1; skSearch(eng, e, null, 'they passed by its post, unseen: it follows the sound, quietly', { x: H.x, y: H.y }); return; }
          P.hmin = Math.min(P.hmin ?? 1e9, dh);
        }
        if (now > P.until) {
          e.tally.postLeft = (e.tally.postLeft || 0) + 1;
          if (H && H.src !== -1 && now - H.t < 1.5) { skSearch(eng, e, null, 'nobody came by its post, but it still hears them: it goes quietly to look', { x: H.x, y: H.y }); return; }
          e.plan = null; e.dbg.why = 'nobody came by its post: it roams again';
        }
      }
      return;
    }
    case 'feed': {
      skHold(eng, e, dt); if (P.at) faceToward(e, P.at.x, P.at.y, dt, 1.5);
      e.hunger = clamp(e.hunger - SK.feedRate * dt, 0, 1); P.fed = (P.fed || 0) + dt;
      if (e.act !== 'feed') setAct(e, 'feed');
      return;
    }
    case 'mingle': {                                                                   // (T6) in a borrowed skin: up to them openly, a stare, maybe a word
      if (!r || tgtGone(eng, e, r) || !e.disguise) { e.plan = null; return; }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      if (P.ph === 'walk' && d <= SK.mingleStop) { P.ph = 'stare'; P.stareT = now; P.stareFor = rand(e, SK.stare[0], SK.stare[1]) * (.7 + .6 * e.tr.PATIENCE); e.dbg.why = `it stands and stares at P${r.id}`; }
      if (P.ph === 'stare') {
        skHold(eng, e, dt); faceToward(e, p.x, p.y, dt, 2.4);
        if (e.act !== 'watch' && !(e.act === 'mimic' && now < e.mimicT)) setAct(e, 'watch');
        if (thinkNow && !P.spoke && now - P.stareT > .8) { P.spoke = now; skSay(eng, e, r, 'staring'); }
        if (thinkNow && d > SK.mingleStop + 160) { P.ph = 'walk'; e.dbg.why = `P${r.id} moved off: it walks after them`; }
        else if (thinkNow && now - P.stareT > P.stareFor) {
          if (e.hunger >= SK.huntHunger && !e.exh) { P.ph = 'close'; e.dbg.why = `it walks right up to P${r.id}`; }
          else { skLeave(eng, e, r, `it looked P${r.id} over and walks on`); return; }
        }
        return;
      }
      if (thinkNow && (now - (P.planT || -9) > (P.ph === 'close' ? .8 : 1.5) || !e.path.length)) {
        P.planT = now;
        if (directOk(eng, e, p.x, p.y, 420)) directTo(eng, e, p.x, p.y); else plan(eng, e, p.x, p.y, { why: 'mingle', maxNodes: 3000 });
      }
      if (e.act !== 'pace') setAct(e, 'pace');
      follow(eng, e, dt, skSpeed(e, 'disguise'), { arrive: P.ph === 'close' ? 40 : SK.mingleStop - 10 });
      return;
    }
    case 'flank': {                                                                    // (R1) a quick move to cover at their side
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      if (P.arrived) { skHold(eng, e, dt); const q = perc(eng, e, r); faceToward(e, q.x, q.y, dt, 2.4); if (e.act !== 'creep') setAct(e, 'creep'); return; }
      const st = skCovertStep(eng, e, P, dt, thinkNow, r); if (e.plan !== P) return;   // (R13: seen on the way - it answered that)
      if (st === 'arrived' || st === 'failed' || now > P.until) { P.arrived = now; P.mode = ''; e.path = []; e.dbg.why = st === 'arrived' ? `at P${r.id}'s side, out of their sight` : `its way round P${r.id} ends here`; }
      return;
    }
    case 'listen': {                                                                   // (R1) it stands still and listens, its head turning
      skHold(eng, e, dt);
      const C = P.curious;                                                             // (R2) roaming: turned toward the sound it heard
      const hd = e.look.k && e.look.go <= now ? Math.min(P.t0, e.look.go) : P.t0;      // (R18: SKL.bodyAfter after its head began, as skHeadStep's body - not after the plan began, a think later)
      if (C && now - hd >= SKL.bodyAfter) faceToward(e, C.x, C.y, dt, skTurnRate(e));   // (R16e: at its body's turn - R2's 2.2 - after its head has begun: skHeadStep; R16g: the species' own turning, 3.6 rad/s standing)
      skHeadTo(e, Math.sin((now - P.t0) * 1.7 + e.id) * (C ? .35 : .8), dt);
      if (e.act !== 'listen') setAct(e, 'listen');
      if (thinkNow && now > P.until) {
        e.plan = null; e.dbg.why = 'it has listened';                                  // (R16e: its head comes back by its gaze, not in one jump)
        if (C) { skCurious(eng, e, C); return; }
        const Hh = e.hunt; if (Hh && !(r && r.seen)) skHuntNext(eng, e);
      }
      return;
    }
    case 'leave': {
      if (!P.goal) { e.plan = null; return; }
      if (e.act !== 'leave') setAct(e, 'leave');                                     // (B1: after a look)
      if (thinkNow && !e.path.length && e.pathAge > 2) plan(eng, e, P.goal.x, P.goal.y, { why: 'leave' });
      follow(eng, e, dt, skSpeed(e, P.fast ? 'fatigued' : 'roam'), { arrive: 60 });   // (B3: a withdrawal at its tired run, under the speed that costs stamina)
      return;
    }
  }
  e.plan = null;
}
/* where it wanders to: open floor some way off, the darker of a few candidates (the level's own lamp field: static knowledge, no person in it) */
function skDarkFloor(eng, e) {
  let best = null, bl = 2;
  for (let k = 0; k < 6; k++) {
    const g = randomFloor(eng, e, SK.roamLeg[0], SK.roamLeg[1]); if (!g) continue;
    const l = eng.geo.lamp[eng.geo.cellAt(g.x, g.y)] || 0; if (l < bl) { bl = l; best = g; }
  }
  return best;
}
function skRoam(eng, e, dt, thinkNow) {
  const R = e.roam, hm = sm(.3, .6, e.hunger), hs = sm(.55, .95, e.hunger);
  if (e.state !== S.ROAMING) setState(e, S.ROAMING, '');
  if (R.pause > 0) { R.pause -= dt; stopMoving(eng, e, dt); if (e.act !== 'listen' && e.act !== 'watch') setAct(e, 'listen'); return; }   // (R16e: or it stopped to look - skHeadStep)
  if (e.act) setAct(e, '');
  if (!R.goal && thinkNow) {
    // (R16d) hungry, it goes where its prey has been - the freshest place it saw or heard somebody it may hunt, not yet looked at; else the dark
    const ev = e.hunger >= SK.huntHunger ? skPatrolGoal(eng, e) : null, g = ev || skDarkFloor(eng, e);
    if (g) { R.goal = g; plan(eng, e, g.x, g.y, { why: 'roam' }); R.until = eng.now + rand(e, SK.roamGiveUp[0], SK.roamGiveUp[1]); e.dbg.why = ev ? `prowling where it ${ev.k} somebody ${Math.round(eng.now - ev.t)} s ago` : 'roaming the dark'; }
  }
  if (!R.goal) { stopMoving(eng, e, dt); return; }
  if (thinkNow && !e.path.length && e.pathAge > 2) goTo(eng, e, R.goal.x, R.goal.y);
  // (R16d: starving, it prowls; R16g: exhausted, it walks.  R18: its casual walk 160; to a place its prey has been, its purposeful prowl - 205,
  // free of stamina - the hungrier the sooner)
  follow(eng, e, dt, Math.min(R.goal.ev ? lerp(skSpeed(e, 'roam'), skSpeed(e, 'prowl'), sm(.25, .6, e.hunger)) : skSpeed(e, 'roam') * (1 + .1 * hm), skCap(e)), { arrive: 40 });
  if (Math.hypot(R.goal.x - e.x, R.goal.y - e.y) < 60) { if (R.goal.ev) (R.seen || (R.seen = [])).push({ x: R.goal.x, y: R.goal.y, t: eng.now }); R.goal = null; R.pause = rand(e, SK.roamPause[0], SK.roamPause[1]) * (1 - .8 * hm); }   // (R16d: the hungrier, the shorter its pause)
  else if (eng.now > R.until) { if (R.goal.ev) (R.seen || (R.seen = [])).push({ x: R.goal.x, y: R.goal.y, t: eng.now }); R.goal = null; }   // (R16g, the review: a prowl it could not finish is not chosen again)
}
/* (R16d) where a hungry one prowls: the freshest place it saw or heard somebody it may hunt (its own memory: the last place it knew them,
 * the sounds it holds), within the last SK.patrolFresh seconds, that it has not walked to since; a floor point near it.  Never anybody's
 * real place: only what it perceived */
function skPatrolGoal(eng, e) {
  const now = eng.now, R = e.roam, done = (R.seen || (R.seen = [])).filter(q => now - q.t < SK.patrolFresh); R.seen = done;
  const near = (x, y) => done.some(q => Math.hypot(q.x - x, q.y - y) < 260);
  let best = null;
  for (const r of e.mem.p.values()) {
    if (tgtGone(eng, e, r) || e.left.has(r.id) || e.seenNow.has(r.id)) continue;   // (one it left it leaves; one it sees now its decision answers)
    const t = Math.max(r.seenAt, r.heardAt), heard = r.heardAt > r.seenAt && r.hx !== undefined, x = heard ? r.hx : r.lkx, y = heard ? r.hy : r.lky;
    if (!(now - t < SK.patrolFresh) || !Number.isFinite(x) || near(x, y)) continue;
    if (!best || t > best.t) best = { x, y, t, k: heard ? 'heard' : 'saw' };
  }
  // (R16g, the review: footsteps it took for somebody it left, or sees now, are passed over as that person is)
  for (const q of e.mem.sounds) { if (q.src === -1 || now - q.t >= SK.patrolFresh || near(q.x, q.y) || (q.pid && (e.left.has(q.pid) || e.seenNow.has(q.pid)))) continue; if (!best || q.t > best.t) best = { x: q.x, y: q.y, t: q.t, k: 'heard' }; }
  if (!best || Math.hypot(best.x - e.x, best.y - e.y) < 120) return null;
  const f = skFloorNear(eng, e, best.x, best.y); return f ? { x: f.x, y: f.y, ev: 1, t: best.t, k: best.k } : null;
}
function skinTick(eng, e, dt, thinkNow) {
  skBody(eng, e, dt); e.still = false;
  if (e.commit) { e.still = true; if (commitTick(eng, e, dt)) return null; }      // on its kill until the death has played everywhere
  if (e.cap) { skHold(eng, e, dt); return null; }
  // (R19) a vault, once begun, is carried through like a strike (at most SKIN's vault time, .56 s): a body in a vault is over the prop (the
  // shared moveStep lets it pass the prop meanwhile), and only the shared follower steps a vault - so nothing else may move it until it
  // lands.  R8-R18 let a plan change in mid-vault (an approach becoming a chase, its footwork) move the body on with the vault left open:
  // through walls, until the follower next ran and set it down at the vault's far end (R19's ordinary-play simulation: once in 36 hours,
  // an 830 px jump in a chase).  No think, no strike meanwhile (as in a strike)
  if (e.trav) { follow(eng, e, dt, 0); skHeadStep(eng, e, dt); return null; }
  if (e.pounce || e.recover > 0) return skStrikeStep(eng, e, dt);                 // a strike, once begun, is carried through
  if (thinkNow && skStrike(eng, e)) return skStrikeStep(eng, e, dt);              // (before deciding: at striking distance it does not stop to think)
  if (thinkNow) {                                                                  // (B1: what it notices, then the decision, then any reaction)
    skMindTick(eng, e);                                                            // (R11) who could see it now, what changed since its last think
    skAware(eng, e);
    skHuntTick(eng, e, Math.min(.5, eng.now - (e.huntAt ?? eng.now))); e.huntAt = eng.now;   // (R1) what it knows of its quarry
    skPreempt(eng, e, r => e.hunger >= SK.huntHunger && skMayHunt(eng, e, r));         // (R16d) did anything happen that cuts or questions its plan (ai.skin.preempt.js) - (R16e) prey only from the hunger it hunts at
    skLookThink(eng, e);                                                           // (R16e) movement at the edge of its view; somebody new in its sight (ai.skin.look.js)
    const df = skDefend(eng, e);                                                   // (B3) a warned, still provoked creature may defend itself, or withdraw
    if (df === 'strike') return skStrikeStep(eng, e, dt);
    if (!df) skDecide(eng, e);
    skAttend(eng, e);
  }
  // (R16g, the review) its footwork's velocity, from the tick before, goes on into the shared steering only as far as it lies along its facing
  // (the shared steering moves it along its facing): a sideways step is never turned forward in one tick
  if (e.mv && eng.now - e.mv.at <= dt * 1.5 + 1e-6) e.speed = Math.max(0, e.mv.x * Math.cos(e.ang) + e.mv.y * Math.sin(e.ang));
  skAct(eng, e, dt, thinkNow);
  skHeadStep(eng, e, dt);                                                          // (R16e) a sound just heard; the head's snap; the body where it is free to turn
  return null;
}
/* the admin overlay's block (never a line of speech: only counts) */
function skDebug(eng, e) {
  const P = e.plan, g = e.dbg.predict;
  return { hu: +e.hunger.toFixed(3), band: skBand(e.hunger), st: Math.round(e.stam), ex: e.exh ? 1 : 0, pl: P ? P.k : 'roam', pid: P ? P.pid : 0, why: e.dbg.why || '',
    enc: e.enc ? { pid: e.enc.pid, spent: +e.enc.spent.toFixed(1), budget: Math.round(skBudget(e)) } : null, left: [...e.left].map(([id, u]) => [id, +(u - eng.now).toFixed(1)]),
    dec: e.dbg.decide || null, pr: g ? { x: Math.round(g.x), y: Math.round(g.y), q: [Math.round(g.qx), Math.round(g.qy)], turns: g.turns.length, lead: g.lead, hid: g.hidden ? 1 : 0, at: g.at } : null,
    tally: e.tally, pc: e.pounce ? e.pounce.style + (e.pounce.t < e.pounce.wind ? ' wind' : ' leap') : e.recover > 0 ? 'recover ' + e.recover.toFixed(1) : '', cool: +Math.max(0, e.pounceCool - eng.now).toFixed(1),
    cm: e.commit ? e.commit.v : '', rg: e.roam.goal ? [Math.round(e.roam.goal.x), Math.round(e.roam.goal.y)] : null,
    // (T6) its skin and its ears: whose skin and how long it has left; how many lines it holds and how old (never a word of them); its last line's kind
    dg: e.disguise ? { from: e.disguise.from, left: Math.round(e.disguise.until - eng.now) } : 0, sk: e.skin ? e.skin.pid : 0, sn: e.dbg.skin || '',
    hd: e.heard.map(q => Math.round(eng.now - q.at)), sd: e.dbg.said ? { ago: +(eng.now - e.dbg.said.at).toFixed(1), src: e.dbg.said.src, why: e.dbg.said.why } : null,
    // (B1) the person it is most aware of (only ever somebody it has seen): pressure, whether it has noticed them, why, how long since it saw them; its reaction
    aw: skAwTop(eng, e), awN: e.aw.size, rx: e.rx ? { k: e.rx.k, pid: e.rx.pid, left: +(e.rx.until - eng.now).toFixed(1), why: e.dbg.rx || '' } : null, lv: e.dbg.lv && eng.now - (e.dbg.lvAt || 0) < 5 ? e.dbg.lv : '',
    df: e.dbg.def ? { pid: e.dbg.def.pid, k: e.dbg.def.k, odds: e.dbg.def.odds, cornered: e.dbg.def.cornered ? 1 : 0, ago: +(eng.now - e.dbg.def.at).toFixed(1) } : null,
    // (R1) its hunt: the quarry, how sure it is and how it knows, how long since that evidence, its effort and budget, flanks, searches
    ht: skHuntDbg(eng, e), mi: skMindDbg(eng, e),
    // (R16d-f) its last interruption (what it perceived, the plan it cut or kept, why), its eyes' stimulus, its footwork
    pe: e.dbg.preempt && eng.now - e.dbg.preempt.at < 10 ? { ago: +(eng.now - e.dbg.preempt.at).toFixed(1), from: e.dbg.preempt.from, cls: e.dbg.preempt.cls, kept: e.dbg.preempt.kept ? 1 : 0, why: e.dbg.preempt.why } : null,
    lk: e.look && e.look.k && eng.now < e.look.until ? { k: e.look.k, why: e.dbg.look ? e.dbg.look.why : '', body: e.dbg.look && e.dbg.look.body ? 1 : 0 } : null,
    ft: e.fight && !e.fight.blocked && eng.now - e.fight.at < .3 ? { pid: e.fight.pid, side: +(e.fight.side || 0).toFixed(1), back: +(e.fight.backT || 0).toFixed(1) } : null,
    ps: e.dbg.pos && eng.now - e.dbg.pos.at < 10 ? { k: e.dbg.pos.k, ago: +(eng.now - e.dbg.pos.at).toFixed(1), why: e.dbg.pos.why } : null,   // (R19) its last positioning choice
    sw: [...e.seenNow],                                                                   // (R16g: whom it sees now - the admin's overlay and the real-page campaign; `sn` is T6's skin note above)
    cv: P && P.mode ? { mode: P.mode, phase: P.phase || '', way: P.way ? P.way.len : 0, exit: P.way ? P.way.exit : 0, why: e.dbg.cover && eng.now - e.dbg.cover.at < 10 ? e.dbg.cover.why : '' } : null };   // (R13) its move's mode (covert, open, feint), a covert move's phase and way                // (R11) whether the people it sees could see it; its last events and how fast it answered
}
function skHuntDbg(eng, e) {
  const H = e.hunt; if (!H) return e.dbg.huntEnd ? { end: e.dbg.huntEnd.why, ago: +(eng.now - e.dbg.huntEnd.at).toFixed(1) } : null;
  const B = skBelief(eng, e, H);
  return { pid: H.pid, conf: +H.conf.toFixed(2), ev: H.ev, ago: +(eng.now - H.evAt).toFixed(1), u: Math.round(B.u), eff: e.enc && e.enc.pid === H.pid ? +e.enc.spent.toFixed(1) : 0, max: Math.round(skBudget(e)),
    flanks: H.flanks, tries: H.tries, failed: H.failed.length, heard: H.heard, rev: H.revised, why: H.why,
    g: H.guess || '', alt: H.altTried ? 1 : 0, hAgo: H.hAt > 0 ? +(eng.now - H.hAt).toFixed(1) : -1,   // (R2) its current guess; the other way tried; its last sound of them
    log: (H.log || []).slice(-4), hy: skHypDbg(H), rj: H.rej || [] };                   // (R12) the ways it holds; its guess's rejected rivals                                                   // (R11) its last evidence: seen / heard / inferred / disproved
}
function skAwTop(eng, e) {
  let A = null; for (const q of e.aw.values()) if (!A || q.p > A.p) A = q;
  return A ? { pid: A.pid, p: +A.p.toFixed(2), tier: A.p >= SK.pDefend && A.warns ? 'threatened' : A.p >= SK.pWarn ? 'provoked' : A.tier ? 'noticed' : '-', why: A.why, ago: +(eng.now - A.last).toFixed(1), d: A.d, looks: A.looks,
    warns: A.warns || 0, orbits: A.orbits || 0 } : null;
}
SKIN.tick = skinTick;
SKIN.debug = skDebug;
SKIN.predict = skPredict;                                       // (its guess from a record: the tests and the admin overlay ask it directly)
SKIN.hearSpeech = skHearSpeech;
/* (R20) its own ear (the shared hearEvent asks a species that has one): a person's own sounds (a positive source) by kind, SK20.hear; through a wall SK20.hearWall - another creature's sounds and speech as before */
SKIN.hearScale = ev => ev.src > 0 ? (SK20.hear[ev.type] || 1) : 1;
SKIN.hearWall = SK20.hearWall;
SKIN.fatigueSee = skFatigueSee; SKIN.fatigue = skFatigue;                     // (R20) its fatigue belief, for the checks (s_skinr20.js SH10/SH11)                                 // (T6) the engine's hearSpeech: a line said near it
SKIN.skinFrom = skSkinFrom;                                     // (T6) the engine's skinFrom: the look of the person it has killed
/* the snapshot's entry; dg (T6) only while it wears a skin: the look it wears, as the wire carries a wanderer's (hat|texture|hands|main) */
SKIN.snap = e => Object.assign({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: KACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2) }, e.disguise ? { dg: e.disguise.look } : null);

/* ---------------------------------------------------------------- the engine: sound bus, level of detail, capture loop, snapshots */
const SPECIES = { hound: HOUND, smiler: SMILER, skinstealer: SKIN };   // (Trial 3: the Skin-Stealer, admin-only; its own hooks below, never the others' functions)
const STRIDE = { 1: 64, 2: 82, 3: 56, 4: 42 };                      // px of travel per footfall: walk, run, crouch, crawl
const TIER = { near: 1900, mid: 3800 };                             // px to the nearest living player: full AI / reduced AI / asleep
const EV_NOISE = {                                                   // discrete movement events the client reports (see move.js)
  21: { r: 'vaultSlow', I: .3, type: 'vault' }, 22: { r: 'vaultNormal', I: .55, type: 'vault' }, 23: { r: 'vaultFast', I: .85, type: 'vault' },
  24: { r: 'land', k: .45, I: .25, type: 'land' }, 25: { r: 'land', k: .7, I: .5, type: 'land' }, 26: { r: 'land', k: 1, I: .75, type: 'land' },
  30: { r: 'slide', I: .8, type: 'slide' },
};

function create(cfg) {
  const seed = (cfg.seed ?? 1) >>> 0, rng = mkRng(deriveSeed(seed, 'world'));
  const eng = {
    rng, seed, geo: new Geo(cfg.adapter), now: 0, ticks: 0, entities: [], nextId: 1, caps: [], capId: 0, sites: [], recentKills: {}, pressure: 0,
    events: [], sounds: [], pl: [], byId: new Map(), hash: new Hash(), lights: [], pst: new Map(), packT: 0,
    stats: { sense: 0, paths: 0, sounds: 0, capture: 0 },
    debugOn: false, forceCapture: null, log: [], logSeq: 0,
  };
  const geo = eng.geo;
  /* a short human-readable trail of what the entities decided (state changes, catches, kills, releases, lamp failures): the admin DEBUG tab reads it */
  eng.note = function (text) { this.log.push({ s: ++this.logSeq, t: +this.now.toFixed(1), x: text }); if (this.log.length > 60) this.log.shift(); };
  const tagOf = (kind, id) => (kind === 'skinstealer' || kind === 'SkinStealer' ? 'K' : String(kind || '?')[0].toUpperCase()) + '#' + id;   // (Trial 3: K, so it is never read as a Smiler's S)
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
    const incoming = new Set(list.map(p => p.id)); for (const id of this.byId.keys()) if (!incoming.has(id)) this.forgetPlayer(id);
    this.pl = list.slice().sort((a, b) => a.id - b.id); this.byId.clear(); this.hash.clear(); this.lights.length = 0;
    for (const p of this.pl) {
      this.byId.set(p.id, p);
      if (p.alive) { this.hash.add(p, p.x, p.y); if (p.light) this.lights.push(p); }
    }
  };
  eng.forgetPlayer = function (id) { this.pst.delete(id);this.beamHist?.delete(id);this.beams=null;this.beamsT=0; for (const e of this.entities) forgetIdentity(e, id); };
  eng.endHabits = function (id) { for (const e of this.entities) { e.mem.habits.delete(id); e.mem.hypotheses = e.mem.hypotheses.filter(h => h.pid !== id); if(e.dbg.habit?.pid===id)e.dbg.habit=null; const r = e.mem.p.get(id); if (r) r.habitLast = null; } };
  eng.playerById = function (id) { return this.byId.get(id) || null; };
  eng.nearPlayers = function (x, y, r) { const out = []; this.hash.near(x, y, r, p => { if (Math.hypot(p.x - x, p.y - y) <= r) out.push(p); }); return out.sort((a, b) => a.id - b.id); };
  eng.candidates = function (e, r) { return this.nearPlayers(e.x, e.y, r); };
  eng.nearestPlayerDist = function (x, y) { let b = 1e9; for (const p of this.pl) if (p.alive) { const d = Math.hypot(p.x - x, p.y - y); if (d < b) b = d; } return b; };
  eng.lightPlayers = function () { return this.lights; };
  /* SYSTEM FAIRNESS VALIDATOR (Part 2 / 2D) - outside every entity's knowledge.  May a creature settle at (x,y)?  No if that is right behind a
   * living player close by, or on top of one.  It answers yes / no only; it never says who or where (the entity just tries another spot). */
  eng.placementOk = function (x, y) {
    for (const p of this.pl) { if (!p.alive) continue; const d = Math.hypot(x - p.x, y - p.y); if (d < 220) return false; if (d < 650 && Math.abs(angDiff(Math.atan2(y - p.y, x - p.x), p.angle)) > 2.3) return false; }
    return true;
  };
  eng.lightFail = function (x, y, r, dur) {
    geo.fails.push({ x, y, r, until: this.now + dur });
    this.emit({ t: 'lightfail', x, y, r, dur });
  };
  eng.blackout = () => geo.a.blackout();
  eng.commitEnd = function (pid, x, y, a) { return commitEnd(this, pid, x, y, a); };
  /* (Trial 3 T6) speech and skins, for a species that has ears for them (the Skin-Stealer; never a Hound or a Smiler): server.js wires
   * them.  hearSpeech(L): a line B++'s speech.js accepted and delivered, {id, x, y, text} (the speaker's id and server position).
   * skinFrom(eid, pid, look): G.I.B.'s aftermath, when a death this entity caused ends: the victim's validated look.  voiceOut: what
   * server.js gives to send an entity's line (B++'s speech.entitySay); null in a world with no server (a line is then only counted). */
  eng.voiceOut = null;
  eng.hearSpeech = function (L) { let n = 0; for (const e of this.entities) if (e.sp.hearSpeech && e.sp.hearSpeech(this, e, L)) n++; return n; };
  eng.skinFrom = function (eid, pid, look) { const e = this.entities.find(q => q.id === eid); return !!(e && e.sp.skinFrom && e.sp.skinFrom(this, e, pid, look)); };

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
    const id = opts && opts.id !== undefined ? opts.id : this.nextId; if (!Number.isSafeInteger(id) || id < 1 || this.entities.some(e => e.id === id)) throw Error('invalid/duplicate entity id'); this.nextId = Math.max(this.nextId, id + 1);
    const e = mkEntity(this, kind, id, x, y, opts || {});
    e.tierT = 0; e.senseDt = 0; e.wd = { x, y, t: 0 }; this.entities.push(e);
    return e;
  };
  eng.remove = function (id) {
    const i = this.entities.findIndex(e => e.id === id); if (i < 0) return false;
    const e = this.entities[i]; if (e.cap) finishCapture(this, e.cap, this.playerById(e.cap.pid), e);
    this.entities.splice(i, 1); return true;
  };
  eng.count = function (kind) { let n = 0; for (const e of this.entities) if (e.kind === kind) n++; return n; };
  eng.clear = function () { for (const e of this.entities.slice()) this.remove(e.id); this.caps.length = 0; this.sites.length = 0; this.recentKills = {}; this.sounds.length = 0; geo.fails.length = 0; this.pst.clear();this.beams=null;this.beamsT=0;this.beamHist?.clear(); };

  /* ------------------------------------------------------------ one entity, one step */
  function sense(e, dt) {
    eng.stats.sense++;
    for (const id of e.mem.p.keys()) if (!eng.byId.has(id)) e.mem.p.delete(id);
    const cands = e.tier === 'near' ? eng.candidates(e, 1750) : [];
    updateVision(e, eng, dt, cands);
    if (e.tier === 'near') lightSense(eng, e);                          // (Part 2 / 2C) visible light as evidence, 4 Hz, near tier only
    decayMemory(e, dt, eng.now);
    cleanupKnowledge(eng, e);
    e.mem.p = new Map([...e.mem.p].sort((a,b) => a[0]-b[0]));
    arbitrateEvidence(eng, e);
    moodTick(e, dt);
  }
  function onTier(e, nt) {
    const was = e.tier; e.tier = nt;
    if (nt === 'far') {e.farSince = eng.now;e.seenNow.clear();for(const r of e.mem.p.values())r.seen=false;}
    if (was === 'far' && e.farSince !== undefined) { e.farSince = undefined; }     // a sleeper's memory of the last hours fades all the same
    if (nt === 'far' && (e.state === S.HUNTING || e.state === S.SEARCHING || e.state === S.STALKING)) e.dbg.disengage = 'lost track: the prey is far out of range';
    if (nt === 'far' && !e.cap) { e.path = []; e.trav = null; e.lunge = null; e.speed = 0; if (e.kind === 'hound') { if (e.state !== S.DORMANT) { setState(e, S.DORMANT); if (e.roam) e.roam.goal = null; } e.farT = 0; } else if (e.sp.onFar) e.sp.onFar(eng, e); else if (e.state !== S.HIDDEN) beginHidden(eng, e); }
    if (was === 'far' && nt !== 'far') { e.wake = 1; e.thinkT = 0; if (e.state === S.DORMANT && e.kind === 'hound') setState(e, S.ROAMING); }
  }
  function farStep(e, dt) {
    e.speed = 0; if (e.cap) return;
    if (e.kind === 'hound') {
      e.farT = (e.farT || 0) - dt;
      if (!e.path.length && e.farT <= 0) { const g = randomFloor(eng, e, 900, 2800); if (g) plan(eng, e, g.x, g.y); e.farT = rand(e, 3, 12); }
      coarseMove(eng, e, dt);
    } else if (e.sp.farTick) e.sp.farTick(eng, e, dt);                       // (Trial 3: an animal whose hunger goes on while nobody is near)
  }
  /* an entity that has not gone anywhere for a long while is stuck: set it back on open floor and let it think again */
  function watchdog(e, dt) {
    const w = e.wd;
    const idle = e.act === 'listen' || e.act === 'rest' || e.act === 'feed' || e.state === S.HIDDEN || e.state === S.WATCHING || e.state === S.PLAYING || e.state === S.ALERT || e.state === S.CURIOUS || e.state === S.DORMANT || e.state === S.CAUTIOUS || e.state === S.EXCITED || e.state === S.FRUSTRATED || e.act === 'sniff' || e.act === 'freeze' || e.cap || !!(e.sp.still && e.sp.still(e));   // standing still on purpose is not being stuck (Trial 3: a species may say so itself)
    // a hound: only time spent trying to move counts toward 'stuck' (a pause to listen, then walking back past the same spot, is not being stuck).
    // (smilers keep the original rule: every 6 s, not moving 26 px while not idle - their behaviour tests are tuned against it)
    // (R20) a species that says itself when it stands still on purpose (sp.still: the Skin-Stealer) has the hound's rule too, its stillness
    // asked every tick rather than at the one tick of the check; a second of standing still on purpose begins its time afresh (a wait, a
    // stare, a meal: whatever it does next is a new attempt); and it is stuck only if in its 6 s of trying it never got 60 px from where it
    // began (a walk there and back past the same spot is not being stuck)
    const own = !!e.sp.still;
    if (own) { if (idle) { w.rest = (w.rest || 0) + dt; if (w.rest >= 1) { w.t = 0; w.x = e.x; w.y = e.y; w.far = 0; } } else w.rest = 0; }
    if (e.kind === 'hound' || own) { if (!idle) w.t += dt; } else w.t += dt;
    if (own) w.far = Math.max(w.far || 0, Math.hypot(e.x - w.x, e.y - w.y));
    w.u = (w.u || 0) + dt; if (w.u < 6) return; w.u = 0;                   // looked at every 6 s
    let stuck = false; if (w.t >= 6) { stuck = Math.hypot(e.x - w.x, e.y - w.y) < 26 && (own ? (w.far || 0) < 60 : e.kind === 'hound' || !idle); w.x = e.x; w.y = e.y; w.t = 0; w.far = 0; }
    const embedded = !e.trav && !geo.clear(e.x, e.y, 12, e.mode || 'walk');
    if (stuck || embedded) {
      e.unstuck = (e.unstuck || 0) + 1; const nv = navOf(e); nv.recover++; if (embedded) { nv.emergency++; eng.note(`${tagOf(e.kind, e.id)} EMERGENCY un-embed at ${Math.round(e.x)},${Math.round(e.y)}`); }
      const c = geo.snap(e.x, e.y, e.caps, 4);
      if (embedded && c >= 0) { e.x = geo.cx(c); e.y = geo.cy(c); }
      e.path = []; e.trav = null; e.aim = null; e.pathAge = 99; e.goalKey = ''; e.speed = 0;
      if (e.kind === 'hound' && e.state !== S.HUNTING) { if (e.state === S.SEARCHING || e.state === S.STALKING) e.dbg.disengage = 'stuck: the watchdog reset it'; setState(e, S.ROAMING); e.roam.goal = null; }
      if (e.kind === 'smiler' && e.state !== S.HIDDEN && e.state !== S.PLAYING) beginHidden(eng, e);
      if (e.sp.onStuck) e.sp.onStuck(eng, e);                                    // (Trial 3: a species with its own recovery)
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
    this.entities.sort((a, b) => a.id - b.id);
    playerNoise(dt);
    if (geo.fails.length) geo.fails = geo.fails.filter(f => f.until > now);
    for (const e of this.entities) {
      if (e.state !== e.lgS) { if (e.lgS !== undefined) this.note(`${tagOf(e.kind, e.id)} ${e.lgS} -> ${e.state}${e.act ? ' /' + e.act : ''}`); e.lgS = e.state; }
      e.t += dt; e.stateT += dt; e.actT += dt;
      e.tierT -= dt; if (e.tierT <= 0) { e.tierT = .4 + e.streams.schedule() * .15; const nt = tierOf(e, this); if (nt !== e.tier) onTier(e, nt); }
      if (e.deaf > 0) e.deaf -= dt;
      if (e.tier === 'far') { e.farMemoryDt = (e.farMemoryDt || 0) + dt; if (e.farMemoryDt >= 1) { decayMemory(e, e.farMemoryDt, now); cleanupKnowledge(this, e); e.farMemoryDt = 0; } farStep(e, dt); continue; }
      if (e.farMemoryDt) { decayMemory(e, e.farMemoryDt, now); e.farMemoryDt = 0; }
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
      case 'hunt': { e.navGo = null; const r = rec(e, pv.id); r.aw = 1; r.seen = true; r.seenAt = this.now; r.lkx = pv.x; r.lky = pv.y; r.conf = 1; if (e.kind === 'hound') { beginHunt(this, e, r, 'debug'); return 'HUNTING YOU (real AI)'; } if (e.sp.debugHunt) return e.sp.debugHunt(this, e, r); beginStalk(this, e, r); return 'STALKING YOU (real AI)'; }
      case 'clear': e.navGo = null; e.target = null; e.path = []; e.goal = null; e.goalKey = ''; if (e.kind === 'hound') setState(e, S.ROAMING); else if (e.sp.onClear) e.sp.onClear(this, e); return 'TARGET AND ROUTE CLEARED';
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
    else if (e.sp.summon) e.sp.summon(this, e, r, tx, ty);
    else { beginDrawn(this, e, { x: tx, y: ty, u: 160, k: 'summon' }, 'admin summon: a lead at the admin'); }
    return true;
  };

  /* ------------------------------------------------------------ what goes over the wire / to the debug overlay */
  eng.snapshot = function () {
    const h = [], m = [], ss = [];
    for (const e of this.entities) (e.kind === 'hound' ? h : e.kind === 'skinstealer' ? ss : m).push(e.sp.snap(e));
    return ss.length ? { h, m, ss } : { h, m };                                  // (Trial 3: ss only when there is one: a world without one sends P9's bytes)
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
        // (Part 2 / 2C) the evidence behind its decisions: attributed evidence on its best record, its anonymous leads, what it would investigate,
        // who has eye contact with it, the decision and its stated reason, its personality
        ev: best && best.ev && best.ev.length ? best.ev.map(q => [q.k, Math.round(q.x), Math.round(q.y), Math.round(q.u), +q.c.toFixed(2), +(this.now - q.t).toFixed(1)]) : undefined,
        ld: e.mem.leads.length ? e.mem.leads.map(L => [L.id, L.k, Math.round(L.x), Math.round(L.y), Math.round(L.u), +L.c.toFixed(2), +(this.now - L.t).toFixed(1), +L.sal.toFixed(2), L.n]) : undefined,
        inv: e.inv ? { l: e.inv.lead, k: e.inv.k, x: Math.round(e.inv.x), y: Math.round(e.inv.y), u: Math.round(e.inv.u), age: +(this.now - e.inv.t).toFixed(1) } : undefined,
        ec: (() => { const o = []; for (const id of e.seenNow) { const f = facedBy(this, e, this.playerById(id), e.mem.p.get(id)); if (f) o.push([id, +f.off.toFixed(2), Math.round(f.d)]); } return o.length ? o : undefined; })(),
        dec: { s: e.state, a: e.act || '', why: e.state === S.HUNTING ? e.huntWhy || '' : e.state === S.SEARCHING ? e.dbg.searchWhy || '' : e.dbg.disengage || '', rt: e.dbg.retarget || '', lt: e.dbg.light || '', fl: e.flashAt !== undefined ? +(this.now - e.flashAt).toFixed(1) : null, tq: e.target > 0 && e.mem.p.get(e.target) ? +e.mem.p.get(e.target).conf.toFixed(2) : null },
        tr: Object.fromEntries(Object.entries(e.tr).map(([k, v]) => [k.slice(0, 4), +v.toFixed(2)])),
        lit: e.lit !== undefined ? +e.lit.toFixed(2) : undefined,
        sm: e.kind === 'smiler' ? e.dbg.sm : undefined,
        hm: e.kind === 'hound' ? hDebug(this, e) : undefined,
        sk: e.kind === 'skinstealer' ? e.sp.debug(this, e) : undefined,
        intel: intelligenceDebug(this, e),
      });
    }
    return out;
  };
  return eng;
}
return { create, S, SNAMES, SCODE, HACT, SACT, KACT, TRAITS, SPECIES, HOUND, SMILER, SKIN, SK, mkRng, deriveSeed, Geo, hearEvent, TIER, INTEL, evidenceCandidates, observationScore, habitObserve, cleanHabits, habitBias, arbitrateEvidence };
});
