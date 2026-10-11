# Stage 3H0: architecture map (before and after)

**What this covers.** How the multiplayer layer is organized after Stage 3H0, compared with the accepted QA2 parent `edd2af9`:
- the two files 3H0 worked on, `mp.js` (browser) and `server.js` (Node);
- the five small files cut out of them;
- where to make a change now, and how to check it.

**What did not change.** Nothing a player, a browser or a server operator can observe. These are as they were:
- the protocol and the facade `window.__net`;
- the load order of everything that was there before;
- `node server.js [port]` and the timing;
- every server response, apart from the new content of the two changed files themselves (`index.html`, `mp.js`) and the two new scripts it now serves.

The evidence is in `3H0_EQUIVALENCE_REPORT.md`.

## 1. Module sizes

| File | At `edd2af9` | After 3H0 | Change |
|---|---:|---:|---|
| `mp.js` | 72,790 B / 841 lines | 68,139 B / 799 lines | −4,651 B |
| `assets/net-wire.js` | — | 2,691 B / 24 lines | new (H0-2) |
| `assets/net-interp.js` | — | 4,163 B / 46 lines | new (H0-3) |
| `index.html` | | +2 lines | one `<script>` per new client file |
| `server.js` | 30,485 B / 368 lines | 26,506 B / 307 lines | −3,979 B |
| `server/ws.js` | — | 2,170 B / 34 lines | new (H0-4a) |
| `server/fields.js` | — | 1,770 B / 22 lines | new (H0-4b) |
| `server/static.js` | — | 3,861 B / 48 lines | new (H0-4c) |

Together the new files are larger than the code they took out, mostly because of their headers: each says what it does and what it must keep.

## 2. The client

### Before: `mp.js`, one classic script, one IIFE

```
index.html  (classic scripts at the end of <body>, in this order)
  world.js  move.js  camcorder.js  sfx.js  gore.js  dphys.js  light.js  ents.js  glitch.js
  mp.js  ─────────────────────────────────────────────────────────────────────────────┐
  assets/credits_data.js  assets/ui.js  hud.js  inventory.js  assets/br-role.js  ...   │
  (the game bundle assets/index-DKbV5Nv9.js is a module: it runs after all of these)  │
                                                                                      │
mp.js (72,790 B)  ◄───────────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────────┐
  │ bootstrap, the #net badge, ?room=                                │
  │ window.__net facade, packet builders, tx                         │
  │ transport: connect / onopen / onmessage / onclose                │
  │ kill announcement, entity sounds, failing lamps                  │
  │ SNAPSHOT INTERPOLATION: NET netReset netHist angD2 netPose       │──► moved at H0-3
  │ applyServerState, capture phases, glitched-wall exit, cartograph │
  │ CORPSE CODEC: toRec        (applyBodies stays)                   │──► moved at H0-2
  │ dread audio, online note                                         │
  │ LOOK / LIGHT CODECS: partList partObj parseLook (+ 3 inline      │──► moved at H0-2
  │   look encoders, now lookStr); tooltip, avatar sweep             │
  │ death / vanish replays; peers: pose, lights, drawing             │
  │ admin panel (28 KB)                                              │
  │ fluorescent hum                                                  │
  │ per-frame hook window.__mp (sends `p`)                           │
  └──────────────────────────────────────────────────────────────────┘
```

### After: two helpers loaded just before `mp.js`, which stays the composition root

```
index.html
  ...  ents.js  glitch.js
  assets/net-wire.js    ──► window.__mpLib.wire   = frozen { lookStr, partList, partObj, parseLook, toRec }
  assets/net-interp.js  ──► window.__mpLib.interp = frozen { NET, netReset, netHist, netPose }
  mp.js                 ──► line 1 of its IIFE reads __mpLib.wire, line 2 reads __mpLib.interp;
                            then everything else exactly as before: window.__net, window.__NET and
                            window.__netPose (the same objects), the WebSocket, the admin panel, the
                            hum, window.__mp ...
  assets/credits_data.js  ...
```

**The rules the helpers follow:**
- classic scripts, no `'use strict'`, no `import`, no build step;
- nothing at load but their namespace entry: no listener, timer, DOM or random number;
- they read `window.__api` only when called, as before.

If one fails to load, `mp.js` stops on its first lines, and the game runs as if `mp.js` itself were missing (single-player). `3H0_MP_API_LOCK.md` section 7 has the detail.

## 3. The server

### Before: `server.js`, one CommonJS script

```
node server.js [port]
server.js (30,485 B)
  ┌──────────────────────────────────────────────────────────────────┐
  │ require http fs path crypto zlib ./sim.js; the gzip cache        │──► gz moved at H0-4c
  │ config: port, room cap, admin hash and lockout, BODY_TTL,        │
  │   cadence, SERVE allowlist, MIME table                           │──► SERVE, types moved at H0-4c
  │ HTTP STATIC HANDLER                                              │──► moved at H0-4c
  │ rooms, nextId, require ./death_srv.js                            │
  │ movement validation; death aftermath; moveTo                     │
  │ FRAME (outbound); send                                           │──► frame moved at H0-4a
  │ FIELD CHECKS: num kindOf cleanParts HEX DEFAULT_LOOK cleanLook   │──► moved at H0-4b
  │ getRoom; adminCommand                                            │
  │ upgrade: acceptance, 101 response, player, hi                    │
  │   onMessage (every client message)                               │
  │   INBOUND FRAME PARSER                                           │──► moved at H0-4a
  │   bye                                                            │
  │ the tick: 25 ms wake, 60 Hz steps, snapshots, admin and debug    │
  │ listen                                                           │
  └──────────────────────────────────────────────────────────────────┘
```

### After: three modules in `server/`, required where their code was

```
node server.js [port]
server.js (26,506 B), the composition root
  require http fs path crypto zlib ./sim.js          (same order; fs, path and zlib are now used only by static.js)
  config (PORT, ROOT, MAX_ROOM, admin hash and lockout, BODY_TTL, cadence)
  http.createServer( require('./server/static.js')(ROOT) )   ◄── server/static.js: SERVE, MIME, gzip cache, /sounds, the handler
  rooms, nextId, require ./death_srv.js
  movement validation; death aftermath; moveTo
  { frame, reader } = require('./server/ws.js')              ◄── server/ws.js: outbound frame, inbound parser
  send (uses frame)
  { num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook } = require('./server/fields.js')
  getRoom; adminCommand
  upgrade: acceptance, 101 response, player, hi
    onMessage
    sock.on('data', reader(sock, onMessage))
    bye
  the tick
  listen
```

**The rules the modules follow:**
- CommonJS, no `'use strict'`, no dependency outside Node itself;
- nothing at load but their definitions;
- they live in `server/`, which the allowlist does not reach. `/server/*` is 404, and tests prove it.

`sim.js`, `ai.js`, `world.js` and `death_srv.js` are untouched.

## 4. One message, end to end

```
browser                                                        server
mp.js  tx() / the p packet in window.__mp
  look string from __mpLib.wire.lookStr
  ── WebSocket text frame ──────────────────────────────────►  server/ws.js reader: unmask, limits, ping/pong, close
                                                                server.js onMessage(m)
                                                                  server/fields.js: num, kindOf, cleanLook, ...
                                                                  sim.js (authority)
                                                                server.js tick: snapshot per client
                                                                  send() → server/ws.js frame()
  ◄──────────────────────────────────────── WebSocket text frame
mp.js ws.onmessage
  corpses: __mpLib.wire.toRec / parseLook / partObj
  entities: __mpLib.interp.netHist, then netPose every frame
  everything else: mp.js, as before
```

## 5. Where to change things now

| To change | Edit | Also check | Run |
|---|---|---|---|
| the look, light-part or corpse fields the client writes or reads | `assets/net-wire.js` | `server/fields.js` (what the server accepts), `3H0_PROTOCOL_INVENTORY.md` | `fn_equiv.js --target wire` (an intended change shows as a difference: update the receipts), the gate |
| entity smoothing (delay, extrapolation, jump line) | `assets/net-interp.js` | `dev/tests/interp_test.js` reads it | `interp_test.js`, `fn_equiv.js --target interp`, the gate |
| frame limits, ping / close handling | `server/ws.js` | the client's sender in `mp.js` | `fn_equiv.js --target ws`, `raw_live.js`, the gate |
| which values a client may send | `server/fields.js` | `assets/net-wire.js` | `fn_equiv.js --target fields`, the gate |
| what the server serves | `server/static.js` (the `SERVE` allowlist is security-sensitive) | `dev/stage-3b-n/test_3bn.js` | `static_mutants.js`, `raw_live.js`, the gate |
| anything else in multiplayer | `mp.js` or `server.js`, as before | the API locks | the gate |

**The gate** is `node dev/stage-3h0/golden/run_checkpoint.js LABEL`. It compares the server and client golden traces of the working tree with the accepted parent's, byte for byte, and checks every message against the protocol contract.
- A change that is meant to change behavior will show as a difference. That is the point.
- Such a change belongs to a stage that owns that behavior, with new baselines recorded on purpose, not to a refactor.

**Adding a file:**
- **A client helper:** a classic script under `assets/`, loaded immediately before `mp.js`, with its entry under `window.__mpLib`. Add the global to `dev/stage-3h0/golden/declared_new_globals.json`, and list it in `3H0_MP_API_LOCK.md`.
- **A server module:** put it in `server/` and require it where its code was. Add its URL to the 404 checks: `http_h0` in `srv_scenarios.js`, and `PATHS` in `raw_live.js`.

## 6. What stays coupled (and why the composition roots are still large)

**`mp.js` still holds:**
- the transport;
- the admin panel;
- the replays and peers;
- the hum and the dread effects.

**`server.js` still holds:**
- the sessions (the upgrade and the message handler);
- the tick and the snapshot builder;
- the admin commands;
- movement validation and the death aftermath.

Each of these is tied to state or timing owned elsewhere in its file. `3H0_DEFERRED_FULL_3H.md` gives the coupling and what full 3H would need for each.
