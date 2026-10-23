# Trial 3 R9–R18 — changed files

Every file this branch changes against R8 (`f378049`), by checkpoint, with why. Built outputs are listed with the source they are built
from (`npm run build`; `npm run build:check` proves them). Development files (`dev/`) are listed by folder.

## R9 — audit (no game change)
- `dev/trial-3-r9-overhaul/` (new): `R9_AUDIT.md`, `CHECKPOINTS.md`, `inventory/remote_heads_before.json`, `evidence/r9/`, tools
  (`repro_r9.js`, `diag_route_r9.js`, `qa_sight.js` test-only, `r9_browser.js`, `qa_server.js` test-only, `verify_remote_r9.py`).
- `dev/tests/s_skinr9.js` (new): R9-01, the reproducer (fails on R8 by design; not in `run.js`'s default list until it passes).

## R10 — the Skin-Stealer's dread only in sight (client)
| File | Kind | Change |
|---|---|---|
| `src/frameworks/spacious-audio/client/skin.sight.js` | new part of `public/assets/skinstealer.js` | the page's own sight of each undisguised Skin-Stealer (on screen, sight mask by `__api.Uc`, readable by `__api.Ul` ≥ .25), its envelope `ks`, the sting's arming and gap, `sightLog` |
| `src/frameworks/br-r/client/skin.compose.js` | source | composes the new module (`skinSight({ head, mirror })`) |
| `src/core/client/mp.frame.js` | source | asks `window.__skin.sight()` once a frame; heartbeat on `max(k, ks)`; the Skin-Stealer's sting (not within 1.2 s of the `k` sting); every `k` output unchanged |
| `src/build-recipes.json` | build | the new part, before `skin.compose.js` |
| `public/assets/skinstealer.js`, `public/mp.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md`, `src/frameworks/spacious-audio/README.md` | generated doc tables | `node dev/tools/docs/docs.js` (the new part listed) |
| `dev/tests/s_skinsight.js` | new suite, in `run.js`'s default list | V01–V06, V08, V09, V11 (the built script in a VM), V12 (R8's `mp.frame.js` against this one, frame by frame) |
| `dev/tests/run.js` | test list | `s_skinsight.js` added |
| `dev/trial-3-r9-overhaul/fixtures/mp.frame.f378049.js` | test fixture | R8's `mp.frame.js` byte for byte (git blob `d478c2b`, checked by V12) |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js`, `qa_server.js` | dev tools | the two-page `sight` scene (each page in its own browser), the test-only disguise placement |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md` | doc | R10-1 … R10-7 |

## R11 — its mind: attention, events, opportunism, belief (server)
| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skin.mind.js` | new part of `generated/server/ai.js` | `skExposedTo` / `skLegible` (could a person see it, by the client's sight-mask and legibility rules on the server's level), `skObsOf` (an observer as it knows them: seen, or a belief), the per-think events with their answers (`skMindTick`, `skMindKept`), the evidence log (`skMindLog`), `skMindDbg` |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | `e.mind` (made at spawn, cleared with it); the mind ticks first on each think; R11 constants (`watchHungry`, `gazeFar`, `ackEyes`, `ackCome`, `ackLook`, `ackOver`, `ackHead`); a hungry look is shorter; the lit-and-watched leave weight follows `hm`; first-sight acknowledgement (`skAttend`) and the salience gaze / look over the shoulder (`skGaze`); decisions that keep their plan answer their events; the hunt's evidence log; `mi` and `ht.log` in its debug |
| `src/frameworks/overseer/client/ents.debug.js` | source (admin overlay, debug mode only) | the `MIND` lines: who could see it, its events and answers, (selected) its evidence |
| `src/build-recipes.json` | build | the new part, before `ai.skinstealer.js` |
| `generated/server/ai.js`, `public/ents.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md`, `src/frameworks/nani/README.md` | generated doc tables | `node dev/tools/docs/docs.js` (the new part listed) |
| `dev/tests/s_skinmind.js` | new suite, in `run.js`'s default list | C01–C15 |
| `dev/tests/run.js` | test list | `s_skinmind.js` added |
| `dev/trial-3-r9-overhaul/tools/c15_hashes.js`, `fixtures/c15_r8.json` | dev tool, test fixture | C15: per-second snapshot hashes, no Skin-Stealer, three seeds; the fixture made on R8 `f378049` |
| `dev/trial-3-r9-overhaul/tools/trace_r11.js` | dev tool | the state traces with reasons (`evidence/r11/trace_r11.txt`): plan, act, why, head, who could see it, events and their answers, evidence |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r10/` (receipt, scans), `evidence/r11/` | docs, evidence | R11-1 … R11-7; R10's receipt |

## R12 — its inference: the ways a quarry could have gone (server)
| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skin.infer.js` | new part of `generated/server/ai.js` | `skHypList` (the ways on from a place and heading: every opening at the first block, walked on without a draw), `skHyps` (anchored on a sighting; priors; disproved by empty places on a way's own stretch), `skHypHeard` (a sound re-weighs the ways; far worse ones rejected), `skHypOf` / `skHypAt` (the way a place lies on; where they would be along a way), `skHypDbg` |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | a sound taken for theirs is weighed against the ways first; `skGuess` keeps R8's candidates and draws, labels each with its way, weighs it by that way's probability, refuses one on a ruled-out way, adds a guess along a likely way none lies on, discounts a far or very uncertain place, records the rejected rivals with reasons; the interception on losing sight and its correction are labelled and refused on a ruled-out way; tallies `hypBuild`, `predQ`, `pathQ`; within its stopping distance an approach re-plans a used-up route at most twice a second (a latent R8 re-planning storm the R12 runs exposed); debug `ht.hy`, `ht.rj` |
| `src/frameworks/overseer/client/ents.debug.js` | source (admin overlay, debug mode only) | the `WAYS` line (each way, its likelihood, the one its guess lies on, ruled-out marks) and, selected, the reasons and the rejected rivals |
| `src/build-recipes.json` | build | the new part, after `ai.skin.mind.js` |
| `generated/server/ai.js`, `public/ents.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md`, `src/frameworks/nani/README.md` | generated doc tables | `node dev/tools/docs/docs.js` |
| `dev/tests/s_skinroute.js` | new suite, in `run.js`'s default list | C20–C23, R12-A, R12-B (R13 adds C16–C19, C24–C27) |
| `dev/tests/run.js` | test list | `s_skinroute.js` added |
| `dev/trial-3-r9-overhaul/tools/trace_r12.js` | dev tool | the inference traces (`evidence/r12/trace_r12.txt`) |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r11/` (receipt, scan), `evidence/r12/` | docs, evidence | R12-1 … R12-7; R11's receipt |

## R13 — its cover: covert ways, the withdrawal and the hidden run, caught on the way, honest open moves (server)
| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skin.cover.js` | new part of `generated/server/ai.js` | `skWatchers` (the views it knows of: seen, seen a moment ago, heard since, unnamed footsteps; its quarry's from belief), `skExposedNow` / `skCaught`, `skCovertWay` (the withdrawal; A* with views impassable; the point-by-point audit and its reasons), `skCovertFollow` (its own steering along a covert way), `SKC`; (R13-13) a search never visits a cell no acceptable way could pass through, shares its cost memo with the other searches of the same decision, and tests the line of sight first |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | "seen" = eye contact or in their view; flank spots near enough to spring from, out of view (behind something or unmade-out in the dark), each asked for a covert way (`skFlankSpot`, its own stream for R13's searches); covert moves (`skCovertStep`: phases, speeds, glance back, stuck); caught on the way (`skCompromised`: duck once, open and committed, stand off, go; the place remembered); from cover (`skFromCover`: nearer, rush, ambush, then hunt on); the ambush plan; covert or open approaches and interceptions (`skInterceptWay`; the waiting spot hidden from four points of their way); decision weights (open approach, opportunity within a leap, no flank round a runner, waits not drawn out); a strike answers events; arrivals into reach count as having come; the hunger band in the open-approach reason; `cv` in its debug |
| `src/frameworks/nani/server/ai.skin.mind.js` | source | `skMindKept` takes how it answered (a strike); its header lists what the cover part uses |
| `src/frameworks/nani/server/ai.skin.infer.js` | source | a sound's check records where it was (`heard.x/y`, for the overlay and C22) |
| `src/frameworks/overseer/client/ents.debug.js` | source (admin overlay, debug mode only) | the `MOVE` line: covert / open / feint / withdraw, a covert move's phase and way, the last cover reason |
| `src/build-recipes.json` | build | the new part, after `ai.skin.infer.js` |
| `generated/server/ai.js`, `public/ents.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md`, `src/frameworks/nani/README.md` | generated doc tables | `node dev/tools/docs/docs.js` |
| `dev/tests/s_skinroute.js` | suite | C16–C19, C24–C27, R13-A added; C22 widened (R13-11) |
| `dev/tests/s_skinr9.js` | suite | its header: R9-01 now passes |
| `dev/tests/run.js` | test list | `s_skinr9.js` added (R9-01, the owner's exposed ambush) |
| `dev/tests/s_skinpredator.js` | suite | PR07, PR17 adapted (R13-11) |
| `dev/tests/s_skinstealer.js` | suite | SK21, SK41: the bait scene starts the creature where the person sees it (R13-11) |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js` | dev tool | flankwatch reads the server's move modes and phases (covert, its withdrawal, open, feint) |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r12/` (receipt, scan), `evidence/r13/` | docs, evidence | R13-1 … R13-14 (R13-13: the covert search's cost, measured and fixed); R12's receipt; the real-page flankwatch after (`evidence/r13/browser/`) |

## R14 — its body drawn top-down (client drawing only)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/br-r/client/skin.body.js` | source (part of `public/assets/skinstealer.js`) | the body as a 3-D skeleton seen from above (`AN`, `SEC`, `POSE`, `rig`, IK), posed from the server's act, speed and head; centred on its position; a short shadow clamped at walls; the skin's fold; seeded tics and hair; redraw keys for still figures; `window.__skin.anatomy` (`AN`, `POSE`, `rig`, `settle`) for the report and its tests |
| `src/frameworks/br-r/client/skin.kill.js` | source | the attacker's grip from the death's physics (distance to the victim, the neck's height over time), C's jaw; imports `BODY_SCALE` |
| `public/assets/skinstealer.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `dev/tests/s_skinbody.js` | new suite, in `run.js`'s default list | G01–G06, M01, K01, D01, P01, S01 |
| `dev/tests/s_skinpredator.js` | suite | PR23: "one source of the scale" checked as itself (R14-8) |
| `dev/tests/run.js` | test list | `s_skinbody.js` added |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js` | dev tool | gallery: `--only places`; places on the real page (a wall, a passage, the dark torch off / on, a lamp's edge, a skin), the view's edge (with / without, counted), the page's own draw time with four figures |
| `dev/trial-3-r9-overhaul/tools/art_lab.js` | new dev tool | the page's own script drawn to an SVG/PNG lineup: acts × eight headings beside a Wanderer |
| `dev/trial-3-r9-overhaul/R14_TOPDOWN_ART_REPORT.md` | report | anatomy, pose map, images, collision / sorting audit, cost, limitations — **visual approval pending** |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r13/` (receipt, scan), `evidence/r14/` | docs, evidence | R14-1 … R14-8; R13's receipt |

## R15 — Execution D, the Rend (shared G.I.B. physics, the wire, the clients, the server's choice)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/gib/shared/dphys.js` | source (G.I.B.'s shared physics: `public/dphys.js`, `generated/server/dphys.js`) | `CFG.SkinStealer.D`, `DURS.SkinStealer.D`, `PLAN('SkinStealer','D')`; `prepare()` takes it; `rendShapes`, `rendSeed`, `shapesOf`, `rend`, `stepRent`; a rent body hidden in `frame`, its headlamp on the bigger half, its halves in `gibRecord` and `remains` — every other death step for step R8's (G12) |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | `capture.variants` + D (`skRendW`: a grab, hungry, room either side; else nothing); `commitDur.D` |
| `src/frameworks/nani/server/ai.capture.js` | source (shared capture) | one line: `previewKill` no longer refuses the Skin-Stealer's D (S15) |
| `src/frameworks/overseer/server/admin.js`, `src/frameworks/overseer/client/mp.admin.js` | source (OVERSEER) | the same `preview` command with A–D for the Skin-Stealer; the DEATHS tab's D button |
| `src/frameworks/bpp/client/net-wire.js` | source (B++ wire) | a Skin-Stealer corpse's two pieces kept (exactly two); a NEW RUN's as before |
| `src/frameworks/gib/client/gore.js`, `src/frameworks/gib/client/mp.deaths.js` | source (G.I.B. client) | a record's pieces from `shapesOf(cause, gs)`; a replay adds the halves at the rend |
| `src/frameworks/br-r/client/skin.kill.js`, `skin.body.js` | source | D's posture (planted, hands at the sides; each hand with its half at the rend); our own death's halves drawn in our look; the rend heard once |
| `src/frameworks/nani/client/skin.head.js`, `src/frameworks/spacious-audio/client/skin.audio.js` | source | the `rend` hook; the tear's sound; D known by its blows |
| `generated/…`, `public/…` | built | rebuilt from the above |
| `dev/tests/s_skinrend.js` | new suite, in `run.js` | G08–G13, S15 |
| `dev/trial-3-r9-overhaul/fixtures/dphys.f378049.js` | fixture | R8's `dphys.js` (git blob `22a6fc6…`, checked by G12) |
| `dev/tests/s_skinpredator.js` PR25, `dev/tests/s_skinstealer.js` SK33 | suites | adapted, each to the invariant it stood for (R15-9) |
| `dev/tests/run.js` | test list | `s_skinrend.js` added |
| `dev/tools/gate/declared_changes.json` | the scope gate's list of runtime changes | `assets/net-wire.js` declared; the R15 reasons added to `dphys.js`, `gore.js`, `mp.js`, `ai.js` and the admin module |
| `docs/architecture/CONTRACTS.md` | generated block (`docs.js`) | `window.__gore`'s readers now include `assets/skinstealer.js` |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js` | dev tool | `--scene rend` (the victim, a spectator, a late joiner, the server's fallback; how many Skin-Stealers a spectator's page draws); INIT notes corpses and the rend's tone; the gallery's spectator aims at the victim |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r14/` (receipt, scan), `evidence/r15/` | docs, evidence | R15-1 … R15-10; R14's receipt |

## R16a — the adversarial QA and what it found

| File | Kind | Change |
|---|---|---|
| `dev/tests/s_skinadv.js` | new suite, in `run.js` | X01–X09 (the pack's adversarial QA) on the server simulation |
| `dev/tests/run.js` | test list | `s_skinadv.js` added |
| `src/frameworks/br-r/client/skin.kill.js` | source | the tear's sound plays on the first frame that finds the body rent if this page was watching the death before the tear (however slowly its frames come), else within a second of it (R16-2) |
| `public/assets/skinstealer.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js` | dev tool | `--scene rend --stress 1` (X10); `prepPage` / `enterPage` (a page entering at a chosen moment); `--scene gallery --only deaths` |
| `dev/trial-3-r9-overhaul/tools/perf_r16.js` | new dev tool | the Skin-Stealer's own think time, route searches and their cost, lines of sight, garbage collection, heap growth - R8 against this tree |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r15/` (receipt, scan), `evidence/r16/` | docs, evidence | R16-1 … R16-3; R15's receipt |

## R16b — the independent review's findings, fixed narrowly

| File | Kind | Change |
|---|---|---|
| `src/frameworks/gib/shared/dphys.js` | source (G.I.B.'s shared physics) | `remains()` of a rend also names `gs`, `gb`, `gh` at the top: the victim's own corpse is the same two halves (every other death's remains unchanged) |
| `src/frameworks/nani/server/ai.skin.mind.js` | source | `skLegible` counts the torches a watcher's view is given (`ob.lights`); `skBodyInSight`, `skSpotExposed` (a waiting spot hides the whole still body: centre and 30 px either side, `SKM.edge`); a light's kind kept from when it saw them |
| `src/frameworks/nani/server/ai.skin.cover.js` | source | `skWatchers` gives each view the torches of the people it sees now |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | waiting spots (`skHideSpot`, `skFlankSpot`, an interception's spot) hide the whole body; a failed ambush search remembered (`e.noAmbush`, `SK.noFlank`), and the nested flank search's failure; an open interception runs with the open run's act (chase) from its first tick |
| `src/frameworks/spacious-audio/client/skin.sight.js` | source | another wanderer's light on it counts (BR-RoLE's peers, through exposureAt's range fade and scale); a sighting needs two frames as well as 0.12 s |
| `src/core/client/mp.frame.js` | source (core's dread hook) | the Hound/Smiler sting is not played within 1.2 s after a Skin-Stealer's (with no Skin-Stealer every output is R8's: V12) |
| `generated/…`, `public/…` | built | rebuilt from the above |
| `dev/tools/gate/declared_changes.json` | the scope gate's list | R16's reasons on `dphys.js`, `mp.js`, `ai.js` |
| `dev/tests/s_skinr16.js` | new suite, in `run.js` | F01–F05 |
| `dev/tests/s_skinrend.js` | suite | G14 (new); S15 without git history; G08's name |
| `dev/tests/s_skinsight.js` | suite | V13 (new) |
| `dev/tests/s_skinr9.js`, `dev/tests/s_skinadv.js` | suites | the exposure measure allows a withdrawal's braking (R16-5) |
| `dev/tests/s_skinpredator.js`, `dev/tests/s_skinmind.js`, `dev/tests/s_skinbody.js` | suites | PR17 7 of 12; C14 holds the plan changes to the bars; P01 at most 70 shapes (R16-4) |
| `dev/trial-3-r9-overhaul/tools/qa_sight.js` | test-only oracle | every other living player's light counts |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js` | dev tool | the Rend scene reads the corpse the victim's page itself draws |
| `dev/trial-3-r9-overhaul/evidence/r16/review/` | evidence | the reviewer's report and its repro scripts |
| `dev/trial-3-skin-stealer/tools/skin_browser.js` | dev tool (Trial 3's) | two pins brought up to date: the script's API (R10's `sight`, `sightLog`; R14's `anatomy`) and the SKIN tab's previews (R15's D) |
| `dev/trial-3-r9-overhaul/evidence/r16/` | evidence | R16b's suites, `npm test`, Human QA, the real pages, the reviewer's report |

## R16c — the owner's additional refinement, audited (no behaviour change)

| File | Kind | Change |
|---|---|---|
| `dev/trial-3-r9-overhaul/tools/repro_ap.js` | new dev tool | the owner's observations measured on any tree (A seen while roaming, B heard not seen, C circled, E someone it gave up on, F a departure, G roaming, H an interception made obsolete, V how far it sees) |
| `dev/trial-3-r9-overhaul/AP_AUDIT.md` | new doc | what was measured on R8 and R16b, the causes in the code, the plan for R16d-R16g |
| `dev/trial-3-r9-overhaul/evidence/r16c/` | evidence | the tool's output on R8 and R16b |
| `dev/trial-3-r9-overhaul/CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `evidence/r16/` (R16b's receipt, scan) | docs, evidence | |

## R16d — plan interruption and preemption, hunger-dependent aggression (the owner's §1, §2)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skin.preempt.js` | new source part (of `generated/server/ai.js`) | the policy: plans classed (committed, low priority, tactical, feeding); a viable person newly seen, and a lure's or an ambush's quarry seen going away, are the events; a low-priority plan is cut on the think the event is perceived, a tactical one flagged for the decision to weigh afresh, a committed one never touched (and said so); each person forces at most one reassessment every `SKP.again` s; how long it leaves a person alone and when it may take them up again, by hunger (`skLeftFor`, `skRefractory`); every interruption logged (`e.dbg.preempt`, its mind's events) |
| `src/build-recipes.json` | build recipe | the new part, before `ai.skinstealer.js` |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | `skPreempt` on every think after the hunt's own tick; `skMayHunt` takes a person it left back from hunger .4 (was .8) after its refractory, only on sight; `skLeave` leaves them `skLeftFor(hunger)` s from hunger .4 (fed as before); a lure or an ambush is not kept once its quarry has been seen going away; starving, it gives chase from farther (`SK.chaseFrom` x 1 + .4 hs; its speed unchanged); hungry, it prowls where it last perceived prey (`skPatrolGoal`, its own memory only, `SK.patrolFresh`) at up to 1.4 x its roam pace (under `SK.runFrom`: no stamina cost, never a run) and pauses less; a watch keeps watching through a glimpse lost for a moment (`SK.lostGrace`, as an approach and a chase did); the decision's record carries its time |
| `generated/server/ai.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `src/frameworks/nani/README.md`, `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md` | generated doc blocks | the new part listed (`dev/tools/docs/docs.js`) |
| `dev/tools/gate/declared_changes.json` | the scope gate's list | R16d's reason on `ai.js` |
| `dev/tests/s_skinap.js` | new suite, in `run.js` | P01–P09 |
| `dev/trial-3-r9-overhaul/evidence/r16d/` | evidence | `repro_ap.js` on R16d (the before is R16c's), the suites, `npm test`, Human QA |
| `dev/trial-3-r9-overhaul/evidence/r16c/` | evidence | R16c's receipt and post-push scan |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md` | docs | R16d-1 … R16d-5; the R16c row; this table (R16c's had a blank last line) |

## R16e — its eyes: head snaps, the edge of its view, where to look from (the owner's §3, §4, §6)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skin.look.js` | new source part (of `generated/server/ai.js`) | its eyes: stimuli (a sound, movement at the edge of its view, somebody new in its sight), the head's snap (latency, rate, reach, hold, its quarry kept in view, a cap on every head movement), the body beyond the head's reach where it is free to turn, the periphery (`skPeriph`), where to look from (`skVantage`) |
| `src/build-recipes.json` | build recipe | the new part, after `ai.skin.preempt.js` |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | its eyes wired in (`skLookThink` on a think, `skHeadStep` every tick, `e.look`, its own stream `e.lookRng`); a listen faces the sound at the body's rate after the head; a hungry one listens less long; movement it noticed and did not then see sends a hungry one to look; a search for a sound goes first to where it can see the place, looks, then goes closer, and a hungry one goes quicker (a hunt's search as before); a plan's own head movements ease (`skHeadTo`), the listen's end no longer zeroes the head; only prey at hunting hunger preempts a plan (R16d's policy, BR01) |
| `src/frameworks/nani/server/ai.skin.preempt.js` | source | the comment on what is viable (the hunger gate is applied where it is called) |
| `src/frameworks/br-r/client/skin.body.js` | source (the page's drawing) | a snap of the server's head is drawn as one: followed at 22/s and in full |
| `generated/server/ai.js`, `generated/BUILD_MANIFEST.json`, `public/assets/skinstealer.js` | built | rebuilt from the above |
| `dev/tests/s_skinap.js` | suite | P10–P14 |
| `dev/tests/s_skinbehave.js` | suite (a scene's script) | BR01's passer: once 2.5 s have passed without coming level, or when a wall stops them after passing, they walk on the most open way that is not toward it (R16e-5) |
| `dev/trial-3-r9-overhaul/tools/repro_ap.js` | dev tool | `--only`; the P probe (the side corridor's walker) |
| `dev/trial-3-r9-overhaul/evidence/r16e/` | evidence | the probes before and after, the range evaluation, the suites, `npm test`, Human QA |
| `dev/trial-3-r9-overhaul/evidence/r16d/` | evidence | R16d's receipt and post-push scan |
| `dev/tools/gate/declared_changes.json`, generated doc blocks | the scope gate's list, docs | R16e's reason on `ai.js` and `skinstealer.js`; the new part listed |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md` | docs | R16e-1 … R16e-6; the R16d rows; this table |

## R16f — its footwork: facing, sidesteps, giving ground, the way out (the owner's §5)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skin.move.js` | new source part (of `generated/server/ai.js`) | the mover (`skStrafe`: a velocity of its own at its acceleration; forward, sideways at 0.75, backward at 0.55 of the pace it is given, the whole never over it; its facing turned separately; every step through the shared `moveCollide`) and the fight (`skFight`: its place by their way out from its own lagging read of their motion) |
| `src/build-recipes.json` | build recipe | the new part, after `ai.skin.look.js` |
| `src/frameworks/nani/server/ai.skinstealer.js` | source | the fight in an open approach, a chase and a hungry standoff (watch) close to somebody moving or looking at it (`skFightable`); its state cleared with the rest; the admin debug block carries its last interruption (`pe`), its eyes' stimulus (`lk`) and its footwork (`ft`) |
| `generated/server/ai.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `src/frameworks/nani/README.md`, `docs/architecture/BUILD_PIPELINE.md`, `docs/architecture/FRAMEWORKS.md` | generated doc blocks | the new part listed |
| `dev/tools/gate/declared_changes.json` | the scope gate's list | R16f's reason on `ai.js` |
| `dev/tests/s_skinap.js` | suite | P15–P18; P08's prowl a minute long (R16f-4) |
| `dev/trial-3-r9-overhaul/evidence/r16f/`, `evidence/r16e/` (R16e's receipt, scan) | evidence | the probes, the slip-past scenes (P16's) on R16e and R16f, `npm test`, Human QA |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md` | docs | R16f-1 … R16f-4; the R16e rows; this table |

## R16g — the real-page campaign, the overlay's new lines, the independent review's findings (the owner's §7, §9)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` | source | an open approach runs only under the chase's own conditions (`skMayRun`), else at the approach's pace; a hungry watch's footwork keeps a watch's distance; the footwork's velocity carried into the shared steering only along its facing; its body's turn to a stimulus at the species' turning (`skTurnRate`); an exhausted prowl at its exhausted pace; no prowl to footsteps of somebody it left; a prowl given up is not chosen again; at a sound's own place it looks the way it faces; the head's last value, its eyes' and its interruption memory cleared in `onFar`/`onClear`; the debug's list of whom it sees named `sw` (R16f's `sn` hid T6's skin note); `skReactEnd` provided for the interruption |
| `src/frameworks/nani/server/ai.skin.preempt.js` | source part | a reaction cut by an interruption ended by `skReactEnd`; a gap in its thinking (a strike, a capture, a kill) is not a time out of its sight; the logs say what happens |
| `src/frameworks/nani/server/ai.skin.look.js` | source part | `skTurnRate` (the species' own turning, as the shared steering's formula); the body's turn to a stimulus at it (R16e: 5 rad/s) |
| `src/frameworks/nani/server/ai.skin.move.js` | source part | its facing at the species' `TURNING_ABILITY` (R16f: 7 rad/s); its velocity carried over only from the tick before; a band of distance per caller (a watch's own); a blocked line remembered until its next think |
| `src/frameworks/br-r/client/skin.body.js` | source | the drawn snap: a head moving over 0.5 rad between two snapshots (R16e: 0.12) |
| `src/frameworks/overseer/client/ents.debug.js` | source | the admin overlay's `EYES`, `FOOTWORK` and `CUT` / `KEPT` lines (admin debug only) |
| `generated/server/ai.js`, `public/ents.js`, `public/assets/skinstealer.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `dev/tools/gate/declared_changes.json` | the scope gate's list | R16g's reasons on `ai.js` and `ents.js` (with the R11–R13 overlay lines, which had not been listed) |
| `dev/tests/s_skinap.js` | suite | P06's log text; P15's bars at the species' turning (R16g-5); P16/P15 count no blocked fight as footwork; P18's title |
| `dev/tests/s_skinpredator.js` | suite | PR14: R8's thresholds over eight seeds that hold its premise (R16g-5) |
| `dev/trial-3-r9-overhaul/tools/r16g_campaign.js` | new dev tool | the real-page campaign: focused scenes F1–F7, a continuous 12-minute campaign and its hard-failure checks, `--part judge` on a saved record |
| `dev/trial-3-r9-overhaul/tools/r9_browser.js`, `tools/qa_server.js` | dev tools | the page helpers exported (main guarded); a spawn may carry a roam goal |
| `dev/trial-3-r9-overhaul/evidence/r16g/`, `evidence/r16f/` (R16f's receipt, scan) | evidence | the campaign's records, screenshots, video, sheets; the suites, `npm test`, Human QA; the probes |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `HUMAN_QA.md`, `README.md` | docs | R16g-1 … R16g-7; the R16f rows; this table; the owner's play-test; an index of the documents |

## R16h — the full gate's findings, fixed (client only)

| File | Kind | Change |
|---|---|---|
| `src/core/client/mp.frame.js` | source | the heartbeat's second beat reads the levels when it plays (B++'s exactly with no Skin-Stealer in sight) |
| `src/frameworks/overseer/client/ents.debug.js` | source | the `MIND` and `WAYS` overlay lines built with loops, not callbacks (the same text) |
| `src/core/client/bundle/api_contract.json`, `API_CONTRACT.md` | source ledger (regenerated) | `assets/skinstealer.js` as a reader of `Ul`, `Uc`, `H` |
| `public/mp.js`, `public/ents.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `dev/tools/gate/declared_changes.json` | the scope gate's list | R16h's reasons on `mp.js` and `ents.js` |
| `dev/trial-3-r9-overhaul/evidence/r16h/`, `evidence/r16g/` (R16g's receipt, scan) | evidence | the gate's first group on R16g, the three steps on R8, R10 and R11, the fixed steps; the suites, `npm test`, Human QA, the sight scene |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `HUMAN_QA.md` | docs | R16h-1, R16h-2 (and R16g-4 on the drawn snap, R16g-7's real-page reruns and probes); the R16g rows; this table; which QA parts want two tabs and headphones |

## R16i — the Wanderer's movement locked; the Skin-Stealer's purposeful approach (the owner's clarification of October 22)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` | source | its species table's `press: 238` and `SK.pressShown`; an open approach by a very hungry one that may run, already shown and beyond its footwork's range closes at its press; the press counted (`tally.press`) and said (`WHY`) |
| `generated/server/ai.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `dev/tests/s_wandererlock.js` | test (new) | WL01–WL06: the Wanderer's movement constants, files and real `move.js` ticks against R8; the Hound and the Smiler against R8; the Skin-Stealer's speeds under a fresh sprint |
| `dev/tests/run.js` | test runner | `s_wandererlock.js` in `npm test` |
| `dev/tests/s_skinpredator.js` | test | PR28's first phase ends at 3 s of effort on A (its premise, not its pass condition; R16i-5) |
| `dev/trial-3-r9-overhaul/tools/press_eval.js` | tool (new) | six meetings in the long hall at a chosen press speed, seeded |
| `dev/tools/gate/declared_changes.json` | the scope gate's list | R16i's reason on `ai.js` |
| `dev/trial-3-r9-overhaul/evidence/r16i/`, `evidence/r16h/` (R16h's receipt, scan) | evidence | the press at 230, 238 and 245 against R16h; the suites, `npm test`, Human QA, the probes |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `HUMAN_QA.md`, `README.md` | docs | R16i-1 to R16i-6; the R16h rows; this table; the press and the lock in the play-test |

No Wanderer movement file and no Hound or Smiler file changes at R16i (WL02, WL05).

## R17 — final documents, the full gate, the campaign and the cost on the final tree (no game change)

| File | Kind | Change |
|---|---|---|
| `dev/trial-3-r9-overhaul/REGRESSION.md`, `PERFORMANCE.md`, `BROWSER_AND_MEDIA.md`, `DEFERRED.md`, `EVIDENCE_INDEX.md` | docs (new) | the pack's final documents (`10_DELIVERABLES_AND_ACCEPTANCE.md`) |
| `dev/trial-3-r9-overhaul/CHECKPOINTS.md`, `REMOTE_RECEIPTS.md`, `CHANGED_FILES.md`, `DESIGN_DECISIONS.md` | docs | the R16i and R17 rows; R17-1 to R17-4; this table |
| `dev/trial-3-r9-overhaul/tools/r16g_campaign.js` | tool | its checks a and d corrected (R17-3): the engine's crossings of a window or a low obstacle excepted and listed; a sighting while it holds a kill not judged as a walk-on |
| `dev/trial-3-r9-overhaul/evidence/r16i/` (R16i's receipt, scan), `evidence/r17/` | evidence | the full gate's report on R16i in groups (R16h's kept); the focused scenes, the continuous campaign (R16i, and R16h's for comparison, with their raw records), `predator_browser` and the watched hall on R16i; the step's cost against R8 in both orders, the extra counts |

No file outside `dev/trial-3-r9-overhaul/` changes at R17: the game is R16i's.

## R18 — the owner's overtuned experiment (a separate, reversible checkpoint on R17)

| File | Kind | Change |
|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` | source | its speeds (`SKIN.speeds`: roam 160, prowl 205, investigate 232, press 260, run 270, flank 210, fatigued 190, spent 120); `SK.huntHunger` .3 and `SK.chaseHunger` .45 for the hunger gates, `skDrive`; its timers; stamina from `runFrom` 215 in proportion (`skBody`), `skCap` exhausted to `spent`; the far prowl (`farTick`); prowl, investigation and press in roaming, unseen approaches, searches and open approaches; the standoff's escalation (`enc.so`, `SK.escalate`); the walker bonus, the very hungry advance from afar, the flank factor; `skFightable`'s wider take; the open ways out (`skGuess`); the rush from cover by hunger (`skFromCover`); a curious listen's body from its head's start; the far prowl's reason text (R18-2 to R18-9) |
| `src/frameworks/nani/server/ai.skin.move.js` | source | `SKF.near` 400, `SKF.keep`, `SKF.goAway`, `SKF.runIn`; the side it swings to (corrected), its read kept across a short break, straight in on somebody going away (R18-6) |
| `src/frameworks/nani/server/ai.skin.preempt.js` | source | `SKP.left` and `SKP.refr`: the cooldown and refractory tables by hunger (R18-7) |
| `generated/server/ai.js`, `generated/BUILD_MANIFEST.json` | built | rebuilt from the above |
| `dev/tests/s_skinap.js`, `s_skinstealer.js`, `s_skinbehave.js`, `s_skinpredator.js`, `s_skinroute.js`, `s_skinadv.js`, `s_skinr16.js`, `s_wandererlock.js` | tests | each change with its reason in `REGRESSION.md` (R18 table); none dropped |
| `dev/trial-3-r9-overhaul/tools/r16g_campaign.js` | tool | `--part threat` (S1-S13, the owner's §11) with `--raw`; its run read from the tree; F2's start for a faster roam; the threat scenes' pace with the engine's crossings excepted (R17's rule) and S2/S13 not judged where the page cannot sprint or is caught before a long hunt; the crouch key held until the page's state changes, and each threat scene begun standing |
| `dev/trial-3-r9-overhaul/tools/threat_sim.js` | tool (new) | ordinary play at the players' true speeds, headless: two people answering it as players do, every number of §10 |
| `dev/trial-3-r9-overhaul/tools/threat_measure.js` | tool (new) | the §10 numbers from saved real-page records, tree beside tree |
| `dev/trial-3-r9-overhaul/tools/scene_probe.js` | tool (new) | the walk-away (S1) and dithering (S3) scenes headless, at true speeds, for any tree |
| `dev/tools/gate/declared_changes.json` | the scope gate's list | R18's reason on `ai.js` |
| `dev/trial-3-r9-overhaul/evidence/r17/` (R17's receipt, scan), `evidence/r18/` | evidence | the suites, `npm test`, Human QA; ordinary play R18 / R16i / R8; the real pages (threat scenes R18 and R16i, focused scenes, the continuous campaign R18 and R16i); the step's cost; the full gate's groups 1, 2 and 3a and their reruns |
| `dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md`, `CHECKPOINTS.md`, `CHANGED_FILES.md`, `REMOTE_RECEIPTS.md`, `REGRESSION.md`, `PERFORMANCE.md`, `BROWSER_AND_MEDIA.md`, `DEFERRED.md`, `EVIDENCE_INDEX.md`, `HUMAN_QA.md`, `README.md` | docs | R18-1 to R18-12; the R17 and R18 rows; the overtuned play-test |

No Wanderer movement file and no Hound or Smiler file changes at R18 (WL01-WL05): only the three Skin-Stealer parts above among the game's
sources. To go back to R17's creature: `git checkout 636f01e -- src/frameworks/nani/server/ai.skinstealer.js src/frameworks/nani/server/ai.skin.move.js src/frameworks/nani/server/ai.skin.preempt.js && npm run build` (or check out `636f01e`).

## The whole branch, R8 to the final tree

`git diff --stat f378049 <final> -- src` lists 27 source files; each is in its checkpoint's table above.
- The Skin-Stealer's mind (`src/frameworks/nani/server/`): `ai.skinstealer.js` (R11–R16i, R18), `ai.skin.mind.js` (R11), `ai.skin.infer.js`
  (R12), `ai.skin.cover.js` (R13), `ai.skin.preempt.js` (R16d, R18), `ai.skin.look.js` (R16e), `ai.skin.move.js` (R16f, R18); `ai.capture.js`
  (R15: one line, the D preview); `src/build-recipes.json` (the new parts).
- Its page: `src/frameworks/br-r/client/skin.body.js` (R14, R15, R16e, R16g), `skin.compose.js` (R10), `skin.kill.js` (R14, R15,
  R16a); `src/frameworks/nani/client/skin.head.js` (R15); the sight-only warning `src/frameworks/spacious-audio/client/skin.sight.js`
  (R10, R16b); `src/core/client/mp.frame.js` (R10, R16b, R16h: the frame's hook for it); `spacious-audio/client/skin.audio.js` (R15: the Rend's
  sound).
- Execution D (R15): `src/frameworks/gib/shared/dphys.js` (the Rend in the one shared physics), `gib/client/gore.js`, `gib/client/
  mp.deaths.js`, `bpp/client/net-wire.js` (a corpse's two pieces kept); the admin's preview of D: `overseer/client/mp.admin.js`,
  `overseer/server/admin.js` (the existing preview command's accepted variants - no new command, no new auth).
- The admin overlay: `overseer/client/ents.debug.js` (R11–R13, R16g, R16h).
- The client's ledger of `window.__api` readers: `src/core/client/bundle/api_contract.json`, `API_CONTRACT.md` (R16h, regenerated).
- Generated documentation blocks: `src/frameworks/nani/README.md`, `src/frameworks/spacious-audio/README.md`.
- The tests: the new suites in `dev/tests/` (`s_skinsight.js` ... `s_skinap.js`, `s_wandererlock.js`), `dev/tests/run.js`, and the
  existing tests changed with their reasons (`REGRESSION.md`; R18's in its own table).
Built outputs follow from them (`generated/`, `public/`), each declared to the scope gate (`dev/tools/gate/declared_changes.json`).
No Wanderer movement file is among them - the S.P.A.C.E. framework, the surfaces, `move.js`'s parts, the server's step and
`server.js` are R8's byte for byte (`s_wandererlock.js` WL02) - and no Hound or Smiler file (WL05).
