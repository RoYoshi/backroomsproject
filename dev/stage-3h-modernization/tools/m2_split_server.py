#!/usr/bin/env python3
"""Stage 3H engine modernization (H3M-2) - server.js split into its owners' modules, by moving lines verbatim (development only).

  python3 -I -B dev/stage-3h-modernization/tools/m2_split_server.py --apply    split the working tree's server.js (it must be M6a's)
  python3 -I -B dev/stage-3h-modernization/tools/m2_split_server.py --check    rebuild the split from M6a's server.js (read from Git) and
                                                                                 compare it with the working tree's six files

The parent is checkpoint M6a (f2db9d8), whose server.js is the accepted B++ server.js with Stage 3H2's and H3M-1's declared changes
(Git blob 4a67e181...).  Every moved range is checked by its anchors before anything is written.  Nothing is re-indented: each module's
lines between its factory's first line and its return are server.js's own, so dev/stage-3h/tools/h2_move_proof.js can find them.

What moves (line numbers of the parent's server.js):
  src/frameworks/space/server/movement.js   30-51, 53-114, 137-155   S.P.A.C.E.: the movement authority
  src/core/server/rooms.js                  26, 119-136, 166-171     core: the rooms and the admin world reset
  src/frameworks/overseer/server/admin.js   172-235                  OVERSEER: the admin panel's commands
  src/frameworks/bpp/server/poses.js        314-330                  B++: the fresher poses between snapshots
  src/core/server/loop.js                   332-382                  core: the body of the loop's setInterval callback
What stays in server.js: the configuration, the admin passcode line (never read or written by this tool beyond being kept), its check
and lockout, the WebSocket session (237-312), the requires the server always made, in their order, and the wiring.  Lines changed in
place (each listed by the move proof): 52 (the PEERS require keeps its require; PD and NONE move), 118, 163 and 164 (comments that named
places that moved), 331 and 383 (the setInterval's arrow function, now loop.js's tick).
The passcode line is never printed: an anchor that fails prints only its line number and what was expected."""
import argparse, hashlib, os, subprocess, sys
ap = argparse.ArgumentParser(); g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--apply', action='store_true'); g.add_argument('--check', action='store_true')
A = ap.parse_args()
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
PARENT, PARENT_BLOB = 'f2db9d8070661f810820d79f430429d24b6707ad', '4a67e181b5526b239e4b45f104e5c88f33aaac78'

def blob_id(b):
    return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()


if A.apply:
    base = open(os.path.join(REPO, 'server.js'), 'rb').read()
    if blob_id(base) != PARENT_BLOB: sys.exit('server.js is not the parent\'s (M6a): nothing written')
else:
    base = subprocess.run(['git', '-C', REPO, 'show', f'{PARENT}:server.js'], capture_output=True, check=True).stdout
    if blob_id(base) != PARENT_BLOB: sys.exit('the parent\'s server.js is not the recorded one')
L = base.decode('utf-8').split('\n')
ln = lambda n: L[n - 1]
rng = lambda a, b: L[a - 1:b]
def expect(n, text, whole=False):
    if (ln(n) != text) if whole else (not ln(n).startswith(text)): sys.exit(f'line {n} is not what the split expects (expected it to {"be" if whole else "start with"} {text[:60]!r})')
for n, t in [(25, ''), (26, 'const rooms = new Map();'), (27, 'let nextId = 1;'), (29, ''), (114, '}'), (155, '}'), (159, ''), (165, ''), (170, '}'), (171, ''), (235, '}'),
             (236, ''), (312, '});'), (313, ''), (329, '}'), (330, ''), (331, 'setInterval(() => {'), (382, '  }'), (383, '}, TICK_MS);'), (384, '')]:
    expect(n, t, whole=True)
for n, t in [(28, "const deathSrv = require('./src/frameworks/gib/server/death_srv.js');"), (30, '/* Movement validation.'), (41, 'const MV = {'),
             (52, "const PEERS = require('./src/frameworks/space/server/peers.js'), PD = PEERS.D_BODY, NONE = [];"), (53, 'const solidP = '),
             (115, '/* Stage 3H2 (C-2): the death aftermath'), (119, '/* Stage 3D HQ2 (H2-4): an admin world reset'), (125, 'function worldReset(room) {'),
             (137, '/* a server-side move of a player'), (138, 'function moveTo('), (144, 'function adminMove(room, me, x, y) {'), (156, "/* Stage 3H2 (C-1): NEW RUN's decision"),
             (160, "const { frame, reader } = require('./src/frameworks/bpp/server/ws.js');"), (161, 'const send = (c, obj) =>'),
             (162, 'const { num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook } = require('), (163, 'const { aftStart, aftOf, aftSend, aftTick, bodyAt, boomStart } = require('),
             (164, "const { nrIntent } = require('./src/frameworks/bpp/server/newrun.js')"), (166, 'function getRoom(name) {'), (172, 'function adminCommand(room, me, m) {'),
             (237, "srv.on('upgrade', (req, sock) => {"), (314, '/* Stage 3E-0 (B+): on a tick between two full snapshots'), (317, 'function poseSend(room) {'),
             (332, '  const now = Date.now();'), (385, 'srv.listen(PORT,')]:
    expect(n, t)
if len(L) != 386 or L[385] != '': sys.exit('server.js does not have the 385 lines and final newline the split expects')
E118 = (' * The events stay on the room (room.afts), so worldReset just below and the admin revive still end them in place. */',
        ' * The events stay on the room (room.afts), so worldReset (src/core/server/rooms.js) and the admin revive (admin.js) still end them in place. */')
E163 = ('(see the note above worldReset)', '(see its note above)')
E164 = ('(see the note after adminMove)', '(see its note above)')
expect(118, E118[0], whole=True)
if ln(163).count(E163[0]) != 1 or ln(164).count(E164[0]) != 1: sys.exit('lines 163 and 164 are not what the split expects')

def wrap(text, width=139):
    """one paragraph of a header comment: ' * ' lines of at most width columns"""
    out, line = [], ' *'
    for w in text.split(' '):
        if len(line) + 1 + len(w) > width: out.append(line); line = ' *'
        line += ' ' + w
    return '\n'.join(out + [line]) + '\n'
def moved(lines, but=''):
    return wrap("Stage 3H engine modernization (H3M-2): moved out of server.js without a change.  Every line between the factory's first "
                f"line and its return is server.js's own (at checkpoint M6a, f2db9d8: {lines}), comments and column included{but}: nothing is "
                "re-indented, so each line can be compared with server.js as it was (dev/stage-3h/tools/h2_move_proof.js does: "
                "dev/stage-3h-modernization/evidence/m2/).")
OUT = {}
OUT['src/frameworks/space/server/movement.js'] = (
    "/* src/frameworks/space/server/movement.js - S.P.A.C.E. on the server: the movement authority.  Every pose a client sends is checked\n"
    " * here (the distance budget, the walls, the other living players), and every server-side placement (spawn, respawn, admin tools) is made here.\n"
    " *\n" + moved('lines 30-51, 53-114 and 137-155', ', except the one line marked (H3M-2)') +
    " *   MV                          the budget's numbers (speeds, burst, slack, snap, grace)\n"
    " *   PD                          the body width the living keep between them (peers.js's D_BODY)\n"
    " *   blockers(room, me)          where the other solid players are, when me is solid itself\n"
    " *   placeFree(room, me)         a server-side placement onto a free spot (true if it had to move)\n"
    " *   mvReset(me, grace)          the movement check restarted from where the player is (with the grace after a placement)\n"
    " *   mvCheck(room, me, x, y)     one pose: accepted (true), or refused, corrected or ignored (false)\n"
    " *   moveTo(room, me, x, y)      a server-side move (spawn, admin tools), told to the client\n"
    " *   adminMove(room, me, x, y)   an admin's own move: through walls, never into another player\n"
    " * What it uses of the server is given by server.js, never required (so loading it changes nothing a golden trace records): PEERS\n"
    " * (src/frameworks/space/server/peers.js, which server.js still requires itself, where it always did) and send(c, obj) (server.js's:\n"
    " * the WebSocket frame).  No timer.  Never served: the server's allowlist reaches only public/. */\n"
    "module.exports = ({ PEERS, send }) => {\n" + '\n'.join(rng(30, 51)) + '\n' +
    "const PD = PEERS.D_BODY, NONE = [];                                           // (H3M-2: server.js's line 52 less its require, which stays there)\n" +
    '\n'.join(rng(53, 114)) + '\n' + '\n'.join(rng(137, 155)) + '\n\n' +
    "return { MV, PD, blockers, placeFree, mvReset, mvCheck, moveTo, adminMove };\n};\n")
OUT['src/core/server/rooms.js'] = (
    "/* src/core/server/rooms.js - the rooms: one world per ?room=NAME, made on first use and thrown away when its last client leaves; and the\n"
    " * admin world reset, a new world epoch for everyone in a room.\n"
    " *\n" + moved('lines 26, 119-136 and 166-171') +
    " *   rooms               the Map name -> room (the session deletes a room when it empties; the loop walks them)\n"
    " *   getRoom(name)       the room of that name, made with a new world (the built sim.js) on first use\n"
    " *   worldReset(room)    the admin world reset (Stage 3D HQ2)\n"
    " * What it uses of the server is given by server.js, never required: createSim (the built sim.js, which server.js still requires\n"
    " * itself, where it always did), BODY_TTL (server.js's configuration), aftStart (G.I.B.: a death's aftermath, the world's onDeath),\n"
    " * placeFree and mvReset (S.P.A.C.E.) and send(c, obj).  No timer.  Never served. */\n"
    "module.exports = ({ createSim, BODY_TTL, aftStart, placeFree, mvReset, send }) => {\n" + ln(26) + '\n' + '\n'.join(rng(119, 136)) + '\n' + '\n'.join(rng(166, 171)) + '\n' +
    "return { rooms, getRoom, worldReset };\n};\n")
OUT['src/frameworks/overseer/server/admin.js'] = (
    "/* src/frameworks/overseer/server/admin.js - OVERSEER on the server: the admin panel's commands ({t:'a', c}), each answered on the panel's\n"
    " * status bar.  Only a client the passcode check has unlocked reaches them; that check, its lockout and the passcode stay in server.js.\n"
    " *\n" + moved('lines 172-235') +
    " *   adminCommand(room, me, m)   one command: kick, revive, god, bring, goto, freeze, speed, blackout, hounds, smilers, glitch, item,\n"
    " *                               monsters, debug, near, summon, preview, capmode, entgoto, nav, entdel, world, nrfree, msg\n"
    " * What it uses of the server is given by server.js, never required: send(c, obj), aftOf (G.I.B.: a death still playing, which a revive\n"
    " * ends), moveTo (S.P.A.C.E.) and worldReset (core).  Its one timer is the kick's (150 ms), as it was.  Never served. */\n"
    "module.exports = ({ send, aftOf, moveTo, worldReset }) => {\n" + '\n'.join(rng(172, 235)) + '\n\n' + "return { adminCommand };\n};\n")
OUT['src/frameworks/bpp/server/poses.js'] = (
    "/* src/frameworks/bpp/server/poses.js - B++ on the server: the fresher player poses ('q') between two snapshots (Stage 3E-0 B+), for the\n"
    " * clients that asked for them ({t:'caps', fp:1}).\n"
    " *\n" + moved('lines 314-330') +
    " *   poseSend(room)   on a tick between two snapshots: to each client that asked, the other players' poses that changed\n"
    " * What it uses of the server is given by server.js, never required: send(c, obj).  No timer.  Never served. */\n"
    "module.exports = ({ send }) => {\n" + '\n'.join(rng(314, 330)) + '\n' + "return { poseSend };\n};\n")
OUT['src/core/server/loop.js'] = (
    "/* src/core/server/loop.js - the server's loop.  On every tick (TICK_MS, 25 ms) each room's world steps at 60 Hz; on every SNAP_EVERY-th\n"
    " * tick the deaths' aftermath plays on and each client gets one snapshot (the admin's panel and debug data with it); on the ticks between,\n"
    " * the fresher poses (poses.js).\n"
    " *\n" + moved("lines 332-382, the body of its setInterval callback", ", except tick()'s own first and last lines (the callback was an arrow function), marked (H3M-2)") +
    " *   tick()   one tick, as the callback ran it.  server.js still makes the one setInterval, where it always did.\n"
    " * What it uses of the server is given by server.js, never required: rooms (core), poseSend (B++), aftStart, aftSend, aftTick and bodyAt\n"
    " * (G.I.B.), send(c, obj), SNAP_EVERY and ADMIN_EVERY (server.js's configuration).  Never served. */\n"
    "module.exports = ({ rooms, poseSend, aftStart, aftSend, aftTick, bodyAt, send, SNAP_EVERY, ADMIN_EVERY }) => {\n"
    "function tick() {                                                           // (H3M-2: server.js's setInterval(() => {...}, TICK_MS) callback)\n" +
    '\n'.join(rng(332, 382)) + '\n' + "}                                                                             // (H3M-2)\n\n" + "return { tick };\n};\n")

S = []
S += rng(1, 25)                                                    # the header, the requires, the configuration, the passcode line (kept as it is), srv
S += rng(27, 29)                                                   # nextId (the session's), deathSrv (a require the server always made, in its place)
S += ["/* Stage 3H engine modernization (H3M-2): server.js is the server's composition root.  It keeps the configuration; the admin passcode, its",
      " * check and its lockout; the WebSocket session below (the upgrade, each client's messages, its leaving); the requires the server always",
      " * made, in their order; and the wiring.  Each other part lives with its owner, and is given what it uses (never requiring the server):",
      " *   src/frameworks/space/server/movement.js   S.P.A.C.E.: the movement authority (the budget, the walls, the other players, placements)",
      " *   src/core/server/rooms.js                  core: the rooms, and the admin world reset (a new world epoch)",
      " *   src/frameworks/gib/server/aftermath.js    G.I.B.: the death aftermath and the NEW RUN blast (Stage 3H2 C-2)",
      " *   src/frameworks/bpp/server/newrun.js       B++: NEW RUN's decision (Stage 3H2 C-1)",
      " *   src/frameworks/overseer/server/admin.js   OVERSEER: the admin panel's commands",
      " *   src/frameworks/bpp/server/poses.js        B++: the fresher poses between two snapshots (Stage 3E-0 B+)",
      " *   src/core/server/loop.js                   core: the loop (the 60 Hz steps, the aftermath, the snapshots)",
      " * The static files, the WebSocket framing and the checks on what clients send (Stage 3H0), and the players' bodies (peers.js), are",
      " * required where they always were.  The session stays here because it holds the passcode check and its lockout: security code moves",
      " * only with the owner's approval (dev/stage-3h-modernization/FINDINGS.md M-023). */"]
S += ["const PEERS = require('./src/frameworks/space/server/peers.js');                     // (H3M-2: its PD and NONE are movement.js's)"]
S += rng(115, 117) + [E118[1]]
S += rng(156, 162)
S += ["const { MV, PD, blockers, placeFree, mvReset, mvCheck, moveTo, adminMove } = require('./src/frameworks/space/server/movement.js')({ PEERS, send });   // H3M-2: S.P.A.C.E., the movement authority"]
S += [ln(163).replace(*E163), ln(164).replace(*E164)]
S += [ln(165)]
S += ["const { rooms, getRoom, worldReset } = require('./src/core/server/rooms.js')({ createSim, BODY_TTL, aftStart, placeFree, mvReset, send });   // H3M-2: core, the rooms",
      "const { adminCommand } = require('./src/frameworks/overseer/server/admin.js')({ send, aftOf, moveTo, worldReset });   // H3M-2: OVERSEER, the admin panel's commands"]
S += rng(236, 313)                                                 # the session (237-312), with the blank lines around it, as it was
S += ["const { poseSend } = require('./src/frameworks/bpp/server/poses.js')({ send });   // H3M-2: B++, the fresher poses between two snapshots",
      "setInterval(require('./src/core/server/loop.js')({ rooms, poseSend, aftStart, aftSend, aftTick, bodyAt, send, SNAP_EVERY, ADMIN_EVERY }).tick, TICK_MS);   // H3M-2: core, the loop"]
S += rng(384, 386)
OUT['server.js'] = '\n'.join(S)

if A.apply:
    for rel, text in OUT.items():
        p = os.path.join(REPO, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'w', encoding='utf-8', newline='').write(text)
    print('split: server.js %d -> %d lines; ' % (len(L) - 1, len(S) - 1) + ', '.join(f'{r} {t.count(chr(10))} lines' for r, t in OUT.items() if r != 'server.js'))
else:
    bad = [r for r, t in OUT.items() if not os.path.exists(os.path.join(REPO, r)) or open(os.path.join(REPO, r), 'rb').read() != t.encode('utf-8')]
    for r in bad: print('DIFFERS: ' + r)
    print('SPLIT CHECK: ' + ('PASS (the six files are what the split of M6a\'s server.js gives)' if not bad else 'FAIL'))
    sys.exit(1 if bad else 0)
