# Stage 3B Pillar LOS Correction — Human QA

**Status: `STAGE 3B PILLAR LOS CORRECTION HUMAN-QA CANDIDATE — WAITING FOR USER`**

| | |
|---|---|
| branch | `stage-3b-pillar-los`, from the QA1 candidate `stage-3b-l-qa1` `d3ec226`. The final commit and tree are in `STAGE_3B_PILLAR_LOS_CORRECTION_PACKAGE_RECEIPT.txt`. |
| what changed | Only how the black "out of sight" area is cut around the PILLAR HALL pillars: one function in the game bundle (`Hl`, the sight-polygon builder). |
| frozen | Camera 1.25, fluorescent brightness and falloff, the 170 fixtures, wall / pillar face lighting, flashlight / headlamp / lantern, true black, no player glow, AI and gameplay light. None of them was touched. |
| untouched | `main`, `stage-3b-l-qa1`, `stage-3b-l`, `stage-3b-n-camera`, `stage-3b-remaster`, `br-role`. Stage 3C not begun. |
| start | `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000/> |
| lighting | MEDIUM unless a step says otherwise (SETTINGS ▸ CUSTOMIZE ▸ LIGHTING) |

**What you reported:** "The Pillars LOS Blocking is janky."

**What was wrong:**
- The game builds your sight shape from 96 evenly spaced rays plus three extra rays at every **wall** corner. The pillars' corners never got those extra rays.
- So the black wedge behind a pillar was drawn from whichever of the 96 rays happened to touch it. Its edges sat on those fixed rays (3.75° apart) instead of the pillar's real corners. They stood still, then jumped as you moved, and were cut too wide or too narrow by up to about 3°.
- The black area also starts 24 px past whatever your sight hits, so you can see the top of the wall or pillar face. At a pillar's edge that 24 px went straight through the thin part of the pillar, which lit up a sliver of floor behind it.

**Now:**
- Each pillar's four corners get the same three rays the walls always had.
- The 24 px stops at the far side of the pillar it hit.
- The black wedge now pivots exactly on the pillar's corners, and nothing behind a pillar shows.

About 10 minutes. Ceiling lights on. Your own light can stay **off** except in step 6.

## 1. PILLAR HALL — walk a full circle

Pick one pillar and walk slowly all the way round it, close to it.
- The black wedge behind it should **pivot smoothly around its corners**: its two edges stay on the corners the whole way round.
- There should be no stepping, no jumping, and no shimmering edge.

## 2. Strafe past a corner

Stand a few steps away from a pillar and strafe sideways past one of its corners, back and forth, several times.
- The wedge's edge should slide steadily with you, with no angular popping or sudden wedge jumps.
- Repeat further away (about 3–4 cells): it should be just as steady.

## 3. Very close

Walk up against each face of a pillar, then into each corner of it.
- There should be no full-screen blackout, no inverted or flipped black shape, and no flicker.
- The black area behind the pillar is wide this close (the pillar fills much of your view). That is correct, but its edges should still run exactly from the corners.
- You should still see the near face of the pillar itself (its lit strip), as before.

## 4. Something behind a pillar

Open the game in a second browser window, join the same room, and park that second wanderer behind a pillar. A Hound or Smiler that wanders behind one works too.
- From the first window, it should stay **hidden** while the pillar is between you.
- It should appear only when you have moved far enough that a line from you to its body really clears the pillar's corner. It should not appear early, not flash in for one frame, and not stay hidden after it is clearly in view.

## 5. Several pillars on a diagonal

Cross PILLAR HALL diagonally, from one corner of the hall to the other, past several pillars.
- Each pillar's wedge should behave as in step 1.
- Where two wedges overlap, the overlap should stay stable, with no flickering seams between them.

## 6. Lighting regression

With the ceiling lights, then with your flashlight or lantern on:
- **Pillar faces still receive light.** The face turned toward a fixture or your light shows it, as in QA1.
- **No light passes through a pillar.** The floor behind one is shadowed apart from other fixtures' light.
- **Brightness, falloff and fixture density** should look exactly like the QA1 build you approved.

## 7. Wall regression

Walk past a few wall corners and partition ends elsewhere (YELLOW HALL, the corridors).
- Wall line of sight should feel **exactly as before** this pass. Away from PILLAR HALL the sight shape is identical, value for value.

## Optional: LOW / HIGH

Switch LIGHTING to LOW, then HIGH, and repeat step 2. The black wedge should be the same shape at every setting. It does not depend on the setting at all, so every tier hides exactly the same space.

## Known, unchanged (recorded, not part of this pass)

- **Wall corner exactly due west.** If you stand exactly on the line of a wall face whose corner is due west of you, a thin wedge behind that wall can open for that one position. This wall-corner case existed before this pass. It needs the exact line: 0.01 px either side is fine. Walls were left exactly as they were.
- **The sight edge is hard.** Nothing was blurred or feathered, because a soft edge could show hidden space.
- **The Hound dread flicker** (the screen flashing brighter with a Hound near) is untouched, as asked.
