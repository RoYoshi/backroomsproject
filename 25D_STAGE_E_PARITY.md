# Stage E compatibility and parity

- **Flat trace records:** 46/46 traces, 35,098 records identical at tolerance zero
  using the original `dev/stage_a/diff_traces.js`. This includes real motor,
  selected Hound/Smiler/evidence/group decisions, deaths, navigation and network
  fixtures. All historical trace files remain unchanged.
- **Runtime provenance:** frozen Node v24.19.0; current Node v25.9.0. Only runtime
  and established source-hash metadata differ. Whole trace artifact byte identity
  across runtimes is not claimed. The old Stage C verifier remains failed at its
  obsolete edit allowlist; see the baseline-failure report and raw diagnostic.
- **Level 0:** canonical map/nav/query/seed export is byte-identical. Its source,
  movement tuning and production presentation bundle remain unchanged.
- **Equal evidence:** real Hound/Smiler hidden-elevation and IR paired tests compare
  full enumerable state and RNG consumption every tick; positive controls respond
  to new legitimate evidence. No hidden support/velocity/route is brain input.
- **Camera and timing:** CAMERA-P01 remains 1.25 and 1536×864 at the reference
  viewport. The fixed 60 Hz / 15-step / 250 ms policy and render-FPS independence
  are retained. Camera and timing source bytes match Stage D.
- **Stage D view:** original renderer/projection/cutaway sources and fixture assets
  match Stage D. Actual served core, extended viewport/fade and flat screenshot
  checks are recorded under `dev/stage_e/evidence/final/browser/`. The original flat
  capture has a reproduced parent-only 0/1 ms clock race; its failure remains
  visible. The additive controlled gate passed exact state and PNG equality at
  aligned elapsed times, including full font loading (`browser-controlled-trusted/`).
  Separate served-runtime checks passed with zero script/request/HTTP errors. The flat harness
  retains its old labels `stage-c`/`stage-d`; this run supplies accepted Stage D as
  parent and the current Stage E checkout as candidate.
- **Protocol and deaths:** `mp.js`, `sim.js`, maintained simulation sources,
  `dphys.js`, `death_srv.js` and HOUND/SMILER wire snapshot definitions remain
  unchanged. The only server change is the authorized startup banner. No Stage F
  authority/Z protocol or Stage G death migration is present.

Exact protected-file hashes and parent comparison are in the final scope evidence.
Automated parity is bounded by the retained fixtures; it is not subjective human
approval of fairness, natural movement or presentation performance.

An independent `browser_flat_aligned.js` check compares at 3000 ms with exact state and pixel equality (`evidence/browser-aligned/`). Menu SHA-256: `cfbea62c9fe0a9897eb7d7f4e8d32a7a20203af4a3b88a2a156fd97f1ea2149e`; gameplay: `9ec7c93f8677489dee8a92168ed71b8082d0f601df4c8cf723bb5a7fdbdeee15`. These additional captures do not replace frozen references. Complete immutable-parent comparison and Hound/Smiler capability/evidence-limit equality are also in `evidence/final-scope.json`.
