# Trial 3 predator refinement — checkpoints

Branch `trial-3-predator-refinement`, created from the unapproved behaviour-refinement head `4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a`
(tree `28815b06019ed38aff8c083e93b1ba7056da3d67`). Pushed only fast-forward, never forced. After each push `tools/verify_remote_pr.py`
reads the branch back from GitHub (SHA, tree, parent, one straight line from `4518f93`, every protected ref and every other branch
unchanged) into `evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own
hash: each row is filled in by the next checkpoint (the last by a receipt commit).

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| R0 audit, plan, reproduction, baseline | `f094dd46a7274877c07fdf27829a68bb0fad5b8c` | `491605897c6c453d2a287ac42a71b52434a81b56` | `4518f93` | 2026-10-21 05:00 UTC, `evidence/remote/r0.json` (GitHub API and `ls-remote` agree; protected refs and every other branch unchanged); scans `r0_pre.txt` / `r0_post.txt` clean |
| R1 the hunt, hunger and eye contact, the lost race | (this commit: `evidence/remote/r1.json` arrives with R2) | | `f094dd4` | |

## R0 — audit and plan, no game change

Changed: only `dev/trial-3-predator-refinement/` (`AUDIT.md`, `PLAN.md`, this file, `BALANCE_TABLE.md`, `tools/repro_r0.js`,
`tools/scale_browser.js`, `tools/verify_remote_pr.py`, `inventory/remote_heads_before.json`, `evidence/`). The runtime is `4518f93`'s.

| Run (on `4518f93`) | Result |
|---|---|
| `tools/repro_r0.js` (8 seeds per row) | the owner's report reproduced (`AUDIT.md` §2): watched at hunger ≥ .75 it backs off, waits and leaves in 8 / 8 (13–18 s), 0 kills in 120 s of a starving one being watched; at ≤ .5 it leaves even an unaware person in light; after losing sight of a runner it ignores the footsteps it hears; a lost race ends in a departure in 8 / 8 (`evidence/r0_repro_baseline.*`) |
| `tools/scale_browser.js` (real server, Chromium) | undisguised Skin-Stealer drawn 49.6 × 61.5 world px (a 25 px torso), a Wanderer 39.5 × 59.4 (a solid ~38 px body), a Hound 86.2 × 162.5; no scale factor in the renderer (`evidence/r0_scale_before.*`, `r0_shots/`) |
| `npm test` | 202 / 215; the 13 failures are the inherited P9 ones, name for name as at B0 (`evidence/r0_npm_test.txt`, `r0_inherited_failures.txt`); SK 34 / 34, BR 19 / 19 |
| `npm run test:humanqa` | 5 / 6; X03 as on P9 (`evidence/r0_humanqa.txt`) |

## R1 — the hunt, hunger and eye contact, the lost race

Changed: `src/frameworks/nani/server/ai.skinstealer.js` (the species only) and its build outputs (`generated/server/ai.js`,
`generated/BUILD_MANIFEST.json`); `dev/tools/gate/declared_changes.json` (the note for `ai.js`); the new suite
`dev/tests/s_skinpredator.js` (PR01–PR05, PR18–PR20) and its place in `dev/tests/run.js`; four Trial 3 / B1–B5 assertions (below).
The shared engine (`ai.senses.js`, `ai.engine.js`, `ai.intelligence.js`, `ai.capture.js`), the Hound, the Smiler, the page, the
protocol and the player are untouched.

What it does now (values in `BALANCE_TABLE.md`, all unapproved):

* **A hunt above the plans** (`e.hunt`): begun when a hungry one (≥ .4) commits to a person it has seen; it keeps the quarry, a belief of
  where they are (the last sighting, extrapolated and stopped at walls), a confidence that falls without evidence (gone in 8 s when
  barely hungry, 24 s when starving; a sighting restores it), its flanks, its searches and their failed places. When a plan ends with the
  hunt alive it does not roam off: it stops and listens, goes where it believes them (at most 3 searches), or gives up with the reason
  ("no sign of P… for N s", "the trail is cold", "its time with P… is spent", "it guessed wrong").
* **Effort, carried**: the time it may spend on one person is 30 + 90 × hunger s (Trial 3: 25 + 45 × hunger), and what it spent is
  kept across its departures, halving every 90 s: leaving and coming back refills nothing. A starving one may take up again a person
  it left, on a fresh sighting, 4 s or more after leaving and within that effort.
* **Eye contact is information**: the weights are smooth in hunger. Mildly hungry, being watched still sends it off; hungry, it may go
  round them (a flank: a quick move under cover to a spot at their side they cannot see, at most 3 per hunt, under a person's walking
  speed), back off as bait, or hold a standoff; starving — or very hungry once its flanks and its bait have failed — it comes on
  openly. Which answer a hunt prefers is drawn once per hunt from its own seeded stream (one Skin-Stealer is not the next). More than
  one person in view, it holds back as before (a lone ambusher). Hungry (.5 measured), it goes for an **unaware** person even in
  light (Trial 3 left them); at .4 and below it still leaves them in light.
* **The lost race**: a fresh runner still wins (top speeds and `chaseLose` unchanged). A hungry one (≥ .6) that loses stops running, may
  not give chase again for 10 s, and keeps to the runner's trail at its free walking pace (200 px/s, the pace that costs it no
  stamina): a runner who keeps running pulls away; one who stops in the open is reached; one who breaks its line of sight is
  listened for and searched for, then given up.
* **A failed bait** is one failed tactic for a very hungry one (≥ .6): the hunt goes on (listen, go after them, a flank).

| Run | Result |
|---|---|
| `s_skinpredator.js` (PR01–PR05, PR18–PR20) | 8 / 8 (`evidence/r1_suites.txt`): a satiated one notices a person passing within 11–134 px and does not hunt or strike (PR01); B1–B5's warning and defence kept, backing off ends it (PR02); starving and watched in the lit hall it hunts in 8 / 8 (approach or flank) where .1 leaves in 0.1 s (PR03); kept in view it hunts until it kills (6 / 6), out of sight and silent it gives up in 7 / 7 judged runs, 10–19 s after the last sighting, nobody killed (PR04); the race is lost at 3.5–4 s, never closer than 315 px, never faster than 255 px/s (PR05); the same scene satiated and starving: first sighting at the same instant, the same record, then leave against hunt (PR18); watched all the time at .75 it changes tactic in 7 / 8, exhausted it leaves 4 / 4 (PR19); after a lost race a runner who stops in the open is hunted again, one who escapes out of sight and stays silent is let go 8 / 8 (PR20) |
| `s_skinstealer.js`, `s_skinbehave.js` | 34 / 34 and 19 / 19 with the four adaptations below |
| `tools/repro_r0.js` (8 seeds per row; `evidence/r1_repro.*`, against `r0_repro_baseline.*`) | watched at .75: 0 / 8 leave within 45 s (R0: 8 / 8), 8 kills (a person who only stands and stares); .95 / 1.0: 8 / 8 kills (R0: 0). Unaware at .5 in light: it hunts 8 / 8 (R0: left 8 / 8). C (watched for 120 s at .95): 8 kills (R0: 0). R (the race): every race still lost, then it keeps to the trail; the runner in that scene stops at the hall's end and is reached (7 / 8). L (seen once, then out of sight): it stops to listen, then searches where it believes them — several searches in one hunt — before giving up with a reason in 5 / 8 (R0: one search at most, then "it left" in 6 of 7); F (a double-back): the interception still ends in a plain departure in 5 / 8 — a wrong guess is not yet followed by another (R3), and footsteps do not yet steer it (R2) |
| `s_hound.js`, `s_smiler.js` | 30 / 31; H07 is the inherited P9 failure, as at R0 (`evidence/r1_hound_smiler.txt`); the full `npm test` and the P9 equivalence run at R6 |
| static checks (`evidence/r1_checks.txt`) | build:check PASS (44 outputs), parts, modules, facts, window contract, docs, API contract current, SCOPE PASS (the `ai.js` note extended) |

### Contract changes (owner-authorized behaviour; each reason is written next to the assertion)

| Scenario | Trial 3 / B1–B5 assertion | Now | Why |
|---|---|---|---|
| SK08 | after an admin clear it is not STALKING 3 s later | the state after the clear is read at once; STALKING after 3 s is allowed when it is its own new approach, flank or interception | a hungry one sees the same person again and hunts them — the clear still removed the old record and plan (asserted) |
| SK21 | nobody follows the bait → it leaves ("did not follow") | it leaves, **or** (≥ .6) goes on with the same hunt with the bait marked failed; still hidden, still, within `lureMax` | the owner: a very hungry one must not give up because one tactic failed |
| SK22 | the fresh runner is 1500 px away 14 s later | the gap never closes while they run (≥ the gap at the lost race) | the 1500 px measured the old departure; what it protected — the fresh runner wins — is asserted directly |
| SK31 | no kill in the scene | no kill while the person is still running; a kill after they stopped is reported | the hunt now outlives the race; speed is still never the reason |
| SK41 | judged on all seeds | judged on the runs where it lay in wait (≥ 6), ≥ 5 / 6 seeds right | with flanks and open approaches, lying in wait is one answer of several |
| BR14 C | a lost race is a departure, not reconsidered | no new chase for `chaseRest`, never faster than its free pace then (a vault excluded), a newcomer does not start one | the owner: a lost race is not the end of a hunt; B2's protection (no chaser made by a runner in view) kept |
| BR14 (title) | — | names the R1 part | — |
