# Trial 3 R20, N track: Checkpoint A, the source audit and the open-air STUCK

Trial 3 is **not owner-approved**.  This branch, `trial-3-r20-nani-head-watchdog`, starts at the R19 combined QA receipt
`2f11eae188c7ec08e81efbaa2bb5bacf80ce6772` on `trial-3-r19-combined-humanqa`.  When R20 began, the remote's refs were the pre-R19 snapshot
plus the three R19 branches: `main` at 7781e1a, R18 at 01e5d97, R19 combined at 2f11eae, and no `trial-3-r20-*` branch.  No ref had moved.

## What the owner sees

The admin debug overlay draws a red **`STUCK n s`** beside a creature whenever its navigation record's `st` is above 0.15 s
(`overseer/client/ents.debug.js` `drawNav`).  `st` is `e.stuck`, the shared follower's stuck timer (`nani/server/ai.entity.js` `steerTo`).
A second, separate mechanism is the engine's watchdog (`ai.engine.js` `watchdog`).  For a Skin-Stealer it calls the species' `onStuck`,
which:
- clears the route;
- nulls the roam goal;
- bumps `plan.stuck` (above 2 it ends an intercept or a search);
- writes the debug reason "stuck: the watchdog cleared its route".

## How it was measured (read-only, no source change)

`tools/trhook.js` is a test-only require hook.  It inserts four read-only callbacks into the built `generated/server/ai.js` of whichever
tree is loaded, and changes nothing on disk:
- steerTo's stuck accounting;
- each watchdog tick;
- each 6-s watchdog check;
- the follower's side-step and re-plan rungs.

`tools/stuck_trace.js` classifies every tick in which the stuck timer grows:
- **real**: it moved less than half its own step, so collision ate the step;
- **turn**: its wanted heading is more than 1 rad off its body, so steerTo's alignment slows it to as little as 10 % of its speed;
- **vcap**: corner braking;
- **feel**: the wall feeler braked it;
- **accel**: starting from a stop.

It also records:
- every tick the label shows, whether in open air (clear 24 px beyond its body in 16 directions) and whether nothing steered it that tick;
- every watchdog reset, with the 6-s window's still / slow / steering fractions and what the creature did for 5 s after.

Play comes from two sources:
- R19's ordinary-play simulator, `prechase_sim.js`: two people exploring and reacting, 8 seeds × 10 min, hunger .55 and .85.
- `tools/roam_sim.js`: 2 or 4 people who just explore, 8 seeds × 10 min, one Hound, one Smiler, or one Skin-Stealer.

R18 (01e5d97) and R19 combined (2f11eae) ran the same seeds.  `tools/tr_sum.py` produces `evidence/A/summary.txt`; the raw records are
in `evidence/A/tr_*.json`.

## Results

| ordinary play | tree | near/mid time | `STUCK` label shown | label in open air | timer growth classified real / turn / other | side-steps | watchdog resets |
|---|---|---|---|---|---|---|---|
| Skin-Stealer, prechase .55 | R19 C | 4090 s | 134 s (3.3 %) | 96 s | 0.4 / 129 / 8.6 s | 227 | 3 |
| Skin-Stealer, prechase .55 | R18 | 3884 s | 126 s (3.3 %) | 90 s | 0.4 / 121 / 8.0 s | 212 | 2 |
| Skin-Stealer, prechase .85 | R19 C | 3552 s | 125 s (3.5 %) | 91 s | 0.2 / 119 / 8.4 s | 214 | 3 |
| Skin-Stealer, 4 people | R19 C | 4355 s | 158 s (3.6 %) | 119 s | 0.2 / 129 / 8.0 s | 231 | 3 |
| Hound, 2 people | R19 C = R18 | 3873 s | 58 s (1.5 %) | 36 s | 1.7 / 42 / 8.9 s | 71 | 1 |
| Smiler, 2 people | R19 C = R18 | 4018 s | 296 s (7.4 %; 254 s with nothing steering it) | 84 s | 0.2 / 37 / 2.3 s | 72 | 23 |

R18 and R19 combined agree on every count.  The defect is **inherited**: R19 neither caused it nor changed it.

## Root causes

### RC1: turning on the spot counts as stuck (shared follower, every species)

`steerTo` measures "stuck" against an intent of half the creature's full speed:

```js
intent = max(step, vmax * dt * .5);
if (intent > .5 && moved < intent * .3) e.stuck += dt;
```

The comment there says the intent is meant to catch a body that the wall feeler braked against a wall.  But when the wanted heading is
more than about 80° off the body, steerTo itself slows the body to 10-15 % of its speed while it turns.  That turn takes:
- Skin-Stealer: 3.6 rad/s, about 0.9 s for 180°;
- Hound: 3.4 rad/s;
- Smiler: 3.1 rad/s.

During it the timer grows with nothing in the way.

The consequences:
- **96 % of all Skin-Stealer stuck-timer growth is this "turn" class, and 72 % of the label time is in open air.**  Real blocked motion is
  0.2-0.4 s in 80 minutes.
- Every turnaround puts the red `STUCK` beside it; for a Skin-Stealer near people that is about every 18 s.
- From 0.35 s the follower's first recovery rung fires: a side-step, with `nav.recover++`.  That is about 230 open-air "recoveries" in 80
  minutes.  The covert way's own test, `ai.skin.cover.js`, reads `e.stuck > .9` as "stuck" and abandons that way.

**The owner's "STUCK on air … and retreats" fits this exactly.**  When it decides to leave, retreat or reverse, it turns in place, and
that turn is what puts `STUCK` on screen.  Examples:
- `evidence/A/caseD.log` 580.8 s: "it decides against P101", `st 0.27`, and the label shows as it turns away.
- `caseA.log` 437.2 s: after listening it turns about 2.2 rad, `st 0.27 → 0.40`, and the side-step fires in open air.

### RC2: the watchdog samples stillness at one instant (Skin-Stealer)

For every species except the Hound, the watchdog's window counts all time.  It asks whether the creature is idle only at the 6-s check
tick, and the Skin-Stealer's idleness is `e.still`, which it re-decides every tick.  Every Skin-Stealer reset in these runs was this kind
of false positive:
- **(b) `caseB.log`, run 4 at 315.7 s:** it fed, still, for minutes.  On the check tick it got up ("fed: it roams again"), so the check
  saw a non-idle creature that had not moved, and reset it.  Its route west had just been planned; the watchdog cleared it and nulled the
  roam goal.  It chose a new goal east and turned round.
- **(d) `caseD.log`, the .85 run at 576.6 s:** a lure wait, "it hears them coming: it waits, ready", 6 s still with `stillFrac .90`.  On
  the check tick it had just begun its search.  The search's route was cleared ("stuck: the watchdog cleared its route" is on its debug)
  and `plan.stuck` became 1.  Within 4 s: approach → watch → "it decides against P101" → leave.
- **(a) `caseA.log`, run 1 at 440.1 s:** a purposeful there-and-back.  It walked 600 px west at 185 px/s, stopped to listen, and walked
  back east past its start point.  Net displacement was 21 px in 6 s, at 168 px/s.  The reset nulled the roam goal it was walking to; its
  new goal was back west, so it turned round a second time (two open-air `STUCK` labels in 3 s).

The same pattern appears with 4 people: two roaming there-and-backs, and a leave right after standing at its kill.  None of the
Skin-Stealer's resets involved a wall, an embed (0 embedded checks in every run), a vault, or the far tier.  The far tier is not
watchdog-checked; the creature is moved by `coarseMove`.

**The Hound** keeps its own rule (it counts only time spent trying to move).  One reset in 65 minutes, a roaming one.

**The Smiler's** 23 resets are its "restless: moves to another dark spot" fade, moving at about 11 px/s.  That is the Smiler's own
unchanged rule ("its behaviour tests are tuned against it"), and its recovery is its own (`beginHidden`).  Its 254 s of label with
nothing steering it is `e.stuck` left frozen while it lurks: only `steerTo` ever lowers the timer.  It is noted, not changed: it is the
Smiler's own behaviour, outside this track.

### Not the cause

None of these contributed to the open-air STUCK in any recorded case:
- `geo.clear` / embedding: 0 events.
- Vaults: no label or reset during a traversal.
- The R19 cornering hunk.
- The tiers.
- Separation pushes: separation runs after the watchdog; no reset happened with another creature near.

## The rest of the audit, for the later checkpoints

- **The fatigue oracle.**  `ai.senses.js` `updateVision` copies `r.stamina = p.stamina` and `r.ex = p.ex` on each sighting.  The
  Skin-Stealer reads them as `winded = r.ex || r.stamina < 25` (`skDecide`, ai.skinstealer.js ~1305) and the same in `ai.skin.mind.js:125`.
  The Hound reads `r.ex` (ai.hound.js:421, its own contract, left as is).  The engine's breathing sound (`playerNoise`: `p.ex`, or stamina
  < 26) is a legitimate audible cue.
- **Hearing.**
  - Players' footsteps go to `eng.sound` with `r = WORLD.NOISE[...] × surface step` (walk 240, run 640, crouch-move 85, crawl 95,
    slide 460, vaults 170-520, land 420, breath 300).
  - `hearEvent` scales that by `(.42 + HEARING × 1.05)`, focus 1.3 for a hunted runner, ×1.5 listening, ×.65 feeding, ×.6 through walls,
    with intensity falloff, positional fuzz, and identity only through `identifySound`.
  - Speech reaches the Skin-Stealer within `SK.hearSpeech = 576` px as a `voice` event.
  - The audible-parity comparison against what a player hears is Checkpoint C.
- **The head.**
  - `visualObservation` and the dead-body check already centre the field of view on `e.ang + (e.head || 0)`.
  - Only the Skin-Stealer writes `e.head` (`ai.skin.look.js`: snaps and stares, its own turn rate).
  - The shared opt-in moving gaze is Checkpoint D.

## Checkpoint B (next): fix the two causes, nothing else

- **RC1, shared steerTo.**  The intent a body is measured against becomes the speed its own steering allowed it, for slowing that came
  only from turning.  Feeler and corner braking keep the old intent, so a nose-to-wall body is still stuck, and a step eaten by collision
  is still stuck.  This changes the follower for every species, so the Hound and the Smiler are measured against R19 on the seeded chase
  outcomes.  It would be reverted or made opt-in if either weakened.
- **RC2, the watchdog, for a species that declares its own stillness** (only the Skin-Stealer does).  Two changes, nothing else:
  - only time spent trying to move counts, which is the Hound's rule, sampled every tick;
  - "not moving" also requires that it never got more than 60 px from the window's start.

  The Hound's and the Smiler's watchdogs are untouched.
