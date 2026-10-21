# R7 independent review — the reviewer's report (verbatim)

A fresh agent that had not seen the work, given only the repository, the baseline `4518f93`, the head `7e85e94`, the owner's rules
and pack 09's seven review questions; read-only (it ran tests and its own probe scripts outside the repository). Its report follows as
it was returned; two machine paths are shortened to `<worktree>` and `<review scratch>`. The disposition of every finding is in
`../CHECKPOINTS.md` (R7).

---

## Independent review: trial-3-predator-refinement, 4518f93..7e85e94 (runtime focus)

**Verdict:** I found no evidence leak, no Hound/Smiler or snapshot change, and no change to the disguise path. Two MAJOR problems undercut what the branch claims:
- **The "won" straight race still ends in death.** After losing the race the creature follows ("shadows") the runner at no stamina cost and reaches them once their stamina runs out.
- **The per-person effort budget resets** whenever the creature's attention switches to another person, so the "carried effort" fix does not hold with more than one player.

There are also three MINOR issues and some NITs, listed below.

### What I ran
- `node dev/tools/build/build.js --check` passes (it builds in memory and writes nothing).
- `node dev/tests/run.js s_skinpredator.js s_skinstealer.js s_skinbehave.js`: **79/79 PASS** in about 2.5 minutes. Output is in `<review scratch>/suites.txt`.
- `git diff --stat 4518f93 HEAD -- src/` shows only four files changed. Under `src/frameworks/nani/server/`, only `ai.skinstealer.js` changed. All hunks in `generated/server/ai.js` are inside the Skin-Stealer section.
- I wrote probe scripts that run the real harness without writing to the repo; they are in `<review scratch>/probes/`: `race.js`, `paths.js`, `paths2.js`, `paths3.js`, `pr24.js`, `left3.js`, `enc.js`, `enc2.js`, `summon.js`.
- **Another process was editing the worktree during my review.** `CHECKPOINTS.md` was modified at 03:57 (it adds an "R7 independent review" row), and `evidence/remote/r6.json` and `evidence/scans/r6_post.txt` are untracked. At the end, `src`, `generated`, `public` and `dev/tests` still matched HEAD 7e85e94, so my results apply to that commit.

## Findings

### 1. MAJOR: the post-race "shadow" runs down a fresh runner who won the straight race
- **Where:** `src/frameworks/nani/server/ai.skinstealer.js`
  - `:1139`: a lost race now switches to an approach with `shadow: 1` instead of leaving.
  - `:1025`: the approach weight stays at 1 for a fleeing person while shadowing.
  - `:1122-1124`: the pace is the seen speed + 30, capped at `SK.runFrom` (200 px/s), which costs no stamina.
- **What happens (`race.js`, PR05's own scene):**
  - The creature loses the race at 3.5 s.
  - The runner's stamina runs out at about 9.9 s (10.5 per second drain), and they drop to 148 px/s.
  - The creature keeps pace at 178 px/s with no stamina cost and refills its stamina to 100.
  - The gap shrinks from 855 px to 694 px while the runner is still moving.
  - The runner is killed at 23.6 s.
- **The author's own numbers agree:** PR05 reports 8/8 killed, SK31 5/6 taken after stopping, PR20 6/6 killed.
- **The documents overstate the safety:**
  - `DEFERRED.md` item 2 says a runner "who keeps running pulls away (85 px/s faster) and wins". A player can only sprint about 9.5 s.
  - `CHECKPOINTS.md:76` and `REGRESSION_REPORT.md` describe the new SK22 check as "the gap never closes while they run". The assertion only checks that the gap stays above its value at the moment the race was lost, over 14 s. My trace shows it closing at about 30 px/s.
- **Suggested fix:**
  - Cap the shadow pace at or below the player's exhausted walk (≤ 140 px/s), or drop the +30.
  - Or end the shadow after a set time, or when the gap is not growing.
  - Make SK22 run until the runner is exhausted and assert the gap does not shrink.
  - Correct DEFERRED item 2.

### 2. MAJOR: effort carried for a person is lost when the creature's decision switches to someone else
- **Where:**
  - `skEnc` (`:340`) replaces `e.enc` for a new person without saving the old one.
  - `skKeepSpent` (`:349`) is only called from `skLeave` and a strike hit.
- **What happens:**
  - `enc2.js`: A has 83.7 s of effort spent. B is seen alone for 0.5 s, then A is seen again. A's encounter restarts at 0.3 s and A is missing from `e.spent` (3 of 4 seeds).
  - `enc.js`: with A and B in view together, `skLeave(B)` saves B's near-zero effort and throws A's 83.7 s away (2 of 3 seeds).
- **Why it matters:** the per-person budget (now up to 120 s, about double the old one) can be refilled by glimpsing any other person. Effort is finite only within one uninterrupted encounter, not across a multiplayer game.
- **It contradicts the branch's claims** in `CHECKPOINTS.md:48`, `DESIGN_DECISIONS.md:21-22` and `dev/tools/gate/declared_changes.json` ("leaving and coming back resets nothing").
- **Context:** the single-encounter mechanism existed at the baseline (pre-existing). This branch relies on it and claims to have fixed it.
- **Suggested fix:**
  - In `skEnc`, save the old encounter into `e.spent` before replacing it.
  - In `skLeave`, save the effort of the person being left, not whichever encounter happens to be current.
  - Add a test where two people come into view alternately.

### 3. MINOR: a departure that is kept still erases the person's cooldown
- **Where:** `:991` removes the person from `e.left` and increments `tally.reengage` before the departure check at `:1037-1038`, which can decide to keep leaving.
- **What happens (`left3.js`, forced state):** in 5 of 6 seeds the log says "it keeps going", yet the cooldown (7 s left) is erased and `reengage` becomes 1. When that departure ends, the person can be hunted at once. This skips the rest of the cooldown and the 0.85 × budget check in `skMayHunt`, and inflates a counter used as evidence.
- **Suggested fix:** delete from `e.left` only when a hunting plan about that person is actually begun.

### 4. MINOR: the "route planning stays bounded" evidence does not cover the new route searches
- **Where:** `eng.stats.paths` is only incremented in `plan()` (`ai.entity.js:114`). `skFlankSpot` (`:483`, up to 2 searches) and `skPredict` (`:579`, up to 4) call `geo.path` directly and are not counted.
- **What happens (`pr24.js`):** in PR24's own scene all 36 searches were ordinary `plan()` calls; flank and prediction searches never ran. So PR24 and `PERFORMANCE.md` do not test what they claim to bound.
- **A related inefficiency:** `skFlankSpot` runs at `:1035`, before the "keep the current plan unless something is clearly better" check at `:1041`. A spot can be found and then thrown away, on every think.
- **How bad it is in practice:** in my probes it stayed at 3 or fewer searches per second. The flank-or-bait preference term pushes the flank weight far above or below the other options, so it rarely sits near that threshold. It is bounded per think, but not per encounter.
- **Suggested fix:**
  - Count direct `geo.path` calls in the metric.
  - Add a stress scene that actually triggers flanks and guesses.
  - Compute the flank spot only after the hysteresis check.
  - Reuse the route `skFlankSpot` already found instead of planning again at `:1057`.

### 5. MINOR: the admin summon is ignored while a hunt is in progress
- **Where:** `SKIN.summon` (`:291`) clears the plan and sets a roam goal. But `skAct` (`:1085`) holds still whenever a hunt exists, and on the next think the hunt makes its own plan.
- **What happens (`summon.js`):** in 3 of 3 seeds with a hunt, the creature moved away from the summon point (for example 894 px → 1012 px). Without a hunt it went (646 px → 323 px).
- **Suggested fix:** end the hunt in `summon` (`skHuntEnd`), as the admin clear does. SK08 does not cover this case.

### 6. NITs
- `:407`: a hunt begun from a remembered (not currently seen) record sets the belief time to now, so belief age and extrapolation restart. Use the record's last seen or heard time instead.
- `:426`: the local `const S = e.mem.sounds` shadows the engine's state enum `S`.
- `:1057`: starting a flank searches for a route that `skFlankSpot` already found.
- Test titles now claim more than they check:
  - SK16 says the watcher is "never taken" (1 of 4 taken later).
  - SK31 says "a fresh runner gets away" (5 of 6 taken after stopping).
  - PR05 says "a fresh runner still wins" (8 of 8 die).
  - Each changed assertion does carry a reason comment, as required.
- Evidence files contain the absolute sandbox path `<worktree>`:
  - `r0_npm_test.txt:220`
  - `r6_npm_test.txt:220,308`
  - `r0..r4_repro.json` (`"repo"`)
  - `r0_scale_before.json` (`"dir"`)
  - There are no secrets, e-mails or IP addresses (only 127.0.0.1), and the only passcode is the synthetic `k3-synthetic-admin`.

### Fine (checked by reading, or covered by passing tests)
- **Senses only:** the added lines read only `eng.byId.has` (for players leaving, `:352` and `:968`) and `r.visual`, which is only used when the person is seen (`:189`, `:1106`).
- **Debug data:** the new `ht` block is sent only to admin clients with debug on (`loop.js:37-38,60-64`).
- **Spawn and snapshot:** SK02–SK05 pass.
- **Cleanup:** PR26 passes; the new maps are pruned and capped.
- **Client input:** movement event values are clamped server-side (`sim.movement.js:41`), and the hunt code clamps intensity again.

## The seven questions
1. **Can it infer unsensed real coordinates through `eng.playerById`, proximity, LOD, collision contact, client velocity or debugging? NO.**
   - It reads no truth source.
   - Contact is only used for the strike's physics (pre-existing).
   - Velocity is only read from sight records.
   - Going to the far level of detail only ends the hunt (`:277`), which cannot help it find anyone.
   - The tests showing it behaves identically until its evidence differs (PR08/11/13/15) pass.
2. **Does any stronger behaviour bypass stamina, line of sight, the collider or the wind-up? NO direct bypass.**
   - Every strike goes through `skSpring` with its wind-up, needs the person in sight and a clear line, and costs stamina (PR07/PR21 pass).
   - The flank moves at 170 px/s through the collider.
   - However, the shadow uses the stamina-free speed band (pre-existing `runFrom` 200) to defeat the won race (finding 1).
3. **Are predicted exits based on a future scripted route or global actual player state? NO.** `skGuess` and `skPredict` take only `skBeliefRec(H)` (sightings or anonymous sound positions) plus static geometry. PR08 and PR09 pass: the same guess whatever way the person really went.
4. **Can high hunger pin a corridor indefinitely or spam pathfinding?**
   - **Pinning: PARTLY.** One encounter is finite (2–4 guesses, the 10–30 s forget time, a budget of at most 120 s). But effort resets on a switch of person (finding 2).
   - **Pathfinding: NO spam observed** (at most 3 searches per second), but the metric does not count the new searches (finding 4).
5. **Did the visual scale change leave unfair appearance-versus-hitbox gaps? NO.**
   - From the drawing code, the 1.3× body measures about ±26 px sideways and ±39 px front/back, against a collider radius of 24. The collider is never larger than the drawing.
   - The drawing now exceeds the collider by about 15 px front/back, so it overlaps walls slightly (visible in `r5_shots/doorway_before_after.png`). That is cosmetic.
   - The disguise uses the page's own unscaled avatar (PR23).
   - I concluded this from reading the code and the screenshot; I did not measure it in a browser.
6. **Are the Hound and Smiler unchanged byte for byte, and player snapshots stable? YES.**
   - Engine, Hound and Smiler sources are unchanged (git diff and PR25).
   - The Skin-Stealer's snapshot function and `loop.js` are unchanged; SK04 passes.
   - I did not run `equiv_p9.js`, which needs a separate P9 tree.
7. **Is the disguise only the validated killed player's look, never their identity or privileges? YES.** The skin code (`skSkinFrom`, the look check, `skDon`, the snapshot) is not touched by this branch, and SK42–SK44 pass.
