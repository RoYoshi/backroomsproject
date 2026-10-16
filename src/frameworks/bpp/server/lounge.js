/* src/frameworks/bpp/server/lounge.js - B++ on the server: the main menu's lounge (post-3H Trial 2; docs/architecture/CHAT.md).
 *
 * One global chat for everyone on the main menu of THIS server process, whatever ?room= they will play in.  It is its own WebSocket,
 * /social, beside the game's /ws: no world, no player, no room slot, nothing of the game's protocol.  A lounge socket can only say
 * hello, send a line, change its nickname and keep alive; a game packet sent here is just an invalid message.  It is not shared between
 * server processes (that would need a broker and a separate deployment decision); it keeps no history, no transcript, no log of what is
 * said: a line goes to the sockets in the lounge at that moment and is gone.
 *
 * The upgrade (only for a request server.js's dispatcher routes here, path /social): GET with Upgrade: websocket, a well-formed
 * Sec-WebSocket-Key, Sec-WebSocket-Version 13, and an Origin whose host is the request's Host (or its X-Forwarded-Host, for a reverse
 * proxy that rewrites Host): a page of this site, never another site's.  No extension is accepted (no compression).  At most
 * MAX_SOCKETS sockets at once, and at most JOINS new ones every JOIN_WINDOW ms for the whole lounge; otherwise refused with an HTTP status.
 * Client addresses are not used: X-Forwarded-For can be forged, and behind a proxy the socket's own address is the proxy's.
 *
 * The protocol (v1; JSON text frames; the WebSocket reader is B++'s server/ws.js, text frames under 1,400 bytes):
 *   client  {t:'social_hello', nick}          first, once, within HELLO_MS of the upgrade
 *           {t:'social_send', text}           a line (W.A.R.D.'s cleanText: 160 code points, 600 UTF-8 bytes)
 *           {t:'social_nick', nick}           a new nickname (paid like a line)
 *           {t:'social_ping'}                 keep-alive (the socket closes after IDLE_MS without anything from the client)
 *   server  {t:'social_welcome', v:1, id, nick, online}   the server-given id of this connection, its cleaned nickname
 *           {t:'social_message', id, nick, text, seq}     a line, to every socket in the lounge (the sender's own is its receipt)
 *           {t:'social_nick', nick}                       the nickname now in use
 *           {t:'social_error', why[, wait]}               a refused line: slow (wait s), empty, long, bad, repeat, busy (the lounge's own
 *                                                         budget), never the text
 *           {t:'social_count', online}                    how many are in the lounge, at most once every COUNT_MS
 * Nicknames are not accounts: anyone may type any name, and the page says so.  ids are per connection (a new connection is a new id).
 *
 * Limits: per socket, a token bucket of BURST lines per WINDOW ms (every send and nick pays), the same text again within REPEAT ms
 * refused, at most RX_BYTES received per RX_WINDOW ms and at most BAD invalid messages in its life (else the socket is destroyed).  For
 * the lounge, at most LINES lines a second (a bucket of 2 s), else 'busy'.  Each socket's unsent output: over SOFT_BYTES a line is not
 * queued for it, over HARD_BYTES the socket is destroyed.  Everything is event-driven; one sweep timer runs only while a socket is open.
 *
 * Given by server.js: crypto (Node's), frame and reader (B++'s ws.js), cleanText and cleanNick (W.A.R.D.); by the unit checks only, limits.
 * Never served. */
module.exports = ({ crypto, frame, reader, cleanText, cleanNick, limits }) => {
const { MAX_SOCKETS, JOINS, JOIN_WINDOW, HELLO_MS, IDLE_MS, SWEEP_MS, BURST, WINDOW, REPEAT, LINES, BAD, RX_BYTES, RX_WINDOW, COUNT_MS, SOFT_BYTES, HARD_BYTES } = Object.assign({
  MAX_SOCKETS: 64, JOINS: 30, JOIN_WINDOW: 10000, HELLO_MS: 10000, IDLE_MS: 75000, SWEEP_MS: 5000,
  BURST: 3, WINDOW: 5000, REPEAT: 3000, LINES: 10, BAD: 8, RX_BYTES: 16384, RX_WINDOW: 10000, COUNT_MS: 2000,
  SOFT_BYTES: 64 * 1024, HARD_BYTES: 256 * 1024 }, limits);              // limits: only the unit checks pass it (server.js never does)
const socks = new Set();                 // every open lounge socket (said hello or not)
const members = new Set();               // those that said hello: they get the lines
let nextId = 1, seq = 0, joinTokens = JOINS, joinAt = Date.now(), lineTokens = 2 * LINES, lineAt = Date.now(), sweepT = null, countT = null, countAt = 0;
const stats = { upgrades: 0, refused: {}, lines: 0, delivered: 0, skipped: 0, destroyed: {} };
const count = (o, k) => { o[k] = (o[k] | 0) + 1; };

function deny(sock, code, text, why) {                                   // an HTTP answer, then the socket is closed (destroyed after 1 s at the latest)
  count(stats.refused, why); sock.on('error', () => { });
  try { sock.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch (e) { sock.destroy(); return; }
  const t = setTimeout(() => sock.destroy(), 1000); if (t.unref) t.unref();
}
function sameOrigin(req) {
  const o = req.headers.origin; if (typeof o !== 'string') return false;
  let u; try { u = new URL(o); } catch (e) { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.host.toLowerCase(), h = String(req.headers.host || '').toLowerCase(), fh = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim().toLowerCase();
  return !!host && (host === h || (!!fh && host === fh));
}
function put(s, obj) {
  const sock = s.sock; if (sock.destroyed) return false;
  const wl = sock.writableLength;
  if (wl > HARD_BYTES) { count(stats.destroyed, 'backlog'); sock.destroy(); return false; }
  if (wl > SOFT_BYTES) { stats.skipped++; return false; }
  const f = frame(JSON.stringify(obj)); if (!f) return false;
  sock.write(f); return true;
}
function countLater() {
  if (countT) return;
  countT = setTimeout(() => { countT = null; countAt = Date.now(); const m = { t: 'social_count', online: members.size }; for (const s of members) put(s, m); }, Math.max(0, countAt + COUNT_MS - Date.now()));
  if (countT.unref) countT.unref();
}
function sweep() {
  const now = Date.now();
  for (const s of socks) {
    if (s.nick === null && now - s.at > HELLO_MS) { count(stats.destroyed, 'no hello'); s.sock.destroy(); }
    else if (now - s.rxLast > IDLE_MS) { count(stats.destroyed, 'idle'); s.sock.destroy(); }
  }
}
function refill(now) {
  joinTokens = Math.min(JOINS, joinTokens + (now - joinAt) * JOINS / JOIN_WINDOW); joinAt = now;
  lineTokens = Math.min(2 * LINES, lineTokens + (now - lineAt) * LINES / 1000); lineAt = now;
}

function upgrade(req, sock, head) {
  stats.upgrades++;
  const key = req.headers['sec-websocket-key'];
  if (req.method !== 'GET' || String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) || req.headers['sec-websocket-version'] !== '13') return deny(sock, 400, 'Bad Request', 'handshake');
  if (!sameOrigin(req)) return deny(sock, 403, 'Forbidden', 'origin');
  if (socks.size >= MAX_SOCKETS) return deny(sock, 503, 'Service Unavailable', 'full');
  const now = Date.now(); refill(now);
  if (joinTokens < 1) return deny(sock, 429, 'Too Many Requests', 'joins');
  joinTokens -= 1;
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
    crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\n\r\n');
  sock.setNoDelay(true);
  const s = { sock, id: nextId++, nick: null, at: now, rxLast: now, rx: 0, rxAt: now, tokens: BURST, tAt: now, bad: 0, last: '', lastAt: 0, slowAt: 0 };
  socks.add(s);
  if (!sweepT) { sweepT = setInterval(sweep, SWEEP_MS); if (sweepT.unref) sweepT.unref(); }

  const bad = () => { if (++s.bad > BAD) { count(stats.destroyed, 'invalid'); sock.destroy(); } };
  const pay = t => {                                                     // one token of this socket's bucket; false (and told, at most once a second) if none
    s.tokens = Math.min(BURST, s.tokens + (t - s.tAt) * BURST / WINDOW); s.tAt = t;
    if (s.tokens >= 1) { s.tokens -= 1; return true; }
    if (t - s.slowAt >= 1000) { s.slowAt = t; put(s, { t: 'social_error', why: 'slow', wait: Math.ceil((1 - s.tokens) * WINDOW / BURST / 1000) }); }
    count(stats.refused, 'slow'); return false;
  };
  function onMessage(m) {
    if (m === null || typeof m !== 'object' || typeof m.t !== 'string') return bad();
    const t = Date.now();
    if (m.t === 'social_ping') return;
    if (m.t === 'social_hello') {
      if (s.nick !== null) return bad();
      s.nick = cleanNick(m.nick); members.add(s);
      put(s, { t: 'social_welcome', v: 1, id: s.id, nick: s.nick, online: members.size }); countLater(); return;
    }
    if (s.nick === null) return bad();                                   // nothing before hello
    if (m.t === 'social_nick') { if (!pay(t)) return; s.nick = cleanNick(m.nick); put(s, { t: 'social_nick', nick: s.nick }); return; }
    if (m.t !== 'social_send') return bad();
    if (!pay(t)) return;
    const c = cleanText(m.text);
    if (!c.ok) { count(stats.refused, c.why); put(s, { t: 'social_error', why: c.why }); return; }
    if (c.text === s.last && t - s.lastAt < REPEAT) { count(stats.refused, 'repeat'); put(s, { t: 'social_error', why: 'repeat' }); return; }
    refill(t);
    if (lineTokens < 1) { count(stats.refused, 'busy'); put(s, { t: 'social_error', why: 'busy' }); return; }
    lineTokens -= 1; s.last = c.text; s.lastAt = t;
    const ev = { t: 'social_message', id: s.id, nick: s.nick, text: c.text, seq: ++seq };
    stats.lines++;
    for (const o of members) if (put(o, ev)) stats.delivered++;
  }
  const rd = reader(sock, onMessage);
  const onData = d => {
    const t = Date.now(); s.rxLast = t;
    if (t - s.rxAt > RX_WINDOW) { s.rxAt = t; s.rx = 0; }
    s.rx += d.length;
    if (s.rx > RX_BYTES) { count(stats.destroyed, 'bytes'); return sock.destroy(); }
    rd(d);
  };
  sock.on('data', onData);
  const bye = () => {
    if (!socks.delete(s)) return;
    if (members.delete(s)) countLater();
    if (!socks.size && sweepT) { clearInterval(sweepT); sweepT = null; }
  };
  sock.on('error', bye); sock.on('close', bye); sock.on('end', () => sock.end());   // (this order: the session mutants' search text names the session's own line)
  if (head && head.length) onData(head);
}

return { upgrade, stats: () => Object.assign(JSON.parse(JSON.stringify(stats)), { sockets: socks.size, members: members.size }), MAX_SOCKETS };
};
