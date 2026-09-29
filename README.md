# The Far Backrooms — Recovered Production Build

This directory was reconstructed from the HAR capture of the deployed game.

## Run

Do **not** double-click `index.html` with `file://`; the production build uses JavaScript modules,
which browsers block over `file://`. Asset URLs are now relative (`./assets/...`), so the folder can be hosted from any sub-path.

### Windows
Run:
`run_windows.bat`

### Linux
Run:
`./run_linux.sh`

Or manually:
`node server.js 8000` (Node 16+; serves the game, runs the shared monsters and relays players; no npm install needed)

Then open:
`http://localhost:8000`

## Recovered from the HAR

Captured text assets:
- BufferResource-B-thlpip.js
- Cache-DDo62lBW.js
- CanvasPool-DecUtJxW.js
- Filter-DzecrWg_.js
- GCManagedHash-Bz2ZMBJN.js
- GraphicsContext-vm7TDg_M.js
- RenderTargetSystem-CgUxHIsn.js
- browserAll-B-iwy0YI.js
- canvasUtils-CxYPZET9.js
- carpet.png
- getTextureBatchBindGroup-DBCrgHVb.js
- index-D7hdwmUU.css
- index-DKbV5Nv9.js
- init-Cn1_BCi0.js

## Carpet texture

The HAR request for `/assets/carpet.png` did not include the image response bytes.
A temporary procedural yellow/damp carpet texture has been generated at:
`assets/carpet.png`

Replace that file with the original carpet asset later if you recover it.

## Dependency note

Missing JS references detected:
- webworkerAll-ByhiNG9W.js

`webworkerAll-ByhiNG9W.js`, if listed, is the Pixi alternate Web Worker environment bundle.
The captured browser session selected the normal browser environment and did not request it.

## Refined entity rendering pass

This build includes a visual refinement pass focused on making entities read as physical creatures instead of translucent ghosts:

- Strong direct light now drives Hounds and Smilers to full opacity.
- Fluorescent room light reveals entities much more solidly.
- Hound limb contrast and silhouette were strengthened.
- Smiler's core face is now opaque when revealed.
- Smiler eye/mouth bloom is reduced when the actual creature is illuminated, preserving the eerie glow mainly in darkness.
- Entity reveal/fade response is faster and snaps to fully solid under strong illumination.
- Existing line-of-sight occlusion, blackout behavior, AI, death sequences, evidence, customization, and controls are preserved.


## Refinement pass v3

- Level 0 expanded from 64x46 to 96x72 cells (over 2.3x the floor-grid area).
- Added structural variation: blackout zone, red rooms, arch gallery, pillar hall, hole grid, deep carpet, damp rooms.
- Entity encounters spread much farther apart; UI identifies Level 0 entity reports as unconfirmed.
- Hound behavior now uses direct eye contact as temporary intimidation.
- Smiler behavior now prioritizes light attraction, calm eye contact, and panic/sprinting triggers.
- Added stamina, exhaustion, regeneration, and deep-carpet movement penalty.
- Reworked procedural footstep cadence and reset handling.
- Rebuilt Hound and Smiler visual geometry for more physical silhouettes and stronger readability in light.


## Refinement pass v4

- Asset URLs (HTML + carpet texture) changed from root-relative to relative, so the build works from sub-folders and static hosts.
- Local launchers bind to 127.0.0.1 only.

## Refinement pass v5

- **Multiplayer:** `server.js` relays player positions over WebSockets (up to 8 per room). Join the same room with `?room=NAME`. Other wanderers appear with name, light colour and a downed marker; walls block line of sight and the darkness mask hides them when unlit. Static-only hosting falls back to solo mode.
- **Not yet synced:** monsters, evidence and blackouts still run locally per player.
- **Scarier monsters (`mp.js`):** proximity heartbeat, low drone, red vignette pulse, screen shake, light flicker, sporadic static stings and a flash-and-noise death scare.

## Fix pass v6

- **Freeze fixed:** the original footstep audio code (`footstep()` in `assets/index-DKbV5Nv9.js`) shadowed the audio-context variable inside its noise loop, throwing "Cannot access 'a' before initialization" on the first footstep after audio started. That error aborted the frame loop, so the game froze a moment after you began walking.
- **Safety net:** the frame loop now catches errors and always schedules the next frame, so a future audio or effects bug can't freeze the game.
- **UI:** the online/room label moved under the title so it no longer overlaps the controls bar.

## Server-side entities v7

- `sim.js` holds the map, pathfinding and the Hound / Smiler AI, extracted from the game's own bundle and generalised from one player to many. `server.js` runs one simulation per `?room=NAME`.
- **Shared world:** every player in a room sees the same Hound, Smilers and blackouts. Each monster tracks the most relevant living player (spotted first, then loudest, then nearest).
- **Server decides catches.** Only the caught player gets the death sequence; the monsters then lose track and search for a few seconds. RESPAWN puts you back at the start with a short grace period.
- **Shared evidence:** traces are collected as a team. When the eighth is found everyone gets the win screen. NEW RUN resets the world once it is the first player back in.
- Pausing does not stop the world online (the pause screen says so).
- **Solo fallback:** with no server (static hosting, `file://`, dropped connection) the game uses its built-in single-player AI as before.
- Server only serves `index.html`, `mp.js` and `assets/`; `server.js` and `sim.js` are never sent to browsers.
