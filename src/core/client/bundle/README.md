# src/core/client/bundle: the compiled client bundle's source and its record

The page's core is one compiled ES module, `public/assets/index-DKbV5Nv9.js`. It holds:
- the PixiJS renderer setup;
- the Level 0 map, the camera and the local game loop;
- the avatar, death and corpse classes;
- the game side of the menus;
- `window.__api`, the facade the classic scripts read.

Its stylesheet is `public/assets/index-D7hdwmUU.css`. Both names are Vite content hashes from the original build. They have stayed the same while the files were edited in place.

## Where the bytes come from

1. **The original TypeScript project,** kept here in `original-v11/`.
   - The owner recovered it (Stage 3H, 2026-10-14; archive SHA-256 `9f4aeac3…`).
   - Version 11 (`49743e94d6f0`, tree `b80323b0…`) has `client/` and `shared/` TypeScript, its lockfile (Vite 8.3.1, TypeScript 7.0.2, PixiJS 8.21.0) and its build output (`dist/`).
   - Its build output reproduces the original 304,183-byte `index-DKbV5Nv9.js` exactly. Its 11 PixiJS chunks are the ones `public/assets/` ships, byte for byte.
2. **Forty later edits of the compiled file.** Two were made in historical packages before this repository existed; 38 are commits of this repository. They took the bundle from 304,183 to 340,823 bytes. None of them changed the TypeScript.

| File | What it is |
|---|---|
| `original-v11/` | The recovered v11 project, byte for byte, without `.openai/hosting.json` (the old hosting account's project id; FINDINGS M-018). **Never edit it**: it is a historical input |
| `ORIGINAL_V11_PROVENANCE.json` | Every file of the snapshot with its Git blob id and SHA-256, the omitted file's blob id, the v11 commit and tree, the toolchain and the recovery's rebuild receipt |
| `lineage/ledger.json` | The three chains (bundle, stylesheet, `index.html`): base, steps in order, sources (package, commit or recorded), sizes, hashes |
| `lineage/bundle/B01.json` … `B40.json`, `css/C01…C08.json`, `html/H01…H35.json` | The patches: `[byte offset, removed text, written text]` hunks |
| `lineage/STEPS.md` | Generated: every step, what it did and which framework owns it today; who wrote the shipped bundle's bytes |
| `lineage/descriptions.json` | Hand-written: the "what it did" and "owner" columns |
| `lineage/module_map.json` | Derived: which byte range of the v11 bundle each original TypeScript module compiled to |
| `lineage/blame.json` | Derived from the ledger: for every byte of the shipped bundle, the step that wrote it ("v11" = the original build) |
| `api_contract.json`, `API_CONTRACT.md` | The `window.__api` contract: 52 members, what each is (down to the TypeScript declaration), who wrote it, who reads it |

**In numbers.** Of the shipped bundle's 340,823 bytes, 296,552 are the v11 build's bytes, unchanged:
- 251,140 of them are PixiJS;
- 45,412 are the game's own code compiled from the TypeScript.

The other 44,271 bytes were written by the 40 later steps.

## How the build makes the served files

`npm run build` (`dev/tools/build/build.js`, recipes in `src/build-recipes.json`) writes them:

| Served file | Recipe |
|---|---|
| `public/assets/index-DKbV5Nv9.js` | a **replay**: the v11 output `original-v11/dist/assets/index-DKbV5Nv9.js`, then steps B01 to B40 |
| `public/assets/index-D7hdwmUU.css` | a **replay**: the v11 output's stylesheet, then steps C01 to C08 |
| the 11 PixiJS chunks (`BufferResource-…`, `Cache-…`, … `init-…`) | the v11 output's own file, unchanged |

A replay checks every step: its patch must find the bytes it was made on (SHA-256 before), and it must give the bytes it records
(SHA-256 after). If any check fails, the build stops. `npm run build:check` fails when a served file is not what the replay gives, so a
hand edit is caught.

`public/index.html` is not built: it stays the page's hand-edited source. Its chain is recorded and verified, not enforced (ADR-002).

## Checking it

```text
npm run build:check                                  # the served bundle, stylesheet and chunks are what the replay gives
node dev/tools/lineage/lineage.js verify             # replays all three chains; checks blame.json
node dev/tools/lineage/lineage.js tree-id            # original-v11/ plus the omitted file hash to the v11 commit's tree id b80323b0…
node dev/tools/lineage/lineage.js show B28           # one step's hunks, with context
node dev/tools/lineage/lineage.js blame              # who wrote the shipped bundle's bytes
```

The gate runs the first three (its `build` and `lineage` steps).

## Changing the bundle or the stylesheet

Until a concern is ported to TypeScript (ADR-002, P2), a change to either file is a new ledger step. It is never a silent hand edit:

```text
1. edit public/assets/index-DKbV5Nv9.js (or index-D7hdwmUU.css)
2. node dev/tools/lineage/lineage.js record bundle --label "<what changed and why>" --owner <framework>
3. npm run build                                     # the manifest
4. npm run build:check && node dev/tools/lineage/lineage.js verify
5. node dev/stage-3h-modernization/tools/lineage_doc.js        # the generated pages
```

`record` writes the smallest token edit as the next step (B41, C09, …) and rewrites `blame.json`. It needs `git` for the diff.

## Status (Stage 3H)

| Part | State |
|---|---|
| Recovered v11 TypeScript authenticated (archive, history, snapshots, build receipts) | DONE (`dev/stage-3h-modernization/SOURCE_RECOVERY_INTAKE.md`) |
| Lineage of the bundle, stylesheet and page, replayed byte for byte | DONE |
| `window.__api` contract with its TypeScript origins and readers | DONE |
| The v11 project in this repository as an isolated input (`original-v11/`, its tree id proven) | DONE at M6a |
| The bundle, the stylesheet and the PixiJS chunks built from it by `npm run build`, and checked by `build:check` | DONE at M6a: byte-identical to the files they replace |
| The 40 later edits ported into TypeScript, so that the bundle is compiled from readable source | PLANNED, not started: a separately gated program, one concern at a time (ADR-002). Until it is done, the post-v11 code exists only as patches on minified code: a COMPATIBILITY ISLAND with complete lineage |
| A fresh `npm ci && npm run build` of `original-v11/` (in a copy, never in place) | DONE at continuation C1, offline from the owner's verified packages: 17 of 17 `dist/` files byte-identical (`node dev/stage-3h-modernization/tools/c1_rebuild_v11.js --packages <folder> --work <new folder>`; M-017, `dev/stage-3h-modernization/evidence/c1/`) |
