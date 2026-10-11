# Stage 3H0: equivalence receipts, one per extraction

**The rule.** Each extraction is accepted only if old and new produce the same observable behavior for the same inputs. "Old" is always the accepted parent `edd2af9`, taken from Git; "new" is the checkpoint's working tree.

**The layers of evidence** are described in `3H0_H0_1_BASELINE.md`. A NO-GO is recorded here with the same care as a GO.

## H0-2: the wire codec (client) — GO

**What moved.** These moved from `mp.js` into the new `assets/net-wire.js`:
- `toRec`, `partList`, `partObj` and `parseLook`, character for character;
- `lookStr`, the look encoder that mp.js wrote inline three times, as `[x.hat, x.texture, x.hands, x.main, x.backpack].join('|')`. Those three places now call `lookStr(x)`.

**What changed around it:**
- **mp.js:** it reads the five functions once, on the first line of its IIFE, from `window.__mpLib.wire`.
- **index.html:** one line loads the new file immediately before `mp.js`.
- **server.js:** nothing; the existing `assets/` rule serves the file.
- **mp.js size:** 72,790 → 71,189 bytes. The new file is 2,653 bytes.

**Why it is safe by construction:**
- the functions are pure;
- they read `window.__api` only when called, as before;
- they hold no state, no timer and no listener, and use no randomness;
- the new file has no `'use strict'`, exactly like the context it came from;
- nothing in mp.js calls them while it is loading, so reading them earlier in the IIFE changes nothing.

**The evidence** (`dev/stage-3h0/evidence/h0-2/`):

| Check | Result |
|---|---|
| Function level (`fn_equiv.js --target wire --new assets/net-wire.js`). Old: the parent's own text. New: the file. Same generated inputs, including malformed values and a missing or partial game API | **140,000 of 140,000 identical**: 20,000 each for `parseLook`, `partObj`, `partList`, `toRec`, and for `lookStr` at each of its three former inline sites. Exceptions are identical too (for example 4,919 `toRec` cases throw the same error on both sides) |
| Does that check have teeth? (`fn_mutants.js`) | 8 of 8 wrong versions of the file caught: field order, 3-digit colours, another default look, kept backpacks, 3-value hands, another separator, a passed-through flag, a missing guard |
| Client golden traces: the parent's mp.js against the new mp.js plus `net-wire.js`, all 9 scenes | **byte-identical**, and identical to the client baseline; the only new global is the declared `__mpLib` |
| Server golden traces, 11 scenarios | byte-identical old against new. Against the H0-1 baseline, identical except 10 HTTP lines about the two changed files (`index.html`, `mp.js`): their bodies changed, as they must |
| The new file over HTTP (`http_h0`) | 200 `text/javascript`, `no-store`, gzip, the same rule as every script; the old and new server code are identical |
| Protocol contract | 11,554 + 912 messages, 0 violations |
| `dev/stage-3b-n/test_3bn.js` (every script `index.html` loads is served) | 7/7 |
| `dev/tests/interp_test.js` | 3/3 (interpolation not moved yet) |
| Live wire: the real server and game, the parent's checkout against the new tree | **structurally identical in every phase** (7,406 and 7,454 frames); 0 page errors on either side. The QA2 boot gate is passed with a key on every page. |
| Performance on deterministic workloads (client hook and handler, 7 rounds interleaved) | within the rule fixed at H0-1. Over 7 rounds the hook medians moved −4 % to +14 % and the handler medians −4 % to +8 %. A repeat over 15 rounds gave −12 % to +3 % and −8 % to +8 %: the sign flips between runs, which is the A/A noise measured at H0-1, not a cost. The new code adds no per-frame work: the codec functions are called exactly as often as before, and the look encoder is one function call per `p` packet instead of an inline expression. |

**The first gate run failed, and was kept.** It is in `evidence/h0-2/attempt1/`. Every client scene differed, including the parent against the H0-1 baseline.
- **Cause:** the harness's page-state record hashed the page's own `<script>` tags. The new page has one more by design, and the declared-globals list was written into an inline script.
- **Nothing from mp.js differed.**
- **Fix:** the harness now leaves `<script>` elements out of that record.
- **Re-check:** the client baseline was rebuilt from the parent's code on both sides (`evidence/h0-1b/`). The parent against itself is identical, and 35 of 35 deliberate changes are still caught.
- **Server:** the new `http_h0` scenario has no H0-1 baseline, and the first run counted that as a failure. It is now reported as "no baseline (new scenario)", and compared old code against new code only.

## H0-3: the snapshot interpolation (client) — GO

**What moved.** From `mp.js` into the new `assets/net-interp.js`, character for character with their comments: `NET`, `netReset`, `netHist`, `angD2` and `netPose`.

**What stayed in mp.js:**
- it reads `NET`, `netReset`, `netHist` and `netPose` once, on the second line of its IIFE, from `window.__mpLib.interp`;
- it publishes `window.__netPose` and `window.__NET` at the same point of its start-up as before;
- it sets `NET.onEpoch` as before.

`index.html` gains one more line, before `mp.js`. **mp.js:** 71,189 → 68,144 bytes (72,790 at the parent). The new file is 4,163 bytes.

**Why it is safe by construction:**
- `NET` is one object, created with the same initial content, and nothing calls it before mp.js runs;
- `netPose` reads `performance.now()` at call time, as before;
- no timer, listener or randomness;
- the file has no `'use strict'`, like the context it came from.

**Tests first.** `dev/tests/interp_test.js` cut this code out of `mp.js` by its text. Before the move it was changed only in where it reads the code: `assets/net-interp.js` when present, else `mp.js` (and still `OLD_MP`). Its output was recorded, the code moved, and the output compared: **identical** (`interp_test_before_move.log`, `interp_test_after_move.log`).

**The evidence** (`dev/stage-3h0/evidence/h0-3/`):

| Check | Result |
|---|---|
| Function level (`fn_equiv.js --target interp`): 200 generated streams of 400 operations, comparing after every operation every pose, `NET`'s whole state and the epoch-callback count. The streams include jitter, repeats, late and reordered snapshots, steps right at the 300 px line, 0.3-2 s steps back, 30-50 s leaps, missing clocks and pose queries, plus a quarter of calm streams in which one entity leaves for 4.75-6.75 s (pruning) | **80,000 of 80,000 steps identical** (the A/A run of the same generator is identical too) |
| Does that check have teeth? (`fn_mutants.js --target interp`) | 8 of 8 wrong versions caught: delay, extrapolation, jump line, step-back line, history length, pruning, the epoch callback, shortest-arc facing. The first run caught 6 of 8 (`fn_mutants_interp_attempt1.json`): the generator never stepped exactly to the 300 px line, and reset too often for pruning to happen. Both were added to the generator, and then all 8 were caught. |
| `dev/tests/interp_test.js` | 3/3, output identical to before the move |
| Client golden traces, all 9 scenes; `interp` probes `__netPose`, `__NET` and its epochs at exact times | **byte-identical**, and identical to the client baseline; the only new global is still `__mpLib` |
| Server golden traces, 11 scenarios | identical old against new; against the baseline only the expected body changes of `index.html` and `mp.js` |
| `http_h0` | `assets/net-interp.js` served as `text/javascript`, `no-store`, gzip; old and new server code identical |
| Protocol contract | 0 violations |
| `test_3bn.js` | 7/7 |
| Live wire: the real server and game, the parent's checkout against the new tree | **structurally identical in all 56 phase, player and direction summaries** (7,160 and 7,177 frames); 0 page errors on either side |
| Deterministic performance (client, 15 rounds interleaved) | within the rule fixed at H0-1. The hook medians moved −5.6 % to −1.4 %, the handler medians −9.1 % to +10.8 %. The largest, `fx_bodies` handler +10.8 %, is 1.3 ms against a tolerance of 6.8 ms from the old side's own spread. The move adds no per-frame work: `netPose` is called as often as before, from the same places. |

## H0-4a: the WebSocket framing (server) — GO

**What moved.** From `server.js` into the new `server/ws.js`, character for character:
- `frame(str)`, the outbound text frame;
- the inbound frame parser, as `reader(sock, onMessage)`, which returns the socket's `data` handler. Its body is the old inline handler's, and its buffer is the old `let buf`, now one per call instead of one per connection closure (the same thing: one call per connection).

**What stayed in `server.js`:** the whole upgrade (raw WebSocket acceptance: path, key, room cap, room name, the 101 response, the player, `hi`). The H0-0 map proposed moving the 101 response text too; it stays, because the master prompt puts raw WebSocket acceptance outside 3H0, and the upgrade decision reads best in one place.

**server.js:** one `require` where `frame` was, and one line `sock.on('data', reader(sock, onMessage))` where the inline handler was registered. 30,485 → 29,776 bytes, 368 → 350 lines. The new file is 2,170 bytes.

**Why it is safe by construction:**
- `frame` is pure;
- the reader's only state is the buffer it owns, and its only effects go to the socket and the callback it is given;
- it is registered at the same moment, so the listener order is unchanged;
- no `'use strict'` in either file, no timer, nothing required.

**Tests first.** Before `server.js` was touched:
- `fn_equiv.js` was taught to accept a module without the handshake, and its generator gained valid JSON frames of exactly 1,399, 1,400 and 1,401 bytes. The A/A run is identical.
- The draft module was checked by function equivalence and 12 deliberate wrong versions (`fn_equiv_ws_draft.json`, `fn_mutants_ws_draft.json`).
- A new real-socket check, `raw_live.js`, was run A/A. Its first A/A run differed: it read the 101 response and the second response's `Date` header too early or too narrowly. That run is kept (`raw_live_aa_attempt1.json`). The tool now waits for replies and replaces every `Date` header; the A/A run is identical, three times.

**The evidence** (`dev/stage-3h0/evidence/h0-4a/`):

| Check | Result |
|---|---|
| Function level (`fn_equiv.js --target ws --new server/ws.js`): `frame` on 3,000 strings (lengths around 125, 126, 65,535 and 65,536, ASCII and multi-byte); the reader on 1,000 random byte streams cut into random chunks: valid, partial, unmasked, ping, pong, binary, continuation, close and 64-bit frames, bad JSON, a handler that throws, frames at the 1,400-byte limit | **all identical**: 3,000 frames and 1,000 streams, every socket effect and callback in the same order |
| Does that check have teeth? (`fn_mutants.js --target ws`) | **12 of 12** wrong versions caught: the 7-bit and 16-bit length limits, the 16-bit length bytes, reading before the mask and payload are in, a 2-byte mask, the 1,400-byte limit, close destroying instead of ending, pong sent as ping, 64-bit lengths waited on, a 3-bit opcode, a handler error escaping, reading stopped after a ping |
| Server golden traces, 11 scenarios (`ws_upgrade`, `ws_frames`, lifecycle, deaths, admin, schedule, fields, HTTP ...) | **byte-identical** old against new, and against the baseline (except the expected `index.html` / `mp.js` bodies). The only structural difference is the new `require('./server/ws.js')` |
| Client golden traces, 9 scenes; protocol contract | identical; 0 violations |
| Real sockets (`raw_live.js`): the parent's `server.js` and the new one, each started with `node server.js PORT` on the same files | **identical**: the start-up line; 108 raw HTTP exchanges byte for byte except `Date`; 25 WebSocket checks (the 101 bytes, `hi`, pings whole and one byte per write, JSON ping and its 400 ms limit, bad JSON, the 1,399 / 1,400-byte limit, binary and pong frames ignored, the close frame, a 64-bit length, refused upgrades, the 8-player cap) |
| Existing network suites on the new server | the same as at H0-1: `live.js` 17/17, `audit_net.js` 17/17, `audit_net2.js` 11/11, `ir_net.js` 4/4, `test_3bn.js` 7/7 |
| Live wire: the real server and game, the parent's checkout against the new tree | **structurally identical in all 56 phase, player and direction summaries** (7,200 and 7,274 frames); 0 page errors on either side |
| Deterministic performance (server, 15 rounds interleaved) | within the rule fixed at H0-1. The CPU medians of the four server workloads moved −0.6 % to +4.1 %, against tolerances of 15-21 % of the old medians (the old side's own spread across rounds). The framing does the same work per frame as before. |
