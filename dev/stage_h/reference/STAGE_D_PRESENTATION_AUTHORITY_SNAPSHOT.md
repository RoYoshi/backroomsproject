# STAGE D PRESENTATION AUTHORITY SNAPSHOT

This snapshot exists so Stage H keeps the proven Stage D presentation laws while
broadening them into production.

## Proven laws

1. **Cutaway is local presentation state, not deletion.**
2. Only `cutawayEligible` groups may fade.
3. Physical occluders remain active regardless of fade, culling or quality.
4. Physical LOS is evaluated from actual geometry at draw time.
5. Physically hidden actor/annotation fragments are rejected.
6. Opaque non-cutaway geometry remains camera-blocking; do not make it transparent
   merely because it is inconvenient.
7. Two local views may share the same physical world but have independent view state.
8. Renderer output never feeds AI/server sensing.
9. Reduced quality cannot remove physical correctness.
10. The original rounded-body/two-hand procedural art remains the presentation baseline.
11. Stage D's prototype picking was not production picking.
12. Stage D deliberately did NOT broadly integrate gameplay lighting, aftermath,
    UI overlays or traversal.

## Known Stage D evidence limitations

- SwiftShader/software GPU missed the 16.7 ms reference target.
- hardware-reference performance was not certified.
- prototype capacity was intentionally bounded.
- static scenes were not gameplay traversal.
- flat Level 0 remained on the old production renderer.

Stage H should preserve the laws, not the prototype's artificial isolation.
