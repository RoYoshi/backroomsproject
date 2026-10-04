# PART 3B SPECIFICATION

# 1. Scope

Part 3B is:

**Movement, Camera & Depth Presentation**

It owns:

- render-Z smoothing,
- camera-Z follow,
- subtle elevation-dependent projection,
- relative depth scaling/parallax,
- stair/ramp visual smoothing,
- airborne/fall depth cues,
- restrained landing response,
- hand/body vertical secondary motion where safe,
- coordination between depth projection and picking,
- correction of Level 0 cutaway/roof semantics.

It does NOT own final lighting, shadows, textures, materials, entity art, gore,
atmosphere or soundscape.

# 2. Simulation remains immutable

Do not alter accepted movement physics to make visuals smoother.

The following remain exact:
- actor physical X/Y/Z,
- velocity,
- support/contact,
- stair tread/riser collision,
- ramps,
- gravity,
- fall timing,
- stamina,
- posture,
- traversal legality,
- AI/nav,
- network XYZ,
- server correction,
- aftermath.

Presentation consumes simulation state but does not feed back into it.

# 3. Camera Z follow

Introduce an explicit presentation camera elevation state distinct from physical Z.

Requirements:
- follows the local player's interpolated/authoritative presentation target Z,
- smooth in real time,
- no render-FPS-dependent gameplay behavior,
- no tread-by-tread camera snapping,
- no instant teleport when walking between adjacent stair treads,
- responds quickly enough that large falls still feel vertical,
- bounded lag so camera never becomes disorientingly detached from the player,
- reset/teleport/world-transition paths snap or safely reinitialize instead of
  sweeping through unrelated geometry.

Use a time-based critically damped spring or equivalent stable smoothing rather than
a fixed "per frame percentage".

# 4. Depth projection

Add a restrained camera-relative Z projection.

At the player's current presentation elevation:
- the local player/support should read at the normal reference scale.

For surfaces meaningfully BELOW the player:
- screen-space scale should be slightly smaller,
- their XY displacement from the camera center may contract subtly,
- the effect must increase monotonically with relative depth within a small bound.

For surfaces meaningfully ABOVE the player:
- corresponding opposite depth cue may be used conservatively.

This must stay subtle.
Do NOT turn the game into a perspective 3D camera.

Recommended initial visual envelope for one major 180-unit elevation:
- roughly 3–7% relative scale difference,
- tune by evidence and human QA,
- hard clamp presentation scale to a safe narrow range.

The exact coefficient is an implementation choice, not a simulation constant.

# 5. Fairness / visible footprint

Depth projection must NOT increase tactical awareness.

The canonical camera-policy world footprint remains the source visibility budget.

Even if a lower layer shrinks:
- do not sample/render entities or actionable geometry outside the canonical
  footprint that the flat camera would have admitted,
- do not let ultrawide/high DPR expose additional world information,
- DPR changes sharpness only,
- UI scale cannot alter awareness.

Projection may rearrange already-admitted content in screen space.
It may not admit more world.

# 6. Falling depth cue

A fall from +180 -> 0 or 0 -> -96 must visually read as descent without HUD/debug.

During descent:
- destination surfaces should approach the player's reference scale smoothly,
- upper surfaces should visually recede,
- camera elevation follows with restrained lag,
- player/hand presentation may have slight inertial lag,
- landing may have a small bounded presentation settle/compression.

No gameplay camera shake that obscures aiming.
No nausea-inducing zoom pulses.

# 7. Stair/ramp presentation

Stairs remain real finite treads physically.

Presentation should:
- avoid visible one-tread camera snapping,
- smooth player render Z across a staircase,
- preserve real horizontal position and contact timing,
- allow reversal midway,
- not interpolate through ceilings/undersides visually,
- reattach correctly when leaving stairs sideways,
- never cause the rendered actor to appear on the wrong floor.

Ramps should already be continuous; 3B should ensure camera/depth response is equally smooth.

# 8. Actor / hand secondary motion

Optional but authorized if narrowly implemented:
- small body vertical lag,
- hand follow-through,
- landing settle,
- fall lift.

Constraints:
- presentation-only,
- bounded,
- no impact on hitbox/picking/aim origin,
- no player silhouette ambiguity large enough to affect combat/fairness.

# 9. Picking / aiming

Any screen-space projection must be invertible or otherwise accounted for by picking.

Rules:
- cursor -> physical world query must correspond to what the player sees,
- final interaction target remains nearest physically visible valid target,
- cutaway does not make hidden physical targets interactable,
- same-XY different-Z targets remain distinguishable,
- no through-slab picking,
- no projection-dependent selection order.

# 10. Continuous Level 0 interior — roof/cutaway correction

Ordinary Level 0 rooms/hallways are one continuous interior.

DO NOT:
- black out a room until the player crosses its boundary,
- hide ordinary adjacent rooms simply because the local player is not inside them,
- treat every ceiling as a Surviv.io building roof.

Standard Level 0 ceiling geometry:
- remains physical for collision/AI/light/sound/etc.,
- may be presentation-ignored by the top-down camera as part of the continuous
  interior convention,
- must not act as room-entry concealment.

# 11. Local cover semantics

Introduce/clarify presentation semantics for overhead cover.

Recommended semantic categories:

- `continuousInteriorCeiling`
  - physical, but not a top-down room roof mask.

- `localCover`
  - crawlspace, hide-under slab, under-platform cover.
  - opaque/concealing for an outside viewer as appropriate.
  - locally fades/reveals for the player actually under it.

- `overlapSlab`
  - real upper floor over lower walkable space.
  - retains thickness/underside.
  - local cutaway may reveal the local player beneath it.
  - outside/upper viewers do not receive free lower-level visibility.

- `buildingRoof`
  - future distinct building roof behavior.
  - data-model support may be prepared if natural.
  - do NOT implement future levels/buildings in 3B.

Avoid giant room-wide view groups where a smaller physical cover group is sufficient.

# 12. Crawlspace target behavior

NORTH crawlspace is the key 3B local-cover validation.

Outside:
- overhead cover visually conceals the crawl interior/player as intended.

Inside:
- only the local overhead cover region fades/removes enough for the local player to
  see themselves and the crawl interior.

Nearby ordinary NORTH room/hall geometry remains visible continuously.

A second client outside keeps its own independent concealment state.

# 13. Upper LONG ROOM target behavior

At the +180 overlap:
- upper slab has real thickness,
- lower local player can receive a local cutaway of the blocking slab/group,
- unrelated LONG ROOM geometry remains visible,
- upper player retains correct upper-world view,
- no hidden peer/gear/beam/effect leakage through intact portions,
- cutaway does not modify physical rays.

# 14. Future separate buildings

Lock the rule but do not build the feature set now:

If a later level includes an exterior and a genuinely separate building:
- outside viewer may see the roof and not the interior,
- entering that building may locally fade/remove the building roof,
- this behavior is semantically different from Level 0 continuous rooms.

Do not generalize "has a ceiling" into "is a building".

# 15. Reduced detail

Reduced detail may:
- reduce subtle parallax amplitude,
- reduce secondary body motion,
- simplify nonessential interpolation effects.

It may NOT:
- expose hidden interiors,
- remove physical occlusion,
- change canonical world footprint,
- alter picking,
- alter cutaway eligibility,
- change gameplay truth.

# 16. Not Part 3B

Do NOT begin:
- Part 3C advanced lighting/shadows,
- Part 3D texture/material/environment overhaul,
- Part 3E entity/death visual redesign,
- Part 3F atmosphere/audio overhaul,
- Part 3G final visual optimization certification,
- multi-level runtime/seamless transition architecture,
- future building content.

Do not redesign player anatomy.
The player remains the accepted simple rounded body + two circular hands.
