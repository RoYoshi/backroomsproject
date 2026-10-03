# CURRENT STATUS AND AUTHORITY — STAGE G

## Accepted parent

Stage F engineering: PASS.
Stage F human QA: PASS.

Repository:
`RoYoshi/backroomsproject`

Accepted Stage F commit:
`ba4fd2d63f440aa113722942bcb4861ba665e1f3`

Accepted Stage F tree:
`1f33fdd0bfff9ed3268b4fd39648eb4112813199`

Accepted Stage F ZIP SHA-256:
`7d9176c3e66caab42683d22d9068c0fd3596d6fe7d8f1fd50eff9532e7ad5a5b`

The ZIP source tree exactly matches the accepted remote commit tree.

## Superseded Stage F wording

The embedded Stage F report/handoff says final publication was blocked and human QA
was pending. That was true when those files were generated.

Afterward:
- the final source was published to `stage-f`,
- remote checkpoint became `ba4fd2d63f440aa113722942bcb4861ba665e1f3`,
- the user performed/accepted human QA,
- Stage F was declared good.

`ACCEPTED_STAGE_F_AUTHORITY.md` supersedes only those stale status/authorization
statements. It does not alter Stage F technical evidence.

## Carried-forward known failures/limits

Do not erase or silently fix inherited failures merely to make Stage G green.

Stage F retained:
- aggregate 151/162 with the same eleven inherited failures
- P08 UNKNOWN / NEEDS INVESTIGATION
- F22 / SM01
- historical L5 timing caveats
- Google Fonts TLS limitation in the test environment
- hardware-GPU performance not certified
- Stage H presentation intentionally incomplete

Stage G is responsible for new spatial death/aftermath correctness, not unrelated
legacy cleanup.

## Stage G branch

Create/use:
`stage-g`

from exactly:
`ba4fd2d63f440aa113722942bcb4861ba665e1f3`

If `stage-g` already exists, inspect it before writing. Never overwrite newer work.

Do not implement from `main`.

## Locked architecture

The 2.5D architecture and Z01–Z32 matrix remain locked.

Stage G must satisfy:
- Z25
- G portion of Z26
- G portion of Z27
- Z28
- Z31

and invariants I-01, I-02, I-03, I-04, I-05, I-10, I-11, I-12, I-13,
I-14, I-16, I-17, I-18, I-19, I-20, plus all unaffected earlier invariants.
