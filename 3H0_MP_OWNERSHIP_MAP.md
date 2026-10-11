# Stage 3H0: mp.js ownership map

**What it covers.** Who owns what inside `mp.js`, and what each part reads, writes and touches. This is the "before" map, at the accepted QA2 commit `edd2af9`: 72,790 bytes, 841 lines, one classic IIFE.

**What it is for.** Every 3H0 extraction is chosen from this table and recorded against it. Section 5 is filled in as checkpoints land.

## 1. Sections (line ranges at `edd2af9`)

| Lines | Bytes | Responsibility | Key names | Module-level state it owns |
|---|---:|---|---|---|
| 1-24 | 1,818 | bootstrap: DOM refs, the `#net` badge, room name, connection and run state, entity slots | `cv cx dread game light net room` | `ws retry myId lastSend everConnected snap me mseq handled peersN kicked exited bodiesList hMap hSlots sSlot cpNow killSeq graceUntil adm peers` |
| 25-53 | 3,466 | the `window.__net` facade, the death/vanish/body packet builders, and `tx` | `N kaOf fxBase tx` | (uses the above) |
| 55-113 | 4,027 | transport: `connect()`; open/message/close handlers; reconnect back-off | `connect` | `ws retry everConnected kicked` |
| 115-127 | 851 | kill announcement, entity sounds and failing lamps | `angDiff announceKill entitySignals` | `__kill` |
| 128-164 | 3,386 | snapshot interpolation: server clock offset, per-entity pose history, epoch reset | `NET netReset netHist angD2 netPose` | `NET` (exposed as `__NET`, `__netPose`) |
| 165-197 | 1,864 | applying the server's state to the game: Hound slots, the `G` mirror, Smiler slots, blackout, glitches and items | `applyServerState` | `hMap hSlots sSlot` |
| 198-211 | 678 | capture phases → `move.js` (down / crawl / drag) and their sounds | `applyCaught` | `cpPrev hitFlash` |
| 212-237 | 1,730 | glitched-wall exit; the offline glitch fallback | `doExit soloGlitches N.exitLocal` | `exited`, `__glitchSolo` |
| 239-262 | 1,303 | the cartograph: pickup, online and offline | `giveItem itemsFrame soloItem` | `lastPick`, `__itemSolo` |
| 264-271 | 982 | everyone's corpses: server record → game record | `hasBody toRec applyBodies` | (reads `bodiesList`) |
| 273-301 | 1,559 | the dread audio: drone, heartbeat thump, noise burst on capture | `initAudio thump burst soundOn` | `ac drone dg beatT` |
| 303-309 | 342 | the "online: pausing does not stop the halls" note | | |
| 312-323 | 1,323 | the hover tooltip; the look and gear wire codecs; avatar disposal and its sweep | `tip partList partObj parseLook dropAvatar` | `mx my view` |
| 325-373 | 4,128 | other players' death and vanish replays | `fxs fxActive killFx startFx updateFx sm` | `fxs` (`__fxs`), `__hideBodies __fxKill __fxKillS` |
| 375-392 | 1,313 | a peer's movement pose from the wire; lights left by corpses | `SNAMES peerMv bodyLights` | (per-peer fields) |
| 393-438 | 3,630 | drawing peers: avatars, falling-in, lights, hover; `peerScreen` | `drawPeers N.peerScreen` | `view`, `__peerLights` |
| 442-682 | 28,418 | the admin panel: tabs, death lab, spot finder, command buttons, ping, report | `esc LS TABS panel banner kickedBox body* DL labSet findSpot render* unlock sendMsg applyDbg copyText report previewTick` | `adm.*`, `liveMap msgTimer`, `__dlab` |
| 684-788 | 7,928 | the synthesized fluorescent hum; `testHum` | `smooth buildHum humPop humThunk humTink humUpdate N.testHum` | `hum prevBo holdUntil nextPopT nextDip dipEnd lastFlick` |
| 790-841 | 4,029 | the per-frame hook `__mp`: resize, pause/kill bridge, apply state, solo fallbacks, items, hum, glitches, **send `p`**, draw peers, dread effects | `window.__mp` | `k stingCd` |

**What dominates the file.** The admin panel is 39 % of it (28.4 KB) and the hum 11 % (7.9 KB). The network core (facade, transport, interpolation, state application) is about 13.6 KB.

## 2. How the parts are coupled (who reads whose state)

- **The transport handlers touch nearly every part's state.** `ws.onmessage` writes:
  - `myId`;
  - `adm.*`, then renders the panel;
  - `kicked`;
  - `bodiesList`, then `applyBodies`;
  - the `fxs` replays;
  - the exit;
  - items;
  - `peers`, `peersN`, `me`, `mseq`, `cpNow`, `killSeq`;
  - `snap`, `N.on`;
  - the interpolation history;
  - the `__ents` debug state.

  `ws.onclose` resets the replays, peers, slots, `__glitches/__items/__peerLights/__kill`, the `__ents` debug state, `__mv`, and the admin state, then reconnects. `ws.onopen` resets the timeline and the death counters, re-joins, and re-authenticates the admin (`adm.pass`, `N._auth`).
- **The admin panel shares `adm` with the transport.** The transport reads `adm.pass`, `adm.rv` and `adm.opts`, and writes `adm.res` and `adm.data`. The panel also reads `ws.readyState`, `room` and `myId`, and calls `tx`, `giveItem` and `findSpot`. `previewTick` runs every frame from `__mp`.
- **Replays and peers are tied together.**
  - `startFx` reads `hMap`, `__api.q` and `bodiesList`.
  - `drawPeers` reads `fxActive` and `hasBody`.
  - `updateFx` writes the `__fxKill` sets the bundle reads.
- **Interpolation** is called from the transport (`netReset`, `netHist`) and from state application (`netPose`). Its epoch hook clears the entity slots owned by state application.
- **The codecs** (`parseLook`, `partObj`, `partList`, `toRec`) only read `window.__api.gear` at call time. They are called by the packet builders, `toRec`/`applyBodies`, `startFx` and `drawPeers`.
- **The hum** reads `window.__api` (audio, lamps, blackout, player) and `window.__sfx`. It is called once per frame from `__mp`, and is otherwise independent.
- **The dread audio and effects** read the proximity computed in `__mp`, and the body class `captured`.

## 3. Side effects by kind

- **Network:**
  - `tx` (every message except `p`);
  - `ws.send` (`p`, in `__mp`);
  - `new WebSocket` (`connect`).
- **Timers and listeners:** listed in `3H0_MP_API_LOCK.md` section 5.
- **Game objects** (through `window.__api`):
  - `tp`, `revive`, `bodies`, `win`, `unpause`;
  - `mkAvatar` / `Jl` / `Gl` / `Wl` objects added to `layer()` and `floor()`;
  - direct writes to `H.id`, `G.*`, `q[i].*` and `V.blackout`.
- **Audio:**
  - the dread AudioContext (its own);
  - the hum on the game's AudioContext (`__api.audio()`);
  - `__sfx.play` / `loop`.
- **DOM:** listed in `3H0_MP_API_LOCK.md` section 4.
- **Randomness:** `Math.random()` is used by the solo glitches and item, the hum, the noise buffers, and the dread shake, flicker and sting. Moving code that draws random numbers would change the order of draws. The extractions chosen in 3H0 draw none.

## 4. Candidate seams (H0-0 judgement; each one is still an independent GO/NO-GO at its own checkpoint)

| Seam | Tier | What would move | Coupling that has to be kept | Existing tests that read mp.js text | H0-0 judgement |
|---|---|---|---|---|---|
| **C2: look/gear/body wire codec** | A | `parseLook`, `partObj`, `partList`, `toRec` (and possibly the `lk` look-string encoder written inline three times) | reads `window.__api.gear` lazily; used by the packet builders, `applyBodies`, `startFx`, `drawPeers` | none | **candidate for H0-2.** Pure field mapping, no state, no randomness, no timers. Needs one new classic script under `assets/` before `mp.js`, and a namespace for it. |
| **C3: snapshot interpolation** | A | `NET`, `netReset`, `netHist`, `angD2`, `netPose` | `NET` must stay one object, exposed as `__NET`; `__netPose` is assigned at the same moment (line 163, by mp.js); `NET.onEpoch` set by mp.js; reads `performance.now()` at call time | `dev/tests/interp_test.js` slices mp.js between `const NET = {` and `window.__netPose`. It would have to read the new file instead (same code, same numbers). | **candidate for H0-3**, only after H0-2 proves the loading path. |
| C4: transport | B | `connect` and its three handlers | the handlers write state owned by almost every section (above) | none | **NO-GO for 3H0.** It cannot move without either a new shared-state object or callbacks into every section: a rewrite of the dispatch, not an extraction. Deferred to full 3H. |
| C5a: admin panel | B | lines 442-682 (28 KB) | `adm` is shared with the transport; it needs `tx`, `ws`, `room`, `myId`, `giveItem`, `__api`, `__ents`; `previewTick` runs per frame; `toggleAdmin` hangs off a window keydown | `s_humanqa_hotfix.js` X02 asserts `data-n="10"` is in mp.js | **Deferred to full 3H.** It is the largest win in size, but it is a stateful UI tied to the transport and to admin security behavior. Plan in `3H0_DEFERRED_FULL_3H.md` (H0-5). |
| C5b: death/vanish replays + bodies presentation | B | lines 325-373, 264-271, 384-392 | `hMap`, `__api.q`, `bodiesList`; `drawPeers` reads `fxActive`/`hasBody`; the bundle reads `__fxKill*`/`__hideBodies` | `s_humanqa_hotfix.js` X03 asserts the DEAD hover text in mp.js | **Deferred** to 3D (Gore & Death 2.0) / full 3H, with a written seam plan. |
| C5c: peers presentation | B | lines 375-438 | `peers` written by the transport; `fxActive`, `hasBody`, `view`, `mx/my` | X03 (above) | **Deferred.** |
| Hum / dread audio | B | lines 684-788, 273-301 | `Math.random()` draw order; per-frame `humUpdate`; `N.testHum`; shares the game's AudioContext | none | **Deferred** to 3F (Atmosphere/Audio): self-contained, but audio, and the brief says to leave it unless provably low risk. |

## 5. After 3H0 (filled in at each checkpoint)

| Checkpoint | Moved | New file | mp.js bytes / lines | Equivalence receipt |
|---|---|---|---|---|
| (H0-0) | nothing | | 72,790 / 841 | |
