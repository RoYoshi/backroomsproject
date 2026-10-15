/* Stage 3H continuation (C2) - one-line mutants of the WebSocket session and the admin login (development only; never served).
 *
 *   node dev/tools/gate/golden/bpp_mutants.js --scenarios dev/tools/gate/golden/srv_scenarios_session.js --mutants dev/tools/gate/golden/session_mutants.js
 *
 * Each mutant changes one thing the session or the login does; at least one session scenario's trace must change, which proves the
 * scenarios see that code wherever it lives (bpp_mutants.js looks the text up in every server file).  None is a proposal: they exist to be
 * caught. */
'use strict';
module.exports = [
  { id: 'login_threshold_6', scenarios: ['session_login'], find: 'if (++f.n >= 5) { f.until = now + 60000;', repl: 'if (++f.n >= 6) { f.until = now + 60000;', why: 'the lockout after six wrong guesses instead of five' },
  { id: 'login_lock_59s', scenarios: ['session_login'], find: 'f.until = now + 60000; f.n = 0;', repl: 'f.until = now + 59000; f.n = 0;', why: 'a lockout of 59 s instead of 60 s' },
  { id: 'login_count_kept', scenarios: ['session_login'], find: 'me.admin = true; fails.delete(ip);', repl: 'me.admin = true;', why: 'a correct passcode no longer clears the count of wrong guesses' },
  { id: 'login_count_not_reset', scenarios: ['session_login'], find: 'f.until = now + 60000; f.n = 0;', repl: 'f.until = now + 60000;', why: 'the count is not reset when the lockout starts' },
  { id: 'login_wait_floor', scenarios: ['session_login'], find: 'wait: Math.ceil((f.until - now) / 1000)', repl: 'wait: Math.floor((f.until - now) / 1000)', why: 'the time left rounded down instead of up' },
  { id: 'login_quiet_ignored', scenarios: ['session_login'], find: "send(me, { t: 'admin', ok: true, q: m.quiet ? 1 : 0 });", repl: "send(me, { t: 'admin', ok: true, q: 0 });", why: 'the quiet login answered as a loud one' },
  { id: 'login_locked_unlocks', scenarios: ['session_login'], find: "if (now < f.until) return send(me, { t: 'admin', ok: false,", repl: "if (false) return send(me, { t: 'admin', ok: false,", why: 'the passcode accepted during a lockout' },
  { id: 'identity_last_entry', scenarios: ['session_identity'], find: ".split(',')[0].trim();", repl: ".split(',').pop().trim();", why: "the client identity taken from the forwarded header's last entry instead of its first" },
  { id: 'identity_socket_only', scenarios: ['session_identity'], find: "String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')", repl: "String(req.socket.remoteAddress || '')", why: 'the client identity taken from the socket only' },
  { id: 'commands_unchecked', scenarios: ['session_login'], find: "else if (m.t === 'a') { if (me.admin) adminCommand(room, me, m); }", repl: "else if (m.t === 'a') { adminCommand(room, me, m); }", why: 'admin commands accepted from any connection' },
  { id: 'ping_gap_300', scenarios: ['session_wire'], find: 't - (me.pingAt || 0) > 400', repl: 't - (me.pingAt || 0) > 300', why: 'pongs answered every 300 ms instead of 400' },
  { id: 'room_cap_9', scenarios: ['session_wire'], find: 'if (room.clients.size >= MAX_ROOM) return sock.destroy();', repl: 'if (room.clients.size > MAX_ROOM) return sock.destroy();', why: 'a ninth connection admitted to a room' },
  { id: 'caps_loose', scenarios: ['session_wire'], find: "me.fp = m.fp === 1;", repl: "me.fp = !!m.fp;", why: 'the fresher poses switched on by any true value' },
  { id: 'room_kept', scenarios: ['session_wire'], find: 'if (!room.clients.size) rooms.delete(name);', repl: 'if (false) rooms.delete(name);', why: 'an empty room is kept instead of thrown away' },
  { id: 'error_ignored', scenarios: ['session_wire'], find: "sock.on('close', bye); sock.on('error', bye);", repl: "sock.on('close', bye);", why: "a socket's error no longer ends its connection at once" },
];
