# Stage 3B final: the whole of Level 0, human QA

**Status: `STAGE 3B FULL-MAP HUMAN-QA CANDIDATE — WAITING FOR USER`**

This continues from the approved QA2 candidate. It is not a restart.
- **Every room and every corridor** of Level 0 now uses the remaster.
- **The four QA2 rooms look as you approved them.** The one exception is a one-texel outline at the base of their walls, changed by a doorway-seam fix; it is not visible in play.
- **Gameplay is unchanged:** the same walls, props, footprints, lamps, surfaces and rules (the freeze check proves it, see the receipt).
- **Your verdict decides.** Nothing here assumes Stage 3B is accepted.

| | |
|---|---|
| branch | `stage-3b-remaster`; the commit and tree are in `STAGE_3B_FINAL_PACKAGE_RECEIPT.txt` |
| ancestry | QA2 `d124371` → BR-RoLE 1.0 `b86966b` → gameplay v23.3.6 `f2805bb` |
| untouched | `main`; Stage 3B-N and Stage 3C not begun |
| start | `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000/?dev3b=1>. You spawn in YELLOW HALL. |

## What changed since QA2

1. **The rest of the map.** NORTH, REPEATING and SEGMENTED ROOMS and every corridor, plus the special rooms:
   - LONG ROOM: a concrete slab, with its ten pits drawn as pits;
   - DAMP ROOMS: old wet vinyl tile;
   - RED ROOMS: a deep red, coarse, sticky carpet and paper peeling to crimson; the corridors that lead there turn red as you approach;
   - ARCH GALLERY: pale paper and archways;
   - DEEP CARPET: a deeper, shaggier pile.
2. **The doorway strips are gone.** The carpet runs on unbroken through every doorway. Where carpet meets concrete or tile, you see the carpet's own bound edge, with no metal strip.
3. **The remaining props**, per `STAGE_3B_FINAL_PROP_CANON_AUDIT.md`. Footprints, heights and collisions are exactly as before.
   - the "shelf" becomes a fallen section of ductwork;
   - the "machine" becomes a dead building-services cabinet;
   - also: the bare bench, the guard rail, the low walls, the window openings and the crawl holes.
4. **Cheaper to draw.**
   - **The fix:** with the remaster on, the old level art hidden underneath it is no longer drawn.
   - **The result in my tests:** the scene now costs **less than the old look** at all 12 poses measured: 1.3–2.0 screens of fill instead of 2.2–3.4, and 25–48 % shorter frames in software rendering.
   - **Tier changes:** a change now rebuilds in the background instead of freezing for about 1.5 s.
   - Details: `STAGE_3B_FINAL_PERFORMANCE.md` and `STAGE_3B_FINAL_RENDERING_OPTIMIZATION.md`.

## Tools (QA only, with `?dev3b=1`)

| what | how |
|---|---|
| remaster ON / OFF, live | **F8**. The readout at the bottom left shows the state, the tier, the frame time and the scene's GPU time. |
| the exact old look | `http://localhost:8000/?remaster=off` in a second tab |
| LOW / MEDIUM / HIGH | SETTINGS ▸ CUSTOMIZE ▸ LIGHTING. The new tier swaps in when its background rebuild ends; the readout says `REBUILDING <TIER>` meanwhile. **MEDIUM is the main target.** |
| marks on / off | **Shift+F8** |
| a test mark on the wall ahead (never blood) | **Shift+F9**; reload the page to clear it |

## The tour (about 20 minutes, MEDIUM)

Each stop names what to look at; the numbers are the priorities in the questions below. Corridors join neighbouring rooms in each row, and short shafts join the rows.

| # | where | look at |
|---|---|---|
| 1 | **YELLOW HALL** (spawn) | F8 on/off a few times: frame and scene GPU in the readout [3]. Walk out of any doorway: the carpet continues with no strip and no seam [1, 7]. |
| 2 | north to **NORTH ROOMS**, east to **HUMMING ROOMS** | the stale rooms against the QA2 room: one place? [1] |
| 3 | east to **LONG ROOM** | the carpet's edge onto concrete at the doorway [1, 7]; the pits read as holes in the floor, with no wallpaper around them [2, 5] |
| 4 | east to **PILLAR HALL** | the pillar-heavy view: walk around the columns; any stutter? [3] |
| 5 | south to **ARCH GALLERY** | the archways in the two partitions, the window W2, the guard rail; crawl through the hole on the east side [2, 5] |
| 6 | west through **SEGMENTED** and **REPEATING ROOMS** | the bench (crawl under it), the knee wall, the fallen duct, the window W1, the two crawl holes [2, 5] |
| 7 | south of YELLOW HALL, **BLACKOUT ZONE** | your flashlight only: does anything new light up or read wrongly in the dark? [5, 6] |
| 8 | east to **DAMP ROOMS** | wet tile, the missing tiles (they are floor damage, not pits) and the soaked counter; the crawl hole in the partition [2, 5] |
| 9 | east along the corridor to **RED ROOMS** | the shift toward red as you approach, the crimson peel, the sticky coarse carpet [1, 2] |
| 10 | east to **DEEP CARPET** | the deep pile and the dead cabinet [2] |
| 11 | anywhere: SETTINGS → LOW, then HIGH, then MEDIUM | the same rooms at each tier; any hitch while it rebuilds [3, 4] |
| 12 | play a few minutes with Hounds or Smilers about | readability of monsters, other wanderers, the cartograph and crawl holes; hitches while running [3, 5] |
| 13 | a papered wall anywhere | Shift+F9: the mark stays attached, clipped and lit like the wall [6] |

## Performance (please do this on your usual machine)

1. At **MEDIUM**, stand still at stops 1, 4, 7 and 9. Press **F8** a few times, waiting 2–3 s on each side, and note the `frame` and `scene GPU` numbers with the remaster ON and OFF.
   - `scene GPU` is the best comparison. If it reads `n/a`, your browser doesn't expose the timer; use the frame time and feel.
   - A frame time pinned at your refresh rate (16.7 ms at 60 Hz) means you are capped and it can't show a difference.
2. Walk and run through a few rooms with the remaster ON. Do you feel any slowdown or hitch compared with OFF or with QA2?
3. Switch tiers once or twice. The old picture stays until the new one is ready, with a second or two of `REBUILDING`. Tell me if that causes a visible hitch.
4. If you can, try LOW on your weakest device.

Please send: your GPU (or laptop / phone model), browser, tier, and the ON / OFF numbers, or simply "no difference I can feel".

## Questions (yes / no / notes, in this order)

1. **Cohesion:** does the whole map feel like one Level 0? Do the doorways and transitions read naturally (carpet into concrete, tile and the red approach; RED into DEEP CARPET)?
2. **Too furnished, or non-canon:** is anything out of place? Do the fallen duct, the dead cabinet, the bench, the rail and the archways read as the building rather than furniture?
3. **Performance:** is the remaster now no slower than the old look on your machine (numbers if you can)? Any hitches, including on tier changes?
4. **LOW / MEDIUM / HIGH:** is it the same Level 0 at each tier? HIGH should be sharper, never showing more.
5. **Readability:** do monsters, other wanderers, the cartograph and the crawl holes read at least as well as before?
   - Is your flashlight's light still clear?
   - RED ROOMS has the darkest floor. Is a Hound in its unlit corners still easy enough to spot?
6. **Walls and surfaces:** do the wall marks and the Shift+F9 test mark stay attached, clipped and lit like the wall?
7. **Seams and slice artefacts:** any visible seam, line, colour jump or square chunk edge anywhere, especially at doorways?

## Known limits

- **Software-rendering measurements only.** My numbers come from a container without a GPU. Your machine decides.
- **The first build is still made during loading**, about 1.5 s here (less on a real machine). Only tier changes rebuild in the background.
- **While the remaster shows, the old level art rests.** The insides of very deep walls then show the renderer's background instead of the old dark fill. It is dark either way, and play never shows those insides.
- **F9 wall depth stays deferred:** non-evaluable, off by default.
- **No dynamic decals in play.** The surface receiver covers the whole map, but nothing in the game stamps marks yet. Blood belongs to a later stage.
- **Reserved for Stage 3B-N, not touched here:**
  - `server.js` does not serve `camera_policy.js` / `timing_policy.js` (404);
  - Hound blind pursuit and sound recency;
  - Shift-while-crouched;
  - true darkness;
  - the danger flicker's line of sight.
