# Part 3B human QA correction

P3B-HQ0 — HUMAN QA FAIL / NEEDS FOLLOW-UP.

The published result at `6ec76c6ca9b289c108ab933c71af196dd5c522cd` (tree `05a8e8926ed30012d3158e7ef0f5b6f546bc06a1`) was rejected by the user: walls and rooms read as tilted/isometric, with large wedge faces. Engineering gates did not establish human visual approval.

The original screenshot, rejection authority and correction prompt are preserved verbatim under `dev/part3b/authority/human-qa-correction`. The prior rendered captures and source remain in history. HQ0 changes no runtime code and runs no repair tests.

Required replacement: top-down orthographic room rectangles, parallel wall lines, local volume cues on all four wall orientations, retained stair/fall cues, canonical footprint, picking, physical truth, local cutaways and independent client presentation. Preserve all unrelated 3B work.

Part 3C and later work are not authorized. Human QA remains failed until engineering correction is complete, then returns to pending for the user’s decision.

## P3B-HQ1 — recovered presentation correction

Rebuilt from HQ0 `66ca14f527244e2e2bf50790ed78d00a05a785ee` using the user presentation lock and the interrupted-run notes as guidance only. The unpublished local commit `2132dfa01bec8bf9edafc52d48d910734c25d0d3` was never available and nothing here is taken from it.

Runtime changes are limited to `world_view.js` and `spatial_client.js`.

- **Camera.** The production camera is now `{depth:false, elevation:0, topDown:true, anchorZ}`: pitch and tilt 0, no oblique offset, no Z-based XY scale. Every footprint's upper and lower outlines coincide on screen. The rejected layer-depth path (`depth:true`, e 0.5) is kept only for legacy fixtures that request it.
- **Wall depth.** Each exposed vertical face is drawn as one perpendicular band inside its own footprint, on all four directions, so floors and room rectangles are untouched. A face counts as exposed unless another drawn solid meets it at its top, or a never-cut-away solid sits on its edge.
  - At a convex corner the two strips overlap and a depth slope splits them on the diagonal. A strip whose neighbour faces away keeps a square end.
  - At inner room corners both strips extend one band width and split the corner square on the mitre diagonal.
  - Faces turned away from the eye are culled, so the cap shows there.
  - Band width = 52 × (m(top) − m(bottom)), with m(z) = 640/(640 − (z − camera Z)), clamped to 3–28 and to 0.35 × thickness. A 0–164 wall is 17.9 at ground level, 10.1 seen from z180 and 26.4 seen from the depression floor. The camera-Z spring makes this the smoothed stair/fall cue.
- **Physical truth.** Band pixels sample the physical face for eye masks, light, scope and picking. Shading darkens toward the floor crease. Floor grid lines are drawn on up-facing surfaces only.
- **Actor scale.** Billboards for players, peers, entities, corpses and death debris use the original bounded 3B law (1/3600, clamped 0.94–1.06) relative to this client's own presented player Z. The local player is exactly 1.0, and lamps, labels and surface art stay at 1.0. Pick radii scale with the art, and hits map back onto the physical body.
- **Picking.** In top-down mode, picking resolves the displayed surface exactly: caps at their footprint, bands through the same triangles the GPU draws. The result must still be seen by the eye.
- **Wall-mounted art.** Decals, trails and exit glitch art on a vertical face are drawn inside that face's band.
- **Cutaway.** Probes rise straight up from the body; NORTH crawl and LONG ROOM semantics are unchanged. The legacy mesh and packets are byte-identical to HQ0.

Focused validation:

- **Deterministic** (`dev/part3b/test_hq1.js` → `dev/part3b/evidence/hq1/focused-deterministic.json`), PASS:
  - no global scale or offset at camera Z −96, 0, 72 and 180;
  - 910 exact caps and 5,726 rectangular strips; wall/pillar bands never cover open floor;
  - bands on all four wall directions (N 161, S 162, E 176, W 175), and eye-facing in all four from room anchors;
  - local scale exactly 1.0, and the A180/B0 example gives 0.952 and 1.053;
  - 45 band picks land exactly on the physical face;
  - stairs keep the cue smoothed, with the peak per-frame change cut by 58% (forward) and 53% (reverse); both falls show a visible cue change;
  - NORTH/LONG cutaway unchanged, and ordinary rooms have no roof blackout.

  The existing `test_foundation`, `test_motion` and `test_cutaway` checks, and `browser_foundation` for the legacy page, still pass.
- **Production browser** (`dev/part3b/browser_hq1.js` → `dev/part3b/evidence/hq1/browser/`), PASS on six Level 0 views:
  - raising the camera Z by 180 changes only band pixels (0 changed pixels outside bands in each view);
  - band clicks hit the physical face;
  - with two real clients, A at z96 sees B at 0.974 and B sees A at 1.027, and each sees itself at 1.0.

Remaining HQ2 work:

- Run the full retained regression: two-client concealment, picking, the aspect/DPR/quality matrix, and the Part 3A, Stage I and Part 3B gates.
- Update the Part 3B production gates that still assert the rejected layer-depth production camera, recording each change against this lock rather than weakening it.
- Run a performance check. Compile adds about 65 ms once at startup in Node.

## P3B-HQ2 — full retained regression

Source under test: HQ1 `ae7157cc1fd246e72dc809b71c0c34acb54f0ca3` / tree `1b0080abb17629dc959ae0a30de410589f98f88c`. No runtime file changed in HQ2. The host runs Node v22.22.2 and Playwright 1.56. The frozen traces were recorded on Node v24.19.0, which is not obtainable here. Evidence is in `dev/part3b/evidence/hq2/`, summarised in `hq2-summary.json`.

Preserved failures, in order:

1. **`whole-01`.** Every presentation and Part 3A production suite passed. The historical baseline comparison then failed on `perf-light`: seed 1's p99 was 2.075 ms against a 2 ms limit, while seeds 2–3 were at 0.84 ms. That suite drives `sim.js` only and never loads the renderer, so this is host timing. On the unchanged rerun, `whole-02` passed exact baseline equivalence (p99 1.984 ms), with all 18 suites matching the accepted counts and failure names.
2. **`whole-02` zero-tolerance frozen parity.** Three AI traces diverge by one ULP, for example `ai-s_hound2e-2E-H5` at tick 194 (0.679638399136415 vs 0.6796383991364151). The HQ0 source reproduces the identical divergence on this Node. The zero-tolerance gate is unchanged. `parity-cross-engine-01` instead follows the documented Stage A cross-engine procedure:
   - HQ1 captures are byte-identical to HQ0 captures on this host, for all 46 traces;
   - 43 traces are identical to the frozen references at zero tolerance;
   - all 46 traces and 35,098 records match within 0.00001, with discrete state and event order exact;
   - the map is byte-identical and the frozen files are unchanged.
3. **`whole-03-continuation`.** It ran every remaining whole-phase gate and the HQ1 suites.
   - **Flat browser parity failed in the harness.** The Playwright 1.56 paused clock already reads about 303 ms when the page is ready, so the original absolute 100 ms schedule would need negative ticks. It failed on the Part 3A parent before the candidate ran.
   - **NORTH concealment changed 2 floor pixels.** They sit just outside the crawl mouth at (1629.6, 897–900). The hidden crawler's beam had been aimed by the incidental post-Enter mouse position, toward the open mouth. The authoritative geometry raycast confirms that light physically exits the mouth unblocked and that the outside eye sees those points. No body or gear pixels changed. HQ0 passed only because its slanted pick mapped the same pointer slightly differently.

Narrow repairs (`whole-04-repaired`, both PASS):

- **`dev/part3b/browser_flat.js`** is a copy of the Stage H harness. Parent and candidate both advance to one fixed 1000 ms start, then receive the same 20 ms schedule. The pixel and state comparison is unchanged.
- **`dev/part3b/browser_cutaway.js`** now aims the crawler deterministically along the tunnel (east) and waits until the outside client receives that beam. The zero-pixel concealment assertion is unchanged.

Passing coverage:

- invariants: only the two presentation files differ from the Part 3A runtime freeze;
- three Part 3B presentation suites and eight Part 3A production suites (vertical, navigation, gameplay, perception, picking, render coverage, aftermath);
- the eight-case production display matrix: 16:9, 16:10, ultrawide, DPR2, 4K, reduced quality, NV zoom 2 and NV zoom 4 at DPR2. Every case has 0 hidden-peer pixels, unpickable hidden targets, an identical physical scope and candidates, and an independent upper client;
- resets; NORTH and LONG two-client concealment;
- twelve-room readability, aftermath and multiplayer gameplay;
- performance, served flat and production packages, and redirect;
- the HQ1 focused deterministic and browser checks;
- all seven named Stage I suites (`named-01`).

HQ2 status: PASS. HQ3 republication follows only after this checkpoint is remote-verified.

## P3B-HQ3 — corrected final publication

Correction lineage:

| Step | Commit | Tree | Runtime change |
|---|---|---|---|
| P3B5 (rejected) | `6ec76c6ca9b289c108ab933c71af196dd5c522cd` | `05a8e8926ed30012d3158e7ef0f5b6f546bc06a1` | original layer-depth presentation |
| HQ0 | `66ca14f527244e2e2bf50790ed78d00a05a785ee` | `35bd20455ca97fa83931d676854636c868420e5b` | none (rejection authority) |
| HQ1 | `ae7157cc1fd246e72dc809b71c0c34acb54f0ca3` | `1b0080abb17629dc959ae0a30de410589f98f88c` | `world_view.js`, `spatial_client.js` |
| HQ2 | `1a08f3c2cd78a033e8fb81a76d20859666c9ccb4` | `00ee05b69b5589a2bd80353e051e6554c0b74e01` | none |
| HQ3 | see publication receipt | see publication receipt | none |

HQ3 re-binds acceptance to HQ1/HQ2 evidence (`dev/part3b/certify_hq3.py` → `dev/part3b/evidence/hq3/acceptance.json`). It then republishes with `dev/part3b/package_hq3.py`, which follows the P3B5 finalizer. It verifies that the local head is the independently read remote head with an identical recursive tree, and it audits every changed file. It then writes a deterministic ZIP from the exact committed Git blobs and modes and checks CRC and namelist. From a fresh extraction under a path containing spaces it verifies every blob and mode, rebuilds the generated runtime and content twice and checks them byte-identical, and runs runtime invariants, served-package, redirect and HQ1 focused smoke checks. Last, it writes the source, package and publication receipts.

HQ3 changes no gameplay or runtime source. The 1-ULP Node-version parity finding and both harness/setup repairs are preserved as recorded in `PART_3B_BASELINE_FAILURES.md`, with their assertions unchanged. Human QA is not marked PASS. The engineering status is `PART 3B — MOVEMENT, CAMERA & DEPTH PRESENTATION ENGINEERING COMPLETE — HUMAN QA PENDING`.
