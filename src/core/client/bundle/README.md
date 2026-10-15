# src/core/client/bundle: the compiled client's history and its records

The page's core is one compiled ES module, `public/assets/index-DKbV5Nv9.js`. It holds:
- the PixiJS renderer setup;
- the Level 0 map, the camera and the local game loop;
- the avatar, death and corpse classes;
- the game side of the menus;
- `window.__api`, the facade the classic scripts read.

Its stylesheet is `public/assets/index-D7hdwmUU.css`. Both names are Vite content hashes from the original build. They have stayed the
same while the files changed, and the build keeps them.

**Since Stage 3H continuation C4b both files are built from readable source:** `../game/` (TypeScript, PixiJS and Vite: the v11 project
with the forty later edits ported; its README and `PORT_LEDGER.md`), by `dev/tools/build/client.js`. This folder keeps what that source
came from and how it is proven: the recovered v11 project, the lineage of every edit made to the compiled files before the port, and the
`window.__api` contract.

## Where the bytes came from

1. **The original TypeScript project,** kept here in `original-v11/`.
   - The owner recovered it (Stage 3H, 2026-10-14; archive SHA-256 `9f4aeac3…`).
   - Version 11 (`49743e94d6f0`, tree `b80323b0…`) has `client/` and `shared/` TypeScript, its lockfile (Vite 8.3.1, TypeScript 7.0.2,
     PixiJS 8.21.0) and its build output (`dist/`).
   - Its build output reproduces the original 304,183-byte `index-DKbV5Nv9.js` exactly. Its 11 PixiJS chunks are the ones
     `public/assets/` ships, byte for byte.
2. **Forty later edits of the compiled file.** Two were made in historical packages before this repository existed; 38 are commits of
   this repository. They took the bundle from 304,183 to 340,823 bytes, the file the game shipped until continuation C4a. None of them
   changed the TypeScript: continuation C4 ported each into `../game/` (`../game/PORT_LEDGER.md` says where each one's text is now).

| File | What it is |
|---|---|
| `original-v11/` | The recovered v11 project, byte for byte, without `.openai/hosting.json` (the old hosting account's project id; FINDINGS M-018). **Never edit it**: it is a historical input (`../game/` started as a copy of it) |
| `ORIGINAL_V11_PROVENANCE.json` | Every file of the snapshot with its Git blob id and SHA-256, the omitted file's blob id, the v11 commit and tree, the toolchain and the recovery's rebuild receipt |
| `lineage/ledger.json` | The three chains (bundle, stylesheet, `index.html`): base, steps in order, sources (package, commit or recorded), sizes, hashes. The bundle's and the stylesheet's are marked superseded since C4b: their history up to then |
| `lineage/bundle/B01.json` … `B40.json`, `css/C01…C08.json`, `html/H01…H35.json` | The patches: `[byte offset, removed text, written text]` hunks |
| `lineage/STEPS.md` | Generated: every step, what it did and which framework owns it today; who wrote the recorded bundle's bytes |
| `lineage/descriptions.json` | Hand-written: the "what it did" and "owner" columns |
| `lineage/module_map.json` | Derived: which byte range of the v11 bundle each original TypeScript module compiled to |
| `lineage/blame.json` | Derived from the ledger: for every byte of the recorded bundle, the step that wrote it ("v11" = the original build) |
| `api_contract.json`, `API_CONTRACT.md` | The `window.__api` contract: 52 members, what each is (down to the TypeScript declaration), who wrote it, who reads it; and (`builtBundle`) that the served bundle publishes the same 52 members in the same order and reads the same ones |

**In numbers.** Of the recorded bundle's 340,823 bytes, 296,552 are the v11 build's bytes, unchanged:
- 251,140 of them are PixiJS;
- 45,412 are the game's own code compiled from the TypeScript.

The other 44,271 bytes were written by the 40 later steps. The bundle built from `../game/` is 336,622 bytes: the same program
(below), minified again as a whole.

## How the build makes the served files

`node dev/tools/build/client.js --packages <folder> --write` (it needs the 31 locked npm packages, never committed: each is checked
against the lockfile, then installed offline) builds `../game/` and writes:

| Served file | Made from |
|---|---|
| `public/assets/index-DKbV5Nv9.js` | `../game/` (`client/main.ts` and every module it imports), built by Vite with the one definition of Level 0 and of the carried lights (`src/frameworks/lost/shared/level0.json`, `src/frameworks/pocket/shared/lights.json`; continuation C4c) |
| `public/assets/index-D7hdwmUU.css` | `../game/client/style.css` (v11's, minified as v11 built it), then `client/style-after-v11.css` (the eight later steps' rules, appended as they are) |
| the 11 PixiJS chunks (`BufferResource-…`, `Cache-…`, … `init-…`) | PixiJS, from the lockfile: the same bytes as v11's `dist/` (the build recipes copy those) |

and its record, `generated/CLIENT_BUILD.json`: every source file of `../game/` and every output, with SHA-256. `npm run build` and
`npm run build:check` (no packages needed) check the served bundle and stylesheet against that record: a source edited and not built,
or a served file edited by hand, fails. Until C4a both files were a replay of the lineage (the v11 output, then the steps), and the
replay is still checked: `lineage.js verify` replays every chain to its recorded result.

`public/index.html` is not built: it stays the page's hand-edited source. Its chain is recorded and verified, not enforced (ADR-002).

## How the port is proven the same program

| Check | What it compares |
|---|---|
| `dev/stage-3h-modernization/tools/c4_alpha_all.mjs` | every top-level statement of the recorded bundle's app code (rebuilt in memory from the lineage) with the port, modulo the names of bindings and a stated normal form (`c4_alpha.mjs`'s header); the deliberate changes of structure are listed with their reasons in `c4_alpha_modules.json` |
| `dev/stage-3h-modernization/tools/c4_css_check.mjs` | the built stylesheet with the recorded one: v11's part byte for byte, then the same statements |
| `dev/tools/gate/golden/bundle_diff.js` | the built client and the recorded one in Chromium, frame by frame: randomness, game state, the document, every 2D canvas and audio call, the shared window objects, pixels, computed styles |
| `dev/stage-3h-modernization/tools/api_contract.js` | the served bundle publishes the same 52 `window.__api` members in the same order, and reads the same ones |
| `c4_port_mutants.mjs`, `dev/tools/gate/golden/bundle_mutants.js` | that those checks see a small real change |

The gate's `port` and `bundle` steps run them.

## Checking it

```text
npm run build:check                                  # the served files are the client build's record, and the sources the recorded ones
node dev/tools/build/client.js --record-check        # the same, for the client alone
node dev/tools/build/client.js --packages <folder> --stage <scratch>   # build it again, into a scratch folder
node dev/tools/lineage/lineage.js verify             # replays all three chains to their recorded results; checks blame.json
node dev/tools/lineage/lineage.js tree-id            # original-v11/ plus the omitted file hash to the v11 commit's tree id b80323b0…
node dev/tools/lineage/lineage.js show B28           # one step's hunks, with context
node dev/tools/lineage/lineage.js blame              # who wrote the recorded bundle's bytes
```

## Changing the bundle or the stylesheet

Edit `../game/` (the source comments name each lineage step and owner), then:

```text
1. node dev/tools/build/client.js --packages <folder> --write   # public/assets/ and generated/CLIENT_BUILD.json
2. npm run build                                                # the manifest
3. npm run build:check
4. node dev/stage-3h-modernization/tools/api_contract.js && node dev/stage-3h-modernization/tools/lineage_doc.js   # the contract
```

A change of behaviour is a gameplay change: the owner's to approve, and the gate's `port` and `bundle` steps will report it (they
compare the build with the recorded client). `lineage.js record` refuses the superseded chains: the ledger is history.

## Status (Stage 3H)

| Part | State |
|---|---|
| Recovered v11 TypeScript authenticated (archive, history, snapshots, build receipts) | DONE (`dev/stage-3h-modernization/SOURCE_RECOVERY_INTAKE.md`) |
| Lineage of the bundle, stylesheet and page, replayed byte for byte | DONE |
| `window.__api` contract with its TypeScript origins and readers | DONE |
| The v11 project in this repository as an isolated input (`original-v11/`, its tree id proven) | DONE at M6a |
| A fresh `npm ci && npm run build` of `original-v11/` (in a copy, never in place) | DONE at continuation C1, offline from the owner's verified packages: 17 of 17 `dist/` files byte-identical (M-017, `dev/stage-3h-modernization/evidence/c1/`) |
| The 40 later edits ported into readable TypeScript (`../game/`), built offline and proven the same program | DONE at continuation C4a (`dev/stage-3h-modernization/evidence/c4a/`) |
| The served bundle and stylesheet built from `../game/` (the replay retired, its chains kept as history) | DONE at continuation C4b |
| One Level 0: the map and the lights one definition, for the server and the bundle (M-003) | DONE at continuation C4c (`dev/stage-3h-modernization/evidence/c4c/`) |
