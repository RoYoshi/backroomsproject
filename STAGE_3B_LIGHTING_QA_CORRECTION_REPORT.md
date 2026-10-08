# Stage 3B Lighting QA Correction — Report (Stage 3B-L QA1, BR-RoLE 1.1-qa1)

**Pass:** lighting reality correction only.

**Laws:**
- **THE PLAYER IS NOT A LIGHT SOURCE. THEIR EQUIPMENT IS.**
- **PITCH BLACK WHERE THERE IS ACTUALLY NO LIGHT.**

| | |
|---|---|
| branch | `stage-3b-l-qa1`, from `stage-3b-l` `b9f3a9b` (tree `3a1ccbb`) |
| checkpoints | Q1 `a8de8f9` (energy + receivers); Q2 `d100e46` (fixture density + shared truth); Q3 final (see the receipt). Each was pushed and verified against GitHub. |
| camera | 1.25 as accepted, not touched: `camera_policy.js`, `timing_policy.js` and `server.js` are byte-identical, and the camera checks pass |
| untouched | `main`, `stage-3b-l`, `stage-3b-n-camera`, `stage-3b-remaster`, `br-role`, the superseded `stage-3b-n`. No Stage 3C. |

## Q0 — what was wrong (audited on `b9f3a9b`)

1. **Too little legitimate light.**
   - The direct field was scaled to 0.88 to make room for bounce. Its shape, `exp(-(d/168)^1.47)` reaching 0 at 640 px, gave a small pool.
   - It was drawn at the game's own strength (.43). Lit rooms read 0.115–0.15 mean light on the visible floor, with 6–24 % of it black.
   - Result: small pool → murky grey → black.
2. **Walls and pillars never received light. This was a composition seam, not a missing constant.**
   - The remaster papers every wall and pillar face as a band inside the blocker: S 46 / N 23 / E,W 27 px, and pillars 18 / 12 / 14. The line of sight pads 24 px into walls so you can see that band.
   - BR-RoLE's shadows start exactly at the facing edge, so every band was always in its light's shadow.
   - Carried lights had the same seam.
3. **Too few fixtures, placed by four copies of one loop.**
   - There were 90 fixtures, every 5 cells, rooms only; corridors had none.
   - PILLAR HALL's nine sat inside its pillars.
   - The placement loop existed byte-identically in the bundle, `sim.js`, `dev/sim_head.js` and `dev/sim_geo.js`. A fixture added in one place would have been a renderer-only fake.
   - Details: `STAGE_3B_LIGHTING_QA_CORRECTION_FIXTURE_DENSITY.md`.
4. **The tier lamp caps were 8 / 10 / 14.** That was already tight for 90 fixtures and too tight for more.

## Q1 — legitimate output and surface receivers (`a8de8f9`)

**Fixture output (`assets/br-role.js`)**
- The direct field is at its full legitimate level: `SPILL.direct` 1.0 (was .88).
- It is broader, `exp(-(d/185)^1.42)`, with a smooth tail reaching exactly 0 at 720 px (tail 580 → 720).
- It is drawn at `LAMP.vis` × the game's strength:
  - 1.5 in Q1 with 90 fixtures;
  - **1.4** from Q2 with 170, where overlapping fixtures add.
- This is legitimate output only: no ambient floor and no viewer glow. Where nothing reaches, the overlay stays fully dark.
- Light truth (`light.js`, the bundle's `Ul()`, the server AI) is unchanged.

**Surface receivers**
- Each wall or pillar side's visible face band receives exactly the light that reaches the floor strip at its foot (5–8 px out), from that same light and through the same shadows.
- It is scaled by how squarely the face turns to the light: `.45 + .55 cos`, in 32 px pieces.
- A face turned away gets nothing. Nothing reaches past a face into the blocker. At convex corners the front and back faces own the corner.
- **Ceiling lamps:** cached with each lamp, in the core cache and in the far cache (the far cache also holds the bounce light, so a face whose foot receives first-bounce light shows it).
- **Carried lights:** drawn per frame in the light's own pixel box. A flashlight lights the wall it hits, sweeping away darkens it, and the lantern lights the walls around you.
- `CARRY.vis` 1.35 × the game's power for carried lights; light truth unchanged.

**Checks at Q1:** occlusion 5/5 (20 lamps), receivers 5/5, falloff 6/6, camera 7/7.

## Q2 — far more real fixtures, one shared truth (`d100e46`)

- **One placement.** `world.js` `W.lamps` is now the only placement.
  - `world.js` is the module the page and the server already share.
  - The bundle, `sim.js` (rebuilt with `dev/build_sim.sh`), `dev/sim_head.js` and `dev/sim_geo.js` each call it on their own map.
  - That is one statement each; the bundle's and `sim.js`'s diffs are exactly that statement.
- **90 → 170 fixtures:**
  - the original grid kept in order, with PILLAR HALL's nine moved one cell off their pillars;
  - a staggered, jittered second grid in every working room, with about 1 in 7 missing (DAMP ROOMS keeps 4 in 10);
  - a line down every corridor;
  - nothing within 720 px of the BLACKOUT ZONE, none in doorways or on pillars.
- **The remaster** gives corridor fixtures their housings. The visual records now say 170 lamps (revision `3b-l-qa1-fixtures`, hash refreshed).
- **BR-RoLE caps**
  - Lamp caps 20 / 24 / 28 and caches 36 / 44 / 52 at Q2. The final is 24 / 24 / 28 and 40 / 44 / 52, so LOW draws the same fixtures as MEDIUM.
  - A prefetch never evicts. At 170 fixtures the old prefetch rebuilt and evicted in a loop: 210 builds in one corridor scene.
- **Gameplay** counts the new light, as the pack expects. The AI lamp field covers 87.7 % of walkable cells, up from 68.9 %. Nothing was retuned (see *Gameplay consistency*).

**Checks at Q2:**

| check | result |
|---|---|
| fixtures | 7/7 |
| page | 4/4 |
| occlusion (24 lamps) | 5/5 |
| receivers | 5/5 |
| falloff | 6/6 |
| unit | 32/32 |
| remaster | 26/26 |
| camera | 7/7 |

## Q3 — the human-QA candidate

**Performance through engineering** (`STAGE_3B_LIGHTING_QA_CORRECTION_PERFORMANCE.md`). The lamps' core fields cost two thirds of BR-RoLE's frame (it measured that by switching parts off), and twice the fixtures doubled it:
- **Core fields** go into a half-resolution buffer, added once.
  - A core cache holds `lampRes` px per world px, about half the light buffer's density at every tier, so nothing is lost.
  - Measured against drawing them at full resolution: mean 0.3 / 255, p99 1 / 255, max 3 / 255. BR-RoLE time −30 %.
- **Far fields and bounce** go into an eighth-resolution buffer (was a quarter), the far caches' own density at every tier.
  - Mean 0.27 / 255, p99 1 / 255.
- **The far cache's face pass** is a build step of its own, with 96 px pieces. A warm-up frame had spiked to 23 ms.
- **The face pass copies only the strips it reads.** A carried light that faces no wall pays nothing. The caches it builds are identical: the occlusion audit's counts are the same to the texel.
- **Only the box the lamps drew into** is cleared and added from the two low-resolution buffers.
  - In the BLACKOUT ZONE, two distant fixtures whose light just reaches the edge of the screen (down its approach corridor) had cost about 10 ms a frame as full-screen passes. They now cost about 2 ms.
- A lamp an actor shadows still goes through the full-resolution scratch, exactly as before.

**Focused regression on the final tree**

| check | result |
|---|---|
| `dev/stage-3b-l-qa1/fixtures_qa1.js` (client = server = `W.lamps`; AI field .43 at every fixture; the parent's grid kept; BLACKOUT ZONE clear; counts and coverage) | **7/7** |
| `dev/stage-3b-l-qa1/fixtures_page_qa1.js` (the running game, beside **each of the 170 fixtures**: its housing, BR-RoLE draws it, `light.js` / `Ul()` see it) | **4/4** |
| `dev/stage-3b-l-qa1/occlusion_qa1.js` (24 lamps: originals, PILLAR HALL's moved ones, staggered and corridor fixtures; every lit texel of core and far caches against the geometry, faces included) | **5/5**: 1 738 468 core and 192 518 far texels, none through geometry; bounce-only max 11.5 / 255 |
| `dev/stage-3b-l-qa1/receivers_qa1.js` | **5/5**, see below |
| `dev/stage-3b-l-qa1/falloff_qa1.js` (no hard radius: field, caches, a corridor lit from one end, overlap, sight edge) | **6/6** |
| `dev/stage-3b-l-qa1/parity_qa1.js` (LOW / MEDIUM / HIGH: the same fixtures drawn; light mean \|Δ\| 0.8–1.8 / 255) | **2/2** |
| `dev/br-role/test_br_role.js` (unit) | **32/32** |
| `dev/br-role/smoke.js` (browser; K02, K07/K08 and K09 isolate their lamps with DEV `solo`, since Level 0 now has a fixture on nearly every side of everything) | **12/12** |
| `dev/stage-3b/test_3b.js` (remaster, VM: corridor fixtures' housings) | **26/26** |
| `dev/stage-3b/smoke_3b.js` (remaster, browser: BR-RoLE's overlay byte-identical with the remaster on / off) | **9/9** |
| `dev/stage-3b-n/test_3bn.js` and `dev/tests/s_camera_fairness.js` (camera regression) | **7/7** and **12/12** |
| `dev/stage-3b-l-qa1/perf_ab_qa1.js` (parent vs QA1, interleaved scene by scene; SwiftShader only) | MEDIUM, BR-RoLE's own frame: lit rooms −0.9 to +3.5 ms standing with twice the fixtures drawn, the corridor +9 ms (6 → 19 lamps), the BLACKOUT ZONE +1.8 ms. See the performance report. |

Logs are in `dev/stage-3b-l-qa1/evidence/`.

**receivers_qa1.js in detail:**
- F1: ceiling lamps light 771 face samples in proportion to their foot; faces turned away get 0 added.
- F3: 141 blocked faces get 0.
- C1: a flashlight on a BLACKOUT ZONE wall gives the face 43 / 255 (the floor at its foot gets 44). Swept away it is 0; with the lantern 26–29 (it flickers); with every light off 0.
- C2: the wall's far side gets 0.
- F2: a PILLAR HALL pillar's near face 65–84 / 255 (the flashlight's exact aim varies per run), far face 0. 110 lamp-lit pillar-face samples, and 168 faces turned away with 0 added.

## Scenes (1920×1080, MEDIUM, the accepted camera; before = `b9f3a9b`, after = this branch)

Visible-floor light is 1 − overlay alpha at the points the player can see. Images: `dev/stage-3b-l-qa1/evidence/scenes/*_before_after.jpg`; the dark scenes also have a ×4-brightened pair.

| scene | before: mean light (black share) | after |
|---|---|---|
| A normal room (YELLOW HALL) | .115 (23.7 %) | **.543 (0 %)** |
| B between fixtures (REPEATING ROOMS) | .141 (17.2 %) | **.560 (0 %)** |
| C wall receiver (YELLOW HALL partition) | .150 (13.6 %) | **.606 (0 %)**, partition faces visibly lit |
| D pillar receiver (PILLAR HALL) | .120 (5.0 %) | **.531 (0.9 %)**, lit faces toward fixtures, none through pillars |
| E1 flashlight on a BLACKOUT ZONE wall | .011 | .014: the wall face lights (43 / 255, C1) |
| E2 the same, swept away | .005 | .006: the face goes dark (0) |
| F lantern in the BLACKOUT ZONE | .047 | .061: the surrounding walls lit (26–29 / 255) |
| G BLACKOUT ZONE, light off | 0 (100 % black) | **0 (100 % black)** |
| H long corridor (YELLOW HALL → NORTH ROOMS) | .009 (96 % black) | **.331 (0 %)**: its own fixtures, one an old dim tube |
| I dense-fixture room (REPEATING ROOMS) | .144 (6.5 %) | **.571 (0 %)**: pools and dimmer areas between, not a flat wash |
| K headlamp, corridor below YELLOW HALL | .026 (86.7 %) | .118 (44 %): the BLACKOUT approach stays dark past YELLOW HALL's last fixture |
| J performance after warm-up | | see the performance report |

## Gameplay consistency (nothing retuned)

- **One list.** Every fixture is one record that the visuals, BR-RoLE, `light.js` / `Ul()` and the server AI all use (fixtures T2 / T3, page P1–P4). No renderer-only light exists.
- **Light truth is unchanged in form.**
  - Gameplay's lamp field is still the strongest single fixture within 380 px (×.43, with line of sight).
  - The visual light adds overlapping fixtures, as 1.1 did, now at `vis` 1.4.
  - Within a fixture's pool both read "lit". Between fixtures the visual is brighter than gameplay's max, so the player never looks darker to themselves than the AI sees them.
  - Past 380 px only the visual tail remains: about 9 / 255 at 380 px and about 4.5 / 255 at 450 px.
- **More of the level is lit for gameplay:** 87.7 % of walkable cells, up from 68.9 %. Light-fearing Smilers and sight-hunting Hounds act on that.
- **The AI scenario suite** (`dev/tests/run.js`, server AI in node) gives 151/162 on both the parent and this branch.
  - 8 failures are the same on both, so they predate this pass.
  - Four tests flip, deterministically (3 runs each), because their scenario spots are now lit:
    - C3: a hidden prey is sometimes aimed at directly, 16 ticks of 2 514;
    - C9 / C10: fresh runners are caught more often;
    - P07 and SM01 now pass where the parent failed.
  - Per the pack, no AI threshold or behaviour was retuned. Whether to move those scenarios to the dark places Level 0 still has is a decision for you.

## Recorded, not fixed (out of scope; unchanged)

- The Hound dread flicker in `mp.js`: the overlay's opacity drops for a frame.
- The camcorder's infrared is drawn inside the hard 700 px sight clip.
- The dim tubes (every 13th fixture) are dim only in BR-RoLE and the housings. `light.js` and the server count them at full strength, as before.
- **Mask-blur bleed at convex corners.** Beside a very bright lamp, the core mask's 3 px blur reaches a few px into a convex wall corner, up to 10 / 255, 4–6 px deep.
  - BR-RoLE 1.0 and 1.1 do it too. The receivers check measures it with the receivers on and off, and the receivers add nothing there.
- **The lamp hum** (`mp.js`, nearest fixture) is louder on average, because fixtures are nearer.
- **The admin "place near me" spot search** avoids fixtures by 230 px, so it finds fewer spots in lit rooms.

**STAGE 3B LIGHTING QA CORRECTION HUMAN-QA CANDIDATE — WAITING FOR USER**
