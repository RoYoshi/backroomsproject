# H2-0: parent gate, audit, RED baselines, frozen gates

No production file changed at H2-0. The decisions and the reasoning are in `STAGE_3D_HQ2_AUDIT.md` at the repository root.

## Here

| File | What |
|---|---|
| `preflight.json` | The accepted parent checked live (`git ls-remote`, the GitHub REST branch and commit, the HQ1 receipt's own lines, local tree, ancestry), `stage-3d-hq2` absent on GitHub, the workspace and its stash, every remote branch with its commit and tree |
| `remote_heads_before_hq2.json` | Every remote branch before HQ2, read by `verify_remote_hq2.py` after each push |
| `production_manifest_parent.json` | The parent's production files and their blob ids |
| `corridor_widths.json` | Level 0's passage widths in walk mode (decision D1) |
| `red/proto/` | `proto_lab.js` on the parent: the NEW RUN phantom with an ordinary player; players walking through each other in 10 px and 1 px steps; a spawn on top of a standing player |
| `red/nr_browser/` | Two real pages and the server's player list: NR1 accepted, NR2 6 s later (cooldown), a press during NR3's own fade; screenshots at NR2 +1.2 s, +3 s and after its SPAWN |
| `red/col_browser/` | Two ordinary players, Alice walking by keyboard through Bob in the one-tile corridor; screenshots |
| `red/reset_epoch/` | A world reset 2.2 s into a Hound C wall death with the light on, three pages; screenshots at +0.6 s and +3 s |
| `red/attempts/` | The first browser runs, before two harness corrections (`NOTE.md`) |
| `aa/` | The A/A run on two exports of the parent: browser frame times (3 pairs), server load (`spread`, `crowd`, 2 pairs each), eight-player traffic; `steps.txt`; `perf_gates.json` |
| `scope_h2-0.json` | The allowlist check of this commit |
| `secret_scan.json` | The files of this commit, scanned before it |

## The three REDs, in one line each

- **NEW RUN inside the cooldown.** The server refuses it, yet the presser's screen fades and shows the run menu. The server keeps her alive and visible to Bob, still stores a fresh light record for everyone, refuses her `leave`, and pulls her back with a `tp` when she presses SPAWN.
- **No collision.** Ordinary players walk through each other, in big or 1 px steps, and spawn on top of each other. The server accepts every step.
- **A world reset mid-death.** For the rest of the measured 9.5 s, every sampled row on every page still shows the old death:
  - the victim: her own death sequence, its stain and her local corpse;
  - the spectators: the old replay and its stain.

## Tool versions

These tools changed after their H2-0 runs. Each change is listed with why it does not alter the recorded result.

- **`proto_lab.js`**
  - It gained the H2-1 GREEN scenarios (`nr_flow`, `nr_e02`, `nr_elig`). They were written before H2-1's code and are first run at H2-1.
  - Its room admin now removes the monsters again after each join. A lone player's join makes a new world with new monsters, and a spawn spot near one is refused.
  - In the RED run every spawn was accepted where it was asked for: see the server positions in `red/proto/proto_red.json`.
- **`nr_browser.py`**
  - It gained the H2-1 plan `e02`.
  - Its sampler also records the NEW RUN button's text.
- **`srv_load.js`**: rewritten during the A/A run, which is why the server half ran four times (see `aa/steps.txt` and the three `attempt_*` folders kept there):
  - first run: nine connections in a room capped at eight;
  - second run: a fixed row through walls;
  - third run: the monsters back after the first join.

  Only the fourth run's numbers set the gates.
- **The browser half of the A/A** ran twice. In the first, two short CPU-heavy commands of mine ran during pair 1 (`aa/attempt_concurrent_cpu/`). Only the second sets the gates.
