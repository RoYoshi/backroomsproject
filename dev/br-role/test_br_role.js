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
    beginPath() { curPath = []; subs = []; }, moveTo(x, y) { curPath.push(x, y); subs.push([x, y]); }, lineTo(x, y) { curPath.push(x, y); if (subs.length) subs[subs.length - 1].push(x, y); }, closePath() { }, arc() { }, rect() { },
    fill() { rec('fill', { style: st.fillStyle, path: curPath.slice(), subs: subs.map(q => q.slice()) }); },
    clip() { st.clip++; rec('clip', { path: curPath.slice() }); },
    createRadialGradient(x0, y0, r0, x1, y1, r1) { const g = { kind: 'radial', at: [x1, y1], r: [r0, r1], stops: [] }; g.addColorStop = (o, col) => g.stops.push([o, col]); return g; },
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
  const page = { g, win, log, H, clock: 1000, warns: [], rays: 0, overlay: mkCanvas(log, 'overlay') };
  const ctx = vm.createContext(win);
  vm.runInContext(read('world.js'), ctx); vm.runInContext(read('light.js'), ctx);
  if (opts.extraProps) for (const r of opts.extraProps) win.WORLD.PROPS.push({ id: 'X' + win.WORLD.PROPS.length, type: 'low', kind: 'counter', rect: r });
  vm.runInContext(read('assets/br-role.js'), ctx);
  page.R = win.__brRole;
  /* one frame as drawLight hands it over: world scale 1.18, camera on the player, the overlay context */
  page.frame = (o = {}) => { page.clock += 16.7; log.length = 0; const r = 1.18, x = o.x ?? H.x, y = o.y ?? H.y;
    if (o.x !== undefined) { H.x = x; H.y = y; } if (o.angle !== undefined) H.angle = o.angle;
    const F = { t: page.clock / 1000, on: o.on !== false, r, ox: 640 - x * r, oy: 360 - y * r, w: 1280, h: 720, viewer: { x, y }, src: { x, y, angle: H.angle }, kind: o.kind || 'flashlight', color: o.color || '#ffe7b2', death: false };
    const ok = page.R.on() && page.R.draw(page.overlay.getContext('2d'), F); return ok; };
  return page;
}
/* a lamp is added to the light buffer as its cached shadowed field: drawImage(cache, x - 380, y - 380, 760, 760), `lighter`,
 * at globalAlpha = strength / P0 (.9) */
const lampDraws = (log) => log.filter(e => e.op === 'drawImage' && e.gco === 'lighter' && e.args.length === 4 && Math.abs(e.args[2] - 760) < 1e-9);
const lampOf = (g, e) => g.Fc.findIndex(l => Math.abs(l.x - (e.args[0] + 380)) < 1e-9 && Math.abs(l.y - (e.args[1] + 380)) < 1e-9);
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
  return { ok: ok && before === true && i === 1 && p.R.stats().attached && /^br-role BR2/.test(p.R.version) && b.sides > 100 && b.pillars === p.g.Pc.length, note: `version ${p.R.version}, layer index ${i}, blocker sides ${b.sides} (pillars ${b.pillars} of ${p.g.Pc.length})` };
});
run('U02 one compositor, no visibility polygon: nothing is ever clipped; every light is ADDED to the light buffer (`lighter`): each lamp as its own shadowed field, each carried light (beam, then hand glow); the overlay loses the buffer once (destination-out), then the beam colour (source-over)', () => {
  const p = makePage(); warm(p, { x: 1130, y: 3420, angle: 2.6 }); const L = p.log;
  const clips = L.filter(e => e.op === 'clip').length, lamps = lampDraws(L), ov = L.filter(e => e.canvas === 'overlay' && e.op === 'drawImage');
  const carriedToBuf = L.filter(e => e.canvas !== 'overlay' && e.op === 'drawImage' && e.gco === 'lighter' && e.args.length === 8);
  return { ok: clips === 0 && lamps.length >= 3 && lamps.every(e => e.clip === 0) && carriedToBuf.length === 2 && ov.length === 2 && ov[0].gco === 'destination-out' && ov[1].gco === 'source-over',
    note: `clips ${clips}; lamps added ${lamps.length} (each its shadowed field, lighter); carried pieces added ${carriedToBuf.length} (beam, glow); overlay: ${ov.map(e => e.gco).join(' then ')}` };
});
run('U03 lamp: LIGHT FIELD -> BLOCKER -> CAST SHADOW.  The spawn lamp\'s cache is its full unclipped field first; then, from each point of its tube, every wall / pillar side facing that point casts the polygon of its two corners projected away from it; the averaged shadows are taken out of the field (destination-out)', () => {
  const p = makePage(); let L = null, cache = null; const lp = p.g.Fc[4], tube = p.R.tiers().medium.tube;
  for (let k = 0; k < 6 && !cache; k++) { p.frame({ x: 1130, y: 3420, angle: 2.6 }); L = p.log; const f = L.find(e => e.op === 'fillRect' && e.style && e.style.kind === 'radial' && e.style.r[1] === 380 && e.style.at[0] === lp.x && e.style.at[1] === lp.y); if (f) cache = f.canvas; }
  const ops = L.filter(e => e.canvas === cache && e.op !== 'clearRect'), field = ops[0], sub = ops.find(e => e.op === 'drawImage');
  const fieldOk = field && field.op === 'fillRect' && field.clip === 0 && field.gco === 'source-over' && Math.abs(field.style.r[1] - 380) < 1e-9 && sub && sub.gco === 'destination-out' && ops.indexOf(sub) > 0;
  const fills = L.filter(e => e.canvas === sub.src && e.op === 'fill' && L.indexOf(e) > L.indexOf(field) && L.indexOf(e) < L.indexOf(sub));
  let polys = 0, bad = 0, outside = 0; const froms = [];
  for (const f of fills) { const c = checkShadowFill(p.g, f, 380); polys += c.polys; bad += c.badShape + c.badFrom + c.badSide + c.badFar; if (c.from) { froms.push(c.from); if (Math.abs(c.from[0] - lp.x) > 40.01 || Math.abs(c.from[1] - lp.y) > 8.01) outside++; } }
  const allLighter = fills.every(f => f.gco === 'lighter'), spread = Math.max(...froms.map(q => q[0])) - Math.min(...froms.map(q => q[0]));
  return { ok: fieldOk && fills.length === tube && allLighter && polys > tube && bad === 0 && outside === 0 && spread > 60,
    note: `field first, unclipped: ${fieldOk}; ${fills.length} tube points (tier ${tube}), spread ${spread.toFixed(1)} px along the tube; ${polys} shadow polygons, each from its tube point, on a facing blocker side, projected away beyond 380 px: bad ${bad}` };
});
run('U04 blackout: no lamp is drawn; your light still is; lamps come back after', () => {
  const p = makePage(); warm(p); const a = lampDraws(p.log).length; p.g.V.blackout = true; p.frame(); const b = lampDraws(p.log).length, own = p.R.stats().carried.last; p.g.V.blackout = false; p.frame(); const c = lampDraws(p.log).length;
  return { ok: a > 0 && b === 0 && own === 1 && c === a, note: `lamps ${a} -> blackout ${b} (carried ${own}) -> ${c}` };
});
run('U05 lamp strength is the game\'s own: .43 (dim fixtures .13 + .06·max(0, sin(11t + i))), times failures and the NV gain, capped at .9 (the cached field is added at strength / .9)', () => {
  const p = makePage(); let worst = 0, n = 0, dims = 0; warm(p, { x: 600, y: 2930 });
  for (const [f, gain] of [[1, 1], [.25, 1], [1, 1.5], [1, 3]]) {
    p.win.__ents.lamp = () => f; p.win.__cam = { lampGain: () => gain }; p.frame({ x: 600, y: 2930 });
    const t = p.clock / 1000;
    for (const e of lampDraws(p.log)) { const i = lampOf(p.g, e), exp = Math.min(.9, (i % 13 === 0 ? .13 + .06 * Math.max(0, Math.sin(t * 11 + i)) : .43) * f * gain), got = e.alpha * .9;
      if (i % 13 === 0) dims++; worst = Math.max(worst, Math.abs(got - exp)); n++; }
  }
  return { ok: n > 8 && dims > 0 && worst < 1e-9, note: `${n} lamp draws checked (dim fixtures ${dims}), largest difference from the formula ${worst.toExponential(1)}` };
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

run('U12 flashlight: its natural field first (radial falloff, then the smooth angular profile; no clip), then the shadows walls and pillars cast INSIDE the beam from the hand: one point at LOW (cut straight out), two / three across the hand at MEDIUM / HIGH (averaged); then added', () => {
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
    const hand = froms.every(f => Math.hypot(f[0] - X, f[1] - Y) <= 3.01), fieldFirst = L[fi].clip === 0 && prof.op === 'fillRect' && prof.style.kind === 'conic' && prof.gco === 'destination-in';
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
run('U15 BR2A lamp: the counter beside lamp 31 casts, from EVERY tube point, the hull of its base and its top projected away from that point (x 70 / (180 - 70)), into the same averaged shadow as the walls (same winding); its own top is cut back out (opposite winding: stays lit)', () => {
  const p = makePage(); let L = null, cache = null; const lp = p.g.Fc[31], kk = 70 / 110;
  for (let k = 0; k < 8 && !cache; k++) { p.frame({ x: 3400, y: 1250, angle: -Math.PI / 2 }); L = p.log; const f = L.find(e => e.op === 'fillRect' && e.style && e.style.kind === 'radial' && e.style.r[1] === 380 && e.style.at[0] === lp.x && e.style.at[1] === lp.y); if (f) cache = f.canvas; }
  const field = L.find(e => e.canvas === cache && e.op === 'fillRect'), sub = L.find(e => e.canvas === cache && e.op === 'drawImage');
  const fills = L.filter(e => e.canvas === sub.src && e.op === 'fill' && L.indexOf(e) > L.indexOf(field) && L.indexOf(e) < L.indexOf(sub));
  let withCounter = 0, bad = 0, wind = 0, far = 0;
  for (const f of fills) {
    const c = checkShadowFill(p.g, f, 380); wind += c.badWinding; const S = c.from, pr = splitFill(p.g, f).props.find(q => q.prop.x === L4.x && q.prop.y === L4.y); if (!pr || !S) continue; withCounter++;
    const want = []; for (const [cx, cy] of [[L4.x, L4.y], [L4.x + L4.w, L4.y], [L4.x + L4.w, L4.y + L4.h], [L4.x, L4.y + L4.h]]) want.push([cx, cy], [cx + (cx - S[0]) * kk, cy + (cy - S[1]) * kk]);
    for (let i = 0; i < pr.hull.length; i += 2) { const v = [pr.hull[i], pr.hull[i + 1]]; if (!want.some(w => Math.hypot(w[0] - v[0], w[1] - v[1]) < 1e-6)) bad++;
      const base = want.filter((w, j) => j % 2 === 0).some(w => Math.hypot(w[0] - v[0], w[1] - v[1]) < 1e-6); if (!base) { const d = Math.hypot(v[0] - S[0], v[1] - S[1]), b0 = want[want.findIndex(w => Math.hypot(w[0] - v[0], w[1] - v[1]) < 1e-6) - 1]; if (!(b0 && d > Math.hypot(b0[0] - S[0], b0[1] - S[1]))) far++; } }
  }
  return { ok: fills.length === 16 && withCounter === 16 && bad === 0 && wind === 0 && far === 0, note: `${fills.length} tube points, counter shadow from ${withCounter} of them; hull vertices off (base, top + (corner - point) x ${kk.toFixed(3)}) ${bad}; projected toward the light ${far}; winding errors ${wind}` };
});
run('U16 BR2A behaviour (probe, the game\'s ray query + the prop\'s shadow): behind the counter the lamps are blocked but a flashlight from the open side lights it; a flashlight from the lamps\' side is blocked by the same counter there; the counter\'s own top stays lit', () => {
  const p = makePage(); warm(p, { x: 3400, y: 1250, angle: -Math.PI / 2 });
  let X = null;                                                          // a floor point behind the counter from both lamps (all their tube points), the flashlight reaching it
  for (let y = 1046; y < 1110 && !X; y += 4) for (let x = 3330; x < 3520 && !X; x += 6) { const r = p.R.probe(x, y), l31 = r.lamps.find(l => l.i === 31), l29 = r.lamps.find(l => l.i === 29); if (l31 && l29 && l31.visible === 0 && l29.visible === 0 && r.carried[0].light > .1) X = [x, y]; }
  const below = p.R.probe(X[0], X[1]), lampsBelow = below.lamps.reduce((a, l) => a + l.light, 0), beamBelow = below.carried[0].light;
  const unblocked = p.R.probe(X[0], X[1] + 120).lamps.find(l => l.i === 31).visible;   // the same lamp past the counter's shadow
  warm(p, { x: 3430, y: 880, angle: Math.atan2(X[1] - 880, X[0] - 3430) });
  const aim = Math.atan2(X[1] - 880, X[0] - 3430), above = p.R.probe(X[0], X[1]), beside = p.R.probe(3430 + Math.cos(aim) * 70, 880 + Math.sin(aim) * 70), top = p.R.probe(3400, 1008).lamps.find(l => l.i === 31);   // beside: in the same beam, before the counter
  const ok = !!X && lampsBelow === 0 && beamBelow > .1 && Math.abs(below.total - beamBelow) < 1e-9 && unblocked > 0 && above.carried[0].light === 0 && above.lamps.every(l => l.i !== 31 && l.i !== 29 || l.light === 0) && beside.carried[0].light > 0 && top.visible > .5;
  return { ok, note: `point ${X}: lamps 31/29 there ${lampsBelow} (past the shadow lamp 31 sees ${unblocked}); flashlight from below ${beamBelow.toFixed(3)} = total ${below.total.toFixed(3)}; flashlight from the lamps' side ${above.carried[0].light} (in the same beam before the counter ${beside.carried[0].light.toFixed(3)}); counter top sees lamp 31: ${top.visible}` };
});
run('U17 BR2A bounded: prop casters per light and per frame stay within the tier caps however many props are near (40 extra counters, several wanderers\' lights)', () => {
  const extra = []; for (let k = 0; k < 40; k++) extra.push({ x: 1000 + (k % 8) * 40, y: 3380 + Math.floor(k / 8) * 30, w: 24, h: 12 });
  const out = {}; let ok = true;
  for (const q of ['low', 'medium', 'high']) { const p = makePage({ extraProps: extra }); p.R.setQuality(q); p.win.__peerLights = []; for (let k = 0; k < 8; k++) p.win.__peerLights.push({ x: 1060 + k * 12, y: 3300, angle: Math.PI / 2, kind: 'flashlight', color: '#ffe7b2', on: true });
    warm(p, { x: 1060, y: 3330, angle: Math.PI / 2 }); const s = p.R.stats(), t = p.R.tiers()[q]; out[q] = `${s.props.last}/${t.propFrame} (per light ${t.props})`; if (!(s.props.last <= t.propFrame && s.props.last > 0)) ok = false; }
  return { ok, note: JSON.stringify(out) };
});

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name.split(' ')[0]).join(', ') : ''));
process.exitCode = pass === results.length ? 0 : 1;
