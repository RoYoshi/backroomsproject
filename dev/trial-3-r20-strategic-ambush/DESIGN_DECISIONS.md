# Trial 3 R20, S track (the strategic hunter): design decisions

Trial 3 is **not owner-approved**.  This branch, `trial-3-r20-strategic-ambush`, is built on the N track's watchdog fix
(`trial-3-r20-nani-head-watchdog` at 68d4ff9), which it carries as an explicit dependency (the pack: "integrate it as an explicit dependency
into the Skin branch").  Every value is a **proposal for the owner's QA**.  Each sits in one block, `SK20` in `ai.skinstealer.js`, next to
its neutral value.  The A/B runs that chose them are in REGRESSION.md.

What the owner asked for (pack 00/02):
- somewhat less raw run-to-prey;
- a slightly shorter run;
- more waiting where they will go;
- fatigue read from evidence;
- a player's ears.

What must not change:
- the head snaps and stares, its telegraphs, its kills, hunger, disguise and imperfect belief;
- R19's positioning;
- the chase as it was, when it does chase;
- the Hound and the Smiler.

## S1: a shorter run (stamina)

- `SK.drainRun` 11 → **13**.  An uninterrupted run from full to exhausted takes 7.1 s, against 8.4 s: 15 % less, inside the pack's 10-20 %.
- `SK.chaseFrom` 560 → **500** and `SK.chaseMax` 9 → **8**.  The chase's weight is × **.85** (`SK20.chaseW`).
- The drain's form, its regeneration, the spring's cost and the exhaustion thresholds are all unchanged.

The A/B ran drain 11, 12, 13 and 14 (V6, V4, F, V5).
- At **14** it was exhausted in ordinary play (3.4-3.9 s exhausted per 160 min), with no more kills or posts.
- At **11** and **12** its runs were longer (longest 6.6-7.2 s) for the same kills.
- **13** gave the shortest runs that never exhausted it.

A fresh player's sprint is 285 px/s against its run of 270; that is untouched.

## S2: going to the place at the pace that is needed (measured reposition)

- **R19:** an interception (going round to meet somebody where it guessed they would pass) always ran there at its run.
- **Now:** `skPredict` also returns its route's length and the time it must arrive by.  On each think the interception computes the pace
  that gets it there `SK20.lead` (.3 s) before that, on top of `SK.predictMargin`'s .8 s (`skNeed`, `skPace`), and goes:
  - at its **prowl** (205 px/s, free of stamina) when that will do;
  - at a **burst** of its run only for the part that needs it;
  - at its **run** when it is late.
- The covert way's hidden run is paced the same way.
- An impossible arrival is still refused, as before: `skPredict` returns nothing.

This makes most interceptions a walk: run time is down 30-35 % in ordinary play (REGRESSION).

## S3: posts - waiting where they would come out

Hungry enough to hunt (`SK.huntHunger`) and not exhausted, from **sounds nobody is named for**:
- **The sounds come its way** (the second is 40 px or more nearer than the first, by its fuzzy ears), in the dark (`skPostHere`): it
  waits where it stands, facing them, rather than going to look.
- **Somebody going somewhere some way off** (two fitting sounds over 380 px away, `skPost`): it builds the heading from the two sounds,
  predicts their way along the level (`skRoute` / `skPredict`, as its interceptions do), and goes beside that way, out of sight of it if
  it can.  It waits there, facing where they would come from.

At the post:
- It waits 3 s + 6 × hunger × PATIENCE (as its ambush), longer while the sounds come nearer, never over 14 s.
- Its head turns toward where they would come.
- **Somebody coming into its sight there, unaware, walking its way**, it lies in wait for: an ambush, kept by R13's rule until its spring
  takes them (`skDecide`).  Anybody else it answers as it would anywhere.
- **Sounds passing it by**, unseen, it follows quietly (a search).  When the wait ends it searches the latest sound, or roams.

What a post never does:
- It never names anybody (its `pid` is 0; SH01 and SH12 check this).
- It never goes to a place its hunt already found empty (`H.failed`).
- It never goes to the sound's own place: that was R2's search, which is still what a single or near sound gets.

## S4: going ahead, or waiting where it stands, for somebody it sees

Somebody it sees, who has not seen it (not in their view), walking on:
- **Coming its way, in the dark, whose way passes within 200 px** (`SK20.waitCpa`): it waits where it stands (an ambush) instead of
  coming on.
- **Further off (over 420 px)** (`skAhead`): if there is a spot beside their predicted way, hidden from the way they come, that it can
  reach 0.5 s before them, it goes there (an interception) at the pace that is needed.  It keeps to it while they come on unaware toward
  it, and decides afresh if they see it, run, or turn well away.
- `skAhead` draws only from its own cover stream, so its other draws never move.  It counts as a prediction (R12-B bounds its routes by
  these).

## S5: a hunt's search walks unless the evidence is fresh (the pursuit walk)

- A hunt's search goes to the place at its prowl (205 px/s, free of stamina), not its investigation pace (232, about 3-4 stamina a
  second), unless its newest evidence of them is under 1.5 s old (`SK20.urgent`).
- An anonymous search keeps R16e's pace.

**Tried and not kept: trailing an unaware walker at their own pace.**  The A/B tested two ways of slowing that trail:
- C3: their speed + 40, no press unless they run;
- C4: its investigation pace.

Each cost surprise captures: 3-4 of 26, against 7 of 27 for R19's press (V8).  Kills were no higher.  R19's press for somebody moving off
was kept (`variant.js` `walkerTrail` / `walkerInvestigate` reproduce C3 / C4).

## S6: its belief that somebody is winded, from evidence (never their meter)

**R11-R19** read `r.stamina` and `r.ex`: the person's own meter, copied through its sight (`updateVision`) into its chase decision
(`skDecide` `winded`) and its mind's 'winded' event.

**Now** `skFatigueSee` / `skFatigue` hold a belief per person in its mind's record:
- **Seen:** how long it watched them run without a break (a person runs about 9.5 s from full).
- **Seen:** a walk slower than a fresh person's (110-160 px/s, the winded walk being 148 against 172) soon after a run.
- **Heard:** their ragged breath (the engine's own `breath` sound, made only when they are winded), where it believes them.
- **Out of its sight:** their rest is guessed at the rates people recover, and its confidence halves every 5 s.

The belief has three values:
- `p`, from 0 (fresh) to 1 (winded);
- a confidence;
- a label: fresh / tiring / winded.

It is winded for a decision when p × confidence ≥ .45.  It can be wrong (SH10):
- a long sprint by somebody with breath to spare reads winded;
- a short sprint by somebody whose meter is empty reads fresh.

`e.dbg.fat` shows it in the debug.  Two things are unchanged:
- **The kill variant's choice** at the grab (`pv.ex`, `pv.stamina`).  That is the held body's breath at contact, not a tactical read.
- **The Hound's `r.ex`.**  That is the Hound's own contract, outside this track.

## S7: its ears (HEARING.md)

An opt-in hook in the shared `hearEvent` (`sp.hearScale`, `sp.hearWall`).  Only the Skin-Stealer has it, so the Hound and the Smiler keep
the shared law exactly (NA07).
- **Walk:** × 2.4, ≈ 680 px; a player hears its walk to ≈ 734.
- **Run:** × 1.12.
- **Slide:** × 1.35.
- **Vault and landing:** × 1.2.
- **Through a wall:** .75 of the reach (shared .6).
- **Crouched steps and crawls:** unchanged.

The engine registry `dev/tests/r19n_patch.js` carries its two lines as an R20 hunk of `ai.senses.js`, so PR25 and WL05 still hold the
shared engine to its base plus exactly these hunks.

## S8: an admin summon keeps it on its way

R19's summon set a roam goal.  Its new ears heard the person it had been hunting, and it turned to listen before it got there (PR30).  A
summon now holds its listening off for 8 s while it goes (`e.roam.summon`).

## S9: newer evidence leads an anonymous search

While it goes to look at a sound, a fresher one from another way (500 px or more from where it is going), at least .8 as loud as the one
it went for, moves its goal.  This is within R2's three moves (SH03).

## The earlier checks whose premise its ears changed

R11-R19's checks of hearing and inference set scenes where a walking step some 700-900 px away was out of its hearing.  With a player's
ears it is not.  Each changed check keeps its property and says why, in a comment marked R20:

| check | the premise its ears changed | how it is judged now |
|---|---|---|
| SK23 | a walk back was unheard | B: every interception turns on what it heard or saw, or waits in vain and says so |
| PR10, C20 | no place guessed twice | judged on the same evidence: R2's rule always let a fresh sighting send it back; more seeds (24 and 16) |
| PR11, PR15 | the silent world heard nothing at all | the silent world hears nothing from the parting on; the walk before the parting is heard in both |
| PR12 | went to look | a post counts too |
| PR14 | the run east, unseen | seeds where it never hunted them are set aside, as seeds where it saw the run already were; up to 48 seeds |
| PR17 | the listening phase | a post's or an interception's wait (still, its head turning) counts as one |
| P12 | movement noticed at the edge of its view | seen within a second, and the edge-of-view notice still fires where the sound does not come first |
| SR03 | the other way out | judged while they run; being found later, standing at the hall's end in its hearing, is its hunt |
| X09 | never over its speed | the wind-up's braking is not over its spring's speed |

**Not changed: the owner's crouch stealth.**  A first proposal of crouched steps heard at × 1.9 failed PR11 and PR15.  The proposal was
withdrawn; the test was not changed.
