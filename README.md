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

## Other wanderers v8

- **Same avatars:** other players are drawn with the game's own avatar renderer, so hat, skin texture, hand colour, main colour, backpack and light gear (flashlight / chestlamp / torch) match what they chose in CUSTOMIZE. Appearance is validated by the server and updates live.
- **Same lighting:** each wanderer's light is cut into the darkness with the same wall-aware routine as yours (beam shape, range, omni torch flicker, colour tint), plus the small personal aura. Turning a light off with F darkens it for everyone. Downed players lie on the floor and give off no light.
- **Names on hover:** point at a wanderer you can see to show their name (and DOWN if caught). Names are no longer printed above everyone.

## Admin menu + fluorescent hum v9
- **Admin menu**: press `` ` `` (backtick) in-game, enter the passcode (default `smoor`). Online only; the server checks the passcode, so a modified client can't fake it. Set your own with the `ADMIN_PASSCODE` environment variable (Render → Environment). 5 wrong tries lock that IP out for 60 s.
- Admin powers: freeze/unfreeze monsters, monster speed, force blackout on/off/auto, god mode, revive, bring/go-to a player, kick, broadcast a message, complete or reset evidence, start a fresh run. Admin actions are logged in the server console.
- **Lights**: the hum is now a modelled fluorescent-ballast sound (60 Hz + harmonics with slow beating, choppy hiss, faint high whine), louder and panned toward nearby lamps, synced to flicker, with crackle bursts and a blackout thunk / power-up stutter.
- Server sends gzip'd files with `no-store` caching so redeploys show up immediately.

## Combat sound + settings v10
- **Death sound**: rebuilt as a synthesized attack. Each hit has an air swipe, then either claw rakes (Hound) or sharp stabs with a bone crunch (Smiler), a wet squelch, a body thud and the victim's gasp/grunt; the last hit ends with a long tearing gash, a gurgling breath, blood drips and ringing ears.
- **Settings** button (top-right) drops down: **Controls** (key reference), **Customize** (character editor shortcut + **HUD** colour, size, opacity, show/hide key hints, coordinates and level title, with live preview), **Audio** (master volume). HUD choices are saved on the device.
- Fixed the stamina bar showing the "low" colour at 100%.

## Realistic remains, smoother HUD, custom sounds v11
- **Death animation kept**, but the look is now grounded: organic blood pools with gradient depth, wet highlights and dark clotted cores, elongated cast-off spatter, striated drag smears, and a fast arterial spray on impact (`gore.js`). Corpses (and dead players seen by others) carry real-looking wounds: claw rakes with torn pale skin lips, wet red rims and dark depth for Hound kills, puncture wounds with bruising for Smiler kills, blood-soaked clothing and grey-blue livor. Each body's wounds are unique but stable.
- **HUD**: unified bar with soft scrims instead of floating text, dividers, diamond evidence pips that light up (with a pop) when you find one, smoothly animated stamina bar that turns amber then red, crossfades when values change, eased entrance, key hints that fade out after ~14 s (toggle in Settings), and a level title that quiets itself. Settings panel eases in/out.
- **Your own sounds**: drop files into `sounds/` (see `sounds/README.txt`): `death_hound`, `death_smiler`, `death`, `collect`, `step`, `hum`, `ambient`, `blackout`, `sting` (mp3/ogg/wav/m4a/flac). Missing ones keep the built-in synth. Numbered variants play at random.

## Entity overhaul, glitched walls, shared bodies v12
- **Hounds**: up to 3, spawned at random. They patrol alone, and hounds that find each other can join into a pack (one leads, the others flank) before drifting apart again. Server-side (`sim.js`), so every player sees the same hounds.
- **Smilers**: up to 5, scattered at random around the map at the start of each world.
- **Lights on top**: ceiling fixtures are drawn above players and monsters, slightly see-through (84%), with a small parallax shift so the view feels top-down.
- **Objective**: the evidence is gone. Each world has 3 glitched walls; walk into one to leave Level 0. The exit screen is a "Level 1 — coming soon" placeholder with a **Restart Level 0** button.
- **Bodies**: a finished corpse is broadcast to everyone in the room. Each player has at most one body: dying again replaces the old one.
- **Admin panel**: +/- HOUND and SMILER buttons (respecting the 3 / 5 caps) and glitch-wall buttons (new set / teleport to one).
- New file `glitch.js` (glitched wall renderer + static audio). Upload it along with everything else.

## Inventory, cartograph, hand-held lights v13
- **TAB = inventory** (a side drawer; the game keeps running). It shows your equipped light with a live close-up, quick switch between Flashlight / Chestlamp / Torch, the light toggle, and what you carry. `inventory.js` is new.
- **No default map.** The map is now the **Cartograph**, a rare paranormal device: one lies somewhere in every world (visible as a faint flicker when you have line of sight). Walk over it to pick it up, then press **M**. Its sketch is crude on purpose: jittery lines, missing chunks, a drifting position dot, and it gets less reliable the farther from you it looks. Items are wiped on NEW RUN. Admin panel: GO TO IT / MOVE IT / GIVE ME ONE.
- **Light source redesign + parts**: new art for all three lights. Customize → *Light parts* lets you recolour every element (Flashlight: body, head, button, grip; Torch: handle, wrap, cord; Chestlamp: strap, housing, bracket) plus the beam colour, with a zoomed live preview. Other players, dropped gear and corpses use your colours.
- **Lights move with the hand**: the flashlight and torch beam now start at the hand, lag slightly behind your aim, and shuffle/sway with your stride (more when sprinting). Other players' beams do the same. The beam origin is clamped so it never pokes through a wall.

## Selectable light sources + Night Vision Camcorder v14

Pick **one** device in CUSTOMIZE (cards with preview + description). It is locked for the run; you can choose again after being caught ("CHANGE LOADOUT"). It syncs to other players.

| Device | What it does |
|---|---|
| Flashlight | Longest reach, narrow soft-edged cone that follows the mouse. |
| Headlamp | Wider, shorter, slightly dimmer cone worn on the head (shows on hats/beanies/bare head). |
| Lantern | Warm camping lantern carried at your side: near-circular light, short-medium reach. |
| Night Vision Camcorder | Emits **no light**. `F` raises/lowers it, `N` toggles night vision, mouse wheel (or `Z`) zooms 1x/2x/4x. |

Night vision is not x-ray: it only brightens what is already inside your current line of sight (walls, corners and doors still block it), zoom only narrows the picture. NV is local to you; other players just see you holding the camera and it lights nothing for them.

**Overheating (no batteries):** NV heats up while on and cools while off. Grain gets worse at 50 / 75 / 90 % heat; at 100 % the sensor shuts down ("NV SENSOR OVERHEATED"), the camcorder stays raised, and NV returns after the lockout + cooldown. Defaults: ~35 s continuous, 9 s lockout, ~20 s full cool. All numbers are in `CFG` at the top of `camcorder.js` (`NV_MAX_HEAT`, `NV_HEAT_RATE`, `NV_COOL_RATE`, `NV_REENABLE_THRESHOLD`, `NV_OVERHEAT_LOCKOUT`, zoom levels, grain/shake).

**Entity NV effects:** `window.__cam.registerFx(kind, {onlyNV, gain, obscure, distort, interfere, static, glitch})`. Nothing is registered by default, so hounds/smilers look as before under NV; add behaviours per entity in one line.

New file: `camcorder.js` (add to your repo). Legacy saves migrate: chestlamp → headlamp, torch → lantern.
