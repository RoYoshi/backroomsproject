THE FAR BACKROOMS — 2.5D STAGE G MASTER PACK
================================================

STAGE
-----
G — Shared Death & Loose-Object Elevation

PURPOSE
-------
Implement ONLY Stage G from the human-accepted Stage F checkpoint.

Stage G extends the existing shared procedural death simulation and server aftermath
into real spatial XYZ. It does NOT invent a new ragdoll system, new death variants,
new equipment rules, or Stage H presentation work.

FINAL HUMAN AUTHORITY
---------------------
The user is the final gameplay/design QA authority.

Stage F:
HUMAN QA PASS.

IMMUTABLE PARENT
----------------
File:
`PARENT_STAGE_F_ACCEPTED.zip`

SHA-256:
`7d9176c3e66caab42683d22d9068c0fd3596d6fe7d8f1fd50eff9532e7ad5a5b`

Accepted Git checkpoint:
`ba4fd2d63f440aa113722942bcb4861ba665e1f3`

Accepted Git tree:
`1f33fdd0bfff9ed3268b4fd39648eb4112813199`

Repository:
`RoYoshi/backroomsproject`

Create/use:
`stage-g`

from exactly the accepted Stage F commit above.

DO NOT use `main` as the Stage G parent.
DO NOT modify/repair/reset/merge/force-push `main`.
DO NOT begin Stage H or Stage I.

READ ORDER
----------
1. `README_FIRST.txt`
2. `ACCEPTED_STAGE_F_AUTHORITY.md`
3. `CURRENT_STATUS_AND_AUTHORITY.md`
4. `STAGE_G_MASTER_PROMPT.txt`
5. `STAGE_G_ACCEPTANCE_MATRIX.md`
6. `STAGE_G_IMPLEMENTATION_SEAMS.md`
7. `authority/THE_FAR_BACKROOMS_2_5D_WORLD_ARCHITECTURE.md`
   - especially sections 4, 7.1/7.3, 8, 11, 12, 13, 14, 15
8. `authority/25D_STAGE_MATRIX.md`
9. Stage F acceptance reports under `stage_f_acceptance/`
10. `PARENT_STAGE_F_ACCEPTED.zip` as immutable parent/reference

LOCKED STAGE G OWNERSHIP
------------------------
Stage G owns:
- Z25
- the G-owned completion of Z26
- the G-owned completion of Z27
- Z28
- Z31
- activation of the real `physics25d` acceptance suite
- XYZ extension of the existing shared `dphys.js` death kernel
- one authoritative active spatial aftermath
- body/hands/light/hat independent physical elevation/support
- support-aware friction/contact/sleep
- ledge loss of support / settling
- spatial corpse/equipment replication and revisions
- immediate-disconnect / delayed-client / duplicate-message / late-join correctness
- surface-attached decal/trail physical records required by G
- bounded active-aftermath performance evidence

Stage G does NOT own:
- new death plans/variants
- visible arms/legs/full humanoid ragdolls
- new dismemberment/equipment rules
- full Stage H production spatial presentation
- UI/map/admin visual integration
- Stage I whole-project stress/certification
- replacement network transport
- replacement player motor
- Hound/Smiler tuning/canon changes

MANDATORY CHECKPOINT POLICY
---------------------------
Use G0–G5.

After EACH milestone:
1. run its focused validation,
2. preserve failing evidence before fixing any discovered regression,
3. commit substantial unique source/evidence,
4. push to `stage-g`,
5. record the verified remote SHA,
6. only then continue.

No substantial unique Stage G work may remain only in an ephemeral Work session for
an extended period.

Start with `STAGE_G_MASTER_PROMPT.txt`.
