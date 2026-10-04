# Stage I portability / Z32

PASS: complete staged-source ZIP extracted to `/workspace/scratch/be6e71d940f9/Stage I Portable Certification 01/thefarbackrooms-level0`. The destination contains spaces and no Git checkout. 2613 source files were verified against staged Git blobs before execution; archive CRC passed. The final I5 publication separately verifies every exact final source blob, mode, manifest entry and fresh extraction.

Two full rounds of `bash dev/build_ai.sh`, `bash dev/build_sim.sh`, `bash dev/build_ents.sh` reproduce these hashes:

| Generated output | SHA-256 |
|---|---|
| ai.js | 29adbe5d22897d0427f32fa9f9add80b0dfa9b7b07dde73ef32652ebecc2845b |
| sim.js | 5e1271b6e784513db9a0b2a5d95086ff8a47f7461ac17d13aa868ef1257181fa |
| ents.js | f7190223f6bdcdcf91fb1f8169d59ebe301866c160b7ff1affc48149f08d5284 |

All seven named 2.5D suites execute from this extracted package. The tests also run FPS/camera, normal `node server.js` in both flat/spatial host modes, `node redirect.js` with an actual 302/path-preserving request, required public runtime modules with HTTP 200 and byte identity, malformed paths, and private server/dev modules with expected rejection. Production Playwright browsers load the extracted runtime and validate script/GL/resource behavior. Required test dependencies are documented in dev/stage_i/README.md; the product never depends on the originating workspace path.

The named perf_world25d gate performs an additional fresh package-relative extraction/build/HTTP exercise. Final publication refuses any changed or newly added code path after full portable validation. Test/output paths in evidence identify where execution happened; they are not application dependencies. Product Node >=18 remains a declaration; observed engineering runtime is Node v24.19.0 with Chromium 151 / SwiftShader.
