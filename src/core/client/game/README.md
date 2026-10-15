# src/core/client/game: the compiled client's source

The source of the page's compiled client (`public/assets/index-DKbV5Nv9.js`, its stylesheet `public/assets/index-D7hdwmUU.css` and
the PixiJS chunks): TypeScript, PixiJS 8 and Vite, the recovered v11 project (`../bundle/original-v11/`) with the forty edits made to
its output since v11 ported into readable, owned source (Stage 3H continuation C4: ported and proven at C4a, served since C4b; until
then the served files were the lineage's replay, `../bundle/lineage/`, which stays as their history).

- `shared/`: the level, movement, the lights, the entities and their navigation, vision and the walls' receivers, the remains.
- `client/`: the PixiJS views, the renderer, the audio, NEW RUN's arrival and departure (`arrival.ts`), the frame loop and the
  page's controls (`main.ts`), what the page's other scripts publish on `window` (`contracts.d.ts`: each member, its type and the script that defines it;
  `dev/tools/checks/window_contract.js` holds it to the code on both sides).
- `client/style.css` is v11's own stylesheet; `client/style-after-v11.css` holds the rules the eight stylesheet steps added (the
  build appends it as it is: the file says why).
- `PORT_LEDGER.md` (generated) says, for each of the forty steps, what it did, its owners and where its text is now. The source's
  comments name the step at each change ("(B12) ...").
- `level-data.cjs` (continuation C4c): Level 0 and the carried lights are defined once, outside this folder, for the server and the
  page (`src/frameworks/lost/shared/level0.json`, `src/frameworks/pocket/shared/lights.json`). The build reads them and defines a
  constant for each value (`LEVEL0_ROOMS`, `LIGHT_KINDS` ...; Vite's `define`, typed in `shared/level-data.d.ts`): `shared/world.ts`
  and `shared/equipment.ts` name the constants, and the bundle holds the values where they are named, as it did before C4c.

## Building

`node dev/tools/build/client.js --packages <folder of the 31 locked .tgz> --stage <scratch folder>` builds into a scratch folder;
`--write` puts the outputs in `public/assets/` and writes their record, `generated/CLIENT_BUILD.json`; `--record-check` (no packages
needed) checks that the record is this folder's sources and the served files. The packages are installed offline after each is
checked against `package-lock.json` (which must stay v11's: a dependency change is its own, separately approved step). The two
definitions are inputs of the build: `client.js` copies them into its work folder and records them with the sources, so an edit of
either is refused by `--record-check` and `build.js --check` until the client is built again. Never edit the built files by hand:
`node dev/tools/build/build.js --check` refuses them.

## What must stay true

The port is the shipped program, not a new one: `dev/stage-3h-modernization/tools/c4_alpha_all.mjs` compares every top-level
statement of the shipped app code with it (modulo names and a stated normal form; the deliberate changes of structure are listed
with their reasons in `c4_alpha_modules.json`; since C4c with the definitions' values in place of the constants' names),
`c4_css_check.mjs` the stylesheet, and `dev/tools/gate/golden/bundle_diff.js` the
built client against the recorded one in Chromium, frame by frame. The gate's `port` and `bundle` steps run them.
`window.__api` keeps its 52 members in their order (`../bundle/api_contract.json`).
