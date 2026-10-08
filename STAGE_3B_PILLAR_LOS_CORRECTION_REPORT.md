# Stage 3B Pillar LOS Correction — Report

**Stage 3B — Pillar LOS Presentation Correction ONLY.** Branch `stage-3b-pillar-los`, from the QA1 parent `stage-3b-l-qa1` `d3ec2269af873dbc381d223ad538a43ba06f5c45` (tree `cffbc3125619170d9a55344b2519042a720a798d`).

The final commit and tree, the ZIP's SHA-256 and the remote verification are in `STAGE_3B_PILLAR_LOS_CORRECTION_PACKAGE_RECEIPT.txt`.

## The complaint, and what it was

You approved the QA1 lighting. The one remaining complaint was **"The Pillars LOS Blocking is janky."** The audit seed's hypothesis was right, and the audit found a second cause beside it.

1. **No events at pillar corners.**
   - `Hl` builds the player's sight polygon. It casts 96 evenly spaced rays, plus angle − ε / angle / angle + ε at every corner in `Vl`.
   - `Vl` is built only from wall-grid transitions (`Hc`): 420 corners, and none of the nine 56×56 PILLAR HALL pillars (`Pc`).
   - So a pillar's black wedge was cut by whichever of the 96 rays (3.75° apart) touched it. Its edges sat on those fixed rays instead of the pillar's corners. They stood still while you moved, then jumped by up to ~3.6°, leaking hidden floor on one side and hiding visible floor on the other.
   - The exact ray query `Uc` always knew the real rectangles. Only the polygon's sampling of it was coarse.
2. **The darkness clip's +24 px went through the pillar.**
   - The darkness clip (`Hl(x, y, 700, 24)`) extends every ray 24 px past its hit, so the top of a wall or pillar face stays visible.
   - Near a pillar's edge the chord through the 56 px pillar is shorter than 24 px. The extension came out of its far side and lit a crescent of floor behind it, changing every frame.
   - Walls are 96 px thick, so for them this only happens right at a wall end. That behaviour is unchanged.

**Where this lives.** The shipped bundle `assets/index-DKbV5Nv9.js` is the only source. The repository has no client build: `package.json` has no build script, and earlier stages edited the bundle in place. The renderer code is:

```
this.sightPoints=Hl(a.x,a.y,700),this.scenePoints=Hl(a.x,a.y,700,24)
```

- `sightPoints` → `sightMask` → `creatures.mask`. This hides Hounds, Smilers and other wanderers.
- `scenePoints` is the first clip of the darkness overlay (canvas `#light`). Outside it, the screen is black.
- The server (`sim.js`) has its own `Uc` for the AI and no `Hl`.

The browser captures read the clip straight from the canvas calls. At all 28 poses, on both builds, the page draws exactly the polygon that `Hl` gives in node (0 px difference).

## The correction (one function: `Hl`)

**A — exact pillar-corner events.**
- Each pillar within sight range plus its half-diagonal (700 + 40 px) adds angle − ε, angle and angle + ε for all four real corners. This is the same ε (2·10⁻⁵ rad) and the same strategy as the wall corners.
- They are sorted with the unchanged 96-ray fan and cast through the unchanged exact `Uc`.
- Pillars stay their real 56×56 rectangles, with no 96×96 cell and no extra base rays.

**B — padding that knows what it hit (darkness clip only).**
- On a ray whose exact hit is a pillar, the presentation allowance is `min(24, distance to that pillar's far side along the ray)`. It ends inside the pillar.
- Walls keep their 24 px.
- The allowance never reaches the floor behind a pillar.
- The one place it is shorter than 24 px is where the chord itself is shorter, at the silhouette corners. One more ray per silhouette corner, where the chord reaches exactly 24 px, makes the clip follow the pillar's side there exactly.
- Without that ray, a straight chord would have cut a small black notch out of the pillar's lit face band. Test T09 catches exactly that.
- The entity mask has no allowance (r = 0): it stops exactly at the pillar.

**C — geometry, no blur.** The edge is not feathered or antialiased. The polygon is now exact, so there was nothing to hide.

`Hl` grew from 337 to 1339 characters. The rest of the bundle is byte-identical to the parent, including `Uc`, `Vl`, `Pc`, the lamp list and both call sites.

## Results: the game's own `Hl` against the exact ray query

`dev/stage-3b-pillar-los/los_audit.js`:
- It loads `Hl` / `Uc` / `Vl` / `Pc` verbatim from each bundle and measures them around PILLAR HALL's east-middle pillar, which has open floor on every side.
- Every pose compares both polygons with exact visibility from `Uc` (0.1° × 2 px floor samples).
- Full numbers are in `evidence/audit_before.json` and `audit_after.json`.

| set | poses | entity mask leak, worst pose (px²) | entity mask over-hide, worst (px²) | floor shown behind the pillar, worst (px²) | shadow-edge error, worst (°) | edge snap, worst (°) | poses with a snap > 0.5° |
|---|---|---|---|---|---|---|---|
| orbit r 50 (1° steps) | 360 | 415.7 → **0** | 9310.9 → **0.3** | 889.1 → **0** | 3.448 → **0.01** | 3.014 → **0.009** | 201 → **0** |
| orbit r 90 | 360 | 1254.8 → **0** | 7427.4 → **0.6** | 1932.4 → **0** | 3.113 → **0.01** | 2.893 → **0.009** | 202 → **0** |
| orbit r 160 | 360 | 2475 → **0** | 8604.8 → **0.6** | 3228.6 → **0** | 2.884 → **0.01** | 2.871 → **0.01** | 197 → **0** |
| strafe past a corner, 70 px away (1 px steps) | 181 | 2171.2 → **0** | 7380 → **0.6** | 3051.3 → **0** | 2.845 → **0.01** | 3.442 → **0.01** | 41 → **0** |
| strafe past a corner, 200 px away | 181 | 2867.7 → **0** | 7638.1 → **0.9** | 3568.4 → **0** | 2.249 → **0.01** | 3.595 → **0.01** | 23 → **0** |
| close to each face and corner | 8 | 22 → **0** | 9755.7 → **0** | 367.4 → **0** | 3.165 → **0.005** | — | — |
| diagonal walk through the hall (whole view) | 299 | 8303.5 → **0** | 15197.1 → 1627.3 ¹ | 10763.5 → **0** | 3.06 → **0.01** | 3.324 → **0.008** | 40 → **0** |
| walls: strafe past a YELLOW HALL partition end | 301 | 0 → 0 | 1.3 → 1.3 | 0 → 0 | 0.009 → 0.009 | 0.009 → 0.009 | 0 → 0 |

The remaining 0.01° is the ε of the corner events themselves (2·10⁻⁵ rad ≈ 0.001°, plus the 0.01° search step).

¹ The diagonal walk's remaining over-hide is not at pillars:
- It is where a wall face crosses the 700 px sight limit (at 650–700 px) and the circle's chords cut it. That behaviour is the same before and after, and walls are unchanged.
- Within the pillar windows of every set it is 0.

## Focused tests (`los_tests.js`, 13/13 PASS on the final tree)

| | |
|---|---|
| T01 | the audit's polygon lookup equals an even-odd point test (60 000 points) |
| T02 | the bundle differs from the parent only inside `Hl`; the two call sites unchanged |
| T03 | `Uc`, `Hc`, `zc`, `Bc` source, `Pc` / `Vl` / `Fc` tables and 4000 random rays identical (light, AI, collision and the server read these, never `Hl`) |
| T04 | **walls:** with no pillar in reach both polygons are byte-identical to the parent's (1505 positions map-wide) |
| T05 | **walls in PILLAR HALL:** every ray the parent cast is still cast, to the same bit-exact distance; the wall padding is unchanged on every ray that does not stop at a pillar (2404 polygons) |
| T06 | three events at each corner of every pillar in reach, none for pillars out of reach |
| T07 | entity mask = exact visibility around the pillar (666 poses): leak 0, over-hide ≤ 1 px² |
| T08 | darkness clip: no floor behind a pillar; every padded vertex on a pillar ray stays inside that pillar |
| T09 | pillar face bands: nothing within the 24 px allowance lost (371 267 band points), and the allowance kept everywhere |
| T10 | an actor (14 px body) behind a pillar is shown on exactly the pose its body first truly clears the corner, at 0.25 px steps (785 poses: early 0, late 0) |
| T11 | standing exactly on a pillar face's line (an event at ±π or ±π/2): no leak |
| T12 | while strafing in 0.25 px steps, the shadow edges stay on the exact silhouette corners (worst 0.0057°) |
| T13 | bounded: 12 extra rays per pillar in reach (entity mask), 14 (darkness clip); `Hl` reads no quality / tier state |

## P2 regression

- **The light is unchanged** (`ab_los.js`, `evidence/p2_ab/`):
  - The same frozen frame (same position, aim and carried light, clocks set to the same instant) was drawn by both builds. On every pixel inside both builds' darkness clips (more than 3 px from either outline), the overlay is **identical, max difference 0**.
  - The pillar scenes cover the PILLAR HALL view (QA1 scene D), a flashlight on a pillar's south face, a lantern beside a pillar and a headlamp across the diagonal. So the ceiling fixtures, BR-RoLE's pillar face receivers, the carried lights and the light blocked by pillars are all byte-for-byte as in QA1.
  - What differs is only where the clip moved:
    - 1.1k–4.0k px the parent's clip showed and this one does not (mostly hidden floor behind pillars);
    - 5.7k–12.9k px the other way (mostly in-view floor the parent's coarse wedge cut off).
  - The wall-only scenes (QA1 C and H) are identical everywhere, outlines included.
- **Every quality tier hides the same space.** At LOW / MEDIUM / HIGH (BR-RoLE switched in place) the darkness clip is the same polygon to the bit. `Hl` has no quality input.
- **Camera 1.25:**
  - `test_3bn.js` 7/7.
  - `s_camera_fairness.js` "CAMERA FAIRNESS: 12/12 PASS".
  - `camera_policy.js`, `timing_policy.js`, `server.js` and `index.html` are byte-identical.
- **Not touched:**
  - the AI and gameplay light: `sim.js`, `ai.js`, `light.js`, `dev/ai_src/`;
  - the server: `server.js`, `death_srv.js`;
  - collision: `move.js`, `dphys.js`, and the bundle outside `Hl`;
  - fixture placement: `world.js`;
  - BR-RoLE: `assets/br-role.js`;
  - networking and timing: `mp.js`, `timing_policy.js`;
  - `assets/shadows-2d.js`.

  All are byte-identical to the parent, and the receipt checks them from the ZIP.
- **Performance** (`STAGE_3B_PILLAR_LOS_CORRECTION_PERFORMANCE.md`):
  - The corridor is unchanged.
  - PILLAR HALL costs +0.14 ms per frame for both polygons together (0.10 → 0.25 ms, Chromium, this slow shared CPU).
  - The in-game frame interval is unchanged.

## Before / after evidence

The `evidence/contact_*.jpg` sheets show four sets, each with parent frames on top and this branch below:
- **orbit:** r 90, 68°–75°, 1° per frame;
- **strafe:** 200 px below the corner, 2 px per frame;
- **close:** each face and corner;
- **diag:** the diagonal walk.

The magenta line is the darkness clip drawn that frame. The cyan dashes are the exact lines through the pillar's extreme corners.
- **Before:** the wedge edges wander off the cyan lines and jump between frames. A curved crescent of padding pokes through the pillar's sides.
- **After:** the edges sit on the cyan lines in every frame.

## Found, not changed (outside this pass)

- **Wall corner exactly due west (pre-existing).**
  - When the player stands exactly on the line of a wall face (y equal to the wall's edge, to the bit) whose corner is due west, that corner's angle + ε event wraps past +π. It then sorts after the −π base ray, and that ray runs along the face line into the open row.
  - For that one exact position a wedge behind the wall can show. At 0.01 px either side it does not.
  - Pillars are not affected (T11). Their exact ray query counts a grazing ray as a hit.
  - Fixing it would change wall events, which this pass leaves byte-identical. It is a one-line normalisation if you want it later.
- **The walls' own 24 px allowance at a wall end** shows a sliver of floor past very thin grazing chords, as before. Wall padding was to stay.

## Deliverables

- branch `stage-3b-pillar-los`: P1 `0f1b516` (the correction, tests, tools, P0/P1 evidence), then the P2 commit (regression evidence and these documents);
- `THE_FAR_BACKROOMS_STAGE_3B_PILLAR_LOS_CORRECTION_HUMAN_QA.zip` + `.zip.sha256`;
- `STAGE_3B_PILLAR_LOS_CORRECTION_PACKAGE_RECEIPT.txt`;
- `STAGE_3B_PILLAR_LOS_CORRECTION_REPORT.md` (this file), `_HUMAN_QA.md`, `_PERFORMANCE.md`, `_CHANGED_FILES.txt`;
- the before / after contact sheets (`dev/stage-3b-pillar-los/evidence/contact_*.jpg`);
- the remote commit / tree verification (`evidence/p1_remote_verify.json`, and the final one in the receipt).

Stage 3B is not declared complete. Only you can accept this correction.

**STAGE 3B PILLAR LOS CORRECTION HUMAN-QA CANDIDATE — WAITING FOR USER**
