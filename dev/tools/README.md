# dev/tools: the lasting development tools

Development only. Nothing here is served or loaded by the game. Zero dependencies unless a line says otherwise.

| Tool | What it does | Command |
|---|---|---|
| `build/build.js` | Builds every output in `src/build-recipes.json` from its parts into `public/` (served) and `generated/server/` (loaded by the server), and records every hash in `generated/BUILD_MANIFEST.json`. `--check` fails when a committed output is not what `src/` builds | `npm run build`, `npm run build:check` |
| `layout.js` | Where the game's files are. Tests and tools ask it for a runtime file by its old root name (`mp.js`, `sim.js`, `server/ws.js`, `dev/ents_src/10_hound.js`) instead of hard-coding a path, so they work on this layout and on an old-layout tree (a B++ or Stage 3H2 export). `runtimeOf` lists a tree's runtime by old names; `projectOld` writes it out as an old-layout folder. Also a command line, for other languages: `node dev/tools/layout.js at sim.js` | — |
| `gate/` | The gate: the working tree against the accepted B++ game, deterministic and live. See `gate/README.md` | `npm run gate`, `npm run gate:full` |
| `lineage/lineage.js` | The client lineage ledger: replays how each file of the original v11 build became the shipped file, checking every step's hashes; prints any step; prints who wrote the shipped bundle's bytes. See `src/core/client/bundle/README.md` | `node dev/tools/lineage/lineage.js verify --recovery <dir>` |

Stage-specific tools stay in their stage's folder, for example `dev/stage-3h-modernization/tools/`. The tools of earlier stages are
kept as they were, for their own layout: `dev/stage-3h0/`, `dev/stage-3h/` and the rest.
