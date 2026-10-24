/* KILL VISIBILITY (Trial 3 R20, the owner's addendum: dev/trial-3-r20-kill-visibility/; Trial 3 is not owner-approved).  The owner saw a
 * second Skin-Stealer turn invisible while the first one's kill played.  R9-R19's page hid every Skin-Stealer within 260 px of a death's
 * source (skin.kill.js), and every page's replay hid the Hound - and the Smiler - nearest the attacker's place within 240 px
 * (mp.deaths.js).  Now each page hides a killing Skin-Stealer by the server's own id of it (the kill record's e: our own record, and a
 * Skin-Stealer's replay message, which now carries it).  On the separately authorized R20 B++ killer-id branch,
 * Hound and Smiler replays also carry e; the old nearest-within-240 fallback is removed.
 * Each check runs this tree's page code and R19 combined's (2f11eae, from git), in a VM with recorder Pixi classes and stand-ins for the
 * game around it: R19's must show the defect (the negative proof), this tree's must not.  The real pages are in
 * dev/trial-3-r20-kill-visibility/tools/rv_browser.js (REPORT.md).
 *   RV07a our own death, two Skin-Stealers beside it: the killer's own view hidden (its death draws it), the other one drawn, opaque
 *   RV07b a replay of somebody else's death (one, two at once, four Skin-Stealers): only each replay's killer hidden; and a replay without
 *         an id (an older server) hides none - never a guess
 *   RV07c a replay naming its killer with a pack-mate nearer the attacker's place than the killer's mirrored view: a Hound's hides the
 *         killer's slot, not the pack-mate's; a Smiler's the same; a Skin-Stealer's kill hides no Hound and no Smiler; a Hound's message as
 *         the server sends it (no id, B++'s) is handled as R19 did
 *   RV07d every creature's death-replay message carries a valid killer id (death_srv.js fxFor), including late joiners;
 *         only the e field is the approved B++ extension, and bad ids are omitted; own kill record's id survives the bundle taking
 *         window.__kill, and cleared with it on a new life */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const S = []; const add = (name, fn) => S.push({ name, fn });
const ROOT = path.join(__dirname, '..', '..');
const R19 = {}; const r19 = f => R19[f] || (R19[f] = execFileSync('git', ['show', '2f11eae:' + f], { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
const src = (which, f) => which === 'r19' ? r19(f) : fs.readFileSync(path.join(ROOT, f), 'utf8');

class FakeC {
  constructor() { this.children = []; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y === undefined ? x : y; } };
    this.scale = { x: 1, y: 1, set: (x, y) => { this.scale.x = x; this.scale.y = y === undefined ? x : y; } }; this.rotation = 0; this.alpha = 1; this.visible = true; }
  addChild(...c) { for (const x of c) { this.children.push(x); x.parent = this; } return c[0]; }
  addChildAt(c) { return this.addChild(c); } getChildIndex(c) { return Math.max(0, this.children.indexOf(c)); }
  removeChild(c) { this.children = this.children.filter(x => x !== c); c.parent = null; }
  destroy() { this.destroyed = true; }
}
class FakeG extends FakeC { constructor() { super(); this.clear(); } clear() { return this; } moveTo() { return this; } lineTo() { return this; } quadraticCurveTo() { return this; } ellipse() { return this; } circle() { return this; } poly() { return this; } fill() { return this; } stroke() { return this; } }
/* a page with the Skin-Stealer's script: its mirror fed two (or four) creatures, our death and the replays as given */
function skinPage(which) {
  const layer = new FakeC(), ctx = { console, Math, performance: { now: () => 0 }, innerWidth: 1024, innerHeight: 640, document: { getElementById: () => null, querySelector: () => null }, setTimeout: () => 0 };
  ctx.window = ctx; vm.createContext(ctx);
  const blood = new FakeG(); let death = { active: false, blood };   // (the script takes its Pixi classes from the layer and the death's blood)
  ctx.__api = { layer: () => layer, death: () => death, H: { x: 0, y: 0 }, lightOn: () => true, mkAvatar: () => { const a = new FakeC(); a.update = () => { }; return a; } };
  ctx.__mpLib = { wire: { parseLook: s => ({ hat: s.split('|')[0] }) } };
  ctx.__light = { mk: () => ({}), sample: () => ({ total: .8, direct: .7, dirX: -.6, dirY: -.8 }), shade: t => .1 + .9 * t, ray: () => 60 };
  vm.runInContext(src(which, 'public/dphys.js'), ctx);
  vm.runInContext(src(which, 'public/assets/skinstealer.js'), ctx);
  Object.assign(ctx.__api, { Graphics: FakeG, Container: FakeC });   // (the page's Pixi classes, as s_skinbody.js gives them)
  const K = ctx.__skin;
  const views = () => new Map(layer.children.filter(c => c.__id !== undefined).map(c => [c.__id, c]));
  const frame = list => { K.mirror(list, 1 / 60); K.draw(1 / 60); };
  return { ctx, K, layer, views, frame, setDeath: d => { death = Object.assign({ blood }, d); } };
}
const ent = (i, x, y) => ({ i, x, y, a: 0, s: 1, ac: 0, v: 0, h: 0 });
const vis = (P, id) => { const v = P.views().get(id); return v ? { visible: v.visible, alpha: +v.alpha.toFixed(2) } : null; };

add('RV07a our own death, two Skin-Stealers beside it (the killer 40 px from the victim, the other 120 px): the killer\'s own view is hidden while its kill plays and the other is drawn, opaque - R19\'s page hid both', () => {
  const out = {}, bad = [];
  for (const which of ['now', 'r19']) {
    const P = skinPage(which), list = [ent(11, 540, 500), ent(12, 440, 610)];
    for (let i = 0; i < 30; i++) P.frame(list);
    // the session's kill record (mp.js announceKill: window.__kill and, R20, window.__skin.killBy); the bundle takes window.__kill as the death begins
    P.ctx.__kill = null; P.ctx.__skin.killBy = { k: 'SkinStealer', e: 11, de: 7 };
    P.setDeath({ active: true, kind: 'SkinStealer', source: { x: 540, y: 500 }, attacker: { x: 540, y: 500, angle: Math.PI }, elapsed: .5, variant: 'A' });
    for (let i = 0; i < 30; i++) P.frame(list);
    const during = { killer: vis(P, 11), other: vis(P, 12) };
    P.setDeath({ active: false, kind: 'SkinStealer', source: { x: 540, y: 500 } }); for (let i = 0; i < 5; i++) P.frame(list);
    out[which] = { during, after: { killer: vis(P, 11), other: vis(P, 12) } };
  }
  const n = out.now, r = out.r19;
  if (!(n.during.killer.visible === false && n.during.other.visible === true && n.during.other.alpha === 1)) bad.push(`this page during: ${JSON.stringify(n.during)}`);
  if (!(n.after.killer.visible && n.after.other.visible)) bad.push(`this page after: ${JSON.stringify(n.after)}`);
  if (!(r.during.other.visible === false)) bad.push(`the negative proof: R19's page drew the other one: ${JSON.stringify(r.during)}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `this page: killer hidden, the other drawn at alpha ${n.during.other.alpha}, both back after; R19's page: the other one hidden too (${JSON.stringify(r.during.other)})`, data: out };
});

add('RV07b replays: one kill with two Skin-Stealers beside it, two kills at once among four, and a replay with no killer id - only each replay\'s own killer hidden, a replay without an id hides none (R19: every Skin-Stealer within 260 px of each source)', () => {
  const out = {}, bad = [];
  const fx = (eid, sx, sy, extra = {}) => Object.assign({ gone: false, cause: 'SkinStealer', eid, jl: { finished: false, source: { x: sx, y: sy } } }, extra);
  for (const which of ['now', 'r19']) {
    const P = skinPage(which), R = {};
    const list = [ent(21, 540, 500), ent(22, 440, 610), ent(23, 760, 520), ent(24, 690, 650)];
    for (let i = 0; i < 20; i++) P.frame(list);
    P.ctx.__fxs = [fx(21, 540, 500)]; for (let i = 0; i < 10; i++) P.frame(list); R.one = [21, 22, 23, 24].map(id => vis(P, id).visible);
    P.ctx.__fxs = [fx(21, 540, 500), fx(23, 760, 520)]; for (let i = 0; i < 10; i++) P.frame(list); R.two = [21, 22, 23, 24].map(id => vis(P, id).visible);
    P.ctx.__fxs = [fx(0, 540, 500)]; for (let i = 0; i < 10; i++) P.frame(list); R.noId = [21, 22, 23, 24].map(id => vis(P, id).visible);
    P.ctx.__fxs = [fx(21, 540, 500, { gone: true })]; for (let i = 0; i < 10; i++) P.frame(list); R.done = [21, 22, 23, 24].map(id => vis(P, id).visible);
    P.ctx.__fxs = [fx(21, 1100, 500)]; for (let i = 0; i < 10; i++) P.frame(list); R.away = vis(P, 21).visible;   // (the review's backstop: a killer 560 px from its kill is not on it)
    out[which] = R;
  }
  const n = out.now, r = out.r19, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!eq(n.one, [false, true, true, true]) || !eq(n.two, [false, true, false, true]) || !eq(n.noId, [true, true, true, true]) || !eq(n.done, [true, true, true, true]) || n.away !== true) bad.push(`this page: ${JSON.stringify(n)}`);
  if (!(r.one[1] === false && r.two.filter(x => !x).length === 4)) bad.push(`the negative proof: R19's page ${JSON.stringify(r)}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `visible [21 killer, 22, 23, 24]: one replay ${JSON.stringify(n.one)}, two at once ${JSON.stringify(n.two)}, no id ${JSON.stringify(n.noId)}, done ${JSON.stringify(n.done)}, its killer 560 px from the kill drawn: ${n.away} | R19's page: one ${JSON.stringify(r.one)}, two ${JSON.stringify(r.two)}, no id ${JSON.stringify(r.noId)}`, data: out };
});

/* G.I.B.'s replay module (mp.deaths.js) in a VM: its startFx given the server's message, with the Hound slots and Smiler slots as the
 * monsters mirror holds them; what it marks to hide */
function deathsModule(which) {
  const file = 'src/frameworks/gib/client/mp.deaths.js', code = src(which, file);
  const layer = new FakeC(), ctx = { console, Math, performance: { now: () => 1000 }, window: null };
  ctx.window = ctx; vm.createContext(ctx);
  class Jl { constructor() { this.blood = new FakeC(); this.foreground = new FakeC(); this.debris = new FakeC(); this.ph = null; } start(k, now, src) { this.source = src; this.kind = k; } }
  ctx.__api = { layer: () => layer, floor: () => new FakeC(), mkAvatar: () => new FakeC(), Jl, Gl: FakeC, Wl: FakeC, q: [] };
  vm.runInContext(code + '\n;window.__gibDeaths = gibDeaths;', ctx);
  const hMap = new Map(), sSlot = Array(64).fill(null);
  const M = ctx.__gibDeaths({ core: { cx: () => null, EN: () => null, NET: {}, parseLook: () => ({ hat: 'cap' }), partObj: () => ({}), PEER_MODE: 'bplus', toRec: x => x },
    session: { myId: () => 99, N: { on: true }, peers: new Map(), tellId: () => { } }, monsters: { angDiff: (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)), hMap, sSlot }, wanderers: { hoverTip: () => { }, mx: () => 0, my: () => 0 } });
  return { ctx, M, hMap, sSlot };
}
const fxMsg = (c, e, sx, sy, de) => ({ t: 'fx', k: 'death', id: 7, c, e, x: 500, y: 500, a: 0, sx, sy, v: 'A', w: 0, lk: 'cap', ek: 'flashlight', de });

add('RV07c a replay naming its killer, with a pack-mate nearer the attacker\'s place than the killer\'s mirrored view: a Hound\'s hides the killer\'s slot, not the pack-mate\'s (R19: the pack-mate\'s); a Smiler\'s the same; a Skin-Stealer\'s kill hides no Hound or Smiler; a Hound\'s message as the server sends it (no id: B++\'s) is handled exactly as at R19', () => {
  const out = {}, bad = [];
  for (const which of ['now', 'r19']) {
    const D = deathsModule(which), R = {};
    D.hMap.set(31, { id: 31, slot: 0, x: 600, y: 500 }); D.hMap.set(32, { id: 32, slot: 1, x: 552, y: 506 });   // the killer (31) mirrored 54 px back; its pack-mate (32) 8 px from the attack
    D.ctx.__api.q = [{ x: 610, y: 500, off: false }, { x: 548, y: 503, off: false }]; D.sSlot[0] = 41; D.sSlot[1] = 42;
    D.M.startFx(fxMsg('Hound', 31, 546, 500, 1)); let f = D.ctx.__fxs[D.ctx.__fxs.length - 1]; R.hound = [f.kill.h, f.kill.s];
    D.M.startFx(Object.assign(fxMsg('Smiler', 41, 546, 500, 2), { id: 8 })); f = D.ctx.__fxs[D.ctx.__fxs.length - 1]; R.smiler = [f.kill.h, f.kill.s];
    D.M.startFx(Object.assign(fxMsg('SkinStealer', 55, 546, 500, 3), { id: 9 })); f = D.ctx.__fxs[D.ctx.__fxs.length - 1]; R.skin = [f.kill.h, f.kill.s, f.eid];
    D.M.startFx(Object.assign(fxMsg('Hound', undefined, 546, 500, 4), { id: 10 })); f = D.ctx.__fxs[D.ctx.__fxs.length - 1]; R.houndNoId = [f.kill.h, f.kill.s];
    out[which] = R;
  }
  const n = out.now, r = out.r19, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!eq(n.hound, [0, -1]) || !eq(n.smiler, [-1, 0]) || !eq(n.skin, [-1, -1, 55])) bad.push(`this tree: ${JSON.stringify(n)}`);
  if (!eq(n.houndNoId, [-1, -1])) bad.push(`a missing-id Hound replay must not hide a bystander: ${JSON.stringify(n.houndNoId)}`);
  if (!(r.hound[0] === 1 && r.smiler[1] === 1)) bad.push(`the negative proof: R19 ${JSON.stringify(r)}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `killer's ID wins over closer pack-mate (Hound ${JSON.stringify(n.hound)}, Smiler ${JSON.stringify(n.smiler)}), Skin-Stealer untouched; missing-id Hound hides none ${JSON.stringify(n.houndNoId)}; R19 nearest incorrectly hid pack-mate ${JSON.stringify(r.hound)}`, data: out };
});

add('RV07d all death replay species carry the authoritative killer id (fxFor e; aftSend late joiners), bad ids omitted; own kill id survives window.__kill until cleared', () => {
  const bad = [], D = require(path.join(ROOT, 'src', 'frameworks', 'gib', 'server', 'death_srv.js'));
  const kill = k => ({ k, v: 'A', e: 17, ax: 10, ay: 20, x: 30, y: 40, a: 0, w: 0 }), info = { look: 'cap', ek: 'flashlight', ec: '#fff', ep: '', vx: 0, vy: 0, ex: 0 };
  const B19 = 't,k,id,c,x,y,a,sx,sy,v,w,lk,ek,ec,ep,vx,vy,ex,srv';                                  // (R19's fxFor: the B++ key order)
  const keys = k => Object.keys(D.fxFor(5, kill(k), info)).join(','), es = D.fxFor(5, kill('SkinStealer'), info).e;
  if (es !== 17 || keys('SkinStealer') !== 't,k,id,c,e,x,y,a,sx,sy,v,w,lk,ek,ec,ep,vx,vy,ex,srv') bad.push(`a Skin-Stealer's message: e ${es}, keys ${keys('SkinStealer')}`);
  const R20 = B19.replace('t,k,id,c,x', 't,k,id,c,e,x');
  if (keys('Hound') !== R20 || keys('Smiler') !== R20) bad.push(`an approved Hound/Smiler replay must add ONLY e: ${keys('Hound')} / ${keys('Smiler')}`);
  for (const k of ['Hound', 'Smiler', 'SkinStealer']) if ('e' in D.fxFor(5, { ...kill(k), e: 0 }, info) || 'e' in D.fxFor(5, { ...kill(k), e: 'wrong' }, info)) bad.push(`an invalid ${k} ID was sent`);
  if ('e' in D.fxFor(5, Object.assign(kill('SkinStealer'), { e: 'x' }), info)) bad.push('a bad id is sent');
  const aft = fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'gib', 'server', 'aftermath.js'), 'utf8');
  if (!/fx = Object\.assign\(deathSrv\.fxFor\(c\.id, kill, info\)/.test(aft) || !/Object\.assign\(\{\}, a\.fxMsg, \{ el:/.test(aft)) bad.push('aftermath no longer sends fxFor\'s message (with el) to a late joiner');
  // the session's side (mp.monsters.js): announceKill keeps the id; the bundle's taking of window.__kill leaves it; clearKill clears it
  const ctx = { console, Math, performance: { now: () => 5 }, __skin: {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'frameworks', 'nani', 'client', 'mp.monsters.js'), 'utf8') + '\n;window.__nm = naniMonsters;', ctx);
  const NM = ctx.__nm({ core: { EN: () => null, NET: {}, netPose: () => null }, session: { cpNow: () => 0, graceUntil: () => 0, N: {}, snap: () => null }, glitch: { glitchesFrom: () => { } }, cartograph: { itemsFrom: () => { } } });
  NM.announceKill({ k: 'SkinStealer', e: 17, de: 3 }); ctx.__kill = null;   // (the bundle's beginDeath)
  const kept = ctx.__skin.killBy && ctx.__skin.killBy.e === 17; NM.clearKill(); const cleared = ctx.__skin.killBy === null;
  if (!kept || !cleared) bad.push(`killBy kept ${kept}, cleared ${cleared}`);
  if ('__killBy' in ctx) bad.push('a new window name');
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `all Hound, Smiler and Skin-Stealer death FX add only an authoritative e (keys ${R20}); invalid IDs omitted, late replay transport preserved; own kill id retained and cleared` };
});

module.exports = S;
