# Stage 3D HQ2: NEW RUN explosion and player collision, report

**Branch** `stage-3d-hq2`, a straight line from the accepted HQ1 parent `ebb3bd6` (tree `d0aaf5c`). D7 `ffe2b53` is an ancestor, never the parent.
- Normal pushes only, nothing merged, no other branch touched. `main`, `stage-3d`, `stage-3d-hq1`, `stage-3h0`, the Stage 3C branches and every older branch are where they were before HQ2: checked on GitHub after every push (23 branches).
- The human-QA package and its receipt verify the final commit from the ZIP itself.
- The final production source is H2-5's commit `65a1309`. H2-6 adds only tools, evidence and documents.

HQ2 adds the two features you asked for, plus the two lifecycle repairs they need, and nothing else.

This is a **candidate**: only you can say HUMAN QA PASSED. The steps are in `STAGE_3D_HQ2_HUMAN_QA.md`.

## What HQ2 changes

### A. NEW RUN is the server's decision, and it is an explosion

**The decision** (H2-1; `STAGE_3D_HQ2_NEW_RUN_AUTHORITY.md`).
- The button sends only an intent, `{t:'nr', q, w}`. The page changes nothing until the server answers.
- The server answers each press once, `{t:'nra', q, ok, …}`:
  - **Approved.** The player leaves the world in the same message handler, so no later snapshot shows a living player there.
  - **Refused**, with the reason: `state`, `dead`, `held`, `cooldown` (with the seconds left of the 30 s) or `epoch`. Nothing changes anywhere: no fade, no ghost, no light left behind, no new run.
- A repeated press number gets the same answer. An older, malformed or too-fast press gets none.
- A world reset, a death, END and RESPAWN never answer a NEW RUN, explode anyone, or start anyone's cooldown.
- On the page, the button says `NEW RUN · …` while it waits and `NEW RUN · WAIT n S` or `NEW RUN · NOT NOW` when refused. An approval hides the player at once; a 0.8 s beat shows the blast, then the run menu says "YOU BLEW YOURSELF UP".
- Offline (no server at all), the old local fade is unchanged; it shares nothing.

**The blast** (H2-2).
- **The server makes it.** It is one event with the next event id, at the position the server holds. Its seed and direction are a hash of the world's number and the event id, never a random draw.
- **The physics** is a separate `Boom` kind in `dphys.js` beside the untouched eight deaths, stepped at 240 Hz:
  - the one rounded body is thrown and spun;
  - both hands fly on their springs;
  - a handheld light and the hat are torn away (a headlamp stays on the head);
  - four blood bursts land on the floor;
  - a wall struck harder than 80 px/s gets HQ1's wallpaper stain.
- **Everyone sees the same blast.** One replay message goes to every page, the player's own included; a late joiner's carries `el`. At 3.2 s the server places the corpse (`c:'Boom'`). There is one corpse per player: a later blast or death replaces it, and a world reset clears it.
- **The light.** A light that was on (not the camcorder) gets HQ1's accepted profile: it holds 3–7 s from the blast, flickers out over 1–2 s, then stays at exactly 0. A light that was off never emits.
- **It is no attack.** No other player is moved, corrected, stunned or hurt. No entity is told anything. It has no light of its own: no flash, no camera motion (E09). It is heard once, where it happened; a late joiner does not hear it.

**Removed.**
- The client's `fx:'vanish'` and `b:'Vanish'` messages are no longer read.
- The server makes no `Vanish` record and relays no vanish.
- The 2–20 s vanish window and its join/leave allowances are gone.

### B. Living Wanderers are solid to each other

`STAGE_3D_HQ2_PLAYER_COLLISION.md` has the full rules.

**The body.** Every player is a circle of radius 18, the drawn body, so two living players never come closer than **D = 36 px**, centre to centre.
- **Solid:** in a run, alive, not held, not out through a glitch, in the same room.
- **Never solid:** a dead player, every corpse, a held player (the monster's drag is never blocked), a player in the menu, one who has disconnected.

**The server** (H2-3, `server/peers.js`). It checks every position packet against the walls first, then against the other players:
- an accepted move ends no closer than min(start distance, D);
- its path never dips more than 2 px below that;
- a long hop the walls allow only round a corner is swept along that route.

A claim that breaks the rule is slid along the body, else clamped at contact, else held. The server never moves anybody else. It tells the client:
- nothing within 8 px of the claim;
- otherwise a soft correction `tp pc:1`, at most one every 0.3 s.

**Placement.** Spawns, respawns, admin BRING/GOTO/teleports and the world reset go where they always did, unless someone stands within 44 px. Then the player goes to the nearest free spot on six rings out to 220 px. If none is free, the original spot is used, and the overlap rule lets them walk apart.

**The browser** (H2-4, `move.js`). Each 60 Hz step loses the part of its velocity that would go into a living player (kept at 36.75 px), and keeps the part along him: you slide round a player, and stop dead against one head-on.
- A slide dies at contact.
- A vault does not start onto or through a player.
- With nobody there, the step is exactly HQ1's, tick for tick.

The page blends every soft correction (up to 600 px) in over 120 ms; it never snaps (H2-5's repair).

**Not added:** pushing, shoving, blast knockback, PvP damage, solid or movable corpses, new movement.

### C. The two lifecycle repairs

**The NEW RUN cooldown phantom** (H2-0's RED R-A). On HQ1, a press refused by the 30 s cooldown still faded the player out on her own screen. It left a light record, opened a run menu whose SPAWN the server refused, and showed Bob a living Alice. **Fixed by A**: H2-0's reproduction now gets one truthful refusal and no change (E02, below).

**An admin world reset during a death** (H2-0's RED R-C; HQ1's own known limitation, its light lifecycle check 4). On HQ1, the old death went on playing on every screen after the reset, with its stain, corpse and dying light. **Fixed** (H2-4):
- The server drops every death and blast in progress and sends `{t:'world', w, x?, y?}`, then an `end` for each.
- Every page ends everything of the old world at once: replays, its own death (where the server put it, with no respawn of its own), corpses, wall stains and dying lights.
- From then on the page drops any message naming an older world.
- A reset is nobody's NEW RUN.

## What stayed exactly as it was

**Byte-identical to HQ1:**
- `index.html` (no new script, same load order) and `assets/net-wire.js` (no new corpse field);
- the lighting (`light.js`, BR-RoLE), the Level 0 remaster, the AI, the level, the camera, the HUD, the menu, sound, the themes;
- every older test (`dev/tests`) and every earlier stage's tools and evidence;
- the deployment.

**The eight Hound/Smiler deaths** are identical number for number to HQ1's:
- `death_equiv` 384 runs and 800 light profiles;
- `phys_matrix` (96 runs × 8);
- parity within 1 px on both screens.

**The files changed.** Ten production files changed (one new: `server/peers.js`), plus the three sources of the two built files and the bundle's edit list `dev/stage-3d/apply_bundle.py`. `STAGE_3D_HQ2_CHANGED_FILES.txt` lists each with what and why.

Every one of them is on H2-0's allowlist (`scope_hq2.py`: nothing forbidden). One reason differs from the allowlist's:
- the allowlist named `gore.js` for the blast's blood;
- the blast needed no `gore.js` change;
- its one change is `wallStains.clear()`, for the world reset.

## The wire: additions and deletions

| Direction | Added | Removed |
|---|---|---|
| client → server | `{t:'nr', q, w}`: the NEW RUN intent | `fx` (`k:'vanish'`, and the client death replay already ignored since D7) and `b` (`c:'Vanish'`) are no longer read |
| server → client | `{t:'nra', q, ok, why?, wait?, de?, w?}`: the one answer to a press | `fx` `k:'vanish'` (never relayed) |
| server → client | `{t:'fx', k:'boom', id, de, wn, x, y, a, d, s, lk, ek, ec, ep, vx, vy, lo, lf?, el?, srv:1}`: the blast replay | — |
| server → client | `{t:'world', w, x?, y?}`: an admin world reset | — |
| server → client | `wn` (the world's number) on death `fx`, blast `fx` and `fx` `end`; `w` on `s` (each snapshot) and `bodies`; `pc:1` on a soft-correction `tp` | — |
| corpse records | `c:'Boom'` records (the blast's corpse: body, hands, light, hat, blood, wall marks, `lf`, `de`) | `c:'Vanish'` records are no longer created |

A death replay's `w` is the Hound C wall `[x, y, angle]` or `0`, exactly as in HQ1 (H2-5's repair; see Tests).

## Checkpoints

| | Commit | Tree | What |
|---|---|---|---|
| H2-0 | `9490001` | `727a7ad` | audit, RED baselines on HQ1, gates frozen before any change (`STAGE_3D_HQ2_AUDIT.md`) |
| H2-1 | `d27a2af` | `cd44ce9` | NEW RUN as the server's decision; the cooldown without a phantom |
| H2-2 | `14cf47a` | `5a34ed8` | the explosion |
| H2-3 | `c61469d` | `4cef611` | living players solid on the server |
| H2-4 | `99e1593` | `e80b3eb` | the browser's prediction; the world epoch |
| H2-5 | `65a1309` | `2bcb8ce` | the full regression, the performance gates, the films; two repairs it found |
| H2-6 | in the receipt | | this report, the changed files, the human-QA steps, the last gate cases, the summary of every test, the package (a commit cannot hold its own hash: `STAGE_3D_HQ2_PACKAGE_RECEIPT.txt` gives H2-6's commit and tree, verified from the ZIP) |

Full hashes and each remote check: `STAGE_3D_HQ2_SOURCE_PARENT_AND_CHECKPOINTS.md`.

Each checkpoint:
1. ran its focused tests and kept its failed first runs (`attempts/`);
2. was committed and pushed normally;
3. was verified on GitHub (`dev/stage-3d-hq2/verify_remote_hq2.py`): `git ls-remote`, the REST commit, tree and parent, a straight line from `ebb3bd6`, every other branch unmoved, no new branch. Its `remote_*.json` is in the next checkpoint's evidence.

## The gate matrix

Every gate was fixed at H2-0, before any change. SwiftShader software rendering throughout; no real GPU was tested.

| Gate | Evidence | Result |
|---|---|---|
| E01 one press, one approval, one event, one replay, one corpse, a prompt new run | `proto/nr_all` (`nr_flow`, `nr_boom`), `browser/boom_*` ×4, `browser/multi8` | **Met** |
| E02 refused inside the 30 s (at 1 s, 10 s, 29.9 s, a flood of 100): nothing changes anywhere; approved at 30 s | `proto/nr_all` (`nr_e02`), `browser/nr_e02` 7/7; mutations `e02_no_cooldown`, `e02_local_first` caught | **Met** |
| E03 the dropped light: HQ1's hold and fade; off stays off; the camcorder no light; late join, rejoin, focus lost, reset | `browser/boom_*` (flashlight, lantern, headlamp, off), `proto` `nr_boom_lights`, `browser/reset_boom`, H2-6 `browser/life_light` | **Met** |
| E04 a dropped connection during the intent, at the approval, during the blast, a reconnect | `proto/h25` (`nr_abort`), H2-6 `browser/life_light` | **Met** (a reconnect is a new player with a fresh cooldown: below) |
| E05 death against NEW RUN, held, menu, a world reset, END, RESPAWN: no unauthorised blast or extra corpse | `proto/nr_all` (`nr_elig`, `nr_held`), `proto/h25` (`nr_race`) | **Met** |
| E06 every screen the same blast; at every render rate | `browser/boom_*`: every replay frame equal to the server's own run, worst 0.0 px. H2-6 `unit/boom_fps`: 64 blasts at 30–360 FPS, a jittered busy page and the Death Lab's clock, 232,768 frames bit for bit; mutation `f_step_cap` caught | **Met** |
| E07 again after the cooldown, the next death, a world reset: the older corpse replaced or cleared | `proto/nr_all` (`nr_boom_again`), `proto/h25` (`nr_many`: four at once, a room next door) | **Met** |
| E08 the eight deaths unchanged; forged replay or body packets change nothing | `death_equiv`, `phys_matrix`, `parity3d` + `parity_judge`, `proto` `nr_elig` (the dead channels), `abuse` | **Met** |
| E09 blackout, reduced motion, no audio permission, a muted spectator, behind a wall: no flash, no camera jump | `browser/e09` 6/6 | **Met** (the game has no reduced-motion setting: below) |
| C01 a narrow hall: no pass-through; back away, travel when clear | `proto/col_all` (`col_head`), `browser/col_head`, the main film | **Met** |
| C02 a wide hall: slide round, no jitter; nothing changes far apart | `proto` `col_wide`, `browser/col_aside`, `unit/predict_unit` (solo identical to HQ1's) | **Met** |
| C03 two movers at 30–360 FPS and a lag burst: no tunnelling | `proto` `col_two`, `col_bypass`, `unit/predict_unit` P2 | **Met** |
| C04 3, 4, 8 players at a choke point | `proto` `col_crowd`, `net/net_predict` (8 pages), `browser/multi8` (7, then 8 real pages): never closer than D | **Met** |
| C05 join, respawn, admin moves onto someone: a free spot | `proto` `col_spawn`, `col_respawn` | **Met** |
| C06 death, capture, NEW RUN, disconnect, menu, room change: the blocker gone exactly once | `proto` `col_member`, `col_held`, `col_rooms` | **Met** |
| C07 other rooms never collide; offline solo identical | `proto` `col_rooms`, `unit/predict_unit` P1 | **Met** |
| C08 bypass: tiny steps, bursts, stale and malformed packets | `proto` `col_bypass`, `abuse`, `unit/peers_unit` (1.2 million fuzzed moves); mutations `c08_*` caught | **Met** |
| C09 vault, crawl, slide, a chase: no noclip, AI hearing honest | `unit/predict_unit` P4–P5, `proto/h25` (`col_chase`) | **Met** |
| C10 100/200/300 ms, jitter, stalls, two movers: bounded corrections, no oscillation | `net/c10_rough` 12/12, `net/net_predict`, `browser/col_*_lag150`, the lag film | **Met** (on-screen overlap while both run with lag: below) |
| R01 a reset mid-death: everything of the old world ends on every screen | `browser/reset_death` 10/10, `proto/world_msgs`, HQ1's `light_lifecycle` (its check 4 now passes); mutation `r01_replays_live_on` caught | **Met** |
| R02 a reset mid-blast | `browser/reset_boom` 10/10, `proto` `nr_boom_reset` | **Met** |
| R03 late join, delayed old messages, the Death Lab paused or slowed; the next death as HQ1 accepted it | `browser/reset_*` (late joiner, injected old messages; mutation `r03_no_old_filter` caught), H2-6 `browser/life_lab` | **Met** |
| R04 a reset, END, RESPAWN: no personal blast, sound or cooldown | `proto/nr_all` (`nr_elig`), `proto/world_msgs`, `browser/reset_*`, H2-6 `browser/life_lab` | **Met** |

### H2-6: the last cases

H2-5 had measured every gate but four details of the matrix on real pages. H2-6 measures them (`dev/stage-3d-hq2/evidence/h2-6/`).

**E03 on a blast (`browser/life_light`).** During the dropped light's 6.7 s hold, counted from the blast:
- Bob's connection is dropped at +2.3 s; the game reconnects him by itself and he is back in at +5.6 s;
- his window loses focus, is hidden and resized at +2.9 s;
- Carol's page is reloaded at +5.9 s. It is back in at +29 s; a reload takes that long on these pages.

The results:
- no page's light anchor moved later; the three final anchors are within 51 ms (gate 150 ms);
- full power in the hold and nothing lit after the end, on each page;
- Bob heard the blast once, and it was not replayed after his reconnect;
- Carol's reloaded page heard nothing and shows the one corpse and its wall stain.

**R03 with the Death Lab (`browser/life_lab`).** Bob's Death Lab is paused and Carol's at 0.25×. A world reset comes 3 s into a Hound C wall death.
- From the moment each page takes in the reset, nothing of the old death is on any screen; nor after the clocks are restored.
- The next death, in the new world, plays everywhere and leaves one corpse and its stain. Its light holds and fails as HQ1 accepted, the anchors within 150 ms.

**E06 at every render rate (`unit/boom_fps`)**, with its mutation.

The exact numbers are in `evidence/h2-6/final_tests.txt`. The harness's own first runs are in `evidence/h2-6/attempts/` with their reasons.

## Tests and exceptions

`dev/stage-3d-hq2/summary_hq2.py` puts every step of the final regression (H2-5 and H2-6) in its class and checks it: `evidence/h2-6/final_tests.txt`, `final_tests.json`. A step run again counts by its last run; every earlier run is kept in `attempts/` with its reason. Every step is as its class requires.

**Gates: every one passes.** The counts:
- HQ2's own tests: `peers_unit` 6/6, `predict_unit` 6/6, `nr_all` 43/43, `col_all` 48/48, `world_msgs` 8/8, `h25` 36/36, `net_predict` 26/26, `c10_rough` 12/12, `old_fixtures` 6/6, `f13_hq2` 6/6.
- In real pages: `col_*` 5/5 ×4, `reset_*` 10/10 ×2, `boom_*` 7/7 ×4, `nr_e02`, `e09` 6/6, `multi8` 10/10, `life_light` 5/5, `life_lab` 8/8.
- Also: `death_equiv`, `boom_geo`, `boom_fps`, `static_hq2`.
- Goldens and the contract:
  - `golden_hq2` gives 7 of 11 scenarios identical and 4 that differ by documented HQ2 changes; its A/A gives 11/11;
  - `cli_golden_hq2` 9/9;
  - `contract_hq2` finds 0 violations in 13,578 server messages.
- HQ1's lighting and blood battery: `light_power` 8/8, `light_net` 8/8, wall faces, stain metric, rebuild, lifecycle, timelines, and `light_lifecycle` with its check 4.
- The rest: BR-RoLE 32/32, camera fairness 12/12, the theme files, QA2's probes b1–b3, parity, sound, corpse checks, the films, every performance gate.

**Must fail, and do:**
- **Before the fix.** H2-5's two repairs, measured on H2-4's commit: `fx_wall` 1/3, the contract on the H2-4 wire, `parity_judge` on Hound C, `c10_rough` 10/12.
- **Mutations.** Each is a deliberate break on a copy of the final tree, and each fails its test:
  - E02: no cooldown; the client first;
  - E01: approved but still in the world;
  - C08: no collision; end point only; creep; a straight-line route hop;
  - C09: no prediction;
  - R01: old replays live on;
  - R03: no old-message filter;
  - E06 (H2-6): the physics capped per frame.

**Older suites with known failures.** The names that fail are exactly the inherited ones plus HQ2's documented protocol deltas, nothing more:

| Suite | HQ2 | Failing names | Inherited (the same on HQ1) | HQ2 delta, and what replaces it |
|---|---|---|---|---|
| `npm test` | 149/162 | 13 | P01, P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18, 2F F22 (HQ1 151/162) | L9 (the vanish sequence) → `nr_all`, `browser/nr_e02`; 2F F13 (calls the removed `sim.vanish`) → `f13_hq2` 6/6 |
| `audit_net` | 13/17 | 4 | D3 | A1, M4, R2 (a body on their admin's spot) → `old_fixtures` |
| `audit_net2` | 8/11 (twice) | 3 | DD2 (HQ1 10/11) | LC4 (vanish) → `nr_all`; MT1 (a body on the spot) → `old_fixtures` |
| `s_audit` | 8/9 | 1 | — (HQ1 9/9) | L9 → `nr_all`, `browser/nr_e02` |
| `death_net` | 15/16 | 1 | — (HQ1 16/16) | N9 (the client's `b:Vanish`) → `nr_all` (`nr_elig`) |
| `live` | 14/17 | 3 | L5d, L5e, L5f (HQ1-3's record) | — |
| `test_shadows` | 43/48 | 5 | S06, S16, V08, X01, X02 | — |
| `s_humanqa_hotfix` | 5/6 | 1 | HQA X03 | — |
| 3D's `golden3d`, `cli_golden3d`, `contract_check3d` | refuse or fail | | | HQ2's server queries the level, has new globals and new fields → `golden_hq2`, `cli_golden_hq2`, `contract_hq2` |

`audit_net2`'s first run also failed LC1 once. A real hound killed the held client mid-sequence, and a join from death is allowed. LC1 passed in two more runs on HQ2 and one on HQ1.

**Two regressions H2-5 found in HQ2's own earlier checkpoints, and repaired** (`STAGE_3D_HQ2_REGRESSION.md` section 1):
- **A death replay's wall.** From H2-2 the server overwrote a death replay's `w`, the Hound C wall, with the world's number. Spectators' Hound C replays lost their wall: the light came to rest 17 px from the corpse, and one blood mark was missing. On an `fx` the world's number is now `wn`.
- **The soft-correction blend.** H2-4 blended soft corrections only up to 96 px. With 200–300 ms each way, two runners' corrections of 130–185 px snapped. Every soft correction is now blended (up to 600 px).

## Performance

`STAGE_3D_HQ2_PERFORMANCE.md`. Every gate was fixed at H2-0 from an A/A run, and every one is met. HQ2 was measured against HQ1, interleaved, in the same session:

| | Gate | HQ2 |
|---|---|---|
| Browser frame time, idle and death windows (4 pairs, mean change) | median ≤ +7–15 %, p95 ≤ +10–20 % | −3.5 % to +7.4 % |
| Twenty corpses | ≤ +10 % | −3.3 % to −8.0 % |
| The blast's window against a Hound C death's | ≤ 1.10× | 0.77× / 0.78× |
| Two players in contact against idle | ≤ 1.07× | 0.82× / 0.83× |
| Server CPU, 8 players spread / crowding one point | ≤ +10 % / ≤ +15 % | +4.9 % / +8.5 % |
| Server step mean, spread / crowd | ≤ +13.3 % / ≤ +15 % | +5.3 % / +0.6 % |
| Admin ping p99 | ≤ +5 ms | +0.67 / +0.33 ms |
| The peer sweep, seven peers, p99 | ≤ 5 µs | ≤ 2.49 µs |
| Network, 8 players | ≤ +3 % | +0.48 % |
| Server heap per NEW RUN (forced GC) | ≤ 0.01 MB | 0.0065 MB |

**The limits of these numbers:**
- All browser numbers are SwiftShader on two CPU cores, two to eight pages at once: paired comparisons on one machine. They say nothing about a GPU or a real low-end laptop.
- No FPS is claimed for any device. The Potato and performance presets are after full Stage 3H, as planned.
- Single windows swing ±40 % between identical builds; the gates use the mean of interleaved pairs.
- HQ1's four performance exceptions are reported again: D0's absolute frame limits, the soaks' RSS, the no-GC peak, and D7's Hound A spectator note.
- The 16-death browser soak's server RSS slope was higher for HQ2 (5.7 against 2.5 MB per death) while the forced-GC heap stayed level (0.0072 against 0.0060 MB per death). It is recorded, not explained away.

## Visual evidence

Real pages, SwiftShader. Every frame carries the build hash `b178b5d9fbe7`, the page's own frame time and the clock.

- **`dev/stage-3d-hq2/evidence/h2-5/video/main/film.mp4`** (137 s): Alice, Bob and Carol side by side.
  1. The narrow-hall stand-off: Alice walks into Bob, who stands still, and stops.
  2. Bob steps aside and she squeezes past.
  3. NEW RUN: the blast, watched by Bob.
  4. Carol opens the game after it: a late joiner sees the corpse and its light.
  5. SPAWN.

  The stills `still_1…5_*.png` are the same moments.
- **`video/lag/film.mp4`** (83 s): Alice through 150 ms each way, and Bob.
  - the wide-hall side-pass;
  - both sprinting at each other: lag recovery;
  - backing away.
- **`paired/`**: the same five scenes on HQ1 and on HQ2, plus the A/A.
- **`film/`**: the eight deaths' contact sheets on HQ2.
- **`browser/shots_*`**:
  - the blast with each light;
  - the world resets;
  - the crowd of eight;
  - H2-6's lifecycle screenshots.

## Known limitations and residual issues (judge them)

1. **Bodies overlap on screen for a moment with lag** (C10). Each page draws the others where their last snapshot put them. While two players run at each other, their bodies can overlap on one screen:
   - none to 0.07 s with no lag;
   - about 0.2 s at 60 ms each way;
   - about 0.5 s at 150 ms each way.

   The server never lets them overlap, and soft corrections bring both screens back within 0.3–0.6 s.
2. **Pushing into each other with lag.** The lagged page gets a small blended correction about every 0.3 s while both hold their keys (the lag film: 10 for Alice), and none once either lets go.
3. **The silent band.** Within 2 px of the server a page is left alone, so two standing bodies can rest up to about 2–3 px into each other on one screen. Never on the server.
4. **A reconnect or reload is a new player** (there are no accounts). Its NEW RUN cooldown is fresh. An approval the old connection never received still stands.
5. **A lone player's corpse.** After a lone player's NEW RUN, SPAWN enters an empty room. The game's existing rule then starts a new world, so the blast's corpse is not there in the new run. With anyone else in a run, it stays.
6. **A held player is not solid.** Someone can walk through a player a monster is holding, so that the drag is never blocked. Corpses and dead players are never solid (as specified).
7. **A crowded spawn.** If no spot within 220 px is free, a spawn falls back to its own spot, and the overlap rule lets the players walk apart.
8. **No reduced-motion setting** in the game. E09 shows the blast adds no camera motion for anyone.
9. **The offline NEW RUN** (no server) keeps the old local fade. Nobody else is involved.
10. **`gore.js`'s reason differs from the allowlist's** (above).
11. **The secret scan** flags nine bytes inside `video/main/film.mp4`'s compressed picture data as an e-mail address. They are not one (`evidence/h2-5/secret_scan_finding.txt`, hex only). Every other check found nothing.
12. **The host's admin passcode issue** is yours to handle and is out of scope. Every test here used a synthetic passcode, and none is in the evidence.
13. **Dead code.** `mp.js` still has its drawing branch for a remote `vanish` replay. The server never sends one now, so it is unreachable; it was left to keep the change narrow.

## Reproducer

The package is the repository at the final commit. In its folder (Node 18 or later; Python 3 with Playwright and the Chromium it finds, for the browser tools):

```
ADMIN_PASSCODE=<your own passcode> node server.js 8000          # the game; open http://localhost:8000

# the evidence tools (each starts its own server with a synthetic test passcode)
node dev/stage-3d-hq2/peers_unit.js --game . --out peers.json                                    # the collision rule
node dev/stage-3d-hq2/proto_lab.js --game . --scenario nr_flow,nr_e02,nr_boom --out nr.json      # NEW RUN on the wire
node dev/stage-3d-hq2/proto_lab.js --game . --scenario col_head,col_wide,col_crowd,col_bypass --out col.json
node dev/stage-3d-hq2/net_predict.js --game . --scenario c10_rough --out c10.json                # lag
node dev/stage-3d-hq2/boom_fps.js --game . --out fps.json                                        # E06 at every frame rate
python3 dev/stage-3d-hq2/boom_browser.py --game . --out boom.json --kind flashlight             # the blast on three pages
python3 dev/stage-3d-hq2/reset_epoch.py --game . --case death --out reset.json                   # R01-R04
python3 dev/stage-3d-hq2/life_hq2.py --game . --case light --out life.json                       # E03 on a blast
python3 dev/stage-3d-hq2/col_browser.py --game . --case head --out col_head.json                 # C01 by keyboard
python3 -I dev/stage-3d-hq2/summary_hq2.py                                                       # every test's result, from the evidence
```

`dev/stage-3d-hq2/README.md` lists every tool. The full runs are `evidence/h2-5/steps.txt` and `evidence/h2-6/steps.txt`.
