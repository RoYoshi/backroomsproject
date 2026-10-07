/* Stage 3B - the shared Node harness for the remaster checks (development only; never served).
 * The live game tables are extracted verbatim from the shipped bundle (as dev/br-role/test_br_role.js does), with the real
 * world.js; the remaster module runs in a VM against a recording Pixi mock and a no-op 2D canvas. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/* ---------- the live game tables, from the shipped bundle ---------- */
const WORLD = require(path.join(ROOT, 'world.js'));
function makeGame() {
  const B = read('assets/index-DKbV5Nv9.js');
  const cut = (a, b) => { const i = B.indexOf(a), j = B.indexOf(b, i); assert(i >= 0 && j > i, 'bundle marker missing: ' + a); return B.slice(i, j); };
  const ctx = vm.createContext({ window: { WORLD }, Math, Uint8Array, Set, Object, Array, Number, console });
  vm.runInContext(cut('var FBW=96', 'var Wc={kind:') + ';\nthis.__x={FBW,FBH,kc,zc,Hc,Bc,Fc,Pc,Mc,Ic,Oc};', ctx);
  return ctx.__x;
}
const G = makeGame();
const V = require(path.join(ROOT, 'assets/level0_visuals.js'));
const T = 96, cellOf = (x, y) => [Math.floor(x / T), Math.floor(y / T)];
const roomRect = id => { const r = V.room(id), o = G.Oc.find(q => q.code === r.code); return o; };
const inRect = (o, cx, cy) => cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h;

/* ---------- the remaster module in a VM: the real bundle tables, a recording Pixi mock, a no-op 2D canvas ---------- */
class Pt { constructor() { this.x = 0; this.y = 0; } set(x, y) { this.x = x; this.y = y === undefined ? x : y; } copyFrom(p) { this.x = p.x; this.y = p.y; return this; } }
class Container {
  constructor() { this.children = []; this.parent = null; this.position = new Pt(); this.scale = new Pt(); this.scale.set(1, 1); this.alpha = 1; this.visible = true; this.label = ''; this.blendMode = 'normal'; this.destroyed = false; }
  addChild(...c) { for (const k of c) { if (k.parent) k.parent.removeChild(k); k.parent = this; this.children.push(k); } return c[0]; }
  addChildAt(c, i) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.splice(i, 0, c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } return c; }
  destroy() { this.destroyed = true; if (this.parent) this.parent.removeChild(this); }
}
class Graphics extends Container {
  constructor() { super(); this.ops = []; this._tf = null; this._fs = { alpha: 1 }; this._cur = null; }
  rect(x, y, w, h) { this._cur = { type: 'rect', x, y, w, h }; return this; } roundRect(x, y, w, h) { return this.rect(x, y, w, h); }
  poly(p) { this._cur = { type: 'poly', p: p.slice() }; return this; } ellipse(x, y, a, b) { this._cur = { type: 'ellipse', x, y, a, b }; return this; } circle(x, y, r) { this._cur = { type: 'circle', x, y, r }; return this; }
  moveTo() { this._cur = { type: 'path' }; return this; } lineTo() { return this; } bezierCurveTo() { return this; } quadraticCurveTo() { return this; } closePath() { return this; }
  fill(style) { this.ops.push(Object.assign({}, this._cur, { op: 'fill', style, tf: this._tf })); return this; } stroke(style) { this.ops.push(Object.assign({}, this._cur, { op: 'stroke', style })); return this; }
  texture(tex, tint, x, y, w, h) { this.ops.push({ op: 'texture', tex, tint, x, y, w, h, tf: this._tf, alpha: this._fs && this._fs.alpha }); return this; }
  setTransform(a, b, c, d, tx, ty) { this._tf = [a, b, c, d, tx, ty]; return this; } resetTransform() { this._tf = null; return this; }
  set fillStyle(v) { this._fs = v; } get fillStyle() { return this._fs; } clear() { this.ops = []; return this; }
}
class Texture { static from(o) { const t = new Texture(); t.source = { style: {}, w: (o && o.resource ? o.resource : o).width, h: (o && o.resource ? o.resource : o).height }; t.opts = o && o.resource ? o : null; return t; } destroy() { this.destroyed = true; } }
class RenderTexture { static create(o) { const t = new RenderTexture(); t.o = o; RenderTexture.made++; return t; } destroy() { this.destroyed = true; RenderTexture.freed++; } }
RenderTexture.made = 0; RenderTexture.freed = 0;
const mockRenderer = () => ({ resolution: 1, renders: [], generateTexture() { return new RenderTexture(); }, render(o) { this.renders.push(o); } });
class TilingSprite extends Container { constructor(w, h) { super(); this.tileScale = new Pt(); this.texture = new Texture(); this.width = w; this.height = h; } }
const ctx2d = cv => { const target = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() { } }), createRadialGradient: () => ({ addColorStop() { } }),
    putImageData: img => { if (cv) cv.__img = img; } };   // the canvas keeps the last image put into it (the checks read the per-zone maps)
  return new Proxy(target, { get: (t, k) => k in t ? t[k] : () => { }, set: (t, k, v) => { t[k] = v; return true; } }); };
function runRemaster({ search = '', quality = 'medium', patchOc = null, app = 'mock' } = {}) {
  const tasks = [], raf = [], warns = [];
  const Oc = G.Oc.map(o => Object.assign({}, o)); if (patchOc) patchOc(Oc);
  const doc = { createElement: t => { const cv = { width: 1, height: 1, style: {}, textContent: '', toDataURL: () => '' }; cv.getContext = () => ctx2d(cv); return cv; }, body: { appendChild() { } } };
  const win = { L0_VISUALS: V, WORLD, document: doc, location: { search }, innerWidth: 1280, innerHeight: 720, performance: { now: () => Date.now() },
    requestAnimationFrame: f => raf.push(f), setTimeout: f => tasks.push(f), addEventListener() { }, console: { warn: (...a) => warns.push(a.join(' ')), log() { } },
    __brRole: { stats: () => ({ quality }) }, __api: { Oc, zc: G.zc, Hc: G.Hc, Bc: G.Bc, lamps: G.Fc }, URLSearchParams, Math, Number, JSON, Array, Object, Map, Set, Float32Array, Int32Array, Uint8ClampedArray, String, Error, isFinite, parseInt, Infinity, Proxy };
  win.window = win; win.self = win;
  const ctx = vm.createContext(win); vm.runInContext(read('assets/l0-remaster.js'), ctx);
  const L = win.__l0v;
  /* the bundle's build(): the carpet, the level art, the objective traces, actors ... and lampTop; every lamp asks for its target */
  const world = new Container(), carpet = new TilingSprite(G.FBW * T, G.FBH * T), level = new Graphics(), trace = new Container(), actors = new Container(), lampTop = new Graphics();
  carpet.tileScale.set(.32); world.addChild(carpet, level, trace, actors, lampTop); lampTop.alpha = .84;
  const targets = G.Fc.map((e, t) => L.lamp(t, e, lampTop));
  const A = app === 'mock' ? { stage: new Container(), renderer: mockRenderer() } : app;
  L.built(world, level, lampTop, A);
  while (tasks.length) tasks.shift()();
  /* run the module's frame loop n times with the camera centred on world point (x, y) (scale 1, a 1280 x 720 view) */
  const frame = (n = 1, at = null) => { if (at) { world.scale = { x: 1, y: 1 }; world.position.set(640 - at[0], 360 - at[1]); } for (let i = 0; i < n; i++) { const f = raf.splice(0); for (const cb of f) cb(0); } };
  return { L, world, level, lampTop, carpet, targets, warns, stats: L.stats(), app: A, frame };
}

module.exports = { ROOT, read, WORLD, G, V, T, cellOf, roomRect, inRect, Pt, Container, Graphics, Texture, RenderTexture, TilingSprite, runRemaster };
