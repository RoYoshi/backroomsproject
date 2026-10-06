# BR-RoLE 1.0: performance

BR3 ran **one focused desktop pass** and **one focused low-end/mobile pass**, as the finalization pack asks. It did not run a matrix, and it did not repeat a pass: no meaningful regression needed a diagnosis.

- **Tools:**
  - `dev/br-role/perf_br.js`: the scenes and the counters;
  - `dev/br-role/soak_br.js`: the leak and cache-growth sanity check.
- **Raw results:** `dev/br-role/evidence/br3/`
  - `perf_desktop_before.json`, `perf_desktop.json`, `perf_mobile.json`;
  - `soak.json`.

> **Read every number here as relative.** This container has no GPU: Chromium renders through **SwiftShader**, a software rasterizer. A whole page frame takes about 450–630 ms on the desktop profile. The v23.3.6 lighting (the DEV legacy switch, measured in the same scenes) takes the same, because the game's own drawing dominates. So absolute frame rates here say nothing about a real PC or phone.
>
> What the numbers do show:
> - **BR-RoLE's own time per frame**, from its counters;
> - **BR-RoLE's share of the frame**;
> - **how scenes and tiers compare**;
> - **whether anything grows** over time.

## What BR3 tuned

All the BR2.1 visuals are unchanged: the same fields, shadows, softness and tiers.

**1. Beam culling (sector box).**
- **Before:** a flashlight or headlamp worked in the box of its **whole circle**, from the field to the scratch clears to the tint copy.
- **Now:** it works in the box of its **cone**. The field is zero outside the cone, so nothing visible changes.
- **Gain:** at the spawn hall at MEDIUM, the box is 117 066 px instead of 482 052 px (unit check U31).
- An omni lantern keeps its circle.

**2. Shadow fills clipped to the light's box.**
- Every shadow fill of a light now stays inside that light's own pixel box (an axis-aligned rectangle, never a visibility shape). This covers:
  - the single-point path;
  - the multi-point mask;
  - the per-sample prop temp;
  - the carried field's unbounded `source-in` / `destination-in` operations.
- **Before:** wall shadow polygons, which reach far past the light, were rasterized across the whole buffer.
- A unit check (U02) allows only integer axis-aligned box clips. Another (U25) guards that world-space fills are still drawn in world space inside the clip.

**3. Counters.**
- `stats().frameMs` now gives **p95** and the number of frames sampled.
- `stats().lamps.buildMaxMs` gives the longest single lamp-field build.
- `resetStats()` no longer resets the frame counter. Lamp fades and actor easing count frames, so a reset in the middle of a fade could restart it. This was a bug in a DEV/QA API; play never called it.

**4. Budgets: reviewed and kept as they were.**

| budget | value | why it was kept |
|---|---|---|
| lamp-field cache | 24 / 32 / 40 | Held at its cap through the soak, at about 5 / 8.6 / 15.3 MPx of live canvases. Nothing grew. Raising it costs memory on phones, and lowering it would rebuild fields while you walk back and forth. |
| lamp builds per frame | 2 / 3 / 4, plus a 6 ms budget | Arrivals in new regions now peak at about 36–64 ms of BR-RoLE time at MEDIUM on the software renderer (77 ms before). Lowering it would make lamps fade in later. |
| buffer scale | ½ / ¾ / 1 | The model's resolution. Lowering it softens edges, which is a visual change. |
| tube / hand points | 16 / 16 / 32, 1 / 4 / 6 | The BR2C softness the user approved. |
| props, actors, peers | unchanged | The caps already hold with 40 extra props and 8 players (unit checks). |
| self-shading opacity, shadow length and softness caps | unchanged | They are visual, approved in BR2.1. |

## Desktop pass

**Setup:** 1280 × 720 at DPR 1, MEDIUM and HIGH. The pass was run on BR2.1 (before) and on 1.0 (after) with the same script. Each scene sampled 6 s after a 1.5 s settle.

**BR-RoLE's own ms per frame** (mean / p95):

| scene | MEDIUM before | MEDIUM 1.0 | HIGH before | HIGH 1.0 |
|---|---|---|---|---|
| lamps (spawn hall, light off) | 12.2 / 17.0 | 14.0 / 17.5 | 20.3 / 25.9 | 23.4 / 30.4 |
| beam (flashlight + spawn lamps) | 32.3 / 36.6 | **23.2 / 28.8** | 59.6 / 68.9 | **39.1 / 44.6** |
| props (HUMMING ROOMS counter, lamps + beam) | 46.6 / 57.4 | **33.2 / 42.1** | 96.9 / 111.1 | **74.4** / 115.6 |
| hound (a Hound in your beam) | 40.9 / 57.8 | **26.5 / 31.9** | 64.5 / 85.0 | **57.3** / 111.8 |
| peers (a scripted second player's beam crossing yours) | 56.0 / 63.1 | **33.5 / 44.8** | 101.2 / 112.0 | **52.4 / 59.8** |

**Lamps-only scenes:**
- BR3 changes nothing for a lamp: each lamp is one cached image per frame.
- The +2–3 ms is noise between the two runs on this shared software renderer.

**HIGH p95 in props and hound:**
- One or two frames in each sample overlapped a lamp-field build: `buildMaxMs` was 47.7 and 55.1 in those samples.
- These are the same one-off builds as on arrival (below), not a steady cost.

**Whole-page frame interval** (the rAF interval):

| | interval |
|---|---|
| BR-RoLE, MEDIUM | 453–550 ms |
| v23.3.6 legacy lighting | 474–531 ms |

The legacy lighting ran in the same scenes, in the same run. The page's own drawing dominates on software rendering.

**Travel** (teleporting into four new lamp regions; the worst BR-RoLE frame after each arrival):

| | BR2.1 | 1.0 |
|---|---|---|
| MEDIUM | 47–77 ms | **36–64 ms** |
| HIGH | 96–127 ms | **49–88 ms** |

At most 11 builds per arrival, spread over frames by the per-frame budget.

**Quality switch** (LOW → HIGH → MEDIUM at the spawn):
- the worst BR-RoLE frame: 23 / 31 / 36 ms;
- 7 rebuilds each time.

## Low-end / mobile pass

**Setup:**
- 412 × 915 at DPR 2.625, touch;
- Chrome's CPU throttling ×4, on top of software rendering;
- LOW (the default on touch / small screens), with MEDIUM for comparison.

| scene | legacy frame interval | LOW: frame interval | LOW: BR-RoLE ms (mean / p95) | MEDIUM: BR-RoLE ms (mean / p95) |
|---|---|---|---|---|
| lamps | 1355 | 1370 | 11.3 / 23.1 | 38.2 / 40.6 |
| beam | 1332 | 1304 | 25.7 / 32.1 | 60.0 / 75.2 |
| props | 1850 | 1752 | 43.3 / 50.9 | 96.6 / 113.4 |
| hound | 1230 | 1453 | 36.8 / 64.5 | 69.7 / 111.9 |
| peers | 1334 | 1356 | 30.8 / 55.3 | 81.1 / 93.2 |

- **The buffer follows the CSS viewport, never the DPR.** At DPR 2.625 the LOW buffer is 206 × 458, not 1082 × 2402. That is why the phone profile's BR-RoLE cost stays near the desktop's.
- **BR-RoLE's share at LOW is about 1–3 %** of a frame in this emulation. The whole-page interval is within run-to-run noise of the legacy lighting's, except the hound scene: the Hound moves between samples, so that scene's frames are not the same frames.
- **Lamp-field builds are the one notable cost** when you enter a new area on a slow device:
  - the longest single build was 43 ms at LOW and 83 ms at MEDIUM (a counter area with props, ×4 throttled software);
  - the per-frame budget stops further builds in that frame, but it cannot split one build;
  - this is a one-off on arrival, never a steady cost.

  It is listed for the human QA on a real phone (question 11). If it shows as a hitch there, the follow-up is to lower LOW's cache resolution (.3) or its tube points for builds only. That is a tuning change, not done here without a real device to judge it.

## Leak / cache-growth sanity (`soak_br.js`)

**Setup:**
- one page, flashlight on;
- 7 cycles of teleporting through 8 lamp regions across the whole map;
- a quality switch every other cycle;
- garbage forced after each cycle through the DevTools protocol.

| cycle | quality | JS heap | live canvases | live canvas MPx | lamp cache / cap | evictions (total) | errors |
|---|---|---|---|---|---|---|---|
| 0 | MEDIUM | 45.2 MB | 57 | 8.56 | 32 / 32 | 23 | 0 |
| 1 | HIGH | 45.2 MB | 65 | 15.33 | 40 / 40 | 35 | 0 |
| 2 | HIGH | 45.2 MB | 66 | 15.33 | 40 / 40 | 89 | 0 |
| 3 | LOW | 45.2 MB | 49 | 5.19 | 24 / 24 | 119 | 0 |
| 4 | LOW | 45.2 MB | 49 | 5.19 | 24 / 24 | 174 | 0 |
| 5 | MEDIUM | 45.2 MB | 57 | 8.56 | 32 / 32 | 196 | 0 |
| 6 | MEDIUM | 45.2 MB | 57 | 8.56 | 32 / 32 | 251 | 0 |

- **Heap:** flat.
- **Live canvases:** they return to the same count and pixels for the same tier: 57 / 8.56 MPx at MEDIUM in cycles 0, 5 and 6. Evicted lamp fields are released; 435 canvases were created in total, and the rest were collected.
- **Cache:** never above its cap.
- **Errors:** BR-RoLE never disabled itself, and the page had no errors.
- **Verdict:** no leak, and no cache growth.

## Reproduce

```
node dev/br-role/perf_br.js --game . --profile desktop --out perf_desktop.json
node dev/br-role/perf_br.js --game . --profile mobile  --out perf_mobile.json
node dev/br-role/soak_br.js --game . --cycles 7 --out soak.json
```
