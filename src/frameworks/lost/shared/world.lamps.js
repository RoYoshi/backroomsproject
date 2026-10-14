/** @part public/world.js,generated/server/world.js - L.O.S.T.: Level 0's working ceiling fixtures (W.lamps), for the client and the server alike
 * provides: -
 * uses: T, W
 * writes: -
 */
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

