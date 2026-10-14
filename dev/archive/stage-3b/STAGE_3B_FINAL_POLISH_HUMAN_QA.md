# Stage 3B Final Polish — Human QA

**Status: `STAGE 3B FINAL POLISH HUMAN-QA CANDIDATE — WAITING FOR USER`**

| | |
|---|---|
| branch | `stage-3b-l` (BR-RoLE 1.1), built on the camera checkpoint `stage-3b-n-camera` `b2783b3`; commit and tree are in `STAGE_3B_FINAL_POLISH_PACKAGE_RECEIPT.txt` |
| parent | accepted Stage 3B `69602e7` |
| untouched | `main`, `stage-3b-remaster`, the superseded `stage-3b-n`; Stage 3C not begun |
| start | `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000/> |
| lighting | MEDIUM unless a step says otherwise (SETTINGS ▸ CUSTOMIZE ▸ LIGHTING) |

Only two things changed: **the camera distance** and **how the ceiling lights fall off**. About 15 minutes.
For questions 2–6, switch your own light **off** (F) so you see the ceiling lamps alone.

## 1. Is 1.25 the right camera distance?

Play normally in a 16:9 window (1920×1080 or any 16:9 size). The game now shows a world area of 1536 × 864 px.
The old build showed 1627 × 915 px because it never loaded the camera policy, so you are about 6 % closer.
- If you have a 4K or high-DPI screen, it should look sharper but never show more world.
- An ultrawide or 4:3 window crops one side and never shows more.
- Optional: in DevTools ▸ Network, reload. `camera_policy.js` and `timing_policy.js` should both load with status 200.

## 2. Any circular cutoff?

Walk around YELLOW HALL and REPEATING ROOMS.
- **Lamp light:** it should die away gradually. There should be no ring where it suddenly stops; the old light ended in a circle at 380 px.
- **Your sight limit:** this is about 700 px from you, at the left and right edges of the screen. Lit floor now fades out over the last 80 px instead of ending in a sharp arc.

## 3. Does light carry beyond the strongly lit region?

From YELLOW HALL, walk north into the corridor towards NORTH ROOMS, or south towards the BLACKOUT ZONE.
- Light should thin out gradually into the corridor over a few hundred pixels.
- The middle of a long corridor still ends up black.

## 4. Is the corner spill believable?

Look at the shadow sides of the partition walls in YELLOW HALL and of the pillars in PILLAR HALL, and at the floor beside bright walls.
- Shadows next to bright areas should hold a faint, warm fill that dies away quickly. They were hard and flat before.
- This is deliberately subtle. Bounce light is roughly 15 % of a room's light, and it only comes from surfaces a lamp really lights.
- To compare, type `__brRole.dev.spill(false)` in the DevTools console, then `__brRole.dev.spill(true)`. Each lamp's bounce light rebuilds and fades in within about a second.

## 5. Does any light leak through walls or pillars?

Stand in a corridor that runs beside a lit room, and stand behind PILLAR HALL pillars.
- No glow should show through a wall or a pillar.
- Light may only come round an opening or a corner.

**Known, unchanged:** with a Hound near you, the whole screen may flash brighter for a moment, including what is behind walls. That is the old dread flicker in `mp.js`. It is not part of this pass, and BR-RoLE did not cause it.

## 6. Can fully unlit areas still become true black?

- Go to the BLACKOUT ZONE (it has no lamps) with your light off. It should be **black**.
- The middle of a corridor far from any lamp should also be black.
- **New:** the faint grey glow that used to follow you everywhere, even through walls, is gone. Without a light source you see nothing, and dark corridors stay dark until you switch your light on.
  - That includes your own character: standing in an unlit spot with your light off, you won't see yourself.
  - Lit rooms also look a little darker right around you, because that glow used to add to the lamps there.
- Switching your light on should work as before.

## 7. Does it still run well after warm-up?

Walk through four or five rooms for a minute.
- When you first enter an area, each lamp builds its outer light and bounce light over a few frames, and the faint outer light fades in.
- After that it should play as smoothly as before.
- If it struggles, try LOW.
- `STAGE_3B_FINAL_POLISH_PERFORMANCE.md` has the measured numbers.

---

**If you accept both items, Stage 3B is complete and Stage 3C is next.** If not, tell me what you saw and where:
the room, roughly where you were standing, and the lighting tier.
