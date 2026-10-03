# E3 — Spatial sensor boundaries / working recovery checkpoint

Runtime: Node v25.9.0. Previous remote E2:
`e9bc7b8bc58674db0823cae00949c93dbc44e1f5`.

The shared geometry now answers XYZ contact and bounded acoustic propagation.
An acoustic query considers at most 128 portals / 130 nodes and reports a
receiver/portal-derived elevation interval and at most four surface alternatives.
Neither exact source Z nor source support, route, destination or velocity enters
sound evidence. Portal detours and solid/material transmission both affect the
physical signal. Missing spatial sound coordinates fail closed.

Sight uses real eye/body rays through collision-independent visible geometry.
Observed support alternatives come from visible foot contact and static geometry,
never the player's support field. Velocity comes from consecutive observed poses.
Gaze reuses the observed facing and physical eye ray; capture has a final physical
contact guard. Visible source/beam/patch observations retain uncertainty and are
anonymous unless an actually observed person uniquely explains the source.
Camcorder/IR has no visible emitter, beam, illumination or evidence bonus.
No sensor reads camera, cutaway or view-group state. All flat branches are retained.

Focused suite: 16 sensor groups, 8 navigation core groups, 16 physical routing
groups, retained Stage C 21 core / 54 adversarial groups. Raw outputs are in
`evidence/e3/`. The focused original flat evidence suite is also recorded there.
The poisoned-property sight test rejects even incidental object-spread reads of
hidden velocity/support/route fields. Disjoint observed elevations never merge.

This is a working checkpoint, not the finished Stage E package. The real Hound
and Smiler spatial locomotion, pack/LOD integration and paired hidden-elevation
brain/RNG proof remain E4. Full regression and package/browser checks remain E5.
Stage F has not begun. No wire/render/protocol or Level 0 redesign is included.
