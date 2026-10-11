# Stage 3H0: server.js ownership map

**What it covers.** Who owns what inside `server.js`, and what each part reads, writes and calls. This is the "before" map, at the accepted QA2 commit `edd2af9`: 30,485 bytes, 368 lines, a CommonJS script with module-level state.

**What it is for.** The 3H0 extractions are chosen from this table and recorded against it. Section 5 is filled in as checkpoints land.

## 1. Sections (line ranges at `edd2af9`)

| Lines | Bytes | Responsibility | Names | State it owns or uses |
|---|---:|---|---|---|
| 1-8 | 487 | header; requires (`http fs path crypto zlib`, `./sim.js`); the gzip cache | `createSim gz` | `gz` (only the HTTP handler uses it) |
| 9-20 | 1,361 | configuration: port, room cap, admin passcode hash and lockout map, `BODY_TTL`, cadence constants, the `SERVE` allowlist, the MIME table | `PORT ROOT MAX_ROOM ADMIN_PASS BODY_TTL sha ADMIN_HASH passOk fails TICK_MS SNAP_EVERY ADMIN_EVERY SERVE types` | `fails`; `SERVE` and `types` are used only by the HTTP handler |
| 22-53 | 2,278 | **HTTP static serving:** decode, 400s, `/sounds` listing and files, the allowlist, `readFile`, MIME, cache, gzip | `srv` (the handler) | `gz`, `SERVE`, `types`, `ROOT`; no game state |
| 55-57 | 85 | room registry, id counter, `require('./death_srv.js')` | `rooms nextId deathSrv` | `rooms`, `nextId` |
| 59-92 | 3,083 | **movement validation:** budget, slack, the 3-per-second route checks, grace, `tp` corrections | `MV mvReset mvAccept mvCheck` | `me.mv`, `me.mvRefused`, `me.mvCorr`; calls `room.sim.moveOk`, `send` |
| 93-127 | 2,600 | **death aftermath:** record, server replay, server corpse; `moveTo` | `aftStart aftOf aftTick moveTo` | `room.afts`, `c.aftSeq`; calls `deathSrv`, `room.sim.setBody/killerEnd`, `send`, `HEX` |
| 129-134 | 333 | **outbound WebSocket framing** and `send` | `frame send` | `c.sock` |
| 135-144 | 889 | **inbound field validation:** number clamp, light kind, light parts, colour, look | `num KINDS LEGACY kindOf cleanParts HEX DEFAULT_LOOK cleanLook` | none (pure) |
| 146-150 | 369 | room creation (one `createSim` per room; `onDeath` → `aftStart`) | `getRoom` | `rooms` |
| 152-206 | 5,999 | **admin commands** (24 of them), each answered with `ares` and logged | `adminCommand` | the room's clients, `me.dbg`, `me.dbgSeq`; `sim.admin.*`; `moveTo`, `mvReset`, `send`; raw close bytes for kick |
| 208-224 | 1,046 | **upgrade:** path and key checks, room name, room cap, handshake, player creation, `hi` | the upgrade handler | `nextId`, `room.clients` |
| 225-290 | 7,102 | **`onMessage`:** every client message (`p join respawn leave fx pick admin a ping b`) | `onMessage` (a closure over `room, player, me, ip, name, id`) | nearly every `me.*` field; `fails`; `sim.*`; `mv*`, `aftOf`, `send`, the validators |
| 292-306 | 810 | **inbound frame parser** (a closure over `sock`, its own `buf`, `onMessage`) | the `data` handler | `buf` |
| 307-315 | 435 | **disconnect cleanup:** forfeit while held, remove, delete an empty room | `bye` | `room.clients`, `rooms` |
| 317-366 | 3,477 | **the tick:** accumulator and 60 Hz steps; step timing; on snapshot wakes: aftermaths, entities, peers, admin and debug payloads, `exit`, `bodies`, `s` | the interval | `room.acc/last/tick/pf`, `c.exitSent`, `c.bv`, `c.dbgSeq` |
| 368 | 121 | `listen` and the start-up line | | |

## 2. How the parts are coupled

- **`onMessage` is a closure created per connection inside the upgrade handler.** It captures `room`, `player`, `me`, `ip`, `name` and `id`, and calls:
  - movement validation, aftermath lookups and `send`;
  - the validators;
  - `adminCommand`;
  - `sim` methods;
  - `fails` (the admin lockout).
- **The inbound parser lives in the same closure.** It calls `onMessage` inside a `try` that also swallows exceptions thrown *while handling* a message (not only bad JSON).
- **The tick reads and writes per-connection fields** that the messages set (`raised`, `ir`, `look`, `lp`, `fall`, `sprint`, `angle`, `name`, `color`, `dbg`, `dbgSeq`, `exitSent`, `bv`). It also calls `aftStart` / `aftTick`, and calls `sim.entities()` once (which drains the sound queue).
- **`adminCommand` reaches movement (`moveTo`, `mvReset`)**, the room's clients, `send`, and raw socket writes (kick).
- **The HTTP handler shares nothing with the game.** It uses only `ROOT`, `SERVE`, `types`, `gz`, `fs`, `path` and `zlib`.
- **`frame` is pure** (a string in, bytes or `null` out). **The validators are pure.**

## 3. Side effects by kind

- **Sockets:**
  - the 101 handshake write;
  - `send` → `sock.write`;
  - pong and close-frame writes;
  - `sock.destroy` (bad upgrade, full room, 64-bit length);
  - `sock.end` (close frame, kick).
- **Timers:**
  - one `setInterval(25 ms)`;
  - a `setTimeout(150 ms)` per kick.
- **Time:** `Date.now()` is used for throttles, movement budgets, aftermaths, admin lockout and the accumulator; `process.hrtime.bigint()` for the step timing.
- **Console:** the lines in `3H0_SERVER_API_LOCK.md` section 2.
- **Files:** `fs.readFile` (static files, sounds) and `fs.readdirSync('sounds')`.
- **Memory caches:** `gz` (the gzip copies), `fails` (lockouts).

## 4. Candidate seams (H0-0 judgement; each still an independent GO/NO-GO at its own checkpoint)

| Seam | Tier | What would move | Must be kept exactly | Existing tests that read server.js text | H0-0 judgement |
|---|---|---|---|---|---|
| **S2: WebSocket wire** | A | the handshake response text, `frame`, and the inbound parser (as a factory taking `sock` and `onMessage`) | byte-identical 101 text; frame bytes, including the silent `null` for 64 KiB and over; parser control flow (`return` on incomplete, `destroy` on 127, `end` on close, pong, `continue`, the 1,400 limit, the `try` around parse **and** handling); one buffer per connection; listener order (`data` before `close`/`error`) | none | **candidate for H0-4** |
| **S1: static serving** | A | the HTTP handler with `SERVE`, `types`, `gz` and the sounds route, as a factory taking `ROOT` | the allowlist regex character for character; status codes, header order and values, gzip and its cache, the sounds rules; the module itself never served | `dev/stage-3b-n/test_3bn.js` N1-2 fetches the scripts (black box) | **candidate for H0-4 (next seam)** |
| **S3: field validation** | A | `num`, `kindOf` (with `KINDS`, `LEGACY`), `cleanParts`, `HEX`, `DEFAULT_LOOK`, `cleanLook` | identical results for every input (they are pure) | none | **candidate for H0-4 (next seam)** |
| S4: rooms / session lifecycle | B | the upgrade handler, `onMessage`, `bye`, `getRoom` | the closure captures; sim call order; `spawnNext` and the movement grace; the forfeit before removal | `s_ir.js` I1 matches `me.ir =` and `ir: c.ir` in server.js | **NO-GO for 3H0.** The message handler and its connection closure *are* the session, so moving them is a rewrite of its ownership. Deferred to full 3H. |
| S5: replication / snapshot builder | B | the snapshot half of the tick | `entities()` once per snapshot tick; the order exit → bodies → s per client; one shared `bodies` object per tick; admin and debug cadence | `s_ir.js` I1 (`ir: c.ir`) | **Deferred** to full 3H, with a plan. It could only move as a whole with the tick, and the tick is timing authority. |
| S5b: admin commands | B | `adminCommand` | admin behavior, logs and security (auth stays in `onMessage`) | `s_humanqa_hotfix.js` X02 matches the +10 clamp text in server.js | **Deferred.** It is admin behavior, and the test reads the text. |
| movement validation, aftermath | B | `MV mv*`, `aft*`, `moveTo` | anti-cheat semantics; death aftermath timing | none | **Deferred.** They are game authority, not plumbing. |

## 5. After 3H0 (filled in at each checkpoint)

| Checkpoint | Moved | New file | server.js bytes / lines | Equivalence receipt |
|---|---|---|---|---|
| (H0-0) | nothing | | 30,485 / 368 | |
