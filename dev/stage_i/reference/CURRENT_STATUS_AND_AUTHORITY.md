# CURRENT STATUS AND AUTHORITY — STAGE I

## Accepted parent

Stage H engineering: PASS.
Stage H human QA: PASS.

Repository:
`RoYoshi/backroomsproject`

Accepted Stage H commit:
`692eebd338cc42347d437b0c0a2dcc9d7217ac34`

Accepted Stage H tree:
`1cd5430b61aac7f994da29f4879621a638c49526`

Accepted Stage H ZIP SHA-256:
`037feeeaeb16c354c11228458c31f986cfce594cfeaf8e93472d21b919ef9d5d`

Accepted Stage H ZIP bytes:
`69071771`

## Superseded Stage H wording

The Stage H release files say human QA is pending. That was true when generated.
The user subsequently approved Stage H.

`ACCEPTED_STAGE_H_AUTHORITY.md` supersedes only the stale human-QA status.
All Stage H technical evidence and disclosed limitations remain authoritative.

## Known carried-forward limitations / observations

Do not erase these simply to make Stage I look green:

- aggregate legacy result: 151/162 with the same accepted eleven failure names
- shared: 22/23 with inherited F22
- P08 remains UNKNOWN
- historical L5 and NZ1 timing observations remain classified
- Google Fonts network/TLS environment limitation
- Stage H SwiftShader presentation misses 16.7 ms; no hardware-GPU certification yet
- full-quality SwiftShader two-client fall capture can miss airborne phase while
  Reduced detail passes the unchanged assertion
- Stage G 24-active aftermath performance/payload limit remains disclosed
- initial H retained light performance miss remains preserved with unchanged
  isolated passes

Stage I may investigate and safely optimize real bottlenecks, but it must not:
- weaken physics,
- drop occluders,
- change AI evidence,
- relax frozen assertions,
- fake sleep,
- reduce network validation,
- hide failed measurements.

## Dormant final gates

At the accepted Stage H parent:

`dev/tests/s_world25d.js`
is still an intentional future NOT-IMPLEMENTED gate.

`dev/tests/perf_world25d.js`
is still an intentional future NOT-IMPLEMENTED gate.

Stage I must activate these as REAL suites.

All final named suite owners should then be real:
- s_world25d
- s_nav25d
- s_perception25d
- network25d
- physics25d
- view25d
- perf_world25d

## Stage I branch

Create/use:
`stage-i`

from exactly:
`692eebd338cc42347d437b0c0a2dcc9d7217ac34`

If `stage-i` already exists, inspect before writing and never overwrite newer work.

Do not implement from `main`.

## End boundary

Stage I completes the 2.5D ENGINE/INFRASTRUCTURE plan only.

Do not begin:
- production 2.5D Level 0 map/content conversion,
- Part 3 rendering/atmosphere work,
- post-I visual redesign.
