/* Stage 3B - focused unit checks for the Level 0 presentation authority and the remaster module (Node, no browser; quick).
 *
 *   node dev/stage-3b/test_3b.js        (exit code 1 on any failure)
 *
 * The live game tables (room table, floor mask, lamp list, pillars, pits) are extracted verbatim from the shipped bundle,
 * as dev/br-role/test_br_role.js does, with the real world.js (dev/stage-3b/harness_3b.js).  The checks prove that the
 * visual data stays presentation: it agrees with the game's own identity, never contradicts a gameplay surface, never puts
 * anything where it could promise collision, and draws its variation from its own seeded hash - never from Math.random or
 * the game's RNG.  3B-F: the remaster draws ZONES (the rooms, and the corridor network split into its connected pieces);
 * each zone owns its floor cells, each wall face is drawn once by the zone whose floor it faces, and one bake grid covers
 * the whole map. */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./visuals_hash.js');
const { ROOT, read, WORLD, G, V, T, cellOf, roomRect, inRect, Graphics, runRemaster } = require('./harness_3b.js');
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
function run(name, fn) { try { const r = fn(); check(name, r === undefined ? true : r.ok, r && r.note); } catch (e) { check(name, false, 'EXCEPTION ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); } }

/* ---------- which zone each floor cell belongs to, from the game tables alone (independent of the module) ---------- */
const roomIdAt = (cx, cy) => { const o = G.Oc.find(o => inRect(o, cx, cy)); return o ? 'room:' + o.code : null; };
const baseAt = (cx, cy) => { if (!G.zc(cx, cy)) return null; const r = roomIdAt(cx, cy); return r ? (V.inSlice(r) ? r : null) : (V.inSlice('zone:corridors') ? 'zone:corridors' : null); };
const sliceRoomIds = () => V.slice.filter(id => id.startsWith('room:'));
const inSliceRoom = (x, y) => { const [cx, cy] = cellOf(x, y), r = roomIdAt(cx, cy); return !!r && V.inSlice(r); };
const SIDES = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
const sideOf = m => m.a > 0 && m.d > 0 ? 'S' : m.a > 0 ? 'N' : m.c > 0 ? 'E' : 'W';      // a band's paper orientation (buildWalls' matrices)
let BASE = null; const base = () => BASE || (BASE = runRemaster());
const zonesOf = E => E.L.stats().rooms;
const src = (E, id) => E.L.dev.source(id);
const layer = (E, id, label) => src(E, id).children.find(c => c.label === label);
const graphicsIn = c => { const out = []; const walk = n => { if (n instanceof Graphics) out.push(n); for (const k of n.children || []) walk(k); }; walk(c); return out; };
function ownership(E) {                                  // cell -> zone id, from each zone's floor fills; and the problems found on the way
  const own = new Map(), bad = [];
  for (const z of zonesOf(E)) { const zb = E.L.dev.zone(z.id).base, fl = layer(E, z.id, 'floor');
    for (const op of fl.ops.filter(op => op.op === 'fill' && op.style && op.style.texture)) for (let cy = op.y / T; cy < (op.y + op.h) / T; cy++) for (let cx = op.x / T; cx < (op.x + op.w) / T; cx++) {
      const k = cx + ',' + cy; if (baseAt(cx, cy) !== zb) bad.push(`${z.id} floor on ${k} (${baseAt(cx, cy) || 'not its floor'})`); if (own.has(k)) bad.push(k + ' drawn by ' + own.get(k) + ' and ' + z.id); own.set(k, z.id); } }
  return { own, bad };
}

run('V01 identity: schema 3 (archetypes, zones, floor variants), asset visuals:level0, a revision, and the recorded content hash is the SHA-256 of the canonical data (Part 3A scheme)', () => {
  const d = V.definition, h = H.contentHash(d);
  return { ok: d.schemaVersion === 3 && d.assetId === 'visuals:level0' && typeof d.revision === 'string' && d.revision.length > 0 && d.contentHash === h && Object.isFrozen(d) && Object.isFrozen(V),
    note: `revision ${d.revision}, hash ${h.slice(0, 16)}… ${d.contentHash === h ? 'matches' : 'MISMATCH (recorded ' + d.contentHash.slice(0, 16) + '…)'}; frozen ${Object.isFrozen(d)}` };
});
run('V02 the room table is the game\'s: the same 12 rooms (ids room:01..12 in the game\'s order, codes and names), and each visual room names the gameplay surface world.js gives it; the corridor zone names the corridors\' surface', () => {
  const bad = [];
  if (V.rooms.length !== G.Oc.length) bad.push('count ' + V.rooms.length + ' vs ' + G.Oc.length);
  G.Oc.forEach((o, i) => { const r = V.rooms[i]; if (!r || r.id !== 'room:' + o.code || r.code !== o.code || r.name !== o.name) bad.push('row ' + i);
    const s = WORLD.surfaceAt((o.x + .5) * T, (o.y + .5) * T, G.Oc); if (r && r.surface !== s) bad.push(r.id + ' surface ' + r.surface + ' vs game ' + s); });
  const cz = V.zones.find(z => z.id === 'zone:corridors'), cs = new Set();
  for (let cy = 0; cy < G.FBH; cy++) for (let cx = 0; cx < G.FBW; cx++) if (G.zc(cx, cy) && !roomIdAt(cx, cy)) cs.add(WORLD.surfaceAt((cx + .5) * T, (cy + .5) * T, G.Oc));
  if (!cz || cs.size !== 1 || !cs.has(cz.surface)) bad.push('corridor surface ' + (cz && cz.surface) + ' vs game ' + [...cs]);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${G.Oc.length} rooms; surfaces ${V.rooms.map(r => r.code + ':' + r.surface).join(' ')}; corridors ${[...cs]}` };
});
run('V03 lamps and props are named by stable ids only: lamp:001..lamp:NNN in the game\'s lamp order (count cross-checked), props by their world.js ids', () => {
  const ids = G.Fc.map((l, i) => V.lampId(i)), uniq = new Set(ids);
  const fx = V.fixtures.filter(f => f.lamp && !ids.includes(f.lamp));
  return { ok: V.lampCount === G.Fc.length && uniq.size === G.Fc.length && ids[0] === 'lamp:001' && ids[ids.length - 1] === 'lamp:' + String(G.Fc.length).padStart(3, '0') && !fx.length,
    note: `lamps ${G.Fc.length} (recorded ${V.lampCount}), ${ids[0]}..${ids[ids.length - 1]}; props ${WORLD.PROPS.map(p => p.id).join(',')}` };
});
run('V04 every visual record has an explicit prefixed id, unique, in canonical order within its collection, with its required keys', () => {
  const req = { rooms: ['code', 'name', 'surface'], zones: ['name', 'surface', 'archetype'], materials: ['family', 'base'], floorVariants: ['material', 'kind', 'surface'], wallFinishes: ['paper', 'trim'], fixtureProfiles: ['diffuser'],
    damageProfiles: ['wear', 'damp', 'grime', 'stains', 'mildew'], decorSets: ['grit', 'indent', 'scuff'], propSets: ['counter', 'table'], structureSets: [], archetypes: ['floor', 'wall', 'fixtures', 'damage', 'decor', 'props'],
    casters: ['element', 'source', 'brRole'], kinds: ['class', 'surface', 'note'], decor: ['room', 'kind', 'x', 'y'], fixtures: ['room', 'kind', 'x', 'y'] };
  const pre = { rooms: 'room:', zones: 'zone:', materials: 'material:', floorVariants: 'floor:', wallFinishes: 'wall:', fixtureProfiles: 'fixtures:', damageProfiles: 'damage:', decorSets: 'dressing:', propSets: 'props:', structureSets: 'structure:',
    archetypes: 'archetype:', casters: 'caster:', kinds: 'kind:', decor: 'decor:', fixtures: 'fixture:' }, bad = [], all = new Set();
  for (const c of Object.keys(req)) { let prev = ''; if (!Array.isArray(V[c])) { bad.push('no collection ' + c); continue; } for (const o of V[c]) {
    if (!o || typeof o.id !== 'string' || !o.id.startsWith(pre[c])) { bad.push(c + ' bad id ' + (o && o.id)); continue; }
    if (all.has(o.id)) bad.push('duplicate ' + o.id); all.add(o.id); if (prev && prev >= o.id) bad.push(c + ' order at ' + o.id); prev = o.id;
    for (const k of req[c]) if (o[k] === undefined) bad.push(o.id + ' missing ' + k); } }
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 6).join('; ') : `${all.size} ids in ${Object.keys(req).length} collections` };
});
run('V05 archetypes: every room and zone has an archetype whose parts all resolve; the slice starts with YELLOW HALL and holds the representative rooms; a visual floor never contradicts its zone\'s gameplay surface (the variant\'s surface is the zone\'s, its material the variant\'s kind); nothing in an archetype is tied to a position', () => {
  const need = ['room:01', 'room:04', 'room:07'], bad = [], fam = { carpet: 'carpet', concrete: 'concrete', tile: 'tile' };
  if (need.some(id => !V.inSlice(id)) || V.slice[0] !== 'room:01' || new Set(V.slice).size !== V.slice.length || V.slice.some(id => !V.room(id))) bad.push('slice ' + V.slice.join(','));
  for (const r of [...V.rooms, ...V.zones]) {
    if (!r.archetype) { bad.push(r.id + ' no archetype'); continue; } let p = null; try { p = V.resolve(r.id); } catch (e) { bad.push(r.id + ' ' + e.message); continue; }
    if (!p || !p.floor || !p.wallpaper || !p.fixtures || !p.decor || !p.props) { bad.push(r.id + ' unresolved'); continue; }
    const fv = V.part('floorVariants', p.floor.variant), mat = fv && V.material(fv.material);
    if (!fv || fv.surface !== r.surface || !mat || mat.family !== fam[fv.kind] || p.floor.kind !== fv.kind) bad.push(r.id + ': a ' + (fv && fv.kind) + ' (' + (mat && mat.family) + ') floor for a ' + r.surface + ' surface');
    if (!V.material(p.wallpaper.paper) || V.material(p.wallpaper.paper).family !== 'wallpaper') bad.push(r.id + ' paper ' + p.wallpaper.paper);
  }
  for (const a of V.archetypes) for (const k of Object.keys(a)) if (/^(x|y|rect|cells|room)$/.test(k)) bad.push(a.id + ' has positional key ' + k);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `slice ${V.slice.join(', ')}; ${[...V.rooms, ...V.zones].map(r => r.id.replace(/^(room|zone):/, '') + '->' + V.resolve(r.id).floor.variant.slice(6)).join(' ')}` };
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
run('V08 the canon audit holds (STAGE_3B_FINAL_PROP_CANON_AUDIT.md): every dressing kind has a class; nothing classed AVOID can be drawn (no loose objects on any prop, no authored record, no seeded or wall placement of one); the carpet is seamless in every archetype', () => {
  const bad = [], classes = ['confirmed', 'supported', 'inference', 'avoid', 'dev'];
  for (const k of V.kinds) if (!classes.includes(k.class)) bad.push(k.id + ' class ' + k.class);
  for (const ps of V.propSets) for (const it of [...ps.counter, ...ps.table]) bad.push(ps.id + ' carries ' + it);
  for (const d of V.decor) if (!V.drawable(d.kind)) bad.push(d.id + ' is ' + ((V.kind(d.kind) || {}).class || 'unclassified'));
  const src = read('assets/l0-remaster.js'), placed = new Set([...src.matchAll(/\bput\((?:mulG|decG|f|g|wG|mG|dG), '([a-z]+)'/g)].map(m => m[1]));
  for (const k of placed) if (!V.drawable(k)) bad.push('the renderer places ' + k + ' (' + ((V.kind(k) || {}).class || 'unclassified') + ')');
  for (const a of V.archetypes) if (a.seams !== 'none') bad.push(a.id + ' seams ' + a.seams);
  const avoid = V.kinds.filter(k => k.class === 'avoid').map(k => k.id.slice(5));
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 6).join('; ') : `${V.kinds.length} kinds classified; placed by the renderer: ${[...placed].sort().join(', ')}; never drawn (avoid): ${avoid.join(', ')}; prop sets empty; seamless carpet` };
});

/* ---------- the remaster module in a VM ---------- */
run('R01 the two hooks: built() puts the remaster layer right above the level art and the ceiling layer right above lampTop; lamp() redirects exactly the slice rooms\' lamps (into one module Graphics), every other lamp stays in lampTop; ?remaster=off does nothing at all', () => {
  const E = base(), k = E.world.children, iL = k.indexOf(E.level), iR = k.findIndex(c => c.label === 'l0-remaster'), iT = k.indexOf(E.lampTop), iC = k.findIndex(c => c.label === 'l0-remaster-ceiling');
  const want = G.Fc.map(e => inSliceRoom(e.x, e.y)), redirected = E.targets.map(g => g !== E.lampTop), legacy = E.targets.find(g => g !== E.lampTop);
  const exact = want.every((w, i) => w === redirected[i]), one = new Set(E.targets.filter(g => g !== E.lampTop)).size === 1;
  const O = runRemaster({ search: '?remaster=off' }), offClean = O.targets.every(g => g === O.lampTop) && !O.world.children.some(c => /^l0-remaster/.test(c.label));
  return { ok: iR === iL + 1 && iC === iT + 1 && exact && one && legacy && legacy.parent && legacy.parent.label === 'l0-remaster-ceiling' && offClean && E.stats.built && !E.stats.disabled,
    note: `world order: level ${iL}, remaster ${iR}, lampTop ${iT}, ceiling ${iC}; redirected ${redirected.filter(Boolean).length}/${G.Fc.length} lamps, exactly the slice rooms' ${exact}; ?remaster=off: untouched ${offClean}` };
});
run('R02 zones own the floor once: every floor fill lies on floor cells of its own zone (a room: its game rect; a corridor piece: corridor floor), no cell is drawn twice, and every floor cell of every slice zone is drawn (rooms, and the corridor network split into its connected pieces, in map order)', () => {
  const E = base(), { own, bad } = ownership(E), per = new Map();
  for (let cy = 0; cy < G.FBH; cy++) for (let cx = 0; cx < G.FBW; cx++) { const b = baseAt(cx, cy); if (!b) continue; if (!own.has(cx + ',' + cy)) bad.push('floor ' + cx + ',' + cy + ' of ' + b + ' not drawn'); per.set(b, (per.get(b) || 0) + 1); }
  /* the corridor pieces: 4-connected components of corridor floor, numbered in scan order */
  const comp = new Map(); let n = 0;
  for (let cy = 0; cy < G.FBH; cy++) for (let cx = 0; cx < G.FBW; cx++) { const k = cx + ',' + cy; if (baseAt(cx, cy) !== 'zone:corridors' || comp.has(k)) continue; n++; const q = [[cx, cy]]; comp.set(k, n);
    for (let i = 0; i < q.length; i++) for (const [dx, dy] of Object.values(SIDES)) { const nx = q[i][0] + dx, ny = q[i][1] + dy, k2 = nx + ',' + ny; if (baseAt(nx, ny) === 'zone:corridors' && !comp.has(k2)) { comp.set(k2, n); q.push([nx, ny]); } } }
  for (const [k, c] of comp) if (own.get(k) !== 'zone:corridors/' + String(c).padStart(2, '0')) bad.push('corridor ' + k + ' in ' + own.get(k) + ', piece ' + c);
  const zs = zonesOf(E), pieces = zs.filter(z => z.kind === 'corridors').length;
  if (V.inSlice('zone:corridors') && pieces !== n) bad.push('corridor pieces ' + pieces + ' vs ' + n);
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `${own.size} floor cells, each drawn once: ${[...per].map(([b, c]) => b.replace(/^(room|zone):/, '') + ' ' + c).join(', ')}; corridors in ${pieces} pieces` };
});
run('R03 walls stay walls: every papered band (legacy widths and the DEV depth cue alike) lies inside one wall cell the game\'s sight test blocks (never a floor or pit cell), on all four orientations', () => {
  const E = base(), bad = [], dirs = { legacy: new Set(), depth: new Set() };
  for (const z of zonesOf(E)) for (const [mode, g] of [['legacy', layer(E, z.id, 'walls:legacy')], ['depth', layer(E, z.id, 'walls:depth')]]) {
    if (!g) { bad.push(z.id + ' no ' + mode + ' walls'); continue; }
    for (const op of g.ops) {
      const pts = op.type === 'poly' ? op.p : op.type === 'rect' ? [op.x, op.y, op.x + op.w, op.y, op.x + op.w, op.y + op.h, op.x, op.y + op.h] : null; if (!pts) continue;
      const xs = pts.filter((v, i) => i % 2 === 0), ys = pts.filter((v, i) => i % 2 === 1), cx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2 / T), cy = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2 / T);
      if (Math.min(...xs) < cx * T - 1e-6 || Math.max(...xs) > (cx + 1) * T + 1e-6 || Math.min(...ys) < cy * T - 1e-6 || Math.max(...ys) > (cy + 1) * T + 1e-6) bad.push(`${mode} band leaves cell ${cx},${cy}`);
      if (G.zc(cx, cy) || !G.Hc(cx, cy)) bad.push(`${mode} band on a ${G.zc(cx, cy) ? 'floor' : 'pit'} cell ${cx},${cy}`);
      const m = op.style && op.style.matrix; if (op.type === 'poly' && m) dirs[mode].add(sideOf(m));
    } }
  return { ok: !bad.length && dirs.legacy.size === 4 && dirs.depth.size === 4, note: bad.length ? bad.slice(0, 5).join('; ') : `bands inside their wall cells; orientations legacy ${[...dirs.legacy].sort().join('')}, depth ${[...dirs.depth].sort().join('')}` };
});
run('R04 props keep their exact footprints: each prop\'s art is its world.js rect (cell for holes and windows) plus the same contact margin on every side, drawn by the zone owning its centre; nothing new promises collision (every decal is a small flat quad, clipped to its own zone\'s floor or one wall band, never centred on a prop)', () => {
  const E = base(), { own } = ownership(E), bad = [], seen = [];
  for (const z of zonesOf(E)) { const pg = layer(E, z.id, 'props');
    const mine = WORLD.PROPS.filter(p => { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect, [cx, cy] = cellOf(rc.x + rc.w / 2, rc.y + rc.h / 2); return own.get(cx + ',' + cy) === z.id; });
    const pq = pg.ops.filter(op => !(op.w === 56 + 24 && op.h === 56 + 24)); if (pq.length !== mine.length) bad.push(z.id + ' prop quads ' + pq.length + ' vs props ' + mine.length);
    for (const p of mine) { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect, q = pg.ops.find(op => Math.abs(op.x + op.w / 2 - (rc.x + rc.w / 2)) < 1e-6 && Math.abs(op.y + op.h / 2 - (rc.y + rc.h / 2)) < 1e-6);
      if (!q) { bad.push(p.id + ' missing'); continue; } const m = (q.w - rc.w) / 2; if (Math.abs((q.h - rc.h) / 2 - m) > 1e-6 || m < 0 || m > 16) bad.push(p.id + ' margin'); seen.push(p.id + '+' + m); }
    let nd = 0;
    for (const g of graphicsIn(src(E, z.id)).filter(g => g.label === 'decals' || g.label === 'decals-mul' || g.label === 'wall-decor')) for (const op of g.ops.filter(op => op.op === 'fill' && op.style && op.style.texture)) {
      nd++; const m = op.style.matrix, s = op.style.texture.source, cx = m.a * s.w / 2 + m.c * s.h / 2 + m.tx, cy = m.b * s.w / 2 + m.d * s.h / 2 + m.ty, size = Math.max(Math.hypot(m.a, m.b) * s.w, Math.hypot(m.c, m.d) * s.h);
      if (size > 200) bad.push('large decal ' + size.toFixed(0));
      const xs = op.type === 'rect' ? [op.x, op.x + op.w] : op.p.filter((v, i) => i % 2 === 0), ys = op.type === 'rect' ? [op.y, op.y + op.h] : op.p.filter((v, i) => i % 2 === 1);
      const c0 = Math.floor(Math.min(...xs) / T + 1e-6), c1 = Math.ceil(Math.max(...xs) / T - 1e-6) - 1, r0 = Math.floor(Math.min(...ys) / T + 1e-6), r1 = Math.ceil(Math.max(...ys) / T - 1e-6) - 1;
      if (g.label === 'wall-decor') { if (c0 !== c1 || r0 !== r1 || G.zc(c0, r0)) bad.push('wall mark leaves its wall cell at ' + c0 + ',' + r0); }
      else for (let yy = r0; yy <= r1; yy++) for (let xx = c0; xx <= c1; xx++) if (own.get(xx + ',' + yy) !== z.id) bad.push(z.id + ' floor mark off its floor at ' + xx + ',' + yy);
      for (const p of WORLD.PROPS) { const rc = p.type === 'gap' || p.type === 'window' ? p.cell : p.rect; if (g.label !== 'wall-decor' && cx > rc.x && cx < rc.x + rc.w && cy > rc.y && cy < rc.y + rc.h) bad.push('decal centred on prop ' + p.id); } }
    if (z.kind === 'room' && !nd) bad.push(z.id + ' no decal fills found'); if (nd) seen.push(z.id.replace(/^(room|zone):/, '') + ':' + nd); }
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `props ${seen.filter(s => s.includes('+')).join(' ')}; clipped decal fills ${seen.filter(s => !s.includes('+')).join(' ')}` };
});
run('R05 the same dressing on every client and every load: two independent builds produce identical art (every quad, fill and transform), drawn from the seeded hash only', () => {
  const A = base(), B = runRemaster(), sig = E => JSON.stringify(zonesOf(E).flatMap(z => graphicsIn(src(E, z.id))).concat(graphicsIn(E.world.children.find(c => c.label === 'l0-remaster-ceiling')))
    .map(g => g.ops.map(op => [op.op, op.type, op.x, op.y, op.w, op.h, op.p, op.tf, op.alpha, op.style && op.style.matrix, op.style && op.style.color])));
  const a = sig(A), b = sig(B);
  return { ok: a === b && a.length > 1000, note: `${(a.length / 1024).toFixed(0)} KB of draw instructions over ${zonesOf(A).length} zones; identical ${a === b}; decals ${A.stats.decals}, faces ${A.stats.faces}, floor fills ${A.stats.floorRects}` };
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
  return { ok: !!E.stats.disabled && root && root.visible === false && (!legacy || legacy.visible !== false) && E.carpet.visible !== false && E.warns.length > 0 && !threw, note: `disabled '${E.stats.disabled}'; remaster layer hidden ${root && !root.visible}; legacy lamps and carpet shown; lamp() threw ${threw}` };
});
run('R08 LOW stays cheap: at BR-RoLE LOW the remaster builds smaller textures and fewer decals (same art direction); MEDIUM and HIGH keep full fidelity', () => {
  const lo = runRemaster({ quality: 'low' }).L.stats(), me = base().L.stats(), hi = runRemaster({ quality: 'high' }).L.stats(), ratio = lo.decals / me.decals;
  return { ok: lo.tier === 'low' && me.tier === 'medium' && hi.tier === 'high' && lo.texMPx < me.texMPx * .75 && ratio < .75 && ratio > .2 && hi.decals === me.decals && hi.rooms.length === me.rooms.length && lo.rooms.length === me.rooms.length,
    note: `LOW: ${lo.texMPx} MPx textures, ${lo.decals} decals; MEDIUM: ${me.texMPx} MPx, ${me.decals} decals (LOW x${ratio.toFixed(2)}); HIGH ${hi.texMPx} MPx, ${hi.decals} decals; the same ${me.rooms.length} zones at every tier` };
});
run('R09 fixtures: the ceiling layer holds one housing per slice-room lamp at the legacy footprint (90 x 28 at x-45, y-15, inside a 6 px art margin) plus the visual-only records; none for any other lamp (the corridors have none, as in the game)', () => {
  const E = base(), ceil = E.world.children.find(c => c.label === 'l0-remaster-ceiling'), quads = graphicsIn(ceil).filter(g => g.label && g.label.startsWith('fixtures')).flatMap(g => g.ops), bad = [];
  const own = G.Fc.map((e, t) => [e, t]).filter(([e]) => inSliceRoom(e.x, e.y)), vis = V.fixtures.filter(f => V.inSlice(f.room));
  for (const [e, t] of own) if (!quads.some(q => q.x === e.x - 51 && q.y === e.y - 21 && q.w === 102 && q.h === 40)) bad.push('lamp ' + t);
  for (const f of vis) if (!quads.some(q => q.x === f.x - 51 && q.y === f.y - 21)) bad.push(f.id);
  const extra = quads.length - own.length - vis.length;
  return { ok: !bad.length && extra === 0, note: `${own.length} slice lamps + ${vis.length} visual-only = ${quads.length} housings${bad.length ? '; missing ' + bad.join(',') : ''}` };
});
run('R10 one carpet layer, not two: while the remaster shows, the legacy carpet sprite is hidden and the same texture with the same mapping is laid over exactly the floor cells no zone owns (in the sprite\'s own place, before the level art); remaster off restores the sprite', () => {
  const E = base(), k = E.world.children, lf = k.find(c => c.label === 'l0-legacy-carpet'), bad = [];
  if (!lf) return { ok: false, note: 'no legacy carpet copy' };
  if (k.indexOf(lf) !== k.indexOf(E.carpet) - 1 || k.indexOf(E.carpet) + 1 !== k.indexOf(E.level)) bad.push('order ' + [k.indexOf(lf), k.indexOf(E.carpet), k.indexOf(E.level)].join(','));
  let area = 0, cells = 0; for (let cy = 0; cy < G.FBH; cy++) for (let cx = 0; cx < G.FBW; cx++) if (G.zc(cx, cy) && !baseAt(cx, cy)) cells++;
  for (const op of lf.ops) { area += op.w * op.h; const m = op.style.matrix; if (op.style.texture !== E.carpet.texture || m.a !== E.carpet.tileScale.x || m.d !== E.carpet.tileScale.y || m.tx !== 0 || m.ty !== 0) bad.push('style');
    for (let cy = op.y / T; cy < (op.y + op.h) / T; cy++) for (let cx = op.x / T; cx < (op.x + op.w) / T; cx++) if (!G.zc(cx, cy) || baseAt(cx, cy)) bad.push('cell ' + cx + ',' + cy); }
  if (area !== cells * T * T) bad.push('area ' + area + ' vs ' + cells * T * T);
  const on = [E.carpet.visible, lf.visible]; E.L.dev.remaster(false); const off = [E.carpet.visible, lf.visible]; E.L.dev.remaster(true);
  if (on[0] !== false || on[1] !== true || off[0] !== true || off[1] !== false) bad.push('visibility on ' + on + ' off ' + off);
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `${lf.ops.length} rects over the ${cells} floor cells no zone owns, same texture and tile scale ${E.carpet.tileScale.x}; on: sprite hidden, copy shown; off: sprite back` };
});
run('R11 structure and casters: PILLAR HALL\'s nine game pillars are drawn exactly on their 56 x 56 footprints (one quad each, the same margin as props) when it is remastered, no pillar elsewhere, and the caster notes cover every remastered element kind', () => {
  const E = base(), { own } = ownership(E), bad = [], pills = []; let n = 0, want = 0;
  for (const z of zonesOf(E)) { const pg = layer(E, z.id, 'props');
    const mine = G.Pc.filter(b => { const [cx, cy] = cellOf(b.x + 28, b.y + 28); return own.get(cx + ',' + cy) === z.id; }); want += mine.length;
    const q = pg.ops.filter(op => op.w === 56 + 24 && op.h === 56 + 24); n += q.length;
    for (const b of mine) if (!q.some(op => op.x === b.x - 12 && op.y === b.y - 12)) bad.push('pillar ' + b.x + ',' + b.y + ' not drawn exactly'); if (q.length !== mine.length) bad.push(z.id + ' pillar quads ' + q.length + ' vs ' + mine.length);
    if (mine.length) pills.push(z.id + ' ' + mine.length); }
  const kinds = V.casters.map(c => c.id).sort().join(','), wantK = ['caster:decor', 'caster:fixtures', 'caster:pillars', 'caster:pits', 'caster:props', 'caster:walls'].join(',');
  if (kinds !== wantK) bad.push('caster notes ' + kinds);
  if (V.inSlice('room:11') && n !== 9) bad.push('pillars drawn ' + n);
  return { ok: !bad.length && n === want, note: bad.length ? bad.slice(0, 4).join('; ') : `${pills.join(', ')} pillars, each exactly its footprint; caster notes ${kinds}` };
});

run('R12 the bake: ONE 384 px grid over the whole map; a chunk lists every zone with content in it and bakes them all into one texture (one render per zone, the first clearing), drawn as one quad at its exact rect; every zone\'s floor and wall cells lie in a chunk that lists it; the chunks in view are baked at once at the screen\'s density, nothing beyond view + one chunk is baked, the cache holds its cap as you travel, a DEV toggle re-bakes in place, remaster off shows nothing; without the renderer the zones are drawn directly', () => {
  const E = runRemaster(), r = E.app.renderer, bad = [], CH = 384, all = E.L.dev.chunks(), keys = new Set(), zs = zonesOf(E);
  if (E.L.stats().bake.mode !== 'bake') bad.push('mode ' + E.L.stats().bake.mode);
  for (const c of all) { if (c.x0 % CH || c.y0 % CH || c.x1 - c.x0 > CH || c.y1 - c.y0 > CH || c.x1 > G.FBW * T || c.y1 > G.FBH * T || !c.zones.length) bad.push(c.key + ' off the grid'); if (keys.has(c.key)) bad.push('duplicate ' + c.key); keys.add(c.key); }
  const chunkAt = (x, y) => all.find(c => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1);
  let cover = 0;
  for (const z of zs) { const S = src(E, z.id), cells = new Set();
    for (const op of layer(E, z.id, 'floor').ops.filter(op => op.style && op.style.texture)) for (let cy = op.y / T; cy < (op.y + op.h) / T; cy++) for (let cx = op.x / T; cx < (op.x + op.w) / T; cx++) cells.add(cx + ',' + cy);
    for (const op of layer(E, z.id, 'walls:legacy').ops.filter(op => op.type === 'poly')) { const xs = op.p.filter((v, i) => i % 2 === 0), ys = op.p.filter((v, i) => i % 2 === 1); cells.add(Math.floor((Math.min(...xs) + Math.max(...xs)) / 2 / T) + ',' + Math.floor((Math.min(...ys) + Math.max(...ys)) / 2 / T)); }
    for (const k of cells) { const [cx, cy] = k.split(',').map(Number), c = chunkAt((cx + .5) * T, (cy + .5) * T); cover++; if (!c || !c.zones.includes(z.id)) bad.push(z.id + ' cell ' + k + ' in no chunk of its own'); } }
  const yh = G.Oc.find(q => q.code === '01'), at = [(yh.x + yh.w / 2) * T, (yh.y + yh.h / 2) * T], view = { x0: at[0] - 640, y0: at[1] - 360, x1: at[0] + 640, y1: at[1] + 360 };
  const n0 = r.renders.length; E.frame(1, at); const st = E.L.stats(), cs = E.L.dev.chunks();
  const inV = cs.filter(c => c.x1 > view.x0 - 8 && c.x0 < view.x1 + 8 && c.y1 > view.y0 - 8 && c.y0 < view.y1 + 8), far = cs.filter(c => !(c.x1 > view.x0 - CH && c.x0 < view.x1 + CH && c.y1 > view.y0 - CH && c.y0 < view.y1 + CH));
  if (!inV.length || inV.some(c => !c.baked || !c.shown || !c.current)) bad.push('in-view chunks not all baked and shown');
  const R1 = r.renders.slice(n0), d = st.bake.density;
  if (far.some(c => R1.some(o => o.transform && o.transform.tx === -c.x0 && o.transform.ty === -c.y0))) bad.push('a far chunk was baked');
  const view3 = E.world.children.find(k => k.label === 'l0-remaster').children.find(k => k.label === 'l0-chunks');
  for (const c of inV) { const q = R1.filter(o => o.transform && o.transform.tx === -c.x0 && o.transform.ty === -c.y0);
    if (q.length !== c.zones.length || q.some((o, i) => o.container !== src(E, c.zones[i]) || o.target !== q[0].target || o.clear !== (i === 0))) { bad.push(c.key + ' renders ' + q.length + ' for ' + c.zones.length + ' zones'); continue; }
    const t = q[0].target; if (!t || !t.o || t.o.width !== c.x1 - c.x0 || t.o.height !== c.y1 - c.y0 || Math.abs(t.o.resolution - d) > 1e-3 || t.o.antialias !== false) bad.push(c.key + ' target');
    const g = view3.children.find(k => k.ops && k.ops.some(op => op.tex === t));
    if (!g || g.ops.length !== 1 || g.ops[0].x !== c.x0 || g.ops[0].y !== c.y0 || g.ops[0].w !== c.x1 - c.x0 || g.ops[0].h !== c.y1 - c.y0) bad.push(c.key + ' quad'); }
  const first = new Map(R1.map(o => [o.transform.tx + ',' + o.transform.ty, o.target])), n1 = r.renders.length; E.L.dev.decals(false); E.frame(1, at);
  const R2 = r.renders.slice(n1); let rebaked = 0; for (const c of inV) { const q = R2.find(o => o.transform.tx === -c.x0 && o.transform.ty === -c.y0); if (q && q.target === first.get(-c.x0 + ',' + -c.y0)) rebaked++; }
  E.L.dev.decals(true); E.frame(1, at);
  if (rebaked !== inV.length) bad.push(`toggle re-baked ${rebaked} / ${inV.length} in place`);
  let maxRes = 0; for (let cy = 4; cy < G.FBH; cy += 9) for (let cx = 4; cx < G.FBW; cx += 11) { E.frame(2, [(cx + .5) * T, (cy + .5) * T]); maxRes = Math.max(maxRes, E.L.stats().bake.resident); }
  const cap = E.L.stats().bake.cache, sv = E.L.stats().bake; if (sv.resident > cap) bad.push('resident ' + sv.resident + ' > cap ' + cap);
  E.L.dev.remaster(false); E.frame(2, at); const offShown = E.L.dev.chunks().filter(c => c.shown).length; E.L.dev.remaster(true);
  if (offShown) bad.push('remaster off still shows ' + offShown + ' chunks');
  const D = runRemaster({ app: null }), dv = D.L.stats().bake.mode, dsrc = D.L.dev.source('room:01'); D.frame(1, at);
  if (dv !== 'direct' || !dsrc.parent || dsrc.parent.label !== 'l0-remaster' || dsrc.visible !== true) bad.push('direct fallback ' + dv);
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `${all.length} chunks (up to ${Math.max(...all.map(c => c.zones.length))} zones each) cover all ${cover} floor + wall cells of ${zs.length} zones; YELLOW HALL centre: ${inV.length} in view baked (density ${d}), ${far.length} far ones untouched; toggle re-baked ${rebaked} in place; travel over the map: resident max ${maxRes}, now ${sv.resident} (cap ${cap}), ${sv.evictions} evictions; off: none shown; no renderer: direct` };
});

run('R13 the surface receiver: each room exposes its floor and its papered wall runs (every face cell onto the room\'s floor belongs to exactly one run); a stamped mark is drawn in surface coordinates and clipped to its surface (a wall mark only on that run\'s band polygons), only the chunks it touches re-bake, the caps hold (oldest first), lifetimes expire, AVOID kinds are refused, the DEV proof only with ?dev3b, a caller\'s own image is accepted, and the marks survive a rebuild', () => {
  const E = runRemaster({ search: '?dev3b=1' }), S = E.L.surfaces, bad = [], yh = G.Oc.find(q => q.code === '01');
  const list = S.list('room:01'), walls = list.filter(s => s.kind === 'wall'), floor = list.find(s => s.kind === 'floor');
  if (!floor || !walls.length) return { ok: false, note: 'no surfaces' };
  let faces = 0; for (let cy = yh.y - 1; cy <= yh.y + yh.h; cy++) for (let cx = yh.x - 1; cx <= yh.x + yh.w; cx++) { if (G.zc(cx, cy) || !G.Hc(cx, cy)) continue;
    for (const [side, [dx, dy]] of Object.entries(SIDES)) { const fx = cx + dx, fy = cy + dy; if (!(inRect(yh, fx, fy) && G.zc(fx, fy))) continue; faces++;
      const mid = side === 'S' || side === 'N' ? [(cx + .5) * T, side === 'S' ? (cy + 1) * T - 5 : cy * T + 5] : [side === 'E' ? (cx + 1) * T - 5 : cx * T + 5, (cy + .5) * T];
      const hits = walls.filter(w => w.side === side && (() => { const ux = mid[0] - w.origin[0], uy = mid[1] - w.origin[1], u = ux * w.u[0] + uy * w.u[1], v = ux * w.up[0] + uy * w.up[1]; return u >= 0 && u <= w.length && v >= 0 && v <= w.band; })());
      if (hits.length !== 1) bad.push(`face ${side} of ${cx},${cy} in ${hits.length} runs`); } }
  const w0 = walls.find(w => w.length >= 192) || walls[0], r = E.app.renderer;
  const at = [w0.origin[0] + w0.u[0] * 48 - w0.up[0] * 30, w0.origin[1] + w0.u[1] * 48 - w0.up[1] * 30], hit = S.at(at[0], at[1], 40);
  if (!hit || hit.id !== w0.id || Math.abs(hit.u - 48) > 1e-6) bad.push('at() in front of a face: ' + JSON.stringify(hit));
  const mid = [(yh.x + yh.w / 2) * T, (yh.y + yh.h / 2) * T], fh = S.at(mid[0], mid[1], 0); if (!fh || fh.kind !== 'floor') bad.push('at() mid-room: ' + JSON.stringify(fh));
  E.frame(1, at);
  const s1 = E.L.dev.source('room:01'), dyn = s1.children.find(c => c.label === 'decals-dynamic'), wallsG = s1.children.find(c => c.label === 'walls:legacy');
  const n0 = r.renders.length, id1 = S.stamp(w0.id, { kind: 'proof', u: 48, v: 12 }); E.frame(1, at); const rebakes = r.renders.slice(n0), rebaked = new Set(rebakes.map(o => o.transform.tx + ',' + o.transform.ty)).size;
  const bands = wallsG.ops.filter(op => op.type === 'poly').map(op => op.p), mine = dyn.ops.filter(op => op.style && op.style.texture);
  const inConvex = (poly, x, y) => { let sg = 0; for (let i = 0; i < poly.length; i += 2) { const ax = poly[i], ay = poly[i + 1], bx = poly[(i + 2) % poly.length], by = poly[(i + 3) % poly.length], c = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (Math.abs(c) < 1e-6) continue; const s2 = Math.sign(c); if (sg && s2 !== sg) return false; sg = s2; } return true; };
  const within = p => bands.some(b => { for (let i = 0; i < p.length; i += 2) if (!inConvex(b, p[i], p[i + 1])) return false; return true; });
  if (!id1 || !mine.length || mine.some(op => op.type !== 'poly' || !within(op.p))) bad.push('proof stamp not clipped to band polygons');
  if (E.L.stats().disabled) bad.push('disabled: ' + E.L.stats().disabled); if (rebaked < 1 || rebaked > 4) bad.push('re-baked ' + rebaked + ' chunks');
  if (S.stamp(floor.id, { kind: 'paper', u: mid[0], v: mid[1] }) !== null) bad.push('an AVOID kind was accepted');
  const P = runRemaster(); if (P.L.surfaces.stamp(floor.id, { kind: 'proof', u: mid[0], v: mid[1] }) !== null) bad.push('proof accepted without ?dev3b');
  for (let i = 0; i < 20; i++) S.stamp(w0.id, { kind: 'stain', u: 20 + i * 3, v: 10, scale: .3 }); const onW = S.count();
  if (onW !== E.L.surfaces.caps().perSurface) bad.push('per-surface cap: ' + onW);
  S.clear(); const tt = S.stamp(floor.id, { kind: 'damp', u: mid[0], v: mid[1], ttl: 1 }); const img = { width: 36, height: 36, getContext: () => ({}) };
  const ext = S.stamp(floor.id, { image: img, w: 30, h: 30, u: mid[0] + 100, v: mid[1] }); E.L.dev.rebuild(); const afterRebuild = S.count();
  const t0 = Date.now(); while (Date.now() - t0 < 450) { } E.frame(1, at); const afterTtl = S.count();
  if (!tt || !ext || afterRebuild !== 2 || afterTtl !== 1) bad.push(`ttl ${!!tt} ext ${!!ext} rebuild kept ${afterRebuild} ttl left ${afterTtl}`);
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join('; ') : `YELLOW HALL: floor + ${walls.length} wall runs, ${faces} face cells each in exactly one run; a proof mark on a wall: ${mine.length} clipped fill(s), ${rebaked} chunk(s) re-baked; caps ${JSON.stringify(E.L.surfaces.caps())}; AVOID refused, proof DEV-only, an external image accepted, marks survive a rebuild, a lifetime expires` };
});

run('R14 each wall face once: every face of a sight-blocking wall cell that looks onto remastered floor is drawn exactly once, by the zone that owns that floor, and no other face is drawn (pits are not walls: no face looks into a pit); the QA2 slice\'s temporary doorway strips are gone', () => {
  const E = base(), { own } = ownership(E), drawn = new Map(), bad = [];
  for (const z of zonesOf(E)) for (const op of layer(E, z.id, 'walls:legacy').ops) { if (op.type !== 'poly' || op.p.length !== 8) continue;      // the face quads (inner-corner triangles aside)
    const xs = op.p.filter((v, i) => i % 2 === 0), ys = op.p.filter((v, i) => i % 2 === 1), cx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2 / T), cy = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2 / T), k = cx + ',' + cy + ':' + sideOf(op.style.matrix);
    if (drawn.has(k)) bad.push('face ' + k + ' drawn by ' + drawn.get(k) + ' and ' + z.id); drawn.set(k, z.id); }
  let want = 0;
  for (let cy = 0; cy < G.FBH; cy++) for (let cx = 0; cx < G.FBW; cx++) { if (G.zc(cx, cy) || !G.Hc(cx, cy)) continue;
    for (const [side, [dx, dy]] of Object.entries(SIDES)) { const f = own.get((cx + dx) + ',' + (cy + dy)), k = cx + ',' + cy + ':' + side;
      if (f) { want++; if (drawn.get(k) !== f) bad.push('face ' + k + ' by ' + drawn.get(k) + ', not ' + f); } } }
  for (const [k, z] of drawn) { const [c, side] = k.split(':'), [cx, cy] = c.split(',').map(Number), [dx, dy] = SIDES[side]; if (own.get((cx + dx) + ',' + (cy + dy)) !== z) bad.push('face ' + k + ' looks onto ' + (own.get((cx + dx) + ',' + (cy + dy)) || 'no floor of ' + z)); }
  const strips = zonesOf(E).filter(z => graphicsIn(src(E, z.id)).some(g => /threshold/.test(g.label)));
  if (strips.length) bad.push('doorway strips in ' + strips.map(z => z.id).join(','));
  const pitFaces = [...drawn.keys()].filter(k => { const [c, side] = k.split(':'), [cx, cy] = c.split(',').map(Number), [dx, dy] = SIDES[side]; return !G.zc(cx + dx, cy + dy); });
  if (pitFaces.length) bad.push('faces into non-floor ' + pitFaces.slice(0, 3).join(','));
  return { ok: !bad.length && drawn.size === want, note: bad.length ? bad.slice(0, 5).join('; ') : `${want} faces look onto remastered floor; each drawn once by its floor's zone; no doorway strips` };
});
run('R15 doorways run on unbroken: where two zones\' floors meet, both sides use the same carpet texture with the same world mapping; the floor colour times the wear map, sampled as the GPU does (linear, repeating) half a pixel either side of the edge, agrees within 3 %; the pile overlay\'s strength agrees across the edge; no floor mark is cut off at a zone\'s edge', () => {
  const E = base(), { own } = ownership(E), bad = [], styleAt = new Map(); let pairs = 0, worst = 0, carpetPairs = 0, ovPairs = 0, ovWorst = 0;
  for (const z of zonesOf(E)) for (const op of layer(E, z.id, 'floor').ops.filter(op => op.style && op.style.texture)) for (let cy = op.y / T; cy < (op.y + op.h) / T; cy++) for (let cx = op.x / T; cx < (op.x + op.w) / T; cx++) styleAt.set(cx + ',' + cy, op.style);
  const Z = new Map(zonesOf(E).map(z => [z.id, E.L.dev.zone(z.id)]));
  const sample = (zid, x, y) => {                          // the wear map as the GPU samples it: texel centres, bilinear, repeat
    const z = Z.get(zid), img = z.macroCanvas && z.macroCanvas.__img, cell = z.macroCell, [ox, oy] = z.macroOrigin || [z.o.x * T, z.o.y * T]; if (!img) return null;
    const W = img.width, H2 = img.height, tx = (x - ox) / cell - .5, ty = (y - oy) / cell - .5, i0 = Math.floor(tx), j0 = Math.floor(ty), fx = tx - i0, fy = ty - j0;
    const at = (i, j) => { const ii = ((i % W) + W) % W, jj = ((j % H2) + H2) % H2, p = (jj * W + ii) * 4; return [img.data[p], img.data[p + 1], img.data[p + 2]]; };
    const A = at(i0, j0), B = at(i0 + 1, j0), C = at(i0, j0 + 1), D = at(i0 + 1, j0 + 1);
    return [0, 1, 2].map(c => ((A[c] * (1 - fx) + B[c] * fx) * (1 - fy) + (C[c] * (1 - fx) + D[c] * fx) * fy) / 255 * z.floorColor[c]); };
  const ovAt = (zid, x, y) => { const z = Z.get(zid); if (!z.overlay) return 0; const cell = z.macroCell, mw = Math.ceil(z.o.w * T / cell), i = Math.floor((x - z.o.x * T) / cell), j = Math.floor((y - z.o.y * T) / cell); return Math.round(z.overlay.a[j * mw + i] * 24) / 24; };
  const interior = (cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!G.zc(cx + dx, cy + dy)) return false; return true; };
  for (const [k, za] of own) { const [ax, ay] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const bx = ax + dx, by = ay + dy, zb = own.get(bx + ',' + by); if (!zb || zb === za) continue; pairs++;
      const sa = styleAt.get(k), sb = styleAt.get(bx + ',' + by), ka = Z.get(za).floor, kb = Z.get(zb).floor, edge = dx ? bx * T : by * T;
      for (let t = 6; t < T; t += 12) { const pa = dx ? [edge - 6, ay * T + t] : [ax * T + t, edge - 6], pb = dx ? [edge + 6, ay * T + t] : [ax * T + t, edge + 6];   // the overlay: the texels either side
        if (Z.get(za).overlay || Z.get(zb).overlay) { ovPairs++; const d = Math.abs(ovAt(za, ...pa) - ovAt(zb, ...pb)); if (d > ovWorst) ovWorst = d; if (d > .08) { bad.push(`overlay ${za} | ${zb} at ${k}: ${ovAt(za, ...pa)} vs ${ovAt(zb, ...pb)}`); break; } } }
      if (ka !== 'carpet' || kb !== 'carpet') continue; carpetPairs++;
      const ma = sa.matrix, mb = sb.matrix; if (sa.texture !== sb.texture || ['a', 'b', 'c', 'd', 'tx', 'ty'].some(q => Math.abs(ma[q] - mb[q]) > 1e-9)) bad.push(`carpet mapping differs at ${k} (${za} | ${zb})`);
      if (!interior(ax, ay) || !interior(bx, by)) continue;
      for (let t = 3; t < T; t += 6) { const pa = dx ? [edge - .5, ay * T + t] : [ax * T + t, edge - .5], pb = dx ? [edge + .5, ay * T + t] : [ax * T + t, edge + .5];
        const A = sample(za, ...pa), B = sample(zb, ...pb); if (!A || !B) { bad.push('no map at ' + k); break; }
        let fail = false; for (let c = 0; c < 3; c++) { const rel = Math.abs(A[c] - B[c]) / Math.max(.05, (A[c] + B[c]) / 2); if (rel > worst) worst = rel; if (rel > .03) fail = true; }
        if (fail) { bad.push(`${za} | ${zb} at ${k}+${t}: ${A.map(v => v.toFixed(3))} vs ${B.map(v => v.toFixed(3))}`); break; } } } }
  let marks = 0;
  for (const z of zonesOf(E)) for (const g of graphicsIn(src(E, z.id)).filter(g => g.label === 'decals' || g.label === 'decals-mul')) for (const op of g.ops.filter(op => op.style && op.style.texture)) {
    marks++; const m = op.style.matrix, s = op.style.texture.source, quad = [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h], [s.w / 2, 0], [s.w, s.h / 2], [s.w / 2, s.h], [0, s.h / 2]].map(([u, v]) => [m.a * u + m.c * v + m.tx, m.b * u + m.d * v + m.ty]);
    for (const [x, y] of quad) { const [cx, cy] = cellOf(x, y), o = own.get(cx + ',' + cy); if (o && o !== z.id) { bad.push(`${z.id} mark reaches ${o} at ${cx},${cy}`); break; } } }
  return { ok: !bad.length && pairs > 0, note: bad.length ? bad.slice(0, 5).join('; ') : `${pairs} doorway cell pairs (${carpetPairs} carpet to carpet): one texture, one mapping; colour across the edge (GPU-sampled) within ${(worst * 100).toFixed(2)} %; overlay strength within ${ovWorst.toFixed(3)} over ${ovPairs} samples; ${marks} floor mark fills, none reaching another zone's floor` };
});
run('R16 the special rooms keep the game\'s truth: LONG ROOM\'s ten pits (the game\'s pit cells, not walls) are drawn exactly on their cells over the slab, its floor concrete; DAMP ROOMS\' floor tile; every other floor the one carpet; the deep / coarse pile only in DEEP CARPET, RED ROOMS and the corridors that lead to RED ROOMS; ARCH GALLERY\'s two archways found in its partitions, their jambs drawn as reveals, nothing overhead; a carpet edge on both sides of each carpet / hard-floor doorway; every one of the 18 props drawn; no floor left to the legacy carpet', () => {
  const E = base(), bad = [], zs = zonesOf(E), Z = id => E.L.dev.zone(id), notes = [];
  if (!V.slice.every(id => zs.some(z => z.id === id || E.L.dev.zone(z.id).base === id))) bad.push('not every slice zone built');
  const pits = Z('room:06').pits.map(p => p.join(',')).sort(), mc = G.Mc.map(p => p.x + ',' + p.y).sort();
  if (JSON.stringify(pits) !== JSON.stringify(mc)) bad.push('pits ' + pits.length + ' vs ' + mc.length);
  const pg = layer(E, 'room:06', 'pits'); for (const p of G.Mc) { const x = p.x * T, y = p.y * T; if (G.zc(p.x, p.y) || G.Hc(p.x, p.y)) bad.push('pit ' + p.x + ',' + p.y + ' is floor or wall');
    if (!pg.ops.some(op => op.op === 'texture' && op.x === x && op.y === y && op.w === T && op.h === T) || !pg.ops.some(op => op.op === 'fill' && op.x === x && op.y === y && op.w === T && op.h === T)) bad.push('pit ' + p.x + ',' + p.y + ' not drawn exactly'); }
  const tex = id => { const op = layer(E, id, 'floor').ops.find(op => op.style && op.style.texture); return op && op.style.texture; }, carpetT = tex('room:01');
  for (const z of zs) { const want = Z(z.id).floor, t = tex(z.id); if ((want === 'carpet') !== (t === carpetT)) bad.push(z.id + ' floor texture'); }
  if (tex('room:06') === tex('room:08')) bad.push('concrete and tile share a texture');
  const ovZones = zs.filter(z => Z(z.id).overlay && layer(E, z.id, 'floor-overlay').ops.length).map(z => z.id + ':' + Z(z.id).overlay.kind);
  for (const s of ovZones) { const [id, k] = s.split(':').length > 2 ? [s.slice(0, s.lastIndexOf(':')), s.slice(s.lastIndexOf(':') + 1)] : s.split(':');
    const ok = (id === 'room:12' && k === 'deep') || (id === 'room:09' && k === 'coarse') || (id.startsWith('zone:corridors/') && k === 'coarse');
    if (!ok) bad.push('overlay in ' + s); }
  if (!ovZones.some(s => s.startsWith('room:12')) || !ovZones.some(s => s.startsWith('room:09'))) bad.push('missing room overlay');
  for (const s of ovZones.filter(s => s.startsWith('zone:'))) { const id = s.slice(0, s.lastIndexOf(':')), o = Z(id).o, red = G.Oc.find(q => q.code === '09');     // a corridor with the coarse pile touches RED ROOMS
    let touches = false; for (let cy = o.y; cy < o.y + o.h; cy++) for (let cx = o.x; cx < o.x + o.w; cx++) for (const [dx, dy] of Object.values(SIDES)) if (inRect(red, cx + dx, cy + dy) && G.zc(cx + dx, cy + dy)) touches = true;
    if (!touches) bad.push(id + ' has the coarse pile but does not lead to RED ROOMS'); }
  const ar = Z('room:10').arches.map(a => (a.vert ? 'x' : 'y') + a.a + ':' + a.b0 + '-' + a.b1).sort().join(' ');
  if (ar !== 'x79:34-37 x86:36-37') bad.push('archways ' + ar);
  const wl = layer(E, 'room:10', 'walls:legacy'), revealFills = wl.ops.filter(op => op.type === 'poly' && op.p.length === 8 && op.style.texture !== wl.ops.find(o2 => o2.type === 'poly').style.texture);
  if (revealFills.length !== 4) bad.push('reveal faces ' + revealFills.length);
  if (!layer(E, 'room:10', 'soffit') || !layer(E, 'room:10', 'soffit').ops.length) bad.push('no soffit');
  const ceil = E.world.children.find(c => c.label === 'l0-remaster-ceiling'); if (graphicsIn(ceil).some(g => /arch|soffit|struct/.test(g.label))) bad.push('something overhead');
  for (const op of layer(E, 'room:10', 'structures').ops) { const [cx, cy] = cellOf(op.x + op.w / 2, op.y + op.h / 2); if (G.zc(cx, cy) || op.x < cx * T || op.x + op.w > (cx + 1) * T + 1e-6 || op.y < cy * T || op.y + op.h > (cy + 1) * T + 1e-6) { bad.push('pilaster outside its jamb at ' + cx + ',' + cy); break; } }
  const edges = zs.filter(z => layer(E, z.id, 'floor-edges') && layer(E, z.id, 'floor-edges').ops.length).map(z => z.id);
  if (!edges.includes('room:06') || !edges.includes('room:08') || !edges.some(id => id.startsWith('zone:'))) bad.push('carpet edges ' + edges.join(','));
  const drawn = zs.flatMap(z => z.props); if (drawn.length !== WORLD.PROPS.length || new Set(drawn).size !== WORLD.PROPS.length) bad.push('props drawn ' + drawn.length);
  if (E.L.stats().legacyFloorRects !== 0) bad.push('legacy floor rects ' + E.L.stats().legacyFloorRects);
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 6).join('; ') : `pits ${pits.length} = the game's; floors: concrete, tile and the one carpet by zone; overlays ${ovZones.join(' ')}; archways ${ar} (4 reveal faces, a soffit, pilasters in their jambs, nothing overhead); carpet edges in ${edges.length} zones; ${drawn.length} props drawn; legacy floor none` };
});

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name.split(' ')[0]).join(', ') : ''));
process.exit(pass === results.length ? 0 : 1);
