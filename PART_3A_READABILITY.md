# Part 3A readability evidence

Engineering captures are complete; subjective readability and game feel remain **HUMAN QA PENDING**.

The served production client renders the complete 910-solid Level 0. Captures use the normal page, actual server poses and the existing procedural art. Debug labels and legacy unmasked world overlays are disabled. The preserved `dev/part3a/evidence/p3a4/readability-01` contains all twelve named rooms plus stairs base/mid/upper, ramp mid/upper, lower depression and crawl interior.

`dev/part3a/evidence/p3a4/readability-02` refreshes LONG ROOM and all five stair/ramp views after the local upper-edge cutaway correction, and adds the same XY point (6192,864) at Z0 and Z180. All eight captures pass actual rendered-pixel, complete-model, local-cutaway and overlay checks. The lower observer sees the floor after the overhead slab and its five edge walls fade together. From above, the upper support remains visible. Physical solids, lights, navigation and anchors are byte-equivalent JSON values to accepted P3A3; only one view group's membership and the content hash changed.

| Feature | Current capture | Physical cue and human check |
|---|---|---|
| LONG ROOM | `readability-02/room-06.png` | Familiar room, finite wall/ceiling geometry; inspect the route approaches. |
| Stairs | `readability-02/stairs-base.png`, `stairs-mid.png`, `stairs-upper.png` | Finite treads and risers, open stairwell; verify direction while moving and reversing. |
| Ramp | `readability-02/ramp-mid.png`, `ramp-upper.png` | Continuous inclined face joining the upper platform; assess the slope in motion. |
| Same XY overlap | `readability-02/overlap-lower.png`, `overlap-upper.png` | Separate support planes and local overhead cutaway; no promotion of hidden upper content. |
| Lower depression | `readability-01/lower.png` | Lower floor, surrounding rim and legal south return ramp. |
| Crawl | `readability-01/crawl-interior.png` | Low physical roof and finite side walls; standing is blocked. |

Paths in the table are relative to `dev/part3a/evidence/p3a4/`. The remaining eleven original room captures retain their original evidence and provenance. The active/settled aftermath and visible/IR positive/negative mask checks are in `aftermath-browser-02/result.json`; those checks execute on the corrected content. Two-client gameplay, independent cutaway, fall, reconnect and objective evidence remains in `dev/part3a/evidence/p3a3/browser-02/`.

The images are intentionally dark and mechanically stepped in places. A still image does not certify intuitive slope direction, fairness or a pleasant camera experience. The human handoff explicitly asks for stairs/ramp movement, slab thickness/underside, upper/lower separation, local cutaway, and correct actor attachment. Part 3B smoothing, Part 3C lighting and later artwork remain outside this stage.

Full/reduced detail have identical submitted candidate IDs, emitter counts and physical/network state in the preserved production comparison. The reduced target changes pixel resolution only. Software-renderer timings are recorded in `PART_3A_PERFORMANCE.md`; these captures are not hardware frame-rate certification.
