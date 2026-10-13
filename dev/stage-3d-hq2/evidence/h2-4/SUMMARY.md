# H2-4: the browser predicts the other players; the world epoch

The rules as built are in two documents:
- `STAGE_3D_HQ2_PLAYER_COLLISION.md`, section H2-4: prediction and soft corrections;
- `STAGE_3D_HQ2_NEW_RUN_AUTHORITY.md`, section H2-4: the world reset.

## What changed

| File | Change |
|---|---|
| `move.js` | `peerProject`: before the walls' push-out, the step loses the part into a living player (36.75 px), keeps the part along him; the crowd's corners are cut back to the last free point. `peerOnPath`: a vault does not start with a player on its landing or in the way. Untouched with nobody there |
| `mp.js` | `window.__peerBodies`: the solid others' latest server positions, from every snapshot (alive, not held by any entity's `cp`; empty while we are not solid ourselves).<br>A soft correction (`tp pc:1`, ≤ 96 px) is blended over 120 ms.<br>`worldNew`: on `world` (or a snapshot of a newer world) every replay ends, our own death ends where the server put us (`__api.worldEnd`), our old local corpse goes, the stains and dying lights go at once.<br>`oldWorld`: a `fx`, `bodies` or `mk` naming an older world is dropped |
| `server.js` | `worldReset`: `{t:'world', w, x?, y?}` to every connection, then `fx end` for each dropped death or blast; `bodies` carries `w` |
| `assets/index-DKbV5Nv9.js` (`apply_bundle.py`, two exact-text edits) | `__api.worldEnd(x, y)` → `Xwr`: the respawn's own clean-up at the server's spot, with no new spawn point, no `respawn` or `join` sent, and our old local corpse removed |
| `gore.js` | `wallStains.clear()`, beside the HQ1 stain sync: an old world's stains go at once instead of after the sync's half-second grace |

## Results

### The prediction, headless (`unit/predict_unit`): 6/6

The real `move.js`, loaded as `dev/move_model.js` loads it.

- **P1, solo unchanged:** with no other player (no list, or an empty one), seven scripts (stand, walk, sprint, crouch-walk, a vault, a crawl through a wall hole, sprint + slide) are identical to HQ1's `move.js` at every tick: 3,360 ticks, number for number.
- **P2, frame rate:** sprinting into a standing player at 30, 60, 120, 144, 240 and 360 FPS, and on a jittered schedule, gives the same 240-tick trace. Closest 36.75 px, stopped at 36.75.
- **P3, the server agrees:** every position a page would send (20 Hz, whole px) is a free move under `server/peers.js`, in all five cases: head-on, past his shoulder, round him on open floor, dead centre, into a crowd of five. That is 0 of 395 packets corrected.
- **P4, the slide:**
  - 12 px off his line, she gets past, at least 36.76 px from him and at most 36.8 px off her line.
  - Dead centre, she stops at 36.75 px and is never pushed sideways.
  - A sprint-slide into him dies at contact.
  - A crowd of five: never closer than 36.75 px to any of them.
- **P5, the vault:**
  - With nobody there, she vaults the counter.
  - With a player on the landing, the vault does not start; she stays on her side, 85 px from him.
  - With a player beside the run-up, she still vaults.

`peers_unit` 6/6 again.

### Pages that predict, on a real server, with lag (`net/net_predict`): 26/26

Each "page" here is the real `move.js` plus mp.js's handling of the wire; lag is applied each way.

| Case | Lag each way | Result |
|---|---|---|
| C09 head-on into a standing player | 0, 60, 150 ms | Stopped at contact on the server and on her own page (36.8 px on her screen). **No correction at all.** He is never moved |
| C09 he stands 30 px aside | 0, 150 ms | She slides past his shoulder and on, never closer than D, with no correction |
| C10 two players sprinting at each other | 0, 60, 150 ms | The server never lets them closer than 36, and in every snapshot neither is past the other.<br>Soft corrections only: 0 + 2, 1 + 1 and 3 + 3, at least 306 ms apart.<br>Once they stand, each page is where the server has it |
| C04/C10 eight pages (a full room) walk into one point and back out | 40 ms | Never two closer than D (282 snapshots). All pack within 47.5 px of the point and walk home. Corrections soft only (1–2 each) |

On the C10 pages' own screens, while both run, the other is drawn where the last snapshot put him. So they overlap for a moment:

| Lag each way | Time closer than 30 px | Closest on screen | One past the other? |
|---|---|---|---|
| 0 ms | ≤ 74 ms | 23.4 px | no |
| 60 ms | 154–187 ms | 7.8 px | no |
| 150 ms | 245–495 ms | 0.8 px | yes, for a moment |

The server never lets it happen, and once they stand each screen shows them apart (36 px, or within D3's silent 2 px of it). This is a property of drawing others from snapshots, recorded for human QA.

### Real browsers, by keyboard (`browser/col_*`; SwiftShader): 20/20

| Run | Server minimum | Alice's own screen | Corrections | Result |
|---|---|---|---|---|
| `col_head` | 37.0 | 36.7 | none | stops at x 975.3, the server has 975; he is never moved |
| `col_aside` | 37.1 | 46.5 | none | slides past to x 1456 |
| `col_head_lag150`: Alice through `lag_proxy.js`, 150 ms each way | 37.0 | 36.7 | none | the same |
| `col_aside_lag150` | 38.8 | 42.3 | none | the same |

H2-3's `col_pass` (no prediction yet) had her page run 50 px past Bob's centre and jump about. Screenshots: `shots_col_head/`, `shots_col_aside/`, `shots_col_head_lag150/`.

### The world epoch

**On the wire (`proto/world_msgs`): 8/8.** A reset while Vic's death plays, Alice alive and Menu in the menu:
- every connection gets exactly one `world`, the next number;
- Alice and Vic get `x, y` equal to their `tp`; Menu gets none;
- then the death's `end`;
- Vic is alive on his spot;
- nothing afterwards names the old world: the corpse list says `w` 3, with no corpse of his;
- a connection opened afterwards hears nothing of it;
- no NEW RUN answer, no blast.

**Four real pages (`browser/reset_death` R01, `browser/reset_boom` R02): 10/10 each.**

In R01 Alice dies a Hound C wall death with her flashlight on; in R02 she presses NEW RUN. Bob and Carol watch, and the reset comes 2.2 s and 2.0 s in.

- **The server:** one `world` (the next number), then the event's `end`; nothing after names the old world.
- **Each page took in the reset** when its main thread got to the message:

  | Run | Alice | Bob | Carol |
  |---|---|---|---|
  | R01 | 0.06 s | 1.15 s | 0.90 s |
  | R02 | 0.87 s | 1.58 s | 1.30 s |

  These four SwiftShader pages draw about one frame a second under load.
- **From then on, in every row:** no replay, no wall stain, no corpse, no dying light of the old event (111–134 rows a page); Alice not caught and not dying.
- **R01:** Alice is back in the world at the server's spot, alive and playing, and her page sent no `respawn` or `join`.
- **R02:** Alice stays in her run menu through the reset, and SPAWN then starts her new run.
- **Everyone brought back** stands on a spot of their own, 44 px apart.
- **R03, late joiner:** Dave, who opens the game 3.2 s after the reset, sees none of it (22 and 23 rows).
- **R03, delayed old messages:** the event's own replay message again, and a corpse list of the old world with a complete corpse record made by `death_srv`, handed to Bob's page after the reset. Both are dropped (`oldDropped` +2); nothing appears in 87–99 rows.
- **R04:** after the `world` message no page gets an `nra` or a blast, and the server sends no blast.

**HQ1's light lifecycle (`existing/light_lifecycle`):** every check passes (HQ1's own tool, unchanged). That includes check 4: a world reset during the dying light's hold, with no dead light on the other screens afterwards. Check 4 was the inherited HQ1 exception (H2-0's RED R-C) and is now repaired.

### Regression

- **H2-3's collision suite (`proto/col_all`):** 48/48.
- **H2-1/H2-2 (`proto/nr_all`):** 43/43, after one check of H2-1's own was updated (see Attempts).
- **The blast in a real browser (`browser/boom_flashlight`):** 7/7, with every replay frame equal to the server's run of the blast.
- **E02 in a real browser (`browser/nr_e02`):** 7/7.
- `old_fixtures` 6/6.
- **`s_fps_equality`** (dev/tests, `move.js` at every frame rate): passes.
- **The older suites that run the real server:** the same as at H2-3.
  - `s_audit` L9 and `death_net` N9: H2-1's deltas.
  - `audit_net` A1, M4, R2 and `audit_net2` MT1: H2-3's fixture deltas, replaced by `old_fixtures`.
  - `audit_net` D3 and `audit_net2` DD2: as on HQ1.
  - `audit_net2` LC4: H2-1's delta.
  - `light_net` 8/8.

### Mutations (`mutation/`): each one caught

| Mutation | Effect | What fails |
|---|---|---|
| `c09_no_predict` | `move.js` ignores the other players | `predict_unit` P2–P4. In the real browser, `col_browser --case head` 3/5: her own screen 4.5 px from him, 1068 px max x (through him), soft corrections every ~0.3 s |
| `r01_replays_live_on` | the page keeps the old replays at a reset | `reset_epoch` 9/10: Bob's screen still shows the old death 0.5 s after taking in the reset, until the server's `end` reaches the next frame |
| `r03_no_old_filter` | the page takes messages of any world | `reset_epoch` 8/10: the delayed replay plays again on Bob's screen, a corpse that is not in this world appears (the "ghost"), and its dying light is lit |

## Attempts kept (`attempts/`)

- **`proto_nr_elig_r04_counted_the_end_message/`:** H2-1's `nr_elig` R04 check counted any `fx` after the reset as an explosion. In that scenario, a blast from the scenario's own approval is still playing at the reset, and H2-4 now ends it with an `fx end`. The check now excludes `k:'end'`, and the suite was run again (43/43).
- **`predict_unit_crowd_wedge/`:** the first prediction, three passes over the peers, left a mover wedged between bodies 34 px from one of them, in a crowd of five; 67 of 79 packets were not free on the server. The step is now cut back to its last free point when the passes leave it inside someone.
- **`net_predict_first_checks/`:** two problems in the harness's own first checks.
  - **The fixture:** a spawn spot needs 20 px from the walls, so Bob could not spawn at the corridor's edge. He now steps there after joining.
  - **The first C10 checks:** they compared two pages' own beliefs, not what either player sees, and gated on-screen overlap that drawing from snapshots makes unavoidable; that overlap is now measured and reported.
- **`reset_epoch_first_runs/`:** three first runs of the new R01/R02 harness.
  - **The stains:** an old world's wall stains lingered for the stain sync's half-second grace (hence `wallStains.clear()`).
  - **The timeline:** the late joiner's slow page load stalled the harness's timeline, so it now comes last.
  - **The setup and R04 checks:** they read page timestamps rather than message order. A slow page handles a message seconds after it arrives.

`steps.txt` lists every step with its exit code and time, the rerun included.
