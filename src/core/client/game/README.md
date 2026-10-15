# src/core/client/game: the compiled client's source

The source of the page's compiled client (`public/assets/index-DKbV5Nv9.js`, its stylesheet `public/assets/index-D7hdwmUU.css` and
the PixiJS chunks): TypeScript, PixiJS 8 and Vite, the recovered v11 project (`../bundle/original-v11/`) with the forty edits made to
its output since v11 ported into readable, owned source (Stage 3H continuation C4). At C4a it is built and proven against the served
files, which are still the lineage's replay (`../bundle/lineage/`); from C4b the served files are its build.

- `shared/`: the level, movement, the lights, the entities and their navigation, vision and the walls' receivers, the remains.
- `client/`: the PixiJS views, the renderer, the audio, NEW RUN's arrival and departure (`arrival.ts`), the frame loop and the
  page's controls (`main.ts`), what the page's other scripts publish on `window` (`contracts.d.ts`).
- `client/style.css` is v11's own stylesheet; `client/style-after-v11.css` holds the rules the eight stylesheet steps added (the
  build appends it as it is: the file says why).
- `PORT_LEDGER.md` (generated) says, for each of the forty steps, what it did, its owners and where its text is now. The source's
  comments name the step at each change ("(B12) ...").

## Building

`node dev/tools/build/client.js --packages <folder of the 31 locked .tgz> --stage <scratch folder>` builds into a scratch folder;
`--write` puts the outputs in `public/assets/` and writes their record, `generated/CLIENT_BUILD.json`; `--record-check` (no packages
needed) checks that the record is this folder's sources and the served files. The packages are installed offline after each is
checked against `package-lock.json` (which must stay v11's: a dependency change is its own, separately approved step). Never edit the
built files by hand: `node dev/tools/build/build.js --check` refuses them.

## What must stay true

The port is the shipped program, not a new one: `dev/stage-3h-modernization/tools/c4_alpha_all.mjs` compares every top-level
statement of the shipped app code with it (modulo names and a stated normal form; the deliberate changes of structure are listed
with their reasons in `c4_alpha_modules.json`), `c4_css_check.mjs` the stylesheet, and `dev/tools/gate/golden/bundle_diff.js` the
built client against the recorded one in Chromium, frame by frame. The gate's `port` and `bundle` steps run them.
`window.__api` keeps its 52 members in their order (`../bundle/api_contract.json`).
