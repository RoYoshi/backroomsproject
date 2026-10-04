# P3A1 — COMPLETE

Content: `part3a-base-1`, SHA-256 content identity `e1d8fbf4612781aae08b3bca45dd177e4ce27498f1b98eea595ce1546a8641ad`.

Focused checks: `evidence/p3a1/base-05.json` PASS (two identical builds, all 3,308 source floor cells, 12 rooms, 18 props, 90 lamps, 873 solids, 285 supports, permutation equality, physical visibility beyond index 64). `retained-view-01.log`: all 10 retained view tests PASS. Its 65-record malformed fixture is rejected for duplicate primitive IDs; valid worlds now span batches rather than retaining the old total-solid limit.

Actual served production page: `browser-07/result.json` PASS, Chrome 151.0.7922.34, SwiftShader. Spawn: 97,981 lit pixels. LONG ROOM: 117,689 lit pixels, 90 relevant physical occluders, two GPU candidate batches, 873 solids retained, zero GL errors. Screenshots inspected. Software GPU frame time is slow and remains subject to P3A4 measurement; this is correctness evidence, not hardware performance certification.

Lamp range/power preserve the accepted 380/.43 values; emitters now have actual Z160. Player spawn is 24 units east of the source wall boundary within the original neighborhood, providing full collider clearance. The flat source and default host selection remain unchanged.

P3A2 not started at this checkpoint. Final source identity is in the external checkpoint receipt.
