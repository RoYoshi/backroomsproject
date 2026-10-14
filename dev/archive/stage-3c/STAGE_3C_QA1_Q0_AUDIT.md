# Stage 3C QA1, Q0: audit and gap map

QA1 corrects the first Stage 3C candidate against the user's later design decisions (master pack revision 2). Q0 records what the parent actually does and the smallest place to change each thing, before any redesign code.

## 1. Parent and branches (verified)

| | Value |
|---|---|
| QA1 parent (first Stage 3C candidate) | `76bcc4acaa14814f84c2b9ae66acc5ffdfe2cace`, tree `d8f0949500168294e3856d64ff24df111dc76bd2`. Remote `stage-3c` is exactly this; the GitHub REST API reports the same tree |
| Its package | SHA-256 `5107cacf…829e`, as the pack's reference receipt records |
| Accepted Stage 3B ancestor | `6e6fa46ecab537f716942b94f873776b09049a40` (tree `33ed11b…`) |
| Pack | `THE_FAR_BACKROOMS_STAGE_3C_QA1_UI_REDESIGN_MASTER_PACK_V2.zip`: SHA-256 `fad9f0f5…0670` matches the supplied `.sha256`, and every file matches `PACK_SHA256SUMS.txt` |
| Audio | the source and both derivatives match the SHA-256s in `MAIN_MENU_THEME_LOCK.md` |
| `stage-3c-qa1` | did not exist remotely; created from exactly `76bcc4a` |
| `main` | `7781e1a`, untouched |
| Every remote head before QA1 | `dev/stage-3c-qa1/evidence/q0/remote_heads_before_qa1.json` (18 branches) |

## 2. The rough draft (`visual_reference/MAIN_MENU_ROUGH_DRAFT.png`, opened and inspected)

| Draft element | Where | QA1 mapping (real systems only) |
|---|---|---|
| `THE FAR` / `BACKROOMS`: two lines, very wide tracking, cream-yellow, soft glow | top centre, large | the identity, as drawn: two centred lines, tracked, lit by the fluorescent tube |
| Black negative space | everywhere | kept: the darkened world behind, an empty centre |
| `selected level - ???` | above PLAY | `LEVEL 0 · THRESHOLD`. Both names are already the game's own: "THRESHOLD" is the level's label in the parent UI. There is one level, so there is no level select |
| Large `PLAY` box | lower centre, dominant | PLAY, the strongest element. It opens the PLAY entry (name, loadout, ENTER LEVEL 0) |
| `levels / Servers / Customize` row | under PLAY | CUSTOMIZE / SETTINGS / CREDITS. "Levels" and "Servers" would be fake systems |
| Tall left rail: avatar + `@RoYoshi\|Elias`, then "stuff" | left | the Wanderer's identity: the real avatar preview and the name field, the real loadout, and the real connection |
| `CHAT - Global 452` with a message list | bottom of the left rail | no chat exists. This becomes the real connection block (SOLO / ONLINE, the room, how many wanderers are inside the halls, not counting the visitor) |
| Right utility rail: gear, person, document, info | top right | gear = Settings; person = Customize (Wanderer); document = Credits; info = Help (controls, and how to install the game on a phone) |
| `V23.4.5` | bottom right | the project's own version string. `package.json` says `23.3.6`; the draft's number is a placeholder. The shown string is editable data, not invented |

## 3. Menu / run lifecycle (measured: `dev/stage-3c-qa1/q0_lifecycle.js`, `evidence/q0/lifecycle_parent.json`)
- **What a visitor who loads the page and waits 8 s on the menu has, in the parent:**
  - `__api.started()` is false;
  - the game's own `window.__hideSelf` is undefined;
  - **the avatar is drawn** (the person container is visible) and **its light counts as on** (`__api.lightOn()` is true, so BR-RoLE draws the visitor's flashlight at spawn);
  - **0 `join` packets** are sent;
  - position packets go out on the menu's slow cadence (the server stores them as "in the menu: not in the world, nothing to check");
  - the visitor's own connection line says "2 WANDERERS", counting itself.
- **What another player inside sees:** "1 WANDERER" and no avatar for the visitor. Server-side the visitor is inactive: `server.js` broadcasts only `active` players, and the simulation's `isAlive` requires `active`, so no Hound or Smiler can target it.
- **After ENTER LEVEL 0:** exactly 1 `join`, and the observer sees 2 wanderers and 1 avatar.
- **Movement, stamina, solo AI:** run only inside the game's `started && !paused` block (bundle `Ou0`). There is no run tick before ENTER.
- **After END:** the game's own `Nend()` sets `__hideSelf = true` and leaves, so the post-run menu is already clean. **Only the first menu after page load shows a local Wanderer.**
- **Q2 correction to this measurement:** the "avatar drawn" reading above followed `__api.beam()`, a plain object with no parent chain, so it could only read "drawn". Q2's `lifecycle.js` reads the person object itself and confirms it for the parent (`evidence/q2/lifecycle_first_candidate.json`), as the Q1 captures had already shown. The server's view in Q2 comes from the admin data on its snapshots: the visitor is listed, not active.
- **Smallest safe gate (Q2):** set the game's own `__hideSelf = true` before the bundle runs, which is the state the game itself uses after END. `Su()` (the game's start) already clears it at ENTER. Also fix the menu's connection wording so it counts only the wanderers inside. No change to networking, movement, AI or the server.

## 4. Audio graph (for the menu theme)
- **The game's audio object (`__api.audio()`, bundle class `nu`):** creates its AudioContext and master gain (`.14 × volume`) only in `start()`, which is called at ENTER LEVEL 0.
  - Starting it early would start the halls' ambient graph in the menu.
  - SOUND ON/OFF is `nu.toggle()` (`muted`); volume is `fb_settings_v1.vol`.
- **Other contexts:** `mp.js` has its own small context for the dread drone, created on the first gesture. `sfx.js` uses the game's context and loads every file in `/sounds/`.
- **Pausing:** `_u(true)` (pause, or opening Customize) suspends the game's context.
- **Menu theme plan:**
  - **Its own small graph:** an AudioContext and gain, created on the first legitimate gesture. It follows the same SOUND ON/OFF flag and master volume, and the game's graph is never started early.
  - **Playback:** intro and loop buffers decoded once and cached in JS. The intro is scheduled at `t0`, and the loop (`loop = true`) at `t0 + intro.duration`, sample-accurate on the same context clock.
  - **ENTER:** fades out over about 1 s, stops the sources and suspends the context.
  - **Back at the true menu:** restarts from the intro.
- **Assets:**
  - PCM-24 44.1 kHz stereo: intro 30.789660 s, loop 54.799093 s; 22.6 MB together.
  - Peaks −2.5 / −0.9 dBFS; RMS −21.0 / −16.1 dBFS.
  - Measured seams, matching the lock: intro→loop jump RMS 0.0033; loop end→start jump RMS 0.0033; ordinary adjacent-sample RMS there about 0.0056.

## 5. Static serving and PWA (`server.js`, protected, unchanged)
- **What is served:** only the named root scripts and flat `assets/<name>`.
  - Types are known for .html / .js / .css / .png; everything else is `application/octet-stream` with `Cache-Control: no-store`, gzip-compressed on first request (synchronous, cached in memory).
  - `sounds/` is the user's drop-in folder, and `sfx.js` decodes every file in it, so the theme must not go there.
- **Consequences:**
  - **The manifest** goes in `assets/` (Chrome and Safari parse manifests whatever their content type).
  - **The theme WAVs** go in `assets/`.
  - **The cost:** each page load re-downloads about 22 MB of audio (no-store; gzip saves only 2-4 %). The first request after a server start blocks the server for one synchronous gzip (measured here: 218 ms intro, 385 ms loop, once each).
  - **Mitigations within scope:** fetch the music only after the first gesture on the menu, and keep the immutable, content-versioned files in the page's Cache Storage where the browser offers it. That is not a service worker and caches no game code or network state.
  - **Report it:** a later stage should set audio caching in `server.js` or ship compressed delivery formats. The lock forbids recompressing in QA1.
- **Icons:** the repository contains no official game icon (`assets/carpet.png` is a texture). The lock forbids inventing branding.
  - **iOS:** standalone launch from Add to Home Screen works without one.
  - **Android Chrome:** treats a manifest without icons as not installable, so the user must supply an icon (QA1 documents the two file names to drop in).
  - **No service worker** is needed for standalone, so none is added (an online game; no offline mode).

## 6. Keyboard bindings (from the parent source)

| Action | Default | Read by |
|---|---|---|
| Move up / left / down / right | W A S D, and the arrow keys | bundle: the key set `Q` (`Q.has('KeyW')`…) |
| Run (hold) | Shift (left or right) | bundle: `Q.has('ShiftLeft'/'ShiftRight')` |
| Crouch / slide | C | `move.js`: `Q.has('KeyC')` |
| Light / raise camcorder | F | bundle keydown `e.code === 'KeyF'` |
| Cartograph | M | bundle keydown `e.code === 'KeyM'` |
| Inventory | Tab | `inventory.js` capture keydown `e.code === 'Tab'` |
| Night vision / infrared / zoom | N / B / Z (plus right click / wheel) | `camcorder.js` keydown `e.code` |
| Pause | Esc | bundle; fixed, never rebindable |
| (admin panel) | Backquote | `mp.js`; admin only, never offered |

- **No `isTrusted` checks anywhere**, so a small input adapter can remap a physical key to the action's default code by re-dispatching it. The game keeps reading the same codes.
- **With all defaults, the adapter does nothing at all**, so behaviour is identical by construction.
- **Touch:** the D-pad buttons put the same codes into `Q`. RUN and CROUCH are `data-key` buttons; LIGHT, NV, IR and ZOOM are click handlers. On touch the aim follows movement (`atan2` of the key axes).

## 7. Touch input
The parent (first candidate) has a 3x2 D-pad bottom left, writing W / A / S / D into `Q` on pointer down and clearing them on pointer up or cancel. On the right are LIGHT, INV, RUN and CROUCH, plus NV / IR / ZOOM with the camcorder. A floating thumbstick that sets the same four codes, 8-way, gives the D-pad's exact speed and diagonal normalization (the game turns the key axes into movement) with no movement code changed.

## 8. Smallest seams per QA1 item

| Item | Seam | Protected files touched |
|---|---|---|
| Q1 menu | `index.html` `#menu` markup, `assets/ui.css`, `assets/ui.js`; theme player in `assets/ui.js` | none |
| Q1 theme | `assets/MainTheme_MenuIntro.wav`, `assets/MainTheme_MenuLoop.wav`; source preserved in `audio_source/` | none |
| Q2 gate | `assets/ui.js` sets `window.__hideSelf = true` before the bundle runs | none |
| Q3 HUD | `index.html` HUD markup and `assets/ui.css`; `hud.js` (settings model: migration of `coords` / `title` / `keys`) | none |
| Q3 keybinds | input adapter and Controls page in `assets/ui.js`; dynamic key labels | none (the inventory drawer's key labels may need `inventory.js` text hooks; accounted if so) |
| Q4 thumbstick | `assets/ui.js` writes the same codes into `__api.keys`; the D-pad is hidden, not removed (the game binds it by `data-key`) | none |
| Q4 PWA | `assets/manifest.webmanifest`, `index.html` meta, safe-area CSS | none |

Nothing in QA1 needs the bundle, `server.js`, `sim.js`, `ai.js`, `move.js`, `camcorder.js`, BR-RoLE, the camera, or the remaster changed.

STAGE 3C QA1 Q0 — AUDIT RECORDED
