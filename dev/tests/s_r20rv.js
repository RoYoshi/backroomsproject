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
 *         killer's slot, not the pack-mate's; a Smiler's the same; a Skin-Stealer's kill hides no Hound and no Smiler; a Hound's message
 *         without an id (an older server) hides none
 *   RV07d every creature's death-replay message carries a valid killer id (death_srv.js fxFor), including late joiners;
 *         only the e field is the approved B++ extension, and bad ids are omitted; own kill record's id survives the bundle taking
 *         window.__kill, and cleared with it on a new life
 *   RV07e replays over time (G.I.B.'s own per-frame updateFx) while snapshots change the mirror under them: a killer mirrored late, its
 *         slot reused, a killer 400 px or more away, a Smiler re-slotted, two replays at once, an id of the other species
 *   RV07f our own Hound death (N.A.N.I.'s markKiller and applyServerState): the killer's slot is followed by its id when the slots change
 *         hands during the death; a kill record whose killer has no mirror keeps B++'s nearest guess (a pinned B++ client behaviour) until
 *         the killer is mirrored; a reconnect forgets the old server's id */
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

add('RV07c a replay naming its killer, with a pack-mate nearer the attacker\'s place than the killer\'s mirrored view: a Hound\'s hides the killer\'s slot, not the pack-mate\'s (R19: the pack-mate\'s); a Smiler\'s the same; a Skin-Stealer\'s kill hides no Hound or Smiler; a Hound\'s message without an id (an older server) hides none (R19: the Hound nearest the attacker\'s place)', () => {
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

/* (the B++ killer-identity branch) G.I.B.'s replay module over time: its startFx and then its own per-frame updateFx (exposed in the VM
 * only), with the monsters mirror changing under it as snapshots change it - what each frame hides (window.__fxKill / __fxKillS) */
function deathsFrames(which) {
  const file = 'src/frameworks/gib/client/mp.deaths.js', code = src(which, file).replace('return { applyBodies,', 'window.__updateFx = updateFx; return { applyBodies,');
  if (!/window\.__updateFx = updateFx/.test(code)) throw new Error('mp.deaths.js: its return is not where expected');
  const layer = new FakeC(), clock = { t: 1000 }, ctx = { console, Math, performance: { now: () => clock.t * 1000 }, window: null };
  ctx.window = ctx; vm.createContext(ctx);
  class Av extends FakeC { update() { } deathPose() { } }
  class Att extends FakeC { attackPose() { } }
  class Jl { constructor() { this.blood = new FakeC(); this.foreground = new FakeC(); this.debris = new FakeC(); this.ph = null; this.body = { x: 500, y: 500, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 }; this.attacker = { x: 0, y: 0, angle: 0 }; this.elapsed = 0; this.done = false; }
    start(k, now, src) { this.source = src; this.kind = k; this.t0 = now; this.attacker = { x: src.x, y: src.y, angle: 0 }; } frame(now) { this.elapsed = now - this.t0; return this.done || this.elapsed > 4; } }
  ctx.__api = { layer: () => layer, floor: () => new FakeC(), mkAvatar: () => new Av(), Jl, Gl: Att, Wl: Att, q: [] };
  vm.runInContext(code + '\n;window.__gibDeaths = gibDeaths;', ctx);
  const hMap = new Map(), sSlot = Array(64).fill(null);
  const M = ctx.__gibDeaths({ core: { cx: () => null, EN: () => ({ attackSmiler: () => { } }), NET: {}, parseLook: () => ({ hat: 'cap' }), partObj: () => ({}), PEER_MODE: 'bplus', toRec: x => x },
    session: { myId: () => 99, N: { on: true }, peers: new Map(), tellId: () => { } }, monsters: { angDiff: (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)), hMap, sSlot }, wanderers: { hoverTip: () => { }, mx: () => 0, my: () => 0 } });
  const frame = (dt = 1 / 60) => { clock.t += dt; ctx.__updateFx(clock.t); return { h: [...ctx.__fxKill].sort(), s: [...ctx.__fxKillS].sort() }; };
  return { ctx, M, hMap, sSlot, frame, clock };
}
const hound = (D, id, slot, x, y) => D.hMap.set(id, { id, slot, x, y });
add('RV07e replays over time, as snapshots change the mirror under them: a killer mirrored only after its replay began is hidden from then on; its slot reused by another Hound hides that one never; a killer 400 px or more from its kill is drawn; a Smiler moved to another slot is followed; two Hound replays at once each hide their own; an id of the other species hides nothing; a killer mirrored when its replay begins, then gone and its slot given to a pack-mate beside the kill, hides that pack-mate never (R19: the Hound or Smiler nearest the attacker\'s place, whichever it is)', () => {
  const out = {}, bad = [];
  for (const which of ['now', 'r19']) {
    const D = deathsFrames(which), R = {}, q = (i, x, y) => { D.ctx.__api.q[i] = { x, y, off: false }; };
    for (let i = 0; i < 4; i++) D.ctx.__api.q[i] = { x: -9e4, y: -9e4, off: true };
    // (a) the replay arrives before the snapshot that mirrors its killer (a late joiner's first frames)
    D.M.startFx(Object.assign(fxMsg('Hound', 31, 546, 500, 11), { id: 7 }));
    R.before = D.frame().h; hound(D, 31, 0, 552, 503); R.mirrored = D.frame().h;
    // (b) the killer leaves (its slot freed) and a pack-mate is mirrored into the same slot, beside the kill
    D.hMap.delete(31); hound(D, 32, 0, 560, 510); R.reused = D.frame().h;
    // (b2) a killer mirrored when its replay begins (36, slot 0); it goes, and pack-mate 37 takes slot 0 beside the kill
    D.hMap.clear(); hound(D, 36, 0, 552, 503); D.M.startFx(Object.assign(fxMsg('Hound', 36, 546, 500, 17), { id: 13 })); const ra = D.frame().h;
    D.hMap.delete(36); hound(D, 37, 0, 556, 506); R.reusedAfter = [ra, D.frame().h]; for (const f of D.ctx.__fxs) f.end = true; D.frame();
    // (c) a fresh replay whose killer is mirrored 520 px from its kill (it has gone on: no longer on it)
    D.hMap.clear(); hound(D, 33, 1, 1066, 500); D.M.startFx(Object.assign(fxMsg('Hound', 33, 546, 500, 12), { id: 8 })); R.far = D.frame().h;
    // (d) two Hound replays at once, the killers 33 (moved back beside its kill) and 34
    D.hMap.get(33).x = 560; hound(D, 34, 2, 900, 900); D.M.startFx(Object.assign(fxMsg('Hound', 34, 905, 905, 13), { id: 9 })); R.two = D.frame().h;
    // (e) a Smiler's replay; its killer 41 moves from slot 0 to slot 2 (the mirror re-slotted it), slot 0 taken by Smiler 42 beside the kill
    q(0, 600, 300); D.sSlot[0] = 41; D.M.startFx(Object.assign(fxMsg('Smiler', 41, 605, 305, 14), { id: 10 })); R.smiler = D.frame().s;
    D.sSlot[0] = 42; D.sSlot[2] = 41; q(2, 610, 300); R.smilerMoved = D.frame().s;
    // (f) the other species' id: a Hound replay naming Smiler 41's id, a Smiler replay naming Hound 32's
    D.hMap.clear(); hound(D, 32, 3, 600, 300); for (const f of D.ctx.__fxs) f.end = true; D.frame();
    D.M.startFx(Object.assign(fxMsg('Hound', 41, 600, 300, 15), { id: 11 })); D.M.startFx(Object.assign(fxMsg('Smiler', 32, 600, 300, 16), { id: 12 })); R.cross = D.frame();
    out[which] = R;
  }
  const n = out.now, r = out.r19, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const want = { before: [], mirrored: [0], reused: [], reusedAfter: [[0], []], far: [], two: [1, 2], smiler: [0], smilerMoved: [2], cross: { h: [], s: [] } };
  for (const k of Object.keys(want)) if (!eq(n[k], want[k])) bad.push(`${k}: ${JSON.stringify(n[k])}, wanted ${JSON.stringify(want[k])}`);
  if (!(eq(r.reusedAfter[1], [0]) && eq(r.smilerMoved, [0]))) bad.push(`the negative proof: R19 ${JSON.stringify(r)}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `hidden Hound slots / Smiler slots, frame by frame - this tree: ${JSON.stringify(n)} | R19: ${JSON.stringify(r)}`, data: out };
});

/* N.A.N.I.'s monsters module in a VM: its applyServerState fed snapshots, with the session's tick calling markKiller as our death begins */
function monstersPage(which) {
  const ctx = { console, Math, performance: { now: () => 5000 }, __skin: null }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src(which, 'src/frameworks/nani/client/mp.monsters.js') + '\n;window.__nm = naniMonsters;', ctx);
  let S = { h: [], m: [] };
  const E = { slotH: (o, t) => { o.x = t.x; o.y = t.y; }, slotS: (o, t) => { o.x = t.x; o.y = t.y; } };
  ctx.__api = { H: { x: 500, y: 500 }, G: { caught: false }, q: Array.from({ length: 8 }, () => ({ x: -9e4, y: -9e4, off: true })), V: {} };
  const NM = ctx.__nm({ core: { EN: () => E, NET: {}, netPose: () => null }, session: { cpNow: () => 0, graceUntil: () => 0, N: {}, snap: () => S }, glitch: { glitchesFrom: () => { } }, cartograph: { itemsFrom: () => { } } });
  const snapH = list => { S = { h: list.map(([i, x, y]) => ({ i, x, y, a: 0 })), m: [] }; NM.applyServerState(1 / 60); };
  const slotOf = id => { const o = NM.hMap.get(id); return o ? o.slot : -1; };
  const die = k => { if (k) NM.announceKill(k); ctx.__api.G.caught = true; NM.markKiller(ctx.__api, 'Hound'); };
  const live = () => { ctx.__api.G.caught = false; NM.clearKiller(); NM.clearKill(); };
  return { ctx, NM, snapH, slotOf, die, live, killer: () => ctx.__killer };
}
add('RV07f our own Hound death: two Hounds, the farther one the killer, hides the farther one; the killer is followed by its id while the slots change hands during the death - a pack-mate given the killer\'s old slot stays drawn (R19: hidden, and the killer drawn twice once it is back in another slot); a kill record whose killer has no mirror keeps B++\'s guess, the nearest (the C3c client scene c3c_misc holds it), until the killer is mirrored: then the killer is hidden (R19: the guess, all death long); a reconnect forgets the old server\'s id', () => {
  const out = {}, bad = [];
  for (const which of ['now', 'r19']) {
    const P = monstersPage(which), R = {};
    // (a) two Hounds beside us, the farther one (31, 60 px) the killer, the pack-mate (32) 20 px away
    P.snapH([[31, 560, 500], [32, 520, 500]]); P.die({ k: 'Hound', e: 31, v: 'A', de: 1 }); R.farther = { killer: P.killer(), slot31: P.slotOf(31), slot32: P.slotOf(32) };
    P.snapH([[31, 560, 500], [32, 520, 500]]); R.fartherNext = P.killer(); P.live();
    // (b) a kill record naming Hound 33, which this page has not mirrored; Hound 32 beside us
    P.snapH([[32, 520, 500]]); P.die({ k: 'Hound', e: 33, v: 'A', de: 2 }); R.unmirrored = P.killer(); P.snapH([[32, 520, 500]]); R.unmirroredNext = P.killer(); P.live();
    // (c) killer 34 in slot 0 (32 gone); mid-death it leaves the snapshot, then Hound 35 is mirrored into its slot 0; then 34 comes back
    P.snapH([[34, 540, 500]]); P.die({ k: 'Hound', e: 34, v: 'A', de: 3 }); R.start = { killer: P.killer(), slot34: P.slotOf(34) };
    P.snapH([]); R.gone = P.killer(); P.snapH([[35, 530, 500]]); R.reused = { killer: P.killer(), slot35: P.slotOf(35) };
    P.snapH([[35, 530, 500], [34, 540, 500]]); R.back = { killer: P.killer(), slot34: P.slotOf(34) }; P.live();
    // (e) the kill record names Hound 38, not yet mirrored; pack-mate 32 beside us; 38 is mirrored in the next snapshot
    P.snapH([[32, 520, 500]]); P.die({ k: 'Hound', e: 38, v: 'A', de: 4 }); const g0 = P.killer(), s32 = P.slotOf(32); P.snapH([[32, 520, 500], [38, 545, 500]]); R.late = { guess: g0, slot32: s32, killer: P.killer(), slot38: P.slotOf(38) };
    P.snapH([[32, 520, 500]]); R.lateGone = P.killer();
    // (f) the connection closes mid-death (the session clears the slots); the new server's Hound 38 is another creature
    P.NM.clearSlots(); P.snapH([[38, 900, 900], [39, 520, 500]]); R.reconnect = { killer: P.killer(), slot38: P.slotOf(38) }; P.live();
    // (d) no kill record at all (B++'s guess is kept: the nearest)
    P.snapH([[36, 700, 500], [37, 510, 500]]); P.die(null); R.noRecord = { killer: P.killer(), nearest: P.slotOf(37) };
    out[which] = R;
  }
  const n = out.now, r = out.r19;
  if (n.farther.killer !== n.farther.slot31 || n.fartherNext !== n.farther.slot31) bad.push(`the farther killer: ${JSON.stringify(n.farther)} next ${n.fartherNext}`);
  if (n.unmirrored !== 1 || n.unmirroredNext !== 1) bad.push(`an unmirrored killer: B++'s nearest (slot 1) wanted, got ${n.unmirrored} / ${n.unmirroredNext}`);
  if (n.start.killer !== n.start.slot34 || n.gone !== -1 || n.reused.slot35 !== n.start.slot34 || n.reused.killer !== -1 || n.back.killer !== n.back.slot34 || n.back.slot34 === n.reused.slot35) bad.push(`slot churn: ${JSON.stringify([n.start, n.reused, n.back])}`);
  if (n.noRecord.killer !== n.noRecord.nearest) bad.push(`no record: ${JSON.stringify(n.noRecord)}`);
  if (n.late.guess !== n.late.slot32 || n.late.killer !== n.late.slot38 || n.lateGone !== -1) bad.push(`a killer mirrored after its record: ${JSON.stringify(n.late)}, gone ${n.lateGone}`);
  if (n.reconnect.killer === n.reconnect.slot38) bad.push(`after a reconnect the new server's Hound 38 was hidden: ${JSON.stringify(n.reconnect)}`);
  if (!(r.reused.killer === r.reused.slot35 && r.back.killer !== r.back.slot34 && r.late.killer !== r.late.slot38)) bad.push(`the negative proof: R19 ${JSON.stringify(r)}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `window.__killer - this tree: ${JSON.stringify(n)} | R19: ${JSON.stringify(r)}`, data: out };
});

module.exports = S;
