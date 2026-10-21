# Trial 3 behaviour refinement — deferred and not done

From the pack (`08_DEFERRED.md`). Nothing here is implemented, simulated or faked in this refinement. Trial 3's own deferred list
(`dev/trial-3-skin-stealer/DEFERRED.md`) still stands unchanged.

## Not implemented, by instruction

| Item | Status | What it waits for |
|---|---|---|
| The creature's appearance and locomotion (the squat, frog-like silhouette, ambiguous facing, raised arms, top-down readability) | the interim T5 art is unchanged and **not approved**; this pass changed no art, sound or animation | a separate art and animation revision once the owner is happy with the behaviour |
| Deep identity theft, session impersonation, network redesign | not touched; a modified client can still tell the species from the snapshot (P9's design for all monsters) | a separate server-side visibility / anti-cheat stage |
| Dragging or hiding a corpse | not touched; the defensive kill uses the same capture, death and one corpse as every other kill | server-authoritative corpse interaction |
| Flashlight / equipment theft | not touched; the victim's light stays at the corpse | H.A.N.D.S. and P.O.C.K.E.T. item ownership and transfer |
| Crawlspaces while disguised | not touched | LogicZ (real clearance and height) |
| Unearned generic disguise | not touched; only the earned skin exists | an owner decision |
| Organic spawning | not touched: admin-only, at most 4; the director never makes one | the owner's ecology decision |
| Red Rooms lighting, a stronger heartbeat / red pulse | not touched | a separate stage (keeping Reduced Motion and photosensitivity safeguards) |
| An admin hunger control | **not invented.** There is no hunger slider in the admin panel. A satiated creature is reached in game through the existing SKIN death preview (a real kill lowers its hunger by 0.35 and feeding lowers it further; `HUMAN_QA.md`), and deterministically in `dev/tests/s_skinbehave.js` (BR08 starts at hunger exactly 0) | an owner-approved debug affordance, if wanted |

## Inherited issues: documented, not fixed

| Issue | Seen in this pass |
|---|---|
| P9's 13 `npm test` failures (P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22) | the same 13 names at B0, B1, B2, B3, B4 and B5b (`CHECKPOINTS.md`) |
| X03 in `npm run test:humanqa` | fails as on P9 and Trial 3 (5 / 6) |
| The stochastic one-image contact-lab issue | not exercised by this pass's checks (no full gate was run; see `REGRESSION_REPORT.md`) |
| The admin fallback passcode and the forwarded-IP lockout finding | not touched; every check here used a synthetic passcode from the environment, never written into a report |
| The engine's level of detail reads the true nearest-player distance (P9, all species) | not changed. No decision of the refinement reads it, but how often a creature thinks depends on it; the tests that compare a world with and without an unsensed person hold the tier fixed (BR06, BR07, BR19), as Trial 3's SK15 / SK23 did |

## Limits of this refinement, known now

* **Player velocity is reported by the client** (P9's `session.js`). Pressure reads a seen person's motion as the server has it; a
  modified client that lies about its velocity could make its approach look gentler or harsher to the creature. Trial 3's hunt already
  read the same field. Server-derived velocity would be a separate change to shared code.
* **A defence can kill somebody who keeps walking into it**, whatever they mean by it: the creature cannot know intent, only that
  they stayed in its space after a warning. This is our reading of the owner's decision ("persistently harasses, crowds, follows, or
  corners it"), not something the owner has confirmed; whether the warning reads clearly enough from above to make it fair can only be
  judged in play. Over 200 seeds, somebody who keeps within 60 px of it for a minute is killed in 157 (`BEHAVIOR_DECISIONS.md`).
* **Circling is measured by their motion relative to its own.** A straight pass cannot count (it sweeps less than half a turn), but the
  creature walking a curve round somebody standing still would count as that person circling it. Its roaming and departures do not
  circle people; the other kinds of pressure count the person's own motion.
* **No reaction while it feeds or while it is in one of Trial 3's engaged plans** (watching, backing away, baiting, guessing, chasing,
  searching). Those already react to the person; pressure still accrues and a warning can follow once it roams or leaves again.
* **No reaction in a skin**, on purpose (`BEHAVIOR_DECISIONS.md`).
* **Sounds turn its gaze but never name anybody.** A person who harasses it only from outside its field of view (behind it, never seen)
  gets looks toward their noise, and no pressure, until it actually sees them.
