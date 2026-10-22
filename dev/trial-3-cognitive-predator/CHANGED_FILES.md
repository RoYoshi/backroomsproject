# Trial 3 cognitive predator refinement — changed files

Against R8, `f378049a825e53eafc626a637b8c43397e4072f0` (the predator refinement you rejected; Trial 3 and its refinements are not
owner-approved). `git diff --stat f378049` outside `dev/` lists three files; every runtime difference is declared in
`dev/tools/gate/declared_changes.json` (the gate's scope step fails on an undeclared one) and C15 checks the list on every run.

## Runtime (what the game runs)

| File | Owner | What changed | Checkpoints |
|---|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` | N.A.N.I. — the Skin-Stealer species only | C1: facing what it sees (head tracking while frozen, a close sound turned to fast, re-aimed every think), interrupts (a short bait wait that ends on being heard going away; a listen ending on the sound it waits for; departures thought over for an opening), a twitch is not an opening, the QA record `e.cog`. C2: the stand-off with a purpose (closing on each look-away), whom to go for (the better chance, groups held from the dark), a bait only where it is an ambush. C3: what it sees them do (a circle fitted to sightings → a cut-off; a reversal undoes it), the lost race (a choice at once, 3 s trail). C4: the hunger gradient (its own draw from .4 to .55). C7: winded only as drawn; no spring at company; a passed-over person let go; a stand-off renewed at most once and only from a new spot; a watch keeps its time; (the re-check) a flank spot or bait corner still in plain view given up | C1–C4, C7 |
| `generated/server/ai.js`, `generated/BUILD_MANIFEST.json` | build output | rebuilt from `src/` (`npm run build`; `build:check` PASS) | C1–C4, C7 |

**Not changed** (byte for byte R8's; C15 lists them on every run, PR25 the shared engine against 4518f93, and the six-seed P9 equivalence
runs the world without a Skin-Stealer tick for tick): the shared AI engine and senses (`ai.head.js`, `ai.senses.js`, `ai.intelligence.js`,
`ai.engine.js`, `ai.capture.js`, `ai.entity.js`), the Hound and the Smiler, movement, G.I.B., the snapshot and protocol, the page scripts
(the Skin-Stealer's drawing and poses included), the admin panel and its overlay, chat, the server, the compiled client.

## Tests

| File | What changed |
|---|---|
| `dev/tests/s_skincognitive.js` (new) | C01–C23 on the real simulation: C01–C18 (the pack's list; C15 the in-tree part of the P9 parity, C18 the latency sample) and C19–C23 (the independent review's findings and its re-check's, each failing on the build it reviewed) |
| `dev/tests/run.js` | the new suite in the default list |
| `dev/tests/s_skinstealer.js` | SK17 (25 s; a pair is never come at), SK21 and SK41 (the bait moved to the hall: a bait now needs an ambush corner, C08), each with its reason in a comment and in `CHECKPOINTS.md` C2 |
| `dev/tests/s_skinpredator.js` | PR20 (judged on the runs where it saw the runner again - the 3 s trail loses some who stop far off: C3, an owner decision), PR29 (25 s; a departure with the person in view counts as kept) |
| `dev/tools/gate/declared_changes.json` | the `ai.js` note: C1–C4 and C7 |

## Development tools and documents (`dev/trial-3-cognitive-predator/`)

`AUDIT.md` (C0), `OWNER_FAILURE_REPRO.md` (C0), `CHECKPOINTS.md`, `BALANCE_TABLE.md`, `DESIGN_DECISIONS.md`, `BEFORE_AFTER.md`,
`CHANGED_FILES.md`, `REGRESSION_REPORT.md`, `PERFORMANCE.md`, `HUMAN_QA.md`, `DEFERRED.md`, `EVIDENCE_INDEX.md`;
`inventory/remote_heads_before.json`; tools — `c0_audit.js` (the owner's scenes on the real simulation, R8 or this build), `cog_browser.js`
(C0–C3's real-page scenes), `c6_browser.js` (the pack's four real-page scenes and a fresh runner, every input logged), `c6_summary.py` (one
line per try), `c5_sprint_diag.js` (a lead won without a race), `c7_pool.py` (every real-page pass pooled per scene with n), `verify_remote_cp.py` (the read-back of each push); `evidence/` (everything
the documents cite, the independent review and its kit in `evidence/c7_review*`).
