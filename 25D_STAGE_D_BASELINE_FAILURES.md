# Stage D baseline failures and resolved development findings

No inherited assertion was removed, weakened or retuned. Aggregate result remains **151/162**; the failure set matches Stage C's complete evidence exactly.

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

P08 remains **UNKNOWN / NEEDS INVESTIGATION**. F22 remains the historical exact-source preservation guard, also producing the inherited 22/23 shared-suite result. Passing other tests does not resolve either. L5c remains historically timing-sensitive; this run's live suite is 17/17, not a guarantee of timing independence.

Resolved Stage D development issues, not inherited product regressions:

| Finding | Correction and evidence |
|---|---|
| Original browser extension imported the production bootstrap a second time | Generated isolated extension omits only that side-effect import; original assets are untouched. Actual Pixi startup succeeds. |
| Pixi extraction left premultiplied upload state, corrupting RGBA32F plane data | Explicit unpack-state reset before numeric upload. Actual cross-floor/overlay pixel tests reject the formerly visible upstairs actor. |
| Expanded receiver's own solid caused distant self-shadow on shallow rays | Expansion applies to other occluders; the receiver gets only a bounded endpoint tolerance. No global actor visibility exception. |
| First resized frame sampled its own color target through an inherited binding | Both sampler units are explicitly bound before world draws. First/second resized output hashes match; WebGL errors are zero. |
| Physically unseen static faces were discarded from camera depth | They now write black opaque depth. Only eligible cutaway removes camera faces. A dedicated actual pixel test verifies opaque black versus exposed local art after cutaway. |
| View compilation could freeze caller-owned data | It now owns a copy; focused tests verify the input's frozen state is unchanged. |
| Initial test expected the 16-unit wall to hide a roughly 39-unit silhouette completely | Correct expectation retains visible side portions; a separate full physical blocker test verifies complete hiding. Geometry/art were not changed to satisfy the test. |
| `gl.finish` invocation timing did not drain Chromium's GPU command queue | Readback-fenced completed frames supersede enqueue timings, with raw historical data retained. |

The slow-frame presentation clamp covers the complete 0.15/0.25-second fade interval; simulation timing is untouched. All corrected renderer cases pass the final focused/actual-browser checks.

Remaining limits are not hidden: software rendering misses 16.7 ms; hardware-reference performance, subjective cutaway/readability and gameplay QA remain unverified. The 64-solid/8-plane bound is an explicit early-prototype capacity, not a claim of large-world scalability. Static fixture art does not migrate gameplay animation/death/lighting/aim paths.
