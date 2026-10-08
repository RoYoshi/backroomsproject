/* Stage 3B-L QA2 - the game's own sight-polygon code, run in node (development only; never served).  (From the Stage 3B
 * pillar LOS work's los_lib.js: QA2 also exports its face-band helpers.)
 *
 * Loads, verbatim from a game bundle (assets/index-*.js): the Level 0 map tables, the exact ray query Uc (walls, then the
 * exact pillar rectangles Pc), the wall-corner event list Vl and the sight-polygon generator Hl - the code the renderer
 * runs every frame for the entity mask (Hl(x, y, 700)) and the darkness clip (Hl(x, y, 700, 24)).
 *   const L = require('./los_lib.js').load(ROOT)   ->  { g, Hl, HlRec, Uc, Pc, Hc, zc, Vl, exactSees, inPoly, blockerAt, src }
 *   HlRec(x, y, n, r) -> { poly, rays: [[angle, exact hit distance, vertex x, vertex y], ...] } (a recording copy, for tests) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
function load(root, bundle = 'assets/index-DKbV5Nv9.js') {
  root = path.resolve(root);
  const B = fs.readFileSync(path.join(root, bundle), 'utf8'), W = require(path.join(root, 'world.js'));
  const cut = (a, b) => { const i = B.indexOf(a), j = B.indexOf(b, i); if (i < 0 || j < 0) throw Error('bundle marker missing: ' + a); return B.slice(i, j); };
  const ctx = vm.createContext({ window: { WORLD: W }, Math, Uint8Array, Float64Array, Set, Object, Array, Number, console });
  const losSrc = 'var ' + cut('Vl=[];for(let e=0;e<=FBH', 'function Ul(');
  vm.runInContext(cut('var FBW=96', 'var Wc={kind:') + ';\n' + losSrc + ';\nthis.__x={FBW,FBH,kc,zc,Hc,Uc,Bc,Fc,Pc,Mc,Oc,Vl,Hl,HlqFaces:typeof HlqFaces=="function"?HlqFaces:null,HlqQuad:typeof HlqQuad=="function"?HlqQuad:null,HlqD:typeof HlqD=="object"?HlqD:null};', ctx);
  const g = ctx.__x;
  /* a recording copy of Hl (tests only): the same source with one call added before each vertex is pushed - the ray's angle
   * and its exact-hit distance (the parent's Hl names them o and i, QA2's o and d) */
  const hlAt = losSrc.indexOf('function Hl('), hlEnd = losSrc.lastIndexOf('return a}'), body = losSrc.slice(hlAt, hlEnd);
  if ((body.match(/a\.push\(e\+/g) || []).length !== 1) throw Error('Hl vertex push not found exactly once');
  const rec = body.replace('a.push(e+', '__rec.push(o,typeof d==="number"?d:i),a.push(e+').replace('function Hl(', 'function HlRec(') + 'return a}';
  vm.runInContext('var __rec=[];' + rec + ';this.__y={HlRec,get rec(){return __rec},clear(){__rec=[]}};', ctx);
  const HlRec = (x, y, n = 700, r = 0) => { ctx.__y.clear(); const poly = ctx.__y.HlRec(x, y, n, r), R = ctx.__y.rec, rays = []; for (let k = 0; k < R.length; k += 2) rays.push([R[k], R[k + 1], poly[k], poly[k + 1]]); return { poly, rays }; };
  /* exact visibility of a point from the viewer: the same ray query, no polygon in between */
  const exactSees = (vx, vy, x, y) => { const d = Math.hypot(x - vx, y - vy); return d < .5 || g.Uc(vx, vy, Math.atan2(y - vy, x - vx), d) >= d - .5; };
  const inPoly = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  /* what a point is: 'pillar' (inside a pillar rect), 'wall' (a sight-blocking cell), or 'floor' */
  const blockerAt = (x, y) => { for (const p of g.Pc) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return 'pillar'; return g.Hc(Math.floor(x / 96), Math.floor(y / 96)) ? 'wall' : 'floor'; };
  return { g, Hl: g.Hl, HlRec, Uc: g.Uc, Pc: g.Pc, Hc: g.Hc, zc: g.zc, Vl: g.Vl, exactSees, inPoly, blockerAt, src: losSrc };
}
module.exports = { load };
