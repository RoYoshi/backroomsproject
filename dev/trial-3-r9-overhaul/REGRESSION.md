# Trial 3 R9–R18 — regression

**Not owner-approved.** Every result below is on this branch's own trees, run on a shared two-CPU Linux machine with Node 22; each
output file is under `evidence/` (named in each row). Nothing was suppressed: the inherited failures are listed by name, every changed
test is in the table below with its reason, and the runs that failed or were repeated are in the last section.

## R18, the tip (the owner's overtuned experiment)

| Suite | Result | File (`evidence/r18/tests/`) |
|---|---|---|
| `s_wandererlock` (the Wanderer's movement against R8, WL01-WL06; WL06 for R18's profile) | 6/6 | `s_wandererlock.txt` |
| `s_skinap` (P01-P18) | 18/18 | `s_skinap.txt` |
| `s_skinstealer` | 34/34 | `s_skinstealer.txt` |
| `s_skinbehave` | 19/19 | `s_skinbehave.txt` |
| `s_skinpredator` | 30/30 | `s_skinpredator.txt` |
| `s_skinsight`, `s_skinmind`, `s_skinroute`, `s_skinr9` | 10/10, 15/15, 15/15, 1/1 | `s_skinsight.txt`, `s_skinmind.txt`, `s_skinroute.txt`, `s_skinr9.txt` |
| `s_skinbody`, `s_skinrend`, `s_skinadv`, `s_skinr16` | 11/11, 8/8, 9/9, 5/5 | `s_skinbody.txt`, `s_skinrend.txt`, `s_skinadv.txt`, `s_skinr16.txt` |
| `npm test` | **330/343** - the same 13 inherited failures by name; the same 343 tests in the same order as R16i's (7 under amended titles: P01, P18, SK06, PR13, PR27, PR29, WL06) | `npm_test.txt`, `fails.txt` |
| Human QA hotfix (synthetic passcode) | 5/6 - X03 inherited | `humanqa.txt` |
| static checks: `build:check`, parts, modules, facts, window contract, docs, the scope gate | PASS | `checks/` |
| the full gate's groups on R18 (`gate.js --tier full --only ...`) | group 1: **21 of 21 PASS**; group 2: cli_mutants, live_wire, bpp_checks, workflow PASS, `browsers` FAIL once (two_browser: Alice's walk never reached Bob - no pushes, no `q` messages) and PASS on its rerun; group 3a: `perf` PASS (lifecycle -1.3 %, deaths +4.6 %, admin +2.5 %, schedule -1.5 % against B++), `suites` FAIL once - `npm test` 330/343 and every other suite on B++'s record, but `audit_net` R1 (its observer had no place for A at that instant: "A at undefined"; the server refused the respawn) - `audit_net` alone again: 13/17 twice on R18 and once on R17, only B++'s four. The client steps (`rgb`, `contact_lab`, `menu`, `chat_browser`, `chat_voice`) were not run again: no page file changed since R17 (`git diff 636f01e -- public src/core src/frameworks/*/client` is empty) | `evidence/r18/gate/` |

Every changed test is in the R18 table below with its reason (none dropped; the loosenings and the retired claim marked). The suites
were run again in full after R18's last code change (the rush from cover, R18-9), with the same results.

## R17's verified tree (R16i `a70137e`; R17 changed no game file)

| Suite | Result | File |
|---|---|---|
| `s_wandererlock` (R16i, the owner's lock: the Wanderer's movement against R8, WL01–WL06) | 6/6 | `evidence/r16i/tests/s_wandererlock.txt` |
| `s_skinap` (the October 22 refinement: P01–P18) | 18/18 | `evidence/r16i/tests/s_skinap.txt` |
| `s_skinstealer` | 34/34 (R8 34/34) | `evidence/r16i/tests/s_skinstealer.txt` |
| `s_skinbehave` | 19/19 (R8 19/19) | `evidence/r16i/tests/s_skinbehave.txt` |
| `s_skinpredator` | 30/30 (R8 30/30) | `evidence/r16i/tests/s_skinpredator.txt` |
| `s_skinsight` (R10, the warning only in sight) | 10/10 | `evidence/r16i/tests/s_skinsight.txt` |
| `s_skinmind` (R11) | 15/15 | `evidence/r16i/tests/s_skinmind.txt` |
| `s_skinroute` (R12, R13) | 15/15 | `evidence/r16i/tests/s_skinroute.txt` |
| `s_skinr9` (R9-01, the owner's exposed ambush; fails on R8) | 1/1 | `evidence/r16i/tests/s_skinr9.txt` |
| `s_skinbody` (R14) | 11/11 | `evidence/r16i/tests/s_skinbody.txt` |
| `s_skinrend` (R15, Execution D) | 8/8 | `evidence/r16i/tests/s_skinrend.txt` |
| `s_skinadv` (R16, the adversarial matrix X01–X09) | 9/9 | `evidence/r16i/tests/s_skinadv.txt` |
| `s_skinr16` (R16, the review's F01–F05, V13) | 5/5 | `evidence/r16i/tests/s_skinr16.txt` |
| `npm test` (every suite in `dev/tests/run.js`) | **330/343** - the 13 inherited failures, the same as R8's by name | `evidence/r16i/tests/npm_test.txt`, `fails.txt` |
| Human QA hotfix (`s_humanqa_hotfix.js`, a synthetic passcode) | 5/6 - X03 inherited | `evidence/r16i/tests/humanqa.txt` |
| static checks: `build:check`, parts, modules, facts, window contract, docs, the scope gate | PASS | (run before the commit; again in the full gate) |
| the full gate's steps on R16i | every step PASS (menu and chat_browser on R16h's identical page; one voice case and one `bpp_checks` replay passed on rerun) | `evidence/r17/gate/` (the section below) |

## The Wanderer's movement (the owner's lock, R16i)

`dev/tests/s_wandererlock.js`, in `npm test` (R16i-2): the constants by value in the server's and the page's `world.js` - walk 172, a
fresh sprint 285, crouch 92, crawl 54, winded 148, the stamina, slide, vault, surface, noise and body-height numbers - each R8's; 23
movement files (the S.P.A.C.E. framework, the surfaces, `move.js`'s other parts, `sim.js`, `sim.step.js`, `server.js`, the built
`move.js`, `world.js` and timing policy) byte for byte R8's, by pinned hashes and by git; the real `move.js` run headless in nine
movements, 6,000 ticks each identical to R8's, reaching 172.0 / 285.0 / 92.0 / 54.0 / 148.0 px/s, a sprint draining 10.50 a second
and winding at 9.50 s, recovery at 36; nothing writes the constants while four starving Skin-Stealers hunt; the Hound's and the Smiler's
species R8's and their code byte for byte; every Skin-Stealer speed under 285. The same file on R8's own tree passes WL01–WL04 (WL05
and WL06 fail there on R15's capture line and the press - what this branch meant to change in what they check), and on R16h's WL01–WL05
(`evidence/r16i/wandererlock_on_r8.txt`, `wandererlock_on_r16h.txt`). No Wanderer movement file changed at any checkpoint.

**The 13 inherited failures** (R8's record, `evidence/r9/inherited_failures_r8.txt`; the same at every checkpoint R10–R18): Hound P01,
P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18; lifecycle L9; Smiler 2F F13, F22. None involves a Skin-Stealer, and the code they test is
R8's (PR25 holds the shared engine and the Hound's and the Smiler's code to it byte for byte, but for R15's one line in `ai.capture.js`
that only a Skin-Stealer reaches). Human QA X03 (dead hover and the switched-off light's QOL in the shipped client) fails on R8 as here.

**Identities.** R8's `npm test` has 245 tests; every one is in R16i's 343 by its id (PR07, PR17, PR25 and SK33 under amended titles: the
table below). The 98 new ones are the new suites' (`s_skinsight`, `s_skinmind`, `s_skinroute`, `s_skinr9`, `s_skinbody`, `s_skinrend`,
`s_skinadv`, `s_skinr16`, `s_skinap`, `s_wandererlock`); no test was added to or removed from R8's suites. R16h's 337 are all in R16i's
by their titles; R16i adds WL01–WL06. R18's 343 are R16i's, by id and in the same order; seven carry amended titles (P01, P18, SK06,
PR13, PR27, PR29, WL06 - each in the R18 table); none added or removed.

**`npm test` by checkpoint** (each `evidence/<checkpoint>/`): R8 232/245 · R10 241/254 · R11 256/269 · R12 262/275 · R13 272/285 · R14
283/296 · R15 290/303 · R16b 306/319 · R16d 315/328 · R16e 320/333 · R16f 324/337 · R16g 324/337 · R16h 324/337 · R16i 330/343 · R18
330/343 - always the same 13 failing.

## The full gate (`npm run gate:full`'s steps, on R16i `a70137e`)

The full tier is 33 steps and takes longer than one command may run here (two hours), so it was run in groups of its own steps
(`gate.js --tier full --only ...`), each with the locked client packages (`TFB_CLIENT_PACKAGES`: the 31 tarballs of
`TFB_V11_LINUX_X64_PACKAGES.zip`). Reports: `evidence/r17/gate/`.

| Group | Steps | Result |
|---|---|---|
| 1 | build, port, lineage, parts, modules, contracts, docs, scope, srv_golden, bpp_golden, session, sim, page, cli_golden, protocol, mutants, static, raw_live, quick_suites, bundle, chat | **21 of 21 PASS** (26 minutes) |
| 2 | cli_mutants, live_wire, bpp_checks, browsers, workflow | **5 of 5 PASS** (13 minutes) |
| 3a | suites, perf | **2 of 2 PASS** (12 minutes): `suites` - `npm test` 330/343, the Human QA hotfix 5/6, `s_ir` 3/3, `test_shadows` 43/48, `test_br_role` 29/32, `interp_test`, `test_3bn` 7/7, `audit_net` 13/17, `audit_net2` 8/11, `ir_net` 4/4: only the failures of B++'s own record fail; `perf` - lifecycle -2.6 %, deaths +4.0 %, admin -1.2 %, schedule +4.2 % against B++ |
| 3b | rgb, contact_lab | **2 of 2 PASS** (23 minutes): `rgb` 16 of 16 checks in Chromium, its mutants 11 of 11 caught; `contact_lab` 23 images byte-identical in pixels |
| 3c | chat_voice | **PASS, one case rerun** - run as its tool's own four parts (`chat_voice_browser.js --only icon\|keys\|type\|voice --mutants 1`, 96 minutes): icon 30/30 cases, its mutants 4/4 caught; keys 15/15, 5/5; type 10/10, 6/6; voice 13/14, mutants 7/7 - `voice_level_follows_volume_and_mute` read the voice's level stuck at its last value (.63) through the volume and mute changes, after 40 minutes of mutants; the voice cases again on R16i and on R8: 14/14 each (`chat_voice_r16i_*`, `voice_cases_r16i_rerun1.*`, `voice_cases_r8.*`). Nothing on this branch touches chat or voice |
| (R16h) | menu, chat_browser | **PASS** on R16h `4d79607` (21 and 40 minutes; `group3_r16h_partial.txt`): R16i changed no page file - `git diff 4d79607 a70137e -- public src/core/client src/frameworks/*/client` is empty - so the page these two steps drive is R16i's byte for byte |

On R16h the first two groups gave the same (21 of 21; the second group 4 PASS and `bpp_checks` once FAIL - one of B++'s 22 placement
replays, an admin "bring" with 80 ms of stale packets, ended 29 px from where its page drew it; run again twice on R16h and once on R8:
PASS each time, and PASS on R16i: `gate_full_group2_r16h.txt`, `bpp_checks_r16h_rerun1.txt`, `_rerun2`, `bpp_checks_r8.txt`). Before
R16h the first group, on R16g, failed three steps that pass on R8 - `cli_golden`, `lineage`, `page` - each bisected to its checkpoint
and fixed at R16h (`DESIGN_DECISIONS.md` R16h; `evidence/r16h/gate/`).

## Every existing test that changed, and why

None was dropped. Each is listed with its reason, which is independent of making it pass (the design note says what was traced);
where an assertion was made looser, the row says so. "Passes on R8 too" means the changed test was also run on the R8 tree.

| Test | Checkpoint | What changed | Why (the invariant kept) | Note |
|---|---|---|---|---|
| `s_skinpredator` PR07 | R13 | **narrower**: flank ticks counted only while the watcher is in the narrow corridor | its claim is "no way round the watcher in the corridor"; out in the hall a covert way may exist (R13 finds one, R8's 2.6 x limit refused it) | R13-11 |
| `s_skinpredator` PR17 | R13, R16 | **broader** at R13: "approaching" accepts R13's honest acts (hidden approach/creep, a covert way's back and intercept, open pace and chase); 12 seeds instead of 8; at least 7 of 12 with both phases (R16, the review: R13 had kept "at least 5") | listening still judged exactly as before; its first approach now often goes on a covert way, so fewer runs reach a pause to listen | R13-11, R16-4 |
| `s_skinstealer` SK21, SK41 | R13 | **a changed scene**: the creature starts 265 px from the person, in their beam, met by their eyes (was 600 px in a dark gap) | the bait must be judged where it is the answer to being seen; from 600 px the person cannot make it out (legibility .23), and R13 goes round under cover instead of creeping into their beam; every T3/T6 rule they check unchanged | R13-11 |
| `s_skinroute` C22 (R12's own) | R13 | 20 runs instead of 12; "the side it heard" includes a look at the very place | more runs end in a kill before a second guess | R13-11 |
| `s_skinpredator` PR23 | R14 | "one source of the drawing scale": one definition and no view scaled by a number of its own (was: at most six mentions of `BODY_SCALE`) | the body uses its one scale in more places; the invariant is checked as itself | R14-8 |
| `s_skinpredator` PR25 | R15 | `ai.capture.js` may differ from 4518f93 by exactly one line (the Skin-Stealer's D in `previewKill`), nothing else; the other seven shared files byte for byte | the clause removed was true for every other creature: the Hound's and the Smiler's expression is the same; pack `06` requires the D preview | R15-9 |
| `s_skinstealer` SK33 | R15 | D accepted, only from a grab (the attacker within grab reach + 6 px at the kill) | the guard against a variant it has no death for; 18 kills before and after, B and A as before, one C now a D where D fitted | R15-9 |
| `s_skinr9` R9-01 (R9's own), `s_skinadv` (its measure) | R16 | **looser by a braking allowance**: a withdrawal begun while moving their way may brake - within its first 0.3 s, up to 10 px closer in all | never a covert way in their sight but a withdrawal straight out of it, and the bearing test, unchanged; traced: -4.7 px in the switch's sample, -0.3 px braking; on R8 R9-01 still fails (230-478 px) | R16-5 |
| `s_skinmind` C14 (R11's own) | R16 | the answers that changed its plan are held to the latency bars on their own (13 of 26, median 0.12 s) | a kept plan was being counted as an answer (the review) | R16-4 |
| `s_skinrend` G08 (R15's own) | R16 | its name says what the rule does (a second D in a row is made rarer, x .35) | the name said "never two in a row", which the rule never promised | R16-4 |
| `s_skinrend` S15 (R15's own) | R16 | falls back to the blob recorded at R15 when git history is missing | it needed git history to run | R16-4 |
| `s_skinbody` P01 (R14's own) | R16 | its bar 70 shapes (was 140) | the measured figure is 55-56; the bar was loose (the review) | R16-4 |
| `s_skinbehave` BR01 | R16e | the passer, once 2.5 s pass without coming level or a wall stops them after passing, walks on the most open way not toward it | R16e's creature sees them at its side and walks on, so a passer making for a point beside it was following it; at most a glance, no strike, warning, chase or hunt, parted at the end - unchanged; passes on R16d and R8 too | R16e-5 |
| `s_skinpredator` PR14 | R16e, R16g | R16e: its precondition counted the run east known by sight or by sound - **a loosening** (the independent review, R16g-5). R16g: R8's assertion again (took the running for theirs in at least 5 of 8, fooled in at least 3, not all caught) over eight seeds that hold its premise - a seed in which it sees the run east is set aside, counted and reported | the test is about a misleading sound; since R16e its head snaps to the footsteps and in some seeds it sees the run - those seeds are not its scene | R16e-5, R16g-5 |
| `s_skinap` P08 (R16d's own) | R16f | the prowl runs 60 s (was 40) | after its footwork followed the first person, 40 s left one or two goals; its invariant (the same until it senses the second person) holds through the minute in all six runs | R16f-4 |
| `s_skinbehave` BR04, BR11 | R16e | the same passer as BR01 (above) - not named at R16e | disclosed at R16g; each run with R16d's passer and with R16e's (below) | R16g-5 |
| `s_skinap` P06 (R16d's own) | R16g | the log text it matches (a tactical plan's log now says what happens) | the invariant - flagged, not cut - is unchanged | R16g-5 |
| `s_skinap` P15 (R16f's own) | R16g | **looser**: facing bar 0.5 rad (was 0.35), sideways in half the scenes (was 60 %) | R16f's bars were its own figures at a facing turn of 7 rad/s, twice the species' `TURNING_ABILITY`; at 3.6 it lags 0.1-0.43 rad (R8 0.62-1.34) | R16g-5 |
| `s_skinap` P15, P16 | R16g | a fight with no clear way to them (remembered now until its next think) is not counted as footwork | what they count is footwork | R16g-5 |
| `s_skinap` P18 (R16f's own) | R16g | its title: circled scenes only | the title overstated its coverage (the review) | R16g-5 |
| `s_skinpredator` PR28 | R16i | its first phase ends once it has spent 3 s on A (was a fixed 4 s); its pass condition unchanged | with the press it reached A sooner and in 3 of 6 seeds was springing on A when the scene took A away - a strike holds its attention, so the premise (its attention free to move to B) failed, not the invariant (A's effort kept in all 6); bounded, 6 of 6 judged on R16i and on R16h's code alike | R16i-5 |
| `r16g_campaign.js` (this branch's tool) check d | R17 | "never faster than its run" excepts, besides the strike's lunge, a run of samples that carries it across a low obstacle or a window (within 70 px of the prop, from one side to the other); every crossing is counted and listed in the verdict | the engine's vault (`ai.entity.js` `stepTrav`, R8's code, every species') crosses in a fixed time whatever its pace - up to 456 px/s for a third of a second; R16i's first verdict failed on exactly these 44 samples (six crossings), none of them its pace | R17-3 |
| `r16g_campaign.js` check a | R17 | a new sighting while it holds a kill (the feed act) or springs (12-14) is counted and not judged as a walk-on | its debug says `roam` when it has no plan, also through a committed kill; R16h's same-session run failed on one such sighting at 55.5 s ("it has P2", act 15, speed 0) - it walked no route | R17-3 |
| `skin_browser.js` (Trial 3's tool) | R16 | two pins: the script's API (R10 `sight`/`sightLog`, R14 `anatomy`) and the SKIN tab's preview buttons (R15's D) | the tool's own record of what exists, out of date | R16-6 |
| `s_skinap` P01 (R16d's own) | R18 | fed is .2 and the never-group is hunger under `SK.huntHunger` (.3) - R16d's fed .3 was under `band[1]` .4; its refractories from `skRefractory` as before (R18's 8 / 4 / 2 s); title amended | the invariant (fed: a person it left is never taken up; hungry: taken up after its refractory, on sight only) at R18's lines. Found with it: at .45 it left the walker again (leave .57 > approach .47) - the walker bonus raised to .9 x drive (R18-9) | R18-9, R18-12 |
| `s_skinap` P02's helper `weighed()` (R16d's own) | R18 | **looser by 0.005 s**: a decision counts as on the tick it first saw them within half the record's precision (was 1e-6) | the decision record's time is rounded to 0.01 s (since R1: `+now.toFixed(2)`); a decision on that very tick (61.3333) read 61.33 and failed P02 (0.45 of 3 on the tick) | R18-12 |
| `s_skinap` P03 (R16e's own) | R18 | the person appears once it has roamed 170 px (was at 2 s) | R18's roam (160) took it 280 px by 2 s and the person's spot fell in the arena's wall: they could not walk, nothing moved at the edge of its view (R16i: 57 px walked, its periphery fired, seen at 0.75 s); the rule (skPeriph) unchanged | R18-12 |
| `s_skinap` P13 (R16e's own) | R18 | the sprint starts once it has roamed 440 px past the person (was at 1 s) | R18's roam put it 510 px off at 1 s; the one run sound reached it at .153, under its look threshold .195 (R16i: .284 at 442 px) - the scene's distance restored, the rule (skCurious) unchanged | R18-12 |
| `s_skinap` P17 (R16f's own) | R18 | **restated, and stronger**: the reversal comes during a fight (from 3 s, once it has fought 0.3 s on end; R16f reversed at 3 s whatever it did); a step is sideways motion over 40 px/s (P15's own); fooled = its first clear step after the reversal is the old way; answered = a clear step the new way within 1 s; a fight broken off before then is listed, not judged; **added**: its read of their motion reckons them going round the new way no sooner than 0.08 s after (0.27-0.3 s measured) | R18's quicker footwork was often between two fights at 3 s (3 of 8 runs had none at the reversal, 2 began one after it). Mutation: `SKF.tau` .004 (a near-perfect read) fails the new check - its feet alone (momentum) still passed the stepping part | R18-6, R18-12 |
| `s_skinap` P18 (R16f's own) | R18 | "running fast" is its own speed over `SK.runFrom` (215; was its covered speed over 200); title: its run 270 | the owner's prowl band (195-215) costs no stamina; the claim (finite stamina, no speed above its run) unchanged | R18-2 |
| `s_skinstealer` SK06 | R18 | split: fed (.1) it waits as before; hungry (.7) it prowls coarsely (1,277 px in 8 s) with no record of anybody; **added**: the same world with the person elsewhere (also far) gives the same far prowl tick for tick; title amended | R8-R16i waited far from everyone whatever its hunger; the owner's §6 ("planning states that keep the creature stationary"). The invariant - nothing about a person it has not perceived - is now checked directly | R18-4 |
| `s_skinstealer` SK11 | R18 | its second running phase goes on until it is exhausted (at most 12 s; was 8 s); the exhausted cap against `speeds.spent` | R18's 11 a second from full takes 9.1 s (R8-R16i's 14, 7.1 s); exhaustion's crawl is its own speed now (R8-R16i its roam) | R18-2 |
| `s_skinstealer` SK22 | R18 | the fresh race: "out of breath" accepted beside "losing the race" as the chase's end; winded: judged by its closing (40-42 px, within its spring) by a chase or an open approach at its press | at 270 the gap grows 15 px/s, `chaseLose` (170 px) takes 11 s and its breath gives out at about 7 s; the straight pursuit no longer loses ground by swinging. The fresh runner still wins, the winded one is still closed on | R18-2, R18-6 |
| `s_skinstealer` SK23 | R18 | 20 seeds (was 8) | same rule; R18's quicker way to its spot sees the doubled-back runner again in most runs (neither right nor wrong by the test's own rule): 8 seeds gave 1 run that waited in vain, the test needs 3; with 20: the law 20 of 20, 3 waited in vain | R18-12 |
| `s_skinbehave` BR05 | R18 | fed is .2 (was .3) | under `SK.huntHunger`: at .3 R18's cooldown is `SKP.left`'s 8 s, not the fed `SK.cooldown` | R18-3 |
| `s_skinbehave` BR06 | R18 | 8 seeds (was 4) | R18's roam turns it round to a person standing 260 px behind it in most "behind" runs - then seen (sensed, reported). 16 of 32 blind runs identical to nobody there (the test needs 12) | R18-12 |
| `s_skinbehave` BR10 | R18 | 6 seeds (was 3) | a fed one withdraws at 160 px/s (R8-R16i 105) and is caught at a corner less often: 3 seeds gave 2 premise runs of 9 (needs 3); 6 seeds 6 of 18; sprung through a solid 0 times, every defensive kill at contact | R18-12 |
| `s_skinbehave` BR19 | R18 | the far guard 1000 px (was 1500) | left alone, R18's walk took it 4,500 px in 30 s, 1,306 px from the south-west Smiler in the last second; the one creature-creature channel is the engine's separation of bodies in contact (about 45 px); the trace is identical | R18-12 |
| `s_skinbehave` BR20 | R18 | the presser runs to catch up when over 160 px off (as `persist` does) | a fed one leaves at 160 px/s; a walking presser closed 350 px only to about 200 in 5 s - no pressure in 3 of 5 seeds (the premise); now 0.32-0.57, every stale state goes | R18-12 |
| `s_skinpredator` PR02 | R18 | "followed" = within 300 px and moving toward them faster than 20 px/s | seed 5 counted 29 samples of it standing still at its departure's look while the person walked away (228 to 295 px) | R18-12 |
| `s_skinpredator` PR04 (B) | R18 | the person runs to the gap (then torch off, crouched, silent - as before), and a run is judged only if they got out of its sight alive | walking, R18's starving one (800 px off) took them in about 6 s before they were out of sight, 7 of 8 (none judged); now 7 judged, gave up in 6 (the 7th saw them crouched at the passage's end at 56 s - by sight) | R18-12 |
| `s_skinpredator` PR11 | R18 | 16 seeds (was 8) | R18 often reaches its guessed interception 1,000-1,050 px east and waits there while they run back west beyond their footsteps' reach: 8 seeds gave 4 that heard them (needs 5); 16: the law 16 of 16, heard 7, turned 7, silent 0 | R18-12 |
| `s_skinpredator` PR13 | R18 | **looser at the east end**: every run gives up for a stated reason **or finds them by its own sight first** (was: gives up); the evidence law 8 of 8 and the west end (7 of 7 give up) as before; title amended | R18's longer, quicker search (20 s, its prowl) comes upon the east-end croucher 5 of 7 (R8-R16i 0) - by its own sight, never through a wall. The rate is an owner's tuning item (`DEFERRED.md`) | R18-7 |
| `s_skinpredator` PR17 | R18 | its head judged phase by phase: a listen whose head sweeps 0.1 rad or more, or is over 0.1 for most of it (R8's per-tick test alone) | R18's lost listens are 0.3-0.8 s and the sway starts where the head is (-0.06 to 0.27 in 0.4 s, mostly under 0.1); 9 of 12 with both phases, the head turned in 84-100 % | R18-12 |
| `s_skinpredator` PR20 | R18 | the one who hides runs on round the corner in one route (was: `p.go` to the hall's end, then the route) | the harness's arrival is a coast to a stop no runner makes; R18's straight pursuit closed during it and saw them crouch round the corner 1 s later, 5 of 8. Let go 7 of 8 now; the hiding phase begins at the hall's end | R18-12 |
| `s_skinpredator` PR27 | R18 | **a claim retired** by the owner's directive: "once winded, never closed on while they walk" - now reported (how near, seconds closing, seconds of that out of its sight); kept: the race part (while they run fresh, never closer than when the race was lost), only a person who stops is reached (8 of 8), it keeps to their trail (8 of 8); title amended | the owner's §2 ("pursue vulnerable, walking, exhausted") and "walking away should not trivialize it"; a fresh runner still wins (the part kept) | R18-1, R18-12 |
| `s_skinpredator` PR29 | R18 | hunger .55 (was .95); title amended | a starving one's cooldown is now 2 s (`SKP.left`), over before `SK.leaveDwell` (2.5 s): at .95 the two stepped in with no cooldown left - neither branch of the test (0 of 6). At .55: an 8 s cooldown, kept 6 of 6, still left alone 6, taken up 0 | R18-7 |
| `s_skinroute` C22 (R12's own) | R18 | **looser**: silently, no sound re-weighs its ways (fit below or gain 0.15 or more: the test's own measure) - was: no sound checked at all | R18's `heardMin` .08 takes a footstep of the walk before the fork in 2 silent runs (.09; fit 4 of 4, gain .01): heard, and changing nothing | R18-4 |
| `s_skinroute` C23 (R12's own), its trace | R18 | the engine's level of detail is the trace's last field, and "the same until sensed" stops where it differs (as `s_skinadv` and SK23 already do) | seed 44 alone: mid tier from tick 624 in one world; the traces 0.2 px apart from 1066 | R18-12 |
| `s_skinroute` C24 (R13's own) | R18 | the tired twin is made tired from the tick before its rested twin chose its interception (the worlds the same until then; was: from the start) | R18's tired cap (190) under its approach paces put it elsewhere at the glimpse (seed 1: rested 720 px, tired 672 px from a different place); now tired leads all farther, or none (too late); slack 0 or more | R18-12 |
| `s_skinroute` C26 (R13's own) | R18 | its fastest at most `speeds.run` + 1 (was 256: R8-R16i's 255 + 1) | its run is 270; the fair race otherwise as before (369 px or more, 705-759 apart) | R18-2 |
| `s_skinadv` X01's measure (`exposureWatch`) | R18 | **looser**: the switch sample's braking allowance is max(10, v0 x 0.1 + v0^2 / 2a + 2) px within max(0.3, v0 / a + 0.1) s, v0 its speed then or in the sample before, a its acceleration (760) - was 10 px in 0.3 s (R16-5) | R18's run ended an open approach at about 130 px/s: 13 px in the switch sample. Then 0 bad exits in 12 runs; a covert way's every step in their view is still judged | R18-12 |
| `s_skinr16` F02 | R18 | **added** SK23's interception scene (A and B, 20 seeds, hunger .6) to the real runs' waits | R18 approaches, flanks, lures or retreats in the long-hall scenes: 0 waits in 108 probe scenes (R16i waited in an ambush at .55, 279 samples) - no sample to judge; now 309 samples in 8 runs, 0 with any part of it made out | R18-12 |
| `s_wandererlock` WL06 (R16i's own) | R18 | rewritten for R18's profile: roam 140-175, prowl 195-215, investigation 225-240, press 255-265, run at most 270, stealth paces slow, the press and the run over `runFrom` and the prowl not, its most under a fresh sprint (was: R8's eight speeds and a press of 230-245); title amended | the owner's directive moved its speeds; the lock on the Wanderer (WL01-WL05) unchanged and passing | R18-2 |
| `r16g_campaign.js` (this branch's tool) F1, F2 | R18 | F1: the creature placed 300 px from the page (was 350) and the page runs at once (was after 1 s); F2: the page stands once the creature is 1.36 rad past it (x 5330; was 5520, 1.8 rad), a page that began to walk beyond the edge of its eye (over 2.15 rad) or inside its view is a premise not met, set again with the start moved by that try's own lag | a page at 1-2 frames a second begins to move 1-3 s after it decides to; at R18's walk (160; R16i 105) the creature was 850 px off when F1's page ran, and 2.33-2.39 rad past F2's page when it stood. The judgements (head before body, movement before sight, the page begun outside its view) unchanged | R18-12 |
| `r16g_campaign.js` crouch, threat scenes (new at R18) | R18 | the crouch key is held until the page's own state changes (was a 60 ms tap); each threat scene begins with page A standing; S7, S9 and S13's roams begun toward the page, and a scene whose premise did not happen (never saw them, nothing heard) reported as not judged; its fastest excepts the engine's crossings (R17's check d rule, listed); S2 not judged where the page could not sprint (under 265 px/s with its keys held), S13 where the page was caught before its breath ran low | a 60 ms tap fell between two frames and left the page crouched from S6 on (the threat runs of October 23, kept as superseded); at R18's walk the creature was gone east before S7's, S9's and S13's page had been seen or heard; under SwiftShader a page covers 70-140 px/s - the race and its breath against true runners are judged headless (C26, SK22, PR05, P18, `threat_sim.js`) | R18-11, R18-12 |

Tried and not kept: R16f's bait backing to its spot (SK21 fell to 5 then 4 of 7; the change was reverted and SK21 was not touched,
R16f-3).
At R18: the open advance from .45 at any distance (it ended the bait - SK21 0 of 24, SK41 0 of 32 - and took SK16's watcher at .58:
narrowed to very hungry and from afar, R18-9); `SKF.cut` .65 (no difference to P17; .55 kept); `SKF.near` 340 against 400 (the same).

## Runs that failed, were repeated or were set aside

Each is kept where its files are named; none is counted as a pass.

| What | Where it happened | What was found | Kept |
|---|---|---|---|
| `skin_browser.js` (Trial 3's own tool) t4 | R16 | first try: the admin unlock blocked by the game's own "caught" overlay (a Hound caught the page during its setup); passed on its second try | `evidence/r16/browser/skin_browser_r16_t4_*` |
| `skin_browser.js` t7 (four real pages, one a phone) | R16 | never finishes here: the fourth page does not boot within 100 minutes on two CPUs with SwiftShader; R8's t7 does not finish either (25 minutes, the same wait) - an environment limit, not a regression | `skin_browser_r16_full_run_t7_timed_out.txt`, `skin_browser_r8_t7.txt` |
| sight range 950 and 1100 px | R16e | the stealth and inference suites break (P14, PR09, PR10, C20, P09, SK24 at 950; X05, C08, C21, PR14, PR30 too at 1100); 760 kept | `evidence/r16e/range/` |
| R16e's first tree | R16e | BR01, PR13, X01 and PR14 failed: each traced (R16e-5) and fixed in the code, or in a test's script or precondition (the table above) | `evidence/r16e/` |
| R16f's bait backing to its spot | R16f | SK21 fell to 5 then 4 of 7; the change was reverted and SK21 was not touched | R16f-3 |
| the focused real-page scenes, while they were built | R16g | F2 first placed its page 4,000 px away (the creature slept) and then by teleport (itself a jump the creature noticed); F4's 4 s window was too short for a flank; F5 and F6 passed on a page caught early. All restaged or made void (R16g-2, R16g-3); the final run is 7 of 7, each on its first try | `evidence/r16g/browser/focused_r16g.*` |
| the continuous campaign, runs 1 and 2 | R16g | check c (a sighting without a line from the person's page) failed 11 of 501 and 16 of 332, check d once (12 samples): the measure's own misalignment (R16g-6), corrected; the final run passes every check | `continuous_run1_superseded.txt`, `continuous_run2_superseded.txt`, `continuous_r16g.*` |
| the review's fixes, first suite run | R16g | P06 (its log text), P15 and P17 failed; P06's text and P15's bars changed with their reasons (the table above); P17 passed once the approach's run was gated by the chase's conditions | `evidence/r16g/tests/` |
| the sight-only warning on real pages | R16g | runs 1 and 2, straight after the 12-minute campaign, failed 6 of 12, all on page A, whose camera never came to where it stood (no thump, sting or Hound vignette at all on A); the same runtime files on another tree, and R16e's and R16f's trees, passed; runs 3, 4 and 5 here passed 12 of 12 | `sight_r16g_try1` ... `try5` |
| the full gate on R16g, first group | R16g | `cli_golden`, `lineage` and `page` failed; each passes on R8, and was bisected (R10, R10, R11) and fixed at R16h (R16h-1, R16h-2) | `evidence/r16h/gate/` |
| the sight-only warning on real pages | R16h | its first run, straight after `npm test`, failed 6 of 12 on page A as R16g's first two did; the next two passed 12 of 12 | `evidence/r16h/browser/sight_r16h_try1..3` |
| R16i's first evaluation and suite run | R16i | run on a scratch tree whose build was a step behind its source (the press without `SK.pressShown`): every press number and suite rerun on the final build - the same numbers, and the same single failure (PR28, R16i-5), whose scene was then bounded | `evidence/r16i/` (the final runs only) |
| the full gate's `chat_voice` on R16i | R17 | its `voice` part: 13 of 14 cases - the level case read a stuck level after 40 minutes of mutants (its mutants all caught); the voice cases again: 14/14 on R16i and on R8 | `evidence/r17/gate/chat_voice_r16i_voice.*`, `voice_cases_*` |
| the full gate's third group on R16h | R17 | menu and chat_browser passed (21 and 40 minutes); stopped at the start of chat_voice, which with its 22 mutants cannot finish within one command's two hours after them; the rest run on R16i, whose page is R16h's byte for byte | `evidence/r17/gate/group3_r16h_partial.txt` |
| the focused scenes on R16i | R17 | F6 (a feint) failed on the first run: after the page's reversal it kept its old sideways way 400 ms, then sprang (its strike, which the scene does not count as an answer) and recovered past the window; F6 alone twice more on R16i (answered 500 and 450 ms) and twice on R16h (550, 450 ms): PASS. No press in it (it stays within 340 px); the first run is kept | `evidence/r17/browser/focused_r16i.*`, `f6_*` |
| the continuous campaign on R16i | R17 | its first verdict failed check d (44 samples over 255 px/s: six crossings of window W2 and low obstacle L1, the engine's vault); with check d corrected (above) the same record passes every check | `continuous_r16i.txt` (first verdict), `continuous_r16i_judged.txt` |
| the continuous campaign on R16h (the same session, for comparison) | R17 | its first verdict (R16h's own copy of the tool) failed check a once (a sighting during a committed kill) and check d on 28 samples (four crossings, the engine's vault) - with both checks corrected the same record passes every check | `continuous_r16h.txt`, `continuous_r16h_judged.txt` |
| the post-push secret scan of R16g | R16g | run once without `--base`, it scanned the whole branch against `stage-3h` and flagged the inherited default admin passcode in `dev/shadows/harness_lib.js` (last changed at `58fcf5b`, before R8: `DEFERRED.md`); with the base R16f, as every other checkpoint's, the 78 files of the commit are clean | `evidence/r16g/secret_scan_r16g_post.txt` |
| R18's suites while its code was corrected | R18 | nine rounds: P17 (the side it swung to), P10 (a curious listen's body), SK32 (its band behind a runner), P01 (the walker), SK21/SK41/SK16 (the open advance too broad), and after the real pages' S3 the rush from cover - each traced to its cause and fixed in the code, or the test's premise restated with its reason (the R18 table). The final round of every suite and `npm test` ran after the last code change | `evidence/r18/tests/` (the final runs); `DESIGN_DECISIONS.md` R18-6, R18-9 |
| the threat scenes, first runs (R18 before its last code change, and R16i) | R18 | R18 8 of 13 (S2 not judged), R16i 5 of 13 - and from S6 on page A was left crouched (S6 and S7 end crouched; a 60 ms tap of the crouch key falls between two frames of a page drawing 1-2 a second), so later scenes ran with a crouched page in the dark. Superseded | `evidence/r18/browser/superseded/threat_r18_run1.*`, `threat_r16i_run1.*` |
| the focused scenes, first run | R18 | stopped at F4: R18's last code change was built while its server ran, so it tested neither build cleanly. Superseded | `superseded/focused_r18_run1.txt` |
| the threat and focused scenes, second runs (R18's final code) | R18 | threat 6 of 13 - the crouched page again from S7 on; focused 5 of 7 - F2's page stood 2.09 rad past it, and F7's page B stayed crouched (the same key). The crouch key now held until the page's state changes, each threat scene begun standing. Superseded | `superseded/threat_r18_run2.*`, `focused_r18_run2.*` |
| the threat and focused scenes, third runs (R18, R16i) | R18 | threat R18 7 of 13, R16i 6 of 13: S7, S9 and S13 on R18 never met the page (at R18's walk it was gone east before the page had been seen or heard); focused R18 5 of 7, R16i 5 of 7: F1's page ran 850 px behind it, F2's stood 2.33 rad past it in three tries. Their roams begun toward the page, F1's creature nearer, F2's start moved by each try's lag; a premise not met reported. Superseded | `superseded/threat_*_run3.*`, `focused_*_run3.*` |
| the final real-page runs | R18 | threat R18 9 of 13 (S3, S6 failed; S2, S13 not judged), R16i 7 of 13; a third R18 run with video 8 of 13; focused R18 4 of 7 (F2, F6, F7), R16i 6 of 7 (F6) - each failure described in `BROWSER_AND_MEDIA.md` and none hidden | `evidence/r18/browser/` |
| the continuous campaign on R16i, this session | R18 | check d failed on R16i: three samples of a 42 px jump back and forth at 514.7 s (2,520 px/s in one), 3.5 s after its crossing of L3, its plan roam - its place corrected by the shared engine, not a pace; R17's run of the same tree passed every check. R18's run of the same session passed every check | `evidence/r18/browser/continuous_r16i.*` |
| the full gate on R18, group 2 `browsers` | R18 | two_browser failed once: Alice's page (Bob's at 139 ms a frame) never pushed against Bob - no server pushes (`q` 0), Alice drawn 2.9 px from him; the step alone again on R18: PASS (two_browser ok, 100 frames). R18 changes no page or network file | `evidence/r18/gate/gate_full_group2_r18.*`, `two_browser_r18_group2_failed.json`, `browsers_r18_rerun1.*` |
| the full gate on R18, group 3a `suites` | R18 | `audit_net` R1 failed once (12/17): the observer held no place for the player at the instant it looked ("A at undefined"), while the server refused the respawn as it should ("told to stay"); `audit_net` alone: 13/17 twice on R18, 13/17 on R17 - B++'s four, nothing new | `gate_full_group3a_r18.*`, `audit_net_r18_group3a.txt`, `audit_net_r18_rerun1..2.txt`, `audit_net_r17_rerun1.txt` |
