# Stage 3D: Gore & Death 2.0, report

**Branch** `stage-3d`, a straight line from the accepted parent `stage-3h0` 06949a8 (tree 5adf3f3). Normal pushes only; no other branch touched, nothing merged. The human-QA package and its receipt verify the final commit from the ZIP itself.

## What 3D delivers

The eight deaths are the same eight:
- **Hound A–D, Smiler A–D**, chosen by the same server rules;
- the same knock and drag limits, blows, lengths and blackouts;
- one round body and two round hands.

What changed is everything around them.

1. **The death is physical to its end.** A body at rest stays at rest; nothing creeps, slides or trembles after it settles. The hound's jaw lets go as it eases off. In 690 runs on the real map every death is asleep by its end and nothing moves after; at the parent 265 never settled and 394 moved again. (`STAGE_3D_VARIANT_MATRIX.md`)
2. **Blood follows the geometry and the motion.**
   - Pools stop at walls and pillars, and spatter lands only on floor: 0 drawn points on anything solid, against 4,568 at the parent.
   - Blood lands where the jaws were at each blow.
   - Every variant leaves a mark on the wall where its body really struck.
   - A corpse starts as the death's last frame and dries over the next half minute.
3. **The server decides the death and finishes it.** One event per death:
   - the server gives it an id and sends everyone the replay itself;
   - the victim starts from the server's own kill record;
   - the server makes the corpse from the same physical run when the death ends.

   Victim, spectators and the corpse agree within a pixel; at the parent the dropped light was up to 34 px off. Clients can no longer report a death or a death's corpse; the one record a client still sends, the light a NEW RUN leaves where you stood, is checked against the server's own state (below). Disconnects, late joiners, early respawns, admin revives and world resets each do the right thing. (`STAGE_3D_DEATH_AUTHORITY_AND_PROTOCOL.md`)
4. **Spectators see and hear it.**
   - The victim's light tumbles and lands on every screen.
   - The death sound's blows fall when the physics' blows fall.
   - The wall impact, the light and the hat have their own sounds, placed where they happen.
   - Reduced motion quarters the death's camera shake.
5. **It got cheaper where it was expensive.**
   - 20 corpses on screen went from about 2.1 s to 0.7 s per software-rendered frame (same session), about what an empty hall costs.
   - The server's corpse simulation costs about half the parent's (sum of the eight variants' medians 64.5 ms against 136.8, same session), once per death, spread over the death's ticks: no tick takes more than 2.8 ms of it.
   - Every window is within the thresholds fixed at D0.
   - One exception to the stricter line D6 set for itself (within +10 % of the parent, interleaved in the same session): the Hound A death costs 8–11 % more per frame on this software renderer (+10.9 % for the spectator). Idle and Hound C are within the line. The Hound A cost is reported, not passed; its cause was not isolated. (`STAGE_3D_PERFORMANCE.md`)

## What stayed exactly as it was

All of the following are byte-identical to the parent:
- `index.html`, so the classic-script boot contract and load order are unchanged, and 3D adds no new script;
- the AI (`ai.js`), movement (`move.js`), collision and the level (`world.js`), lighting and BR-RoLE, the camera policy, the menu, the HUD and the theme files;
- 3H0's extracted modules (`server/ws.js`, `server/fields.js`, `server/static.js`, `assets/net-interp.js`), except `assets/net-wire.js`, which gains one optional field;
- the deployment.

The bundle carries six small exact-text hooks, rebuilt from the parent's own bundle by `dev/stage-3d/apply_bundle.py` and checked from the ZIP. Non-death output is identical in the server and client golden traces, with one follow-on, documented. (`STAGE_3D_REGRESSION_AND_EQUIVALENCE.md`)

## Checkpoints

| | Commit | Tree | What |
|---|---|---|---|
| D0 | f22b207 | ae8e129 | audit, freeze, baselines, thresholds (`STAGE_3D_D0_AUDIT.md`) |
| D1 | bbf3e88 | 6cd0c88 | physical body and hands; the server's corpse simulation about 2× faster |
| D2 | efb81ec | eed7545 | blood, wall marks, floor-only spatter |
| D3 | 56f87d4 | 2ecc02b | settled and drying corpses, lights, culling, caching |
| D4 | ee5b8e6 | 897b7c4 | the server owns each death |
| D5 | 6bc27a9 | 47cdd0e | death-only sound, spectator sound, reduced motion |
| D6 | (see below) | | full regression and performance; two performance corrections, then an independent review's corrections and the whole D6 again (`evidence/d6/corrections.md`) |
| D7 | (see below) | | the package, its receipt, this report |

Each checkpoint:
1. ran its focused tests first and kept failing first runs;
2. was committed and pushed normally;
3. was verified on GitHub: commit, tree, parent, and that no other branch moved (`dev/stage-3d/verify_remote_3d.py`).

## Evidence

`dev/stage-3d/evidence/d0` … `d7`. Each folder has a `SUMMARY.md` or `steps.txt`, and D6 has `summary.json`: every line of the final regression next to its comparison, gated, with the one line over D6's own A/B line listed under `over`.

| Kind | Where |
|---|---|
| Before and after contact sheets, victim and spectator | `d6/film/sheet_*.jpg` (parent and 3D block by block, every frame labelled); `d6/film_xray/`; `d1`, `d2`, `d4/film/` |
| The hand-over from death to corpse, and drying | `d6/corpse_*/handover*.jpg`; late joiners: `late_joiner_*.jpg` |
| Disconnect and late join; packets and bytes | `d4/death_net_d4.json`, `d6/death_net_d6.json`: N3, N4, N5, N10, N11 |
| Equipment and light | `phys_matrix` (gear never in a wall), `parity3d` (light within a pixel), `sound_check` (light sounds), `corpse_check` |
| Geometric collision of blood | `d2`/`d6/gore_geo_*.json` |
| Failures kept | `d1` (parity path, golden classification), `d4` (golden follow-on, test fixes), `d6/perf_death_d6_attempt1.json`, `d6/perf_ab/attempt1/`, `d6/corrections.md`, and the five superseded older checks' logs |

## Limits and open points

- **Performance figures are software rendering.** No real GPU or phone was measured.
- **The Hound A death is 8–11 % slower per frame than at the parent** on the software renderer (victim +8.5 %, spectator +10.9 %, interleaved). That is within D0's thresholds and over D6's own stricter line for the spectator. Watch for a hitch in human QA.
- **The server keeps more resident memory.** It runs a physical death for every death. Its JS heap shows no leak (about 8 MB after each full collection, as at the parent). Its resident memory rose in steps to about 200 MB in a 32-death run with two browsers and then stayed level; the parent's reached 136 MB.
- **Reconnecting is a new player.** A player who reconnects is a new player id: the earlier corpse stays under the old id until it ages out or the world resets.
- **The Death Lab clock is local.** A slowed or stepped Death Lab death plays slowly only on that screen; the server makes the corpse on its own clock.
- **The NEW RUN light record is still not tied to the vanish.** The record left by a NEW RUN is now checked (alive, own position, once per 5 s) and its light, gear and look come from the server's state, not the message. It is not tied to the vanish itself: doing that would change what a player sees in the known 30 s NEW RUN cooldown mismatch, which is left for later, as is the NEW RUN self-destruct idea.
- **The server golden check has one bound.** In the 3H0 scenario `deaths`, the hound is handed back at the death's end instead of 8 s later, and goes on to kill again; after that hand-back the two worlds legitimately differ, so that scenario is compared only up to it. Every other scenario is compared whole.
- **A custom death sample would not be muffled behind walls.** The game ships none (the death sound is procedural); noted for when one is added.
- **Security.** The default admin passcode finding predates 3D, is outside its scope and is unchanged. Neither tests nor evidence use it; they use a synthetic passcode. 3D closes the death-protocol trust gaps the audit found: forged, repeated or far-away corpses, and replays from any client. No new blocking vulnerability was found.

## Human QA

`STAGE_3D_HUMAN_QA.md` lists every check with what you should see. The admin Death Lab plays any of the eight on yourself through the real path; there is no unauthenticated control. Only the user can say **HUMAN QA PASSED**.
