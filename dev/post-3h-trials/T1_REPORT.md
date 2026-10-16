# Post-3H Trial 1: the main menu's drift — report

```text
THE FAR BACKROOMS — POST-3H INTEGRATION TRIAL 1
STATUS: OWNER ACCEPTED — PASS / ACCEPT (owner's verdict of 2026-10-16, after Human QA); not merged, not deployed
BRANCH: post-3h-trials-1-2-4
BASELINE C5d: 4beba2f36deaf17473ad3b955eeefdd6fcfbd90b
REMOTE COMMIT / TREE / PARENT: 4a39b537aeb03bb86990652bfb05f25bc00dce00 / 5f5bdbe64bf5033ace15a7111a21baaa4cb06418 /
  ecbef39ea4facb91d5a0a4ba6f6d0d6b556b1a3a (T1-B 1 of 2, the code the verification ran on); receipt evidence/remote/verify_t1b_4a39b53.json
INTENDED CHANGES: the main menu's title drifts a few pixels on its own
UNINTENDED BEHAVIOR DELTAS: NONE VERIFIED
TEST RESULTS: full gate PASS, 29 of 29 steps at the first run (117.5 min, on a fresh clone of ecbef39); the drift check 11 of 11, its 8
  mutants caught; fast gate 20 of 20; clean checkout byte for byte; only the suite failures B++ has fail
PERFORMANCE: on the idle menu, the drift costs about 0.1 ms of script and 0.3 ms of style recalculation a frame here; the frame rate is
  unchanged within the A/A noise (headless, software-rendered)
SECURITY AND PRIVACY: no server, protocol, authentication or storage change; no secret; secret scans clean
HUMAN QA EVIDENCE: HUMAN_QA_T1.md; captures in evidence/t1/
ZIP, SHA-256, CHECKSUMS, RECEIPTS: THE_FAR_BACKROOMS_POST_3H_TRIAL_1_HUMAN_QA.zip (made from 4a39b53 by m8_package.js --trial 1),
  SHA-256 6ace0c9916d086701280f1e237e9806041a35e59754ed41dbb784b9cbf995da3, 32,407,740 bytes
PROTECTED BRANCHES VERIFIED: stage-3h-engine-modernization (C5d), main, stage-3h (3H2), stage-3e-0-bplusplus (B++) unchanged at
  every push; M8 and B++ ancestors
ROLL BACK TO: C5d 4beba2f36deaf17473ad3b955eeefdd6fcfbd90b
OWNER VERDICT REQUESTED: PASS / NEEDS CHANGES / ROLL BACK
STOP — NO MERGE, NO DEPLOY, NO SKIN-STEALER.
```

## What changed, on purpose

The owner's integration pack (2026-10-15) asks for the main menu to have "a subtle living/hovering movement even with the mouse
untouched", keeping the pointer's lean as a complement. That is the only change.

- **F.R.O.N.T.'s `ui.js`** (`src/frameworks/front/client/ui.js`, built into `public/assets/ui.js`): a drift for the title. Each axis is
  two slow sine waves (x: periods 21 s and 8.3 s; y: 13 s and 5.9 s) whose weights sum to 1, so the offset stays within -1..1. It is a
  function of the drift's own clock, so it is smooth and never random. One animation-frame loop runs it, and only while the boot has
  revealed the menu, the menu is shown, the tab is visible and motion is not reduced. Every change of those goes through one function,
  which starts the loop when it is not running and stops it otherwise, so a second loop cannot start. Reduced motion puts the title back
  where it rests and stops the loop; a hidden tab or a run pauses it where it is, and it resumes from there. The loop reads no layout and
  writes two custom properties on the title, only when they change. `window.__ui.drift()` reports its state for the checks.
- **`public/assets/ui.css`** (a static file): the title's transform adds the drift (`--dx` and `--dy` times `--drx` and `--dry`, 3 px
  each) to the pointer's lean (`--mx * 6 px`, `--my * 4 px`, as on C5d). While it drifts, the title is one cached layer
  (`will-change: transform`), on touch screens too.
- **Unchanged:** the logo file and how it is placed, every control, the text, the focus order, the boot gate, the menu music, the
  pointer's lean, `index.html`, the compiled client (its TypeScript and its record), the server, the protocol, every rate.

Why players in a run cannot see it: the loop stops the moment the menu is hidden, and the title is part of the menu.

## How it was checked

**Its own check** (`dev/tools/checks/menu_drift.js`; the gate's new full-tier step `menu`; in headless Chromium against C5d, each side
served by its own `node server.js` with a synthetic passcode). Two read-only observers are added before the page's scripts: a count of
the animation frames `ui.js` asks for (from the caller's stack, per frame) and a count of writes to the title's style.

| Check | What it requires | Result |
|---|---|---|
| static | the mouse never moved, 20 s: at least 10 distinct offsets in 41 samples, never more than 3 px on an axis, never more than 1.5 px between samples 0.5 s apart; one loop (one `ui.js` callback a frame); the pointer's lean untouched | PASS: 41 distinct offsets in 41 samples; at most 2.33 px (x) and 2.49 px (y); the largest step 0.42 px; one callback a frame |
| hidden | the tab hidden (simulated: `document.hidden` and `visibilityState` read as hidden, then `visibilitychange`): no frame asked for and nothing written for 2 s; shown again, it resumes within 0.25 px of where it was, one loop | PASS: nothing asked for or written while hidden; resumed 0.10 px from where it was; one loop |
| reduced | Settings → Reduced motion On: nothing asked for or written for 3 s, the title at rest (0 px); Off: it starts again from rest, once; ten quick switches still leave one loop; System with the device's preference changed while running: it stops, and starts again | PASS: nothing asked for or written while On, the title at 0 px; restarted once; one loop after ten switches; stopped and restarted with the device's setting |
| boot_os | a page that boots with the device asking for reduced motion (Settings at System): the drift never starts | PASS: never started (0 frames, 0 writes) |
| play | ENTER LEVEL 0: nothing asked for or written for 3 s in the run; back through pause → NEW RUN → END, it drifts again, one loop | PASS: nothing asked for or written in the run; back on the menu, drifting, one loop |
| pointer | the mouse moved to the upper right and held: the lean is C5d's (`--mx` 0.7, `--my` -0.5), the title keeps drifting around it, never more than 0.6 px between samples 0.1 s apart | PASS: lean 0.7, -0.5 on both; the largest step 0.16 px |
| layout | at 1920x1080, 2560x1080, 1366x768 at 1.5x and a 390x844 phone at 3x with touch: every visible control's box the same as C5d's to 0.5 px; the menu's text; the Tab order; the title at rest; no horizontal scroll; the drift within bounds | PASS at all four sizes (12 controls; 11 on the phone) |
| logo | the logo's bytes and `index.html`'s, as served, the same as C5d's | PASS (the logo's SHA-256 `906e19a8…` on both sides; `index.html` the same) |
| theme | the menu music's state after the gate, and the sound button after a press, the same as C5d's | PASS (playing, one play, one load on both; the sound button goes from on to off alike) |

**Its mutants** (each an edit of a copy of the candidate's built files; each must make one of the checks above fail): the amplitude
tripled (caught by static, play, pointer); reduced motion ignored (reduced, boot_os); a hidden tab ignored (hidden); a second loop on each
switch (reduced); no drift at all (static, reduced, play, pointer); a control moved 2 px (layout, at all four sizes); the run ignored
(play); the drift's clock reset at each pause (hidden): **8 of 8 caught**.

**Everything else: the modernization gate against B++.** `node dev/tools/gate/gate.js --tier full` on a fresh clone of `ecbef39` (T1-B 1 of 2, the code this checkpoint holds): **PASS, 29 of
29 steps at the first run, in 117.5 minutes** (`evidence/t1/gate_full/`). These are C5d's 28 and `menu`. The server traces equal B++'s,
except the lines about the files changed on purpose, which now include `ui.js` and `ui.css` (their bodies checked against the files);
the page traces, the sim, the page scripts, the protocol, the client's nine scenes frame by frame, two real players, the real-browser
checks, the browser contracts, the contact lab's 23 images and every suite are as at C5d (only the cases that fail on B++ fail:
`npm test` 13, `s_humanqa_hotfix` X03, `test_shadows` 5, `test_br_role` 3, `audit_net` 4, `audit_net2` 3); `perf` within its rules
(server: lifecycle +3.1 %, deaths -1.5 %, admin +4.7 %, schedule -6.2 %; `mp.js`'s hooks -1.9 % to +6.1 %). The fast gate on the
working tree before that commit: PASS, 20 of 20 (`evidence/t1/gate_fast_t1b1/`). This checkpoint's own tree adds documents, evidence
and two measurement tools only; the steps that read documents and files ran again on it: PASS (`evidence/t1/gate_quick_final/`).

**From a clean checkout.** `m7_clean_rebuild.js --ref ecbef39 --packages`: the build check passes; `--clean` removes 38 of 38 built files; `npm run build`
writes them again; 40 of 40 outputs identical to the commit's, `git status` clean; the compiled client, deleted and built again from its
TypeScript with the 31 packages, 3 of 3 files byte for byte (`evidence/t1/clean_checkout.*`).

## Performance

`dev/post-3h-trials/tools/t1_menu_perf.js`: the idle main menu, C5d against the candidate, 6 rounds a size, the order alternating,
10 s each, the mouse untouched; then the same with C5d against a copy of itself (A/A), to show the noise (`evidence/t1/perf_ab.*`,
`perf_aa.*`). Paired medians, with the range over the rounds:

| | 1920 x 1080 | A/A | 390 x 844 phone, 3x | A/A |
|---|---|---|---|---|
| frames a second | 2.12 → 2.12 (-0.02; -0.05..+0.03) | +0.03 (-0.15..+0.09) | 4.64 → 4.66 (+0.01; -0.44..+0.24) | +0.16 (-0.16..+0.39) |
| 95th percentile frame | 533 → 517 ms (-8; -17..+50) | 0 (-83..+67) | 250 → 250 ms (-8; -33..+50) | -17 (-33..+33) |
| the drift's own script | 0.25 ms/s (0.10 ms a call) | 0 | 0.46 ms/s (0.09 ms a call) | 0 |
| style recalculation | 0.52 → 1.13 ms/s (+0.60; +0.56..+0.73) | -0.02 (-0.10..+0.03) | 1.25 → 2.56 ms/s (+1.29; +1.12..+1.39) | -0.16 (-0.44..-0.02) |
| all main-thread script | +3.9 ms/s (-0.4..+7.0) | +0.7 (-6.1..+8.0) | -0.03 ms/s (-2.9..+1.2) | -1.5 (-3.3..+0.2) |
| all tasks | +1.2 ms/s (-15..+25) | +0.4 (-26..+7) | +0.6 ms/s (-1.5..+4.3) | -2.5 (-10.7..+2.6) |

- **The drift has a measurable cost, and it is small:** its own callback, about 0.1 ms a frame, and the style recalculation of the
  title, about 0.3 ms a frame here (+0.6 and +1.3 ms a second, outside the A/A's range). No layout runs (0 on both sides).
- **The frame rate and the frame times are unchanged** within the A/A noise. Here the menu draws only 2 to 5 frames a second, because
  the world the game keeps drawing under the black field costs most of each frame in a software renderer.
- **A real machine draws many more frames a second, and the drift runs once a frame**, so its cost a second grows with the frame rate;
  on a real CPU each frame's share should be far smaller than here. That is not measured here: smoothness and battery on real hardware
  are in the Human QA page.
- If it should cost less, the loop can write at most 30 times a second: the drift moves at most about 2 px a second, so the steps would
  stay far below a pixel. Not done: it would be a change after this verification, for the owner to ask for.

## Security and privacy

- No server file, protocol message, authentication, lockout, storage or production setting changed. The admin passcode's default and the
  lockout's identity source are the known separate issues (not touched; not ready for public deployment until a separate approved
  security change).
- The checks use a synthetic passcode of their own and never log in.
- Nothing is stored or sent by the drift. The page's static files are served as before; no new path is served.
- Secret scans: each commit's changes before it, and each commit after it (`evidence/t1/`).

## Rollback

- **Trial 1 as a whole:** C5d `4beba2f36deaf17473ad3b955eeefdd6fcfbd90b`, untouched on `stage-3h-engine-modernization`.
- **Only the drift, keeping the branch:** revert the two runtime files (`src/frameworks/front/client/ui.js` then `npm run build`, and
  `public/assets/ui.css`) to C5d's.
- `main`, M8, B++ and 3H2 were never touched.

## Limits

- The checks ran in headless Chromium with SwiftShader on a 2-CPU machine: no physical GPU, real phone or real battery. The menu draws
  about 2 to 5 frames a second there, because the world the game keeps drawing under the menu's black field costs most of each frame.
- The hidden tab is simulated (the page's own event, with `document.hidden` read as hidden); a real hidden tab gets no animation frames
  at all, which the browser enforces.
- How the drift feels is the owner's to judge (`HUMAN_QA_T1.md`), and so is whether 3 px is the right size.
