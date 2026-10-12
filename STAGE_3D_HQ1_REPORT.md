# Stage 3D HQ1: wall blood and dying lights, report

**Branch** `stage-3d-hq1`, a straight line from the D7 parent `ffe2b53` (tree `b226afe`).
- Normal pushes only, nothing merged, no other branch touched. `main`, `stage-3d`, `stage-3h0`, the Stage 3C branches and every older branch are where they were before HQ1 (checked on GitHub after every push).
- The human-QA package and its receipt verify the final commit from the ZIP itself. The final source is `a1d9cb9` (HQ1-3a); HQ1-3 and HQ1-4 add only tools, evidence and documents.

HQ1 makes exactly the two corrections you asked for after testing the Stage 3D candidate, and nothing else.

## What HQ1 changes

### A. Blood on the wallpaper (HQ1-1)

When a body really strikes a wall, the wallpaper face it struck now carries the blood, not only the carpet at its foot.

- **The contacts are the physics' own.**
  - While a death plays (the victim's own and every replay), they come from `dphys.marks`.
  - On a corpse, they come from the server's record (`bl`, seeds 512–543).
  - No position is invented.
- **The face is chosen from the contact normal.**
  - It must be a papered wall face facing the contact (dot ≥ 0.6), on its line (within 4 px), and at least 6 px from either end of the run.
  - Corners resolve to the face that was struck. Pillars, props and floor never match: no stain.
- **The stain.**
  - One of 36 looks (12 shapes × 3 sizes), seeded from the death id and the contact, so the same everywhere.
  - A dark crimson and maroon splash at the struck height, inside the band of the face the eye can see.
  - Spray along the wall and 4–6 thin runs down to the crease.
  - It is stamped through the Level 0 remaster's own decal receiver (`window.__l0v.surfaces.stamp`). So it is clipped to the face, baked into the wall's art and lit by BR-RoLE exactly like the paper under it. It never glows and is never drawn over the wanderers.
- **Lifecycle, by death id.**
  - A replay hands over to its corpse with no second stamp, and a late joiner rebuilds the same stain from the corpse.
  - A second death and an admin revive mid-death remove it; a world reset removes it with the corpse (a reset during a death: see Known limitations).
  - Cache rebuilds and quality changes keep it.
  - Nothing is stamped per frame; `mp.js` tells `gore.js` what the screen shows every 0.12 s.
- **Remaster off:** nothing is stamped and nothing is drawn in its place. The floor blood is D7's.

### B. Dying lights (HQ1-2; HQ1-3a)

A light that was on when its wanderer died:
- holds at full power for **3–7 s** from the moment the death lets go of it;
- then flickers and dims irregularly for **1–2 s**, with short blackouts under an envelope that only falls;
- then stays at **exactly 0** for that death.

A headlamp stays on the head, so it holds from the death's start. A light that was off, and a camcorder, emit nothing at any time.

- **The server decides.** One profile per death, `lf = [hold, fade, seed]`, a hash of the world's reset count, the death id and the light kind. It is sent on:
  - the victim's kill record (`mk`);
  - every spectator's replay (`fx`, with `el` for late joiners);
  - the corpse record, as `[hold, fade, seed, release − death length]`, with `ag` now in tenths of a second from the death's end.
- **One clock per death id, never restarted.**
  - Each page anchors the release on its own clock from the earliest of the server's timings it has: the kill record's arrival, the replay's arrival − `el`, each corpse record's arrival − `ag`, and the server's snapshot clock.
  - The anchor only ever moves earlier. Reconnects, reloads, focus, resizing, respawn and the replay → corpse hand-over never restart it.
  - The Death Lab's slow motion and pause change only the presentation.
- **One power reaches everything that draws the light:**
  - `window.__peerLights` (`pw` on dead entries; at 0 they are left out);
  - `light.js`;
  - BR-RoLE;
  - the game's own lighting, through two exact-text bundle hooks (HQ1-3a moved one of them inside BR-RoLE's seam, so the seam's text stays verbatim: see Tests).

  The victim's own corpse adds no second light while her death is still on screen. That was a D7 duplicate on the victim's screen, found in the HQ1-0 audit.
- **Unchanged:** the light's position, angle, colour, lens origin, shadows and masks; living lights; the ceiling fixtures; the NEW RUN record.

`STAGE_3D_HQ1_DEATH_LIGHT_PROTOCOL.md` has the full protocol, sizes and clock.

## What stayed exactly as it was

All of the following are byte-identical to D7:
- `index.html`: the same scripts in the same order, and nothing new loaded;
- `assets/l0-remaster.js`: its decal receiver is used as it is;
- the AI, movement, the level, the camera, the HUD, the menu, sound and the theme files;
- `sim.js`, `ents.js` and their sources;
- 3H0's extracted modules except `assets/net-wire.js`, which carries the two new optional fields;
- every older test in `dev/tests` and every earlier stage's evidence (four Stage 3D tools were adjusted for the new fields: `STAGE_3D_HQ1_CHANGED_FILES.txt`);
- the deployment.

Nine production files change (`STAGE_3D_HQ1_CHANGED_FILES.txt`). The Stage 3D death physics and the server's death authority are not rewritten.

## Checkpoints

| | Commit | Tree | What |
|---|---|---|---|
| HQ1-0 | `dcf9f84` | `a79f7e2` | audit, RED evidence on D7, gates fixed before any change (`STAGE_3D_HQ1_AUDIT.md`) |
| HQ1-1 | `241d7da` | `2d8bfba` | blood on the wallpaper |
| HQ1-2 | `1c8e788` | `a60d98a` | dying lights |
| HQ1-3a | `a1d9cb9` | `07c83d1` | BR-RoLE's seam kept verbatim (found by the first HQ1-3 run) |
| HQ1-3 | `bf4894c` | `033c34c` | full regression and performance on `a1d9cb9` |
| HQ1-4 | in the receipt | | this report, the documents, the visual evidence, the package (a commit cannot hold its own hash: `STAGE_3D_HQ1_PACKAGE_RECEIPT.txt` gives HQ1-4's commit and tree, verified from the ZIP) |

Full hashes: `dev/stage-3d-hq1/evidence/hq1-4/CHECKPOINTS.md`.

Each checkpoint:
1. ran its focused tests first and kept its failed attempts;
2. was committed and pushed normally;
3. was verified on GitHub: commit, tree, parent, a straight line from D7, and every other branch unmoved (`dev/stage-3d-hq1/verify_remote_hq1.py`; `remote_*.json` in the next checkpoint's evidence).

HQ1-2's push was refused once by GitHub ("remote rejected (failure)"); the same normal push, retried at once, went through, and the remote check passed.

## Tests and exceptions

The gates were fixed in HQ1-0, before any change. A gate that is not met is reported here with its evidence, never moved.

### Wall blood

| Gate | Result |
|---|---|
| W1 a stain plainly on the wallpaper, faces S, N, E and W, victim, spectator and late joiner | **Met.** Blood pixels in the band box after the death (gate ≥ 150; D7 0): S 166–389 on `a1d9cb9`, the final source; N 222–493, E 337–408, W 184–428, MEDIUM 154–388, HIGH 158–394 (HQ1-1). Nothing above the band (the wall top), in every picture |
| W2 face resolution on the real map | **Met**, 100 % at LOW and HIGH. Run again on `a1d9cb9` |
| W3 lifecycle, cache | **Met except a world reset**: on the victim's own screen (check 8b, a D7 behaviour), and during a death on every screen (not measured; by the code the stain stays while the replay lingers, then goes: Known limitations). `summary.json` gates the other steps and lists 8b apart. One stamp per impact through replay → corpse; the late joiner rebuilds it; idle 10 s: no new stamp; a second death, a revive mid-death and a world reset (on the other screens) remove it; a reconnect rebuilds exactly one. A full rebuild, tier rebuilds and a cache eviction keep it. Run again on `a1d9cb9` |
| W4 floor blood unchanged | **Met.** `gore_geo`: 0 of 2,251,617 live and 0 of 2,805,291 corpse points on anything solid (508 deaths), the same counts as D6/D7 |
| W5 remaster off | **Met.** No stamp, no error, nothing in its place |
| W6 cost | **Met.** A stamp ≤ 3.7 ms on the victim's and spectator's screens, ≤ 7.5 ms on a late joiner's (HQ1-1). Twenty corpses at once, each with 3 wall marks on its own face: 60 stains, 24.7 ms to stamp them all, 2.3 ms the dearest; 10 s idle: no new stamp; replaced: 60 out, 60 in; cleared: the receiver empty |

### Dying lights

| Gate | Result |
|---|---|
| L1 unit | **Met.** 36 profiles (hold 3/5/7 × fade 1/1.5/2 × 4 seeds). Full at release − ε, release + 0.1 and hold − ε. At least one blackout and three levels in every failure. The brightest moment of each 0.1 s step never rises. ≤ 0.2 just before the end; exactly 0 at the end, +30 s and +600 s. `releaseOf` at the first frame equals the run's own release for 192 deaths |
| L2 profile | **Met.** 1,000 deaths × 3 kinds: hold covers 3.0–7.0 (41 values), fade 1.0–2.0 (11 values), deterministic; none for a camcorder or a light that was off |
| L3 protocol | **Met.** `mk`, `fx` and the corpse carry the same profile. The corpse's release equals the server physics' own. Forged replays and corpses change nothing. The NEW RUN record has none. Replay 241 B (D7 222); corpse 410 B with a light profile, 384 B without (D7 384; the line was 384 + 32) |
| L4 parity | **Met.** The light's end, victim, spectator and late joiner, against a quiet WebSocket observer of the same room: spread 1.2–18.3 ms over seven runs, every page within 18.1 ms of the observer (gate 150 ms). On `a1d9cb9`: 18.3 ms with BR-RoLE, 1.3 ms with the game's own lighting |
| L5 rendering | **Met.** Full power through the hold; at and after the end, no `__peerLights` entry, BR-RoLE's buffer 0, `light.js` 0, the screen dark, on every screen, in death and on the corpse. The hold is D7's (BR-RoLE probe 0.8211 against D7's 0.8211). A survivor's light is unchanged. The game's own lighting and HIGH, the same |
| L6 lifecycle | **Met except a world reset during a death** (below). Off at death and the camcorder: nothing, ever. Headlamp from the death's start. Death Lab paused: the light still ends on time. Focus, hide and resize while dying, a dropped connection and a reloaded page (a late join during the hold): no anchor moves later; the three end within 71.8 ms (HQ1-2) and 72.1 ms (`a1d9cb9`). A second death, and a revive 0.83–0.89 s after the release: no dead light afterwards. **A world reset 2 s into a death does not cut the death short on any screen that shows it**: it plays on, and its light fails on its normal schedule, nothing lit after that end (check 4c: the last lit frames 0.9–4.7 s after the reset, all before the scheduled end). The audit asked for no light after a reset: not met (check 4). On `a1d9cb9` no unplanned death; every earlier run is kept (`evidence/hq1-3/attempts/light_lifecycle_*`) |
| L7 NEW RUN | **Met.** The `Vanish` record has no `lf`; its light path is unchanged |

### The whole stage (HQ1-3, on `a1d9cb9`)

`dev/stage-3d-hq1/evidence/hq1-3/summary.json` holds every line below, gated, next to what it is compared with.

| Gate | Result |
|---|---|
| R1 D7's regression, every correctness line as at D7 | **Met.** `phys_matrix` 690 runs, all asleep, nothing moves after; `gore_geo` 0 points on anything solid; `death_net` 16/16; parity in all eight < 1 px; sound; corpse culling and caching; the protocol contract; static serving; BR-RoLE 32/32 (after HQ1-3a); camera fairness 12/12; theme files; QA2 probes b1–b3 0 FAIL (b3 after one rerun, below); 8 players: every replay and corpse to everybody |
| R2 non-death output identical to D7 | **Met.** Server golden (whole tree) and client golden scenes; A/A 11/11; the only differences are death-domain fields |
| R3 interleaved A/B against D7, ≤ +7 % | **Met.** Idle −9.7 / −2.6 %, Hound A −8.9 / −8.6 %, Hound C +2.2 / −2.1 % (victim / spectator). At HIGH (added): idle 0.0 / −3.3 %, Hound A −1.4 / −0.5 % |
| R4 20 corpses, idle, memory, stains | **Met, except the server's RSS levelling within the 32-death run** (below). 20 corpses on screen 833 ms (D7 817), off screen 700 (D7 783), idle 733 (D7 850); browser heap slope 0.41 / 0.15 MB per death (D7 0.50 / 0.30); the server's heap after full collections 6.3 → 8.0 MB (D7 → 8.7); stains ≤ 3 per corpse, ≤ 36 images |
| R5 all eight variants as at D7 | **Met.** Film: all eight end asleep and the spectator saw each one; parity < 1 px |

**Gated lines of the summary not met (4).** None is moved. D7, measured in the same session, misses the first two as well, or by more; it passes the third; the fourth is the world reset above:
1. **D0's absolute frame-time thresholds.** These were fixed at D0, in another session, and kept by D6's summary.
   - Hound A death window: 983 ms against 972; D7 1,150.
   - Hound C death window: 817 ms against 788; D7 858.

   This session's machine is slower than D6's (idle 717 ms against 633). R3 and R4, the comparisons the HQ1 audit fixed against D7 in the same session, are met.
2. **The 32-death browser soak: the server's RSS did not level off in the last 8 deaths** (176.8–205.9 MB). Neither did D7's (200.1–222.8 MB). Both rise in steps of 18–27 MB; in this pair HQ1's stays below D7's throughout.
   - The same soak with 64 deaths, run afterwards for both, levels off: HQ1 at about 226 MB from death 23, D7 at about 212 MB from death 34. In that pair HQ1's plateau is 14 MB higher.
   - The heap after full collections was 6.3 → 8.3 MB in both.
3. **The 64-death server soak without forced GC: a new RSS peak in its last 16 deaths.** 97.8 MB at death 51, 0.5 MB above HQ1's earlier peak (97.3); it ended at 97.6. D7 passes this line: it peaked at 108 MB at death 9 and ended at 104.7, higher than HQ1 throughout the end of the run.

4. **The light lifecycle, 3/4: check 4, a world reset during a death** (L6 above, and Known limitations).

HQ1's server keeps no new per-death state. With forced GC, the server soak shows no growth: heap +0.0057 MB per death (D7 +0.0042), RSS +0.02 MB per death (D7 −0.003).

**Failures that are not new defects** (each fails at D7 too, was replaced by D4's protocol, or passed when run again, as noted):
- **The five superseded network checks.** `live` L5d, L5e and L5f, `audit_net` D3 and `audit_net2` DD2 assert the pre-D4 protocol, in which the victim reported its own replay and corpse. They are superseded by `death_net` (16/16), as at D7.
- **npm test:** the same 11 historical failures as D7, by name. They also failed at the 3H0 parent (`dev/stage-3d/evidence/d6/existing/npm_test_parent.log`): AI behaviour checks and one species-parameter check, all from before Stage 3D.
- **test_shadows:** the same failures as D7.
- **`s_humanqa_hotfix` X03:** its exact-text check predates BR-RoLE's seam; it fails at D7 too.
- **QA2 probe_b3, its first run:** one timing comparison (a warm start, from the cache, not faster than the cold one: 5,711 against 5,223 ms; the cache itself worked). HQ1 changes no menu file. Run again alone it passed (1,323 against 4,381 ms), and so did D7 in the same session (`evidence/hq1-3/attempts/probe_b3_warm_start_not_sooner/`).
- **3H0's unchanged contract file:** it lists the replay's optional fields as unknown (`de`, `lo`, and now `lf`); the 3D contract check (`contract_check3d.js`) passes.

**Found and fixed in HQ1-3 (HQ1-3a).** The first HQ1-3 run found BR-RoLE's own test U10 failing against D7. HQ1-2's bundle edit had put the dying light's power into the condition of BR-RoLE's guarded hook, changing the hook's exact text. HQ1-2 had not run that test. The power is now read inside the hook's block, with the same behaviour. BR-RoLE passes 32/32, and the run was started again on the fixed commit. The stopped run is kept (`evidence/hq1-3/attempts/run1_stopped_br_role_U10/`, `evidence/hq1-3/fix_seam/`).

## Resource impact

Details: `STAGE_3D_HQ1_PERFORMANCE.md`. In short:
- **Browser.** Within D7 in the same session: the interleaved A/B is within +7 % everywhere, at the default quality and at HIGH. 20 corpses, idle and the browser heap slope are within their lines; the server's RSS lines are above. The wall stain costs ≤ 3.7 ms once per impact (≤ 7.5 ms for a late joiner) and nothing per frame. A dead light at power 0 leaves the lighting input, so an old corpse costs less than at D7.
- **Graphics memory.** No new texture: a stain is drawn into the remaster's existing wall art, whose touched chunks re-bake once. At most 36 small stain canvases (≤ 3.4 MB, CPU side).
- **Server.** The death simulation is unchanged (60.2 ms against 61.4 for the eight variants' medians); the largest tick is 2.8 ms. One hash per death; no new retained state. Its JS heap does not grow. In the 64-death browser soak its resident memory levels off at about 226 MB (D7 about 212 MB in the same session); the separate 64-death server soak without forced GC set a new peak 0.5 MB above its earlier one at death 51 (gated line 3, above).
- **Network.** +0.4 % bytes per client with 8 players. The replay is +19 B and a lit corpse record +26 B; nothing else changes.

## Visual evidence

`STAGE_3D_HQ1_VISUAL_EVIDENCE.md`:
- the wallpaper stain against D7 for the victim, the spectator and the late joiner, at the impact and on the corpse;
- the four faces, the corner, the pillar, behind the wall, remaster off, and MEDIUM and HIGH;
- the light failure, timecoded in 0.1 s steps with its power curve, and as a 10 fps clip;
- real time against D7.

## Reproducer

The package is the repository at the final commit. In its folder (Node 18 or later; Python 3 with Playwright and the Chromium it finds for the browser tools):

```
ADMIN_PASSCODE=<your own passcode> node server.js 8000          # the game; open http://localhost:8000

# the evidence tools (they start their own server with a synthetic test passcode)
node dev/stage-3d-hq1/light_power_test.js --game . --out lp.json                                  # L1, L2
node dev/stage-3d-hq1/light_net.js --game . --out ln.json                                         # L3, L7
python3 dev/stage-3d-hq1/wall_capture.py --game . --out wall --side S --late 30 --tag houndC_S    # W1: the pictures
python3 dev/stage-3d-hq1/stain_metric.py wall/houndC_S.json --out wall/metric.json                # W1: the count
python3 dev/stage-3d-hq1/light_timeline.py --game . --out tl --kind flashlight --tag houndA_flashlight   # L4, L5, L6
python3 dev/stage-3d-hq1/light_lifecycle.py --game . --out ll.json                                # L6
python3 dev/stage-3d-hq1/stain_budget.py --game . --out sb.json                                   # twenty corpses
python3 dev/stage-3d-hq1/visual_evidence.py --out visual                                          # the composed pictures
```

The whole HQ1-3 run, step by step, is `dev/stage-3d-hq1/evidence/hq1-3/steps.txt`. Its summary is `python3 -I dev/stage-3d-hq1/summarize_hq1.py`. `dev/stage-3d-hq1/README.md` lists every tool.

## Known limitations

- **An admin world reset during a death** (L6 check 4, not met; W3, not met on the victim's screen (8b) and, by the code, not on the others).
  - The reset does not end a death in progress on any screen that shows it. The server cancels the corpse but sends no end, so each spectator's replay plays on and then waits up to 8 s for the corpse (D7's replay lifecycle, unchanged).
  - The death's light fails on its normal schedule, at most 10.7 s after the death began; at D7 it stayed lit until the replay went.
  - On the victim's own screen her death plays on too, and her local corpse and its wall stain stay. D7 already kept the victim's own local corpse through a world reset (`bodies()` replaces only the server's records), and HQ1 does not change corpse authority.
  - A wall stain from such a death stays while its replay does, by the same code path (read in the code, not measured).
  - A world reset with no death in progress clears the stains from every other screen at once (W3 8a).
  - Corrected: HQ1-2's summary said no dead light remained on any screen after a reset. Its runs had not measured it: the reset teleported the spectators away from the replay, the victim's busy page had not shown the death, and check 4b counted only other wanderers' lights. HQ1-4 measures it (checks 4, 4b, 4c).
- **A page waiting at the name prompt** during a death can do one extra stamp and one removal when it enters (2.6–8.5 ms in all, once). HQ1-1's late-join captures show it; the capture on `a1d9cb9` does not (one stamp). Nothing is visible, and there is no churn after.
- **Receiver caps.** A wall face holds at most 12 stains, a room 48 and the level 160 (the remaster's caps; the oldest goes first). A corpse has at most 3 wall marks.
- **Remaster off:** no wall stain (by design; no screen-space substitute).
- **A busy page's first estimate of the light's anchor can be late.** It is corrected earlier as soon as the server's timing arrives: by 35–152 ms in the four complete lifecycle runs. The pages' final anchors then agree within 9.9–72.1 ms (the lifecycle runs), and the light's end within 1.2–18.3 ms (the timelines). On these SwiftShader pages the death's first frame appeared 0.33–1.80 s after a quiet observer received the server's message, and the light's end still agreed within 18.3 ms.
- **Real-time pictures of a short hold.** On this machine a short hold (3.1 s) often ends before the first real-time screenshot. The failure is shown with a frozen test clock; real time is covered by the per-frame record.
- **Test hooks.** `mp.js` reads the light's clock from `window.__deathLightNow` when a test defines it (to freeze the clock for pictures), and offers `window.__deathLight.debug()`. The game never defines the first or calls the second. Like anything in a page, a player could use them to change only their own screen; nothing reaches the server or another player.
- **Performance figures are software rendering.** No real GPU or phone was measured. The figures were measured on a slower machine than D6's, so compare HQ1 with D7 in the same session, not with older absolute numbers.
- **Carried over from D7, unchanged:** the server's larger resident memory, a reconnect being a new player, the Death Lab clock being local, the NEW RUN record not being tied to the vanish (`STAGE_3D_REPORT.md`).

## Security

- Tests and evidence use a synthetic passcode (`d3-synthetic-admin`), never the server's built-in default.
- The human-QA setup tells you to set your own passcode.
- Every file changed since the 3H0 parent was scanned before the pushes of HQ1-1 to HQ1-4 (`secret_scan.json` in their evidence): no credentials, personal addresses or private paths. HQ1-0's push has no scan record of its own; every later scan covers its files.
- The new fields are server-authored. A client cannot set or change a light profile or a corpse's wall marks (`light_net` H4; D7's death authority).
- No new vulnerability was found.

## Human QA

`STAGE_3D_HQ1_HUMAN_QA.md` lists every check and what you should see: A1–A10 for the wall, B1–B14 for the lights. Only you can say **HUMAN QA PASSED**.

**STAGE 3D HQ1 WALL BLOOD + DYING LIGHTS HUMAN-QA CANDIDATE — WAITING FOR USER**
