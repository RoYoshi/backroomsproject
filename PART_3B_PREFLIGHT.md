# Part 3B parent and presentation preflight

P3B0 starts from accepted Part 3A commit `4d1f17a600a10599b848b6db9d02fa16b4f479f0`, tree `c1e0fc5fd84e5fbea412cf3fca7c309243e8de6e`. The supplied immutable archive SHA-256 is `6a498a2e498328ebe8064f1a67b406e5d600e614137438df67a79409bf64bdcf` (108224116 bytes). All 3453 source blobs, file modes and local bytes match that tree/archive. Remote `part-3b` was absent; the isolated worktree is branched from that exact commit. No main checkout or ref is changed.

## Presentation inventory

- `camera_policy.js`: immutable canonical 1536 × 864 maximum world footprint; max-axis fitting; DPR is not an input. This policy is retained byte for byte.
- `world_view.js`: pure projection/inverse, camera ray, physical ray masking, cylinder picking, immutable compiled view model, local cutaway groups, WebGL2 geometry and actor pass. Existing projection is fixed oblique Z at 0.5. Physical receiver coordinates and all occluders feed eye/light masks.
- `spatial_client.js`: production presentation adapter; currently camera Z equals physical Z each submitted frame. Eye, sound, light and aim origin come from physical state. Local player, remote histories, aftermath and effects enter presentation packets.
- `world_geometry.js`, `world_motion.js`, `spatial_protocol.js`, `spatial_history.js`, `server.js`, simulation/AI/death sources and bundles: locked physical/network authority. No physics retuning is authorized.
- Production JSON and its maintained generator: accepted physical content. Presentation semantics can be derived into the renderer's private cloned model without modifying the immutable definition or content hash.

## Locked correction

Ordinary Level 0 ceilings are continuous-interior physical geometry, not room-entry roof masks. They must be ignored only by the top-down camera, including camera picking obstruction, while remaining in physical collision/LOS/light/sound queries. NORTH crawl cover and LONG ROOM upper slab remain localized cover, independently revealed only for an eligible local viewer. Future separate buildings are not implemented.

## Planned isolation and proof

Presentation state belongs to each adapter/view, with time-based camera/render elevation, bounded depth projection and matching screen inversion. Projection retains physical coordinates for all visibility, light, support, collision and interaction checks. The original footprint admits content before projection and clips physical fragments afterward. Renderer changes will be gated to spatial production so retained fixture/flat controls remain available.

`dev/part3b/evidence/p3b0/runtime-freeze.json` freezes runtime inputs. The complete parent blob/mode ledger is beside it. Focused preflight runs retain the camera-policy, production physical stair/ramp/fall and picking gates. P3B0 contains no runtime change. Later checkpoints must preserve raw failures before repair and verify each remote commit/tree before continuing.
