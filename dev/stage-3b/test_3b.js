/* Stage 3B - focused unit checks for the Level 0 presentation authority and the remaster module (Node, no browser; quick).
 *
 *   node dev/stage-3b/test_3b.js        (exit code 1 on any failure)
 *
 * The live game tables (room table, floor mask, lamp list, pillars, columns) are extracted verbatim from the shipped bundle,
 * as dev/br-role/test_br_role.js does, with the real world.js.  The checks prove that the visual data stays presentation:
 * it agrees with the game's own identity, never contradicts a gameplay surface, never puts anything where it could
 * promise collision, and draws its variation from its own seeded hash - never from Math.random or the game's RNG. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const H = require('./visuals_hash.js');
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
function run(name, fn) { try { const r = fn(); check(name, r === undefined ? true : r.ok, r && r.note); } catch (e) { check(name, false, 'EXCEPTION ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); } }

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

run('V01 identity: schema 2 (archetypes), asset visuals:level0, a revision, and the recorded content hash is the SHA-256 of the canonical data (Part 3A scheme)', () => {
  const d = V.definition, h = H.contentHash(d);
  return { ok: d.schemaVersion === 2 && d.assetId === 'visuals:level0' && typeof d.revision === 'string' && d.revision.length > 0 && d.contentHash === h && Object.isFrozen(d) && Object.isFrozen(V),
    note: `revision ${d.revision}, hash ${h.slice(0, 16)}… ${d.contentHash === h ? 'matches' : 'MISMATCH (recorded ' + d.contentHash.slice(0, 16) + '…)'}; frozen ${Object.isFrozen(d)}` };
});
run('V02 the room table is the game\'s: the same 12 rooms (ids room:01..12 in the game\'s order, codes and names), and each visual room names the gameplay surface world.js gives it', () => {
  const bad = [];
  if (V.rooms.length !== G.Oc.length) bad.push('count ' + V.rooms.length + ' vs ' + G.Oc.length);
  G.Oc.forEach((o, i) => { const r = V.rooms[i]; if (!r || r.id !== 'room:' + o.code || r.code !== o.code || r.name !== o.name) bad.push('row ' + i);
    const s = WORLD.surfaceAt((o.x + .5) * T, (o.y + .5) * T, G.Oc); if (r && r.surface !== s) bad.push(r.id + ' surface ' + r.surface + ' vs game ' + s); });
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${G.Oc.length} rooms; surfaces ${V.rooms.map(r => r.code + ':' + r.surface).join(' ')}` };
});
run('V03 lamps and props are named by stable ids only: lamp:001..lamp:NNN in the game\'s lamp order (count cross-checked), props by their world.js ids', () => {
  const ids = G.Fc.map((l, i) => V.lampId(i)), uniq = new Set(ids);
  const fx = V.fixtures.filter(f => f.lamp && !ids.includes(f.lamp));
  return { ok: V.lampCount === G.Fc.length && uniq.size === G.Fc.length && ids[0] === 'lamp:001' && ids[ids.length - 1] === 'lamp:' + String(G.Fc.length).padStart(3, '0') && !fx.length,
    note: `lamps ${G.Fc.length} (recorded ${V.lampCount}), ${ids[0]}..${ids[ids.length - 1]}; props ${WORLD.PROPS.map(p => p.id).join(',')}` };
});
run('V04 every visual record has an explicit prefixed id, unique, in canonical order within its collection, with its required keys', () => {
  const req = { rooms: ['code', 'name', 'surface'], materials: ['family', 'base'], carpetVariants: ['material'], wallFinishes: ['paper', 'trim'], fixtureProfiles: ['diffuser'], damageProfiles: ['wear', 'damp', 'grime', 'stains', 'mildew'],
    decorSets: ['paper', 'scuff'], propSets: ['counter', 'table'], structureSets: [], archetypes: ['carpet', 'wall', 'fixtures', 'damage', 'decor', 'props'], casters: ['element', 'source', 'brRole'], decor: ['room', 'kind', 'x', 'y'], fixtures: ['room', 'kind', 'x', 'y'] };
  const pre = { rooms: 'room:', materials: 'material:', carpetVariants: 'carpet:', wallFinishes: 'wall:', fixtureProfiles: 'fixtures:', damageProfiles: 'damage:', decorSets: 'dressing:', propSets: 'props:', structureSets: 'structure:', archetypes: 'archetype:', casters: 'caster:', decor: 'decor:', fixtures: 'fixture:' }, bad = [], all = new Set();
  for (const c of Object.keys(req)) { let prev = ''; for (const o of V[c]) {
    if (!o || typeof o.id !== 'string' || !o.id.startsWith(pre[c])) { bad.push(c + ' bad id ' + (o && o.id)); continue; }
    if (all.has(o.id)) bad.push('duplicate ' + o.id); all.add(o.id); if (prev && prev >= o.id) bad.push(c + ' order at ' + o.id); prev = o.id;
    for (const k of req[c]) if (o[k] === undefined) bad.push(o.id + ' missing ' + k); } }
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 6).join('; ') : `${all.size} ids in ${Object.keys(req).length} collections` };
});
run('V05 room archetypes: the slice holds the representative rooms (YELLOW HALL, HUMMING ROOMS, BLACKOUT ZONE) plus PILLAR HALL; every slice room has an archetype whose parts all resolve; only slice rooms have one; a visual floor never contradicts its gameplay surface; nothing in an archetype is tied to a position', () => {
  const need = ['room:01', 'room:04', 'room:07'], bad = [];
  if (need.some(id => !V.inSlice(id)) || V.slice[0] !== 'room:01' || new Set(V.slice).size !== V.slice.length) bad.push('slice ' + V.slice.join(','));
  for (const r of V.rooms) {
    if (V.inSlice(r.id) !== !!r.archetype) bad.push(r.id + ' slice/archetype mismatch');
    if (!r.archetype) continue; let p = null; try { p = V.resolve(r.id); } catch (e) { bad.push(r.id + ' ' + e.message); continue; }
    if (!p || !p.carpet || !p.wallpaper || !p.fixtures || !p.decor || !p.props) bad.push(r.id + ' unresolved');
    const cv = V.part('carpetVariants', p.carpet.variant), mat = cv && V.material(cv.material);
    if (!mat || mat.family !== 'carpet' || r.surface !== 'carpet') bad.push(r.id + ': a ' + (mat && mat.family) + ' floor on a ' + r.surface + ' surface');
  }
  for (const a of V.archetypes) for (const k of Object.keys(a)) if (/^(x|y|rect|cells|room)$/.test(k)) bad.push(a.id + ' has positional key ' + k);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `slice ${V.slice.map(id => V.room(id).name + ' -> ' + V.room(id).archetype).join(', ')}` };
});
run('V06 isolated determinism: the presentation PRNG gives the same stream for the same stable key on every call, different streams for different keys, and nothing in the presentation code calls Math.random or the game\'s RNG', () => {
  const a = V.rng('room:01', 'paper'), b = V.rng('room:01', 'paper'), c = V.rng('room:04', 'paper'), sa = [], sb = [], sc = [];
  for (let i = 0; i < 64; i++) { sa.push(a()); sb.push(b()); sc.push(c()); }
  const same = sa.every((v, i) => v === sb[i]), differ = sa.some((v, i) => v !== sc[i]), range = sa.every(v => v >= 0 && v < 1), u = V.unit('x', 1) === V.unit('x', 1);
  const files = ['assets/level0_visuals.js', 'assets/l0-remaster.js'].filter(f => fs.existsSync(path.join(ROOT, f)));
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const offenders = files.filter(f => /Math\.random|__api\.(random|rng)|\bseedrandom\b|crypto\.getRandomValues/.test(strip(read(f))));
  return { ok: same && differ && range && u && !offenders.length, note: `same key ${same}, other key differs ${differ}, in [0,1) ${range}; scanned ${files.join(', ')}: ${offenders.length ? 'RANDOM IN ' + offenders.join(',') : 'no Math.random / game RNG'}` };
});
run('V07 never a second map authority: no geometry, collision or gameplay keys in the visual data, and every authored decor / visual-only fixture lies on its own room\'s floor, clear of every physical prop', () => {
  const banned = ['walls', 'kc', 'collision', 'solids', 'floorCarves', 'wallCarves', 'doorCarves', 'nav', 'spawn', 'lamps', 'props', 'speed', 'surfaceAt'];
  const keys = Object.keys(V.definition).filter(k => banned.includes(k)), bad = [];
  for (const o of [...V.decor, ...V.fixtures]) { const r = roomRect(o.room), [cx, cy] = cellOf(o.x, o.y);
    if (!r || !inRect(r, cx, cy) || !G.zc(cx, cy)) bad.push(o.id + ' not on ' + o.room + ' floor');
    for (const p of WORLD.PROPS) { const q = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect; if (o.x > q.x - 24 && o.x < q.x + q.w + 24 && o.y > q.y - 24 && o.y < q.y + q.h + 24) bad.push(o.id + ' on prop ' + p.id); } }
  return { ok: !keys.length && !bad.length, note: `gameplay keys ${JSON.stringify(keys)}; ${V.decor.length} decor + ${V.fixtures.length} fixture records${bad.length ? ': ' + bad.slice(0, 5).join('; ') : ', all on their room floor, clear of props'}` };
});

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
const ctx2d = () => { const target = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() { } }), createRadialGradient: () => ({ addColorStop() { } }) };
  return new Proxy(target, { get: (t, k) => k in t ? t[k] : () => { }, set: (t, k, v) => { t[k] = v; return true; } }); };
function runRemaster({ search = '', quality = 'medium', patchOc = null, app = 'mock' } = {}) {
  const tasks = [], raf = [], warns = [];
  const Oc = G.Oc.map(o => Object.assign({}, o)); if (patchOc) patchOc(Oc);
  const doc = { createElement: t => ({ width: 1, height: 1, getContext: () => ctx2d(), toDataURL: () => '' }), body: { appendChild() { } } };
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
const sliceRects = () => V.slice.map(id => G.Oc.find(o => o.code === V.room(id).code));
const inSliceRoom = (x, y) => sliceRects().some(o => { const cx = Math.floor(x / T), cy = Math.floor(y / T); return cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h; });
let BASE = null; const base = () => BASE || (BASE = runRemaster());
const roomOf = (E, id) => E.L.dev.source(id);                 // a room's source art (baked into chunks, never on screen itself)
const graphicsIn = c => { const out = []; const walk = n => { if (n instanceof Graphics) out.push(n); for (const k of n.children || []) walk(k); }; walk(c); return out; };

run('R01 the two hooks: built() puts the remaster layer right above the level art and the ceiling layer right above lampTop; lamp() redirects exactly the slice rooms\' lamps (into one module Graphics), every other lamp stays in lampTop; ?remaster=off does nothing at all', () => {
  const E = base(), k = E.world.children, iL = k.indexOf(E.level), iR = k.findIndex(c => c.label === 'l0-remaster'), iT = k.indexOf(E.lampTop), iC = k.findIndex(c => c.label === 'l0-remaster-ceiling');
  const want = G.Fc.map((e, t) => inSliceRoom(e.x, e.y)), redirected = E.targets.map(g => g !== E.lampTop), legacy = E.targets.find(g => g !== E.lampTop);
  const exact = want.every((w, i) => w === redirected[i]), one = new Set(E.targets.filter(g => g !== E.lampTop)).size === 1;
  const O = runRemaster({ search: '?remaster=off' }), offClean = O.targets.every(g => g === O.lampTop) && !O.world.children.some(c => /^l0-remaster/.test(c.label));
  return { ok: iR === iL + 1 && iC === iT + 1 && exact && one && legacy && legacy.parent && legacy.parent.label === 'l0-remaster-ceiling' && offClean && E.stats.built && !E.stats.disabled,
    note: `world order: level ${iL}, remaster ${iR}, lampTop ${iT}, ceiling ${iC}; redirected ${redirected.filter(Boolean).length}/${G.Fc.length} lamps (${E.stats.ownLamps.join(',')}), exactly the slice rooms' ${exact}; ?remaster=off: untouched ${offClean}` };
});
run('R02 the floor art covers exactly each slice room\'s floor cells: every carpet fill lies inside one floor cell run of its room, and their area is the room\'s floor area (no carpet over walls, corridors or other rooms)', () => {
  const E = base(), bad = []; let note = [];
  for (const id of V.slice) {
    const o = G.Oc.find(q => q.code === V.room(id).code), R = roomOf(E, id), fl = R.children[0];
    let area = 0, cells = 0; for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w; cx++) if (G.zc(cx, cy)) cells++;
    for (const op of fl.ops.filter(op => op.op === 'fill' && op.style && op.style.texture)) {
      area += op.w * op.h; const c0 = Math.floor(op.x / T), c1 = Math.ceil((op.x + op.w) / T) - 1, r0 = Math.floor(op.y / T), r1 = Math.ceil((op.y + op.h) / T) - 1;
      for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) if (!G.zc(cx, cy) || cx < o.x || cy < o.y || cx >= o.x + o.w || cy >= o.y + o.h) bad.push(id + ' carpet on ' + cx + ',' + cy);
    }
    if (Math.abs(area - cells * T * T) > 1e-6) bad.push(id + ' area ' + area + ' vs ' + cells * T * T);
    note.push(`${V.room(id).name}: ${cells} cells, ${fl.ops.filter(op => op.style && op.style.texture).length} fills`);
  }
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : note.join('; ') };
});
run('R03 walls stay walls: every papered band (legacy widths and the DEV depth cue alike) lies inside one wall cell, on all four orientations, and no band covers a floor cell; caps only on wall cells', () => {
  const E = base(), bad = [], dirs = { legacy: new Set(), depth: new Set() };
  for (const id of V.slice) { const R = roomOf(E, id);
    for (const [mode, g] of [['legacy', R.children.find(c => c.label === 'walls:legacy')], ['depth', R.children.find(c => c.label === 'walls:depth')]]) {
      if (!g) { bad.push(id + ' no ' + mode + ' walls'); continue; }
      for (const op of g.ops) {
        const pts = op.type === 'poly' ? op.p : op.type === 'rect' ? [op.x, op.y, op.x + op.w, op.y, op.x + op.w, op.y + op.h, op.x, op.y + op.h] : null; if (!pts) continue;
        const xs = pts.filter((v, i) => i % 2 === 0), ys = pts.filter((v, i) => i % 2 === 1), cx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2 / T), cy = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2 / T);
        if (Math.min(...xs) < cx * T - 1e-6 || Math.max(...xs) > (cx + 1) * T + 1e-6 || Math.min(...ys) < cy * T - 1e-6 || Math.max(...ys) > (cy + 1) * T + 1e-6) bad.push(`${mode} band leaves cell ${cx},${cy}`);
        if (G.zc(cx, cy)) bad.push(`${mode} band/cap on floor ${cx},${cy}`);
        const m = op.style && op.style.matrix; if (op.type === 'poly' && m) dirs[mode].add(m.a > 0 && m.d > 0 ? 'S' : m.a > 0 ? 'N' : m.c > 0 ? 'E' : 'W');
      }
    } }
  return { ok: !bad.length && dirs.legacy.size === 4 && dirs.depth.size === 4, note: bad.length ? bad.slice(0, 5).join('; ') : `bands inside their wall cells; orientations legacy ${[...dirs.legacy].sort().join('')}, depth ${[...dirs.depth].sort().join('')}` };
});
run('R04 props keep their exact footprints: each slice prop\'s art is its world.js rect (cell for holes) plus the same contact margin on every side; nothing new promises collision (every decal is a small flat quad, away from props)', () => {
  const E = base(), bad = [], seen = [];
  for (const id of V.slice) { const R = roomOf(E, id), pg = R.children.find(c => c.label === 'props'), o = G.Oc.find(q => q.code === V.room(id).code);
    const mine = WORLD.PROPS.filter(p => { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect, cx = Math.floor((rc.x + rc.w / 2) / T), cy = Math.floor((rc.y + rc.h / 2) / T); return cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h; });
    const pq = pg.ops.filter(op => !(op.w === 56 + 24 && op.h === 56 + 24)); if (pq.length !== mine.length) bad.push(id + ' prop quads ' + pq.length + ' vs props ' + mine.length);
    for (const p of mine) { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect, q = pg.ops.find(op => Math.abs(op.x + op.w / 2 - (rc.x + rc.w / 2)) < 1e-6 && Math.abs(op.y + op.h / 2 - (rc.y + rc.h / 2)) < 1e-6);
      if (!q) { bad.push(p.id + ' missing'); continue; } const m = (q.w - rc.w) / 2; if (Math.abs((q.h - rc.h) / 2 - m) > 1e-6 || m < 0 || m > 16) bad.push(p.id + ' margin'); seen.push(p.id + '+' + m); }
    for (const g of graphicsIn(R).filter(g => g.label === 'decals' || g.label === 'decals-mul')) for (const op of g.ops.filter(op => op.op === 'texture')) {
      const sc = op.tf ? Math.hypot(op.tf[0], op.tf[1]) : 1, size = Math.max(op.w, op.h) * sc, x = op.tf ? op.tf[4] : op.x, y = op.tf ? op.tf[5] : op.y;
      if (size > 200) bad.push('large decal ' + size.toFixed(0));
      for (const p of WORLD.PROPS) { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect; if (x > rc.x && x < rc.x + rc.w && y > rc.y && y < rc.y + rc.h) bad.push('decal centred on prop ' + p.id); } } }
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `props ${seen.join(' ')}; decals all small, none on a prop` };
});
run('R05 the same dressing on every client and every load: two independent builds produce identical art (every quad, fill and transform), drawn from the seeded hash only', () => {
  const A = base(), B = runRemaster(), sig = E => JSON.stringify(V.slice.flatMap(id => graphicsIn(E.L.dev.source(id))).concat(graphicsIn(E.world.children.find(c => c.label === 'l0-remaster-ceiling')))
    .map(g => g.ops.map(op => [op.op, op.type, op.x, op.y, op.w, op.h, op.p, op.tf, op.alpha, op.style && op.style.matrix, op.style && op.style.color])));
  const a = sig(A), b = sig(B);
  return { ok: a === b && a.length > 1000, note: `${(a.length / 1024).toFixed(0)} KB of draw instructions; identical ${a === b}; decals ${A.stats.decals}, faces ${A.stats.faces}, floor fills ${A.stats.floorRects}` };
});
run('R06 presentation only: the module never writes game state, never talks to the network, and no gameplay file mentions it (static scan)', () => {
  const m = read('assets/l0-remaster.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const net = ['WebSocket', '.send(', 'fetch(', 'XMLHttpRequest', '__net', 'sendBeacon', 'postMessage'].filter(k => m.includes(k));
  const writes = m.match(/(__api|__light|__ents|__peerLights|__cam|__brRole|WORLD|L0_VISUALS)(\.[A-Za-z_$][\w$]*)+\s*=[^=]/g) || [];
  const srv = ['server.js', 'sim.js', 'ai.js', 'death_srv.js', 'dphys.js', 'move.js', 'world.js', 'light.js', 'ents.js', 'mp.js', 'assets/br-role.js'].filter(f => /__l0v|l0-remaster|L0_VISUALS|level0_visuals/.test(read(f)));
  return { ok: !net.length && !writes.length && !srv.length, note: `network ${JSON.stringify(net)}, writes ${JSON.stringify(writes)}, protected / BR-RoLE files that mention it ${JSON.stringify(srv)}` };
});
run('R07 fail-safe: a slice room the game table does not have disables the remaster (legacy art and legacy lamps shown, a warning, no exception); lamp() never throws on bad input', () => {
  const E = runRemaster({ patchOc: Oc => { Oc.find(o => o.code === V.room(V.slice[0]).code).name = 'RENAMED'; } });
  const legacy = E.targets.find(g => g !== E.lampTop), root = E.world.children.find(c => c.label === 'l0-remaster');
  let threw = false; try { E.L.lamp(0, null, E.lampTop); E.L.lamp(NaN, { x: NaN, y: undefined }, E.lampTop); } catch (e) { threw = true; }
  return { ok: !!E.stats.disabled && root && root.visible === false && (!legacy || legacy.visible !== false) && E.warns.length > 0 && !threw, note: `disabled '${E.stats.disabled}'; remaster layer hidden ${root && !root.visible}; legacy lamps shown; lamp() threw ${threw}` };
});
run('R08 LOW stays cheap: at BR-RoLE LOW the remaster builds smaller textures and fewer decals (same art direction); MEDIUM and HIGH keep full fidelity', () => {
  const Lo = runRemaster({ quality: 'low' }), Me = base(), car = E => { const t = E.L.stats(); return t; };
  const lo = car(Lo), me = car(Me), ratio = lo.decals / me.decals;
  return { ok: lo.tier === 'low' && me.tier === 'medium' && lo.texMPx < me.texMPx * .75 && ratio < .75 && ratio > .2, note: `LOW: ${lo.texMPx} MPx textures, ${lo.decals} decals; MEDIUM: ${me.texMPx} MPx, ${me.decals} decals (x${ratio.toFixed(2)})` };
});
run('R09 fixtures: the ceiling layer holds one housing per slice lamp at the legacy footprint (90 x 28 at x-45, y-15, inside a 6 px art margin) plus the visual-only records; none for any other lamp', () => {
  const E = base(), ceil = E.world.children.find(c => c.label === 'l0-remaster-ceiling'), quads = graphicsIn(ceil).filter(g => g.label && g.label.startsWith('fixtures')).flatMap(g => g.ops), bad = [];
  const own = G.Fc.map((e, t) => [e, t]).filter(([e]) => inSliceRoom(e.x, e.y));
  for (const [e, t] of own) if (!quads.some(q => q.x === e.x - 51 && q.y === e.y - 21 && q.w === 102 && q.h === 40)) bad.push('lamp ' + t);
  for (const f of V.fixtures.filter(f => V.inSlice(f.room))) if (!quads.some(q => q.x === f.x - 51 && q.y === f.y - 21)) bad.push(f.id);
  const extra = quads.length - own.length - V.fixtures.filter(f => V.inSlice(f.room)).length;
  return { ok: !bad.length && extra === 0, note: `${own.length} slice lamps + ${V.fixtures.filter(f => V.inSlice(f.room)).length} visual-only = ${quads.length} housings${bad.length ? '; missing ' + bad.join(',') : ''}` };
});

run('R10 one carpet layer, not two: while the remaster shows, the legacy carpet sprite is hidden and the same texture with the same mapping is laid over exactly the floor cells the remaster does not own (in the sprite\'s own place, before the level art); remaster off restores the sprite', () => {
  const E = base(), k = E.world.children, lf = k.find(c => c.label === 'l0-legacy-carpet'), bad = [];
  if (!lf) return { ok: false, note: 'no legacy carpet copy' };
  if (k.indexOf(lf) !== k.indexOf(E.carpet) - 1 || k.indexOf(E.carpet) + 1 !== k.indexOf(E.level)) bad.push('order ' + [k.indexOf(lf), k.indexOf(E.carpet), k.indexOf(E.level)].join(','));
  let area = 0, cells = 0; for (let cy = 0; cy < G.FBH; cy++) for (let cx = 0; cx < G.FBW; cx++) if (G.zc(cx, cy) && !inSliceRoom((cx + .5) * T, (cy + .5) * T)) cells++;
  for (const op of lf.ops) { area += op.w * op.h; const m = op.style.matrix; if (op.style.texture !== E.carpet.texture || m.a !== E.carpet.tileScale.x || m.d !== E.carpet.tileScale.y || m.tx !== 0 || m.ty !== 0) bad.push('style');
    for (let cy = op.y / T; cy < (op.y + op.h) / T; cy++) for (let cx = op.x / T; cx < (op.x + op.w) / T; cx++) if (!G.zc(cx, cy) || inSliceRoom((cx + .5) * T, (cy + .5) * T)) bad.push('cell ' + cx + ',' + cy); }
  if (area !== cells * T * T) bad.push('area ' + area + ' vs ' + cells * T * T);
  const on = [E.carpet.visible, lf.visible]; E.L.dev.remaster(false); const off = [E.carpet.visible, lf.visible]; E.L.dev.remaster(true);
  if (on[0] !== false || on[1] !== true || off[0] !== true || off[1] !== false) bad.push('visibility on ' + on + ' off ' + off);
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `${lf.ops.length} rects over ${cells} non-slice floor cells, same texture and tile scale ${E.carpet.tileScale.x}; on: sprite hidden, copy shown; off: sprite back` };
});

run('R11 structure and casters: PILLAR HALL\'s nine game pillars are drawn exactly on their 56 x 56 footprints (one quad each, the same margin as props), no pillar outside a slice room is touched, and the caster notes cover every remastered element kind', () => {
  const E = base(), bad = [], pills = []; let n = 0;
  for (const id of V.slice) { const R = roomOf(E, id), pg = R.children.find(c => c.label === 'props'), o = G.Oc.find(q => q.code === V.room(id).code);
    const mine = G.Pc.filter(b => { const cx = Math.floor((b.x + 28) / T), cy = Math.floor((b.y + 28) / T); return cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h; });
    const q = pg.ops.filter(op => op.w === 56 + 24 && op.h === 56 + 24); n += q.length;
    for (const b of mine) if (!q.some(op => op.x === b.x - 12 && op.y === b.y - 12)) bad.push('pillar ' + b.x + ',' + b.y + ' not drawn exactly'); if (q.length !== mine.length) bad.push(id + ' pillar quads ' + q.length + ' vs ' + mine.length);
    if (mine.length) pills.push(V.room(id).name + ' ' + mine.length); }
  const kinds = V.casters.map(c => c.id).sort().join(','), want = ['caster:decor', 'caster:fixtures', 'caster:pillars', 'caster:props', 'caster:walls'].join(',');
  if (kinds !== want) bad.push('caster notes ' + kinds);
  return { ok: !bad.length && n === 9, note: bad.length ? bad.slice(0, 4).join('; ') : `${pills.join(', ')} pillars, each exactly its footprint; caster notes ${kinds}` };
});

run('R12 the bake: each slice room\'s art is baked into chunk textures on a 384 px grid that covers every floor and wall cell of the room; the chunks in view are baked at once (one render of the room\'s source each, into a texture the chunk\'s exact size at the screen\'s density), drawn as one quad at their exact rect, nothing outside view + one chunk is baked, the cache holds its cap as you travel, a DEV toggle re-bakes in place (no new textures), remaster off shows nothing; without the renderer the remaster falls back to drawing its layers directly', () => {
  const E = runRemaster(), r = E.app.renderer, bad = [], CH = 384; let cover = 0, chunks = 0;
  if (E.L.stats().bake.mode !== 'bake') bad.push('mode ' + E.L.stats().bake.mode);
  for (const id of V.slice) {
    const o = G.Oc.find(q => q.code === V.room(id).code), cs = E.L.dev.chunks(id); chunks += cs.length;
    const x0 = (o.x - 1) * T, y0 = (o.y - 1) * T, x1 = (o.x + o.w + 1) * T, y1 = (o.y + o.h + 1) * T;
    for (const c of cs) { if (c.x0 < x0 || c.y0 < y0 || c.x1 > x1 || c.y1 > y1 || c.x1 - c.x0 > CH || c.y1 - c.y0 > CH) bad.push(c.key + ' outside its box');
      if ((c.x0 % CH && c.x0 !== x0) || (c.y0 % CH && c.y0 !== y0)) bad.push(c.key + ' off the grid'); }
    for (let cy = o.y - 1; cy <= o.y + o.h; cy++) for (let cx = o.x - 1; cx <= o.x + o.w; cx++) {
      const mine = inRect(o, cx, cy) ? G.zc(cx, cy) : !G.zc(cx, cy); if (!mine) continue; cover++;
      if (!cs.some(c => (cx + .5) * T > c.x0 && (cx + .5) * T < c.x1 && (cy + .5) * T > c.y0 && (cy + .5) * T < c.y1)) bad.push(id + ' cell ' + cx + ',' + cy + ' in no chunk'); }
  }
  const yh = G.Oc.find(q => q.code === '01'), at = [(yh.x + yh.w / 2) * T, (yh.y + yh.h / 2) * T], view = { x0: at[0] - 640, y0: at[1] - 360, x1: at[0] + 640, y1: at[1] + 360 };
  const n0 = r.renders.length; E.frame(1, at); const st = E.L.stats(), cs = E.L.dev.chunks('room:01'), src = E.L.dev.source('room:01');
  const inV = cs.filter(c => c.x1 > view.x0 - 8 && c.x0 < view.x1 + 8 && c.y1 > view.y0 - 8 && c.y0 < view.y1 + 8), far = cs.filter(c => !(c.x1 > view.x0 - CH && c.x0 < view.x1 + CH && c.y1 > view.y0 - CH && c.y0 < view.y1 + CH));
  if (!inV.length || inV.some(c => !c.baked || !c.shown || !c.current)) bad.push('in-view chunks not all baked and shown');
  if (far.some(c => c.baked)) bad.push('a far chunk was baked');
  const R1 = r.renders.slice(n0), d = st.bake.density;
  for (const c of inV) { const q = R1.find(o => o.container === src && o.transform && o.transform.tx === -c.x0 && o.transform.ty === -c.y0);
    if (!q) { bad.push(c.key + ' not rendered'); continue; } const t = q.target; if (!t || !t.o || t.o.width !== c.x1 - c.x0 || t.o.height !== c.y1 - c.y0 || Math.abs(t.o.resolution - d) > 1e-3 || t.o.antialias !== false || q.clear !== true) bad.push(c.key + ' target');
    const g = E.world.children.find(k => k.label === 'l0-remaster').children.find(k => k.label === 'l0v-view:room:01').children.find(k => k.ops && k.ops.some(op => op.tex === t));
    if (!g || g.ops.length !== 1 || g.ops[0].x !== c.x0 || g.ops[0].y !== c.y0 || g.ops[0].w !== c.x1 - c.x0 || g.ops[0].h !== c.y1 - c.y0) bad.push(c.key + ' quad'); }
  const first = new Map(R1.map(o => [o.transform.tx + ',' + o.transform.ty, o.target])), n1 = r.renders.length; E.L.dev.decals(false); E.frame(1, at);
  const R2 = r.renders.slice(n1); let rebaked = 0; for (const c of inV) { const q = R2.find(o => o.transform.tx === -c.x0 && o.transform.ty === -c.y0); if (q && q.target === first.get(-c.x0 + ',' + -c.y0)) rebaked++; }
  E.L.dev.decals(true); E.frame(1, at);
  if (rebaked !== inV.length) bad.push(`toggle re-baked ${rebaked} / ${inV.length} in place`);
  let maxRes = 0; for (const id of V.slice) { const o = G.Oc.find(q => q.code === V.room(id).code); for (let cy = o.y; cy < o.y + o.h; cy += 4) for (let cx = o.x; cx < o.x + o.w; cx += 6) { E.frame(2, [(cx + .5) * T, (cy + .5) * T]); maxRes = Math.max(maxRes, E.L.stats().bake.resident); } }
  const cap = E.L.stats().bake.cache, sv = E.L.stats().bake; if (sv.resident > cap) bad.push('resident ' + sv.resident + ' > cap ' + cap);
  E.L.dev.remaster(false); E.frame(2, at); const offShown = V.slice.flatMap(id => E.L.dev.chunks(id)).filter(c => c.shown).length; E.L.dev.remaster(true);
  if (offShown) bad.push('remaster off still shows ' + offShown + ' chunks');
  const D = runRemaster({ app: null }), dv = D.L.stats().bake.mode, dsrc = D.L.dev.source('room:01'); D.frame(1, at);
  if (dv !== 'direct' || !dsrc.parent || dsrc.parent.label !== 'l0v-view:room:01' || dsrc.visible !== true) bad.push('direct fallback ' + dv);
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `${chunks} chunks cover all ${cover} floor + wall cells; YELLOW HALL centre: ${inV.length} in view baked (density ${d}), ${far.length} far ones untouched; toggle re-baked ${rebaked} in place; travel: resident max ${maxRes}, now ${sv.resident} (cap ${cap}), ${sv.evictions} evictions; off: none shown; no renderer: direct` };
});

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name.split(' ')[0]).join(', ') : ''));
process.exit(pass === results.length ? 0 : 1);
