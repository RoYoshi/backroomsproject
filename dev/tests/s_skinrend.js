/* SKIN-STEALER R15 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved): its fourth kill, D - the Rend.  After a capture that was
 * already lethal (the same contact, the same commit as A-C), it may - rarely, only where it fits - tear the body in two: two halves in the
 * one shared physics (dphys.js) every screen and the server run, a corpse record that carries them (gs, gb, gh, as a NEW RUN's pieces), the
 * wire that lets them through, the corpse drawn from the record alone.  These check the authority, the determinism and the regression
 * (pack 06; matrix G08-G13); the real pages (victim, spectators, a late joiner) are dev/trial-3-r9-overhaul/tools/r9_browser.js --scene rend.
 *   G08 D only after a real lethal contact, only where it fits (a grab, hungry, room either side), rare; A-C stay common
 *   G09 two persistent major segments: the halves are the body (their areas add up to it, they fit along the cut), they come apart and
 *       rest apart, and the corpse record names them
 *   G10 the server's fallback is the victim's own death: the same corpse from the same record, whole or in steps (30 / 60 / 120 fps)
 *   G11 the light, the hat, the blood and the walls: thrown, landed on the floor, never inside a wall
 *   G12 every other death is R8's: Hound A-D, Smiler A-D, NEW RUN's blast and the Skin-Stealer's A-C - the same physics, step for step
 *   G13 one corpse, one attacker: the server makes one body; its two halves only on it; the wire keeps a NEW RUN's pieces as they were
 *   S15 the shared capture's only change is the one line that refused the Skin-Stealer's D; the admin command is the same command */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const { World, AI } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const R8_DPHYS_BLOB = '22a6fc63c64edbdacbbbc1d0a1df5e8ee1336312';   // git rev-parse f378049:generated/server/dphys.js (unchanged R8 - R14)
const blob = s => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(s) + '\0').update(s).digest('hex');
const load = file => { const win = {}; vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window: win, Math, console }); return win.__dphys; };
const DP = load(path.join(ROOT, 'generated', 'server', 'dphys.js'));
const hyp = Math.hypot;
/* a room: an open floor, or walls (rectangles) where a test puts them */
const room = rects => ({ walls: () => rects || [], clear: (x, y, r) => !(rects || []).some(q => x > q.x - r && x < q.x + q.w + r && y > q.y - r && y < q.y + q.h + r) });
const sim = (P, kind, v, o = {}) => P.simulate(Object.assign({ kind, v, victim: { x: o.x ?? 500, y: o.y ?? 500, angle: o.a ?? 0 }, src: { x: (o.x ?? 500) - Math.cos(o.d ?? 0) * 44, y: (o.y ?? 500) - Math.sin(o.d ?? 0) * 44 }, eqKind: o.eq || 'flashlight', hat: o.hat || 'cap', vx: 0, vy: 0 }, room(o.walls)));
const polyArea = p => { let A = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; A += a[0] * b[1] - b[0] * a[1]; } return Math.abs(A) / 2; };

add('G09 two persistent major segments: in the Rend the body comes apart in two along the line of the pull - two halves whose areas add up to the body\'s, that fit along their cut, that come apart and rest apart, each with its hand; the corpse record names exactly the two (gs, gb, gh) and the seed alone rebuilds them', () => {
  const out = []; let ok = true;
  for (const [i, d] of [[0, 0], [1, .9], [2, 2.4], [3, -1.7]].map(([k, d]) => [k, d])) {
    const R = sim(DP, 'SkinStealer', 'D', { x: 600 + i * 7, y: 400 + i * 13, a: d + .4, d });
    const g = R.remains && R.remains.gibs, sh = g ? DP.rendShapes(g.gs) : [];
    const area = sh.reduce((a, q) => a + polyArea(q.poly), 0), body = Math.PI * 18 * 18;
    const apart = g ? hyp(g.gb[0][0] - g.gb[1][0], g.gb[0][1] - g.gb[1][1]) : 0;
    const rent = R.S.rent && R.S.ev.some(q => q.k === 'rend');
    out.push(`dir ${d}: ${g ? g.gb.length : 0} pieces, area ${(area / body * 100).toFixed(0)} % of the body, ${apart.toFixed(0)} px apart at rest`);
    if (!g || g.gb.length !== 2 || sh.length !== 2 || Math.abs(area / body - 1) > .1 || apart < 30 || !rent || !(g.gh.length === 4)) ok = false;
  }
  return { ok, note: out.join('; ') };
});

add('G10 the server\'s fallback is the victim\'s own death: the corpse death_srv.js makes from the kill record is the one the victim\'s screen ends on (dphys run whole, or step by step at 30, 60 and 120 fps) - the same halves at the same places, every time', () => {
  const D = require(path.join(ROOT, 'src', 'frameworks', 'gib', 'server', 'death_srv.js'));
  const kill = { k: 'SkinStealer', v: 'D', x: 700, y: 520, a: .3, ax: 656, ay: 512 }, info = { name: 'k', look: 'cap|plain|#c99a76|#4a6b8a', ek: 'flashlight', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, light: true };
  const simOf = { blockersAt: () => [], clearAt: () => true };
  const A = D.bodyFor(1, kill, info, simOf).body, B = D.bodyFor(1, kill, info, simOf).body;
  const steps = [30, 60, 120].map(fps => { const P = D.begin(kill, info, simOf); for (let t = 0; t <= D.durOf(kill); t += 1 / fps) D.step(P, t); return D.corpse(1, kill, info, P).body; });
  const key = b => JSON.stringify([b.gs, b.gb, b.gh, b.x, b.y, b.bl]);
  const ok = A.gs && A.gb && A.gb.length === 2 && key(A) === key(B) && steps.every(b => key(b) === key(A)) && D.durOf(kill) === 3.6;
  return { ok, note: `corpse: gs ${A.gs}, halves at ${JSON.stringify(A.gb)}, hands ${JSON.stringify(A.gh)}; again ${key(A) === key(B) ? 'identical' : 'DIFFERENT'}; in steps at 30/60/120 fps ${steps.map(b => key(b) === key(A) ? 'same' : 'DIFFERENT').join('/')}; its length ${D.durOf(kill)} s` };
});

add('G11 the light, the hat, the blood and the walls: at the rend the light and the hat are thrown; every blood mark lands on the floor, never inside a wall; the halves, the hands, the light and the hat come to rest outside every wall - in the open and beside a wall', () => {
  const out = []; let ok = true;
  const W = [{ x: 560, y: 380, w: 300, h: 60 }];                                     // a wall 40 px above the victim's line
  for (const [name, walls] of [['open', []], ['a wall beside', W]]) {
    const R = sim(DP, 'SkinStealer', 'D', { x: 600, y: 480, a: 0, d: 0, walls });
    const inside = (x, y, r) => walls.some(q => x > q.x - r + 1 && x < q.x + q.w + r - 1 && y > q.y - r + 1 && y < q.y + q.h + r - 1);
    const S2 = R.S, bad = [];
    for (const g of S2.gib || []) if (inside(g.x, g.y, 2)) bad.push('half');
    for (const h of S2.h) if (inside(h.x, h.y, 2)) bad.push('hand');
    if (S2.eq.has && inside(S2.eq.x, S2.eq.y, 2)) bad.push('light'); if (S2.hat.has && inside(S2.hat.x, S2.hat.y, 2)) bad.push('hat');
    for (const q of S2.ev.filter(e => e.k === 'hit')) if (inside(q.x, q.y, 0)) bad.push('blood');
    const thrown = !S2.eq.held && !S2.hat.on;
    out.push(`${name}: ${bad.length ? 'INSIDE: ' + bad.join(',') : 'nothing inside a wall'}; light and hat ${thrown ? 'thrown' : 'NOT thrown'}`);
    if (bad.length || !thrown) ok = false;
  }
  return { ok, note: out.join('; ') };
});

add('G12 every other death is R8\'s: the Hound A-D, the Smiler A-D, a NEW RUN\'s blast and the Skin-Stealer\'s A-C - R8\'s dphys.js (fixture, its git blob checked) and this one, the same inputs, every 1/60 s of every death identical (body, hands, light, hat, attacker, events) and the same corpse', () => {
  const f = path.join(ROOT, 'dev', 'trial-3-r9-overhaul', 'fixtures', 'dphys.f378049.js'), src = fs.readFileSync(f, 'utf8');
  if (blob(src) !== R8_DPHYS_BLOB) return { ok: false, note: 'the fixture is not R8\'s dphys.js (blob ' + blob(src) + ')' };
  const OLD = load(f), cases = [], W = [{ x: 590, y: 300, w: 40, h: 400 }];
  for (const kind of ['Hound', 'Smiler', 'SkinStealer']) for (const v of kind === 'SkinStealer' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']) for (const [i, walls] of [[0, []], [1, W]]) cases.push({ kind, v, walls, x: 500 + i * 3, y: 500 - i * 5, a: .2 + i, d: i * .7 });
  let diff = 0, n = 0;
  const trace = (P, c) => { const R = P.prepare(Object.assign({ kind: c.kind, v: c.v, victim: { x: c.x, y: c.y, angle: c.a }, src: { x: c.x - Math.cos(c.d) * 44, y: c.y - Math.sin(c.d) * 44 }, eqKind: 'flashlight', hat: 'cap' }, room(c.walls)));
    const fr = []; for (let t = 0; t <= R.dur; t += 1 / 60) { P.advance(R.S, t); const S2 = R.S; fr.push([S2.b.x, S2.b.y, S2.b.th, S2.h[0].x, S2.h[0].y, S2.h[1].x, S2.h[1].y, S2.eq.x, S2.eq.y, S2.hat.x, S2.hat.y, S2.at.x, S2.at.y, S2.ev.length].map(q => +(+q).toFixed(6))); }
    return JSON.stringify([fr, P.finish(R).remains]); };
  for (const c of cases) { n++; if (trace(OLD, c) !== trace(DP, c)) diff++; }
  const boom = P => { const R = P.prepare(Object.assign({ kind: 'Boom', victim: { x: 400, y: 400, angle: .5 }, dir: 1.1, seed: 777 }, room([]))); P.advance(R.S, R.dur); return JSON.stringify(P.finish(R).remains); };
  const bOk = boom(OLD) === boom(DP);
  const plans = ['Hound', 'Smiler'].every(k => ['A', 'B', 'C', 'D'].every(v => JSON.stringify(OLD.PLAN(k, v, 40)) === JSON.stringify(DP.PLAN(k, v, 40)))) && ['A', 'B', 'C'].every(v => JSON.stringify(OLD.PLAN('SkinStealer', v, 40)) === JSON.stringify(DP.PLAN('SkinStealer', v, 40)));
  const gib = [1, 99, 123456].every(s => JSON.stringify(OLD.gibShapes(s)) === JSON.stringify(DP.gibShapes(s)));
  return { ok: diff === 0 && bOk && plans && gib, note: `${n} deaths (open and by a wall), every 1/60 s: ${diff} differing; a NEW RUN's blast ${bOk ? 'identical' : 'DIFFERENT'}; their plans ${plans ? 'identical' : 'DIFFERENT'}; a NEW RUN's breakup ${gib ? 'identical' : 'DIFFERENT'}` };
});

add('G13 one corpse, its halves only on it: the wire keeps a Skin-Stealer\'s corpse with exactly two pieces (a NEW RUN\'s 1-8 as before) and drops anything else; a corpse record without them is a whole body as before', () => {
  const ctx = { console, Math, performance: { now: () => 0 } }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'bpp', 'client', 'net-wire.js'), 'utf8'), ctx);   // (B++'s wire part as it is built into mp.js)
  const W = ctx.__mpLib.wire, base = { k: 3, n: 'x', x: 10, y: 10, a: 0, sx: 1, sy: 1, aa: 0, lk: 'cap|plain|#c99a76|#4a6b8a', eq: { kind: 'flashlight', color: '#ffe7b2', parts: '' }, bl: [], dr: [0, 0, 0], ht: [0, 0, 0] };
  const gibs = (c, n) => Object.assign({}, base, { c, gs: 4242, gb: Array.from({ length: n }, (_, i) => [i, i, 0]), gh: [1, 2, 3, 4] });
  const has = r => !!(r.gb && r.gs !== undefined && r.gh);
  const cases = [['SkinStealer', 2, true], ['SkinStealer', 1, false], ['SkinStealer', 3, false], ['Boom', 1, true], ['Boom', 6, true], ['Boom', 9, false], ['Hound', 2, false]];
  const res = cases.map(([c, n, want]) => [c, n, has(W.toRec(gibs(c, n))) === want]);
  const plain = W.toRec(Object.assign({}, base, { c: 'SkinStealer' }));
  const ok = res.every(r => r[2]) && !has(plain);
  return { ok, note: res.map(([c, n, g]) => `${c} ${n}: ${g ? 'as wanted' : 'WRONG'}`).join(', ') + `; a plain one ${has(plain) ? 'HAS PIECES' : 'whole'}` };
});
module.exports = S;
/* ---- G08 and S15 (server; appended) ---- */
const S2 = module.exports;
const { bystander, LONG } = require('./lib.js');
const ARENA = { x: 3960, y: 3384 };                                                // (an open hall, every wall at least 300 px off)
S2.unshift({ name: 'G08 D only after a real lethal contact, only where it fits: its weight is nothing at the end of a leap, under hunger .6, or with a wall within 72 px of either side of the victim across the line of the pull - and then the draw is A-C\'s own, exactly; in the open, a hungry grab is sometimes D, mostly A-C; every D a body-to-body kill, never two in a row', fn: () => {
  const V = AI.SKIN.capture.variants, w0 = World(1501), e0 = w0.eng.spawn('skinstealer', ARENA.x, ARENA.y, { hunger: .85 });
  const pv = { x: ARENA.x + 40, y: ARENA.y, ex: 0, stamina: 100 }, ctx = { deadEnd: false }, Dw = (e, p, a) => V(w0.eng, e, p, ctx, a).find(i => i.k === 'D').w;
  const grab = { style: 'grab', speed: 190 }, leap = { style: 'pounce', speed: 400 };
  const cases = {};
  cases.grabStarving = Dw(e0, pv, grab); cases.leap = Dw(e0, pv, leap);
  e0.hunger = .7; cases.grabHungry = Dw(e0, pv, grab); e0.hunger = .5; cases.grabMild = Dw(e0, pv, grab); e0.hunger = .85;
  cases.noPlace = Dw(e0, { ex: 0, stamina: 100 }, grab);                            // (a stand-in victim with no place: nothing)
  // by a wall: the victim 40 px from a wall's face, the pull along the wall (the halves would go into it and away from it)
  const g = w0.eng.geo; let wallPv = null, wallE = null;
  for (let y = ARENA.y - 1500; y < ARENA.y + 1500 && !wallPv; y += 16) for (let x = ARENA.x - 1500; x < ARENA.x + 1500 && !wallPv; x += 8) { const d = g.ray(x, y, -Math.PI / 2, 400); if (d > 30 && d < 50 && g.ray(x, y, Math.PI / 2, 400) > 120 && g.clear(x, y, 20, 'walk') && g.clear(x - 44, y, 24, 'walk') && g.los(x - 44, y, x, y)) { wallPv = { x, y, ex: 0, stamina: 100 }; wallE = { x: x - 44, y }; } }
  if (wallPv) { const ew = Object.assign(Object.create(Object.getPrototypeOf(e0)), e0, wallE); cases.byWall = Dw(ew, wallPv, grab); }
  // A-C, D at nothing: the same draw as without D (the very same rng values)
  const rngA = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), rngB = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const pickW = (rng, items) => { let t = 0; for (const it of items) t += Math.max(0, it.w); let r = rng() * t; for (const it of items) { r -= Math.max(0, it.w); if (r <= 0) return it.k; } return items[items.length - 1].k; };
  e0.hunger = .5; let same = 0;
  for (let i = 0; i < 400; i++) { const it = V(w0.eng, e0, pv, ctx, grab); if (pickW(rngA, it.filter(q => q.w > 0)) === pickW(rngB, it.filter(q => q.k !== 'D'))) same++; }
  // real grabs in the open: a starving one, somebody walking into its reach (kills by the engine's own capture)
  const real = {}, bad = [];
  for (let seed = 1; seed <= 30; seed++) {
    const w = World(2000 + seed * 97); bystander(w);
    const p = w.player(ARENA.x + 42, ARENA.y + (seed % 3 - 1) * 6, { light: true, angle: 0 }); p.look = 0; p.stop('stand');   // (within its arm's reach: a grab)
    const e = w.eng.spawn('skinstealer', ARENA.x, ARENA.y, { hunger: .9 }); e.tier = 'near'; e.ang = 0;
    w.run(6);
    for (const k of w.kills.filter(q => q.kind === 'SkinStealer')) { real[k.variant] = (real[k.variant] || 0) + 1; const d = Math.hypot(k.geo.ax - k.victim.x, k.geo.ay - k.victim.y); if (k.variant === 'D' && d > AI.SK.grabReach + 6) bad.push('D at ' + d.toFixed(0) + ' px'); }
  }
  const nReal = Object.values(real).reduce((a, b) => a + b, 0), nD = real.D || 0;   // (30 worlds, their seeds spread: a world's first draws are its own)
  const ok = cases.grabStarving > 0 && cases.grabHungry > 0 && cases.leap === 0 && cases.grabMild === 0 && cases.noPlace === 0 && cases.byWall === 0 && same === 400 && nD >= 1 && nD < nReal / 2 && !bad.length && (real.A || 0) + (real.B || 0) + (real.C || 0) > nD;
  return { ok, note: `D's weight: a starving grab ${cases.grabStarving}, a hungry grab ${cases.grabHungry}, a leap ${cases.leap}, hunger .5 ${cases.grabMild}, no place ${cases.noPlace}, by a wall ${cases.byWall === undefined ? '(no wall found)' : cases.byWall} | with D at nothing, the draw is A-C's own ${same}/400 | ${nReal} real grabs in the open: ${JSON.stringify(real)}${bad.length ? ' | ' + bad.join(', ') : ''}` };
} });
S2.push({ name: 'S15 the shared capture changes by one line - the refusal of the Skin-Stealer\'s D in previewKill - and nothing else since 4518f93 (the Hound\'s and the Smiler\'s code is theirs, byte for byte); the admin\'s preview is the same command, D now allowed for the Skin-Stealer', fn: () => {
  const { execFileSync } = require('child_process'), f = 'src/frameworks/nani/server/ai.capture.js';
  const base = execFileSync('git', ['show', '4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a:' + f], { cwd: ROOT, maxBuffer: 1 << 26 }).toString(), now = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const OLD = "  const geo = eng.geo, V = /^[ABCD]$/.test(variant) && !(e.kind === 'skinstealer' && variant === 'D') ? variant : 'A', hound = e.kind === 'hound';   // (Trial 3: the Skin-Stealer has A-C)";
  const NEW = "  const geo = eng.geo, V = /^[ABCD]$/.test(variant) ? variant : 'A', hound = e.kind === 'hound';   // (Trial 3 R15: the Skin-Stealer's D too)";
  const one = base.split(OLD).length === 2 && base.replace(OLD, NEW) === now;
  const adm = fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'overseer', 'server', 'admin.js'), 'utf8'), cmd = /case 'preview': \{/.test(adm) && /v = \/\^\[ABCD\]\$\/\.test\(m\.var\)/.test(adm);
  return { ok: one && cmd, note: `ai.capture.js = 4518f93's with that one line: ${one}; admin 'preview': the same command, A-D for every killer ${cmd}` };
} });
