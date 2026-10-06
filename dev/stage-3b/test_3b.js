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
  vm.runInContext(cut('var FBW=96', 'var Wc={kind:') + ';\nthis.__x={FBW,FBH,kc,zc,Hc,Fc,Pc,Mc,Ic,Oc};', ctx);
  return ctx.__x;
}
const G = makeGame();
const V = require(path.join(ROOT, 'assets/level0_visuals.js'));
const T = 96, cellOf = (x, y) => [Math.floor(x / T), Math.floor(y / T)];
const roomRect = id => { const r = V.room(id), o = G.Oc.find(q => q.code === r.code); return o; };
const inRect = (o, cx, cy) => cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h;

run('V01 identity: schema 1, asset visuals:level0, a revision, and the recorded content hash is the SHA-256 of the canonical data (Part 3A scheme)', () => {
  const d = V.definition, h = H.contentHash(d);
  return { ok: d.schemaVersion === 1 && d.assetId === 'visuals:level0' && typeof d.revision === 'string' && d.revision.length > 0 && d.contentHash === h && Object.isFrozen(d) && Object.isFrozen(V),
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
  const req = { rooms: ['code', 'name', 'surface'], profiles: ['carpet', 'wallpaper', 'fixtures', 'decor'], materials: ['family', 'base'], decor: ['room', 'kind', 'x', 'y'], fixtures: ['room', 'kind', 'x', 'y'] };
  const pre = { rooms: 'room:', profiles: 'profile:', materials: 'material:', decor: 'decor:', fixtures: 'fixture:' }, bad = [], all = new Set();
  for (const c of Object.keys(req)) { let prev = ''; for (const o of V[c]) {
    if (!o || typeof o.id !== 'string' || !o.id.startsWith(pre[c])) { bad.push(c + ' bad id ' + (o && o.id)); continue; }
    if (all.has(o.id)) bad.push('duplicate ' + o.id); all.add(o.id); if (prev && prev >= o.id) bad.push(c + ' order at ' + o.id); prev = o.id;
    for (const k of req[c]) if (o[k] === undefined) bad.push(o.id + ' missing ' + k); } }
  return { ok: !bad.length, note: bad.length ? bad.slice(0, 6).join('; ') : `${all.size} ids in ${Object.keys(req).length} collections` };
});
run('V05 the slice is the three representative rooms; each has a profile, every other room keeps the legacy look (no profile yet); a visual floor never contradicts its gameplay surface', () => {
  const want = ['room:01', 'room:04', 'room:07'], bad = [];
  if (JSON.stringify(V.slice) !== JSON.stringify(want)) bad.push('slice ' + V.slice.join(','));
  for (const r of V.rooms) { const p = r.profile && V.profile(r.profile);
    if (V.inSlice(r.id) !== !!r.profile) bad.push(r.id + ' profile/slice mismatch'); if (r.profile && !p) bad.push(r.id + ' unknown profile');
    if (p && r.surface !== 'carpet') bad.push(r.id + ': the 3B1 carpet material on a ' + r.surface + ' surface'); }
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : V.slice.map(id => V.room(id).name + ' -> ' + V.room(id).profile).join(', ') };
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

const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} passed` + (pass < results.length ? '\nFAILED: ' + results.filter(r => !r.ok).map(r => r.name.split(' ')[0]).join(', ') : ''));
process.exit(pass === results.length ? 0 : 1);
