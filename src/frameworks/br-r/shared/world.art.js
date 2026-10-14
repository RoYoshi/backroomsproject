/** @part public/world.js,generated/server/world.js - BR-R: the props' art (drawProp, into the game's static Graphics); the factory closes here
 * provides: -
 * uses: PROPS, W
 * writes: -
 */
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
