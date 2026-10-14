# The build: from `src/` to what the browser and the server load

## In one paragraph

`npm run build` (`dev/tools/build/build.js`; no dependencies) reads `src/build-recipes.json` and writes every output in it: the scripts
the browser loads into `public/`, and the scripts the server loads into `generated/server/`. It records every input and output, with
their SHA-256, in `generated/BUILD_MANIFEST.json`. The outputs are committed, because the production host pulls `main` and runs
`node server.js` with no build step. `npm run build:check` builds in memory and fails if anything committed differs. The gate runs it.

## Three kinds of output

| Kind | How it is built | Example |
|---|---|---|
| **Parts, joined** | Each part's text, in recipe order. A part file may begin with a `/** @part ... */` header, which the build removes: nothing else is changed (no minifying, no transpiling, no wrapping) | `public/mp.js`: 16 parts from 10 frameworks' folders |
| **A copy of the recovered v11 build** | One part: a file of `src/core/client/bundle/original-v11/dist/` | the 11 PixiJS chunks |
| **A replay of the lineage ledger** | The v11 build output, then every recorded step's patch, each checked by its SHA-256 before and after | `public/assets/index-DKbV5Nv9.js`, `index-D7hdwmUU.css` |

The parts of one script share one closure (an IIFE, a UMD factory, `createSim`). Each part's header says what it provides to the
others, what it uses of theirs and which of their bindings it writes; `dev/tools/checks/parts.js` proves it against the code
([`CONTRACTS.md`](CONTRACTS.md)).

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
| `public/assets/credits_data.js` | one source file | `frameworks/front/client/credits_data.js` |
| `public/assets/getTextureBatchBindGroup-DBCrgHVb.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/getTextureBatchBindGroup-DBCrgHVb.js` |
| `public/assets/index-D7hdwmUU.css` | a replay of the lineage ledger | `src/core/client/bundle/lineage/ledger.json` (chain `css`) |
| `public/assets/index-DKbV5Nv9.js` | a replay of the lineage ledger | `src/core/client/bundle/lineage/ledger.json` (chain `bundle`) |
| `public/assets/init-Cn1_BCi0.js` | a copy of the v11 build output | `core/client/bundle/original-v11/dist/assets/init-Cn1_BCi0.js` |
| `public/assets/l0-remaster.js` | one source file | `frameworks/br-r/client/l0-remaster.js` |
| `public/assets/level0_visuals.js` | one source file | `frameworks/lost/client/level0_visuals.js` |
| `public/assets/mp-hum.js` | one source file | `frameworks/spacious-audio/client/mp-hum.js` |
| `public/assets/net-interp.js` | one source file | `frameworks/bpp/client/net-interp.js` |
| `public/assets/net-newrun.js` | one source file | `frameworks/front/client/net-newrun.js` |
| `public/assets/net-wire.js` | one source file | `frameworks/bpp/client/net-wire.js` |
| `public/assets/ui.js` | one source file | `frameworks/front/client/ui.js` |
| `public/camcorder.js` | 3 parts, joined in order | `frameworks/br-r/client/camcorder.js`<br>`frameworks/spacious-audio/client/camcorder.audio.js`<br>`frameworks/br-r/client/camcorder.view.js` |
| `public/camera_policy.js` | one source file | `frameworks/br-r/client/camera_policy.js` |
| `public/dphys.js` | one source file | `frameworks/gib/shared/dphys.js` |
| `public/ents.js` | 6 parts, joined in order | `frameworks/br-r/client/ents.head.js`<br>`frameworks/br-r/client/ents.hound.js`<br>`frameworks/br-r/client/ents.smiler.js`<br>`frameworks/gib/client/ents.death.js`<br>`frameworks/spacious-audio/client/ents.audio.js`<br>`frameworks/overseer/client/ents.debug.js` |
| `public/glitch.js` | 3 parts, joined in order | `frameworks/lost/client/glitch.js`<br>`frameworks/spacious-audio/client/glitch.audio.js`<br>`frameworks/lost/client/glitch.draw.js` |
| `public/gore.js` | one source file | `frameworks/gib/client/gore.js` |
| `public/hud.js` | one source file | `frameworks/front/client/hud.js` |
| `public/inventory.js` | one source file | `frameworks/pocket/client/inventory.js` |
| `public/light.js` | one source file | `frameworks/br-role/client/light.js` |
| `public/move.js` | 3 parts, joined in order | `frameworks/space/client/move.js`<br>`frameworks/br-r/client/move.poses.js`<br>`frameworks/spacious-audio/client/move.sound.js` |
| `public/mp.js` | 16 parts, joined in order | `core/client/mp.js`<br>`frameworks/bpp/client/mp.net.js`<br>`frameworks/gib/client/mp.owndeath.js`<br>`frameworks/bpp/client/mp.newrun.js`<br>`frameworks/space/client/mp.peers.js`<br>`frameworks/bpp/client/mp.transport.js`<br>`frameworks/nani/client/mp.monsters.js`<br>`frameworks/lost/client/mp.glitch.js`<br>`frameworks/pocket/client/mp.cartograph.js`<br>`frameworks/gib/client/mp.bodies.js`<br>`frameworks/spacious-audio/client/mp.dread.js`<br>`frameworks/br-r/client/mp.wanderers.js`<br>`frameworks/gib/client/mp.replays.js`<br>`frameworks/overseer/client/mp.admin.js`<br>`frameworks/overseer/client/mp.deathlab.js`<br>`core/client/mp.frame.js` |
| `public/sfx.js` | one source file | `frameworks/spacious-audio/client/sfx.js` |
| `public/timing_policy.js` | one source file | `frameworks/space/shared/timing_policy.js` |
| `public/world.js` | 6 parts, joined in order | `frameworks/space/shared/world.js`<br>`frameworks/lost/shared/world.lamps.js`<br>`frameworks/space/shared/world.crawl.js`<br>`frameworks/lost/shared/world.surfaces.js`<br>`frameworks/space/shared/world.move.js`<br>`frameworks/br-r/shared/world.art.js` |
| `generated/server/ai.js` | 10 parts, joined in order | `frameworks/nani/server/ai.head.js`<br>`frameworks/nani/server/ai.geo.js`<br>`frameworks/nani/server/ai.senses.js`<br>`frameworks/nani/server/ai.intelligence.js`<br>`frameworks/nani/server/ai.light.js`<br>`frameworks/nani/server/ai.entity.js`<br>`frameworks/nani/server/ai.capture.js`<br>`frameworks/nani/server/ai.hound.js`<br>`frameworks/nani/server/ai.smiler.js`<br>`frameworks/nani/server/ai.engine.js` |
| `generated/server/dphys.js` | one source file | `frameworks/gib/shared/dphys.js` |
| `generated/server/sim.js` | 11 parts, joined in order | `core/server/sim.header.js`<br>`frameworks/lost/server/sim.level0.js`<br>`frameworks/nani/server/sim.ai.js`<br>`frameworks/lost/server/sim.glitches.js`<br>`frameworks/gib/server/sim.bodies.js`<br>`frameworks/space/server/sim.players.js`<br>`frameworks/space/server/sim.movement.js`<br>`frameworks/nani/server/sim.feed.js`<br>`core/server/sim.step.js`<br>`frameworks/overseer/server/sim.admin.js`<br>`core/server/sim.glue.js` |
| `generated/server/world.js` | 6 parts, joined in order | `frameworks/space/shared/world.js`<br>`frameworks/lost/shared/world.lamps.js`<br>`frameworks/space/shared/world.crawl.js`<br>`frameworks/lost/shared/world.surfaces.js`<br>`frameworks/space/shared/world.move.js`<br>`frameworks/br-r/shared/world.art.js` |
<!-- end of generated block -->

`world.js` and `dphys.js` are built twice from the same sources: once for the page (`public/`) and once for the server
(`generated/server/`), so both always hold the same bytes.

## Doing it

```text
npm run build                                   # writes only what changed: "built 40 outputs (N files written, M already up to date)"
npm run build:check                             # "BUILD CHECK: PASS (40 outputs and the manifest are what src/ builds)"
node dev/tools/build/build.js --list            # every output and its sources
node dev/tools/build/build.js --clean           # deletes every built file and the manifest (then build again)
```

From nothing: `--clean` then `npm run build` gives back `public/` and `generated/` byte for byte, with Node alone (no `npm install`,
no network). `node dev/stage-3h-modernization/tools/m7_clean_rebuild.js --work <empty folder> [--ref <commit>]` proves it on a copy of
the working tree, or on a fresh clone of a commit. It was run at checkpoint M7 (`dev/stage-3h-modernization/evidence/m7/`).

## Adding or changing a recipe

- **A new part** of an existing script: split the part it comes from with
  `node dev/stage-3h-modernization/tools/m3_split_parts.js --spec <spec.json> --apply` (it cuts by line ranges, writes the headers,
  rebuilds and checks), or by hand: add the file to the recipe, give it a header (`node dev/tools/checks/parts.js --suggest <output>`
  prints the lists), and run the checks.
- **A new script**: add `{ "out": "public/<name>.js", "parts": ["src/frameworks/<owner>/client/<name>.js"] }`; the page loads it only if
  `index.html` says so, and the server serves it only if its `SERVE` list allows the path (`src/frameworks/ward/server/static.js`).
- **The compiled bundle or its stylesheet**: never by hand. Record the change as a lineage step
  (`node dev/tools/lineage/lineage.js record bundle --label "..."`): [`src/core/client/bundle/README.md`](../../src/core/client/bundle/README.md).

## Where the bundle comes from

The page's core, `public/assets/index-DKbV5Nv9.js`, is the build output of the recovered original Vite + TypeScript project
(`src/core/client/bundle/original-v11/`, version 11), plus forty recorded in-place edits. That project builds by itself with its own
toolchain (Vite 8.3.1, TypeScript 7.0.2, PixiJS 8.21.0, its lockfile), in a copy and never into this repository: `npm ci && npm run build`.
That rebuild was **not tested** in Stage 3H (no package registry access); the recovery's own receipt and the byte identity of its `dist/`
are the evidence. ADR-002 explains the decision and the TypeScript port that would make the bundle compiled from readable source.
