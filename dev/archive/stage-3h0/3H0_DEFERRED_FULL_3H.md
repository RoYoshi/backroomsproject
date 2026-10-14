# Stage 3H0: what was not moved, and why

**What this covers.** Every seam the H0-0 audit considered, its GO or NO-GO, and what full 3H would need before attempting the deferred ones. Also the findings recorded along the way, which 3H0 did not change.

**The rule that decided.** An extraction was accepted only if:
- it was a move, not a rewrite;
- old and new produced the same observable behavior for the same inputs, and the evidence showed it.

A seam that could only move by redesigning who owns what is a NO-GO here, however attractive the size.

## 1. Decisions

| Seam | Decision | Where | Why, in one line |
|---|---|---|---|
| C2: look / light / corpse wire codec (client) | **GO** | H0-2, `assets/net-wire.js` | pure field mapping, no state |
| C3: snapshot interpolation (client) | **GO** | H0-3, `assets/net-interp.js` | one state object, no timer or listener; the one test that read it by text reads the new file |
| C4: transport (client) | **NO-GO** | stays in `mp.js` | its handlers write state owned by almost every other part of `mp.js` |
| C5a: admin panel (client) | **NO-GO** | stays in `mp.js` | stateful UI shared with the transport; admin security behavior |
| C5b: death / vanish replays and bodies (client) | **NO-GO** | stays in `mp.js` | owned by Stage 3D (Gore & Death 2.0), which will change it anyway |
| C5c: peers presentation (client) | **NO-GO** | stays in `mp.js` | written by the transport, tied to the replays |
| Hum and dread audio (client) | **NO-GO** | stays in `mp.js` | owned by Stage 3F (atmosphere / audio) |
| S2: WebSocket framing (server) | **GO** | H0-4a, `server/ws.js` | `frame` is pure; the parser owns only its buffer |
| S3: field checks (server) | **GO** | H0-4b, `server/fields.js` | pure functions |
| S1: static file serving (server) | **GO** | H0-4c, `server/static.js` | shares nothing with the game |
| S4: rooms and sessions (server) | **NO-GO** | stays in `server.js` | the connection closure *is* the session |
| S5: snapshot builder and tick (server) | **NO-GO** | stays in `server.js` | timing authority |
| S5b: admin commands (server) | **NO-GO** | stays in `server.js` | admin behavior and security |
| Movement validation, death aftermath (server) | **NO-GO** | stays in `server.js` | game authority, not plumbing |

**Order.** H0-0 planned the server seams as S2, then S1, then S3. They landed as S2, S3, S1: the field checks are pure functions and were the simpler proof. The static serving is security-sensitive, so it went last, after the real-socket check (`raw_live.js`) existed.

**The 101 response stays in `server.js`.** The H0-0 map listed it with S2. It stayed in the upgrade handler with the rest of the acceptance decision, because the master prompt puts raw WebSocket acceptance outside 3H0. The H0-4a receipt says so.

## 2. Each NO-GO: the coupling, the risk, and what full 3H needs first

### C4: client transport (`connect` and its three handlers)

**The coupling.** `ws.onmessage` writes:
- `myId`;
- `adm.*`, then renders the admin panel;
- `kicked`;
- `bodiesList`, then calls `applyBodies`;
- the replays;
- the exit;
- items;
- `peers`, `peersN`, `me`, `mseq`, `cpNow`, `killSeq`;
- `snap` and `N.on`;
- the interpolation history;
- the `__ents` debug state.

`ws.onclose` resets most of those and the game's `__mv`. `ws.onopen` re-joins and re-authenticates the admin.

**Why it is a NO-GO.** Moving the handlers means handing them every one of those variables: through a shared state object, or through callbacks into every section. Either is a new design of who owns the client's session state, which is a rewrite, not a move.

**What full 3H needs first:**
- a written client session-state design (which part owns which field);
- a dispatch by message type, each handler owned by its section;
- per-message-type golden traces. The client harness can already drive every type; it would need finer records.

### C5a: admin panel (28 KB, 39 % of `mp.js`)

**The coupling:**
- it shares `adm` with the transport: the transport reads `adm.pass`, `adm.rv` and `adm.opts`, and writes `adm.res` and `adm.data`;
- it reads `ws.readyState`, `room` and `myId`;
- it calls `tx`, `giveItem` and `findSpot`;
- its `previewTick` runs every frame;
- a window `keydown` toggles it.

**Text-reading tests:** `dev/tests/s_humanqa_hotfix.js` X02 reads `data-n="10"` in `mp.js`.

**Why it is a NO-GO.** It is admin security behavior: the passcode is kept for reconnects and re-sent. It also depends on C4.

**What full 3H needs first:**
- the user's decision on the admin findings reported privately at H0-0;
- C4;
- an approved change to X02, so that it reads the new file.

### C5b and C5c: death / vanish replays, bodies, and peers presentation

**The coupling:**
- `startFx` reads `hMap`, `__api.q` and `bodiesList`;
- `drawPeers` reads `fxActive` and `hasBody`;
- the bundle reads `__fxKill`, `__fxKillS` and `__hideBodies`;
- `peers` is written by the transport.

**Text-reading tests:** `s_humanqa_hotfix.js` X03 reads the `DEAD` hover text in `mp.js`.

**Why it is a NO-GO.** Stage 3D (Gore & Death 2.0) will change this code. Moving it first would mean moving it twice, with the risk twice.

### Hum and dread audio

These are self-contained, but they are audio:
- they draw `Math.random()` in a fixed order;
- they share the game's AudioContext;
- `N.testHum` exposes the hum offline.

They belong to Stage 3F, which will tune them. The golden traces record their audio calls, so that work starts with a baseline.

### S4: rooms and sessions (the upgrade handler, `onMessage`, `bye`, `getRoom`)

**The coupling:**
- `onMessage` is a closure per connection, capturing `room`, `player`, `me`, `ip`, `name` and `id`;
- the order of the `sim` calls matters;
- `spawnNext` and the movement grace;
- the forfeit before removal.

**Text-reading tests:** `dev/tests/s_ir.js` I1 reads `me.ir =` (and the absence of `player.ir =`) in `server.js`.

**Why it is a NO-GO.** Moving the handler means giving the session an explicit shape: a session object with named fields instead of a closure. That is a redesign of ownership, and it also touches raw WebSocket acceptance and admin authentication, which sit in the same closure.

**What full 3H needs first:**
- a session object design;
- the private admin findings decided;
- the `lifecycle`, `deaths`, `admin` and `p_fields` golden scenarios, which already pin the behavior to the byte.

### S5: snapshot builder and tick

**The coupling:**
- `sim.entities()` is called exactly once per snapshot tick, and it drains the sound queue;
- per client, the order is exit, then bodies, then `s`;
- one shared `bodies` message per tick;
- the admin and debug cadences.

**Text-reading tests:** `s_ir.js` I1 reads `ir: c.ir`.

**Why it is a NO-GO.** It is the timing authority of the game, and the master prompt freezes the cadence.

**What full 3H needs first:**
- separating "build the snapshot for a room" from "schedule the room";
- the `schedule` golden scenario, which records every wake, step count and send;
- a snapshot-size performance gate.

### S5b: admin commands; movement validation; death aftermath

- **Admin commands:** admin behavior and security. `s_humanqa_hotfix.js` X02 reads the clamp text `Math.max(1, Math.min(10, m.n | 0 || 1))` in `server.js`.
- **Movement validation:** anti-cheat semantics (budget, slack, route checks, grace).
- **Death aftermath:** its timing is part of what players see.

All three are game authority. They should move only inside the stage that owns their behavior.

## 3. Findings recorded on the way (none changed)

**From H0-0.** See `3H0_Q0_AUDIT.md` section 6 and `3H0_PROTOCOL_INVENTORY.md`:
- `__net.collected` is undefined but unreachable;
- outbound messages of 64 KiB or more are dropped silently;
- the inbound parser ignores FIN and MASK, and the 1,400-byte limit;
- `isFinite(null)`;
- a `p` without `l`;
- the gzip cache;
- the step-time statistic.

**From H0-1, the sensitivity runs.** Two deliberate changes could not be seen by any test, because they change nothing observable:
- the 400 px "snap instead of glide" test for peers in `mp.js` has no effect: the very next statement, `Object.assign`, copies the peer's `x` and `y` anyway;
- the 90-character cut on admin answers in `server.js` never takes effect: the longest answer any command can produce is under 50 characters.

Both are in `3H0_H0_1_BASELINE.md` section 6.3.

**From live testing.** The known NEW RUN mismatch, a second vanish within the 30 s cooldown, leaves a ghost peer. The live wire comparison records it as it is, on both sides.

**From the H0-5 survey of Level 0.** Verified by reading the code:
- **`findSpot` in the admin death lab.** It checks the distance to glitched walls with `g.x` and `g.y`, but glitched walls are `[x, y, …]` arrays. The check is therefore always false and never excludes a spot near a glitched wall. Admin-only.
- **`TOUCH = 54` in `glitch.js` is declared and never used.** The 54 px exit radius in use is in `mp.js` (offline) and `sim.js` (online).
- **The Level 0 map exists twice,** in `sim.js` (server) and in the game bundle (client). The light kinds are listed in five places. See `3H0_FUTURE_LEVEL_AUTHORING_SEAMS.md`.

**From H0-5, the independent review: a second test reads moved code by its text.** `dev/shadows/test_shadows.js` S16 evaluates the `SERVE` line of `server.js`, which H0-4c moved to `server/static.js`.
- S16 now throws instead of reading it. It already failed at the parent, because it also expects `index.html` to load the retired `shadows-2d.js`.
- The suite gives 43/48 on the parent and on the final tree, with the same five failures (`evidence/h0-5/final_tree/test_shadows_*.log`).
- It was not adapted: adapting it could not make it pass, and 3H0 adapts only the one test whose result depends on the move.

**From H0-5: two checks that cannot tell versions apart, as written.**
- **QA2's `probe_q2`:** its check that a menu visitor is never caught needs a monster to come within 620 px first. In 30 seeded worlds the closest monster came within 620 px in 17. The check therefore fails about half the time on any version, before it tests anything. Its "ENTER … it walks" check needs more than 40 px in 1.2 s, and fails when the random spawn faces a wall; it failed on the parent once at H0-5.
- **The live wire comparison's outage phases:** the test stops and restarts the server. Reconnect timing, and the game playing offline with its own monsters meanwhile, vary between runs, so those two phases can differ on identical code. They are compared, and any difference is examined by hand. At H0-5 they differed in 2 of 3 runs, each time for a reason outside the extracted code.

**From H0-4c: a timing limit in `dev/tests/live.js`.** Its L5b check gives the Hound it summons 70 s to kill a player who stands still.
- The kill comes from the AI in a world generated at random for each run, so its time varies widely: from 2.6 to 53.0 s over 46 runs of the parent and the new code.
- One run at H0-4c went past 70 s and failed. The parent shows the same spread. `3H0_EQUIVALENCE_REPORT.md` (H0-4c) has the runs.
- The test was not changed. A later stage could give it a longer limit or a fixed seed.

**Security.** Pre-existing weaknesses found at H0-0 and H0-4 are reported to the user privately, in a file delivered with the human-QA package and kept out of the repository, which is public. 3H0 changes no security behavior.

## 4. A suggested order for full 3H

1. **Decide the private security findings first.** They touch the admin and session code that full 3H would move.
2. **C4:** the client session-state design and a dispatch by message type, with per-type golden traces.
3. **C5a:** the admin panel, after 1 and 2.
4. **S4:** a session object. Then **S5**, with the snapshot builder apart from the scheduler.
5. **C5b, C5c and the hum** go to the stages that own them (3D, 3F).

For each step, use the same gate:
- `run_checkpoint.js` (server and client golden traces against the parent, and the contract);
- `live_wire.js`, `raw_live.js`, `perf_det.js`;
- function equivalence and mutants for any pure piece;
- tests first, failing evidence kept.

## 5. What 3H0 leaves in place

- **The golden harnesses and baselines** (`dev/stage-3h0/golden/`, `evidence/h0-1`, `evidence/h0-1b`). Any later change to `mp.js` or `server.js` can be compared with the accepted parent byte for byte.
- **The conventions:**
  - helpers cut out of `mp.js` are classic scripts under `assets/`, loaded immediately before `mp.js`, with one namespace, `window.__mpLib`;
  - server modules live in `server/`, which the allowlist cannot reach, and are required where their code used to be.
- **The locks:** `3H0_MP_API_LOCK.md`, `3H0_SERVER_API_LOCK.md`, `3H0_PROTOCOL_INVENTORY.md`.
