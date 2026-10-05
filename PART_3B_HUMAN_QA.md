# Part 3B human QA handoff — corrected top-down presentation

**HUMAN QA PENDING.** RoYo remains the final gameplay and design authority. This build replaces the presentation rejected at `6ec76c6`, which read as tilted or isometric with wedge-shaped walls. The camera is now strictly top-down. Depth comes only from local wall faces, subtle relative actor scale, overlap, cutaway and motion. Engineering evidence cannot decide whether it feels right; that decision is yours.

The final verified source commit, tree and ZIP checksum are in the accompanying publication receipt (`PART_3B_PUBLICATION_RECEIPT.json`). The correction lineage is in `PART_3B_HUMAN_QA_CORRECTION.md`.

## Start

Extract the complete archive and enter `thefarbackrooms-level0`. Use Node 22+ for the development tests (the game itself declares Node >=18). No runtime npm install is required.

Linux/macOS:

```bash
TFB_WORLD=levels/level0_spatial.json node server.js 8000
```

Windows PowerShell:

```powershell
$env:TFB_WORLD = 'levels/level0_spatial.json'
node server.js 8000
```

Open `http://localhost:8000/?room=part3b-qa`. For multiplayer checks, open the same room in a second, separate browser context (another browser or a private window). Keep debug labels off when judging readability. The admin panel and in-game control hints are unchanged; no movement controls were added. Clear `TFB_WORLD` to run the retained flat control. Spatial mode remains an explicit opt-in pending your approval.

## What changed since the rejected build

- **Camera.** Pitch and tilt are 0. There is no oblique offset and no zooming or scaling of the world tied to your height. Every room and wall outline is drawn at its exact top-down footprint.
- **Wall depth.** Every wall face that faces you, in all four directions, is drawn as a narrow strip inside the wall's own outline, so floors are never covered.
  - The strip is about 18 world units wide when you stand on the ground floor, about 10 seen from the upper floor (Z180) and about 26 seen from inside the depression (Z−96).
  - The width changes smoothly with your height, and that change is the stair and fall cue.
  - Corners meet on a diagonal. Faces turned away from you show the wall top instead.
- **Your own player is always exactly scale 1.0.** Other players, creatures, corpses and dropped gear below you are up to 6% smaller, and above you up to 6% larger. Each client computes this separately, so everyone sees themselves at 1.0. Lamps, labels and wall or floor art are never scaled.
- **Shared truth is unchanged.** Line of sight, light, sound, collision, picking, crawlspace and LONG ROOM cutaways, and server physics, AI, network and death are all unchanged.

## Required judgements

Answer each with **PASS / FAIL / NEEDS FOLLOW-UP**:

1. **Does the world now remain unmistakably top-down?** Walk several ordinary rooms and corridors (YELLOW HALL spawn near (984,3264), REPEATING ROOMS, SEGMENTED ROOMS, ARCH GALLERY).
2. **Do ordinary rooms remain rectangular rather than trapezoidal or isometric?** Check room corners and long walls at the edges of the screen; they should not slant or change shape as you move.
3. **Do left/right walls still read with useful depth?**
4. **Do top/bottom walls now receive comparable readable depth?** Compare north- and south-facing wall strips with east- and west-facing ones. PILLAR HALL near (8100,1150) shows all four directions at once.
5. **Do stairs and ramps communicate elevation without tilting the world?**
   - LONG ROOM stairs: base near (5616,1512), treads y1488→1008, upper floor Z180. Ascend, descend, reverse halfway, and leave sideways.
   - LONG ROOM ramp: near (6432,1512). Walk both directions.
6. **Do falls communicate descent clearly?** BLACKOUT rim near (936,5568): walk west into the Z−96 depression, then return by the south ramp. Also judge any legal drop from the upper route. The automated 180→0 replay starts airborne over the stairwell and does not certify a new walk-off ledge.
7. **Does the wall-depth effect stay subtle rather than looking like fake perspective?** Is the strip width right, too strong or too weak?
8. **Do the crawlspace and LONG ROOM cutaways still feel correct?**
   - NORTH crawl (x1632–1920, y816–912): one client crawls in, the other waits outside near (1536,864). Outside keeps the roof and must not see the hidden player, gear or beam. Light that physically spills out of the open crawl mouth is real light, not a leak.
   - LONG ROOM: two clients at (6192,864), one at Z0 and one at Z180. Only the local slab cuts away.
   - Ordinary rooms should never black out on entry.
9. **Does multiplayer depth stay readable without making other actors look toy-sized?** Use the same LONG ROOM pair and the stairs. The upper client should see the lower one slightly smaller, the lower client should see the upper one slightly larger, and each sees itself at normal size.
10. **Are aiming and camera comfort acceptable?** Aim at visible peers and entities on the floor, stairs, ramp and upper floor, and try targets behind an intact slab (they must stay unpickable). Also aim during falls and landings, and after reconnect, respawn, admin moves between elevations and world reset. Is the camera steady, too floaty or uncomfortable? Compare 16:9, 16:10, ultrawide, DPR2/4K, full/reduced quality, NV and zoom 1/2/4. Settings must not reveal more of the actionable world or hidden players.

## Record

For each item, record the room or coordinates, posture and equipment, browser and GPU, viewport, DPR, quality, and a short reproduction or capture. Above all, answer: **does this read as top-down with real depth, without looking tilted?**

## Known limits and separate issues

- Software-GPU test timings are not hardware FPS certification.
- Accepted navigation and aftermath performance limits, and the historical aggregate failures (151/162, shared F22, P08 UNKNOWN), remain documented.
- On the validation host (Node v22), the frozen flat AI traces differ from their Node v24 recordings by 1 ULP in three traces. They are byte-identical between this build and HQ0 (see `PART_3B_BASELINE_FAILURES.md`).
- Automatic light pitch from traversal, final lighting and shadows, materials, entity and death art, and atmosphere belong to later passes.
- External font failures do not stand in for local-resource failures.
- **Separate blockers, not addressed here:**
  - the spatial-mode Hound pursuit regression: hesitating, standing still or creeping instead of committing, while flat mode is normal;
  - the reported wall-sticking collision regression.

  Both need their own audits. Part 3C stays frozen until the Hound blocker is resolved.

Part 3C has not begun. Main has not been modified or merged. This handoff does not authorize the next stage.
