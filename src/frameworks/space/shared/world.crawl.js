/** @part public/world.js,generated/server/world.js - S.P.A.C.E.: props at a point, crawlspaces, concealment
 * provides: -
 * uses: LOW, PROPS, W
 * writes: -
 */
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

