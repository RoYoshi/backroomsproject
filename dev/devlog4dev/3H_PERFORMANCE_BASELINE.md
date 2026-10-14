# Stage 3H: performance baseline of the accepted B++ game

**Label: B++ PARENT** (`143b63f`, tree `b25c26e`). Recorded in Stage 3H1 with no runtime file changed. Every later 3H step compares against these numbers, and against their A/A noise, not against a single run.

**Read this first: what these numbers can and cannot say.**
- **No GPU was involved.** Every browser number below comes from Chromium's software renderer (SwiftShader) on 2 CPUs, at about 4 to 11 frames a second. These numbers can show that a change costs more CPU in the same scene. They say nothing about the frame rate on a player's graphics card.
- **The network was local.** Nothing here measures latency, jitter or loss on a real connection.

**The machine:**

| | |
|---|---|
| Node | v22.22.2 |
| Browser | Playwright 1.56.0, Chromium 141.0.7390.37 headless shell |
| Python | 3.11.15 |
| Kernel | Linux 6.18.44 x86_64 |
| CPUs | 2 |

The raw files are in `dev/stage-3h/evidence/h1/perf/` and `…/browser/`.

## 1. Deterministic workloads, A/A (`perf_det.js`)

**The command.** `node dev/stage-3h0/golden/perf_det.js --old-ref 143b63f --rounds 7`

**How it measures.**
- **Server:** the CPU time of each closed-world scenario (`process.cpuUsage`), with the same bytes in and out every time.
- **Client:** the time spent in `mp.js`'s per-frame hook and its message handler, per scene.
- **Rounds** alternate old and new.
- **Here both sides are the B++ head**, so the result is the noise floor.

**The pass rule** (3H0's, unchanged):
- new median ≤ old median + tolerance;
- tolerance = max(the old side's spread, 5 % of its median) for the server, 10 % for the client.

**Server, CPU ms per scenario run:**

| Scenario | Median (side 1) | Median (side 2) | Change | Tolerance | Spread seen |
|---|---|---|---|---|---|
| `lifecycle` | 1,088.3 | 1,096.3 | +0.7 % | 288.1 | 1,044–1,332 |
| `deaths` | 1,272.1 | 1,242.6 | −2.3 % | 239.7 | 1,150–1,390 |
| `admin` | 1,296.3 | 1,316.7 | +1.6 % | 345.8 | 1,154–1,500 |
| `schedule` | 369.8 | 375.9 | +1.7 % | 43.0 | 337–380 |

**Client, ms in `mp.js` per scene:**

| Scene | Hook (side 1 / side 2) | Handler (side 1 / side 2) |
|---|---|---|
| `menu_online` | 18.4 / 16.3 | 2.3 / 1.9 |
| `run_online` | 51.3 / 55.2 | 5.8 / 4.9 |
| `interp` | 61.3 / 60.6 | 5.5 / 5.4 |
| `fx_bodies` | 86.3 / 85.6 | 9.7 / 7.8 |
| `hum_dread` | 36.4 / 35.6 | 0.2 / 0.3 |

**What the A/A says.**
- **The server's run-to-run spread is 12 to 27 % of the median** (side 1, the "Spread seen" column). A change smaller than that cannot be seen with 7 rounds on this machine.
- **The client's handler numbers are a few milliseconds per scene,** so their percentages swing widely (up to ±50 % A/A on `hum_dread`'s 0.2 ms).

Judge any later step by its A/B against this table, not by percentages alone.

## 2. The server's tick, live

**Snapshot cadence.** Measured by a listening WebSocket client on a real `node server.js`, B++ export, two runs (`tools/h1_wav_stall.js`):

| Phase | Gaps between snapshots, median | Largest gap |
|---|---|---|
| idle, 3 s | 50.6 ms | 53.5 / 57.7 ms |

The 20 Hz snapshot schedule holds to within a few milliseconds when nothing else runs.

**The first request for each menu-theme WAV pauses every room** (F-013). `server/static.js` gzips a file synchronously, at level 9, the first time it is asked for, on the server's only thread:

| Request | Largest snapshot gap during it (run 1 / run 2) | Response time (run 1 / run 2) | Sent |
|---|---|---|---|
| first `MainTheme_MenuIntro.wav` | 270 / 264 ms | 248 / 259 ms | 7,866,467 B gzipped (from 8,146,988: 3.4 % smaller) |
| first `MainTheme_MenuLoop.wav` | 424 / 430 ms | 405 / 434 ms | 14,192,258 B gzipped (from 14,499,884: 2.1 % smaller) |
| `MainTheme_MenuIntro.wav` again (cached) | 52.8 / 51.5 ms | 22 / 10 ms | the same bytes |
| `MainTheme_MenuLoop.wav` again (cached) | 54.6 / 50.7 ms | 34 / 27 ms | the same bytes |

**The same `zlib.gzipSync` in a separate process:** 264 ms and 479 ms.

**What it means:**
- **The pause.** After every server start, the first visitor to load the menu pauses every room for about 0.25 s and then about 0.4 s.
- **The cost of compressing.** The compression saves 2 to 3 % of 22.6 MB.
- **The download.** The files are sent with `no-store`. In a secure context (HTTPS, or localhost) `assets/ui.js` keeps them in the browser's Cache Storage (`tfb-menu-theme-<version>`), so only a browser's first visit downloads the 22.6 MB. Over plain HTTP every visit downloads them again.

## 3. What travels (closed-world traces)

| Message | Typical size | Largest seen | Where |
|---|---|---|---|
| `s` to a player | median 1,032 B | 2,782 B | all 16 server goldens |
| `s` to an admin (the admin panel's data, no AI debug list) | median 1,682 B | 3,957 B | `admin` |
| `s` carrying the AI debug list (an admin with AI DEBUG on, every 3rd snapshot) | median 9,151 B | **32,770 B** (21 entities) | `admin`, `deaths`, `lifecycle`, `schedule` |
| `q` (B+) | 45 B | 75 B | `bpp_caps_q` |
| `bodies` | 33 B empty | 1,307 B | `deaths` |
| `fx` | 271 B | 271 B | `deaths`, `bpp_caps_q` |

**Two limits matter:**
- **The 65,535-byte frame limit.** `server/ws.js` drops anything larger, silently (F-009). The admin's debug snapshot is already at half of it with 21 entities.
- **The 1,400-byte limit** on what the server reads from a client (F-010). The largest client message in the client goldens is a `p` of 248 bytes.

**B++'s own load figures** (`STAGE_3E0_BPLUSPLUS_REPORT.md`, measured at B++, not re-measured here). 7 moving B+ players at 25 ms, 3 runs:

| | |
|---|---|
| Server CPU | 3.69 % |
| Per player | 27.7 KB/s down, 5.7 KB/s up |
| Messages per player | 39.9 down, 30.9 up per second |
| B+'s pose path | 0.07 % of one core |

## 4. Browser frame cost (software renderer)

| Probe | Measure | Run 1 | Run 2 |
|---|---|---|---|
| `contact_lab.py` `perf` (A/A, the same files twice) | BR-RoLE ms per frame, mean / p95 / max | 11.69 / 15.5 / 20.5 | 11.96 / 16.5 / 16.8 |
| | page frame ms, mean / p95 | 206.8 / 283.3 | 202.1 / 300.0 |
| `gameplay_smoke.py` | page frame ms standing, mean / p95 | 252.1 / 300 | — |
| | page frame ms walking, mean / p95 / max | 254.2 / 300 / 350 | — |
| | BR-RoLE ms per frame, mean / p95 / max | 31.6 / 55.2 / 68.9 | — |
| `two_browser.py` (B+ mode, 2 pages) | Bob's page, median frame ms | 91.1 | 93.5 |

**BR-RoLE's A/A difference** in the same scene is about 2 % on the mean and 1 ms on the p95. Different scenes differ far more: 11.7 ms in the lab's room, 31.6 ms in the smoke's walk. So a comparison is valid only scene against the same scene.

## 5. Rules for a later 3H step

1. **Run the same probe on the parent and on the change, interleaved,** on the same machine, with at least the A/A rounds above.
2. **A change passes when its median is within the A/A tolerance.** A step that only moves code should not move any number beyond its A/A spread.
3. **Never quote a SwiftShader number as a frame rate.** Real-GPU checks belong to the user's Human QA, on their own hardware.
4. **For a server-only step** (C-1, C-2 in `dev/stage-3h/3H1_EXTRACTION_CANDIDATES.md`), `perf_det.js`'s server half and the snapshot cadence in §2 are the relevant probes.
