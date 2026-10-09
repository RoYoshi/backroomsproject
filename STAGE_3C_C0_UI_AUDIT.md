# Stage 3C — C0 UI audit, freeze and architecture

**Scope of this checkpoint:** read and record only. C0 changes no game file. It adds this audit, two development tools (`dev/stage-3c/ui_lib.js`, `capture_ui.js`) and baseline screenshots of the accepted parent (`dev/stage-3c/evidence/c0/`).

| | |
|---|---|
| repository | `RoYoshi/backroomsproject` |
| accepted Stage 3B parent | `6e6fa46ecab537f716942b94f873776b09049a40`, tree `33ed11b672d3a2a45767accccbb9f04fdd7949c3` (on GitHub as `stage-3b-l-qa2`; checked before branching) |
| Stage 3B package | SHA-256 `b3ef330271f3e7a97287523b6358f68c2c6dcce6759b740760b490f155592f50` (the pack's lock; the pack itself checked against its own `.sha256`) |
| work branch | `stage-3c`. It did not exist on the remote, and was created from exactly `6e6fa46`. |
| untouched | `main` (`7781e1a`) and every other branch |

---

## 1. Who owns each UI surface today

Everything is plain browser JS: one minified Vite/Pixi bundle (`assets/index-DKbV5Nv9.js`) plus classic scripts that `index.html` loads after it in the body. **The server only serves a whitelist** (`server.js` `SERVE`): `index.html`, the named root scripts, and any flat file in `assets/`. New client files therefore go in `assets/`, so `server.js` stays untouched.

| surface | markup | behaviour owned by | notes |
|---|---|---|---|
| world canvas, light canvas, grain, dread | `index.html` (`#game`, `#light`, `.grain`, `#dread`, `#mp`) | bundle, BR-RoLE, `mp.js` | Stage 3B. Not UI. |
| header: brand, SOUND, SETTINGS | `index.html` `<header>`; `#settingsBtn` added by `hud.js` | bundle (`#sound` → `Z.toggle()`, label = state); `hud.js` | `#customize` and `#help` are **hidden by CSS** and used only as programmatic entry points |
| entry screen | `index.html` `#menu` (`#name`, `#enter`) | bundle `Su()` (start) | `#menu` is hidden at start, shown again by the run menu's END, and overwritten on renderer failure |
| network badge | `#net`, created by `mp.js` | `mp.js` | real state: SOLO / ONLINE · ROOM · n WANDERERS (a real count, not a fake one) |
| location (THRESHOLD / LEVEL 0 / sector) | `.location`, `#sector` | bundle writes `#sector` every 0.12 s; `hud.js` crossfades and quiets it | |
| HUD row | `#hud .walk`: objective (static text), `#nameplate`, `#pace`, `#staminaText`/`#staminaFill`, `#lightStatus` | bundle writes the values every 0.12 s; `hud.js` crossfades and stamina state | the objective is static markup |
| key hints | `#hud .keyline` | static; `hud.js` auto-fade (`hint-dim`) | camcorder keys shown via `body.cam-kind` (camcorder.js CSS) |
| coordinates | `.coordinates`, `#coords` | bundle writes; `hud.js` toggles | |
| pause / controls | `#dialog` (`#dialogTitle`, controls rows, `#resume`, `#reset`, lore credit) | bundle `_u()`; `mp.js` adds `#onlineNote` | holds the **Backrooms Wiki / CC BY-SA 3.0 attribution** |
| cartograph | `#mapPanel`, `#map`, `#closeMap` | bundle `vu()` / `bu()` | an item, M key |
| caught | `#caught` (`#caughtTitle`, `#caughtAdvice`, `#retry`) | bundle; `inventory.js` adds `#loadoutBtn` (CHANGE LOADOUT) | |
| won | `#won` (`#wonStats`, `#playAgain`) | bundle; `mp.js` writes `#wonStats` | |
| run menu | `#runMenu` (`#runSpawn`, `#runCustomize`, `#runEnd`) + inline `<style>` in `index.html` | bundle `Xnr()` (vanish) → `Nend()` | END shows `#menu` again |
| encounter / blackout hints | `#encounterHint`, `#blackoutHint` | bundle (visibility every 0.12 s) | |
| customize | `#appearancePanel` (`#avatarPreview`, `#avatarHat`, `#avatarTexture`, `#avatarHands`, `#avatarMain`, **`#avatarBackpack`**, `#lightKind`, `#lightColor`, `#lightDescription`, `#lightParts`, `#doneAppearance`, `#closeAppearance`) | bundle (open/close, field bindings, focus trap, Escape); `inventory.js` (device cards, parts, close-up, lock note; hides `#lightKind`/`#lightDescription`) | the bundle binds every one of these ids at load: **removing any of them throws** |
| settings | `#settings` dropdown, created by `hud.js` | `hud.js`; **BR-RoLE injects its LIGHTING row** into `#settings section[data-pane="custom"]` every 0.5 s | |
| inventory | `#inventory`, `#invToast`, created by `inventory.js` | `inventory.js` | TAB; its own capture-phase key handler |
| camcorder overlay | `#camFx`, `#camHud`, `#camGrain`, `#camTear`, `#camBloom`, touch NV / IR / ZOOM | `camcorder.js` | **Stage 3B NV presentation: protected** |
| admin | `#adminPanel`, `#adminMsg`, `#kicked` | `mp.js` (backquote) | operator tool: out of scope |
| touch | `#touch` (d-pad, RUN, CROUCH, LIGHT) | bundle (`[data-key]` pointer handlers, `#touchFlash`); `camcorder.js` adds NV / IR / ZOOM | shown only for `body.playing` and `(pointer: coarse)` |

### The bundle's UI seams (to stay untouched)

The bundle wires the UI by id with `document.getElementById` (`Y()`), once at load:

- **start** `Su()`: reads `#name`, joins the network, resets the run, hides `#dialog`/`#menu`/`#caught`/`#won`/`#mapPanel`, shows `#hud`, sets `body.playing`. Bound to `#enter`, Enter in `#name`, `#playAgain`, `#runSpawn`.
- **pause** `_u(on)`: no-op while caught. Sets the pause flag, shows or hides `#dialog`, suspends or resumes audio. Bound to Escape (window keydown), `blur`, `visibilitychange`, `#help` (open) and `#resume` (close).
- **customize**: `#customize` click opens `#appearancePanel`. It pauses (and hides `#dialog`) and sets the preview flag. It is refused while caught unless `window.__loadout` is set (`inventory.js`'s CHANGE LOADOUT). `Tu()` closes the panel, restores the earlier pause state and focuses `#customize`. Escape (handled first in the bundle's keydown) and `#doneAppearance`/`#closeAppearance` call it.
- **new run / vanish** `Xnr()` → `Nend()`: hides `#hud`, leaves the network room, shows `#runMenu`.
- **respawn** `xu()`: `#retry`.
- **map** `vu()`: `#closeMap`, M.
- **window.__api**: `started()`, `paused()`, `unpause()`, `win()`/`unwin()`, `revive()`, `look` (the appearance object), `gear` (`eq`, `save`, `defs`, `parts`, `draw`), `audio()` (the sound object: `muted`, `toggle()`, `gain`), `mkAvatar(look, gear)`, `map()`, `mapOpen()`, `H` (the wanderer).

**Stage 3C rule:** keep every id and every handler above. Restyle and restructure the markup **around** them, and drive them through the same buttons a player presses.

---

## 2. Saved state (localStorage) and network fields

| key | owner | content | Stage 3C |
|---|---|---|---|
| `fb_settings_v1` | `hud.js` | `{ c: HUD colour '' or #hex, s: HUD size .5–2, o: opacity .3–1, keys, coords, title, auto: key-hint fade, vol: 0–1 }` | **keep and migrate** (add reduced motion; old values read as before) |
| `wanderer-appearance` | bundle | `{ hat, texture, hands, main, backpack }` (validated lists; `backpack` ∈ none/canvas/utility) | **migrate `backpack` → `none`** before the bundle reads it; keep the field |
| `wanderer-light` | bundle | `{ kind, color, parts: { kind: {part: #hex} } }` | keep |
| `tfb.lighting.quality` | BR-RoLE | low / medium / high (URL `?lighting=` > remembered > device default: coarse pointer or small screen → LOW) | expose in the new settings |
| `tfb.shadows.quality` | `shadows-2d.js` | — | **not live**: `shadows-2d.js` is not loaded by `index.html`. There is no separate shadow engine setting in the shipped game. BR-RoLE's tier also sets shadow sampling. |
| `adm.*` | `mp.js` admin panel | admin layout | out of scope |

Network: `mp.js` sends the look as one string `lk = hat|texture|hands|main|backpack` (and receives peers' with `parseLook`), plus the device (`ek`, `ec`, `ep`). The wire format keeps five fields. **Stage 3C plan:** keep sending five fields, always `none` for the backpack (the bundle's own look after migration), and resolve any legacy incoming value to `none` in `parseLook`. That is a one-line read-side change in `mp.js`; timing and protocol are unchanged.

---

## 3. Duplicated state and accumulated behaviour

- **Controls reference, twice:** the pause dialog lists 12 rows. `hud.js`'s CONTROLS tab lists 7, without crouch, slide, night vision or zoom.
- **Device descriptions, twice:** the bundle's `Eu` (hidden by `inventory.js`) and `inventory.js`'s `KIND_TEXT` / `CARD_TEXT`. The camcorder text says "Gives off no light at all", which predates the accepted infrared. The accepted rule is: no **visible** light, and its night vision uses infrared.
- **Four ways into customize:** the hidden `#customize`, `hud.js`'s "OPEN CHARACTER EDITOR", the run menu's CUSTOMIZE, and the caught screen's CHANGE LOADOUT.
- **Escape handled in four places:** the bundle (pause toggle, customize close), `hud.js` (dropdown), `inventory.js` (drawer), and the appearance panel's own Tab trap.
- **Quality UI injected by a renderer:** BR-RoLE writes its LIGHTING row into `hud.js`'s DOM on a 0.5 s timer.
- **Sound state, split:** mute is the bundle's (`Z.muted`, label on `#sound`); volume is `hud.js`'s (`window.__vol`).

## 4. Settings that are real today

| control | effect | where |
|---|---|---|
| HUD colour | `--hc`, `body.hudc` | `hud.js` |
| HUD size | `--hs` (scale of `#hud`, `.coordinates`, `.location`; never the camera) | `hud.js` |
| HUD opacity | `--ho` | `hud.js` |
| key hints / fade key hints | `body.hud-nokeys`, `hint-dim` after 14 s | `hud.js` |
| coordinates | `body.hud-nocoords` | `hud.js` |
| level title | `body.hud-notitle` | `hud.js` |
| master volume | `window.__vol`, the master gain | `hud.js` → bundle audio |
| sound on / off | `Z.toggle()` | bundle (`#sound`) |
| lighting quality LOW / MEDIUM / HIGH | BR-RoLE tier: buffer scale, cache sizes, source points. **The same light reaches the same places at every tier** (Stage 3B N7, BR-RoLE header). | BR-RoLE |
| reduced motion | CSS `@media (prefers-reduced-motion)` only (no user control) | stylesheet |

There is no camera or awareness setting, and none will be added (the camera is locked at 1.25 by `camera_policy.js`).

## 5. Baseline problems seen in the parent (screenshots in `dev/stage-3c/evidence/c0/`)

- **Entry screen:** a single panel with lore copy, name and ENTER LEVEL. There is no menu: settings is a header dropdown, customize sits inside settings, and there are no credits.
- **Customize:** a long single column mixing body cosmetics, the **cosmetic backpack**, and the light device and its parts.
- **Mobile (390 × 844, touch):**
  - the header buttons overlap the network badge and the location;
  - the HUD row sits on top of the d-pad and the RUN / CROUCH / LIGHT buttons;
  - keyboard hints are shown on a touch screen;
  - the LIGHT button is cut off at the right edge;
  - there is no way to pause or to open the inventory by touch.
- **Keyboard:** in a running game, Tab inside the pause dialog is swallowed by `inventory.js`'s capture-phase TAB handler (the drawer is refused while paused, but the key is still eaten). Focus cannot move through the pause buttons.
- **Hidden work:** the customize preview is a second Pixi `Application` (`#avatarPreview`, 300 × 150 WebGL). Its ticker renders **every frame for the whole session**, including gameplay, even though the avatar only updates while the panel is open. `inventory.js`'s 2D previews are already gated: their loop stops when the drawer and panel are closed.
- **Fonts:** Barlow Condensed and IBM Plex Mono load from Google Fonts (`@import` in the stylesheet). This sandbox cannot reach Google Fonts, so every screenshot here, parent and Stage 3C alike, is set in fallback faces. The real game loads the real faces.

---

## 6. Stage 3C ownership layer (the smallest clean boundary)

| file | role |
|---|---|
| `assets/ui.js` (new) | **The one UI state controller.** It owns the main menu, navigation, the shared sheet / modal behaviour (open, close, focus trap, Escape, focus return), transitions, reduced motion, the settings UI, the credits UI, and pause / caught / won / run presentation hooks. It watches the bundle's panels (`hidden` attributes) and never re-implements what they do. It is loaded **before** `hud.js` / `inventory.js`, so its capture-phase key handling runs first, but only while one of its own modals is open. |
| `assets/ui.css` (new) | Design tokens and every Stage 3C screen and component. Loaded after the bundle stylesheet. |
| `assets/credits_data.js` (new) | The editable credits. |
| `hud.js` | Becomes the **settings model** only: `fb_settings_v1` read, migrate, apply, save, and the HUD polish it already has (crossfades, stamina state, key-hint fade, location quieting). Its dropdown DOM is retired. |
| `inventory.js` | Keeps the inventory and the loadout cards, parts and previews. Its wording is updated; it is restyled by `ui.css`. |
| `index.html` | Restructured markup around the same ids, plus the three new files. |
| `mp.js` | One read-side line: a legacy backpack in a peer's look resolves to `none`. |
| bundle | **One UI-facing edit, planned for C3:** expose the customize preview's Pixi `Application`, so `ui.js` can stop its ticker while the panel is closed. Nothing else in the bundle changes. |
| untouched | `server.js`, `sim.js`, `ai.js`, `light.js`, `move.js`, `dphys.js`, `world.js`, `camera_policy.js`, `timing_policy.js`, `camcorder.js`, `assets/br-role.js`, `assets/l0-remaster.js`, `assets/level0_visuals.js` |

### UI states (owned by `ui.js`, derived from the bundle's own panels)

```
MENU (#menu shown) ──ENTER LEVEL 0──► PLAYING (#hud shown)
   │  ▲                                  │ Esc / pause button
   │  └──────── END (#runMenu) ◄─NEW RUN─┤
   │                                     ▼
   ├─CUSTOMIZE sheet (#appearancePanel)  PAUSED (#dialog) ─► SETTINGS / CONTROLS / CUSTOMIZE sheets
   ├─SETTINGS sheet                      CAUGHT (#caught) ─► RESPAWN / CHANGE LOADOUT
   └─CREDITS sheet                       WON (#won) ─► RESTART LEVEL 0
```

- **Escape** closes the top sheet; otherwise it does what the parent does (pause / resume, customize close, drawer close).
- **Tab** stays inside an open modal.
- Gameplay keys never reach the world while a field, slider or sheet has focus: the game is paused under every in-run sheet.

### Design-token baseline (the parent's palette, kept as the lineage)

- dark framing: `#101514`, `#130f08d9` (panel scrims), `#0a1413`;
- sickly yellow: `#ebd47e`, `#f3d98a`, `#f3e7a7`, `#e6cf77`;
- cream: `#f4efd5`, `#fff2c3`, `#d7cda9`;
- dirty green-gray: `#9ba99f`, `#b7c49c`, `#8d9e94`, `#b9cb91`;
- restrained red: `#c9503f`, `#ad6d55`;
- lines: `#c4b57866`, `#75807555`;
- type: Barlow Condensed 400–700 (display), IBM Plex Mono 400–500 (text).

Stage 3C keeps this lineage as CSS custom properties in `ui.css`.

## 7. Performance plan

- Gameplay with every menu closed must stay as it was. The UI is event-driven (no per-frame DOM work added). The preview ticker is stopped while hidden (C3).
- The menu animates with CSS transforms and opacity only. There is no second renderer: the accepted world keeps rendering behind the menu, as in the parent.
- Measured at C5, parent vs Stage 3C: gameplay with menus closed, main menu idle, customize idle, settings idle, and a coarse-pointer phone viewport. All on software rendering only; no real-GPU numbers are claimed.

STAGE 3C C0 — AUDIT RECORDED
