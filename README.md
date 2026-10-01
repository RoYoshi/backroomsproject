# Stage 2F — Shared intelligence (v23.3.0-2f)

Stage 2F implementation is complete; Part 2 final QA and subjective human gameplay QA remain pending. Browser QA was blocked in the implementation environment. See `STAGE_2F_REPORT.md` and `STAGE_2F_TEST_SUMMARY.md` for exact limits and retained failing historical gates.

Run `node server.js 8000`, then open http://localhost:8000. The existing Windows/Linux launchers also work. `npm test` runs the full suite, including Stage 2F. It intentionally exits nonzero for the documented historical gates; no thresholds were relaxed. `npm run test:shared` runs the 23 Stage 2F checks. Node 22+ is needed for built-in WebSocket development tests (runtime remains Node 18+).

Changes: observation-only identity attribution, bounded competing evidence, sampled sight, short-lived encounter habits, entity/subsystem RNG isolation, lifecycle cleanup, stable multiplayer ordering, and selected-entity debug explanations. Hound/Smiler tuning, movement, death physics, level and ordinary presentation remain frozen. No 2G, 2.5D or Part 3 work.

The earlier notes below are historical, not current verification claims.

---

# Stage 2E — Hound intelligence polish (v23.2.0-2e)

**STAGE 2E IMPLEMENTATION COMPLETE — HUMAN QA PENDING**

Start with `node server.js`. See [Stage 2E report](STAGE_2E_REPORT.md) for changes, canon mapping, exact verification results and limitations, and [human QA setups](dev/STAGE_2E_HUMAN_QA.md) for cases A–J. The full test suite retains three unmet legacy chase percentage gates; automated correctness checks are not a gameplay approval. Browser visual checks remain pending. No Stage 2F or 2.5D work is included.

The older version notes below are historical results, not claims that those browser tests were rerun for Stage 2E.

---

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

## v19 - the Smiler: exposure, intent and memory (spec 44-59)

Most of the brief was already true of the v16 smiler (no aggression UI, nothing but a face that forms, real fade-outs, dark-only spawns, sparse audio). What changed:

- **Exposure budget** (`ents_src/20_smiler.js`). The grin is always the readable part. The body and arms are drawn as an impression: dim by default, more only at commitment (rush, attack, death), at very close range, or in the first second or two of a glimpse. The longer someone stares at it, the *less* of it there is to study (mist thickens, body fades). The reach posture eases in and out instead of switching (no readable "attack pose"). Death interactions still show it fully.
- **Encounter memory** (`ai_src/60_smiler.js`, `encTick`). A short list per person (lit me / ran / stayed calm / when I lost them / escaped), decayed by the creature's own memory half-life and bounded to eight people - not a profile. Being lit makes it warier of that person, running makes them more interesting, calm makes it bolder, and after losing sight of someone (a stalk that lost sight keeps the memory for many seconds) it can come back and look from the dark.
- **Intent is rolled once per follow** (`hunt` / `loiter`), so a follow may simply never go anywhere. Nobody is called "alone" on a first glance (`soloKnown`: a long look and nobody else has shown up), so groups are followed, not engaged.
- **Micro-behaviours** (`micro`): head turns to a sound, glances at a second person, stops when looked at (and stays stopped a moment after they look back, but staring cannot freeze it forever), one step back when a torch beam edge reaches it, steps to a darker neighbouring spot to stay in the dark, pauses at the light boundary. All systemic, no scripted sequence.
- **Light failure is information** (`lightEvent`): when lamps fail near it (or a blackout starts) it rolls one of *reveal the grin / move closer / shift / vanish / nothing*. The old "three stages then a kill" light-failure attack is unchanged and still rare (cooldown 4-7 minutes).
- **Disengagement**: a committed rush can stand down to watching when the prey is joined by someone or lit; withdrawing from light/beams and losing nerve were already real.
- **Rare individuals**: about 14% of smilers get one quirk (bold, patient, curious, revealer, cautious) that shifts thresholds and timings inside the same rules.
- **Believable positions**: repositioning candidates are penalised directly behind a person or in the open in front of them (no "spawned behind me"); first spawn is scored for dark, out of sight, near the light/dark boundary or half-hidden by walls (`smilerSpot` in `sim_glue.js`). Everything is walked; nothing teleports.
- **Audio**: the face-forming swell is limited to once per 30 s per smiler; nothing loops.
- **Debug only**: quirk, exposure, encounter list, last light reaction and counters appear in the debug overlay and the admin entity dump; never in normal play.
- **Bug fixed**: a freshly spawned smiler never relocated until it had been hidden once (it could sit in one place forever). Now it moves on after 8-30 s. A crouched or edge-of-range player is therefore an advantage, not immunity.
- **Sight floor**: something within about 230 px is noticed whatever its posture.
- **Tests**: `dev/tests/s_smiler2.js` (23 checks: the 13-tactic anti-cheese matrix, memory, micro-behaviours, light events, disengagement, spawn, no-teleport, quirks, no-aggression-UI scan); `dev/tests/smiler_view.py` photographs the exposure budget.

## v20 - Part 1A: entity visibility and the lighting foundation

**What was wrong.** Every hound's opacity was `alpha = Ul(x, y)`, a "how legible is this spot to my eye" value (flashlight, lamps, distance, night vision), smoothed toward 1 above 0.72. The darkness overlay (`drawLight`) already paints the world black and cuts light out where lamps, torches and the player's small aura reach, clipped to line of sight. So a hound in the dark was darkened twice: once by the overlay (correct) and once by becoming see-through (the ghosting). The smiler used the same generic hook for its deliberate concealment. Server AI and hearing were already separate (`ai.js` `geo.lightLevel`, sound bus) and read nothing from the client.

**What changed**
- **`light.js` (new, client-only): the shared lighting query.** `__light.sample(x, y, lightOn)` returns ambient, lamp (wall-occluded, flicker applied, off in a blackout), own torch and other players' lights (occluded), direct, total, dark, dominant light direction and flicker. It reuses one output object, so there is no per-call allocation. `__light.readability()` is the player-eye legibility value, used only by species concealment. `__light.shade()` maps light to material brightness. `__light.occluders()` and `__light.ray()` expose wall-block and ray data for later shadows and flashlight occlusion. Nothing in it sets an alpha.
- **Hound = physical.** Opacity is material: 1, times explicit effects only (the camcorder effect hook; the existing fade-in when a hound first becomes visible). Light changes its brightness through a tint (58-100 %, eased), never its alpha. The darkness overlay still does the real darkening, so in the dark it reads as a dark silhouette, not a ghost. The death-lab x-ray is unchanged (debug only).
- **Smiler = species concealment.** It is fed `__light.readability()` and turned into presence by its own `__ents.smilerPresence()` (`ents_src/20_smiler.js`). The behaviour is identical to before but now explicit and separate from generic entity lighting.
- `__api.lightOn()` (read-only) exposes whether the local light is on.
- No server, snapshot or AI change. Lighting presentation is client-side.
- **Test:** `dev/tests/light_test.py` (15 browser checks: opacity in bright, partial and dark light, boundary crossing every frame, shade ordering and smoothness, no NaN, smiler concealment, two-client agreement, a death preview, no runtime errors, and that no AI or sim code reads presentation values).

### v20 - the hound commits to its kill
- **What was wrong.** The moment a hound killed, the server finished the capture and ran its "what next" decision in the same tick: next victim, guard, feed or leave. Meanwhile every screen played the roughly 4.5 s death with a stand-in copy of the hound and hid the real one. So the real hound ran off invisibly after someone else while its copy was still killing.
- **Now.** `killNow` (`ai_src/40_capture.js`) puts the hound into a *kill commitment* for the length of that variant's death (A 4.5 / B 4.7 / C 4.3 / D 4.5 s, the same numbers as `dphys.js`). It stands on the kill, takes no one else and stays fully simulated even if nobody alive is near (`tierOf`). Then it makes its after-kill decision with the situation as it is at that moment.
- **No pop at the end.** The victim's client adds `ka` (where the animation left the attacker) to its existing corpse message. The server sets the hound there if the spot is within 320 px of the kill and clear. It waits at most 1.5 s past the death for that report; a victim who drops out simply leaves the hound where it was.
- The commitment is measured in world time, so it pauses with the world (admin freeze, or a room with nobody alive) like everything else.
- **Tests:** `dev/tests/s_commit.js` (hold, no second capture during it, decision after, per-variant length, report validation) and `dev/tests/commit_mp.py` (two browsers: the spectator never sees the real hound leave during the death, and it reappears where the animation ended). Scenario tests that assumed the old instant after-kill decision now wait for the commitment. H12 now counts any reaction to the intruder over 20 seeds.
- **Known, not changed:** after a kill the smiler is meant to linger grinning at the body, but its watch gives up at once because its target is dead. It was only visible before in frozen test worlds.

## v21 - Part 1B: pathfinding and navigation

**Measured first.** `dev/tests/nav_bench.js` drives the real movement code on the real level: 40 hound and 20 smiler routes across rooms, all 57 narrow doorways approached at 0/30/60 degrees (792 passes), two bodies through one door, real-AI chases through 3+ rooms, and loops round wall islands. The build before this pass arrived everywhere and never got stuck. What it did wrong, by layer:
- **Route (A):** the nav grid calls a cell walkable when its centre clears 21 px, exactly the body's collision radius, so the cheapest route hugged walls at touching distance. Moving targets re-planned on every 48 px cell they crossed (smiler routes ~23 plans each, chases ~1.9 A* searches a second).
- **Local steering (B):** the look-ahead accepted lines exactly body-wide, so any heading lag touched the wall. Nothing slowed a hound before a bend it physically could not take at speed (at 292 px/s its turning circle is ~200 px). Direct pursuit checked a 16 px line for a 21 px body. There was no way round a corner that cut into the chosen line.
- **Locomotion / collision (C/D):** a body facing a wall kept ~75 % speed while turning and scraped along it. Stuck detection ignored slow pushing. Nothing separated entities (two hounds came within 23 px, bodies 26 px each).
- **Network (E):** clients chased the newest 20 Hz snapshot with an exponential ease. The drawn speed surged after every packet (24.8 % frame-to-frame variation at a steady run, 45 % with late packets).

**What changed**
- **Route** (`ai_src/10_geo.js`, `30_entity.js`)
  - A clearance field is built once: every walkable cell knows how much room it has (<30 / 30 / 40 / 52+ px). A* pays extra for cramped cells, so routes run down the middle of halls and through the middle of doorways.
  - Routes are string-pulled (1584 grid cells become 30 waypoints over 30 routes), taking as much margin as the place allows. Bends are eased away from wall ends. Vault links and crawl cells are never smoothed across.
- **Repath hysteresis:** a moving goal slides the end of the route along. The route is extended by one leg when the goal slips round a corner, and fully re-planned only when the goal moved more than ~12 % of the distance or the route can no longer reach it. Every re-plan records why (`goal-moved`, `goal-behind-corner`, `from-direct`, `stuck`, `stuck-alternate`, `off-route`, `refresh`, `debug`).
- **Local steering:**
  - A look-ahead "carrot" moves along the route (farther at speed) and is low-passed, so bends are rounded without dither.
  - Corner braking comes from each species' own turn rate: a hound slows to ~200-250 px/s for sharp bends and still carries momentum.
  - A three-ray feeler brakes for walls ahead, and a body nose to a wall stops and turns on the spot.
  - When the line to the next point clips a corner, it slides round it on a consistent side.
  - Direct pursuit (hound hunt, smiler rush, debug moves) needs the body's real radius, with hysteresis between straight pursuit and following the route.
- **Stuck ladder:** a side-step at 0.35 s, a new route at 0.9 s, an alternate route that keeps off the spot on the second time, then the route is dropped. The old 6 s watchdog stays as the last resort and now logs `EMERGENCY un-embed` (0 in every test).
- **Collision:** fast moves (lunges) are taken in 10 px steps. Mild entity separation respects walls: hounds may crowd, and busy bodies (capture, kill, vault, lunge) are not pushed.
- **Network:** snapshots carry the server clock (`st`). Clients keep a short history per entity and draw it 100 ms in the past, interpolated with shortest-arc facing. If packets stop it extrapolates for up to 150 ms, and never smooths across a teleport.
- **Debug (admin, DEBUG tab, NAVIGATION):**
  - Layers: ROUTES (route with vault/crawl colours, aim point, wanted heading vs actual motion, direct-pursuit line, stuck timer), COLLISION (collision circle, body radius, nearby wall blocks), WALKABLE (floor near you shaded by clearance), VAULT LINKS.
  - Selection: select nearest / next entity. The selected one shows route length, why it last re-planned, stuck timer, radii, capabilities and counters (routes / wall touches / hard hits / stuck / recoveries / emergencies).
  - Commands: FOLLOW ME and COME HERE (navigation only), HUNT ME (real AI), CLEAR TARGET, FORCE REPATH, DROP ROUTE, RESET STUCK, GO TO IT.
  - Teleports: ME → DOORWAY / PILLAR / CORNER / OPEN ROOM.
- **Not changed:** species decisions, speeds, perception, memory, capture and kills, the smiler's light avoidance (still a route cost), and capability flags.

**Results (the build before this pass → now, same fixtures)**

| | before | now |
|---|---|---|
| hound wall-contact ticks per route / per doorway pass / at 60 degrees | 9.0 / 2.43 / 5.42 | 0.8 / 0.29 / 0.67 |
| smiler wall-contact ticks per route / per doorway pass | 2.5 / 0.86 | 0.8 / 0.21 |
| hard hits (bonks) per hound route / per real-AI chase | 0.2 / 0.4 | 0 / 0 |
| real-AI chase: contact ticks, A* searches per second (avg / worst) | 11.6, 1.90 / 2.82 | 2.1, 0.57 / 1.72 |
| heading wobbles per doorway pass (avg / worst) | 0.75 / - | 0.28 / 3 |
| two bodies through one doorway: deepest overlap | 23 px apart (no separation) | 43 px avg, deep overlap 0.03 s max |
| drawn speed variation, remote client (steady / late packets) | 24.8 % / 45.3 % | 6.6 % / 7.6 % |
| A* cost per search (avg / p95) | 1.17 / 5.5 ms | 1.14 / 5.6 ms |
| sim step, busy world (3 hounds, 5 smilers, 4 players) | ~0.12 ms | ~0.14 ms (+~13 %: smoothing and steering checks) |

**Tests:** `dev/tests/s_nav.js` (12 acceptance scenarios: reach, solids/NaN, doorways, simplification, obstacle loops, doorway reversals, capabilities, two through one door, 3-room chase, LOS lost, stuck recovery, cost), `nav_bench.js` (the numbers above), `interp_test.js` (the real client interpolation code against a jittery stream), `nav_mp.py` (two browsers: launch, overlay, commands).

## v22 - Part 1C: chase pressure, escape, search and hiding

**Audit - why escaping was too easy.** Measured with a scripted player on the real AI (`dev/tests/escape_bench.js`) and over the real server and WebSocket (`dev/tests/live_chase.js`). With a hound that heard you ~520 px away in the dark, a straight sprint escaped 69% of the time. The causes:
- Once sight broke, the hound ignored the prey's own running noise. It hunted "blind" on a projection and dropped to a slow search after a few seconds, even though the prey was sprinting loudly right ahead of it.
- The search started with a stop to "think", then crawled at search speed (134 px/s against a 285 px/s runner) toward the last seen spot. It never went the way the prey was heading.
- The last-known projection ran through walls, so the hound aimed at dead ends.
- Hiding and crawlspaces had no rules. A body under a table was as visible as one in the open, and nothing reasoned about where a crawlspace comes out.

**What changed (no speed buffs; hound chase 292, player run 285 as before):**
- **Pursuit by ear.** While its prey is making loud noise (run, slide, vault, landing), a hunting hound steers on the sound and its heard direction instead of losing the trail. The blind-chase timer runs at 12% while it can hear you.
- **Reacquisition.** A searching or frustrated hound that hears its remembered prey run goes straight back to hunting, with no new detection wait. It only sharpens its hearing (focus ×1.3) for its own target's loud sounds; walking stays quiet.
- **Memory.** The last-known estimate projects along your heading but stops at walls. Uncertainty grows with time and is shown in the debug overlay.
- **Geometry-aware search.** The first goal is down the way you were going, at the next opening. Candidates are openings in 12 directions (doorways and corridors read as long free rays), weighted toward your heading early and widening later. Other candidates are a crawlspace's other exits and recent sounds. While the trail is warm it moves at up to 0.9× chase speed with short sniff pauses.
- **Giving up is a decision with a reason:** "memory faded", "searched the likely places", "ran out of patience", "nowhere left to look", "no target", "lost track: the prey is far out of range", or "stuck: the watchdog reset it".
- **Personality.** PERSISTENCE and CURIOSITY size the search. INTELLIGENCE sets how much it trusts your heading. AGGRESSION sets how long the trail stays "warm". PATIENCE sets how long it waits at a crawl exit.
- **Crawlspaces are real subspaces** (`WORLD.CRAWL`, shared with the client). Each has an interior, an upper occluder with a height (data for a future cut-away or 2.5D view), exits with facing, and the capability it needs. A body inside is only seen close by (150 px under tables, 110 px in wall gaps).
  - An entity that saw you go in and cannot follow goes round to the other exits, or waits and listens at one.
  - One that can crawl goes in.
  - A crawlspace is not a safe box.
- **Crouching is not invisibility.** It lowers the vision range, but a still, crouched player right in front of a hound in the dark is still noticed. The vision floor is now 150 px.
- **Exhaustion matters physically.** Acceleration drops to 62% while exhausted, and recovery ends at 36 stamina, not 24. (v22 claimed the test harness mirrored `move.js` exactly; it did not - see v22.1, where the harness runs `move.js` itself.)
- **Watchdog fix.** The stuck-detector no longer resets a hound that is deliberately standing still (frustrated pacing, sniffing, freezing). Before, it silently turned a search into wandering.
- **Debug overlay** (admin DEBUG tab, section "CHASE · SEARCH · HIDING"):
  - SEARCH + MEMORY: last known position and heading, uncertainty ring and estimate, last heard sound, search goal and its kind, phase, legs, time left, memory age, exits tried, times re-acquired by ear, and the give-up reason.
  - CRAWLSPACES: interior, occluder, exits, what each needs, and whether the selected entity can use it or must go round.
  - ME → CRAWLSPACE puts you at the nearest crawl entrance.

**Escape numbers now** (hound heard you ~520 px away, dark, 15-16 runs each):

| Strategy | Before | Now |
|---|---|---|
| Straight sprint | 31% caught | 60% caught |
| Break sight, then walk quietly | - | 60% escape |
| Crouch still where it lost you | - | 80% caught |
| Crawlspace | - | 38% caught, 31% escape, 31% still circling |

A hound 320-420 px behind a seen runner catches ~93-100%. An exhausted runner is caught in ~2.5 s.

**Not done in this part (by design):** the visual cut-away, cast shadows, advanced shading, the Smiler overhaul, the menu and 2.5D.

## v22.1 - Part 1 audit remediation (targeted fixes only)

Fixes for the concrete findings of the independent Part 1 audit. No rebalancing, no Part 2. Details and numbers are in the delivery report; in short:

1. **Malformed URLs.** `server.js` no longer crashes on a bad percent-escape (`/%`). It answers `400 Bad request` without paths or stack traces and keeps serving.
2. **Reconnect / new world.** `mp.js` clears interpolation history, the clock offset and entity slots at every connection boundary, and whenever the server clock steps back more than 0.25 s or jumps ahead more than 30 s. An id reused by a new room can no longer inherit an old pose. Ordinary jitter never triggers a reset.
3. **Respawn lifecycle** (`sim.js`: `canRespawn` / `respawn` / `join`):
   - A respawn is accepted only from a legal state: the player is active and either dead, or revived by an admin (a one-time permit).
   - A living player cannot respawn, whether free or held in a capture.
   - A held player cannot start a new run either.
   - A refused request is answered with the player's real position.
4. **Movement validation** (`server.js` + `sim.moveOk` / `sim.spawnOk`):
   - Every non-admin player has a distance budget. It refills at 360 px/s (130 px/s while held, 0 while dead) and holds up to 1.5 s of movement, with 28 px of slack counted as debt.
   - A move must fit the budget and must not cross walls or full-height furniture. Props that the client's own movement handles are passable.
   - A long hop after a lag burst is accepted only if a real route that short exists (at most 3 such route checks per second).
   - A refused move keeps the server's position. The client is corrected at once if it is more than 220 px off, or after 0.6 s of repeated refusals.
   - Spawn, respawn and admin moves reset the check. In-flight packets are ignored for 0.9 s afterwards.
   - The first position after a join or respawn is the client's own spawn choice, as before. It is accepted only on open floor away from the monsters.
   - Admins are not checked, because their debug tools move them from the client.
   - Noise claims can't be quieter than the movement the server accepted. A client claiming to stand still while moving fast is heard as walking or running.
5. **Death aftermath survives a disconnect** (`death_srv.js`):
   - The server keeps each committed death until its corpse exists.
   - If the victim's client has not sent its replay within 1.5 s, or has gone, the server sends the replay itself.
   - If the corpse has not arrived when the death would have ended, the server makes it. The window is plus 0.6 s once the victim is gone, or plus 8 s while it is still connected.
   - The fallback corpse comes from the same physical death: `dphys.js` runs on the server with the same inputs, and the death plan numbers are now one shared table (`dphys.PLAN`).
   - Bodies are keyed by player id, so there is never a second corpse or a second dropped light.
6. **Chase test model.** Scripted players now move with the real `move.js` (`dev/move_model.js`). The remaining differences are listed in that file.
7. **Package-relative dev paths.** The tools and tests use `dev/paths.js`, and the build scripts write into the game folder they belong to.
8. **Escape bench.** The duplicate hook call was removed (test B1).
9. **Hound watchdog.** The corrected tests exposed this: a hound that paused to listen and then walked back past its old spot was reset as "stuck" and stopped dead. The watchdog now counts only a hound's time spent trying to move. Smilers keep the original rule.

## v22.2 - Part 1 follow-up (the four defects left after the v22.1 verification)

1. **Capture lifecycle** (`sim.js`: `join` / `leave` / `vanish` / `forfeit`, `server.js`). A player is in the MENU, ALIVE, HELD (in a capture) or DEAD.
   - While HELD, every exit is closed: respawn, join, leave (so leave -> join no longer escapes) and the NEW RUN vanish (which used to give 4 s of protection).
   - Closing the connection while held forfeits the capture: the holder kills there and then through the ordinary kill path. The death leaves its replay and corpse, and a reconnect is a new player after a death, not the held one set free.
   - While ALIVE, a new run is only the game's own NEW RUN sequence: the vanish (2.7 s on screen), then leave, then join. The server accepts the leave or join 2-20 s after the vanish, and allows one vanish every 30 s.
   - A bare join or leave from a living player does nothing.
   - Death -> respawn, death -> new run, admin revive -> respawn, joining from the menu, the glitched-wall exit and reconnecting are unchanged.
2. **Sub-pixel wall bypass** (`server.js`). Every accepted move now gets the collision check, however small. Before, moves of 0.5 px or less skipped it and could add up through a wall.
3. **Silent running without a movement report** (`sim.js` `gaitFloor`, `server.js`).
   - The gait the AI hears is set on every position update from the movement the server accepted, measured over at least 0.5 s. It no longer depends on the client's report.
   - A report can add detail, but can never make the player quieter than that movement.
   - With no report, or a garbled one, the gait is the quietest one that speed allows: standing, crouch pace, walk or run.
   - The observed speed is measured over at least 0.5 s, so packets bunched by lag do not spike it.
4. **Death aftermath race** (`sim.js` `onDeath`, `server.js`). The aftermath record is now made at the moment the server commits the death, not later in a broadcast scan. A victim that closes at once, even with the close frame right behind the command, still leaves exactly one replay and one corpse. The client's own replay and corpse remain the normal path.

Nothing else changed: no tuning, no AI change, no change to the death look or physics.

## v23.0 (Part 2, stage 2C) - the evidence foundation

The law of Part 2: **the server may know the truth; an entity acts only on evidence it legitimately possesses.** Stage 2C makes the senses obey it. Hound and Smiler behaviour is otherwise the v22.2 behaviour (canon Smiler: 2D; two Hound types: 2E; infrared: 2C-IR).

1. **Two kinds of knowledge, kept apart** (`dev/ai_src/20_senses.js`).
   - *Attributed* records (`e.mem.p`): one per player the entity has actually seen. Its target is always one of these. Each record now carries typed evidence entries (`see` / `sound` / `light`): position, uncertainty radius, confidence, time. At most 4, newest of each kind.
   - *Anonymous leads* (`e.mem.leads`): things noticed that name nobody - a light source, a beam, a lit wall or floor. `pid` is always null. A lead is an **investigation goal** (`e.inv`), never a target. At most 6; they fade.
   - A lead becomes attributed only when the entity then sees a player where it points (`attributeLeads`).
   - Records are no longer created for players merely in range: only sight (or, as in Part 1, hearing) creates one.
2. **Visible light is evidence** (`dev/ai_src/25_light.js`, new).
   - Where each visible light really falls is computed once for everybody (~8 Hz): 3 rays per beam, stopped by walls; 2 samples along the beam in the air. Lanterns: 6 rays round the carrier.
   - Each near entity looks at that 4 times a second, from its own position, field of view and line of sight.
   - The source itself in view -> `source` lead (a light in the hand of somebody it is looking at is pinned on them at once). A beam in the air -> `beam` lead: the brighter end says which way the light came from, not how far. Only a lit wall / floor -> `litwall` / `litfloor` lead somewhere on the open side of the patch, with a wide uncertainty.
   - `inferLead()` is a pure function of what the entity observed. It cannot reach the carrier's position; a test replays identical observations with the carrier moved elsewhere and gets identical decisions.
   - Turning a light off stops new evidence; what was already noticed stays and fades like any memory.
   - In 2C the leads are kept, shown in debug and counted as anonymous company in a capture's threat assessment; acting on them is 2D / 2E.
3. **Walls stop light everywhere** (`10_geo.js lightLevel`, Smiler `beamOn`). A torch no longer lights a point, or "points at" a Smiler, through a wall.
4. **The camcorder emits no visible light** (`sim.js feed`, `server.js`). A raised camcorder is not a lit player for the AI (no beam, no glare bonus, no evidence). Its raised pose still reaches the other players (presentation only).
5. **Hidden-coordinate reads removed.** Places that used to read a player's true position, velocity or state without having sensed it:
   - Hound: lunge aim correction (now only on a prey it can see), hunting / stalking / feeding-guard targets (now its belief: the body while seen, memory otherwise), knowing a prey died or was caught out of its sight (now only if it saw that).
   - Hearing: copied the player's true velocity into memory; now uses the heading built from the heard positions themselves.
   - Threat assessment during a capture: walked the true player list and read the exact position of anybody with a lit torch in line of sight; now built from its own records and leads.
   - Smiler: watching / following / stalking / provoked / attacking targets, the "approached" and "lit by a beam" checks, and the light-failure attack's position (all now its belief; contact itself stays physical).
   - Kept as system rules (not perception): level-of-detail tiers, spawn safety, contact at capture range, and the Smiler's "never reposition right behind somebody" fairness rule (to be rebuilt in 2D).
6. **Target commitment** (`setTarget` / `mayRetarget`): having picked somebody it keeps them for at least 1.5 s unless it has really lost them (confidence < .2) - no per-tick flicker between two people.
7. **Eye contact** (`facedBy`): the entity sees the player, the player faces it (within ~20°, the character's facing from the client - not a screen), and the player could make it out (within 240 px, or with the entity in light). Debug-visible now; used by 2D / 2E.
8. **Debug** (admin only, DEBUG tab -> EVIDENCE + LEADS): leads as dashed uncertainty rings by type, the investigation goal, evidence diamonds on its record, and in the label: the decision with its stated reason, any retarget, the last light it noticed, eye contact, and (selected entity) its traits.

Tests: `dev/tests/s_evidence.js` (E1-E10) and `dev/tests/perf_light.js` (8 lit players around every near-tier monster). Known items unchanged: admin T8, live.js L5b (stochastic). Sound attribution: hearing still tells one player's footsteps from another's, as in Part 1 - a 2F item (multiplayer: conflicting evidence).

## v23.0 (Part 2, stage 2C-IR) - night vision as active infrared

The camcorder's night vision is now a **sensor** plus an **IR illuminator**, not an infinite green filter.

1. **The illuminator** (`camcorder.js`, drawn by the bundle's own wall-clipped light fan): a directional infrared beam with a strong core (~0.5 rad) and a weaker outer field (~1.05 rad), a smooth fall-off to nothing at its range, stopped by walls (through a doorway it carries on), plus a little spill at the lens. The old 640 px circle all round the player is gone.
   - **B** cycles the emitter: OFF / LOW (~340 px) / HIGH (~560 px). LOW is the default. Touch: the IR button.
   - **N** is the sensor. With the emitter OFF it still amplifies visible light (lamps) but lights nothing itself.
2. **Heat comes from the emitter**: HIGH overheats in ~18 s (v23.0.1: was ~30 s), LOW in ~75 s, emitter OFF (sensor only) not at all and the camera cools. An overheated **emitter** shuts down for at least 9 s and until it has cooled to half; the sensor stays on (HUD: IR HOT). No batteries - heat is the only resource. The grain / flicker / shake stages still follow the heat; the whine only while the emitter runs.
3. **Overexposure**: the emitter's core on a surface close to the lens (HIGH ~115 px, LOW ~80 px, weaker) floods the sensor - the near picture blooms and distant detail washes out. It eases in (~0.16 s) and out (~0.45 s), so sweeping past a pillar is a flash, not a strobe.
4. **Legibility follows the light**: under NV a creature that conceals itself (the Smiler) is legible where visible light or infrared actually reaches it - along the beam, within its range, not round a corner - instead of everywhere within 640 px. `__light.sample()` reports infrared (`ir`) only while the local sensor is on.
5. **Infrared is visible only through a night-vision sensor**: without NV it is not drawn at all; another player's camcorder beam is drawn only while this player's own NV is on.
6. **Outside the AI by construction**: the client sends the emitter level (`ir`); `server.js` keeps it on the connection (`me.ir`), never on the player object the simulation and AI receive, and relays it to the other clients for their sensors. Only a raised camcorder can carry it (clamped 0-2). ai.js / sim.js do not name it. A raised camcorder emits no visible light (2C).

Tests: `dev/tests/s_ir.js` (I1-I3: no infrared in the simulation; OFF vs HIGH -> identical AI decisions tick by tick; a raised camcorder is no light), `dev/tests/ir_net.js` (N1-N4, real server), `dev/tests/ir_test.py` (R1-R9 in a browser: range profile, beam not disc, sensor-only / NV off, walls, heat, overexposure, peers, legibility). Not changed: lighting of torches / lamps, the Hounds, the Smilers, movement, deaths.

### v23.0.1 (2C-IR QA fixes)
- The overexposure glow no longer stays on screen when the camcorder is lowered (or NV switched off) while the beam is on a wall: it is cleared on that same frame.
- HIGH now overheats in ~18 s (was ~30 s), for balance. LOW is unchanged (~75 s).

## v23.1 (Part 2, stage 2D) - the canon Smiler

The Smiler is rebuilt around the approved Smiler Canon Lock (Backrooms Wikidot, Entity 3) and the 2C evidence law. Its whole brain is `dev/ai_src/60_smiler.js` (built into `ai.js`). Hounds, player movement, stamina, movement validation, lifecycle, death physics, infrared, night vision, navigation, interpolation and the server are unchanged.

**Canon -> behaviour** (each behaviour is a canon fact plus the smallest gameplay inference needed to play it):
- *"Attracted to light, and will chase anything they see with a light"* -> a light it observes (2C leads: source / beam / lit wall / lit floor) draws it to look; a light **carrier** it can see winds up its agitation and, past its threshold (~0.5-0.74, personality), it chases. Light off: the lure is gone after ~1.2 s and it goes back to watching.
- *"Only start to attack if you panic and retreat, or if a loud noise is made"* -> the only strikes: somebody it sees retreating fast in front of it (panic), or a loud sound close by (a run, slide, vault, hard landing). Up close and highly agitated, a small sound (one ordinary step) counts too; a careful crouched shuffle does not. A chase that catches a light carrier is the other way to die.
- *"Keep eye contact, and move away slowly"* -> sustained eye contact (line of sight, the player facing it, ~0.4 s to take hold, a one-frame glance does nothing) holds it: it does not come at the one watching it. Backing away slowly while watching it gets you let go (it withdraws). **Holding is counterplay, not immunity**: somebody who just stands and stares is crept up on to ~110-150 px and the Smiler then drifts sideways, so the gaze must keep finding it; lose it up close and agitation jumps.
- *"Reside in dark areas"; "eyes and teeth gleaming"* -> it waits in the dark (lamp field only), moves to another dark spot when restless, and walks everywhere (no teleport, no vanishing). Only the face is drawn: a gleam in its own render channel (not the generic entity alpha, not scene darkness). No limbs, no body detail (unconfirmed in canon).

**What it knows**: its records (people it has seen), sounds it heard, anonymous light leads, eye contact, and the light on itself from the fixed lamp field plus beams it has seen in its eyes. It never reads an unsensed player. Lost somebody? It goes to where it last had them, with an uncertainty that grows with time, looks, tries a couple of likely openings, then admits it was wrong. Two deferred true-position reads are gone: the "never reposition behind somebody" rule is now a system placement validator (`eng.placementOk`, answers only valid / invalid), and its light level no longer comes from players' torches.

**Agitation** (0..1, bounded, decays, debug-visible) rises with a light carrier in view, a beam in its eyes, fresh light, being close, not being watched back, eye contact broken up close, noise; it rises only a little while it is watched. **Multiplayer**: it scores the people it perceives (in view, light seen on them, recent loud sound, distance) and keeps its choice for at least 3 s (a canon trigger switches at once): a hidden person it has never seen never wins; a light somewhere else draws it off someone it is only watching in the dark (once, no back-and-forth), but not off someone holding it with their eyes. **Personality**: patience, curiosity, persistence, boldness from the shared trait jitter - timing and nerve only, bounded (chase threshold spread < 0.1).

**Debug** (admin, DEBUG): per Smiler the WHY line (what it is doing and why), agitation and its causes, the light on it, who is watching it, target dwell, what it abandoned or switched and why; for the selected one its personality, eye contact timers and strikes.

Tests: `dev/tests/s_smiler.js` (SM01-SM16), `dev/tests/perf_smiler.js`, `dev/tests/smiler2d_view.py` (browser + debug feed). Retired with the old Smiler: `s_smiler_v22_retired.js`, `s_smiler2_v22_retired.js` (kept, not run). Updated to canon: `s_capture.js` C01 / C03 / C04 / C05 (the Smiler never plays with a victim; the hound parts unchanged), `s_system.js` Y07 (fade-rate bounds over watch / hold / let-go cycles).

### v23.1.1 (2D QA)
- Smiler chase speed 255 px/s (was 232: too easy to outrun). Still below a fresh sprint (285 px/s) and above a winded or deep-carpet sprint (~236): a fresh runner who reacts at once gains only a little ground; getting away takes stamina, routing and breaking line of sight (light off: it loses you).

### v23.1.2 (2D QA) - close-range pressure
- Eye contact holds the Smiler back; it no longer lets you walk up to it. Coming at it raises its agitation however hard you stare (eye contact does not soften this), and somebody who has walked in on it to point-blank range (< 140 px) and is not backing off is struck. Walking, crouching or inching in all count; only the distance the player closed counts, never the Smiler's own creep.
- Still safe: standing your ground while it creeps in and drifts, side-stepping to keep it in view, backing away slowly (let go).
- Right beside it (< 120 px) and agitated, even a crouched step is heard as a trigger; the "small sound up close" radius is 230 px (was 200).
- Gameplay inference, not canon text: the canon advice is to keep eye contact and move *away* slowly; approaching is the opposite, so it is not protected by the hold. Test: `s_smiler.js` SM17.
