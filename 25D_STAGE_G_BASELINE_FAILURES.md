# Stage G baseline failures and investigations

The accepted aggregate remains **151/162**, with exactly these same failures:

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

Shared remains 22/23 (inherited F22). SM01 is inherited. P08 remains UNKNOWN /
NEEDS INVESTIGATION; Stage G does not reinterpret or fix it. Historical L5 timing
caveats remain even though the completed live suite passes 17/17. Frozen references,
thresholds, species canon and tuning were not changed to hide divergence.

The first retained audit-net2 attempt reported NZ1: one no-report running sample
was classified walking before later running samples. It ran while independent
checks overlapped. The entire unchanged suite passed 11/11 when run alone. This
is recorded as observed timing variability, not silently deleted, and is not
claimed as a newly proven Stage F baseline defect. There is no new reproducible
functional regression in the final checks.

Stage G physical/fixture failures and repairs are retained in G0–G4 evidence and
summarized in G4_STATUS.md: initial fixture bounds/step height, ramp attachment,
near-wall death-envelope expansion, tick-aligned sleep, canonical long-fall
setup, fault-query trajectory and the cap workload's empty-world reset. Real
physics thresholds and frozen expectations were not weakened.

Browser harness failures are preserved: unavailable/truncated runtime download;
incorrect request for private ai.js; an exact-zero comparison across different
V8 versions (observed ~5e-14 difference); and assuming a hat on a default no-hat
connection. The final gate uses the existing geometry epsilon 1e-7, exact discrete
state agreement and actual equipment count. Original exact same-runtime and
frozen tests remain unchanged. The recovered runtime came from the official
Chrome for Testing archive and its ZIP integrity was verified.

The existing external Google Fonts certificate failure persists; local game
scripts/resources and browser boot pass. Hardware-GPU certification is absent.
The 24-active Stage G workload is bounded but above this host's 60Hz CPU budget
and has substantial payload cost. These limits are disclosed, not solved by
skipping collision, forcing unsupported sleep or starting Stage I work.

Raw evidence lives under dev/stage_g/evidence. Each failed run precedes its repair
and is retained. Source changes were pushed at every required milestone, with
additional recovery checkpoints during longer investigations.
