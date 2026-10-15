/** @part public/world.js,generated/server/world.js - S.P.A.C.E.: the shared world module (window.WORLD in the page, require on the server): Level 0's props and how they block movement; a module: worldHead
 * The props themselves (DEF: where Level 0's counters, shelves, benches, holes and windows are) are L.O.S.T.'s content; they are declared here, as they always were.
 * A module (continuation C3b, M-024): M8's part inside its factory, worldHead, after the opening of the script's wrapper, which this part
 * keeps. Its parameter is what it takes from the modules made before it, by giver; its return is what later modules take from it.
 * world.compose.js makes it. Every line is M8's.
 * imports: -
 * exports: LOW, PROPS, T, W
 * provides: worldHead
 * uses: -
 * writes: -
 */
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
  function worldHead() {
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


  return { LOW, PROPS, T, W };
  }
