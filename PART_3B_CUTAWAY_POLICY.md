# Part 3B cutaway policy

Level 0 is one continuous interior. Ordinary ceilings and the upper LONG ROOM ceiling are physical simulation geometry; the top-down camera omits their camera faces everywhere, independent of room entry, quality, local cutaway enablement and player location. They remain in the complete physical occluder set for eye, light, IR, collision and acoustic queries.

The accepted production definition is not modified. Its existing authored group identities are interpreted into a private immutable view model:

| Presentation category | Production structures | Camera behavior |
|---|---|---|
| `continuousInteriorCeiling` | Ordinary Level 0 ceiling groups; upper LONG ROOM ceiling | Always omitted from camera drawing and camera obstruction/picking. Physical rays retain them. |
| `localCover` | NORTH crawl roof; existing hide-under props and lintels | Opaque for outside viewers. A local body must physically overlap the cover footprint and fit below its actual underside before local reveal is eligible. |
| `overlapSlab` | LONG ROOM upper slab and its edge walls; ramp; individual stair treads | Only the local blocking structural group may fade. Upper/on-surface viewers retain their upper view. Each tread has independent presentation eligibility. |
| Future `buildingRoof` | No current content | Reserved distinction only. No separate buildings, future levels or multi-level runtime are implemented. |

Eligible local cover still has to obstruct a projected sample of the local body before it fades. The camera probe includes feet, middle and head, with lateral extent, and follows the actual bounded projection. Entry fade is 150 ms; exit fade is 250 ms. Screen-door fading retains camera depth and the unchanged per-fragment physical eye/light mask.

The LONG ROOM slab/edge group is six local physical pieces over the upper branch, not the whole room. Unrelated walls, floors and ordinary-room geometry remain. The NORTH cover is one roof over the physical 288 × 96 crawl passage. Ordinary NORTH room ceilings are not concealment groups.

Every client owns its own `LocalView` and elevation springs. No fade, camera elevation or reveal flag is sent to the server or written into the physical world definition. Turning cutaway off disables local reveals but does not reinstate ordinary room-entry roofs.

Picking omits continuous ceilings only as camera surfaces. A hidden physical actor still fails the full eye-ray test; an outside camera also retains opaque local-cover/slab obstruction. Fully faded geometry continues to block physical interaction rays. Physical ceiling, light/LOS, acoustic, collision and support truth remain unchanged.

Evidence: `dev/part3b/evidence/p3b3`. Human judgment of readability remains pending.
