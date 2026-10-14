# Stage 3B QA2: performance

**Status:** your real-machine retest is pending. Nothing here says performance is accepted. You are the final performance QA.

## The short version

You felt QA1 run **a little worse** on your machine. That was real, and I found why.

- **Cause:** QA1 drew each remastered room as **five or more room-sized layers** stacked on top of the old level art:
  - the carpet;
  - a multiplied wear map;
  - grounding;
  - stains;
  - walls.

  Together that was about **one extra full screen of pixels** for the graphics card to fill, every frame.
- **Not the cause:** the CPU. The JavaScript side of Pixi took about 0.1–0.5 ms with the remaster on or off.
- **The fix:** QA2 **bakes** each room's static art once into cached textures, so a room is now **one layer** on screen, about what the old carpet cost. In every room I measured, the pixels drawn with the remaster on now equal the old look.

## How it was measured

- **Tool:** `dev/stage-3b/perf_3b.js`, one bounded pass per checkpoint. Same tool, same machine, same poses (the four rooms plus one pose outside the slice), 1280 × 720, frozen world, no monsters.
- **Overdraw:** how many times the screen is covered by the Pixi scene's layers, counted exactly from the shapes. It is noise-free, and it is what costs a real GPU.
- **Scene time:** the Pixi scene rendered with the GPU synced, while the camera moves by half a pixel per frame, as it does in play.
- **Frame interval:** the page's real frame time, BR-RoLE included.

> **Caveat:** this container has no GPU. Chromium renders in software (SwiftShader), so a frame takes ~300 ms here. Absolute times mean nothing for your PC; the **relative** numbers and the overdraw do. The run-to-run noise on the software timings is about ±10 %.

Raw results are in `dev/stage-3b/evidence/qa2/`:
- `perf_qa1_*.json`: QA1, before;
- `perf_r1_*.json`: after the bake;
- `perf_qa2_*.json`: this candidate.

## Before and after

### Overdraw, MEDIUM, in screens of pixels (lower is cheaper)

| pose | old look | QA1 | QA2 |
|---|---|---|---|
| YELLOW HALL | 2.20 | 3.05 (+0.85) | **2.20** (±0) |
| HUMMING ROOMS | 2.44 | 3.30 (+0.86) | **2.44** (±0) |
| BLACKOUT ZONE | 3.16 | 4.25 (+1.09) | **3.18** (+0.02) |
| PILLAR HALL | 2.29 | 3.01 (+0.72) | **2.28** (−0.01) |
| outside the slice | 2.67 | 2.40 | **2.40** (−0.27) |

- **LOW and HIGH** give the same QA2 numbers. In QA1, LOW was +0.16 to +0.33.
- **Outside the slice** the remaster is slightly cheaper than the old look: its carpet copy skips wall cells, which the old full-world carpet sprite did not.

### What QA1 cost, by layer (YELLOW HALL / BLACKOUT ZONE, in screens)

| layer | YELLOW HALL | BLACKOUT ZONE |
|---|---|---|
| carpet | 0.90 | 0.88 |
| multiplied wear map | 0.68 | 0.68 |
| grounding | 0.17 | 0.22 |
| stains | 0.01 | 0.11 |
| walls | 0.07 | 0.09 |
| wall marks | | 0.06 |
| props and fixtures | | under 0.05 |

The old carpet sprite they replaced was 1.00. In QA2 all of these become one baked layer.

### Same-tool timings (software renderer, relative)

| | QA1: off → on | QA2: off → on |
|---|---|---|
| frame interval, YELLOW HALL | 288 → 374 ms (**+30 %**) | 286 → 290 ms (**+2 %**) |
| frame interval, HUMMING ROOMS | 317 → 407 ms (**+28 %**) | 310 → 322 ms (**+4 %**) |
| frame interval, BLACKOUT ZONE | | 332 → 354 ms (+7 %) |
| Pixi scene, YELLOW HALL | +25 % | +3 % on average over 15 pose/tier pairs (range −3 % to +12 %, i.e. noise) |
| Pixi scene, HUMMING ROOMS | +20 % | (same row) |
| draw calls per frame (old look: 8.8) | 17.3 | 9.9 |
| texture binds per frame | about 54 | about 23 |
| JavaScript time per render | 0.1–0.5 ms | 0.1–0.5 ms (unchanged) |

## What changed (presentation only)

### 1. Static precomposition: the bake (`assets/l0-remaster.js`)

- **Source containers:** each remastered room's layers (carpet, wear map, stains, grounding, thresholds, walls, wall marks, props, pillars) now form a container that is **never on screen**.
- **Chunks:**
  - The game's own renderer renders that container into **chunk textures**, 384 world px square (4 cells).
  - Chunks lie on a fixed grid, clipped to the room. A chunk with nothing of the room in it is never made.
  - On screen, a chunk is one textured quad. Quads batch together, and nothing is drawn per frame beyond them.
- **Texel density:**
  - It follows your screen: the camera scale × the renderer's resolution, clamped per tier.
  - It is never more texels than the screen can show, and whole texels per chunk.
  - At 1080p and DPR 1 it is about 1.18 texels per world px.
- **When chunks are baked (real culling):**
  - Chunks in view bake at once.
  - Chunks you are approaching bake 1 per frame (2 on HIGH), up to one chunk ahead.
  - Chunks out of view are not drawn, and the oldest are freed beyond the tier's cache.
- **Re-baking:** a chunk re-bakes only when its source changes. That happens with a DEV toggle, a stamped decal (only the chunks it touches), BR-RoLE's grounding visibility changing, or a large change in screen density.
- **What it does not change:**
  - The order in the scene: the remaster still sits right above the level art and under traces, corpses and actors.
  - BR-RoLE's overlay. A browser check proves it byte-identical with the remaster on and off.
- **Fail-safe:** without the renderer, the layers are drawn directly, as in QA1. The DEV readout then says `DIRECT`.

### 2. The one bundle change

The existing guarded `built()` hook now also passes `this.app`, so the module can reach the renderer:

```
__l0v.built(this.world, i, this.lampTop, this.app)
```

- `dev/stage-3b/freeze_3b.py` knows the new hook and still undoes it to the BR-RoLE 1.0 bytes, then to v23.3.6: FREEZE OK.
- No gameplay file changed.

### 3. Tiers (BR-RoLE's LOW / MEDIUM / HIGH)

| | LOW | MEDIUM | HIGH |
|---|---|---|---|
| source textures | 1.13 MPx | 2.58 MPx | 3.10 MPx |
| seeded decals | 166 | 290 | 290 |
| wear map | none | yes | yes, finer |
| bake density (texels per world px) | 0.6–1.0 | 0.75–1.5 | 0.9–2.0 |
| chunk cache | 12 | 20 | 20 |
| baked memory, typical | under 2 MPx | 3–4 MPx | up to ~12 MPx on a HiDPI screen |

- Every tier now costs the same **per frame**: one layer.
- **LOW is cheaper** in GPU memory and texture bandwidth, in build time (about 0.5 s against 0.7–1.0 s), and in bake time.
- **MEDIUM** stays the main target and keeps the full look.

### 4. Bake cost

- **Software renderer:** about 1–1.5 ms per chunk. The very first bake takes about 25 ms, because it uploads the source textures.
- **First sight of a room** bakes the chunks in view at once (typically 6–12). This happens once, unless the cache dropped them.
- **On a real GPU** this should be far less. Watch for a one-off hitch when you first see a remastered room, or right after changing the tier.

### 5. Look preserved

- Compared with the QA1 captures, fewer than 1 % of pixels differ by more than 8/255.
- The differences are hairline edges, resampled once, and the animated lamp glow.

## What is left, honestly

- **Per frame, the remaster now costs about what the old carpet did.** The remaining differences sit inside this renderer's noise. One extra draw call per frame remains, from the chunk batch.
- **Not proven here: your GPU.** Please retest using `STAGE_3B_QA2_HUMAN_QA.md` (section "Judging performance").
- **The DEV readout** (`?dev3b=1`) shows the scene's **GPU time** where your browser offers `EXT_disjoint_timer_query_webgl2`. Many desktop Chromes do. That number is the most direct comparison of remaster on and off on your machine. Where the browser doesn't offer it, the readout says `n/a` and shows only frame time, which a vsync cap (60/120/144 fps) can hide.
- **Found while profiling; not changed, and outside this stage:**
  - `server.js` (protected, unchanged since v23.3.6) does not serve `camera_policy.js` or `timing_policy.js`. Both return 404, so the bundle runs on its fallbacks, including a fixed 1.18 camera scale at every window size.
  - This belongs to the camera-policy verification you reserved for **Stage 3B-N**.
  - The bake's density follows whatever the camera really uses, so it stays correct either way.
