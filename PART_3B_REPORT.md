# Part 3B — Movement, Camera & Depth Presentation

P3B5 PORTABLE GATES PASS — FINAL PUBLICATION PENDING

Accepted Part 3A parent: `4d1f17a600a10599b848b6db9d02fa16b4f479f0`. Tree: `c1e0fc5fd84e5fbea412cf3fca7c309243e8de6e`. Immutable ZIP SHA-256: `6a498a2e498328ebe8064f1a67b406e5d600e614137438df67a79409bf64bdcf`.

Final source identity is recorded in the accompanying external publication receipt.

P3B0–P3B2 were retained. P3B3 was recovered from `82f501e24c2757e6cdcf4046f36916e5e02ea589` / `83db9423727fb87bb603b833032dbc078c2d0bb6` and closed without runtime changes. All 3,550 recovered files matched their remote blobs/modes. P3B4 includes objective validation and a narrow inherited browser-harness setup repair. Runtime changes for all Part 3B remain limited to `world_view.js` and `spatial_client.js`.

The camera uses an analytic critically damped elevation spring at 24/s, bounded to 28 units of lag. Live player/peer rendered elevation uses 40/s with at most 8 units or 14 percent of body height. Landing settle is at most 1.25 units over 180 ms. Resets snap on world/life/authoritative discontinuities, connection changes and gaps over 250 ms. Physical XYZ, support, aim/eye/light origins and simulation remain exact.

Depth denominator is `clamp(1 - (z-cameraZ)/3600, 1/1.06, 1/0.94)`; scale is its inverse. A floor 180 below reads at 95.238 percent scale; all layers stay within 94–106 percent. Clamp-crossing triangles are split so physical fragment interpolation and ray masks remain correct. The canonical camera-policy footprint is unchanged; projection cannot admit additional actors or geometry outside it. DPR changes sharpness, and quality changes presentation cost.

Projection-aware picking uses the matching inverse/segmented camera ray, returns physical body coordinates after visual offset, and retains physical eye visibility and camera occlusion. Same-XY hidden upper/lower targets stay unpickable. Full/reduced views preserve scope, physical candidates, cutaway and picking truth.

Level 0 remains one continuous interior. The 288 ordinary/upper ceiling pieces are camera-only omissions, while all 910 physical occluders remain for collision, support, LOS, light/IR and sound. NORTH reveals only local crawl cover for an eligible inside viewer. LONG reveals only the necessary upper slab/edge group for a lower viewer. Clients retain independent cutaway/camera state, with zero hidden peer/beam/aftermath pixel differences in the tested controls.

B-01 through B-19: PASS. B-20: explicit handoff supplied, human readability/comfort/design decision PENDING. See `PART_3B_ACCEPTANCE.md` and its evidence JSON for every disposition. All seven Stage I named suites, eight Part 3A production suites, exact historical baseline comparison and frozen flat parity are retained. The H2 setup race and all earlier failed attempts remain documented; no production repair or test assertion weakening was needed during recovery.

Known limits: full-height +180→0 replay begins at a clearance-valid airborne pose above the bottom stairwell, not a newly authored walk-off ledge. Depth readability and comfort require RoYo's judgment. Software-GPU captures are not hardware FPS certification. Accepted CPU navigation stalls, aftermath limits, historical aggregate failures and P08 UNKNOWN remain. External fonts may fail while local-resource loading must pass.

Part 3C begun: NO. Multi-Level Runtime begun: NO. Main modified/merged: NO. Physics/AI/network/death retuning: NO. Human QA: PENDING.
