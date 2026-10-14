# Stage 3D HQ2 — H2-0 audit, RED baselines and frozen decisions

HQ2 adds two things to the accepted HQ1 game:
- NEW RUN as a server-approved explosive self-destruction;
- living Wanderers that physically block each other.

This document is the H2-0 checkpoint. It covers:
- the parent gate;
- what the source does today, with the three bugs reproduced on the accepted parent before any change;
- the decisions the pack requires before implementation;
- the performance gates, measured from A/A noise;
- the file allowlist.

No production file is changed at H2-0.

Evidence: `dev/stage-3d-hq2/evidence/h2-0/` (see its `SUMMARY.md`). Tools: `dev/stage-3d-hq2/` (see its `README.md`).

## 1. Parent gate

`dev/stage-3d-hq2/preflight_hq2.py` records `evidence/h2-0/preflight.json`. Every check passed:

| Check | Result |
|---|---|
| `git ls-remote` `stage-3d-hq1` | `ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763` |
| GitHub REST branch head and commit tree | `ebb3bd6…` / `d0aaf5c47fcdeec1a449392093cf45cb4f6b8d16` |
| Local tree of that commit | `d0aaf5c4…` |
| HQ1 package receipt, its own `commit` and `tree` lines (whole-field equality, not substrings) | `ebb3bd6…` / `d0aaf5c…` |
| Ancestry | D7 `ffe2b53` and Stage 3H0 `06949a8` are ancestors of HQ1. D7 is not the HQ2 parent |
| `stage-3d-hq2` on GitHub before H2-0 | absent (`ls-remote` none, REST 404) |
| Local `stage-3d-hq2` | created at `ebb3bd6`, no other commit |

`evidence/h2-0/remote_heads_before_hq2.json` holds all 23 remote branches. `verify_remote_hq2.py` checks every one of them after each HQ2 push.

**Work preserved.** The workspace was clean before H2-0, apart from one stash, `stash@{0}` ("SH8 WIP" on `lighting-shadows-2d`). It predates Stage 3D and is left untouched.

**Production tree.** HQ1's final commit changed no production file after HQ1-3a (`a1d9cb9`). The HQ1-3 regression therefore ran on exactly the production files HQ2 starts from. `evidence/h2-0/production_manifest_parent.json` lists their blob ids.

## 2. What the source does today

### NEW RUN (the bundle, `mp.js`, `server.js`, `sim.js`)

The pause dialog's NEW RUN button is the bundle's `Xnr()` (`assets/index-DKbV5Nv9.js`, offset 334503). It does all of this **before the server has answered**:
1. It closes the dialog and starts a 2.7 s local fade (`VN`).
2. It makes a local light record with `cause: 'Vanish'` (`Ql`). `mp.js` `bodyMade` sends that record to the server as `b`.
3. It then sends `fx` `k:'vanish'` (`mp.js` line 45).

After 2.7 s, `Nend()` hides the player (`__hideSelf`), sends `leave` and shows the run menu. SPAWN (`Su()`) sends `join` and the client picks its own spawn point (`Xrs()`).

`Xnr()` also calls `Su()` directly in some cases: while `VN` is running, while caught, or after a win.

On the server, each of these messages is a separate, independent check (`server.js` lines 225–258, `sim.js` lines 145–169):

| Message | Server check |
|---|---|
| `b` `c:'Vanish'` | stores a light record if the player is alive, at most once per 5 s, near its position |
| `fx` `vanish` | `sim.vanish`: only while alive, at most once per 30 s (`VANISH_CD`). Refused silently |
| `leave` and `join` while alive | allowed only in a 2–20 s window after an accepted vanish |
| a refused `join` | answered with a `tp` back to the player's server position |

The client never learns that a vanish was refused.

### Movement and collision

**Client.** `move.js` `collide(H, dt, r, mode)` (line 35) pushes the player out of the level's static blockers (`__api.Bc`), one axis at a time. Players use radius 15 (`WORLD.MOVE.radius`): 13 while crawling or down, 14 while sliding. Vaults move along a fixed path with no collision (`stepVault`). Nothing anywhere treats another player as solid.

**Server.** `mvCheck` (`server.js` line 41) checks only two things:
- a distance budget;
- `sim.moveOk`, which tests walls in `any` mode (crawl holes and vaultable props count as passable).

Admins skip `mvCheck` entirely. The first position after a join or respawn only has to pass `sim.spawnOk`: walls within 20 px, and monster distance. Admin teleports (`moveTo`: bring, goto, glitch, item, entgoto) place the player exactly on the target. The admin world reset puts every active player on the same spawn point (`sim.spawn`, `Ic`).

**Other wanderers on screen.** The client draws them by smoothing towards the latest snapshot position (`o.x += (o.tx − o.x) · 0.3` per frame, `mp.js` `drawPeers`). Snapshots are sent at about 20 Hz.

**Sizes.** The drawn body is a circle of radius 18 (the bundle's avatar `$c`, `circle(0,1,18)`). The hands are circles of radius 6 at (±13, −13).

### Deaths, corpses and the world reset

A death is one server event, unchanged since D4:
- `aftStart`, `aftSend` and `aftTick` (`server.js` lines 67–108) run it;
- `death_srv.js` and `dphys.js` simulate it at 240 Hz;
- the corpse is made by the server, and HQ1 added the wall marks and the light profile `lf`.

An admin **world reset** (`server.js` line 176):
1. calls `sim.resetWorld` (`worldSeq++`, bodies cleared);
2. respawns every active player at `Ic`;
3. sends each of them a `tp`.

It sends nothing about deaths in progress. The server drops the death's aftermath on its next pass. No client is told about the reset as such: the snapshot carries no world epoch.

## 3. RED baselines (all on the accepted parent export, before any change)

### R-A — the NEW RUN cooldown phantom reset

Evidence: `red/proto/proto_red.json` (`nr_phantom`) and `red/nr_browser/` (two real pages and the server's own player list).

The second NEW RUN is pressed 6 s after the first. The server refuses its vanish (30 s cooldown). Yet:
- **Alice's screen:** the local fade plays, her avatar is hidden, and the run menu says "YOU FADE FROM THE LEVEL — Where to now?" (`nr2+3s_alice.png`).
- **The server:** keeps Alice active and alive where she stood, and stores a fresh `Vanish` light record there. That record goes out to everybody (`bodies` version changes 0.04 s after the press).
- **Bob's screen:** Bob keeps seeing Alice standing with her flashlight on (`nr2+3s_bob.png`).
- **The server's answers:** it refuses `leave` (`server_activeDuringAliceMenu: [1]`).
- **SPAWN:** her `join` is refused and a `tp` pulls her back to the old spot. Her client believes it is in a new run (`afterSpawn_alicePositions [[5720, 920]]`).

**Second phantom.** A press while the accepted NR3's own fade is still running makes `Xnr()` call `Su()` at once. Alice's page starts a new run elsewhere. The server refuses that `join` (the vanish is not 2 s old) and pulls her back about 1.2 s later.

(Alice's page held the test passcode so that the harness could put her back in front of Bob after each SPAWN. That changes nothing in this lifecycle. The protocol run, `proto_red.json`, uses an ordinary player and shows the same refusals.)

### R-B — no player collision

Evidence: `red/proto/proto_red.json` (`col_pass`, `col_tiny`, `col_stack`) and `red/col_browser/`. All the players are ordinary players, so their every step went through `mvCheck`.

| Case | Result |
|---|---|
| Walk straight through a standing player in the one-tile corridor at y = 720 (10 px every 50 ms) | accepted; server separation down to 20 px; Alice ends on the far side; no correction |
| The same in 1 px steps | accepted; separation 0 |
| A third player spawning exactly on a standing one | accepted; separation 0 |
| Real browser: Alice holds D for 3.5 s into Bob | she walks from x = 862 through Bob at 1012 to 1524; server minimum separation 13 px (sampled at 5 Hz); no correction (`closest_*.png`, `end_*.png`) |

### R-C — a world reset in the middle of a death (the inherited HQ1 limitation)

Evidence: `red/reset_epoch/`.

The setup:
- Alice dies a Hound C wall death with her flashlight on, in front of a lit papered face; Bob and Carol watch.
- 2.2 s after the server's replay message, a quiet admin connection sends WORLD → NEW RUN FOR EVERYONE.

The server respawns all three at the same point (960, 3264). From 1.5 s to 9.5 s after the reset, every sampled row on every page still shows the old world's death:

| Page | Rows | Still there |
|---|---|---|
| Alice | 7 | her own death sequence (7/7, "It found you." on screen), the old wallpaper stain (7/7), her local corpse (5/7), her dying light once |
| Bob | 9 | the old replay (9/9) and its stain (9/9) |
| Carol | 8 | the old replay (8/8) and its stain (8/8) |

HQ1's own light-lifecycle check 4 had already recorded this (`dev/stage-3d-hq1/evidence/hq1-3/hq1/light_lifecycle.json`).

## 4. Decisions (frozen for H2-1 … H2-4)

### D1 — collider radius and membership

**Contact distance D = 36 px**, centre to centre, i.e. a peer radius of 18. That is the drawn body circle: two bodies touch, without overlapping and without a gap. Walls keep their own radius 15/14/13, unchanged. Hands, hat, shadow and light are never colliders.

Why not 2 × 15 = 30? `evidence/h2-0/corridor_widths.json` (`dev/stage-3d-hq2/corridor_widths.js`) samples all walkable space at 12 px. Level 0's narrowest walk-mode passages have a centre span of 60–66 px: one-tile corridors 90–96 px between wall faces. No narrower walk-mode passage exists.
- **With D = 30**, a friend standing in the middle of such a corridor leaves exactly 30 px each side. Nobody could ever block a corridor.
- **With D = 36**, a friend standing still near the middle blocks it: within about ±3–6 px of the centre line, depending on the corridor. A friend who steps aside lets you squeeze past. That is the physical reading of "MOVE, MAN, MOVE!": the friend has to move.

Approaching a slightly off-centre friend head-on, you slide around them slowly. The motion into them is removed and only its sideways part remains. Human QA judges whether this feels right; the radius is the only number to change if it does not.

**Membership.** Both the blocker and the one blocked must be:
- in the same room;
- `active`;
- not `dead`;
- not `exited`;
- not held in a capture (`caught`).

Excluded therefore:
- players in the menu (including after an approved NEW RUN, which takes the player out of the world at once);
- the dead (corpses are never blockers);
- captured players: the monster's drag must never be blocked, so collision cannot interfere with a death;
- disconnected players (removed with their connection).

God mode and spawn protection (`safe`) do not exclude anyone. Admins are members.

**Elevation.** Level 0 has one walkable plane. Crouch, crawl, slide and vault keep a player on it: a vault is a short hop over a low prop, and crawl spaces are on the floor. So every member is at the same traversable elevation. No Z rules are invented.

### D2 — server order, zero distance, ties

For an ordinary player, `mvCheck` keeps its order:
1. budget;
2. walls (`sim.moveOk`) — walls always win, and a wall refusal never reaches step 3;
3. **then** the peers.

The peer step works on the wall-legal segment P0 → P1 (P0 the server position, P1 the claimed one). It finds the furthest point along the segment such that, for every member peer q, the segment never comes closer to q than min(|P0 − q|, D) − TOL, with **TOL = 2 px** (positions are integers on the wire).
- If the whole segment is legal, P1 is accepted.
- Otherwise the move is accepted **up to first contact**: bounded resolution, not a refusal. The clamped point is checked with `sim.moveOk` again, because a long move may have followed a route rather than the straight line. If that fails, P0 is kept.

Consequences:
- **Overlap can only shrink.** A player overlapping another (an old position, or a fallback spawn) may make any move that does not bring them closer. At zero distance every direction is allowed, so stacked players separate freely and never soft-lock.
- **No normal vectors on the server.** The test is pure closest-approach arithmetic on segments, so a zero distance cannot produce a NaN. A zero-length move is accepted as it is.
- **Order.** Node handles one message at a time. Two players' packets in the same server wake are validated in arrival order, each against the other's latest accepted position. The second mover is the one clamped. Every accepted segment is swept, so no order lets them pass through each other.
- **Admins.** Their own moves skip the wall check (their debug tools move them from the client), but now pass the same peer sweep. A long admin jump (≥ 120 px, a teleport) is not swept: its end point is checked instead and, if it lands in a peer, moved to the nearest free spot.
- **Server-side placement.** Join and respawn spawn points (`spawnOk`), the fallback spawn, the admin teleports and the admin world reset all go through one helper, `freeSpot(x, y)`. It returns a point clear of walls (radius 20) and at least D + 8 from every member. It searches up to 72 candidates on rings around the target. If none is free it falls back to the target itself, which the zero-distance rule makes safe.

**AI.** It still hears and sees only accepted movement (`obsV` from accepted positions), so a blocked player is heard as the speed it really moved. No AI file changes.

### D3 — reconciliation and lag

**Client prediction** (`move.js`):
- Before the existing wall push-out, the velocity loses the part that would take the player within D of a living peer this step. The sideways part is kept, which gives the tangential slide.
- An idle player is never moved: nothing pushes, and only your own motion is constrained.
- Peers are the latest snapshot positions `tx, ty` (the server's accepted positions), not the smoothed drawing, and only living members (dead, held and departed players are skipped).
- The same rule covers walking, running, crouching, crawling and sliding. A vault does not start when its path or landing passes within D of a living peer: it bumps, like a wall.
- Offline, or with no living peer, the step is exactly the old one.

**Server correction.** The server clamps silently when the claimed point is within 8 px of the clamped one. Beyond that, or when a mismatch above 2 px lasts 300 ms, it sends a soft correction `{t:'tp', x, y, pc:1}`:
- at most one every 300 ms per player;
- the client blends to it over 120 ms, keeping its velocity's sideways part, instead of snapping.

The existing hard `tp` (walls, teleports, budget) is unchanged.

**Anti-bypass.** Every accepted packet is swept, however small, so tiny steps cannot add up through a body. A burst is one longer segment, still swept. A client that disables its own prediction is simply clamped. NaN, Infinity, strings and huge numbers are already rejected or clamped by `num()`. Peer positions come only from the server: no client claim about another player is ever read.

### D4 — NEW RUN eligibility (one decision per intent)

**Client to server:** `{t:'nr', q, w}`.
- `q` is the client's press number: a positive integer, increasing.
- `w` is the world epoch the client last saw.

The server answers once per new `q`:

| Case | Answer |
|---|---|
| same `q` again | the stored answer resent; no new event |
| older `q` | ignored |
| more than one new intent within 250 ms | ignored (flood) |
| not active (menu) or `exited` | `nra ok:0 why:'state'` |
| dead | `why:'dead'` |
| held in a capture | `why:'held'` |
| `w` missing or not the current `worldSeq` | `why:'epoch'` (a press from before a world reset) |
| less than 30 s since this player's last approved NEW RUN | `why:'cooldown'`, `wait` in tenths of a second |
| otherwise | **approved** |

**On approval**, in the same message handler:
1. record `nrAt`;
2. allocate the event id `de`;
3. take the player out of the world (menu state; `sim` keeps one lifecycle);
4. reply `{t:'nra', q, ok:1, de}`.

H2-2 adds the explosion: the event, its aftermath and the corpse.

**Lifecycle cleanup.** `join` from alive, and `leave` from alive, are no longer allowed under any circumstances. The vanish window (`VANISH_MIN`, `VANISH_MAX`, `vanishOk`) is removed. The 30 s cooldown stays, as the NEW RUN cooldown.

**Admin world reset and ordinary deaths.** They never touch `nrAt`, never send `nra`, and never explode anyone.

**Reconnect.** A new connection is a new player, as today (there are no accounts), so it has a fresh cooldown. An approved NEW RUN whose connection drops still completes on the server.

**Client.** A press while online:
- sends the intent and marks the button pending, for up to 2 s;
- changes nothing else;
- on approval, plays a short local beat (about 0.8 s, avatar hidden) and then the run menu;
- on refusal, leaves the dialog open and shows the reason ("NEW RUN IN 23 s", "CAN'T NOW").

`Xnr()` no longer calls `Su()` while a run is in progress online.

**Offline.** No connection at all keeps the old local fade. It shares nothing and asserts nothing to anyone, and is documented as such.

### D5 — wire changes (old → new)

| Message | HQ1 | HQ2 |
|---|---|---|
| `nr` (client→server) | — | **new** `{q, w}` |
| `nra` (server→client) | — | **new** `{q, ok, why?, wait?, de?}`, about 30–45 B, once per press |
| `fx` (client→server) | `k:'vanish'` accepted and relayed | **removed**: the server ignores every client `fx` (death replays were already server-only) |
| `fx` (server→client) | `death`, `vanish`, `end` | `vanish` **removed**. `boom` **new** (H2-2): the death replay's fields without attacker fields, plus the seed and the HQ1 light profile. Every `fx` carries `w`. A world reset sends `end` for every event in progress |
| `b` (client→server) | `c:'Vanish'` light record | **removed** (ignored; `mp.js` no longer sends it) |
| `bodies` | records `c:'Hound'`, `'Smiler'`, `'Vanish'` | `'Vanish'` no longer created. `'Boom'` **new**: a full body, hands, gear, hat, blood and wall marks, with `lf`. The message carries `w` |
| `mk` (inside `s`) | the victim's kill record | unchanged |
| `s` | snapshot | **adds `w`** (world epoch, about 6 B) |
| `tp` | correction / teleport | optional `pc:1` (soft peer correction). World-reset `tp`s now go to free spots |
| `world` | — | **new** `{t:'world', w}`, sent to everyone at an admin reset |
| `join`, `leave`, `respawn` | — | same messages; `join` and `leave` from alive are always refused |

**Bandwidth.** `s.w` adds about 120 B/s per client (about 0.3 % of HQ1's 35.3 kB/s with eight players). Everything else is per event. The removed `b`/`fx` vanish messages cost nothing in steady state either way. Gate G7 is below.

### D6 — the world epoch and the reset

**Server.** An admin world reset now:
1. increments `worldSeq` (already);
2. marks every death and explosion aftermath in progress as dropped, at once;
3. sends `{t:'world', w}` and an `fx end` (with `w`) for each of them to every client;
4. places every active player on a free spot.

Every death or explosion message, `bodies` and `s` carry `w`.

**Client.** When it learns of a newer `w` (the `world` message, or the first `s` that carries it), it ends:
- every replay;
- its own death sequence, if one is playing. The server has already brought the player back: a new bundle hook ends the local death where the server's `tp` put it. It does not pick a new spawn or send `respawn`;
- its local corpse, the stains and the dying lights of the old epoch;
- any old-epoch explosion beat.

It then ignores any later `fx`, `bodies` or `mk` whose `w` is older. Peer blockers come from the new snapshot.

**What the reset does not do.** It does not touch any player's NEW RUN cooldown and explodes nobody (R04).

**Solo NEW RUN.** A player alone in the room who starts a new run gets a fresh world, as today (`sim.join` resets the world when no other player is active). That is a true reset, so its explosion corpse is cleared with the rest of the old epoch. With anybody else in the room there is no reset, and the explosion's corpse stays for them. A later death of the same player replaces it: one corpse per player.

### D7 — performance gates (from the A/A run at H2-0)

See section 5. Each gate fails when the measurement falls outside it.

### D8 — fixtures and the file allowlist

**Fixtures.** Everything runs:
- on this machine;
- with SwiftShader (paired comparisons only, never a GPU claim);
- with the synthetic admin passcode `d3-synthetic-admin`;
- against an export of the parent (`git archive ebb3bd6`).

The one-tile corridor at y = 720 (centre line x 400–2000; walk-mode centre span 64 px, 94 px wall to wall) is the narrow-hall fixture. The open hall at (4250–5300, 3504) is the wide-area and crowd fixture.

**Allowlist** (`dev/stage-3d-hq2/scope_hq2.py`, run at every checkpoint).

Production files HQ2 may change, each for its stated reason only:
- `server.js`;
- `sim.js` (from `dev/sim_glue.js` / `dev/sim_head.js` via `dev/build_sim.sh`);
- `death_srv.js`;
- `dphys.js`;
- `mp.js`;
- `move.js`;
- `assets/index-DKbV5Nv9.js` (exact-text edits by `dev/stage-3d/apply_bundle.py` only);
- `assets/net-wire.js` (only if needed);
- `gore.js` (only through HQ1's paths);
- `ents.js` (one explosion sound);
- `index.html` (the run-menu copy only).

One new production file: `server/peers.js` (server-side geometry, never served).

Development files HQ2 may change:
- `dev/stage-3d-hq2/**` (its own tools and evidence);
- `dev/stage-3d/apply_bundle.py` (the bundle's edit list);
- `dev/sim_glue.js`, `dev/sim_head.js`, `dev/build_sim.sh`;
- `dev/ents_src/*`, `dev/build_ents.sh`.

Older stages' tools, tests and evidence stay exactly as they are, including `dev/tests`, `dev/stage-3d/*.js|py`, `dev/stage-3h0` and `dev/stage-3d-hq1`. An older assertion that HQ2 changes on purpose is not edited. For example, the vanish lifecycle in `s_audit` L9, `audit_net2` LC4 and `death_net` N9, and the 3H0 golden NEW RUN phase. Each is reported as an expected protocol-delta failure, by name, next to the HQ2 test that replaces it.

Everything else in production is forbidden. That includes:
- `world.js`, `ai.js`, `light.js`;
- `assets/br-role.js`, `assets/l0-remaster.js`, `assets/ui.js`;
- `server/ws.js`, `server/fields.js`, `server/static.js`;
- the menu, the theme and every older stage's evidence.

## 5. Performance gates

**Method.** The formulas below were written before the A/A numbers were read (`dev/stage-3d-hq2/aa_gates.py`). The A/A run measured two exports of the accepted parent `ebb3bd6`, interleaved, in this session, on this machine (SwiftShader: paired comparisons only, never a GPU claim). Evidence: `evidence/h2-0/aa/`.

**Browser**: `dev/stage-3d/perf_death.py`, idle plus the Hound A and Hound C deaths, victim and spectator pages, three pairs.
- For each run, take the worst round, as `perf_compare.py` does. The A/A noise N is the largest |change| between the two exports.
- HQ2 is measured against HQ1 the same way, with at least three interleaved pairs, using the mean of the pairs' changes.
- Gate: frame median ≤ +max(7 %, 1.5 N), and never more than +15 %. Frame p95 ≤ +max(10 %, 1.5 N), and never more than +20 %.

**New windows, which HQ1 cannot have.**
- The explosion: the spectator's and the initiator's frame median during it must be no worse than the Hound C death window's median in the same run, + 10 %.
- Two players in contact, moving: no worse than idle + 7 % in the same run.

**Server**: `srv_load.js`, eight ordinary players, two pairs per layout.
- CPU seconds over 45 s: ≤ +max(10 %, 1.5 N) for `spread`, and ≤ +max(15 %, 1.5 N) for `crowd`, where every packet is swept against seven peers.
- The 60 Hz step mean: ≤ +max(10 %, 1.5 N).
- The admin ping p99: ≤ +max(5 ms, 1.5 N).
- The peer sweep alone (a micro-benchmark of `server/peers.js`): ≤ 5 µs per packet with seven peers, at p99.

**Network**: `dev/stage-3d-hq1/traffic8.js`, eight players. Bytes per second per client ≤ +max(3 %, 1.5 N).

**Memory**:
- The forced-GC server heap: no growth per NEW RUN event (≤ 0.01 MB per event over 32 events, like HQ1's per-death figure).
- No unbounded per-player collision state.

**Twenty corpses**, as HQ1's R4: ≤ HQ1 + 10 % on and off screen.

A measurement outside its gate is reported as not met; no gate is moved after H2-0.

**The A/A run and the gates it sets** (`evidence/h2-0/aa/perf_gates.json`):

| measure | A/A changes (b against a) | noise | gate for HQ2 against HQ1 |
|---|---|---|---|
| idle victim median | -25.5 %, -10.0 %, +11.9 % | 25.5 % | ≤ +15 % |
| idle victim p95 | -20.0 %, -7.0 %, +1.9 % | 20.0 % | ≤ +20 % |
| idle spectator median | -17.7 %, +4.5 %, +7.3 % | 17.7 % | ≤ +15 % |
| idle spectator p95 | -17.6 %, +0.0 %, +3.7 % | 17.6 % | ≤ +20 % |
| death_houndA victim median | -8.8 %, -2.0 %, -3.0 % | 8.8 % | ≤ +13.2 % |
| death_houndA victim p95 | -13.0 %, -3.9 %, -2.0 % | 13.0 % | ≤ +19.5 % |
| death_houndA spectator median | -9.5 %, +0.0 %, -1.0 % | 9.5 % | ≤ +14.3 % |
| death_houndA spectator p95 | -14.3 %, -2.0 %, -3.8 % | 14.3 % | ≤ +20 % |
| death_houndC victim median | +4.9 %, -3.6 %, -15.8 % | 15.8 % | ≤ +15 % |
| death_houndC victim p95 | +4.9 %, -2.4 %, -16.7 % | 16.7 % | ≤ +20 % |
| death_houndC spectator median | +4.9 %, -0.0 %, -14.6 % | 14.6 % | ≤ +15 % |
| death_houndC spectator p95 | +11.9 %, -4.6 %, -18.0 % | 18.0 % | ≤ +20 % |
| whole_houndC victim median | +4.9 %, -6.8 %, -1.2 % | 6.8 % | ≤ +10.2 % |
| whole_houndC spectator median | +7.6 %, -2.4 %, -2.4 % | 7.6 % | ≤ +11.4 % |
| whole_houndA victim median | -7.9 %, +2.1 %, +2.1 % | 7.9 % | ≤ +11.8 % |
| whole_houndA spectator median | -9.8 %, +2.0 %, +0.0 % | 9.8 % | ≤ +14.7 % |
| server spread: CPU | +2.1 %, +2.9 % | | ≤ +10 % (HQ1 1.43 s per 45 s) |
| server spread: 60 Hz step mean | -4.2 %, +8.9 % | | ≤ +13.3 % (HQ1 0.047 ms) |
| server spread: ping p99 | +0.00 ms, -1.00 ms | | ≤ +5 ms (HQ1 1.25 ms) |
| server crowd: CPU | -2.1 %, +5.2 % | | ≤ +15 % (HQ1 1.41 s per 45 s) |
| server crowd: 60 Hz step mean | +0.0 %, +10.0 % | | ≤ +15.0 % (HQ1 0.0527 ms) |
| server crowd: ping p99 | +0.00 ms, +3.00 ms | | ≤ +5 ms (HQ1 2.25 ms) |
| network: bytes/s per client, 8 players | 0.14 % | | ≤ +3 % (HQ1 35364 B/s) |

**What the A/A says.**
- On SwiftShader with two pages sharing two cores, a single window's worst-round median moves by up to 25 % between identical builds. The few-frame windows are the noisiest: idle, and the Hound C death, which holds 4–7 frames. That is why most browser gates sit at or near their caps (+15 % median, +20 % p95), and why HQ2 is judged on the mean of at least three interleaved pairs.
- The server and network figures are tight: CPU within ±5 %, ping p99 within 3 ms, traffic within 0.14 %.
- In HQ1's `crowd` run, all seven players end on the same point (minimum separation 0). That is the RED for crowding as well.

## 6. The explosion (H2-2 plan, recorded here for the reviewers)

**Physics.** A separate `Boom` kind in `dphys.js`, beside the eight untouched Hound/Smiler variants:
- no attacker;
- at t = 0, a server-seeded impulse (direction, strength, spin) on the one rounded body;
- the two hands thrown apart;
- the light and the hat released with their own kicks;
- then the existing free-body solver against the level's walls at 240 Hz.

The HQ1 machinery is reused as it is: wall contacts become wall marks (`dphys.marks`, HQ1 wallpaper stains), and the light failure is the server's `lightProfile` from the moment the light is let go.

**Server.** `death_srv.js` runs it, as it runs a death: `fxFor` / `begin` / `step` / `corpse` with cause `Boom`. The explosion is an aftermath entry on the server, as a death is. `aftSend` gives each client its replay once, a late joiner with `el`; `aftTick` makes the corpse.

**Clients.** Each client plays it through the existing replay path (`startFx`, the bundle's `Jl`) with no attacker sprite. The sound is placed once, on the existing audio bus.

**What it never does.** It never touches another player or entity (no push, no damage, no stun, no AI event) and makes no light of its own. Its light is the dropped gear's own, with the HQ1 profile.

**Gate.** Old deaths stay identical: `phys_matrix` and the server golden traces compare the eight variants byte for byte against HQ1.

**Risks recorded now.** The bundle's death class `Jl` has cause-specific branches (`Hound` / `Smiler`) for its blood, debris and sound. Each one that a `Boom` reaches must be checked and, where needed, given a narrow exact-text edit.

## 7. Gates and the tools that will measure them

| Gate | Tool (H2-0 version measures the RED) |
|---|---|
| E01–E02, E04–E05, R04 | `nr_browser.py` (two pages + the server's player list), `proto_lab.js` (`nr_*` scenarios; mutation run for E02) |
| E03, E06, E09 | HQ1's light timeline / capture tools on a NEW RUN, plus a new parity run across render rates |
| E07, E08 | `proto_lab.js` (forged `fx`, `b`, `nr` packets), `phys_matrix`, `golden3d` |
| C01–C03, C09 | `col_browser.py` (ordinary players, keyboard), `proto_lab.js` sweeps |
| C04, C05 | `srv_load.js crowd`, `proto_lab.js` spawn cases |
| C06, C07, C08, C10 | `proto_lab.js` (lifecycle, rooms, bypass fuzz with a mutation run, latency shaping) |
| R01–R03 | `reset_epoch.py` (three pages; Hound C mid-death, explosion mid-flight, late join) |
| Regression | the HQ1-3 battery re-based on HQ1 (goldens, contract, `death_net`, `light_net`, wall/light lifecycles, BR-RoLE, QA2 probes, older suites) |

## 8. Known inherited exceptions (carried from HQ1, not HQ2's)

These are HQ1's four gated lines that were not met:
- D0's absolute frame-time limits (this machine is slower than D0's);
- the 32-death soak's RSS not levelling within 32 deaths (it levels by 64);
- the no-GC soak's 0.5 MB late peak;
- the light lifecycle check 4, which is R-C above and which HQ2 repairs.

Also carried:
- the D7 Hound A spectator cost note;
- the older suites' known failures (`npm test` 151/162 and `test_shadows` 43/48, the same names as D7);
- `s_humanqa_hotfix` 5/6.

HQ2 reports each of these again, against HQ1, in the same session.
