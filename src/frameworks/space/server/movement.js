/* src/frameworks/space/server/movement.js - S.P.A.C.E. on the server: the movement authority.  Every pose a client sends is checked
 * here (the distance budget, the walls, the other living players), and every server-side placement (spawn, respawn, admin tools) is made here.
 *
 * Stage 3H engine modernization (H3M-2): moved out of server.js without a change.  Every line between the factory's first line and its
 * return is server.js's own (at checkpoint M6a, f2db9d8: lines 30-51, 53-114 and 137-155), comments and column included, except the one
 * line marked (H3M-2): nothing is re-indented, so each line can be compared with server.js as it was (dev/stage-3h/tools/h2_move_proof.js
 * does: dev/stage-3h-modernization/evidence/m2/).
 *   MV                          the budget's numbers (speeds, burst, slack, snap, grace)
 *   PD                          the body width the living keep between them (peers.js's D_BODY)
 *   blockers(room, me)          where the other solid players are, when me is solid itself
 *   placeFree(room, me)         a server-side placement onto a free spot (true if it had to move)
 *   mvReset(me, grace)          the movement check restarted from where the player is (with the grace after a placement)
 *   mvCheck(room, me, x, y)     one pose: accepted (true), or refused, corrected or ignored (false)
 *   moveTo(room, me, x, y)      a server-side move (spawn, admin tools), told to the client
 *   adminMove(room, me, x, y)   an admin's own move: through walls, never into another player
 * What it uses of the server is given by server.js, never required (so loading it changes nothing a golden trace records): PEERS
 * (src/frameworks/space/server/peers.js, which server.js still requires itself, where it always did) and send(c, obj) (server.js's:
 * the WebSocket frame).  No timer.  Never served: the server's allowlist reaches only public/. */
module.exports = ({ PEERS, send }) => {
/* Movement validation.  Movement stays client-side; the server only refuses what a body cannot do.  Every player has a distance budget
 * that refills at VMAX px/s (the fastest legal motion - a sprint-slide or a fast vault - plus ~20 %) and holds at most BURST seconds of it,
 * so packets that arrive bunched after a lag spike still fit.  A move must fit the budget and not pass through walls (sim.moveOk).
 * A refused move leaves the server's position where it was; if the client keeps claiming somewhere else it is sent a correction.
 * Held in a capture the budget is small (the drag and a crawl); dead it is zero.  Server-side moves (spawn, respawn, admin tools) reset
 * it, with a short grace in which in-flight packets from before the move are ignored instead of corrected.  Admins are not checked:
 * their debug tools move them from the client.
 * Stage 3E-0 B++-0: in that grace a pose farther from the placed spot than the fastest legal motion (VMAX, + SLACK) could have carried
 * the player since the placement was sent before its client knew of it, and is ignored too - before, the refilled budget let such a
 * pose (a spot up to ~570 px back) through as an ordinary move and the placement was undone.  Any pose the client sends after it took
 * the placement is within that reach, so it is checked exactly as before. */
const MV = { VMAX: 360, VHELD: 130, BURST: 1.5, SLACK: 28, SNAP: 220, GRACE: 900 };
/* Stage 3D HQ2: living Wanderers are solid to each other (server/peers.js: D = 36 px, the drawn body).  Solid: in this room (each room
 * has its own clients), in a run, not dead, not out through a glitched wall, not held in a capture (a capture moves its victim; nothing
 * may block or be blocked by that).  A non-solid mover ignores the others; a solid one is checked against every other solid one, from
 * the server's own positions, on every accepted move - after the walls (walls always win); a long hop the walls allow only along a route
 * round them is swept along that route (sim.moveRoute, peers.sweepPath).  Spawns, respawns, admin teleports and the admin world reset
 * land where they always did unless a player stands on or next to that spot (within D + 8): then on the nearest free spot (peers.freeSpot:
 * clear of walls by 20 px and D + 8 from everyone).  A move the others cut short is accepted as far as it may go (peers.resolve); within 8 px of
 * the claim that is silent; the client is told where it really is with a soft correction ({t:'tp', x, y, pc:1}) when its claim is more
 * than 8 px off, or more than 2 px off for 0.3 s, at most every 0.3 s.  In the grace after a server-side placement such a move was sent
 * before it (back towards the old spot) and is ignored, as a refused one is.  The AI keeps hearing only what the server accepted. */
const PD = PEERS.D_BODY, NONE = [];                                           // (H3M-2: server.js's line 52 less its require, which stays there)
const solidP = p => !!(p.active && !p.dead && !p.exited && !p.caught);
function blockers(room, me) {
  if (!solidP(me.player)) return NONE;
  let out = null; for (const c of room.clients.values()) if (c !== me && solidP(c.player)) (out || (out = [])).push([c.player.x, c.player.y]);
  return out || NONE;
}
function peerCorrect(me, miss, now) {
  const v = me.mv;
  if (miss <= 2) { v.pcSince = 0; return; }
  if (!v.pcSince) v.pcSince = now;
  if ((miss > 8 || now - v.pcSince > 300) && now - (v.pcAt || 0) > 300) { v.pcAt = now; v.pcSince = 0; me.peerCorr = (me.peerCorr | 0) + 1; send(me, { t: 'tp', x: Math.round(me.player.x), y: Math.round(me.player.y), pc: 1 }); }
}
function placeFree(room, me) {                                                  // a server-side placement: where it was put, unless someone stands on or next to it
  const p = me.player, ps = blockers(room, me), need = (PD + 8) * (PD + 8);      // (within D + 8): then the nearest free spot; true if it moved
  if (ps.every(q => (p.x - q[0]) * (p.x - q[0]) + (p.y - q[1]) * (p.y - q[1]) >= need)) return false;
  const f = PEERS.freeSpot(p.x, p.y, ps, (x, y, r) => room.sim.clearAt(x, y, r), PD);
  p.x = f.x; p.y = f.y; return f.moved;
}
function mvReset(me, grace = true) { const p = me.player; me.mv = { t: Date.now(), bud: MV.VMAX * MV.BURST, grace: grace ? Date.now() + MV.GRACE : 0, bad: 0, badAt: 0, paths: 0, pathT: 0, hist: [[Date.now(), p.x, p.y]], place: grace ? [p.x, p.y, Date.now()] : null }; p.obsV = 0; }   // (place: Stage 3E-0 B++-0, where and when the server put it)
function mvAccept(me, x, y) {
  const p = me.player, v = me.mv, now = Date.now();
  v.hist.push([now, x, y]); while (v.hist.length > 2 && now - v.hist[1][0] >= 500) v.hist.shift();       // keeps the newest sample that is at least 0.5 s old as the base
  const h0 = v.hist[0], el = (now - h0[0]) / 1000;
  if (el >= .5) p.obsV = Math.hypot(x - h0[1], y - h0[2]) / el;            // what the server saw it do over at least 0.5 s (packets bunched by lag average out instead of spiking)
  p.x = x; p.y = y;
}
function mvCheck(room, me, x, y) {
  const p = me.player; if (!me.mv) mvReset(me, false);
  const v = me.mv, now = Date.now(), dt = Math.min(MV.BURST, Math.max(0, (now - v.t) / 1000)); v.t = now;
  const cap = p.dead ? 0 : p.caught ? MV.VHELD : MV.VMAX;
  v.bud = Math.min(cap * MV.BURST, v.bud + cap * dt);
  const d = Math.hypot(x - p.x, y - p.y);
  const pl = v.place;                                                       // Stage 3E-0 B++-0: a pose from before a server placement (see MV): ignored, as a refused one in the grace is
  if (pl && now < v.grace && now - pl[2] < MV.GRACE && Math.hypot(x - pl[0], y - pl[1]) > MV.VMAX * (now - pl[2]) / 1000 + MV.SLACK) { me.mvStale = (me.mvStale | 0) + 1; return false; }
  let ok = d <= v.bud + MV.SLACK;
  if (ok && d > 0) {                                                        // every accepted move keeps collision legality, however small (tiny steps must not add up through a wall)
    let route = null;
    if (d >= 120) { if (now - v.pathT > 1000) { v.pathT = now; v.paths = 0; } ok = ++v.paths <= 3 && (route = room.sim.moveRoute(p.x, p.y, x, y, v.bud + MV.SLACK)) !== null; }      // at most 3 route checks a second
    else ok = room.sim.moveOk(p.x, p.y, x, y, v.bud + MV.SLACK);
    if (ok) {                                                               // Stage 3D HQ2: then the other living players (server/peers.js)
      const ps = blockers(room, me);
      if (ps.length) {
        const r = route && route.length                                     // a long hop allowed only round walls: swept along that route; else along the line
          ? PEERS.sweepPath(p.x, p.y, route.concat([[x, y]]), ps, PD)
          : PEERS.resolve(p.x, p.y, x, y, ps, PD, (ax, ay) => room.sim.moveOk(p.x, p.y, ax, ay, v.bud + MV.SLACK));
        if (r.how !== 'free') {
          if (now < v.grace) { me.mvRefused = (me.mvRefused | 0) + 1; return false; }   // just after a server-side placement: a packet sent before it (back towards the old spot) is ignored, as a refused one is
          me.peerHits = (me.peerHits | 0) + 1;
          v.bud = Math.max(-MV.SLACK, v.bud - Math.hypot(r.x - p.x, r.y - p.y)); v.bad = 0; mvAccept(me, r.x, r.y);
          peerCorrect(me, Math.hypot(x - r.x, y - r.y), now);
          return true;
        }
      }
    }
  }
  if (ok) { v.bud = Math.max(-MV.SLACK, v.bud - d); v.bad = 0; v.pcSince = 0; mvAccept(me, x, y); return true; }       // the slack is a debt, not a free allowance per packet
  me.mvRefused = (me.mvRefused | 0) + 1;
  if (now < v.grace) return false;                                          // packets sent before a server-side move: ignore them
  if (!v.bad) v.badAt = now; v.bad++;
  if (d > MV.SNAP || now - v.badAt > 600) { v.bad = 0; v.grace = now + MV.GRACE; me.mvCorr = (me.mvCorr | 0) + 1; send(me, { t: 'tp', x: Math.round(p.x), y: Math.round(p.y) }); }
  return false;
}
/* a server-side move of a player (spawn, admin tools): set it, tell the client when asked, and restart the movement check from there */
function moveTo(room, me, x, y, tell = true) {                                // (Stage 3D HQ2: onto a free spot near (x, y): never into another player)
  Object.assign(me.player, { x, y }); placeFree(room, me); if (tell) send(me, { t: 'tp', x: Math.round(me.player.x), y: Math.round(me.player.y) }); mvReset(me);
}
/* Stage 3D HQ2: an admin's own moves skip the walls (its debug tools move it from its client), not the other players: a step is resolved
 * like anyone's; a jump (120 px or more: a teleport) is not swept - it lands where it was aimed unless that is inside a player (closer
 * than D), and then on the nearest free spot */
function adminMove(room, me, x, y) {
  const p = me.player, ps = blockers(room, me);
  if (!ps.length) return mvAccept(me, x, y);
  if (Math.hypot(x - p.x, y - p.y) < 120) {
    const r = PEERS.resolve(p.x, p.y, x, y, ps, PD);
    if (r.how !== 'free' && Date.now() < me.mv.grace) return;              // (as mvCheck: a packet sent before its own jump was moved is ignored)
    mvAccept(me, r.x, r.y); if (r.how !== 'free') { me.peerHits = (me.peerHits | 0) + 1; peerCorrect(me, Math.hypot(x - r.x, y - r.y), Date.now()); } return;
  }
  if (ps.every(q => (x - q[0]) * (x - q[0]) + (y - q[1]) * (y - q[1]) >= PD * PD)) return mvAccept(me, x, y);
  const f = PEERS.freeSpot(x, y, ps, (a, b, r) => room.sim.clearAt(a, b, r), PD);
  mvAccept(me, f.x, f.y); if (f.moved) { me.mv.grace = Date.now() + MV.GRACE; send(me, { t: 'tp', x: f.x, y: f.y }); }
}

return { MV, PD, blockers, placeFree, mvReset, mvCheck, moveTo, adminMove };
};
