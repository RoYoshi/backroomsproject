/* src/frameworks/bpp/server/poses.js - B++ on the server: the fresher player poses ('q') between two snapshots (Stage 3E-0 B+), for the
 * clients that asked for them ({t:'caps', fp:1}).
 *
 * Stage 3H engine modernization (H3M-2): moved out of server.js without a change.  Every line between the factory's first line and its
 * return is server.js's own (at checkpoint M6a, f2db9d8: lines 314-330), comments and column included: nothing is re-indented, so each
 * line can be compared with server.js as it was (dev/stage-3h/tools/h2_move_proof.js does: dev/stage-3h-modernization/evidence/m2/).
 *   poseSend(room)   on a tick between two snapshots: to each client that asked, the other players' poses that changed
 * What it uses of the server is given by server.js, never required: send(c, obj).  No timer.  Never served. */
module.exports = ({ send }) => {
/* Stage 3E-0 (B+): on a tick between two full snapshots, to every client in a run that asked for it: each OTHER active, living player whose
 * accepted position or heading changed since the last snapshot said it - its id, x, y, heading and nothing else (no cosmetics, no state:
 * those stay in the snapshot) - with the world epoch (w) and the tick (k).  Only players the last snapshot listed; nothing new: nothing sent */
function poseSend(room) {
  let ch = null;
  for (const c of room.clients.values()) {
    const s = c.snap; if (!s || !c.player.active || c.player.dead) continue;
    const x = Math.round(c.player.x), y = Math.round(c.player.y), a = +c.angle.toFixed(2);
    if (x !== s[0] || y !== s[1] || a !== s[2]) (ch || (ch = [])).push([c.id, x, y, a]);
  }
  if (!ch) return;
  for (const c of room.clients.values()) {
    if (!c.fp || !c.player.active) continue;
    const p = ch.filter(q => q[0] !== c.id); if (p.length) send(c, { t: 'q', w: room.sim.worldSeq, k: room.tick, p });
  }
}

return { poseSend };
};
