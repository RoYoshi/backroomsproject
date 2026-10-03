# Stage F test summary

Final protocol runtime: Node v24.19.0. Browser: Chromium 151.0.7922.34 / SwiftShader.
Final wire aggregate passes Z20–Z24. Additional delayed-transition recovery and
quiet-gait/unauthorized-teleport checks pass separately after the aggregate run.
No underlying test assertion was relaxed. `TFB_EVIDENCE_DIR=PATH node
dev/tests/network25d.js` retains each test's raw output. Tests need localhost
networking and a Node runtime with built-in WebSocket (the tested v24 runtime).
The product's existing Node >=18 declaration is not a claim that these harnesses
run on every Node 18 release. Node 22.16.0 / 22.22.2 were not installed here.

## Retained complete runner (recovered and preserved)

| Suite | Result | Counts |
|---|---|---|
| npm-test | FAIL | 151/162 |
| hound | PASS | 18/18 |
| shared | FAIL | 22/23 |
| humanqa | PASS | 6/6 |
| fps | PASS | 10/10 |
| camera | PASS | 12/12 |
| entity-look | PASS | 4/4 |
| physics | PASS | 53/53 |
| interpolation | PASS | 3/3 |
| navigation | PASS | None/None |
| audit-net | PASS | 17/17 |
| audit-net2 | PASS | 11/11 |
| live | PASS | 17/17 |
| ir-net | PASS | 4/4 |
| perf-hound | PASS | 15/15 |
| perf-shared | PASS | 27/27 |
| perf-smiler | PASS | 3/3 |
| perf-light | PASS | 1/1 |

Navigation is a descriptive benchmark; None/None is not an assertion count.
The full retained runner was completed in the interrupted run and its exact logs
survived. The later F5 repair changes only spatial proposal prevalidation; final
real-wire acceptance, handshake, fall, all movement modes and browser gates were
rerun on that repair. Flat runtime paths, AI, motor and death kernel are unchanged
by the recovery repair, so the completed retained run is carried forward rather
than misrepresented as a fresh repeat.

## Spatial, determinism and browser gates

- Stage E nav/perception, Stage C motion/adversarial/FPS/camera, Stage D view and
  render-independence: all preserved passes in `evidence/f5/spatial/results.json`.
- Z20–Z24: `final-acceptance.log` and `final-wire/` raw messages/results.
- Delayed slide/crawl/vault/stair/drop plus post-transition acceptance:
  `modes-latency-reconciliation-final.log` (seed 137; 20–250ms; one-second bunch).
- `gait-wire.log`: run speed with quiet standing claim remains audible running;
  unauthenticated spatial teleport does not move the player to an upper floor.
- Frozen motor/AI/death/navigation/network: 46 traces / 35,098 records identical.
- Real browser peer poses on Z0/Z180 render through retained composition with no
  hidden peer/overlay difference and zero GL/script errors.
- Builds in a clean path with spaces reproduce AI/sim/ents exactly; HTTP bytes of
  shared protocol/history/mp match disk. redirect.js remains at root and correctly
  remains outside the HTTP allowlist because it is a server launcher.

## Investigations preserved

Original vault entry mismatch and repair logs remain. The new delayed-vault
failure was isolated to packet prevalidation at ~471.467 units/s; bounded-envelope
repair and malicious-speed regression pass. A supplemental reconciliation harness
then waited past the 90-tick correction anchor lifetime; it now resumes immediately
after landing, retaining the same acceptance assertion and protocol limits.

The browser test adapter initially ignored the first join's explicit world reset;
its final version handles the same `world` event as the retained wire helper.
No product change was required. Old restored Chromium was truncated and crashed;
a fresh official runtime was downloaded. External Google Fonts TLS still fails;
local-browser execution is a separate PASS, not a falsely green full-resource run.
