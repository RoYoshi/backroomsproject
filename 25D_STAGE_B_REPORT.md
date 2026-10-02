# Stage B engineering report

Status: **2.5D STAGE B ENGINEERING COMPLETE — CHECKPOINT READY FOR REVIEW**.
Human gameplay QA remains pending. Stage C was not started.

This is a clean reconstruction from the approved Stage A ZIP, not a recovery of the
lost implementation. Previous-run claims were reference targets only. All evidence
below was reproduced in this run.

## Authority

- Stage A ZIP SHA-256: `43611c0282f387748b8f6782268c101d7022380986288ee40c781a19a19696e0`.
- Locked Part 2 input: v23.3.6-hqa-search-polish, SHA-256 `b0f7c297fcd58c4e12a5666dcdfbd5624120178aaf1515080e219584d3947e60`.
- Architecture SHA-256: `f2bd15d6091505128516572db84a463cb8d4dcece946eb92433a614d05f6976d`.
- Stage A's manifest, contracts, reference traces, Z01–Z32 matrix and I-01–I-20 authority remain unchanged.
- `dev/stage_b/STAGE_B_INSTRUCTION.txt` preserves the current reconstruction instruction.

## What changed

`levels/level0.js` is one recursively frozen, data-only Level 0 authority. It retains
ordered rooms/carves, columns/pillars, lamp generation inputs and stable IDs, original
prop IDs/placements, material assignments, spawn/reachability anchors, legacy collectible
room references and patrol data. Runtime glitched-wall generation remains owned by the
unchanged algorithm in sim glue; the definition records its policy rather than fake anchors.

`world_geometry.js` is the shared validation/compilation/query boundary. Canonical SHA-256
sorts object keys and preserves array order. The cache identity includes world content and
the unchanged material profile hash. No timestamps or paths enter identity. Validation
rejects nonfinite values, duplicate IDs, bad references, invalid modes/schema/bounds and
content corruption. The runtime accepts only explicit `flat-compat`; Z bounds are null,
spatial records are absent, and all six future spatial query APIs throw explicitly.

Planar algorithms are preserved from Stage A. `world.js` keeps generic prop/crawl
construction, movement/material profiles and art; placements now derive from the canonical
definition. Per-instance old arrays/functions are compatibility views. `dev/sim_head.js`
and `dev/sim_glue.js` consume the shared compiler, with generated `sim.js` reproduced through
the original build script. The bundle has four anchored substitutions, no broad rewrite.
The migration does not change AI, move.js, death, interpolation or network protocol sources.

`server.js` explicitly serves the two new modules and the two policy scripts. B-01 is
**PRE-EXISTING INTEGRATION DEFECT — FIXED IN STAGE B**. Camera/timing policy files and values
are unchanged. Actual HTTP bytes and literal application timing/resize/world bindings are
verified. This intentionally activates the already-approved hosted camera policy instead
of the legacy fallback; it is not an AI or physical balance change.

## Gates

| Gate | Result |
|---|---|
| Stage A ZIP/architecture/227-file manifest/contracts | PASS |
| Stage A fresh-process 46-trace reproduction | PASS |
| Preflight Hound/HQA/FPS/camera and reproducible builds | PASS |
| Preflight B-01 broken routes | PASS — original defect reproduced |
| New geometry/identity/negative validation groups | PASS — 24 groups |
| Map/data/nav/query/seed export | PASS — byte-identical |
| Migrated gameplay records | PASS — 46 traces, 35,098 records, tolerance zero |
| Trace metadata | Only lifecycle maintained-source SHA changed; explicitly recorded |
| Full regression | 151/162 aggregate; same 11 failed assertions; shared 22/23 |
| Network | audit_net 17/17, audit_net2 11/11, live 17/17, IR 4/4 |
| Existing performance workloads | PASS; no human fairness inference |
| Fresh extraction path with spaces | PASS — builds unchanged, new tests and HTTP pass |
| Browser rendering/runtime | BLOCKED — see browser-launch.json |
| Human gameplay QA | PENDING |
| Spatial physics / Stage C+ | NOT IMPLEMENTED BY DESIGN |

The inherited P08 remains UNKNOWN / NEEDS INVESTIGATION. F22 is an obsolete exact-source
guard: Stage A first reported mp.js; this intentional data migration now encounters world.js
first. That is documented rather than normalized away. The independent Stage B allowlist,
unchanged gameplay source hashes and exact traces are the applicable migration evidence.
No thresholds or old tests were edited. Historical L5c timing sensitivity remains on record.

## Recovery and delivery

Before the long aggregate/network/performance run, a complete working recovery ZIP was
created, syntax-checked, CRC-checked, extracted and compared byte-for-byte, then saved
externally with its checksum/status. Its SHA-256 is
`31e803c663fa47aa66a0da15eaa0e1d03a494ce50d74574425e082698ea7910c`.
The working checkpoint remains a historical recovery point, not the final release.

Final reports and complete project are packaged once after validation. Final ZIP checksum
and `25D_STAGE_B_PACKAGE_VERIFICATION.json` remain external to avoid circular identity.
That JSON records the one bounded clean-extraction check of final bytes, syntax, required
files and real HTTP behavior. `redirect.js` is included unchanged at project root.

Use `node server.js` for the game and `node redirect.js` for the existing Render compatibility
service. All tooling uses package-relative paths. Detailed commands and compatibility mirror
ownership are in `dev/stage_b/README.md`. Stage A's historical verifier/404 expectations remain
untouched and are explicitly superseded for Stage B by the new migration checks.

Stop for independent review; do not start Stage C.
