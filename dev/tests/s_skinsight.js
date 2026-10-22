/* SKIN-STEALER R10 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved): the Skin-Stealer's heartbeat and sting only while the page
 * SEES it.  The page's own scripts run here in Node, unchanged: public/assets/skinstealer.js as built (its mirror and its sight module)
 * and the dread hook core/client/mp.frame.js (the maintained source, which builds into public/mp.js), each in a VM with a small stand-in
 * for the page: window.__api's ray (Uc: walls as rectangles, the slab test the bundle's rayDistance does for pillars), its readability
 * (Ul: the client's exposureAt terms - near aura, torch cone, lamps, range fade - over a stand-in level of lamp pools), the player, the
 * camera.  What the page would DRAW decides; nothing reads the server.  V01-V06, V08, V09, V11 deterministic here; V07 (two pages), V10
 * (SOUND OFF) and the real-page V02/V04 run in dev/trial-3-r9-overhaul/tools/r9_browser.js --scene audio.  V12: the hook's every output
 * (thumps, drone, vignette, shake, flicker, stings) frame by frame, R8's mp.frame.js (fixtures/mp.frame.f378049.js, its git blob checked)
 * against this tree's, with no Skin-Stealer, and with one behind a wall: identical. */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const S = []; const add = (name, fn) => S.push({ name, fn });
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const R8_FRAME_BLOB = 'd478c2bc77ae19da801788be5bcd4c172ceb64b7';   // git rev-parse f378049:src/core/client/mp.frame.js

/* a stand-in level: walls (rectangles), lamp pools, the player; the client's ray and readability over it */
function level(o = {}) {
  const L = { walls: o.walls || [], lamps: o.lamps || [], H: Object.assign({ x: 0, y: 0, angle: 0, equipment: { kind: 'flashlight' } }, o.H || {}), light: o.light !== false };
  L.Uc = (x, y, a, max) => { const dx = Math.cos(a), dy = Math.sin(a); let best = max;
    for (const r of L.walls) { const t1 = Math.abs(dx) < 1e-10 ? (x < r.x || x > r.x + r.w ? -1 : -Infinity) : (r.x - x) / dx, t2 = Math.abs(dx) < 1e-10 ? (x < r.x || x > r.x + r.w ? -1 : Infinity) : (r.x + r.w - x) / dx;
      const t3 = Math.abs(dy) < 1e-10 ? (y < r.y || y > r.y + r.h ? -1 : -Infinity) : (r.y - y) / dy, t4 = Math.abs(dy) < 1e-10 ? (y < r.y || y > r.y + r.h ? -1 : Infinity) : (r.y + r.h - y) / dy;
      const near = Math.max(Math.min(t1, t2), Math.min(t3, t4)), far = Math.min(Math.max(t1, t2), Math.max(t3, t4)); if (far >= Math.max(0, near) && near >= 0) best = Math.min(best, near); }
    return Math.max(0, best); };
  L.Ul = (x, y, ob, flash) => { const d = Math.hypot(x - ob.x, y - ob.y); let s = (1 - sm(28, 100, d)) * .5;
    if (flash) { const off = Math.abs(Math.atan2(Math.sin(Math.atan2(y - ob.y, x - ob.x) - ob.angle), Math.cos(Math.atan2(y - ob.y, x - ob.x) - ob.angle))); if (d < 520 && off < .45) s = Math.max(s, .5 * (1 - sm(24, 520, d))); }
    for (const l of L.lamps) { const ld = Math.hypot(x - l.x, y - l.y); if (ld < 380) s = Math.max(s, (1 - sm(40, 380, ld)) * .43); }
    return (1 - sm(420, 670, d)) * Math.min(1, .04 + s * 2.08); };
  return L;
}
/* a page: the built skinstealer.js in a VM, its __api the stand-in; cam: the camera (default: centred on the player) */
function page(L, extra) {
  const ctx = { console, Math, performance: { now: () => 0 }, innerWidth: 1024, innerHeight: 640, document: { getElementById: () => null, querySelector: () => null }, setTimeout: () => 0 };
  ctx.window = ctx; vm.createContext(ctx);
  ctx.__api = { H: L.H, lightOn: () => L.light, Uc: (...a) => L.Uc(...a), Ul: (...a) => L.Ul(...a) };
  Object.assign(ctx, extra || {});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'skinstealer.js'), 'utf8'), ctx);
  return ctx;
}
/* run a page's sight for secs at 60 fps; mirror(t) gives the server's list at time t (the snapshot entries); returns the ks trace and stings */
function run(P, L, secs, mirror, o = {}) {
  const out = { ks: [], stings: 0, max: 0, firstAt: -1, sting: [] }, dt = 1 / 60;
  for (let i = 0; i < Math.round(secs * 60); i++) {
    const t = i * dt; P.__skin.mirror(mirror(t), dt);
    if (o.each) o.each(t);
    const r = P.__skin.sight(dt, { cam: o.cam ? o.cam(t) : { x: L.H.x, y: L.H.y }, sc: .9, W: 1024, H: 640, run: o.run !== false });
    out.ks.push(r.k); out.max = Math.max(out.max, r.k); if (r.k > .05 && out.firstAt < 0) out.firstAt = +t.toFixed(3);
    if (r.sting) { out.stings++; out.sting.push(+t.toFixed(2)); }
  }
  out.end = out.ks[out.ks.length - 1]; return out;
}
const one = (x, y, extra) => () => [Object.assign({ i: 7, x, y, a: Math.PI, s: 1, ac: 0, v: 0, h: 0 }, extra || {})];
/* a lit hall: the player at the origin facing east, a lamp pool round x 260 */
const hall = (o = {}) => level(Object.assign({ lamps: [{ x: 260, y: 0 }], walls: [{ x: -600, y: -120, w: 1400, h: 20 }, { x: -600, y: 100, w: 1400, h: 20 }] }, o));

add('V01 a Skin-Stealer 1 px behind a wall, close by (60 px from the player, lit beyond it): no new heartbeat, no sting - for 3 s', () => {
  const L = hall({ walls: [{ x: -600, y: -120, w: 1400, h: 20 }, { x: -600, y: 100, w: 1400, h: 20 }, { x: 40, y: -100, w: 20, h: 200 }] }); const P = page(L);
  const R = run(P, L, 3, one(61 + 24, 0));
  return { ok: R.max === 0 && R.stings === 0, note: `ks max ${R.max.toFixed(3)}, stings ${R.stings} (the wall at x 40-60, its centre at 85; every ray stopped at the wall)` };
});
add('V02 an undisguised Skin-Stealer on screen, in sight and lit (260 px, a lamp over it): the heartbeat comes in within 0.3 s and one sting plays; out of sight it goes within the release (0.5 s), no second sting while it stays', () => {
  const L = hall(), P = page(L); let vis = true;
  const R = run(P, L, 6, t => vis ? one(260, 0)() : [], { each: t => { vis = t < 4; } });
  const after = R.ks.slice(Math.round(4.6 * 60)); const zeroBy = R.ks.findIndex((k, i) => i > 4 * 60 && k === 0) / 60;
  return { ok: R.firstAt >= 0 && R.firstAt <= .3 && R.stings === 1 && R.max > .5 && after.every(k => k === 0), note: `onset at ${R.firstAt} s, ks max ${R.max.toFixed(2)}, stings ${R.stings} at ${R.sting.join('/')} s; gone (removed from the list at 4 s) ks 0 by ${zeroBy.toFixed(2)} s` };
});
add('V03 / V05 darkness and the screen: in sight but in the dark (no lamp, torch off, 300 px) - nothing; lit but outside the screen (in the sight mask) - nothing; lit on screen - the cue', () => {
  const Ld = hall({ lamps: [], light: false }), Pd = page(Ld), D = run(Pd, Ld, 2, one(300, 0));
  const Lo = hall(), Po = page(Lo), O = run(Po, Lo, 2, one(260, 0), { cam: () => ({ x: -700, y: 0 }) });   // (the camera 700 px west: x 260 is past the right edge)
  const Ll = hall(), Pl = page(Ll), V = run(Pl, Ll, 2, one(260, 0));
  return { ok: D.max === 0 && D.stings === 0 && O.max === 0 && O.stings === 0 && V.max > .5 && V.stings === 1, note: `dark: ks ${D.max.toFixed(3)} stings ${D.stings} | off screen: ks ${O.max.toFixed(3)} stings ${O.stings} | lit on screen: ks ${V.max.toFixed(2)} stings ${V.stings}` };
});
add('V04 a torch reveals it: in the dark 300 px ahead, the torch off - nothing; the torch on, aimed at it - the cue comes in (onset, one sting); the torch off again - it fades within the release', () => {
  const L = hall({ lamps: [] }), P = page(L); L.light = false;
  const R = run(P, L, 6, one(300, 0), { each: t => { L.light = t >= 2 && t < 4; } });
  const pre = Math.max(...R.ks.slice(0, 120)), onAt = R.ks.findIndex((k, i) => i >= 120 && k > .05) / 60, offBy = R.ks.findIndex((k, i) => i > 240 && k === 0) / 60;
  return { ok: pre === 0 && onAt > 2 && onAt < 2.3 && R.stings === 1 && offBy > 4 && offBy < 4.7, note: `before the torch: ks ${pre}; the torch on at 2 s: onset ${onAt.toFixed(2)} s, stings ${R.stings}; off at 4 s: ks 0 by ${offBy.toFixed(2)} s` };
});
add('V06 a glimpse is not a sighting: a body flickering at a wall edge (seen one frame in two, or one frame in ten) confirms nothing - no sting, no heartbeat; a real sighting with one-frame drop-outs stings once', () => {
  const L = hall(), A = page(L), B = page(L), C = page(L);
  const a = run(A, L, 4, one(260, 0), { each: t => { L.walls = Math.round(t * 60) % 2 ? hall().walls : hall().walls.concat([{ x: 100, y: -100, w: 20, h: 200 }]); } });
  L.walls = hall().walls; const b = run(B, L, 4, one(260, 0), { each: t => { L.walls = Math.round(t * 60) % 10 ? hall().walls.concat([{ x: 100, y: -100, w: 20, h: 200 }]) : hall().walls; } });
  L.walls = hall().walls; const c = run(C, L, 4, one(260, 0), { each: t => { L.walls = Math.round(t * 60) % 30 === 29 ? hall().walls.concat([{ x: 100, y: -100, w: 20, h: 200 }]) : hall().walls; } });
  return { ok: a.max === 0 && a.stings === 0 && b.max === 0 && b.stings === 0 && c.stings === 1 && c.max > .5, note: `every other frame: ks ${a.max.toFixed(3)} stings ${a.stings} | one frame in ten: ks ${b.max.toFixed(3)} stings ${b.stings} | seen with a one-frame drop-out every 0.5 s: stings ${c.stings}, ks max ${c.max.toFixed(2)}` };
});
add('V08 a hidden sprint: a Skin-Stealer running past behind a wall (300 px a second, 120-260 px from the player) - no cue at all (its footsteps are skin.audio\'s, physical, and untouched)', () => {
  const L = hall({ walls: [{ x: -600, y: -120, w: 1400, h: 20 }, { x: -600, y: 100, w: 1400, h: 20 }] }); const P = page(L);
  const R = run(P, L, 3, t => [{ i: 7, x: -400 + 300 * t, y: 180, a: 0, s: 6, ac: 6, v: 300, h: 0 }]);
  return { ok: R.max === 0 && R.stings === 0, note: `ks max ${R.max}, stings ${R.stings} (it ran from x -400 to 500 at y 180, the hall's wall at y 100-120 between)` };
});
add('V09 a convincing disguise is never given away: the same lit body in a borrowed skin (dg) - nothing; the skin drops (its wind-up) - the cue at once (onset, one sting)', () => {
  const L = hall(), P = page(L); const look = 'cap|plain|#336699|#e6bb76';
  const R = run(P, L, 4, t => one(260, 0, t < 2 ? { dg: look } : {})());
  const pre = Math.max(...R.ks.slice(0, 120)), onAt = R.ks.findIndex((k, i) => i >= 120 && k > .05) / 60;
  return { ok: pre === 0 && onAt >= 2 && onAt < 2.3 && R.stings === 1, note: `in the skin: ks ${pre}; the skin gone at 2 s: onset ${onAt.toFixed(2)} s, stings ${R.stings}` };
});
add('V11 several in sight: three lit Skin-Stealers - one heartbeat level (the strongest, never above 1), one sting (not three); the next sting only after the gap and a real loss', () => {
  const L = hall(), P = page(L); let set = 3;
  const list = () => [one(200, 0)()[0], Object.assign(one(260, 30)()[0], { i: 8 }), Object.assign(one(320, -30)()[0], { i: 9 })].slice(0, set);
  const R = run(P, L, 16, list, { each: t => { set = t < 5 ? 3 : t < 9 ? 0 : 3; } });
  return { ok: R.max <= 1 && R.stings === 2 && R.sting[0] < .3 && R.sting[1] >= 9, note: `ks max ${R.max.toFixed(2)}; stings ${R.stings} at ${R.sting.join('/')} s (three in sight from 0 s; none 5-9 s; three again from 9 s)` };
});

/* the dread hook itself, in a VM: core/client/mp.frame.js's factory given recording stand-ins; frames driven with the same Hound and Smiler
 * moves; Math.random a fixed stream in every page, so a difference can only come from the hook */
function hook(src, withSkin, skinList) {
  const rec = []; let now = 0, rs = 1;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const L = hall(), ctx = { console, Math: Object.assign(Object.create(Math), { random: rnd }), devicePixelRatio: 1, innerWidth: 1024, innerHeight: 640,
    performance: { now: () => now }, setTimeout: (f, ms) => { rec.push(['timeout', ms]); f(); return 0; }, document: { getElementById: () => null, querySelector: () => null } };
  ctx.window = ctx; vm.createContext(ctx);
  if (withSkin) { ctx.__api = { H: L.H, lightOn: () => true, Uc: (...a) => L.Uc(...a), Ul: (...a) => L.Ul(...a) }; vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'skinstealer.js'), 'utf8'), ctx); }
  const el = () => ({ style: {} });
  const dread = el(), game = el(), light = el();
  ctx.__sfx = { play: (n, o) => { rec.push(['sfx', n, +(o && o.vol || 0).toFixed(4)]); return true; } };
  vm.runInContext(src + '\nthis.__f = mpFrame;', ctx);
  ctx.__f({ core: { cv: { width: 1024, height: 640 }, cx: { setTransform() {}, clearRect() {} }, dread, EN: () => null, game, humUpdate() {}, light },
    session: { handled: () => 0, me: () => null, mseq: () => 0, N: { on: false }, sendPose() {} }, glitch: { exited: () => false, soloGlitches() {} }, cartograph: { itemsFrame() {}, soloItems() {} },
    monsters: { applyCaught() {}, applyServerState() {}, fadeHit() {}, hitFlash: () => 0, hSlots: [], unhold() {} },
    audio: { burst: (a, b) => rec.push(['burst', +a.toFixed(4), +b.toFixed(4)]), onlineNote() {}, setDrone: k => rec.push(['drone', +k.toFixed(5)]), thump: (v, f) => rec.push(['thump', +v.toFixed(5), f]) },
    deaths: { drawPeers() {} }, admin: { previewTick() {} } });
  const p = { x: 0, y: 0, angle: 0 };
  for (let i = 0; i < 60 * 40; i++) {                                                  // 40 s: a Hound walks up and away, two Smilers drift
    const t = i / 60, G = { x: 900 - 45 * Math.min(t, 18) + 50 * Math.max(0, t - 22), y: 40 }, q = [{ x: -500 + 20 * t, y: -300 }, { x: 700, y: 400 - 10 * t }];
    now = t * 1000;
    if (withSkin && skinList) ctx.__skin.mirror(skinList(t), 1 / 60);
    ctx.__mp({ p, cam: { x: 0, y: 0 }, sc: .9, run: true, started: true, light: true, G, q, los: () => 0, t: 1 / 60 });
    rec.push(['out', dread.style.opacity, game.style.transform, light.style.opacity]);
  }
  return rec;
}
const blob = s => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(s) + '\0').update(s).digest('hex');
add('V12 no Skin-Stealer in sight, every output of the dread hook is R8\'s: 40 s of a Hound walking up and away and two Smilers drifting - thumps, drone, vignette, shake, flicker and stings frame by frame, R8\'s mp.frame.js against this tree\'s (none; one behind a wall); and with one in sight only the heartbeat and its sting differ', () => {
  const r8 = fs.readFileSync(path.join(ROOT, 'dev', 'trial-3-r9-overhaul', 'fixtures', 'mp.frame.f378049.js'), 'utf8'), now = fs.readFileSync(path.join(ROOT, 'src', 'core', 'client', 'mp.frame.js'), 'utf8');
  if (blob(r8) !== R8_FRAME_BLOB) return { ok: false, note: 'the R8 fixture is not R8\'s file (git blob ' + blob(r8) + ')' };
  const A = JSON.stringify(hook(r8, false)), B = JSON.stringify(hook(now, true, () => []));
  const C = JSON.stringify(hook(now, true, () => [{ i: 7, x: 100, y: 145, a: 0, s: 1, ac: 0, v: 0, h: 0 }]));   // just behind the hall's south wall (y 100-120)
  const D = JSON.stringify(hook(now, true, () => [{ i: 7, x: 0, y: 900, a: 0, s: 1, ac: 0, v: 0, h: 0 }]));     // out of the sight mask
  const vis = hook(now, true, () => [{ i: 7, x: 260, y: 0, a: 0, s: 1, ac: 0, v: 0, h: 0 }]), ra = hook(r8, false);
  const kinds = (rec, k) => rec.filter(r => r[0] === k).length, drone = rec => JSON.stringify(rec.filter(r => r[0] === 'drone')), outs = rec => JSON.stringify(rec.filter(r => r[0] === 'out').map(r => [r[1], r[2]]));
  const ok = A === B && A === C && A === D && kinds(vis, 'thump') > kinds(ra, 'thump') && drone(vis) === drone(ra) && outs(vis) === outs(ra);
  return { ok, note: `R8 vs this tree, no Skin-Stealer: ${A === B ? 'identical' : 'DIFFERENT'} (${JSON.parse(A).length} records: ${kinds(JSON.parse(A), 'thump')} thumps, ${kinds(JSON.parse(A), 'sfx')} stings); one behind a wall: ${A === C ? 'identical' : 'DIFFERENT'}; one far out of sight: ${A === D ? 'identical' : 'DIFFERENT'}; one in sight 260 px: thumps ${kinds(ra, 'thump')} -> ${kinds(vis, 'thump')}, stings ${kinds(ra, 'sfx')} -> ${kinds(vis, 'sfx')}, drone ${drone(vis) === drone(ra) ? 'unchanged' : 'CHANGED'}, vignette and shake ${outs(vis) === outs(ra) ? 'unchanged' : 'CHANGED'}` };
});

add('V13 one sting, not two, either way round (R16, the independent review): the Hound\'s sting falls due just after a Skin-Stealer\'s - only one plays (R10 already kept a Skin-Stealer\'s sting from doubling the Hound\'s); with no Skin-Stealer every output is R8\'s (V12)', () => {
  const now = fs.readFileSync(path.join(ROOT, 'src', 'core', 'client', 'mp.frame.js'), 'utf8');
  const at = rec => { const out = []; let f = 0; for (const r of rec) { if (r[0] === 'out') f++; else if (r[0] === 'sfx') out.push(+(f / 60).toFixed(2)); } return out; };
  const base = at(hook(now, true, () => [])), tk = base[0];                       // (when the Hound's first sting plays, with no Skin-Stealer)
  if (!(tk > 1)) return { ok: false, note: 'no Hound sting to time against: ' + JSON.stringify(base) };
  const t0 = tk - .4, rec = at(hook(now, true, t => t >= t0 ? [{ i: 7, x: 260, y: 0, a: 0, s: 1, ac: 0, v: 0, h: 0 }] : []));
  const near = rec.filter(t => t >= t0 && t <= tk + 1.2);
  return { ok: near.length === 1 && near[0] < tk, note: `the Hound's sting alone at ${base.slice(0, 3).join('/')} s; a Skin-Stealer in sight from ${t0.toFixed(2)} s: stings at ${rec.slice(0, 4).join('/')} s - ${near.length} between ${t0.toFixed(2)} and ${(tk + 1.2).toFixed(2)} s (the Skin-Stealer's)` };
});

module.exports = S;
