# src/core/client/bundle: the compiled client bundle's source record

The page's core is one compiled ES module, `public/assets/index-DKbV5Nv9.js`. It holds:
- the PixiJS renderer setup;
- the Level 0 map, the camera and the local game loop;
- the avatar, death and corpse classes;
- the game side of the menus;
- `window.__api`, the facade the classic scripts read.

Its stylesheet is `public/assets/index-D7hdwmUU.css`. Both names are Vite content hashes from the original build. They have stayed the same while the files were edited in place.

## Where the bytes come from

1. **The original TypeScript project.** The owner recovered it (Stage 3H, 2026-10-14; archive SHA-256 `9f4aeac3…`).
   - Version 11 (`49743e94d6f0`, tree `b80323b0…`) has `client/` and `shared/` TypeScript, its lockfile (Vite 8.3.1, TypeScript 7.0.2, PixiJS 8.21.0) and its build output.
   - Its build output reproduces the original 304,183-byte `index-DKbV5Nv9.js` exactly. Its 11 PixiJS chunks are the ones `public/assets/` ships, byte for byte.
2. **Forty later edits of the compiled file.** Two were made in historical packages before this repository existed; 38 are commits of this repository. They took the bundle from 304,183 to 340,823 bytes. None of them changed the TypeScript.

`lineage/` records every one of those edits as a patch on the bytes of the version before it, with both versions' SHA-256:

| File | What it is |
|---|---|
| `lineage/ledger.json` | The three chains (bundle, stylesheet, `index.html`): base, steps in order, sources (package or commit), sizes, hashes |
| `lineage/bundle/B01.json` … `B40.json`, `css/C01…C08.json`, `html/H01…H35.json` | The patches: `[byte offset, removed text, written text]` hunks |
| `lineage/STEPS.md` | Generated: every step, what it did and which framework owns it today; who wrote the shipped bundle's bytes |
| `lineage/descriptions.json` | Hand-written: the "what it did" and "owner" columns |
| `lineage/module_map.json` | Derived: which byte range of the v11 bundle each original TypeScript module compiled to |
| `lineage/blame.json` | Derived: for every byte of the shipped bundle, the step that wrote it ("v11" = the original build) |
| `api_contract.json`, `API_CONTRACT.md` | The `window.__api` contract: 52 members, what each is (down to the TypeScript declaration), who wrote it, who reads it |

**In numbers.** Of the shipped bundle's 340,823 bytes, 296,552 are the v11 build's bytes, unchanged:
- 251,140 of them are PixiJS;
- 45,412 are the game's own code compiled from the TypeScript.

The other 44,271 bytes were written by the 40 later steps.

## Checking it

```text
node dev/tools/lineage/lineage.js verify --recovery <the extracted recovery folder>   # replays all three chains from the v11 build
node dev/tools/lineage/lineage.js show B28                                             # one step's hunks, with context
node dev/tools/lineage/lineage.js blame                                                # who wrote the shipped bundle's bytes
```

`verify` passes only when every step's hashes hold and the replayed bundle and stylesheet are byte-identical to the files in `public/`. It
reports `index.html` too; the page's later hand edits are not ledger steps.

## Status (Stage 3H)

| Part | State |
|---|---|
| Recovered v11 TypeScript authenticated (archive, history, snapshots, build receipts) | DONE (`dev/stage-3h-modernization/SOURCE_RECOVERY_INTAKE.md`) |
| Lineage of the bundle, stylesheet and page, replayed byte for byte | DONE |
| `window.__api` contract with its TypeScript origins and readers | DONE |
| The v11 project in this repository as an isolated, independently rebuildable input; the bundle and stylesheet built from it plus the ledger by `npm run build`, checked by `build:check` | PLANNED for H3M-6 (`docs/architecture/ADRS/ADR-002-client-bundle-source.md`) |
| The 40 later edits ported into TypeScript, so that the bundle is compiled from readable source | PLANNED, not started: a separately gated program, one concern at a time (ADR-002). Until it is done, the post-v11 code exists only as patches on minified code: a COMPATIBILITY ISLAND with complete lineage |
| A fresh `npm ci && npm run build` of the v11 project on this machine | NOT TESTED here: no npm registry access in this session; the recovery's own receipt (Node 24.19.0, npm 11.9.0, 17 of 17 files identical) is the evidence |

**Do not hand-edit `public/assets/index-DKbV5Nv9.js` or `index-D7hdwmUU.css`.** Every byte of them is accounted for here. A change that
is not recorded would break that.
