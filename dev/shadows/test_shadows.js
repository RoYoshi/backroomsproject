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
  poly(p) { this.polys.push({ p: p.slice(), fill: null }); return this; }
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
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() { }, setTransform() { }, clearRect() { }, strokeRect() { }, beginPath() { }, ellipse() { }, stroke() { }, fillRect() { }, fillText() { }, moveTo() { }, lineTo() { }, closePath() { }, fill() { } }), remove() { }, style: {} });
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

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name).join('; ') : ''));
process.exitCode = pass === results.length ? 0 : 1;
