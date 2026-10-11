# Stage 3H0: performance

**The question.** Does moving code into five new files cost anything at run time?

**The expectation.** No:
- the moved functions are called exactly as often as before, from the same places;
- the look encoder became one function call per `p` packet instead of an inline expression;
- the new files add no timer, listener, polling or per-frame work.

The client golden traces confirm the call counts: they record every call into the game, and they are byte-identical.

**The measurements below test that expectation.**

**Caveat.** Everything here ran on a 2-CPU cloud machine with software rendering (SwiftShader). Only comparisons between old and new code on the same machine, interleaved, mean anything. No number here is a GPU frame rate or a production figure.

## 1. The rules, fixed at H0-1 before any extraction

They are in `3H0_H0_1_BASELINE.md` section 6.2.

**Deterministic workloads (`perf_det.js`), the precise gate.** The same inputs on old and new code, in alternating rounds:
- **Server:** real CPU time around four golden scenarios (`lifecycle`, `deaths`, `admin`, `schedule`).
- **Client:** the real time inside `mp.js`'s per-frame hook and its WebSocket message handler, in five scenes.
- **The rule:** new passes when its median is at most old's median plus a tolerance. The tolerance is old's own spread across the rounds, or at least 5 % of old's median (server) or 10 % (client).

**The real stack (`perf_h0.js`).** `node server.js` from each checkout, alternating:
- **Load:** 8 players (`play8`), and 4 players plus an admin with AI debug on (`debug4`). The game in Chromium supplies the client timings.
- **Gated:** server CPU per wall second, with a 15 % floor on the tolerance.
- **Reported only:** bytes, snapshot rates and client timings.

**Why the real-stack rule is loose.** The first rule, a 5 % floor, failed on identical code at H0-1: `debug4` +7.8 %. That run is kept (`evidence/h0-1/perf_aa.json`). The real stack follows an AI acting in a world generated at random for every room, so its CPU varies with the world, not only with the code.

**QA2's own tools** (`perf_ab_qa2.js`, `perf_start_qa2.js`) were also re-run at H0-5, with the parent in the place of their "QA1" side. They time the menu, settings, customize and play frames, and the cold and warm starts. Reported, not gated.

## 2. Every checkpoint

| Checkpoint | What moved | Deterministic result (medians, new against old) | Within the rule |
|---|---|---|---|
| H0-2 | client wire codec | 7 rounds: hook −4 % to +14 %, handler −4 % to +8 %. A repeat over 15 rounds: hook −12 % to +3 %, handler −8 % to +8 % (the sign flips between runs) | yes |
| H0-3 | client interpolation | 15 rounds: hook −5.6 % to −1.4 %, handler −9.1 % to +10.8 % (the largest is 1.3 ms against a 6.8 ms tolerance) | yes |
| H0-4a | server framing | 15 rounds, server CPU: −0.6 % to +4.1 % (tolerances 15-21 %) | yes |
| H0-4b | server field checks | 15 rounds, server CPU: −1.1 % to +1.5 % (tolerances 12-28 %) | yes |
| H0-4c | server static serving | 15 rounds, server CPU: −3.0 % to +0.7 % (tolerances 11-45 %). The HTTP wall time over 108 real requests was 676 ms old, 654 ms new (`raw_live.js`; reported) | yes |

## 3. The final tree (H0-5)

### 3.1 Deterministic workloads, 15 rounds (`evidence/h0-5/perf_det.json`)

| Workload | Old median | New median | Change | Tolerance | Within |
|---|---:|---:|---:|---:|---|
| server `lifecycle` (CPU ms) | 1,920.7 | 1,887.7 | −1.7 % | 353.5 | yes |
| server `deaths` | 2,211.9 | 2,208.4 | −0.2 % | 498.8 | yes |
| server `admin` | 2,222.2 | 2,214.4 | −0.3 % | 454.7 | yes |
| server `schedule` | 556.3 | 568.4 | +2.2 % | 115.4 | yes |
| client `menu_online` hook / handler (ms) | 27.8 / 2.3 | 30.6 / 2.3 | +10.1 % / 0 % | 15.4 / 1.5 | yes |
| client `run_online` | 82.6 / 6.8 | 83.9 / 7.0 | +1.6 % / +2.9 % | 59.6 / 4.3 | yes |
| client `interp` | 104.3 / 7.2 | 103.5 / 7.9 | −0.8 % / +9.7 % | 84.4 / 9.1 | yes |
| client `fx_bodies` | 146.2 / 12.9 | 143.7 / 13.8 | −1.7 % / +7.0 % | 47.9 / 7.3 | yes |
| client `hum_dread` | 62.1 / 0.3 | 64.8 / 0.3 | +4.4 % / 0 % | 32.7 / 0.3 | yes |

**Reading it:**
- **Server:** the four medians moved by at most 2.2 %, against old's own spread of 18-23 %.
- **Client:** the timings are noisy under software rendering, so their tolerances are wide. Across the checkpoints, the client medians moved in both directions with no steady sign.

### 3.2 The real stack (`evidence/h0-5/perf_h0.json`, 3 rounds)

| Run | Load | Parent CPU (ms per s), rounds | Final CPU, rounds | Medians | Change | Within the rule | Bytes per client per s (medians) |
|---|---|---|---|---:|---:|---|---|
| 3 rounds | `play8` | 73.5, 59, 58.5 | 60, 72.5, 80.5 | 59 / 72.5 | +22.9 % | yes (tolerance 15) | 38,146 / 38,064 (−0.2 %) |
| 3 rounds | `debug4` | 56.66, 49.33, 46 | 50.66, 46, 55.99 | 49.33 / 50.66 | +2.7 % | yes (tolerance 10.66) | 22,002 / 24,365 (+10.7 %) |
| 6 rounds (repeat) | `play8` | 53, 62, 63, 73, 69.49, 68.5 | 59.5, 59.99, 60, 72, 63.5, 55.99 | 65.75 / 59.995 | −8.8 % | yes (tolerance 20) | 38,102 / 36,944 (−3.0 %) |
| 6 rounds (repeat) | `debug4` | 61.33, 56.66, 52, 58, 48.66, 48.67 | 46.66, 56.66, 52.66, 58, 46.67, 57.33 | 54.33 / 54.66 | +0.6 % | yes (tolerance 12.67) | 26,540 / 24,431 (−8.0 %) |

**The first run's `play8` +22.9 % passed the rule only because the parent's own rounds spread from 58.5 to 73.5 ms per second.** It was measured again with twice the rounds and nothing else running: −8.8 % (`perf_h0_server_r6.json`).
- The real-stack CPU follows the AI in a freshly random world, so a three-round median moves by tens of percent on identical code. At H0-1, the A/A run moved `play8` +10.1 % and `debug4` +7.8 %.
- The precise figure is the deterministic one above (section 3.1).

**The client timings on the real stack** (reported only) are about a dozen frames a phase under software rendering. The final tree's means against the parent's, as `perf_h0.js` prints them: per-frame hook in the menu −8.1 %, in a run −18.1 %; message handler in the menu +29.3 % (0.032 → 0.041 ms), in a run −19.7 %. These move by tens of percent between rounds on identical code (H0-1).

### 3.3 QA2's tools: the parent against the final tree

**Frame time** (`evidence/h0-5/qa2/perf_ab.json`). The tool's `qa1` side is the parent here, and its `qa2` side the final tree. Each figure is the mean frame time QA2's tool reports under software rendering, 2 rounds of 4 s, on a desktop (1920 × 1080) and a phone (390 × 844).

| State | Parent mean | Final mean | Change |
|---|---:|---:|---:|
| desktop 1920x1080: menu idle | 595.1 | 613.2 | +3.0 % |
| desktop 1920x1080: settings open (over the menu) | 594.3 | 644.2 | +8.4 % |
| desktop 1920x1080: customize open (over the menu) | 698.9 | 641.5 | −8.2 % |
| desktop 1920x1080: Level 0 lit, standing (menus closed) | 987.1 | 971.9 | −1.5 % |
| desktop 1920x1080: Level 0 lit, walking (menus closed) | 863.0 | 936.7 | +8.5 % |
| desktop 1920x1080: Level 0 dark, flashlight (menus closed) | 901.5 | 958.2 | +6.3 % |
| touch 390x844: menu idle | 264.7 | 254.7 | −3.8 % |
| touch 390x844: settings open (over the menu) | 247.9 | 242.7 | −2.1 % |
| touch 390x844: customize open (over the menu) | 294.9 | 312.1 | +5.8 % |
| touch 390x844: Level 0 lit, standing (menus closed) | 649.0 | 652.6 | +0.6 % |
| touch 390x844: Level 0 lit, walking (menus closed) | 678.8 | 646.6 | −4.7 % |
| touch 390x844: Level 0 dark, flashlight (menus closed) | 709.7 | 758.6 | +6.9 % |

The 12 states moved between −8.2 % and +8.5 %, in both directions. At QA2 R3, the same tool put QA2 against QA1 at −16 % to +11 % for an intended change. 3H0 changes nothing that draws.

**Starts** (`evidence/h0-5/qa2/perf_start.json`): medians of 2 rounds; a fresh profile (cold) and a reload (warm).

| Start | First paint (parent / final) | Menu settled | Menu music playing |
|---|---:|---:|---:|
| cold | 706 / 722 ms | 9058 / 9302 ms | 7463 / 7687 ms |
| warm | 710 / 678 ms | 7169 / 6117 ms | 5643 / 3670 ms |

The cold start is the same within its run-to-run variation. The warm start's music time is dominated by the music being decoded, and it varies between runs on both versions; at QA2 R3, QA2's own warm music time ranged 1.3 to 6.6 s.

### 3.4 Boot timelines (`evidence/h0-5/qa2/boot_*/boot_starts.json`, QA2's `capture_boot.js`)

Milliseconds from navigation until the boot is ready, through QA2's ready gate (`gate`) or with sound allowed (`direct`):

| Start | QA2 R3 (the parent, at QA2) | Parent, 1st capture | Parent, 2nd capture | Final tree |
|---|---:|---:|---:|---:|
| gate, cold | 8,258 | 9,023 | 8,018 | 8,122 |
| gate, warm | 1,142 | 4,822 | 5,728 | 1,212 |
| gate, phone, cold | 7,467 | 8,267 | 7,891 | 7,236 |
| direct, cold | 7,926 | 8,534 | 8,276 | 9,081 |
| direct, warm | 1,052 | 5,093 | 1,166 | 1,103 |

The cold starts are within their run-to-run spread (about 7.2 to 9.1 s, mostly the 22.6 MB menu music).

The parent's slow warm starts in this session waited for the page's first steady frames, a rendering stall of the capture machine:
- the boot's own record has every other piece ready by 1.3 s;
- the same parent code took 1.1 s at QA2 R3.

The final tree is not the slow side.

### 3.5 The HTTP wall time over real sockets (`raw_live.js`, reported only)

The time to answer the same 108 HTTP requests, once per run, parent against the code of the time:

| Run | Parent | New |
|---|---:|---:|
| H0-4c, the parent against itself (A/A) | 623 ms | 620 ms |
| H0-4c | 676 ms | 654 ms |
| H0-5 | 668 ms | 654 ms |
| H0-6 (the same production files as H0-5) | 672 ms | 710 ms |

These are single runs, and they move both ways. The static serving is the parent's code, verbatim. `server.js` hands the same request handler to `http.createServer` as before, with no extra layer per request.

## 4. Conclusion

**No cost from the extractions was found:**
- **Deterministic workloads:** the gate fixed at H0-1 holds at every checkpoint and on the final tree. Server CPU moved by at most a few percent either way, well inside the old code's own spread.
- **The real stack:** the server CPU is within its rule. The one large first-run figure reversed sign on a longer repeat.
- **Bytes, snapshot rates, frame times and starts** move in both directions, by the amounts the same tools show between two runs of identical code.

This is consistent with the code: nothing the moved functions do per call changed, and they are called as often as before.

**What only you can check** is a real GPU, a real phone and a real network: a frame rate and a start that feel the same as QA2's.
