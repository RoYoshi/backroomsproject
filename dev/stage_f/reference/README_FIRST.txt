THE FAR BACKROOMS — 2.5D STAGE F MASTER PACK
=================================================

STAGE
-----
F — Authority & Protocol

PURPOSE
-------
Implement ONLY the Stage F authority/networking layer required by the locked
2.5D architecture. This pack uses the human-accepted Stage E checkpoint as the
immutable parent.

USER / QA AUTHORITY
-------------------
The user is the final design/gameplay QA authority.

Stage E human QA result supplied for this handoff:
PASS — normal Level 0 gameplay felt retained; entities were subjectively a little
more responsive, with no observed gameplay regression.

IMMUTABLE PARENT
----------------
File:
PARENT_STAGE_E_ACCEPTED.zip

SHA-256:
a935b3f9c38bea48edc0add99b53d234ce431daf3986face4350691a2e8ad1e6

Authoritative Stage E Git checkpoint:
da90dbb48ac4702d666d26c638fe074a78478212

Repository:
RoYoshi/backroomsproject

The implementation branch for this stage should be:
stage-f

CRITICAL BRANCH RULE
--------------------
Create/use `stage-f` from exact Stage E commit
`da90dbb48ac4702d666d26c638fe074a78478212`.

DO NOT use `main` as the Stage F parent.
DO NOT repair/reset/force-push/merge `main` during Stage F.
DO NOT merge Stage F to main.
DO NOT begin Stage G.

READ ORDER
----------
1. README_FIRST.txt
2. CURRENT_STATUS_AND_AUTHORITY.md
3. STAGE_F_MASTER_PROMPT.txt
4. STAGE_F_ACCEPTANCE_MATRIX.md
5. authority/THE_FAR_BACKROOMS_2_5D_WORLD_ARCHITECTURE.md
   - especially sections 7, 11, 12, 13, 16 and invariants I-01..I-20
6. authority/25D_STAGE_MATRIX.md
7. Stage E acceptance reports under stage_e_acceptance/
8. PARENT_STAGE_E_ACCEPTED.zip only as immutable source/reference parent

SCOPE BOUNDARY
--------------
Stage F owns:
- versioned spatial handshake / protocol capabilities
- world epoch and lifecycle/generation identity
- geometry/schema/motion-profile compatibility identity
- spatial pose serialization
- validated player movement proposals
- bounded fixed-tick validation history/queues
- server ownership of unsupported and timed traversal motion
- authoritative correction / discontinuity semantics
- reconnect/world-reset isolation
- common spatial interpolation history and transition handling
- real server/client latency, bunching, stale/duplicate, reconnect and malicious-Z tests
- Z20 through Z24

Stage F does NOT own:
- Stage G authoritative death aftermath/corpse/equipment physics
- Stage H complete production presentation integration
- Stage I final whole-project packaging/performance acceptance
- replacement networking transport
- replacement player motor
- ECS/physics-engine rewrite
- gameplay tuning/canon changes

CHECKPOINT POLICY
-----------------
After EVERY F0–F5 milestone:
1. run the milestone's focused tests,
2. commit unique source/evidence,
3. push to `stage-f`,
4. record remote commit SHA,
5. only then continue.

Never allow substantial unique Stage F work to exist only in an ephemeral Work
workspace for a long period.

Start with STAGE_F_MASTER_PROMPT.txt.
