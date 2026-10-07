# Stage 3B final: rendering optimization

**Rule followed:** "VISUAL PARITY FIRST. PERFORMANCE THROUGH ENGINEERING." Every saving below removes work nobody sees, or moves work off the frames you play; none of it changes what is on screen.

**What was not touched:**
- the camera FOV, the visible area and the camera scale;
- BR-RoLE (`assets/br-role.js`) and its correctness;
- the readability of entities, items and crawl holes;
- gameplay geometry.

## Where the cost was (measured before changing anything)

Tool: `dev/stage-3b/perf_3b.js`, as in QA2.
- **Overdraw:** how many times the Pixi scene's layers cover the screen, counted exactly from the shapes. It is noise-free, and it is what costs a real GPU.
- **Scene time:** the Pixi scene rendered with the GPU synced, while the camera moves by half a pixel per frame, as it does in play.
- **The machine:** a container without a GPU (SwiftShader), so only the **relative** numbers mean anything.

After 3B-F2, with every room remastered, the remaster's own cost was what QA2 had made it: one baked layer per screen, about what the old carpet cost. Three things remained.

1. **The legacy level art was still drawn underneath.**
   - **What it is:** one Graphics object of about **14 500 instructions**: floor blots, walls, props, pits, pillars, room tint rectangles and painted lamp glows.
   - **What it cost:** **0.3–1.5 screens of pixels** every frame, depending on where you stand, all hidden under the remaster's opaque chunks.
     - **The most** where the old art stacked room tints and glows: BLACKOUT ZONE, RED ROOMS, DEEP CARPET and DAMP ROOMS.
     - **A correction:** the 3B-F3 commit message said 1.1–2.4 screens. That figure counted all of the game's shapes together. The level art's own share is the one above.
   - **CPU too:** because the camera moves the world every frame, Pixi re-transforms all of its vertices on the CPU.
2. **A tier change rebuilt everything at once:** 1.1–1.6 s in one frame here, a visible freeze.
3. **Textures were uploaded on first use**, inside the frame that first needed them.

## What was done

### 1. One bake grid for the whole map (3B-F1)

QA2 had one chunk grid per room, clipped to the room's box: right for four separate rooms, wrong for a whole map, where grids would overlap at every doorway.

**Now:**
- **Grid:** one 384 px grid covers the map (350 chunks).
- **One texture per chunk:** a chunk bakes **every zone with content in it** into that one texture (rooms, corridor pieces, the wall faces they own).
- **On screen:** one quad per visible chunk, as in QA2; about 6 chunks are in view at 1280 × 720.
- **Streaming and memory:** chunks bake as they come into view, a ring ahead, and the tier's cache drops the oldest (MEDIUM keeps about 20, about 4 MPx).

### 2. A faster build (3B-F1)

The full map has **29 zones** (12 rooms and 17 corridor pieces) against QA2's 4 rooms. To keep loading short:
- **No repeated lookups:** the map masks are read once into typed arrays, instead of per-cell lookups through the game's tables.
- **Cheaper searches:** the traffic-lane search uses a heap (Dijkstra) with QA2's exact tie order, and a separable kernel.
- **Per zone:** wear and approach colours are computed once per zone, and only near doorways.
- **On first use:** the DEV-only wall-depth textures are made only when needed.

**Results:**
- **The zones:** all 29 build in about 0.72 s here; QA2's four rooms took about 0.30 s.
- **The first build at load,** in the browser here, for the whole map at MEDIUM: about **1.4–1.5 s** (textures about 0.67 s, zones about 0.72 s). QA2 took 0.68 s for 4 rooms.
- **Texture memory** grew with the new materials (concrete, tile, deep and coarse pile, pits): from 2.58 to 5.83 MPx.

### 3. The legacy level art rests while the remaster shows (3B-F3)

Once every floor cell and every wall face beside floor is covered by baked chunks, the legacy level art draws nothing anybody can see. So, **while the remaster shows**, it is hidden.

- **Same picture:** every wall top beside floor is drawn once in the bake, by the zone whose floor it touches, so the picture keeps every edge the legacy art gave it.
- **Where it shows again, unchanged:**
  - remaster OFF (`F8`, `?remaster=off`);
  - any failure (the fail-safe);
  - a partial slice;
  - `dev.keepLevelArt` (DEV).
- **Equivalence, checked** (`dev/stage-3b/levelart_3b.js`):
  - **the bare scene,** with the art kept and with it resting, is **pixel-identical** at 7 poses;
  - **the frame as played** differs only by the wanderer's breathing animation;
  - evidence: `evidence/f3/levelart_equivalence.json` and `levelart-red-rooms-kept-vs-resting.jpg`.
- **Effect, MEDIUM, same poses:**

| pose | overdraw before → after (screens) | scene time here | draw calls | Graphics instructions |
|---|---|---|---|---|
| YELLOW HALL | 2.20 → **1.89** | −33 % | 7.7 → 5.5 | 14 500 → about 170 |
| BLACKOUT ZONE | 3.16 → **1.81** | −45 % | 7.7 → 5.5 | |
| PILLAR HALL | 2.29 → **1.94** | −31 % | 7.7 → 5.5 | |
| RED ROOMS | 3.36 → **1.92** | −52 % | 7.7 → 5.5 | |

The "before" column is the remaster *off* (the old look) in each row. With the remaster on before 3B-F3, the overdraw equalled it (QA2's result); now it is lower. The old look drew the full-world carpet sprite and then all of the level art on top.

### 4. Tier changes rebuild in the background (3B-F3)

- **The job:** changing LOW / MEDIUM / HIGH starts a background build of the new tier. The old tier stays on screen until the new one is complete, then swaps in, in one step.
- **Its budget:** each frame gives it a quarter of the previous frame's time, between 6 and 40 ms: **6 ms a frame at 60 fps**.
- **Small steps:** the big texture generators yield every 32 rows, and the zone builds yield between sections and every 4 map rows, so no step is long.
- **Change your mind:** switching back to the tier on screen abandons the job.
- **Measured here** (frames take 250–350 ms in this container, so the budget is large):

| tier | frames to rebuild | longest step | the job's largest share of a frame | the swap |
|---|---|---|---|---|
| LOW | 17–18 | 32 ms | 52 ms | 29 ms |
| MEDIUM | 22–24 | 29 ms | 48 ms | 18 ms |
| HIGH | 31–32 | 31 ms | 53 ms | 34 ms |

  Before: the same rebuild ran in one frame, 1.1–1.6 s.
- **Proven:** a background build produces exactly the same art as a build made at once, and frees the old tier's textures (unit check R17).
- **Kept:** the chunk grid and its render textures are kept across a rebuild and only re-baked.

### 5. Textures uploaded ahead of need (3B-F3)

- **When:** after a build, on quiet frames (no job running, no bake pending), the module uploads the source textures to the GPU ahead of first use.
- **How much:** largest first, at most 1.2 MPx per frame.
- **Why:** the first bake of a new area no longer pays for the upload inside the frame you are playing.

## Final measurements (3B-F4, the candidate)

Full tables: `STAGE_3B_FINAL_PERFORMANCE.md`. Raw JSON: `dev/stage-3b/evidence/f4/perf/`.
- **Overdraw at MEDIUM, 12 poses:** 1.26–2.01 screens with the remaster on, against 2.16–3.42 for the old look. The same at LOW and HIGH.
- **Scene time here:** 30–52 % less (MEDIUM, LOW, HIGH).
- **Frame interval here:** 25–48 % shorter.
- **Draw calls:** 7.7 → 5.5.
- **Moving through eight rooms at running speed:** the remaster's frames stayed shorter than the old look's, with at most 3 chunk bakes and under 6 ms of baking in any frame.
- **Tier changes:** rebuilt over 16–43 frames, never in one.

**One visual fix in 3B-F4,** from the tier comparison:
- **The problem:** at LOW, the RED and DEEP pile overlays came out twice as coarse. Their noise followed the texture's texel count.
- **The fix:** they are now made at MEDIUM's size and box-filtered down. LOW keeps its smaller texture and memory.
- **Unchanged:** MEDIUM and HIGH are byte-identical (unit check R18).

## What was considered and not done

- **Making the first build at load a background job too.** The game would show the old look for a few seconds and then swap, a visible pop at every start. The 1.4 s here happens during loading, before you play.
- **Lowering resolution, the bake density or the camera's view for speed.** These are not allowed: they would change what you see. The bake density follows the screen and is clamped per tier, as in QA2.
- **Touching BR-RoLE's lighting cost.** BR-RoLE is out of scope for this pack.

## Known limits

- **SwiftShader only.** None of these numbers is your hardware.
- **While the level art rests**, the inside of very deep walls shows the renderer's background instead of the legacy dark fill. Play never shows those insides: BR-RoLE's darkness covers them.
- **A tier change on a real machine** may still make a frame or two run long while the new tier builds (its longest single steps are a big room's traffic lanes and a wallpaper texture). It never freezes.
