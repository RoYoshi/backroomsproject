# N3 - fixture / blocker separation + line-of-sight stability (evidence notes)

## What was actually wrong (found on the parent)

1. **All nine PILLAR HALL fixtures sat exactly on the nine pillars.**  The ceiling fixtures are laid on a 5-cell grid per
   room and kept wherever their *cell* is floor (`kc`).  The hall's pillars are not cells: they are nine separate 56 x 56
   blockers (`Pc`), so the grid test never saw them.  Fixture *n* = 79, 84, 89 and the pillar centres 79.5, 84.5, 89.5
   cells coincide: every housing (90 x 28) was drawn over its pillar and every light origin was inside it.  The bundle's
   ray (`Uc`) only counts a box it *enters* (`l >= 0`), so a ray leaving a pillar from inside ignores it: those nine
   lamps lit *through* their own pillar for the legacy light shapes, for `light.js`, for the server AI's lamp field and
   for BR-RoLE's tube points (half of them inside the blocker).
2. **The line-of-sight polygon did not know the pillars' corners.**  `Hl()` casts 96 evenly spaced rays plus three
   rays at every corner of the wall *grid* (`Vl`); the free-standing pillars' corners were never in `Vl`.  Their
   silhouettes were therefore drawn by rays 3.75 degrees apart: the shadow edge was a chord between two rays - up to
   ~28 px off the true silhouette (mean ~15 px over the loop), sliding by up to ~25 px from one step to the next (the
   wedge jitter) - a false wedge of shadow over floor that is really in view, and, where the chord cuts the other way,
   a sliver behind the pillar inside the polygon (`pillar_parent.log`, P2).  The same polygon clips the darkness overlay (scenePoints) and masks creatures
   (sightPoints).

## Fix

- `world.js` `WORLD.fixLamps(Fc, Pc, kc, FBW, FBH)`: a fixture whose housing is not wholly on floor cells, off every
  pillar and off every other housing moves to the nearest grid cell centre where it is (rings of 1, then 2 cells; fixed
  order +x, -x, +y, -y, diagonals), else is removed.  Called right where the list is made, in the bundle and in
  `sim.js` (`dev/sim_head.js`, `dev/sim_geo.js`): one pure function of the static map on every machine.  Result on the
  real map: the 9 PILLAR HALL fixtures move one cell east (+96 px; 23 px clear of the pillar face), none removed, the
  other 81 untouched.  The pillars are not moved or shrunk.
- Bundle, one line: the pillars' corners are added to `Vl`, so `Hl()` casts its critical rays at them exactly as it
  does at wall corners.  LOS is made exact, not weaker.

## Evidence

- `pillar_after.log` 5/5: no housing on a blocker (client and server lists identical); full loop (radius 160, 1.5 deg
  steps): zero reveals, zero over-hides, silhouette error max 0.5 px (parent 28.5 px); no hidden sample shows through
  the overlay; held poses (clock frozen, lamp fields built) do not change frame to frame; the fixtures never move and
  none is inside a pillar.  `pillar_parent.log`: P1, P2, P5 fail.
- `test_3bn.js` N3 6/6; Stage 3B unit 26/26; BR-RoLE unit 32/32; legacy shadows unit 47/48 (S16 fails identically on
  the parent: a stale whitelist string); C15 "no popping along a pillar orbit / through the pillar hall" passes.
- Measurement notes: hidden points are scored only when they are hidden across their whole margin (10 px at the pillar,
  sampled every 3 px), and not within 6 px of a wall face (the game deliberately shows the lit 24 px strip of a visible
  wall face; its anti-aliased edge is not hidden world).  46 of 240 loop steps are skipped where a body does not fit.
