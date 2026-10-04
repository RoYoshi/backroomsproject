# STAGE I ACCEPTANCE MATRIX

Stage I is **Full Regression / Performance / Package**.

It is the final objective implementation stage of the locked 2.5D architecture.

## 1. Z18 — I completion

Scenario:
Walk / sprint / stamina / exhaustion / deep carpet.

Final Stage I requirements:
- use the REAL movement state machine
- radius 15 retained
- recovery threshold 36 retained
- existing stamina/resource behavior retained
- deep-carpet/material effects retained
- spatial support path uses the real world/motion integration
- equal physical/gameplay outcomes across:
  - 15 FPS
  - 30 FPS
  - 60 FPS
  - 120 FPS
  - 144 FPS
  - 240 FPS
  - 360 FPS
  - deterministic jitter schedules
- render schedule cannot alter fixed 1/60 simulation
- no replacement formula/model may substitute for `move.js`
- flat control remains accepted

This must become part of the real `s_world25d` acceptance suite.

## 2. Final `s_world25d`

The historical `dev/tests/s_world25d.js` placeholder must become a real suite.

It should aggregate real world/motion acceptance for the world-owned matrix cases,
reusing accepted Stage B/C implementations rather than recreating fake models.

At minimum it must execute real objective evidence for:
- Z01
- Z02
- Z03
- Z04
- Z05
- Z06
- Z07
- Z08
- Z09
- Z18
- Z19

Do not replace accepted Stage C tests with a simplified duplicate implementation.
The named suite may orchestrate existing real gates and additional final cases.

## 3. Z32 — final portability/package gate

Fresh extraction in a path containing spaces must prove:

- advertised tests run package-relatively
- build scripts do not depend on original machine paths
- `ai.js`, `sim.js`, `ents.js` regenerate reproducibly
- generated output hashes remain stable across repeated clean builds
- ordinary server starts from extracted package
- root `redirect.js` is present and syntax-valid
- Render redirect path remains valid
- all required public runtime modules return HTTP 200
- internal/private server modules remain protected as intended
- flat and spatial world modes load explicitly
- no source file is missing from final manifest
- ZIP integrity/CRC passes
- fresh final extraction equals the published source tree
- final file modes are recorded/verified where applicable

This is owned by the real `perf_world25d` final suite plus package verification.

## 4. Final `perf_world25d`

The historical `dev/tests/perf_world25d.js` placeholder must become a real bounded
performance/portability suite.

It must NOT be an unconditional PASS or a wrapper that only checks file existence.

It must exercise representative whole-stack workloads and record actual metrics.

Performance success means:
- correctness is never skipped for speed
- existing explicit hard thresholds remain respected
- new measured limits are reported honestly
- no unexplained regression versus the accepted H parent
- bounded workloads complete without unbounded growth/deadlock/crash
- any environment/hardware limitation is classified rather than hidden

Stage I is not permission to invent arbitrary marketing capacity claims.

## 5. Final Z01–Z32 matrix aggregation

Stage I must produce one machine-readable and human-readable final matrix showing
the final disposition of every Z01–Z32 case.

For each row record:
- owner stage(s)
- real executing suite/evidence
- PASS / inherited limitation / BLOCKED / FAIL
- exact command
- runtime/browser when applicable
- evidence path
- no placeholder status remaining for a completed owner

All Stage I-owned contributions must PASS before completion.

No earlier accepted row may silently regress.

## 6. I-01–I-20 invariant audit

Produce an explicit final invariant audit.

At minimum verify:

- I-01 fixed ticks / 4× death substeps / render independence
- I-02 physical XYZ separate from render interpretation
- I-03 stacked surfaces sharing XY remain distinct
- I-04 continuous support / no floor snap / no unsupported sleep
- I-05 full-volume clearance and physical hidden geometry
- I-06 retained surface-local nav + traversal links
- I-07 shortcuts require physical support/clearance
- I-08 no hidden truth leaks into AI beliefs
- I-09 Hound/Smiler canon/tuning and IR separation
- I-10 server authority and movement validation
- I-11 lifecycle/world-generation identity isolation
- I-12 exactly-one authoritative aftermath
- I-13 body + two hands, no humanoid ragdoll
- I-14 loose objects/decals real support
- I-15 cutaway != physical visibility
- I-16 flat Level 0 compatibility
- I-17 one versioned world truth + reproducible generation
- I-18 correctness cannot be skipped for budget
- I-19 explicit tolerances/bounds + safe diagnostics
- I-20 human QA remains distinct

## 7. Final determinism/property sweep

Run meaningful final property checks around the accepted implementation:

- translate whole fixture in Z
- permute stable-ID static input order
- rotate/mirror simple geometry where supported by the fixture/test
- values just inside/outside ledge/roof/contact tolerances
- max-iteration fallback remains nonpenetrating and diagnostic
- render FPS/view/cutaway/quality/debug changes do not alter simulation trace
- packet jitter/duplicates do not alter world identity or authorize impossible motion
- sample/replay schedule does not alter death outcome

Do not invent a formula-only property test that never hits real production code.

## 8. Whole-stack retained regression

Required retained acceptance includes the real:
- legacy aggregate/failure accounting
- Hound
- Smiler/shared
- human QA automation
- FPS
- camera
- entity look
- physics
- interpolation
- navigation
- audit-net
- audit-net2
- live
- IR network
- performance suites
- Stage B geometry
- Stage C motion/adversarial/schedules/camera
- Stage D view/independence/browser
- Stage E nav/perception
- Stage F protocol/authority/network25d
- Stage G physics25d
- Stage H view25d/production browser
- frozen trace parity
- flat screenshot/state/RNG parity
- build reproducibility
- served package

Use serial execution where timing tests require isolation.

## 9. Human gate

Automated completion is NOT human approval.

Final engineering status must be exactly:

`2.5D IMPLEMENTATION COMPLETE — HUMAN QA PENDING`

Human QA may then approve the completed 2.5D infrastructure.

Do not call the production 2.5D Level 0 content complete; that content migration
is after Stage I.
