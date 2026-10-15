/* src/frameworks/ward/server/admin_login.js - W.A.R.D. on the server: the admin login.  A client's {t:'admin', pass} is checked here:
 * the passcode against its SHA-256 in constant time, and a failure map that locks a client identity out for 60 s after its fifth wrong
 * guess.  Whether a connection is an admin is the connection's own flag (me.admin), set here and read by the session; nothing else
 * grants it.
 *
 * Stage 3H continuation (C2): moved out of server.js without a change, with the owner's approval to relocate this code (not to change
 * it).  Every line between the factory's first line and its return is server.js's own at M8 (c34f0c2: lines 13-16 and 116-119),
 * comments and indentation included, except the one line that names the function, marked (C2); dev/stage-3h/tools/h2_move_proof.js
 * checks it (dev/stage-3h-modernization/evidence/c2/).  The passcode's source stays in server.js's configuration, which gives it here.
 *   adminLogin(me, m, ip, name, id)   one {t:'admin'} message of connection me (client identity ip, room name, connection id): it
 *                                     answers {t:'admin', ok, wait | q} and logs one line; me.admin becomes true on a correct passcode
 * Given by server.js: crypto (Node's), ADMIN_PASS (the configured passcode) and send(c, obj).  No timer.  Never served: the server's
 * allowlist reaches only public/. */
module.exports = ({ crypto, ADMIN_PASS, send }) => {
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const ADMIN_HASH = sha(ADMIN_PASS);
const passOk = s => crypto.timingSafeEqual(sha(s), ADMIN_HASH);
const fails = new Map();                        // ip -> { n, until }  (5 wrong guesses = 60 s lockout)
function adminLogin(me, m, ip, name, id) {                             // (C2) the body of the session's {t:'admin'} branch, as it was
      const now = Date.now(), f = fails.get(ip) || { n: 0, until: 0 };
      if (now < f.until) return send(me, { t: 'admin', ok: false, wait: Math.ceil((f.until - now) / 1000) });
      if (passOk(m.pass)) { me.admin = true; fails.delete(ip); console.log(`[admin] ${me.name}#${id} unlocked admin (room ${name})`); send(me, { t: 'admin', ok: true, q: m.quiet ? 1 : 0 }); }
      else { if (++f.n >= 5) { f.until = now + 60000; f.n = 0; } fails.set(ip, f); console.log(`[admin] ${me.name}#${id} wrong admin passcode (room ${name})`); send(me, { t: 'admin', ok: false, wait: f.until > now ? 60 : 0 }); }
}

return { adminLogin };
};
