# Stage F inherited failures and new investigations

Aggregate **151/162**, with exactly the accepted parent's eleven failure names:

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

P08 remains UNKNOWN / NEEDS INVESTIGATION. Shared 22/23 is inherited F22; SM01
remains inherited. L5b/L5c historical timing caveats are retained even though the
completed live suite passed 17/17. No canon/tuning fix is hidden in Stage F.

`baseline-comparison.json` records exact name equality. All frozen Stage A traces
and dev/baselines bytes were separately compared with the supplied Stage E ZIP and
are unchanged. The later vault-bound repair affects only the spatial queue path.

New functional failures found and resolved in F5: canonical vault dispatch/entry
ordering (earlier checkpoint) and rejection of bunched predicted vault velocities
(this continuation). All original failing logs remain. Delayed post-landing harness
expiry and browser world-reset omission were test adapter issues, resolved without
weakening product acceptance. The first protocol HTTP probe mistakenly treated
redirect.js as a browser module; its intended launcher-only 404 is documented.

Remaining environment/approval blockers: Google Fonts certificate failure, and
automatic approval rejection of public binary evidence upload. These are not
classified as gameplay regressions and are not hidden as passing gates. Stage G/H/I
and hardware-GPU certification are not claimed.
