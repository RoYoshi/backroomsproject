# Stage 3H engine modernization: preflight (H3M-0)

Taken 2026-10-14 before any source moved. Every figure below comes from a command whose output is in `inventory/` or `evidence/m0/`.

## 1. Parent, branch and protected refs

| | |
|---|---|
| Repository | `RoYoshi/backroomsproject` (public, default branch `main`) |
| Frozen Stage 3H2 parent | `stage-3h` = `22751bbc39c91f3e54e3305638b2ef2c9dd12c68`, tree `d44c4bafa3c1a78e2d910187ecbe1cc2ec18f3c9`. Checked with `git ls-remote` and the GitHub REST API |
| Accepted B++ | `stage-3e-0-bplusplus` = `143b63ff42b88c6780c5043e0f61d64100f81f40`, tree `b25c26ec3eedab406a6b93f80a59ba6a1cb7c128` |
| Ancestry | GitHub compare B++...3H2: `ahead`, ahead by 15, behind by 0, merge base B++. Locally, `git merge-base --is-ancestor` agrees |
| `main` | `7781e1ac34aa09970df57fae3fc107a873fa2731` (tree `15eee764…`). Not touched |
| This branch | `stage-3h-engine-modernization`, created from exactly `22751bb`. It did not exist locally or on the remote before |
| Remote heads | 30 branches, every head recorded in `inventory/remote_heads_before.json`. `tools/verify_remote_m.py` checks after every push that none of them moved and that no other branch appeared |

**Protected refs:**
- `main`;
- `stage-3h` (the frozen 3H2 candidate);
- `stage-3e-0-bplusplus` (B++);
- `stage-3h0`;
- every other remote branch.

Nothing is merged, rebased, reset or force-pushed.

## 2. The local workspace

- **Where the work happens.** A new Git worktree, `/home/claude/backrooms-modern`, on the new branch. The existing worktrees stay exactly as they were:
  - `/home/claude/backrooms-shadows` on `stage-3h` at `22751bb`, clean;
  - `/home/claude/backroomsproject` on `part-3b` at `c392272`.
- **Stashes.** One, on `lighting-shadows-2d` ("SH8 WIP"). It is unrelated and untouched.
- **`git status --porcelain=v1`** at creation: empty. After this preflight it shows only `?? dev/stage-3h-modernization/`.
- **No unknown local edits** were found that this work could overwrite.

## 3. What is at the parent

**Tracked files:** 8,018 (`inventory/tracked.json`). **The root has 159 entries** (`inventory/root.json`):

| Kind | Count | Entries |
|---|---|---|
| Runtime scripts | 19 | `ai.js` `camcorder.js` `camera_policy.js` `death_srv.js` `dphys.js` `ents.js` `glitch.js` `gore.js` `hud.js` `inventory.js` `light.js` `move.js` `mp.js` `redirect.js` `server.js` `sfx.js` `sim.js` `timing_policy.js` `world.js` |
| Launch, config, page | 6 | `README.md` `package.json` `index.html` `favicon.ico` `run_linux.sh` `run_windows.bat` |
| Historical reports | 126 | `STAGE_*`, `3H0_*`, `PART_2_*`, `BR_ROLE_*`, `2D_SHADOWS_*` (`.md`, `.txt`) |
| Report images | 2 | `STAGE_3C_QA1_MENU_COMPARISON.jpg`, `STAGE_3C_QA2_MENU_COMPARISON.jpg` |
| Folders | 6 | `.github` `assets` `audio_source` `dev` `server` `sounds` |

**The page boot order** (`inventory/scripts.json`):
1. An inline boot-gate script.
2. `camera_policy.js`, `timing_policy.js`.
3. The `type=module` bundle `assets/index-DKbV5Nv9.js`, deferred.
4. Nine module preloads and two stylesheets.
5. 21 classic scripts at the end of `<body>`, in this order: `world.js` `move.js` `camcorder.js` `sfx.js` `gore.js` `dphys.js` `light.js` `ents.js` `glitch.js` `assets/net-newrun.js` `assets/mp-hum.js` `assets/net-wire.js` `assets/net-interp.js` `mp.js` `assets/credits_data.js` `assets/ui.js` `hud.js` `inventory.js` `assets/br-role.js` `assets/level0_visuals.js` `assets/l0-remaster.js`.

The classic scripts run before the deferred bundle. That order is a contract.

**The server** (`inventory/requires.json`):
- `server.js` requires `http`, `fs`, `path`, `crypto`, `zlib`, `./sim.js`, `./server/static.js`, `./death_srv.js`, `./server/peers.js`, `./server/ws.js`, `./server/fields.js`, `./server/aftermath.js` and `./server/newrun.js`, in that order.
- `sim.js` requires `./world.js` and `./ai.js`.
- `ai.js` requires `./world.js`.
- `death_srv.js` reads `dphys.js` from its own folder and runs it.
- `world.js` and `dphys.js` are both served to browsers and loaded by the server.

**Generated runtime files** (`inventory/generators.json`):
- `ai.js` is concatenated from `dev/ai_src/` (10 parts);
- `ents.js` from `dev/ents_src/` (6 parts);
- `sim.js` from `dev/sim_head.js` and `dev/sim_glue.js`.

All three rebuild byte for byte at the parent: the gate's `build` step passed.

## 4. The compiled client bundle (the missing-source problem)

`inventory/bundle.json`. Details are in `FINDINGS.md` M-001.
- **The file.** `assets/index-DKbV5Nv9.js`, 340,823 bytes, SHA-256 `694bca01e75d8e1c70e9ec29ea5382da5bda40d22c6a4f043e6e53b251d7529b`.
- **Its history.**
  - It was first committed in `c9bd4da` (2026-09-28, "fs"). 38 commits have changed it since, edited in place under the same hashed name.
  - The user's `level0-refined-v22.2` package holds an earlier 329,352-byte file of the same name.
- **No source anywhere.** No Vite project, configuration, source map or `sourceMappingURL` exists in the 204 commits on all branches, nor in any of the 36 ZIP packages the user supplied.
- **What it imports.** 11 PixiJS v8 chunks (version strings up to `8.21.0`), each an ES module with its own SHA-256 in the inventory. It also names a chunk the repository lacks: `assets/webworkerAll-ByhiNG9W.js` (3H1 F-005).
- **What depends on it.** Its facade `window.__api` has 52 members, some of them minified internal names. 15 loaded scripts read it (3H1 audit §3).

## 5. Deployment facts (not changed by this stage)

- **Production.** `.github/workflows/deploy-bloom.yml` runs on a push to `main` only. It asks the host to restart, and the host pulls the latest `main` and starts it. **There is no build step on the host**: whatever the server and the browser load must be committed. This stage therefore commits its build outputs and checks them with `npm run build:check`.
- **`redirect.js`** is a separate deployment entry point (a redirect service). It is not part of the game.
- **Untouched:** the workflow, the secrets it names, the admin passcode and its default.

## 6. Baseline on this machine

**The 3H2 fast gate**, run at the parent in this worktree (`evidence/m0/`; 1 min 37 s):
- **Passed:** build (3 files), srv_golden (11), bpp_golden (7), cli_golden (12), protocol (52,740 messages), mutants (18), static (4), raw_live (141) and quick_suites (23, only the known B++ failures).
- **scope** reports a failure only because this stage's own new files sit outside 3H2's allowed folders. That rule belongs to 3H2; this stage has its own (H3M-1).

**The full baseline** is the 3H2 final gate on the same game files (`dev/stage-3h/evidence/h2/final/`):
- 16 of 17 steps passed;
- `bpp_checks` failed once by chance and passed on re-run (3H F-036);
- live recordings, contact-lab images, the gameplay smoke and `perf_det` are all in that folder.

**Inherited test failures**, classified in `dev/stage-3h/gate/known_failures_bpp.json`:

| Suite | Failures |
|---|---|
| npm_test | 13 |
| s_humanqa_hotfix | 1 (X03) |
| test_shadows | 5 |
| test_br_role | 3 |
| audit_net | 4 |
| audit_net2 | 3 (LC1 flaky) |

**The audio baseline** is the offline hum spectrum, −37.7 / −30.1 / −34.4 dB at 60 / 120 / 240 Hz (3H2 overlay receipt). No listening baseline exists: no one here can listen. Hearing it is the user's Human QA.

## 7. Scope and tripwires for this stage

**Allowed:**
- moving and decomposing runtime source into owned modules and parts;
- a build that produces the served and loaded files;
- the serving root moving to `public/`, provided the served file set does not grow;
- archiving the root reports;
- developer documentation.

**Not allowed:**
- any change to behaviour, timing, content, visuals or audio;
- the admin passcode, its default (that line stays in `server.js`), authentication or security policy;
- the deployment workflow;
- any work on `main`, any merge or promotion.

**Tripwires**, run at the checkpoints that need them:
- every built output byte-identical to the parent's file, except where a change is declared and proven;
- the server goldens (11 + 7 scenarios) and the client goldens (9 + 3 scenes), identical to the B++ baselines;
- the protocol contract v2;
- the 18 server mutants caught;
- every HTTP response the same as the parent's, and `src/`, `dev/`, `server/` and `generated/` unreachable;
- two real browsers on a real server, and the gameplay smoke;
- the contact lab's frozen images;
- the offline hum spectrum.

## 8. The plan

See `PLAN.md` (the layout, the build, modules and parts), `MODULE_EXTRACTION_PLAN.csv` (every seam) and `inventory/ROOT_ARCHIVE_PLAN.csv` (every root report: where it goes, its blob, its SHA-256, who names it).
