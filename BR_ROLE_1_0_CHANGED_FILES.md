# BR-RoLE 1.0: changed files

**Lineage:** `main` `7781e1a` (unchanged) → gameplay v23.3.6 `f2805bb` → the 2D-shadows stage SH0–SH7 (`8e3c06b` … `f24a2c4`) → BR-RoLE:

| commit | stage |
|---|---|
| BR0 `617bcca` | audit |
| BR1 `f9d67b2` | |
| BR1.1 `4e3582e` | approved |
| BR2A `3961350` | |
| BR2B `ce25bc8` | |
| BR2C `5408f7b` | |
| BR2 `2748ff6` | accepted |
| BR2.1A `7d702ee` | |
| BR2.1B `2cea032` | |
| BR2.1C `2441f4f` | |
| BR2.1 `4d0264a` | approved |
| **1.0** | the commit this file ships in |

## What the game runs (against v23.3.6 `f2805bb`)

Only **two** files of the parent change. Both are presentation-only, and both undo to the parent byte for byte (`dev/br-role/freeze_br.py`). **Every other parent file is byte-identical**: 228 / 230.

| file | change |
|---|---|
| `index.html` | One script tag: `./assets/br-role.js` is loaded after the game's scripts. (SH7's `assets/shadows-2d.js` was loaded there before BR0; v23.3.6 itself has neither.) |
| `assets/index-DKbV5Nv9.js` | Two lines, the one guarded seam. In `drawLight` / `drawPeers`: `if (window.__brRole && __brRole.on())`, skip the game's own ambient, lamp and carried-light cut-outs and call `__brRole.draw(…)`. Otherwise it runs v23.3.6 exactly. |

**Added:**

| file | what it is |
|---|---|
| `assets/br-role.js` | BR-RoLE 1.0: the whole renderer, about 820 lines. It is client-only: no server file includes or serves anything new. |
| `assets/shadows-2d.js` | SH7's module, **kept on the branch but not loaded** since BR0 (RETIRE, per `BR_ROLE_BR0_AUDIT.md`). It is the reference for the donor ideas BR-RoLE adapted. Nothing references it. |

**Protected, byte-identical to v23.3.6:**
- `ai.js`, `sim.js`, `move.js`, `server.js`, `mp.js`;
- `death_srv.js`, `dphys.js`, `camera_policy.js`;
- `world.js`, `light.js`, `ents.js`, `camcorder.js`, `timing_policy.js`.

These cover gameplay, AI, collision, the camera, networking, and the gameplay light / line-of-sight / hearing truth. The line-of-sight mask is drawn by the bundle, as before.

## Changed by BR3 (1.0 vs BR2.1 `4d0264a`)

| file | change |
|---|---|
| `assets/br-role.js` | The version is now `br-role 1.0`. Code changes: `sectorBox` (a beam works in its cone's box); `boxClip` (shadow fills stay in the light's own box); stats: frame p95 and samples, the longest lamp build; `resetStats` keeps the frame counter. No visual change; tier budgets are unchanged. |
| `dev/br-role/test_br_role.js` | 31 checks (was 30). The canvas mock records `rect`. U01 accepts `1.0`. U02 allows only integer axis-aligned box clips. U12 allows one clip. U25 guards that world-space fills stay in world space. New: U31 (the sector box). |
| `dev/br-role/smoke.js` | K10 walks back to the Hound when it wanders out of view before 5 samples (a known flake of the smoke harness, not of BR-RoLE). |
| `dev/br-role/perf_br.js` | **New.** The focused desktop and mobile performance pass. |
| `dev/br-role/soak_br.js` | **New.** The leak and cache-growth sanity check. |
| `dev/br-role/evidence/br3/` | **New.** Unit, browser, freeze and launch logs; performance and soak JSON; the retained-suites summary and comparison; the remote verification. |
| `BR_ROLE_1_0_*.md` | **New.** The final reports. `BR_ROLE_1_0_PACKAGE_RECEIPT.txt` travels **beside** the package, not inside it, because it records this commit's own hash and the ZIP's SHA-256. |
| `BR_ROLE_BR2_1_HUMAN_QA.md` | Its status line records your approval. |

## Development files (never served to players)

The game server serves the repository root, but nothing below is linked from `index.html`. None of it is loaded by the game:
- `dev/br-role/`: tests, smoke, performance, soak, freeze, packaging, captures, evidence;
- `dev/shadows/`: the SH harness and the retained-suites runner, reused.

The package is built from `git archive` of the exact commit (`dev/br-role/package_br.py`), so it holds exactly the committed tree.
