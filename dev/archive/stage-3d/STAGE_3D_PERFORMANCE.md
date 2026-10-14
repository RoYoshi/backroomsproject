# Stage 3D: performance

Every browser number here is from **SwiftShader**, Chromium's software renderer, on this build machine (2 CPUs). Use it to compare versions on the same machine; never read it as GPU performance. With two pages on two CPUs the renderer saturates the main thread (task time about 1,000 ms per second in every window). The measure is therefore the frame time (median of each window), and every comparison was made in the same session as the parent.

The thresholds were fixed at D0, before any change (`STAGE_3D_D0_AUDIT.md` §8). At D6 a stricter line was added: the same windows interleaved with the parent in the same session, within +10 %. The engineering, not a simpler world:
- **Sleeping:** at rest is at rest; the drying corpse stops being redrawn after 25 s.
- **Caching:** a corpse is one texture while on screen; wall-mark geometry, floor tests and reach rays are worked out once; the per-tile blocker cache in the physics.
- **Culling:** corpses off screen are not drawn and give their texture back (with a 64 px margin, so one at the screen edge is not rebuilt over and over).
- **Less redrawing:** the live blood is redrawn only when something visible changed.
- **Spreading the server's work:** the server's physical death advances a little on each pass of its loop while the death plays, instead of all at once at its end.

The level, the lights, BR-RoLE and the blood's look (15 layers per pool) are unchanged. MEDIUM and HIGH are the same code paths.

All figures are from the final D6 run on the final tree (`evidence/d6/`, gated in `summary.json`).

## Result in one table

| Check | Result |
|---|---|
| D0's thresholds (deaths, idle, 20 corpses, heap) | all met, by a wide margin for the corpses |
| D6's stricter interleaved A/B line (+10 %) | idle and Hound C within it; **the Hound A death over it for the spectator (+10.9 %) and close for the victim (+8.5 %)**. Reported below, not passed; its cause was not found |
| The server's corpse simulation | about half the parent's, and spread over the death |
| Memory | no leak in the browser or the server; the server holds more resident memory than the parent, levelled off |

## Server

`perf_death_srv.js`: 30 spots per variant, 3D and the parent in the same session.

| | 3D | Parent |
|---|---|---|
| The whole physical death in one go (`bodyFor`), median per variant | 3.5–15.6 ms (sum of the eight 64.5 ms) | 11.7–21.5 ms (sum 136.8 ms) |
| The same, worst | 21.6 ms | 46.9 ms |
| As the server runs it now, spread over the death: the largest single tick | 0.15 ms median, 2.8 ms worst | – (the parent's fallback ran whole, in one tick) |
| When it runs | once per death | only when a victim never reported a corpse; at D0, 21–51 ms median, 132 ms worst |
| 60 Hz step, 0 or 24 corpses | 0.0003 ms | 0.0003 ms |
| `bodies`, 24 corpses (records as `death_srv` makes them) | 8,607 B (359 B each) | 8,692 B (362 B each) |
| A corpse as sent (with `de` and `ag`, one sample, `death_net` N10) | 384 B | 359 B at D0 (limit 395) |
| The death replay message | 222 B, sent by the server | about 230 B, relayed from the victim |

Clients no longer send their own replay and corpse (about 600 B per death up, plus the parent's re-broadcast of every corpse on each report). A corpse record's size depends on the player's name, look and light parts as at the parent; 3D adds `de`, `ag` and up to two wall marks.

**Memory.**

| Run | 3D | Parent |
|---|---|---|
| 48 deaths over WebSockets, forced GC after each (`server_soak.js`): heap | 6.9 → 7.2 MB (+0.005 MB per death) | +0.006 MB per death |
| the same: RSS | 60.7 MB, flat | 59.4 → 60.8 MB |
| 64 deaths, no forced GC (`--nogc 1`): RSS | 68 → peak 111 → 96 MB; no new peak in the last 16 deaths | 68–70 MB |
| the same: heap in use | at most 14.4 MB | at most 11.7 MB |
| 32 deaths with two browsers, the server's GC traced (`soak_gc/`): heap after each full collection | 6.3 → 8.1 MB | 6.4 → 8.0 MB |
| the same: RSS | 124 → 202 MB, in steps, then level for the last 12 deaths | 119 → 136 MB |

The JS heap shows no leak in either. The 3D server's resident memory is larger and grows in steps before it levels off. The JS heap stays at about 8 MB after each full collection, so the steps are memory outside it. That memory is most likely what V8's compiler and garbage-collector threads keep after the server starts running physics on every death; it was not identified further. The 16-death browser soak (`soak_d6.json`) ended while it was still rising (121 → 211 MB); the 32-death run shows where it levels.

## Browser

### Against D0's thresholds (`perf_death_d6.json`, worst of 3 rounds)

| Window | 3D, worst round (ms) | Limit (ms) |
|---|---|---|
| idle | 700 | 990 (D0's spread + 10 %) |
| Hound A death | 833 | 972 |
| Hound C death | 725 | 788 |
| Smiler A death | 867 | 1,137 |
| 20 corpses on screen | 767 | 2,502 |
| 20 corpses off screen | 642 | 735 (idle + 5 %) |
| largest JS heap sample | 118 MB | 136 MB (D0) |

### Against the parent in the same session (`perf_death_d6.json`, `perf_death_parent3.json`, 3 rounds)

Median of the rounds' frame-time medians, victim / spectator.

| Window | Parent (ms) | 3D (ms) | Change |
|---|---|---|---|
| 20 corpses on screen | 2,050 / 2,067 | 733 / 683 | **−64 % / −67 %** |
| 20 corpses off screen | 917 / 883 | 608 / 608 | **−34 % / −31 %** |
| idle | 700 / 667 | 633 / 633 | −10 % / −5 % |
| Hound A | 800 / 800 | 817 / 800 | +2 % / 0 % |
| Hound C | 667 / 683 | 650 / 667 | −3 % / −2 % |
| Smiler A | 800 / 800 | 783 / 800 | −2 % / 0 % |

The corpses were the one large cost at D0: every pool's 15 translucent layers rasterised again every frame. With 20 on screen, a frame now costs about what an empty hall does.

**HIGH lighting** (`perf_high/`, 2 rounds each, same session): corpses on screen −62 % / −64 %, off screen −27 % / −26 %, idle −1 % / −3 %, Smiler A +3 % / +4 %, Hound C +5 % / +4 %, **Hound A +8 % / +7 %**.

### Interleaved with the parent: D6's stricter line (`perf_ab/`)

Parent and 3D alternately, 2 rounds per run, idle and the two hound deaths only.

| Window | Victim, parent → 3D (ms) | Spectator, parent → 3D (ms) |
|---|---|---|
| idle | 742 → 733 (−1 %) | 700 → 717 (+2 %) |
| Hound A death | 783 → 850 (**+8.5 %**) | 767 → 850 (**+10.9 %**) |
| Hound C death (into a wall) | 696 → 733 (+5 %) | 675 → 717 (+6 %) |

(The whole death on both pages, pairs 7–10, 8 rounds each.)

How this was measured, in order, all kept:
1. **Pairs 1–3** (the planned run, 6 rounds each), with windows that start when the harness notices the death: Hound A +8.9 % / +10.0 %, Hound C +7 %, idle within ±3 %.
2. **Pairs 4–6**, because Hound A sat exactly on the line: +7.8 % / +9.3 %. All 20 rounds of pairs 1–10 by that measure: Hound A +7.9 % / +8.4 %.
3. Those windows hold only 4–5 frames, and 3D's Hound A windows were systematically shorter (2.5 s against 3.0 s). So `perf_death.py` gained a second measure (`whole_<v>`): the whole death, from the victim's first frame of it to the frame it finishes, on both pages over the same span. **Pairs 7–10** used it (the table above). It confirms the first: Hound A costs 3D about 8–11 % more per frame on this renderer, Hound C about 5 %.

**What is known about the Hound A cost:**
- It is not script time. The main thread's script time per second differs by about 5 ms of 1,000, and both pages are saturated the same way.
- It is not the amount of blood geometry. At the same moment of a paused Hound A death, the live blood holds the same 165 drawing instructions in both trees.
- It shows on HIGH lighting too (+8 % / +7 %).
- The likely contributors are the things 3D adds to a death's frames:
  - the spectator now draws the victim's light during the replay and plays the death sound;
  - the victim gets the light-landing and hat-landing sounds, with their filters and panning;
  - Hound A drops the light at its second blow and throws the hat at its third.
- These were not separated: on this renderer one window holds 4–6 frames, and single runs vary by ±10 %.

It is within D0's thresholds and is reported here rather than passed. On a real GPU none of this has been measured (below). In human QA, watch the Hound A death from both windows for any hitch.

### Memory, browser

**Soak** (`soak_d6.json`): 16 deaths in a row, all eight variants, after forced GC.
- JS heap: +0.27 MB per death (victim), +0.24 (spectator); the parent +0.28 / +0.31.
- Display objects: flat (+0 per death).
- Replays left behind: 0.
- At most 1 corpse view (one per player).

## Corrections made for performance (D6)

The first D6 run (kept: `perf_death_d6_attempt1.json`) put the Hound C death 10–16 % over the parent. Two causes were found and removed (`evidence/d6/corrections.md` §1–2):
1. **Drying corpses off screen.** They were redrawn (and their texture refreshed) even when off screen. Now only on screen, in coarser steps.
2. **Wall-mark geometry.** It was rebuilt on every redraw of the live blood. Now it is worked out once and kept; the same points are drawn.

An independent review then led to the server's death being spread over its ticks, a margin on corpse culling, and the jaw letting go once instead of every physics step (`corrections.md` §3). The A/B runs from before the review are kept in `perf_ab/attempt1/` and `perf_ab/run2_before_review/`.

## What was not measured here

- **Real GPUs and phones.** Nothing here measured them; MEDIUM and HIGH were timed only on this renderer.
- **Audio on its own.** Its cost is Web Audio nodes created per sound (a handful per death). It was not separated from the frame times above.
