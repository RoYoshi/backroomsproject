# Stage 3D: regression and equivalence

The pack asks for two separate results:
- **(A)** strict equality for everything that is not death;
- **(B)** documented differences for death.

This file gives both for the final tree (D6, `dev/stage-3d/evidence/d6/`; `summary.json` gates every correctness line).

## A. Non-death output: identical

### The server, whole tree against whole tree (`golden3d.js`)

3H0's eleven closed-world scenarios run on the parent (06949a8) and on 3D. The setup:
- the same fake clock, seeded randomness and fake sockets;
- the real `server.js` of each side with that side's own `sim.js`, `ai.js`, `dphys.js`, `death_srv.js`.

Every trace line is classed as death or not. The rule:
- a scenario with no death line must be byte-identical;
- otherwise the first difference must be death-domain, and the non-death view must be identical.

**What counts as death domain:**
- the death messages (`fx` death, `bodies`, `b`, the snapshot's kill record `mk`);
- the corpse and hand-back calls (`sim.setBody`, `sim.killerEnd`);
- the death simulation's geometry queries (`sim.blockersAt` / `sim.clearAt`, which only `death_srv.js` calls; the tool checks that no other server file does);
- served files that 3D changed: status and type must match, the body may differ.

**What the non-death view leaves out:**
- the snapshot's kill record;
- the monsters that made a kill, from every entity list (when and where a death hands its attacker back to the AI is death aftermath); every other monster is compared as is;
- entity positions in the admin lists, with identity and state kept;
- the admin's per-second AI counters and the AI log lines that name a killer.

**Its one bound.** The non-death view must be identical up to the first killer hand-back. A difference after that is reported as a follow-on, with its time, and that scenario is not compared further. Only `deaths` reaches it; `summary.json` fails on a follow-on anywhere else.

| Scenario | Result |
|---|---|
| boot, ws_upgrade, ws_frames, schedule, p_fields, exit_glitch | byte-identical |
| http_base, http_h0 | differ only in the bodies of served files 3D changed (same status, same type); non-death view identical |
| lifecycle, admin | differ from a death line on; non-death view identical |
| deaths | identical up to the first killer hand-back (5.9 s), then one documented follow-on (below) |

The A/A run of the same tool (parent against parent) gives 11/11 identical.

**The follow-on.** In `deaths`, the scripted victim never reports a corpse. The parent therefore released the killing hound only through its fallback, 8 s after the death. 3D releases it at the death's end on the server's clock. That is when the parent released it for every real client, which reported its corpse at the end.

Released earlier, the same hound, with the same rules, goes on to kill a second scripted player at 6.5 s. Nothing differs before the hand-back.

### The client (`cli_golden3d.js`)

3H0's nine `mp.js` scenes run in a fake-clock Chromium page, parent against 3D.

| Scene | Result |
|---|---|
| load, menu_online, interp, fx_bodies, admin, reconnect_solo, hum_dread | byte-identical |
| run_online | differs only in the corpses hidden while a death plays (`hb`): 3D also hides the server's copy of your own corpse while you are dying. Only that one entry is taken out; any other hidden corpse must match |
| facade | differs only in the client's own death claims: the parent sent 5 (2 replays, 3 corpses), with the light-part lookups for them; 3D sends none |

One new global, `window.__dvic`, is declared like 3H0's own `__mpLib`. It is kept out of the strict trace and listed.

### The protocol contract

Every one of 11,557 server messages and 907 client messages in the new traces matches 3H0's contract plus 3D's death fields:
- `fx`: optional `de`, `lo`, `el`;
- `fx` `k:'end'`.

Against 3H0's contract file alone, unchanged, the 32 differences are all new optional replay fields, `de` and `lo` (`contract_3h0.json`). The contract file itself is not edited.

### Static serving

`static_check.js` starts each tree's own server and asks 26 paths: every path answers as at the parent.
- Same status and type throughout.
- `death_srv.js`, `sim.js`, `ai.js`, `server.js`, `server/*`, `package.json`, `dev/` and the stage documents stay 404, including through `%2e%2e` and `../`.
- 3D added no client script. `index.html` is byte-identical: the classic-script boot contract and load order are unchanged.

### Suites from earlier stages

| Suite | Result |
|---|---|
| `npm test` | 151/162 on both parent and 3D: the same 11 historical failures, by name |
| `dev/shadows/test_shadows.js` | 43/48 on both: the same 5 failures |
| `ir_net` | pass |
| `interp_test`, `test_3bn` | pass |
| camera fairness | 12/12 |
| BR-RoLE | 32/32. U32 includes the death torch and dead peers |
| theme files | unchanged |
| QA2 probes | `probe_b1` 13/13, `probe_b2` 10/10, `probe_b3` 28/28 (boot, menu, music gate, entry) |
| `live`, `audit_net`, `audit_net2` | every check passes except five that assert the parent's death protocol (below) |

## B. Death: what changed, and the checks that replace the old ones

The protocol change is in `STAGE_3D_DEATH_AUTHORITY_AND_PROTOCOL.md`. These five older checks assert that the victim's own client reports its replay and corpse. They fail by design and are superseded:

| Old check | What it asserted | Replaced by (`death_net.js`) |
|---|---|---|
| `live` L5d | the victim's replay and corpse reach Bob | N1 (the server's replay and corpse reach everyone, same id), N9 (the NEW RUN light record) |
| `live` L5e | another corpse from the victim replaces the first | N8b (dying again replaces the corpse; one per player) |
| `live` L5f | a living player cannot leave a corpse or a replay | N2b (nobody can: forged, repeated, far away or from the living) |
| `audit_net` D3 | the victim's own replay and corpse are used | N1 |
| `audit_net2` DD2 | the same, after the fallback deadline | N1, N3 |

Their logs are kept (`evidence/d4/existing/`, `evidence/d6/existing/`). `summary.json` requires that exactly these five fail and every other check of those suites passes.

**Death-domain results:**

| Check | Result |
|---|---|
| `death_net.js` | 16/16; the parent 6/16 |
| `parity3d.py` | all eight at normal speed; victim and spectator against the server's corpse within a pixel (≤ 0.7 px); the parent's dropped light was up to 34 px off |
| `phys_matrix.js` (690 runs) | every death asleep by its end; nothing moves after; sampling-independent; no penetration or tunnelling; wall marks on wall faces |
| `gore_geo_test.js` (508 deaths) | 0 drawn blood points on anything solid; the parent 4,568 |
| `sound_check.py` | blows timed by the physics; spectators hear it, placed; sound OFF silent |
| `corpse_check.py` | culling, caching, drying, late joiners |
| film | all eight, parent and 3D block by block, victim and spectator; x-ray sheets |

## Failures kept, and what they taught

- **D1:** `parity3d.py` first failed to run its Node part (a relative game path). It was fixed with `--recompute` on the same browser rows; the rows were kept.
- **D1:** `golden3d.js`'s first D1 run failed on two kinds of difference that are death by construction: a served death file, and the death simulation's geometry queries. They are now classed, and the A/A run stays 11/11.
- **D4:** `golden3d.js` failed on `deaths`. Each step of the analysis is in the tool's comments: positions and states of the killer, its AI log lines, the work counters, then the follow-on after the hand-back.
- **D4:** `death_net.js`'s first run failed N9 (the test sent from the old position after a respawn) and N11 (it counted a NEW RUN vanish replay, which is legal). Both were test errors, fixed in the test.
- **D4:** `parity3d.py` could not see the spectator's replay end: it is replaced by the corpse on the very frame it ends. The tool now records every frame.
- **D6:** the first browser run put Hound C 10–16 % over the parent (`perf_death_d6_attempt1.json`). Two corrections followed (`evidence/d6/corrections.md`):
  - drying corpses redrawn off screen;
  - wall-mark geometry rebuilt every redraw.

  The interleaved A/B (`perf_ab/`) then puts every window within +10 % (median).
- **D6, independent review:** a reviewer who had not built 3D read the D6 tree and found ten points, all corrected and the whole D6 run again (`evidence/d6/corrections.md` §3). Among them: the hound's jaw could take hold again after letting go; the server's corpse run happened in one tick at the death's end (now spread over the death); the NEW RUN record took its light from the message (now from the server's state); and this file's client check took out the whole hidden-corpse set instead of only your own corpse.
- **D6, the interleaved A/B:** the Hound A death stayed 8–11 % over the parent per frame on the software renderer, through 10 interleaved pairs and two ways of measuring. It is within D0's thresholds and over D6's own stricter line for the spectator. It is reported (`STAGE_3D_PERFORMANCE.md`; `summary.json` `over`), not passed.
