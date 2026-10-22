# The owner's additional refinement — audit (R16c)

**Trial 3 is not owner-approved.** This covers the owner's October 22 brief: active perception, reactive aggression, path interruption
and interception. It supplements the R9 pack and overrides none of it.

This checkpoint changes no behaviour. It measures what the owner reported on the real server simulation and finds the causes in the
code, so that R16d–R16g fix the causes rather than raise weights.

The measuring tool is `tools/repro_ap.js`. It runs on any tree (`--dir`) and is the before/after probe for every later checkpoint. It
never sets a decision: it places people, moves them as players move, and gives the creature a hunger. In A, B and G it also gives the
creature a long route of its own (a roam goal far down the hall). In E and F it starts from the states the owner saw.

Results: `evidence/r16c/repro_r8.txt` (R8, `f378049`) and `repro_r16b.txt` (R16b, `b58db41`). They agree. Every complaint below was
already present in R8; R9–R16b did not change these paths.

## What was measured (R16b; R8 the same)

| Probe | What happens | Measured |
|---|---|---|
| E. Someone it gave up on, seen again plainly while hungry (0.45 / 0.65 / 0.75) | It keeps roaming | Never taken up in 9 of 9 runs, though in plain sight for up to 12.9 s |
| F. A departure under way; a new person crosses 420 px in front | It walks on | Below hunger 0.6: 5 of 6 never reconsider. At 0.65: 2.3–3.7 s later |
| G. Roaming, nobody about | It stands | 9–13 s of every 60 s standing; 3–10 stops a minute, starving included |
| B. A person sprints behind it (350 px, clear floor), then stands still unlit | It turns and stands, then walks to where the sound was | Head 0.08–0.45 s, body 0.22–0.33 s. Stands 1.1–1.9 s, then walks to the spot. Sees them 3.8–5.2 s after hearing. At hunger 0.3: no turn at all |
| A. A lit person crosses in front (520 / 900 px) or in its periphery (55° at 450 px) | It acts at once | Seen in 0.25–0.67 s, acts on the same think, walks on 0 px |
| A. The same at 85° from its way, 420 px | Never noticed | 0 of 8 in 12 s (its view is ±72°) |
| C. A person runs round it at 230 px, just out of its spring | It turns after them | Mean facing error 0.62–1.34 rad. 0 sidesteps, 0 steps back, 0–1 strikes in 8 s |
| V. How far it sees a person in the long hall (the lamps' light) | | lit: standing 649, walking 1269, running 1483 px. Unlit: standing 442, walking 526, crouched 285 px |

The owner's first complaint, "continues toward predetermined destinations after directly seeing a player", is E and F. In the plain
case (A: a person appears in front of a roaming creature) it already acts at once.

## The causes, in the code (`src/frameworks/nani/server/ai.skinstealer.js` unless named)

1. **A person it left is invisible to its hunting for 30–60 s** (E).
   - `skLeave` sets `e.left` for `SK.cooldown` [30, 60] s (12 s when starving).
   - `skMayHunt` then refuses them below `SK.band[3]` (0.8), however hungry, close or unaware they are.
   - `skDecide` filters them out of `seen`, so `skUnseen` runs: it roams.
2. **A departure ignores new prey** (F).
   - `skDecide` carries a `leave` plan through unless the creature is very hungry (≥ `band[2]`), `SK.leaveDwell` (4 s) into it, and
     at most once a second.
   - Even then it reconsiders only people it may hunt, so a new person crossing in front of a mildly hungry departing creature changes
     nothing.
3. **Roaming stops for nothing** (G): `skRoam` stands `SK.roamPause` [1.5, 5] s at every roam goal, whatever its hunger.
4. **The head is held straight while it has a plan** (B, C).
   - `skAct` runs `skGaze` (head tracking) only with no plan or a departure. Under every other plan the head decays to 0.
   - A sound turns it only through the B1 `look` reaction (`skAttend` → `skReact`), and only when it has no plan; the reaction turns the
     body.
   - The head's rate is `dt * 5`: about 0.6 s to 95 %. Its limit is ±1 rad.
5. **It goes to the sound, not to where it could see** (B).
   - After a sound, `skListen` stands it for `SK.curious` seconds facing the sound.
   - `skCurious` then sends it, quietly, to the sound's own fuzzy place. Nothing chooses a point from which it would have a line of
     sight to that place.
6. **Its periphery is blind to movement** (A at 85°).
   - Vision (`ai.senses.js`, shared) sees only within the species' FOV (`SKIN.vision.fov` 2.5 rad, ±72°).
   - Nothing of its own notices a person moving just outside it.
7. **It cannot move other than along its facing** (C).
   - Every Skin-Stealer move but one goes through the shared `steerTo` / `follow`, which drive the body along `e.ang`.
   - The one exception is the B2 warning's slow back-off (`skReact`, `moveCollide` while facing).
   - So it cannot strafe, step back or contest a doorway. Circled, it turns on the spot, nose first, and its facing lags.
8. **Its range** (V).
   - `SKIN.vision.range` is 760 nominal, times 0.885 for its `VISION` trait.
   - The light, posture and motion factors (shared `visualObservation`) multiply that. A lit walker is seen from about 1270 px, a lit
     person standing still from about 650 px, a crouched unlit one in the lit hall from about 285 px, and much less in the dark (its
     floor is 90 px).
   - Raising the nominal range scales every case. At 1100 a lit walker is seen from about 1840 px, past its candidate radius (1750 px)
     and far past the 700 px a player sees.
   - The owner's 1100–1200 candidate is therefore tested against the stealth and fairness suites in R16e, not adopted blindly.
9. **An interception made obsolete** was not reproduced by H: in its runs the person was never seen on the creature's way. R16d's tests
   build that case directly.

## What R16d–R16g change (the plan; each checkpoint's notes say what was actually done)

- **R16d — interruption and preemption.**
  - Plans are classed:
    - low priority: roaming, a roam pause, a departure, a search or a listen for an unnamed sound;
    - tactical: approach, flank, intercept, lure, ambush, chase, retreat, a hunt's search and listen;
    - committed: the wind-up, the leap, the recovery, a capture, a kill playing.
  - A significant event, checked on every think whatever the route's progress, preempts a low-priority plan at once. Significant events
    are a viable person newly seen, a strong unnamed sound, and the quarry turning.
  - A tactical plan is checked for sense (an interception the quarry no longer heads for; a search whose quarry is in sight) and dropped
    or repaired.
  - Committed actions are never cut.
  - Hysteresis stays for marginal changes. A forced reassessment is rate-limited per person, so evidence that keeps arriving cannot make
    it replan in a loop.
  - Who it may hunt again, and when a departure may be broken off, become hunger-dependent.
  - A hungry creature patrols toward evidence rather than pausing at random goals.
- **R16e — active acquisition.**
  - Head snaps, initiated on the think that perceives the stimulus and turned at a snap rate; the body follows beyond the head's reach.
    This works under any plan that is not committed.
  - A sound it cannot see the source of sends it to the nearest reachable point from which it could see that place.
  - Movement in its periphery is noticed as a stimulus. It gives no identity: the snap must then see them.
  - The range is tuned against the fairness suites.
- **R16f — multidirectional movement.**
  - A Skin-Stealer-only mover (velocity with its own acceleration and speed limits, facing turned at its own rate, `moveCollide`).
  - A close-range controller that faces the person while it sidesteps to cut off their escape, backpedals to keep its spring, and
    contests a doorway.
  - Its prediction comes from what it perceives, with an error, so feints work.
  - No speed above its own; a fresh runner still wins.
- **R16g.** The extended browser campaign (focused scenes and a 10–15 minute continuous encounter), the full regression, performance
  against R8, the full gate.
