# The build: from `src/` to what the browser and the server load

## In one paragraph

`npm run build` (`dev/tools/build/build.js`; no dependencies) reads `src/build-recipes.json` and writes every output in it: the scripts
the browser loads into `public/`, and the scripts the server loads into `generated/server/`. It records every input and output, with
their SHA-256, in `generated/BUILD_MANIFEST.json`. The outputs are committed, because the production host pulls `main` and runs
`node server.js` with no build step. `npm run build:check` builds in memory and fails if anything committed differs. The gate runs it.
The one exception is the compiled client (the bundle and its stylesheet): it is TypeScript built by Vite, so its own tool,
`dev/tools/build/client.js`, builds it with the locked npm packages, and `build.js` checks it against that build's record.

## Four kinds of output

| Kind | How it is built | Example |
|---|---|---|
| **Parts, joined** | Each part's text, in recipe order. A part file may begin with a `/** @part ... */` header, which the build removes: nothing else is changed (no minifying, no transpiling, no wrapping) | `public/mp.js`: 12 parts from 8 frameworks' folders and `src/core/` (11 modules and their composition) |
| **A copy of the recovered v11 build** | One part: a file of `src/core/client/bundle/original-v11/dist/` | the 11 PixiJS chunks |
| **The compiled client** (since continuation C4b) | Built from `src/core/client/game/` (TypeScript, PixiJS, Vite), and since C4c the one definition of Level 0 and of the lights it shares with the server (`src/frameworks/lost/shared/level0.json`, `src/frameworks/pocket/shared/lights.json`; `src/core/client/game/level-data.cjs` makes their values the build's constants), by `dev/tools/build/client.js --write`, which needs the 31 locked npm packages (each checked against the lockfile, installed offline) and writes its record, `generated/CLIENT_BUILD.json` (every source and output with SHA-256). `build.js` does not build it: it checks that the sources are the recorded ones and the files the recorded outputs | `public/assets/index-DKbV5Nv9.js`, `index-D7hdwmUU.css` |
| **A replay of the lineage ledger** (H3M-6 to continuation C4a) | The v11 build output, then every recorded step's patch, each checked by its SHA-256 before and after. No output is made this way since C4b; `lineage.js verify` still replays the chains, as history | (until C4a) the bundle and its stylesheet |

The parts of one script are joined inside one wrapper (an IIFE, a UMD factory). In the server's `ai.js` they share that closure: each
part's header says what it provides to the others, what it uses of theirs and which of their bindings it writes;
`dev/tools/checks/parts.js` proves it against the code ([`CONTRACTS.md`](CONTRACTS.md)). In `world.js`, `move.js`, `camcorder.js`,
`glitch.js` and `ents.js` (continuation C3b, ADR-005), and `mp.js` (C3c), each part is a module, one factory function, and the script's
last part (its `*.compose.js`) makes the modules in order; the build still only joins the parts, so the browser loads one classic script
as before. Those six outputs changed bytes on purpose: their behaviour is compared with B++'s by the gate's `page` step (the five) and
its `cli_golden` step (`mp.js`) instead.

The server's sim is not built any more (continuation C3a, ADR-005): it is modules the server loads from `src/` as they are, composed by
`src/core/server/sim.js`. Until C3a it was `generated/server/sim.js`, joined from eleven parts.

`public/` also holds files no recipe lists: `index.html` (the page's hand-edited source), the stylesheet `assets/ui.css`, the images,
sounds and web manifest, and the retired `assets/shadows-2d.js` (still served, unchanged). They are edited where they are.

## Every output and its sources

<!-- generated: outputs (dev/tools/docs/docs.js) -->
| Output | How | From |
|---|---|---|
| `public/assets/BufferResource-B-thlpip.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/BufferResource-B-thlpip.js` |
| `public/assets/Cache-DDo62lBW.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/Cache-DDo62lBW.js` |
| `public/assets/CanvasPool-DecUtJxW.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/CanvasPool-DecUtJxW.js` |
| `public/assets/Filter-DzecrWg_.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/Filter-DzecrWg_.js` |
| `public/assets/GCManagedHash-Bz2ZMBJN.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/GCManagedHash-Bz2ZMBJN.js` |
| `public/assets/GraphicsContext-vm7TDg_M.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/GraphicsContext-vm7TDg_M.js` |
| `public/assets/RenderTargetSystem-CgUxHIsn.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/RenderTargetSystem-CgUxHIsn.js` |
| `public/assets/br-role.js` | one source file | `frameworks/br-role/client/br-role.js` |
| `public/assets/browserAll-B-iwy0YI.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/browserAll-B-iwy0YI.js` |
| `public/assets/canvasUtils-CxYPZET9.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/canvasUtils-CxYPZET9.js` |
| `public/assets/chat.js` | one source file | `frameworks/front/client/chat.js` |
| `public/assets/voice.js` | one source file | `frameworks/front/client/voice.js` |
| `public/assets/credits_data.js` | one source file | `frameworks/front/client/credits_data.js` |
| `public/assets/getTextureBatchBindGroup-DBCrgHVb.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/getTextureBatchBindGroup-DBCrgHVb.js` |
| `public/assets/index-D7hdwmUU.css` | the client build (TypeScript and Vite: `dev/tools/build/client.js`), checked against its record | `core/client/game/` (record `generated/CLIENT_BUILD.json`) |
| `public/assets/index-DKbV5Nv9.js` | the client build (TypeScript and Vite: `dev/tools/build/client.js`), checked against its record | `core/client/game/`, with `frameworks/lost/shared/level0.json` and `frameworks/pocket/shared/lights.json` (record `generated/CLIENT_BUILD.json`) |
| `public/assets/init-Cn1_BCi0.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/init-Cn1_BCi0.js` |
| `public/assets/l0-remaster.js` | one source file | `frameworks/br-r/client/l0-remaster.js` |
| `public/assets/level0_visuals.js` | one source file | `frameworks/lost/client/level0_visuals.js` |
| `public/assets/mp-hum.js` | one source file | `frameworks/spacious-audio/client/mp-hum.js` |
| `public/assets/net-interp.js` | one source file | `frameworks/bpp/client/net-interp.js` |
| `public/assets/net-newrun.js` | one source file | `frameworks/front/client/net-newrun.js` |
| `public/assets/net-wire.js` | one source file | `frameworks/bpp/client/net-wire.js` |
| `public/assets/rgb.js` | one source file | `frameworks/front/client/rgb.js` |
| `public/assets/skinstealer.js` | 7 parts, joined in order | `frameworks/nani/client/skin.head.js`<br>`frameworks/nani/client/skin.mirror.js`<br>`frameworks/br-r/client/skin.body.js`<br>`frameworks/br-r/client/skin.kill.js`<br>`frameworks/spacious-audio/client/skin.audio.js`<br>`frameworks/spacious-audio/client/skin.sight.js`<br>`frameworks/br-r/client/skin.compose.js` |
| `public/assets/ui.js` | one source file | `frameworks/front/client/ui.js` |
| `public/assets/version.js` | written from `package.json`'s version (its one source; pre-Trial 3 polish P5) | `package.json` (`version`) |
| `public/camcorder.js` | 4 parts, joined in order | `frameworks/br-r/client/camcorder.js`<br>`frameworks/spacious-audio/client/camcorder.audio.js`<br>`frameworks/br-r/client/camcorder.view.js`<br>`frameworks/br-r/client/camcorder.compose.js` |
| `public/camera_policy.js` | one source file | `frameworks/br-r/client/camera_policy.js` |
| `public/dphys.js` | one source file | `frameworks/gib/shared/dphys.js` |
| `public/ents.js` | 7 parts, joined in order | `frameworks/br-r/client/ents.head.js`<br>`frameworks/br-r/client/ents.hound.js`<br>`frameworks/br-r/client/ents.smiler.js`<br>`frameworks/gib/client/ents.death.js`<br>`frameworks/spacious-audio/client/ents.audio.js`<br>`frameworks/overseer/client/ents.debug.js`<br>`frameworks/br-r/client/ents.compose.js` |
| `public/glitch.js` | 4 parts, joined in order | `frameworks/lost/client/glitch.js`<br>`frameworks/spacious-audio/client/glitch.audio.js`<br>`frameworks/lost/client/glitch.draw.js`<br>`frameworks/lost/client/glitch.compose.js` |
| `public/gore.js` | one source file | `frameworks/gib/client/gore.js` |
| `public/hud.js` | one source file | `frameworks/front/client/hud.js` |
| `public/inventory.js` | one source file | `frameworks/pocket/client/inventory.js` |
| `public/light.js` | one source file | `frameworks/br-role/client/light.js` |
| `public/move.js` | 4 parts, joined in order | `frameworks/space/client/move.js`<br>`frameworks/br-r/client/move.poses.js`<br>`frameworks/spacious-audio/client/move.sound.js`<br>`frameworks/space/client/move.compose.js` |
| `public/mp.js` | 12 parts, joined in order | `core/client/mp.js`<br>`frameworks/bpp/client/mp.session.js`<br>`frameworks/lost/client/mp.glitch.js`<br>`frameworks/pocket/client/mp.cartograph.js`<br>`frameworks/nani/client/mp.monsters.js`<br>`frameworks/space/client/mp.peers.js`<br>`frameworks/spacious-audio/client/mp.dread.js`<br>`frameworks/br-r/client/mp.wanderers.js`<br>`frameworks/gib/client/mp.deaths.js`<br>`frameworks/overseer/client/mp.admin.js`<br>`core/client/mp.frame.js`<br>`core/client/mp.compose.js` |
| `public/sfx.js` | one source file | `frameworks/spacious-audio/client/sfx.js` |
| `public/timing_policy.js` | one source file | `frameworks/space/shared/timing_policy.js` |
| `public/world.js` | 7 parts, joined in order | `frameworks/space/shared/world.js`<br>`frameworks/lost/shared/world.lamps.js`<br>`frameworks/space/shared/world.crawl.js`<br>`frameworks/lost/shared/world.surfaces.js`<br>`frameworks/space/shared/world.move.js`<br>`frameworks/br-r/shared/world.art.js`<br>`frameworks/space/shared/world.compose.js` |
| `generated/server/ai.js` | 12 parts, joined in order | `frameworks/nani/server/ai.head.js`<br>`frameworks/nani/server/ai.geo.js`<br>`frameworks/nani/server/ai.senses.js`<br>`frameworks/nani/server/ai.intelligence.js`<br>`frameworks/nani/server/ai.light.js`<br>`frameworks/nani/server/ai.entity.js`<br>`frameworks/nani/server/ai.capture.js`<br>`frameworks/nani/server/ai.hound.js`<br>`frameworks/nani/server/ai.smiler.js`<br>`frameworks/nani/server/ai.skin.mind.js`<br>`frameworks/nani/server/ai.skinstealer.js`<br>`frameworks/nani/server/ai.engine.js` |
| `generated/server/dphys.js` | one source file | `frameworks/gib/shared/dphys.js` |
| `generated/server/world.js` | 7 parts, joined in order | `frameworks/space/shared/world.js`<br>`frameworks/lost/shared/world.lamps.js`<br>`frameworks/space/shared/world.crawl.js`<br>`frameworks/lost/shared/world.surfaces.js`<br>`frameworks/space/shared/world.move.js`<br>`frameworks/br-r/shared/world.art.js`<br>`frameworks/space/shared/world.compose.js` |
<!-- end of generated block -->

`world.js` and `dphys.js` are built twice from the same sources: once for the page (`public/`) and once for the server
(`generated/server/`), so both always hold the same bytes.

## Doing it

```text
npm run build                                   # writes only what changed: "built 39 outputs (N files written, M already up to date)"
npm run build:check                             # "BUILD CHECK: PASS (39 outputs and the manifest are what src/ builds)"
node dev/tools/build/build.js --list            # every output and its sources
node dev/tools/build/build.js --clean           # deletes every built file and the manifest (then build again); not the compiled client
node dev/tools/build/client.js --packages <folder> --write    # the compiled client from src/core/client/game/, and its record
node dev/tools/build/client.js --packages <folder> --stage <scratch>   # the same build into a scratch folder (public/ untouched)
node dev/tools/build/client.js --record-check   # no packages: the record against the sources and the served files
```

From nothing: `--clean` then `npm run build` gives back `public/` and `generated/` byte for byte, with Node alone (no `npm install`,
no network); `--clean` leaves the compiled client's two files, which only `client.js` (with the packages) makes, and the same build gives
them back byte for byte (`dev/tools/checks/dev_workflow.js` step 7). `node dev/stage-3h-modernization/tools/m7_clean_rebuild.js --work <empty folder> [--ref <commit>]` proves it on a copy of
the working tree, or on a fresh clone of a commit. It was run on the working tree at checkpoint M7, and on a fresh clone of M7 at M8
(`dev/stage-3h-modernization/evidence/m7/`, `evidence/m8/clean_checkout.*`).

## Adding or changing a recipe

- **A new part** of an existing script: split the part it comes from with
  `node dev/stage-3h-modernization/tools/m3_split_parts.js --spec <spec.json> --apply` (it cuts by line ranges, writes the headers,
  rebuilds and checks), or by hand: add the file to the recipe, give it a header (`node dev/tools/checks/parts.js --suggest <output>`
  prints the lists), and run the checks.
- **A new script**: add `{ "out": "public/<name>.js", "parts": ["src/frameworks/<owner>/client/<name>.js"] }`; the page loads it only if
  `index.html` says so, and the server serves it only if its `SERVE` list allows the path (`src/frameworks/ward/server/static.js`).
- **The compiled bundle or its stylesheet**: never by hand. Edit `src/core/client/game/` and build with
  `node dev/tools/build/client.js --packages <folder> --write`, then `npm run build` (the manifest):
  [`src/core/client/game/README.md`](../../src/core/client/game/README.md).

## Where the bundle comes from

The page's core, `public/assets/index-DKbV5Nv9.js`, is built since continuation C4b from `src/core/client/game/`: the recovered original
Vite + TypeScript project (version 11, kept as it was in `src/core/client/bundle/original-v11/`) with the forty edits made to its
compiled output since v11 ported into readable, owned TypeScript (`src/core/client/game/PORT_LEDGER.md`). Its toolchain is v11's
(Vite 8.3.1, TypeScript 7.0.2, PixiJS 8.21.0, the same lockfile); `client.js` installs it offline from the owner's verified packages
(continuation C1 proved that the same install rebuilds v11's `dist/` byte for byte). The port is proven the same program as the bundle
it replaces (`src/core/client/bundle/README.md`, "How the port is proven the same program"). ADR-002 explains the decision.
