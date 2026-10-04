# Part 3A failures and repair evidence

Accepted Stage I's historical eleven aggregate failures, shared F22, P08 UNKNOWN, software GPU limits and other inherited qualifications remain visible in its reports. They are not Part 3A successes. Final regression must compare the preserved flat references and rerun all seven certified 2.5D suites.

## P3A1 new attempts

Raw evidence lives under `dev/part3a/evidence/p3a1` and is never overwritten.

- `build-01.log`: generator initially called a helper that is only available on a compiled geometry object. Replaced with a bounded point-in-polygon lookup for explicit authored support references.
- `base-01.log.gz`: renderer's copied definition retained input array ordering even though meshes were sorted. Canonicalized its owned copy; complete presentation models now compare equal after source-solid permutation. Gzip preserves the complete original log bytes.
- `base-02.log`: new test used radius zero, rejected by the accepted physical API. Uses a positive radius.
- `base-03.log`: new test requested body support at the center of a retained pillar. Source coverage and physically walkable cells are checked separately; original pillars remain physical.
- `browser-01`: no installed Chromium binary. Default download endpoint returned HTML instead of an archive (`browser-install-01.log`). The official Chrome storage archive was downloaded and CRC verified.
- `browser-02`: archive lacked executable permission. Corrected the local browser dependency's executable bit.
- `browser-03`: real page/pixel and complete geometry checks succeeded, but spawn's conservative candidate set contained only 29 solids. The greater-than-64 assertion now runs in a measured dense LONG ROOM location; the original spawn screenshot and diagnostic are preserved.

P3A1 preservation source was published before further browser setup and repair. No frozen reference, retained assertion threshold, movement tuning, or species constant was changed.

- `browser-04` through `browser-06`: captures before a stable post-join/post-teleport frame were intermittently mostly black (one raw capture: 459 lit pixels, GL error zero). The harness now records raw pixels and waits for current world/pose and finished cutaway. Raw float uploads explicitly reset pixel-store state, and the new candidate sampler is detached at the existing Pixi boundary. `browser-07` passes with 97,981 / 117,689 lit pixels, zero GL errors and 90 occluders in two batches. No assertion threshold was reduced.

## P3A2 new attempts

Raw evidence is under `dev/part3a/evidence/p3a2`.

- `build-01.log`: a same-surface crawl link was referenced twice in its chart. The generator now inserts that boundary reference once.
- `motion-01.json`: the preflight north depression approach was inside an original wall. The lower ramp now approaches from the open south side; no original wall was removed.
- `vertical-01.log/json`: the same-XY overlap probe was exactly at a retained column. The corrected probe x6192/y864 proves two clear bodies and physical slab occlusion. All 22 permitted species/link executions already passed on that attempt.
- `vertical-02.json`: 28 checks PASS, including all physical routes, reversal/interruption, real fall/contact, crawl restrictions and all-room base circulation. No movement or species constant changed.

## P3A3 attempts

- `navigation-01.log`: a newly chosen lower-route test approach was inside an original wall at y6120. It now begins at the already physically certified south mouth y5976. `navigation-02.json`: all eight Hound/Smiler graph paths execute physically.
- `browser-01`: two real clients passed same-XY slab masking, independent cutaway, authoritative rim fall, reconnect and actual one-copy cartograph pickup. The selected exit packet existed but changed zero pixels when removed. Raw packet/state, screenshots and console evidence are preserved before the narrow wall-effect rendering repair. P3A3 remains incomplete.

P3A3 preservation focused results: `gameplay-01.json` five groups PASS, including 100-world seeded repeatability and variable upper/lower candidate selection; `prop-links-01.json` all 60 low/window species traversals PASS; `vertical-01.json` 88 checks / 82 actual routes PASS; `navigation-02.json` eight complete routes PASS.

P3A3 repairs and final focused results:

- `browser-01` wall face was edge-on to the accepted camera projection (normal +X). The existing glitch's floor spill is now also attached to the real adjacent support face, with the same complete physical mask. No overlay bypass. `browser-02` passes actual cartograph pickup and wall escape, plus two-client separate elevations/fall/reconnect. Its screenshots were inspected.
- `aftermath-01`: the preview helper copied a player's root Z when creating the larger attacker. On stairs/ramps this embedded the attacker footprint. The helper now derives a clearance-valid attacker contact within one accepted step on the victim's explicit named sheet; no nearest-floor/global-Z fallback. It returns a controlled failure if no such contact exists. Normal AI/death authority and physics are unchanged.
- `aftermath-02`: the new test required every tethered hand to have ground contact, contrary to the accepted awake-hand constraint. It now checks every mass for finite collision-free state, sleeping implies physical support, body/loose gear settled support, and the retained hand tether bound. The Smiler preview correctly refused one cramped riser pose; the stair station now uses the physically supported adjacent riser pose. `aftermath-03`: all 12 station/species cases PASS. Tethered hands may remain awake above a sloping/tread surface; this is reported, not replaced with fabricated support. Retained Stage G authority/replay and Stage E motion tests PASS.
- `lamp-placement-01`: nine inherited lamp XY centers coincided with preserved full-height pillars. A 48-unit south shift within each same ceiling bay clears the fixture and emitter. All 90 IDs/order, room exclusions and accepted power/range remain. `lamp-placement-02` proves no emitter embedded in any solid; original and adjusted positions are in the manifest.
- `base-01`: the P3A1 micro-body assertion did not account for new crawl side walls/stair/ramp volumes. `base-02` separately proves complete original floor footprints, the 15 authored depression cells, and exactly nine source centers occupied by authorized vertical feature solids, plus the unchanged all-room standing circulation proof. No original source floor was dropped.
- `gameplay-03.json`: current final lamp-placement content, five groups PASS. Its raw stdout log is empty; the incrementally written JSON contains each assertion disposition. `base-02.json` proves current JSON byte reproduction from two builds and current content hash. Earlier geometry/browser runs differ only in the explicitly documented nine lamp placements.

## P3A4 attempts

- `coverage-02.log`: a query ending within .005 units of a chunk boundary could miss the neighboring bucket even though the final conservative AABB predicate included it. Bucket enumeration now expands by the same physical visibility margin. `coverage-03.json` passes independent brute-force ray/candidate comparisons, including exact adversarial chunk boundaries. Retained Stage D view tests pass.
- `aftermath-browser-01`: the lower observer's flashlight positive control contributed zero pixels beneath the upper route. Its edge walls remained opaque to the camera while the slab faded, hiding the feet/nearby floor. The five edge walls now belong to the same local overhead slab view group. Physical geometry, light/eye rays and simulation remain unchanged. `aftermath-browser-02` passes every visible/IR positive/negative control and active/settled aftermath/beam/vanish masks through the production page.

`readability-01` captures all 12 rooms and seven feature views without debug labels. The affected LONG ROOM/vertical views will be recaptured after the local cutaway correction. Full/reduced candidate and simulation truth are identical. Performance evidence retains cold navigation spikes and slow software GPU captures; it does not claim a hardware frame budget.
