# Stage 2F implementation decisions — recorded before changes

Baseline: supplied v23.2.0-2e, SHA256 b1bbf50a7a5d93e6e506d13927902954ca2f1908ee8413edd96a3fa4cbe1d7e5.

Frozen: species speeds/acceleration/turning/lunge/contact, Hound eye-contact and search budgets, Smiler agitation/eye-contact/light thresholds and commitment, personality ranges, movement, navigation and death physics. No subjective retuning.

Correctness changes necessarily visible at species adapters:
- Sound events currently leak src and ox/oy to AI. The boundary will keep raw emitter IDs/coordinates private, identify only a directly observed source producing the event, and expose uncertain anonymous observations otherwise. Hidden footsteps cannot renew a player-specific trail. Anonymous sound investigation reuses existing investigation states/timing/speeds without inventing a player target.
- The existing 1.3 pursuit-focus multiplier uses the secret sound source ID. Keep its numerical value only for legitimately identified sound. Unidentified sounds use the existing unfocused hearing range. This is removing privileged identity dependence, not a hearing-range balance pass.
- Shared perc() and tgtGone() read live players while a seen flag can be stale. Shared visual snapshots will remove between-sense hidden-data reads. Physical contact/capture and explicit system lifecycle/spawn/LOD remain allowed exceptions.
- Light proximity must not retroactively label anonymous sounds as a person. Sound and light lead merging must stay modality-separated.
- Species retain their target formulas/dwell and canon triggers. Shared bounded candidates explain evidence and rank competing sounds/leads by quality/age/uncertainty; no universal action brain. Canon-trigger priority stays species-owned.
- Entity RNG derives from simulation seed + kind + stable numeric entity ID + fixed subsystem tags. Personality, behavior, search, perception and scheduling have independent lightweight streams. No entity borrows the world/director stream. Historical seed outcomes will change; preserve distributions and parameters.
- Stable processing order uses numeric player/entity IDs and observation geometry keys, never caller array order. This is a tie-break, not account knowledge.
- Habits require three actually observed repeat passages, at most six observations/identity, three hypotheses/entity, 30 s TTL; at most 12% score bias on an already valid search candidate. No hidden-route learning; expire on encounter end and clear on lifecycle boundaries.
- Explicit memory ceilings/TTL and lifecycle invalidation prevent ghost IDs and cross-life profiling, including while the simulation is paused. Existing corpse/kill physical state is preserved.

Tests will distinguish changed anonymous-sound semantics and RNG samples from species tuning. Legacy percentage assertions stay intact. Human QA deferred, no 2G/2.5D.

Resume cleanup corrections: the world-reset and identity-forget paths invalidate the short-lived beam cache/history so a former life cannot retain a light source; far-tier transition clears live-seen flags, and far memory uses elapsed dt rather than assuming 60 Hz. These are shared lifecycle corrections, not species tuning.
