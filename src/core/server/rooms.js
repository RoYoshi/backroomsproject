/* src/core/server/rooms.js - the rooms: one world per ?room=NAME, made on first use and thrown away when its last client leaves; and the
 * admin world reset, a new world epoch for everyone in a room.
 *
 * Stage 3H engine modernization (H3M-2): moved out of server.js without a change.  Every line between the factory's first line and its
 * return is server.js's own (at checkpoint M6a, f2db9d8: lines 26, 119-136 and 166-171), comments and column included: nothing is
 * re-indented, so each line can be compared with server.js as it was (dev/stage-3h/tools/h2_move_proof.js does:
 * dev/stage-3h-modernization/evidence/m2/).
 *   rooms               the Map name -> room (the session deletes a room when it empties; the loop walks them)
 *   getRoom(name)       the room of that name, made with a new world (the built sim.js) on first use
 *   worldReset(room)    the admin world reset (Stage 3D HQ2)
 * What it uses of the server is given by server.js, never required: createSim (the built sim.js, which server.js still requires
 * itself, where it always did), BODY_TTL (server.js's configuration), aftStart (G.I.B.: a death's aftermath, the world's onDeath),
 * placeFree and mvReset (S.P.A.C.E.) and send(c, obj).  No timer.  Never served. */
module.exports = ({ createSim, BODY_TTL, aftStart, placeFree, mvReset, send }) => {
const rooms = new Map();
/* Stage 3D HQ2 (H2-4): an admin world reset is a new world epoch for everyone.  In one step: the world's number goes up (sim.resetWorld,
 * which also clears every corpse); every death or NEW RUN blast still playing is dropped at once (no corpse will come of it); every
 * client is told {t:'world', w} - with x, y, where it now stands, if it is in a run - and then an 'end' for each dropped event; every
 * active player is brought back (sim.resetWorld respawns them, the dead included) onto a free spot, and told by tp as before.  A client
 * ends everything of the old world on its screen (mp.js worldNew) and ignores any death, blast or corpse message naming an older world.
 * The reset answers no NEW RUN, explodes nobody and starts nobody's cooldown. */
function worldReset(room) {
  const A = room.sim.admin, w0 = room.sim.worldSeq; A.resetWorld();
  const w = room.sim.worldSeq, ends = [];
  for (const a of room.afts || []) if (!a.body && a.world === w0) { a.body = true; a.dropped = 'world reset'; a.run = null; ends.push({ t: 'fx', k: 'end', id: a.id, de: a.de, wn: w }); }
  for (const c of room.clients.values()) {
    const msg = { t: 'world', w };
    if (c.player.active) { placeFree(room, c); msg.x = Math.round(c.player.x); msg.y = Math.round(c.player.y); }
    send(c, msg); for (const e of ends) send(c, e);
    if (c.player.active) send(c, { t: 'tp', x: msg.x, y: msg.y });
    mvReset(c);
  }
}
function getRoom(name) {
  let r = rooms.get(name);
  if (!r) { const room = r = { name, clients: new Map(), sim: createSim({ bodyTtl: BODY_TTL, onDeath: p => { const c = room.clients.get(p.id); if (c) aftStart(room, c); } }), acc: 0, last: Date.now(), tick: 0, pf: { ms: 0, max: 0, snapB: 0, sense: 0, paths: 0, at: Date.now() } }; rooms.set(name, r); }
  return r;
}

return { rooms, getRoom, worldReset };
};
