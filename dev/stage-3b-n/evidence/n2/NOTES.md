# N2 - true darkness + danger flicker (evidence notes)

Root causes found on the parent (`visibility_parent.log`, 1/6):
- **Sourceless glow.** BR-RoLE drew v23.3.6's ambient gradient around the viewer every frame (alpha .14 at you, 0 at
  670 px), unblocked by walls: light with no source.  Blackout with no carried light: overlay min alpha 219, not 255.
- **Danger flicker = x-ray.** `mp.js` set the whole darkness overlay's CSS opacity to .35-.75 on flicker frames: everything
  behind walls and pillars showed through (test object 163/255 in screenshots).
- **Danger shake slid the world under the mask.** Only `#game` was translated, the overlay was not: slivers of hidden world
  at every LOS edge on every shaken frame.

Fixes: the ambient gradient is gone (no replacement floor); the flicker is now a surge of the ceiling lamps
(`window.__dangerFlicker`, multiplied into `__ents.lamp`, so BR-RoLE's lamp strength and `light.js` follow it, still capped
at .9 and still shadowed); the shake moves `#game` and `#light` together.  After: 6/6, zero exposed frames over 135 frames
x 25 hidden points behind a wall and behind a pillar (45 forced flicker frames each), and an in-sight dim point 230 px from
a lamp gets brighter during the surge (F3).  F3 on the parent is not applicable (its flicker has no lamp surge).

Cost (`perf_br_desktop_summary.txt`, SwiftShader, relative only): BR-RoLE's own time per frame is lower in every scene
(the 1340 x 1340 gradient fill per frame is gone); the surge is one multiply per lamp.

Known limits, unchanged on purpose (outside N2's seam):
- The bundle's legacy lighting fallback (BR-RoLE off / failed, `?lighting=legacy`) still draws v23.3.6's glow; it is not
  the shipped path.
- `light.js` keeps its `AMBIENT = .05` *data* floor (used for body shading and the Smiler's readability values).  It never
  produces pixels: the overlay above is opaque wherever no light is cut out of it (D1: 255 everywhere, screenshot 0).
- The dread trigger (distance to the nearest Hound / Smiler) is existing design shared with the heartbeat and vignette;
  it now only drives lamp illumination and a shake of the whole view.
