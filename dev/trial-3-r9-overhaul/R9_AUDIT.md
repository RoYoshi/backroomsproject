# Trial 3 R9 — Audit of R8, reproduction of the owner's report, baseline

**Status: AUDIT ONLY. No game source is changed at R9.** R8 (`trial-3-predator-refinement` @ `f378049`) was **disapproved by the owner
after Human QA** on October 22, 2026. This document is the mandatory R9 output of the R9–R17 pack (`01_SOURCE_AUDIT_AND_BASELINE.md`):
evidence-backed cause hypotheses, a failing executable reproducer, the observed SHAs, the inherited failures, the measured baseline, the
scoped file inventory and the intended change list. Nothing here is owner approval of anything.

Evidence: `dev/trial-3-r9-overhaul/evidence/r9/` (index in `EVIDENCE_INDEX.md` from R17; the files are named below).
Tools (all development-only, none required by the game): `dev/trial-3-r9-overhaul/tools/` — `repro_r9.js` (the deterministic scenes),
`diag_route_r9.js` (why a flank's way is in sight), `qa_sight.js` (TEST-ONLY player-sight oracle), `r9_browser.js` (real pages:
`flankwatch`, `audio`, `gallery`), `qa_server.js` (TEST-ONLY scene placement around the unchanged `server.js`), `verify_remote_r9.py`.

## 1. Refs, observed October 22, 2026 (07:00–07:40 UTC)

| Ref | Observed | How |
|---|---|---|
| `trial-3-predator-refinement` (R8, the base) | `f378049a825e53eafc626a637b8c43397e4072f0`, tree `a6d72690727a58dbab6e770dfda64a1d9dbf70f3`, parent `62a887e65e47e4a67f242a17c22faea098c8e702`, "Trial 3 predator refinement: R8 receipt" | `git ls-remote`, GitHub REST commit + branch |
| `trial-3-r9-cognitive-ambush-overhaul` | did not exist (REST 404) before this work; created locally at `f378049` | REST, `git worktree add -b` |
| every other remote head (40 in all) | recorded in `inventory/remote_heads_before.json` before the first push | `verify_remote_r9.py --snapshot` |
| protected heads | main `7781e1a`, stage-3h-engine-modernization `4beba2f`, stage-3h `22751bb`, stage-3e-0-bplusplus `143b63f`, post-3h-trials-1-2-4 `58fcf5b`, trial-4-rgb-chat-accessibility `518b990`, post-trial4-review-polish `1a89863`, post-trial4-chat-voice-polish `63805e9`, pre-trial3-final-polish `1ff9374`, trial-3-skin-stealer `020b5b5`, trial-3-behavior-refinement `4518f93`, trial-3-predator-refinement `f378049`, trial-3-cognitive-predator-refinement `0217573` | checked at every checkpoint by `verify_remote_r9.py` |

`trial-3-cognitive-predator-refinement` (a separate, earlier attempt from the same R8 base, C0–C8, also not approved) is treated as a
protected "previous behaviour branch": untouched. The R9 pack starts from R8, so none of that branch's code is in this base; where a
lesson from it is reused, the change is made here afresh and declared.

## 2. The owner's report → reproduced

The owner's October 22 complaint (pack `00`, `README_FIRST`): an apparent ambush is exposed because the creature **sneaks in front of the
player into its hiding position**; reasoning still odd; not responsive/opportunistic enough; heartbeat/sting only when actually seen; a real
top-down body; a fourth execution D.

### 2.1 Deterministic reproduction (`repro_r9.js`, R8 tree, `evidence/r9/repro_r8.txt`, traces `repro_r8_traces.json.gz`)

The player's view is the TEST-ONLY oracle `qa_sight.js`: the client's own sight mask (`visibilityPolygon(player, 700)` — rays to the body's
centre and ±18 px, walls and pillars) and darkness (`exposureAt`: near aura, carried light with LOS, lamp field, range fade; legible ≥ .25).
Scenes (8 seeds each unless noted; 30 s): **W** a lit person in the long hall watches the creature placed 450 px east; **X** the same while
strolling; **U** the same person facing away (no eye contact — the lit hall is still on their screen); **L** seen once, then walks off
into the dark (4 routes × 4 seeds). Stealth transits are the plans R8 runs to reach a place out of the person's sight.

| Scene | Stealth transits | F1 hidden goal, ≥96 px of the way in sight | F3 in sight ≥0.6 s and kept going | px of the way in sight / px moved | kills |
|---|---|---|---|---|---|
| W .6 | flank 8, side-approach 8, bait 5 | flank **8/8** | flank **8/8**, side-approach 8/8 | flank 1772/3292 | 0 |
| W .75 | flank 8, side-approach 8, bait 1 | flank **8/8**, side-approach 7/8 | **8/8**, 8/8 | flank 2006/3626, side 1760/2462 | 8 |
| W .85 | flank 7, side-approach 7 | flank **7/7**, side 7/7 | **7/7**, 7/7 | flank 1825/3320, side 1526/2228 | 8 |
| X .75 (walking watcher) | flank 13, side 12, bait 2, unwatched approach 1 | flank 7/13 | flank 10/13 | 4105/9414 | 8 |
| U .6 / .85 (facing away) | approach "P is not watching: it comes closer" 8 / 8 | — | 8/8, 8/8 | **3085/3085** (all of it) | 8, 8 |
| L .75 / .95 | intercept 12 / 12, unwatched approach 24 / 24 | 0 / 0 | 0, 2 / 0, 2 | intercepts 14/7484 and 14/7392 | 6, 9 |
| W .95 | none (open approach: 39.9 s in sight, labelled "starving, it comes on anyway") | — | — | — | 8 |
| W .3 | none; 100 % of the time watch/leave/roam | — | — | — | 0 |

F2 (its bearing swept ≥ 25° across the person's front while in sight): 3/8 W flanks at each of .6/.75/.85. F4 (out of sight, > 300 px to
go, under 200 px/s): 4–5 of 8 W flanks. The same scene run twice gives the same table (determinism: `repro_r8.txt` = a second run).

### 2.2 Why the flank's way is in sight (`diag_route_r9.js`, `evidence/r9/diag_route_r8.txt`)

At the moment each W (.75) flank began, from where the person really stood:

| seed | R8 route (its `plan()` with `skCover`) | covered alternative that existed |
|---|---|---|
| 1 | 530 px, **259 px in sight** (8 of 15 cells) | exit 144 px away from them (96 px in sight) + 1281 px fully hidden = 2.69× |
| 2 | 529 px, **271 px** (8/14) | 144 + 1261 hidden = 2.66× |
| 3 | 602 px, **271 px** (8/15) | 144 + 1234 = 2.29× |
| 4 | 552 px, **271 px** (8/14) | 144 + 1280 = 2.58× |
| 5 | 506 px, **294 px** (8/13) | 144 + 1347 = 2.95× |
| 6 | 489 px, **279 px** (8/13) | 144 + 1348 = 3.05× |
| 8 | 573 px, **270 px** (8/16) | 144 + 1223 = 2.39× |

(seed 7 chose the bait first.) Every flank spot was out of the person's sight (`spotHidden`); every route crossed their lit hall.

### 2.3 Real page (`r9_browser.js --scene flankwatch` on the R8 build; `evidence/r9/browser/`)

A real page (1024×640, SwiftShader, ~5.5 fps — the server is authoritative and runs at its own pace) stands at (5000, 3504), torch on; the
test-only `qa_server.js` places a Skin-Stealer 450 px east exactly as the tests do (hunger .6/.75/.85/.75); the page looks where it last saw
it (pointer moves, as the game reads them). The page's own view (on screen, `__api.Uc` rays, `__api.Ul` readability ≥ .25):

| try | hunger | flank way in the page's view | side-approach in view |
|---|---|---|---|
| 1 | .60 | 3/5 samples, 177 of 323 px | 2/5, 38 of 76 px |
| 2 | .75 | 6/11 samples, **251 of 488 px** | 5/13, 96 of 228 px |
| 3 | .85 | — (an open approach) | — |
| 4 | .75 | 3/5, 129 of 260 px; then 2/7, 59 of 284 px | 5/16, 118 of 334 px |

`r8_flankwatch_try2.mp4` (10 s) and `r8_flankwatch_try2_sheet.png` show it walking diagonally across the lit hall in front of the page to
the north doorway. **The owner's complaint reproduces in the real game build.**

### 2.4 The failing executable reproducer

`dev/tests/s_skinr9.js` **R9-01** (watched hall, hunger .6/.75/.85 × seeds 1–4): *no movement in the person's sight while on a covert way;
only a withdrawal straight out of their sight (moving away, not across their front) may be seen.* On R8: **FAIL** — 230–478 px of covert
way in sight in every one of the 12 runs (`evidence/r9/r9_01_on_r8.txt`). It is not yet in `dev/tests/run.js`'s default list (it is meant
to fail until R13); run it with `node dev/tests/run.js s_skinr9.js`.

## 3. Cause hypotheses (with the code they rest on)

All line numbers: `src/frameworks/nani/server/ai.skinstealer.js` at `f378049` unless stated.

| # | Hypothesis | Evidence | Verdict |
|---|---|---|---|
| H1 | **A concealed destination, an exposed transit.** `skCover` (l. 403–411) adds a finite `+70` per cell in LOS of the perceived person within 700 px and `+140 × lamp`; `skFlankSpot` (l. 482–498) requires only the END to be out of their sight (`!geo.los(p, spot)`, l. 487) and accepts a route only if `L < max(900, d × 2.6)` (l. 495) — at d = 450 that is 1170 px, so every genuinely covered route (1367–1492 px, §2.2) is rejected and only short exposed ones are ever accepted. | §2.1 F1 8/8, §2.2, §2.3 | **CONFIRMED** (root cause of the owner's report) |
| H2 | **No re-validation while moving.** A flank under way scores `2` (l. 1033) and goes on while seen; `skUnseen` keeps it going to its spot (l. 1085); nothing asks whether the person sees it on the way. | F3 100 % of W flanks | **CONFIRMED** |
| H3 | **"Unwatched" means only eye contact.** Its only notion of being observed is `skWatched` → `facedBy` (senses l. 87–94: facing within 0.35 rad, ≤ 900 px, lit or < 240 px). The top-down player sees a 360° sight mask of 700 px wherever they face. So "P is not watching: it comes closer" (l. 1064) and the approach from a flank (`side`, l. 657, 1084) creep under `skCover` in plain view of the screen, crouched (`creep`/`approach` acts, l. 1137, 1297). | U: 3085/3085 px in sight; W side-approach 1760/2462 | **CONFIRMED** |
| H4 | **No hidden sprint; the wrong body language.** Flanks move at `speeds.flank` 170 px/s (l. 1298) hidden or not; the act is `approach` (a crouched lean) while crossing in view. | F4 4–5/8; video | **CONFIRMED** |
| H5 | **Interceptions can be exposed.** `skPredict` hides the waiting spot only from one route point (`back`, l. 599) and falls back to an unhidden spot (`hidden:false`, l. 602); `skIntercept` routes with `skAround` (l. 607–610: keep off the trail line), not with sight. | L: 14/7484 px in sight | **NOT REPRODUCED in L** (the person was behind walls / dark); kept as a code-level risk, to be tested in R13 geometry (C16–C19, COVER05) |
| H6 | **Odd reasoning.** W .6 s1: flank → approach from it → "seen in the light" → leaves for 20 s. X .75 s8: flank / approach / flank / approach / flank / approach in 10 s (thrash between being seen and slipping out of sight). Hunger .75 and .85 give *identical* W runs (decisions saturate). W .3: no attention at all to a person watching from 450 px (B1 attention starts within 200 px, `awNear`). | `repro_r8_traces.json.gz` plan timelines | **CONFIRMED** |
| H7 | **The observer is frozen in the plan.** `skCover(eng, p)` uses the person's position at plan time only; a moving person is not re-checked. | X results; code | **CONFIRMED by code**, measured in X |
| H8 | **No Skin-Stealer dread exists at all.** `src/core/client/mp.frame.js` computes `k` from the Hound `G` and the Smilers `q` only. | browser audio §4 | **CONFIRMED** (R10 adds a new, sight-only contribution; nothing to remove) |

## 4. Audio baseline (`r9_browser.js --scene audio` on R8; `evidence/r9/browser/audio_r8.json`)

Observed on the page's AudioContext (every oscillator frequency set to 70/58 Hz = a heartbeat thump; every `__sfx.play('sting')`; every
0.2–1.5 s buffer = a burst) and its `#dread` vignette opacity, the world frozen, the page at (5000, 3504), torch on:

| case | thumps (70 Hz) | stings | bursts | vignette max |
|---|---|---|---|---|
| no creature, 5 s | 0 | 0 | 0 | 0 |
| Skin-Stealer 260 px east, on screen, mask 3/3, readability .598, 6 s | **0** | **0** | 0 | 0 |
| Skin-Stealer fully behind a wall (mask 0/3), 6 s | 0 | 0 | 0 | 0 |
| Hound 260 px east, 6 s | 9 | 0 | 0 | .659 |

R8 gives a visible Skin-Stealer no dread at all; the Hound's proximity dread works. The Skin-Stealer's own positional sounds (footsteps,
wind-up, leap, skid, feeding, rare breath: `skin.audio.js`) are physical and stay.

## 5. Body and deaths baseline (`r9_browser.js --scene gallery` on R8; `evidence/r9/gallery/`)

Figures added to the capturing page's own mirror only (the page's drawing, sight mask, darkness, light), eight headings per act, in the lit
open hall at (6700, 3440): `r8_gallery_sheet.png` (stand / creep / run / pounce), single acts (`gallery_r8_*.png`), drawn sizes
(`gallery_r8.json`: standing 54.9 × 77.5 world px at `BODY_SCALE` 1.3; pounce 46.6 × 132.8). The standing body reads as a squat four-
limbed shape, elbows and knees out (the "frog" the owner described). Deaths A/B/C were run through the admin DEATHS preview (the real
kill path) with a second page as witness (`r8_deaths_sheet.png`, `death_r8_B_*.png`); limitation: the victim's page showed the death
menu by 0.8 s in this capture, so the frame timing of the victim view needs the R14/R15 version of this scene (earlier, denser frames).

## 6. Test and build baseline (R8 tree, rerun here — not R8's own report)

| Command | Result (`evidence/r9/`) |
|---|---|
| `npm run build:check` | PASS — 44 outputs and the manifest are what `src/` builds (`buildcheck_r8.txt`) |
| `npm test` (in a git worktree of `f378049`) | **232/245**; the 13 failures are exactly R0's inherited P9 list (`inherited_failures_r8.txt` = `dev/trial-3-predator-refinement/evidence/r0_inherited_failures.txt`, sorted, identical) (`npm_test_r8.txt`, 308 s) |
| `npm test` in a `git archive` export | 231/245: the 13 + **PR25 (in-tree part)**, which compares files with commit `4518f93` and needs git — an artefact of running outside a git checkout, not a defect (`npm_test_r8_archive_export.txt`) |
| `node dev/tests/run.js s_skinpredator.js` | 30/30 |
| `node dev/tests/run.js s_skinstealer.js` | 34/34 |
| `node dev/tests/run.js s_skinbehave.js` | 19/19 |
| `npm run test:humanqa` | 5/6 — X03 inherited (`humanqa_r8.txt`) |
| `node dev/tests/run.js s_skinr9.js` (new) | 0/1 — R9-01 fails on R8, as intended |

Inherited (13): P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22.

## 7. Performance baseline (`perf_pr.js`, R8 against R8 — an A/A run; `evidence/r9/perf_aa_r8.txt`)

60 Hz sim steps, director on (2 Hounds, 3 Smilers), 8 scripted players, 3 rounds × 60 s each:

| pair (two identical R8 trees, "BR" and "PR") | mean per round (ms) | median of round means | p99 per round (ms) |
|---|---|---|---|
| 0 Skin-Stealers | BR .129 .129 .153 / PR .140 .149 .182 | .129 / .149 | 0.96–2.39 |
| 1 | BR .161 .175 .182 / PR .144 .147 .181 | .175 / .148 | 1.05–2.01 |
| 4 | BR .207 .209 .235 / PR .210 .222 .239 | .209 / .222 | 2.21–3.34 |
| 4, every player pressing one | BR .210 .224 .228 / PR .206 .224 .250 | .224 / .224 | 2.32–3.10 |
| 4 starving | BR .210 .230 .233 / PR .206 .222 .230 | .230 / .222 | 2.46–3.72 |

Identical code differs by up to 15 % in median mean (the tool's own verdict: "+15.4 %" for 0 Skin-Stealers, within its tolerance) and up to 2.5× in p99 between rounds: **the noise floor**. Later comparisons (R13, R16) therefore use
more rounds and medians against R8, plus counts of route searches and allocation, not one run.

## 8. Event responsiveness baseline (R8)

First hunt step after the first sighting: 0.1 s (W, the think it saw them on); 0.6–0.7 s in L. Being seen mid-flank: **no response** (F3).
Thinks are 10 Hz near (`ai.engine.js` l. 217–219), 60 Hz sim steps (`src/core/server/loop.js` l. 19).

## 9. Scoped file inventory (R8, the files the pack names)

| File | Lines | Owner / role | R9–R17 |
|---|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` | 1397 | the species: hunger, stamina, plans, flank/intercept/search, strike, capture weights | R11–R13, R15 (capture D) |
| `src/frameworks/nani/server/ai.senses.js` | 248 | shared senses (perc, facedBy, estimate) | **not changed** (prefer not; no need found) |
| `src/frameworks/nani/server/ai.capture.js` | 187 | captures; `previewKill` rejects Skin-Stealer D | R15, scoped |
| `src/frameworks/nani/server/ai.engine.js` / `ai.entity.js` / `ai.geo.js` | — | shared engine, nav, A* (`cost` may return Infinity) | **not changed** (used as they are) |
| `src/frameworks/nani/client/skin.head.js` | 38 | client tables, `BODY_SCALE` 1.3 | R14 |
| `src/frameworks/nani/client/skin.mirror.js` | 39 | snapshot mirror | read only (R10 reads its list) |
| `src/frameworks/br-r/client/skin.body.js` | 182 | the procedural body, poses, skin view | R14 |
| `src/frameworks/br-r/client/skin.kill.js` | 65 | the attacker in a death | R14, R15 |
| `src/frameworks/br-r/client/skin.compose.js` | — | module composition | R10 (one new module) |
| `src/frameworks/spacious-audio/client/skin.audio.js` | 124 | its physical sounds; death sounds A–C | R15 (D) |
| `src/core/client/mp.frame.js` | 59 | the dread hook (`k`: Hound + Smilers) | R10 (one separate Skin-Stealer input; `k` path unchanged) |
| `src/frameworks/spacious-audio/client/mp.dread.js` | 57 | thump / burst / drone | read only (R10 reuses `thump`) |
| `src/frameworks/gib/shared/dphys.js` | 801 | shared deterministic death physics; Skin-Stealer A–C; Boom gibs (`gibShapes`, `gs/gb/gh`) | R15 |
| `src/frameworks/gib/server/death_srv.js` | 61 | server begin/step/corpse, fallback | R15 |
| `src/frameworks/gib/client/mp.deaths.js` / `ents.death.js` / `gore.js` | 269 / 84 / 433 | replay, death view, gore and gib drawing | R15 |
| `src/frameworks/overseer/server/admin.js` | — | `preview` accepts Skin-Stealer A–C only | R15 (D) |
| `src/frameworks/overseer/client/ents.debug.js` | 302 | debug labels | R11–R13 (instrumentation lines) |
| `src/build-recipes.json`, `dev/tools/gate/declared_changes.json` | — | build parts; scope declarations | every checkpoint that adds a part |

## 10. Intended change list (the plan; each checkpoint its own commit(s), remote-verified)

**R10 — sight-only Skin-Stealer heartbeat and sting (client only).** A new module (Spacious Audio) in `public/assets/skinstealer.js`
computes, per frame, for every *undisguised* mirrored Skin-Stealer the page's own visibility (on screen with this frame's camera; inside
the sight mask by `__api.Uc` rays to its centre and ±18 px within 700 px; readable by `__api.Ul` ≥ .25 — the same model as §2.1) and keeps
a separate envelope (fast onset after a short confirmation, short release), a one-shot sting on a confirmed new sighting with a
deterministic re-arm/cool-down, and an event log for the browser checks. `mp.frame.js` uses `max(k, ks)` for the heartbeat only and plays
the Skin-Stealer sting separately; drone, vignette, shake, light flicker and the Hound/Smiler sting stay on `k` alone, so with no visible
Skin-Stealer the hook's output is unchanged. Proof: V01–V12 (node parity test of the hook; the `audio` browser scene extended to two pages
with different views).

**R11 — attention, motive, events, belief.** A new server part (N.A.N.I., after `ai.skinstealer.js`) for: observation state per person
(saw them; *they could see me* = in their 700 px sight and readable, from what it perceives; eye contact as a subset; an expiring "they saw
me" record; "I only suspect they might see me" from belief), timestamped evidence (seen / heard / inferred / disproved), event detection
on each think (new sighting, lost sight, fresh sound, turned toward me, compromised route, missed strike, arm's reach, winded quarry) with
measured response latency, attention at any hunger (acknowledging a watcher at range), and hunger/opportunity motive that makes a hungry
one hunt rather than loiter. Proof: C01–C15.

**R12 — inference and candidate reasoning.** Bounded route hypotheses (2–4 continuations at a fork with weights), candidate positions
(around a wall, alternate hall, flank, deeper hide, intercept alcove, no-ambush) scored by time (real route length, its own speed and
stamina, arrival slack), uncertainty, value and exposure, with a stored reject reason for each rival. Cached, capped (nodes, candidates,
searches per second). Proof: wrong-turn, anonymous-sound, evidence-equivalence (C08 / COVER12).

**R13 — covered reposition, hidden sprint, interruption, interception.** A sight-aware route layer: exposure of a cell to every observer
it must hide from (the people it sees: their pose and light; people it believes near: belief ± uncertainty, projected along their likely
way); COVERT routes forbid exposed cells (`cost → Infinity`) and are validated sample by sample; if it is in sight when the reposition
begins it first withdraws straight out of sight (labelled), then moves fast while hidden (stamina rules unchanged), slows to arrive quietly;
if it is caught on the way (seen, exposed) it is marked compromised at the next think and chooses again (duck back, another covered way,
stand off, open strike if justified, leave). OPEN approaches/chases are labelled open (debug, act, pose). The interception spot is hidden
from the predicted approach, the unhidden fallback becomes an OPEN option or no option. Proof: C16–C27, R9-01 passing, `flankwatch`
before/after.

**R14 — top-down body.** `skin.body.js` / `skin.kill.js` (and `BODY_SCALE` if the new figure needs another number) redrawn for the
top-down view; collider (radius 24), reach, routes and the disguise unchanged. `R14_TOPDOWN_ART_REPORT.md`, eight-heading gallery
before/after, *visual approval pending*.

**R15 — Execution D "The Rend".** A rare, physically justified fourth Skin-Stealer kill after a legitimate capture, through every G.I.B.
path (capture weights and commitment, `dphys` CFG/PLAN/DURS/prepare and a two-segment breakup reusing the Boom gib bodies and the corpse
record's existing `gs/gb/gh` fields where possible, server fallback, replay, corpse, sounds, admin preview). **If two persistent segments
need a public record change that cannot be backward compatible or touches other deaths: STOP and report `R15 BLOCKED`.**

**R16 / R17** — regression (`npm test`, humanqa, species suites, Hound/Smiler parity, cross-species G.I.B.), the full gate once (shared
G.I.B. change), performance against R8 (more rounds), browser scenes, an independent critical review with narrow fixes in their own
commit; final documents, receipts and the owner's QA guide. Final status: **ENGINEERING COMPLETE — READY FOR OWNER HUMAN QA — NOT OWNER
APPROVED** (or BLOCKED).

## 11. Risks and STOP conditions noted now

- The observer model (§2.1, R10, R13) is the client's own rule set mirrored on the server's copy of the level; the server never reads a
  person it does not perceive. Where the creature cannot know (a person out of its sight), it uses its belief and treats exposure as
  probable, never the person's real position.
- R15's two-segment remains may require a new optional corpse field (a gib kind); if that cannot be added without changing other deaths'
  records or the replay contract, R15 stops as BLOCKED.
- Browser evidence runs on SwiftShader at ~5–6 fps (1024×640); the server is unaffected, but page sampling is ~3 Hz. Deterministic
  scenes carry the exact numbers; pages show the same thing in the real build.
- Performance noise is large (§7); conclusions need repeated runs.
