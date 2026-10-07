# N5 - Hound blind pursuit (evidence notes)

## The defect, as it was on the parent

A committed chase lost sight for only a moment turned into curiosity:

- out of sight, every sound is **anonymous** (2F: only a sound from a person in view at that instant is named), so the
  prey's own running never reached its record (`heardAt` / `hLoud` stayed old): the existing "follow fresh loud
  footsteps" branch of the chase could never fire;
- an anonymous sound heard more than 1.2 s after the last sighting started an *investigation* (`hLightStart` accepted
  HUNTING): the Hound dropped the chase and became **CURIOUS** - "investigate anonymous sound", investigation pace;
- otherwise the blind chase lasted 1.4-4.6 s toward `estimate()` - the last sighting pushed along its heading and
  stopped short of the first wall (at a corner: the wall in front of the corner), where it waited for the clock.

`hound_parent.log`: B1 - 8 of 16 chases lost round a corner became CURIOUS; B3 - never followed by ear.
`npm_test_parent_baseline.log`: C1 "3 s after the prey vanishes it is still after it" **0/18, states CURIOUS**; C4
"a prey that breaks into a run is re-acquired by ear at once" 0 %.

## The correction (inside the existing architecture; no new state)

`dev/ai_src/50_hound.js` `hHunt`, out-of-sight branch - BLIND PURSUIT, still HUNTING:
1. run to where the prey vanished (the record's last sighting);
2. then along the route it was heading for: the opening from there that best continues the last observed heading -
   asked once of the search's own first-hypothesis rule (`pickSearchGoal`: openings in 12 directions, forward
   hemisphere, momentum, the Hound's own imprecision) - at pursuit pace;
3. fresh running from the prey's trail re-aims it (`ear`: heard trail position + heard heading, eased toward each step);
   while homing on footsteps alone it runs at 85 % of its sighted chase pace (`HEAR_PACE`: sound gives a direction, not
   a line to run - a fresh sprinter still gains, a tired one does not);
4. when the predicted route has been checked (or the evidence runs out: lerp(3.5, 7) s of non-ear blind time) the
   existing search takes over with what was checked marked (`blindDone`: a short sniff facing the heading, then the
   other openings, confidence decay, give up for a stated reason).

`houndInferSource` + `hearEvent` (20_senses.js): a Hound in pursuit of / searching for one person connects an
**unidentified movement sound** to that person when it fits where they could be by now (last sighting or last heard
trail + 300 px/s x the time since + the sound's own blur).  It reads only its memory and the sound's blurred position -
never the bus's source id, true velocity or state (the record's posture comes from the sound type).  Successive steps
build one trail (the trail point moves 45 % toward each step; the heading is capped at a sprint).  Another person's
footsteps in the right place fool it the same way.  A committed chase is never demoted to CURIOUS by a sound.

## Evidence

- `hound_after.log` 5/5 (`hound_parent.log` 2/5):
  - **B0 hidden truth does not steer it**: two identical worlds up to the loss; in one the prey silently stands where it
    vanished, in the other it is 700-1 500 px away elsewhere - the Hound's position, heading, state, act and pursuit
    goal are identical tick for tick until either world produces new evidence (0 divergences in 10 pairs; the parent
    passes too: the old code did not cheat either - it gave up);
  - B1 chase round a corner: 16/16 keep the chase (CURIOUS 0; parent 8/16 CURIOUS);
  - B2 a silent change of route fools it: the predicted route goes ahead along the seen heading (85 %), away from the
    prey that crept back;
  - B3 recent running updates the pursuit: followed by ear in 92 %, the goal 192 px from a running prey vs 315 px from a
    quiet one, goal steps <= 24 px per tick against 425 px between raw heard steps;
  - B4 no evidence: HUNTING > SEARCHING > FRUSTRATED > ROAMING, gives up for a stated reason (13 s on average).
- `ai_suites_n5.log`: s_hound2e 18/18 (H7 updated, below), s_evidence 10/10, s_humanqa_hotfix 5/6 and s_hound 13/14
  (X03 / H07 fail on the parent too), s_chase: C1 now passes (14/14; parent 0/18).
- `test_3bn.js` N5 4/4 (static law: the blind pursuit, route, hand-over and inference code contain no live-player read).

- Full default suite (`npm_test_n5.log`): **151/162, the parent's count** (`npm_test_parent_baseline.log`).  Now passing:
  C1, SM01.  Now failing: C9/C10 (below) and SM17.  SM01 and SM17 are Smiler tests that sample their set-ups from the
  level's dark-cell list; N3's nine moved fixtures change that list, so all their set-ups land elsewhere.  SM17 runs
  with lamps off (blackout); its one new strike (a crouched 40 px side-step that also closes 102 px, at (6072, 3816),
  2 000 px from any moved fixture) is reproduced **identically on the parent build** at the same set-up
  (`dev/stage-3b-n/evidence/n5` replay in the N5 notes of the final report): a pre-existing edge case the new sample hits.

## Existing tests changed (and why)

- `dev/tests/s_hound2e.js` **2E H7** asserted the superseded behaviour itself: "fresh hidden running after loss causes
  anonymous investigation" (state CURIOUS).  USER_DECISION_LOCK 1-2 replaces it.  H7 now asserts: running that fits
  the lost prey resumes the chase **by inference** (attribution `inferred`, never `identified`), identically with no
  source id on the sound at all; a sound that cannot be the prey stays anonymous (2F unchanged).
- `dev/tests/s_system.js` **Y05** "speeds change within acceleration limits" left vault / crawl traversals out of its
  heading check but not its acceleration check; a traversal's scripted arc is measured as distance per tick.  The blind
  pursuit takes one Hound (seed 75) over a vault the parent never reached.  Traversal ticks are now left out of both
  checks; the biggest non-traversal acceleration is 2 804 px/s^2 (limit 4 500).

## Known trade-offs (for human QA)

- **C9/C10** (`s_chase`): "exhausted runner far more vulnerable (by 30 points); a fresh one can still make distance".
  Fresh runners still hold or widen the gap after 4 s in 58 % (= parent), but within 8 s 41 % of fresh runners are
  caught (parent 25 %) vs 66 % exhausted (parent 75 %): a 25-point margin instead of 30.  The extra catches are runs
  where the Hound, no longer giving up at a momentary loss, keeps sight or follows the running by ear.
- **C4** passes on behaviour (100 % re-acquired by ear within 1 s, 0.06 s on average; parent 0 %) but collects 5
  qualifying runs, one short of its sample minimum: the blind pursuit leaves fewer runs in the "searching within
  750 px" state it samples.
- C5 / C18 / H07 / P01 / P07 / P08 / NV09 / 2F F22 / X03 fail on the parent as well.
