/** @part public/mp.js - G.I.B.: deaths and bodies on this page: our own death's record, everyone's bodies, other players' deaths replayed, the dying lights, the wall stains, the other Wanderers drawn; a module: gibDeaths
 * A module (continuation C3c, M-024): M8's three G.I.B. parts in their order - mp.owndeath.js (our own death from the server's kill
 * record, window.__dvic), mp.bodies.js (everyone's bodies) and mp.replays.js (the replays, the light timeline, the wall stains, and the
 * drawing of the other Wanderers) - in one factory, sharing their state as plain variables: our own death and the kill record's arrival,
 * which S.P.A.C.E.'s world epoch and B++'s transport wrote at M8; the server's bodies (bodiesList, core's at M8, set by the transport);
 * the last view (BR-R's at M8). What the session did to this state at M8 - a death's or a corpse's message, a kill record, the epoch, a
 * closed connection, hiding our own corpse - it now asks for, through the functions at the end (each M8's lines). It reads the session's
 * myId() and peers, N.A.N.I.'s hound slots and angDiff, BR-R's mouse position (mx(), my()), and BR-R shows the hover name (hoverTip).
 * imports: core { cx EN NET parseLook partObj PEER_MODE toRec }, session { myId N peers tellId }, monsters { angDiff hMap sSlot },
 *          wanderers { hoverTip mx my }
 * exports: applyBodies, drawPeers, endAllFx, flushSt, forgetOwnDeath, fxMsg, hideCorpse, killNoted, noPeerLights, oldLights, showCorpse,
 *          startFx, takeBodies
 * provides: gibDeaths
 * uses: -
 * writes: -
 */
function gibDeaths({ core: { cx, EN, NET, parseLook, partObj, PEER_MODE, toRec }, session: { myId, N, peers, tellId }, monsters: { angDiff, hMap, sSlot }, wanderers: { hoverTip, mx, my } }) {
/* where the kill animation left the attacker (its world position and heading), so the server's hound carries on from there instead of popping back */
/* Stage 3D: our own death starts from the server's kill record (the bundle's death class asks for it): the position, facing, speed and
 * exhaustion the server decided the death with, as it sent them - so our death, every spectator's replay and the server's corpse are one
 * physical run.  Only a record that came with a death id; anything else (offline play) uses the player as before. */
let ownDeath = null, mkAt = null;                    // Stage 3D HQ1: our own latest death (its id, when it began here - when its kill record arrived; offline: a local key; the light's profile) - wall stains, its light
window.__dvic = K => { const A = window.__api; ownDeath = { de: K && K.de != null ? K.de : 'L' + Math.round(performance.now()), t0: K && K.de != null && mkAt && mkAt.de === K.de ? mkAt.t : performance.now() / 1000, lf: K && Array.isArray(K.lf) ? K.lf : null, srv: !!(K && K.de != null), rel: null };
  if (!K || K.de == null || !A || !Number.isFinite(K.x) || !Number.isFinite(K.y)) return null;
  return { x: K.x, y: K.y, angle: +K.a || 0, vx: K.vx || 0, vy: K.vy || 0, exhausted: !!K.ex, stamina: undefined, equipment: A.H.equipment }; };
/* ---------- everyone's bodies (one per player) ---------- */
let bodiesList = [];                              // corpses from the server (everyone's, one per player)
const hasBody = id => bodiesList.some(b => b.k === id);
function applyBodies() { tellId(); const A = window.__api; if (A && A.bodies) A.bodies(bodiesList.map(toRec)); }   // (C3c: the session tells the game our network id first, as this line did)

/* ---------- other players' deaths and vanishings, replayed for everybody in line of sight ---------- */
const fxs = window.__fxs = [];
const fxActive = id => fxs.some(f => f.id === id && !f.gone);
window.__hideBodies = new Set(); window.__fxKill = new Set(); window.__fxKillS = new Set();
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function killFx(f) {
  f.gone = true;
  for (const x of [f.av, f.jl && f.jl.blood, f.jl && f.jl.foreground, f.jl && f.jl.debris, f.att, f.gib]) { if (!x) continue; try { x.parent && x.parent.removeChild(x); x.destroy({ children: true }); } catch { } }
  window.__hideBodies.delete('r' + f.id);
}
/* Match the server's killer by ID, not proximity to a bystander.  Re-resolve per frame:
 * mirror slots can change while a replay is running or when a late client joins.
 * A 400 px sanity bound prevents an old replay from hiding a distant, reused mirror. */
function replayKillerSlots(f, A) {
  const none = { h: -1, s: -1 };
  if (!f.eid || !f.killAt || !Number.isFinite(f.killAt.x) || !Number.isFinite(f.killAt.y)) return none;
  const close = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    Math.hypot(p.x - f.killAt.x, p.y - f.killAt.y) < 400;
  if (f.cause === 'Hound') {
    const h = hMap.get(f.eid);
    return close(h) && Number.isSafeInteger(h.slot) && h.slot >= 0 ? { h: h.slot, s: -1 } : none;
  }
  if (f.cause === 'Smiler') {
    const i = sSlot.indexOf(f.eid), m = i >= 0 && (A.q || [])[i];
    return i >= 0 && close(m) && !m.off ? { h: -1, s: i } : none;
  }
  return none;
}
function startFx(m) {
  const A = window.__api, layer = A && A.layer && A.layer(); if (!A || !layer || !A.mkAvatar || !A.Jl || (m.id === myId() && m.k !== 'boom')) return;   // (Stage 3D HQ2: our own NEW RUN blast plays here too: our short beat shows it)
  if (m.k === 'end') { for (const f of fxs) if (f.id === m.id && (m.de == null || f.de === m.de)) f.end = true; return; }   // Stage 3D: an admin revive undid it
  if (m.de != null && fxs.some(f => f.de === m.de && !f.gone)) return;           // Stage 3D: one death plays once
  for (const f of fxs) if (f.id === m.id) f.end = true;                          // a newer event for the same player replaces the older one
  const look = parseLook(m.lk), gear = { kind: m.ek || 'flashlight', color: m.ec || '#ffe7b2', parts: {} }; gear.parts[gear.kind] = partObj(gear.kind, m.ep);
  const now = performance.now() / 1000 - Math.max(0, Math.min(10, +m.el || 0)), av = A.mkAvatar(look, gear); av.__key = m.id; av.__cause = m.c; layer.addChild(av);   // el: a late joiner sees it from where it is
  const pe = peers.get(m.id), f = { id: m.id, de: m.de, k: m.k, t0: now, av, look, gear, src: { x: m.x, y: m.y, angle: m.a, vx: 0, vy: 0, distance: 0 }, old: bodiesList.find(b => b.k === m.id), lf: Array.isArray(m.lf) ? m.lf : null,
    lo: m.lo != null ? !!m.lo : !!(pe && pe.l) };                              // was their light on when they died (the server says so since 3D; else their last snapshot)
  if (m.k === 'death') {
    const jl = new A.Jl(); jl.start(m.c === 'Smiler' || m.c === 'SkinStealer' ? m.c : 'Hound', now, { x: m.sx, y: m.sy }, -1, { x: m.x, y: m.y, angle: m.a, equipment: gear, hat: look.hat, vx: m.vx || 0, vy: m.vy || 0, ex: m.ex ? 1 : 0 }, { v: m.v, w: m.w });
    f.jl = jl; A.floor().addChild(jl.blood); layer.addChild(jl.foreground, jl.debris);
    if (!(+m.el > .3) && EN() && EN().deathVoice) EN().deathVoice(m.c, m.x, m.y, jl.ph && jl.ph.ctx ? jl.ph.ctx.hits.slice() : null);   // Stage 3D: heard where it happens
    f.att = m.c === 'Smiler' ? new A.Gl({ x: m.sx, y: m.sy, angle: 0, state: 'ATTACKING', off: false, side: 0 }) : m.c === 'SkinStealer' && window.__skin ? window.__skin.attacker() : new A.Wl(); layer.addChild(f.att);   // (Trial 3: the Skin-Stealer's own attacker, which poses itself in attackPose)
    f.cause = m.c; f.kill = { h: -1, s: -1 };                                    // hide the real monster that made the kill while its attack replays
    // R20 B++ exception: use only the server's killer entity ID, never a nearest-creature guess.
    // If the ID is absent/invalid or the snapshot has not arrived, hide no mirrored entity.
    f.eid = Number.isSafeInteger(m.e) && m.e > 0 ? m.e : 0;
    f.killAt = { x: m.sx, y: m.sy };
    f.kill = replayKillerSlots(f, A);
    window.__hideBodies.add('r' + m.id);
  } else if (m.k === 'boom') {                                                     // Stage 3D HQ2: a NEW RUN blast - the server's event, its seed and direction; no attacker
    const d = +m.d || 0, jl = new A.Jl(); jl.start('Boom', now, { x: m.x - Math.cos(d), y: m.y - Math.sin(d) }, -1, { x: m.x, y: m.y, angle: m.a, equipment: gear, hat: look.hat, vx: m.vx || 0, vy: m.vy || 0, ex: 0 }, { v: 'A', s: m.s, d });
    if (!jl.ph) { killFx(f); return; }                                             // (the blast is physics only: never the scripted fallback)
    f.gib = jl.ph.gib && window.__gore && window.__gore.gibs ? new (jl.foreground.constructor)() : null;   // Stage 3D HQ3: the pieces and the hands, drawn from the physics every frame (the whole avatar is never shown)
    f.jl = jl; A.floor().addChild(jl.blood); layer.addChild(jl.foreground); if (f.gib) { layer.addChild(f.gib); av.visible = false; } layer.addChild(jl.debris);
    if (!(+m.el > .3) && EN() && EN().boomVoice) EN().boomVoice(m.x, m.y);        // heard once, where it happens (a late joiner does not hear it)
    f.cause = 'Boom'; f.att = null; f.kill = { h: -1, s: -1 };
    window.__hideBodies.add('r' + m.id);
  }
  fxs.push(f);
}
/* Stage 3D HQ3: a NEW RUN's gibs on this screen - the replay's own physics (the server's seed: the same pieces everywhere), drawn by
 * gore.js; redrawn only while something moves (once all is at rest the picture is left as it is), darkened toward a corpse's colour
 * over the blast so the corpse that takes over looks the same */
function gibFrame(f, jl) {
  const S = jl.ph, G = window.__gore; if (!S || !S.gib || !G) return;
  const shapes = f.gibShapes || (f.gibShapes = S.rendShapes || window.__dphys.gibShapes(S.ctx.seed)), dead = sm(.5, 2.6, jl.elapsed);   // (R15: a rend's own two halves)
  const key = (S.state === 'SLEEPING' ? 'rest' : S.stepN) + ':' + Math.round(dead * 20); if (f.gibKey === key) return; f.gibKey = key;
  f.gib.clear();
  G.gibs(f.gib, S.gib.map((g, i) => ({ x: g.x, y: g.y, rot: g.rot, z: g.z, poly: shapes[i].poly, core: shapes[i].core })), S.h.map(h => ({ x: h.x, y: h.y, rot: h.rot, z: h.z })), f.look, { dead, eqKind: f.gear && f.gear.kind });
}
function updateFx(now) {
  const A = window.__api; window.__fxKill.clear(); window.__fxKillS.clear();
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], t = now - f.t0;
    if (f.end || !A) { killFx(f); fxs.splice(i, 1); continue; }
    if (f.k === 'vanish') {
      f.av.update(now, false, false, f.src); f.av.gear.visible = false;
      const v = Math.min(1, t / 2.7), s = sm(.22, .95, v), fl = Math.sin(now * 47) > .55 && v > .35 && v < .9 ? .35 : 0;
      f.av.alpha = Math.max(0, 1 - s - fl * (1 - s)); f.av.scale.set(1 - .06 * s); f.av.x += Math.sin(now * 61) * (1 - s) * s * 4;
      if (t > 2.8) { killFx(f); fxs.splice(i, 1); }
      continue;
    }
    const jl = f.jl, done = jl.frame(now), b = jl.body;
    if (!f.gib && jl.ph && jl.ph.rent && window.__gore && window.__gore.gibs && f.av && f.av.parent) { f.gib = new (jl.foreground.constructor)(); f.av.parent.addChildAt(f.gib, f.av.parent.getChildIndex(f.av)); }   // R15: the Rend - from its moment, two halves where the body was
    if (f.gib) { f.av.visible = false; gibFrame(f, jl); }                          // Stage 3D HQ3: a gibbed NEW RUN: no whole body from the first frame on
    else {
    f.av.update(now, false, false, f.src);
    f.av.position.set(b.x, b.y); f.av.rotation = b.angle; f.av.scale.set(b.scaleX, b.scaleY); f.av.alpha = b.alpha; f.av.deathPose(jl.injury, jl.impact, jl.elapsed > .24, jl);
    }
    if (f.att) {                                                                   // (a NEW RUN blast has no attacker)
      f.att.visible = !done; f.att.position.set(jl.attacker.x, jl.attacker.y); f.att.rotation = jl.attacker.angle + Math.PI / 2; f.att.alpha = 1;
      if (f.cause === 'Smiler') { f.att.scale.set(1 + sm(.3, 1.7, jl.elapsed) * .9); if (EN()) EN().attackSmiler(f.att, now, 1 / 60); } else f.att.attackPose(jl.grip, jl.impact, jl.variant, jl);
    }
    if (!done) {
      if (f.k === 'death') f.kill = replayKillerSlots(f, A);
      if (f.kill.h >= 0) window.__fxKill.add(f.kill.h);
      if (f.kill.s >= 0) window.__fxKillS.add(f.kill.s);
    }
    else { f.doneAt = f.doneAt || now; const nb = bodiesList.find(x => x.k === f.id); if ((nb && (f.de != null && nb.de != null ? nb.de === f.de : (!f.old || nb.x !== f.old.x || nb.y !== f.old.y || nb.a !== f.old.a))) || now - f.doneAt > 8) { killFx(f); fxs.splice(i, 1); } }   // Stage 3D: the corpse of this very death takes over
  }
}

/* how another wanderer moves, from what the server relays: [state, speed, stamina, exhausted] -> the pose data the avatar code reads */
const SNAMES = (window.WORLD && window.WORLD.SN) || ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'];
function peerMv(o, now) {
  const a = o.mv; if (!Array.isArray(a)) return undefined;
  const s = SNAMES[a[0]] || 'stand';
  if (o.mvS !== s) { o.mvS = s; o.mvT0 = now; }
  const t = now - (o.mvT0 || now);
  return { s, t, sp: a[1] || 0, st: a[2] === undefined ? 100 : a[2], ex: a[3] ? 1 : 0, vp: s === 'vault' ? Math.min(1, t / .55) : 0, lean: o.mvLean || 1, tw: s === 'down' && (a[1] || 0) > 4 ? 1 : 0 };
}
/* what a fallen wanderer left behind can still shine: a flashlight lying on its side keeps its beam, a lantern keeps lighting the floor.
 * Stage 3D: a physical corpse's light shines from the lens of the dropped light (as it did for the victim while the death played), not
 * from the middle of the object */
function bodyLights(p, out) {
  const A = window.__api; if (!A || !A.bodyList) return;
  const LEN = (window.__dphys && window.__dphys.LEN) || {}, d = A.death && A.death(), hide = window.__hideBodies;
  for (const b of A.bodyList()) {
    if (!b.lo || b.cause === 'Vanish' || !b.equipment || b.equipment.kind === 'camcorder' || !b.dropped) continue;
    if (hide && hide.has(b.ownerId)) continue;                                  // Stage 3D HQ1: its death is still playing here (a replay, or ours): that light is this light
    if (d && d.active && b.id === d.corpseId) continue;                         // Stage 3D HQ1: our own corpse while our death is still on screen - the death's own light is it
    if (Math.hypot(b.dropped.x - p.x, b.dropped.y - p.y) > 950) continue;
    const pw = corpsePower(b); if (!(pw > 0)) continue;                         // Stage 3D HQ1: failed for good: no light at all
    const a = b.hands ? b.dropped.angle - Math.PI / 2 : b.dropped.angle, L = b.hands ? LEN[b.equipment.kind] || 0 : 0;
    out.push({ x: b.dropped.x + Math.cos(a) * L, y: b.dropped.y + Math.sin(a) * L, angle: a, kind: b.equipment.kind, color: b.equipment.color, on: true, dead: false, pw });
  }
}
/* Stage 3D HQ1: a dead wanderer's light holds for its death's chosen 3-7 s after it was let go, flickers and dims for 1-2 s, then is off
 * for good (dphys.lightPower; the profile is the server's, sent with the death).  One timeline per death id: the moment its light was
 * let go, on this page's clock, from every piece of the server's timing this page gets - our own kill record's arrival + the physics'
 * release, a replay's arrival (late joiners' el included) + the replay physics' release, each corpse record's arrival - its age ag +
 * the release relative to its making - and the EARLIEST of them is kept: a message can arrive late (a busy page handles it a frame or
 * more after it came), never early, so the earliest is the nearest to the server's own moment.  The same moments are also read on the
 * server's own clock: the snapshot that carries the kill record, or the first snapshot after a replay or corpse message (the server
 * sends them in one pass), gives its clock 'st'; with the snapshot clock offset the page already keeps from its fastest packets
 * (net-interp.js NET.off) that is this page's time without the page's own delay in handling messages.  It can only move earlier, never
 * later: a replay, a corpse, a reconnect or a reload never starts the light again.  The Death Lab slows what one screen shows, not this
 * clock. */
const lnow = () => window.__deathLightNow ? window.__deathLightNow() : performance.now() / 1000;   // (__deathLightNow: a test's frozen clock, development only)
const relAt = new Map(), DLOG = [], srvSt = new Map(), eqOf = new Map(), pendSt = [];   // srvSt: death id -> { k: when it began, r: when its light was let go } on the server's clock; eqOf: its physics' release
function relOf(de, cand) { if (de == null || cand == null) return cand; let v = relAt.get(de); if (v === undefined || cand < v) { if (v === undefined && relAt.size >= 64) relAt.delete(relAt.keys().next().value); relAt.set(de, v = cand); } return v; }
const capMap = M => { if (M.size > 64) M.delete(M.keys().next().value); };
function stNote(de, k, v) { if (de == null || !Number.isFinite(v)) return; let o = srvSt.get(de); if (!o || o.ep !== NET.epoch) { srvSt.set(de, o = { ep: NET.epoch }); capMap(srvSt); } if (o[k] === undefined || v < o[k]) o[k] = v; }
function eqKnown(de, r) { if (de == null || r == null || eqOf.has(de)) return; eqOf.set(de, r); capMap(eqOf); }
function srvAnchors() { if (NET.off == null) return; for (const [de, o] of srvSt) { if (o.ep !== NET.epoch) continue; if (o.r !== undefined) relOf(de, o.r - NET.off); const r = eqOf.get(de); if (o.k !== undefined && r !== undefined) relOf(de, o.k + r - NET.off); } }
const relRun = S => !S ? null : window.__dphys && window.__dphys.releaseOf ? window.__dphys.releaseOf(S) : S.ctx && S.ctx.eqKind === 'headlamp' ? 0 : (S.eqAt >= 0 ? S.eqAt : null);   // seconds into the death when the light is let go (dphys.releaseOf: known from the death's first frame, whatever the screen shows); a headlamp: its start
function powerAt(src, de, lf, rel, kind) {
  const D = window.__dphys, now = lnow(), pw = rel == null ? 1 : D && D.lightPower ? D.lightPower(lf, now - rel) : 1;
  if (DLOG.length < 32) DLOG.push({ src, de, kind, lf: lf || null, rel: rel == null ? null : +rel.toFixed(4), now: +now.toFixed(4), pw: +pw.toFixed(4) });
  return pw;
}
function corpsePower(b) {
  if (b.remote) { const lf = b.lf || null, rr = lf ? lf[3] : 0, key = b.de != null ? b.de : 'b:' + b.id; return powerAt('corpse', b.de, lf, relOf(key, (b.born != null ? b.born : performance.now() / 1000) + rr), b.equipment.kind); }
  if (!localDe.has(b.id) && ownDeath) localDe.set(b.id, ownDeath.de);
  const de = localDe.get(b.id), mineNow = ownDeath && ownDeath.de === de;
  if (mineNow && ownDeath.srv && !ownDeath.lf) return 0;                       // the server's record says this light was not a lit emitter when we died
  const cand = mineNow && ownDeath.rel != null ? ownDeath.t0 + ownDeath.rel : (b.createdAt != null ? b.createdAt : performance.now() / 1000);
  return powerAt('own corpse', de, mineNow ? ownDeath.lf : null, relOf(de != null ? de : 'l:' + b.id, cand), b.equipment.kind);
}
function ownPower() {
  const A = window.__api, d = A && A.death && A.death(); if (!d || !d.active || !ownDeath) return 1;
  if (ownDeath.srv && !ownDeath.lf) return 0;                                  // the server's record says our light was not a lit emitter (off, or a camcorder)
  const r = relRun(d.ph); if (r == null) return 1;
  ownDeath.rel = r; eqKnown(ownDeath.de, r); return powerAt('own death', ownDeath.de, ownDeath.lf, relOf(ownDeath.de, ownDeath.t0 + r), A.H && A.H.equipment && A.H.equipment.kind);
}
window.__deathLight = { own: ownPower,
  debug: () => ({ epoch: Date.now() / 1000 - performance.now() / 1000, frame: DLOG.slice(), anchors: [...relAt].map(([k, v]) => [k, +v.toFixed(4)]), off: NET.off, srv: [...srvSt].map(([k, o]) => [k, o.k ?? null, o.r ?? null]), own: ownDeath ? { de: ownDeath.de, t0: +ownDeath.t0.toFixed(4), lf: ownDeath.lf, rel: ownDeath.rel } : null }) };
/* Stage 3D HQ1: the wall contacts this screen shows now - our own death while it plays, every replay, every corpse (ours by our own death
 * id) - handed to gore.js, which keeps one wallpaper stain per impact (a few times a second; the physics' own dphys.marks, the corpse
 * record's wall marks) */
let stainAt = 0; const localDe = new Map();             // our own local corpse record -> the death it came from (the latest when it first appears)
function wallStains(now) {
  const G = window.__gore, D = window.__dphys, A = window.__api; if (!G || !G.wallStains || !D || !D.marks || !A || !A.bodyList) return;
  if (now - stainAt < .12 && now >= stainAt) return; stainAt = now;
  const want = [], add = (de, x, y, nx, ny) => want.push({ de, x, y, nx, ny });
  const d = A.death && A.death();
  if (d && d.active && d.ph && ownDeath) for (const m of D.marks(d.ph)) add(ownDeath.de, m.x, m.y, m.nx, m.ny);
  for (const f of fxs) if ((f.k === 'death' || f.k === 'boom') && f.jl && f.jl.ph && !f.gone && f.de != null) for (const m of D.marks(f.jl.ph)) add(f.de, m.x, m.y, m.nx, m.ny);
  for (const b of A.bodyList()) {
    if (b.cause === 'Vanish' || !b.blood) continue;
    let de = b.remote ? b.de : null;
    if (!b.remote && ownDeath) { if (!localDe.has(b.id)) { localDe.set(b.id, ownDeath.de); if (localDe.size > 8) localDe.delete(localDe.keys().next().value); } de = localDe.get(b.id); }
    if (de == null) continue;
    for (const q of b.blood) if (q.seed >= 512 && q.seed < 544) { const a = (q.seed - 512) / 32 * Math.PI * 2; add(de, q.x, q.y, Math.cos(a), Math.sin(a)); }
  }
  G.wallStains.sync(want);
}
/* Stage 3D: while someone's death is replayed, their light is where the replay's light is - tumbling out of the hand, sliding, coming to
 * rest - as it is on the victim's own screen (it was dark for everyone else until the corpse appeared).  Not the camcorder: its IR view
 * is the camcorder's own (camcorder.js), and corpses never carry one either. */
function replayLights(p, out) {
  for (const f of fxs) {
    if ((f.k !== 'death' && f.k !== 'boom') || !f.jl || f.gone || !f.lo || f.gear.kind === 'camcorder') continue;
    const T = f.jl.torch; if (!T || Math.hypot(T.x - p.x, T.y - p.y) > 950) continue;
    const r = relRun(f.jl.ph); if (r != null) eqKnown(f.de, r); const pw = powerAt('replay', f.de, f.lf, r == null ? null : relOf(f.de, f.t0 + r), f.gear.kind); if (!(pw > 0)) continue;   // Stage 3D HQ1
    out.push({ x: T.x, y: T.y, angle: T.angle, kind: f.gear.kind, color: f.gear.color, on: true, dead: false, pw });
  }
}
let view = null;                                  // (C3c) where the other players were last drawn (BR-R's mp.wanderers.js declared it; only this module uses it)
function drawPeers(p, cam, sc, los, dt, W, H) {
  const A = window.__api; const lights = []; let hover = null, best = 1e9;
  const layer = A && A.layer && A.layer();
  const now = performance.now() / 1000;
  updateFx(now);
  view = { cam, sc, W, H };
  for (const o of peers.values()) {
    const px = o.x, py = o.y;
    /* Stage 3E-0 (B): eased by the time that passed (dt: the game's frame time, 0..0.25 s), .3 / .35 of the way per 1/60 s as HQ5 did per frame */
    const ft = Number.isFinite(dt) ? Math.min(.25, Math.max(0, dt)) : 0, aP = PEER_MODE === 'a' ? .3 : 1 - Math.pow(.7, 60 * ft), aR = PEER_MODE === 'a' ? .35 : 1 - Math.pow(.65, 60 * ft);
    o.x += (o.tx - o.x) * aP; o.y += (o.ty - o.y) * aP;
    const step = Math.hypot(o.x - px, o.y - py), inv = 1 / Math.max(dt, .001);
    o.vx = (o.vx || 0) + (((o.x - px) * inv) - (o.vx || 0)) * .25;
    o.vy = (o.vy || 0) + (((o.y - py) * inv) - (o.vy || 0)) * .25;
    o.dist = (o.dist || 0) + step;
    o.ang = o.ang === undefined ? o.a : o.ang + angDiff(o.a, o.ang) * aR;
    if (A && A.mkAvatar && layer) {
      if (!o.av) { o.look = parseLook(o.lk); o.gear = { kind: o.k || 'flashlight', color: o.c || '#ffe7b2', parts: {} }; o.av = A.mkAvatar(o.look, o.gear); layer.addChild(o.av); }
      Object.assign(o.look, parseLook(o.lk)); o.gear.kind = o.k || 'flashlight'; o.gear.color = o.c || '#ffe7b2'; o.gear.parts[o.gear.kind] = partObj(o.gear.kind, o.lp);
      o.src = Object.assign(o.src || {}, { x: o.x, y: o.y, angle: o.ang, vx: o.vx, vy: o.vy, distance: o.dist, mv: peerMv(o, now) });
      o.av.update(now, !!o.l && !o.d, false, o.src);
      if (o.d) { o.av.__key = o.id; o.av.deathPose(1, 0, false); if (o.dAt === undefined) o.dAt = now; } else o.dAt = undefined;
      if (o.f >= 0 && o.f < 1 && !o.d) {                          // they are still falling in
        const k = .62, p2 = o.f;
        if (p2 < k) { const h = p2 / k, hs = h * h * (3 - 2 * h), z = 1 + (1 - hs) * (1 - hs) * 1.25; o.av.scale.set(z, z); o.av.alpha = Math.min(1, p2 / .22); o.av.rotation += (1 - hs) * 1.7; }
        else { const u = (p2 - k) / (1 - k), b = Math.exp(-u * 5) * Math.sin(u * 22); o.av.scale.set(1 + .11 * b, 1 - .11 * b); o.av.alpha = 1; }
      } else if (!o.d) { o.av.scale.set(1, 1); o.av.alpha = 1; }
      o.av.visible = !(fxActive(o.id) || (o.d && (hasBody(o.id) || now - o.dAt < .6)));     // their replayed death / finished corpse takes over
    }
    const dx = o.x - p.x, dy = o.y - p.y, dist = Math.hypot(dx, dy);
    const bm = o.av && o.av.beam; if (dist < 950) lights.push({ x: bm ? bm.x : o.x, y: bm ? bm.y : o.y, angle: bm ? bm.angle : o.ang, kind: o.k || 'flashlight', color: o.c || '#ffe7b2', on: !!o.l, ir: o.k === 'camcorder' && o.l ? (o.ir | 0) : 0, dead: !!o.d });
    /* hover: only for wanderers you can actually see (in line of sight and lit) */
    const sx = W / 2 + (o.x - cam.x) * sc, sy = H / 2 + (o.y - cam.y) * sc;
    const dm = Math.hypot(mx() - sx, my() - sy);
    if (dm < 30 * sc && dm < best && dist < 800 && (dist < 30 || !los || los(p.x, p.y, Math.atan2(dy, dx), dist) >= dist - 20)) {
      best = dm; hover = { o, sx, sy };          // hover requires actual line of sight; emitted-light state is handled separately
    }
  }
  DLOG.length = 0; if (window.__api && window.__api.death && window.__api.death() && window.__api.death().active) ownPower();   // (our own death's release is noted every frame)
  srvAnchors();
  replayLights(p, lights); bodyLights(p, lights);
  window.__peerLights = lights;
  wallStains(now);
  if (EN() && N.on) EN().drawDebug(cx, view);                                 // admin-only overlay (the server only sends its data to unlocked admins who switched it on)
  hoverTip(hover, sc);                                                        // (C3c) BR-R shows the hover name (or hides it)
}
N.peerScreen = () => peers.size && view ? [...peers.values()].map(o => ({ n: o.n, look: o.lk, kind: o.k, color: o.c, lp: o.lp, lightOn: o.l, hasAvatar: !!o.av,
  sx: view.W / 2 + (o.x - view.cam.x) * view.sc, sy: view.H / 2 + (o.y - view.cam.y) * view.sc })) : [];
/* (C3c) G.I.B.'s state is this module's: the session asks for its changes - on each message, on the world epoch, when the connection closes */
const endAllFx = () => { for (const f of fxs.splice(0)) killFx(f); };
const forgetOwnDeath = () => { ownDeath = null; mkAt = null; };
const hideCorpse = id => { window.__hideBodies.add('r' + id); };
const showCorpse = id => { window.__hideBodies.delete('r' + id); };
const noPeerLights = () => { window.__peerLights = []; };
function oldLights() {                                                           // the world epoch: the old world's dying lights and wall stains
  window.__peerLights = (window.__peerLights || []).filter(l => l.pw == null);   // (the old world's dying lights: gone now, not at the next frame)
  const G = window.__gore; if (G && G.wallStains && G.wallStains.clear) G.wallStains.clear();   // (its wall stains too)
  stainAt = 0;
}
function killNoted(m) { mkAt = { de: m.mk.de, t: performance.now() / 1000 }; if (m.mk.de != null && m.e && typeof m.e.st === 'number') stNote(m.mk.de, 'k', m.e.st); }   // our kill record arrived (HQ1: and when, on the server's clock)
function takeBodies(list) { bodiesList = list || []; const tb = performance.now() / 1000; for (const b of bodiesList) if (b && b.de != null && Array.isArray(b.lf) && b.lf.length === 4 && Number.isFinite(b.ag + b.lf[3])) { relOf(b.de, tb - b.ag + b.lf[3]); pendSt.push(['r', b.de, b.ag, b.lf[3]]); } applyBodies(); }   // (HQ1: when each corpse's light was let go)
function fxMsg(m) { if (((m.k === 'death' && m.id !== myId()) || m.k === 'boom') && m.de != null) pendSt.push(['k', m.de, Math.max(0, +m.el || 0)]); startFx(m); }   // (HQ1: when the death began, on the server's clock; HQ2: a NEW RUN blast too)
function flushSt(st) { if (pendSt.length) { for (const q of pendSt) stNote(q[1], q[0], q[0] === 'k' ? st - q[2] : st - q[2] + q[3]); pendSt.length = 0; } }   // (HQ1: a replay or corpse that came just before this snapshot was sent in its pass)
return { applyBodies, drawPeers, endAllFx, flushSt, forgetOwnDeath, fxMsg, hideCorpse, killNoted, noPeerLights, oldLights, showCorpse, startFx, takeBodies };
}
