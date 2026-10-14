# thefarbackrooms.io — Level 1 roaming environment

TypeScript + PixiJS 8. A local single-player test environment: nine connected industrial spaces, collision, acceleration, sprinting, wall-occluded flashlight, ambient hum, map and touch controls. One original stalker entity with patrol, sound investigation, line-of-sight pursuit, last-seen searching, collision-aware navigation and contact capture/restart. No persistence or networking yet.

Run `npm install`, then `npm run dev`. Production: `npm run build`. Type validation: `npm run check`.

Movement and world data are separated under `shared/` so future authoritative simulation can reuse them. `client/` owns presentation, input and audio. The initial Level 1 layout is handcrafted and reproducible. Sprint is unlimited for testing. The map intentionally reveals the entire test layout.

Controls: WASD/arrows, Shift to sprint, mouse to aim, F flashlight, M map, Escape pause. Audio starts only after entering. Losing focus pauses the session.

This build has no multiplayer server; publishing serves the browser client only. Node.js/Colyseus authority remains a later milestone.

The stalker gives a 7-second grace period, then patrols toward Receiving. Sprinting carries farther than walking; sound follows navigable paths. Pursuit is slightly slower than sprinting, with limited turning speed. It loses visual pursuit after 1.2 seconds out of sight, searches for 7 seconds, then returns to patrol. Entity simulation stays under shared/, separate from its animated client presentation.
