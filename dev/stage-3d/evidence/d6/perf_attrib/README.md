# Looking for the Hound A cost (D6, after the A/B)

Two quick experiments, kept as they ran. Neither isolated the cost (`STAGE_3D_PERFORMANCE.md`).

- `js_cost_per_frame.js` (Node, no browser): one Hound A death at 12 open spots, frame by frame at 60 Hz. It times the physics step and `gore.fx` drawing into a stand-in Graphics. Run: `node js_cost_per_frame.js GAME_DIR "Hound A"`. Result (`js_cost_per_frame.txt`): about 0.2–0.5 ms per frame in either tree, against frames of 700–850 ms on SwiftShader, with the same number of drawing calls. The script work is not the difference.
- `attrib_paused_houndA.py` (one browser page, the parent, then 3D): a Hound A death paused by the Death Lab at 2.0 s, then frame times with the blood, debris and foreground layers hidden in turn. It also counts what the live blood holds. Result (`parent.json`, `3d.json`):
  - the same 165 drawing instructions in both trees;
  - the frame times of the same paused frame ranged from 417 to 567 ms (parent) and 400 to 442 ms (3D) from one 5 s measurement to the next, whichever layer was hidden: too noisy to attribute anything.
