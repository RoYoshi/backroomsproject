# Stage 3D HQ4: human QA (the Wanderer's two shadow defects)

HQ4 changes exactly two things in the accepted HQ3 game (HQ3 QA1). Nothing else is meant to change: not the Wanderer, the gameplay, the gibs, the lighting rules or the admin panel.

- **A. The dark circle is gone.** The small dark crescent that sat behind the Wanderer and turned with her was a separate decorative ellipse in the avatar. It has been removed. BR-RoLE's own shading of the body (darker on the side away from the light) is a different thing and stays.
- **B. The floor shadow stays with the body.** BR-RoLE's cast shadow used to start from whichever hand stuck out farthest away from the light, so turning, or a hand swinging, slid the whole shadow by up to about 8 px. Now it starts from the round body. The hands are still cut out of it and still shaded.

The automated checks ran on a software renderer (SwiftShader); a real GPU has not been tested. Only you can say **HUMAN QA PASSED**.

## Play now

**Option 1: the overlay** (3 files, over the HQ3 game you already unzipped).
1. Stop the server (Ctrl+C).
2. From `HQ4_HUMAN_QA_OVERLAY.zip`, copy the contents of `HQ4_OVERLAY` into the game folder (the one with `server.js`), replacing the files. `WHERE_TO_COPY.txt` in the ZIP says exactly where each one goes.
3. Start the server:
   - Windows: `set ADMIN_PASSCODE=<your own passcode>`, then `node server.js 8000`.
   - Linux or macOS: `ADMIN_PASSCODE=<your own passcode> node server.js 8000`.
4. Reload the tabs with Ctrl+F5 (Cmd+Shift+R on a Mac) and open http://localhost:8000.

The overlay's `gore.js` is HQ3 QA1's own file, unchanged: the white-streak fix your HQ3 ZIP predates. To undo the overlay, copy `REVERT_TO_HQ3_QA1` the same way.

**Option 2: the branch.** Check out `stage-3d-hq4` and run `ADMIN_PASSCODE=<your own passcode> node server.js 8000`.

## The four checks

Mark each one **PASS**, **FAIL** or **NEEDS CHANGE**.

| # | Do | Expected | PASS / FAIL / NEEDS CHANGE |
|---|---|---|---|
| 1 | Stand near a ceiling light, light **off**, and turn on the spot with the mouse | No dark circle or crescent behind or above the Wanderer at any angle. The body is still darker on the side away from the light, as before. Body, hands, gear, hat and colours look identical | [ ] |
| 2 | Stay in the same place and keep turning, then walk a step or two and stop | The floor shadow behind the body does not slide in and out or jump as you turn. It stays attached to the round body and points away from the light | [ ] |
| 3 | Walk toward and away from the light and past a wall; then have a second player shine a flashlight at you from different sides | The shadow still changes direction and length naturally with the lights and with your movement. Nothing shows through walls | [ ] |
| 4 | With a second player: bump into each other in a hall, do one NEW RUN gib and SPAWN, and look at a Hound corpse | Collision, gibs and SPAWN feel exactly as in HQ3, and the detached hands have no white streaks. The corpse looks as before, minus the same dark ellipse under it | [ ] |

**Verdict:** [ ] PASS [ ] NEEDS FIX [ ] REVERT

**Notes:**
