/* world.js - Level 0 props, surfaces and shared movement constants (v16).
 * Loaded by the browser as a classic script (window.WORLD) and by the server with require().
 * The Level 0 map itself still lives in the game bundle / sim.js; this file only adds the things a
 * survival-movement system needs: a handful of low obstacles you can vault, furniture you can crawl under,
 * holes in the partition walls you can crawl through, pass-through windows, and floor surfaces.
 * Stage 3B-L QA1: also where Level 0's working ceiling fixtures are (W.lamps), for the client and the server alike. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WORLD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = 96;
  /* type: low    - waist-high obstacle, vaulted (or walked around). conceal: a crouching player behind it is hidden
   *       under  - raised furniture: blocks standing/walking, a crouching player crawls beneath, a slider slips under
   *       gap    - damaged wall: a one-tile hole only a crawler fits through (the wall cell is carved open)
   *       window - pass-through opening in a partition wall with a sill you have to vault (the wall cell is carved open)
   * Coordinates are tile cells; rect() turns them into pixels. */
  const DEF = [
    { id: 'L1', type: 'low', kind: 'counter', tx: 17, ty: 34, tw: 3, th: 1, depth: 48, conceal: true },
    { id: 'L2', type: 'low', kind: 'shelf', tx: 40, ty: 34, tw: 3, th: 1, depth: 44, conceal: true },
    { id: 'L3', type: 'low', kind: 'lowwall', tx: 64, ty: 33, tw: 1, th: 3, depth: 40, conceal: true },
    { id: 'L4', type: 'low', kind: 'counter', tx: 34, ty: 10, tw: 3, th: 1, depth: 48, conceal: true },
    { id: 'L5', type: 'low', kind: 'railing', tx: 83, ty: 32, tw: 1, th: 3, depth: 14, conceal: false },
    { id: 'L6', type: 'low', kind: 'counter', tx: 35, ty: 54, tw: 3, th: 1, depth: 48, conceal: true },
    { id: 'L7', type: 'low', kind: 'lowwall', tx: 60, ty: 57, tw: 1, th: 3, depth: 40, conceal: true },
    { id: 'L8', type: 'low', kind: 'machine', tx: 81, ty: 56, tw: 3, th: 1, depth: 62, conceal: false },
    { id: 'U1', type: 'under', kind: 'table', tx: 12, ty: 52, tw: 3, th: 1, depth: 62, conceal: false },
    { id: 'U2', type: 'under', kind: 'bench', tx: 50, ty: 37, tw: 3, th: 1, depth: 46, conceal: false },
    { id: 'G1', type: 'gap', kind: 'hole', tx: 9, ty: 31, tw: 1, th: 1, axis: 'x' },
    { id: 'G2', type: 'gap', kind: 'hole', tx: 37, ty: 29, tw: 1, th: 1, axis: 'x' },
    { id: 'G3', type: 'gap', kind: 'hole', tx: 61, ty: 31, tw: 1, th: 1, axis: 'x' },
    { id: 'G4', type: 'gap', kind: 'hole', tx: 28, ty: 13, tw: 1, th: 1, axis: 'y' },
    { id: 'G5', type: 'gap', kind: 'hole', tx: 86, ty: 33, tw: 1, th: 1, axis: 'x' },
    { id: 'G6', type: 'gap', kind: 'hole', tx: 33, ty: 53, tw: 1, th: 1, axis: 'x' },
    { id: 'W1', type: 'window', kind: 'window', tx: 30, ty: 38, tw: 1, th: 1, axis: 'x', depth: 40, conceal: false },
    { id: 'W2', type: 'window', kind: 'window', tx: 79, ty: 41, tw: 1, th: 1, axis: 'x', depth: 40, conceal: false },
  ];

  const PROPS = DEF.map(d => {
    const cellRect = { x: d.tx * T, y: d.ty * T, w: d.tw * T, h: d.th * T };
    let r;
    if (d.type === 'gap') r = cellRect;
    else if (d.type === 'window') {
      // a sill across the middle of the opening (the wall is 1 tile thick; the sill is a slab through its centre)
      r = d.axis === 'x' ? { x: cellRect.x + (T - d.depth) / 2, y: cellRect.y, w: d.depth, h: T } : { x: cellRect.x, y: cellRect.y + (T - d.depth) / 2, w: T, h: d.depth };
    } else if (d.tw >= d.th) r = { x: cellRect.x + 8, y: cellRect.y + (T - d.depth) / 2, w: cellRect.w - 16, h: d.depth };
    else r = { x: cellRect.x + (T - d.depth) / 2, y: cellRect.y + 8, w: d.depth, h: cellRect.h - 16 };
    const p = Object.assign({}, d, { rect: r, cell: cellRect, cx: r.x + r.w / 2, cy: r.y + r.h / 2 });
    // the axis a vaulter/crawler crosses along: across the thin side of the rect
    p.cross = d.type === 'gap' || d.type === 'window' ? d.axis : (r.w >= r.h ? 'y' : 'x');
    p.conceal = !!d.conceal;
    return p;
  });
  const LOW = PROPS.filter(p => p.type === 'low' || p.type === 'window');
  const UNDER = PROPS.filter(p => p.type === 'under');
  const GAPS = PROPS.filter(p => p.type === 'gap');

  /* which props block movement right now depends on how low the mover is:
   *   walk  - everything blocks (standing, walking, running)
   *   under - furniture can be slid / crawled under, wall holes still block (a hound on all fours, a sliding player)
   *   crawl - crouched crawlers get through wall holes and under furniture */
  const W = { T, PROPS, LOW, UNDER, GAPS, mode: 'walk' };
  W.setMode = m => { W.mode = m; };
  W.blocks = p => W.mode !== 'any' && (p.type === 'low' || p.type === 'window' || (p.type === 'under' && W.mode === 'walk') || (p.type === 'gap' && W.mode !== 'crawl'));      // 'any': only walls and full-height furniture (the server's movement check)

  /* add prop rects near (x,y) to a list of blocking rects (called from the game's / sim's Bc) */
  W.addNear = function (list, x, y) {
    for (let i = 0; i < PROPS.length; i++) {
      const p = PROPS[i], r = p.rect;
      if (x < r.x - 250 || x > r.x + r.w + 250 || y < r.y - 250 || y > r.y + r.h + 250) continue;
      if (W.blocks(p)) list.push(r);
    }
    return list;
  };
  /* open the wall cells that gaps and windows sit in */
  W.carve = function (kc, width) { for (const p of PROPS) if (p.type === 'gap' || p.type === 'window') kc[p.ty * width + p.tx] = 1; };

  /* CEILING FIXTURES (Stage 3B-L QA1) - the one place that says where Level 0 has a working fluorescent fixture.  The game
   * bundle (its lamp list Fc: the fixture housings, BR-RoLE's light, light.js and Ul(), the lamp hum) and sim.js (the
   * server AI's lamp field and light level) both build their lamp list here, from the same map, so every fixture that
   * lights the screen is a fixture gameplay knows about, and gameplay knows of no fixture that is not drawn.
   *   rooms    the game's room table (Oc, cells); index 6 is the BLACKOUT ZONE: its power has failed, no working fixture
   *   floor    (cx, cy) => whether a cell is open floor (the game's kc after its partitions, doorways and carved holes)
   *   pillars  the game's pillar rects (Pc, px);  cols, rows: the grid's size in cells
   * The list starts with the original grid, in its original order (every 5 cells from a room's corner + 2; the indices
   * keep their meaning: every 13th is an old, dim tube), the fixtures that sat inside PILLAR HALL's pillars moved one cell
   * off them (a ceiling fixture lights a pillar's face, not its inside).  Then the added fixtures: a second, staggered grid
   * in every working room (each one a cell either way of the stagger, about 1 in 7 missing; DAMP ROOMS keeps more of its
   * gaps) and a line of fixtures down every corridor (a missing one now and then).  None within `clear` cells of the
   * BLACKOUT ZONE, so it and its approaches stay genuinely unlit; none in a doorway or a hole in a wall, on a pillar, or
   * closer than `minCells` to another fixture.  Deterministic: the same list on every load, client and server. */
  const LAMPS = { step: 5, gap: .14, gaps: { 'DAMP ROOMS': .4 }, minCells: 2.2, clear: 7.5, corridorStep: 4, corridorGap: .14 };
  const unit = (a, b, c) => {                                   // a deterministic value in [0, 1) for three integers
    let h = Math.imul(a + 0x632be5ab, 0x9e3779b1) ^ Math.imul(b + 0x2c1b3c6d, 0x85ebca77) ^ Math.imul(c + 0x297a2d39, 0xc2b2ae3d);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  W.LAMPS = LAMPS;
  W.lamps = function (rooms, floor, pillars, cols, rows) {
    const out = [], P = pillars || [], bo = rooms[6], at = (n, r) => ({ x: (n + .5) * T, y: (r + .5) * T }), fl = (n, r) => !!floor(n, r);
    const onPillar = (n, r, pad) => { const x = (n + .5) * T, y = (r + .5) * T; return P.some(p => x > p.x - pad && x < p.x + p.w + pad && y > p.y - pad && y < p.y + p.h + pad); };
    const passage = (n, r) => (!fl(n - 1, r) && !fl(n + 1, r)) || (!fl(n, r - 1) && !fl(n, r + 1));      // a doorway, a hole in a wall
    const boDist = (n, r) => { if (!bo) return 1e9; const x = n + .5, y = r + .5; return Math.hypot(Math.max(bo.x - x, 0, x - (bo.x + bo.w)), Math.max(bo.y - y, 0, y - (bo.y + bo.h))); };
    const spaced = (n, r) => out.every(L => Math.hypot(L.x / T - .5 - n, L.y / T - .5 - r) >= LAMPS.minCells);
    const free = (n, r) => fl(n, r) && !passage(n, r) && !onPillar(n, r, 30) && boDist(n, r) >= LAMPS.clear && spaced(n, r);
    /* 1 the original grid */
    rooms.forEach((e, t) => {
      if (t === 6) return;
      for (let n = e.x + 2; n < e.x + e.w - 1; n += LAMPS.step) for (let r = e.y + 2; r < e.y + e.h - 1; r += LAMPS.step) {
        if (!fl(n, r)) continue;
        let c = [n, r];
        if (onPillar(n, r, 0)) c = [[n, r - 1], [n, r + 1], [n - 1, r], [n + 1, r]].find(([a, b]) => fl(a, b) && !onPillar(a, b, 20)) || c;
        out.push(at(c[0], c[1]));
      }
    });
    /* 2 the staggered second grid in every working room */
    rooms.forEach((e, t) => {
      if (t === 6) return;
      const gap = LAMPS.gaps[e.name] != null ? LAMPS.gaps[e.name] : LAMPS.gap;
      for (let n0 = e.x + 2; n0 < e.x + e.w - 1; n0 += LAMPS.step) for (let r0 = e.y + 2; r0 < e.y + e.h - 1; r0 += LAMPS.step) {
        const n = n0 + 2 + (unit(t, n0, r0) < .5 ? 0 : 1), r = r0 + 2 + (unit(r0, t, n0) < .5 ? 0 : 1);
        if (n < e.x + 1 || n > e.x + e.w - 2 || r < e.y + 1 || r > e.y + e.h - 2 || unit(n, r, 1009) < gap) continue;
        if (free(n, r)) out.push(at(n, r));
      }
    });
    /* 3 a line of fixtures down every corridor (the floor outside every room, in its connected pieces, in map order) */
    const C = cols | 0, R = rows | 0, inRoom = (n, r) => rooms.some(e => n >= e.x && n < e.x + e.w && r >= e.y && r < e.y + e.h);
    const comp = new Int32Array(C * R).fill(-1); let k = 0;
    for (let r = 0; r < R; r++) for (let n = 0; n < C; n++) {
      if (comp[r * C + n] >= 0 || !fl(n, r) || inRoom(n, r)) continue;
      const q = [[n, r]]; comp[r * C + n] = k; let x0 = n, y0 = r, x1 = n, y1 = r;
      for (let i = 0; i < q.length; i++) { const [a, b] = q[i]; x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = a + dx, v = b + dy; if (u >= 0 && v >= 0 && u < C && v < R && comp[v * C + u] < 0 && fl(u, v) && !inRoom(u, v)) { comp[v * C + u] = k; q.push([u, v]); } } }
      const along = x1 - x0 >= y1 - y0, len = (along ? x1 - x0 : y1 - y0) + 1, wid = (along ? y1 - y0 : x1 - x0) + 1, m = Math.max(1, Math.round(len / LAMPS.corridorStep));
      for (let j = 0; j < m; j++) {
        const a = (along ? x0 : y0) + Math.floor((j + .5) * len / m), b = (along ? y0 : x0) + Math.floor((wid - 1) / 2) + (wid % 2 === 0 && unit(k, j, 2027) >= .5 ? 1 : 0);
        const cn = along ? a : b, cr = along ? b : a;
        if (comp[cr * C + cn] !== k || unit(cn, cr, 2029) < LAMPS.corridorGap) continue;
        if (free(cn, cr)) out.push(at(cn, cr));
      }
      k++;
    }
    return out;
  };

  /* props whose (padded) rect contains a point */
  W.propAt = function (x, y, pad = 0, types) {
    for (const p of PROPS) {
      if (types && !types.includes(p.type)) continue;
      const r = p.rect;
      if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return p;
    }
    return null;
  };
  /* the crawl zone (a gap cell or the ground under a bench) a point is inside, if any */
  W.lowZone = function (x, y, pad = 0) { return W.propAt(x, y, pad, ['gap', 'under']); };

  /* CRAWLSPACES (Part 1C) - real subspaces in continuous world coordinates, not a movement flag.  Built once from the props:
   *   interior   the hidden floor area (a body inside it is under the occluder)
   *   occluder   the upper geometry over it, with a height band {rect, z0, z1} - what a later cut-away fades when someone is inside (Part 3)
   *   height     how tall the crawl volume is (floor z = 0); nothing assumes unlimited headroom
   *   exits      points just outside each open face, grouped by face (a table: both long sides and both ends; a wall hole: its two sides)
   *   needs      the capability a body must have to go in (CAN_CRAWL under furniture, CAN_USE_TIGHT_GAPS through a wall hole)
   *   reveal     how close an observer must be to make out a body inside (it is under something: from farther it cannot be seen) */
  W.CRAWL = PROPS.filter(p => p.type === 'under' || p.type === 'gap').map(p => {
    const r = p.type === 'gap' ? p.cell : p.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2, out = 42, exits = [];
    const add = (face, x, y, nx, ny) => exits.push({ face, x, y, nx, ny });
    if (p.type === 'gap') {
      if (p.axis === 'x') { add('W', r.x - out, cy, -1, 0); add('E', r.x + r.w + out, cy, 1, 0); }
      else { add('N', cx, r.y - out, 0, -1); add('S', cx, r.y + r.h + out, 0, 1); }
    } else {
      const along = r.w >= r.h;
      for (const f of [1 / 6, .5, 5 / 6]) {
        if (along) { add('N', r.x + r.w * f, r.y - out, 0, -1); add('S', r.x + r.w * f, r.y + r.h + out, 0, 1); }
        else { add('W', r.x - out, r.y + r.h * f, -1, 0); add('E', r.x + r.w + out, r.y + r.h * f, 1, 0); }
      }
      if (along) { add('W', r.x - out, cy, -1, 0); add('E', r.x + r.w + out, cy, 1, 0); } else { add('N', cx, r.y - out, 0, -1); add('S', cx, r.y + r.h + out, 0, 1); }
    }
    const height = p.type === 'gap' ? 40 : 46;
    return { id: p.id, kind: p.kind, type: p.type, interior: { x: r.x, y: r.y, w: r.w, h: r.h }, occluder: { rect: { x: r.x, y: r.y, w: r.w, h: r.h }, z0: height, z1: p.type === 'gap' ? 240 : 78 },
      height, cx, cy, exits, needs: p.type === 'gap' ? 'CAN_USE_TIGHT_GAPS' : 'CAN_CRAWL', reveal: p.type === 'gap' ? 110 : 150 };
  });
  /* the crawlspace whose interior contains a point (pad widens it) */
  W.crawlAt = function (x, y, pad = 0) { for (const c of W.CRAWL) { const r = c.interior; if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return c; } return null; };
  W.canCrawl = (caps, c) => !!(caps && caps[c.needs]);

  /* does the segment a->b cross a concealing prop?  (a crouched player behind a counter cannot be seen over it) */
  W.segRect = function (ax, ay, bx, by, r) {
    let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
    const clip = (p, q) => { if (p === 0) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
    return clip(-dx, ax - r.x) && clip(dx, r.x + r.w - ax) && clip(-dy, ay - r.y) && clip(dy, r.y + r.h - ay);
  };
  W.concealedBy = function (ax, ay, bx, by) {
    for (const p of LOW) if (p.conceal && W.segRect(ax, ay, bx, by, p.rect)) return p;
    return null;
  };

  /* floor surfaces: carpet (short slides), concrete (medium), wet tile (long).  rooms = the game's room table. */
  const SURF = {
    carpet: { slide: 2.5, step: 1, label: 'carpet' },
    deep: { slide: 3.2, step: 1.1, label: 'deep carpet' },
    concrete: { slide: 1.45, step: 1.25, label: 'concrete' },
    wet: { slide: .72, step: 1.3, label: 'wet tile' },
  };
  W.SURF = SURF;
  W.surfaceAt = function (x, y, rooms) {
    if (rooms) for (const r of rooms) if (x >= r.x * T && x < (r.x + r.w) * T && y >= r.y * T && y < (r.y + r.h) * T) {
      if (r.name === 'DAMP ROOMS') return 'wet';
      if (r.name === 'LONG ROOM') return 'concrete';
      if (r.name === 'DEEP CARPET') return 'deep';
      return 'carpet';
    }
    return 'carpet';
  };

  /* shared movement / noise constants (the client moves, the server listens) */
  W.MOVE = {
    walk: 172, run: 285, crouch: 92, crawl: 54, exhaustedWalk: 148, radius: 15,
    staminaDrainRun: 10.5, staminaRegen: { stand: 24, crouch: 17, walk: 9, crouchWalk: 10, crawl: 8 },
    exhaustAt: 0, recoverAt: 36, exhaustedAcc: .62, slideMin: 135, slideEnd: 62, slideCd: .7, slideCost: 6,
    vault: { fast: { t: .3, cost: 8 }, normal: { t: .46, cost: 2.5 }, slow: { t: .8, cost: 0 } },
  };
  /* the state numbers sent over the network */
  W.S = { stand: 0, walk: 1, run: 2, crouch: 3, crawl: 4, slide: 5, vault: 6, down: 7 };
  W.SN = ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'];
  /* how loud each state is: radius in px at which an average entity notices it in open air */
  W.NOISE = { stand: 0, walk: 240, run: 640, crouch: 0, crouchMove: 85, crawl: 95, slide: 460, vaultFast: 520, vaultNormal: 360, vaultSlow: 170, light: 120, pick: 200, land: 420, exhaled: 300 };
  /* how high a body is off the floor (1 = upright).  lunges pass over low profiles */
  W.PROFILE = { stand: 1, walk: 1, run: 1, crouch: .62, crawl: .4, slide: .42, vault: .9, down: .3 };

  /* ---- art (drawn into the game's static Graphics; g is a PIXI.Graphics with the v8 chained API) ---- */
  const shade = (c, k) => { const r = Math.max(0, Math.min(255, (c >> 16 & 255) * k)) | 0, g = Math.max(0, Math.min(255, (c >> 8 & 255) * k)) | 0, b = Math.max(0, Math.min(255, (c & 255) * k)) | 0; return r << 16 | g << 8 | b; };
  function drawProp(g, p) {
    const r = p.rect, x = r.x, y = r.y, w = r.w, h = r.h, horiz = w >= h;
    const shadow = (dx, dy, k = .24) => g.roundRect(x + dx - 2, y + dy - 2, w + 4, h + 4, 4).fill({ color: 0x120f08, alpha: k });
    if (p.kind === 'counter') {                         // laminate reception counter: pale top, dark kick panel, brass edge
      shadow(4, 7); g.roundRect(x, y, w, h, 3).fill(0x7c6a44);
      g.roundRect(x + 2, y + 2, w - 4, h - 4, 2).fill(0xcdbb8a);
      g.roundRect(x + 5, y + 5, w - 10, h - 10, 2).fill({ color: 0xddcc9c, alpha: .8 });
      if (horiz) { g.rect(x, y + h - 6, w, 6).fill(0x4d4128); for (let i = 1; i < 3; i++) g.rect(x + w * i / 3 - 1, y + 3, 2, h - 9).fill({ color: 0x8f7d54, alpha: .55 }); }
      else { g.rect(x + w - 6, y, 6, h).fill(0x4d4128); for (let i = 1; i < 3; i++) g.rect(x + 3, y + h * i / 3 - 1, w - 9, 2).fill({ color: 0x8f7d54, alpha: .55 }); }
      g.circle(x + w * .3, y + h * .42, 3).fill({ color: 0x5a4d2f, alpha: .5});          // a ring where a mug once stood
    } else if (p.kind === 'shelf') {                    // a steel storage shelf toppled on its side
      shadow(5, 8, .3); g.roundRect(x, y, w, h, 2).fill(0x54595a);
      const n = 5; for (let i = 0; i < n; i++) { const a = horiz ? x + 6 + i * (w - 12) / (n - 1) : x + 3; const b = horiz ? y + 3 : y + 6 + i * (h - 12) / (n - 1); if (horiz) g.rect(a - 1.5, b, 3, h - 6).fill(0x8c9294); else g.rect(a, b - 1.5, w - 6, 3).fill(0x8c9294); }
      g.rect(x + 2, y + 2, w - 4, 4).fill({ color: 0xb4baba, alpha: .7 });
      g.poly([x + w * .18, y + h * .5, x + w * .34, y + h * .18, x + w * .42, y + h * .74]).fill({ color: 0x9c8b5a, alpha: .85 });   // a spilled cardboard box
    } else if (p.kind === 'lowwall') {                  // a wall stub: yellow wallpaper, exposed plaster and a stained cap
      shadow(4, 7, .3); g.rect(x, y, w, h).fill(0xa78f39);
      g.rect(x + 3, y + 3, w - 6, h - 6).fill(0xc9b25a);
      if (horiz) { g.rect(x, y + h * .5 - 1, w, 2).fill({ color: 0x86722a, alpha: .5 }); for (let i = 0; i < w; i += 22) g.rect(x + i, y + 3, 5, h - 6).fill({ color: 0xb69f46, alpha: .5 }); }
      else { g.rect(x + w * .5 - 1, y, 2, h).fill({ color: 0x86722a, alpha: .5 }); for (let i = 0; i < h; i += 22) g.rect(x + 3, y + i, w - 6, 5).fill({ color: 0xb69f46, alpha: .5 }); }
      g.poly([x + w * .1, y + h * .1, x + w * .45, y + h * .1, x + w * .3, y + h * .55]).fill({ color: 0xe1dcc4, alpha: .8 });        // plaster showing through
      g.rect(x, y, w, h).stroke({ color: 0x4b3f14, width: 2, alpha: .8 });
    } else if (p.kind === 'railing') {                  // a metal railing: thin rails, posts, you can see through it
      g.roundRect(x - 1, y - 1, w + 2, h + 2, 1).fill({ color: 0x120f08, alpha: .16 });
      if (horiz) { g.rect(x, y + h * .3, w, 3).fill(0x777d80); g.rect(x, y + h * .68, w, 2).fill(0x62686b); for (let i = 0; i <= 4; i++) g.rect(x + i * (w - 5) / 4, y - 1, 5, h + 2).fill(0x8a9194); }
      else { g.rect(x + w * .3, y, 3, h).fill(0x777d80); g.rect(x + w * .68, y, 2, h).fill(0x62686b); for (let i = 0; i <= 4; i++) g.rect(x - 1, y + i * (h - 5) / 4, w + 2, 5).fill(0x8a9194); }
    } else if (p.kind === 'machine') {                  // a dead industrial unit: hazard stripe, vents, no place to hide behind
      shadow(5, 8, .32); g.roundRect(x, y, w, h, 4).fill(0x505a56);
      g.roundRect(x + 3, y + 3, w - 6, h - 6, 3).fill(0x66726c);
      for (let i = 0; i < 6; i++) g.rect(x + 12 + i * (w - 24) / 6, y + 9, (w - 24) / 6 - 5, h - 26).fill({ color: 0x2f3634, alpha: .8 });
      for (let i = 0; i < w - 6; i += 18) g.poly([x + 3 + i, y + h - 12, x + 12 + i, y + h - 12, x + 3 + i + 9, y + h - 4, x + 3 + i, y + h - 4]).fill(0xc9a22a);
      g.circle(x + w - 12, y + 12, 3).fill(0x8d2a22);
    } else if (p.kind === 'table') {                    // long table on legs; you can crawl beneath it
      shadow(5, 9, .34); g.roundRect(x, y, w, h, 3).fill(0x6d5a35);
      g.roundRect(x + 2, y + 2, w - 4, h - 4, 2).fill(0xb8a374);
      g.rect(x + 5, y + 5, w - 10, 3).fill({ color: 0xd3c08e, alpha: .7 });
      for (const [lx, ly] of [[6, 6], [w - 12, 6], [6, h - 12], [w - 12, h - 12]]) g.rect(x + lx, y + ly, 6, 6).fill(0x3d3220);
    } else if (p.kind === 'bench') {                    // a bolted bench with a low gap underneath
      shadow(4, 8, .3); g.roundRect(x, y, w, h, 3).fill(0x59564d);
      g.roundRect(x + 2, y + 2, w - 4, h - 4, 2).fill(0x8b8672);
      for (let i = 1; i < 4; i++) g.rect(x + 3 + (w - 6) * i / 4 - 1, y + 3, 2, h - 6).fill({ color: 0x5b5745, alpha: .6 });
    } else if (p.kind === 'hole') {                     // a torn-open partition: crumbled plaster around a dark opening
      const c = p.cell;
      g.rect(c.x, c.y, c.w, c.h).fill(0x0a0907);
      g.rect(c.x + 4, c.y + 4, c.w - 8, c.h - 8).fill(0x14110c);
      if (p.axis === 'x') { g.poly([c.x, c.y, c.x + 26, c.y + 6, c.x + 10, c.y + 26, c.x, c.y + 20]).fill(0xd8d0b0); g.poly([c.x + c.w, c.y + c.h, c.x + c.w - 24, c.y + c.h - 8, c.x + c.w - 10, c.y + c.h - 28, c.x + c.w, c.y + c.h - 18]).fill(0xd8d0b0); }
      else { g.poly([c.x, c.y, c.x + 28, c.y + 8, c.x + 8, c.y + 24]).fill(0xd8d0b0); g.poly([c.x + c.w, c.y + c.h, c.x + c.w - 28, c.y + c.h - 8, c.x + c.w - 8, c.y + c.h - 24]).fill(0xd8d0b0); }
      for (let i = 0; i < 7; i++) g.circle(c.x + 12 + ((i * 37) % 72), c.y + 10 + ((i * 53) % 74), 2.2 + (i % 3)).fill({ color: 0xc9c09c, alpha: .8 });   // rubble
      g.rect(c.x, c.y, c.w, c.h).stroke({ color: 0x3a2f12, width: 2, alpha: .7 });
    } else if (p.kind === 'window') {                   // pass-through window: the sill you climb over, a frame either side
      const c = p.cell;
      g.rect(c.x, c.y, c.w, c.h).fill({ color: 0x120f08, alpha: .28 });
      shadow(3, 5, .3); g.rect(x, y, w, h).fill(0x8a7b4c);
      g.rect(x + 3, y + 3, w - 6, h - 6).fill(0xc9b988);
      if (p.axis === 'x') { g.rect(x - 2, y, 4, 8).fill(0x5c4f2c); g.rect(x - 2, y + h - 8, 4, 8).fill(0x5c4f2c); g.rect(x + w - 2, y, 4, 8).fill(0x5c4f2c); g.rect(x + w - 2, y + h - 8, 4, 8).fill(0x5c4f2c); }
      else { g.rect(x, y - 2, 8, 4).fill(0x5c4f2c); g.rect(x + w - 8, y - 2, 8, 4).fill(0x5c4f2c); g.rect(x, y + h - 2, 8, 4).fill(0x5c4f2c); g.rect(x + w - 8, y + h - 2, 8, 4).fill(0x5c4f2c); }
    }
  }
  W.drawProps = function (g) { for (const p of PROPS) drawProp(g, p); };

  /* sanity check used by tests: every prop stands on real floor with space around it */
  W.verify = function (kc, FBW, FBH) {
    const fl = (x, y) => x >= 0 && y >= 0 && x < FBW && y < FBH && kc[y * FBW + x] === 1, bad = [];
    for (const p of PROPS) {
      const c = p.cell;
      for (let yy = p.ty; yy < p.ty + p.th; yy++) for (let xx = p.tx; xx < p.tx + p.tw; xx++) if (!fl(xx, yy)) bad.push(p.id + ' not floor at ' + xx + ',' + yy);
      if (p.type === 'low' || p.type === 'under') {
        for (let yy = p.ty - 2; yy < p.ty + p.th + 2; yy++) for (let xx = p.tx - 1; xx < p.tx + p.tw + 1; xx++) if (!fl(xx, yy) && (p.cross === 'y' ? true : true)) { if (!(xx >= p.tx && xx < p.tx + p.tw && yy >= p.ty && yy < p.ty + p.th)) if (!fl(xx, yy)) bad.push(p.id + ' cramped at ' + xx + ',' + yy); }
      }
    }
    return bad;
  };
  return W;
});
