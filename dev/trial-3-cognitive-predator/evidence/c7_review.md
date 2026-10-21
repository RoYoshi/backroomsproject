<!-- The independent reviewer's report, verbatim except that absolute machine paths are replaced by <REVIEW> (its own folder, now evidence/c7_review/), <this repository>, <R8 tree> and <R8 runner>. -->
# C7 — Independent adversarial review of the Skin-Stealer cognitive refinement (HEAD d708f42, base R8 f378049)

This is engineering evidence only. It is not owner acceptance.

Paths used below:
- `REVIEW` = <REVIEW> (my scripts; retained outputs in `REVIEW/out/`)
- `NEW` = <this repository>/dev/tests/lib.js (this build)
- `R8` = <R8 tree>/dev/tests/lib.js (R8 tree)
- Every experiment is run as `cd REVIEW && node <script> <NEW|R8>`. The worlds are deterministic, and a second run reproduced every number below.

## Verdict

**Not ready for owner handoff as it stands.**

What holds up:
- The scope is clean: only the species file changed, and the generated build mirrors it line for line.
- I found no new perception leak in the new tactics. Paired invisible worlds were identical in 24 of 24 runs.
- PR27 and PR28 hold, including a no-race lead that I tested beyond C10's range.
- The wind-up can really be dodged, with up to about 0.35–0.40 s of reaction.
- Route searches stay bounded.
- The red performance runs are kept in the documents.

What does not hold up:
1. **One protected perception law is broken in the owner's test band.** The creature's chase choice reads a seen person's exact stamina number. That inherited R8 shortcut used to apply only from .6 hunger; this build widens it into .4–.6 (the admin spawn range).
2. **The creature springs at people who are together.** It does so from a group stand-off, against the author's own law that "people together are never come at".
3. **The C4 hunger gradient is mostly bypassed.** A person the creature passes over gets hunted anyway as soon as they walk out of view.
4. **A watcher who keeps staring gets about a minute of a motionless creature.** It stands 200–230 px away for 53–63 s. The documents describe this as a 3.5–8 s stand-off that "shifts its ground"; it does not move.
5. **The headline real-page comparison is wrong.** "12 of 14 kills vs R8 3 of 11" is miscounted (the final pass is actually 13/14 vs 3/12). It also rests on one selected pass; the earlier valid pass points the other way.

On the evidence, this build behaves **differently and is more lethal** in the owner's watched, circling and hide scenes. Whether it **chooses better** is not established: the scripted pages never dodge, never improvise, and run n = 2–3 per scene.

## Answers to pack 09's questions

**1. Better choices under live conditions, or just faster decisions and more kills?** Mostly more kills in specific scenes. Better choices are not demonstrated.

- **Real pages, final pass (`tools/c6_summary.py`):**
  - Lookaway: this build 3/3 kills, each during or within 0.7 s of the first look-away. R8 went retreat/approach/leave (1 kill in 2).
  - Pillar: this build 3/3 kills, with cut-offs at 13.0, 7.4 and 11.1 s. In tries #1 and #3 the first strike (5.5, 5.6 s) came before the cut-off. Only in #2 (cut-off 7.4 s, strike 8.3 s) could the cut-off have decided the kill.
  - Escape: this build stood off, listened and searched, finding 2 of 3 hiders after 31–36 s. R8 left all 3 within 4.7–8.2 s. This is the clearest evidence-driven improvement, and C05's paired worlds support it.
- **The earlier v2 pass reverses the direction outside the pillar scene.** Only v2's pillar scene was declared faulty. On lookaway, fork, decoy and escape in v2:
  - R8 killed 6 of 12.
  - This build killed 4 of 14, with 3 of 3 fork survivals (F5).
- **Simulation, kills by scene** (`exp_gradient.js`, C12's seeds, 8 per hunger):

  | Scene | Hunger | R8 kills | This build kills |
  |---|---|---|---|
  | Watched, looks away 1.5 s every 9 s | .4 / .45 / .5 / .55 / .6 / .65 | 0 / 0 / 1 / 1 / 0 / 0 of 8 | 0 / 4 / 7 / 7 / 6 / 8 of 8 |
  | Unaware lit passer-by | .45 / .5 / .55 | 4/6 / 6/7 / 7/7 | 5/6 / 7/7 / 7/7 |

  The lethality increase is concentrated in the watched scene. Unaware passers were already ~100 % lethal on R8.
- **Speed:** visible movement after a sighting is unchanged at p50 1.4 s on both builds (C18a). Moving in on a turned back: R8 p50 0.77 s (4/12 runs), this build p50 0.87 s (9/12). Real-page samples come every 0.6–1.5 s and show look-away → movement ≥ 0.9 s (F9).

**2. Is every reaction from legitimate evidence?** No — F1 is the exception.

- **The leak (F1):** `skDecide` uses `winded = r.ex || r.stamina < 25` (ai.skinstealer.js:1178). `r.stamina` is copied from the real player on sight (ai.senses.js:144), but stamina is not visible.
  - Paired worlds differing only in a still, unexhausted, seen person's stamina (15 vs 100) diverge in 18/24 runs on this build (6/6 each at .5, .55, .65). On R8 they diverge in 6/24 (only at .65).
  - The divergent branch kills in 1.37–1.45 s instead of 5.7–5.9 s (`exp_stamina.js`).
- **New code is otherwise clean.** It reads only records, `r.visual`, static geometry and lamps, and `eng.byId` (housekeeping).
  - `skWatched` reads `eng.playerById`, but only on thinks, right after `sense()` in the same tick, so it matches what was seen.
  - `skCompany` only uses people seen in the last 4 s; `identifySound` never moves a record unseen.
  - `skCutPoint` and `skCircle` only use the creature's own sightings.
  - `skAim` only uses seen velocity.
  - `skLeaveGoal` uses beliefs.
  - The bold draw comes from its own stream.
- **Paired invisible worlds over the new tactics** (`exp_pair.js`): an unsensed crouched person in 3 different places, during stand-off/opening/press at .55/.7/.9 and pillar cut-offs at .55/.7/.9. **24/24 identical tick for tick** (1500 ticks each).
- **Inherited and not widened:** the R8 freeze still reads live facing per tick (`!skWatched` in `skAct` approach, :1391; up to 0.1 s ahead of the last sensing). Light felt on its body includes unseen people's torches, and tier/think rate depend on true player distance (engine).

**3. Can a bad tactic survive high-priority evidence?** The main inertia is the stand-off renewal (F4), bounded only by the effort budget: 5–9 renewals, ~60 s.

- **Interrupts that work:** lure (ends on "heard going away"), listen (ends on the follow-up sound; C04b 0.35 s) and departures (reconsidered twice a second from .45).
- **Twitch hold:** a look away shorter than the beat freezes every plan change for up to 0.35 s (:1272), including chase or leave. This is a NIT.
- **The cut-off decays on contradiction:**
  - A reversal ends it immediately (C06: 8/8 within 1 s).
  - A stop or a straight walk-off ends it within 1.2–2.7 s, with at most one extra cut started (`exp_circle.js`).
- **No stall at an inaccessible flank:** C03's corridor run moves at once, with at most 1 way-round search.

**4. Replanning storms or oscillation?** None found.

- C09, C14 and PR24 stay bounded.
- My probe ran 24 random "visible but no straight walkable line" pairs at .75 with look-aways (`exp_storm.js`): 0 failed route searches, worst second 2 searches (R8 also 2).
- Hypothesis only, not reproduced: in the stand-off executor, a failed route search would retry on every think (`!e.path.length`, :1355/:1364). R8's approach has the same pattern.

**5. Did it trade an R7 fix for a new bug?** Not for PR27 or PR28. The pounce is physically intact.

- **PR27:** C10 and PR27 pass. I added a no-race lead from beyond chase range (450/520 px) at .65/.75/.85 with the runner winded and then walking (`exp_lead.js`): 0 px erosion while seen, on either build. The only shrinkage was after the runner reached the hall's end, out of sight.
- **PR28 / cooldowns:** PR28, C13 (0 effort lost), C17 (effort never decreases) and PR29 all pass.
- **The pounce itself is unchanged:** 0.22 s wind-up, 0.36 s leap, line of sight to the aim point, stamina paid, contact only.
- **What changed is where it springs from:** springs are newly allowed from `stand` (a WATCHING-state plan) and from `cut`. That allows the group spring in F2.

**6. Hungry watchers get real risk and a real dodge? Satiated passers safe?** Risk: yes, steep. Dodge: yes. Satiated and mild passers: safe.

- **Risk:**
  - Watched with 2.5 s look-aways at .5–.62: 18/18 killed in C02 (R8 6/18).
  - A watcher who never looks away for 120 s: 6/12 killed (C17, reproduced). Four of those deaths come at 69–71 s, after hunger rises past about .65 and it starts creeping.
- **Dodge** (step aside at the tell, with a delay after the wind-up begins):
  - C11 scene (.8/.95, springs from ~170 px): escapes 21/21 at delays 0–0.40 s; 3/21 at 0.45 s; 0/21 at 0.5 s; 0/21 with no sidestep (`exp_dodge.js`).
  - C02's look-away kills (springs 160–170 px): 18/18 escape at delays up to 0.35 s; 0/18 with no sidestep (`exp_dodge2.js`).
  - 11 of those 18 springs came while the person's back was turned, so no human would see the tell.
  - The window is about 0.4 s after the wind-up starts, before network delay. That is real, but tight for a human.
- **Satiated and mild (< .4):** never hunt or strike (the strike requires hunger ≥ .4; C12 shows 0 kills at .1/.3).
- **The .4–.55 "only sometimes" claim does not hold for moving passers** (F3).
- **C6a's 12/14 is not a clean "earned" figure** (F5). The lethality cliff is real in the watched scene: R8 0–1 of 8 vs this build 4–8 of 8 between .45 and .65.

**7. Does circling inference need observed laps, decay on contradiction, and allow wrong predictions?** Yes on all three, with one weakness.

- It needs ≥ 2π of arcs it actually saw (samples ≤ 0.35 s apart, radius 90–420, fitted residual ≤ .25 R). C06's hidden laps teach it nothing; laps seen before the first guess were 6.5–9.8 rad.
- Back-and-forth pacing cancels out; an arc round a corner never reaches 2π. Circling the creature itself legitimately counts as "going round".
- A reversal undoes the belief at once; a stop or a walk-off undoes it in 1.2–2.7 s.
- **Weakness:** a wrong prediction does not save the player on this pillar. 8/8 reversers were caught within 2.5 s (F6).

**8. Scope, parity and test honesty.**

- **Scope is clean:**
  - Outside `dev/`, `git diff f378049` lists only the species file, `generated/server/ai.js` and the build manifest.
  - The generated diff lines equal the source diff lines.
  - The manifest's part hash matches the source (79dd3762…).
  - No game code changed after C5 (`git diff 776e853 HEAD -- src generated` is empty).
  - P9 equivalence evidence: 6/6 seeds.
  - The snapshot fields are unchanged (C16). The admin cap, spawning and disguise code are untouched (SK34/SK35 pass).
- **The adapted R8-era tests are documented:** SK21 and SK41 moved scenes because baits no longer happen at the gap, and SK17 is stronger but only for a pair standing still (F2 shows the hole). PR20 is weaker (F7).
- **C02's "engaged runs only" rule excused nothing** (18/18 engaged).
- **Tests that check labels or overclaim:**
  - C02 and C17 judge passivity by plan labels: `stand` counts as active even when the creature is motionless for a minute (F4).
  - C06's "can fool it" passes on 1/8 runs while 8/8 reversers die anyway (F6).
  - C12 pools its two scenes, which hides the C4 gate bypass (F3).

**9. Do the performance documents keep red results honestly?** Largely yes.

- **Correct:** this build's two red p99 runs (4.28 and 6.06 ms) and the one-creature p99 +59 % in run 2 (judged only against the 60 Hz budget) are reported.
- **Miscount:** run 1 had four red R8 runs, not three (F10).
- **Weak soak:** the 600 s soak exercises few of the new tactics, so C14 is the real stress evidence.

**10. Would a fresh human, without the overlay, say it thinks?** The evidence does not show that.

What the evidence does support:
- It now visibly holds a watcher in view, rushes on a look-away and springs.
- It cuts across a pillar.
- It searches for and finds a hider instead of leaving.

What the evidence does not support:
- That those read as intelligence rather than aggression.
- A real human plays differently from these scripted pages: they dodge, misdirect and walk up to it in pairs.

Risks a human would see:
- A one-minute motionless stand-off when stared at (F4).
- Pairs killed after walking up together (F2).
- "Passed over" people intercepted anyway (F3).

Owner Human QA is the only valid answer to this question.

## Findings

### F1 — BLOCKER — The chase choice reads a seen person's exact stamina; this build widens it into the hungry band

- **Location:** ai.skinstealer.js:1178 (`winded = r.ex || r.stamina < 25`). It feeds the chase weight at :1220 (now from `SK.band[1]` = .4; R8 only from .6) and the plan "P is winded: it closes in" at :1300. The value comes from ai.senses.js:144 (`r.stamina = p.stamina` on sight; shared code).
- **Defect:** stamina is not perceivable. A still, unexhausted person looks the same at 15 and at 100 stamina, and no breath sound was heard in either world. Yet the number flips the choice from approach to chase, and the kill comes in ~1.4 s instead of ~5.8 s.
- **Reproduction:** `node exp_stamina.js NEW` (two worlds identical except `p.stamina` 15 vs 100; person 330 px off, facing away, then crouch-walking off).
  - This build: DIFFERENT in 6/6 at .5, 6/6 at .55, 6/6 at .65 (0/6 at .45, where the creature did not engage).
  - R8: DIFFERENT only at .65 (6/6).
  - Outputs: `out/stamina_new.txt`, `out/stamina_r8.txt`.
- **Invariant:** pack 00 engineering law (no stamina as secret target truth); pack 04 invariant 8 (stamina listed as hidden telemetry); pack 06 void condition "hidden-truth reads".
- **Required fix:** derive `winded` from evidence only.
  - Drop `r.stamina < 25`.
  - Keep `r.ex` only if exhaustion is something a viewer can perceive (its 148 px/s walk, a breath sound), or use the seen speed falling below the walk speed after running.
  - This is species-local. It changes R8 behaviour at ≥ .6 too, which should be documented.
- **Regression:** `exp_stamina.js` must print `same` for every seed at every hunger. It fails on HEAD (18/24) and on R8 (6/24).

### F2 — MAJOR — The group stand-off springs at people who are together

- **Location:** :842 (`SK_STRIKE` now includes `stand` and `cut`); `skStrike` :844–865 has no company check; `groupHold` is set at :1283 but only gates the rush and press (:1352, :1363).
- **Claim broken:** CHECKPOINTS C2 and DESIGN_DECISIONS: "people together are never come at" ("Rejected: attacking groups").
- **Reproduction:** `node exp_group.js NEW` / `R8`. Two lit people 90 px apart stand facing it, then after 4 s walk together toward it.

  | Hunger | This build | R8 |
  |---|---|---|
  | .55 | 8/8 pounce from `stand` with `groupHold=true`, one person killed | no spring (8/8 leave) |
  | .7 | 6/8 pounce from `stand` with `groupHold=true`, one person killed | no spring (8/8 leave) |
  | .9 | 2/8 grabs from `retreat` | no spring (8/8 leave) |
  | Total | 16/24 | 0/24 |

  Outputs: `out/group_new.txt`, `out/group_r8.txt`. SK17 (adapted) only covers a pair standing still, so it cannot catch this.
- **Invariant:** the C2 lone-ambusher law and T3 SK17's intent. The pounce now fires from a WATCHING-state plan that the creature labels as keeping out of the way.
- **Required fix (either):**
  - No pounce from `stand` while `P.groupHold`, or while `skCompany(target) > 0` (the arm's-reach grab can stay, as it is owner-deferred).
  - Or have a group stand-off give ground when the group closes within `SK.near`.
- **Regression:** `exp_group.js` must show 0 pounces at .55 and .7 (fails 14/16 on HEAD). Add it as a new SK17b / C13b.

### F3 — MAJOR — The C4 hunger gradient is bypassed: passed-over people are hunted as soon as they leave view

- **Location:**
  - The `engaged` gate exists only in `skDecide` (:1229–1230).
  - `skLost` (:803–804) intercepts anyone it was watching who walks out of view while moving (h ≥ .4). `skIntercept` calls `skHuntBegin` (:779).
  - From then on `!!Hn` makes the person engaged (:1229).
- **Claim broken:** C4, BALANCE_TABLE and DESIGN_DECISIONS say that at .4–.55 it "goes for somebody it sees only sometimes … passed over, a mildly hungry one watches them a while and goes".
- **Reproduction:**
  - `node exp_bold2.js NEW` (C12's passer scene, 24 seeds per hunger, the draw judged at the hunger when drawn):

    | Hunger | Passed over by the draw | Hunted anyway | Killed anyway |
    |---|---|---|---|
    | .42 | 10 | 7 (6 via intercept, 1 via approach) | 3 |
    | .45 | 5 | 5 (all via intercept) | 3 |
    | .48 | 4 | 4 (all via intercept) | 4 |
    | Total | 19 | 16 | 10 |

  - Trace of one case: `node exp_bold.js NEW .45`, seed 7. Draw .633 vs chance .556 means passed over; it watches at 0.57 s, the person steps out of view, "lost P101: it guesses their way" starts an intercept hunt at 1.38 s, and the person is killed.
  - Split gradient: `out/gradient_new.txt` (passer at .45: 6/6 went for them, 5/6 killed).
- **Invariant:** pack 04 hunger table ("hungry: not guaranteed murder"); pack 03 Scenario 8; pack 00 outcome 4.
- **Required fix:** record "passed over" on the encounter and honour it in `skLost`/`skUnseen`: no intercept/search hunt for a passed-over person (let them go, or listen without hunting) until a new encounter or rising hunger re-qualifies the same draw.
- **Regression:** `exp_bold2.js` "hunted anyway" must be 0. It fails 16/19 on HEAD.

### F4 — MAJOR — A watcher who keeps staring gets a creature standing motionless at 200–230 px for about a minute; the documents describe something else

- **Location:** stand-off renewal at :1258–1264 (`best === 'leave' && standOver …` re-stands, bounded only by `spent < .85` of the budget); extension at :1201; `skVantage(..., shift=true)` rarely finds a new spot.
- **Reproduction:** `node exp_stare.js NEW` / `R8`; `node exp_stare2.js NEW` (C17's scene: lit hall, 450 px, the watcher never looks away, .5/.55, 120 s).
  - **This build, 10 of 12 runs:**
    - Standing still in the watcher's view 53–63 s (81–97 % of in-view time). The distance holds at one value, e.g. 207 px for 100 s.
    - 5–9 renewals; 178–414 px moved in total over ~56–65 s of `stand` (178–184 px in 7 of 10, mostly the first walk to a spot); 0–3 vantage spots used.
    - It then leaves at 64–69 s, or after hunger passes about .65 it creeps and springs (kills at 69–71 s).
  - **R8:** leaves at 6.8–16.8 s in 12/12.
  - Outputs: `out/stare_new.txt`, `out/stare2_new.txt`, `out/stare_r8.txt`.
- **Claims broken:**
  - DESIGN_DECISIONS and BALANCE_TABLE: "ends in 3.5–8 s … renewed from another dark spot".
  - C02 counts `stand` as not passive by its label alone, and C17 only checks that the stand-off ends within budget.
- **Invariant:**
  - The owner's "incredibly passive".
  - Pack 03 Scenario 1 ("change tactic quickly — not stand frozen for several seconds").
  - Pack 04 ("hungry: NOT merely watching without purpose").
  - Pack 06 C04 ("distinguish purposeful ambush wait from inert wait") and its void condition "tests validating internal labels instead of movement".
- **Required fix:**
  - Cap renewals (for example one).
  - Require each renewal to change something observable: a new spot, a flank attempt or a feint. Otherwise depart.
  - Add a movement-based metric (seconds still in view while hungry) to C02 and C17.
  - If the owner wants a long stare-down, put this timeline in the QA guide as an explicit owner decision.
- **Regression:** `exp_stare.js` with "standing still in view ≤ 15 s before a tactic change or departure" fails 10/12 on HEAD.

### F5 — MAJOR — The real-page comparison in CHECKPOINTS C6a and DESIGN_DECISIONS is miscounted and selectively sourced

- **Location:** CHECKPOINTS.md C6a ("12 of 14 valid tries ended in a kill (R8: 3 of 11)"; "No earned wrong guess in this pass"); the last paragraph of DESIGN_DECISIONS.md.
- **Reproduction:** `python3 -I -B dev/trial-3-cognitive-predator/tools/c6_summary.py evidence/c6_browser.json C6` (and `c6_browser_r8.json`), plus `evidence/c6_browser_summary.txt`. Four problems:
  - **The counts are wrong.** The final pass gives 13 kills in 14 valid tries (lookaway 3/3, fork 2/2, decoy 3/3, pillar 3/3, escape 2/3). For R8 it gives 3 kills in 12 valid tries (lookaway 1/2, fork 1/2, decoy 0/2, pillar 1/3, escape 0/3).
  - **The v2 pass runs the other way and was left out.** Only v2's pillar scene was declared faulty. On lookaway, fork, decoy and escape, v2 gives R8 6/12 and this build 4/14. That includes this build's fork 0/3: three survivals, which are the earned wrong guesses the text says were absent.
  - **Two decoy kills are not clean scene runs.** In this build's decoy #1 and #3, the hiding page A was held up on its way to its hiding place (moved 319 and 84 px, with 2 and 8 skips; the author's own note), yet both count as valid kills.
  - **Hunger is missing for three tries.** It reads `None` for lookaway #1, fork #1 and pillar #1, so ".45–.65" is unverified for them.
- **Invariant:** pack 09 truth standard (cite paired outcomes, preserve distinctions); pack 06 ("list missing evidence rather than declaring victory").
- **Required fix (documents only):**
  - Report per-scene results pooled over every valid pass, with n.
  - Correct the counts.
  - Mark stuck-page tries invalid.
  - Cite the v2 fork survivals.
  - State that n = 2–3 per scene cannot separate "smarter" from "deadlier".

### F6 — MINOR — C06's "a turn back can fool it" passes while every reverser dies

- **Location:** dev/tests/s_skincognitive.js:303–342 (`fooled.length >= 1`, no survival requirement).
- **Reproduction:** recorded C06 note: fooled 1/8, "caught within 2.5 s of the turn all the same 8". The pillar ring (radius 175) lies inside the spring reach (55–185 px plus lead) from the cut point.
- **Context:** R8 also killed 12/12 circlers (`evidence/c3_before_r8.txt`), so this is not a lethality regression.
- **Invariant:** pack 03 Scenario 3 ("a player who unpredictably reverses … can defeat the prediction").
- **Fix:** retitle C06 honestly. Add a survival-based reversal scenario on a larger loop, or record the pillar's geometry as an owner-visible limitation.

### F7 — MINOR — PR20 relaxed, which hides lost tracking after a lost race

- **Location:** dev/tests/s_skinpredator.js PR20 (now judged only on runs where it saw the runner again; ≥ 4 of 6).
- **What changed:**
  - R8 re-hunted a runner who stopped 1400 px on in ≥ 5/6 runs. This build no longer sees them in 2/6, because it trails 3 s and then watches for 1.4–7.8 s.
  - Recorded: "stopped where it could see them again 4/6".
  - The change is documented, but the bar dropped.
- **Fix:** keep R8's bar or record it as an owner decision. Also see F11.

### F8 — MINOR — The real-page predator check `pr_listened_then_looked` is no longer exercised

- **Evidence:** CHECKPOINTS C6b; `evidence/c6_predator_browser*.txt`: 6/7 twice on this build (R8 7/7).
- **Fix:** read the creature's QA record (`e.cog`) or sample faster in that tool, so the check runs on this build.

### F9 — MINOR — The real-page traces cannot support the reaction-speed claims

- **Evidence:** c6_browser.js trace samples are 0.6–1.5 s apart.
  - Lookaway #1: look-away at 8.3 s, still at 9.2, moving (104 px/s) at 9.9.
  - Lookaway #2: look-away at 8.0, still at 8.5, 25 px/s at 9.3.
  - R8 lookaway #2 likewise moved within ≤ 1.3 s.
- **Consequence:** the 0.05 s facing and 0.12–0.35 s beat (C01, C18) are simulation-only.
- **Fix:** sample at ≥ 10 Hz in the tool, or state the limitation in the handoff.

### F10 — NIT — Performance and soak documents

- **R8 red count:** C6b says R8 had three red p99 runs in run 1. `c6_perf.txt` shows four: 4.258, 4.364, 4.593, and BR-4h round 3 at 4.195 (> 4.175).
- **Soak coverage:**
  - The soak tally has no `stand` or `cut` counters (`skBegin` only counts predefined keys) and shows flank 0 and lure 0, so the 600 s soak says little about the new tactics.
  - Say that C14 (90 s, 4 × 8) is the stress evidence for them.

### F11 — NIT — Dead code and an extra random draw after the lost-race trail

- **Location:** :1387 passes `{ until: now + 8 }`, but `skBegin` (:389) overwrites `until` for `watch` with `rand(e, …)`.
- **Effect:**
  - The watch lasts 1.4–7.8 s, not 8.
  - It consumes an `e.rng` draw R8 never made at that point, which goes against the stated "random draws are R8's".
- **Fix:** set `until` after `skBegin`, or document the draw.

### F12 — NIT — Documents versus code

- DESIGN_DECISIONS says the stand-off works "from mild hunger"; the code starts it at .4 (hungry; :1213).
- BALANCE_TABLE says pressing works "from .6"; the creep only exceeds the 4 px/s threshold above about .65 (:1362–1363).
- "Closes in … under cover": on a clear line it goes straight (`skAim`, :1355).

### F13 — NIT — The twitch hold blocks every plan change for up to one beat

- **Location:** :1272. For .12–.35 s, no change happens at all, including chase or leave on a quarry who has just started fleeing.
- **Deferral:** acceptable as designed; worth noting for review.

### Checked and fine (one line each)

- Scope is species-only and the build matches the source; P9 6/6; snapshot fields unchanged (C16).
- No perception leak in the new tactics: paired worlds 24/24 identical (`out/pair_new.txt`).
- PR27/PR28: no erosion of a won lead, raced or not (`out/lead_*.txt`).
- The pounce keeps its wind-up, line of sight, stamina cost and contact rule, and the dodge works with ≤ 0.35–0.40 s reaction (`out/dodge*_new.txt`).
- Route searches are bounded, with no storm found (`out/storm_new.txt`).
- The circling inference needs laps it actually saw and decays within 1.2–2.7 s of a stop or walk-off (`out/circle_new.txt`).
- No adaptive tactic is hard-coded to map coordinates (grep of the diff).
- Satiated and mild creatures never strike.

## Regression scenarios to add before handoff

| Script | Must show after the fix | HEAD result |
|---|---|---|
| `exp_stamina.js` (F1) | `same` for every seed | fails 18/24 |
| `exp_group.js` (F2) | 0 pounces at .55/.7 | fails 14/16 |
| `exp_bold2.js` (F3) | "hunted anyway" = 0 | fails 16/19 |
| `exp_stare.js` (F4) | still in view ≤ 15 s before a tactic change or departure | fails 10/12 |

On R8:
- `exp_group.js` and `exp_stare.js` pass.
- `exp_bold2.js` does not apply (R8 has no boldness draw).
- `exp_stamina.js` fails only at .65 (6/24), an inherited leak that should be fixed too.

Re-run the species suites, P9 equivalence, the fast gate and the C6 real pages after the fixes. The fixes change behaviour.
