# Stage 3H0: server.js public surface (locked)

Everything outside `server.js` can see or depend on at the accepted QA2 commit `edd2af9`:
- how it starts;
- what it serves;
- what it accepts;
- what it logs;
- what it asks of `sim.js` and `death_srv.js`.

**The rule for 3H0.** `node server.js [port]` keeps working exactly as below, and every extraction keeps every row. That is checked by the server golden traces in `dev/stage-3h0/` (H0-1 onward) and by the existing live server tests (`dev/tests/live.js`, `audit_net.js`, `audit_net2.js`, `ir_net.js`).

## 1. Starting it

**Command.** `node server.js [port]`, also via `npm start`, `run_linux.sh` and `run_windows.bat`.
- **Port:** `+process.argv[2] || process.env.PORT || 8000`. A non-numeric argument falls through to `PORT`. `PORT` is used as given, as a string.
- **Listening:** `srv.listen(PORT)`, on all interfaces.

**Production starts it the same way.** A push to `main` triggers `.github/workflows/deploy-bloom.yml`, which asks the Bloom host to restart; the host's startup script pulls `main` and starts the server. 3H0 does not touch `main` or the workflow.

**Environment:**
- `ADMIN_PASSCODE`: the admin passcode. There is a default in the source, which is not repeated in any 3H0 evidence; tests use a synthetic passcode.
- `BODY_TTL`: seconds a corpse stays; 0 means until reset.

**Dependencies:** built-in modules only (`http fs path crypto zlib`), plus `./sim.js` and `./death_srv.js`. There is no `npm install`.

**Load order at start:**
1. `http, fs, path, crypto`, then `zlib`, then `./sim.js` (which loads `world.js` and `ai.js`);
2. the HTTP server is created;
3. `./death_srv.js` (which runs `dphys.js` in a `vm` context);
4. the 25 ms interval;
5. `listen`.

**The only start-up output:**

    The Far Backrooms → http://localhost:<port>  (share  ?room=NAME  to group up)

## 2. Console output (the server's log)
These lines are its observable log. 3H0 keeps their text and their moment:
- `[admin] <name>#<id> unlocked admin (room <room>)`
- `[admin] <name>#<id> wrong admin passcode (room <room>)`
- `[admin] room=<room> <name>#<id>: <what>`, for every admin command that is carried out
- `[death] room=<room> #<id>: the victim's client never reported its corpse - the server made it`
- `[death] fallback failed <message>` (console.error)

`sim.js`, `ai.js` and `death_srv.js` may log on their own account. They are untouched by 3H0.

## 3. HTTP
The exact routes, status codes, MIME types, caching and gzip rules are in `3H0_PROTOCOL_INVENTORY.md` section 7.

**Contract points:**
- **The allowlist `SERVE`.** Its regular expression stays character for character:

      /^\/(index\.html|camera_policy\.js|timing_policy\.js|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets\/[\w.\-]+)$/

- **The MIME table** maps `.html .js .css .png`; anything else is `application/octet-stream`.
- **Never served (404):** server-only code and files: `server.js`, `sim.js`, `ai.js`, `death_srv.js`, `redirect.js`, `package.json`, `dev/`, `audio_source/`, `.github/`, documentation, and any new server-side module.
- **Status codes:**
  - 400 for a malformed `%` escape or a NUL;
  - 404 for everything not allowed or not found;
  - 200 otherwise.
- **The headers per response** are:
  - `Content-Type`;
  - `Vary: Accept-Encoding`;
  - `Cache-Control`;
  - `Content-Encoding: gzip` when gzipped;
  - for `/sounds/<file>`: `Content-Type`, `Cache-Control` and `Content-Length`;
  - for the listing: `Content-Type: application/json` and `Cache-Control: no-store`;
  - for errors: `Content-Type: text/plain` (400), or none (404).

  Node adds `Date`, `Connection`, `Keep-Alive` and, where no length is given, `Transfer-Encoding: chunked`.

## 4. WebSocket
`/ws?room=NAME`:
- the handshake, frame format and parser semantics;
- the 8-socket room cap;
- the room-name cleaning;
- the 1,400-byte inbound and 65,535-byte outbound limits.

All of this is in `3H0_PROTOCOL_INVENTORY.md` sections 1-3, and is frozen.

## 5. What server.js asks of sim.js (unchanged, and sim.js is not edited in 3H0)
- **Creating a room's world:** `createSim({ bodyTtl, onDeath })`, one per room. `onDeath(p)` starts that player's aftermath.
- **Players:** `addPlayer(id)`, `removePlayer(p)`, `join(p, nowSec)`, `respawn(p)`, `leave(p, nowSec)`, `vanish(p, nowSec)`, `forfeit(p)`.
- **Movement:** `hearMove(p, mv)`, `gaitFloor(p, claimed)`, `spawnOk(x, y)`, `moveOk(x0, y0, x1, y1, budget)`.
- **Items and bodies:** `takeItem(p)`, `setBody(id, rec)`, `killerEnd(id, x, y, a)`.
- **The tick and snapshots:**
  - `step(1/60)`;
  - `entities()`, which drains the entity sound queue: exactly one call per snapshot tick;
  - `capInfo(p)`.
- **Getters:** `bodies`, `bodyVer`, `logSeq`, `engStats`.
- **Debug:** `logSince(seq)`, `debugInfo()`, `navCmd(eid, cmd, p)`.
- **`admin.*`:**
  - `info, endPreview, god, freeze, speed, blackout`;
  - `addHound, removeHound, addSmiler, removeSmiler`;
  - `newGlitches, nearestGlitch, newItem, nearestItem`;
  - `resetMonsters, addNear, summon, previewKill, captureMode`;
  - `entityAt, spotNear, removeEntity, resetWorld`.
- **Player fields read or written:**
  - position and motion: `x y vx vy angle sprinting light equipment.kind obsV`;
  - life and death: `active dead caught kill dseq reviveOk safe god`;
  - exits: `exitSeq exitT`;
  - movement report: `st sp stamina ex`.

**death_srv.js:** `fxFor(id, kill, info)`, `bodyFor(id, kill, info, sim)`, `durOf(kill)`.

## 6. Process-wide state (one server per process)
- `rooms` (Map, name → room);
- `nextId` (a counter, never reused);
- `fails` (Map, IP → lockout);
- `gz` (Map, file → gzipped bytes, never invalidated);
- one `setInterval(25 ms)`;
- the HTTP server.

**Per room:**
- `name, clients` (Map, id → connection, in connection order);
- `sim, acc, last, tick`;
- `pf` (the debug timings);
- `afts` (death aftermaths).

**Per connection (`me`):**
- set at connect: `sock, id, player, exitSent, bv, last, name, color, angle, sprint, look, admin`;
- set later as needed: `mv, mvAt, mvRefused, mvCorr, spawnNext, respawnRefused, leaveRefused, fxAt, raised, ir, lp, fall, pingAt, dbg, dbgSeq, aftSeq`.

## 7. What 3H0 may add (and has to document here)
New server-side CommonJS modules, required by `server.js` at the point where the code they hold used to be defined. They must:
- live in a directory the allowlist cannot reach;
- be proven 404 by a negative test;
- have no side effects when loaded;
- add no dependency.

Each addition is listed here at the checkpoint that makes it.
