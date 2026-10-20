# Trial 3 behaviour refinement — checkpoints

Branch `trial-3-behavior-refinement`, created from the unapproved Trial 3 head `020b5b533a3ab1e8edaaa7dd6a02bf29070421fc` (tree
`26234cdcd68b59727c68bbd21662b980d8d28bbe`). Pushed only fast-forward, never forced. After each push `tools/verify_remote_br.py` reads
the branch back from GitHub (SHA, tree, parent, one straight line from `020b5b5`, every protected ref and every other branch unchanged)
into `evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own hash: each
row is filled in by the next checkpoint (the last by a receipt commit).

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| B0 audit, plan, reproduction, baseline | `4e4a1cf31f856ba8b552ae30ce0e20a2424b5467` | `d7e7a9cc62d8daeacb2be7400a67b48f6cfd15d6` | `020b5b5` | yes: `evidence/remote/b0.json` (ls-remote and the GitHub API agree; one line from `020b5b5`; every protected ref at its head; no other branch moved or new); secret scan of the pushed commit CLEAN |
| B1 awareness while it roams or leaves | (this commit: `evidence/remote/b1.json` arrives with B2) | | `4e4a1cf` | |

## B0 — audit and plan, no game change

Changed: only `dev/trial-3-behavior-refinement/` (this file, `AUDIT.md`, `PLAN.md`, `BALANCE_TABLE.md`, `tools/repro_b0.js`,
`tools/verify_remote_br.py`, `inventory/remote_heads_before.json`, `evidence/`). The runtime is Trial 3's, byte for byte.

| Run (on `020b5b5`) | Result |
|---|---|
| `tools/repro_b0.js` (6 seeds) | the owner's report reproduced: seen close while leaving 40–307 times (10 Hz samples) per run, it never stopped to face them; one departure goal; seen close while roaming with them on the cooldown list 3–140 times; at hunger 0, a person in arm's reach about 13 s: no response. Blind controls: behind wall A, never seen or heard, identical to the run without them in 6 / 6 seeds (`evidence/b0_repro_trial3.txt`, `.json`; `AUDIT.md` §3–4) |
| `npm test` | 183 / 196 in 6 min 4 s. The 13 failures, by name, are the inherited P9 ones (`evidence/b0_inherited_failures.txt`): P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22. Every Skin-Stealer scenario SK01–SK44 passes (34 / 34) (`evidence/b0_npm_test.txt`) |
| `npm run test:humanqa` | 5 / 6; X03 fails as on P9 (`evidence/b0_humanqa.txt`) |

Every later checkpoint compares its `npm test` failures with these 13 names exactly.

## B1 — awareness while it roams or leaves (no attack)

Changed: `src/frameworks/nani/server/ai.skinstealer.js` (→ `generated/server/ai.js`): `SK` gains the B1 values; `e.aw` (records),
`e.rx` (a reaction), `e.awRng` (its own stream); `skAware` (before the decision: records fade; everyone it sees now in its space - those on
its hunt cooldown too - updates one, from their seen body only), `skAttend` (after the decision: a look at the person it has noticed most,
or at a fresh sound; only while it roams or leaves and is not in a skin), `skReact` (the look: it stops, faces, `watch`, its route kept),
`skGaze` (its head toward a noticed person while it walks), the debug block's `aw`, `awN`, `rx`; `onFar` / `onClear` drop the reaction (and
on clear the records). `src/frameworks/overseer/client/ents.debug.js` (→ `public/ents.js`): one debug line, AWARE. `dev/tests/s_skinbehave.js`
(new, BR01–BR07) and `dev/tests/run.js` (its name in the default list). `dev/tools/gate/declared_changes.json` (ai.js, ents.js notes).
Nothing in `ai.senses.js`, `ai.engine.js`, `ai.capture.js`, the Hound, the Smiler or the page's art and sound.

Two values were added to the proposal. `pFast` (1.6): without it a runner circling at 130 px was first looked at up to 3.3 s after it
first saw them close (3 of 8 seeds over 3 s); with it, 0.4–2.0 s. `rxGap` (1.5 s, sounds only): a look at somebody walking right behind it
was sometimes followed 0.06 s later by a look at their footsteps (a trace of BR03's tail, seed 3); now a sound can turn it only 1.5 s after
any reaction has ended. (Applied to every reaction, it held back the first look at a circling runner behind an earlier look at their
footsteps - 1.6–5 s - so it applies to sounds only.) BR03 also stopped counting a look still in progress when the run ends.

| Run | Result |
|---|---|
| `dev/tests/s_skinbehave.js` BR01–BR07 | 7 / 7 (`evidence/b1_br.txt`): a pass at 99–118 px: no look at the person, one at their footsteps after, no strike / hunt; circling: first look 0.4–2.0 s after it first saw them close, 3–4 looks in 22 s, head on them while walking; while leaving (circling, or walking right behind it): 3–4 looks, every one followed by the same departure (12 / 12 runs); far off in view: nothing; on its cooldown list and following: looked at 7–10 times, hunted 0; behind a wall or still out of sight: identical to nobody there (16 / 16, never sensed); footsteps behind a wall: a look aimed 97–169 px from where they were, no record, no reaction to them as a person |
| `dev/tests/s_skinstealer.js` | 34 / 34; 32 of the 34 notes identical to B0's; SK07 differs only by the debug block's new fields; SK25's fourth seed by the creature looking at the wandering person (its plans still within every limit) |
| `npm test` | 190 / 203 (`evidence/b1_npm_test.txt`); the 13 failures are B0's, name for name |
| build, `build:check` (44 outputs), parts, modules, facts, window contract, docs, API contract, scope | PASS |
