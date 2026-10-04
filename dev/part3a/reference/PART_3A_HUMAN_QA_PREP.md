# PART 3A HUMAN QA PREP

3A human QA is about whether the REAL Level 0 spatial conversion is understandable
and still feels like The Far Backrooms.

It is NOT the final Part 3 beauty pass.

## Familiarity
- Spawn area still feels recognizably like Level 0.
- All twelve room regions still make sense.
- Core objective still feels like the same game.
- Base-floor circulation does not feel randomly destroyed by vertical additions.

## Elevation readability
Without debug text:
- stairs obviously go up/down
- ramp slope is understandable
- upper platforms look physically above lower space
- lower depression looks physically below
- floor/slab thickness is readable
- same-XY upper/lower players do not look like they occupy one plane

## Cutaway
- overhead geometry fades only when needed
- geometry does not flicker at boundaries
- cutaway never feels like the floor physically disappeared
- hidden entities/effects do not leak

## Vertical gameplay
- walk the stairs both directions
- reverse/leave stairs midway
- use the ramp
- enter/leave lower area
- crawl through the low passage
- fall/drop where intended
- confirm no accidental trap

3A does NOT need final smooth stair animation. If physical stair motion looks
mechanically stepped but correct, record it for 3B rather than "fixing" physics.

## AI
- Hounds can meaningfully pursue through legal vertical routes
- Smilers do not gain impossible traversal
- entities do not spawn directly beside you unfairly
- upper/lower entities do not see/touch through intact slabs

## Objective
- cartograph does not appear in the exact same permanent spot every run
- glitched exits remain findable/reachable
- basic Level 0 escape loop still works

## Multiplayer / death
- two clients at same XY different Z read correctly
- reconnect is coherent
- death on an upper/lower route settles correctly
- loose gear can land separately

## Performance
Record:
- browser/GPU
- viewport/DPR
- full/reduced detail
- obvious stalls
- geometry disappearing or popping incorrectly

## Decision
Part 3A decision:
PASS / FAIL / NEEDS FOLLOW-UP

Do not judge final textures, shadows, atmosphere or stair smoothing here.
Those are later Part 3 stages.
