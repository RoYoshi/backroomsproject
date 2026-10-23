# Trial 3 R9–R17 — the Skin-Stealer's cognitive ambush overhaul

**ENGINEERING COMPLETE — READY FOR OWNER HUMAN QA — NOT OWNER APPROVED.** Branch `trial-3-r9-cognitive-ambush-overhaul`, from R8
`f378049a825e53eafc626a637b8c43397e4072f0` (owner-disapproved October 22, 2026). No merge, no release, no deploy; the owner's Human QA alone
may accept. The Skin-Stealer stays admin-only (at most four; never spawned by the ecology or the director); the Hound, the Smiler, player
movement, Level 0, chat and identity are unchanged - the Wanderer's movement (walk 172, a fresh sprint 285, crouch, crawl, slide, vault,
stamina, exhaustion, the floors) locked to R8 and proven so by `dev/tests/s_wandererlock.js`.

Start with `HUMAN_QA.md` (what to play and what to look for), then `CHECKPOINTS.md` (what each commit did) and `DEFERRED.md` (what is
not done and the decisions that are yours).

| Document | What it holds |
|---|---|
| `R9_AUDIT.md` | R8 audited before any change: the owner's exposed ambush reproduced, the causes in the code, the baseline |
| `AP_AUDIT.md` | the owner's October 22 refinement (perception, interruption, hunger, footwork) measured on R8 and R16b before any change |
| `DESIGN_DECISIONS.md` | every decision R10–R16i made and why, with what was measured and every test changed |
| `CHECKPOINTS.md` | the commits, one logical change each, with their trees and parents |
| `REMOTE_RECEIPTS.md` | each commit read back from GitHub: the tip, tree, parent, every changed file's blob, the protected heads |
| `CHANGED_FILES.md` | every file each checkpoint changed, and the build outputs that follow |
| `REGRESSION.md` | the suites pass/total, the 13 inherited failures, every changed test and why, reruns |
| `PERFORMANCE.md` | the 60 Hz step against R8 over interleaved runs, both orders; the creature's own think, routes, rays, garbage collection |
| `BROWSER_AND_MEDIA.md` | the real-page evidence: screenshots, video, what each page saw and what the creature decided |
| `R14_TOPDOWN_ART_REPORT.md` | the body drawn for the camera the game has (R14) - visual approval pending |
| `HUMAN_QA.md` | the owner's play-test, 35–45 minutes |
| `DEFERRED.md` | known limits, inherited problems, owner decisions |
| `EVIDENCE_INDEX.md` | where every piece of evidence is |

The game's sources are in `src/`: the Skin-Stealer's mind in `src/frameworks/nani/server/ai.skin*.js`, its body and kills on the page
in `src/frameworks/br-r/client/skin.*.js`, its sight-only warning in `src/frameworks/spacious-audio/client/skin.sight.js`. `npm run build`
makes `generated/` and `public/` from them (`src/build-recipes.json`); `npm run build:check` proves the outputs match.
The tools in `tools/` are development-only: none is loaded by the game, and `qa_server.js` (placing a creature for a scene) is never served.
