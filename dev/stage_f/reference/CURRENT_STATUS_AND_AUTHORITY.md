# CURRENT STATUS AND AUTHORITY — STAGE F

## Accepted parent

Stage E is accepted by human QA.

Immutable ZIP:
`PARENT_STAGE_E_ACCEPTED.zip`

SHA-256:
`a935b3f9c38bea48edc0add99b53d234ce431daf3986face4350691a2e8ad1e6`

Authoritative remote Stage E commit:
`da90dbb48ac4702d666d26c638fe074a78478212`

Commit message:
`Stage E E5: combine final reports, independent verification and complete package audit`

## Stage E acceptance carried forward

Engineering status:
`2.5D STAGE E ENGINEERING COMPLETE — CHECKPOINT READY FOR REVIEW`

Human QA:
PASS.

Observed human note:
Normal Level 0 felt fine; entities seemed slightly more responsive. No visible
regression was reported.

## Known retained limitations/failures

Do not "fix" inherited failures merely to make Stage F green unless Stage F
directly causes/exposes a new regression.

Carry forward the exact Stage E failure ledger and reports.

Important retained disclosures include:
- aggregate 151/162 with same 11 inherited failures
- P08 UNKNOWN / NEEDS INVESTIGATION
- F22 / SM01 inherited items
- historical timing-sensitive L5b/L5c disclosure
- Stage D SwiftShader/hardware-GPU limitations

## Branch authority

Repository: `RoYoshi/backroomsproject`

Create/use branch:
`stage-f`

Parent it from exactly:
`da90dbb48ac4702d666d26c638fe074a78478212`

Do not derive Stage F from `main`.

`main` contains an earlier accidental partial Stage E merge and is outside this
stage's scope. No main cleanup is authorized here.

## Locked architecture rule

The architecture is locked. If implementation reveals a genuine blocker, stop the
affected expansion, document the exact failing gate and propose a minimal explicit
architecture amendment. Do not silently widen authority or replace the player
motor/network transport.
