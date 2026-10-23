# Trial 3 R9–R18 — owner Human QA (R18 first, 15–20 minutes; then 35–45 minutes)

**Status: ENGINEERING COMPLETE — READY FOR OWNER HUMAN QA — NOT OWNER APPROVED.** R8 was rejected; nothing below has been seen by you.
Every expectation is what the simulation and the real-page checks showed (`REGRESSION.md`, `BROWSER_AND_MEDIA.md`); every number is
unapproved. Judge what you see and feel, not the labels. Mark each part **PASS / MIXED / NEEDS CHANGES / NOT CHECKED**, and for the whole
choose one of: APPROVE R9 BEHAVIOR ONLY · APPROVE ART ONLY · APPROVE D ONLY · APPROVE TRIAL 3 OVERALL · NEEDS CHANGES · BLOCKED. A subset
is never an overall approval, and an approval is still no merge and no deploy. **R18, the tip, is the overtuned experiment you asked
for** (October 22, 22:02): playing it is to find what to turn down; it is not offered as tuned, and R17 (`636f01e`) is there to compare.

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
* **DEBUG** tab → overlay on, **ENTITY LABELS: FULL**. Its label: `HUNGER <value> <band>  PLAN <plan>`, `WHY …` (R16i, R18: `… it comes on,
  fast (its press)` when a hungry one you have seen closes on you openly), and (new in R16g)
  `EYES SOUND | MOTION | SIGHT (its body turned): <what>` - what last turned its head - `FOOTWORK P<n> sideways <s> backing <s>` while it
  fights for its place close to somebody, and `CUT <plan> (<class>) <s>s ago: <why>` or `KEPT …` - the last time something it perceived
  cut its plan, or did not and why. `MOVE COVERT | OPEN | FEINT` says how it is moving (R13).
* **Do each part once more with the overlay off.** The overlay shows what it decided; only your eyes can say whether it felt alive,
  clever, fair and dangerous.

**Hunger.** There is no hunger slider (none was added). A spawn starts at 0.45–0.65 and rises about 0.1 a minute. Bands (the label):
under 0.2 satiated, 0.2–0.4 mild, 0.4–0.6 hungry, 0.6–0.8 very hungry, 0.8+ starving. At R18 a person it sees is prey from 0.3, and from
0.45 it may run, press and rush (R17: 0.4 and 0.6), graduated by hunger rather than switched at a line.
* *Hungrier:* walk out of its sight, then **MONSTERS → WORLD SPEED 3×** and watch HUNGER on its label: from 0.55 it reaches 0.8 in
  about 50 s and 0.95 in about 85 s at 3×. Then **1×** (judge reactions only at 1×). Do not FREEZE meanwhile.
* *Satiated:* stand by it, **SKIN → NECK BREAK** (the preview plays a real kill on you); it feeds and its hunger drops. Respawn, repeat
  if still above 0.2.

## R18 first: the overtuned experiment (15–20 minutes)

You asked for it overtuned: **it is meant to feel too strong.** Play it, then say what to tune down - every R18 number is one value in
`src/frameworks/nani/server/ai.skinstealer.js` (`SKIN.speeds`, `SK`), `ai.skin.move.js` (`SKF`) or `ai.skin.preempt.js` (`SKP`), listed in
`DESIGN_DECISIONS.md` R18-2 to R18-9. To feel the difference, play the same parts on R17 (`git checkout --detach 636f01e`, then
`npm run build`) - R17's creature is R16i's.

**What changed (R18).** Its speeds: walk 160 (R17 105), prowl 205, investigation 232, press 260 (R17 238), run 270 (R17 255) - all under
your fresh sprint (285, unchanged). It hunts from hunger 0.3 (R17 0.4) and runs, presses and rushes from 0.45 (R17 0.6), graduated, not
at a line. It pauses less, watches less, prowls when far from everyone (R17 stood still), escalates a standoff, comes straight in on
somebody going away from it, searches longer and tries the open ways out of the place it lost you. Its head snaps and its stare are
R17's. **Your movement, the Hounds and the Smilers are R17's byte for byte.**

**Label.** `PLAN` and `WHY` say each mode: `prowling where it heard somebody 12 s ago` (its prowl, 205); a search's `it goes to where
it believes P<n> is` or `it goes the way it thinks P<n> went` (on its way, its investigation, 232); `... it comes on, fast (its
press)` (260); `P<n> runs: it gives chase` (270); `far from everyone: it prowls the level`; `... it breaks cover and rushes`.

| # | Do this (lit hall, hunger as given; WORLD SPEED 3x to raise hunger, then 1x) | Expected at R18 | Judge |
|---|---|---|---|
| R1 | **Walk away.** Hunger 0.8: let it see you at 600 px, look at it 2 s, then walk off down the hall | it comes on openly at once, presses (260), runs when you keep going; taken in about 4 s in the checks. At 0.55-0.7 it often goes the long way round first (7 s out of sight) and may lose you - see `DEFERRED.md` | is walking away from a very hungry one a mistake? |
| R2 | **Sprint away at once**, fresh, straight down the long hall, from 600 px | you pull away (285 against 270) - slowly: 15 px/s. It gives chase and gives up out of breath or 170 px behind. Winded (148 px/s), you are caught | does a fresh sprint still save you? |
| R3 | **Dither.** At 650 px, hunger 0.7: a few steps one way, look about, a few steps the other | it vanishes round you (its covert way, about 7 s), then rushes you from your side; taken in 9-12 s in the checks | does hesitating feel like an opening it takes? |
| R4 | **Circle it** at 200-300 px, very hungry, then reverse | it faces you, steps sideways, comes straight in when you move away from it; your reversal fools it 0.3-0.9 s | still fair? still beatable by a good feint? |
| R5 | **Hide behind a wall** after it saw you, torch off, crouched, still | it comes to where it last saw you quickly (its prowl/investigation), looks, tries the ways out; it does not know where you are. It finds a still croucher near its search more often than R17 | too good at finding you? |
| R6 | **Leave by another way** quietly after it lost you | it goes where its evidence points, then the open ways out of that place - never straight to you | earned, or omniscient? |
| R7 | **Unaware prey.** Walk away from it, torch on, never looking back, hunger 0.75 | it comes after you at once at its prowl/press | |
| R8 | **A sound.** Out of its sight, run three steps and stop | its head first (unchanged), then it goes to look at 205-232 px/s - from closer than 450 px it goes quietly (a stalk) | |
| R9 | **Dodge its spring.** Step sideways at its wind-up (about 0.2 s) | the spring misses; it recovers (unchanged) and comes again at once | |
| R10 | **Fed** (under 0.3): stand near it, harmless | it looks and keeps its distance or leaves - never hunts | |
| R11 | **Two people split up** (two tabs) | it picks one and goes after them - or, a lone ambusher, leaves you both (1 of 3 real-page runs) | |
| R12 | **A long hunt**: keep moving round the hall's middle with short sprints | its breath runs out (it slows to 190, exhausted 120) and comes back; it hunts while it has evidence | does it ever feel unfair? |
| R13 | **A standoff.** Stand and watch it, lit, at 400-600 px, hunger 0.6 | its stare (unchanged), then it advances - sooner the hungrier (5 s just hungry .. 1.2 s starving) - and, hungry enough, runs | does the stare still land before it moves? |

**Tell us** for each: too strong / right / too weak, and which speed or reaction you would turn down first. The R18 decision record
(`DESIGN_DECISIONS.md` R18-11) has what the checks measured beside R16i (R17) and R8.

## The parts (R9–R17's, with R18's numbers)

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
   from a side. Starving is active, never a spectator. **New in R16i (R18's numbers):** openly, once it is on your screen and hungry (0.45+,
   rested), it closes fast and upright - its *press*, 232-260 px/s by hunger (R16i: 238 from 0.6), between its walk and its run - until it
   is about 400 px off (R16i 340), where it fights for its place as in part 5; it spends breath doing so and stops pressing when winded.
   Under 0.45, tired, unseen or disguised it does not press. It never grows faster than its run (270; R16i 255), never sees farther or through walls, and never knows where you are without
   seeing or hearing you. Judge whether the press feels purposeful and dangerous, or too fast.
5. **Circle it, feint it (3 min), very hungry.** Run round it at 200–300 px, torch on, then reverse. *Expected:* it **faces you** and
   **steps sideways** after you, gives ground when you come at it, and places itself toward your way out (a doorway, the open corridor).
   Your reversal fools it for a moment (a few tenths of a second in the checks) - then it answers. It turns no faster than its kind can
   (circled fast it lags you a little), runs only when it is hungry enough to give chase (below 0.45 it keeps an approach's pace; R16i 0.6), and
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

13. **Fresh sprint (2 min).** Full stamina, run straight away down the long lit hall - also when it is pressing toward you. *Expected:*
    you pull away (285 against its 260 press and 270 run at R18; 238 and 255 at R17). Winded, it is far more dangerous. Its wind-up (about 0.2 s) always shows before
    a spring: step aside and that spring misses. **Your own movement is R8's exactly** - walk 172, a fresh sprint 285, crouch, crawl,
    slide, vault, stamina, exhaustion and the floors' effects: nothing in it was changed on this branch (`dev/tests/s_wandererlock.js`,
    WL01-WL06, proves it against R8). If your movement feels different, that is a finding.
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

Deterministic versions of most parts, without a browser: `node dev/tests/run.js s_skinap.js` (P01–P18, the October 22 refinement),
`node dev/tests/run.js s_wandererlock.js` (the Wanderer's movement against R8), `node dev/trial-3-r9-overhaul/tools/repro_ap.js` (the
before/after probes) and `node dev/trial-3-r9-overhaul/tools/press_eval.js --press 230` (or 238, 245: the press's meetings). R18's
measurements: `node dev/trial-3-r9-overhaul/tools/threat_sim.js --mins 15 --seeds 12 --hunger .55` (ordinary play at true speeds; add
`--dir <another tree>` to set R17 or R8 beside it) and `node dev/trial-3-r9-overhaul/tools/scene_probe.js --scene walkaway|dither
--hunger .7`. The real-page ones: `node dev/trial-3-r9-overhaul/tools/r16g_campaign.js --part threat` (S1–S13), `--part focused` (F1–F7)
and `--part continuous --mins 12`.
