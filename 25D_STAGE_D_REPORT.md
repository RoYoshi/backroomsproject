# 2.5D Stage D engineering report

**2.5D STAGE D ENGINEERING COMPLETE — CHECKPOINT READY FOR REVIEW**

Human gameplay QA remains pending. Stage E has not begun. This is the isolated early spatial view feasibility prototype, not a production-wide 2.5D conversion.

## Parent and authority

The immutable parent is `thefarbackrooms-level0-25d-stageC-spatial-motion.zip`, SHA-256 `0ded2b248867be592c25585de89a45217cbf989f4257c1a94301ffbaa89c585b`. Its CRC, clean extraction, inventory, spatial/camera/flat-parity preflight, builds and HTTP serving passed before implementation. Stage C was independently accepted for progression by the supplied authority. Historical embedded Stage C reports were preserved verbatim; their older “independent review pending” line is superseded by this handoff. Human QA was not superseded.

The Stage D master prompt controls scope. CAMERA-P01 remains 1.25: 1920×1080 covers 1536×864 logical world units. The architecture's older 1.18 value was not restored.

## Implemented

`world_view.js` owns presentation only: orthographic oblique projection, actual XYZ face depth, immutable draw packets, bounded physical visibility, view-local cutaway and a WebGL2 spatial pass on the shipped Pixi context. `stage_d.html` and generated/runtime assets provide an isolated served fixture. The unchanged Stage C world supplies 32 convex solids, real stairs/ramp, stacked slabs, low roofs and the balcony/drop.

The exact original rounded-body/two-hand artwork is extracted reproducibly from the pinned shipped bundle. There are no arms, legs, anatomy changes, new Hound/Smiler visuals or death changes. Fixture actor placements are presentation snapshots; no AI, authority or spatial aftermath migration is implied.

All physical occluders remain in visibility queries when camera faces fade. Unseen opaque faces write black camera depth; unseen actor/effect fragments are rejected. Only the declared eligible upper-slab group can fade. Last-drawn annotations use the same physical and camera-depth tests. Two real browser view instances share the same frozen model and snapshot while keeping independent cutaway state.

The production `/` page, app bundle, map, physics, timing, camera policy, AI/evidence/navigation, death system and multiplayer client are byte-identical to Stage C. The **only modified original file is `server.js`**, adding the two public prototype allowlist entries. Removing exactly those entries reproduces the parent's server hash. Deleted original files: zero.

## Objective acceptance

- 10 focused view groups; actual browser core 10/10.
- All five required viewport/DPR profiles at full and reduced quality; no XY awareness expansion or cross-floor/overlay reveal.
- 21 spatial groups, 54 adversarial checks, 10 movement scenarios × 8 schedules, and 315 camera combinations retained.
- 46 flat gameplay traces / 35,098 records match; eight new render schedules produce the same real movement trace.
- Actual production menu and gameplay screenshots are byte-identical to the pristine Stage C parent in the deterministic browser capture.
- Required network/IR/performance suites completed. Aggregate remains 151/162 with the same 11 inherited failures. P08 remains unknown; F22 remains historical source-guard context.
- Fresh extraction into a directory containing spaces reproduced all four builds and passed view, independence, camera, scope, actual HTTP and actual browser checks.

Evidence and limits are detailed in the test, browser, parity and failure reports. Automated checks are not proof of good game feel or human fairness.

## Performance limitation — explicit

The available browser uses **SwiftShader software rendering**. Its readback-fenced completed frames measured approximately **53–475 ms median** across the tested profiles. It does **not** meet 16.7 ms. Hardware-reference performance remains unverified; no unavailable reference GPU is classified as a failure. Stage D's renderer mechanism is demonstrated and its cost/capacity bounded, not certified as a shipping 60 FPS renderer.

The bounded exact-ray implementation is an allowed equivalent to a local-eye cubemap for this fixture. It preserves arbitrary XYZ occlusion without sampling away blockers, but its cost scales with pixel count and solid count. It explicitly rejects more than 64 solids / 8 planes per solid. Broader content performance is not established by this prototype. No physical correctness was relaxed to improve measurements.

## Recovery and final identity

The required early working checkpoint was CRC/extraction verified and externally saved **before** long validation. SHA-256: `3572b7f55581c256f3daa63ea27ee79109344bc79c13a8c8fe0e55b7e32e1fc3`. Its `25D_STAGE_D_WORKING_STATUS.md` is a historical checkpoint note, not current completion status.

A second recovery snapshot preserved completed test evidence after a transient execution-service interruption: SHA-256 `30d365712dabdb2c4d3b1f1941123fe5dbe12b83c91a2a934f9a99f82edff66f`. Both remain separate historical artifacts.

The final ZIP is created once from the completed tree. Its exact identity and bounded extracted-package results are recorded externally in `25D_STAGE_D_SHA256.txt` and `25D_STAGE_D_PACKAGE_VERIFICATION.json`, avoiding circular archive identity. The package includes screenshots, raw evidence, reproducible tools and all eight requested reports.

No Stage E/F/G/H implementation, AI rebalance, network-Z protocol, corpse elevation migration or broad production overlay integration was begun.
