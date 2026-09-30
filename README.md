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

## Global deaths, falling spawns, New Run menu v15

- **Deaths play out for everyone.** When a wanderer is caught, everyone in line of sight sees the same attack, blood and collapse (not just a finished corpse).
- **Random, falling spawns.** Every spawn/respawn picks a random open spot away from monsters and you drop in from above (shadow, thud, dust, camera shake). Other players see you fall too.
- **NEW RUN** (pause menu) makes your body fade out of existence for everyone, leaving only your light source on the floor (it replaces your previous body). Then a menu offers **SPAWN**, **CUSTOMIZE** or **END** (back to the title screen; you leave the world).
- The inventory no longer has a Customize button; use Settings / the header.
- Server: new `fx` and `leave` messages (`server.js`, `sim.js`), `mp.js` replays them.

## Movement, living entities and a real death system v16

**Upload:** the new `world.js`, `move.js`, `ai.js`, `ents.js`, and the updated `sim.js`, `server.js`, `mp.js`, `index.html`, `gore.js`, `assets/index-DKbV5Nv9.js`, `README.md`, `package.json`. (`ai.js`, `sim.js` and `server.js` run only on the server and are never sent to browsers.) The optional `dev/` folder is the test suite; the game does not need it.

### Movement

Keys: **W A S D** move · **Shift** run · **C** crouch (toggle) · **C while running** slide · walk into a low obstacle to vault · crouch (or just walk into a low gap) to crawl.

| State | Speed | Heard from about | Notes |
|---|---|---|---|
| Stand | 0 | nothing | silent, fastest stamina regeneration |
| Walk | 172 px/s | 240 px | costs nothing |
| Run | 285 px/s | 640 px | about 9-10 s (2,600 px) from full stamina |
| Crouch | 92 px/s | 85 px moving, 0 still | lower profile (harder to see), regenerates |
| Crawl | 54 px/s | 95 px | automatic when crouched under something too low |
| Slide | momentum only | 460 px | needs running speed |
| Vault | 0.3 / 0.46 / 0.8 s | 520 / 360 / 170 px | fast / normal / slow, never labelled |

- **Stamina never turns a mechanic off.** Exhausted: the run key just walks (148 px/s) and a fast vault becomes a normal or slow one; tired slides are shorter; you can always walk, crouch, crawl and vault. Feedback is breathing, a heavier animation and footsteps, not a big bar.
- **Slides** carry your speed and depend on the floor: carpet is short (~80 px), concrete medium (~150 px), wet tile long (~300 px). Steering is limited, a slide can pass under a committed lunge, and a short cooldown stops slide-chaining.
- **Vaults** are contextual (windows, counters, low walls, furniture, fallen shelving, machinery; there are few in Level 0). Quality comes from your state: run = fast (costs stamina), walk = normal, crouch = slow (free). Approach angles are generous; a very oblique approach just bumps.
- Other players see all of it: crouch, crawl, slide, vault, exhausted breathing, knocked down and struggling poses are relayed by the server.

### Entity AI (`ai.js`, server only)

Hounds and Smilers are built from the same parts (perception, memory, personality, state machine, traversal, capture) and only differ in their data.

- **Perception, not omniscience.** Vision needs a line of sight (walls block it) and light or a short range in the dark, and your posture scales how visible you are. Hearing works from a sound bus: every step, slide, vault, landing and tired breath is an event with a radius that walls muffle. A player standing still and silent is very hard to find unless something walks right up to you.
- **Memory and searching.** An entity keeps a last known position, direction and age; confidence fades with its MEMORY trait. It searches from where it last had you, fans out, gives up and goes back to roaming. It never homes in on a quiet, crouching player.
- **Personality.** 14 traits per species (intelligence, sadism, hunger, patience, curiosity, caution, territoriality, aggression, persistence, social, hearing, vision, light sensitivity, memory) with per-individual variation, so two hounds in the same room behave differently. Group awareness only uses what an entity has actually seen or heard.
- **States:** DORMANT, ROAMING, CURIOUS, ALERT, WATCHING, STALKING, HUNTING, SEARCHING, CAUTIOUS, FRUSTRATED, EXCITED, FEEDING, PLAYING, RETREATING; Smilers add HIDDEN, FOLLOWING, PROVOKED, ATTACKING, DISAPPEARING. Nothing is scripted; stories come from these systems meeting the level and each other.
- **Traversal limits per species** (vault, crouch, crawl, slide, doors, tight gaps, turning, acceleration). Hounds vault fast and can crawl; Smilers vault slowly, cannot crouch or crawl, but open doors.
- **Level of detail.** Within 1,900 px of a player an entity senses about 9 times a second, out to 3,800 px about 3 times a second, and beyond that it sleeps and drifts. The shipped population costs about 0.05 ms per 60 Hz step; snapshots are about 1 KB every 50 ms.

**Hound** (distorted, on all fours; strong hearing): stalks and shadows prey, fast in a straight line, poor at sharp turns, commits to lunges and needs a moment to recover after a miss. There are no invincibility frames: a late sidestep beats a lunge, standing still does not. Hounds near each other form packs and answer each other's growls. After a kill it is worked up, feeds, guards the body and goes for anyone who comes near it.

**Smiler** ("darkness with a face"): moves outside strong light, never teleports, fades away if lit (a flashlight only lights it within about 215 px), watches, follows, and only goes for someone who is alone. Groups get followed, not engaged. Running provokes it, and a blackout makes it bolder.

### Caught is not dead

When something catches you it first weighs up the situation (others close by or approaching, how secure the spot is, its own temperament):

- **Quick kill** when others are near or coming, or it is hungry/aggressive.
- **Play** when you are isolated and it is sadistic enough: you are knocked down, held, dragged or allowed to crawl, and the next big decision usually comes 5-15 s later. It may release you (false hope; run and it hunts you again, stay and it may let you go) or kill you.
- **Interruption:** a light, a loud noise or someone running up can change its mind, depending on who it is.

**Hound kills:** A lunge at the throat · B dragged down from the side or behind · C slammed into a wall (only when a real wall is right there) · D exhausted prey taken from behind.
**Smiler kills:** A rush out of the darkness · B cornered in a dead end (slow approach, then sudden) · C light failure (rare, only for a lone player standing in light: the lamps flicker, the grin is closer each time) · D played with.
Recent kills are remembered so the same death is not chosen over and over.

**Bodies** stay in the halls until that player dies again or the world resets (one per player). To make them expire, set the `BODY_TTL` environment variable (seconds; default 0 = never). What a fallen player carried stays: a flashlight keeps its beam, a lantern keeps lighting the floor, a camcorder lies dark.

### Admin (passcode `smoor`, or `ADMIN_PASSCODE`)

New in the admin panel's **AI TOOLS** row: **AI DEBUG** (an overlay for admins only: state, target, last known position and its age, vision range, last heard sound, search goal, path, mood, capture decision, tier), **+ HOUND NEAR** and **+ SMILER NEAR** (still capped at 3 / 5). The MONSTERS row also has **SUMMON HOUND TO ME**. Debug data is sent only to unlocked admins who switched it on.

### Notes

- Offline/solo mode (no server) keeps the built-in single-player monster AI, with the new visuals and movement. Only the server runs the new AI.
- Player movement is still computed in each player's browser (as before); entities, kills and catches are decided only on the server.
- Entity and capture sounds are procedural. They were rendered offline and measured (audible, no clipping or clicks, fade out, stereo position) but not judged by ear.
- `dev/` (optional): the scenario suite. `node dev/tests/run.js s_percept.js s_hound.js s_smiler.js s_capture.js s_system.js` (54 scenarios on the real simulation), `node dev/tests/live.js` (real server + two clients), `python3 dev/tests/move_test.py`, `python3 dev/tests/audio_test.py` (the last two need `pip install playwright`). See `dev/README.md`.

### Test results (v16)

Everything ran headless in the build sandbox: the real `sim.js` + `ai.js`, the real `server.js`, and software-rendered Chromium. Each figure is from the last complete run of that suite.

| Suite | What it covers | Result |
|---|---|---|
| `dev/tests/run.js` (54 scenarios) | perception, hearing, memory, personality, hound and smiler behaviour, capture / release / interruption, level of detail, performance, snapshot size, stuck recovery, wall clipping, pop-in, determinism, population caps, body persistence | **54 / 54 pass** |
| `dev/tests/live.js` | real server + two WebSocket clients: file whitelist, snapshots and sync, admin lock-out, no faked deaths or bodies, debug-feed isolation, bandwidth | **17 / 17 checks pass** |
| `dev/tests/move_test.py` | speeds, states, stamina, slides by surface, three vault qualities, crawl, what the server hears | **14 / 14 pass** |
| `dev/tests/audio_test.py` | every entity and capture sound rendered offline and measured: audible, no clipping or clicks, fades out, stereo position | **17 / 17 cues pass** |
| Browser smoke checks | admin AI DEBUG overlay (admins only), other players' movement poses, server-driven capture visuals (held / down / crawl / release), corpse and left-behind light, light-failure flicker, solo (no server) mode | pass |

Two real bugs turned up in the last round and are fixed in this build: every entity and capture sound was silent (a master gain of 0), and smiler group memory expired too fast (groups were engaged instead of followed).

### Not verified / known limits

- **Sound was measured, not heard.** No person has listened to the entity and capture audio yet; expect to adjust levels and tone by ear.
- **Headless only.** All browser checks used software rendering on localhost. Not tried: a real GPU, phones or tablets, real network latency or packet loss, Render's free-tier CPU (the ~0.05 ms per step figure is from the sandbox).
- **No human playtest.** The release / false-hope and "played with" sequences are verified in the simulation (C03, S10, H12) and their visuals were driven through the server in a browser, but nobody has played a long session. Timers, ranges and kill weights are tuned by measurement and will want tuning by feel.
- **Movement is client-side** (as before), so a modified client can cheat its own movement. Entities, catches and kills are decided only on the server.
- **Solo / offline mode** keeps the older built-in monster AI (new visuals and movement, old behaviour).
- **Packaging check.** The command-approval service was intermittently unavailable while this package was being assembled. Every shipped file was copied byte-for-byte from the tested working tree and verified against it; the packaged folder itself was re-checked with one final run of the 54 scenarios only. `live.js`, `move_test.py` and `audio_test.py` were last run against the working tree, not the packaged folder.

## Admin panel v2, death previews, debug mode, pause fix v17

- **Pause fix.** Death animations no longer depend on the game being un-paused. When the server kills you while the pause screen is up, the pause screen closes and the death starts at once (`mp.js`, plus `unpause` in the bundle's `__api`).
- **Admin panel** (backtick, passcode `smoor` / `ADMIN_PASSCODE`) now has tabs: PLAYERS (live state and position, teleport, give, revive), MONSTERS (entity list with GO TO / REMOVE, spawn near, remove), DEATHS, WORLD, DEBUG. Live text is patched in place so buttons are never rebuilt under the mouse. A status line shows the server's answer to every command (`ares` message). The panel can be docked left or right.
- **DEATHS tab.** *Preview death*: play Hound A–D or Smiler A–D on yourself through the real kill path (record, events, replay for other players). Hound C needs a wall behind you and says so if there is none. After the death you are revived and put back where it happened; a monster made just for the preview is removed at revive. *Capture style*: AUTO / ALWAYS QUICK / ALWAYS PLAY (replaces the old dev-only play server).
- **Debug mode** (DEBUG tab). AI overlay with layers: AI entities, you + hearing radius, server timings, AI event log. Also ping, FPS, COPY REPORT. Only unlocked admins receive debug data.
- New server messages: `ares`, `ping`/`pong`, `preview`, `capmode`, `entgoto`, `entdel`. Non-admins cannot use them.
- Tests: `dev/tests/s_admin.js` (A01–A05) and `dev/tests/admin_test.py` (two real browsers: tabs, all 8 previews, pause fix, debug overlay). Browser test was run under slow software rendering; a few timing-dependent checks needed generous waits. The full 59-scenario sim regression was not re-run after the final small preview-cleanup change (v16's 54 passed; A01–A05 passed before it).

## Physical deaths v18 (`dphys.js`)

The eight deaths (Hound A-D, Smiler A-D) are no longer scripted poses. Each one is a small physics simulation that the local victim and every spectator's replay run from the same event parameters, so it looks the same everywhere and the network cost is unchanged (the `fx` message only gained the victim's velocity and an exhausted flag).

- **Architecture.** `dphys.js` (new, loaded before the bundle) holds a lightweight fixed-step (240 Hz) simulation. The bundle's death class calls `__dphys.begin / clock / frame / remains`; `ents.js` (`attackFromSim`) poses the Hound from the same simulation; `gore.js` draws blood along the real path; `mp.js` carries the extra fields (hands, trail, hat) to the server and to spectators. If `dphys.js` fails to load, the old scripted death still plays.
- **Procedural motion.** Attacker = point mass on a damped spring with real contact against the victim and the walls. Victim = position, velocity, angle, angular velocity, ground friction, a short squash impulse along the impact axis. A grip rope (spring + damper on a point of the body) makes a dragged body trail behind and turn with the pull. The authored part is only when the grip / drag / release happens and how hard the victim resists (fresh vs exhausted, fading with time). Everything between is integrated.
- **Hands.** Each hand is its own point mass on a spring anchored to the body: it lags on acceleration, overshoots on stopping, is thrown outward by an impact, pushes toward the attacker with uneven timing, plants on the floor during a drag (resisting the pull) and slips, then goes slack and trails. Arm length is limited, hands collide with walls. The avatar's hands are drawn from these positions; no arms are drawn.
- **Collision.** Body, hands, attacker, light and hat collide with the level's wall blocks (circle vs block), so nothing passes through a wall. A wall impact removes the body's velocity, squashes it briefly, rebounds a little, spins it from the tangential friction, and the hands keep going.
- **Equipment.** The light and the hat leave the body with its velocity, slide with friction, spin, hit walls and stop; the beam follows the light's orientation. The light leaves at a physical event of each variant (second blow, wall impact, start of the drag, the pull of the Smiler). The hat is knocked off only by a violent enough hit.
- **Corpse.** The corpse record is the last configuration of the simulation (position, angle, squash, both hand positions, the light's and the hat's final positions, the blood trail). Nothing is hidden and respawned. States: ACTIVE, SETTLING, SLEEPING (a sleeping death costs nothing).
- **Blood.** Smaller pools and fewer, shorter drops; spray only at the moment of a blow at the jaws; the drag smear follows the path the body really took.
- **Camera.** One damped impulse per real impact (contact, wall) instead of continuous shake.
- **Death lab** (admin panel, DEATHS tab): speed 1 / 0.5 / 0.25x, pause, step 1 frame / 6, x-ray attacker, "show paths / forces" overlay (body path, velocity, spin, hand targets vs hands, light path, attacker path, wall hits, phase and settle state), place me (open room / near a wall / in a corner), replay last.
- **Tests.** `dev/tests/phys_test.js` (node): continuity, no wall clipping, determinism, sampling independence and a 240-run matrix. `dev/tests/death_film.py`: renders each death frame by frame in a real browser into contact sheets.
