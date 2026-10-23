# Trial 3 R9–R17 — real browser and media evidence

**Not owner-approved.** Every page here is headless Chromium on SwiftShader (software rendering) on a shared two-CPU machine, served by the
repository's own `server.js` from the generated build (`npm run build`) with a synthetic admin passcode. A page is moved only by its own
keys and its own mouse; a creature is placed by the test-only `tools/qa_server.js` exactly as `dev/tests` place one (it is never served
in play). What a page saw is measured on the page with the client's own functions (its sight mask's rays, its camera, its exposure),
and what the creature decided comes from the admin debug the server sends (read only to report). Frame rates under SwiftShader are low
(1-6 frames a second with two pages); timings inside a scene are read in the order of the server's snapshots (50 ms apart), not on the
page's own clock. Your GPU will differ.

## By checkpoint

| Checkpoint | Scene (tool) | What it shows | Files (`evidence/`) |
|---|---|---|---|
| R9, R8's build | the owner's watched hall (`r9_browser.js --scene flankwatch`, four tries) | **the complaint reproduced in the real game**: its "flank" walks across the lit hall in front of the page - up to 251 of 488 px of the way in the page's view | `r9/browser/r8_flankwatch_try2.mp4`, `_sheet.png`, `flankwatch_r8.json`; `r9/gallery/` (R8's poses and deaths) |
| R10 | the sight-only warning (`--scene sight`, two pages, a Hound for comparison) | R8: no Skin-Stealer cue on screen; R10: a heartbeat and one sting only while this page sees it - never behind a wall, in the dark, off screen or in a skin; the Hound's dread unchanged | `r10/browser/sight_r8.*`, `sight_r10.*`, `r10_sight_pageA.mp4` |
| R13 | the watched hall again | it backs straight out of their sight (seen, by design), then 1,423-1,427 px of covert way with **0 of 23-25 samples in the page's view**, and breaks cover at their side; a bait (fourth try) is meant to be seen | `r13/browser/r13_flankwatch_try3.mp4`, `_sheet.png`, `flankwatch_r13.*` |
| R14 | the gallery (12 acts x 8 headings), places, the view's edge, the deaths A-C - beside R8's | the body drawn from straight above; the edge leak and the drawing cost measured | `r14/gallery/`, `r8_vs_r14_*.jpg`, `places_*`, `edge_*`, `deaths_r14_*.jpg`; `R14_TOPDOWN_ART_REPORT.md` |
| R15 | Execution D (`--scene rend`, two runs) | the victim's own screen, a spectator, a late joiner, the server's fallback with the victim gone: the same two halves, the tear's tone once on each page that saw it | `r15/browser/rend_r15_*`, `deaths_r15_A_to_D_spectator.jpg` |
| R16b | every scene again, the stressed spectator (CPU x4, +200 ms), `predator_browser.js`, `skin_browser.js` | sight 12/12; flankwatch 0 px of covert way in view; the Rend with the victim's own drawn corpse; predator 7/7; `skin_browser` t1-t6 (t4 on its second try), t7 not finishing here (R8 neither) | `r16/browser/` |
| R16g | **the focused scenes** (`r16g_campaign.js --part focused`): F1 a sound behind it, F2 movement at the edge of its view, F3 seen while roaming, F4 hunger, F5 circled, F6 a feint, F7 two people | 7 of 7, each on its first try - its head on a sound 50 ms after it began to turn, its body 100 ms after the head; movement 2 rad off its head noticed first, then seen; its route given up on the think it saw them; fed it leaves, starving it kills; circled it faces the page and steps sideways, never over its run; a reversal answered 300 ms late; with two people it turns its head to the second | `r16g/browser/focused_r16g.*`, `r16g_focused_pageA.mp4`, `r16g_focused_sheet.jpg`, `r16g_F*.jpg` |
| R16g | **the continuous campaign** (`--part continuous --mins 12`): two pages played by their own keys and mouse - exploring, hiding, peeking, circling, feinting, fleeing; a second, starving Skin-Stealer from half-way | every hard-failure check passes: no walk-on after a new sighting at hunting hunger; its head turning (25 snaps: 5 sounds, 9 movements, 11 sightings); no sighting without a line from the person's own page (0 of 159); never over its run; never stuck; no flip-flopping; no page error. 12 deaths. The log of every change of plan, eyes, interruption and whom it sees, with why | `r16g/browser/continuous_r16g.*`, `continuous_r16g_events.txt`, `r16g_continuous_pageA.mp4` (12 minutes, 8 frames a second), `r16g_continuous_sheet.jpg`, `r16g_continuous_page{A,B}_every_minute.jpg`; the two superseded runs |
| R16h | the sight-only warning again (its heartbeat's second beat changed) | 12/12 twice; the first run, straight after `npm test`, failed on page A as above | `r16h/browser/sight_r16h_try1..3.*` |
| R16i | **the focused scenes on the final tree** (R17) | 6 of 7 on the first run - F1-F5 and F7 as at R16g (its head on a sound 50 ms after it began to turn, its body 100 ms after; movement 2.03 rad off its head noticed, then seen; its route given up on the think it saw them; fed it leaves, starving it kills; circled, facing off 0.34 rad, sideways, never over its run); F6 failed: after the reversal it kept its old way 400 ms, then sprang instead of stepping. F6 alone: R16i 500 and 450 ms, R16h 550 and 450 ms - PASS | `r17/browser/focused_r16i.*`, `r16i_focused_pageA.mp4`, `r16i_focused_sheet.jpg`, `f6_r16i_try2..3.*`, `f6_r16h_try1..2.*` |
| R16i | **the continuous campaign on the final tree** (R17), and on R16h in the same session for comparison | every hard-failure check passes once checks a and d are corrected (R17-3; the first verdicts kept): no walk-on; its head turning (11 snaps); 0 of 186 sightings without a line from the person's page; never over its run but in the engine's crossings of a window or a low obstacle (six, at most 456 px/s; R16h's run four); never stuck, no flips, no page error. **Its press began once in the 12 minutes** (at 114 s: very hungry, seen, 491 px off - it closed to its footwork's range). Deaths 26 (R16h's run in the same session 6; R16g's three runs 12, 20 and 21): the pages' scripted play varies far more than one press can explain | `r17/browser/continuous_r16i.*`, `continuous_r16i_judged.*`, `continuous_r16i_events.txt`, `r16i_continuous_pageA.mp4`, `r16i_continuous_sheet.jpg`; `continuous_r16h.*`, `continuous_r16h_judged.*`, `continuous_r16h_events.txt` |
| R16i | `predator_browser` and the watched hall on the final tree (R17) | predator 7 of 7; the watched hall: its covert way 0 of 30-34 samples in the page's view in each of four tries (1,407-1,459 px of it), then it breaks cover at their side, as at R16g. The sight-only warning and the Rend were not run again: the page is R16h's byte for byte and the press does not enter them | `r17/browser/predator_browser_r16i.*`, `flankwatch_r16i.*`, `flankwatch_r16i_sheet.jpg` |
| R16g | the earlier scenes on R16g's tree | sight 12/12 in three runs (two runs before them failed on page A, which stalled: `REGRESSION.md`); flankwatch 0 px of covert way in view in four tries; the Rend's corpse the same on every page; predator 7/7 | `r16g/browser/sight_r16g_try1..5.*`, `flankwatch_r16g.*`, `flankwatch_r16g_sheet.jpg`, `rend_r16g.*`, `predator_browser_r16g.*` |

## What the pages can and cannot show

- **Overlays on and off.** Every scene above runs with the admin overlay off (the debug data on: the admin page receives it and the tool
  reads it; nothing draws it). The overlay's own lines are in `HUMAN_QA.md` (run it with labels FULL, then again with the overlay off).
  R9's and R14's galleries include overlay-on shots of R8's labels.
- **The drawn head's snap** is checked as the angle each page receives in the snapshots; the drawing itself was looked at in the videos.
- **Audio** is counted at the page's own audio hooks (thumps, stings, the master gain at each sting, the Rend's tone); nothing was listened
  to by ear here.
- **The campaign's own checks** were corrected at R17 (`REGRESSION.md`): check d excepts the engine's crossings of a window or a low
  obstacle (each one listed in the verdict), check a does not judge a sighting while it holds a kill; the first verdicts are kept beside
  the corrected ones (`continuous_r16i.txt`, `continuous_r16i_judged.txt`; the raw records `continuous_r16{h,i}.json.gz` let anyone judge
  them again: `--part judge --raw`).
- **Frame rates** are SwiftShader's: 1-6 frames a second, more with one page. Under that load a page can stall; the sight scene's two
  failed runs are kept.

## How to make them again

```
node dev/trial-3-r9-overhaul/tools/r16g_campaign.js --part focused [--only F2] --out F.json --shots DIR --video DIR
node dev/trial-3-r9-overhaul/tools/r16g_campaign.js --part continuous --mins 12 --out C.json [--raw C.json.gz] --shots DIR --video DIR
node dev/trial-3-r9-overhaul/tools/r16g_campaign.js --part judge --raw C.json.gz        # the hard-failure checks again on a saved record
node dev/trial-3-r9-overhaul/tools/press_eval.js [--press 230|238|245]                    # R16i's press, six meetings (no browser)
node dev/trial-3-r9-overhaul/tools/r9_browser.js --scene sight | flankwatch [--tries 4] | rend | gallery  --out X.json [--shots DIR] [--video DIR]
node dev/trial-3-predator-refinement/tools/predator_browser.js --out X.json
```
Each starts its own server from this tree with a synthetic admin passcode and headless Chromium (Playwright); nothing is written but
the outputs named.
