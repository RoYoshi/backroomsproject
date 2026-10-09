# Stage 3B Final Visual Polish — Human QA

**Status: `STAGE 3B FINAL VISUAL POLISH HUMAN-QA CANDIDATE — WAITING FOR USER`**

| | |
|---|---|
| branch | `stage-3b-l-qa2` (BR-RoLE 1.1-qa2), from the accepted-overall QA1 build `stage-3b-l-qa1` `d3ec226`. The final commit and tree are in `STAGE_3B_FINAL_VISUAL_POLISH_PACKAGE_RECEIPT.txt`. |
| camera | 1.25 as you accepted it (1920×1080 → 1536×864 world). Not touched. |
| untouched | `main`, `stage-3b-l-qa1`, `stage-3b-l`, `stage-3b-n-camera`, `stage-3b-remaster`, `br-role`, the superseded `stage-3b-n` and `stage-3b-pillar-los`. Stage 3C not begun. |
| start | `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000/> |
| lighting | MEDIUM unless a step says otherwise (SETTINGS ▸ CUSTOMIZE ▸ LIGHTING) |

This pass fixes only the two things you reported. Everything else is the QA1 build you accepted: the fluorescent look and brightness, the 170 fixtures, true black, no body glow, and the camera.

1. **Wall corners now read as one piece of architecture.**
   - A wall's or pillar's lit face shows its full band at any viewing angle, and the bands meet at a corner on the same diagonal joint the wall art draws.
   - Before, a face seen at a slant thinned to a wedge. The side face's end showed a block of the other face's light, and inner corners had a dark notch.
   - Nothing around a corner is shown any more. Before, a sliver of the floor or wall face round a corner could show.
2. **The camcorder's infrared is now a BR-RoLE light.**
   - With night vision on, the illuminator lights the floor, walls, pillars and props it reaches. Walls and pillars cast real infrared shadows from the lens, and faces turned to the lens light up.
   - It fades smoothly with distance and toward the edge of its cone.
   - Before, it was a stack of fans: a stepped cone with a rim, and walls never lit.
   - It is still only a sensor picture. Nothing is lit without your night vision on, and monsters never see it.

About 15 minutes. Scenes A–C use the BLACKOUT ZONE (flashlight) and lit rooms. Scenes D–G use the camcorder (equip it in CUSTOMIZE ▸ light: camcorder; F raises it, N toggles night vision, B cycles the infrared OFF / LOW / HIGH).

## A. Corner — flashlight sweep (BLACKOUT ZONE)

Stand near a wall corner with the flashlight on and sweep the beam slowly across both visible faces of the corner. Try both an outside corner and an inside (room) corner.
- Each lit face shows a steady strip (its 24 px band), right up to the corner, at any angle, including when you look along the wall.
- The two strips meet on a clean diagonal joint.
- No wedge, notch or block should dominate. A face turned more squarely to the beam is brighter than the other, as it should be.
- Inside corners are lit right into the corner. The two strips form a clean L on the corner's diagonal; neither pokes past the other.

## B. Corner — fluorescent-lit receiver (YELLOW HALL partitions, the room corners, PILLAR HALL)

With your light off, look at fluorescent-lit outside and inside corners and pillar corners.
- The connected faces should read as one continuous corner, joined on the diagonal like the art.
- There should be no dark notch in inside corners and no odd block at the end of a lit face.

## C. Corner — convex blocker, no leak

Walk slowly round an outside wall corner and round a pillar in a lit room.
- Nothing round the corner should appear before your line of sight reaches it: no sliver of floor, no strip of the face around the corner.
- The face you are looking at still shows its band.

## D. Night vision — wall receiver (BLACKOUT ZONE, camcorder, NV on, IR LOW)

Point the camcorder at a wall 2–3 cells away.
- The floor and the wall's face light up in the infrared.
- Sweep it away: the wall goes dark again.
- The far side of the wall stays dark.

## E. Night vision — pillar / corner (PILLAR HALL in a blackout, or any corner)

Aim the infrared past a pillar or a wall corner.
- The pillar casts a real infrared shadow from the lens.
- The face turned to you lights up; its far side does not.

## F. Night vision — true occlusion

Stand close to a wall with the infrared on HIGH, aimed at the wall. Nothing behind the wall is lit or shown.

## G. Night vision — range / falloff

In an open stretch, compare LOW (about 3.5 cells) and HIGH (about 6 cells).
- The light should fade smoothly with distance into a soft tail, with no ring at its end.
- It should ease from the bright core into the dimmer outer field, with no stepped cone.
- The lens's small spill stays at the camcorder (as before), not a glow around your body.
- `__brRole.dev.ir(false)` in the console shows the old fans for comparison; `__brRole.dev.ir(true)` switches back.

## H. NV off — visible world parity

Lower night vision (N) with the camcorder raised, and switch to a flashlight.
- Normal rooms, corridors and darkness should look as they did in QA1. Only the corners (A–C) differ.
- With night vision off, nothing of the infrared is drawn or computed.

## I. Performance after warm-up (MEDIUM)

Play a minute with night vision off, then a minute with it on.
- It should feel like QA1.
- With night vision on, the infrared is now a real light, so it costs about what a flashlight costs: less with the illuminator on LOW, a little more on HIGH. The camcorder has no visible beam of its own. (Measured with software rendering only; no real-GPU numbers exist for this pass, so your own feel on real hardware is the check here.)
- Optional: the LOW and HIGH lighting tiers should show the same corners and the same infrared, at lower or higher detail.

## Changed rule (reported)

The camcorder's *reading* of the infrared (how readable a concealing creature is under night vision, `irFrom`) keeps v23's profile, with its two hard places eased.
- It is identical to v23 everywhere except those two places:
  - the step at the edge of the bright core is eased over ±0.075 rad (±4.3°);
  - the last 30 % of the range ends in a smooth tail instead of a straight ramp.
- Range, power, core, cone, spill and wall occlusion are unchanged.
- No AI, stealth or perception rule was touched. The server never has the infrared.

## Known, unchanged (recorded, not part of this pass)

- With a Hound near you, the screen can flash brighter for a moment (the old dread flicker in `mp.js`).
- `light.js` and the server treat the old dim tubes (every 13th fixture) as full-strength lamps, as before.
- The hand glow of a carried light (its 52 px glow at the hand) is not carried onto wall faces (QA1 design, unchanged).
