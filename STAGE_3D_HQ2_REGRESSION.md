# Stage 3D HQ2 — regression against HQ1 (H2-5)

H2-5 ran everything HQ1's own checkpoint ran (the HQ1-3 battery), HQ2's own suites, the goldens and the protocol contract, and every mutation again.
- **The tree:** the final tree, after the two repairs below.
- **Compared against:** an export of the accepted parent, HQ1 `ebb3bd6`, in the same session on the same machine.
- **Where the older tools are unchanged:** each run is against HQ1 directly, or against HQ1's own recorded numbers.

Evidence: `dev/stage-3d-hq2/evidence/h2-5/`.
- `steps.txt` lists every step, its exit code and its time, including the second pass.
- `attempts/` keeps every first run that was run again, with the reason.

SwiftShader software rendering throughout. Browser numbers compare runs on this machine only and are never quoted as GPU figures.

## 1. Two regressions H2-5 found, and their repairs

Both are HQ2's own: introduced in HQ2's earlier checkpoints, not inherited from HQ1. Both were measured failing before the repair, with the same tools that pass after it.
- **Before:** H2-4's commit `99e1593`, exported (`evidence/h2-5/before_fix/`).
- **After:** the final tree.

| | A death replay's wall (`fx.w`) | Soft corrections above 96 px |
|---|---|---|
| Since | H2-2 (`14cf47a`) | H2-4 (`99e1593`) |
| What was wrong | The server wrote the world's number into a death replay's `w`, which is the Hound C wall (`[x, y, angle]`, else `0`; in 3H0's contract since before HQ2). Spectators' Hound C replays ran without their wall | D3 says a soft correction is blended, not snapped. H2-4 blended only those within 96 px. With 200–300 ms each way, two runners' corrections reach about 130–185 px, and the page jumped |
| Why earlier checkpoints missed it | `golden_hq2.js` removed the world's number from every `fx`, and the wall with it. `parity3d.py`, which shows it, was not run at H2-2 to H2-4 | The lag tests went to 150 ms each way, where corrections stay under 96 px |
| Before (H2-4's commit) | `proto_lab fx_wall` 1/3: Hound C `w` = 2, Hound A `w` = 2.<br>`contract_hq2.js` on `wire_capture.js`: every death replay's `w` not a wall; `fx end` with an unlisted `w`.<br>`parity3d` Hound C, judged against HQ1 (`parity_judge.py`): the spectator's light 17.14 px from the server's corpse (HQ1 0.21), blood 4 of 5 marks (HQ1 5 of 5), the seeds differ | `net_predict c10_rough` (the page's rule read from the tree's own `mp.js`) 10/12. One jump at 200 ms (132 px); two at 300 ms (142 and 185 px) |
| The repair | `server.js`: an `fx` names its world in `wn`; `w` is the wall again.<br>`mp.js`: `oldWorld(m.wn)` for `fx`.<br>`s`, `bodies`, `world`, `nra` keep `w` (none of them had a `w` before HQ2).<br>This corrects the audit's D5 ("every `fx` carries `w`") | `mp.js` `softTp`: every soft correction up to 600 px (one packet's budget is 568 px) is blended over 120 ms. Every other `tp` is unchanged |
| After (the final tree) | `fx_wall` 3/3 (Hound C `w` `[3740, 3744, 2.356]`, `wn` 2).<br>`contract_hq2` 0 violations in 13,578 server messages.<br>`parity3d` all eight deaths within 1 px on both screens (Hound C: light 0.35 px, blood 5 of 5, the same seeds) | `c10_rough` 12/12: every correction blended, none a jump; at most one per 0.3 s; no correction once both stand |

**Test tools changed with the first repair.** These HQ2 tools read the world's number on an `fx` from `wn`:
- `proto_lab.js` (`nr_boom`, `nr_elig`, `world_msgs`);
- `ws_reset.js`;
- `reset_epoch.py` (its spy);
- `golden_hq2.js`. It now takes out `wn` and compares an `fx`'s `w` like everything else.

## 2. The suites

**The table's columns.** "HQ1" is the parent export's result in this session, or HQ1's own recorded result (HQ1-3) where marked. "HQ2" is the final tree's.

### HQ2's own (the features)

| Suite | HQ2 | Covers |
|---|---|---|
| `unit/peers_unit` | 6/6 | `server/peers.js`: the floor, sweep, no creep, routes, free spots, a 1.2-million-move fuzz; the peer sweep's cost (p99 ≤ 5 µs with seven peers) |
| `unit/predict_unit` | 6/6 | `move.js` prediction: solo identical to HQ1's at every tick, frame-rate independence, the server agrees, the slide, the vault |
| `proto/nr_all` | 43/43 | E01, E02, E03, E05, E07, E08, R04 on the wire |
| `proto/col_all` | 48/48 | C01–C08 on the server |
| `proto/world_msgs` | 8/8 | R01–R04 on the wire |
| `proto/h25` (new) | 36/36 | E04 (`nr_abort`), E05 races (`nr_race`), four at once and a room next door (`nr_many`), packet abuse (`abuse`), C09 (`col_chase`), the wall regression (`fx_wall`) |
| `net/net_predict` | 26/26 | C09/C10 with lag 0–150 ms; eight pages |
| `net/c10_rough` (new) | 12/12 | C10 at 100/200/300 ms with jitter and retransmission stalls |
| `old_fixtures` | 6/6 | the four older checks whose fixtures put a body on a body |
| `death_equiv` | 384/384 | E08: the eight deaths and the light profiles identical to HQ1's, number for number |
| `boom_geo` | 400 blasts, 0 failures | the blast all over Level 0 |
| `static_hq2` (new) | pass | `server/peers.js`, HQ2's tools, evidence and reports never served; the client files served |
| `browser/col_head`, `col_aside`, and both at 150 ms | 5/5 each | C01, C02, C09, C10 by keyboard on real pages |
| `browser/reset_death`, `reset_boom` | 10/10 each | R01–R04 on four real pages |
| `browser/boom_flashlight`, `_lantern`, `_headlamp`, `_light_off` | 7/7 each | E01, E03, E06, the wall stain, the sound, a late joiner |
| `browser/nr_e02` | 7/7 | E02 on real pages |
| `browser/e09` (new) | 6/6 | E09: blackout, reduced motion, muted spectator, no audio permission, behind a wall |
| `browser/multi8` (new) | 10/10 (second pass) | 2–8 real pages: a crowd (one slowed, one lagged), two NEW RUNs at once, a late joiner, eight in a room |

### Goldens and the protocol contract (`golden/`)

| Check | Result |
|---|---|
| `golden_hq2.js`: 3H0's server golden traces, HQ1 → HQ2 | **7 of 11 scenarios identical.** The other four differ by documented HQ2 changes:<br>• `lifecycle`: HQ1 accepted a client's vanish; HQ2 does not (D4);<br>• `deaths`, `admin`, `exit_glitch`: a player placed 44 px off a standing one (D1/D2: 960 → 1004);<br>• `exit_glitch`'s events are otherwise the same and in the same order |
| `golden_hq2.js`, HQ1 against HQ1 (the harness's own A/A) | 11 of 11 identical |
| `cli_golden_hq2.js`: 3H0's client golden traces | **9 of 9 scenes pass.** Each is identical apart from:<br>• the declared globals (`__nrDebug`, `__epochDebug`, `__peerBodies`);<br>• `__net.nr`;<br>• the two vanish claims HQ1's `facade` scene sends and HQ2 never does |
| `contract_hq2.js`: every message against 3H0's contract with 3D's and HQ2's additions | **0 violations**: 13,578 server messages (the golden traces and `wire_capture.js`'s NEW RUN, refusal, blasts, a late joiner's blast, a Hound C death, a world reset, soft corrections) and 907 client messages. The client sends no `fx` or `b` |
| `static_check.js` (3D's) | every path answers as at the parent |

### HQ1's lighting and blood

| Suite | HQ1 | HQ2 |
|---|---|---|
| `light_power` | 8/8 (HQ1-3) | 8/8 |
| `light_net` | 8/8 (HQ1-3) | 8/8 |
| `hq1/wall_faces` low, high | OK | OK, OK |
| `hq1/faces_houndC_S` + `stain_metric`: blood pixels on the struck face (victim / spectator) | impact 389 / 199, corpse 167 / 166, late joiner 190 / 187 (HQ1-3) | impact 386 / 197, corpse 171 / 170, late joiner 191 / 194 |
| `hq1/wall_rebuild` | OK (HQ1-3), OK (this session) | OK, OK (second pass; the first run is in section 6) |
| `hq1/wall_lifecycle` | OK | OK |
| `hq1/timeline_flashlight`, `_legacy` | OK | OK, OK |
| `hq1/light_lifecycle` | every check but 4 (HQ1's R-C) | **OK, check 4 included** (repaired at H2-4) |

### The eight deaths

| Suite | HQ1 | HQ2 |
|---|---|---|
| `phys_matrix` (96 runs × 8) | HQ1-3's table | **identical, all eight variants, number for number** |
| `parity3d` + `parity_judge`: the victim's and the spectator's corpse against the server's | within 1 px (HQ1-3) | within 1 px, all eight, both screens |
| `death_net` | 16/16 | 15/16 (N9: H2-1's delta, section 4) |
| `gore_geo` (508 deaths) | ok | ok: 0 of 2.25 million drawn points on something solid |
| `corpse_check` Hound C, Hound A | | the victim's and the spectator's corpse at the same spot, from the death's end to a late joiner |
| `sound_check` | | the victim hears its death; the spectator once; the far player only the event |
| `film_3d` (`film/`) | | all eight filmed, each asleep at its end, every one seen by the spectator |

### Menus, camera, BR-RoLE, older suites

| Suite | HQ1 | HQ2 |
|---|---|---|
| `qa2/br_role` | 32/32 | 32/32 |
| `qa2/camera_fairness` | 12/12 | 12/12 |
| `qa2/theme_assets` | pass | pass |
| `qa2/probe_b1`, `b2`, `b3` | ALL PASS | ALL PASS ×3; Stage 3C QA2's evidence untouched |
| `existing/interp_test`, `test_3bn`, `phys_test`, `ir_net`, `s_fps_equality` | pass | pass (7/7, 4/4 where counted) |
| `existing/npm_test` (`dev/tests/run.js`) | 151/162 | 149/162: the parent's 11 failures, plus L9 and F13 (section 4) |
| `existing/test_shadows` | 43/48 | 43/48, the same five |
| `existing/humanqa_hotfix` | 5/6 | 5/6, the same |
| `existing/s_audit` | 9/9 | 8/9 (L9) |
| `existing/live` | 14/17 (HQ1-3: L5d, L5e, L5f) | 14/17, the same three |
| `existing/audit_net` | 16/17 (D3) | 13/17: D3, plus A1, M4 and R2 (section 4) |
| `existing/audit_net2` | 10/11 (DD2; this session) | 8/11 twice: DD2, plus LC4 and MT1 (section 4). The first run also failed LC1 (section 6) |

## 3. Known inherited failures (HQ1's, reported again)

These fail the same way on HQ1:
- `npm test`: 11 checks, all AI or behaviour tests (P01, P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18, 2F F22);
- `test_shadows`: 5 checks (including S16, which throws in the tool itself on both trees);
- `s_humanqa_hotfix`: 1 check;
- `live`: L5d, L5e, L5f;
- `audit_net`: D3;
- `audit_net2`: DD2.

HQ1's four gated exceptions are in `STAGE_3D_HQ2_PERFORMANCE.md`:
- D0's absolute frame limits;
- the soaks' RSS;
- the no-GC peak;
- the light lifecycle's check 4, now repaired.

## 4. Expected protocol deltas, and what replaces each

Each older check below asserts a behaviour HQ2 removes or changes on purpose. The older tests are left as they are; each has a replacement that passes.

| Older check | Why it fails on HQ2 | Replaced by |
|---|---|---|
| `s_audit` L9, `audit_net2` LC4 | the NEW RUN vanish sequence (vanish → leave → join), removed at H2-1 | `proto/nr_all` (`nr_flow`, `nr_e02`, `nr_elig`), `browser/nr_e02` |
| `death_net` N9 | a client's NEW RUN light record (`b:Vanish`), no longer read | `nr_elig`: "the old client channels are dead" |
| `npm test` 2F F13 | it calls `sim.vanish`, removed at H2-1 (an exception, not an assertion) | `f13_hq2.js`: F13's own assertions and fixture with HQ2's lifecycle (death, respawn, disconnect, NEW RUN then join, leave from death, world reset) |
| `audit_net` A1, M4, R2; `audit_net2` MT1 | their fixture puts a player on the spot their own admin or observer stands on, and HQ2's bodies are solid (H2-3) | `old_fixtures.js` 6/6: the same four with that body out of the way, and once more with it there (the HQ2 rule) |
| `golden3d.js` (3D's) | it refuses any server file but `death_srv.js` that queries the level's geometry; HQ2's `server.js` does so on purpose | `golden_hq2.js` |
| `cli_golden3d.js` (3D's) | HQ2's three new globals are undeclared there | `cli_golden_hq2.js` |
| `contract_check3d.js` (3D's) | HQ2's additions (`s.w`, `bodies.w`) are not in its list | `contract_hq2.js` |

## 5. Mutations: every test still catches its break (`mutation/`)

Each mutation is a copy of the final tree with one deliberate break (`mutate.py`):

| Mutation | Test | Result |
|---|---|---|
| `e02_no_cooldown` | `proto nr_e02` | 1/7, FAIL |
| `e01_stays_alive` | `proto nr_flow` | 3/6, FAIL |
| `e02_local_first` | `nr_browser --plan e02` | 5/7, FAIL |
| `c08_no_peers` | `proto col_head`; `peers_unit` | 4/8, FAIL; U3 FAIL |
| `c08_end_only` | `proto col_bypass` | 4/9, FAIL |
| `c08_creep` | `peers_unit` | U4 FAIL |
| `c08_no_route` | `proto col_bypass` | 5/9, FAIL |
| `c09_no_predict` | `predict_unit`; `col_browser --case head` | 2/6, FAIL; 3/5, FAIL |
| `r01_replays_live_on` | `reset_epoch --case death` | 9/10, FAIL |
| `r03_no_old_filter` | `reset_epoch --case death` | 8/10, FAIL |

The two H2-5 regressions are each also caught by their own tests run on the real broken commit (section 1).

## 6. What was run again, and why (`attempts/`)

- **`net_predict_mirrored_h2-5s_blend_rule/`.** `net_predict.js` mirrors `mp.js`'s handling of the wire. Its first runs had H2-5's 600 px blend written in, so on H2-4's tree `before_fix/c10_rough_h24` measured H2-5's page and passed 12/12. The tool now reads the rule from the tested tree's own `mp.js`, and `net/net_predict`, `net/c10_rough` and the before-fix run were run again.
- **`c10_rough_soft_corrections_jumped/`.** The first, development measurement of the soft-correction repair: the H2-4 rule, jumps of 129–135 px.
- **`fx_w_was_the_world_number/`.** The first measurements of the wall regression: `fx_wall` on the working tree before the repair, and `contract_hq2.js` on the H2-4 golden traces (19 violations).
- **`multi8_slowed_page_short_window/`.** In the eight-page session's last phase, the page CPU-throttled four times came back 34.5 of 60 px in the harness's 3.5 s window; 9/10. The windows are now 5 s out and 7 s back.
- **`multi8_starved_page_late_home/`.** The second run scored 8/10, for two reasons, both of the harness's timing on starved pages:
  - P1, the innermost page of the crowd, was still 42 px from the point when the 6 s walk home ended. The server's own player list has it standing at the point until then and then stepping out 40 px in one frame: its page drew a frame every few seconds, and nothing held it.
  - P3 moved 8.8 px after the others' keys had been let go, during the blasts. These were its last steps, drawn late.

  The tool now walks everyone home until all are out of the crowd (at least 6 s, at most 25 s; the time is recorded) and waits until no page moves before the NEW RUNs.
- **`wall_rebuild_spectator_noclipped_out/`.** `hq1/wall_rebuild`, HQ1's tool. Its eviction loop teleports the spectator 2,400–3,200 px away and back; here one teleport landed on an exit glitch. The screenshot shows "YOU NO-CLIPPED OUT OF LEVEL 0", so the stain could not be on his screen. The glitches are placed at random in each world. It was run again twice on HQ2 and once on HQ1, and passed all three times.
- **`perf_hq2_round_without_a_blast/`.** In round 2 of `perf/perf_hq2`, Alice's NEW RUN was refused (`dead`): a monster came back during the 30 s cooldown wait, so that round's "explosion" window held no blast. The tool now keeps her in god mode (the death preview works through it, and NEW RUN does not look at it) and brings her back before the press.
- **`existing/audit_net2` LC1.** It failed once. A real hound holds the client, and the check expects every way out (respawn, join, vanish, leave → join, a spawn claim) to fail. This time the hound killed it during the sequence, and a join from death is allowed. It was run twice more on HQ2 and once on HQ1 (`audit_net2_again*`, `audit_net2_parent`). LC1 passed every time: 8/11 on HQ2 both times (LC4, MT1, DD2), 10/11 on HQ1 (DD2).
EOF
echo written