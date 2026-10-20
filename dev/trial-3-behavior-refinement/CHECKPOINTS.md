# Trial 3 behaviour refinement — checkpoints

Branch `trial-3-behavior-refinement`, created from the unapproved Trial 3 head `020b5b533a3ab1e8edaaa7dd6a02bf29070421fc` (tree
`26234cdcd68b59727c68bbd21662b980d8d28bbe`). Pushed only fast-forward, never forced. After each push `tools/verify_remote_br.py` reads
the branch back from GitHub (SHA, tree, parent, one straight line from `020b5b5`, every protected ref and every other branch unchanged)
into `evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own hash: each
row is filled in by the next checkpoint (the last by a receipt commit).

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| B0 audit, plan, reproduction, baseline | `4e4a1cf31f856ba8b552ae30ce0e20a2424b5467` | `d7e7a9cc62d8daeacb2be7400a67b48f6cfd15d6` | `020b5b5` | yes: `evidence/remote/b0.json` (ls-remote and the GitHub API agree; one line from `020b5b5`; every protected ref at its head; no other branch moved or new); secret scan of the pushed commit CLEAN |
| B1 awareness while it roams or leaves | `0d6f7b9f00ee34318975a5b157bfe548ab0e20d7` | `9672dbbd20b83ebd7cce8ebee6e70304c7ef8cdf` | `4e4a1cf` | yes: `evidence/remote/b1.json`; secret scan of the pushed commit CLEAN |
| B2 provocation, warnings, fading, the very hungry departure | (this commit: `evidence/remote/b2.json` arrives with B3) | | `0d6f7b9` | |

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

## B2 — provocation, warnings, fading, the very hungry departure (no attack)

Changed: `ai.skinstealer.js` (→ `generated/server/ai.js`): `SK` gains the B2 values; the record keeps updating within 300 px once begun
in its space; pressure by kind with ceilings (in its space and crowding by how much *they* closed the distance lately; circling by their
motion relative to its own, round it, one way, counted only while seen; following it as it walks; moving into its way; pressing in after a
warning); the fade over all the time since it last saw them; `skWarn` (the warning) and `skReactEnd` (at its end it takes another way out:
the departure's goal is re-picked by `skLeaveGoal`, split out of `skLeave` with the same draws in the same order; roaming, it leaves);
`skDecide` thinks a very hungry departure over only on fresh sight of somebody it may hunt (after `leaveDwell`, at most once a second,
never after a lost race: `skLeave(...).race`); debug: tier names, warnings, `lv` (why a departure was kept or given up).
`ents.debug.js`: the AWARE line shows warnings and `LEAVE:`. `s_skinbehave.js`: BR09, BR11–BR14, BR20. `declared_changes.json`: notes.

Found and fixed while building B2, each by a scenario:
* *BR12:* a bystander standing still that the creature backed into while warning somebody else reached 0.65 (crowding) and was warned
  (2 of 6 seeds). Pressure in its space and crowding now count only as much as the person closed the distance lately (`byThem` against
  `byIt`); blocking needs the person to be moving. The bystander now peaks at 0.17–0.18.
* *BR20:* the fade used the think's step clamped to 0.25 s, so a person away for a minute (the creature far) kept nearly all of their
  pressure (0.198 a minute later). The fade now counts all the time since its last look at them; the record is also dropped after 30 s.
* Test drivers, not the creature: BR11's "bump" had followed the creature (aimed at its centre: 1.2 pressure, 2 warnings) - it now brushes
  past 25 px off; BR14 judged a departure on every tick after it had ended by arrival - it now judges the moment it ends; its newcomer is
  placed 180 px beside the creature's route, because a hungry one grabs whoever is in its reach (Trial 3's rule, unchanged), and a grab is
  reported as such.

| Run | Result |
|---|---|
| `s_skinbehave.js` BR01–BR07, BR09, BR11–BR14, BR20 | 13 / 13 (`evidence/b2_br.txt`): BR01–BR07 as at B1; pressing in at 70 px is warned after 6.0–7.3 s (peak 0.46–0.57), 15 s after they back off 0.07–0.09, nothing follows them; a brush past at 23–25 px: one look, no warning (peak 0.18–0.41); a bystander peaks at 0.17–0.18, never warned; three minutes of pressing: 29–30 warnings, never closer than 5.3 s apart, at most 1 record, reacting 45–46 % of the time, 35 places; a very hungry departure gave up for a newcomer it saw (3 of 4; the fourth kept it when it thought it over), never for a hidden person while its hunger passed 0.8 (0 / 4), never after a lost race (0 / 4); nothing stale after leaving the game, a minute far away, an admin clear, a removal or a world reset |
| `s_skinstealer.js` | 34 / 34; the same 32 notes as B0's; SK07 (debug fields) and SK25's fourth seed differ as at B1 |
| `npm test` | 196 / 209 (`evidence/b2_npm_test.txt`); the 13 failures are B0's, name for name. (A comment in the species header was reworded after this run; the code it ran is the code committed; SK and BR were run again on the final build: 47 / 47, the BR notes identical) |
| build, `build:check`, parts, modules, facts, window contract, docs, API contract, scope | PASS |
