# STAGE H HUMAN QA PREP

Stage H is the most presentation-heavy 2.5D stage. Human QA is essential.

## Production spatial gameplay

Use the real production client in the Stage H spatial QA world/path.

Check:
- stairs/ramp/drop/fall visually track the physical motion naturally
- same XY on different floors is visually understandable
- no snapping between floors/supports
- player, Hounds, Smilers and corpses depth-sort correctly
- cutaway helps readability without feeling like walls/floors physically vanish
- entering/exiting under an upper floor does not flicker or rapidly toggle cutaway

## Two-client test

Put two clients above/below or on opposite sides of the same stacked location.

Check:
- each client gets the correct local cutaway
- one client's camera/cutaway/NV/quality changes do not affect the other
- no hidden entity/effect becomes visible because of the other client's view

## Leak hunt

Deliberately hide entities/corpses/effects behind slabs/walls.

Look for leaks from:
- eyes/smiles
- blood/gore
- hands
- corpse replay
- loose light/hat/gear
- beams
- labels/debug overlays

Any visible fragment that reveals a physically hidden actor is a FAIL.

## Lighting / IR

Test:
- flashlight
- headlamp
- lantern
- lights across a stairwell/opening
- light behind an intact slab
- camcorder/NV
- detached light from a corpse

Visual light should obey the real geometry. IR presentation must not change monster
behavior.

## Aim / interaction

At stacked/same-screen locations:
- aim at upper and lower visible surfaces/actors
- verify the visible nearest valid surface/actor is selected
- verify cutaway does not let you interact through a slab
- verify hidden entities are never auto-selected

## Camera fairness

Compare:
- 16:9
- ultrawide
- high DPI
- full/reduced quality
- supported UI scales
- NV/zoom

No configuration should grant extra gameplay awareness.

## Flat Level 0

Play normal Level 0.

It should still feel like the accepted G build:
- movement
- camera
- Hound/Smiler behavior
- death feel
- lighting/equipment
- multiplayer

Stage H QA should NOT demand Stage I final scale/performance certification.

Record browser/GPU, viewport/DPR, quality, number of clients and exact reproduction
steps for any visual discrepancy.
