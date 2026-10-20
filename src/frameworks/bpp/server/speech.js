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
 * The speaker's voice (post-Trial 4 chat polish C4; docs/architecture/CHAT.md, "Voices"): a line may carry v = {p, h, s}, the voice its
 * speaker chose (a preset name, a pitch in semitones, a speed in percent).  It is checked here and passed on with the accepted line as
 * {p, h, s} or null: p one of VOICES (exactly, nothing else; otherwise the whole voice is null), h a whole number -12..12 (else 0), s a
 * whole number 50..200 (else 100); every other field of v is dropped.  It decides nothing: who hears, the room, the radius, life, the
 * rate and the text rules are exactly as without it; the speaker is still the connection, never anything in the packet.  No sound,
 * no audio and nothing but these three small values travels: each page makes its own chirps (F.R.O.N.T.'s voice.js).
 *
 * The entity contract (docs/architecture/CHAT.md, "onLocallyHeardSpeech"; Trial 3, dev/trial-3-skin-stealer/DESIGN_DECISIONS.md D9):
 * ON_HEARD is the onHeard server.js gives (null when none is given: the unit checks' own instance, and every server before Trial 3).  It
 * is called once for a line this module ACCEPTED and delivered - after every rule above - with the speaker's room and
 * {id, x, y, text}: the session id, the server's position, the cleaned text.  Never for a refused line, never for the lounge (its lines
 * never come through this module), never with anything from the packet but its text.  server.js hands it to that room's AI engine
 * (eng.hearSpeech), where only a Skin-Stealer within the same 576 px keeps it, for a while (N.A.N.I.'s ai.skinstealer.js).
 * entitySay(sim, L): a line an entity says (the engine's voiceOut).  Its own packet, {t:'eheard', e, text, seq, v, o} - e the entity id,
 * v {h, s} its voice, o the session id of the person whose words it repeats (0 for a generic call; a page that has muted that person
 * mutes the echo) - and never a 'heard' or a session id as its speaker, so no page can take it for a person's line.  The text passes
 * cleanText again; it reaches the living players of the same room within HEAR px of the entity (the server's positions), never the
 * menu, the dead or another room; a token bucket per entity (E_BURST lines every E_WINDOW ms) and the same slow-socket skip.
 *
 * Given by server.js: rooms (the core's Map of rooms), send, cleanText, onHeard (Trial 3) (and, by the unit checks only, limits).  No
 * timer.  Never served. */
module.exports = ({ rooms, send, cleanText, limits, onHeard }) => {
// HEAR: px, 6 cells of 96 px (about 1.6 s at the fastest legal motion, 360 px/s).  limits: only the unit checks pass it (server.js never does)
const { HEAR, BURST, WINDOW, REPEAT, SLOW_BYTES, E_BURST, E_WINDOW } = Object.assign({ HEAR: 576, BURST: 3, WINDOW: 5000, REPEAT: 3000, SLOW_BYTES: 256 * 1024, E_BURST: 1, E_WINDOW: 6000 }, limits);
const ON_HEARD = typeof onHeard === 'function' ? onHeard : null;   // the entity hook (see above): server.js's onHeard, or null
const VOICES = ['classic', 'soft', 'deep', 'electronic', 'static', 'hollow', 'chime'];   // (C4) the page's presets (voice.js), checked equal by chat_server.js
const whole = (v, a, z, d) => Number.isInteger(v) && v >= a && v <= z ? v : d;
function voiceOf(v) {                   // (C4) the speaker's voice, checked: {p, h, s} or null
  if (v === null || typeof v !== 'object' || Array.isArray(v) || typeof v.p !== 'string' || !VOICES.includes(v.p)) return null;
  return { p: v.p, h: whole(v.h, -12, 12, 0), s: whole(v.s, 50, 200, 100) };
}
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
  // The color belongs to the authenticated speaker's accepted message. Ignore every client-supplied identity
  // and never interpolate unchecked values into client CSS. Old clients simply get the neutral bubble accent.
  const color = typeof m.c === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.c) ? m.c.toLowerCase() : '';
  const ev = { t: 'heard', id: me.id, text: c.text, seq: ++seq, c: color, v: voiceOf(m.v) };
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
  if (ON_HEARD) { try { ON_HEARD(room, { id: me.id, x, y, text: c.text }); } catch (e) { stats.hookErr = (stats.hookErr | 0) + 1; } }   // (Trial 3) an accepted line, to the room's engine
}
/* (Trial 3) a line said by an entity (see above): returns how many players it reached */
const ents = new WeakMap();             // a room's sim -> Map(entity id -> its bucket { tokens, at })
function entitySay(sim, L) {
  let room = null; for (const r of rooms.values()) if (r.sim === sim) { room = r; break; }
  if (!room || !L || !Number.isSafeInteger(L.e) || L.e < 1 || !Number.isFinite(L.x) || !Number.isFinite(L.y)) return 0;
  const c = cleanText(L.text); if (!c.ok) { stats.eRefused = (stats.eRefused | 0) + 1; return 0; }
  let M = ents.get(sim); if (!M) ents.set(sim, M = new Map());
  const now = Date.now(); let b = M.get(L.e);
  if (!b) { b = { tokens: E_BURST, at: now }; M.set(L.e, b); if (M.size > 64) M.delete(M.keys().next().value); }
  b.tokens = Math.min(E_BURST, b.tokens + (now - b.at) * E_BURST / E_WINDOW); b.at = now;
  if (b.tokens < 1) { stats.eRefused = (stats.eRefused | 0) + 1; return 0; }
  b.tokens -= 1;
  const v = L.v && typeof L.v === 'object' ? L.v : L, ev = { t: 'eheard', e: L.e, text: c.text, seq: ++seq, v: { h: whole(v.h, -12, 12, 0), s: whole(v.s, 50, 200, 100) }, o: Number.isSafeInteger(L.o) && L.o > 0 ? L.o : 0 };
  let n = 0;
  for (const w of room.clients.values()) {
    const pl = w.player; if (!pl.active || pl.dead) continue;
    const ex = pl.x - L.x, ey = pl.y - L.y; if (ex * ex + ey * ey > HEAR * HEAR) continue;
    if (w.sock.writableLength > SLOW_BYTES) continue;
    send(w, ev); n++;
  }
  stats.eSaid = (stats.eSaid | 0) + 1; stats.eHeard = (stats.eHeard | 0) + n;
  return n;
}
const readerFor = reader => (sock, onMessage) => reader(sock, m => (m !== null && typeof m === 'object' && m.t === 'say') ? say(sock, m) : onMessage(m));

return { HEAR, BURST, WINDOW, VOICES: VOICES.slice(), readerFor, stats: () => JSON.parse(JSON.stringify(stats)), ON_HEARD, entitySay };
};
