# Stage F — Authority & Protocol

**F5 VALIDATION COMPLETE — FINAL PUBLIC CHECKPOINT BLOCKED — HUMAN QA PENDING**

Accepted Stage E parent: `da90dbb48ac4702d666d26c638fe074a78478212`. Immutable parent ZIP SHA-256: `a935b3f9c38bea48edc0add99b53d234ce431daf3986face4350691a2e8ad1e6`.
Continuation began at the verified remote `stage-f` checkpoint `53da20cea1edc99119fc5bbc73fe9f247758d6c8`.
F0–F4 were preserved and used as regression inputs. Stage G has begun: **NO**.
`main` was never modified, merged, reset or pushed.

## Checkpoint status

The exact final local commit, tree and last verified remote commit are recorded in
`25D_STAGE_F_PACKAGE_VERIFICATION.json`, shipped alongside this report inside the
package. Its commit identity is filled after the report commit to avoid a circular
self-hash. The final source is committed locally and preserved in a Git bundle.
No final remote commit is claimed. Normal HTTPS Git push lacked credentials;
the authenticated GitHub connector's binary evidence upload was then rejected by
automatic approval review. Ownership of public `RoYoshi/backroomsproject` and the
user's push permission were verified, as were the synthetic game-trace contents.
Review still required explicit approval to publish those evidence blobs publicly.
No alternate public-upload route was used after that rejection.

Required unblock: approve publishing the final Stage F source, reports and test
evidence (including compressed parity traces) to public `RoYoshi/backroomsproject`,
branch `stage-f`. Recheck the remote before a non-force fast-forward update. If
it has advanced, inspect and preserve the new commits first. Do not touch main.

## Result and scope

Z20–Z24 pass through real servers, WebSockets, the retained move.js motor and shared
client protocol/history modules. Protocol v1 adds explicit capability, world epoch,
geometry/schema/hash, motion revision and integer tick identities. Spatial claims
are validated against canonical geometry; full-precision poses avoid quantized
floor selection. The production Level 0 page retains flat compatibility. A spatial
server requires the matching explicit client/content adapter; the ordinary flat
page fails incompatibly rather than silently entering a different world.

The inherited vault repair was verified. An expanded one-second bunch test found
another F5 adapter issue: predicted vault substeps reach about 471.467 units/s,
while early message validation rejected velocities above 360 before dispatching
the canonical vault. The packet bound now uses the existing finite pose velocity
limit of 2000. Grounded speed envelopes, distance debt, geometry and ownership
checks remain unchanged. Claims of 471 grounded vault speed and 2001 wire speed
are explicitly rejected in final adversarial tests. No movement tuning or motor
replacement was introduced.

## Acceptance

| Gate | Result | Evidence under dev/stage_f/evidence/f5 |
|---|---|---|
| Z20 | PASS | final-wire/test_f3.js.log; modes-latency-reconciliation-final.log |
| Z21 | PASS | final-wire/test_f3.js.log; final-wire/test_limits.js.log; gait-wire.log |
| Z22 | PASS | final-wire/test_reconnect_wire.js.log; test_f3 reset cases |
| Z23 | PASS | final-wire/test_f4.js.log; final-wire/test_history_wire.js.log; browser/wire.json |
| Z24 | PASS | final-wire/test_lifecycle.js.log |
| Retained regression | Same inherited failures | inherited/baseline-tests.json; baseline-comparison.json |
| Frozen parity | 46 traces / 35,098 records, zero tolerance | parity/result.json |
| Portable builds | AI/sim/ents byte-identical | portability/builds.json |
| Local served/browser resources | PASS | portability/http.json; browser/resources.json |
| Two live browser elevations / final composition | PASS | browser/wire.json; browser/browser-core.json |
| External font resource | Environment limitation | browser/resources.json |
| Final external checkpoint | BLOCKED by automatic approval review | this report and package verification |

Z20 seed 77: 420 movement ticks, 20–250 ms delay/jitter, ten duplicate reports,
one-second bunch, 150 reports / 92,512 proposal bytes, zero legitimate movement
corrections and zero terminal position error. Queue/history/room-wake work peaks:
51/90/15. Delayed slide/crawl have zero corrections; vault/stair/drop emit the
expected ownership and landing corrections, discard stale predictions, and accept
fresh actual-motor samples after rebasing. Exact transition poses/ticks are logged.
These expected physical-boundary corrections are distinct from false rejections.

## Performance and limits

Hard bounds: 90 history ticks, 90 samples queued per client, 15 samples per report,
15 validations per room wake; eight presentation samples/entity, 100 ms delay,
150 ms maximum extrapolation, 600 measured step-time samples. Incoming spatial
messages are below 16,384 bytes; outbound frames are capped at 524,288 bytes.
Large-frame support was added to the existing WebSocket encoder, not a new transport.

Eight-client bounded flood: queue/history 75/75 and work 15. A deliberate early
sample can be rejected for unearned time. Normal snapshot was 4,539 bytes including
admin statistics (~90,780 bytes/s at nominal 20 Hz). A 128-entity framing fixture
with long IDs produced 85,517 bytes. That entity fixture is frozen specifically to
isolate framing capacity, and is **not** an AI performance claim.

Separate real unfrozen eight-player room: six director entities, 600 measured ticks,
median 0.19198 ms, p95 0.347324 ms, p99 0.508248 ms, max 1.33091 ms, snapshot 7,417
bytes. Node v24.19.0, AMD EPYC 9V74. Three alternating flat-simulation runs versus
the immutable parent gave median-of-run medians 0.015533 -> 0.013731 ms and
median-of-run p99 0.233453 -> 0.195785 ms. This diagnostic excludes serialization.
Short bunched-transition tests have individual cold/loaded spikes up to ~17.5 ms;
the report does not claim every stress tick meets 8 ms. Full Stage I multi-room,
128-active-entity, and Stage G aftermath performance remain deferred.

## Limitations and handoff

The aggregate remains 151/162 with the same eleven inherited failures, including
P08 UNKNOWN / NEEDS INVESTIGATION, F22 and SM01. Historical L5 timing caveats remain.
Frozen baselines and legacy assertions were not regenerated or weakened.

Browser Chromium 151.0.7922.34 with SwiftShader: local code/resources, ten retained
composition gates and two real spatial protocol browser clients pass. Google Fonts
fails TLS certificate validation in this environment; the original strict failure
and scoped result are preserved. No TLS bypass or product dependency change was
used. Hardware GPU performance and human presentation quality remain unproved.
Conservative interpolation holds at unprovable sparse transitions remain a human
smoothness check. This is not Stage H production presentation or Stage G aftermath.

Use `25D_STAGE_F_HUMAN_QA.md`. The user remains final gameplay/design authority.
Stop here; Stage G is not authorized.
