/* server/peers.js - Stage 3D HQ2: living Wanderers are solid to each other (server side only; never served).
 *
 * Every player is a circle; two living players in the same room never come closer than D = 36 px centre to centre (the drawn body:
 * a circle of radius 18).  Walls keep their own radius (15) and are checked first, by sim.moveOk; this file only decides what the
 * other players allow, from the server's own positions - never from anything a client says about anyone else.
 *
 *   legal(x0, y0, x, y, peers, D)    may a player at (x0, y0) move to (x, y)?  For every peer q the end point is no closer to q than
 *                                    min(|start - q|, D) (an overlap can only shrink: two players spawned on one spot separate freely,
 *                                    a player can never get deeper into another, and no number of tiny steps creeps closer), and the
 *                                    straight path between never dips more than TOL = 2 px below that (a step sliding round a body is a
 *                                    chord of the circle; no passing through a body, however long the step)
 *   resolve(x0, y0, x1, y1, peers, D, wallOk)  the move to accept for a claimed one (already legal for the walls): the claim itself when
 *                                    legal ('free'); else the claim with the part of it that goes into each peer taken out, the part
 *                                    along it kept (a slide around a body, 'slid'); else the furthest legal point of the straight claim
 *                                    ('clamped'); else the start ('stay').  A slid or clamped point is a new point: wallOk(x, y) (the
 *                                    server's sim.moveOk from the start) must accept it too, or the next answer is tried
 *   sweepPath(x0, y0, pts, peers, D) a long hop the walls allow only along a route round them (sim.moveRoute's points, the claim last):
 *                                    the others are swept along that route, leg by leg, as legal() sweeps one; the furthest legal point
 *                                    of it ('free' at its end, else 'clamped' on the leg that meets a body, or 'stay')
 *   freeSpot(x, y, peers, clear, D)  a point near (x, y) clear of the level (clear(x, y, 20)) and at least D + 8 from every peer: the spot
 *                                    itself or the first of up to 72 candidates on six rings around it, always in the same order; when
 *                                    none is free, (x, y) itself (the overlap rule above lets anyone walk out of it)
 * Pure functions of their arguments: same input, same answer, no state kept between calls. */
'use strict';
const D_BODY = 36, TOL = 2;

function legal(x0, y0, x, y, peers, D) {
  const dx = x - x0, dy = y - y0, dd = dx * dx + dy * dy;
  for (let i = 0; i < peers.length; i++) {
    const qx = peers[i][0], qy = peers[i][1], wx = x0 - qx, wy = y0 - qy, s0 = Math.sqrt(wx * wx + wy * wy), fl = s0 < D ? s0 : D;
    const ex = x - qx, ey = y - qy;
    if (ex * ex + ey * ey < fl * fl - 1e-6) return false;                     // the end point: never closer than the floor
    if (dd < 1e-12) continue;
    const t = -(wx * dx + wy * dy) / dd; if (t <= 0 || t >= 1) continue;       // the path's closest point is an end point: done
    const cx = wx + dx * t, cy = wy + dy * t, lim = fl - TOL;
    if (lim > 0 && cx * cx + cy * cy < lim * lim) return false;               // through the body
  }
  return true;
}

function resolve(x0, y0, x1, y1, peers, D, wallOk) {
  if (!peers.length || legal(x0, y0, x1, y1, peers, D)) return { x: x1, y: y1, how: 'free' };
  let dx = x1 - x0, dy = y1 - y0;
  for (let it = 0; it < 3; it++) for (let i = 0; i < peers.length; i++) {         // take out what goes into each peer, keep what goes along it
    const wx = x0 - peers[i][0], wy = y0 - peers[i][1], s0 = Math.sqrt(wx * wx + wy * wy); if (s0 < 1e-6) continue;
    const nx = wx / s0, ny = wy / s0, room = s0 > D ? s0 - D : 0, dn = dx * nx + dy * ny;
    if (-dn > room) { const k = -dn - room; dx += nx * k; dy += ny * k; }
  }
  if (legal(x0, y0, x0 + dx, y0 + dy, peers, D) && (!wallOk || wallOk(x0 + dx, y0 + dy))) return { x: x0 + dx, y: y0 + dy, how: 'slid' };
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (legal(x0, y0, x0 + (x1 - x0) * m, y0 + (y1 - y0) * m, peers, D)) lo = m; else hi = m; }
  if (lo > 0 && (!wallOk || wallOk(x0 + (x1 - x0) * lo, y0 + (y1 - y0) * lo))) return { x: x0 + (x1 - x0) * lo, y: y0 + (y1 - y0) * lo, how: 'clamped' };
  return { x: x0, y: y0, how: 'stay' };
}

function sweepPath(x0, y0, pts, peers, D) {
  let ax = x0, ay = y0;
  for (const q of pts) {
    if (legal(ax, ay, q[0], q[1], peers, D)) { ax = q[0]; ay = q[1]; continue; }
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (legal(ax, ay, ax + (q[0] - ax) * m, ay + (q[1] - ay) * m, peers, D)) lo = m; else hi = m; }
    const x = ax + (q[0] - ax) * lo, y = ay + (q[1] - ay) * lo;
    return { x, y, how: x === x0 && y === y0 ? 'stay' : 'clamped' };
  }
  return { x: ax, y: ay, how: 'free' };
}

const RINGS = [0, 44, 88, 132, 176, 220], SLOTS = 12;
function freeSpot(x, y, peers, clear, D) {
  const need = (D + 8) * (D + 8);
  for (const r of RINGS) for (let k = 0; k < (r ? SLOTS : 1); k++) {
    const a = k / SLOTS * Math.PI * 2, px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
    if (!clear(px, py, 20)) continue;
    let ok = true; for (const q of peers) { const ex = px - q[0], ey = py - q[1]; if (ex * ex + ey * ey < need) { ok = false; break; } }
    if (ok) return { x: px, y: py, moved: r > 0 };
  }
  return { x, y, moved: false, crowded: true };
}

module.exports = { D_BODY, TOL, legal, resolve, sweepPath, freeSpot };
