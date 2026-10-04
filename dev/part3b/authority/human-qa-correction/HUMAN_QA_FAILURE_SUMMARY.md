# HUMAN QA FAILURE SUMMARY

## User-approved intent

The camera should stay top-down.

The user wants:
- 2.5D readability,
- visible depth,
- better falling/stair feel,
- some 3D wall readability,
without the game looking angled/isometric.

## User complaint distilled

Current problem:
- the scene looks like it is at an angle,
- that destroys the intended top-down feel,
- top/bottom walls become wedge/trapezoid-like,
- global projection feels like a camera tilt.

User clarification:
- left-to-right walls currently read more acceptably because they suggest depth
  without fully destroying top-down framing,
- the same kind of readable 3D treatment is wanted on top/down walls,
- but NOT by slanting or warping the whole world.

## Acceptance replacement

The follow-up should pass only if:

- ordinary Level 0 rooms still look top-down,
- top walls and bottom walls gain readable volume/depth,
- left/right wall readability is preserved or improved,
- the player can feel verticality without perceiving a tilted camera,
- fall/stair cues remain,
- fairness/picking/truth are still intact.

## Rejection test

FAIL if any common scene makes the player say:
- "the camera looks tilted"
- "it looks isometric"
- "the world is slanted"
- "the room turned into a trapezoid"

## Human reference screenshot

See:
`supporting_docs/human_qa_projection_failure_example.jpg`
