/* BR-RoLE - focused unit checks for assets/br-role.js (Node, no browser; quick).
 *
 *   node dev/br-role/test_br_role.js        (exit code 1 on any failure)
 *
 * The module runs in a VM with the REAL level geometry, ray query (walls and pillars), lamp list and equipment light model
 * extracted verbatim from the shipped bundle, the real world.js and light.js, a recording mock of the Pixi classes, and a
 * recording mock of the 2D canvas (every call, with the compositing state it ran under).  It checks what BR-RoLE draws,
 * not how it looks: the pixels are checked in the browser (dev/br-role/smoke.js). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
function run(name, fn) { try { const r = fn(); check(name, r === undefined ? true : r.ok, r && r.note); } catch (e) { check(name, false, 'EXCEPTION ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); } }

/* ---------- Pixi mock (as dev/shadows/test_shadows.js) ---------- */
class Pt { constructor() { this.x = 0; this.y = 0; } set(x, y) { this.x = x; this.y = y === undefined ? x : y; } }
class Container {
  constructor() { this.children = []; this.parent = null; this.position = new Pt(); this.scale = new Pt(); this.scale.set(1, 1); this.rotation = 0; this.alpha = 1; this.visible = true; this.label = ''; }
  get x() { return this.position.x; } get y() { return this.position.y; }
  addChild(...c) { for (const k of c) { if (k.parent) k.parent.removeChild(k); k.parent = this; this.children.push(k); } return c[0]; }
  addChildAt(c, i) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.splice(i, 0, c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } return c; }
  removeChildren() { const r = this.children.splice(0); for (const c of r) c.parent = null; return r; }
}
class Graphics extends Container { constructor() { super(); this.context = {}; this.quads = []; } texture(tex, tint, x, y, w, h) { this.quads.push({ tex, x, y, w, h }); return this; } clear() { this.quads = []; return this; } }
class Texture { constructor(src) { this.src = src; } static from(c) { return new Texture(c); } }

/* ---------- a recording 2D canvas ---------- */
function mkCanvas(log, name) {
  const c = { width: 0, height: 0, name, style: {}, remove() { } };
  const st = { globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: null, imageSmoothingEnabled: true, transform: [1, 0, 0, 1, 0, 0], clip: 0 }, stack = [];
  const rec = (op, extra) => log.push(Object.assign({ canvas: name, op, gco: st.globalCompositeOperation, alpha: st.globalAlpha, transform: st.transform.slice(), clip: st.clip }, extra || {}));
  let curPath = [], subs = [];
  const ctx = {
    canvas: c,
    get globalCompositeOperation() { return st.globalCompositeOperation; }, set globalCompositeOperation(v) { st.globalCompositeOperation = v; },
    get globalAlpha() { return st.globalAlpha; }, set globalAlpha(v) { st.globalAlpha = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get imageSmoothingEnabled() { return st.imageSmoothingEnabled; }, set imageSmoothingEnabled(v) { st.imageSmoothingEnabled = v; },
    save() { stack.push(JSON.parse(JSON.stringify(Object.assign({}, st, { fillStyle: null })))); stack[stack.length - 1].fillStyle = st.fillStyle; },
    restore() { const s = stack.pop(); if (s) Object.assign(st, s); },
    setTransform(a, b, cc, d, e, f) { st.transform = [a, b, cc, d, e, f]; },
    clearRect(x, y, w, h) { rec('clearRect', { rect: [x, y, w, h] }); }, fillRect(x, y, w, h) { rec('fillRect', { rect: [x, y, w, h], style: st.fillStyle }); },
    beginPath() { curPath = []; subs = []; }, moveTo(x, y) { curPath.push(x, y); subs.push([x, y]); }, lineTo(x, y) { curPath.push(x, y); if (subs.length) subs[subs.length - 1].push(x, y); }, closePath() { }, arc() { }, rect(x, y, w, h) { curPath.push(x, y, x + w, y, x + w, y + h, x, y + h); subs.push([x, y, x + w, y, x + w, y + h, x, y + h]); },
    fill() { rec('fill', { style: st.fillStyle, path: curPath.slice(), subs: subs.map(q => q.slice()) }); },
    clip() { st.clip++; rec('clip', { path: curPath.slice() }); },
    createRadialGradient(x0, y0, r0, x1, y1, r1) { const g = { kind: 'radial', at: [x1, y1], r: [r0, r1], stops: [] }; g.addColorStop = (o, col) => g.stops.push([o, col]); return g; },
    createLinearGradient(x0, y0, x1, y1) { const g = { kind: 'linear', from: [x0, y0], to: [x1, y1], stops: [] }; g.addColorStop = (o, col) => g.stops.push([o, col]); return g; },
    createConicGradient(a, x, y) { const g = { kind: 'conic', at: [x, y], start: a, stops: [] }; g.addColorStop = (o, col) => g.stops.push([o, col]); return g; },
    drawImage(img, ...a) { rec('drawImage', { src: img.name || '?', args: a }); },
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() { },
  };
  c.getContext = () => ctx; return c;
}

function makeGame() {
  const B = read('assets/index-DKbV5Nv9.js');
  const cut = (a, b) => { const i = B.indexOf(a), j = B.indexOf(b, i); assert(i >= 0 && j > i, 'bundle marker missing: ' + a); return B.slice(i, j); };
  const ctx = vm.createContext({ window: { WORLD: require(path.join(ROOT, 'world.js')) }, Math, Uint8Array, Set, Object, Array, Number, console });
  vm.runInContext(cut('var FBW=96', 'var Wc={kind:') + ';\n' + cut('var Gc={flashlight', 'function Jc(') + ';\nthis.__x={FBW,FBH,kc,zc,Hc,Uc,Bc,Fc,Pc,Mc,Gc,qc,Ic,V};', ctx);
  return ctx.__x;
}
const GAME = makeGame(); GAME.props = require(path.join(ROOT, 'world.js')).PROPS.filter(p => p.rect).map(p => p.rect);
function makePage(opts = {}) {
  const g = GAME, T = 96, log = [], store = new Map(), intervals = [];
  let ncan = 0;
  const doc = { readyState: 'complete', createElement: t => t === 'canvas' ? mkCanvas(log, 'off' + (ncan++)) : { style: {}, addEventListener() { }, remove() { }, setAttribute() { }, dataset: {} },
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() { } }, addEventListener() { } };
  const world = new Container(), carpet = new Container(); carpet.tileScale = new Pt(); carpet.texture = new Texture(null); carpet.width = g.FBW * T; carpet.height = g.FBH * T;
  const level = new Graphics(), corpseLayer = new Container(), person = new Container(), creatures = new Container();
  person.deathPose = () => { }; world.addChild(carpet, level, corpseLayer, person, creatures);
  const H = { x: 1060, y: 3300, angle: 0, equipment: { kind: 'flashlight', color: '#ffe7b2' } };
  const win = { document: doc, location: { search: opts.search || '' }, screen: { width: 1920, height: 1080 }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: opts.dpr || 1,
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) }, matchMedia: () => ({ matches: !!opts.coarse }),
    performance: { now: () => page.clock }, console: { warn: (...a) => page.warns.push(a.join(' ')), log() { } }, setInterval: f => { intervals.push(f); return 1; }, addEventListener() { },
    URLSearchParams, Math, Number, JSON, Array, Object, WeakMap, Map, Set, Float32Array, Uint8ClampedArray, String, Error, isFinite, parseInt };
  win.window = win;
  win.__api = { floor: () => corpseLayer, layer: () => creatures, Hc: g.Hc, Uc: (...a) => { page.rays++; return g.Uc(...a); }, Bc: g.Bc, Gc: g.Gc, lamps: g.Fc, H, V: g.V, lightOn: () => true };
  win.__ents = { lamp: () => 1, dbgCfg: { on: false } };
  const page = { g, win, log, H, clock: 1000, warns: [], rays: 0, overlay: mkCanvas(log, 'overlay'), person, creatures };
  const ctx = vm.createContext(win);
  vm.runInContext(read('world.js'), ctx); vm.runInContext(read('light.js'), ctx);
  if (opts.extraProps) for (const r of opts.extraProps) win.WORLD.PROPS.push({ id: 'X' + win.WORLD.PROPS.length, type: 'low', kind: 'counter', rect: r });
  vm.runInContext(read('assets/br-role.js'), ctx);
  page.R = win.__brRole;
  /* one frame as drawLight hands it over: world scale 1.18, camera on the player, the overlay context */
  page.frame = (o = {}) => { page.clock += 16.7; log.length = 0; const r = 1.18, x = o.x ?? H.x, y = o.y ?? H.y;
    if (o.x !== undefined) { H.x = x; H.y = y; } if (o.angle !== undefined) H.angle = o.angle; person.position.set(x, y);   // the local player's body, where the game draws it
    const F = { t: page.clock / 1000, on: o.on !== false, r, ox: 640 - x * r, oy: 360 - y * r, w: 1280, h: 720, viewer: { x, y }, src: { x, y, angle: H.angle }, kind: o.kind || 'flashlight', color: o.color || '#ffe7b2', death: !!o.death };
    const ok = page.R.on() && page.R.draw(page.overlay.getContext('2d'), F); return ok; };
  return page;
}
/* a lamp is added to the light buffer as its cached shadowed field, at globalAlpha = strength / P0 (.9).  BR-RoLE 1.1: its
 * CORE cache, drawImage(cache, x - hx, y - hy, 2 hx, 2 hy) with hx = 400 + 30 + 4 (the core crossfade and the tube's
 * half-length; rounded up to the cache's texels) and hx - hy = 30; its far field + bounce light go into the quarter-resolution
 * buffer (a 2 x 674 px cache) and are not lamp draws here */
const isCore = e => e.args.length === 4 && Math.abs(e.args[2] - 868) < 6 && Math.abs(e.args[2] - e.args[3] - 60) < 6;
const lampDraws = (log) => log.filter(e => e.op === 'drawImage' && (e.gco === 'lighter' || e.gco === 'source-over') && isCore(e));   // into the buffer, or into the scratch when an actor shadows it (BR2B)
const lampOf = (g, e) => g.Fc.findIndex(l => Math.abs(l.x - (e.args[0] + e.args[2] / 2)) < 1e-6 && Math.abs(l.y - (e.args[1] + e.args[3] / 2)) < 1e-6);
/* BR-RoLE 1.1: a lamp's core cache is built as drawImage(field, 0, 0) (the unobstructed field, once per tier), then the
 * averaged shadow mask taken out (destination-out); find the build of lamp `lp`: its field op and its mask op, the shadow
 * fills between them cast from points within the lamp's tube */
function coreBuild(g, L, lp, tube) {
  for (let a = 0; a < L.length; a++) { const f = L[a]; if (!(f.op === 'drawImage' && f.args.length === 2 && f.args[0] === 0 && f.args[1] === 0 && f.gco === 'source-over')) continue;
    const b = L.findIndex((e, n) => n > a && e.canvas === f.canvas && e.op === 'drawImage' && e.gco === 'destination-out'); if (b < 0) continue;
    const sub = L[b], fills = L.filter((e, n) => n > a && n < b && e.op === 'fill' && (e.canvas === sub.src || e.style === '#fff'));
    const from = fills.map(q => checkShadowFill(g, q, 380).from).filter(Boolean);
    if (fills.filter(q => q.canvas === sub.src).length + fills.filter(q => q.canvas !== sub.src).length >= tube && from.length && from.every(q => Math.abs(q[0] - lp.x) <= 40.01 && Math.abs(q[1] - lp.y) <= 8.01)) return { a, b, field: f, sub, cache: f.canvas };
  }
  return null;
}
/* frames until every lamp in view is built and faded in; the log keeps the last frame */
function warm(p, o = {}, n = 40) { for (let k = 0; k < n; k++) { p.frame(o); if (k > 16 && p.R.stats().lamps.pending === 0) break; } p.frame(o); }
/* the point a shadow polygon was cast from: where its two side rays (A -> A', B -> B') meet */
function castFrom(q) {
  const [ax, ay, bx, by, b2x, b2y, , , a2x, a2y] = q, ux = a2x - ax, uy = a2y - ay, vx = b2x - bx, vy = b2y - by, den = ux * vy - uy * vx;
  if (Math.abs(den) < 1e-12) return null; const t = ((bx - ax) * vy - (by - ay) * vx) / den; return [ax + ux * t, ay + uy * t];
}
/* is A-B a blocker side facing the point S: a straight piece of the wall / floor boundary (the level's border counts as wall)
 * or of a pillar's side, with the open side towards S */
function onBlocker(g, A, B, S) {
  const T = 96, wall = (x, y) => x < 0 || y < 0 || x >= g.FBW || y >= g.FBH ? true : !!g.Hc(x, y), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  if (Math.abs(A[1] - B[1]) < 1e-9) {
    const pil = g.Pc.find(r => (Math.abs(r.y - my) < 1e-9 || Math.abs(r.y + r.h - my) < 1e-9) && mx > r.x && mx < r.x + r.w);
    if (pil) return Math.abs(r_side(pil.y, pil.y + pil.h, my) * (S[1] - my)) > 0 && Math.sign(S[1] - my) === r_side(pil.y, pil.y + pil.h, my);
    if (Math.abs(my / T - Math.round(my / T)) > 1e-9) return false; const cy = Math.round(my / T), cx = Math.floor(mx / T), up = wall(cx, cy - 1), dn = wall(cx, cy);
    return up !== dn && (up ? S[1] > my : S[1] < my);
  }
  if (Math.abs(A[0] - B[0]) < 1e-9) {
    const pil = g.Pc.find(r => (Math.abs(r.x - mx) < 1e-9 || Math.abs(r.x + r.w - mx) < 1e-9) && my > r.y && my < r.y + r.h);
    if (pil) return Math.sign(S[0] - mx) === r_side(pil.x, pil.x + pil.w, mx);
    if (Math.abs(mx / T - Math.round(mx / T)) > 1e-9) return false; const cx = Math.round(mx / T), cy = Math.floor(my / T), lf = wall(cx - 1, cy), rt = wall(cx, cy);
    return lf !== rt && (lf ? S[0] > mx : S[0] < mx);
  }
  return false;
}
const r_side = (lo, hi, v) => Math.abs(v - lo) < 1e-9 ? -1 : 1;           // a pillar side faces out: its low side up / left, its high side down / right
/* every shadow polygon of a fill: cast from one common point, anchored on a blocker side facing it, projected away beyond `reach` */
const area = q => { let a = 0; for (let i = 0; i < q.length; i += 2) { const j = (i + 2) % q.length; a += q[i] * q[j + 1] - q[j] * q[i + 1]; } return a / 2; };
/* split a fill's subpaths: a prop's shadow is its hull followed by its own top (the prop's rect, the opposite winding) */
function splitFill(g, fill) {
  const W = g.WORLD || {}, rects = (g.props || []), walls = [], props = [];
  for (let k = 0; k < fill.subs.length; k++) {
    const q = fill.subs[k], nx = fill.subs[k + 1];
    const hole = nx && nx.length === 8 && rects.find(r => nx[0] === r.x && nx[1] === r.y && nx[2] === r.x + r.w && nx[3] === r.y && nx[4] === r.x + r.w && nx[5] === r.y + r.h && nx[6] === r.x && nx[7] === r.y + r.h);
    if (hole) { props.push({ hull: q, hole: nx, prop: hole }); k++; } else walls.push(q);
  }
  return { walls, props };
}
/* every wall shadow polygon of a fill: cast from one common point, anchored on a blocker side facing it, projected away
 * beyond `reach`; every polygon (walls, prop hulls) winds the same way (negative area) and a prop's top the other way */
function checkShadowFill(g, fill, reach) {
  const { walls, props } = splitFill(g, fill);
  const out = { polys: walls.length, props: props.length, from: null, badShape: 0, badFrom: 0, badSide: 0, badFar: 0, badWinding: 0 };
  for (const q of walls) {
    if (q.length !== 10) { out.badShape++; continue; }
    const S = castFrom(q); if (!S) { out.badShape++; continue; }
    if (!out.from) out.from = S; else if (Math.hypot(S[0] - out.from[0], S[1] - out.from[1]) > .01) out.badFrom++;
    if (!onBlocker(g, [q[0], q[1]], [q[2], q[3]], out.from)) out.badSide++;
    const F = out.from, dA = Math.hypot(q[0] - F[0], q[1] - F[1]), dB = Math.hypot(q[2] - F[0], q[3] - F[1]);
    for (const [px, py, d] of [[q[8], q[9], dA], [q[4], q[5], dB], [q[6], q[7], 0]]) { const dd = Math.hypot(px - F[0], py - F[1]); if (!(dd > d && dd >= reach)) out.badFar++; }
    if (!(area(q) < 0)) out.badWinding++;
  }
  for (const pr of props) if (!(area(pr.hull) < 0 && area(pr.hole) > 0)) out.badWinding++;
  return out;
}

run('U01 loads, attaches above the carpet on the first frame, and takes over the light (on() true); version reported; the blockers are every wall side and pillar side', () => {
  const p = makePage(); const before = p.R.on(); const ok = p.frame(); const i = p.win.__api.floor().parent.children.findIndex(c => c.label === 'br-role'), b = p.R.stats().blockers;
  return { ok: ok && before === true && i === 1 && p.R.stats().attached && /^br-role (BR2|1\.[01])/.test(p.R.version) && b.sides > 100 && b.pillars === p.g.Pc.length, note: `version ${p.R.version}, layer index ${i}, blocker sides ${b.sides} (pillars ${b.pillars} of ${p.g.Pc.length})` };
});
run('U02 one compositor, no visibility polygon: nothing is clipped to any shape (only, BR3, shadow fills to their light\'s own pixel box); every light is ADDED to the light buffer (`lighter`): each lamp as its own shadowed field, each carried light (beam, then hand glow); the overlay loses the buffer once (destination-out), then the beam colour (source-over)', () => {
  const p = makePage(); warm(p, { x: 1130, y: 3420, angle: 2.6 }); const L = p.log;
  const isBox = q => q.length === 8 && q[1] === q[3] && q[2] === q[4] && q[5] === q[7] && q[0] === q[6] && [q[0], q[1], q[2], q[5]].every(Number.isInteger);   // BR3: a light's own pixel box
  const clips = L.filter(e => e.op === 'clip' && !isBox(e.path)).length, boxClips = L.filter(e => e.op === 'clip' && isBox(e.path)).length, lamps = lampDraws(L).filter(e => e.gco === 'lighter'), ov = L.filter(e => e.canvas === 'overlay' && e.op === 'drawImage');
  const buf = ov.length ? ov[0].src : null, farIn = L.filter(e => e.canvas === buf && e.op === 'drawImage' && e.gco === 'lighter' && e.args.length === 8 && e.args[6] === e.args[2] * 8 && e.args[7] === e.args[3] * 8),
    coreIn = L.filter(e => e.canvas === buf && e.op === 'drawImage' && e.gco === 'lighter' && e.args.length === 8 && e.args[6] === e.args[2] * 2 && e.args[7] === e.args[3] * 2),   // QA1: the lamps' half-resolution core buffer, added once
    carriedToBuf = L.filter(e => e.canvas === buf && e.op === 'drawImage' && e.gco === 'lighter' && e.args.length === 8 && !farIn.includes(e) && !coreIn.includes(e)), viaScratch = new Set(p.R.actors().filter(j => j.lightKind === 'lamp').map(j => j.light)).size;
  const lampsAdded = lamps.length + viaScratch;                            // a lamp an actor shadows goes through the scratch (BR2B)
  return { ok: clips === 0 && lampsAdded >= 3 && lamps.every(e => e.clip === 0) && carriedToBuf.length === 2 + viaScratch && farIn.length <= 1 && coreIn.length === 1 && ov.length === 2 && ov[0].gco === 'destination-out' && ov[1].gco === 'source-over',
    note: `clips other than a light's own pixel box ${clips} (box clips ${boxClips}); lamps added ${lampsAdded} (each its shadowed field, lighter - QA1: into the half-resolution core buffer, added ${coreIn.length}x; ${viaScratch} through the scratch for an actor's shadow); scratch pieces added ${carriedToBuf.length} (beam, glow + those lamps); far + bounce buffer (an eighth, QA1) added ${farIn.length}x; overlay: ${ov.map(e => e.gco).join(' then ')}` };
});
run('U03 lamp: LIGHT FIELD -> BLOCKER -> CAST SHADOW.  The spawn lamp\'s cache is its full unclipped field first; then, from each point of its tube, every wall / pillar side facing that point casts the polygon of its two corners projected away from it; the averaged shadows are taken out of the field (destination-out)', () => {
  const p = makePage(); let L = null, cache = null; const lp = p.g.Fc[4], tube = p.R.tiers().medium.tube;
  let B = null; for (let k = 0; k < 6 && !cache; k++) { p.frame({ x: 1130, y: 3420, angle: 2.6 }); L = p.log; B = coreBuild(p.g, L, lp, tube); if (B) cache = B.cache; }
  const ops = L.filter(e => e.canvas === cache && e.op !== 'clearRect'), field = B && B.field, sub = B && B.sub;
  const fieldOk = field && ops[0] === field && field.clip === 0 && field.gco === 'source-over' && sub && sub.gco === 'destination-out' && ops.indexOf(sub) > 0;
  const fills = L.filter(e => e.canvas === sub.src && e.op === 'fill' && L.indexOf(e) > L.indexOf(field) && L.indexOf(e) < L.indexOf(sub));
  let polys = 0, bad = 0, outside = 0; const froms = [];
  for (const f of fills) { const c = checkShadowFill(p.g, f, 380); polys += c.polys; bad += c.badShape + c.badFrom + c.badSide + c.badFar; if (c.from) { froms.push(c.from); if (Math.abs(c.from[0] - lp.x) > 40.01 || Math.abs(c.from[1] - lp.y) > 8.01) outside++; } }
  const allLighter = fills.every(f => f.gco === 'lighter'), spread = Math.max(...froms.map(q => q[0])) - Math.min(...froms.map(q => q[0]));
  return { ok: fieldOk && fills.length === tube && allLighter && polys > tube && bad === 0 && outside === 0 && spread > 60,
    note: `field first (BR-RoLE 1.1: the per-tier field drawn 1:1), unclipped: ${fieldOk}; ${fills.length} tube points (tier ${tube}), spread ${spread.toFixed(1)} px along the tube; ${polys} shadow polygons, each from its tube point, on a facing blocker side, projected away beyond 380 px: bad ${bad}` };
});
run('U04 blackout: no lamp is drawn; your light still is; lamps come back after', () => {
  const p = makePage(); warm(p); const a = lampDraws(p.log).length; p.g.V.blackout = true; p.frame(); const b = lampDraws(p.log).length, own = p.R.stats().carried.last; p.g.V.blackout = false; p.frame(); const c = lampDraws(p.log).length;
  return { ok: a > 0 && b === 0 && own === 1 && c === a, note: `lamps ${a} -> blackout ${b} (carried ${own}) -> ${c}` };
});
run('U05 lamp strength is the game\'s own: .43 (dim fixtures .13 + .06·max(0, sin(11t + i))), times failures and the NV gain, capped at .9; QA1: shown at LAMP.vis x that (the cached field is added at min(1, vis x strength / .9))', () => {
  const p = makePage(); let worst = 0, n = 0, dims = 0; warm(p, { x: 600, y: 2930 }); const VIS = p.R.dev.constants().LAMP.vis || 1;
  for (const [f, gain] of [[1, 1], [.25, 1], [1, 1.5], [1, 3]]) {
    p.win.__ents.lamp = () => f; p.win.__cam = { lampGain: () => gain }; p.frame({ x: 600, y: 2930 });
    const t = p.clock / 1000;
    for (const e of lampDraws(p.log)) { const i = lampOf(p.g, e), exp = Math.min(1, Math.min(.9, (i % 13 === 0 ? .13 + .06 * Math.max(0, Math.sin(t * 11 + i)) : .43) * f * gain) * VIS / .9), got = e.alpha;
      if (i % 13 === 0) dims++; worst = Math.max(worst, Math.abs(got - exp)); n++; }
  }
  return { ok: n > 8 && dims > 0 && worst < 1e-9, note: `${n} lamp draws checked (dim fixtures ${dims}), vis ${VIS}, largest difference from the formula ${worst.toExponential(1)}` };
});
run('U06 tiers: the light buffer is the CSS viewport x .5 / .75 / 1.0 - never scaled by devicePixelRatio; lamps and other wanderers are drawn up to each tier\'s cap (the last one may be fading)', () => {
  const out = {};
  for (const dpr of [1, 3]) for (const q of ['low', 'medium', 'high']) {
    const p = makePage({ dpr }); p.R.setQuality(q); p.win.__peerLights = []; for (let k = 0; k < 10; k++) p.win.__peerLights.push({ x: 1060 + Math.cos(k) * (120 + 14 * k), y: 3300 + Math.sin(k) * (120 + 14 * k), angle: k, kind: ['flashlight', 'headlamp', 'lantern'][k % 3], color: '#ffe7b2', on: true });
    warm(p); const s = p.R.stats(), t = p.R.tiers()[q]; out[q + '@' + dpr] = { buf: s.buffer.join('x'), lamps: s.lamps.last + '/' + t.lamps, peers: s.carried.peers + '/' + t.peers };
    if (s.buffer[0] !== Math.ceil(1280 * t.scale) || s.buffer[1] !== Math.ceil(720 * t.scale) || s.lamps.last > t.lamps || s.carried.peers > t.peers || s.carried.peers < t.peers - 1) out.bad = true;
  }
  return { ok: !out.bad && out['low@1'].buf === out['low@3'].buf, note: JSON.stringify(out) };
});
run('U07 the camcorder carries no light (its infrared stays the game\'s own); camcorder, dead and switched-off peers are never drawn as lights', () => {
  const p = makePage(); p.win.__peerLights = [{ x: 1100, y: 3300, angle: 0, kind: 'camcorder', on: true, ir: 1 }, { x: 1120, y: 3300, angle: 0, kind: 'flashlight', on: true, dead: true }, { x: 1140, y: 3300, angle: 0, kind: 'flashlight', on: false }];
  p.frame({ kind: 'camcorder' }); const s = p.R.stats();
  return { ok: s.carried.last === 0 && s.carried.peers === 0, note: `carried lights drawn ${s.carried.last}, peers ${s.carried.peers}` };
});
run('U08 read-only: the module never writes game state or talks to the network (static scan)', () => {
  const m = read('assets/br-role.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const net = ['WebSocket', '.send(', 'fetch(', 'XMLHttpRequest', '__net', 'sendBeacon', 'postMessage'].filter(k => m.includes(k));
  const writes = m.match(/(__api|__light|__ents|__peerLights|__cam|WORLD)(\.[A-Za-z_$][\w$]*)+\s*=[^=]/g) || [];
  const srv = ['server.js', 'sim.js', 'ai.js', 'death_srv.js', 'dphys.js', 'move.js', 'world.js', 'light.js', 'ents.js'].filter(f => /__brRole|br-role/.test(read(f)));
  return { ok: !net.length && !writes.length && !srv.length, note: `network ${JSON.stringify(net)}, writes ${JSON.stringify(writes)}, gameplay files that mention it ${JSON.stringify(srv)}` };
});
run('U09 fail-safe and DEV switch: ?lighting=legacy leaves the game\'s own lighting (on() false); an internal error switches BR-RoLE off for the session', () => {
  const a = makePage({ search: '?lighting=legacy' }), legacyOff = a.R.on() === false && a.frame() === false;
  const b = makePage(); b.frame(); b.win.__api.Uc = () => { throw Error('boom'); }; b.R.setQuality('high'); const r = b.frame({ x: 4000, y: 3504, angle: 0 });
  return { ok: legacyOff && r === false && b.R.on() === false && b.R.stats().disabled === 'frame error', note: `legacy: on() ${a.R.on()}; after an error: draw ${r}, on() ${b.R.on()}, disabled '${b.R.stats().disabled}'` };
});
run('U10 the seam: index.html loads br-role.js (not shadows-2d.js); drawLight hands the light cut-outs to BR-RoLE through one guarded hook, and keeps the legacy path intact behind it', () => {
  const html = read('index.html'), B = read('assets/index-DKbV5Nv9.js');
  const hooks = ['let BR=window.__brRole&&window.__brRole.on()?window.__brRole:null', 'BR||(u.addColorStop(0,`rgba(0,0,0,.14)`)', 'BR||V.blackout||Fc.forEach(', 'BR&&BR.draw(n,{', 'if(!BR&&e&&!f.nv){', 'drawPeers(mk,t,!!BR)', 'if(B)continue;'];
  const miss = hooks.filter(h => B.split(h).length !== 2);
  return { ok: html.includes('<script src="./assets/br-role.js"></script>') && !html.includes('shadows-2d.js') && !miss.length && B.includes('window.__cam.irDraw(mk,'), note: `hooks found ${hooks.length - miss.length}/${hooks.length}${miss.length ? ' missing ' + JSON.stringify(miss) : ''}` };
});
run('U11 no NaN / Infinity reaches the canvas, whatever the inputs (random positions and aims, bad peers, zero and huge frame gaps)', () => {
  const p = makePage(); let rnd = 7; const R = () => (rnd = rnd * 16807 % 2147483647) / 2147483647; let bad = 0, n = 0;
  for (let k = 0; k < 60; k++) { p.win.__peerLights = [{ x: NaN, y: 1, on: true, kind: 'lantern' }, { x: p.H.x + 90, y: p.H.y, angle: R() * 7, kind: 'headlamp', on: true }]; p.frame({ x: 300 + R() * 8800, y: 300 + R() * 6200, angle: R() * 12 - 6 });
    for (const e of p.log) { n++; const nums = [...(e.rect || []), ...(e.path || []), ...(e.args || []), ...e.transform, ...(e.alpha === undefined ? [] : [e.alpha])]; if (nums.some(v => typeof v === 'number' && !Number.isFinite(v))) bad++; } }
  return { ok: bad === 0 && p.R.on(), note: `${n} canvas calls, non-finite ${bad}, still on ${p.R.on()}` };
});

run('U12 flashlight: its natural field first (radial falloff, then the smooth angular profile; no shape clip - BR3: only its own pixel box), then the shadows walls and pillars cast INSIDE the beam from the hand: one point at LOW (cut straight out), four / six across the hand at MEDIUM / HIGH (averaged); then added', () => {
  const out = {}; let ok = true; const X = 1060, Y = 3440, AIM = Math.atan2(3400 - 3440, 930 - 1060), arc = GAME.Gc.flashlight.arc;
  for (const q of ['low', 'medium', 'high']) {
    const p = makePage(); p.R.setQuality(q); warm(p, { x: X, y: Y, angle: AIM }); const L = p.log, n = p.R.tiers()[q].src;
    const fi = L.findIndex(e => e.op === 'fillRect' && e.style && e.style.kind === 'radial' && e.style.r[1] === 390), scr = L[fi].canvas, prof = L[fi + 1];
    const add = L.findIndex((e, j) => j > fi && e.canvas !== scr && e.op === 'drawImage' && e.src === scr && e.gco === 'lighter');
    const fills = L.filter((e, j) => j > fi && j < add && e.op === 'fill'), cut = L.filter((e, j) => j > fi && j < add && e.canvas === scr && e.gco === 'destination-out');
    let polys = 0, bad = 0, outCone = 0; const froms = [];
    for (const f of fills) { const c = checkShadowFill(p.g, f, 390); polys += c.polys; bad += c.badShape + c.badFrom + c.badSide + c.badFar; if (c.from) froms.push(c.from);
      for (const s of f.subs) { const a1 = Math.atan2(s[1] - c.from[1], s[0] - c.from[0]) - AIM, a2 = Math.atan2(s[3] - c.from[1], s[2] - c.from[0]) - AIM, w1 = Math.atan2(Math.sin(a1), Math.cos(a1)), w2 = Math.atan2(Math.sin(a2), Math.cos(a2));
        if ((w1 > arc / 2 + .2 && w2 > arc / 2 + .2) || (w1 < -arc / 2 - .2 && w2 < -arc / 2 - .2)) outCone++; } }
    const hand = froms.every(f => Math.hypot(f[0] - X, f[1] - Y) <= 3.01), fieldFirst = L[fi].clip <= 1 && prof.op === 'fillRect' && prof.style.kind === 'conic' && prof.gco === 'destination-in';
    const mode = n === 1 ? fills.length === 1 && fills[0].canvas === scr && fills[0].gco === 'destination-out' : fills.length === n && fills.every(f => f.gco === 'lighter' && f.canvas !== scr) && cut.length === 1 && cut[0].op === 'drawImage';
    out[q] = `${fills.length} source pt, ${polys} shadow polys, bad ${bad}, outside the beam ${outCone}`;
    if (!(fieldFirst && mode && add > 0 && polys > 0 && bad === 0 && outCone === 0 && hand && froms.length === n)) { ok = false; out[q] += ' FAIL'; }
  }
  return { ok, note: JSON.stringify(out) };
});
run('U13 a fluorescent fixture is an area source: behind the partition by the spawn lamp there is an umbra (no tube point sees), a penumbra of many levels between it and full light, and the penumbra widens away from the blocker', () => {
  const p = makePage(); warm(p, { x: 1130, y: 3420, angle: 2.6 }); const lp = p.g.Fc[4], C = [960, 3360], a0 = Math.atan2(C[1] - lp.y, C[0] - lp.x), res = {};
  for (const r of [140, 300]) { let um = 0, pen = 0, lit = 0; const lv = new Set();
    for (let a = a0 - .9; a <= a0 + .9; a += .002) { const x = lp.x + Math.cos(a) * r, y = lp.y + Math.sin(a) * r; if (p.g.Hc(Math.floor(x / 96), Math.floor(y / 96))) continue;
      const v = p.R.probe(x, y).lamps.find(l => l.i === 4).visible; if (v === 0) um++; else if (v === 1) lit++; else { pen++; lv.add(v.toFixed(3)); } }
    res[r] = { umbra: +(um * .002 * r).toFixed(0), penumbra: +(pen * .002 * r).toFixed(0), lit: +(lit * .002 * r).toFixed(0), levels: lv.size }; }
  return { ok: res[300].umbra > 0 && res[300].penumbra > res[140].penumbra && res[140].penumbra > 0 && res[300].levels >= 8 && res[300].lit > 0, note: `arc lengths (px) around the lamp: ${JSON.stringify(res)}` };
});

/* ---------- BR2A: selected prop shadows ---------- */
const L4 = { x: 3272, y: 984, w: 272, h: 48 };                          // counter L4; lamps 31 (3600, 912) and 29 (3120, 912) beside it
run('U14 BR2A casters: counters, the shelf, the low walls, the machine, the table, the bench and the window sills; not the see-through railing or the wall holes', () => {
  const p = makePage(); p.frame(); const b = p.R.stats().blockers, kinds = b.propKinds.slice().sort();
  return { ok: b.props === 11 && JSON.stringify(kinds) === JSON.stringify(['bench', 'counter', 'lowwall', 'machine', 'shelf', 'table', 'window']), note: `${b.props} prop casters: ${kinds.join(', ')}` };
});
run('U15 BR2A/BR2.1C lamp: from EVERY tube point the counter beside lamp 31 casts the hull of its base and its top projected away from that point (x 70 / (180 - 70)) - its own top cut back out (opposite winding: lit) - graded from solid at the footprint to faint at the far end, united with that point\'s wall shadows, then averaged into the lamp\'s mask', () => {
  const p = makePage(); let L = null, cache = null; const lp = p.g.Fc[31], kk = 70 / 110;
  let B = null; for (let k = 0; k < 8 && !cache; k++) { p.frame({ x: 3400, y: 1250, angle: -Math.PI / 2 }); L = p.log; B = coreBuild(p.g, L, lp, 16); if (B) cache = B.cache; }
  const i0 = B ? B.a : -1, i1 = B ? B.b : -1;
  const seg = L.slice(i0, i1), propF = seg.filter(e => e.op === 'fill' && e.style && e.style.kind === 'linear'), T = propF.length ? propF[0].canvas : null;
  const intoMask = seg.filter(e => e.op === 'drawImage' && e.src === T && e.gco === 'lighter');
  let bad = 0, wind = 0, grad = 0, n = 0;
  for (const pf of propF) {
    const k = seg.indexOf(pf), wf = seg.slice(0, k).reverse().find(e => e.canvas === T && e.op === 'fill' && e.style === '#fff'), S = wf ? checkShadowFill(p.g, wf, 380).from : null; if (!S) { bad++; continue; }
    const pr = splitFill(p.g, pf).props.find(q => q.prop.x === L4.x && q.prop.y === L4.y); if (!pr) continue; n++;
    if (!(area(pr.hull) < 0 && area(pr.hole) > 0)) wind++;
    const want = []; for (const [cx, cy] of [[L4.x, L4.y], [L4.x + L4.w, L4.y], [L4.x + L4.w, L4.y + L4.h], [L4.x, L4.y + L4.h]]) want.push([cx, cy], [cx + (cx - S[0]) * kk, cy + (cy - S[1]) * kk]);
    for (let v = 0; v < pr.hull.length; v += 2) if (!want.some(w => Math.hypot(w[0] - pr.hull[v], w[1] - pr.hull[v + 1]) < 1e-6)) bad++;
    const st = pf.style.stops.map(q => [q[0], +q[1].match(/,([\d.]+)\)$/)[1]]), cx = L4.x + L4.w / 2, cy = L4.y + L4.h / 2;
    if (!(st.length === 3 && st[0][1] === 1 && st[1][1] === 1 && st[2][1] < .5 && Math.hypot(pf.style.from[0] - cx, pf.style.from[1] - cy) < 1e-6 && Math.hypot(pf.style.to[0] - S[0], pf.style.to[1] - S[1]) > Math.hypot(cx - S[0], cy - S[1]))) grad++;
  }
  return { ok: n === 16 && intoMask.length === 16 && bad === 0 && wind === 0 && grad === 0 && intoMask.every(e => Math.abs(e.alpha - 16.4 / 255) < 1e-3),
    note: `${n} tube points cast the counter (united with their walls, ${intoMask.length} averaged in at ${intoMask[0] && intoMask[0].alpha.toFixed(4)}); hull vertices off ${bad}; winding errors ${wind}; gradient (solid at the footprint -> faint, away from the point) errors ${grad}` };
});
run('U16 BR2A behaviour (probe, the game\'s ray query + the prop\'s shadow): behind the counter the lamps are blocked but a flashlight from the open side lights it; a flashlight from the lamps\' side is blocked by the same counter there; the counter\'s own top stays lit', () => {
  const p = makePage(); warm(p, { x: 3400, y: 1250, angle: -Math.PI / 2 });
  let X = null;                                                          // a floor point behind the counter from both lamps (all their tube points), the flashlight reaching it
  for (let y = 1046; y < 1110 && !X; y += 4) for (let x = 3330; x < 3520 && !X; x += 6) { const r = p.R.probe(x, y), l31 = r.lamps.find(l => l.i === 31), l29 = r.lamps.find(l => l.i === 29); if (l31 && l29 && l31.visible === 0 && l29.visible === 0 && r.carried[0].light > .1) X = [x, y]; }
  /* BR-RoLE 1.1: other lamps' faint tails may reach the spot; the counter blocks lamps 31 / 29, and the total is the beam plus those others */
  const below = p.R.probe(X[0], X[1]), lampsBelow = below.lamps.filter(l => l.i === 31 || l.i === 29).reduce((a, l) => a + l.light, 0), others = below.lamps.filter(l => l.i !== 31 && l.i !== 29).reduce((a, l) => a + l.light, 0), beamBelow = below.carried[0].light;
  const unblocked = p.R.probe(X[0], X[1] + 120).lamps.find(l => l.i === 31).visible;   // the same lamp past the counter's shadow
  warm(p, { x: 3430, y: 880, angle: Math.atan2(X[1] - 880, X[0] - 3430) });
  const aim = Math.atan2(X[1] - 880, X[0] - 3430), above = p.R.probe(X[0], X[1]), beside = p.R.probe(3430 + Math.cos(aim) * 70, 880 + Math.sin(aim) * 70), top = p.R.probe(3400, 1008).lamps.find(l => l.i === 31);   // beside: in the same beam, before the counter
  const ok = !!X && lampsBelow === 0 && beamBelow > .1 && Math.abs(below.total - Math.min(1, beamBelow + others)) < 1e-9 && unblocked > 0 && above.carried[0].light === 0 && above.lamps.every(l => l.i !== 31 && l.i !== 29 || l.light === 0) && beside.carried[0].light > 0 && top.visible > .5;
  return { ok, note: `point ${X}: lamps 31/29 there ${lampsBelow} (past the shadow lamp 31 sees ${unblocked}); flashlight from below ${beamBelow.toFixed(3)} + other lamps' tails ${others.toFixed(4)} = total ${below.total.toFixed(3)}; flashlight from the lamps' side ${above.carried[0].light} (in the same beam before the counter ${beside.carried[0].light.toFixed(3)}); counter top sees lamp 31: ${top.visible}` };
});
run('U17 BR2A bounded: prop casters per light and per frame stay within the tier caps however many props are near (40 extra counters, several wanderers\' lights)', () => {
  const extra = []; for (let k = 0; k < 40; k++) extra.push({ x: 1000 + (k % 8) * 40, y: 3380 + Math.floor(k / 8) * 30, w: 24, h: 12 });
  const out = {}; let ok = true;
  for (const q of ['low', 'medium', 'high']) { const p = makePage({ extraProps: extra }); p.R.setQuality(q); p.win.__peerLights = []; for (let k = 0; k < 8; k++) p.win.__peerLights.push({ x: 1060 + k * 12, y: 3300, angle: Math.PI / 2, kind: 'flashlight', color: '#ffe7b2', on: true });
    warm(p, { x: 1060, y: 3330, angle: Math.PI / 2 }); const s = p.R.stats(), t = p.R.tiers()[q]; out[q] = `${s.props.last}/${t.propFrame} (per light ${t.props})`; if (!(s.props.last <= t.propFrame && s.props.last > 0)) ok = false; }
  return { ok, note: JSON.stringify(out) };
});

/* ---------- BR2B: player / Hound shadows ---------- */
function creature(p, x, y, flags) { const v = new Container(); v.position.set(x, y); Object.assign(v, flags); p.creatures.addChild(v); return v; }
run('U18 BR2B/BR2.1 an actor\'s cast shadow and self-shading are its DOMINANT light\'s own contribution taken away: that lamp alone goes through the scratch; the cast is built in a pooled canvas with the silhouette cut out of it (never on the body), the self-shading gradient runs away from the lamp; then the lamp is added; no dark paint, no Pixi shadow layer', () => {
  const p = makePage(); warm(p, { x: 1060, y: 3300, on: false }); const L = p.log, me = p.R.actors().filter(j => j.self), lp = p.g.Fc[4], k = 1.18 * .75;
  const lampIn = L.find(e => e.op === 'drawImage' && isCore(e) && e.gco === 'source-over'), scr = lampIn && lampIn.canvas;
  const cast = L.find(e => e.op === 'drawImage' && e.args.length === 4 && e.args[0] > 0 && e.canvas !== scr && e.gco === 'source-over' && e.alpha < 1), T = cast && cast.canvas;
  const cuts = L.filter(e => e.canvas === T && e.op === 'drawImage' && e.gco === 'destination-out' && e.args.join() === '-1,-1,2,2');
  const back = L.find(e => e.canvas === scr && e.src === T && e.gco === 'destination-out'), shade = L.find(e => e.canvas === scr && e.op === 'drawImage' && e.gco === 'destination-out' && e.args.join() === '-1,-1,2,2');
  const added = L.slice(L.indexOf(shade)).find(e => e.src === scr && e.gco === 'lighter');
  const want = Math.atan2(3300 - lp.y, 1060 - lp.x), castAng = Math.atan2(cast.transform[1], cast.transform[0]), sh = shade.transform, gradAng = Math.atan2(sh[1], sh[0]);   // a circle: the texture's +x is the gradient
  const cutR = Math.hypot(cuts[0].transform[0], cuts[0].transform[1]) / k, startPx = cast.args[0];
  const layers = p.win.__api.floor().parent.children.find(c => c.label === 'br-role').children.map(c => c.label), black = L.filter(e => e.op === 'fill' && e.style === '#000').length;
  const VIS = p.R.dev.constants().LAMP.vis || 1, ok = me.length === 1 && me[0].light === 'L4' && me[0].dominant && Math.abs(lampIn.alpha - Math.min(1, lampOfP(p, 4) * VIS / .9)) < 1e-6 && Math.abs(castAng - want) < 1e-6 && Math.abs(gradAng - want) < 1e-6 && cutR >= 18 + 1 && cuts.length >= 1 && !!back && !!added
    && cast.alpha > .5 && cast.alpha <= .85 && shade.alpha > .42 * .3 * .9 && shade.alpha <= .42 + 1e-9 && black === 0 && JSON.stringify(layers) === JSON.stringify(['br-role-ao']);
  return { ok, note: `light ${me.map(j => j.light)}; cast x${cast.alpha.toFixed(3)} from ${startPx.toFixed(1)} px, turned ${castAng.toFixed(4)} (lamp -> you ${want.toFixed(4)}), silhouette cut out to r ${cutR.toFixed(1)} px (body 18); self-shading x${shade.alpha.toFixed(3)} (.42 x the dominant light's contrast: ACT.even .3 at an even share .. 1; QA1 has more fixtures sharing the light here), darker side toward ${gradAng.toFixed(4)}; layers ${JSON.stringify(layers)}` };
});
function lampOfP(p, i) { const t = p.clock / 1000; return Math.min(.9, (i % 13 === 0 ? .13 + .06 * Math.max(0, Math.sin(t * 11 + i)) : .43)); }
run('U19 BR2B the dominant light is the one that really reaches the actor, not the nearest: at (784, 2772) the nearest lamp (3, 232 px) is walled off and lamp 90 (254 px) lights you - the shadow follows lamp 90 (Stage 3B-L QA1 fixture layout; before it: (772, 3174), lamps 4 / 1)', () => {
  const p = makePage(); warm(p, { x: 784, y: 2772, on: false }); const me = p.R.actors().filter(j => j.self), pr = p.R.probe(784, 2772), a = pr.lamps.find(l => l.i === 3), b = pr.lamps.find(l => l.i === 90);
  return { ok: me.length === 1 && me[0].light === 'L90' && !!a && a.light === 0 && !!b && b.light > 0, note: `shadow from ${me.map(j => j.light)} (probe: lamp 3 ${a ? a.light : '-'}, lamp 90 ${b ? b.light.toFixed(3) : '-'})` };
});
run('U20 BR2B hysteresis: between two nearly equal lamps (1156, 3684: lamps 5 / 94; Stage 3B-L QA1 fixture layout, before it (952, 3558): lamps 5 / 4), walking back and forth across the balance line never flips the shadow, and its strength never jumps', () => {
  const p = makePage(); warm(p, { x: 1156, y: 3684, on: false }); let flips = 0, last = null, jump = 0, prevA = null;
  for (let k = 0; k < 60; k++) { const dx = Math.sin(k * .7) * 14; p.frame({ x: 1156 + dx, y: 3684 - dx * .5, on: false }); const me = p.R.actors().filter(j => j.self && j.dominant); const l = me.length ? me[0].light : null; if (last !== null && l !== last) flips++; last = l;
    const a = p.R.actors().filter(j => j.self).reduce((s, j) => s + j.a, 0); if (prevA !== null) jump = Math.max(jump, Math.abs(a - prevA)); prevA = a; }
  return { ok: flips === 0 && jump < .2, note: `dominant light changes ${flips} over 60 frames of ±14 px wandering; largest frame-to-frame change of the total removal ${jump.toFixed(3)}` };
});
run('U21 BR2B a Hound you can see gets a shadow from its dominant light; a Smiler never (no body, contact or silhouette shadow); a Hound behind a wall (out of your sight) gets none', () => {
  const p = makePage(); creature(p, 1110, 3330, { __hound: true, rotation: 0 }); creature(p, 1000, 3360, { __smiler: true }); creature(p, 700, 3300, { __hound: true, rotation: 0 });   // the last one is behind the partition (x 864..960)
  warm(p, { x: 1060, y: 3300, on: false }); const jobs = p.R.actors(), hound = jobs.filter(j => j.kind === 'hound'), nearSmiler = jobs.filter(j => Math.hypot(j.x - 1000, j.y - 3360) < 40);
  return { ok: hound.length === 1 && Math.hypot(hound[0].x - 1110, hound[0].y - 3330) < 1 && nearSmiler.length === 0, note: `hound shadows ${hound.length} (at ${hound.map(j => [j.x, j.y])}, from ${hound.map(j => j.light)}); shadows at the Smiler ${nearSmiler.length}; behind the wall: ${jobs.some(j => j.x === 700) ? 'DRAWN' : 'none'}` };
});
run('U22 BR2B tiers: LOW and MEDIUM one shadow per actor (the dominant light); HIGH may add one faint second shadow (<= 45 % of the first) when a second light matters', () => {
  const out = {}; let ok = true;
  for (const q of ['low', 'medium', 'high']) { const p = makePage(); p.R.setQuality(q); warm(p, { x: 1156, y: 3684, on: false }); const me = p.R.actors().filter(j => j.self).sort((a, b) => b.a - a.a);   // (U20's balance point)
    out[q] = me.map(j => `${j.light} ${j.a.toFixed(3)}`).join(' + ');
    if (q === 'high' ? !(me.length >= 1 && me.length <= 2 && (me.length === 1 || me[1].a <= me[0].a * .45 + 1e-9)) : me.length !== 1) ok = false; }
  return { ok, note: JSON.stringify(out) };
});

/* ---------- BR2C: softness, peers, colour ---------- */
run('U23 BR2C colour: carried-light tints are summed (`lighter`: overlapping colours average, order-independent) and laid on at a bounded strength; a single light keeps BR1.1\'s tint exactly (.25 of its light)', () => {
  const pk = (c1, c2) => { const p = makePage(); p.win.__peerLights = [{ x: 1000, y: 3330, angle: 0, kind: 'flashlight', color: c1, on: true }, { x: 1010, y: 3420, angle: -.4, kind: 'flashlight', color: c2, on: true }]; warm(p, { x: 1060, y: 3300, on: false }); return p.log; };
  const A = pk('#9fd4ff', '#ffb070'), B = pk('#ffb070', '#9fd4ff');
  /* the tints go into the canvas the overlay gets second (source-over); BR-RoLE 1.1's far buffer is added to the light buffer at 1 / 2 (not a tint) */
  const tints = L => { const ov = L.filter(o => o.canvas === 'overlay' && o.op === 'drawImage'), tb = ov[1] && ov[1].src; return L.filter(e => e.op === 'drawImage' && e.args.length === 8 && e.canvas === tb && (e.gco === 'lighter' || e.gco === 'source-over') && e.alpha > .3 && e.alpha < .6); };
  const ta = tints(A), ovA = A.filter(e => e.canvas === 'overlay' && e.op === 'drawImage'), ovB = B.filter(e => e.canvas === 'overlay' && e.op === 'drawImage');
  const ok = ta.length === 2 && ta.every(e => e.gco === 'lighter' && Math.abs(e.alpha - .5) < 1e-9) && ovA[1] && ovA[1].gco === 'source-over' && Math.abs(ovA[1].alpha - .5) < 1e-9 && JSON.stringify(ovA.map(e => [e.gco, e.alpha])) === JSON.stringify(ovB.map(e => [e.gco, e.alpha]));
  return { ok, note: `tint draws ${ta.map(e => e.gco + ' x' + e.alpha).join(', ')}; laid on the overlay ${ovA[1] && ovA[1].gco} x${ovA[1] && ovA[1].alpha} (one light: .5 x .5 = .25 of its light, as BR1.1); peers swapped: the same composition` };
});
run('U24 BR2C a lantern\'s flame casts from a fixed ring around the hand: turning does not move its shadows (no wobble); its brightness still flickers', () => {
  const froms = ang => { const p = makePage(); p.R.setQuality('high'); warm(p, { x: 1060, y: 3440, angle: ang, kind: 'lantern' }); const L = p.log, fi = L.findIndex(e => e.op === 'fillRect' && e.style && e.style.kind === 'radial' && e.style.r[1] === 228), out = [];
    for (const f of L.filter((e, j) => j > fi && e.op === 'fill' && e.subs && e.subs.length)) { const c = checkShadowFill(p.g, f, 228); if (c.from) out.push(c.from.map(v => +v.toFixed(3)).join(',')); } return out.sort(); };
  const a = froms(0), b = froms(2.1);
  return { ok: a.length === 6 && JSON.stringify(a) === JSON.stringify(b), note: `source points at aim 0: ${a.length}, the same at aim 2.1: ${JSON.stringify(a) === JSON.stringify(b)}` };
});
run('U25 BR2C a peer\'s flashlight casts the counter\'s shadow inside its own beam (its own prop casters, within the frame budget), and fills a lamp\'s shadow like yours', () => {
  const p = makePage(); p.win.__peerLights = [{ x: 3400, y: 1250, angle: -Math.PI / 2, kind: 'flashlight', color: '#ffe7b2', on: true }]; warm(p, { x: 3700, y: 1300, on: false });
  const fills = p.log.filter(e => e.op === 'fill' && e.subs && e.subs.length), cf = fills.filter(f => splitFill(p.g, f).props.some(q => q.prop.x === L4.x && q.prop.y === L4.y)), withCounter = cf.length, worldTf = cf.every(f => Math.abs(f.transform[0] - 1.18 * .75) < 1e-9);   // drawn in world space (BR3 regression guard)
  let X = null; for (let y = 1046; y < 1100 && !X; y += 3) for (let x = 3330; x < 3520 && !X; x += 4) { const r = p.R.probe(x, y); if (r.lamps.some(l => l.i === 31) && r.lamps.filter(l => l.i === 31 || l.i === 29).every(l => l.light === 0) && r.carried.some(c => !c.own && c.light > .2)) X = [x, y]; }   // BR-RoLE 1.1: other lamps' tails may reach it
  return { ok: withCounter > 0 && worldTf && !!X, note: `peer shadow fills with the counter: ${withCounter} (in world space: ${worldTf}); a lamp-shadowed spot the peer lights: ${X}` };
});

/* ---------- BR2.1: self-shading and prettier casts ---------- */
function handsOn(p) { const hs = []; for (const sx of [-1, 1]) { const h = new Container(); h.position.set(sx * 13, -13); hs.push(h); } p.person.hands = hs; p.person.rotation = .6; }
run('U26 BR2.1 the player\'s two hands are part of the silhouette: each gets the same self-shading gradient as the body, the cast is cut out around them too and starts past them (one pass, the dominant light only)', () => {
  const p = makePage(); handsOn(p); warm(p, { x: 1060, y: 3300, on: false }); const L = p.log, me = p.R.actors().find(j => j.self), k = 1.18 * .75;
  const shades = L.filter(e => e.op === 'drawImage' && e.gco === 'destination-out' && e.args.join() === '-1,-1,2,2' && Math.abs(e.alpha - me.shade) < 1e-9);
  const centres = shades.map(e => [(e.transform[4] - (640 - 1060 * 1.18) * .75) / k, (e.transform[5] - (360 - 3300 * 1.18) * .75) / k]);
  const c = Math.cos(.6), sn = Math.sin(.6), want = [[1060, 3300], ...[-1, 1].map(sx => [1060 + c * sx * 13 - sn * -13, 3300 + sn * sx * 13 + c * -13])];
  const match = want.every(w => centres.some(q => Math.hypot(q[0] - w[0], q[1] - w[1]) < 1e-6));
  const g = [Math.cos(me.ang), Math.sin(me.ang)], handReach = Math.max(...want.slice(1).map(w => (w[0] - 1060) * g[0] + (w[1] - 3300) * g[1] + 6.5));
  return { ok: me.sil.length === 3 && shades.length === 3 && match && me.start >= Math.max(18, handReach) - 1e-9, note: `silhouette parts ${me.sil.length}; self-shading draws ${shades.length} at body + hands: ${match}; cast starts ${me.start.toFixed(1)} px out (body 18, hands reach ${handReach.toFixed(1)})` };
});
run('U27 BR2.1 a Hound\'s torso (an ellipse along its heading) gets a restrained self-shading whose gradient still runs exactly away from its light, and a cast cut around it; a Smiler gets neither', () => {
  const p = makePage(); creature(p, 1110, 3330, { __hound: true, rotation: 1.1 }); creature(p, 1000, 3360, { __smiler: true });
  warm(p, { x: 1060, y: 3300, on: false }); const jobs = p.R.actors(), h = jobs.find(j => j.kind === 'hound'), L = p.log, k = 1.18 * .75;
  const sh = L.find(e => e.op === 'drawImage' && e.gco === 'destination-out' && e.args.join() === '-1,-1,2,2' && Math.abs(e.alpha - h.shade) < 1e-9 && Math.abs(e.transform[4] - ((1110 + Math.cos(1.1 - Math.PI / 2) * 4) * k + (640 - 1060 * 1.18) * .75)) < 1e-6);
  const [a, b, c, d] = sh.transform, det = a * d - b * c, gx = d / det, gy = -c / det, gAng = Math.atan2(gy, gx);   // the gradient of texture x in the world: M^-T e1
  const nearSmiler = jobs.filter(j => Math.hypot(j.x - 1000, j.y - 3360) < 40).length;
  return { ok: !!h && h.shade > 0 && h.shade <= .3 + 1e-9 && Math.abs(Math.atan2(Math.sin(gAng - h.ang), Math.cos(gAng - h.ang))) < 1e-6 && h.a > 0 && nearSmiler === 0, note: `hound self-shading x${h && h.shade.toFixed(3)}, gradient ${gAng.toFixed(4)} vs light -> hound ${h && h.ang.toFixed(4)}; cast x${h && h.a.toFixed(3)}; anything at the Smiler: ${nearSmiler}` };
});
run('U28 BR2.1 cast shape response: longer and fainter the farther the light (bounded), short and dark close to it, nothing right under it; HIGH\'s faint second cast carries no second self-shading', () => {
  const at = (x, y, q) => { const p = makePage(); if (q) p.R.setQuality(q); warm(p, { x, y, on: false }); return p.R.actors().filter(j => j.self); };
  const lp = GAME.Fc[4], close = at(lp.x + 50, lp.y + 15)[0], far = at(lp.x + 170, lp.y + 60)[0], under = at(lp.x + 2, lp.y + 3), hi = at(952, 3558, 'high');
  const second = hi.filter(j => !j.dominant), ok = close && far && far.ext > close.ext && far.ext <= 84 && far.a < close.a && (under.length === 0 || under.every(j => j.a === 0 && j.shade === 0) || under[0].light !== 'L4') && second.every(j => j.shade === 0);
  return { ok, note: `near the lamp: ${close && close.ext.toFixed(1)} px x${close && close.a.toFixed(3)}; farther: ${far && far.ext.toFixed(1)} px x${far && far.a.toFixed(3)}; under it: ${JSON.stringify(under.map(j => [j.light, +j.a.toFixed(3), +j.shade.toFixed(3)]))}; HIGH second casts ${second.length}, their self-shading ${second.map(j => j.shade)}` };
});

run('U29 BR2.1B self-shading follows the light\'s contrast (one dominant lamp: full; two even lamps: faint, never two crescents), and a carried light\'s direction on a Hound is eased (a hand jump turns its shadow over a few frames, not at once)', () => {
  const sh = (x, y) => { const p = makePage(); warm(p, { x, y, on: false }); const j = p.R.actors().filter(q => q.self && q.shade); return j; };
  const one = sh(1060, 3300), even = sh(952, 3558);
  const p = makePage(); creature(p, 1180, 3300, { __hound: true, rotation: 0 }); warm(p, { x: 1060, y: 3300, angle: 0 });
  const h0 = p.R.actors().find(j => j.kind === 'hound' && j.lightKind === 'carried'); p.frame({ x: 1060, y: 3340, angle: -.3 }); const h1 = p.R.actors().find(j => j.kind === 'hound' && j.lightKind === 'carried');
  const full = Math.atan2(3300 - 3340, 1180 - 1060), stepped = h0 && h1 ? Math.abs(h1.ang - h0.ang) : 0, wanted = h0 ? Math.abs(full - h0.ang) : 0;
  const ok = one.length === 1 && even.length === 1 && even[0].shade < one[0].shade * .75 && !!h0 && !!h1 && stepped > 0 && stepped < wanted * .5;
  return { ok, note: `self-shading: one lamp x${one[0] && one[0].shade.toFixed(3)}, even lamps x${even[0] && even[0].shade.toFixed(3)} (${even.length} crescent); Hound in your beam: you step 40 px, its shadow turns ${stepped.toFixed(3)} of ${wanted.toFixed(3)} rad this frame` };
});

run('U30 BR2.1C a prop shadow is no uniform slab: behind the counter your flashlight\'s light is fully gone at the footprint and comes back gradually toward the shadow\'s far end (height impression); the counter\'s top stays lit', () => {
  const p = makePage(); p.R.setQuality('low'); warm(p, { x: 3430, y: 880, angle: Math.atan2(1046 - 880, 3380 - 3430) });
  const b = [3430, 880], d = [3380 - b[0], 1046 - b[1]], L = Math.hypot(d[0], d[1]), u = [d[0] / L, d[1] / L], prof = [];
  for (let t = 0; t <= 228; t += 12) { const x = 3405 + u[0] * t, y = 1034 + u[1] * t, r = p.R.probe(x, y).carried.find(c => c.own); prof.push(r ? +r.visible.toFixed(3) : null); }
  const first = prof.findIndex(v => v !== null), tail = prof.filter(v => v !== null), top = p.R.probe(3400, 1008).carried.find(c => c.own);
  let mono = true; for (let i = 1; i < tail.length; i++) if (tail[i] < tail[i - 1] - 1e-9) mono = false;
  return { ok: tail[0] === 0 && tail.some(v => v > 0 && v < 1) && mono && top && top.visible === 1, note: `your beam's visibility walking away from the counter's far edge: ${JSON.stringify(tail)}; on the counter top ${top && top.visible}` };
});

run('U31 BR3 a beam works in its sector\'s box, not its whole circle (the field is zero outside the cone): smaller, still holding the hand and both edges of the cone at full range', () => {
  const p = makePage(); warm(p, { x: 1060, y: 3440, angle: -2.84 }); const L = p.log, k = 1.18 * .75, ox = (640 - 1060 * 1.18) * .75, oy = (360 - 3440 * 1.18) * .75;
  const fi = L.findIndex(e => e.op === 'fillRect' && e.style && e.style.kind === 'radial' && e.style.r[1] === 390), clr = L.slice(0, fi).reverse().find(e => e.canvas === L[fi].canvas && e.op === 'clearRect'), r = clr.rect;
  const pts = [[1060, 3440], ...[-1, 1].map(sg => [1060 + Math.cos(-2.84 + sg * .46) * 390, 3440 + Math.sin(-2.84 + sg * .46) * 390])].map(([x, y]) => [x * k + ox, y * k + oy]);
  const inside = pts.every(([x, y]) => x >= r[0] - 1e-6 && x <= r[0] + r[2] + 1e-6 && (y >= r[1] - 1e-6 || r[1] === 0) && y <= r[1] + r[3] + 1e-6), circle = (2 * 390 * k + 4) ** 2;
  return { ok: inside && r[2] * r[3] < circle * .6, note: `box ${r.map(v => Math.round(v))} = ${Math.round(r[2] * r[3])} px (the circle's ${Math.round(circle)}); holds the hand and the cone's edges: ${inside}` };
});
run('U32 BR3 the v23.3.6 hand-aura QOL (retained HQA X03) holds under BR-RoLE: your 52 px aura (.35) only while your light is ON, none switched off or on the camcorder (night vision), 150 px (.73) as the death torch; dead / switched-off / camcorder peers get none', () => {
  const glows = L => L.filter(e => e.op === 'fillRect' && e.style && e.style.kind === 'radial' && (e.style.r[1] === 52 || e.style.r[1] === 150)).map(e => [e.style.r[1], +String(e.style.stops[0][1]).split(',').pop().replace(')', '')]);
  const run1 = o => { const p = makePage(); p.win.__peerLights = [{ x: 1100, y: 3300, angle: 0, kind: 'camcorder', on: true, ir: 1 }, { x: 1120, y: 3300, angle: 0, kind: 'flashlight', on: true, dead: true }, { x: 1140, y: 3300, angle: 0, kind: 'flashlight', on: false }]; p.frame(o); p.frame(o); return glows(p.log); };
  const on = run1({}), off = run1({ on: false }), cam = run1({ kind: 'camcorder' }), death = run1({ death: true });
  const ok = on.length === 1 && on[0][0] === 52 && Math.abs(on[0][1] - .35) < 1e-3 && !off.length && !cam.length && death.length === 1 && death[0][0] === 150 && Math.abs(death[0][1] - .73) < 1e-3;
  return { ok, note: `light on ${JSON.stringify(on)}; off ${JSON.stringify(off)}; camcorder ${JSON.stringify(cam)}; death torch ${JSON.stringify(death)} ([radius, alpha]); peers dead / off / camcorder: none` };
});

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name.split(' ')[0]).join(', ') : ''));
process.exitCode = pass === results.length ? 0 : 1;
