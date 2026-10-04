# Part 3A human QA handoff

**HUMAN QA PENDING.** You remain the final gameplay/design authority. This stage converts production Level 0; final smoothing, shadows, textures, entity art and atmosphere belong to later Part 3 stages.

Final source identity and package checksum are supplied by the accompanying verified publication receipt.

## Start the spatial production build

Extract the complete archive and enter `thefarbackrooms-level0`. The tested environment is Node v24.19.0 and Chromium 151.0.7922.34. Runtime declares Node >=18; built-in WebSocket development tests require Node 22+.

Linux/macOS:

```bash
TFB_WORLD=levels/level0_spatial.json node server.js 8000
```

Windows PowerShell:

```powershell
$env:TFB_WORLD = 'levels/level0_spatial.json'
node server.js 8000
```

Open `http://localhost:8000/?room=part3a-qa`. Use that same room in a second browser context for multiplayer checks. Stop the server with Ctrl+C. For the retained flat control, clear `TFB_WORLD` and run `node server.js 8000`; spatial mode is not the default before human approval. No production npm install is required. Do not launch the HTML through `file://`. Automated browser gates separately require Playwright and a Chromium browser; the retained helper can use `TFB_BROWSER_EXECUTABLE` for an installed binary. Recorded host paths in raw test logs describe the execution environment, not required game paths.

## Tour and observations

| Area | Location / support | Check |
|---|---|---|
| Familiar base world | All twelve rooms, Z0 | Recognizable spawn, room/corridor identities, props, lamps and objective. Ordinary room circulation remains usable. |
| LONG ROOM stairs | x5568–5664, y1008–1488; base approach near (5616,1512) | Walk up and down, reverse midway and step sideways. Treads/risers and direction should read without debug text. Mechanical stepping may remain for 3B. |
| LONG ROOM ramp | x6336–6528, y1008–1488; base approach near (6432,1512) | Follow continuous slope up/down. Judge slope direction and attachment of body/hands. |
| Upper branch | x5568–6720, y720–1008, Z180; `support:upper:long-room` | Meaningful route above retained Z0 space; inspect thickness, undersides and cutaway at both approaches. |
| Same XY overlap | (6192,864) at Z0 and Z180 | Put two clients on different levels. Hidden peer/gear/effects must not leak through the slab; each camera cutaway stays independent. |
| BLACKOUT depression | x576–864, y5472–5664, Z−96; `support:lower:blackout` | Enter, fall from the intended rim, and leave by the south return ramp y5664–5952. No accidental trap. |
| NORTH crawl passage | x1632–1920, y816–912, Z0 | Crawl through the 28-unit space using normal posture controls; standing must fail under the roof. |

Use the existing control hints and posture controls in the game. Tour with debug labels off for the readability decision. Hounds must use only legal routes; Smilers must not gain crawl, flight or teleport capabilities. Test visible lights and NV/IR on both levels, especially around the stairwell opening and intact slab.

Across several fresh worlds, confirm the single cartograph changes location and the three glitched-wall exits vary while remaining reachable. Collect the cartograph through ordinary proximity and complete the normal escape loop. The basic objective does not require taking a vertical route.

In multiplayer, reconnect while the other client remains, observe an intended fall, and check deaths on base/upper/lower/stair/ramp/ledge locations. Body, two hands and loose equipment must follow the authoritative physical aftermath. Late join should see the same active or settled object, without duplicate corpses. A tethered hand may remain awake above a sloping/tread surface; fabricated ground support is not substituted.

## Known limits to record

- The preserved one/eight-player CPU samples include worst cold ticks of about 845/780 ms, and later spikes of about 146/135 ms. Do not overlook navigation stalls.
- The test host uses SwiftShader. Forced full/reduced render-and-readback captures are very slow and are not hardware FPS certification. Record your GPU, browser, viewport, DPR, quality and actual stalls.
- Dark areas, abrupt stair motion and basic geometry/material presentation remain visible. Decide whether directions, support and upper/lower separation are understandable; later stages own polish.
- Historical retained aggregate failures, shared F22, P08 UNKNOWN and accepted 24-active-aftermath limits are documented in the test/failure reports. The new seven named spatial suites must pass separately.
- An external Google Fonts request can fail in the test environment. Local runtime resources must load successfully.

Report **PASS / FAIL / NEEDS FOLLOW-UP**, with room/coordinates, posture/equipment, browser/GPU and screenshots or reproduction steps. No Part 3B or later work is authorized by this handoff.
