/* src/frameworks/bpp/server/speech.js - B++ on the server: nearby speech in a run (post-3H Trial 2; docs/architecture/CHAT.md).
 *
 * A player in a run may say one short line ({t:'say', text}) on the game's own WebSocket.  The server alone decides who hears it:
 *   - the speaker is the connection the packet came in on, as the session knows it (its room, its player, its server-side position).
 *     Nothing in the packet but its text is read: an x, y, room, id, name or admin flag in it is ignored.
 *   - it may speak only while in the world and alive (the session's player: active and not dead; a player held by a monster is still
 *     alive and may speak).  From the menu, dead or leaving: refused ({t:'said', ok:0, why:'menu' | 'dead'}), nobody hears it.
 *   - it is heard by every player of the SAME room who is in the world and alive and within HEAR px (Euclidean, at this moment, the
 *     server's positions) of the speaker, the speaker included (that is its delivery receipt): {t:'heard', id, text, seq}.  id is the
 *     speaker's session id (every client of the room already has it, with its position, from the snapshots); no position, room or name
 *     is added.  Walls do not stop it (no line-of-sight is invented here; the radius is the rule).  Nobody else gets anything: not the
 *     other rooms, not the menu, not the dead.
 *   - per connection: a token bucket of BURST lines, refilled at BURST every WINDOW ms, paid by every 'say' packet, valid or not; an
 *     empty bucket refuses with why 'slow' and wait (seconds), told at most once a second.  The same text again within REPEAT ms is
 *     refused ('repeat').  The text passes W.A.R.D.'s cleanText (ward/server/chat_text.js) or is refused with its reason.
 *   - a recipient whose socket already holds more than SLOW_BYTES of unsent output is skipped for speech (the game's own messages are
 *     not touched).
 * Event-driven: nothing runs on the loop's ticks; one 'say' costs a look through its own room's clients (at most MAX_ROOM).
 *
 * How it is reached without changing the session (session.js is the session moved verbatim, with its move proof): server.js gives the
 * session readerFor(reader) instead of the bare reader.  It hands every parsed message to the session exactly as before, except a
 * {t:'say'}, which the session never read (it had no branch for it), and which comes here instead.  The connection's room and record are
 * found once, by its socket, in the rooms' client maps, and checked again at every line (a connection that has left speaks no more).
 *
 * The future-entity contract (docs/architecture/CHAT.md, "onLocallyHeardSpeech"): INERT.  No AI, monster or other module is given these
 * lines; ON_HEARD below is null and nothing assigns it.  Menu lounge lines never come through this module at all.
 *
 * Given by server.js: rooms (the core's Map of rooms), send, cleanText (and, by the unit checks only, limits).  No timer.  Never served. */
module.exports = ({ rooms, send, cleanText, limits }) => {
// HEAR: px, 6 cells of 96 px (about 1.6 s at the fastest legal motion, 360 px/s).  limits: only the unit checks pass it (server.js never does)
const { HEAR, BURST, WINDOW, REPEAT, SLOW_BYTES } = Object.assign({ HEAR: 576, BURST: 3, WINDOW: 5000, REPEAT: 3000, SLOW_BYTES: 256 * 1024 }, limits);
const ON_HEARD = null;                  // the inert future-entity hook (see above): never assigned, never called
const conns = new WeakMap();            // socket -> { room, me, tokens, at, slowAt, last, lastAt }
const stats = { said: 0, heard: 0, refused: {} };
let seq = 0;

function find(sock) {
  for (const room of rooms.values()) for (const me of room.clients.values()) if (me.sock === sock) return { room, me };
  return null;
}
function refuse(st, why, extra) { stats.refused[why] = (stats.refused[why] | 0) + 1; send(st.me, Object.assign({ t: 'said', ok: 0, why }, extra)); }
function say(sock, m) {
  let st = conns.get(sock);
  if (!st) { const f = find(sock); if (!f) return; st = { room: f.room, me: f.me, tokens: BURST, at: Date.now(), slowAt: 0, last: '', lastAt: 0 }; conns.set(sock, st); }
  const { room, me } = st;
  if (rooms.get(room.name) !== room || room.clients.get(me.id) !== me || sock.destroyed) return;   // left the room: nothing more
  const now = Date.now();
  st.tokens = Math.min(BURST, st.tokens + (now - st.at) * BURST / WINDOW); st.at = now;
  if (st.tokens < 1) {
    if (now - st.slowAt >= 1000) { st.slowAt = now; refuse(st, 'slow', { wait: Math.ceil((1 - st.tokens) * WINDOW / BURST / 1000) }); }
    else stats.refused.slow = (stats.refused.slow | 0) + 1;
    return;
  }
  st.tokens -= 1;
  const p = me.player;
  if (!p.active) return refuse(st, 'menu');
  if (p.dead) return refuse(st, 'dead');
  const c = cleanText(m.text);
  if (!c.ok) return refuse(st, c.why);
  if (c.text === st.last && now - st.lastAt < REPEAT) return refuse(st, 'repeat');
  st.last = c.text; st.lastAt = now;
  const ev = { t: 'heard', id: me.id, text: c.text, seq: ++seq };
  stats.said++;
  const x = p.x, y = p.y;
  for (const o of room.clients.values()) {
    const q = o.player;
    if (!q.active || q.dead) continue;
    const dx = q.x - x, dy = q.y - y;
    if (dx * dx + dy * dy > HEAR * HEAR) continue;
    if (o.sock.writableLength > SLOW_BYTES) continue;
    send(o, ev); stats.heard++;
  }
}
const readerFor = reader => (sock, onMessage) => reader(sock, m => (m !== null && typeof m === 'object' && m.t === 'say') ? say(sock, m) : onMessage(m));

return { HEAR, BURST, WINDOW, readerFor, stats: () => JSON.parse(JSON.stringify(stats)), ON_HEARD };
};
