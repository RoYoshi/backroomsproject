# THE FAR BACKROOMS — 2.5D Stage E final engineering report

**2.5D STAGE E ENGINEERING COMPLETE — CHECKPOINT READY FOR REVIEW**

This status applies to the final source checkpoint together with a PASS in the
separate `25D_STAGE_E_PACKAGE_VERIFICATION.json`. Human gameplay/design QA remains
pending. Stage F has not begun. No merge or change to `main` occurred here.

## Scope and recovery

Work continued from verified `stage-e` candidate
`bca4bb1ca183e7c2cb83a676d4f3c3e3167f954f`; E0–E4 were preserved. Accepted Stage D
base: `478ada6cf534d40810e28709755e88f0b53b6ee5`; immutable ZIP SHA-256:
`b52a40ca1d10216d113f5105c4f1e537dce2270b786f9b293e9d59467629c5de`.
All 585 parent files were checked against its immutable manifest before editing.
The E0–E5 ancestry and exact initial branch HEAD were verified.

E5 repaired one new flat-LOD regression: an undefined `geo` in `coarseMove`. The
original flat XY distance expression was restored and generated AI rebuilt.
Existing spatial implementation was retained. Named Z10–Z17 entry points now
invoke completed suites; spatial route counters were added without changing
decisions. Other new work is validation, evidence, packaging and reports.
Concurrent `stage-e` checkpoints were preserved through non-forced updates; local
and remote source trees were compared before each push.

The historical E3 working ZIP was externally saved before long regression, as
recorded by `E5_CANDIDATE.md`. Later archive uploads had been blocked in the prior
session; source checkpoints continued on the authorized GitHub branch. That
history is not rewritten. Working archives are not nested in the final ZIP.

## Demonstrated behavior

| Boundary | Evidence |
| --- | --- |
| Surface identity and A* | Distinct stacked XY nodes, deterministic occupied-surface compilation, capability-specific edge proofs and composite route identity. |
| Physical traversal | Actual Stage C kernel executes stairs, ramps, legal seams, vaults, crawl and one-way drops; invalid reverse/clearance routes fail. No endpoint teleport or Z snap. |
| Actual species | Existing Hound/Smiler brains consume adapters. Smiler has no new crawl, flight or teleport ability. |
| Sensors | XYZ sight/gaze/light/contact respect slabs and openings. Cutaway/GPU state is not sensor authority. |
| Sound/memory | Bounded portal/material propagation yields uncertainty and legitimate attribution, not hidden source support/floor truth. |
| Equal evidence | Full state and RNG match across hidden elevation/route/velocity and IR counterfactuals; positive controls respond to new observations. |
| LOD/groups | Falling/active traversal retain fixed physical ticks. Pack feasibility and information transfer respect geometry and evidence. |
| Protected behavior | Fixed 60 Hz, camera fairness, flat Level 0, wire snapshots, death system and Stage D presentation remain retained. |

Eight named gates execute 65 actual groups: core 8, motion 16, sensors 16 and
entities 25. The aggregate remains exactly 151/162 with the same 11 inherited
failures; P08 is UNKNOWN / NEEDS INVESTIGATION. No baseline, frozen assertion or
threshold was regenerated or weakened.

All 46 frozen traces / 35,098 records match at tolerance zero using the original
comparator. The map export is byte-identical. Node v24.19.0 reference metadata and
current Node v25.9.0/source metadata remain explicitly different.

Actual Chromium 151.0.7922.34 passed Stage D core and extended visibility checks.
The retained flat capture exposed a parent-only clock-origin race; the additive
controlled capture aligns elapsed times and passes exact state/PNG equality.
Original failures remain recorded. Served production and Stage D pages pass with
zero script/request/HTTP errors using an isolated store of the environment's
already trusted certificates. TLS verification remains enabled.

## Limits and measured costs

Connected eight-entity median/p95/p99/worst measured simulation steps are
0.430/6.648/20.568/120.248 ms. Warm stacked-floor plan median/p95/max is
11.064/16.012/16.591 ms. A separate cold-plan diagnostic reaches 260.737 ms.
These spikes are real limitations; this is not a production capacity guarantee.
Repeated 1/2/4-sheet workloads remain bounded and evidence caps pass.

The Stage D renderer remains an early feasibility prototype. Its SwiftShader
frame-budget limitation and 64-solid/8-plane bound carry forward. Hardware-GPU
performance is unverified. Stage E fixtures are automated; no polished playable
spatial pursuit scene or subjective human approval is claimed. Stage F protocol,
Stage G aftermath and Stage H production presentation remain outside this stage.

## Audit and package

Seventeen original Stage D files changed for stated Stage E reasons; 568 remain
byte-identical and zero were deleted. Every modified original and added path is
in `25D_STAGE_E_CHANGED_FILES.txt`; protected hashes and wire snapshot comparisons
are in `dev/stage_e/evidence/final/scope.json`.

Normal startup remains `node server.js`; `redirect.js` remains at root with
separate service `node redirect.js`. Node v25.9.0 is the active runtime. The ZIP is
created once from a clean committed `stage-e` tree and verified by CRC, exact-file
hashes, a fresh gitless extraction into a path containing spaces, reproducible
AI/simulation/entity/Stage D builds, served-path protection and browser execution.
The external verification records the final commit, tree, every file hash,
command outcomes and archive identity.

Both authority spellings of the ZIP filename are supplied as identical bytes.
Final checksum/package identity stays external. See the checkpoint ledger, test
summary, parity, baseline, navigation, perception and human-QA reports. Stop at
Stage E review.
