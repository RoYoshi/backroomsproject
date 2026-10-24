# Trial 3 R20, N track: design decisions

Trial 3 is **not owner-approved**.  This branch is `trial-3-r20-nani-head-watchdog`, based on R19 combined `2f11eae`.  Every
shared-engine hunk is listed, word for word, in `dev/tests/r19n_patch.js`, the registry that the lock checks use.  WL05 and PR25 hold the
Hound's, the Smiler's and the shared engine's code to R8 / 4518f93 plus exactly those hunks.  C15 (no Skin-Stealer: every snapshot is R8's)
runs this tree with them taken out.

## W1: the follower's stuck timer measures progress against the speed its own turn allows (shared; `ai.entity.js` `steerTo`)

**Before (R8-R19):**

```js
intent = max(step, (hold ? 0 : vmax) * dt * .5)
```

**Now:**

```js
turnV = hold ? 0 : vmax * (noSlow ? 1 : clamp(align, .1, 1))   // the target before corner or wall braking
intent = max(step, turnV * dt * .5)
```

Nothing about how a body moves changes: its target speed, its turn, the feeler, the corner cap and the collision are all unchanged.  The
only change is the yardstick its stuck timer uses.  Two cases are still stuck, because neither lowers `turnV`:
- **braked by a wall:** the feeler cuts the target, the step goes to zero, and the intent is still half the turn speed;
- **eaten by collision:** the step is taken but `moved` is smaller than it.

**Why.**  On open floor, a turn of more than about 80° slowed the body to 10-15 % of `vmax`, by the follower's own design.  Its timer,
measured against `vmax / 2`, read that as no progress.  A 180° turn takes 0.9-1 s at the species' 3.1-3.6 rad/s, so every turnaround:
- drew the debug's red `STUCK`;
- fired the side-step rung at 0.35 s;
- sometimes fired the new-route rung at 0.9 s;
- and for the Skin-Stealer's covert way, which reads `e.stuck > .9` as stuck, gave up that way.

That was 96 % of all its stuck-timer growth in ordinary play (AUDIT.md).

**Scope.**  It is shared because the defect is shared: a Hound's and a Smiler's turnarounds were mislabelled and side-stepped too.  The
owner's rule is that Hound and Smiler must not weaken, so both were measured against R19 combined on the same 1,044 seeded chases per
species (REGRESSION.md): caught counts are equal in every scene.  Had either been weaker, W1 would have been made opt-in for the
Skin-Stealer alone.

## W2: the watchdog asks a self-declared still species every tick (`ai.engine.js` `watchdog`; in effect, the Skin-Stealer only)

The change applies to a species that says itself when it stands still on purpose (`sp.still`).  Of the current species, only the
Skin-Stealer does.  Three things change for it:
1. **The Hound's rule.**  Only time spent trying to move (not idle) counts toward the 6-s window, and idleness, including `sp.still`, is
   asked every tick.  Before, it was asked only on the check tick.
2. **A restart.**  A second or more of deliberate stillness (idle: still, listening, watching, waiting, feeding...) begins the window
   afresh, from where it stands.  Whatever it does next is a new attempt.
3. **"Not moving" needs both conditions.**  It must have got less than 26 px from the window's start, *and* never more than 60 px from it
   in the window (`w.far`).  A walk there and back past the same spot is not being stuck.

**Why.**  For every species but the Hound, the 6-s window counted all time and asked whether the creature was idle only at the check.
The Skin-Stealer re-decides `e.still` every tick, so that check produced false resets:
- **a meal or a lure wait ending on the check tick:** reset, route cleared, roam goal dropped, `plan.stuck` raised;
- **a purposeful walk there and back:** reset.

The reason "stuck: the watchdog cleared its route" then appeared in the debug, and the creature turned onto a new goal: the reported
"retreat".  Not one of the Skin-Stealer's resets in 80 minutes of ordinary play was a real obstruction.

**What still catches real trouble.**
- A body that keeps trying and gets nowhere is still reset where it stands (ST03: five pinned walls, each reset, as on R19).
- The embedded check is unchanged and runs every 6 s whatever the window.
- The follower's own side-step / new-route / drop-route ladder is unchanged for real obstruction.
- Nothing is teleported: the reset clears the route, only the embedded case snaps to the nearest open cell, and that is unchanged.

**Not touched.**  The Hound keeps its own rule, unchanged.  The Smiler keeps the original rule ("its behaviour tests are tuned against
it"), including its 23 slow-fade resets in 65 minutes (AUDIT.md), which are its own behaviour.

## Not changed, and why

**`e.stuck` is still left as it was while nothing steers a body.**  Only `steerTo` lowers it.  On R19 the Smiler's lurk kept a stale
value on screen for 254 s in 65 min.  With W1, those stale values no longer arise, and the trace shows 0 s for the Smiler.  Changing who
lowers the timer would change when a resumed body side-steps, which is a behaviour change with no remaining symptom, so it is left.

**No logging was suppressed.**  The label, the recovery counters and the watchdog's note and reason are all as before.  They now fire
only when something is in the way.
