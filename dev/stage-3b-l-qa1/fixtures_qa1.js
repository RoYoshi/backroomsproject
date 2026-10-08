/* Stage 3B-L QA1 - Level 0's ceiling fixtures: one shared truth, and the density before / after (development only; never
 * served).  Node only, no browser (the page side is checked by fixtures_page_qa1.js).
 *
 *   node dev/stage-3b-l-qa1/fixtures_qa1.js [--game PATH] [--parent-ref b9f3a9b] [--out FILE.json] [--map FILE.txt]
 *
 *   T1 one source: the placement exists once, in world.js (W.lamps).  The game bundle, sim.js, dev/sim_head.js and
 *      dev/sim_geo.js all call it, and none of them still carries its own copy of the old grid loop
 *   T2 the client's lamp list (the bundle's own map code run in a VM, as the page runs it) and the server's (the adapter that
 *      sim.js hands the AI engine, captured from a real createSim) are the same fixtures in the same order, and both are
 *      W.lamps on the same map; two runs give the same list (deterministic)
 *   T3 the server AI knows every fixture: its lamp field (what light-fearing monsters avoid, the light level it hunts by) is
 *      the full .43 at every fixture, and anywhere it reads lamp light a fixture of the list is within 380 px in clear line
 *   T4 the original grid is kept: indices 0 .. n-1 are the parent's fixtures in the parent's order (the dim tubes are the
 *      same: every 13th), except PILLAR HALL's nine, each moved exactly one cell off the pillar it sat inside
 *   T5 the BLACKOUT ZONE stays unlit: no fixture in it and none within 7.5 cells (720 px, past every light's reach, visual
 *      and gameplay) of it
 *   T6 placement: every fixture over open floor, none on a pillar, in a doorway or a hole in a wall, none closer than 2.2
 *      cells to another
 *   T7 substantially denser: counts by zone before / after, corridors lit, the working floor's coverage (nearest fixture in
 *      clear line) and the AI lamp field's coverage before / after */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PREF = opt('parent-ref') || 'b9f3a9b934f40e35d51596f593eae810d077f194', OUT = opt('out'), MAP = opt('map');
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const T = 96, read = f => fs.readFileSync(path.join(GAME, f), 'utf8');
const OLD_LOOP = 'Oc.forEach((e,t)=>{if(t!==6)for(let n=e.x+2;n<e.x+e.w-1;n+=5)for(let r=e.y+2;r<e.y+e.h-1;r+=5)kc[r*FBW+n]&&Fc.push(';
const W = require(path.join(GAME, 'world.js'));
/* the bundle's own level code (rooms, floor mask, pillars, lamps, ray query) in a VM, as the page runs it */
function bundleTables(src, world) {
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw Error('bundle marker missing: ' + a); return src.slice(i, j); };
  const ctx = vm.createContext({ window: { WORLD: world }, Math, Uint8Array, Set, Object, Array, Number, console });
  vm.runInContext(cut('var FBW=96', 'var Wc={kind:') + ';\nthis.__x={FBW,FBH,kc,zc,Hc,Uc,Bc,Fc,Pc,Mc,Oc};', ctx);
  return ctx.__x;
}
const same = (a, b) => a.length === b.length && a.every((l, i) => l.x === b[i].x && l.y === b[i].y);
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
(async () => {
  const R = { game: GAME, parentRef: PREF };
  /* T1 */
  const files = { bundle: 'assets/index-DKbV5Nv9.js', sim: 'sim.js', simHead: 'dev/sim_head.js', simGeo: 'dev/sim_geo.js' };
  const src = {}; for (const [k, f] of Object.entries(files)) src[k] = read(f);
  const calls = Object.fromEntries(Object.entries(src).map(([k, s]) => [k, { calls: (s.match(/var Fc=(window\.)?WORLD\.lamps\(/g) || []).length, oldLoop: s.includes(OLD_LOOP) }]));
  const worldDefs = (read('world.js').match(/W\.lamps = function/g) || []).length;
  check('T1 one source: world.js W.lamps is the only placement; the bundle, sim.js, dev/sim_head.js and dev/sim_geo.js all call it, none keeps the old grid loop',
    worldDefs === 1 && Object.values(calls).every(c => c.calls === 1 && !c.oldLoop), JSON.stringify(calls));
  R.sources = calls;
  /* T2: client (bundle in a VM) vs server (the adapter a real createSim hands the AI engine) vs W.lamps itself */
  const g = bundleTables(src.bundle, W), fl = (n, r) => n >= 0 && r >= 0 && n < g.FBW && r < g.FBH && !!g.kc[r * g.FBW + n];
  const client = g.Fc, direct = W.lamps(g.Oc, fl, g.Pc, g.FBW, g.FBH), again = W.lamps(g.Oc, fl, g.Pc, g.FBW, g.FBH);
  const AI = require(path.join(GAME, 'ai.js')), create0 = AI.create; let cap = null, eng = null;
  AI.create = o => { cap = o.adapter; eng = create0(o); return eng; };
  require(path.join(GAME, 'sim.js'))({ seed: 7 }); AI.create = create0;
  const server = cap ? cap.lamps : [];
  check('T2 the client\'s lamp list (the bundle\'s own code) and the server\'s (sim.js -> the AI engine\'s adapter) are the same fixtures in the same order, both W.lamps on the same map; deterministic',
    !!cap && same(client, server) && same(client, direct) && same(direct, again) && client.length > 0,
    `client ${client.length}, server ${server.length}, W.lamps ${direct.length}; identical ${same(client, server) && same(client, direct)}; a second run identical ${same(direct, again)}`);
  /* T3: the AI's lamp field */
  const geo = eng && eng.geo; let atLamp = [], orphan = 0, litCells = 0;
  if (geo) {
    for (const L of server) atLamp.push(geo.lamp[geo.cellAt(L.x, L.y)]);
    for (let i = 0; i < geo.N; i++) { if (!(geo.lamp[i] > 0)) continue; litCells++; const x = geo.cx(i), y = geo.cy(i);
      if (!server.some(L => { const d = Math.hypot(x - L.x, y - L.y); return d < 380 && g.Uc(L.x, L.y, Math.atan2(y - L.y, x - L.x), d + 1) >= d - .5; })) orphan++; }
  }
  check('T3 the server AI knows every fixture: its lamp field is the full .43 at each one, and every cell it reads lamp light in has a fixture of the list within 380 px in clear line',
    !!geo && atLamp.length === server.length && atLamp.every(v => Math.abs(v - .43) < 1e-6) && orphan === 0,
    geo ? `field at the ${atLamp.length} fixtures: min ${Math.min(...atLamp).toFixed(3)} max ${Math.max(...atLamp).toFixed(3)}; ${litCells} lit 48 px cells, ${orphan} without a fixture in reach` : 'no engine captured');
  /* T4: the parent's list (its own bundle, from git) */
  let parent = null;
  try { const ps = execSync(`git -C ${JSON.stringify(GAME)} show ${PREF}:assets/index-DKbV5Nv9.js`, { maxBuffer: 64 << 20 }).toString(); parent = bundleTables(ps, W).Fc; } catch (e) { console.log('parent bundle not readable: ' + e.message.split('\n')[0]); }
  const pillarHall = g.Oc.findIndex(o => o.name === 'PILLAR HALL'), inPillar = (L, P) => P.some(p => L.x > p.x && L.x < p.x + p.w && L.y > p.y && L.y < p.y + p.h);
  const moved = [], changedElse = [];
  if (parent) parent.forEach((L, i) => { const N = client[i]; if (!N) { changedElse.push(i); return; } if (N.x === L.x && N.y === L.y) return;
    if (inPillar(L, g.Pc) && !inPillar(N, g.Pc) && Math.abs(N.x - L.x) + Math.abs(N.y - L.y) === T) moved.push(i); else changedElse.push(i); });
  check('T4 the original grid is kept: the first fixtures are the parent\'s, in its order (the dim every-13th tubes unchanged), except PILLAR HALL\'s, each moved one cell off the pillar it sat inside',
    !!parent && changedElse.length === 0 && moved.length === parent.filter(L => inPillar(L, g.Pc)).length,
    parent ? `parent ${parent.length} fixtures: ${parent.length - moved.length} unchanged, ${moved.length} moved off pillars (${moved.join(',')}), other changes ${changedElse.length}` : 'no parent');
  /* T5: BLACKOUT ZONE */
  const bo = g.Oc[6], boDist = L => { const x = L.x / T, y = L.y / T; return Math.hypot(Math.max(bo.x - x, 0, x - (bo.x + bo.w)), Math.max(bo.y - y, 0, y - (bo.y + bo.h))) * T; };
  const nearBo = client.filter(L => boDist(L) < 720), minBo = Math.min(...client.map(boDist));
  check('T5 the BLACKOUT ZONE stays unlit: no fixture in it, none within 720 px of it (past every light\'s reach)', bo && bo.name === 'BLACKOUT ZONE' && !nearBo.length,
    `nearest fixture ${minBo.toFixed(0)} px from its edge (parent: ${parent ? Math.min(...parent.map(boDist)).toFixed(0) : '-'} px)`);
  /* T6: placement */
  const cellOf = L => [Math.floor(L.x / T), Math.floor(L.y / T)], bad = [];
  let md = 1e9; for (let i = 0; i < client.length; i++) for (let j = i + 1; j < client.length; j++) md = Math.min(md, Math.hypot(client[i].x - client[j].x, client[i].y - client[j].y));
  client.forEach((L, i) => { const [n, r] = cellOf(L); if (!fl(n, r)) bad.push(i + ' not floor'); if (inPillar(L, g.Pc)) bad.push(i + ' on a pillar');
    if (i >= (parent ? parent.length : 0) && ((!fl(n - 1, r) && !fl(n + 1, r)) || (!fl(n, r - 1) && !fl(n, r + 1)))) bad.push(i + ' in a doorway'); });
  check('T6 every fixture over open floor, none on a pillar, no added one in a doorway or a wall hole, none closer than 2.2 cells (211 px) to another', !bad.length && md >= 2.2 * T - 1e-6,
    `closest pair ${md.toFixed(0)} px${bad.length ? '; ' + bad.slice(0, 6).join(', ') : ''}`);
  /* T7: density and coverage */
  const zoneOf = L => { const [n, r] = cellOf(L), o = g.Oc.find(o => n >= o.x && n < o.x + o.w && r >= o.y && r < o.y + o.h); return o ? o.name : 'CORRIDORS'; };
  const byZone = list => { const m = {}; for (const z of [...g.Oc.map(o => o.name), 'CORRIDORS']) m[z] = 0; for (const L of list || []) m[zoneOf(L)]++; return m; };
  const before = byZone(parent), after = byZone(client);
  const sees = (L, x, y) => { const d = Math.hypot(x - L.x, y - L.y); return d < 1 || g.Uc(L.x, L.y, Math.atan2(y - L.y, x - L.x), d + 1) >= d - .5; };
  const cover = list => { const ds = []; for (let r = 0; r < g.FBH; r++) for (let n = 0; n < g.FBW; n++) { if (!fl(n, r)) continue; const o = g.Oc.findIndex(o => n >= o.x && n < o.x + o.w && r >= o.y && r < o.y + o.h); if (o === 6) continue;
    const x = (n + .5) * T, y = (r + .5) * T; let b = 1e9; for (const L of list) { const d = Math.hypot(L.x - x, L.y - y); if (d < b && d < 900 && sees(L, x, y)) b = d; } ds.push(b); }
    const sh = d => +(ds.filter(v => v < d).length / ds.length * 100).toFixed(1); return { cells: ds.length, within240: sh(240), within380: sh(380), within480: sh(480), beyond600: +(100 - sh(600)).toFixed(1) }; };
  const covB = parent ? cover(parent) : null, covA = cover(client);
  const field = list => { let n = 0, lit = 0, sum = 0; for (let i = 0; i < geo.N; i++) { if (!(geo.cls[i] === 1)) continue; const x = geo.cx(i), y = geo.cy(i); n++; let b = 0;
    for (const L of list) { const d = Math.hypot(x - L.x, y - L.y); if (d >= 380) continue; if (g.Uc(L.x, L.y, Math.atan2(y - L.y, x - L.x), d + 1) >= d - .5) b = Math.max(b, (1 - sm(40, 380, d)) * .43); }
    if (b > 0) lit++; sum += b; } return { walkableCells: n, lit: +(lit / n * 100).toFixed(1), meanField: +(sum / n).toFixed(3) }; };
  const fB = geo && parent ? field(parent) : null, fA = geo ? field(client) : null;
  const realA = geo ? (() => { let n = 0, lit = 0; for (let i = 0; i < geo.N; i++) { if (geo.cls[i] !== 1) continue; n++; if (geo.lamp[i] > 0) lit++; } return +(lit / n * 100).toFixed(1); })() : null;
  R.counts = { before, after, total: { before: parent ? parent.length : null, after: client.length } };
  R.coverage = { before: covB, after: covA }; R.aiField = { before: fB, after: fA, engineLitShare: realA };
  const corr = after.CORRIDORS, dens = parent ? client.length / parent.length : 0;
  check('T7 substantially denser: fixtures before / after by zone, the corridors lit, the working floor\'s coverage up; the AI lamp field follows the same fixtures',
    dens >= 1.6 && corr >= 10 && after['BLACKOUT ZONE'] === 0 && covB && covA.within380 > covB.within380 + 10 && fA && Math.abs(fA.lit - realA) < .05,
    `total ${parent ? parent.length : '-'} -> ${client.length} (x${dens.toFixed(2)}); ` + Object.keys(after).map(z => `${z} ${before[z]}->${after[z]}`).join(', ') +
    `; working floor with a fixture in clear line within 240 / 380 / 480 px: ${covB && covB.within240}/${covB && covB.within380}/${covB && covB.within480} % -> ${covA.within240}/${covA.within380}/${covA.within480} %` +
    `; AI lamp field over walkable cells: lit ${fB && fB.lit} % -> ${fA && fA.lit} % (the engine's own: ${realA} %)`);
  if (MAP) { const set = new Map(client.map((L, i) => [cellOf(L).join(','), i])), lines = [];
    for (let r = 4; r < 66; r++) { let s = String(r).padStart(2) + ' '; for (let n = 0; n < g.FBW; n++) { const k = n + ',' + r; s += set.has(k) ? (set.get(k) < (parent ? parent.length : 0) ? 'O' : '+') : inPillar({ x: (n + .5) * T, y: (r + .5) * T }, g.Pc) ? 'P' : fl(n, r) ? '.' : '#'; } lines.push(s); }
    fs.writeFileSync(MAP, 'Level 0 ceiling fixtures (world.js W.lamps): O = the original grid (kept; PILLAR HALL\'s moved off its pillars), + = added, P = pillar, # = wall\n' + lines.join('\n') + '\n'); }
  R.lamps = client.map(L => [L.x, L.y]); R.results = results;
  const passed = results.filter(r => r.ok).length; console.log(`\n${passed}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
