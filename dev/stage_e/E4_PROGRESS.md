# E4 implementation progress — additional recovery checkpoint

This is an extra recovery save, not the final E4 acceptance checkpoint.

The original Hound/Smiler state machines now pass explicit observed/remembered
spatial goals to the retained A*. Local geometry is bound to each actor's own
support, with no mutable global floor. Actual locomotion calls the shared Stage C
kernel exactly once per engine tick. A committed traversal retains physical
control through a species decision change; it resolves at real support.

18 focused real-engine groups pass: finite contextual spawn, both species'
same-surface contact, physical stairs/ramp/drop, slab occlusion negatives, 900-tick
paired hidden-elevation and IR tests for both species, active traversal through a
capability update, falling without sleep, and multi-story pack exclusion. Positive
controls produce a decision difference only after new legitimate evidence.
The hidden comparison uses a shared seen history followed by counterfactual,
occluded player poses. It varies all prohibited fields and compares every tick;
separate route tests drive the player's physical kernel as well as the entity's.
No fixture AI or forced state transition substitutes for either species brain.

Remaining E4 work: strengthen explicit interruption/replanning, visible IR, and
sleep/wake coverage; finish source-boundary review. E5 long regressions have not
started. Stage F has not started. This checkpoint deliberately protects the
implementation before that final E4 pass.
