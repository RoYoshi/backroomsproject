#!/usr/bin/env python3
"""Stage 3H continuation (C2) - the WebSocket session and the admin login moved out of server.js, by moving lines verbatim (development only).

  python3 -I -B dev/stage-3h-modernization/tools/c2_split_session.py --apply    split the working tree's server.js (it must be M8's)
  python3 -I -B dev/stage-3h-modernization/tools/c2_split_session.py --check    rebuild the split from M8's server.js (read from Git) and
                                                                                  compare it with the working tree's three files

The parent is M8 (c34f0c2; C0 did not touch server.js): server.js Git blob b58e9117...  The owner approved moving this code (2026-10-14)
as a relocation only: no authentication decision, passcode source, lockout, privilege or trust rule may change.  So every line moves as
it is, indentation included, and dev/stage-3h/tools/h2_move_proof.js can find each one.

What moves (line numbers of the parent's server.js):
  src/frameworks/ward/server/admin_login.js   13-16, 116-119   W.A.R.D.: the passcode's hash and constant-time check, the failure map, and
                                                               the body of the {t:'admin'} branch (unlock, or a wrong guess counted)
  src/frameworks/bpp/server/session.js        26, 61-115,      B++: the connection counter, and the whole upgrade handler: the handshake,
                                              120-136          each connection's state, every message type, the leaving.  The admin branch
                                                               keeps its first and last lines and calls adminLogin between them
What stays in server.js: the configuration (the passcode's source line is never read or written by this tool beyond being kept), the
requires the server always made, in their order, and the wiring.  Edited in place: the composition root's comment (29-41), which named
the session as staying.  The passcode line is never printed: an anchor that fails prints only its line number and what was expected."""
import argparse, hashlib, os, subprocess, sys
ap = argparse.ArgumentParser(); g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--apply', action='store_true'); g.add_argument('--check', action='store_true')
A = ap.parse_args()
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
PARENT, PARENT_BLOB = 'c34f0c22bbacc5ac2813d173bc0591b67af7169f', 'b58e911724bcc8f6266f30e18dabf7f295869bd2'
blob_id = lambda b: hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
if A.apply:
    base = open(os.path.join(REPO, 'server.js'), 'rb').read()
    if blob_id(base) != PARENT_BLOB: sys.exit("server.js is not the parent's (M8): nothing written")
else:
    base = subprocess.run(['git', '-C', REPO, 'show', f'{PARENT}:server.js'], capture_output=True, check=True).stdout
    if blob_id(base) != PARENT_BLOB: sys.exit("the parent's server.js is not the recorded one")
L = base.decode('utf-8').split('\n')
ln = lambda n: L[n - 1]
rng = lambda a, b: L[a - 1:b]
def expect(n, text, whole=False):
    if (ln(n) != text) if whole else (not ln(n).startswith(text)): sys.exit(f'line {n} is not what the split expects (expected it to {"be" if whole else "start with"} {text[:60]!r})')
for n, t in [(12, 'const BODY_TTL = Math.max(0, +process.env.BODY_TTL || 0);'), (13, "const sha = s => crypto.createHash('sha256').update(String(s)).digest();"),
             (14, 'const ADMIN_HASH = sha(ADMIN_PASS);'), (15, 'const passOk = s => crypto.timingSafeEqual(sha(s), ADMIN_HASH);'), (17, 'const TICK_MS = 25, SNAP_EVERY = 2, ADMIN_EVERY = 4;'),
             (22, 'const FAST_GAP = 16;'), (25, ''), (26, 'let nextId = 1;'), (28, ''), (41, ' * only with the owner'), (42, "const PEERS = require('./src/frameworks/space/server/peers.js');"),
             (60, ''), (61, "srv.on('upgrade', (req, sock) => {"), (78, '  function onMessage(m) {'), (114, "    else if (m.t === 'pick')"), (115, "    else if (m.t === 'admin') {"),
             (116, '      const now = Date.now(), f = fails.get(ip) || { n: 0, until: 0 };'), (117, '      if (now < f.until) return send(me, { t: \'admin\', ok: false, wait: Math.ceil((f.until - now) / 1000) });'),
             (118, '      if (passOk(m.pass)) { me.admin = true; fails.delete(ip);'), (119, '      else { if (++f.n >= 5) { f.until = now + 60000; f.n = 0; } fails.set(ip, f);'),
             (120, '    }'), (121, "    else if (m.t === 'a') { if (me.admin) adminCommand(room, me, m); }"), (135, "  sock.on('close', bye); sock.on('error', bye);"),
             (136, '});'), (137, ''), (138, "const { poseSend } = require('./src/frameworks/bpp/server/poses.js')"), (141, 'srv.listen(PORT,')]:
    expect(n, t, whole=n in (12, 13, 14, 15, 22, 25, 26, 28, 60, 61, 78, 115, 116, 117, 120, 121, 135, 136, 137))
expect(16, 'const fails = new Map();'); expect(29, '/* Stage 3H engine modernization (H3M-2): server.js is the server')
if len(L) != 142 or L[141] != '': sys.exit('server.js does not have the 141 lines and final newline the split expects')

ADMIN_LOGIN = ['/* src/frameworks/ward/server/admin_login.js - W.A.R.D. on the server: the admin login.  A client\'s {t:\'admin\', pass} is checked here:',
  ' * the passcode against its SHA-256 in constant time, and a failure map that locks a client identity out for 60 s after its fifth wrong',
  ' * guess.  Whether a connection is an admin is the connection\'s own flag (me.admin), set here and read by the session; nothing else',
  ' * grants it.',
  ' *',
  ' * Stage 3H continuation (C2): moved out of server.js without a change, with the owner\'s approval to relocate this code (not to change',
  ' * it).  Every line between the factory\'s first line and its return is server.js\'s own at M8 (c34f0c2: lines 13-16 and 116-119),',
  ' * comments and indentation included, except the one line that names the function, marked (C2); dev/stage-3h/tools/h2_move_proof.js',
  ' * checks it (dev/stage-3h-modernization/evidence/c2/).  The passcode\'s source stays in server.js\'s configuration, which gives it here.',
  ' *   adminLogin(me, m, ip, name, id)   one {t:\'admin\'} message of connection me (client identity ip, room name, connection id): it',
  ' *                                     answers {t:\'admin\', ok, wait | q} and logs one line; me.admin becomes true on a correct passcode',
  ' * Given by server.js: crypto (Node\'s), ADMIN_PASS (the configured passcode) and send(c, obj).  No timer.  Never served: the server\'s',
  ' * allowlist reaches only public/. */',
  'module.exports = ({ crypto, ADMIN_PASS, send }) => {'] + rng(13, 16) + \
  ['function adminLogin(me, m, ip, name, id) {                             // (C2) the body of the session\'s {t:\'admin\'} branch, as it was'] + rng(116, 119) + \
  ['}', '', 'return { adminLogin };', '};', '']
SESSION = ['/* src/frameworks/bpp/server/session.js - B++ on the server: the WebSocket session.  It answers the HTTP server\'s upgrades on /ws',
  ' * (the handshake, the room, the room cap), keeps each connection\'s state, reads each message the client sends and hands it to its owner,',
  ' * and ends the connection.  It is the protocol\'s intake; every decision it calls for is made by the module that owns it:',
  ' *   p        the pose: the movement authority (S.P.A.C.E., movement.js), the AI\'s hearing (room.sim), the presentation fields (fields.js)',
  ' *   join, respawn, leave   the world\'s lifecycle (room.sim), then a placement onto a free spot (movement.js)',
  ' *   nr       NEW RUN\'s decision (B++, newrun.js);  pick  the cartograph (room.sim)',
  ' *   admin    the admin login (W.A.R.D., admin_login.js);  a  an admin command, only from a connection that login unlocked (OVERSEER)',
  ' *   caps     the fresher poses (B+);  ping  pong, at most every 400 ms',
  ' *',
  ' * Stage 3H continuation (C2): moved out of server.js without a change, with the owner\'s approval to relocate this code (not to change',
  ' * it).  Every line between the factory\'s first line and its end is server.js\'s own at M8 (c34f0c2: lines 26, 61-115 and 120-136),',
  ' * comments and indentation included, except the one line marked (C2), which calls adminLogin where the admin branch\'s body was;',
  ' * dev/stage-3h/tools/h2_move_proof.js checks it (dev/stage-3h-modernization/evidence/c2/).  The factory registers the upgrade handler',
  ' * on the server it is given, at the point of server.js where the handler was registered before; it returns nothing.',
  ' * Given by server.js: srv (the HTTP server), crypto (Node\'s), MAX_ROOM, FAST_GAP, the rooms (getRoom, rooms), the framing (send,',
  ' * reader), the field checks (num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook), the movement authority (PEERS, MV, PD, blockers,',
  ' * placeFree, mvReset, mvCheck, adminMove), nrIntent, adminCommand and adminLogin.  No timer.  Never served: the server\'s allowlist',
  ' * reaches only public/. */',
  'module.exports = ({ srv, crypto, MAX_ROOM, FAST_GAP, getRoom, rooms, send, reader, PEERS, num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook, MV, PD, blockers, placeFree, mvReset, mvCheck, adminMove, nrIntent, adminCommand, adminLogin }) => {'] + \
  rng(26, 26) + [''] + rng(61, 115) + \
  ['      adminLogin(me, m, ip, name, id);                                     // (C2) W.A.R.D.: the passcode check and the lockout (admin_login.js)'] + rng(120, 136) + ['};', '']
COMMENT = ['/* Stage 3H engine modernization (H3M-2, continuation C2): server.js is the server\'s composition root.  It keeps the configuration,',
  ' * with the admin passcode\'s source; the requires the server always made, in their order; and the wiring.  Each other part lives with its',
  ' * owner, and is given what it uses (never requiring the server):',
  ' *   src/frameworks/space/server/movement.js   S.P.A.C.E.: the movement authority (the budget, the walls, the other players, placements)',
  ' *   src/core/server/rooms.js                  core: the rooms, and the admin world reset (a new world epoch)',
  ' *   src/frameworks/gib/server/aftermath.js    G.I.B.: the death aftermath and the NEW RUN blast (Stage 3H2 C-2)',
  ' *   src/frameworks/bpp/server/newrun.js       B++: NEW RUN\'s decision (Stage 3H2 C-1)',
  ' *   src/frameworks/overseer/server/admin.js   OVERSEER: the admin panel\'s commands',
  ' *   src/frameworks/ward/server/admin_login.js W.A.R.D.: the admin login (the passcode check and its lockout), moved as it was (C2)',
  ' *   src/frameworks/bpp/server/session.js      B++: the WebSocket session (the upgrade, each client\'s messages, its leaving), moved as',
  ' *                                             it was (C2)',
  ' *   src/frameworks/bpp/server/poses.js        B++: the fresher poses between two snapshots (Stage 3E-0 B+)',
  ' *   src/core/server/loop.js                   core: the loop (the 60 Hz steps, the aftermath, the snapshots)',
  ' * The static files, the WebSocket framing and the checks on what clients send (Stage 3H0), and the players\' bodies (peers.js), are',
  ' * required where they always were.  The owner approved the session\'s move as a relocation (2026-10-14): its semantics are unchanged',
  ' * (dev/stage-3h-modernization/FINDINGS.md M-023). */']
WIRING = ["const { adminLogin } = require('./src/frameworks/ward/server/admin_login.js')({ crypto, ADMIN_PASS, send });   // (C2) W.A.R.D.: the admin login",
  "require('./src/frameworks/bpp/server/session.js')({ srv, crypto, MAX_ROOM, FAST_GAP, getRoom, rooms, send, reader, PEERS, num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook, MV, PD, blockers, placeFree, mvReset, mvCheck, adminMove, nrIntent, adminCommand, adminLogin });   // (C2) B++: the WebSocket session"]
SERVER = rng(1, 12) + rng(17, 25) + rng(27, 28) + COMMENT + rng(42, 60) + WIRING + rng(137, 142)
OUT = {'server.js': '\n'.join(SERVER), 'src/frameworks/ward/server/admin_login.js': '\n'.join(ADMIN_LOGIN), 'src/frameworks/bpp/server/session.js': '\n'.join(SESSION)}
if A.apply:
    for f in OUT:
        if f != 'server.js' and os.path.exists(os.path.join(REPO, f)): sys.exit(f'{f} exists already: nothing written')
    for f, t in OUT.items():
        open(os.path.join(REPO, f), 'w', encoding='utf-8', newline='\n').write(t)
    print('split: server.js ' + str(len(SERVER) - 1) + ' lines; ' + ', '.join(f'{f} {t.count(chr(10))} lines' for f, t in OUT.items() if f != 'server.js'))
else:
    bad = [f for f, t in OUT.items() if not os.path.exists(os.path.join(REPO, f)) or open(os.path.join(REPO, f), encoding='utf-8').read() != t]
    print('C2 SPLIT CHECK: ' + ('PASS (server.js, admin_login.js and session.js are what the split of M8\'s server.js gives)' if not bad else 'FAIL: ' + ', '.join(bad)))
    sys.exit(1 if bad else 0)
