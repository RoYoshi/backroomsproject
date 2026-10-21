# Trial 3 cognitive predator refinement — owner Human QA (20–30 minutes)

**Status: NOT OWNER-APPROVED.** You rejected R8 ("still incredibly passive and not as threatening as I like... not really smart... needs to
be more fast thinking and responsive"). Nothing below has been seen by you; every expectation is what the simulation and the real-page
checks showed (`CHECKPOINTS.md`, `BEFORE_AFTER.md`). Every number is unapproved (`BALANCE_TABLE.md`). Mark each part
**PASS / MIXED / NEEDS CHANGES / BLOCKED** and score A–I (pack 07) on the form at the end. You may reject even if every automated check
passes; a creature that is dangerous through unfair speed or hidden knowledge fails.

**What to run:** branch `trial-3-cognitive-predator-refinement` at the hash in the handoff message (a commit cannot name its own hash).

```
git fetch origin trial-3-cognitive-predator-refinement
git checkout --detach origin/trial-3-cognitive-predator-refinement
git log -1 --format=%H       # compare with the handoff
npm run build:check          # should say PASS (44 outputs)
ADMIN_PASSCODE=<a passcode of your own> node server.js
```

Open `http://localhost:8000`, start an **online** run. Two tabs (or two browsers) for parts 6 and 9.

## Setup (3 minutes) — R8's, unchanged and re-checked

* Press **`** (backquote), unlock with your passcode, press **K** with the panel open (not in a text field): the **SKIN** tab appears.
  **+ NEAR ME** puts one near you (admin only, at most 4; none appear by themselves). Its spawn hunger is 0.45–0.65: the band you met R8 in.
* **DEBUG** tab → overlay on, **ENTITY LABELS: FULL**: its label shows `HUNGER`, `PLAN`, `WHY` and the `HUNT` line, as on R8. Do each
  part once more **with the overlay off** — you are judging whether it seems to think, not the labels.
* **Hunger:** there is no slider (none added). It rises about 0.1 a minute. **Very hungry / starving:** after + NEAR ME walk out of its
  sight, **MONSTERS → WORLD SPEED 3×**, watch `HUNGER` on its label (from 0.55: 0.8 in about 50 s, 0.95 in about 85 s), then **1×**; do
  not FREEZE meanwhile. **Satiated:** stand by it, **SKIN → NECK BREAK** (a real kill on you); feeding lowers it. (Re-checked on this
  build: the SKIN tab, + NEAR ME and the death previews in Trial 3's `skin_browser.js` t1 / t4, the world speed in t6.)
* A deterministic look at the same situations without a browser: `node dev/tests/run.js s_skincognitive.js` (C01–C22, each printing what
  it measured) and `node dev/trial-3-cognitive-predator/tools/c0_audit.js --seeds 1,2` (the C0 scenes).

## The parts (pack 07)

1. **At rest (2 min), satiated or mildly hungry.** Walk past in its view; run a few steps behind a wall. *Expected:* it turns its head and
   body to what it sees at once (a tenth of a second in the simulation), stops and turns to a close sound; under 0.4 it never hunts or
   springs. Between 0.4 and 0.55 it goes for somebody it sees only **sometimes** (about 0.7 at 0.47) — passed over, it watches you a while
   and lets you go, even when you walk out of its view.
2. **Hungry opportunity (3 min), 0.5–0.65.** Stand in the light facing it, then turn your back for 2–3 s, then face it again; then run
   across a corridor and change direction. *Expected (R8: retreat → wait round a corner → leave):* it **holds you in view** from the dark,
   still while you look at it, and **comes at you the moment you look away** (after a beat of 0.1–0.35 s — a glance shorter than that is
   ignored); it freezes when your eyes come back. Look away long enough and it springs — with its wind-up (about 0.2 s): step aside then
   and it misses. A runner close by may be chased.
3. **Stared down (3 min), 0.5–0.6, then starving.** Keep looking at it and do not move. *Expected (C7):* it does **not** stand like a statue:
   it stands off a few seconds (at most about 8 s still), may go round you out of your sight to come at you from the side, may move to
   another spot once, and then goes (in the simulation 14–29 s); it comes back hungrier. Starving (0.8+) it creeps in under your eyes and
   springs from about 170 px: **real danger even while you stare**, and the tell still saves you if you move.
4. **A glimpse, then gone (3 min), hungry.** Let it see you walk toward a fork, turn the corner, go silent (crouch, torch off), double
   back. *Expected:* a guess at once on the way it saw you go — a cut-off ahead, or a look along it — so a silent double-back **fools it**
   (it searches the wrong way, listens, gives up for a stated reason); a footstep it hears can correct it. It never turns to where you
   really are without hearing or seeing you.
5. **Circling a pillar (3 min), hungry.** Run round a pillar in its view, then reverse. *Expected:* after **a full lap it saw**, it cuts
   across to where you will come round; reverse and it gives the guess up at once. **Known limit:** the pillar is small — its spring
   reaches your ring from where it waits, so reversing there rarely saves you; on a bigger loop it should (not tested: no loop of that size
   was measured).
6. **Ear only, two tabs (3 min).** Tab A seen, then quiet behind a wall; tab B, never seen, runs about elsewhere. *Expected:* B's noise can
   draw it (it stops and listens, goes to look) — it never names B until it sees B, and never finds silent A without a sound or a sight.
7. **Straight race (2 min), very hungry.** Full stamina, run down the long lit hall. *Expected:* you are faster; it chooses within a second
   — a way round that really gets ahead of you, or 3 s on your trail — then stops and watches where you go, listens and guesses (R8 trailed
   you 13 s). Keep moving, even winded, and the lead you won stays won. **Owner decision:** with the short trail it loses a runner who stops
   far down the hall more often than R8 did (PR20).
8. **Hound comparison (2 min).** A Hound in another room: instinct and pursuit; the Skin-Stealer should feel deliberate — waiting for
   your eyes to leave it, going round, guessing.
9. **Two people (3 min), two tabs.** Stand together, then walk up to it together; then split up. *Expected:* it never springs at either of
   you while you are together (C7); it holds you from the dark. Apart, it takes the one who is the better chance (not watching it, alone)
   and keeps to them. Walk right into it and it can still grab (contact).
10. **Threat without cheating (3 min).** Let it catch you by a visible mistake (looking away, standing in reach, walking into it); then
    escape by being clever (keeping it in view, breaking its sight and going silent, a double-back). Watch the wind-up, the contact, the
    death, the corpse, the skin it may wear. No white flash, no new effect; Hounds and Smilers as before.

## What the evidence does not tell you (please judge these)

* **How dangerous .45–.65 should be.** In real pages it killed far more often than R8 (`CHECKPOINTS.md` C6a / C7, pooled with n). Every
  kill was a spring with its whole wind-up at somebody in sight, or a grab in reach — but scripted pages never dodge at the tell.
* **The dodge window** is about 0.35–0.40 s after its wind-up begins (the review's measurement, before network delay): real, but tight.
* **How long a stare-down should last** before it goes (now 14–29 s; R8 7–17 s; before the review, a minute standing still).
* The real-page traces are sampled about once a second: sub-second reaction times are the simulation's (C01, C18), not shown on a page.

## Owner report (pack 07; copy and annotate)

```
HEAD SHA:
HUNGER BAND (as its label showed it):
TESTED WITH DEBUG: ON / OFF / BOTH
PART:            PASS / MIXED / NEEDS CHANGES / BLOCKED     What I saw (movement, seconds, distance):
A Alive and attentive            1-5:
B Fast enough to respond         1-5:
C Makes good tactical decisions  1-5:
D Feels frightening / dangerous  1-5:
E Fails honestly / outsmartable  1-5:
F Distinct from the Hound        1-5:
G Fair physical combat           1-5:
H Consistent without debug       1-5:
I Multiplayer and performance    1-5:
Most passive moment:
Most cunning moment:
Most unfair moment (if any):
VERDICT: ACCEPT BEHAVIOR / NEEDS CHANGES / BLOCKED
```

`ACCEPT BEHAVIOR` does not authorise a merge, a deploy, a protected-branch change, organic spawning, OVERSEER v2 or Hound changes.
