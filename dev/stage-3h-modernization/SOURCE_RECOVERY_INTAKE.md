# Stage 3H engine modernization: intake of the recovered original source (2026-10-14)

The owner's resumption order: *"Authenticate the recovered original TypeScript source, then reconcile every modern post-original
client change before rebuilding/replacing the client."* This file records what was received, how it was authenticated, what it
proves, and what was decided. Nothing here changes the game.

## 1. What was received

| Item | SHA-256 | Checked |
|---|---|---|
| `THE_FAR_BACKROOMS_STAGE_3H_FINAL_CLAUDE_HANDOFF.zip` | `654fd03c1d70af867a1b3a270071b2497019f15071db646146bcf3f14795c6f2` | matches the owner's `.sha256`; its `SHA256SUMS.txt`: all 7 items OK |
| `01_ORIGINAL_SOURCE_RECOVERY.zip` (46,165,853 bytes) | `9f4aeac34c8205cf4ace7c57d8b3cb4a97f4c5b29b35c44980ab8c08ac7505e7` | §2 |
| `02_STAGE_3H_FULL_ENGINE_MODERNIZATION_MASTER_PACK.zip` | `09d5f6b9…` | identical to the pack received at H3M-0 (the implementation specification) |
| `03_STAGE_3H_SOURCE_RECOVERY_SUPPLEMENT.zip` | `be370324…` | its `CHECKSUMS.sha256`: all 9 files OK; its read-only `verify_original_recovery.py` (read in full first) printed `PASS` |

The archives were extracted into new, empty scratch folders outside this repository, after a path check (no absolute paths, no `..`,
no links). The extracted recovery was made read-only. **No recovered file was edited.** Everything below reads it or copies it.

## 2. Authentication

`tools/recovery_verify.py` runs the checks again, read-only (`evidence/m1-resume/recovery_verify.json`).

| Check | Result |
|---|---|
| Archive SHA-256, 533 members, no unsafe path, every ZIP CRC | PASS |
| The 532 payload lines of its `SHA256SUMS.txt` | PASS, 0 mismatches |
| Git history bundle cloned into a new folder, `git fsck --full --strict` | PASS: 11 commits, `c063012e84a6…` (2026-09-28) to `49743e94d6f0…` (v11, tree `b80323b0ee9c9124453e2d0a62c5f894c8f41db7`) |
| Each of the 11 `versions/site-vNN-…` snapshots against its commit (Git blob id of every tracked file, nothing extra) | PASS: 434 file instances |
| v11 `dist/assets/index-DKbV5Nv9.js` | 304,183 bytes, `82fb8ff4…`. It equals the independently uploaded copy of 2026-09-29 and the recovery's own receipt |
| v11 `dist/` against the recovery's build receipt (`verification/BUILD_REPRODUCTION.json`) | PASS: 17 of 17 files. The receipt records Node 24.19.0, npm 11.9.0, `npm ci --ignore-scripts && npm run build`, and 17 of 17 identical |
| **A fresh rebuild on this machine** | **NOT RUN.** This session cannot reach the npm registry: the network policy answers 403 to `registry.npmjs.org`, and there is no direct DNS. The rebuild evidence is the recovery's receipt plus the byte identity above |

**Verdict: authentic.**
- The v11 TypeScript project is the source of the original 304,183-byte bundle.
- Its history is complete from the first recorded commit.
- The commits are authored "Codex", from the owner's original hosted Site.

## 3. What the recovered project is

- **Location.** `versions/site-v11-49743e94d6f0/`.
- **TypeScript.** `client/` has `main.ts` (boot, input, loop), `render.ts`, `audio.ts`, `player-view.ts`, `entity-view.ts`, `death.ts`,
  `corpse-view.ts`, `appearance.ts` and `loadout.ts`. `shared/` has `world.ts`, `movement.ts`, `entity.ts`, `navigation.ts`,
  `vision.ts`, `avatar.ts`, `equipment.ts`, `evidence.ts` and `remains.ts`. That is 77,892 bytes of TypeScript.
- **Build.** Vite defaults: there is no `vite.config.*`. `npm run build` runs `tsc --noEmit && vite build`.
- **Locked versions.** Vite 8.3.1, TypeScript 7.0.2, PixiJS 8.21.0, lockfile v3.
- **Its `package.json` declares `"type": "module"`.** It must never replace this repository's root `package.json`: the server is
  CommonJS.
- **`.openai/hosting.json`** holds the original hosting account's project id. No build reads it. It will not be copied into this public
  repository (M-018).

## 4. The v11 output against what this repository serves

| v11 `dist/` file | Served file | Same bytes? |
|---|---|---|
| the 11 PixiJS chunks (`BufferResource`, `Cache`, `CanvasPool`, `Filter`, `GCManagedHash`, `GraphicsContext`, `RenderTargetSystem`, `browserAll`, `canvasUtils`, `getTextureBatchBindGroup`, `init`) | `public/assets/…` | **yes, all 11** |
| `assets/index-DKbV5Nv9.js` (304,183) | 340,823 bytes | no: 40 later edits (§5) |
| `assets/index-D7hdwmUU.css` (9,899) | 27,218 bytes | no: 8 later edits |
| `index.html` (6,483) | 24,568 bytes | no: 35 later edits |
| `assets/carpet.png` (3,403,023) | 463,327 bytes | no. The served one is a **procedural placeholder** made during the HAR recovery, which had not captured the image (M-013) |
| `assets/concrete.webp` | not served | the v11 bundle does not use it (M-015) |
| `assets/webworkerAll-ByhiNG9W.js` (55 bytes) | not served | PixiJS's Web Worker entry. A browser page never requests it (M-002, M-014) |

## 5. The lineage: every post-original client change, reconciled

`tools/lineage_derive.js` built the chain of every version of the three edited files, oldest first:
1. the v11 output;
2. the historical packages, in the order they were made;
3. every commit of this repository that changed the file, up to the frozen parent `22751bb`.

It records each step as a patch on the bytes of the version before it, and checks each patch by applying it. The results are in
`src/core/client/bundle/lineage/`. `lineage/STEPS.md` has every step, with what it did and its owner.

| File | Steps | Pre-repository packages | Repository commits | Result |
|---|---|---|---|---|
| bundle `index-DKbV5Nv9.js` | 40 | 2 (`refined-entity-build`, `level0-refined-v3`) | 38 (`c9bd4da` "fs" … `ce6fe63` Stage 3D HQ4-1) | 340,823 bytes, `694bca01…` = B++ = 3H2 = this tree |
| stylesheet `index-D7hdwmUU.css` | 8 | 1 | 7 | 27,218 bytes, `02d94e78…` = B++ = 3H2 = this tree |
| `index.html` | 35 | 1 | 34 (32 to B++, plus 3H2's C-3 and C-4 script tags) | 24,568 bytes, `ca02fd16…` = 3H2 = this tree |

- **Corroboration.** The packages `recovered-build`, `v15`, `v15.1` and `v16` hold exactly the bytes of the v11 output and of commits
  `e68caf5`, `5bc12b4` and `f53d218`.
- **Side version.** The `v20` package's bundle (329,248 bytes) is not on the repository's path: it is a variant 269 token-bytes from
  `bd95943` (v18).
- **Replay.** `dev/tools/lineage/lineage.js verify` replays all three chains and passes (`evidence/m1-resume/lineage_verify.json`).
- **Who wrote the shipped bundle** (`lineage/blame.json`):
  - 296,552 of its 340,823 bytes are the v11 output's, unchanged: all 251,140 PixiJS bytes, and 45,412 of the game's 53,043 compiled
    bytes;
  - 44,271 bytes were written by the 40 steps, in 910 runs. 726 of those runs are under 50 bytes.
- **Which original modules the edits touched** (`lineage/module_map.json`, derived by matching units of the bundle against units of the
  TypeScript): the most rewritten were `client/entity-view.ts` (30 % of its compiled bytes remain) and `shared/evidence.ts` (46 %).
  `client/render.ts` keeps 98 %.

## 6. The `window.__api` contract

`src/core/client/bundle/API_CONTRACT.md`, from `tools/api_contract.js`:
- **52 members.** Each one's value is traced to the TypeScript declaration it compiled from, or to the later step that wrote it. For
  example: `Oc` = `shared/world.ts` `rooms`, `Uc` = `rayDistance`, `H` = `shared/movement.ts` `player`, `X` = `client/main.ts`
  `renderer`.
- **16 loaded readers,** plus the retired `assets/shadows-2d.js` and the bundle itself. Names are resolved by TypeScript's checker,
  per script.
- **12 members are read by no script found.** They stay in the contract.
- **It is consistent with 3H1's audit:** 15 loaded readers then, plus `assets/mp-hum.js`, which 3H2 C-4 split out of `mp.js`.

## 7. Decisions

- **ADR-002** (`docs/architecture/ADRS/ADR-002-client-bundle-source.md`). The bundle and stylesheet are to be built from the v11 output
  plus the ledger, byte-identical, and checked by `build:check`.
  - The v11 project is to be an isolated input under `src/core/client/bundle/original-v11/`.
  - The TypeScript port of the 40 edits is a separate, gated program (P0 to P4). It is not started here, and stays PARTIAL.
- **The plan's order follows the owner's resumption order:**
  1. this intake and the revised plan (checkpoint M1-R);
  2. finishing H3M-1's test migration and gate;
  3. the H3M-6 integration;
  4. the remaining waves.
- **The production bundle is not replaced, rebuilt or touched.** Its bytes are the same at B++, at 3H2 and here.
