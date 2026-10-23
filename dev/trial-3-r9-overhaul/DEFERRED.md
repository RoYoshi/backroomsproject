# Trial 3 R9–R18 — deferred, known limits, owner decisions

**Not owner-approved.** What is not done, what is known to fall short, and the decisions that are the owner's. Nothing here is hidden
elsewhere; each item names where it was found.

## Owner decisions

1. **Acceptance.** Engineering is complete; Trial 3 (R8 and R9–R18) needs your Human QA (`HUMAN_QA.md`). Approval of a part (behaviour,
   art, D) is not approval of the whole, and no approval merges or deploys anything.
2. **Its sight range** stays R8's 760 px. 950 and 1100 were measured (R16e-4, `evidence/r16e/range/`): they break the stealth and
   inference suites (a crouched, still, unlit person at its side seen; PR09/PR10's escapes; C20; SK24) - a longer sight would need those
   promises re-weighed, which is a design decision, not a tuning.
3. **The art** (R14) is interim, procedural and needs your visual approval (`R14_TOPDOWN_ART_REPORT.md` §9: height cannot be seen from
   straight above; a coiled figure 18–30 px behind a view's edge can show a hand or its head; the pounce is long for a third of a second).
4. **Numbers.** Every number (hungers, ranges, latencies, its footwork's band 115–170 px within 400 px, speeds) is unapproved.
5. **Its press** (R16i, R18): R16i's 238 px/s (from the 230–245 you asked to be evaluated) is 260 at R18, in your overtuned range
   (255–265), with its run 270 (your 270 at most) - both under your 285. Whether they feel purposeful and dangerous, or too fast, is yours
   to judge (`HUMAN_QA.md` R1–R4, part 4); each is one number in its species table.
6. **The Wanderer's movement** is R8's and locked (R16i): walk 172, a fresh sprint 285 and every movement mechanic unchanged, proven by
   `s_wandererlock.js`. Nothing here asks you to change it.
7. **R18, the overtuned experiment: what to turn down.** You asked for it too strong, to be balanced after you play it. The values most
   likely to be the first to move, each one number (`DESIGN_DECISIONS.md` R18-2 to R18-9): its speeds (`SKIN.speeds`: roam 160, prowl
   205, investigate 232, press 260, run 270) and the stamina they cost (`SK.runFrom` 215, `SK.drainRun` 11); the hunger lines
   (`SK.huntHunger` .3, `SK.chaseHunger` .45); the standoff's escalation (`SK.escalate` 5 .. 1.2 s); the waits (`SK.roamPause`, `watch`,
   `lure`, `interceptWait`, `searchLook`, `listenLost`); the search's persistence (`SK.searchMax` 20 s, `huntTries` 3-6, `forget` 15-45
   s); the cooldowns after it leaves somebody (`SKP.left`, `SKP.refr`: 8 / 4 / 2 s); its footwork's reach (`SKF.near` 400) and its run-in
   on somebody going away (`SKF.goAway`, `SKF.runIn`); the rush from cover (360 to 450 px by hunger); the far prowl (`farTick`). Going
   back to R17's creature whole is a checkout of three files (`CHANGED_FILES.md`, R18).
8. **The long way round at moderate hunger** (R18-9): hungry (.45-.6) and watched from 600 px, it still goes R13's covert way round
   (about 1,550 px, 7 s out of your sight), and somebody who then walks away is often lost to it (`scene_probe.js --scene walkaway`: 2
   of 6 taken at .55 and .7; 5 of 6 at .8, in 3.6-3.8 s). Coming on openly from afar at .45-.6 would end that flank where PR06, C17 and
   R9-01 judge it (your exposed-ambush report, R9) - whether the flank or the open advance should win there is your call; the blend is
   `sm(.6, .85, h)` in `skDecide`'s approach and flank.
9. **Hiding near its search** (R18-7): a croucher at the east end of PR13's passage is now found by its search 5 of 7 (R16i 0 of 7); the
   west end, 7 of 7 escape. Its search is longer (20 s) and quicker (its prowl and investigation); whether hiding a few hundred pixels
   from where it lost you should still work that often is yours to judge.

## Known limits of R9–R18

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
- **Level of detail**: a creature more than 1900 px from every player thinks less often, and beyond 3800 px is moved coarsely (the
  shared engine's, the Hound's and the Smiler's too; left as it is - PR25). Until R17 a Skin-Stealer there stood where it was; at R18 a
  hungry one prowls by the engine's coarse move at its walk (to where it last perceived somebody, or across the level), fed it waits.
- **Its turning** is the species' own (3.6 rad/s): circled fast, it lags 0.1–0.43 rad behind you and steps sideways less than R16f did
  at 7 rad/s (R16g-5). Below hunger 0.45 (R16i: 0.6) its footwork keeps an approach's pace (never a run); the chase's conditions govern running.
- **Its press** (R16i; 260 px/s from hunger 0.45 at R18, graduated from 232) is for an open approach only, beyond its footwork's range:
  it does not press on a covert way, in a skin, winded, tired, fed, on a lost race's trail, or toward somebody who has not had it on their
  screen within 3 s (R16i: 2 s) and is not moving. "On their screen" is R13's
  model of exposure (a clear line and enough light, whichever way they face); in a lit hall that is most of the time, so there the
  press is its usual open approach. The evaluation is six meetings in one hall (R16i-4), not the whole level.
- **Crossing a low obstacle or a window** it is carried over in a fixed time by the shared engine's vault (`stepTrav`, R8's code, the
  Hound's and the Smiler's too), at up to about 450 px/s for a third of a second (the campaign's crossings, R17-3). A straight,
  unobstructed race is not affected, and a Wanderer vaults the same props (its fast vault takes 0.3 s). Left as it is: the engine is locked
  (PR25, WL05).
- **The drawn head's snap** is checked as the angle each page receives (the campaign's snapshots), not as the pixels drawn; the drawing
  was seen in the videos and screenshots only.
- **Its preemption** acts on prey at hunting hunger (0.3 and up at R18; 0.4 before); below it a person newly seen is noticed (its head) and weighed by the
  ordinary decision, without cutting a plan. A fed creature noticing movement may leave before it has seen who moved (F2).
- **Spotted on its covert way by somebody it cannot see, it leaves** (R13's rule in `skCompromised`: seen by the quarry it can see, a
  hungry one comes on or stands off; seen by somebody it only heard, it goes). Rare in ordinary play (2 of 65 departures in 180 minutes
  from .55, none of 38 from .85: `threat_sim.js`'s `leaveReasons`), but the real pages' hiding scenes show it (S6 failed on it once in five R18 runs; S7's plans "flank >
  leave"). Hunting on from its evidence instead is a one-branch change, left for your decision with the other tuning (R18 changes no R13
  rule it did not have to).
- **The press on the real pages' 12-minute campaign** began once on R18 (three times on R16i in the same session): at 1.6-2 frames a
  second the pages walked into it and were taken close, mostly by strikes from a roam (16 deaths), and fed it roams. Where people move at
  their true speeds (`threat_sim.js`) it presses three times as often as R16i (48 against 16 in 180 minutes) and spends 47 % of its
  engaged time at 218 px/s or more (R16i 16 %) - `DESIGN_DECISIONS.md` R18-11. Your own play is the measure that matters here.
- **Its body on a covert way** turns at up to 1.6 x its turning ability (R13's covert step, `ai.skin.cover.js`): P10 records 5.8 rad/s
  at R18 (5.2 at R16i); its head still turns faster than its body. Left as R13 made it.
- **The headless measurement's people** (`tools/threat_sim.js`, R18-11) answer by a drawn choice per meeting - scripted, not human: they
  never learn, bluff or use the level's geometry as a player would. The numbers compare trees on the same people; they do not predict
  your games.
- **The real pages cannot race it** (R18): a page under SwiftShader covers 70-140 px/s with its keys held (this session's pages drew
  1-2.5 frames a second; R17's 3-4.6), so the threat scene S2 (a fresh sprint) is reported, not judged, and the periphery scene F2 needs
  a page to walk faster than 70 px/s, which a page under about 1.6 frames a second cannot. The race is judged headless (C26, SK22, PR05,
  P18, WL03).
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
