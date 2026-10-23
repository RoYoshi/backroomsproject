# Trial 3 R19, S track - the Skin-Stealer's positioning before a chase: the audit (S0)

Trial 3 is **not owner-approved**.  This branch, `trial-3-r19-prechase-positioning`, is an isolated engineering branch for the owner's
Human QA.  Nothing here is merged, deployed or spawned organically (the Skin-Stealer stays admin-only, at most four).

## Starting point (verified fresh, 2026-10-23)

| what | value |
|---|---|
| base branch | `trial-3-r9-cognitive-ambush-overhaul` (R18), fetched fresh before any write |
| R18 receipt (this branch's parent) | `01e5d97afd7bd1fec4fd4e34ef07953101faef6e`, tree `e042ca380e7fff5e52a96d2c7354e62f60fedc9a` |
| R18 runtime commit | `c3b40dc35b5f8f7d5542134c3c21e66c8ad9cb66`, tree `8178f7854a5a3b2e05245bcf8065d34d465d4a75` |
| R17 fallback | `636f01ea074cb969d2f1ef1cff9dd081f24185f9` (tree `0879f3070a14b0407348e01aaeb0119a68ac1a93`) |
| remote R18 head at the start | `01e5d97` on `git ls-remote` and on the GitHub REST branch and commit (tree, parent equal) - no divergence |
| remote heads at the start | 41, recorded before the first R19 push: `inventory/remote_heads_before_r19.json` (2026-10-23T22:19:48Z) |
| the pack's source facts | its six source blobs (`SOURCE_FACTS.json`: ai.entity.js b4bcda9, ai.skin.move.js 52c0556, ai.skin.cover.js f5024a4, ai.skin.infer.js 825ca5f, ai.skin.preempt.js dc9a6bd, ai.skinstealer.js a2d3547) equal 01e5d97's |

The S branch is one straight line from `01e5d97` (checked on every push by `tools/verify_remote_r19.py`, made from R18's verifier with
R18's own branch added to the protected heads).

## Baseline on 01e5d97 (node v22.22.2, the repository's own scripts)

- `npm test` (dev/tests/run.js): **330/343** - the 13 inherited P9 failures (2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09,
  P01, P08), as R18 reported.
- `node dev/tests/run.js s_humanqa_hotfix.js`: **5/6** - X03 inherited.
- Every Skin-Stealer suite green: s_skinstealer 34/34, s_skinbehave 19/19, s_skinpredator 30/30, s_skinap 18/18, s_skinroute 15/15,
  s_skinadv 9/9, s_skinr16 5/5, s_skinmind 15/15, s_skinsight 10/10, s_skinr9 1/1, s_skinbody 11/11, s_skinrend 8/8, s_wandererlock 6/6.

## Source map: how R18 positions before a chase

- `skDecide` (ai.skinstealer.js): on a think with somebody it may hunt in sight, weighs leave / watch / retreat (the bait) / flank /
  approach / chase from its hunger, eye contact, being in their view (its mind's model of their screen), light, crowd, its standoff clock
  (R18's escalation), and keeps the plan under way unless another is clearly better (`SK.rethink`).  A way round (`flank`) is weighed only
  when it is seen; `skFlankSpot` tries up to 14 spots at their side, out of their view, and takes the first whose covert way
  (`skCovertWay`, ai.skin.cover.js: withdrawal straight out of their view, then a hidden route audited against every view it knows of) is
  no longer than max(1600, 4.5 x the distance).
- `skCovertStep` / `skCovertFollow`: the withdrawal at a walk, the hidden run, the quiet last stretch; caught on the way -> `skCompromised`.
- `skFromCover`: at the spot - creep nearer under cover, rush from close enough, or lie in wait (`ambush`), then listen and search.
- An open `approach` heads straight at them (`plan`/`directTo`), presses when they know it is there; within `SKF.near` (400 px) the R18
  footwork (`skFight`/`skStrafe`, ai.skin.move.js: a 12-ray reckoning of their way out, a lagged read of their motion) takes over.
- `skPreempt` (ai.skin.preempt.js) cuts or keeps lower plans on new sightings; `skGuess` / ai.skin.infer.js guess where an unseen quarry went.

## What was reproduced (before any change; the tools are in `tools/`, outputs in `evidence/S0/`)

1. **"Clever but absent": the long way round a person standing in the lit hall** (the pack's Scene B).  Instrumented in R18's own
   C17/PR06/PR19 scenes: the covert way round is ~1700 px (~10 s at its stalk / run / stalk) against 400-450 px straight (1.7 s open).
   `tools/scene_r19.js hall <R18> stand .85`: R18 goes round in 5/8 seeds, out of their sight 7.2-7.4 s, the kill at ~11.6 s.
2. **A way round begun and dropped on the next think, and the bait for somebody walking off.**  `scene_r19.js hall <R18> walk0 .6`:
   a person seen walking off (looking back) - R18 begins a way round on the think they still stood and drops it 0.1 s later (twitch: 9 of
   16 runs at .6/.75), then chases; in 2/8 at .6 it takes the bait instead (a back-off round a corner) and is out of their sight 9 s.
3. **Ordinary play, 36 hours a hunger** (`tools/prechase_sim.js --mins 180 --seeds 12`, two people exploring, drawn answers to meeting
   it): R18 at .55 begins 17 ways round, 9 last over 5 s, in 7 the quarry moved away while it was gone, 4 end with them within 350 px; at .7:
   17 / 10 / 9 / 8.
4. **The open approach ignores where they could go.**  At a junction (`scene_r19.js escape <R18> 550`: a person standing where a side passage
   opens east, sprinting when it is 550 px off): R18 heads straight at them; sprinting east escapes 8/8, west 7/8.
5. **Found during S3: R8-R18 leave a vault open.**  A vault (`e.trav`) is begun only by the shared follower.  When the Skin-Stealer's plan
   switches mid-vault to movement that does not use the follower (its footwork, a spring), the vault stays open: the shared `moveStep` lets
   a body in a vault pass solid props, so the body moves on through things until the follower runs again and sets it down at the vault's far
   end.  `prechase_sim.js --log 1`: R18 shows 7 open vaults at .55 and 6 at .7 in 36 h each; one ended in an 830 px jump in a chase (an
   R19 tree before the fix: seed 3, t 6692.7 s).

## Failure taxonomy (the pack's, for this track)

| class | R18 | after S |
|---|---|---|
| detour without opportunity (Scene B) | 10 s way round a stander at .8-.85 | refused with its reckoning above .8; kept at .7 (`DESIGN_DECISIONS.md`) |
| detour after a mover | begun and dropped, or the bait | refused with where they would be; the bait excluded |
| stale plan (they moved off) | the way round went on to its spot, then waited | weighed afresh when seen moving off; at the spot, hunt on if they will have moved |
| position ignores exits | straight at them | at a standing person: their side way out (`skContest`) |
| open vault (movement) | 13 in 72 h | carried through, 0 |

## Allowed change (documented before the change)

The Skin-Stealer's own parts only: `src/frameworks/nani/server/ai.skinstealer.js`, `src/frameworks/nani/server/ai.skin.move.js` (a pure
factor-out of the footwork's way-out reckoning, unchanged in behaviour); `generated/server/ai.js` and `generated/BUILD_MANIFEST.json`
regenerated by `npm run build`; a new suite `dev/tests/s_skinr19.js` (listed in run.js); this folder.  Not: the shared engine
(ai.entity.js, ai.engine.js, the Hound, the Smiler), any speed (walk 160, prowl 205, investigate 232, press 260, run 270), stamina, the
spring and the kill, cover auditing (`skCovertWay`), perception, memory, inference, the Wanderer, the page.
