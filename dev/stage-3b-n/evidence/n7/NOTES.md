# N7 - final integration regression (final tree)

Run on the final Stage 3B-N tree (SwiftShader; relative numbers only):

| area | file | result |
|---|---|---|
| Stage 3B remaster smoke (optimizations active, remaster on/off parity, BR-RoLE blind to it, tiers, perf sanity) | `smoke_3b.log` | 9/9 |
| Stage 3B unit | `test_3b.log` | 26/26 |
| BR-RoLE unit | `test_br_role.log` | 32/32 |
| camera / timing serving + Universal Camera Fairness (11 viewports, DPR 1/2) | `camera_3bn.log` / `.json` | 4/4 |
| camera fairness math / fixed-step timing | `s_camera_fairness.log` / `s_fps_equality.log` | 12/12 / pass |
| true darkness + danger flicker (wall, pillar, glimpse, overlay integrity) | `visibility_3bn.log` / `.json` | 6/6 |
| fixture / pillar / LOS loop | `pillar_3bn.log` | 5/5 |
| movement incl. networked authority | `move_3bn.log` | 7/7 |
| Hound blind pursuit + sound | `hound_3bn_final.log` | 10/10 |
| full AI suite | `ai_full_suite_final.log` | 151/162 (= parent; differences in the Hound report) |
| HQA hotfix suite | `s_humanqa_hotfix.log` | 5/6 (= parent: X03) |
| Stage 3B-N fast checks | `test_3bn.log` | 28/28 |
| LOS polygon cost with pillar corners (game's own ray) | `los_polygon_cost.json` | +0.03-0.04 ms per polygon in PILLAR HALL, none elsewhere |

`visibility_3bn.js` was made to retry its wall stand-point search (the admin 'near' Hound lands at a random spot; one
final run found no wall-separated stand point on the first spawn and reported a harness failure, not a leak).
