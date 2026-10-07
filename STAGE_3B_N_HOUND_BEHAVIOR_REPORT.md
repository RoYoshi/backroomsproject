# Stage 3B-N — Hound Behavior Report

Checkpoints: N5 `68d5e8a` (blind pursuit), N6 `a657c23` (sound recency and urgency). The existing AI architecture is
kept. There are no new states, no rewrite, and the Smiler is untouched.

**THE ENTITY PREDICTS. IT DOES NOT KNOW.**

## What was wrong (measured on the parent)

1. **A committed chase lost sight for a moment and turned CURIOUS.** Out of sight, every sound is *anonymous*: by the
   2F law, only a sound from a person in view at that instant is named. The prey's own running therefore never reached
   the chase, and the chase's "follow fresh footsteps" branch could not fire. Worse, an anonymous sound heard more than
   1.2 s after the last sighting started an *investigation*, which dropped the HUNTING Hound to CURIOUS at
   investigation pace. If it heard nothing, it ran 1.4–4.6 s toward the last sighting pushed along its heading,
   stopping at the first wall (at a corner, the wall in front of the corner), and then searched.
   - `s_chase` C1, "3 s after the prey vanishes it is still after it": **0/18, all CURIOUS**.
   - `hound_3bn` B1: 8 of 16 chases lost round a corner became CURIOUS.
2. **A recent close sound lost to stale evidence.** A sprint right behind a resting Hound got the same reaction as a
   distant step: CURIOUS, an orienting beat, then 122 px/s. Once investigating, the Hound kept its current hypothesis
   whatever it heard next (S4: 0 % switched to a fresh sprint).

## Blind pursuit (N5)

`hHunt`, in the out-of-sight branch, keeps the Hound HUNTING:
1. **Where it vanished.** The Hound runs at pursuit pace to the record's last sighting.
2. **Where it was going.** From there it takes the opening that best continues the last *observed* heading: a
   corridor, a doorway, or round the corner. This comes from the search's own first-hypothesis rule (`pickSearchGoal`:
   12 directions, forward hemisphere, momentum, the Hound's own imprecision), asked once.
3. **What it hears.** Fresh running that fits the prey's trail re-aims it. The goal is the heard trail plus the heard
   heading, eased toward each step. Homing on footsteps alone runs at 85 % of the sighted chase pace, because sound
   gives a direction, not a line to run.
4. **Then the existing search.** It sniffs facing the heading, checks the other openings, broadens, lets confidence
   decay, and gives up for a stated reason.

**Sound as evidence of the prey (inference, never identification).** A Hound pursuing or searching for one person
connects an *unidentified movement sound* to that person only when the sound fits where they could be by now. "Could
be" means the last sighting or last heard trail, plus 300 px/s times the time since, plus the sound's own blur. The
Hound reads its memory and the sound's *blurred* position only. It never reads the bus's source id, true velocity or
state; the record's posture comes from the sound type. Another person's footsteps in the right place fool it the same
way. A sound that does not fit stays anonymous, as the 2F law requires. A committed chase is never demoted to CURIOUS by
a sound.

## Sound recency and urgency (N6)

- `soundUrgency` is intensity at the Hound × kind (run/slide 1, vault .95, land .9, walk .55, breath .45, crouch/crawl
  .3) × recency (e^-age/1.5 s) × confidence. Typical values:
  - a sprint a few metres away: about **0.70**;
  - the same sprint 1.5 s later: about 0.26;
  - a far walking step: about 0.04;
  - a crouched step: about 0.02.
- A lead keeps the urgency of its strongest sound and decays. A fresh strong sound renews it.
- A new unidentified sound competes on **its own** lead and urgency. The Hound's state decides what it does:

| state | sound | reaction |
|---|---|---|
| idle, curious, searching, frustrated | urgency ≥ 0.45 (a sprint within a few metres) | **ALERT at once**: a 0.12–0.3 s freeze facing it, then it rushes the spot (up to 85 % of chase pace) |
| already rushing an urgent sound | its next footsteps | the goal is refined; no new freeze |
| idle, curious, searching | weaker | the existing investigation (orient, then walk at 122 px/s) |
| HUNTING | any | never demoted; a sound that fits the trail updates the pursuit (N5) |

- **One hypothesis at a time.** More of the same trail eases the goal (35 % per sound): no restart, no snap per
  footstep. Only a clearly more urgent sound elsewhere (more than 1.5× + 0.1 of what the current hypothesis still
  carries) replaces it.

## Evidence that hidden truth does not steer it

- **B0 counterfactual.** Two identical worlds run up to the moment the prey vanishes. In one, the prey silently stands
  where it vanished; in the other it is silently 700–1 500 px away, somewhere else hidden. The Hound's position,
  heading, state, act and pursuit goal are **identical tick for tick** until either world produces new evidence: 0
  divergences in 10 pairs, compared for up to 5 s.
- **DEV instrumentation.** `e.dbg.pursuit` reports the goal and its source (`lkp` / `route` / `ear`) with the evidence
  it was built from (`seenAt`, `heardAt`, last-seen point, observed heading). `e.dbg.blindEnd` says why the blind
  phase ended. `e.dbg.switched` records a hypothesis replacement and its urgencies.
- **Static law** (`test_3bn` N5-1/2). The blind-pursuit, route, hand-over and inference code contains no `playerById`
  / `nearPlayers` / `candidates` / visual sample / bus source id, velocity or state.
- Existing evidence-law suites still pass: `s_evidence` 10/10, and `s_hound2e` H3/H5/H6/H8/H17 ("hidden corner
  branches cannot change prediction", "silent hidden reposition does not cause magical following", and others).

## Behaviour cases (`dev/stage-3b-n/hound_3bn.js`, headless, the real sim + AI + move.js)

| case | parent | Stage 3B-N |
|---|---|---|
| B1 chase round a corner: stays a chase, never CURIOUS | 8/16 CURIOUS | **16/16 kept**, 0 CURIOUS |
| B2 silent change of route fools it (route ahead along the seen heading, away from the prey) | no route | **85 %** |
| B3 running out of sight updates the pursuit (by ear; goal nearer a running prey than a quiet one; goal step vs footstep blur) | never by ear | **92 % by ear; 192 vs 315 px; 24 vs 425 px** |
| B4 no evidence: search, decay, give up with a reason | pass | **pass** (13 s average; "memory faded" / "nowhere left to look") |
| S1 idle + distant quiet step: no alarm | pass | **pass** (0 ALERT, 122 px/s) |
| S2 idle + sprint 140 px behind, dark: high alert at once, rush | never ALERT, 130 px/s | **ALERT in 0.02–0.12 s; 196 px/s; there in 0.6–1.0 s** |
| S4 stale faint step vs fresh sprint elsewhere | 0 % switch | **100 %** |
| S5 a runner's repeated steps: no hypothesis flip-flop | pass | **pass** (0 switches; ≤ 95 px/tick) |
| S6 sounds stop: dropped, urgency fades | pass | **pass** |

Result: parent 2/5 blind-pursuit cases and 3/5 sound cases; Stage 3B-N **10/10**.

## Regression (the full AI suite, 162 tests)

**151/162, the parent's count.**

- Now passing:
  - **C1** (lost sight → still after it 3 s later: 14/14, parent 0/18);
  - SM01.
- Now failing:
  - **C9/C10**. Fresh runners still hold or widen the gap after 4 s in 58 % of runs, the same as the parent. But within
    8 s, 41 % of fresh runners are caught (parent 25 %) against 66 % of exhausted runners (parent 75 %). That is a
    25-point margin, where the test wants 30. The extra catches come from Hounds that no longer give up at a momentary
    loss. This is a **balance point for human QA**.
  - **SM17** (Smiler). Its set-ups are sampled from the level's dark-cell list, and N3's nine moved fixtures change
    that list. The one new strike replays **identically on the parent build** at the same set-up
    (`dev/stage-3b-n/evidence/n6/sm17_replay.txt`). It is a pre-existing Smiler edge case, not a Stage 3B-N change.
- **C4** behaves correctly: 100 % re-acquired by ear within 1 s, 0.06 s on average (parent 0 %). It still fails its
  own minimum sample count (5 runs, needs 6), as it did on the parent.
- C5, C18, H07, P01, P07, P08, NV09, 2F F22 and X03 fail on the parent too.

**Test changes, documented.**
- 2E H7 asserted the superseded CURIOUS demotion. It now asserts the 3B-N inference, and that an unfitting sound stays
  anonymous.
- Y05 leaves scripted vault/crawl traversals out of its acceleration check, as it already did for heading. The blind
  pursuit now takes one Hound over a vault.
