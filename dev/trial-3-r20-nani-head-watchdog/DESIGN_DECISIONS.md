# Trial 3 R20, N track: design decisions

Trial 3 is **not owner-approved**.  This branch is `trial-3-r20-nani-head-watchdog`, based on R19 combined `2f11eae`.  Every
shared-engine hunk is listed, word for word, in `dev/tests/r19n_patch.js`, the registry that the lock checks use.  WL05 and PR25 hold the
Hound's, the Smiler's and the shared engine's code to R8 / 4518f93 plus exactly those hunks.  C15 (no Skin-Stealer: every snapshot is R8's)
runs this tree with them taken out.

## W1: the follower's stuck timer measures progress against the speed its own turn allows (`ai.entity.js` `steerTo`; opt-in, the Skin-Stealer only, since D2)

**Before (R8-R19, and still for every species but the Skin-Stealer):**

```js
intent = max(step, (hold ? 0 : vmax) * dt * .5)
```

**Now, for a species with `caps.TURN_AWARE_STUCK` (the Skin-Stealer):**

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

**Scope (revised at checkpoint D2): the Skin-Stealer's alone.**  W1 was first made shared, because the defect is shared: a Hound's and a
Smiler's turnarounds were mislabelled and side-stepped too.  Their caught counts were equal to R19 combined on the 1,044 seeded chases per
species, but not their runs: a few loop chases differed.  Then:
- the independent review found the change alters their recovery (a Hound turning hard no longer side-steps);
- the gate's server golden traces, which hold the Hound's and the Smiler's B++ behaviour byte for byte, failed on it
  (`deaths`, `admin`, and with them `bpp_golden`, `session`, `sim`).

So W1 is now an opt-in, `caps.TURN_AWARE_STUCK`, and only the Skin-Stealer has it.  Every other species keeps R8-R19's yardstick, its full
speed.  With that, the gate is R19's again and the chase study is identical to R19 combined for the Hound and the Smiler, run for run.  A
Hound's or a Smiler's red `STUCK` while it turns round in the debug overlay is R19's: a debug label, their own behaviour.

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

## W3 (checkpoint D): the opt-in head swivel - the gaze leads into the bends (shared helper, the Skin-Stealer opts in; the page draws the server's head)

**The capability.**  A species with a head it can turn says so in its caps: `HEAD_SWIVEL = { max, run, runFrom, rate, ahead }`.  Only
the Skin-Stealer does (`{ max: .85, run: .4, runFrom: 240, rate: 3, ahead: 170 }`).  The Hound's head and the Smiler's keep their own
code; neither has the capability, and neither calls the helper.  The pack: "Smiler must remain baseline"; the Hound's head is its own
contract, so it is not opted in.

**The shared helper, `headAhead(eng, e)` (`ai.entity.js`).**  While a body walks its route, as it comes within `ahead` px of a waypoint
with another after it, the head angle (from the body's heading) toward that next waypoint, weighted by how near it is (`1 - d / ahead`),
clamped to `max` rad (`run` rad above `runFrom` px/s).  It returns 0 for a species without the capability, mid-vault, for a vault or
crawl link, and below 30 px/s.  It is only a direction for the head:
- **It is not sight.**  The sight is the engine's own: `visualObservation` centred on `e.ang + e.head`, its range, light, posture and
  `geo.sees` (walls) as before.  The swivel shows the corner's mouth as it opens and nothing behind the wall (NA02).
- **It never moves the body.**  The follower's speed, turn, collision and corner timing are untouched (NA05: the same routes walked with
  the head swivelling and straight give the same path; NC01-NC04 pass).
- It is in the lock registry as two hunks tagged `head` (`r19n_patch.js` HEAD); PR25, WL05 and C15 hold the rest byte for byte.

**The Skin-Stealer's use of it (`ai.skinstealer.js`).**
- Its reactions come first, unchanged: a snap toward a sound or a movement (`skHeadStep`, `skSnap`), its gaze at a person it has noticed
  (`skGaze`), a plan's own head (a post's sweep, a listen).  The swivel fills only what was a straight head: nobody to look at, or a plan
  whose person it does not see.
- In a borrowed skin it does not swivel (a wanderer's look, R19's).
- `skSwivel` eases the head toward the swivel's angle, never faster than its `rate` (3 rad/s): no spin.  `skHeadStep`'s limits still apply
  on top.
- In 15 min of play, nobody in view, its head was turned more than .2 rad for 9.3 % of its walking (2.8 % without the swivel).

**The page (`skin.body.js`).**  R19 drew .7 of the server's head while it moved and eased it at 1.3-5 /s; a watching head could be .6 rad
behind, and the still figure's T5 "tilt" turned the drawn head up to .85 rad from where it looked.  Now:
- the drawn head is the whole of the server's head, eased at 20 /s (a snap at 22 /s, as before);
- the tilt is a small cock (.06-.12 rad).

NA01: on 53,796 frames of real play, the drawn head is within .115 rad of the server's on 95 % of frames (R19's page on the same
snapshots: .394); the drawn gaze (body + head) is within .243 rad of the sight's centre (R19: .397).  What remains is the body's own
easing on the page and the snaps' first frames.

**Not done.**  No look toward sounds was added: the Skin-Stealer's snap already turns its head to a sound.  No Hound opt-in: its head is
its own.  No larger cone, no new range: the swivel is a direction within the existing cone's rules.

## W4 (checkpoint D3): a second side-step at the same spot goes to the new route (the Skin-Stealer's alone)

**What the combined tree's trace found** (`dev/trial-3-r20-combined/`, the stuck trace at hunger .55).  One Skin-Stealer search was pinned
for 15 s on a corner: 14 side-steps, 5.5 s of red `STUCK`, then two watchdog resets with "stuck: the watchdog cleared its route".  That
is real obstruction, not the open-air kind, but to a player it is the same symptom.

There were two causes:
1. **The goal could not be reached.**  The search's goal was a heard place against a wall, where its body cannot stand.  This is
   inherited from R2 and fixed in the S track (C3): search goals are set down on floor its body fits.
2. **The ladder never reached its new-route rung.**  R8-R19's ladder (side-step at .35 s, new route at .9 s) cannot get there when each
   side-step frees the body for a moment: the timer falls back.  R19's own follower, given the same route, side-steps for all 15 s and
   never plans a new route (ST05's negative proof).

**The change (`ai.entity.js` `follow`).**  For a species with `caps.TURN_AWARE_STUCK` (the Skin-Stealer), a second side-step needed
within 2.5 s and 40 px of the first goes straight to the new-route rung.  The ladder's later rungs are unchanged: an alternate route
that keeps off the spot, then dropping the route.  The Hound's and the Smiler's ladders are R19's exactly (ST05 holds the Hound's to it).
