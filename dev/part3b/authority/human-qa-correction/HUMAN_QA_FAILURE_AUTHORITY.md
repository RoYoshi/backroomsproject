# HUMAN QA FAILURE AUTHORITY — PART 3B FOLLOW-UP

## Verified current Part 3B source

Repository:
`RoYoshi/backroomsproject`

Branch:
`part-3b`

Current verified source checkpoint:
`6ec76c6ca9b289c108ab933c71af196dd5c522cd`

Current verified source tree:
`05a8e8926ed30012d3158e7ef0f5b6f546bc06a1`

Commit message:
`Part 3B P3B5 complete: verified portable source, final regressions and human QA handoff`

The engineering/publication artifacts are complete, but the user has explicitly rejected
the current presentation result.

## Human QA decision

**Part 3B is NOT approved.**

Status:

`PART 3B — HUMAN QA FAIL / NEEDS FOLLOW-UP`

Do not begin Part 3C.

## What is kept

The following 3B work is still considered valuable and should be preserved unless a
demonstrated reason requires a narrow change:

- critically damped camera-Z follow
- stair/ramp/fall presentation smoothing foundations
- continuous Level 0 room visibility correction
- NORTH crawl local-cover concealment semantics
- LONG ROOM overlap local cutaway semantics
- projection-aware picking correctness
- client-local presentation independence
- fairness/canonical-footprint protections
- general package/test/report scaffolding

This is NOT authorization to throw 3B away and rebuild it from scratch.

## What failed

The user rejected the current depth projection because it makes the game read like
the camera is tilted/isometric.

The failure mode is especially visible in the screenshot included in:
`supporting_docs/human_qa_projection_failure_example.jpg`

The user's clarification:

- the current left-to-right wall depth read is closer to the desired feel,
- top and bottom walls should gain comparable 3D/readable depth treatment,
- but the overall camera must remain top-down,
- the world must not look globally slanted or perspective-warped,
- ordinary rectangles/rooms must not turn into trapezoids.

## Non-negotiable visual lock

The corrected 3B presentation must satisfy:

1. Camera remains unmistakably top-down / orthographic in feel.
2. No apparent global camera tilt or isometric slant.
3. Straight world walls remain visually straight/parallel on screen.
4. Rectangular rooms keep reading like top-down rectangles.
5. The sense of verticality must remain readable.
6. Left/right wall volumetric readability should be preserved if possible.
7. Top/bottom walls need analogous readable depth treatment.
8. Any depth cue must not break fairness, picking, or physical truth.

## Likely design direction (not mandatory implementation)

The rejected behavior came from global layer scaling / warping being too strong in a
way that distorted the whole scene.

The replacement should favor:
- top-down orthographic preservation,
- local wall-face / thickness / underside readability,
- restrained camera/parallax/fall cues,
- local vertical separation cues,
over global scene warping.

This is guidance, not an obligation to use a specific math formula.

## Scope boundary

Do NOT:
- restart Part 3B from Part 3A,
- redo unrelated milestones,
- modify or merge `main`,
- begin Part 3C,
- begin Part 3D+,
- begin Multi-Level Runtime,
- retune physics/AI/network/death systems,
- alter acceptance thresholds to force approval.

Final required status after correction remains:

`PART 3B — MOVEMENT, CAMERA & DEPTH PRESENTATION ENGINEERING COMPLETE — HUMAN QA PENDING`
