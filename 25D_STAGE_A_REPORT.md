# 2.5D Stage A engineering report

Status: **2.5D STAGE A ENGINEERING COMPLETE — CHECKPOINT READY FOR REVIEW**.

Stage A adds an immutable baseline, deterministic comparison tools, inactive spatial contracts and a shared synthetic fixture. The locked game's 227 original files are byte-identical. Hound/Smiler tuning, RNG consumption, movement, navigation, death physics, networking, rendering and map generation were not changed. Stage B was not started.

## Authority and manifest

Input: `thefarbackrooms-level0-part2-v23.3.6-hqa-search-polish.zip` (uploaded filename carries a copy suffix).

SHA-256: `b0f7c297fcd58c4e12a5666dcdfbd5624120178aaf1515080e219584d3947e60`.

The input was independently verified and extracted into fresh pristine, working and portable directories. `dev/baselines/v23.3.6-manifest.json` freezes 227 paths, byte sizes, SHA-256, source/generated/tool classification, archive modes and runtime details. No earlier unfinished tree was used. The architecture attachment is copied byte-for-byte into `dev/contracts/ARCHITECTURE_AUTHORITY.md`; SHA-256 `f2bd15d6091505128516572db84a463cb8d4dcece946eb92433a614d05f6976d`. The exact Stage A instruction is preserved under `dev/stage_a`.

## Requirement completion

| Requirement | Result | Evidence |
|---|---|---|
| A1 input/manifest | COMPLETE | Verified ZIP hash; 227-file immutable manifest |
| A2 current suites | COMPLETE with retained FAIL/BLOCKED outcomes | 18 requested headless suite/benchmark invocations, raw logs and exact counts; browser blockers explicit |
| A3 failure baseline | COMPLETE | Markdown + machine-readable ledger; 11 aggregate failures repeated; L5c fail/pass timing flake; P08 remains unknown explanation |
| A4 reference coverage | COMPLETE | 46 traces / 35,098 records across motor, both species, evidence/light/IR, death, navigation and interpolation/lifecycle |
| A5 deterministic format/diff | COMPLETE | Canonical gzip JSON, exact fresh-process reproduction, planted divergence exits 1 |
| A6 data/API contracts | COMPLETE | Inactive declarations, validator and negative controls; no runtime activation |
| A7 identity | COMPLETE | Distinct typed scopes, generation semantics and fixture key tests |
| A8 synthetic fixture | COMPLETE as DATA ONLY | Stable IDs, finite geometry records, valid refs and canonical order; physics NOT IMPLEMENTED |
| A9 future gates | COMPLETE as scaffolding | Z01–Z32 stage matrix; seven entry points deliberately refuse passing status |
| A10 hosted B-01 | COMPLETE reproduction | Actual server 200/200/404/404; defect preserved; malformed URL then valid request also checked |
| A11 build portability | COMPLETE | Fresh space-containing path; three generated output hashes unchanged |
| A12 redirect rule | COMPLETE | Original root redirect.js present, syntax-valid, packaged; normal server.js separate |

## Evidence and limits

The aggregate is **151/162**, shared **22/23**, Hound **18/18**, HQA **6/6**, camera **12/12**, audit_net **17/17**, audit_net2 **11/11**. First live run **16/17**, retry **17/17**. These are not an all-green release result. The known-failure ledger preserves historical statistical/semantics gates, F22's obsolete source-hash guard and the new baseline observation P08 without silently excusing it. Browser checks are BLOCKED; human QA remains separate.

New motor references execute real move.js and match exactly at all eight frame schedules, including recovery threshold 36, radius-15 collision through the existing adapter and deep carpet. Death references execute shared dphys and agree with fallback final remains. AI observers snapshot existing semantic state without writing species state, consuming RNG or adding hidden-truth access. Seeded scenario source and the immutable manifest define transitive inputs.

Contracts supply declarations and basic data validation, not a finished world compiler. Future query results, polygon topology/convexity, spatial clearance, solving, navigation cells and portal-volume compilation belong to their owning stages. Broad space envelopes explicitly require solid subtraction later. Fixture collider heights are synthetic values, not changes to live species/player profiles. See `dev/contracts/IDENTITY_AND_FIXTURE.md`.

B-01 remains intentionally unresolved: policy scripts return 404. Existing timing fallback retains 1/60, 15 catch-up steps and 250 ms clamp; old hosted camera fallback remains .85/1.18. Unit policy tests and script-source wiring assertions do not prove those policies loaded over HTTP. The served regression freezes the actual broken baseline so Stage B can correct it explicitly.

The current server's legacy timing and transport are preserved exactly. Stage A does not replace its 25 ms scheduling or add a Z protocol. Peer-render easing remains per-frame presentation; capture documentation distinguishes that from fixed-tick motor physics. Do not use that trace to claim cross-FPS remote presentation equivalence.

## Final self-audit

| Question | Answer |
|---|---|
| Any gameplay, species, movement or RNG change? | No: every original file unchanged; new code is developer-only and not loaded by runtime |
| B-01 fixed early? | No: independently reproduced and retained |
| Runtime XYZ / Stage B started? | No |
| Generated files silently changed? | No: before/after generation hashes match |
| redirect.js preserved? | Yes, root file unchanged, separate start command |
| Package can build/test from clean paths? | Yes for headless tools/builds; browser dependencies remain unavailable; local socket access is required for network tools |
| Objective future comparison available? | Yes: original manifest, exact traces, diff tool, raw outcomes and known-failure ledger |
| Every observed failure classified? | Yes; uncertain P08 and environment blockers are explicit |
| Human or full 2.5D acceptance claimed? | No |

## Checkpoint and next step

The ZIP contains the complete project, baseline manifest, contracts/fixture, tools/traces, logs, reports, architecture authority and unchanged redirect.js. The external SHA-256 file hashes the ZIP and main deliverables. Final extraction/tree comparison and fresh space-path checks are captured in `25D_STAGE_A_PACKAGE_VERIFICATION.json`. The hash file remains outside its own ZIP to avoid a circular digest.

All additions are listed in `25D_STAGE_A_CHANGED_FILES.txt`; zero original files are modified/deleted. Exact commands and exit meanings are in `dev/stage_a/README.md`.

Stop here for review. The next authorized implementation stage, only after approval, is Stage B's canonical flat geometry/Level 0 extraction and explicit B-01 integration correction, under the locked architecture. No implementation for that stage is included.
