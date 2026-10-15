/** @part public/mp.js - N.A.N.I.: the server's monsters, mirrored into the game; a module: naniMonsters
 * A module (continuation C3c, M-024): M8's part in its factory, with the monsters' state made its own: the entity slots (hMap, hSlots,
 * sSlot, window.__hounds: core's at M8), the kill record (window.__kill) and the killer's slot (window.__killer, which the session's
 * tick worked out itself at M8: markKiller), the held state handed to move.js (window.__mv's down and dragTo: unhold) and the lamps'
 * failure list (noFails), each of which the session, the world epoch or the per-frame hook wrote at M8 and now asks for. It reads the
 * session's snapshot, hold and spawn grace through their readers, and hands the server's walls and items to their owners (L.O.S.T.'s
 * glitchesFrom, P.O.C.K.E.T.'s itemsFrom). The hit flash is faded by the per-frame hook through fadeHit (it wrote it at M8).
 * imports: core { EN NET netPose }, session { cpNow graceUntil N snap }, glitch { glitchesFrom }, cartograph { itemsFrom }
 * exports: angDiff, announceKill, applyCaught, applyServerState, clearKill, clearKiller, clearSlots, entitySignals, fadeHit, hitFlash, hMap,
 *          hSlots, markKiller, noFails, unhold
 * provides: naniMonsters
 * uses: -
 * writes: -
 */
function naniMonsters({ core: { EN, NET, netPose }, session: { cpNow, graceUntil, N, snap }, glitch: { glitchesFrom }, cartograph: { itemsFrom } }) {
/* ---------- mirror the server's monsters into the game ---------- */
const CLIENT_ENTITY_SLOTS = 64;                 // stress/admin ceiling; ordinary director population is still 3 Hounds / <=5 Smilers
const hMap = new Map(), hSlots = Array(CLIENT_ENTITY_SLOTS).fill(null);
const sSlot = Array(CLIENT_ENTITY_SLOTS).fill(null); // entity id living in each preallocated Smiler render object
window.__hounds = hSlots;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/* the kill the server just made: which entity, which variant (A-D), where the wall is.  The death sequence in the bundle reads this. */
function announceKill(k) {
  const K = window.__kill = Object.assign({}, k, { at: performance.now(), slot: -1 });
  if (K.k === 'Hound') { const o = hMap.get(K.e); K.slot = o ? o.slot : -1; } else K.slot = sSlot.indexOf(K.e);
}
/* sounds the entities make (positional, voiced by ents.js) and lamps the smilers are killing */
function entitySignals(e) {
  const E = EN(); if (!E) return;
  for (const q of e.sn || []) if (Array.isArray(q) && ['growl', 'snarl', 'lungecue', 'guard', 'kill'].includes(q[0])) E.houndVoice(q[1], q[2], q[0], q[3]);
  E.setFails(e.lf || []);
}
window.__netPose = netPose; window.__NET = NET;
NET.onEpoch = () => { hMap.clear(); hSlots.fill(null); sSlot.fill(null); };           // entity slots belong to the old world too
function applyServerState(dt) {
  const A = window.__api, s = snap(), E = EN();
  if (!A || !s || !E) return;
  /* hounds: every hound has its own client-side copy in a fixed slot; the game's own hound object (G) mirrors the nearest one */
  const ids = new Set();
  for (const t of s.h) {
    ids.add(t.i);
    let o = hMap.get(t.i);
    if (!o) { const sl = hSlots.indexOf(null); if (sl < 0) continue; o = { x: t.x, y: t.y, angle: t.a, state: 'ROAMING', ls: 'patrol', act: '', distance: 0, slot: sl, id: t.i }; hMap.set(t.i, o); hSlots[sl] = o; }
    E.slotH(o, t, dt, netPose('h' + t.i));
  }
  for (const [id, o] of hMap) if (!ids.has(id)) { hSlots[o.slot] = null; hMap.delete(id); }
  let best = null, bd = 1e18;
  for (const o of hMap.values()) { const d = Math.hypot(o.x - A.H.x, o.y - A.H.y); if (d < bd) { bd = d; best = o; } }
  const G = A.G, grace = Math.max(0, graceUntil() - performance.now() / 1000);
  if (best) { G.x = best.x; G.y = best.y; G.angle = best.angle; G.state = best.ls; G.distance = best.distance; }
  else { G.x = G.y = -9e4; G.state = 'patrol'; }
  G.grace = grace; G.pressure = s.p || 0;
  /* smilers: one fixed render slot per server entity (stress ceiling 64); unused slots are parked far away and hidden */
  const sid = new Set();
  for (const t of s.m) {
    sid.add(t.i);
    let i = sSlot.indexOf(t.i);
    if (i < 0) { i = sSlot.indexOf(null); if (i < 0) continue; sSlot[i] = t.i; const o = A.q[i]; o.x = t.x; o.y = t.y; o.angle = t.a; o.distance = 0; }
    A.q[i].off = false; E.slotS(A.q[i], t, dt, netPose('m' + t.i));
  }
  A.q.forEach((sm, i) => {
    if (sSlot[i] !== null && !sid.has(sSlot[i])) sSlot[i] = null;
    if (sSlot[i] === null) { sm.off = true; sm.x = sm.y = -9e4; sm.state = 'lurk'; sm.ls = 'lurk'; sm.face = 0; }
  });
  A.V.blackout = !!s.b;
  glitchesFrom(s.gw); itemsFrom(s.it);                                                 // (C3c) the walls are L.O.S.T.'s, the items P.O.C.K.E.T.'s
}
/* held by something: the server says down / crawl / (dragged toward a point).  move.js does the rest, this adds the sounds and the flash */
let cpPrev = '', hitFlash = 0;
function applyCaught() {
  const A = window.__api, mv = window.__mv, E = EN(); if (!A || !mv) return;
  const cp = N.on && !A.G.caught ? cpNow() : 0, ph = cp ? cp.ph : '';
  mv.down = cp && ph !== 'release' ? (ph === 'crawl' ? 'crawl' : 'down') : 0;
  mv.dragTo = mv.down && cp.d ? cp.d : null;
  if (ph !== cpPrev) {
    if (E && ph === 'down' && !cpPrev) { E.sfxKnock(); hitFlash = 1; }
    else if (E && ph === 'crawl') E.sfxGasp();
    else if (E && !ph && cpPrev) E.sfxRelease();
    cpPrev = ph;
  }
}
/* (C3c) the monsters' state is this module's: the session, the world epoch and the per-frame hook ask for its changes */
function markKiller(A, by) {                          // our death has begun (the session's tick): which hound slot made the kill
  const K = window.__kill; let b = -1;
  if (K && K.slot >= 0) b = K.slot; else { let bd = 1e18; for (const o of hMap.values()) { const d = Math.hypot(o.x - A.H.x, o.y - A.H.y); if (d < bd) { bd = d; b = o.slot; } } }
  window.__killer = by === 'Hound' ? b : -1;             // that hound's own model is replaced by the attack animation
}
const clearKill = () => { window.__kill = null; };
const clearKiller = () => { window.__killer = -1; };
const clearSlots = () => { hMap.clear(); hSlots.fill(null); sSlot.fill(null); };
function unhold() { if (window.__mv) { window.__mv.down = 0; window.__mv.dragTo = null; } }
const noFails = () => { if (EN()) EN().setFails([]); };
const fadeHit = t => { hitFlash = Math.max(0, hitFlash - t * 1.6); };
return { angDiff, announceKill, applyCaught, applyServerState, clearKill, clearKiller, clearSlots, entitySignals, fadeHit, hitFlash: () => hitFlash, hMap, hSlots, markKiller, noFails, unhold };
}
