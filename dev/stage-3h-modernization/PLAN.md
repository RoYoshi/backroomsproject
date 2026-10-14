# Stage 3H engine modernization: the plan as decided at H3M-0

This file states the decisions the waves follow. When the live code forces a change, it is recorded here and in an ADR (`docs/architecture/ADRS/`).

## 1. Where things live

```text
/                     README.md, package.json, server.js (thin bootstrap), redirect.js (deployment), run_*.sh/.bat, .github/
src/                  canonical, human-edited source
  core/server/        the server's composition root: configuration in, wiring, start
  core/client/        the page's composition: the multiplayer layer's prologue, per-frame hook, epilogue
  frameworks/<name>/  one folder per framework name; client/ server/ shared/ lanes only where code exists; README.md in each
  shared/             pure contracts and constants shared by several owners (no logic dumping ground)
  integrations/       explicit adapters between two owners
  build-recipes.json  every built output: its parts, in order
public/               THE WEB ROOT, and the only folder the server serves:
                        - static files (index.html, media, CSS, the manifest);
                        - the legacy compiled bundle and its PixiJS chunks (fixed bytes: a compatibility island);
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
  - **What is proven.** The assembled file is byte-identical to the file it replaces. A checker (`dev/tools/checks/`) parses the
    assembled output and verifies each declared interface against the code.
  - **What stays.** Parts still share their closure. That coupling is recorded per file as architecture debt, with the condition
    for turning a part into a module later. It is not called "done".
- **Whole files** with one owner (`br-role.js`, `camera_policy.js` …) move as they are. They are split into parts only where that
  helps a reader find something.

## 4. Proof per wave

| Wave | Runtime effect | Proof |
|---|---|---|
| H3M-1 layout | files move; four path strings change (the web root, the generated server files, `death_srv.js`'s path to `dphys.js`, the server's requires) | every output byte-identical to the parent's file; server and client goldens identical to the B++ baselines; every HTTP response identical to the parent's; negative paths 404; two real browsers |
| H3M-2 server modules | `server.js` becomes a bootstrap; its code is regrouped by owner | server goldens byte-identical (traces, timers, sockets, console), protocol, mutants, live real-server checks, two real browsers |
| H3M-3..5 parts | none: byte-identical outputs | `build:check` (bytes), the parts checker, a smoke run |
| H3M-6 bundle | none | provenance, `__api` ledger, checksums |
| H3M-7 archive and docs | none | hash ledger (before = after), reference audit, root listing |
| H3M-8 final | none | the full gate against B++ and 3H2; clean-checkout build; package |

## 5. Gate and tests

- **The modernization gate** (`dev/tools/gate/`) reuses the 3H2 baselines and steps. Its harness copies know the new layout:
  - the server harness records the same seven pre-existing requires wherever in the server graph they are made, so traces stay
    comparable without relaxing them;
  - the client harness reads `public/`.
- **The 3H2 tools are left as they are**, for the frozen layout.
- **Path consumers.** Tests and tools that name runtime files by path read them through one layout map (`dev/tools/layout.js`)
  instead of hard-coded root paths. Behaviour assertions are never relaxed. A text-reading test (`s_ir` I1, `s_humanqa_hotfix` X02)
  keeps its assertion and reads the file where the code now lives.

## 6. What this stage cannot finish

**The compiled bundle has no source** (`FINDINGS.md` M-001). It stays as fixed bytes in `public/assets/`, documented as a
compatibility island, with its `__api` contract ledger. Unless a faithful source can be proven, the final status is VERIFIED PARTIAL
for that part of the engine.
