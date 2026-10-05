/* 2D Lighting & Shadows - focused unit tests for assets/shadows-2d.js (Node, no browser).
 *
 *   node dev/shadows/test_shadows.js            (exit code 1 on any failure; prints PASS/FAIL lines and "N/M passed")
 *
 * The module runs in a VM with:
 *   - the REAL level geometry, wall/ray queries, lamp list and equipment light model, extracted verbatim from the shipped
 *     bundle assets/index-DKbV5Nv9.js (the same code the browser runs),
 *   - the REAL light.js (__light.sample / ray / occluders),
 *   - a recording mock of the few Pixi classes the module reaches (Container, Graphics, Texture).
 * Nothing here changes any game file. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = []; let cur = '';
const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };

/* ---------- a recording mock of the Pixi surface the module uses ---------- */
class Pt { constructor() { this.x = 0; this.y = 0; } set(x, y) { this.x = x; this.y = y === undefined ? x : y; } }
class Container {
  constructor() { this.children = []; this.parent = null; this.position = new Pt(); this.scale = new Pt(); this.scale.set(1, 1); this.rotation = 0; this.alpha = 1; this.visible = true; this.label = ''; }
  get x() { return this.position.x; } set x(v) { this.position.x = v; } get y() { return this.position.y; } set y(v) { this.position.y = v; }
  addChild(...c) { for (const k of c) { if (k.parent) k.parent.removeChild(k); k.parent = this; this.children.push(k); } return c[0]; }
  addChildAt(c, i) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.splice(i, 0, c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } return c; }
  removeChildren() { const r = this.children.splice(0); for (const c of r) c.parent = null; return r; }
}
class Graphics extends Container {
  constructor() { super(); this.context = {}; this.quads = []; this.polys = []; }
  texture(tex, tint, x, y, w, h) { this.quads.push({ tex, x, y, w, h }); return this; }
  poly(p) { this.polys.push({ p, fill: null }); return this; }        // like Pixi: keeps the caller's array, no copy
  fill(s) { if (this.polys.length) this.polys[this.polys.length - 1].fill = s; return this; }
  clear() { this.quads = []; this.polys = []; return this; }
}
class Texture { constructor(src) { this.src = src; } static from(c) { return new Texture(c); } }

/* ---------- the shipped client's own level / light code, extracted verbatim from the bundle ---------- */
function makeGame() {
  const B = read('assets/index-DKbV5Nv9.js');
  const cut = (a, b) => { const i = B.indexOf(a), j = B.indexOf(b, i); assert(i >= 0 && j > i, 'bundle marker missing: ' + a); return B.slice(i, j); };
  const mapSrc = cut('var FBW=96', 'var Wc={kind:'), lightSrc = cut('var Gc={flashlight', 'function Jc(');
  const WORLD = require(path.join(ROOT, 'world.js'));
  const ctx = vm.createContext({ window: { WORLD }, Math, Uint8Array, Set, Object, Array, Number, console });
  vm.runInContext(mapSrc + ';\n' + lightSrc + ';\nthis.__x={FBW,FBH,kc,zc,Hc,Uc,Bc,Fc,Pc,Mc,Gc,qc,Ic,V};', ctx);
  return ctx.__x;
}

/* ---------- a fresh page: DOM / window stubs + world + module ---------- */
function makePage(opts = {}) {
  const g = makeGame(), T = 96;
  const store = new Map(), rafs = [], intervals = [];
  const canvas = () => { const c = { width: 0, height: 0, img: null, remove() { }, style: {} };          // keeps its pixels: tests read the module's textures
    c.getContext = () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData(img) { c.img = img; }, setTransform() { }, clearRect() { }, strokeRect() { }, beginPath() { }, ellipse() { }, stroke() { }, fillRect() { }, fillText() { }, moveTo() { }, lineTo() { }, closePath() { }, fill() { }, arc() { } });
    return c; };
  const doc = { readyState: 'complete', createElement: t => t === 'canvas' ? canvas() : { style: {}, addEventListener() { }, insertAdjacentElement() { }, remove() { }, setAttribute() { }, dataset: {} },
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() { } }, addEventListener() { } };
  const world = new Container(), carpet = new Container(); carpet.tileScale = new Pt(); carpet.texture = new Texture(null); carpet.width = g.FBW * T; carpet.height = g.FBH * T;
  const level = new Graphics(), corpseLayer = new Container(), person = new Container(), creatures = new Container(), lampTop = new Graphics();
  person.deathPose = () => { }; person.position.set(1060, 3300);
  world.addChild(carpet, level, corpseLayer, person, creatures, new Graphics(), lampTop);
  world.scale.set(1.18, 1.18); world.position.set(640 - 1060 * 1.18, 360 - 3300 * 1.18);
  const H = { x: 1060, y: 3300, angle: 0, equipment: { kind: 'flashlight' }, vx: 0, vy: 0 };
  let lightOn = opts.lightOn !== false;
  const win = {
    document: doc, location: { search: opts.search || '' }, screen: { width: 1920, height: 1080 }, innerWidth: 1280, innerHeight: 720,
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) },
    matchMedia: () => ({ matches: !!opts.coarse }), performance: { now: () => page.clock }, console: { warn: (...a) => page.warns.push(a.join(' ')), log() { } },
    requestAnimationFrame: f => { rafs.push(f); return rafs.length; }, setInterval: (f) => { intervals.push(f); return intervals.length; }, addEventListener() { },
    URLSearchParams, Math, Number, JSON, Array, Object, WeakMap, Map, Set, Float32Array, Uint8ClampedArray, String, Error, isFinite, parseInt,
  };
  win.window = win; win.self = win;
  win.__api = { floor: () => corpseLayer, layer: () => creatures, Hc: g.Hc, zc: g.zc, Uc: g.Uc, Bc: g.Bc, qc: g.qc, Gc: g.Gc, lamps: g.Fc, H, V: g.V, lightOn: () => lightOn, death: () => ({ active: false }) };
  win.__ents = { lamp: () => 1, dbgCfg: { on: false } };
  const mpCalls = []; win.__mp = function (o) { mpCalls.push(o); return 'mp-ret'; };
  const page = { g, win, world, carpet, level, corpseLayer, person, creatures, H, clock: 1000, warns: [], mpCalls, store, rafs, intervals, setLight: v => { lightOn = v; } };
  const ctx = vm.createContext(win);
  vm.runInContext(read('world.js'), ctx, { filename: 'world.js' });           // window.WORLD, exactly as the page's classic script sets it
  vm.runInContext(read('light.js'), ctx, { filename: 'light.js' });
  vm.runInContext(read('assets/shadows-2d.js'), ctx, { filename: 'shadows-2d.js' });
  page.S = win.__shadows;
  page.frame = (dt = 1 / 60) => { page.clock += dt * 1000; return win.__mp({ p: H, light: lightOn, t: dt }); };
  return page;
}
const hound = (x, y, rot = 0) => { const v = new Container(); v.__hound = true; v.position.set(x, y); v.rotation = rot; return v; };
const smiler = (x, y) => { const v = new Container(); v.__smiler = true; v.position.set(x, y); return v; };
const aoQuads = p => p.world.children[1].children.find(c => c.label === 'shadows-ao').children.flatMap(c => c.quads.map(q => Object.assign({ chunk: c }, q)));
const finiteAll = o => JSON.stringify(o, (k, v) => typeof v === 'number' && !Number.isFinite(v) ? (() => { throw Error('non-finite ' + k); })() : v) && true;

function run(name, fn) { try { const r = fn(); check(name, r === undefined ? true : r.ok, r && r.note); } catch (e) { check(name, false, 'EXCEPTION ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); } }

/* ===== SH1: attach, grounding, entity light shadows, safety ===== */
run('S01 attaches right above the carpet, under the level art; mp hook chained', () => {
  const p = makePage(); const r = p.frame();
  const i = p.world.children.findIndex(c => c.label === 'shadows-2d');
  return { ok: i === 1 && p.world.children[0] === p.carpet && p.world.children[2] === p.level && r === 'mp-ret' && p.mpCalls.length === 1 && p.S.stats().attached, note: `index ${i}, mp ret ${r}` };
});
run('S02 wall adjacency: every wall/floor boundary edge is covered by exactly one grounding strip of the right side', () => {
  const p = makePage(); p.frame(); const g = p.g, T = 96, W = g.FBW, H = g.FBH, wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !!g.Hc(x, y);
  const q = aoQuads(p).filter(q => q.w > 40 || q.h > 40);              // strips (corner blobs are square 30 px)
  const cover = new Map(), key = (s, x, y) => s + x + ',' + y;
  for (const s of q) {
    const dir = s.w > s.h ? (s.y % T === 0 ? 'S' : 'N') : (s.x % T === 0 ? 'E' : 'W');
    if (s.w > s.h) for (let x = s.x / T; x < (s.x + s.w) / T; x++) { const y = dir === 'S' ? s.y / T - 1 : (s.y + s.h) / T; cover.set(key(dir, x, y), (cover.get(key(dir, x, y)) || 0) + 1); }
    else for (let y = s.y / T; y < (s.y + s.h) / T; y++) { const x = dir === 'E' ? s.x / T - 1 : (s.x + s.w) / T; cover.set(key(dir, x, y), (cover.get(key(dir, x, y)) || 0) + 1); }
  }
  let edges = 0, bad = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (wall(x, y)) for (const [d, dx, dy] of [['S', 0, 1], ['N', 0, -1], ['E', 1, 0], ['W', -1, 0]]) if (!wall(x + dx, y + dy)) { edges++; if (cover.get(key(d, x, y)) !== 1) bad.push(d + x + ',' + y + ':' + cover.get(key(d, x, y))); }
  const extra = [...cover.keys()].filter(k => { const d = k[0], [x, y] = k.slice(1).split(',').map(Number), [dx, dy] = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[d]; return !(wall(x, y) && !wall(x + dx, y + dy)); });
  return { ok: edges > 0 && !bad.length && !extra.length && q.length < edges, note: `${edges} boundary edges, ${q.length} merged strips (${(edges / q.length).toFixed(2)} edges/strip), missing/double ${bad.length}, stray ${extra.length}` };
});
run('S03 grounding strips lie on floor only (never inside a wall cell) and outer corners are closed', () => {
  const p = makePage(); p.frame(); const g = p.g, T = 96, wall = (x, y) => x < 0 || y < 0 || x >= g.FBW || y >= g.FBH || !!g.Hc(x, y); let bad = 0, corners = 0;
  for (const q of aoQuads(p)) {
    for (const [fx, fy] of [[.02, .02], [.98, .02], [.02, .98], [.98, .98], [.5, .5]]) { const px = q.x + q.w * fx, py = q.y + q.h * fy; if (wall(Math.floor(px / T), Math.floor(py / T))) bad++; }
    if (q.w === q.h && q.w < 40) corners++;
  }
  return { ok: bad === 0 && corners > 0, note: `${aoQuads(p).length} quads, ${corners} corner blobs, samples inside walls ${bad}` };
});
run('S04 grounding is static (built once) and camera-culled by chunk', () => {
  const p = makePage(); p.frame(); const st0 = p.S.stats(); for (let i = 0; i < 30; i++) p.frame();
  const st = p.S.stats(), vis = p.S.snapshot().aoVisible;
  p.world.position.set(640 - 7000 * 1.18, 360 - 1200 * 1.18); p.frame(); const vis2 = p.S.snapshot().aoVisible;
  return { ok: st.cache.staticBuilds === 1 && st0.ao.chunks > 4 && vis.length > 0 && vis.length <= 4 && JSON.stringify(vis) !== JSON.stringify(vis2), note: `chunks ${st.ao.chunks}, visible at spawn ${JSON.stringify(vis)}, after moving ${JSON.stringify(vis2)}, builds ${st.cache.staticBuilds}` };
});
run('S05 dominant direction: light.js points toward the light; the entity shadow points away from it', () => {
  const p = makePage({ lightOn: false });                                // lamps only
  const L = p.win.__light, lamp = p.g.Fc.find(l => p.g.Uc(l.x, l.y, 0, 120) >= 119 && p.g.Uc(l.x, l.y, Math.PI, 40) >= 39);
  const x = lamp.x + 90, y = lamp.y; const s = L.sample(x, y, false);
  const h = hound(x, y, 0); p.creatures.addChild(h); p.H.x = lamp.x + 260; p.H.y = lamp.y; p.person.position.set(p.H.x, p.H.y);
  p.world.position.set(640 - p.H.x * 1.18, 360 - p.H.y * 1.18); p.frame(); p.frame();
  const sh = p.S.snapshot().ents.find(e => Math.hypot(e.x - x, e.y - y) < 80);
  return { ok: s.dirX < -.99 && sh && sh.x > x + 2 && Math.abs(Math.cos(sh.rot) - 1) < 1e-6, note: `sample dir ${s.dirX.toFixed(3)},${s.dirY.toFixed(3)} lamp ${s.lamp.toFixed(3)}; shadow ${sh && JSON.stringify(sh)}` };
});
run('S06 the local flashlight casts a lit hound\'s shadow away from the player; rotating the aim off it fades it smoothly (no pop)', () => {
  // a corridor spot with no lamp within ~480 px of the player or the hound (found on the real map): only the flashlight lights the hound
  const p = makePage(), X = 5520, y = 1968, HX = X + 200; p.H.x = X; p.H.y = y; p.H.angle = 0; p.person.position.set(X, y); p.world.position.set(640 - X * 1.18, 360 - y * 1.18);
  const h = hound(HX, y, Math.PI / 2); p.creatures.addChild(h); const seq = [];
  for (let i = 0; i <= 60; i++) { p.H.angle = i / 60 * 1.6; p.frame(1 / 60); const e = p.S.snapshot().ents.find(e => Math.abs(e.x - HX) < 120); seq.push(e ? e.a : 0); }
  const first = (() => { p.H.angle = 0; for (let i = 0; i < 10; i++) p.frame(1 / 60); return p.S.snapshot().ents.find(e => Math.abs(e.x - HX) < 120); })();
  let jump = 0; for (let i = 1; i < seq.length; i++) jump = Math.max(jump, Math.abs(seq[i] - seq[i - 1]));
  return { ok: first && first.x > HX && Math.abs(first.rot) < 1e-6 && seq[0] > .05 && seq[seq.length - 1] < seq[0] * .5 && jump < .05, note: `start alpha ${seq[0].toFixed(3)} end ${seq[seq.length - 1].toFixed(3)} max frame step ${jump.toFixed(4)}` };
});
run('S07 Smilers never get a shadow (no implied body), even fully lit in the beam', () => {
  const p = makePage(); const y = 3504; p.H.x = 3300; p.H.y = y; p.person.position.set(p.H.x, y); p.world.position.set(640 - p.H.x * 1.18, 360 - y * 1.18);
  const s = smiler(3450, y); s.alpha = 1; p.creatures.addChild(s); for (let i = 0; i < 10; i++) p.frame();
  const near = p.S.snapshot().ents.filter(e => Math.hypot(e.x - 3450, e.y - y) < 120);
  return { ok: near.length === 0, note: `${near.length} shadows near the smiler` };
});
run('S08 nothing is revealed: a lit hound the player cannot see (behind a wall) gets no shadow; in sight it does', () => {
  const p = makePage({ lightOn: false }); const g = p.g;
  // a lamp with a wall between it and a spot the player cannot see: search the real map
  let found = null;
  for (const l of g.Fc) { for (let a = 0; a < 16 && !found; a++) { const ang = a / 16 * Math.PI * 2, x = l.x + Math.cos(ang) * 110, y = l.y + Math.sin(ang) * 110;
    if (!g.zc(Math.floor(x / 96), Math.floor(y / 96)) || g.Uc(l.x, l.y, ang, 110) < 109) continue;
    for (let b = 0; b < 16; b++) { const bb = b / 16 * Math.PI * 2, px = x + Math.cos(bb) * 300, py = y + Math.sin(bb) * 300; if (g.zc(Math.floor(px / 96), Math.floor(py / 96)) && g.Uc(px, py, bb + Math.PI, 300) < 200) { found = { x, y, px, py }; break; } } } if (found) break; }
  assert(found, 'no hidden lit spot found');
  p.H.x = found.px; p.H.y = found.py; p.person.position.set(found.px, found.py); p.world.position.set(640 - found.px * 1.18, 360 - found.py * 1.18);
  const h = hound(found.x, found.y); p.creatures.addChild(h); for (let i = 0; i < 5; i++) p.frame();
  const hidden = p.S.snapshot().ents.filter(e => Math.hypot(e.x - found.x, e.y - found.y) < 140).length;
  p.H.x = found.x + 40; p.H.y = found.y; p.person.position.set(p.H.x, p.H.y); for (let i = 0; i < 5; i++) p.frame();
  const shown = p.S.snapshot().ents.filter(e => Math.hypot(e.x - found.x, e.y - found.y) < 140 && Math.abs(e.sx - 17) > 1).length;
  return { ok: hidden === 0 && shown >= 1, note: `hidden-hound shadows ${hidden}; in-sight ${shown}` };
});
run('S09 caps: entity shadows never exceed the quality budget; OFF draws nothing', () => {
  const out = {};
  for (const q of ['off', 'low', 'medium', 'high']) {
    const p = makePage(); p.S.setQuality(q); const y = 3504; p.H.x = 3300; p.H.y = y; p.person.position.set(p.H.x, y); p.world.position.set(640 - p.H.x * 1.18, 360 - y * 1.18);
    for (let i = 0; i < 60; i++) p.creatures.addChild(hound(3360 + (i % 15) * 22, y - 40 + Math.floor(i / 15) * 26));
    for (let i = 0; i < 3; i++) p.frame();
    out[q] = { n: p.S.snapshot().ents.length, cap: p.S.tiers()[q].ents, rootVisible: p.world.children[1].visible };
  }
  return { ok: Object.values(out).every(o => o.n <= o.cap) && out.off.n === 0 && out.off.rootVisible === false && out.low.n > 0 && out.high.n > out.low.n, note: JSON.stringify(out) };
});
run('S10 no NaN / Infinity in anything drawn, whatever the inputs (random positions, zero dt, huge dt, NaN entity)', () => {
  const p = makePage(); let rnd = 7; const R = () => (rnd = rnd * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 25; i++) p.creatures.addChild(hound(R() * 9000, R() * 6800, R() * 7));
  const bad = hound(NaN, 3300); p.creatures.addChild(bad);
  for (let i = 0; i < 200; i++) { p.H.x = 300 + R() * 8800; p.H.y = 300 + R() * 6200; p.H.angle = R() * 9 - 4; p.person.position.set(p.H.x, p.H.y); p.world.position.set(640 - p.H.x * 1.18, 360 - p.H.y * 1.18); p.frame([0, 1 / 60, 5, 1e-9][i % 4]); }
  const snap = p.S.snapshot(); finiteAll(snap); finiteAll(aoQuads(p).map(q => [q.x, q.y, q.w, q.h]));
  return { ok: !p.S.stats().disabled, note: `${snap.ents.length} shadows in the last frame; disabled='${p.S.stats().disabled}'` };
});
run('S11 stable ordering / determinism: the same scene and light state give identical geometry', () => {
  const mk = () => { const p = makePage(); const y = 3504; p.H.x = 3300; p.H.y = y; p.person.position.set(p.H.x, y); p.world.position.set(640 - p.H.x * 1.18, 360 - y * 1.18); for (let i = 0; i < 20; i++) p.creatures.addChild(hound(3380 + i * 14, y + (i % 3) * 20 - 20, i)); for (let i = 0; i < 4; i++) p.frame(); return p; };
  const a = mk(), b = mk();
  return { ok: JSON.stringify(a.S.snapshot()) === JSON.stringify(b.S.snapshot()) && JSON.stringify(aoQuads(a).map(q => [q.x, q.y, q.w, q.h])) === JSON.stringify(aoQuads(b).map(q => [q.x, q.y, q.w, q.h])), note: `${a.S.snapshot().ents.length} shadows` };
});
run('S12 read-only: drawing shadows never changes an entity, the player, the lamps or the light foundation', () => {
  const p = makePage(); const y = 3504; p.H.x = 3300; p.H.y = y; p.person.position.set(p.H.x, y); p.world.position.set(640 - p.H.x * 1.18, 360 - y * 1.18);
  const views = [hound(3420, y), hound(3500, y + 30, 1), smiler(3460, y - 40)]; views.forEach(v => p.creatures.addChild(v));
  const dump = () => JSON.stringify({ H: p.H, v: views.map(v => [v.x, v.y, v.alpha, v.visible, v.rotation, v.scale.x, v.scale.y]), person: [p.person.x, p.person.y, p.person.alpha], lamps: p.g.Fc, V: p.g.V, light: Object.keys(p.win.__light) });
  const before = dump(); for (let i = 0; i < 50; i++) p.frame(); const after = dump();
  return { ok: before === after, note: before === after ? 'unchanged' : 'CHANGED' };
});
run('S13 failure isolation: an internal error switches the module off and the game hook keeps working', () => {
  const p = makePage(); p.frame(); p.win.__api.layer = () => { throw Error('boom'); };
  const r = p.frame(); const st = p.S.stats(); const r2 = p.frame();
  return { ok: r === 'mp-ret' && r2 === 'mp-ret' && st.disabled && p.world.children.every(c => c.label !== 'shadows-2d') && p.mpCalls.length === 3, note: `disabled='${st.disabled}', warn ${p.warns.length}` };
});
run('S14 quality: URL > remembered > device default; LOW is a real tier (grounding + capped light shadows)', () => {
  const a = makePage({ search: '?shadows=high' }), b = makePage({ coarse: true }), c = makePage();
  c.S.setQuality('bogus'); const t = c.S.tiers();
  return { ok: a.S.quality() === 'high' && b.S.quality() === 'low' && c.S.quality() === 'medium' && t.low.ao && t.low.ents > 0 && t.low.ents < t.medium.ents && t.medium.ents < t.high.ents, note: `url ${a.S.quality()}, touch ${b.S.quality()}, desktop ${c.S.quality()}` };
});
run('S15 no presentation-to-AI data path (static): the server never loads or reads the shadow module; the module never talks to the network', () => {
  const srv = ['server.js', 'sim.js', 'ai.js', 'death_srv.js', 'dphys.js', 'move.js', 'world.js', 'camera_policy.js', 'timing_policy.js'].map(f => [f, read(f)]);
  const refs = srv.filter(([, s]) => /__shadows|shadows-2d/.test(s)).map(([f]) => f);
  const m = read('assets/shadows-2d.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const net = ['WebSocket', '.send(', 'fetch(', 'XMLHttpRequest', '__net', 'sendBeacon', 'postMessage'].filter(k => m.includes(k));
  const writes = (m.match(/(__api|__light|__ents|__peerLights|WORLD)(\.[A-Za-z_$][\w$]*)+\s*=[^=]/g) || []);
  return { ok: !refs.length && !net.length && !writes.length, note: `server refs ${JSON.stringify(refs)}, network ${JSON.stringify(net)}, writes into game objects ${JSON.stringify(writes)}` };
});
run('S16 the shipped server serves the module without any server change (assets/ is already whitelisted)', () => {
  const m = /const SERVE = (\/.*\/);/.exec(read('server.js')); const rx = eval(m[1]);
  return { ok: rx.test('/assets/shadows-2d.js') && !rx.test('/shadows-2d.js') && read('index.html').includes('<script src="./assets/shadows-2d.js"></script>'), note: m[1].slice(0, 60) + '…' };
});

/* ===== SH2: lamp and carried-light cast shadows ===== */
const lampLayer = p => p.world.children[1].children.find(c => c.label === 'shadows-lamps');
const castLayer = p => p.world.children[1].children.find(c => c.label === 'shadows-cast');
const dynLayer = p => castLayer(p).children.find(c => c.label === 'shadows-cast-props');          // carried lights: prop shadows
const frLayer = p => castLayer(p).children.find(c => c.label === 'shadows-cast-penumbrae');       // carried lights: corner penumbrae
const lampIdx = g => +g.label.split('-').pop();
const lampWalls = (p, g) => { const l = p.S.snapshot().lamps.find(l => l.i === lampIdx(g)); return g.polys.slice(0, l ? l.walls : 0); };   // a lamp builds penumbrae first, then props
const lampProps = (p, g) => { const l = p.S.snapshot().lamps.find(l => l.i === lampIdx(g)); return g.polys.slice(l ? l.walls : 0); };
const polyPts = q => { const a = []; for (let i = 0; i < q.p.length; i += 2) a.push([q.p[i], q.p[i + 1]]); return a; };
const centroid = q => { const a = polyPts(q); return [a.reduce((s, v) => s + v[0], 0) / a.length, a.reduce((s, v) => s + v[1], 0) / a.length]; };
const at = (p, x, y, ang = 0) => { p.H.x = x; p.H.y = y; p.H.angle = ang; p.person.position.set(x, y); p.world.position.set(640 - x * 1.18, 360 - y * 1.18); };
/* the alpha a textured fill puts at a world point: invert the fill's texture -> world matrix, sample the texture (nearest, repeat, as Pixi sets it) */
function texAlpha(fill, x, y) {
  if (!fill.texture) return 1; const M = fill.matrix, img = fill.texture.src.img, N = img.width, det = M.a * M.d - M.b * M.c, dx = x - M.tx, dy = y - M.ty;
  const u = (M.d * dx - M.c * dy) / det, v = (-M.b * dx + M.a * dy) / det, i = ((Math.floor(u) % N) + N) % N, j = ((Math.floor(v) % N) + N) % N;
  return img.data[(j * N + i) * 4 + 3] / 255;
}
const effAlpha = (q, x, y) => q.fill.alpha * texAlpha(q.fill, x, y);
/* the world point at the centre of the texel a fill samples at (x, y): the texture is compared with the formula there */
function texelCentre(fill, x, y) {
  const M = fill.matrix, det = M.a * M.d - M.b * M.c, dx = x - M.tx, dy = y - M.ty, u = Math.floor((M.d * dx - M.c * dy) / det) + .5, v = Math.floor((-M.b * dx + M.a * dy) / det) + .5;
  return [M.a * u + M.c * v + M.tx, M.b * u + M.d * v + M.ty];
}
/* the shadow 'mass' (alpha x area, alpha as drawn: fill alpha x the light's texture) - each polygon is fanned into triangles
 * (hulls and wedges are convex) and each triangle integrated over 64 equal sub-triangles */
function polyMass(q, n = 8) {
  const P = polyPts(q); let m = 0;
  for (let k = 1; k + 1 < P.length; k++) {
    const [ax, ay] = P[0], [bx, by] = P[k], [cx, cy] = P[k + 1], area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2; if (!(area > 0)) continue;
    let sum = 0, cnt = 0; const at = (u, v) => { sum += effAlpha(q, ax + (bx - ax) * u + (cx - ax) * v, ay + (by - ay) * u + (cy - ay) * v); cnt++; };
    for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) { at((i + 1 / 3) / n, (j + 1 / 3) / n); if (i + j < n - 1) at((i + 2 / 3) / n, (j + 2 / 3) / n); }
    m += area * sum / cnt;
  }
  return m;
}
const mass = polys => polys.reduce((s, q) => s + polyMass(q), 0);
function polyArea(q) { const a = polyPts(q); let s = 0; for (let i = 0; i < a.length; i++) { const [x1, y1] = a[i], [x2, y2] = a[(i + 1) % a.length]; s += x1 * y2 - x2 * y1; } return s / 2; }
/* the convex corners of the real map, computed here independently of the module: outer wall corners and pillar corners */
function convexCorners(g) {
  const T = 96, wall = (x, y) => x < 0 || y < 0 || x >= g.FBW || y >= g.FBH || !!g.Hc(x, y), set = new Set();
  for (let y = 0; y < g.FBH; y++) for (let x = 0; x < g.FBW; x++) { if (!wall(x, y)) continue;
    if (!wall(x + 1, y) && !wall(x, y + 1) && !wall(x + 1, y + 1)) set.add((x + 1) * T + ',' + (y + 1) * T);
    if (!wall(x - 1, y) && !wall(x, y + 1) && !wall(x - 1, y + 1)) set.add(x * T + ',' + (y + 1) * T);
    if (!wall(x + 1, y) && !wall(x, y - 1) && !wall(x + 1, y - 1)) set.add((x + 1) * T + ',' + y * T);
    if (!wall(x - 1, y) && !wall(x, y - 1) && !wall(x - 1, y - 1)) set.add(x * T + ',' + y * T); }
  for (const r of g.Pc) for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]) set.add(x + ',' + y);
  return set;
}
/* checks every penumbra polygon of one light: apex on a convex corner, extends away from the light, lies where the light reaches */
function checkPenumbrae(g, L, polys, corners) {
  let n = 0, apex = 0, back = 0, dark = 0;
  for (const q of polys) {
    const pts = polyPts(q); n++; const dl = ([x, y]) => Math.hypot(x - L.x, y - L.y);
    if (!corners.has(pts[0].join(','))) apex++;                               // a fan from the corner: the corner first, then its far edge
    if (pts.slice(1).some(v => dl(v) < dl(pts[0]) - .01)) back++;
    const [mx, my] = centroid(q), d = Math.hypot(mx - L.x, my - L.y);
    if (g.Uc(L.x, L.y, Math.atan2(my - L.y, mx - L.x), d) < d - 1) dark++;                 // the overlay already darkens there: never drawn
  }
  return { n, apex, back, dark };
}
function settleLamps(p, n = 30) { for (let i = 0; i < n; i++) p.frame(1 / 60); }
const propL1 = () => require(path.join(ROOT, 'world.js')).PROPS.find(p => p.id === 'L1');

run('C01 lamp shadows of props fall away from the lamp (every prop-shadow polygon centroid is on the far side of the prop)', () => {
  // the toppled shelf L2 has two ceiling lamps within range and in line of sight (lamps #17 and #18 on the real map)
  const p = makePage({ lightOn: false }), pr = require(path.join(ROOT, 'world.js')).PROPS.find(p => p.id === 'L2'), r = pr.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  at(p, cx, cy + 150); settleLamps(p);
  const lamps = lampLayer(p).children.filter(g => g.visible), out = [];
  for (const g of lamps) {
    const lp = p.g.Fc[lampIdx(g)];
    for (const q of lampProps(p, g)) { const [mx, my] = centroid(q); if (Math.hypot(mx - cx, my - cy) > 200) continue;     // this prop's shadows only
      out.push((cx - lp.x) * (mx - cx) + (cy - lp.y) * (my - cy)); }
  }
  return { ok: out.length > 0 && out.every(d => d > 0), note: `${lamps.length} lamps, ${out.length} prop-shadow polygons, min dot ${Math.min(...out).toFixed(1)}` };
});
run('C02 lamp wall penumbrae: apex on a convex wall/pillar corner, extend away from the lamp, only where the lamp\'s light reaches (no double black)', () => {
  const corners = convexCorners(makeGame()), tot = { n: 0, apex: 0, back: 0, dark: 0 }; let lampsWith = 0;
  for (const [x, y] of [[1060, 3300], [3984, 3470], [8000, 1200], [600, 2930]]) {
    const p = makePage({ lightOn: false }); p.S.setQuality('high'); at(p, x, y); settleLamps(p, 40);
    for (const g of lampLayer(p).children.filter(g => g.visible)) { const r = checkPenumbrae(p.g, p.g.Fc[lampIdx(g)], lampWalls(p, g), corners); if (r.n) lampsWith++; for (const k in tot) tot[k] += r[k]; }
  }
  return { ok: tot.n > 0 && lampsWith >= 3 && !tot.apex && !tot.back && !tot.dark, note: `${tot.n} penumbra polygons from ${lampsWith} lamps; off-corner ${tot.apex}, pointing back ${tot.back}, over the umbra ${tot.dark}` };
});
run('C03 lamp flicker: a lamp\'s shadow strength follows the overlay\'s own lamp power every frame (failures dim it, never brighter than nominal)', () => {
  const p = makePage({ lightOn: false }); at(p, 1060, 3300); settleLamps(p);
  const L = lampLayer(p), vis = () => L.children.filter(g => g.visible && lampIdx(g) % 13 !== 0).map(g => [lampIdx(g), g.alpha]);
  const before = vis(); p.win.__ents.lamp = () => .25; p.frame(1 / 60); const fail = vis();
  p.win.__ents.lamp = () => 0; p.frame(1 / 60); const off = L.children.filter(g => g.visible).length;
  p.win.__ents.lamp = () => 1; p.win.__cam = { lampGain: () => 1.5 }; p.frame(1 / 60); const gain = vis(); delete p.win.__cam;
  const ok1 = before.length > 0 && before.every(([, a]) => a > 0 && a <= 1);
  const ok2 = fail.length === before.length && fail.every(([, a], k) => Math.abs(a - before[k][1] * .25) < .005);
  const ok3 = gain.every(([, a], k) => Math.abs(a - before[k][1]) < .005);
  return { ok: ok1 && ok2 && off === 0 && ok3, note: `alphas ${JSON.stringify(before.map(x => x[1].toFixed(3)))} failing x.25 ${JSON.stringify(fail.map(x => x[1].toFixed(3)))} failed: ${off} visible; NV x1.5 ${JSON.stringify(gain.map(x => x[1].toFixed(3)))}` };
});
run('C04 dim fixtures (index % 13 == 0) flicker their shadows with the overlay formula .13 + .06·max(0, sin(11t + i)), relative to their brightest state', () => {
  const p = makePage({ lightOn: false }), i0 = 0, l0 = p.g.Fc[i0]; at(p, l0.x + 40, l0.y + 60); settleLamps(p);
  const g = lampLayer(p).children.find(g => g.label === 'shadows-lamp-' + i0); const rows = [];
  for (let k = 0; k < 40; k++) { p.frame(1 / 30); const t = p.clock / 1000, e = (.13 + .06 * Math.max(0, Math.sin(t * 11 + i0))) / .19; rows.push([g && g.alpha, e]); }
  const ratio = rows.map(([a, e]) => a / e), spread = Math.max(...ratio) - Math.min(...ratio), varies = new Set(rows.map(r => (r[0] || 0).toFixed(3))).size > 3;
  return { ok: !!g && varies && spread < 1e-6 && rows.every(([a]) => a >= .13 / .19 * Math.max(...rows.map(r => r[0])) - 1e-6), note: `lamp #0 alpha ${Math.min(...rows.map(r => r[0])).toFixed(3)}..${Math.max(...rows.map(r => r[0])).toFixed(3)}, alpha / formula constant to ${spread.toExponential(1)}` };
});
run('C05 blackout removes every lamp shadow at once; carried-light shadows stay', () => {
  const p = makePage(), pr = propL1(), r = pr.rect; at(p, r.x + r.w / 2, r.y + r.h + 120, -Math.PI / 2); settleLamps(p);
  const before = lampLayer(p).children.filter(g => g.visible).length, dyn0 = dynLayer(p).polys.length;
  p.g.V.blackout = true; p.frame(1 / 60); const after = lampLayer(p).children.filter(g => g.visible).length, dyn1 = dynLayer(p).polys.length; p.g.V.blackout = false;
  return { ok: before > 0 && after === 0 && dyn0 > 0 && dyn1 > 0, note: `lamp layers ${before} -> ${after}; carried prop polys ${dyn0} -> ${dyn1}` };
});
run('C06 your own light: props cast moving shadows away from the beam', () => {
  const p = makePage(), pr = propL1(), r = pr.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2; at(p, cx, r.y + r.h + 110, -Math.PI / 2); settleLamps(p, 3);
  p.win.__ents.lamp = () => 0; p.frame(1 / 60);
  const polys = dynLayer(p).polys, dots = polys.map(q => { const [mx, my] = centroid(q); return (cx - p.H.x) * (mx - cx) + (cy - p.H.y) * (my - cy); });
  return { ok: polys.length > 0 && dots.every(d => d > 0), note: `${polys.length} prop polygons, all beyond the prop: ${dots.every(d => d > 0)}; lights ${p.S.stats().lights.last}` };
});
run('C07 flashlight rotation: sweeping the aim across a prop changes its shadow smoothly (no frame-to-frame pop)', () => {
  const p = makePage(), pr = propL1(), r = pr.rect, cx = r.x + r.w / 2; at(p, cx, r.y + r.h + 110, -Math.PI / 2); p.win.__ents.lamp = () => 0; settleLamps(p, 3);
  const seq = [];
  for (let k = 0; k <= 90; k++) { p.H.angle = -Math.PI / 2 - .9 + 1.8 * k / 90; p.frame(1 / 60); seq.push(mass(dynLayer(p).polys)); }
  let jump = 0; for (let k = 1; k < seq.length; k++) jump = Math.max(jump, Math.abs(seq[k] - seq[k - 1]) / Math.max(...seq));
  return { ok: Math.max(...seq) > 0 && seq[0] < Math.max(...seq) * .5 && jump < .12, note: `shadow mass max ${Math.max(...seq).toFixed(0)}, ends ${seq[0].toFixed(0)}/${seq[seq.length - 1].toFixed(0)}, worst step ${(jump * 100).toFixed(1)}%` };
});
run('C08 caps and culling: lamps <= tier cap and only those in view; dynamic polygons <= budget; peers <= cap', () => {
  const out = {};
  for (const q of ['low', 'medium', 'high']) {
    const p = makePage(); p.S.setQuality(q); at(p, 8000, 1200, 0);
    p.win.__peerLights = []; for (let k = 0; k < 8; k++) p.win.__peerLights.push({ x: 7900 + k * 30, y: 1150 + (k % 3) * 40, angle: k, kind: ['flashlight', 'headlamp', 'lantern'][k % 3], on: true });
    settleLamps(p, 40); const t = p.S.tiers()[q], st = p.S.stats(), vis = lampLayer(p).children.filter(g => g.visible);
    const inView = vis.every(g => { const l = p.g.Fc[lampIdx(g)]; return Math.abs(l.x - 8000) < 640 / 1.18 + 380 && Math.abs(l.y - 1200) < 360 / 1.18 + 380; });
    out[q] = { lamps: vis.length, cap: t.lamps, inView, dyn: st.dynamicPolys.max, budget: t.budget, lights: st.lights.max, lightCap: t.lamps + 1 + t.peers };
  }
  const ok = Object.values(out).every(o => o.lamps <= o.cap && o.inView && o.dyn <= o.budget && o.lights <= o.lightCap) && out.high.lights >= out.low.lights;
  return { ok, note: JSON.stringify(out) };
});
run('C09 no NaN / Infinity in any lamp or carried-light polygon, and every polygon owns its point array (Pixi keeps references)', () => {
  const p = makePage(); let rnd = 11; const R = () => (rnd = rnd * 16807 % 2147483647) / 2147483647; let polys = 0; const seen = new Set(); let shared = 0;
  for (let k = 0; k < 120; k++) {
    at(p, 300 + R() * 8800, 300 + R() * 6200, R() * 12 - 6); p.win.__peerLights = [{ x: p.H.x + R() * 300 - 150, y: p.H.y + R() * 300 - 150, angle: R() * 7, kind: 'flashlight', on: true }, { x: NaN, y: 1, on: true, kind: 'lantern' }];
    p.frame([0, 1 / 60, 3, 1e-9][k % 4]);
    for (const g of [...lampLayer(p).children, dynLayer(p), frLayer(p)]) for (const q of g.polys) {
      polys++; for (const v of q.p) if (!Number.isFinite(v)) throw Error('NaN in ' + g.label); if (!Number.isFinite(q.fill.alpha) || q.fill.alpha <= 0 || q.fill.alpha > 1) throw Error('alpha ' + q.fill.alpha);
      if (seen.has(q.p)) shared++; seen.add(q.p);
    }
    seen.clear();
  }
  return { ok: !p.S.stats().disabled && shared === 0, note: `${polys} polygons checked; shared point arrays ${shared}; disabled='${p.S.stats().disabled}'` };
});
run('C10 stable ordering: the same scene and light state build identical lamp and carried geometry', () => {
  const mk = () => { const p = makePage(); at(p, 1700, 3470, -1.2); p.win.__peerLights = [{ x: 1650, y: 3420, angle: -1, kind: 'flashlight', on: true }]; settleLamps(p, 30); return p; };
  const a = mk(), b = mk(), sig = p => JSON.stringify([lampLayer(p).children.map(g => [g.label, g.visible, +g.alpha.toFixed(5), g.polys.length, g.polys.slice(0, 40)]), dynLayer(p).polys, frLayer(p).polys]);
  return { ok: sig(a) === sig(b), note: `${lampLayer(a).children.length} lamp caches, ${dynLayer(a).polys.length} prop + ${frLayer(a).polys.length} penumbra polygons` };
});
run('C11 LOW / MEDIUM / HIGH: fidelity grows with the tier (lamps, samples, penumbra wedges), LOW keeps every kind of shadow; OFF draws nothing', () => {
  const res = {};
  for (const q of ['off', 'low', 'medium', 'high']) { const p = makePage(); p.S.setQuality(q); at(p, 3984, 3470 + 60, -Math.PI / 2); settleLamps(p, 40);
    const sn = p.S.snapshot(), st = p.S.stats();
    res[q] = { lamps: sn.lamps.length, lampWalls: sn.lamps.reduce((s, l) => s + l.walls, 0), lampPolys: sn.lamps.reduce((s, l) => s + l.polys, 0), props: st.dynamicPolys.props, pen: frLayer(p).polys.length, propPolys: dynLayer(p).polys.length, root: p.world.children[1].visible }; }
  const ok = res.off.lamps === 0 && !res.off.root && res.off.propPolys === 0 && res.off.pen === 0 &&
    res.low.lamps > 0 && res.low.lampWalls > 0 && res.low.propPolys > 0 && res.low.lamps <= res.medium.lamps && res.medium.lamps <= res.high.lamps &&
    res.low.lampPolys < res.medium.lampPolys && res.medium.lampPolys < res.high.lampPolys && res.low.propPolys <= res.medium.propPolys && res.medium.propPolys <= res.high.propPolys;
  return { ok, note: JSON.stringify(res) };
});
run('C12 baked prop shadows are detected: a prop lit from the side of its baked drop shadow gets a thinner dynamic shadow', () => {
  const W = require(path.join(ROOT, 'world.js')), pr = W.PROPS.find(p => p.id === 'L1'), r = pr.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const sum = (lx, ly) => { const p = makePage(); at(p, lx, ly, Math.atan2(cy - ly, cx - lx)); p.win.__ents.lamp = () => 0; p.frame(1 / 60); p.frame(1 / 60);
    return dynLayer(p).polys.reduce((s, q) => s + effAlpha(q, ...centroid(q)), 0); };
  const fromNW = sum(cx - 70, cy - 90), fromSE = sum(cx + 70, cy + 90);      // the art's baked shadow points down-right (south-east)
  return { ok: fromNW > 0 && fromSE > 0 && fromNW < fromSE * .85, note: `alpha sum lit from NW (shadow onto the baked side) ${fromNW.toFixed(3)} vs from SE ${fromSE.toFixed(3)}` };
});
run('C13 other wanderers\' lights: bounded, cast prop shadows and pillar penumbrae, never from a dead or switched-off light', () => {
  const corners = convexCorners(makeGame());
  const p = makePage({ lightOn: false }); at(p, 8000, 1150, 0); const pl = { x: 7930, y: 1260, angle: .55, kind: 'flashlight', on: true };     // a pillar (8084,1364)-(8140,1420) in its beam
  p.win.__peerLights = [pl, { x: 7980, y: 1100, angle: 0, kind: 'flashlight', on: false }, { x: 8020, y: 1180, angle: 0, kind: 'flashlight', on: true, dead: true }]; p.win.__ents.lamp = () => 0;
  p.frame(1 / 60); const st = p.S.stats(), pen = checkPenumbrae(p.g, pl, frLayer(p).polys, corners);
  const pillarApex = frLayer(p).polys.filter(q => p.g.Pc.some(r => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].some(([x, y]) => x === q.p[0] && y === q.p[1]))).length;
  return { ok: st.lights.last === 1 && pen.n > 0 && pillarApex > 0 && !pen.apex && !pen.back && !pen.dark && st.dynamicPolys.last <= st.dynamicPolys.budget,
    note: `lights ${st.lights.last}, penumbra polygons ${pen.n} (from pillar corners ${pillarApex}), bad ${pen.apex}/${pen.back}/${pen.dark}, polys ${st.dynamicPolys.last}/${st.dynamicPolys.budget}` };
});
run('C14 your light\'s penumbrae: from convex corners in the beam, on the lit side of the edge the overlay already cuts, away from you', () => {
  const corners = convexCorners(makeGame()), tot = { n: 0, apex: 0, back: 0, dark: 0 }, per = [];
  for (const [x, y, a] of [[7900, 1300, .2], [8100, 1500, -2.4], [3600, 3504, 0], [1180, 2830, 2.4], [7860, 1150, .05]]) {
    const p = makePage(); p.S.setQuality('high'); at(p, x, y, a); p.win.__ents.lamp = () => 0; p.frame(1 / 60); p.frame(1 / 60);
    const r = checkPenumbrae(p.g, { x: p.H.x, y: p.H.y }, frLayer(p).polys, corners); per.push(r.n); for (const k in tot) tot[k] += r[k];
  }
  return { ok: tot.n > 0 && per.filter(n => n > 0).length >= 3 && !tot.apex && !tot.back && !tot.dark, note: `polygons per scene ${JSON.stringify(per)}; off-corner ${tot.apex}, pointing back ${tot.back}, over the umbra ${tot.dark}` };
});
/* follow every caster's own shadow along a path: fringes grouped by their apex corner, carried-light props as one group */
function trackCasters(q, path) {
  const p = makePage(); p.S.setQuality(q); p.win.__ents.lamp = () => 0; const series = new Map(), totals = []; let n = 0;
  for (const [x, y, ang] of path) {
    assert(!p.g.Hc(Math.floor(x / 96), Math.floor(y / 96)), 'path inside a wall'); at(p, x, y, ang); p.frame(1 / 60);
    const by = new Map(); let cur = null;
    for (const t of frLayer(p).polys) { if (!cur || t.p[0] !== cur[0] || t.p[1] !== cur[1]) cur = [t.p[0], t.p[1]]; const k = cur.join(','); by.set(k, (by.get(k) || 0) + polyMass(t)); }
    by.set('props', mass(dynLayer(p).polys));
    for (const k of by.keys()) if (!series.has(k)) series.set(k, new Array(n).fill(0));
    for (const [k, arr] of series) arr.push(by.get(k) || 0);
    totals.push([...by.values()].reduce((s, v) => s + v, 0)); n++;
  }
  const peak = Math.max(...totals); let worstTotal = 0, worstCaster = 0;
  for (let i = 1; i < totals.length; i++) worstTotal = Math.max(worstTotal, Math.abs(totals[i] - totals[i - 1]) / peak);
  for (const [, arr] of series) { const pk = Math.max(...arr); if (pk < .05 * peak) continue; for (let i = 1; i < arr.length; i++) worstCaster = Math.max(worstCaster, Math.abs(arr[i] - arr[i - 1]) / pk); }
  return { peak: +peak.toFixed(0), casters: series.size, total: +(worstTotal * 100).toFixed(1), caster: +(worstCaster * 100).toFixed(1) };
}
run('C15 no popping: along an orbit of a pillar, a walk past wall corners and a 10 s run through the pillar hall (sprint speed, light swinging), no caster\'s shadow jumps by a third of its own peak in one frame (LOW / MEDIUM / HIGH)', () => {
  const orbit = [], walk = [], hall = [];
  for (let k = 0; k <= 240; k++) { const a = k / 240 * Math.PI * 2; orbit.push([8592 + Math.cos(a) * 200, 1392 + Math.sin(a) * 200, a + Math.PI + .25 * Math.sin(k / 9)]); }   // pillar (8564,1364)-(8620,1420)
  for (let k = 0; k <= 240; k++) { const u = k / 240; walk.push([760 + 560 * u, 3500 - 80 * u, -1.3 + 1.0 * Math.sin(u * 6)]); }                                        // under the YELLOW HALL partitions
  for (let k = 0; k <= 600; k++) { const u = k / 600; hall.push([7650 + 1000 * u, 1120 + 230 * Math.sin(u * 7), Math.sin(u * 11) * 1.4 + .2]); }                        // PILLAR HALL
  const out = {};
  for (const q of ['low', 'medium', 'high']) out[q] = { orbit: trackCasters(q, orbit), walk: trackCasters(q, walk), hall: trackCasters(q, hall) };
  const all = Object.values(out).flatMap(o => Object.values(o));
  return { ok: all.every(r => r.peak > 0 && r.caster < 34 && r.total < 25), note: JSON.stringify(out) + ' (peak mass; worst one-frame change, % of the peak: total / single caster)' };
});
run('C16 carried-light casters are capped per light and ranked by the light reaching them: settled, at most the cap; while the beam swings, a caster leaving the cap fades out (never more than twice the cap)', () => {
  const out = {};
  for (const q of ['low', 'medium', 'high']) {
    const p = makePage(); p.S.setQuality(q); p.win.__ents.lamp = () => 0; const t = p.S.tiers()[q];
    /* the busiest spot in the pillar hall: the most candidate corners in the beam */
    let best = null;
    for (let x = 7700; x <= 8600; x += 150) for (let y = 950; y <= 1800; y += 150) for (let a = 0; a < 8; a++) {
      if (p.g.Hc(Math.floor(x / 96), Math.floor(y / 96)) || p.g.Pc.some(r => x > r.x - 30 && x < r.x + r.w + 30 && y > r.y - 30 && y < r.y + r.h + 30)) continue;
      at(p, x, y, a * Math.PI / 4); p.frame(1 / 60); const c = p.S.stats().casters.candidate; if (!best || c > best[3]) best = [x, y, a * Math.PI / 4, c];
    }
    const p2 = makePage(); p2.S.setQuality(q); p2.win.__ents.lamp = () => 0; at(p2, best[0], best[1], best[2]); for (let i = 0; i < 40; i++) p2.frame(1 / 60);
    const st = p2.S.stats(); let swingPen = 0, swingProps = 0;
    for (let k = 0; k < 120; k++) { at(p2, best[0], best[1], best[2] + 1.2 * Math.sin(k / 6)); p2.frame(1 / 60); const s2 = p2.S.stats(); swingPen = Math.max(swingPen, s2.dynamicPolys.penumbrae); swingProps = Math.max(swingProps, s2.dynamicPolys.props); }
    out[q] = { at: best.slice(0, 2), cand: st.casters.candidate, pen: st.dynamicPolys.penumbrae, cap: t.localC, swingPen, props: st.dynamicPolys.props, propCap: t.localMax, swingProps };
  }
  const ok = out.low.cand > out.low.cap && Object.values(out).every(o => o.pen <= o.cap && o.swingPen <= 2 * o.cap && o.props <= o.propCap && o.swingProps <= 2 * o.propCap) && out.high.pen >= out.low.pen;
  return { ok, note: JSON.stringify(out) };
});

/* the overlay's own light, re-derived here from drawLight in the bundle (independently of the module) */
const ovGrad = (d, r) => { const s = Math.max(0, Math.min(1, (d - 6) / (r - 6))); return s <= .25 ? 1 - .17 * s / .25 : s <= .7 ? .83 - .55 * (s - .25) / .45 : .28 * (1 - (s - .7) / .3); };
function ovBeam(f, d, phi) {                                                // cut-out alpha of a carried light: 52 px glow + 12 nested arcs (or omni)
  let keep = 1 - (d < 52 ? .35 * ovGrad(d, 52) : 0);
  if (d < f.range) { if (f.omni) keep *= 1 - f.power * ovGrad(d, f.range); else { const e = 1 - Math.pow(1 - f.power, 1 / 12); for (let t = 0; t < 12; t++) if (Math.abs(phi) <= f.arc * (1 - t * .063) / 2) keep *= 1 - e * ovGrad(d, f.range); } }
  return 1 - keep;
}
const ovLamp = (p0, d) => { const f = d <= 6 ? 1 : d <= 193 ? 1 - .65 * (d - 6) / 187 : d < 380 ? .35 * (1 - (d - 193) / 187) : 0, c = p0 * f; return .92 * c / (1 - .92 + .92 * c); };
run('C17 light textures are the overlay\'s own light (sat-mapped): the lamp gradient, each equipment\'s glow + nested arcs, placed at the light and turned with the aim', () => {
  const res = {}; let worst = 0;
  /* lamps: a lamp's prop shadow fill, sampled around the lamp */
  const p = makePage({ lightOn: false }), L2 = require(path.join(ROOT, 'world.js')).PROPS.find(p => p.id === 'L2').rect; at(p, L2.x + L2.w / 2, L2.y + 150); settleLamps(p);
  const lg = lampLayer(p).children.find(g => g.visible && lampProps(p, g).length), lp = p.g.Fc[lampIdx(lg)], lf = lampProps(p, lg)[0].fill;
  for (const r of [0, 40, 100, 150, 200, 260, 320, 370, 420]) for (const a of [0, 1.3, 2.9, 4.4]) {
    const [cx, cy] = texelCentre(lf, lp.x + Math.cos(a) * r, lp.y + Math.sin(a) * r);
    worst = Math.max(worst, Math.abs(texAlpha(lf, cx, cy) - ovLamp(lampIdx(lg) % 13 === 0 ? .19 : .43, Math.hypot(cx - lp.x, cy - lp.y))));
  }
  res.lamp = +worst.toFixed(3);
  /* carried lights: a prop shadow of each equipment kind, aimed at a prop */
  for (const kind of ['flashlight', 'headlamp', 'lantern']) {
    const q = makePage(), pr = propL1().rect, aim = -Math.PI / 2 + .3; q.H.equipment.kind = kind; at(q, pr.x + pr.w / 2, pr.y + pr.h + 90, aim); q.win.__ents.lamp = () => 0; for (let i = 0; i < 20; i++) q.frame(1 / 60);
    const poly = dynLayer(q).polys[0]; if (!poly) { res[kind] = 'no shadow'; worst = 1; continue; }
    const f = q.g.Gc[kind]; let w = 0, outside = 0;
    for (const r of [10, 45, 80, 140, 200, 260, f.range * .9, f.range + 30]) for (const phi of [0, .1, .3, .45, .6, 1.2, 2.5, -.2, -.5, -2]) {
      const [x, y] = texelCentre(poly.fill, q.H.x + Math.cos(aim + phi) * r, q.H.y + Math.sin(aim + phi) * r), d = Math.hypot(x - q.H.x, y - q.H.y);
      const c = ovBeam(f, d, Math.atan2(Math.sin(Math.atan2(y - q.H.y, x - q.H.x) - aim), Math.cos(Math.atan2(y - q.H.y, x - q.H.x) - aim))), v = texAlpha(poly.fill, x, y), e = .92 * c / (1 - .92 + .92 * c);
      w = Math.max(w, Math.abs(v - e)); if (e === 0 && v > 0) outside++;
    }
    res[kind] = { worst: +w.toFixed(3), nonzeroWhereNoLight: outside }; worst = Math.max(worst, w);
  }
  return { ok: worst < .005 && ['flashlight', 'headlamp', 'lantern'].every(k => res[k].nonzeroWhereNoLight === 0), note: JSON.stringify(res) + ' (largest |texel - overlay formula at that texel|, 8-bit texture)' };
});
run('C18 a carried light\'s shadows take away only that light: zero outside its beam and range, strongest on the axis', () => {
  const p = makePage(), pr = propL1().rect, aim = -Math.PI / 2 - .25; at(p, pr.x + pr.w / 2, pr.y + pr.h + 90, aim); p.win.__ents.lamp = () => 0; for (let i = 0; i < 20; i++) p.frame(1 / 60);
  const f = p.g.Gc.flashlight; let inside = 0, out = 0, outLit = 0, maxIn = 0;
  for (const q of dynLayer(p).polys) {
    const P = polyPts(q); for (let k = 1; k + 1 < P.length; k++) for (let i = 0; i < 6; i++) for (let j = 0; i + j < 6; j++) {
      const u = (i + 1 / 3) / 6, v = (j + 1 / 3) / 6, x = P[0][0] + (P[k][0] - P[0][0]) * u + (P[k + 1][0] - P[0][0]) * v, y = P[0][1] + (P[k][1] - P[0][1]) * u + (P[k + 1][1] - P[0][1]) * v;
      const d = Math.hypot(x - p.H.x, y - p.H.y), phi = Math.atan2(Math.sin(Math.atan2(y - p.H.y, x - p.H.x) - aim), Math.cos(Math.atan2(y - p.H.y, x - p.H.x) - aim)), a = effAlpha(q, x, y);
      const m = Math.max(.05, 11 / d);                                       // 1.5 texels: the texture is sampled, not the formula
      if (d > 60 && ovBeam(f, d, Math.max(0, Math.abs(phi) - m)) === 0) { out++; if (a > 0) outLit++; } else if (ovBeam(f, d, phi) > 0) { inside++; maxIn = Math.max(maxIn, a); }
    }
  }
  return { ok: inside > 0 && out > 0 && outLit === 0 && maxIn > .05, note: `samples in the beam ${inside} (max alpha ${maxIn.toFixed(3)}), outside it ${out} (any shadow there: ${outLit})` };
});

run('C19 bounded work: in steady state the ray queries per frame stay under a ceiling computed from the tier caps alone (never from the map), and at most `builds` lamp caches are built per frame', () => {
  const out = {};
  for (const q of ['low', 'medium', 'high']) {
    const p = makePage(); p.S.setQuality(q); p.person.visible = false;         // no entity at all: entity shadows (light.js samples) are capped separately
    const t = p.S.tiers()[q], A = p.win.__api; let uc = 0; const realUc = A.Uc; A.Uc = function () { uc++; return realUc.apply(this, arguments); };
    /* the ceiling: per carried light, props (fading included: 2 x cap) x (4 + 4 (K + 1)) and corners (2 x cap) x (4 + J·ceil(3/J) + 1) */
    const perLight = (props, K, corners, J) => 2 * props * (4 + 4 * (K + 1)) + 2 * corners * (4 + (J ? J * Math.ceil(3 / J) + 1 : 0));
    const ceiling = perLight(t.localMax, t.localK, t.localC, t.localJ) + t.peers * perLight(t.peerMax, t.peerK, t.peerC, t.peerJ);
    let worst = 0, worstAt = null, buildsWorst = 0; let rnd = 5; const R = () => (rnd = rnd * 16807 % 2147483647) / 2147483647;
    const spots = [[8000, 1300, .3], [7860, 1150, .65], [3984, 3470, -1.57], [1776, 3460, -1.7], [1060, 3300, -.25]];
    for (let k = 0; k < 25; k++) spots.push([300 + R() * 8800, 300 + R() * 6200, R() * 6.3]);
    for (const [x, y, a] of spots) {
      if (p.g.Hc(Math.floor(x / 96), Math.floor(y / 96))) continue;
      at(p, x, y, a); p.win.__peerLights = []; for (let k = 0; k < 6; k++) p.win.__peerLights.push({ x: x + Math.cos(k) * 160, y: y + Math.sin(k) * 160, angle: k * 1.1, kind: ['flashlight', 'headlamp', 'lantern'][k % 3], on: true });
      for (let i = 0; i < 45; i++) { const b0 = p.S.stats().cache.lampBuilds; p.frame(1 / 60); buildsWorst = Math.max(buildsWorst, p.S.stats().cache.lampBuilds - b0); }   // warms the lamp caches
      for (let i = 0; i < 3; i++) { const b0 = p.S.stats().cache.lampBuilds; uc = 0; p.frame(1 / 60); if (p.S.stats().cache.lampBuilds === b0 && uc > worst) { worst = uc; worstAt = [x, y]; } }
    }
    A.Uc = realUc;
    out[q] = { worstRayQueriesPerFrame: worst, ceiling, at: worstAt && worstAt.map(Math.round), lampBuildsPerFrameMax: buildsWorst, builds: t.builds };
  }
  return { ok: Object.values(out).every(o => o.worstRayQueriesPerFrame <= o.ceiling && o.lampBuildsPerFrameMax <= o.builds), note: JSON.stringify(out) + ' (entity shadows are capped separately, S09)' };
});

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name).join('; ') : ''));
process.exitCode = pass === results.length ? 0 : 1;
