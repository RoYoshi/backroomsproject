# Post-Trial 4 review — changed files (against `518b990`)

`git diff --stat 518b990 <final>` lists them all. Evidence files under `evidence/` are not listed one by one.

## What the game serves or runs

| File | Checkpoint | Why |
|---|---|---|
| `src/frameworks/front/client/rgb.js` | R1 | H1: each slider group kept with its picker; the sliders show and edit the colour in effect (the HUD's Default included); refreshed on picker events, after clicks, when shown, before use and at load; the numbers hidden from screen readers (L1) |
| `public/assets/rgb.js` | R1 | built from the source above (`npm run build`), byte for byte |
| `src/frameworks/front/client/chat.js` | R1 | M3: `canSpeak()` asked once a frame; the open-sheet test reads a live list (the same answer); L1: no `aria-label` on the hint's paragraph |
| `public/assets/chat.js` | R1 | built from the source above, byte for byte |
| `public/assets/ui.css` | R1 | M2: the RGB sliders undo the game's field style in Customize; their numbers fit their column in Settings (two rules, both scoped to `.rgb-channel`) |
| `generated/BUILD_MANIFEST.json` | R1 | H2: rebuilt; it now matches the sources (`npm run build:check` PASS) |

Not changed: `server.js`, every server module (`speech.js` included), `index.html`, `mp.js`, the compiled client, every other script
and stylesheet, `package.json`, the save keys, the protocol and the network rates.

## Checks and gate

| File | Checkpoint | Why |
|---|---|---|
| `dev/tools/checks/rgb_browser.js` | R1 | new: the RGB sliders in Chromium, at 1280×720 and on a phone (14 cases, 6 mutants) |
| `dev/tools/gate/gate.js` | R1 | the full tier gains the `rgb` step (after `chat_browser`); its notes and the tier list |
| `dev/tools/checks/menu_drift.js` | R1 | M1: index.html is compared after removing exactly Trial 4's two page edits (the RGB script tag, the NEW RUN label), as Trial 2's tag already was |
| `dev/tools/gate/declared_changes.json` | R1 | M1: the source `rgb.js` was wrongly declared as a runtime file; Trial 2's descriptions are restored, with Trial 4's and this review's notes appended |
| `dev/tools/gate/README.md`, `dev/tools/README.md` | R1 | the new check and step |
| `dev/stage-3h/golden/live_wire_h2.js` | R3 | M1: the refused label's leading words "Spontaneously Combust?" read as B++'s "NEW RUN"; the refusal's words and every menu state still compared |

## Documents

| File | Checkpoint | Why |
|---|---|---|
| `docs/architecture/BUILD_PIPELINE.md`, `CONTRACTS.md`, `FRAMEWORKS.md`, `src/frameworks/front/README.md` | R1 | M1: their generated blocks regenerated (`node dev/tools/docs/docs.js`): Trial 4's `rgb.js` and its use of `window.__settings` |
| `docs/architecture/CHAT.md` | R2 | M5: the colour field `c` in `say` and `heard`, older pages, the Enter hint and the bubble accent |
| `README.md` | R1 | L5: what this branch is |
| `dev/post-trial4-review/` | R1–R4 | this review: `REVIEW_REPORT.md`, `HUMAN_QA.md`, this file, `CHECKPOINTS.md`, `tools/verify_remote_r.py`, `inventory/remote_heads_before.json`, `evidence/` |
