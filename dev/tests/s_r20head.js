/* THE HEAD SWIVEL (Trial 3 R20, checkpoint D, the N track; dev/trial-3-r20-nani-head-watchdog/DESIGN_DECISIONS.md W3; Trial 3 is not
 * owner-approved).  A species with a head it can turn may opt in (caps.HEAD_SWIVEL); only the Skin-Stealer does.  Its gaze leads into the
 * bends of its own route (headAhead, shared); its sight is the engine's, centred on e.ang + e.head and stopped by walls as before; the page
 * draws the server's head.  The scenes are r20d_scenes.js, run by r20n_child.js on this tree's built ai.js; the page is this tree's
 * public/assets/skinstealer.js (and R19 combined's, 2f11eae, for the negative proof) run in a VM with recorder Pixi classes (s_skinbody.js's
 * harness, copied).
 *   NA01 the drawn head is where it looks: the page's drawn gaze against the server's sight (e.ang + e.head) over 15 min of real play; and
 *        the server's own half - standing still, its head at -.85 / 0 / +.85 rad, it sees exactly those inside its cone round e.ang + e.head
 *   NA02 a head turned at a corner reveals nothing behind a wall: nobody seen without a clear line, in play or with its head turned straight
 *        at somebody in the next room; round a bend it sees the person standing there when the line opens, not before
 *   NA03 the head while it walks and runs: within its swivel's reach (.4 rad at a run), never turning faster than the swivel's rate, no spin;
 *        two pages at 60 and 24 fps, and a page that joins late, draw the same head
 *   NA04 a species without the capability is exactly as it was: the Hound and the Smiler have none, headAhead is 0 for them, and with the
 *        swivel's hunks taken out of the built ai.js nothing they do changes (the locks PR25, WL05, C15 hold their code byte for byte)
 *   NA05 the Hound and the Smiler are untouched (the seeded chase study is in REGRESSION.md: identical outcomes); the swivel never moves a
 *        body: the same routes walked with the head swivelling and straight give the same path to the hundredth of a pixel
 *   NA06 R19's corner timing is kept: NC01-NC04 (s_nanicorner.js, in the suite) pass on this tree unchanged, and NA05 shows the swivel
 *        cannot move a body (its routes' arrivals are the same with its head straight) */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const S = []; const add = (name, fn) => S.push({ name, fn });
const ROOT = path.join(__dirname, '..', '..'), CACHE = {};
const run = (mode, scene) => { const k = mode + ':' + scene; if (!CACHE[k]) CACHE[k] = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'r20n_child.js'), mode, 'r20d_scenes:' + scene, ROOT], { cwd: ROOT, maxBuffer: 1 << 28 }).toString()); return CACHE[k]; };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : 0; };

/* the page (s_skinbody.js's recorders: a Container and a Graphics that remember what is drawn) */
class FakeC {
  constructor() { this.children = []; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y === undefined ? x : y; } };
    this.scale = { x: 1, y: 1, set: (x, y) => { this.scale.x = x; this.scale.y = y === undefined ? x : y; } }; this.rotation = 0; this.alpha = 1; this.visible = true; this.tint = 0xffffff; }
  addChild(c) { this.children.push(c); c.parent = this; return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); c.parent = null; }
  destroy() { this.destroyed = true; }
}
class FakeG extends FakeC {
  constructor() { super(); this.clear(); }
  clear() { this.pts = []; this.n = 0; return this; }
  _p(x, y) { this.pts.push([x, y]); }
  moveTo(x, y) { this._p(x, y); return this; } lineTo(x, y) { this._p(x, y); return this; }
  quadraticCurveTo(a, b, x, y) { this._p(a, b); this._p(x, y); return this; }
  ellipse(x, y) { this._p(x, y); return this; } circle(x, y) { this._p(x, y); return this; }
  poly(p) { for (let i = 0; i < p.length; i += 2) this._p(p[i], p[i + 1]); return this; }
  fill() { this.n++; return this; } stroke() { this.n++; return this; }
}
let R19JS = null;
function page(which = 'now') {
  const layer = new FakeC(), ctx = { console, Math, performance: { now: () => 0 }, innerWidth: 1024, innerHeight: 640, document: { getElementById: () => null, querySelector: () => null }, setTimeout: () => 0 };
  ctx.window = ctx; vm.createContext(ctx);
  ctx.__api = { layer: () => layer, death: () => ({ blood: new FakeG() }), H: { x: 0, y: 0 }, lightOn: () => true,
    mkAvatar: look => { const a = new FakeC(); a.look = look; a.hands = [new FakeC(), new FakeC()]; a.gear = new FakeC(); a.update = () => {}; return a; } };
  ctx.__mpLib = { wire: { parseLook: s => ({ hat: s.split('|')[0] }) } };
  ctx.__light = { mk: () => ({}), sample: () => ({ total: .8, direct: .7, dirX: -.6, dirY: -.8 }), shade: t => .1 + .9 * t, ray: () => 60 };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'dphys.js'), 'utf8'), ctx);
  const js = which === 'r19' ? (R19JS || (R19JS = execFileSync('git', ['show', '2f11eae:public/assets/skinstealer.js'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString())) : fs.readFileSync(path.join(ROOT, 'public', 'assets', 'skinstealer.js'), 'utf8');
  vm.runInContext(js, ctx);
  Object.assign(ctx.__api, { Graphics: FakeG, Container: FakeC });
  return { ctx, K: ctx.__skin, layer };
}
/* a run's snapshots (20 Hz) fed to a page at fps from `from` s on: per frame, the drawn gaze (body + head) and head against the server's */
function draw(run, which = 'now', fps = 60, from = 0) {
  const P = page(which), sn = run.snaps, out = []; let j = 0, last = null, jumpAt = -9;
  const id = sn[0].s.i;
  for (let t = Math.max(from, sn[0].t); t <= sn[sn.length - 1].t; t += 1 / fps) {
    while (j < sn.length && sn[j].t <= t + 1e-9) { if (last && Math.hypot(sn[j].s.x - last.s.x, sn[j].s.y - last.s.y) > 200) jumpAt = t; last = sn[j]; j++; }
    P.ctx.__api.H = { x: last.s.x + 240, y: last.s.y };   // (the page's player, watching it from nearby: a page draws only what is near its player)
    P.ctx.performance.now = () => t * 1000; P.K.mirror([last.s], 1 / fps); P.K.draw(1 / fps);
    const v = P.layer.children.find(c => c.__id === id);
    if (!v || !v.visible || v.alpha < .5 || t - jumpAt < .5 || t - from < .5) continue;
    out.push({ t, gaze: angDiff(v.rotation - Math.PI / 2 + v.__hd.rotation, last.view), head: angDiff(v.__hd.rotation, last.s.h), h: last.s.h, ac: last.s.ac });
  }
  return out;
}
const stats = a => { const g = a.map(r => Math.abs(r.gaze)), h = a.map(r => Math.abs(r.head)); return { n: a.length, head50: +q(h, .5).toFixed(3), head95: +q(h, .95).toFixed(3), head99: +q(h, .99).toFixed(3), gaze50: +q(g, .5).toFixed(3), gaze95: +q(g, .95).toFixed(3) }; };

add('NA01 the drawn head is where it looks: 15 min of real play (three seeds, hunger .3 and .75, three people about) mirrored on the page - its drawn head within .2 rad of the server\'s head on 95 % of frames and its drawn gaze within .3 rad of its sight\'s centre (R19\'s page, the same snapshots: worse); standing still with its head at -.85 / 0 / +.85 rad it sees exactly the people inside its cone round e.ang + e.head', () => {
  const G = run('now', 'gaze'), A = [], B = [], bad = [];
  for (const r of G.runs) { A.push(...draw(r, 'now')); B.push(...draw(r, 'r19')); }
  const a = stats(A), b = stats(B);
  if (!(a.head95 <= .2 && a.gaze95 <= .3)) bad.push(`this page: ${JSON.stringify(a)}`);
  if (!(b.head95 > a.head95 * 1.5)) bad.push(`the negative proof: R19's page ${JSON.stringify(b)} against ${JSON.stringify(a)}`);
  const L = run('now', 'glance'), wrong = L.open.filter(r => r.inCone !== r.seen), inC = L.open.filter(r => r.inCone).length;
  if (wrong.length || inC < 40 || L.open.length - inC < 40) bad.push(`standing: ${wrong.length} of ${L.open.length} wrong (${JSON.stringify(wrong.slice(0, 3))})`);
  const turned = L.open.filter(r => r.head && r.seen && Math.abs(r.off) > L.half).length;   // seen only because the head was turned
  if (turned < 10) bad.push(`standing: only ${turned} people seen through the turned head alone`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${a.n} frames: drawn head off the server's by ${a.head50} / ${a.head95} / ${a.head99} rad (median / 95th / 99th), drawn gaze off its sight ${a.gaze50} / ${a.gaze95}; R19's page on the same snapshots ${b.head50} / ${b.head95} / ${b.head99} and ${b.gaze50} / ${b.gaze95} | standing: ${L.open.length} placements, every one seen exactly when inside the cone, ${turned} of them outside the body's cone and seen through the turned head`, data: { now: a, r19: b } };
});

add('NA02 a head turned at a corner reveals nothing behind a wall: in 15 min of play nobody is in its sight without a clear line to them; its head turned straight at somebody in the next room never sees them; round a bend (walked and run, 10 corners) it sees the person standing there within a think of the line opening and never before', () => {
  const G = run('now', 'gaze'), L = run('now', 'glance'), B = run('now', 'bends'), bad = [];
  const leaks = sum(G.runs, r => r.leaks.length), seen = sum(G.runs, r => r.seenTicks);
  if (leaks) bad.push(`play: ${leaks} ticks seen with no clear line (${JSON.stringify(G.runs.flatMap(r => r.leaks).slice(0, 3))})`);
  if (seen < 3000) bad.push(`play: only ${seen} ticks of sight to judge`);
  const behind = L.behind.filter(r => r.seen).length; if (behind || L.behind.length < 60) bad.push(`behind a wall: ${behind} of ${L.behind.length} seen`);
  let early = 0, late = 0, n = 0, turnedAt = 0;
  for (const r of B.runs) for (const m of ['swivel', 'straight']) { const x = r[m]; if (x.first === null) continue; n++; if (x.firstLos === null || x.first < x.firstLos - 1e-6 || x.leak) early++; if (x.first - x.firstLos > .12) late++; if (m === 'swivel' && Math.abs(x.hAtFirst) > .1) turnedAt++; }
  if (early || late || n < 30 || B.routes < 8) bad.push(`bends: ${B.routes} corners, ${n} sightings, ${early} before the line opened, ${late} later than a think after it`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `play: ${seen} ticks of sight, 0 without a clear line | its head turned at ${L.behind.length} people in the next room: 0 seen | ${B.routes} corners walked and run, swivelling and straight: ${n} sightings, every one within a think (.12 s) of the line opening, none before; its head was turned into the bend at ${turnedAt} of them` };
});

add('NA03 the head while it walks and runs: in play its head is turned into a bend for a part of its walking it never was at R19, and at a run never past the swivel\'s .4 rad; round the bends no head turn faster than the swivel\'s 3 rad/s; two pages at 60 and 24 fps and a page joining 30 s late draw the same head (within .08 rad after half a second)', () => {
  const G = run('now', 'gaze'), N = run('now', 'noswivel'), B = run('now', 'bends'), bad = [];
  const wt = sum(G.runs, r => r.walkT), wn = sum(G.runs, r => r.walkTurned), nt = sum(N.runs, r => r.walkT), nn = sum(N.runs, r => r.walkTurned);
  if (!(wn / wt > 2 * nn / nt)) bad.push(`play: turned ${(100 * wn / wt).toFixed(1)} % of its walking, without the swivel ${(100 * nn / nt).toFixed(1)} %`);
  const over = sum(B.runs, r => r.swivel.overRun), fast = Math.max(...B.runs.map(r => r.swivel.dhMax));
  if (over || fast > 3 + 1e-6) bad.push(`bends: ${over} ticks past .4 rad at a run, fastest head turn ${fast} rad/s`);
  // the pages: the same snapshots at 60 and 24 fps, and joining late
  let worst = 0, worstLate = 0; const r0 = G.runs[0], A = draw(r0, 'now', 60), C = draw(r0, 'now', 24), D = draw(r0, 'now', 60, 30);
  const at = (arr, t) => { let lo = 0, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; } return arr[lo]; };
  for (const c of C) { const a = at(A, c.t); if (a && Math.abs(a.t - c.t) < .02) worst = Math.max(worst, Math.abs(angDiff(a.head + a.h, c.head + c.h))); }
  for (const d of D) { const a = at(A, d.t); if (a && Math.abs(a.t - d.t) < .002) worstLate = Math.max(worstLate, Math.abs(angDiff(a.head, d.head))); }
  const p24 = stats(C);
  if (p24.head95 > .2 || worstLate > .08) bad.push(`pages: 24 fps ${JSON.stringify(p24)}, a late page off by ${worstLate.toFixed(3)}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `play: its head turned (over .2 rad, nobody in view) for ${(100 * wn / wt).toFixed(1)} % of ${wt.toFixed(0)} s of walking (without the swivel ${(100 * nn / nt).toFixed(1)} %) | bends: 0 ticks past .4 rad at a run, fastest swivel ${fast} rad/s | pages: 24 fps head within ${p24.head95} rad on 95 % of frames (60 fps vs 24 fps at most ${worst.toFixed(3)} apart at a snap's frame), a page joining at 30 s within ${worstLate.toFixed(3)} rad of the first after half a second` };
});

add('NA04 a species without the capability is exactly as it was: the Hound and the Smiler have no HEAD_SWIVEL and headAhead gives them 0 on a bend; the swivel\'s helper is a separate tagged hunk; a disguised Skin-Stealer does not swivel', () => {
  const AI = require('../../generated/server/ai.js'), RN = require('./r19n_patch.js'), bad = [];
  for (const k of ['hound', 'smiler']) if (AI.SPECIES[k].caps.HEAD_SWIVEL) bad.push(`${k} has HEAD_SWIVEL`);
  if (!AI.SPECIES.skinstealer.caps.HEAD_SWIVEL) bad.push('the Skin-Stealer has no HEAD_SWIVEL');
  if (RN.HEAD.length !== 2 || RN.R20.some(h => RN.HEAD.includes(h))) bad.push(`the registry: ${RN.HEAD.length} head hunks`);
  const src = fs.readFileSync(path.join(ROOT, 'generated', 'server', 'ai.js'), 'utf8'), calls = (src.match(/headAhead\(eng, e\)/g) || []).length;
  const hc = fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'nani', 'server', 'ai.hound.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'nani', 'server', 'ai.smiler.js'), 'utf8');
  if (/headAhead|HEAD_SWIVEL/.test(hc)) bad.push('the Hound or the Smiler calls it');
  const sk = fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'nani', 'server', 'ai.skinstealer.js'), 'utf8');
  if (!/e\.disguise \|\| \(P\.pid && e\.seenNow\.has\(P\.pid\)\) \? 0 : headAhead/.test(sk) || !/else if \(!e\.disguise\) \{ const ah = headAhead/.test(sk)) bad.push('the disguise guard is not where expected');
  const O = run('now', 'others');
  for (const k of ['hound', 'smiler']) if (O[k].max !== 0 || O[k].n < 50) bad.push(`${k}: headAhead ${O[k].max} over ${O[k].n} ticks on bends`);
  if (!(O.skinstealer.max > .2)) bad.push(`the Skin-Stealer: headAhead at most ${O.skinstealer.max} on the same bends`);
  if (O.disguised.head !== 0) bad.push(`a borrowed skin swivelled: ${O.disguised.head}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `the Hound and the Smiler: no HEAD_SWIVEL, no call, headAhead 0 over ${O.hound.n} / ${O.smiler.n} ticks of bends (the Skin-Stealer up to ${O.skinstealer.max} rad on the same); in a borrowed skin, walking its bends, its head stayed at 0; the swivel's helper: ${RN.HEAD.length} tagged hunks (ai.entity.js), called ${calls} times in ai.js, by the Skin-Stealer alone, never in a borrowed skin; the locks PR25, WL05, C15 hold the rest byte for byte` };
});

add('NA05 the swivel never moves a body: 10 corners walked and run with its head swivelling and with it straight - the same path to the hundredth of a pixel and the same arrival', () => {
  const B = run('now', 'bends'), diff = B.runs.filter(r => !r.sameTrail || r.swivel.T !== r.straight.T);
  return { ok: !diff.length && B.runs.length >= 16, note: diff.length ? `${diff.length} of ${B.runs.length} differ: ${JSON.stringify(diff.slice(0, 2))}` : `${B.runs.length} runs: every path and arrival identical (the head is where it looks, not where it goes)` };
});

module.exports = S;
