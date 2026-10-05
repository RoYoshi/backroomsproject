# Part 3B — Movement, Camera & Depth Presentation

PART 3B — MOVEMENT, CAMERA & DEPTH PRESENTATION ENGINEERING COMPLETE — HUMAN QA PENDING

Accepted Part 3A parent: `4d1f17a600a10599b848b6db9d02fa16b4f479f0`. Tree: `c1e0fc5fd84e5fbea412cf3fca7c309243e8de6e`. Immutable ZIP SHA-256: `6a498a2e498328ebe8064f1a67b406e5d600e614137438df67a79409bf64bdcf`.

Final source identity is recorded in the accompanying external publication receipt.

## Lineage

P3B0–P3B5 delivered the original presentation, published at `6ec76c6ca9b289c108ab933c71af196dd5c522cd`. RoYo rejected it in human QA because it read as a tilted or isometric camera with wedge-shaped walls. The correction proceeded in four steps:

- **HQ0** `66ca14f527244e2e2bf50790ed78d00a05a785ee` preserved the rejection authority.
- **HQ1** `ae7157cc1fd246e72dc809b71c0c34acb54f0ca3` (tree `1b0080abb17629dc959ae0a30de410589f98f88c`) rebuilt the presentation to the user lock.
- **HQ2** `1a08f3c2cd78a033e8fb81a76d20859666c9ccb4` (tree `00ee05b69b5589a2bd80353e051e6554c0b74e01`) ran the full retained regression with no runtime change.
- **HQ3** republishes. It changes only documentation, acceptance and packaging tooling.

Runtime changes for all of Part 3B remain limited to `world_view.js` and `spatial_client.js`. Details are in `PART_3B_HUMAN_QA_CORRECTION.md` and `PART_3B_GIT_CHECKPOINTS.md`.

## Presentation

- **Camera.** Unmistakably top-down: pitch and tilt 0, no isometric or perspective convergence, no global oblique offset, and no world XY scaling tied to the local player's Z. Rectangular rooms stay rectangles and footprints are exact.
- **Wall faces.** Exposed vertical faces in all four directions are drawn as bounded local strips inside their own footprints. Corners meet on a diagonal, and faces turned away from the eye show the cap.
  - Strip width follows the smoothed camera Z: 17.9 units at ground level, 10.1 from Z180, 26.4 from Z−96.
  - That width is the stair and fall cue; smoothing reduces the peak per-frame stair change by 53–58%.
- **Springs.** The camera keeps the analytic critically damped elevation spring (24/s, at most 28 units of lag). Live actors keep their 40/s spring (at most 8 units or 14% of height). Landing settles by at most 1.25 units over 180 ms, and resets snap.
- **Actor scale.** Players, peers, entities, corpses and dropped gear scale relative to this client's own presented player Z, bounded to 94–106%. The local player is exactly 1.0 on every client.
- **Picking and masks.** Picking resolves the displayed surface onto its exact physical point. Wall strips sample the physical face for eye masks, light and scope.
- **Admission.** The canonical camera-policy footprint is byte-identical to Part 3A. DPR changes only sharpness and quality changes only cost.

## Rooms and cutaway

Level 0 remains one continuous interior. The 288 ceiling pieces are omitted only from camera presentation, while all 910 physical occluders remain for collision, support, LOS, light/IR and sound. NORTH reveals only local crawl cover for an eligible inside viewer, and LONG reveals only the upper slab and edge group for a lower viewer. Cutaway probes rise straight up from the local body. Clients keep independent camera and cutaway state, with zero hidden peer, beam or aftermath pixel differences in the tested controls.

## Validation

B-01..B-19 and HQ-01..HQ-02 are PASS against HQ1/HQ2 evidence. B-20, the human handoff, is supplied with the decision PENDING. See `PART_3B_ACCEPTANCE.md` and `dev/part3b/evidence/hq3/acceptance.json`. HQ2 covered:

- the Part 3B presentation suites;
- eight Part 3A production suites;
- seven named Stage I suites;
- exact equivalence with the 18 historical suites;
- the 8-case production display matrix, resets, NORTH/LONG concealment and 12-room readability;
- aftermath, multiplayer gameplay, performance, served packages and redirect;
- the HQ1 focused deterministic and browser checks.

All failed attempts are preserved in `PART_3B_BASELINE_FAILURES.md`:

- a perf-light host-timing outlier;
- three frozen AI traces differing by 1 ULP between the host's Node v22.22.2 and the recorded v24.19.0, byte-identical HQ1 vs HQ0 and within the documented cross-engine tolerance;
- two harness/setup repairs (flat-parity clock start, NORTH in-tunnel aim), with assertions unchanged.

HQ2 made no gameplay or runtime change.

## Known limits

- The full-height +180→0 replay begins at a clearance-valid airborne pose above the stairwell, not a new walk-off ledge.
- Readability and comfort require RoYo's judgement.
- Software-GPU captures are not hardware FPS certification.
- Accepted CPU navigation stalls, aftermath limits, historical aggregate failures and P08 UNKNOWN remain.
- Automatic traversal-derived light pitch belongs to a later pass.
- The spatial Hound pursuit regression and the wall-sticking collision regression are separate blockers, not addressed here.

Part 3C begun: NO. Multi-Level Runtime begun: NO. Main modified/merged: NO. Physics/AI/network/death retuning: NO. Human QA: PENDING.
