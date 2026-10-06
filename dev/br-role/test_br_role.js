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
  let curPath = [];
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
    beginPath() { curPath = []; }, moveTo(x, y) { curPath.push(x, y); }, lineTo(x, y) { curPath.push(x, y); }, closePath() { }, arc() { }, fill() { rec('fill', { style: st.fillStyle }); },
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
const GAME = makeGame();
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
  vm.runInContext(read('world.js'), ctx); vm.runInContext(read('light.js'), ctx); vm.runInContext(read('assets/br-role.js'), ctx);
  page.R = win.__brRole;
  /* one frame as drawLight hands it over: world scale 1.18, camera on the player, the overlay context */
  page.frame = (o = {}) => { page.clock += 16.7; log.length = 0; const r = 1.18, x = o.x ?? H.x, y = o.y ?? H.y;
    if (o.x !== undefined) { H.x = x; H.y = y; } if (o.angle !== undefined) H.angle = o.angle;
    const F = { t: page.clock / 1000, on: o.on !== false, r, ox: 640 - x * r, oy: 360 - y * r, w: 1280, h: 720, viewer: { x, y }, src: { x, y, angle: H.angle }, kind: o.kind || 'flashlight', color: o.color || '#ffe7b2', death: false };
    const ok = page.R.on() && page.R.draw(page.overlay.getContext('2d'), F); return ok; };
  return page;
}
const lampFills = (log) => log.filter(e => e.canvas !== 'overlay' && e.op === 'fillRect' && e.style && e.style.kind === 'radial' && Math.abs(e.style.r[1] - 380) < 1e-9);

run('U01 loads, attaches above the carpet on the first frame, and takes over the light (on() true); version reported', () => {
  const p = makePage(); const before = p.R.on(); const ok = p.frame(); const i = p.win.__api.floor().parent.children.findIndex(c => c.label === 'br-role');
  return { ok: ok && before === true && i === 1 && p.R.stats().attached && /^br-role/.test(p.R.version), note: `version ${p.R.version}, layer index ${i}, vertices ${p.R.stats().vertices}` };
});
run('U02 one compositor: every light is added to the light buffer (`lighter`) under its own clip, and the overlay loses the buffer once (destination-out), then the beam colour (source-over)', () => {
  const p = makePage(); p.frame({ x: 1130, y: 3420, angle: 2.6 }); const L = p.log;
  const ov = L.filter(e => e.canvas === 'overlay' && e.op === 'drawImage'), lamps = lampFills(L), clipped = lamps.every(e => e.clip >= 1), lighter = lamps.every(e => e.gco === 'lighter');
  const carriedToBuf = L.filter(e => e.canvas !== 'overlay' && e.op === 'drawImage' && e.gco === 'lighter');
  return { ok: lamps.length > 0 && clipped && lighter && carriedToBuf.length === 1 && ov.length === 2 && ov[0].gco === 'destination-out' && ov[1].gco === 'source-over',
    note: `lamps drawn ${lamps.length} (each clipped ${clipped}, lighter ${lighter}); carried lights added ${carriedToBuf.length}; overlay: ${ov.map(e => e.gco).join(' then ')}` };
});
run('U03 occlusion: a lamp\'s visibility polygon is the game\'s own ray query aimed at every corner in reach - each vertex is where a ray stops, and visible corners are on its outline (no 96-ray raggedness)', () => {
  const p = makePage(); p.frame({ x: 1130, y: 3420, angle: 2.6 }); const lp = p.g.Fc[4], clip = p.log.find(e => e.op === 'clip' && e.path.length > 200 && Math.abs(e.path[0] - lp.x) < 400);
  const poly = p.log.filter(e => e.op === 'clip').map(e => e.path).find(q => { for (let k = 0; k < q.length; k += 2) if (Math.hypot(q[k] - lp.x, q[k + 1] - lp.y) > 379) return true; return false; });
  let bad = 0, pts = 0; for (let k = 0; k < poly.length; k += 2) { pts++; const dx = poly[k] - lp.x, dy = poly[k + 1] - lp.y, d = Math.hypot(dx, dy); if (Math.abs(p.g.Uc(lp.x, lp.y, Math.atan2(dy, dx), 380) - d) > .01) bad++; }
  /* the partition corner (960, 3360) right beside the spawn lamp must be a vertex of its outline */
  let near = Infinity; for (let k = 0; k < poly.length; k += 2) near = Math.min(near, Math.hypot(poly[k] - 960, poly[k + 1] - 3360));
  return { ok: !!clip && pts > 96 && bad === 0 && near < .1, note: `${pts} outline points, off-ray ${bad}, nearest to the corner (960,3360): ${near.toFixed(4)} px` };
});
run('U04 blackout: no lamp is drawn; your light still is; lamps come back after', () => {
  const p = makePage(); p.frame(); const a = lampFills(p.log).length; p.g.V.blackout = true; p.frame(); const b = lampFills(p.log).length, own = p.R.stats().carried.last; p.g.V.blackout = false; p.frame(); const c = lampFills(p.log).length;
  return { ok: a > 0 && b === 0 && own === 1 && c === a, note: `lamps ${a} -> blackout ${b} (carried ${own}) -> ${c}` };
});
run('U05 lamp strength is the game\'s own: .43 (dim fixtures .13 + .06·max(0, sin(11t + i))), times failures and the NV gain, capped at .9', () => {
  const p = makePage(); let worst = 0, n = 0, dims = 0;
  const strengths = () => lampFills(p.log).map(e => +e.style.stops[0][1].match(/[\d.]+\)$/)[0].slice(0, -1));
  for (const [f, gain] of [[1, 1], [.25, 1], [1, 1.5], [1, 3]]) {
    p.win.__ents.lamp = () => f; p.win.__cam = { lampGain: () => gain }; p.frame({ x: 600, y: 2930 });
    const t = p.clock / 1000, S = p.R.stats();
    for (const e of lampFills(p.log)) { const i = p.g.Fc.findIndex(l => Math.abs(l.x - e.style.at[0]) < 1e-9 && Math.abs(l.y - e.style.at[1]) < 1e-9); const exp = Math.min(.9, (i % 13 === 0 ? .13 + .06 * Math.max(0, Math.sin(t * 11 + i)) : .43) * f * gain), got = +e.style.stops[0][1].match(/,([\d.]+)\)$/)[1];
      if (i % 13 === 0) dims++; worst = Math.max(worst, Math.abs(got - exp)); n++; }
    void S; void strengths;
  }
  return { ok: n > 8 && dims > 0 && worst < 1e-4, note: `${n} lamp draws checked (dim fixtures ${dims}), largest difference from the formula ${worst.toExponential(1)}` };
});
run('U06 tiers: the light buffer is the CSS viewport x .5 / .75 / 1.0 - never scaled by devicePixelRatio; lamps and other wanderers are drawn up to each tier\'s cap (the last one may be fading)', () => {
  const out = {};
  for (const dpr of [1, 3]) for (const q of ['low', 'medium', 'high']) {
    const p = makePage({ dpr }); p.R.setQuality(q); p.win.__peerLights = []; for (let k = 0; k < 10; k++) p.win.__peerLights.push({ x: 1060 + Math.cos(k) * (120 + 14 * k), y: 3300 + Math.sin(k) * (120 + 14 * k), angle: k, kind: ['flashlight', 'headlamp', 'lantern'][k % 3], color: '#ffe7b2', on: true });
    p.frame(); const s = p.R.stats(), t = p.R.tiers()[q]; out[q + '@' + dpr] = { buf: s.buffer.join('x'), lamps: s.lamps.last + '/' + t.lamps, peers: s.carried.peers + '/' + t.peers };
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
    for (const e of p.log) { n++; const nums = [...(e.rect || []), ...(e.path || []), ...(e.args || []), ...e.transform]; if (nums.some(v => typeof v === 'number' && !Number.isFinite(v))) bad++; } }
  return { ok: bad === 0 && p.R.on(), note: `${n} canvas calls, non-finite ${bad}, still on ${p.R.on()}` };
});

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name.split(' ')[0]).join(', ') : ''));
process.exitCode = pass === results.length ? 0 : 1;
