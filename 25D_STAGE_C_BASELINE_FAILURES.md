# Stage C baseline failure ledger

No inherited assertion was deleted or weakened. No Hound/Smiler retuning was made.

The complete-output aggregate rerun is 151/162, exactly the Stage B failure set:

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

P08 remains UNKNOWN / NEEDS INVESTIGATION. Passing unrelated checks is not a resolution.
F22 remains the obsolete exact-source preservation guard; expected maintained-source changes and inherited Stage B edits are documented rather than blessing its hash assertion. The separate shared suite remains 22/23.
L5c remains historically timing-sensitive; current live suite passes, which does not establish a timing-independent guarantee.

The first Stage C aggregate attempt ran about 154 seconds but its retained stdout contained only two case results, with no final summary. It is classified as incomplete test evidence, not a newly reduced test count or a product regression. The original log/runner JSON are retained. `npm-test-complete.log` and `.json` contain the complete-output rerun and establish the 151/162 count.

Development failures were resolved before acceptance: exact-rest GJK handling, ramp finite-edge/chord contact handling, and inaccurate initial fixture expectations. Additional adversarial validation rejected self-intersecting footprints, cyclic duplicate solids and coordinates outside supported bounds. Final core/schedule/adversarial tests pass.

Browser checks remain BLOCKED, not PASS. Stage C human gameplay QA and independent review are pending.
