# R16 — independent review of R9–R15 (the reviewer's report, as returned)

The reviewer was a separate agent. It was given only the branch range (`f378049..b9f6040`), the owner's pack and a list of what to look
for. It was not given this checkpoint record or its conclusions. It treated the worktree as read-only and ran code only in its own
exported copy (`<tmp>/review/head`, no git history). Paths below are sanitized. What was done with each finding is in
`DESIGN_DECISIONS.md` R16-4.

## Findings, most severe first

**1. HIGH — the D victim's own screen shows a whole corpse, while everyone else sees two halves.** Confidence: high (code path and a script).
- **Where:**
  - `src/frameworks/gib/shared/dphys.js` `remains()` returns the halves only nested, as `gibs: {gs, gb, gh}`.
  - `src/core/client/game/client/render.ts:145` `completeDeath` spreads `remains(d)` into the victim's local corpse, so that record has no
    top-level `gb`.
  - `src/frameworks/gib/client/gore.js` draws halves and hides the whole body only when `rec.gb` is set.
  - `main.ts:250` `__api.bodies()` never adds the server's record while a local corpse for the same owner exists.
- **Scenario:** a player killed by D, then respawns.
  - During the death, `skin.kill.js` `ownHalves` draws the halves.
  - On respawn, the local `CorpseView` appears: a whole body, frozen where the body stood at the tear.
  - Spectators, late joiners and the server's record all show two halves.
- **Why the evidence missed it:**
  - G10 checked only the server's determinism.
  - `r9_browser.js` `bodyOf` compared each page's server list, not the corpse the page draws.
- **Repro:** `victim_corpse.js` — the local corpse has no `gb`; the server's has two pieces.

**2. MEDIUM — the "can they see it" model ignores other players' lights, dropped corpse lights and the camcorder's infrared / night vision.**
Confidence: high from the code.
- **Where:**
  - The client cue `skin.sight.js` uses `__api.Ul` (exposureAt). That counts only the local player's own light, lamps and night vision.
  - The renderer shows other players' torches.
  - On the server, `skLegible` counts only that observer's own torch and the lamps.
- **Consequences:**
  - (a) The cue doesn't fire when the creature is lit only by another player's torch.
  - (b) In co-op it can cross a view that another player's beam lights.
- **Why tests can't catch it:** the QA oracle shares the model.

**3. MEDIUM-LOW (performance) — a failed covert approach is not remembered.**
- At hunger 0.4–0.6, a covert search (up to `SKC.tries` A* searches) can run on most thinks.
- **Measured:** 30 searches in 4.9 s in one scene; up to 26 per 10 s across 40 scenes.
- **Repro:** `cover_spike2.js` and `cover_churn2.js`.

**4. Tests weakened or nearly unable to fail.** Confidence: medium-high.
- **PR17:** accepted approach acts widened from 2 to 6; seeds went from 8 to 12, but the bar stayed at 5.
- **PR07:** the flank count is now taken only before the player flees.
- **SK21/SK41:** the creature now starts 265 px away instead of 600 px; the R8 bait-from-distance case is no longer covered.
- **C14:** a "kept" decision counts as answering an event.
- **G08:** its name says "never two in a row", but that is not asserted.
- **R9-01:** tolerates up to 48 px of in-view covert movement, and uses the shared-model oracle.
- **S15:** shells out to `git show` without a try, so it fails on a checkout without git history.
- PR23 and PR25 were rewritten but are not weakened.

**5. LOW**
- **Double sting:** a Skin-Stealer sting followed within 1.2 s by the Hound/Smiler sting still plays twice.
- **One-frame glimpse at a low frame rate:** at 8 fps or less, a single-frame flicker confirms a sighting.
- **Ambush slivers:** the server's exposure test (centre ±18 px) can leave lit slivers of the drawn body (up to 40 px out) past a corner.
- **Open vs covert intercept:** an open intercept and a covert sprint both use act `intercept`.
- **Older cached clients:** they map D to A and drop the halves. Graceful, no crash.
- **Client per-frame cost:** `skin.body.js` allocates arrays and rebuilds Graphics every frame while moving. P01 allows up to 140
  shapes, against R8's ~55; the browser measurement is still pending.
- **Live state read:** `skObsOf` reads the live `eng.lights` entry for someone last seen up to 1.5 s ago (light kind only).

## Checked and found sound
- **No leak of true state into decisions:**
  - New server code never reads unseen players' true positions, facing or identity.
  - Sound attribution remains sight-gated.
  - The QA oracle is not required anywhere under `src/`.
- **Speeds, reach and wind-ups:** unchanged. Rush and covert runs respect stamina, and C26 (a fresh runner wins) passes.
- **Covert route checks:** withdrawal geometry, the A*'s view-blocked cells, the full-route audit, compromise handling, a plan replaced
  mid-step, removed or disconnected players, and the one-point path edge case.
- **Memory:** stays bounded.
- **dphys:** every other death is bit-identical to R8 (G12). The Rend is deterministic at 30/60/120 fps, including the server fallback.
- **Wire and admin:**
  - The wire codec is unchanged for Boom.
  - Spectator and late-joiner replay create, draw and destroy the halves correctly.
  - The D audio is identified by its hit times.
  - The admin change only lets the existing `preview` command accept D for the Skin-Stealer; no auth changes.
- **Dread hook:** unchanged with no Skin-Stealer in sight (V12). Disguised creatures give no cue.
- **Suites run by the reviewer:** `s_skinsight` 9/9; `s_skinrend` G09–G13 pass (S15 failed only for lack of git); C11 and C14 pass.

## Re-run on the fixed tree (R16b)

| Repro | Reviewed tree (`b9f6040`) | R16b |
|---|---|---|
| `victim_corpse.js` | local corpse has `gb`: false | true, the same two halves as the server's |
| `cover_churn2.js` at hunger .45 | searches in 10 s: 26 18 15 6 1 0 … | 1 1 1 0 … |
| `lowfps_sting.js` at 8 fps, one frame in ten | 1 sting, heartbeat 0.76 | 0 stings, heartbeat 0 |
