# STAGE I IMPLEMENTATION SEAMS

Stage I is primarily certification/hardening. It should have a SMALL runtime diff
unless objective evidence demonstrates a real defect or safe performance repair.

## Dormant named gates

Accepted H still contains:

`dev/tests/s_world25d.js`
- intentional future placeholder

`dev/tests/perf_world25d.js`
- intentional future placeholder

Stage I should activate them by orchestrating the REAL accepted implementations.

Do not reimplement the motor/geometry/performance model inside the test.

## Existing real suite ownership

Reuse the real:
- Stage C spatial tests for world/motion
- Stage E nav/perception
- Stage F network25d
- Stage G physics25d
- Stage H view25d

The final named suite layer should make the architecture's intended seven entry
points truthful without creating competing engines.

## Runtime changes

If Stage I uncovers a real defect:
- preserve failure evidence first
- make the narrowest safe repair
- modify maintained source, not generated output only
- regenerate generated files reproducibly
- rerun the focused gate
- rerun every affected owner stage
- compare frozen traces/parity

No "cleanup" rewrite is authorized.

## Performance optimization

Only optimize after measuring.

Permitted examples when evidence supports them:
- cache/chunk/index improvements that preserve exact query semantics
- bounded scratch-buffer reuse
- avoiding redundant non-authoritative render work
- compact equivalent network encoding with explicit compatibility/versioning only
  if truly required and safely proven

Not permitted:
- skipping collision
- reducing AI evidence
- changing death physics
- hiding updates
- dropping occluders
- relaxing validation
- lowering preserved test thresholds

A performance optimization with changed gameplay semantics is a FAIL.

## Packaging

Final package root must retain:
- `server.js`
- `redirect.js`

Ordinary server:
`node server.js`

Render redirect:
`node redirect.js`

Stage I must verify both advertised launch paths as applicable.

The final archive must be produced from the exact verified final `stage-i` source
checkpoint, with self-referential hashes kept in external publication receipts.

## Branch safety

Parent:
accepted Stage H commit.

Implementation:
`stage-i`

Do not touch `main`.

Do not merge after completion unless the user separately authorizes it.

Do not begin post-I map/content or Part 3 work inside Stage I.
