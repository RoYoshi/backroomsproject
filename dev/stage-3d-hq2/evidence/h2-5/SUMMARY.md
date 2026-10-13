# H2-5: the full regression against HQ1, the performance gates, the films

The full account is in three documents:
- `STAGE_3D_HQ2_REGRESSION.md`: every suite, HQ1 against HQ2, the expected deltas and their replacements, the mutations, what was run again;
- `STAGE_3D_HQ2_PERFORMANCE.md`: every gate and its measurement;
- the H2-5 sections of `STAGE_3D_HQ2_NEW_RUN_AUTHORITY.md` and `STAGE_3D_HQ2_PLAYER_COLLISION.md`.

This summary is the map of this folder.

## Two repairs (production changes in H2-5)

| File | Change |
|---|---|
| `server.js` | An `fx` names its world in `wn` (the death replay in `aftStart`, the blast in `boomStart`, a world reset's `end`). An `fx`'s `w` is the Hound C wall again, as in HQ1. From H2-2 to H2-4 it held the world's number, and spectators' Hound C replays lost their wall |
| `mp.js` | `oldWorld(m.wn)` for `fx`.<br>`softTp` blends every soft correction up to 600 px, as D3 says. H2-4 snapped anything above 96 px, which a 200–300 ms link reaches |

Each was measured failing on H2-4's commit, with the same tools that pass now (`before_fix/`):
- `fx_wall_h24` 1/3;
- `contract_raw_h24` violations;
- `parity_judge_h24` Hound C fails;
- `c10_rough_h24` 10/12.

## Folders

| Folder | What | Result |
|---|---|---|
| `before_fix/` | the two repairs measured on H2-4's commit `99e1593` | each fails, as expected |
| `unit/` | `peers_unit` 6/6, `predict_unit` 6/6 | pass |
| `proto/` | `nr_all` 43/43, `col_all` 48/48, `world_msgs` 8/8, `h25` 36/36 (E04, E05, four at once, abuse, C09 chase, the wall) | pass |
| `net/` | `net_predict` 26/26, `c10_rough` 12/12 | pass |
| `browser/` | `col_*` 5/5 ×4, `reset_death` / `reset_boom` 10/10, `boom_*` 7/7 ×4, `nr_e02` 7/7, `e09` 6/6, `multi8` (second pass) | pass |
| `mutation/` | all ten mutations of H2-1 to H2-4, on a copy of the final tree | every one caught |
| `golden/` | `golden_hq2` (7 identical, 4 documented), its A/A 11/11, `cli_golden_hq2` 9/9, `contract_hq2` 0 violations, `static_check`; and 3D's own three tools on HQ2 (they refuse or fail, as documented) | pass |
| `hq1/`, `existing/`, `qa2/`, top level | HQ1-3's battery, re-based on HQ1 | as HQ1, apart from the documented deltas (`STAGE_3D_HQ2_REGRESSION.md` sections 3 and 4) |
| `perf/`, `soak/` | browser A/B, the new windows, server A/B, network, death cost, memory | every H2-0 gate met |
| `paired/` | `paired_shots.py`: five scenes, HQ1 against HQ2 against HQ2 again | all five within the A/A |
| `film/` | `film_3d.py`: the eight deaths, contact sheets | all eight, seen by the spectator |
| `video/main`, `video/lag` | the two HQ2 films (`film.mp4`), stills, timelines | see below |
| `attempts/` | every first run that was run again, and why | `STAGE_3D_HQ2_REGRESSION.md` section 6 |

## The films

`video/main/film.mp4` shows Alice, Bob and Carol side by side, 137 s, aligned on the wall clock:
1. the narrow-hall stand-off;
2. Bob steps aside and Alice squeezes past;
3. NEW RUN: the blast, watched by Bob;
4. Carol opens the game after it: a late joiner sees the corpse and its light;
5. Alice presses SPAWN.

`video/lag/film.mp4` shows Alice (through 150 ms each way) and Bob, 83 s: the wide-hall side-pass, the two sprinting at each other, and backing away.

Every frame carries the build hash `b178b5d9fbe7`, the page's own frame time and the clock. The stills are the same moments as PNG files.

## Steps

`steps.txt` lists every step with its exit code and time, including the second pass after the first. A non-zero exit there is one of:
- an expected failure (`before_fix/*`, `mutation/*`);
- a documented delta (`existing/s_audit`, `death_net`, `existing/npm_test`, `audit_net*`, `live`, `test_shadows`, `humanqa_hotfix`; `golden/golden3d_refuses`, `cli_golden3d_on_hq2`, `contract3d_on_hq2`);
- a first run kept in `attempts/`.

`working_tree_during_run.txt`, `working_tree_after_run.txt` and `working_tree_after_rerun.txt` record the tree.

**After the runs.** One tool changed after its run: the header comment of `nr_soak.js`. It claimed a per-player collision-state check the tool does not make. The comment now says so; the tool's code is unchanged. Every other tool here is committed as it ran: each one changed during H2-5 was run again afterwards (`steps.txt`, the second and third passes).

## Scope and secrets

**Scope** (`scope_h2-5.json`). Against the H2-0 allowlist, nothing is forbidden. Every production file changed since HQ1 is one H2-0 allowed:
- `server.js`, `sim.js`, `death_srv.js`, `dphys.js`, `mp.js`, `move.js`, `gore.js`, `ents.js`, the bundle;
- new: `server/peers.js`.

**Secret scan** (`secret_scan.json`, `dev/stage-3d/secret_scan_3d.py` with the owner's address as an extra string). One finding: the "e-mail address" pattern matched nine bytes inside `video/main/film.mp4`.

`secret_scan_finding.txt` shows where. They lie in the file's `mdat` box: the compressed H.264 frames, picture data that happens to read like an address. Every other check, the owner's address included, found nothing. The scanner reads every file as text; the one film of H2-4 happened to have no such match.
