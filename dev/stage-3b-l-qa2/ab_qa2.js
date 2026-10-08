/* Stage 3B-L QA2 - the same frozen frame drawn by two builds (development only; never served).
 *
 *   node dev/stage-3b-l-qa2/ab_qa2.js --other DIR [--game PATH] [--ports 9497,9498] [--quality medium] [--scenes A,B,..] [--out DIR]
 *
 * Two servers, two pages (1920 x 1080, the same tier, no monsters), the same position, aim and carried light, both frozen
 * clocks at the same instant.  From the darkness overlay the player sees (#light), and the darkness clip each build drew:
 *   - FLOOR pixels inside both builds' clips (more than 3 px from either outline: the canvas clip's antialiasing): the light
 *     on open floor - ceiling lamps, bounce, carried lights, every shadow - must be identical (QA2 changes faces, not floor),
 *     counted apart within 4 and within 20 world px of a wall or pillar (the light buffer is drawn at .75 of the screen and a
 *     lamp's caches hold .45 / .11 px per world px, all smoothed: a face's light reaches a little onto the floor at its foot);
 *   - WALL / PILLAR pixels inside both clips: the face receivers (QA2's corner polish changes them: counted, not required);
 *   - pixels inside only one clip: the darkness clip's own change (counted).
 * --other the QA1 parent: the ordinary visible world is unchanged.  --other a build without the infrared change, with night
 * vision off: every pixel identical (nothing of the infrared runs).
 * Scenes: A YELLOW HALL (lamps), C its partition, D PILLAR HALL, H the long corridor, FL a flashlight across a convex corner,
 * LA a lantern by an inner corner, CN the camcorder raised with night vision OFF in a lit room, CB the same in the BLACKOUT
 * ZONE.  Writes ab.json and a picture per scene (this build's overlay; its clip yellow, the other's dashed red). */
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./qa2_lib.js'); const { sharp } = Q;
const LOS = require('./los_lib.js');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), OTHER = path.resolve(opt('other'));
const [PA, PB] = (opt('ports') || '9497,9498').split(',').map(Number), QUAL = opt('quality') || 'medium', OUT = path.resolve(opt('out') || '/tmp/abqa2'); fs.mkdirSync(OUT, { recursive: true });
const C = c => c * 96 + 48;
const ALL = [
  ['A', 'YELLOW HALL, lamps on', { x: C(12), y: C(35), aim: 0 }],
  ['C', 'YELLOW HALL partition', { x: C(12.5), y: C(33), aim: Math.PI }],
  ['D', 'PILLAR HALL, lamps on', { x: C(82), y: C(12), aim: 0 }],
  ['H', 'long corridor', { x: C(11.5), y: C(22), aim: -Math.PI / 2 }],
  ['FL', 'flashlight across a convex corner (BLACKOUT ZONE)', { x: 1136, y: 5360, aim: -2.356, kind: 'flashlight', blackout: true }],
  ['LA', 'lantern by an inner corner (BLACKOUT ZONE)', { x: 430, y: 4850, aim: 0, kind: 'lantern', blackout: true }],
  ['CN', 'camcorder raised, night vision OFF, lit room', { x: C(12), y: C(35), aim: 0, kind: 'camcorder', nv: false, ir: 1 }],
  ['CB', 'camcorder raised, night vision OFF, BLACKOUT ZONE', { x: C(13), y: C(53), aim: Math.PI, kind: 'camcorder', nv: false, ir: 1, blackout: true }],
];
const ONLY = opt('scenes') ? opt('scenes').split(',') : null, SCENES = ALL.filter(s => !ONLY || ONLY.includes(s[0]));
const CLIPTAP = `(() => { const P = CanvasRenderingContext2D.prototype, mt = P.moveTo, lt = P.lineTo, cl = P.clip, bp = P.beginPath, cr = P.clearRect;
  let path = null; const L = c => c.canvas && c.canvas.id === 'light';
  P.beginPath = function () { if (L(this)) path = []; return bp.apply(this, arguments); };
  P.moveTo = function (x, y) { if (path && L(this)) path.push(x, y); return mt.apply(this, arguments); };
  P.lineTo = function (x, y) { if (path && L(this)) path.push(x, y); return lt.apply(this, arguments); };
  P.clearRect = function () { if (L(this)) this.__first = true; return cr.apply(this, arguments); };
  P.clip = function () { if (L(this) && this.__first) { this.__first = false; window.__sceneClip = path ? path.slice() : null; } return cl.apply(this, arguments); };
})();`;
const grab = P => P.evaluate(() => { const c = document.getElementById('light'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = ''; const CH = 0x8000;
  for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH)); return { w: c.width, h: c.height, rgba: btoa(s), clip: window.__sceneClip }; });
const mask = async (clip, w, h, edge) => { let pts = ''; for (let i = 0; i < clip.length; i += 2) pts += `${clip[i].toFixed(2)},${clip[i + 1].toFixed(2)} `;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon points="${pts}" ${edge ? 'fill="none" stroke="#fff" stroke-width="6"' : 'fill="#fff"'} shape-rendering="crispEdges"/></svg>`)).extractChannel(0).raw().toBuffer(); };
(async () => {
  const N = LOS.load(GAME), within = (x, y, r) => { for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; for (const f of [.5, 1]) if (solid(x + Math.cos(a) * r * f, y + Math.sin(a) * r * f)) return true; } return false; }, nearSolid = (x, y) => solid(x - 4, y) || solid(x + 4, y) || solid(x, y - 4) || solid(x, y + 4) || solid(x - 3, y - 3) || solid(x + 3, y - 3) || solid(x - 3, y + 3) || solid(x + 3, y + 3), solid = (x, y) => !!N.Hc(Math.floor(x / 96), Math.floor(y / 96)) || N.Pc.some(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
  const R = { other: OTHER, game: GAME, quality: QUAL, scenes: [] };
  const sA = await Q.open(OTHER, PA, { quality: QUAL, init: CLIPTAP }), sB = await Q.open(GAME, PB, { quality: QUAL, init: CLIPTAP, browser: sA.browser });
  try {
    for (const [id, label, sc] of SCENES) {
      const stA = await Q.scene(sA, sc), stB = await Q.scene(sB, sc), a = await grab(sA.P), b = await grab(sB.P);
      const A = Buffer.from(a.rgba, 'base64'), B = Buffer.from(b.rgba, 'base64'), w = a.w, h = a.h;
      const mA = await mask(a.clip, w, h), mB = await mask(b.clip, w, h), eA = await mask(a.clip, w, h, 1), eB = await mask(b.clip, w, h, 1);
      const dm = Buffer.alloc(w * h * 3);                                  // the differences: floor red, walls / pillars blue, only-one-clip grey
      const r = { id, label, at: [stA.x, stA.y], same: stA.wx === stB.wx && stA.wy === stB.wy && stA.s === stB.s, floorBoth: 0, floorDiff: 0, floorMax: 0, floorOpen: 0, floorOpenDiff: 0, floorOpenMax: 0, floorFar: 0, floorFarDiff: 0, floorFarMax: 0, solidBoth: 0, solidDiff: 0, solidMax: 0, onlyOther: 0, onlyThis: 0, edge: 0, edgeDiff: 0, all: w * h, allDiff: 0 };
      for (let p = 0, i = 0; p < w * h; p++, i += 4) {
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]), Math.abs(A[i + 3] - B[i + 3])); if (d) r.allDiff++;
        if (eA[p] > 0 || eB[p] > 0) { r.edge++; if (d) r.edgeDiff++; continue; }
        const ia = mA[p] > 127, ib = mB[p] > 127;
        if (ia && ib) { const x = ((p % w) + .5 - stB.wx) / stB.s, y = (Math.floor(p / w) + .5 - stB.wy) / stB.s;
          if (solid(x, y)) { r.solidBoth++; if (d) { r.solidDiff++; dm[p * 3 + 2] = Math.min(255, 60 + d * 8); } if (d > r.solidMax) r.solidMax = d; } else { r.floorBoth++; if (d) { r.floorDiff++; dm[p * 3] = Math.min(255, 60 + d * 8); } if (d > r.floorMax) r.floorMax = d; if (!nearSolid(x, y)) { r.floorOpen++; if (d) r.floorOpenDiff++; if (d > r.floorOpenMax) r.floorOpenMax = d; if (!within(x, y, 20)) { r.floorFar++; if (d) r.floorFarDiff++; if (d > r.floorFarMax) r.floorFarMax = d; } } } }
        else if (ia || ib) { if (ia) r.onlyOther++; else r.onlyThis++; if (d) dm[p * 3] = dm[p * 3 + 1] = dm[p * 3 + 2] = 90; }
      }
      R.scenes.push(r); await sharp(dm, { raw: { width: w, height: h, channels: 3 } }).png().toFile(path.join(OUT, `diff_${id}.png`));
      console.log(`${id} | ${label} | every pixel: ${r.allDiff} of ${r.all} differ | floor inside both clips ${r.floorBoth} px: ${r.floorDiff} differ (max ${r.floorMax}); more than 4 px from any wall / pillar ${r.floorOpen} px: ${r.floorOpenDiff} differ (max ${r.floorOpenMax}); more than 20 px ${r.floorFar} px: ${r.floorFarDiff} differ (max ${r.floorFarMax}) | walls / pillars inside both ${r.solidBoth} px: ${r.solidDiff} differ (max ${r.solidMax}) | only in the other's clip ${r.onlyOther}, only in this one's ${r.onlyThis} | within 3 px of an outline ${r.edge} (${r.edgeDiff} differ)`);
      const pts = c => { let s = ''; for (let i = 0; i < c.length; i += 2) s += `${c[i].toFixed(1)},${c[i + 1].toFixed(1)} `; return s; };
      await sharp(await sB.P.screenshot()).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><polygon points="${pts(a.clip)}" fill="none" stroke="#ff3b3b" stroke-width="2" stroke-dasharray="8 6"/><polygon points="${pts(b.clip)}" fill="none" stroke="#ffd400" stroke-width="1.5"/></svg>`) }]).jpeg({ quality: 82 }).toFile(path.join(OUT, `ab_${id}.jpg`));
    }
    R.errs = [sA.J.errs, sB.J.errs];
  } finally { await Q.close(sB); await Q.close(sA); }
  fs.writeFileSync(path.join(OUT, 'ab.json'), JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
