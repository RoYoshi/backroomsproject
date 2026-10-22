# Trial 3 R9–R17 — changed files

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
