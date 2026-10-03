# STAGE H ACCEPTANCE MATRIX

Stage H is **Complete Presentation Integration**.

The accepted source already contains the historical `dev/tests/view25d.js` future
entry point. Stage H must activate it as a REAL browser/multi-client acceptance
suite. It must not be deleted, unconditional-passed, or replaced with a static
fixture-only fake.

## Z14 — H completion: visible lamp / flashlight / IR across stories

Stage E already proved the AI/sensor side.

Stage H must prove the PLAYER-FACING presentation side:

- actual visible-light emitters use real XYZ/equipment anchors
- physical slabs/openings occlude presented visible light consistently with the
  shared geometry
- receiver/effect height matters
- flashlight/headlamp/lantern direction originates from the real spatial pose
- camcorder/NV IR presentation uses its own channel and physical occlusion
- IR OFF/HIGH does NOT alter Hound/Smiler decisions under equal legitimate evidence
- no cutaway fade creates a light path through material that still physically exists
- turning a visible light OFF produces no fake aura/evidence
- detached Stage G light state renders from its real XYZ/orientation
- visible/IR presentation cannot mutate AI/server light truth

## Z29 — independent clients above/below the same XY

Use at least two real production clients connected to the same authoritative
spatial world/snapshot.

Required:
- same authoritative world hash/epoch/state on both clients
- different local focus/camera produces independent cutaway only
- one client's cutaway/camera/quality/NV state cannot change the other's
- only `cutawayEligible` groups may fade/remove locally
- cutaway changes presentation only; collision, AI LOS, visible/IR physics,
  sound, navigation and server state remain unchanged
- physically hidden actor/effect fragments remain masked
- faded geometry does not expose unrelated floors or effects
- stairs/ramps/falls/traversal remain visually continuous
- live player, Hound, Smiler, corpse, hands, gear and decals keep correct depth
  against stacked geometry
- same physical state renders consistently independent of client-local view state

## Z30 — high resolution / ultrawide / NV / zoom / overlays

Required view matrix includes representative:
- 16:9
- 16:10
- ultrawide
- high-DPR
- multiple supported UI scales
- full/reduced presentation quality
- normal light
- NV/camcorder states
- any existing zoom/aim presentation states

Required:
- canonical gameplay awareness footprint remains unchanged by resolution/aspect/DPR
- ultrawide follows the locked camera fairness policy; no extra world awareness
- DPR changes sharpness/UI fidelity, not simulation awareness
- reduced quality cannot drop physical occluders or reveal hidden state
- no hidden entity/body/eyes/hands/gear/blood/decal/replay/light leaks from a
  separate Canvas/Pixi/DOM path
- world-space labels/debug/admin overlays obey the same visibility/depth/mask policy
  when enabled
- screen-space HUD may remain screen-space but cannot expose physically hidden world truth
- camera cutaway cannot be used as interaction/aim authority

## Production spatial rendering gate

Stage H must integrate the existing spatial pass into the REAL production client
path for spatial worlds.

Do NOT replace the renderer.

The real production path must render from the authoritative/interpolated XYZ state:
- player body + two hands
- peers
- Hounds
- Smilers
- Stage G corpses/hands
- loose light/hat/equipment
- blood/decal/trail records
- lamps and player equipment light
- existing relevant effects/replays

Use the real procedural art already shipped. No arms/legs/new anatomy.

Flat Level 0 remains on its retained compatible path and must look/play as accepted.

Stage H does NOT need to invent a new stacked Level 0 layout. Use an authorized
spatial fixture/world configuration for real production-client integration.

## Cutaway / physical truth gate

Preserve:
`SIMULATION TRUTH != LOCAL RENDER INTERPRETATION`

Only declared `cutawayEligible` view groups may fade.

Cutaway is client-local presentation state:
- no server message required to decide local fade
- no collision change
- no AI/sensor change
- no light/sound/navigation change
- no other-client view change

Physical LOS/visibility is evaluated from the true geometry, not from whether a
surface is visually faded.

Do not make arbitrary opaque geometry transparent merely because it obstructs the
camera. Non-eligible hidden opaque geometry must still block/reject hidden content.

Preserve bounded fade hysteresis/transition behavior unless objective production
integration evidence requires a minimal documented adjustment.

## Production picking / aim gate

Screen XY alone is ambiguous in stacked space.

For spatial worlds:
- intersect the camera/picking ray with visible candidate faces/actor proxies
- choose the nearest physically visible valid hit
- if no valid hit exists, intersect a defined aim plane through the player's eye
- derive world aim/light direction from that real point
- consume gameplay aim/input at fixed ticks
- never auto-select a hidden entity
- never use a different floor merely because it shares screen/XY coordinates
- never use screen-space distance as physical interaction range
- cutaway state cannot grant an interaction through an intact slab
- flat adapter retains accepted flat aim behavior

## Effects and overlay leak gate

Every world-space effect that could reveal hidden state must participate in the
same physical visibility/depth policy or be explicitly masked before composition.

Audit at minimum:
- entity eyes/faces
- corpse/body/hands
- blood/gore/decals/trails
- death replay/effects
- loose gear/light/hat
- flashlight/headlamp/lantern visuals
- camcorder/NV world overlays
- world-space labels/annotations/debug markers
- multiplayer peer presentation

A physically hidden entity cannot be revealed because one sub-layer bypassed the
spatial mask.

## Presentation audio gate

Do not redesign AI hearing.

Existing physical sound events already carry world identity/elevation. Presentation
audio may spatialize/attenuate those events from their real XYZ/material/portal
context where the locked architecture already supplies it, but:
- it cannot change the AI event/evidence
- it cannot draw new RNG that changes simulation
- it cannot reveal a precise hidden floor when the game intentionally preserves
  vertical uncertainty

Do not turn H into a new audio-system redesign.

## Real browser evidence

Node/VM/static screenshots alone are insufficient for H.

Use actual browser execution over actual HTTP with:
- real WebGL/Pixi context
- real production page/client
- multiple clients for Z29
- deterministic controlled fixtures for objective pixel/state comparison
- screenshots and machine-readable traces
- hardware/GPU identification
- SwiftShader/software runs allowed for reproducibility but clearly labeled

Human gameplay QA remains separate.

## Flat compatibility / regression

Preserve:
- fixed 60 Hz gameplay
- camera fairness
- Stage E AI/evidence
- Stage F authority/networking
- Stage G aftermath
- frozen traces
- flat Level 0 presentation/controls
- all accepted movement and death feel
- visible-light vs IR AI separation

Do not regenerate frozen references to hide drift.

## Performance / quality

Measure production presentation cost at representative viewports/DPRs and full/
reduced quality.

Quality reduction may reduce:
- render resolution
- optional visual detail
- non-authoritative cosmetic work

It may NOT:
- drop physical occluders
- alter visibility truth
- increase/decrease gameplay awareness
- alter simulation/networking
- skip hidden-state masking

Record CPU/GPU/frame timing and memory where practical.

Stage H does NOT claim Stage I final population/hardware/release capacity.

## Stop gate

Stage H is complete only when:
- H portion of Z14 PASS
- Z29 PASS
- Z30 PASS
- real `view25d` browser suite PASS
- production spatial world path is actually live/playable in the real client
- flat Level 0 remains accepted
- no new unexplained regression exists
- final H package/report/browser evidence is externally recoverable

Then STOP.

Do not begin Stage I.
