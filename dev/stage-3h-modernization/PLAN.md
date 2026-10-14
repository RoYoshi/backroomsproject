# Stage 3H engine modernization: the plan as decided at H3M-0

This file states the decisions the waves follow. When the live code forces a change, it is recorded here and in an ADR (`docs/architecture/ADRS/`).

## 1. Where things live

```text
/                     README.md, package.json, server.js (thin bootstrap; since M2 the composition root, the session held: M-023),
                      redirect.js (deployment), run_*.sh/.bat, .github/
src/                  canonical, human-edited source
  core/server/        the server's composition root: configuration in, wiring, start
  core/client/        the page's composition: the multiplayer layer's prologue, per-frame hook, epilogue
  frameworks/<name>/  one folder per framework name; client/ server/ shared/ lanes only where code exists; README.md in each
  shared/             pure contracts and constants shared by several owners (no logic dumping ground). Not created: no code
                      needed it; code that the page and the server both load lives in its owner's shared/ lane
  integrations/       explicit adapters between two owners. Not created: no adapter was needed
  build-recipes.json  every built output: its parts, in order
public/               THE WEB ROOT, and the only folder the server serves:
                        - static files (index.html, media, CSS, the manifest);
                        - the compiled bundle, its stylesheet and PixiJS chunks (built from the recovered v11 output and the
                          lineage ledger since M6a; the post-v11 edits are a compatibility island with complete lineage);
                        - the scripts the build writes from src/.
generated/server/     files the build assembles for the server (sim.js, ai.js, world.js, dphys.js); never served
generated/BUILD_MANIFEST.json   every input and output with its SHA-256
docs/                 architecture/ (frameworks, flows, contracts, build pipeline, ADRs, parity matrix) and development/ (quickstart)
dev/                  development only, never served: tools/ (build, checks, gate), tests/, archive/ (the root reports), stage folders
```

The URL space does not change: `/mp.js`, `/assets/ui.js` and `/sounds/x.mp3` are what they were. Only the folder behind them is now
`public/`, so `server.js`, `src/`, `dev/` and `generated/` cannot be reached at all. The `SERVE` allowlist stays as it is.

## 2. Why the outputs are committed

The production host pulls `main` and runs `node server.js`, with no build step (`PREFLIGHT.md` §5). So `public/` and
`generated/server/` are committed. `npm run build` rewrites them from `src/`. `npm run build:check` fails if anything committed
differs from what the sources build.

## 3. Two kinds of source unit, named honestly

- **Module** (server side). A CommonJS file with explicit `require` / `module.exports`, given its dependencies by a factory where
  shared state is involved, as Stage 3H2 did with `server/newrun.js` and `server/aftermath.js`. Required directly at run time, no
  build. `server.js` is decomposed this way (H3M-2), and is proven by the deterministic server goldens.
- **Part.** A section of a script whose pieces share one closure: a classic browser script's IIFE, a UMD factory, or `createSim`.
  - **Today.** The files built this way are `ai.js`, `ents.js` and `sim.js`. The same is decided for `mp.js` and the other
    multi-owner scripts.
  - **How a part is written.** Each part is one file in its owner's folder. It begins with a header comment naming its output and
    owner and declaring its interface: what it provides to the other parts, and what it uses from them.
  - **How the build treats it.** The build removes that header and concatenates the parts in recipe order.
  - **What is proven.** The assembled file is byte-identical to the file it replaces. A checker (`dev/tools/checks/parts.js`, since
    M3) parses the assembled output with TypeScript and verifies each declared interface against the code: what the part provides
    to the others, what it uses of theirs, and which of their bindings it writes. A split must fall between statements.
  - **What stays.** Parts still share their closure. That coupling is recorded per file as architecture debt, with the condition
    for turning a part into a module later. It is not called "done".
- **Whole files** with one owner (`br-role.js`, `camera_policy.js` …) move as they are. They are split into parts only where that
  helps a reader find something.

## 4. Proof per wave

| Wave | Runtime effect | Proof |
|---|---|---|
| H3M-1 layout | files move; four path strings change (the web root, the generated server files, `death_srv.js`'s path to `dphys.js`, the server's requires) | every output byte-identical to the parent's file; server and client goldens identical to the B++ baselines; every HTTP response identical to the parent's; negative paths 404; two real browsers |
| H3M-2 server modules (done at M2) | `server.js` becomes the composition root; its code is regrouped by owner. The WebSocket session, which holds the passcode check and its lockout, stays in `server.js` (M-023) | server goldens byte-identical (traces, timers, sockets, console), protocol, mutants, live real-server checks, two real browsers |
| H3M-3..5 parts (done at M3) | none: byte-identical outputs | `build:check` (bytes), the parts checker, a smoke run |
| H3M-6 bundle (revised at M1-R, ADR-002; done at M6a) | none: the bundle and stylesheet become build outputs of the v11 output plus the lineage ledger, byte-identical; the PixiJS chunks, copies of the v11 output | `lineage.js verify` (every step's hashes, the replayed files = the shipped ones), `build:check`, the recovered snapshot's blob and tree ids, the `__api` contract ledger |
| H3M-7 archive and docs (done at M7) | none: 129 root files moved into `dev/archive/` byte for byte; a short root README; the developer documentation; a `docs` gate step | hash ledger (before = after), reference audit, root listing and scorecard, the scope step (moved and replaced files declared), the docs check and its tamper cases, the fast gate |
| H3M-8 final | none | the full gate against B++ and 3H2; clean-checkout build; package |

## 5. Gate and tests

**As built at H3M-1** (`dev/tools/gate/README.md`):
- **The modernization gate** (`dev/tools/gate/gate.js`; `npm run gate`, `npm run gate:full`) is Stage 3H2's gate carried onto the new
  layout. It keeps the same steps, the same B++ baselines and the same rule (a step that compared nothing is a FAIL).
- **The 3H2 and 3H0 tools are left as they are,** for the frozen layout. Each tool that read a runtime file by path has a layout-aware
  copy in `dev/tools/gate/golden/` or `checks/`, and each copy says what it changed. Each copy is shown, on the frozen parent's own
  layout, to give the same results as its original (`tools/m1_copies_equivalence.js`).
- **The server goldens run old and new sides as 3H0 did.**
  - Old side: B++'s `server.js` runs against the working tree's runtime under its old names (`dev/tools/layout.js` `projectOld`, a
    scratch folder).
  - New side: the working tree's `server.js` runs in the working tree.
  - The harness records a require that resolves to the sim or the death module under its pre-existing name, so a trace does not depend
    on where a file lives. Nothing is relaxed: the traces must equal the stored B++ baselines byte for byte.
- **The scope step asks about content, not paths** (`scope_m.js`). Each runtime file is B++'s file where the layout put it, or a
  change declared with its reason in `declared_changes.json`.
- **Path consumers.** The lasting tests (`dev/tests/`, `dev/harness.js`, `dev/move_model.js`, `dev/shadows/`, `dev/br-role/`,
  `dev/stage-3b-n/test_3bn.js`) read runtime files through `dev/tools/layout.js`. Their assertions are unchanged. The text-reading tests
  (`s_ir` I1, `s_humanqa_hotfix` X02) read the server's code across `server.js` and the modules split out of it (`layout.js`
  `serverSource()`, since H3M-2).

## 6. The compiled bundle (revised at M1-R, 2026-10-14; ADR-002)

**As decided at H3M-0** (superseded): the compiled bundle had no source (M-001). It was to stay as fixed bytes in `public/assets/`, a
compatibility island with its `__api` ledger, and the final status was to be VERIFIED PARTIAL for that part of the engine.

**Revised after the owner recovered the original source** (`SOURCE_RECOVERY_INTAKE.md`, M-011, M-012):
- **The source is authentic.** The v11 Vite + TypeScript project builds the original 304,183-byte bundle exactly.
- **Every later edit is reconciled.** The shipped bundle is that output plus 40 in-place edits, and the stylesheet plus 8. Both are
  recorded in `src/core/client/bundle/lineage/` as a ledger that replays byte for byte.
- **H3M-6 integration (done at M6a, after H3M-1 was gated at M1).**
  - The v11 project goes in as an isolated, independently rebuildable input: `src/core/client/bundle/original-v11/`, without the
    hosting id file (M-018). It is never merged into the root `package.json`.
  - The bundle and the stylesheet become build outputs: the v11 output plus the ledger, byte-identical, checked by `build:check`.
- **The TypeScript port of the 40 edits** is the condition for "compiled from readable source". It is a separate, gated program
  (ADR-002 P0 to P4), not started in this stage. Its status in the final report is PARTIAL: a compatibility island with complete lineage.
- **No change to the production bundle,** in this stage or by this plan, without the P3 proof and the owner's Human QA.

**The order of work after the resumption** (the owner's order of 2026-10-14):
1. **M1-R.** This intake, the lineage, the contract and the revised plan, checkpointed. Done.
2. **H3M-1.** Finish the test and harness migration and the gate. Done at M1.
3. **H3M-6.** The integration described above. Done at M6a.
4. **H3M-2** (done at M2, with the session held in `server.js`: M-023), **H3M-3 to H3M-5** (done at M3), **H3M-7** (done at M7), then
   **H3M-8,** as planned.
