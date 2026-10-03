# Stage E inherited failures and regression investigation

The final aggregate is **151/162**, with exactly the same eleven failure names as
accepted Stage D. `dev/stage_e/evidence/final/baseline-comparison.json` records the
comparison. No original assertion, threshold or frozen trace was changed.

- P01 noticing distance: run > walk > crouch (resting hound, corridor)
- P07 exhausted breathing is audible only close by
- P08 memory: the last known position is used, then goes stale; the hound gives up and goes back to roaming
- H07 hound state coverage: every state of the framework is reached by emergent play (no scripting of state changes)
- SM01 light: a light carrier it can see is chased after a wind-up; the same person without a light is watched, not chased
- NV09 N a runner through 3+ rooms (real AI): caught every time, no ramming, little touching, no repath storm
- C1 losing sight does not erase memory: 3 s after the prey vanishes the hound still has it (confidence, position, heading) and is still after it
- C4 noise gives the prey away: a prey that has slipped away quietly and then breaks into a run is re-acquired by ear at once (no new detection wait)
- C5 silent hiding can succeed, and good decisions beat bad ones: out of sight, going quiet and moving on gets away far more often than hiding right where it lost you
- C18 memory eventually decays: when the prey gets away, the hound gives up for a stated reason and its confidence has run out
- 2F F22 species physical/canon parameter preservation

P08 remains **UNKNOWN / NEEDS INVESTIGATION**; its historical confidence/decay
result is not blessed or repaired here. F22 remains the historical exact-source
preservation guard. SM01 remains inherited (standalone Smiler 16/17). Shared is
22/23 solely because of F22. L5b/L5c retain their historical timing/randomized
sensitivity even though the final live run passes 17/17.

## Candidate regression repaired

The recovered E5 candidate referenced an undefined `geo` in flat `coarseMove`.
The initial continuation aggregate fell to 140/162 and Hound to 17/18, including
ReferenceErrors in far-LOD cases. The spatial branch already returns before this
flat code. Restoring the original XY distance and regenerating `ai.js` fixes the
crash; final Hound is 18/18 and the aggregate returns to the exact inherited set.
Both this continuation's failing logs and the other writer's independently
recovered logs remain preserved. No baseline was regenerated.

## Network investigation

The first post-fix `audit_net2.js` run used its shared fixed port. It passed six
checks, then reported inconsistent MT1 positions and lost connections. Unexpected
client IDs (the early reconnect became #23 rather than the isolated run's #5)
coincided with another writer working on the same branch. Port contention is the
supported inference, not a proven gameplay defect. The identical unmodified
suite, same Node v25.9.0 and same product bytes passed **11/11** on a freshly
allocated port. The failing attempt and isolated result are both retained in
`evidence/final/inherited/` and `evidence/final/isolated-network/` respectively.
No network or movement-validation code was altered to obtain that pass.

## Historical verifier and browser environment

The original Stage C strict verifier remains unmodified and exits 1 because its
Stage B/C edit allowlist rejects Stage E's authorized `ai.js` change. It is not a
Stage E whole-tree acceptance tool. The unmodified trace-record comparator passes
all 46 traces / 35,098 records at zero tolerance. Runtime/source metadata remains
reported separately: Node v24.19.0 frozen references versus Node v25.9.0 current
captures. Whole compressed artifacts are not claimed byte-identical.

The first Playwright CDN installation returned a non-ZIP response. The exact
official Chrome 151.0.7922.34 headless archive from Stage D was restored, with
matching archive SHA-256 and valid CRC. Actual browser results are separate from
HTTP checks; no static probe is substituted for browser acceptance.

The retained flat screenshot harness also failed when the unchanged Stage D
parent was compared with itself. Instrumentation found `performance.now()` started
at 1 ms in one context and 0 ms in the other, despite identical wall clocks.
`browser_flat_controlled.js` aligns menu/gameplay captures to exactly 1000/2000 ms
without modifying game files or equality assertions. Both menu and gameplay are
byte-identical with fallback fonts and with fully loaded fonts. Original failures,
parent-only control, timing diagnostic and passing captures remain retained.

The first strict served-runtime network check failed on the inherited Google Fonts
request with `net::ERR_CERT_AUTHORITY_INVALID`. A scratch-only NSS database imported
only CA certificates already verified against this environment's system trust
bundle. With that store, both served pages passed with zero script, request and
HTTP errors; TLS verification stayed enabled. The utility/certificate hashes are
recorded in `evidence/final/certificate-provenance.json`. No game dependency or
system trust setting changed.

No new unexplained functional regression remains after the documented correction
and isolated verification. Human QA, hardware-GPU certification and later-stage
production spatial integration remain outside the automated acceptance claim.
