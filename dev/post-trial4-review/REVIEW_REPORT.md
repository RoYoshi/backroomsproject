# THE FAR BACKROOMS — Post-Trial 4 engineering review and polish

Branch: `post-trial4-review-polish`, created from Trial 4's closed head `518b99021b601963cfe0ee79e9bfd2cccd2f3748` (tree
`72e60eb7b68a8dc3d2f735599d8ab828fc21691e`), after confirming that the remote head and tree matched.
Final checkpoint: **R4**, the commit that adds this report. A commit cannot name its own hash; R4's hash is in its remote receipt and in the handoff. Its game code is R1's (`0542327`). Checkpoints and receipts: [`CHECKPOINTS.md`](CHECKPOINTS.md), [`evidence/`](evidence/).

**Status: review and corrections complete — awaiting the owner's Human QA.** This is a review of Trials 1, 2 and 4, not a feature trial:
no gameplay was added, no engine work restarted, Trial 3 not started. Nothing merged or deployed; `main`, Stage 3H, B++, the Trials 1–2
branch and the closed Trial 4 branch are untouched (every push receipt checks them).

Trial 4 remains **closed by the owner's validation waiver**. Nothing below turns that waiver into a pass for 518b990. The results here
are for this branch's commits, as run in this cloud workspace, and are labelled PASS, FAIL, NOT RUN or WAIVED.

## How the review was done

- Read: `T4_REPORT.md`, `HUMAN_QA_T4.md`, `TRIAL_4_CHECKPOINT_STATUS.md`, `CHECKPOINTS.md`, `docs/architecture/CHAT.md`,
  `src/build-recipes.json`, the F.R.O.N.T. and B++ module notes, and every file Trial 4 changed (`git diff 58fcf5b 518b990`: 18 files,
  of which 9 are game code).
- Reproduced in real pages: headless Chromium (SwiftShader) against the real server, with synthetic names, lines and passcodes. Two
  players were placed in one room using the admin tools (world frozen, players protected), plus a phone viewport.
- Measured: the fast gate and the menu step on a fresh clone of 518b990 as committed (the baseline); the chat's per-frame hook with
  the existing `t2_client_perf.js` against Trial 2's `58fcf5b`.
- `generated/BUILD_MANIFEST.json`: the Codespaces rebuild the brief mentions was never pushed and is not in this workspace. The manifest
  was rebuilt here from the branch's own sources and compared entry by entry. It differs from the committed one only in Trial 4's three
  built outputs (`assets/chat.js`, `assets/rgb.js`, `mp.js`) and the recipes' hash.

## Findings, by severity

### High

**H1 — The RGB sliders never followed their colour, and using them could overwrite the saved colour with a wrong one.** Fixed in R1.
`src/frameworks/front/client/rgb.js`, `sync(picker)`: the group is looked up with `picker.parentElement.querySelector('.rgb-trio')`.
But `mount()` inserts the group *after* the picker's `<label>`, or after `#stSw` for the HUD, so `parentElement` is the label or
the swatch span and the lookup always returns null. As a result:
- the sliders kept the values they were built with, which is `#000000` (0/0/0), because rgb.js runs before the game sets the saved
  colours;
- a swatch, Reset HUD or the saved colour never moved them;
- the numbers never changed, not even while dragging.

Evidence (`evidence/r1/STEPS.txt` §2): the body picker was `#ffcc77` with sliders at 0/0/0. After the `#f3dcb2` swatch, pressing
Red +5 on the keyboard **saved `#05dcb2`**: the stale red slider (0) replaced the colour's red channel (0xf3). That saved colour is
what other players see. On the HUD, Reset HUD set the setting to Default while the picker and sliders kept the old colour.
Fix: each group is kept with its picker in a map; `current()` is the colour in effect (the picker's, or for the HUD the Default
swatch's colour when the setting is `''`). Sliders and numbers are refreshed on the picker's events, after any click (swatches and
resets set the picker without an event), when a group comes into view, on focus or pointer-down before use, and at `load`. A slider
step changes only its own channel of the colour in effect. Unchanged: the save keys, the event contract and the API.
New check `dev/tools/checks/rgb_browser.js`: PASS 14 of 14 on the fix, FAIL 2 of 14 on 518b990, 6 of 6 mutants caught.

**H2 — The committed Trial 4 branch fails its own build check.** Fixed in R1. On a fresh clone of 518b990, `npm run build:check`
gives FAIL (1 of 42): `generated/BUILD_MANIFEST.json` differs from what its sources build, because the manifest rebuilt in Codespaces
was never pushed. The rebuilt manifest is committed, and the diff above confirms nothing else was in it.

### Medium

**M1 — Trial 4's gate bookkeeping was incomplete, so the fast gate and the menu step failed for reasons unrelated to how the game
behaves.** Fixed in R1. Baseline on 518b990 (`evidence/r1/baseline_518b990/`): fast gate FAIL, 18 of 21 steps passed.
- `build`: the stale manifest (H2).
- `docs`: 4 generated blocks stale. Trial 4 added a file without running `docs.js`.
- `scope`: "declared as added but not: src/frameworks/front/client/rgb.js", a source file declared as a runtime file.
- `menu`: 10 of 11 checks, failing only on index.html's bytes, because Trial 4's two page edits were never listed as allowed.

Trial 4 had also replaced Trial 2's descriptions of `assets/chat.js` and `speech.js` instead of appending to them.
Fixes:
- the blocks are regenerated;
- the declaration is corrected and Trial 2's descriptions restored, with Trial 4's text appended;
- `menu_drift.js` now removes exactly the RGB script tag and the label. This was checked: the current page becomes C5d's byte for
  byte, and C5d's page is unchanged by the normalisation.

The final full gate found a fifth such check: `live_wire` compares the pause button's refused label with B++'s, and
reported `Spontaneously Combust? · WAIT N S` against `NEW RUN · WAIT N S` while every recorded behaviour was identical. Fixed in R3
(`dev/stage-3h/golden/live_wire_h2.js`): only the label's leading words are mapped; the refusal's words and every menu state are still
compared, and a changed refusal message still fails. No check was relaxed.

**M2 — The RGB sliders' layout.** Fixed in R1 (`public/assets/ui.css`).
- In Customize, the game's `.appearance-fields input` rule (42 px tall, margin, padding, border, field background) also applied to
  the range inputs, so each slider row was about 57 px tall in a bordered box.
- In Settings, `.us-row output` (min-width 44 px) overflowed the 33 px number column, so the values ran into the group's right border.
  This was visible at 1280×720 and on a phone.

Screens: `evidence/r1/rgb_probe/`.

**M3 — The chat's per-frame hook got about 8× more expensive.** Fixed in R1. Trial 4's hint calls `canSpeak()` every frame (up to
3 times on touch screens). Its open-sheet test runs `document.querySelector('.ui-sheet:not([hidden])')`, a whole-document search,
each frame. With no bubble, cost per frame went from 0.015 ms (Trial 2, 58fcf5b) to 0.117 ms (518b990), and to 0.043 ms after the fix:
`canSpeak()` is now asked once per frame and the sheets are read from a live `getElementsByClassName` list, with the same answer. The
remaining difference is the hint's genuine eligibility test. Frame pacing stayed within the tool's noise throughout
(`evidence/r1/chat_hook_perf/`).

**M4 — Reduced motion does not stop the script-driven screen effects. Not fixed: needs an owner decision.** This predates Trial 4.
- In `src/core/client/mp.frame.js`, with an entity near (dread `k`), the whole game layer shakes by random offsets every frame
  (`k > .55`).
- The light layer's opacity drops randomly on individual frames (`k > .35`, up to about 9% of frames).
- The dread vignette pulses.

None of these check `html.rm`, but the Settings text promises that reduced motion stops "the screen effects' animation". Trial 4
removed the CSS flashes only. Recommendation: skip the shake and the flicker (and steady the pulse) under `html.rm`. This changes
the horror presentation and lines of `mp.js` whose provenance the gate records (`c3c_mp_provenance.js`), so it belongs in its own
owner-approved change, not in this polish.

**M5 — `docs/architecture/CHAT.md` described the old protocol.** Fixed in R2. It said only `text` is read from `say` and listed
`heard` without the colour. It now documents `c` (the strict `#RRGGBB` rule, `''` otherwise), older pages, the Enter hint and the
bubble accent.

### Low

- **L1 — Accessibility details.** Fixed in R1. The Enter hint carried an `aria-label` on a `<p>`, which ARIA does not allow (its
  visible words already name it). Each slider's `<output>` is an implicit live region, so every step would have been announced twice;
  it is now `aria-hidden`, since the slider announces its own value.
- **L2 — Very dark speaker colours make a bubble's border, tail and edge arrow nearly invisible.** Not fixed. The text stays cream on
  the dark bubble and remains readable. The sliders make any colour easy to pick, so a client-side minimum lightness for the accent
  only (not the HUD) would be a small future polish.
- **L3 — Default HUD colour sends `''`.** The bubble then uses the neutral `#e3c768` rather than the HUD Default's `#f3e7a7`. This is
  cosmetic and by design (no colour is invented for a player who has not chosen one). Not changed.
- **L4 — The Enter hint shows and the composer opens while the inventory drawer (Tab) is open.** The drawer does not pause, and
  `canSpeak()` does not consider it. This is Trial 2 behaviour the owner approved, so it is left as is and listed for Human QA.
- **L5 — The README still described the Trials 1–2 branch with Trial 2 "in progress".** Fixed in R1.

### Verified, no change needed

- **Server colour handling** (`src/frameworks/bpp/server/speech.js`):
  - `c` is accepted only as `/^#[0-9a-fA-F]{6}$/`, lower-cased, and `''` otherwise.
  - Who hears is unchanged: same room, alive, within 576 px.
  - A spoofed `id` or room is ignored.
  - The client checks the colour again before putting it in a CSS variable.
  - Old clients work both ways.
  - The chat step passed: 83 of 83 cases, 13 of 13 mutants (on 518b990 and again in the final gate).
- **The Enter hint** appears only when eligible. In a two-player run it was hidden on the menu, while composing, while paused and in
  Customize, back after Resume, and never shown on a phone (SAY is shown instead). The listener's bubble used the *speaker's* colour
  (`#8dff9f`), not its own.
- **"Spontaneously Combust?"** is presentation only: one text node in `index.html`. NEW RUN's request, authority, cooldown, denial,
  world epoch and corpse rules are untouched (no Trial 4 change outside the label). `nrButton()` keeps the label in `data-label`, so
  cooldown and denial messages return to it. CSS upper-cases it; it fits at 1280×720 and on a phone.
- **Capture and glitch CSS:**
  - the capture overlay is a static low-luminance vignette (the inline `flashout` keyframes are overridden);
  - the tear overlay and the exit animation are static and dimmed;
  - reduced motion also removes the logo's fade;
  - Trial 1's title drift is intact (the menu step's drift checks pass on 518b990 and in the final gate).
- **rgb.js's MutationObserver** stays connected until Settings is first opened, about 3.8 callbacks a second in a run, each a few
  `getElementById` calls. Negligible; left as is.
- **No new dependency.** No change to the server's rates, rooms, authority, admin authentication, secrets or deployment.

## What changed (R1–R4)

See [`CHANGED_FILES.md`](CHANGED_FILES.md) for every file with its reason.

## Results

Labels: **PASS** = ran to completion and held; **FAIL** = ran and did not hold; **NOT RUN** = not run here; **WAIVED** = the owner's
Trial 4 waiver. Everything ran in this cloud workspace: headless Chromium with SwiftShader, Node 22.22.2.

### The final code

The game code is unchanged since R1 `0542327`. R2–R4 change only documents and one development check.

| Check | On | Result |
|---|---|---|
| `npm run build` / `npm run build:check` | fresh clones of R2 and R3 | **PASS**: 41 outputs, the manifest matches |
| Full-tier gate, fast tier (21 steps: build, port, lineage, parts, modules, contracts, docs, scope, goldens, session, sim, page, cli_golden, protocol, mutants, static, raw_live, quick_suites, bundle 9 of 9 scenes, chat 83 of 83 with 13 of 13 mutants) | fresh clone of R2 `a3b508c` | **PASS**, 21 of 21 |
| cli_mutants (35 of 35), bpp_checks, workflow (22 of 22, browser contracts 8) | R2 | **PASS** |
| browsers (two_browser, col_head, col_aside, gameplay_smoke) | R2 | **PASS**. gameplay_smoke passed on the gate's own built-in re-run, after its first run's player was killed by a Smiler before the script cleared the monsters |
| menu: Trial 1's drift against C5d (11 checks) and its 8 mutants | R2 | **PASS**, 11 of 11, 8 of 8 |
| **chat_browser**: Trial 2 and 4's chat in Chromium, 40 cases including Trial 4's hint and speaker-colour cases, 7 mutants | R2 | **PASS**, 40 of 40, 7 of 7. The first complete browser-suite pass for Trial 4's chat code, as corrected here |
| **rgb** (new): the RGB sliders, 14 cases and 6 mutants | R2 | **PASS**, 14 of 14, 6 of 6 |
| live_wire | R2 | **FAIL**: one difference, the renamed button's words (M1). Corrected in R3 |
| live_wire | fresh clone of R3 `c07cee2` | **PASS**: structurally identical in every phase |
| contact_lab | R3 | **PASS**: 23 of 23 images identical in pixels |
| suites | R3 | **PASS**: only the known B++ failures fail |
| perf | R3 | **PASS**: within the gate's bounds (lifecycle +8.91%, deaths −1.54%, admin −4.24%, schedule +6.26% against B++; noisy here, and no server code changed in this review) |

Every one of the 32 full-tier steps has passed on the final code. They ran as two runs on fresh clones of R2 and R3, because this
workspace stops a background job after 2 hours. The R2 run reached 29 steps before the stop; the 4 remaining steps (live_wire again,
contact_lab, suites, perf) ran on R3. The game code of R2, R3 and R4 is identical. Evidence: `evidence/r3/`, `evidence/r4/`.

### Before and after the review

| Check | Trial 4 head `518b990` | This branch |
|---|---|---|
| `npm run build:check` | **FAIL**: stale manifest | **PASS** |
| fast gate | **FAIL**, 18 of 21: build, docs, scope | **PASS**, 21 of 21 |
| menu step | **FAIL**, 10 of 11: index.html | **PASS**, 11 of 11 |
| rgb_browser.js | **FAIL**, 2 of 14 | **PASS**, 14 of 14 |
| chat hook, idle, per frame | 0.117 ms (Trial 2: 0.015) | 0.043 ms |
| chat_browser, the full gate | **NOT RUN** on 518b990 by this review; **WAIVED** by the owner for Trial 4 | **PASS** (above) |

### Not run, or not covered

- **NOT RUN:** a real GPU, a real phone, a screen reader, a long play session, and cross-browser runs (only Chromium).
- **NOT RUN:** a release ZIP. None was asked for, and nothing here is to be deployed.
- The owner's Human QA: **pending** (`HUMAN_QA.md`).

## Rollback

| To undo | Do |
|---|---|
| everything in this review | use `518b990` (`trial-4-rgb-chat-accessibility`, untouched) |
| the reports and the last evidence | `git checkout c07cee2` (R3) |
| the live_wire correction | `git checkout a3b508c` (R2) |
| the CHAT.md update | `git checkout 0542327` (R1) |

Rollback is by checking out or branching from an earlier commit; no history is rewritten.

## Remaining risks and recommended future work

1. **M4**: reduced motion should also stop the shake, flicker and pulse in `mp.frame.js`. Needs owner approval of the presentation
   change and a provenance update.
2. **L2**: a minimum lightness for bubble accents.
3. **Not measured here:** a real GPU, a real phone, and a screen reader. The pages were drawn by SwiftShader at about 1–4 fps, and
   screen-reader behaviour was judged from ARIA semantics only.
4. Photosensitivity: Trial 4's CSS is gentler, but the canvas glitch walls still flash locally (about 12 Hz in small areas), and M4's
   light flicker is unchanged. This review gives no medical or certification claim.
5. The rgb.js observer could disconnect earlier. That is not justified now (measured negligible).
