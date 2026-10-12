# Stage 3D HQ1: human QA (blood on the wallpaper, dying lights)

HQ1 corrects two things you found in the Stage 3D candidate:

- **Blood on the wall itself.** A body that slams into a wall leaves blood on the wallpaper, not only a stripe on the carpet at its foot.
- **Lights that die.** A light that was on when its wanderer died shines on normally for 3–7 seconds. It then flickers and dims for 1–2 seconds and goes out for good.

The automated evidence is in `STAGE_3D_HQ1_REPORT.md` and `STAGE_3D_HQ1_VISUAL_EVIDENCE.md` (screenshots, and a short clip of a light failing: `dev/stage-3d-hq1/evidence/visual/06_light_failure_10fps.mp4`). It was made in a software renderer (SwiftShader); a real GPU has not been tested. Only a person can judge how it looks on a real screen, and only you can say **HUMAN QA PASSED**.

## Setting up

1. **Start the server with your own passcode.** Unzip `THE_FAR_BACKROOMS_STAGE_3D_HQ1_WALL_BLOOD_DYING_LIGHTS_HUMAN_QA.zip` (or join its parts first: `JOIN_INSTRUCTIONS.txt`) and run, in its folder:

   ```
   ADMIN_PASSCODE=<your own passcode> node server.js 8000
   ```

   On Windows, run `set ADMIN_PASSCODE=<your own passcode>` first, then `node server.js 8000`. Always set a passcode of your own; do not rely on any built-in default. Node 18 or later; nothing to install.
2. **Open three windows.** Open http://localhost:8000 in two browser windows: Alice (the victim) and Bob (the spectator). Open a third window, Carol, and leave it at the name prompt for the late-join checks.
3. **Enter, then stand close.** Enter Alice and Bob. Stand them a few metres apart in a **lit** corridor.
4. **Open the Death Lab.** In Alice's window, press `` ` `` (backtick), enter the passcode and open **DEATHS**.
   - **PLACE ME FIRST**: OPEN ROOM, NEAR A WALL.
   - **PLAY A DEATH ON ME · HOUND**: the **C · WALL SLAM** button (it needs a wall 1–2 body lengths behind you; NEAR A WALL places you so).
   - **AFTER IT PLAYS**: AUTO-REVIVE (on by default) stands Alice up 1.3 s after the death. Turn on BACK TO THIS SPOT to look at the wall from where she stood.
5. **Keep Bob safe.** In the PLAYERS tab press GOD next to Bob. Alternatively, remove the monsters in the MONSTERS tab.
6. **Choosing a light.** Open CUSTOMIZE, then the **Loadout** tab (or **Change** next to Light on the menu): Flashlight, Headlamp, Lantern or Night Vision Camcorder. **F** switches the light on or off.
   - The loadout is locked once a run has started ("LOADOUT LOCKED"). To change it between deaths, turn AUTO-REVIVE off, and after the death press **CHANGE LOADOUT** on the death screen, pick the light, then **RESPAWN**. Reloading the page also works.

## A. Blood on the wallpaper

| # | Do | Expected |
|---|---|---|
| A1 | OPEN ROOM, then NEAR A WALL, then HOUND C. Lights normal, in a lit corridor | Where the body hits the wall, a dark crimson splash appears **on the wallpaper face**, low on the wall above the carpet. It has spray along the wall and thin runs down to the carpet. Both Alice and Bob see it from the moment of the impact |
| A2 | Look at it for a minute; walk around it | The stain stays where it is. It is lit like the wallpaper around it: darker in shadow, never glowing, never in front of the wanderers. It never appears on the dark top of the wall |
| A3 | Carol presses ENTER 30 s or more after the death and walks to the spot | Carol sees the same stain, in the same place |
| A4 | Do A1 against walls facing each way (north, south, east, west of the room) | The stain is on the face that was struck each time |
| A5 | Die near an inner corner, and next to a square pillar | **Corner:** the stain is on the face that was struck and stops at the corner. **Pillar:** pillars have no wallpaper, so there is no wall stain, only the floor blood as before |
| A6 | Stand on the far side of the struck wall | You cannot see the stain through the wall |
| A7 | Die again (the same player) | The first death's stain goes with its corpse, and the new death leaves its own stain |
| A8 | During a death, revive the victim from Bob's admin panel (PLAYERS, REVIVE) after the impact | The stain goes, along with that death |
| A9 | With a stain on screen, open Settings (Esc, then Settings), the **Display** page, and set **Lighting and shadows** to low, medium and high | The stain stays, at every quality (the level's art is rebuilt for each; the stain is part of it) |
| A10 | The floor blood | It is as in Stage 3D: a smear at the foot of the wall and spray on the carpet, never on the wall top |

## B. Dying lights

For these checks, the admin panel's WORLD tab, LIGHTS: BLACKOUT ON makes the dead light the only light, so its timing is easy to see. Bob keeps his own light off.

| # | Do | Expected |
|---|---|---|
| B1 | Alice: flashlight **on**, HOUND A in an open room | The flashlight tumbles out of her hand early in the death. It then shines normally for 3–7 s from that moment, flickers irregularly and dims for 1–2 s (short blackouts, each flash fainter than the last), and goes **completely dark**. Bob sees the same thing at the same moment, within a frame or two |
| B2 | Keep watching for a minute; walk up to it; go away and come back | The dead light stays dark. It never comes back, glows, or lights anything |
| B3 | Carol enters 30 s after a death | Carol sees the corpse's light already off |
| B4 | Carol enters within 5 s of the death | Carol sees the light shine, then fail at the **same moment** as Alice and Bob |
| B5 | Lantern, then headlamp | **Lantern:** the same, an all-round glow. **Headlamp:** it stays on the head, and its hold counts from the death's start (the kill) |
| B6 | Flashlight **off** before the death | Nothing lights up at any time |
| B7 | Camcorder | Nothing lights up, and no infrared glow from the dead camcorder |
| B8 | Alice's own screen: watch her death, then, after AUTO-REVIVE stands her up, look at her corpse | During her death her light shines from where it fell. Once she is up, her corpse's light fails on the same schedule as on Bob's screen. At no moment do two lights come from her death (in Stage 3D her screen showed her death light and her corpse's light together) |
| B9 | DEATH LAB · WATCH IT SLOWLY: 0.25×, or ❚❚ PAUSE, then press the death | The death plays slowly on that screen only, but the light still fails at its real-time moment. The slow-motion body may still be falling when the light goes dark. Bob, not slowed, sees it fail at the same moment |
| B10 | Bob reloads his page (F5) during the light's hold, then re-enters | The light is still on its original schedule. It is not restarted |
| B11 | Bob's light on while a dead light fails | Bob's own light, and every living wanderer's light, shine exactly as before. The ceiling lamps are unchanged |
| B12 | The legacy lighting (dev: add `?lighting=legacy` to the address) | The same timing and darkness with the game's original lighting |
| B13 | NEW RUN (leaving a run) | The "light left behind" works as before. It is not part of this change |
| B14 | During a death, while its light is in its hold, Bob (admin) presses WORLD, then NEW RUN FOR EVERYONE | **Known limitation, judge it:** the reset does not cut the death short. On every screen that shows it, it plays on and its light fails on its normal schedule. No corpse is left on Bob's or Carol's screen; Alice's own screen keeps her corpse (as in Stage 3D). Everyone is moved to the new world's start |

## Known limitations

- **World reset during a death.** An admin NEW RUN FOR EVERYONE while a death is playing does not cut that death short on any screen that shows it. It plays on and its light fails on its normal schedule. No corpse is left on the other screens; the victim's own screen keeps her own corpse and its wall stain (D7 already kept the victim's local corpse through a world reset). With no death in progress, a world reset clears every other screen at once.
- **Joining from the name prompt.** A page that waited at the name prompt during a death redraws the stain once when it enters. You will not see this.
- **Too many stains.** A wall face holds at most 12 stains and a room 48 (the remaster's caps); the oldest goes first.
- **Remaster off.** With the remaster off (dev `?remaster=off`) there is no wallpaper surface, so there is no wall stain. The floor blood is unchanged.

## Reporting

For anything that looks wrong, note the variant, the light kind, which window, and roughly how long after the death. A screenshot helps. When you are satisfied, reply **HUMAN QA PASSED** (only you can).
