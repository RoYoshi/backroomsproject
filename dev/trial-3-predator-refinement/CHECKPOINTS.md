# Trial 3 predator refinement — checkpoints

Branch `trial-3-predator-refinement`, created from the unapproved behaviour-refinement head `4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a`
(tree `28815b06019ed38aff8c083e93b1ba7056da3d67`). Pushed only fast-forward, never forced. After each push `tools/verify_remote_pr.py`
reads the branch back from GitHub (SHA, tree, parent, one straight line from `4518f93`, every protected ref and every other branch
unchanged) into `evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own
hash: each row is filled in by the next checkpoint (the last by a receipt commit).

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| R0 audit, plan, reproduction, baseline | `f094dd46a7274877c07fdf27829a68bb0fad5b8c` | `491605897c6c453d2a287ac42a71b52434a81b56` | `4518f93` | 2026-10-21 05:00 UTC, `evidence/remote/r0.json` (GitHub API and `ls-remote` agree; protected refs and every other branch unchanged); scans `r0_pre.txt` / `r0_post.txt` clean |
| R1 the hunt, hunger and eye contact, the lost race | `907de0df54ece3a0940c8aadfe23a9ba16f7b093` | `2d5fb85aa1ed4a26b8b96a37a6f44182f381d105` | `f094dd4` | 2026-10-21 05:50 UTC, `evidence/remote/r1.json`; scans `r1_pre.txt` / `r1_post.txt` clean |
| R2 listening, belief, guesses, failed guesses | `fbeaf1fcc07d10e17da1ec514d7d16ae856df95b` | `f292ad67c38a80fc690d041f7e743091a91a6928` | `907de0d` | 2026-10-21 06:21 UTC, `evidence/remote/r2.json`; scans `r2_pre.txt` / `r2_post.txt` clean |
| R3 stalking, going round, coming on, fair strikes | (this commit: `evidence/remote/r3.json` arrives with R4) | | `fbeaf1f` | |

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

## R2 — listening, belief, guesses, failed guesses

Changed: `ai.skinstealer.js` and its build; `declared_changes.json` (the `ai.js` note); `s_skinpredator.js` (PR08–PR16); SK21 and SK24
(below). The shared engine is untouched: the creature reads only what the engine's hearing already gives every species (`e.mem.sounds`:
a fuzzy place, a strength, a time, anonymous unless the engine named it while the person was seen).

* **Belief from sounds.** On each think the hunt takes every new body sound (a person's it cannot name; never a creature's) and asks whether
  its quarry could be there by now: within both uncertainties plus 260 px a second since its last evidence. If so the belief moves to that
  fuzzy place, a heading is taken from the last evidence (only from a move larger than the sounds' own fuzz), and confidence rises to
  .45–.85 by loudness. Nobody is named and the engine's records are not touched: another person's noise there fools it.
* **Guesses** (`skGuess`, from the belief only): an interception while the belief is fresh and moving (Trial 3's prediction; its route walk
  is now `skRoute`, the same draws in the same order); where they would be by now along the predicted way; the other way at the same first
  turn; where it believes them; the place it last had them. Footsteps that stopped favour where they stopped. A place within 200 px of a
  failed guess (kept 60 s, at most 4) and a first turn that failed are not tried again unless newer evidence came after the failure. A
  seeded element (its own stream; less for the cleverer) lets it choose wrong. 2 guesses in a hunt when hungry, up to 4 when starving.
* **Failed guesses**: a wrong interception costs .15 confidence and records both its route point and its waiting spot; a search that finds
  nothing costs .075 and records its goal. Waiting, if it heard them close by, or heard them elsewhere since its guess, the guess is not
  counted wrong: it goes after what it heard.
* **Revision**: a sound that fits, 350 px or more from the current guess, corrects an interception (twice per plan) or turns it into a look
  at the sound, and moves a search (three times per search); at most 3 revisions per hunt. No sound, no revision.
* **Curiosity while roaming** (hungry): a sound makes it stop, turn to it and listen 0.8–1.8 s; a second sound that fits the first, or a
  first strong enough (.45, down to .18 when hungry), sends it to look quietly; otherwise it lets it go. Anonymous throughout.
* Confidence now lasts 10 s (barely hungry) to 30 s (starving) without evidence (R1: 8–24): with guesses that cost confidence, the hunt
  still ends 15–22 s after the last evidence in the scenes measured.

| Run | Result |
|---|---|
| `s_skinpredator.js` | 17 / 17 (`evidence/r2_suites.txt`). PR08: the same creature whichever way they went until it sensed a difference 8 / 8; its first guess is on open floor 200 px or more ahead in 6 / 7. PR09: the first guess at the fork is the same whichever way they really take (11 / 11) and differs between seeds (7 east, 4 north-west): wrong for some either way. PR10: after a wrong interception with nothing more heard: no place guessed twice, confidence 1 → .42–.48, the hunt over 19–20 s from the start. PR11: running back is heard and taken for them in 5 / 8 and turns its guess toward them in 4; crouching back is heard 0 times and revises nothing; the runs identical until the first sound 8 / 8. PR12: footsteps behind a wall: it stops and listens, then looks (5 / 6 that heard); no person named before a sighting (0 ticks). PR13: a silent croucher at either end of the north passage: identical runs 8 / 8; given up 7 / 7 and 6 / 7. PR14: running on east then crouching back: taken for them 6 / 8, fooled 5 / 8, found 2 / 8. PR15: the belief's mean distance from them while unseen: 35–223 px with the footsteps, 571–581 px without (closer 7 / 7); silent steps steer nothing. PR16: a thud nobody made: listens and looks 6 / 6, each look over in 5–9 s, no record, hunt or strike |
| `s_skinstealer.js`, `s_skinbehave.js` | 34 / 34, 19 / 19 (SK21 and SK24 adapted, below) |
| `s_hound.js`, `s_smiler.js` | 30 / 31; H07 inherited (`evidence/r2_hound_smiler.txt`) |
| `tools/repro_r0.js` (`evidence/r2_repro.*`) | L: footsteps now change its plan within a quarter second in 6 / 8 runs (R1: 3; R0: 2); 2 kills where it heard and found them; F: each failed interception (6 runs) is followed by listening and a search before any departure (R1: 5 of 6 went straight to a departure) |
| static checks (`evidence/r2_checks.txt`) | build:check, parts, modules, facts, window contract, docs, API contract, SCOPE: PASS |

### Contract changes

| Scenario | Before | Now | Why |
|---|---|---|---|
| SK21 | stillness measured over every `lure` plan in the run | over its first wait | the hunt may go on after the bait (R1) and lie in wait again elsewhere: that is another wait, not movement during the first |
| SK24 | the first plan after the sound is a search | a roaming listen (turned to the sound) may come first; the first plan after it is judged, and the listens are reported | the pack's listen-before-moving: it stops and listens, and what it hears next decides; the ≥ 3 / 6, the goal within 250 px, the duration and the silent case are unchanged |

## R3 — stalking, going round, coming on, fair strikes

Changed: `ai.skinstealer.js` and its build; the `ai.js` note; `s_skinpredator.js` (PR06, PR07, PR17, PR21); SK16 and SK21 (below).

* **Stalking freeze**: coming at somebody unaware, when their facing turns within 1.1 rad of it (before eye contact) it freezes —
  crouched, still (act `creep`) — until they look away (then "it comes on") or its patience runs out: 3 s when hungry, 1.2 s when
  starving.
* **Waiting** at an interception its head sweeps (the `h` the page already receives) toward the way they would come.
* **A flank reaches its spot**: R1's flank ended as soon as the creature lost sight of the person — usually because it had turned its own
  back on them while moving — so it often stopped half way, still in their view. It now goes on to its spot (or its time) and comes at
  them from there.
* **No way round**: when it finds no flank spot it remembers that for that place for 10 s (or until they move 200 px) instead of searching
  again on every think; a very hungry one whose hunt has met that may then come on openly.

| Run | Result |
|---|---|
| `s_skinpredator.js` | 21 / 21 (`evidence/r3_suites.txt`). PR06: watched at .7 in the lit hall it went round them in 8 / 8; every flank spot out of their sight (22 / 22); 18 of 21 flanks over with it out of their sight; never inside a wall, no jump. PR07: in the narrow north corridor (no way round, found 7 / 8) a .8 one came on openly while watched in 8 / 8; every spring at the watcher was in their sight with its whole wind-up first (8 / 8), every spring with its whole wind-up (16 / 16); one who broke away at the tell got away from that spring 8 / 8 — and was taken after their run ended (they stopped in the open, in a lit room; reported). PR17: listening (act `listen`, still, head turned) and approaching (act `approach` / `creep`, moving) both shown in 5 / 8 runs; the page's state, act and head equal what it does at every tick (0 mismatches); an act shown under 0.1 s at most once in a run. PR21: 18 springs each with its full wind-up; 12 kills, body against body (37.6–41.9 px) with a clear line; broke away at the tell and survived that spring 6 / 6, stood watching 0 / 6 |
| `s_skinstealer.js`, `s_skinbehave.js` | 34 / 34, 19 / 19 (SK16, SK21 adapted) |
| `s_hound.js`, `s_smiler.js` | 30 / 31; H07 inherited (`evidence/r3_hound_smiler.txt`) |
| `tools/repro_r0.js` (`evidence/r3_repro.*`) | as R2 for W / U / C / R; watched at .75: kills 8 / 8 (closest 25–38 px) |
| static checks (`evidence/r3_checks.txt`) | PASS |

### Contract changes

| Scenario | Before | Now | Why |
|---|---|---|---|
| SK16 | a watcher is never taken in 150 s | never taken while its hunger is under .6; a kill once hunger has risen past that is reported | its hunger rises from .55 to about .8 in the 150 s; the owner: a very hungry one is not kept off by being watched. Being left alone first, and the no-pinning budget, unchanged |
| SK21 | 8 seeds, at least 6 lie in wait | 24 seeds, the runs that lie in wait judged (at least 6), each held to T3's rules unchanged | at .7 a watched one now more often goes round them (R1's flank, which since R3 reaches its spot) than backs off as bait — about a third of hunts bait |
