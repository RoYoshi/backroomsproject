# Stage 3H engine modernization: findings

IDs are `M-…`, so they do not collide with the 3H findings (`dev/devlog4dev/3H_FINDINGS.md`, `F-…`).

**Decision words:**
- *defer*: recorded, not acted on in this stage;
- *island*: kept as fixed bytes and documented;
- *handled*: this stage deals with it;
- *block*: it stops a goal of this stage.

**Restricted security details are not written here** (3H F-027).

| ID | Observation | Expected contract | Evidence | Impact | Baseline (B++ / 3H2) | Owner | Decision | Checkpoint |
|---|---|---|---|---|---|---|---|---|
| M-001 | The compiled client bundle `assets/index-DKbV5Nv9.js` has no source: no Vite project, configuration or source map exists in any branch or supplied package | every runtime file has canonical readable source and a reproducible build | `inventory/bundle.json`; `PREFLIGHT.md` §4 | maintenance: the local game loop, map, camera, avatar, death class and `window.__api` cannot be edited from source | the same in both | BR-R (with S.P.A.C.E., F.R.O.N.T., L.O.S.T., G.I.B. trapped inside) | island; **block** for "complete modernization" | H3M-6 |
| M-002 | The bundle names a chunk the repository lacks (`webworkerAll-ByhiNG9W.js`) | every named chunk present, or the missing one proven unused | `inventory/bundle.json` `namedButMissing`; 3H F-005 | none seen in play (it is a PixiJS worker path) | the same in both | BR-R / A.T.L.A.S. | island: documented | H3M-6 |
| M-003 | The Level 0 map exists twice: inside the bundle and in `dev/sim_head.js` (extracted from the bundle) | one level definition, used by server and client | 3H F-007; `dev/sim_head.js` | maintenance: a map change needs two edits | the same in both | L.O.S.T. | defer: unifying needs the bundle's source (M-001) | H3M-3 records it |
| M-004 | `ai.js`, `ents.js` and `sim.js` are build outputs of `dev/ai_src/`, `dev/ents_src/` and `dev/sim_head.js` + `dev/sim_glue.js`, built by shell scripts that write into the game folder | canonical source in its owner's folder; one cross-platform build; outputs checked | `inventory/generators.json` | maintenance: Windows users cannot run the `.sh` builds; the parts live outside their owners | reproducible at both | N.A.N.I., BR-R, S.P.A.C.E. | handled | H3M-1 |
| M-005 | About 60 `window` globals connect the page's scripts, and `__api` exposes minified bundle names | documented contracts; no new uncontrolled globals | 3H1 `3H1_DEPENDENCY_OWNERSHIP_MAP.md` §2 | maintenance | the same in both | each publisher | handled by a ledger; no global is renamed (they are contracts) | H3M-6, H3M-7 |
| M-006 | Many tools and tests name runtime files and root reports by their root paths: 70 code files name `server.js`, 47 `mp.js`, 36 `sim.js`; 50 root reports are named by historical stage scripts | active consumers follow the moves; historical ones are mapped, not rewritten | `inventory/path_consumers.json`, `inventory/ROOT_ARCHIVE_PLAN.csv` | maintenance: a move can silently break a test | — | S.T.A.G.E. | handled: one layout map for active tools; ledger for historical ones | H3M-1, H3M-7 |
| M-007 | Inherited test failures on B++: npm_test 13, s_humanqa_hotfix X03, test_shadows 5, test_br_role 3, audit_net 4, audit_net2 3 (LC1 flaky) | classified, never hidden | `dev/stage-3h/gate/known_failures_bpp.json` | none for players | the same in both | S.T.A.G.E. | classified at every gate | all |
| M-008 | B++'s `place_replay.js` can fail one case by chance when a glitched wall lands on its walk (3H F-036) | a check that cannot fail by chance | `dev/stage-3h/evidence/h2/final/f036/` | tooling | the same in both | S.T.A.G.E. | handled at the gate: a failure of that exact shape is checked against F-036 before anything else | all |
| M-009 | The production host pulls `main` and runs `node server.js` with no build step | whatever runs must be committed | `.github/workflows/deploy-bloom.yml` | deployment: an uncommitted build output would break production after a merge | — | core / A.T.L.A.S. | handled: outputs committed and checked by `build:check` | H3M-1 |
| M-010 | The repository is public: moving server code under `src/` hides nothing from GitHub, only from HTTP | do not claim source secrecy | GitHub API `visibility: public` | security posture (the user's decision) | the same | W.A.R.D. | recorded; HTTP exposure is still tightened (the web root becomes `public/`) | H3M-1 |
