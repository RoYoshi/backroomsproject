# P3A3 — COMPLETE

Current content `part3a-gameplay-1`, hash `ced63648ddb0e3584df4d6aa3b3d405cdc5968c9b7fbaf0c37ee756ed92030b3`: 910 solids, 307 supports, 12 nav surfaces, 28 traversal links, 290 spaces, 449 portals, 90 lights, 1,066 anchors, 147 local view groups.

Focused evidence in `evidence/p3a3`:

- `base-02.json`: two byte-identical builds match the shipped JSON; all 3,308 original floor-cell footprints, 12 rooms, 18 props and 90 lamps preserved; complete/permutation-invariant render model.
- `gameplay-03.json`: all anchors clear and supported; two identical seeded sequences of 100 worlds; variable one-copy cartograph and three well-separated exits; normal entity populations/distances and upper/lower participation; real player prop vault/crawl; same-elevation physical objective checks.
- `vertical-01.json`: 88 checks / 82 player/species route executions and all-room base circulation PASS. `navigation-03.json`: ten graph routes execute waypoint by waypoint, including both species on stairs, ramp, lower route and return. `prop-links-01.json`: 60 low/window physical vault proofs.
- `perception-01.json`: observation-only visual memory, cross-slab ray/contact rejection, bounded ambiguous hearing without hidden owner/support/route, IR separation PASS.
- `browser-02/result.json`: real production clients, same-XY upper/lower independent cutaway and zero-pixel cross-slab peer masks; real rim fall, reconnect, shared cartograph pickup, visible selected wall effect and normal escape PASS. Final lamp placements are additionally verified by `lamp-placement-02.json` and current-content gameplay/base reruns; P3A4 will capture every room.
- `aftermath-03.json`: 12 server-owned Hound/Smiler cases across base, upper, lower, stairs, ramp and ledge; all mass clearance/tether/sleep invariants and settled body/loose gear support PASS. Awake constrained hands are retained, not forced asleep.
- Retained Stage E motion and Stage G canonical authority/replay focused tests PASS.

Raw failures and narrow repairs remain in the failure report and preservation checkpoint. No AI tuning, motion/network/death redesign, main modification or later Part 3 work. P3A4 has not started. External receipt supplies this checkpoint's source identity.
