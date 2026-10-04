# Stage I inherited failures and preserved attempts

Fresh accepted H and Stage I both return 151/162 aggregate and 22/23 shared, with exact failure-name equality. P08 remains UNKNOWN as a behavior conclusion even though its aggregate row is among the eleven inherited failing assertions.

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

No old assertion or threshold was relaxed. Historical L5/NZ1 observations remain in accepted evidence. The original H perf-light miss remains preserved; I4 retained performance results are listed in TEST_SUMMARY.

Stage I raw attempts:

- `i1/world-01`: new large fixture exceeded its declared minimum bounds; only those test bounds were corrected. `world-02` passes.
- `i1/perf-01`: default browser executable missing; the standard install returned truncated ZIPs. The existing compatible Chromium was selected through the documented environment option. `perf-02` passes; no product path was embedded.
- `i2/stress-01/server-soak.json.failure.json`: new harness accessed the recreated client snapshot before arrival. First-snapshot readiness was added after external preservation; the original assertions pass in `stress-02` and `measurement-03`.
- `i2/memory-evidence-audit.json`: host /proc RSS reads produced no samples, explicitly marked incomplete evidence. Test-only server process telemetry supplies 73 samples in `measurement-03`; zero samples are never presented as zero memory use.
- `i3/parent-comparison-01`: flat candidate run 1 p99 0.503586 ms / worst 53.990695 ms and first 24-active candidate p99 87.362694 ms remain raw slow observations. Three flat pairs and two aftermath pairs, plus exact runtime-byte equality, do not establish a new regression. The second 24-active pair is 57.830375 / 57.790630 ms.

Carried limitations: Accepted aggregate 151/162 with the same eleven failure names; shared 22/23 with F22; P08 remains UNKNOWN; historical L5/NZ1 timing observations; external Google Fonts network/TLS failures; software SwiftShader misses 16.7 ms with no hardware GPU certification; inherited full-quality two-client airborne-capture limitation (Reduced detail passes the unchanged assertion); 24-active aftermath CPU/payload limit; accepted spatial presentation capacities of 64 solids, eight planes per solid (at most six footprint vertices), 128 light emitters, 64 lamp-failure records, and a 4,194,304-pixel render target.

All prior A–H evidence remains in the source archive. A historical failed attempt stays failed; a later success is recorded separately with its provenance.
