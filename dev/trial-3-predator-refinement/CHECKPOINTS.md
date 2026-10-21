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
| R3 stalking, going round, coming on, fair strikes | `867d63b7de878c6b5b208f1e2fadfdb0bb97d202` | `70bc5b7a5e4b5508950b2fddb2d15e49ee7859c7` | `fbeaf1f` | 2026-10-21 06:40 UTC, `evidence/remote/r3.json`; scans `r3_pre.txt` / `r3_post.txt` clean |
| R4 poses, debug, dithering, balance | `ef70370de82b63c958a8df02cc7360b3a8f91f4d` | `eae4a5255b8e8fe4760be3053af54c597847a20a` | `867d63b` | 2026-10-21 06:53 UTC, `evidence/remote/r4.json`; scans `r4_pre.txt` / `r4_post.txt` clean |
| R5 its size on the page | `16847755c5b5198853fe4f3b3096ef505fef78e3` | `a855f0364efe2dc58816a409d834348eea253dab` | `ef70370` | 2026-10-21 07:39 UTC, `evidence/remote/r5.json`; scans `r5_pre.txt` / `r5_post.txt` clean |
| R6 several people, parity, stress, cost | `7e85e94dfaa720f24dda4bfc06e69cec1c0df39d` | `002d98294df6cc7811746050cf276fcbf93785f7` | `1684775` | 2026-10-21 08:57 UTC, `evidence/remote/r6.json`; scans `r6_pre.txt` / `r6_post.txt` clean |
| R7 independent review and fixes | `7b9d704919532d4d0ec1dca6156f29b15ce6a5db` | `ad1ab19593f2c79d5718e6506750b99172698bee` | `7e85e94` | 2026-10-21 10:08 UTC, `evidence/remote/r7.json`; scans `r7_pre.txt` / `r7_post.txt` clean |
| R8 final documents and receipts | `62a887e65e47e4a67f242a17c22faea098c8e702` | `8491edc7d32af1255efe71d129186738ab384de8` | `7b9d704` | 2026-10-21 10:13 UTC, `evidence/remote/r8.json`; scans `r8_pre.txt` / `r8_post.txt` clean |
| receipt (R8's read-back only) | the commit after `62a887e`, named in the handoff message | | `62a887e` | read back after its push (the handoff message) |

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

## R4 — poses, the admin HUNT line, dithering, balance

Changed: `ai.skinstealer.js` (three dithering fixes) and its build; the Skin-Stealer's page script `src/frameworks/br-r/client/skin.body.js`
(poses) and the admin overlay `src/frameworks/overseer/client/ents.debug.js` (one line), rebuilt into `public/assets/skinstealer.js` and
`public/ents.js`; the `ai.js`, `ents.js` and `assets/skinstealer.js` notes; `tools/thrash_pr.js` (new); PR08, PR10, PR17 measured more
precisely (below). No new act, state or snapshot field: every pose comes from the act and head angle the page already receives.

* **Poses** (pack 06's tells, from the server's act): listening — half crouched, still, no twitch (it holds its breath), its head turned
  exactly as the server's head angle says (the random cosmetic tilt is kept only for other still acts, never while it listens); lying in
  wait — low and coiled, the head sweeping as the server sweeps it; searching — low, a little reach; closing in — a forward lean; running to
  cut somebody off — leaning into the run.
* **HUNT** (admin overlay, debug mode only): quarry, how sure and how it knows (seen / heard, how long ago, ±px, when it last heard
  them), effort against budget, flanks, guesses and the current kind, failed guesses, whether it tried the other way, sounds taken for
  theirs, revisions; or how the last hunt ended. Counts and kinds only — never a line of speech.
* **Dithering** (`tools/thrash_pr.js`: three long scenes × three hungers × 6 seeds × 240 s): with no flank spot R3 held its ground for
  one think, then came on (a 0.1 s flicker of watching, 14 A > B > A switches in the watched hall at .75); it now takes its next answer at
  once. A glimpse lost at the edge of its sight for under 0.6 s no longer ends an approach or a chase (approach > listen > approach in under
  a second). At a flank spot it settles 0.6 s, crouched, before coming on (a one-tick crouch before).

| Run | Result |
|---|---|
| `tools/thrash_pr.js` (`evidence/r4_thrash.*`) | plan changes 0.7–2.3 a minute on average per scene and hunger (0–3.8 in single runs); plans under 0.3 s at most 2 in a 4-minute run (most are its very first decision after the first sighting); A > B > A inside 2 s at most 2 in a run (0 in the watched hall and the hiding scene); acts shown under 0.1 s at most 2 in a run (R3 before the fixes, 2-minute runs: up to 10 short plans and 14 A > B > A per 3 runs in the watched hall at .75) |
| `s_skinpredator.js` | 21 / 21 (`evidence/r4_suites.txt`) |
| `s_skinstealer.js`, `s_skinbehave.js` | 34 / 34, 19 / 19 |
| `s_hound.js`, `s_smiler.js` | 30 / 31; H07 inherited (`evidence/r4_hound_smiler.txt`) |
| `tools/repro_r0.js` (`evidence/r4_repro.*`) | watched at .75: no departure in 45 s (0 / 8), 6 kills of a person who only stands and stares; .95 / 1.0: 8 / 8; unaware at .5 in light: 8 / 8 hunted; a fresh runner still wins every race |
| static checks (`evidence/r4_checks.txt`) | PASS (window contract, parts, build:check include the two page scripts) |

### Test measurement changes (no contract change)

| Scenario | Before | Now | Why |
|---|---|---|---|
| PR08 | the first guess 200 px or more from the last sighting, northward | an interception 200 px or more *along its predicted way*, or a look 150 px or more on, northward | a predicted way can turn back round a wall: one guess 768 px along its way lay 150 px from the start, behind them in a straight line |
| PR10 | 8 seeds, at least 5 judged | 12 seeds, at least 5 judged | with the 0.6 s grace fewer runs in 8 make a wrong interception; the judgement is unchanged |
| PR17 | still from 0.05 s into a listen | from 0.3 s | it stops from a walk; it does not halt in one tick |

Balance (R4 review): no value changed for balance in R4. The measured picture is in `BALANCE_TABLE.md`; the open questions for the owner
are listed in `DEFERRED.md` (R8).

## R5 — its size on the page

Changed: the Skin-Stealer's page script only — `src/frameworks/nani/client/skin.head.js` (one constant, `BODY_SCALE`) and
`src/frameworks/br-r/client/skin.body.js` (it applied in `newView`; a minimal pose correction), rebuilt into `public/assets/skinstealer.js`;
the `assets/skinstealer.js` note; PR23; `tools/scale_lineup.js` (new); `tools/repro_r0.js` and `tools/scale_browser.js` now record a
folder's name, not its path. The server — the body (radius 24, clearance 21), the grab and the pounce, routes — is unchanged.

* **One scale**: `BODY_SCALE = 1.3` (the pack's 1.2–1.35), defined once in the script's head and set on every view of the undisguised body,
  which `newView` makes: the living one, our own death's attacker and a replay's. A borrowed skin is the page's own Wanderer avatar and is
  never scaled.
* **Minimal pose correction** (readable from above; no new art): a standing leg is foreshortened — shorter, the foot under the hip — so the
  knees no longer splay out to the sides (the squatting, frog-like outline at Trial 3); hanging arms lie close along the body and fold in
  when it crouches; the arms stay low until the strike (no raised-arms figure while it creeps or chases).
* **Collision honesty**: a larger drawing over the same body is in the player's favour — nothing reaches farther than it did. Against a
  wall the part of the drawing past the wall's face is under the wall (the doorway screenshots); a kill's attacker is posed by the death's
  own physics, as before.

| Run | Result |
|---|---|
| `tools/scale_lineup.js` before (on `4518f93`) and after, the same camera, no overlay (`evidence/r5_lineup_*`, `r5_shots/lineup_before_after.png`) | standing: 49.6 × 61.6 → 55.0 × 77.6 world px; creeping 55.1 × 60.9 → 62.4 × 77.3; winding up 64.0 × 53.6 → 70.3 × 70.1; a Wanderer 39.7–40.0 × 59.2–59.5 (with its torch); a Hound 85.9–86.4 × 164.8–168.5 (moving); in a skin 45.5 × 37.5–37.7 at its own scale 1 both before and after (the Wanderer avatar, nothing in its hands) |
| doorway and wall (`r5_shots/doorway_before_after.png`) | standing in a 160 px doorway it fills more of it; facing a wall as close as its body lets it stand, the part past the wall's face is hidden under the wall — no limb drawn across the wall |
| `tools/scale_browser.js` after (`evidence/r5_scale_after.*`; before: `r0_scale_before.*`) | 54.9 × 77.5 world px at scale 1.3 (R0 49.6 × 61.5 at 1), a Wanderer 40.1 × 59.8, a Hound 86.2 × 162.5 |
| Trial 3's `skin_browser.js` t5 before / after (`evidence/r5_skin_browser_t5_*.txt`, `r5_shots/gallery_*`) | 5 / 5 both: every act and the three deaths drawn, BR-RoLE's actor shadows, the debug block, its sounds; no page error |
| Trial 3's `skin_browser.js` t1 + t4 after (`evidence/r5_skin_browser_t1t4_after.txt`, `r5_shots/kill/`) | 19 / 20: one t4 timing case (`t4_victim_frame_is_the_corpse`, no last frame captured); a rerun of t4 failed `t4_spectator_replay` instead — and t4 on `4518f93` fails the same case (`r5_skin_browser_t4_before.txt`): the scene's random monsters and SwiftShader timing, not the size; R6 runs the browser checks again |
| `s_skinpredator.js` | 22 / 22 (PR23: `BODY_SCALE` 1.3, every undisguised view scaled, the skin not, the server's body and reach unchanged) |
| `s_skinstealer.js`, `s_skinbehave.js` | 34 / 34, 19 / 19 |
| static checks (`evidence/r5_checks.txt`) | PASS |

## R6 — several people, parity, stress, cost

Changed: the species (`skDecide` drops the per-person records of people who have left the game — when it left them, the effort it spent
on them; `onFar` and `onClear` forget the no-flank place), rebuilt; the `ai.js` note; PR22, PR24, PR25 (the in-tree part), PR26;
`tools/perf_pr.js`, `tools/predator_browser.js` (new); the drafts of the final documents. No balance value changed.

| Run | Result |
|---|---|
| `s_skinpredator.js`, `s_skinstealer.js`, `s_skinbehave.js` (`evidence/r6_suites.txt`) | **79 / 79**: PR01–PR26, SK 34, BR 19 |
| PR22 its deaths in a hunt | 12 / 12 people killed in three scenes (the hall unaware, the hall watched, a corridor): one kill event each, one server corpse each even though the victim left the game at once, it fed after every one; deaths B and C seen (A at arm's reach, SK33); disguise and speech: SK40–SK44 |
| PR24 stress | 120 s, 8 people (walking, running, crouching, torches on and off), 4 hungry ones: 7 hunts, 6 kills; route plans per creature a second mean 0.07, p95 0.25, worst 0.5; most held at once: failed places 0 (cap 4), failed turns 0 (cap 3), effort records 1 (cap 6), sounds 8 (the engine's 8); no hunt of somebody gone; nobody inside a wall |
| PR25 (in-tree) | `ai.head.js`, `ai.senses.js`, `ai.intelligence.js`, `ai.engine.js`, `ai.capture.js`, `ai.entity.js`, `ai.hound.js`, `ai.smiler.js` byte for byte `4518f93`'s; with no Skin-Stealer its tick never ran (20 s, the director's Hounds and Smilers, 4 players) |
| PR26 cleanup | the quarry leaving the game, an admin clear, everyone far, a removal, a world reset: hunt, plan, guesses, effort records and departures gone; its snapshot entry `a,ac,h,i,s,v,x,y` |
| P9 equivalence (`evidence/r6_equiv_p9.txt`) | PASS: 6 / 6 seeds identical tick for tick against `1ff9374` (7200 snapshots: every Hound, Smiler, player, kill and body) |
| `npm test` (`evidence/r6_npm_test.txt`) | 228 / 241; the 13 failures are R0's inherited ones, name for name |
| `npm run test:humanqa` (`evidence/r6_humanqa.txt`) | 5 / 6, X03 inherited |
| `tools/perf_pr.js`, 3 interleaved rounds (`evidence/r6_perf.*`, `PERFORMANCE.md`) | PASS: no Skin-Stealer −9.2 % (same cost); one −10.5 %; four −0.4 % mean / +8.8 % p99 within the 60 Hz budget; four pressed −2.5 %, four starving −23.7 % against the base; 0 invariant violations in 30 runs |
| soak 600 s (`evidence/r6_soak.*`) | PASS: four starving, eight players; mean 0.185 ms, p99 1.04 ms, worst 30.9 ms; 0 violations |
| static checks (`evidence/r6_checks.txt`) | PASS (build:check 44 outputs, parts, modules, facts, window contract, docs, API contract, scope) |
| the fast gate (`evidence/r6_gate.txt`) | **PASS**, 21 / 21 steps; the full tier not run (no shared scope; pack 09 rule 5) |
| `tools/predator_browser.js` (`evidence/r6_predator_browser.*`, `r6_shots/`) | 7 / 7: footsteps of a running page behind a wall → it stopped and listened, went quietly to look (anonymous), found them, hunted them; the quiet crouched page never in a plan or a hunt; no name before a sighting; the HUNT line drawn; snapshot fields `a, ac, dg, h, i, s, v, x, y`; no page error (after six development runs that corrected the scene and the check: `REGRESSION_REPORT.md`) |
| Trial 3's `skin_browser.js`, every section (`evidence/r6_skin_browser.*`) | 37 / 40: t4's intermittent timing case (as on `4518f93`), and one t6 setup miss (no open floor in the creature's view to put the listener: `lAt2` null) failing two t6 cases; t6 again 6 / 6 (`r6_skin_browser_t6_rerun.*`); a t6 run on `4518f93` for comparison stopped on a closed page, no result (`r6_skin_browser_t6_base.txt`) |
| B1–B5's `behave_browser.js` (`evidence/r6_behave_browser.*`) | 9 / 9 |

## R7 — independent review and fixes

**The review.** A fresh agent that had not seen the work reviewed `4518f93..7e85e94` against the owner's rules and pack 09's seven
questions, read-only, running the suites and its own probes (its report, verbatim: `evidence/r7_review.md`). On the seven questions it
found no reading of unsensed truth, no strike without its wind-up, sight, stamina and the collider, guesses only from belief, no unfair
appearance against the collider, the Hound, the Smiler and the snapshot unchanged, and the disguise untouched. It found two MAJOR and
three MINOR problems and some NITs. Each is reproduced, fixed or answered below; the new scenarios fail on the R6 code
(`evidence/r7_new_checks_on_r6_code.txt`: PR27 0 / 8, PR28 1 / 6, PR29 0 / 6, PR30 1 / 4) and pass on R7's.

| # | Finding | Disposition |
|---|---|---|
| 1 MAJOR | after a lost race the shadow (the runner's speed + 30 px/s, Trial 3's pace for coming up on a walker, stamina-free up to 200 px/s) closed on a runner once winded (148 px/s): the race was won only for the length of a sprint; `DEFERRED.md` item 2 and the SK22 wording overstated the safety | **fixed**: on a runner's trail after a lost race it goes at `SK.shadowPace` = .85 of their speed (creep .. 200 px/s), so a person who keeps moving keeps their lead; only one who stops is reached. **PR27** (new): a runner sprints until winded and walks on — never closer once winded (8 / 8; on the R6 code 0 / 8). SK22's comment, `DEFERRED.md` 2, `DESIGN_DECISIONS.md`, `HUMAN_QA.md` part 6 corrected |
| 2 MAJOR | the effort record was replaced, unsaved, when its attention moved to somebody else: a glimpse of a second person refilled the first's budget, so effort was finite only within one uninterrupted encounter | **fixed**: `skEnc` keeps the outgoing person's effort (`skKeepSpent`) before it turns to somebody else; leaving saves the current one as before. **PR28** (new): A's effort is still A's after it turned to B and when it sees A again (6 / 6, five runs where it turned to B judged; on the R6 code A's effort was gone) |
| 3 MINOR | the cooldown of a person it had left was erased (and counted as "taken up") before the decision, even when it then kept its departure | **fixed**: the record is dropped only when it really begins something else about them. **PR29** (new, without setting any state: it leaves two people together and they step into its view again): still leaving 6 / 6, the person it left still left alone, none counted (on the R6 code all 6 erased) |
| 4 MINOR | PR24 and `PERFORMANCE.md` counted only the engine's `plan()` routes, not its own flank-spot and prediction searches (and PR24's scene ran neither); a flank spot could be searched for and then not used | **fixed**: PR24 counts every route searched inside its tick and has two more scenes (four watched in the lit hall: flanks and places with no way round; a person seen and then lost, eight times: guesses); a flank spot is searched for only when going round would really be begun. **Not changed**: the flank's own route is still planned again when the flank begins (the engine's shared `plan()` smooths and stores it; at most 3 flanks a hunt) |
| 5 MINOR | an admin summon was undone by the hunt's next step | **fixed**: a summon ends the hunt (as the admin clear does). **PR30** (new): 4 / 4 go toward the summoned place (on the R6 code 1 / 4) |
| NIT | a hunt begun from a remembered record started its belief "now" | **fixed**: the belief is as old as the record |
| NIT | a local `S` hid the engine's state names | renamed |
| NIT | SK16, SK31, PR05 titles claimed more than they check | titles now say what is checked |
| NIT | the container's absolute path to the repository in evidence (`r0_npm_test.txt`, `r6_npm_test.txt`, `r0`–`r4_repro.json`, `r0_scale_before.json`) | replaced by the folder's name (the results unchanged) |
| found re-running R7's checks (not the reviewer's) | `tools/repro_r0.js` did not run since R5: R5's edit to record only the folder's name put a `//` comment in the middle of a line, which swallowed the rest of it (R5 and R6 did not re-run the tool, so nothing showed it) | fixed; every tool syntax-checked; the tool re-run on R7 (`evidence/r7_repro.*`) |

Changed: the species (`ai.skinstealer.js`: `SK.shadowPace`, `skEnc`, `skDecide`'s retake and flank-spot order, `summon`, `skHuntBegin`,
the header's R4–R7 paragraph) and its build; the `ai.js` note; `s_skinpredator.js` (PR24 rewritten, PR27–PR30, PR05's title);
`s_skinstealer.js` (SK16's and SK31's titles, SK22's comment); `tools/repro_r0.js` (the syntax fix); the documents.

Checked on R7's code:

| Run | Result |
|---|---|
| `s_skinpredator.js`, `s_skinstealer.js`, `s_skinbehave.js` (`evidence/r7_suites.txt`) | **83 / 83**: PR01–PR30, SK 34, BR 19. Notes that changed from R6: SK22 the runner 932–968 px ahead after 14 s (R6 698–733); PR05 reached after stopping at the hall's end 6 / 8 (R6 8 / 8); PR20 out of sight and silent, let go 8 / 8 (R6 7 / 8) |
| PR27 | 8 / 8: the race lost 448–458 px behind; winded at 9.5 s, 838–1057 px ahead, walking on to the hall's end at 23.9 s — never closer once winded than when winded; none taken while moving |
| PR28 | 6 / 6 (5 judged): A's effort 3.85–3.97 s kept while its attention was on B; A seen again, their effort 3.81–3.92 s (halving every 90 s), not 0 |
| PR29 | 6 / 6: it kept its departure each time; the person it left still left alone, none counted as taken up |
| PR30 | 4 / 4: no hunt after the summon; 894 / 646 / 865 / 923 px off → 506 / 323 / 512 / 532 px 4 s later |
| PR24 (every route it searches) | mixed 0.07 / 0.25 / 0.5 a creature a second (mean / p95 / worst); watched 0.08 / 0.25 / 1.25 (1 flank, 4 places with no way round); seen then lost 0.20 / 2 / 3 (12 guesses) — `PERFORMANCE.md` |
| `npm test` (`evidence/r7_npm_test.txt`) | 232 / 245; the 13 inherited failures, name for name |
| `npm run test:humanqa` | 5 / 6, X03 inherited |
| `s_hound.js`, `s_smiler.js` | 30 / 31, H07 inherited |
| P9 equivalence (`evidence/r7_equiv_p9.txt`) | PASS, 6 / 6 seeds tick for tick |
| `tools/repro_r0.js` (`evidence/r7_repro.*`) | as at R4 except: the race row's kills 6 (R4 7); closest distances in the .95 / 1.0 watched rows within a few px |
| static checks (`evidence/r7_checks.txt`) | PASS |
| the fast gate (`evidence/r7_gate.txt`) | **PASS**, 21 / 21 steps |
| `tools/predator_browser.js` (`evidence/r7_predator_browser.*`) | 7 / 7: it heard the running page behind a wall, listened, went to look (anonymous), saw them and watched them; no name before a sighting |
| B1–B5's `behave_browser.js` (`evidence/r7_behave_browser.*`) | 9 / 9 |
| `tools/perf_pr.js`, **one round** (`evidence/r7_perf_check.*`) | **FAIL** on one judgement: four creatures, every player pressing one, mean +14.2 % against the base (0.420 against 0.367 ms; p99 −11.6 %); every other configuration no worse (−3.1 % to −17 % mean), 0 violations. One round cannot tell this from noise — the base's own mean for this configuration was 0.414 ms at R6 and 0.367 ms here, and R6's spreads were 0.06–0.07 ms — so, as pack 09 rule 7 asks, the interleaved 3-round matrix is run on R7's code; its result is recorded in R8, and this first result is kept |

## R8 — final documents and receipts

Changed: documents and evidence only (no game change): the R7 performance matrix run twice on R7's code (`evidence/r7_perf.*`: the
tool's FAIL on one judgement — with four, p99 4.49 ms over the 4.175 ms line, the base 4.59 ms over it in the same rounds — and
`r7_perf_run2.*`: PASS; `PERFORMANCE.md`); R7's read-back and scan; `DEFERRED.md`'s known items; every final document read through.
(Already in R7's commit: `tools/predator_browser.js` names its screenshot without a checkpoint; the R7 run's, made as
`r6_hunt_overlay_640.png`, was renamed `r7_shots/hunt_overlay_640.png`.)

| Run | Result |
|---|---|
| `tools/perf_pr.js` on R7's code, 3 interleaved rounds, twice | run 1 **FAIL** (the absolute p99 budget with four: both trees over it; against the base +5 % mean, −2 % p99); run 2 **PASS**; four creatures with every player pressing −7.5 % / −7.1 % (the one-round flag was noise); 0 violations in 60 runs |

**Delivery.** Branch `trial-3-predator-refinement`, created from `4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a` (tree
`28815b06019ed38aff8c083e93b1ba7056da3d67`); R0–R7 as in the table above, each read back from GitHub. This commit is R8; the receipt
commit after it carries R8's read-back. The full gate tier was not run: pack 09 keeps it for new shared scope, and this branch changes
no shared code (PR25; the fast gate PASS at R6 and R7). Nothing was merged or deployed; no protected branch moved
(`trial-3-skin-stealer` `020b5b5`, P9 `1ff9374`, `main` `7781e1a`, `trial-3-behavior-refinement` `4518f93`: every read-back).

**Stop.** ENGINEERING COMPLETE — AWAITING OWNER HUMAN QA. Trial 3, the B1–B5 refinement and this predator refinement remain NOT
OWNER-APPROVED. No OVERSEER work was begun; no organic spawning was added.

