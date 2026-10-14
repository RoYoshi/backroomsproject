/** @part public/mp.js - S.P.A.C.E.: the other living Wanderers are solid, the soft correction, the world epoch
 * B++'s fresher poses (peerPoses, Stage 3E-0 B+) sit between the solid peers and the soft correction, as they always did.
 * provides: blend, blendStep, oldWorld, peerPoses, softTp, solidHeld, solidPeers, worldNew
 * uses: PEER_MODE, PEER_SNAP, PN, cpNow, exited, fastAck, fxs, handled, killFx, lastK, me, mkAt, mseq, myId, nrBusy, ownDeath, peers,
 *       stainAt, worldW
 * writes: handled, lastK, mkAt, ownDeath, stainAt, worldW
 */
/* Stage 3D HQ2 (H2-4): the other living Wanderers are solid.  window.__peerBodies is what move.js steers round: the latest server
 * positions (the snapshot's own, not the smoothed drawing) of every other player in the world who is alive and not held in a capture
 * (an entity's cp names its victim).  Empty offline, and while we are not solid ourselves: not in a run, dead, held, out through a glitch,
 * or out of the world after an approved NEW RUN. */
window.__peerBodies = [];
let solidHeld = null;                                // (Stage 3E-0: the last snapshot's held players, for the fresher poses)
const solidNow = A => !(!A || !A.started || !A.started() || me || cpNow || nrBusy === 2 || exited || (A.G && A.G.caught));
function solidPeers(m) {
  const pb = window.__peerBodies, A = window.__api; pb.length = 0; solidHeld = null;
  if (!solidNow(A)) return;
  const held = new Set(); if (m.e) for (const k of ['h', 'm']) for (const e of m.e[k] || []) if (e && e.cp) held.add(e.cp);
  for (const p of m.p) if (!p.d && !held.has(p.id)) pb.push([p.x, p.y]);
  solidHeld = held;
}
/* Stage 3E-0 (B+): a 'q' - the newer accepted poses of players the last snapshot listed, between two snapshots.  Only this world's (w), only
 * newer than every snapshot and 'q' already seen (k), only players we know and who are alive: never a new or a dead one.  It moves their
 * targets (drawPeers eases toward them) and the bodies we steer round (the server's own positions, never the drawn ones) */
function peerPoses(m) {
  PN.q++;
  if (PEER_MODE !== 'bplus' || m.w == null || m.w !== worldW || !(m.k > lastK) || !Array.isArray(m.p)) { PN.qStale++; return; }
  lastK = m.k;
  for (const q of m.p) {
    const o = Array.isArray(q) ? peers.get(q[0]) : null;
    if (!o || o.d || !Number.isFinite(q[1] + q[2] + q[3])) { PN.qUnknown++; continue; }
    if (Math.hypot(q[1] - o.x, q[2] - o.y) > PEER_SNAP) { o.x = q[1]; o.y = q[2]; }
    o.tx = q[1]; o.ty = q[2]; o.a = q[3]; PN.qApplied++;
  }
  const pb = window.__peerBodies, A = window.__api;
  if (solidHeld && solidNow(A)) { pb.length = 0; for (const [id, o] of peers) if (!o.d && !solidHeld.has(id)) pb.push([o.tx, o.ty]); }   // (as solidPeers, from the newer poses)
}
window.__peerNet = () => ({ mode: PEER_MODE, fast: fastAck, sendMs: fastAck ? 25 : 50, lastK, counts: Object.assign({}, PN),   // DEV only (tests): what B+ did
  peers: [...peers.values()].map(o => ({ id: o.id, x: +o.x.toFixed(2), y: +o.y.toFixed(2), tx: o.tx, ty: o.ty, a: o.a, ang: o.ang === undefined ? null : +o.ang.toFixed(4), d: o.d })) });
/* the soft correction ({t:'tp', x, y, pc:1}: the server stopped us short of another player): blended in over 120 ms instead of a jump -
 * the offset is added a little each fixed step, and the part of our velocity that runs back against it (into the body the server would
 * not let us into) is dropped, the sideways part kept.  Further than 96 px is no longer a nudge: a jump, as an ordinary tp */
let blend = null;
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
/* the world epoch: an admin world reset ({t:'world', w, x, y}), or the first snapshot of a world a lone player's new run started.
 * Everything of the old world ends on this screen at once - every replay, our own death (the server has already brought us back, at x, y:
 * no new spawn, no respawn message), our own local corpse - and with them their wall stains and dying lights; a death, blast or corpse
 * message naming an older world is ignored from then on (oldWorld). */
let worldEnds = 0, oldDropped = 0, softN = 0;
function oldWorld(w) { if (w != null && worldW != null && w < worldW) { oldDropped++; return true; } return false; }
function worldNew(w, x, y) {
  if (w == null || (worldW != null && w <= worldW)) return; worldW = w; worldEnds++;
  for (const f of fxs.splice(0)) killFx(f);
  const A = window.__api;
  if (A && A.worldEnd && A.G && A.G.caught) A.worldEnd(Number.isFinite(x) ? x : A.H.x, Number.isFinite(y) ? y : A.H.y);
  handled = mseq; ownDeath = null; mkAt = null; window.__kill = null; window.__killer = -1; if (myId) window.__hideBodies.delete('r' + myId);
  if (window.__mv) { window.__mv.down = 0; window.__mv.dragTo = null; }
  window.__peerLights = (window.__peerLights || []).filter(l => l.pw == null);   // (the old world's dying lights: gone now, not at the next frame)
  const G = window.__gore; if (G && G.wallStains && G.wallStains.clear) G.wallStains.clear();   // (its wall stains too)
  blend = null; stainAt = 0; worldAt = Date.now() / 1000;
}
let worldAt = null;
window.__epochDebug = () => ({ w: worldW, ends: worldEnds, at: worldAt, oldDropped, softTp: softN, peers: window.__peerBodies.length });
