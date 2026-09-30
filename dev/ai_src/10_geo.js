
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
