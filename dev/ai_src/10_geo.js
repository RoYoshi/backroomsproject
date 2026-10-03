
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
    this.heap = new Int32Array(this.N + 8); this.hf = new Float32Array(this.N);
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
  lightLevel(x, y, players) {                  // 0..1: how lit a point is (lamps, blackout, local failures, players' own lights)
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
    return [this.geometry.identity.contentHash,this.topologyRevision,surface(start),surface(goal),p?.id,p?.radius,p?.height,!!caps.CAN_CRAWL,!!caps.CAN_USE_TIGHT_GAPS,!!caps.CAN_VAULT,caps.VAULT_SPEED,Math.round(goal.x/48),Math.round(goal.y/48)].join('/');
  }
  spatialEdges(i,caps,profile) {
    const p=this.profile(caps,profile), out=[];
    for(const edge of this.edges[i]) {
      this.navStats.edgeChecks++;
      if(!this.passableFor(edge.to,caps,p))continue;
      if(edge.corners?.some(j=>!this.passableFor(j,caps,p)))continue;
      const link=edge.link;
      if(link && (!link.profileIds.includes(p.id) || link.kind==='crawl'&&!caps.CAN_CRAWL || link.kind==='vault'&&!caps.CAN_VAULT || link.capabilityFlags.includes('tight-gap')&&!caps.CAN_USE_TIGHT_GAPS))continue;
      const key=[i+'>'+edge.to,p.id,p.radius,p.height,p.maxSlopeDegrees,p.maxStepRise,!!caps.CAN_CRAWL,caps.VAULT_SPEED].join('/');
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
