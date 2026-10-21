# Trial 3 behaviour refinement — changed files

Every file that differs from the Trial 3 head (`trial-3-skin-stealer`, `020b5b5`). Built outputs (`generated/`, `public/`) are what
`src/` builds (`npm run build:check`: PASS, 44 outputs); none was edited by hand. Every runtime difference is declared in
`dev/tools/gate/declared_changes.json` (the fast gate's scope step: PASS). `git diff --stat 020b5b5..` lists 8 files outside
`dev/trial-3-behavior-refinement/`.

## Game

| File | Checkpoints | What changed |
|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` (source of the Skin-Stealer part of `generated/server/ai.js`) | B1, B2, B3 | `SK` gains the proposed values (`BALANCE_TABLE.md`). New: `skAware` (per-person awareness records from seen bodies only: pressure by kind with ceilings, blame, fading, tiers), `skAttend` (look, look at a sound, warn: only while it roams or leaves, never in a skin), `skReact` / `skReactEnd` (the reaction's motion and its end: another way out), `skWarn`, `skGaze` (head toward a noticed person while walking), `skCornered`, `skDefend` (the defence's conditions, withdraw or strike from its own seeded stream `skinstealer-aware`), `skAwTop` (debug). Changed: `skLeave` split into `skLeave` + `skLeaveGoal` (same draws, same order); `skDecide` keeps a departure but lets a very hungry one be thought over on fresh sight, and leaves fast after a missed defence; `skSpring` / `skStrikeStep` know the style `defend` (its wind-up, lunge, cost; it can catch only its person; hit / miss counts); the leave step runs at its tired speed when `P.fast`; `skinTick` calls aware → defend → decide → attend on a think; `init`, `onFar`, `onClear` set up and clear the new state; `skDebug` adds `aw`, `awN`, `rx`, `lv`, `df`; the header comment describes the refinement |
| `generated/server/ai.js` | B1, B2, B3 | built from the above (`npm run build`) |
| `src/frameworks/overseer/client/ents.debug.js` (source of the debug part of `public/ents.js`) | B1, B3 | two admin debug-overlay lines, AWARE and DEFENCE, drawn only with the debug overlay on and only from the server's admin debug data |
| `public/ents.js` | B1, B3 | built from the above |
| `generated/BUILD_MANIFEST.json` | B1, B2, B3 | the build's record of the two outputs' new hashes |
| `dev/tests/s_skinbehave.js` (new) | B1, B2, B3 | the behaviour scenarios BR01–BR17, BR19, BR20 (19), each on the real simulation (`dev/harness.js`), several seeds each; BR18 (performance) is `tools/perf_br.js` |
| `dev/tests/run.js` | B1 | `s_skinbehave.js` in the default list (`npm test`) |
| `dev/tools/gate/declared_changes.json` | B1, B2, B3 | the notes for `ai.js` and `ents.js` |

Not changed: `ai.senses.js`, `ai.engine.js`, `ai.capture.js`, `ai.intelligence.js`, the Hound, the Smiler, `sim.*`, G.I.B., speech,
chat, `server.js`, the page's art, sound and animations (`public/assets/skinstealer.js`), the snapshot format, the admin panel's
controls. No dependency changed (`package.json` / `package-lock.json` identical to Trial 3).

## This folder (`dev/trial-3-behavior-refinement/`)

| File | What it is |
|---|---|
| `AUDIT.md`, `PLAN.md` | B0: the cause, the refs, the plan written before any game change |
| `BEHAVIOR_DECISIONS.md`, `BALANCE_TABLE.md`, `DEFERRED.md` | the decisions, the proposed values (all PROPOSED), what is not done |
| `CHECKPOINTS.md`, `REGRESSION_REPORT.md`, `CHANGED_FILES.md`, `HUMAN_QA.md` | the record, the results, this list, the owner's test |
| `inventory/remote_heads_before.json` | every remote head before the branch was created (37) |
| `tools/repro_b0.js` | B0: the owner's report reproduced on Trial 3 |
| `tools/verify_remote_br.py` | the after-push read-back from GitHub (SHA, tree, parent, line from `020b5b5`, protected refs, other branches) |
| `tools/behave_browser.js` | B3 / B4: the refinement in two real pages (real server, headless Chromium) |
| `tools/perf_br.js` | B4: BR18, the server's cost against Trial 3 (0 / 1 / 4 Skin-Stealers, and players pressing them), and the soak |
| `evidence/` | every run's output (`b0_*` … `b4_*`), `remote/` (the read-backs), `scans/` (the secret scans before and after each push) |
