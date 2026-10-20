# Pre-Trial 3 final polish — changed files (against C5 `63805e9`)

`git diff --stat 63805e98867c3677261307b8cd597f63592b8c45 <final>` lists every file. The evidence under `evidence/` is not listed one by
one. Built files are rebuilt from their sources by `npm run build`, never edited by hand (`generated/BUILD_MANIFEST.json` records them;
`npm run build:check` PASS, 43 outputs).

## What the game serves or runs

| File | Checkpoint | Why |
|---|---|---|
| `public/assets/ui.css` (a canonical static file) | P1, P3, P4, P6, P8 | P1: `#light` (the darkness overlay) held at full opacity over the dread hook's random flicker; the capture's one red impact (`#dread::after`, 1.25 s; a calm 1.9 s under reduced motion). P3: the Account panel and the lit cell. P4: the RGB number fields, the hidden pickers, the "Custom" swatch. P6: the corner keeps only the version; Credits' two colours and links line. P8: the slider captions |
| `src/frameworks/spacious-audio/client/mp.dread.js` → `public/mp.js` | P1 | the capture burst plays once per capture (on the transition into `captured`), not on every later class change |
| `src/frameworks/br-role/client/br-role.js` → `public/assets/br-role.js` | P2 | the arrival shadow's layer moved under the wanderer while she falls (and back after); her silhouette (cast cut-out, self-shading) follows the size she is drawn at, for her and peers |
| `public/index.html` (a canonical static file) | P3, P5, P6 | P3: the gear redrawn; the person icon is the Account button with its panel. P5: loads `assets/version.js`. P6: the corner's source paragraph removed (it is in Credits) |
| `src/frameworks/front/client/ui.js` → `public/assets/ui.js` | P3, P4, P5, P6, P7, P8 | P3: the Account panel (open, Close, Escape, focus back; never Customize). P4: Escape on an RGB number being typed is left to `rgb.js`. P5: the corner reads `TFB_VERSION.display`. P6: Credits' accents, links line, version line. P7: the menu audio's master / music / UI gains, the interface sounds and their one listener. P8: Music volume and UI volume in Settings → Sound |
| `src/frameworks/front/client/rgb.js` → `public/assets/rgb.js` | P4 | a typeable 0–255 number per channel (commit, clamp, put back, Escape), the pickers hidden as the game's adapters, "Custom" / the rainbow swatch go to the Red field; the R4 rule (the colour in effect) kept |
| `src/frameworks/front/client/credits_data.js` → `public/assets/credits_data.js` | P5, P6 | P5: the hand-copied version removed. P6: RoYoshi and Mariikyu with roles and accents; Source material with the corner's attribution, its links and a change indication |
| `public/assets/version.js` (new, built) | P5 | `window.TFB_VERSION`, written by the build from `package.json`'s `version` |
| `src/frameworks/front/client/hud.js` → `public/hud.js` | P8 | the settings store keeps `music` and `ui` (0..1, default 1) |
| `public/assets/ui_hover.mp3`, `ui_click.mp3`, `ui_back.mp3`, `ui_toggle_on.mp3`, `ui_toggle_off.mp3`, `ui_open.mp3`, `ui_unavailable.mp3` (new) | P7 | the interface's placeholder sounds (19,745 bytes; `SOUND_ASSETS.md`) |
| `src/build-recipes.json` | P5 | the `version.js` output (from `package.json`) |
| `generated/BUILD_MANIFEST.json` | every rebuild | rebuilt by `npm run build` |

Not changed: the compiled game bundle (`src/core/client/game/`, `public/assets/index-*.js/.css`), `src/core/client/mp.frame.js` (a
first P1 attempt there was dropped: it broke B++'s client golden), the server and its protocol, movement, monsters, AI, collision, the
chats' code (`chat.js`, `voice.js`, `speech.js`), admin authentication, secrets, CI, deployment, `package.json`.

## Build, docs and checks

| File | Checkpoint | Why |
|---|---|---|
| `dev/tools/build/build.js` | P5 | the `version` output kind (from `package.json`; a version without major.minor.patch stops the build; the manifest records it) |
| `dev/tools/docs/docs.js`; `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/CONTRACTS.md` | P5 | the build table knows the new kind; regenerated (`version.js`; `window.TFB_VERSION`) |
| `src/core/client/bundle/api_contract.json`, `src/core/client/bundle/API_CONTRACT.md` (regenerated) | P2 | BR-RoLE now reads `__api.death()` / the fall: the `__api` contract record regenerated |
| `dev/tools/checks/menu_drift.js` | P3, P5, P6 | the gate's menu step against C5d told each deliberate menu edit (the gear, the Account cell and panel, the version script, the corner credit) so every other control, word and byte is still compared |
| `dev/tools/checks/rgb_browser.js` | P4 | reads the number fields; the typing and replicated cases; five more mutants; `--mutant-ids` |
| `dev/tools/gate/gate.js`, `dev/tools/gate/README.md`, `dev/tools/README.md` | P9 | the full-tier `rgb` step expects 11 mutants (P4 added five); the descriptions say so |
| `dev/tools/gate/declared_changes.json` | P1–P8 | every runtime change above declared (the scope step fails on an undeclared one) |

## This stage's own folder (`dev/pre-trial3-final-polish/`)

`PLAN.md` (P0: owners, plan), `CHECKPOINTS.md`, `POLISH_REPORT.md`, `CHANGED_FILES.md`, `HUMAN_QA.md`, `SOUND_ASSETS.md` / `.json`,
`inventory/remote_heads_before.json`, `evidence/` (one folder per checkpoint, `remote/` the push receipts), and `tools/`:
`verify_remote_p.py` (P0), `vfx_probe.js` (P1), `spawn_probe.js` (P2), `menu_rail_check.js` (P3), `version_check.js` (P5),
`credits_check.js` (P6), `ui_sounds.py` and `ui_audio_check.js` (P7, P8).
