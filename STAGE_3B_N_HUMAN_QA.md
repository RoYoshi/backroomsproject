# Stage 3B-N — Human QA

**Status: `STAGE 3B-N HUMAN-QA CANDIDATE — WAITING FOR USER`**

This build has behaviour, visibility and camera corrections only. The Stage 3B look is unchanged: the remaster files
are byte-identical to the parent.

| | |
|---|---|
| branch | `stage-3b-n`; commit and tree are in `STAGE_3B_N_PACKAGE_RECEIPT.txt` |
| parent | accepted Stage 3B `69602e7` |
| untouched | `main`, `stage-3b-remaster`; Stage 3B-W and Stage 3C not begun |
| start | `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000/> |
| admin | backtick, passcode as in README. You will need **+ HOUND NEAR**, **AI DEBUG**, BLACKOUT on/off, GOD MODE and freeze. |

About 25 minutes. Use MEDIUM lighting unless a step says otherwise.

## 1. Camera / aspect ratios (3 min)

- **a.** Play in a normal 16:9 window, then resize it to roughly 4:3, then very wide (ultrawide-like), then small.
  - Expected: a 4:3 or 16:10 window crops the sides; a very wide one crops top and bottom.
  - Fail if any shape shows *more* corridor than 16:9 does.
- **b.** If you have a high-DPI or 4K screen, compare it with a normal one, or use browser zoom 100 % vs 200 %.
  - Expected: sharper, never more world.
- **c.** Open DevTools ▸ Network and reload. `camera_policy.js` and `timing_policy.js` should both load (200, not 404).

**Note:** at 1280×720 you now see the full standard view. That window used to see less.

## 2. True darkness (2 min)

- **a.** Admin ▸ BLACKOUT on, or go to BLACKOUT ZONE. Switch your light off (F).
  - Expected: the world is **black**. There is no grey halo around you and no faint walls. The HUD stays readable.
- **b.** Switch the light on.
  - Expected: the beam, the hand glow and lamps (with the blackout off) all work as before.

## 3. Danger flicker behind a wall (4 min)

- **a.** Admin ▸ GOD MODE. Spawn **+ HOUND NEAR**, then put a wall between you and it at roughly 300–500 px. AI DEBUG
  shows where it is.
- **b.** Stay there. When the dread builds (heartbeat, vignette), lamps around you surge and flicker.
  - Expected: lamps you can see brighten for a moment.
  - Fail if, on **any** frame, the Hound, the far side of the wall or anything behind a pillar shows through.
- **c.** Repeat with a pillar in PILLAR HALL between you and the Hound.
- **d.** Expected: the screen shake moves the whole view together. No edge of hidden world appears at the borders of
  your sight.

## 4. Pillars and fluorescent fixtures (3 min)

- **a.** Go to PILLAR HALL.
  - Expected: no fixture sits on a pillar. Each of the nine hall fixtures now hangs one cell east of its pillar.
- **b.** Walk slowly **all the way round** a pillar, then quickly, with your flashlight on, then off.
  - Expected: the pillar's shadow edge is straight and steady. There is no wedge that slides or jitters as you move, and
    no one-frame flash of what is behind the pillar.
- **c.** Stand still near a pillar for a few seconds.
  - Expected: nothing oscillates.

## 5. Crouch → Shift → run (3 min)

- **a.** Open floor: **C** (crouch), then hold **Shift** and a direction.
  - Expected: you stand up and run at once, with no second C.
- **b.** Under a table or bench, or in a wall hole: crawl with Shift held.
  - Expected: you stay low while it is too low to stand, and you stand and run as you come out.
- **c.** Run until exhausted, then crouch and hold Shift and a direction.
  - Expected: you stay crouched; once your stamina recovers, you get up and run.
- **d.** Crouch-walk and tap Shift several times.
  - Expected: no flickering between standing and crouching.
- **e.** Run, then press C to slide.
  - Expected: the slide still ends low. With Shift still held you run on after the short recovery.
- **f.** Hold Shift while standing still, then press C.
  - Expected: C still crouches you. Press Shift again to get up and run.
- **g.** With a second player watching:
  - Expected: they see you crouch, then run, and you are never snapped back.

## 6. Hound chase around a corner (4 min)

Use GOD MODE and AI DEBUG: the overlay shows the state and the pursuit goal.

- **a.** Get a Hound to commit (HUNTING), then run round a corner and **keep running**.
  - Expected: it stays HUNTING and follows at pursuit speed. It reaches the corner and comes on round it, guided by your
    footsteps (pursuit `ear`). It never goes CURIOUS.
- **b.** Same chase, but once round the corner, **stop and stay still**.
  - Expected: it runs to where you vanished, then on along the way you were heading (pursuit `lkp` → `route`). Then it
    sniffs and searches the other openings, and eventually gives up with a reason.
- **c.** Same, but once round the corner, **creep back the other way quietly**, crouched.
  - Expected: it should often be fooled and go on along your old heading.

## 7. Hound hearing a recent close sprint (3 min)

- **a.** Lights off, BLACKOUT on. Stand near a resting Hound, out of its view, and sprint past it a few metres away.
  - Expected: **ALERT immediately**. It turns to the sound and rushes the spot, clearly faster than a curious walk.
- **b.** From far away, take one or two quiet steps.
  - Expected: at most a look and a slow walk toward it, with no alarm.
- **c.** While it walks off to check an old faint sound, sprint close by somewhere else.
  - Expected: it switches to you.
- **d.** Run past it continuously at a distance.
  - Expected: its goal follows smoothly without twitching on every footstep.

## 8. Performance feel (3 min)

- **a.** Walk PILLAR HALL, YELLOW HALL and a corridor with the flashlight on, at MEDIUM, then HIGH.
  - Expected: it feels as smooth as Stage 3B on your machine. BR-RoLE has slightly less work than before.
- **b.** Fight a chase near pillars.
  - Expected: no stutter when you round them.

## Balance point for your call

Because a Hound no longer gives up at a momentary loss of sight, a fresh sprinter who simply keeps running is caught a
little more often:
- in the existing chase benchmark, 41 % of fresh runners are caught within 8 s (it was 25 %);
- exhausted runners are still caught far more often (66 %);
- 58 % of fresh runners still widen the gap.

Breaking line of sight and going **quiet** is the escape. Running loudly is heard and followed by ear, at 85 % of the
Hound's sighted chase pace. If it feels too sticky, that pace is one number (`HEAR_PACE` in `dev/ai_src/50_hound.js`).

## Questions

1. Does any aspect ratio or DPI give you more world than another?
2. Is the darkness right: black where nothing lights it, readable HUD?
3. Did any danger flicker show you anything behind a wall or pillar?
4. Are the pillar shadow edges and the moved fixtures stable and believable?
5. Does crouch → Shift → run feel right, including under tables and after slides?
6. Does the Hound keep the chase round corners and still lose you when you go quiet?
7. Does a close sprint alarm it, and do faint distant steps not?
8. Any performance difference from Stage 3B on your machine?
