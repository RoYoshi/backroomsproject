# Trial 3 R9–R17 — deferred, known limits, owner decisions

**Not owner-approved.** What is not done, what is known to fall short, and the decisions that are the owner's. Nothing here is hidden
elsewhere; each item names where it was found.

## Owner decisions

1. **Acceptance.** Engineering is complete; Trial 3 (R8 and R9–R17) needs your Human QA (`HUMAN_QA.md`). Approval of a part (behaviour,
   art, D) is not approval of the whole, and no approval merges or deploys anything.
2. **Its sight range** stays R8's 760 px. 950 and 1100 were measured (R16e-4, `evidence/r16e/range/`): they break the stealth and
   inference suites (a crouched, still, unlit person at its side seen; PR09/PR10's escapes; C20; SK24) - a longer sight would need those
   promises re-weighed, which is a design decision, not a tuning.
3. **The art** (R14) is interim, procedural and needs your visual approval (`R14_TOPDOWN_ART_REPORT.md` §9: height cannot be seen from
   straight above; a coiled figure 18–30 px behind a view's edge can show a hand or its head; the pounce is long for a third of a second).
4. **Numbers.** Every number (hungers, ranges, latencies, its footwork's band 115–170 px within 340 px, speeds) is unapproved.
5. **Its press** (R16i): a very hungry one you have seen closes on you openly at 238 px/s, from the 230–245 you asked to be evaluated
   (230, 238 and 245 were measured: R16i-4 - no meeting told them apart). Whether it feels purposeful and dangerous, or too fast, is yours
   to judge (`HUMAN_QA.md` part 4); a different value is one number in its species table, and 255 (its run, under your 285) stays its most.
6. **The Wanderer's movement** is R8's and locked (R16i): walk 172, a fresh sprint 285 and every movement mechanic unchanged, proven by
   `s_wandererlock.js`. Nothing here asks you to change it.

## Known limits of R9–R16i

- **Its footwork** (R16f) is for open moves only: a covert way, a walk in a skin, an exhausted creature and a person standing still and
  unaware are not fought for. Its spring (T4) decides when it strikes, unchanged; the footwork only places it.
- **The bait** (R13) backs off round a corner turning its back, as R13 made it: backing it facing them changed where it lay in wait and
  broke SK21; reverted, no test changed (R16f-3).
- **The edge of its eye** sees movement only (over 70 px/s), within 0.9 rad beyond its view and 600 px, and never who; a person standing
  still there is not noticed (by design: R16e-6, the P probe's "lit, standing").
- **Slipping past it** out of a dead end still succeeds in 4 of 16 probe scenes (R16f-4; 8 of 16 before): a fast, well-aimed runner can
  get by - meant to stay possible.
- **A low wall it cannot pass**: an approach can still stand off at it (R12's latent R8 deadlock; route searches rate-limited, the
  standing itself not solved; R13-14).
- **Exposure to a person it only believes is there** is a soft cost: a covert way may cross where it believes they could see, within
  144 px (R13-14). It cannot see behind itself except in its glances back on a covert way.
- **A covert way the audit refuses** is dropped, not repaired (an open move or another choice follows, labelled; R13-14).
- **Night vision and infrared** (the camcorder) are outside its model of who can see it, by Part 2C's design: a camcorder user may make it
  out where it believes itself unseen (R16-4).
- **An older cached page** draws a Rend's corpse whole (R15-4); the halves read as two halves of the round body at the camera's height,
  not as an anatomical cross-section (R15-10). The admin's D preview does not apply the room rule a natural D does (R15-10).
- **Level of detail**: a creature more than 1900 px from every player thinks less often, and beyond 3800 px sleeps where it stands (the
  shared engine's, the Hound's and the Smiler's too; left as it is - PR25).
- **Its turning** is the species' own (3.6 rad/s): circled fast, it lags 0.1–0.43 rad behind you and steps sideways less than R16f did
  at 7 rad/s (R16g-5). Below hunger 0.6 its footwork keeps an approach's pace (never a run); the chase's conditions govern running.
- **Its press** (R16i) is for an open approach only, beyond its footwork's range: it does not press on a covert way, in a skin, winded,
  tired, fed, on a lost race's trail, or toward somebody who has not had it on their screen within 2 s. "On their screen" is R13's
  model of exposure (a clear line and enough light, whichever way they face); in a lit hall that is most of the time, so there the
  press is its usual open approach. The evaluation is six meetings in one hall (R16i-4), not the whole level.
- **Crossing a low obstacle or a window** it is carried over in a fixed time by the shared engine's vault (`stepTrav`, R8's code, the
  Hound's and the Smiler's too), at up to about 450 px/s for a third of a second (the campaign's crossings, R17-3). A straight,
  unobstructed race is not affected, and a Wanderer vaults the same props (its fast vault takes 0.3 s). Left as it is: the engine is locked
  (PR25, WL05).
- **The drawn head's snap** is checked as the angle each page receives (the campaign's snapshots), not as the pixels drawn; the drawing
  was seen in the videos and screenshots only.
- **Its preemption** acts on prey at hunting hunger (0.4 and up); below it a person newly seen is noticed (its head) and weighed by the
  ordinary decision, without cutting a plan. A fed creature noticing movement may leave before it has seen who moved (F2).
- **Browser evidence** is SwiftShader on two shared CPUs (1–6 frames a second): timings inside a scene are read in snapshot order. Pages
  can stall under that load (the sight scene's first two runs after the long campaign: R16g-7, `REGRESSION.md`). Trial 3's own
  `skin_browser.js` t7 (four pages, one a phone) does not finish here for R8 either: an environment limit (R16-6).

## Inherited, not touched

- **13 failing tests** in `npm test`, the same as R8's record (`evidence/r9/inherited_failures_r8.txt`): Hound P01, P08, H07, NV09, C1, C3,
  C4, C5, C9/C10, C18; lifecycle L9; Smiler 2F F13, F22. Human QA hotfix X03. None involves a Skin-Stealer; none changed.
- **Security** (known separately; not changed, by the brief): the inherited default admin passcode, and the lockout keyed on an untrusted
  `X-Forwarded-For`. Use your own `ADMIN_PASSCODE` for QA. The default passcode also appears as a literal in an older development
  harness, `dev/shadows/harness_lib.js` (last changed at `58fcf5b`, before R8; found by a branch-wide secret scan at R16g; not touched).
- **A caveat from the review**: `skWatched` (R8's helper) reads the facing of a person it sees live between thinks; the footwork calls it
  only for somebody it sees.
- **AP_AUDIT.md** said the October 22 probes agree on R8 and R16b; they do in every probe but C (circling), where R8's facing error is
  the larger (0.92–2.03 against 0.62–1.34). R16g-7 shows both.
