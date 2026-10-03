# STAGE H IMPLEMENTATION SEAMS

This file summarizes the locked presentation boundaries and known existing seams.
It does not authorize a renderer/framework rewrite.

## `world_view.js` — presentation truth boundary

Locked responsibility:
- client projection
- spatial draw packets
- depth/visibility passes
- local cutaway state
- picking
- masks

Explicitly NOT owned by this module:
- authority
- navigation
- AI sensor decisions
- world mutation

Stage H should evolve this from Stage D feasibility into production integration,
not replace it with a competing spatial renderer.

## Existing production presentation stack

The accepted architecture identifies:
- Pixi application bundle
- procedural `ents.js`
- Canvas overlays
- `light.js`
- `camcorder.js`
- `gore.js`
- `mp.js`

Keep the application renderer and the existing procedural art.

Do not migrate to Three.js, Phaser, an ECS renderer, a general 3D engine, or a
second parallel client application.

## Stage D prototype lessons to preserve

Stage D already proved:
- actual XYZ projection/depth is possible
- client-local `LocalView` cutaway state is independent
- only declared `cutawayEligible` groups may fade
- physical occluders remain authoritative regardless of view fade/quality
- physically hidden actor/annotation fragments are rejected
- hidden opaque static geometry still blocks the camera unless it is an explicitly
  eligible local cutaway
- CPU geometry/ray reference can cross-check browser visibility
- two views can share the same frozen state with independent local cutaway
- rendering must not feed AI/server sensing

Stage D was NOT production integration:
- static actor placements only
- no real traversal controller
- no full gameplay light/IR
- no broad Canvas overlay migration
- prototype picking only
- no Stage G aftermath integration

Do not mistake Stage D's static page as the Stage H result.

## Render-context ownership

Stage D isolated its spatial pass from arbitrary unsynchronized Pixi GL state.

In H, either:
1. preserve an explicit owned pass/composition boundary, or
2. deliberately synchronize renderer state before/after the spatial pass.

Do not interleave raw GL/Pixi operations while relying on stale renderer caches.

Explicitly control:
- framebuffer
- depth
- blend
- stencil/scissor as applicable
- texture/sampler bindings
- pixel-store state
- viewport/target state

## Production actors/effects

Spatial worlds must consume Stage F/G identities and interpolation:

- world epoch
- entity/life/death generations
- pose tick/sequence
- authoritative/interpolated XYZ
- support/motion mode
- traversal progress/discontinuity
- corpse/object revisions

Do not reconstruct a floor from XY in presentation code.

Flat Level 0 keeps the accepted flat path.

## Cutaway

Cutaway is a LOCAL visual interpretation.

It does not delete geometry.

The renderer may visually fade eligible roof/wall/slab groups for readability.
The physical world remains unchanged for:
- collision
- AI LOS/gaze
- visible/IR ray truth
- sound propagation
- navigation
- contact
- authority

A client may have different cutaway from another client at the same time.

## Depth / masks / overlays

One of the main Stage H risks is hidden-state leakage from a secondary layer.

Any Pixi/Canvas/DOM world-space element capable of revealing actor/effect position
must either:
- be rendered inside the spatial composition, or
- be masked by the exact physical visibility result before composition.

Never let:
- eyes
- smiles
- corpse hands
- gore
- replay sprites
- gear
- light beams
- labels

bypass the physical visibility decision.

## Picking / aim

Locked rule:

Screen XY is ambiguous.

Spatial picking must include depth/surface selection.

Intersect the camera/picking ray with visible physical candidate faces and actor
proxies. Choose the nearest physically visible valid hit.

If there is no hit, use a defined aim plane through the player's eye rather than
selecting an arbitrary upper/lower support.

Never let cutaway visibility grant a physical interaction through geometry.

## Camera fairness

Preserve the accepted camera policy:
- resolution does not expand gameplay awareness
- DPR changes sharpness only
- ultrawide does not gain extra tactical footprint
- quality mode cannot change awareness

All browser/view tests need to separate:
- world/simulation trace
- presentation trace
- final pixels

A pixel change is not automatically a simulation change.

## Light / IR

Stage E owns AI light truth.

Stage H owns player-facing integration.

Visible and IR presentation use the same physical geometry but remain separate
channels.

Camcorder IR must not become monster-visible evidence.

Do not use cutaway geometry state as light occlusion authority.

## Stage G aftermath

Stage G already owns spatial corpse/hands/gear physics and replication.

H renders that state.

Do not:
- rerun death physics in rendering
- invent new corpse supports
- snap gear to corpse floor
- create a second client-authoritative death outcome

## `view25d`

The historical `dev/tests/view25d.js` future entry point must become a real Stage H
acceptance owner.

Its real implementation should orchestrate browser evidence for at least:
- Z29
- Z30

and may coordinate the H visual portion of Z14.

Do not make it a green wrapper around static assertions.

## Scope traps

Not Stage H:
- rewriting AI
- redesigning physics
- Stage G performance fixes by weakening correctness
- new Backrooms level content
- menu/branding overhaul
- final 100-player/multi-room capacity certification
- broad art redesign

Those are separate decisions or Stage I work.
