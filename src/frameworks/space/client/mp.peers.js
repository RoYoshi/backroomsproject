/** @part public/mp.js - S.P.A.C.E.: the other living Wanderers are solid, the soft correction; a module: spacePeers
 * A module (continuation C3c, M-024): M8's part in its factory, less two things that moved by meaning (ADR-005): B+'s fresher poses
 * (peerPoses, window.__peerNet) and the world epoch (oldWorld, worldNew, window.__epochDebug) are B++'s session's now, and the end of
 * peerPoses that steers us round the newer poses is this module's resolid(). It reads the session's values through its readers (me(),
 * cpNow(), nrBusy()) and L.O.S.T.'s exit flag (exited()); the session calls what changes this module's state (solidPeers, resolid,
 * softTp, blendTick, stopBlend, solidOff) and reads its counters (softCount, solidCount). Its own: the solid peers (window.__peerBodies,
 * the last snapshot's held players), the soft correction and its count.
 * imports: session { cpNow me nrBusy peers }, glitch { exited }
 * exports: blendTick, resolid, softCount, softTp, solidCount, solidOff, solidPeers, stopBlend
 * provides: spacePeers
 * uses: -
 * writes: -
 */
function spacePeers({ session: { cpNow, me, nrBusy, peers }, glitch: { exited } }) {
/* Stage 3D HQ2 (H2-4): the other living Wanderers are solid.  window.__peerBodies is what move.js steers round: the latest server
 * positions (the snapshot's own, not the smoothed drawing) of every other player in the world who is alive and not held in a capture
 * (an entity's cp names its victim).  Empty offline, and while we are not solid ourselves: not in a run, dead, held, out through a glitch,
 * or out of the world after an approved NEW RUN. */
window.__peerBodies = [];
let solidHeld = null;                                // (Stage 3E-0: the last snapshot's held players, for the fresher poses)
const solidNow = A => !(!A || !A.started || !A.started() || me() || cpNow() || nrBusy() === 2 || exited() || (A.G && A.G.caught));
function solidPeers(m) {
  const pb = window.__peerBodies, A = window.__api; pb.length = 0; solidHeld = null;
  if (!solidNow(A)) return;
  const held = new Set(); if (m.e) for (const k of ['h', 'm']) for (const e of m.e[k] || []) if (e && e.cp) held.add(e.cp);
  for (const p of m.p) if (!p.d && !held.has(p.id)) pb.push([p.x, p.y]);
  solidHeld = held;
}
/* (C3c) after B+'s fresher poses (the session's peerPoses) moved the players' targets: the bodies we steer round, from them */
function resolid() {
  const pb = window.__peerBodies, A = window.__api;
  if (solidHeld && solidNow(A)) { pb.length = 0; for (const [id, o] of peers) if (!o.d && !solidHeld.has(id)) pb.push([o.tx, o.ty]); }   // (as solidPeers, from the newer poses)
}
/* the soft correction ({t:'tp', x, y, pc:1}: the server stopped us short of another player): blended in over 120 ms instead of a jump -
 * the offset is added a little each fixed step, and the part of our velocity that runs back against it (into the body the server would
 * not let us into) is dropped, the sideways part kept.  Further than 96 px is no longer a nudge: a jump, as an ordinary tp */
let blend = null;
let softN = 0;                                       // (C3c) how many soft corrections (window.__epochDebug's softTp, the session's)
function softTp(A, x, y) {
  const dx = x - A.H.x, dy = y - A.H.y, d = Math.hypot(dx, dy); if (!(d <= 600)) return false;   // (H2-5: every correction the server can send - one packet's budget is 568 px - is blended, as D3 says; H2-4 jumped above 96 px, which a 200-300 ms link reaches)
  blend = { dx, dy, t0: performance.now(), done: 0 }; softN++; return true;
}
function blendStep(A) {
  const b = blend, k = Math.min(1, (performance.now() - b.t0) / 120), s = k - b.done; b.done = k;
  A.H.x += b.dx * s; A.H.y += b.dy * s;
  const L = Math.hypot(b.dx, b.dy); if (L > 0) { const ux = b.dx / L, uy = b.dy / L, vn = A.H.vx * ux + A.H.vy * uy; if (vn < 0) { A.H.vx -= vn * ux; A.H.vy -= vn * uy; } }
  if (k >= 1) blend = null;
}
/* (C3c) what the session asks of this module's state: the fixed-step blend, its end (a plain tp, a new world), nothing solid offline */
const blendTick = A => { if (blend && A) blendStep(A); };
const stopBlend = () => { blend = null; };
function solidOff() { solidHeld = null; window.__peerBodies.length = 0; blend = null; }
return { blendTick, resolid, softCount: () => softN, softTp, solidCount: () => window.__peerBodies.length, solidOff, solidPeers, stopBlend };
}
