/* THE WANDERER'S MOVEMENT IS LOCKED (Trial 3 R16i, the owner's clarification of October 22; Trial 3 is not owner-approved).  The
 * Skin-Stealer's refinement may change the Skin-Stealer's own movement and speed choices only: nothing a Wanderer does when it walks,
 * sprints, crouches, crawls, slides, vaults, tires or recovers, and nothing a Hound or a Smiler does.  These checks hold all of it to R8
 * (f378049, where this branch began):
 *   WL01 the shared movement constants by value - walk 172, a fresh sprint 285, crouch 92, crawl 54, winded 148, the stamina, slide and
 *        vault numbers, the surfaces, the noise and the body heights - in the server's copy and the page's, each equal to R8's
 *   WL02 every file that moves a Wanderer or sets how it moves, byte for byte R8's (the parts and the built files the page and the server
 *        run); nothing added among them
 *   WL03 the real move.js (the file the page runs), run headless: this tree's and R8's give the same ticks in every movement - walk,
 *        sprint, crouch, crawl, slide, vault, deep carpet, recovery from exhaustion - and the speeds they reach are the constants
 *   WL04 four starving Skin-Stealers among four players for 30 s: the shared constants are the same object with the same values
 *        after as before (nothing writes them), and no Skin-Stealer file reads or writes them
 *   WL05 the Hound and the Smiler: their species (speeds, caps, hooks) are R8's, and their code and the shared engine's are R8's byte for
 *        byte (ai.capture.js but for R15's one line, which only a Skin-Stealer reaches)
 *   WL06 the Skin-Stealer's own speeds, every one under a fresh Wanderer's sprint (285).  R18 (the owner's overtuned experiment) moved them
 *        into the owner's ranges: roam 140-175, prowl 195-215, investigation 225-240, press 255-265, its run (its most) at most 270; its
 *        stealth paces (creep, stalk) kept slow.  (R16i's form held R8's eight and a press of 230-245: R18-2 in DESIGN_DECISIONS.md)
 * R8's files are read with git (as PR25 reads 4518f93's); its hashes are also written here, so WL02 holds without git as well.  Line
 * endings are normalised before hashing (a checkout with CRLF is the same file). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), Module = require('module');
const { execFileSync } = require('child_process');
const S = []; const add = (name, fn) => S.push({ name, fn });
const ROOT = path.join(__dirname, '..', '..'), R8 = 'f378049a825e53eafc626a637b8c43397e4072f0';
const lf = b => Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
const sha = b => crypto.createHash('sha256').update(lf(b)).digest('hex');
const here = f => fs.readFileSync(path.join(ROOT, f));
function atR8(f) { try { return execFileSync('git', ['show', R8 + ':' + f], { cwd: ROOT, maxBuffer: 1 << 27, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } }
function lsR8(dir) { try { return execFileSync('git', ['ls-tree', '-r', '--name-only', R8, dir], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').filter(Boolean); } catch (e) { return null; } }
/* every file that moves a Wanderer or sets how it moves, with R8's hash: the S.P.A.C.E. framework (the shared constants, the page's
 * mover, the server's check of movement, the other Wanderers' bodies), the surfaces, the parts built into move.js, the server's step,
 * and the built files the page and the server run */
const LOCKED = [
  ['src/frameworks/space/README.md', 'ddc6d0cf8c0779ebde41f10cc0da498e2fd6a77edbced9765aaa9a60a9bf8e09'],
  ['src/frameworks/space/client/move.compose.js', 'aa2284bc4bc76fd3505b58d70649bac61b540d451adf5085a0a2c33328e9b32e'],
  ['src/frameworks/space/client/move.js', 'ecc02364737c19ca049d611e86f11aa0aead2aec2a819d52adfd47a13b1d589c'],
  ['src/frameworks/space/client/mp.peers.js', '4c8746d4e19a4359d3ebabab6e0f7b4e773a7194385d6df2ebefb30ee69f3eb2'],
  ['src/frameworks/space/server/movement.js', 'd540da20221b69d8617e3426229899c7027584729dcd07c455ffbfc06bc538ef'],
  ['src/frameworks/space/server/peers.js', '447bf167fafe850d6449b4f56f9082e090b2587b2ff12e5335c94f7f28b702dd'],
  ['src/frameworks/space/server/sim.movement.js', 'c7d461341c52b0fe02e6d99860152b95b1f55199965e6ba29bcf4a05fd08b0da'],
  ['src/frameworks/space/server/sim.players.js', '3cb99e22b3658aa4ee67cf4d8183827ba08ef46d5446c6bc0b0ee33154577bf4'],
  ['src/frameworks/space/shared/timing_policy.js', 'f1d1bb25cc6de53e7d4de2ac7103565e023fa10f8dfcfcdef26b22b155471069'],
  ['src/frameworks/space/shared/world.compose.js', '43ba9583830311c75c8b3a4deefeba96f719b03d911b1df335998801247f5832'],
  ['src/frameworks/space/shared/world.crawl.js', '04513053360e9a45f449e9943d779d5769bb11b747dc329ced2c85fc75c9a90b'],
  ['src/frameworks/space/shared/world.js', '3057fb1f4f0850b3e6a7e8f39187fad1e4bae9112b884ff1bd067e25a24a3ad2'],
  ['src/frameworks/space/shared/world.move.js', '56314359e151f64fec9891044cd6afee30ad8dc7e8c6e983241c3814a484fd63'],
  ['src/frameworks/lost/shared/world.surfaces.js', '41c8c2a9c5d0e1ae03e34a73d637d2ae3d9e91611bb9545da93d7fa25328a250'],
  ['src/frameworks/br-r/client/move.poses.js', 'ca54a280ee75f67abe0a25bbf51df7657e4cee4d1e72bfb612572516258c19af'],
  ['src/frameworks/spacious-audio/client/move.sound.js', '6d9ceeb31742daf61fd236388509f7f621b4c90359767dd6a0639f9b7ad11ab8'],
  ['src/core/server/sim.js', '43694e5268886f597a52f0de9d93b7eebf83b094262056e43421838c2780ed1c'],
  ['src/core/server/sim.step.js', '0c3a128a260147b0ffc483ad15321ce30d5b3d71a6b7ce6f313662943c8004e1'],
  ['server.js', '24bae02d76affc25feca161b232780465cf64624e5f93b25a45e1f9bb10dc1f9'],
  ['public/move.js', '218e07576fe906b606a34930934e0a602e2ea7f0e68992379c7b17f7ecb87e4a'],
  ['public/world.js', '05c63455ed0cebc92293606a11e1fee08641831fd3a811874dc33bba79f1dfb9'],
  ['generated/server/world.js', '05c63455ed0cebc92293606a11e1fee08641831fd3a811874dc33bba79f1dfb9'],
  ['public/timing_policy.js', 'f1d1bb25cc6de53e7d4de2ac7103565e023fa10f8dfcfcdef26b22b155471069'],
];
/* a value as text, functions by their source and in a fixed key order: two worlds evaluated apart (another realm, another load) compare */
function canon(v, seen = new Set()) {
  if (typeof v === 'function') return 'fn:' + v.toString();
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? '(undefined)' : v);
  if (seen.has(v)) return '(cycle)'; seen.add(v);
  const out = Array.isArray(v) ? '[' + v.map(x => canon(x, seen)).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k], seen)).join(',') + '}';
  seen.delete(v); return out;
}
/* world.js evaluated apart: as the server loads it (module.exports) and as the page does (a classic script setting window.WORLD) */
function worldAsServer(src) { const m = { exports: {} }; vm.runInNewContext(src.toString(), { module: m, exports: m.exports }, { filename: 'world.js' }); return m.exports; }
function worldAsPage(src) { const g = { self: {} }; vm.runInNewContext(src.toString(), g, { filename: 'world.js' }); return g.self.WORLD; }
const MOVE_EXPECTED = {
  walk: 172, run: 285, crouch: 92, crawl: 54, exhaustedWalk: 148, radius: 15,
  staminaDrainRun: 10.5, staminaRegen: { stand: 24, crouch: 17, walk: 9, crouchWalk: 10, crawl: 8 },
  exhaustAt: 0, recoverAt: 36, exhaustedAcc: .62, slideMin: 135, slideEnd: 62, slideCd: .7, slideCost: 6,
  vault: { fast: { t: .3, cost: 8 }, normal: { t: .46, cost: 2.5 }, slow: { t: .8, cost: 0 } },
};

add('WL01 the Wanderer\'s movement constants by value: walk 172, a fresh sprint 285, crouch 92, crawl 54, winded 148, the stamina, slide and vault numbers, the surfaces, the noise and the body heights - the server\'s copy and the page\'s alike, each equal to R8\'s', () => {
  const srv = worldAsServer(here('generated/server/world.js')), page = worldAsPage(here('public/world.js'));
  const r8s = atR8('generated/server/world.js'), r8p = atR8('public/world.js');
  const bad = [];
  for (const [n, W] of [['server', srv], ['page', page]]) {
    if (canon(W.MOVE) !== canon(MOVE_EXPECTED)) bad.push(n + ' MOVE ' + canon(W.MOVE));
    for (const k of ['walk', 'run', 'crouch', 'crawl', 'exhaustedWalk']) if (W.MOVE[k] !== MOVE_EXPECTED[k]) bad.push(`${n} ${k} ${W.MOVE[k]}`);
  }
  if (canon(srv) !== canon(page)) bad.push('the page\'s world differs from the server\'s');
  let r8note = 'R8 not readable (no git): the values above are its own';
  if (r8s && r8p) {
    const a = worldAsServer(r8s), b = worldAsPage(r8p);
    for (const k of ['MOVE', 'SURF', 'NOISE', 'PROFILE', 'S', 'SN']) { if (canon(srv[k]) !== canon(a[k])) bad.push('server ' + k + ' differs from R8'); if (canon(page[k]) !== canon(b[k])) bad.push('page ' + k + ' differs from R8'); }
    if (canon(srv) !== canon(a)) bad.push('the server\'s whole world differs from R8\'s');
    r8note = 'and every key of the whole world module (props, crawlspaces, surfaces, functions by their source) is R8\'s';
  } else bad.push(r8note);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `walk ${srv.MOVE.walk}, sprint ${srv.MOVE.run}, crouch ${srv.MOVE.crouch}, crawl ${srv.MOVE.crawl}, winded ${srv.MOVE.exhaustedWalk}; sprint drain ${srv.MOVE.staminaDrainRun}/s, recovery at ${srv.MOVE.recoverAt}, winded acceleration x${srv.MOVE.exhaustedAcc}; surfaces ${Object.keys(srv.SURF).join('/')}; the page's copy the same; ${r8note}` };
});

add('WL02 every file that moves a Wanderer or sets how it moves is R8\'s byte for byte - the S.P.A.C.E. framework (constants, the page\'s mover, the server\'s movement check, the other Wanderers\' bodies), the surfaces, the parts built into move.js, the server\'s step, and the built move.js, world.js and timing policy - and nothing was added among them', () => {
  const bad = []; let git = 0;
  for (const [f, h] of LOCKED) {
    let b; try { b = here(f); } catch (e) { bad.push(f + ' missing'); continue; }
    if (sha(b) !== h) bad.push(f + ' is not R8\'s (its hash ' + sha(b).slice(0, 12) + ')');
    const r = atR8(f); if (r) { git++; if (!lf(r).equals(lf(b))) bad.push(f + ' differs from git ' + R8.slice(0, 7)); if (sha(r) !== h) bad.push(f + ': the pinned hash is not R8\'s'); }
  }
  // nothing added to (or taken from) the S.P.A.C.E. framework since R8
  const walkDir = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(x => x.isDirectory() ? walkDir(d + '/' + x.name) : [d + '/' + x.name]);
  const now = walkDir('src/frameworks/space').sort(), then = (lsR8('src/frameworks/space') || LOCKED.map(x => x[0]).filter(f => f.startsWith('src/frameworks/space/'))).sort();
  if (canon(now) !== canon(then)) bad.push('the framework\'s files are not R8\'s: ' + now.filter(f => !then.includes(f)).concat(then.filter(f => !now.includes(f))).join(', '));
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${LOCKED.length} files equal to R8's pinned hashes, ${git} of them also to git's ${R8.slice(0, 7)}; the framework's ${now.length} files the same set as R8's` };
});

/* the real move.js headless, from its source text (as dev/move_model.js runs it; R8's source is run the same way) */
function moverOf(src, sim, WORLD) {
  const H = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, distance: 0, stamina: 100, sprinting: false, exhausted: false, equipment: { kind: 'flashlight' } };
  const keys = new Set(), api = { H, keys, Bc: (x, y) => sim.blockersAt(x, y), Oc: sim.adapter.rooms }, win = { WORLD, __api: api };
  new vm.Script(src.toString(), { filename: 'move.js' }).runInContext(vm.createContext({ window: win, performance: { now: () => 0 }, Math, console, document: { getElementById: () => null } }));
  const mv = win.__mv;
  return { H, mv, step(ix, iy, run, crouch, dt, slide) { if (slide) keys.add('KeyC'); else if (!!crouch !== mv.crouch && !mv.zone) mv.crouch = !!crouch; mv.step(ix, iy, run, dt); keys.delete('KeyC'); mv.prevC = false; } };
}
const MODES = ['walk', 'sprint', 'crouch', 'crawl', 'slide', 'vault', 'deep', 'recovery', 'longsprint'];
/* one movement for 10 s (20 s for the long sprint) at 60 Hz, from a fixed start (movement_parity2f.js's starts; the long sprint down the
 * long hall); every tick's position, velocity, stamina, exhaustion and state */
function trace(make, mode) {
  const { World, WORLD } = require('../harness');
  const w = World(1), m = make(w.sim, WORLD), H = m.H; let x = 4000, y = 3504, ix = 1, iy = 0;
  if (mode === 'deep') { let found; for (let yy = 96; yy < 6800 && !found; yy += 48) for (let xx = 96; xx < 9100; xx += 48) if (WORLD.surfaceAt(xx, yy, w.ad.rooms) === 'deep' && w.ad.clear(xx, yy, 16, 'walk')) { found = { x: xx, y: yy }; break; } ({ x, y } = found); }
  if (mode === 'vault') { const r = WORLD.PROPS.find(p => p.id === 'L1').rect; x = r.x + r.w / 2; y = r.y - 120; ix = 0; iy = 1; }
  if (mode === 'crawl') { const r = WORLD.CRAWL.find(p => p.type !== 'gap'); x = r.exits[0].x; y = r.exits[0].y; ix = r.exits[1].x - x; iy = r.exits[1].y - y; }
  if (mode === 'longsprint') { x = 3060; y = 3504; }
  H.x = x; H.y = y; if (mode === 'recovery') { H.stamina = 0; H.exhausted = true; ix = iy = 0; }
  const out = [], n = mode === 'longsprint' ? 1200 : 600, run = ['sprint', 'slide', 'deep', 'vault', 'longsprint'].includes(mode);
  for (let i = 0; i < n; i++) { m.step(ix, iy, run, mode === 'crouch' || mode === 'crawl', 1 / 60, mode === 'slide' && i === 60); out.push([H.x, H.y, H.vx, H.vy, H.stamina, H.exhausted, m.mv.s]); }
  return out;
}
const speedOf = q => Math.hypot(q[2], q[3]);
const steady = (T, a, b) => { const v = T.slice(a, b).map(speedOf); return { lo: Math.min(...v), hi: Math.max(...v) }; };

add('WL03 the real move.js, run headless: this tree\'s and R8\'s give the same ticks in every movement (walk, sprint, crouch, crawl, slide, vault, deep carpet, recovery, a 20 s sprint to exhaustion), and the speeds reached are the constants - walk 172, fresh sprint 285, crouch 92, crawl 54, winded 148', () => {
  const mine = fs.readFileSync(path.join(ROOT, 'public', 'move.js')), r8 = atR8('public/move.js'), { makeMover } = require('../move_model');
  const bad = [], T = {};
  for (const mode of MODES) {
    T[mode] = trace((sim, W) => moverOf(mine, sim, W), mode);
    const viaModel = trace((sim, W) => makeMover(sim, W, () => 0), mode);   // (the loader here runs move.js as the tests' own model does)
    if (canon(viaModel) !== canon(T[mode])) bad.push(mode + ': this loader differs from dev/move_model.js');
    if (r8) { const b = trace((sim, W) => moverOf(r8, sim, W), mode); if (canon(b) !== canon(T[mode])) bad.push(mode + ': ticks differ from R8\'s move.js'); }
  }
  if (!r8) bad.push('R8\'s move.js not readable (no git)');
  const near = (s, v, tol = .5) => s.lo >= v - tol && s.hi <= v + tol;
  const walk = steady(T.walk, 120, 300), sprint = steady(T.longsprint, 120, 300), crouch = steady(T.crouch, 120, 300);
  // (under the furniture: it slows from its crouch to a crawl and keeps it)
  const crawlTicks = T.crawl.filter(q => q[6] === 'crawl').map(speedOf), crawl = { lo: Math.min(...crawlTicks), hi: Math.max(...crawlTicks), at: crawlTicks.filter(v => Math.abs(v - 54) <= .5).length };
  const ex = T.longsprint.findIndex(q => q[5]), winded = ex > 0 ? steady(T.longsprint, ex + 60, ex + 180) : { lo: 0, hi: 0 };
  const drain = (T.longsprint[60][4] - T.longsprint[360][4]) / 5;
  if (!near(walk, 172)) bad.push(`walk ${walk.lo.toFixed(2)}-${walk.hi.toFixed(2)}`);
  if (!near(sprint, 285)) bad.push(`sprint ${sprint.lo.toFixed(2)}-${sprint.hi.toFixed(2)}`);
  if (!near(crouch, 92)) bad.push(`crouch ${crouch.lo.toFixed(2)}-${crouch.hi.toFixed(2)}`);
  if (!crawlTicks.length || Math.abs(crawl.lo - 54) > .5 || crawl.at < 20 || crawl.hi > 92 + .5) bad.push(`crawl ${crawl.lo}-${crawl.hi} (${crawl.at} ticks at 54)`);
  if (ex < 0 || !near(winded, 148)) bad.push(`winded ${winded.lo.toFixed(2)}-${winded.hi.toFixed(2)} (exhausted at tick ${ex})`);
  if (Math.abs(drain - 10.5) > .05) bad.push(`sprint drain ${drain.toFixed(3)}/s`);
  const rec = T.recovery.findIndex(q => !q[5]); if (!(rec > 1 && T.recovery[rec][4] >= 36 && T.recovery[rec - 1][4] >= 36 && T.recovery[rec - 2][4] < 36)) bad.push('recovery not at 36');   // (movement_parity2f.js's own test of it)
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${MODES.length} movements, ${MODES.reduce((s, m) => s + T[m].length, 0)} ticks each the same from R8's move.js; walk ${walk.hi.toFixed(1)}, fresh sprint ${sprint.hi.toFixed(1)}, crouch ${crouch.hi.toFixed(1)}, crawl ${crawl.lo.toFixed(1)} (${crawl.at} ticks), winded ${winded.hi.toFixed(1)} px/s; a sprint drains ${drain.toFixed(2)}/s and winds it at ${(ex / 60).toFixed(2)} s; recovered at ${T.recovery[rec][4].toFixed(1)} stamina` };
});

add('WL04 four starving Skin-Stealers among four players for 30 s: the shared movement constants are the same objects with the same values after as before (nothing writes them), and no Skin-Stealer file reads or writes them', () => {
  const { World, LONG, AI, WORLD } = require('./lib.js');
  const keys = ['MOVE', 'NOISE', 'PROFILE', 'SURF', 'S', 'SN'], refs = keys.map(k => WORLD[k]), before = keys.map(k => canon(WORLD[k]));
  const w = World(16900); const P = [];
  for (const [x, y] of [[4200, LONG.y], [5200, LONG.y], [6200, LONG.y], [7200, LONG.y]]) { const p = w.player(x, y, { light: true, angle: Math.PI }); p.stop('stand'); P.push(p); }
  P.forEach((p, i) => { const e = w.eng.spawn('skinstealer', p.x + 520, p.y + (i % 2 ? 40 : -40), { hunger: .92 }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x); });
  let vmaxSk = 0, vmaxP = 0, started = 0;
  w.run(30, (ww, t) => {
    if (t > 2 && !started) { started = 1; P.forEach((p, i) => p.go(i % 2 ? LONG.x0 + 100 : LONG.x1 - 100, LONG.y, i % 2 ? 'walk' : 'run')); }
    for (const e of ww.eng.entities) if (e.kind === 'skinstealer' && !e.pounce && !e.recover && !e.trav && !['wind', 'pounce', 'recover', 'feed'].includes(e.act)) vmaxSk = Math.max(vmaxSk, e.speed || 0);   // (its spring is its attack's reach, and a vault the engine's own crossing - every species' - not its pace)
    for (const p of P) vmaxP = Math.max(vmaxP, Math.hypot(p.vx || 0, p.vy || 0));
    return true;
  });
  const bad = [];
  keys.forEach((k, i) => { if (WORLD[k] !== refs[i]) bad.push(k + ' replaced'); if (canon(WORLD[k]) !== before[i]) bad.push(k + ' changed'); });
  // no Skin-Stealer source names the Wanderer's movement table (it reads a person's speed as the server sees it, never the table)
  const dir = path.join(ROOT, 'src', 'frameworks', 'nani', 'server'), files = fs.readdirSync(dir).filter(f => /^ai\.skin/.test(f));
  for (const f of files) { const t = fs.readFileSync(path.join(dir, f), 'utf8'); if (/\bMOVE\b|staminaDrainRun|exhaustedWalk|\bNOISE\s*\.\s*\w+\s*=|\bPROFILE\s*\.\s*\w+\s*=/.test(t)) bad.push(f + ' names the Wanderer\'s movement table'); }
  if (vmaxSk > AI.SKIN.speeds.run + 1e-6) bad.push('a Skin-Stealer at ' + vmaxSk.toFixed(1));
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${keys.join(', ')} the same objects, the same values, after 30 s; ${files.length} Skin-Stealer files never name them; its fastest ${vmaxSk.toFixed(1)} px/s, the players' ${vmaxP.toFixed(1)} (their own move.js)` };
});

add('WL05 the Hound and the Smiler: their species (speeds, caps, senses, hooks) are R8\'s, and their code and the shared engine\'s are R8\'s byte for byte (ai.capture.js but for R15\'s one line, which only a Skin-Stealer reaches)', () => {
  const { AI } = require('./lib.js'), bad = [];
  const r8ai = atR8('generated/server/ai.js');
  if (!r8ai) return { ok: false, note: 'R8 not readable (no git)' };
  const file = path.join(ROOT, 'generated', 'server', 'ai.js'), m = new Module(file + '#r8', module);
  m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); m._compile(r8ai.toString(), file);
  const A8 = m.exports;
  for (const k of ['HOUND', 'SMILER', 'HACT', 'SACT', 'TRAITS', 'TIER']) if (canon(AI[k]) !== canon(A8[k])) bad.push(k + ' differs from R8');
  const parts = ['ai.head.js', 'ai.senses.js', 'ai.intelligence.js', 'ai.engine.js', 'ai.entity.js', 'ai.hound.js', 'ai.smiler.js'];
  for (const f of parts) { const p = 'src/frameworks/nani/server/' + f, r = atR8(p); if (!r || !lf(r).equals(lf(here(p)))) bad.push(f + ' differs from R8'); }
  const cap = 'src/frameworks/nani/server/ai.capture.js', c8 = lf(atR8(cap) || '').toString().split('\n'), c = lf(here(cap)).toString().split('\n');
  const diff = c.length === c8.length ? c.map((l, i) => l !== c8[i] ? i : -1).filter(i => i >= 0) : null;
  if (!diff || diff.length !== 1 || !/Trial 3 R15: the Skin-Stealer's D too/.test(c[diff[0]])) bad.push('ai.capture.js: not R8\'s but for R15\'s one line');
  const sp = k => Object.entries(AI[k].speeds).map(([a, b]) => a + ' ' + b).join(', ');
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `Hound (${sp('HOUND')}) and Smiler (${sp('SMILER')}) and their acts and traits as at R8; ${parts.length} parts byte for byte; ai.capture.js one line apart (line ${diff[0] + 1}, R15)` };
});

add('WL06 the Skin-Stealer\'s own speeds, every one under a fresh Wanderer\'s sprint (285): R18\'s overtuned profile in the owner\'s ranges - roam 140-175, prowl 195-215, investigation 225-240, press 255-265, its run (its most) at most 270 - its stealth paces slow', () => {
  const { AI, WORLD } = require('./lib.js'), bad = [], sp = AI.SKIN.speeds, top = Math.max(...Object.values(sp));
  const within = (k, lo, hi) => { if (!(sp[k] >= lo && sp[k] <= hi)) bad.push(`${k} ${sp[k]} (the owner's ${lo}-${hi})`); };
  within('roam', 140, 175); within('prowl', 195, 215); within('investigate', 225, 240); within('press', 255, 265); within('run', 240, 270);
  if (!(sp.creep <= 90 && sp.stalk <= 110)) bad.push(`stealth paces creep ${sp.creep}, stalk ${sp.stalk}`);
  if (!(top === sp.run && top < WORLD.MOVE.run)) bad.push(`its most ${top}, a fresh sprint ${WORLD.MOVE.run}`);
  if (!(sp.press > AI.SK.runFrom && sp.run > AI.SK.runFrom && sp.prowl <= AI.SK.runFrom)) bad.push(`stamina: runFrom ${AI.SK.runFrom} - the press and the run must cost it, the prowl must not`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `its speeds ${JSON.stringify(sp)}: its most ${top} < a fresh sprint ${WORLD.MOVE.run}; the press and the run spend stamina (over ${AI.SK.runFrom} px/s), its prowl does not` };
});

module.exports = S;
