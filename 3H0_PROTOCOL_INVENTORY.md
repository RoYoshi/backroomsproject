# Stage 3H0: wire protocol inventory (frozen)

This document records what crosses the wire between `mp.js` (the browser) and `server.js` (Node) at the accepted Stage 3C QA2 commit `edd2af9` (tree `108d89f`). It was derived from the code, not from older notes. Stage 3H0 changes none of it.

**What "frozen" means here:**
- No new message type, no renamed key, no new required field, no reordering, no compression, no rate change.
- Every extraction in 3H0 must produce the same bytes for the same inputs. That is checked by the golden traces in `dev/stage-3h0/` (H0-1 onward).

**The read-only contract:** `dev/stage-3h0/protocol_contract.json` maps the compact keys to these descriptions, and the trace tests check observed packets against it. The game never loads it. (It is written at H0-1, together with the tests that use it.)

The facts below are as the code stands at QA2; line numbers refer to that commit.

## 1. Transport

**Endpoint.** The WebSocket endpoint is `ws(s)://<host>/ws?room=NAME`.
- **Client side** (`mp.js` 55-57):
  - `wss:` when the page is `https:`, `ws:` otherwise;
  - `NAME` is `encodeURIComponent` of the page's own `?room=` value, or `main`;
  - no WebSocket at all when the page is opened from `file:`.
- **Server side** (`server.js` 208-213):
  - `NAME` is cut to 24 characters, then everything outside `[A-Za-z0-9_-]` is removed;
  - an empty result is `main`;
  - any path other than `/ws`, or a missing `Sec-WebSocket-Key`, is answered with `sock.destroy()` (no HTTP response at all).

**Room capacity.** There are at most 8 sockets per room (`MAX_ROOM`). A ninth upgrade is also `sock.destroy()`. Menu visitors count, because every open tab holds a socket.

**Handshake (server → client), exactly:**

    HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: <base64 sha1(key + GUID)>\r\n\r\n

- There is no `Sec-WebSocket-Protocol`, no extension negotiation and no `Origin` check.
- The handshake is followed by `setNoDelay(true)` and then the first frame, `hi`.

**Server → client frames** (`frame()`, 129-133):
- **Text frames are always unfragmented:** `0x81`, then the length.
  - Under 126 bytes, the length is one byte.
  - Under 65,536 bytes, it is `126` followed by a 16-bit big-endian length.
  - A payload of 65,536 bytes or more makes `frame()` return `null`, and `send()` then **silently sends nothing**. That is current behavior, recorded here, not changed.
- **`send()` writes only while the socket is not `destroyed`.**
- **Other frames:**
  - pong is `0x8a 0x00` (any ping payload is not echoed);
  - close is `0x88 0x00`, sent only to a kicked client, 150 ms after its `kick` message, followed by `sock.end()`.

**Client → server frames** (the data handler, 292-306). These semantics are preserved exactly, including the odd ones:
- **Buffering.** Incoming bytes are appended to a per-connection buffer, and complete frames are taken from the front in a loop.
- **The opcode is `byte0 & 15`.** The FIN bit and RSV bits are ignored. A non-final text frame is parsed as if it were complete, and continuation frames (opcode 0) are ignored.
- **Length:**
  - under 126 bytes, it is the 7-bit value;
  - for `126`, it waits until 4 bytes are buffered, then reads a 16-bit length;
  - for `127` (64-bit lengths), the socket is destroyed at once.
- **Masking.** Four mask bytes are always read and applied, whether or not the MASK bit is set. An unmasked frame is therefore mis-read, and normally ends as unparseable JSON, which is ignored.
- **Incomplete frames.** The handler waits for more data; nothing is consumed.
- **By opcode:**
  - opcode 8 (close): `sock.end()`, and the rest of the buffer is abandoned;
  - opcode 9 (ping): writes `0x8a 0x00` and continues;
  - opcode 1 (text) with a payload under 1,400 bytes: `JSON.parse`, then the message handler, all inside one `try { } catch { }`. Bad JSON and any exception thrown while handling the message are both silently ignored.
  - Text of 1,400 bytes or more, and opcodes 0, 2 and 10-15, are consumed and ignored.
- **Close and error.** Both run the same cleanup once (`bye`), described under lifecycle below.

## 2. Client → server messages
Producer: `mp.js`. Consumer: `onMessage` in `server.js` (225-290).
- Messages whose `t` is unknown are ignored.
- JSON numbers go through `num(v, lo, hi)`, which is `Math.max(lo, Math.min(hi, +v || 0))`.

| `t` | Sent by (mp.js) | When / rate | Fields, in wire order | Server handling |
|---|---|---|---|---|
| `p` | the per-frame hook `window.__mp` (808-822) | at most once per frame, while the socket is open: every 50 ms in a run (`started`), every 250 ms in the menu | `x, y, vx, vy` rounded; `a` angle (2 decimals); `r` sprint 0/1; `l` light 0/1; `ir` (`__cam.irNet`, or 0 without `__cam`); `k` equipment kind; `lp` light parts as `c1,c2,c3` (`''` without the game API); `n` the `#nameplate` text cut to 20 (default `WANDERER`); `c` light colour; `f` fall-in progress (2 decimals, or -1); `lk` the look `hat\|texture\|hands\|main\|backpack`; `mv` (`__mv.net()`, only while `started`). `undefined` values are left out by `JSON.stringify` (`k`, `c`, `lk`, `mv`), and a `NaN` becomes `null`. | `mv` goes to `sim.hearMove` first, even when the position is throttled. The position is throttled at 30 ms; a non-finite `x`/`y` gives `gaitFloor` only. Note that `isFinite(null)` is true, so `null` reaches `num()` and becomes 0. Position: dead players are ignored; admins are accepted unchecked; menu (inactive) players are stored unchecked; the first packet after a join or respawn is a spawn check; everything else goes to `mvCheck` (budget, walls, `tp` correction). Then `vx, vy` (only if the move was accepted), `angle = +a \|\| 0`, `sprinting = !!r`, `raised = l !== 0` (so a missing `l` counts as raised), `light = raised`, `ir` on the connection only (raised camcorder, 0-2), `equipment.kind = kindOf(k)`, `name`, colour if `#rrggbb`, look if valid, `lp` cleaned, fall 0..1 or -1. |
| `join` | `__net.join()` (the bundle's run start); also `ws.onopen` when `__api.started()` (a reconnect during a run) | once per ENTER, and once per reconnect during a run | `{t}` | `sim.join(player, Date.now()/1000)`. If true: reset the movement check, and the next `p` is the spawn. If refused: `tp` to the rounded current position. |
| `respawn` | `__net.respawn()` (the bundle's RETRY) | once per retry | `{t}` | `sim.respawn`. If true, as for a join. If refused: `respawnRefused++`, and `tp` to the rounded position. |
| `leave` | `__net.leave()` (the bundle's END / menu) | once per return | `{t}` | `sim.leave(player, Date.now()/1000)`. A refusal only counts (`leaveRefused`). There is never a reply. |
| `fx` (death) | `__net.deathStart(d)` (the bundle, at a local death) | once per death | `lk, ek, ec, ep` (from `fxBase`), **then** `t, k:'death', c, x, y, a` (3 decimals), `sx, sy, vx, vy, ex, v, w` (`[x, y, ang]` or 0). `t` is not the first key, because the facade uses `Object.assign(fxBase(A), {...})`. | Dropped when the sender is not active, when it is within 1.5 s of its previous fx, when it is a death the server has not recorded, or when the server has already replayed this death itself. Otherwise a sanitized `fx` is relayed to **every other client in the room**, menu visitors included. |
| `fx` (vanish) | `__net.vanish(d)` (the bundle's NEW RUN) | once per NEW RUN | `lk, ek, ec, ep, t, k:'vanish', x, y, a` | As above, plus `sim.vanish`: only while alive, at most once every 30 s (`VANISH_CD`). A refused vanish is dropped silently. |
| `b` | `__net.bodyMade(t)` (the bundle, when the local corpse is finished) | once per corpse | `n, x, y, a, sx, sy, c, aa, lk, ek, ec, ep, lo, bl, dr, ht, hd, tr, ho, ph, ka` | Dropped unless the sender is dead or `c` is `Vanish`. A Hound `ka` moves the killer (`sim.killerEnd`). The server's fallback is cancelled. The cleaned record goes to `sim.setBody`: `bl` at most 6 entries, `tr` at most 24, `hd` exactly 4 values or 0, coordinates clamped. |
| `pick` | `itemsFrame` while online, over a cartograph not yet carried | at most every 700 ms | `{t}` | Only active and alive players; on success, `got`. |
| `admin` | the admin panel's UNLOCK; `ws.onopen` (re-sends a kept passcode); `__net.testAuth(pass)` and `ws.onopen` for a test passcode | per attempt | `pass`; `quiet: 1` for test unlocks | A lockout per client address: 5 wrong guesses give 60 s. During a lockout: `{t:'admin', ok:false, wait}`. The passcode is compared as a SHA-256 with `timingSafeEqual`. |
| `a` | admin panel buttons; `previewTick` (auto-revive); the replay button | per click | `c`, plus optionally `id, eid, v, mode, k, var, on, n, cmd`, or `text` for `msg` | Ignored unless this connection is admin. Then `adminCommand`: `kick revive god bring goto freeze speed blackout hounds smilers glitch item monsters debug near summon preview capmode entgoto nav entdel world msg`; anything else does nothing. Most commands answer with `ares`. |
| `ping` | a 1 s interval, only while admin debug mode is on and unlocked | 1 per second | `ts` (`performance.now()`) | `pong` with `ts: +m.ts \|\| 0`, at most every 400 ms. |

The **`p` and `mv` contents** are owned by the bundle and `move.js`. `__mv.net()` returns the movement report that `sim.hearMove` reads:
- `s` state 0-7;
- `sp` speed;
- `st` stamina;
- `ex` exhausted;
- `ev` up to 6 discrete noises.

## 3. Server → client messages
Producer: `server.js`, plus `death_srv.js` for the fallback `fx`. Consumer: `ws.onmessage` in `mp.js` (65-102).
- Messages that do not parse are ignored.
- Every message type below is handled.

| `t` | Sent when | Fields, in wire order | Client handling |
|---|---|---|---|
| `hi` | the first frame after the handshake | `id, sim: 1` | `myId = id`; `__api.H.id = id` if the game API exists. |
| `s` | every 2nd 25 ms wake (about 20 Hz), to every client in the room, menu visitors included | `p` (peers: active players except the receiver), `e` (`sim.entities()`), `me` (the receiver's death cause, or `''`), `ms` (death sequence), `cp` (capture info or 0); then `mk` (kill record), only when dead with a kill; `ad` + `you` for admins every 8th wake; `dbg` + `dx {lg, pf}` for admins with debug on, every 6th wake | Peers are merged by id. A peer that jumps more than 400 px is snapped, not glided. Missing peers are dropped. Then `me, ms, cp`; `mk` announces the kill once per `ms`; `e` updates the snapshot, `N.on = true`, entity sounds and fails, and the interpolation history; `dbg`/`dx` go to `__ents`; `ad` goes to the admin panel. |
| `tp` | movement correction (rounded); join or respawn refused (rounded); server-side moves (`moveTo`: spawn tools, admin bring/goto/glitch/item/entgoto, not rounded); admin `world` (each active client, not rounded) | `x, y` | `__api.tp(x, y)` |
| `bodies` | at a snapshot tick, to each client whose last seen body version differs | `v` (`sim.bodyVer`), `b` (every corpse record) | The list is replaced; `__api.bodies(list.map(toRec))`. |
| `fx` | a relayed client `fx` (to everyone but the sender); or the server's own replay for a victim that did not send one within 1.5 s or has gone | relay: `t, k, id, c, x, y, a, sx, sy, v, w, lk, ek, ec, ep, vx, vy, ex`; server replay (`death_srv.fxFor`): the same plus `srv: 1` | `startFx`: a death or vanish replay, unless it is our own id. |
| `exit` | at a snapshot tick after the player touched a glitched wall | `secs` | `doExit`: the glitch exit and the win screen. |
| `got` | after an accepted `pick` | `item` | `__inv.give(item, true)` |
| `revive` | admin `revive` (to the target) | (none) | `__api.revive()` |
| `kick` | admin `kick` (to the target); then a close frame after 150 ms | (none) | `kicked = true`; `#kicked` is shown; no reconnect. |
| `msg` | admin broadcast, to every client in the room | `text` (trimmed, at most 140), `from` | A banner for 8 s. |
| `ares` | the answer to most admin commands | `ok, msg` (at most 90 characters) | The panel's status line; ends a death preview if the answer is not ok. |
| `admin` | the answer to an `admin` attempt | success: `ok: true, q: 0/1`; failure: `ok: false, wait` (seconds, or 0) | A quiet success is ignored. Otherwise the panel is unlocked, or shows the error, and a rejected passcode is forgotten. |
| `pong` | the answer to `ping` | `ts` | Round-trip time, smoothed into `__ents.dbgX.ping`. |

### The `s` snapshot in detail

**Peers.** One peer entry, in order:
- `id`;
- `x, y` (rounded);
- `a` (2 decimals);
- `n` name, `c` colour;
- `d` dead 0/1, `r` sprint;
- `k` kind, `l` raised 0/1, `ir` 0-2;
- `lk` look, `lp` parts;
- `f` fall (or -1);
- `mv: [state, speed, stamina, exhausted]`.

**Entities.** `e` is `sim.entities()`: `st` (server clock, 3 decimals), `h` (hounds), `m` (smilers), `b` (blackout 0/1), `p` (pressure), `gw` (glitched walls `[x, y, nx, ny]`), `it` (items `[x, y, id]`), `lf` (failing lamps), `sn` (the last 24 entity sounds).
- `sim.entities()` **drains the entity sound queue**, so it must be called exactly once per snapshot tick, as it is now.
- Hound entries (`ai.js` `HOUND.snap`): `i, x, y, a, s, ac, v, h, lh, l, tg, cp, k`.
- Smiler entries (`SMILER.snap`): `i, x, y, a, s, ac, v, f, h, lh, tg, cp, lt, sp`.

**Admin and debug.** `ad` is `sim.admin.info()` plus `pl` (every client: `id, n, a, d, g, ad, st, x, y`). The debug `dx.pf` holds `ms, mx, kb, se, pa, pl`.

## 4. Cadence and authority (server.js 317-366)
- **One `setInterval` of 25 ms (`TICK_MS`) drives every room.** Each wake:
  1. adds `dt = min(0.25 s, real elapsed)` to the room's accumulator;
  2. runs `sim.step(1/60)` while the accumulator holds a full step, at most 15 steps per wake.

  So the simulation runs at a fixed 60 Hz; the 25 ms wake is only the scheduler.
- **Snapshots go out on every 2nd wake (`SNAP_EVERY`, about 20 Hz).** Admin data rides on every 8th wake, debug data on every 6th.
- **Order within a snapshot wake:**
  1. record the aftermath for any newly dead client;
  2. advance the aftermaths (`aftTick`);
  3. call `entities()` once;
  4. build the peer list;
  5. per client, in connection order: `exit`, then `bodies`, then `s`.
- **The step-time statistic.** It divides by one more than the number of steps when the 15-step cap ends a wake. This only affects the admin debug number and is recorded as is.
- **Authority:**
  - Player positions are simulated by the client and validated by the server: a movement budget, wall checks, the spawn check, the 0.9 s grace after a server-side move.
  - The server decides deaths, captures, bodies, entities, blackouts, glitches, items and the room's lifecycle (`sim.js`).

## 5. Lifecycle (server.js 218-223, 307-314; sim.js)
- **On connect:** a new id (a process-wide counter) and `sim.addPlayer(id)`, which creates an **inactive** player; then `hi`.
  - An inactive player is never in anyone's peer list.
  - The AI cannot see an inactive player.
  - It still receives `s` snapshots, `fx` relays and admin broadcasts.
- **The life states** (`sim.lifeOf`) are `menu` (inactive), `alive`, `held` (caught) and `dead`. `join`, `respawn`, `leave` and `vanish` follow sim.js's rules:
  - **join:** only from the menu or after a finished vanish;
  - **respawn:** only when dead or admin-revived;
  - **leave:** only when dead, or at the end of a finished vanish; never while held;
  - **vanish:** only while alive, at most once every 30 s.
- **On close or error (`bye`, once):**
  1. a player who is held but not dead forfeits the capture (a death, with its aftermath);
  2. the client is removed and `sim.removePlayer` is called;
  3. **an empty room is deleted, with its whole world.**
- **A reconnect is a new id and a new player.** On every `ws.onopen` the client resets its timeline (`netReset`) and re-joins if a run was in progress.

## 6. Death aftermath (server.js 94-126)
When the simulation commits a death, the server keeps an aftermath record: the kill, plus the victim's name, look, gear, velocity and light.
- **If the victim's client has not sent its own `fx` within 1.5 s, or has gone,** the server sends `death_srv.fxFor(...)` to everyone else.
- **If no corpse (`b`) has come by the death's duration,** the server builds one with the same physics (`death_srv.bodyFor` with dphys.js), calls `sim.setBody`, and logs it. The deadline is the duration plus 8 s while the victim is connected, or plus 0.6 s once it has gone.
- **Bodies are keyed by player id,** so a late client corpse replaces the server's: never two.

## 7. HTTP (server.js 22-53)
- **The URL path is `decodeURIComponent`-ed, without the query.**
  - A malformed escape gives `400 Bad request` (text/plain).
  - So does a NUL byte.
  - `/` is `/index.html`.
- **`/sounds` and `/sounds/`:** a JSON list of the audio files in `./sounds`, `no-store`.
- **`/sounds/<name>`:** a name matching `[\w.\- ]+` with an audio extension is served with its audio MIME type, `public, max-age=300` and a `Content-Length`. If missing, 404.
- **Everything else must match `SERVE` exactly:**
  - the listed root scripts (`index.html, camera_policy.js, timing_policy.js, world.js, move.js, ents.js, mp.js, hud.js, gore.js, dphys.js, light.js, glitch.js, camcorder.js, inventory.js, sfx.js`);
  - or `assets/` plus one name made of `[\w.\-]`, with no sub-folders.

  Anything else is `404 Not found`: `server.js`, `sim.js`, `ai.js`, `death_srv.js`, `package.json`, `dev/`, `redirect.js`, Markdown, dot-files and any traversal.
- **MIME types:** `.html .js .css .png` map to their types; any other extension is `application/octet-stream`. That includes the theme's `.wav` and `.webmanifest`.
- **Caching:** `.png` is `public, max-age=86400`; everything else is `no-store`.
- **Compression:** when `Accept-Encoding` contains `gzip`, everything but `.png` is gzipped at level 9 (`Content-Encoding: gzip`). The compressed copy is cached in memory per file for the life of the process.
- **`Vary: Accept-Encoding`** is set on every allowlisted file.
- **The HTTP method is not checked.**
