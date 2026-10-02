# Stage D parity and frozen-system boundary

The parent is the approved Stage C ZIP, SHA-256 `0ded2b248867be592c25585de89a45217cbf989f4257c1a94301ffbaa89c585b`.

`dev/stage_d/parent-stage-c-manifest.json` records every parent file. `verify_scope.js` compares all originals, rejects deletions/unlisted modifications, and proves that removing exactly `world_view\.js|stage_d\.html|` from the server's public regex reproduces the parent server hash. The written modified-original allowlist permits only that serving change.

**478 parent files: 477 byte-identical, one narrowly modified, zero deleted.** This includes byte equality for Stage C world geometry/motion, the canonical fixture, real move.js, fixed-tick policy, CAMERA-P01, production index/bundle/chunks, AI/canon/perception/evidence/navigation, death/aftermath, interpolation and multiplayer client logic. No simulation outcome was intentionally changed.

The retained trace verifier matches **46 traces and 35,098 records** and the exact canonical Level 0 export. Its historical source-metadata differences and six-file changed list compare against the older Stage B/Stage A references; they are inherited Stage C history, **not six new Stage D modifications**. Stage D's own manifest comparison is `evidence/scope.json` and the full changed-files report.

New independence testing executes unchanged real move.js and world_motion while view projection, visibility, culling and cutaway run between completed ticks. The same 240-tick ramp trace is obtained at 15, 30, 60, 120, 144, 240, 360 FPS and jitter. Hash: `4b1144301cfc71e07e29119cc46b4e773cc1016cf04406a1c9af95d21ee1ac31`. View input ownership and caller frozen-state checks prevent render compilation from altering simulation objects.

Two browser instances share exactly the same model/snapshot references, with lower observer fade 1 and upper observer fade 0. World content hash remains `3799f2e658968a13105efd3076c4b12a79a9135d34774f5489dd8c34064205bb`. Snapshot hash remains `0d707db4986511520320f0c8d6bb890e13e55c7b8673460f140cbff7fc969bfc`. Camera/cutaway/quality changes do not change either.

Actual production screenshots from `/` are identical to the clean Stage C parent in a deterministic SOLO capture (seeded RNG, controlled browser clock and CSS animations disabled in the test only):

| Capture | Both parent and Stage D SHA-256 |
|---|---|
| Menu | `3ae2fa761595be1eb900cff200e7f72eb6018f72d75b358d32d8381d464ceebc` |
| Active gameplay | `3402169fe9b730442f53ba4c2b6ed0241a0fe5ec51ab3910d223d70c19ef6dd5` |

The production page never loads `TFB_VIEW`. The screenshots prove these tested flat states, not every possible subjective gameplay situation. Multiplayer behavior is separately exercised by the unmodified audits. No human playtest is claimed.
