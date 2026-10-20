# THE FAR BACKROOMS — Pre-Trial 3 final presentation and quality polish

Branch `pre-trial3-final-polish`, created from the owner-accepted C5 `63805e98867c3677261307b8cd597f63592b8c45` (tree
`60e4452bb90c3a9650022dcdae9c2a225c356a8d`) after reading back every protected head (`PLAN.md`). Final checkpoint: **P9**, the commit
that adds this report; a commit cannot name its own hash, so P9's is in its remote receipt and the handoff. Its game code is P8's
(`7f91ffd`). Checkpoints and receipts: [`CHECKPOINTS.md`](CHECKPOINTS.md), [`evidence/`](evidence/).

**Status: ENGINEERING COMPLETE — AWAITING OWNER HUMAN QA** ([`HUMAN_QA.md`](HUMAN_QA.md)). Nothing merged or deployed. `main`, Stage 3H, the Trials 1–2–4 branch, the
closed Trial 4 branch, R4 and C5 are untouched (every push receipt checks them). Trial 3 (Skin-Stealer) not started. Red Rooms
untouched. No account system, no new dependency, no borrowed audio.

## What changed for players

1. **Danger and death (P1).** Near a monster the screen no longer flashes bright: the darkness overlay (`#light`) is held at full
   opacity over the core dread hook's random opacity flicker, which lifted the darkness off the whole scene (and showed what lay behind
   walls). The heartbeat, the red edge vignette, the shake, the drone and the stings are as before. A capture now shows **one** red
   impact (1.25 s, never white), then Trial 4's dim red vignette; under reduced motion a slower 1.9 s red rise and fade with no flash.
   The capture sound plays once per capture (it had replayed on every later class change while caught).
2. **The spawn shadow (P2).** The dark oval the compiled client draws for a wanderer's fall into the level sat in a layer above her and
   covered her body and hands. BR-RoLE now draws that layer under her while she falls (and puts it back after), and her cast and
   self-shading follow the size she is drawn at, for her and for other wanderers — on Low, Medium and High.
3. **The menu's rail (P3).** The person icon is now **Account**: it opens a small "Accounts Coming Soon..." panel (Close, Escape, a
   press elsewhere; focus returns), never Customize — Customize stays under PLAY. The Settings gear is redrawn as a regular, centred
   eight-tooth gear.
4. **Exact colours (P4).** Every Red, Green and Blue (Body, Hands, Beam, HUD — every colour field the game has) has a number you can
   type, 0–255, beside its slider: committed on Enter, on leaving the field or with its arrows; clamped; anything else put back; Escape
   puts back without closing the panel. The browser's colour pop-up is no longer the way in ("Custom" and the HUD's rainbow swatch go to
   the Red number). Saving and what other players see work exactly as before.
5. **One version (P5).** The menu's "v23.3.6" now comes from `package.json` (built into `public/assets/version.js`); the hand copy in
   the credits data is gone and the build fails if the two ever disagree. The number is unchanged — the next one is the owner's call.
6. **Credits (P6).** RoYoshi (Lead Developer, Programmer, Graphic Designer) in neon green and Mariikyu (Lead Developer, Creative
   Director, Head of QA, Sound Designer) in neon purple. The small wiki / CC BY-SA 3.0 paragraph left the menu's corner and is in
   Credits → Source material with every link it had (and the page's own), saying the material is adapted with changes. Credits ends
   with the version.
7. **Interface sounds (P7).** Seven short, quiet, original placeholder sounds — hover, click, back, switch on, switch off, panel open,
   "not yet" (the Account button) — one per press, never doubled; hover throttled. Asset list: [`SOUND_ASSETS.md`](SOUND_ASSETS.md).
8. **Music and UI volume (P8).** Settings → Sound gains **Music volume** (the menu music) and **UI volume** (the interface sounds),
   0–100 %, saved with the other settings, under Master volume and SOUND ON/OFF; Wanderer voices and Voice volume unchanged.

## How it is built (P7, P8)

- **One audio context for the menu and the interface.** The menu theme's own context (ui.js, made at the boot gate) now has three
  gains: `music → music gain (0.7 × Music volume; its fades) → master (Master volume, 0 while SOUND is off) → speakers` and
  `interface sounds → UI gain (UI volume) → master`. No other context is made for the sounds; the wanderers' voices (`voice.js`) and
  the game's own sounds keep their own graphs, as in C5. The context sleeps when nothing plays and wakes on a press.
- **One listener.** A capture-phase listener on the menus and panels decides, from the state before the press, which one sound a real
  press makes; a 90 ms rule lets only a weightier sound follow another; hover ticks at most every 70 ms and once per control; a
  script's `click()`, typing, sliders and the chats make none; nothing plays while SOUND is off, the UI level is 0 or the tab is
  hidden. Escape that closes something says "back" (a listener ahead of the modal key handler counts what is open).
- **Saved settings.** `fb_settings_v1` gains `music` and `ui` (0..1, default 1); saves from before read 100 %.
- **Replaceable sounds.** Same-named files in `public/assets/` replace the placeholders; `tools/ui_sounds.py make` re-creates them
  exactly (`SOUND_ASSETS.md`).

## Decisions for the owner

- **The version number.** Players see `v23.3.6` (package.json's `23.3.6-hqa-search-polish`). It was not changed: choose the next number
  and it is one edit of `package.json` plus `npm run build`.
- **Mariikyu's spelling.** Plain "Mariikyu" is used; the stylized form the pack mentions (ₘₐᵣᵢᵢₖᵧᵤ) is not. Say if you want it.
- **The two credit colours** (#5cff8a, #c58cff) — no earlier hex existed for either developer.
- **The placeholder sounds** — their character and loudness need ears (Human QA Part D); Mariikyu can replace any file.

## Results

Every defect was reproduced on C5 (or on the checkpoint before) with the same check that then passed on the fix. All runs are headless
Chromium with SwiftShader in the cloud workspace, every name and passcode synthetic; the details are in each checkpoint's
`evidence/pN/STEPS.txt`.

| Checkpoint | Before | After | Sensitivity | Gate steps on that checkpoint |
|---|---|---|---|---|
| P1 danger / death | `vfx_probe` on C5: FAIL 9 of 17 | PASS 17 of 17 | — (a probe with a verdict) | fast tier 21 of 21; `cli_golden` PASS (B++'s core untouched) |
| P2 spawn shadow | `spawn_probe` on P1: FAIL 12 of 21 | PASS 21 of 21 (Low, Medium, High; a peer) | — | fast tier steps PASS; port and bundle 9 of 9 identical; contact_lab 23 images identical to B++ |
| P3 rail | the Account cell opened Customize | `menu_rail_check` 23 of 23 at four sizes | 5 of 5 mutants | menu 11 of 11 against C5d (8 of 8 mutants); scope, docs, contracts, srv_golden, raw_live |
| P4 RGB | `rgb_browser` on C5: FAIL 4 of 16 | PASS 16 of 16 | 11 of 11 mutants | scope, docs, contracts, srv_golden, raw_live |
| P5 version | `version_check` on C5: FAIL 1 of 5 | PASS 5 of 5 | a changed package.json caught | build, lineage, parts, modules, contracts, docs, scope, srv_golden, static, raw_live, page, cli_golden |
| P6 credits | `credits_check` on C5: FAIL 2 of 8 | PASS 8 of 8 | bogus accents drawn plain (its own case) | menu 11 of 11 against C5d (8 of 8 mutants); scope, docs, contracts, srv_golden, static, raw_live, page |
| P7 sounds | `ui_audio_check` p7 on C5: FAIL 0 of 3 | files 7 of 7; page 6 of 6 | 6 of 6 mutants | menu 11 of 11 against C5d, the theme unchanged; scope, docs, contracts, srv_golden, static, raw_live, page |
| P8 volumes | no Music / UI slider on C5 | PASS 11 of 11 | 8 of 8 mutants | scope, docs, contracts, srv_golden, static, raw_live, page |

### P9 — integration on the final game code (P8's `7f91ffd`, with P9's gate bookkeeping) — `evidence/p9/`

P9 changes no game code. It fixes one piece of gate bookkeeping P4 left behind: the full-tier `rgb` step still expected the RGB check
to have 6 mutants, and P4 gave it 11 — `dev/tools/gate/gate.js` (and the two tool READMEs) now expect and describe 11.

| Check | Result |
|---|---|
| `npm run build:check` | PASS — 43 outputs and the manifest are what `src/` builds |
| `docs.js --check` | PASS — 23 generated blocks |
| The gate's fast tier (21 steps: build, port, lineage, parts, modules, contracts, docs, scope, srv_golden, bpp_golden, session, sim, page, cli_golden, protocol, mutants, static, raw_live, quick_suites, bundle, chat) | PASS 21 of 21 (830 s) |
| `vfx_probe` (P1) | PASS 17 of 17 — no bright flash near a monster, one red impact, calm under reduced motion, one capture sound |
| `spawn_probe` (P2) | PASS 21 of 21 — the arrival shadow under her on all three tiers; a peer's cut-out at its drawn size |
| `menu_rail_check` (P3) | PASS 23 of 23 |
| `rgb_browser` (P4) | PASS 16 of 16 |
| `version_check` (P5) | PASS 5 of 5 — the menu reads `v23.3.6` from `package.json`; a stale copy is caught; no hand copies |
| `credits_check` (P6) | PASS 8 of 8 — both developers, their colours, every C5 link, the corner clean at four sizes, keyboard, phone |
| `ui_sounds.py check` (P7) | PASS 7 of 7 — the recipe and the files match `SOUND_ASSETS.json` |
| `ui_audio_check` (P7 + P8) | PASS 11 of 11 — one sound per press, hover spacing, quiet cases, one context; the volumes' routing, smoothness, persistence, old saves |
| C5's chat and voices: `chat_voice_browser` (no mutants) | PASS 69 of 69 (877 s) — the chat icon, the key, typed-out bubbles and voices, unchanged by P7–P8's listener and Settings rows |
| The gate's menu step (main menu, title drift and theme against C5d) | PASS — 11 of 11 against C5d at four sizes (the theme included), 8 of 8 mutants (1461 s) |

**Not run, and why.** The multi-hour full modernization gate (as the pack directs; its remaining full-tier steps — browsers, workflow,
chat_browser, chat_voice with mutants, rgb with mutants, contact_lab, suites, perf — cover code this stage did not change, or were run in
the targeted form above). No real GPU, phone, speakers or screen reader: how the effects look, how the sounds sound and feel against
the music, and touch / screen-reader use are for the owner's Human QA. The external links in Credits were not opened from the workspace
(it cannot reach those sites); their addresses are C5's own. No performance measurement: nothing here runs per frame except P1's CSS
(a static override and one 1.25 s animation at a capture) and P2's layer swap during the 1.35 s fall.

### Remote and protected refs

Every checkpoint was a normal fast-forward push of `pre-trial3-final-polish` only, read back from GitHub by
`tools/verify_remote_p.py` (tip, tree, parent; one straight line from C5; `main`, Stage 3H, the Trials branch, Trial 4, R4 and C5
unchanged; no other branch moved or new) — receipts in `evidence/remote/`. Each commit was scanned for secrets before and after its
push (all clean).

| Checkpoint | Commit | Tree |
|---|---|---|
| P0 | `7dbeda83d79d08617695f8ec6f268c32325daaa6` | `a4381694abe4ce302c052b8e041b5f6a426c1631` |
| P1 | `d8cdc007d4b7782a2463b3a639589f1a39123968` | `b50f751f7ca6697871902686bfe6a6a36777abac` |
| P2 | `4b9688b2132a1ee378f8978a9ee8f8c2acaf2b81` | `be8fac0c5e09f4bc4ca085735fe9261c97024196` |
| P3 | `1721c73021c0dfad3103c7bb855b58c8211593bd` | `eca9c4b4be13ef2ccb68edb1eebb4de468c3a09d` |
| P4 | `53bd4055b658d5ffc05de1900d774ac17a82e1ba` | `9ea93d9a772c2d560c4377bc96a95f1c03ea878e` |
| P5 | `b4fa969cb1323c97747be48e6bb3f60671c8488c` | `3f3bb30143c901eb59312423fcbc64ae9d6c21d9` |
| P6 | `1d7902bbeade276fb148572425310bed6c08f3fe` | `5dbe93fac940b97d9259633886181cc00f78ded9` |
| P7 | `e761dbb6a979c3026d107f8bfd3752e2813f3b8b` | `dd91b9d14c9ad36223b9ac81717576bbfbb1a8d4` |
| P8 | `7f91ffdfcf4b31fe405efc423965d54b0b94dbd5` | `bd27bcfef300dbbf0ab622d6299d168d5504d725` |
| P9 | this commit (its receipt and the handoff) | |

Protected heads, unchanged throughout: `main` `7781e1a`, `stage-3h-engine-modernization` `4beba2f`, `post-3h-trials-1-2-4` `58fcf5b`,
`trial-4-rgb-chat-accessibility` `518b990`, `post-trial4-review-polish` `1a89863`, `post-trial4-chat-voice-polish` (C5) `63805e9`.

**Rollback.** Any checkpoint's row in `CHECKPOINTS.md` names the one before it; the whole stage rolls back to C5 by not using this branch
(`git checkout 63805e9`) — nothing protected was changed, so nothing else needs undoing.

## Incidents

- **A stray local commit (P4, never pushed).** A scratch copy of the working tree, made to prepare P5–P8 while P4's mutants ran, carried
  the worktree's `.git` pointer file; `git init` / `git commit` meant for the copy wrote one commit onto this worktree's local branch.
  Found at once; the remote was unchanged; the local branch was moved back with `git reset --mixed` (index and branch only — every
  working file kept); the copy got its own repository. `evidence/p4/STEPS.txt` has the details.
- **Long runs stopped from outside.** Container restarts twice stopped P4's RGB mutant run; the second time 10 of its 11 mutants had
  been reported, and the 11th was run with the base checks (`--mutant-ids`, added for this) — both parts are in `evidence/p4/`. At
  P7 the command running the gate's steps reached its own 30-minute limit during the menu step, after the other steps had passed; the
  menu step was run again alone (`evidence/p7/`).
- **Checks corrected while being written, never weakened to pass.** At P6 a comment cut a declaration short in `credits_check.js`
  (it crashed; fixed, then run on P6 and C5). At P7 a mutant escaped because Chromium merges fast pointer moves into one per frame —
  the hover spacing is now tested with a burst of Tab presses; the context case first counted the game's own context, made by
  `mp.js` on the first press as on C5, and now counts the menu's. And the audio check, while being written, found a real flaw before P7
  was committed: an idle gain node is not processed, so a click right after a UI volume change started at the old level — the UI gain
  is now set at once while nothing sounds through it.
