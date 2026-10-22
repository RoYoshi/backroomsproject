# Trial 3 R9–R17 — owner Human QA (35–45 minutes)

**Status: ENGINEERING COMPLETE — READY FOR OWNER HUMAN QA — NOT OWNER APPROVED.** R8 was rejected; nothing below has been seen by you.
Every expectation is what the simulation and the real-page checks showed (`REGRESSION.md`, `BROWSER_AND_MEDIA.md`); every number is
unapproved. Judge what you see and feel, not the labels. Mark each part **PASS / MIXED / NEEDS CHANGES / NOT CHECKED**, and for the whole
choose one of: APPROVE R9 BEHAVIOR ONLY · APPROVE ART ONLY · APPROVE D ONLY · APPROVE TRIAL 3 OVERALL · NEEDS CHANGES · BLOCKED. A subset
is never an overall approval, and an approval is still no merge and no deploy.

## What to run (5 minutes)

Branch `trial-3-r9-cognitive-ambush-overhaul` at the full hash in the handoff message (a commit cannot name its own hash; the receipts in
`REMOTE_RECEIPTS.md` list every pushed commit). A local, isolated server - not production:

```
git fetch origin trial-3-r9-cognitive-ambush-overhaul
git checkout --detach origin/trial-3-r9-cognitive-ambush-overhaul
git log -1 --format=%H          # compare with the handoff
npm run build:check             # should say PASS
ADMIN_PASSCODE=<a passcode of your own> node server.js
```

Open `http://localhost:8000` and start an **online** run; two tabs or two browsers for parts 12 and 14. Headphones help (parts 3 and 10).

* Press **`** (backquote), unlock with your passcode, then **K** with the panel open (not in a text field): the **SKIN** tab appears.
  **+ NEAR ME** puts one a few hundred px from you, out of sight where it can; **+ SKIN-STEALER** puts one far off in the dark. At most
  four; none ever appear by themselves (no ecology, no director).
* **DEBUG** tab → overlay on, **ENTITY LABELS: FULL**. Its label: `HUNGER <value> <band>  PLAN <plan>`, `WHY …`, and (new in R16g)
  `EYES SOUND | MOTION | SIGHT (its body turned): <what>` - what last turned its head - `FOOTWORK P<n> sideways <s> backing <s>` while it
  fights for its place close to somebody, and `CUT <plan> (<class>) <s>s ago: <why>` or `KEPT …` - the last time something it perceived
  cut its plan, or did not and why. `MOVE COVERT | OPEN | FEINT` says how it is moving (R13).
* **Do each part once more with the overlay off.** The overlay shows what it decided; only your eyes can say whether it felt alive,
  clever, fair and dangerous.

**Hunger.** There is no hunger slider (none was added). A spawn starts at 0.45–0.65 and rises about 0.1 a minute. Bands: under 0.2
satiated, 0.2–0.4 mild, 0.4–0.6 hungry, 0.6–0.8 very hungry, 0.8+ starving. From 0.4 a person it sees is prey.
* *Hungrier:* walk out of its sight, then **MONSTERS → WORLD SPEED 3×** and watch HUNGER on its label: from 0.55 it reaches 0.8 in
  about 50 s and 0.95 in about 85 s at 3×. Then **1×** (judge reactions only at 1×). Do not FREEZE meanwhile.
* *Satiated:* stand by it, **SKIN → NECK BREAK** (the preview plays a real kill on you); it feeds and its hunger drops. Respawn, repeat
  if still above 0.2.

## The parts

**A. The October 22 refinement: perception, interruption, hunger, footwork**

1. **It sees me and stops going where it was going (3 min), hungry 0.4+.** Let it roam; step into its sight ahead of it, lit, 400–600 px
   off. *Expected:* on that moment (within about half a second) it gives up its route - it turns to you and approaches, flanks, watches
   or withdraws by its plan. It never walks on along its old route as if it had not seen you. Satiated or mildly hungry it may only look
   and go its way - that is its choice, said on its label (`PLAN`, `WHY`).
2. **The edge of its eye (3 min).** Stand still in the dark beside its route, off to its side; as it passes, walk. *Expected:* movement
   at the edge of its view turns its **head first** (a snap, about a tenth of a second), its **body** follows when the head cannot reach;
   then it sees you, or - if you were too far or too dark to make out - it looks toward where it noticed something. Standing still in the
   same place, you are not noticed by that edge of its eye.
3. **A sound behind it (2 min).** Behind it, out of its sight, run three steps and stop. *Expected:* its head turns to the sound first,
   then its body; it listens, then goes to look from somewhere it could see the place, then closer. It goes to roughly where the sound
   was, never to your exact spot; stay quiet and it can miss you.
4. **Hunger changes the answer (4 min).** The same meeting - lit, in its sight at about 500 px, looking at it - at hunger ≈0.25 and
   ≈0.9. *Expected:* fed, it notes you and goes its way or keeps its distance; starving, it comes for you: openly, or round you to come
   from a side. Starving is active, never a spectator. It never grows faster than its run, never sees farther or through walls, and
   never knows where you are without seeing or hearing you.
5. **Circle it, feint it (3 min), very hungry.** Run round it at 200–300 px, torch on, then reverse. *Expected:* it **faces you** and
   **steps sideways** after you, gives ground when you come at it, and places itself toward your way out (a doorway, the open corridor).
   Your reversal fools it for a moment (a few tenths of a second in the checks) - then it answers. It turns no faster than its kind can
   (circled fast it lags you a little), runs only when it is hungry enough to give chase (below 0.6 it keeps an approach's pace), and
   never moves faster than its run: a fresh sprint straight away from it still wins.

**B. The owner's eight experiences (09_OWNER_HUMAN_QA.md)**

6. **It was looking at me (2 min).** Walk past a satiated one, then a hungry one. *Expected:* you can tell when it notices you without
   DEBUG - its head comes round to you; hungry, it is interested, not idle.
7. **It fooled me, not itself (4 min), hungry.** Let it see you once. *Expected:* it withdraws, and only once out of your sight moves
   quickly to where it guesses you will come out. It never creeps across your open view to its chosen spot.
8. **I outsmarted it (3 min).** After that glimpse take an unexpected quiet turn, or crouch and stop. *Expected:* it can wait in the
   wrong place, listen, search a while and give up. No snapping to your real position.
9. **It reacted to a mistake (2 min).** Turn and catch it crossing. *Expected:* it knows it has lost surprise and changes tactics
   believably - no teleport, no flicker between plans.
10. **My hearing mattered (3 min).** Behind a wall you may hear it move; you must **not** get its heartbeat or sting until you can see
    it. On the reveal, the cue comes at once. (Hound and Smiler dread are unchanged.)
11. **It looked right from overhead (2 min), no overlay.** Tall, long-limbed, read from straight above; it faces where it goes or
    where it looks; a short grounded shadow; nothing of it drawn across a wall; in a borrowed skin, a Wanderer's size
    (`R14_TOPDOWN_ART_REPORT.md`).
12. **The fourth death (2 min).** **SKIN → D THE REND** on you, with a second tab watching. *Expected:* two halves, its own sound, the
    same on both screens and for a late joiner; A, B and C unchanged; never a new attack (a variant of the same grab).

**C. Fairness and regression**

13. **Fresh sprint (2 min).** Full stamina, run straight away down the long lit hall. *Expected:* you pull away. Winded, it is far more
    dangerous. Its wind-up (about 0.2 s) always shows before a spring: step aside and that spring misses.
14. **Two people (3 min).** One stands in front of it, the other makes a sound behind it. *Expected:* its head turns to the sound while
    it deals with the first; it never knows whose footsteps they are until it sees someone.
15. **No Skin-Stealer (2 min).** **− SKIN-STEALER** until none: Hounds and Smilers, their dread, deaths, chat and replays as before.

## Your record (one per observation)

```text
BRANCH / FULL HEAD:
SCENARIO (part number) / VIDEO OR SCREENSHOT:
HUNGER / APPROX. DISTANCE / LEVEL GEOMETRY / OVERLAY ON OR OFF:
WHAT ACTUALLY HAPPENED (no interpretation first):
WHAT I EXPECTED:
DID IT SEE ME AND STILL WALK ON?          DID ITS HEAD TURN BEFORE ITS BODY?
DID IT VISIBLY EXPOSE ITS OWN AMBUSH?     DID A WARNING PLAY WHILE IT WAS HIDDEN?
WAS PREDICTION EARNED OR OMNISCIENT?      WAS IT EVER FASTER THAN IT SHOULD BE?
ANATOMY / TOP-DOWN QUALITY:
EXECUTION D / CORPSE / REPLAY:
DEBUG LINES (EYES / CUT / KEPT / FOOTWORK / WHY), if any:
PASS / MIXED / NEEDS CHANGES / BLOCKED:
```

Deterministic versions of most parts, without a browser: `node dev/tests/run.js s_skinap.js` (P01–P18, the October 22 refinement) and
`node dev/trial-3-r9-overhaul/tools/repro_ap.js` (the before/after probes); the real-page ones: `node
dev/trial-3-r9-overhaul/tools/r16g_campaign.js --part focused` (F1–F7) and `--part continuous --mins 12`.
