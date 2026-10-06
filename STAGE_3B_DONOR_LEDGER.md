# Stage 3B — donor ledger

**Binding rules:**
- the pack's `STAGE_3B_DONOR_SALVAGE.md`;
- the salvage inventory (`SALVAGE_INVENTORY_V1`).

**Donors:**

| donor | branch | commit | tree | status |
|---|---|---|---|---|
| Part 3A / Stage B lineage | `part-3a` | `4d1f17a600a10599b848b6db9d02fa16b4f479f0` | `c1e0fc5fd84e5fbea412cf3fca7c309243e8de6e` | verified locally and on the remote |
| Corrected Part 3B top-down presentation | `part-3b` | `c392272e34bf26d6770a355e80638e1ac1612ac5` | `666ad244cf0063bbd807b4a3ad83934e65072fb0` | verified locally and on the remote |

**Classification law:** REUSE / ADAPT / REFERENCE / RETIRE.

**What was actually taken:**
- **Copied:** one pure function (`canonical`), a single line. Nothing else was copied.
- **Rewritten:** everything else used.
- **Not imported:** no retired spatial authority (solids, supports, nav surfaces, Z, projection, protocol), not even as a dependency.

## Donor 1 — Part 3A `4d1f17a`

| # | donor path / function | class | active target | why it is independent of the retired spatial authority | copied / rewritten / studied |
|---|---|---|---|---|---|
| 1 | `levels/level0.js`: definition `rooms[].id` (`room:01`…`room:12`), `lampIds` (`lamp:001`…`lamp:090`, in `Fc` order), `columns[].id`, `pillarGrid.ids`, `propDefs[].id`, `roomMaterials`, `contentRevision` / `contentHash`, `freeze()` | **ADAPT** | `assets/level0_visuals.js`: the stable visual-ID scheme (`room:NN`, `lamp:NNN`, prop ids), revision and hash discipline, frozen export | It is the *flat-compat* data (`geometryMode: "flat-compat"`, `spatialRecords: null`). Stage 3B keeps only the identity scheme. The geometry is **not** copied: rooms, walls, lamps and props are read from the running game, which stays the only authority. | rewritten |
| 2 | `world_geometry.js` `canonical(v)` | **REUSE** | `dev/stage-3b/test_3b.js`: canonical JSON for the visual content hash | A pure function with no geometry, RNG, time or render dependency (it is the smallest independent unit) | **copied** (one line, attributed in the test) |
| 3 | `world_geometry.js` `sha256(s)` / `contentHash(d)` | **ADAPT** | `dev/stage-3b/test_3b.js` and `contentHash` in `assets/level0_visuals.js` | The same scheme (SHA-256 of the canonical data without its own hash field). The test uses Node's `crypto`. The browser never needs SHA-256: it verifies nothing at runtime, so the synchronous JS SHA-256 is not shipped. | studied (rewritten with Node `crypto`) |
| 4 | `world_geometry.js` `validate()`: explicit `kind:` IDs, uniqueness, canonical order, required keys | **ADAPT** | `dev/stage-3b/test_3b.js`: visual records have prefixed unique IDs in canonical order and their required keys | The ID-discipline half of `validate`. Its solid / support / spatial half is not used. | rewritten |
| 5 | `world_geometry.js` `compile()` flat-compat: re-derives `kc` / `Fc` / `Pc`, throws "Generated identity count mismatch" | **REFERENCE** | `dev/stage-3b/test_3b.js` checks the visual room table (ids, codes, names) and the lamp-id count against the **live bundle tables** | Stage 3B does not recompile the map. The game stays the geometry authority, and the visual data is only cross-checked against it. | studied |
| 6 | `levels/level0_gameplay.js` `anchors()`: flood fill from spawn on a 48 px grid, a lattice of candidates, wall-face candidates | **ADAPT** (concept) | `assets/l0-remaster.js` decor candidates: floor cells along walls, entrance-to-entrance "lanes" (shortest paths on the flat cell grid), corners and open floor | The donor runs on `G.compile` (spatial clearance, supports, sweep). Stage 3B rebuilds the idea in flat 2D from the game's own floor mask, for **presentation only**: decals lie flat, never block, and never ask for clearance. | rewritten |
| 7 | `levels/level0_gameplay.js` `props()`: vault traversal links, `topZ`, tight-gap nav surfaces | **RETIRE** | — | spatial navigation and vertical vault data | not used |
| 8 | `levels/level0_spatial.js`, `levels/level0_spatial.json`, `levels/level0_vertical.js` (910 solids, support patches, stairs / ramp / depression) | **RETIRE** | — | the 910-solid spatial map, floor Z, stairs and ramps | not used |
| 9 | `world_geometry.js` spatial sweep / clearance / GJK / supports / raycast | **RETIRE** | — | spatial collision authority | not used |
| 10 | `world_motion.js` (spatial motor, profiles) | **RETIRE** | — | spatial motor | not used |
| 11 | `spatial_authority.js`, `spatial_client.js`, `spatial_history.js`, `spatial_protocol.js` | **RETIRE** | — | network Z, spatial protocol | not used |
| 12 | `world_view.js` (Part 3A spatial renderer) | **RETIRE** | — | spatial renderer / projection | not used |
| 13 | `dev/stage_b/content_identity.js` (prints the asset identity and hash) | **ADAPT** | `dev/stage-3b/test_3b.js` prints the visual identity (revision and content hash) | identity printing only | rewritten |
| 14 | `PART_3A_CONTENT_MANIFEST.json` (12 rooms, 18 props, 90 lamps) | **REFERENCE** | `STAGE_3B_VISUAL_AUDIT.md` and the test: the counts are re-verified against the live game (12 / 18 / 90 match) | counts only | studied |

## Donor 2 — corrected Part 3B `c392272`

| # | donor path / function | class | active target | why it is independent of the retired spatial authority | copied / rewritten / studied |
|---|---|---|---|---|---|
| 15 | `world_view.js` HQ1 bands (see below) | **REFERENCE** | `assets/l0-remaster.js`: **DEV-only** wall-depth experiment (`?walldepth=on`, or F9 with `?dev3b`) | See the note below the table. | studied, rewritten |
| 16 | `world_view.js` relative-Z actor scale, depth layer, camera-Z spring, `magnification()` | **RETIRE** | — | Logical Z / projection | not used |
| 17 | `world_view.js` WebGL spatial renderer (shaders, failure / sensor uniforms, picking, cutaway probes) | **RETIRE** | — | spatial renderer | not used |
| 18 | `dev/part3b/reference/world_view.js` (the rejected oblique projection) | **RETIRE** | — | the rejected projection | not used |
| 19 | `PART_3B_HUMAN_QA_CORRECTION.md`: the user rejected "tilted / isometric walls with large wedge faces" and required orthographic rectangles, parallel wall lines and local volume cues on all four orientations | **REFERENCE** | binding design constraints for all Stage 3B walls: band geometry stays inside the wall cells, with no shear, no taper and no projection; room rectangles stay exact | design evidence | studied |
| 20 | `dev/part3b/test_hq1.js`: "bands never cover open floor", "bands on all four directions" | **REFERENCE** | `dev/stage-3b/test_3b.js`: every remaster wall band lies inside a wall cell, on all four orientations, and none covers a floor cell | test idea | rewritten |
| 21 | Part 3B cutaway semantics | REUSE later (Stage 4, per the inventory) | — | not applicable to a flat Level 0 | not used |

**Row 15, in full:**
- **What the donor has:** `world_view.js` HQ1 bands: `BAND`, `bandWidth()`, `facingAway()`, `buildBands()` end joins (`convex` / `concave` / `square`) and `bandMesh()` (convex corners split on the diagonal, inner corners extended). At ground level a band is about 18 px. Faces turned from the eye are culled. Shading darkens toward the floor crease.
- **What the experiment takes:**
  - constant-width bands inside the wall cells;
  - eye-facing faces only;
  - convex corners split on the diagonal;
  - darker toward the crease.
- **What it leaves:** no camera Z, no magnification, no projection, no picking.
- **Why it is independent of the spatial authority:** the bands are drawn inside the existing wall cells, so footprints, collision and picking are untouched. There is no Z, and no projection.

## Inventory rules applied (`inputs/SALVAGE_INVENTORY_V1.md`)

| inventory row | rule | how Stage 3B applies it |
|---|---|---|
| Canonical Level 0 data extraction | ADAPT | Rows 1, 5 and 13: the identity scheme, without the spatial compiler |
| Deterministic content hashing / validation | ADAPT | Rows 2–4: `canonical` plus a SHA-256 content hash, and ID discipline |
| Production Level 0 room / material / light metadata | ADAPT | Row 1, and `level0_visuals.js` room profiles keyed by `room:NN`. The visual material never contradicts the gameplay surface (`world.js` `SURF`; checked by the test). |
| Production anchor / candidate derivation | ADAPT | Row 6: flat 2D decor candidates |
| Top-down wall-strip depth cue | REFERENCE | Row 15: DEV toggle only, off by default; human judgment decides |
| Package verification / reproducible extraction tooling | REUSE | The active lineage's `dev/br-role/package_br.py` pattern: a ZIP from `git archive` of the exact commit, its SHA-256, a receipt |
| Spatial renderer as a whole; rejected oblique projection | RETIRE | Rows 16–18 |

## Active-lineage modules consumed (not donors)

- **BR-RoLE 1.0** (`assets/br-role.js`): protected and consumed as is. Stage 3B gives it no new blockers and makes no edits to it.
- **SH7** `assets/shadows-2d.js`: retired at BR0 and still not loaded. Not used.
