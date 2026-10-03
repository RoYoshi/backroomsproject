# CURRENT STATUS AND AUTHORITY — STAGE H

## Accepted parent

Stage G engineering: PASS.
Stage G human QA: PASS.

Repository:
`RoYoshi/backroomsproject`

Accepted Stage G commit:
`7fb4dafef92040571209403358e536ccb1105509`

Accepted Stage G tree:
`eee7f43a74aeb4d0e7ef38effdfc7516eee5e8cf`

Verified publication receipt expected archive SHA-256:
`dabea2b5527a80a86d956712947df87ec08bd4cf79aa51178075738aab2e609a`

The later chat upload of that ZIP was truncated and must NOT be used as source.
The Git commit/tree above are authoritative.

## Superseded Stage G wording

The released Stage G report/handoff says human QA is pending and Stage H has not
been authorized. That was true when those files were generated.

Afterward the user loaded Stage G, confirmed gameplay was good, and authorized the
next stage.

`ACCEPTED_STAGE_G_AUTHORITY.md` supersedes only those stale approval/authorization
statements. It does not alter the technical Stage G evidence.

## Carried-forward limits

Do not erase or silently "fix" unrelated retained items simply to make H green.

Carry forward:
- aggregate 151/162 with the same eleven inherited failures
- shared F22
- P08 UNKNOWN
- historical L5 timing caveats
- first NZ1 timing observation with isolated rerun PASS
- external Google Fonts TLS limitation in the test environment
- hardware-GPU certification not yet established
- Stage G 24-active aftermath workload over the 16.667 ms tick budget and high
  peak payload; final capacity belongs to Stage I

Stage H may measure presentation cost and make presentation-only bounded quality
optimizations, but must not hide physics/network correctness or reduce awareness.

## Stage H branch

Create/use:
`stage-h`

from exactly:
`7fb4dafef92040571209403358e536ccb1105509`

If it already exists, inspect it before writing and never overwrite newer work.

Do not implement from `main`.

## Locked architecture

Stage H must complete:
- Z14 H portion
- Z29 H portion
- Z30

and preserve all completed A–G invariants.

The production rendering stack remains the existing Pixi/application renderer.
`world_view.js` is the client spatial projection/depth/visibility/cutaway/picking
boundary. Rendering consumes authoritative physical state but never changes it.
