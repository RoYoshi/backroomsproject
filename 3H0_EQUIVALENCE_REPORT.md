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
| Deterministic performance (client, 15 rounds interleaved) | within the rule fixed at H0-1. The hook medians moved −5.5 % to −1.4 %, the handler medians −9.1 % to +10.8 %. The largest, `fx_bodies` handler +10.8 %, is 1.3 ms against a tolerance of 6.8 ms from the old side's own spread. The move adds no per-frame work: `netPose` is called as often as before, from the same places. |

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

## H0-4b: the field checks (server) — GO

**What moved.** From `server.js` into the new `server/fields.js`, character for character: `num`, `KINDS`, `LEGACY`, `kindOf`, `cleanParts`, `HEX`, `DEFAULT_LOOK` and `cleanLook`. These are the checks `server.js` applies to every field a client sends (`p`, `fx`, `b`) and its default look.

**server.js:** one `require` of the six names it uses, where they were defined. 29,776 → 29,040 bytes, 350 → 341 lines. The new file is 1,770 bytes.

**Why it is safe by construction:**
- the functions are pure, and `HEX` has no `g` flag, so sharing it carries no state;
- every caller runs after start-up, so the one ordering change (`cleanLook` is no longer a hoisted declaration) cannot be seen;
- no `'use strict'`, nothing required.

**The current results are pinned on purpose, whatever they are.** The field tests include odd inputs (non-strings, prototype-named keys, malformed colours), so the move keeps every result exactly. 3H0 changes no validation rule.

**Tests first.** The draft module passed function equivalence and 11 of 11 deliberate wrong versions before `server.js` was touched (`fn_equiv_fields_draft.json`, `fn_mutants_fields_draft.json`). The A/A run of the field check is identical (`fn_equiv_fields_aa.json`).

**The evidence** (`dev/stage-3h0/evidence/h0-4b/`):

| Check | Result |
|---|---|
| Function level (`fn_equiv.js --target fields --new server/fields.js`): 20,000 generated calls for each of `num`, `kindOf`, `cleanParts`, `cleanLook` and `HEX.test`, with numbers, numeric strings, `NaN`, infinities, `null`, arrays, objects, prototype keys, 3- to 7-digit and mixed-case colours, looks with missing or extra parts; plus `DEFAULT_LOOK` and the `HEX` source | **100,000 of 100,000 calls identical**, and both constants identical |
| Does that check have teeth? (`fn_mutants.js --target fields`) | **11 of 11** wrong versions caught: missing numbers as 1, camcorder dropped, a legacy name remapped, another fallback kind, 6 light parts, 3-digit part colours, case-sensitive colours, another default look, an extra hat, an extra backpack, `''` instead of `null` for a bad look |
| Server golden traces, 11 scenarios (`p_fields` sends every field type, valid and not) | **byte-identical** old against new, and against the baseline (except the expected `index.html` / `mp.js` bodies). The only structural difference is the new `require` |
| Client golden traces, 9 scenes; protocol contract | identical; 0 violations |
| Real sockets (`raw_live.js`) | identical: the start-up line, 108 HTTP exchanges, 25 WebSocket checks |
| Existing network suites on the new server | the same as at H0-1: `live.js` 17/17, `audit_net.js` 17/17, `audit_net2.js` 11/11, `ir_net.js` 4/4, `test_3bn.js` 7/7 |
| Live wire: the real server and game, the parent's checkout against the new tree | **structurally identical in all 56 phase, player and direction summaries** (6,949 and 6,741 frames); 0 page errors on either side |
| Deterministic performance (server, 15 rounds interleaved) | within the rule fixed at H0-1. The CPU medians of the four server workloads moved −1.1 % to +1.5 %, against tolerances of 12-28 % of the old medians. The checks do the same work per field as before. |

## H0-4c: the static file serving (server) — GO

**What moved.** From `server.js` into the new `server/static.js`, character for character:
- the `SERVE` allowlist, with its comment;
- the MIME table;
- the gzip cache;
- the request handler. The module's export is now a function of `ROOT` that returns it: `require('./server/static.js')(ROOT)`.

`server.js` passes its own `ROOT`, because the module's `__dirname` is `server/`.

**server.js:** `http.createServer(require('./server/static.js')(ROOT))`. It still requires `fs`, `path` and `zlib` first, so the start-up order the traces record is unchanged. 29,040 → 26,506 bytes, 341 → 307 lines. The new file is 3,839 bytes.

**Why it is safe by construction:**
- the handler shares nothing with the game;
- its state is the gzip cache, still one per process;
- every path rule resolves against the same `ROOT` string;
- no `'use strict'`, no timer.

**Found later, at H0-5.** The independent review found that `dev/shadows/test_shadows.js` S16 reads the `SERVE` line from `server.js` by its text, and now throws.
- S16 already failed at the parent: it expects `index.html` to load the retired `shadows-2d.js`.
- The suite gives 43/48 on the parent and on the final tree, with the same five failures. Its result does not change, and the test was not adapted.

**This is security-sensitive code, so it was tested first and hardest:**
- **Draft first.** A candidate `server.js` and the draft `static.js` were run in a scratch copy of the tree before the real files were edited. Their start-up and HTTP traces were identical to the tree's, and 12 deliberate wrong versions of `static.js` were all caught (`static_mutants_draft.json`).
- **Exact copy.** The applied files are exactly the files that were tested: the apply step copies the draft in, and refuses if `server.js` had changed since the draft was made.

**The evidence** (`dev/stage-3h0/evidence/h0-4c/`):

| Check | Result |
|---|---|
| Does the gate have teeth? (`static_mutants.js`): the `boot`, `http_base` and `http_h0` scenarios on 12 wrong versions of `static.js`, and a control run | **12 of 12** caught: `server/` served, 404 for a malformed escape, a NUL let through, `/` not `index.html`, the query string kept, every file listed in `/sounds`, two cache lifetimes, unknown types as text, no `Vary`, case-insensitive gzip, gzipped PNG. The control run is identical |
| Server golden traces, 11 scenarios: `http_base` makes 84 requests (every allowlisted file, every private file, traversal in plain and `%`-encoded forms, malformed escapes, NUL, `/sounds`, `GZIP`, `x-gzip`, and HEAD / POST / DELETE); `http_h0` has the 3H0 files, including all three `server/` modules | **byte-identical** old against new; against the baseline only the expected `index.html` / `mp.js` bodies |
| Client golden traces, 9 scenes; protocol contract | identical; 0 violations |
| Real sockets (`raw_live.js`): `node server.js` old and new on the same files | **identical**: the start-up line, 108 raw HTTP exchanges byte for byte except `Date` (including the three `server/` modules, `..` and `%2e%2e` traversal, `/sounds` with a space in a file name, HEAD, POST, an absolute URL, two requests on one connection, a malformed request line), and the 25 WebSocket checks. The A/A run of the final tool is identical too. The wall time of the HTTP exchanges is about the same (676 and 654 ms; reported only) |
| Existing network suites on the new server (`test_3bn.js` fetches every script `index.html` loads) | `test_3bn.js` 7/7, `audit_net.js` 17/17, `audit_net2.js` 11/11, `ir_net.js` 4/4, as at H0-1. **`live.js` failed once: 7/10** (`existing/live.log`, kept). Its L5b check waits 70 s for the Hound it summons to kill a player standing still; no kill came, and L5c and the end of the test failed on the missing kill. See the note below the table |
| Live wire: the real server and game, the parent's checkout against the new tree | **structurally identical in all 56 phase, player and direction summaries** (6,960 and 6,682 frames); 0 page errors on either side |
| Deterministic performance (server, 15 rounds interleaved) | within the rule fixed at H0-1: the CPU medians moved −3.0 % to +0.7 %, against tolerances of 11-45 % of the old medians. These workloads do not serve files; the HTTP timing is the `raw_live.js` line above |

**The `live.js` failure was investigated before going on; the evidence is kept** (`evidence/h0-4c/`).

**Why it is not this extraction.** The kill in L5b comes from the AI, in a world generated at random for each run, in real time. How long it takes varies widely on every version, the parent included.
1. **Repeat** (`live_repeat/`): 8 runs of the parent's own tree and 8 of the new tree, alternating. All 16 passed 17/17. The parent's kills came after 2.6-11.6 s, the new tree's after 4.1-51.5 s. That looked like a difference (p = 0.05), so the order was suspected.
2. **Controlled run** (`live_ab3/`): 10 rounds of three arms, the order rotated every round, nothing else running:
   - A, the parent;
   - B, the new tree;
   - C, the new code copied next to the parent's copy.

   All 30 runs passed 17/17. The median kill times were 4.7, 6.3 and 5.4 s, and the slowest 38.0, 44.2 and 53.0 s: **the parent had kills of 30.6 and 38.0 s too**. No pair differs (p = 0.36, 0.85, 0.68, two-sided Mann-Whitney).
3. **Pooled:** over all 46 runs, the new code's median is 7.5 s against the parent's 4.9 s, with p = 0.15 (0.11 when the failed run is counted as 70 s). That is not a significant difference. It is reported so the reader can judge.

**Why the extraction cannot change it:**
- `server/static.js` serves files and is not on the path of a kill;
- the closed-world `admin` scenario places a Hound with the same admin command and runs the simulation on, and its trace stays byte-identical;
- the CPU of the server workloads is unchanged.

**Conclusion.** The 70 s limit of L5b can run out by chance on any version. This is a property of the existing test, and the test was not changed. It is listed with the other findings at H0-5 (`3H0_DEFERRED_FULL_3H.md`). `live.js` passed at H0-1, H0-4a, H0-4b and in all 46 repeats.

## H0-5: the final tree, across every boundary

**Corrections first.** The independent review (a separate agent that had not seen the work) found three stale comments, now fixed:
- `assets/net-wire.js` said it loads immediately before `mp.js`; since H0-3, `net-interp.js` sits between them;
- `mp.js` said the same of `net-wire.js`;
- `server/static.js` named its export `createStatic`, but the export is an anonymous factory.

These are comment-only changes. They changed three sizes, so the figures given above for H0-2, H0-3 and H0-4c are those of their own checkpoints:
- `mp.js`: 68,144 → 68,139 bytes;
- `assets/net-wire.js`: 2,653 → 2,691 bytes, 23 → 24 lines;
- `server/static.js`: 3,839 → 3,861 bytes, 47 → 48 lines.

The gate, the four function-equivalence checks, the static mutants, `interp_test.js` and `test_3bn.js` were all run again on the corrected tree: all identical, 12 of 12 caught, all passed (`evidence/h0-5/final_tree/`). The review also found the text-reading test `dev/shadows/test_shadows.js` S16 (H0-4c above).

**The final regression** is in `evidence/h0-5/summary.json`, with each result next to what it is compared with. Every gated item holds:
- **Existing suites, as at H0-1 on the parent:** `live.js` 17/17, `audit_net.js` 17/17, `audit_net2.js` 11/11, `ir_net.js` 4/4, `test_3bn.js` 7/7, `interp_test.js` passed. `npm test` gives 151/162, with the same 11 historical failures.
- **QA2's own final checks** (QA2 R3 ran them on the parent):
  - camera fairness 12/12;
  - BR-RoLE 32/32;
  - the theme files;
  - QA2's probes: `probe_b1` 13/13, `probe_b2` 10/10, `probe_b3` 28/28;
  - the regression of the 12 older probes. Its main run had three checks failing without a listed reason; see below.
- **Menu and boot captures** of the parent and the final tree, taken now. They differ only where the tool itself varies:
  - the random room name printed in the rail (`qa2/compare_crops/`);
  - the idle animation of the Customize preview;
  - frame timing in the boot sheets.

  The parent captured now differs from QA2 R3's captures of the same code by as much (largest share of changed pixels: 0.31 % against 0.26 %).
- **The gate:** the golden traces and the contract, ALL EQUIVALENT, before and after the comment corrections.
- **Scope:** every change is an approved extraction, the adapted test, the stage's tooling or a stage document. Every line removed from `mp.js` and `server.js` reappears verbatim in the new files, except the five changed by design.
- **Real sockets:** the 108 HTTP exchanges and 25 WebSocket checks are identical.
- **Deterministic performance, 15 rounds:** within the rule (`STAGE_3H0_PERFORMANCE.md`).

**Four things looked different at first. Each was investigated before going on, and each investigation is kept.**

1. **QA2's older-probe regression: 3 checks failed in the main run** (`qa2/regress/`).
   - `probe_c3` timed out clicking the pause menu's Customize, so its "no page errors" check failed. `probe_q2` failed two checks:
     - "a monster loose near the menu visitor's spot": the closest monster came to 680 px, and the check wants under 620;
     - "ENTER LEVEL 0 … it walks": the player walked 36 px, and the check wants more than 40.
   - Both probes were re-run through QA2's own runner, twice on each side, alternating (`qa2/rerun/`):
     - the final tree failed the 620 px check again in its first re-run and passed it in the second; it passed the "walks" check both times;
     - the parent passed the 620 px check both times and failed the "walks" check once;
     - `probe_c3` passed 13/13 in all four runs.
   - **The 620 px check sits at the median of its own distribution.** The same summon sequence in the closed world (`summon_seeds.js`) is byte-identical old against new for 30 of 30 seeded worlds, and the closest monster comes within 620 px in only 17 of the 30.
   - On the real server (`summon_probe.js`), a first run of 12 rounds per side looked different: 8 of 12 under 620 px old, 4 of 12 new, p = 0.024. A fresh replication of 24 rounds per side does not: 13 of 24 against 12 of 24, p = 0.28.
2. **The live wire differed in two of three final runs, each time only in the server-outage phases** (`live_wire.json`, `live_rerun/`). These are the phases where the test stops and restarts the server.
   - **In the first run, the parent's player B reconnected late.** Its `hi` arrived just before the phase ended, so the other frames of that phase were missing on the old side.
   - **In the second, the final tree's player B sent a death replay right after reconnecting.** The server had recorded no death for B, so it ignored the replay, as it does for any living player, and player A received nothing. The replay comes from B's own game, which plays offline with its own monsters while the server is down.
   - The third run is identical in every phase, and so are two A/A runs of the parent against itself.
   - Reconnect timing and offline play are real-time events, which the comparison does not control.
3. **The real-stack server CPU** moved +22.9 % on `play8` over 3 rounds. This passed the rule, because the parent's own rounds spread 58.5 to 73.5 ms per second. Measured again with 6 rounds, it moved −8.8 %, and the deterministic CPU gate shows −1.7 % to +2.2 %.
4. **The parent's warm boot was slow in this session** (`qa2/boot_*/boot_starts.json`). The final tree is not the slow side.
   - **Through the ready gate,** the parent's warm start took 4.8 s and 5.7 s in two captures. The final tree took 1.2 s, and the same parent code took 1.1 s at QA2 R3.
   - **The direct warm start** took 5.1 s in the parent's first capture and 1.2 s in its second, against 1.1 s for the final tree.
   - **What held them up differed.** In the first capture, both slow starts waited for the page's first steady frames, and every other piece was ready by 1.4 s. In the second capture's gate run, the menu music was ready only at 5.4 s, though it came from the browser's cache.
   - These are stalls of the capture machine at those moments. No code that draws or plays sound changed, and the same parent code started warm in 1.1 to 1.2 s at other times.

**Conclusion.** No difference attributable to the extractions was found on the final tree. Every apparent one was traced to a timing- or randomness-dependent check, with the evidence kept beside it.
