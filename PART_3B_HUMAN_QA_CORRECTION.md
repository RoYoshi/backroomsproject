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
