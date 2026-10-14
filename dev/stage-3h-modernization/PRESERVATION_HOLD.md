# Stage 3H engine modernization: controlled preservation hold

**Status: PRESERVATION HOLD.** The owner asked to stop on 2026-10-14 because the original Vite/PixiJS source of the compiled client
bundle may have been found. Work stopped mid-H3M-1. This checkpoint preserves everything done so far. Stage 3H is not cancelled, and
nothing is accepted: HUMAN QA PENDING.

## 1. What is complete and verified

| Checkpoint | State | Evidence |
|---|---|---|
| H3M-0 preflight | committed `fe8f9b4a065b0046355c5427889aaaffd07e8dd4` (tree `a92f5474c71a78be8d64436bcd2322b13403bffa`), verified on GitHub | `PREFLIGHT.md`, `inventory/`, `evidence/m0/`, `evidence/remote/verify_m0_fe8f9b4.json` |
| H3M-1 layout (this commit) | the files are moved and build; **the tests and the gate are not yet adapted** (§3) | `evidence/m1-preservation/` |

**What this commit does (H3M-1, applied by `tools/m1_relocate.js --apply`).**
- **The web root is `public/`.** `server.js` serves only that folder, with the same `SERVE` allowlist, so the URL space is unchanged:
  - `index.html` and `favicon.ico` moved there unchanged (`git mv`);
  - the 20 files under `assets/` that are not first-party scripts moved unchanged: the compiled bundle, its 11 PixiJS chunks, two
    stylesheets, two images, the two menu-theme WAVs, the PWA manifest, the retired `shadows-2d.js`;
  - so did the 3 files under `sounds/`.
- **Canonical sources moved to their owners in `src/`** (`git mv`, contents unchanged): 22 client scripts and 7 server modules (`death_srv.js` and the 3H0/3H2 `server/*.js`).

  | Framework | Files |
  |---|---|
  | B++ | `net-wire.js`, `net-interp.js`, `ws.js`, `newrun.js` |
  | BR-R | `camera_policy.js`, `camcorder.js`, `l0-remaster.js` |
  | BR-RoLE | `light.js`, `br-role.js` |
  | S.P.A.C.E. | `world.js`, `timing_policy.js`, `move.js`, `peers.js` |
  | G.I.B. | `gore.js`, `dphys.js`, `aftermath.js`, `death_srv.js` |
  | Spacious Audio | `sfx.js`, `mp-hum.js` |
  | F.R.O.N.T. | `hud.js`, `ui.js`, `credits_data.js`, `net-newrun.js` |
  | L.O.S.T. | `glitch.js`, `level0_visuals.js` |
  | P.O.C.K.E.T. | `inventory.js` |
  | W.A.R.D. | `fields.js`, `static.js` |
  | core (`src/core/client/`) | `mp.js`, still whole; its split by owner is H3M-4 |

- **The parts of the three assembled files moved to their owners.**
  - The 6 `ents.js` parts went to BR-R, G.I.B., Spacious Audio and OVERSEER.
  - The 10 `ai.js` parts went to N.A.N.I.
  - The `sim.js` parts became `src/core/server/sim.header.js` (the header the old shell script printed),
    `src/frameworks/lost/server/sim.level0.js` (the old `dev/sim_head.js`; its non-built opening comment kept as a stripped part header)
    and `src/core/server/sim.glue.js`.
- **One cross-platform build.** `dev/tools/build/build.js` (zero dependencies; `npm run build` is not wired yet) builds 27 outputs from
  `src/build-recipes.json` into `public/` and `generated/server/`, and writes `generated/BUILD_MANIFEST.json`. The old
  `dev/build_*.sh` and the root `ai.js`, `ents.js` and `sim.js` are removed; the outputs replace them.
- **Four path edits, nothing else in code.**
  - `server.js`: the web root `public/`, and the require paths of the moved modules. The admin passcode line is untouched.
  - `death_srv.js`: reads the built `generated/server/dphys.js`.
  - `static.js`: one comment.
- **`dev/tools/layout.js`.** The layout map that tests and tools will use. Written, but nothing uses it yet.

**Verified on this tree** (`evidence/m1-preservation/`):

| Check | Result |
|---|---|
| `build.js --check` | PASS: 27 outputs and the manifest are what `src/` builds |
| outputs against the parent's files at their old paths | 27 of 27 byte-identical (`public/mp.js` = old `mp.js`, `generated/server/sim.js` = old `sim.js`, …); 25 of 25 static files identical |
| HTTP probe of a real server | 16 served paths 200. 19 others 404: `/server.js`, `/src/…`, `/generated/…`, `/dev/…`, `/public/…`, traversal (`/../`, `%2e%2e`), `/package.json`, `/redirect.js`, the old root paths of server-only files |
| one real WebSocket client | `hi`, `caps` answered, `join`, 53 snapshots in 3 s (the room's sim loads `generated/server/ai.js`) |
| two real pages (gameplay smoke, SwiftShader) | walk, full turn, light on/off, frames, NEW RUN approved with its run menu, the other page sees 6 gib pieces and the hands, spawn after; 0 page errors. The same as the 3H2 final gate's smoke |

## 2. The compiled client bundle: untouched

`public/assets/index-DKbV5Nv9.js` is the 3H2 and B++ file, byte for byte: SHA-256
`694bca01e75d8e1c70e9ec29ea5382da5bda40d22c6a4f043e6e53b251d7529b`, the same at `143b63f` and `22751bb`.

- Its only change is its folder (`assets/` → `public/assets/`); its URL is the same.
- Its 11 PixiJS chunks and `index-D7hdwmUU.css` moved the same way, unchanged.
- **No reconstruction, decompilation, beautification, replacement or wrapper of the bundle was started.** H3M-6 (the bundle's source
  and build) has not begun.
- The provenance facts gathered at H3M-0 are in `PREFLIGHT.md` §4 and `inventory/bundle.json`. They include the missing worker chunk
  `webworkerAll-ByhiNG9W.js`.

## 3. What is not finished (and must be done before this layout is a full checkpoint)

- **Tests and tools still read the old root paths, so on this tree they fail to find their files.** This covers:
  - the suites: `dev/harness.js`, `dev/move_model.js`, `s_audit`, `s_smiler`, `s_ir`, `s_humanqa_hotfix`, `s_shared2f`, `interp_test`,
    `audit_net*`, `test_shadows`, `test_br_role`, `test_3bn`;
  - the gate's harnesses: the 3H0 server harness (`srv_harness.js` intercepts `./sim.js` and `./death_srv.js` by name),
    `srv_golden.js`, `bpp_golden.js`, `perf_det.js` (they run B++'s `server.js` text against this tree's files), the 3H0 client page
    (`cli_lib.js` reads the root `mp.js`), `bpp_mutants.js`, `raw_live_h2.js`, `proto_check.js`.

  The plan is a layout-aware, backwards-compatible update of each (through `dev/tools/layout.js`), proven on the frozen parent first.
- **The modernization gate** (`dev/tools/gate/`) is not written. The 3H2 gate (`dev/stage-3h/gate/h2_gate.js`) targets the old layout.
- **Not started:** `package.json` scripts (`build`, `build:check`), `.gitignore` notes, `generated/README.md`, `public/README.md`, the
  framework READMEs and ADR-001 (layout).

Until those are done, the last fully gated checkpoint is the frozen parent `22751bb`. The tree here builds, serves and plays (§1), but
it has not been through the server and client goldens.

## 4. Remaining work after the hold (unchanged plan, `PLAN.md`)

1. **Finish H3M-1:** the path updates in §3, then the gate at the fast tier against the B++ baselines and the frozen parent, then two
   browsers. Push and verify.
2. **H3M-2:** `server.js` into owned CommonJS modules (composition root in `src/core/server/`), proven by the server goldens.
3. **H3M-3..5:** owner parts for `sim`, `world`, `mp`, `move` and the other multi-owner client scripts, with byte-identical outputs
   and checked interface headers.
4. **H3M-6, the bundle.** **Revisit before starting:** if the recovered Vite/PixiJS project is authentic and complete, H3M-6 becomes a
   source-build reproduction instead of a compatibility island. Its proof bar is unchanged: identical behaviour on the goldens, the
   protocol, two real browsers and the contact-lab images, and the `window.__api` contract (52 members, some minified) kept for its 15
   consumers.
5. **H3M-7:** archive the 128 root reports into `dev/archive/` (`inventory/ROOT_ARCHIVE_PLAN.csv`); developer docs.
6. **H3M-8:** the final gate, the package, the Human QA page, STOP.

## 5. How to resume

```text
git fetch origin && git checkout stage-3h-engine-modernization      # at this commit; verify it with tools/verify_remote_m.py
node dev/tools/build/build.js --check                               # must PASS
node dev/stage-3h-modernization/tools/m1_relocate.js --verify       # 27/27 outputs and 25/25 static files identical to 22751bb
```

Then continue at §4, item 1. To set this work aside entirely, the frozen parent `22751bb` (stage-3h) and B++ `143b63f` are unchanged.
