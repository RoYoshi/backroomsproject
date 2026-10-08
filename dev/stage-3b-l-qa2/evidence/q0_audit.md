# Stage 3B-L QA2 — Q0 audit: the seams, recorded before any behaviour changed

Parent: `stage-3b-l-qa1` = `d3ec2269af873dbc381d223ad538a43ba06f5c45`, tree `cffbc3125619170d9a55344b2519042a720a798d`. Both were verified on the remote (`git ls-remote`, GitHub REST) before work began. `stage-3b-l-qa2` did not exist on the remote; it was created locally from exactly that commit. Camera checkpoint `b2783b3` is in its ancestry.

The superseded pillar-LOS correction (`stage-3b-pillar-los`, `ecec802`) is left as it is. It was not merged or revived. The one idea of its that QA2 needs (rays at a pillar's outline corners) is re-derived inside QA2's own change to `Hl`.

## Issue 1: wall-corner receiver oddity

**Reproduced in the engine**:
- close-ups `k1`–`k8` (convex and inner wall corners, a pillar corner);
- flashlight sweeps in the BLACKOUT ZONE;
- lamp-lit corners in YELLOW HALL.

Every picture is drawn by the parent at a frozen instant. The user's photos show the same thing: a face band thinning to a sliver along a wall, plus a bright block at its end.

Three separate causes, all of them presentation:

1. **Blocker padding in the darkness clip (the line of sight's `Hl(x, y, 700, 24)`, in the bundle).**
   - The clip went 24 px past every ray's hit *along the ray*. Seen square-on, that shows 24 px of a wall's face.
   - Seen at a slant it shows only 24 × sin(angle). So a face thinned to a **wedge** toward its far end, and two faces met at a corner in a **notch**.
   - Near a corner, the same 24 px ran on into the face around the corner (turned away from the player) and past it onto floor the player cannot see. That is **light from around the corner**.
   - Measured over 168 poses (node, the game's own code):
     - the parent's clip held 25 873 samples of floor hidden from the player;
     - a seen face's 24 px band was covered only 64 % of the time;
     - within 30 px of a face's end, only 73 %.
   - Measured along side faces seen at grazing angles: 17 %.
2. **Face ownership at corner endpoints (BR-RoLE `buildBands`, QA1).**
   - The receiver bands were rectangles. At a convex corner the side face's band stopped short, and the whole corner square belonged to the front or back face.
   - The remaster's art draws the two faces **mitred**: the square is split on its diagonal.
   - So a side lit differently from the front showed a block of the other face's light at its end, cut on a horizontal line, not on the art's joint.
   - At an inner corner, neither band reached into the corner block. The corner block stayed dark: a **notch** at every lit inner corner (measured: block ÷ bands = 0.00).
3. **Receiver-face segmentation.**
   - A carried light's face light was laid in 32 px pieces, each at one facing value (base + k·cos).
   - A light close to a wall turns fast along it, so the steps showed.

Not causes:
- the shadow system itself;
- the overlay's composition order;
- anti-aliasing / mask blending;
- the lamps' brightness.

Nothing here touches light truth. `Uc`, the server, `light.js` and the AI do not read the clip or the receivers.

## Issue 2: night-vision camcorder, the infrared path

How the parent draws and reads infrared:
- `camcorder.js` `irDraw(mk, src)` / `peerIR` → `drawFan`. These are six stacked fans from the bundle's `mk` (rays to `Uc − 1` px, a radial gradient each), with arcs stepping from `arc` to `core` and ranges from 0.82 to 1 × range, plus a 70 px disc at the lens.
  - They are drawn into the darkness overlay after BR-RoLE, inside the line-of-sight clip.
  - The result is a **stepped cone with a rim** at each fan's range.
  - Walls and pillars get **no infrared on their faces**: the fans stop 1 px short of every wall.
  - It is not a BR-RoLE light. It has no penumbra from the lens and no props' shadows.
- `irFrom` (the sensor's reading: an entity's readability, `nvRead`; and `light.js` `o.ir` through `irAt`) uses a different profile:
  - a hard **step from 1 to 0.45 at the core's edge**;
  - a straight ramp to 0 over the last 30 % of the range.
- BR-RoLE:
  - excludes the camcorder from the visible carried lights (it is `nv`), its own and other players';
  - scales the lamps by `__cam.lampGain()` (sensor gain 1.45) while night vision is on.
- The gameplay boundary (unchanged by QA2; `dev/tests/s_ir.js` I1–I3, `ir_net.js` N1–N4):
  - `server.js` keeps the infrared level on the connection (`me.ir`), never on the player the simulation sees, and relays it to the other clients for their pictures;
  - `sim.js` and `ai.js` never name it.

## Performance baselines

These are the parent's. The measurements are in the QA2 performance note:
- `Hl` costs about 0.15 ms per frame for both polygons (Chromium, this machine);
- BR-RoLE's frame and the page frame are measured per scene, NV off and NV on.
