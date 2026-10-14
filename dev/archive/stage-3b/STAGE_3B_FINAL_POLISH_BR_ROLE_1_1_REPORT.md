# Stage 3B Final Polish — BR-RoLE 1.1 Report (Phase B, Stage 3B-L)

**Goal:** natural fluorescent falloff and legitimate indirect spill, keeping the darkness.
**Branch:** `stage-3b-l`, built on the camera checkpoint `b2783b3`.
**Scope:** `assets/br-role.js` is the only game file changed. Gameplay light truth is untouched: the server's lamp field
(reach 380 px), `light.js` and the bundle's `Ul()` are unchanged, and no AI was retuned.

## What was wrong in BR-RoLE 1.0

1. **A hard lamp radius.** A lamp's field was a radial gradient with stops 1 / .35 / 0, so the light was gone at 380 px.
   The slope jumped there, and in a corridor or at the edge of a lit room the pool ended in a visible circle.
2. **A hard sight radius.** The game's line of sight stops 700 px from the viewer, and that is the clip the light is cut
   inside. At the 1.25 camera the screen reaches 768 px to each side, so lit floor ended in a sharp arc at the left and
   right of the screen.
3. **Fake visibility.** v23.3.6's sourceless glow around the viewer was still drawn every frame: alpha .14 at you,
   .045 at 335 px, 0 at 670 px, unblocked by walls. Nothing was ever truly black near you.

## BR-RoLE 1.1

### Smooth falloff, no edge (law: LIGHT HAS NO VISIBLE HARD RADIUS)

`f(d) = exp(-(d / 168)^1.47)`. It is smoothstepped to exactly 0 between 520 and 640 px, where it is under 1 % and invisible.
Within the old 380 px it closely matches the old curve's energy. Beyond it, light thins into a faint tail instead of stopping.

| d (px) | 100 | 193 | 300 | 380 | 450 | 500 | 640 |
|---|---|---|---|---|---|---|---|
| 1.0 (old stops) | .673 | .350 | .150 | **0** | 0 | 0 | 0 |
| 1.1 `f(d)` | .627 | .293 | .096 | .036 | .014 | .007 | **0** |

`falloff_3bl.js` checks it:
- **R1:** never rising, no slope jump anywhere. The largest slope change is 3× smaller than the old edge's, and it sits at the fixture, not at a radius.
- **R3 / R4:** the cached and rendered light run smoothly past 380 px and reach black (0/255) by ~580 px in a corridor lit from one end.
- **R5:** two lamps 480 px apart overlap without a seam or a dark ring.

### A broad fluorescent source

`d` is the distance to the **tube**, a line along the fixture (±30 px), not to a point. The light is broad and elongated
around the fixture and rounds out with distance. At 200 px it is 1.3× brighter along the tube than across it (R2).
Shadows are still cast from 16 / 16 / 32 tube points (LOW / MEDIUM / HIGH), averaged, as in 1.0.

### The sight edge fades, never cuts

Every light now fades out over the last 80 px before the 700 px line-of-sight reach, filling the ring only. This only
ever *removes* light: nothing is shown that was not shown before, the clip itself is unchanged, and fairness holds
because the fade is in world space.
- R6, on the overlay itself: the largest step near the reach is 1 / 255 per 4 px, against 5 / 255 without the fade.

### True black (laws: NO SURVIVING LIGHT = NO VISIBILITY; DARKNESS MAY NEVER BE SOFTENED BY FAKE VISIBILITY)

The sourceless glow is **removed**. Nothing replaces it. Where no lamp, carried light or lamp bounce reaches, the
overlay stays fully opaque.
- Scenes D and F: the BLACKOUT ZONE stays at overlay 255 everywhere with your light off.
- The parent's minimum was 219 (14 % visibility) there.

This is the "old fake ambient floor" the spec says not to restore. In the parent it also lightened lit rooms near you,
so rooms read about 20 % darker on average near the player. The lamp pools themselves are unchanged.

### Legitimate first-order bounce (law: LIGHT MAY GO AROUND GEOMETRY BY LEGITIMATE REFLECTION, NEVER THROUGH IT)

For each lamp, once, cached with it:
- **Bounce points.** Every wall or pillar side facing the lamp is sampled every 36 / 44 / 56 px (HIGH / MEDIUM / LOW),
  2 px in front of the side. The floor is sampled on a world grid every 80 / 96 / 120 px.
- **Only directly lit surfaces bounce.** A point's irradiance is the lamp's direct field × the cosine on a wall × the
  share of the tube that sees it. That share uses the game's own ray query, so walls and pillars stop it: a point the
  lamp does not light emits nothing.
- **What it re-emits.** A point sends out `bounce × albedo × irradiance × (the surface it stands for)`. The surface share
  keeps every tier adding the same light.
- **The lobe.** A wall's lobe leans out of its wall and falls off as `exp(-(r/130)^1.2)` to zero within 330 px. A floor
  patch's lobe is round, `exp(-(r/110)^1.2)` to zero within 300 px. **Strong decay; first order only.**
- **Each bounce point casts its own wall and pillar shadows** (a point source). So bounce light reaches round a corner
  only along an open lamp → surface → point path, and never through a wall or a pillar.
- **Kept small.** Bounce is ~16 % of the light in lit areas. The direct field is scaled to 0.88, so a lit room keeps its
  overall brightness instead of getting brighter.
- **Albedo** (restrained; the yellow chevron paper = 1):

  | surface | albedo |
  |---|---|
  | ARCH GALLERY pale paper | 1.12 |
  | RED ROOMS paper peeled to crimson | 0.55 |
  | carpet | 0.6 |
  | DEEP CARPET | 0.42 |
  | RED ROOMS carpet | 0.36 |
  | LONG ROOM concrete | 0.72 |
  | DAMP ROOMS wet tile | 0.8 |

  No surface emits light on its own.

### Bounded and cached

- **Core cache** (fine; d < 400): the per-tier field drawn 1:1, then the tube's averaged shadow mask taken out.
  It is built once per lamp per tier, as in 1.0.
- **Far cache** (low resolution, 0.08 / 0.11 / 0.14 px per world px): the field beyond the core, crossfaded over
  300–400 px so the split never shows, plus the bounce light.
  - It is built in steps within a per-frame budget (2 / 3 / 4 ms), deterministic and geometry only, then faded in.
  - It is drawn through a quarter-resolution buffer, stored ×2 for 8-bit precision, and added once.
- **Lamp selection:** a lamp counts only if its light reaches both the screen and the line of sight's reach.
  The tier caps (8 / 10 / 14) and LRU caches are unchanged.
- **Updates:** a lamp's strength (flicker, failures, NV gain, blackout) still applies at draw time, so its far light and
  bounce follow it exactly. A dead lamp has no bounce either. Caches are rebuilt only on a quality change.
- **Tiers** change sampling and resolution only, never the logic or the reach.

## Evidence

| check | result |
|---|---|
| **O1–O4 zero transmission** (`occlusion_3bl.js`) | **5 / 5 PASS** over 36 lamps (every third lamp plus all of PILLAR HALL): 2 419 882 lit core texels and 242 201 lit far / bounce texels checked, **none through geometry**; 3 022 texels lit only by a legitimate bounce path, over 23 lamps; the brightest is 8.5 / 255 against a lamp's 202 / 255 peak (P0 scale) |
| **R1–R6 no hard radius** (`falloff_3bl.js`) | **6 / 6 PASS**: field edgeless (R1); broad source (R2); cached light never rising, lit past 380 px, dark at the bound (R3); a corridor lit from one end reads 30, 12, 4, 3, 2, 1, 1, 0 / 255 at 200 … 580 px (R4); two lamps overlap with no seam (R5); the sight edge's largest step is 1 / 255 instead of 5 / 255 (R6) |
| **BR-RoLE unit checks** (`dev/br-role/test_br_role.js`) | **32 / 32**; updated where they encoded 1.0's 760 px cache, its radial field, and lamps reaching exactly 0 at 380 px |
| **BR-RoLE browser smoke** (`dev/br-role/smoke.js`) | **12 / 12**: light composition, prop blocking, actor shadows, tiers, gameplay messages unchanged, DEV legacy switch, no Smiler shadow, peers. Its direct-light checks run with bounce off and allow other lamps' faint tails (≤ 8 / 255) |
| **Stage 3B smoke** (`dev/stage-3b/smoke_3b.js`) | **9 / 9**: the remaster is unaffected, and BR-RoLE's overlay is byte-identical with the remaster on and off |
| **camera fast checks** (`dev/stage-3b-n/test_3bn.js`) | **7 / 7** on the final tree |
| **scenes A–G** (`look_3bl.js`, 1920×1080, lamps only) | before / after in `dev/stage-3b-l/evidence/` |

Notes on O1–O4:
- For each lamp audited, every lit texel of both caches is checked against the level's geometry with the game's own ray query.
- Light is allowed only within the caches' own resolution margin of a point that has a legitimate path: core 12 px (its 3 px mask blur and a texel), far 2 texels + 4 px. Walls are 96 px thick, pillars 56.
- A path is legitimate if it is direct (a tube point sees the texel) or first bounce (one of the lamp's own bounce points sees it, within reach).

Scenes (spec §9):

| scene | result |
|---|---|
| A, open room | smooth falloff, broad source, soft sight edge |
| B, corridor toward the BLACKOUT ZONE | thins out, then black |
| C, corridor mouth | light carries in from the room and the middle reaches black |
| D, BLACKOUT ZONE beside the DAMP ROOMS | the closed thick wall stays at overlay 255 |
| E, PILLAR HALL | the shadows are stable and get a faint fill, with no halo through the pillars |
| F, BLACKOUT ZONE | overlay 255 everywhere |
| G, several fixtures overlapping | lamps add naturally, with no rings |

## Gameplay consistency (no material contradiction found; nothing retuned)

Gameplay light (server AI lamp field, `light.js`) still ends at 380 px.
- **Beyond 380 px:** the visual tail is at most ~0.014 of light (3.5 / 255 at 380 px, 1.4 / 255 at 450 px): too faint to read as "lit", and on the side of
  looking darker than gameplay, never brighter.
- **Inside 380 px:** direct + bounce stays at the old level.
- **Fewer leaks than before:** removing the sourceless glow means entities in dark areas are now *less* visible than in
  the parent. That glow made everything within 670 px of you about 14 % visible, through walls.

## Known limits, left as they are (outside this pass)

- **Actor shadows:** an actor's cast shadow takes its dominant lamp's core light. The faint far light (under ~0.03) is left.
- **Far-cache resolution:** at its own resolution it softens far-field and bounce shadow edges by up to ~2 texels (9–18 px). This is never a wall's or a pillar's thickness.
- **Existing visibility and rendering issues, unchanged:**
  - the dread flicker in `mp.js` (lowers the overlay's opacity for a frame);
  - the PILLAR HALL lamps drawn on top of pillars;
  - the camcorder's infrared, drawn inside the hard 700 px clip.

  The first two were fixed in the superseded broad Stage 3B-N work, which this pack set aside.
- **Legacy path:** the DEV `?lighting=legacy` path still draws v23.3.6's lighting, glow included. It is not offered to players.
- **Spill in this level:** most floor near a lamp is directly lit by some lamp, because lamps sit on a grid in every room
  and the corridors are long and straight. So bounce-only spots are rare and faint. Where bounce shows, it shows as a
  soft fill in shadows next to bright surfaces.
