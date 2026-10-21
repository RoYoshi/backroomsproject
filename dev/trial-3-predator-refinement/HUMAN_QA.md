# Trial 3 predator refinement — owner Human QA (20–30 minutes)

**Status: NOT OWNER-APPROVED.** Trial 3, the B1–B5 behaviour refinement and this predator refinement all await your play-test. Nothing
below has been observed by you; every expectation is what the simulation and the browser checks showed (`CHECKPOINTS.md`). Every number
is unapproved (`BALANCE_TABLE.md`). Mark each part **PASS / MIXED / NEEDS CHANGES / NOT CHECKED**.

**What to run:** branch `trial-3-predator-refinement` at the hash in the handoff message (a commit cannot name its own hash).

```
git fetch origin trial-3-predator-refinement
git checkout --detach origin/trial-3-predator-refinement
git log -1 --format=%H       # compare with the handoff
npm run build:check          # should say PASS (44 outputs)
ADMIN_PASSCODE=<a passcode of your own> node server.js
```

Open `http://localhost:8000`, start an **online** run. Two tabs (or two browsers) for parts 4, 8 and 10. Each meeting is the creature's
own seeded choice: if something does not happen, try again or spawn another (at most 4; none appear by themselves).

## Setup (3 minutes)

* Press **`** (backquote), unlock with your passcode, press **K** with the panel open (not in a text field): the **SKIN** tab appears.
  **+ NEAR ME** puts one near you.
* **DEBUG** tab → overlay on, **ENTITY LABELS: FULL**. Its lilac label shows `HUNGER <value> <band>`, `PLAN`, `WHY`, and the new line
  `HUNT P<n> sure <0..1> (seen | heard <s>s ago, ±<px>, heard <s>s ago) effort <s>/<budget>s flanks <n> guesses <n> (<kind>) failed <n>
  (tried the other way) heard <n> revised <n>` — or `HUNT over <s>s ago: <why>`. *sure* is its confidence; *heard* counts footsteps it
  took for yours (it never knows they are yours: a second person can fool it).
* **Do each part once more with the overlay off.** You are judging whether it feels alive, clever and dangerous, not the labels.

**There is no hunger slider** (and none was added). Hunger rises by itself, about 0.1 a minute; a spawn starts at 0.45–0.65.
To reach a band:

* **Very hungry / starving (0.75+):** after + NEAR ME, walk away out of its sight (another room), then **MONSTERS tab → WORLD SPEED 3×**
  and watch HUNGER on its label (debug overlay): from 0.55 it reaches 0.8 in about 50 s and 0.95 in about 85 s at 3×. Then **1×**.
  Do not FREEZE meanwhile (a frozen world does not get hungrier).
* **Satiated (under 0.2):** stand by it, **SKIN tab → NECK BREAK** (the preview plays a real kill on you); it feeds on your body and its
  hunger drops (a kill takes 0.35, feeding about 0.03 a second). Respawn and repeat once more if it is still above 0.2. Disturb it within
  8 s with the second tab if you do not want it to wear your skin.
* For a deterministic look at the same situations without a browser: `node dev/tests/run.js s_skinpredator.js` (26 scenarios on the real
  simulation; each prints what it measured) and `node dev/trial-3-predator-refinement/tools/repro_r0.js` (the before/after table).

## The parts

1. **Alive at rest (2 min), any hunger under 0.4.** Watch it from outside its space; walk round a pillar; make noise (run a few steps)
   behind a wall. *Expected:* it pauses, turns its head and body toward what it saw or heard; hungry (0.4+) it **stops, turns to a
   sound and listens** (crouched a little, still, its head sweeping) and then may go quietly to look where it heard it; a single faint
   sound with nothing after it is let go. Not a roaming animation only.
2. **Continuous stare (3 min), very hungry or starving.** Torch on, face it from a safe distance in a lit place and keep looking.
   *Expected:* it does **not** simply leave. Depending on the place and its seeded temperament it **goes round you** to cover at your
   side (it breaks your line of sight and settles there a moment), backs off round a corner as **bait** and waits, **holds a standoff**,
   or — starving, or after its other tries failed, or where there is no way round (a narrow corridor) — **comes on openly**. If it
   springs, the crouched **wind-up** (about 0.2 s) is always shown first: step aside or run at the tell and that spring misses. A person
   who only stands and stares at a starving one is in real danger.
3. **One sighting, then vanish (3 min), hungry.** Let it see you walking or running toward a fork, turn the corner, go silent (crouch,
   torch off) and stay put or move on quietly. *Expected:* it goes round to where it **guesses** you will come out (an interception,
   waiting with its head turning), or it **stops and listens** first, then searches where it believes you are. It **can guess wrong**:
   it then tries elsewhere (the other way at that fork, where it believes you are, where it last had you) — never the same empty corner
   twice — and finally gives up for a stated reason (`no sign of P… for N s`, `the trail is cold`). Silent and out of its sight long
   enough, you escape (10–22 s after its last evidence in the tests).
4. **Hunted by ear (3 min).** Hide behind a wall and walk (not crouch) so it hears you. *Expected:* it turns to the **sound** and
   comes toward where the sound was (fuzzy: not your exact spot). Stop, crouch and stay still: it can lose you. With a second player
   making noise elsewhere: it may follow *that* noise — it never knows whose footsteps they are until it sees someone.
5. **Misleading trail (3 min).** After it has lost sight of you, run a few loud steps one way, then crouch and double back silently.
   *Expected:* it follows the noise and is **fooled** when nothing more comes (5 of 8 in the tests). Make a second clear sound on the
   way back: it can **revise** its guess toward it (not guaranteed: sounds are fuzzy).
6. **Fresh sprint (2 min), very hungry.** Full stamina, run away along the long lit hall. *Expected:* it gives chase and **loses** the
   race (it never runs faster than its own top speed; you pull away). A hungry one then **does not go home**: it keeps to your trail at a
   walk, and if you stop in the open it reaches you; if you break its sight and go quiet, it listens, searches and gives up.
7. **Winded runner (2 min).** Repeat with your stamina low. *Expected:* it closes to striking distance and is far more dangerous.
8. **Satiated temperament (2 min).** Satiated (setup above). Walk past it once. *Expected:* at most a look; no hunt, no attack. Then
   crowd it and follow it: B1–B5's warning (it hunches, backs off), and if you keep pressing, its defence (a short lunge or a
   withdrawal). Back off after the warning: it calms down and does not come after you.
9. **Size and silhouette (2 min), no overlay.** Stand a Wanderer next to the undisguised creature in the same light. *Expected:* it is
   visibly larger than a Wanderer (about 1.3×: `BODY_SCALE`), clearly facing one way, long arms close to its body, no splayed
   "frog" legs; still smaller than a Hound. In a doorway and beside a pillar nothing of it is drawn across the wall. In a borrowed skin it
   is exactly a Wanderer's size. (Screenshots: `evidence/r5_shots/`.)
10. **Regression (2 min).** A world with no Skin-Stealer: Hounds and Smilers as you know them; chat, deaths and replays, sounds; no
    white flash or new full-screen effect.

## Rubric (pack 10)

| Criterion | PASS when | Your mark |
|---|---|---|
| Feels alive | responses are physical, coherent and varied without the overlay | |
| Intelligent | extrapolates from what it saw or heard, right or wrong, and changes plan on new evidence | |
| Dangerous | very hungry is a credible threat even while you stare; it can earn a kill by stalking or an ambush | |
| Fair | quiet stealth works sometimes; it can be wrong; a fresh runner wins the straight race; the wind-up can be dodged | |
| Sized right | more imposing at base form; nothing drawn through walls; a skin is player-sized | |
| Distinct | not a fast, aggressive Hound: calculating, deceptive, sometimes uninterested | |
| Stable | no Hound / Smiler regressions, no performance problems | |

## Feedback template

```
BRANCH/HEAD:
HUNGER BAND (as its label showed it):
SCENARIO (part number):
WHAT I SAW (movement, seconds, distance):
WHAT I EXPECTED:
DEBUG WHY / HUNT (if on):
PASS / MIXED / NEEDS CHANGES / BLOCKED:
```

**Outcomes:** ACCEPT BEHAVIOR (does not authorise a merge or a deploy) · NEEDS CHANGES · BLOCKED / DECISION NEEDED · ROLL BACK to
`4518f93`. The size can be judged separately from the behaviour.
