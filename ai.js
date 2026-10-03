/* ai.js - reusable entity AI for The Far Backrooms (v16).  UMD: require('./ai.js') on the server.
 * Everything an entity does is built from the same components:
 *   PERCEPTION (vision with walls / darkness / posture, hearing from a sound bus)  ->  MEMORY (last known position, staleness)
 *   PERSONALITY (traits with per-instance variation)  ->  STATE FRAMEWORK  ->  MOVEMENT + TRAVERSAL (vault / crawl / tight gaps)
 *   TARGET SELECTION, SEARCHING, SOCIAL AWARENESS (only from what the entity can perceive), CAPTURE + KILL SELECTION.
 * Species (Hound, Smiler) are just data plus a `think` function on top of these parts.  The engine is server
 * authoritative and never reads a player list directly for decisions: it only sees what perception hands it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./world.js'), require('./world_motion.js'));
  else root.AI = factory(root.WORLD, root.TFB_MOTION);
})(typeof self !== 'undefined' ? self : this, function (WORLD, MOTION) {
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
  if (a.geometry?.identity.geometryMode === 'spatial') return buildSpatialNav(a.geometry);
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
    this.a = a; this.spatial = a.geometry?.identity.geometryMode === 'spatial';
    const key = this.spatial ? 'spatial:' + a.geometry.identity.contentHash : a.key || 'level0';
    if (!STATIC.has(key)) STATIC.set(key, buildStatic(a));
    Object.assign(this, STATIC.get(key));
    this.W = a.W; this.H = a.H; this.rooms = a.rooms; this.lamps = a.lamps;
    this.gen = new Uint32Array(this.N); this.cg = new Uint32Array(this.N); this.gs = new Float32Array(this.N); this.from = new Int32Array(this.N); this.stamp = 0;
    this.heap = new Int32Array(this.spatial?this.edges.reduce((n,e)=>n+e.length,0)+this.N+8:this.N+8); this.hf = new Float32Array(this.N);
    this.fails = [];                              // local light failures {x,y,r,until}
    if (this.spatial) {
      this.geometry = a.geometry;
      this.edgeProofs = new Map();
      this.linkProofs = new Map();
      this.navStats = { plans: 0, nodes: 0, edgeChecks: 0, cacheHits: 0, cacheMisses: 0, maxNodes: 0 };
    }
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
  passableFor(i, caps, profile) {
    if (this.spatial) return spatialNodeFits(this, i, caps, profile);
    const c = this.cls[i]; return c === 1 || (c === 2 && caps.CAN_CRAWL) || (c === 3 && caps.CAN_USE_TIGHT_GAPS);
  }
  /* nearest usable cell to a point (the point itself may be inside a wall margin) */
  snap(x, y, caps, maxR = 5, context, profile) {
    if (this.spatial) return this.snapPose(context && { ...context, x, y }, caps, maxR, profile);
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
  lightLevel(x, y, players, pose) {                  // 0..1: how lit a point is (lamps, blackout, local failures, players' own lights)
    if(this.spatial)return this.lightAt(pose&&{x,y,z:pose.z,shape:spatialProfile(pose)},players);
    const i = this.cellAt(x, y); let a = 0;
    if (i >= 0 && !this.a.blackout()) { a = this.lamp[i]; for (const f of this.fails) if (f.until > this.now && Math.hypot(x - f.x, y - f.y) < f.r) a *= .06; }
    if (players) for (const p of players) { if (!p.light) continue; const q = this.a.qc(p, { x, y }, true); if (q > a && this.los(p.x, p.y, x, y)) a = q; }   // (v23) a torch does not light through walls
    return Math.min(1, .04 + a * 2.08);
  }
  /* A* over the 48px grid.  caps decide which cell classes are usable; vault links only for CAN_VAULT.  cost(i) may add expense (or Infinity). */
  path(x0, y0, x1, y1, caps, opts = {}) {
    const s = this.snap(x0, y0, caps, 5, opts.start, opts.profile), g = this.snap(x1, y1, caps, 6, opts.goal, opts.profile);
    if (s < 0 || g < 0) return null;
    if (this.spatial) this.navStats.plans++;
    if (s === g) return this.spatial ? [this.nodePose(g)] : [{ x: x1, y: y1 }];
    const cols = this.cols, N = this.N, cs = this.cs, st = ++this.stamp, gen = this.gen, gs = this.gs, from = this.from, heap = this.heap, hf = this.hf, links = this.links, cls = this.cls, clr = this.clr;
    let hn = 0;
    const gx = this.cx(g), gy = this.cy(g), costFn = opts.cost, maxNodes = opts.maxNodes || 14000, canVault = caps.CAN_VAULT;
    const h = i => { if (this.spatial) return 0; const dx = Math.abs(this.cx(i) - gx), dy = Math.abs(this.cy(i) - gy); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
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
      for (let d = 0; d < (this.spatial ? 0 : 8); d++) {
        const dc = DIRS[d][0], dr = DIRS[d][1];
        const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
        const j = nr * cols + nc; if (!this.passableFor(j, caps)) continue;
        if (dc && dr && (!this.passableFor(r * cols + nc, caps) || !this.passableFor(nr * cols + c, caps))) continue;   // no corner cutting
        let step = (dc && dr ? 67.9 : 48) * (cls[j] === 1 ? 1 : cls[j] === 2 ? 2.2 : 4) + WALL_COST[clr[j]] * (cls[j] === 1 ? 1 : 0);
        if (costFn) { const ex = costFn(j); if (ex === Infinity) continue; step += ex; }
        const ng = gs[i] + step;
        if (gen[j] !== st || ng < gs[j]) { gen[j] = st; gs[j] = ng; from[j] = i; hf[j] = ng + h(j); push(j); linkOf.delete(j); }
      }
      if (this.spatial) {
        for (const edge of this.spatialEdges(i, caps, opts.profile)) {
          const j = edge.to, extra = costFn ? costFn(j) : 0;
          if (!Number.isFinite(extra) || extra < 0) continue;
          const ng = gs[i] + edge.cost + extra;
          if (gen[j] !== st || ng < gs[j]) { gen[j] = st; gs[j] = ng; from[j] = i; hf[j] = ng; push(j); if (edge.link) linkOf.set(j, edge.link); else linkOf.delete(j); }
        }
      } else if (canVault) { const L = links.get(i); if (L) for (const l of L) { const j = l.to; const ng = gs[i] + l.cost / Math.max(.4, caps.VAULT_SPEED || 1); if (gen[j] !== st || ng < gs[j]) { gen[j] = st; gs[j] = ng; from[j] = i; hf[j] = ng + h(j); push(j); linkOf.set(j, l); } } }
    }
    if (this.spatial) { this.navStats.nodes += nodes; this.navStats.maxNodes = Math.max(this.navStats.maxNodes, nodes); }
    if (!found) return null;
    const out = []; let k = g;
    while (k !== s) { const l = linkOf.get(k); out.push(this.spatial ? { ...this.nodePose(k), link: l || null } : { x: this.cx(k), y: this.cy(k), link: l || null, c: cls[k] }); k = from[k]; }
    out.reverse();
    if (!this.spatial) out.push({ x: x1, y: y1 });
    return out;
  }
  nodePose(i) { const n = this.nodes[i]; return n && { x:n.x, y:n.y, z:n.z, supportId:n.supportId, navSurfaceId:n.surfaceId, c:this.cls[i], nodeId:n.id }; }
  profile(caps, profile) {
    const id = typeof profile === 'string' ? profile : profile?.id;
    const known=this.profiles.get(id || (caps.CAN_CRAWL ? 'profile:hound' : 'profile:smiler'));
    return known && (profile&&typeof profile==='object'?{...known,...profile}:known);
  }
  snapPose(pose, caps, maxR = 5, profile) {
    if (!pose || !Number.isFinite(pose.z)) return -1;
    const p = this.profile(caps, profile); if (!p) return -1;
    const surface = pose.navSurfaceId || this.geometry.supportPatch(pose.supportId)?.navSurfaceId;
    const candidates = surface ? [surface] : pose.supportCandidates;
    if (!Array.isArray(candidates) || !candidates.length || candidates.length > 4) return -1;
    let best = -1, distance = Infinity;
    for (const id of [...new Set(candidates)].sort()) {
      const chart = this.charts.get(id); if (!chart) continue;
      const c = Math.floor((pose.x-chart.origin.x)/chart.cellSize), r = Math.floor((pose.y-chart.origin.y)/chart.cellSize);
      for (let dy=-maxR;dy<=maxR;dy++) for(let dx=-maxR;dx<=maxR;dx++) {
        const i = chart.cells.get((c+dx)+','+(r+dy));
        if (i === undefined || !this.passableFor(i,caps,p)) continue;
        const n = this.nodes[i], d = Math.hypot(n.x-pose.x,n.y-pose.y,n.z-pose.z);
        // A support context is not permission to pass through a slab to its cell.
        const shape=caps.CAN_CRAWL&&(!this.geometry.clearance(p,pose).fits||!this.geometry.clearance(p,n).fits)?{...p,height:24,eyeHeight:18}:p;
        if (d < distance && spatialSegment(this,pose,n,shape)) { best=i;distance=d; }
      }
    }
    return best;
  }
  pathPose(start, goal, caps, opts = {}) { return this.path(start.x,start.y,goal.x,goal.y,caps,{...opts,start,goal}); }
  routeKey(start, goal, caps, profile) {
    const p=this.profile(caps,profile), surface=q=>q.navSurfaceId || this.geometry.supportPatch(q.supportId)?.navSurfaceId || [...(q.supportCandidates||[])].sort().join('|');
    return [this.geometry.identity.contentHash,this.topologyRevision,surface(start),surface(goal),p?.id,p?.radius,p?.height,p?.maxSlopeDegrees,p?.maxStepRise,p?.stepLiftMax,!!caps.CAN_CRAWL,!!caps.CAN_USE_TIGHT_GAPS,!!caps.CAN_VAULT,caps.VAULT_SPEED,Math.round(goal.x/48),Math.round(goal.y/48)].join('/');
  }
  spatialEdges(i,caps,profile) {
    const p=this.profile(caps,profile), out=[];
    for(const edge of this.edges[i]) {
      this.navStats.edgeChecks++;
      if(!this.passableFor(edge.to,caps,p))continue;
      if(edge.corners?.some(j=>!this.passableFor(j,caps,p)))continue;
      const link=edge.link;
      if(link && (!link.profileIds.includes(p.id) || link.kind==='crawl'&&!caps.CAN_CRAWL || link.kind==='vault'&&!caps.CAN_VAULT || link.capabilityFlags.includes('tight-gap')&&!caps.CAN_USE_TIGHT_GAPS))continue;
      const key=[i+'>'+edge.to,p.id,p.radius,p.height,p.maxSlopeDegrees,p.maxStepRise,p.stepLiftMax,!!caps.CAN_CRAWL,caps.VAULT_SPEED].join('/');
      let ok=this.edgeProofs.get(key);
      if(ok===undefined){
        this.navStats.cacheMisses++;
        if(link){const shape=link.kind==='crawl'?{...p,height:24,eyeHeight:18}:p;const proof=MOTION.proveTraversal(this.geometry,link,shape,{vaultSpeed:caps.VAULT_SPEED});this.linkProofs.set(key,proof);ok=proof.ok;}
        else {const shape=caps.CAN_CRAWL&&(!this.geometry.clearance(p,this.nodes[i]).fits||!this.geometry.clearance(p,this.nodes[edge.to]).fits)?{...p,height:24,eyeHeight:18}:p;ok=spatialSegment(this,this.nodes[i],this.nodes[edge.to],shape);}
        this.edgeProofs.set(key,ok);
      }else this.navStats.cacheHits++;
      if(!ok)continue;
      const proof=link&&this.linkProofs.get(key);
      out.push({...edge,cost:link?Math.max(edge.cost,proof.distance,proof.ticks*100/60)/(link.kind==='vault'?Math.max(.4,caps.VAULT_SPEED||1):1):edge.cost+WALL_COST[this.clr[edge.to]]*(this.cls[edge.to]===1?1:0)});
    }
    return out;
  }
}

/* Spatial graph is compiled into the SAME A* workspace above. Cells occupy only
 * authored sheets. Geometry and IDs, never floor numbers, determine connectivity.
 * Special links are capability-gated records; E2 supplies motion proofs. */
function spatialNodeFits(geo,i,caps,profile) {
  const n=geo.nodes[i],p=geo.profile(caps,profile);if(!n||!p)return false;
  if(!geo.charts.get(n.surfaceId).clearanceProfileIds.includes(p.id))return false;
  if(n.slope>p.maxSlopeDegrees)return false;
  if(geo.geometry.clearance(p,n).fits)return true;
  return !!caps.CAN_CRAWL && geo.geometry.clearance({...p,height:24,eyeHeight:18},n).fits;
}
function spatialSegment(geo,a,b,profile) {
  if(!profile || ![a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite))return false;
  return geo.geometry.traceSupportMotion({...a,navSurfaceId:a.navSurfaceId||a.surfaceId},[{...b,navSurfaceId:b.navSurfaceId||b.surfaceId}],profile).ok;
}
function buildSpatialNav(geometry) {
  const d=geometry.definition, nodes=[],charts=new Map(),edges=[],links=new Map(),profiles=new Map(d.colliderProfiles.map(p=>[p.id,p]));
  const shape={radius:OL,height:24}, inside=(poly,p)=>poly.every((v,i)=>{const w=poly[(i+1)%poly.length];return (w.x-v.x)*(p.y-v.y)-(w.y-v.y)*(p.x-v.x)>=-1e-7;});
  const add=(chart,key,pose,support)=>{
    const i=nodes.length;chart.cells.set(key,i);nodes.push({id:chart.id+':'+key,surfaceId:chart.id,...pose,supportId:support.id,materialId:support.materialId,slope:Math.acos(support.normal.z)*180/Math.PI,key});edges.push([]);return i;
  };
  for(const surface of [...d.navSurfaces].sort((a,b)=>a.id.localeCompare(b.id))) {
    const chart={...surface,cells:new Map()}, occupied=new Set();charts.set(surface.id,chart);
    for(const id of [...surface.patchIds].sort()) {
      const p=geometry.supportPatch(id),xs=p.polygon.map(v=>v.x),ys=p.polygon.map(v=>v.y),cs=chart.cellSize;
      for(let r=Math.floor((Math.min(...ys)-chart.origin.y)/cs);r<=Math.floor((Math.max(...ys)-chart.origin.y)/cs);r++)for(let c=Math.floor((Math.min(...xs)-chart.origin.x)/cs);c<=Math.floor((Math.max(...xs)-chart.origin.x)/cs);c++)occupied.add(c+','+r);
    }
    for(const key of [...occupied].sort((a,b)=>{const [x,y]=a.split(',').map(Number),[u,v]=b.split(',').map(Number);return y-v||x-u;})) {
      const [c,r]=key.split(',').map(Number),x=chart.origin.x+(c+.5)*chart.cellSize,y=chart.origin.y+(r+.5)*chart.cellSize;
      const ps=surface.patchIds.map(id=>geometry.supportPatch(id)).filter(p=>inside(p.polygon,{x,y}));if(!ps.length)continue;
      const heights=ps.map(p=>geometry.footprintRange(p.polygon,{x,y},OL,p.plane)?.max).filter(Number.isFinite);
      if(!heights.length)continue;
      const z=Math.max(...heights),support=geometry.supports(shape,{x,y,z},[z-.01,z+.01]).find(p=>p.navSurfaceId===surface.id);
      if(support)add(chart,key,{x,y,z:support.z},support);
    }
  }
  const addEdge=(i,j,link=null)=>{if(i<0||j<0||i===j)return;const a=nodes[i],b=nodes[j],cost=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);edges[i].push({to:j,cost,link});};
  for(const chart of charts.values())for(const [key,i]of chart.cells) {
    const [c,r]=key.split(',').map(Number);
    for(const [dc,dr]of DIRS) {
      const j=chart.cells.get((c+dc)+','+(r+dr));if(j===undefined)continue;
      const corners=dc&&dr?[chart.cells.get((c+dc)+','+r),chart.cells.get(c+','+(r+dr))]:[];
      if(corners.some(k=>k===undefined))continue;
      addEdge(i,j);edges[i][edges[i].length-1].corners=corners;
    }
  }
  for(const raw of d.traversalLinks) {
    const center=ps=>({x:ps.reduce((n,p)=>n+p.x,0)/ps.length,y:ps.reduce((n,p)=>n+p.y,0)/ps.length,z:ps.reduce((n,p)=>n+p.z,0)/ps.length});
    // Entry/exit are real portal regions in Stage E content, never magic points.
    if(raw.entry.length<2||raw.exit.length<2||raw.corridor.length<2)continue;
    const endpoints=[];
    for(const [side,id]of [['entry',raw.fromSurfaceId],['exit',raw.toSurfaceId]]) {
      const chart=charts.get(id),point=center(raw[side]);
      const support=geometry.supports(shape,point,[point.z-.1,point.z+.1]).find(p=>p.navSurfaceId===id);
      if(!support){endpoints.push(-1);continue;}
      const nearby=[...chart.cells.values()].filter(i=>Math.hypot(nodes[i].x-point.x,nodes[i].y-point.y)<chart.cellSize*1.6);
      const i=add(chart,'portal:'+raw.id+':'+side,{...point,z:support.z},support);endpoints.push(i);
      for(const j of nearby){addEdge(i,j);addEdge(j,i);}
    }
    if(endpoints.some(i=>i<0))continue;
    const [i,j]=endpoints,a=nodes[i],b=nodes[j],link=Object.freeze({...raw,ax:a.x,ay:a.y,az:a.z,bx:b.x,by:b.y,bz:b.z});
    addEdge(i,j,link);links.set(i,[...(links.get(i)||[]),{...edges[i][edges[i].length-1],...link}]);
  }
  // Discover continuous seams from physical patch boundaries using a bounded XY
  // neighbor hash. Sharing XY on unrelated stories never creates an edge.
  const buckets=new Map(),bucket=(x,y)=>Math.floor(x/48)+','+Math.floor(y/48);
  for(let i=0;i<nodes.length;i++){const n=nodes[i];if(n.key.startsWith('portal:'))continue;const k=bucket(n.x,n.y);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);}
  for(let i=0;i<nodes.length;i++){
    const a=nodes[i];if(a.key.startsWith('portal:'))continue;
    const c=Math.floor(a.x/48),r=Math.floor(a.y/48);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const j of buckets.get((c+dx)+','+(r+dy))||[]){
      const b=nodes[j];if(a.surfaceId===b.surfaceId||Math.abs(a.z-b.z)>.001)continue;
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:a.z};if(!geometry.continuousSupport(a.supportId,b.supportId,mid,shape))continue;
      const distance=Math.hypot(b.x-a.x,b.y-a.y),nx=distance?-(b.y-a.y)/distance:1,ny=distance?(b.x-a.x)/distance:0;
      const region=p=>[-32,32].map(v=>({x:p.x+nx*v,y:p.y+ny*v,z:p.z}));
      const link=Object.freeze({id:'seam:'+a.id+'>'+b.id,kind:'walk-seam',fromSurfaceId:a.surfaceId,toSurfaceId:b.surfaceId,entry:region(a),exit:region(b),corridor:[{x:a.x,y:a.y,z:a.z},{x:b.x,y:b.y,z:b.z}],corridorRadius:32,profileIds:[...profiles.keys()],capabilityFlags:[],supportPatchIds:[a.supportId,b.supportId],directed:true,ax:a.x,ay:a.y,az:a.z,bx:b.x,by:b.y,bz:b.z});
      addEdge(i,j,link);
    }
  }
  for(const e of edges)e.sort((a,b)=>nodes[a.to].id.localeCompare(nodes[b.to].id));
  const N=nodes.length,cls=new Uint8Array(N),clr=new Uint8Array(N),lamp=new Float32Array(N);
  nodes.forEach((n,i)=>{cls[i]=geometry.clearance({...shape,height:36},n).fits?1:2;for(const [k,r]of [[1,30],[2,40],[3,52]])if(geometry.clearance({radius:r,height:36},n).fits)clr[i]=k;});
  return {nodes,charts,edges,profiles,cls,clr,lamp,links,N,cs:48,cols:0,rows:0,cx:i=>nodes[i]?.x,cy:i=>nodes[i]?.y,cellAt:()=>-1,topologyRevision:'surface-links-e2'};
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
function noteEv(r, k, x, y, u, c, t, spatial) {
  const ev = r.ev || (r.ev = []), q = ev.find(o => o.k === k);
  if (q) { q.x = x; q.y = y; q.u = u; q.c = c; q.t = t; }
  else { ev.unshift({ k, x, y, u, c, t }); if (ev.length > EV_MAX) ev.pop(); }
  if(spatial)Object.assign(ev.find(o=>o.k===k),spatialFields(spatial));
}
/* an anonymous lead: merged into a matching recent one (same place, give or take both uncertainties), otherwise a new one */
function addLead(e, now, L) {
  const leads = e.mem.leads;
  for (const q of leads) {
    if (evidenceModality(q.k) !== evidenceModality(L.k)) continue;
    if(!verticalCompatible(q,L))continue;
    if (now - q.t > 6 || Math.hypot(q.x - L.x, q.y - L.y) > (q.u + L.u) * .6) continue;
    const w = L.c / (L.c + q.c * .8);
    q.x += (L.x - q.x) * w; q.y += (L.y - q.y) * w; q.u = Math.max(L.u * .75, Math.min(q.u, L.u) * .95);          // seeing the same thing again firms it up a little, never past what one look can tell
    q.c = Math.min(1, Math.max(q.c, L.c) + .05); q.t = now; q.n++; q.sal = Math.max(q.sal * .7, L.sal); q.k = L.k === 'source' ? 'source' : q.k; if (L.dir !== undefined) q.dir = L.dir;
    if(Number.isFinite(L.zMin))Object.assign(q,spatialFields(L));
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
    const L = leads[i]; if (L.k !== 'source' || !verticalCompatible(L,p) || !p.light || now - L.t > .5 || Math.hypot(L.x-p.x,L.y-p.y)>60) continue;
    const owners=[...e.seenNow].map(id=>e.mem.p.get(id)).filter(r=>r.visual&&r.light&&verticalCompatible(r.visual,L)&&Math.hypot(r.visual.x-L.x,r.visual.y-L.y)<60); if(owners.length!==1||owners[0].id!==r.id) continue;
    noteEv(r, 'light', L.x, L.y, L.u, L.c, L.t,L); leads.splice(i, 1);
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
  if(eng.geo.spatial){const p=r.seen&&r.visual,est=p||estimate(e,r,eng.now,eng.geo);return {...est,vx:p?p.vx:r.lvx,vy:p?p.vy:r.lvy,vz:p?p.vz:r.lkvz||0,sp:Math.hypot(p?p.vx:r.lvx,p?p.vy:r.lvy),seen:!!p,p:p||null};}
  if (r.seen) { const p = r.visual; if (p) return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, sp: Math.hypot(p.vx, p.vy), angle: p.angle, seen: true, p }; }
  const est = estimate(e, r, eng.now, eng.geo); return { x: est.x, y: est.y, vx: r.lvx, vy: r.lvy, sp: Math.hypot(r.lvx, r.lvy), seen: false, p: null, unc: est.unc };
}
/* a body in physical contact (capture range): contact is physics, not perception */
function touching(eng, e, id, reach) { const p = eng.playerById(id); return p && p.alive && !p.caught && (eng.geo.spatial?eng.geo.physicalContact(e,p,reach):Math.hypot(p.x - e.x, p.y - e.y) < reach) ? p : null; }
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
  if(eng.geo.spatial)p=r?.visual;
  if (!p || !p.alive || !r || !r.seen) return null;             // own: the light on itself as the entity knows it (2D Smiler: the lamp field + beams it saw) -
  const d = eng.geo.spatial?eng.geo.distance(e,p):Math.hypot(e.x - p.x, e.y - p.y); if (d > 900) return null;    //      then nobody's torch is read from where they really are
  const off = Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.angle)); if (off > EYE_CONE) return null;
  if(eng.geo.spatial){const a=eng.geo.eye(p),b=eng.geo.eye(e);if(!eng.geo.clearRay(a,b)||Math.abs(Math.atan2(b.z-a.z,Math.hypot(b.x-a.x,b.y-a.y))-(p.pitch||0))>EYE_CONE)return null;}
  const lit = Math.max(emit, own !== null ? own : eng.geo.lightLevel(e.x, e.y, eng.lightPlayers(),e));
  if (d > 240 && lit < .3) return null;
  return { d, off, lit };
}
function memAge(e, r, now) { return now - Math.max(r.seenAt, r.heardAt); }
function memHalfLife(e) { return lerp(7, 46, e.tr.MEMORY); }        // seconds until an old sighting is (mostly) forgotten
/* where might the player be now?  the last known position pushed along its last heading, with growing uncertainty */
function estimate(e, r, now, geo) {
  if(geo?.spatial)return spatialEstimate(e,r,now,geo);
  const age = Math.max(0, now - r.seenAt), sp = Math.hypot(r.lvx, r.lvy);
  const dur = Math.min(age, 3.2) * (sp > 20 ? 1 : 0), k = sp > 1 ? 1 / sp : 0;
  let D = Math.min(sp * dur * .55, 520);
  if (geo && D > 0) D = Math.max(0, Math.min(D, geo.ray(r.lkx, r.lky, Math.atan2(r.lvy, r.lvx), D + 40) - 34));   // it went that way - but not through a wall
  return { x: r.lkx + r.lvx * k * D, y: r.lky + r.lvy * k * D, unc: 60 + Math.min(1100, sp * age * .5 + age * 18) };
}

function visualObservation(e, eng, p) {
  const geo = eng.geo, cfg = e.sp.vision;
  if (!p.alive) return {vis:false,strength:0,d:Infinity};
  const dx = p.x - e.x, dy = p.y - e.y, d = geo.spatial?geo.distance(e,p):Math.hypot(dx, dy);        // (v23: no record is made for somebody it does not see)
    let vis = false, strength = 0;
    let spatial=null;
    const stName = W_SN[p.st] || 'stand';
    let range = cfg.range * (.5 + .7 * e.tr.VISION);
    const lit = geo.lightLevel(p.x, p.y, null,p), own = p.light ? (geo.spatial?(KIND_GLARE[p.kind]||0):(KIND_GLARE[p.kind] || 1)) : 0;
    let lightF = cfg.dark ? .82 + .18 * Math.max(lit, own) : .3 + .7 * Math.max(lit, own * .9);
    if (p.light && !cfg.dark) lightF *= 1 + .55 * own;                         // a lit lantern is a beacon
    const observed = geo.spatial ? e.mem.p.get(p.id)?.visual : null;
    const motion = .7 + .5 * clamp((geo.spatial ? (observed ? Math.hypot(observed.vx,observed.vy) : 0) : p.sp) / 172, 0, 1.4);
    range *= lightF * (POSTURE_VIS[p.st] || 1) * motion * (e.act === 'listen' ? .8 : 1);
    const floor = cfg.floor || 70;                                            // something crouched in the dark right beside it is noticed regardless of posture
    if (d <= Math.max(range, floor)) {
      const bearing = Math.atan2(dy, dx), inFov = d < 110 || Math.abs(angDiff(bearing, e.ang + (e.head || 0))) <= cfg.fov / 2;
      // under an occluder (a table, the wall round a hole) a body can only be made out from close by, whatever the light: not visible from across the room
      const cz = !geo.spatial&&WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y) : null;
      const clear=inFov&&(!cz||d<cz.reveal)&&(geo.spatial?(spatial=geo.visibleBody(e,p)).visible:geo.sees(e.x,e.y,p.x,p.y,p.prof));
      if (clear) { vis = true; strength = clamp(Math.pow(1 - d / Math.max(range, floor), .55), .08, 1); }
    }
  return geo.spatial?{vis,strength,d,spatial}:{ vis, strength, d };
}

function updateVision(e, eng, dt, cands) {
  const geo = eng.geo, now = eng.now, cfg = e.sp.vision;
  e.seenNow.clear();
  for (const r0 of e.mem.p.values()) r0.seen = false;
  for (const p of cands) {
    if (!p.alive) continue;
    let r = e.mem.p.get(p.id); const {vis, strength, d,spatial} = visualObservation(e, eng, p);
    if (!vis) continue;
    if (!r) r = rec(e, p.id);
    r.seen = vis; r.dist = d;
    if (vis) {
      if (p.caught) r.heldAt = now;                                              // it can see that somebody else has them
      r.aw = Math.min(1, r.aw + strength * dt * (cfg.gain || 3.2));
      if (r.seenAt < now - 6) r.first = now;
      const cw = !geo.spatial&&WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y, 34) : null; if (cw) { r.crawl = cw.id; r.crawlAt = now; } else if (now - r.crawlAt > 2) r.crawl = null;   // seen going into (or at the mouth of) a crawlspace: remembered
      const snapshot=geo.spatial?spatialVisualSnapshot(eng,e,p,r,spatial):null;
      r.seenAt = now; r.lkx = p.x; r.lky = p.y; r.lvx = snapshot?snapshot.vx:p.vx; r.lvy = snapshot?snapshot.vy:p.vy; r.conf = 1; r.st = p.st; r.stamina = p.stamina; r.ex = p.ex; r.prof = p.prof; r.light = geo.spatial?!!(p.light&&KIND_GLARE[p.kind]):p.light; r.lost = 0;
      r.visual = snapshot || {id:p.id,x:p.x,y:p.y,vx:p.vx,vy:p.vy,angle:p.angle,alive:p.alive,caught:!!p.caught,st:p.st,ex:p.ex,t:now};
      if(snapshot){r.visual=snapshot;r.spatial=spatialFields(snapshot);r.lkz=snapshot.z;r.lkvz=snapshot.vz;r.lvx=snapshot.vx;r.lvy=snapshot.vy;}
      habitObserve(e, r, now);
      noteEv(r, 'see', p.x, p.y, 16, 1, now,spatial);
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
    if (d < 900 && (d < 110 || Math.abs(angDiff(Math.atan2(pv.y - e.y, pv.x - e.x), e.ang + (e.head || 0))) <= cfg.fov / 2) && (geo.spatial?geo.visibleBody(e,pv).visible:geo.los(e.x, e.y, pv.x, pv.y))) r0.downAt = now;
  }
  for (const r0 of e.mem.p.values()) if (!r0.seen) r0.lost += dt;
}

/* the sound bus delivers each event to every entity once */
function hearEvent(e, eng, ev) {
  const geo = eng.geo;
  if(geo.spatial&&(!Number.isFinite(ev.z)||!Number.isFinite(e.z)))return;
  const acoustic=geo.spatial?geo.geometry.propagateSound({x:ev.x,y:ev.y,z:ev.z+1},geo.eye(e)):null;
  if(acoustic&&!acoustic.audible)return;
  if(acoustic){const st=geo.sensorCounters();st.soundQueries++;st.soundNodes+=acoustic.stats.nodes;st.soundPortals+=acoustic.stats.portals;st.soundAlternatives+=acoustic.stats.alternatives;}
  const d=acoustic?acoustic.distance:Math.hypot(ev.x-e.x,ev.y-e.y);
  const identified = identifySound(eng, e, ev);
  const focus = identified && identified.id === e.target && (e.state === S.HUNTING || e.state === S.SEARCHING) && (ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land') ? 1.3 : 1;   // a hunting animal tracks its prey's running footfalls further - careful movement gets no such penalty
  let eff = ev.r * (.42 + e.tr.HEARING * 1.05) * focus * (e.act === 'listen' ? 1.5 : 1) * (e.state === S.FEEDING ? .65 : 1) * (e.state === S.DORMANT ? .75 : 1) * (e.deaf > 0 ? .3 : 1);
  if (d > eff * 1.05) return;
  const clear = acoustic?acoustic.clear:geo.los(e.x, e.y, ev.x, ev.y);
  if (!clear) eff *= .6;
  if (d > eff) return;
  const I = ev.I * Math.pow(1 - d / eff, .7) * (acoustic?acoustic.transmission:1);
  if (I < .03) return;
  const unc = (26 + d * .16) * (clear ? 1 : 1.75) * (1.55 - e.tr.INTELLIGENCE * .45) * (1.4 - e.tr.HEARING * .35) * (ev.type === 'breath' ? 1.5 : 1);
  const a = e.streams.perception() * TAU, m = Math.sqrt(e.streams.perception()) * unc, hx = (acoustic?acoustic.observation.x:ev.x) + Math.cos(a) * m, hy = (acoustic?acoustic.observation.y:ev.y) + Math.sin(a) * m;
  const h = { id: ++e.mem.soundId, x: hx, y: hy, I, type: ev.type, t: eng.now, src: identified ? identified.id : (ev.ent || ev.src < 0) ? -1 : 0, pid: identified ? identified.id : null, attribution: identified ? 'identified' : 'anonymous', modality: 'sound', c: Math.min(1,.4+.5*I), u: unc, unc, clear, ...(acoustic?spatialFields(acoustic.observation):{}) };
  e.hear = h; e.heardCount = (e.heardCount || 0) + 1;
  e.mem.sounds.unshift(h); if (e.mem.sounds.length > 8) e.mem.sounds.pop();
  if (identified) {
    const r = identified;
    const loud = I > .3 || ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land';
    if (loud) { const pdt = eng.now - r.hLoud; if (pdt > .15 && pdt < 1.6) { r.hvx = lerp(r.hvx, (hx - r.hx) / pdt, .5); r.hvy = lerp(r.hvy, (hy - r.hy) / pdt, .5); } else if (pdt >= 1.6) { r.hvx = 0; r.hvy = 0; } r.hLoud = eng.now; }   // where the footsteps are going
    r.heardAt = eng.now; r.hx = hx; r.hy = hy; r.aw = Math.min(1, r.aw + I * .9);
    noteEv(r, 'sound', hx, hy, unc, Math.min(1, .4 + .5 * I), eng.now,acoustic?.observation);
    if (eng.now - r.seenAt > 1.2) {                                              // not in sight: the sound is all we have
      const k = Math.min(1, I * 1.4 + .25);
      r.lkx = lerp(r.lkx, hx, r.conf < .35 ? 1 : k); r.lky = lerp(r.lky, hy, r.conf < .35 ? 1 : k);
      r.conf = Math.max(r.conf, .4 + .5 * I); if(!geo.spatial)r.st = ev.st !== undefined ? ev.st : r.st;else r.spatial=spatialFields(acoustic.observation);
      // (v23) which way it is going: only what the footsteps themselves say (the heading built from successive heard positions, fuzz and all).
      // It used to copy the player's true velocity here - the one place hearing leaked the truth.
      if (loud && Math.hypot(r.hvx, r.hvy) > 1) { r.lvx = r.hvx; r.lvy = r.hvy; }
    }
  }
  if (!identified && h.src === 0) addLead(e, eng.now, {k:'sound',x:h.x,y:h.y,u:h.unc,c:h.c,sal:h.I,type:h.type,...spatialFields(h)});
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
/* Stage E spatial query/observation boundary. Every method takes an explicit
 * pose. World truth is consumed here; only bounded evidence leaves this layer. */
function spatialProfile(o) {
  if(o.shape)return o.shape;
  if(MOTION.ENTITY_PROFILES[o.kind])return MOTION.ENTITY_PROFILES[o.kind];
  return MOTION.PROFILES[W_SN[o.st]||o.posture||'stand']||MOTION.PROFILES.stand;
}
function spatialFields(o) {
  if(!o||!Number.isFinite(o.zMin)||!Number.isFinite(o.zMax))return {};
  const candidates=[...new Set(o.supportCandidates||[])].sort();
  return {zMin:o.zMin,zMax:o.zMax,...(Number.isFinite(o.z)?{z:o.z}:{}),supportCandidates:candidates.length<=4?candidates:[],unresolved:!!o.unresolved||candidates.length>4};
}
function verticalCompatible(a,b){
  if(!Number.isFinite(a?.zMin)||!Number.isFinite(b?.zMin))return true;
  if(a.zMax<b.zMin||b.zMax<a.zMin)return false;
  return !a.supportCandidates?.length||!b.supportCandidates?.length||a.supportCandidates.some(s=>b.supportCandidates.includes(s));
}
Geo.prototype.sensorCounters=function(){return this.sensorStats||(this.sensorStats={candidates:0,rays:0,lightQueries:0,soundQueries:0,soundNodes:0,soundPortals:0,soundAlternatives:0,contacts:0});};
Geo.prototype.distance=function(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);};
Geo.prototype.eye=function(o){return {x:o.x,y:o.y,z:o.z+spatialProfile(o).eyeHeight};};
Geo.prototype.clearRay=function(a,b,channel='visible'){this.sensorCounters().rays++;const h=this.geometry.raycast(a,b,channel);return !h||h.t>=1-1e-7;};
Geo.prototype.visibleBody=function(observer,target){
  const stats=this.sensorCounters();stats.candidates++;
  if(!Number.isFinite(observer.z)||!Number.isFinite(target.z))return {visible:false};
  const from=this.eye(observer),shape=spatialProfile(target),samples=[shape.eyeHeight,shape.height*.5,1];let visible=false,feet=false;
  for(const height of samples){const ok=this.clearRay(from,{x:target.x,y:target.y,z:target.z+height});visible ||=ok;if(height===1)feet=ok;}
  let candidates=[];
  if(visible&&feet)candidates=[...new Set(this.geometry.supports(shape,{x:target.x,y:target.y,z:target.z},[target.z-.11,target.z+.01]).map(s=>s.navSurfaceId).filter(Boolean))].sort();
  return {visible,z:target.z,zMin:target.z,zMax:target.z,supportCandidates:candidates.length<=4?candidates:[],unresolved:!feet||candidates.length!==1};
};
Geo.prototype.physicalContact=function(a,b,reach){
  this.sensorCounters().contacts++;
  if(!Number.isFinite(a.z)||!Number.isFinite(b.z))return false;
  return this.geometry.contact({x:a.x,y:a.y,z:a.z,shape:spatialProfile(a)},{x:b.x,y:b.y,z:b.z,shape:spatialProfile(b)},{reach}).touching;
};
Geo.prototype.lightAt=function(pose,players){
  if(!Number.isFinite(pose?.z))return .04;
  this.sensorCounters().lightQueries++;const receiver=this.eye(pose);let level=0;
  if(!this.a.blackout())for(const l of this.geometry.definition.lights){
    if(l.channel!=='visible')continue;const d=this.distance(receiver,l.position);if(d>=l.range||!this.clearRay(l.position,receiver))continue;
    let intensity=l.power*(1-sm(40,l.range,d));
    for(const f of this.fails)if(Number.isFinite(f.z)&&f.until>this.now&&this.distance(pose,f)<f.r)intensity*=.06;
    level=Math.max(level,intensity);
  }
  if(players)for(const p of players){
    const K=this.a.kinds?.[p.kind];if(!p.light||!K||!(K.power>0)||!KIND_GLARE[p.kind])continue;
    const source=this.eye(p),d=this.distance(source,receiver);if(d>=K.range||!this.clearRay(source,receiver))continue;
    const horizontal=Math.hypot(receiver.x-source.x,receiver.y-source.y),yaw=Math.abs(angDiff(Math.atan2(receiver.y-source.y,receiver.x-source.x),p.angle)),pitch=Math.abs(Math.atan2(receiver.z-source.z,horizontal)-(p.pitch||0));
    if(!K.omni&&(yaw>K.arc/2||pitch>K.arc/2))continue;
    level=Math.max(level,K.power*(1-sm(24,K.range,d)));
  }
  return Math.min(1,.04+level*2.08);
};
function spatialVisualSnapshot(eng,e,p,r,observation){
  const old=r.visual,dt=old?eng.now-old.t:0,continuous=old&&dt>0&&dt<=.25;
  // Velocity is a difference between observed poses, never copied from hidden
  // simulation velocity/support/route fields.
  return {id:p.id,x:p.x,y:p.y,...spatialFields(observation),vx:continuous?(p.x-old.x)/dt:0,vy:continuous?(p.y-old.y)/dt:0,vz:continuous?(p.z-old.z)/dt:0,
    angle:p.angle,pitch:p.pitch||0,alive:p.alive,caught:!!p.caught,st:p.st,ex:p.ex,t:eng.now};
}
function spatialEstimate(e,r,now,geo){
  const known=spatialFields(r.spatial),z=Number.isFinite(r.lkz)?r.lkz:e.z;
  const age=Math.max(0,now-r.seenAt),sp=Math.hypot(r.lvx,r.lvy),D=Math.min(sp*Math.min(age,3.2)*.55,520),k=sp>1?D/sp:0;
  const start={x:r.lkx,y:r.lky,z,...known},target={...start,x:r.lkx+r.lvx*k,y:r.lky+r.lvy*k};
  // A prediction may stay on remembered support. Changing floors requires a
  // geometric route hypothesis, never a lookup of the hidden target.
  if(known.supportCandidates?.length===1){start.navSurfaceId=target.navSurfaceId=known.supportCandidates[0];if(!geo.geometry.traceSupportMotion(start,[target],MOTION.PROFILES[W_SN[r.st]||'stand']||MOTION.PROFILES.stand).ok){target.x=start.x;target.y=start.y;}}
  else{target.x=start.x;target.y=start.y;}
  return {...target,unc:60+Math.min(1100,sp*age*.5+age*18)};
}
/* Visible emitters stay in the physical signal layer. The observation contains
 * only the source/patch/air points that this observer can see, never an owner. */
function spatialBeamsOf(eng){
  if(eng.beamsT>eng.now&&eng.beams)return eng.beams;
  eng.beamsT=eng.now+BEAM_DT;const g=eng.geo,out=[];
  for(const p of eng.lights){
    const K=g.a.kinds?.[p.kind];if(!K||!(K.power>0)||!KIND_GLARE[p.kind]||!Number.isFinite(p.z))continue;
    const origin=g.eye(p),omni=!!K.omni,dirs=omni?[0,1,2,3,4,5].map(i=>i*TAU/6):BEAM_RAYS.map(o=>p.angle+o*K.arc),pitch=omni?0:p.pitch||0;
    const endpoint=(yaw,t)=>({x:origin.x+Math.cos(yaw)*Math.cos(pitch)*t,y:origin.y+Math.sin(yaw)*Math.cos(pitch)*t,z:origin.z+Math.sin(pitch)*t});
    const distance=yaw=>{g.sensorCounters().rays++;const h=g.geometry.raycast(origin,endpoint(yaw,K.range),'visible');return h?h.t*K.range:K.range;};
    const rays=[];for(let i=0;i<dirs.length;i++){const d=distance(dirs[i]),I=q05(K.power*(1-sm(24,K.range,d))*(omni||i===0?1:.6));if(I>0)rays.push({...endpoint(dirs[i],Math.max(0,d-4)),wall:d<K.range-2,I});}
    const air=[];if(!omni){const d=distance(p.angle);for(const f of BEAM_AIR){const t=d*f;air.push({...endpoint(p.angle,t),I:q05(K.power*(1-sm(24,K.range,t)))});}}
    out.push({o:origin,ang:p.angle,pitch,arc:omni?TAU:K.arc,range:K.range,omni,rays,air});
  }
  return eng.beams=out;
}
function spatialObserveBeam(eng,e,b){
  const g=eng.geo,eye=g.eye(e),look=e.ang+(e.head||0),inView=p=>g.distance(eye,p)<110||Math.abs(angDiff(Math.atan2(p.y-eye.y,p.x-eye.x),look))<=e.sp.vision.fov/2;
  const d=g.distance(eye,b.o),yaw=Math.abs(angDiff(Math.atan2(eye.y-b.o.y,eye.x-b.o.x),b.ang)),pitch=Math.abs(Math.atan2(eye.z-b.o.z,Math.hypot(eye.x-b.o.x,eye.y-b.o.y))-b.pitch);
  const cone=b.omni||(yaw<b.arc*.5&&pitch<b.arc*.5),hit=e.kind==='hound'&&cone&&d<b.range;
  let src=null,flash=false;if(d<(cone?1700:650)&&(inView(b.o)||hit)&&g.clearRay(eye,b.o)){src={...b.o};flash=e.kind==='hound'?hit:cone&&d<b.range*1.6;}
  const observed=(points,range,wall)=>points.filter(p=>g.distance(eye,p)<range&&inView(p)&&g.clearRay(eye,p)).map(p=>({x:Math.round(p.x),y:Math.round(p.y),z:Math.round(p.z),I:p.I,...(wall?{w:p.wall?1:0}:{})}));
  const pts=observed(b.rays,1500,true),air=observed(b.air,900,false);if(!src&&!pts.length&&!air.length)return null;
  // Neither emitter switch time nor motion of an unseen part of the beam is an
  // observation. Brightness/visible positions alone drive the existing weights.
  return {src,flash,pts,air,fresh:false,moved:false};
}
function spatialInferLead(e,o,geo){
  if(o.src)return {k:'source',x:o.src.x,y:o.src.y,u:35,c:o.flash?.95:.8,sal:o.flash?1:.55,flash:o.flash,zMin:o.src.z-72,zMax:o.src.z,supportCandidates:[],unresolved:true};
  const all=o.pts.concat(o.air);if(!all.length)return null;
  let maxI=0;for(const q of all)maxI=Math.max(maxI,q.I);
  const c=clamp(.22+.07*all.length+maxI*.4,.2,.8),sal=clamp(.25+maxI*.3,0,1);
  let x,y,dir,k,u;
  if(o.air.length>=2){const sorted=o.air.slice().sort((a,b)=>b.I-a.I),a=sorted[0],b=sorted[sorted.length-1];dir=a.I>b.I?Math.atan2(a.y-b.y,a.x-b.x):null;x=a.x;y=a.y;
    if(dir!==null){const to={x:a.x+Math.cos(dir)*200,y:a.y+Math.sin(dir)*200,z:a.z},hit=geo.geometry.raycast(a,to,'visible'),D=Math.max(0,Math.min(170,(hit?hit.t*200:200)-26));x+=Math.cos(dir)*D;y+=Math.sin(dir)*D;}
    k='beam';u=170+.15*Math.hypot(x-e.x,y-e.y);
  }else{x=all.reduce((n,q)=>n+q.x,0)/all.length;y=all.reduce((n,q)=>n+q.y,0)/all.length;k=o.pts.some(q=>q.w)?'litwall':'litfloor';u=260+.2*Math.hypot(x-e.x,y-e.y);}
  // A reflected patch or a partial beam cannot identify an emitter's floor.
  const bounds=geo.geometry.definition.bounds;
  return {k,x,y,u,c,sal,...(dir!=null?{dir:+dir.toFixed(3)}:{}),zMin:bounds.min.z,zMax:bounds.max.z,supportCandidates:[],unresolved:true};
}
/* Stage 2F: shared evidence tools, never a species action brain. Inputs are observations only.
 * See STAGE_2F_DESIGN.md: physical contact, lifecycle and LOD are explicit system boundaries. */
const INTEL = Object.freeze({ players: 16, sounds: 8, soundTTL: 25, leads: 6, leadTTL: 45, evidence: 4, recordTTL: 120, visited: 128, visitedTTL: 60, habitObs: 6, hypotheses: 3, habitTTL: 30, habitRepeats: 3, habitBias: .12, candidates: 70, debugCandidates: 12 });
const evidenceModality = k => k === 'see' ? 'sight' : k === 'sound' ? 'sound' : 'light';
const evidenceWeights = e => e.kind === 'hound' ? { sight: 4, sound: 1.4, light: .8 } : { sight: 2, sound: 1.2, light: 2.2 };
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
  for (const r of e.mem.p.values()) for (const q of r.ev) out.push({ key: `P${r.id}/${q.k}`, pid: r.id, attribution: 'identified', modality: evidenceModality(q.k), x: q.x, y: q.y, t: q.t, c: q.c, u: q.u, expires: q.t + memHalfLife(e) * 3, ...spatialFields(q) });
  for (const L of e.mem.leads) out.push({ key: `L${L.id}`, pid: null, attribution: 'anonymous', modality: evidenceModality(L.k), x: L.x, y: L.y, t: L.t, c: L.c, u: L.u, expires: L.t + LEAD_MAXAGE, lead: L.id, ...spatialFields(L) });
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
    if ((eng.geo.spatial?eng.geo.distance(p,ev):Math.hypot(p.x - ev.x, p.y - ev.y)) > 24 || !visualObservation(e, eng, p).vis) continue;
    if (unique) return null; // overlapping visible people do not make source identity unambiguous
    unique = p;
  }
  return unique && unique.id === r.id ? r : null;
}
function habitObserve(e, r, now) {
  const v = r.visual; if (!v || !r.seen) return;
  const cell = `${Math.floor(v.x / 192)},${Math.floor(v.y / 192)}`+(Number.isFinite(v.zMin)?"/"+(v.supportCandidates||[]).join(",")+"/"+Math.floor(v.zMin/48):"");
  const prev = r.habitLast, moving = Math.hypot(v.vx, v.vy) > 30;
  if (!moving || (prev && cell === prev.cell) || (prev && now - prev.t < 1.5)) return;
  r.habitLast = { cell, t: now };
  const dir = Math.atan2(v.vy, v.vx), key = cell + '/' + ((Math.round(dir / (Math.PI / 2)) + 4) % 4);
  const entries = e.mem.habits.get(r.id) || []; entries.push({ key, x: v.x, y: v.y, dir, t: now, ...spatialFields(v) });
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
  const targets=[...e.mem.p.values()].map(r=>({pid:r.id,score:+(e.kind==='hound'?houndTargetScore(e,r,eng.now)+(r.id===e.target ? .65 : 0):sScore(eng,e,r)).toFixed(3),current:r.id===e.target,seen:r.seen,
    why:tgtGone(eng,e,r)?'rejected: perceived unavailable':e.kind==='hound'&&!hMaySwitch(e,r,eng.now)?'commitment prevents switch':e.kind==='smiler'&&!r.seen&&(eng.now-r.seenAt>2.5||r.conf<.3)?'rejected: stale/uncertain':r.id===e.target?'current target; species state/trigger rules apply':'observed candidate; species state/trigger rules apply'})).sort((a,b)=>b.score-a.score||a.pid-b.pid).slice(0,12);
  const pending=[];for(const [pid,history]of e.mem.habits){const counts=new Map();for(const q of history)counts.set(q.key,(counts.get(q.key)||0)+1);for(const [key,count]of counts)if(count<INTEL.habitRepeats)pending.push({pid,key,count,why:'rejected: fewer than three observed repetitions'});}
  return { winner: A?.winner || null, why: A?.why || 'no evidence', weights: A?.weights || evidenceWeights(e),
    candidates: (A?.candidates || []).map(q => ({ key: q.key, attribution: q.attribution, modality: q.modality, score: +q.score.toFixed(3), c: +q.c.toFixed(2), u: Math.round(q.u), age: +(eng.now - q.t).toFixed(2), expires: +(q.expires - eng.now).toFixed(1) })),
    sound: e.hear ? { attribution: e.hear.attribution, x: Math.round(e.hear.x), y: Math.round(e.hear.y), type: e.hear.type } : null,
    habits: e.mem.hypotheses.map(h => ({ pid: h.pid, count: h.count, bias: h.bias, x: Math.round(h.x), y: Math.round(h.y), expires: +(h.expires - eng.now).toFixed(1) })),
    target:e.target||null, targets, commitment:{age:+(eng.now-(e.tgtSince??eng.now)).toFixed(2),dwell:e.kind==='hound'?hDwell(e):SM_DWELL}, rejectedHabits:pending.slice(0,3), habitExpiry:e.dbg.habitRejected||null, applied: e.dbg.habit || null, rng: e.rngKey, tags: Object.keys(e.streams),
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
  if(eng.geo.spatial)return spatialBeamsOf(eng);
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
  if(eng.geo.spatial)return spatialObserveBeam(eng,e,b);
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
  if(geo.spatial)return spatialInferLead(e,o,geo);
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
      const owners = [...e.seenNow].map(id=>e.mem.p.get(id)).filter(r=>r.visual && r.light && verticalCompatible(r.visual,L) && Math.hypot(r.visual.x-L.x,r.visual.y-L.y)<60); const own=owners.length===1?owners[0]:null;
      if (own) { noteEv(own, 'light', L.x, L.y, L.u, L.c, eng.now,L); if (L.flash) e.flashAt = eng.now; e.dbg.light = `source (in the hand of P${own.id}) @${eng.now.toFixed(1)}`; continue; }
    }
    const q = addLead(e, eng.now, L);
    if (L.flash) e.flashAt = eng.now;
    e.dbg.light = `${L.k} c${L.c.toFixed(2)} u${Math.round(L.u)}${o.fresh ? ' fresh' : ''}${o.moved ? ' moving' : ''} @${eng.now.toFixed(1)}`;

  }
  const best = bestAnonLead(e, eng.now, 'light'), current=e.inv&&e.mem.leads.find(q=>q.id===e.inv.lead&&q.k!=='sound');
  if(best && (!current || best.id===current.id || observationScore(e,best,eng.now)>observationScore(e,current,eng.now)*1.25)) e.inv={lead:best.id,x:best.x,y:best.y,u:best.u,c:best.c*(.5+best.sal),k:best.k,t:best.t,...spatialFields(best)};

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
  if(eng.geo.spatial)initializeSpatialEntity(eng,e,opts);
  if (sp.init) sp.init(eng.geo.spatial?eng.entityContext(e):eng, e, opts);
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
  if(eng.geo.spatial)return spatialMove(eng,e,dx,dy);
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
  if(eng.geo.spatial)return spatialPlan(eng,e,gx,gy,opts);
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
function directTo(eng, e, gx, gy, pose) { if(eng.geo.spatial)return spatialDirectTo(eng,e,gx,gy,pose); if (e.goalKey !== 'direct') { navOf(e).direct++; navWhy(e, 'direct', eng.now); navOf(e).plans--; } e.path = [{ x: gx, y: gy }]; e.goal = { x: gx, y: gy }; e.goalKey = 'direct'; e.pathAge = 0; }
/* is a straight run at (tx,ty) safe?  with hysteresis: once running straight it stays straight while the body itself fits; to switch into it the line
 * needs the full margin (so DIRECT -> ROUTE -> DIRECT does not flicker at the edge of a doorframe) */
function directOk(eng, e, tx, ty, maxD = 700, pose) {
  if(eng.geo.spatial)return spatialDirectOk(eng,e,tx,ty,maxD,pose);
  if (Math.hypot(tx - e.x, ty - e.y) > maxD) return false;
  return eng.geo.lineClear(e.x, e.y, tx, ty, e.rc + (e.goalKey === 'direct' ? 1 : NAV_MARGIN), 'walk');
}
/* set a destination.  Route commitment: a moving goal only costs a new route when it moved meaningfully (more than ~12 % of the way, 40 px minimum)
 * or when the last leg can no longer reach it; small moves just slide the end of the route along.  Every new route records why (debug overlay). */
function goTo(eng, e, gx, gy, opts = {}) {
  if(eng.geo.spatial)return spatialGoTo(eng,e,gx,gy,opts);
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
  if(eng.geo.spatial)return spatialBeginTrav(eng,e,l);
  const dur = clamp(.5 / Math.max(.3, e.caps.VAULT_SPEED || 1), .25, 1.4);
  e.trav = { ax: e.x, ay: e.y, bx: l.bx, by: l.by, t: 0, dur, prop: l.prop, dir: Math.atan2(l.by - e.y, l.bx - e.x) }; e.travCount = (e.travCount || 0) + 1;
}
function stepTrav(eng, e, dt) {
  if(eng.geo.spatial)return spatialStepTrav(eng,e,dt);
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
  if(eng.geo.spatial)return spatialCarrot(eng,e,look);
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
  e.mode = geo.spatial&&e.trav?.link.kind==='crawl'?'crawl':modeFor(e);
  if(geo.spatial){const shape=actorShape(e,e.mode);if(geo.geometry.clearance(shape,e).fits)e.shape=shape;e.traverseSpeed=vmax;}
  if (e.trav) { stepTrav(eng, e, dt); return 'moving'; }
  const arrive = o.arrive ?? 18;
  while (e.path.length) {
    const wp = e.path[0], last = e.path.length === 1, d = geo.spatial?Math.hypot(wp.x-e.x,wp.y-e.y,wp.z-e.z):Math.hypot(wp.x - e.x, wp.y - e.y);
    if (wp.link) { const L = wp.link; if (Math.hypot(L.ax - e.x, L.ay - e.y) < (geo.spatial?3.5:28)) { beginTrav(eng, e, L); return 'moving'; } break; }
    if (d < (geo.spatial&&e.path[1]?.link?3.5:last?arrive:26) && (!geo.spatial||wp.navSurfaceId===e.navSurfaceId)) { e.path.shift(); continue; }
    // passed it already (the next leg is now straight from here): drop it rather than turning back for it
    if (!last && (!geo.spatial||wp.navSurfaceId===e.navSurfaceId) && !e.path[1].link && (e.path[1].c | 0) <= 1 && d < 110 && geo.lineClear(e.x, e.y, e.path[1].x, e.path[1].y, e.rc + 2, e.mode)) { e.path.shift(); continue; }
    break;
  }
  const wp = e.path[0];
  if (!wp) { e.speed = approach(e.speed, 0, (e.caps.ACCELERATION || 500) * 2.2 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); e.carrot = null; return e.goal && (geo.spatial?Math.hypot(e.goal.x-e.x,e.goal.y-e.y,e.goal.z-e.z):Math.hypot(e.goal.x - e.x, e.goal.y - e.y)) > (o.arrive ?? 18) + 30 ? 'nopath' : 'arrived'; }
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
  if(geo.spatial&&(wp.link||e.path[1]?.link)){const x=wp.link?wp.link.ax:wp.x,y=wp.link?wp.link.ay:wp.y;vcap=Math.min(vmax,Math.hypot(x-e.x,y-e.y)/dt);}
  if (e.path.length > 1 && !wp.link) {
    const n1 = e.path[1], nx = n1.link ? n1.link.ax : n1.x, ny = n1.link ? n1.link.ay : n1.y, a0 = Math.atan2(wp.y - e.y, wp.x - e.x), a1 = Math.atan2(ny - wp.y, nx - wp.x);
    const theta = Math.abs(angDiff(a1, a0)), dC = Math.hypot(wp.x - e.x, wp.y - e.y);
    const vC = cornerSpeed(e, theta, e.kind === 'hound' ? 115 : 80), dec = (e.caps.ACCELERATION || 500) * 2.2;
    vcap = Math.min(vcap??Infinity,Math.sqrt(vC * vC + 2 * dec * Math.max(0, dC - 40)));
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
  if(eng.geo.spatial){if(e.trav||e.step||e.motionMode!=='grounded'||e.cap||e.commit)return 'near';let latest=0;for(const r of e.mem.p.values())latest=Math.max(latest,r.seenAt,r.heardAt);for(const L of e.mem.leads)latest=Math.max(latest,L.t);const idle=eng.now-latest;return idle<10?'near':idle<30?'mid':'far';}
  if (e.cap || e.commit) return 'near';                                  // a capture or a kill still playing out is always fully simulated (it has a clock to finish)
  const near = eng.nearestPlayerDist(e.x, e.y);
  return near < 1900 ? 'near' : near < 3800 ? 'mid' : 'far';
}
/* far-away entities do not run perception or steering: they drift along cached routes on a slow clock */
function coarseMove(eng, e, dt) {
  if(eng.geo.spatial)return follow(eng,e,dt,e.sp.roamSpeed||90);
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
    return geo.spatial?geo.nodePose(c):{ x: geo.cx(c), y: geo.cy(c) };
  }
  return null;
}
/* Stage E: explicit actor-bound geometry for the retained brains' local XY
 * questions. No shared 'current floor', no global mode switch, no player lookup.
 * Navigation between sheets always goes through Geo.pathPose's existing A*. */
function bodyPose(e){return {x:e.x,y:e.y,z:e.z,supportId:e.supportId,navSurfaceId:e.navSurfaceId};}
function surfaceOf(g,p){return p?.navSurfaceId||g.geometry.supportPatch(p?.supportId)?.navSurfaceId||(p?.supportCandidates?.length===1?p.supportCandidates[0]:null);}
function localPose(g,reference,x,y,shape){
  const surface=surfaceOf(g,reference);if(!surface)return null;
  const D=g.geometry.definition.bounds,pose={x,y,z:reference.z};
  const supports=g.geometry.supports(shape,pose,[D.min.z,D.max.z]).filter(s=>s.navSurfaceId===surface);
  supports.sort((a,b)=>Math.abs(a.z-reference.z)-Math.abs(b.z-reference.z)||a.id.localeCompare(b.id));
  const s=supports[0];return s?{x,y,z:s.z,supportId:s.id,navSurfaceId:surface}:null;
}
function actorShape(e,mode='walk',radius=e.rc){return {...e.baseShape||e.shape,radius,height:e.caps.CAN_CRAWL&&(mode==='crawl'||mode==='under')?24:(e.baseShape||e.shape).height,eyeHeight:e.caps.CAN_CRAWL&&(mode==='crawl'||mode==='under')?18:(e.baseShape||e.shape).eyeHeight};}
Geo.prototype.forActor=function(e,reference=null){
  const root=this.rootGeo||this;if(!root.spatial)return root;
  const g=Object.create(root),ref=()=>reference||bodyPose(e);g.rootGeo=root;g.actor=e;
  g.forPose=p=>root.forActor(e,p);
  g.cellAt=(x,y)=>{const id=surfaceOf(root,ref()),chart=root.charts.get(id);if(!chart)return -1;const c=Math.floor((x-chart.origin.x)/chart.cellSize),r=Math.floor((y-chart.origin.y)/chart.cellSize),i=chart.cells.get(c+','+r);return i!==undefined&&root.passableFor(i,e.caps,e.baseShape)?i:-1;};
  g.clear=(x,y,r,mode='walk')=>{const sh=actorShape(e,mode,r),p=localPose(root,ref(),x,y,sh);return !!p&&root.geometry.clearance(sh,p).fits;};
  g.isFloor=(x,y)=>g.cellAt(x,y)>=0;
  g.snap=(x,y,caps,maxR=5,context,profile)=>{const p=context||localPose(root,ref(),x,y,actorShape(e));return p?root.snapPose({...p,x,y},caps,maxR,profile||e.baseShape):-1;};
  g.lineClear=(ax,ay,bx,by,r=e.rc,mode='walk')=>{const sh=actorShape(e,mode,r),a=localPose(root,ref(),ax,ay,sh),b=localPose(root,ref(),bx,by,sh);return !!a&&!!b&&root.geometry.traceSupportMotion(a,[b],sh).ok;};
  g.ray=(x,y,ang,max)=>{const p=localPose(root,ref(),x,y,e.shape);if(!p)return 0;const a={x,y,z:p.z+e.shape.eyeHeight},b={x:x+Math.cos(ang)*max,y:y+Math.sin(ang)*max,z:a.z},hit=root.geometry.raycast(a,b,'collision');return hit?Math.max(0,hit.t*max):max;};
  g.los=(ax,ay,bx,by)=>{const a=localPose(root,ref(),ax,ay,e.shape),b=localPose(root,ref(),bx,by,e.shape);return !!a&&!!b&&root.clearRay({...a,z:a.z+e.shape.eyeHeight},{...b,z:b.z+e.shape.eyeHeight});};
  g.lightLevel=(x,y,players,pose)=>{const p=pose||localPose(root,ref(),x,y,e.shape);return p?root.lightAt({x,y,z:p.z,shape:e.shape},players):.04;};
  g.sensorCounters=()=>root.sensorCounters();
  return g;
};
function initializeSpatialEntity(eng,e,opts){
  if(!Number.isFinite(opts.z))throw Error('Spatial entity spawn requires explicit Z');
  e.z=opts.z;e.baseShape=MOTION.ENTITY_PROFILES[e.kind];eng.motion.initialize(e,'walk',e.baseShape);
  if(opts.supportId&&opts.supportId!==e.supportId){const s=eng.geo.geometry.supportPatch(opts.supportId);if(!s||!eng.geo.geometry.continuousSupport(e.supportId,opts.supportId,e,e.shape))throw Error('Spatial spawn support does not match physical contact');e.supportId=opts.supportId;}
  syncSurface(eng,e);e.home=bodyPose(e);e.spawn=bodyPose(e);e.physTick=-1;e.routeRevision=0;e.linkHistory=[];
}
function syncSurface(eng,e){e.navSurfaceId=eng.geo.geometry.supportPatch(e.supportId)?.navSurfaceId||null;}
function spatialGoal(eng,e,x,y,known){
  const g=eng.geo.rootGeo||eng.geo,sh=e.baseShape;
  if(known&&(Number.isFinite(known.z)||Number.isFinite(known.zMin))){
    if(Number.isFinite(known.z)&&surfaceOf(g,known)){const pose={x,y,z:known.z,...spatialFields(known),navSurfaceId:surfaceOf(g,known),...(known.hypothesis?{hypothesis:true}:{})};return connectorGoal(g,e,pose)||pose;}
    // An uncertain observation is a region. Pick a deterministic, reachable
    // geometric hypothesis; never label the hypothesis as observed support.
    let low=(known.zMin??known.z??g.geometry.definition.bounds.min.z)-.11;const high=(known.zMax??known.z??g.geometry.definition.bounds.max.z)+.11;
    let possible=g.geometry.supports(sh,{x,y,z:e.z},[low,high]);
    if(!possible.length&&known.unresolved&&Number.isFinite(known.z)){low=g.geometry.definition.bounds.min.z;possible=g.geometry.supports(sh,{x,y,z:known.z},[low,known.z]);}
    const ids=known.supportCandidates?.length?known.supportCandidates.slice(0,4):[...new Set(possible.map(s=>s.navSurfaceId).filter(Boolean))].slice(0,4);
    const candidates=[];for(const id of ids){const chart=g.charts.get(id);if(!chart)continue;const c=Math.floor((x-chart.origin.x)/48),r=Math.floor((y-chart.origin.y)/48);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const i=chart.cells.get((c+dx)+','+(r+dy));if(i===undefined||!g.passableFor(i,e.caps,sh))continue;const n=g.nodePose(i);if(n.z<low||n.z>high)continue;candidates.push(n);}}
    candidates.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)||Math.abs(a.z-e.z)-Math.abs(b.z-e.z)||a.nodeId.localeCompare(b.nodeId));
    for(const p of candidates.slice(0,12)){const goal=connectorGoal(g,e,p)||p;if(g.pathPose(bodyPose(e),goal,e.caps,{profile:sh,maxNodes:4000}))return {...goal,hypothesis:true};}
    return null;
  }
  return localPose(g,bodyPose(e),x,y,sh);
}
function spatialSmooth(g,e,path){
  if(!path)return path;const out=[];let a=bodyPose(e),i=0;
  while(i<path.length){let j=i;if(!path[i].link&&(path[i].c|0)<=1)for(let k=i+1;k<path.length&&k-i<=30;k++){
    if(path[k].link||(path[k].c|0)>1||path[k].navSurfaceId!==a.navSurfaceId)break;
    if(g.geometry.traceSupportMotion(a,[path[k]],actorShape(e,'walk',e.rc+NAV_MARGIN)).ok)j=k;
  }out.push(path[j]);a=path[j];i=j+1;}
  return out;
}
function spatialPlan(eng,e,x,y,opts={}){
  if(e.trav)return true;if(e.resumeTraversal&&resumeSpatialTraversal(eng,e))return true;const g=eng.geo.rootGeo||eng.geo,goal=spatialGoal(eng,e,x,y,opts.pose);
  navWhy(e,opts.why||'plan',eng.now);eng.stats.paths++;e.pathAge=0;e.carrot=null;e.aim=null;e.routeRevision++;
  if(!goal){e.path=[];e.goal=null;e.goalKey='unresolved';e.unreachable=eng.now;return false;}
  const cost=opts.cost||(e.sp.pathCost&&e.sp.pathCost(eng,e));
  let p=g.pathPose(bodyPose(e),goal,e.caps,{profile:e.baseShape,cost,maxNodes:opts.maxNodes});
  e.goal=goal;e.goalKey=g.routeKey(bodyPose(e),goal,e.caps,e.baseShape);e.routeCaps=e.goalKey.split('/').slice(0,-2).join('/');
  if(p){const last=p[p.length-1];if(last&&!last.link&&g.geometry.traceSupportMotion(last,[goal],e.baseShape).ok&&Math.hypot(last.x-goal.x,last.y-goal.y)>.1)p.push(goal);p=spatialSmooth(g,e,p);}
  e.path=p||[];e.unreachable=p?0:eng.now;return !!p;
}
function spatialGoTo(eng,e,x,y,opts={}){
  if(e.trav)return true;const g=eng.geo.rootGeo||eng.geo;
  // Resolve uncertain regions only at a planning boundary, not every 60 Hz tick.
  if(opts.pose?.unresolved&&e.goal?.hypothesis&&e.path.length&&e.pathAge<Math.max(3,(opts.every??1.1)*4)&&Math.hypot(x-(e.regionGoal?.x??x),y-(e.regionGoal?.y??y))<40)return true;
  const goal=spatialGoal(eng,e,x,y,opts.pose),G=e.goal;
  if(!goal)return spatialPlan(eng,e,x,y,opts);
  const key=g.routeKey(bodyPose(e),goal,e.caps,e.baseShape),moved=G?Math.hypot(goal.x-G.x,goal.y-G.y,goal.z-G.z):Infinity;
  if(!G||e.goalKey==='direct'||surfaceOf(g,G)!==surfaceOf(g,goal)||Math.abs(goal.z-G.z)>6||moved>Math.max(40,Math.hypot(goal.x-e.x,goal.y-e.y)*.12)||e.pathAge>Math.max(3,(opts.every??1.1)*4)||(!e.path.length&&e.pathAge>.3)||e.routeCaps!==key.split('/').slice(0,-2).join('/')){
    e.regionGoal={x,y};return spatialPlan(eng,e,goal.x,goal.y,{...opts,pose:goal,why:!G?'new-goal':surfaceOf(g,G)!==surfaceOf(g,goal)?'surface-evidence-changed':'route-refresh'});
  }
  if(moved>3&&e.path.length){const last=e.path[e.path.length-1],prev=e.path.length>1?e.path[e.path.length-2]:bodyPose(e);if(!last.link&&g.geometry.traceSupportMotion(prev,[goal],e.baseShape).ok){e.path[e.path.length-1]=goal;e.goal=goal;}}
  return true;
}
function spatialDirectOk(eng,e,x,y,maxD,known){
  if(e.trav||e.motionMode!=='grounded')return false;const g=eng.geo.rootGeo||eng.geo,goal=spatialGoal(eng,e,x,y,known);if(!goal||Math.hypot(x-e.x,y-e.y,goal.z-e.z)>maxD)return false;
  return g.geometry.traceSupportMotion(bodyPose(e),[goal],actorShape(e,'walk',e.rc+(e.goalKey==='direct'?1:NAV_MARGIN))).ok;
}
function spatialDirectTo(eng,e,x,y,known){
  if(e.trav)return;const goal=spatialGoal(eng,e,x,y,known);if(!goal||!spatialDirectOk(eng,e,x,y,Infinity,goal))return spatialGoTo(eng,e,x,y,{pose:known});
  if(e.goalKey!=='direct'){navOf(e).direct++;navWhy(e,'direct',eng.now);navOf(e).plans--;}
  e.path=[goal];e.goal=goal;e.goalKey='direct';e.pathAge=0;
}
function spatialMove(eng,e,dx,dy){
  const x=e.x,y=e.y,z=e.z;
  if(e.trav){if(e.physTick!==eng.ticks)spatialStepTrav(eng,e,1/60);return Math.hypot(e.x-x,e.y-y,e.z-z);}
  if(e.physTick===eng.ticks){eng.motion.moveSwept(e,{x:dx,y:dy,z:0});}
  else{e.vx=dx*60;e.vy=dy*60;eng.motion.step(e);e.physTick=eng.ticks;}
  syncSurface(eng,e);const moved=Math.hypot(e.x-x,e.y-y,e.z-z);if(moved<Math.hypot(dx,dy)*.5)navOf(e).contacts++;return moved;
}
function spatialBeginTrav(eng,e,link){
  e.shape=actorShape(e,link.kind==='crawl'?'crawl':e.mode);
  const t=eng.motion.beginTraversal(e,link,{vaultSpeed:e.caps.VAULT_SPEED});if(!t)return false;
  e.trav=t;e.travCount=(e.travCount||0)+1;e.linkHistory.push({id:link.id,t:eng.now,event:'begin',z:e.z});if(e.linkHistory.length>32)e.linkHistory.shift();return true;
}
function spatialStepTrav(eng,e,dt){
  const t=e.trav,points=t.link.corridor;let target=points[Math.min(t.segment,points.length-1)];
  if(t.segment<points.length-1&&Math.hypot(target.x-e.x,target.y-e.y)<3){t.segment++;target=points[t.segment];}
  const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy),v=Math.min(e.traverseSpeed||100,112,d/dt);
  const before=bodyPose(e);if(d>.001)turnTo(e,Math.atan2(dy,dx),e.caps.TURNING_ABILITY,dt);
  eng.motion.advanceTraversal(e,t,{x:d?dx/d*v:0,y:d?dy/d*v:0},dt);e.physTick=eng.ticks;syncSurface(eng,e);
  e.moved=Math.hypot(e.x-before.x,e.y-before.y,e.z-before.z);e.speed=e.moved/dt;e.vel.x=e.vx;e.vel.y=e.vy;
  t.stalled=e.moved<.01?(t.stalled||0)+1:0;if(t.stalled>120||t.ticks>2400)t.status='interrupted';
  if(t.status!=='active'){e.linkHistory.push({id:t.link.id,t:eng.now,event:t.status,z:e.z});if(e.linkHistory.length>32)e.linkHistory.shift();e.trav=null;e.path.shift();e.pathAge=t.status==='done'?0:99;if(t.status!=='done'){e.path=[];navOf(e).recover++;}e.shape=actorShape(e);}
}
function spatialCarrot(eng,e,look){
  const g=eng.geo.rootGeo||eng.geo,start=bodyPose(e);let a=start,left=look,c=e.path[0];
  for(const w of e.path){if(w.link){c={x:w.link.ax,y:w.link.ay,z:w.link.az,navSurfaceId:w.link.fromSurfaceId};break;}if(w.navSurfaceId!==start.navSurfaceId)break;
    const d=Math.hypot(w.x-a.x,w.y-a.y,w.z-a.z);if(d>=left){const t=left/d;c={x:a.x+(w.x-a.x)*t,y:a.y+(w.y-a.y)*t,z:a.z+(w.z-a.z)*t,navSurfaceId:start.navSurfaceId};break;}left-=d;a=c=w;
  }
  if(!c)return {x:e.x,y:e.y,ok:false};const ok=g.geometry.traceSupportMotion(start,[c],actorShape(e,e.mode,e.rc+.5)).ok;
  return {x:c.x,y:c.y,z:c.z,ok};
}
function spatialWatchdog(eng,e,dt){
  const w=e.wd;w.u=(w.u||0)+dt;if(w.u<6||e.trav||e.motionMode!=='grounded')return;w.u=0;
  const embedded=!eng.geo.geometry.clearance(e.shape,e).fits,moving=e.speed>20;
  const stuck=moving&&Math.hypot(e.x-w.x,e.y-w.y,e.z-(w.z??e.z))<26;Object.assign(w,{x:e.x,y:e.y,z:e.z});
  if(!embedded&&!stuck)return;navOf(e).recover++;if(embedded)navOf(e).emergency++;
  e.path=[];e.pathAge=99;e.speed=e.vx=e.vy=0;e.carrot=null;e.dbg.spatialRecovery=embedded?'invalid physical pose; stopped without relocation':'stalled route; replan from physical pose';
}
function beliefDistance(e,p){
  if(!Number.isFinite(e.z))return Math.hypot(p.x-e.x,p.y-e.y);
  const z=Number.isFinite(p.z)?p.z:Number.isFinite(p.zMin)?clamp(e.z,p.zMin,p.zMax):e.z;
  return Math.hypot(p.x-e.x,p.y-e.y,z-e.z);
}
function goalReached(eng,e,p,r){
  if(!eng.geo.spatial)return Math.hypot(p.x-e.x,p.y-e.y)<r;
  const id=surfaceOf(eng.geo,p);return (!id||id===e.navSurfaceId)&&beliefDistance(e,p)<r;
}
function connectorGoal(g,e,pose){
  const id=surfaceOf(g,pose);if(id===e.navSurfaceId||g.geometry.definition.traversalLinks.some(l=>l.toSurfaceId===id))return null;
  for(const l of g.geometry.definition.traversalLinks){
    if(l.fromSurfaceId!==e.navSurfaceId||!['stairs','ramp'].includes(l.kind))continue;
    const a=l.corridor[0],b=l.corridor[l.corridor.length-1],dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?((pose.x-a.x)*dx+(pose.y-a.y)*dy)/n:-1;
    if(t<0||t>1||Math.hypot(pose.x-a.x-dx*t,pose.y-a.y-dy*t)>l.corridorRadius||Math.abs(pose.z-(a.z+(b.z-a.z)*t))>36)continue;
    // An observed body on a connector suggests its exit as an interception
    // hypothesis. This changes the route goal, not the observed belief.
    return {x:b.x,y:b.y,z:b.z,navSurfaceId:l.toSurfaceId,hypothesis:true,via:l.id};
  }
  return null;
}
function resumeSpatialTraversal(eng,e){
  if(e.motionMode!=='grounded'||e.step)return false;
  const request=e.resumeTraversal,l=request.link;e.resumeTraversal=null;
  if(l.kind==='vault'&&!e.caps.CAN_VAULT||l.kind==='crawl'&&!e.caps.CAN_CRAWL||!l.profileIds.includes(e.baseShape.id))return false;
  const from=bodyPose(e),finish=l.corridor[l.corridor.length-1],half=l.corridorRadius,dx=finish.x-from.x,dy=finish.y-from.y,D=Math.hypot(dx,dy),nx=D?-dy/D:1,ny=D?dx/D:0;
  const link={...l,id:l.id+'@resume:'+e.supportId+':'+e.tick,fromSurfaceId:e.navSurfaceId,entry:[{x:from.x+nx*half,y:from.y+ny*half,z:from.z},{x:from.x-nx*half,y:from.y-ny*half,z:from.z}],corridor:[from,finish],ax:from.x,ay:from.y,az:from.z};
  const proof=MOTION.proveTraversal(eng.geo.geometry,link,actorShape(e,l.kind==='crawl'?'crawl':'walk'),{vaultSpeed:e.caps.VAULT_SPEED});
  if(!proof.ok){e.dbg.spatialRecovery='interrupted corridor no longer physically legal';return false;}
  if(!spatialBeginTrav(eng,e,link))return false;
  e.path=[{x:finish.x,y:finish.y,z:finish.z,navSurfaceId:l.toSurfaceId,link}];e.pathAge=0;e.routeRevision++;navWhy(e,'resume-physical-corridor',eng.now);eng.stats.paths++;return true;
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
  if(eng.geo.spatial&&!eng.geo.physicalContact(e,pv,e.r+12))return null;
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
  eng.sites.push({ x: pv.x, y: pv.y, ...(eng.geo.spatial?{z:pv.z,zMin:pv.z,zMax:pv.z,supportCandidates:[e.navSurfaceId],unresolved:false}:{}), t: eng.now, kind: e.kind, pid: pv.id, fed: 0 });
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
  if(eng.geo.spatial&&e)eng=eng.entityContext(e);
  if (!e || !pv || !pv.alive) { finishCapture(eng, cap, pv, e); return; }
  cap.t += dt; cap.phaseT = (cap.phaseT || 0) + dt;
  const spc = e.sp.capture;
  if (cap.phase === 'release') {                                       // false hope: the prey is free, is it going to run?
    const r=e.mem.p.get(cap.pid),known=eng.geo.spatial?(r?.seen?r.visual:r?{id:r.id,...estimate(e,r,eng.now,eng.geo)}:{id:cap.pid,x:e.x,y:e.y}):pv;
    const running = (!eng.geo.spatial||r?.seen)&&(known.st === 2 || ((eng.geo.spatial?Math.hypot(known.vx||0,known.vy||0):known.sp) > 110 && beliefDistance(e,known) > 200));
    const d = beliefDistance(e,known);
    cap.watch = (cap.watch || 0) + dt;
    if (running && !cap.triggered) { cap.triggered = eng.now + rand(e, .35, 1.1) * (1.2 - e.tr.AGGRESSION * .5); }
    if (cap.triggered && eng.now >= cap.triggered) { spc.onResume && spc.onResume(eng, e, cap, known); finishCapture(eng, cap, pv, e); return; }
    if (!cap.triggered && (cap.watch > cap.holdFor || d > 1500)) { spc.onLetGo && spc.onLetGo(eng, e, cap, known); finishCapture(eng, cap, pv, e); return; }
    spc.releaseTick && spc.releaseTick(eng, e, cap, known, dt);
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
    const others = eng.entities.some(o => o !== e && !o.cap && Math.hypot(o.x - e.x, o.y - e.y) < 500&&(!eng.geo.spatial||(eng.geo.distance(o,e)<500&&eng.geo.clearRay(eng.geo.eye(e),eng.geo.eye(o)))));
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
  e.hLight = { lead: L.id, x: L.x, y: L.y, u: L.u, k: L.k, t: eng.now, until: eng.now + 7 + e.tr.CURIOSITY * 5, arrived: 0, ...spatialFields(L) };
  e.inv = { lead: L.id, x: L.x, y: L.y, u: L.u, k: L.k, t: eng.now, c: L.c, ...spatialFields(L) };
  setState(e, S.CURIOUS, 'listen'); e.dbg.hWhy = `investigate anonymous ${L.k}; carrier unidentified`;
  e.dbg.listen = L.k === 'sound' ? 'orienting to anonymous sound' : 'orienting to visible light'; return true;
}
function hLightStep(eng, e, dt) {
  const q = e.hLight, now = eng.now;
  if (now - q.t < .28 || q.arrived) {
    stopMoving(eng, e, dt); faceToward(e, q.x, q.y, dt, 5.5); e.head = Math.sin(e.t * 2) * .3;
    setAct(e, 'listen'); e.dbg.listen = q.arrived ? `${q.k} location checked; listening for a source` : `orienting to ${q.k}`;
  } else {
    setAct(e, ''); e.dbg.listen = ''; goTo(eng, e, q.x, q.y, { every: 1.2, pose:q });
    const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), {});
    if (st === 'arrived' || st === 'nopath' || goalReached(eng,e,q,60)) q.arrived = now;
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
  const age = memAge(e, r, now), d = beliefDistance(e,{x:r.lkx,y:r.lky,...spatialFields(r.spatial)});
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
  for (const a of ps) { let n = 0; for (const b of ps) if (dist(a.x, a.y, b.x, b.y) < 420&&(!eng.geo.spatial||(eng.geo.distance(a,b)<420&&eng.geo.clearRay(eng.geo.eye(a),eng.geo.eye(b))))) n++; if (n > best) best = n; }
  return best;
}
function houndGrowl(eng, e, I = .7, type = 'growl') { if (eng.now - e.growlAt < 2.5) return; e.growlAt = eng.now; eng.sound({ x: e.x, y: e.y, ...(eng.geo.spatial?{z:e.z}:{}), r: 980, I, type, src: -e.id, ent: e.id }); }

/* ROAMING: wander a route of far-apart spots, stopping now and then to listen.  ------------------------------------------------ */
function hRoam(eng, e, dt) {
  const R = e.roam;
  if (e.act === 'listen') {                                               // stands still, head up, hearing sharpened
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 1.7) * .5; if (e.actT > R.listenFor) { setAct(e, ''); R.nextListen = eng.now + rand(e, 6, 15); R.goal = null; }
    return;
  }
  if (e.act === 'rest') { stopMoving(eng, e, dt); if (e.actT > e.rest) { setState(e, S.ROAMING, ''); e.rest = 0; } return; }
  if (eng.now > R.nextListen && e.speed < 140) { setAct(e, 'listen'); R.listenFor = rand(e, 1.6, 3.8); return; }
  if (!R.goal || eng.now > R.until || goalReached(eng,e,R.goal,60)) {
    if (R.goal && e.rng() < .12 && e.tier !== 'near') { setState(e, S.DORMANT, 'rest'); e.rest = rand(e, 8, 20); R.goal = null; return; }
    R.goal = randomFloor(eng, e, 900, 2800) || randomFloor(eng, e, 400, 1600); R.until = eng.now + 40;
    if (R.goal) plan(eng, e, R.goal.x, R.goal.y,{pose:R.goal});
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
    e.search.goal = { x: est.x, y: est.y, k: 'lkp', ...spatialFields(est) }; e.search.est = est; e.search.hd = hd; e.search.sp = sp;
    e.search.lkp = { x: r.lkx, y: r.lky, ...spatialFields(r.spatial) }; e.search.lookAng = hd;
  }
}
/* the places worth looking, scored.  anchor = where the prey most likely is now (memory), heading = which way it was going.
 * Human-QA AI-01: on the first couple of post-loss hypotheses, observed motion has real inertia.  The Hound checks routes that plausibly
 * continue the last visible heading before it entertains a reversal.  This is a prediction only: left/right branches can still be guessed
 * wrong, failed hypotheses lose confidence, and no hidden player position/velocity is consulted. */
function pickSearchGoal(eng, e, s) {
  const r = e.mem.p.get(s.rid), now = eng.now, baseGeo = eng.geo;
  const geo=baseGeo.spatial?baseGeo.forPose(r?estimate(e,r,now,baseGeo):bodyPose(e)):baseGeo;
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
    const c = extra?.spatialNode??geo.cellAt(x, y); if (c < 0 || geo.cls[c] !== 1) { const q = geo.snap(x, y, e.caps, 2); if (q < 0) return; x = geo.cx(q); y = geo.cy(q); }
    for (const v of s.visited) if (Math.hypot(v.x - x, v.y - y) < 230&&(!geo.spatial||verticalCompatible(v,extra||baseEst))) return; // a failed hypothesis is not an endlessly reusable route
    sc -= Math.hypot(x - e.x, y - e.y) * .1 + e.streams.search() * (40 + 90 * (1 - e.tr.INTELLIGENCE));
    sc = habitBias(e, s.rid, x, y, sc);
    if (sc > bs) { bs = sc; best = Object.assign({ x, y, k }, geo.spatial?{...geo.nodePose(c)}:{}, extra || {}); }
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
  // Spatial continuation hypotheses are explicit outgoing links of the last
  // observed sheet. Static connectivity suggests an option, never a hidden route.
  if(geo.spatial){const surface=surfaceOf(geo,baseEst);let count=0;for(const link of geo.geometry.definition.traversalLinks){if(link.fromSurfaceId!==surface||count++>=16)continue;const p=link.exit.reduce((a,b)=>({x:a.x+b.x/link.exit.length,y:a.y+b.y/link.exit.length,z:a.z+b.z/link.exit.length}),{x:0,y:0,z:0});p.navSurfaceId=link.toSurfaceId;const c=geo.rootGeo.snapPose(p,e.caps,2,e.baseShape);if(c<0)continue;const n=geo.nodePose(c),align=Math.cos(angDiff(Math.atan2(p.y-base.y,p.x-base.x),hd));consider(n.x,n.y,140+align*wH,'surface-link',{...n,zMin:n.z,zMax:n.z,supportCandidates:[n.navSurfaceId],unresolved:true,spatialNode:c,via:link.id});}}
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
  goTo(eng, e, s.goal.x, s.goal.y, { every: 1.5, pose:s.goal });
  e.dbg.hWhy = `check ${s.goal.k || 'heard position'} from remembered evidence; heading ${s.hd?.toFixed(2) ?? 'unknown'}`;
  const fresh = clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / (5 + 5 * e.tr.AGGRESSION), 0, 1);     // while the trail is warm it moves like it is still chasing, through the likely routes
  const v = lerp(hSpeed(e, s.why === 'sound' ? 'investigate' : 'search', eng) * (.9 + .3 * e.tr.AGGRESSION), hSpeed(e, 'chase', eng) * .9, s.phase === 'lkp' || s.goal.k === 'continue' || s.goal.k === 'sound' ? fresh : fresh * .5);
  const st = follow(eng, e, dt, v, {});
  e.head = Math.sin(e.t * 1.6) * .35;
  if (st === 'arrived' || st === 'nopath' || goalReached(eng,e,s.goal,50)) {
    const c = eng.geo.cellAt(e.x, e.y); if (c >= 0) e.mem.visited.set(c, now); s.visited.push({ x: s.goal.x, y: s.goal.y, ...spatialFields(s.goal) });
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
  if(eng.geo.spatial&&!spatialDirectOk(eng,e,tgt.x,tgt.y,330,tgt))return false;
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
    if (!pv.alive || pv.caught || (eng.geo.spatial&&!eng.geo.physicalContact(e,pv,e.r+14))) continue;
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
    const tgt = { x: pvT.x, y: pvT.y, vx: pvT.vx, vy: pvT.vy, id: pvT.id, ...spatialFields(pvT) };
    if (lungeCheck(eng, e, r, tgt) && e.rng() < 1 - Math.pow(.04, dt * (1 + e.tr.AGGRESSION))) { startLunge(eng, e, tgt); return; }
    // predicted interception point, but never through walls: plan to it, aim straight when the way is clear
    // Advance only the sampled visible velocity between perception updates. This keeps the
    // prediction continuous without reaching into the live player when an old seen flag persists.
    const chaseD = beliefDistance(e,tgt);
    // Close-range orbit fix: don't lead past somebody who is already beside the Hound.  At this range the job is to reorient physically,
    // not draw a wide interception arc that a walking player can orbit forever.
    const lead = chaseD < 190 ? 0 : clamp(chaseD / 420, 0, .55) * (.5 + e.tr.INTELLIGENCE) + Math.min(.12, Math.max(0, now - pvT.t));
    let LD = Math.hypot(tgt.vx, tgt.vy) * lead; if (LD > 1) LD = Math.max(0, Math.min(LD, (eng.geo.spatial?eng.geo.forPose(tgt):eng.geo).ray(tgt.x, tgt.y, Math.atan2(tgt.vy, tgt.vx), LD + 30) - 26));   // the lead stops at walls: a prey pressed against one is not "ahead" of itself
    const sv = Math.hypot(tgt.vx, tgt.vy) || 1, gx = tgt.x + tgt.vx / sv * LD, gy = tgt.y + tgt.vy / sv * LD;
    if (directOk(eng, e, tgt.x, tgt.y, 620,tgt) && (Math.hypot(gx - tgt.x, gy - tgt.y) < 8 || directOk(eng, e, gx, gy, 700,tgt))) directTo(eng, e, gx, gy,tgt);   // straight at it only when the body itself fits the line (it used to test 16 px: it scraped doorframes)
    else goTo(eng, e, gx, gy, { every: .45, pose:tgt });
    e.dbg.pursuit = { x: gx, y: gy };
  } else {
    // out of sight but not out of hearing: fresh loud footsteps (running, sliding, vaulting) keep the hunt going, aimed where they are heading.
    // Only silence lets the blind clock run at full speed - a prey that goes quiet is the one that gets away.
    const byEar = now - r.hLoud < .9 && now - r.heardAt < .9, justNow = now - r.seenAt < .6;
    e.chaseBlind += dt * (byEar ? .12 : 1);
    // for a moment after losing sight it keeps going for where it last saw it (a flicker at the edge of vision must not swap the goal back and forth)
    const est = justNow ? { x: r.lkx, y: r.lky, ...spatialFields(r.spatial) } : byEar ? { x: r.hx + r.hvx * .35, y: r.hy + r.hvy * .35, ...spatialFields(r.ev.find(q=>q.k==='sound')) } : estimate(e, r, now, eng.geo);
    goTo(eng, e, est.x, est.y, { every: .5, pose:est });
    e.dbg.pursuit = { x: Math.round(est.x), y: Math.round(est.y), blind: +e.chaseBlind.toFixed(1), ear: byEar ? 1 : 0 };
    e.dbg.hWhy = byEar ? 'fresh running sound; follow heard position and heard heading' : 'visual contact lost; predict from last observation';
    if (e.chaseBlind > lerp(1.4, 4.6, e.tr.PERSISTENCE)) { beginSearch(eng, e, r, 'lost'); e.mood.frustration = Math.min(1, e.mood.frustration + .15); return; }
  }
  let chaseV = hSpeed(e, 'chase', eng), turnMul = 1;
  if (seen) {
    const d = beliefDistance(e,pvT), err = Math.abs(angDiff(Math.atan2(pvT.y - e.y, pvT.x - e.x), e.ang));
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
  for (const pv of eng.nearPlayers(e.x, e.y, 50)) if (pv.alive && !pv.caught && (eng.geo.spatial?eng.geo.physicalContact(e,pv,e.r+12):dist(e.x, e.y, pv.x, pv.y) < e.r + 12)) return { pv, dir: e.ang, speed: e.speed };
}

const stalkPatience = e => lerp(4, 15, e.tr.PATIENCE) * (1.15 - e.tr.AGGRESSION * .3);
/* STALKING: it shadows the prey - it matches a walker's pace so the prey never simply walks away from it, holds back at a distance
 * while the prey stands still, and creeps a little closer the longer it watches, until it commits (or the prey gives it a reason to). */
function hStalk(eng, e, dt, thinkNow) {
  const r = e.mem.p.get(e.target);
  if (!r || tgtGone(eng, e, r)) { beginSearch(eng, e, r, 'lost'); return; }
  const P = hPerceived(eng, e, r), seen = P.seen, est = P, d = beliefDistance(e,est);
  e.stalkFor = (e.stalkFor || 0) + dt;
  const gazed = seen && hPreGaze(eng, e, r, dt);                         // only before pursuit; finite and still physically advancing
  goTo(eng, e, est.x, est.y, { every: .6, pose:est });
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
    if (value > score) { score = value; seen = r; sd = beliefDistance(e,{x:r.lkx,y:r.lky,...spatialFields(r.spatial)}); }
  }
  // Seeing both prey is no reason to flicker between them. Finish the current pursuit.
  if (current && current.seen && !tgtGone(eng, e, current)) { seen = current; sd = beliefDistance(e,current.visual); }
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
      if (e.rng() < .55 + e.tr.SOCIAL * .4) { beginSearch(eng, e, null, 'sound'); e.search.goal = { x: h.x, y: h.y, k: 'sound', ...spatialFields(h) }; e.search.first = false; setAct(e, ''); }
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
      if (loud && e.rng() < .55 + e.tr.AGGRESSION * .35) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(e, .35, .85) * (1.2 - e.tr.AGGRESSION * .5), rid: h.src, toward: { x: h.x, y: h.y, ...spatialFields(h) } }; }
      else if (h.I > .12) { setState(e, S.CURIOUS, 'freeze'); e.cur = { until: now + rand(e, .6, 1.5), toward: { x: h.x, y: h.y, ...spatialFields(h) }, n: 0, rid: h.src }; }
    } else if ((e.state === S.SEARCHING || e.state === S.FRUSTRATED) && loud && r.conf > .2 && dist(e.x, e.y, h.x, h.y) < 1000 && (!e.search || !e.search.rid || e.search.rid === r.id || !e.mem.p.get(e.search.rid)?.conf)) {
      beginHunt(eng, e, r, 'heard-run'); e.dbg.reacquired = (e.dbg.reacquired || 0) + 1;                       // it heard the prey running: no new detection needed
    } else if (e.state === S.SEARCHING || e.state === S.FRUSTRATED) {
      if (h.I > .1) { const s = e.search; if (e.state === S.FRUSTRATED) beginSearch(eng, e, r, 'sound'); else { e.search.why = 'sound'; } e.search.goal = { x: h.x, y: h.y, ...spatialFields(h) }; e.search.phase = 'go'; e.search.until = Math.max(e.search.until, now + 10); setAct(e, ''); if (loud && r.st === 2) beginHunt(eng, e, r, 'heard-run'); }
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
      if (e.hear && e.hear.t > c.until - 1.5 && e.hear.t > (c.seenT || 0) && e.hear.src >= 0) { c.seenT = e.hear.t; c.n++; if (c.n >= 1 && e.hear.I > .2) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(e, .3, .7), rid: e.hear.src, toward: { x: e.hear.x, y: e.hear.y, ...spatialFields(e.hear) } }; break; } }
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
        beginSearch(eng, e, r, 'sound'); e.search.goal = { x: a.toward.x, y: a.toward.y, ...spatialFields(a.toward) }; e.search.first = false; setAct(e, '');
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
    if (!tgtGone(eng, e, r)) { const P = hPerceived(eng, e, r); goTo(eng, e, P.x, P.y, { every: .4, pose:P }); /* (v23) where it believes the intruder is */ follow(eng, e, dt, hSpeed(e, 'chase', eng) * .9, { arrive: 10 }); for (const p of eng.nearPlayers(e.x, e.y, 50)) if (p.alive && !p.caught && (eng.geo.spatial?eng.geo.physicalContact(e,p,e.r+12):dist(e.x, e.y, p.x, p.y) < e.r + 12)) return { pv: p, dir: e.ang, speed: e.speed }; }
    else F.guard = null;
    return;
  }
  if (!F.at) { goTo(eng, e, s.x, s.y, { every: 1.4, pose:s }); const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), { arrive: 34 }); if (dist(e.x, e.y, s.x, s.y) < 60 || st === 'arrived') { F.at = true; setAct(e, 'feed'); } return; }
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
  goTo(eng, e, R.goal.x, R.goal.y, { every: 1.2, pose:R.goal }); follow(eng, e, dt, hSpeed(e, 'retreat', eng), {}); e.head = Math.sin(e.t * 6) * .3;
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
function sLit(eng, e) { const lamp = eng.geo.lightLevel(e.x, e.y, null,e), beam = e.flashAt !== undefined && eng.now - e.flashAt < .6 ? .85 : 0; return Math.max(lamp, beam); }
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
    if (sc > bs) { bs = sc; best = geo.spatial?geo.nodePose(c):{ x, y }; }
  }
  return best;
}
/* ---------------------------------------------------------------- transitions (each one says why: debug) */
function beginHidden(eng, e, why) { setState(e, S.HIDDEN, 'lurk'); e.goalS = null; e.lurkT = 0; e.watchT = 0; sFace(e, .25); sWhy(eng, e, why || 'waiting in the dark'); }
function beginDrawn(eng, e, g, why, fast) {
  setState(e, S.FOLLOWING, fast ? 'search' : 'drawn'); e.goalS = { x: g.x, y: g.y, u: g.u || 120, k: g.k || 'lead', lead: g.lead || 0, t0: eng.now, phase: 'go', legs: 0, maxLegs: 1 + Math.round(e.pz.persistence * 2), pause: 0, fast: !!fast, dir: g.dir, off: g.off, ...spatialFields(g) };
  plan(eng, e, g.x, g.y,{pose:g}); sFace(e, .45); sWhy(eng, e, why);
}
function beginWatch(eng, e, r, why) { setState(e, S.WATCHING, 'watch'); setTarget(e, r.id, eng.now); e.watchT = 0; e.lostT = 0; e.holdT = 0; sFace(e, 1); sWhy(eng, e, why); }
function beginStalk(eng, e, r, why) { beginChase(eng, e, r, why || 'debug'); }              // (engine debug command name kept)
function beginChase(eng, e, r, why) { setState(e, S.PROVOKED, 'chase'); setTarget(e, r.id, eng.now); e.chaseBlind = 0; e.lightOff = 0; e.chaseT = 0; sFace(e, 1); sWhy(eng, e, why); }
function beginStrike(eng, e, r, why) { setState(e, S.ATTACKING, 'rush'); setTarget(e, r.id, eng.now); e.strikeT = 0; sFace(e, 1); e.ag = Math.max(e.ag, .8); sWhy(eng, e, why); e.dbg.strikes = (e.dbg.strikes | 0) + 1; }
function beginWithdraw(eng, e, why, dir) {
  const g = darkSpot(eng, e, 380, 1000, e, dir) || darkSpot(eng, e, 200, 700, e);
  if (!g) { beginHidden(eng, e, why); return; }
  setState(e, S.DISAPPEARING, 'fade'); e.goalS = { x: g.x, y: g.y, t0: eng.now, ...spatialFields(g) }; plan(eng, e, g.x, g.y,{pose:g}); sFace(e, 0); sWhy(eng, e, why);
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
  const P = perc(eng, e, r), d = beliefDistance(e,P);
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
  const now = eng.now, P = perc(eng, e, r), d = beliefDistance(e,P);
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
    const P = perc(eng, e, r), d = beliefDistance(e,P);
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
    if (e.state === S.HIDDEN || e.state === S.FOLLOWING || e.state === S.DISAPPEARING) { beginDrawn(eng, e, { x: nz.h.x, y: nz.h.y, u: nz.h.unc, k: 'sound', ...spatialFields(nz.h) }, `a loud ${nz.h.type} nearby`, true); return; }
  }
  switch (e.state) {
    case S.HIDDEN: case S.DORMANT: {
      e.lurkT += tdt;
      const r = sChoose(eng, e); if (r && r.seen) { beginWatch(eng, e, r, `P${r.id} in view${r.light ? ' with a light' : ''}`); return; }
      const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead);
      if (L && L.c * (.5 + L.sal) >= Pm.leadMin) { beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, ...spatialFields(L), dir: L.dir }, `drawn to a ${L.k} lead (±${Math.round(L.u)} px)`); return; }
      if (nz && nz.weak && nz.d < 900 && nz.h.I > .15 && e.rng() < .35 * e.pz.curiosity) { beginDrawn(eng, e, { x: nz.h.x, y: nz.h.y, u: nz.h.unc, k: 'sound', ...spatialFields(nz.h) }, `a ${nz.h.type} it heard`); return; }
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
      if (L && L.id !== G.lead && now - L.t < .5 && L.c * (.5 + L.sal) > Pm.leadMin * 1.3) { beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, ...spatialFields(L), dir: L.dir, off: G.off }, `a fresher ${L.k} lead`); return; }
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
        if (e.lostT > 1.5) { const est = estimate(e, r, now, eng.geo); beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost', ...spatialFields(est) }, `lost sight of P${r.id}: goes where it thinks they went (±${Math.round(est.unc)} px)`); }
        return;
      }
      e.lostT = 0;
      // canon: light is what draws it.  A fresh light somewhere else (a lead it observed - not a person it knows) pulls it off somebody it is
      // only watching in the dark, unless that somebody holds it with their eyes (the counterplay: one player holds it while another moves)
      if (!r.light && !watcher(e) && e.watchT > 2 && !(e.pulledOff && e.pulledOff.id === r.id && now - e.pulledOff.t < 15)) {   // (once per person in a while: no back-and-forth)
        const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead), P = perc(eng, e, r);
        if (L && now - L.t < .5 && L.c * (.5 + L.sal) >= Pm.leadMin * 1.3 && Math.hypot(L.x - P.x, L.y - P.y) > L.u + 150) {
          beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, ...spatialFields(L), dir: L.dir, off: r.id }, `a light elsewhere drew it off P${r.id} (${L.k}, ±${Math.round(L.u)} px)`); e.pulledOff = { id: r.id, t: now }; return;
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
        if (e.chaseBlind > Pm.blind) { const est = estimate(e, r, now, eng.geo); e.grace = now + 3; beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost', ...spatialFields(est) }, `lost P${r.id} in the chase: searches where they might be (±${Math.round(est.unc)} px)`, true); e.dbg.ab = `chase of P${r.id}: lost sight @${now.toFixed(0)}`; return; }
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
        else { const est = estimate(e, r, now, eng.geo); beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost', ...spatialFields(est) }, `missed P${r.id} and lost sight`, true); }
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
        if (st === 'arrived' || st === 'nopath' || goalReached(eng,e,G,40)) { G.phase = 'look'; G.pause = 0; setAct(e, 'search'); }
      } else if (G.phase === 'look') {
        stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.2) * .7; G.pause += dt;
        if (G.pause > lerp(1, 2.2, e.pz.patience)) {
          if (G.legs >= G.maxLegs) { beginWithdraw(eng, e, `looked at the ${G.k} and found nobody: it was wrong`); return null; }
          // a likely opening from here: the open directions, the one the light came from first (if it knows), not the way it came
          let best = null, bs = -1e9; const back = G.x0 !== undefined ? Math.atan2(G.y0 - e.y, G.x0 - e.x) : e.ang + Math.PI;
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, L = eng.geo.ray(e.x, e.y, a, 520); if (L < 200) continue; let sc = Math.min(L, 520) * .3 + (G.dir !== undefined ? Math.cos(angDiff(a, G.dir)) * 120 : 0) - (Math.cos(angDiff(a, back)) > .7 ? 150 : 0) + e.streams.search() * 90; if (G.k === 'lost') sc = habitBias(e, e.target, e.x + Math.cos(a)*300, e.y + Math.sin(a)*300, sc); if (sc > bs) { bs = sc; best = a; } }
          G.legs++; if (best === null) { beginWithdraw(eng, e, `nowhere to look from the ${G.k}`); return null; }
          const D = Math.min(380, eng.geo.ray(e.x, e.y, best, 420) - 40); G.x0 = e.x; G.y0 = e.y; G.x = e.x + Math.cos(best) * D; G.y = e.y + Math.sin(best) * D; G.phase = 'go'; plan(eng, e, G.x, G.y,{pose:eng.geo.spatial?bodyPose(e):G}); setAct(e, 'search');
          sWhy(eng, e, `searching from the ${G.k}: leg ${G.legs}/${G.maxLegs}`);
        }
      }
      return null;
    }
    case S.WATCHING: {
      const r = e.target > 0 ? e.mem.p.get(e.target) : null; if (!r) { stopMoving(eng, e, dt); return null; }
      const P = perc(eng, e, r), d = beliefDistance(e,P);
      faceToward(e, P.x, P.y, dt, 2.2); e.head = 0;
      if (!r.seen) { stopMoving(eng, e, dt); setAct(e, 'wait'); return null; }
      const held = heldBy(e, r.id), other = !held && watcher(e);
      if (held) {
        const retreating = (r.dRate || 0) > 25;
        // The longer somebody stands still and stares, the more demanding the hold becomes: the face closes some distance and its lateral
        // drift gets faster/less comfortable.  This never invents a timer-based attack; panic/noise/light rules still own aggression.
        const pressure = clamp((e.holdT - 2) / 10, 0, 1), holdR = Pm.loom;
        const creepV = sp.creep * lerp(1, 1.25, pressure), driftV = sp.drift * lerp(1, 2.05, pressure);
        if (!retreating && d > holdR + 12) { setAct(e, 'creep'); goTo(eng, e, P.x, P.y, { every: .45, pose:P }); follow(eng, e, dt, creepV, { arrive: holdR, turnMul: 1 + pressure * .25 }); }
        else if (!retreating) {                                                  // held up close: increasingly active lateral drift forces reacquisition, but its own movement never becomes a proximity attack
          setAct(e, 'drift'); e.driftT -= dt; if (e.driftT <= 0) { e.driftT = rand(e, lerp(1.5, .75, pressure), lerp(3.5, 1.7, pressure)); e.drift = -e.drift; }
          const a = Math.atan2(e.y - P.y, e.x - P.x) + e.drift * dt * (driftV / Math.max(70, d)), rd = Math.max(holdR, d), tx = P.x + Math.cos(a) * rd, ty = P.y + Math.sin(a) * rd;
          if (eng.geo.clear(tx, ty, e.rc, 'walk')) { e.moved = moveCollide(eng, e, tx - e.x, ty - e.y); e.speed = Math.min(driftV, e.moved / Math.max(dt, 1e-4)); } else { e.drift = -e.drift; stopMoving(eng, e, dt); }
        } else { setAct(e, 'hold'); stopMoving(eng, e, dt); }
        return null;
      }
      const want = e.ag < .4 ? Pm.watchD : Pm.loom, go = e.act === 'watch' ? d > want + 8 : d > want + 60;    // (hysteresis: no stop-start at the edge)
      if (go) { setAct(e, 'watch'); goTo(eng, e, P.x, P.y, { every: .6, pose:P }); follow(eng, e, dt, sp.approach * (other ? .4 : 1), { arrive: want }); }
      else { setAct(e, 'stare'); stopMoving(eng, e, dt); }
      return null;
    }
    case S.PROVOKED: case S.ATTACKING: {
      const r = e.target > 0 ? e.mem.p.get(e.target) : null; if (!r) { stopMoving(eng, e, dt); return null; }
      const P = perc(eng, e, r), v = e.state === S.ATTACKING ? sp.rush : sp.chase;
      if (r.seen && directOk(eng, e, P.x, P.y, 900,P)) directTo(eng, e, P.x, P.y,P); else goTo(eng, e, P.x, P.y, { every: .4, pose:P });
      follow(eng, e, dt, v, { arrive: 8, noSlow: false });
      const body = touching(eng, e, r.id, e.r + 15);
      if (body) return { pv: body, dir: e.ang, speed: e.speed, style: e.state === S.ATTACKING ? 'rush' : 'chase' };
      return null;
    }
    case S.DISAPPEARING: {
      const G = e.goalS; if (!G) { beginHidden(eng, e); return null; }
      const st = follow(eng, e, dt, sp.retreat, { arrive: 24 });
      if (st === 'arrived' || st === 'nopath' || goalReached(eng,e,G,34)) beginHidden(eng, e, 'back in the dark');
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
  const seed = (cfg.seed ?? 1) >>> 0, rng = mkRng(deriveSeed(seed, 'world'));
  const eng = {
    rng, seed, geo: new Geo(cfg.adapter), now: 0, ticks: 0, entities: [], nextId: 1, caps: [], capId: 0, sites: [], recentKills: {}, pressure: 0,
    events: [], sounds: [], pl: [], byId: new Map(), hash: new Hash(), lights: [], pst: new Map(), packT: 0,
    stats: { sense: 0, paths: 0, sounds: 0, capture: 0 },
    debugOn: false, forceCapture: null, log: [], logSeq: 0,
  };
  const geo = eng.geo;
  if(geo.spatial){eng.motion=MOTION.create(geo.geometry);const contexts=new WeakMap();eng.entityContext=e=>{let c=contexts.get(e);if(!c){c=Object.create(eng);Object.defineProperty(c,'capId',{get:()=>eng.capId,set:v=>{eng.capId=v;}});c.geo=geo.forActor(e);c.actor=e;c.placementOk=(x,y)=>{for(const r of e.mem.p.values()){const p=r.seen?r.visual:null;if(!p)continue;const q=localPose(geo,bodyPose(e),x,y,e.baseShape);if(!q||!verticalCompatible({zMin:q.z,zMax:q.z,supportCandidates:[q.navSurfaceId]},p))continue;const d=Math.hypot(x-p.x,y-p.y);if(d<220||(d<650&&Math.abs(angDiff(Math.atan2(y-p.y,x-p.x),p.angle))>2.3))return false;}return true;};contexts.set(e,c);}return c;};}
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
    geo.fails.push({ x, y, r, until: this.now + dur, ...(geo.spatial&&this.actor?{z:this.actor.z}:{}) });
    this.emit({ t: 'lightfail', x, y, r, dur });
  };
  eng.blackout = () => geo.a.blackout();
  eng.commitEnd = function (pid, x, y, a) { return commitEnd(this, pid, x, y, a); };

  /* ------------------------------------------------------------ the sound bus: an event goes to every entity once; each decides what it makes of it */
  eng.sound = function (ev) {
    this.stats.sounds++;
    if (ev.ent) this.sounds.push([ev.type, Math.round(ev.x), Math.round(ev.y), +ev.I.toFixed(2), ev.ent]);       // entity sounds are also for the players' ears
    for (const e of this.entities) {
      if (e.id === ev.ent || (!geo.spatial&&e.tier === 'far')) continue;
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
          eng.sound({ x: p.x, y: p.y, ...(geo.spatial?{z:p.z}:{}), r: NZ[d.r] * (d.k || 1) * surf.step, I: d.I * (.6 + .4 * v / 100), type: d.type, src: p.id, st: p.st, vx: p.vx, vy: p.vy });
        }
      }
      if (!p.alive) continue;
      const st = p.st | 0, sp = p.sp || Math.hypot(p.vx, p.vy);
      if (p.caught) {                                                          // struggling under something
        s.str -= dt; if (s.str <= 0) { s.str = .9; eng.sound({ x: p.x, y: p.y, ...(geo.spatial?{z:p.z}:{}), r: 320, I: .5, type: 'struggle', src: p.id, st }); }
        continue;
      }
      if (STRIDE[st] && sp > 10) {
        s.d += sp * dt;
        if (s.d >= STRIDE[st]) {
          s.d -= STRIDE[st];
          const surf = WORLD.SURF[geo.surface(p.x, p.y)] || WORLD.SURF.carpet;
          const base = st === 1 ? NZ.walk : st === 2 ? NZ.run : st === 3 ? NZ.crouchMove : NZ.crawl, I = st === 1 ? .42 : st === 2 ? .9 : st === 3 ? .14 : .16;
          eng.sound({ x: p.x, y: p.y, ...(geo.spatial?{z:p.z}:{}), r: base * surf.step, I, type: W_SN[st], src: p.id, st, vx: p.vx, vy: p.vy });
        }
      } else if (st === 5) {                                                    // the drag of a slide
        s.sl -= dt; if (s.sl <= 0) { s.sl = .3; eng.sound({ x: p.x, y: p.y, ...(geo.spatial?{z:p.z}:{}), r: NZ.slide * .6, I: .5, type: 'slide', src: p.id, st, vx: p.vx, vy: p.vy }); }
      }
      // ragged breathing: an exhausted player is audible even standing still, but only close by, and hard to pin down
      const need = p.ex ? 1 : p.stamina < 26 ? .45 : 0;
      if (need > 0) { s.br -= dt; if (s.br <= 0) { s.br = p.ex ? 1.4 : 2.3; eng.sound({ x: p.x, y: p.y, ...(geo.spatial?{z:p.z}:{}), r: NZ.exhaled * need, I: .35 + .15 * need, type: 'breath', src: p.id, st }); } }
    }
  }

  /* ------------------------------------------------------------ spawning */
  eng.spawn = function (kind, x, y, opts) {
    const id = opts && opts.id !== undefined ? opts.id : this.nextId; if (!Number.isSafeInteger(id) || id < 1 || this.entities.some(e => e.id === id)) throw Error('invalid/duplicate entity id'); this.nextId = Math.max(this.nextId, id + 1);
    const e = mkEntity(this, kind, id, x, y, opts || {});
    e.tierT = 0; e.senseDt = 0; e.wd = { x, y, t: 0 }; this.entities.push(e);
    return e;
  };
  eng.interruptTraversal=function(e,reason='external interruption'){if(!geo.spatial||!e.trav)return false;const t=e.trav;t.status='interrupted';e.resumeTraversal={link:t.link,reason};e.linkHistory.push({id:t.link.id,t:this.now,event:'interrupted',reason,z:e.z});if(e.linkHistory.length>32)e.linkHistory.shift();e.trav=null;e.path=[];e.pathAge=99;e.speed=e.vx=e.vy=0;navOf(e).recover++;return true;};
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
    const cands = geo.spatial||e.tier === 'near' ? eng.candidates(e, 1750) : [];
    updateVision(e, eng, dt, cands);
    if (geo.spatial||e.tier === 'near') lightSense(eng, e);                          // (Part 2 / 2C) visible light as evidence, 4 Hz, near tier only
    decayMemory(e, dt, eng.now);
    cleanupKnowledge(eng, e);
    e.mem.p = new Map([...e.mem.p].sort((a,b) => a[0]-b[0]));
    arbitrateEvidence(eng, e);
    moodTick(e, dt);
  }
  function onTier(e, nt) {
    if(geo.spatial&&(e.trav||e.step||e.motionMode!=='grounded'))return;
    const was = e.tier; e.tier = nt;
    if (nt === 'far') {e.farSince = eng.now;e.seenNow.clear();for(const r of e.mem.p.values())r.seen=false;}
    if (was === 'far' && e.farSince !== undefined) { e.farSince = undefined; }     // a sleeper's memory of the last hours fades all the same
    if (nt === 'far' && (e.state === S.HUNTING || e.state === S.SEARCHING || e.state === S.STALKING)) e.dbg.disengage = 'lost track: the prey is far out of range';
    if (nt === 'far' && !e.cap) { e.path = []; e.trav = null; e.lunge = null; e.speed = 0; if (e.kind === 'hound') { if (e.state !== S.DORMANT) { setState(e, S.DORMANT); if (e.roam) e.roam.goal = null; } e.farT = 0; } else if (e.state !== S.HIDDEN) beginHidden(eng, e); }
    if (was === 'far' && nt !== 'far') { e.wake = 1; e.thinkT = 0; if (e.state === S.DORMANT && e.kind === 'hound') setState(e, S.ROAMING); }
  }
  function farStep(e, dt) {
    if(geo.spatial){const ctx=eng.entityContext(e);e.passiveT=(e.passiveT||0)-dt;if(e.passiveT<=0){e.passiveT=.5;sense(e,.5);}if(e.kind==='hound'){e.farT=(e.farT||0)-dt;if(!e.path.length&&e.farT<=0){const g=randomFloor(ctx,e,400,1600);if(g)plan(ctx,e,g.x,g.y,{pose:g});e.farT=rand(e,3,12);}coarseMove(ctx,e,dt);}if(e.physTick!==eng.ticks)spatialMove(ctx,e,0,0);return;}
    e.speed = 0; if (e.cap) return;
    if (e.kind === 'hound') {
      e.farT = (e.farT || 0) - dt;
      if (!e.path.length && e.farT <= 0) { const g = randomFloor(eng, e, 900, 2800); if (g) plan(eng, e, g.x, g.y); e.farT = rand(e, 3, 12); }
      coarseMove(eng, e, dt);
    }
  }
  /* an entity that has not gone anywhere for a long while is stuck: set it back on open floor and let it think again */
  function watchdog(e, dt) {
    if(geo.spatial)return spatialWatchdog(eng,e,dt);
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
      if(geo.spatial&&(geo.distance(a,b)>760||!geo.clearRay(geo.eye(a),geo.eye(b))))continue;
      const id = Math.min(a.id, b.id, fresh.get(a) || 1e9, fresh.get(b) || 1e9); fresh.set(a, id); fresh.set(b, id);
    }
    for (const h of hs) {
      const f = fresh.get(h);
      if (f) { h.pack = f; h.packOld = f; h.packUntil = now + 7; }
      else if (h.packUntil > now && h.packOld && up(h) && hs.some(o => o !== h && o.packOld === h.packOld && o.packUntil > now && up(o)&&(!geo.spatial||geo.clearRay(geo.eye(h),geo.eye(o))))) h.pack = h.packOld;
      else h.pack = 0;
    }
  }

  eng.step = function (dt) {
    if(geo.spatial&&Math.abs(dt-1/60)>1e-7)throw Error('Spatial AI requires fixed 1/60 timestep');
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
      const context=geo.spatial?this.entityContext(e):this;
      const res = e.sp.tick(context, e, dt, thinkNow);
      if(geo.spatial&&e.physTick!==this.ticks){if(e.trav)spatialStepTrav(context,e,dt);else spatialMove(context,e,0,0);}
      if (res && res.pv && res.pv.alive && !res.pv.caught && !e.cap && (!geo.spatial||geo.physicalContact(e,res.pv,e.r+15))) { this.stats.capture++; beginCapture(context, e, res.pv, { dir: res.dir, speed: res.speed, style: res.style }); }
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
      if (d >= want || (geo.spatial&&!geo.physicalContact(a,b,want))) continue;
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
    else { beginDrawn(this, e, { x: tx, y: ty, u: 160, k: 'summon' }, 'admin summon: a lead at the admin'); }
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
        intel: intelligenceDebug(this, e),
      });
    }
    return out;
  };
  return eng;
}
return { create, S, SNAMES, SCODE, HACT, SACT, TRAITS, SPECIES, HOUND, SMILER, mkRng, deriveSeed, Geo, hearEvent, TIER, INTEL, evidenceCandidates, observationScore, habitObserve, cleanHabits, habitBias, arbitrateEvidence };
});
