# HQ1-3: the full regression and performance

## What ran

D7's final regression (as D6 ran it), with D7 (`ffe2b53`) and 3H0 (`06949a8`) exported and run side by side in the same session. On top of it, the HQ1 features themselves again on the final tree:
- wall faces;
- the Hound C south-face capture and its stain metric;
- the cache rebuild;
- the wall lifecycle;
- the flashlight timeline with BR-RoLE and with the game's own lighting;
- the light lifecycle;
- twenty corpses' stains at once.

It ran on **`a1d9cb9`** (HQ1-3a, tree `07c83d1`). Every step, with its exit status and duration, is in `steps.txt`. `summary.json` (`dev/stage-3d-hq1/summarize_hq1.py`) puts every result next to what it is compared with.

During the run only development tools changed in the working tree; every production file stayed byte-identical to `a1d9cb9` (`working_tree_during_run.txt`, `working_tree_after_run.txt`). The light timeline labels that state `a1d9cb9…+working-tree`.

## HQ1-3a: one regression found and fixed first

The first run (`attempts/run1_stopped_br_role_U10/`) found BR-RoLE's own test U10 failing against D7.
- HQ1-2's bundle edit had put the dying light's power into the condition of BR-RoLE's guarded hook (`if(!BR&&e&&!f.nv&&HQ>0){`), so the hook's exact text, which U10 and `dev/br-role/freeze_br.py` look for, had changed.
- HQ1-2 had not run that test.
- The run was stopped after 4 minutes. The power is now read inside the hook's block, with the same behaviour (`fix_seam/NOTE.md`).
- Then BR-RoLE passed 32/32, and the whole run started again on `a1d9cb9`.

## Results

`summary.json`, in short (every line is there in full):

| | Result |
|---|---|
| Non-death output | identical to D7 and to 3H0: server golden (whole tree), client golden scenes, A/A 11/11. The only differences are death-domain fields |
| Protocol | the 3D contract (with `lf`) 0 violations; `death_net` 16/16; static serving as at D7 |
| Physics, blood, parity | `phys_matrix` 690 runs all asleep, nothing moves after; `gore_geo` 0 of 5.06 M points on anything solid; parity in all eight variants < 1 px; sound as at D7; corpse culling and caching; film: all eight asleep, seen by the spectator |
| Older suites | `npm test` 151/162 and `test_shadows` 43/48: the same failures as D7, by name. The five pre-D4 protocol checks are superseded by `death_net`, as at D7. `s_humanqa_hotfix` 5/6, the same failure as D7. Camera fairness 12/12, BR-RoLE 32/32, theme files unchanged, QA2 probes b1–b3 0 FAIL |
| 8 players | every client got every replay once and every corpse, with the same light profile; 35,298 B/s per client (D7 35,159, +0.4 %) |
| HQ1 again, final tree | wall faces 100 %; W1 south face 166–389 blood pixels on the band (0 before, 0 above); cache rebuild; wall lifecycle 7/7 (8b reported); light timelines: BR-RoLE 18.3 ms spread, game's own lighting 1.3 ms; light lifecycle 4/4 (4b holds); twenty corpses 4/4 |
| R3 interleaved A/B against D7 (≤ +7 %) | **met**: idle −9.7 / −2.6 %, Hound A −8.9 / −8.6 %, Hound C +2.2 / −2.1 % (victim / spectator, 4 pairs) |
| The same at HIGH lighting, idle and Hound A (added after the regression, 3 pairs) | **within the line**: idle 0.0 / −3.3 %, Hound A −1.4 / −0.5 %. The non-interleaved HIGH run had shown Hound A +14–20 % and Hound C −39 % against D7, back to back: the session's swing, not the code |
| R4 20 corpses, idle (≤ D7 + 10 %, + 7 %) | **met**: on screen 833 ms (D7 817), off screen 700 (D7 783), idle 733 (D7 850) |
| R4 memory | browser heap slope within D7's (0.41 / 0.15 MB per death against D7's 0.50 / 0.30); the server's heap after full collections 6.3 → 8.0 MB (D7 6.3 → 8.7); forced-GC server soak flat. **The RSS lines: see below** |

### Gated lines not met (3)

Each line is reported as the summary gates it; none is moved. Each is an absolute line, and D7, measured in the same session, misses it as well or by more.

1. **D0's absolute frame-time thresholds** (fixed at D0, in another session, and kept by D6's summary):
   - Hound A death window: 983 ms against D0's limit of 972; D7 in this session 1,150.
   - Hound C death window: 817 ms against 788; D7 858.
   - The other four windows are within their limits.

   This session's machine is slower than D0's and D6's (idle median 717 ms here, 633 at D6). The HQ1 audit's own performance gates compare with D7 in the same session (R3, R4), and those are met.
2. **The 32-death browser soak's server RSS did not level off in its last 8 deaths:** 176.8–205.9 MB. D7 did not either: 200.1–222.8 MB.
   - Both rise in the same 22–28 MB steps, and HQ1's stays below D7's throughout.
   - The heap after each full collection is HQ1 6.3 → 8.0 MB against D7's 6.3 → 8.7.

   The same soak with 64 deaths, HQ1 and D7, was run afterwards, alone, to see where it levels (`soak_gc/soak_gc64*.json`). Both level off:
   - **HQ1:** 128.6 → 226.2 MB, within 6 MB from death 23 on; the last 16 deaths 226.1–226.2 MB.
   - **D7:** 122.9 → 212.3 MB, within 6 MB from death 34 on; the last 16 deaths 210.8–212.3 MB.
   - The heap after full collections was 6.3 → 8.3 MB in both.

   HQ1's plateau is one ~20 MB step higher than D7's in this pair, where in the 32-death pair D7's was higher.
3. **The 64-death server soak without forced GC set a new RSS peak in its last 16 deaths:** 97.8 MB at death 51, against 97.3 before it, 0.5 MB higher. It ended at 97.6 MB. D7's run peaked at 108 MB (death 9) and ended at 104.7.

HQ1's server keeps no new per-death state:
- the light profile is a few numbers on the death's own records;
- the corpse's creation time is in a `WeakMap`, as at D7.

The forced-GC server soak shows no growth: heap +0.0057 MB per death (D7 +0.0042), RSS +0.02 MB per death (D7 −0.003).

## Added after the regression, alone

- `soak_gc/soak_gc64*`: the browser soak with 64 deaths, HQ1 and D7 (above).
- `perf_ab_high/`: the interleaved A/B at HIGH lighting for idle and the whole Hound A death, 3 pairs.

## Runs repeated after the regression, alone (the first runs kept)

- **`attempts/light_lifecycle_real_monster_kills/`.** A real Hound B killed Alice, then Bob's reconnected player, between the test's first and second deaths. Their light and corpse spoiled checks 1 and 2.
  - The harness now guards the victim and clears the monsters the moment she is revived and when Bob is back.
  - It now compares every death the server made with the ones it played; an unplanned one is a harness fault to repeat, never a pass.
  - The rerun: 4/4, no unplanned death.
- **`attempts/probe_b3_warm_start_not_sooner/`.** QA2's probe_b3 failed one timing comparison: a warm start, from the cache, was not faster than the cold one (5,711 ms against 5,223). The cache itself worked: 2 hits, 0 downloads. HQ1 changes no menu file.
  - The rerun passed: warm 1,323 ms against cold 4,381.
  - D7 in the same session passed too: warm 974 against cold 5,493.

## Other notes

- **The message delays the light's clock survives.** On these SwiftShader pages, three to a two-core machine, a page first showed a death 0.33–1.80 s after a quiet WebSocket observer in the same room received the server's message (every light timeline in HQ1-2 and HQ1-3: `observed.firstShown` against `observer.fx`). The light's end still agreed within 1.2–18.3 ms across victim, spectator and late joiner, because each page anchors it on the server's timing, not on when it got round to drawing.
- **One push was refused once.** The push of HQ1-2 was refused once by GitHub ("remote rejected (failure)"). The same normal push, retried at once, went through, and the remote check passed (`remote_hq1-2.json`).
- **Remote checks.** `remote_hq1-2.json` and `remote_hq1-3a.json` are the remote verifications of HQ1-2 and HQ1-3a, run after their pushes.
- **Secret scan.** `secret_scan.json`: every file changed since the Stage 3H0 parent, scanned before this commit.
