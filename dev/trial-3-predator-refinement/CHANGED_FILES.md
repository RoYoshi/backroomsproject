# Trial 3 predator refinement — changed files

Against the starting commit `4518f93` (the behaviour-refinement head; Trial 3 and this refinement are not owner-approved). Every
runtime difference is declared in `dev/tools/gate/declared_changes.json` (the gate's scope step fails on an undeclared one).

## Runtime (what the game runs)

| File | Owner | What changed | Checkpoints |
|---|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` | N.A.N.I. — the Skin-Stealer species only | the hunt above the plans; effort carried; eye contact as information (flank, bait, standoff, coming on); the lost race; belief from anonymous sounds; guesses (`skRoute`, `skGuess`), failed places and turns, revision; roaming curiosity; stalking freeze; waiting with its head turning; no-flank memory; three dithering fixes; per-person state pruned when people leave; the admin debug block's `ht` (hunt); R7 (the independent review): the trail after a lost race at .85 of the runner's speed, effort kept when its attention moves, a kept departure keeps its cooldown, a flank spot searched for only when used, a summon ends a hunt | R1–R4, R6, R7 |
| `generated/server/ai.js`, `generated/BUILD_MANIFEST.json` | build output | rebuilt from `src/` (`npm run build`; `build:check` PASS) | R1–R7 |
| `src/frameworks/nani/client/skin.head.js` | N.A.N.I. — the Skin-Stealer's page script | `BODY_SCALE = 1.3`, exported | R5 |
| `src/frameworks/br-r/client/skin.body.js` | BR-R — the Skin-Stealer's page script | poses from the server's act and head angle (listening, waiting, searching, closing in, cutting off); `newView` sets `BODY_SCALE` on every undisguised view; minimal pose correction (legs, arms) | R4, R5 |
| `public/assets/skinstealer.js` | build output of the two above | rebuilt | R4, R5 |
| `src/frameworks/overseer/client/ents.debug.js` | OVERSEER — the admin-only debug overlay | one line, HUNT, inside the Skin-Stealer's block (debug mode only) | R4 |
| `public/ents.js` | build output | rebuilt | R4 |

Not changed (byte for byte the starting commit's, PR25): `ai.head.js`, `ai.senses.js`, `ai.intelligence.js`, `ai.engine.js`,
`ai.capture.js`, `ai.entity.js`, `ai.hound.js`, `ai.smiler.js`; the snapshot protocol; the player; the map; the server; the compiled client.

## Tests

| File | What changed |
|---|---|
| `dev/tests/s_skinpredator.js` (new) | PR01–PR30 on the real simulation (PR27–PR30 and PR24's route count from the independent review, R7) |
| `dev/tests/run.js` | the new suite in the default list |
| `dev/tests/s_skinstealer.js` | SK08, SK16, SK21, SK22, SK24, SK31, SK41 adapted to owner-authorised behaviour, each with its reason in a comment and in `CHECKPOINTS.md`; SK16's and SK31's titles say what they check (R7) |
| `dev/tests/s_skinbehave.js` | BR14 (part C, and a vault excluded from its speed check) |
| `dev/tools/gate/declared_changes.json` | the notes for `ai.js`, `ents.js`, `assets/skinstealer.js` |

## Development tools and documents (`dev/trial-3-predator-refinement/`)

`AUDIT.md`, `PLAN.md`, `CHECKPOINTS.md`, `BALANCE_TABLE.md`, `DESIGN_DECISIONS.md`, `CHANGED_FILES.md`, `REGRESSION_REPORT.md`,
`PERFORMANCE.md`, `HUMAN_QA.md`, `DEFERRED.md`, `EVIDENCE_INDEX.md`; `inventory/remote_heads_before.json`; tools — `repro_r0.js` (the
owner's report, before / after), `scale_browser.js` and `scale_lineup.js` (its size on the page), `thrash_pr.js` (dithering),
`perf_pr.js` (cost against `4518f93`, the soak), `predator_browser.js` (heard not named, the HUNT line, the snapshot's fields),
`verify_remote_pr.py` (the read-back of each push); `evidence/` (everything the documents cite).
