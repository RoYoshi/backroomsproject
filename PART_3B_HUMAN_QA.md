# Part 3B human QA handoff

**HUMAN QA PENDING.** RoYo remains the final gameplay/design authority. Judge whether height and descent now read clearly and whether the camera is comfortable. Engineering evidence cannot decide the feel.

Final verified source commit/tree and ZIP checksum are recorded in the accompanying publication receipt.

## Start

Extract the complete archive, enter `thefarbackrooms-level0`, and use Node 22+ for the development tests (the game declares Node >=18). No runtime npm install is required.

Linux/macOS:

```bash
TFB_WORLD=levels/level0_spatial.json node server.js 8000
```

Windows PowerShell:

```powershell
$env:TFB_WORLD = 'levels/level0_spatial.json'
node server.js 8000
```

Open `http://localhost:8000/?room=part3b-qa`. Use the same room in two separate browser contexts for multiplayer checks. Keep debug labels off when judging readability. Use the existing in-game control hints and admin panel; no new movement controls were added. Clear `TFB_WORLD` to run the retained flat control. Spatial mode remains an explicit choice pending human approval.

## Required tour

| Test | Location / action | Human decision |
|---|---|---|
| Stairs | LONG ROOM, base near (5616,1512), treads y1488→1008, upper Z180. Ascend, descend, reverse halfway, then leave sideways. | Camera should avoid individual tread jolts; body/hands should stay connected to the correct support without clipping the underside. |
| Ramp | LONG ROOM near (6432,1512), slope y1488→1008. Walk both directions and reverse. | Continuous depth change, no new stepping or detached body. |
| Lower fall | BLACKOUT rim near (936,5568), walk west into the Z−96 depression; return by the south ramp. | Without debug, destination floor should approach and descent should be perceptible. Landing should settle gently without disrupting aim. |
| Upper fall | Inspect the +180→0 clearance-valid physical replay in `dev/part3b/evidence/p3b4/whole-01/presentation-motion.json`, including `production-clearance-valid-airborne-180-to-0`. In gameplay, test a legal departure from the upper/stair route without changing physics or barriers. | Judge the 180-unit depth cue separately from route accessibility. The automated full-height replay starts airborne over the bottom stairwell; it does not certify a new walk-off ledge. Report if the available gameplay route is insufficient for judging this case. |
| Same-XY depth | Two clients at (6192,864), one Z0, one Z180. | Lower world should read as lower, with subtle scale/parallax; no toy-like miniature effect or excessive perspective. |
| Continuous interior | Walk hallways and look into adjacent ordinary rooms, including NORTH. | Rooms should already be camera-visible before entry. Normal physical darkness and occlusion still apply. No room-entry roof blackout. |
| NORTH local cover | Passage x1632–1920, y816–912. One client enters using normal posture controls; one stays outside near (1536,864). | Outside retains the roof and cannot see the covered peer/gear/beam. Inside reveals only needed local cover. Ordinary surrounding rooms remain continuous. |
| LONG overlap | Same-XY pair above; move lower client near the slab boundary. | Only the blocking slab/edge group cuts away. Upper client retains its independent view. Hidden body, hands, equipment and effects never leak. |
| Picking | Aim at visible peers/entities on base, stairs, ramp and upper floor. Try a target behind an intact slab. | Cursor tracks the projected target; hidden targets remain unpickable. No through-slab interaction. |
| Aftermath | Observe an upper/lower death and detached gear from the same and opposite floors. | All parts stay on their real supports; no attachment to the observer's camera elevation or leak through a slab. |
| Reset paths | Reconnect, respawn/revive, authorize an admin move between elevations, and reset the world. | Camera snaps safely to the new reference without a long sweep through unrelated floors. |
| Settings | Compare 16:9, 16:10, ultrawide, DPR2/4K, full/reduced, NV and zoom 1/2/4. | Settings must not reveal more actionable world or hidden players. Assess camera comfort on your GPU. |

## Record

For each row give **PASS / FAIL / NEEDS FOLLOW-UP**, plus room/coordinates, posture/equipment, browser/GPU, viewport, DPR, quality, and a short reproduction or capture. Explicitly answer: **Does this actually feel like depth?** Is the camera too floaty, too subtle, or uncomfortable? Can you aim during falls and landings?

Known limits: software-GPU test timings are not hardware FPS certification. Accepted navigation/aftermath performance limits and historical aggregate failures remain documented. Final lighting/shadow, material, entity/death art and atmosphere work belongs to later stages. External font failures do not stand in for local-resource failures.

Part 3C has not begun. Main has not been modified or merged. This handoff does not authorize the next stage.
