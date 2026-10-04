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
