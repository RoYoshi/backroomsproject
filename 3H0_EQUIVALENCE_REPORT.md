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
