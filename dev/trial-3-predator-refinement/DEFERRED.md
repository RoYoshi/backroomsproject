# Trial 3 predator refinement — deferred items and owner decisions

Trial 3, B1–B5 and this refinement are **not owner-approved**. Nothing below was done; each item is for the owner to decide after Human
QA (`HUMAN_QA.md`) or belongs to a later, separately approved project (pack 11).

## Decisions for the owner (measured, not tuned away)

1. **How deadly a starving one should be to somebody who only stares.** Watched from 450 px in the lit hall by a person who never moves,
   a .75 one now kills in 6–8 of 8 runs within 45 s and a .95 one in 8 of 8 (Trial 3: none). A watcher who breaks away at the wind-up
   survives that spring (8 / 8 in the corridor, 6 / 6 in the hall). The knobs are the eye-contact weights in `skDecide` and `SK.freeze*`
   (`BALANCE_TABLE.md`). Too much, or right?
2. **The trail after a lost race.** A hungry one keeps to a runner's trail after losing the race, at 85 % of their speed (`SK.shadowPace`,
   at most 200 px/s). A runner who keeps moving keeps the lead they won — sprinting (285 px/s) for about 9.5 s, then winded and walking
   (148 px/s) — and one who stops in the open is reached (PR27: 8 / 8 never closer once winded; PR05: reached after stopping at the hall's
   end in most runs). Until R7 the trail was at their speed + 30 px/s and closed on a winded runner at about 30 px/s — the independent
   review's first finding, fixed (`CHECKPOINTS.md` R7). Keep the trail, or stop shadowing after a time / a distance?
3. **How long a lead lasts.** Without new evidence a hunt ends 10–22 s after the last sighting or sound in the scenes measured (`SK.forget`
   10–30 s, `SK.wrongCost`, `SK.huntTries` 2–4). Longer feels more relentless and makes hiding harder.
4. **Hungry but not starving, watched.** At .5 a watched one still backs out of sight, waits, and then leaves (7–8 of 8, after 14–17 s);
   from .6 its backing off is bait, and a failed bait no longer ends the hunt. Is the middle band as it should be?
5. **The flank or the bait.** Which answer a hunt prefers when watched is drawn per hunt: P(flank) .3 at hunger .4 to .75 at .8. Trial 3's
   bait test (SK21) now judges the third of hunts that bait.
6. **The size.** `BODY_SCALE` 1.3 (the pack's 1.2–1.35) with a minimal pose correction; the collider unchanged. Screenshots:
   `evidence/r5_shots/` (lineup, doorway, gallery, a kill). A different value is one constant.
7. **Satiated passers-by.** Unchanged from B1–B5: noticed, looked at, warned if they crowd it, defended against if they keep pressing.

## Known and not fixed here

* **Inherited test failures** — the same 13 as at R0 and on P9 (P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22),
  and `test:humanqa` X03. Hound / Smiler / shared-world tests; this branch changes none of that code (PR25).
* **Trial 3's browser kill check (`skin_browser.js` t4)** fails one timing-sensitive case intermittently on this branch *and* on `4518f93`
  (`t4_spectator_replay` or `t4_victim_frame_is_the_corpse`; once the page was caught by a random monster before its admin unlock): the
  scene does not clear the world's monsters and SwiftShader is slow. Not caused by this refinement (`evidence/r5_skin_browser_*`,
  `r6_*browser*`).
* **Art.** The figure is still Trial 3's interim procedural drawing, scaled and slightly re-posed; a full visual / locomotion redesign is
  out of scope (pack 11) and deferred until the behaviour is accepted.
* **Death variety in hunts.** Kills in the measured hunts are mostly the pounce (B) and the starving kill (C); the grab (A) happens when a
  person comes within arm's reach (SK33). Unchanged from Trial 3.
* **The security items** (the inherited default admin passcode; the untrusted `X-Forwarded-For` lockout) — separate security work; not
  touched.

## Not authorised now (pack 11), untouched

Full creature art or sound redesign; corpse dragging, item theft, deeper identity deception; any natural or director spawning (admin cap
4 only); changes to the shared N.A.N.I. engine or senses, the Hound, the Smiler, the snapshot protocol, the player's speed or stamina, the
map; OVERSEER 2.0; secrets / rate-limit remediation. No merge, no deploy, no protected branch changed.

## Roadmap after Human QA (not started)

1. Owner Human QA of this branch. 2. Targeted fixes if needed (the knobs above). 3. Approval only when it feels right. 4. A separate art /
locomotion project if still wanted. 5. OVERSEER 2.0 only on explicit approval after Trial 3.
