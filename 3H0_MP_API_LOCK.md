# Stage 3H0: mp.js public surface (locked)

**Scope.** Everything other code can see or rely on from `mp.js` at the accepted QA2 commit `edd2af9`. That covers:
- the `window.__net` facade;
- the other globals it creates or writes;
- the DOM it creates;
- the listeners and timers it installs;
- its place in the load order.

**The rule for 3H0.** Every row below keeps:
- its name;
- its identity: the same object, created at the same point in `mp.js`'s execution;
- its behavior.

**How it is checked.** Extractions are checked against this list by the client golden traces (`dev/stage-3h0/`, H0-1 onward). Callers were found by searching every shipped file, the game bundle and `dev/`.

## 1. Load order and timing

**index.html loads, in this order:**
1. In the head: `camera_policy.js`, `timing_policy.js`, and the game bundle `assets/index-DKbV5Nv9.js`, which is `type="module"` and therefore **deferred**.
2. At the end of the body, as classic scripts:
   `world.js, move.js, camcorder.js, sfx.js, gore.js, dphys.js, light.js, ents.js, glitch.js, **mp.js**, assets/credits_data.js, assets/ui.js, hud.js, inventory.js, assets/br-role.js, assets/level0_visuals.js, assets/l0-remaster.js`.

**What that means for mp.js:**
- It runs while the document is parsed: after `ents.js` and `glitch.js`, and before the UI scripts.
- It runs **before the game bundle**: a module script runs only after parsing. So while mp.js's top level runs, `window.__api` does not exist yet. Everything that needs the game reads `window.__api` lazily, at call time.
- Its top level, in order:
  1. creates the `#net` badge;
  2. reads `?room=`;
  3. sets up its state, `window.__hounds` and `window.__net`;
  4. **opens the WebSocket** (`connect()`, line 113);
  5. then the interpolation globals, the audio listeners, the admin panel and the rest;
  6. lastly `window.__mp`.

There is no ES module, no `import` and no build step. 3H0 keeps it that way.

## 2. `window.__net` (the facade object `N`)

| Member | Kind | What it does | Callers |
|---|---|---|---|
| `on` | boolean | `true` once a snapshot with entities has arrived; `false` again on close | bundle (3 sites: its fixed-step loop chooses the server or the local AI; drawing) |
| `tick()` | function | called from the bundle's fixed step while online; starts our death sequence when the server says we were caught (`mseq > handled`); picks the killer slot (`__kill`, `__killer`) | bundle |
| `join()` | function | a new run: clears the exit flag, a 4 s spawn grace, `__kill = null`, `__glitchSolo = false` (and, offline, the solo glitches and items); sends `join`; applies the bodies 80 ms later | bundle (`Su`, the run start) |
| `respawn()` | function | marks the death handled, a 4 s grace, `__kill = null`; sends `respawn` | bundle (RETRY) |
| `leave()` | function | sends `leave` | bundle (END and menu returns; 2 sites) |
| `testAuth(pass)` | function | keeps `pass` in `N._auth` and sends a quiet admin unlock; it is sent again on every reconnect | dev tests (17 files, e.g. `dev/tests/*.py`, `dev/shadows/harness_lib.js`, `dev/stage-3c/ui_lib.js`, the QA2 regression) |
| `fx(m)` | function | replays someone's death or vanish (`startFx`) | none found (kept) |
| `deathStart(d)` | function | sends the death `fx` (look, gear, kill geometry) | bundle |
| `vanish(d)` | function | sends the vanish `fx` | bundle (NEW RUN) |
| `bodyMade(t)` | function | sends our finished corpse (`b`) | bundle |
| `exitLocal()` | function (added at line 220) | offline glitch exit with the local run time | mp.js itself (solo glitches) |
| `t0` | number (written by the solo glitches) | offline run start time | mp.js itself |
| `peerScreen()` | function (line 437) | the other wanderers' screen positions and looks | none found in the repository (kept) |
| `testHum(freqs)` | async function (line 783) | renders the synthesized hum offline and measures given frequencies | none found in the repository (kept) |
| `_auth` | string (written by `testAuth`) | the test passcode, kept for reconnects | mp.js itself |

**`__net.collected(i)`** is called by the bundle when the player walks onto an entry of its `el` collectibles list. mp.js does **not** define it, so such a call would throw.
- It cannot happen today: `el` is a constant empty array in the bundle (never filled, checked in H0-0), so `rl()` always returns null.
- This is recorded, not changed.

## 3. Other globals mp.js creates or writes

| Global | Created / written | Read by |
|---|---|---|
| `window.__hounds` | the 64 Hound render slots (`hSlots`), at load | bundle (3), dev tests |
| `window.__netPose` | `netPose(key)`: the interpolated entity pose, at load (line 163) | dev `tests/interp_test.js` (extracts the code by text) |
| `window.__NET` | the interpolation state `{off, hist, DELAY, lastSt, epoch, onEpoch}`, at load (line 163) | none found |
| `window.__kill` | the server's kill record + `at` + `slot` (`announceKill`); cleared by `join`/`respawn`/close | bundle (4), dev `admin_test.py` |
| `window.__killer` | the Hound slot replaced by the attack animation (`tick`) | bundle |
| `window.__glitches`, `window.__items` | from snapshots (`gw`, `it`), or the solo fallbacks; cleared on close and offline join | `glitch.js`, mp.js |
| `window.__glitchSolo`, `window.__itemSolo` | solo fallback flags | mp.js |
| `window.__fxs` | the array of running death and vanish replays | dev `admin_test.py` |
| `window.__hideBodies`, `window.__fxKill`, `window.__fxKillS` | sets: corpses hidden during a replay, and the monster slots hidden while their attack replays | bundle (2 each) |
| `window.__peerLights` | every frame: the other wanderers' lights and lit dropped lights | `light.js`, `camcorder.js`, `assets/br-role.js`, `assets/shadows-2d.js`, bundle, dev tests |
| `window.__dlab` | created lazily by the admin death lab (`DL()`) | `dphys.js`, `ents.js`, bundle, dev tests |
| `window.__mp` | the per-frame hook `({p, cam, sc, run, started, light, G, q, los, t})` | bundle (calls it every frame); `assets/shadows-2d.js` would wrap it, but index.html no longer loads that file |
| `__ents.onFail` | set at load when `__ents` exists: a failing lamp is voiced | `ents.js` |
| `__api.H.id`, `__api.G.*`, `__api.q[i].*`, `__api.V.blackout` | written while mirroring the server's state | the bundle (its own objects) |
| `__mv.down`, `__mv.dragTo` | capture phases (`applyCaught`), cleared offline and on close | `move.js` |
| `__ents.dbgCfg`, `__ents.navSel`, `__ents.dbgX.ping` | the admin debug overlay settings, selection and ping | `ents.js` |

**Read but not owned:**
- `window.__api` (the bundle; about 40 members, listed in the ownership map), `window.__ents` (ents.js), `window.__mv` (move.js);
- `window.__cam` (camcorder.js; only `irNet` is read), `window.__sfx` (sfx.js), `window.__inv` (inventory.js);
- `window.__glitchSound`, `window.__glitchFrame` (glitch.js), `window.WORLD` (world.js: `SN`, `CRAWL`).

## 4. DOM

**Created by mp.js and appended to `body`:**
- `#net` (the SOLO / ONLINE badge), `#peerTip`;
- `#adminPanel` (with `#admWho #admLogin #admPass #admErr #admMain #admTabs #admBody #admBroadcast #admText #admStatus`), `#adminMsg`, `#kicked`;
- `style#admStyle2` (in `head`), and `p#onlineNote` (inserted before `#dialog .lore-credit` when that exists).

**Read:**
- at load: `#mp` (canvas, 2D context), `#dread`, `#game`, `#light`;
- later: `#kicked`, `#wonStats`, `#sound` (its text says whether sound is on), `#nameplate`, `#onlineNote`.

**Writes:**
- `body.gl-out` (glitch exit);
- the `#dread` opacity, the `#game` transform and the `#light` opacity (dread effects, every frame);
- the `#mp` canvas (size and clear, every frame; the admin debug overlay).

## 5. Listeners and timers installed at load

- **On `window`:**
  - `pointerdown` and `keydown`: create the dread AudioContext, once;
  - `pointermove`: the mouse position for hover names;
  - `keydown`: Backquote toggles the admin panel, unless typing in an input.
- **On the panel:** `click` and `keydown`.
- **A `MutationObserver` on `body`'s class:** a noise burst when it gains `captured`.
- **Intervals:** 2000 ms (the avatar sweep), 1000 ms (ping while admin debug is on), 1000 ms (the admin status line).
- **Timeouts, when triggered:**
  - reconnect after `min(8000, 1000 * attempts)` ms (none after a kick);
  - bodies 80 ms after a join;
  - the banner hides after 8 s;
  - the second heartbeat thump after 140 ms;
  - the win screen 950 ms after a glitch exit;
  - the admin passcode field focus.

## 6. localStorage

Admin panel preferences only: `adm.tab`, `adm.side`, `adm.lay`, `adm.opts`. Every access is wrapped in try/catch.

## 7. What 3H0 may add (and has to document here)

Only what an approved extraction needs: a classic script under `assets/` loaded immediately before `mp.js`, and one namespace object for the extracted helpers. Each addition is listed here at the checkpoint that makes it, with its equivalence receipt.

`window.__net`, the globals above, the DOM, the listeners and timers and the WebSocket URL stay exactly as listed.
